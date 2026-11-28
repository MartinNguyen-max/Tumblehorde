import type { ChapterId } from '@tumblehorde/shared';

/**
 * Which cutscenes each chapter plays: before its main part (for cutscene chapters, the whole
 * chapter) and after a won arena fight or battle. Ids refer to `CUTSCENES`.
 */

export const SCENES_BEFORE: Partial<Record<ChapterId, readonly string[]>> = {
  prologue: ['prologue-morning', 'prologue-raid', 'prologue-road', 'prologue-prison'],
  'arena-1': ['arena-tunnel'],
  forge: ['forge-night'],
  'forest-road': ['forest-road-walk'],
  'burning-village': ['village-approach'],
  campfire: ['campfire'],
  emperor: ['emperor-street', 'emperor-hall', 'livia-evening'],
  ruins: ['ruins'],
  bridge: ['bridge-orders'],
  'dark-forest': ['ambush'],
  'night-raid': ['camp-night'],
  varro: ['varro-death', 'varro-memory', 'roll-call'],
  outpost: ['letter-one', 'outpost-scout'],
  'last-battle': ['rally-speech'],
  feast: ['victory-feast', 'capital-falls'],
  'march-south': ['camp-south'],
  'open-field': ['riders-come'],
  'the-gate': ['gate-arrive'],
  'new-life': ['rebuilding', 'two-boys'],
  'last-patrol': ['patrol-road'],
  'two-sons': ['mourning', 'the-crowning', 'marcus-path', 'lucius-path'],
  spring: ['spring'],
  'the-spy': ['the-spy'],
  'into-greece': ['into-greece', 'the-sewers'],
  'greek-feast': ['greek-feast-surround'],
  'the-end': ['home-in-chains'],
};

export const SCENES_AFTER: Partial<Record<ChapterId, readonly string[]>> = {
  'arena-1': ['arena-won'],
  'forest-road': ['forest-road-after'],
  'burning-village': ['village-after'],
  bridge: ['bridge-after'],
  'night-raid': ['dawn-relief', 'letter-two'],
  'last-battle': ['hrolf-mirror'],
  'open-field': ['hrolf-farewell'],
  'the-gate': ['livia-found'],
  'last-patrol': ['cassian-falls', 'heaven'],
  brothers: ['brothers-end'],
};
