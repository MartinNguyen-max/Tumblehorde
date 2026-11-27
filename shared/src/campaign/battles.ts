import { FOREST_POINTS, FORTRESS_POINTS, type MapPoint, NORTH_POINTS, OLD_FRIENDS_POINTS, RIVER_POINTS, VILLAGE_POINTS } from '../maps.ts';
import { declareVictory } from '../match.ts';
import type { ArmySetup, BotStyle, Faction, Formation, MatchSettings, MatchState, Order } from '../types.ts';
import { type ChapterId, isAtOrAfter } from './chapters.ts';
import { heroesIn, type HeroId, livingLegion } from './roster.ts';
import type { CampaignSave } from './save.ts';

/**
 * The story's battles: who fights where, in what light, and what counts as winning. Built from
 * the save, so the legion fights with the men it has left and Eirik only if he was spared.
 */

/** Rout: beat every enemy. Hold: last out the clock (or beat them sooner). Last stand: it cannot be won. */
export type BattleGoal = { kind: 'rout' } | { kind: 'hold'; seconds: number; label: string } | { kind: 'lastStand' };

export type TimeOfDay = 'day' | 'dusk' | 'night';

/** What happens when the battle is lost: try again, choose between trying again and leaving, or the story goes on. */
export type OnLoss = 'retry' | 'retryOrLeave' | 'continue';

/**
 * The campaign teaches as it goes: a hint (with an arrow on the command it names) that stays up
 * until the player does what it says, or for a while.
 */
export interface TutorialStep {
  text: string;
  /** The HUD command the arrow points at. */
  points: 'follow' | 'hold' | 'attack' | 'rally' | null;
  done: { order: Order } | { formation: Formation } | { seconds: number };
}

export interface CampaignBattle {
  chapter: ChapterId;
  /** Hints shown one after another at the start (an empty list once the player knows it all). */
  tutorial: readonly TutorialStep[];
  /** What to do, shown at the top of the screen. */
  objective: string;
  settings: MatchSettings;
  goal: BattleGoal;
  time: TimeOfDay;
  onLoss: OnLoss;
  /** The legionaries in the player's army, in soldier order after the heroes. */
  legionNames: string[];
  /** Names shown over the commanders of other armies, by army index. */
  commanders: Record<number, string>;
  /** The army led by Hrolf the Red, whose fall the story waits for. */
  warlordArmy: number | null;
}

export interface BattleResult {
  won: boolean;
  /** Legionaries who fell, in soldier order. */
  fallenNames: string[];
  warlordDefeated: boolean;
}

export const HERO_NAMES: Record<HeroId, string> = { varro: 'Varro', felix: 'Felix', rufus: 'Rufus', eirik: 'Eirik' };

export const STORY_BATTLE = {
  seed: 7,
  /** Story battles start sooner than skirmishes: the enemy is already on its way. */
  prepareTime: 6,
  /**
   * The story's enemies come in hordes: many more of them than the legion, each far weaker. Their
   * soldiers' hit points and damage, times these.
   */
  weakling: { hp: 0.35, damage: 0.3 },
  bandits: 10,
  villageRaiders: 24,
  galbasMen: 3,
  bridgeWave: 40,
  bridgeSecondWave: 45,
  bridgeHold: 150,
  ambushSide: 32,
  outpost: 60,
  nightRaidFirst: 32,
  nightRaidSecond: 32,
  nightRaidHold: 150,
  alliedArmy: 20,
  horde: 130,
  hrolfToughness: 3,
  /** A veteran legionary's hit points, times this. */
  veteranToughness: 1.2,
  lastNightLegion: 20,
  oldFriendsArmy: 15,
  /** The last night ends when Cassian first falls, or after this long at the latest. */
  lastStandMax: 240,
  /** Seconds the dead keep coming after Cassian falls, before the story moves on. */
  lastStandAftermath: 3,
  /** Seconds between the ambush scene and the charge: just enough to form a ring. */
  ambushWarning: 4,
  zombiesFirst: 40,
  zombieWave: { every: 6, count: 9 },
} as const;

/** The line at the top of the screen in each story battle. */
const BATTLE_OBJECTIVES: Partial<Record<ChapterId, string>> = {
  'forest-road': 'Save the villagers: beat the bandits',
  'burning-village': 'Drive the raiders out of the village',
  bridge: 'Hold the bridge',
  'dark-forest': 'Ambush! Fight them off',
  outpost: 'Take the outpost',
  'night-raid': 'Hold the camp',
  'last-battle': 'Break the horde. Find Hrolf the Red',
  'last-night': 'Hold them back',
};

