// Little Elsewhere — the game engine, rewritten.
// Six hand-drawn postcards; spot seven changes in each pair.
// Keyboard and mouse. No network, no build step.
import { scenes, drawScene, pickDifferences, zoneOf } from './scenes.js';

const POSTCARD_COUNT = scenes.length; // 6
const PER_POSTCARD = 7;
const BEST_KEY = 'little-elsewhere-best';
const UNLOCKED_KEY = 'little-elsewhere-unlocked';
const PIC_W = 600;
const PIC_H = 440;

const el = id => document.getElementById(id);
const query = new URLSearchParams(location.search);
const shotMode = query.get('shot');

// Seeded random: a fixed seed makes replays and screenshots reproducible.
let rngState = (Number(query.get('seed')) || Date.now()) >>> 0;
function nextRand() {
  rngState = (rngState + 0x6d2b79f5) >>> 0;
  let a = rngState;
  a = Math.imul(a ^ (a >>> 15), a | 1);
  a = a ^ (a + Math.imul(a ^ (a >>> 7), a | 61));
  return ((a ^ (a >>> 14)) >>> 0) / 4294967296;
}

function freshState() {
  return {
    screen: 'title', level: 0, selected: [], found: [],
    elapsed: 0, mistakes: 0, hints: 3, score: 0, total: 0,
    streak: 0, bestStreak: 0, lastFindAt: 0,
    cursor: { x: 300, y: 220, visible: false },
    hint: null, zone: null, miss: null, lock: 0,
  };
}

class Game {
  constructor() {
    this.state = freshState();
    this.best = 0;
    this.unlocked = 0;
    this.soundOn = true;
    this.musicOn = false;
    this.audio = null;
    this.musicStep = 0;
    this.lastMusicAt = 0;
    this.recentMisses = [];
    this.heldKeys = new Set();
    this.layers = [];
    this.canvases = [el('original'), el('altered')];
    this.contexts = this.canvases.map(c => c.getContext('2d'));
    this.loadProgress();
    this.wireControls();
  }

  loadProgress() {
    try { this.best = Number(localStorage.getItem(BEST_KEY)) || 0; } catch {}
    try { this.unlocked = Number(localStorage.getItem(UNLOCKED_KEY)) || 0; } catch {}
    this.unlocked = Math.max(0, Math.min(POSTCARD_COUNT - 1, this.unlocked));
  }

  storeUnlocked() {
    try { localStorage.setItem(UNLOCKED_KEY, String(this.unlocked)); } catch {}
  }

  storeBest() {
    try { localStorage.setItem(BEST_KEY, String(this.best)); } catch {}
  }

  // ---------- audio ----------

  playTone(freq, dur = 0.15, vol = 0.06, kind = 'sine', delay = 0) {
    if (!this.audio) return;
    const osc = this.audio.createOscillator();
    const gain = this.audio.createGain();
    const at = this.audio.currentTime + delay;
    osc.type = kind;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(vol, at + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, at + dur);
    osc.connect(gain);
    gain.connect(this.audio.destination);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  }

