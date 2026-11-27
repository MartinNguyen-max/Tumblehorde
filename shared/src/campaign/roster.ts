import { CAMPAIGN } from './config.ts';
import { type ChapterId, isAtOrAfter } from './chapters.ts';

/**
 * Cassian's people: the named heroes and the 25 named legionaries the Emperor gives him.
 * Before the Dark Forest nobody on his side dies (they are knocked out); from then on the fallen
 * stay dead, survivors become veterans, and the fallen are read out at the campfire.
 */

export type HeroId = 'varro' | 'felix' | 'rufus' | 'eirik';

export interface Legionary {
  name: string;
  alive: boolean;
  /** Survived a battle where men could die: a little tougher. */
  veteran: boolean;
  /** Given by the fortress to fill the ranks before the last battle. */
  recruit: boolean;
}

export const LEGIONARY_NAMES: readonly string[] = [
  'Titus', 'Decimus', 'Gaius', 'Lucan', 'Quintus', 'Sextus', 'Aulus', 'Marius', 'Servius', 'Tiberius',
  'Flavius', 'Brutus', 'Cato', 'Drusus', 'Nero', 'Otho', 'Primus', 'Septimus', 'Octavian', 'Albus',
  'Crispus', 'Fabius', 'Gallus', 'Horatio', 'Junius',
];

export const RECRUIT_NAMES: readonly string[] = [
  'Pollio', 'Rusticus', 'Silvanus', 'Tullus', 'Varius', 'Celer', 'Dexter', 'Felicio', 'Laetus', 'Modestus',
];

export function createLegion(): Legionary[] {
  return LEGIONARY_NAMES.slice(0, CAMPAIGN.legionSize).map((name) => ({ name, alive: true, veteran: false, recruit: false }));
}

export function livingLegion(legion: readonly Legionary[]): Legionary[] {
  return legion.filter((l) => l.alive);
}

export function deathIsFinal(chapter: ChapterId): boolean {
  return isAtOrAfter(chapter, CAMPAIGN.permadeathFromChapter);
}

export interface BattleOutcome {
  legion: Legionary[];
  /** Names to read out at the campfire, in the order they fell. */
  fallen: string[];
}

/**
 * After a won battle in `chapter`: the men named in `fallenNames` die if death is final by
 * then, and every survivor of such a battle is a veteran. Earlier, everybody gets back up.
 */
export function afterBattle(legion: readonly Legionary[], fallenNames: readonly string[], chapter: ChapterId): BattleOutcome {
  if (!deathIsFinal(chapter)) return { legion: legion.map((l) => ({ ...l })), fallen: [] };
  const fallen = fallenNames.filter((name) => legion.some((l) => l.alive && l.name === name));
  const next = legion.map((l) => {
    if (!l.alive) return { ...l };
    if (fallen.includes(l.name)) return { ...l, alive: false };
    return { ...l, veteran: true };
  });
  return { legion: next, fallen };
}

/** The northern fortress fills the ranks with recruits up to the minimum, so the last battle is never hopeless. */
export function reinforceAtFortress(legion: readonly Legionary[]): Legionary[] {
  const next = legion.map((l) => ({ ...l }));
  const taken = new Set(legion.map((l) => l.name));
  const spare = RECRUIT_NAMES.filter((name) => !taken.has(name));
  let living = livingLegion(next).length;
  while (living < CAMPAIGN.fortressMinimumLegion) {
    const name = spare.shift() ?? `Recruit ${living + 1}`;
    next.push({ name, alive: true, veteran: false, recruit: true });
    living++;
  }
  return next;
}

/** When each hero joins Cassian (by chapter) and when the story takes them away. */
const HERO_SPAN: Record<HeroId, { from: ChapterId; until: ChapterId | null }> = {
  varro: { from: 'forest-road', until: 'varro' },
  felix: { from: 'forest-road', until: null },
  rufus: { from: 'forest-road', until: null },
  eirik: { from: 'emperor', until: null },
};

/**
 * The heroes who fight beside Cassian in `chapter`. Felix and Rufus are rescued during the Forest
 * Road, so they are counted from it; Eirik only if he was spared at the burning village.
 */
export function heroesIn(chapter: ChapterId, eirikSpared: boolean | null): HeroId[] {
  return (Object.keys(HERO_SPAN) as HeroId[]).filter((hero) => {
    const span = HERO_SPAN[hero];
    if (hero === 'eirik' && eirikSpared !== true) return false;
    if (!isAtOrAfter(chapter, span.from)) return false;
    return span.until === null || !isAtOrAfter(chapter, span.until);
  });
}
