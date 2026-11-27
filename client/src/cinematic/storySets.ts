import type { TransformNode } from '../render/babylon.ts';
import { house, SET_COLORS } from './sets.ts';
import type { Stage } from './stage.ts';
import { Crowd, ringSeats } from '../render/crowd.ts';

/** Set pieces for the story's places: boats, fires, graves, the forge, the palace, ruins, a cell. */

export const STORY_COLORS = {
  boatWood: '#5A3A22',
  sail: '#C8B89A',
  sailStripe: '#9C2A22',
  dragon: '#3E2A1A',
  water: '#2E5A7A',
  soil: '#5A4430',
  graveStone: '#9A968E',
  log: '#5E3E22',
  forgeWall: '#4A3A30',
  hearth: '#2A1E18',
  ember: '#FF7A2A',
  marble: '#E8E4DA',
  column: '#D8D2C4',
  carpet: '#8E1E2A',
  gold: '#E0B040',
  purple: '#6A2A7A',
  cellWall: '#5E5A52',
  tally: '#E8E4D8',
  tent: '#D8C8A0',
  tentRed: '#A8322A',
  snow: '#EEF2F6',
  ice: '#BFD8E8',
  pine: '#2F5A3A',
  steel: '#A3ACB6',
  marker: '#7A5A3A',
  sky: '#BFD8F0',
  bars: '#2A2A2E',
} as const;

/** A dragon-headed longship, its bow facing +z when yaw is 0. */
export function dragonBoat(stage: Stage, x: number, z: number, yaw: number, y = 0): TransformNode {
  const g = stage.group('boat', x, y, z);
  g.rotation.y = yaw;
  const p = stage.world.parts;
  p.part('box', STORY_COLORS.boatWood, g, [2.2, 0.7, 8], [0, 0.35, 0]);
  p.part('box', STORY_COLORS.boatWood, g, [2.6, 0.25, 8.4], [0, 0.75, 0]);
  p.part('box', STORY_COLORS.dragon, g, [0.4, 2.4, 0.4], [0, 1.6, 4.3]).rotation.x = 0.35;
  p.part('box', STORY_COLORS.dragon, g, [0.5, 0.5, 0.9], [0, 2.75, 4.95]);
  p.part('box', STORY_COLORS.ember, g, [0.52, 0.1, 0.1], [0, 2.85, 5.3], { castShadow: false });
  p.part('box', STORY_COLORS.dragon, g, [0.35, 1.8, 0.35], [0, 1.4, -4.2]).rotation.x = -0.4;
  p.part('box', STORY_COLORS.boatWood, g, [0.18, 5, 0.18], [0, 3.2, 0.3]);
  p.part('box', STORY_COLORS.sail, g, [3.4, 2.6, 0.08], [0, 3.9, 0.4]);
  for (const sy of [3.2, 4.0, 4.8]) p.part('box', STORY_COLORS.sailStripe, g, [3.42, 0.3, 0.09], [0, sy, 0.4]);
  for (let i = 0; i < 5; i++) {
    for (const side of [-1, 1]) {
      const shield = p.part('disc', i % 2 === 0 ? '#C8423A' : '#E0B040', g, [0.7, 0.08, 0.7], [side * 1.32, 0.9, -2.6 + i * 1.3]);
      shield.rotation.z = Math.PI / 2;
    }
  }
  return g;
}

/** A house on fire: smoke-dark walls, flames on the roof and at its side. */
export function burningHouse(stage: Stage, x: number, z: number, w: number, d: number, h: number, yaw = 0): void {
  house(stage, x, z, w, d, h, yaw, '#8A7A66');
  stage.fire(x, z, 1.6, h + 0.6);
  stage.fire(x + Math.cos(yaw) * w * 0.3, z - Math.sin(yaw) * w * 0.3, 0.9, h * 0.5);
}

/** A grave: a low mound with a stone or a wooden marker at its head (towards -z). */
export function grave(stage: Stage, x: number, z: number, yaw = 0, wooden = false): TransformNode {
  const g = stage.group('grave', x, 0, z);
  g.rotation.y = yaw;
  const p = stage.world.parts;
  p.part('box', STORY_COLORS.soil, g, [0.9, 0.25, 1.9], [0, 0.12, 0]);
  if (wooden) {
    p.part('box', STORY_COLORS.marker, g, [0.12, 1.0, 0.1], [0, 0.5, -1.0]);
    p.part('box', STORY_COLORS.marker, g, [0.55, 0.1, 0.1], [0, 0.75, -1.0]);
  } else {
    p.part('box', STORY_COLORS.graveStone, g, [0.7, 0.9, 0.18], [0, 0.45, -1.0]);
  }
  return g;
}

