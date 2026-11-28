import type { District, Footprint, NpcRole, NpcSpec } from '@tumblehorde/shared';
import type { ActorLook } from '../cinematic/actor.ts';
import { CAST } from '../cinematic/cast.ts';
import { CLOTH, HAIR, SKIN } from '../cinematic/config.ts';
import type { LightName } from '../cinematic/light.ts';
import { bench, house, SET_COLORS } from '../cinematic/sets.ts';
import { aqueduct, CITY, CityBuilder, clutter, cobbles, cypress, fountain, gate, houseRow, laundry, stall, temple, vary } from './cityKit.ts';
import type { Stage } from '../cinematic/stage.ts';
import type { VoiceSpec } from '../cinematic/script.ts';

/**
 * Places to walk around in the story. Each district has the footprints the walking logic uses
 * and builds matching boxes on the stage, plus its people and the spots where something can be
 * done (a workout).
 */

/** What someone is busy with when not walking or talking: sparring, drinking, cheering, dancing, sleeping it off. */
export type Activity = 'spar' | 'drink' | 'cheer' | 'dance' | 'sleep';

export interface Townsperson extends NpcSpec {
  look: ActorLook;
  voice: VoiceSpec;
  activity?: Activity;
  /** Their own small talk instead of their role's. */
  lines?: readonly string[];
}

/** A place where E does something other than talking. */
export interface Spot {
  id: string;
  x: number;
  z: number;
  label: string;
}

export interface DistrictSet {
  district: District;
  light: LightName;
  start: { x: number; z: number; yaw: number };
  people: readonly Townsperson[];
  spots: readonly Spot[];
  build(stage: Stage): void;
}

/** The capital's plan: a big square in the middle, four narrow streets out of it, blocks of houses between. */
const PLAN = {
  /** The walkable city reaches this far from the middle. */
  edge: 50,
  square: { halfX: 24, halfZ: 18 },
  /** Half the width of a street. */
  street: 2.5,
  /** How deep a house is, from the street into the block. */
  houseDepth: 8,
  /** Shop counters stick out from the houses: nobody walks through them. */
  frontage: 0.5,
} as const;

const E = PLAN.edge;
const SQ = PLAN.square;
const ST = PLAN.street;
const D = PLAN.houseDepth;

function rect(x0: number, x1: number, z0: number, z1: number, margin = 0): Footprint {
  return { x: (x0 + x1) / 2, z: (z0 + z1) / 2, width: x1 - x0 + margin * 2, depth: z1 - z0 + margin * 2, yaw: 0 };
}

/** The blocks of houses between the square and the streets. */
const BLOCKS: readonly Footprint[] = [
  rect(-E - 10, -ST, -E - 10, -SQ.halfZ, PLAN.frontage),
  rect(ST, E + 10, -E - 10, -SQ.halfZ, PLAN.frontage),
  rect(-E - 10, -ST, SQ.halfZ, E + 10, PLAN.frontage),
  rect(ST, E + 10, SQ.halfZ, E + 10, PLAN.frontage),
  rect(-E - 10, -SQ.halfX, -SQ.halfZ, -ST, PLAN.frontage),
  rect(-E - 10, -SQ.halfX, ST, SQ.halfZ, PLAN.frontage),
  rect(SQ.halfX, E + 10, -SQ.halfZ, -ST, PLAN.frontage),
  rect(SQ.halfX, E + 10, ST, SQ.halfZ, PLAN.frontage),
];

const FOUNTAIN_RADIUS = 2.6;
const FOUNTAIN: Footprint = { x: 0, z: 0, width: FOUNTAIN_RADIUS * 2, depth: FOUNTAIN_RADIUS * 2, yaw: 0 };
const FORGE: Footprint = { x: 10, z: -16.4, width: 2.4, depth: 1.4, yaw: 0 };
const TEMPLE: Footprint = rect(-9, 9, -E - 2, -E + 6);
const GATE: Footprint = rect(-20, 20, E - 5, E + 2);
/** Market stalls in the square's west half: x, z and the way they face. */
const STALLS = [
  { x: -12, z: -15.6, yaw: 0 },
  { x: -19, z: -7, yaw: 0 },
  { x: -13, z: -7, yaw: 0 },
  { x: -19, z: 7, yaw: Math.PI },
  { x: -13, z: 7, yaw: Math.PI },
  { x: 8, z: -7, yaw: 0 },
] as const;
const STALL_FOOTPRINTS: readonly Footprint[] = STALLS.map((s) => ({ x: s.x, z: s.z, width: 3, depth: 1.5, yaw: 0 }));
/** The training yard, in the square's south-east corner. */
const YARD = { x0: 11, x1: 22, z0: 6, z1: 16 } as const;
const POST: Footprint = { x: 19.5, z: 9, width: 0.6, depth: 0.6, yaw: 0 };
const STONE = { x: 15, z: 12.5 } as const;
const COLUMN: Footprint = { x: 14, z: -6, width: 1.6, depth: 1.6, yaw: 0 };

