import { type InstancedMesh, type Scene, TransformNode, Vector3 } from '../render/babylon.ts';
import { childNode, type PartFactory, type PartOptions } from '../render/parts.ts';
import type { Mood } from '@tumblehorde/shared';
import { ACTOR, CLOTH, DRESS, FACE, HAIR, SKIN } from './config.ts';
import type { VoiceSpec } from './script.ts';

/**
 * A cutscene character: the same chunky box people as in battle (cube head, box eyes and brows,
 * boxy body), but with elbows and knees, a face that can smile, frown and cry, and outfits for
 * monks, smiths, emperors and Vikings. Feet stand at y = 0 and the actor faces +z.
 */

export type Outfit =
  | 'monk'
  | 'abbot'
  | 'rags'
  | 'smith'
  | 'legion'
  /** Plain silver armor over a brown tunic: what Cassian buys from the smith, what Varro wears. */
  | 'silver'
  | 'commander'
  | 'emperor'
  | 'healer'
  | 'villager'
  | 'viking'
  | 'warlord'
  | 'bandit'
  /** A Mongol rider: a long coat with a sash, fur trim, a pointed fur-rimmed helmet, a curved saber. */
  | 'mongol'
  /** A Greek hoplite: bronze cuirass over a blue tunic, a crested bronze helmet, a big round shield. */
  | 'hoplite'
  /** The dark wizard: a hooded robe to the ground. */
  | 'wizard';

export type HairStyle = 'short' | 'long' | 'tonsure' | 'bald' | 'braids';
export type Beard = 'none' | 'stubble' | 'short' | 'long';
export type Age = 'child' | 'adult' | 'old';

export interface ActorLook {
  outfit: Outfit;
  skin?: string;
  hair?: string;
  hairStyle?: HairStyle;
  beard?: Beard;
  beardColor?: string;
  age?: Age;
  /** Cloth color for outfits that take one (villagers, legion tunic, capes). */
  color?: string;
  cape?: string;
  helmet?: boolean;
  /** A scar across one cheek. */
  scar?: boolean;
}

/** Joint angles of a pose. Arms: [raise forward, out to the side, bend elbow]; legs: [raise forward, bend knee]. */
export interface Pose {
  armL: readonly [number, number, number];
  armR: readonly [number, number, number];
  legL: readonly [number, number];
  legR: readonly [number, number];
  /** Bend forward at the hips. */
  lean: number;
  /** How far the hips sink (kneeling, sitting). */
  drop: number;
  /** 0 = upright, 1 = lying on the back. */
  lie: number;
  headNod: number;
  headTilt: number;
}

const DOWN: Pose['armL'] = [0, 0.08, 0];
const STRAIGHT: Pose['legL'] = [0, 0];

export const POSES = {
  stand: { armL: DOWN, armR: DOWN, legL: STRAIGHT, legR: STRAIGHT, lean: 0, drop: 0, lie: 0, headNod: 0, headTilt: 0 },
  /** Both hands together in front of the belly, working at something small. */
  carve: { armL: [-0.7, 0.05, -1.2], armR: [-0.75, 0.05, -1.1], legL: STRAIGHT, legR: STRAIGHT, lean: 0.12, drop: 0, lie: 0, headNod: 0.25, headTilt: 0 },
  /** Holding something out in both hands. */
  offer: { armL: [-1.1, 0.1, -0.4], armR: [-1.1, 0.1, -0.4], legL: STRAIGHT, legR: STRAIGHT, lean: 0.05, drop: 0, lie: 0, headNod: 0.2, headTilt: 0 },
  point: { armL: DOWN, armR: [-1.55, 0.1, 0], legL: STRAIGHT, legR: STRAIGHT, lean: 0, drop: 0, lie: 0, headNod: 0, headTilt: 0 },
  wave: { armL: DOWN, armR: [-2.6, 0.4, -0.6], legL: STRAIGHT, legR: STRAIGHT, lean: 0, drop: 0, lie: 0, headNod: 0, headTilt: 0.1 },
  shout: { armL: [-0.4, 0.5, -0.6], armR: [-2.4, 0.5, -0.3], legL: [-0.15, 0.1], legR: STRAIGHT, lean: -0.1, drop: 0, lie: 0, headNod: -0.2, headTilt: 0 },
  cheer: { armL: [-2.9, 0.3, -0.2], armR: [-2.9, 0.3, -0.2], legL: STRAIGHT, legR: STRAIGHT, lean: -0.1, drop: 0, lie: 0, headNod: -0.3, headTilt: 0 },
  /** Hands folded in prayer. */
  pray: { armL: [-0.9, -0.25, -1.4], armR: [-0.9, -0.25, -1.4], legL: STRAIGHT, legR: STRAIGHT, lean: 0.05, drop: 0, lie: 0, headNod: 0.4, headTilt: 0 },
  slump: { armL: [0.1, 0.05, 0], armR: [0.1, 0.05, 0], legL: STRAIGHT, legR: STRAIGHT, lean: 0.35, drop: 0, lie: 0, headNod: 0.55, headTilt: 0.1 },
  /** One hand on the chest: holding something close. */
  clutch: { armL: DOWN, armR: [-0.6, -0.3, -1.9], legL: STRAIGHT, legR: STRAIGHT, lean: 0.1, drop: 0, lie: 0, headNod: 0.35, headTilt: 0 },
  reach: { armL: DOWN, armR: [-1.3, 0.05, -0.15], legL: [-0.2, 0.1], legR: STRAIGHT, lean: 0.25, drop: 0, lie: 0, headNod: 0, headTilt: 0 },
  kneel: { armL: [0, 0.1, -0.3], armR: [0, 0.1, -0.3], legL: [-1.5, 1.5], legR: [0, 1.55], lean: 0, drop: 0.29, lie: 0, headNod: 0.25, headTilt: 0 },
  /** Kneeling, arms out holding someone lying across the lap. */
  cradle: { armL: [-0.9, 0.1, -0.9], armR: [-0.7, 0.1, -1.1], legL: [-1.5, 1.5], legR: [0, 1.55], lean: 0.25, drop: 0.29, lie: 0, headNod: 0.35, headTilt: 0.15 },
  sit: { armL: [-0.5, 0.05, -0.6], armR: [-0.5, 0.05, -0.6], legL: [-1.57, 1.57], legR: [-1.57, 1.57], lean: 0.05, drop: 0.2, lie: 0, headNod: 0.1, headTilt: 0 },
  /** Sitting hunched by a fire, elbows on knees. */
  hunch: { armL: [-1.0, 0.1, -1.6], armR: [-1.0, 0.1, -1.6], legL: [-1.57, 1.57], legR: [-1.57, 1.57], lean: 0.45, drop: 0.2, lie: 0, headNod: 0.25, headTilt: 0 },
  lie: { armL: [0, 0.4, 0], armR: [0, 0.4, 0], legL: STRAIGHT, legR: STRAIGHT, lean: 0, drop: 0, lie: 1, headNod: 0, headTilt: 0.5 },
  cower: { armL: [-2.2, 0.2, -1.6], armR: [-2.2, 0.2, -1.6], legL: [-0.3, 0.6], legR: [-0.3, 0.6], lean: 0.4, drop: 0.12, lie: 0, headNod: 0.4, headTilt: 0 },
  raiseSword: { armL: DOWN, armR: [-3.0, 0.1, 0], legL: STRAIGHT, legR: STRAIGHT, lean: -0.05, drop: 0, lie: 0, headNod: -0.25, headTilt: 0 },
  /** Arms open for an embrace. */
  embrace: { armL: [-1.3, 0.5, -0.6], armR: [-1.3, 0.5, -0.6], legL: STRAIGHT, legR: STRAIGHT, lean: 0.05, drop: 0, lie: 0, headNod: 0.1, headTilt: 0.15 },
  /** A fist held up, trembling: anger held in. */
  fist: { armL: DOWN, armR: [-1.0, 0.1, -1.8], legL: STRAIGHT, legR: STRAIGHT, lean: 0.1, drop: 0, lie: 0, headNod: 0.25, headTilt: 0 },
  punch: { armL: [-1.2, 0.2, -1.6], armR: [-1.6, 0, 0], legL: [-0.3, 0.1], legR: STRAIGHT, lean: 0.15, drop: 0, lie: 0, headNod: 0, headTilt: 0 },
} as const satisfies Record<string, Pose>;

