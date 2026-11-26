import { AI, ARCHER, FORMATION, HORSE, NAV, PERCEPTION } from './config.ts';
import { dirToYaw, distanceXZ, normalizeXZ, wrapAngle, yawToDir, type Vec2 } from './math.ts';
import { feastSlots, staggerIntent } from './banquet.ts';
import type { FormationSlot } from './formation.ts';
import { mount, nearestFreeHorse } from './mounts.ts';
import { fogOfWar, lookAround, nearestVisibleEnemy } from './perception.ts';
import { nextRandom } from './random.ts';
import { navigate } from './navigation.ts';
import { formationTargets, orderOf } from './orders.ts';
import type { Army, GroupOrder, Intent, MatchState, Unit, Weapon } from './types.ts';
import { areEnemies, bodyRadius, canBeTargeted, canUseShield, getUnit, isMounted, meleeStatsFor, setWeapon } from './units.ts';

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

/** The next point to walk to on the way to `goal`. Planning is cached and refreshed a few times a second. */
function routeStep(state: MatchState, unit: Unit, goal: Vec2): Vec2 {
  const ai = unit.ai;
  const moved = !ai.navGoal || distanceXZ(ai.navGoal, goal) > NAV.replanGoalShift;
  if (moved || !ai.navPoint || state.time >= ai.navTimer || distanceXZ(unit.pos, ai.navPoint) < NAV.cellSize) {
    ai.navGoal = { x: goal.x, z: goal.z };
    ai.navPoint = navigate(state.settings.map, unit.pos, goal);
    ai.navTimer = state.time + NAV.replanInterval;
  }
  const planned = ai.navPoint;
  // Heading straight for the goal: follow it exactly, even as it moves a little.
  return ai.navGoal && distanceXZ(planned, ai.navGoal) < 1e-6 ? goal : planned;
}

