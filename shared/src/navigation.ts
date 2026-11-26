import { BODY, MAP, NAV } from './config.ts';
import type { MapId } from './maps.ts';
import type { Vec2 } from './math.ts';
import { insideStructure, mapStructures } from './structures.ts';

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
    if (structures.some((s) => insideStructure(s, c.x, c.z, margin))) blocked[index] = 1;
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

/** Distance (in half-cells) from every cell to the goal cell. A bucket queue keeps it fast. */
function buildField(blocked: Uint8Array, goal: number): Uint16Array {
  const dist = new Uint16Array(SIDE * SIDE).fill(UNREACHABLE);
  dist[goal] = 0;
  const buckets: number[][] = [[goal]];
  for (let d = 0; d < buckets.length; d++) {
    const bucket = buckets[d];
    if (!bucket) continue;
    for (const cell of bucket) {
      if (dist[cell] !== d) continue;
      const i = cell % SIDE;
      const j = Math.floor(cell / SIDE);
      for (const [di, dj, cost] of NEIGHBORS) {
        if (!canStep(blocked, i, j, di, dj)) continue;
        const next = (j + dj) * SIDE + (i + di);
        const nd = d + cost;
        if (nd >= (dist[next] ?? 0)) continue;
        dist[next] = nd;
        (buckets[nd] ??= []).push(next);
      }
    }
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
 * Where to walk next on the way from `from` to `to`: straight there if nothing is in the way,
 * else the furthest visible point down the flow field. Falls back to the goal itself when no
 * field is ready yet (the wall-following steering then helps out).
 */
export function navigate(map: MapId, from: Vec2, to: Vec2): Vec2 {
  if (clearPath(map, from, to)) return to;
  const goal = nearestWalkable(map, to);
  const goalCell = cellIndex(goal.x, goal.z);
  const startCell = cellIndex(from.x, from.z);
  if (goalCell < 0 || startCell < 0) return to;
  const field = fieldTo(map, goalCell);
  if (!field) return to;
  const blocked = navGrid(map).blocked;
  let cell = startCell;
  let target: Vec2 = to;
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
