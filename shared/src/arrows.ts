import { AI, ARROW, BODY, TERRAIN } from './config.ts';
import { applyHit } from './combat.ts';
import { dirToYaw, normalizeXZ, segmentSegmentDistanceSq, yawToDir, type Vec3 } from './math.ts';
import { randomRange } from './random.ts';
import { terrainHeightAt } from './terrain.ts';
import type { Arrow, MatchState, Unit } from './types.ts';
import { bodyRadius, isHorse, isMounted, rangedStatsFor, teamOf } from './units.ts';

const SHOULDER_HEIGHT = 1.4;
const CHEST_HEIGHT = 1.1;
const ARROW_SOURCE_BACKTRACK = 5;

/**
 * Lowest launch angle that lands an arrow at horizontal distance `dx` and height
 * difference `dy`, or null if the target is out of reach.
 */
export function solveLaunchAngle(dx: number, dy: number, speed: number, gravity: number): number | null {
  if (dx < 1e-3) return dy >= 0 ? Math.PI / 2 : -Math.PI / 2;
  const v2 = speed * speed;
  const discriminant = v2 * v2 - gravity * (gravity * dx * dx + 2 * dy * v2);
  if (discriminant < 0) return null;
  return Math.atan((v2 - Math.sqrt(discriminant)) / (gravity * dx));
}

export function aimPoint(target: Unit): Vec3 {
  return { x: target.pos.x, y: target.pos.y + CHEST_HEIGHT, z: target.pos.z };
}

/** Launch velocity that leads a moving target, with the bot's aiming spread applied. */
export function aimArrow(state: MatchState, shooter: Unit, target: Unit): Vec3 {
  const origin = { x: shooter.pos.x, y: shooter.pos.y + SHOULDER_HEIGHT, z: shooter.pos.z };
  const goal = aimPoint(target);
  let flightTime = 0;
  let pitch = Math.PI / 4;
  let yaw = shooter.yaw;
  for (let i = 0; i <= AI.aimLeadIterations; i++) {
    const px = goal.x + target.vel.x * flightTime;
    const pz = goal.z + target.vel.z * flightTime;
    const dx = Math.hypot(px - origin.x, pz - origin.z);
    yaw = dirToYaw(px - origin.x, pz - origin.z);
    pitch = solveLaunchAngle(dx, goal.y - origin.y, ARROW.speed, ARROW.gravity) ?? Math.PI / 4;
    flightTime = dx / (ARROW.speed * Math.cos(pitch));
  }
  yaw += randomRange(state.rng, -AI.aimYawSpread, AI.aimYawSpread);
  pitch += randomRange(state.rng, -AI.aimPitchSpread, AI.aimPitchSpread);
  return launchVelocity(yaw, pitch);
}

function launchVelocity(yaw: number, pitch: number): Vec3 {
  const dir = yawToDir(yaw);
  const horizontal = Math.cos(pitch) * ARROW.speed;
  return { x: dir.x * horizontal, y: Math.sin(pitch) * ARROW.speed, z: dir.z * horizontal };
}

/** Launch velocity that lands on a point the player aimed at (no spread: players aim themselves). */
export function aimAtPoint(shooter: Unit, point: Vec3): Vec3 {
  const origin = { x: shooter.pos.x, y: shooter.pos.y + SHOULDER_HEIGHT, z: shooter.pos.z };
  const dx = Math.hypot(point.x - origin.x, point.z - origin.z);
  const yaw = dx > 1e-3 ? dirToYaw(point.x - origin.x, point.z - origin.z) : shooter.yaw;
  const pitch = solveLaunchAngle(dx, point.y - origin.y, ARROW.speed, ARROW.gravity) ?? Math.PI / 4;
  return launchVelocity(yaw, pitch);
}

export function fireArrow(state: MatchState, shooter: Unit, target: Unit | null, aim: Vec3 | null = null): Arrow {
  const vel = aim ? aimAtPoint(shooter, aim) : target ? aimArrow(state, shooter, target) : launchVelocity(shooter.yaw, ARROW.blindPitch);
  const forward = yawToDir(dirToYaw(vel.x, vel.z));
  const arrow: Arrow = {
    id: state.nextArrowId++,
    armyId: shooter.armyId,
    shooterId: shooter.id,
    damage: rangedStatsFor(shooter)?.damage ?? 0,
    knockback: rangedStatsFor(shooter)?.knockback ?? { strength: 0, stun: 0 },
    pos: {
      x: shooter.pos.x + forward.x * 0.5,
      y: shooter.pos.y + SHOULDER_HEIGHT,
      z: shooter.pos.z + forward.z * 0.5,
    },
    vel,
    age: 0,
  };
  state.arrows.push(arrow);
  state.events.push({ type: 'arrowFired', arrowId: arrow.id, shooterId: shooter.id });
  return arrow;
}

