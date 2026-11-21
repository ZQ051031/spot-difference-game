// Little Elsewhere — scene library, rewritten from scratch.
// Every postcard is drawn in code from data: a sky, a backdrop, and twelve
// small objects. Seven of the twelve are picked on each visit, and each
// picked object changes in the "other" picture by its mutation:
//   recolour, vanish, shrink, shift, tilt — cycled across the twelve.
// All pictures live in a 600 x 440 game-unit space.

const INK = '#314e53';
const MUTATIONS = ['recolour', 'vanish', 'shrink', 'shift', 'tilt'];

// ---------- a small drawing vocabulary ----------
// Each helper takes the context and one options object, so a call reads as
// a small description of the shape it draws.
function box(g, o) {
  g.fillStyle = o.fill;
  g.fillRect(o.x, o.y, o.w, o.h);
}

function disc(g, o) {
  g.beginPath();
  g.ellipse(o.x, o.y, o.rx, o.ry, 0, 0, Math.PI * 2);
  g.fillStyle = o.fill;
  g.fill();
}

function poly(g, o) {
  g.beginPath();
  o.pts.forEach((p, i) => {
    if (i) g.lineTo(p[0], p[1]);
    else g.moveTo(p[0], p[1]);
  });
  g.closePath();
  if (o.fill) {
    g.fillStyle = o.fill;
    g.fill();
  }
  if (o.stroke) {
    g.strokeStyle = o.stroke;
    g.stroke();
  }
}

function seg(g, o) {
  g.strokeStyle = o.stroke;
  g.lineWidth = o.w === undefined ? 2 : o.w;
  g.beginPath();
  g.moveTo(o.x1, o.y1);
  g.lineTo(o.x2, o.y2);
  g.stroke();
}

function dot(g, o) {
  disc(g, { x: o.x, y: o.y, rx: o.r, ry: o.r, fill: o.fill });
}

function wash(g, top, bottom) {
  const grad = g.createLinearGradient(0, 0, 0, 440);
  grad.addColorStop(0, top);
  grad.addColorStop(1, bottom);
  return grad;
}

// A cottage: a box, a pitched roof, lit windows and a door. Snow caps the
// roof when the scene is wintry.
function cottage(g, o) {
  box(g, { x: o.x, y: o.y, w: o.w, h: o.h, fill: o.fill });
  poly(g, { pts: [[o.x - 8, o.y], [o.x + o.w / 2, o.y - 35], [o.x + o.w + 8, o.y]], fill: o.roof || '#655b70' });
  if (o.snow) {
    poly(g, { pts: [[o.x - 8, o.y], [o.x + o.w / 2, o.y - 35], [o.x + o.w + 8, o.y], [o.x + o.w - 2, o.y + 4], [o.x + o.w / 2, o.y - 26], [o.x + 2, o.y + 4]], fill: '#f6f1e2' });
  }
  for (let a = 12; a < o.w - 10; a += 27) {
    box(g, { x: o.x + a, y: o.y + 15, w: 12, h: 19, fill: '#f5ce88' });
    seg(g, { x1: o.x + a + 6, y1: o.y + 15, x2: o.x + a + 6, y2: o.y + 34, stroke: o.fill, w: 2 });
  }
  box(g, { x: o.x + o.w / 2 - 9, y: o.y + o.h - 29, w: 18, h: 29, fill: '#526166' });
}

// A pine: a trunk and three stacked tiers. Snow dusts the tiers in winter.
function pine(g, o) {
  const s = o.s === undefined ? 1 : o.s;
  box(g, { x: o.x - 3 * s, y: o.y - 25 * s, w: 6 * s, h: 38 * s, fill: '#6c6c64' });
  for (let i = 0; i < 3; i++) {
    poly(g, { pts: [[o.x - 26 * s + i * 5 * s, o.y - i * 19 * s], [o.x, o.y - 66 * s - i * 12 * s], [o.x + 26 * s - i * 5 * s, o.y - i * 19 * s]], fill: o.snow ? '#91aba9' : '#4e796c' });
    if (o.snow) {
      poly(g, { pts: [[o.x - 17 * s + i * 4 * s, o.y - i * 19 * s - 7 * s], [o.x, o.y - 66 * s - i * 12 * s], [o.x + 17 * s - i * 4 * s, o.y - i * 19 * s - 7 * s]], fill: '#e8eeea' });
    }
  }
}

// A striped market canopy: a flat band of alternating stripes and a
// scalloped lower edge.
function canopy(g, o) {
  for (let i = 0; i < 6; i++) {
    box(g, { x: o.x + (i * o.w) / 6, y: o.y, w: o.w / 6, h: 14, fill: i % 2 ? o.b : o.a });
  }
  for (let i = 0; i < 6; i++) {
    poly(g, { pts: [[o.x + (i * o.w) / 6, o.y + 14], [o.x + ((i + 1) * o.w) / 6, o.y + 14], [o.x + ((i + 0.5) * o.w) / 6, o.y + 24]], fill: i % 2 ? o.b : o.a });
  }
}

// A sagging string of little glowing bulbs between two points.
function fairyLights(g, o) {
  const sag = 26;
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const x = o.x1 + (o.x2 - o.x1) * t;
    const y = o.y1 + (o.y2 - o.y1) * t + Math.sin(t * Math.PI) * sag;
    if (i > 0) {
      const px = o.x1 + (o.x2 - o.x1) * (t - 0.1);
      const py = o.y1 + (o.y2 - o.y1) * (t - 0.1) + Math.sin((t - 0.1) * Math.PI) * sag;
      seg(g, { x1: px, y1: py, x2: x, y2: y, stroke: '#3a3f45', w: 1.5 });
    }
    dot(g, { x, y: y + 4, r: 4.5, fill: o.fill });
    dot(g, { x, y: y + 4, r: 2.2, fill: '#fff6cf' });
  }
}

