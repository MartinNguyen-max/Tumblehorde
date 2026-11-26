import { findMeleeThreat, meleeIntent, nearestEnemy } from './ai.ts';
import { AI, BOT, COMMANDER, FORMATION, MATCH } from './config.ts';
import { dirToYaw, distanceXZ, normalizeXZ, type Vec2 } from './math.ts';
import { advanceArmy, armyCenter, centroid, holdAt, issueOrder, livingSoldiers, splitArmy } from './orders.ts';
import { armySpawn, gatePost, isDefender } from './spawn.ts';
import type { Army, MatchState, Order, Unit } from './types.ts';
import { canBeTargeted, getUnit, setWeapon } from './units.ts';

/**
 * - form: the first seconds of a battle; hold and let everyone plan.
 * - march: far apart; the army follows its commander as a column, or without one advances in formation.
 * - standoff: in sight; shield wall, archers shoot, wait for the enemy to come.
 * - engage: close, or tired of waiting; swords charge, riders flank, archers keep shooting.
 * - regroup: badly outnumbered; fall back behind the commander.
 */
export type BotStance = 'form' | 'march' | 'standoff' | 'engage' | 'regroup';

/** Swords, archers and riders each get their own orders (see `groupForKind`). */
const BOT_GROUPS = 3;

/**
 * Orders for [swordsmen, archers, riders]. Without a standing commander there is nobody
 * to follow, so marching becomes advancing in formation (see `advanceArmy`) and regrouping
 * becomes holding.
 */
export function stanceOrders(stance: Exclude<BotStance, 'form'>, hasMelee: boolean, leaderless: boolean): Order[] {
  switch (stance) {
    case 'march':
      return leaderless ? ['hold', 'hold', 'hold'] : ['follow', 'follow', 'follow'];
    case 'standoff':
      return ['hold', 'hold', 'hold'];
    case 'engage':
      // Archers keep shooting from behind the line, unless there is no line left to hide behind.
      return ['attack', hasMelee ? 'hold' : 'attack', 'attack'];
    case 'regroup':
      return leaderless ? ['hold', 'hold', 'hold'] : ['follow', 'follow', 'follow'];
  }
}

interface EnemyArmy {
  army: Army;
  center: Vec2;
  soldiers: number;
}

export function nearestEnemyArmy(state: MatchState, army: Army, from: Vec2): EnemyArmy | null {
  let best: EnemyArmy | null = null;
  let bestDistance = Infinity;
  for (const other of state.armies) {
    if (other.eliminated || other.team === army.team) continue;
    const center = armyCenter(state, other);
    if (!center) continue;
    const d = distanceXZ(from, center);
    if (d < bestDistance) {
      best = { army: other, center, soldiers: livingSoldiers(state, other).length };
      bestDistance = d;
    }
  }
  return best;
}

export function chooseStance(state: MatchState, army: Army, distance: number, ownSoldiers: number, enemySoldiers: number): BotStance {
  if (state.time < MATCH.prepareTime) return 'form';
  if (ownSoldiers === 0) return 'engage';
  if (ownSoldiers < enemySoldiers * BOT.regroupRatio && distance < BOT.marchDistance) return 'regroup';
  if (distance > BOT.marchDistance) return 'march';
  if (distance > BOT.engageDistance && army.bot.standoffTimer < BOT.standoffPatience) return 'standoff';
  return 'engage';
}

function applyStance(state: MatchState, army: Army, stance: BotStance, leaderless: boolean, enemyCenter: Vec2): boolean {
  if (stance === 'form') return false;
  if (leaderless && stance === 'march') return advanceArmy(state, army, enemyCenter, BOT.advanceStep);
  let changed = false;
  if (army.groupCount !== BOT_GROUPS) changed = splitArmy(state, army, BOT_GROUPS, leaderless) || changed;
  const hasMelee = livingSoldiers(state, army).some((s) => s.kind !== 'archer');
  stanceOrders(stance, hasMelee, leaderless).forEach((order, group) => {
    if (army.groupOrders[group]?.order !== order) changed = issueOrder(state, army, order, group, leaderless) || changed;
  });
  return changed;
}

/** Where the bot commander wants to stand: leading the march, or just behind the front line. */
function commanderGoal(state: MatchState, army: Army, commander: Unit, stance: BotStance, enemyCenter: Vec2): Vec2 | null {
  const toEnemy = normalizeXZ(enemyCenter.x - commander.pos.x, enemyCenter.z - commander.pos.z);
  switch (stance) {
    case 'form':
      return null;
    case 'march': {
      const d = distanceXZ(commander.pos, enemyCenter);
      const step = Math.max(0, d - BOT.marchStopDistance);
      return { x: commander.pos.x + toEnemy.x * step, z: commander.pos.z + toEnemy.z * step };
    }
    case 'regroup':
      // Fall back to where the army started, then hold there.
      return armySpawn(state.settings, army.id).position;
    case 'standoff':
    case 'engage': {
      // Wait until the troops stop following; otherwise they chase the commander backwards.
      if (army.groupOrders.some((g) => g.order === 'follow')) return null;
      const front = centroid(livingSoldiers(state, army).filter((s) => s.kind === 'swordsman')) ?? armyCenter(state, army) ?? commander.pos;
      return { x: front.x - toEnemy.x * BOT.commanderBehindLine, z: front.z - toEnemy.z * BOT.commanderBehindLine };
    }
  }
}

