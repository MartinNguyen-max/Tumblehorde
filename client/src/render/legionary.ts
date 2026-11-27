import type { InstancedMesh, TransformNode } from './babylon.ts';
import type { Weapon } from '@tumblehorde/shared';
import { type ArmyPalette, COLORS, ROMAN } from '../visualConfig.ts';
import { childNode, type PartFactory, type PartOptions } from './parts.ts';

/**
 * Roman legionaries and their commander as chunky blocks: a big cube head, a boxy body, a big
 * square shield. Simple and readable from far away, like the first box soldiers; the fun is in
 * how they move. Feet stand at y = 0 and the soldier faces +z. Sizes are in meters.
 */

const GLOSS: PartOptions = { gloss: true };
const METAL: PartOptions = { metal: true };
const SMALL: PartOptions = { gloss: true, castShadow: false };

const HIP_HEIGHT = 0.6;
const SHOULDER_HEIGHT = 1.28;
const HEAD_HEIGHT = 1.68;
const HEAD = 0.54;
const FACE_Z = HEAD / 2 + 0.005;
export const PUPIL_X = 0.12;

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

const SCUTUM_POSE: ShieldPose = { rest: [-0.7, 0.66, 0.1], restYaw: 0.35, raised: [-0.06, 0.7, 0.52] };
const COMMANDER_SHIELD_POSE: ShieldPose = { rest: [-0.7, 0.95, 0.08], restYaw: 0.3, raised: [-0.08, 1.05, 0.52] };

function addLeg(parts: PartFactory, torso: TransformNode, side: number, officer: boolean): TransformNode {
  const leg = childNode('leg', torso, side * 0.18, HIP_HEIGHT, 0);
  parts.part('box', ROMAN.skin, leg, [0.26, 0.5, 0.28], [0, -0.27, 0], GLOSS);
  if (officer) parts.part('box', ROMAN.bronze, leg, [0.29, 0.28, 0.31], [0, -0.3, 0.01], METAL);
  parts.part('box', ROMAN.leather, leg, [0.3, 0.14, 0.38], [0, -0.53, 0.05], GLOSS);
  return leg;
}

function addArm(parts: PartFactory, torso: TransformNode, side: number, sleeve: string, armored: boolean): TransformNode {
  const arm = childNode('arm', torso, side * 0.5, SHOULDER_HEIGHT, 0.02);
  parts.part('box', sleeve, arm, [0.22, 0.26, 0.24], [0, -0.1, 0], GLOSS);
  parts.part('box', ROMAN.skin, arm, [0.19, 0.3, 0.2], [0, -0.36, 0], GLOSS);
  if (armored) parts.part('box', ROMAN.steel, arm, [0.22, 0.2, 0.23], [0, -0.38, 0], METAL);
  parts.part('box', ROMAN.skin, arm, [0.21, 0.18, 0.22], [0, -0.58, 0.01], GLOSS);
  return arm;
}

