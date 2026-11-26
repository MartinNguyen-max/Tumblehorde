import { AI, ARCHER, FORMATION, HORSE } from './config.ts';
import { dirToYaw, distanceXZ, normalizeXZ, wrapAngle, yawToDir, type Vec2 } from './math.ts';
import { mount, nearestFreeHorse } from './mounts.ts';
import { formationTargets, orderOf } from './orders.ts';
import type { Army, GroupOrder, Intent, MatchState, Unit } from './types.ts';
import { areEnemies, bodyRadius, canBeTargeted, canUseShield, getUnit, isMounted, meleeStatsFor } from './units.ts';

/** Facing within this angle of the target is good enough to swing. */
const SWING_FACING_TOLERANCE = 0.45;
/** Archers in melee switch to their knife inside this distance. */
const ARCHER_MELEE_DISTANCE = ARCHER.melee.range + 0.6;
const ARRIVE_SLOWDOWN_DISTANCE = 1.5;

export function nearestEnemy(state: MatchState, unit: Unit, maxDistance: number, from: Vec2 = unit.pos): Unit | null {
  let best: Unit | null = null;
  let bestDistSq = maxDistance * maxDistance;
  for (const other of state.units) {
    if (!canBeTargeted(other) || !areEnemies(state, unit, other)) continue;
    const dx = other.pos.x - from.x;
    const dz = other.pos.z - from.z;
    const d = dx * dx + dz * dz;
    if (d < bestDistSq) {
      best = other;
      bestDistSq = d;
    }
  }
  return best;
}

function setMove(intent: Intent, x: number, z: number, amount = 1): void {
  const dir = normalizeXZ(x, z);
  intent.moveX = dir.x * amount;
  intent.moveZ = dir.z * amount;
}

function resetIntent(unit: Unit): void {
  const intent = unit.intent;
  intent.moveX = 0;
  intent.moveZ = 0;
  intent.jump = false;
  intent.attack = false;
  intent.shield = false;
  intent.faceYaw = unit.yaw;
}

function faceTowards(unit: Unit, point: Vec2): void {
  unit.intent.faceYaw = dirToYaw(point.x - unit.pos.x, point.z - unit.pos.z);
}

function isFacing(unit: Unit, point: Vec2): boolean {
  const wanted = dirToYaw(point.x - unit.pos.x, point.z - unit.pos.z);
  return Math.abs(wrapAngle(wanted - unit.yaw)) < SWING_FACING_TOLERANCE;
}

/** Medium bots: raise the shield against an enemy within reach who is winding up a strike. */
export function findMeleeThreat(state: MatchState, unit: Unit): Unit | null {
  for (const other of state.units) {
    if (!other.alive || other.action !== 'melee' || !areEnemies(state, unit, other)) continue;
    if (distanceXZ(unit.pos, other.pos) > AI.shieldReactRadius + bodyRadius(other)) continue;
    const facing = yawToDir(other.yaw);
    const toMe = normalizeXZ(unit.pos.x - other.pos.x, unit.pos.z - other.pos.z);
    if (facing.x * toMe.x + facing.z * toMe.z > 0.5) return other;
  }
  return null;
}

function nearestEnemyArcher(state: MatchState, unit: Unit): Unit | null {
  let best: Unit | null = null;
  let bestDistance: number = AI.shieldWallArcherRadius;
  for (const other of state.units) {
    if (other.kind !== 'archer' || !other.alive || !areEnemies(state, unit, other)) continue;
    const d = distanceXZ(unit.pos, other.pos);
    if (d < bestDistance) {
      best = other;
      bestDistance = d;
    }
  }
  return best;
}

function nearestEnemyArcherWithin(state: MatchState, unit: Unit, radius: number): Unit | null {
  let best: Unit | null = null;
  let bestDistance = radius;
  for (const other of state.units) {
    if (other.kind !== 'archer' || !canBeTargeted(other) || !areEnemies(state, unit, other)) continue;
    const d = distanceXZ(unit.pos, other.pos);
    if (d < bestDistance) {
      best = other;
      bestDistance = d;
    }
  }
  return best;
}

function chooseTarget(state: MatchState, unit: Unit, order: GroupOrder, slot: Vec2): Unit | null {
  const isArcher = unit.kind === 'archer';
  switch (order.order) {
    case 'attack':
      // Cavalry rides around the melee to cut down the archers behind it.
      if (isMounted(unit)) {
        const archer = nearestEnemyArcherWithin(state, unit, AI.riderFlankRadius);
        if (archer) return archer;
      }
      return nearestEnemy(state, unit, AI.reactionRadius) ?? nearestEnemy(state, unit, Infinity);
    case 'follow': {
      const radius = isArcher ? ARCHER.ranged.range : AI.reactionRadius;
      const enemy = nearestEnemy(state, unit, radius);
      return enemy && distanceXZ(enemy.pos, slot) < AI.followLeash ? enemy : null;
    }
    case 'hold':
      return isArcher
        ? nearestEnemy(state, unit, ARCHER.ranged.range)
        : nearestEnemy(state, unit, AI.holdEngageRadius, slot);
  }
}

