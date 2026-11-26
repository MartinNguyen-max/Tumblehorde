import type { InstancedMesh, TransformNode } from './babylon.ts';
import type { Weapon } from '@tumblehorde/shared';
import { type ArmyPalette, COLORS, ROMAN } from '../visualConfig.ts';
import { childNode, type PartFactory, type PartOptions } from './parts.ts';

/**
 * Roman legionaries and their commander, built from simple smooth shapes.
 * Feet stand at y = 0 and the soldier faces +z. Sizes are in meters.
 */

const METAL: PartOptions = { metal: true };
const GLOSS: PartOptions = { gloss: true };
const SMALL: PartOptions = { gloss: true, castShadow: false };
const SMALL_METAL: PartOptions = { metal: true, castShadow: false };

const HIP_HEIGHT = 0.92;
const SHOULDER_HEIGHT = 1.42;
const HEAD_HEIGHT = 1.68;
export const PUPIL_X = 0.058;

/** Where the shield sits at rest (beside the body) and raised (in front of it). */
export interface ShieldPose {
  rest: readonly [number, number, number];
  restYaw: number;
  raised: readonly [number, number, number];
}

export interface PersonBody {
  torso: TransformNode;
  head: TransformNode;
  helmet: TransformNode;
  pupils: InstancedMesh[];
  brows: InstancedMesh[];
  mouth: InstancedMesh;
  /** A wide-open mouth for shouting, cheering and drunken grinning. */
  mouthOpen: InstancedMesh | null;
  /** Red nose, rosy cheeks and droopy lids, shown once drunk. */
  drunkFace: TransformNode | null;
  drool: InstancedMesh | null;
  deadEyes: TransformNode;
  legL: TransformNode;
  legR: TransformNode;
  armL: TransformNode;
  armR: TransformNode;
  shield: TransformNode | null;
  shieldPose: ShieldPose;
  weapons: Partial<Record<Weapon, TransformNode>>;
  /** The sword in its scabbard, shown while another weapon is in hand. */
  sheathed: TransformNode | null;
  /** A wine cup for the banquet. */
  cup: TransformNode | null;
  cape: TransformNode | null;
}

const SCUTUM_POSE: ShieldPose = { rest: [-0.44, 0.66, 0.1], restYaw: 0.45, raised: [-0.06, 0.7, 0.5] };
const COMMANDER_SHIELD_POSE: ShieldPose = { rest: [-0.46, 1.0, 0.06], restYaw: 0.3, raised: [-0.08, 1.12, 0.48] };

function addLeg(parts: PartFactory, torso: TransformNode, side: number, greaves: boolean): TransformNode {
  const leg = childNode('leg', torso, side * 0.12, HIP_HEIGHT, 0);
  parts.part('roundCapsule', ROMAN.skin, leg, [0.16, 0.46, 0.16], [0, -0.22, 0], GLOSS);
  parts.part('roundCapsule', ROMAN.skin, leg, [0.13, 0.44, 0.13], [0, -0.6, 0], GLOSS);
  if (greaves) parts.part('roundCapsule', ROMAN.bronze, leg, [0.15, 0.36, 0.15], [0, -0.6, 0.012], METAL);
  // Caligae: hobnailed sandals with straps up the ankle.
  parts.part('box', ROMAN.leather, leg, [0.13, 0.07, 0.27], [0, -0.885, 0.045], GLOSS);
  parts.part('roundCylinder', ROMAN.leather, leg, [0.14, 0.11, 0.15], [0, -0.81, 0.01], SMALL);
  parts.part('roundCylinder', ROMAN.darkLeather, leg, [0.135, 0.018, 0.135], [0, -0.73, 0], SMALL);
  return leg;
}

function addArm(parts: PartFactory, torso: TransformNode, side: number, sleeve: string, manica: boolean): TransformNode {
  const arm = childNode('arm', torso, side * 0.34, SHOULDER_HEIGHT, 0.01);
  parts.part('roundCapsule', sleeve, arm, [0.15, 0.26, 0.15], [0, -0.09, 0], GLOSS);
  parts.part('roundCapsule', ROMAN.skin, arm, [0.11, 0.46, 0.11], [0, -0.3, 0], GLOSS);
  if (manica) {
    // Segmented arm guard: the commander's sword arm.
    for (let i = 0; i < 4; i++) parts.part('roundCylinder', ROMAN.steel, arm, [0.135, 0.06, 0.135], [0, -0.2 - i * 0.075, 0], METAL);
  } else {
    parts.part('roundCylinder', ROMAN.leather, arm, [0.125, 0.1, 0.125], [0, -0.43, 0], GLOSS);
  }
  parts.part('roundSphere', ROMAN.skin, arm, [0.11, 0.11, 0.11], [0, -0.55, 0.01], GLOSS);
  return arm;
}

