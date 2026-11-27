import { type Scene, TransformNode } from '../render/babylon.ts';
import { childNode, type PartFactory } from '../render/parts.ts';

/**
 * A stocky box horse for cutscenes: it walks, gallops (legs and head bob) and can collapse onto
 * its side. A rider is placed on `saddle`. Faces +z, hooves at y = 0.
 */

const HORSE = {
  hide: '#6B4A32',
  mane: '#2E2117',
  hoof: '#2A2018',
  saddle: '#6E4528',
  cloth: '#8A3A2E',
  eye: '#111111',
  bodyY: 1.0,
  legLength: 0.75,
  gallopRate: 13,
  walkRate: 6,
  lieRate: 1.6,
  saddleHeight: 1.45,
} as const;

export class Horse {
  readonly root: TransformNode;
  readonly saddle: TransformNode;
  private readonly body: TransformNode;
  private readonly head: TransformNode;
  private readonly legs: TransformNode[] = [];
  private phase = 0;
  /** 0 standing, 1 walking, 2 galloping. */
  gait = 0;
  /** 0..1: collapsing onto its side. */
  private fallen = 0;
  falling = false;
  private target: { x: number; z: number; speed: number } | null = null;

  constructor(scene: Scene, parts: PartFactory, parent: TransformNode, hide: string = HORSE.hide) {
    this.root = new TransformNode('horse', scene);
    this.root.parent = parent;
    this.body = childNode('horse-body', this.root, 0, 0, 0);
    parts.part('box', hide, this.body, [0.75, 0.7, 1.7], [0, HORSE.bodyY + 0.1, 0]);
    parts.part('box', HORSE.cloth, this.body, [0.8, 0.45, 0.9], [0, HORSE.bodyY + 0.2, -0.1]);
    parts.part('box', HORSE.saddle, this.body, [0.6, 0.12, 0.6], [0, HORSE.bodyY + 0.5, -0.1]);
    parts.part('box', HORSE.mane, this.body, [0.15, 0.6, 0.25], [0, HORSE.bodyY + 0.45, -0.95]).rotation.x = 0.6;
    const neck = childNode('neck', this.body, 0, HORSE.bodyY + 0.3, 0.75);
    parts.part('box', hide, neck, [0.45, 0.9, 0.5], [0, 0.35, 0.1]).rotation.x = 0.45;
    parts.part('box', HORSE.mane, neck, [0.14, 0.8, 0.22], [0, 0.45, -0.1]).rotation.x = 0.45;
    this.head = childNode('head', neck, 0, 0.75, 0.35);
    parts.part('box', hide, this.head, [0.4, 0.38, 0.75], [0, 0, 0.25]);
    for (const side of [-1, 1]) {
      parts.part('box', HORSE.eye, this.head, [0.04, 0.08, 0.08], [side * 0.21, 0.07, 0.25], { castShadow: false });
      parts.part('box', hide, this.head, [0.08, 0.18, 0.08], [side * 0.12, 0.26, 0.02]);
    }
    for (const [x, z] of [[-0.25, 0.65], [0.25, 0.65], [-0.25, -0.65], [0.25, -0.65]] as const) {
      const leg = childNode('leg', this.body, x, HORSE.bodyY - 0.15, z);
      parts.part('box', hide, leg, [0.2, HORSE.legLength, 0.22], [0, -HORSE.legLength / 2, 0]);
      parts.part('box', HORSE.hoof, leg, [0.22, 0.12, 0.26], [0, -HORSE.legLength + 0.02, 0.02]);
      this.legs.push(leg);
    }
    this.saddle = childNode('saddle', this.body, 0, HORSE.saddleHeight - 0.62, -0.1);
  }

  place(x: number, z: number, yaw: number): this {
    this.root.position.set(x, 0, z);
    this.root.rotation.y = yaw;
    this.target = null;
    this.gait = 0;
    return this;
  }

  /** Walks or gallops to a point, turning towards it. */
  runTo(x: number, z: number, speed: number): this {
    this.target = { x, z, speed };
    this.gait = speed > 3 ? 2 : 1;
    return this;
  }

  finishRun(): void {
    if (!this.target) return;
    this.root.position.x = this.target.x;
    this.root.position.z = this.target.z;
    this.target = null;
    this.gait = 0;
  }

  update(dt: number): void {
    const t = this.target;
    if (t) {
      const p = this.root.position;
      const dx = t.x - p.x;
      const dz = t.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d < t.speed * dt) {
        this.finishRun();
      } else {
        p.x += (dx / d) * t.speed * dt;
        p.z += (dz / d) * t.speed * dt;
        this.root.rotation.y = Math.atan2(dx, dz);
      }
    }
    const rate = this.gait === 2 ? HORSE.gallopRate : this.gait === 1 ? HORSE.walkRate : 0;
    this.phase += dt * rate;
    const swing = this.gait === 0 ? 0 : Math.sin(this.phase) * (this.gait === 2 ? 0.75 : 0.35);
    this.legs.forEach((leg, i) => {
      const front = i < 2;
      const sign = i % 2 === 0 ? 1 : -1;
      leg.rotation.x = swing * sign * (front ? 1 : -1) * (1 - this.fallen);
    });
    this.body.position.y = this.gait === 2 ? Math.abs(Math.sin(this.phase)) * 0.12 : 0;
    this.head.rotation.x = this.gait === 2 ? Math.sin(this.phase) * 0.15 : Math.sin(this.phase * 0.3) * 0.03 + this.fallen * 0.6;
    if (this.falling) this.fallen = Math.min(1, this.fallen + dt * HORSE.lieRate * (1 - this.fallen * 0.7));
    this.body.rotation.z = this.fallen * (Math.PI / 2 - 0.15);
    this.body.position.x = -this.fallen * 0.3;
  }
}
