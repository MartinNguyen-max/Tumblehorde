import { describe, expect, it } from 'vitest';
import {
  arenaFight,
  buy,
  CAMPAIGN,
  canWorkOut,
  KIT,
  newSave,
  playerKit,
  startWorkout,
  WORKOUT,
  workedOut,
  workoutPress,
  workoutResult,
  workoutTick,
  wonArena,
} from '../src/campaign/index.ts';

describe('shop', () => {
  it('sells each item once, for gold', () => {
    const poor = newSave(0);
    expect(buy(poor, 'sword')).toEqual({ ok: false, reason: 'gold' });
    const rich = { ...poor, gold: 50 };
    const bought = buy(rich, 'sword');
    if (!bought.ok) throw new Error('should buy');
    expect(bought.save.gold).toBe(50 - CAMPAIGN.prices.sword);
    expect(bought.save.gear.sword).toBe(true);
    expect(buy(bought.save, 'sword')).toEqual({ ok: false, reason: 'owned' });
  });

  it('gear and strength make the fighter tougher', () => {
    const bare = playerKit(newSave(0));
    const geared = playerKit({ ...newSave(0), strength: 3, gear: { armor: true, shield: true, sword: true, dracoSword: false } });
    expect(geared.hp).toBe(bare.hp + KIT.armorHp);
    expect(geared.damage).toBeGreaterThan(bare.damage);
    expect(geared.block).toBeGreaterThan(bare.block);
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
  it('pay 25, 40 and 60 gold, and the champion gives his sword', () => {
    let save = newSave(0);
    for (const chapter of ['arena-1', 'arena-2', 'champion'] as const) save = wonArena(save, arenaFight(chapter)!);
    expect(save.gold).toBe(125);
    expect(save.gear.dracoSword).toBe(true);
    expect(arenaFight('bridge')).toBeNull();
  });
});
