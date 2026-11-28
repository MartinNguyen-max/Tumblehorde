import { findMeleeThreat, meleeIntent, nearestEnemy } from './ai.ts';
import { AI, BOT, COMMANDER, FORMATION, MATCH } from './config.ts';
import { dirToYaw, distanceXZ, normalizeXZ, type Vec2 } from './math.ts';
import { advanceArmy, armyCenter, centroid, holdAt, issueOrder, livingSoldiers, splitArmy } from './orders.ts';
import { fogOfWar } from './perception.ts';
import { armySpawn, gatePost, isDefender } from './spawn.ts';
import type { Army, BotStyle, Formation, MatchState, Order, Unit } from './types.ts';
import { nextRandom } from './random.ts';
import { armiesHostile, canBeTargeted, getUnit, setWeapon } from './units.ts';

/**
 * - form: the first seconds of a battle; hold and let everyone plan.
 * - march: far apart; the army follows its commander as a column, or without one advances in formation.
 * - standoff: in sight; shield wall, archers shoot, wait for the enemy to come.
 * - engage: close, or tired of waiting; swords charge, riders flank, archers keep shooting.
 * - regroup: badly outnumbered; fall back behind the commander.
 */
export type BotStance = 'form' | 'march' | 'standoff' | 'engage' | 'regroup' | 'wait' | 'push' | 'flank';

const BOT_STYLES: readonly BotStyle[] = ['steady', 'charge', 'phalanx', 'patient', 'flank'];

/** Seconds the bots form up before they march: the battle's own, or the usual. */
export function prepareTime(state: MatchState): number {
  return state.settings.prepareTime ?? MATCH.prepareTime;
}

/** A bot army that has not arrived yet stands where it is (a second wave, or an ambush lying in wait). */
function waiting(state: MatchState, army: Army): boolean {
  return state.time < (state.settings.armies[army.id]?.arriveAt ?? 0);
}

export function randomBotStyle(state: MatchState): BotStyle {
  return BOT_STYLES[Math.floor(nextRandom(state.rng) * BOT_STYLES.length)] ?? 'steady';
}

/**
 * The army's style bends the plain stance: chargers skip the standoff, a phalanx pushes forward
 * in formation instead of breaking ranks, the patient wait behind their shields for the enemy.
 */
export function styledStance(state: MatchState, army: Army, stance: BotStance, distance: number): BotStance {
  if (stance === 'form' || stance === 'regroup') return stance;
  switch (army.bot.style) {
    case 'steady':
      return stance;
    case 'charge':
      return stance === 'standoff' ? 'engage' : stance;
    case 'phalanx':
      if (stance === 'march') return 'march';
      return army.bot.contactTimer > BOT.phalanxGrind ? 'engage' : 'push';
    case 'patient': {
      const waitedLongEnough = state.time - prepareTime(state) > BOT.patientMaxWait;
      return distance < BOT.patientEngageDistance || waitedLongEnough ? 'engage' : 'wait';
    }
    case 'flank':
      if (stance === 'march') return 'march';
      return army.bot.flankTimer > BOT.flankTime ? 'engage' : 'flank';
    case 'rush':
      // Raiders do not march in step or wait: they all run at the enemy at once.
      return 'engage';
    case 'ring':
      return 'wait';
  }
}

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
    case 'wait':
    case 'push':
    case 'flank':
      return ['hold', 'hold', 'hold'];
    case 'engage':
      // Archers keep shooting from behind the line, unless there is no line left to hide behind.
      return ['attack', hasMelee ? 'hold' : 'attack', 'attack'];
    case 'regroup':
      return leaderless ? ['hold', 'hold', 'hold'] : ['follow', 'follow', 'follow'];
  }
}

interface EnemyArmy {
  center: Vec2;
  soldiers: number;
}

/**
 * The enemy army to fight: the nearest, but an army that has been hurting this one counts as
 * much closer, so a bot fighting a third army turns round when you hit it from behind.
 */
export function enemyArmyToFight(state: MatchState, army: Army, from: Vec2): EnemyArmy | null {
  let best: EnemyArmy | null = null;
  let bestScore = Infinity;
  for (const other of state.armies) {
    if (other.eliminated || !armiesHostile(state, army.id, other.id)) continue;
    const center = armyCenter(state, other);
    if (!center) continue;
    const score = distanceXZ(from, center) - (army.bot.threat[other.id] ?? 0) * BOT.threatWeight;
    if (score < bestScore) {
      best = { center, soldiers: livingSoldiers(state, other).length };
      bestScore = score;
    }
  }
  return best;
}

/** Harm remembered by every army fades away. */
export function fadeThreats(state: MatchState, dt: number): void {
  const keep = Math.exp(-dt / BOT.threatMemory);
  for (const army of state.armies) {
    for (let i = 0; i < army.bot.threat.length; i++) army.bot.threat[i] = (army.bot.threat[i] ?? 0) * keep;
  }
}

