import { ARENA_MAP } from './campaign/arena.ts';
/** The battlefields offered for battles. Each has its own terrain shape, its own obstacles and its own way of starting. */
export const MAP_IDS = ['meadow', 'castle', 'city', 'north'] as const;
/** Places only the story goes to; never offered (or picked at random) for a battle. */
export const CAMPAIGN_MAP_IDS = ['forest', 'village', 'river', 'fortress', 'arena', 'steppe'] as const;
export type MapId = (typeof MAP_IDS)[number] | (typeof CAMPAIGN_MAP_IDS)[number];
export const ALL_MAP_IDS: readonly MapId[] = [...MAP_IDS, ...CAMPAIGN_MAP_IDS];

export type ObstacleKind = 'tree' | 'rock' | 'cactus';

/** Solid man-made things. All collide as boxes (x/z footprint rotated by yaw). */
export type StructureKind = 'house' | 'hut' | 'wall' | 'tower' | 'pillar' | 'fence' | 'well' | 'keep' | 'temple' | 'stall' | 'barrel';

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

/**
 * How armies are placed: `open` spreads them on a circle; `siege` puts one army (team 0) inside
 * the castle to hold the gate and everyone else outside; `city` starts them in the squares at
 * the ends of the avenues.
 */
export type MapLayout = 'open' | 'siege' | 'city' | 'arena';

function house(x: number, z: number, width: number, depth: number, yaw = 0, height = 4.2): Structure {
  return { kind: 'house', x, z, width, depth, height, yaw };
}

function wall(x: number, z: number, length: number, yaw = 0, height = 2.4, thickness = 1): Structure {
  return { kind: 'wall', x, z, width: length, depth: thickness, height, yaw };
}

function tower(x: number, z: number, size: number, height: number): Structure {
  return { kind: 'tower', x, z, width: size, depth: size, height, yaw: 0 };
}

/** A farmstead north of the road, with fenced paddocks and a few old field walls. */
function farm(): Structure[] {
  const out: Structure[] = [house(6, 34, 9, 6), house(-6, 38, 6, 5, 0.2)];
  const fence = (x: number, z: number, length: number, yaw: number): Structure => ({ kind: 'fence', x, z, width: length, depth: 0.3, height: 1.2, yaw });
  out.push(fence(0, 25, 26, 0), fence(-13, 33, 16, Math.PI / 2), fence(14, 33, 10, Math.PI / 2));
  out.push(wall(-34, -18, 16, 0.35, 1.4), wall(30, -26, 14, -0.6, 1.4), wall(-8, -42, 18, 0.1, 1.4), wall(40, 22, 12, 1.2, 1.4));
  return out;
}

/**
 * The castle: a tall, compact fortress on an island. A shallow moat runs all the way round and a
 * bridge crosses it to the only gate, facing west. Inside: a towering keep, barracks, stables,
 * a smithy, market stalls and a well.
 */
export const CASTLE = {
  centerX: 56,
  half: 22,
  west: 34,
  east: 78,
  halfDepth: 22,
  gateHalf: 3,
  wallHeight: 8,
  wallThickness: 2.4,
  towerSize: 7,
  towerHeight: 14,
  gateTowerHeight: 15,
  /** The moat: a square ring of water around the walls, crossed by the bridge. */
  moatInner: 26,
  moatOuter: 35,
  bridgeHalf: 3.5,
} as const;

function castle(): Structure[] {
  return [...castleWalls(), ...castleField()];
}

/** Wooden barricades in the field, cover for the attackers' approach. */
function castleField(): Structure[] {
  const fence = (x: number, z: number, length: number, yaw: number): Structure => ({ kind: 'fence', x, z, width: length, depth: 0.4, height: 1.4, yaw });
  return [fence(-6, 14, 10, 0.3), fence(-6, -14, 10, -0.3), fence(-30, 30, 12, 0.8), fence(-30, -30, 12, -0.8), fence(8, 42, 10, 0), fence(8, -42, 10, 0)];
}

