// Takes gameplay pictures of every fight and every walk through the city, for promotion: a few
// candidates per chapter (the form-up, the clash, mid-fight), with the HUD and without it.
// Usage (with a build served on 5300): npx tsx tools/screenshot-fights.ts [outDir] [first-chapter]
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { CHAPTERS } from '../shared/src/campaign/chapters.ts';
import { openGame, stillName } from './promo.ts';

const URL = process.env.GAME_URL ?? 'http://localhost:5300/?debug';
const WIDTH = 1920;
const HEIGHT = 1080;
/** Seconds skipped past the form-up, then between the candidates: the first clash, the thick of it. */
const FORM_UP = 12;
const MOMENTS = [6, 8] as const;
const outDir = resolve(process.argv[2] ?? 'promo/candidates');
const startAt = process.argv[3] ?? null;
mkdirSync(outDir, { recursive: true });

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const game = await openGame(URL, WIDTH, HEIGHT);
await game.run(`(() => {
  const style = document.createElement('style');
  style.textContent = '#sound-toggle, #sound-hint, .cine-skip { display: none !important; } body { cursor: none; }' +
    ' body.clean *:not(canvas) { visibility: hidden !important; } body.clean canvas { visibility: visible !important; }';
  document.head.appendChild(style);
  const t = window.tumblehorde;
  t.chapter('prologue');
  t.campaign.stop();
  const c = t.campaign;
  window.__setSon = (son) => { c.save = { ...c.save, choices: { ...c.save.choices, eirikSpared: true, hrolfSpared: true, son } }; };
  return true;
})()`);

async function shoot(file: string): Promise<void> {
  const shot = await game.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(outDir, file), Buffer.from(shot.result?.data ?? '', 'base64'));
  await game.run(`(() => { document.body.classList.add('clean'); return true; })()`);
  await sleep(300);
  const clean = await game.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(outDir, file.replace('.png', ' (clean).png')), Buffer.from(clean.result?.data ?? '', 'base64'));
  await game.run(`(() => { document.body.classList.remove('clean'); return true; })()`);
}

const playable = CHAPTERS.filter((c) => c.kind === 'battle' || c.kind === 'arena' || c.kind === 'freeRoam');
const from = startAt ? playable.findIndex((c) => c.id === startAt) : 0;
for (const chapter of playable.slice(from)) {
  const fight = chapter.kind !== 'freeRoam';
  console.log(chapter.id);
  // Into the chapter: past its card and its scenes, to the fight or the walk.
  const phase = await game.run<string>(`(async () => {
    window.__setSon('lucius');
    const t = window.tumblehorde;
    t.chapter(${JSON.stringify(chapter.id)});
    window.__setSon('lucius');
    const c = t.campaign;
    for (let i = 0; i < 600; i++) {
      const p = c.phase;
      if (p.kind === 'battle' || p.kind === 'roam') break;
      if (p.kind === 'loading') p.until = 0;
      if (p.kind === 'cutscene') c.player.update(1, true);
      document.querySelector('.cine-choices button')?.click();
      document.querySelector('.cine-letter.on .cine-letter-done')?.click();
      await new Promise((r) => setTimeout(r, 100));
    }
    t.unpause();
    return c.phase.kind;
  })()`);
  if (phase !== 'battle' && phase !== 'roam') {
    console.log(`  skipped: ${phase}`);
    continue;
  }
  await sleep(2500);
  if (fight) {
    // The armies formed up; then everyone forward, so the next pictures show the fight itself.
    await shoot(stillName(chapter.id, 'fight start'));
    await game.run(`(() => { const t = window.tumblehorde; t.fastForward(${FORM_UP}); t.command({ type: 'order', order: 'attack', group: null }); return true; })()`);
    for (const [i, seconds] of MOMENTS.entries()) {
      await game.run(`(() => { window.tumblehorde.fastForward(${seconds}); return true; })()`);
      await sleep(1500);
      await shoot(stillName(chapter.id, `fight ${i + 1}`));
    }
  } else {
    await shoot(stillName(chapter.id, 'walk'));
    await game.run(`(() => { window.tumblehorde.campaign.phase.roam.yaw += Math.PI; return true; })()`);
    await sleep(1500);
    await shoot(stillName(chapter.id, 'walk back'));
  }
  await game.run('(() => { window.tumblehorde.campaign.stop(); return true; })()');
  await sleep(800);
}
game.close();
process.exit(0);