const FOOTPRINTS: readonly Footprint[] = [...BLOCKS, FOUNTAIN, FORGE, TEMPLE, GATE, ...STALL_FOOTPRINTS, POST, COLUMN];

/** The capital's square, for scenes set in it: its size, what stands in it, and the training yard. */
export const CAPITAL_SQUARE = { halfX: SQ.halfX, halfZ: SQ.halfZ, footprints: FOOTPRINTS, yard: YARD, fountainRadius: FOUNTAIN_RADIUS } as const;

function townsfolk(color: string, hair: string, extra: Partial<ActorLook> = {}): ActorLook {
  return { outfit: 'villager', color, hair, hairStyle: 'short', ...extra };
}

const TUNICS = ['#7A9AB8', '#6AA84F', '#D8A040', '#B86A8A', '#8E5BD0', '#C8423A', '#5A8A8A', '#B89A6A'] as const;
const HAIRS = [HAIR.brown, HAIR.black, HAIR.blond, HAIR.auburn, HAIR.red, HAIR.grey] as const;

/** Wandering townsfolk with a look and voice picked from their number. */
function wanderer(role: NpcRole, name: string, i: number, x: number, z: number, extra: Partial<ActorLook> = {}): Townsperson {
  const child = role === 'child';
  return {
    role,
    name,
    home: { x, z },
    look: townsfolk(TUNICS[i % TUNICS.length] ?? CLOTH.tunic, HAIRS[(i * 3) % HAIRS.length] ?? HAIR.brown, {
      age: child ? 'child' : 'adult',
      beard: !child && i % 3 === 0 ? 'short' : 'none',
      hairStyle: i % 4 === 1 ? 'long' : 'short',
      ...extra,
    }),
    voice: { pitch: child ? 350 + (i % 3) * 20 : 140 + (i % 5) * 25, rate: child ? 0.09 : 0.11 + (i % 3) * 0.01 },
  };
}

export const VARRO_LOOK: ActorLook = { outfit: 'smith', skin: SKIN.tan, hair: HAIR.grey, hairStyle: 'short', beard: 'short', beardColor: HAIR.grey, scar: true };
export const VARRO_VOICE: VoiceSpec = { pitch: 118, rate: 0.14 };

const LEGION_GUARD: ActorLook = { outfit: 'legion', helmet: true, hair: HAIR.brown };

function guard(name: string, i: number, home: { x: number; z: number }, patrol?: readonly { x: number; z: number }[], yaw?: number): Townsperson {
  return {
    role: 'guard',
    name,
    home,
    yaw,
    stationary: patrol === undefined,
    patrol,
    look: { ...LEGION_GUARD, hair: i % 2 === 0 ? HAIR.brown : HAIR.black },
    voice: { pitch: 125 + (i % 4) * 7, rate: 0.12 },
  };
}

/** A round for a squad of three marching side by side round the square, the yard and the market. */
function squadRound(offset: number): { x: number; z: number }[] {
  return [
    { x: -21.5 + offset, z: -11.5 },
    { x: 20, z: -11.5 + offset },
    { x: 20 - offset, z: 2.5 },
    { x: 7, z: 2.5 + offset },
    { x: 7 - offset, z: 14 },
    { x: -21.5, z: 14 - offset },
  ];
}

/** A seller behind a stall (the stall faces `yaw`). */
function seller(i: number, at: (typeof STALLS)[number], extra: Partial<ActorLook> = {}): Townsperson {
  const back = { x: at.x - Math.sin(at.yaw) * 1.25, z: at.z - Math.cos(at.yaw) * 1.25 };
  return { ...wanderer('merchant', 'Merchant', i, back.x, back.z, extra), stationary: true, yaw: at.yaw };
}

