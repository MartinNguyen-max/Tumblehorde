import { describe, expect, it } from 'vitest';
import {
  afterBattle,
  CAMPAIGN,
  CHAPTERS,
  chapterById,
  checkpoint,
  createLegion,
  heroesIn,
  isAtOrAfter,
  livingLegion,
  newSave,
  nextChapter,
  parseSave,
  reinforceAtFortress,
} from '../src/campaign/index.ts';

describe('chapters', () => {
  it('are numbered from 0 in story order with unique ids', () => {
    expect(CHAPTERS.map((c) => c.number)).toEqual(CHAPTERS.map((_, i) => i));
    expect(new Set(CHAPTERS.map((c) => c.id)).size).toBe(CHAPTERS.length);
  });

  it('go from the second arena fight straight to the forge, and end after the last', () => {
    expect(nextChapter('arena-2')).toBe('forge');
    expect(nextChapter('the-end')).toBe('new-capital');
    expect(nextChapter('new-capital')).toBeNull();
  });

  it('compare by story order', () => {
    expect(isAtOrAfter('bridge', 'capital')).toBe(true);
    expect(isAtOrAfter('capital', 'bridge')).toBe(false);
    expect(chapterById('varro').kind).toBe('cutscene');
  });
});

describe('legion', () => {
  it('has 25 named men', () => {
    const legion = createLegion();
    expect(legion).toHaveLength(CAMPAIGN.legionSize);
    expect(new Set(legion.map((l) => l.name)).size).toBe(CAMPAIGN.legionSize);
  });

  it('gets back up after battles before the Dark Forest', () => {
    const { legion, fallen } = afterBattle(createLegion(), ['Titus', 'Gaius'], 'bridge');
    expect(livingLegion(legion)).toHaveLength(CAMPAIGN.legionSize);
    expect(fallen).toEqual([]);
    expect(legion.some((l) => l.veteran)).toBe(false);
  });

  it('loses the fallen for good from the Dark Forest on; survivors become veterans', () => {
    const { legion, fallen } = afterBattle(createLegion(), ['Titus', 'Gaius', 'Nobody'], 'dark-forest');
    expect(fallen).toEqual(['Titus', 'Gaius']);
    expect(livingLegion(legion)).toHaveLength(CAMPAIGN.legionSize - 2);
    expect(livingLegion(legion).every((l) => l.veteran)).toBe(true);
    const again = afterBattle(legion, ['Titus'], 'outpost');
    expect(again.fallen).toEqual([]);
  });

  it('is topped up to ten at the fortress, never cut', () => {
    const names = createLegion().map((l) => l.name);
    const { legion } = afterBattle(createLegion(), names.slice(0, 22), 'night-raid');
    const reinforced = reinforceAtFortress(legion);
    expect(livingLegion(reinforced)).toHaveLength(CAMPAIGN.fortressMinimumLegion);
    expect(reinforced.filter((l) => l.recruit)).toHaveLength(CAMPAIGN.fortressMinimumLegion - 3);
    expect(livingLegion(reinforceAtFortress(createLegion()))).toHaveLength(CAMPAIGN.legionSize);
  });
});

describe('heroes', () => {
  it('join and leave with the story', () => {
    expect(heroesIn('capital', null)).toEqual([]);
    expect(heroesIn('forest-road', null)).toEqual(['varro', 'felix', 'rufus']);
    expect(heroesIn('bridge', true)).toEqual(['varro', 'felix', 'rufus', 'eirik']);
    expect(heroesIn('outpost', false)).toEqual(['felix', 'rufus']);
    expect(heroesIn('brothers', true)).toEqual(['felix', 'rufus', 'eirik']);
  });
});

describe('books', () => {
  it('splits the story into four books, numbering chapters within each', async () => {
    const { bookOf, chapterInBook, chapterLabel, opensBook, BOOKS } = await import('../src/campaign/chapters.ts');
    expect(BOOKS).toHaveLength(4);
    expect(chapterLabel('prologue')).toBe('Book I · Prologue');
    expect(chapterLabel('capital')).toBe('Book I · Chapter 1');
    expect(chapterLabel('forest-road')).toBe('Book II · Chapter 1');
    expect(bookOf('last-battle').number).toBe(2);
    expect(bookOf('feast').number).toBe(3);
    expect(chapterInBook('the-end')).toBe(9);
    expect(opensBook('golden-city')).toBe(true);
    expect(opensBook('bridge')).toBe(false);
    // Every chapter is in exactly one book, numbered from 1 (0 for the prologue).
    for (const c of CHAPTERS) expect(chapterInBook(c.id)).toBeGreaterThanOrEqual(c.id === 'prologue' ? 0 : 1);
  });
});

describe('save', () => {
  it('survives a round trip through JSON', () => {
    const save = checkpoint({ ...newSave(1000), gold: 65, strength: 2, workouts: 2 }, 'apprentice', 2000);
    save.choices.eirikSpared = true;
    expect(parseSave(JSON.parse(JSON.stringify(save)))).toEqual(save);
  });

  it('rejects broken or foreign data', () => {
    const good = JSON.parse(JSON.stringify(newSave(0))) as Record<string, unknown>;
    expect(parseSave(null)).toBeNull();
    expect(parseSave('save')).toBeNull();
    expect(parseSave({ ...good, version: 0 })).toBeNull();
    expect(parseSave({ ...good, chapter: 'mars' })).toBeNull();
    expect(parseSave({ ...good, gold: -5 })).toBeNull();
    expect(parseSave({ ...good, gold: 1.5 })).toBeNull();
    expect(parseSave({ ...good, legion: [{ name: 'Titus' }] })).toBeNull();
    expect(parseSave({ ...good, choices: { eirikSpared: 'yes', hrolfSpared: null, son: null } })).toBeNull();
    expect(parseSave({ ...good, choices: { eirikSpared: null, hrolfSpared: null, son: 'titus' } })).toBeNull();
  });

  it('reads saves from before the sons: no son chosen yet', () => {
    const good = JSON.parse(JSON.stringify(newSave(0))) as Record<string, unknown>;
    const old = parseSave({ ...good, choices: { eirikSpared: true, hrolfSpared: false, lastStand: 'tunnel' } });
    expect(old?.choices).toEqual({ eirikSpared: true, hrolfSpared: false, son: null });
  });
});

describe('save of the fallen', () => {
  it('keeps the last battle\'s fallen for the roll call, and reads older saves without them', () => {
    const save = { ...newSave(0), fallen: ['Titus', 'Gaius'] };
    expect(parseSave(JSON.parse(JSON.stringify(save)))?.fallen).toEqual(['Titus', 'Gaius']);
    const older = JSON.parse(JSON.stringify(newSave(0))) as Record<string, unknown>;
    delete older.fallen;
    expect(parseSave(older)?.fallen).toEqual([]);
    expect(parseSave({ ...older, fallen: [3] })).toBeNull();
  });
});
