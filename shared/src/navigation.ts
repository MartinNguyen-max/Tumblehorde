import { BODY, MAP, NAV } from './config.ts';
import type { MapId } from './maps.ts';
import type { Vec2 } from './math.ts';
import { insideStructure, mapStructures } from './structures.ts';
import { inWater } from './terrain.ts';

/**
 * Navigation for AI soldiers on maps with buildings. The map is a grid of walkable cells;
 * the way to a goal comes from a flow field (distance to the goal from every cell), which
 * many soldiers heading for the same place can share. In the open they just walk straight.
 */

const SIDE = Math.ceil(MAP.size / NAV.cellSize);
const UNREACHABLE = 0xffff;
const STRAIGHT = 2;
const DIAGONAL = 3;

interface NavGrid {
  blocked: Uint8Array;
  /** False when the map has nothing to walk around: everyone walks straight. */
  hasObstacles: boolean;
}

const grids = new Map<MapId, NavGrid>();
const fields = new Map<string, Uint16Array>();
let fieldsBuiltThisTick = 0;

function cellCenter(index: number): Vec2 {
  const i = index % SIDE;
  const j = Math.floor(index / SIDE);
  return { x: -MAP.halfSize + (i + 0.5) * NAV.cellSize, z: -MAP.halfSize + (j + 0.5) * NAV.cellSize };
}

export function cellIndex(x: number, z: number): number {
  const i = Math.floor((x + MAP.halfSize) / NAV.cellSize);
  const j = Math.floor((z + MAP.halfSize) / NAV.cellSize);
  if (i < 0 || j < 0 || i >= SIDE || j >= SIDE) return -1;
  return j * SIDE + i;
}

export function navGrid(map: MapId): NavGrid {
  const cached = grids.get(map);
  if (cached) return cached;
  const blocked = new Uint8Array(SIDE * SIDE);
  const structures = mapStructures(map);
  const margin = BODY.personRadius + NAV.clearance;
  for (let index = 0; index < blocked.length; index++) {
    const c = cellCenter(index);
    const i = index % SIDE;
    const j = Math.floor(index / SIDE);
    const rim = i === 0 || j === 0 || i === SIDE - 1 || j === SIDE - 1;
    // Soldiers do not wade through the moat on purpose: they take the bridge.
    if (rim || inWater(map, c.x, c.z) || structures.some((s) => insideStructure(s, c.x, c.z, margin))) blocked[index] = 1;
  }
  const grid = { blocked, hasObstacles: structures.length > 0 };
  grids.set(map, grid);
  return grid;
}

export function isWalkable(map: MapId, x: number, z: number): boolean {
  const index = cellIndex(x, z);
  return index >= 0 && navGrid(map).blocked[index] === 0;
}

/** True if a soldier can walk the straight line from `a` to `b` without bumping into a building. */
export function clearPath(map: MapId, a: Vec2, b: Vec2): boolean {
  const grid = navGrid(map);
  if (!grid.hasObstacles) return true;
  const length = Math.hypot(b.x - a.x, b.z - a.z);
  const steps = Math.ceil(length / (NAV.cellSize * 0.5));
  for (let k = 1; k <= steps; k++) {
    const t = k / steps;
    const index = cellIndex(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t);
    if (index >= 0 && grid.blocked[index] === 1) return false;
  }
  return true;
}

/** The nearest walkable cell to a point (the point itself if it is free), searching outwards in rings. */
export function nearestWalkable(map: MapId, point: Vec2): Vec2 {
  const grid = navGrid(map);
  const start = cellIndex(point.x, point.z);
  if (start < 0 || grid.blocked[start] === 0) return point;
  const si = start % SIDE;
  const sj = Math.floor(start / SIDE);
  for (let r = 1; r <= NAV.searchRadius; r++) {
    let best: Vec2 | null = null;
    let bestDistance = Infinity;
    for (let dj = -r; dj <= r; dj++) {
      for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        const i = si + di;
        const j = sj + dj;
        if (i < 0 || j < 0 || i >= SIDE || j >= SIDE || grid.blocked[j * SIDE + i] === 1) continue;
        const c = cellCenter(j * SIDE + i);
        const d = Math.hypot(c.x - point.x, c.z - point.z);
        if (d < bestDistance) {
          best = c;
          bestDistance = d;
        }
      }
    }
    if (best) return best;
  }
  return point;
}

