// config.js — constants, spritesheet atlas, palette swap, class definitions
// ─── Constants ────────────────────────────────────────────────────────────────
const TILE   = 32;
const COIN_MAGNET   = 80;  // px radius auto-collect
const SPRITE_SCALE  = 2;

// ─── Spritesheet (0x72 DungeonTilesetII v1.7, CC0) ────────────────────────────
const SHEET = new Image();
SHEET.src = 'assets/dungeon_tileset.png';

// frame list: [sx, sy, sw, sh] — stride lets frames sit on a wider grid
function frames(x, y, w, h, n, stride = w) {
  const out = [];
  for (let i = 0; i < n; i++) out.push([x + i * stride, y, w, h]);
  return out;
}

const ANIMS = {
  wizzard:    { idle: frames(128, 164, 16, 28, 4), run: frames(192, 164, 16, 28, 4) },
  elf:        { idle: frames(128,  36, 16, 28, 4), run: frames(192,  36, 16, 28, 4) },
  knight:     { idle: frames(128, 100, 16, 28, 4), run: frames(192, 100, 16, 28, 4) },
  wizzard_f:  { idle: frames(128, 132, 16, 28, 4), run: frames(192, 132, 16, 28, 4) },
  masked_orc: { idle: frames(368, 153, 16, 23, 4), run: frames(432, 153, 16, 23, 4) },
  angel:      { idle: frames(368, 304, 16, 16, 4), run: frames(432, 304, 16, 16, 4) },
  skelet:    { idle: frames(368,  88, 16, 16, 4), run: frames(432,  88, 16, 16, 4) },
  goblin:    { idle: frames(368,  40, 16, 16, 4), run: frames(432,  40, 16, 16, 4) },
  chort:     { idle: frames(368, 273, 16, 23, 4), run: frames(432, 273, 16, 23, 4) },
  big_demon: { idle: frames( 16, 428, 32, 36, 4), run: frames(144, 428, 32, 36, 4) },
  big_zombie:{ idle: frames( 16, 332, 32, 36, 4), run: frames(144, 332, 32, 36, 4) },
  ogre:      { idle: frames( 16, 380, 32, 36, 4), run: frames(144, 380, 32, 36, 4) },
  necromancer: { idle: frames(368, 225, 16, 23, 4), run: frames(368, 225, 16, 23, 4) },
  swampy:      { idle: frames(432, 112, 16, 16, 4), run: frames(432, 112, 16, 16, 4) },
};
// mimic only has a 3-frame "open" anim; ping-pong it to fit the 4-frame clock
const MIMIC_F = frames(304, 432, 16, 16, 3);
ANIMS.mimic = { idle: [MIMIC_F[0], MIMIC_F[1], MIMIC_F[2], MIMIC_F[1]],
                run:  [MIMIC_F[0], MIMIC_F[1], MIMIC_F[2], MIMIC_F[1]] };

const FLASK_RED    = [288, 352, 16, 16];
const CHEST_FRAMES = frames(304, 416, 16, 16, 3); // closed → opening → open
const CHEST_EMPTY  = [336, 400, 16, 16];          // looted chest left behind
const COIN_FRAMES = frames(289, 385, 6, 7, 4, 8);
const WEAPON_SPRITES = {
  staff:       [324, 129,  8, 30],
  staff_green: [340, 129,  8, 30],
  bow:         [289, 195, 14, 26],
  bow_2:       [305, 195, 14, 26],
  sword_rusty: [307,  10, 10, 21],
  sword_knight:[339,  98, 10, 29],
  sword_anime: [322,  65, 12, 30],
  knife:       [293,  10,  6, 13],
  machete:     [294, 105,  5, 22],
  katana:      [293,  66,  6, 29],
  mace:        [339,  39, 10, 24],
  hammer:      [307,  39, 10, 24],
  golden_sword:[291, 137, 10, 22],
  arrow:       [324, 202,  7, 21],
};

