import {
  Color3,
  Color4,
  DirectionalLight,
  Engine,
  HavokPlugin,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  PhysicsBody,
  PhysicsMotionType,
  PhysicsShapeBox,
  PhysicsShapeContainer,
  PhysicsShapeMesh,
  Quaternion,
  Scene,
  ShadowGenerator,
  StandardMaterial,
  TransformNode,
  Vector3,
  VertexData,
} from './babylon.ts';
import HavokPhysics from '@babylonjs/havok';
import havokWasmUrl from '@babylonjs/havok/lib/esm/HavokPhysics.wasm?url';
import {
  createRandom,
  isOnPath,
  MAP,
  type MapId,
  mapObstacles,
  mapStructures,
  nearStructure,
  CASTLE,
  MAPS,
  WATER,
  type Obstacle,
  type Structure,
  randomRange,
  SIM,
  TERRAIN,
  TERRAIN_CELLS,
  TERRAIN_VERTS,
  terrainHeightAt,
  terrainHeightGrid,
} from '@tumblehorde/shared';
import { COLORS, HOUSE, type HslRange, LIGHTING, MAP_THEMES, type MapTheme } from '../visualConfig.ts';
import { PartFactory } from './parts.ts';

export interface World {
  engine: Engine;
  scene: Scene;
  sun: DirectionalLight;
  hemi: HemisphericLight;
  shadows: ShadowGenerator;
  parts: PartFactory;
  edgeMaterial: StandardMaterial;
  map: MapId | null;
  /** Everything that belongs to the current map; rebuilt when the map changes. */
  mapRoot: TransformNode | null;
  terrainBody: PhysicsBody | null;
  /** Every wall and house as one static body, so the dead bounce off buildings instead of flying through. */
  structureBody: PhysicsBody | null;
}

const EDGE_POST_SPACING = 9;
const EDGE_WALL_HEIGHT = 9;
/** Slopes steeper than this show bare rock on maps that have rock colors. */
const ROCK_SLOPE = 0.55;

export async function createWorld(canvas: HTMLCanvasElement): Promise<World> {
  const engine = new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: true });
  const scene = new Scene(engine);
  scene.fogMode = Scene.FOGMODE_LINEAR;
  scene.fogStart = LIGHTING.fogStart;
  scene.fogEnd = LIGHTING.fogEnd;
  scene.skipPointerMovePicking = true;

  const havok = await HavokPhysics({ locateFile: () => havokWasmUrl });
  scene.enablePhysics(new Vector3(0, -SIM.gravity, 0), new HavokPlugin(true, havok));

  const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene);
  hemi.specular = Color3.Black();
  hemi.intensity = LIGHTING.hemiIntensity;

  const [dx, dy, dz] = LIGHTING.sunDirection;
  const sun = new DirectionalLight('sun', new Vector3(dx, dy, dz).normalize(), scene);
  sun.intensity = LIGHTING.sunIntensity;
  sun.autoUpdateExtends = false;
  sun.shadowMinZ = 1;
  sun.shadowMaxZ = 160;
  setShadowArea(sun, Vector3.Zero());

  const shadows = new ShadowGenerator(LIGHTING.shadowMapSize, sun);
  shadows.usePercentageCloserFiltering = true;
  shadows.bias = 0.002;
  shadows.normalBias = 0.02;

  const edgeMaterial = new StandardMaterial('edge', scene);
  edgeMaterial.diffuseColor = Color3.FromHexString(COLORS.edgeWall);
  edgeMaterial.emissiveColor = Color3.FromHexString(COLORS.edgeWall).scale(0.6);
  edgeMaterial.alpha = 0;
  edgeMaterial.backFaceCulling = false;
  edgeMaterial.disableLighting = true;

  const world: World = {
    engine,
    scene,
    sun,
    hemi,
    shadows,
    parts: new PartFactory(scene, shadows),
    edgeMaterial,
    map: null,
    mapRoot: null,
    terrainBody: null,
    structureBody: null,
  };
  loadMap(world, 'meadow');
  return world;
}

