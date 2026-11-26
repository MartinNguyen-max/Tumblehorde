import { describe, expect, it } from 'vitest';
import { COMMANDER, MATCH, SHIELD, SWORDSMAN } from '../src/config.ts';
import { applyHit, killUnit, startMelee } from '../src/combat.ts';
import { chooseStance } from '../src/bot.ts';
import { neutralInput } from '../src/input.ts';
import { progressActions, stepMatch } from '../src/match.ts';
import { distanceXZ } from '../src/math.ts';
import { applyCommand } from '../src/orders.ts';
import { meleeStatsFor, rangedStatsFor, canUseShield } from '../src/units.ts';
import { commanderOf, firstOfKind, newMatch, place } from './helpers.ts';

const DT = 1 / 30;
const ZERO = { x: 0, y: 0, z: 0 };

describe('commander kit', () => {
  it('starts the battle on horseback', () => {
    const state = newMatch({}, { commanderHorses: true });
    const me = commanderOf(state, 0);
    expect(me.mountId).not.toBeNull();
    expect(state.units[me.mountId!]?.kind).toBe('horse');
  });

  it('switches between sword, spear and bow', () => {
    const state = newMatch();
    const me = commanderOf(state, 0);
    expect(me.weapon).toBe('sword');
    expect(applyCommand(state, 0, { type: 'weapon', weapon: 'spear' })).toBe(true);
    expect(meleeStatsFor(me)).toBe(COMMANDER.spear);
    applyCommand(state, 0, { type: 'weapon', weapon: 'bow' });
    expect(rangedStatsFor(me)).toBe(COMMANDER.bow);
    expect(meleeStatsFor(me)).toBeNull();
    expect(canUseShield(me)).toBe(false);
  });

  it('can raise the shield on horseback', () => {
    const state = newMatch({}, { commanderHorses: true });
    const me = commanderOf(state, 0);
    expect(me.mountId).not.toBeNull();
    stepMatch(state, new Map([[0, { ...neutralInput(), shield: true }]]), DT);
    expect(me.shieldUp).toBe(true);
  });

  it('shoots an arrow where the player aims', () => {
    const state = newMatch();
    const me = place(commanderOf(state, 0), 0, 0, 0);
    const foe = place(firstOfKind(state, 1, 'swordsman'), 0, 20, Math.PI);
    applyCommand(state, 0, { type: 'weapon', weapon: 'bow' });
    me.cooldownTimer = 0;
    for (let t = 0; t < 2; t += DT) {
      place(foe, 0, 20, Math.PI);
      const aim = { x: foe.pos.x, y: foe.pos.y + 1.1, z: foe.pos.z };
      stepMatch(state, new Map([[0, { ...neutralInput(), attack: t < 0.5, aim }]]), DT);
    }
    expect(foe.hp).toBeLessThan(foe.maxHp);
  });

  it('patches themselves up out of combat', () => {
    const state = newMatch();
    const me = place(commanderOf(state, 0), 0, 0);
    me.hp = 100;
    me.sinceHurt = 0;
    for (let t = 0; t < COMMANDER.regenDelay + 2; t += DT) stepMatch(state, new Map([[0, neutralInput()]]), DT);
    expect(me.hp).toBeGreaterThan(100);
  });

  it('gets back up where they fell and shoves enemies away', () => {
    const state = newMatch();
    const me = place(commanderOf(state, 0), 10, 10);
    const foe = place(firstOfKind(state, 1, 'swordsman'), 11.5, 10);
    killUnit(state, me, 1, ZERO);
    for (let t = 0; t < COMMANDER.respawnTime + 0.2; t += DT) {
      if (!me.alive) place(foe, 11.5, 10);
      stepMatch(state, new Map(), DT);
    }
    expect(me.alive).toBe(true);
    expect(distanceXZ(me.pos, { x: 10, z: 10 })).toBeLessThan(1.5);
    expect(foe.stunTimer).toBeGreaterThan(0);
  });
});

describe('shields', () => {
  it('stop most of a blow and are never stunned by it', () => {
    const state = newMatch();
    const me = place(commanderOf(state, 0), 0, 10, 0);
    const foe = place(firstOfKind(state, 1, 'swordsman'), 0, 11.5, Math.PI);
    foe.shieldUp = true;
    applyHit(state, foe, { attacker: me, armyId: 0, from: me.pos, pushDir: { x: 0, z: 1 } }, 100, SWORDSMAN.melee.knockback);
    expect(foe.hp).toBeCloseTo(foe.maxHp - 100 * (1 - SHIELD.blockFraction));
    expect(foe.stunTimer).toBe(0);
  });
});

describe('free horses', () => {
  it('can be struck', () => {
    const state = newMatch();
    const me = place(commanderOf(state, 0), 0, 10, 0);
    const rider = firstOfKind(state, 1, 'rider');
    const horse = state.units[rider.mountId!]!;
    killUnit(state, rider, 0, ZERO);
    place(horse, 0, 11.8);
    startMelee(state, me);
    me.actionTimer = 0;
    progressActions(state, 0.001);
    expect(horse.hp).toBeLessThan(horse.maxHp);
  });
});

describe('bot strategy', () => {
  it('forms up before marching, holds in a standoff, then engages', () => {
    const state = newMatch();
    const army = state.armies[1]!;
    expect(chooseStance(state, army, 100, 10, 10)).toBe('form');
    state.time = MATCH.prepareTime + 1;
    expect(chooseStance(state, army, 100, 10, 10)).toBe('march');
    expect(chooseStance(state, army, 50, 10, 10)).toBe('standoff');
    expect(chooseStance(state, army, 20, 10, 10)).toBe('engage');
    expect(chooseStance(state, army, 30, 3, 10)).toBe('regroup');
  });

  it('does not rush in at the start', () => {
    const state = newMatch({ armies: [{ name: 'A', team: 0, isBot: true }, { name: 'B', team: 1, isBot: true }] });
    for (let t = 0; t < MATCH.prepareTime - 0.5; t += DT) stepMatch(state, new Map(), DT);
    expect(state.armies.reduce((n, a) => n + a.stats.deaths, 0)).toBe(0);
    expect(state.armies.every((a) => a.groupOrders.every((g) => g.order === 'hold'))).toBe(true);
  });
});