const STROLLERS: readonly [NpcRole, string, number, number][] = [
  ['citizen', 'Citizen', -6, -4], ['citizen', 'Citizen', 5, 6], ['citizen', 'Citizen', -9, 11], ['citizen', 'Citizen', 10, -10],
  ['citizen', 'Citizen', -16, 0], ['citizen', 'Citizen', -3, 12], ['citizen', 'Citizen', 15, 0], ['citizen', 'Citizen', -20, -12],
  ['citizen', 'Citizen', 0, -28], ['citizen', 'Citizen', 0, -36], ['citizen', 'Citizen', -34, 0], ['citizen', 'Citizen', 36, 0],
  ['child', 'Child', 3, 4], ['child', 'Child', -5, 6], ['child', 'Child', -12, 1], ['child', 'Child', 1.2, 44],
  ['reveller', 'Reveller', 1, 23], ['reveller', 'Reveller', -1, 42], ['reveller', 'Reveller', 1, 38], ['reveller', 'Reveller', 6, 14],
  ['citizen', 'Citizen', 4, -14], ['citizen', 'Citizen', -8, -12], ['citizen', 'Citizen', 0, 20], ['citizen', 'Citizen', -40, 0],
];

const PEOPLE: readonly Townsperson[] = [
  { role: 'smith', name: 'Varro', home: { x: FORGE.x, z: FORGE.z + 2.2 }, yaw: 0.2, stationary: true, dialogue: 'varro', look: VARRO_LOOK, voice: VARRO_VOICE },
  {
    role: 'baker', name: 'Baker', home: { x: -12, z: -16.9 }, yaw: 0, stationary: true,
    look: townsfolk(CLOTH.linen, HAIR.black, { hairStyle: 'bald', beard: 'stubble', beardColor: HAIR.black }), voice: { pitch: 170, rate: 0.11 },
  },
  {
    role: 'smith', name: 'Old Gaius', home: { x: 17.5, z: 10.5 }, yaw: -Math.PI / 2, stationary: true, dialogue: 'trainer',
    look: { outfit: 'villager', color: '#8A6A48', hair: HAIR.white, hairStyle: 'bald', beard: 'short', beardColor: HAIR.white, age: 'old' }, voice: { pitch: 135, rate: 0.15 },
  },
  { ...seller(20, STALLS[1], { beard: 'long', beardColor: HAIR.black, skin: SKIN.tan }), name: 'Merchant' },
  { ...seller(21, STALLS[2], { outfit: 'healer', color: '#D8A040', hairStyle: 'long', skin: SKIN.tan }), name: 'Spice seller' },
  seller(22, STALLS[3]),
  seller(23, STALLS[4], { outfit: 'healer', color: '#5A8A8A', hairStyle: 'long' }),
  seller(24, STALLS[5]),
  {
    role: 'citizen', name: 'Priest', home: { x: 0, z: -E + 7.5 }, yaw: 0, stationary: true,
    look: { outfit: 'abbot', hair: HAIR.grey, hairStyle: 'bald', beard: 'short', beardColor: HAIR.grey, age: 'old' }, voice: { pitch: 120, rate: 0.13 },
  },
  guard('Guard', 0, { x: -1.8, z: E - 6.5 }, undefined, Math.PI),
  guard('Guard', 1, { x: 1.8, z: E - 6.5 }, undefined, Math.PI),
  ...[0, 1, 2].map((i) => guard('Legionary', i + 2, squadRound(i * 1.2)[0] ?? { x: 0, z: 0 }, squadRound(i * 1.2))),
  ...[-0.8, 0.8].map((x, i) => guard('Legionary', i + 5, { x, z: 22 }, [{ x, z: 22 }, { x, z: E - 9 }])),
  guard('Legionary', 7, { x: 0, z: -22 }, [{ x: 0.6, z: -22 }, { x: 0.6, z: -E + 9 }]),
  guard('Legionary', 8, { x: -28, z: 0 }, [{ x: -28, z: 0.6 }, { x: -E + 3, z: 0.6 }, { x: -28, z: -0.6 }]),
  ...STROLLERS.map(([role, name, x, z], i) =>
    wanderer(role, name, i, x, z, i % 5 === 1 ? { outfit: 'healer', color: TUNICS[(i * 3) % TUNICS.length] ?? CLOTH.tunic, hairStyle: 'long' } : {}),
  ),
];