export function nearestEnemyArmy(state: MatchState, army: Army, from: Vec2): EnemyArmy | null {
  let best: EnemyArmy | null = null;
  let bestDistance = Infinity;
  for (const other of state.armies) {
    if (other.eliminated || !armiesHostile(state, army.id, other.id)) continue;
    const center = armyCenter(state, other);
    if (!center) continue;
    const d = distanceXZ(from, center);
    if (d < bestDistance) {
      best = { center, soldiers: livingSoldiers(state, other).length };
      bestDistance = d;
    }
  }
  return best;
}

export function chooseStance(state: MatchState, army: Army, distance: number, ownSoldiers: number, enemySoldiers: number): BotStance {
  if (state.time < prepareTime(state)) return 'form';
  if (ownSoldiers === 0) return 'engage';
  if (ownSoldiers < enemySoldiers * BOT.regroupRatio && distance < BOT.marchDistance) return 'regroup';
  if (distance > BOT.marchDistance) return 'march';
  if (distance > BOT.engageDistance && army.bot.standoffTimer < BOT.standoffPatience) return 'standoff';
  return 'engage';
}

/** A phalanx steps its formation towards the enemy, then stands its ground at spear's reach. */
function pushForward(state: MatchState, army: Army, enemyCenter: Vec2, distance: number): boolean {
  if (distance <= BOT.phalanxContact) return false;
  return advanceArmy(state, army, enemyCenter, Math.min(BOT.phalanxStep, distance - BOT.phalanxContact));
}

/**
 * The shape a bot army holds in: Romans in two lines; Vikings in a shield wall, a boar's head
 * when they mean to charge, or a swarm when they wait for you.
 */
export function botFormation(army: Army): Formation {
  if (army.faction === 'zombie' || army.bot.style === 'rush') return 'swarm';
  if (army.bot.style === 'ring') return 'circle';
  if (army.faction !== 'viking') return FORMATION.defaultFormation;
  if (army.bot.style === 'charge') return 'boar';
  return army.bot.style === 'patient' ? 'swarm' : 'double';
}

/** Flankers hold a pincer: the middle keeps the enemy busy while the wings go round behind it. */
function holdPincer(state: MatchState, army: Army, leaderless: boolean): boolean {
  if (army.formation === 'pincer' && army.groupOrders.every((g) => g.order === 'hold')) return false;
  army.formation = 'pincer';
  return issueOrder(state, army, 'hold', null, leaderless);
}

