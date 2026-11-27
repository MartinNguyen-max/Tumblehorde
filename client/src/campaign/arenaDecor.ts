import { ARENA } from '@tumblehorde/shared';
import { TransformNode } from '../render/babylon.ts';
import type { World } from '../render/world.ts';

/**
 * Dresses the arena map for the campaign: stepped stands full of a cheering crowd, banners and
 * the emperor's box. Hung under the map's root, so it goes away with the map.
 */

const STANDS = {
  rows: 6,
  rowDepth: 2.2,
  rowRise: 1.3,
  segments: 40,
  peoplePerSegment: 7,
  stone: '#C8BCA6',
  stoneDark: '#A89C86',
  banner: '#C8423A',
  gold: '#E0B040',
  purple: '#6A2A7A',
} as const;

const CROWD_COLORS = ['#C8423A', '#3C7BD0', '#E3B52B', '#6AA84F', '#E8E0CC', '#8E5BD0', '#D88A40', '#7A9AB8'] as const;
const SKINS = ['#E8B894', '#E2AD86', '#C98E66', '#B07A56'] as const;
const DECOR_NAME = 'arena-decor';

function pick<T>(list: readonly T[], i: number, fallback: T): T {
  return list[i % list.length] ?? fallback;
}

/** Adds the stands and crowd once per loaded arena map. */
export function decorateArena(world: World): void {
  const root = world.mapRoot;
  if (!root || world.map !== 'arena' || root.getChildTransformNodes(true).some((n) => n.name === DECOR_NAME)) return;
  const decor = new TransformNode(DECOR_NAME, world.scene);
  decor.parent = root;
  const parts = world.parts;
  const inner = ARENA.floorRadius + ARENA.wallThickness;
  const step = (Math.PI * 2) / STANDS.segments;
  for (let s = 0; s < STANDS.segments; s++) {
    const a = s * step;
    const seat = new TransformNode('stand', world.scene);
    seat.parent = decor;
    seat.rotation.y = a;
    for (let r = 0; r < STANDS.rows; r++) {
      const radius = inner + r * STANDS.rowDepth + STANDS.rowDepth / 2;
      const width = 2 * radius * Math.tan(step / 2) + 0.1;
      const top = ARENA.wallHeight + r * STANDS.rowRise;
      parts.part('box', r % 2 === 0 ? STANDS.stone : STANDS.stoneDark, seat, [width, top, STANDS.rowDepth], [0, top / 2, radius], { castShadow: false });
      for (let p = 0; p < STANDS.peoplePerSegment; p += 2) {
        const i = s * 31 + r * 7 + p;
        if (i % 5 === 0) continue;
        const x = (p / (STANDS.peoplePerSegment - 1) - 0.5) * width * 0.8;
        parts.part('box', pick(CROWD_COLORS, i, '#E8E0CC'), seat, [0.5, 0.6, 0.4], [x, top + 0.3, radius], { castShadow: false });
        parts.part('box', pick(SKINS, i, '#E2AD86'), seat, [0.36, 0.36, 0.36], [x, top + 0.8, radius], { castShadow: false });
      }
    }
    // Red and gold banners hang over the wall between the stands.
    if (s % 4 === 0) {
      parts.part('box', STANDS.banner, seat, [1.2, 2.2, 0.08], [0, ARENA.wallHeight - 1.0, inner - ARENA.wallThickness - 0.05], { castShadow: false });
      parts.part('box', STANDS.gold, seat, [1.2, 0.15, 0.1], [0, ARENA.wallHeight - 2.1, inner - ARENA.wallThickness - 0.06], { castShadow: false });
    }
  }
  // The emperor's box on the north side: purple cloth under a gold canopy.
  const box = new TransformNode('emperor-box', world.scene);
  box.parent = decor;
  const z = -(inner + 2);
  parts.part('box', STANDS.purple, box, [6, 0.2, 3], [0, ARENA.wallHeight + 1.6, z], { castShadow: false });
  parts.part('box', STANDS.gold, box, [6.4, 0.25, 3.4], [0, ARENA.wallHeight + 5, z]);
  for (const x of [-3, 3]) parts.part('box', STANDS.gold, box, [0.3, 3.4, 0.3], [x, ARENA.wallHeight + 3.3, z + 1.5]);
}
