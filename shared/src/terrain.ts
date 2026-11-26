import { MAP, OBSTACLES, TERRAIN } from './config.ts';
import { CASTLE, CITY, MAPS, type MapDefinition, type MapId, type ObstacleKind } from './maps.ts';
import { clamp, distanceXZ, type Vec2 } from './math.ts';
import { createRandom, randomRange, type RandomSource } from './random.ts';
import { allPossibleSpawnPoints } from './spawn.ts';
import { nearStructure, STRUCTURE_CLEARANCE } from './structures.ts';

export type { ObstacleKind } from './maps.ts';

/** Number of grid cells along one side of the terrain. */
export const TERRAIN_CELLS = Math.round((TERRAIN.extent * 2) / TERRAIN.cellSize);
export const TERRAIN_VERTS = TERRAIN_CELLS + 1;

function hillHeight(def: MapDefinition, x: number, z: number): number {
  const d = Math.hypot(x, z);
  const blend = clamp((d - def.flatRadius) / TERRAIN.hillBlendDistance, 0, 1);
  const { hills, ripples } = def;
  let h =
    Math.sin(x * hills.frequencyX) * Math.cos(z * hills.frequencyZ) * hills.amplitude +
    Math.sin(x * ripples.frequencyX + z * ripples.frequencyZ) * ripples.amplitude;
  const rimDistance = Math.max(Math.abs(x), Math.abs(z)) - TERRAIN.rimStart;
  const rim = rimDistance > 0 ? rimDistance * TERRAIN.rimSlope : 0;
  return h * blend + rim;
}

const heightGrids = new Map<MapId, Float32Array>();

/** Heights at grid vertices, row-major with z as the row. Shared with the client mesh. */
export function terrainHeightGrid(map: MapId): Float32Array {
  const cached = heightGrids.get(map);
  if (cached) return cached;
  const def = MAPS[map];
  const grid = new Float32Array(TERRAIN_VERTS * TERRAIN_VERTS);
  for (let j = 0; j < TERRAIN_VERTS; j++) {
    for (let i = 0; i < TERRAIN_VERTS; i++) {
      const x = -TERRAIN.extent + i * TERRAIN.cellSize;
      const z = -TERRAIN.extent + j * TERRAIN.cellSize;
      grid[j * TERRAIN_VERTS + i] = hillHeight(def, x, z);
    }
  }
  heightGrids.set(map, grid);
  return grid;
}

function gridHeight(grid: Float32Array, i: number, j: number): number {
  return grid[j * TERRAIN_VERTS + i] ?? 0;
}

/**
 * Exact height of the rendered terrain surface. Each grid cell is split into the
 * triangles (i,j)-(i+1,j)-(i+1,j+1) and (i,j)-(i+1,j+1)-(i,j+1), which the client
 * mesh uses too, so feet always touch the ground.
 */
export function terrainHeightAt(map: MapId, x: number, z: number): number {
  const grid = terrainHeightGrid(map);
  const gx = clamp((x + TERRAIN.extent) / TERRAIN.cellSize, 0, TERRAIN_CELLS - 1e-6);
  const gz = clamp((z + TERRAIN.extent) / TERRAIN.cellSize, 0, TERRAIN_CELLS - 1e-6);
  const i = Math.floor(gx);
  const j = Math.floor(gz);
  const u = gx - i;
  const v = gz - j;
  const h00 = gridHeight(grid, i, j);
  const h10 = gridHeight(grid, i + 1, j);
  const h01 = gridHeight(grid, i, j + 1);
  const h11 = gridHeight(grid, i + 1, j + 1);
  if (u >= v) return h00 + u * (h10 - h00) + v * (h11 - h10);
  return h00 + v * (h01 - h00) + u * (h11 - h01);
}

/**
 * Roads: a winding path across the meadow, a straight road up to the castle gate, and the
 * paved streets of the city.
 */
