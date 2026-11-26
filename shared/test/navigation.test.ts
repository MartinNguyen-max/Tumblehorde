import { describe, expect, it } from 'vitest';
import { neutralInput } from '../src/input.ts';
import { stepMatch } from '../src/match.ts';
import { distanceXZ } from '../src/math.ts';
import { CASTLE } from '../src/maps.ts';
import { inWater } from '../src/terrain.ts';
import { beginNavigationStep, clearPath, isWalkable, localStep, navigate, nearestWalkable } from '../src/navigation.ts';
import { applyCommand, formationTargets, holdAt } from '../src/orders.ts';
import { commanderOf, newMatch, place, soldiersOf } from './helpers.ts';

const DT = 1 / 30;
/** On dry land beyond the moat, and in the courtyard. */
const OUTSIDE = { x: CASTLE.centerX - CASTLE.moatOuter - 6, z: 20 };
const INSIDE = { x: CASTLE.west + 8, z: 12 };

describe('navigation', () => {
  it('sees walls between two points and open ground elsewhere', () => {
    expect(clearPath('castle', OUTSIDE, INSIDE)).toBe(false);
    expect(clearPath('castle', { x: -50, z: 0 }, { x: -20, z: 10 })).toBe(true);
    expect(clearPath('meadow', { x: -60, z: -60 }, { x: -50, z: -60 })).toBe(true);
  });

  it('heads for the gate when the castle wall is in the way', () => {
    beginNavigationStep();
    const step = navigate('castle', OUTSIDE, INSIDE);
    if (!step) throw new Error('expected a route');
    expect(step).not.toEqual(INSIDE);
    // The first leg runs towards the gate (z = 0), not into the wall.
    expect(step.z).toBeLessThan(OUTSIDE.z);
    expect(clearPath('castle', OUTSIDE, step)).toBe(true);
  });

  it('never steps straight into a wall while no route is ready', () => {
    const towardsWall = localStep('castle', OUTSIDE, INSIDE);
    if (!towardsWall) throw new Error('expected an open step');
    expect(isWalkable('castle', towardsWall.x, towardsWall.z)).toBe(true);
    expect(inWater('castle', towardsWall.x, towardsWall.z)).toBe(false);
  });

  it('takes the bridge instead of wading through the moat', () => {
    beginNavigationStep();
    const from = { x: CASTLE.centerX - CASTLE.moatOuter - 3, z: 14 };
    const step = navigate('castle', from, INSIDE);
    if (!step) throw new Error('expected a route');
    expect(inWater('castle', step.x, step.z)).toBe(false);
    expect(Math.abs(step.z)).toBeLessThan(from.z);
  });

  it('moves places inside buildings out into the street', () => {
    const inWall = { x: CASTLE.west, z: 12 };
    expect(isWalkable('castle', inWall.x, inWall.z)).toBe(false);
    const free = nearestWalkable('castle', inWall);
    expect(isWalkable('castle', free.x, free.z)).toBe(true);
    expect(distanceXZ(free, inWall)).toBeLessThan(4);
  });

  it('brings soldiers through the gate to a spot inside the castle', () => {
    const state = newMatch({ map: 'castle', armySize: 15, armies: [{ name: 'You', team: 1, isBot: false }, { name: 'Keep', team: 0, isBot: false }] });
    place(commanderOf(state, 1), CASTLE.east - 8, 0);
    const army = state.armies[0]!;
    for (const s of soldiersOf(state, 0)) place(s, OUTSIDE.x - 5 + (s.id % 5), OUTSIDE.z + Math.floor((s.id % 15) / 5));
    holdAt(state, army, INSIDE, 0);
    for (let t = 0; t < 30; t += DT) stepMatch(state, new Map([[0, neutralInput()]]), DT);
    const inside = soldiersOf(state, 0).filter((s) => s.pos.x > CASTLE.west + 2);
    expect(inside.length).toBeGreaterThanOrEqual(13);
  });

  it('keeps every formation place out of the houses in the city', () => {
    const state = newMatch({ map: 'city', armySize: 40 });
    applyCommand(state, 0, { type: 'formation', formation: 'line' });
    for (const slot of formationTargets(state, state.armies[0]!).values()) expect(isWalkable('city', slot.x, slot.z)).toBe(true);
  });
});