const FLOOR_TILES = [
  [16, 64, 16, 16], [32, 64, 16, 16], [48, 64, 16, 16], [16, 80, 16, 16],
  [32, 80, 16, 16], [48, 80, 16, 16], [16, 96, 16, 16], [32, 96, 16, 16],
];
const WALL_TILES = {
  mid:       [32, 16, 16, 16],
  left:      [16, 16, 16, 16],
  right:     [48, 16, 16, 16],
  top:       [32,  0, 16, 16],
  top_left:  [16,  0, 16, 16],
  top_right: [48,  0, 16, 16],
  edge_left:     [32, 152, 16, 16],
  edge_right:    [48, 152, 16, 16],
  edge_bot_left: [32, 168, 16, 16],
  edge_bot_right:[48, 168, 16, 16],
  banner_red:  [16, 32, 16, 16],
  banner_blue: [32, 32, 16, 16],
  hole:    [48, 32, 16, 16],
};

// playable area inside the walls (recomputed on resize)
let PLAY = { left: TILE, right: 0, top: TILE * 2, bottom: 0 };

// ─── Arena obstacles & spike traps ────────────────────────────────────────────
const OBSTACLE_SPRITES = { column: [80, 80, 16, 48], crate: [288, 408, 16, 24] };
const SPIKE_FRAMES = frames(16, 192, 16, 16, 4);
let obstacles = []; // { kind, x, y, r, hp, dead }
let traps     = []; // { x, y, offset }

// a fresh random layout each run: solid columns, breakable crates, spike traps
function generateArena() {
  obstacles = [];
  traps     = [];
  const margin = 110;
  const cx = canvas.width / 2, cy = canvas.height / 2;

  const spots = [];
  const want  = 4 + Math.floor(Math.random() * 3);
  let attempts = 0;
  while (spots.length < want && attempts++ < 300) {
    const x = PLAY.left + margin + Math.random() * (PLAY.right  - PLAY.left - margin * 2);
    const y = PLAY.top  + margin + Math.random() * (PLAY.bottom - PLAY.top  - margin * 2);
    if (Math.hypot(x - cx, y - cy) < 150) continue; // keep the spawn clear
    if (spots.some(s => Math.hypot(x - s.x, y - s.y) < 110)) continue;
    spots.push({ x, y });
  }
  spots.forEach((s, i) => {
    if (i < 2 || Math.random() < 0.5) {
      obstacles.push({ kind: 'column', x: s.x, y: s.y, r: 16, hp: Infinity, dead: false });
    } else {
      obstacles.push({ kind: 'crate', x: s.x, y: s.y, r: 14, hp: 40, dead: false });
    }
  });

  const trapCount = 2 + Math.floor(Math.random() * 2);
  attempts = 0;
  while (traps.length < trapCount && attempts++ < 200) {
    const x = PLAY.left + margin + Math.random() * (PLAY.right  - PLAY.left - margin * 2);
    const y = PLAY.top  + margin + Math.random() * (PLAY.bottom - PLAY.top  - margin * 2);
    if (Math.hypot(x - cx, y - cy) < 140) continue;
    if (obstacles.some(o => Math.hypot(x - o.x, y - o.y) < 90)) continue;
    if (traps.some(t => Math.hypot(x - t.x, y - t.y) < 130)) continue;
    traps.push({ x, y, offset: Math.random() * 4 });
  }
}

// pushes a circular entity out of solid obstacles
function resolveObstacles(ent, radius) {
  for (const o of obstacles) {
    if (o.dead) continue;
    const dx = ent.x - o.x, dy = ent.y - o.y;
    const d  = Math.hypot(dx, dy), min = o.r + radius;
    if (d < min && d > 0.001) {
      ent.x = o.x + dx / d * min;
      ent.y = o.y + dy / d * min;
    }
  }
}

function trapFrameAt(tr)  { return Math.floor(performance.now() / 450 + tr.offset) % 4; }
function trapDangerous(tr) { return trapFrameAt(tr) >= 2; } // spikes out

function damageCrate(o, dmg) {
  o.hp -= dmg;
  spawnParticles(o.x, o.y, '#8B6914', 5);
  if (o.hp <= 0 && !o.dead) {
    o.dead = true;
    Sfx.play('chest');
    spawnParticles(o.x, o.y, '#b8945a', 14);
    const n = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      coins.push({ x: o.x, y: o.y, vx: Math.cos(a) * 2, vy: Math.sin(a) * 2, dead: false, bob: Math.random() * 6 });
    }
  }
}