export type PoseName = keyof typeof POSES;

/** What the legs do: whatever the pose says, or sit or kneel under any gesture. */
export type Stance = 'pose' | 'sit' | 'kneel';

function withStance(pose: Pose, stance: Stance): Pose {
  if (stance === 'pose') return pose;
  const legs = stance === 'sit' ? POSES.sit : POSES.kneel;
  return { ...pose, legL: legs.legL, legR: legs.legR, drop: legs.drop, lie: 0 };
}

interface FaceState {
  browAngle: number;
  browY: number;
  corners: number;
  open: number;
  lid: number;
  look: number;
  tears: boolean;
  blush: boolean;
}

const MOOD_FACE: Record<Mood, FaceState> = {
  neutral: { browAngle: 0, browY: 0, corners: 0, open: 0, lid: 0.1, look: 0, tears: false, blush: false },
  happy: { browAngle: -0.05, browY: 0.02, corners: 0.03, open: 0.35, lid: 0.15, look: 0, tears: false, blush: false },
  warm: { browAngle: 0.15, browY: 0.01, corners: 0.02, open: 0, lid: 0.35, look: 0, tears: false, blush: false },
  sad: { browAngle: 0.38, browY: 0.01, corners: -0.025, open: 0, lid: 0.4, look: -0.025, tears: false, blush: false },
  crying: { browAngle: 0.5, browY: 0.015, corners: -0.035, open: 0.45, lid: 0.55, look: -0.02, tears: true, blush: true },
  angry: { browAngle: -0.45, browY: -0.025, corners: -0.015, open: 0.1, lid: 0.3, look: 0, tears: false, blush: false },
  afraid: { browAngle: 0.35, browY: 0.04, corners: -0.02, open: 0.5, lid: 0, look: 0, tears: false, blush: false },
  surprised: { browAngle: 0, browY: 0.05, corners: 0, open: 0.65, lid: 0, look: 0, tears: false, blush: false },
  shout: { browAngle: -0.4, browY: -0.02, corners: -0.01, open: 1, lid: 0.2, look: 0, tears: false, blush: false },
};

const SMALL: PartOptions = { gloss: true, castShadow: false };
const GLOSS: PartOptions = { gloss: true };
const METAL: PartOptions = { metal: true };

const HIP = 0.62;
const SHOULDER = 0.66;
const NECK = 1.06;
const HEAD = 0.54;
const FZ = HEAD / 2 + 0.005;
const EYE_X = 0.12;
const EYE_Y = 0.03;
const MOUTH_Y = -0.15;
const LIE_LIFT = 0.28;
const TEAR_TOP = -0.05;
/** The head turns at most this far towards what someone looks at; the eyes and body do the rest. */
const HEAD_TURN_MAX = 0.8;
const HEAD_PITCH_SHARE = 0.5;
/** Below this speed a driven walker stands still. */
const DRIVE_MIN = 0.1;

interface Limb {
  upper: TransformNode;
  lower: TransformNode;
}

interface Face {
  pupils: InstancedMesh[];
  lids: TransformNode[];
  brows: InstancedMesh[];
  corners: InstancedMesh[];
  mouthOpen: InstancedMesh;
  tears: InstancedMesh[];
  streaks: TransformNode;
  blush: TransformNode;
}

function damp(current: number, target: number, rate: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-rate * dt));
}

function blinkGap(): number {
  return ACTOR.blinkMin + Math.random() * (ACTOR.blinkMax - ACTOR.blinkMin);
}

export class Actor {
  readonly root: TransformNode;
  readonly name: string;
  private readonly body: TransformNode;
  private readonly torso: TransformNode;
  readonly head: TransformNode;
  private readonly arms: [Limb, Limb];
  private readonly legs: [Limb, Limb];
  /** Props held in the right and left hand hang here. */
  readonly grips: [TransformNode, TransformNode];
  private readonly face: Face;
  private readonly wounds: TransformNode;
  private readonly baseLean: number;

