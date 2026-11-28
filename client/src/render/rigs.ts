import { type InstancedMesh, TransformNode, type Scene } from './babylon.ts';
import { approach, DUEL, type Faction, lerp, meleeStatsForKind, type UnitKind, type UnitView, type Weapon } from '@tumblehorde/shared';
import { ANIMATION, type ArmyPalette, COLORS, ROMAN } from '../visualConfig.ts';
import { buildBean } from './beans.ts';
import { buildRoman, type PersonBody } from './legionary.ts';
import { addAxe, buildViking, vikingLook } from './viking.ts';
import { buildFromLook } from './storyKit.ts';
import { CAST, isRoleName } from '../cinematic/cast.ts';
import type { ActorLook } from '../cinematic/actor.ts';
import { buildBandit, buildZombie } from './folk.ts';
import { childNode, type PartFactory } from './parts.ts';

/** Soldiers are drawn a bit larger than their collision body: chunky and easy to read. */
const SOLDIER_SCALE = 1.1;
/** The commander stands as tall as their soldiers; the horse lifts them only a little. */
const COMMANDER_SCALE = SOLDIER_SCALE;
/** Horses are built full size and shrunk into stocky war ponies (see BODY.saddleHeight). */
const HORSE_SCALE = 0.7;
const ARM_REST = -0.3;
const ARM_OVERHEAD = -3.0;
const ARM_STRIKE_END = 0.15;
const STRIKE_TIME = 0.12;
const RECOVER_TIME = 0.25;
const SHIELD_RAISE_RATE = 12;
const GUARD_RATE = 6;
const KNOCKDOWN_RATE = 6;
const BLINK_RATE = 18;
const HIT_REACTION_TIME = 0.45;
const LAND_SQUASH_TIME = 0.22;
const FLAIL_SPEED = 28;
const STAR_COUNT = 3;
const DIZZY_STUN = 0.3;
const PUPIL_JIGGLE = 0.02;
/** The sword sits across the fist, the blade pointing forward-up when the arm hangs. */
const SWORD_GRIP_PITCH = -1.75;
/** Total pitch of the spear: upright on the march, forward over the shield on guard, a lance on horseback. */
const SPEAR_UPRIGHT = -2.95;
const SPEAR_LEVEL = -1.55;
const SPEAR_LANCE = -1.25;
/** Overhand arm, hand by the shoulder, ready to thrust over the shield. */
const ARM_SPEAR_GUARD = -2.2;
const ARM_LANCE = -1.15;
const BROW_SCOWL = 0.4;
const CROUCH_RATE = 9;
const CROUCH_DROP = 0.42;
const CROUCH_LEGS = 1.1;
const CROUCH_SADDLE_LEAN = 0.5;
const THROW_RATE = 8;
/** Throwing arm cocked back over the shoulder, and the spear's total pitch: pointing a bit upwards. */
const THROW_ARM = -3.1;
const THROW_SPEAR = -1.85;
/** How long the commander's speech and the soldiers' cheering last. */
const SPEECH_TIME = 2.4;
const CHEER_TIME = 2.6;
const BUBBLE_COUNT = 3;
const MARKER_HEIGHT = 2.75;
/** Sword held straight up: the total pitch of the blade. */
const BLADE_UP = -3.1;

export type CheerStyle = 'pump' | 'bang' | 'hop' | 'dance';
const CHEER_STYLES: readonly CheerStyle[] = ['pump', 'bang', 'hop'];
/** After a win everyone joins in, and some dance. */
const VICTORY_STYLES: readonly CheerStyle[] = ['pump', 'dance', 'hop', 'dance', 'bang'];

/** How a swing looks. Purely visual: the simulation only knows "a strike" (or a shield bash). */
export type SwingStyle = 'chop' | 'swipe' | 'thrust' | 'spin' | 'slash' | 'lance' | 'bash';

export interface PersonRig extends PersonBody {
  type: 'person';
  unitKind: UnitKind;
  /** One of the risen dead: arms out in front, a stiff lurch, a lolling head. */
  undead: boolean;
  scale: number;
  root: TransformNode;
  body: TransformNode;
  stars: TransformNode;
  /** Tipsy bubbles floating over a drunk's head. */
  bubbles: InstancedMesh[];
  /** A bobbing arrow over the soldiers that will hear the next order, after a split. */
  marker: InstancedMesh;
  pupilRest: { x: number; y: number }[];
  /** Seconds into the commander's rousing speech, or null. */
  speechAge: number | null;
  /** Seconds into a cheer (negative: about to start), or null. */
  cheerAge: number | null;
  cheerStyle: CheerStyle;
  walkPhase: number;
  swingAge: number | null;
  swingStyle: SwingStyle;
  shieldAmount: number;
  /** 0 = spear upright on the shoulder, 1 = levelled and ready. */
  guardAmount: number;
  crouchAmount: number;
  /** Winding up a spear throw. */
  throwAmount: number;
  drawAmount: number;
  knockdown: number;
  hitAge: number;
  hitBlocked: boolean;
  wasAirborne: boolean;
  landAge: number;
  swings: number;
  /** A knocked-out commander lying dazed until they patch themselves up. */
  downed: boolean;
  tumble: number;
}

export interface HorseRig {
  type: 'horse';
  scale: number;
  root: TransformNode;
  body: TransformNode;
  head: TransformNode;
  legs: TransformNode[];
  walkPhase: number;
  hitAge: number;
}

export type Rig = PersonRig | HorseRig;

const GLOSS = { gloss: true } as const;
const METAL = { metal: true } as const;
const NO_SHADOW_GLOSS = { gloss: true, castShadow: false } as const;
/** How far the body rocks back to wind up a blow and leans into it, and how far it steps in. */
const SWING_ROCK_BACK = 0.22;
const SWING_ROCK_IN = 0.3;
const SWING_LUNGE = 0.28;
/** Leaning into a run or a sidestep: per m/s of sideways and forward speed. */
const STRAFE_LEAN = 0.05;
const RUN_LEAN = 0.025;
const MAX_MOVE_LEAN = 0.35;
/** Faster than this (a dodge) the soldier hops with the feet tucked. */
const DODGE_SPEED = 6.5;
/** How far the dead lean forward as they come. */
const UNDEAD_STOOP = 0.3;