let animTick = 0; // global 4-frame animation clock

// ─── Palette swap (classic outfit recolor via RGB sliders) ───────────────────
// each class outfit is two exact palette colors: light + its shadow
const OUTFIT_COLORS = {
  mage:      { light: [ 86, 152, 204], dark: [ 89,  86, 189] },
  archer:    { light: [ 75, 167,  71], dark: [ 61, 115,  79] },
  warrior:   { light: [114, 214, 206], dark: [ 65, 112, 137] },
  ninja:     { light: [ 61, 115,  79], dark: [ 49,  65,  82] },
  priestess: { light: [202, 230, 245], dark: [ 86, 152, 204] },
  witch:     { light: [ 86, 152, 204], dark: [ 89,  86, 189] },
};
// strip containing idle+run(+hit) frames of each class on the sheet
const CLASS_REGION = {
  mage:      [128, 164, 144, 28],
  archer:    [128,  36, 144, 28],
  warrior:   [128, 100, 144, 28],
  ninja:     [368, 153, 128, 23],
  priestess: [368, 304, 128, 16],
  witch:     [128, 132, 144, 28],
};

let playerSheet  = SHEET;            // recolored copy used to draw the player
const playerColors = Save.data.settings.colors; // chosen [r,g,b] per class (persisted)

function currentColor() {
  return playerColors[selectedClass] || OUTFIT_COLORS[selectedClass].light;
}

const lum = ([r, g, b]) => 0.299 * r + 0.587 * g + 0.114 * b;

// rebuilds playerSheet swapping the outfit pair for the chosen color
function recolorPlayerSheet() {
  if (!SHEET.complete || SHEET.naturalWidth === 0) { playerSheet = SHEET; return; }
  try {
    const oc = document.createElement('canvas');
    oc.width  = SHEET.naturalWidth;
    oc.height = SHEET.naturalHeight;
    const c = oc.getContext('2d');
    c.drawImage(SHEET, 0, 0);

    const { light, dark } = OUTFIT_COLORS[selectedClass];
    const target = currentColor();
    const shade  = lum(dark) / lum(light); // keep the original shading ratio
    const targetDark = target.map(v => Math.round(v * shade));

    const [rx, ry, rw, rh] = CLASS_REGION[selectedClass];
    const img = c.getImageData(rx, ry, rw, rh);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] === light[0] && d[i+1] === light[1] && d[i+2] === light[2]) {
        [d[i], d[i+1], d[i+2]] = target;
      } else if (d[i] === dark[0] && d[i+1] === dark[1] && d[i+2] === dark[2]) {
        [d[i], d[i+1], d[i+2]] = targetDark;
      }
    }
    c.putImageData(img, rx, ry);
    playerSheet = oc;
  } catch (e) {
    playerSheet = SHEET; // canvas tainted (file:// double-click) — keep defaults
  }
}

