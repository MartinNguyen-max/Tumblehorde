import type { InstancedMesh, TransformNode } from './babylon.ts';
import type { UnitKind, Weapon } from '@tumblehorde/shared';
import { type ArmyPalette, COLORS } from '../visualConfig.ts';
import type { PersonBody, ShieldPose } from './legionary.ts';
import { childNode, type PartFactory } from './parts.ts';

/**
 * The first round "bean" look, kept for archers and riders while they are parked
 * (see `ArmyMix`). Not developed further.
 */

const GLOSS = { gloss: true } as const;
const NO_SHADOW_GLOSS = { gloss: true, castShadow: false } as const;
export const BEAN_PUPIL_X = 0.13;
const BEAN_SHIELD_POSE: ShieldPose = { rest: [-0.6, 1.02, 0.06], restYaw: 0, raised: [-0.1, 1.12, 0.58] };

function addEyes(parts: PartFactory, head: TransformNode): { pupils: InstancedMesh[]; deadEyes: TransformNode } {
  const size = 0.2;
  const forward = 0.31;
  const pupils: InstancedMesh[] = [];
  const deadEyes = childNode('dead-eyes', head);
  for (const side of [-1, 1]) {
    const x = side * BEAN_PUPIL_X;
    parts.part('eye', COLORS.eyeWhite, head, [size, size * 1.1, size * 0.6], [x, 0, forward], NO_SHADOW_GLOSS);
    pupils.push(parts.part('eye', COLORS.pupil, head, [size * 0.45, size * 0.5, size * 0.3], [x, 0, forward + size * 0.24], NO_SHADOW_GLOSS));
    const cross = childNode('x-eye', deadEyes, x, 0, forward + size * 0.3);
    parts.part('box', COLORS.pupil, cross, [size * 0.7, size * 0.12, 0.02], [0, 0, 0], { castShadow: false }).rotation.z = 0.8;
    parts.part('box', COLORS.pupil, cross, [size * 0.7, size * 0.12, 0.02], [0, 0, 0], { castShadow: false }).rotation.z = -0.8;
  }
  deadEyes.setEnabled(false);
  return { pupils, deadEyes };
}

function addSpear(parts: PartFactory, grip: TransformNode): TransformNode {
  const spear = childNode('spear', grip);
  parts.part('disc', COLORS.wood, spear, [0.07, 2.4, 0.07], [0, -0.55, 0], GLOSS);
  parts.part('smoothCone', COLORS.steel, spear, [0.16, 0.4, 0.16], [0, -1.92, 0], GLOSS).rotation.x = Math.PI;
  return spear;
}

function addBow(parts: PartFactory, arm: TransformNode): TransformNode {
  const bow = childNode('bow', arm, 0, -0.48, 0.05);
  parts.part('capsule', COLORS.wood, bow, [0.07, 0.3, 0.07], [0, 0, 0], GLOSS).rotation.x = Math.PI / 2;
  parts.part('capsule', COLORS.wood, bow, [0.06, 0.6, 0.06], [0, 0.1, 0.38], GLOSS).rotation.x = 1.2;
  parts.part('capsule', COLORS.wood, bow, [0.06, 0.6, 0.06], [0, 0.1, -0.38], GLOSS).rotation.x = -1.2;
  parts.part('box', COLORS.edgePost, bow, [0.015, 0.015, 1.25], [0, 0.22, 0], { castShadow: false });
  return bow;
}

function addRoundShield(parts: PartFactory, torso: TransformNode, palette: ArmyPalette): TransformNode {
  const shield = childNode('round-shield', torso, ...BEAN_SHIELD_POSE.rest);
  parts.part('disc', palette.body, shield, [0.78, 0.09, 0.78], [0, 0, 0], GLOSS).rotation.z = Math.PI / 2;
  parts.part('torus', palette.trim, shield, [0.8, 0.8, 0.8], [0, 0, 0], GLOSS).rotation.z = Math.PI / 2;
  parts.part('dome', COLORS.gold, shield, [0.24, 0.24, 0.24], [-0.05, 0, 0], GLOSS).rotation.z = Math.PI / 2;
  return shield;
}

export function buildBean(parts: PartFactory, body: TransformNode, kind: UnitKind, palette: ArmyPalette): PersonBody {
  const torso = childNode('torso', body);
  const legL = childNode('legL', torso, -0.18, 0.52, 0);
  const legR = childNode('legR', torso, 0.18, 0.52, 0);
  for (const leg of [legL, legR]) {
    parts.part('capsule', palette.trim, leg, [0.24, 0.5, 0.24], [0, -0.22, 0], GLOSS);
    parts.part('sphere', COLORS.boot, leg, [0.27, 0.18, 0.36], [0, -0.46, 0.06], GLOSS);
  }
  parts.part('capsule', palette.body, torso, [0.8, 1.28, 0.7], [0, 1.08, 0], GLOSS);
  parts.part('torus', palette.trim, torso, [0.86, 0.9, 0.76], [0, 0.82, 0], GLOSS);
  const head = childNode('head', torso, 0, 1.46, 0);
  const { pupils, deadEyes } = addEyes(parts, head);
  const mouth = parts.part('sphere', COLORS.skin, head, [0.42, 0.2, 0.1], [0, -0.2, 0.3], NO_SHADOW_GLOSS);
  const helmet = childNode('helmet', head);
  if (kind === 'archer') {
    parts.part('dome', palette.trim, helmet, [0.8, 0.62, 0.76], [0, 0.14, -0.02], GLOSS);
  } else {
    parts.part('dome', COLORS.steel, helmet, [0.76, 0.6, 0.72], [0, 0.16, 0], GLOSS);
    parts.part('smoothCone', COLORS.steel, helmet, [0.12, 0.32, 0.12], [0, 0.6, 0], GLOSS);
  }
  const armL = childNode('armL', torso, -0.45, 1.22, 0.02);
  const armR = childNode('armR', torso, 0.45, 1.22, 0.02);
  for (const arm of [armL, armR]) {
    parts.part('capsule', palette.body, arm, [0.2, 0.5, 0.2], [0, -0.22, 0], GLOSS);
    parts.part('sphere', COLORS.skin, arm, [0.19, 0.19, 0.19], [0, -0.48, 0], GLOSS);
  }
  const grip = childNode('grip', armR, 0, -0.5, 0.05);
  const weapons: Partial<Record<Weapon, TransformNode>> = {};
  let shield: TransformNode | null = null;
  if (kind === 'archer') {
    weapons.bow = addBow(parts, armL);
    parts.part('capsule', COLORS.wood, torso, [0.22, 0.55, 0.16], [0.18, 1.2, -0.36], GLOSS).rotation.z = 0.3;
  } else {
    weapons.spear = addSpear(parts, grip);
    shield = addRoundShield(parts, torso, palette);
  }
  return {
    torso,
    head,
    helmet,
    pupils,
    brows: [],
    mouth,
    deadEyes,
    legL,
    legR,
    armL,
    armR,
    shield,
    shieldPose: BEAN_SHIELD_POSE,
    weapons,
    sheathed: null,
    cape: null,
  };
}