function addBubbles(parts: PartFactory, head: TransformNode): InstancedMesh[] {
  const bubbles: InstancedMesh[] = [];
  for (let i = 0; i < BUBBLE_COUNT; i++) {
    const bubble = parts.part('roundSphere', COLORS.bubble, head, [1, 1, 1], [0, 0.4, 0], NO_SHADOW_GLOSS);
    bubble.setEnabled(false);
    bubbles.push(bubble);
  }
  return bubbles;
}

function addStars(parts: PartFactory, head: TransformNode): TransformNode {
  const stars = childNode('stars', head, 0, 0.62, 0);
  for (let i = 0; i < STAR_COUNT; i++) {
    const a = (i / STAR_COUNT) * Math.PI * 2;
    parts.part('sphere', COLORS.star, stars, [0.11, 0.11, 0.11], [Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3], NO_SHADOW_GLOSS);
  }
  stars.setEnabled(false);
  return stars;
}

/** Builds the body for a unit of `faction`; Vikings each get their own look from their id. */
/** The story's named people look the way the cutscenes show them (`look` names a member of the cast). */
function buildStoryBody(parts: PartFactory, body: TransformNode, palette: ArmyPalette, look: string): { built: PersonBody; look: string } | null {
  if (!isRoleName(look)) return null;
  const actorLook: ActorLook = CAST[look].look;
  const built = buildFromLook(parts, body, actorLook, palette);
  if (actorLook.outfit === 'viking' || actorLook.outfit === 'warlord') {
    // Norse people fight with the axe, the spear for the shield wall.
    const grip = built.weapons.sword?.parent;
    built.weapons.sword?.dispose();
    if (grip) built.weapons = { axe: addAxe(parts, grip as TransformNode, actorLook.outfit === 'warlord'), spear: built.weapons.spear };
    built.sideArm = 'axe';
  }
  if (actorLook.offhand === 'axe') {
    // No shield: a second axe in the left hand.
    built.shield?.dispose();
    built.shield = null;
    addAxe(parts, childNode('grip-left', built.armL, 0, -0.6, 0.04), true);
  }
  return { built, look: `story-${look}` };
}

function buildBody(parts: PartFactory, body: TransformNode, kind: UnitKind, palette: ArmyPalette, faction: Faction, id: number, name: string | null): { built: PersonBody; look: string } {
  // A story person (a Mongol rider too) always gets the body the scenes give them.
  const story = name ? buildStoryBody(parts, body, palette, name) : null;
  if (story) return story;
  const person = kind === 'swordsman' || kind === 'commander';
  if (!person) return { built: buildBean(parts, body, kind, palette), look: 'bean' };
  if (faction === 'viking') {
    const { look, variant } = vikingLook(id);
    return { built: buildViking(parts, body, palette, kind === 'commander', look), look: `viking-${variant}` };
  }
  if (faction === 'bandit' && kind === 'swordsman') {
    const { built, variant } = buildBandit(parts, body, palette, id);
    return { built, look: `bandit-${variant}` };
  }
  if (faction === 'zombie') {
    const { built, variant } = buildZombie(parts, body, palette, id);
    return { built, look: `zombie-${variant}` };
  }
  return { built: buildRoman(parts, body, palette, kind === 'commander'), look: 'roman' };
}

/** `name`: in a story battle, the cast look of a named person (a hero, a general, Cassian). */
export function createPersonRig(scene: Scene, parts: PartFactory, kind: UnitKind, palette: ArmyPalette, faction: Faction = 'roman', id = 0, name: string | null = null): PersonRig {
  const scale = kind === 'commander' ? COMMANDER_SCALE : SOLDIER_SCALE;
  const root = new TransformNode(kind, scene);
  const body = childNode('body', root);
  body.scaling.setAll(scale);
  const { built, look } = buildBody(parts, body, kind, palette, faction, id, name);
  const stars = addStars(parts, built.head);
  const bubbles = addBubbles(parts, built.head);
  const marker = parts.part('cone', COLORS.toast, root, [0.22, 0.4, 0.22], [0, MARKER_HEIGHT * scale, 0], NO_SHADOW_GLOSS);
  marker.rotation.x = Math.PI;
  marker.setEnabled(false);
  const animated = [...built.pupils, ...built.brows, built.mouth, built.mouthOpen, built.drool, ...bubbles, marker];
  const pupilRest = built.pupils.map((p) => ({ x: p.position.x, y: p.position.y }));
  parts.bake(root, `${kind}:${look}:${palette.body}`, new Set(animated.filter((m): m is InstancedMesh => m !== null)));
  return {
    ...built,
    type: 'person',
    unitKind: kind,
    undead: faction === 'zombie',
    scale,
    root,
    body,
    stars,
    bubbles,
    marker,
    pupilRest,
    speechAge: null,
    cheerAge: null,
    cheerStyle: 'pump',
    walkPhase: Math.random() * Math.PI * 2,
    swingAge: null,
    swingStyle: 'chop',
    shieldAmount: 0,
    guardAmount: 0,
    crouchAmount: 0,
    throwAmount: 0,
    drawAmount: 0,
    knockdown: 0,
    hitAge: HIT_REACTION_TIME,
    hitBlocked: false,
    wasAirborne: false,
    landAge: LAND_SQUASH_TIME,
    swings: 0,
    downed: false,
    tumble: 0,
  };
}