export function isOnPath(map: MapId, x: number, z: number): boolean {
  switch (MAPS[map].layout) {
    case 'open':
      return Math.abs(z + Math.sin(x * 0.09) * 5) < 6.5;
    case 'siege':
      return x < CASTLE.west + CASTLE.wallThickness && Math.abs(z + Math.sin(x * 0.06) * 3 * Math.min(1, (CASTLE.west - x) / 40)) < 4.5;
    case 'city':
      return CITY.lines.some((line) => Math.abs(x - line) < streetHalf(line) || Math.abs(z - line) < streetHalf(line)) || Math.max(Math.abs(x), Math.abs(z)) < CITY.forumHalf;
  }
}

function streetHalf(line: number): number {
  return (line === 0 ? CITY.avenueWidth : CITY.streetWidth) / 2;
}

export interface Obstacle {
  kind: ObstacleKind;
  x: number;
  z: number;
  scale: number;
  /** Collision radius. Zero for scenery outside the playable map. */
  radius: number;
  /** Deterministic variation for visuals (rotation etc.). */
  variant: number;
}

const OBSTACLE_RADIUS: Record<ObstacleKind, number> = {
  tree: OBSTACLES.treeTrunkRadius,
  rock: OBSTACLES.rockRadius,
  cactus: OBSTACLES.cactusRadius,
};

const layouts = new Map<MapId, Obstacle[]>();

export function mapObstacles(map: MapId): Obstacle[] {
  const cached = layouts.get(map);
  if (cached) return cached;
  const def = MAPS[map];
  const rng = createRandom(MAP.seed + map.length * 7919);
  const spawns = allPossibleSpawnPoints(map);
  const obstacles: Obstacle[] = [];
  for (const group of def.inside) placeInside(map, obstacles, rng, spawns, group);
  placeScenery(obstacles, rng, def);
  layouts.set(map, obstacles);
  return obstacles;
}

function isClearSpot(map: MapId, p: Vec2, spawns: Vec2[], placed: Obstacle[]): boolean {
  if (Math.hypot(p.x, p.z) < OBSTACLES.keepClearOfCenter) return false;
  if (nearStructure(map, p.x, p.z, STRUCTURE_CLEARANCE)) return false;
  if (isOnPath(map, p.x, p.z)) return false;
  if (spawns.some((s) => distanceXZ(s, p) < OBSTACLES.keepClearOfSpawn)) return false;
  return !placed.some((o) => distanceXZ(o, p) < 4);
}

function placeInside(map: MapId, out: Obstacle[], rng: RandomSource, spawns: Vec2[], group: MapDefinition['inside'][number]): void {
  const limit = MAP.halfSize - 6;
  let placed = 0;
  for (let attempt = 0; attempt < group.count * 40 && placed < group.count; attempt++) {
    const p = { x: randomRange(rng, -limit, limit), z: randomRange(rng, -limit, limit) };
    if (!isClearSpot(map, p, spawns, out)) continue;
    const scale = randomRange(rng, group.scaleMin, group.scaleMax);
    out.push({ kind: group.kind, x: p.x, z: p.z, scale, radius: OBSTACLE_RADIUS[group.kind] * scale, variant: rng.seed >>> 0 });
    placed++;
  }
}

function placeScenery(out: Obstacle[], rng: RandomSource, def: MapDefinition): void {
  const inner = MAP.halfSize + 3;
  const outer = TERRAIN.extent - 4;
  let placed = 0;
  for (let attempt = 0; attempt < def.sceneryCount * 40 && placed < def.sceneryCount; attempt++) {
    const p = { x: randomRange(rng, -outer, outer), z: randomRange(rng, -outer, outer) };
    if (Math.max(Math.abs(p.x), Math.abs(p.z)) < inner) continue;
    const kind = def.scenery[placed % def.scenery.length] ?? 'tree';
    out.push({ kind, x: p.x, z: p.z, scale: randomRange(rng, 0.9, 1.6), radius: 0, variant: rng.seed >>> 0 });
    placed++;
  }
}