/** Box eyes with pupils, brows that can scowl, a nose and a mouth. */
function addFace(parts: PartFactory, head: TransformNode): Pick<PersonBody, 'pupils' | 'brows' | 'mouth' | 'mouthOpen' | 'deadEyes' | 'drunkFace' | 'drool'> {
  parts.part('box', ROMAN.skin, head, [HEAD, HEAD, HEAD], [0, 0, 0], GLOSS);
  const pupils: InstancedMesh[] = [];
  const brows: InstancedMesh[] = [];
  const deadEyes = childNode('dead-eyes', head);
  for (const side of [-1, 1]) {
    const x = side * PUPIL_X;
    parts.part('box', COLORS.eyeWhite, head, [0.13, 0.13, 0.02], [x, 0.03, FACE_Z], SMALL);
    pupils.push(parts.part('box', COLORS.pupil, head, [0.065, 0.075, 0.02], [x, 0.025, FACE_Z + 0.012], SMALL));
    brows.push(parts.part('box', ROMAN.brow, head, [0.15, 0.035, 0.03], [x, 0.125, FACE_Z + 0.01], SMALL));
    const cross = childNode('x-eye', deadEyes, x, 0.03, FACE_Z + 0.02);
    parts.part('box', COLORS.pupil, cross, [0.15, 0.03, 0.01], [0, 0, 0], SMALL).rotation.z = 0.8;
    parts.part('box', COLORS.pupil, cross, [0.15, 0.03, 0.01], [0, 0, 0], SMALL).rotation.z = -0.8;
  }
  deadEyes.setEnabled(false);
  parts.part('box', ROMAN.skinShade, head, [0.08, 0.12, 0.07], [0, -0.06, FACE_Z + 0.025], SMALL);
  const mouth = parts.part('box', ROMAN.mouth, head, [0.14, 0.03, 0.02], [0, -0.17, FACE_Z], SMALL);
  const mouthOpen = parts.part('box', ROMAN.mouthInside, head, [0.14, 0.1, 0.02], [0, -0.17, FACE_Z], SMALL);
  mouthOpen.setEnabled(false);
  const drunkFace = childNode('drunk-face', head);
  parts.part('box', ROMAN.drunkNose, drunkFace, [0.11, 0.11, 0.09], [0, -0.06, FACE_Z + 0.04], SMALL);
  for (const side of [-1, 1]) {
    parts.part('box', ROMAN.blush, drunkFace, [0.1, 0.06, 0.02], [side * 0.17, -0.09, FACE_Z + 0.004], SMALL);
    // Heavy eyelids, half shut.
    parts.part('box', ROMAN.skinShade, drunkFace, [0.14, 0.07, 0.03], [side * PUPIL_X, 0.075, FACE_Z + 0.02], SMALL);
  }
  const drool = parts.part('box', ROMAN.drool, drunkFace, [0.035, 1, 0.035], [0.05, -0.22, FACE_Z], SMALL);
  drunkFace.setEnabled(false);
  return { pupils, brows, mouth, mouthOpen, deadEyes, drunkFace, drool };
}

/** A box helmet with cheek guards and a neck guard, crowned by a crest: front to back, or side to side for the commander. */
function addHelmet(parts: PartFactory, head: TransformNode, metal: string, crest: string, officer: boolean): TransformNode {
  const helmet = childNode('helmet', head);
  const half = HEAD / 2;
  parts.part('box', metal, helmet, [HEAD + 0.08, 0.2, HEAD + 0.08], [0, half - 0.02, -0.01], METAL);
  parts.part('box', ROMAN.brass, helmet, [HEAD + 0.1, 0.05, 0.05], [0, half - 0.1, half + 0.04], SMALL);
  parts.part('box', metal, helmet, [HEAD + 0.08, 0.3, 0.08], [0, 0.05, -half - 0.04], METAL);
  for (const side of [-1, 1]) parts.part('box', metal, helmet, [0.06, 0.32, 0.22], [side * (half + 0.03), -0.02, 0.12], METAL);
  if (officer) parts.part('box', crest, helmet, [0.7, 0.26, 0.12], [0, half + 0.2, 0], GLOSS);
  else parts.part('box', crest, helmet, [0.12, 0.2, 0.52], [0, half + 0.16, -0.02], GLOSS);
  return helmet;
}

/** A tall square scutum from the ground to the chin, with a gold border, emblem and boss. */
function addScutum(parts: PartFactory, torso: TransformNode, palette: ArmyPalette): TransformNode {
  const shield = childNode('scutum', torso, ...SCUTUM_POSE.rest);
  // Wide enough that shields in a held line (0.86 m apart) touch edge to edge.
  parts.part('box', palette.body, shield, [0.1, 1.16, 0.8], [0, 0, 0], GLOSS);
  for (const y of [-0.56, 0.56]) parts.part('box', ROMAN.brass, shield, [0.13, 0.06, 0.84], [0, y, 0], METAL);
  for (const z of [-0.4, 0.4]) parts.part('box', ROMAN.brass, shield, [0.13, 1.16, 0.06], [0, 0, z], METAL);
  parts.part('box', COLORS.emblem, shield, [0.12, 0.86, 0.07], [0, 0, 0], METAL);
  parts.part('box', COLORS.emblem, shield, [0.12, 0.07, 0.5], [0, 0, 0], METAL);
  parts.part('box', ROMAN.iron, shield, [0.16, 0.22, 0.22], [-0.03, 0, 0], METAL);
  return shield;
}