/** A boxy war horse in barding: cloth in the army's color, a gold chest plate and face plate. */
/** Steppe horses for the story's riders (the Mongols): the plain horses of the scenes, no barding. */
const PLAIN_HORSE = { hides: ['#6B4A32', '#4A3424', '#8A6A48'], cloth: '#8A3A2E', saddle: '#6E4528' } as const;

/** A war horse; `plain` is a steppe horse with a cloth and saddle, as the riders in the scenes have. */
export function createHorseRig(scene: Scene, parts: PartFactory, palette: ArmyPalette, id: number, plain = false): HorseRig {
  const hide = plain ? (PLAIN_HORSE.hides[id % PLAIN_HORSE.hides.length] ?? COLORS.horseDark) : id % 2 === 0 ? COLORS.horseLight : COLORS.horseDark;
  const root = new TransformNode('horse', scene);
  const body = childNode('horse-body', root);
  body.scaling.setAll(HORSE_SCALE);
  parts.part('box', hide, body, [0.9, 0.9, 2.0], [0, 1.38, 0], GLOSS);
  const neck = parts.part('box', hide, body, [0.56, 1.0, 0.6], [0, 1.92, 0.88], GLOSS);
  neck.rotation.x = 0.5;
  parts.part('box', COLORS.mane, body, [0.16, 0.9, 0.3], [0, 2.1, 0.66], GLOSS).rotation.x = 0.5;
  parts.part('box', COLORS.mane, body, [0.16, 0.85, 0.16], [0, 1.4, -1.1], GLOSS).rotation.x = 0.5;
  if (plain) {
    // A saddle cloth and a saddle, nothing more.
    parts.part('box', PLAIN_HORSE.cloth, body, [0.96, 0.5, 1.0], [0, 1.6, -0.1], GLOSS);
    parts.part('box', PLAIN_HORSE.saddle, body, [0.66, 0.16, 0.7], [0, 1.9, -0.1], GLOSS);
  } else {
    // Caparison over the back, trimmed in gold, with a saddle and a gold chest plate.
    parts.part('box', palette.body, body, [1.0, 0.62, 1.62], [0, 1.36, -0.1], GLOSS);
    parts.part('box', COLORS.gold, body, [1.02, 0.07, 1.64], [0, 1.06, -0.1], METAL);
    parts.part('box', ROMAN.leather, body, [0.62, 0.14, 0.72], [0, 1.88, -0.1], GLOSS);
    parts.part('box', COLORS.gold, body, [0.8, 0.6, 0.12], [0, 1.4, 1.04], METAL);
  }
  const head = childNode('horse-head', body, 0, 2.3, 1.2);
  parts.part('box', hide, head, [0.46, 0.46, 0.86], [0, 0, 0.26], GLOSS);
  parts.part('box', COLORS.mane, head, [0.42, 0.3, 0.12], [0, -0.08, 0.7], GLOSS);
  if (!plain) {
    parts.part('box', COLORS.gold, head, [0.3, 0.06, 0.6], [0, 0.25, 0.3], METAL);
    parts.part('box', palette.body, head, [0.1, 0.34, 0.16], [0, 0.42, 0.04], GLOSS);
  }
  for (const side of [-1, 1]) {
    parts.part('box', hide, head, [0.1, 0.22, 0.1], [side * 0.15, 0.32, -0.04], GLOSS);
    parts.part('box', COLORS.eyeWhite, head, [0.04, 0.12, 0.12], [side * 0.24, 0.08, 0.22], NO_SHADOW_GLOSS);
    parts.part('box', COLORS.pupil, head, [0.045, 0.07, 0.07], [side * 0.245, 0.07, 0.24], NO_SHADOW_GLOSS);
  }
  const legs: TransformNode[] = [];
  for (const [x, z] of [[-0.28, 0.72], [0.28, 0.72], [-0.28, -0.72], [0.28, -0.72]] as const) {
    const leg = childNode('horse-leg', body, x, 1.0, z);
    parts.part('box', hide, leg, [0.26, 0.95, 0.28], [0, -0.45, 0], GLOSS);
    parts.part('box', COLORS.boot, leg, [0.3, 0.14, 0.32], [0, -0.92, 0], GLOSS);
    legs.push(leg);
  }
  parts.bake(root, `horse:${hide}:${plain ? 'plain' : palette.body}`, new Set());
  return { type: 'horse', scale: HORSE_SCALE, root, body, head, legs, walkPhase: Math.random() * 6, hitAge: HIT_REACTION_TIME };
}

export interface AnimationContext {
  dt: number;
  now: number;
  mounted: boolean;
  /** The unit's army is at the banquet. */
  feasting: boolean;
  /** Mounted riders sit facing along the horse, twisting a little towards their target. */
  displayYaw: number;
}

function ease(t: number): number {
  return Math.sin(Math.min(1, Math.max(0, t)) * (Math.PI / 2));
}

interface SwingPose {
  pitch: number;
  sweep: number;
  twist: number;
  reach: number;
  /** Wrist flick: extra pitch on the weapon so a slash follows through downwards. */
  wrist: number;
  /** Leaning out of the saddle towards the side being struck. */
  lean: number;
  /** Rocking back while winding up (negative), then lunging into the blow. */
  rock: number;
  /** Stepping the body forward into the blow (meters, in body space). */
  lunge: number;
  /** The shield punched forward (a bash). */
  shove: number;
}

const NO_SWING = { sweep: 0, twist: 0, reach: 0, wrist: 0, lean: 0, rock: 0, lunge: 0, shove: 0 } as const;

