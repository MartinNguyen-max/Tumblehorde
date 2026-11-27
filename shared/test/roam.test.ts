import { describe, expect, it } from 'vitest';
import { type District, districtWalkable, overlapsFootprint, resolveDistrict, ROAM, stepWalker, type Walker } from '../src/campaign/index.ts';

const DISTRICT: District = {
  halfSize: 20,
  footprints: [
    { x: 0, z: 5, width: 4, depth: 2, yaw: 0 },
    { x: 10, z: 0, width: 4, depth: 4, yaw: Math.PI / 4 },
  ],
};

function walk(walker: Walker, move: { x: number; z: number }, seconds: number, running = false): void {
  for (let t = 0; t < seconds; t += 1 / 60) stepWalker(walker, DISTRICT, move, running, 1 / 60);
}

describe('free roam', () => {
  it('walks at walking speed and faces where it goes', () => {
    const walker: Walker = { pos: { x: 0, z: -10 }, yaw: 0, speed: 0 };
    walk(walker, { x: 1, z: 0 }, 2);
    expect(walker.pos.x).toBeGreaterThan(ROAM.walkSpeed * 1.5);
    expect(walker.yaw).toBeCloseTo(Math.PI / 2);
    const runner: Walker = { pos: { x: 0, z: -10 }, yaw: 0, speed: 0 };
    walk(runner, { x: 1, z: 0 }, 2, true);
    expect(runner.pos.x).toBeGreaterThan(walker.pos.x);
  });

  it('cannot walk through a building or leave the district', () => {
    const walker: Walker = { pos: { x: 0, z: 0 }, yaw: 0, speed: 0 };
    walk(walker, { x: 0, z: 1 }, 3);
    expect(walker.pos.z).toBeLessThanOrEqual(4 - ROAM.bodyRadius + 1e-6);
    walk(walker, { x: -1, z: 0 }, 20);
    expect(walker.pos.x).toBeGreaterThanOrEqual(-20 + ROAM.bodyRadius - 1e-6);
  });

  it('is pushed out of turned buildings', () => {
    const p = resolveDistrict(DISTRICT, { x: 10.2, z: 0.1 }, ROAM.bodyRadius);
    expect(overlapsFootprint(DISTRICT.footprints[1]!, p.x, p.z, ROAM.bodyRadius - 1e-6)).toBe(false);
  });

  it('tells NPCs where they may stand', () => {
    const walkable = districtWalkable(DISTRICT);
    expect(walkable({ x: 0, z: 0 })).toBe(true);
    expect(walkable({ x: 0, z: 5 })).toBe(false);
    expect(walkable({ x: 25, z: 0 })).toBe(false);
  });
});
