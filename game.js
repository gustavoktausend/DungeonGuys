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
  wizzard:   { idle: frames(128, 164, 16, 28, 4), run: frames(192, 164, 16, 28, 4) },
  elf:       { idle: frames(128,  36, 16, 28, 4), run: frames(192,  36, 16, 28, 4) },
  knight:    { idle: frames(128, 100, 16, 28, 4), run: frames(192, 100, 16, 28, 4) },
  skelet:    { idle: frames(368,  88, 16, 16, 4), run: frames(432,  88, 16, 16, 4) },
  goblin:    { idle: frames(368,  40, 16, 16, 4), run: frames(432,  40, 16, 16, 4) },
  chort:     { idle: frames(368, 273, 16, 23, 4), run: frames(432, 273, 16, 23, 4) },
  big_demon: { idle: frames( 16, 428, 32, 36, 4), run: frames(144, 428, 32, 36, 4) },
  big_zombie:{ idle: frames( 16, 332, 32, 36, 4), run: frames(144, 332, 32, 36, 4) },
  ogre:      { idle: frames( 16, 380, 32, 36, 4), run: frames(144, 380, 32, 36, 4) },
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

let animTick = 0; // global 4-frame animation clock

// ─── Palette swap (classic outfit recolor via RGB sliders) ───────────────────
// each class outfit is two exact palette colors: light + its shadow
const OUTFIT_COLORS = {
  mage:    { light: [ 86, 152, 204], dark: [89,  86, 189] },
  archer:  { light: [ 75, 167,  71], dark: [61, 115,  79] },
  warrior: { light: [114, 214, 206], dark: [65, 112, 137] },
};
// strip containing idle+run+hit frames of each class on the sheet
const CLASS_REGION = {
  mage:    [128, 164, 144, 28],
  archer:  [128,  36, 144, 28],
  warrior: [128, 100, 144, 28],
};

let playerSheet  = SHEET;            // recolored copy used to draw the player
let playerColors = {};               // chosen [r,g,b] per class (persisted)

try { playerColors = JSON.parse(localStorage.getItem('dg_colors')) || {}; } catch (e) {}

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
};
let selectedClass = 'mage';

// ─── State ────────────────────────────────────────────────────────────────────
let canvas, ctx;
let gameState = 'start'; // start | playing | paused | gameover
let lastTime   = 0;
let animId     = null;

let player, bullets, enemies, coins, particles, meleeSwings, upgrades;
let potions, chests, floatTexts;

// ─── Player stats (Brotato-style) ─────────────────────────────────────────────
// flat damage is per weapon kind: melee (warrior), ranged (archer), elemental (mage)
function baseStats() {
  return {
    hpRegen: 0,       // 0.2 HP/s per point
    lifeSteal: 0,     // % chance to heal 1 HP per hit
    dmgPct: 0,        // % damage on everything
    meleeDmg: 0,      // flat
    rangedDmg: 0,     // flat
    elementalDmg: 0,  // flat
    atkSpeedPct: 0,   // % faster attacks
    crit: 0,          // % chance, crits deal x2
    armor: 0,         // reduction = armor / (armor + 15)
    dodge: 0,         // % chance to ignore a hit, capped at 60
    range: 0,         // flat px (melee gets half)
    speedPct: 0,      // % move speed
    luck: 0,          // % more potion drops / chest spawns
    stamina: 0,       // flat bonus to the 100 base stamina pool
  };
}

// ─── Stamina / sprint ─────────────────────────────────────────────────────────
const STAMINA_BASE    = 100;
const SPRINT_MULT     = 1.55; // speed while sprinting
const FATIGUE_MULT    = 0.7;  // speed while stamina is recovering
const STAMINA_DRAIN   = 30;   // per second while sprinting
const STAMINA_REGEN   = 18;   // per second while recovering

function maxStamina() { return STAMINA_BASE + player.stats.stamina; }

const STAT_LABELS = {
  hpRegen: 'HP REGEN', lifeSteal: 'LIFESTEAL', dmgPct: 'DAMAGE',
  meleeDmg: 'MELEE DMG', rangedDmg: 'RANGED DMG', elementalDmg: 'ELEM DMG',
  atkSpeedPct: 'ATK SPEED', crit: 'CRIT', armor: 'ARMOR',
  dodge: 'DODGE', range: 'RANGE', speedPct: 'SPEED', luck: 'LUCK',
  stamina: 'STAMINA', maxHp: 'MAX HP',
};
const PCT_STATS = new Set(['dmgPct', 'atkSpeedPct', 'speedPct', 'crit', 'dodge', 'lifeSteal', 'luck']);

// ─── Shop items (4 random offers per wave; some have downsides) ───────────────
// cls restricts the offer to one class (no dead picks)
const ITEM_POOL = [
  { name: 'WHETSTONE',       icon: '🗡', price: 18, cls: 'warrior', mods: { meleeDmg: 3 } },
  { name: 'BROADHEAD TIPS',  icon: '🏹', price: 18, cls: 'archer',  mods: { rangedDmg: 3 } },
  { name: 'FIRE GEM',        icon: '🔥', price: 18, cls: 'mage',    mods: { elementalDmg: 3 } },
  { name: 'POWER CRYSTAL',   icon: '💎', price: 30, mods: { dmgPct: 8 } },
  { name: 'SWIFT BOOTS',     icon: '👢', price: 24, mods: { speedPct: 8 } },
  { name: 'HEAVY PLATE',     icon: '🛡', price: 28, mods: { armor: 3, speedPct: -3 } },
  { name: 'LUCKY CLOVER',    icon: '🍀', price: 20, mods: { luck: 15 } },
  { name: 'VAMPIRE FANG',    icon: '🦇', price: 32, mods: { lifeSteal: 4 } },
  { name: 'HEALING HERBS',   icon: '🌿', price: 26, mods: { hpRegen: 2 } },
  { name: 'ADRENALINE VIAL', icon: '⚡', price: 30, mods: { atkSpeedPct: 10 } },
  { name: 'EAGLE EYE',       icon: '👁', price: 20, mods: { range: 30 } },
  { name: 'JAGGED DAGGER',   icon: '🔪', price: 30, mods: { crit: 8 } },
  { name: 'GIANT BELT',      icon: '🥋', price: 34, mods: { maxHp: 25, speedPct: -4 } },
  { name: 'SHADOW CLOAK',    icon: '🌑', price: 30, mods: { dodge: 8, dmgPct: -5 } },
  { name: 'BLOOD PACT',      icon: '🩸', price: 40, mods: { meleeDmg: 4, rangedDmg: 4, elementalDmg: 4, maxHp: -15 } },
  { name: 'BERSERK TONIC',   icon: '🧪', price: 35, mods: { atkSpeedPct: 15, armor: -2 } },
  { name: 'ENERGY DRINK',    icon: '🥤', price: 22, mods: { stamina: 30 } },
  { name: 'IRON GREAVES',    icon: '🥾', price: 30, mods: { armor: 2, stamina: -20 } },
  { name: 'TOWER SHIELD',    icon: '🏰', price: 36, mods: { armor: 5, atkSpeedPct: -8 } },
  { name: 'CURSED SKULL',    icon: '💀', price: 38, mods: { dmgPct: 15, maxHp: -10, hpRegen: -1 } },
];

let shopOffers = [];
let rerollCost = 5;
const HEAL_PRICE = 10;

