import { Color3, TransformNode } from '../render/babylon.ts';
import type { PartFactory } from '../render/parts.ts';

/**
 * What lies beyond a scene's ground, so no shot ever shows the edge of the world: the ground runs
 * on to the horizon and a ring of hills, a dense forest or snowy peaks closes the view.
 */
export type Backdrop = 'hills' | 'forest' | 'snow' | 'none';

export const BACKDROP = {
  /** The ground carries on this many times its size. */
  apron: 10,
  /** Rings of trees in a forest backdrop, how far apart, and meters between trees in a ring. */
  forestRings: 4,
  ringGap: 5,
  treeSpacing: 3.2,
  /** Hills: how many, how far beyond the ground's edge, how big. */
  hills: 26,
  hillDistance: 55,
  hillSize: 34,
  trunk: '#5E3E22',
  pine: '#2F5A3A',
  pineDark: '#24482E',
  snowPine: '#3E5E4E',
  snowCap: '#EEF2F6',
  rock: '#8A8E90',
} as const;

/** `hex` made darker (factor below 1) or lighter (above 1). */
export function shade(hex: string, factor: number): string {
  const c = Color3.FromHexString(hex);
  return new Color3(Math.min(1, c.r * factor), Math.min(1, c.g * factor), Math.min(1, c.b * factor)).toHexString();
}

function vary(i: number, salt: number): number {
  const x = Math.sin(i * 91.7 + salt * 47.3) * 24634.6345;
  return x - Math.floor(x);
}

function pine(parts: PartFactory, g: TransformNode, x: number, z: number, s: number, color: string, cap: string | null, castShadow: boolean): void {
  parts.part('box', BACKDROP.trunk, g, [0.45 * s, 1.8 * s, 0.45 * s], [x, 0.9 * s, z], { castShadow: false });
  parts.part('cone', color, g, [1.6 * s, 3.6 * s, 1.6 * s], [x, 3.2 * s, z], { castShadow });
  parts.part('cone', color, g, [1.1 * s, 2.6 * s, 1.1 * s], [x, 4.9 * s, z], { castShadow: false });
  if (cap) parts.part('cone', cap, g, [0.6 * s, 1.0 * s, 0.6 * s], [x, 6.0 * s, z], { castShadow: false });
}

/** A dense wood all round, from just past the ground's edge outwards. */
function forest(parts: PartFactory, g: TransformNode, inner: number, snow: boolean): void {
  let i = 0;
  for (let ring = 0; ring < BACKDROP.forestRings; ring++) {
    const r = inner + ring * BACKDROP.ringGap;
    const count = Math.floor((2 * Math.PI * r) / BACKDROP.treeSpacing);
    for (let k = 0; k < count; k++, i++) {
      const a = ((k + vary(i, 1) * 0.6) / count) * Math.PI * 2;
      const rr = r + (vary(i, 2) - 0.5) * BACKDROP.ringGap;
      const s = 1.1 + vary(i, 3) * 0.9 + ring * 0.15;
      const color = snow ? BACKDROP.snowPine : vary(i, 4) < 0.5 ? BACKDROP.pine : BACKDROP.pineDark;
      pine(parts, g, Math.cos(a) * rr, Math.sin(a) * rr, s, color, snow ? BACKDROP.snowCap : null, ring === 0);
    }
  }
}

/** Big soft hills on the horizon, with a few trees on the near slopes. */
function hills(parts: PartFactory, g: TransformNode, inner: number, color: string, snow: boolean): void {
  for (let i = 0; i < BACKDROP.hills; i++) {
    const a = (i / BACKDROP.hills) * Math.PI * 2 + vary(i, 5) * 0.2;
    const r = inner + BACKDROP.hillDistance + vary(i, 6) * 30;
    const w = BACKDROP.hillSize * (0.8 + vary(i, 7) * 0.8);
    const h = w * (snow ? 0.55 : 0.28) * (0.7 + vary(i, 8) * 0.6);
    const hill = parts.part(snow ? 'cone' : 'rock', snow && i % 2 === 0 ? BACKDROP.rock : color, g, [w, h, w * 0.8], [Math.cos(a) * r, snow ? h / 2 : 0, Math.sin(a) * r], { castShadow: false });
    hill.rotation.y = a;
    if (snow) parts.part('cone', BACKDROP.snowCap, g, [w * 0.42, h * 0.4, w * 0.42], [Math.cos(a) * r, h * 0.82, Math.sin(a) * r], { castShadow: false });
  }
  // A loose line of trees between the ground's edge and the hills.
  const count = 40;
  for (let k = 0; k < count; k++) {
    const a = (k / count) * Math.PI * 2 + vary(k, 9) * 0.1;
    const r = inner + 8 + vary(k, 10) * 22;
    pine(parts, g, Math.cos(a) * r, Math.sin(a) * r, 1 + vary(k, 11), snow ? BACKDROP.snowPine : BACKDROP.pine, snow ? BACKDROP.snowCap : null, false);
  }
}

/** Builds the backdrop round a square ground of `size` in `color`, under `parent`. */
export function buildBackdrop(parts: PartFactory, parent: TransformNode, color: string, size: number, kind: Backdrop): void {
  const g = new TransformNode('backdrop', parent.getScene());
  g.parent = parent;
  parts.part('box', shade(color, 0.92), g, [size * BACKDROP.apron, 0.1, size * BACKDROP.apron], [0, -0.08, 0], { castShadow: false });
  const inner = size / 2;
  const hillColor = shade(color, kind === 'snow' ? 1 : 0.85);
  if (kind === 'forest') forest(parts, g, inner + 2, false);
  if (kind === 'snow') forest(parts, g, inner + 6, true);
  if (kind === 'hills' || kind === 'snow' || kind === 'forest') hills(parts, g, inner, hillColor, kind === 'snow');
  g.computeWorldMatrix(true);
  for (const node of g.getDescendants(false)) {
    if (node instanceof TransformNode) {
      node.computeWorldMatrix(true);
      node.freezeWorldMatrix();
    }
  }
}
