// Little Elsewhere — scene library.
// Every scene is drawn in code: a background painter plus twelve small
// objects. Seven of the twelve are picked on each visit, and each picked
// object changes in the "other" picture according to its mutation:
//   0 recolour   1 vanish   2 shrink   3 shift   4 tilt
// All pictures live in a 600 x 440 game-unit space.

const ink = '#314e53';

// ---------- small drawing helpers ----------

function path(c, points, color, stroke) {
  c.beginPath();
  points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
  if (color) { c.fillStyle = color; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.stroke(); }
}

function rect(c, x, y, w, h, color) {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
}

function oval(c, x, y, rx, ry, color) {
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  c.fillStyle = color;
  c.fill();
}

function circle(c, x, y, r, color) {
  oval(c, x, y, r, r, color);
}

function line(c, x, y, x2, y2, color, width = 2) {
  c.strokeStyle = color;
  c.lineWidth = width;
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(x2, y2);
  c.stroke();
}

function house(c, x, y, w, h, color, roof = '#655b70', snow = false) {
  rect(c, x, y, w, h, color);
  path(c, [[x - 8, y], [x + w / 2, y - 35], [x + w + 8, y]], roof);
  if (snow) {
    path(c, [[x - 8, y], [x + w / 2, y - 35], [x + w + 8, y], [x + w - 2, y + 4], [x + w / 2, y - 26], [x + 2, y + 4]], '#f6f1e2');
  }
  for (let a = 12; a < w - 10; a += 27) {
    rect(c, x + a, y + 15, 12, 19, '#f5ce88');
    line(c, x + a + 6, y + 15, x + a + 6, y + 34, color, 2);
  }
  rect(c, x + w / 2 - 9, y + h - 29, 18, 29, '#526166');
}

function tree(c, x, y, s = 1, snow = false) {
  rect(c, x - 3 * s, y - 25 * s, 6 * s, 38 * s, '#6c6c64');
  for (let i = 0; i < 3; i++) {
    path(c, [[x - 26 * s + i * 5 * s, y - i * 19 * s], [x, y - 66 * s - i * 12 * s], [x + 26 * s - i * 5 * s, y - i * 19 * s]], snow ? '#91aba9' : '#4e796c');
    if (snow) {
      path(c, [[x - 17 * s + i * 4 * s, y - i * 19 * s - 7 * s], [x, y - 66 * s - i * 12 * s], [x + 17 * s - i * 4 * s, y - i * 19 * s - 7 * s]], '#e8eeea');
    }
  }
}

// A striped market awning: a flat top band and a scalloped edge.
function awning(c, x, y, w, colorA, colorB) {
  for (let i = 0; i < 6; i++) {
    rect(c, x + (i * w) / 6, y, w / 6, 14, i % 2 ? colorB : colorA);
  }
  for (let i = 0; i < 6; i++) {
    path(c, [[x + (i * w) / 6, y + 14], [x + ((i + 1) * w) / 6, y + 14], [x + ((i + 0.5) * w) / 6, y + 24]], i % 2 ? colorB : colorA);
  }
}

// A sagging string of little glowing bulbs between two points.
function stringLights(c, x1, y1, x2, y2, color) {
  const sag = 26;
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const x = x1 + (x2 - x1) * t;
    const y = y1 + (y2 - y1) * t + Math.sin(t * Math.PI) * sag;
    if (i > 0) {
      const px = x1 + (x2 - x1) * (t - 0.1);
      const py = y1 + (y2 - y1) * (t - 0.1) + Math.sin((t - 0.1) * Math.PI) * sag;
      line(c, px, py, x, y, '#3a3f45', 1.5);
    }
    circle(c, x, y + 4, 4.5, color);
    circle(c, x, y + 4, 2.2, '#fff6cf');
  }
}

// ---------- scene definitions ----------
// Each entry: [name, caption, sky colour, [type, x, y, radius, colour] x 12]