  private pose: Pose = POSES.stand;
  private poseName: PoseName = 'stand';
  private stance: Stance = 'pose';
  private current: Pose = POSES.stand;
  private faceNow: FaceState = { ...MOOD_FACE.neutral };
  mood: Mood = 'neutral';
  talking = false;
  /** Shake with sobs while crying, or tremble (a fist held in anger). */
  trembling = false;
  private walkTarget: { x: number; z: number; speed: number } | null = null;
  /** Speed of a walker moved from outside (free roam), for the walk cycle. */
  private driveSpeed = 0;
  private walkPhase = 0;
  private yawTarget: number | null = null;
  private lookAtPoint: { x: number; y: number; z: number } | null = null;
  private blinkTimer = blinkGap();
  private blinkAge: number = ACTOR.blinkTime;
  private time = Math.random() * 10;
  private tearAge = 0;
  eyesClosed = false;
  /** How this person sounds when they speak. */
  voice: VoiceSpec = { pitch: 190, rate: 0.12 };

  constructor(scene: Scene, parts: PartFactory, name: string, look: ActorLook) {
    this.name = name;
    this.root = new TransformNode(`actor-${name}`, scene);
    this.body = childNode('body', this.root);
    const age = look.age ?? 'adult';
    if (age === 'child') this.body.scaling.setAll(ACTOR.childScale);
    this.baseLean = age === 'old' ? 0.22 : 0;
    const skin = look.skin ?? SKIN.warm;

    this.torso = childNode('torso', this.body, 0, HIP, 0);
    this.legs = [addLeg(parts, this.body, -1, skin, look), addLeg(parts, this.body, 1, skin, look)];
    addTorso(parts, this.torso, look);
    this.head = childNode('head', this.torso, 0, NECK, 0);
    if (age === 'child') this.head.scaling.setAll(1.2);
    this.face = addFace(parts, this.head, skin, look);
    addHair(parts, this.head, look);
    addHeadgear(parts, this.head, look);
    this.arms = [addArm(parts, this.torso, -1, skin, look), addArm(parts, this.torso, 1, skin, look)];
    this.grips = [childNode('grip-r', this.arms[1].lower, 0, -0.34, 0.04), childNode('grip-l', this.arms[0].lower, 0, -0.34, 0.04)];
    if (look.cape) addCape(parts, this.torso, look.cape);
    this.wounds = childNode('wounds', this.torso);
    parts.part('box', FACE.blood, this.wounds, [0.36, 0.3, 0.03], [0.1, 0.42, 0.29], SMALL);
    parts.part('box', FACE.blood, this.wounds, [0.16, 0.18, 0.03], [-0.04, 0.24, 0.29], SMALL);
    this.wounds.setEnabled(false);
  }

  place(x: number, z: number, yaw: number, y = 0): this {
    this.root.position.set(x, y, z);
    this.root.rotation.y = yaw;
    this.walkTarget = null;
    this.yawTarget = null;
    return this;
  }

  /** A gesture; with a stance other than 'pose', the legs keep sitting or kneeling meanwhile. */
  setPose(name: PoseName, instant = false): this {
    this.poseName = name;
    this.pose = withStance(POSES[name], this.stance);
    if (instant) this.current = this.pose;
    return this;
  }

  setStance(stance: Stance, instant = false): this {
    this.stance = stance;
    return this.setPose(this.poseName, instant);
  }

  setMood(mood: Mood, instant = false): this {
    this.mood = mood;
    if (instant) this.faceNow = { ...MOOD_FACE[mood] };
    return this;
  }

  walkTo(x: number, z: number, speed: number = ACTOR.walkSpeed): this {
    this.walkTarget = { x, z, speed };
    return this;
  }

  /** Jumps to the end of a walk (a skipped beat). */
  finishWalk(): void {
    if (!this.walkTarget) return;
    const { x, z } = this.walkTarget;
    this.root.rotation.y = Math.atan2(x - this.root.position.x, z - this.root.position.z);
    this.root.position.x = x;
    this.root.position.z = z;
    this.walkTarget = null;
  }

  /** Moved by a simulation (free roam): set where it is, which way it faces and how fast it goes. */
  drive(x: number, z: number, yaw: number, speed: number): void {
    this.root.position.x = x;
    this.root.position.z = z;
    this.root.rotation.y = yaw;
    this.driveSpeed = speed;
    this.walkTarget = null;
    this.yawTarget = null;
  }

  turnTo(yaw: number): this {
    this.yawTarget = yaw;
    return this;
  }

  faceTowards(x: number, z: number): this {
    return this.turnTo(Math.atan2(x - this.root.position.x, z - this.root.position.z));
  }

  /** The head turns towards a point (or straight ahead with null). */
  lookAt(point: { x: number; y: number; z: number } | null): this {
    this.lookAtPoint = point;
    return this;
  }

  setWounded(on: boolean): void {
    this.wounds.setEnabled(on);
  }

  /** World position of the head, for camera shots. */
  headPosition(): { x: number; y: number; z: number } {
    const p = this.head.getAbsolutePosition();
    return { x: p.x, y: p.y, z: p.z };
  }

  /** Applies the current pose at once and updates world positions, so shots can be planned from it. */
  settle(): this {
    this.update(0);
    let node: TransformNode | null = this.head;
    const chain: TransformNode[] = [];
    while (node) {
      chain.unshift(node);
      node = node.parent instanceof TransformNode ? node.parent : null;
    }
    for (const n of chain) n.computeWorldMatrix(true);
    return this;
  }

  get yaw(): number {
    // In the world, not relative to a parent: a rider faces where the horse faces.
    const forward = this.root.getDirection(Vector3.Forward());
    return Math.atan2(forward.x, forward.z);
  }

  get walking(): boolean {
    return this.walkTarget !== null;
  }

  update(dt: number): void {
    this.time += dt;
    this.updateWalk(dt);
    this.updatePose(dt);
    this.updateHead(dt);
    this.updateFace(dt);
  }

