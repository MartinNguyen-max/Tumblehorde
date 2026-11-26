import { BANQUET, COMMANDER, HORSE, KNOCKBACK, MELEE, SHIELD, type KnockbackStats } from './config.ts';
import { normalizeXZ, yawToDir, type Vec2, type Vec3 } from './math.ts';
import { throwRider } from './mounts.ts';
import { nextRandom } from './random.ts';
import type { MatchState, Unit } from './types.ts';
import {
  areEnemies,
  bodyRadius,
  canBeStruck,
  canUseShield,
  getUnit,
  isHorse,
  isMounted,
  isSoldier,
  meleeStatsFor,
} from './units.ts';

export interface HitSource {
  attacker: Unit | null;
  armyId: number;
  /** World position the blow comes from; decides whether a shield blocks it. */
  from: Vec2;
  /** Horizontal push direction (unit length). */
  pushDir: Vec2;
  /** Shields do not help against this, e.g. a commander's horse barging through the line. */
  breaksGuard?: boolean;
  /** Share of the damage that gets through a raised shield anyway (a pilum punches through it). */
  pierce?: number;
  /** The shove still lands on a raised shield, even in a locked wall (a spear thrust). */
  shovesThroughShield?: boolean;
}

/** True if `target` has its shield raised towards the point `from`. */
export function isBlockingFrom(target: Unit, from: Vec2): boolean {
  if (!target.shieldUp || !canUseShield(target) || target.stunTimer > 0) return false;
  const toSource = normalizeXZ(from.x - target.pos.x, from.z - target.pos.z);
  const facing = yawToDir(target.yaw);
  return facing.x * toSource.x + facing.z * toSource.z >= Math.cos(SHIELD.frontHalfAngle);
}

/** A ridden horse may take a blow meant for its rider. */
export function resolveMountedTarget(state: MatchState, target: Unit): Unit {
  if (!isMounted(target)) return target;
  const horse = getUnit(state, target.mountId);
  if (!horse || !horse.alive) return target;
  return nextRandom(state.rng) < HORSE.hitsHorseChance ? horse : target;
}

export function knockbackVector(pushDir: Vec2, strength: number): Vec3 {
  return { x: pushDir.x * strength, y: strength * KNOCKBACK.lift, z: pushDir.z * strength };
}

/** True if a friend right next to `target` also has their shield up: the wall holds. */
function inShieldWall(state: MatchState, target: Unit): boolean {
  for (const other of state.units) {
    if (other === target || !other.alive || !other.shieldUp || areEnemies(state, target, other)) continue;
    const dx = other.pos.x - target.pos.x;
    const dz = other.pos.z - target.pos.z;
    if (dx * dx + dz * dz <= SHIELD.wallNeighborDistance * SHIELD.wallNeighborDistance) return true;
  }
  return false;
}

export function applyHit(
  state: MatchState,
  target: Unit,
  source: HitSource,
  damage: number,
  knock: KnockbackStats,
): void {
  if (!target.alive || target.invulnerableTimer > 0) return;
  const blocked = !source.breaksGuard && isBlockingFrom(target, source.from);
  // A drunk's blow still glances off the shield, but no shield wall holds against it.
  const drunkBlow = source.attacker?.drunk === true;
  const wall = blocked && !drunkBlow && inShieldWall(state, target);
  const blockFraction = wall ? SHIELD.wallBlockFraction : SHIELD.blockFraction;
  const strength = damage * (drunkBlow ? BANQUET.damageDealtFactor : 1) * (target.drunk ? BANQUET.damageTakenFactor : 1);
  const dealt = blocked ? strength * Math.max(1 - blockFraction, source.pierce ?? 0) : strength;
  let factor = source.shovesThroughShield ? 1 : wall ? 0 : blocked ? SHIELD.blockedKnockbackFactor : 1;
  if (drunkBlow) factor *= BANQUET.strikeKnockbackFactor;
  if (target.drunk) factor *= BANQUET.knockbackTakenFactor;
  if (isHorse(target)) factor *= HORSE.knockbackTaken;
  // Riders stay in the saddle; only the horse can throw them.
  if (isMounted(target)) factor = 0;
  const knockback = knockbackVector(source.pushDir, knock.strength * factor);

  target.hp -= dealt;
  target.sinceHurt = 0;
  target.lastHitByArmy = source.armyId;
  state.events.push({
    type: 'hit',
    targetId: target.id,
    attackerId: source.attacker?.id ?? -1,
    damage: dealt,
    blocked,
    knockback,
  });

  if (target.hp <= 0) {
    const boosted = {
      x: knockback.x * KNOCKBACK.deathBoost,
      y: Math.max(knockback.y, 1) * KNOCKBACK.deathBoost,
      z: knockback.z * KNOCKBACK.deathBoost,
    };
    killUnit(state, target, source.armyId, boosted);
    return;
  }
  if (factor > 0) applyKnockback(target, knockback, blocked ? 0 : knock.stun);
}

