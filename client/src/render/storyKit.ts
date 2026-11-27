import type { TransformNode } from './babylon.ts';
import { type ActorLook, clothOf } from '../cinematic/actor.ts';
import { CLOTH, HAIR, SKIN } from '../cinematic/config.ts';
import { type ArmyPalette, ROMAN } from '../visualConfig.ts';
import { addFace, addSpear, addSword, FACE_Z, HEAD, HEAD_HEIGHT, HIP_HEIGHT, type PersonBody, SHOULDER_HEIGHT, type ShieldPose } from './legionary.ts';
import { childNode, type PartFactory, type PartOptions } from './parts.ts';

/**
 * The story's people in battle, built from the very look the cutscenes use (`ActorLook`), so
 * Cassian fights in the rags, silver armor or legion red the scene before showed him in, and
 * Felix and Rufus look like the villagers they are. Same skeleton as every battle soldier.
 */

const GLOSS: PartOptions = { gloss: true };
const METAL: PartOptions = { metal: true };
const SMALL: PartOptions = { gloss: true, castShadow: false };

/** What a story person carries on the left arm. */
type ShieldKind = 'wood' | 'scutum' | 'officer' | 'round' | 'aspis';

const WOOD_POSE: ShieldPose = { rest: [-0.62, 0.86, 0.08], restYaw: 0.3, raised: [-0.05, 1.0, 0.5] };
const SCUTUM_POSE: ShieldPose = { rest: [-0.7, 0.66, 0.1], restYaw: 0.35, raised: [-0.06, 0.7, 0.52] };
const OFFICER_POSE: ShieldPose = { rest: [-0.7, 0.95, 0.08], restYaw: 0.3, raised: [-0.08, 1.05, 0.52] };

function shieldFor(look: ActorLook): ShieldKind {
  switch (look.outfit) {
    case 'legion':
      return 'scutum';
    case 'commander':
      return 'officer';
    case 'viking':
    case 'warlord':
    case 'mongol':
      return 'round';
    case 'hoplite':
      return 'aspis';
    default:
      return 'wood';
  }
}

function armored(look: ActorLook): string | null {
  switch (look.outfit) {
    case 'legion':
      return CLOTH.steel;
    case 'silver':
      return CLOTH.silver;
    case 'commander':
      return CLOTH.gold;
    case 'warlord':
      return CLOTH.steel;
    case 'hoplite':
      return CLOTH.bronze;
    default:
      return null;
  }
}

function addLegs(parts: PartFactory, torso: TransformNode, look: ActorLook, skin: string): [TransformNode, TransformNode] {
  const trousers = look.outfit === 'viking' || look.outfit === 'warlord' || look.outfit === 'bandit' || look.outfit === 'villager' || look.outfit === 'mongol';
  const color = trousers ? CLOTH.ragsDark : skin;
  const legs = [-1, 1].map((side) => {
    const leg = childNode('leg', torso, side * 0.18, HIP_HEIGHT, 0);
    parts.part('box', color, leg, [0.26, 0.5, 0.28], [0, -0.27, 0], GLOSS);
    parts.part('box', look.outfit === 'rags' ? skin : CLOTH.boots, leg, [0.3, 0.14, 0.38], [0, -0.53, 0.05], GLOSS);
    return leg;
  });
  return [legs[0] as TransformNode, legs[1] as TransformNode];
}

function addArm(parts: PartFactory, torso: TransformNode, side: number, look: ActorLook, skin: string): TransformNode {
  const cloth = clothOf(look);
  const arm = childNode('arm', torso, side * 0.5, SHOULDER_HEIGHT, 0.02);
  parts.part('box', cloth.sleeve, arm, [0.22, 0.26, 0.24], [0, -0.1, 0], GLOSS);
  parts.part('box', skin, arm, [0.19, 0.3, 0.2], [0, -0.36, 0], GLOSS);
  const metal = armored(look);
  if (metal) parts.part('box', metal, arm, [0.22, 0.2, 0.23], [0, -0.38, 0], METAL);
  parts.part('box', skin, arm, [0.21, 0.18, 0.22], [0, -0.58, 0.01], GLOSS);
  return arm;
}