function squarePaving(b: CityBuilder): void {
  const g = b.group(0, 0);
  b.box(g, CITY.cobble, [E * 2 + 20, 0.06, E * 2 + 20], [0, 0, 0]);
  // Big stone slabs in two shades, edged with darker joints.
  const tile = 6;
  b.box(g, CITY.cobbleDark, [SQ.halfX * 2, 0.04, SQ.halfZ * 2], [0, 0.03, 0]);
  for (let x = -SQ.halfX; x < SQ.halfX; x += tile) {
    for (let z = -SQ.halfZ; z < SQ.halfZ; z += tile) {
      const shade = (Math.round((x + z) / tile) % 2 === 0) !== vary(x * 13 + z, 71) < 0.2 ? CITY.paving : CITY.pavingDark;
      b.box(g, shade, [tile - 0.25, 0.05, tile - 0.25], [x + tile / 2, 0.05, z + tile / 2]);
    }
  }
  // A ring of dark stone round the fountain.
  b.shape(g, 'cylinder', CITY.cobbleDark, [FOUNTAIN_RADIUS + 1.4, 0.05, FOUNTAIN_RADIUS + 1.4], [0, 0.05, 0]);
  cobbles(b, -ST, -E, ST, -SQ.halfZ, 140, 1);
  cobbles(b, -ST, SQ.halfZ, ST, E, 140, 2);
  cobbles(b, -E, -ST, -SQ.halfX, ST, 110, 3);
  cobbles(b, SQ.halfX, -ST, E, ST, 110, 4);
}

/** Houses on every side of the square and along the four streets. */
function houses(b: CityBuilder): void {
  const n = -SQ.halfZ;
  const s = SQ.halfZ;
  const w = -SQ.halfX;
  const e = SQ.halfX;
  const grand = { shops: 0.45, banners: true, minHeight: 9 };
  houseRow(b, w, n, -ST, n, 0, D, 10, grand);
  houseRow(b, ST, n, e, n, 0, D, 11, grand);
  houseRow(b, -ST, s, w, s, Math.PI, D, 12, grand);
  houseRow(b, e, s, ST, s, Math.PI, D, 13, grand);
  houseRow(b, w, -ST, w, n, Math.PI / 2, D, 14, grand);
  houseRow(b, w, s, w, ST, Math.PI / 2, D, 15, grand);
  houseRow(b, e, n, e, -ST, -Math.PI / 2, D, 16, grand);
  houseRow(b, e, ST, e, s, -Math.PI / 2, D, 17, grand);
  // The narrow streets: taller, closer, washing across.
  houseRow(b, -ST, n - D, -ST, -E + 6, Math.PI / 2, D, 20);
  houseRow(b, ST, -E + 6, ST, n - D, -Math.PI / 2, D, 21);
  houseRow(b, -ST, E - 5, -ST, s + D, Math.PI / 2, D, 22, { shops: 0.6 });
  houseRow(b, ST, s + D, ST, E - 5, -Math.PI / 2, D, 23, { shops: 0.6 });
  houseRow(b, w - D, -ST, -E, -ST, 0, D, 24);
  houseRow(b, -E, ST, w - D, ST, Math.PI, D, 25);
  houseRow(b, E, -ST, e + D, -ST, 0, D, 26);
  houseRow(b, e + D, ST, E, ST, Math.PI, D, 27);
  // The insides of the blocks, under the roofs.
  for (const f of BLOCKS) {
    const g = b.group(f.x, f.z);
    b.box(g, CITY.roofDark, [f.width - D * 1.6, 7, f.depth - D * 1.6], [0, 3.5, 0]);
  }
  for (let i = 0; i < 4; i++) {
    const z = n - 12 - i * 7;
    laundry(b, -ST - 0.5, z, ST + 0.5, z, 5.2 + (i % 2) * 2.6, 70 + i);
    const x = w - 12 - i * 6;
    laundry(b, x, -ST - 0.5, x, ST + 0.5, 5.5, 80 + i);
  }
}

