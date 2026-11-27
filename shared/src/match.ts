import { runArmyAi } from './ai.ts';
import { updateAlliances } from './alliances.ts';
import { updateBanquets, updateStumbles } from './banquet.ts';
import { beginNavigationStep } from './navigation.ts';
import { updateIntel } from './perception.ts';
import { fireArrow, stepArrows, throwPilum } from './arrows.ts';
import { fadeThreats, runBotArmy, runLeaderlessArmy } from './bot.ts';
import { celebrate, isCelebrating } from './celebration.ts';
import { ARCHER, COMMANDER, MATCH, SIM } from './config.ts';
import { applyKnockback, isFreeToAct, killUnit, knockbackVector, resolveMelee, startMelee, thrustsOverShield } from './combat.ts';
import { distanceXZ, normalizeXZ } from './math.ts';
import { livingSoldiers, updateFollowAnchors } from './orders.ts';
import { stepMovement } from './physics.ts';
import { randomRange } from './random.ts';
import { steerAroundStructures } from './structures.ts';
import { terrainHeightAt } from './terrain.ts';
import type { Army, CommanderInput, MatchState, Unit } from './types.ts';
import { areEnemies, armiesHostile, canBeTargeted, canUseShield, getUnit, isMounted, isPerson, rangedStatsFor, setWeapon } from './units.ts';

/** Archers switch from the bow to melee when the target is this close. */
const ARCHER_BOW_MIN_DISTANCE = ARCHER.melee.range + 0.6;

export function applyPlayerInput(state: MatchState, army: Army, input: CommanderInput | undefined): void {
  const commander = getUnit(state, army.commanderId);
  if (!commander?.alive) return;
  const intent = commander.intent;
  if (!input || army.disconnectTimer !== null) {
    intent.moveX = 0;
    intent.moveZ = 0;
    intent.jump = false;
    intent.attack = false;
    intent.shield = false;
    intent.crouch = false;
    intent.aim = null;
    return;
  }
  intent.aim = input.aim;
  intent.moveX = input.moveX;
  intent.moveZ = input.moveZ;
  intent.faceYaw = input.faceYaw;
  intent.jump = input.jump;
  intent.attack = input.attack;
  intent.shield = input.shield;
  intent.crouch = input.crouch;
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
  if (unit.kind === 'commander') return true;
  const target = getUnit(state, unit.ai.targetId);
  return target !== null && distanceXZ(unit.pos, target.pos) > ARCHER_BOW_MIN_DISTANCE;
}

/** Turns intents into shield stance and new strikes or shots. */
export function updateWeapons(state: MatchState): void {
  for (const unit of state.units) {
    if (!unit.alive || !isPerson(unit)) continue;
    const busy = unit.action !== 'none' && !(unit.action === 'melee' && thrustsOverShield(unit));
    unit.shieldUp = unit.intent.shield && canUseShield(unit) && unit.stunTimer <= 0 && !busy;
    if (!unit.intent.attack || (unit.shieldUp && !thrustsOverShield(unit))) continue;
    if (wantsBow(state, unit)) startShot(unit);
    else startMelee(state, unit);
  }
}

/** The spear leaves the hand; from now on this soldier fights with the sword. */
function releaseSpear(state: MatchState, unit: Unit): void {
  const target = getUnit(state, unit.ai.throwTargetId);
  throwPilum(state, unit, target && canBeTargeted(target) ? target : null, unit.ai.throwAt);
  unit.spearThrown = true;
  unit.ai.throwTargetId = null;
  unit.ai.throwAt = null;
  setWeapon(unit, 'sword');
}

/**
 * Counts down windups and resolves the strike or releases the arrow when they finish.
 * Everything that finishes in the same step lands together: otherwise whoever comes first
 * in the unit list would stun the other out of their swing and always win the exchange.
 */
export function progressActions(state: MatchState, dt: number): void {
  const finished: { unit: Unit; action: Exclude<Unit['action'], 'none'> }[] = [];
  for (const unit of state.units) {
    if (!unit.alive || unit.action === 'none') continue;
    unit.actionTimer -= dt;
    if (unit.actionTimer > 0) continue;
    finished.push({ unit, action: unit.action });
    unit.action = 'none';
    unit.actionTimer = 0;
  }
  for (const { unit, action } of finished) {
    if (action === 'melee') resolveMelee(state, unit);
    else if (action === 'throw') releaseSpear(state, unit);
    else {
      const target = getUnit(state, unit.ai.targetId);
      fireArrow(state, unit, target && canBeTargeted(target) ? target : null, unit.intent.aim);
    }
  }
}

function updateTimers(state: MatchState, dt: number): void {
  for (const unit of state.units) {
    if (!unit.alive) continue;
    if (unit.cooldownTimer > 0) unit.cooldownTimer = Math.max(0, unit.cooldownTimer - dt);
    if (unit.stunTimer > 0) unit.stunTimer = Math.max(0, unit.stunTimer - dt);
    if (unit.invulnerableTimer > 0) unit.invulnerableTimer = Math.max(0, unit.invulnerableTimer - dt);
    unit.sinceHurt += dt;
    if (unit.kind === 'commander' && unit.sinceHurt > COMMANDER.regenDelay && unit.hp < unit.maxHp) {
      unit.hp = Math.min(unit.maxHp, unit.hp + COMMANDER.regenPerSecond * dt);
    }
  }
}

