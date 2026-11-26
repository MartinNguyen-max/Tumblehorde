import { describe, expect, it } from 'vitest';
import { ARCHER, ARROW, SHIELD } from '../src/config.ts';
import { fireArrow, solveLaunchAngle, stepArrows } from '../src/arrows.ts';
import type { MatchState, Unit } from '../src/types.ts';
import { firstOfKind, newMatch, place } from './helpers.ts';

function flyAll(state: MatchState): void {
  for (let i = 0; i < 400 && state.arrows.length > 0; i++) stepArrows(state, 1 / 60);
}

function setup(distance: number): { state: MatchState; archer: Unit; target: Unit } {
  const state = newMatch({ mix: 'mixed' });
  state.rng.seed = 7;
  const archer = place(firstOfKind(state, 0, 'archer'), 0, 0, 0);
  const target = place(firstOfKind(state, 1, 'swordsman'), 0, distance, Math.PI);
  archer.ai.targetId = target.id;
  return { state, archer, target };
}

describe('ballistics', () => {
  it('finds a launch angle that lands on target', () => {
    const dx = 30;
    const angle = solveLaunchAngle(dx, 0, ARROW.speed, ARROW.gravity);
    expect(angle).not.toBeNull();
    const vx = Math.cos(angle!) * ARROW.speed;
    const vy = Math.sin(angle!) * ARROW.speed;
    const t = dx / vx;
    expect(vy * t - 0.5 * ARROW.gravity * t * t).toBeCloseTo(0, 3);
  });

  it('reports targets that are out of reach', () => {
    expect(solveLaunchAngle(500, 0, ARROW.speed, ARROW.gravity)).toBeNull();
  });

  it('can reach the full bow range', () => {
    expect(solveLaunchAngle(ARCHER.ranged.range, -2, ARROW.speed, ARROW.gravity)).not.toBeNull();
  });
});

describe('arrows', () => {
  it('hit a standing target at medium range', () => {
    let hits = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const { state, archer, target } = setup(20);
      state.rng.seed = seed;
      fireArrow(state, archer, target);
      flyAll(state);
      if (target.hp < target.maxHp) hits++;
    }
    expect(hits).toBeGreaterThanOrEqual(7);
  });

  it('deal bow damage', () => {
    const { state, archer, target } = setup(10);
    fireArrow(state, archer, target);
    flyAll(state);
    expect(target.hp).toBeCloseTo(target.maxHp - ARCHER.ranged.damage);
  });

  it('are mostly stopped by a raised shield', () => {
    const { state, archer, target } = setup(10);
    target.shieldUp = true;
    fireArrow(state, archer, target);
    flyAll(state);
    expect(target.hp).toBeCloseTo(target.maxHp - ARCHER.ranged.damage * (1 - SHIELD.blockFraction));
  });

  it('stick in the ground when they miss', () => {
    const { state, archer } = setup(10);
    fireArrow(state, archer, null);
    let landed = false;
    for (let i = 0; i < 400 && state.arrows.length > 0; i++) {
      stepArrows(state, 1 / 60);
      if (state.events.some((e) => e.type === 'arrowLanded')) landed = true;
    }
    expect(landed).toBe(true);
    expect(state.arrows).toHaveLength(0);
  });

  it('never hurt teammates', () => {
    const { state, archer } = setup(10);
    const friend = place(firstOfKind(state, 0, 'swordsman'), 0, 5);
    fireArrow(state, archer, null);
    flyAll(state);
    expect(friend.hp).toBe(friend.maxHp);
  });
});
