import { describe, expect, it } from 'vitest';
import { ALLIANCE, VOLLEY } from '../src/config.ts';
import { killUnit } from '../src/combat.ts';
import { neutralInput } from '../src/input.ts';
import { stepMatch } from '../src/match.ts';
import { applyCommand } from '../src/orders.ts';
import type { CommanderInput, MatchState } from '../src/types.ts';
import { areEnemies } from '../src/units.ts';
import { commanderOf, newMatch, place, soldiersOf } from './helpers.ts';

const DT = 1 / 30;

function twoPlayers(): MatchState {
  return newMatch({ armies: [{ name: 'A', team: 0, isBot: false }, { name: 'B', team: 1, isBot: false }] });
}

/** Commanders 6 m apart, facing each other. */
function faceOff(state: MatchState, a: number, b: number): void {
  place(commanderOf(state, a), 0, 0, Math.PI / 2);
  place(commanderOf(state, b), 6, 0, -Math.PI / 2);
}

/** Taps crouch `times` times for the army's player, keeping everyone else still. */
function crouchTaps(state: MatchState, armies: number[], times: number): void {
  for (let i = 0; i < times * 2; i++) {
    const input = (yaw: number): CommanderInput => ({ ...neutralInput(yaw), crouch: i % 2 === 0 });
    const inputs = new Map(armies.map((id) => [id, input(commanderOf(state, id).yaw)]));
    for (let t = 0; t < 0.15; t += DT) stepMatch(state, inputs, DT);
  }
}

describe('crouching', () => {
  it('slows a commander down to a creep', () => {
    const state = twoPlayers();
    const me = place(commanderOf(state, 0), -60, 0, 0);
    const walk = (crouch: boolean): number => {
      place(me, -60, 0, 0);
      for (let t = 0; t < 1; t += DT) stepMatch(state, new Map([[0, { ...neutralInput(0), moveZ: 1, crouch }]]), DT);
      return me.pos.z;
    };
    expect(walk(true)).toBeLessThan(walk(false) * 0.6);
  });
});

describe('alliances', () => {
  it('two commanders crouching at each other up close become allies', () => {
    const state = twoPlayers();
    faceOff(state, 0, 1);
    crouchTaps(state, [0], ALLIANCE.tapsNeeded);
    expect(state.armies[0]?.allyOffer?.to).toBe(1);
    expect(state.alliances).toHaveLength(0);
    faceOff(state, 0, 1);
    crouchTaps(state, [1], ALLIANCE.tapsNeeded);
    expect(state.alliances).toEqual([[1, 0]]);
    expect(areEnemies(state, soldiersOf(state, 0)[0]!, soldiersOf(state, 1)[0]!)).toBe(false);
  });

  it('needs the two to look at each other', () => {
    const state = twoPlayers();
    faceOff(state, 0, 1);
    crouchTaps(state, [0], ALLIANCE.tapsNeeded);
    commanderOf(state, 1).yaw = Math.PI / 2;
    place(commanderOf(state, 1), 6, 0, Math.PI / 2);
    crouchTaps(state, [1], ALLIANCE.tapsNeeded);
    expect(state.alliances).toHaveLength(0);
  });

  it('ends the battle when only allies are left standing', () => {
    const state = newMatch({ armies: [0, 1, 2].map((i) => ({ name: `P${i}`, team: i, isBot: false })) });
    state.alliances.push([0, 1]);
    for (const id of [state.armies[2]!.commanderId!, ...state.armies[2]!.soldierIds]) killUnit(state, state.units[id]!, 0, { x: 0, y: 0, z: 0 });
    stepMatch(state, new Map(), DT);
    expect(state.phase).toBe('ending');
  });
});

describe('the spear volley', () => {
  it('throws every spear at the enemies where the commander looks, once per battle', () => {
    const state = twoPlayers();
    place(commanderOf(state, 0), -10, 0, Math.PI / 2);
    const mine = soldiersOf(state, 0);
    mine.forEach((s, i) => place(s, -8, -5 + i * 0.9, Math.PI / 2));
    const foes = soldiersOf(state, 1).slice(0, 4);
    foes.forEach((f, i) => place(f, 10, i * 1.5, -Math.PI / 2));
    const at = { x: 10, y: 0, z: 2 };
    expect(applyCommand(state, 0, { type: 'volley', at, group: null })).toBe(true);
    expect(applyCommand(state, 0, { type: 'volley', at, group: null })).toBe(false);
    let thrown = 0;
    for (let t = 0; t < 3; t += DT) {
      stepMatch(state, new Map([[0, neutralInput(Math.PI / 2)]]), DT);
      thrown += state.events.filter((e) => e.type === 'arrowFired').length;
    }
    expect(thrown).toBe(mine.length);
    expect(foes.some((f) => f.hp < f.maxHp)).toBe(true);
    expect(mine.every((s) => s.spearThrown && s.weapon === 'sword')).toBe(true);
    // Without spears they hold with swords from now on.
    applyCommand(state, 0, { type: 'order', order: 'hold', group: null });
    stepMatch(state, new Map([[0, neutralInput()]]), DT);
    expect(mine.every((s) => s.weapon === 'sword')).toBe(true);
  });

  it('only throws at what is in range', () => {
    const state = twoPlayers();
    place(commanderOf(state, 0), -60, 0);
    for (const s of soldiersOf(state, 0)) place(s, -60, 0);
    expect(applyCommand(state, 0, { type: 'volley', at: { x: -60 + VOLLEY.range + 20, y: 0, z: 0 }, group: null })).toBe(false);
    expect(state.armies[0]?.spearsThrown).toBe(false);
  });
});