/** Arm pitch, sideways sweep, body twist and forward reach for the current swing. */
function swingPose(rig: PersonRig, mounted: boolean, weapon: Weapon): SwingPose | null {
  if (rig.swingAge === null) return null;
  const windup = rig.swingStyle === 'bash' ? DUEL.bash.windup : (meleeStatsForKind(rig.unitKind, mounted, weapon)?.windup ?? 0.25);
  const t = rig.swingAge;
  const strike = t - windup;
  if (strike > STRIKE_TIME + RECOVER_TIME) {
    rig.swingAge = null;
    return null;
  }
  const back = ease(t / windup);
  const hit = strike < 0 ? 0 : Math.min(1, strike / STRIKE_TIME);
  const recover = strike < STRIKE_TIME ? 0 : (strike - STRIKE_TIME) / RECOVER_TIME;
  /** windup → strike → back to rest, for any value. */
  const phase = (rest: number, cocked: number, struck: number): number =>
    strike < 0 ? lerp(rest, cocked, back) : strike < STRIKE_TIME ? lerp(cocked, struck, hit) : lerp(struck, rest, recover);
  // On foot the whole body tells the blow: rock back to wind up, lunge in to strike.
  const body = mounted ? { rock: 0, lunge: 0 } : { rock: phase(0, -SWING_ROCK_BACK, SWING_ROCK_IN), lunge: phase(0, -SWING_LUNGE * 0.3, SWING_LUNGE) };
  switch (rig.swingStyle) {
    case 'chop':
      return { ...NO_SWING, ...body, pitch: phase(ARM_REST, ARM_OVERHEAD, ARM_STRIKE_END), twist: strike < 0 ? -0.35 * back : 0.3 * (1 - recover) };
    case 'swipe': {
      const sweep = phase(0, -1.6, 1.2);
      return { ...NO_SWING, ...body, pitch: -1.45 * (1 - recover), sweep, twist: sweep * 0.45 };
    }
    case 'bash':
      // Sword hand back, shield driven forward with the shoulder behind it.
      return { ...NO_SWING, ...body, pitch: ARM_REST + 0.3, twist: phase(0, 0.35, -0.3), shove: phase(0, -0.15, 1), lunge: phase(0, -0.1, SWING_LUNGE * 1.6) };
    case 'thrust': {
      // Overhand spear thrust over the shield rim.
      return { ...NO_SWING, ...body, pitch: phase(ARM_SPEAR_GUARD, ARM_SPEAR_GUARD - 0.25, ARM_SPEAR_GUARD + 0.35), reach: phase(0, -0.22, 0.5), twist: phase(0, 0.15, -0.25) };
    }
    case 'spin': {
      const spin = strike < 0 ? -0.4 * back : -0.4 + (Math.PI * 2 + 0.4) * ease(strike / (STRIKE_TIME + RECOVER_TIME));
      return { ...NO_SWING, pitch: -1.5, sweep: -1.2, twist: spin };
    }
    case 'slash':
      // From the saddle: sword raised high and out, then hacked down at whoever is below.
      return {
        ...NO_SWING,
        pitch: phase(ARM_REST, ARM_OVERHEAD - 0.2, 0.55),
        sweep: phase(0, 0.55, 0.25),
        twist: phase(0, -0.35, 0.3),
        reach: 0,
        wrist: phase(0, -0.3, 1.1),
        lean: phase(0, -0.12, 0.32),
      };
    case 'lance':
      return { ...NO_SWING, pitch: phase(ARM_LANCE, ARM_LANCE - 0.35, ARM_LANCE + 0.45), reach: phase(0, -0.3, 0.55), lean: phase(0, 0, 0.15) };
  }
}

function showWeapon(rig: PersonRig, weapon: Weapon, feasting: boolean): void {
  for (const [key, n] of Object.entries(rig.weapons)) n.setEnabled(key === weapon && !feasting);
  rig.cup?.setEnabled(feasting);
  rig.sheathed?.setEnabled(weapon !== rig.sideArm || feasting);
  rig.shield?.setEnabled(weapon !== 'bow');
}

function animateLegs(rig: PersonRig, mounted: boolean, flail: boolean, airborne: boolean, swing: number, now: number): void {
  if (mounted) {
    rig.legL.rotation.set(-1.35, 0, -0.35);
    rig.legR.rotation.set(-1.35, 0, 0.35);
  } else if (flail) {
    rig.legL.rotation.set(Math.sin(now * FLAIL_SPEED) * 0.9, 0, -0.3);
    rig.legR.rotation.set(Math.cos(now * FLAIL_SPEED) * 0.9, 0, 0.3);
  } else if (airborne) {
    rig.legL.rotation.set(-0.8, 0, -0.2);
    rig.legR.rotation.set(0.4, 0, 0.2);
  } else {
    rig.legL.rotation.set(swing * ANIMATION.legSwing, 0, 0);
    rig.legR.rotation.set(-swing * ANIMATION.legSwing, 0, 0);
  }
}

/** The weapon arm: the swing when there is one, else a resting or guard pose for the weapon. */
function weaponArmPitch(rig: PersonRig, weapon: Weapon, mounted: boolean, swing: number): number {
  if (weapon === 'spear') {
    const rest = ARM_REST * 0.6 + swing * ANIMATION.armSwing * 0.2;
    return mounted ? ARM_LANCE : lerp(rest, ARM_SPEAR_GUARD, rig.guardAmount);
  }
  return ARM_REST + swing * ANIMATION.armSwing * 0.4;
}

/** Spears are carried upright, levelled over the shield on guard, and couched as a lance in the saddle. */
function spearPitch(rig: PersonRig, mounted: boolean): number {
  if (mounted) return SPEAR_LANCE;
  return lerp(SPEAR_UPRIGHT, SPEAR_LEVEL, rig.guardAmount);
}

