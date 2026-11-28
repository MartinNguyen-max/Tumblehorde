// What the promotional tools share: the story's takes in order, their file names, and a Chrome
// on the GPU driven over the DevTools protocol.
import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { CHAPTERS, chapterLabel, type ChapterId } from '../shared/src/campaign/chapters.ts';
import { SCENES_AFTER, SCENES_BEFORE } from '../client/src/campaign/storyScenes.ts';

export interface Take {
  id: string;
  chapter: ChapterId;
  son: 'lucius' | 'marcus';
  suffix: string;
}

/** The scenes of a chapter that play before its fight (or make up the whole chapter). */
function before(id: ChapterId): readonly string[] {
  return SCENES_BEFORE[id] ?? [];
}

/** The scenes after a won fight; the arena's purse scene comes first after the second fight. */
function after(id: ChapterId): readonly string[] {
  return [...(id === 'arena-2' ? ['arena-victory'] : []), ...(SCENES_AFTER[id] ?? [])];
}

/** Every scene in the order the story plays them; the two paths of the sons get one take each. */
export function takes(): Take[] {
  const list: Take[] = [];
  for (const chapter of CHAPTERS) {
    for (const id of [...before(chapter.id), ...after(chapter.id)]) {
      if (id === 'marcus-path') list.push({ id, chapter: chapter.id, son: 'marcus', suffix: '' });
      else if (id === 'brothers-end') {
        list.push({ id, chapter: chapter.id, son: 'lucius', suffix: ' (Lucius wins)' });
        list.push({ id, chapter: chapter.id, son: 'marcus', suffix: ' (Marcus wins)' });
      } else list.push({ id, chapter: chapter.id, son: 'lucius', suffix: '' });
    }
  }
  return list;
}

function chapterPart(chapter: ChapterId): string {
  return `${chapterLabel(chapter).replace(' · ', ' - ')} - ${CHAPTERS.find((c) => c.id === chapter)?.title ?? ''}`;
}

/** The video's file name: its number in the series, its book and chapter, and the scene. */
export function episodeName(take: Take, n: number): string {
  return `E${String(n).padStart(2, '0')} - ${chapterPart(take.chapter)} - ${take.id}${take.suffix}.mp4`;
}

/**
 * Where a chapter's gameplay picture sorts among the videos: right after the last scene played
 * before it ("E05b"), so the folder reads in story order.
 */
export function stillName(chapter: ChapterId, what: string): string {
  const list = takes();
  const order = CHAPTERS.map((c) => c.id);
  const at = order.indexOf(chapter);
  let n = 0;
  list.forEach((t, i) => {
    const o = order.indexOf(t.chapter);
    if (o < at || (o === at && before(chapter).includes(t.id))) n = i + 1;
  });
  return `E${String(n).padStart(2, '0')}b - ${chapterPart(chapter)} - ${what}.png`;
}

export interface Browser {
  run<T>(expression: string): Promise<T>;
  send(method: string, params?: object): Promise<{ result?: { data?: string } }>;
  close(): void;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Headless Chrome on the GPU at the given size, with the game loaded and its debug hooks ready. */
export async function openGame(url: string, width: number, height: number, extraFlags: readonly string[] = []): Promise<Browser> {
  const port = 9900 + Math.floor(Math.random() * 90);
  const profile = join(process.env.REC_PROFILE ?? '/tmp', `tumblehorde-promo-${port}`);
  const chrome = spawn(process.env.CHROME ?? 'google-chrome', [
    '--headless=new', '--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=vulkan', '--enable-features=Vulkan',
    '--autoplay-policy=no-user-gesture-required', ...extraFlags,
    `--window-size=${width},${height}`, `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank',
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
  const pending = new Map<number, (m: never) => void>();
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(String(e.data)) as { id?: number; method?: string; params?: { exceptionDetails?: unknown } };
    if (m.id !== undefined && pending.has(m.id)) {
      pending.get(m.id)?.(m as never);
      pending.delete(m.id);
    } else if (m.method === 'Runtime.exceptionThrown') console.log('page exception', JSON.stringify(m.params?.exceptionDetails).slice(0, 300));
  });
  const send = (method: string, params: object = {}): Promise<{ result?: { data?: string; result?: { value?: unknown }; exceptionDetails?: unknown } }> =>
    new Promise((r) => {
      const id = ++nextId;
      pending.set(id, r);
      ws.send(JSON.stringify({ id, method, params }));
    });
  const run = async <T>(expression: string): Promise<T> => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
    if (r.result?.exceptionDetails) throw new Error(`${expression.slice(0, 80)}: ${JSON.stringify(r.result.exceptionDetails).slice(0, 400)}`);
    return r.result?.result?.value as T;
  };
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url });
  for (let i = 0; i < 120; i++) {
    await sleep(500);
    if (await run<boolean>('typeof window.tumblehorde === "object"')) break;
  }
  return {
    run,
    send,
    close: () => {
      ws.close();
      chrome.kill();
      rmSync(profile, { recursive: true, force: true });
    },
  };
}