const definitions = [
  ['The quiet harbour', 'Where the day drifts away, one little detail at a time.', '#e6bca4', [
    ['moon', 478, 62, 18, '#f8e8b9'], ['flag', 345, 131, 22, '#cc705b'], ['window', 94, 204, 17, '#efc16c'],
    ['sign', 234, 205, 24, '#476c69'], ['buoy', 529, 284, 17, '#d57b61'], ['boat', 147, 319, 30, '#b65b4e'],
    ['boat', 396, 346, 29, '#d7ac65'], ['pot', 53, 286, 20, '#d88564'], ['bird', 224, 72, 19, '#4b646b'],
    ['crate', 292, 335, 21, '#b78d60'], ['fish', 489, 394, 23, '#abc9bf'], ['lamp', 450, 230, 22, '#ebc576']]],
  ['The Sunday kitchen', 'A warm cup, a slow morning, and something out of place.', '#f0dcc0', [
    ['clock', 479, 70, 24, '#537d79'], ['pot', 73, 147, 20, '#c87d5c'], ['jar', 202, 151, 20, '#d2a94f'],
    ['cup', 303, 153, 20, '#e6b26f'], ['fish', 470, 171, 24, '#91b9ab'], ['kettle', 124, 287, 27, '#578c86'],
    ['cup', 263, 295, 20, '#ca765b'], ['fruit', 399, 301, 21, '#dca34e'], ['jar', 529, 285, 21, '#b1bf86'],
    ['flower', 65, 375, 23, '#e5b474'], ['cloth', 320, 379, 26, '#739b9a'], ['cat', 485, 387, 25, '#d69b70']]],
  ['Snowfall on Juniper Lane', 'Little lights and soft white rooftops. Stay awhile.', '#b6ced4', [
    ['moon', 82, 58, 19, '#fbebc1'], ['star', 288, 61, 18, '#f5d38e'], ['window', 93, 222, 18, '#f7bc63'],
    ['flag', 211, 170, 22, '#c27865'], ['wreath', 341, 211, 20, '#5d8f7a'], ['lamp', 504, 219, 22, '#e9b25c'],
    ['snowman', 219, 317, 27, '#fbf5e5'], ['gift', 376, 326, 22, '#c77b6e'], ['bird', 450, 85, 17, '#8b6571'],
    ['pot', 44, 333, 19, '#b97968'], ['sled', 469, 382, 28, '#b2765a'], ['sign', 109, 391, 23, '#567b80']]],
  ['The sleeping reef', 'Beneath the blue, a whole other world is waking up.', '#83b6b8', [
    ['fish', 89, 95, 25, '#e6ba60'], ['fish', 305, 132, 27, '#d68770'], ['fish', 506, 98, 25, '#e5c18b'],
    ['star', 182, 366, 24, '#d79780'], ['shell', 397, 369, 25, '#eed4b0'], ['coral', 64, 305, 26, '#cc807f'],
    ['coral', 510, 303, 27, '#e2b37e'], ['jelly', 407, 217, 25, '#dbb7ce'], ['seaweed', 244, 289, 27, '#609d89'],
    ['pearl', 317, 395, 18, '#fff3cf'], ['fish', 163, 209, 25, '#a3c78b'], ['shell', 550, 401, 22, '#ddab98']]],
  ['The moonseed conservatory', 'Far from home, familiar things grow a little differently.', '#aab9be', [
    ['planet', 87, 72, 22, '#deb684'], ['star', 473, 70, 18, '#f1d697'], ['flower', 82, 227, 25, '#cf8ca0'],
    ['pot', 235, 220, 22, '#d6a168'], ['jelly', 420, 160, 25, '#a6a0d1'], ['flower', 506, 280, 26, '#e2b86f'],
    ['jar', 336, 299, 22, '#a7c1bb'], ['fruit', 152, 338, 22, '#d69580'], ['cat', 418, 386, 26, '#b19cb9'],
    ['sign', 72, 393, 23, '#65928d'], ['coral', 293, 387, 25, '#8fafa0'], ['moon', 545, 161, 18, '#f1d7ac']]],
  ['The night market', 'Lanterns, low voices, and one stall that is not quite the same.', '#2e3a5c', [
    ['lantern', 92, 96, 22, '#e2725b'], ['kite', 300, 70, 24, '#e8b64c'], ['moon', 508, 62, 18, '#f8e8b9'],
    ['flag', 178, 168, 22, '#c96f5a'], ['sign', 428, 172, 24, '#5d8a7d'], ['pot', 66, 300, 20, '#d88564'],
    ['fruit', 250, 296, 21, '#dca34e'], ['jar', 360, 300, 22, '#c9a86a'], ['fish', 512, 290, 24, '#91b9ab'],
    ['lantern', 470, 380, 22, '#e8a04c'], ['cat', 140, 388, 25, '#c98d68'], ['gift', 330, 388, 22, '#c77b6e']]],
];