function addOfficerShield(parts: PartFactory, torso: TransformNode, palette: ArmyPalette): TransformNode {
  const shield = childNode('parma', torso, ...COMMANDER_SHIELD_POSE.rest);
  parts.part('box', palette.body, shield, [0.1, 0.84, 0.66], [0, 0, 0], GLOSS);
  for (const y of [-0.41, 0.41]) parts.part('box', COLORS.gold, shield, [0.13, 0.06, 0.7], [0, y, 0], METAL);
  for (const z of [-0.33, 0.33]) parts.part('box', COLORS.gold, shield, [0.13, 0.84, 0.06], [0, 0, z], METAL);
  parts.part('box', COLORS.gold, shield, [0.16, 0.24, 0.24], [-0.03, 0, 0], METAL);
  return shield;
}

/** A plain spear: wooden shaft and a steel point. Held near the middle. */
function addSpear(parts: PartFactory, grip: TransformNode): TransformNode {
  const spear = childNode('spear', grip);
  parts.part('box', ROMAN.wood, spear, [0.07, 2.0, 0.07], [0, -0.3, 0], GLOSS);
  parts.part('cone', ROMAN.steel, spear, [0.09, 0.32, 0.09], [0, -1.44, 0], METAL).rotation.x = Math.PI;
  return spear;
}

/**
 * A short, broad gladius: a round brass pommel, a wrapped grip, a wide guard, a bright blade
 * with a dark groove down the middle and a tapered point. Still a handful of chunky boxes.
 */
function addSword(parts: PartFactory, grip: TransformNode): TransformNode {
  const sword = childNode('sword', grip);
  parts.part('box', ROMAN.brass, sword, [0.1, 0.07, 0.1], [0, 0.16, 0], METAL);
  parts.part('box', ROMAN.leather, sword, [0.075, 0.16, 0.075], [0, 0.06, 0], SMALL);
  parts.part('box', ROMAN.brass, sword, [0.26, 0.065, 0.1], [0, -0.03, 0], METAL);
  parts.part('box', ROMAN.bladeEdge, sword, [0.12, 0.5, 0.035], [0, -0.31, 0], METAL);
  parts.part('box', ROMAN.bladeGroove, sword, [0.03, 0.4, 0.045], [0, -0.28, 0], METAL);
  const point = parts.part('box', ROMAN.bladeEdge, sword, [0.085, 0.085, 0.034], [0, -0.58, 0], METAL);
  point.rotation.z = Math.PI / 4;
  return sword;
}

/** The sword in its scabbard on the right hip. */
function addScabbard(parts: PartFactory, torso: TransformNode): TransformNode {
  const scabbard = childNode('scabbard', torso, 0.46, 0.8, 0.04);
  scabbard.rotation.z = -0.2;
  parts.part('box', ROMAN.scabbard, scabbard, [0.1, 0.5, 0.06], [0, -0.2, 0], GLOSS);
  parts.part('box', ROMAN.brass, scabbard, [0.2, 0.05, 0.08], [0, 0.07, 0], SMALL);
  parts.part('box', ROMAN.wood, scabbard, [0.07, 0.14, 0.07], [0, 0.15, 0], SMALL);
  return scabbard;
}

