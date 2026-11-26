import { staggerThinking } from './ai.ts';
import { ARMY, FORMATION, MAP, BODY } from './config.ts';
import { formationSlots } from './formation.ts';
import { yawToDir } from './math.ts';
import { createRandom } from './random.ts';
import { armySpawnPoint } from './spawn.ts';
import { terrainHeightAt } from './terrain.ts';
import type { Army, ArmySize, MatchSettings, MatchState, SoldierKind, Unit } from './types.ts';
import { createUnit } from './units.ts';

export function soldierKindsFor(size: ArmySize): SoldierKind[] {
  const mix = ARMY.composition[size];
  return [
    ...Array<SoldierKind>(mix.swordsman).fill('swordsman'),
    ...Array<SoldierKind>(mix.archer).fill('archer'),
    ...Array<SoldierKind>(mix.rider).fill('rider'),
  ];
}

export function createMatch(settings: MatchSettings): MatchState {
  const state: MatchState = {
    settings,
    time: 0,
    tick: 0,
    units: [],
    armies: [],
    arrows: [],
    nextArrowId: 1,
    rng: createRandom(settings.seed),
    phase: 'playing',
    endTimer: 0,
    winnerTeam: null,
    events: [],
  };
  settings.armies.forEach((setup, index) => {
    const team = settings.mode === 'ffa' ? index : setup.team;
    state.armies.push(createArmy(state, index, team, setup.name, setup.isBot, settings));
  });
  staggerThinking(state);
  return state;
}

function addUnit(state: MatchState, make: (id: number) => Unit): Unit {
  const unit = make(state.units.length);
  state.units.push(unit);
  return unit;
}

function groundPos(x: number, z: number): { x: number; y: number; z: number } {
  return { x, y: terrainHeightAt(x, z), z };
}

function createArmy(
  state: MatchState,
  armyId: number,
  team: number,
  name: string,
  isBot: boolean,
  settings: MatchSettings,
): Army {
  const spawn = armySpawnPoint(armyId, settings.armies.length);
  const forward = yawToDir(spawn.yaw);
  const commanderPos = groundPos(
    spawn.position.x + forward.x * FORMATION.commanderSpawnAhead,
    spawn.position.z + forward.z * FORMATION.commanderSpawnAhead,
  );
  const commander = addUnit(state, (id) => createUnit(id, 'commander', armyId, commanderPos, spawn.yaw));

  const kinds = soldierKindsFor(settings.armySize);
  const slots = formationSlots(kinds, spawn.position, spawn.yaw);
  const soldierIds: number[] = [];
  kinds.forEach((kind, i) => {
    const slot = slots[i] ?? spawn.position;
    const soldier = addUnit(state, (id) => createUnit(id, kind, armyId, groundPos(slot.x, slot.z), spawn.yaw));
    soldierIds.push(soldier.id);
    if (kind === 'rider') {
      const horse = addUnit(state, (id) =>
        createUnit(id, 'horse', armyId, groundPos(slot.x, slot.z), spawn.yaw),
      );
      horse.riderId = soldier.id;
      soldier.mountId = horse.id;
      soldier.pos.y = horse.pos.y + BODY.saddleHeight;
    }
  });

  return {
    id: armyId,
    team,
    name,
    isBot,
    commanderId: commander.id,
    soldierIds,
    groupCount: 1,
    groupOrders: [{ order: 'hold', anchor: { ...spawn.position }, anchorYaw: spawn.yaw }],
    eliminated: false,
    forfeited: false,
    disconnectTimer: null,
    stats: { kills: 0, deaths: 0, commanderDeaths: 0 },
    bot: { orderTimer: 0, thinkTimer: 0 },
    startingSoldiers: soldierIds.length,
  };
}

export function defaultSettings(overrides: Partial<MatchSettings> = {}): MatchSettings {
  return {
    mode: 'ffa',
    armySize: 10,
    armies: [
      { name: 'You', team: 0, isBot: false },
      { name: 'Red Bot', team: 1, isBot: true },
    ],
    seed: MAP.seed,
    ...overrides,
  };
}