// ---------- scene definitions ----------
// Each postcard: a name, a caption, the sky and ground colours of its
// gradient, and twelve spots — {kind, x, y, r, hue}.

const POSTCARDS = [
  {
    name: 'The quiet harbour',
    caption: 'Where the day drifts away, one little detail at a time.',
    sky: '#e6bca4', ground: '#f3d2ad',
    spots: [
      { kind: 'moon', x: 478, y: 62, r: 18, hue: '#f8e8b9' },
      { kind: 'flag', x: 345, y: 131, r: 22, hue: '#cc705b' },
      { kind: 'window', x: 94, y: 204, r: 17, hue: '#efc16c' },
      { kind: 'sign', x: 234, y: 205, r: 24, hue: '#476c69' },
      { kind: 'buoy', x: 529, y: 284, r: 17, hue: '#d57b61' },
      { kind: 'boat', x: 147, y: 319, r: 30, hue: '#b65b4e' },
      { kind: 'boat', x: 396, y: 346, r: 29, hue: '#d7ac65' },
      { kind: 'pot', x: 53, y: 286, r: 20, hue: '#d88564' },
      { kind: 'bird', x: 224, y: 72, r: 19, hue: '#4b646b' },
      { kind: 'crate', x: 292, y: 335, r: 21, hue: '#b78d60' },
      { kind: 'fish', x: 489, y: 394, r: 23, hue: '#abc9bf' },
      { kind: 'lamp', x: 450, y: 230, r: 22, hue: '#ebc576' },
    ],
  },
  {
    name: 'The Sunday kitchen',
    caption: 'A warm cup, a slow morning, and something out of place.',
    sky: '#f0dcc0', ground: '#f9edcf',
    spots: [
      { kind: 'clock', x: 479, y: 70, r: 24, hue: '#537d79' },
      { kind: 'pot', x: 73, y: 147, r: 20, hue: '#c87d5c' },
      { kind: 'jar', x: 202, y: 151, r: 20, hue: '#d2a94f' },
      { kind: 'cup', x: 303, y: 153, r: 20, hue: '#e6b26f' },
      { kind: 'fish', x: 470, y: 171, r: 24, hue: '#91b9ab' },
      { kind: 'kettle', x: 124, y: 287, r: 27, hue: '#578c86' },
      { kind: 'cup', x: 263, y: 295, r: 20, hue: '#ca765b' },
      { kind: 'fruit', x: 399, y: 301, r: 21, hue: '#dca34e' },
      { kind: 'jar', x: 529, y: 285, r: 21, hue: '#b1bf86' },
      { kind: 'flower', x: 65, y: 375, r: 23, hue: '#e5b474' },
      { kind: 'cloth', x: 320, y: 379, r: 26, hue: '#739b9a' },
      { kind: 'cat', x: 485, y: 387, r: 25, hue: '#d69b70' },
    ],
  },
  {
    name: 'Snowfall on Juniper Lane',
    caption: 'Little lights and soft white rooftops. Stay awhile.',
    sky: '#b6ced4', ground: '#e7efec',
    spots: [
      { kind: 'moon', x: 82, y: 58, r: 19, hue: '#fbebc1' },
      { kind: 'star', x: 288, y: 61, r: 18, hue: '#f5d38e' },
      { kind: 'window', x: 93, y: 222, r: 18, hue: '#f7bc63' },
      { kind: 'flag', x: 211, y: 170, r: 22, hue: '#c27865' },
      { kind: 'wreath', x: 341, y: 211, r: 20, hue: '#5d8f7a' },
      { kind: 'lamp', x: 504, y: 219, r: 22, hue: '#e9b25c' },
      { kind: 'snowman', x: 219, y: 317, r: 27, hue: '#fbf5e5' },
      { kind: 'gift', x: 376, y: 326, r: 22, hue: '#c77b6e' },
      { kind: 'bird', x: 450, y: 85, r: 17, hue: '#8b6571' },
      { kind: 'pot', x: 44, y: 333, r: 19, hue: '#b97968' },
      { kind: 'sled', x: 469, y: 382, r: 28, hue: '#b2765a' },
      { kind: 'sign', x: 109, y: 391, r: 23, hue: '#567b80' },
    ],
  },
  {
    name: 'The sleeping reef',
    caption: 'Beneath the blue, a whole other world is waking up.',
    sky: '#83b6b8', ground: '#244e64',
    spots: [
      { kind: 'fish', x: 89, y: 95, r: 25, hue: '#e6ba60' },
      { kind: 'fish', x: 305, y: 132, r: 27, hue: '#d68770' },
      { kind: 'fish', x: 506, y: 98, r: 25, hue: '#e5c18b' },
      { kind: 'star', x: 182, y: 366, r: 24, hue: '#d79780' },
      { kind: 'shell', x: 397, y: 369, r: 25, hue: '#eed4b0' },
      { kind: 'coral', x: 64, y: 305, r: 26, hue: '#cc807f' },
      { kind: 'coral', x: 510, y: 303, r: 27, hue: '#e2b37e' },
      { kind: 'jelly', x: 407, y: 217, r: 25, hue: '#dbb7ce' },
      { kind: 'seaweed', x: 244, y: 289, r: 27, hue: '#609d89' },
      { kind: 'pearl', x: 317, y: 395, r: 18, hue: '#fff3cf' },
      { kind: 'fish', x: 163, y: 209, r: 25, hue: '#a3c78b' },
      { kind: 'shell', x: 550, y: 401, r: 22, hue: '#ddab98' },
    ],
  },
  {
    name: 'The moonseed conservatory',
    caption: 'Far from home, familiar things grow a little differently.',
    sky: '#aab9be', ground: '#ddd5be',
    spots: [
      { kind: 'planet', x: 87, y: 72, r: 22, hue: '#deb684' },
      { kind: 'star', x: 473, y: 70, r: 18, hue: '#f1d697' },
      { kind: 'flower', x: 82, y: 227, r: 25, hue: '#cf8ca0' },
      { kind: 'pot', x: 235, y: 220, r: 22, hue: '#d6a168' },
      { kind: 'jelly', x: 420, y: 160, r: 25, hue: '#a6a0d1' },
      { kind: 'flower', x: 506, y: 280, r: 26, hue: '#e2b86f' },
      { kind: 'jar', x: 336, y: 299, r: 22, hue: '#a7c1bb' },
      { kind: 'fruit', x: 152, y: 338, r: 22, hue: '#d69580' },
      { kind: 'cat', x: 418, y: 386, r: 26, hue: '#b19cb9' },
      { kind: 'sign', x: 72, y: 393, r: 23, hue: '#65928d' },
      { kind: 'coral', x: 293, y: 387, r: 25, hue: '#8fafa0' },
      { kind: 'moon', x: 545, y: 161, r: 18, hue: '#f1d7ac' },
    ],
  },
  {
    name: 'The night market',
    caption: 'Lanterns, low voices, and one stall that is not quite the same.',
    sky: '#2e3a5c', ground: '#e8a56b',
    spots: [
      { kind: 'lantern', x: 92, y: 96, r: 22, hue: '#e2725b' },
      { kind: 'kite', x: 300, y: 70, r: 24, hue: '#e8b64c' },
      { kind: 'moon', x: 508, y: 62, r: 18, hue: '#f8e8b9' },
      { kind: 'flag', x: 178, y: 168, r: 22, hue: '#c96f5a' },
      { kind: 'sign', x: 428, y: 172, r: 24, hue: '#5d8a7d' },
      { kind: 'pot', x: 66, y: 300, r: 20, hue: '#d88564' },
      { kind: 'fruit', x: 250, y: 296, r: 21, hue: '#dca34e' },
      { kind: 'jar', x: 360, y: 300, r: 22, hue: '#c9a86a' },
      { kind: 'fish', x: 512, y: 290, r: 24, hue: '#91b9ab' },
      { kind: 'lantern', x: 470, y: 380, r: 22, hue: '#e8a04c' },
      { kind: 'cat', x: 140, y: 388, r: 25, hue: '#c98d68' },
      { kind: 'gift', x: 330, y: 388, r: 22, hue: '#c77b6e' },
    ],
  },
];

