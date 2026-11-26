import { type InstancedMesh, TransformNode, type Scene } from '@babylonjs/core';
import { approach, lerp, meleeStatsForKind, type UnitKind, type UnitView } from '@tumblehorde/shared';
import { ANIMATION, type ArmyPalette, COLORS } from '../visualConfig.ts';
import type { PartFactory } from './parts.ts';

const COMMANDER_SCALE = 1.15;
const ARM_REST = -0.35;
const ARM_OVERHEAD = -3.0;
const ARM_STRIKE_END = 0.15;
const STRIKE_TIME = 0.12;
const RECOVER_TIME = 0.23;
const SHIELD_RAISE_RATE = 12;
const KNOCKDOWN_RATE = 6;
const BLINK_RATE = 18;

export interface PersonRig {
  type: 'person';
  unitKind: UnitKind;
  scale: number;
  root: TransformNode;
  body: TransformNode;
  legL: TransformNode;
  legR: TransformNode;
  armL: TransformNode;
  armR: TransformNode;
  shield: TransformNode | null;
  helmet: InstancedMesh;
  weapon: TransformNode | null;
  walkPhase: number;
  swingAge: number | null;
  shieldAmount: number;
  drawAmount: number;
  knockdown: number;
}

export interface HorseRig {
  type: 'horse';
  scale: number;
  root: TransformNode;
  body: TransformNode;
  head: TransformNode;
  legs: TransformNode[];
  walkPhase: number;
}

export type Rig = PersonRig | HorseRig;

function node(name: string, parent: TransformNode, x = 0, y = 0, z = 0): TransformNode {
  const n = new TransformNode(name, parent.getScene());
  n.parent = parent;
  n.position.set(x, y, z);
  return n;
}

export function createPersonRig(scene: Scene, parts: PartFactory, kind: UnitKind, palette: ArmyPalette): PersonRig {
  const scale = kind === 'commander' ? COMMANDER_SCALE : 1;
  const root = new TransformNode(kind, scene);
  const body = node('body', root);
  body.scaling.setAll(scale);
  const { body: shirt, trim } = palette;

  const legL = node('legL', body, -0.17, 0.6, 0);
  const legR = node('legR', body, 0.17, 0.6, 0);
  parts.part('box', trim, legL, [0.3, 0.6, 0.3], [0, -0.3, 0]);
  parts.part('box', trim, legR, [0.3, 0.6, 0.3], [0, -0.3, 0]);
  parts.part('box', shirt, body, [0.74, 0.8, 0.46], [0, 1.0, 0]);
  parts.part('box', trim, body, [0.8, 0.14, 0.52], [0, 1.34, 0]);
  const head = node('head', body, 0, 1.62, 0);
  parts.part('box', COLORS.skin, head, [0.46, 0.44, 0.44], [0, 0, 0]);
  const helmet = parts.part('box', COLORS.steel, head, [0.52, 0.22, 0.5], [0, 0.16, 0]);

  const armL = node('armL', body, -0.46, 1.32, 0.04);
  const armR = node('armR', body, 0.46, 1.32, 0.04);
  parts.part('box', COLORS.skin, armL, [0.2, 0.56, 0.2], [0, -0.26, 0]);
  parts.part('box', COLORS.skin, armR, [0.2, 0.56, 0.2], [0, -0.26, 0]);

  let shield: TransformNode | null = null;
  let weapon: TransformNode | null = null;
  if (kind === 'archer') {
    weapon = node('bow', armL, 0, -0.52, 0.05);
    parts.part('box', COLORS.wood, weapon, [0.06, 0.06, 0.28], [0, 0, 0]);
    parts.part('box', COLORS.wood, weapon, [0.05, 0.05, 0.5], [0, 0.1, 0.36]).rotation.x = 0.35;
    parts.part('box', COLORS.wood, weapon, [0.05, 0.05, 0.5], [0, 0.1, -0.36]).rotation.x = -0.35;
    parts.part('box', COLORS.edgePost, weapon, [0.015, 0.015, 1.1], [0, 0.22, 0]);
    parts.part('box', COLORS.wood, body, [0.22, 0.46, 0.14], [0.16, 1.26, -0.3]);
  } else {
    shield = node('shield', body, -0.6, 1.06, 0.06);
    parts.part('box', trim, shield, [0.12, 0.68, 0.58], [0, 0, 0]);
    parts.part('box', COLORS.steel, shield, [0.07, 0.3, 0.34], [-0.05, 0, 0]);
    const grip = node('grip', armR, 0, -0.52, 0.05);
    weapon = node('weapon', grip);
    weapon.rotation.x = -1.75;
    if (kind === 'rider') {
      parts.part('box', COLORS.wood, weapon, [0.09, 2.3, 0.09], [0, -0.55, 0]);
      parts.part('box', COLORS.steel, weapon, [0.1, 0.34, 0.1], [0, -1.8, 0]);
    } else {
      parts.part('box', COLORS.steel, weapon, [0.09, 1.0, 0.09], [0, -0.55, 0]);
      parts.part('box', COLORS.darkWood, weapon, [0.26, 0.1, 0.12], [0, -0.06, 0]);
    }
  }
  if (kind === 'commander') {
    parts.part('cone', COLORS.accent, head, [0.11, 0.6, 0.11], [0, 0.55, 0]);
    parts.part('box', COLORS.accent, body, [0.62, 0.95, 0.12], [0, 1.0, -0.3]);
  }

  return {
    type: 'person',
    unitKind: kind,
    scale,
    root,
    body,
    legL,
    legR,
    armL,
    armR,
    shield,
    helmet,
    weapon,
    walkPhase: Math.random() * Math.PI * 2,
    swingAge: null,
    shieldAmount: 0,
    drawAmount: 0,
    knockdown: 0,
  };
}

