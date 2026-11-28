import type { TransformNode } from './babylon.ts';
import type { PartFactory } from './parts.ts';

/**
 * A big Viking warship for the last fight: a long deck between high rails hung with shields, a
 * dragon at the bow, a striped sail, oars in the water. Bow towards +x, the deck top at y = 0.
 */

export const LONGSHIP_LOOK = {
  /** Half the length of the straight part of the hull; bow and stern add `point` each. */
  halfLength: 22,
  point: 6,
  halfWidth: 5.2,
  railTop: 1.2,
  keelDepth: 2.6,
  /** The sea surface, below the deck. */
  seaLevel: -1.7,
  deck: '#8E6E48',
  deckLine: '#5E4630',
  hull: '#4E321E',
  strake: '#6A4630',
  dragon: '#3A2616',
  eye: '#FF8A2A',
  mast: '#5A3E26',
  sail: '#E8DCC0',
  sailStripe: '#A82A22',
  rope: '#2E2216',
  shields: ['#C8423A', '#E0B040', '#2E5AA8', '#E8E0CC'],
  boss: '#8A8E94',
  sea: '#2A5470',
  foam: '#D8E8EE',
} as const;

type Vec3 = readonly [number, number, number];

/** One of the two side boards between two points of the deck outline, rail high. */
function board(parts: PartFactory, g: TransformNode, from: readonly [number, number], to: readonly [number, number]): void {
  const L = LONGSHIP_LOOK;
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const length = Math.hypot(dx, dz);
  const height = L.railTop + L.keelDepth;
  const mid: Vec3 = [(from[0] + to[0]) / 2, L.railTop - height / 2, (from[1] + to[1]) / 2];
  const yaw = -Math.atan2(dz, dx);
  parts.part('box', L.hull, g, [length + 0.3, height, 0.45], [...mid], {}).rotation.y = yaw;
  for (const y of [-1.6, -0.6, 0.5]) parts.part('box', L.strake, g, [length + 0.3, 0.16, 0.52], [mid[0], y, mid[2]], { castShadow: false }).rotation.y = yaw;
}

/** The dragon's neck rising from the bow (dir 1) or the curled tail at the stern (dir -1). */
function prow(parts: PartFactory, g: TransformNode, dir: 1 | -1, tip: number): void {
  const L = LONGSHIP_LOOK;
  const steps = dir === 1 ? 7 : 5;
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    const x = dir * (tip + Math.sin(t * 1.4) * 1.6);
    const y = L.railTop + t * (dir === 1 ? 5 : 3.6);
    parts.part('box', L.dragon, g, [0.8, 1.0, 0.6], [x, y, 0]).rotation.z = -dir * (0.5 - t * 0.6);
  }
  if (dir === 1) {
    const head: Vec3 = [tip + 2.4, L.railTop + 5.4, 0];
    parts.part('box', L.dragon, g, [1.8, 0.9, 0.8], [...head]);
    parts.part('box', L.dragon, g, [0.9, 0.5, 0.6], [head[0] + 1.1, head[1] - 0.3, 0]);
    for (const side of [-1, 1]) {
      parts.part('box', L.eye, g, [0.25, 0.2, 0.05], [head[0] + 0.3, head[1] + 0.15, side * 0.42], { glow: true, castShadow: false });
      parts.part('box', L.dragon, g, [0.3, 0.8, 0.15], [head[0] - 0.5, head[1] + 0.7, side * 0.3]).rotation.z = 0.5;
    }
  } else {
    parts.part('box', L.dragon, g, [0.9, 0.9, 0.6], [-tip - 0.6, L.railTop + 3.8, 0]).rotation.z = 0.8;
  }
}