// Mutations cycle across each scene's twelve spots so every visit mixes
// recolours, vanishings, shrinks, shifts and tilts.
export const scenes = POSTCARDS.map((p, index) => ({
  name: p.name,
  caption: p.caption,
  bg: p.sky,
  ground: p.ground,
  index,
  objects: p.spots.map((s, id) => ({
    type: s.kind,
    x: s.x,
    y: s.y,
    r: s.r,
    color: s.hue,
    id,
    mutation: MUTATIONS[id % MUTATIONS.length],
  })),
}));

// Pick `count` differences with a good spatial spread: start from a random
// spot, then repeatedly add the spot farthest from the ones already
// chosen, with a little jitter so replays still differ. `rand` is the
// caller's seeded random function.
export function pickDifferences(scene, count, rand) {
  const ids = scene.objects.map(o => o.id);
  const picked = new Set([ids[Math.floor(rand() * ids.length)]]);
  const gap = id => {
    const o = scene.objects[id];
    let closest = Infinity;
    for (const other of picked) {
      const p = scene.objects[other];
      const d = (o.x - p.x) * (o.x - p.x) + (o.y - p.y) * (o.y - p.y);
      if (d < closest) closest = d;
    }
    return Math.sqrt(closest);
  };
  while (picked.size < count && picked.size < ids.length) {
    let winner = -1;
    let winnerScore = -Infinity;
    for (const id of ids) {
      if (picked.has(id)) continue;
      // Farthest-point wins, but a random nudge keeps rounds from repeating.
      const score = gap(id) + rand() * 90;
      if (score > winnerScore) {
        winnerScore = score;
        winner = id;
      }
    }
    picked.add(winner);
  }
  return [...picked];
}

// Which quarter of the picture a spot sits in, for zone hints.
export function zoneOf(o) {
  const vertical = o.y < 220 ? 'upper' : 'lower';
  const horizontal = o.x < 300 ? 'left' : 'right';
  return vertical + ' ' + horizontal;
}

// ---------- backdrops ----------

