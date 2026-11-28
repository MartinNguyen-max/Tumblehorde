// Records every cutscene of the story as its own video, in story order, for promotion.
// Usage (with the dev server on 5199): npx tsx tools/record-scenes.ts [outDir] [first-scene-id]
// Chrome renders on the GPU through Vulkan and captures its own tab (picture, subtitles and sound)
// with MediaRecorder, so nothing beyond Chrome is needed. Choices are picked, letters closed.
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { bookOf, CHAPTERS, chapterLabel, type ChapterId } from '../shared/src/campaign/chapters.ts';
import { SCENES_AFTER, SCENES_BEFORE } from '../client/src/campaign/storyScenes.ts';

const URL = process.env.GAME_URL ?? 'http://localhost:5199/?debug';
const WIDTH = Number(process.env.WIDTH ?? 1920);
const HEIGHT = Number(process.env.HEIGHT ?? 1080);
const BITRATE = 10_000_000;
/** A scene never runs longer than this; a stuck one is cut and noted. */
const SCENE_LIMIT_MS = 6 * 60_000;
/** Seconds a choice or a letter stays on screen before the recorder picks or closes it. */
const READ_TIME = 4;
const CHUNK = 4 * 1024 * 1024;

const outDir = resolve(process.argv[2] ?? 'promo/videos');
const startAt = process.argv[3] ?? null;
/** Stop after this many takes (for trying the recorder out). */
const MAX = Number(process.env.MAX ?? Infinity);
mkdirSync(outDir, { recursive: true });

interface Take {
  id: string;
  chapter: ChapterId;
  son: 'lucius' | 'marcus';
  suffix: string;
}