/** The whole ship under `parent`. */
export function buildLongship(parts: PartFactory, parent: TransformNode): void {
  const L = LONGSHIP_LOOK;
  const H = L.halfLength;
  const W = L.halfWidth;
  const tip = H + L.point;
  // The deck: planks along the ship, narrowing to the bow and the stern.
  parts.part('box', L.deck, parent, [H * 2, 0.3, W * 2 - 0.4], [0, -0.15, 0], { castShadow: false });
  for (const dir of [-1, 1]) {
    for (let k = 0; k < 6; k++) {
      const x = dir * (H + (k + 0.5) * (L.point / 6));
      parts.part('box', L.deck, parent, [L.point / 6 + 0.05, 0.3, (W * 2 - 0.4) * (1 - (k + 0.5) / 6)], [x, -0.15, 0], { castShadow: false });
    }
  }
  for (let z = -W + 0.8; z < W - 0.4; z += 0.8) parts.part('box', L.deckLine, parent, [H * 2, 0.02, 0.05], [0, 0.01, z], { castShadow: false });
  parts.part('box', L.hull, parent, [tip * 2, 1, 1.2], [0, -L.keelDepth, 0]);
  // The sides, straight amidships and drawn in to a point at each end.
  for (const side of [-1, 1]) {
    board(parts, parent, [-H, side * W], [H, side * W]);
    board(parts, parent, [H, side * W], [tip, 0]);
    board(parts, parent, [-H, side * W], [-tip, 0]);
  }
  prow(parts, parent, 1, tip);
  prow(parts, parent, -1, tip);
  // Shields along both rails, oars down into the sea.
  let n = 0;
  for (let x = -H + 1; x <= H - 1; x += 1.6) {
    for (const side of [-1, 1]) {
      const shield = parts.part('disc', L.shields[n++ % L.shields.length] ?? L.shields[0], parent, [1.1, 0.1, 1.1], [x, 0.55, side * (W + 0.28)]);
      shield.rotation.x = Math.PI / 2;
      parts.part('disc', L.boss, parent, [0.3, 0.14, 0.3], [x, 0.55, side * (W + 0.33)], { metal: true, castShadow: false }).rotation.x = Math.PI / 2;
    }
  }
  for (let x = -H + 2.4; x <= H - 2; x += 3.2) {
    for (const side of [-1, 1]) parts.part('box', L.mast, parent, [0.16, 0.16, 5.2], [x, -0.7, side * (W + 2.3)], { castShadow: false }).rotation.x = side * 0.42;
  }
  // The mast, the yard and the striped sail, and the ropes down to the rails.
  parts.part('cylinder', L.mast, parent, [0.7, 13, 0.7], [0, 6.5, 0]);
  parts.part('box', L.mast, parent, [0.32, 0.32, 12], [0.3, 11.4, 0]);
  for (let i = 0; i < 6; i++) {
    parts.part('box', i % 2 === 0 ? L.sailStripe : L.sail, parent, [0.1, 6.6, 1.9], [0.5, 8, -4.75 + i * 1.9], { castShadow: i === 0 });
  }
  for (const [x, z] of [[H, W], [H, -W], [-H, W], [-H, -W]] as const) {
    const dx = x;
    const dy = 12 - L.railTop;
    const dz = z;
    const length = Math.hypot(dx, dy, dz);
    const rope = parts.part('box', L.rope, parent, [0.05, length, 0.05], [x / 2, L.railTop + dy / 2, z / 2], { castShadow: false });
    rope.rotation.z = -Math.atan2(dx, dy);
    rope.rotation.x = Math.atan2(dz, Math.hypot(dx, dy));
  }
}

/** The open sea round the ship, with foam where the hull meets the water. */
export function buildSea(parts: PartFactory, parent: TransformNode, y: number = LONGSHIP_LOOK.seaLevel): void {
  const L = LONGSHIP_LOOK;
  parts.part('box', L.sea, parent, [900, 0.1, 900], [0, y, 0], { castShadow: false });
  for (const side of [-1, 1]) parts.part('box', L.foam, parent, [L.halfLength * 2 + 4, 0.06, 0.5], [0, y + 0.06, side * (L.halfWidth + 0.5)], { castShadow: false });
}