/** A gold cup with wine in it, held in the sword hand at the banquet. */
function addCup(parts: PartFactory, grip: TransformNode): TransformNode {
  const cup = childNode('cup', grip, 0, 0.04, 0.06);
  parts.part('box', COLORS.gold, cup, [0.05, 0.1, 0.05], [0, 0.03, 0], SMALL);
  parts.part('box', COLORS.gold, cup, [0.16, 0.12, 0.16], [0, 0.14, 0], SMALL);
  parts.part('box', ROMAN.wine, cup, [0.13, 0.02, 0.13], [0, 0.2, 0], SMALL);
  cup.setEnabled(false);
  return cup;
}

/** The body: a team-colored tunic, a steel (or, for the commander, gold) chest block, belt and shoulders. */
function addBody(parts: PartFactory, torso: TransformNode, palette: ArmyPalette, officer: boolean): void {
  const armor = officer ? ROMAN.bronze : ROMAN.steel;
  parts.part('box', palette.body, torso, [0.82, 0.34, 0.52], [0, 0.66, 0], GLOSS);
  parts.part('box', palette.body, torso, [0.78, 0.66, 0.5], [0, 1.05, 0], GLOSS);
  parts.part('box', armor, torso, [0.84, 0.5, 0.56], [0, 1.08, 0], METAL);
  if (officer) {
    // Muscle cuirass: a chest plate and the line of the belly.
    parts.part('box', ROMAN.bronzeDark, torso, [0.04, 0.3, 0.02], [0, 1.08, 0.29], SMALL);
    parts.part('box', ROMAN.bronzeDark, torso, [0.5, 0.04, 0.02], [0, 1.0, 0.29], SMALL);
  } else {
    // Bands of the lorica.
    for (const y of [0.96, 1.1]) parts.part('box', ROMAN.armorDark, torso, [0.86, 0.035, 0.58], [0, y, 0], SMALL);
  }
  for (const side of [-1, 1]) parts.part('box', armor, torso, [0.3, 0.14, 0.58], [side * 0.42, 1.36, 0], METAL);
  parts.part('box', ROMAN.leather, torso, [0.86, 0.1, 0.58], [0, 0.82, 0], GLOSS);
  parts.part('box', ROMAN.brass, torso, [0.14, 0.08, 0.04], [0, 0.82, 0.3], SMALL);
  parts.part('box', palette.trim, torso, [0.5, 0.08, 0.44], [0, 1.37, 0], GLOSS);
}

/** A legionary (`officer` false) or the army's commander (`officer` true). */
export function buildRoman(parts: PartFactory, body: TransformNode, palette: ArmyPalette, officer: boolean): PersonBody {
  const torso = childNode('torso', body);
  const legL = addLeg(parts, torso, -1, officer);
  const legR = addLeg(parts, torso, 1, officer);
  addBody(parts, torso, palette, officer);

  const head = childNode('head', torso, 0, HEAD_HEIGHT, 0);
  const face = addFace(parts, head);
  const helmet = addHelmet(parts, head, officer ? COLORS.gold : ROMAN.steel, palette.body, officer);

  const armL = addArm(parts, torso, -1, palette.body, false);
  const armR = addArm(parts, torso, 1, palette.body, officer);
  const grip = childNode('grip', armR, 0, -0.6, 0.04);
  const weapons: Partial<Record<Weapon, TransformNode>> = { sword: addSword(parts, grip), spear: addSpear(parts, grip) };
  const sheathed = addScabbard(parts, torso);
  const cup = addCup(parts, grip);
  const shield = officer ? addOfficerShield(parts, torso, palette) : addScutum(parts, torso, palette);

  let cape: TransformNode | null = null;
  if (officer) {
    cape = childNode('cape', torso, 0, 1.4, -0.29);
    parts.part('box', palette.body, cape, [0.8, 1.15, 0.05], [0, -0.57, -0.02], GLOSS);
    parts.part('box', palette.trim, cape, [0.8, 0.07, 0.06], [0, -1.12, -0.02], GLOSS);
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