/** A face that reads from afar: eyes with pupils, brows that can scowl, a nose and a mouth. */
function addFace(parts: PartFactory, head: TransformNode): Pick<PersonBody, 'pupils' | 'brows' | 'mouth' | 'mouthOpen' | 'deadEyes' | 'drunkFace' | 'drool'> {
  parts.part('roundSphere', ROMAN.skin, head, [0.27, 0.31, 0.28], [0, 0, 0], GLOSS);
  const pupils: InstancedMesh[] = [];
  const brows: InstancedMesh[] = [];
  const deadEyes = childNode('dead-eyes', head);
  for (const side of [-1, 1]) {
    const x = side * PUPIL_X;
    parts.part('roundSphere', COLORS.eyeWhite, head, [0.07, 0.06, 0.035], [x, 0.015, 0.125], SMALL);
    pupils.push(parts.part('roundSphere', COLORS.pupil, head, [0.034, 0.038, 0.02], [x, 0.012, 0.14], SMALL));
    const brow = parts.part('box', ROMAN.brow, head, [0.075, 0.02, 0.02], [x, 0.06, 0.13], SMALL);
    brows.push(brow);
    const cross = childNode('x-eye', deadEyes, x, 0.015, 0.145);
    parts.part('box', COLORS.pupil, cross, [0.06, 0.014, 0.01], [0, 0, 0], SMALL).rotation.z = 0.8;
    parts.part('box', COLORS.pupil, cross, [0.06, 0.014, 0.01], [0, 0, 0], SMALL).rotation.z = -0.8;
  }
  deadEyes.setEnabled(false);
  parts.part('roundSphere', ROMAN.skinShade, head, [0.05, 0.085, 0.06], [0, -0.025, 0.138], SMALL);
  const mouth = parts.part('box', ROMAN.mouth, head, [0.065, 0.014, 0.012], [0, -0.083, 0.128], SMALL);
  const mouthOpen = parts.part('roundSphere', ROMAN.mouthInside, head, [0.07, 0.06, 0.03], [0, -0.088, 0.124], SMALL);
  mouthOpen.setEnabled(false);
  const drunkFace = childNode('drunk-face', head);
  parts.part('roundSphere', ROMAN.drunkNose, drunkFace, [0.065, 0.065, 0.06], [0, -0.03, 0.15], SMALL);
  for (const side of [-1, 1]) {
    parts.part('roundSphere', ROMAN.blush, drunkFace, [0.06, 0.04, 0.02], [side * 0.085, -0.045, 0.118], SMALL);
    // Heavy eyelids, half shut.
    parts.part('roundSphere', ROMAN.skinShade, drunkFace, [0.078, 0.04, 0.04], [side * PUPIL_X, 0.034, 0.13], SMALL);
  }
  const drool = parts.part('roundCapsule', ROMAN.drool, drunkFace, [0.016, 0.06, 0.016], [0.022, -0.12, 0.13], SMALL);
  drunkFace.setEnabled(false);
  return { pupils, brows, mouth, mouthOpen, deadEyes, drunkFace, drool };
}

/** A brass goblet with wine in it, held in the sword hand at the banquet. */
function addCup(parts: PartFactory, grip: TransformNode): TransformNode {
  const cup = childNode('cup', grip, 0, 0.02, 0.04);
  parts.part('roundCylinder', ROMAN.brass, cup, [0.025, 0.08, 0.025], [0, 0.02, 0], SMALL_METAL);
  parts.part('frustum', ROMAN.brass, cup, [0.11, 0.09, 0.11], [0, 0.1, 0], SMALL_METAL).rotation.x = Math.PI;
  parts.part('roundCylinder', ROMAN.wine, cup, [0.09, 0.01, 0.09], [0, 0.14, 0], SMALL);
  cup.setEnabled(false);
  return cup;
}