function addBody(parts: PartFactory, torso: TransformNode, look: ActorLook): void {
  const cloth = clothOf(look);
  parts.part('box', cloth.main, torso, [0.82, 0.34, 0.52], [0, 0.66, 0], GLOSS);
  parts.part('box', cloth.main, torso, [0.78, 0.66, 0.5], [0, 1.05, 0], GLOSS);
  const metal = armored(look);
  if (metal) {
    parts.part('box', metal, torso, [0.84, 0.5, 0.56], [0, 1.08, 0], METAL);
    for (const side of [-1, 1]) parts.part('box', metal, torso, [0.3, 0.14, 0.58], [side * 0.42, 1.36, 0], METAL);
  }
  if (look.outfit === 'rags') {
    // Torn: a patch of darker cloth and a rope for a belt.
    parts.part('box', cloth.dark, torso, [0.3, 0.22, 0.03], [-0.15, 1.0, 0.26], SMALL);
    parts.part('box', CLOTH.rope, torso, [0.84, 0.06, 0.56], [0, 0.82, 0], SMALL);
    return;
  }
  if (look.outfit === 'mongol') {
    parts.part('box', cloth.main, torso, [0.86, 0.4, 0.56], [0, 0.56, 0], GLOSS);
    parts.part('box', CLOTH.lamellar, torso, [0.84, 0.52, 0.56], [0, 1.1, 0], GLOSS);
    for (let row = 0; row < 3; row++) parts.part('box', CLOTH.lamellarEdge, torso, [0.86, 0.04, 0.58], [0, 0.94 + row * 0.15, 0], SMALL);
    parts.part('box', CLOTH.mongolSash, torso, [0.88, 0.12, 0.58], [0, 0.82, 0], GLOSS);
    parts.part('box', CLOTH.fur, torso, [0.62, 0.1, 0.54], [0, 1.4, 0], GLOSS);
    return;
  }
  parts.part('box', CLOTH.leather, torso, [0.86, 0.1, 0.58], [0, 0.82, 0], GLOSS);
  if (look.outfit === 'viking' || look.outfit === 'warlord') {
    const fur = look.outfit === 'warlord' ? CLOTH.peltLight : CLOTH.pelt;
    parts.part('box', fur, torso, [0.98, 0.22, 0.62], [0, 1.4, 0], GLOSS);
  }
}

function addHair(parts: PartFactory, head: TransformNode, look: ActorLook): void {
  const hair = look.hair ?? HAIR.brown;
  const half = HEAD / 2;
  switch (look.hairStyle ?? 'short') {
    case 'bald':
      break;
    case 'tonsure':
      parts.part('box', hair, head, [HEAD + 0.04, 0.12, 0.14], [0, half - 0.12, -half + 0.02], GLOSS);
      break;
    case 'long':
    case 'braids':
      parts.part('box', hair, head, [HEAD + 0.06, 0.1, HEAD + 0.06], [0, half + 0.02, -0.02], GLOSS);
      parts.part('box', hair, head, [HEAD + 0.06, 0.6, 0.14], [0, -0.06, -half - 0.05], GLOSS);
      break;
    case 'short':
      parts.part('box', hair, head, [HEAD + 0.04, 0.1, HEAD + 0.04], [0, half + 0.02, -0.02], GLOSS);
      break;
  }
  const beard = look.beard ?? 'none';
  if (beard === 'none') return;
  const color = look.beardColor ?? hair;
  const depth = beard === 'stubble' ? 0.04 : 0.14;
  const height = beard === 'long' ? 0.4 : beard === 'short' ? 0.24 : 0.16;
  parts.part('box', color, head, [HEAD + 0.02, height, depth], [0, -0.18 - (height - 0.24) / 2, FACE_Z - depth / 2 + 0.02], beard === 'stubble' ? SMALL : GLOSS);
}

