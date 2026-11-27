import { FOREST_POINTS, FORTRESS_POINTS, type MapPoint, NORTH_POINTS, OLD_FRIENDS_POINTS, RIVER_POINTS, VILLAGE_POINTS } from '../maps.ts';
import { declareVictory } from '../match.ts';
import type { ArmySetup, BotStyle, Faction, MatchSettings, MatchState } from '../types.ts';
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

export interface CampaignBattle {
  chapter: ChapterId;
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
  bandits: 5,
  villageRaiders: 10,
  galbasMen: 3,
  bridgeWave: 18,
  bridgeSecondWave: 24,
  bridgeSecondWaveAt: 55,
  bridgeHold: 150,
  ambushSide: 15,
  outpost: 24,
  nightRaidFirst: 18,
  nightRaidSecond: 20,
  nightRaidSecondAt: 30,
  nightRaidHold: 150,
  alliedArmy: 20,
  horde: 72,
  hrolfToughness: 3,
  lastNightLegion: 20,
  oldFriendsArmy: 15,
  /** The last night ends when Cassian first falls, or after this long at the latest. */
  lastStandMax: 240,
  /** Seconds the dead keep coming after Cassian falls, before the story moves on. */
  lastStandAftermath: 3,
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
}

function army(side: Side): ArmySetup {
  const setup: ArmySetup = {
    name: side.name,
    team: side.team,
    isBot: side.bot ?? true,
    faction: side.faction,
    soldiers: side.soldiers,
    spawn: at(side.spawn),
  };
  if (side.commander) setup.commander = true;
  if (side.heroes) setup.heroes = side.heroes;
  if (side.arriveAt !== undefined) setup.arriveAt = side.arriveAt;
  if (side.style) setup.style = side.style;
  if (side.commanderToughness) setup.commanderToughness = side.commanderToughness;
  if (side.reinforce) setup.reinforce = side.reinforce;
  return setup;
}

function settings(map: MatchSettings['map'], armies: ArmySetup[]): MatchSettings {
  return { mode: 'teams', armySize: 15, armies, seed: STORY_BATTLE.seed, map, prepareTime: STORY_BATTLE.prepareTime };
}

/** Cassian's own army: the heroes with him first, then the living legionaries (from the Emperor on). */
/**
 * What Cassian is called (and so how he looks) at each point of the story: a wanderer before the
 * Emperor gives him the legion, its legate after, an old man on the last night.
 */
export const CASSIAN_NAMES = { wanderer: 'Cassian', legate: 'Legate Cassian', old: 'Old Cassian' } as const;

function cassianName(chapter: ChapterId): string {
  if (chapter === 'last-night') return CASSIAN_NAMES.old;
  return isAtOrAfter(chapter, 'emperor') ? CASSIAN_NAMES.legate : CASSIAN_NAMES.wanderer;
}