const NEIGHBORS: readonly [number, number, number][] = [
  [1, 0, STRAIGHT], [-1, 0, STRAIGHT], [0, 1, STRAIGHT], [0, -1, STRAIGHT],
  [1, 1, DIAGONAL], [1, -1, DIAGONAL], [-1, 1, DIAGONAL], [-1, -1, DIAGONAL],
];

/** Diagonal steps may not cut a corner of a building. */
function canStep(blocked: Uint8Array, i: number, j: number, di: number, dj: number): boolean {
  const ni = i + di;
  const nj = j + dj;
  if (ni < 0 || nj < 0 || ni >= SIDE || nj >= SIDE || blocked[nj * SIDE + ni] === 1) return false;
  if (di !== 0 && dj !== 0) return blocked[j * SIDE + ni] === 0 && blocked[nj * SIDE + i] === 0;
  return true;
}

/** Cell-index step and cost for each of the 8 neighbors, and the two cells a diagonal must not cut through. */
const STEP_OFFSET = Int32Array.from(NEIGHBORS, ([di, dj]) => dj * SIDE + di);
const STEP_COST = Int32Array.from(NEIGHBORS, ([, , cost]) => cost);
const STEP_SIDE_A = Int32Array.from(NEIGHBORS, ([di, dj]) => (di !== 0 && dj !== 0 ? di : 0));
const STEP_SIDE_B = Int32Array.from(NEIGHBORS, ([di, dj]) => (di !== 0 && dj !== 0 ? dj * SIDE : 0));
/** Costs are 2 or 3, so four rotating buckets hold every distance still to be expanded. */
const BUCKET_RING = DIAGONAL + 1;
const ring: number[][] = Array.from({ length: BUCKET_RING }, () => []);

/**
 * Distance (in half-cells) from every cell to the goal cell: Dijkstra with a bucket queue.
 * The grid's outer ring is always blocked, so neighbors never fall off the map.
 */
function buildField(blocked: Uint8Array, goal: number): Uint16Array {
  const dist = new Uint16Array(SIDE * SIDE).fill(UNREACHABLE);
  for (const bucket of ring) bucket.length = 0;
  dist[goal] = 0;
  ring[0]?.push(goal);
  let pending = 1;
  for (let d = 0; pending > 0; d++) {
    const bucket = ring[d % BUCKET_RING] ?? [];
    for (let k = 0; k < bucket.length; k++) {
      const cell: number = bucket[k] ?? 0;
      pending--;
      if (dist[cell] !== d) continue;
      for (let n = 0; n < STEP_OFFSET.length; n++) {
        const next = cell + (STEP_OFFSET[n] ?? 0);
        if (blocked[next] === 1) continue;
        const sideA = STEP_SIDE_A[n] ?? 0;
        // Diagonal steps may not cut a corner of a building.
        if (sideA !== 0 && (blocked[cell + sideA] === 1 || blocked[cell + (STEP_SIDE_B[n] ?? 0)] === 1)) continue;
        const nd = d + (STEP_COST[n] ?? 0);
        if (nd >= (dist[next] ?? 0)) continue;
        dist[next] = nd;
        ring[nd % BUCKET_RING]?.push(next);
        pending++;
      }
    }
    bucket.length = 0;
  }
  return dist;
}

/** Flow fields are expensive, so only a few are built per simulation step; the rest wait. */
export function beginNavigationStep(): void {
  fieldsBuiltThisTick = 0;
}

