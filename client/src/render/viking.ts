import type { TransformNode } from './babylon.ts';
import { type ArmyPalette, COLORS, ROMAN, VIKING_LOOK } from '../visualConfig.ts';
import { addFace, addSpear, FACE_Z, HEAD, HEAD_HEIGHT, HIP_HEIGHT, type PersonBody, SHOULDER_HEIGHT, type ShieldPose } from './legionary.ts';
import { childNode, type PartFactory, type PartOptions } from './parts.ts';

/**
 * Vikings as chunky blocks, the same height and build as the legionaries so they read as the same
 * game: wolf and bear pelts over the shoulders, big beards and long hair, scars, bare muscled arms
 * with arm rings, a round painted shield and a bearded axe. Unlike the uniform legion, every
 * warrior looks a little different (see `vikingLook`).
 */

const GLOSS: PartOptions = { gloss: true };
const METAL: PartOptions = { metal: true };
const SMALL: PartOptions = { gloss: true, castShadow: false };

const ROUND_SHIELD_POSE: ShieldPose = { rest: [-0.66, 0.92, 0.06], restYaw: 0.3, raised: [-0.04, 1.02, 0.52] };
const SHIELD_DIAMETER = 0.98;

/** Everything that varies between warriors, picked from their id so it never changes mid-battle. */
export interface VikingLook {
  skin: string;
  skinShade: string;
  beard: string;
  pelt: (typeof VIKING_LOOK.pelts)[number];
  helmet: boolean;
  scar: boolean;
  braids: boolean;
}

function pickFrom<T>(list: readonly T[], n: number): T {
  return list[((n % list.length) + list.length) % list.length] as T;
}

/** A small, stable spread of looks; `variant` also names the baked mesh, so equal looks share it. */
export function vikingLook(id: number): { look: VikingLook; variant: string } {
  const n = Math.abs((id * 2654435761) | 0);
  const skinIndex = n % VIKING_LOOK.skins.length;
  const beardIndex = Math.floor(n / 7) % VIKING_LOOK.beards.length;
  const peltIndex = Math.floor(n / 53) % VIKING_LOOK.pelts.length;
  const helmet = Math.floor(n / 211) % 2 === 0;
  const scar = Math.floor(n / 401) % 3 === 0;
  const braids = Math.floor(n / 977) % 2 === 0;
  const look: VikingLook = {
    skin: pickFrom(VIKING_LOOK.skins, skinIndex),
    skinShade: pickFrom(VIKING_LOOK.skinShades, skinIndex),
    beard: pickFrom(VIKING_LOOK.beards, beardIndex),
    pelt: pickFrom(VIKING_LOOK.pelts, peltIndex),
    helmet,
    scar,
    braids,
  };
  return { look, variant: `${skinIndex}${beardIndex}${peltIndex}${helmet ? 'h' : ''}${scar ? 's' : ''}${braids ? 'b' : ''}` };
}

function addLeg(parts: PartFactory, torso: TransformNode, side: number): TransformNode {
  const leg = childNode('leg', torso, side * 0.19, HIP_HEIGHT, 0);
  parts.part('box', VIKING_LOOK.wool, leg, [0.28, 0.5, 0.3], [0, -0.27, 0], GLOSS);
  // Leg wraps from the knee down, and fur-trimmed boots.
  parts.part('box', VIKING_LOOK.wraps, leg, [0.3, 0.2, 0.32], [0, -0.38, 0], GLOSS);
  parts.part('box', VIKING_LOOK.leather, leg, [0.32, 0.14, 0.4], [0, -0.53, 0.05], GLOSS);
  return leg;
}

/** Bare, thick arms: a fur shoulder, a big upper arm with a gold arm ring, a leather bracer. */
function addArm(parts: PartFactory, torso: TransformNode, side: number, look: VikingLook): TransformNode {
  const arm = childNode('arm', torso, side * 0.52, SHOULDER_HEIGHT, 0.02);
  parts.part('box', look.pelt.fur, arm, [0.28, 0.22, 0.28], [0, -0.06, 0], GLOSS);
  parts.part('box', look.skin, arm, [0.25, 0.3, 0.25], [0, -0.32, 0], GLOSS);
  parts.part('box', VIKING_LOOK.armRing, arm, [0.27, 0.05, 0.27], [0, -0.28, 0], METAL);
  parts.part('box', VIKING_LOOK.leather, arm, [0.24, 0.18, 0.24], [0, -0.5, 0.01], GLOSS);
  parts.part('box', look.skin, arm, [0.22, 0.12, 0.23], [0, -0.63, 0.01], GLOSS);
  return arm;
}

