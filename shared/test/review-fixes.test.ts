import { describe, expect, it } from 'vitest';
import { FORMATION } from '../src/config.ts';
import { neutralInput } from '../src/input.ts';
import { stepMatch } from '../src/match.ts';
import { distanceXZ } from '../src/math.ts';
import { CASTLE, CITY } from '../src/maps.ts';
import { beginNavigationStep, navigate } from '../src/navigation.ts';
import { applyCommand, formationTargets, livingSoldiers } from '../src/orders.ts';
import { canSee } from '../src/perception.ts';
import { inWater, terrainHeightAt } from '../src/terrain.ts';
import type { MatchState } from '../src/types.ts';
import { commanderOf, newMatch, place, soldiersOf } from './helpers.ts';

const DT = 1 / 30;
/** These simulate half a minute of battle; they need more than the default 5 s. */
const LONG = 20_000;

function run(state: MatchState, seconds: number): void {
  const inputs = new Map([[0, neutralInput()]]);
  for (let t = 0; t < seconds; t += DT) stepMatch(state, inputs, DT);
}

function twoPlayers(map: 'meadow' | 'castle' | 'city', armySize: 15 | 25 | 40 = 15): MatchState {
  return newMatch({ map, armySize, armies: [{ name: 'You', team: 0, isBot: false }, { name: 'Far', team: 1, isBot: false }] });
}

describe('found in review', () => {
  it('a soldier knocked into the moat wades out and rejoins the formation', () => {
    const state = twoPlayers('castle');
    const soldier = soldiersOf(state, 0)[0]!;
    const x = CASTLE.centerX - CASTLE.moatOuter + 4;
    place(soldier, x, 15);
    soldier.pos.y = terrainHeightAt('castle', x, 15);
    expect(inWater('castle', soldier.pos.x, soldier.pos.z)).toBe(true);
    run(state, 25);
    expect(inWater('castle', soldier.pos.x, soldier.pos.z)).toBe(false);
    // Back in its place in the formation (this army holds the castle), not stuck on the bank.
    const slot = formationTargets(state, state.armies[0]!).get(soldier.id)!;
    expect(distanceXZ(soldier.pos, slot)).toBeLessThan(2);
  }, LONG);

  it('a route starts from water or an alley by leading out of it', () => {
    beginNavigationStep();
    const wet = { x: CASTLE.centerX - CASTLE.moatOuter + 4, z: 15 };
    const step = navigate('castle', wet, { x: -60, z: 0 });
    expect(step).not.toBeNull();
  });

  it('a soldier in a city alley can be seen from the street the alley opens on', () => {
    const state = twoPlayers('city');
    const watcher = soldiersOf(state, 0)[0];
    const hiding = soldiersOf(state, 1)[0];
    // The alley through the block between x -54 and -36 runs north–south at x = -45.
    if (!watcher || !hiding) throw new Error('missing soldiers');
    place(hiding, -45.6, (CITY.lines[1] + CITY.lines[2]) / 2 - 2);
    place(watcher, -45, CITY.lines[1]);
    expect(canSee(state, watcher, hiding)).toBe(true);
  });

  it('pincer wings keep their soldiers; nobody swaps sides once they are round the enemy', () => {
    const state = twoPlayers('meadow', 40);
    place(commanderOf(state, 0), -40, 0, Math.PI / 2);
    soldiersOf(state, 1).slice(0, 15).forEach((f, i) => place(f, -16, (i - 7) * 0.9, -Math.PI / 2));
    for (const f of soldiersOf(state, 1).slice(15)) place(f, 90, 0);
    place(commanderOf(state, 1), -12, 0, -Math.PI / 2);
    applyCommand(state, 1, { type: 'formation', formation: 'double' });
    applyCommand(state, 0, { type: 'formation', formation: 'pincer' });
    run(state, 2);
    const wings = state.armies[0]!.groupOrders[0]!.pincer;
    expect(wings?.left.length).toBeGreaterThan(0);
    run(state, 25);
    expect(state.armies[0]!.groupOrders[0]!.pincer).toBe(wings);
    // The middle line stayed near the commander the whole time.
    const middle = livingSoldiers(state, state.armies[0]!).filter((u) => !wings!.left.includes(u.id) && !wings!.right.includes(u.id));
    expect(middle.every((u) => u.pos.x < -30)).toBe(true);
  }, LONG);

  it('splitting a holding army keeps each half on its own ground', () => {
    const state = twoPlayers('meadow', 40);
    place(commanderOf(state, 0), -60, 0, Math.PI / 2);
    applyCommand(state, 0, { type: 'formation', formation: 'line' });
    run(state, 10);
    applyCommand(state, 0, { type: 'split', groupCount: 2 });
    run(state, 8);
    const slots = formationTargets(state, state.armies[0]!);
    const off = livingSoldiers(state, state.armies[0]!).filter((u) => distanceXZ(u.pos, slots.get(u.id)!) > FORMATION.arriveRadius);
    expect(off.length).toBeLessThanOrEqual(2);
  });

  it('the spear volley is not thrown away on empty ground', () => {
    const state = twoPlayers('meadow');
    const me = place(commanderOf(state, 0), -60, 0, Math.PI / 2);
    for (const s of soldiersOf(state, 0)) place(s, -58, 0);
    expect(applyCommand(state, 0, { type: 'volley', at: { x: me.pos.x + 12, y: 0, z: 0 }, group: null })).toBe(false);
    expect(state.armies[0]?.spearsThrown).toBe(false);
  });

  it('a formation for a half that does not exist changes nothing', () => {
    const state = twoPlayers('meadow');
    applyCommand(state, 0, { type: 'split', groupCount: 2 });
    expect(applyCommand(state, 0, { type: 'formation', formation: 'circle', group: 2 })).toBe(false);
    expect(state.armies[0]?.formation).toBe('double');
  });
});