function at(point: MapPoint): ArmySetup['spawn'] {
  return { x: point.x, z: point.z, yaw: point.yaw };
}

interface Side {
  name: string;
  team: number;
  faction: Faction;
  soldiers: number;
  spawn: MapPoint;
  bot?: boolean;
  commander?: boolean;
  heroes?: readonly string[];
  arriveAt?: number;
  style?: BotStyle;
  commanderToughness?: number;
  reinforce?: { every: number; count: number };
  horde?: { hp: number; damage: number };
  startOrder?: Order;
  startFormation?: Formation;
  /** Named people's looks (see `ArmySetup.looks`). */
  looks?: Record<string, string>;
}

/** Story armies wear their people's colors, the same as in the scenes. */
export const STORY_COLORS: Record<Faction, string> = {
  roman: '#C8423A',
  viking: '#3E5A7A',
  bandit: '#4A4A3A',
  zombie: '#4E4638',
};

/**
 * How the story's people look in each part of the story, named after the client's cast, so a
 * battle shows them exactly as the scenes around it do.
 */
export const STORY_LOOKS = {
  cassianPrisoner: 'cassianPrisoner',
  cassianSilver: 'cassianTraveller',
  cassianLegate: 'cassianHelmet',
  cassianOld: 'cassianOld',
  varro: 'varroArmored',
  felix: 'felix',
  rufus: 'rufus',
  felixLegion: 'felixLegion',
  rufusLegion: 'rufusLegion',
  felixOld: 'felixOld',
  rufusOld: 'rufusOld',
  eirik: 'eirik',
  marcus: 'marcusYoung',
  galba: 'galba',
  quintus: 'quintus',
  hrolf: 'hrolf',
} as const;

/** Cassian as he looks in `chapter`: silver armor from the smith, the legion's red from the Emperor on, old at the end. */
function cassianLook(chapter: ChapterId): string {
  if (chapter === 'last-night') return STORY_LOOKS.cassianOld;
  return isAtOrAfter(chapter, 'emperor') ? STORY_LOOKS.cassianLegate : STORY_LOOKS.cassianSilver;
}

/** A hero's look in `chapter`: Felix and Rufus are villagers until they join the legion. */
function heroLook(hero: HeroId, chapter: ChapterId): string {
  const legion = isAtOrAfter(chapter, 'emperor');
  switch (hero) {
    case 'varro':
      return STORY_LOOKS.varro;
    case 'felix':
      return legion ? STORY_LOOKS.felixLegion : STORY_LOOKS.felix;
    case 'rufus':
      return legion ? STORY_LOOKS.rufusLegion : STORY_LOOKS.rufus;
    case 'eirik':
      return STORY_LOOKS.eirik;
  }
}

function army(side: Side): ArmySetup {
  const setup: ArmySetup = {
    name: side.name,
    team: side.team,
    isBot: side.bot ?? true,
    faction: side.faction,
    soldiers: side.soldiers,
    spawn: at(side.spawn),
    color: STORY_COLORS[side.faction],
  };
  if (side.looks) setup.looks = side.looks;
  if (side.commander) setup.commander = true;
  if (side.heroes) setup.heroes = side.heroes;
  if (side.arriveAt !== undefined) setup.arriveAt = side.arriveAt;
  if (side.style) setup.style = side.style;
  if (side.commanderToughness) setup.commanderToughness = side.commanderToughness;
  if (side.reinforce) setup.reinforce = side.reinforce;
  if (side.horde) setup.horde = side.horde;
  if (side.startOrder) setup.startOrder = side.startOrder;
  if (side.startFormation) setup.startFormation = side.startFormation;
  return setup;
}

function settings(map: MatchSettings['map'], armies: ArmySetup[], prepareTime: number = STORY_BATTLE.prepareTime): MatchSettings {
  return { mode: 'teams', armySize: 15, armies, seed: STORY_BATTLE.seed, map, prepareTime, noSplit: true };
}

/** A raiding horde: many, weak, and all running at you at once. */
function raiders(name: string, faction: Faction, soldiers: number, spawn: MapPoint, extra: Partial<Side> = {}): ArmySetup {
  return army({ name, team: 1, faction, soldiers, spawn, style: 'rush', horde: STORY_BATTLE.weakling, ...extra });
}

