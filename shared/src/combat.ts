import { BANDIT, BANQUET, COMMANDER, DUEL, HERO, HORSE, KNOCKBACK, MELEE, RALLY, SHIELD, VIKING, type KnockbackStats, type MeleeStats } from './config.ts';
import { rememberAttacker } from './duel.ts';
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
  /** Chance that a blocked blow pulls the shield aside (a bearded axe). */
  hook?: number;
}

/** How much a raised shield stops, alone and in a wall: round Viking shields a little less than a scutum. */
export function shieldBlock(unit: Unit): { alone: number; wall: number } {
  if (unit.faction === 'viking') return { alone: VIKING.blockFraction, wall: VIKING.wallBlockFraction };
  if (unit.faction === 'bandit') return { alone: BANDIT.blockFraction, wall: BANDIT.wallBlockFraction };
  return { alone: SHIELD.blockFraction, wall: SHIELD.wallBlockFraction };
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

/** The army had a rousing speech lately. */
export function courageous(state: MatchState, unit: Unit): boolean {
  return (state.armies[unit.armyId]?.courageTimer ?? 0) > 0;
}

/** Harm done to an army is remembered (and fades), so a bot army turns on whoever hurts it most. */
function rememberThreat(state: MatchState, target: Unit, attackerArmyId: number, damage: number): void {
  const victim = state.armies[target.armyId];
  if (!victim || attackerArmyId === target.armyId || attackerArmyId < 0) return;
  victim.bot.threat[attackerArmyId] = (victim.bot.threat[attackerArmyId] ?? 0) + damage;
}

/** Blocking a blow opens a counter: the defender's next strike is ready almost at once. */
function openCounter(target: Unit): void {
  target.cooldownTimer = Math.min(target.cooldownTimer, DUEL.counterCooldown);
}

const NO_KIT = { damage: 1, block: 1 } as const;

/** Campaign fighters hit harder or block better with better gear; everyone else is unchanged. */
function kitOf(state: MatchState, armyId: number): { damage: number; block: number } {
  return state.settings.armies[armyId]?.kit ?? NO_KIT;
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
  const brave = source.attacker !== null && courageous(state, source.attacker);
  const horde = source.attacker !== null && source.attacker.kind !== 'commander' ? (state.settings.armies[source.attacker.armyId]?.horde?.damage ?? 1) : 1;
  const steady = courageous(state, target);
  const wall = blocked && !drunkBlow && inShieldWall(state, target);
  const block = shieldBlock(target);
  const blockFraction = (wall ? block.wall : block.alone) * kitOf(state, target.armyId).block;
  const strength =
    damage * (drunkBlow ? BANQUET.damageDealtFactor : 1) * (target.drunk ? BANQUET.damageTakenFactor : 1) * (brave ? RALLY.damageFactor : 1) * kitOf(state, source.armyId).damage * horde;
  const dealt = blocked ? strength * Math.max(1 - blockFraction, source.pierce ?? 0) : strength;
  let factor = source.shovesThroughShield ? 1 : wall ? 0 : blocked ? SHIELD.blockedKnockbackFactor : 1;
  if (drunkBlow) factor *= BANQUET.strikeKnockbackFactor;
  if (target.drunk) factor *= BANQUET.knockbackTakenFactor;
  if (steady) factor *= RALLY.knockbackTakenFactor;
  if (isHorse(target)) factor *= HORSE.knockbackTaken;
  // Riders stay in the saddle; only the horse can throw them.
  if (isMounted(target)) factor = 0;
  const knockback = knockbackVector(source.pushDir, knock.strength * factor);

  target.hp -= dealt;
  target.sinceHurt = 0;
  target.lastHitByArmy = source.armyId;
  rememberAttacker(state, target, source.attacker);
  rememberThreat(state, target, source.armyId, dealt);
  if (blocked) openCounter(target);
  const hooked = blocked && !wall && source.hook !== undefined && nextRandom(state.rng) < source.hook;
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
  if (hooked) {
    // The axe's beard catches the rim and drags the shield down: the guard is open for a moment.
    applyKnockback(target, knockback, VIKING.hookStun);
    return;
  }
  if (factor > 0) applyKnockback(target, knockback, blocked ? 0 : knock.stun * (steady ? RALLY.stunTakenFactor : 1));
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

  if (unit.hero !== null) {
    // A hero of the story is only knocked down: they slide where the blow sends them and get up later.
    unit.vel = { x: knockback.x * COMMANDER.downedSlideFactor, y: knockback.y * COMMANDER.downedSlideFactor, z: knockback.z * COMMANDER.downedSlideFactor };
    unit.onGround = false;
    unit.respawnTimer = HERO.getUpTime;
    state.events.push({ type: 'death', unitId: unit.id, killerArmyId, knockback });
    return;
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

/** The blow a unit is about to strike (or is striking): a shield bash, or its weapon. */
export function strikeStats(unit: Unit, bash: boolean): MeleeStats | null {
  return bash ? DUEL.bash : meleeStatsFor(unit);
}

/** Starts a melee swing (or a planned shield bash) if the unit is free to act. Returns true if it started. */
export function startMelee(state: MatchState, unit: Unit): boolean {
  const bash = unit.ai.bashNext && canUseShield(unit) && !isMounted(unit);
  const stats = strikeStats(unit, bash);
  if (!stats || !isFreeToAct(unit)) return false;
  unit.action = 'melee';
  unit.actionTimer = stats.windup;
  unit.cooldownTimer = stats.cooldown * (unit.drunk ? BANQUET.cooldownFactor : 1);
  unit.ai.bashing = bash;
  unit.ai.bashNext = false;
  state.events.push(bash ? { type: 'swing', unitId: unit.id, bash: true } : { type: 'swing', unitId: unit.id });
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
  const bash = attacker.ai.bashing;
  attacker.ai.bashing = false;
  const stats = strikeStats(attacker, bash);
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
        // A shield bash knocks the guard aside rather than glancing off it.
        breaksGuard: bash,
        ...(stats.pierce === undefined ? {} : { pierce: stats.pierce }),
        ...(stats.hookChance === undefined ? {} : { hook: stats.hookChance }),
      },
      stats.damage,
      stats.knockback,
    );
  }
}