/** Imperial Gallic helmet: bowl, brow ridge, sloped neck guard, cheek guards and a crest. */
function addHelmet(parts: PartFactory, head: TransformNode, metal: string, crest: string, officer: boolean): TransformNode {
  const helmet = childNode('helmet', head);
  parts.part('roundDome', metal, helmet, [0.32, 0.26, 0.33], [0, 0.03, -0.005], METAL);
  parts.part('roundCylinder', metal, helmet, [0.325, 0.05, 0.335], [0, 0.03, -0.005], METAL);
  parts.part('box', ROMAN.brass, helmet, [0.27, 0.028, 0.03], [0, 0.07, 0.16], SMALL_METAL);
  const neckGuard = parts.part('box', metal, helmet, [0.32, 0.025, 0.15], [0, -0.01, -0.2], METAL);
  neckGuard.rotation.x = -0.4;
  for (const side of [-1, 1]) {
    const cheek = parts.part('box', metal, helmet, [0.02, 0.15, 0.1], [side * 0.15, -0.08, 0.05], METAL);
    cheek.rotation.z = side * 0.12;
  }
  parts.part('roundSphere', ROMAN.brass, helmet, [0.05, 0.05, 0.05], [0, 0.16, 0], SMALL_METAL);
  if (officer) {
    // Centurion-style crest running side to side, the mark of the one in charge.
    parts.part('roundCapsule', crest, helmet, [0.09, 0.46, 0.08], [0, 0.25, 0], GLOSS).rotation.z = Math.PI / 2;
    parts.part('box', ROMAN.brass, helmet, [0.3, 0.025, 0.025], [0, 0.19, 0], SMALL_METAL);
  } else {
    parts.part('roundCapsule', crest, helmet, [0.07, 0.34, 0.13], [0, 0.23, -0.01], GLOSS).rotation.x = Math.PI / 2;
  }
  return helmet;
}

/** Lorica segmentata: overlapping steel bands around the chest and layered shoulder plates. */
function addLorica(parts: PartFactory, torso: TransformNode): void {
  parts.part('roundCylinder', ROMAN.armorDark, torso, [0.5, 0.44, 0.36], [0, 1.18, 0], METAL);
  for (let i = 0; i < 4; i++) {
    parts.part('roundCylinder', ROMAN.steel, torso, [0.52 + i * 0.02, 0.07, 0.37 + i * 0.012], [0, 1.03 + i * 0.085, 0], METAL);
  }
  parts.part('roundCylinder', ROMAN.steel, torso, [0.6, 0.12, 0.41], [0, 1.37, 0], METAL);
  parts.part('box', ROMAN.brass, torso, [0.04, 0.1, 0.02], [-0.07, 1.37, 0.205], SMALL_METAL);
  parts.part('box', ROMAN.brass, torso, [0.04, 0.1, 0.02], [0.07, 1.37, 0.205], SMALL_METAL);
  addPauldrons(parts, torso, ROMAN.steel, 1);
}

/** Overlapping curved plates hugging each shoulder. */
function addPauldrons(parts: PartFactory, torso: TransformNode, metal: string, size: number): void {
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const plate = parts.part('roundSphere', metal, torso, [0.2 * size, 0.07, 0.27 * size], [side * (0.22 + i * 0.055), 1.47 - i * 0.055, 0], METAL);
      plate.rotation.z = -side * (0.3 + i * 0.35);
    }
  }
}

/** The commander's bronze muscle cuirass with big layered pauldrons. */
function addCuirass(parts: PartFactory, torso: TransformNode): void {
  parts.part('roundCapsule', ROMAN.bronze, torso, [0.56, 0.62, 0.4], [0, 1.2, 0], METAL);
  for (const side of [-1, 1]) parts.part('roundSphere', ROMAN.bronze, torso, [0.2, 0.16, 0.1], [side * 0.1, 1.32, 0.16], METAL);
  addPauldrons(parts, torso, ROMAN.bronze, 1.2);
  parts.part('box', ROMAN.bronzeDark, torso, [0.3, 0.02, 0.02], [0, 1.14, 0.2], SMALL_METAL);
  parts.part('box', ROMAN.bronzeDark, torso, [0.02, 0.24, 0.02], [0, 1.12, 0.2], SMALL_METAL);
  // Pteruges: leather strips hanging all around the waist.
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const strip = parts.part('box', ROMAN.leather, torso, [0.1, 0.24, 0.02], [Math.sin(a) * 0.3, 0.84, Math.cos(a) * 0.22], GLOSS);
    strip.rotation.y = a;
    strip.rotation.x = 0.08;
  }
}