function paintHarbour(g) {
  // Soft clouds, far hills, a row of cottages, the pier and the water.
  for (let j = 0; j < 4; j++) {
    disc(g, { x: 80 + j * 144, y: 80 + (j % 2) * 25, rx: 65, ry: 7, fill: '#f5d4b9' });
  }
  poly(g, { pts: [[0, 193], [100, 152], [189, 188], [280, 139], [430, 187], [600, 141], [600, 290], [0, 290]], fill: '#989d9b' });
  box(g, { x: 0, y: 263, w: 600, h: 177, fill: '#638f96' });
  cottage(g, { x: 28, y: 172, w: 123, h: 110, fill: '#d9aa83' });
  cottage(g, { x: 166, y: 187, w: 116, h: 91, fill: '#d9bf96', roof: '#966e64' });
  cottage(g, { x: 295, y: 169, w: 96, h: 105, fill: '#d18e73' });
  cottage(g, { x: 404, y: 182, w: 89, h: 96, fill: '#e7c49b' });
  box(g, { x: 0, y: 275, w: 600, h: 18, fill: '#7b7470' });
  box(g, { x: 0, y: 293, w: 600, h: 6, fill: '#bca58b' });
  for (let j = 0; j < 26; j++) {
    const x = (j * 97) % 600;
    const y = 310 + (j * 31) % 125;
    seg(g, { x1: x, y1: y, x2: x + 14 + (j % 3) * 10, y2: y, stroke: '#9eb8af', w: 1.5 });
  }
  for (let x = 20; x < 600; x += 90) {
    box(g, { x, y: 272, w: 7, h: 34, fill: '#555e5e' });
    disc(g, { x: x + 3, y: 271, rx: 6, ry: 3, fill: '#b99d7e' });
  }
  poly(g, { pts: [[0, 391], [280, 365], [310, 440], [0, 440]], fill: '#c5ae8b' });
  for (let x = 10; x < 280; x += 40) {
    seg(g, { x1: x, y1: 391, x2: x + 13, y2: 440, stroke: '#af9778', w: 1 });
  }
}

function paintKitchen(g) {
  // Striped wallpaper, a window, shelves and a big wooden table.
  for (let x = 0; x < 600; x += 30) box(g, { x, y: 0, w: 1, h: 440, fill: '#e4cfaf' });
  box(g, { x: 338, y: 44, w: 100, h: 163, fill: '#638c8c' });
  box(g, { x: 346, y: 52, w: 84, h: 146, fill: '#b4d0c4' });
  seg(g, { x1: 388, y1: 52, x2: 388, y2: 198, stroke: '#faf0d4', w: 7 });
  seg(g, { x1: 346, y1: 115, x2: 430, y2: 115, stroke: '#faf0d4', w: 7 });
  poly(g, { pts: [[330, 40], [355, 40], [350, 200], [325, 200]], fill: '#dfaa85' });
  poly(g, { pts: [[425, 40], [446, 40], [450, 200], [430, 200]], fill: '#dfaa85' });
  box(g, { x: 32, y: 171, w: 284, h: 12, fill: '#98795b' });
  box(g, { x: 43, y: 182, w: 7, h: 22, fill: '#98795b' });
  box(g, { x: 290, y: 182, w: 7, h: 22, fill: '#98795b' });
  box(g, { x: 0, y: 236, w: 600, h: 25, fill: '#b5946f' });
  box(g, { x: 0, y: 261, w: 600, h: 105, fill: '#658c80' });
  for (let x = 10; x < 600; x += 120) {
    box(g, { x, y: 273, w: 100, h: 78, fill: '#789d8b' });
    box(g, { x: x + 42, y: 283, w: 18, h: 4, fill: '#dfc891' });
  }
  box(g, { x: 0, y: 366, w: 600, h: 74, fill: '#c8ad84' });
  disc(g, { x: 301, y: 363, rx: 187, ry: 37, fill: '#ad8b65' });
  box(g, { x: 149, y: 356, w: 10, h: 84, fill: '#8b735d' });
  box(g, { x: 444, y: 356, w: 10, h: 84, fill: '#8b735d' });
  disc(g, { x: 301, y: 349, rx: 195, ry: 30, fill: '#e5cda1' });
}

function paintLane(g) {
  // Falling snow, a hill, snow-topped cottages and a path.
  for (let j = 0; j < 60; j++) {
    dot(g, { x: (j * 109) % 600, y: (j * 53) % 280, r: 1.3, fill: '#e9f0e7' });
  }
  poly(g, { pts: [[0, 227], [90, 101], [177, 220], [316, 97], [473, 230], [560, 137], [600, 208], [600, 440], [0, 440]], fill: '#91afb7' });
  poly(g, { pts: [[40, 176], [90, 101], [141, 176], [108, 157], [93, 168], [78, 149]], fill: '#e7ece5' });
  box(g, { x: 0, y: 278, w: 600, h: 162, fill: '#dae8e3' });
  cottage(g, { x: 35, y: 180, w: 116, h: 114, fill: '#9a7a74', roof: '#687c85', snow: true });
  cottage(g, { x: 280, y: 170, w: 121, h: 119, fill: '#c8967e', roof: '#687c85', snow: true });
  cottage(g, { x: 426, y: 213, w: 99, h: 83, fill: '#b79881', roof: '#687c85', snow: true });
  pine(g, { x: 563, y: 291, s: 1.25, snow: true });
  pine(g, { x: 171, y: 272, s: 0.65, snow: true });
  poly(g, { pts: [[290, 292], [353, 292], [444, 440], [200, 440]], fill: '#b9d0cf' });
  disc(g, { x: 81, y: 324, rx: 70, ry: 13, fill: '#eff3e9' });
}

function paintReef(g) {
  // Shafts of light, bubbles, a sandy floor and swaying seaweed.
  for (let x = 0; x < 600; x += 105) {
    poly(g, { pts: [[x, 0], [x + 40, 0], [x + 155, 440], [x + 55, 440]], fill: '#d1e5c214' });
  }
  for (let j = 0; j < 33; j++) {
    g.strokeStyle = '#c5e1cd55';
    g.lineWidth = 1;
    g.beginPath();
    g.arc((j * 137) % 600, (j * 83) % 400, 2 + (j % 4), 0, 7);
    g.stroke();
  }
  poly(g, { pts: [[0, 346], [100, 331], [200, 368], [350, 339], [490, 356], [600, 333], [600, 440], [0, 440]], fill: '#b8b799' });
  for (let j = 0; j < 16; j++) {
    disc(g, { x: (j * 97) % 600, y: 409 + (j % 3) * 9, rx: 12, ry: 4, fill: '#939e8e' });
  }
  for (let x = 12; x < 600; x += 100) {
    for (let a = 0; a < 3; a++) {
      g.strokeStyle = '#407b73';
      g.lineWidth = 7;
      g.beginPath();
      g.moveTo(x + a * 8, 410);
      g.quadraticCurveTo(x - 24 + a * 9, 360, x + a * 9, 325 - a * 12);
      g.stroke();
    }
  }
}