/** The hints of each battle: the first fights teach the orders the story needs. */
const TUTORIALS: Partial<Record<ChapterId, readonly TutorialStep[]>> = {
  'forest-road': [
    { text: 'Press 1: Follow. Varro comes with you wherever you go.', points: 'follow', done: { order: 'follow' } },
    { text: 'Run to the villagers! Left click strikes, right click raises your shield.', points: null, done: { seconds: 9 } },
  ],
  'burning-village': [{ text: 'Press 3: Attack. Your friends go for the raiders on their own.', points: 'attack', done: { order: 'attack' } }],
  bridge: [
    { text: 'Your men are all over the place. Keep 2 held down and pick Two lines.', points: 'hold', done: { formation: 'double' } },
    { text: 'Hold the bridge. Your men thrust their spears over their shields; R throws a volley.', points: null, done: { seconds: 9 } },
  ],
  'dark-forest': [{ text: 'Ambush! They are all around you. Keep 2 held down and pick Circle around me.', points: 'hold', done: { formation: 'circle' } }],
  'last-battle': [{ text: 'Press 6 for a rally speech: your legion fights with courage.', points: 'rally', done: { seconds: 10 } }],
};

/** True once the player has done what a hint asks (or it has been up long enough). */
export function tutorialStepDone(step: TutorialStep, state: MatchState, shownFor: number): boolean {
  const mine = state.armies[0];
  if (!mine) return true;
  if ('seconds' in step.done) return shownFor >= step.done.seconds;
  if ('order' in step.done) {
    const wanted = step.done.order;
    return mine.groupOrders.some((g) => g.order === wanted);
  }
  return mine.formation === step.done.formation && mine.groupOrders.some((g) => g.order === 'hold');
}

/** Cassian's own army: the heroes with him first, then the living legionaries (from the Emperor on). */
/**
 * What Cassian is called (and so how he looks) at each point of the story: a wanderer before the
 * Emperor gives him the legion, its legate after, an old man on the last night.
 */
export const CASSIAN_NAMES = { wanderer: 'Cassian', legate: 'Legate Cassian', old: 'Old Cassian' } as const;

/**
 * Where Cassian fights on foot: before the Emperor gives him a horse, in the dark forest where
 * everyone dismounted for the ambush, and at the night camp.
 */
const ON_FOOT: readonly ChapterId[] = ['forest-road', 'burning-village', 'dark-forest', 'night-raid'];

function cassianName(chapter: ChapterId): string {
  if (chapter === 'last-night') return CASSIAN_NAMES.old;
  return isAtOrAfter(chapter, 'emperor') ? CASSIAN_NAMES.legate : CASSIAN_NAMES.wanderer;
}

function cassian(save: CampaignSave, chapter: ChapterId, spawn: MapPoint, heroes: readonly HeroId[], withLegion: boolean): { setup: ArmySetup; legionNames: string[] } {
  const heroNames = heroes.map((h) => HERO_NAMES[h]);
  const legion = withLegion ? livingLegion(save.legion) : [];
  const legionNames = legion.map((l) => l.name);
  const looks: Record<string, string> = { commander: cassianLook(chapter) };
  for (const hero of heroes) looks[HERO_NAMES[hero]] = heroLook(hero, chapter);
  const setup = army({ name: cassianName(chapter), team: 0, faction: 'roman', soldiers: heroNames.length + legionNames.length, spawn, bot: false, heroes: heroNames, looks });
  if (ON_FOOT.includes(chapter)) setup.onFoot = true;
  // Survivors of a deadly battle are veterans: a little harder to bring down.
  if (legion.some((l) => l.veteran)) setup.toughness = [...heroNames.map(() => 1), ...legion.map((l) => (l.veteran ? STORY_BATTLE.veteranToughness : 1))];
  return { setup, legionNames };
}

function heroesFor(save: CampaignSave, chapter: ChapterId): HeroId[] {
  return heroesIn(chapter, save.choices.eirikSpared);
}