function animateArms(rig: PersonRig, view: UnitView, pose: SwingPose | null, flail: boolean, swing: number, mounted: boolean, now: number): void {
  if (flail) {
    rig.armL.rotation.set(-1.6 + Math.sin(now * FLAIL_SPEED) * 1.3, 0, -0.6);
    rig.armR.rotation.set(-1.6 + Math.cos(now * FLAIL_SPEED) * 1.3, 0, 0.6);
    return;
  }
  const armPitch = pose ? pose.pitch : weaponArmPitch(rig, view.weapon, mounted, swing);
  rig.armR.rotation.set(armPitch, 0, pose ? -pose.sweep : 0);
  rig.armR.position.z = 0.01 + (pose?.reach ?? 0);
  const sword = rig.weapons.sword;
  if (sword) sword.rotation.x = SWORD_GRIP_PITCH + (pose?.wrist ?? 0);
  const spear = rig.weapons.spear;
  if (spear) spear.rotation.x = spearPitch(rig, mounted) - armPitch;
  const armLRest = -swing * ANIMATION.armSwing;
  if (view.weapon === 'bow') {
    rig.armL.rotation.set(lerp(armLRest, -1.5, rig.drawAmount), 0, 0);
    if (!pose) rig.armR.rotation.x = lerp(rig.armR.rotation.x, -1.45, rig.drawAmount);
    rig.armR.position.z = 0.01 - rig.drawAmount * 0.25;
  } else {
    // The shield arm hangs on the shield's grip.
    rig.armL.rotation.set(lerp(-0.25, -1.3, rig.shieldAmount), rig.shieldAmount * 0.5, -0.12);
  }
}

function animateShield(rig: PersonRig, hitT: number, shove: number): void {
  if (!rig.shield) return;
  const s = Math.max(rig.shieldAmount, Math.min(1, Math.abs(shove) * 2));
  const { rest, raised, restYaw } = rig.shieldPose;
  // A small shove back when a blocked blow lands on the shield.
  const bump = rig.hitBlocked ? hitT * 0.12 : 0;
  rig.shield.position.set(lerp(rest[0], raised[0], s), lerp(rest[1], raised[1], s), lerp(rest[2], raised[2], s) - bump * s + shove * 0.45);
  rig.shield.rotation.y = lerp(restYaw, Math.PI / 2, s);
}

/** Leaning into a run, sideways into a sidestep, and a tucked hop for a dodge. */
function moveLean(view: UnitView, yaw: number): { pitch: number; roll: number; hop: number } {
  const forward = view.vx * Math.sin(yaw) + view.vz * Math.cos(yaw);
  const side = view.vx * Math.cos(yaw) - view.vz * Math.sin(yaw);
  const clampLean = (v: number): number => Math.max(-MAX_MOVE_LEAN, Math.min(MAX_MOVE_LEAN, v));
  const speed = Math.hypot(view.vx, view.vz);
  return { pitch: clampLean(forward * RUN_LEAN), roll: clampLean(-side * STRAFE_LEAN), hop: speed > DODGE_SPEED && view.onGround ? 1 : 0 };
}

/** The commander's cape streams out behind them the faster they go. */
function animateCape(rig: PersonRig, speed: number, now: number): void {
  if (!rig.cape) return;
  const flow = Math.min(1, speed / ANIMATION.capeFullSpeed);
  rig.cape.rotation.x = 0.08 + flow * 0.75 + Math.sin(now * 9 + rig.walkPhase) * 0.06 * flow;
}

/** Brows knit together when the soldier fights or hides behind the shield. */
function animateFace(rig: PersonRig, view: UnitView, hitT: number, now: number): void {
  const fierce = view.action === 'melee' || rig.swingAge !== null || view.shieldUp ? 1 : 0;
  rig.brows.forEach((brow, i) => {
    const side = i === 0 ? -1 : 1;
    brow.rotation.z = side * BROW_SCOWL * fierce - side * 0.25 * hitT;
    brow.position.y = 0.06 - fierce * 0.012 + hitT * 0.02;
  });
  const stunned = view.stunTimer > 0;
  const jiggle = hitT + (stunned ? 0.6 : 0);
  rig.pupils.forEach((p, i) => {
    const rest = rig.pupilRest[i];
    if (!rest) return;
    p.position.x = rest.x + Math.sin(now * 37 + i * 2) * PUPIL_JIGGLE * jiggle;
    p.position.y = rest.y + Math.cos(now * 41 + i) * PUPIL_JIGGLE * jiggle;
  });
}

