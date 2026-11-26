import { findMeleeThreat, meleeIntent, nearestEnemy } from './ai.ts';
import { AI, BOT, FORMATION } from './config.ts';
import { dirToYaw, distanceXZ, normalizeXZ, type Vec2 } from './math.ts';
import { armyCenter, issueOrder, livingSoldiers, splitArmy } from './orders.ts';
import type { Army, MatchState, Order, Unit } from './types.ts';
import { canBeTargeted, getUnit } from './units.ts';

interface ArmyPlan {
  groupCount: number;
  orders: Order[];
}

export function nearestEnemyArmyCenter(state: MatchState, army: Army, from: Vec2): Vec2 | null {
  let best: Vec2 | null = null;
  let bestDistance = Infinity;
  for (const other of state.armies) {
    if (other.eliminated || other.team === army.team) continue;
    const center = armyCenter(state, other);
    if (!center) continue;
    const d = distanceXZ(from, center);
    if (d < bestDistance) {
      best = center;
      bestDistance = d;
    }
  }
  return best;
}

/** March in one block while far away; once close, melee charges and archers hold and shoot. */
export function planArmy(state: MatchState, army: Army, distanceToEnemy: number): ArmyPlan {
  if (distanceToEnemy > BOT.engageDistance) return { groupCount: 1, orders: ['follow'] };
  const soldiers = livingSoldiers(state, army);
  const hasArchers = soldiers.some((s) => s.kind === 'archer');
  const hasMelee = soldiers.some((s) => s.kind !== 'archer');
  if (hasArchers && hasMelee) return { groupCount: 2, orders: ['attack', 'hold'] };
  return { groupCount: 1, orders: ['attack'] };
}

function applyPlan(state: MatchState, army: Army, plan: ArmyPlan): boolean {
  let changed = false;
  if (army.groupCount !== plan.groupCount) changed = splitArmy(state, army, plan.groupCount) || changed;
  plan.orders.forEach((order, group) => {
    if (army.groupOrders[group]?.order !== order) changed = issueOrder(state, army, order, group) || changed;
  });
  return changed;
}

function botCommanderThink(state: MatchState, army: Army, commander: Unit, own: Vec2, enemyCenter: Vec2 | null): void {
  const enemy = nearestEnemy(state, commander, AI.reactionRadius);
  const mainOrder = army.groupOrders[0]?.order ?? 'hold';
  const lowHp = commander.hp < commander.maxHp * BOT.retreatHpFraction;
  commander.ai.targetId = null;
  commander.ai.chargePoint = null;
  if (findMeleeThreat(state, commander)) commander.ai.shieldTimer = AI.shieldMinHold;

  if (enemy && lowHp && distanceXZ(enemy.pos, commander.pos) < AI.holdEngageRadius * 1.5) {
    const away = normalizeXZ(commander.pos.x - enemy.pos.x, commander.pos.z - enemy.pos.z);
    commander.ai.chargePoint = { x: commander.pos.x + away.x * 8, z: commander.pos.z + away.z * 8 };
    return;
  }
  if (enemy && (mainOrder === 'attack' || distanceXZ(enemy.pos, commander.pos) < AI.holdEngageRadius * 2)) {
    commander.ai.targetId = enemy.id;
    return;
  }
  if (mainOrder === 'follow' && enemyCenter) {
    const dir = normalizeXZ(enemyCenter.x - commander.pos.x, enemyCenter.z - commander.pos.z);
    const d = distanceXZ(commander.pos, enemyCenter);
    const stop = Math.max(0, d - BOT.marchStopDistance);
    commander.ai.chargePoint = { x: commander.pos.x + dir.x * stop, z: commander.pos.z + dir.z * stop };
    return;
  }
  commander.ai.chargePoint = own;
}

function botCommanderIntent(state: MatchState, commander: Unit): void {
  const intent = commander.intent;
  intent.moveX = 0;
  intent.moveZ = 0;
  intent.attack = false;
  intent.shield = false;
  intent.jump = false;
  if (commander.stunTimer > 0) return;
  const target = getUnit(state, commander.ai.targetId);
  if (commander.ai.shieldTimer > 0) {
    intent.shield = true;
    const threat = findMeleeThreat(state, commander);
    if (threat) intent.faceYaw = dirToYaw(threat.pos.x - commander.pos.x, threat.pos.z - commander.pos.z);
    return;
  }
  if (target && canBeTargeted(target)) {
    meleeIntent(commander, target);
    return;
  }
  const goal = commander.ai.chargePoint;
  if (!goal) return;
  const d = distanceXZ(commander.pos, goal);
  if (d < FORMATION.arriveRadius * 2) return;
  const dir = normalizeXZ(goal.x - commander.pos.x, goal.z - commander.pos.z);
  intent.moveX = dir.x * Math.min(1, d / 2);
  intent.moveZ = dir.z * Math.min(1, d / 2);
  intent.faceYaw = dirToYaw(dir.x, dir.z);
}

/** The bot commander: gives orders at most every few seconds, and fights like a swordsman. */
export function runBotArmy(state: MatchState, army: Army, dt: number): void {
  const commander = state.units[army.commanderId];
  if (!commander) return;
  army.bot.orderTimer -= dt;
  army.bot.thinkTimer -= dt;
  commander.ai.shieldTimer -= dt;
  if (!commander.alive) return;
  const own = armyCenter(state, army) ?? commander.pos;
  const enemyCenter = nearestEnemyArmyCenter(state, army, own);

  if (army.bot.orderTimer <= 0 && state.time >= BOT.firstOrderDelay && enemyCenter) {
    const plan = planArmy(state, army, distanceXZ(own, enemyCenter));
    if (applyPlan(state, army, plan)) army.bot.orderTimer = BOT.orderInterval;
  }
  if (army.bot.thinkTimer <= 0) {
    army.bot.thinkTimer = BOT.thinkInterval;
    botCommanderThink(state, army, commander, own, enemyCenter);
  }
  botCommanderIntent(state, commander);
}