function itemPrice(item) {
  return Math.round(item.price * (1 + (wave - 1) * 0.06)); // gets pricier as waves go
}
let score, gold, wave, waveTimer, waveActive;
let nextWaveDelay = 3000;
let spawnQueue   = [];
let mouse        = { x: 0, y: 0 };
let mouseDown    = false;
let keys         = {};
let lastShot     = 0;
let tileMap      = [];
let mapCols, mapRows;

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const screens = {
  start:    document.getElementById('start-screen'),
  pause:    document.getElementById('pause-screen'),
  shop:     document.getElementById('shop-screen'),
  gameover: document.getElementById('gameover-screen'),
  victory:  document.getElementById('victory-screen'),
};
const hud          = document.getElementById('hud');
const hpBar        = document.getElementById('hp-bar');
const spBar        = document.getElementById('sp-bar');
const stBar        = document.getElementById('st-bar');
const waveDisplay  = document.getElementById('wave-display');
const scoreDisplay = document.getElementById('score-display');
const goldDisplay  = document.getElementById('gold-display');
const waveAnnounce = document.getElementById('wave-announce');
const finalScore   = document.getElementById('final-score');
const finalWave    = document.getElementById('final-wave');
const finalGold    = document.getElementById('final-gold');

// buttons drop focus after click so Space (attack key) never re-activates them
document.addEventListener('click', e => {
  const btn = e.target.closest('button');
  if (btn) btn.blur();
});

// keyboard-triggered clicks (Space/Enter on a focused button) have detail === 0;
// game flow buttons only respond to real mouse clicks
function mouseOnly(fn) {
  return e => { if (e.detail !== 0) fn(); };
}

document.getElementById('btn-start').addEventListener('click',   mouseOnly(startGame));
document.getElementById('btn-resume').addEventListener('click',  mouseOnly(resumeGame));
document.getElementById('btn-quit').addEventListener('click',    mouseOnly(quitGame));
document.getElementById('btn-restart').addEventListener('click', mouseOnly(startGame));
document.getElementById('btn-victory-restart').addEventListener('click', mouseOnly(startGame));

document.getElementById('btn-next-wave').addEventListener('click', mouseOnly(closeShop));
document.getElementById('btn-shop-heal').addEventListener('click', mouseOnly(shopHeal));
document.getElementById('btn-shop-reroll').addEventListener('click', mouseOnly(shopReroll));
document.getElementById('shop-items').addEventListener('click', e => {
  if (e.detail === 0) return;
  const btn = e.target.closest('.shop-item[data-i]');
  if (btn) buyOffer(Number(btn.dataset.i));
});

document.querySelectorAll('.class-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.class-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    selectedClass = card.dataset.class;
    setSliders(currentColor());
    recolorPlayerSheet();
    drawColorPreview();
  });
});

// ─── Hero name ────────────────────────────────────────────────────────────────
const nameInput = document.getElementById('hero-name');
try { nameInput.value = localStorage.getItem('dg_name') || ''; } catch (e) {}
nameInput.addEventListener('input', () => {
  try { localStorage.setItem('dg_name', nameInput.value); } catch (e) {}
});

function heroName() {
  const n = nameInput.value.trim().toUpperCase();
  return n || 'HERO';
}

// ─── Color picker wiring ──────────────────────────────────────────────────────
const colorSliders = ['r', 'g', 'b'].map(ch => document.getElementById('slider-' + ch));
const colorValues  = ['r', 'g', 'b'].map(ch => document.getElementById('val-' + ch));
const previewCanvas = document.getElementById('color-preview');
const pctx = previewCanvas.getContext('2d');
let previewFrame = 0;

function setSliders([r, g, b]) {
  [r, g, b].forEach((v, i) => {
    colorSliders[i].value = v;
    colorValues[i].textContent = v;
  });
}

function drawColorPreview() {
  pctx.imageSmoothingEnabled = false;
  pctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  const anim = ANIMS[CLASS_DEFS[selectedClass].anim];
  const [sx, sy, sw, sh] = anim.idle[previewFrame % 4];
  const s = 1.7;
  pctx.drawImage(playerSheet, sx, sy, sw, sh,
    (previewCanvas.width - sw * s) / 2, (previewCanvas.height - sh * s) / 2, sw * s, sh * s);
}

colorSliders.forEach(sl => sl.addEventListener('input', () => {
  const c = colorSliders.map(s => Number(s.value));
  colorValues.forEach((el, i) => el.textContent = c[i]);
  playerColors[selectedClass] = c;
  try { localStorage.setItem('dg_colors', JSON.stringify(playerColors)); } catch (e) {}
  recolorPlayerSheet();
  drawColorPreview();
}));

// idle animation on the preview while the start screen is up
setInterval(() => {
  if (screens.start.classList.contains('active')) {
    previewFrame++;
    drawColorPreview();
  }
}, 250);

SHEET.addEventListener('load', () => {
  recolorPlayerSheet();
  setSliders(currentColor());
  drawColorPreview();
});

// ─── Init ─────────────────────────────────────────────────────────────────────
window.addEventListener('load', () => {
  canvas = document.getElementById('game-canvas');
  ctx    = canvas.getContext('2d');
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup',   e => {
    if (e.target.tagName === 'INPUT' && e.target.type === 'text') return;
    keys[e.code] = false;
    // button activation by Space fires on keyup — block it here too
    if (e.code === 'Space') e.preventDefault();
  });
  canvas.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
  canvas.addEventListener('mousedown', e => {
    if (e.button === 0) { mouseDown = true; attack(); }
    if (e.button === 2) castSpecial();
  });
  window.addEventListener('mouseup',   e => { if (e.button === 0) mouseDown = false; });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  showScreen('start');
});

function resizeCanvas() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  ctx.imageSmoothingEnabled = false; // resizing resets context state
  buildTileMap();
}

function onKeyDown(e) {
  if (e.target.tagName === 'INPUT' && e.target.type === 'text') return; // typing the hero name
  keys[e.code] = true;
  // Space/arrows must never re-trigger a focused button or scroll the page
  if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  if (e.code === 'KeyE') castSpecial();
  if (e.code === 'Escape') {
    if (gameState === 'playing') pauseGame();
    else if (gameState === 'paused') resumeGame();
  }
}

// ─── Screens ──────────────────────────────────────────────────────────────────
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  if (name && screens[name]) screens[name].classList.add('active');
}

function hideAllScreens() { showScreen(null); }

// ─── Tile Map ─────────────────────────────────────────────────────────────────
let floorCanvas = null;

function buildTileMap() {
  mapCols = Math.ceil(canvas.width  / TILE) + 1;
  mapRows = Math.ceil(canvas.height / TILE) + 1;
  tileMap = [];
  for (let r = 0; r < mapRows; r++) {
    tileMap[r] = [];
    for (let c = 0; c < mapCols; c++) {
      tileMap[r][c] = { variant: Math.random() };
    }
  }

  PLAY = {
    left:   TILE,
    right:  canvas.width - TILE,
    top:    TILE * 2,
    bottom: canvas.height - TILE * 2,
  };

  TORCH_POSITIONS.length = 0; // repositioned for the new size
  renderFloorCanvas();
}