function applyStance(state: MatchState, army: Army, stance: BotStance, leaderless: boolean, enemyCenter: Vec2, distance: number): boolean {
  if (stance === 'form') return false;
  if (stance === 'flank') return holdPincer(state, army, leaderless);
  // Only flankers hold a pincer; everyone else forms up in their people's usual shape.
  if (army.isBot) army.formation = botFormation(army);
  if (stance === 'push') return pushForward(state, army, enemyCenter, distance);
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
    case 'engage':
    case 'wait':
    case 'push':
    case 'flank': {
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
  intent.crouch = false;
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

/** The enemy is known, the battle is on, and nobody in this army has been hurt for a long while. */
function stalemate(state: MatchState, army: Army): boolean {
  if (state.time < prepareTime(state) + BOT.stalemateTime) return false;
  return livingSoldiers(state, army).every((s) => s.sinceHurt > BOT.stalemateTime);
}

/** Defenders far stronger than everyone outside come out to finish them. */
function strongEnoughToSally(state: MatchState, army: Army): boolean {
  const ours = livingSoldiers(state, army).length;
  const theirs = state.armies
    .filter((other) => !other.eliminated && armiesHostile(state, army.id, other.id))
    .reduce((sum, other) => sum + livingSoldiers(state, other).length, 0);
  return ours >= theirs * BOT.sallyRatio;
}

/** A castle's defenders hold the gate: the one place the attackers have to come through. */
function defendGate(state: MatchState, army: Army): void {
  const post = gatePost();
  const order = army.groupOrders[0];
  const holding = order?.order === 'hold' && distanceXZ(order.anchor, post.position) < 1;
  if (!holding) holdAt(state, army, post.position, post.yaw);
}

/** In the city a bot only knows where the enemy was last seen; it guesses they are as many as itself. */
function knownEnemy(state: MatchState, army: Army, own: Vec2): EnemyArmy | null {
  if (!fogOfWar(state)) return enemyArmyToFight(state, army, own);
  if (!army.intel) return null;
  return { center: { x: army.intel.x, z: army.intel.z }, soldiers: livingSoldiers(state, army).length };
}

/** Nobody in sight: attack blind, which in the city means going from corner to corner looking. */
function searchTheStreets(state: MatchState, army: Army, leaderless: boolean): void {
  if (army.groupOrders.every((g) => g.order === 'attack')) return;
  issueOrder(state, army, 'attack', null, leaderless);
}

/** Picks a stance and, at most every few seconds, turns it into orders. */
function planArmy(state: MatchState, army: Army, dt: number, leaderless: boolean): { stance: BotStance; enemy: EnemyArmy } | null {
  army.bot.orderTimer -= dt;
  if (waiting(state, army)) return null;
  if (isDefender(state.settings, army.id) && state.time >= prepareTime(state) && !strongEnoughToSally(state, army)) {
    defendGate(state, army);
    return null;
  }
  const commander = getUnit(state, army.commanderId);
  const own = armyCenter(state, army) ?? commander?.pos;
  if (!own) return null;
  const enemy = knownEnemy(state, army, own);
  if (!enemy) {
    if (fogOfWar(state) && state.time >= prepareTime(state)) searchTheStreets(state, army, leaderless);
    return null;
  }
  const distance = distanceXZ(own, enemy.center);
  // Horse archers put their bows away and charge when the skirmish is over.
  const archery = state.settings.armies[army.id]?.horseArchers;
  if (archery !== undefined && state.time >= prepareTime(state) + archery) {
    for (const soldier of livingSoldiers(state, army)) if (soldier.weapon === 'bow') setWeapon(soldier, 'sword');
  }
  // The dead never fall back, and neither does a rushing horde (but even they wait for the signal).
  const fearless = army.faction === 'zombie' || army.bot.style === 'rush' || army.bot.style === 'ring';
  const holdsRing = army.bot.style === 'ring' && state.time >= prepareTime(state);
  const beaten = holdsRing ? 'wait' : fearless && state.time >= prepareTime(state) ? 'engage' : chooseStance(state, army, distance, livingSoldiers(state, army).length, enemy.soldiers);
  army.bot.regroupTimer = beaten === 'regroup' ? army.bot.regroupTimer + dt : army.bot.regroupTimer;
  // Nobody falls back forever: after a while it is a last stand.
  const plain = beaten === 'regroup' && army.bot.regroupTimer > BOT.maxRegroup ? 'engage' : beaten;
  // Nobody waits forever either: a stand-off that drags on ends in a charge.
  if (army.isBot && army.bot.style !== 'charge' && army.bot.style !== 'ring' && stalemate(state, army)) army.bot.style = 'charge';
  army.bot.standoffTimer = plain === 'standoff' ? army.bot.standoffTimer + dt : plain === 'march' ? 0 : army.bot.standoffTimer;
  // A beaten army that falls back may come back with a different idea.
  const regrouping = plain === 'regroup';
  if (regrouping && !army.bot.regrouping && army.isBot) army.bot.style = randomBotStyle(state);
  army.bot.regrouping = regrouping;
  const atTheLine = army.bot.style === 'phalanx' && distance <= BOT.phalanxContact + 1;
  army.bot.contactTimer = atTheLine ? army.bot.contactTimer + dt : 0;
  army.bot.flankTimer = army.bot.style === 'flank' && plain !== 'march' ? army.bot.flankTimer + dt : 0;
  const stance = styledStance(state, army, plain, distance);
  if (army.bot.orderTimer <= 0 && applyStance(state, army, stance, leaderless, enemy.center, distance)) {
    const walking = (leaderless && stance === 'march') || stance === 'push';
    army.bot.orderTimer = walking ? BOT.advanceInterval : BOT.orderInterval;
  }
  return { stance, enemy };
}

/** While its commander is down, any army (a player's too) fights on with the bot's judgement. */
export function runLeaderlessArmy(state: MatchState, army: Army, dt: number): void {
  planArmy(state, army, dt, true);
}

/**
 * An ally under the player's command: the same orders and formation as the player's army. On
 * Follow, its commander keeps up with the player; on Attack he goes for the nearest enemy.
 */
function followThePlayer(state: MatchState, army: Army, commander: Unit | null, dt: number): void {
  const leader = state.armies[0];
  const chief = getUnit(state, leader?.commanderId ?? null);
  if (!leader) return;
  army.bot.orderTimer -= dt;
  if (army.bot.orderTimer > 0) return;
  army.bot.orderTimer = BOT.followPlayerInterval;
  const wanted = leader.groupOrders[0]?.order ?? 'hold';
  army.formation = leader.formation;
  const order: Order = !commander && wanted === 'follow' ? 'hold' : wanted;
  for (let group = 0; group < army.groupCount; group++) {
    if (army.groupOrders[group]?.order !== order) issueOrder(state, army, order, group, !commander);
  }
  if (!commander) return;
  if (wanted === 'follow' && chief) {
    const side = army.id % 2 === 0 ? 1 : -1;
    commander.ai.chargePoint = { x: chief.pos.x + side * BOT.followPlayerOffset, z: chief.pos.z - BOT.followPlayerOffset };
  } else if (wanted === 'attack') {
    const enemy = nearestEnemy(state, commander, Infinity);
    commander.ai.chargePoint = enemy ? { x: enemy.pos.x, z: enemy.pos.z } : null;
  } else {
    commander.ai.chargePoint = null;
  }
}

/** The bot army: gives orders at most every few seconds; a bot commander stays behind its lines and fights. */
export function runBotArmy(state: MatchState, army: Army, dt: number): void {
  const commander = getUnit(state, army.commanderId);
  if (state.settings.armies[army.id]?.followsPlayer) {
    followThePlayer(state, army, commander?.alive ? commander : null, dt);
    if (commander?.alive) botCommanderIntent(state, commander);
    return;
  }
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
