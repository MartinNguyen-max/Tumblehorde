// Drives the game in headless Chrome (WebGL through SwiftShader) and takes screenshots.
// Usage: node tools/browser-check.mjs <scenario.json> <outdir>
// A scenario is a list of steps: { goto: url } | { eval: js } | { wait: ms } | { shot: file.png }.
// Software rendering runs at a few frames per second: allow for it in the waits.
// Scenario: [{ "eval": "js", "wait": ms, "shot": "name.png" }, ...]
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const [scenarioPath, outDir] = process.argv.slice(2);
const steps = JSON.parse(readFileSync(scenarioPath, 'utf8'));
mkdirSync(outDir, { recursive: true });
const port = 9333 + Math.floor(Math.random() * 500);
const chrome = spawn('google-chrome', ['--headless=new', `--remote-debugging-port=${port}`, '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1280,720', '--user-data-dir=' + join(tmpdir(), 'tumblehorde-chrome-' + port), 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target;
for (let i = 0; i < 50 && !target; i++) {
  await sleep(200);
  try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page'); } catch {}
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const pending = new Map();
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') console.log('console.error', JSON.stringify(m.params.args.map(a=>a.value ?? a.description)).slice(0,300)); else if (m.method === 'Runtime.exceptionThrown') console.log('exception', JSON.stringify(m.params.exceptionDetails).slice(0, 400)); });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Runtime.enable');
await send('Page.enable');
for (const step of steps) {
  if (step.goto) { await send('Page.navigate', { url: step.goto }); }
  if (step.eval) { const r = await send('Runtime.evaluate', { expression: step.eval, awaitPromise: true, returnByValue: true }); if (r.result?.exceptionDetails) console.log('eval error', JSON.stringify(r.result.exceptionDetails).slice(0, 300)); else if (r.result?.result?.value !== undefined) console.log('eval:', JSON.stringify(r.result.result.value).slice(0, 6000)); }
  if (step.wait) await sleep(step.wait);
  if (step.shot) { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(`${outDir}/${step.shot}`, Buffer.from(r.result.data, 'base64')); console.log('shot', step.shot); }
}
ws.close(); chrome.kill();
process.exit(0);