/** Tunic in the army's color, a belt, a fur pelt over the shoulders and down the back; the jarl wears mail. */
function addBody(parts: PartFactory, torso: TransformNode, palette: ArmyPalette, look: VikingLook, jarl: boolean): void {
  parts.part('box', palette.body, torso, [0.86, 0.36, 0.54], [0, 0.66, 0], GLOSS);
  parts.part('box', palette.body, torso, [0.84, 0.66, 0.52], [0, 1.05, 0], GLOSS);
  if (jarl) parts.part('box', VIKING_LOOK.mail, torso, [0.88, 0.56, 0.56], [0, 1.0, 0], METAL);
  // A strip of trim down the front of the tunic.
  parts.part('box', palette.trim, torso, [0.12, 0.62, 0.02], [0, 0.9, 0.28], SMALL);
  parts.part('box', VIKING_LOOK.leather, torso, [0.9, 0.1, 0.58], [0, 0.82, 0], GLOSS);
  parts.part('box', VIKING_LOOK.iron, torso, [0.14, 0.09, 0.04], [0, 0.82, 0.3], SMALL);
  // The pelt: a thick fur collar, the hide down the back, and lighter tufts.
  parts.part('box', look.pelt.fur, torso, [0.98, 0.2, 0.62], [0, 1.36, -0.02], GLOSS);
  parts.part('box', look.pelt.fur, torso, [0.8, 0.7, 0.1], [0, 1.02, -0.3], GLOSS);
  for (const x of [-0.3, 0, 0.3]) parts.part('box', look.pelt.tuft, torso, [0.16, 0.08, 0.64], [x, 1.47, -0.02], SMALL);
}

/** A beard (with braids or not), a moustache, long hair down the back, maybe a scar, bushy brows. */
function addHair(parts: PartFactory, head: TransformNode, look: VikingLook): void {
  const half = HEAD / 2;
  parts.part('box', look.beard, head, [HEAD + 0.04, 0.24, 0.16], [0, -0.22, FACE_Z - 0.02], GLOSS);
  parts.part('box', look.beard, head, [0.36, 0.2, 0.14], [0, -0.38, FACE_Z - 0.04], GLOSS);
  if (look.braids) for (const side of [-1, 1]) parts.part('box', look.beard, head, [0.07, 0.22, 0.07], [side * 0.1, -0.52, FACE_Z - 0.04], SMALL);
  parts.part('box', look.beard, head, [0.3, 0.06, 0.04], [0, -0.12, FACE_Z + 0.03], SMALL);
  // Hair over the crown and down the back to the shoulders.
  parts.part('box', look.beard, head, [HEAD + 0.06, 0.1, HEAD + 0.06], [0, half + 0.02, -0.02], GLOSS);
  parts.part('box', look.beard, head, [HEAD + 0.06, 0.62, 0.14], [0, -0.06, -half - 0.05], GLOSS);
  for (const side of [-1, 1]) parts.part('box', look.beard, head, [0.08, 0.42, 0.24], [side * (half + 0.04), 0.02, -0.12], GLOSS);
  if (look.scar) {
    const scar = parts.part('box', VIKING_LOOK.scar, head, [0.035, 0.26, 0.02], [-0.13, 0.03, FACE_Z + 0.022], SMALL);
    scar.rotation.z = 0.5;
  }
}

/** An iron cap with a nose guard; the jarl's has a gold band and eye guards. No horns. */
function addHelmet(parts: PartFactory, head: TransformNode, look: VikingLook, jarl: boolean): TransformNode {
  const helmet = childNode('helmet', head);
  if (!look.helmet && !jarl) return helmet;
  const half = HEAD / 2;
  parts.part('box', VIKING_LOOK.iron, helmet, [HEAD + 0.1, 0.24, HEAD + 0.1], [0, half - 0.02, 0], METAL);
  parts.part('box', VIKING_LOOK.ironDark, helmet, [0.32, 0.1, 0.32], [0, half + 0.12, 0], METAL);
  parts.part('box', VIKING_LOOK.ironDark, helmet, [0.07, 0.22, 0.05], [0, half - 0.16, half + 0.05], METAL);
  if (jarl) {
    parts.part('box', COLORS.gold, helmet, [HEAD + 0.12, 0.05, HEAD + 0.12], [0, half - 0.1, 0], METAL);
    for (const side of [-1, 1]) parts.part('box', VIKING_LOOK.ironDark, helmet, [0.16, 0.05, 0.04], [side * 0.12, 0.08, half + 0.04], METAL);
  }
  return helmet;
}

/** A round wooden shield painted in the army's colors, quartered with its trim, an iron boss and a rim. */
function addRoundShield(parts: PartFactory, torso: TransformNode, palette: ArmyPalette): TransformNode {
  const shield = childNode('round-shield', torso, ...ROUND_SHIELD_POSE.rest);
  const face = (color: string, size: number, thickness: number, offset: number): void => {
    parts.part('disc', color, shield, [size, thickness, size], [offset, 0, 0], GLOSS).rotation.z = Math.PI / 2;
  };
  // The rim sits clearly behind the painted face, so the two never flicker through each other.
  face(VIKING_LOOK.shieldRim, SHIELD_DIAMETER + 0.07, 0.06, -0.03);
  face(palette.body, SHIELD_DIAMETER, 0.08, 0.02);
  parts.part('box', palette.trim, shield, [0.11, SHIELD_DIAMETER * 0.9, 0.12], [0.02, 0, 0], SMALL);
  parts.part('box', palette.trim, shield, [0.11, 0.12, SHIELD_DIAMETER * 0.9], [0.02, 0, 0], SMALL);
  parts.part('dome', VIKING_LOOK.iron, shield, [0.24, 0.24, 0.24], [0.05, 0, 0], METAL).rotation.z = -Math.PI / 2;
  return shield;
}