function castleWalls(): Structure[] {
  const { centerX, half, west, gateHalf, wallHeight: h, wallThickness: t, towerSize, towerHeight } = CASTLE;
  const east = centerX + half;
  const out: Structure[] = [
    wall(centerX, -half, half * 2, 0, h, t),
    wall(centerX, half, half * 2, 0, h, t),
    wall(east, 0, half * 2, Math.PI / 2, h, t),
  ];
  const westPiece = half - gateHalf;
  for (const side of [-1, 1]) {
    out.push(wall(west, side * (gateHalf + westPiece / 2), westPiece, Math.PI / 2, h, t));
    out.push(tower(west, side * (gateHalf + towerSize / 2 - 0.5), towerSize, CASTLE.gateTowerHeight));
    out.push(tower(west, side * half, towerSize, towerHeight));
    out.push(tower(east, side * half, towerSize, towerHeight));
  }
  // Inside the walls.
  out.push({ kind: 'keep', x: centerX + 10, z: 0, width: 13, depth: 13, height: 20, yaw: 0 });
  out.push(house(centerX - 2, 16, 14, 5, 0, 7), house(centerX - 2, -16, 14, 5, 0, 6));
  out.push(house(centerX + 14, 15, 5, 6, Math.PI / 2, 6), house(centerX + 14, -15, 5, 6, Math.PI / 2, 6));
  out.push({ kind: 'hut', x: west + 6, z: -15, width: 4, depth: 4, height: 3.5, yaw: 0 });
  out.push({ kind: 'well', x: west + 7, z: 11, width: 2.4, depth: 2.4, height: 1.2, yaw: 0 });
  out.push({ kind: 'stall', x: centerX - 6, z: 8, width: 3, depth: 2, height: 2.6, yaw: 0 });
  out.push({ kind: 'stall', x: centerX - 1, z: 8, width: 3, depth: 2, height: 2.6, yaw: 0 });
  out.push({ kind: 'stall', x: centerX - 6, z: -8, width: 3, depth: 2, height: 2.6, yaw: Math.PI });
  out.push({ kind: 'pillar', x: centerX + 2, z: 4, width: 1.4, depth: 1.4, height: 4, yaw: 0 });
  out.push({ kind: 'pillar', x: centerX + 2, z: -4, width: 1.4, depth: 1.4, height: 4, yaw: 0 });
  for (const [x, z] of [[west + 4, -6], [west + 4.8, -7.2], [east - 4, 6], [east - 5, 7]] as const) out.push({ kind: 'barrel', x, z, width: 1, depth: 1, height: 1.1, yaw: 0 });
  return out;
}

/** Is this point in the castle's moat? The bridge to the gate is dry. */
export function inMoat(x: number, z: number): boolean {
  const dx = Math.abs(x - CASTLE.centerX);
  const dz = Math.abs(z);
  const ring = Math.max(dx, dz);
  if (ring < CASTLE.moatInner || ring > CASTLE.moatOuter) return false;
  const onBridge = x < CASTLE.centerX && dz < CASTLE.bridgeHalf;
  return !onBridge;
}

/** City streets: narrow streets between tall houses, a wider avenue through the middle each way. */
export const CITY = {
  lines: [-72, -54, -36, -18, 0, 18, 36, 54, 72] as const,
  avenueWidth: 10,
  streetWidth: 5,
  alley: 2.2,
  wallAt: 81,
  /** The forum: one open square where the avenues cross. */
  forumHalf: 20,
  spawnDistance: 63,
  minHeight: 9,
  extraHeight: 6,
} as const;

function streetWidth(line: number): number {
  return line === 0 ? CITY.avenueWidth : CITY.streetWidth;
}