/** Builds the terrain, scenery and lighting for a map, replacing the previous one. */
export function loadMap(world: World, map: MapId): void {
  if (world.map === map) return;
  world.terrainBody?.shape?.dispose();
  world.terrainBody?.dispose();
  world.structureBody?.shape?.dispose();
  world.structureBody?.dispose();
  world.structureBody = null;
  world.mapRoot?.dispose();
  const theme = MAP_THEMES[map];
  const { scene } = world;
  scene.clearColor = Color4.FromHexString(`${theme.sky}FF`);
  scene.fogColor = Color3.FromHexString(theme.fog);
  world.hemi.diffuse = Color3.FromHexString(theme.hemiSky);
  world.hemi.groundColor = Color3.FromHexString(theme.hemiGround);
  world.sun.diffuse = Color3.FromHexString(theme.sun);

  const root = new TransformNode(`map-${map}`, scene);
  const terrain = createTerrain(scene, map, theme);
  terrain.parent = root;
  const body = new PhysicsBody(terrain, PhysicsMotionType.STATIC, false, scene);
  body.shape = new PhysicsShapeMesh(terrain, scene);
  createScenery(world.parts, root, map, theme);
  for (const s of mapStructures(map)) createStructure(world.parts, root, map, s, theme);
  world.structureBody = createStructureBody(scene, root, map);
  createEdge(scene, world.parts, root, map, world.edgeMaterial);
  if (MAPS[map].layout === 'siege') createMoat(scene, world.parts, root);
  // Scenery never moves: compute its transforms once instead of every frame.
  root.computeWorldMatrix(true);
  for (const node of root.getChildTransformNodes(false)) node.freezeWorldMatrix();
  for (const mesh of root.getChildMeshes(false)) mesh.freezeWorldMatrix();
  world.map = map;
  world.mapRoot = root;
  world.terrainBody = body;
}

/** The shadow map only covers the area around the camera's focus, for sharp shadows. */
export function setShadowArea(sun: DirectionalLight, focus: Vector3): void {
  const range = LIGHTING.shadowRange;
  sun.position = focus.subtract(sun.direction.scale(80));
  sun.orthoLeft = -range;
  sun.orthoRight = range;
  sun.orthoTop = range;
  sun.orthoBottom = -range;
}

function hslColor(h: number, s: number, l: number): Color3 {
  // Babylon has no HSL helper; convert by hand.
  const c = new Color3();
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number): number => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  c.set(channel(h + 1 / 3), channel(h), channel(h - 1 / 3));
  return c;
}

function pick(rng: ReturnType<typeof createRandom>, range: HslRange): Color3 {
  return hslColor(range.hue, range.saturation, randomRange(rng, range.lightMin, range.lightMax));
}

type Vertex = [number, number, number];

