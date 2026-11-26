import {
  type AbstractMesh,
  PhysicsBody,
  PhysicsMotionType,
  PhysicsShapeBox,
  Quaternion,
  type Scene,
  TransformNode,
  Vector3,
} from '@babylonjs/core';
import type { Vec3 } from '@tumblehorde/shared';
import { EFFECTS } from '../visualConfig.ts';
import type { Rig } from './rigs.ts';

interface Corpse {
  root: TransformNode;
  bodies: PhysicsBody[];
  extras: TransformNode[];
  bornAt: number;
  settled: boolean;
}

const PERSON_BOX = { center: new Vector3(0, 0.95, 0), extents: new Vector3(0.7, 1.8, 0.5), mass: 1 };
const HORSE_BOX = { center: new Vector3(0, 1.35, 0), extents: new Vector3(0.8, 1.2, 1.9), mass: 4 };
const HELMET_EXTENTS = new Vector3(0.52, 0.22, 0.5);

function randomSpin(speed: number): Vector3 {
  return new Vector3((Math.random() - 0.5) * speed, (Math.random() - 0.5) * speed, (Math.random() - 0.5) * speed);
}

/**
 * Havok only drives what is purely visual: the dead. The simulation decides the hit and
 * the knockback vector; here bodies are launched with it and allowed to tumble.
 */
export class Ragdolls {
  private readonly corpses: Corpse[] = [];
  private readonly scene: Scene;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  add(rig: Rig, knockback: Vec3, now: number): void {
    const isHorse = rig.type === 'horse';
    const box = isHorse ? HORSE_BOX : PERSON_BOX;
    const scale = rig.scale;
    const body = this.dynamicBody(rig.root, box.center.scale(scale), box.extents.scale(scale), box.mass);
    const launch = isHorse ? 0.5 : EFFECTS.deathLaunchScale;
    body.setLinearVelocity(
      new Vector3(knockback.x * launch, Math.max(knockback.y * launch, isHorse ? 1 : EFFECTS.deathLiftMin), knockback.z * launch),
    );
    body.setAngularVelocity(randomSpin(isHorse ? 2 : EFFECTS.deathSpinSpeed));

    const corpse: Corpse = { root: rig.root, bodies: [body], extras: [], bornAt: now, settled: false };
    if (rig.type === 'person') {
      const helmet = this.popOff(rig.helmet, HELMET_EXTENTS.scale(scale), knockback);
      corpse.bodies.push(helmet.body);
      corpse.extras.push(helmet.holder);
    }
    this.corpses.push(corpse);
    this.trim();
  }

  /** Sends the helmet flying on its own, because it is funny. */
  private popOff(piece: AbstractMesh, extents: Vector3, knockback: Vec3): { holder: TransformNode; body: PhysicsBody } {
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

  /** Bodies freeze once they have had time to land, so the physics world stays light. */
  update(now: number): void {
    for (const corpse of this.corpses) {
      if (corpse.settled || now - corpse.bornAt < EFFECTS.corpseSettleSeconds) continue;
      for (const body of corpse.bodies) {
        body.shape?.dispose();
        body.dispose();
      }
      corpse.settled = true;
    }
  }

  private trim(): void {
    while (this.corpses.length > EFFECTS.maxCorpses) {
      const oldest = this.corpses.shift();
      if (!oldest) return;
      for (const body of oldest.bodies) {
        if (oldest.settled) continue;
        body.shape?.dispose();
        body.dispose();
      }
      oldest.root.dispose();
      for (const extra of oldest.extras) extra.dispose();
    }
  }

  clear(): void {
    while (this.corpses.length > 0) {
      const corpse = this.corpses.pop();
      if (!corpse) break;
      if (!corpse.settled) for (const body of corpse.bodies) {
        body.shape?.dispose();
        body.dispose();
      }
      corpse.root.dispose();
      for (const extra of corpse.extras) extra.dispose();
    }
  }
}
