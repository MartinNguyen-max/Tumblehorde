import { BODY, MAP } from './config.ts';
import { MAPS, type MapId, type Structure } from './maps.ts';
import { type Vec2, type Vec3 } from './math.ts';
import type { Unit } from './types.ts';
import { bodyRadius } from './units.ts';

export function mapStructures(map: MapId): readonly Structure[] {
  return MAPS[map].structures;
}

/** Structures bucketed by area, so a body only checks the buildings around it. */
const BUCKET_SIZE = 8;
const BUCKETS_PER_SIDE = Math.ceil((MAP.size + BUCKET_SIZE * 4) / BUCKET_SIZE);
const BUCKET_ORIGIN = MAP.halfSize + BUCKET_SIZE * 2;
const buckets = new Map<MapId, Structure[][]>();
const NONE: readonly Structure[] = [];

function bucketIndex(x: number, z: number): number {
  const i = Math.floor((x + BUCKET_ORIGIN) / BUCKET_SIZE);
  const j = Math.floor((z + BUCKET_ORIGIN) / BUCKET_SIZE);
  if (i < 0 || j < 0 || i >= BUCKETS_PER_SIDE || j >= BUCKETS_PER_SIDE) return -1;
  return j * BUCKETS_PER_SIDE + i;
}

function structureBuckets(map: MapId): Structure[][] {
  const cached = buckets.get(map);
  if (cached) return cached;
  const grid: Structure[][] = Array.from({ length: BUCKETS_PER_SIDE * BUCKETS_PER_SIDE }, () => []);
  // Each structure goes into every bucket its bounding circle (plus a horse's width) touches.
  const reach = BODY.horseRadius + PROBE_DISTANCE + PROBE_MARGIN;
  for (const s of mapStructures(map)) {
    const r = boundingRadius(s) + reach;
    for (let x = s.x - r; x <= s.x + r + BUCKET_SIZE; x += BUCKET_SIZE) {
      for (let z = s.z - r; z <= s.z + r + BUCKET_SIZE; z += BUCKET_SIZE) {
        const index = bucketIndex(Math.min(x, s.x + r), Math.min(z, s.z + r));
        const bucket = grid[index];
        if (bucket && !bucket.includes(s)) bucket.push(s);
      }
    }
  }
  buckets.set(map, grid);
  return grid;
}

/** The structures that could touch a body (or a probe ahead of it) at this point. */
export function structuresNear(map: MapId, x: number, z: number): readonly Structure[] {
  return structureBuckets(map)[bucketIndex(x, z)] ?? NONE;
}

/** Point in the structure's own frame (x along its width, z along its depth). */
function toLocal(s: Structure, x: number, z: number): Vec2 {
  const dx = x - s.x;
  const dz = z - s.z;
  const c = Math.cos(s.yaw);
  const n = Math.sin(s.yaw);
  return { x: dx * c - dz * n, z: dx * n + dz * c };
}

function toWorldDir(s: Structure, x: number, z: number): Vec2 {
  const c = Math.cos(s.yaw);
  const n = Math.sin(s.yaw);
  return { x: x * c + z * n, z: -x * n + z * c };
}

/** True if a point is inside the structure's footprint grown by `margin`. */
export function insideStructure(s: Structure, x: number, z: number, margin = 0): boolean {
  const p = toLocal(s, x, z);
  return Math.abs(p.x) < s.width / 2 + margin && Math.abs(p.z) < s.depth / 2 + margin;
}

function boundingRadius(s: Structure): number {
  return Math.hypot(s.width, s.depth) / 2;
}

/** Pushes a body out of every structure it overlaps and stops it moving into the wall. */
export function resolveStructures(unit: Unit, map: MapId): void {
  const radius = bodyRadius(unit);
  for (const s of structuresNear(map, unit.pos.x, unit.pos.z)) {
    if (Math.hypot(unit.pos.x - s.x, unit.pos.z - s.z) > boundingRadius(s) + radius) continue;
    const p = toLocal(s, unit.pos.x, unit.pos.z);
    const hx = s.width / 2 + radius;
    const hz = s.depth / 2 + radius;
    const penX = hx - Math.abs(p.x);
    const penZ = hz - Math.abs(p.z);
    if (penX <= 0 || penZ <= 0) continue;
    const local = penX < penZ ? { x: Math.sign(p.x || 1) * penX, z: 0 } : { x: 0, z: Math.sign(p.z || 1) * penZ };
    const push = toWorldDir(s, local.x, local.z);
    unit.pos.x += push.x;
    unit.pos.z += push.z;
    const len = Math.hypot(push.x, push.z) || 1;
    const nx = push.x / len;
    const nz = push.z / len;
    const into = unit.vel.x * nx + unit.vel.z * nz;
    if (into < 0) {
      unit.vel.x -= nx * into;
      unit.vel.z -= nz * into;
    }
  }
}

const PROBE_DISTANCE = 1.8;
const PROBE_MARGIN = 0.3;

/**
 * Simple wall-following for AI: if the way ahead runs into a structure, walk along it instead
 * (towards whichever end is closer to where we were heading), so soldiers find gates and alleys.
 */
export function steerAroundStructures(unit: Unit, map: MapId): void {
  const len = Math.hypot(unit.intent.moveX, unit.intent.moveZ);
  if (len < 0.05) return;
  const dir = { x: unit.intent.moveX / len, z: unit.intent.moveZ / len };
  // A planned route already goes round the walls: never look past its next waypoint, or a narrow
  // alley's far wall turns a step across it into endless sliding to and fro.
  const waypoint = unit.ai.navPoint;
  const toWaypoint = waypoint ? Math.hypot(waypoint.x - unit.pos.x, waypoint.z - unit.pos.z) : Infinity;
  const probe = Math.min(PROBE_DISTANCE, toWaypoint);
  const probeX = unit.pos.x + dir.x * probe;
  const probeZ = unit.pos.z + dir.z * probe;
  const margin = bodyRadius(unit) + PROBE_MARGIN;
  for (const s of structuresNear(map, unit.pos.x, unit.pos.z)) {
    if (!insideStructure(s, probeX, probeZ, margin)) continue;
    const p = toLocal(s, unit.pos.x, unit.pos.z);
    // Slide along the face we are approaching: along local x if we hit a long side, else local z.
    const alongWidth = Math.abs(p.z) - s.depth / 2 > Math.abs(p.x) - s.width / 2;
    const axis = alongWidth ? toWorldDir(s, 1, 0) : toWorldDir(s, 0, 1);
    const dot = axis.x * dir.x + axis.z * dir.z;
    const sign = dot >= 0 ? 1 : -1;
    unit.intent.moveX = axis.x * sign * len;
    unit.intent.moveZ = axis.z * sign * len;
    return;
  }
}

/** True if a flying point (an arrow) has hit a structure. */
export function hitsStructure(map: MapId, pos: Vec3, ground: number): boolean {
  for (const s of mapStructures(map)) {
    if (pos.y > ground + s.height) continue;
    if (insideStructure(s, pos.x, pos.z)) return true;
  }
  return false;
}

/** Keeps trees and rocks off buildings. */
export function nearStructure(map: MapId, x: number, z: number, margin: number): boolean {
  return mapStructures(map).some((s) => insideStructure(s, x, z, margin));
}

export const STRUCTURE_CLEARANCE = BODY.horseRadius + 2;