/** Flat-shaded terrain whose triangles match shared `terrainHeightAt` exactly. */
function createTerrain(scene: Scene, map: MapId, theme: MapTheme): Mesh {
  const grid = terrainHeightGrid(map);
  const rng = createRandom(MAP.seed + 1);
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const vertex = (i: number, j: number): Vertex => [
    -TERRAIN.extent + i * TERRAIN.cellSize,
    grid[j * TERRAIN_VERTS + i] ?? 0,
    -TERRAIN.extent + j * TERRAIN.cellSize,
  ];
  const colorFor = (a: Vertex, b: Vertex, c: Vertex): Color3 => {
    const cx = (a[0] + b[0] + c[0]) / 3;
    const cy = (a[1] + b[1] + c[1]) / 3;
    const cz = (a[2] + b[2] + c[2]) / 3;
    if (theme.rock) {
      const slope = Math.max(Math.abs(a[1] - b[1]), Math.abs(b[1] - c[1]), Math.abs(a[1] - c[1])) / TERRAIN.cellSize;
      if (slope > ROCK_SLOPE || cy > theme.rockHeight) return pick(rng, theme.rock);
    }
    return isOnPath(map, cx, cz) ? pick(rng, theme.path) : pick(rng, theme.ground);
  };
  const addTriangle = (a: Vertex, b: Vertex, c: Vertex): void => {
    const color = colorFor(a, b, c);
    for (const v of [a, b, c]) {
      indices.push(positions.length / 3);
      positions.push(v[0], v[1], v[2]);
      colors.push(color.r, color.g, color.b, 1);
    }
  };
  for (let j = 0; j < TERRAIN_CELLS; j++) {
    for (let i = 0; i < TERRAIN_CELLS; i++) {
      const v00 = vertex(i, j);
      const v10 = vertex(i + 1, j);
      const v01 = vertex(i, j + 1);
      const v11 = vertex(i + 1, j + 1);
      addTriangle(v00, v10, v11);
      addTriangle(v00, v11, v01);
    }
  }
  const data = new VertexData();
  data.positions = positions;
  data.indices = indices;
  data.colors = colors;
  const normals: number[] = [];
  VertexData.ComputeNormals(positions, indices, normals);
  data.normals = normals;
  const mesh = new Mesh('terrain', scene);
  data.applyToMesh(mesh);
  const mat = new StandardMaterial(`terrain-${map}`, scene);
  mat.specularColor = Color3.Black();
  mesh.material = mat;
  mesh.receiveShadows = true;
  mesh.isPickable = false;
  mesh.freezeWorldMatrix();
  return mesh;
}

function placeObstacle(parts: PartFactory, root: TransformNode, map: MapId, o: Obstacle, theme: MapTheme): void {
  const node = new TransformNode(o.kind, root.getScene());
  node.parent = root;
  node.position.set(o.x, terrainHeightAt(map, o.x, o.z), o.z);
  node.rotation.y = (o.variant % 628) / 100;
  node.scaling.setAll(o.scale);
  switch (o.kind) {
    case 'tree':
      parts.part('cylinder', theme.treeTrunk, node, [0.35, 2.2, 0.35], [0, 1.1, 0]);
      parts.part('cone', theme.leaves, node, [2.3, 2.6, 2.3], [0, 2.6, 0]);
      parts.part('cone', theme.leaves, node, [1.8, 2.2, 1.8], [0, 4.1, 0]).rotation.y = 0.5;
      parts.part('cone', theme.leavesTop, node, [1.25, 1.7, 1.25], [0, 5.4, 0]).rotation.y = 1.1;
      break;
    case 'rock': {
      const rock = parts.part('rock', theme.rockColor, node, [1, 0.8, 1], [0, 0.45, 0]);
      rock.rotation.set(0.4, 0, 0.3);
      if (o.variant % 3 === 0) parts.part('rock', theme.rockColor, node, [0.55, 0.45, 0.5], [0.8, 0.2, 0.3]);
      break;
    }
    case 'cactus': {
      parts.part('capsule', theme.cactus, node, [0.5, 2.6, 0.5], [0, 1.2, 0], { gloss: true });
      const arm = o.variant % 2 === 0 ? 1 : -1;
      parts.part('capsule', theme.cactus, node, [0.32, 0.9, 0.32], [0.45 * arm, 1.5, 0], { gloss: true }).rotation.z = -0.9 * arm;
      parts.part('capsule', theme.cactus, node, [0.3, 0.8, 0.3], [0.62 * arm, 1.95, 0], { gloss: true });
      parts.part('capsule', theme.cactus, node, [0.26, 0.6, 0.26], [-0.32 * arm, 1.0, 0], { gloss: true }).rotation.z = 0.9 * arm;
      parts.part('sphere', '#F28AB8', node, [0.18, 0.14, 0.18], [0, 2.5, 0]);
      break;
    }
  }
}

const CRENEL_SPACING = 1.3;

/** Picks a color for a building from its position, the same every time. */
function variant(colors: readonly string[], a: number, b: number): string | undefined {
  const hash = Math.abs(Math.floor(a * 7.3 + b * 3.1));
  return colors[hash % colors.length];
}
const FENCE_POST_SPACING = 1.6;