  private updateWalk(dt: number): void {
    if (this.driveSpeed > DRIVE_MIN) this.walkPhase += dt * ACTOR.walkCycle * (this.driveSpeed / ACTOR.walkSpeed);
    const target = this.walkTarget;
    const p = this.root.position;
    if (target) {
      const dx = target.x - p.x;
      const dz = target.z - p.z;
      const distance = Math.hypot(dx, dz);
      const stride = target.speed * dt;
      if (distance <= stride) {
        p.x = target.x;
        p.z = target.z;
        this.walkTarget = null;
      } else {
        p.x += (dx / distance) * stride;
        p.z += (dz / distance) * stride;
        this.yawTarget = Math.atan2(dx, dz);
        this.walkPhase += dt * ACTOR.walkCycle * (target.speed / ACTOR.walkSpeed);
      }
    }
    if (this.yawTarget !== null) {
      let delta = this.yawTarget - this.root.rotation.y;
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      this.root.rotation.y += delta * (1 - Math.exp(-ACTOR.turnRate * dt));
      if (Math.abs(delta) < 1e-3) this.yawTarget = null;
    }
  }

  private updatePose(dt: number): void {
    const k = ACTOR.poseRate;
    const c = this.current;
    const t = this.pose;
    const mix3 = (a: readonly [number, number, number], b: readonly [number, number, number]): [number, number, number] => [
      damp(a[0], b[0], k, dt),
      damp(a[1], b[1], k, dt),
      damp(a[2], b[2], k, dt),
    ];
    const mix2 = (a: readonly [number, number], b: readonly [number, number]): [number, number] => [damp(a[0], b[0], k, dt), damp(a[1], b[1], k, dt)];
    this.current = {
      armL: mix3(c.armL, t.armL),
      armR: mix3(c.armR, t.armR),
      legL: mix2(c.legL, t.legL),
      legR: mix2(c.legR, t.legR),
      lean: damp(c.lean, t.lean, k, dt),
      drop: damp(c.drop, t.drop, k, dt),
      lie: damp(c.lie, t.lie, k, dt),
      headNod: damp(c.headNod, t.headNod, k, dt),
      headTilt: damp(c.headTilt, t.headTilt, k, dt),
    };
    const pose = this.current;
    const walking = this.walkTarget !== null || this.driveSpeed > DRIVE_MIN ? 1 : 0;
    const swing = Math.sin(this.walkPhase) * 0.55 * walking;
    const shake = this.trembling ? Math.sin(this.time * ACTOR.sobRate * 6.3) * ACTOR.sobAmount : 0;
    const breath = Math.sin(this.time * ACTOR.breathRate * 6.3) * ACTOR.breathAmount;

    applyArm(this.arms[0], pose.armL, -1, -swing);
    applyArm(this.arms[1], pose.armR, 1, swing);
    applyLeg(this.legs[0], pose.legL, swing);
    applyLeg(this.legs[1], pose.legR, -swing);
    this.torso.rotation.x = pose.lean + this.baseLean;
    this.torso.position.y = HIP + shake;
    this.torso.scaling.y = 1 + breath;
    this.body.position.y = (-pose.drop + pose.lie * LIE_LIFT + Math.abs(Math.cos(this.walkPhase)) * 0.04 * walking) * this.body.scaling.y;
    this.body.rotation.x = -pose.lie * Math.PI / 2;
  }

  private updateHead(dt: number): void {
    let turn = 0;
    let lookUp = 0;
    const target = this.lookAtPoint;
    if (target) {
      const p = this.head.getAbsolutePosition();
      const yaw = Math.atan2(target.x - p.x, target.z - p.z);
      let delta = yaw - this.root.rotation.y;
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      turn = Math.max(-HEAD_TURN_MAX, Math.min(HEAD_TURN_MAX, delta));
      lookUp = Math.atan2(target.y - p.y, Math.hypot(target.x - p.x, target.z - p.z)) * HEAD_PITCH_SHARE;
    }
    const k = ACTOR.poseRate;
    this.head.rotation.y = damp(this.head.rotation.y, turn, k, dt);
    this.head.rotation.x = damp(this.head.rotation.x, this.current.headNod - this.current.lean * 0.5 - lookUp, k, dt);
    this.head.rotation.z = damp(this.head.rotation.z, this.current.headTilt, k, dt);
  }

  private updateFace(dt: number): void {
    const goal = MOOD_FACE[this.mood];
    const k = ACTOR.faceRate;
    const f = this.faceNow;
    f.browAngle = damp(f.browAngle, goal.browAngle, k, dt);
    f.browY = damp(f.browY, goal.browY, k, dt);
    f.corners = damp(f.corners, goal.corners, k, dt);
    f.lid = damp(f.lid, goal.lid, k, dt);
    f.look = damp(f.look, goal.look, k, dt);
    const talk = this.talking ? (0.25 + 0.45 * Math.abs(Math.sin(this.time * ACTOR.talkRate * Math.PI / 2))) : 0;
    f.open = damp(f.open, Math.max(goal.open * (this.talking ? 0.6 : 1), talk + goal.open * 0.3), k * 1.5, dt);
    f.tears = goal.tears;
    f.blush = goal.blush;

    const face = this.face;
    face.brows.forEach((brow, i) => {
      const side = i === 0 ? -1 : 1;
      brow.rotation.z = -side * f.browAngle;
      brow.position.y = 0.125 + f.browY;
    });
    face.corners.forEach((corner, i) => {
      const side = i === 0 ? -1 : 1;
      corner.position.y = MOUTH_Y + f.corners;
      corner.rotation.z = side * f.corners * 9;
    });
    face.mouthOpen.scaling.y = Math.max(0.001, f.open * 0.13);
    face.mouthOpen.position.y = MOUTH_Y - f.open * 0.05;
    face.mouthOpen.setEnabled(f.open > 0.04);

    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blinkAge = 0;
      this.blinkTimer = blinkGap();
    }
    this.blinkAge += dt;
    const blink = this.blinkAge < ACTOR.blinkTime ? 1 : 0;
    const lid = this.eyesClosed ? 1 : Math.max(f.lid, blink);
    for (const l of face.lids) l.scaling.y = Math.max(0.001, lid);
    face.pupils.forEach((pupil, i) => {
      const side = i === 0 ? -1 : 1;
      pupil.position.y = EYE_Y - 0.005 + f.look;
      pupil.position.x = side * EYE_X;
    });