// Mutations cycle 0..4 across each scene's twelve objects so every visit
// mixes recolours, vanishings, shrinks, shifts and tilts.
export const scenes = definitions.map(([name, caption, bg, objects], i) => ({
  name,
  caption,
  bg,
  index: i,
  objects: objects.map(([type, x, y, r, color], id) => ({ type, x, y, r, color, id, mutation: id % 5 })),
}));

// Pick `count` differences with a good spatial spread: start from a random
// object, then repeatedly add the object farthest from the ones already
// chosen, with a little jitter so replays still differ. `rand` is the
// caller's seeded random function.
export function pickDifferences(scene, count, rand) {
  const pool = scene.objects.map(o => o.id);
  const chosen = [];
  let first = pool[Math.floor(rand() * pool.length)];
  chosen.push(first);
  while (chosen.length < count && chosen.length < pool.length) {
    let bestId = -1;
    let bestScore = -1;
    for (const id of pool) {
      if (chosen.includes(id)) continue;
      const o = scene.objects[id];
      let nearest = Infinity;
      for (const c of chosen) {
        const p = scene.objects[c];
        const d = (o.x - p.x) ** 2 + (o.y - p.y) ** 2;
        if (d < nearest) nearest = d;
      }
      // Farthest-point wins, but a random nudge keeps rounds from repeating.
      const score = Math.sqrt(nearest) + rand() * 90;
      if (score > bestScore) { bestScore = score; bestId = id; }
    }
    chosen.push(bestId);
  }
  return chosen;
}

// Which quarter of the picture an object sits in, for zone hints.
export function zoneOf(o) {
  return (o.y < 220 ? 'upper' : 'lower') + ' ' + (o.x < 300 ? 'left' : 'right');
}

// ---------- backgrounds ----------

