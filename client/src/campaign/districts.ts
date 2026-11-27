import type { District, Footprint, NpcSpec } from '@tumblehorde/shared';
import type { ActorLook } from '../cinematic/actor.ts';
import { CLOTH, HAIR, SKIN } from '../cinematic/config.ts';
import type { LightName } from '../cinematic/light.ts';
import { house, SET_COLORS, tree } from '../cinematic/sets.ts';
import type { Stage } from '../cinematic/stage.ts';
import type { VoiceSpec } from '../cinematic/script.ts';

/**
 * Places to walk around in the story. Each district has the footprints the walking logic uses
 * and builds matching boxes on the stage, plus its people.
 */

export interface Townsperson extends NpcSpec {
  look: ActorLook;
  voice: VoiceSpec;
}

export interface DistrictSet {
  district: District;
  light: LightName;
  start: { x: number; z: number; yaw: number };
  people: readonly Townsperson[];
  build(stage: Stage): void;
}

const CITY = {
  plaster: '#E6D3B0',
  plasterWarm: '#E8C49A',
  plasterPink: '#E3B4A0',
  awning: '#C8423A',
  awningBlue: '#3C7BD0',
  marble: '#E8E4DA',
  water: '#5AA8D8',
  cobble: '#8E8474',
  anvil: '#4A4E54',
  forge: '#3A2A22',
} as const;

interface HouseSpec extends Footprint {
  height: number;
  color: string;
}

const HOUSES: readonly HouseSpec[] = [
  { x: -14, z: -16, width: 10, depth: 7, yaw: 0, height: 6, color: CITY.plaster },
  { x: 0, z: -18, width: 12, depth: 6, yaw: 0, height: 7, color: CITY.plasterWarm },
  { x: 15, z: -15, width: 9, depth: 8, yaw: 0, height: 5.5, color: CITY.plasterPink },
  { x: -18, z: 0, width: 7, depth: 12, yaw: 0, height: 6.5, color: CITY.plasterWarm },
  { x: 18, z: 2, width: 7, depth: 11, yaw: 0, height: 6, color: CITY.plaster },
  { x: -14, z: 16, width: 10, depth: 7, yaw: 0, height: 5, color: CITY.plasterPink },
  { x: 14, z: 17, width: 11, depth: 6, yaw: 0, height: 6.5, color: CITY.plasterWarm },
];

const FOUNTAIN: Footprint = { x: 0, z: 0, width: 3.2, depth: 3.2, yaw: 0 };
const FORGE: Footprint = { x: 6, z: -12.2, width: 2.2, depth: 1.6, yaw: 0 };
const STALL: Footprint = { x: -8, z: -9, width: 3, depth: 1.4, yaw: 0 };

function townsfolk(color: string, hair: string, extra: Partial<ActorLook> = {}): ActorLook {
  return { outfit: 'villager', color, hair, hairStyle: 'short', ...extra };
}