// pre-renders the whole tilemap once; drawTiles() then blits a single image
function renderFloorCanvas() {
  if (!SHEET.complete || SHEET.naturalWidth === 0) return; // retried on SHEET load
  const W = canvas.width, H = canvas.height;
  floorCanvas = document.createElement('canvas');
  floorCanvas.width  = W;
  floorCanvas.height = H;
  const f = floorCanvas.getContext('2d');
  f.imageSmoothingEnabled = false;

  const blit = ([sx, sy, sw, sh], x, y) =>
    f.drawImage(SHEET, sx, sy, sw, sh, x, y, TILE, TILE);

  // floor covers everything; walls are drawn over it, anchored to the borders
  for (let r = 0; r < mapRows; r++) {
    for (let c = 0; c < mapCols; c++) {
      // mostly plain floor; light variants only, heavy cracks are too noisy
      const v = tileMap[r][c].variant;
      const tile = v < 0.88
        ? FLOOR_TILES[0]
        : FLOOR_TILES[1 + Math.floor(v * 31) % 5];
      blit(tile, c * TILE, r * TILE);
    }
  }

  // darken the floor slightly so torch glow stands out
  f.fillStyle = 'rgba(0,0,10,0.25)';
  f.fillRect(0, 0, W, H);

  // ── walls ──
  // top: cap row + face row (banner / crumbled hole flavor on the face)
  for (let x = 0; x < W; x += TILE) {
    blit(WALL_TILES.top, x, 0);
    const v = tileMap[0][Math.floor(x / TILE)].variant;
    const face = v < 0.06 ? WALL_TILES.banner_red
               : v < 0.12 ? WALL_TILES.banner_blue
               : v < 0.18 ? WALL_TILES.hole
               : WALL_TILES.mid;
    blit(WALL_TILES.mid, x, TILE);
    blit(face, x, TILE);
  }
  blit(WALL_TILES.top_left,  0,        0);
  blit(WALL_TILES.left,      0,        TILE);
  blit(WALL_TILES.top_right, W - TILE, 0);
  blit(WALL_TILES.right,     W - TILE, TILE);

  // bottom: cap row + face row
  for (let x = 0; x < W; x += TILE) {
    blit(WALL_TILES.top, x, H - TILE * 2);
    blit(WALL_TILES.mid, x, H - TILE);
  }

  // side columns between top face and bottom cap
  for (let y = TILE * 2; y < H - TILE * 2; y += TILE) {
    blit(WALL_TILES.edge_left,  0,        y);
    blit(WALL_TILES.edge_right, W - TILE, y);
  }
  blit(WALL_TILES.edge_bot_left,  0,        H - TILE * 2);
  blit(WALL_TILES.edge_bot_right, W - TILE, H - TILE * 2);
}

// ─── Game start/stop ──────────────────────────────────────────────────────────
function startGame() {
  score      = 0;
  gold       = 0;
  wave       = 0;
  waveActive = false;
  waveTimer  = 0;
  spawnQueue  = [];
  bullets     = [];
  enemies     = [];
  coins       = [];
  particles   = [];
  meleeSwings = [];
  upgrades    = [];
  potions     = [];
  chests      = [];
  floatTexts  = [];

  recolorPlayerSheet(); // make sure the chosen outfit color is baked in

  const cls = CLASS_DEFS[selectedClass];
  player = {
    x: canvas.width  / 2,
    y: canvas.height / 2,
    w: 20, h: 20,
    hp: cls.hp, maxHp: cls.hp,
    speed: cls.speed,
    cls: selectedClass,
    def: cls,
    tier: 0,
    weapon: cls.tiers[0],
    specialTimer: 0,
    stats: baseStats(),
    regenAcc: 0,
    name: heroName(),
    level: 1,
    xp: 0,
    xpNext: XP_BASE,
    stamina: STAMINA_BASE,
    sprinting: false,
    dustTimer: 0,
    invincible: 0,
    facing: 0,
    walkFrame: 0,
    walkTimer: 0,
  };

  hideAllScreens();
  hud.classList.remove('hidden');
  gameState = 'playing';
  lastTime  = performance.now();
  buildTileMap();
  startNextWave();

  if (animId) cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

function pauseGame()  { gameState = 'paused'; showScreen('pause'); }
function resumeGame() { gameState = 'playing'; hideAllScreens(); lastTime = performance.now(); animId = requestAnimationFrame(loop); }
function quitGame()   { gameState = 'start'; hud.classList.add('hidden'); showScreen('start'); cancelAnimationFrame(animId); }

function gameOver() {
  gameState = 'gameover';
  hud.classList.add('hidden');
  finalScore.textContent = score;
  finalWave.textContent  = wave;
  finalGold.textContent  = gold;
  showScreen('gameover');
}

// ─── Wave System ──────────────────────────────────────────────────────────────
function startNextWave() {
  wave++;
  waveActive = true;
  waveTimer  = 0;

  // leftover floor loot from the last wave is swept away
  // (weapon upgrades stay — they're core progression)
  coins   = [];
  potions = [];
  chests  = [];

  const bossType = BOSS_WAVES[wave];
  // boss waves have a smaller escort so the boss is the show
  const count = bossType ? 8 : 4 + wave * 3;
  spawnQueue = [];
  for (let i = 0; i < count; i++) {
    spawnQueue.push({
      delay: i * (Math.max(200, 900 - wave * 40)),
      type: pickEnemyType(wave),
    });
  }

  waveDisplay.textContent = wave + '/' + WAVES_TOTAL;
  if (bossType) {
    spawnBoss(bossType);
    const name = ENEMY_DEFS[bossType].boss;
    announceWave(wave === WAVES_TOTAL ? `☠ FINAL BOSS: ${name} ☠` : `☠ BOSS: ${name} ☠`);
  } else {
    announceWave(`— WAVE ${wave} —`);
  }

  // a chest may appear somewhere in the arena (might be a mimic...)
  if (wave >= 2 && Math.random() < Math.min(0.95, 0.6 * (1 + player.stats.luck / 100))) {
    const m = 90;
    chests.push({
      x: PLAY.left + m + Math.random() * (PLAY.right  - PLAY.left - m * 2),
      y: PLAY.top  + m + Math.random() * (PLAY.bottom - PLAY.top  - m * 2),
      state: 'closed', // closed → opening → looted
      timer: 0,
    });
  }
}

function pickEnemyType(w) {
  const r = Math.random();
  if (w < 2)  return r < 0.8 ? 'skeleton' : 'goblin';
  if (w < 4)  return r < 0.5 ? 'skeleton' : r < 0.8 ? 'goblin' : 'demon';
  return r < 0.35 ? 'skeleton' : r < 0.65 ? 'goblin' : r < 0.85 ? 'demon' : 'brute';
}

let announceTimer = null;
function announceWave(text) {
  waveAnnounce.textContent = text;
  waveAnnounce.classList.remove('hidden', 'show');
  void waveAnnounce.offsetWidth; // restart the CSS animation
  waveAnnounce.classList.add('show');
  clearTimeout(announceTimer); // overlapping announces: latest one wins
  announceTimer = setTimeout(() => waveAnnounce.classList.remove('show'), 2600);
}

// ─── Main Loop ────────────────────────────────────────────────────────────────
function loop(ts) {
  if (gameState !== 'playing') return;
  const dt = Math.min(ts - lastTime, 50);
  lastTime = ts;

  update(dt);
  render();

  animId = requestAnimationFrame(loop);
}

// ─── Update ───────────────────────────────────────────────────────────────────
function update(dt) {
  updatePlayer(dt);
  updateBullets(dt);
  updateMeleeSwings(dt);
  updateEnemies(dt);
  updateUpgrades(dt);
  updatePotions(dt);
  updateChests(dt);
  updateCoins(dt);
  updateParticles(dt);
  updateFloatTexts(dt);
  updateSpawnQueue(dt);
  checkWaveComplete();
  updateHUD();
}

// Player
function updatePlayer(dt) {
  const p = player;
  if (p.invincible > 0) p.invincible -= dt;
  if (p.specialTimer > 0) p.specialTimer -= dt;

  // passive HP regen: 0.2 HP/s per point, fractional carry
  if (p.stats.hpRegen > 0 && p.hp < p.maxHp) {
    p.regenAcc += (dt / 1000) * 0.2 * p.stats.hpRegen;
    if (p.regenAcc >= 1) {
      const heal = Math.floor(p.regenAcc);
      p.regenAcc -= heal;
      p.hp = Math.min(p.maxHp, p.hp + heal);
    }
  }

  let dx = 0, dy = 0;
  if (keys['KeyW'] || keys['ArrowUp'])    dy -= 1;
  if (keys['KeyS'] || keys['ArrowDown'])  dy += 1;
  if (keys['KeyA'] || keys['ArrowLeft'])  dx -= 1;
  if (keys['KeyD'] || keys['ArrowRight']) dx += 1;

  p.moving = (dx !== 0 || dy !== 0);
  if (p.moving) {
    const len = Math.sqrt(dx*dx + dy*dy);
    dx /= len; dy /= len;
    p.walkTimer += dt;
    if (p.walkTimer > 120) { p.walkFrame = (p.walkFrame + 1) % 4; p.walkTimer = 0; }
  }

  // stamina: sprint on shift; recovering stamina slows you to 70%
  const wantSprint = (keys['ShiftLeft'] || keys['ShiftRight']) && p.moving && p.stamina > 0;
  let staminaMult = 1;
  if (wantSprint) {
    p.sprinting = true;
    p.stamina   = Math.max(0, p.stamina - STAMINA_DRAIN * dt / 1000);
    staminaMult = SPRINT_MULT;
    // dust kicked up while sprinting
    p.dustTimer += dt;
    if (p.dustTimer > 90) {
      p.dustTimer = 0;
      spawnParticles(p.x - dx * 12, p.y + 14, 'rgba(180,170,150,0.8)', 2);
    }
  } else {
    p.sprinting = false;
    if (p.stamina < maxStamina()) {
      p.stamina   = Math.min(maxStamina(), p.stamina + STAMINA_REGEN * dt / 1000);
      staminaMult = FATIGUE_MULT;
    }
  }

  const effSpeed = p.speed * (1 + p.stats.speedPct / 100) * staminaMult;
  const nx = p.x + dx * effSpeed * (dt / 16.67);
  const ny = p.y + dy * effSpeed * (dt / 16.67);
  const margin = 10;
  p.x = Math.max(PLAY.left + margin, Math.min(PLAY.right  - margin, nx));
  p.y = Math.max(PLAY.top  + margin, Math.min(PLAY.bottom - margin, ny));

  // face toward mouse
  p.facing = Math.atan2(mouse.y - p.y, mouse.x - p.x);

  // auto-fire on hold (mouse or keys)
  if (mouseDown || keys['Space'] || keys['KeyZ']) {
    attack();
  }
}

function attack() {
  if (gameState !== 'playing') return;
  const w = player.weapon;
  const now = performance.now();
  const effRate = w.fireRate / (1 + player.stats.atkSpeedPct / 100);
  if (now - lastShot < effRate) return;
  lastShot = now;

  const angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
  if (w.attack === 'melee') {
    meleeAttack(angle, w);
  } else {
    // multi-shot weapons fan out around the aim
    const count = w.count || 1;
    for (let i = 0; i < count; i++) {
      const fan = count > 1 ? (i - (count - 1) / 2) * 0.14 : 0;
      fireProjectile(angle + fan, w.attack, w);
    }
  }
}

function fireProjectile(angle, type, w) {
  const spread = (Math.random() - 0.5) * 0.04;
  bullets.push({
    x: player.x,
    y: player.y,
    vx: Math.cos(angle + spread) * w.bulletSpeed,
    vy: Math.sin(angle + spread) * w.bulletSpeed,
    angle: angle + spread,
    speed: w.bulletSpeed,
    range: w.range + player.stats.range,
    damage: w.damage,
    pierce: w.pierce || 0,
    aoe: w.aoe || 0,
    type, // 'bolt' | 'arrow' | 'fireball'
    hitIds: new Set(),
    dist: 0,
    dead: false,
  });
}

// ─── Melee ────────────────────────────────────────────────────────────────────
function meleeAttack(angle, w) {
  const range = w.range + player.stats.range / 2; // melee gets half the range stat
  meleeSwings.push({ angle, life: 1, range, arc: w.arc });
  spawnParticles(
    player.x + Math.cos(angle) * range * 0.6,
    player.y + Math.sin(angle) * range * 0.6,
    '#ffe066', 4
  );

  for (const e of enemies) {
    if (e.dead) continue;
    const dx = e.x - player.x;
    const dy = e.y - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > range + Math.max(e.w, e.h) / 2) continue;

    let diff = Math.atan2(dy, dx) - angle;
    while (diff >  Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) > w.arc / 2) continue;

    dealDamage(e, w.damage, 'melee');
    // knockback away from player
    if (dist > 1) {
      e.x += (dx / dist) * w.knockback;
      e.y += (dy / dist) * w.knockback;
    }
  }
}