/** Deterministic 0..1 noise, so the city looks the same every time. */
function cityNoise(a: number, b: number): number {
  const n = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

/** Splits a block into narrow, tall houses with thin alleys between them. */
function blockHouses(x0: number, x1: number, z0: number, z1: number, i: number, j: number): Structure[] {
  const out: Structure[] = [];
  const along = (from: number, to: number): [number, number][] => {
    const length = to - from;
    if (length < 9) return [[from, to]];
    const half = (length - CITY.alley) / 2;
    return [[from, from + half], [to - half, to]];
  };
  along(x0, x1).forEach(([a, b], xi) => {
    along(z0, z1).forEach(([c, d], zi) => {
      const height = CITY.minHeight + cityNoise(i * 3 + xi, j * 3 + zi) * CITY.extraHeight;
      out.push(house((a + b) / 2, (c + d) / 2, b - a, d - c, 0, height));
    });
  });
  return out;
}

/** Blocks of tall, narrow houses between the streets. The forum and the squares at the avenue ends stay open. */
function city(): Structure[] {
  const out: Structure[] = [];
  const { lines } = CITY;
  const last = lines.length - 2;
  for (let i = 0; i <= last; i++) {
    for (let j = 0; j <= last; j++) {
      const x0 = (lines[i] ?? 0) + streetWidth(lines[i] ?? 0) / 2;
      const x1 = (lines[i + 1] ?? 0) - streetWidth(lines[i + 1] ?? 0) / 2;
      const z0 = (lines[j] ?? 0) + streetWidth(lines[j] ?? 0) / 2;
      const z1 = (lines[j + 1] ?? 0) - streetWidth(lines[j + 1] ?? 0) / 2;
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      if (Math.max(Math.abs(cx), Math.abs(cz)) < CITY.forumHalf) continue;
      const outerRing = i === 0 || j === 0 || i === last || j === last;
      const besideAvenue = Math.abs(cx) < CITY.forumHalf || Math.abs(cz) < CITY.forumHalf;
      if (outerRing && besideAvenue) continue;
      out.push(...blockHouses(x0, x1, z0, z1, i, j));
    }
  }
  // The forum: a temple on its north side, a statue on a column in the middle.
  out.push({ kind: 'temple', x: 0, z: 13, width: 14, depth: 9, height: 9, yaw: 0 });
  out.push({ kind: 'pillar', x: 9, z: -9, width: 1.6, depth: 1.6, height: 6, yaw: 0 });
  out.push({ kind: 'pillar', x: -9, z: -9, width: 1.6, depth: 1.6, height: 6, yaw: 0 });
  out.push({ kind: 'well', x: 0, z: -6, width: 3, depth: 3, height: 1.2, yaw: 0 });
  const side = CITY.wallAt;
  for (const s of [-1, 1]) {
    out.push(wall(0, s * side, side * 2 + 4, 0, 8, 2), wall(s * side, 0, side * 2 + 4, Math.PI / 2, 8, 2));
  }
  return out;
}

/** A frozen lake or pond: an ellipse of flat, slippery ice. */
export interface IceSheet {
  x: number;
  z: number;
  radiusX: number;
  radiusZ: number;
}

/**
 * The frozen north: a Viking village of longhouses and huts behind a broken palisade, rune
 * stones, and a big frozen lake off to one side of the field (with a small pond on the other).
 */
/** Where the story's battles in the north put their armies. */
export const NORTH_POINTS = {
  outpostApproach: { x: -62, z: -52, yaw: Math.PI / 4 },
  outpost: { x: 47, z: 29, yaw: -Math.PI * 0.75 },
  camp: { x: -30, z: -30, yaw: Math.PI / 4 },
  raidNorth: { x: -10, z: 60, yaw: Math.PI },
  raidEast: { x: 62, z: -20, yaw: -Math.PI / 2 },
} satisfies Record<string, MapPoint>;

/** The open field on the way back south: the legion and Hrolf's Vikings against the Mongol riders. */
export const STEPPE_POINTS = {
  legion: { x: 0, z: -60, yaw: 0 },
  vikings: { x: -12, z: -60, yaw: 0 },
  riders: { x: 0, z: 72, yaw: Math.PI },
  flank: { x: 82, z: -8, yaw: -Math.PI / 2 },
} satisfies Record<string, MapPoint>;

/**
 * The capital (the city map): the street Cassian fights his way up to Livia, and where the
 * brothers' armies meet at the end.
 */
export const CAPITAL_POINTS = {
  gate: { x: 36, z: -62, yaw: 0 },
  street: { x: 36, z: -30, yaw: Math.PI },
  forum: { x: 0, z: 2, yaw: Math.PI },
  forumWest: { x: -12, z: 2, yaw: Math.PI },
  forumEast: { x: 12, z: 2, yaw: Math.PI },
  /** Inside the broken walls, on the open avenues, a short charge from the forum. */
  southGate: { x: 0, z: -34, yaw: 0 },
  /** The Greek feast (the city map standing in for their capital): the Greeks in the middle, the three peoples all round. */
  feast: { x: 0, z: 1, yaw: Math.PI },
  feastSouth: { x: 0, z: -30, yaw: 0 },
  feastWest: { x: -28, z: 0, yaw: Math.PI / 2 },
  feastEast: { x: 28, z: 0, yaw: -Math.PI / 2 },
  feastNorth: { x: 0, z: 30, yaw: Math.PI },
  eastGate: { x: 34, z: 0, yaw: -Math.PI / 2 },
} satisfies Record<string, MapPoint>;

export const NORTH = {
  ice: [
    { x: -26, z: 34, radiusX: 30, radiusZ: 17 },
    { x: 42, z: -40, radiusX: 13, radiusZ: 10 },
  ] satisfies IceSheet[],
  /** The ice lies this far below the snow around it, with a bank this wide. */
  iceLevel: -0.35,
  bank: 4,
} as const;

function northVillage(): Structure[] {
  const out: Structure[] = [];
  const longhouse = (x: number, z: number, yaw: number, length = 13): Structure => ({ kind: 'house', x, z, width: 5.5, depth: length, height: 4.6, yaw });
  out.push(longhouse(40, 26, 0.1), longhouse(50, 40, 1.45), longhouse(30, 44, -0.25, 11));
  const hut = (x: number, z: number): Structure => ({ kind: 'hut', x, z, width: 3.2, depth: 3.2, height: 2.6, yaw: 0.4 });
  out.push(hut(52, 18), hut(22, 32));
  const fence = (x: number, z: number, length: number, yaw: number): Structure => ({ kind: 'fence', x, z, width: length, depth: 0.5, height: 2.2, yaw });
  out.push(fence(22, 18, 14, 0.5), fence(36, 12, 12, -0.15), fence(60, 30, 12, Math.PI / 2), fence(44, 54, 14, 0.1));
  const runeStone = (x: number, z: number, yaw: number): Structure => ({ kind: 'pillar', x, z, width: 1.1, depth: 0.5, height: 2.6, yaw });
  out.push(runeStone(-6, -30, 0.3), runeStone(14, 12, -0.5), runeStone(-46, -8, 1.1));
  out.push(wall(-38, -44, 14, 0.5, 1.2), wall(10, -60, 12, -0.3, 1.2));
  return out;
}

/** A river along the z axis at `x`, crossed by a bridge where |z| < `bridgeHalf`. */
export interface River {
  x: number;
  halfWidth: number;
  bridgeHalf: number;
}

/** A named place where a story battle puts an army. */
export interface MapPoint {
  x: number;
  z: number;
  yaw: number;
}

const EAST = Math.PI / 2;
const WEST = -Math.PI / 2;
const NORTH_FACING = 0;
const SOUTH_FACING = Math.PI;

/**
 * The forest road: thick woods on both sides of a winding road, a camp clearing in the east.
 * Used by day for the bandits and by night for the ambush.
 */
export const FOREST_POINTS = {
  arrival: { x: -40, z: -2, yaw: EAST },
  // The bandits are already on the villagers, further up the road than Cassian.
  bandits: { x: 6, z: 0, yaw: WEST },
  villagers: { x: 2, z: 1, yaw: EAST },
  column: { x: 0, z: 0, yaw: EAST },
  // Close by in the trees: the scene before has already shown them coming.
  ambushNorth: { x: 6, z: 24, yaw: SOUTH_FACING },
  ambushSouth: { x: -6, z: -24, yaw: NORTH_FACING },
} satisfies Record<string, MapPoint>;

/** A Roman village of plastered houses round a small square, a road coming in from the west. */
export const VILLAGE_POINTS = {
  arrival: { x: -30, z: 0, yaw: EAST },
  /** Galba's men in the middle of the village, back to back; the raiders all round them. */
  defenders: { x: 8, z: -2, yaw: WEST },
  raidersNorth: { x: 8, z: 12, yaw: Math.PI },
  raidersSouth: { x: 6, z: -14, yaw: 0 },
  raidersEast: { x: 22, z: -1, yaw: WEST },
} satisfies Record<string, MapPoint>;

function village(): Structure[] {
  const out: Structure[] = [];
  const homes: [number, number, number, number, number][] = [
    [-14, 16, 8, 6, 0.1], [0, 20, 7, 6, -0.05], [14, 17, 8, 5, 0.12], [26, 12, 6, 6, 0.3],
    [-14, -16, 7, 6, -0.1], [2, -20, 8, 6, 0.08], [16, -17, 7, 5, -0.1], [30, -6, 6, 7, 0.2],
  ];
  for (const [x, z, w, d, yaw] of homes) out.push(house(x, z, w, d, yaw, 4.4));
  out.push({ kind: 'well', x: 6, z: 4, width: 2.4, depth: 2.4, height: 1.2, yaw: 0 });
  out.push({ kind: 'temple', x: 36, z: 22, width: 9, depth: 12, height: 6, yaw: 0.2 });
  const fence = (x: number, z: number, length: number, yaw: number): Structure => ({ kind: 'fence', x, z, width: length, depth: 0.3, height: 1.2, yaw });
  out.push(fence(-30, 22, 14, 0.2), fence(-30, -22, 14, -0.2), fence(44, -24, 12, 0.5));
  out.push({ kind: 'stall', x: -4, z: 8, width: 3, depth: 2, height: 2.6, yaw: 0 });
  return out;
}

/** The river crossing: the legion holds the east end of the bridge while the carts cross. */
export const RIVER_POINTS = {
  bridgehead: { x: 14, z: 0, yaw: EAST },
  firstWave: { x: 78, z: 6, yaw: WEST },
  secondWave: { x: 66, z: 58, yaw: WEST - 0.6 },
} satisfies Record<string, MapPoint>;

export const RIVER: River = { x: 0, halfWidth: 7, bridgeHalf: 3.5 };

function riverBanks(): Structure[] {
  const out: Structure[] = [];
  // Bridge railings, and an old toll house at the west end.
  for (const side of [-1, 1]) out.push({ kind: 'fence', x: 0, z: side * (RIVER.bridgeHalf + 0.2), width: RIVER.halfWidth * 2 + 2, depth: 0.3, height: 1.1, yaw: 0 });
  out.push(house(-18, 10, 6, 5, 0.1, 4));
  out.push(wall(30, 30, 14, 0.7, 1.4), wall(34, -26, 12, -0.5, 1.4));
  return out;
}

export function inRiver(river: River, x: number, z: number): boolean {
  return Math.abs(x - river.x) < river.halfWidth && Math.abs(z) >= river.bridgeHalf;
}

/** The northern fortress: the castle under snow, where the horde is broken. */
export const FORTRESS_POINTS = {
  legion: { x: -8, z: 0, yaw: WEST },
  leftWing: { x: -6, z: 30, yaw: WEST },
  rightWing: { x: -6, z: -30, yaw: WEST },
  horde: { x: -86, z: 0, yaw: EAST },
} satisfies Record<string, MapPoint>;

export interface MapDefinition {
  id: MapId;
  name: string;
  layout: MapLayout;
  /** A river with a bridge. */
  river?: River;
  /** Places story battles put armies; kept clear of trees and rocks. */
  points?: Record<string, MapPoint>;
  /** Frozen water: flat and slippery. */
  ice?: readonly IceSheet[];
  /** Rolling hills: amplitude and frequency of the two sine layers. */
  hills: { amplitude: number; frequencyX: number; frequencyZ: number };
  ripples: { amplitude: number; frequencyX: number; frequencyZ: number };
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
    layout: 'open',
    hills: { amplitude: 2.6, frequencyX: 0.07, frequencyZ: 0.06 },
    ripples: { amplitude: 0.9, frequencyX: 0.17, frequencyZ: 0.13 },
    flatRadius: 26,
    inside: [
      { kind: 'tree', count: 44, scaleMin: 0.85, scaleMax: 1.25 },
      { kind: 'rock', count: 18, scaleMin: 0.6, scaleMax: 1.3 },
    ],
    scenery: ['tree'],
    sceneryCount: 120,
    structures: farm(),
  },
  castle: {
    id: 'castle',
    name: 'Castle Siege',
    layout: 'siege',
    hills: { amplitude: 1.4, frequencyX: 0.05, frequencyZ: 0.07 },
    ripples: { amplitude: 0.4, frequencyX: 0.15, frequencyZ: 0.12 },
    // The castle stands on level ground.
    flatRadius: 110,
    inside: [
      { kind: 'tree', count: 30, scaleMin: 0.85, scaleMax: 1.3 },
      { kind: 'rock', count: 14, scaleMin: 0.6, scaleMax: 1.2 },
    ],
    scenery: ['tree', 'tree', 'rock'],
    sceneryCount: 120,
    structures: castle(),
  },
  north: {
    id: 'north',
    name: 'The Frozen North',
    layout: 'open',
    hills: { amplitude: 3.4, frequencyX: 0.06, frequencyZ: 0.075 },
    ripples: { amplitude: 1.0, frequencyX: 0.16, frequencyZ: 0.12 },
    flatRadius: 22,
    ice: NORTH.ice,
    points: NORTH_POINTS,
    inside: [
      { kind: 'tree', count: 50, scaleMin: 0.9, scaleMax: 1.45 },
      { kind: 'rock', count: 26, scaleMin: 0.6, scaleMax: 1.6 },
    ],
    scenery: ['tree', 'tree', 'rock'],
    sceneryCount: 140,
    structures: northVillage(),
  },
  forest: {
    id: 'forest',
    name: 'The Forest Road',
    layout: 'open',
    hills: { amplitude: 2.2, frequencyX: 0.08, frequencyZ: 0.06 },
    ripples: { amplitude: 0.7, frequencyX: 0.18, frequencyZ: 0.14 },
    flatRadius: 18,
    points: FOREST_POINTS,
    inside: [
      { kind: 'tree', count: 210, scaleMin: 0.9, scaleMax: 1.5 },
      { kind: 'rock', count: 24, scaleMin: 0.6, scaleMax: 1.4 },
    ],
    scenery: ['tree'],
    sceneryCount: 220,
    structures: [],
  },
  village: {
    id: 'village',
    name: 'The Village',
    layout: 'open',
    hills: { amplitude: 1.6, frequencyX: 0.06, frequencyZ: 0.07 },
    ripples: { amplitude: 0.5, frequencyX: 0.16, frequencyZ: 0.12 },
    flatRadius: 40,
    points: VILLAGE_POINTS,
    inside: [
      { kind: 'tree', count: 34, scaleMin: 0.85, scaleMax: 1.3 },
      { kind: 'rock', count: 10, scaleMin: 0.6, scaleMax: 1.2 },
    ],
    scenery: ['tree'],
    sceneryCount: 120,
    structures: village(),
  },
  river: {
    id: 'river',
    name: 'The Bridge',
    layout: 'open',
    hills: { amplitude: 1.8, frequencyX: 0.06, frequencyZ: 0.05 },
    ripples: { amplitude: 0.5, frequencyX: 0.15, frequencyZ: 0.12 },
    flatRadius: 30,
    river: RIVER,
    points: RIVER_POINTS,
    inside: [
      { kind: 'tree', count: 50, scaleMin: 0.85, scaleMax: 1.35 },
      { kind: 'rock', count: 16, scaleMin: 0.6, scaleMax: 1.3 },
    ],
    scenery: ['tree'],
    sceneryCount: 130,
    structures: riverBanks(),
  },
  fortress: {
    id: 'fortress',
    name: 'The Northern Fortress',
    layout: 'siege',
    hills: { amplitude: 1.4, frequencyX: 0.05, frequencyZ: 0.07 },
    ripples: { amplitude: 0.4, frequencyX: 0.15, frequencyZ: 0.12 },
    flatRadius: 110,
    points: FORTRESS_POINTS,
    inside: [
      { kind: 'tree', count: 18, scaleMin: 0.9, scaleMax: 1.4 },
      { kind: 'rock', count: 12, scaleMin: 0.6, scaleMax: 1.3 },
    ],
    scenery: ['tree', 'tree', 'rock'],
    sceneryCount: 120,
    structures: castleWalls(),
  },
  city: {
    id: 'city',
    name: 'The City',
    layout: 'city',
    hills: { amplitude: 0.3, frequencyX: 0.05, frequencyZ: 0.05 },
    ripples: { amplitude: 0.1, frequencyX: 0.1, frequencyZ: 0.1 },
    flatRadius: 110,
    inside: [],
    scenery: ['tree'],
    sceneryCount: 90,
    structures: city(),
  },
  arena: { id: 'arena', ...ARENA_MAP },
  steppe: {
    id: 'steppe',
    name: 'The Open Field',
    layout: 'open',
    hills: { amplitude: 1.6, frequencyX: 0.035, frequencyZ: 0.03 },
    ripples: { amplitude: 0.4, frequencyX: 0.12, frequencyZ: 0.1 },
    flatRadius: 60,
    points: STEPPE_POINTS,
    // Open grass where riders can ride: a few lone trees and stones far apart, nothing else.
    inside: [
      { kind: 'tree', count: 6, scaleMin: 1.0, scaleMax: 1.4 },
      { kind: 'rock', count: 6, scaleMin: 0.6, scaleMax: 1.0 },
    ],
    scenery: ['tree', 'tree', 'rock'],
    sceneryCount: 120,
    structures: [],
  },
};

export function isMapId(value: unknown): value is MapId {
  return typeof value === 'string' && (MAP_IDS as readonly string[]).includes(value);
}

/** Picks a map from a 0..1 random number, among `choices` (all maps by default). */
export function mapFromRandom(random: number, choices: readonly MapId[] = MAP_IDS): MapId {
  return choices[Math.min(choices.length - 1, Math.floor(random * choices.length))] ?? 'meadow';
}

/** What the player or lobby picks: a map, or leave it to chance. */
export type MapChoice = MapId | 'random';

export function isMapChoice(value: unknown): value is MapChoice {
  return value === 'random' || isMapId(value);
}