    face.streaks.setEnabled(f.tears);
    face.blush.setEnabled(f.blush);
    this.tearAge = f.tears ? this.tearAge + dt : 0;
    face.tears.forEach((tear, i) => {
      tear.setEnabled(f.tears);
      const phase = (this.tearAge * ACTOR.tearSpeed + i * 0.45) % 1;
      tear.position.y = TEAR_TOP - phase * ACTOR.tearDrop;
    });
  }

  dispose(): void {
    this.root.dispose();
  }
}

function applyArm(limb: Limb, angles: readonly [number, number, number], side: number, swing: number): void {
  limb.upper.rotation.x = angles[0] + swing * 0.6;
  limb.upper.rotation.z = -side * angles[1];
  limb.lower.rotation.x = angles[2];
}

function applyLeg(limb: Limb, angles: readonly [number, number], swing: number): void {
  limb.upper.rotation.x = angles[0] + swing;
  limb.lower.rotation.x = angles[1] + Math.max(0, -swing) * 0.8;
}

function isRobed(outfit: Outfit): boolean {
  return outfit === 'monk' || outfit === 'abbot' || outfit === 'emperor' || outfit === 'healer' || outfit === 'wizard';
}

/** Women wear the healer's dress; their faces and hair get a woman's touches. */
export function isFeminine(look: ActorLook): boolean {
  return look.outfit === 'healer';
}

export function clothOf(look: ActorLook): { main: string; dark: string; sleeve: string } {
  switch (look.outfit) {
    case 'monk':
      return { main: CLOTH.robe, dark: CLOTH.robeDark, sleeve: CLOTH.robe };
    case 'abbot':
      return { main: CLOTH.linen, dark: CLOTH.robe, sleeve: CLOTH.linen };
    case 'rags':
      return { main: CLOTH.rags, dark: CLOTH.ragsDark, sleeve: CLOTH.rags };
    case 'smith':
      return { main: look.color ?? CLOTH.tunic, dark: CLOTH.apron, sleeve: look.color ?? CLOTH.tunic };
    case 'legion':
    case 'commander':
      return { main: look.color ?? CLOTH.legion, dark: CLOTH.legionTrim, sleeve: look.color ?? CLOTH.legion };
    case 'silver':
      return { main: look.color ?? CLOTH.silverTunic, dark: CLOTH.leather, sleeve: look.color ?? CLOTH.silverTunic };
    case 'emperor':
      return { main: CLOTH.purple, dark: CLOTH.purpleTrim, sleeve: CLOTH.linen };
    case 'healer':
      return { main: look.color ?? CLOTH.healer, dark: CLOTH.linen, sleeve: look.color ?? CLOTH.healer };
    case 'villager':
      return { main: look.color ?? CLOTH.tunic, dark: CLOTH.leather, sleeve: look.color ?? CLOTH.tunic };
    case 'viking':
    case 'warlord':
      return { main: look.color ?? CLOTH.vikingTunic, dark: CLOTH.pelt, sleeve: look.color ?? CLOTH.vikingTunic };
    case 'bandit':
      return { main: CLOTH.bandit, dark: CLOTH.leather, sleeve: CLOTH.bandit };
    case 'mongol':
      return { main: look.color ?? CLOTH.mongolCoat, dark: CLOTH.fur, sleeve: look.color ?? CLOTH.mongolCoat };
    case 'hoplite':
      return { main: look.color ?? CLOTH.hopliteTunic, dark: CLOTH.bronze, sleeve: look.color ?? CLOTH.hopliteTunic };
    case 'wizard':
      return { main: CLOTH.wizardRobe, dark: CLOTH.wizardTrim, sleeve: CLOTH.wizardRobe };
  }
}

function addLeg(parts: PartFactory, body: TransformNode, side: number, skin: string, look: ActorLook): Limb {
  const upper = childNode('thigh', body, side * 0.17, HIP, 0);
  const robed = isRobed(look.outfit);
  const bare = look.outfit === 'rags';
  const trousers = look.outfit === 'viking' || look.outfit === 'warlord' || look.outfit === 'bandit' || look.outfit === 'villager' || look.outfit === 'mongol';
  const norse = look.outfit === 'viking' || look.outfit === 'warlord';
  const legColor = robed ? clothOf(look).main : trousers ? (norse ? CLOTH.leather : CLOTH.ragsDark) : skin;
  parts.part('box', legColor, upper, [0.26, 0.34, 0.28], [0, -0.16, 0], GLOSS);
  const lower = childNode('shin', upper, 0, -0.32, 0);
  parts.part('box', legColor, lower, [0.25, 0.24, 0.27], [0, -0.13, 0], GLOSS);
  parts.part('box', bare ? skin : CLOTH.boots, lower, [0.28, 0.1, 0.36], [0, -0.26, 0.04], GLOSS);
  return { upper, lower };
}

function addArm(parts: PartFactory, torso: TransformNode, side: number, skin: string, look: ActorLook): Limb {
  const cloth = clothOf(look);
  const upper = childNode('arm', torso, side * 0.5, SHOULDER, 0.02);
  const longSleeve = isRobed(look.outfit) || look.outfit === 'viking' || look.outfit === 'warlord' || look.outfit === 'bandit' || look.outfit === 'mongol';
  parts.part('box', cloth.sleeve, upper, [0.22, 0.32, 0.24], [0, -0.14, 0], GLOSS);
  const lower = childNode('forearm', upper, 0, -0.3, 0);
  parts.part('box', longSleeve ? cloth.sleeve : skin, lower, [0.2, 0.24, 0.21], [0, -0.11, 0], GLOSS);
  if (look.outfit === 'smith' || look.outfit === 'warlord') parts.part('box', CLOTH.leather, lower, [0.23, 0.14, 0.24], [0, -0.16, 0], GLOSS);
  if (look.outfit === 'legion' || look.outfit === 'commander' || look.outfit === 'silver') parts.part('box', look.outfit === 'silver' ? CLOTH.silver : CLOTH.steel, lower, [0.22, 0.12, 0.23], [0, -0.14, 0], METAL);
  parts.part('box', skin, lower, [0.2, 0.16, 0.21], [0, -0.3, 0.01], GLOSS);
  return { upper, lower };
}