/** The commander patches themselves up where they fell, shoving nearby enemies away. */
export function respawnCommander(state: MatchState, army: Army, commander: Unit): boolean {
  if (livingSoldiers(state, army).length === 0) return false;
  commander.alive = true;
  commander.hp = commander.maxHp;
  commander.sinceHurt = 0;
  commander.pos = { x: commander.pos.x, y: terrainHeightAt(state.settings.map, commander.pos.x, commander.pos.z), z: commander.pos.z };
  commander.vel = { x: 0, y: 0, z: 0 };
  commander.onGround = true;
  commander.stunTimer = 0;
  commander.action = 'none';
  commander.cooldownTimer = 0;
  commander.mountId = null;
  commander.respawnTimer = 0;
  commander.invulnerableTimer = COMMANDER.respawnShield;
  commander.lastHitByArmy = null;
  shoveAway(state, commander);
  state.events.push({ type: 'respawn', unitId: commander.id });
  return true;
}

function shoveAway(state: MatchState, commander: Unit): void {
  const shove = COMMANDER.respawnShove;
  for (const other of state.units) {
    if (!other.alive || other === commander || isMounted(other) || !areEnemies(state, commander, other)) continue;
    const d = distanceXZ(other.pos, commander.pos);
    if (d > shove.radius) continue;
    const dir = d > 1e-3 ? normalizeXZ(other.pos.x - commander.pos.x, other.pos.z - commander.pos.z) : { x: 1, z: 0 };
    applyKnockback(other, knockbackVector(dir, shove.strength), shove.stun);
  }
}

function updateRespawns(state: MatchState, dt: number): void {
  for (const army of state.armies) {
    const commander = getUnit(state, army.commanderId);
    if (!commander || commander.alive || army.forfeited || army.eliminated) continue;
    commander.respawnTimer -= dt;
    if (commander.respawnTimer <= 0) respawnCommander(state, army, commander);
  }
}

/** Kills everything left in an army, e.g. when its player stayed disconnected for too long. */
export function forfeitArmy(state: MatchState, army: Army): void {
  army.forfeited = true;
  army.disconnectTimer = null;
  const ids = army.commanderId === null ? army.soldierIds : [army.commanderId, ...army.soldierIds];
  for (const id of ids) {
    const unit = state.units[id];
    if (!unit?.alive) continue;
    const side = MATCH.forfeitPopSideways;
    const pop = {
      x: randomRange(state.rng, -side, side),
      y: randomRange(state.rng, MATCH.forfeitPopUpMin, MATCH.forfeitPopUpMax),
      z: randomRange(state.rng, -side, side),
    };
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
  const commander = getUnit(state, army.commanderId);
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

/** The battle is decided once nobody left standing is hostile to anyone else left standing. */
function anyHostilityLeft(state: MatchState): boolean {
  const standing = state.armies.filter((a) => !a.eliminated);
  return standing.some((a) => standing.some((b) => armiesHostile(state, a.id, b.id)));
}

function updateMatchPhase(state: MatchState, dt: number): void {
  if (state.phase === 'playing') {
    const teams = teamsStanding(state);
    if (anyHostilityLeft(state)) return;
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

/** AI-driven units walk along walls towards gates; players steer themselves. */
function steerAiAroundStructures(state: MatchState): void {
  for (const army of state.armies) {
    const commander = getUnit(state, army.commanderId);
    const playerControlled = !army.isBot && commander?.alive === true;
    for (const id of army.soldierIds) {
      const unit = state.units[id];
      if (unit?.alive) steerAroundStructures(unit, state.settings.map);
    }
    if (commander?.alive && !playerControlled) steerAroundStructures(commander, state.settings.map);
  }
}

/** Advances the whole battle by one fixed step. `inputs` maps army id to its player's input. */
export function stepMatch(state: MatchState, inputs: ReadonlyMap<number, CommanderInput>, dt: number): void {
  state.events = [];
  if (state.phase === 'over') return;
  const step = Math.min(dt, SIM.maxDeltaTime);
  state.time += step;
  state.tick++;
  beginNavigationStep();
  updateIntel(state, step);

  fadeThreats(state, step);
  for (const army of state.armies) {
    if (army.eliminated) continue;
    if (isCelebrating(state, army)) {
      if (!army.isBot) applyPlayerInput(state, army, inputs.get(army.id));
      celebrate(state, army, step);
      continue;
    }
    if (army.isBot) runBotArmy(state, army, step);
    else if (getUnit(state, army.commanderId)?.alive) applyPlayerInput(state, army, inputs.get(army.id));
    else runLeaderlessArmy(state, army, step);
    runArmyAi(state, army, step);
  }
  steerAiAroundStructures(state);
  updateTimers(state, step);
  updateWeapons(state);
  progressActions(state, step);
  stepMovement(state, step);
  updateStumbles(state, step);
  stepArrows(state, step);
  updateFollowAnchors(state, step);
  updateBanquets(state, step);
  updateAlliances(state);
  updateRespawns(state, step);
  updateDisconnects(state, step);
  updateElimination(state);
  updateMatchPhase(state, step);
}

/** Battle duration in seconds, frozen once the winner is decided. */
export function matchDuration(state: MatchState): number {
  return state.phase === 'playing' ? state.time : state.time - (MATCH.endDelay - Math.max(0, state.endTimer));
}
