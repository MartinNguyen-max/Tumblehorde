import { describe, expect, it } from 'vitest';
import { BOT, COMMANDER, HORSE, MATCH, SHIELD, SWORDSMAN } from '../src/config.ts';
import { applyHit, killUnit, startMelee } from '../src/combat.ts';
import { chooseStance } from '../src/bot.ts';
import { neutralInput } from '../src/input.ts';
import { progressActions, stepMatch } from '../src/match.ts';
import { distanceXZ } from '../src/math.ts';
import { applyCommand, centroid } from '../src/orders.ts';
import { separateBodies } from '../src/physics.ts';
import { meleeStatsFor, canUseShield } from '../src/units.ts';
import { terrainHeightAt } from '../src/terrain.ts';
import { commanderOf, firstOfKind, newMatch, place, soldiersOf } from './helpers.ts';

const DT = 1 / 30;
const ZERO = { x: 0, y: 0, z: 0 };

describe('commander kit', () => {
  it('starts the battle on horseback', () => {
    const state = newMatch({}, { commanderHorses: true });
    const me = commanderOf(state, 0);
    expect(me.mountId).not.toBeNull();
    expect(state.units[me.mountId!]?.kind).toBe('horse');
  });

  it('switches between sword and spear; the bow is parked for now', () => {
    const state = newMatch();
    const me = commanderOf(state, 0);
    expect(me.weapon).toBe('sword');
    expect(applyCommand(state, 0, { type: 'weapon', weapon: 'spear' })).toBe(true);
    expect(meleeStatsFor(me)).toBe(COMMANDER.spear);
    expect(applyCommand(state, 0, { type: 'weapon', weapon: 'bow' })).toBe(false);
    expect(me.weapon).toBe('spear');
    expect(canUseShield(me)).toBe(true);
  });

  it('can raise the shield on horseback', () => {
    const state = newMatch({}, { commanderHorses: true });
    const me = commanderOf(state, 0);
    expect(me.mountId).not.toBeNull();
    stepMatch(state, new Map([[0, { ...neutralInput(), shield: true }]]), DT);
    expect(me.shieldUp).toBe(true);
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
    const state = newMatch({ mix: 'mixed' });
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
    expect(chooseStance(state, army, BOT.marchDistance - 5, 10, 10)).toBe('standoff');
    expect(chooseStance(state, army, BOT.engageDistance - 5, 10, 10)).toBe('engage');
    expect(chooseStance(state, army, BOT.marchDistance - 5, 3, 10)).toBe('regroup');
  });

  it('marches on without its commander, in formation and with spears', () => {
    const state = newMatch();
    const army = state.armies[1]!;
    const botCommander = commanderOf(state, 1);
    botCommander.alive = false;
    botCommander.respawnTimer = Infinity;
    const enemyStart = soldiersOf(state, 1).map((u) => u.pos.x);
    const before = centroid(soldiersOf(state, 1))!;
    for (let t = 0; t < MATCH.prepareTime + 6; t += DT) stepMatch(state, new Map([[0, neutralInput()]]), DT);
    const after = centroid(soldiersOf(state, 1))!;
    const me = commanderOf(state, 0);
    expect(distanceXZ(after, me.pos)).toBeLessThan(distanceXZ(before, me.pos) - 15);
    expect(army.groupOrders[0]?.order).toBe('hold');
    expect(soldiersOf(state, 1).every((u) => u.weapon === 'spear')).toBe(true);
    expect(enemyStart).toHaveLength(army.soldierIds.length);
  });

  it('does not rush in at the start', () => {
    const state = newMatch({ armies: [{ name: 'A', team: 0, isBot: true }, { name: 'B', team: 1, isBot: true }] });
    for (let t = 0; t < MATCH.prepareTime - 0.5; t += DT) stepMatch(state, new Map(), DT);
    expect(state.armies.reduce((n, a) => n + a.stats.deaths, 0)).toBe(0);
    expect(state.armies.every((a) => a.groupOrders.every((g) => g.order === 'hold'))).toBe(true);
  });
});

describe('a commander on horseback', () => {
  it('charges through a locked shield wall and knocks the soldiers flat', () => {
    const state = newMatch({ armySize: 15 }, { commanderHorses: true });
    const me = commanderOf(state, 0);
    const horse = state.units[me.mountId!]!;
    const [a, b] = soldiersOf(state, 1);
    place(a!, 0, 10, Math.PI);
    place(b!, 1, 10, Math.PI);
    a!.shieldUp = true;
    b!.shieldUp = true;
    place(horse, 0, 9, 0);
    horse.vel = { x: 0, y: 0, z: HORSE.speed };
    separateBodies(state);
    expect(a!.stunTimer).toBeGreaterThanOrEqual(HORSE.commanderCharge.stun - 1e-6);
    expect(a!.hp).toBeLessThan(a!.maxHp);
    expect(a!.vel.z).toBeGreaterThan(0);
  });
});

describe('knocked-out commander', () => {
  it('slides with the blow and gets back up where the body landed', () => {
    const state = newMatch();
    const me = place(commanderOf(state, 0), 0, 0);
    killUnit(state, me, 1, { x: 14, y: 6, z: 0 });
    for (let t = 0; t < COMMANDER.respawnTime + 0.2; t += DT) stepMatch(state, new Map(), DT);
    expect(me.alive).toBe(true);
    expect(me.pos.x).toBeGreaterThan(2);
    expect(me.pos.y).toBeCloseTo(terrainHeightAt('meadow', me.pos.x, me.pos.z), 1);
  });
});
