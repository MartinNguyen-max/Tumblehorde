import { AbstractMesh, TransformNode } from '../render/babylon.ts';
import type { PartOptions } from '../render/parts.ts';
import { SET_COLORS } from '../cinematic/sets.ts';
import type { Stage } from '../cinematic/stage.ts';

/**
 * The capital's building blocks: whole houses (roofs, doors, shutters, balconies, shop fronts),
 * market stalls, a temple, a gate, an aqueduct. Everything hangs under one node and is frozen
 * once built, so a city of thousands of boxes costs little per frame.
 */

export const CITY = {
  plasters: ['#E6D3B0', '#E8C49A', '#E3B4A0', '#D8B070', '#EADFC8', '#D9A88A', '#C9B89A'],
  shutters: ['#4E7A4A', '#3C6A9A', '#7A5030', '#9A3A2A', '#5A8A8A'],
  awnings: ['#C8423A', '#3C7BD0', '#4E9A4A', '#E3B52B', '#8E5BD0', '#D88A40'],
  cloth: ['#E8E0CC', '#C8423A', '#3C7BD0', '#E3B52B', '#6AA84F', '#B86A8A'],
  roof: '#B05A3A',
  roofLight: '#C46A44',
  roofDark: '#8A4430',
  plinth: '#9A8E7A',
  cornice: '#EFE6D2',
  frame: '#D8CCB2',
  door: '#5E3E22',
  recess: '#2E2218',
  window: '#2A2620',
  pot: '#B8643A',
  green: '#4E8E3A',
  flower: '#D84A6A',
  marble: '#EDE8DC',
  marbleShade: '#D6CFBF',
  bronze: '#A8743A',
  cobble: '#8E8474',
  cobbleLight: '#A49A88',
  cobbleDark: '#6E665A',
  paving: '#C2B8A4',
  pavingDark: '#B2A894',
  water: '#5AA8D8',
  banner: '#A8282A',
  gold: '#E0B040',
  sand: '#D2B482',
  cypress: '#2E5A2E',
  /** Height of one storey, and of the stone base under the plaster. */
  storey: 3,
  plinthHeight: 0.6,
} as const;

const DETAIL: PartOptions = { castShadow: false };