function cassian(save: CampaignSave, chapter: ChapterId, spawn: MapPoint, heroes: readonly HeroId[], withLegion: boolean): { setup: ArmySetup; legionNames: string[] } {
  const heroNames = heroes.map((h) => HERO_NAMES[h]);
  const legionNames = withLegion ? livingLegion(save.legion).map((l) => l.name) : [];
  const setup = army({ name: cassianName(chapter), team: 0, faction: 'roman', soldiers: heroNames.length + legionNames.length, spawn, bot: false, heroes: heroNames });
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
  const base = { chapter, objective, goal: rout, time: 'day' as TimeOfDay, onLoss: 'retry' as OnLoss, commanders: {}, warlordArmy: null };
  switch (chapter) {
    case 'forest-road': {
      // Varro rides with Cassian; Felix and Rufus are the villagers fighting for their lives up the road.
      const me = cassian(save, chapter, FOREST_POINTS.arrival, heroes.filter((h) => h === 'varro'), false);
      const villagers = army({ name: 'Villagers', team: 0, faction: 'bandit', soldiers: 2, spawn: FOREST_POINTS.villagers, heroes: [HERO_NAMES.felix, HERO_NAMES.rufus] });
      const bandits = army({ name: 'Bandits', team: 1, faction: 'bandit', soldiers: STORY_BATTLE.bandits, spawn: FOREST_POINTS.bandits, style: 'charge' });
      return { ...base, settings: settings('forest', [me.setup, villagers, bandits]), legionNames: me.legionNames };
    }
    case 'burning-village': {
      const me = cassian(save, chapter, VILLAGE_POINTS.arrival, heroes, false);
      const galba = army({ name: 'Galba', team: 0, faction: 'roman', soldiers: STORY_BATTLE.galbasMen, spawn: VILLAGE_POINTS.defenders, commander: true });
      const raiders = army({ name: 'Raiders', team: 1, faction: 'viking', soldiers: STORY_BATTLE.villageRaiders, spawn: VILLAGE_POINTS.raiders, style: 'charge' });
      return { ...base, time: 'night', settings: settings('village', [me.setup, galba, raiders]), legionNames: me.legionNames, commanders: { 1: 'Galba' } };
    }
    case 'bridge': {
      const me = cassian(save, chapter, RIVER_POINTS.bridgehead, heroes, true);
      const first = army({ name: 'Vikings', team: 1, faction: 'viking', soldiers: STORY_BATTLE.bridgeWave, spawn: RIVER_POINTS.firstWave, style: 'charge' });
      const second = army({ name: 'More Vikings', team: 1, faction: 'viking', soldiers: STORY_BATTLE.bridgeSecondWave, spawn: RIVER_POINTS.secondWave, arriveAt: STORY_BATTLE.bridgeSecondWaveAt, style: 'steady' });
      const goal: BattleGoal = { kind: 'hold', seconds: STORY_BATTLE.bridgeHold, label: 'last cart over in' };
      return { ...base, goal, settings: settings('river', [me.setup, first, second]), legionNames: me.legionNames };
    }
    case 'dark-forest': {
      const me = cassian(save, chapter, FOREST_POINTS.column, heroes, true);
      const north = army({ name: 'Vikings', team: 1, faction: 'viking', soldiers: STORY_BATTLE.ambushSide, spawn: FOREST_POINTS.ambushNorth, style: 'charge' });
      const south = army({ name: 'Vikings', team: 1, faction: 'viking', soldiers: STORY_BATTLE.ambushSide, spawn: FOREST_POINTS.ambushSouth, style: 'charge' });
      return { ...base, time: 'night', settings: settings('forest', [me.setup, north, south]), legionNames: me.legionNames };
    }
    case 'outpost': {
      const me = cassian(save, chapter, NORTH_POINTS.outpostApproach, heroes, true);
      const outpost = army({ name: 'The Outpost', team: 1, faction: 'viking', soldiers: STORY_BATTLE.outpost, spawn: NORTH_POINTS.outpost, style: 'patient' });
      return { ...base, settings: settings('north', [me.setup, outpost]), legionNames: me.legionNames };
    }
    case 'night-raid': {
      const me = cassian(save, chapter, NORTH_POINTS.camp, heroes, true);
      const first = army({ name: 'Raiders', team: 1, faction: 'viking', soldiers: STORY_BATTLE.nightRaidFirst, spawn: NORTH_POINTS.raidNorth, style: 'charge' });
      const second = army({ name: 'Raiders', team: 1, faction: 'viking', soldiers: STORY_BATTLE.nightRaidSecond, spawn: NORTH_POINTS.raidEast, arriveAt: STORY_BATTLE.nightRaidSecondAt, style: 'charge' });
      const goal: BattleGoal = { kind: 'hold', seconds: STORY_BATTLE.nightRaidHold, label: 'dawn in' };
      return { ...base, goal, time: 'night', settings: settings('north', [me.setup, first, second]), legionNames: me.legionNames };
    }
    case 'last-battle': {
      const me = cassian(save, chapter, FORTRESS_POINTS.legion, heroes, true);
      const galba = army({ name: 'Galba', team: 0, faction: 'roman', soldiers: STORY_BATTLE.alliedArmy, spawn: FORTRESS_POINTS.leftWing, commander: true, style: 'steady' });
      const quintus = army({ name: 'Quintus', team: 0, faction: 'roman', soldiers: STORY_BATTLE.alliedArmy, spawn: FORTRESS_POINTS.rightWing, commander: true, style: 'steady' });
      const horde = army({
        name: 'Hrolf',
        team: 1,
        faction: 'viking',
        soldiers: STORY_BATTLE.horde,
        spawn: FORTRESS_POINTS.horde,
        commander: true,
        commanderToughness: STORY_BATTLE.hrolfToughness,
        style: 'steady',
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
      const me: ArmySetup = { ...old.setup, soldiers: STORY_BATTLE.lastNightLegion + heroNames.length, heroes: heroNames };
      const felix = army({ name: 'Felix', team: 0, faction: 'roman', soldiers: STORY_BATTLE.oldFriendsArmy, spawn: OLD_FRIENDS_POINTS.felix, commander: true, style: 'steady' });
      const rufus = army({ name: 'Rufus', team: 0, faction: 'roman', soldiers: STORY_BATTLE.oldFriendsArmy, spawn: OLD_FRIENDS_POINTS.rufus, commander: true, style: 'steady' });
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
