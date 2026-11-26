import { runArmyAi } from './ai.ts';
import { fireArrow, stepArrows } from './arrows.ts';
import { runBotArmy } from './bot.ts';
import { ARCHER, COMMANDER, MATCH, SIM } from './config.ts';
import { isFreeToAct, killUnit, resolveMelee, startMelee } from './combat.ts';
import { distanceXZ } from './math.ts';
import { centroid, livingSoldiers, updateFollowAnchors } from './orders.ts';
import { stepMovement } from './physics.ts';
import { randomRange } from './random.ts';
import { terrainHeightAt } from './terrain.ts';
import type { Army, CommanderInput, MatchState, Unit } from './types.ts';
import { canUseShield, getUnit, isPerson, rangedStatsFor } from './units.ts';

/** Archers switch from the bow to melee when the target is this close. */
const ARCHER_BOW_MIN_DISTANCE = ARCHER.melee.range + 0.6;

export function applyPlayerInput(state: MatchState, army: Army, input: CommanderInput | undefined): void {
  const commander = state.units[army.commanderId];
  if (!commander?.alive) return;
  const intent = commander.intent;
  if (!input || army.disconnectTimer !== null) {
    intent.moveX = 0;
    intent.moveZ = 0;
    intent.jump = false;
    intent.attack = false;
    intent.shield = false;
    return;
  }
  intent.moveX = input.moveX;
  intent.moveZ = input.moveZ;
  intent.faceYaw = input.faceYaw;
  intent.jump = input.jump;
  intent.attack = input.attack;
  intent.shield = input.shield;
}

function startShot(unit: Unit): boolean {
  const stats = rangedStatsFor(unit);
  if (!stats || !isFreeToAct(unit)) return false;
  unit.action = 'shoot';
  unit.actionTimer = stats.drawTime;
  unit.cooldownTimer = stats.cooldown;
  return true;
}

function wantsBow(state: MatchState, unit: Unit): boolean {
  if (!rangedStatsFor(unit)) return false;
  const target = getUnit(state, unit.ai.targetId);
  return target !== null && distanceXZ(unit.pos, target.pos) > ARCHER_BOW_MIN_DISTANCE;
}

/** Turns intents into shield stance and new strikes or shots. */
export function updateWeapons(state: MatchState): void {
  for (const unit of state.units) {
    if (!unit.alive || !isPerson(unit)) continue;
    unit.shieldUp = unit.intent.shield && canUseShield(unit) && unit.stunTimer <= 0 && unit.action === 'none';
    if (!unit.intent.attack || unit.shieldUp) continue;
    if (wantsBow(state, unit)) startShot(unit);
    else startMelee(state, unit);
  }
}

/** Counts down windups and resolves the strike or releases the arrow when they finish. */
export function progressActions(state: MatchState, dt: number): void {
  for (const unit of state.units) {
    if (!unit.alive || unit.action === 'none') continue;
    unit.actionTimer -= dt;
    if (unit.actionTimer > 0) continue;
    const action = unit.action;
    unit.action = 'none';
    unit.actionTimer = 0;
    if (action === 'melee') resolveMelee(state, unit);
    else fireArrow(state, unit, getUnit(state, unit.ai.targetId));
  }
}

function updateTimers(state: MatchState, dt: number): void {
  for (const unit of state.units) {
    if (!unit.alive) continue;
    if (unit.cooldownTimer > 0) unit.cooldownTimer = Math.max(0, unit.cooldownTimer - dt);
    if (unit.stunTimer > 0) unit.stunTimer = Math.max(0, unit.stunTimer - dt);
    if (unit.invulnerableTimer > 0) unit.invulnerableTimer = Math.max(0, unit.invulnerableTimer - dt);
  }
}

export function respawnCommander(state: MatchState, army: Army, commander: Unit): boolean {
  const center = centroid(livingSoldiers(state, army));
  if (!center) return false;
  commander.alive = true;
  commander.hp = commander.maxHp;
  commander.pos = { x: center.x, y: terrainHeightAt(center.x, center.z), z: center.z };
  commander.vel = { x: 0, y: 0, z: 0 };
  commander.onGround = true;
  commander.stunTimer = 0;
  commander.action = 'none';
  commander.cooldownTimer = 0;
  commander.mountId = null;
  commander.respawnTimer = 0;
  commander.invulnerableTimer = COMMANDER.respawnShield;
  commander.lastHitByArmy = null;
  state.events.push({ type: 'respawn', unitId: commander.id });
  return true;
}