  ensureAudio() {
    if (!this.audio) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (Ctor) this.audio = new Ctor();
    }
    if (this.audio && this.audio.state === 'suspended') this.audio.resume();
  }

  // ---------- helpers ----------

  say(text) {
    el('status').textContent = text;
  }

  clockText(seconds) {
    const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
    const ss = String(Math.floor(seconds % 60)).padStart(2, '0');
    return mm + ':' + ss;
  }

  // Points for a find: a fast, clean find is worth more, and a streak of
  // finds without a miss multiplies it. The formula is shown on the
  // level-complete card so the score is never a mystery.
  findValue() {
    const s = this.state;
    const base = Math.max(150, 500 - Math.floor(s.elapsed) * 2 - s.mistakes * 20);
    const mult = 1 + 0.25 * Math.min(s.streak, 8);
    return Math.round(base * mult);
  }

  refreshHud() {
    const s = this.state;
    const scene = scenes[s.level];
    el('chapter').textContent = 'POSTCARD ' + String(s.level + 1).padStart(2, '0') + ' / ' + String(POSTCARD_COUNT).padStart(2, '0');
    el('scene-name').textContent = scene.name;
    el('caption').textContent = scene.caption;
    el('remaining').textContent = (PER_POSTCARD - s.found.length) + ' left';
    el('found').textContent = s.found.length + ' OF ' + PER_POSTCARD + ' DISCOVERED';
    el('time').textContent = this.clockText(s.elapsed);
    el('mistakes').textContent = s.mistakes;
    el('score').textContent = (s.total + s.score).toLocaleString();
    el('streak').textContent = s.streak > 1 ? 'x' + s.streak : '—';
    el('hints').textContent = s.hints;
    el('hint').disabled = s.hints === 0 || s.screen !== 'playing';
    el('progress').innerHTML = Array.from({ length: PER_POSTCARD }, (_, i) =>
      '<i class="' + (i < s.found.length ? 'done' : '') + '"></i>').join('');
  }

  // ---------- level setup ----------

  startLevel(level) {
    const s = this.state;
    s.level = level;
    // Spread the seven differences across the picture instead of letting
    // them clump in one corner.
    s.selected = pickDifferences(scenes[level], PER_POSTCARD, nextRand);
    Object.assign(s, {
      found: [], elapsed: 0, mistakes: 0, hints: 3, score: 0,
      streak: 0, bestStreak: 0, lastFindAt: 0,
      hint: null, zone: null, miss: null, lock: 0,
    });
    this.recentMisses = [];
    this.layers = [0, 1].map(altered => {
      const c = document.createElement('canvas');
      c.width = 1200;
      c.height = 880;
      const g = c.getContext('2d');
      g.scale(2, 2);
      drawScene(g, scenes[level], s.selected, !!altered);
      return c;
    });
    this.refreshHud();
  }

  // ---------- screens ----------

  postcardButtons() {
    const s = this.state;
    const cards = scenes.map((scene, i) => {
      const locked = i > this.unlocked;
      const done = i < this.unlocked;
      const mark = locked ? 'locked' : done ? '✓ collected' : 'open';
      return '<button class="postcard' + (locked ? ' locked' : '') + (i === s.level ? ' current' : '') +
        '" data-level="' + i + '"' + (locked ? ' disabled' : '') + '>' +
        '<span class="postcard-num">' + String(i + 1).padStart(2, '0') + '</span>' +
        '<span class="postcard-name">' + scene.name + '</span>' +
        '<span class="postcard-mark">' + mark + '</span></button>';
    }).join('');
    return '<div class="postcard-grid">' + cards + '</div>';
  }

  showScreen(screen) {
    const s = this.state;
    s.screen = screen;
    this.heldKeys.clear();
    el('overlay').classList.toggle('hidden', screen === 'playing');
    el('pause').disabled = screen === 'title' || screen === 'complete' || screen === 'final';
    const card = el('card');

    if (screen === 'title') {
      card.innerHTML = '<div class="seal">◎</div>' +
        '<span class="eyebrow">SIX PLACES. FORTY-TWO LITTLE SECRETS.</span>' +
        '<h2>See the little<br>things differently.</h2>' +
        '<p>Welcome to <em>Little Elsewhere.</em><br>Explore six hand-drawn worlds. Find seven changes<br>in each pair of pictures. No rush. Just a closer look.</p>' +
        '<button class="primary" id="continue">Begin exploring →</button>' +
        '<p>Or jump straight to a postcard you have unlocked:</p>' +
        this.postcardButtons() +
        '<p>Click a changed detail in either picture.</p>' +
        '<div class="instructions"><kbd>↑ ↓ ← →</kbd> or <kbd>W A S D</kbd> move · <kbd>SHIFT</kbd> faster<br>' +
        '<kbd>SPACE / ENTER</kbd> check · <kbd>H</kbd> hint · <kbd>P / ESC</kbd> pause<br>' +
        '<kbd>M</kbd> music · <kbd>N</kbd> sound</div>';
    }

    if (screen === 'paused') {
      card.innerHTML = '<div class="seal">Ⅱ</div>' +
        '<span class="eyebrow">A MOMENT TO YOURSELF</span>' +
        '<h2>The world can wait.</h2>' +
        '<p>Your discoveries are safe.<br>Come back whenever you’re ready.</p>' +
        '<button class="primary" id="continue">Keep looking →</button>' +
        '<div class="instructions">Press P, Esc, Enter or Space to resume.</div>';
    }

    if (screen === 'complete' || screen === 'final') {
      const isFinal = screen === 'final';
      const stars = s.mistakes < 2 && s.hints >= 2 ? 3 : s.mistakes < 5 ? 2 : 1;
      const heading = isFinal ? 'A wonderful eye.' : 'Beautifully noticed.';
      const blurb = isFinal
        ? 'Six worlds, forty-two discoveries. Thank you for slowing down.'
        : scenes[s.level].name + ' has shared all its secrets.';
      const total = isFinal ? s.total + s.score : s.score;
      const note = isFinal
        ? 'Personal best · ' + this.best.toLocaleString()
        : 'Finished a postcard: +1 hint for the next one.';
      const nextLabel = isFinal ? 'Explore again' : s.level === POSTCARD_COUNT - 1 ? 'View collection' : 'Next postcard';
      const foot = isFinal
        ? 'Every visit reveals a new selection of details.'
        : (s.level + 1) + ' of ' + POSTCARD_COUNT + ' postcards collected · Enter to continue';
      card.innerHTML = '<div class="stars">' + '★'.repeat(stars) + '☆'.repeat(3 - stars) + '</div>' +
        '<span class="eyebrow">' + (isFinal ? 'YOUR COLLECTION IS COMPLETE' : 'POSTCARD DISCOVERED') + '</span>' +
        '<h2>' + heading + '</h2>' +
        '<p>' + blurb + '</p>' +
        '<div class="result-stats">' +
        '<div><b>' + this.clockText(s.elapsed) + '</b><span>TIME</span></div>' +
        '<div><b>' + s.mistakes + '</b><span>MISTAKES</span></div>' +
        '<div><b>' + s.bestStreak + '</b><span>BEST STREAK</span></div>' +
        '<div><b>' + total + '</b><span>' + (isFinal ? 'TOTAL SCORE' : 'POSTCARD SCORE') + '</span></div>' +
        '</div>' +
        '<p>' + note + '</p>' +
        '<button class="primary" id="continue">' + nextLabel + ' →</button>' +
        '<div class="instructions">' + foot + '</div>';
    }

    el('continue')?.addEventListener('click', () => this.advance());
    card.querySelectorAll('.postcard:not(.locked)').forEach(b => {
      b.addEventListener('click', () => {
        this.ensureAudio();
        this.state.total = 0;
        this.startLevel(Number(b.dataset.level));
        this.showScreen('playing');
        this.say('Seven differences to discover in ' + scenes[this.state.level].name + '.');
      });
    });
    this.refreshHud();
  }

  advance() {
    this.ensureAudio();
    const s = this.state;
    if (s.screen === 'title' || s.screen === 'final') {
      s.total = 0;
      this.startLevel(0);
      this.showScreen('playing');
      this.say('Seven differences to discover.');
    } else if (s.screen === 'paused') {
      this.showScreen('playing');
    } else if (s.screen === 'complete') {
      if (s.level === POSTCARD_COUNT - 1) {
        this.best = Math.max(this.best, s.total + s.score);
        this.storeBest();
        this.showScreen('final');
      } else {
        s.total += s.score;
        // Finishing a postcard earns a hint for the next one (max five).
        s.hints = Math.min(5, s.hints + 1);
        this.startLevel(s.level + 1);
        this.showScreen('playing');
      }
    }
  }

  // ---------- playing ----------

  probe(x, y) {
    const s = this.state;
    if (s.screen !== 'playing' || s.lock > 0) return;
    this.ensureAudio();
    const hit = scenes[s.level].objects.find(o =>
      s.selected.includes(o.id) &&
      ((x - o.x) / (o.r + 13)) ** 2 + ((y - (o.y - 8)) / (o.r + 25)) ** 2 <= 1);
    if (hit) {
      if (s.found.some(f => f.id === hit.id)) return;
      s.found.push({ id: hit.id, at: performance.now() });
      // A find within eight seconds of the previous one extends the streak.
      if (performance.now() - s.lastFindAt < 8000) s.streak += 1;
      else s.streak = 1;
      s.lastFindAt = performance.now();
      s.bestStreak = Math.max(s.bestStreak, s.streak);
      s.score += this.findValue();
      if (this.soundOn) {
        this.playTone(659);
        this.playTone(880, 0.3, 0.05, 'sine', 0.09);
      }
      this.say('Found! ' + (PER_POSTCARD - s.found.length) + ' differences remaining.');
      if (s.found.length === PER_POSTCARD) {
        s.score += s.hints * 100;
        // Unlock the next postcard for the level-select grid.
        if (s.level < POSTCARD_COUNT - 1 && this.unlocked < s.level + 1) {
          this.unlocked = s.level + 1;
          this.storeUnlocked();
        }
        this.showScreen('complete');
      }
    } else {
      s.mistakes++;
      s.elapsed += 5;
      s.score = Math.max(0, s.score - 50);
      s.streak = 0;
      s.miss = { x, y, life: 1.1 };
      this.recentMisses = this.recentMisses.filter(t => performance.now() - t < 1600);
      this.recentMisses.push(performance.now());
      if (this.recentMisses.length >= 3) {
        s.lock = 2;
        this.say('Take a breath. Clicks paused for two seconds.');
      } else {
        this.say('Not quite. Five seconds added.');
      }
      if (this.soundOn) this.playTone(155, 0.18, 0.05, 'triangle');
    }
    this.refreshHud();
  }

  giveHint() {
    const s = this.state;
    if (s.screen !== 'playing' || !s.hints) return;
    this.ensureAudio();
    // If a zone is already glowing, the next hint pinpoints the exact spot.
    if (s.zone) {
      const o = scenes[s.level].objects[s.zone.id];
      s.hint = { id: o.id, life: 4 };
      s.zone = null;
      s.hints--;
      this.say('A hint is glowing on the ' + zoneOf(o) + '. ' + s.hints + ' hints left.');
    } else {
      // Pick a random unfound difference (never the same one every time),
      // and first show only its quarter of the picture.
      const remaining = scenes[s.level].objects.filter(o =>
        s.selected.includes(o.id) && !s.found.some(f => f.id === o.id));
      if (!remaining.length) return;
      const o = remaining[Math.floor(nextRand() * remaining.length)];
      s.zone = { id: o.id, life: 5 };
      s.hints--;
      this.say('Look in the ' + zoneOf(o) + '. Press H again to pinpoint it. ' + s.hints + ' hints left.');
    }
    if (this.soundOn) this.playTone(523, 0.4, 0.04);
    this.refreshHud();
  }

  togglePause() {
    if (this.state.screen === 'playing') this.showScreen('paused');
    else if (this.state.screen === 'paused') this.showScreen('playing');
  }

  toggleSound() {
    this.soundOn = !this.soundOn;
    el('sound').textContent = 'Sound ' + (this.soundOn ? 'on' : 'off');
  }

  toggleMusic() {
    this.ensureAudio();
    this.musicOn = !this.musicOn;
    el('music').textContent = 'Music ' + (this.musicOn ? 'on' : 'off');
  }

  // ---------- input ----------

  wireControls() {
    el('hint').onclick = () => this.giveHint();
    el('pause').onclick = () => this.togglePause();
    el('sound').onclick = () => this.toggleSound();
    el('music').onclick = () => this.toggleMusic();

    this.canvases.forEach(c => {
      const position = e => {
        const r = c.getBoundingClientRect();
        this.state.cursor = {
          x: (e.clientX - r.left) / r.width * PIC_W,
          y: (e.clientY - r.top) / r.height * PIC_H,
          visible: true,
        };
      };
      c.addEventListener('pointermove', position);
      c.addEventListener('pointerdown', e => {
        position(e);
        c.focus();
        this.probe(this.state.cursor.x, this.state.cursor.y);
      });
    });

    document.addEventListener('keydown', e => {
      if (e.target.tagName === 'BUTTON' && (e.key === 'Enter' || e.key === ' ')) return;
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'enter', 'escape'].includes(k)) e.preventDefault();
      this.heldKeys.add(k);
      if (e.repeat) return;
      if (k === 'm') this.toggleMusic();
      else if (k === 'n') this.toggleSound();
      if (k === 'h') this.giveHint();
      if (k === 'p' || k === 'escape') this.togglePause();
      if (k === ' ' || k === 'enter') {
        if (this.state.screen === 'playing') this.probe(this.state.cursor.x, this.state.cursor.y);
        else this.advance();
      }
    });
    document.addEventListener('keyup', e => this.heldKeys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => {
      this.heldKeys.clear();
      if (this.state.screen === 'playing' && !shotMode) this.showScreen('paused');
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state.screen === 'playing' && !shotMode) this.showScreen('paused');
    });
  }

  // ---------- rendering ----------

  drawRing(g, x, y, r, colour) {
    g.lineWidth = 2.5;
    g.strokeStyle = colour;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.stroke();
  }

  paint(now) {
    const s = this.state;
    this.contexts.forEach((g, i) => {
      const canvas = this.canvases[i];
      const r = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.round(r.width * dpr);
      const h = Math.round(r.height * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      g.setTransform(w / PIC_W, 0, 0, h / PIC_H, 0, 0);
      g.drawImage(this.layers[i], 0, 0, PIC_W, PIC_H);

      // The zone hint: a soft glowing quarter of the picture.
      if (s.zone) {
        const o = scenes[s.level].objects[s.zone.id];
        const zx = o.x < 300 ? 0 : 300;
        const zy = o.y < 220 ? 0 : 220;
        const pulse = 0.10 + 0.05 * Math.sin(now / 240);
        g.fillStyle = 'rgba(244, 207, 113, ' + pulse + ')';
        g.fillRect(zx, zy, 300, 220);
        g.strokeStyle = '#f4cf71';
        g.lineWidth = 2;
        g.setLineDash([8, 6]);
        g.strokeRect(zx + 2, zy + 2, 296, 216);
        g.setLineDash([]);
      }

      s.found.forEach(f => {
        const o = scenes[s.level].objects[f.id];
        const pulse = shotMode ? 0 : Math.max(0, 1 - (now - f.at) / 450) * 8;
        this.drawRing(g, o.x, o.y - 6, o.r + 15 + pulse, '#fff7d9');
        this.drawRing(g, o.x, o.y - 6, o.r + 12 + pulse, '#2d6b57');
        g.fillStyle = '#2d6b57';
        g.beginPath();
        g.arc(o.x + o.r + 6, o.y - o.r - 5, 7, 0, 7);
        g.fill();
        g.fillStyle = 'white';
        g.font = '10px Arial';
        g.textAlign = 'center';
        g.fillText('✓', o.x + o.r + 6, o.y - o.r - 2);
      });

      if (s.hint) {
        const o = scenes[s.level].objects[s.hint.id];
        this.drawRing(g, o.x, o.y - 8, o.r + 24 + Math.sin(now / 220) * 5, '#ffe7a0');
        this.drawRing(g, o.x, o.y - 8, o.r + 28 + Math.sin(now / 220) * 5, '#f4cf7199');
      }

      if (s.miss) {
        const { x, y } = s.miss;
        g.strokeStyle = '#c7544b';
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(x - 9, y - 9);
        g.lineTo(x + 9, y + 9);
        g.moveTo(x + 9, y - 9);
        g.lineTo(x - 9, y + 9);
        g.stroke();
      }

      if (s.cursor.visible && s.screen === 'playing') {
        const { x, y } = s.cursor;
        g.strokeStyle = '#fff9';
        g.lineWidth = 4;
        g.beginPath();
        g.arc(x, y, 9, 0, 7);
        g.stroke();
        this.drawRing(g, x, y, 9, '#284e49');
        g.strokeStyle = '#284e49';
        g.lineWidth = 1;
        for (let a = 0; a < 4; a++) {
          g.save();
          g.translate(x, y);
          g.rotate((a * Math.PI) / 2);
          g.beginPath();
          g.moveTo(5, 0);
          g.lineTo(15, 0);
          g.stroke();
          g.restore();
        }
      }

      if (s.lock > 0) {
        g.fillStyle = '#244a4688';
        g.fillRect(0, 0, PIC_W, PIC_H);
        g.fillStyle = '#fff';
        g.font = '19px Georgia';
        g.textAlign = 'center';
        g.fillText('A breath. A second glance.', 300, 220);
      }
    });
  }

  // ---------- main loop ----------

  tick(now, previous) {
    const s = this.state;
    const dt = Math.min(0.05, (now - previous) / 1000);
    if (!shotMode) {
      if (s.screen === 'playing') {
        s.elapsed += dt;
        s.lock = Math.max(0, s.lock - dt);
        for (const prop of ['hint', 'miss']) {
          if (s[prop]) {
            s[prop].life -= dt;
            if (s[prop].life <= 0) s[prop] = null;
          }
        }
        if (s.zone) {
          s.zone.life -= dt;
          if (s.zone.life <= 0) s.zone = null;
        }
        const dx = (this.heldKeys.has('arrowright') || this.heldKeys.has('d') ? 1 : 0) -
          (this.heldKeys.has('arrowleft') || this.heldKeys.has('a') ? 1 : 0);
        const dy = (this.heldKeys.has('arrowdown') || this.heldKeys.has('s') ? 1 : 0) -
          (this.heldKeys.has('arrowup') || this.heldKeys.has('w') ? 1 : 0);
        if (dx || dy) {
          s.cursor.visible = true;
          const speed = this.heldKeys.has('shift') ? 260 : 110;
          s.cursor.x = Math.max(0, Math.min(PIC_W, s.cursor.x + dx * speed * dt));
          s.cursor.y = Math.max(0, Math.min(PIC_H, s.cursor.y + dy * speed * dt));
        }
        el('time').textContent = this.clockText(s.elapsed);
      }
      if (this.musicOn && this.audio && s.screen === 'playing' && now - this.lastMusicAt > 480) {
        this.lastMusicAt = now;
        const notes = [261.63, 329.63, 392, 493.88, 440, 392, 329.63, 293.66];
        this.playTone(notes[this.musicStep++ % 8] / 2, 0.8, 0.018);
        this.playTone(notes[(this.musicStep + 2) % 8], 0.7, 0.012);
      }
      this.paint(now);
    }
  }

  boot() {
    this.startLevel(0);
    this.showScreen('title');

    // Screenshot mode (?shot=play|hint|complete): stage a fixed scene so
    // the pictures are reproducible, then signal readiness.
    if (shotMode) {
      if (shotMode === 'play' || shotMode === 'hint' || shotMode === 'complete') {
        this.startLevel(shotMode === 'hint' ? 3 : 0);
        this.showScreen('playing');
        const count = shotMode === 'complete' ? 7 : shotMode === 'play' ? 4 : 2;
        const s = this.state;
        s.found = s.selected.slice(0, count).map(id => ({ id, at: 0 }));
        s.elapsed = shotMode === 'complete' ? 104 : 76;
        s.score = count * 420;
        s.cursor = { x: 365, y: 270, visible: true };
        if (shotMode === 'hint') {
          s.hints = 2;
          s.hint = { id: s.selected[2], life: 99 };
          s.miss = { x: 325, y: 240, life: 99 };
          s.mistakes = 1;
        }
        if (shotMode === 'complete') this.showScreen('complete');
        this.refreshHud();
      }
      requestAnimationFrame(() => {
        this.paint(800);
        requestAnimationFrame(() => {
          this.paint(800);
          window.__shotReady = true;
        });
      });
    }

    let previous = performance.now();
    const frame = now => {
      this.tick(now, previous);
      previous = now;
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
}

const game = new Game();
game.boot();

// Read-only test surface: no action shortcuts or answer overlays in the game.
window.__game = {
  get state() { return JSON.parse(JSON.stringify(game.state)); },
  get differences() {
    return scenes[game.state.level].objects
      .filter(o => game.state.selected.includes(o.id))
      .map(o => ({ ...o }));
  },
  get unlocked() { return game.unlocked; },
  get levels() { return POSTCARD_COUNT; },
};