/** The things in the square: fountain, market, the smith, the honor column, cypresses. */
function square(b: CityBuilder, stage: Stage): void {
  fountain(b, 0, 0, FOUNTAIN_RADIUS);
  STALLS.forEach((at, i) => stall(b, at.x, at.z, at.yaw, 90 + i));
  // The smith's workshop: a lean-to roof on posts, the hearth, anvil and a rack of blades.
  const forge = b.group(FORGE.x, FORGE.z);
  for (const x of [-2.4, 2.4]) b.box(forge, CITY.door, [0.2, 3, 0.2], [x, 1.5, 1.4]);
  const roof = b.box(forge, CITY.roofDark, [5.4, 0.18, 3.0], [0, 3.15, 0.3], { castShadow: true });
  roof.rotation.x = 0.25;
  b.box(forge, '#3A2A22', [FORGE.width, 1.0, FORGE.depth], [0, 0.5, 0], { castShadow: true });
  b.box(forge, '#4A4E54', [0.7, 0.5, 0.35], [-1.8, 0.25, 1.0], { metal: true });
  b.box(forge, CITY.door, [1.6, 1.8, 0.15], [1.9, 0.9, -0.5]);
  for (let i = 0; i < 4; i++) b.box(forge, '#C8D0D8', [0.08, 1.0, 0.05], [1.4 + i * 0.33, 1.1, -0.38], { metal: true });
  b.box(forge, CITY.door, [1.6, 0.6, 0.08], [0, 3.6, 1.5]);
  b.box(forge, '#4A4E54', [0.6, 0.3, 0.1], [0, 3.6, 1.56], { metal: true });
  stage.fire(FORGE.x, FORGE.z, 0.5, 1.0);
  clutter(b, FORGE.x + 3.6, FORGE.z + 0.2, 0, 5);
  // The honor column with a gilded eagle.
  const col = b.group(COLUMN.x, COLUMN.z);
  b.box(col, CITY.marbleShade, [1.6, 1.2, 1.6], [0, 0.6, 0], { castShadow: true });
  b.shape(col, 'cylinder', CITY.marble, [0.55, 8, 0.55], [0, 5.2, 0], { castShadow: true });
  b.box(col, CITY.gold, [1.2, 0.5, 0.4], [0, 9.5, 0], { metal: true });
  b.box(col, CITY.gold, [0.4, 0.5, 0.4], [0, 9.9, 0.2], { metal: true });
  for (const [x, z] of [[-SQ.halfX + 1.2, -SQ.halfZ + 1.2], [SQ.halfX - 1.2, -SQ.halfZ + 1.2], [-SQ.halfX + 1.2, SQ.halfZ - 1.2], [-4, -SQ.halfZ + 1.2], [4, -SQ.halfZ + 1.2], [-4, SQ.halfZ - 1.2], [4, SQ.halfZ - 1.2]] as const) {
    cypress(b, x, z, 4.5, true);
  }
  for (const [x, z, yaw] of [[-SQ.halfX + 0.6, 10, Math.PI / 2], [SQ.halfX - 0.6, -10, -Math.PI / 2], [-6, -SQ.halfZ + 0.6, 0], [20, SQ.halfZ - 0.6, Math.PI]] as const) clutter(b, x, z, yaw, Math.round(x * 3 + z));
  for (const x of [-7, 7]) bench(stage, x, 4.6, 0);
}

function trainingYard(b: CityBuilder): void {
  const g = b.group(0, 0);
  b.box(g, CITY.sand, [YARD.x1 - YARD.x0, 0.06, YARD.z1 - YARD.z0], [(YARD.x0 + YARD.x1) / 2, 0.06, (YARD.z0 + YARD.z1) / 2]);
  // A low fence with a gap facing the square.
  for (let x = YARD.x0; x <= YARD.x1; x += 2.2) b.box(g, CITY.door, [0.16, 1.1, 0.16], [x, 0.55, YARD.z0], { castShadow: true });
  for (let z = YARD.z0 + 4.4; z <= YARD.z1; z += 2.2) b.box(g, CITY.door, [0.16, 1.1, 0.16], [YARD.x0, 0.55, z], { castShadow: true });
  b.box(g, CITY.door, [YARD.x1 - YARD.x0, 0.1, 0.1], [(YARD.x0 + YARD.x1) / 2, 0.95, YARD.z0]);
  b.box(g, CITY.door, [0.1, 0.1, YARD.z1 - YARD.z0 - 4.4], [YARD.x0, 0.95, (YARD.z0 + 4.4 + YARD.z1) / 2]);
  b.box(g, SET_COLORS.wood, [POST.width, 2.0, POST.depth], [POST.x, 1.0, POST.z], { castShadow: true });
  b.box(g, SET_COLORS.darkWood, [1.4, 0.15, 0.2], [POST.x, 1.5, POST.z]);
  b.shape(g, 'rock', '#9A948A', [0.55, 0.4, 0.5], [STONE.x, 0.3, STONE.z], { castShadow: true });
  // A rack of wooden swords and shields.
  b.box(g, SET_COLORS.darkWood, [2.4, 0.12, 0.3], [YARD.x1 - 1.5, 1.3, YARD.z1 - 0.6]);
  for (let i = 0; i < 4; i++) b.box(g, SET_COLORS.wood, [0.1, 1.1, 0.06], [YARD.x1 - 2.4 + i * 0.6, 0.9, YARD.z1 - 0.5]);
  b.shape(g, 'disc', SET_COLORS.wood, [0.8, 0.1, 0.8], [YARD.x1 - 0.4, 0.6, YARD.z1 - 2]).rotation.x = Math.PI / 2;
}