/** Houses, walls, towers and ruins. Their collision boxes live in the shared simulation. */
/** One static physics body holding a box for every structure on the map. Null on maps without any. */
function createStructureBody(scene: Scene, root: TransformNode, map: MapId): PhysicsBody | null {
  const structures = mapStructures(map);
  if (structures.length === 0) return null;
  const holder = new TransformNode('structure-colliders', scene);
  holder.parent = root;
  holder.rotationQuaternion = Quaternion.Identity();
  const container = new PhysicsShapeContainer(scene);
  for (const s of structures) {
    const ground = terrainHeightAt(map, s.x, s.z);
    const box = new PhysicsShapeBox(Vector3.Zero(), Quaternion.Identity(), new Vector3(s.width, s.height, s.depth), scene);
    container.addChild(box, new Vector3(s.x, ground + s.height / 2, s.z), Quaternion.RotationYawPitchRoll(s.yaw, 0, 0));
  }
  const body = new PhysicsBody(holder, PhysicsMotionType.STATIC, false, scene);
  body.shape = container;
  return body;
}

function createStructure(parts: PartFactory, root: TransformNode, map: MapId, s: Structure, theme: MapTheme): void {
  const node = new TransformNode(s.kind, root.getScene());
  node.parent = root;
  node.position.set(s.x, terrainHeightAt(map, s.x, s.z), s.z);
  node.rotation.y = s.yaw;
  const { width: w, depth: d, height: h } = s;
  const plaster = variant(theme.plasters, s.x, s.z) ?? theme.plaster;
  const roofColor = variant(theme.roofs, s.z, s.x) ?? theme.roof;
  switch (s.kind) {
    case 'house': {
      // Tall town houses keep a modest roof and get a row of windows on every floor.
      const roof = Math.min(h * HOUSE.roofShare, d * HOUSE.roofPitch);
      const wallTop = h - roof;
      parts.part('box', plaster, node, [w, wallTop + 0.2, d], [0, wallTop / 2 - 0.2, 0]);
      parts.part('box', theme.stone, node, [w + 0.1, 0.5, d + 0.1], [0, 0.05, 0]);
      const slope = Math.hypot(d / 2, roof);
      const angle = Math.atan2(roof, d / 2);
      parts.part('box', roofColor, node, [w + 0.6, 0.22, slope + 0.3], [0, wallTop + roof / 2, d / 4]).rotation.x = angle;
      parts.part('box', roofColor, node, [w + 0.6, 0.22, slope + 0.3], [0, wallTop + roof / 2, -d / 4]).rotation.x = -angle;
      // Gable ends: a box turned 45° shows a triangle above the eaves; squash it to the roof's height.
      const gable = new TransformNode('gable', node.getScene());
      gable.parent = node;
      gable.position.y = wallTop;
      gable.scaling.y = roof / (d / 2);
      parts.part('box', plaster, gable, [w - 0.1, d / Math.SQRT2, d / Math.SQRT2], [0, 0, 0]).rotation.x = Math.PI / 4;
      parts.part('box', COLORS.darkWood, node, [1.1, 2, 0.12], [0, 1, d / 2 + 0.02]);
      const columns = w > HOUSE.twoWindowWidth ? [-w * 0.27, w * 0.27] : [0];
      const floors = Math.max(1, Math.floor((wallTop - HOUSE.firstWindow) / HOUSE.floorHeight) + 1);
      for (let f = 0; f < floors; f++) {
        const y = HOUSE.firstWindow + f * HOUSE.floorHeight;
        for (const face of [1, -1]) {
          for (const x of columns) {
            if (f === 0 && face === 1 && x === 0) continue;
            parts.part('box', COLORS.pupil, node, [0.7, 0.85, 0.1], [x, y, face * (d / 2 + 0.02)], { castShadow: false });
          }
        }
      }
      break;
    }
    case 'stall': {
      // A market stall: a counter under a striped awning on four posts.
      parts.part('box', COLORS.wood, node, [w, 0.9, d * 0.5], [0, 0.45, d * 0.2]);
      for (const x of [-w / 2 + 0.1, w / 2 - 0.1]) for (const z of [-d / 2 + 0.1, d / 2 - 0.1]) parts.part('box', COLORS.darkWood, node, [0.12, h, 0.12], [x, h / 2, z]);
      const stripes = 4;
      for (let i = 0; i < stripes; i++) {
        const color = i % 2 === 0 ? roofColor : COLORS.edgePost;
        parts.part('box', color, node, [w / stripes + 0.02, 0.1, d + 0.5], [-w / 2 + (i + 0.5) * (w / stripes), h, 0]).rotation.x = 0.15;
      }
      parts.part('roundSphere', COLORS.accent, node, [0.3, 0.3, 0.3], [-w * 0.25, 1.05, d * 0.2]);
      parts.part('roundSphere', '#7CB342', node, [0.28, 0.28, 0.28], [w * 0.1, 1.05, d * 0.2]);
      break;
    }
    case 'barrel':
      parts.part('roundCylinder', COLORS.wood, node, [w, h, d], [0, h / 2, 0]);
      for (const y of [0.2, 0.8]) parts.part('roundCylinder', COLORS.darkWood, node, [w + 0.04, 0.08, d + 0.04], [0, h * y, 0]);
      break;
    case 'hut':
      parts.part('box', theme.plaster, node, [w, h * 0.7, d], [0, h * 0.35, 0]);
      parts.part('dome', theme.roof, node, [w * 1.05, h * 0.7, d * 1.05], [0, h * 0.7, 0]);
      parts.part('box', COLORS.darkWood, node, [1, 1.6, 0.1], [0, 0.8, d / 2 + 0.02]);
      break;
    case 'wall': {
      parts.part('box', theme.stone, node, [w, h, d], [0, h / 2 - 0.15, 0]);
      for (let x = -w / 2 + CRENEL_SPACING / 2; x < w / 2; x += CRENEL_SPACING) {
        parts.part('box', theme.stone, node, [CRENEL_SPACING * 0.55, 0.45, d], [x, h + 0.07, 0]);
      }
      break;
    }
    case 'tower':
      parts.part('cylinder', theme.stone, node, [w / 2, h, d / 2], [0, h / 2 - 0.2, 0]);
      parts.part('cone', theme.roof, node, [w * 0.65, 2.2, d * 0.65], [0, h + 0.9, 0]);
      break;
    case 'pillar':
      parts.part('cylinder', theme.stone, node, [w / 2.4, h, d / 2.4], [0, h / 2, 0]);
      parts.part('box', theme.stone, node, [w * 1.1, 0.35, d * 1.1], [0, h, 0]);
      parts.part('box', theme.stone, node, [w * 1.1, 0.35, d * 1.1], [0, 0.15, 0]);
      break;
    case 'fence':
      for (let x = -w / 2; x <= w / 2 + 0.01; x += FENCE_POST_SPACING) parts.part('box', COLORS.wood, node, [0.16, h, 0.16], [x, h / 2, 0]);
      parts.part('box', COLORS.wood, node, [w, 0.12, 0.08], [0, h * 0.75, 0]);
      parts.part('box', COLORS.wood, node, [w, 0.12, 0.08], [0, h * 0.4, 0]);
      break;
    case 'keep': {
      parts.part('box', theme.stone, node, [w, h, d], [0, h / 2 - 0.15, 0]);
      for (const [x, z, along] of [[0, d / 2, true], [0, -d / 2, true], [w / 2, 0, false], [-w / 2, 0, false]] as const) {
        const length = along ? w : d;
        for (let t = -length / 2 + CRENEL_SPACING / 2; t < length / 2; t += CRENEL_SPACING) {
          parts.part('box', theme.stone, node, [along ? CRENEL_SPACING * 0.55 : 0.6, 0.6, along ? 0.6 : CRENEL_SPACING * 0.55], [along ? t : x, h + 0.15, along ? z : t]);
        }
      }
      parts.part('box', COLORS.darkWood, node, [2.4, 3.2, 0.2], [0, 1.6, d / 2 + 0.05]);
      parts.part('cylinder', COLORS.darkWood, node, [0.08, 4, 0.08], [0, h + 2, 0]);
      parts.part('box', COLORS.accent, node, [0.05, 1.1, 1.8], [0, h + 3.3, 0.9]);
      break;
    }
    case 'temple': {
      // A podium, a ring of columns, and a gabled roof: the forum's temple.
      parts.part('box', theme.stone, node, [w + 1.2, 1, d + 1.2], [0, 0.35, 0]);
      parts.part('box', COLORS.edgePost, node, [w * 0.6, h * 0.7, d * 0.55], [0, h * 0.4, -d * 0.1]);
      const columns = 6;
      for (let i = 0; i < columns; i++) {
        const x = -w / 2 + 0.6 + (i * (w - 1.2)) / (columns - 1);
        for (const z of [d / 2 - 0.4, -d / 2 + 0.4]) parts.part('cylinder', COLORS.edgePost, node, [0.35, h * 0.72, 0.35], [x, 0.85 + h * 0.36, z]);
      }
      parts.part('box', COLORS.edgePost, node, [w + 0.4, 0.6, d + 0.4], [0, h * 0.88, 0]);
      const rise = h * 0.22;
      const slope = Math.hypot(d / 2, rise);
      const angle = Math.atan2(rise, d / 2);
      parts.part('box', roofColor, node, [w + 0.8, 0.25, slope + 0.3], [0, h * 0.95 + rise / 2, d / 4]).rotation.x = angle;
      parts.part('box', roofColor, node, [w + 0.8, 0.25, slope + 0.3], [0, h * 0.95 + rise / 2, -d / 4]).rotation.x = -angle;
      break;
    }
    case 'well':
      parts.part('cylinder', theme.stone, node, [w / 2, h, d / 2], [0, h / 2, 0]);
      parts.part('cylinder', '#3E6E8E', node, [w / 2.6, 0.1, d / 2.6], [0, h + 0.02, 0]);
      for (const side of [-1, 1]) parts.part('box', COLORS.wood, node, [0.15, 2.2, 0.15], [side * w * 0.4, h + 1, 0]);
      parts.part('box', theme.roof, node, [w * 1.1, 0.15, d * 0.9], [0, h + 2.1, 0]);
      break;
  }
}

