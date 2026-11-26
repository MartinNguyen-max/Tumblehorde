import { describe, expect, it } from 'vitest';
import { BODY, HORSE, RIDER } from '../src/config.ts';
import { killUnit, resolveMelee } from '../src/combat.ts';
import { neutralInput } from '../src/input.ts';
import { stepMatch } from '../src/match.ts';
import { dismount, mount, syncRiderToHorse, toggleMount } from '../src/mounts.ts';
import { meleeStatsFor } from '../src/units.ts';
import { commanderOf, firstOfKind, horseOf, newMatch, place } from './helpers.ts';

const ZERO = { x: 0, y: 0, z: 0 };

describe('mounting', () => {
  it('lets the commander climb onto a free horse and off again', () => {
    const state = newMatch();
    const rider = firstOfKind(state, 0, 'rider');
    const horse = horseOf(state, rider);
    dismount(state, rider);
    const me = place(commanderOf(state, 0), horse.pos.x + 1, horse.pos.z);
    expect(toggleMount(state, me)).toBe(true);
    expect(me.mountId).toBe(horse.id);
    expect(me.pos.y).toBeCloseTo(horse.pos.y + BODY.saddleHeight);
    expect(toggleMount(state, me)).toBe(true);
    expect(me.mountId).toBeNull();
    expect(horse.riderId).toBeNull();
  });

  it('refuses a horse that already has a rider', () => {
    const state = newMatch();
    const rider = firstOfKind(state, 1, 'rider');
    const horse = horseOf(state, rider);
    const me = place(commanderOf(state, 0), horse.pos.x + 1, horse.pos.z);
    expect(mount(state, me, horse)).toBe(false);
  });

  it('gives riders the long spear while mounted', () => {
    const state = newMatch();
    const rider = firstOfKind(state, 0, 'rider');
    expect(meleeStatsFor(rider)).toBe(RIDER.mountedMelee);
    dismount(state, rider);
    expect(meleeStatsFor(rider)).toBe(RIDER.melee);
  });

  it('carries the rider at horse speed', () => {
    const state = newMatch();
    const me = commanderOf(state, 0);
    const rider = firstOfKind(state, 0, 'rider');
    const horse = horseOf(state, rider);
    dismount(state, rider);
    place(horse, 0, -20, 0);
    place(me, 1, -20);
    mount(state, me, horse);
    const inputs = new Map([[0, { ...neutralInput(), moveZ: 1 }]]);
    for (let i = 0; i < 120; i++) stepMatch(state, inputs, 1 / 60);
    const start = horse.pos.z;
    for (let i = 0; i < 60; i++) stepMatch(state, inputs, 1 / 60);
    expect(horse.pos.z - start).toBeCloseTo(HORSE.speed, 0);
    expect(me.pos.z).toBeCloseTo(horse.pos.z);
  });
});

describe('horse death', () => {
  it('throws the rider off and stuns them', () => {
    const state = newMatch();
    const rider = firstOfKind(state, 0, 'rider');
    const horse = horseOf(state, rider);
    killUnit(state, horse, 1, ZERO);
    expect(rider.alive).toBe(true);
    expect(rider.mountId).toBeNull();
    expect(rider.stunTimer).toBeCloseTo(HORSE.fallStun);
    expect(rider.vel.y).toBeGreaterThan(0);
    expect(state.events.some((e) => e.type === 'dismount' && e.thrown)).toBe(true);
  });

  it('frees the horse when its rider dies', () => {
    const state = newMatch();
    const rider = firstOfKind(state, 0, 'rider');
    const horse = horseOf(state, rider);
    killUnit(state, rider, 1, ZERO);
    expect(horse.riderId).toBeNull();
    expect(horse.alive).toBe(true);
  });
});

describe('cavalry', () => {
  it('tramples enemies it runs into', () => {
    const state = newMatch();
    const rider = firstOfKind(state, 0, 'rider');
    const horse = horseOf(state, rider);
    const victim = place(firstOfKind(state, 1, 'swordsman'), 0, 1.0);
    place(horse, 0, 0, 0);
    horse.vel = { x: 0, y: 0, z: HORSE.speed };
    state.armies[0]!.isBot = false;
    stepMatch(state, new Map(), 1 / 60);
    expect(victim.stunTimer).toBeGreaterThan(1);
    expect(victim.hp).toBe(victim.maxHp - HORSE.trampleDamage);
    expect(state.events.some((e) => e.type === 'trample')).toBe(true);
  });

  it('strikes with the spear from horseback', () => {
    const state = newMatch();
    const rider = firstOfKind(state, 0, 'rider');
    const horse = horseOf(state, rider);
    place(horse, 0, 0, 0);
    rider.pos = { ...horse.pos, y: horse.pos.y + BODY.saddleHeight };
    rider.yaw = 0;
    const victim = place(firstOfKind(state, 1, 'swordsman'), 0.3, 2.5);
    resolveMelee(state, rider);
    expect(victim.hp).toBe(victim.maxHp - RIDER.mountedMelee.damage);
    expect(victim.stunTimer).toBeCloseTo(RIDER.mountedMelee.knockback.stun);
  });
});

describe('stolen horses', () => {
  it('keep their army but fight for their new rider', async () => {
    const { teamOf } = await import('../src/units.ts');
    const { fireArrow, stepArrows } = await import('../src/arrows.ts');
    const state = newMatch();
    const enemyRider = firstOfKind(state, 1, 'rider');
    const horse = horseOf(state, enemyRider);
    dismount(state, enemyRider);
    enemyRider.alive = false;
    const me = place(commanderOf(state, 0), horse.pos.x + 1, horse.pos.z);
    expect(mount(state, me, horse)).toBe(true);
    expect(horse.armyId).toBe(1);
    expect(teamOf(state, horse)).toBe(state.armies[0]!.team);
    place(horse, 0, 10, Math.PI / 2);
    syncRiderToHorse(me, horse);
    const enemyArcher = place(firstOfKind(state, 1, 'archer'), 0, 0, 0);
    fireArrow(state, enemyArcher, me);
    for (let i = 0; i < 200 && state.arrows.length > 0; i++) stepArrows(state, 1 / 60);
    expect(horse.hp < horse.maxHp || me.hp < me.maxHp).toBe(true);
  });
});
