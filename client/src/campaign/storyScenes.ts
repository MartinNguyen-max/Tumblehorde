import type { ChapterId } from '@tumblehorde/shared';

/**
 * Which cutscenes each chapter plays: before its main part (for cutscene chapters, the whole
 * chapter) and after a won arena fight or battle. Ids refer to `CUTSCENES`.
 */

export const SCENES_BEFORE: Partial<Record<ChapterId, readonly string[]>> = {
  prologue: ['prologue-morning'],
  'arena-1': ['arena-tunnel'],
};

export const SCENES_AFTER: Partial<Record<ChapterId, readonly string[]>> = {
  'arena-1': ['arena-won'],
};
