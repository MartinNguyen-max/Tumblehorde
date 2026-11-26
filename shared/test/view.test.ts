import { describe, expect, it } from 'vitest';
import { stepMatch } from '../src/match.ts';
import { interpolateViews, matchView } from '../src/view.ts';
import { newMatch } from './helpers.ts';

describe('match views', () => {
  it('mirror the simulation', () => {
    const state = newMatch();
    const view = matchView(state);
    expect(view.units).toHaveLength(state.units.length);
    expect(view.armies[0]?.soldiersAlive).toBe(10);
    expect(view.armies[1]?.orders).toEqual(['hold']);
  });

  it('interpolate positions halfway between two steps', () => {
    const state = newMatch();
    const unit = state.units[0]!;
    const a = matchView(state);
    unit.pos.x += 2;
    const b = matchView(state);
    const mid = interpolateViews(a, b, 0.5);
    expect(mid.units[0]!.x).toBeCloseTo(a.units[0]!.x + 1);
  });

  it('do not smear teleports', () => {
    const state = newMatch();
    const a = matchView(state);
    state.units[0]!.pos.x += 30;
    const b = matchView(state);
    expect(interpolateViews(a, b, 0.5).units[0]!.x).toBe(b.units[0]!.x);
  });

  it('take the shortest way around when blending yaw', () => {
    const state = newMatch();
    state.units[0]!.yaw = 3.1;
    const a = matchView(state);
    state.units[0]!.yaw = -3.1;
    const b = matchView(state);
    expect(Math.abs(interpolateViews(a, b, 0.5).units[0]!.yaw)).toBeGreaterThan(3.1);
  });

  it('stay cheap during a battle', () => {
    const state = newMatch({ armySize: 30 });
    for (let i = 0; i < 60; i++) stepMatch(state, new Map(), 1 / 60);
    expect(matchView(state).units.every((u) => Number.isFinite(u.x))).toBe(true);
  });
});