/** The battle of a battle chapter, or null for chapters without one. */
export function campaignBattle(chapter: ChapterId, save: CampaignSave): CampaignBattle | null {
  const heroes = heroesFor(save, chapter);
  const rout: BattleGoal = { kind: 'rout' };
  const objective = BATTLE_OBJECTIVES[chapter] ?? 'Win the battle';
  const tutorial = TUTORIALS[chapter] ?? [];
  const base = { chapter, objective, tutorial, goal: rout, time: 'day' as TimeOfDay, onLoss: 'retry' as OnLoss, commanders: {}, warlordArmy: null };
  switch (chapter) {
    case 'forest-road': {
      // Varro rides with Cassian; Felix and Rufus are the villagers fighting for their lives up the road.
      const me = cassian(save, chapter, FOREST_POINTS.arrival, heroes.filter((h) => h === 'varro'), false);
      const villagers = army({ name: 'Villagers', team: 0, faction: 'bandit', soldiers: 2, spawn: FOREST_POINTS.villagers, heroes: [HERO_NAMES.felix, HERO_NAMES.rufus], looks: { [HERO_NAMES.felix]: STORY_LOOKS.felix, [HERO_NAMES.rufus]: STORY_LOOKS.rufus } });
      const bandits = raiders('Bandits', 'bandit', STORY_BATTLE.bandits, FOREST_POINTS.bandits);
      // The fight is on before Cassian gets there: no forming up.
      return { ...base, settings: settings('forest', [me.setup, villagers, bandits], 0), legionNames: me.legionNames };
    }
    case 'burning-village': {
      const me = cassian(save, chapter, VILLAGE_POINTS.arrival, heroes, false);
      const galba = army({ name: 'Galba', team: 0, faction: 'roman', soldiers: STORY_BATTLE.galbasMen, spawn: VILLAGE_POINTS.defenders, commander: true, looks: { commander: STORY_LOOKS.galba } });
      const horde = raiders('Raiders', 'viking', STORY_BATTLE.villageRaiders, VILLAGE_POINTS.raiders);
      return { ...base, time: 'night', settings: settings('village', [me.setup, galba, horde], 0), legionNames: me.legionNames, commanders: { 1: 'Galba' } };
    }
    case 'bridge': {
      const me = cassian(save, chapter, RIVER_POINTS.bridgehead, heroes, true);
      // The men mill about until Cassian forms them up.
      me.setup.startFormation = 'swarm';
      const first = raiders('Vikings', 'viking', STORY_BATTLE.bridgeWave, RIVER_POINTS.firstWave);
      const second = raiders('More Vikings', 'viking', STORY_BATTLE.bridgeSecondWave, RIVER_POINTS.secondWave);
      const goal: BattleGoal = { kind: 'hold', seconds: STORY_BATTLE.bridgeHold, label: 'last cart over in' };
      return { ...base, goal, settings: settings('river', [me.setup, first, second]), legionNames: me.legionNames };
    }
    case 'dark-forest': {
      const me = cassian(save, chapter, FOREST_POINTS.column, heroes, true);
      const north = raiders('Vikings', 'viking', STORY_BATTLE.ambushSide, FOREST_POINTS.ambushNorth);
      const south = raiders('Vikings', 'viking', STORY_BATTLE.ambushSide, FOREST_POINTS.ambushSouth);
      return { ...base, time: 'night', settings: settings('forest', [me.setup, north, south], STORY_BATTLE.ambushWarning), legionNames: me.legionNames };
    }
    case 'outpost': {
      const me = cassian(save, chapter, NORTH_POINTS.outpostApproach, heroes, true);
      const outpost = raiders('The Outpost', 'viking', STORY_BATTLE.outpost, NORTH_POINTS.outpost);
      return { ...base, settings: settings('north', [me.setup, outpost]), legionNames: me.legionNames };
    }
    case 'night-raid': {
      const me = cassian(save, chapter, NORTH_POINTS.camp, heroes, true);
      const first = raiders('Raiders', 'viking', STORY_BATTLE.nightRaidFirst, NORTH_POINTS.raidNorth);
      const second = raiders('Raiders', 'viking', STORY_BATTLE.nightRaidSecond, NORTH_POINTS.raidEast);
      const goal: BattleGoal = { kind: 'hold', seconds: STORY_BATTLE.nightRaidHold, label: 'dawn in' };
      return { ...base, goal, time: 'night', settings: settings('north', [me.setup, first, second]), legionNames: me.legionNames };
    }
    case 'last-battle': {
      const me = cassian(save, chapter, FORTRESS_POINTS.legion, heroes, true);
      const galba = army({ name: 'Galba', team: 0, faction: 'roman', soldiers: STORY_BATTLE.alliedArmy, spawn: FORTRESS_POINTS.leftWing, commander: true, style: 'steady', looks: { commander: STORY_LOOKS.galba } });
      const quintus = army({ name: 'Quintus', team: 0, faction: 'roman', soldiers: STORY_BATTLE.alliedArmy, spawn: FORTRESS_POINTS.rightWing, commander: true, style: 'steady', looks: { commander: STORY_LOOKS.quintus } });
      const horde = army({
        name: 'Hrolf',
        team: 1,
        faction: 'viking',
        soldiers: STORY_BATTLE.horde,
        spawn: FORTRESS_POINTS.horde,
        commander: true,
        commanderToughness: STORY_BATTLE.hrolfToughness,
        style: 'rush',
        horde: STORY_BATTLE.weakling,
        looks: { commander: STORY_LOOKS.hrolf },
      });
      return {
        ...base,
        onLoss: 'retryOrLeave',
        settings: settings('fortress', [me.setup, galba, quintus, horde]),
        legionNames: me.legionNames,
        commanders: { 1: 'Galba', 2: 'Quintus', 3: 'Hrolf the Red' },
        warlordArmy: 3,
      };
    }
    case 'last-night': {
      const spot = save.choices.lastStand === 'tunnel' ? FORTRESS_POINTS.tunnel : FORTRESS_POINTS.courtyard;
      const old = cassian(save, chapter, spot, heroes.filter((h) => h === 'eirik'), false);
      // Years later the legion is a new one, with Marcus at his father's side.
      const heroNames = ['Marcus', ...(old.setup.heroes ?? [])];
      const me: ArmySetup = {
        ...old.setup,
        soldiers: STORY_BATTLE.lastNightLegion + heroNames.length,
        heroes: heroNames,
        looks: { ...old.setup.looks, Marcus: STORY_LOOKS.marcus },
      };
      const felix = army({ name: 'Felix', team: 0, faction: 'roman', soldiers: STORY_BATTLE.oldFriendsArmy, spawn: OLD_FRIENDS_POINTS.felix, commander: true, style: 'steady', looks: { commander: STORY_LOOKS.felixOld } });
      const rufus = army({ name: 'Rufus', team: 0, faction: 'roman', soldiers: STORY_BATTLE.oldFriendsArmy, spawn: OLD_FRIENDS_POINTS.rufus, commander: true, style: 'steady', looks: { commander: STORY_LOOKS.rufusOld } });
      const dead = army({
        name: 'The Dead',
        team: 1,
        faction: 'zombie',
        soldiers: STORY_BATTLE.zombiesFirst,
        spawn: FORTRESS_POINTS.graveyard,
        style: 'charge',
        reinforce: STORY_BATTLE.zombieWave,
      });
      return {
        ...base,
        goal: { kind: 'lastStand' },
        time: 'night',
        onLoss: 'continue',
        settings: settings('fortress', [me, felix, rufus, dead]),
        legionNames: [],
        commanders: { 1: 'Felix', 2: 'Rufus' },
      };
    }
    default:
      return null;
  }
}