/** Periodic decision making: pick a target, decide on shields, look for a horse. */
export function thinkSoldier(state: MatchState, unit: Unit, order: GroupOrder, slot: Vec2): void {
  const target = chooseTarget(state, unit, order, slot);
  unit.ai.targetId = target?.id ?? null;
  updateShieldDecision(state, unit, order, target);
  if (unit.kind === 'rider' && !isMounted(unit)) {
    unit.ai.horseTargetId = nearestFreeHorse(state, unit, AI.remountSearchRadius)?.id ?? null;
  }
}

function updateShieldDecision(state: MatchState, unit: Unit, order: GroupOrder, target: Unit | null): void {
  // Charging cavalry keeps both hands for the lance.
  if (!canUseShield(unit) || isMounted(unit)) return;
  const threat = findMeleeThreat(state, unit);
  if (threat) {
    unit.ai.shieldTimer = AI.shieldMinHold;
    return;
  }
  if (order.order === 'hold' && !target && nearestEnemyArcher(state, unit)) {
    unit.ai.shieldTimer = Math.max(unit.ai.shieldTimer, AI.thinkInterval * 1.5);
  }
}

/** Walks into melee range of the target and swings when lined up. */
export function meleeIntent(unit: Unit, target: Unit): void {
  const stats = meleeStatsFor(unit);
  if (!stats) return;
  const d = distanceXZ(unit.pos, target.pos);
  const reach = stats.range * AI.meleeApproachFactor + bodyRadius(target);
  faceTowards(unit, target.pos);
  if (d > reach) setMove(unit.intent, target.pos.x - unit.pos.x, target.pos.z - unit.pos.z);
  else unit.intent.attack = isFacing(unit, target.pos);
}

function riderChargeIntent(unit: Unit, target: Unit): void {
  const stats = meleeStatsFor(unit);
  if (!stats) return;
  const d = distanceXZ(unit.pos, target.pos);
  const charge = unit.ai.chargePoint;
  if (!charge || distanceXZ(unit.pos, charge) < 2 || d > AI.riderOvershoot * 2) {
    const dir = normalizeXZ(target.pos.x - unit.pos.x, target.pos.z - unit.pos.z);
    unit.ai.chargePoint = {
      x: target.pos.x + dir.x * AI.riderOvershoot,
      z: target.pos.z + dir.z * AI.riderOvershoot,
    };
  }
  const point = unit.ai.chargePoint ?? target.pos;
  setMove(unit.intent, point.x - unit.pos.x, point.z - unit.pos.z);
  faceTowards(unit, target.pos);
  unit.intent.attack = d < stats.range + bodyRadius(target) && isFacing(unit, target.pos);
}

function archerIntent(state: MatchState, unit: Unit, target: Unit, order: GroupOrder): void {
  const d = distanceXZ(unit.pos, target.pos);
  faceTowards(unit, target.pos);
  if (d < ARCHER_MELEE_DISTANCE) {
    unit.intent.attack = isFacing(unit, target.pos);
    return;
  }
  const closest = nearestEnemy(state, unit, AI.archerMinDistance) ?? target;
  const closestDistance = distanceXZ(unit.pos, closest.pos);
  const mayRetreat = order.order !== 'hold' && unit.action === 'none';
  const wantsDistance = closestDistance < AI.archerPanicDistance || (closestDistance < AI.archerMinDistance && unit.cooldownTimer > 0);
  if (mayRetreat && wantsDistance) {
    setMove(unit.intent, unit.pos.x - closest.pos.x, unit.pos.z - closest.pos.z);
    return;
  }
  const preferred = ARCHER.ranged.range * AI.archerPreferredRangeFactor;
  if (d > preferred) {
    if (order.order !== 'hold' && unit.action === 'none') setMove(unit.intent, target.pos.x - unit.pos.x, target.pos.z - unit.pos.z);
    return;
  }
  unit.intent.attack = isFacing(unit, target.pos);
}

function moveToSlot(state: MatchState, unit: Unit, slot: Vec2, order: GroupOrder): void {
  const d = distanceXZ(unit.pos, slot);
  if (d < FORMATION.arriveRadius) {
    // Standing in formation: keep an eye on the nearest enemy, otherwise face the line's way.
    const enemy = nearestEnemy(state, unit, AI.lookAtEnemyRadius);
    unit.intent.faceYaw = enemy ? dirToYaw(enemy.pos.x - unit.pos.x, enemy.pos.z - unit.pos.z) : order.anchorYaw;
    return;
  }
  setMove(unit.intent, slot.x - unit.pos.x, slot.z - unit.pos.z, Math.min(1, d / ARRIVE_SLOWDOWN_DISTANCE));
  unit.intent.faceYaw = isMounted(unit) || d > AI.faceWalkingDistance ? dirToYaw(slot.x - unit.pos.x, slot.z - unit.pos.z) : order.anchorYaw;
}