export function background(c, scene) {
  const i = scene.index;
  const g = c.createLinearGradient(0, 0, 0, 440);
  g.addColorStop(0, scene.bg);
  g.addColorStop(1, ['#f3d2ad', '#f9edcf', '#e7efec', '#244e64', '#ddd5be', '#e8a56b'][i]);
  rect(c, 0, 0, 600, 440, g);

  if (i === 0) {
    // Harbour: soft clouds, far hills, a row of houses, the pier and water.
    for (let j = 0; j < 4; j++) oval(c, 80 + j * 144, 80 + (j % 2) * 25, 65, 7, '#f5d4b9');
    path(c, [[0, 193], [100, 152], [189, 188], [280, 139], [430, 187], [600, 141], [600, 290], [0, 290]], '#989d9b');
    rect(c, 0, 263, 600, 177, '#638f96');
    house(c, 28, 172, 123, 110, '#d9aa83');
    house(c, 166, 187, 116, 91, '#d9bf96', '#966e64');
    house(c, 295, 169, 96, 105, '#d18e73');
    house(c, 404, 182, 89, 96, '#e7c49b');
    rect(c, 0, 275, 600, 18, '#7b7470');
    rect(c, 0, 293, 600, 6, '#bca58b');
    for (let j = 0; j < 26; j++) {
      const x = (j * 97) % 600, y = 310 + (j * 31) % 125;
      line(c, x, y, x + 14 + (j % 3) * 10, y, '#9eb8af', 1.5);
    }
    for (let x = 20; x < 600; x += 90) { rect(c, x, 272, 7, 34, '#555e5e'); oval(c, x + 3, 271, 6, 3, '#b99d7e'); }
    path(c, [[0, 391], [280, 365], [310, 440], [0, 440]], '#c5ae8b');
    for (let x = 10; x < 280; x += 40) line(c, x, 391, x + 13, 440, '#af9778', 1);
  } else if (i === 1) {
    // Kitchen: striped wallpaper, a window, shelves and a big wooden table.
    for (let x = 0; x < 600; x += 30) rect(c, x, 0, 1, 440, '#e4cfaf');
    rect(c, 338, 44, 100, 163, '#638c8c');
    rect(c, 346, 52, 84, 146, '#b4d0c4');
    line(c, 388, 52, 388, 198, '#faf0d4', 7);
    line(c, 346, 115, 430, 115, '#faf0d4', 7);
    path(c, [[330, 40], [355, 40], [350, 200], [325, 200]], '#dfaa85');
    path(c, [[425, 40], [446, 40], [450, 200], [430, 200]], '#dfaa85');
    rect(c, 32, 171, 284, 12, '#98795b');
    rect(c, 43, 182, 7, 22, '#98795b');
    rect(c, 290, 182, 7, 22, '#98795b');
    rect(c, 0, 236, 600, 25, '#b5946f');
    rect(c, 0, 261, 600, 105, '#658c80');
    for (let x = 10; x < 600; x += 120) { rect(c, x, 273, 100, 78, '#789d8b'); rect(c, x + 42, 283, 18, 4, '#dfc891'); }
    rect(c, 0, 366, 600, 74, '#c8ad84');
    oval(c, 301, 363, 187, 37, '#ad8b65');
    rect(c, 149, 356, 10, 84, '#8b735d');
    rect(c, 444, 356, 10, 84, '#8b735d');
    oval(c, 301, 349, 195, 30, '#e5cda1');
  } else if (i === 2) {
    // Snowy lane: falling snow, a hill, snow-topped houses and a path.
    for (let j = 0; j < 60; j++) oval(c, (j * 109) % 600, (j * 53) % 280, 1.3, 1.3, '#e9f0e7');
    path(c, [[0, 227], [90, 101], [177, 220], [316, 97], [473, 230], [560, 137], [600, 208], [600, 440], [0, 440]], '#91afb7');
    path(c, [[40, 176], [90, 101], [141, 176], [108, 157], [93, 168], [78, 149]], '#e7ece5');
    rect(c, 0, 278, 600, 162, '#dae8e3');
    house(c, 35, 180, 116, 114, '#9a7a74', '#687c85', true);
    house(c, 280, 170, 121, 119, '#c8967e', '#687c85', true);
    house(c, 426, 213, 99, 83, '#b79881', '#687c85', true);
    tree(c, 563, 291, 1.25, true);
    tree(c, 171, 272, 0.65, true);
    path(c, [[290, 292], [353, 292], [444, 440], [200, 440]], '#b9d0cf');
    oval(c, 81, 324, 70, 13, '#eff3e9');
  } else if (i === 3) {
    // Reef: shafts of light, bubbles, a sandy floor and swaying seaweed.
    for (let x = 0; x < 600; x += 105) path(c, [[x, 0], [x + 40, 0], [x + 155, 440], [x + 55, 440]], '#d1e5c214');
    for (let j = 0; j < 33; j++) {
      c.strokeStyle = '#c5e1cd55'; c.lineWidth = 1;
      c.beginPath(); c.arc((j * 137) % 600, (j * 83) % 400, 2 + j % 4, 0, 7); c.stroke();
    }
    path(c, [[0, 346], [100, 331], [200, 368], [350, 339], [490, 356], [600, 333], [600, 440], [0, 440]], '#b8b799');
    for (let j = 0; j < 16; j++) oval(c, (j * 97) % 600, 409 + (j % 3) * 9, 12, 4, '#939e8e');
    for (let x = 12; x < 600; x += 100) {
      for (let a = 0; a < 3; a++) {
        c.strokeStyle = '#407b73'; c.lineWidth = 7;
        c.beginPath(); c.moveTo(x + a * 8, 410);
        c.quadraticCurveTo(x - 24 + a * 9, 360, x + a * 9, 325 - a * 12); c.stroke();
      }
    }
  } else if (i === 4) {
    // Conservatory: a big glasshouse, shelves and a tiled floor.
    rect(c, 26, 20, 548, 340, '#4b6d73');
    rect(c, 38, 32, 524, 314, '#acc4bd');
    for (let x = 40; x < 570; x += 87) line(c, x, 32, x, 346, '#e0d5b6', 7);
    for (let y = 32; y < 350; y += 105) line(c, 38, y, 562, y, '#e0d5b6', 6);
    path(c, [[26, 20], [300, 0], [574, 20]], '#637e7b');
    rect(c, 0, 349, 600, 91, '#b9aa8c');
    for (let x = 0; x < 600; x += 60) line(c, x, 349, x - 60, 440, '#a89d82', 1);
    rect(c, 32, 248, 240, 13, '#6e8c7a');
    rect(c, 45, 261, 8, 88, '#6e8c7a');
    rect(c, 253, 261, 8, 88, '#6e8c7a');
    rect(c, 303, 322, 261, 13, '#6e8c7a');
    rect(c, 316, 335, 8, 70, '#6e8c7a');
    rect(c, 545, 335, 8, 70, '#6e8c7a');
  } else {
    // Night market: dusk sky, string lights, striped stalls, a cobbled lane.
    for (let j = 0; j < 40; j++) {
      circle(c, (j * 151) % 600, (j * 47) % 130, 1.4, '#f6ead1');
    }
    stringLights(c, 0, 30, 300, 52, '#f2c14e');
    stringLights(c, 300, 52, 600, 26, '#e2725b');
    stringLights(c, 60, 88, 540, 96, '#f2c14e');
    // Three stalls with striped awnings.
    rect(c, 30, 150, 150, 150, '#7a5a4a');
    awning(c, 22, 138, 166, '#e2725b', '#f6ead1');
    rect(c, 55, 190, 100, 60, '#3d4a63');
    rect(c, 230, 150, 150, 150, '#5d6b52');
    awning(c, 222, 138, 166, '#5d8a7d', '#f6ead1');
    rect(c, 255, 190, 100, 60, '#3d4a63');
    rect(c, 430, 150, 140, 150, '#6b4a52');
    awning(c, 422, 138, 156, '#e8a04c', '#f6ead1');
    rect(c, 450, 190, 100, 60, '#3d4a63');
    // Cobbled lane in warm lamplight.
    rect(c, 0, 300, 600, 140, '#8a6f56');
    for (let y = 310; y < 440; y += 26) {
      for (let x = (y % 52 ? 0 : -22); x < 600; x += 44) {
        oval(c, x + 22, y + 12, 20, 10, '#a3856a');
      }
    }
    for (let j = 0; j < 8; j++) {
      circle(c, 60 + j * 70, 318 + (j % 3) * 8, 9, '#f2c14e33');
    }
  }

  // Tiny paper-grain stipples, fixed in the illustration rather than
  // randomized per frame.
  for (let j = 0; j < 950; j++) rect(c, (j * 139.17) % 600, (j * 71.73) % 440, 0.7, 0.7, '#fff2');
}

