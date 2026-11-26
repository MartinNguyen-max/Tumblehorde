import { describe, expect, it } from 'vitest';
import { BANQUET, RALLY, SWORDSMAN } from '../src/config.ts';
import { applyHit } from '../src/combat.ts';
import { neutralInput } from '../src/input.ts';
import { stepMatch } from '../src/match.ts';
import { distanceXZ } from '../src/math.ts';
import { applyCommand, livingSoldiers } from '../src/orders.ts';
import type { MatchState } from '../src/types.ts';
import { commanderOf, newMatch, place, soldiersOf } from './helpers.ts';

const DT = 1 / 30;

function run(state: MatchState, seconds: number): void {
  const inputs = new Map([[0, neutralInput()]]);
  for (let t = 0; t < seconds; t += DT) stepMatch(state, inputs, DT);
}

function quietMatch(): MatchState {
  return newMatch({ armies: [{ name: 'You', team: 0, isBot: false }, { name: 'Far', team: 1, isBot: false }] });
}

describe('banquet', () => {
  it('gathers the army round the commander, then leaves everyone drunk', () => {
    const state = quietMatch();
    const me = place(commanderOf(state, 0), -70, 0);
    expect(applyCommand(state, 0, { type: 'banquet' })).toBe(true);
    expect(state.armies[0]?.banquet).toBe('feasting');
    run(state, BANQUET.feastTime - 0.5);
    for (const s of livingSoldiers(state, state.armies[0]!)) expect(distanceXZ(s.pos, me.pos)).toBeLessThan(6);
    expect(soldiersOf(state, 0).some((s) => s.drunk)).toBe(false);
    run(state, 1);
    expect(state.armies[0]?.banquet).toBe('drunk');
    expect(soldiersOf(state, 0).every((s) => s.drunk)).toBe(true);
    expect(state.armies[1]?.banquet).toBe('ready');
  });

  it('happens once per battle', () => {
    const state = quietMatch();
    applyCommand(state, 0, { type: 'banquet' });
    run(state, BANQUET.feastTime + 0.5);
    expect(applyCommand(state, 0, { type: 'banquet' })).toBe(false);
  });

  it('ends early when an order comes, and the army is drunk anyway', () => {
    const state = quietMatch();
    applyCommand(state, 0, { type: 'banquet' });
    run(state, 1);
    applyCommand(state, 0, { type: 'order', order: 'attack', group: null });
    expect(state.armies[0]?.banquet).toBe('drunk');
    expect(soldiersOf(state, 0).every((s) => s.drunk)).toBe(true);
  });

  it('makes soldiers hard to hurt and hard-hitting', () => {
    const state = quietMatch();
    const [sober, drunk] = soldiersOf(state, 1);
    drunk!.drunk = true;
    const source = { attacker: null, armyId: 0, from: { x: 0, z: 0 }, pushDir: { x: 1, z: 0 } };
    applyHit(state, sober!, source, 50, SWORDSMAN.melee.knockback);
    applyHit(state, drunk!, source, 50, SWORDSMAN.melee.knockback);
    expect(drunk!.maxHp - drunk!.hp).toBeCloseTo((sober!.maxHp - sober!.hp) * BANQUET.damageTakenFactor);
    expect(Math.abs(drunk!.vel.x)).toBeLessThan(Math.abs(sober!.vel.x));
  });

  it('shoves through a locked shield wall', () => {
    const state = quietMatch();
    const attacker = place(soldiersOf(state, 0)[0]!, 0, 0, 0);
    const [a, b] = soldiersOf(state, 1);
    place(a!, 0, 1.5, Math.PI);
    place(b!, 1, 1.5, Math.PI);
    a!.shieldUp = true;
    b!.shieldUp = true;
    const source = { attacker, armyId: 0, from: attacker.pos, pushDir: { x: 0, z: 1 } };
    applyHit(state, a!, source, 20, SWORDSMAN.melee.knockback);
    expect(a!.vel.z).toBe(0);
    attacker.drunk = true;
    applyHit(state, a!, source, 20, SWORDSMAN.melee.knockback);
    expect(a!.vel.z).toBeGreaterThan(0);
  });

  it('sends running drunks sprawling now and then', () => {
    const state = quietMatch();
    for (const s of soldiersOf(state, 0)) s.drunk = true;
    applyCommand(state, 0, { type: 'order', order: 'attack', group: null });
    let stumbles = 0;
    const inputs = new Map([[0, neutralInput()]]);
    for (let t = 0; t < 15; t += DT) {
      stepMatch(state, inputs, DT);
      stumbles += state.events.filter((e) => e.type === 'stumble').length;
    }
    expect(stumbles).toBeGreaterThan(0);
  });
});

describe('rally', () => {
  it('lets the commander rouse the army, with a pause between speeches', () => {
    const state = quietMatch();
    expect(applyCommand(state, 0, { type: 'rally' })).toBe(true);
    expect(state.events.some((e) => e.type === 'rally' && e.armyId === 0)).toBe(true);
    expect(applyCommand(state, 0, { type: 'rally' })).toBe(false);
    run(state, RALLY.cooldown + 0.1);
    expect(applyCommand(state, 0, { type: 'rally' })).toBe(true);
  });
});