/** A bearded axe: a long haft and an iron head whose lower edge hooks down. */
export function addAxe(parts: PartFactory, grip: TransformNode, jarl: boolean): TransformNode {
  const axe = childNode('axe', grip);
  parts.part('box', ROMAN.wood, axe, [0.07, 0.82, 0.07], [0, -0.26, 0], GLOSS);
  parts.part('box', VIKING_LOOK.leather, axe, [0.085, 0.14, 0.085], [0, 0.06, 0], SMALL);
  const metal = jarl ? COLORS.gold : VIKING_LOOK.iron;
  parts.part('box', VIKING_LOOK.ironDark, axe, [0.1, 0.12, 0.12], [0, -0.62, 0], METAL);
  parts.part('box', metal, axe, [0.05, 0.16, 0.26], [0, -0.62, 0.17], METAL);
  // The beard: the blade drops below the haft, wider at the edge.
  parts.part('box', metal, axe, [0.05, 0.3, 0.1], [0, -0.57, 0.31], METAL);
  parts.part('box', ROMAN.bladeEdge, axe, [0.055, 0.32, 0.03], [0, -0.57, 0.36], METAL);
  return axe;
}

/** The axe tucked in the belt while the spear is in hand. */
function addBeltAxe(parts: PartFactory, torso: TransformNode): TransformNode {
  const axe = childNode('belt-axe', torso, 0.47, 0.84, 0.06);
  axe.rotation.z = -0.25;
  parts.part('box', ROMAN.wood, axe, [0.06, 0.6, 0.06], [0, -0.16, 0], GLOSS);
  parts.part('box', VIKING_LOOK.iron, axe, [0.05, 0.2, 0.2], [0, -0.42, 0.1], METAL);
  return axe;
}

/** A drinking horn for the mead feast. */
function addHorn(parts: PartFactory, grip: TransformNode): TransformNode {
  const horn = childNode('horn', grip, 0, 0.04, 0.06);
  parts.part('box', VIKING_LOOK.hornCup, horn, [0.07, 0.12, 0.07], [0, 0.02, 0], SMALL);
  parts.part('box', VIKING_LOOK.hornCup, horn, [0.12, 0.14, 0.12], [0, 0.14, 0.03], SMALL);
  parts.part('box', VIKING_LOOK.armRing, horn, [0.13, 0.03, 0.13], [0, 0.2, 0.03], SMALL);
  parts.part('box', VIKING_LOOK.mead, horn, [0.1, 0.02, 0.1], [0, 0.215, 0.03], SMALL);
  horn.setEnabled(false);
  return horn;
}

/** A Viking warrior (`jarl` false) or the jarl who leads them. */
export function buildViking(parts: PartFactory, body: TransformNode, palette: ArmyPalette, jarl: boolean, look: VikingLook): PersonBody {
  const torso = childNode('torso', body);
  const legL = addLeg(parts, torso, -1);
  const legR = addLeg(parts, torso, 1);
  addBody(parts, torso, palette, look, jarl);

  const head = childNode('head', torso, 0, HEAD_HEIGHT, 0);
  const face = addFace(parts, head, { skin: look.skin, skinShade: look.skinShade, brow: look.beard, browHeight: 0.055 });
  addHair(parts, head, look);
  const helmet = addHelmet(parts, head, look, jarl);

  const armL = addArm(parts, torso, -1, look);
  const armR = addArm(parts, torso, 1, look);
  const grip = childNode('grip', armR, 0, -0.62, 0.04);
  const shield = addRoundShield(parts, torso, palette);

  let cape: TransformNode | null = null;
  if (jarl) {
    // A bear-skin cloak.
    cape = childNode('cape', torso, 0, 1.42, -0.32);
    parts.part('box', VIKING_LOOK.pelts[1].fur, cape, [0.9, 1.15, 0.07], [0, -0.57, -0.02], GLOSS);
    parts.part('box', VIKING_LOOK.pelts[1].tuft, cape, [0.92, 0.1, 0.09], [0, -1.12, -0.02], GLOSS);
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
    shieldPose: ROUND_SHIELD_POSE,
    weapons: { axe: addAxe(parts, grip, jarl), spear: addSpear(parts, grip) },
    sheathed: addBeltAxe(parts, torso),
    sideArm: 'axe',
    cup: addHorn(parts, grip),
    cape,
  };
}