export function animatePerson(rig: PersonRig, view: UnitView, ctx: AnimationContext): void {
  const { dt, now, mounted } = ctx;
  rig.root.position.set(view.x, view.y, view.z);
  rig.root.rotation.y = ctx.displayYaw;
  const feasting = ctx.feasting && !mounted;
  showWeapon(rig, view.weapon, feasting);
  const groundSpeed = Math.hypot(view.vx, view.vz);
  const speed = mounted ? 0 : groundSpeed;
  const stride = Math.min(1, speed / 4);
  rig.walkPhase += dt * speed * ANIMATION.walkCycleSpeed;
  const swing = Math.sin(rig.walkPhase) * stride;
  const stunned = view.stunTimer > 0;
  const airborne = !view.onGround && !mounted;
  rig.hitAge += dt;
  rig.landAge += dt;
  if (rig.wasAirborne && !airborne) rig.landAge = 0;
  rig.wasAirborne = airborne;
  if (rig.swingAge !== null) rig.swingAge += dt;

  const flail = !mounted && (stunned || (airborne && view.vy < -2));
  const pose = swingPose(rig, mounted, view.weapon);
  rig.shieldAmount = approach(rig.shieldAmount, view.shieldUp ? 1 : 0, dt * SHIELD_RAISE_RATE);
  rig.guardAmount = approach(rig.guardAmount, view.shieldUp || pose !== null ? 1 : 0, dt * GUARD_RATE);
  rig.drawAmount = approach(rig.drawAmount, view.action === 'shoot' ? 1 : 0, dt * SHIELD_RAISE_RATE);
  animateLegs(rig, mounted, flail, airborne, swing, now);
  animateArms(rig, view, pose, flail, swing, mounted, now);

  const hitT = Math.max(0, 1 - rig.hitAge / HIT_REACTION_TIME);
  animateShield(rig, hitT, pose?.shove ?? 0);
  animateCape(rig, groundSpeed, now);
  animateFace(rig, view, hitT, now);

  // Body: knockdown, wobble, waddle, a crouch behind the shield, squash and stretch.
  const lying = view.stunTimer > ANIMATION.knockdownStun ? 1 : 0;
  rig.knockdown = approach(rig.knockdown, lying, dt * KNOCKDOWN_RATE);
  const wobble = stunned && lying === 0 ? Math.sin(now * 25) * ANIMATION.stunWobble * Math.min(1, view.stunTimer * 3) : 0;
  const waddle = Math.sin(rig.walkPhase) * 0.08 * stride;
  const flinch = rig.hitBlocked ? -0.1 * hitT : -0.4 * hitT;
  const crouch = mounted ? 0 : rig.shieldAmount * 0.14;
  const lean = pose?.lean ?? 0;
  const move = mounted || stunned ? { pitch: 0, roll: 0, hop: 0 } : moveLean(view, ctx.displayYaw);
  const rock = pose?.rock ?? 0;
  rig.body.rotation.set(-rig.knockdown * 1.45 + flinch + crouch + Math.abs(lean) * 0.4 + rock + move.pitch, pose?.twist ?? 0, wobble + waddle - lean + move.roll);
  rig.body.position.z = pose?.lunge ?? 0;
  const landT = Math.max(0, 1 - rig.landAge / LAND_SQUASH_TIME);
  const squash = (rig.hitBlocked ? 0.05 : 0.16) * hitT * Math.sin(rig.hitAge * 30) + landT * 0.14;
  const stretch = airborne && !flail ? 0.06 : 0;
  const breathe = Math.sin(now * 2.2 + rig.walkPhase) * 0.008;
  rig.torso.scaling.set(1 + squash, 1 - squash + stretch + breathe, 1 + squash);
  rig.body.position.y = mounted ? 0 : Math.abs(Math.sin(rig.walkPhase)) * ANIMATION.bob * stride + rig.knockdown * 0.22 - crouch * 0.5 + move.hop * 0.18;
  if (move.hop > 0) {
    rig.legL.rotation.x = -0.9;
    rig.legR.rotation.x = -0.5;
  }

  // Head: comic wobble on hits; dizzy stars when stunned.
  rig.head.rotation.set(Math.sin(now * 23) * 0.15 * hitT, 0, Math.sin(now * 31) * 0.3 * hitT);
  const dizzy = view.stunTimer > DIZZY_STUN;
  rig.stars.setEnabled(dizzy);
  if (dizzy) rig.stars.rotation.y = now * 6;

  animateCrouch(rig, view, dt, mounted);
  animateThrow(rig, view, dt);
  if (rig.undead) animateUndead(rig, view, pose !== null, now);

  let shouting = animateSpeech(rig, dt);
  if (!stunned && !mounted) shouting = animateCheer(rig, dt) || shouting;
  else if (rig.cheerAge !== null) rig.cheerAge = null;
  if (feasting) animateDrinking(rig, view.id, now);
  const grinning = animateDrunk(rig, view, now);
  rig.mouth.setEnabled(!shouting && !grinning);
  rig.mouthOpen?.setEnabled(shouting || grinning);
  rig.root.setEnabled(!view.invulnerable || Math.sin(now * BLINK_RATE) > -0.3);
}

/** The dead reach for you with both arms, lurch forward bent over, and their heads loll. */
function animateUndead(rig: PersonRig, view: UnitView, striking: boolean, now: number): void {
  if (view.stunTimer > 0 || !view.alive) return;
  const sway = Math.sin(now * 3 + view.id);
  if (!striking) {
    rig.armR.rotation.set(-1.45 + sway * 0.12, 0, 0.08);
    rig.armL.rotation.set(-1.5 - sway * 0.12, 0, -0.08);
  }
  rig.body.rotation.x += UNDEAD_STOOP;
  rig.head.rotation.z += Math.sin(now * 1.3 + view.id * 2) * 0.35;
  rig.head.rotation.x += 0.2;
}

/** Ducking down: a squat on foot (feet out front, very undignified), a low lean in the saddle. */
function animateCrouch(rig: PersonRig, view: UnitView, dt: number, mounted: boolean): void {
  rig.crouchAmount = approach(rig.crouchAmount, view.crouching ? 1 : 0, dt * CROUCH_RATE);
  const c = rig.crouchAmount;
  if (c <= 0) return;
  if (mounted) {
    rig.body.rotation.x += CROUCH_SADDLE_LEAN * c;
    return;
  }
  rig.body.position.y -= CROUCH_DROP * c;
  rig.body.rotation.x += 0.15 * c;
  rig.legL.rotation.x -= CROUCH_LEGS * c;
  rig.legR.rotation.x -= CROUCH_LEGS * c;
}

/** Winding up to throw the spear: arm cocked back over the shoulder, spear pointing up at the target. */
function animateThrow(rig: PersonRig, view: UnitView, dt: number): void {
  rig.throwAmount = approach(rig.throwAmount, view.action === 'throw' ? 1 : 0, dt * THROW_RATE);
  const t = rig.throwAmount;
  if (t <= 0) return;
  const armPitch = lerp(rig.armR.rotation.x, THROW_ARM, t);
  rig.armR.rotation.x = armPitch;
  rig.armR.position.z = 0.01 - 0.2 * t;
  const spear = rig.weapons.spear;
  if (spear) spear.rotation.x = THROW_SPEAR - armPitch;
  rig.body.rotation.y += -0.4 * t;
}

/** Pose the weapon arm with the blade (or spear) pointing at the sky. */
function brandishWeapon(rig: PersonRig, armPitch: number, sweep: number): void {
  rig.armR.rotation.set(armPitch, 0, sweep);
  rig.armR.position.z = 0.01;
  const sword = rig.weapons.sword;
  if (sword) sword.rotation.x = BLADE_UP - armPitch;
  const spear = rig.weapons.spear;
  if (spear) spear.rotation.x = SPEAR_UPRIGHT - armPitch;
}

