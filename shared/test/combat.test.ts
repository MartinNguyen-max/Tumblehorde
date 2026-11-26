import { describe, expect, it } from 'vitest';
import { COMMANDER, SHIELD, SWORDSMAN } from '../src/config.ts';
import { applyHit, isBlockingFrom, resolveMelee, startMelee } from '../src/combat.ts';
import { progressActions, stepMatch, updateWeapons } from '../src/match.ts';
import { neutralInput } from '../src/input.ts';
import type { MatchState, Unit } from '../src/types.ts';
import { bodyMass } from '../src/units.ts';
import { commanderOf, firstOfKind, newMatch, place } from './helpers.ts';

function duel(): { state: MatchState; me: Unit; foe: Unit } {
  const state = newMatch();
  const me = place(commanderOf(state, 0), 0, 10, 0);
  const foe = place(firstOfKind(state, 1, 'swordsman'), 0, 11.5, Math.PI);
  return { state, me, foe };
}

function swing(state: MatchState, unit: Unit): void {
  expect(startMelee(state, unit)).toBe(true);
  unit.actionTimer = 0;
  progressActions(state, 0.001);
}

describe('melee', () => {
  it('deals sword damage to an enemy in front', () => {
    const { state, me, foe } = duel();
    swing(state, me);
    expect(foe.hp).toBe(foe.maxHp - COMMANDER.melee.damage);
    expect(state.events.some((e) => e.type === 'hit' && e.targetId === foe.id)).toBe(true);
  });

  it('misses enemies behind the attacker', () => {
    const { state, me, foe } = duel();
    me.yaw = Math.PI;
    swing(state, me);
    expect(foe.hp).toBe(foe.maxHp);
  });

  it('knocks back and stuns', () => {
    const { state, me, foe } = duel();
    swing(state, me);
    expect(foe.vel.z).toBeCloseTo(COMMANDER.melee.knockback.strength);
    expect(foe.stunTimer).toBeCloseTo(COMMANDER.melee.knockback.stun);
    expect(foe.vel.y).toBeGreaterThan(0);
  });

  it('respects the attack cooldown', () => {
    const { state, me } = duel();
    swing(state, me);
    expect(startMelee(state, me)).toBe(false);
  });

  it('kills at 0 HP and credits the killer', () => {
    const { state, me, foe } = duel();
    foe.hp = 10;
    swing(state, me);
    expect(foe.alive).toBe(false);
    expect(state.armies[0]?.stats.kills).toBe(1);
    expect(state.armies[1]?.stats.deaths).toBe(1);
    expect(state.events.some((e) => e.type === 'death' && e.unitId === foe.id)).toBe(true);
  });

  it('never hits teammates', () => {
    const state = newMatch();
    const me = place(commanderOf(state, 0), 0, 10, 0);
    const friend = place(firstOfKind(state, 0, 'swordsman'), 0, 11.5);
    swing(state, me);
    expect(friend.hp).toBe(friend.maxHp);
  });
});

describe('shield', () => {
  it('blocks 80 % of damage from the front', () => {
    const { state, me, foe } = duel();
    foe.shieldUp = true;
    swing(state, me);
    expect(foe.hp).toBeCloseTo(foe.maxHp - COMMANDER.melee.damage * (1 - SHIELD.blockFraction));
  });

  it('does not block from behind or the side', () => {
    const { foe } = duel();
    foe.shieldUp = true;
    expect(isBlockingFrom(foe, { x: 0, z: 10 })).toBe(true);
    expect(isBlockingFrom(foe, { x: 0, z: 13 })).toBe(false);
    expect(isBlockingFrom(foe, { x: 1.5, z: 11.5 })).toBe(false);
  });

  it('prevents attacking while raised', () => {
    const { state, me } = duel();
    me.intent = { ...me.intent, attack: true, shield: true };
    updateWeapons(state);
    expect(me.shieldUp).toBe(true);
    expect(me.action).toBe('none');
  });

  it('is raised from player input', () => {
    const { state, me } = duel();
    stepMatch(state, new Map([[0, { ...neutralInput(), shield: true }]]), 1 / 60);
    expect(me.shieldUp).toBe(true);
  });
});

describe('applyHit', () => {
  it('ignores invulnerable targets', () => {
    const { state, me, foe } = duel();
    foe.invulnerableTimer = 1;
    applyHit(state, foe, { attacker: me, armyId: 0, from: me.pos, pushDir: { x: 0, z: 1 } }, SWORDSMAN.melee.damage, SWORDSMAN.melee.knockback);
    expect(foe.hp).toBe(foe.maxHp);
  });

  it('cancels a windup when stunned', () => {
    const { state, me, foe } = duel();
    startMelee(state, foe);
    applyHit(state, foe, { attacker: me, armyId: 0, from: me.pos, pushDir: { x: 0, z: 1 } }, 1, SWORDSMAN.melee.knockback);
    expect(foe.action).toBe('none');
    resolveMelee(state, me);
  });
});

describe('held spears', () => {
  it('shove an attacker back even through his raised shield, but barely hurt', () => {
    const state = newMatch();
    const spearman = place(firstOfKind(state, 0, 'swordsman'), 0, 0, 0);
    spearman.weapon = 'spear';
    const foe = place(firstOfKind(state, 1, 'swordsman'), 0, 2, Math.PI);
    foe.shieldUp = true;
    resolveMelee(state, spearman);
    expect(foe.maxHp - foe.hp).toBeLessThan(SWORDSMAN.spear.damage);
    expect(foe.vel.z).toBeGreaterThan(SWORDSMAN.spear.knockback.strength * 0.9);
  });

  it('a braced shield is hard to push into', () => {
    const state = newMatch();
    const braced = place(firstOfKind(state, 0, 'swordsman'), 0, 0, 0);
    braced.shieldUp = true;
    expect(bodyMass(braced)).toBe(SHIELD.bracedMass);
  });
});