/** Every scene in the order the story plays them; the two paths of the sons get one take each. */
function takes(): Take[] {
  const list: Take[] = [];
  for (const chapter of CHAPTERS) {
    const ids = [...(SCENES_BEFORE[chapter.id] ?? []), ...(chapter.id === 'arena-2' ? ['arena-victory'] : []), ...(SCENES_AFTER[chapter.id] ?? [])];
    for (const id of ids) {
      if (id === 'marcus-path') list.push({ id, chapter: chapter.id, son: 'marcus', suffix: '' });
      else if (id === 'brothers-end') {
        list.push({ id, chapter: chapter.id, son: 'lucius', suffix: ' (Lucius wins)' });
        list.push({ id, chapter: chapter.id, son: 'marcus', suffix: ' (Marcus wins)' });
      } else list.push({ id, chapter: chapter.id, son: 'lucius', suffix: '' });
    }
  }
  return list;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const port = 9900 + Math.floor(Math.random() * 90);
const profile = join(process.env.REC_PROFILE ?? '/tmp', `tumblehorde-rec-${port}`);
const chrome = spawn(process.env.CHROME ?? 'google-chrome', [
  '--headless=new', '--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=vulkan', '--enable-features=Vulkan',
  '--auto-accept-this-tab-capture', '--autoplay-policy=no-user-gesture-required',
  `--window-size=${WIDTH},${HEIGHT}`, `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' });

let socketUrl: string | undefined;
for (let i = 0; i < 60 && !socketUrl; i++) {
  await sleep(250);
  try {
    const pages = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()) as { type: string; webSocketDebuggerUrl: string }[];
    socketUrl = pages.find((p) => p.type === 'page')?.webSocketDebuggerUrl;
  } catch { /* not up yet */ }
}
if (!socketUrl) throw new Error('Chrome did not start');
const ws = new WebSocket(socketUrl);
await new Promise((r) => ws.addEventListener('open', r));
let nextId = 0;
const pending = new Map<number, (m: { result?: { result?: { value?: unknown }; exceptionDetails?: unknown } }) => void>();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(String(e.data)) as { id?: number; method?: string; params?: { exceptionDetails?: unknown } };
  if (m.id !== undefined && pending.has(m.id)) {
    pending.get(m.id)?.(m as never);
    pending.delete(m.id);
  } else if (m.method === 'Runtime.exceptionThrown') console.log('page exception', JSON.stringify(m.params?.exceptionDetails).slice(0, 300));
});
function send(method: string, params: object = {}): Promise<{ result?: { result?: { value?: unknown }; exceptionDetails?: unknown } }> {
  return new Promise((r) => {
    const id = ++nextId;
    pending.set(id, r);
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function run<T>(expression: string): Promise<T> {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
  if (r.result?.exceptionDetails) throw new Error(`${expression.slice(0, 80)}: ${JSON.stringify(r.result.exceptionDetails).slice(0, 400)}`);
  return r.result?.result?.value as T;
}

await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: URL });
for (let i = 0; i < 120; i++) {
  await sleep(500);
  if (await run<boolean>('typeof window.tumblehorde === "object"')) break;
}
// A clean picture: no sound button, no hints, no skip meter; sound on; one capture of the tab.
await run(`(() => {
  const style = document.createElement('style');
  style.textContent = '#sound-toggle, #sound-hint, .cine-skip { display: none !important; } body { cursor: none; }';
  document.head.appendChild(style);
  document.getElementById('sound-toggle')?.click();
  return true;
})()`);
await run(`navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30, width: ${WIDTH}, height: ${HEIGHT} }, audio: true, preferCurrentTab: true }).then((s) => { window.__stream = s; return s.getTracks().length; })`);
// The story the scenes see: everyone spared, the chosen son set per take.
await run(`(() => {
  const t = window.tumblehorde;
  t.chapter('prologue');
  t.campaign.stop();
  const c = t.campaign;
  c.leave = () => { window.__sceneDone = true; };
  window.__setSon = (son) => { c.save = { ...c.save, choices: { ...c.save.choices, eirikSpared: true, hrolfSpared: true, son } }; };
  // Picks the first choice and closes letters once they have been on screen for a while.
  setInterval(() => {
    for (const sel of ['.cine-choices button', '.cine-letter.on .cine-letter-done']) {
      const b = document.querySelector(sel);
      if (!b || b.offsetParent === null) { delete b?.dataset?.seen; continue; }
      const seen = Number(b.dataset.seen || 0) + 1;
      b.dataset.seen = String(seen);
      if (seen >= ${READ_TIME * 2}) b.click();
    }
  }, 500);
  return true;
})()`);

const all = takes();
const from = startAt ? all.findIndex((t) => t.id === startAt) : 0;
let n = 0;
for (const [index, take] of all.entries()) {
  n = index + 1;
  if (index < from) continue;
  if (index - from >= MAX) break;
  const book = bookOf(take.chapter);
  const name = `E${String(n).padStart(2, '0')} - ${chapterLabel(take.chapter).replace(' · ', ' - ')} - ${CHAPTERS.find((c) => c.id === take.chapter)?.title ?? ''} - ${take.id}${take.suffix}.mp4`;
  console.log(`${name}  (${book.title})`);
  await run(`(() => {
    window.__sceneDone = false;
    window.__setSon(${JSON.stringify(take.son)});
    window.__chunks = [];
    const rec = new MediaRecorder(window.__stream, { mimeType: 'video/mp4', videoBitsPerSecond: ${BITRATE} });
    rec.ondataavailable = (e) => { if (e.data.size > 0) window.__chunks.push(e.data); };
    window.__rec = rec;
    rec.start(1000);
    return window.tumblehorde.cutscene(${JSON.stringify(take.id)});
  })()`);
  const started = Date.now();
  while (!(await run<boolean>('window.__sceneDone')) && Date.now() - started < SCENE_LIMIT_MS) await sleep(200);
  if (Date.now() - started >= SCENE_LIMIT_MS) console.log('  cut: scene ran too long');
  // Hold the last (black) frame a moment, then stop.
  await sleep(600);
  const size = await run<number>(`new Promise((done) => { const rec = window.__rec; rec.onstop = () => { window.__blob = new Blob(window.__chunks, { type: 'video/mp4' }); done(window.__blob.size); }; rec.stop(); })`);
  const parts: Buffer[] = [];
  for (let at = 0; at < size; at += CHUNK) {
    const b64 = await run<string>(`window.__blob.slice(${at}, ${at + CHUNK}).arrayBuffer().then((a) => { let s = ''; const u = new Uint8Array(a); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); })`);
    parts.push(Buffer.from(b64, 'base64'));
  }
  writeFileSync(join(outDir, name), Buffer.concat(parts));
  console.log(`  ${((Date.now() - started) / 1000).toFixed(0)} s, ${(size / 1e6).toFixed(1)} MB`);
  await run('(() => { window.tumblehorde.campaign.stop(); return true; })()');
  await sleep(500);
}

ws.close();
chrome.kill();
rmSync(profile, { recursive: true, force: true });
process.exit(0);
