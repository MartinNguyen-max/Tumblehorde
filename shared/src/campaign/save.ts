import { CAMPAIGN } from './config.ts';
import { type ChapterId, isChapterId } from './chapters.ts';
import { createLegion, type Legionary } from './roster.ts';

/**
 * Everything the campaign remembers between sessions. It is written at every checkpoint (each
 * chapter start and each battle) and read back with `parseSave`, which trusts nothing it reads.
 */

export type LastStand = 'tunnel' | 'courtyard';

export interface CampaignChoices {
  /** Spared Eirik at the burning village. Null: not asked yet. */
  eirikSpared: boolean | null;
  /** Spared Hrolf at the end of the last battle. */
  hrolfSpared: boolean | null;
  lastStand: LastStand | null;
}

export interface CampaignGear {
  armor: boolean;
  shield: boolean;
  sword: boolean;
  /** Draco's sword, won from the Champion. */
  dracoSword: boolean;
}

export interface CampaignSave {
  version: number;
  chapter: ChapterId;
  gold: number;
  /** Extra strength from workouts. */
  strength: number;
  workouts: number;
  gear: CampaignGear;
  choices: CampaignChoices;
  legion: Legionary[];
  /** Legionaries who fell in the last battle, read out at the next roll call. */
  fallen: string[];
  /** Livia's letters read so far. */
  letters: number;
  /** Wall-clock time of the save (ms since 1970), for the "Continue" button. */
  savedAt: number;
}

export function newSave(now: number): CampaignSave {
  return {
    version: CAMPAIGN.saveVersion,
    chapter: 'prologue',
    gold: 0,
    strength: 0,
    workouts: 0,
    gear: { armor: false, shield: false, sword: false, dracoSword: false },
    choices: { eirikSpared: null, hrolfSpared: null, lastStand: null },
    legion: createLegion(),
    fallen: [],
    letters: 0,
    savedAt: now,
  };
}

/** The same save at the start of `chapter`. */
export function checkpoint(save: CampaignSave, chapter: ChapterId, now: number): CampaignSave {
  return { ...save, chapter, savedAt: now };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isNullableBoolean(value: unknown): value is boolean | null {
  return value === null || typeof value === 'boolean';
}

function parseGear(value: unknown): CampaignGear | null {
  if (!isRecord(value)) return null;
  const { armor, shield, sword, dracoSword } = value;
  if (typeof armor !== 'boolean' || typeof shield !== 'boolean' || typeof sword !== 'boolean' || typeof dracoSword !== 'boolean') return null;
  return { armor, shield, sword, dracoSword };
}

function parseChoices(value: unknown): CampaignChoices | null {
  if (!isRecord(value)) return null;
  const { eirikSpared, hrolfSpared, lastStand } = value;
  if (!isNullableBoolean(eirikSpared) || !isNullableBoolean(hrolfSpared)) return null;
  if (lastStand !== null && lastStand !== 'tunnel' && lastStand !== 'courtyard') return null;
  return { eirikSpared, hrolfSpared, lastStand };
}

function parseLegionary(value: unknown): Legionary | null {
  if (!isRecord(value)) return null;
  const { name, alive, veteran, recruit } = value;
  if (typeof name !== 'string' || typeof alive !== 'boolean' || typeof veteran !== 'boolean' || typeof recruit !== 'boolean') return null;
  return { name, alive, veteran, recruit };
}

function parseLegion(value: unknown): Legionary[] | null {
  if (!Array.isArray(value)) return null;
  const legion: Legionary[] = [];
  for (const entry of value) {
    const legionary = parseLegionary(entry);
    if (!legionary) return null;
    legion.push(legionary);
  }
  return legion;
}

/** A save read back from storage, or null if it is missing, broken or from an older version. */
export function parseSave(value: unknown): CampaignSave | null {
  if (!isRecord(value) || value.version !== CAMPAIGN.saveVersion) return null;
  const { chapter, gold, strength, workouts, letters, savedAt } = value;
  if (!isChapterId(chapter)) return null;
  if (!isCount(gold) || !isCount(strength) || !isCount(workouts) || !isCount(letters)) return null;
  if (typeof savedAt !== 'number' || !Number.isFinite(savedAt)) return null;
  const gear = parseGear(value.gear);
  const choices = parseChoices(value.choices);
  const legion = parseLegion(value.legion);
  if (!gear || !choices || !legion) return null;
  const fallen = parseNames(value.fallen);
  if (!fallen) return null;
  return { version: CAMPAIGN.saveVersion, chapter, gold, strength, workouts, gear, choices, legion, fallen, letters, savedAt };
}

/** A list of names; saves from before the roll call was kept have none. */
function parseNames(value: unknown): string[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || !value.every((v): v is string => typeof v === 'string')) return null;
  return [...value];
}
