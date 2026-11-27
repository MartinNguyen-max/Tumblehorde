import type { ChapterId } from '@tumblehorde/shared';

/**
 * Which cutscenes each chapter plays: before its main part (for cutscene chapters, the whole
 * chapter) and after a won arena fight or battle. Ids refer to `CUTSCENES`.
 */

export const SCENES_BEFORE: Partial<Record<ChapterId, readonly string[]>> = {
  prologue: ['prologue-morning', 'prologue-raid', 'prologue-road', 'prologue-prison'],
  'arena-1': ['arena-tunnel'],
  forge: ['forge-night'],
  campfire: ['campfire'],
  emperor: ['emperor-street', 'emperor-hall'],
  ruins: ['ruins'],
  varro: ['varro-death', 'roll-call'],
  outpost: ['letter-one'],
  'last-battle': ['rally-speech'],
  peace: ['peace'],
  'last-night': ['last-night'],
  'the-end': ['the-end'],
};

export const SCENES_AFTER: Partial<Record<ChapterId, readonly string[]>> = {
  'arena-1': ['arena-won'],
  'forest-road': ['forest-road-after'],
  'burning-village': ['village-after'],
  bridge: ['roll-call'],
  outpost: ['roll-call'],
  'night-raid': ['roll-call', 'letter-two'],
  'last-battle': ['hrolf-mirror'],
};