function addBeltAndApron(parts: PartFactory, torso: TransformNode): void {
  parts.part('roundCylinder', ROMAN.leather, torso, [0.56, 0.065, 0.4], [0, 0.98, 0], GLOSS);
  for (const x of [-0.12, 0, 0.12]) parts.part('box', ROMAN.brass, torso, [0.07, 0.05, 0.02], [x, 0.98, 0.2], SMALL_METAL);
  // The apron of studded straps in front.
  for (const x of [-0.07, 0, 0.07]) {
    parts.part('box', ROMAN.darkLeather, torso, [0.035, 0.28, 0.02], [x, 0.82, 0.22], SMALL);
    parts.part('roundSphere', ROMAN.brass, torso, [0.03, 0.03, 0.02], [x, 0.69, 0.225], SMALL_METAL);
  }
}

/** A tall, curved scutum reaching from the ground to the chin, with boss and golden wings. */
function addScutum(parts: PartFactory, torso: TransformNode, palette: ArmyPalette): TransformNode {
  const shield = childNode('scutum', torso, ...SCUTUM_POSE.rest);
  const slats = 5;
  for (let i = 0; i < slats; i++) {
    const t = (i - (slats - 1) / 2) / ((slats - 1) / 2);
    const slat = parts.part('box', palette.body, shield, [0.045, 1.16, 0.15], [-0.05 * (1 - t * t), 0, t * 0.27], GLOSS);
    slat.rotation.y = -t * 0.28;
  }
  for (const y of [-0.585, 0.585]) parts.part('box', ROMAN.brass, shield, [0.06, 0.03, 0.62], [-0.03, y, 0], SMALL_METAL);
  for (const z of [-0.335, 0.335]) parts.part('box', ROMAN.brass, shield, [0.05, 1.18, 0.025], [0.0, 0, z], SMALL_METAL);
  parts.part('box', COLORS.emblem, shield, [0.02, 0.9, 0.035], [-0.075, 0, 0], SMALL_METAL);
  parts.part('box', COLORS.emblem, shield, [0.02, 0.035, 0.46], [-0.075, 0, 0], SMALL_METAL);
  for (const y of [-1, 1]) {
    for (const z of [-1, 1]) {
      const wing = parts.part('box', COLORS.emblem, shield, [0.02, 0.03, 0.2], [-0.072, y * 0.26, z * 0.12], SMALL_METAL);
      wing.rotation.x = y * z * 0.55;
    }
  }
  parts.part('box', ROMAN.iron, shield, [0.02, 0.2, 0.24], [-0.07, 0, 0], SMALL_METAL);
  parts.part('roundDome', ROMAN.iron, shield, [0.16, 0.16, 0.16], [-0.08, 0, 0], METAL).rotation.z = Math.PI / 2;
  return shield;
}

function addOfficerShield(parts: PartFactory, torso: TransformNode, palette: ArmyPalette): TransformNode {
  const shield = childNode('parma', torso, ...COMMANDER_SHIELD_POSE.rest);
  parts.part('roundCylinder', palette.body, shield, [0.9, 0.07, 0.66], [0, 0, 0], GLOSS).rotation.z = Math.PI / 2;
  parts.part('tube', ROMAN.bronze, shield, [0.9, 0.6, 0.66], [0, 0, 0], METAL).rotation.z = Math.PI / 2;
  parts.part('box', COLORS.emblem, shield, [0.02, 0.7, 0.04], [-0.045, 0, 0], SMALL_METAL);
  parts.part('roundDome', ROMAN.bronze, shield, [0.22, 0.22, 0.22], [-0.04, 0, 0], METAL).rotation.z = Math.PI / 2;
  return shield;
}

/** Pilum: wooden shaft, lead weight, long iron shank and a small hard point. Held near the middle. */
function addPilum(parts: PartFactory, grip: TransformNode): TransformNode {
  const spear = childNode('pilum', grip);
  parts.part('roundCylinder', ROMAN.wood, spear, [0.042, 1.4, 0.042], [0, -0.2, 0], GLOSS);
  parts.part('roundSphere', ROMAN.iron, spear, [0.065, 0.08, 0.065], [0, -0.9, 0], METAL);
  parts.part('roundCylinder', ROMAN.iron, spear, [0.022, 0.62, 0.022], [0, -1.2, 0], METAL);
  parts.part('smoothCone', ROMAN.steel, spear, [0.05, 0.13, 0.05], [0, -1.56, 0], METAL).rotation.x = Math.PI;
  return spear;
}