// ─── Special abilities (right-click / E) ──────────────────────────────────────
function castSpecial() {
  if (gameState !== 'playing' || player.specialTimer > 0) return;
  player.specialTimer = player.def.specialCd;

  const angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
  const w = player.weapon;

  switch (player.def.special) {
    case 'fireball':
      fireProjectile(angle, 'fireball', {
        bulletSpeed: 5.5, range: 520,
        damage: [80, 120], pierce: 0, aoe: 95,
      });
      break;

    case 'volley': {
      // ring of arrows in all directions
      const n = 12;
      for (let i = 0; i < n; i++) {
        fireProjectile(angle + (i / n) * Math.PI * 2, 'arrow', w);
      }
      break;
    }

    case 'whirlwind':
      meleeAttack(angle, {
        range: w.range + 14,
        arc: Math.PI * 2,
        damage: [w.damage[0] * 1.5 | 0, w.damage[1] * 1.5 | 0],
        knockback: w.knockback * 2,
      });
      break;
  }
}

function explode(b) {
  spawnParticles(b.x, b.y, '#ff8c00', 24);
  spawnParticles(b.x, b.y, '#ffe066', 16);
  for (const e of enemies) {
    if (e.dead) continue;
    const dx = e.x - b.x, dy = e.y - b.y;
    if (Math.sqrt(dx * dx + dy * dy) <= b.aoe + Math.max(e.w, e.h) / 2) {
      dealDamage(e, b.damage, 'elemental');
    }
  }
}

function updateMeleeSwings(dt) {
  for (const s of meleeSwings) s.life -= dt / 180;
  meleeSwings = meleeSwings.filter(s => s.life > 0);
}

// ─── Damage pipeline ──────────────────────────────────────────────────────────
// flat bonus by weapon kind, then % damage, then crit (x2); lifesteal on hit
function dealDamage(e, [min, max], kind, fx, fy) {
  const st = player.stats;
  let dmg = min + Math.floor(Math.random() * (max - min + 1));
  dmg += kind === 'melee' ? st.meleeDmg
       : kind === 'arrow' ? st.rangedDmg
       : st.elementalDmg; // bolt / fireball
  dmg = Math.max(1, Math.round(dmg * (1 + st.dmgPct / 100)));

  if (Math.random() < st.crit / 100) {
    dmg *= 2;
    addFloatText(e.x, e.y - e.h / 2 - 12, dmg + '!', '#f1c40f');
  }

  e.hp -= dmg;
  e.hitFlash = 150;
  spawnParticles(fx !== undefined ? fx : e.x, fy !== undefined ? fy : e.y, '#ff4444', 6);

  if (Math.random() < st.lifeSteal / 100 && player.hp < player.maxHp) {
    player.hp = Math.min(player.maxHp, player.hp + 1);
  }

  if (e.hp <= 0) killEnemy(e);
}