function updateRespawns(state: MatchState, dt: number): void {
  for (const army of state.armies) {
    const commander = state.units[army.commanderId];
    if (!commander || commander.alive || army.forfeited || army.eliminated) continue;
    commander.respawnTimer -= dt;
    if (commander.respawnTimer <= 0) respawnCommander(state, army, commander);
  }
}

/** Kills everything left in an army, e.g. when its player stayed disconnected for too long. */
export function forfeitArmy(state: MatchState, army: Army): void {
  army.forfeited = true;
  army.disconnectTimer = null;
  const ids = [army.commanderId, ...army.soldierIds];
  for (const id of ids) {
    const unit = state.units[id];
    if (!unit?.alive) continue;
    const pop = { x: randomRange(state.rng, -2, 2), y: randomRange(state.rng, 3, 6), z: randomRange(state.rng, -2, 2) };
    killUnit(state, unit, null, pop);
  }
}

export function setArmyConnected(state: MatchState, armyId: number, connected: boolean): void {
  const army = state.armies[armyId];
  if (!army || army.forfeited) return;
  army.disconnectTimer = connected ? null : MATCH.disconnectTimeout;
}

function updateDisconnects(state: MatchState, dt: number): void {
  for (const army of state.armies) {
    if (army.disconnectTimer === null || army.eliminated) continue;
    army.disconnectTimer -= dt;
    if (army.disconnectTimer <= 0) forfeitArmy(state, army);
  }
}

export function isArmyDefeated(state: MatchState, army: Army): boolean {
  const commander = state.units[army.commanderId];
  return livingSoldiers(state, army).length === 0 && !commander?.alive;
}

function updateElimination(state: MatchState): void {
  for (const army of state.armies) {
    if (army.eliminated || !isArmyDefeated(state, army)) continue;
    army.eliminated = true;
    army.disconnectTimer = null;
    state.events.push({ type: 'armyEliminated', armyId: army.id });
  }
}

export function teamsStanding(state: MatchState): Set<number> {
  const teams = new Set<number>();
  for (const army of state.armies) if (!army.eliminated) teams.add(army.team);
  return teams;
}

function updateMatchPhase(state: MatchState, dt: number): void {
  if (state.phase === 'playing') {
    const teams = teamsStanding(state);
    if (teams.size > 1) return;
    state.phase = 'ending';
    state.endTimer = MATCH.endDelay;
    state.winnerTeam = teams.size === 1 ? ([...teams][0] ?? null) : null;
    state.events.push({ type: 'matchOver', winnerTeam: state.winnerTeam });
    return;
  }
  if (state.phase === 'ending') {
    state.endTimer -= dt;
    if (state.endTimer <= 0) state.phase = 'over';
  }
}

/** Advances the whole battle by one fixed step. `inputs` maps army id to its player's input. */
export function stepMatch(state: MatchState, inputs: ReadonlyMap<number, CommanderInput>, dt: number): void {
  state.events = [];
  if (state.phase === 'over') return;
  const step = Math.min(dt, SIM.maxDeltaTime);
  state.time += step;
  state.tick++;

  for (const army of state.armies) {
    if (army.eliminated) continue;
    if (army.isBot) runBotArmy(state, army, step);
    else applyPlayerInput(state, army, inputs.get(army.id));
    runArmyAi(state, army, step);
  }
  updateTimers(state, step);
  updateWeapons(state);
  progressActions(state, step);
  stepMovement(state, step);
  stepArrows(state, step);
  updateFollowAnchors(state, step);
  updateRespawns(state, step);
  updateDisconnects(state, step);
  updateElimination(state);
  updateMatchPhase(state, step);
}

/** Battle duration in seconds, frozen once the winner is decided. */
export function matchDuration(state: MatchState): number {
  return state.phase === 'playing' ? state.time : state.time - (MATCH.endDelay - Math.max(0, state.endTimer));
}