function addHelmet(parts: PartFactory, head: TransformNode, look: ActorLook): TransformNode {
  const helmet = childNode('helmet', head);
  if (!look.helmet) return helmet;
  const half = HEAD / 2;
  if (look.outfit === 'mongol') {
    parts.part('box', CLOTH.steel, helmet, [HEAD + 0.08, 0.2, HEAD + 0.08], [0, half - 0.02, -0.01], METAL);
    parts.part('dome', CLOTH.steel, helmet, [HEAD + 0.06, 0.2, HEAD + 0.06], [0, half + 0.08, -0.01], METAL);
    parts.part('box', CLOTH.steel, helmet, [0.05, 0.12, 0.05], [0, half + 0.24, -0.01], METAL);
    parts.part('box', CLOTH.fur, helmet, [HEAD + 0.1, 0.06, HEAD + 0.1], [0, half - 0.12, -0.01], GLOSS);
    for (const side of [-1, 1]) parts.part('box', CLOTH.leather, helmet, [0.05, 0.3, 0.26], [side * (half + 0.03), -0.06, -0.06], GLOSS);
    parts.part('box', CLOTH.leather, helmet, [HEAD + 0.06, 0.3, 0.05], [0, -0.06, -half - 0.03], GLOSS);
    return helmet;
  }
  const metal = armored(look) ?? CLOTH.steel;
  parts.part('box', metal, helmet, [HEAD + 0.08, 0.2, HEAD + 0.08], [0, half - 0.02, -0.01], METAL);
  if (look.outfit === 'hoplite') {
    parts.part('box', metal, helmet, [HEAD + 0.08, 0.4, 0.1], [0, 0, -half - 0.04], METAL);
    for (const side of [-1, 1]) parts.part('box', metal, helmet, [0.06, 0.3, 0.2], [side * (half + 0.04), -0.08, half - 0.1], METAL);
    parts.part('box', look.cape ?? CLOTH.legion, helmet, [0.62, 0.26, 0.12], [0, half + 0.2, 0], GLOSS);
    return helmet;
  }
  if (look.outfit === 'legion' || look.outfit === 'commander') {
    parts.part('box', metal, helmet, [HEAD + 0.08, 0.3, 0.08], [0, 0.05, -half - 0.04], METAL);
    const crest = look.cape ?? CLOTH.legion;
    if (look.outfit === 'commander') parts.part('box', crest, helmet, [0.7, 0.26, 0.12], [0, half + 0.2, 0], GLOSS);
    else parts.part('box', crest, helmet, [0.12, 0.2, 0.52], [0, half + 0.16, -0.02], GLOSS);
  } else {
    // A plain cap with a nose guard.
    parts.part('box', metal, helmet, [0.06, 0.22, 0.06], [0, -0.02, half + 0.04], METAL);
  }
  return helmet;
}