/** How a battle went for the story, read from the finished (or abandoned) match. */
export function battleResult(battle: CampaignBattle, state: MatchState): BattleResult {
  const mine = state.armies[0];
  const won = mine !== undefined && !mine.eliminated && state.phase !== 'playing' && (state.winnerTeam === null || state.winnerTeam === mine.team);
  const heroes = mine?.soldierIds.filter((id) => state.units[id]?.hero !== null).length ?? 0;
  const fallenNames = battle.legionNames.filter((_, i) => {
    const id = mine?.soldierIds[heroes + i];
    return id !== undefined && state.units[id]?.alive === false;
  });
  const warlord = battle.warlordArmy === null ? null : state.armies[battle.warlordArmy];
  return { won, fallenNames, warlordDefeated: (warlord?.stats.commanderDeaths ?? 0) > 0 };
}

/** A hold battle is won once the clock runs out with the army still standing. */
export function holdTimeLeft(battle: CampaignBattle, time: number): number | null {
  return battle.goal.kind === 'hold' ? Math.max(0, battle.goal.seconds - time) : null;
}

/**
 * A story battle's own goal, checked after every step: holding out until the clock runs out wins,
 * and the last night ends when Cassian first falls (or after `lastStandMax`). Returns what was
 * decided this step, or null. Beating every enemy is decided by the simulation itself.
 */
export function checkStoryGoal(state: MatchState, battle: CampaignBattle): 'won' | 'lost' | null {
  const mine = state.armies[0];
  if (state.phase !== 'playing' || !mine) return null;
  if (battle.goal.kind === 'hold' && !mine.eliminated && state.time >= battle.goal.seconds) {
    declareVictory(state, mine.team);
    return 'won';
  }
  if (battle.goal.kind === 'lastStand' && (mine.stats.commanderDeaths > 0 || state.time > STORY_BATTLE.lastStandMax)) {
    const enemy = state.armies.find((a) => a.team !== mine.team);
    declareVictory(state, enemy?.team ?? mine.team);
    state.endTimer = STORY_BATTLE.lastStandAftermath;
    return 'lost';
  }
  return null;
}
