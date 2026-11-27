import type { TransformNode } from '../render/babylon.ts';
import type { Stage } from './stage.ts';

/**
 * Reusable pieces of cutscene sets: buildings, trees, benches, walls. Chunky boxes in the same
 * low-poly style as the battlefields.
 */

export const SET_COLORS = {
  grass: '#6E9A48',
  grassDark: '#5A8440',
  dirt: '#8A6A48',
  stone: '#B8AE9C',
  stoneDark: '#8E8676',
  roof: '#9A4A32',
  roofDark: '#7A3A28',
  wood: '#8A5A32',
  darkWood: '#5E3E22',
  trunk: '#7A4A28',
  leaves: '#4E8E3A',
  leavesLight: '#62A44A',
  window: '#2A1E14',
  windowLit: '#FFC86A',
  bell: '#C8A040',
  river: '#3E7AA4',
  flagstone: '#9A9488',
  straw: '#D8B860',
  ash: '#4A4642',
  charred: '#2E2622',
} as const;

/**
 * A whole house: a stone footing, walls, a pitched roof closed at both ends, a ridge, a chimney,
 * a framed door and shuttered windows on every side.
 */
export function house(stage: Stage, x: number, z: number, w: number, d: number, h: number, yaw = 0, wall: string = SET_COLORS.stone): TransformNode {
  const g = stage.group('house', x, 0, z);
  g.rotation.y = yaw;
  const p = stage.world.parts;
  const detail = { castShadow: false };
  p.part('box', wall, g, [w, h, d], [0, h / 2, 0]);
  p.part('box', SET_COLORS.stoneDark, g, [w + 0.1, 0.5, d + 0.1], [0, 0.25, 0], detail);
  const slope = 0.6;
  const run = w / 2 / Math.cos(slope);
  const rise = Math.tan(slope) * w / 2;
  for (const side of [-1, 1]) {
    const roof = p.part('box', SET_COLORS.roof, g, [run + 0.4, 0.2, d + 0.6], [side * w / 4, h + rise / 2 + 0.05, 0]);
    roof.rotation.z = -side * slope;
  }
  p.part('box', SET_COLORS.roofDark, g, [0.3, 0.22, d + 0.7], [0, h + rise + 0.08, 0], detail);
  // The gable ends: the wall carried up into the roof's triangle, in steps.
  const steps = 4;
  for (let i = 0; i < steps; i++) {
    const f = (i + 0.5) / steps;
    for (const end of [-1, 1]) p.part('box', wall, g, [w * (1 - f) + 0.02, rise / steps + 0.02, 0.2], [0, h + rise * f - rise / (2 * steps), end * (d / 2 - 0.1)], detail);
  }
  p.part('box', SET_COLORS.stoneDark, g, [0.6, 1.4, 0.6], [w / 4, h + rise * 0.6, -d / 5]);
  // A framed door, shuttered windows front and back, small windows on the sides.
  p.part('box', SET_COLORS.stoneDark, g, [1.3, 2.2, 0.06], [0, 1.1, d / 2 + 0.02], detail);
  p.part('box', SET_COLORS.darkWood, g, [1.0, 1.9, 0.08], [0, 0.95, d / 2 + 0.04]);
  for (const face of [-1, 1]) {
    for (const side of [-1, 1]) {
      const wx = side * w / 3.2;
      p.part('box', SET_COLORS.window, g, [0.6, 0.6, 0.06], [wx, h * 0.62, face * (d / 2 + 0.02)], detail);
      p.part('box', SET_COLORS.wood, g, [0.22, 0.62, 0.05], [wx - 0.42, h * 0.62, face * (d / 2 + 0.04)], detail);
      p.part('box', SET_COLORS.wood, g, [0.22, 0.62, 0.05], [wx + 0.42, h * 0.62, face * (d / 2 + 0.04)], detail);
    }
    p.part('box', SET_COLORS.window, g, [0.06, 0.5, 0.5], [face * (w / 2 + 0.02), h * 0.62, 0], detail);
  }
  return g;
}

/** A square bell tower with an open top and a bell. */
export function bellTower(stage: Stage, x: number, z: number, height = 9): TransformNode {
  const g = stage.group('bell-tower', x, 0, z);
  const parts = stage.world.parts;
  parts.part('box', SET_COLORS.stone, g, [2.6, height, 2.6], [0, height / 2, 0]);
  for (const cx of [-1, 1]) for (const cz of [-1, 1]) parts.part('box', SET_COLORS.stone, g, [0.5, 2, 0.5], [cx * 1.05, height + 1, cz * 1.05]);
  parts.part('box', SET_COLORS.roof, g, [3.0, 0.4, 3.0], [0, height + 2.2, 0]);
  parts.part('cone', SET_COLORS.roofDark, g, [1.8, 1.6, 1.8], [0, height + 3.2, 0]);
  parts.part('box', SET_COLORS.bell, g, [0.8, 0.9, 0.8], [0, height + 1.0, 0], { metal: true });
  return g;
}

export function tree(stage: Stage, x: number, z: number, size = 1): void {
  const parts = stage.world.parts;
  const g = stage.group('tree', x, 0, z);
  g.scaling.setAll(size);
  parts.part('box', SET_COLORS.trunk, g, [0.5, 2.4, 0.5], [0, 1.2, 0]);
  parts.part('bush', SET_COLORS.leaves, g, [1.8, 1.6, 1.8], [0, 3.0, 0]);
  parts.part('bush', SET_COLORS.leavesLight, g, [1.2, 1.1, 1.2], [0.4, 3.8, 0.2]);
}

export function bench(stage: Stage, x: number, z: number, yaw = 0, length = 1.8): void {
  const g = stage.group('bench', x, 0, z);
  g.rotation.y = yaw;
  const parts = stage.world.parts;
  parts.part('box', SET_COLORS.wood, g, [length, 0.1, 0.45], [0, 0.42, 0]);
  for (const side of [-1, 1]) parts.part('box', SET_COLORS.darkWood, g, [0.12, 0.4, 0.4], [side * (length / 2 - 0.2), 0.2, 0]);
}

/** A straight stone wall, `length` long along its local x. */
export function wall(stage: Stage, x: number, z: number, length: number, yaw = 0, height = 2.4, color: string = SET_COLORS.stone): void {
  const g = stage.group('wall', x, 0, z);
  g.rotation.y = yaw;
  stage.world.parts.part('box', color, g, [length, height, 0.6], [0, height / 2, 0]);
  stage.world.parts.part('box', SET_COLORS.stoneDark, g, [length + 0.1, 0.2, 0.7], [0, height + 0.1, 0]);
}

/** Small tufts and stones scattered over a patch of ground, so it does not look empty. */
export function scatter(stage: Stage, cx: number, cz: number, radius: number, count: number, color: string = SET_COLORS.grassDark): void {
  for (let i = 0; i < count; i++) {
    const a = (i * 2.399) % (Math.PI * 2);
    const r = radius * Math.sqrt((i + 0.5) / count);
    const s = 0.2 + ((i * 37) % 10) / 30;
    stage.shape('bush', color, [s, s * 0.6, s], [cx + Math.cos(a) * r, s * 0.2, cz + Math.sin(a) * r], { castShadow: false });
  }
}
