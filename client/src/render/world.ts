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
  PhysicsShapeMesh,
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
import { COLORS, type HslRange, LIGHTING, MAP_THEMES, type MapTheme } from '../visualConfig.ts';
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
  };
  loadMap(world, 'meadow');
  return world;
}

/** Builds the terrain, scenery and lighting for a map, replacing the previous one. */
export function loadMap(world: World, map: MapId): void {
  if (world.map === map) return;
  world.terrainBody?.shape?.dispose();
  world.terrainBody?.dispose();
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
  createEdge(scene, world.parts, root, map, world.edgeMaterial);
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
    return isOnPath(cx, cz) ? pick(rng, theme.path) : pick(rng, theme.ground);
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
const FENCE_POST_SPACING = 1.6;

/** Houses, walls, towers and ruins. Their collision boxes live in the shared simulation. */
function createStructure(parts: PartFactory, root: TransformNode, map: MapId, s: Structure, theme: MapTheme): void {
  const node = new TransformNode(s.kind, root.getScene());
  node.parent = root;
  node.position.set(s.x, terrainHeightAt(map, s.x, s.z), s.z);
  node.rotation.y = s.yaw;
  const { width: w, depth: d, height: h } = s;
  switch (s.kind) {
    case 'house': {
      parts.part('box', theme.plaster, node, [w, h * 0.62, d], [0, h * 0.31 - 0.2, 0]);
      parts.part('box', theme.stone, node, [w + 0.1, 0.5, d + 0.1], [0, 0.05, 0]);
      const roof = h * 0.45;
      const slope = Math.hypot(d / 2, roof);
      const angle = Math.atan2(roof, d / 2);
      parts.part('box', theme.roof, node, [w + 0.6, 0.22, slope + 0.3], [0, h * 0.62 + roof / 2 - 0.2, d / 4]).rotation.x = angle;
      parts.part('box', theme.roof, node, [w + 0.6, 0.22, slope + 0.3], [0, h * 0.62 + roof / 2 - 0.2, -d / 4]).rotation.x = -angle;
      // Gable ends: a box turned 45° shows a triangle above the eaves; squash it to the roof's height.
      const gable = new TransformNode('gable', node.getScene());
      gable.parent = node;
      gable.position.y = h * 0.62 - 0.2;
      gable.scaling.y = roof / (d / 2);
      parts.part('box', theme.plaster, gable, [w - 0.1, d / Math.SQRT2, d / Math.SQRT2], [0, 0, 0]).rotation.x = Math.PI / 4;
      parts.part('box', COLORS.darkWood, node, [1.1, 2, 0.12], [0, 1, d / 2 + 0.02]);
      for (const side of [-1, 1]) parts.part('box', COLORS.pupil, node, [0.7, 0.7, 0.1], [side * w * 0.3, 1.8, d / 2 + 0.02]);
      break;
    }
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
    if (isOnPath(x, z)) continue;
    const bush = parts.part('bush', theme.bush, root, [0.85, 0.6, 0.85], [x, terrainHeightAt(map, x, z) + 0.35, z]);
    bush.rotation.y = randomRange(rng, 0, 3);
  }
  for (let i = 0; i < theme.tuftCount; i++) {
    const { x, z } = inMap();
    if (isOnPath(x, z)) continue;
    const tuft = parts.part('cone', theme.tuft, root, [0.12, 0.35, 0.12], [x, terrainHeightAt(map, x, z) + 0.15, z], { castShadow: false });
    tuft.rotation.set(randomRange(rng, -0.3, 0.3), 0, randomRange(rng, -0.3, 0.3));
  }
}

/** Faint walls and posts at the map edge. The walls fade in when the player gets close. */
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