/** Walks towards a point, along the streets when buildings are in the way. */
function walkTowards(state: MatchState, unit: Unit, point: Vec2, amount = 1): void {
  const waypoint = routeStep(state, unit, point);
  setMove(unit.intent, waypoint.x - unit.pos.x, waypoint.z - unit.pos.z, amount);
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

/** The enemy picked at the last think, if still standing and within `radius`. Cheap enough to ask every step. */
function watched(state: MatchState, unit: Unit, radius: number): Unit | null {
  const enemy = getUnit(state, unit.ai.watchId);
  if (!enemy || !canBeTargeted(enemy)) return null;
  return distanceXZ(unit.pos, enemy.pos) <= radius ? enemy : null;
}

/** In the city only what is in sight counts; elsewhere everyone sees everyone. */
function enemyInSight(state: MatchState, unit: Unit, maxDistance: number, from: Vec2 = unit.pos): Unit | null {
  return fogOfWar(state) ? nearestVisibleEnemy(state, unit, maxDistance, from) : nearestEnemy(state, unit, maxDistance, from);
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

/** `seen` is the nearest enemy in sight (looked up once per think); null if there is none. */
function chooseTarget(state: MatchState, unit: Unit, order: GroupOrder, slot: Vec2, seen: Unit | null): Unit | null {
  const isArcher = unit.kind === 'archer';
  const seenWithin = (radius: number): Unit | null => (seen && distanceXZ(unit.pos, seen.pos) <= radius ? seen : null);
  switch (order.order) {
    case 'attack':
      // Cavalry rides around the melee to cut down the archers behind it.
      if (isMounted(unit)) {
        const archer = nearestEnemyArcherWithin(state, unit, AI.riderFlankRadius);
        if (archer) return archer;
      }
      if (fogOfWar(state)) return seen;
      return seen ?? nearestEnemy(state, unit, Infinity);
    case 'follow': {
      const radius = isArcher ? ARCHER.ranged.range : AI.reactionRadius;
      const enemy = seenWithin(radius);
      return enemy && distanceXZ(enemy.pos, slot) < AI.followLeash ? enemy : null;
    }
    case 'hold':
      return isArcher
        ? enemyInSight(state, unit, ARCHER.ranged.range)
        : enemyInSight(state, unit, AI.holdEngageRadius, slot);
  }
}

/** Periodic decision making: pick a target, decide on shields, look for a horse. */
export function thinkSoldier(state: MatchState, unit: Unit, order: GroupOrder, slot: Vec2): void {
  // One look around per think: report it, keep an eye on it, and pick a target from it.
  const seen = fogOfWar(state) ? lookAround(state, unit) : nearestEnemy(state, unit, PERCEPTION.sightRange);
  unit.ai.watchId = seen && distanceXZ(unit.pos, seen.pos) <= AI.watchRadius ? seen.id : null;
  const target = chooseTarget(state, unit, order, slot, seen);
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
    if (nextRandom(state.rng) < AI.shieldReactChance) unit.ai.shieldTimer = AI.shieldMinHold;
    return;
  }
  if (order.order === 'hold' && !target && nearestEnemyArcher(state, unit)) {
    unit.ai.shieldTimer = Math.max(unit.ai.shieldTimer, AI.thinkInterval * 1.5);
  }
}

/** Walks into melee range of the target and swings when lined up. */
export function meleeIntent(state: MatchState, unit: Unit, target: Unit): void {
  const stats = meleeStatsFor(unit);
  if (!stats) return;
  const d = distanceXZ(unit.pos, target.pos);
  const reach = stats.range * AI.meleeApproachFactor + bodyRadius(target);
  faceTowards(unit, target.pos);
  if (d > reach) walkTowards(state, unit, target.pos);
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
  const closest = enemyInSight(state, unit, AI.archerMinDistance) ?? target;
  const closestDistance = distanceXZ(unit.pos, closest.pos);
  const mayRetreat = order.order !== 'hold' && unit.action === 'none';
  const wantsDistance = closestDistance < AI.archerPanicDistance || (closestDistance < AI.archerMinDistance && unit.cooldownTimer > 0);
  if (mayRetreat && wantsDistance) {
    setMove(unit.intent, unit.pos.x - closest.pos.x, unit.pos.z - closest.pos.z);
    return;
  }
  const preferred = ARCHER.ranged.range * AI.archerPreferredRangeFactor;
  if (d > preferred) {
    if (order.order !== 'hold' && unit.action === 'none') walkTowards(state, unit, target.pos);
    return;
  }
  unit.intent.attack = isFacing(unit, target.pos);
}

/** Where a soldier standing in formation looks: holding soldiers keep their side, others watch the nearest enemy. */
function idleFacing(state: MatchState, unit: Unit, slot: FormationSlot, order: GroupOrder): number {
  const enemy = watched(state, unit, AI.lookAtEnemyRadius);
  if (!enemy) return slot.yaw;
  if (order.order === 'hold' && !withinHoldArc(unit, slot, enemy)) return slot.yaw;
  return dirToYaw(enemy.pos.x - unit.pos.x, enemy.pos.z - unit.pos.z);
}

function withinHoldArc(unit: Unit, slot: FormationSlot, enemy: Unit): boolean {
  const toEnemy = dirToYaw(enemy.pos.x - unit.pos.x, enemy.pos.z - unit.pos.z);
  return Math.abs(wrapAngle(toEnemy - slot.yaw)) <= AI.holdFacingArc;
}

/**
 * Walks towards a formation slot, stepping around the army's own commander when they stand in
 * the way (they have right of way, so pushing into them would leave the soldier stuck).
 */
function walkToSlot(state: MatchState, unit: Unit, slot: Vec2, distance: number): void {
  const waypoint = routeStep(state, unit, slot);
  const dir = normalizeXZ(waypoint.x - unit.pos.x, waypoint.z - unit.pos.z);
  const leader = leaderBody(state, unit);
  const amount = Math.min(1, distance / ARRIVE_SLOWDOWN_DISTANCE);
  if (!leader) {
    setMove(unit.intent, dir.x, dir.z, amount);
    return;
  }
  const rel = { x: leader.pos.x - unit.pos.x, z: leader.pos.z - unit.pos.z };
  const ahead = rel.x * dir.x + rel.z * dir.z;
  const right = { x: dir.z, z: -dir.x };
  const side = rel.x * right.x + rel.z * right.z;
  const clearance = bodyRadius(leader) + bodyRadius(unit) + AI.leaderClearance;
  if (ahead <= 0 || ahead > distance || Math.abs(side) > clearance) {
    setMove(unit.intent, dir.x, dir.z, amount);
    return;
  }
  const away = side >= 0 ? -1 : 1;
  setMove(unit.intent, dir.x + right.x * away * AI.leaderSidestep, dir.z + right.z * away * AI.leaderSidestep, amount);
}

/** The body of this unit's own commander (their horse when mounted), if standing. */
function leaderBody(state: MatchState, unit: Unit): Unit | null {
  const commander = getUnit(state, state.armies[unit.armyId]?.commanderId ?? null);
  if (!commander?.alive) return null;
  const horse = getUnit(state, commander.mountId);
  return horse?.alive ? horse : commander;
}

function arriveRadius(order: GroupOrder): number {
  return order.order === 'hold' ? FORMATION.holdArriveRadius : FORMATION.arriveRadius;
}

function moveToSlot(state: MatchState, unit: Unit, slot: FormationSlot, order: GroupOrder): void {
  const d = distanceXZ(unit.pos, slot);
  if (d < arriveRadius(order)) {
    unit.intent.faceYaw = idleFacing(state, unit, slot, order);
    return;
  }
  walkToSlot(state, unit, slot, d);
  unit.intent.faceYaw = isMounted(unit) || d > AI.faceWalkingDistance ? dirToYaw(slot.x - unit.pos.x, slot.z - unit.pos.z) : slot.yaw;
}

function shieldIntent(state: MatchState, unit: Unit): void {
  unit.intent.shield = true;
  const threat = findMeleeThreat(state, unit) ?? watched(state, unit, AI.shieldWallArcherRadius);
  if (threat) faceTowards(unit, threat.pos);
}

/** Per-tick steering for a soldier based on its latest decisions. */
export function soldierIntent(state: MatchState, unit: Unit, order: GroupOrder, slot: FormationSlot): void {
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
      walkTowards(state, unit, horse.pos);
      faceTowards(unit, horse.pos);
      return;
    }
    unit.ai.horseTargetId = null;
  }
  const target = getUnit(state, unit.ai.targetId);
  const validTarget = target && canBeTargeted(target) ? target : null;
  if (unit.kind === 'swordsman' && order.order === 'hold') {
    if (holdLineIntent(state, unit, slot, validTarget)) return;
    // A held line always stands behind locked shields.
    moveToSlot(state, unit, slot, order);
    unit.intent.shield = distanceXZ(unit.pos, slot) < FORMATION.shieldUpDistance;
    return;
  }
  if (unit.ai.shieldTimer > 0 && canUseShield(unit) && !(validTarget && canRiposte(unit, validTarget))) {
    shieldIntent(state, unit);
    if (validTarget) meleeApproachOnly(state, unit, validTarget);
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
  else meleeIntent(state, unit, validTarget);
}

