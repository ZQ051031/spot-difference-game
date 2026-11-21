// Local verification for Little Elsewhere: resource scan, staged
// screenshots, a full real-input play-through of all six postcards,
// and checks for the new features (level select, zone hints, streaks,
// spread-aware difference picking).
//
// Run Chrome headless with remote debugging, serve game/ (or point
// GAME_URL at it), then:  node tools/check.mjs
//   GAME_URL defaults to http://localhost:8080 — serve with `node serve.ts`.
//   In a sandbox where the browser cannot reach localhost, use the
//   file:// URL of game/ instead:
//     GAME_URL=file:///path/to/game node tools/check.mjs
import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

const BASE = process.env.GAME_URL || 'http://localhost:8080';
const LEVELS = 6;
const PER_LEVEL = 7;

// 1. No external references anywhere in the game files.
const srcFiles = await readdir(new URL('../game/src/', import.meta.url));
const withUrls = [];
for (const f of ['index.html', 'style.css', ...srcFiles.map(f => 'src/' + f)]) {
  const s = await readFile(new URL('../game/' + f, import.meta.url), 'utf8');
  if (/https?:\/\//.test(s)) withUrls.push(f);
}
assert.equal(withUrls.length, 0);
console.log('Resource URL scan: PASS — no http:/https:// references in game/');

await mkdir('/tmp/check', { recursive: true });
const screenshotDir = new URL('../screenshots/', import.meta.url);
await mkdir(screenshotDir, { recursive: true });
const shots = JSON.parse(await readFile(new URL('../shots.json', import.meta.url), 'utf8'));

const target = await (await fetch('http://localhost:9222/json/new?about:blank', { method: 'PUT' })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0;
const pending = new Map();
let errors = [];
let requests = [];
ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.id) {
    const p = pending.get(m.id);
    pending.delete(m.id);
    m.error ? p.reject(m.error) : p.resolve(m.result);
  } else {
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(JSON.stringify(m.params.args));
    if (m.method === 'Network.requestWillBeSent') requests.push(m.params.request.url);
  }
};
const call = (method, params = {}) => new Promise((resolve, reject) => {
  pending.set(++id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async expression => (await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value;
const until = async expression => {
  for (let i = 0; i < 120; i++) {
    if (await evaluate(expression)) return;
    await new Promise(r => setTimeout(r, 50));
  }
  throw Error('Timeout ' + expression);
};
await call('Runtime.enable');
await call('Network.enable');
await call('Page.enable');
await call('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });

// 2. Staged screenshots (shots.json) — each must render clean, with no
// console errors and no network requests outside the game itself.
for (const shot of shots) {
  const name = new URLSearchParams(shot.query).get('shot');
  errors = [];
  requests = [];
  const url = BASE.startsWith('file:') ? `${BASE}/index.html${shot.query}` : `${BASE}/${shot.query}`;
  await call('Page.navigate', { url });
  await until('window.__shotReady===true');
  if (name === 'play') {
    assert.equal(await evaluate('window.__game.state.found.length'), 4);
    assert.equal(await evaluate('document.getElementById("remaining").textContent'), '3 left');
  }
  assert.equal(errors.length, 0, JSON.stringify(errors));
  assert(requests.every(u => u.startsWith('http://localhost:8080/') || u.startsWith('http://127.0.0.1:8080/') || u.startsWith('file:') || u.startsWith('data:')), requests.join('\n'));
  const { data } = await call('Page.captureScreenshot', { format: 'png' });
  await writeFile(`/tmp/check/${name}.png`, Buffer.from(data, 'base64'));
  const jpeg = await call('Page.captureScreenshot', { format: 'jpeg', quality: 88 });
  const bytes = Buffer.from(jpeg.data, 'base64');
  assert(bytes.length < 256 * 1024);
  await writeFile(new URL(shot.name, screenshotDir), bytes);
  console.log(`Shot ${name}: PASS — 1600x900, no console errors, game-only requests; screenshots/${shot.name} (${bytes.length} bytes); /tmp/check/${name}.png`);
}

// 3. Real play-through with keyboard and pointer input.
const playUrl = BASE.startsWith('file:') ? `${BASE}/index.html?seed=1` : `${BASE}/?seed=1`;
await call('Page.navigate', { url: playUrl });
await until('!!window.__game && !window.__shotReady');
const key = async (k, code = k) => {
  await call('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code });
  await call('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code });
};
const click = async (x, y) => {
  const p = await evaluate(`(()=>{let r=document.getElementById('original').getBoundingClientRect();return {x:r.left+${x}/600*r.width,y:r.top+${y}/440*r.height}})()`);
  await call('Input.dispatchMouseEvent', { type: 'mouseMoved', ...p });
  await call('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...p });
  await call('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...p });
};

// 3a. The title screen offers a level-select grid of six postcards.
assert.equal(await evaluate('document.querySelectorAll(".postcard").length'), LEVELS);
assert.equal(await evaluate('document.querySelectorAll(".postcard:not(.locked)").length >= 1'), true);
console.log('Level select: PASS — six postcards on the title screen, first unlocked');

await key('Enter');
await until('window.__game.state.screen==="playing"');

// 3b. Sound controls: S does nothing, N toggles.
await key('s');
assert.equal(await evaluate('document.getElementById("sound").textContent'), 'Sound on');
await key('n');
assert.equal(await evaluate('document.getElementById("sound").textContent'), 'Sound off');
await key('n');
console.log('Sound controls: PASS — S leaves sound unchanged; N toggles sound');

// 3c. One miss, then a keyboard find, pause/resume.
await click(590, 15);
assert.equal(await evaluate('window.__game.state.mistakes'), 1);
assert.equal(await evaluate('window.__game.state.streak'), 0);
const differences = await evaluate('window.__game.differences');
assert.equal(differences.length, PER_LEVEL);
// The seven differences must spread across the picture (not one corner).
const xs = differences.map(d => d.x), ys = differences.map(d => d.y);
assert(Math.max(...xs) - Math.min(...xs) > 300, 'differences span the width');
assert(Math.max(...ys) - Math.min(...ys) > 150, 'differences span the height');
console.log('Spread picking: PASS — 7 differences span the picture');

// Position with real pointer input, then move and check using real keyboard input.
const first = differences.shift();
const p = await evaluate(`(()=>{let r=document.getElementById('original').getBoundingClientRect();return{x:r.left+${first.x}/600*r.width,y:r.top+${first.y}/440*r.height}})()`);
await call('Input.dispatchMouseEvent', { type: 'mouseMoved', ...p });
await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight' });
await new Promise(r => setTimeout(r, 100));
await key('ArrowRight');
await key(' ', 'Space');
assert.equal(await evaluate('window.__game.state.found.length'), 1);
assert.equal(await evaluate('window.__game.state.streak'), 1);
assert.equal(await evaluate('document.getElementById("streak").textContent'), '—'); // streak 1 shows as —
await key('p');
assert.equal(await evaluate('window.__game.state.screen'), 'paused');
await key('Escape');

// 3d. Two-stage hint: first H shows a zone (costs 1), second H pinpoints it.
await key('h');
assert.equal(await evaluate('window.__game.state.hints'), 2);
assert(await evaluate('!!window.__game.state.zone'), 'zone hint shown after first H');
await key('h');
assert.equal(await evaluate('window.__game.state.hints'), 1);
assert(await evaluate('!!window.__game.state.hint'), 'exact hint ring shown after second H');
assert.equal(await evaluate('window.__game.state.zone'), null);
console.log('Zone hints: PASS — first H shows a quarter, second H pinpoints; each costs one hint');

for (const o of differences) await click(o.x, o.y);
assert.equal(await evaluate('window.__game.state.screen'), 'complete');
assert.equal(await evaluate('window.__game.state.found.length'), PER_LEVEL);
console.log('Real play: PASS — Enter start, one miss, arrow movement + Space find, pause/resume, two-stage hint, six pointer finds → level complete');

// 3e. Play the remaining five postcards through to the final screen.
for (let level = 1; level < LEVELS; level++) {
  await key('Enter');
  assert.equal(await evaluate('window.__game.state.level'), level);
  for (const o of await evaluate('window.__game.differences')) await click(o.x, o.y);
  assert.equal(await evaluate('window.__game.state.screen'), 'complete');
}
await key('Enter');
assert.equal(await evaluate('window.__game.state.screen'), 'final');
assert((await evaluate('Number(localStorage.getItem("little-elsewhere-best"))')) > 0);
assert((await evaluate('Number(localStorage.getItem("little-elsewhere-unlocked"))')) >= LEVELS - 1);
await key('Enter');
assert.equal(await evaluate('window.__game.state.level'), 0);
assert.equal(await evaluate('window.__game.state.found.length'), 0);
assert.equal(errors.length, 0, JSON.stringify(errors));
console.log('Full collection: PASS — all six scenes, final results, saved best and unlocked postcards, restart; no runtime errors');
await call('Page.close');
ws.close();
