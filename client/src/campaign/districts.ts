import type { District, Footprint, NpcRole, NpcSpec } from '@tumblehorde/shared';
import type { ActorLook } from '../cinematic/actor.ts';
import { CLOTH, HAIR, SKIN } from '../cinematic/config.ts';
import type { LightName } from '../cinematic/light.ts';
import { house, SET_COLORS, tree } from '../cinematic/sets.ts';
import type { Stage } from '../cinematic/stage.ts';
import type { VoiceSpec } from '../cinematic/script.ts';

/**
 * Places to walk around in the story. Each district has the footprints the walking logic uses
 * and builds matching boxes on the stage, plus its people and the spots where something can be
 * done (a workout).
 */

export interface Townsperson extends NpcSpec {
  look: ActorLook;
  voice: VoiceSpec;
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

const CITY = {
  plaster: '#E6D3B0',
  plasterWarm: '#E8C49A',
  plasterPink: '#E3B4A0',
  plasterOchre: '#D8B070',
  awning: '#C8423A',
  awningBlue: '#3C7BD0',
  awningGreen: '#4E9A4A',
  marble: '#E8E4DA',
  water: '#5AA8D8',
  cobble: '#8E8474',
  sand: '#C8AA78',
  anvil: '#4A4E54',
  forge: '#3A2A22',
  colosseum: '#D8C8A8',
  lantern: '#FFC86A',
} as const;

const PLASTERS = [CITY.plaster, CITY.plasterWarm, CITY.plasterPink, CITY.plasterOchre] as const;

interface HouseSpec extends Footprint {
  height: number;
  color: string;
}

function block(x: number, z: number, width: number, depth: number, height: number, i: number): HouseSpec {
  return { x, z, width, depth, yaw: 0, height, color: PLASTERS[i % PLASTERS.length] ?? CITY.plaster };
}

/**
 * The forum square in the middle (fountain, Varro's forge to the north, the baker to the
 * north-west), the training yard to the east, the festival street to the south, a lane to the west.
 */
const HOUSES: readonly HouseSpec[] = [
  // North side, behind the forge and the stall.
  block(-28, -24, 14, 9, 7, 0), block(-12, -21, 12, 7, 6.5, 1), block(6, -19, 12, 6, 7.5, 2), block(24, -22, 14, 8, 6, 3),
  // West: two blocks with the lane between them.
  block(-28, -10, 12, 9, 6, 1), block(-28, 12, 12, 10, 6.5, 2), block(-16, 20, 6, 8, 5.5, 3),
  // East: around the training yard.
  block(30, -10, 8, 8, 5.5, 0), block(30, 14, 8, 10, 6, 1),
  // South: the festival street runs between these two rows.
  block(-14, 32, 10, 12, 6.5, 0), block(14, 32, 10, 12, 7, 2), block(-26, 30, 10, 10, 6, 3), block(26, 30, 10, 10, 5.5, 1),
];

const FOUNTAIN: Footprint = { x: 0, z: 0, width: 3.2, depth: 3.2, yaw: 0 };
const FORGE: Footprint = { x: 6, z: -13.6, width: 2.2, depth: 1.6, yaw: 0 };
const STALL: Footprint = { x: -10, z: -15.4, width: 3, depth: 1.4, yaw: 0 };
const POST: Footprint = { x: 24, z: -3, width: 0.6, depth: 0.6, yaw: 0 };
const STONE = { x: 22, z: 3 } as const;

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

const PEOPLE: readonly Townsperson[] = [
  { role: 'smith', name: 'Varro', home: { x: 6, z: -11.8 }, yaw: 0.2, stationary: true, dialogue: 'varro', look: VARRO_LOOK, voice: VARRO_VOICE },
  {
    role: 'baker', name: 'Baker', home: { x: -10, z: -16.6 }, yaw: 0, stationary: true,
    look: townsfolk(CLOTH.linen, HAIR.black, { hairStyle: 'bald', beard: 'stubble', beardColor: HAIR.black }), voice: { pitch: 170, rate: 0.11 },
  },
  { role: 'guard', name: 'Guard', home: { x: -3, z: 38 }, yaw: Math.PI, stationary: true, look: { outfit: 'legion', helmet: true, hair: HAIR.brown }, voice: { pitch: 140, rate: 0.12 } },
  { role: 'guard', name: 'Guard', home: { x: 3, z: 38 }, yaw: Math.PI, stationary: true, look: { outfit: 'legion', helmet: true, hair: HAIR.black }, voice: { pitch: 132, rate: 0.12 } },
  { role: 'guard', name: 'Guard', home: { x: -12, z: 4 }, look: { outfit: 'legion', helmet: true, hair: HAIR.brown }, voice: { pitch: 128, rate: 0.12 } },
  { role: 'guard', name: 'Guard', home: { x: 12, z: -6 }, look: { outfit: 'legion', helmet: true, hair: HAIR.black }, voice: { pitch: 145, rate: 0.12 } },
  {
    role: 'smith', name: 'Old Gaius', home: { x: 26, z: 3 }, yaw: -Math.PI / 2, stationary: true, dialogue: 'trainer',
    look: { outfit: 'villager', color: '#8A6A48', hair: HAIR.white, hairStyle: 'bald', beard: 'short', beardColor: HAIR.white, age: 'old' }, voice: { pitch: 135, rate: 0.15 },
  },
  {
    role: 'merchant', name: 'Merchant', home: { x: 10, z: 6 }, stationary: true, yaw: -Math.PI / 2,
    look: townsfolk('#8E5BD0', HAIR.black, { beard: 'long', beardColor: HAIR.black, skin: SKIN.tan }), voice: { pitch: 150, rate: 0.1 },
  },
  {
    role: 'merchant', name: 'Spice seller', home: { x: -6, z: 26 }, stationary: true, yaw: Math.PI / 2,
    look: { outfit: 'healer', color: '#D8A040', hair: HAIR.black, hairStyle: 'long', skin: SKIN.tan }, voice: { pitch: 240, rate: 0.1 },
  },
  wanderer('child', 'Child', 0, 5, 6),
  wanderer('child', 'Child', 1, -5, 7),
  wanderer('child', 'Child', 2, 2, 24),
  wanderer('child', 'Child', 3, -20, -2),
  wanderer('citizen', 'Citizen', 4, -9, 4),
  wanderer('citizen', 'Citizen', 5, 9, -4, { outfit: 'healer', color: '#B86A8A', hairStyle: 'long' }),
  wanderer('citizen', 'Citizen', 6, -2, -8),
  wanderer('citizen', 'Citizen', 7, 14, 10),
  wanderer('reveller', 'Reveller', 8, 2, 30),
  wanderer('reveller', 'Reveller', 9, -3, 33, { outfit: 'healer', color: '#C8423A', hairStyle: 'long' }),
  wanderer('reveller', 'Reveller', 10, 4, 20),
];

/** Lanterns on strings across the festival street. */
function festival(stage: Stage): void {
  const colors = [CITY.awning, CITY.awningBlue, CITY.awningGreen, CITY.lantern];
  for (let row = 0; row < 4; row++) {
    const z = 20 + row * 5;
    stage.box(SET_COLORS.darkWood, [18, 0.05, 0.05], [0, 5.5, z], 0, { castShadow: false });
    for (let i = 0; i < 8; i++) stage.box(colors[(i + row) % colors.length] ?? CITY.lantern, [0.45, 0.5, 0.45], [-7.5 + i * 2.1, 5.1, z], 0, { castShadow: false });
  }
  // Tables with food and wine for the festival.
  for (const x of [-5, 5]) {
    stage.box(SET_COLORS.wood, [1.2, 0.8, 4], [x, 0.4, 28]);
    for (let i = 0; i < 4; i++) stage.box(i % 2 === 0 ? SET_COLORS.straw : '#8A2A3A', [0.3, 0.2, 0.3], [x, 0.9, 26.6 + i * 0.9]);
  }
}

function forum(stage: Stage): void {
  stage.box(CITY.marble, [FOUNTAIN.width, 0.6, FOUNTAIN.depth], [0, 0.3, 0]);
  stage.box(CITY.water, [FOUNTAIN.width - 0.5, 0.1, FOUNTAIN.depth - 0.5], [0, 0.58, 0], 0, { castShadow: false });
  stage.box(CITY.marble, [0.6, 1.8, 0.6], [0, 1.2, 0]);
  stage.box(CITY.marble, [1.0, 0.5, 1.0], [0, 2.3, 0]);
  // Varro's forge: a hearth, an anvil and a rack of blades.
  stage.box(CITY.forge, [FORGE.width, 1.0, FORGE.depth], [FORGE.x, 0.5, FORGE.z]);
  stage.box(CITY.anvil, [0.7, 0.5, 0.35], [FORGE.x - 1.6, 0.25, FORGE.z + 0.8], 0, { metal: true });
  stage.fire(FORGE.x, FORGE.z, 0.5, 1.0);
  stage.box(SET_COLORS.darkWood, [2.4, 1.6, 0.2], [FORGE.x + 2.4, 0.8, FORGE.z - 0.4]);
  for (let i = 0; i < 4; i++) stage.box('#C8D0D8', [0.08, 0.9, 0.05], [FORGE.x + 1.6 + i * 0.5, 1.0, FORGE.z - 0.25], 0, { metal: true });
  // The baker's stall with an awning and loaves.
  stage.box(SET_COLORS.wood, [STALL.width, 1.0, STALL.depth], [STALL.x, 0.5, STALL.z]);
  stage.box(CITY.awning, [STALL.width + 0.4, 0.12, STALL.depth + 0.8], [STALL.x, 2.3, STALL.z + 0.2]);
  for (const side of [-1, 1]) stage.box(SET_COLORS.darkWood, [0.12, 2.3, 0.12], [STALL.x + side * STALL.width / 2, 1.15, STALL.z + 0.5]);
  for (let i = 0; i < 4; i++) stage.box(SET_COLORS.straw, [0.35, 0.18, 0.3], [STALL.x - 1 + i * 0.65, 1.1, STALL.z]);
  // A merchant's rug and pots.
  stage.box(CITY.awningBlue, [2.4, 0.03, 1.6], [12, 0.02, 6], 0, { castShadow: false });
  for (let i = 0; i < 3; i++) stage.shape('cylinder', CITY.plasterOchre, [0.25, 0.5, 0.25], [11.4 + i * 0.6, 0.25, 6.4]);
}

function trainingYard(stage: Stage): void {
  stage.box(CITY.sand, [12, 0.05, 16], [24, 0.03, 0], 0, { castShadow: false });
  stage.box(SET_COLORS.wood, [POST.width, 2.0, POST.depth], [POST.x, 1.0, POST.z]);
  stage.box(SET_COLORS.darkWood, [1.4, 0.15, 0.2], [POST.x, 1.5, POST.z]);
  stage.shape('rock', '#9A948A', [0.55, 0.4, 0.5], [STONE.x, 0.3, STONE.z]);
  for (let i = 0; i < 5; i++) stage.box(SET_COLORS.darkWood, [0.15, 1.1, 0.15], [18.5, 0.55, -7 + i * 3.5]);
  stage.box(SET_COLORS.darkWood, [0.1, 0.1, 14], [18.5, 1.0, 0]);
}

/** Beyond the district: a sea of roofs and the Colosseum, so the city feels huge. */
function skyline(stage: Stage): void {
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    const r = 52 + (i % 4) * 7;
    const h = 8 + ((i * 7) % 5) * 2.5;
    house(stage, Math.cos(a) * r, Math.sin(a) * r, 10 + (i % 3) * 3, 9, h, a, PLASTERS[i % PLASTERS.length]);
  }
  const g = stage.group('colosseum', 0, 0, -95);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const piece = stage.world.parts.part('box', CITY.colosseum, g, [9, 22, 3], [Math.sin(a) * 30, 11, Math.cos(a) * 30]);
    piece.rotation.y = a;
  }
}

export const CAPITAL: DistrictSet = {
  light: 'city',
  district: { halfSize: 40, footprints: [...HOUSES, FOUNTAIN, FORGE, STALL, POST] },
  start: { x: 0, z: 22, yaw: Math.PI },
  people: PEOPLE,
  spots: [{ id: 'workout', x: STONE.x, z: STONE.z, label: 'Work out' }],
  build(stage: Stage): void {
    stage.ground(SET_COLORS.grass, 260);
    stage.box(CITY.cobble, [80, 0.06, 80], [0, 0, 0], 0, { castShadow: false });
    for (const h of HOUSES) house(stage, h.x, h.z, h.width, h.depth, h.height, h.yaw, h.color);
    forum(stage);
    trainingYard(stage);
    festival(stage);
    tree(stage, -20, -14, 1.2);
    tree(stage, 20, 22, 1.1);
    tree(stage, -36, 0, 1.3);
    skyline(stage);
  },
};