/** The commander's speech: sword thrust at the sky, the other hand waving, head back, shouting. */
function animateSpeech(rig: PersonRig, dt: number): boolean {
  if (rig.speechAge === null) return false;
  rig.speechAge += dt;
  if (rig.speechAge > SPEECH_TIME) {
    rig.speechAge = null;
    return false;
  }
  const t = rig.speechAge;
  const raise = ease(t / 0.25);
  brandishWeapon(rig, lerp(ARM_REST, -2.9, raise) + Math.sin(t * 7) * 0.15 * raise, 0);
  rig.armL.rotation.set(-1.1 + Math.sin(t * 5) * 0.4, 0, -0.5);
  rig.body.rotation.x -= 0.12 * raise;
  rig.head.rotation.x = -0.25 * raise;
  return true;
}

/** Soldiers answering the speech: weapons punched at the sky, swords banged on shields, little hops. */
function animateCheer(rig: PersonRig, dt: number): boolean {
  if (rig.cheerAge === null) return false;
  rig.cheerAge += dt;
  if (rig.cheerAge > CHEER_TIME) {
    rig.cheerAge = null;
    return false;
  }
  const t = rig.cheerAge;
  if (t < 0) return false;
  const fade = Math.min(1, t / 0.2, (CHEER_TIME - t) / 0.3);
  switch (rig.cheerStyle) {
    case 'pump':
      brandishWeapon(rig, lerp(ARM_REST, -2.8 + Math.sin(t * 12) * 0.35, fade), 0);
      break;
    case 'bang': {
      // Hammer the sword hand across onto the raised shield.
      brandishWeapon(rig, lerp(ARM_REST, -1.25 + Math.sin(t * 15) * 0.45, fade), -0.55 * fade);
      if (rig.shield) {
        const { rest, raised } = rig.shieldPose;
        rig.shield.position.set(lerp(rest[0], raised[0], 0.5 * fade), lerp(rest[1], raised[1], 0.5 * fade), lerp(rest[2], raised[2], 0.5 * fade));
        rig.shield.rotation.y = lerp(rig.shieldPose.restYaw, Math.PI / 2, 0.5 * fade);
      }
      break;
    }
    case 'hop':
      brandishWeapon(rig, lerp(ARM_REST, -2.7, fade), 0);
      rig.armL.rotation.set(lerp(-0.25, -2.5, fade), 0, -0.3);
      rig.body.position.y += Math.abs(Math.sin(t * 9)) * 0.22 * fade;
      break;
    case 'dance': {
      // Arms up and swinging side to side, hips wiggling, knees kicking in turn.
      const beat = Math.sin(t * 8);
      brandishWeapon(rig, lerp(ARM_REST, -2.6, fade), beat * 0.5 * fade);
      rig.armL.rotation.set(lerp(-0.25, -2.6, fade), 0, -0.3 + beat * 0.5 * fade);
      rig.body.rotation.z += beat * 0.25 * fade;
      rig.body.rotation.y += Math.sin(t * 4) * 0.4 * fade;
      rig.body.position.y += Math.abs(Math.sin(t * 8)) * 0.12 * fade;
      rig.legL.rotation.x = Math.max(0, beat) * -0.9 * fade;
      rig.legR.rotation.x = Math.max(0, -beat) * -0.9 * fade;
      break;
    }
  }
  rig.head.rotation.x = -0.2 * fade;
  return Math.sin(t * 6) > -0.4;
}

/** At the banquet: lift the cup, tip head and wine back, lower it, repeat. Each soldier at their own pace. */
function animateDrinking(rig: PersonRig, id: number, now: number): void {
  const cycle = (now * 0.45 + id * 0.37) % 1;
  const sip = Math.sin(Math.min(1, Math.max(0, (cycle - 0.3) / 0.4)) * Math.PI);
  const armPitch = lerp(-0.55, -2.1, sip);
  rig.armR.rotation.set(armPitch, 0, -0.4 * sip);
  rig.armR.position.z = 0.01;
  if (rig.cup) rig.cup.rotation.x = -armPitch - 1.3 * sip;
  rig.head.rotation.x = -0.35 * sip;
}

/** Drunk for good: swaying, lolling head, crossed eyes, red nose, drool and bubbles. Returns true while grinning. */
function animateDrunk(rig: PersonRig, view: UnitView, now: number): boolean {
  const drunk = view.drunk && view.alive;
  rig.drunkFace?.setEnabled(drunk);
  for (const b of rig.bubbles) b.setEnabled(drunk);
  if (!drunk) return false;
  const id = view.id;
  rig.body.rotation.z += Math.sin(now * 1.7 + id) * 0.17;
  rig.body.rotation.x += Math.sin(now * 1.1 + id * 2) * 0.07;
  rig.head.rotation.z += Math.sin(now * 2.3 + id) * 0.3;
  rig.head.rotation.y = Math.sin(now * 0.9 + id * 3) * 0.3;
  // A hiccup now and then.
  if ((now * 0.25 + id * 0.31) % 1 < 0.04) rig.body.position.y += 0.08;
  rig.pupils.forEach((p, i) => {
    const rest = rig.pupilRest[i];
    if (!rest) return;
    p.position.x = rest.x * 0.35 + Math.sin(now * 3 + i) * PUPIL_JIGGLE;
    p.position.y = rest.y - 0.012;
  });
  if (rig.drool) {
    const drip = (now * 0.7 + id * 0.19) % 1;
    rig.drool.scaling.y = 0.05 + drip * 0.16;
    rig.drool.position.y = -0.2 - drip * 0.08;
  }
  rig.bubbles.forEach((b, i) => {
    const phase = (now * 0.45 + i / BUBBLE_COUNT + id * 0.13) % 1;
    b.position.set(Math.sin(phase * 6 + i * 2) * 0.14, 0.5 + phase * 0.5, Math.cos(phase * 5 + i) * 0.1);
    b.scaling.setAll(0.07 * (1 - phase) + 0.025);
  });
  return Math.sin(now * 0.8 + id) > 0.3;
}