/**
 * Roman shield wall: keep your place with the shield up and thrust the spear over it when an
 * enemy in front of you is in reach. Each soldier minds their own side of the formation, so a
 * ring keeps facing outwards. Returns false when no enemy is near: then they just stand in place.
 */
function holdLineIntent(state: MatchState, unit: Unit, slot: FormationSlot, target: Unit | null): boolean {
  const enemy = target ?? watched(state, unit, AI.shieldWallRadius);
  if (!enemy) return false;
  const stats = meleeStatsFor(unit);
  const toSlot = distanceXZ(unit.pos, slot);
  if (toSlot > FORMATION.holdArriveRadius) walkToSlot(state, unit, slot, toSlot);
  const facingEnemy = withinHoldArc(unit, slot, enemy);
  if (facingEnemy) faceTowards(unit, enemy.pos);
  else unit.intent.faceYaw = slot.yaw;
  const inReach = stats !== null && distanceXZ(unit.pos, enemy.pos) <= stats.range + bodyRadius(enemy);
  // The shield stays up; the spear goes over it.
  unit.intent.shield = true;
  unit.intent.attack = facingEnemy && inReach && unit.cooldownTimer <= 0 && isFacing(unit, enemy.pos);
  return true;
}

/** Behind the shield, strike back the moment the enemy in reach is between blows. */
function canRiposte(unit: Unit, target: Unit): boolean {
  const stats = meleeStatsFor(unit);
  if (!stats || unit.cooldownTimer > 0 || target.action === 'melee') return false;
  return distanceXZ(unit.pos, target.pos) <= stats.range + bodyRadius(target) && isFacing(unit, target.pos);
}

