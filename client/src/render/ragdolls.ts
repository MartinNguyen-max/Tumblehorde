import {
  PhysicsBody,
  PhysicsMotionType,
  PhysicsShapeBox,
  Quaternion,
  type Scene,
  TransformNode,
  Vector3,
} from './babylon.ts';
import type { Vec3 } from '@tumblehorde/shared';
import { EFFECTS } from '../visualConfig.ts';
import { markDead, type Rig } from './rigs.ts';

interface Corpse {
  unitId: number;
  root: TransformNode;
  bodies: PhysicsBody[];
  extras: TransformNode[];
  bornAt: number;
  settled: boolean;
  isHorse: boolean;
}

const PERSON_BOX = { center: new Vector3(0, 1.0, 0), extents: new Vector3(0.86, 2.0, 0.6), mass: 1 };
const HORSE_BOX = { center: new Vector3(0, 1.35, 0), extents: new Vector3(1.0, 1.3, 2.1), mass: 4 };
const HELMET_EXTENTS = new Vector3(0.64, 0.32, 0.64);
/** Every corpse tips over around a sideways axis at least this fast, so none ends up standing. */
const TOPPLE_SPIN = 6;
const UPRIGHT_THRESHOLD = 0.6;
const LYING_HEIGHT = 0.4;
const SINK_DEPTH = 1.6;

function randomSpin(speed: number): Vector3 {
  return new Vector3((Math.random() - 0.5) * speed, (Math.random() - 0.5) * speed, (Math.random() - 0.5) * speed);
}

/** Spin around the horizontal axis perpendicular to the push, so the body falls the way it was hit. */
function toppleSpin(knockback: Vec3): Vector3 {
  const len = Math.hypot(knockback.x, knockback.z);
  const dir = len > 0.1 ? { x: knockback.x / len, z: knockback.z / len } : { x: Math.random() - 0.5, z: Math.random() - 0.5 };
  const axis = new Vector3(dir.z, 0, -dir.x).normalize();
  return axis.scale(TOPPLE_SPIN + Math.random() * 3).add(randomSpin(3));
}

/**
 * Havok only drives what is purely visual: the dead. The simulation decides the hit and
 * the knockback vector; here bodies are launched with it and allowed to tumble.
 */
export class Ragdolls {
  private readonly corpses: Corpse[] = [];
  private readonly scene: Scene;
  /** Ground height lookup for the current map, used to lay bodies down neatly. */
  groundAt: (x: number, z: number) => number = () => 0;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  add(unitId: number, rig: Rig, knockback: Vec3, now: number): void {
    markDead(rig);
    const isHorse = rig.type === 'horse';
    const box = isHorse ? HORSE_BOX : PERSON_BOX;
    const scale = rig.scale;
    const body = this.dynamicBody(rig.root, box.center.scale(scale), box.extents.scale(scale), box.mass);
    const launch = isHorse ? 0.5 : EFFECTS.deathLaunchScale;
    body.setLinearVelocity(
      new Vector3(knockback.x * launch, Math.max(knockback.y * launch, isHorse ? 1 : EFFECTS.deathLiftMin), knockback.z * launch),
    );
    body.setAngularVelocity(isHorse ? toppleSpin(knockback).scale(0.4) : toppleSpin(knockback));

    const corpse: Corpse = { unitId, root: rig.root, bodies: [body], extras: [], bornAt: now, settled: false, isHorse };
    if (rig.type === 'person') {
      const helmet = this.popOff(rig.helmet, HELMET_EXTENTS.scale(scale), knockback);
      corpse.bodies.push(helmet.body);
      corpse.extras.push(helmet.holder);
    }
    this.corpses.push(corpse);
    this.trim();
  }