function fieldTo(map: MapId, goal: number): Uint16Array | null {
  const key = `${map}:${goal}`;
  const cached = fields.get(key);
  if (cached) {
    // Most recently used goes to the back of the line.
    fields.delete(key);
    fields.set(key, cached);
    return cached;
  }
  if (fieldsBuiltThisTick >= NAV.fieldsPerStep) return null;
  fieldsBuiltThisTick++;
  const field = buildField(navGrid(map).blocked, goal);
  fields.set(key, field);
  if (fields.size > NAV.cachedFields) {
    const oldest = fields.keys().next().value;
    if (oldest !== undefined) fields.delete(oldest);
  }
  return field;
}

/**
 * Far goals share flow fields: they snap to a coarse lattice of cells, which is plenty to find
 * the right street. Close to the goal the exact cell is used (or the goal is in plain sight).
 */
function goalCellFor(map: MapId, from: Vec2, to: Vec2): number {
  const far = Math.hypot(to.x - from.x, to.z - from.z) > NAV.coarseGoalDistance;
  let goal = to;
  if (far) {
    const step = NAV.cellSize * NAV.coarseCells;
    goal = { x: (Math.floor((to.x + MAP.halfSize) / step) + 0.5) * step - MAP.halfSize, z: (Math.floor((to.z + MAP.halfSize) / step) + 0.5) * step - MAP.halfSize };
  }
  const free = nearestWalkable(map, goal);
  return cellIndex(free.x, free.z);
}

/**
 * Where to walk next on the way from `from` to `to`: straight there if nothing is in the way,
 * else the furthest visible point down the flow field. Null when no route is ready yet this
 * step (too many fields asked for at once): the caller must not just walk into the wall.
 */
export function navigate(map: MapId, from: Vec2, to: Vec2): Vec2 | null {
  if (clearPath(map, from, to)) return to;
  const goalCell = goalCellFor(map, from, to);
  const startCell = cellIndex(from.x, from.z);
  if (goalCell < 0 || startCell < 0) return null;
  const field = fieldTo(map, goalCell);
  if (!field) return null;
  const blocked = navGrid(map).blocked;
  let cell = startCell;
  let target: Vec2 | null = null;
  for (let step = 0; step < NAV.lookahead; step++) {
    const next = downhill(field, blocked, cell);
    if (next === cell) break;
    const center = cellCenter(next);
    if (step > 0 && !clearPath(map, from, center)) break;
    target = center;
    cell = next;
  }
  return target;
}

const LOCAL_DIRECTIONS = 8;
const LOCAL_MIN_ALIGNMENT = -0.2;

/**
 * Without a route: the open direction (two cells clear) that points most towards the goal,
 * so a soldier at least never walks into a wall while it waits. Null if boxed in.
 */
export function localStep(map: MapId, from: Vec2, to: Vec2): Vec2 | null {
  const toLength = Math.hypot(to.x - from.x, to.z - from.z) || 1;
  let best: Vec2 | null = null;
  let bestAlignment = LOCAL_MIN_ALIGNMENT;
  for (let k = 0; k < LOCAL_DIRECTIONS; k++) {
    const angle = (k / LOCAL_DIRECTIONS) * Math.PI * 2;
    const dx = Math.sin(angle);
    const dz = Math.cos(angle);
    const alignment = (dx * (to.x - from.x) + dz * (to.z - from.z)) / toLength;
    if (alignment <= bestAlignment) continue;
    const ahead = { x: from.x + dx * NAV.cellSize * 2, z: from.z + dz * NAV.cellSize * 2 };
    if (!isWalkable(map, from.x + dx * NAV.cellSize, from.z + dz * NAV.cellSize) || !isWalkable(map, ahead.x, ahead.z)) continue;
    best = ahead;
    bestAlignment = alignment;
  }
  return best;
}

function downhill(field: Uint16Array, blocked: Uint8Array, cell: number): number {
  const i = cell % SIDE;
  const j = Math.floor(cell / SIDE);
  let best = cell;
  let bestDistance = field[cell] ?? UNREACHABLE;
  for (const [di, dj] of NEIGHBORS) {
    if (!canStep(blocked, i, j, di, dj)) continue;
    const next = (j + dj) * SIDE + (i + di);
    const d = field[next] ?? UNREACHABLE;
    if (d < bestDistance) {
      best = next;
      bestDistance = d;
    }
  }
  return best;
}
