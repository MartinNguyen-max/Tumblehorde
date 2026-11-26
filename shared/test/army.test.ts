import { describe, expect, it } from 'vitest';
import { ARMY, COMMANDER } from '../src/config.ts';
import { killUnit } from '../src/combat.ts';
import { neutralInput } from '../src/input.ts';
import { stepMatch } from '../src/match.ts';
import { distanceXZ } from '../src/math.ts';
import { applyCommand, armyCenter, groupForKind, livingSoldiers } from '../src/orders.ts';
import { soldierKindsFor } from '../src/setup.ts';
import type { MatchState } from '../src/types.ts';
import { commanderOf, newMatch, place, soldiersOf } from './helpers.ts';

const DT = 1 / 60;
const ZERO = { x: 0, y: 0, z: 0 };

function run(state: MatchState, seconds: number, moveX = 0, moveZ = 0): void {
  const inputs = new Map([[0, { ...neutralInput(), moveX, moveZ }]]);
  for (let t = 0; t < seconds; t += DT) stepMatch(state, inputs, DT);
}

/** A match where the enemy is parked far away and cannot interfere. */
function quietMatch(size: 10 | 20 | 30 = 10): MatchState {
  const state = newMatch({ armySize: size, armies: [
    { name: 'You', team: 0, isBot: false },
    { name: 'Far', team: 1, isBot: false },
  ] });
  return state;
}

describe('army composition', () => {
  it.each(ARMY.sizes)('builds an army of %i soldiers with the fixed mix', (size) => {
    const kinds = soldierKindsFor(size);
    const mix = ARMY.composition[size];
    expect(kinds).toHaveLength(size);
    expect(kinds.filter((k) => k === 'swordsman')).toHaveLength(mix.swordsman);
    expect(kinds.filter((k) => k === 'archer')).toHaveLength(mix.archer);
    expect(kinds.filter((k) => k === 'rider')).toHaveLength(mix.rider);
  });

  it('gives every rider a horse', () => {
    const state = newMatch({ armySize: 30 });
    const riders = soldiersOf(state, 0).filter((u) => u.kind === 'rider');
    expect(riders).toHaveLength(3);
    for (const rider of riders) {
      const horse = rider.mountId === null ? undefined : state.units[rider.mountId];
      expect(horse?.kind).toBe('horse');
      expect(horse?.riderId).toBe(rider.id);
    }
  });
});

describe('orders', () => {
  it('Follow makes the army trail its commander', () => {
    const state = quietMatch();
    applyCommand(state, 0, { type: 'order', order: 'follow', group: null });
    run(state, 6, 0, 1);
    run(state, 4);
    const me = commanderOf(state, 0);
    const center = armyCenter(state, state.armies[0]!)!;
    expect(distanceXZ(center, me.pos)).toBeLessThan(10);
    expect(center.z).toBeLessThan(me.pos.z);
  });

  it('Hold forms up around the commander: shield wall ahead, archers behind', () => {
    const state = quietMatch(20);
    const me = place(commanderOf(state, 0), -70, 0, Math.PI / 2);
    applyCommand(state, 0, { type: 'order', order: 'hold', group: null });
    run(state, 8);
    const soldiers = livingSoldiers(state, state.armies[0]!);
    const swords = soldiers.filter((u) => u.kind === 'swordsman');
    const archers = soldiers.filter((u) => u.kind === 'archer');
    const ahead = (u: { pos: { x: number } }) => u.pos.x - me.pos.x;
    expect(swords.filter((u) => ahead(u) > 1.5).length).toBeGreaterThanOrEqual(6);
    expect(swords.every((u) => distanceXZ(u.pos, me.pos) < 5)).toBe(true);
    expect(archers.every((u) => ahead(u) < -2)).toBe(true);
    expect(swords.filter((u) => u.shieldUp).length).toBe(0);
  });

  it('Attack sends the army towards the enemy', () => {
    const state = quietMatch();
    const enemy = armyCenter(state, state.armies[1]!)!;
    const before = distanceXZ(armyCenter(state, state.armies[0]!)!, enemy);
    applyCommand(state, 0, { type: 'order', order: 'attack', group: null });
    run(state, 3);
    const after = distanceXZ(armyCenter(state, state.armies[0]!)!, enemy);
    expect(after).toBeLessThan(before - 8);
  });

  it('splits the army by unit type', () => {
    expect(groupForKind('archer', 2)).toBe(1);
    expect(groupForKind('rider', 2)).toBe(0);
    expect(groupForKind('rider', 3)).toBe(2);
    expect(groupForKind('swordsman', 3)).toBe(0);
    const state = quietMatch();
    applyCommand(state, 0, { type: 'split', groupCount: 3 });
    const army = state.armies[0]!;
    expect(army.groupCount).toBe(3);
    expect(army.groupOrders).toHaveLength(3);
    for (const unit of soldiersOf(state, 0)) expect(unit.group).toBe(groupForKind(unit.kind, 3));
  });

  it('orders one group without touching the others', () => {
    const state = quietMatch();
    applyCommand(state, 0, { type: 'split', groupCount: 2 });
    applyCommand(state, 0, { type: 'order', order: 'attack', group: 1 });
    const army = state.armies[0]!;
    expect(army.groupOrders[0]?.order).toBe('hold');
    expect(army.groupOrders[1]?.order).toBe('attack');
  });

  it('cannot be given while the commander is dead', () => {
    const state = quietMatch();
    killUnit(state, commanderOf(state, 0), 1, ZERO);
    expect(applyCommand(state, 0, { type: 'order', order: 'attack', group: null })).toBe(false);
  });
});

describe('commander respawn', () => {
  it('gets back up after the respawn time where they fell', () => {
    const state = quietMatch();
    const me = commanderOf(state, 0);
    place(me, 0, 0);
    killUnit(state, me, 1, ZERO);
    run(state, COMMANDER.respawnTime - 0.5);
    expect(me.alive).toBe(false);
    run(state, 1);
    expect(me.alive).toBe(true);
    expect(me.hp).toBe(COMMANDER.hp);
    expect(distanceXZ({ x: 0, z: 0 }, me.pos)).toBeLessThan(1);
  });

  it('does not respawn once the whole army is gone, and the army is out', () => {
    const state = quietMatch();
    for (const soldier of soldiersOf(state, 0)) killUnit(state, soldier, 1, ZERO);
    expect(state.armies[0]?.eliminated).toBe(false);
    killUnit(state, commanderOf(state, 0), 1, ZERO);
    run(state, DT);
    expect(state.armies[0]?.eliminated).toBe(true);
  });
});