// Bullets
function updateBullets(dt) {
  const factor = dt / 16.67;
  for (const b of bullets) {
    if (b.dead) continue;
    b.x    += b.vx * factor;
    b.y    += b.vy * factor;
    b.dist += b.speed * factor;

    if (b.dist > b.range ||
        b.x < PLAY.left || b.x > PLAY.right ||
        b.y < PLAY.top  || b.y > PLAY.bottom) {
      b.dead = true;
      if (b.type === 'fireball') explode(b);
      else spawnParticles(b.x, b.y, '#ff8c00', 3);
      continue;
    }

    for (const e of enemies) {
      if (e.dead || b.hitIds.has(e)) continue;
      if (rectCircle(e.x, e.y, e.w, e.h, b.x, b.y, b.type === 'fireball' ? 9 : 5)) {
        if (b.type === 'fireball') {
          b.dead = true;
          explode(b);
          break;
        }
        b.hitIds.add(e);
        dealDamage(e, b.damage, b.type, b.x, b.y);
        if (b.pierce > 0) {
          b.pierce--;
        } else {
          b.dead = true;
          break;
        }
      }
    }
  }
  bullets = bullets.filter(b => !b.dead);
}

// Enemies
const ENEMY_DEFS = {
  skeleton: { hp: 50,  speed: 1.1, w: 26, h: 26, score: 10, gold: 1, anim: 'skelet',    potion: 0.03, dmg: 8  },
  goblin:   { hp: 35,  speed: 1.7, w: 24, h: 24, score: 15, gold: 2, anim: 'goblin',    potion: 0.03, dmg: 6  },
  demon:    { hp: 90,  speed: 0.9, w: 26, h: 40, score: 25, gold: 3, anim: 'chort',     potion: 0.08, dmg: 10 },
  brute:    { hp: 200, speed: 0.6, w: 52, h: 62, score: 50, gold: 6, anim: 'big_demon', potion: 0.25, dmg: 14 },
  mimic:    { hp: 130, speed: 1.5, w: 26, h: 24, score: 40, gold: 8, anim: 'mimic',     potion: 0.5,  dmg: 10 },
  // bosses (wave 8 and 16) — bigger sprite scale, summon minions, big loot
  zombie_king:  { hp: 1500, speed: 0.8,  w: 76, h: 92, score: 500,  gold: 25, anim: 'big_zombie', potion: 1, dmg: 16,
                  boss: 'ZOMBIE KING',  scale: 3, summons: ['skeleton', 'goblin'] },
  ogre_warlord: { hp: 3200, speed: 0.9,  w: 76, h: 92, score: 1500, gold: 50, anim: 'ogre',       potion: 1, dmg: 22,
                  boss: 'OGRE WARLORD', scale: 3, summons: ['demon', 'brute'] },
};

const WAVES_TOTAL   = 16;
const BOSS_WAVES    = { 8: 'zombie_king', 16: 'ogre_warlord' };
const WAVE_DURATION = 30000; // survive this long and the wave is cleared (boss waves excluded)

// ─── XP / leveling ────────────────────────────────────────────────────────────
const XP_BASE     = 100;  // xp needed for level 2
const XP_GROWTH   = 1.4;  // each level needs 40% more
const LEVEL_HP    = 10;   // max HP gained per level (also healed)

function gainXp(amount) {
  player.xp += amount;
  while (player.xp >= player.xpNext) {
    player.xp -= player.xpNext;
    player.xpNext = Math.round(player.xpNext * XP_GROWTH);
    player.level++;
    player.maxHp += LEVEL_HP;
    player.hp = Math.min(player.maxHp, player.hp + LEVEL_HP);
    addFloatText(player.x, player.y - 34, 'LEVEL UP!', '#66ccff');
    spawnParticles(player.x, player.y, '#66ccff', 16);
  }
}

function spawnEnemy(type) {
  const side = Math.floor(Math.random() * 4);
  let x, y;
  // spawn hugging the inside of a wall, with a puff so it reads as intentional
  const pad = 16;
  const rx  = () => PLAY.left + Math.random() * (PLAY.right  - PLAY.left);
  const ry  = () => PLAY.top  + Math.random() * (PLAY.bottom - PLAY.top);
  if (side === 0)      { x = rx(); y = PLAY.top + pad; }
  else if (side === 1) { x = PLAY.right - pad; y = ry(); }
  else if (side === 2) { x = rx(); y = PLAY.bottom - pad; }
  else                 { x = PLAY.left + pad; y = ry(); }
  spawnParticles(x, y, '#9b59b6', 8);

  enemies.push(makeEnemy(type, x, y));
}

function makeEnemy(type, x, y) {
  const def = ENEMY_DEFS[type];
  const hp  = def.hp + Math.floor(wave * def.hp * 0.12);
  return {
    x, y,
    w: def.w, h: def.h,
    hp, maxHp: hp,
    speed: def.speed + wave * 0.04,
    score: def.score,
    goldDrop: def.gold,
    potionChance: def.potion,
    dmg: def.dmg,
    boss: def.boss || null,
    scale: def.scale || SPRITE_SCALE,
    summons: def.summons || null,
    summonTimer: 0,
    type,
    anim: def.anim,
    dead: false,
    hitFlash: 0,
  };
}

function spawnBoss(type) {
  const e = makeEnemy(type, canvas.width / 2, PLAY.top + 60);
  enemies.push(e);
  spawnParticles(e.x, e.y, '#e74c3c', 30);
}

function updateEnemies(dt) {
  const factor = dt / 16.67;
  for (const e of enemies) {
    if (e.dead) continue;
    if (e.hitFlash > 0) e.hitFlash -= dt;

    // bosses call reinforcements every 6s
    if (e.boss && e.summons) {
      e.summonTimer += dt;
      if (e.summonTimer >= 6000) {
        e.summonTimer = 0;
        for (let i = 0; i < 2; i++) {
          const minion = makeEnemy(e.summons[Math.floor(Math.random() * e.summons.length)],
            e.x + (Math.random() - 0.5) * 80, e.y + (Math.random() - 0.5) * 80);
          enemies.push(minion);
          spawnParticles(minion.x, minion.y, '#9b59b6', 8);
        }
      }
    }

    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 1) {
      e.x += (dx / dist) * e.speed * factor;
      e.y += (dy / dist) * e.speed * factor;
    }

    // hit player (dodge avoids it entirely; armor reduces it)
    if (player.invincible <= 0 && rectCircle(e.x, e.y, e.w, e.h, player.x, player.y, 10)) {
      player.invincible = 600;
      const st = player.stats;
      if (Math.random() < Math.min(60, st.dodge) / 100) {
        addFloatText(player.x, player.y - 26, 'DODGE', '#3498db');
      } else {
        const dmg = Math.max(1, Math.round(e.dmg * (1 - st.armor / (st.armor + 15))));
        player.hp -= dmg;
        spawnParticles(player.x, player.y, '#ff0000', 8);
        if (player.hp <= 0) { player.hp = 0; gameOver(); return; }
      }
    }
  }
  enemies = enemies.filter(e => !e.dead);
}

function killEnemy(e) {
  e.dead = true;
  score += e.score;
  gainXp(e.score); // xp mirrors score value
  spawnParticles(e.x, e.y, enemyColor(e.type), 12);
  if (e.boss) {
    spawnParticles(e.x, e.y, '#ffd700', 40);
    spawnParticles(e.x, e.y, '#ff8c00', 30);
    addFloatText(e.x, e.y - 40, e.boss + ' SLAIN!', '#ffd700');
  }
  for (let i = 0; i < e.goldDrop; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r     = Math.random() * 20;
    coins.push({
      x: e.x + Math.cos(angle) * r,
      y: e.y + Math.sin(angle) * r,
      vx: Math.cos(angle) * 1.5,
      vy: Math.sin(angle) * 1.5,
      dead: false,
      bob: Math.random() * Math.PI * 2,
    });
  }
  if (Math.random() < e.potionChance * (1 + player.stats.luck / 100)) {
    potions.push({ x: e.x, y: e.y, bob: Math.random() * Math.PI * 2, dead: false });
  }
}