export function showMarker(rig: PersonRig, on: boolean, now: number): void {
  rig.marker.setEnabled(on);
  if (!on) return;
  rig.marker.position.y = MARKER_HEIGHT * rig.scale + Math.sin(now * 5) * 0.12;
  rig.marker.rotation.y = now * 2;
}

/** The commander starts a rousing speech. */
export function startSpeech(rig: Rig): void {
  if (rig.type === 'person') rig.speechAge = 0;
}

/** A soldier joins the cheering after `delay` seconds, in their own style. */
export function startCheer(rig: Rig, delay: number, id: number): void {
  if (rig.type !== 'person') return;
  rig.cheerAge = -delay;
  rig.cheerStyle = CHEER_STYLES[id % CHEER_STYLES.length] ?? 'pump';
}

/** After a win: keeps cheering, jumping and dancing, each soldier in turn picking a new way. */
export function keepCelebrating(rig: Rig, id: number): void {
  if (rig.type !== 'person' || rig.cheerAge !== null) return;
  rig.swings++;
  rig.cheerAge = -Math.random() * 0.3;
  rig.cheerStyle = VICTORY_STYLES[(id + rig.swings) % VICTORY_STYLES.length] ?? 'dance';
}

export function animateHorse(rig: HorseRig, view: UnitView, ctx: AnimationContext): void {
  rig.root.position.set(view.x, view.y, view.z);
  rig.root.rotation.y = view.yaw;
  rig.hitAge += ctx.dt;
  const speed = Math.hypot(view.vx, view.vz);
  const stride = Math.min(1, speed / 6);
  rig.walkPhase += ctx.dt * speed * ANIMATION.gallopSpeed;
  const phases = [0, 0.6, Math.PI, Math.PI + 0.6];
  rig.legs.forEach((leg, i) => {
    leg.rotation.x = Math.sin(rig.walkPhase + (phases[i] ?? 0)) * 0.8 * stride;
  });
  const hitT = Math.max(0, 1 - rig.hitAge / HIT_REACTION_TIME);
  rig.body.rotation.x = Math.sin(rig.walkPhase * 2) * 0.07 * stride - hitT * 0.2;
  rig.body.position.y = Math.abs(Math.sin(rig.walkPhase)) * 0.16 * stride;
  rig.head.rotation.x = 0.35 + Math.sin(rig.walkPhase * 2) * 0.2 * stride - hitT * 0.5;
}

/** Lying dazed where the blow sent them: tumbling while flying, then flat on the back with stars. */
export function animateDowned(rig: PersonRig, view: UnitView, dt: number, now: number): void {
  if (!rig.downed) {
    rig.downed = true;
    rig.tumble = 0;
    rig.swingAge = null;
  }
  rig.root.setEnabled(true);
  rig.root.position.set(view.x, view.y, view.z);
  const moving = Math.hypot(view.vx, view.vy, view.vz) > 1;
  if (moving) rig.tumble += dt * 9;
  rig.body.rotation.set(moving ? -rig.tumble : -1.45, 0, moving ? Math.sin(rig.tumble) * 0.5 : Math.sin(now * 1.5) * 0.05);
  rig.body.position.y = moving ? 0.9 : 0.22;
  rig.torso.scaling.set(1, 1 + Math.sin(now * 3) * 0.02, 1);
  rig.legL.rotation.set(-0.3 + Math.sin(now * 2) * 0.1, 0, -0.4);
  rig.legR.rotation.set(-0.2, 0, 0.4);
  rig.armL.rotation.set(-2.6, 0, -0.5);
  rig.armR.rotation.set(-2.6, 0, 0.5);
  rig.stars.setEnabled(true);
  rig.stars.rotation.y = now * 4;
  rig.pupils.forEach((p, i) => {
    const rest = rig.pupilRest[i];
    if (!rest) return;
    p.position.x = rest.x + Math.cos(now * 8 + i * Math.PI) * PUPIL_JIGGLE * 1.5;
    p.position.y = rest.y + Math.sin(now * 8 + i * Math.PI) * PUPIL_JIGGLE * 1.5;
  });
}

/** Back on their feet after patching up. */
export function standUp(rig: PersonRig): void {
  rig.downed = false;
  rig.stars.setEnabled(false);
  rig.knockdown = 1;
}

/** Picks a swing style: spears thrust, riders hack downwards, commanders sometimes spin. */
export function startSwing(rig: Rig, weapon: Weapon, mounted: boolean, bash = false): void {
  if (rig.type !== 'person') return;
  rig.swings++;
  rig.swingAge = 0;
  if (bash) {
    rig.swingStyle = 'bash';
    return;
  }
  if (weapon === 'spear') {
    rig.swingStyle = mounted ? 'lance' : 'thrust';
    return;
  }
  if (mounted) {
    rig.swingStyle = 'slash';
    return;
  }
  const roll = (rig.swings * 7 + Math.floor(rig.walkPhase * 10)) % 10;
  if (rig.unitKind === 'commander' && roll === 0) rig.swingStyle = 'spin';
  else rig.swingStyle = roll < 5 ? 'chop' : 'swipe';
}

export function reactToHit(rig: Rig, blocked: boolean): void {
  rig.hitAge = 0;
  if (rig.type === 'person') rig.hitBlocked = blocked;
}

/** Dead bodies get crossed-out eyes and lose their stars. */
export function markDead(rig: Rig): void {
  if (rig.type !== 'person') return;
  for (const p of rig.pupils) p.setEnabled(false);
  rig.deadEyes.setEnabled(true);
  rig.stars.setEnabled(false);
  rig.root.setEnabled(true);
}
