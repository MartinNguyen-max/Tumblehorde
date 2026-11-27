import type { TransformNode } from '../render/babylon.ts';
import { childNode, type PartFactory, type PartOptions } from '../render/parts.ts';
import { CLOTH } from './config.ts';

/**
 * Things people hold in cutscenes, as a few big boxes each. Built under a hand's grip node
 * (or any node): the grip points down along -y when the arm hangs.
 */

const GLOSS: PartOptions = { gloss: true, castShadow: false };
const METAL: PartOptions = { metal: true, castShadow: false };

export const PROP_COLORS = {
  carvedWood: '#C89A5E',
  darkWood: '#6E4A26',
  hammerHead: '#5A5E64',
  torchHead: '#3A2A1A',
  steel: '#C8D0D8',
  wax: '#F4ECD8',
} as const;

/** The small wooden cross Anselm teaches Cassian to carve. It goes with him to the end. */
export function woodenCross(parts: PartFactory, parent: TransformNode, scale = 1): TransformNode {
  const cross = childNode('cross', parent);
  cross.scaling.setAll(scale);
  parts.part('box', PROP_COLORS.carvedWood, cross, [0.045, 0.2, 0.03], [0, 0, 0], GLOSS);
  parts.part('box', PROP_COLORS.carvedWood, cross, [0.13, 0.04, 0.03], [0, 0.045, 0], GLOSS);
  return cross;
}

/** A block of wood with a cross half cut out of it. */
export function woodBlock(parts: PartFactory, parent: TransformNode): TransformNode {
  const block = childNode('wood-block', parent);
  parts.part('box', PROP_COLORS.carvedWood, block, [0.1, 0.18, 0.06], [0, 0, 0], GLOSS);
  return block;
}

export function knife(parts: PartFactory, parent: TransformNode): TransformNode {
  const node = childNode('knife', parent);
  parts.part('box', PROP_COLORS.darkWood, node, [0.04, 0.1, 0.04], [0, 0, 0], GLOSS);
  parts.part('box', PROP_COLORS.steel, node, [0.02, 0.1, 0.035], [0, -0.1, 0], METAL);
  return node;
}

export function hammer(parts: PartFactory, parent: TransformNode): TransformNode {
  const node = childNode('hammer', parent);
  parts.part('box', PROP_COLORS.darkWood, node, [0.06, 0.5, 0.06], [0, -0.15, 0], GLOSS);
  parts.part('box', PROP_COLORS.hammerHead, node, [0.26, 0.14, 0.14], [0, -0.42, 0], METAL);
  return node;
}

export function sword(parts: PartFactory, parent: TransformNode): TransformNode {
  const node = childNode('sword', parent);
  parts.part('box', PROP_COLORS.darkWood, node, [0.07, 0.16, 0.07], [0, 0.06, 0], GLOSS);
  parts.part('box', CLOTH.gold, node, [0.22, 0.06, 0.09], [0, -0.03, 0], METAL);
  parts.part('box', PROP_COLORS.steel, node, [0.11, 0.66, 0.035], [0, -0.38, 0], METAL);
  return node;
}

/** A torch: stick and a dark head; the stage adds the flame. */
export function torch(parts: PartFactory, parent: TransformNode): TransformNode {
  const node = childNode('torch', parent);
  parts.part('box', PROP_COLORS.darkWood, node, [0.06, 0.6, 0.06], [0, 0.1, 0], GLOSS);
  parts.part('box', PROP_COLORS.torchHead, node, [0.11, 0.14, 0.11], [0, 0.42, 0], GLOSS);
  return node;
}

/** Turns a prop so it stands up in a hanging hand (grips point down). */
export function upright(node: TransformNode): TransformNode {
  node.rotation.x = Math.PI;
  return node;
}
