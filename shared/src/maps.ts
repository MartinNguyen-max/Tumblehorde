/** The battlefields. Each has its own terrain shape and its own obstacles. */
export const MAP_IDS = ['meadow', 'desert', 'highlands'] as const;
export type MapId = (typeof MAP_IDS)[number];

export type ObstacleKind = 'tree' | 'rock' | 'cactus';

export interface MapDefinition {
  id: MapId;
  name: string;
  /** Rolling hills: amplitude and frequency of the two sine layers. */
  hills: { amplitude: number; frequencyX: number; frequencyZ: number };
  ripples: { amplitude: number; frequencyX: number; frequencyZ: number };
  /** Extra sharp bumps for rocky ground (0 for none). */
  crags: number;
  flatRadius: number;
  /** Obstacles inside the playable area. */
  inside: { kind: ObstacleKind; count: number; scaleMin: number; scaleMax: number }[];
  /** Scenery outside the map edge (no collision). */
  scenery: ObstacleKind[];
  sceneryCount: number;
}

export const MAPS: Record<MapId, MapDefinition> = {
  meadow: {
    id: 'meadow',
    name: 'Green Meadow',
    hills: { amplitude: 2.6, frequencyX: 0.07, frequencyZ: 0.06 },
    ripples: { amplitude: 0.9, frequencyX: 0.17, frequencyZ: 0.13 },
    crags: 0,
    flatRadius: 26,
    inside: [
      { kind: 'tree', count: 26, scaleMin: 0.85, scaleMax: 1.25 },
      { kind: 'rock', count: 12, scaleMin: 0.6, scaleMax: 1.3 },
    ],
    scenery: ['tree'],
    sceneryCount: 90,
  },
  desert: {
    id: 'desert',
    name: 'Sunbaked Dunes',
    hills: { amplitude: 3.4, frequencyX: 0.045, frequencyZ: 0.03 },
    ripples: { amplitude: 0.5, frequencyX: 0.11, frequencyZ: 0.21 },
    crags: 0,
    flatRadius: 22,
    inside: [
      { kind: 'cactus', count: 22, scaleMin: 0.8, scaleMax: 1.3 },
      { kind: 'rock', count: 14, scaleMin: 0.8, scaleMax: 1.8 },
    ],
    scenery: ['cactus', 'rock'],
    sceneryCount: 60,
  },
  highlands: {
    id: 'highlands',
    name: 'Rocky Highlands',
    hills: { amplitude: 3.2, frequencyX: 0.06, frequencyZ: 0.08 },
    ripples: { amplitude: 1.3, frequencyX: 0.19, frequencyZ: 0.16 },
    crags: 1.6,
    flatRadius: 20,
    inside: [
      { kind: 'rock', count: 30, scaleMin: 0.8, scaleMax: 2.2 },
      { kind: 'tree', count: 12, scaleMin: 0.8, scaleMax: 1.1 },
    ],
    scenery: ['rock', 'tree'],
    sceneryCount: 80,
  },
};

export function isMapId(value: unknown): value is MapId {
  return typeof value === 'string' && (MAP_IDS as readonly string[]).includes(value);
}

/** Picks a map from a 0..1 random number. */
export function mapFromRandom(random: number): MapId {
  return MAP_IDS[Math.min(MAP_IDS.length - 1, Math.floor(random * MAP_IDS.length))] ?? 'meadow';
}
