import { MATCH } from '../config.ts';
import type { MapDefinition, MapId, Structure } from '../maps.ts';
import type { ArmySetup, MatchSettings } from '../types.ts';

/**
 * The Colosseum: a round sand floor inside a high podium wall. Fighters start on a ring facing
 * the middle; whoever goes down is out (no getting back up in the arena).
 */

export const ARENA = {
  /** Radius of the sand floor, to the inside of the podium wall. */
  floorRadius: 17,
  wallSegments: 28,
  wallHeight: 3.4,
  wallThickness: 1.4,
  spawnRadius: 9,
  /** Seconds the bots hold before charging: arena fighters do not need to form up. */
  prepareTime: 3,
  /** Battles in the arena are small; the army size setting is not used. */
  armySize: 15,
} as const;

/** The podium wall as a ring of straight segments. */
export function arenaWall(): Structure[] {
  const { floorRadius, wallSegments, wallHeight, wallThickness } = ARENA;
  const radius = floorRadius + wallThickness / 2;
  const length = 2 * radius * Math.tan(Math.PI / wallSegments) + 0.2;
  return Array.from({ length: wallSegments }, (_, i) => {
    const a = (i / wallSegments) * Math.PI * 2;
    return {
      kind: 'wall' as const,
      x: Math.sin(a) * radius,
      z: Math.cos(a) * radius,
      width: length,
      depth: wallThickness,
      height: wallHeight,
      yaw: a,
    };
  });
}

export const ARENA_MAP: Omit<MapDefinition, 'id'> = {
  name: 'The Arena',
  layout: 'arena',
  hills: { amplitude: 0, frequencyX: 0, frequencyZ: 0 },
  ripples: { amplitude: 0, frequencyX: 0, frequencyZ: 0 },
  flatRadius: 110,
  inside: [],
  scenery: [],
  sceneryCount: 0,
  structures: arenaWall(),
};

/** How strong a fighter is: hit points and a multiplier on the damage they deal. */
export interface FighterKit {
  hp: number;
  damage: number;
  /** Multiplier on how much a raised shield blocks. */
  block: number;
}

export interface ArenaFighter {
  name: string;
  kit: FighterKit;
}

/**
 * Settings for an arena fight: the player as a lone commander (army 0) against bot fighters,
 * each a one-man army, everyone for themselves.
 */
export function arenaSettings(player: FighterKit, opponents: readonly ArenaFighter[], seed: number): MatchSettings {
  const you: ArmySetup = { name: 'You', team: 0, isBot: false, soldiers: 0, kit: player };
  const others: ArmySetup[] = opponents.map((o, i) => ({ name: o.name, team: i + 1, isBot: true, soldiers: 1, kit: o.kit }));
  return { mode: 'ffa', armySize: ARENA.armySize, armies: [you, ...others], seed, map: 'arena', arena: true };
}

/** How long bots form up before they march: short in the arena, the usual time elsewhere. */
export function prepareTimeFor(map: MapId): number {
  return map === 'arena' ? ARENA.prepareTime : MATCH.prepareTime;
}