function shieldIntent(state: MatchState, unit: Unit): void {
  unit.intent.shield = true;
  const threat = findMeleeThreat(state, unit) ?? nearestEnemy(state, unit, AI.shieldWallArcherRadius);
  if (threat) faceTowards(unit, threat.pos);
}

/** Per-tick steering for a soldier based on its latest decisions. */
export function soldierIntent(state: MatchState, unit: Unit, order: GroupOrder, slot: Vec2): void {
  resetIntent(unit);
  if (unit.stunTimer > 0) return;
  if (unit.action === 'shoot') {
    const target = getUnit(state, unit.ai.targetId);
    if (target) faceTowards(unit, target.pos);
    return;
  }
  const horse = getUnit(state, unit.ai.horseTargetId);
  if (horse && !isMounted(unit)) {
    if (distanceXZ(unit.pos, horse.pos) <= HORSE.mountRange && mount(state, unit, horse)) {
      unit.ai.horseTargetId = null;
      return;
    }
    if (horse.alive && horse.riderId === null) {
      setMove(unit.intent, horse.pos.x - unit.pos.x, horse.pos.z - unit.pos.z);
      faceTowards(unit, horse.pos);
      return;
    }
    unit.ai.horseTargetId = null;
  }
  const target = getUnit(state, unit.ai.targetId);
  const validTarget = target && canBeTargeted(target) ? target : null;
  if (unit.kind === 'swordsman' && order.order === 'hold' && shieldWallIntent(state, unit, slot, validTarget)) return;
  if (unit.ai.shieldTimer > 0 && canUseShield(unit)) {
    shieldIntent(state, unit);
    if (validTarget) meleeApproachOnly(unit, validTarget);
    else moveToSlot(state, unit, slot, order);
    unit.intent.attack = false;
    return;
  }
  if (!validTarget) {
    moveToSlot(state, unit, slot, order);
    return;
  }
  if (unit.kind === 'archer') archerIntent(state, unit, validTarget, order);
  else if (isMounted(unit)) riderChargeIntent(unit, validTarget);
  else meleeIntent(unit, validTarget);
}

/**
 * Roman shield wall: keep your place in the line with the shield up towards the enemy,
 * and only lower it for a quick stab when someone is in reach. Returns false when no
 * enemy is near, so the soldier just stands in formation.
 */
function shieldWallIntent(state: MatchState, unit: Unit, slot: Vec2, target: Unit | null): boolean {
  const enemy = target ?? nearestEnemy(state, unit, AI.shieldWallRadius);
  if (!enemy) return false;
  const stats = meleeStatsFor(unit);
  const d = distanceXZ(unit.pos, enemy.pos);
  const inReach = stats !== null && d <= stats.range + bodyRadius(enemy);
  if (distanceXZ(unit.pos, slot) > FORMATION.arriveRadius) {
    setMove(unit.intent, slot.x - unit.pos.x, slot.z - unit.pos.z, Math.min(1, distanceXZ(unit.pos, slot) / ARRIVE_SLOWDOWN_DISTANCE));
  }
  faceTowards(unit, enemy.pos);
  if (inReach && unit.cooldownTimer <= 0 && isFacing(unit, enemy.pos)) unit.intent.attack = true;
  else unit.intent.shield = true;
  return true;
}

function meleeApproachOnly(unit: Unit, target: Unit): void {
  const stats = meleeStatsFor(unit);
  if (!stats) return;
  const d = distanceXZ(unit.pos, target.pos);
  if (d > stats.range * AI.meleeApproachFactor + bodyRadius(target)) {
    setMove(unit.intent, target.pos.x - unit.pos.x, target.pos.z - unit.pos.z);
  }
}

/** Runs thinking (staggered) and steering for every soldier in the army. */
export function runArmyAi(state: MatchState, army: Army, dt: number): void {
  const slots = formationTargets(state, army);
  for (const id of army.soldierIds) {
    const unit = state.units[id];
    if (!unit?.alive) continue;
    const order = orderOf(army, unit);
    const slot = slots.get(id);
    if (!order || !slot) continue;
    unit.ai.thinkTimer -= dt;
    unit.ai.shieldTimer -= dt;
    if (unit.ai.thinkTimer <= 0) {
      unit.ai.thinkTimer += AI.thinkInterval;
      if (unit.ai.thinkTimer <= 0) unit.ai.thinkTimer = AI.thinkInterval;
      thinkSoldier(state, unit, order, slot);
    }
    soldierIntent(state, unit, order, slot);
  }
}

/** Spreads the first think of each unit so the whole army does not decide on the same tick. */
export function staggerThinking(state: MatchState): void {
  for (const unit of state.units) {
    unit.ai.thinkTimer = ((unit.id * 7) % 10) * (AI.thinkInterval / 10);
  }
}
