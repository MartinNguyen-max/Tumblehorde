import { MAP, OBSTACLES, TERRAIN } from './config.ts';
import { clamp, distanceXZ, type Vec2 } from './math.ts';
import { createRandom, randomRange, type RandomSource } from './random.ts';
import { allPossibleSpawnPoints } from './spawn.ts';

/** Number of grid cells along one side of the terrain. */
export const TERRAIN_CELLS = Math.round((TERRAIN.extent * 2) / TERRAIN.cellSize);
export const TERRAIN_VERTS = TERRAIN_CELLS + 1;

function hillHeight(x: number, z: number): number {
  const d = Math.hypot(x, z);
  const blend = clamp((d - TERRAIN.flatRadius) / TERRAIN.hillBlendDistance, 0, 1);
  const hills =
    Math.sin(x * 0.07) * Math.cos(z * 0.06) * TERRAIN.hillAmplitude +
    Math.sin(x * 0.17 + z * 0.13) * TERRAIN.rippleAmplitude;
  const rimDistance = Math.max(Math.abs(x), Math.abs(z)) - TERRAIN.rimStart;
  const rim = rimDistance > 0 ? rimDistance * TERRAIN.rimSlope : 0;
  return hills * blend + rim;
}

let heightGrid: Float32Array | null = null;

/** Heights at grid vertices, row-major with z as the row. Shared with the client mesh. */
export function terrainHeightGrid(): Float32Array {
  if (heightGrid) return heightGrid;
  const grid = new Float32Array(TERRAIN_VERTS * TERRAIN_VERTS);
  for (let j = 0; j < TERRAIN_VERTS; j++) {
    for (let i = 0; i < TERRAIN_VERTS; i++) {
      const x = -TERRAIN.extent + i * TERRAIN.cellSize;
      const z = -TERRAIN.extent + j * TERRAIN.cellSize;
      grid[j * TERRAIN_VERTS + i] = hillHeight(x, z);
    }
  }
  heightGrid = grid;
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
export function terrainHeightAt(x: number, z: number): number {
  const grid = terrainHeightGrid();
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

/** The sandy path that winds across the map along the X axis. */
export function isOnPath(x: number, z: number): boolean {
  return Math.abs(z + Math.sin(x * 0.09) * 5) < 6.5;
}

export type ObstacleKind = 'tree' | 'rock';

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

let layout: Obstacle[] | null = null;

export function mapObstacles(): Obstacle[] {
  if (layout) return layout;
  const rng = createRandom(MAP.seed);
  const spawns = allPossibleSpawnPoints();
  const obstacles: Obstacle[] = [];
  placeInside(obstacles, rng, spawns, 'tree', OBSTACLES.treesInsideMap);
  placeInside(obstacles, rng, spawns, 'rock', OBSTACLES.rocksInsideMap);
  placeScenery(obstacles, rng, OBSTACLES.treesOutsideMap);
  layout = obstacles;
  return obstacles;
}

function isClearSpot(p: Vec2, spawns: Vec2[], placed: Obstacle[]): boolean {
  if (Math.hypot(p.x, p.z) < OBSTACLES.keepClearOfCenter) return false;
  if (isOnPath(p.x, p.z)) return false;
  if (spawns.some((s) => distanceXZ(s, p) < OBSTACLES.keepClearOfSpawn)) return false;
  return !placed.some((o) => distanceXZ(o, p) < 4);
}

function placeInside(
  out: Obstacle[],
  rng: RandomSource,
  spawns: Vec2[],
  kind: ObstacleKind,
  count: number,
): void {
  const limit = MAP.halfSize - 6;
  let placed = 0;
  for (let attempt = 0; attempt < count * 40 && placed < count; attempt++) {
    const p = { x: randomRange(rng, -limit, limit), z: randomRange(rng, -limit, limit) };
    if (!isClearSpot(p, spawns, out)) continue;
    const scale = kind === 'tree' ? randomRange(rng, 0.85, 1.25) : randomRange(rng, 0.6, 1.3);
    const baseRadius = kind === 'tree' ? OBSTACLES.treeTrunkRadius : OBSTACLES.rockRadius;
    out.push({ kind, x: p.x, z: p.z, scale, radius: baseRadius * scale, variant: rng.seed >>> 0 });
    placed++;
  }
}

function placeScenery(out: Obstacle[], rng: RandomSource, count: number): void {
  const inner = MAP.halfSize + 3;
  const outer = TERRAIN.extent - 4;
  let placed = 0;
  for (let attempt = 0; attempt < count * 40 && placed < count; attempt++) {
    const p = { x: randomRange(rng, -outer, outer), z: randomRange(rng, -outer, outer) };
    if (Math.max(Math.abs(p.x), Math.abs(p.z)) < inner) continue;
    out.push({
      kind: 'tree',
      x: p.x,
      z: p.z,
      scale: randomRange(rng, 0.9, 1.5),
      radius: 0,
      variant: rng.seed >>> 0,
    });
    placed++;
  }
}
