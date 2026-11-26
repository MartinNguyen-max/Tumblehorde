import { type InstancedMesh, TransformNode, type Scene } from './babylon.ts';
import type { ArrowView, Vec3 } from '@tumblehorde/shared';
import { COLORS, EFFECTS } from '../visualConfig.ts';
import type { PartFactory } from './parts.ts';

const PARTICLE_GRAVITY = 14;
const PARTICLE_LIFE = 0.6;
const ARROW_EMBED_DEPTH = 0.25;
const ARROW_TIP_OFFSET = 0.57;

interface Particle {
  mesh: InstancedMesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  size: number;
}

interface StuckArrow {
  node: TransformNode;
  bornAt: number;
}

export type BurstKind = 'hit' | 'block' | 'death' | 'dust';

const BURST_COLORS: Record<BurstKind, string> = {
  hit: '#E0533F',
  block: '#FFE27A',
  death: '#F4F1E8',
  dust: '#D9C9A3',
};

function arrowYaw(dx: number, dz: number): number {
  return Math.atan2(dx, dz);
}

function arrowPitch(dx: number, dy: number, dz: number): number {
  return -Math.atan2(dy, Math.hypot(dx, dz));
}

/** Flying arrows, arrows stuck in the ground, and little bursts of cubes on hits. */
export class Effects {
  private readonly scene: Scene;
  private readonly parts: PartFactory;
  private readonly flying = new Map<number, TransformNode>();
  private readonly stuck: StuckArrow[] = [];
  private readonly particles: Particle[] = [];
  private readonly free: Map<BurstKind, InstancedMesh[]> = new Map();

  constructor(scene: Scene, parts: PartFactory) {
    this.scene = scene;
    this.parts = parts;
  }

  private makeArrow(): TransformNode {
    const node = new TransformNode('arrow', this.scene);
    this.parts.part('box', COLORS.darkWood, node, [0.04, 0.04, 0.9], [0, 0, 0]);
    this.parts.part('box', COLORS.steel, node, [0.07, 0.07, 0.14], [0, 0, 0.5]);
    this.parts.part('box', COLORS.edgePost, node, [0.14, 0.02, 0.16], [0, 0, -0.38]);
    return node;
  }

  syncArrows(arrows: readonly ArrowView[]): void {
    const seen = new Set<number>();
    for (const arrow of arrows) {
      seen.add(arrow.id);
      let node = this.flying.get(arrow.id);
      if (!node) {
        node = this.makeArrow();
        this.flying.set(arrow.id, node);
      }
      node.position.set(arrow.x, arrow.y, arrow.z);
      node.rotation.set(arrowPitch(arrow.vx, arrow.vy, arrow.vz), arrowYaw(arrow.vx, arrow.vz), 0);
    }
    for (const [id, node] of this.flying) {
      if (seen.has(id)) continue;
      node.dispose();
      this.flying.delete(id);
    }
  }

  stickArrow(pos: Vec3, dir: Vec3, now: number): void {
    const node = this.makeArrow();
    // The tip sits ARROW_TIP_OFFSET ahead of the node; bury it a little below the surface.
    const back = ARROW_EMBED_DEPTH - ARROW_TIP_OFFSET;
    node.position.set(pos.x + dir.x * back, pos.y + dir.y * back, pos.z + dir.z * back);
    node.rotation.set(arrowPitch(dir.x, dir.y, dir.z), arrowYaw(dir.x, dir.z), 0);
    this.stuck.push({ node, bornAt: now });
    if (this.stuck.length > EFFECTS.maxStuckArrows) this.stuck.shift()?.node.dispose();
  }

  burst(kind: BurstKind, x: number, y: number, z: number, count: number, push: Vec3 = { x: 0, y: 0, z: 0 }): void {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= EFFECTS.particleCount) return;
      const pool = this.free.get(kind) ?? [];
      const mesh = pool.pop() ?? this.parts.part('box', BURST_COLORS[kind], null, [1, 1, 1], [0, 0, 0], { castShadow: false });
      mesh.setEnabled(true);
      const size = 0.08 + Math.random() * 0.1;
      mesh.position.set(x, y, z);
      mesh.rotation.set(Math.random() * 3, Math.random() * 3, 0);
      this.particles.push({
        mesh,
        size,
        life: PARTICLE_LIFE * (0.6 + Math.random() * 0.6),
        vx: push.x * 0.4 + (Math.random() - 0.5) * 5,
        vy: 2 + Math.random() * 4,
        vz: push.z * 0.4 + (Math.random() - 0.5) * 5,
      });
      mesh.metadata = kind;
    }
  }

  update(dt: number, now: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      if (!p) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.mesh.setEnabled(false);
        const kind = p.mesh.metadata as BurstKind;
        const pool = this.free.get(kind) ?? [];
        pool.push(p.mesh);
        this.free.set(kind, pool);
        this.particles.splice(i, 1);
        continue;
      }
      p.vy -= PARTICLE_GRAVITY * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.mesh.rotation.x += dt * 8;
      p.mesh.scaling.setAll(p.size * Math.min(1, p.life * 3));
    }
    while (this.stuck.length > 0 && now - (this.stuck[0]?.bornAt ?? now) > EFFECTS.stuckArrowLifetime) {
      this.stuck.shift()?.node.dispose();
    }
  }

  clear(): void {
    for (const node of this.flying.values()) node.dispose();
    this.flying.clear();
    for (const s of this.stuck) s.node.dispose();
    this.stuck.length = 0;
    for (const p of this.particles) p.life = 0;
    this.update(0, Number.POSITIVE_INFINITY);
  }
}
