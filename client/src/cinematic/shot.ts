import { type FreeCamera, Vector3 } from '../render/babylon.ts';
import type { Actor } from './actor.ts';

/**
 * A camera shot for one beat: where the camera starts and what it looks at, and optionally where
 * it drifts to by the end of the beat (a slow push in, a pan, a crane up). Targets can be points
 * or actors (their head), so a shot keeps someone framed while they move.
 */

export type Point = readonly [number, number, number];
export type Target = Point | Actor | { actor: Actor; offset: Point };

export interface Shot {
  from: Point;
  at: Target;
  /** Camera position at the end of the beat. */
  to?: Point;
  /** Look target at the end of the beat. */
  atEnd?: Target;
  /** Field of view (radians); a narrow one for close-ups. */
  fov?: number;
  fovEnd?: number;
  /** Handheld wobble or a hit, in meters. */
  shake?: number;
}

/** How far to the side of the listener's head an over-the-shoulder camera stands. */
const SHOULDER_OFFSET = 1.15;

export const FOV = {
  wide: 0.85,
  normal: 0.7,
  close: 0.55,
  extreme: 0.4,
} as const;

function resolve(target: Target): Vector3 {
  if (Array.isArray(target)) {
    const [x, y, z] = target as Point;
    return new Vector3(x, y, z);
  }
  if ('actor' in target) {
    const p = target.actor.headPosition();
    return new Vector3(p.x + target.offset[0], p.y + target.offset[1], p.z + target.offset[2]);
  }
  const p = (target as Actor).headPosition();
  return new Vector3(p.x, p.y, p.z);
}

export interface PortraitOptions {
  /** Radians around the actor from straight ahead; positive goes to their left. */
  angle?: number;
  distance?: number;
  /** Camera height relative to the eyes; a little below looks up at someone strong. */
  rise?: number;
  fov?: number;
  /** Drift this much closer by the end of the beat. */
  push?: number;
}

/**
 * A shot of someone's face from in front of them (call `settle` on the actor first). Close-ups
 * sit a couple of meters away with a long lens, which flatters the box faces.
 */
export function portrait(actor: Actor, options: PortraitOptions = {}): Shot {
  const { angle = 0.45, distance = 2.6, rise = -0.05, fov = FOV.close, push = 0 } = options;
  const head = actor.settle().headPosition();
  const yaw = actor.yaw + angle;
  const at = (d: number): Point => [head.x + Math.sin(yaw) * d, head.y + rise, head.z + Math.cos(yaw) * d];
  const shot: Shot = { from: at(distance), at: { actor, offset: [0, -0.06, 0] }, fov };
  if (push !== 0) shot.to = at(distance - push);
  return shot;
}

/**
 * Over the shoulder of `listener` onto the face of `speaker`: the classic shot for a talk
 * between two people. The camera stands behind the listener, a little to one side (`side`
 * 1 = their right), so the listener's shoulder frames the speaker without hiding them.
 */
export function overShoulder(speaker: Actor, listener: Actor, options: { side?: number; back?: number; fov?: number; push?: number } = {}): Shot {
  const { side = 1, back = 1.3, fov = FOV.close, push = 0 } = options;
  const face = speaker.settle().headPosition();
  const ear = listener.settle().headPosition();
  const dx = face.x - ear.x;
  const dz = face.z - ear.z;
  const d = Math.hypot(dx, dz) || 1;
  const fx = dx / d;
  const fz = dz / d;
  // Right of the listener as they look at the speaker.
  const rx = fz;
  const rz = -fx;
  const spot = (b: number): Point => [ear.x - fx * b + rx * side * SHOULDER_OFFSET, ear.y + 0.15, ear.z - fz * b + rz * side * SHOULDER_OFFSET];
  const shot: Shot = { from: spot(back), at: { actor: speaker, offset: [0, -0.06, 0] }, fov };
  if (push !== 0) shot.to = spot(back - push);
  return shot;
}

/** Smooth start and stop, so moves never jerk. */
function ease(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Places `camera` for `shot` at `progress` (0..1) through the beat; returns the look target. */
export function frameShot(camera: FreeCamera, shot: Shot, progress: number, time: number): Vector3 {
  const t = ease(Math.min(1, Math.max(0, progress)));
  const from = new Vector3(...shot.from);
  const to = shot.to ? new Vector3(...shot.to) : from;
  const position = Vector3.Lerp(from, to, t);
  const lookStart = resolve(shot.at);
  const look = shot.atEnd ? Vector3.Lerp(lookStart, resolve(shot.atEnd), t) : lookStart;
  const shake = shot.shake ?? 0;
  if (shake > 0) {
    position.x += Math.sin(time * 13.1) * shake;
    position.y += Math.sin(time * 17.3 + 1) * shake * 0.7;
  }
  // A camera that breathes a little feels held by a person, not bolted down.
  position.y += Math.sin(time * 0.9) * 0.012;
  camera.position.copyFrom(position);
  camera.setTarget(look);
  const fov = shot.fov ?? FOV.normal;
  camera.fov = shot.fovEnd === undefined ? fov : fov + (shot.fovEnd - fov) * t;
  return look;
}

/** The actor a shot looks at, if it looks at one. */
function subjectOf(target: Target): Actor | null {
  if (Array.isArray(target)) return null;
  return 'actor' in target ? target.actor : (target as Actor);
}

const CLEARANCE = {
  /** How close the line of sight may pass to someone else's head or chest. */
  radius: 0.42,
  /** Swings around the subject tried in turn, in radians. */
  swings: [0, 0.3, -0.3, 0.6, -0.6, 0.9, -0.9, 1.2, -1.2, 1.6, -1.6],
  chestDrop: 0.65,
} as const;

function segmentDistance(a: Vector3, b: Vector3, p: Vector3): number {
  const ab = b.subtract(a);
  const t = Math.max(0, Math.min(1, Vector3.Dot(p.subtract(a), ab) / Math.max(1e-6, ab.lengthSquared())));
  return Vector3.Distance(a.add(ab.scale(t)), p);
}

function rotateAround(point: Point, center: Vector3, angle: number): Point {
  const dx = point[0] - center.x;
  const dz = point[2] - center.z;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [center.x + dx * c + dz * s, point[1], center.z - dx * s + dz * c];
}

/**
 * Swings a shot of someone around them until nobody else stands in the line of sight, so a
 * close-up never ends up staring at the back of another head. Wide shots are left alone.
 */
export function unblock(shot: Shot, actors: Iterable<Actor>): Shot {
  const subject = subjectOf(shot.at);
  if (!subject) return shot;
  const target = resolve(shot.at);
  const blockers: Vector3[] = [];
  for (const actor of actors) {
    if (actor === subject || !actor.root.isEnabled()) continue;
    const h = actor.headPosition();
    blockers.push(new Vector3(h.x, h.y, h.z), new Vector3(h.x, h.y - CLEARANCE.chestDrop, h.z));
  }
  for (const swing of CLEARANCE.swings) {
    const from = rotateAround(shot.from, target, swing);
    const eye = new Vector3(...from);
    if (blockers.every((b) => segmentDistance(eye, target, b) > CLEARANCE.radius)) {
      if (swing === 0) return shot;
      return { ...shot, from, to: shot.to ? rotateAround(shot.to, target, swing) : undefined };
    }
  }
  return shot;
}
