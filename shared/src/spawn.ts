import { ARENA } from './campaign/arena.ts';
import { ARMY, MAP } from './config.ts';
import { CASTLE, CITY, MAPS, type MapId } from './maps.ts';
import { dirToYaw, type Vec2 } from './math.ts';
import type { MatchSettings } from './types.ts';

export interface SpawnPoint {
  position: Vec2;
  /** Yaw the army faces at the start. */
  yaw: number;
}

/** On the castle map the army on team 0 holds the castle (in free-for-all: the first army). */
export const DEFENDER_TEAM = 0;

export function isDefender(settings: Pick<MatchSettings, 'map' | 'mode' | 'armies'>, index: number): boolean {
  if (MAPS[settings.map].layout !== 'siege') return false;
  // Story battles place their armies themselves: only an army told to defend holds the gate.
  if (settings.armies.some((a) => a.defends || a.spawn)) return settings.armies[index]?.defends === true;
  return settings.mode === 'teams' ? settings.armies[index]?.team === DEFENDER_TEAM : index === 0;
}

const FACING_EAST = Math.PI / 2;
const FACING_WEST = -Math.PI / 2;

type SpawnSettings = Pick<MatchSettings, 'map' | 'mode' | 'armies'>;

/** In a team battle: which team an army is on, and its place among its team mates. */
function teamPlace(settings: SpawnSettings, index: number): { teamSlot: number; teams: number; mate: number; mates: number } {
  const teamIds = [...new Set(settings.armies.map((a) => a.team))].sort((a, b) => a - b);
  const team = settings.armies[index]?.team ?? 0;
  const mates = settings.armies.map((a, i) => ({ team: a.team, i })).filter((a) => a.team === team);
  return { teamSlot: teamIds.indexOf(team), teams: teamIds.length, mate: mates.findIndex((a) => a.i === index), mates: mates.length };
}

function facingCenter(position: Vec2): SpawnPoint {
  return { position, yaw: Math.atan2(-position.x, -position.z) };
}

/**
 * Armies are spread evenly on a circle around the center, far enough apart to plan before the
 * lines meet. In a team battle each team gets its own side, team mates next to each other.
 */
function circleSpawn(settings: SpawnSettings, index: number): SpawnPoint {
  const radius = MAP.armySpawnRadius;
  if (settings.mode === 'teams') {
    const { teamSlot, teams, mate, mates } = teamPlace(settings, index);
    const angle = Math.PI + (teamSlot * 2 * Math.PI) / Math.max(1, teams) + (mate - (mates - 1) / 2) * MAP.teamSpawnSpread;
    return facingCenter({ x: Math.cos(angle) * radius, z: Math.sin(angle) * radius });
  }
  const angle = Math.PI + (index * 2 * Math.PI) / settings.armies.length;
  return facingCenter({ x: Math.cos(angle) * radius, z: Math.sin(angle) * radius });
}

/**
 * In a team battle in the city, which avenue end each army gets: the first team west then north,
 * the second east then south; a team with more armies than its two ends takes whatever is left.
 */
function cityTeamEnds(settings: SpawnSettings): number[] {
  const preferred = [[0, 2], [1, 3]];
  const taken = new Set<number>();
  const result: number[] = [];
  settings.armies.forEach((_, i) => {
    const { teamSlot, mate } = teamPlace(settings, i);
    const wanted = preferred[teamSlot % 2]?.[mate];
    const end = wanted !== undefined && !taken.has(wanted) ? wanted : [0, 1, 2, 3].find((e) => !taken.has(e)) ?? i;
    taken.add(end);
    result.push(end);
  });
  return result;
}

/**
 * City armies start in the squares at the ends of the avenues: west, east, north, south. In a team
 * battle the first team takes west and north, the second east and south: team mates side by side.
 */
function citySpawn(settings: SpawnSettings, index: number): SpawnPoint {
  const d = CITY.spawnDistance;
  const west = { x: -d, z: 0 };
  const ends: Vec2[] = [west, { x: d, z: 0 }, { x: 0, z: d }, { x: 0, z: -d }];
  const end = settings.mode === 'teams' ? cityTeamEnds(settings)[index] ?? index : index;
  const position = ends[end % ends.length] ?? west;
  return { position, yaw: dirToYaw(-position.x, -position.z) };
}

/** Siege: the defender forms up in the courtyard behind the gate, attackers line up in the field. */
const SIEGE = {
  defender: { x: CASTLE.west + 14, z: 0 },
  attackerX: -70,
  attackerSpacing: 46,
} as const;

function siegeSpawn(settings: Pick<MatchSettings, 'map' | 'mode' | 'armies'>, index: number): SpawnPoint {
  if (isDefender(settings, index)) return { position: { ...SIEGE.defender }, yaw: FACING_WEST };
  const attackers = settings.armies.map((_, i) => i).filter((i) => !isDefender(settings, i));
  const slot = attackers.indexOf(index);
  const z = (slot - (attackers.length - 1) / 2) * SIEGE.attackerSpacing;
  return { position: { x: SIEGE.attackerX, z }, yaw: FACING_EAST };
}

/** Where army `index` starts. */
export function armySpawn(settings: Pick<MatchSettings, 'map' | 'mode' | 'armies'>, index: number): SpawnPoint {
  const fixed = settings.armies[index]?.spawn;
  if (fixed) return { position: { x: fixed.x, z: fixed.z }, yaw: fixed.yaw };
  switch (MAPS[settings.map].layout) {
    case 'open':
      return circleSpawn(settings, index);
    case 'city':
      return citySpawn(settings, index);
    case 'siege':
      return siegeSpawn(settings, index);
    case 'arena':
      return arenaSpawn(settings, index);
  }
}

/** The defender's post: just inside the gate, facing out. */
export function gatePost(): SpawnPoint {
  return { position: { x: CASTLE.west + 4, z: 0 }, yaw: FACING_WEST };
}

/** Every place an army could start on this map (any number of armies, any teams), kept clear of trees and rocks. */
export function allPossibleSpawnPoints(map: MapId): Vec2[] {
  const points: Vec2[] = [];
  for (let count = ARMY.minArmies; count <= ARMY.maxArmies; count++) {
    for (let teamBits = 0; teamBits < 2 ** count; teamBits++) {
      const armies = Array.from({ length: count }, (_, i) => ({ name: '', team: (teamBits >> i) & 1, isBot: true }));
      for (const mode of ['ffa', 'teams'] as const) {
        for (let i = 0; i < count; i++) points.push(armySpawn({ map, mode, armies }, i).position);
      }
    }
  }
  return points;
}

/** Arena fighters stand on a ring around the middle of the sand, facing in. */
function arenaSpawn(settings: SpawnSettings, index: number): SpawnPoint {
  const angle = Math.PI + (index * 2 * Math.PI) / Math.max(1, settings.armies.length);
  return facingCenter({ x: Math.cos(angle) * ARENA.spawnRadius, z: Math.sin(angle) * ARENA.spawnRadius });
}
