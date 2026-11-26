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
} from '@babylonjs/core';
import HavokPhysics from '@babylonjs/havok';
import havokWasmUrl from '@babylonjs/havok/lib/esm/HavokPhysics.wasm?url';
import {
  createRandom,
  isOnPath,
  MAP,
  mapObstacles,
  randomRange,
  SIM,
  TERRAIN,
  TERRAIN_CELLS,
  TERRAIN_VERTS,
  terrainHeightAt,
  terrainHeightGrid,
} from '@tumblehorde/shared';
import { COLORS, LIGHTING, TERRAIN_COLORS } from '../visualConfig.ts';
import { PartFactory } from './parts.ts';

export interface World {
  engine: Engine;
  scene: Scene;
  sun: DirectionalLight;
  shadows: ShadowGenerator;
  parts: PartFactory;
  edgeWalls: Mesh[];
  edgeMaterial: StandardMaterial;
}

const BUSH_COUNT = 70;
const EDGE_POST_SPACING = 9;
const EDGE_WALL_HEIGHT = 9;

export async function createWorld(canvas: HTMLCanvasElement): Promise<World> {
  const engine = new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: true });
  const scene = new Scene(engine);
  scene.clearColor = Color4.FromHexString(`${COLORS.sky}FF`);
  scene.fogMode = Scene.FOGMODE_LINEAR;
  scene.fogColor = Color3.FromHexString(COLORS.fog);
  scene.fogStart = LIGHTING.fogStart;
  scene.fogEnd = LIGHTING.fogEnd;
  scene.skipPointerMovePicking = true;

  const havok = await HavokPhysics({ locateFile: () => havokWasmUrl });
  scene.enablePhysics(new Vector3(0, -SIM.gravity, 0), new HavokPlugin(true, havok));

  const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene);
  hemi.diffuse = Color3.FromHexString(LIGHTING.hemiSky);
  hemi.groundColor = Color3.FromHexString(LIGHTING.hemiGround);
  hemi.specular = Color3.Black();
  hemi.intensity = LIGHTING.hemiIntensity;

  const [dx, dy, dz] = LIGHTING.sunDirection;
  const sun = new DirectionalLight('sun', new Vector3(dx, dy, dz).normalize(), scene);
  sun.diffuse = Color3.FromHexString(LIGHTING.sun);
  sun.specular = Color3.Black();
  sun.intensity = LIGHTING.sunIntensity;
  sun.autoUpdateExtends = false;
  sun.shadowMinZ = 1;
  sun.shadowMaxZ = 160;
  setShadowArea(sun, Vector3.Zero());

  const shadows = new ShadowGenerator(LIGHTING.shadowMapSize, sun);
  shadows.usePercentageCloserFiltering = true;
  shadows.bias = 0.002;
  shadows.normalBias = 0.02;

  const parts = new PartFactory(scene, shadows);
  createTerrain(scene);
  createScenery(parts);
  const edgeMaterial = new StandardMaterial('edge', scene);
  edgeMaterial.diffuseColor = Color3.FromHexString(COLORS.edgeWall);
  edgeMaterial.emissiveColor = Color3.FromHexString(COLORS.edgeWall).scale(0.6);
  edgeMaterial.alpha = 0;
  edgeMaterial.backFaceCulling = false;
  edgeMaterial.disableLighting = true;
  const edgeWalls = createEdge(scene, parts, edgeMaterial);

  return { engine, scene, sun, shadows, parts, edgeWalls, edgeMaterial };
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

/** Flat-shaded terrain whose triangles match shared `terrainHeightAt` exactly. */
function createTerrain(scene: Scene): Mesh {
  const grid = terrainHeightGrid();
  const rng = createRandom(MAP.seed + 1);
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const vertex = (i: number, j: number): [number, number, number] => [
    -TERRAIN.extent + i * TERRAIN.cellSize,
    grid[j * TERRAIN_VERTS + i] ?? 0,
    -TERRAIN.extent + j * TERRAIN.cellSize,
  ];
  const addTriangle = (a: [number, number, number], b: [number, number, number], c: [number, number, number]): void => {
    const cx = (a[0] + b[0] + c[0]) / 3;
    const cz = (a[2] + b[2] + c[2]) / 3;
    const color = isOnPath(cx, cz)
      ? hslColor(TERRAIN_COLORS.sandHue, TERRAIN_COLORS.sandSaturation, randomRange(rng, TERRAIN_COLORS.sandLightMin, TERRAIN_COLORS.sandLightMax))
      : hslColor(TERRAIN_COLORS.grassHue, TERRAIN_COLORS.grassSaturation, randomRange(rng, TERRAIN_COLORS.grassLightMin, TERRAIN_COLORS.grassLightMax));
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
  const mat = new StandardMaterial('terrain-mat', scene);
  mat.specularColor = Color3.Black();
  mesh.material = mat;
  mesh.receiveShadows = true;
  mesh.isPickable = false;
  mesh.freezeWorldMatrix();
  const body = new PhysicsBody(mesh, PhysicsMotionType.STATIC, false, scene);
  body.shape = new PhysicsShapeMesh(mesh, scene);
  return mesh;
}

function createScenery(parts: PartFactory): void {
  const root = new TransformNode('scenery');
  for (const o of mapObstacles()) {
    const node = new TransformNode(o.kind, root.getScene());
    node.parent = root;
    node.position.set(o.x, terrainHeightAt(o.x, o.z), o.z);
    node.rotation.y = (o.variant % 628) / 100;
    node.scaling.setAll(o.scale);
    if (o.kind === 'tree') {
      parts.part('cylinder', COLORS.trunk, node, [0.35, 2.2, 0.35], [0, 1.1, 0]);
      parts.part('cone', COLORS.leaves, node, [2.3, 2.6, 2.3], [0, 2.6, 0]);
      parts.part('cone', COLORS.leaves, node, [1.8, 2.2, 1.8], [0, 4.1, 0]).rotation.y = 0.5;
      parts.part('cone', COLORS.leavesTop, node, [1.25, 1.7, 1.25], [0, 5.4, 0]).rotation.y = 1.1;
    } else {
      const rock = parts.part('rock', COLORS.rock, node, [1, 0.8, 1], [0, 0.45, 0]);
      rock.rotation.set(0.4, 0, 0.3);
    }
  }
  const rng = createRandom(MAP.seed + 2);
  for (let i = 0; i < BUSH_COUNT; i++) {
    const x = randomRange(rng, -MAP.halfSize + 3, MAP.halfSize - 3);
    const z = randomRange(rng, -MAP.halfSize + 3, MAP.halfSize - 3);
    if (isOnPath(x, z)) continue;
    const bush = parts.part('bush', COLORS.bush, root, [0.85, 0.6, 0.85], [x, terrainHeightAt(x, z) + 0.35, z]);
    bush.rotation.y = randomRange(rng, 0, 3);
  }
}

/** Faint walls and posts at the map edge. The walls fade in when the player gets close. */
function createEdge(scene: Scene, parts: PartFactory, material: StandardMaterial): Mesh[] {
  const half = MAP.halfSize;
  const walls: Mesh[] = [];
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
    walls.push(wall);
  }
  for (let s = -half; s <= half; s += EDGE_POST_SPACING) {
    for (const [px, pz] of [[s, half], [s, -half], [half, s], [-half, s]] as const) {
      const y = terrainHeightAt(px, pz);
      parts.part('box', COLORS.edgePost, null, [0.26, 3.4, 0.26], [px, y + 1.7, pz]);
    }
  }
  return walls;
}
