/**
 * The campaign's chapters in story order (see docs/STORY.md). Every chapter start is a
 * checkpoint; a battle chapter restarts at its battle when lost.
 */

export type ChapterKind = 'cutscene' | 'freeRoam' | 'arena' | 'battle';

export type ChapterId =
  | 'prologue'
  | 'capital'
  | 'arena-1'
  | 'apprentice'
  | 'arena-2'
  | 'champion'
  | 'forge'
  | 'forest-road'
  | 'campfire'
  | 'burning-village'
  | 'emperor'
  | 'ruins'
  | 'bridge'
  | 'dark-forest'
  | 'varro'
  | 'outpost'
  | 'night-raid'
  | 'last-battle'
  | 'peace'
  | 'last-night'
  | 'the-end';

export interface Chapter {
  id: ChapterId;
  number: number;
  title: string;
  kind: ChapterKind;
  /** The player may skip it (the Champion). */
  optional: boolean;
  /** One line of story shown on the loading screen. */
  loadingLine: string;
}

export const CHAPTERS: readonly Chapter[] = [
  { id: 'prologue', number: 0, title: 'Prologue', kind: 'cutscene', optional: false, loadingLine: 'Before the fire, there were bells.' },
  { id: 'capital', number: 1, title: 'The Capital', kind: 'freeRoam', optional: false, loadingLine: 'A free man with nothing but his hands.' },
  { id: 'arena-1', number: 2, title: 'The Arena I', kind: 'arena', optional: false, loadingLine: 'The crowd does not know your name. Yet.' },
  { id: 'apprentice', number: 3, title: 'The Apprentice', kind: 'freeRoam', optional: false, loadingLine: 'Iron, sweat, and a gruff old smith.' },
  { id: 'arena-2', number: 4, title: 'The Arena II', kind: 'arena', optional: false, loadingLine: 'These men were trained to kill.' },
  { id: 'champion', number: 5, title: 'The Champion', kind: 'arena', optional: true, loadingLine: 'Draco has never lost. Not once.' },
  { id: 'forge', number: 6, title: 'The Forge at Night', kind: 'cutscene', optional: false, loadingLine: 'Some stories are only told by firelight.' },
  { id: 'forest-road', number: 7, title: 'The Forest Road', kind: 'battle', optional: false, loadingLine: 'The road north runs through bandit woods.' },
  { id: 'campfire', number: 8, title: 'The Campfire', kind: 'cutscene', optional: false, loadingLine: 'Wine, friends, and smoke on the horizon.' },
  { id: 'burning-village', number: 9, title: 'The Burning Village', kind: 'battle', optional: false, loadingLine: 'Dragon-headed boats on the river. Again.' },
  { id: 'emperor', number: 10, title: 'The Emperor', kind: 'cutscene', optional: false, loadingLine: 'The whole city is cheering your name.' },
  { id: 'ruins', number: 11, title: 'The Ruins', kind: 'cutscene', optional: false, loadingLine: 'The road north passes a place you know.' },
  { id: 'bridge', number: 12, title: 'The Bridge', kind: 'battle', optional: false, loadingLine: 'Hold the bridge until the last cart is over.' },
  { id: 'dark-forest', number: 13, title: 'The Dark Forest', kind: 'battle', optional: false, loadingLine: 'No moon tonight. Stay close.' },
  { id: 'varro', number: 14, title: 'Varro', kind: 'cutscene', optional: false, loadingLine: 'Not every wound can be bandaged.' },
  { id: 'outpost', number: 15, title: 'The Outpost', kind: 'battle', optional: false, loadingLine: 'Into the white north, where the lakes are stone.' },
  { id: 'night-raid', number: 16, title: 'The Night Raid', kind: 'battle', optional: false, loadingLine: 'Torches in the dark. Hold until dawn.' },
  { id: 'last-battle', number: 17, title: 'The Last Battle', kind: 'battle', optional: false, loadingLine: 'Hrolf the Red waits on the frozen field.' },
  { id: 'peace', number: 18, title: 'Peace', kind: 'cutscene', optional: false, loadingLine: 'Years pass like seasons in a window.' },
  { id: 'last-night', number: 19, title: 'The Last Night', kind: 'battle', optional: false, loadingLine: 'Tonight he dreamed of the monks.' },
  { id: 'the-end', number: 20, title: 'The End', kind: 'cutscene', optional: false, loadingLine: 'Dawn.' },
];

export function chapterById(id: ChapterId): Chapter {
  const chapter = CHAPTERS.find((c) => c.id === id);
  if (!chapter) throw new Error(`unknown chapter ${id}`);
  return chapter;
}

export function isChapterId(value: unknown): value is ChapterId {
  return typeof value === 'string' && CHAPTERS.some((c) => c.id === value);
}

/** The chapter after `id`, skipping optional chapters unless `takeOptional`; null after the last one. */
export function nextChapter(id: ChapterId, takeOptional = false): ChapterId | null {
  const index = CHAPTERS.findIndex((c) => c.id === id);
  for (let i = index + 1; i < CHAPTERS.length; i++) {
    const chapter = CHAPTERS[i];
    if (chapter && (takeOptional || !chapter.optional)) return chapter.id;
  }
  return null;
}

/** True when chapter `a` comes at or after chapter `b` in the story. */
export function isAtOrAfter(a: ChapterId, b: ChapterId): boolean {
  return chapterById(a).number >= chapterById(b).number;
}
