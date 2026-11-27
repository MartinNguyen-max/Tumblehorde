import { AI, DUEL } from './config.ts';
import { dirToYaw, distanceXZ, normalizeXZ, wrapAngle, yawToDir, type Vec2 } from './math.ts';
import { nextRandom } from './random.ts';
import type { EntityId, MatchState, Unit } from './types.ts';
import { areEnemies, bodyRadius, canBeTargeted, canUseShield, getUnit, isMounted, meleeStatsFor, sideArmyId } from './units.ts';

/**
 * Soldiers fighting up close. Who they pick (whoever hurt them, a turned back, someone already
 * fighting a friend, never a pile of ten on one), and how they fight: keeping a sword's length,
 * circling between blows, stepping in to strike, hopping out of the way, countering after a block,
 * bashing a shield-hider with their own shield, and walking round to an enemy's back.
 */

/** Remembers who hurt a unit, so they can pay them back whatever their orders say. */
export function rememberAttacker(state: MatchState, target: Unit, attacker: Unit | null): void {
  if (!attacker || attacker === target) return;
  target.ai.revengeId = attacker.id;
  target.ai.revengeTime = state.time;
}

function hurtByLately(state: MatchState, unit: Unit, enemy: Unit): boolean {
  return enemy.id === unit.ai.revengeId && state.time - unit.ai.revengeTime <= DUEL.revengeMemory;
}

/** Whoever hurt this unit lately, if they are still standing and close. */
export function revengeTarget(state: MatchState, unit: Unit): Unit | null {
  if (state.time - unit.ai.revengeTime > DUEL.revengeMemory) return null;
  const enemy = getUnit(state, unit.ai.revengeId);
  if (!enemy || !canBeTargeted(enemy) || !areEnemies(state, unit, enemy)) return null;
  return distanceXZ(unit.pos, enemy.pos) <= DUEL.selfDefenseRadius ? enemy : null;
}

let countedTick = -1;
let countedState: MatchState | null = null;
const engaged = new Map<EntityId, number>();

/** How many units are going for `enemyId` right now (counted once per step). */
export function engagedCount(state: MatchState, enemyId: EntityId): number {
  if (countedState !== state || countedTick !== state.tick) {
    engaged.clear();
    for (const unit of state.units) {
      if (!unit.alive || unit.ai.targetId === null) continue;
      engaged.set(unit.ai.targetId, (engaged.get(unit.ai.targetId) ?? 0) + 1);
    }
    countedState = state;
    countedTick = state.tick;
  }
  return engaged.get(enemyId) ?? 0;
}

/** The enemy is looking away from `unit`: a free blow at their back. */
export function backTurnedTo(unit: Unit, enemy: Unit): boolean {
  const facing = yawToDir(enemy.yaw);
  const toUnit = normalizeXZ(unit.pos.x - enemy.pos.x, unit.pos.z - enemy.pos.z);
  return facing.x * toUnit.x + facing.z * toUnit.z < DUEL.backTurnedDot;
}

/** The enemy is fighting someone on `unit`'s side, not `unit` itself. */
export function busyWithFriend(state: MatchState, unit: Unit, enemy: Unit): boolean {
  const foe = getUnit(state, enemy.ai.targetId);
  return foe !== null && foe !== unit && foe.alive && sideArmyId(state, foe) === sideArmyId(state, unit);
}

/** Lower is better: distance, minus what makes an enemy worth going for, plus crowding. */
export function targetScore(state: MatchState, unit: Unit, enemy: Unit): number {
  let score = distanceXZ(unit.pos, enemy.pos);
  if (hurtByLately(state, unit, enemy)) score -= DUEL.revengeBonus;
  if (backTurnedTo(unit, enemy)) score -= DUEL.backBonus;
  if (busyWithFriend(state, unit, enemy)) score -= DUEL.busyBonus;
  const others = engagedCount(state, enemy.id) - (unit.ai.targetId === enemy.id ? 1 : 0);
  return score + Math.max(0, others - DUEL.crowdFree) * DUEL.crowdPenalty;
}

/** The best enemy within `radius` of `from` (everyone is visible outside the city). */
export function pickTarget(state: MatchState, unit: Unit, radius: number, from: Vec2 = unit.pos): Unit | null {
  let best: Unit | null = null;
  let bestScore = Infinity;
  const radiusSq = radius * radius;
  for (const other of state.units) {
    if (!canBeTargeted(other) || !areEnemies(state, unit, other)) continue;
    const dx = other.pos.x - from.x;
    const dz = other.pos.z - from.z;
    if (dx * dx + dz * dz > radiusSq) continue;
    const score = targetScore(state, unit, other);
    if (score < bestScore) {
      best = other;
      bestScore = score;
    }
  }
  return best;
}

/** The better of two candidates (either may be missing). */
export function betterTarget(state: MatchState, unit: Unit, a: Unit | null, b: Unit | null): Unit | null {
  if (!a || !b) return a ?? b;
  return targetScore(state, unit, a) <= targetScore(state, unit, b) ? a : b;
}

/** Counts down the per-step timers of a soldier's fighting moves. */
export function tickDuel(state: MatchState, unit: Unit, dt: number): void {
  unit.ai.dodgeTimer = Math.max(0, unit.ai.dodgeTimer - dt);
  unit.ai.circleTimer -= dt;
  if (unit.ai.circleTimer > 0) return;
  unit.ai.circleSign = nextRandom(state.rng) < 0.5 ? -1 : 1;
  unit.ai.circleTimer = DUEL.circleFlipTime * (1 + nextRandom(state.rng));
}