function createScenery(parts: PartFactory, root: TransformNode, map: MapId, theme: MapTheme): void {
  for (const o of mapObstacles(map)) placeObstacle(parts, root, map, o, theme);
  const rng = createRandom(MAP.seed + 2);
  const inMap = (): { x: number; z: number } => ({
    x: randomRange(rng, -MAP.halfSize + 3, MAP.halfSize - 3),
    z: randomRange(rng, -MAP.halfSize + 3, MAP.halfSize - 3),
  });
  for (let i = 0; i < theme.bushCount; i++) {
    const { x, z } = inMap();
    if (isOnPath(map, x, z) || nearStructure(map, x, z, 1)) continue;
    const bush = parts.part('bush', theme.bush, root, [0.85, 0.6, 0.85], [x, terrainHeightAt(map, x, z) + 0.35, z]);
    bush.rotation.y = randomRange(rng, 0, 3);
  }
  for (let i = 0; i < theme.tuftCount; i++) {
    const { x, z } = inMap();
    if (isOnPath(map, x, z) || nearStructure(map, x, z, 0.5)) continue;
    const tuft = parts.part('cone', theme.tuft, root, [0.12, 0.35, 0.12], [x, terrainHeightAt(map, x, z) + 0.15, z], { castShadow: false });
    tuft.rotation.set(randomRange(rng, -0.3, 0.3), 0, randomRange(rng, -0.3, 0.3));
  }
}