function addShield(parts: PartFactory, torso: TransformNode, kind: ShieldKind, palette: ArmyPalette): { shield: TransformNode; pose: ShieldPose } {
  switch (kind) {
    case 'scutum': {
      const shield = childNode('scutum', torso, ...SCUTUM_POSE.rest);
      parts.part('box', palette.body, shield, [0.1, 1.16, 0.8], [0, 0, 0], GLOSS);
      for (const z of [-0.4, 0.4]) parts.part('box', ROMAN.brass, shield, [0.13, 1.16, 0.06], [0, 0, z], METAL);
      parts.part('box', ROMAN.iron, shield, [0.16, 0.22, 0.22], [-0.03, 0, 0], METAL);
      return { shield, pose: SCUTUM_POSE };
    }
    case 'officer': {
      const shield = childNode('parma', torso, ...OFFICER_POSE.rest);
      parts.part('box', palette.body, shield, [0.1, 0.84, 0.66], [0, 0, 0], GLOSS);
      parts.part('box', CLOTH.gold, shield, [0.16, 0.24, 0.24], [-0.03, 0, 0], METAL);
      return { shield, pose: OFFICER_POSE };
    }
    case 'aspis': {
      // The hoplite's great round shield: bronze-faced, held across the body.
      const shield = childNode('aspis', torso, ...SCUTUM_POSE.rest);
      parts.part('disc', CLOTH.bronze, shield, [1.15, 0.1, 1.15], [0, 0, 0], METAL).rotation.z = Math.PI / 2;
      parts.part('disc', palette.body, shield, [0.5, 0.11, 0.5], [0.01, 0, 0], GLOSS).rotation.z = Math.PI / 2;
      return { shield, pose: SCUTUM_POSE };
    }
    case 'round':
    case 'wood': {
      const shield = childNode('wood-shield', torso, ...WOOD_POSE.rest);
      const face = kind === 'round' ? palette.body : ROMAN.wood;
      parts.part('disc', face, shield, [0.78, 0.08, 0.78], [0, 0, 0], GLOSS).rotation.z = Math.PI / 2;
      parts.part('box', CLOTH.leather, shield, [0.1, 0.7, 0.08], [0.02, 0, 0], SMALL);
      parts.part('dome', ROMAN.iron, shield, [0.2, 0.2, 0.2], [0.04, 0, 0], METAL).rotation.z = -Math.PI / 2;
      return { shield, pose: WOOD_POSE };
    }
  }
}

/** The Mongol's curved saber: a blade in three bends, and a small guard. */
function addSaber(parts: PartFactory, grip: TransformNode): TransformNode {
  const saber = childNode('saber', grip);
  // Held like the legion's sword: the grip in the hand, the blade hanging down from it.
  parts.part('box', CLOTH.leather, saber, [0.075, 0.18, 0.075], [0, 0.07, 0], GLOSS);
  parts.part('box', CLOTH.mongolSash, saber, [0.22, 0.05, 0.09], [0, -0.03, 0], METAL);
  const bends: readonly [number, number, number][] = [[0.34, -0.22, 0], [0.3, -0.52, 0.18], [0.24, -0.78, 0.42]];
  for (const [length, y, tilt] of bends) {
    const piece = parts.part('box', CLOTH.steel, saber, [0.05, length, 0.11], [0, y, tilt * 0.3], METAL);
    piece.rotation.x = -tilt;
  }
  return saber;
}

/** A battle body for someone whose look the cutscenes define. */
export function buildFromLook(parts: PartFactory, body: TransformNode, look: ActorLook, palette: ArmyPalette): PersonBody {
  const skin = look.skin ?? SKIN.warm;
  const torso = childNode('torso', body);
  const [legL, legR] = addLegs(parts, torso, look, skin);
  addBody(parts, torso, look);
  const head = childNode('head', torso, 0, HEAD_HEIGHT, 0);
  const face = addFace(parts, head, { skin, skinShade: skin, brow: look.hair ?? HAIR.brown, browHeight: 0.04 });
  addHair(parts, head, look);
  const helmet = addHelmet(parts, head, look);
  const armL = addArm(parts, torso, -1, look, skin);
  const armR = addArm(parts, torso, 1, look, skin);
  const grip = childNode('grip', armR, 0, -0.6, 0.04);
  const { shield, pose } = addShield(parts, torso, shieldFor(look), palette);
  let cape: TransformNode | null = null;
  if (look.cape) {
    cape = childNode('cape', torso, 0, 1.4, -0.29);
    parts.part('box', look.cape, cape, [0.8, 1.15, 0.05], [0, -0.57, -0.02], GLOSS);
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
    shieldPose: pose,
    weapons: { sword: look.outfit === 'mongol' ? addSaber(parts, grip) : addSword(parts, grip), spear: addSpear(parts, grip) },
    sheathed: null,
    sideArm: 'sword',
    cup: null,
    cape,
  };
}