/** Gladius: short broad blade, brass guard and a round pommel. */
function addGladius(parts: PartFactory, grip: TransformNode): TransformNode {
  const sword = childNode('gladius', grip);
  parts.part('roundSphere', ROMAN.brass, sword, [0.07, 0.06, 0.07], [0, 0.11, 0], SMALL_METAL);
  parts.part('roundCylinder', ROMAN.wood, sword, [0.04, 0.12, 0.04], [0, 0.04, 0], SMALL);
  parts.part('box', ROMAN.brass, sword, [0.13, 0.04, 0.06], [0, -0.03, 0], SMALL_METAL);
  parts.part('box', ROMAN.steel, sword, [0.065, 0.5, 0.016], [0, -0.3, 0], METAL);
  parts.part('smoothCone', ROMAN.steel, sword, [0.065, 0.1, 0.016], [0, -0.6, 0], METAL).rotation.x = Math.PI;
  return sword;
}

/** The sheathed gladius, worn high on the right hip as legionaries did. */
function addScabbard(parts: PartFactory, torso: TransformNode): TransformNode {
  const scabbard = childNode('scabbard', torso, 0.31, 0.96, 0.02);
  scabbard.rotation.z = -0.25;
  scabbard.rotation.x = -0.15;
  parts.part('box', ROMAN.scabbard, scabbard, [0.08, 0.5, 0.035], [0, -0.22, 0], GLOSS);
  parts.part('box', ROMAN.brass, scabbard, [0.09, 0.05, 0.045], [0, -0.02, 0], SMALL_METAL);
  parts.part('box', ROMAN.brass, scabbard, [0.09, 0.06, 0.045], [0, -0.45, 0], SMALL_METAL);
  parts.part('box', ROMAN.brass, scabbard, [0.13, 0.035, 0.06], [0, 0.03, 0], SMALL_METAL);
  parts.part('roundCylinder', ROMAN.wood, scabbard, [0.04, 0.11, 0.04], [0, 0.1, 0], SMALL);
  parts.part('roundSphere', ROMAN.brass, scabbard, [0.065, 0.055, 0.065], [0, 0.17, 0], SMALL_METAL);
  return scabbard;
}

/** A legionary (`officer` false) or the army's commander (`officer` true). */
export function buildRoman(parts: PartFactory, body: TransformNode, palette: ArmyPalette, officer: boolean): PersonBody {
  const torso = childNode('torso', body);
  const legL = addLeg(parts, torso, -1, officer);
  const legR = addLeg(parts, torso, 1, officer);
  // The tunic shows below the armor as a short skirt.
  parts.part('frustum', palette.body, torso, [0.6, 0.36, 0.44], [0, 0.82, 0], GLOSS);
  if (officer) addCuirass(parts, torso);
  else addLorica(parts, torso);
  addBeltAndApron(parts, torso);
  parts.part('roundCylinder', ROMAN.skin, torso, [0.13, 0.12, 0.13], [0, 1.54, 0], GLOSS);
  parts.part('tube', palette.trim, torso, [0.2, 0.5, 0.2], [0, 1.5, 0.01], GLOSS);

  const head = childNode('head', torso, 0, HEAD_HEIGHT, 0);
  const face = addFace(parts, head);
  const helmet = addHelmet(parts, head, officer ? ROMAN.bronze : ROMAN.steel, palette.body, officer);

  const armL = addArm(parts, torso, -1, palette.body, false);
  const armR = addArm(parts, torso, 1, palette.body, officer);
  const grip = childNode('grip', armR, 0, -0.55, 0.03);
  const weapons: Partial<Record<Weapon, TransformNode>> = { sword: addGladius(parts, grip), spear: addPilum(parts, grip) };
  const sheathed = addScabbard(parts, torso);
  const cup = addCup(parts, grip);
  const shield = officer ? addOfficerShield(parts, torso, palette) : addScutum(parts, torso, palette);

  let cape: TransformNode | null = null;
  if (officer) {
    cape = childNode('cape', torso, 0, 1.47, -0.2);
    parts.part('box', palette.body, cape, [0.62, 1.1, 0.035], [0, -0.55, -0.02], GLOSS);
    parts.part('box', palette.trim, cape, [0.62, 0.05, 0.04], [0, -1.08, -0.02], GLOSS);
    for (const side of [-1, 1]) parts.part('roundSphere', COLORS.gold, torso, [0.07, 0.07, 0.04], [side * 0.22, 1.47, 0.12], SMALL_METAL);
  }
  return {
    torso,
    head,
    helmet,
    ...face,
    legL,
    legR,
    armL,
    armR,
    shield,
    shieldPose: officer ? COMMANDER_SHIELD_POSE : SCUTUM_POSE,
    weapons,
    sheathed,
    cup,
    cape,
  };
}