/** Faint walls and posts at the map edge. The walls fade in when the player gets close. */
/** The castle's moat: shallow water all round, a wooden bridge to the gate, and an arch over the gate. */
function createMoat(scene: Scene, parts: PartFactory, root: TransformNode): void {
  const { centerX: cx, moatInner: inner, moatOuter: outer, bridgeHalf, west } = CASTLE;
  const water = new StandardMaterial('water', scene);
  water.diffuseColor = Color3.FromHexString(COLORS.water);
  water.specularColor = new Color3(0.5, 0.5, 0.5);
  water.specularPower = 64;
  water.alpha = 0.82;
  const width = outer - inner;
  const strips: [number, number, number, number][] = [
    [cx, outer - width / 2, outer * 2, width],
    [cx, -(outer - width / 2), outer * 2, width],
    [cx + outer - width / 2, 0, width, inner * 2],
    [cx - outer + width / 2, (inner + bridgeHalf) / 2, width, inner - bridgeHalf],
    [cx - outer + width / 2, -(inner + bridgeHalf) / 2, width, inner - bridgeHalf],
  ];
  for (const [x, z, w, d] of strips) {
    const plane = MeshBuilder.CreateBox('moat', { width: w, height: 0.05, depth: d }, scene);
    plane.position.set(x, WATER.level, z);
    plane.material = water;
    plane.parent = root;
    plane.isPickable = false;
  }
  const bridge = new TransformNode('bridge', scene);
  bridge.parent = root;
  const from = cx - outer - 1;
  const to = cx - inner + 1;
  bridge.position.set((from + to) / 2, 0.05, 0);
  const length = to - from;
  parts.part('box', COLORS.wood, bridge, [length, 0.25, bridgeHalf * 2], [0, 0, 0]);
  for (let x = -length / 2 + 0.6; x < length / 2; x += 1.2) parts.part('box', COLORS.darkWood, bridge, [0.08, 0.27, bridgeHalf * 2], [x, 0.01, 0], { castShadow: false });
  for (const z of [-bridgeHalf, bridgeHalf]) {
    parts.part('box', COLORS.darkWood, bridge, [length, 0.14, 0.14], [0, 0.9, z]);
    for (let x = -length / 2; x <= length / 2 + 0.01; x += length / 4) parts.part('box', COLORS.darkWood, bridge, [0.18, 1, 0.18], [x, 0.45, z]);
  }
  // The arch over the gate, between the gate towers (only to look at: it is far overhead).
  const arch = new TransformNode('gate-arch', scene);
  arch.parent = root;
  arch.position.set(west, terrainHeightAt('castle', west, 0), 0);
  parts.part('box', MAP_THEMES.castle.stone, arch, [CASTLE.wallThickness + 0.4, 2.2, CASTLE.gateHalf * 2 + 1], [0, CASTLE.wallHeight - 0.9, 0]);
  parts.part('box', COLORS.darkWood, arch, [0.2, 1.4, CASTLE.gateHalf * 2], [-CASTLE.wallThickness / 2 - 0.1, CASTLE.wallHeight - 2.5, 0]);
}

function createEdge(scene: Scene, parts: PartFactory, root: TransformNode, map: MapId, material: StandardMaterial): void {
  const half = MAP.halfSize;
  const sides: [number, number, number][] = [
    [0, half, 0],
    [0, -half, Math.PI],
    [half, 0, Math.PI / 2],
    [-half, 0, -Math.PI / 2],
  ];
  for (const [x, z, rot] of sides) {
    const wall = MeshBuilder.CreatePlane('edge-wall', { width: MAP.size, height: EDGE_WALL_HEIGHT }, scene);
    wall.position.set(x, EDGE_WALL_HEIGHT / 2, z);
    wall.rotation.y = rot;
    wall.material = material;
    wall.isPickable = false;
    wall.parent = root;
  }
  for (let s = -half; s <= half; s += EDGE_POST_SPACING) {
    for (const [px, pz] of [[s, half], [s, -half], [half, s], [-half, s]] as const) {
      const y = terrainHeightAt(map, px, pz);
      parts.part('box', COLORS.edgePost, root, [0.26, 3.4, 0.26], [px, y + 1.7, pz]);
    }
  }
}
