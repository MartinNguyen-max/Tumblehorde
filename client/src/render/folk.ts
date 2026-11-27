import type { TransformNode } from './babylon.ts';
import { type ArmyPalette, FOLK_LOOK, VIKING_LOOK } from '../visualConfig.ts';
import { addFace, addSword, FACE_Z, HEAD, HEAD_HEIGHT, HIP_HEIGHT, type PersonBody, SHOULDER_HEIGHT, type ShieldPose } from './legionary.ts';
import { childNode, type PartFactory, type PartOptions } from './parts.ts';

/**
 * The story's other folk, as chunky as everyone else: bandits (hoods, rags, a small wooden shield
 * and a sword; the two villagers wear the same) and the dead who rise on the last night (grey-green
 * skin, glowing eyes, torn clothes, and what is left of a legionary's helmet or a Viking's braids).
 */

const GLOSS: PartOptions = { gloss: true };
const SMALL: PartOptions = { gloss: true, castShadow: false };

const BUCKLER_POSE: ShieldPose = { rest: [-0.6, 0.85, 0.08], restYaw: 0.3, raised: [-0.05, 1.0, 0.5] };

function pick<T>(list: readonly T[], n: number): T {
  return list[Math.abs(n) % list.length] as T;
}

function addLeg(parts: PartFactory, torso: TransformNode, side: number, cloth: string, foot: string): TransformNode {
  const leg = childNode('leg', torso, side * 0.18, HIP_HEIGHT, 0);
  parts.part('box', cloth, leg, [0.27, 0.5, 0.29], [0, -0.27, 0], GLOSS);
  parts.part('box', foot, leg, [0.3, 0.14, 0.38], [0, -0.53, 0.05], GLOSS);
  return leg;
}

function addArm(parts: PartFactory, torso: TransformNode, side: number, sleeve: string, skin: string): TransformNode {
  const arm = childNode('arm', torso, side * 0.5, SHOULDER_HEIGHT, 0.02);
  parts.part('box', sleeve, arm, [0.23, 0.3, 0.24], [0, -0.12, 0], GLOSS);
  parts.part('box', skin, arm, [0.2, 0.34, 0.21], [0, -0.42, 0], GLOSS);
  return arm;
}

/** A hooded bandit (or a villager in the same rags), in the army's color only on a sash. */
export function buildBandit(parts: PartFactory, body: TransformNode, palette: ArmyPalette, id: number): { built: PersonBody; variant: string } {
  const n = Math.abs((id * 2654435761) | 0);
  const skin = pick(FOLK_LOOK.banditSkins, n);
  const hood = pick(FOLK_LOOK.hoods, n >> 3);
  const torso = childNode('torso', body);
  const legL = addLeg(parts, torso, -1, FOLK_LOOK.rags, VIKING_LOOK.leather);
  const legR = addLeg(parts, torso, 1, FOLK_LOOK.rags, VIKING_LOOK.leather);
  parts.part('box', FOLK_LOOK.rags, torso, [0.84, 0.36, 0.52], [0, 0.66, 0], GLOSS);
  parts.part('box', hood, torso, [0.82, 0.66, 0.5], [0, 1.05, 0], GLOSS);
  // The army's color, as a sash over one shoulder.
  const sash = parts.part('box', palette.body, torso, [0.16, 0.95, 0.56], [0, 1.0, 0], SMALL);
  sash.rotation.z = 0.6;
  parts.part('box', VIKING_LOOK.leather, torso, [0.88, 0.09, 0.56], [0, 0.82, 0], GLOSS);
  const head = childNode('head', torso, 0, HEAD_HEIGHT, 0);
  const face = addFace(parts, head, { skin, skinShade: FOLK_LOOK.stubble, brow: FOLK_LOOK.stubble, browHeight: 0.045 });
  parts.part('box', FOLK_LOOK.stubble, head, [HEAD - 0.02, 0.16, 0.04], [0, -0.2, FACE_Z], SMALL);
  // A hood over the head and down the back of the neck.
  const helmet = childNode('helmet', head);
  parts.part('box', hood, helmet, [HEAD + 0.1, 0.22, HEAD + 0.1], [0, HEAD / 2 - 0.02, -0.02], GLOSS);
  parts.part('box', hood, helmet, [HEAD + 0.1, 0.5, 0.12], [0, -0.04, -HEAD / 2 - 0.06], GLOSS);
  for (const side of [-1, 1]) parts.part('box', hood, helmet, [0.08, 0.46, 0.4], [side * (HEAD / 2 + 0.05), 0.02, -0.06], GLOSS);
  const armL = addArm(parts, torso, -1, hood, skin);
  const armR = addArm(parts, torso, 1, hood, skin);
  const grip = childNode('grip', armR, 0, -0.6, 0.04);
  const shield = childNode('buckler', torso, ...BUCKLER_POSE.rest);
  parts.part('disc', FOLK_LOOK.plainWood, shield, [0.7, 0.08, 0.7], [0, 0, 0], GLOSS).rotation.z = Math.PI / 2;
  parts.part('box', palette.body, shield, [0.1, 0.12, 0.6], [0.02, 0, 0], SMALL);
  return {
    built: {
      torso, head, helmet, ...face, legL, legR, armL, armR, shield, shieldPose: BUCKLER_POSE,
      weapons: { sword: addSword(parts, grip) }, sheathed: null, sideArm: 'sword', cup: null, cape: null,
    },
    variant: `${skin}${hood}`,
  };
}

