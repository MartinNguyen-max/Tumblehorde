import { describe, expect, it } from 'vitest';
import { ARMY, COMMANDER, FORMATION } from '../src/config.ts';
import { rankSizes, ringRadius } from '../src/formation.ts';
import { killUnit } from '../src/combat.ts';
import { neutralInput } from '../src/input.ts';
import { stepMatch } from '../src/match.ts';
import { distanceXZ, wrapAngle } from '../src/math.ts';
import { applyCommand, armyCenter, centroid, groupForKind, livingSoldiers } from '../src/orders.ts';
import { soldierKindsFor } from '../src/setup.ts';
import type { ArmyMix, ArmySize, MatchState } from '../src/types.ts';
import { commanderOf, newMatch, place, soldiersOf } from './helpers.ts';

const DT = 1 / 60;
const ZERO = { x: 0, y: 0, z: 0 };

function run(state: MatchState, seconds: number, moveX = 0, moveZ = 0): void {
  const inputs = new Map([[0, { ...neutralInput(), moveX, moveZ }]]);
  for (let t = 0; t < seconds; t += DT) stepMatch(state, inputs, DT);
}

/** A match where the enemy is parked far away and cannot interfere. */
function quietMatch(size: ArmySize = 15, mix: ArmyMix = 'legion'): MatchState {
  const state = newMatch({ armySize: size, mix, armies: [
    { name: 'You', team: 0, isBot: false },
    { name: 'Far', team: 1, isBot: false },
  ] });
  return state;
}

