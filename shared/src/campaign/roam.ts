import { clamp, dirToYaw, type Vec2 } from '../math.ts';
import type { Walkable } from './npc.ts';
import { ROAM } from './config.ts';

/**
 * Walking around a city district outside of battle: the player and the townsfolk move on flat
 * ground between box-shaped buildings, inside the district's bounds.
 */

/** A building's footprint: centre, size and turn (radians). */
export interface Footprint {
  x: number;
  z: number;
  width: number;
  depth: number;
  yaw: number;
}

export interface District {
  /** Half the size of the walkable square around the origin. */
  halfSize: number;
  footprints: readonly Footprint[];
}

export interface Walker {
  pos: Vec2;
  yaw: number;
  /** Current speed (m/s), for the walk animation. */
  speed: number;
}

function toLocal(f: Footprint, x: number, z: number): Vec2 {
  const dx = x - f.x;
  const dz = z - f.z;
  const c = Math.cos(f.yaw);
  const s = Math.sin(f.yaw);
  return { x: dx * c - dz * s, z: dx * s + dz * c };
}

function toWorld(f: Footprint, x: number, z: number): Vec2 {
  const c = Math.cos(f.yaw);
  const s = Math.sin(f.yaw);
  return { x: x * c + z * s, z: -x * s + z * c };
}

/** True if a body of `radius` at (x, z) overlaps the footprint. */
export function overlapsFootprint(f: Footprint, x: number, z: number, radius: number): boolean {
  const p = toLocal(f, x, z);
  return Math.abs(p.x) < f.width / 2 + radius && Math.abs(p.z) < f.depth / 2 + radius;
}

/** Pushes a point out of every footprint and back inside the district. */
export function resolveDistrict(district: District, p: Vec2, radius: number): Vec2 {
  let x = p.x;
  let z = p.z;
  for (const f of district.footprints) {
    const local = toLocal(f, x, z);
    const penX = f.width / 2 + radius - Math.abs(local.x);
    const penZ = f.depth / 2 + radius - Math.abs(local.z);
    if (penX <= 0 || penZ <= 0) continue;
    const push = penX < penZ ? toWorld(f, Math.sign(local.x || 1) * penX, 0) : toWorld(f, 0, Math.sign(local.z || 1) * penZ);
    x += push.x;
    z += push.z;
  }
  const edge = district.halfSize - radius;
  return { x: clamp(x, -edge, edge), z: clamp(z, -edge, edge) };
}

/** Whether an NPC may stand at a spot. */
export function districtWalkable(district: District): Walkable {
  return (p) =>
    Math.abs(p.x) < district.halfSize - ROAM.bodyRadius &&
    Math.abs(p.z) < district.halfSize - ROAM.bodyRadius &&
    district.footprints.every((f) => !overlapsFootprint(f, p.x, p.z, ROAM.bodyRadius));
}

/**
 * Moves the player: `move` is the wished direction in world space (length up to 1), sliding
 * along walls rather than sticking to them.
 */
export function stepWalker(walker: Walker, district: District, move: Vec2, running: boolean, dt: number): void {
  const length = Math.min(1, Math.hypot(move.x, move.z));
  const top = (running ? ROAM.runSpeed : ROAM.walkSpeed) * length;
  walker.speed += (top - walker.speed) * Math.min(1, ROAM.acceleration * dt);
  if (length < 1e-3) {
    if (walker.speed < ROAM.stopSpeed) walker.speed = 0;
    return;
  }
  const dir = { x: move.x / Math.hypot(move.x, move.z), z: move.z / Math.hypot(move.x, move.z) };
  const wanted = { x: walker.pos.x + dir.x * walker.speed * dt, z: walker.pos.z + dir.z * walker.speed * dt };
  walker.pos = resolveDistrict(district, wanted, ROAM.bodyRadius);
  walker.yaw = dirToYaw(dir.x, dir.z);
}
