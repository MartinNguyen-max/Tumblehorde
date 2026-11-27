import { describe, expect, it } from 'vitest';
import {
  arenaFight,
  buy,
  CAMPAIGN,
  canWorkOut,
  KIT,
  newSave,
  playerKit,
  SHOP_ITEMS,
  startWorkout,
  WORKOUT,
  workedOut,
  workoutPress,
  workoutResult,
  workoutTick,
  wonArena,
} from '../src/campaign/index.ts';

describe('shop', () => {
  it('sells only the silver armor and helmet, once, for gold', () => {
    expect(SHOP_ITEMS).toEqual(['armor']);
    const poor = newSave(0);
    expect(buy(poor, 'armor')).toEqual({ ok: false, reason: 'gold' });
    const rich = { ...poor, gold: 50 };
    const bought = buy(rich, 'armor');
    if (!bought.ok) throw new Error('should buy');
    expect(bought.save.gold).toBe(50 - CAMPAIGN.prices.armor);
    expect(bought.save.gear.armor).toBe(true);
    expect(buy(bought.save, 'armor')).toEqual({ ok: false, reason: 'owned' });
  });

  it('armor and strength make the fighter tougher', () => {
    const bare = playerKit(newSave(0));
    const geared = playerKit({ ...newSave(0), strength: 3, gear: { armor: true, shield: false, sword: false, dracoSword: false } });
    expect(geared.hp).toBe(bare.hp + KIT.armorHp);
    expect(geared.damage).toBeGreaterThan(bare.damage);
  });
});

describe('workout', () => {
  it('counts alternating presses and can be done three times at most', () => {
    let w = startWorkout();
    w = workoutPress(w, 'left');
    w = workoutPress(w, 'left');
    expect(w.reps).toBe(1);
    for (let i = 0; i < WORKOUT.reps; i++) w = workoutPress(w, i % 2 === 0 ? 'right' : 'left');
    expect(workoutResult(w)).toBe('done');
    expect(workoutResult(workoutTick(startWorkout(), WORKOUT.seconds))).toBe('failed');
    let save = newSave(0);
    for (let i = 0; i < 5; i++) save = workedOut(save);
    expect(save.workouts).toBe(CAMPAIGN.maxWorkouts);
    expect(save.strength).toBe(CAMPAIGN.maxWorkouts * CAMPAIGN.strengthPerWorkout);
    expect(canWorkOut(save)).toBe(false);
  });
});

describe('arena purses', () => {
  it('pay 25 and then 40 gold; the second fight has Draco, and he and Cassian are the strongest', () => {
    let save = newSave(0);
    for (const chapter of ['arena-1', 'arena-2'] as const) save = wonArena(save, arenaFight(chapter)!);
    expect(save.gold).toBe(65);
    expect(arenaFight('bridge')).toBeNull();
    const second = arenaFight('arena-2')!;
    const draco = second.opponents.find((o) => o.name.startsWith('Draco'))!;
    expect(draco).toBeDefined();
    const others = second.opponents.filter((o) => o !== draco);
    const armored = playerKit({ ...newSave(0), gear: { armor: true, shield: false, sword: false, dracoSword: false } });
    for (const o of others) {
      expect(o.kit.hp * o.kit.damage).toBeLessThan(draco.kit.hp * draco.kit.damage);
      expect(o.kit.hp * o.kit.damage).toBeLessThan(armored.hp * armored.damage);
    }
  });
});