// draws a frame centered on (x, y), optionally mirrored horizontally
function drawSprite(frame, x, y, flip, scale = SPRITE_SCALE, sheet = SHEET) {
  const [sx, sy, sw, sh] = frame;
  const dw = sw * scale;
  const dh = sh * scale;
  ctx.save();
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(sheet, sx, sy, sw, sh, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();
}

// ─── Classes (Brotato-style) ──────────────────────────────────────────────────
// Each class has 3 weapon tiers; an upgrade pickup drops every 2 waves.
const CLASS_DEFS = {
  mage: {
    hp: 100, speed: 2.6, anim: 'wizzard',
    special: 'fireball', specialCd: 8000,
    tiers: [
      { name: 'APPRENTICE STAFF', sprite: 'staff',       attack: 'bolt', fireRate: 220, bulletSpeed: 7, range: 380, damage: [25, 35], pierce: 0, count: 1 },
      { name: 'EMERALD STAFF',    sprite: 'staff_green', attack: 'bolt', fireRate: 185, bulletSpeed: 8, range: 430, damage: [36, 48], pierce: 1, count: 1 },
      { name: 'ARCANE STAFF',     sprite: 'staff_green', attack: 'bolt', fireRate: 150, bulletSpeed: 9, range: 480, damage: [48, 64], pierce: 2, count: 1 },
    ],
  },
  archer: {
    hp: 80, speed: 3.0, anim: 'elf',
    special: 'volley', specialCd: 7000,
    tiers: [
      { name: 'SHORT BOW', sprite: 'bow',   attack: 'arrow', fireRate: 380, bulletSpeed: 11, range: 560, damage: [30, 42], pierce: 2, count: 1 },
      { name: 'ELVEN BOW', sprite: 'bow_2', attack: 'arrow', fireRate: 350, bulletSpeed: 12, range: 600, damage: [34, 46], pierce: 2, count: 2 },
      { name: 'TWIN BOW',  sprite: 'bow_2', attack: 'arrow', fireRate: 320, bulletSpeed: 13, range: 640, damage: [38, 52], pierce: 3, count: 3 },
    ],
  },
  warrior: {
    hp: 150, speed: 2.8, anim: 'knight',
    special: 'whirlwind', specialCd: 6000,
    tiers: [
      { name: 'RUSTY SWORD',  sprite: 'sword_rusty',  attack: 'melee', fireRate: 420, range: 58, damage: [45, 62],  arc: Math.PI * 0.65, knockback: 14 },
      { name: 'KNIGHT SWORD', sprite: 'sword_knight', attack: 'melee', fireRate: 380, range: 70, damage: [60, 80],  arc: Math.PI * 0.75, knockback: 17 },
      { name: 'ANIME BLADE',  sprite: 'sword_anime',  attack: 'melee', fireRate: 330, range: 84, damage: [80, 105], arc: Math.PI * 0.88, knockback: 22 },
    ],
  },
  ninja: {
    hp: 85, speed: 3.2, anim: 'masked_orc',
    special: 'dash', specialCd: 5000,
    tiers: [
      { name: 'KNIFE',   sprite: 'knife',   attack: 'melee', fireRate: 260, range: 46, damage: [22, 32], arc: Math.PI * 0.5,  knockback: 8  },
      { name: 'MACHETE', sprite: 'machete', attack: 'melee', fireRate: 235, range: 56, damage: [32, 44], arc: Math.PI * 0.55, knockback: 10 },
      { name: 'KATANA',  sprite: 'katana',  attack: 'melee', fireRate: 205, range: 68, damage: [44, 60], arc: Math.PI * 0.6,  knockback: 12 },
    ],
  },
  priestess: {
    hp: 120, speed: 2.7, anim: 'angel',
    special: 'nova', specialCd: 9000,
    tiers: [
      { name: 'MACE',         sprite: 'mace',         attack: 'melee', fireRate: 400, range: 56, damage: [38, 52], arc: Math.PI * 0.6,  knockback: 14 },
      { name: 'WAR HAMMER',   sprite: 'hammer',       attack: 'melee', fireRate: 430, range: 62, damage: [55, 75], arc: Math.PI * 0.65, knockback: 18 },
      { name: 'GOLDEN BLADE', sprite: 'golden_sword', attack: 'melee', fireRate: 360, range: 68, damage: [70, 92], arc: Math.PI * 0.7,  knockback: 18 },
    ],
  },
  witch: {
    hp: 90, speed: 2.6, anim: 'wizzard_f',
    special: 'hex', specialCd: 9000,
    tiers: [
      { name: 'CURSED STAFF', sprite: 'staff',       attack: 'bolt', fireRate: 240, bulletSpeed: 7, range: 380, damage: [18, 26], pierce: 0, count: 1, poison: { dps: 8,  dur: 3000 } },
      { name: 'VENOM STAFF',  sprite: 'staff_green', attack: 'bolt', fireRate: 210, bulletSpeed: 8, range: 420, damage: [24, 34], pierce: 1, count: 1, poison: { dps: 12, dur: 3000 } },
      { name: 'PLAGUE STAFF', sprite: 'staff_green', attack: 'bolt', fireRate: 180, bulletSpeed: 9, range: 460, damage: [32, 44], pierce: 2, count: 1, poison: { dps: 18, dur: 4000 } },
    ],
  },
};
let selectedClass = 'mage';

