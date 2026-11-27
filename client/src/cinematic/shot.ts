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
  const head = actor.headPosition();
  const yaw = actor.yaw + angle;
  const at = (d: number): Point => [head.x + Math.sin(yaw) * d, head.y + rise, head.z + Math.cos(yaw) * d];
  const shot: Shot = { from: at(distance), at: { actor, offset: [0, -0.06, 0] }, fov };
  if (push !== 0) shot.to = at(distance - push);
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