/** The body box and whatever the outfit adds to it. Torso origin is at the hips. */
function addTorso(parts: PartFactory, torso: TransformNode, look: ActorLook): void {
  const cloth = clothOf(look);
  parts.part('box', cloth.main, torso, [0.78, 0.72, 0.5], [0, 0.4, 0], GLOSS);
  switch (look.outfit) {
    case 'monk':
    case 'abbot':
      parts.part('box', cloth.main, torso, [0.8, 0.5, 0.54], [0, -0.12, 0], GLOSS);
      parts.part('box', CLOTH.rope, torso, [0.82, 0.07, 0.56], [0, 0.1, 0], GLOSS);
      parts.part('box', CLOTH.rope, torso, [0.06, 0.32, 0.06], [0.2, -0.08, 0.28], SMALL);
      // The hood hangs down the back.
      parts.part('box', cloth.dark, torso, [0.56, 0.3, 0.12], [0, 0.66, -0.3], GLOSS);
      if (look.outfit === 'abbot') {
        parts.part('box', CLOTH.robe, torso, [0.2, 0.74, 0.03], [0, 0.4, 0.26], SMALL);
        parts.part('box', CLOTH.gold, torso, [0.05, 0.16, 0.03], [0, 0.48, 0.28], SMALL);
        parts.part('box', CLOTH.gold, torso, [0.12, 0.04, 0.03], [0, 0.51, 0.28], SMALL);
      }
      return;
    case 'rags':
      parts.part('box', cloth.dark, torso, [0.3, 0.22, 0.03], [-0.15, 0.25, 0.26], SMALL);
      parts.part('box', cloth.dark, torso, [0.8, 0.18, 0.52], [0, -0.02, 0], GLOSS);
      parts.part('box', CLOTH.rope, torso, [0.8, 0.05, 0.52], [0, 0.12, 0], SMALL);
      return;
    case 'smith':
      parts.part('box', cloth.dark, torso, [0.6, 0.86, 0.04], [0, 0.22, 0.27], GLOSS);
      parts.part('box', cloth.dark, torso, [0.82, 0.08, 0.54], [0, 0.18, 0], GLOSS);
      return;
    case 'legion':
    case 'silver':
    case 'commander': {
      const metal = look.outfit === 'commander' ? CLOTH.gold : look.outfit === 'silver' ? CLOTH.silver : CLOTH.steel;
      parts.part('box', metal, torso, [0.84, 0.5, 0.56], [0, 0.46, 0], METAL);
      for (const side of [-1, 1]) parts.part('box', metal, torso, [0.3, 0.14, 0.58], [side * 0.42, 0.74, 0], METAL);
      parts.part('box', CLOTH.leather, torso, [0.86, 0.1, 0.58], [0, 0.2, 0], GLOSS);
      parts.part('box', cloth.main, torso, [0.8, 0.22, 0.52], [0, 0.04, 0], GLOSS);
      return;
    }
    case 'emperor':
      parts.part('box', cloth.main, torso, [0.8, 0.5, 0.54], [0, -0.12, 0], GLOSS);
      parts.part('box', CLOTH.linen, torso, [0.26, 0.76, 0.03], [-0.15, 0.36, 0.26], SMALL).rotation.z = 0.5;
      parts.part('box', CLOTH.gold, torso, [0.82, 0.06, 0.56], [0, -0.34, 0], METAL);
      return;
    case 'healer':
      // A long dress: fitted at the waist with a sash, the skirt flaring down to the ankles.
      parts.part('box', cloth.main, torso, [0.86, 0.36, 0.6], [0, -0.1, 0], GLOSS);
      parts.part('box', cloth.main, torso, [0.98, 0.42, 0.7], [0, -0.46, 0], GLOSS);
      parts.part('box', DRESS.sash, torso, [0.8, 0.09, 0.54], [0, 0.12, 0], GLOSS);
      parts.part('box', DRESS.sash, torso, [0.12, 0.3, 0.04], [0.22, -0.04, 0.28], SMALL);
      parts.part('box', cloth.dark, torso, [0.42, 0.18, 0.03], [0, 0.66, 0.26], SMALL);
      return;
    case 'villager':
      parts.part('box', cloth.main, torso, [0.8, 0.2, 0.52], [0, 0.02, 0], GLOSS);
      parts.part('box', cloth.dark, torso, [0.82, 0.07, 0.54], [0, 0.14, 0], GLOSS);
      return;
    case 'viking':
    case 'warlord': {
      const fur = look.outfit === 'warlord' ? CLOTH.peltLight : CLOTH.pelt;
      parts.part('box', fur, torso, [0.98, 0.24, 0.62], [0, 0.72, 0], GLOSS);
      parts.part('box', fur, torso, [0.5, 0.36, 0.06], [0, 0.56, -0.28], GLOSS);
      parts.part('box', CLOTH.leather, torso, [0.82, 0.1, 0.54], [0, 0.12, 0], GLOSS);
      parts.part('box', CLOTH.gold, torso, [0.14, 0.09, 0.04], [0, 0.12, 0.28], SMALL);
      if (look.outfit === 'warlord') parts.part('box', CLOTH.steel, torso, [0.8, 0.34, 0.54], [0, 0.4, 0], METAL);
      return;
    }
    case 'bandit':
      parts.part('box', CLOTH.leather, torso, [0.82, 0.08, 0.54], [0, 0.14, 0], GLOSS);
      parts.part('box', CLOTH.ragsDark, torso, [0.3, 0.8, 0.03], [0.1, 0.38, 0.26], SMALL).rotation.z = -0.6;
      return;
    case 'mongol':
      // A long coat to the knees, leather plates laced in rows over the chest, a sash, fur at the neck.
      parts.part('box', cloth.main, torso, [0.84, 0.42, 0.56], [0, -0.14, 0], GLOSS);
      parts.part('box', CLOTH.lamellar, torso, [0.82, 0.5, 0.56], [0, 0.44, 0], GLOSS);
      for (let row = 0; row < 3; row++) parts.part('box', CLOTH.lamellarEdge, torso, [0.84, 0.04, 0.58], [0, 0.28 + row * 0.15, 0], SMALL);
      parts.part('box', CLOTH.mongolSash, torso, [0.86, 0.12, 0.58], [0, 0.12, 0], GLOSS);
      parts.part('box', CLOTH.fur, torso, [0.62, 0.1, 0.54], [0, 0.76, 0], GLOSS);
      return;
    case 'hoplite':
      parts.part('box', CLOTH.bronze, torso, [0.84, 0.52, 0.56], [0, 0.46, 0], METAL);
      parts.part('box', cloth.main, torso, [0.8, 0.3, 0.52], [0, 0.02, 0], GLOSS);
      // A skirt of leather strips under the cuirass.
      for (let i = 0; i < 5; i++) parts.part('box', CLOTH.leather, torso, [0.14, 0.3, 0.04], [-0.3 + i * 0.15, -0.06, 0.27], SMALL);
      return;
    case 'wizard':
      parts.part('box', cloth.main, torso, [0.86, 0.6, 0.6], [0, -0.2, 0], GLOSS);
      parts.part('box', cloth.dark, torso, [0.1, 1.0, 0.03], [0, 0.2, 0.27], SMALL);
      parts.part('box', cloth.dark, torso, [0.9, 0.08, 0.6], [0, 0.12, 0], GLOSS);
      // The hood, down on the shoulders.
      parts.part('box', cloth.main, torso, [0.7, 0.34, 0.24], [0, 0.8, -0.24], GLOSS);
      return;
  }
}