/** Who a dead man was: a legionary (rusted helmet), a Viking (grey braids), or a villager (nothing). */
type DeadKind = 'legionary' | 'viking' | 'villager';
const DEAD_KINDS: readonly DeadKind[] = ['legionary', 'viking', 'villager'];

/** One of the dead, risen from the grave. Their army's color shows as a torn strip of cloth. */
export function buildZombie(parts: PartFactory, body: TransformNode, palette: ArmyPalette, id: number): { built: PersonBody; variant: string } {
  const n = Math.abs((id * 2654435761) | 0);
  const skin = pick(FOLK_LOOK.deadSkins, n);
  const was = pick(DEAD_KINDS, n >> 4);
  const torso = childNode('torso', body);
  const legL = addLeg(parts, torso, -1, FOLK_LOOK.deadRags, FOLK_LOOK.deadShade);
  const legR = addLeg(parts, torso, 1, FOLK_LOOK.deadRags, FOLK_LOOK.deadShade);
  parts.part('box', FOLK_LOOK.deadCloth, torso, [0.8, 0.36, 0.5], [0, 0.66, 0], GLOSS);
  parts.part('box', FOLK_LOOK.deadRags, torso, [0.78, 0.66, 0.48], [0, 1.05, 0], GLOSS);
  // Torn: skin showing through, and a ragged strip of the army's color.
  parts.part('box', skin, torso, [0.3, 0.24, 0.02], [0.14, 1.12, 0.245], SMALL);
  parts.part('box', palette.body, torso, [0.5, 0.1, 0.52], [-0.1, 0.84, 0], SMALL).rotation.z = 0.2;
  const head = childNode('head', torso, 0, HEAD_HEIGHT, 0);
  const face = addFace(parts, head, { skin, skinShade: FOLK_LOOK.deadShade, brow: FOLK_LOOK.deadShade, browHeight: 0.04 });
  // Glowing eyes over the pupils' sockets.
  for (const side of [-1, 1]) parts.part('box', FOLK_LOOK.deadEyes, head, [0.1, 0.06, 0.02], [side * 0.12, 0.03, FACE_Z + 0.022], { ...SMALL, glow: true });
  const helmet = childNode('helmet', head);
  if (was === 'legionary') parts.part('box', FOLK_LOOK.rust, helmet, [HEAD + 0.08, 0.2, HEAD + 0.08], [0, HEAD / 2 - 0.02, -0.01], GLOSS);
  if (was === 'viking') {
    parts.part('box', FOLK_LOOK.deadHair, head, [HEAD + 0.06, 0.55, 0.12], [0, -0.06, -HEAD / 2 - 0.05], GLOSS);
    parts.part('box', FOLK_LOOK.deadHair, head, [0.34, 0.26, 0.12], [0, -0.3, FACE_Z - 0.03], GLOSS);
  }
  const armL = addArm(parts, torso, -1, FOLK_LOOK.deadRags, skin);
  const armR = addArm(parts, torso, 1, FOLK_LOOK.deadRags, skin);
  return {
    built: {
      torso, head, helmet, ...face, legL, legR, armL, armR, shield: null, shieldPose: BUCKLER_POSE,
      weapons: {}, sheathed: null, sideArm: 'claw', cup: null, cape: null,
    },
    variant: `${skin}${was}`,
  };
}