/** Logs around a fire, for camps and long nights. */
export function campfire(stage: Stage, x: number, z: number, size = 0.8): void {
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    stage.box(STORY_COLORS.log, [0.18, 0.18, 0.9 * size], [x + Math.cos(a) * 0.3, 0.09, z + Math.sin(a) * 0.3], a);
  }
  stage.fire(x, z, size, 0.1);
}

/** A fallen log to sit on. */
export function seatLog(stage: Stage, x: number, z: number, yaw: number, length = 2.2): void {
  stage.box(STORY_COLORS.log, [length, 0.42, 0.42], [x, 0.21, z], yaw);
}

/** The inside of Varro's forge: dark walls, the hearth glowing, an anvil and his old armor on its rack. */
export function forgeInterior(stage: Stage): { armorRack: TransformNode } {
  const p = stage.world.parts;
  stage.box(STORY_COLORS.soil, [12, 0.1, 10], [0, -0.05, 0], 0, { castShadow: false });
  stage.box(STORY_COLORS.forgeWall, [12, 4.5, 0.4], [0, 2.25, -4]);
  for (const side of [-1, 1]) stage.box(STORY_COLORS.forgeWall, [0.4, 4.5, 10], [side * 6, 2.25, 1]);
  stage.box(STORY_COLORS.hearth, [2.4, 1.2, 1.4], [-3, 0.6, -3.2]);
  stage.fire(-3, -3.0, 0.8, 1.2);
  stage.box('#4A4E54', [0.8, 0.55, 0.4], [-1, 0.75, -1.6], 0.2, { metal: true });
  stage.box(STORY_COLORS.log, [0.5, 0.5, 0.5], [-1, 0.25, -1.6], 0.2);
  for (let i = 0; i < 5; i++) stage.box('#8A8E94', [0.08, 0.7, 0.05], [1 + i * 0.5, 2.4, -3.75], 0, { metal: true });
  const armorRack = stage.group('armor-rack', 3.6, 0, -3.4);
  p.part('box', STORY_COLORS.log, armorRack, [0.1, 1.8, 0.1], [0, 0.9, 0]);
  p.part('box', STORY_COLORS.steel, armorRack, [0.8, 0.6, 0.4], [0, 1.4, 0.1], { metal: true });
  p.part('box', STORY_COLORS.steel, armorRack, [0.55, 0.3, 0.55], [0, 2.0, 0.1], { metal: true });
  p.part('box', '#8E2A24', armorRack, [0.12, 0.25, 0.5], [0, 2.25, 0.1]);
  stage.box(STORY_COLORS.log, [1.6, 0.45, 0.6], [1.6, 0.22, 0.8]);
  return { armorRack };
}

/** A palace hall: columns with purple hangings, a red carpet and the emperor's seat at -z. */
export function throneRoom(stage: Stage): void {
  stage.box(STORY_COLORS.marble, [16, 0.1, 24], [0, -0.05, -4], 0, { castShadow: false });
  stage.box(STORY_COLORS.carpet, [2.4, 0.03, 20], [0, 0.02, -3], 0, { castShadow: false });
  for (let i = 0; i < 5; i++) {
    for (const side of [-1, 1]) {
      stage.shape('roundCylinder', STORY_COLORS.column, [0.9, 7, 0.9], [side * 4.5, 3.5, 4 - i * 4.5]);
      stage.box(STORY_COLORS.purple, [0.9, 2.6, 0.06], [side * 4.5, 4.5, 4.5 - i * 4.5]);
    }
  }
  stage.box(STORY_COLORS.marble, [5, 0.6, 3], [0, 0.3, -14]);
  stage.box(STORY_COLORS.gold, [1.4, 0.7, 1.0], [0, 0.95, -14.4], 0, { metal: true });
  stage.box(STORY_COLORS.gold, [1.4, 1.8, 0.25], [0, 1.6, -14.9], 0, { metal: true });
  stage.box(STORY_COLORS.forgeWall, [16, 8, 0.5], [0, 4, -16]);
}