export function applyKnockback(target: Unit, knockback: Vec3, stun: number): void {
  target.vel.x = knockback.x;
  target.vel.z = knockback.z;
  if (knockback.y > 0) {
    target.vel.y = Math.max(target.vel.y, knockback.y);
    target.onGround = false;
  }
  if (stun > 0) {
    target.stunTimer = Math.max(target.stunTimer, stun);
    target.action = 'none';
    target.actionTimer = 0;
    target.shieldUp = false;
  }
}

export function killUnit(state: MatchState, unit: Unit, killerArmyId: number | null, knockback: Vec3): void {
  if (!unit.alive) return;
  unit.alive = false;
  unit.hp = 0;
  unit.action = 'none';
  unit.shieldUp = false;
  unit.stunTimer = 0;

  if (isHorse(unit)) {
    const rider = getUnit(state, unit.riderId);
    if (rider && rider.alive) throwRider(state, rider, unit);
    unit.riderId = null;
  } else if (unit.mountId !== null) {
    const horse = getUnit(state, unit.mountId);
    if (horse) horse.riderId = null;
    unit.mountId = null;
  }

  const victimArmy = state.armies[unit.armyId];
  if (victimArmy && (isSoldier(unit) || unit.kind === 'commander')) {
    victimArmy.stats.deaths++;
    if (unit.kind === 'commander') {
      victimArmy.stats.commanderDeaths++;
      const slide = COMMANDER.downedSlideFactor;
      unit.vel = { x: knockback.x * slide, y: knockback.y * slide, z: knockback.z * slide };
      unit.onGround = false;
      unit.respawnTimer = victimArmy.forfeited ? 0 : COMMANDER.respawnTime;
    }
    const killerArmy = killerArmyId === null ? null : state.armies[killerArmyId];
    if (killerArmy && killerArmy.id !== victimArmy.id) killerArmy.stats.kills++;
  }
  state.events.push({ type: 'death', unitId: unit.id, killerArmyId, knockback });
}

/** Starts a melee swing if the unit is free to act. Returns true if it started. */
export function startMelee(state: MatchState, unit: Unit): boolean {
  const stats = meleeStatsFor(unit);
  if (!stats || !isFreeToAct(unit)) return false;
  unit.action = 'melee';
  unit.actionTimer = stats.windup;
  unit.cooldownTimer = stats.cooldown * (unit.drunk ? BANQUET.cooldownFactor : 1);
  state.events.push({ type: 'swing', unitId: unit.id });
  return true;
}

export function isFreeToAct(unit: Unit): boolean {
  if (!unit.alive || unit.action !== 'none' || unit.cooldownTimer > 0 || unit.stunTimer > 0) return false;
  return !unit.shieldUp || thrustsOverShield(unit);
}

/** On foot, a spear is thrust over the top of a raised shield: the shield stays up. */
export function thrustsOverShield(unit: Unit): boolean {
  return unit.weapon === 'spear' && !isMounted(unit) && canUseShield(unit);
}

/** Enemies inside the attacker's strike cone, nearest first. */
export function meleeTargets(state: MatchState, attacker: Unit, range: number, arcHalfAngle: number): Unit[] {
  const facing = yawToDir(attacker.yaw);
  const minDot = Math.cos(arcHalfAngle);
  const found: { unit: Unit; distance: number }[] = [];
  for (const other of state.units) {
    if (other === attacker || !canBeStruck(other) || !areEnemies(state, attacker, other)) continue;
    const dx = other.pos.x - attacker.pos.x;
    const dz = other.pos.z - attacker.pos.z;
    const centerDistance = Math.hypot(dx, dz);
    const distance = centerDistance - bodyRadius(other);
    if (distance > range) continue;
    if (Math.abs(other.pos.y - attacker.pos.y) > MELEE.verticalReach) continue;
    if (centerDistance > 1e-3 && (facing.x * dx + facing.z * dz) / centerDistance < minDot) continue;
    found.push({ unit: other, distance });
  }
  found.sort((a, b) => a.distance - b.distance);
  return found.map((f) => f.unit);
}

export function resolveMelee(state: MatchState, attacker: Unit): void {
  const stats = meleeStatsFor(attacker);
  if (!stats) return;
  const targets = meleeTargets(state, attacker, stats.range, stats.arcHalfAngle).slice(0, stats.maxTargets);
  for (const chosen of targets) {
    const target = resolveMountedTarget(state, chosen);
    const pushDir = normalizeXZ(chosen.pos.x - attacker.pos.x, chosen.pos.z - attacker.pos.z);
    applyHit(
      state,
      target,
      {
        attacker,
        armyId: attacker.armyId,
        from: attacker.pos,
        pushDir: pushDir.x || pushDir.z ? pushDir : yawToDir(attacker.yaw),
        shovesThroughShield: stats.shovesThroughShield === true,
      },
      stats.damage,
      stats.knockback,
    );
  }
}
