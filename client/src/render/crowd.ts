import { type Scene, TransformNode } from './babylon.ts';
import { childNode, type PartFactory } from './parts.ts';

/**
 * A cheering crowd: little box people that bounce, throw their arms up and wave, each at its own
 * rhythm. Used for the arena's stands, in battle and in the arena scenes.
 */

export const CROWD = {
  colors: ['#C8423A', '#3C7BD0', '#E3B52B', '#6AA84F', '#E8E0CC', '#8E5BD0', '#D88A40', '#7A9AB8'],
  skins: ['#E8B894', '#E2AD86', '#C98E66', '#B07A56'],
  /** Bounce height and speed of a cheering spectator. */
  bounce: 0.22,
  bounceSpeed: 7,
  /** Arms go up this far (radians) on the beat. */
  armRaise: 2.6,
} as const;

interface Spectator {
  node: TransformNode;
  armL: TransformNode;
  armR: TransformNode;
  baseY: number;
  phase: number;
  speed: number;
}

export interface Seat {
  x: number;
  y: number;
  z: number;
  /** The way the spectator faces. */
  yaw: number;
}

function pick<T>(list: readonly T[], i: number): T {
  return list[Math.abs(i) % list.length] as T;
}

export class Crowd {
  private readonly people: Spectator[] = [];
  /** 0 = sitting and murmuring, 1 = on their feet roaring. */
  excitement = 0.6;

  /** `colors`: what they wear (a legion in red); the crowd's mix by default. */
  constructor(parts: PartFactory, parent: TransformNode, seats: readonly Seat[], colors: readonly string[] = CROWD.colors) {
    seats.forEach((seat, i) => {
      const node = new TransformNode('spectator', parent.getScene());
      node.parent = parent;
      node.position.set(seat.x, seat.y, seat.z);
      node.rotation.y = seat.yaw;
      const color = pick(colors, i * 7 + 3);
      parts.part('box', color, node, [0.5, 0.62, 0.38], [0, 0.31, 0], { castShadow: false });
      parts.part('box', pick(CROWD.skins, i * 3), node, [0.36, 0.36, 0.36], [0, 0.82, 0], { castShadow: false });
      const arms = [-1, 1].map((side) => {
        const arm = childNode('arm', node, side * 0.3, 0.58, 0);
        parts.part('box', color, arm, [0.14, 0.42, 0.14], [0, -0.18, 0], { castShadow: false });
        return arm;
      });
      this.people.push({
        node,
        armL: arms[0] as TransformNode,
        armR: arms[1] as TransformNode,
        baseY: seat.y,
        phase: (i * 2.3) % (Math.PI * 2),
        speed: 0.75 + ((i * 37) % 10) / 20,
      });
    });
  }

  update(time: number): void {
    const e = this.excitement;
    for (const p of this.people) {
      const beat = Math.sin(time * CROWD.bounceSpeed * p.speed + p.phase);
      p.node.position.y = p.baseY + Math.max(0, beat) * CROWD.bounce * e;
      const raise = CROWD.armRaise * e * (0.6 + 0.4 * Math.max(0, beat));
      p.armL.rotation.x = -raise;
      p.armR.rotation.x = -raise * (0.7 + 0.3 * Math.sin(time * 3 + p.phase));
      p.armL.rotation.z = -0.3 * e * Math.sin(time * 4 + p.phase);
      p.armR.rotation.z = 0.3 * e * Math.sin(time * 4 + p.phase + 1);
    }
  }
}

/** Seats on stepped rings around a round floor: `rows` rings starting at `inner`, rising `rise` each. */
export function ringSeats(inner: number, rows: number, rowDepth: number, rise: number, baseHeight: number, perRow: (row: number) => number): Seat[] {
  const seats: Seat[] = [];
  for (let r = 0; r < rows; r++) {
    const radius = inner + r * rowDepth + rowDepth / 2;
    const count = perRow(r);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + r * 0.13;
      seats.push({ x: Math.sin(a) * radius, y: baseHeight + r * rise, z: Math.cos(a) * radius, yaw: a + Math.PI });
    }
  }
  return seats;
}

/** Keeps a crowd cheering every frame for as long as its node lives. */
export function animateCrowd(scene: Scene, owner: TransformNode, crowd: Crowd): void {
  let time = 0;
  const observer = scene.onBeforeRenderObservable.add(() => {
    time += scene.getEngine().getDeltaTime() / 1000;
    crowd.update(time);
  });
  owner.onDisposeObservable.addOnce(() => scene.onBeforeRenderObservable.remove(observer));
}