/** What is left of the monastery: black stumps of walls, a broken bell tower, ash. */
export function ruinedMonastery(stage: Stage): void {
  stage.box(SET_COLORS.ash, [60, 0.1, 60], [0, -0.04, 0], 0, { castShadow: false });
  const walls: readonly (readonly [number, number, number, number, number])[] = [
    [-5, -9, 9, 2.2, 0], [7, -5, 6, 1.4, Math.PI / 2], [-9, 0, 5, 1.0, Math.PI / 2], [2, -9.5, 3, 3.2, 0],
  ];
  for (const [x, z, l, h, yaw] of walls) stage.box(SET_COLORS.charred, [l, h, 0.6], [x, h / 2, z], yaw);
  stage.box(SET_COLORS.charred, [2.6, 5, 2.6], [2.5, 2.5, -9.5]);
  for (let i = 0; i < 6; i++) stage.box(STORY_COLORS.log, [0.3, 0.3, 2.4], [-3 + i * 1.3, 0.15, -6 + (i % 3)], i * 0.9);
  stage.box(SET_COLORS.bell, [0.8, 0.7, 0.8], [3.6, 0.35, -7.5], 0.5, { metal: true });
  // The old bench, burned, where the carving lessons were.
  stage.box(SET_COLORS.charred, [1.8, 0.1, 0.45], [0, 0.3, 0], 0.15);
}

export interface Cell {
  /** Scratches `n` tally marks on the wall. */
  tally: (n: number) => void;
  window: TransformNode;
  /** The pane behind the bars; its color shows the season outside. */
  pane: ReturnType<Stage['box']>;
}

/** A prison cell: stone walls, a barred window high up, a plank bed. */
export function prisonCell(stage: Stage): Cell {
  stage.box(STORY_COLORS.cellWall, [6, 0.1, 6], [0, -0.05, 0], 0, { castShadow: false });
  stage.box(STORY_COLORS.cellWall, [6, 4, 0.4], [0, 2, -2.4]);
  for (const side of [-1, 1]) stage.box(STORY_COLORS.cellWall, [0.4, 4, 6], [side * 2.6, 2, 0]);
  stage.box(STORY_COLORS.log, [0.9, 0.4, 2], [-1.8, 0.2, -0.6]);
  const window = stage.group('window', 1.0, 2.8, -2.18);
  const pane = stage.world.parts.part('box', STORY_COLORS.sky, window, [1.0, 0.7, 0.05], [0, 0, 0], { castShadow: false });
  for (let i = 0; i < 4; i++) stage.world.parts.part('box', STORY_COLORS.bars, window, [0.06, 0.75, 0.08], [-0.36 + i * 0.24, 0, 0.03], { metal: true });
  let made = 0;
  const tally = (n: number): void => {
    for (let i = made; i < n; i++) {
      const group = Math.floor(i / 5);
      const within = i % 5;
      const x = -2.1 + (group % 10) * 0.34 + within * 0.05;
      const y = 0.9 + Math.floor(group / 10) * 0.34;
      const cross = within === 4;
      const mark = stage.box(STORY_COLORS.tally, cross ? [0.3, 0.025, 0.02] : [0.02, 0.26, 0.02], [cross ? x - 0.1 : x, y, -2.19], 0, { castShadow: false });
      if (cross) mark.rotation.z = 0.5;
    }
    made = Math.max(made, n);
  };
  return { tally, window, pane };
}

/** A row of army tents along local x. */
export function tents(stage: Stage, x: number, z: number, count: number, yaw = 0): void {
  for (let i = 0; i < count; i++) {
    const g = stage.group('tent', x + Math.cos(yaw) * i * 3.2, 0, z - Math.sin(yaw) * i * 3.2);
    g.rotation.y = yaw;
    for (const side of [-1, 1]) {
      const slab = stage.world.parts.part('box', i % 3 === 0 ? STORY_COLORS.tentRed : STORY_COLORS.tent, g, [1.6, 0.08, 2.6], [side * 0.6, 0.85, 0]);
      slab.rotation.z = side * -0.9;
    }
  }
}

/** Pines in a ring around a clearing (forests, the north). */
export function forestRing(stage: Stage, radius: number, count: number, color: string = STORY_COLORS.pine): void {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + (i % 3) * 0.05;
    const r = radius + (i % 4) * 1.6;
    const s = 1 + (i % 3) * 0.25;
    stage.box(SET_COLORS.trunk, [0.4 * s, 1.6 * s, 0.4 * s], [Math.cos(a) * r, 0.8 * s, Math.sin(a) * r]);
    stage.shape('cone', color, [1.4 * s, 3.2 * s, 1.4 * s], [Math.cos(a) * r, 3.0 * s, Math.sin(a) * r]);
  }
}

