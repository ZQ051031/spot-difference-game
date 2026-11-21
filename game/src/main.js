// Little Elsewhere — game logic.
// Six hand-drawn postcards. Find seven differences in each pair.
// Keyboard and mouse. No network, no build step.
import { scenes, drawScene, pickDifferences, zoneOf } from './scenes.js';

const LEVELS = scenes.length; // 6
const PER_LEVEL = 7;
const BEST_KEY = 'little-elsewhere-best';
const UNLOCKED_KEY = 'little-elsewhere-unlocked';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const shot = params.get('shot');

// Seeded random: a fixed seed makes replays and screenshots reproducible.
let seed = Number(params.get('seed') || Date.now()) >>> 0;
function random() {
  seed += 0x6d2b79f5;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const canvases = [$('original'), $('altered')];
const ctxs = canvases.map(c => c.getContext('2d'));

const state = {
  screen: 'title',
  level: 0,
  selected: [],
  found: [],
  elapsed: 0,
  mistakes: 0,
  hints: 3,
  score: 0,
  total: 0,
  streak: 0,          // consecutive finds without a miss
  bestStreak: 0,
  lastFindAt: 0,
  cursor: { x: 300, y: 220, visible: false },
  hint: null,         // {id, life} — the glowing ring
  zone: null,         // {label, life} — the quadrant hint
  miss: null,
  lock: 0,
};

let best = 0;
let unlocked = 0; // highest level index the player may open
let sound = true;
let music = false;
let audio = null;
let note = 0;
let lastMusic = 0;
let misses = [];
let keys = new Set();
let layers = [];

try { best = Number(localStorage.getItem(BEST_KEY)) || 0; } catch {}
try { unlocked = Number(localStorage.getItem(UNLOCKED_KEY)) || 0; } catch {}
unlocked = Math.max(0, Math.min(LEVELS - 1, unlocked));

function saveUnlocked() {
  try { localStorage.setItem(UNLOCKED_KEY, String(unlocked)); } catch {}
}
function saveBest() {
  try { localStorage.setItem(BEST_KEY, String(best)); } catch {}
}

// ---------- audio ----------

function tone(f, d = 0.15, volume = 0.06, type = 'sine', delay = 0) {
  if (!audio) return;
  const o = audio.createOscillator();
  const g = audio.createGain();
  const t = audio.currentTime + delay;
  o.type = type;
  o.frequency.value = f;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(volume, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.001, t + d);
  o.connect(g);
  g.connect(audio.destination);
  o.start(t);
  o.stop(t + d + 0.02);
}

function wake() {
  if (!audio) {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (Audio) audio = new Audio();
  }
  if (audio?.state === 'suspended') audio.resume();
}

// ---------- helpers ----------

function announce(t) { $('status').textContent = t; }

function time(v) {
  return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(Math.floor(v % 60)).padStart(2, '0')}`;
}

// Points for a find: a fast, clean find is worth more, and a streak of
// finds without a miss multiplies it. The formula is shown on the
// level-complete card so the score is never a mystery.
function findPoints() {
  const base = Math.max(150, 500 - Math.floor(state.elapsed) * 2 - state.mistakes * 20);
  const mult = 1 + 0.25 * Math.min(state.streak, 8);
  return Math.round(base * mult);
}

function update() {
  const s = scenes[state.level];
  $('chapter').textContent = `POSTCARD ${String(state.level + 1).padStart(2, '0')} / ${String(LEVELS).padStart(2, '0')}`;
  $('scene-name').textContent = s.name;
  $('caption').textContent = s.caption;
  $('remaining').textContent = `${PER_LEVEL - state.found.length} left`;
  $('found').textContent = `${state.found.length} OF ${PER_LEVEL} DISCOVERED`;
  $('time').textContent = time(state.elapsed);
  $('mistakes').textContent = state.mistakes;
  $('score').textContent = (state.total + state.score).toLocaleString();
  $('streak').textContent = state.streak > 1 ? `x${state.streak}` : '—';
  $('hints').textContent = state.hints;
  $('hint').disabled = state.hints === 0 || state.screen !== 'playing';
  $('progress').innerHTML = Array.from({ length: PER_LEVEL }, (_, i) =>
    `<i class="${i < state.found.length ? 'done' : ''}"></i>`).join('');
}

// ---------- level setup ----------

function prepare(level) {
  state.level = level;
  // Spread the seven differences across the picture instead of letting
  // them clump in one corner.
  state.selected = pickDifferences(scenes[level], PER_LEVEL, random);
  Object.assign(state, {
    found: [], elapsed: 0, mistakes: 0, hints: 3, score: 0,
    streak: 0, bestStreak: 0, lastFindAt: 0,
    hint: null, zone: null, miss: null, lock: 0,
  });
  misses = [];
  layers = [0, 1].map(a => {
    const c = document.createElement('canvas');
    c.width = 1200; c.height = 880;
    const x = c.getContext('2d');
    x.scale(2, 2);
    drawScene(x, scenes[level], state.selected, !!a);
    return c;
  });
  update();
}

// ---------- screens ----------

function postcardGrid() {
  return `<div class="postcard-grid">${scenes.map((s, i) => {
    const locked = i > unlocked;
    const done = i < unlocked;
    return `<button class="postcard${locked ? ' locked' : ''}${i === state.level ? ' current' : ''}" data-level="${i}" ${locked ? 'disabled' : ''}>
      <span class="postcard-num">${String(i + 1).padStart(2, '0')}</span>
      <span class="postcard-name">${s.name}</span>
      <span class="postcard-mark">${locked ? 'locked' : done ? '✓ collected' : 'open'}</span>
    </button>`;
  }).join('')}</div>`;
}

function overlay(screen) {
  state.screen = screen;
  keys.clear();
  $('overlay').classList.toggle('hidden', screen === 'playing');
  $('pause').disabled = screen === 'title' || screen === 'complete' || screen === 'final';
  const card = $('card');

  if (screen === 'title') {
    card.innerHTML = `<div class="seal">◎</div>
      <span class="eyebrow">SIX PLACES. FORTY-TWO LITTLE SECRETS.</span>
      <h2>See the little<br>things differently.</h2>
      <p>Welcome to <em>Little Elsewhere.</em><br>Explore six hand-drawn worlds. Find seven changes<br>in each pair of pictures. No rush. Just a closer look.</p>
      <button class="primary" id="continue">Begin exploring →</button>
      <p>Or jump straight to a postcard you have unlocked:</p>
      ${postcardGrid()}
      <p>Click a changed detail in either picture.</p>
      <div class="instructions"><kbd>↑ ↓ ← →</kbd> or <kbd>W A S D</kbd> move · <kbd>SHIFT</kbd> faster<br>
      <kbd>SPACE / ENTER</kbd> check · <kbd>H</kbd> hint · <kbd>P / ESC</kbd> pause<br>
      <kbd>M</kbd> music · <kbd>N</kbd> sound</div>`;
  }

  if (screen === 'paused') {
    card.innerHTML = `<div class="seal">Ⅱ</div>
      <span class="eyebrow">A MOMENT TO YOURSELF</span>
      <h2>The world can wait.</h2>
      <p>Your discoveries are safe.<br>Come back whenever you’re ready.</p>
      <button class="primary" id="continue">Keep looking →</button>
      <div class="instructions">Press P, Esc, Enter or Space to resume.</div>`;
  }

  if (screen === 'complete' || screen === 'final') {
    const final = screen === 'final';
    const stars = state.mistakes < 2 && state.hints >= 2 ? 3 : state.mistakes < 5 ? 2 : 1;
    card.innerHTML = `<div class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</div>
      <span class="eyebrow">${final ? 'YOUR COLLECTION IS COMPLETE' : 'POSTCARD DISCOVERED'}</span>
      <h2>${final ? 'A wonderful eye.' : 'Beautifully noticed.'}</h2>
      <p>${final ? 'Six worlds, forty-two discoveries. Thank you for slowing down.' : scenes[state.level].name + ' has shared all its secrets.'}</p>
      <div class="result-stats">
        <div><b>${time(state.elapsed)}</b><span>TIME</span></div>
        <div><b>${state.mistakes}</b><span>MISTAKES</span></div>
        <div><b>${state.bestStreak}</b><span>BEST STREAK</span></div>
        <div><b>${final ? state.total + state.score : state.score}</b><span>${final ? 'TOTAL SCORE' : 'POSTCARD SCORE'}</span></div>
      </div>
      ${final ? `<p>Personal best · ${best.toLocaleString()}</p>` : `<p>Finished a postcard: +1 hint for the next one.</p>`}
      <button class="primary" id="continue">${final ? 'Explore again' : state.level === LEVELS - 1 ? 'View collection' : 'Next postcard'} →</button>
      <div class="instructions">${final ? 'Every visit reveals a new selection of details.' : `${state.level + 1} of ${LEVELS} postcards collected · Enter to continue`}</div>`;
  }

  $('continue')?.addEventListener('click', confirm);
  card.querySelectorAll('.postcard:not(.locked)').forEach(b => {
    b.addEventListener('click', () => {
      wake();
      state.total = 0;
      prepare(Number(b.dataset.level));
      overlay('playing');
      announce(`Seven differences to discover in ${scenes[state.level].name}.`);
    });
  });
  update();
}

function confirm() {
  wake();
  if (state.screen === 'title' || state.screen === 'final') {
    state.total = 0;
    prepare(0);
    overlay('playing');
    announce('Seven differences to discover.');
  } else if (state.screen === 'paused') {
    overlay('playing');
  } else if (state.screen === 'complete') {
    if (state.level === LEVELS - 1) {
      best = Math.max(best, state.total + state.score);
      saveBest();
      overlay('final');
    } else {
      state.total += state.score;
      // Finishing a postcard earns a hint for the next one (max five).
      state.hints = Math.min(5, state.hints + 1);
      prepare(state.level + 1);
      overlay('playing');
    }
  }
}

// ---------- playing ----------

function check(x, y) {
  if (state.screen !== 'playing' || state.lock > 0) return;
  wake();
  const target = scenes[state.level].objects.find(o =>
    state.selected.includes(o.id) &&
    ((x - o.x) / (o.r + 13)) ** 2 + ((y - (o.y - 8)) / (o.r + 25)) ** 2 <= 1);
  if (target) {
    if (state.found.some(f => f.id === target.id)) return;
    state.found.push({ id: target.id, at: performance.now() });
    // A find within eight seconds of the previous one extends the streak.
    if (performance.now() - state.lastFindAt < 8000) state.streak += 1;
    else state.streak = 1;
    state.lastFindAt = performance.now();
    state.bestStreak = Math.max(state.bestStreak, state.streak);
    state.score += findPoints();
    if (sound) { tone(659); tone(880, 0.3, 0.05, 'sine', 0.09); }
    announce(`Found! ${PER_LEVEL - state.found.length} differences remaining.`);
    if (state.found.length === PER_LEVEL) {
      state.score += state.hints * 100;
      // Unlock the next postcard for the level-select grid.
      if (state.level < LEVELS - 1 && unlocked < state.level + 1) {
        unlocked = state.level + 1;
        saveUnlocked();
      }
      overlay('complete');
    }
  } else {
    state.mistakes++;
    state.elapsed += 5;
    state.score = Math.max(0, state.score - 50);
    state.streak = 0;
    state.miss = { x, y, life: 1.1 };
    misses = misses.filter(t => performance.now() - t < 1600);
    misses.push(performance.now());
    if (misses.length >= 3) {
      state.lock = 2;
      announce('Take a breath. Clicks paused for two seconds.');
    } else {
      announce('Not quite. Five seconds added.');
    }
    if (sound) tone(155, 0.18, 0.05, 'triangle');
  }
  update();
}

function hint() {
  if (state.screen !== 'playing' || !state.hints) return;
  wake();
  // If a zone is already glowing, the next hint pinpoints the exact spot.
  if (state.zone) {
    const o = scenes[state.level].objects[state.zone.id];
    state.hint = { id: o.id, life: 4 };
    state.zone = null;
    state.hints--;
    announce(`A hint is glowing on the ${zoneOf(o)}. ${state.hints} hints left.`);
  } else {
    // Pick a random unfound difference (never the same one every time),
    // and first show only its quarter of the picture.
    const remaining = scenes[state.level].objects.filter(o =>
      state.selected.includes(o.id) && !state.found.some(f => f.id === o.id));
    if (!remaining.length) return;
    const o = remaining[Math.floor(random() * remaining.length)];
    state.zone = { id: o.id, life: 5 };
    state.hints--;
    announce(`Look in the ${zoneOf(o)}. Press H again to pinpoint it. ${state.hints} hints left.`);
  }
  if (sound) tone(523, 0.4, 0.04);
  update();
}

function pause() {
  if (state.screen === 'playing') overlay('paused');
  else if (state.screen === 'paused') overlay('playing');
}

$('hint').onclick = hint;
$('pause').onclick = pause;

function toggleSound() {
  sound = !sound;
  $('sound').textContent = `Sound ${sound ? 'on' : 'off'}`;
}
function toggleMusic() {
  wake();
  music = !music;
  $('music').textContent = `Music ${music ? 'on' : 'off'}`;
}
$('sound').onclick = toggleSound;
$('music').onclick = toggleMusic;

canvases.forEach(c => {
  function position(e) {
    const r = c.getBoundingClientRect();
    state.cursor = {
      x: (e.clientX - r.left) / r.width * 600,
      y: (e.clientY - r.top) / r.height * 440,
      visible: true,
    };
  }
  c.addEventListener('pointermove', position);
  c.addEventListener('pointerdown', e => { position(e); c.focus(); check(state.cursor.x, state.cursor.y); });
});

document.addEventListener('keydown', e => {
  if (e.target.tagName === 'BUTTON' && (e.key === 'Enter' || e.key === ' ')) return;
  const k = e.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'enter', 'escape'].includes(k)) e.preventDefault();
  keys.add(k);
  if (e.repeat) return;
  if (k === 'm') toggleMusic();
  else if (k === 'n') toggleSound();
  if (k === 'h') hint();
  if (k === 'p' || k === 'escape') pause();
  if (k === ' ' || k === 'enter') {
    if (state.screen === 'playing') check(state.cursor.x, state.cursor.y);
    else confirm();
  }
});
document.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => { keys.clear(); if (state.screen === 'playing' && !shot) overlay('paused'); });
document.addEventListener('visibilitychange', () => { if (document.hidden && state.screen === 'playing' && !shot) overlay('paused'); });

// ---------- rendering ----------

function ring(c, x, y, r, col) {
  c.lineWidth = 2.5;
  c.strokeStyle = col;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.stroke();
}

function render(now) {
  ctxs.forEach((c, i) => {
    const canvas = canvases[i];
    const r = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(r.width * dpr);
    const h = Math.round(r.height * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    c.setTransform(w / 600, 0, 0, h / 440, 0, 0);
    c.drawImage(layers[i], 0, 0, 600, 440);

    // The zone hint: a soft glowing quarter of the picture.
    if (state.zone) {
      const o = scenes[state.level].objects[state.zone.id];
      const zx = o.x < 300 ? 0 : 300;
      const zy = o.y < 220 ? 0 : 220;
      const pulse = 0.10 + 0.05 * Math.sin(now / 240);
      c.fillStyle = `rgba(244, 207, 113, ${pulse})`;
      c.fillRect(zx, zy, 300, 220);
      c.strokeStyle = '#f4cf71';
      c.lineWidth = 2;
      c.setLineDash([8, 6]);
      c.strokeRect(zx + 2, zy + 2, 296, 216);
      c.setLineDash([]);
    }

    state.found.forEach(f => {
      const o = scenes[state.level].objects[f.id];
      const pulse = shot ? 0 : Math.max(0, 1 - (now - f.at) / 450) * 8;
      ring(c, o.x, o.y - 6, o.r + 15 + pulse, '#fff7d9');
      ring(c, o.x, o.y - 6, o.r + 12 + pulse, '#2d6b57');
      c.fillStyle = '#2d6b57';
      c.beginPath(); c.arc(o.x + o.r + 6, o.y - o.r - 5, 7, 0, 7); c.fill();
      c.fillStyle = 'white';
      c.font = '10px Arial'; c.textAlign = 'center';
      c.fillText('✓', o.x + o.r + 6, o.y - o.r - 2);
    });

    if (state.hint) {
      const o = scenes[state.level].objects[state.hint.id];
      ring(c, o.x, o.y - 8, o.r + 24 + Math.sin(now / 220) * 5, '#ffe7a0');
      ring(c, o.x, o.y - 8, o.r + 28 + Math.sin(now / 220) * 5, '#f4cf7199');
    }

    if (state.miss) {
      const { x, y } = state.miss;
      c.strokeStyle = '#c7544b'; c.lineWidth = 3;
      c.beginPath();
      c.moveTo(x - 9, y - 9); c.lineTo(x + 9, y + 9);
      c.moveTo(x + 9, y - 9); c.lineTo(x - 9, y + 9);
      c.stroke();
    }

    if (state.cursor.visible && state.screen === 'playing') {
      const { x, y } = state.cursor;
      c.strokeStyle = '#fff9'; c.lineWidth = 4;
      c.beginPath(); c.arc(x, y, 9, 0, 7); c.stroke();
      ring(c, x, y, 9, '#284e49');
      c.strokeStyle = '#284e49'; c.lineWidth = 1;
      for (let a = 0; a < 4; a++) {
        c.save();
        c.translate(x, y);
        c.rotate((a * Math.PI) / 2);
        c.beginPath(); c.moveTo(5, 0); c.lineTo(15, 0); c.stroke();
        c.restore();
      }
    }

    if (state.lock > 0) {
      c.fillStyle = '#244a4688';
      c.fillRect(0, 0, 600, 440);
      c.fillStyle = '#fff';
      c.font = '19px Georgia'; c.textAlign = 'center';
      c.fillText('A breath. A second glance.', 300, 220);
    }
  });
}

prepare(0);
overlay('title');

// Screenshot mode (?shot=play|hint|complete): stage a fixed scene so the
// pictures are reproducible, then signal readiness.
if (shot) {
  if (shot === 'play' || shot === 'hint' || shot === 'complete') {
    prepare(shot === 'hint' ? 3 : 0);
    overlay('playing');
    const count = shot === 'complete' ? 7 : shot === 'play' ? 4 : 2;
    state.found = state.selected.slice(0, count).map(id => ({ id, at: 0 }));
    state.elapsed = shot === 'complete' ? 104 : 76;
    state.score = count * 420;
    state.cursor = { x: 365, y: 270, visible: true };
    if (shot === 'hint') {
      state.hints = 2;
      state.hint = { id: state.selected[2], life: 99 };
      state.miss = { x: 325, y: 240, life: 99 };
      state.mistakes = 1;
    }
    if (shot === 'complete') overlay('complete');
    update();
  }
  requestAnimationFrame(() => {
    render(800);
    requestAnimationFrame(() => { render(800); window.__shotReady = true; });
  });
}

let previous = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - previous) / 1000);
  previous = now;
  if (!shot) {
    if (state.screen === 'playing') {
      state.elapsed += dt;
      state.lock = Math.max(0, state.lock - dt);
      for (const prop of ['hint', 'miss']) {
        if (state[prop]) {
          state[prop].life -= dt;
          if (state[prop].life <= 0) state[prop] = null;
        }
      }
      if (state.zone) {
        state.zone.life -= dt;
        if (state.zone.life <= 0) state.zone = null;
      }
      const dx = (keys.has('arrowright') || keys.has('d') ? 1 : 0) - (keys.has('arrowleft') || keys.has('a') ? 1 : 0);
      const dy = (keys.has('arrowdown') || keys.has('s') ? 1 : 0) - (keys.has('arrowup') || keys.has('w') ? 1 : 0);
      if (dx || dy) {
        state.cursor.visible = true;
        const speed = keys.has('shift') ? 260 : 110;
        state.cursor.x = Math.max(0, Math.min(600, state.cursor.x + dx * speed * dt));
        state.cursor.y = Math.max(0, Math.min(440, state.cursor.y + dy * speed * dt));
      }
      $('time').textContent = time(state.elapsed);
    }
    if (music && audio && state.screen === 'playing' && now - lastMusic > 480) {
      lastMusic = now;
      const notes = [261.63, 329.63, 392, 493.88, 440, 392, 329.63, 293.66];
      tone(notes[note++ % 8] / 2, 0.8, 0.018);
      tone(notes[(note + 2) % 8], 0.7, 0.012);
    }
    render(now);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Read-only test surface: no action shortcuts or answer overlays in the game.
window.__game = {
  get state() { return JSON.parse(JSON.stringify(state)); },
  get differences() {
    return scenes[state.level].objects
      .filter(o => state.selected.includes(o.id))
      .map(o => ({ ...o }));
  },
  get unlocked() { return unlocked; },
  get levels() { return LEVELS; },
};