function addFace(parts: PartFactory, head: TransformNode, skin: string, look: ActorLook): Face {
  parts.part('box', skin, head, [HEAD, HEAD, HEAD], [0, 0, 0], GLOSS);
  const pupils: InstancedMesh[] = [];
  const lids: TransformNode[] = [];
  const brows: InstancedMesh[] = [];
  const tears: InstancedMesh[] = [];
  const streaks = childNode('streaks', head);
  const blush = childNode('blush', head);
  const browColor = look.hair && look.hair !== HAIR.white && look.hair !== HAIR.grey ? look.hair : FACE.brow;
  for (const side of [-1, 1]) {
    const x = side * EYE_X;
    parts.part('box', FACE.eyeWhite, head, [0.13, 0.13, 0.02], [x, EYE_Y, FZ], SMALL);
    pupils.push(parts.part('box', FACE.pupil, head, [0.065, 0.075, 0.02], [x, EYE_Y - 0.005, FZ + 0.012], SMALL));
    const lid = childNode('lid', head, x, EYE_Y + 0.068, FZ + 0.024);
    parts.part('box', skin, lid, [0.15, 0.14, 0.02], [0, -0.07, 0], SMALL);
    lid.scaling.y = 0.1;
    lids.push(lid);
    brows.push(parts.part('box', browColor, head, [0.15, 0.035, 0.03], [x, 0.125, FZ + 0.03], SMALL));
    tears.push(parts.part('box', FACE.tear, head, [0.04, 0.06, 0.02], [x + side * 0.02, TEAR_TOP, FZ + 0.03], SMALL));
    parts.part('box', FACE.tear, streaks, [0.025, 0.22, 0.01], [x + side * 0.02, TEAR_TOP - 0.1, FZ + 0.006], SMALL);
    parts.part('box', FACE.blush, blush, [0.1, 0.055, 0.02], [side * 0.17, -0.08, FZ + 0.004], SMALL);
  }
  streaks.setEnabled(false);
  blush.setEnabled(false);
  for (const tear of tears) tear.setEnabled(false);
  parts.part('box', skin, head, [0.08, 0.12, 0.07], [0, -0.05, FZ + 0.03], SMALL);
  if (look.scar) parts.part('box', FACE.scar, head, [0.03, 0.2, 0.02], [0.17, -0.02, FZ + 0.005], SMALL).rotation.z = 0.4;
  const corners: InstancedMesh[] = [];
  parts.part('box', FACE.mouth, head, [0.08, 0.03, 0.02], [0, MOUTH_Y, FZ + 0.03], SMALL);
  for (const side of [-1, 1]) corners.push(parts.part('box', FACE.mouth, head, [0.05, 0.03, 0.02], [side * 0.06, MOUTH_Y, FZ + 0.03], SMALL));
  if (isFeminine(look)) {
    for (const side of [-1, 1]) {
      parts.part('box', FACE.lashes, head, [0.05, 0.03, 0.02], [side * (EYE_X + 0.075), EYE_Y + 0.07, FZ + 0.02], SMALL).rotation.z = side * -0.5;
      parts.part('box', FACE.earring, head, [0.05, 0.08, 0.05], [side * (HEAD / 2 + 0.02), -0.1, 0.02], { metal: true, castShadow: false });
    }
    parts.part('box', FACE.lips, head, [0.12, 0.035, 0.02], [0, MOUTH_Y, FZ + 0.032], SMALL);
  }
  const mouthOpen = parts.part('box', FACE.mouthInside, head, [0.14, 1, 0.02], [0, MOUTH_Y, FZ + 0.035], SMALL);
  mouthOpen.setEnabled(false);
  addBeard(parts, head, look);
  return { pupils, lids, brows, corners, mouthOpen, tears, streaks, blush };
}

function addBeard(parts: PartFactory, head: TransformNode, look: ActorLook): void {
  const beard = look.beard ?? 'none';
  if (beard === 'none') return;
  const color = look.beardColor ?? look.hair ?? HAIR.brown;
  if (beard === 'stubble') {
    parts.part('box', color, head, [0.46, 0.16, 0.02], [0, -0.18, FZ + 0.012], { gloss: false, castShadow: false });
    return;
  }
  const length = beard === 'long' ? 0.42 : 0.22;
  parts.part('box', color, head, [0.5, length, 0.1], [0, -0.14 - length / 2 + 0.06, FZ - 0.02], GLOSS);
  for (const side of [-1, 1]) parts.part('box', color, head, [0.06, 0.24, HEAD * 0.7], [side * (HEAD / 2 + 0.02), -0.12, 0.02], GLOSS);
}