function enemyColor(type) {
  const c = { skeleton: '#e8dcc8', goblin: '#2ecc71', demon: '#9b59b6', brute: '#e74c3c' };
  return c[type] || '#fff';
}

// Coins
function updateCoins(dt) {
  const factor = dt / 16.67;
  for (const c of coins) {
    if (c.dead) continue;
    c.bob += 0.05 * factor;
    // slow down
    c.vx *= 0.92;
    c.vy *= 0.92;
    c.x  += c.vx * factor;
    c.y  += c.vy * factor;

    const dx   = player.x - c.x;
    const dy   = player.y - c.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < COIN_MAGNET) {
      const pull = (1 - dist / COIN_MAGNET) * 4;
      c.x += (dx / dist) * pull * factor;
      c.y += (dy / dist) * pull * factor;
    }
    if (dist < 14) { c.dead = true; gold++; spawnParticles(c.x, c.y, '#ffd700', 4); }
  }
  coins = coins.filter(c => !c.dead);
}

// Particles
function spawnParticles(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 3;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      decay: 0.03 + Math.random() * 0.04,
      size: 2 + Math.random() * 3,
      color,
    });
  }
}

function updateParticles(dt) {
  const factor = dt / 16.67;
  for (const p of particles) {
    p.x    += p.vx * factor;
    p.y    += p.vy * factor;
    p.vx   *= 0.94;
    p.vy   *= 0.94;
    p.life -= p.decay * factor;
  }
  particles = particles.filter(p => p.life > 0);
}

// Spawn Queue
function updateSpawnQueue(dt) {
  if (!waveActive) return;
  waveTimer += dt;
  for (const s of spawnQueue) {
    if (!s.spawned && waveTimer >= s.delay) {
      spawnEnemy(s.type);
      s.spawned = true;
    }
  }
}

function checkWaveComplete() {
  if (!waveActive) return;

  // survival timer: normal waves auto-complete after 30s (bosses must die)
  if (!BOSS_WAVES[wave] && waveTimer >= WAVE_DURATION) {
    for (const e of enemies) {
      if (!e.dead) spawnParticles(e.x, e.y, '#9b59b6', 6); // vanish, no loot
    }
    enemies = [];
    spawnQueue.forEach(s => s.spawned = true);
  }

  const allSpawned = spawnQueue.every(s => s.spawned);
  if (allSpawned && enemies.length === 0) {
    waveActive = false;
    if (wave >= WAVES_TOTAL) {
      setTimeout(victory, 1200);
      return;
    }
    announceWave(`WAVE ${wave} CLEAR!`);
    // weapon upgrade drop every 2 waves until max tier
    if (wave % 2 === 0 && player.tier < player.def.tiers.length - 1) {
      spawnUpgrade();
    }
    setTimeout(openShop, 1500);
  }
}

function victory() {
  if (gameState !== 'playing') return;
  gameState = 'victory';
  hud.classList.add('hidden');
  document.getElementById('victory-score').textContent = score;
  document.getElementById('victory-gold').textContent  = gold;
  showScreen('victory');
}

// ─── Shop flow ────────────────────────────────────────────────────────────────
function openShop() {
  if (gameState !== 'playing') return;
  gameState  = 'shop';
  rerollCost = 5;
  rollOffers();
  renderShop();
  showScreen('shop');
}

function closeShop() {
  hideAllScreens();
  gameState = 'playing';
  lastTime  = performance.now();
  startNextWave();
  animId = requestAnimationFrame(loop);
}

function rollOffers() {
  const pool = ITEM_POOL.filter(it => !it.cls || it.cls === player.cls);
  const picks = [...pool].sort(() => Math.random() - 0.5).slice(0, 4);
  shopOffers = picks.map(it => ({ item: it, sold: false }));
}

function applyMods(mods) {
  for (const [k, v] of Object.entries(mods)) {
    if (k === 'maxHp') {
      player.maxHp = Math.max(30, player.maxHp + v); // items can't kill you
      if (v > 0) player.hp += v;
      else player.hp = Math.min(player.hp, player.maxHp);
    } else {
      player.stats[k] += v;
    }
  }
}

function fmtMod(k, v) {
  const sign = v > 0 ? '+' : '';
  return `${sign}${v}${PCT_STATS.has(k) ? '%' : ''} ${STAT_LABELS[k]}`;
}

function renderShop() {
  document.getElementById('shop-gold').textContent = gold;

  // offers
  const wrap = document.getElementById('shop-items');
  wrap.innerHTML = shopOffers.map((o, i) => {
    if (o.sold) {
      return `<div class="shop-item offer sold"><span class="shop-name">SOLD</span></div>`;
    }
    const price = itemPrice(o.item);
    const fx = Object.entries(o.item.mods)
      .map(([k, v]) => `<span class="${v > 0 ? 'fx-pos' : 'fx-neg'}">${fmtMod(k, v)}</span>`)
      .join('');
    return `
      <button class="shop-item offer" data-i="${i}" ${gold < price ? 'disabled' : ''}>
        <span class="shop-icon">${o.item.icon}</span>
        <span class="shop-name">${o.item.name}</span>
        <span class="shop-effects">${fx}</span>
        <span class="shop-price">${price}</span>
      </button>`;
  }).join('');

  // heal / reroll
  const healBtn   = document.getElementById('btn-shop-heal');
  const rerollBtn = document.getElementById('btn-shop-reroll');
  document.getElementById('price-heal').textContent   = HEAL_PRICE;
  document.getElementById('price-reroll').textContent = rerollCost;
  healBtn.disabled   = gold < HEAL_PRICE || player.hp >= player.maxHp;
  rerollBtn.disabled = gold < rerollCost;

  // stats panel
  const st = player.stats;
  const rows = [['MAX HP', player.maxHp], ['HP', Math.ceil(player.hp)]]
    .concat(Object.keys(st).map(k => [
      STAT_LABELS[k],
      (st[k] > 0 ? '+' : '') + st[k] + (PCT_STATS.has(k) ? '%' : ''),
    ]));
  document.getElementById('shop-stats').innerHTML =
    rows.map(([l, v]) => `<div class="stat-line"><span>${l}</span><span>${v}</span></div>`).join('');
}

function buyOffer(i) {
  const o = shopOffers[i];
  if (!o || o.sold) return;
  const price = itemPrice(o.item);
  if (gold < price) return;
  gold -= price;
  o.sold = true;
  applyMods(o.item.mods);
  updateHUD();
  renderShop();
}

function shopHeal() {
  if (gold < HEAL_PRICE || player.hp >= player.maxHp) return;
  gold -= HEAL_PRICE;
  player.hp = Math.min(player.maxHp, player.hp + 30);
  updateHUD();
  renderShop();
}

function shopReroll() {
  if (gold < rerollCost) return;
  gold -= rerollCost;
  rerollCost += 5;
  rollOffers();
  updateHUD();
  renderShop();
}

// ─── Potions (auto-used on touch) ─────────────────────────────────────────────
function updatePotions(dt) {
  for (const pt of potions) {
    if (pt.dead) continue;
    pt.bob += dt * 0.004;
    const dx = player.x - pt.x;
    const dy = player.y - pt.y;
    // only picked up when hurt — no waste
    if (player.hp < player.maxHp && Math.sqrt(dx * dx + dy * dy) < 20) {
      pt.dead = true;
      const heal = Math.min(25, player.maxHp - player.hp);
      player.hp += heal;
      spawnParticles(player.x, player.y, '#2ecc71', 10);
      addFloatText(player.x, player.y - 24, `+${heal} HP`, '#2ecc71');
    }
  }
  potions = potions.filter(pt => !pt.dead);
}