function meleeApproachOnly(state: MatchState, unit: Unit, target: Unit): void {
  const stats = meleeStatsFor(unit);
  if (!stats) return;
  const d = distanceXZ(unit.pos, target.pos);
  if (d > stats.range * AI.meleeApproachFactor + bodyRadius(target)) walkTowards(state, unit, target.pos);
}

/** Feasting: walk to your place in the ring around the commander and drink. */
function runFeast(state: MatchState, army: Army): void {
  const commander = getUnit(state, army.commanderId);
  if (!commander) return;
  const soldiers = army.soldierIds.map((id) => state.units[id]).filter((u): u is Unit => u?.alive === true);
  const slots = feastSlots(commander.pos, soldiers);
  for (const unit of soldiers) {
    resetIntent(unit);
    const slot = slots.get(unit.id);
    if (!slot || unit.stunTimer > 0) continue;
    const d = distanceXZ(unit.pos, slot);
    if (d > FORMATION.arriveRadius) walkToSlot(state, unit, slot, d);
    unit.intent.faceYaw = d > AI.faceWalkingDistance ? dirToYaw(slot.x - unit.pos.x, slot.z - unit.pos.z) : slot.yaw;
  }
}

/** Runs thinking (staggered) and steering for every soldier in the army. */
export function runArmyAi(state: MatchState, army: Army, dt: number): void {
  if (army.banquet === 'feasting') {
    runFeast(state, army);
    return;
  }
  const slots = formationTargets(state, army);
  for (const id of army.soldierIds) {
    const unit = state.units[id];
    if (!unit?.alive) continue;
    const order = orderOf(army, unit);
    const slot = slots.get(id);
    if (!order || !slot) continue;
    const weapon = weaponForOrder(unit, order);
    if (weapon) setWeapon(unit, weapon);
    unit.ai.thinkTimer -= dt;
    unit.ai.shieldTimer -= dt;
    if (unit.ai.thinkTimer <= 0) {
      unit.ai.thinkTimer += AI.thinkInterval;
      if (unit.ai.thinkTimer <= 0) unit.ai.thinkTimer = AI.thinkInterval;
      thinkSoldier(state, unit, order, slot);
    }
    soldierIntent(state, unit, order, slot);
    if (unit.drunk) staggerIntent(unit.intent, unit.id, state.time);
  }
}

/** Swordsmen march and hold with the spear and draw the sword to attack. */
export function weaponForOrder(unit: Unit, order: GroupOrder): Weapon | null {
  if (unit.kind !== 'swordsman') return null;
  return order.order === 'attack' ? 'sword' : 'spear';
}

/** Spreads the first think of each unit so the whole army does not decide on the same tick. */
export function staggerThinking(state: MatchState): void {
  for (const unit of state.units) {
    unit.ai.thinkTimer = ((unit.id * 7) % 10) * (AI.thinkInterval / 10);
  }
}
