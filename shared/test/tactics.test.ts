import { describe, expect, it } from 'vitest';
import { neutralInput } from '../src/input.ts';
import { stepMatch } from '../src/match.ts';
import { distanceXZ } from '../src/math.ts';
import { CITY } from '../src/maps.ts';
import { canSee, nearestVisibleEnemy } from '../src/perception.ts';
import { applyCommand, centroid, isSplitInHalves } from '../src/orders.ts';
import type { MatchState } from '../src/types.ts';
import { commanderOf, newMatch, place, soldiersOf } from './helpers.ts';

const DT = 1 / 30;

function run(state: MatchState, seconds: number): void {
  const inputs = new Map([[0, neutralInput()]]);
  for (let t = 0; t < seconds; t += DT) stepMatch(state, inputs, DT);
}

function twoPlayers(map: 'meadow' | 'city'): MatchState {
  return newMatch({ map, armySize: 15, armies: [{ name: 'You', team: 0, isBot: false }, { name: 'Them', team: 1, isBot: false }] });
}

describe('splitting the army in two', () => {
  it('splits into a left and a right half that take orders on their own', () => {
    const state = twoPlayers('meadow');
    place(commanderOf(state, 0), -60, 0, Math.PI / 2);
    expect(applyCommand(state, 0, { type: 'split', groupCount: 2 })).toBe(true);
    const army = state.armies[0]!;
    expect(isSplitInHalves(state, army)).toBe(true);
    const groups = soldiersOf(state, 0).map((s) => s.group);
    expect(groups.filter((g) => g === 0)).toHaveLength(8);
    expect(groups.filter((g) => g === 1)).toHaveLength(7);
    applyCommand(state, 0, { type: 'order', order: 'attack', group: 1 });
    expect(army.groupOrders[0]?.order).toBe('hold');
    expect(army.groupOrders[1]?.order).toBe('attack');
  });

  it('each half holds its own formation where the commander stood', () => {
    const state = twoPlayers('meadow');
    const me = place(commanderOf(state, 0), -60, 0, Math.PI / 2);
    applyCommand(state, 0, { type: 'split', groupCount: 2 });
    applyCommand(state, 0, { type: 'formation', formation: 'line', group: 0 });
    place(me, -60, 30, Math.PI / 2);
    applyCommand(state, 0, { type: 'order', order: 'hold', group: 1 });
    run(state, 12);
    const left = soldiersOf(state, 0).filter((s) => s.group === 0);
    const right = soldiersOf(state, 0).filter((s) => s.group === 1);
    expect(distanceXZ(centroid(left)!, { x: -57.4, z: 0 })).toBeLessThan(2);
    expect(distanceXZ(centroid(right)!, { x: -58.4, z: 30 })).toBeLessThan(3);
  });

  it('comes back together on an order to the whole army', () => {
    const state = twoPlayers('meadow');
    applyCommand(state, 0, { type: 'split', groupCount: 2 });
    applyCommand(state, 0, { type: 'order', order: 'follow', group: null });
    const army = state.armies[0]!;
    expect(isSplitInHalves(state, army)).toBe(false);
    expect(soldiersOf(state, 0).every((s) => s.group === 0)).toBe(true);
    expect(army.groupOrders.every((g) => g.order === 'follow')).toBe(true);
  });
});

describe('fog of war in the city', () => {
  it('houses block sight; on the meadow everyone sees everyone', () => {
    const city = twoPlayers('city');
    const [a] = soldiersOf(city, 0);
    const [b] = soldiersOf(city, 1);
    // Two parallel side streets with a house between them (the alley through the block is at x = -36).
    place(a!, -41, CITY.lines[1]);
    place(b!, -41, CITY.lines[2]);
    expect(canSee(city, a!, b!)).toBe(false);
    expect(nearestVisibleEnemy(city, a!, 60)).not.toBe(b);
    place(b!, -20, CITY.lines[1]);
    expect(canSee(city, a!, b!)).toBe(true);
    const meadow = twoPlayers('meadow');
    expect(canSee(meadow, soldiersOf(meadow, 0)[0]!, soldiersOf(meadow, 1)[0]!)).toBe(true);
  });

  it('attacking blind sends the army searching, and one sighting brings everyone', () => {
    const state = twoPlayers('city');
    const army = state.armies[0]!;
    applyCommand(state, 0, { type: 'order', order: 'attack', group: null });
    run(state, 1);
    expect(army.intel).toBeNull();
    expect(army.searchPoint).not.toBeNull();
    const scout = soldiersOf(state, 0)[0]!;
    const foe = soldiersOf(state, 1)[0]!;
    place(scout, 0, -30);
    place(foe, 0, -45);
    run(state, 0.5);
    expect(army.intel).not.toBeNull();
    expect(distanceXZ(army.intel!, foe.pos)).toBeLessThan(3);
  });
});