  /** Sends the helmet flying on its own, because it is funny. */
  private popOff(piece: TransformNode, extents: Vector3, knockback: Vec3): { holder: TransformNode; body: PhysicsBody } {
    const holder = new TransformNode('loose-part', this.scene);
    holder.position.copyFrom(piece.getAbsolutePosition());
    holder.rotationQuaternion = Quaternion.Identity();
    piece.setParent(holder);
    const body = this.dynamicBody(holder, Vector3.Zero(), extents, 0.2);
    body.setLinearVelocity(new Vector3(knockback.x * 1.6 + (Math.random() - 0.5) * 2, 5 + Math.random() * 3, knockback.z * 1.6 + (Math.random() - 0.5) * 2));
    body.setAngularVelocity(randomSpin(14));
    return { holder, body };
  }

  private dynamicBody(node: TransformNode, center: Vector3, extents: Vector3, mass: number): PhysicsBody {
    if (!node.rotationQuaternion) node.rotationQuaternion = Quaternion.FromEulerVector(node.rotation);
    const body = new PhysicsBody(node, PhysicsMotionType.DYNAMIC, false, this.scene);
    body.shape = new PhysicsShapeBox(center, Quaternion.Identity(), extents, this.scene);
    body.setMassProperties({ mass });
    return body;
  }

  /** Where a unit's body lies, e.g. for the camera while the commander patches up. */
  corpsePosition(unitId: number): Vec3 | null {
    for (let i = this.corpses.length - 1; i >= 0; i--) {
      const corpse = this.corpses[i];
      if (corpse?.unitId !== unitId) continue;
      const p = corpse.root.getAbsolutePosition();
      return { x: p.x, y: p.y, z: p.z };
    }
    return null;
  }

  /** The commander got back up: their body is no longer lying around. */
  remove(unitId: number): void {
    for (let i = this.corpses.length - 1; i >= 0; i--) {
      const corpse = this.corpses[i];
      if (corpse?.unitId !== unitId) continue;
      this.disposeCorpse(corpse);
      this.corpses.splice(i, 1);
      return;
    }
  }

  update(now: number): void {
    for (let i = this.corpses.length - 1; i >= 0; i--) {
      const corpse = this.corpses[i];
      if (!corpse) continue;
      const age = now - corpse.bornAt;
      if (!corpse.settled && age >= EFFECTS.corpseSettleSeconds) this.settle(corpse);
      if (age >= EFFECTS.corpseSinkAfter) {
        const t = (age - EFFECTS.corpseSinkAfter) / EFFECTS.corpseSinkSeconds;
        if (t >= 1) {
          this.disposeCorpse(corpse);
          this.corpses.splice(i, 1);
          continue;
        }
        const ground = this.groundAt(corpse.root.position.x, corpse.root.position.z);
        corpse.root.position.y = ground + LYING_HEIGHT - t * SINK_DEPTH;
      }
    }
  }

  /** Freezes the body; one that still stands upright is laid down flat. */
  private settle(corpse: Corpse): void {
    this.disposeBodies(corpse);
    corpse.settled = true;
    const up = corpse.root.getDirection(Vector3.Up());
    if (up.y <= UPRIGHT_THRESHOLD) return;
    const facing = corpse.root.getDirection(Vector3.Forward());
    const yaw = Math.atan2(facing.x, facing.z);
    // People flop onto their back, horses onto their side.
    corpse.root.rotationQuaternion = corpse.isHorse
      ? Quaternion.RotationYawPitchRoll(yaw, 0, Math.PI / 2)
      : Quaternion.RotationYawPitchRoll(yaw, -Math.PI / 2, 0);
    corpse.root.position.y = this.groundAt(corpse.root.position.x, corpse.root.position.z) + LYING_HEIGHT;
  }

  private disposeBodies(corpse: Corpse): void {
    if (corpse.settled) return;
    for (const body of corpse.bodies) {
      body.shape?.dispose();
      body.dispose();
    }
  }

  private disposeCorpse(corpse: Corpse): void {
    this.disposeBodies(corpse);
    corpse.root.dispose();
    for (const extra of corpse.extras) extra.dispose();
  }

  private trim(): void {
    while (this.corpses.length > EFFECTS.maxCorpses) {
      const oldest = this.corpses.shift();
      if (oldest) this.disposeCorpse(oldest);
    }
  }

  clear(): void {
    for (const corpse of this.corpses) this.disposeCorpse(corpse);
    this.corpses.length = 0;
  }
}