export function createHorseRig(scene: Scene, parts: PartFactory, palette: ArmyPalette, id: number): HorseRig {
  const hide = id % 2 === 0 ? COLORS.horseLight : COLORS.horseDark;
  const root = new TransformNode('horse', scene);
  const body = node('horse-body', root);
  parts.part('box', hide, body, [0.8, 0.92, 1.9], [0, 1.35, 0]);
  parts.part('box', hide, body, [0.62, 0.92, 0.6], [0, 1.7, 1.0]);
  parts.part('box', COLORS.mane, body, [0.14, 0.8, 0.3], [0, 1.95, 0.8]);
  parts.part('box', palette.trim, body, [0.86, 0.14, 1.1], [0, 1.84, -0.05]);
  parts.part('box', COLORS.mane, body, [0.14, 0.8, 0.14], [0, 1.5, -0.98]).rotation.x = 0.4;
  const head = node('horse-head', body, 0, 2.0, 1.2);
  parts.part('box', hide, head, [0.5, 0.52, 0.72], [0, 0.1, 0.2]);
  const legs: TransformNode[] = [];
  for (const [x, z] of [[-0.3, 0.68], [0.3, 0.68], [-0.3, -0.68], [0.3, -0.68]] as const) {
    const leg = node('horse-leg', body, x, 0.95, z);
    parts.part('box', hide, leg, [0.26, 0.95, 0.26], [0, -0.47, 0]);
    legs.push(leg);
  }
  return { type: 'horse', scale: 1, root, body, head, legs, walkPhase: Math.random() * 6 };
}

export interface AnimationContext {
  dt: number;
  now: number;
  mounted: boolean;
}

function weaponArmAngle(rig: PersonRig, mounted: boolean, swing: number): number {
  if (rig.swingAge === null) return ARM_REST + swing * ANIMATION.armSwing * 0.4;
  const windup = meleeStatsForKind(rig.unitKind, mounted)?.windup ?? 0.25;
  const t = rig.swingAge;
  if (t < windup) return lerp(ARM_REST, ARM_OVERHEAD, Math.sin((t / windup) * (Math.PI / 2)));
  const strike = t - windup;
  if (strike < STRIKE_TIME) return lerp(ARM_OVERHEAD, ARM_STRIKE_END, strike / STRIKE_TIME);
  if (strike < STRIKE_TIME + RECOVER_TIME) return lerp(ARM_STRIKE_END, ARM_REST, (strike - STRIKE_TIME) / RECOVER_TIME);
  rig.swingAge = null;
  return ARM_REST;
}