/** A blow is coming: hop away from it (back and to one side), or raise the shield. */
export function defendAgainst(state: MatchState, unit: Unit, threat: Unit, wild: boolean): void {
  const dodge = wild ? DUEL.wildDodgeChance : DUEL.dodgeChance;
  if (canDodge(unit) && nextRandom(state.rng) < dodge) {
    const away = normalizeXZ(unit.pos.x - threat.pos.x, unit.pos.z - threat.pos.z);
    const side = { x: -away.z * unit.ai.circleSign, z: away.x * unit.ai.circleSign };
    const dir = normalizeXZ(away.x + side.x, away.z + side.z);
    unit.ai.dodgeTimer = DUEL.dodgeTime;
    unit.ai.dodgeX = dir.x;
    unit.ai.dodgeZ = dir.z;
    return;
  }
  if (canUseShield(unit) && nextRandom(state.rng) < AI.shieldReactChance) unit.ai.shieldTimer = AI.shieldMinHold;
}

function canDodge(unit: Unit): boolean {
  return unit.faction !== 'zombie' && unit.onGround && !isMounted(unit) && unit.action === 'none' && unit.stunTimer <= 0;
}

/** Decides at a think whether the next blow at `target` is a shield bash: worth it against a raised shield. */
export function planBash(state: MatchState, unit: Unit, target: Unit | null): void {
  unit.ai.bashNext =
    target !== null && target.shieldUp && (unit.weapon === 'sword' || unit.weapon === 'axe') && canUseShield(unit) && !isMounted(unit) && nextRandom(state.rng) < DUEL.bashChance;
}

function setMove(unit: Unit, x: number, z: number, amount: number): void {
  const dir = normalizeXZ(x, z);
  unit.intent.moveX = dir.x * amount;
  unit.intent.moveZ = dir.z * amount;
}

/** How far a blow reaches from this unit's middle to the target's middle. */
export function strikeReach(unit: Unit, target: Unit): number {
  const range = unit.ai.bashNext ? DUEL.bash.range : (meleeStatsFor(unit)?.range ?? 0);
  return range + bodyRadius(target);
}

/**
 * The way round an enemy that is busy with a friend: circle towards its back. Returns +1/-1 for the
 * circling direction, or 0 when already behind it (or when it is fighting you).
 */
export function flankSign(state: MatchState, unit: Unit, enemy: Unit): number {
  if (!busyWithFriend(state, unit, enemy)) return 0;
  const back = yawToDir(enemy.yaw + Math.PI);
  const fromEnemy = normalizeXZ(unit.pos.x - enemy.pos.x, unit.pos.z - enemy.pos.z);
  const offBack = Math.abs(wrapAngle(dirToYaw(fromEnemy.x, fromEnemy.z) - dirToYaw(back.x, back.z)));
  if (offBack < Math.PI - DUEL.flankAngle) return 0;
  const cross = fromEnemy.x * back.z - fromEnemy.z * back.x;
  return cross >= 0 ? -1 : 1;
}

/**
 * Close-in fighting against `target`, already within a few meters. Returns false when the target
 * is still too far: then the caller walks there along the streets.
 */
export function duelIntent(state: MatchState, unit: Unit, target: Unit, wild: boolean): boolean {
  const intent = unit.intent;
  const d = distanceXZ(unit.pos, target.pos);
  const reach = strikeReach(unit, target);
  const toTarget = normalizeXZ(target.pos.x - unit.pos.x, target.pos.z - unit.pos.z);
  intent.faceYaw = dirToYaw(toTarget.x, toTarget.z);
  if (unit.ai.dodgeTimer > 0) {
    setMove(unit, unit.ai.dodgeX, unit.ai.dodgeZ, 1);
    return true;
  }
  if (d > reach * DUEL.closeInReach) return false;
  const flank = flankSign(state, unit, target);
  const sign = flank !== 0 ? flank : circlingSense(unit, target);
  const tangent = { x: -toTarget.z * sign, z: toTarget.x * sign };
  const circle = wild || flank !== 0 ? DUEL.wildCircleSpeed : DUEL.circleSpeed;
  const ready = unit.cooldownTimer <= 0 && unit.action === 'none';
  if (ready && d <= reach && facing(unit, target.pos)) {
    // Step into the blow; on Attack sometimes with a leap.
    intent.attack = true;
    setMove(unit, toTarget.x, toTarget.z, DUEL.lungeSpeed);
    intent.jump = wild && unit.onGround && nextRandom(state.rng) < DUEL.jumpAttackChance;
    return true;
  }
  if (ready && flank === 0) {
    setMove(unit, toTarget.x + tangent.x * DUEL.approachDrift, toTarget.z + tangent.z * DUEL.approachDrift, 1);
    return true;
  }
  // Between blows (or on the way round to its back): circle at a sword's length.
  const radial = d < reach * DUEL.tooClose ? -1 : d > reach * DUEL.idealReach ? DUEL.closeInSpeed : 0;
  setMove(unit, toTarget.x * radial + tangent.x, toTarget.z * radial + tangent.z, circle);
  return true;
}

/**
 * Two soldiers fighting each other circle the same way round, like boxers, instead of cancelling
 * each other out: the one with the lower id decides.
 */
function circlingSense(unit: Unit, target: Unit): number {
  return target.ai.targetId === unit.id && target.id < unit.id ? target.ai.circleSign : unit.ai.circleSign;
}

function facing(unit: Unit, point: Vec2): boolean {
  const wanted = dirToYaw(point.x - unit.pos.x, point.z - unit.pos.z);
  return Math.abs(wrapAngle(wanted - unit.yaw)) < DUEL.facingTolerance;
}