/** Lanterns on strings across the festival street, down to the gate. */
function festival(b: CityBuilder): void {
  const g = b.group(0, 0);
  for (let row = 0; row < 6; row++) {
    const z = SQ.halfZ + D + 2 + row * 3.4;
    b.box(g, SET_COLORS.darkWood, [ST * 2 + 1, 0.05, 0.05], [0, 5.2, z]);
    for (let i = 0; i < 3; i++) b.box(g, CITY.awnings[(i + row) % CITY.awnings.length] ?? CITY.gold, [0.45, 0.5, 0.45], [-1.6 + i * 1.6, 4.8, z]);
  }
}

/** The ends of the streets, so no street runs off into nothing. */
function streetEnds(b: CityBuilder): void {
  temple(b, 0, -E + 2.5, 0, 16);
  gate(b, 0, E - 1.5, Math.PI, ST * 2 + 0.6);
  for (const side of [-1, 1]) {
    // A shrine wall with a statue in a niche closes the east and west lanes.
    const g = b.group(side * (E + 0.4), 0, side * -Math.PI / 2);
    b.box(g, SET_COLORS.stone, [12, 9, 1.2], [0, 4.5, 0], { castShadow: true });
    b.box(g, SET_COLORS.stoneDark, [3, 4.2, 0.4], [0, 2.6, 0.5]);
    b.box(g, CITY.marble, [0.9, 2.4, 0.6], [0, 2.2, 0.8]);
    b.box(g, CITY.marble, [0.5, 0.5, 0.5], [0, 3.7, 0.8]);
    b.shape(g, 'bush', CITY.green, [1.2, 1.0, 0.6], [-2.6, 0.8, 0.9]);
    b.shape(g, 'bush', CITY.green, [1.2, 1.0, 0.6], [2.6, 0.8, 0.9]);
  }
}

/** Beyond the district: a sea of roofs, the aqueduct and the Colosseum, so the city feels huge. */
function skyline(b: CityBuilder, stage: Stage): void {
  const step = 13;
  const reach = 120;
  let i = 0;
  for (let x = -reach; x <= reach; x += step) {
    for (let z = -reach; z <= reach; z += step) {
      i++;
      if (Math.abs(x) < E + 8 && Math.abs(z) < E + 8) continue;
      if (Math.hypot(x, z + 125) < 42) continue;
      const h = 7 + Math.floor(vary(i, 91) * 4) * 2.4;
      house(stage, x + (vary(i, 92) - 0.5) * 3, z + (vary(i, 93) - 0.5) * 3, 9 + vary(i, 94) * 3, 9, h, Math.floor(vary(i, 95) * 4) * (Math.PI / 2), CITY.plasters[i % CITY.plasters.length]);
    }
  }
  aqueduct(b, 40, -reach, reach);
  const g = b.group(0, -125);
  for (let k = 0; k < 28; k++) {
    const a = (k / 28) * Math.PI * 2;
    const piece = b.box(g, '#D8C8A8', [8, 24, 3], [Math.sin(a) * 34, 12, Math.cos(a) * 34], { castShadow: false });
    piece.rotation.y = a;
    for (let level = 0; level < 3; level++) b.box(g, '#8A7A60', [2.4, 3.6, 0.2], [Math.sin(a) * 35.6, 4 + level * 7, Math.cos(a) * 35.6]).rotation.y = a;
  }
}

