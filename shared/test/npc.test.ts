import { describe, expect, it } from 'vitest';
import { createRandom } from '../src/random.ts';
import { distanceXZ } from '../src/math.ts';
import { createNpc, endTalk, NPC, punchNpc, startTalk, stepNpc, talkableNpc, type Npc, type Walkable } from '../src/campaign/index.ts';

const DT = 1 / 20;

function live(npc: Npc, seconds: number, walkable?: Walkable, seed = 7): void {
  const rng = createRandom(seed);
  for (let t = 0; t < seconds; t += DT) stepNpc(npc, DT, rng, walkable);
}

describe('npcs', () => {
  it('stroll near home and never leave the open ground', () => {
    const npc = createNpc(0, { role: 'citizen', name: 'Baker', home: { x: 0, z: 0 } });
    const walkable: Walkable = (p) => p.x > -3;
    let farthest = 0;
    const rng = createRandom(3);
    let moved = false;
    for (let t = 0; t < 120; t += DT) {
      stepNpc(npc, DT, rng, walkable);
      farthest = Math.max(farthest, distanceXZ(npc.pos, npc.home));
      if (npc.pos.x !== 0 || npc.pos.z !== 0) moved = true;
      expect(npc.pos.x).toBeGreaterThan(-3);
    }
    expect(moved).toBe(true);
    expect(farthest).toBeLessThanOrEqual(NPC.wanderRadius + 0.01);
  });

  it('stationary people stay put', () => {
    const guard = createNpc(0, { role: 'guard', name: 'Guard', home: { x: 4, z: 4 }, stationary: true });
    live(guard, 60);
    expect(guard.pos).toEqual({ x: 4, z: 4 });
  });

  it('a punch knocks one out for a while and scares the others away', () => {
    const victim = createNpc(0, { role: 'citizen', name: 'A', home: { x: 0, z: 0 } });
    const near = createNpc(1, { role: 'child', name: 'B', home: { x: 2, z: 0 } });
    const far = createNpc(2, { role: 'citizen', name: 'C', home: { x: 30, z: 0 } });
    const all = [victim, near, far];
    punchNpc(all, victim, { x: -1, z: 0 });
    expect(victim.mode).toBe('out');
    expect(near.mode).toBe('flee');
    expect(far.mode).toBe('idle');
    const rng = createRandom(1);
    for (let t = 0; t < NPC.fleeTime / 2; t += DT) for (const n of all) stepNpc(n, DT, rng);
    expect(near.pos.x).toBeGreaterThan(2);
    expect(victim.pos).toEqual({ x: 0, z: 0 });
    for (let t = 0; t < NPC.knockoutTime; t += DT) for (const n of all) stepNpc(n, DT, rng);
    expect(victim.mode).not.toBe('out');
  });

  it('only someone in front and close can be talked to; a talk holds them still', () => {
    const varro = createNpc(0, { role: 'smith', name: 'Varro', home: { x: 0, z: 2 }, dialogue: 'varro' });
    const npcs = [varro];
    expect(talkableNpc(npcs, { x: 0, z: 0 }, 0)).toBe(varro);
    expect(talkableNpc(npcs, { x: 0, z: 0 }, Math.PI)).toBeNull();
    expect(talkableNpc(npcs, { x: 0, z: -5 }, 0)).toBeNull();
    startTalk(varro, { x: 0, z: 0 });
    expect(varro.yaw).toBeCloseTo(Math.PI);
    live(varro, 10);
    expect(varro.pos).toEqual({ x: 0, z: 2 });
    endTalk(varro, createRandom(1));
    expect(varro.mode).toBe('idle');
  });

  it('a guard on patrol walks his round, point after point, and starts over', () => {
    const round = [{ x: 0, z: 0 }, { x: 6, z: 0 }, { x: 6, z: 6 }];
    const guard = createNpc(0, { role: 'guard', name: 'Guard', home: { x: 0, z: 0 }, patrol: round });
    const rng = createRandom(3);
    const seen = new Set<number>();
    let wentBack = false;
    for (let t = 0; t < 40; t += DT) {
      stepNpc(guard, DT, rng);
      const target = guard.mode === 'walk' ? guard.target : null;
      if (target) seen.add(round.findIndex((p) => p.x === target.x && p.z === target.z));
      if (seen.size === 3 && guard.patrolIndex === 0) wentBack = true;
      expect(Math.hypot(guard.pos.x - 3, guard.pos.z - 3)).toBeLessThan(6);
    }
    expect([...seen].sort()).toEqual([0, 1, 2]);
    expect(wentBack).toBe(true);
  });
});