function paintGlasshouse(g) {
  // A big glasshouse, shelves and a tiled floor.
  box(g, { x: 26, y: 20, w: 548, h: 340, fill: '#4b6d73' });
  box(g, { x: 38, y: 32, w: 524, h: 314, fill: '#acc4bd' });
  for (let x = 40; x < 570; x += 87) seg(g, { x1: x, y1: 32, x2: x, y2: 346, stroke: '#e0d5b6', w: 7 });
  for (let y = 32; y < 350; y += 105) seg(g, { x1: 38, y1: y, x2: 562, y2: y, stroke: '#e0d5b6', w: 6 });
  poly(g, { pts: [[26, 20], [300, 0], [574, 20]], fill: '#637e7b' });
  box(g, { x: 0, y: 349, w: 600, h: 91, fill: '#b9aa8c' });
  for (let x = 0; x < 600; x += 60) seg(g, { x1: x, y1: 349, x2: x - 60, y2: 440, stroke: '#a89d82', w: 1 });
  box(g, { x: 32, y: 248, w: 240, h: 13, fill: '#6e8c7a' });
  box(g, { x: 45, y: 261, w: 8, h: 88, fill: '#6e8c7a' });
  box(g, { x: 253, y: 261, w: 8, h: 88, fill: '#6e8c7a' });
  box(g, { x: 303, y: 322, w: 261, h: 13, fill: '#6e8c7a' });
  box(g, { x: 316, y: 335, w: 8, h: 70, fill: '#6e8c7a' });
  box(g, { x: 545, y: 335, w: 8, h: 70, fill: '#6e8c7a' });
}

function paintMarket(g) {
  // Dusk sky, string lights, striped stalls, a cobbled lane.
  for (let j = 0; j < 40; j++) {
    dot(g, { x: (j * 151) % 600, y: (j * 47) % 130, r: 1.4, fill: '#f6ead1' });
  }
  fairyLights(g, { x1: 0, y1: 30, x2: 300, y2: 52, fill: '#f2c14e' });
  fairyLights(g, { x1: 300, y1: 52, x2: 600, y2: 26, fill: '#e2725b' });
  fairyLights(g, { x1: 60, y1: 88, x2: 540, y2: 96, fill: '#f2c14e' });
  // Three stalls with striped canopies.
  box(g, { x: 30, y: 150, w: 150, h: 150, fill: '#7a5a4a' });
  canopy(g, { x: 22, y: 138, w: 166, a: '#e2725b', b: '#f6ead1' });
  box(g, { x: 55, y: 190, w: 100, h: 60, fill: '#3d4a63' });
  box(g, { x: 230, y: 150, w: 150, h: 150, fill: '#5d6b52' });
  canopy(g, { x: 222, y: 138, w: 166, a: '#5d8a7d', b: '#f6ead1' });
  box(g, { x: 255, y: 190, w: 100, h: 60, fill: '#3d4a63' });
  box(g, { x: 430, y: 150, w: 140, h: 150, fill: '#6b4a52' });
  canopy(g, { x: 422, y: 138, w: 156, a: '#e8a04c', b: '#f6ead1' });
  box(g, { x: 450, y: 190, w: 100, h: 60, fill: '#3d4a63' });
  // Cobbled lane in warm lamplight.
  box(g, { x: 0, y: 300, w: 600, h: 140, fill: '#8a6f56' });
  for (let y = 310; y < 440; y += 26) {
    for (let x = (y % 52 ? 0 : -22); x < 600; x += 44) {
      disc(g, { x: x + 22, y: y + 12, rx: 20, ry: 10, fill: '#a3856a' });
    }
  }
  for (let j = 0; j < 8; j++) {
    dot(g, { x: 60 + j * 70, y: 318 + (j % 3) * 8, r: 9, fill: '#f2c14e33' });
  }
}

const backdrops = [paintHarbour, paintKitchen, paintLane, paintReef, paintGlasshouse, paintMarket];

export function background(g, scene) {
  box(g, { x: 0, y: 0, w: 600, h: 440, fill: wash(g, scene.bg, scene.ground) });
  backdrops[scene.index](g);
  // Tiny paper-grain stipples, fixed in the illustration rather than
  // randomized per frame.
  for (let j = 0; j < 950; j++) {
    box(g, { x: (j * 139.17) % 600, y: (j * 71.73) % 440, w: 0.7, h: 0.7, fill: '#fff2' });
  }
}