/** A stretch of castle wall with a gate arch and a dark tunnel behind it. */
export function castleYard(stage: Stage, stone = '#9A948A'): void {
  stage.box('#7A7468', [40, 0.1, 40], [0, -0.04, 0], 0, { castShadow: false });
  for (const side of [-1, 1]) stage.box(stone, [12, 7, 2], [side * 8, 3.5, -10]);
  stage.box(stone, [4, 2.4, 2], [0, 5.8, -10]);
  stage.box('#1A1612', [4, 4.6, 0.1], [0, 2.3, -10.9], 0, { castShadow: false });
  for (const x of [-14, 14]) stage.box(stone, [3, 9, 3], [x, 4.5, -10]);
}

/** The Colosseum for scenes: sand, the podium wall, banners, the emperor's box, and a full, roaring house. */
export const COLOSSEUM = {
  floor: 17,
  wallHeight: 3.4,
  rows: 8,
  rowDepth: 2.2,
  rowRise: 1.4,
  /** Meters between spectators in a row. */
  seatSpacing: 0.95,
  sand: '#D8BA82',
  stone: '#C8BCA6',
  stoneDark: '#A89C86',
  arch: '#B8AC96',
  banner: '#C8423A',
} as const;

export function colosseum(stage: Stage): Crowd {
  const { floor, wallHeight, rows, rowDepth, rowRise } = COLOSSEUM;
  stage.shape('disc', COLOSSEUM.sand, [floor * 2, 0.1, floor * 2], [0, -0.04, 0], { castShadow: false });
  stage.box(COLOSSEUM.stoneDark, [300, 0.1, 300], [0, -0.06, 0], 0, { castShadow: false });
  const segments = 36;
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const g = stage.group('tier', 0, 0, 0);
    g.rotation.y = a;
    const inner = floor + 0.7;
    const width = 2 * (inner + rows * rowDepth) * Math.tan(Math.PI / segments) + 0.2;
    stage.world.parts.part('box', COLOSSEUM.stoneDark, g, [width * 0.55, wallHeight, 1.4], [0, wallHeight / 2, inner], {});
    for (let r = 0; r < rows; r++) {
      const radius = inner + 0.7 + r * rowDepth + rowDepth / 2;
      const top = wallHeight + r * rowRise;
      const w = 2 * radius * Math.tan(Math.PI / segments) + 0.15;
      stage.world.parts.part('box', r % 2 === 0 ? COLOSSEUM.stone : COLOSSEUM.stoneDark, g, [w, top, rowDepth], [0, top / 2, radius], { castShadow: false });
    }
    // The outer wall of arches rises behind the top row, closing the world off.
    const outer = inner + 0.7 + rows * rowDepth + 1;
    const ow = 2 * outer * Math.tan(Math.PI / segments) + 0.2;
    stage.world.parts.part('box', COLOSSEUM.arch, g, [ow, wallHeight + rows * rowRise + 4, 1.4], [0, (wallHeight + rows * rowRise + 4) / 2, outer], {});
    stage.world.parts.part('box', '#3A3026', g, [ow * 0.4, 3, 0.2], [0, wallHeight + rows * rowRise + 1, outer - 0.75], { castShadow: false });
    if (i % 3 === 0) stage.world.parts.part('box', COLOSSEUM.banner, g, [1.3, 2.4, 0.08], [0, wallHeight - 1.1, inner - 0.75], { castShadow: false });
  }
  const seats = ringSeats(floor + 1.4, rows, rowDepth, rowRise, wallHeight, (r) => Math.floor((2 * Math.PI * (floor + 1.4 + r * rowDepth)) / COLOSSEUM.seatSpacing));
  const crowd = new Crowd(stage.world.parts, stage.root, seats);
  stage.animate((_dt, time) => crowd.update(time));
  // The emperor's box: purple under a gold canopy.
  stage.box(STORY_COLORS.purple, [7, 0.25, 3], [0, wallHeight + 1.8, -(floor + 2.2)]);
  stage.box(STORY_COLORS.gold, [7.4, 0.3, 3.4], [0, wallHeight + 5.4, -(floor + 2.2)]);
  for (const x of [-3.4, 3.4]) stage.box(STORY_COLORS.gold, [0.3, 3.6, 0.3], [x, wallHeight + 3.6, -(floor + 0.7)]);
  return crowd;
}