export const CAPITAL: DistrictSet = {
  light: 'city',
  district: { halfSize: E, footprints: FOOTPRINTS },
  start: { x: 0, z: SQ.halfZ + D + 4, yaw: Math.PI },
  people: PEOPLE,
  spots: [{ id: 'workout', x: STONE.x, z: STONE.z, label: 'Work out' }],
  build(stage: Stage): void {
    stage.ground(SET_COLORS.grass, 320, 'none');
    const b = new CityBuilder(stage);
    squarePaving(b);
    houses(b);
    square(b, stage);
    trainingYard(b);
    festival(b);
    streetEnds(b);
    skyline(b, stage);
    b.freeze();
  },
};

/** A person from the cast, as a townsperson of the festive city. */
function castPerson(role: keyof typeof CAST, name: string, x: number, z: number, extra: Partial<Townsperson> = {}, look: Partial<ActorLook> = {}): Townsperson {
  const r = CAST[role];
  return { role: 'citizen', name, home: { x, z }, look: { ...r.look, ...look }, voice: r.voice, ...extra };
}

/** The spy's hiding place: the north-west corner of the square, behind the market stalls. */
export const SPY_SPOT = { x: -22.6, z: -16.6 } as const;
export const SPY_NAME = 'Stranger';

const VIKING_LINES = ['Skål! To the Romans! Hah, never thought I would say that.', 'Your wine is weak. I have had nine. Nine!', 'My father burned this city once. Now I drink in it. Strange world.'];
const MONGOL_LINES = ['Good horses here. Fat. Lazy. Like the Romans. Hah!', 'We rode a thousand miles to drink with you. Pour.', 'Your bread is soft. Everything here is soft.'];
const DRUNK_LINES = ['Hic. I love you. I love everybody.', 'Which one of you is the real emperor? There are two of you.', 'I am not drunk. The ground is moving.'];
const HAPPY_LINES = ['What a time to be alive!', 'They say there has never been an empire like ours.', 'Peace! Real peace! My children have never seen a war.'];

/** The capital after the war: crowded, happy, full of soldiers, and full of visitors. */
export function festiveCapital(son: 'marcus' | 'lucius'): DistrictSet {
  const extras: Townsperson[] = [
    { ...castPerson('liviaOld', 'Livia', -11, 13, { stationary: true, yaw: Math.PI }), lines: ['Look at them all. He would have liked this. He would have pretended not to, and liked it.'] },
    { ...castPerson('felixOld', 'Felix', -3, 5, {}), lines: ['Rufus has told that joke to every Viking in the city. Twice.'] },
    { ...castPerson('rufusOld', 'Rufus', 3, 5, { activity: 'drink' }), lines: ['Why did the Mongol bring a ladder to the feast? ... I forget. Hehehe!'] },
    // Soldiers training in the yard, in pairs.
    ...[0, 1, 2, 3, 4, 5].map((i) => ({ ...castPerson('legionary', 'Legionary', 13 + (i % 3) * 3, 8 + Math.floor(i / 3) * 3.4, { stationary: true, yaw: Math.floor(i / 3) === 0 ? 0 : Math.PI, activity: 'spar' as const, role: 'guard' as const }) })),
    // Vikings at a table by the column, Mongols with their horses by the market.
    ...[0, 1, 2, 3, 4, 5].map((i) => ({ ...castPerson(i === 0 ? 'sigurd' : 'viking', i === 0 ? 'Sigurd' : 'Viking', 16 + (i % 3) * 1.4, -11 + Math.floor(i / 3) * 2.6, { stationary: i % 2 === 0, activity: i % 2 === 0 ? ('drink' as const) : ('cheer' as const), lines: VIKING_LINES }, i === 0 ? {} : { helmet: i % 3 !== 0 }) })),
    ...[0, 1, 2, 3, 4].map((i) => ({ ...castPerson('mongol', 'Mongol', -18 + (i % 3) * 1.4, -1.5 + Math.floor(i / 3) * 1.6, { activity: i % 2 === 0 ? ('cheer' as const) : undefined, lines: MONGOL_LINES }, { helmet: i % 2 === 0 }) })),
    // The drunk, one of them asleep by the fountain.
    ...[0, 1, 2, 3].map((i) => ({ ...wanderer('reveller', 'Reveller', 30 + i, -2 + i * 1.6, 22 + i * 4), activity: 'drink' as const, lines: DRUNK_LINES })),
    { ...wanderer('reveller', 'Reveller', 40, 3.4, 1.4), stationary: true, activity: 'sleep', lines: ['Zzz... five more minutes, mother... zzz'] },
    // More children, more happy citizens, more patrols.
    ...[0, 1, 2, 3, 4, 5].map((i) => ({ ...wanderer('child', 'Child', 50 + i, -10 + i * 4, i % 2 === 0 ? 8 : -8), activity: i % 3 === 0 ? ('dance' as const) : undefined })),
    ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ ...wanderer('citizen', 'Citizen', 60 + i, -18 + i * 5, i % 2 === 0 ? 12 : -12), lines: HAPPY_LINES, activity: i % 4 === 0 ? ('dance' as const) : undefined })),
    ...[0, 1, 2].map((i) => guard('Legionary', 9 + i, { x: -4 + i * 1.2, z: -14 }, [{ x: -20 + i * 1.2, z: -14 }, { x: 20 + i * 1.2, z: -14 }])),
    // Hidden in the corner behind the stalls, pretending to look at the wall.
    { ...castPerson('spy', SPY_NAME, SPY_SPOT.x, SPY_SPOT.z, { stationary: true, yaw: -Math.PI * 0.75, dialogue: 'spy' }) },
  ];
  // Whichever brother the player is not walks the city too: Lucius with his guard, or the Mongol chief who swore to him.
  if (son === 'marcus') extras.push({ ...castPerson('luciusBare', 'Lucius', 4, 11, {}), lines: ['Brother. Two emperors, one city. Try not to break anything.'] });
  else extras.push({ ...castPerson('khan', 'Toghan', -16, 0, { stationary: true, yaw: Math.PI / 2 }, { helmet: false }), lines: ['Your brother was a hard man to follow, Caesar. You are easier. Do not tell anyone I said so.'] });
  return {
    ...CAPITAL,
    light: 'goldenMorning',
    people: [...PEOPLE, ...extras],
    build(stage: Stage): void {
      CAPITAL.build(stage);
      stage.weather('petals');
      festiveDecor(stage);
    },
  };
}