function addHair(parts: PartFactory, head: TransformNode, look: ActorLook): void {
  const style = look.hairStyle ?? 'short';
  const color = look.hair ?? HAIR.brown;
  const half = HEAD / 2;
  switch (style) {
    case 'bald':
      return;
    case 'tonsure':
      parts.part('box', color, head, [HEAD + 0.04, 0.16, 0.12], [0, 0.06, -half - 0.01], GLOSS);
      for (const side of [-1, 1]) parts.part('box', color, head, [0.06, 0.16, HEAD * 0.8], [side * (half + 0.01), 0.06, -0.04], GLOSS);
      return;
    case 'short':
      parts.part('box', color, head, [HEAD + 0.04, 0.12, HEAD + 0.04], [0, half + 0.02, -0.01], GLOSS);
      parts.part('box', color, head, [HEAD + 0.04, 0.3, 0.08], [0, 0.1, -half - 0.02], GLOSS);
      return;
    case 'long':
    case 'braids':
      parts.part('box', color, head, [HEAD + 0.06, 0.14, HEAD + 0.06], [0, half + 0.02, -0.01], GLOSS);
      parts.part('box', color, head, [HEAD + 0.06, 0.62, 0.1], [0, -0.05, -half - 0.03], GLOSS);
      for (const side of [-1, 1]) parts.part('box', color, head, [0.08, 0.5, 0.3], [side * (half + 0.03), -0.02, -0.12], GLOSS);
      if (style === 'braids') for (const side of [-1, 1]) parts.part('box', color, head, [0.08, 0.42, 0.08], [side * (half + 0.03), -0.42, 0.06], GLOSS);
      if (isFeminine(look)) {
        // Hair down past the shoulders, a bun on top, a flower over one ear.
        parts.part('box', color, head, [HEAD + 0.02, 0.4, 0.12], [0, -0.52, -half - 0.02], GLOSS);
        parts.part('box', color, head, [0.26, 0.2, 0.24], [0, half + 0.12, -0.12], GLOSS);
        parts.part('box', DRESS.flower, head, [0.12, 0.12, 0.08], [half + 0.04, 0.12, 0.06], SMALL);
      }
      return;
  }
}

function addHeadgear(parts: PartFactory, head: TransformNode, look: ActorLook): void {
  const half = HEAD / 2;
  if (look.outfit === 'emperor') {
    for (const side of [-1, 1]) parts.part('box', CLOTH.gold, head, [0.08, 0.08, HEAD * 0.9], [side * (half + 0.02), half - 0.08, -0.02], METAL);
    parts.part('box', CLOTH.gold, head, [HEAD + 0.06, 0.08, 0.08], [0, half - 0.08, -half - 0.02], METAL);
  }
  if (look.outfit === 'bandit') parts.part('box', CLOTH.ragsDark, head, [HEAD + 0.04, 0.18, HEAD + 0.04], [0, -0.16, 0.0], GLOSS);
  if (look.outfit === 'wizard') {
    // A tall pointed hood up over the head.
    parts.part('box', CLOTH.wizardRobe, head, [HEAD + 0.1, 0.24, HEAD + 0.1], [0, half + 0.02, -0.02], GLOSS);
    parts.part('cone', CLOTH.wizardRobe, head, [0.32, 0.5, 0.32], [0, half + 0.36, -0.06], GLOSS);
    for (const side of [-1, 1]) parts.part('box', CLOTH.wizardRobe, head, [0.06, HEAD, HEAD * 0.9], [side * (half + 0.04), 0, -0.04], GLOSS);
  }
  if (!look.helmet) return;
  if (look.outfit === 'mongol') {
    // A round steel cap with a short spike, a thin fur band, leather flaps over the ears and neck.
    parts.part('box', CLOTH.steel, head, [HEAD + 0.08, 0.2, HEAD + 0.08], [0, half - 0.02, -0.01], METAL);
    parts.part('dome', CLOTH.steel, head, [HEAD + 0.06, 0.2, HEAD + 0.06], [0, half + 0.08, -0.01], METAL);
    parts.part('box', CLOTH.steel, head, [0.05, 0.12, 0.05], [0, half + 0.24, -0.01], METAL);
    parts.part('box', CLOTH.fur, head, [HEAD + 0.1, 0.06, HEAD + 0.1], [0, half - 0.12, -0.01], GLOSS);
    for (const side of [-1, 1]) parts.part('box', CLOTH.leather, head, [0.05, 0.3, 0.26], [side * (half + 0.03), -0.06, -0.06], GLOSS);
    parts.part('box', CLOTH.leather, head, [HEAD + 0.06, 0.3, 0.05], [0, -0.06, -half - 0.03], GLOSS);
    return;
  }
  if (look.outfit === 'hoplite') {
    // The Greek helmet: bronze all round with cheek guards, and a crest across from ear to ear.
    parts.part('box', CLOTH.bronze, head, [HEAD + 0.08, 0.24, HEAD + 0.08], [0, half - 0.04, -0.01], METAL);
    parts.part('box', CLOTH.bronze, head, [HEAD + 0.08, 0.4, 0.1], [0, 0.0, -half - 0.04], METAL);
    for (const side of [-1, 1]) parts.part('box', CLOTH.bronze, head, [0.06, 0.3, 0.2], [side * (half + 0.04), -0.08, half - 0.1], METAL);
    parts.part('box', look.cape ?? CLOTH.legion, head, [0.62, 0.26, 0.12], [0, half + 0.2, 0], GLOSS);
    return;
  }
  const roman = look.outfit === 'legion' || look.outfit === 'commander';
  const metal = look.outfit === 'commander' ? CLOTH.gold : look.outfit === 'silver' ? CLOTH.silver : CLOTH.steel;
  parts.part('box', metal, head, [HEAD + 0.08, 0.2, HEAD + 0.08], [0, half - 0.02, -0.01], METAL);
  if (roman) {
    parts.part('box', metal, head, [HEAD + 0.08, 0.3, 0.08], [0, 0.05, -half - 0.04], METAL);
    const crest = look.cape ?? CLOTH.legion;
    if (look.outfit === 'commander') parts.part('box', crest, head, [0.7, 0.26, 0.12], [0, half + 0.2, 0], GLOSS);
    else parts.part('box', crest, head, [0.12, 0.2, 0.52], [0, half + 0.16, -0.02], GLOSS);
  } else {
    parts.part('box', metal, head, [0.06, 0.22, 0.06], [0, -0.02, half + 0.04], METAL);
  }
}

function addCape(parts: PartFactory, torso: TransformNode, color: string): void {
  const cape = childNode('cape', torso, 0, 0.78, -0.29);
  parts.part('box', color, cape, [0.8, 1.15, 0.05], [0, -0.57, -0.02], GLOSS);
}