function botCommanderThink(state: MatchState, army: Army, commander: Unit, stance: BotStance, enemyCenter: Vec2): void {
  commander.ai.targetId = null;
  commander.ai.chargePoint = commanderGoal(state, army, commander, stance, enemyCenter);
  if (findMeleeThreat(state, commander)) commander.ai.shieldTimer = AI.shieldMinHold;

  const alone = livingSoldiers(state, army).length === 0;
  // A commander without an army has nothing to lead: go and fight.
  const enemy = nearestEnemy(state, commander, alone ? Infinity : BOT.selfDefenseDistance);
  if (!enemy) return;
  if (alone) commander.ai.chargePoint = { x: enemy.pos.x, z: enemy.pos.z };
  const d = distanceXZ(enemy.pos, commander.pos);
  const lowHp = commander.hp < commander.maxHp * BOT.retreatHpFraction;
  if (lowHp && d < BOT.retreatTriggerDistance) {
    const away = normalizeXZ(commander.pos.x - enemy.pos.x, commander.pos.z - enemy.pos.z);
    commander.ai.chargePoint = { x: commander.pos.x + away.x * BOT.retreatDistance, z: commander.pos.z + away.z * BOT.retreatDistance };
    return;
  }
  setWeapon(commander, 'sword');
  commander.ai.targetId = enemy.id;
}

function moveTowards(commander: Unit, goal: Vec2): void {
  const d = distanceXZ(commander.pos, goal);
  if (d < FORMATION.arriveRadius * 2) return;
  const dir = normalizeXZ(goal.x - commander.pos.x, goal.z - commander.pos.z);
  commander.intent.moveX = dir.x * Math.min(1, d / 2);
  commander.intent.moveZ = dir.z * Math.min(1, d / 2);
  commander.intent.faceYaw = dirToYaw(dir.x, dir.z);
}

function botCommanderIntent(state: MatchState, commander: Unit): void {
  const intent = commander.intent;
  intent.moveX = 0;
  intent.moveZ = 0;
  intent.attack = false;
  intent.shield = false;
  intent.jump = false;
  intent.aim = null;
  if (commander.stunTimer > 0) return;
  const target = getUnit(state, commander.ai.targetId);
  const validTarget = target && canBeTargeted(target) ? target : null;
  if (commander.ai.shieldTimer > 0 && commander.mountId === null) {
    intent.shield = true;
    const threat = findMeleeThreat(state, commander);
    if (threat) intent.faceYaw = dirToYaw(threat.pos.x - commander.pos.x, threat.pos.z - commander.pos.z);
    return;
  }
  if (validTarget) {
    meleeIntent(state, commander, validTarget);
    return;
  }
  if (commander.ai.chargePoint) moveTowards(commander, commander.ai.chargePoint);
}

/** A castle's defenders hold the gate: the one place the attackers have to come through. */
function defendGate(state: MatchState, army: Army): void {
  const post = gatePost();
  const order = army.groupOrders[0];
  const holding = order?.order === 'hold' && distanceXZ(order.anchor, post.position) < 1;
  if (!holding) holdAt(state, army, post.position, post.yaw);
}

/** Picks a stance and, at most every few seconds, turns it into orders. */
function planArmy(state: MatchState, army: Army, dt: number, leaderless: boolean): { stance: BotStance; enemy: EnemyArmy } | null {
  army.bot.orderTimer -= dt;
  if (isDefender(state.settings, army.id) && state.time >= MATCH.prepareTime) {
    defendGate(state, army);
    return null;
  }
  const commander = getUnit(state, army.commanderId);
  const own = armyCenter(state, army) ?? commander?.pos;
  if (!own) return null;
  const enemy = nearestEnemyArmy(state, army, own);
  if (!enemy) return null;
  const distance = distanceXZ(own, enemy.center);
  const stance = chooseStance(state, army, distance, livingSoldiers(state, army).length, enemy.soldiers);
  army.bot.standoffTimer = stance === 'standoff' ? army.bot.standoffTimer + dt : stance === 'march' ? 0 : army.bot.standoffTimer;
  if (army.bot.orderTimer <= 0 && applyStance(state, army, stance, leaderless, enemy.center)) {
    army.bot.orderTimer = leaderless && stance === 'march' ? BOT.advanceInterval : BOT.orderInterval;
  }
  return { stance, enemy };
}

/** While its commander is down, any army (a player's too) fights on with the bot's judgement. */
export function runLeaderlessArmy(state: MatchState, army: Army, dt: number): void {
  planArmy(state, army, dt, true);
}

/** The bot army: gives orders at most every few seconds; a bot commander stays behind its lines and fights. */
export function runBotArmy(state: MatchState, army: Army, dt: number): void {
  const commander = getUnit(state, army.commanderId);
  if (!commander?.alive) {
    runLeaderlessArmy(state, army, dt);
    return;
  }
  army.bot.thinkTimer -= dt;
  commander.ai.shieldTimer -= dt;
  const plan = planArmy(state, army, dt, false);
  if (!plan) return;
  const { stance, enemy } = plan;
  if (army.bot.thinkTimer <= 0) {
    army.bot.thinkTimer = BOT.thinkInterval;
    botCommanderThink(state, army, commander, stance, enemy.center);
  }
  botCommanderIntent(state, commander);
}