// ─── Chests ───────────────────────────────────────────────────────────────────
function updateChests(dt) {
  for (const ch of chests) {
    if (ch.state === 'looted') {
      // empty chest lingers a moment, then fades away
      ch.fade -= dt / 1500;
      continue;
    }

    if (ch.state === 'opening') {
      ch.timer += dt;
      if (ch.timer >= 350) lootChest(ch);
      continue;
    }

    const dx = player.x - ch.x;
    const dy = player.y - ch.y;
    if (Math.sqrt(dx * dx + dy * dy) < 26) {
      ch.state = 'opening';
      ch.timer = 0;
    }
  }
  chests = chests.filter(ch => ch.state !== 'looted' || ch.fade > 0);
}

function lootChest(ch) {
  ch.state = 'looted';
  ch.fade  = 1;
  const roll = Math.random();

  if (roll < 0.15) {
    // mimic! it was never a chest at all
    ch.dead = true;
    chests = chests.filter(c => c !== ch);
    spawnParticles(ch.x, ch.y, '#9b59b6', 14);
    addFloatText(ch.x, ch.y - 24, 'MIMIC!', '#e74c3c');
    enemies.push(makeEnemy('mimic', ch.x, ch.y));
  } else if (roll < 0.6) {
    // gold burst
    const n = 6 + Math.floor(Math.random() * 5);
    for (let i = 0; i < n; i++) {
      const angle = Math.random() * Math.PI * 2;
      coins.push({
        x: ch.x, y: ch.y,
        vx: Math.cos(angle) * 2.5,
        vy: Math.sin(angle) * 2.5,
        dead: false,
        bob: Math.random() * Math.PI * 2,
      });
    }
    spawnParticles(ch.x, ch.y, '#ffd700', 12);
  } else {
    potions.push({ x: ch.x, y: ch.y - 20, bob: 0, dead: false });
    spawnParticles(ch.x, ch.y, '#2ecc71', 8);
  }
}

// ─── Floating combat text ─────────────────────────────────────────────────────
function addFloatText(x, y, text, color) {
  floatTexts.push({ x, y, text, color, life: 1 });
}

function updateFloatTexts(dt) {
  for (const t of floatTexts) {
    t.y    -= dt * 0.035;
    t.life -= dt / 1100;
  }
  floatTexts = floatTexts.filter(t => t.life > 0);
}

// ─── Weapon upgrades ──────────────────────────────────────────────────────────
function spawnUpgrade() {
  const margin = 120;
  upgrades.push({
    x: margin + Math.random() * (canvas.width  - margin * 2),
    y: margin + Math.random() * (canvas.height - margin * 2),
    bob: 0,
    dead: false,
  });
}

function updateUpgrades(dt) {
  for (const u of upgrades) {
    if (u.dead) continue;
    u.bob += dt * 0.004;
    const dx = player.x - u.x;
    const dy = player.y - u.y;
    if (Math.sqrt(dx * dx + dy * dy) < 24) {
      u.dead = true;
      player.tier++;
      player.weapon = player.def.tiers[player.tier];
      announceWave(player.weapon.name + '!');
      spawnParticles(u.x, u.y, '#ffd700', 16);
    }
  }
  upgrades = upgrades.filter(u => !u.dead);
}

