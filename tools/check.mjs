// Verifies Little Elsewhere end to end, in the real browser:
//   - nothing in game/ reaches out to the network;
//   - the four staged pictures render without console errors;
//   - a player can start, find, miss, pause, hint and finish all six
//     postcards using only keyboard and pointer input.
//
// How to run it: start headless Chrome with remote debugging on port
// 9222, serve the game, then run `node tools/check.mjs`. By default it
// talks to http://localhost:8080 (start it with `node serve.ts`). Where
// the browser cannot reach localhost, point GAME_URL at the game folder
// as a file URL instead, e.g. GAME_URL=file:///path/to/game.
import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

const BASE = process.env.GAME_URL || 'http://localhost:8080';
const LEVELS = 6;
const PER_LEVEL = 7;

// 1. No external references anywhere in the game files.
const srcFiles = await readdir(new URL('../game/src/', import.meta.url));
const withUrls = [];
for (const f of ['index.html', 'style.css', ...srcFiles.map(name => 'src/' + name)]) {
  const text = await readFile(new URL('../game/' + f, import.meta.url), 'utf8');
  if (/https?:\/\//.test(text)) withUrls.push(f);
}
assert.equal(withUrls.length, 0);
console.log('Resource URL scan: PASS — no http:/https:// references in game/');

await mkdir('/tmp/check', { recursive: true });
const shotDir = new URL('../screenshots/', import.meta.url);
await mkdir(shotDir, { recursive: true });
const shots = JSON.parse(await readFile(new URL('../shots.json', import.meta.url), 'utf8'));

// A thin client for the Chrome DevTools Protocol over one WebSocket.
class DevTools {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 0;
    this.waiting = new Map();
    this.consoleErrors = [];
    this.requests = [];
    socket.onmessage = event => {
      const msg = JSON.parse(event.data);
      if (msg.id) {
        const entry = this.waiting.get(msg.id);
        this.waiting.delete(msg.id);
        if (msg.error) entry.reject(msg.error);
        else entry.resolve(msg.result);
      } else {
        if (msg.method === 'Runtime.exceptionThrown') this.consoleErrors.push(msg.params.exceptionDetails.text);
        if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') this.consoleErrors.push(JSON.stringify(msg.params.args));
        if (msg.method === 'Network.requestWillBeSent') this.requests.push(msg.params.request.url);
      }
    };
  }

  static async open() {
    const target = await (await fetch('http://localhost:9222/json/new?about:blank', { method: 'PUT' })).json();
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise(resolve => { socket.onopen = resolve; });
    return new DevTools(socket);
  }

  call(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.nextId;
      this.waiting.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const out = await this.call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    return out.result.value;
  }

  async waitFor(expression) {
    for (let i = 0; i < 120; i++) {
      if (await this.eval(expression)) return;
      await new Promise(r => setTimeout(r, 50));
    }
    throw new Error('Timeout waiting for ' + expression);
  }

  async go(url) {
    await this.call('Page.navigate', { url });
  }

  async press(key, code = key) {
    await this.call('Input.dispatchKeyEvent', { type: 'keyDown', key, code });
    await this.call('Input.dispatchKeyEvent', { type: 'keyUp', key, code });
  }

  async tap(x, y) {
    const p = await this.eval(`(() => { const r = document.getElementById('original').getBoundingClientRect(); return { x: r.left + ${x} / 600 * r.width, y: r.top + ${y} / 440 * r.height }; })()`);
    await this.call('Input.dispatchMouseEvent', { type: 'mouseMoved', ...p });
    await this.call('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...p });
    await this.call('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...p });
  }

  async shotPng() {
    const { data } = await this.call('Page.captureScreenshot', { format: 'png' });
    return Buffer.from(data, 'base64');
  }

  async shotJpeg() {
    const { data } = await this.call('Page.captureScreenshot', { format: 'jpeg', quality: 88 });
    return Buffer.from(data, 'base64');
  }

  close() {
    this.socket.close();
  }
}

const browser = await DevTools.open();
await browser.call('Runtime.enable');
await browser.call('Network.enable');
await browser.call('Page.enable');
await browser.call('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });

function pageUrl(query) {
  return BASE.startsWith('file:') ? BASE + '/index.html' + query : BASE + '/' + query;
}

// 2. Staged screenshots (shots.json) — each must render clean, with no
// console errors and no network requests outside the game itself.
for (const shot of shots) {
  const name = new URLSearchParams(shot.query).get('shot');
  browser.consoleErrors = [];
  browser.requests = [];
  await browser.go(pageUrl(shot.query));
  await browser.waitFor('window.__shotReady===true');
  if (name === 'play') {
    assert.equal(await browser.eval('window.__game.state.found.length'), 4);
    assert.equal(await browser.eval('document.getElementById("remaining").textContent'), '3 left');
  }
  assert.equal(browser.consoleErrors.length, 0, JSON.stringify(browser.consoleErrors));
  const local = u => u.startsWith('http://localhost:8080/') || u.startsWith('http://127.0.0.1:8080/') || u.startsWith('file:') || u.startsWith('data:');
  assert(browser.requests.every(local), browser.requests.join('\n'));
  const png = await browser.shotPng();
  await writeFile('/tmp/check/' + name + '.png', png);
  const jpeg = await browser.shotJpeg();
  assert(jpeg.length < 256 * 1024);
  await writeFile(new URL(shot.name, shotDir), jpeg);
  console.log(`Shot ${name}: PASS — 1600x900, no console errors, game-only requests; screenshots/${shot.name} (${jpeg.length} bytes); /tmp/check/${name}.png`);
}

// 3. Real play-through with keyboard and pointer input.
await browser.go(pageUrl('?seed=1'));
await browser.waitFor('!!window.__game && !window.__shotReady');

// 3a. The title screen offers a level-select grid of six postcards.
assert.equal(await browser.eval('document.querySelectorAll(".postcard").length'), LEVELS);
assert.equal(await browser.eval('document.querySelectorAll(".postcard:not(.locked)").length >= 1'), true);
console.log('Level select: OK — title screen lists six postcards, first one open');

await browser.press('Enter');
await browser.waitFor('window.__game.state.screen==="playing"');

// 3b. Sound controls: S does nothing, N toggles.
await browser.press('s');
assert.equal(await browser.eval('document.getElementById("sound").textContent'), 'Sound on');
await browser.press('n');
assert.equal(await browser.eval('document.getElementById("sound").textContent'), 'Sound off');
await browser.press('n');
console.log('Sound controls: OK — S is ignored, N flips the sound switch');

// 3c. One miss, then a keyboard find, pause/resume.
await browser.tap(590, 15);
assert.equal(await browser.eval('window.__game.state.mistakes'), 1);
assert.equal(await browser.eval('window.__game.state.streak'), 0);
const differences = await browser.eval('window.__game.differences');
assert.equal(differences.length, PER_LEVEL);
// The seven differences must be spread over the picture, not bunched up.
const xs = differences.map(d => d.x);
const ys = differences.map(d => d.y);
assert(Math.max(...xs) - Math.min(...xs) > 300, 'picked differences cover the width');
assert(Math.max(...ys) - Math.min(...ys) > 150, 'picked differences cover the height');
console.log('Spread picking: OK — the 7 differences reach across the picture');

// Position with real pointer input, then move and check using real keyboard input.
const first = differences.shift();
const at = await browser.eval(`(() => { const r = document.getElementById('original').getBoundingClientRect(); return { x: r.left + ${first.x} / 600 * r.width, y: r.top + ${first.y} / 440 * r.height }; })()`);
await browser.call('Input.dispatchMouseEvent', { type: 'mouseMoved', ...at });
await browser.call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight' });
await new Promise(r => setTimeout(r, 100));
await browser.press('ArrowRight');
await browser.press(' ', 'Space');
assert.equal(await browser.eval('window.__game.state.found.length'), 1);
assert.equal(await browser.eval('window.__game.state.streak'), 1);
assert.equal(await browser.eval('document.getElementById("streak").textContent'), '—'); // streak 1 shows as —
await browser.press('p');
assert.equal(await browser.eval('window.__game.state.screen'), 'paused');
await browser.press('Escape');

// 3d. Two-stage hint: first H shows a zone (costs 1), second H pinpoints it.
await browser.press('h');
assert.equal(await browser.eval('window.__game.state.hints'), 2);
assert(await browser.eval('!!window.__game.state.zone'), 'zone hint shown after first H');
await browser.press('h');
assert.equal(await browser.eval('window.__game.state.hints'), 1);
assert(await browser.eval('!!window.__game.state.hint'), 'exact hint ring shown after second H');
assert.equal(await browser.eval('window.__game.state.zone'), null);
console.log('Zone hints: OK — first H lights a quarter, second H marks the spot; one hint each');

for (const o of differences) await browser.tap(o.x, o.y);
assert.equal(await browser.eval('window.__game.state.screen'), 'complete');
assert.equal(await browser.eval('window.__game.state.found.length'), PER_LEVEL);
console.log('Real play: OK — Enter to start, one miss, arrow keys + Space to find, pause and resume, two-stage hint, six pointer finds, level complete');

// 3e. Play the remaining five postcards through to the final screen.
for (let level = 1; level < LEVELS; level++) {
  await browser.press('Enter');
  assert.equal(await browser.eval('window.__game.state.level'), level);
  for (const o of await browser.eval('window.__game.differences')) await browser.tap(o.x, o.y);
  assert.equal(await browser.eval('window.__game.state.screen'), 'complete');
}
await browser.press('Enter');
assert.equal(await browser.eval('window.__game.state.screen'), 'final');
assert((await browser.eval('Number(localStorage.getItem("little-elsewhere-best"))')) > 0);
assert((await browser.eval('Number(localStorage.getItem("little-elsewhere-unlocked"))')) >= LEVELS - 1);
await browser.press('Enter');
assert.equal(await browser.eval('window.__game.state.level'), 0);
assert.equal(await browser.eval('window.__game.state.found.length'), 0);
assert.equal(browser.consoleErrors.length, 0, JSON.stringify(browser.consoleErrors));
console.log('Full collection: OK — all six scenes, final results, saved best and unlocked postcards, restart; no runtime errors');
await browser.call('Page.close');
browser.close();
