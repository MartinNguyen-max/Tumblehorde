import type { FighterKit } from './campaign/arena.ts';
import { staggerThinking } from './ai.ts';
import { ARMY, FORMATION, HERO, MAP, BODY } from './config.ts';
import { formationSlots, holdSlots } from './formation.ts';
import { centroid, groupForKind } from './orders.ts';
import { yawToDir, type Vec2, type Vec3 } from './math.ts';
import { randomBotStyle } from './bot.ts';
import { createRandom } from './random.ts';
import { nearestWalkable } from './navigation.ts';
import { armySpawn } from './spawn.ts';
import { terrainHeightAt } from './terrain.ts';
import type { Army, ArmyMix, ArmySize, Faction, MatchSettings, MatchState, SoldierKind, Unit } from './types.ts';
import { createUnit } from './units.ts';

export function soldierKindsFor(size: ArmySize, armyMix: ArmyMix = ARMY.defaultMix): SoldierKind[] {
  const mix = ARMY.mixes[armyMix][size];
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
    alliances: [],
    events: [],
  };
  settings.armies.forEach((setup, index) => {
    const team = settings.mode === 'ffa' ? index : setup.team;
    state.armies.push(createArmy(state, index, team, setup.name, setup.isBot, settings));
  });
  staggerThinking(state);
  return state;
}

/** Armies are always commanded as swordsmen, archers and cavalry. */
const ARMY_GROUPS = ARMY.maxGroups;

function addUnit(state: MatchState, make: (id: number) => Unit): Unit {
  const unit = make(state.units.length);
  state.units.push(unit);
  return unit;
}

function groundPos(settings: MatchSettings, x: number, z: number): { x: number; y: number; z: number } {
  return { x, y: terrainHeightAt(settings.map, x, z), z };
}

/** Commanders start on horseback (in the arena on foot). */
function addCommander(state: MatchState, armyId: number, pos: Vec3, yaw: number, faction: Faction, mounted = true): Unit {
  const commander = addUnit(state, (id) => createUnit(id, 'commander', armyId, pos, yaw, faction));
  if (!mounted) return commander;
  const horse = addUnit(state, (id) => createUnit(id, 'horse', armyId, pos, yaw, faction));
  horse.riderId = commander.id;
  commander.mountId = horse.id;
  commander.pos.y = horse.pos.y + BODY.saddleHeight;
  return commander;
}

/** A legion starts in its default formation, so nobody has to shuffle; mixed armies start as a block. */
function startingSlots(kinds: readonly SoldierKind[], center: Vec2, yaw: number): Vec2[] {
  if (kinds.every((k) => k === 'swordsman')) return holdSlots(FORMATION.defaultFormation, kinds.length, center, yaw, false);
  return formationSlots(kinds, center, yaw);
}

function createArmy(
  state: MatchState,
  armyId: number,
  team: number,
  name: string,
  isBot: boolean,
  settings: MatchSettings,
): Army {
  const spawn = armySpawn(settings, armyId);
  const forward = yawToDir(spawn.yaw);
  const commanderPos = groundPos(settings,
    spawn.position.x + forward.x * FORMATION.commanderSpawnAhead,
    spawn.position.z + forward.z * FORMATION.commanderSpawnAhead,
  );
  const setup = settings.armies[armyId];
  const faction = setup?.faction ?? 'roman';
  const led = !isBot || ARMY.botCommanders || setup?.commander === true;
  const commander = led ? addCommander(state, armyId, commanderPos, spawn.yaw, faction, !settings.arena && setup?.onFoot !== true) : null;
  if (commander && setup?.commanderToughness) {
    commander.maxHp *= setup.commanderToughness;
    commander.hp = commander.maxHp;
  }

  const kinds = setup?.soldiers === undefined ? soldierKindsFor(settings.armySize, settings.mix) : Array<SoldierKind>(setup.soldiers).fill(setup.mounted ? 'rider' : 'swordsman');
  const slots = (setup?.startFormation ? holdSlots(setup.startFormation, kinds.length, spawn.position, spawn.yaw, false) : startingSlots(kinds, spawn.position, spawn.yaw)).map((slot) => nearestWalkable(settings.map, slot));
  const soldierIds: number[] = [];
  const soldiers: Unit[] = [];
  kinds.forEach((kind, i) => {
    const slot = slots[i] ?? spawn.position;
    const soldier = addUnit(state, (id) => createUnit(id, kind, armyId, groundPos(settings, slot.x, slot.z), spawn.yaw, faction));
    soldier.group = groupForKind(kind, ARMY_GROUPS);
    soldier.hero = setup?.heroes?.[i] ?? null;
    const toughness = (soldier.hero !== null ? HERO.toughness : setup?.horde?.hp ?? 1) * (setup?.toughness?.[i] ?? 1);
    soldier.maxHp *= toughness;
    soldier.hp = soldier.maxHp;
    soldierIds.push(soldier.id);
    soldiers.push(soldier);
    if (kind === 'rider') {
      const horse = addUnit(state, (id) =>
        createUnit(id, 'horse', armyId, groundPos(settings, slot.x, slot.z), spawn.yaw, faction),
      );
      horse.riderId = soldier.id;
      soldier.mountId = horse.id;
      soldier.pos.y = horse.pos.y + BODY.saddleHeight;
    }
  });

  if (setup?.kit) applyKit(setup.kit, commander ? [commander, ...soldiers] : soldiers);
  return {
    id: armyId,
    team,
    name,
    isBot,
    faction,
    color: setup?.color ?? null,
    looks: setup?.looks ?? {},
    commanderId: commander?.id ?? null,
    soldierIds,
    groupCount: ARMY_GROUPS,
    groupOrders: Array.from({ length: ARMY_GROUPS }, (_, g) => ({
      order: setup?.startOrder ?? 'hold',
      anchor: centroid(soldiers.filter((s) => s.group === g)) ?? { ...spawn.position },
      anchorYaw: spawn.yaw,
      aroundCommander: false,
      formation: setup?.startFormation ?? FORMATION.defaultFormation,
    })),
    formation: setup?.startFormation ?? FORMATION.defaultFormation,
    banquet: 'ready',
    intel: null,
    searchPoint: null,
    searchTimer: 0,
    feastTimer: 0,
    rallyTimer: 0,
    courageTimer: 0,
    gesture: { taps: [], wasCrouching: false },
    allyOffer: null,
    spearsThrown: false,
    eliminated: false,
    forfeited: false,
    disconnectTimer: null,
    reinforceTimer: setup?.reinforce?.every ?? 0,
    stats: { kills: 0, deaths: 0, commanderDeaths: 0 },
    bot: { style: setup?.style ?? (isBot ? randomBotStyle(state) : 'steady'), contactTimer: 0, flankTimer: 0, regroupTimer: 0, regrouping: false, orderTimer: 0, thinkTimer: 0, standoffTimer: 0, threat: [] },
    startingSoldiers: soldierIds.length,
  };
}

export function defaultSettings(overrides: Partial<MatchSettings> = {}): MatchSettings {
  return {
    mode: 'ffa',
    armySize: ARMY.sizes[0],
    armies: [
      { name: 'You', team: 0, isBot: false },
      { name: 'Red Bot', team: 1, isBot: true },
    ],
    seed: MAP.seed,
    map: 'meadow',
    ...overrides,
  };
}

/** Campaign fighters have their own hit points. */
function applyKit(kit: FighterKit, units: readonly Unit[]): void {
  for (const unit of units) {
    unit.hp = kit.hp;
    unit.maxHp = kit.hp;
  }
}