/** A giant Cassian in stone beside Varro, tables of food and wine, and the visitors' horses. */
function festiveDecor(stage: Stage): void {
  const stone = '#BAB6AC';
  const plinth = stage.group('plinth', -12, 0, 10);
  stage.world.parts.part('box', stone, plinth, [4.4, 2.2, 4.4], [0, 1.1, 0]);
  stage.world.parts.part('box', '#9A968C', plinth, [4.8, 0.3, 4.8], [0, 2.3, 0]);
  const statue = stage.actor('Cassian in stone', { outfit: 'commander', skin: stone, hair: stone, beard: 'short', beardColor: stone, color: stone, cape: stone, helmet: true });
  statue.place(-12, 10, Math.PI).setPose('raiseSword', true);
  statue.root.scaling.setAll(3.4);
  statue.root.position.y = 2.45;
  const varro = stage.actor('Varro in stone', { outfit: 'smith', skin: stone, hair: stone, beard: 'short', beardColor: stone, color: stone });
  varro.place(-14, -6, Math.PI / 2).setPose('fist', true);
  varro.root.scaling.setAll(2.2);
  varro.root.position.y = 1.2;
  stage.box(stone, [3, 1.2, 3], [-14, 0.6, -6]);
  // The Vikings' table, with barrels.
  stage.box('#6A4A2A', [4.2, 0.9, 1.4], [17.4, 0.45, -9.7]);
  for (let i = 0; i < 4; i++) stage.shape('cylinder', '#7A5A32', [0.4, 0.9, 0.4], [19.8, 0.45, -12 + i * 1.1]);
  // Mongol horses tethered by the market.
  for (const [x, z, yaw] of [[-21, 1.5, 0.4], [-21.5, -2.6, -0.3]] as const) stage.horse().place(x, z, yaw);
  // Garlands across the square.
  for (let row = 0; row < 3; row++) {
    stage.box('#5E3E22', [48, 0.05, 0.05], [0, 6, -10 + row * 10], 0, { castShadow: false });
    for (let i = 0; i < 16; i++) stage.box(['#C8423A', '#E3B52B', '#3C7BD0', '#6AA84F'][(i + row) % 4] ?? '#C8423A', [0.5, 0.6, 0.05], [-22 + i * 3, 5.6, -10 + row * 10], 0, { castShadow: false });
  }
}