// ---------- objects ----------

function object(c, o, changed) {
  const { x, y, r, type, mutation } = o;
  let color = o.color;
  if (changed && mutation === 1) return; // vanished
  c.save();
  c.translate(x + (changed && mutation === 3 ? 14 : 0), y);
  if (changed && mutation === 2) c.scale(0.65, 0.65); // shrunk
  if (changed && mutation === 4) c.rotate(0.45); // tilted
  if (changed && mutation === 0) color = '#776aa0'; // recoloured
  const R = (x, y, w, h, col) => rect(c, x, y, w, h, col);
  const E = (x, y, rx, ry, col) => oval(c, x, y, rx, ry, col);
  const L = (x, y, a, b, col, w) => line(c, x, y, a, b, col, w);
  const P = (p, col) => path(c, p, col);

  switch (type) {
    case 'moon':
      E(0, 0, r * 0.8, r * 0.8, color);
      E(6, -5, r * 0.66, r * 0.66, changed && mutation === 0 ? '#b8b9b4' : '#d5b7a2');
      break;
    case 'planet':
      E(0, 0, 16, 16, color);
      c.save(); c.rotate(-0.3);
      c.strokeStyle = '#f6dfb0'; c.lineWidth = 4;
      c.beginPath(); c.ellipse(0, 0, 29, 7, 0, 0, 7); c.stroke();
      c.restore();
      break;
    case 'star': {
      const p = [];
      for (let j = 0; j < 10; j++) {
        const a = (j * Math.PI) / 5 - Math.PI / 2;
        const rad = j % 2 ? 9 : r;
        p.push([Math.cos(a) * rad, Math.sin(a) * rad]);
      }
      P(p, color);
      break;
    }
    case 'flag':
      L(-10, 25, -10, -27, ink, 3);
      P([[-9, -26], [19, -17], [-9, -7]], color);
      break;
    case 'window':
      R(-15, -20, 30, 40, '#5d6f6c');
      R(-11, -16, 22, 32, color);
      L(0, -16, 0, 16, '#f2d6a6', 3);
      L(-11, 0, 11, 0, '#f2d6a6', 3);
      break;
    case 'sign':
      R(-r, -13, r * 2, 26, color);
      L(-10, 13, -10, 32, ink, 3);
      L(10, 13, 10, 32, ink, 3);
      c.fillStyle = '#efe3b9'; c.font = '9px Georgia'; c.textAlign = 'center';
      c.fillText('SLOW', 0, 3);
      break;
    case 'boat':
      P([[-r, -3], [r, -3], [r - 10, 12], [-r + 10, 12]], color);
      L(-3, -3, -3, -48, ink, 2);
      P([[-6, -46], [-6, -8], [-r + 1, -8]], '#f5e3bc');
      P([[1, -38], [1, -8], [r - 2, -8]], '#c4d5c5');
      L(-r, 18, r, 18, '#b3cbc1', 2);
      break;
    case 'buoy':
      E(0, 7, 15, 7, '#466f7b');
      P([[-10, 7], [-5, -16], [5, -16], [10, 7]], color);
      R(-7, -6, 14, 7, '#f8dec0');
      L(0, -16, 0, -26, ink, 2);
      break;
    case 'pot':
      P([[-r, -2], [r, -2], [r - 5, 22], [-r + 5, 22]], color);
      R(-r - 2, -5, r * 2 + 4, 7, '#ae7459');
      for (let j = -1; j <= 1; j++) { L(0, -4, j * 14, -27, ink, 2); E(j * 13, -22, 7, 12, '#658c69'); }
      break;
    case 'bird':
      c.strokeStyle = color; c.lineWidth = 3;
      c.beginPath();
      c.moveTo(-r, 3);
      c.quadraticCurveTo(-r / 2, -11, 0, 1);
      c.quadraticCurveTo(r / 2, -11, r, 3);
      c.stroke();
      break;
    case 'crate':
      R(-r, -r, r * 2, r * 2, color);
      for (let j = -1; j <= 1; j++) L(-r, j * 12, r, j * 12, '#8c6f52', 2);
      L(-r, -r, r, r, '#e0ba80', 4);
      break;
    case 'fish':
      E(0, 0, r * 0.8, r * 0.4, color);
      P([[r * 0.5, 0], [r + 5, -13], [r + 5, 13]], color);
      E(-r * 0.45, -2, 2, 2, ink);
      P([[-5, -9], [6, -19], [12, -7]], color);
      L(0, -8, 0, 8, '#fff5', 2);
      break;
    case 'lamp':
      L(0, 28, 0, -10, ink, 4);
      R(-11, -23, 22, 27, ink);
      R(-7, -19, 14, 18, color);
      P([[-16, -23], [0, -34], [16, -23]], ink);
      break;
    case 'clock':
      E(0, 0, r, r, color);
      E(0, 0, r - 4, r - 4, '#f9edce');
      L(0, 0, -9, -7, ink, 2);
      L(0, 0, 3, -14, ink, 2);
      E(0, 0, 2, 2, ink);
      break;
    case 'jar':
      R(-15, -18, 30, 37, color);
      E(0, 19, 15, 4, color);
      R(-17, -23, 34, 7, '#8b8567');
      R(-10, -8, 20, 17, '#f8e4bd');
      L(-5, 0, 5, 0, color, 2);
      break;
    case 'cup':
      R(-17, -13, 30, 26, color);
      E(-2, 13, 15, 4, color);
      c.strokeStyle = color; c.lineWidth = 5;
      c.beginPath(); c.arc(16, -1, 9, -1.8, 1.8); c.stroke();
      E(-2, -12, 15, 4, '#f2dbb2');
      E(-2, -12, 11, 2, '#796d59');
      break;
    case 'kettle':
      E(0, 0, 24, 22, color);
      P([[-20, -4], [-35, -18], [-33, -4], [-19, 12]], color);
      c.strokeStyle = ink; c.lineWidth = 5;
      c.beginPath(); c.arc(0, -17, 17, Math.PI, 0); c.stroke();
      R(-15, -24, 30, 6, color);
      E(0, -27, 5, 3, ink);
      break;
    case 'fruit':
      E(0, 3, 20, 16, color);
      E(8, -7, 5, 7, '#76966a');
      L(0, -10, 4, -19, ink, 2);
      break;
    case 'flower':
      R(-14, 9, 28, 19, '#bd8f74');
      L(0, 9, 0, -22, '#638867', 3);
      E(-9, -5, 11, 5, '#638867');
      for (let j = 0; j < 6; j++) {
        const a = (j * Math.PI) / 3;
        E(Math.cos(a) * 11, -23 + Math.sin(a) * 11, 7, 7, color);
      }
      E(0, -23, 6, 6, '#f4d694');
      break;
    case 'cloth':
      P([[-r, -12], [r, -12], [r - 4, 18], [-r + 4, 14]], color);
      for (let j = -2; j <= 2; j++) L(j * 8, -10, j * 8 - 2, 14, '#f6ead1', 2);
      break;
    case 'cat':
      E(0, 7, 23, 14, color);
      E(-15, -7, 13, 12, color);
      P([[-27, -11], [-26, -27], [-16, -16]], color);
      P([[-16, -17], [-5, -26], [-4, -9]], color);
      E(-19, -8, 1.5, 2, ink);
      E(-11, -8, 1.5, 2, ink);
      c.strokeStyle = color; c.lineWidth = 7;
      c.beginPath(); c.arc(22, 0, 12, -2, 1.7); c.stroke();
      break;
    case 'wreath':
      E(0, 0, 22, 22, color);
      E(0, 0, 12, 12, '#c8967e');
      E(-13, -12, 4, 4, '#d57f68');
      E(16, 8, 4, 4, '#e5b76e');
      break;
    case 'snowman':
      E(0, 12, 21, 21, color);
      E(0, -15, 15, 15, color);
      R(-18, -31, 36, 4, ink);
      R(-11, -44, 22, 15, ink);
      R(-13, -3, 29, 5, '#c77f69');
      E(-5, -17, 2, 2, ink);
      P([[0, -13], [17, -10], [0, -8]], '#d5a05c');
      for (let y = 8; y < 26; y += 8) E(0, y, 2, 2, ink);
      break;
    case 'gift':
      R(-r, -r, r * 2, r * 2, color);
      R(-3, -r, 6, r * 2, '#ebd496');
      R(-r, -4, r * 2, 6, '#ebd496');
      L(0, -r, -12, -r - 10, '#ebd496', 4);
      L(0, -r, 12, -r - 10, '#ebd496', 4);
      break;
    case 'sled':
      L(-r, 13, r, 13, color, 4);
      L(-r, -6, r, -6, color, 9);
      L(-r + 8, -6, -r + 4, 13, ink, 3);
      L(r - 8, -6, r - 3, 13, ink, 3);
      break;
    case 'shell':
      c.fillStyle = color;
      c.beginPath(); c.moveTo(0, 14); c.arc(0, 0, r, Math.PI, 0); c.closePath(); c.fill();
      for (let j = -2; j <= 2; j++) L(0, 12, j * 8, -12, '#b8928166', 1.5);
      break;
    case 'coral':
      for (let j = -2; j <= 2; j++) {
        L(0, 23, j * 10, -18 + Math.abs(j) * 6, color, 6);
        L(j * 7, 0, j * 11 + 5, -8, color, 4);
      }
      break;
    case 'jelly':
      E(0, 0, r, r * 0.6, color);
      R(-r, 0, r * 2, 8, color);
      for (let j = -2; j <= 2; j++) {
        c.beginPath(); c.strokeStyle = color; c.lineWidth = 2;
        c.moveTo(j * 8, 7);
        c.bezierCurveTo(j * 8 - 9, 19, j * 8 + 9, 29, j * 8, 39);
        c.stroke();
      }
      E(-8, 0, 2, 2, ink);
      E(8, 0, 2, 2, ink);
      break;
    case 'seaweed':
      for (let j = -1; j <= 1; j++) { L(0, 24, j * 16, -24, color, 5); E(j * 13, -17, 7, 15, color); }
      break;
    case 'pearl':
      E(0, 0, 16, 16, color);
      E(-4, -5, 5, 5, '#fff9');
      break;
    case 'lantern': {
      // A paper lantern: ribbed round body, caps, and a tassel.
      E(0, 0, 17, 20, color);
      for (let j = -2; j <= 2; j++) {
        c.strokeStyle = '#fff8'; c.lineWidth = 1.5;
        c.beginPath(); c.ellipse(0, 0, 17 - Math.abs(j) * 3, 20, 0, -1.2, 1.2); c.stroke();
      }
      R(-8, -24, 16, 5, '#8b6f52');
      R(-8, 19, 16, 5, '#8b6f52');
      L(0, 24, 0, 34, '#d9a441', 2);
      E(0, 37, 3, 5, '#d9a441');
      break;
    }
    case 'kite': {
      // A diamond kite with cross spars and a bowed tail.
      P([[0, -26], [20, 0], [0, 24], [-20, 0]], color);
      L(0, -26, 0, 24, '#f6ead1', 2);
      L(-20, 0, 20, 0, '#f6ead1', 2);
      E(0, -2, 4, 4, '#f6ead1');
      for (let j = 1; j <= 3; j++) {
        L(0, 24 + j * 9, j % 2 ? -7 : 7, 24 + j * 9, '#e2725b', 2);
      }
      break;
    }
  }
  c.restore();
}

export function drawScene(c, scene, selected, altered) {
  background(c, scene);
  scene.objects.forEach(o => object(c, o, altered && selected.includes(o.id)));
}
