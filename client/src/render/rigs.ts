import { TransformNode, type Scene } from './babylon.ts';
import { approach, lerp, meleeStatsForKind, type UnitKind, type UnitView, type Weapon } from '@tumblehorde/shared';
import { ANIMATION, type ArmyPalette, COLORS, ROMAN } from '../visualConfig.ts';
import { buildBean } from './beans.ts';
import { buildRoman, type PersonBody } from './legionary.ts';
import { childNode, type PartFactory } from './parts.ts';

const COMMANDER_SCALE = 1.12;
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

/** How a swing looks. Purely visual: the simulation only knows "a strike". */
export type SwingStyle = 'chop' | 'swipe' | 'thrust' | 'spin' | 'slash' | 'lance';

export interface PersonRig extends PersonBody {
  type: 'person';
  unitKind: UnitKind;
  scale: number;
  root: TransformNode;
  body: TransformNode;
  stars: TransformNode;
  pupilRest: { x: number; y: number }[];
  walkPhase: number;
  swingAge: number | null;
  swingStyle: SwingStyle;
  shieldAmount: number;
  /** 0 = spear upright on the shoulder, 1 = levelled and ready. */
  guardAmount: number;
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

function addStars(parts: PartFactory, head: TransformNode): TransformNode {
  const stars = childNode('stars', head, 0, 0.5, 0);
  for (let i = 0; i < STAR_COUNT; i++) {
    const a = (i / STAR_COUNT) * Math.PI * 2;
    parts.part('sphere', COLORS.star, stars, [0.11, 0.11, 0.11], [Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3], NO_SHADOW_GLOSS);
  }
  stars.setEnabled(false);
  return stars;
}

export function createPersonRig(scene: Scene, parts: PartFactory, kind: UnitKind, palette: ArmyPalette): PersonRig {
  const scale = kind === 'commander' ? COMMANDER_SCALE : 1;
  const root = new TransformNode(kind, scene);
  const body = childNode('body', root);
  body.scaling.setAll(scale);
  const roman = kind === 'swordsman' || kind === 'commander';
  const built = roman ? buildRoman(parts, body, palette, kind === 'commander') : buildBean(parts, body, kind, palette);
  const stars = addStars(parts, built.head);
  return {
    ...built,
    type: 'person',
    unitKind: kind,
    scale,
    root,
    body,
    stars,
    pupilRest: built.pupils.map((p) => ({ x: p.position.x, y: p.position.y })),
    walkPhase: Math.random() * Math.PI * 2,
    swingAge: null,
    swingStyle: 'chop',
    shieldAmount: 0,
    guardAmount: 0,
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

/** A war horse in barding: cloth in the army's color, bronze chest plate, neck plates and face plate. */
export function createHorseRig(scene: Scene, parts: PartFactory, palette: ArmyPalette, id: number): HorseRig {
  const hide = id % 2 === 0 ? COLORS.horseLight : COLORS.horseDark;
  const root = new TransformNode('horse', scene);
  const body = childNode('horse-body', root);
  parts.part('roundCapsule', hide, body, [0.8, 2.0, 0.88], [0, 1.38, 0], GLOSS).rotation.x = Math.PI / 2;
  parts.part('roundCapsule', hide, body, [0.42, 1.0, 0.5], [0, 1.85, 0.85], GLOSS).rotation.x = 0.55;
  parts.part('box', COLORS.mane, body, [0.1, 0.8, 0.24], [0, 2.05, 0.68], GLOSS).rotation.x = 0.55;
  // Caparison over the back, trimmed in gold, and a Roman four-horned saddle on top.
  parts.part('roundCapsule', palette.body, body, [0.9, 1.62, 0.95], [0, 1.43, -0.08], GLOSS).rotation.x = Math.PI / 2;
  parts.part('tube', COLORS.gold, body, [0.92, 0.4, 1.55], [0, 1.2, -0.08], METAL);
  parts.part('box', ROMAN.leather, body, [0.6, 0.12, 0.7], [0, 1.88, -0.08], GLOSS);
  for (const x of [-0.22, 0.22]) {
    for (const z of [-0.36, 0.22]) parts.part('roundSphere', ROMAN.darkLeather, body, [0.1, 0.12, 0.1], [x, 1.97, z], GLOSS);
  }
  parts.part('roundSphere', ROMAN.bronze, body, [0.78, 0.62, 0.3], [0, 1.4, 0.95], METAL);
  for (let i = 0; i < 3; i++) {
    const plate = parts.part('box', ROMAN.bronze, body, [0.36, 0.06, 0.26], [0, 1.95 + i * 0.13, 0.62 + i * 0.16], METAL);
    plate.rotation.x = 0.55;
  }
  parts.part('roundCapsule', COLORS.mane, body, [0.15, 0.8, 0.15], [0, 1.45, -1.05], GLOSS).rotation.x = 0.6;
  const head = childNode('horse-head', body, 0, 2.22, 1.2);
  parts.part('roundCapsule', hide, head, [0.36, 0.8, 0.42], [0, 0, 0.22], GLOSS).rotation.x = Math.PI / 2 - 0.35;
  parts.part('roundSphere', COLORS.mane, head, [0.28, 0.24, 0.2], [0, -0.13, 0.58], GLOSS);
  const chamfron = parts.part('box', ROMAN.bronze, head, [0.26, 0.05, 0.5], [0, 0.12, 0.28], METAL);
  chamfron.rotation.x = -0.35;
  parts.part('roundCapsule', palette.body, head, [0.08, 0.3, 0.14], [0, 0.36, 0.02], GLOSS);
  for (const side of [-1, 1]) {
    parts.part('smoothCone', hide, head, [0.1, 0.22, 0.1], [side * 0.12, 0.3, -0.02], GLOSS);
    parts.part('roundSphere', COLORS.pupil, head, [0.08, 0.1, 0.08], [side * 0.18, 0.08, 0.26], NO_SHADOW_GLOSS);
  }
  const legs: TransformNode[] = [];
  for (const [x, z] of [[-0.26, 0.66], [0.26, 0.66], [-0.26, -0.66], [0.26, -0.66]] as const) {
    const leg = childNode('horse-leg', body, x, 1.0, z);
    parts.part('roundCapsule', hide, leg, [0.2, 0.95, 0.2], [0, -0.44, 0], GLOSS);
    parts.part('roundCylinder', COLORS.boot, leg, [0.22, 0.12, 0.22], [0, -0.92, 0], GLOSS);
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
  /** Wrist flick: extra pitch on the weapon so a slash follows through downwards. */
  wrist: number;
  /** Leaning out of the saddle towards the side being struck. */
  lean: number;
}

const NO_SWING = { sweep: 0, twist: 0, reach: 0, wrist: 0, lean: 0 } as const;

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
  /** windup → strike → back to rest, for any value. */
  const phase = (rest: number, cocked: number, struck: number): number =>
    strike < 0 ? lerp(rest, cocked, back) : strike < STRIKE_TIME ? lerp(cocked, struck, hit) : lerp(struck, rest, recover);
  switch (rig.swingStyle) {
    case 'chop':
      return { ...NO_SWING, pitch: phase(ARM_REST, ARM_OVERHEAD, ARM_STRIKE_END), twist: strike < 0 ? -0.2 * back : 0.25 * (1 - recover) };
    case 'swipe': {
      const sweep = phase(0, -1.4, 1.1);
      return { ...NO_SWING, pitch: -1.45 * (1 - recover), sweep, twist: sweep * 0.35 };
    }
    case 'thrust': {
      // Overhand spear thrust over the shield rim.
      return { ...NO_SWING, pitch: phase(ARM_SPEAR_GUARD, ARM_SPEAR_GUARD - 0.25, ARM_SPEAR_GUARD + 0.35), reach: phase(0, -0.22, 0.5), twist: phase(0, 0.15, -0.25) };
    }
    case 'spin': {
      const spin = strike < 0 ? -0.4 * back : -0.4 + (Math.PI * 2 + 0.4) * ease(strike / (STRIKE_TIME + RECOVER_TIME));
      return { ...NO_SWING, pitch: -1.5, sweep: -1.2, twist: spin };
    }
    case 'slash':
      // From the saddle: sword raised high and out, then hacked down at whoever is below.
      return {
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

function showWeapon(rig: PersonRig, weapon: Weapon): void {
  for (const [key, n] of Object.entries(rig.weapons)) n.setEnabled(key === weapon);
  rig.sheathed?.setEnabled(weapon !== 'sword');
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

function animateShield(rig: PersonRig, hitT: number): void {
  if (!rig.shield) return;
  const s = rig.shieldAmount;
  const { rest, raised, restYaw } = rig.shieldPose;
  // A small shove back when a blocked blow lands on the shield.
  const bump = rig.hitBlocked ? hitT * 0.12 : 0;
  rig.shield.position.set(lerp(rest[0], raised[0], s), lerp(rest[1], raised[1], s), lerp(rest[2], raised[2], s) - bump * s);
  rig.shield.rotation.y = lerp(restYaw, Math.PI / 2, s);
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
  showWeapon(rig, view.weapon);
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
  animateShield(rig, hitT);
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
  rig.body.rotation.set(-rig.knockdown * 1.45 + flinch + crouch + Math.abs(lean) * 0.4, pose?.twist ?? 0, wobble + waddle - lean);
  const landT = Math.max(0, 1 - rig.landAge / LAND_SQUASH_TIME);
  const squash = (rig.hitBlocked ? 0.05 : 0.16) * hitT * Math.sin(rig.hitAge * 30) + landT * 0.14;
  const stretch = airborne && !flail ? 0.06 : 0;
  const breathe = Math.sin(now * 2.2 + rig.walkPhase) * 0.008;
  rig.torso.scaling.set(1 + squash, 1 - squash + stretch + breathe, 1 + squash);
  rig.body.position.y = mounted ? 0 : Math.abs(Math.sin(rig.walkPhase)) * ANIMATION.bob * stride + rig.knockdown * 0.22 - crouch * 0.5;

  // Head: comic wobble on hits; dizzy stars when stunned.
  rig.head.rotation.set(Math.sin(now * 23) * 0.15 * hitT, 0, Math.sin(now * 31) * 0.3 * hitT);
  const dizzy = view.stunTimer > DIZZY_STUN;
  rig.stars.setEnabled(dizzy);
  if (dizzy) rig.stars.rotation.y = now * 6;
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
export function startSwing(rig: Rig, weapon: Weapon, mounted: boolean): void {
  if (rig.type !== 'person') return;
  rig.swings++;
  rig.swingAge = 0;
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