/** The capsule used for arrow hits, as a segment plus radius. */
export function hitCapsule(unit: Unit): { a: Vec3; b: Vec3; radius: number } {
  const { x, y, z } = unit.pos;
  if (isHorse(unit)) {
    const f = yawToDir(unit.yaw);
    const h = y + 1.35;
    return { a: { x: x - f.x * 0.8, y: h, z: z - f.z * 0.8 }, b: { x: x + f.x * 1.1, y: h + 0.3, z: z + f.z * 1.1 }, radius: 0.55 };
  }
  if (isMounted(unit)) {
    return { a: { x, y: y + 0.1, z }, b: { x, y: y + 1.5, z }, radius: bodyRadius(unit) };
  }
  return { a: { x, y: y + 0.25, z }, b: { x, y: y + BODY.personHeight - 0.2, z }, radius: bodyRadius(unit) };
}

function findArrowVictim(state: MatchState, arrow: Arrow, from: Vec3, to: Vec3): Unit | null {
  const shooterTeam = state.armies[arrow.armyId]?.team ?? -1;
  let best: Unit | null = null;
  let bestDistance = Infinity;
  for (const unit of state.units) {
    if (!unit.alive || unit.invulnerableTimer > 0) continue;
    if (teamOf(state, unit) === shooterTeam) continue;
    const capsule = hitCapsule(unit);
    const reach = capsule.radius + ARROW.radius;
    if (segmentSegmentDistanceSq(from, to, capsule.a, capsule.b) > reach * reach) continue;
    const d = Math.hypot(unit.pos.x - from.x, unit.pos.z - from.z);
    if (d < bestDistance) {
      best = unit;
      bestDistance = d;
    }
  }
  return best;
}

/** Moves all arrows one step and resolves hits. */
export function stepArrows(state: MatchState, dt: number): void {
  const survivors: Arrow[] = [];
  for (const arrow of state.arrows) {
    const from = { ...arrow.pos };
    arrow.vel.y -= ARROW.gravity * dt;
    arrow.pos.x += arrow.vel.x * dt;
    arrow.pos.y += arrow.vel.y * dt;
    arrow.pos.z += arrow.vel.z * dt;
    arrow.age += dt;

    const victim = findArrowVictim(state, arrow, from, arrow.pos);
    if (victim) {
      hitWithArrow(state, arrow, victim);
      continue;
    }
    const ground = terrainHeightAt(state.settings.map, arrow.pos.x, arrow.pos.z);
    if (arrow.pos.y <= ground) {
      const speed = Math.hypot(arrow.vel.x, arrow.vel.y, arrow.vel.z) || 1;
      state.events.push({
        type: 'arrowLanded',
        pos: { x: arrow.pos.x, y: ground, z: arrow.pos.z },
        dir: { x: arrow.vel.x / speed, y: arrow.vel.y / speed, z: arrow.vel.z / speed },
      });
      continue;
    }
    const outside = Math.max(Math.abs(arrow.pos.x), Math.abs(arrow.pos.z)) > TERRAIN.extent;
    if (arrow.age < ARROW.maxLifetime && !outside) survivors.push(arrow);
  }
  state.arrows = survivors;
}

function hitWithArrow(state: MatchState, arrow: Arrow, victim: Unit): void {
  const shooter = state.units[arrow.shooterId] ?? null;
  const pushDir = normalizeXZ(arrow.vel.x, arrow.vel.z);
  // A point back along the flight path, so shields facing the shooter block it.
  const from = { x: arrow.pos.x - pushDir.x * ARROW_SOURCE_BACKTRACK, z: arrow.pos.z - pushDir.z * ARROW_SOURCE_BACKTRACK };
  applyHit(state, victim, { attacker: shooter, armyId: arrow.armyId, from, pushDir }, arrow.damage, arrow.knockback);
}