describe('army composition', () => {
  it.each(ARMY.sizes)('builds a legion of %i swordsmen by default', (size) => {
    const kinds = soldierKindsFor(size);
    expect(kinds).toHaveLength(size);
    expect(kinds.every((k) => k === 'swordsman')).toBe(true);
  });

  it.each(ARMY.sizes)('still builds the parked mixed army of %i soldiers', (size) => {
    const kinds = soldierKindsFor(size, 'mixed');
    const mix = ARMY.mixes.mixed[size];
    expect(kinds).toHaveLength(size);
    expect(kinds.filter((k) => k === 'swordsman')).toHaveLength(mix.swordsman);
    expect(kinds.filter((k) => k === 'archer')).toHaveLength(mix.archer);
    expect(kinds.filter((k) => k === 'rider')).toHaveLength(mix.rider);
  });

  it('gives every rider a horse', () => {
    const state = newMatch({ armySize: 40, mix: 'mixed' });
    const riders = soldiersOf(state, 0).filter((u) => u.kind === 'rider');
    expect(riders).toHaveLength(ARMY.mixes.mixed[40].rider);
    for (const rider of riders) {
      const horse = rider.mountId === null ? undefined : state.units[rider.mountId];
      expect(horse?.kind).toBe('horse');
      expect(horse?.riderId).toBe(rider.id);
    }
  });

  it('gives every army, bots too, a commander on horseback, and only commanders ride', () => {
    const state = newMatch({}, { commanderHorses: true });
    const horses = state.units.filter((u) => u.kind === 'horse');
    expect(horses).toHaveLength(state.armies.length);
    for (const army of state.armies) {
      expect(army.commanderId).not.toBeNull();
      expect(horses.some((h) => h.riderId === army.commanderId)).toBe(true);
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

  it('Hold forms two tight lines just ahead of the commander by default', () => {
    const state = quietMatch(25);
    const me = place(commanderOf(state, 0), -70, 0, Math.PI / 2);
    applyCommand(state, 0, { type: 'order', order: 'hold', group: null });
    run(state, 10);
    const swords = livingSoldiers(state, state.armies[0]!);
    const ahead = (u: { pos: { x: number } }) => u.pos.x - me.pos.x;
    expect(swords.every((u) => ahead(u) > 0.8 && ahead(u) < FORMATION.holdLineAhead + 0.6)).toBe(true);
    const front = swords.filter((u) => ahead(u) > FORMATION.holdLineAhead - FORMATION.rankGap / 2);
    expect(front.length).toBe(13);
    expect(swords.every((u) => u.weapon === 'spear')).toBe(true);
  });

  it('a long line puts everyone in one rank', () => {
    const state = quietMatch(15);
    const me = place(commanderOf(state, 0), -70, 0, Math.PI / 2);
    applyCommand(state, 0, { type: 'formation', formation: 'line' });
    run(state, 10);
    const swords = livingSoldiers(state, state.armies[0]!);
    for (const u of swords) expect(u.pos.x - me.pos.x).toBeCloseTo(FORMATION.holdLineAhead, 0);
    const xs = swords.map((u) => u.pos.z).sort((a, b) => a - b);
    expect(xs[xs.length - 1]! - xs[0]!).toBeGreaterThan(FORMATION.tightSpacing * 12);
    expect(state.armies[0]?.formation).toBe('line');
  });

  it('a circle closes a ring around the commander, everyone facing out', () => {
    const state = quietMatch(25);
    const me = place(commanderOf(state, 0), -70, 0, 0);
    applyCommand(state, 0, { type: 'formation', formation: 'circle' });
    run(state, 12);
    const radius = ringRadius(25);
    for (const u of livingSoldiers(state, state.armies[0]!)) {
      expect(distanceXZ(u.pos, me.pos)).toBeCloseTo(radius, 0);
      const outward = Math.atan2(u.pos.x - me.pos.x, u.pos.z - me.pos.z);
      expect(Math.abs(wrapAngle(u.yaw - outward))).toBeLessThan(0.3);
    }
  });

  it('a wedge has its tip in front, a column is three wide, a testudo is a square block', () => {
    expect(rankSizes('wedge', 15)).toEqual([1, 3, 5, 6]);
    expect(rankSizes('column', 10)).toEqual([3, 3, 3, 1]);
    expect(rankSizes('square', 25)).toEqual([5, 5, 5, 5, 5]);
    expect(rankSizes('double', 25)).toEqual([13, 12]);
    for (const formation of ['wedge', 'column', 'square'] as const) {
      const state = quietMatch(25);
      const me = place(commanderOf(state, 0), -70, 0, Math.PI / 2);
      applyCommand(state, 0, { type: 'formation', formation });
      run(state, 14);
      const ahead = livingSoldiers(state, state.armies[0]!).map((u) => u.pos.x - me.pos.x);
      // The whole formation stands in front of the commander.
      expect(Math.min(...ahead)).toBeGreaterThan(0.8);
    }
  });

  it('Advance moves a holding formation a few steps towards where the commander looks', () => {
    const state = quietMatch(15);
    const me = place(commanderOf(state, 0), -70, 0, Math.PI / 2);
    applyCommand(state, 0, { type: 'order', order: 'hold', group: null });
    run(state, 8);
    const before = armyCenter(state, state.armies[0]!)!;
    me.yaw = 0;
    expect(applyCommand(state, 0, { type: 'advance', group: null })).toBe(true);
    run(state, 6);
    const after = centroid(livingSoldiers(state, state.armies[0]!))!;
    expect(after.z - before.z).toBeGreaterThan(FORMATION.advanceStep - 1);
    applyCommand(state, 0, { type: 'order', order: 'attack', group: null });
    expect(applyCommand(state, 0, { type: 'advance', group: null })).toBe(false);
  });

  it('the next Hold remembers the chosen formation', () => {
    const state = quietMatch();
    applyCommand(state, 0, { type: 'formation', formation: 'circle' });
    applyCommand(state, 0, { type: 'order', order: 'follow', group: null });
    applyCommand(state, 0, { type: 'order', order: 'hold', group: null });
    expect(state.armies[0]?.groupOrders[0]?.formation).toBe('circle');
  });

  it('swordsmen carry the spear on Follow and Hold and draw the sword to Attack', () => {
    const state = quietMatch();
    applyCommand(state, 0, { type: 'order', order: 'attack', group: null });
    run(state, 0.1);
    expect(soldiersOf(state, 0).every((u) => u.weapon === 'sword')).toBe(true);
    applyCommand(state, 0, { type: 'order', order: 'follow', group: null });
    run(state, 0.1);
    expect(soldiersOf(state, 0).every((u) => u.weapon === 'spear')).toBe(true);
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
    const state = quietMatch(15, 'mixed');
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