// ---------- objects ----------
// One painter per spot kind. Each draws in a local frame centred on the
// spot, using `hue` as its main colour. `recoloured` is true when the spot
// was changed by a recolour mutation (only the moon needs to know, for its
// crater).
const painters = {
  moon(g, o, hue, recoloured) {
    disc(g, { x: 0, y: 0, rx: o.r * 0.8, ry: o.r * 0.8, fill: hue });
    disc(g, { x: 6, y: -5, rx: o.r * 0.66, ry: o.r * 0.66, fill: recoloured ? '#b8b9b4' : '#d5b7a2' });
  },
  planet(g, o, hue) {
    disc(g, { x: 0, y: 0, rx: 16, ry: 16, fill: hue });
    g.save();
    g.rotate(-0.3);
    g.strokeStyle = '#f6dfb0';
    g.lineWidth = 4;
    g.beginPath();
    g.ellipse(0, 0, 29, 7, 0, 0, 7);
    g.stroke();
    g.restore();
  },
  star(g, o, hue) {
    const pts = [];
    for (let j = 0; j < 10; j++) {
      const angle = -Math.PI / 2 + (j * Math.PI) / 5;
      const rad = j % 2 ? 9 : o.r;
      pts.push([Math.cos(angle) * rad, Math.sin(angle) * rad]);
    }
    poly(g, { pts, fill: hue });
  },
  flag(g, o, hue) {
    seg(g, { x1: -10, y1: 25, x2: -10, y2: -27, stroke: INK, w: 3 });
    poly(g, { pts: [[-9, -26], [19, -17], [-9, -7]], fill: hue });
  },
  window(g, o, hue) {
    box(g, { x: -15, y: -20, w: 30, h: 40, fill: '#5d6f6c' });
    box(g, { x: -11, y: -16, w: 22, h: 32, fill: hue });
    seg(g, { x1: 0, y1: -16, x2: 0, y2: 16, stroke: '#f2d6a6', w: 3 });
    seg(g, { x1: -11, y1: 0, x2: 11, y2: 0, stroke: '#f2d6a6', w: 3 });
  },
  sign(g, o, hue) {
    box(g, { x: -o.r, y: -13, w: o.r * 2, h: 26, fill: hue });
    seg(g, { x1: -10, y1: 13, x2: -10, y2: 32, stroke: INK, w: 3 });
    seg(g, { x1: 10, y1: 13, x2: 10, y2: 32, stroke: INK, w: 3 });
    g.fillStyle = '#efe3b9';
    g.font = '9px Georgia';
    g.textAlign = 'center';
    g.fillText('SLOW', 0, 3);
  },
  boat(g, o, hue) {
    poly(g, { pts: [[-o.r, -3], [o.r, -3], [o.r - 10, 12], [-o.r + 10, 12]], fill: hue });
    seg(g, { x1: -3, y1: -3, x2: -3, y2: -48, stroke: INK, w: 2 });
    poly(g, { pts: [[-6, -46], [-6, -8], [-o.r + 1, -8]], fill: '#f5e3bc' });
    poly(g, { pts: [[1, -38], [1, -8], [o.r - 2, -8]], fill: '#c4d5c5' });
    seg(g, { x1: -o.r, y1: 18, x2: o.r, y2: 18, stroke: '#b3cbc1', w: 2 });
  },
  buoy(g, o, hue) {
    disc(g, { x: 0, y: 7, rx: 15, ry: 7, fill: '#466f7b' });
    poly(g, { pts: [[-10, 7], [-5, -16], [5, -16], [10, 7]], fill: hue });
    box(g, { x: -7, y: -6, w: 14, h: 7, fill: '#f8dec0' });
    seg(g, { x1: 0, y1: -16, x2: 0, y2: -26, stroke: INK, w: 2 });
  },
  pot(g, o, hue) {
    poly(g, { pts: [[-o.r, -2], [o.r, -2], [o.r - 5, 22], [-o.r + 5, 22]], fill: hue });
    box(g, { x: -o.r - 2, y: -5, w: o.r * 2 + 4, h: 7, fill: '#ae7459' });
    for (let j = -1; j <= 1; j++) {
      seg(g, { x1: 0, y1: -4, x2: j * 14, y2: -27, stroke: INK, w: 2 });
      disc(g, { x: j * 13, y: -22, rx: 7, ry: 12, fill: '#658c69' });
    }
  },
  bird(g, o, hue) {
    g.strokeStyle = hue;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(-o.r, 3);
    g.quadraticCurveTo(-o.r / 2, -11, 0, 1);
    g.quadraticCurveTo(o.r / 2, -11, o.r, 3);
    g.stroke();
  },
  crate(g, o, hue) {
    box(g, { x: -o.r, y: -o.r, w: o.r * 2, h: o.r * 2, fill: hue });
    for (let j = -1; j <= 1; j++) {
      seg(g, { x1: -o.r, y1: j * 12, x2: o.r, y2: j * 12, stroke: '#8c6f52', w: 2 });
    }
    seg(g, { x1: -o.r, y1: -o.r, x2: o.r, y2: o.r, stroke: '#e0ba80', w: 4 });
  },
  fish(g, o, hue) {
    disc(g, { x: 0, y: 0, rx: o.r * 0.8, ry: o.r * 0.4, fill: hue });
    poly(g, { pts: [[o.r * 0.5, 0], [o.r + 5, -13], [o.r + 5, 13]], fill: hue });
    disc(g, { x: -o.r * 0.45, y: -2, rx: 2, ry: 2, fill: INK });
    poly(g, { pts: [[-5, -9], [6, -19], [12, -7]], fill: hue });
    seg(g, { x1: 0, y1: -8, x2: 0, y2: 8, stroke: '#fff5', w: 2 });
  },
  lamp(g, o, hue) {
    seg(g, { x1: 0, y1: 28, x2: 0, y2: -10, stroke: INK, w: 4 });
    box(g, { x: -11, y: -23, w: 22, h: 27, fill: INK });
    box(g, { x: -7, y: -19, w: 14, h: 18, fill: hue });
    poly(g, { pts: [[-16, -23], [0, -34], [16, -23]], fill: INK });
  },
  clock(g, o, hue) {
    disc(g, { x: 0, y: 0, rx: o.r, ry: o.r, fill: hue });
    disc(g, { x: 0, y: 0, rx: o.r - 4, ry: o.r - 4, fill: '#f9edce' });
    seg(g, { x1: 0, y1: 0, x2: -9, y2: -7, stroke: INK, w: 2 });
    seg(g, { x1: 0, y1: 0, x2: 3, y2: -14, stroke: INK, w: 2 });
    disc(g, { x: 0, y: 0, rx: 2, ry: 2, fill: INK });
  },
  jar(g, o, hue) {
    box(g, { x: -15, y: -18, w: 30, h: 37, fill: hue });
    disc(g, { x: 0, y: 19, rx: 15, ry: 4, fill: hue });
    box(g, { x: -17, y: -23, w: 34, h: 7, fill: '#8b8567' });
    box(g, { x: -10, y: -8, w: 20, h: 17, fill: '#f8e4bd' });
    seg(g, { x1: -5, y1: 0, x2: 5, y2: 0, stroke: hue, w: 2 });
  },
  cup(g, o, hue) {
    box(g, { x: -17, y: -13, w: 30, h: 26, fill: hue });
    disc(g, { x: -2, y: 13, rx: 15, ry: 4, fill: hue });
    g.strokeStyle = hue;
    g.lineWidth = 5;
    g.beginPath();
    g.arc(16, -1, 9, -1.8, 1.8);
    g.stroke();
    disc(g, { x: -2, y: -12, rx: 15, ry: 4, fill: '#f2dbb2' });
    disc(g, { x: -2, y: -12, rx: 11, ry: 2, fill: '#796d59' });
  },
  kettle(g, o, hue) {
    disc(g, { x: 0, y: 0, rx: 24, ry: 22, fill: hue });
    poly(g, { pts: [[-20, -4], [-35, -18], [-33, -4], [-19, 12]], fill: hue });
    g.strokeStyle = INK;
    g.lineWidth = 5;
    g.beginPath();
    g.arc(0, -17, 17, Math.PI, 0);
    g.stroke();
    box(g, { x: -15, y: -24, w: 30, h: 6, fill: hue });
    disc(g, { x: 0, y: -27, rx: 5, ry: 3, fill: INK });
  },
  fruit(g, o, hue) {
    disc(g, { x: 0, y: 3, rx: 20, ry: 16, fill: hue });
    disc(g, { x: 8, y: -7, rx: 5, ry: 7, fill: '#76966a' });
    seg(g, { x1: 0, y1: -10, x2: 4, y2: -19, stroke: INK, w: 2 });
  },
  flower(g, o, hue) {
    box(g, { x: -14, y: 9, w: 28, h: 19, fill: '#bd8f74' });
    seg(g, { x1: 0, y1: 9, x2: 0, y2: -22, stroke: '#638867', w: 3 });
    disc(g, { x: -9, y: -5, rx: 11, ry: 5, fill: '#638867' });
    for (let j = 0; j < 6; j++) {
      const a = (j * Math.PI) / 3;
      disc(g, { x: Math.cos(a) * 11, y: -23 + Math.sin(a) * 11, rx: 7, ry: 7, fill: hue });
    }
    disc(g, { x: 0, y: -23, rx: 6, ry: 6, fill: '#f4d694' });
  },
  cloth(g, o, hue) {
    poly(g, { pts: [[-o.r, -12], [o.r, -12], [o.r - 4, 18], [-o.r + 4, 14]], fill: hue });
    for (let j = -2; j <= 2; j++) {
      seg(g, { x1: j * 8, y1: -10, x2: j * 8 - 2, y2: 14, stroke: '#f6ead1', w: 2 });
    }
  },
  cat(g, o, hue) {
    disc(g, { x: 0, y: 7, rx: 23, ry: 14, fill: hue });
    disc(g, { x: -15, y: -7, rx: 13, ry: 12, fill: hue });
    poly(g, { pts: [[-27, -11], [-26, -27], [-16, -16]], fill: hue });
    poly(g, { pts: [[-16, -17], [-5, -26], [-4, -9]], fill: hue });
    disc(g, { x: -19, y: -8, rx: 1.5, ry: 2, fill: INK });
    disc(g, { x: -11, y: -8, rx: 1.5, ry: 2, fill: INK });
    g.strokeStyle = hue;
    g.lineWidth = 7;
    g.beginPath();
    g.arc(22, 0, 12, -2, 1.7);
    g.stroke();
  },
  wreath(g, o, hue) {
    disc(g, { x: 0, y: 0, rx: 22, ry: 22, fill: hue });
    disc(g, { x: 0, y: 0, rx: 12, ry: 12, fill: '#c8967e' });
    disc(g, { x: -13, y: -12, rx: 4, ry: 4, fill: '#d57f68' });
    disc(g, { x: 16, y: 8, rx: 4, ry: 4, fill: '#e5b76e' });
  },
  snowman(g, o, hue) {
    disc(g, { x: 0, y: 12, rx: 21, ry: 21, fill: hue });
    disc(g, { x: 0, y: -15, rx: 15, ry: 15, fill: hue });
    box(g, { x: -18, y: -31, w: 36, h: 4, fill: INK });
    box(g, { x: -11, y: -44, w: 22, h: 15, fill: INK });
    box(g, { x: -13, y: -3, w: 29, h: 5, fill: '#c77f69' });
    disc(g, { x: -5, y: -17, rx: 2, ry: 2, fill: INK });
    poly(g, { pts: [[0, -13], [17, -10], [0, -8]], fill: '#d5a05c' });
    for (let y = 8; y < 26; y += 8) disc(g, { x: 0, y, rx: 2, ry: 2, fill: INK });
  },
  gift(g, o, hue) {
    box(g, { x: -o.r, y: -o.r, w: o.r * 2, h: o.r * 2, fill: hue });
    box(g, { x: -3, y: -o.r, w: 6, h: o.r * 2, fill: '#ebd496' });
    box(g, { x: -o.r, y: -4, w: o.r * 2, h: 6, fill: '#ebd496' });
    seg(g, { x1: 0, y1: -o.r, x2: -12, y2: -o.r - 10, stroke: '#ebd496', w: 4 });
    seg(g, { x1: 0, y1: -o.r, x2: 12, y2: -o.r - 10, stroke: '#ebd496', w: 4 });
  },
  sled(g, o, hue) {
    seg(g, { x1: -o.r, y1: 13, x2: o.r, y2: 13, stroke: hue, w: 4 });
    seg(g, { x1: -o.r, y1: -6, x2: o.r, y2: -6, stroke: hue, w: 9 });
    seg(g, { x1: -o.r + 8, y1: -6, x2: -o.r + 4, y2: 13, stroke: INK, w: 3 });
    seg(g, { x1: o.r - 8, y1: -6, x2: o.r - 3, y2: 13, stroke: INK, w: 3 });
  },
  shell(g, o, hue) {
    g.fillStyle = hue;
    g.beginPath();
    g.moveTo(0, 14);
    g.arc(0, 0, o.r, Math.PI, 0);
    g.closePath();
    g.fill();
    for (let j = -2; j <= 2; j++) {
      seg(g, { x1: 0, y1: 12, x2: j * 8, y2: -12, stroke: '#b8928166', w: 1.5 });
    }
  },
  coral(g, o, hue) {
    for (let j = -2; j <= 2; j++) {
      seg(g, { x1: 0, y1: 23, x2: j * 10, y2: -18 + Math.abs(j) * 6, stroke: hue, w: 6 });
      seg(g, { x1: j * 7, y1: 0, x2: j * 11 + 5, y2: -8, stroke: hue, w: 4 });
    }
  },
  jelly(g, o, hue) {
    disc(g, { x: 0, y: 0, rx: o.r, ry: o.r * 0.6, fill: hue });
    box(g, { x: -o.r, y: 0, w: o.r * 2, h: 8, fill: hue });
    for (let j = -2; j <= 2; j++) {
      g.beginPath();
      g.strokeStyle = hue;
      g.lineWidth = 2;
      g.moveTo(j * 8, 7);
      g.bezierCurveTo(j * 8 - 9, 19, j * 8 + 9, 29, j * 8, 39);
      g.stroke();
    }
    disc(g, { x: -8, y: 0, rx: 2, ry: 2, fill: INK });
    disc(g, { x: 8, y: 0, rx: 2, ry: 2, fill: INK });
  },
  seaweed(g, o, hue) {
    for (let j = -1; j <= 1; j++) {
      seg(g, { x1: 0, y1: 24, x2: j * 16, y2: -24, stroke: hue, w: 5 });
      disc(g, { x: j * 13, y: -17, rx: 7, ry: 15, fill: hue });
    }
  },
  pearl(g, o, hue) {
    disc(g, { x: 0, y: 0, rx: 16, ry: 16, fill: hue });
    disc(g, { x: -4, y: -5, rx: 5, ry: 5, fill: '#fff9' });
  },
  lantern(g, o, hue) {
    // A paper lantern: ribbed round body, caps, and a tassel.
    disc(g, { x: 0, y: 0, rx: 17, ry: 20, fill: hue });
    for (let j = -2; j <= 2; j++) {
      g.strokeStyle = '#fff8';
      g.lineWidth = 1.5;
      g.beginPath();
      g.ellipse(0, 0, 17 - Math.abs(j) * 3, 20, 0, -1.2, 1.2);
      g.stroke();
    }
    box(g, { x: -8, y: -24, w: 16, h: 5, fill: '#8b6f52' });
    box(g, { x: -8, y: 19, w: 16, h: 5, fill: '#8b6f52' });
    seg(g, { x1: 0, y1: 24, x2: 0, y2: 34, stroke: '#d9a441', w: 2 });
    disc(g, { x: 0, y: 37, rx: 3, ry: 5, fill: '#d9a441' });
  },
  kite(g, o, hue) {
    // A diamond kite with cross spars and a bowed tail.
    poly(g, { pts: [[0, -26], [20, 0], [0, 24], [-20, 0]], fill: hue });
    seg(g, { x1: 0, y1: -26, x2: 0, y2: 24, stroke: '#f6ead1', w: 2 });
    seg(g, { x1: -20, y1: 0, x2: 20, y2: 0, stroke: '#f6ead1', w: 2 });
    disc(g, { x: 0, y: -2, rx: 4, ry: 4, fill: '#f6ead1' });
    for (let j = 1; j <= 3; j++) {
      seg(g, { x1: 0, y1: 24 + j * 9, x2: j % 2 ? -7 : 7, y2: 24 + j * 9, stroke: '#e2725b', w: 2 });
    }
  },
};

function drawObject(g, o, changed) {
  if (changed && o.mutation === 'vanish') return;
  g.save();
  g.translate(o.x + (changed && o.mutation === 'shift' ? 14 : 0), o.y);
  if (changed && o.mutation === 'shrink') g.scale(0.65, 0.65);
  if (changed && o.mutation === 'tilt') g.rotate(0.45);
  const recoloured = changed && o.mutation === 'recolour';
  const hue = recoloured ? '#776aa0' : o.color;
  painters[o.type](g, o, hue, recoloured);
  g.restore();
}

export function drawScene(g, scene, selected, altered) {
  background(g, scene);
  scene.objects.forEach(o => drawObject(g, o, altered && selected.includes(o.id)));
}
