/** The battlefields. Each has its own terrain shape and its own obstacles. */
export const MAP_IDS = ['meadow', 'desert', 'highlands'] as const;
export type MapId = (typeof MAP_IDS)[number];

export type ObstacleKind = 'tree' | 'rock' | 'cactus';

/** Solid man-made things. All collide as boxes (x/z footprint rotated by yaw). */
export type StructureKind = 'house' | 'hut' | 'wall' | 'tower' | 'pillar' | 'fence' | 'well';

export interface Structure {
  kind: StructureKind;
  x: number;
  z: number;
  /** Footprint along the structure's own x axis and z axis, and height. */
  width: number;
  depth: number;
  height: number;
  yaw: number;
}

function house(x: number, z: number, width: number, depth: number, yaw = 0): Structure {
  return { kind: 'house', x, z, width, depth, height: 4.2, yaw };
}

function wall(x: number, z: number, length: number, yaw = 0, height = 2.4): Structure {
  return { kind: 'wall', x, z, width: length, depth: 1, height, yaw };
}

/** Houses in one quarter of the village, mirrored into the other three. Leaves alleys of 2.5–3.5 m. */
const VILLAGE_QUARTER: [number, number, number, number][] = [
  [9, 10, 7, 6],
  [18, 10, 6, 7],
  [13, 19, 9, 5],
];
const VILLAGE_HALF = 26;
const GATE_HALF = 3.5;

/** A walled village: four gates on the roads, a square with a well, narrow alleys between houses. */
function village(): Structure[] {
  const out: Structure[] = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      for (const [x, z, w, d] of VILLAGE_QUARTER) out.push(house(x * sx, z * sz, w, d));
    }
  }
  const segment = VILLAGE_HALF - GATE_HALF;
  const middle = GATE_HALF + segment / 2;
  for (const side of [-1, 1]) {
    for (const half of [-1, 1]) {
      out.push(wall(half * middle, side * VILLAGE_HALF, segment, 0));
      out.push(wall(side * VILLAGE_HALF, half * middle, segment, Math.PI / 2));
    }
    for (const gateSide of [-1, 1]) {
      out.push({ kind: 'tower', x: side * VILLAGE_HALF, z: gateSide * (GATE_HALF + 1.5), width: 3, depth: 3, height: 6, yaw: 0 });
    }
  }
  out.push({ kind: 'well', x: 0, z: 0, width: 2.4, depth: 2.4, height: 1.2, yaw: 0 });
  return out;
}

/** A farmstead north of the road, with fenced paddocks and a few old field walls. */
function farm(): Structure[] {
  const out: Structure[] = [house(6, 34, 9, 6), house(-6, 38, 6, 5, 0.2)];
  const fence = (x: number, z: number, length: number, yaw: number): Structure => ({ kind: 'fence', x, z, width: length, depth: 0.3, height: 1.2, yaw });
  out.push(fence(0, 25, 26, 0), fence(-13, 33, 16, Math.PI / 2), fence(14, 33, 10, Math.PI / 2));
  out.push(wall(-34, -18, 16, 0.35, 1.4), wall(30, -26, 14, -0.6, 1.4), wall(-8, -42, 18, 0.1, 1.4), wall(40, 22, 12, 1.2, 1.4));
  return out;
}

/** Temple ruins in the middle of the dunes and a small cluster of adobe huts. */
function ruins(): Structure[] {
  const out: Structure[] = [];
  const pillars = 10;
  for (let i = 0; i < pillars; i++) {
    if (i === 3 || i === 7) continue;
    const a = (i / pillars) * Math.PI * 2;
    out.push({ kind: 'pillar', x: Math.cos(a) * 14, z: Math.sin(a) * 14, width: 1.3, depth: 1.3, height: i % 3 === 0 ? 2.2 : 5, yaw: a });
  }
  out.push(wall(-24, 12, 10, 0.3, 2), wall(22, -16, 12, -0.4, 2), wall(34, 24, 8, 1.1, 1.6), wall(-12, -30, 9, 1.4, 1.8));
  const hut = (x: number, z: number, size: number): Structure => ({ kind: 'hut', x, z, width: size, depth: size, height: 3, yaw: 0.3 });
  out.push(hut(-38, -30, 5), hut(-30, -38, 4.5), hut(-46, -38, 4), hut(-36, -46, 5));
  return out;
}

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
  structures: Structure[];
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
      { kind: 'tree', count: 44, scaleMin: 0.85, scaleMax: 1.25 },
      { kind: 'rock', count: 18, scaleMin: 0.6, scaleMax: 1.3 },
    ],
    scenery: ['tree'],
    sceneryCount: 120,
    structures: farm(),
  },
  desert: {
    id: 'desert',
    name: 'Sunbaked Dunes',
    hills: { amplitude: 3.4, frequencyX: 0.045, frequencyZ: 0.03 },
    ripples: { amplitude: 0.5, frequencyX: 0.11, frequencyZ: 0.21 },
    crags: 0,
    flatRadius: 22,
    inside: [
      { kind: 'cactus', count: 34, scaleMin: 0.8, scaleMax: 1.3 },
      { kind: 'rock', count: 22, scaleMin: 0.8, scaleMax: 1.8 },
    ],
    scenery: ['cactus', 'rock'],
    sceneryCount: 80,
    structures: ruins(),
  },
  highlands: {
    id: 'highlands',
    name: 'Rocky Highlands',
    hills: { amplitude: 3.2, frequencyX: 0.06, frequencyZ: 0.08 },
    ripples: { amplitude: 1.3, frequencyX: 0.19, frequencyZ: 0.16 },
    crags: 1.6,
    flatRadius: 36,
    inside: [
      { kind: 'rock', count: 60, scaleMin: 0.8, scaleMax: 2.4 },
      { kind: 'tree', count: 8, scaleMin: 0.8, scaleMax: 1.1 },
    ],
    scenery: ['rock', 'rock', 'tree'],
    sceneryCount: 110,
    structures: village(),
  },
};

export function isMapId(value: unknown): value is MapId {
  return typeof value === 'string' && (MAP_IDS as readonly string[]).includes(value);
}

/** Picks a map from a 0..1 random number. */
export function mapFromRandom(random: number): MapId {
  return MAP_IDS[Math.min(MAP_IDS.length - 1, Math.floor(random * MAP_IDS.length))] ?? 'meadow';
}
