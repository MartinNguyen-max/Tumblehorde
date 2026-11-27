import type { ArenaFighter, FighterKit } from './arena.ts';
import { CAMPAIGN } from './config.ts';
import type { ChapterId } from './chapters.ts';
import type { CampaignGear, CampaignSave } from './save.ts';

/**
 * Gold, gear and strength between arena fights: Varro's shop, the workout and what each fight
 * pays. The player's kit in a fight follows from what they own and how strong they are.
 */

export type ShopItem = Exclude<keyof CampaignGear, 'dracoSword'>;
export const SHOP_ITEMS: readonly ShopItem[] = ['armor', 'shield', 'sword'];

export const KIT = {
  baseHp: 200,
  armorHp: 100,
  damagePerStrength: 0.08,
  swordDamage: 0.25,
  dracoSwordDamage: 0.4,
  /** Without a proper shield the borrowed one blocks only this much. */
  bareBlock: 0.55,
  shieldBlock: 1,
} as const;

export interface ArenaFight {
  chapter: ChapterId;
  reward: number;
  opponents: readonly ArenaFighter[];
  /** Winning gives Draco's sword. */
  givesDracoSword: boolean;
}

const POOR: FighterKit = { hp: 100, damage: 0.6, block: 0.5 };
const TRAINED: FighterKit = { hp: 170, damage: 0.9, block: 1 };
const DRACO: FighterKit = { hp: 420, damage: 1.2, block: 1.2 };

export const ARENA_FIGHTS: readonly ArenaFight[] = [
  {
    chapter: 'arena-1', reward: 25, givesDracoSword: false,
    opponents: [{ name: 'Old Brutus', kit: POOR }, { name: 'Skinny Paulus', kit: POOR }, { name: 'One-eyed Silo', kit: POOR }],
  },
  {
    chapter: 'arena-2', reward: 40, givesDracoSword: false,
    opponents: [{ name: 'Marcus the Bull', kit: TRAINED }, { name: 'Felicia the Quick', kit: TRAINED }, { name: 'Crixo', kit: TRAINED }],
  },
  {
    chapter: 'champion', reward: 60, givesDracoSword: true,
    opponents: [{ name: 'Draco the Undefeated', kit: DRACO }],
  },
];

export function arenaFight(chapter: ChapterId): ArenaFight | null {
  return ARENA_FIGHTS.find((f) => f.chapter === chapter) ?? null;
}

export function playerKit(save: CampaignSave): FighterKit {
  const swordBonus = save.gear.dracoSword ? KIT.dracoSwordDamage : save.gear.sword ? KIT.swordDamage : 0;
  return {
    hp: KIT.baseHp + (save.gear.armor ? KIT.armorHp : 0),
    damage: 1 + save.strength * KIT.damagePerStrength + swordBonus,
    block: save.gear.shield ? KIT.shieldBlock : KIT.bareBlock,
  };
}

export type BuyResult = { ok: true; save: CampaignSave } | { ok: false; reason: 'owned' | 'gold' };

export function buy(save: CampaignSave, item: ShopItem): BuyResult {
  if (save.gear[item]) return { ok: false, reason: 'owned' };
  const price = CAMPAIGN.prices[item];
  if (save.gold < price) return { ok: false, reason: 'gold' };
  return { ok: true, save: { ...save, gold: save.gold - price, gear: { ...save.gear, [item]: true } } };
}

export function canWorkOut(save: CampaignSave): boolean {
  return save.workouts < CAMPAIGN.maxWorkouts;
}

export function workedOut(save: CampaignSave): CampaignSave {
  if (!canWorkOut(save)) return save;
  return { ...save, workouts: save.workouts + 1, strength: save.strength + CAMPAIGN.strengthPerWorkout };
}

/** The purse and prizes for winning an arena fight. */
export function wonArena(save: CampaignSave, fight: ArenaFight): CampaignSave {
  return { ...save, gold: save.gold + fight.reward, gear: fight.givesDracoSword ? { ...save.gear, dracoSword: true } : save.gear };
}

/**
 * The workout: lift the stone by pressing left and right in turn, fast enough, before time runs
 * out. A wrong key (the same side twice) costs nothing but time.
 */
export const WORKOUT = {
  reps: 24,
  seconds: 8,
} as const;

export interface Workout {
  reps: number;
  timeLeft: number;
  last: 'left' | 'right' | null;
}

export function startWorkout(): Workout {
  return { reps: 0, timeLeft: WORKOUT.seconds, last: null };
}

export function workoutPress(w: Workout, side: 'left' | 'right'): Workout {
  if (w.timeLeft <= 0 || side === w.last) return w;
  return { ...w, reps: w.reps + 1, last: side };
}

export function workoutTick(w: Workout, dt: number): Workout {
  return { ...w, timeLeft: Math.max(0, w.timeLeft - dt) };
}

export type WorkoutResult = 'going' | 'done' | 'failed';

export function workoutResult(w: Workout): WorkoutResult {
  if (w.reps >= WORKOUT.reps) return 'done';
  return w.timeLeft > 0 ? 'going' : 'failed';
}