export const MARKET_SQUARE: DistrictSet = {
  light: 'city',
  district: { halfSize: 24, footprints: [...HOUSES, FOUNTAIN, FORGE, STALL] },
  start: { x: 0, z: 14, yaw: Math.PI },
  people: [
    {
      role: 'smith', name: 'Varro', home: { x: 6, z: -10.4 }, yaw: 0.2, stationary: true, dialogue: 'varro-job',
      look: { outfit: 'smith', skin: SKIN.tan, hair: HAIR.grey, hairStyle: 'short', beard: 'short', beardColor: HAIR.grey, scar: true },
      voice: { pitch: 118, rate: 0.14 },
    },
    {
      role: 'baker', name: 'Baker', home: { x: -8, z: -10.4 }, yaw: 0, stationary: true,
      look: townsfolk(CLOTH.linen, HAIR.black, { hairStyle: 'bald', beard: 'stubble', beardColor: HAIR.black }), voice: { pitch: 170, rate: 0.11 },
    },
    {
      role: 'guard', name: 'Guard', home: { x: -3, z: 22 }, yaw: Math.PI, stationary: true,
      look: { outfit: 'legion', helmet: true, hair: HAIR.brown }, voice: { pitch: 140, rate: 0.12 },
    },
    {
      role: 'guard', name: 'Guard', home: { x: 3, z: 22 }, yaw: Math.PI, stationary: true,
      look: { outfit: 'legion', helmet: true, hair: HAIR.black }, voice: { pitch: 132, rate: 0.12 },
    },
    {
      role: 'child', name: 'Child', home: { x: 5, z: 6 },
      look: townsfolk('#6AA84F', HAIR.blond, { age: 'child' }), voice: { pitch: 360, rate: 0.09 },
    },
    {
      role: 'child', name: 'Child', home: { x: -5, z: 7 },
      look: townsfolk('#D8A040', HAIR.auburn, { age: 'child', hairStyle: 'long' }), voice: { pitch: 380, rate: 0.09 },
    },
    {
      role: 'citizen', name: 'Citizen', home: { x: -9, z: 4 },
      look: townsfolk('#7A9AB8', HAIR.brown, { beard: 'short' }), voice: { pitch: 160, rate: 0.12 },
    },
    {
      role: 'citizen', name: 'Citizen', home: { x: 9, z: 6 },
      look: { outfit: 'healer', color: '#B86A8A', hair: HAIR.black, hairStyle: 'long' }, voice: { pitch: 250, rate: 0.11 },
    },
    {
      role: 'merchant', name: 'Merchant', home: { x: 10, z: -6 },
      look: townsfolk('#8E5BD0', HAIR.black, { beard: 'long', beardColor: HAIR.black, skin: SKIN.tan }), voice: { pitch: 150, rate: 0.1 },
    },
    {
      role: 'reveller', name: 'Reveller', home: { x: -6, z: 12 },
      look: townsfolk('#D1483F', HAIR.red, { beard: 'stubble' }), voice: { pitch: 190, rate: 0.13 },
    },
  ],
  build(stage: Stage): void {
    stage.ground(SET_COLORS.grass, 120);
    stage.box(CITY.cobble, [48, 0.06, 48], [0, 0, 0], 0, { castShadow: false });
    for (const h of HOUSES) house(stage, h.x, h.z, h.width, h.depth, h.height, h.yaw, h.color);
    // The fountain in the middle of the square.
    stage.box(CITY.marble, [FOUNTAIN.width, 0.6, FOUNTAIN.depth], [0, 0.3, 0]);
    stage.box(CITY.water, [FOUNTAIN.width - 0.5, 0.1, FOUNTAIN.depth - 0.5], [0, 0.58, 0], 0, { castShadow: false });
    stage.box(CITY.marble, [0.6, 1.8, 0.6], [0, 1.2, 0]);
    // Varro's forge: an anvil and a glowing hearth.
    stage.box(CITY.forge, [FORGE.width, 1.0, FORGE.depth], [FORGE.x, 0.5, FORGE.z]);
    stage.box(CITY.anvil, [0.7, 0.5, 0.35], [FORGE.x - 1.6, 0.25, FORGE.z + 0.6], 0, { metal: true });
    stage.fire(FORGE.x, FORGE.z, 0.5, 1.0);
    // The baker's stall with an awning.
    stage.box(SET_COLORS.wood, [STALL.width, 1.0, STALL.depth], [STALL.x, 0.5, STALL.z]);
    stage.box(CITY.awning, [STALL.width + 0.4, 0.12, STALL.depth + 0.8], [STALL.x, 2.3, STALL.z - 0.2]);
    for (const side of [-1, 1]) stage.box(SET_COLORS.darkWood, [0.12, 2.3, 0.12], [STALL.x + side * STALL.width / 2, 1.15, STALL.z + 0.5]);
    for (let i = 0; i < 4; i++) stage.box(SET_COLORS.straw, [0.35, 0.18, 0.3], [STALL.x - 1 + i * 0.65, 1.1, STALL.z]);
    // Festival bunting between the houses.
    for (let i = 0; i < 9; i++) stage.box(i % 2 === 0 ? CITY.awning : CITY.awningBlue, [0.5, 0.5, 0.05], [-10 + i * 2.5, 5.2, -12.5]);
    tree(stage, -20, -10, 1.2);
    tree(stage, 21, 12, 1.1);
    // The city goes on beyond the square: a few tall blocks in the distance.
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      house(stage, Math.cos(a) * 36, Math.sin(a) * 36, 10, 10, 9 + (i % 3) * 3, a, i % 2 === 0 ? CITY.plaster : CITY.plasterPink);
    }
  },
};
