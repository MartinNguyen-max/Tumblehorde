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
  | 'the-duel'
  | 'feast'
  | 'march-south'
  | 'open-field'
  | 'the-gate'
  | 'new-life'
  | 'last-patrol'
  | 'two-sons'
  | 'brothers'
  | 'spring'
  | 'golden-city'
  | 'the-spy'
  | 'border-fort'
  | 'into-greece'
  | 'sewers'
  | 'greek-feast'
  | 'the-risen'
  | 'the-ship'
  | 'the-end'
  | 'new-capital';

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
  { id: 'forge', number: 5, title: 'The Forge at Night', kind: 'cutscene', optional: false, loadingLine: 'Some stories are only told by firelight.' },
  { id: 'forest-road', number: 6, title: 'The Forest Road', kind: 'battle', optional: false, loadingLine: 'The road north runs through bandit woods.' },
  { id: 'campfire', number: 7, title: 'The Campfire', kind: 'cutscene', optional: false, loadingLine: 'Wine, friends, and smoke on the horizon.' },
  { id: 'burning-village', number: 8, title: 'The Burning Village', kind: 'battle', optional: false, loadingLine: 'Dragon-headed boats on the river. Again.' },
  { id: 'emperor', number: 9, title: 'The Emperor', kind: 'cutscene', optional: false, loadingLine: 'The whole city is cheering your name.' },
  { id: 'ruins', number: 10, title: 'The Ruins', kind: 'cutscene', optional: false, loadingLine: 'The road north passes a place you know.' },
  { id: 'bridge', number: 11, title: 'The Bridge', kind: 'battle', optional: false, loadingLine: 'Hold the bridge until the last cart is over.' },
  { id: 'dark-forest', number: 12, title: 'The Dark Forest', kind: 'battle', optional: false, loadingLine: 'No moon tonight. Stay close.' },
  { id: 'varro', number: 13, title: 'Varro', kind: 'cutscene', optional: false, loadingLine: 'Not every wound can be bandaged.' },
  { id: 'outpost', number: 14, title: 'The Outpost', kind: 'battle', optional: false, loadingLine: 'Into the white north, where the lakes are stone.' },
  { id: 'night-raid', number: 15, title: 'The Night Raid', kind: 'battle', optional: false, loadingLine: 'Torches in the dark. Hold until dawn.' },
  { id: 'last-battle', number: 16, title: 'The Last Battle', kind: 'battle', optional: false, loadingLine: 'Hrolf the Red waits on the frozen field.' },
  { id: 'the-duel', number: 17, title: 'The Red-Haired Man', kind: 'battle', optional: false, loadingLine: 'Twenty years. One man. Nobody interferes.' },
  { id: 'feast', number: 18, title: 'The Feast', kind: 'cutscene', optional: false, loadingLine: 'Wine, songs, and a rider covered in dust.' },
  { id: 'march-south', number: 19, title: 'The March South', kind: 'cutscene', optional: false, loadingLine: 'Home is burning. Every day counts.' },
  { id: 'open-field', number: 20, title: 'The Open Field', kind: 'battle', optional: false, loadingLine: 'They ride like the wind, and they never stop.' },
  { id: 'the-gate', number: 21, title: 'The Gate', kind: 'battle', optional: false, loadingLine: 'Alone, through the streets he once walked free.' },
  { id: 'new-life', number: 22, title: 'A New Life', kind: 'cutscene', optional: false, loadingLine: 'Years pass like seasons in a window.' },
  { id: 'last-patrol', number: 23, title: 'The Last Patrol', kind: 'battle', optional: false, loadingLine: 'An old soldier, a cart of grain, a quiet road.' },
  { id: 'two-sons', number: 24, title: 'Two Sons', kind: 'cutscene', optional: false, loadingLine: 'One crown. Two brothers.' },
  { id: 'brothers', number: 25, title: 'Brothers', kind: 'battle', optional: false, loadingLine: 'The dead march with the elder.' },
  { id: 'spring', number: 26, title: 'Spring', kind: 'cutscene', optional: false, loadingLine: 'Every spring, a new ribbon.' },
  { id: 'golden-city', number: 27, title: 'The Golden City', kind: 'freeRoam', optional: false, loadingLine: 'Peace. Wine. Music. And one man who does not belong.' },
  { id: 'the-spy', number: 28, title: 'The Spy', kind: 'cutscene', optional: false, loadingLine: 'He will not say where he comes from. Yet.' },
  { id: 'border-fort', number: 29, title: 'The Border Fort', kind: 'battle', optional: false, loadingLine: 'Ladders, a ram, and a gate that has never fallen.' },
  { id: 'into-greece', number: 30, title: 'Into Greece', kind: 'cutscene', optional: false, loadingLine: 'Three peoples, one road, and the sewers of a city of marble.' },
  { id: 'sewers', number: 31, title: 'The Sewers', kind: 'battle', optional: false, loadingLine: 'Dark, narrow, and full of Greeks.' },
  { id: 'greek-feast', number: 32, title: 'The Feast of the Greeks', kind: 'battle', optional: false, loadingLine: 'They are drunk. They are many. They will not break.' },
  { id: 'the-risen', number: 33, title: 'The Risen', kind: 'battle', optional: false, loadingLine: 'The dead do not stay down while he lives.' },
  { id: 'the-ship', number: 34, title: 'The Ship', kind: 'battle', optional: false, loadingLine: 'Two against one, on a deck slick with the sea.' },
  { id: 'the-end', number: 35, title: 'Homecoming', kind: 'cutscene', optional: false, loadingLine: 'Fewer came home than left.' },
  { id: 'new-capital', number: 36, title: 'The New Capital', kind: 'freeRoam', optional: false, loadingLine: 'The walls are higher now. Walk them as long as you like.' },
];

/**
 * The story is told in four books; a book starts at its `first` chapter and runs to the next
 * book's. Chapters are numbered within their book (a book's prologue counts as 0).
 */
export interface Book {
  number: number;
  title: string;
  first: ChapterId;
}

export const BOOKS: readonly Book[] = [
  { number: 1, title: 'The Monk', first: 'prologue' },
  { number: 2, title: 'The Legion', first: 'forest-road' },
  { number: 3, title: 'Fire from the East', first: 'feast' },
  { number: 4, title: 'The Last Road', first: 'golden-city' },
];

const ROMAN_NUMERALS = ['', 'I', 'II', 'III', 'IV', 'V'] as const;

export function bookOf(id: ChapterId): Book {
  const n = chapterById(id).number;
  let found = BOOKS[0] as Book;
  for (const book of BOOKS) if (n >= chapterById(book.first).number) found = book;
  return found;
}

/** The chapter's number within its book: the first chapter of the first book (the prologue) is 0. */
export function chapterInBook(id: ChapterId): number {
  const book = bookOf(id);
  const offset = book.number === 1 ? 0 : 1;
  return chapterById(id).number - chapterById(book.first).number + offset;
}

/** True for the first chapter of a book, where the book's title is shown. */
export function opensBook(id: ChapterId): boolean {
  return BOOKS.some((b) => b.first === id);
}

/** "Book II · Chapter 3", or "Book I · Prologue". */
export function chapterLabel(id: ChapterId): string {
  const book = bookOf(id);
  const n = chapterInBook(id);
  return `Book ${ROMAN_NUMERALS[book.number] ?? book.number} · ${n === 0 ? 'Prologue' : `Chapter ${n}`}`;
}

/** "Book II: The Legion". */
export function bookLabel(book: Book): string {
  return `Book ${ROMAN_NUMERALS[book.number] ?? book.number}: ${book.title}`;
}

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