/** A cheap repeatable pseudo-random number in [0, 1) for building `i`'s look. */
export function vary(i: number, salt = 0): number {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function pick<T>(list: readonly T[], r: number): T {
  return list[Math.floor(r * list.length) % list.length] as T;
}

/** All of the city hangs under one node, frozen once the city is built. */
export class CityBuilder {
  readonly stage: Stage;
  readonly root: TransformNode;

  constructor(stage: Stage) {
    this.stage = stage;
    this.root = stage.group('city');
  }

  group(x: number, z: number, yaw = 0, parent: TransformNode = this.root): TransformNode {
    const g = new TransformNode('city-piece', this.stage.scene);
    g.parent = parent;
    g.position.set(x, 0, z);
    g.rotation.y = yaw;
    return g;
  }

  box(parent: TransformNode, color: string, size: readonly [number, number, number], pos: readonly [number, number, number], options: PartOptions = DETAIL): AbstractMesh {
    return this.stage.world.parts.part('box', color, parent, size, pos, options);
  }

  shape(parent: TransformNode, shape: Parameters<Stage['shape']>[0], color: string, size: readonly [number, number, number], pos: readonly [number, number, number], options: PartOptions = DETAIL): AbstractMesh {
    return this.stage.world.parts.part(shape, color, parent, size, pos, options);
  }

  /** Nothing in the city moves: every matrix is computed once and kept. */
  freeze(): void {
    this.root.computeWorldMatrix(true);
    for (const node of this.root.getDescendants(false)) {
      if (!(node instanceof TransformNode)) continue;
      node.computeWorldMatrix(true);
      node.freezeWorldMatrix();
    }
  }
}

export interface HouseLook {
  width: number;
  depth: number;
  height: number;
  /** Pick of colors and details. */
  seed: number;
  /** A shop on the ground floor instead of a door. */
  shop?: boolean;
  /** A red banner on the front (the square's grand houses). */
  banner?: boolean;
}

function gableRoof(b: CityBuilder, g: TransformNode, w: number, d: number, h: number, color: string): void {
  const slope = 0.5;
  const run = d / 2 / Math.cos(slope) + 0.35;
  for (const side of [-1, 1]) {
    const slab = b.box(g, color, [w + 0.3, 0.22, run], [0, h + Math.tan(slope) * d / 4 + 0.05, side * d / 4], { castShadow: true });
    slab.rotation.x = side * slope;
  }
  // Ridge tiles and the gable ends, so it reads as a solid roof from the side too.
  b.box(g, CITY.roofDark, [w + 0.35, 0.18, 0.3], [0, h + Math.tan(slope) * d / 2 + 0.08, 0]);
  const rise = Math.tan(slope) * d / 2;
  for (let step = 0; step < 3; step++) {
    const f = (step + 0.5) / 3;
    for (const end of [-1, 1]) b.box(g, CITY.cornice, [0.1, rise / 3, d * (1 - f)], [end * (w / 2 - 0.02), h + rise * f - rise / 6, 0]);
  }
}

function flatRoof(b: CityBuilder, g: TransformNode, w: number, d: number, h: number, seed: number): void {
  b.box(g, CITY.cornice, [w + 0.3, 0.35, d + 0.3], [0, h + 0.17, 0], { castShadow: true });
  // A roof garden: a pergola and pots.
  if (vary(seed, 9) < 0.5) {
    for (const x of [-w / 4, w / 4]) b.box(g, CITY.door, [0.14, 1.6, 0.14], [x, h + 1.1, d / 4]);
    b.box(g, CITY.door, [w / 2 + 0.4, 0.1, 0.12], [0, h + 1.9, d / 4]);
    b.shape(g, 'bush', CITY.green, [0.9, 0.6, 0.9], [w / 4, h + 2.0, d / 4]);
  }
  for (const x of [-w / 3, 0, w / 3]) b.shape(g, 'cylinder', CITY.pot, [0.25, 0.35, 0.25], [x, h + 0.52, d / 2 - 0.3]);
}

function windowAt(b: CityBuilder, g: TransformNode, x: number, y: number, z: number, seed: number, shutter: string): void {
  b.box(g, CITY.frame, [0.95, 1.25, 0.08], [x, y, z]);
  b.box(g, CITY.window, [0.7, 1.0, 0.1], [x, y, z + 0.01]);
  const open = vary(seed, 3) < 0.6;
  for (const side of [-1, 1]) {
    if (open) b.box(g, shutter, [0.36, 1.0, 0.06], [x + side * 0.6, y, z + 0.04]);
    else b.box(g, shutter, [0.34, 1.0, 0.06], [x + side * 0.18, y, z + 0.06]);
  }
  if (vary(seed, 5) < 0.45) {
    b.box(g, CITY.pot, [0.9, 0.2, 0.28], [x, y - 0.66, z + 0.14]);
    b.shape(g, 'bush', vary(seed, 6) < 0.5 ? CITY.flower : CITY.green, [0.4, 0.22, 0.14], [x, y - 0.48, z + 0.14]);
  }
}

function door(b: CityBuilder, g: TransformNode, x: number, z: number): void {
  b.box(g, CITY.frame, [1.45, 2.5, 0.1], [x, 1.25 + CITY.plinthHeight * 0, z]);
  b.box(g, CITY.door, [1.1, 2.2, 0.14], [x, 1.1, z + 0.02]);
  b.box(g, CITY.frame, [1.7, 0.18, 0.5], [x, 0.09, z + 0.25]);
  b.box(g, CITY.bronze, [0.12, 0.12, 0.06], [x + 0.35, 1.1, z + 0.1], { metal: true, castShadow: false });
}

const GOODS = ['#D84A3A', '#E3B52B', '#6AA84F', '#D88A40', '#8E5BD0', '#E8E0CC'] as const;

/** A shop front: a dark opening, a counter with goods, a striped awning. */
function shopFront(b: CityBuilder, g: TransformNode, w: number, z: number, seed: number): void {
  const open = Math.min(w - 1.2, 4.2);
  b.box(g, CITY.recess, [open, 2.3, 0.1], [0, 1.15, z]);
  b.box(g, SET_COLORS.wood, [open, 0.9, 0.55], [0, 0.45, z + 0.3], { castShadow: true });
  const count = Math.floor(open / 0.5);
  for (let i = 0; i < count; i++) {
    const shape = vary(seed + i, 2) < 0.5 ? 'sphere' : 'cylinder';
    b.shape(g, shape, pick(GOODS, vary(seed + i, 4)), [0.3, 0.3, 0.3], [-open / 2 + 0.25 + i * 0.5, 1.05, z + 0.3]);
  }
  const a = pick(CITY.awnings, vary(seed, 7));
  const stripes = 5;
  for (let i = 0; i < stripes; i++) {
    const slab = b.box(g, i % 2 === 0 ? a : CITY.cornice, [(open + 0.6) / stripes, 0.07, 1.5], [-(open + 0.6) / 2 + ((i + 0.5) * (open + 0.6)) / stripes, 2.75, z + 0.6], { castShadow: true });
    slab.rotation.x = 0.35;
  }
}

/** A whole townhouse, its front facing the group's +z. */
export function townhouse(b: CityBuilder, g: TransformNode, look: HouseLook): void {
  const { width: w, depth: d, height: h, seed } = look;
  const plaster = pick(CITY.plasters, vary(seed, 1));
  const shutter = pick(CITY.shutters, vary(seed, 8));
  const front = d / 2 + 0.02;
  b.box(g, plaster, [w, h, d], [0, h / 2, 0], { castShadow: true });
  b.box(g, CITY.plinth, [w + 0.06, CITY.plinthHeight, d + 0.06], [0, CITY.plinthHeight / 2, 0]);
  const floors = Math.max(1, Math.floor((h - 0.5) / CITY.storey));
  for (let f = 1; f < floors; f++) b.box(g, CITY.cornice, [w + 0.12, 0.16, d + 0.12], [0, f * CITY.storey, 0]);
  if (look.shop) shopFront(b, g, w, front, seed);
  else door(b, g, vary(seed, 11) < 0.5 ? -w / 4 : w / 4, front);
  if (!look.shop && w > 4.5) windowAt(b, g, vary(seed, 11) < 0.5 ? w / 4 : -w / 4, 1.6, front, seed + 3, shutter);
  const across = Math.max(1, Math.floor(w / 2.3));
  for (let f = 1; f < floors; f++) {
    for (let i = 0; i < across; i++) windowAt(b, g, -w / 2 + ((i + 0.5) * w) / across, f * CITY.storey + 1.5, front, seed * 7 + f * 3 + i, shutter);
  }
  if (floors > 1 && vary(seed, 12) < 0.35) {
    // A wooden balcony on the first floor.
    const y = CITY.storey + 0.2;
    b.box(g, CITY.door, [w * 0.55, 0.16, 0.9], [0, y, front + 0.45], { castShadow: true });
    b.box(g, CITY.door, [w * 0.55, 0.08, 0.06], [0, y + 0.9, front + 0.88]);
    for (let i = 0; i <= 4; i++) b.box(g, CITY.door, [0.06, 0.9, 0.06], [-w * 0.275 + (i * w * 0.55) / 4, y + 0.45, front + 0.88]);
    b.shape(g, 'bush', CITY.flower, [0.4, 0.3, 0.3], [w * 0.2, y + 0.3, front + 0.6]);
  }
  if (look.banner) {
    b.box(g, CITY.gold, [1.5, 0.12, 0.12], [0, h - 0.6, front + 0.12]);
    b.box(g, CITY.banner, [1.3, 3.2, 0.05], [0, h - 2.25, front + 0.1]);
    b.box(g, CITY.gold, [0.5, 0.5, 0.06], [0, h - 1.9, front + 0.14]);
  }
  if (vary(seed, 13) < 0.3) flatRoof(b, g, w, d, h, seed);
  else gableRoof(b, g, w, d, h, vary(seed, 14) < 0.5 ? CITY.roof : CITY.roofLight);
}

/** A row of houses along a line, fronts facing `yaw`. `from` and `to` are distances along the row. */
export function houseRow(b: CityBuilder, x0: number, z0: number, x1: number, z1: number, yaw: number, depth: number, seed: number, options: { shops?: number; banners?: boolean; minHeight?: number } = {}): void {
  const length = Math.hypot(x1 - x0, z1 - z0);
  const dir = { x: (x1 - x0) / length, z: (z1 - z0) / length };
  // Into the block, away from the street.
  const inward = { x: -Math.sin(yaw), z: -Math.cos(yaw) };
  let at = 0;
  let i = 0;
  while (at < length - 1) {
    const r = vary(seed + i, 21);
    const w = Math.min(length - at, 5 + Math.floor(r * 4));
    const mid = at + w / 2;
    const h = (options.minHeight ?? 6.2) + Math.floor(vary(seed + i, 22) * 3) * CITY.storey * 0.9;
    const g = b.group(x0 + dir.x * mid + inward.x * depth / 2, z0 + dir.z * mid + inward.z * depth / 2, yaw);
    townhouse(b, g, {
      width: w - 0.04,
      depth,
      height: h,
      seed: seed * 31 + i,
      shop: vary(seed + i, 23) < (options.shops ?? 0.3),
      banner: options.banners === true && i % 2 === 1,
    });
    at += w;
    i++;
  }
}

/** A market stall: a table of goods under a striped cloth roof on four poles. */
export function stall(b: CityBuilder, x: number, z: number, yaw: number, seed: number, goods: readonly string[] = GOODS): void {
  const g = b.group(x, z, yaw);
  b.box(g, SET_COLORS.wood, [2.8, 0.85, 1.3], [0, 0.42, 0], { castShadow: true });
  for (let i = 0; i < 10; i++) {
    const shape = vary(seed + i, 31) < 0.6 ? 'sphere' : 'box';
    b.shape(g, shape, pick(goods, vary(seed + i, 32)), [0.32, 0.28, 0.32], [-1.15 + (i % 5) * 0.58, 0.98, -0.3 + Math.floor(i / 5) * 0.6]);
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(g, CITY.door, [0.1, 2.5, 0.1], [sx * 1.4, 1.25, sz * 0.75]);
  const a = pick(CITY.awnings, vary(seed, 33));
  for (let i = 0; i < 6; i++) {
    const slab = b.box(g, i % 2 === 0 ? a : CITY.cornice, [0.55, 0.08, 2.0], [-1.375 + i * 0.55, 2.6, 0], { castShadow: true });
    slab.rotation.x = 0.12;
  }
  // Crates and a basket beside it.
  b.box(g, SET_COLORS.wood, [0.6, 0.5, 0.6], [1.9, 0.25, 0.4], { castShadow: true });
  b.shape(g, 'cylinder', SET_COLORS.straw, [0.3, 0.35, 0.3], [-1.9, 0.18, 0.3]);
}

/** A round fountain with a statue of a legionary raising his sword. */
export function fountain(b: CityBuilder, x: number, z: number, radius: number): void {
  const g = b.group(x, z);
  b.shape(g, 'cylinder', CITY.marble, [radius, 0.7, radius], [0, 0.35, 0], { castShadow: true });
  b.shape(g, 'cylinder', CITY.water, [radius - 0.3, 0.1, radius - 0.3], [0, 0.66, 0]);
  b.shape(g, 'cylinder', CITY.marbleShade, [0.9, 2.2, 0.9], [0, 1.6, 0], { castShadow: true });
  b.shape(g, 'cylinder', CITY.marble, [1.4, 0.3, 1.4], [0, 2.8, 0]);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    b.box(g, CITY.water, [0.16, 0.9, 0.16], [Math.sin(a) * 1.5, 1.2, Math.cos(a) * 1.5]);
  }
  // The statue, in bronze.
  const s = b.group(0, 0, 0, g);
  s.position.y = 2.95;
  b.box(s, CITY.bronze, [0.5, 0.9, 0.36], [0, 0.45, 0], { metal: true, castShadow: true });
  b.box(s, CITY.bronze, [0.8, 1.0, 0.5], [0, 1.4, 0], { metal: true, castShadow: true });
  b.box(s, CITY.bronze, [0.48, 0.48, 0.48], [0, 2.15, 0], { metal: true });
  b.box(s, CITY.bronze, [0.18, 0.95, 0.18], [0.5, 2.15, 0], { metal: true });
  b.box(s, CITY.marble, [0.08, 1.2, 0.04], [0.5, 3.1, 0], { metal: true });
  b.box(s, CITY.bronze, [0.6, 0.62, 0.08], [-0.5, 1.4, 0.2], { metal: true });
}

/** A temple front: steps, a row of columns, a roof with a pediment. */
export function temple(b: CityBuilder, x: number, z: number, yaw: number, width: number): void {
  const g = b.group(x, z, yaw);
  for (let i = 0; i < 4; i++) b.box(g, CITY.marble, [width - i * 0.4, 0.35, 6 - i * 0.6], [0, 0.17 + i * 0.35, 0.3 - i * 0.3], { castShadow: true });
  const top = 1.4;
  const columns = 6;
  for (let i = 0; i < columns; i++) {
    const cx = -width / 2 + 1 + (i * (width - 2)) / (columns - 1);
    b.shape(g, 'cylinder', CITY.marble, [0.45, 6, 0.45], [cx, top + 3, 1.2], { castShadow: true });
    b.box(g, CITY.marbleShade, [1.1, 0.3, 1.1], [cx, top + 6.1, 1.2]);
  }
  b.box(g, CITY.marble, [width, 1.0, 4.2], [0, top + 6.7, 0], { castShadow: true });
  b.box(g, CITY.marbleShade, [width - 2, 6, 2], [0, top + 3, -1.4]);
  b.box(g, CITY.bronze, [2.2, 4, 0.1], [0, top + 2, -0.38], { metal: true });
  for (const side of [-1, 1]) {
    const slab = b.box(g, CITY.roof, [width / 2 + 0.6, 0.3, 4.6], [side * width / 4, top + 7.8, 0], { castShadow: true });
    slab.rotation.z = -side * 0.32;
  }
  b.box(g, CITY.marble, [width * 0.55, 1.2, 0.2], [0, top + 7.6, 2.0]);
  b.box(g, CITY.gold, [1.4, 0.7, 0.1], [0, top + 7.6, 2.12], { metal: true });
}

/** The city gate: two towers, a wall walk over the road, heavy doors. */
export function gate(b: CityBuilder, x: number, z: number, yaw: number, opening: number): void {
  const g = b.group(x, z, yaw);
  for (const side of [-1, 1]) {
    b.box(g, SET_COLORS.stone, [3.6, 13, 3.6], [side * (opening / 2 + 1.8), 6.5, 0], { castShadow: true });
    for (const cx of [-1, 0, 1]) b.box(g, SET_COLORS.stone, [0.8, 0.8, 3.8], [side * (opening / 2 + 1.8) + cx * 1.3, 13.4, 0]);
    b.box(g, SET_COLORS.stone, [12, 9, 3], [side * (opening / 2 + 9.6), 4.5, 0], { castShadow: true });
  }
  b.box(g, SET_COLORS.stone, [opening + 0.2, 3.5, 3.2], [0, 7.6, 0], { castShadow: true });
  for (const side of [-1, 1]) b.box(g, CITY.door, [opening / 2 - 0.05, 5.8, 0.3], [side * opening / 4, 2.9, -0.4]);
  for (let i = 0; i < 4; i++) b.box(g, '#3A3A3E', [opening, 0.12, 0.34], [0, 0.8 + i * 1.4, -0.35], { metal: true });
  for (const side of [-1, 1]) {
    b.box(g, CITY.banner, [1.4, 4, 0.08], [side * (opening / 2 + 1.8), 8.5, 1.85]);
    b.box(g, CITY.gold, [0.6, 0.6, 0.1], [side * (opening / 2 + 1.8), 9.2, 1.9]);
  }
}

/** The aqueduct: tall arches marching over the rooftops, a water channel on top. */
export function aqueduct(b: CityBuilder, x: number, z0: number, z1: number): void {
  const g = b.group(x, 0);
  const span = 6;
  for (let z = z0; z <= z1; z += span) {
    b.box(g, SET_COLORS.stone, [2, 16, 2], [0, 8, z], { castShadow: true });
    b.box(g, SET_COLORS.stoneDark, [2.2, 0.5, 2.2], [0, 9, z]);
  }
  b.box(g, SET_COLORS.stone, [2.2, 2.4, z1 - z0 + 2], [0, 17.2, (z0 + z1) / 2], { castShadow: true });
  for (let z = z0 + span / 2; z < z1; z += span) b.box(g, SET_COLORS.stone, [2.1, 1.4, span - 2.6], [0, 15.3, z]);
  b.box(g, CITY.water, [1.2, 0.1, z1 - z0 + 2], [0, 18.45, (z0 + z1) / 2]);
}

/** A dark green cypress in a pot or in the ground. */
export function cypress(b: CityBuilder, x: number, z: number, height: number, potted = false): void {
  const g = b.group(x, z);
  if (potted) b.shape(g, 'cylinder', CITY.pot, [0.6, 0.8, 0.6], [0, 0.4, 0], { castShadow: true });
  b.shape(g, 'smoothCone', CITY.cypress, [1.3, height, 1.3], [0, (potted ? 0.8 : 0) + height / 2, 0], { castShadow: true });
}

/** Barrels, crates and amphorae piled against a wall. */
export function clutter(b: CityBuilder, x: number, z: number, yaw: number, seed: number): void {
  const g = b.group(x, z, yaw);
  for (let i = 0; i < 4; i++) {
    const r = vary(seed + i, 41);
    const ox = (i - 1.5) * 0.75;
    if (r < 0.35) b.shape(g, 'cylinder', SET_COLORS.wood, [0.35, 0.9, 0.35], [ox, 0.45, 0], { castShadow: true });
    else if (r < 0.7) b.box(g, SET_COLORS.wood, [0.65, 0.6, 0.65], [ox, 0.3, 0], { castShadow: true });
    else b.shape(g, 'capsule', CITY.pot, [0.45, 0.9, 0.45], [ox, 0.45, 0]);
  }
}

/** Washing on a line across a lane, from one wall to the other. */
export function laundry(b: CityBuilder, x0: number, z0: number, x1: number, z1: number, y: number, seed: number): void {
  const length = Math.hypot(x1 - x0, z1 - z0);
  const g = b.group((x0 + x1) / 2, (z0 + z1) / 2, Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2);
  b.box(g, CITY.door, [length, 0.04, 0.04], [0, y, 0]);
  const pieces = Math.floor(length / 1.1);
  for (let i = 0; i < pieces; i++) {
    if (vary(seed + i, 51) < 0.3) continue;
    const h = 0.5 + vary(seed + i, 52) * 0.5;
    b.box(g, pick(CITY.cloth, vary(seed + i, 53)), [0.6, h, 0.04], [-length / 2 + 0.6 + i * 1.1, y - h / 2, 0]);
  }
}

/** Little lighter and darker stones over an area, so a street reads as cobbles. */
export function cobbles(b: CityBuilder, x0: number, z0: number, x1: number, z1: number, count: number, seed: number): void {
  const g = b.group(0, 0);
  for (let i = 0; i < count; i++) {
    const x = x0 + vary(seed + i, 61) * (x1 - x0);
    const z = z0 + vary(seed + i, 62) * (z1 - z0);
    const s = 0.35 + vary(seed + i, 63) * 0.35;
    const stone = b.box(g, vary(seed + i, 64) < 0.5 ? CITY.cobbleLight : CITY.cobbleDark, [s, 0.04, s * 0.8], [x, 0.03, z]);
    stone.rotation.y = vary(seed + i, 65) * Math.PI;
  }
}