// HUD
function updateHUD() {
  const pct = Math.max(0, player.hp / player.maxHp * 100);
  hpBar.style.width      = pct + '%';
  hpBar.style.background = pct > 50
    ? `linear-gradient(to right, #27ae60, #2ecc71)`
    : pct > 25
    ? `linear-gradient(to right, #e67e22, #f39c12)`
    : `linear-gradient(to right, #c0392b, #e74c3c)`;
  scoreDisplay.textContent = score;
  goldDisplay.textContent  = gold;

  const spPct = Math.max(0, 1 - player.specialTimer / player.def.specialCd) * 100;
  spBar.style.width = spPct + '%';
  spBar.classList.toggle('ready', spPct >= 100);

  const staPct = player.stamina / maxStamina() * 100;
  stBar.style.width = staPct + '%';
  stBar.classList.toggle('recovering', !player.sprinting && staPct < 100);

  document.getElementById('hud-name').textContent = player.name + ' · LV ' + player.level;
  document.getElementById('xp-bar').style.width = (player.xp / player.xpNext * 100) + '%';

  // wave countdown (boss waves don't expire)
  const timerEl = document.getElementById('wave-timer');
  if (!waveActive)            timerEl.textContent = '—';
  else if (BOSS_WAVES[wave])  timerEl.textContent = '☠';
  else timerEl.textContent = Math.max(0, Math.ceil((WAVE_DURATION - waveTimer) / 1000));

  // boss HP bar (top center)
  const boss = enemies.find(e => e.boss && !e.dead);
  const bossBar = document.getElementById('boss-bar');
  if (boss) {
    bossBar.classList.remove('hidden');
    document.getElementById('boss-name').textContent = boss.boss;
    document.getElementById('boss-hp').style.width = (boss.hp / boss.maxHp * 100) + '%';
  } else {
    bossBar.classList.add('hidden');
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function rectCircle(rx, ry, rw, rh, cx, cy, cr) {
  const nearX = Math.max(rx - rw/2, Math.min(cx, rx + rw/2));
  const nearY = Math.max(ry - rh/2, Math.min(cy, ry + rh/2));
  const dx = cx - nearX, dy = cy - nearY;
  return dx*dx + dy*dy < cr*cr;
}

// ─── Render ───────────────────────────────────────────────────────────────────
function render() {
  animTick = Math.floor(performance.now() / 140) % 4;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawTiles();
  drawTorches();
  drawChests();
  drawCoins();
  drawPotions();
  drawUpgrades();
  drawBullets();
  drawMeleeSwings();
  drawEnemies();
  drawPlayer();
  drawParticles();
  drawFloatTexts();
}

// Tiles
function drawTiles() {
  if (!floorCanvas) {
    renderFloorCanvas(); // sheet may have finished loading after resize
    if (!floorCanvas) {  // still loading: plain dark floor
      ctx.fillStyle = '#1a1a24';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      return;
    }
  }
  ctx.drawImage(floorCanvas, 0, 0);
}

// Torches (glow spots at room edges)
const TORCH_POSITIONS = [];
function drawTorches() {
  if (TORCH_POSITIONS.length === 0) {
    // torches sit on the walls themselves
    const spacing = 160;
    for (let x = TILE * 2.5; x < canvas.width - TILE * 2; x += spacing) {
      TORCH_POSITIONS.push({ x, y: TILE * 1.4 });
      TORCH_POSITIONS.push({ x, y: canvas.height - TILE * 1.5 });
    }
    for (let y = TILE * 3.5; y < canvas.height - TILE * 3; y += spacing) {
      TORCH_POSITIONS.push({ x: TILE * 0.5, y });
      TORCH_POSITIONS.push({ x: canvas.width - TILE * 0.5, y });
    }
  }

  const flicker = 0.85 + Math.sin(performance.now() / 120) * 0.15 + Math.random() * 0.03;
  for (const t of TORCH_POSITIONS) {
    const r = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, 90 * flicker);
    r.addColorStop(0,   `rgba(255,160,0,${0.18 * flicker})`);
    r.addColorStop(0.5, `rgba(255,100,0,${0.08 * flicker})`);
    r.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = r;
    ctx.fillRect(t.x - 90, t.y - 90, 180, 180);

    // torch icon (2px dot)
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(t.x - 2, t.y - 2, 4, 4);
    ctx.fillStyle = '#ff8c00';
    ctx.fillRect(t.x - 1, t.y - 4, 2, 2);
  }
}

// Bullets
function drawBullets() {
  for (const b of bullets) {
    if (b.type === 'arrow') {
      const [sx, sy, sw, sh] = WEAPON_SPRITES.arrow;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.angle + Math.PI / 2); // sprite points up
      ctx.drawImage(SHEET, sx, sy, sw, sh,
        -sw * SPRITE_SCALE / 2, -sh * SPRITE_SCALE / 2,
        sw * SPRITE_SCALE, sh * SPRITE_SCALE);
      ctx.restore();
    } else if (b.type === 'fireball') {
      const pulse = 1 + Math.sin(performance.now() / 60) * 0.15;
      ctx.shadowColor = '#ff4500';
      ctx.shadowBlur  = 20;
      ctx.fillStyle   = '#ff6600';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 9 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffe066';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 5 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      // fire trail
      spawnParticles(b.x, b.y, Math.random() < 0.5 ? '#ff8c00' : '#ff4500', 1);
    } else {
      // magic bolt
      ctx.shadowColor = '#ff8c00';
      ctx.shadowBlur  = 8;
      ctx.fillStyle   = '#ffe066';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }
}

// Melee swing arcs
function drawMeleeSwings() {
  for (const s of meleeSwings) {
    const progress = 1 - s.life; // 0 → 1
    // arc sweeps from one edge to the other as life decays
    const start = s.angle - s.arc / 2;
    const end   = start + s.arc * Math.min(1, progress * 2.2);

    ctx.save();
    ctx.globalAlpha = s.life * 0.85;
    ctx.strokeStyle = '#ffe066';
    ctx.shadowColor = '#ff8c00';
    ctx.shadowBlur  = 12;
    ctx.lineWidth   = 5;
    ctx.beginPath();
    ctx.arc(player.x, player.y, s.range - 6, start, end);
    ctx.stroke();
    ctx.lineWidth   = 2;
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(player.x, player.y, s.range - 12, start, end);
    ctx.stroke();
    ctx.restore();
  }
}

// Weapon upgrade pickups (shows the next-tier weapon floating)
function drawUpgrades() {
  for (const u of upgrades) {
    if (u.dead) continue;
    const nextTier = player.def.tiers[Math.min(player.tier + 1, player.def.tiers.length - 1)];
    const bobY = Math.sin(u.bob) * 4;

    // glow halo
    const g = ctx.createRadialGradient(u.x, u.y + bobY, 0, u.x, u.y + bobY, 28);
    g.addColorStop(0, 'rgba(255,215,0,0.35)');
    g.addColorStop(1, 'rgba(255,215,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(u.x - 28, u.y + bobY - 28, 56, 56);

    drawSprite(WEAPON_SPRITES[nextTier.sprite], u.x, u.y + bobY, false);
  }
}

// Enemies
function drawEnemies() {
  for (const e of enemies) {
    if (e.dead) continue;

    const frame = ANIMS[e.anim].run[animTick];
    const flip  = player.x < e.x; // face the player

    if (e.hitFlash > 0) ctx.filter = 'brightness(2.5) saturate(40%)';
    drawSprite(frame, e.x, e.y, flip, e.scale);
    ctx.filter = 'none';

    // HP bar (bosses use the big top bar instead)
    if (!e.boss && e.hp < e.maxHp) {
      const bw = e.w + 6;
      const bx = e.x - bw / 2;
      const by = e.y - e.h / 2 - 9;
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(bx, by, bw, 4);
      ctx.fillStyle = e.hp / e.maxHp > 0.5 ? '#27ae60' : '#e74c3c';
      ctx.fillRect(bx, by, bw * (e.hp / e.maxHp), 4);
    }
  }
}

// Player
function drawPlayer() {
  const p = player;
  if (p.invincible > 0 && Math.floor(p.invincible / 80) % 2 === 0) return; // blink

  const animSet = ANIMS[p.def.anim];
  const frame   = (p.moving ? animSet.run : animSet.idle)[animTick];
  const flip    = Math.cos(p.facing) < 0; // face the aim direction

  drawSprite(frame, p.x, p.y, flip, SPRITE_SCALE, playerSheet);
  drawHeldWeapon(p);

  // aim line (faint)
  ctx.strokeStyle = 'rgba(102,204,255,0.12)';
  ctx.lineWidth   = 1;
  ctx.setLineDash([4, 8]);
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x + Math.cos(p.facing) * 60, p.y + Math.sin(p.facing) * 60);
  ctx.stroke();
  ctx.setLineDash([]);
}

// held weapon, rotated toward the aim (sword follows the swing arc)
function drawHeldWeapon(p) {
  const [sx, sy, sw, sh] = WEAPON_SPRITES[p.weapon.sprite];
  let angle = p.facing;

  if (p.weapon.attack === 'melee' && meleeSwings.length > 0) {
    const s = meleeSwings[meleeSwings.length - 1];
    const progress = Math.min(1, (1 - s.life) * 2.2);
    angle = s.angle - s.arc / 2 + s.arc * progress;
  }

  // weapons have very different sprite heights (sword 21px, staff 30px);
  // normalize them all to the same on-screen size
  const targetH = 30;
  const scale   = targetH / sh;
  const dist    = 17;
  const side    = 12;             // perpendicular shift: held in the hand, away from the body
  const handY   = p.y + 10;
  const ox = Math.cos(angle) * dist + Math.cos(angle + Math.PI / 2) * side;
  const oy = Math.sin(angle) * dist + Math.sin(angle + Math.PI / 2) * side;
  ctx.save();
  ctx.translate(p.x + ox, handY + oy);
  ctx.rotate(angle + Math.PI / 2); // sprites point up
  ctx.drawImage(SHEET, sx, sy, sw, sh,
    -sw * scale / 2, -sh * scale / 2,
    sw * scale, sh * scale);
  ctx.restore();
}

// Coins
function drawCoins() {
  for (const c of coins) {
    if (c.dead) continue;
    const bobY = Math.sin(c.bob) * 2;
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur  = 6;
    drawSprite(COIN_FRAMES[animTick], c.x, c.y + bobY, false);
    ctx.shadowBlur = 0;
  }
}

// Potions
function drawPotions() {
  for (const pt of potions) {
    if (pt.dead) continue;
    const bobY = Math.sin(pt.bob) * 2;
    ctx.shadowColor = '#e74c3c';
    ctx.shadowBlur  = 8;
    drawSprite(FLASK_RED, pt.x, pt.y + bobY, false);
    ctx.shadowBlur = 0;
  }
}

// Chests
function drawChests() {
  for (const ch of chests) {
    let frame;
    if (ch.state === 'closed')       frame = CHEST_FRAMES[0];
    else if (ch.state === 'opening') frame = CHEST_FRAMES[Math.min(2, Math.floor(ch.timer / 120))];
    else                             frame = CHEST_EMPTY;

    if (ch.state === 'closed') {
      // soft golden shimmer so it catches the eye
      const glow = 0.5 + Math.sin(performance.now() / 300) * 0.3;
      ctx.shadowColor = `rgba(255,215,0,${glow})`;
      ctx.shadowBlur  = 10;
    } else if (ch.state === 'looted') {
      ctx.globalAlpha = Math.max(0, ch.fade);
    }
    drawSprite(frame, ch.x, ch.y, false);
    ctx.shadowBlur  = 0;
    ctx.globalAlpha = 1;
  }
}

// Floating combat text
function drawFloatTexts() {
  ctx.font         = 'bold 15px "MedievalSharp", serif';
  ctx.textAlign    = 'center';
  for (const t of floatTexts) {
    ctx.globalAlpha = Math.min(1, t.life * 1.5);
    ctx.fillStyle   = '#000';
    ctx.fillText(t.text, t.x + 1, t.y + 1);
    ctx.fillStyle   = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign   = 'left';
}

// Particles
function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = p.life;
    ctx.fillStyle   = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}