export function animatePerson(rig: PersonRig, view: UnitView, ctx: AnimationContext): void {
  const { dt, now, mounted } = ctx;
  rig.root.position.set(view.x, view.y, view.z);
  rig.root.rotation.y = view.yaw;
  const speed = mounted ? 0 : Math.hypot(view.vx, view.vz);
  const stride = Math.min(1, speed / 4);
  rig.walkPhase += dt * speed * ANIMATION.walkCycleSpeed;
  const swing = Math.sin(rig.walkPhase) * stride;

  if (mounted) {
    rig.legL.rotation.set(-1.35, 0, -0.35);
    rig.legR.rotation.set(-1.35, 0, 0.35);
  } else if (!view.onGround && view.stunTimer <= 0) {
    rig.legL.rotation.set(-0.7, 0, 0);
    rig.legR.rotation.set(0.35, 0, 0);
  } else {
    rig.legL.rotation.set(swing * ANIMATION.legSwing, 0, 0);
    rig.legR.rotation.set(-swing * ANIMATION.legSwing, 0, 0);
  }

  if (rig.swingAge !== null) rig.swingAge += dt;
  rig.armR.rotation.x = weaponArmAngle(rig, mounted, swing);

  rig.shieldAmount = approach(rig.shieldAmount, view.shieldUp ? 1 : 0, dt * SHIELD_RAISE_RATE);
  rig.drawAmount = approach(rig.drawAmount, view.action === 'shoot' ? 1 : 0, dt * SHIELD_RAISE_RATE);
  const armLRest = -swing * ANIMATION.armSwing;
  if (rig.unitKind === 'archer') {
    rig.armL.rotation.x = lerp(armLRest, -1.5, rig.drawAmount);
    if (rig.swingAge === null) rig.armR.rotation.x = lerp(rig.armR.rotation.x, -1.45, rig.drawAmount);
    rig.armR.position.z = 0.04 - rig.drawAmount * 0.25;
  } else {
    rig.armL.rotation.x = lerp(armLRest, -1.35, rig.shieldAmount);
    rig.armL.rotation.y = rig.shieldAmount * 0.5;
  }
  if (rig.shield) {
    const s = rig.shieldAmount;
    rig.shield.position.set(lerp(-0.6, -0.12, s), lerp(1.06, 1.2, s), lerp(0.06, 0.55, s));
    rig.shield.rotation.y = s * (Math.PI / 2);
  }

  const lying = view.stunTimer > ANIMATION.knockdownStun ? 1 : 0;
  rig.knockdown = approach(rig.knockdown, lying, dt * KNOCKDOWN_RATE);
  const wobble = view.stunTimer > 0 && lying === 0 ? Math.sin(now * 25) * ANIMATION.stunWobble * Math.min(1, view.stunTimer * 3) : 0;
  rig.body.rotation.set(-rig.knockdown * 1.45, 0, wobble);
  rig.body.position.y = mounted ? 0 : Math.abs(Math.sin(rig.walkPhase)) * ANIMATION.bob * stride + rig.knockdown * 0.22;

  rig.root.setEnabled(!view.invulnerable || Math.sin(now * BLINK_RATE) > -0.3);
}

export function animateHorse(rig: HorseRig, view: UnitView, ctx: AnimationContext): void {
  rig.root.position.set(view.x, view.y, view.z);
  rig.root.rotation.y = view.yaw;
  const speed = Math.hypot(view.vx, view.vz);
  const stride = Math.min(1, speed / 6);
  rig.walkPhase += ctx.dt * speed * ANIMATION.gallopSpeed;
  const phases = [0, 0.6, Math.PI, Math.PI + 0.6];
  rig.legs.forEach((leg, i) => {
    leg.rotation.x = Math.sin(rig.walkPhase + (phases[i] ?? 0)) * 0.75 * stride;
  });
  rig.body.rotation.x = Math.sin(rig.walkPhase * 2) * 0.05 * stride;
  rig.body.position.y = Math.abs(Math.sin(rig.walkPhase)) * 0.12 * stride;
  rig.head.rotation.x = 0.35 + Math.sin(rig.walkPhase * 2) * 0.15 * stride;
}

export function startSwing(rig: Rig): void {
  if (rig.type === 'person') rig.swingAge = 0;
}
