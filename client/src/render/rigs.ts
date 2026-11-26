import { type InstancedMesh, TransformNode, type Scene } from './babylon.ts';
import { approach, lerp, meleeStatsForKind, type UnitKind, type UnitView, type Weapon } from '@tumblehorde/shared';
import { ANIMATION, type ArmyPalette, COLORS } from '../visualConfig.ts';
import type { PartFactory } from './parts.ts';

const COMMANDER_SCALE = 1.15;
const ARM_REST = -0.35;
const ARM_OVERHEAD = -3.0;
const ARM_STRIKE_END = 0.15;
const STRIKE_TIME = 0.12;
const RECOVER_TIME = 0.25;
const SHIELD_RAISE_RATE = 12;
const KNOCKDOWN_RATE = 6;
const BLINK_RATE = 18;
const HIT_REACTION_TIME = 0.45;
const LAND_SQUASH_TIME = 0.22;
const FLAIL_SPEED = 28;
const STAR_COUNT = 3;
const DIZZY_STUN = 0.3;
const PUPIL_SPREAD = 0.13;

/** How a swing looks. Purely visual: the simulation only knows "a strike". */
export type SwingStyle = 'chop' | 'swipe' | 'thrust' | 'spin';

export interface PersonRig {
  type: 'person';
  unitKind: UnitKind;
  scale: number;
  root: TransformNode;
  body: TransformNode;
  torso: TransformNode;
  head: TransformNode;
  pupils: InstancedMesh[];
  deadEyes: TransformNode;
  legL: TransformNode;
  legR: TransformNode;
  armL: TransformNode;
  armR: TransformNode;
  shield: TransformNode | null;
  helmet: InstancedMesh;
  weapons: Partial<Record<Weapon, TransformNode>>;
  stars: TransformNode;
  /** Bobbing arrow shown over the soldiers the player has selected. */
  marker: TransformNode;
  walkPhase: number;
  swingAge: number | null;
  swingStyle: SwingStyle;
  shieldAmount: number;
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
const NO_SHADOW_GLOSS = { gloss: true, castShadow: false } as const;

function node(name: string, parent: TransformNode, x = 0, y = 0, z = 0): TransformNode {
  const n = new TransformNode(name, parent.getScene());
  n.parent = parent;
  n.position.set(x, y, z);
  return n;
}

/** Big googly eyes. Pupils wobble when hit; on death they turn into crosses. */
function addEyes(parts: PartFactory, head: TransformNode, forward: number, size: number): { pupils: InstancedMesh[]; deadEyes: TransformNode } {
  const pupils: InstancedMesh[] = [];
  const deadEyes = node('dead-eyes', head);
  for (const side of [-1, 1]) {
    const x = side * PUPIL_SPREAD;
    parts.part('eye', COLORS.eyeWhite, head, [size, size * 1.1, size * 0.6], [x, 0, forward], NO_SHADOW_GLOSS);
    pupils.push(parts.part('eye', COLORS.pupil, head, [size * 0.45, size * 0.5, size * 0.3], [x, 0, forward + size * 0.24], NO_SHADOW_GLOSS));
    const cross = node('x-eye', deadEyes, x, 0, forward + size * 0.3);
    parts.part('box', COLORS.pupil, cross, [size * 0.7, size * 0.12, 0.02], [0, 0, 0], { castShadow: false }).rotation.z = 0.8;
    parts.part('box', COLORS.pupil, cross, [size * 0.7, size * 0.12, 0.02], [0, 0, 0], { castShadow: false }).rotation.z = -0.8;
  }
  deadEyes.setEnabled(false);
  return { pupils, deadEyes };
}

function addSword(parts: PartFactory, grip: TransformNode): TransformNode {
  const sword = node('sword', grip);
  sword.rotation.x = -1.75;
  parts.part('box', COLORS.steel, sword, [0.1, 0.95, 0.04], [0, -0.58, 0], GLOSS);
  parts.part('smoothCone', COLORS.steel, sword, [0.1, 0.16, 0.04], [0, -1.12, 0], GLOSS).rotation.x = Math.PI;
  parts.part('capsule', COLORS.gold, sword, [0.1, 0.36, 0.1], [0, -0.08, 0], GLOSS).rotation.z = Math.PI / 2;
  parts.part('sphere', COLORS.gold, sword, [0.11, 0.11, 0.11], [0, 0.1, 0], GLOSS);
  return sword;
}

function addSpear(parts: PartFactory, grip: TransformNode): TransformNode {
  const spear = node('spear', grip);
  spear.rotation.x = -1.75;
  parts.part('disc', COLORS.wood, spear, [0.07, 2.4, 0.07], [0, -0.55, 0], GLOSS);
  parts.part('smoothCone', COLORS.steel, spear, [0.16, 0.4, 0.16], [0, -1.92, 0], GLOSS).rotation.x = Math.PI;
  parts.part('torus', COLORS.gold, spear, [0.12, 0.5, 0.12], [0, -1.7, 0], GLOSS);
  return spear;
}

function addBow(parts: PartFactory, arm: TransformNode): TransformNode {
  const bow = node('bow', arm, 0, -0.48, 0.05);
  parts.part('capsule', COLORS.wood, bow, [0.07, 0.3, 0.07], [0, 0, 0], GLOSS).rotation.x = Math.PI / 2;
  parts.part('capsule', COLORS.wood, bow, [0.06, 0.6, 0.06], [0, 0.1, 0.38], GLOSS).rotation.x = 1.2;
  parts.part('capsule', COLORS.wood, bow, [0.06, 0.6, 0.06], [0, 0.1, -0.38], GLOSS).rotation.x = -1.2;
  parts.part('box', COLORS.edgePost, bow, [0.015, 0.015, 1.25], [0, 0.22, 0], { castShadow: false });
  return bow;
}

/** Tall Roman scutum: team color with curved-looking edges, trim rim, steel boss, golden emblem. */
function addScutum(parts: PartFactory, parent: TransformNode, palette: ArmyPalette): TransformNode {
  const shield = node('scutum', parent, -0.62, 1.0, 0.06);
  parts.part('box', palette.trim, shield, [0.08, 1.08, 0.74], [0.02, 0, 0], GLOSS);
  parts.part('box', palette.body, shield, [0.1, 0.98, 0.64], [-0.01, 0, 0], GLOSS);
  parts.part('box', palette.body, shield, [0.08, 0.98, 0.16], [0.04, 0, 0.34], GLOSS).rotation.y = -0.35;
  parts.part('box', palette.body, shield, [0.08, 0.98, 0.16], [0.04, 0, -0.34], GLOSS).rotation.y = 0.35;
  parts.part('box', COLORS.emblem, shield, [0.02, 0.8, 0.07], [-0.07, 0, 0], GLOSS);
  parts.part('box', COLORS.emblem, shield, [0.02, 0.07, 0.5], [-0.07, 0.18, 0], GLOSS);
  parts.part('box', COLORS.emblem, shield, [0.02, 0.07, 0.5], [-0.07, -0.18, 0], GLOSS);
  parts.part('dome', COLORS.steel, shield, [0.26, 0.26, 0.26], [-0.07, 0, 0], GLOSS).rotation.z = Math.PI / 2;
  return shield;
}

function addRoundShield(parts: PartFactory, parent: TransformNode, palette: ArmyPalette): TransformNode {
  const shield = node('round-shield', parent, -0.6, 1.02, 0.06);
  parts.part('disc', palette.body, shield, [0.78, 0.09, 0.78], [0, 0, 0], GLOSS).rotation.z = Math.PI / 2;
  parts.part('torus', palette.trim, shield, [0.8, 0.8, 0.8], [0, 0, 0], GLOSS).rotation.z = Math.PI / 2;
  parts.part('dome', COLORS.gold, shield, [0.24, 0.24, 0.24], [-0.05, 0, 0], GLOSS).rotation.z = Math.PI / 2;
  return shield;
}

function addStars(parts: PartFactory, head: TransformNode): TransformNode {
  const stars = node('stars', head, 0, 0.62, 0);
  for (let i = 0; i < STAR_COUNT; i++) {
    const a = (i / STAR_COUNT) * Math.PI * 2;
    parts.part('sphere', COLORS.star, stars, [0.13, 0.13, 0.13], [Math.cos(a) * 0.38, 0, Math.sin(a) * 0.38], NO_SHADOW_GLOSS);
  }
  stars.setEnabled(false);
  return stars;
}

function addHeadgear(parts: PartFactory, head: TransformNode, kind: UnitKind, palette: ArmyPalette): InstancedMesh {
  switch (kind) {
    case 'commander': {
      const helmet = parts.part('dome', COLORS.gold, head, [0.78, 0.6, 0.74], [0, 0.17, 0], GLOSS);
      parts.part('smoothCone', COLORS.accent, head, [0.16, 0.7, 0.16], [0, 0.72, -0.05], GLOSS);
      parts.part('sphere', COLORS.accent, head, [0.24, 0.24, 0.24], [0, 1.02, -0.05], GLOSS);
      return helmet;
    }
    case 'swordsman': {
      const helmet = parts.part('dome', COLORS.steel, head, [0.76, 0.58, 0.72], [0, 0.16, 0], GLOSS);
      // Roman crest running front to back.
      parts.part('capsule', palette.trim, head, [0.1, 0.62, 0.22], [0, 0.5, 0], GLOSS).rotation.x = Math.PI / 2;
      parts.part('box', COLORS.steel, head, [0.06, 0.26, 0.2], [-0.37, -0.04, 0.12], GLOSS);
      parts.part('box', COLORS.steel, head, [0.06, 0.26, 0.2], [0.37, -0.04, 0.12], GLOSS);
      return helmet;
    }
    case 'archer': {
      const hood = parts.part('dome', palette.trim, head, [0.8, 0.62, 0.76], [0, 0.14, -0.02], GLOSS);
      parts.part('smoothCone', COLORS.emblem, head, [0.06, 0.45, 0.06], [0.25, 0.5, -0.15], GLOSS).rotation.z = -0.5;
      return hood;
    }
    default: {
      const helmet = parts.part('dome', COLORS.steel, head, [0.76, 0.6, 0.72], [0, 0.16, 0], GLOSS);
      parts.part('smoothCone', COLORS.steel, head, [0.12, 0.32, 0.12], [0, 0.6, 0], GLOSS);
      return helmet;
    }
  }
}

export function createPersonRig(scene: Scene, parts: PartFactory, kind: UnitKind, palette: ArmyPalette): PersonRig {
  const scale = kind === 'commander' ? COMMANDER_SCALE : 1;
  const root = new TransformNode(kind, scene);
  const body = node('body', root);
  body.scaling.setAll(scale);
  const torso = node('torso', body);

  const legL = node('legL', torso, -0.18, 0.52, 0);
  const legR = node('legR', torso, 0.18, 0.52, 0);
  for (const leg of [legL, legR]) {
    parts.part('capsule', palette.trim, leg, [0.24, 0.5, 0.24], [0, -0.22, 0], GLOSS);
    parts.part('sphere', COLORS.boot, leg, [0.27, 0.18, 0.36], [0, -0.46, 0.06], GLOSS);
  }
  // The bean: one rounded body with the face on it, Fall Guys style.
  parts.part('capsule', palette.body, torso, [0.8, 1.28, 0.7], [0, 1.08, 0], GLOSS);
  parts.part('torus', palette.trim, torso, [0.86, 0.9, 0.76], [0, 0.82, 0], GLOSS);
  parts.part('sphere', COLORS.gold, torso, [0.14, 0.14, 0.08], [0, 0.82, 0.37], GLOSS);
  const head = node('head', torso, 0, 1.46, 0);
  const { pupils, deadEyes } = addEyes(parts, head, 0.31, 0.2);
  parts.part('sphere', COLORS.skin, head, [0.42, 0.2, 0.1], [0, -0.2, 0.3], NO_SHADOW_GLOSS);
  const helmet = addHeadgear(parts, head, kind, palette);

  const armL = node('armL', torso, -0.45, 1.22, 0.02);
  const armR = node('armR', torso, 0.45, 1.22, 0.02);
  for (const arm of [armL, armR]) {
    parts.part('capsule', palette.body, arm, [0.2, 0.5, 0.2], [0, -0.22, 0], GLOSS);
    parts.part('sphere', COLORS.skin, arm, [0.19, 0.19, 0.19], [0, -0.48, 0], GLOSS);
  }
  const grip = node('grip', armR, 0, -0.5, 0.05);

  const weapons: Partial<Record<Weapon, TransformNode>> = {};
  let shield: TransformNode | null = null;
  if (kind === 'archer') {
    weapons.bow = addBow(parts, armL);
    parts.part('capsule', COLORS.wood, torso, [0.22, 0.55, 0.16], [0.18, 1.2, -0.36], GLOSS).rotation.z = 0.3;
  } else if (kind === 'swordsman') {
    weapons.sword = addSword(parts, grip);
    shield = addScutum(parts, torso, palette);
  } else if (kind === 'rider') {
    weapons.spear = addSpear(parts, grip);
    shield = addRoundShield(parts, torso, palette);
  } else {
    weapons.sword = addSword(parts, grip);
    weapons.spear = addSpear(parts, grip);
    weapons.bow = addBow(parts, armL);
    shield = addRoundShield(parts, torso, palette);
    parts.part('capsule', COLORS.accent, torso, [0.66, 1.05, 0.1], [0, 1.05, -0.36], GLOSS);
  }
  const stars = addStars(parts, head);
  const marker = node('marker', root, 0, 2.75 * scale, 0);
  parts.part('smoothCone', COLORS.toast, marker, [0.36, 0.42, 0.36], [0, 0, 0], NO_SHADOW_GLOSS).rotation.x = Math.PI;
  marker.setEnabled(false);

  return {
    type: 'person',
    unitKind: kind,
    scale,
    root,
    body,
    torso,
    head,
    pupils,
    deadEyes,
    legL,
    legR,
    armL,
    armR,
    shield,
    helmet,
    weapons,
    stars,
    marker,
    walkPhase: Math.random() * Math.PI * 2,
    swingAge: null,
    swingStyle: 'chop',
    shieldAmount: 0,
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

export function createHorseRig(scene: Scene, parts: PartFactory, palette: ArmyPalette, id: number): HorseRig {
  const hide = id % 2 === 0 ? COLORS.horseLight : COLORS.horseDark;
  const root = new TransformNode('horse', scene);
  const body = node('horse-body', root);
  parts.part('capsule', hide, body, [0.84, 2.0, 0.9], [0, 1.38, 0], GLOSS).rotation.x = Math.PI / 2;
  parts.part('capsule', hide, body, [0.46, 1.0, 0.5], [0, 1.85, 0.85], GLOSS).rotation.x = 0.55;
  parts.part('box', COLORS.mane, body, [0.12, 0.8, 0.26], [0, 2.05, 0.7], GLOSS).rotation.x = 0.55;
  parts.part('box', palette.body, body, [0.94, 0.06, 1.05], [0, 1.82, -0.05], GLOSS);
  parts.part('capsule', palette.trim, body, [0.7, 0.9, 0.2], [0, 1.9, -0.05], GLOSS).rotation.x = Math.PI / 2;
  parts.part('capsule', COLORS.mane, body, [0.16, 0.8, 0.16], [0, 1.45, -1.05], GLOSS).rotation.x = 0.6;
  const head = node('horse-head', body, 0, 2.22, 1.2);
  parts.part('capsule', hide, head, [0.38, 0.8, 0.44], [0, 0, 0.22], GLOSS).rotation.x = Math.PI / 2 - 0.35;
  parts.part('sphere', COLORS.mane, head, [0.3, 0.26, 0.2], [0, -0.13, 0.58], GLOSS);
  for (const side of [-1, 1]) {
    parts.part('smoothCone', hide, head, [0.1, 0.22, 0.1], [side * 0.12, 0.3, 0.02], GLOSS);
    parts.part('eye', COLORS.eyeWhite, head, [0.15, 0.17, 0.15], [side * 0.18, 0.1, 0.25], NO_SHADOW_GLOSS);
    parts.part('eye', COLORS.pupil, head, [0.07, 0.08, 0.07], [side * 0.24, 0.1, 0.28], NO_SHADOW_GLOSS);
  }
  const legs: TransformNode[] = [];
  for (const [x, z] of [[-0.28, 0.68], [0.28, 0.68], [-0.28, -0.68], [0.28, -0.68]] as const) {
    const leg = node('horse-leg', body, x, 1.0, z);
    parts.part('capsule', hide, leg, [0.22, 0.95, 0.22], [0, -0.44, 0], GLOSS);
    parts.part('disc', COLORS.boot, leg, [0.24, 0.12, 0.24], [0, -0.92, 0], GLOSS);
    legs.push(leg);
  }
  return { type: 'horse', scale: 1, root, body, head, legs, walkPhase: Math.random() * 6, hitAge: HIT_REACTION_TIME };
}

export interface AnimationContext {
  dt: number;
  now: number;
  mounted: boolean;
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
}

/** Arm pitch, sideways sweep, body twist and forward reach for the current swing. */
function swingPose(rig: PersonRig, mounted: boolean, weapon: Weapon): SwingPose | null {
  if (rig.swingAge === null) return null;
  const windup = meleeStatsForKind(rig.unitKind, mounted, weapon)?.windup ?? 0.25;
  const t = rig.swingAge;
  const strike = t - windup;
  if (strike > STRIKE_TIME + RECOVER_TIME) {
    rig.swingAge = null;
    return null;
  }
  const back = ease(t / windup);
  const hit = strike < 0 ? 0 : Math.min(1, strike / STRIKE_TIME);
  const recover = strike < STRIKE_TIME ? 0 : (strike - STRIKE_TIME) / RECOVER_TIME;
  switch (rig.swingStyle) {
    case 'chop': {
      const pitch = strike < 0 ? lerp(ARM_REST, ARM_OVERHEAD, back) : strike < STRIKE_TIME ? lerp(ARM_OVERHEAD, ARM_STRIKE_END, hit) : lerp(ARM_STRIKE_END, ARM_REST, recover);
      return { pitch, sweep: 0, twist: strike < 0 ? -0.2 * back : 0.25 * (1 - recover), reach: 0 };
    }
    case 'swipe': {
      const sweep = strike < 0 ? lerp(0, -1.4, back) : strike < STRIKE_TIME ? lerp(-1.4, 1.1, hit) : lerp(1.1, 0, recover);
      return { pitch: -1.45 * (1 - recover), sweep, twist: sweep * 0.35, reach: 0 };
    }
    case 'thrust': {
      const reach = strike < 0 ? -0.25 * back : strike < STRIKE_TIME ? lerp(-0.25, 0.45, hit) : lerp(0.45, 0, recover);
      return { pitch: lerp(ARM_REST, -1.55, Math.min(1, back * 1.5)) * (1 - recover) + ARM_REST * recover, sweep: 0, twist: -reach * 0.5, reach };
    }
    case 'spin': {
      const spin = strike < 0 ? -0.4 * back : -0.4 + (Math.PI * 2 + 0.4) * ease(strike / (STRIKE_TIME + RECOVER_TIME));
      return { pitch: -1.5, sweep: -1.2, twist: spin, reach: 0 };
    }
  }
}

function showWeapon(rig: PersonRig, weapon: Weapon): void {
  for (const [key, n] of Object.entries(rig.weapons)) n.setEnabled(key === weapon);
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

function animateArms(rig: PersonRig, view: UnitView, pose: SwingPose | null, flail: boolean, swing: number, now: number): void {
  if (flail) {
    rig.armL.rotation.set(-1.6 + Math.sin(now * FLAIL_SPEED) * 1.3, 0, -0.6);
    rig.armR.rotation.set(-1.6 + Math.cos(now * FLAIL_SPEED) * 1.3, 0, 0.6);
    return;
  }
  const armLRest = -swing * ANIMATION.armSwing;
  rig.armR.rotation.set(pose ? pose.pitch : ARM_REST + swing * ANIMATION.armSwing * 0.4, 0, pose ? -pose.sweep : 0);
  rig.armR.position.z = 0.02 + (pose?.reach ?? 0);
  if (view.weapon === 'bow') {
    rig.armL.rotation.set(lerp(armLRest, -1.5, rig.drawAmount), 0, 0);
    if (!pose) rig.armR.rotation.x = lerp(rig.armR.rotation.x, -1.45, rig.drawAmount);
    rig.armR.position.z = 0.02 - rig.drawAmount * 0.25;
  } else {
    rig.armL.rotation.set(lerp(armLRest, -1.35, rig.shieldAmount), rig.shieldAmount * 0.5, 0);
  }
}

export function animatePerson(rig: PersonRig, view: UnitView, ctx: AnimationContext): void {
  const { dt, now, mounted } = ctx;
  rig.root.position.set(view.x, view.y, view.z);
  rig.root.rotation.y = ctx.displayYaw;
  showWeapon(rig, view.weapon);
  const speed = mounted ? 0 : Math.hypot(view.vx, view.vz);
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
  rig.drawAmount = approach(rig.drawAmount, view.action === 'shoot' ? 1 : 0, dt * SHIELD_RAISE_RATE);
  animateLegs(rig, mounted, flail, airborne, swing, now);
  animateArms(rig, view, pose, flail, swing, now);

  const hitT = Math.max(0, 1 - rig.hitAge / HIT_REACTION_TIME);
  if (rig.shield) {
    const s = rig.shieldAmount;
    // A small shove back when a blocked blow lands on the shield.
    const bump = rig.hitBlocked ? hitT * 0.15 : 0;
    rig.shield.position.set(lerp(-0.62, -0.1, s), lerp(1.0, 1.12, s), lerp(0.06, 0.58 - bump, s));
    rig.shield.rotation.y = s * (Math.PI / 2);
  }

  // Body: knockdown, wobble, waddle, a crouch behind the shield, squash and stretch.
  const lying = view.stunTimer > ANIMATION.knockdownStun ? 1 : 0;
  rig.knockdown = approach(rig.knockdown, lying, dt * KNOCKDOWN_RATE);
  const wobble = stunned && lying === 0 ? Math.sin(now * 25) * ANIMATION.stunWobble * Math.min(1, view.stunTimer * 3) : 0;
  const waddle = Math.sin(rig.walkPhase) * 0.12 * stride;
  const flinch = rig.hitBlocked ? -0.1 * hitT : -0.4 * hitT;
  const crouch = mounted ? 0 : rig.shieldAmount * 0.12;
  rig.body.rotation.set(-rig.knockdown * 1.45 + flinch + crouch, pose?.twist ?? 0, wobble + waddle);
  const landT = Math.max(0, 1 - rig.landAge / LAND_SQUASH_TIME);
  const squash = (rig.hitBlocked ? 0.06 : 0.2) * hitT * Math.sin(rig.hitAge * 30) + landT * 0.18;
  const stretch = airborne && !flail ? 0.08 : 0;
  const breathe = Math.sin(now * 2.2 + rig.walkPhase) * 0.012;
  rig.torso.scaling.set(1 + squash, 1 - squash + stretch + breathe, 1 + squash);
  rig.body.position.y = mounted ? 0 : Math.abs(Math.sin(rig.walkPhase)) * ANIMATION.bob * 1.6 * stride + rig.knockdown * 0.22 - crouch * 0.4;

  // Head: comic wobble on hits; googly pupils jiggle; dizzy stars when stunned.
  rig.head.rotation.set(Math.sin(now * 23) * 0.15 * hitT, 0, Math.sin(now * 31) * 0.35 * hitT);
  const jiggle = hitT + (stunned ? 0.6 : 0);
  rig.pupils.forEach((p, i) => {
    p.position.x = (i === 0 ? -PUPIL_SPREAD : PUPIL_SPREAD) + Math.sin(now * 37 + i * 2) * 0.04 * jiggle;
    p.position.y = Math.cos(now * 41 + i) * 0.04 * jiggle;
  });
  const dizzy = view.stunTimer > DIZZY_STUN;
  rig.stars.setEnabled(dizzy);
  if (dizzy) rig.stars.rotation.y = now * 6;

  rig.marker.position.y = 2.75 * rig.scale + (mounted ? 1.4 : 0) + Math.sin(now * 5) * 0.12;
  rig.marker.rotation.y = now * 2;
  rig.root.setEnabled(!view.invulnerable || Math.sin(now * BLINK_RATE) > -0.3);
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
    p.position.x = (i === 0 ? -PUPIL_SPREAD : PUPIL_SPREAD) + Math.cos(now * 8 + i * Math.PI) * 0.05;
    p.position.y = Math.sin(now * 8 + i * Math.PI) * 0.05;
  });
}

/** Back on their feet after patching up. */
export function standUp(rig: PersonRig): void {
  rig.downed = false;
  rig.stars.setEnabled(false);
  rig.knockdown = 1;
}

/** Picks a swing style for variety; spears thrust, commanders sometimes spin. */
export function startSwing(rig: Rig, weapon: Weapon): void {
  if (rig.type !== 'person') return;
  rig.swings++;
  rig.swingAge = 0;
  if (weapon === 'spear') {
    rig.swingStyle = 'thrust';
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
