import { createMatch, defaultSettings } from '../src/setup.ts';
import { terrainHeightAt } from '../src/terrain.ts';
import type { MatchSettings, MatchState, Unit } from '../src/types.ts';

/**
 * Most tests want commanders on foot; their starting horses are removed unless asked for.
 */
export function newMatch(overrides: Partial<MatchSettings> = {}, options: { commanderHorses?: boolean } = {}): MatchState {
  const state = createMatch(defaultSettings(overrides));
  if (options.commanderHorses) return state;
  for (const army of state.armies) {
    const commander = state.units[army.commanderId];
    const horse = commander?.mountId === null || !commander ? undefined : state.units[commander.mountId];
    if (!commander || !horse) continue;
    commander.mountId = null;
    horse.riderId = null;
    horse.alive = false;
    commander.pos.y = terrainHeightAt(commander.pos.x, commander.pos.z);
  }
  return state;
}

/** Moves a unit to a spot (on the ground) and clears its motion. */
export function place(unit: Unit, x: number, z: number, yaw = 0): Unit {
  unit.pos = { x, y: terrainHeightAt(x, z), z };
  unit.vel = { x: 0, y: 0, z: 0 };
  unit.yaw = yaw;
  unit.intent.faceYaw = yaw;
  unit.onGround = true;
  return unit;
}

export function commanderOf(state: MatchState, armyId: number): Unit {
  const army = state.armies[armyId];
  const unit = army ? state.units[army.commanderId] : undefined;
  if (!unit) throw new Error(`no commander for army ${armyId}`);
  return unit;
}

export function soldiersOf(state: MatchState, armyId: number): Unit[] {
  const army = state.armies[armyId];
  if (!army) throw new Error(`no army ${armyId}`);
  return army.soldierIds.map((id) => {
    const unit = state.units[id];
    if (!unit) throw new Error(`missing unit ${id}`);
    return unit;
  });
}

export function firstOfKind(state: MatchState, armyId: number, kind: Unit['kind']): Unit {
  const unit = soldiersOf(state, armyId).find((u) => u.kind === kind);
  if (!unit) throw new Error(`no ${kind} in army ${armyId}`);
  return unit;
}

export function horseOf(state: MatchState, rider: Unit): Unit {
  const horse = rider.mountId === null ? undefined : state.units[rider.mountId];
  if (!horse) throw new Error('rider has no horse');
  return horse;
}

export function killAllBut(state: MatchState, keep: Unit[]): void {
  for (const unit of state.units) {
    if (!keep.includes(unit)) {
      unit.alive = false;
      unit.hp = 0;
      unit.riderId = keep.some((k) => k.id === unit.riderId) ? unit.riderId : null;
    }
  }
}
