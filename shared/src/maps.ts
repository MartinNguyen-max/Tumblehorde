/** The battlefields. Each has its own terrain shape, its own obstacles and its own way of starting. */
export const MAP_IDS = ['meadow', 'castle', 'city'] as const;
export type MapId = (typeof MAP_IDS)[number];

export type ObstacleKind = 'tree' | 'rock' | 'cactus';

/** Solid man-made things. All collide as boxes (x/z footprint rotated by yaw). */
export type StructureKind = 'house' | 'hut' | 'wall' | 'tower' | 'pillar' | 'fence' | 'well' | 'keep' | 'temple';

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
export type MapLayout = 'open' | 'siege' | 'city';

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

/** The castle: a square curtain wall with one gate facing west, towers, a keep and barracks. */
export const CASTLE = {
  west: 30,
  east: 92,
  halfDepth: 32,
  gateHalf: 3.5,
  wallHeight: 5.5,
  wallThickness: 2.2,
  towerSize: 6,
  towerHeight: 8.5,
} as const;

function castle(): Structure[] {
  const { west, east, halfDepth, gateHalf, wallHeight: h, wallThickness: t, towerSize, towerHeight } = CASTLE;
  const length = east - west;
  const midX = (west + east) / 2;
  const out: Structure[] = [
    wall(midX, -halfDepth, length, 0, h, t),
    wall(midX, halfDepth, length, 0, h, t),
    wall(east, 0, halfDepth * 2, Math.PI / 2, h, t),
  ];
  const westPiece = halfDepth - gateHalf;
  for (const side of [-1, 1]) {
    out.push(wall(west, side * (gateHalf + westPiece / 2), westPiece, Math.PI / 2, h, t));
    out.push(tower(west, side * (gateHalf + towerSize / 2), towerSize, towerHeight + 1));
    out.push(tower(west, side * halfDepth, towerSize, towerHeight));
    out.push(tower(east, side * halfDepth, towerSize, towerHeight));
  }
  out.push({ kind: 'keep', x: 72, z: 0, width: 16, depth: 16, height: 12, yaw: 0 });
  out.push(house(60, 24, 16, 6, 0, 4.6), house(60, -24, 16, 6, 0, 4.6));
  out.push({ kind: 'well', x: 46, z: 14, width: 2.4, depth: 2.4, height: 1.2, yaw: 0 });
  // Wooden barricades in the field, cover for the attackers' approach.
  const fence = (x: number, z: number, length: number, yaw: number): Structure => ({ kind: 'fence', x, z, width: length, depth: 0.4, height: 1.4, yaw });
  out.push(fence(-6, 14, 10, 0.3), fence(-6, -14, 10, -0.3), fence(-30, 30, 12, 0.8), fence(-30, -30, 12, -0.8), fence(10, 40, 10, 0));
  return out;
}

/** City streets: avenues through the middle are wide, side streets narrow. */
export const CITY = {
  lines: [-72, -48, -24, 0, 24, 48, 72] as const,
  avenueWidth: 14,
  streetWidth: 6,
  alley: 3,
  wallAt: 80,
  /** The forum: an open square where the avenues cross. */
  forumHalf: 21,
  spawnDistance: 64,
} as const;

function streetWidth(line: number): number {
  return line === 0 ? CITY.avenueWidth : CITY.streetWidth;
}

/** Deterministic 0..1 noise for a block, so the city looks the same every time. */
function blockNoise(i: number, j: number): number {
  const n = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

/** Blocks of houses between the streets. The forum and the squares at the avenue ends stay open. */
function city(): Structure[] {
  const out: Structure[] = [];
  const { lines } = CITY;
  for (let i = 0; i < lines.length - 1; i++) {
    for (let j = 0; j < lines.length - 1; j++) {
      const x0 = (lines[i] ?? 0) + streetWidth(lines[i] ?? 0) / 2;
      const x1 = (lines[i + 1] ?? 0) - streetWidth(lines[i + 1] ?? 0) / 2;
      const z0 = (lines[j] ?? 0) + streetWidth(lines[j] ?? 0) / 2;
      const z1 = (lines[j + 1] ?? 0) - streetWidth(lines[j + 1] ?? 0) / 2;
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      if (Math.max(Math.abs(cx), Math.abs(cz)) < CITY.forumHalf) continue;
      const outerRing = i === 0 || j === 0 || i === lines.length - 2 || j === lines.length - 2;
      const besideAvenue = Math.abs(cx) < CITY.forumHalf || Math.abs(cz) < CITY.forumHalf;
      if (outerRing && besideAvenue) continue;
      const noise = blockNoise(i, j);
      const height = 5 + noise * 4;
      const w = x1 - x0;
      const d = z1 - z0;
      // Split each block in two along its longer side, with an alley between the halves.
      if (w >= d) {
        const half = (w - CITY.alley) / 2;
        out.push(house(x0 + half / 2, cz, half, d, 0, height), house(x1 - half / 2, cz, half, d, 0, height + 1 - noise * 2));
      } else {
        const half = (d - CITY.alley) / 2;
        out.push(house(cx, z0 + half / 2, w, half, 0, height), house(cx, z1 - half / 2, w, half, 0, height + 1 - noise * 2));
      }
    }
  }
  // The forum: a temple on its north side, a statue on a column in the middle.
  out.push({ kind: 'temple', x: 0, z: 14, width: 14, depth: 9, height: 7, yaw: 0 });
  out.push({ kind: 'pillar', x: 9, z: -9, width: 1.6, depth: 1.6, height: 5, yaw: 0 });
  out.push({ kind: 'pillar', x: -9, z: -9, width: 1.6, depth: 1.6, height: 5, yaw: 0 });
  out.push({ kind: 'well', x: 0, z: -6, width: 3, depth: 3, height: 1.2, yaw: 0 });
  const side = CITY.wallAt;
  for (const s of [-1, 1]) {
    out.push(wall(0, s * side, side * 2 + 4, 0, 6, 2), wall(s * side, 0, side * 2 + 4, Math.PI / 2, 6, 2));
  }
  return out;
}

export interface MapDefinition {
  id: MapId;
  name: string;
  layout: MapLayout;
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
