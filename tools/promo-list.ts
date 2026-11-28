// Writes docs/PROMO.md: every video and gameplay picture of the promotional series, in story order,
// with the exact file names in promo/videos/. Usage: npx tsx tools/promo-list.ts
import { writeFileSync } from 'node:fs';
import { bookLabel, bookOf, CHAPTERS } from '../shared/src/campaign/chapters.ts';
import { episodeName, stillName, takes } from './promo.ts';

interface Entry {
  file: string;
  kind: 'Video' | 'Screenshot';
  book: string;
  what: string;
}

/** "capital-falls" → "Capital falls". */
function words(id: string): string {
  const s = id.replace(/-/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const entries: Entry[] = takes().map((take, i) => ({
  file: episodeName(take, i + 1),
  kind: 'Video',
  book: bookLabel(bookOf(take.chapter)),
  what: `${words(take.id)}${take.suffix}`,
}));
for (const chapter of CHAPTERS) {
  if (chapter.kind === 'cutscene') continue;
  const what = chapter.kind === 'freeRoam' ? 'walk' : 'fight';
  const label = chapter.kind === 'freeRoam' ? `Walking the city: ${chapter.title}` : `The fight: ${chapter.title}`;
  entries.push({ file: stillName(chapter.id, what), kind: 'Screenshot', book: bookLabel(bookOf(chapter.id)), what: label });
}
entries.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));

const videos = entries.filter((e) => e.kind === 'Video').length;
const shots = entries.length - videos;
const lines = [
  '# Promotional series',
  '',
  `Every scene of the story as its own video, with a gameplay screenshot of each fight and each walk through the city in between, in story order: ${videos} videos and ${shots} screenshots (each screenshot in two versions). The files are in \`promo/videos/\` (not in git) and sort in this order by name.`,
  '',
  'Videos: MP4, 1920×1080, 30 fps, with the game\'s music, voices and subtitles. Screenshots: PNG, 1920×1080; each comes with the HUD and without it ("clean").',
  '',
  'Made with `tools/record-scenes.ts` and `tools/screenshot-fights.ts`; this list with `tools/promo-list.ts`.',
  '',
];
let book = '';
let n = 0;
for (const e of entries) {
  if (e.book !== book) {
    book = e.book;
    lines.push(`## ${book}`, '', '| # | Type | What | File |', '|---|---|---|---|');
  }
  n++;
  const files = e.kind === 'Screenshot' ? `\`${e.file}\`<br>\`${e.file.replace('.png', ' (clean).png')}\`` : `\`${e.file}\``;
  lines.push(`| ${n} | ${e.kind} | ${e.what} | ${files} |`);
  const next = entries[entries.indexOf(e) + 1];
  if (!next || next.book !== book) lines.push('');
}
writeFileSync('docs/PROMO.md', lines.join('\n'));
console.log(`docs/PROMO.md: ${videos} videos, ${shots} screenshots`);
