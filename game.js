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
};
const COIN_FRAMES = frames(289, 385, 6, 7, 4, 8);
const WEAPON_SPRITES = {
  staff: [324, 129,  8, 30],
  bow:   [289, 195, 14, 26],
  sword: [323,  10, 10, 21],
  arrow: [324, 202,  7, 21],
};

let animTick = 0; // global 4-frame animation clock

// draws a frame centered on (x, y), optionally mirrored horizontally
function drawSprite(frame, x, y, flip) {
  const [sx, sy, sw, sh] = frame;
  const dw = sw * SPRITE_SCALE;
  const dh = sh * SPRITE_SCALE;
  ctx.save();
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(SHEET, sx, sy, sw, sh, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();
}

// ─── Classes (Brotato-style) ──────────────────────────────────────────────────
const CLASS_DEFS = {
  mage: {
    hp: 100, speed: 2.6, fireRate: 220,
    attack: 'bolt', anim: 'wizzard', weapon: 'staff',
    bulletSpeed: 7, range: 380, damage: [25, 35], pierce: 0,
  },
  archer: {
    hp: 80, speed: 3.0, fireRate: 380,
    attack: 'arrow', anim: 'elf', weapon: 'bow',
    bulletSpeed: 11, range: 560, damage: [30, 42], pierce: 2,
  },
  warrior: {
    hp: 150, speed: 2.8, fireRate: 420,
    attack: 'melee', anim: 'knight', weapon: 'sword',
    range: 58, damage: [45, 62], arc: Math.PI * 0.65, knockback: 14,
  },
};
let selectedClass = 'mage';

// ─── State ────────────────────────────────────────────────────────────────────
let canvas, ctx;
let gameState = 'start'; // start | playing | paused | gameover
let lastTime   = 0;
let animId     = null;

let player, bullets, enemies, coins, particles, meleeSwings;
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
  gameover: document.getElementById('gameover-screen'),
};
const hud          = document.getElementById('hud');
const hpBar        = document.getElementById('hp-bar');
const waveDisplay  = document.getElementById('wave-display');
const scoreDisplay = document.getElementById('score-display');
const goldDisplay  = document.getElementById('gold-display');
const waveAnnounce = document.getElementById('wave-announce');
const finalScore   = document.getElementById('final-score');
const finalWave    = document.getElementById('final-wave');
const finalGold    = document.getElementById('final-gold');

document.getElementById('btn-start').addEventListener('click',   startGame);
document.getElementById('btn-resume').addEventListener('click',  resumeGame);
document.getElementById('btn-quit').addEventListener('click',    quitGame);
document.getElementById('btn-restart').addEventListener('click', startGame);

document.querySelectorAll('.class-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.class-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    selectedClass = card.dataset.class;
  });
});

// ─── Init ─────────────────────────────────────────────────────────────────────
window.addEventListener('load', () => {
  canvas = document.getElementById('game-canvas');
  ctx    = canvas.getContext('2d');
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup',   e => { keys[e.code] = false; });
  canvas.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
  canvas.addEventListener('mousedown', e => { if (e.button === 0) { mouseDown = true; attack(); } });
  window.addEventListener('mouseup',   e => { if (e.button === 0) mouseDown = false; });
  showScreen('start');
});

function resizeCanvas() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  ctx.imageSmoothingEnabled = false; // resizing resets context state
  buildTileMap();
}

function onKeyDown(e) {
  keys[e.code] = true;
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
function buildTileMap() {
  mapCols = Math.ceil(canvas.width  / TILE) + 2;
  mapRows = Math.ceil(canvas.height / TILE) + 2;
  tileMap = [];
  for (let r = 0; r < mapRows; r++) {
    tileMap[r] = [];
    for (let c = 0; c < mapCols; c++) {
      // edge tiles are walls, rest are floor with slight variation
      const edge = (r === 0 || r === mapRows - 1 || c === 0 || c === mapCols - 1);
      tileMap[r][c] = { wall: edge, variant: Math.random() };
    }
  }
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

  const cls = CLASS_DEFS[selectedClass];
  player = {
    x: canvas.width  / 2,
    y: canvas.height / 2,
    w: 20, h: 20,
    hp: cls.hp, maxHp: cls.hp,
    speed: cls.speed,
    cls: selectedClass,
    def: cls,
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
  const count = 4 + wave * 3;
  spawnQueue = [];
  for (let i = 0; i < count; i++) {
    spawnQueue.push({
      delay: i * (Math.max(200, 900 - wave * 40)),
      type: pickEnemyType(wave),
    });
  }
  waveDisplay.textContent = wave;
  announceWave(`— WAVE ${wave} —`);
}

function pickEnemyType(w) {
  const r = Math.random();
  if (w < 2)  return r < 0.8 ? 'skeleton' : 'goblin';
  if (w < 4)  return r < 0.5 ? 'skeleton' : r < 0.8 ? 'goblin' : 'demon';
  return r < 0.35 ? 'skeleton' : r < 0.65 ? 'goblin' : r < 0.85 ? 'demon' : 'brute';
}

function announceWave(text) {
  waveAnnounce.textContent = text;
  waveAnnounce.className   = '';
  void waveAnnounce.offsetWidth;
  waveAnnounce.classList.add('show');
  setTimeout(() => waveAnnounce.classList.add('hidden'), 2600);
  setTimeout(() => waveAnnounce.classList.remove('hidden', 'show'), 2700);
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
  updateCoins(dt);
  updateParticles(dt);
  updateSpawnQueue(dt);
  checkWaveComplete();
  updateHUD();
}

// Player
function updatePlayer(dt) {
  const p = player;
  if (p.invincible > 0) p.invincible -= dt;

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

  const nx = p.x + dx * p.speed * (dt / 16.67);
  const ny = p.y + dy * p.speed * (dt / 16.67);
  const margin = 8;
  p.x = Math.max(margin, Math.min(canvas.width  - margin, nx));
  p.y = Math.max(margin, Math.min(canvas.height - margin, ny));

  // face toward mouse
  p.facing = Math.atan2(mouse.y - p.y, mouse.x - p.x);

  // auto-fire on hold (mouse or keys)
  if (mouseDown || keys['Space'] || keys['KeyZ']) {
    attack();
  }
}

function attack() {
  if (gameState !== 'playing') return;
  const def = player.def;
  const now = performance.now();
  if (now - lastShot < def.fireRate) return;
  lastShot = now;

  const angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
  if (def.attack === 'melee') {
    meleeAttack(angle);
  } else {
    const spread = (Math.random() - 0.5) * 0.04;
    bullets.push({
      x: player.x,
      y: player.y,
      vx: Math.cos(angle + spread) * def.bulletSpeed,
      vy: Math.sin(angle + spread) * def.bulletSpeed,
      angle: angle + spread,
      speed: def.bulletSpeed,
      range: def.range,
      damage: def.damage,
      pierce: def.pierce,
      type: def.attack, // 'bolt' | 'arrow'
      hitIds: new Set(),
      dist: 0,
      dead: false,
    });
  }
}

// ─── Melee ────────────────────────────────────────────────────────────────────
function meleeAttack(angle) {
  const def = player.def;
  meleeSwings.push({ angle, life: 1 });
  spawnParticles(
    player.x + Math.cos(angle) * def.range * 0.6,
    player.y + Math.sin(angle) * def.range * 0.6,
    '#ffe066', 4
  );

  for (const e of enemies) {
    if (e.dead) continue;
    const dx = e.x - player.x;
    const dy = e.y - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > def.range + Math.max(e.w, e.h) / 2) continue;

    let diff = Math.atan2(dy, dx) - angle;
    while (diff >  Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) > def.arc / 2) continue;

    e.hp -= rollDamage(def.damage);
    e.hitFlash = 150;
    // knockback away from player
    if (dist > 1) {
      e.x += (dx / dist) * def.knockback;
      e.y += (dy / dist) * def.knockback;
    }
    spawnParticles(e.x, e.y, '#ff4444', 6);
    if (e.hp <= 0) killEnemy(e);
  }
}

function updateMeleeSwings(dt) {
  for (const s of meleeSwings) s.life -= dt / 180;
  meleeSwings = meleeSwings.filter(s => s.life > 0);
}

function rollDamage([min, max]) {
  return min + Math.floor(Math.random() * (max - min + 1));
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
        b.x < 0 || b.x > canvas.width ||
        b.y < 0 || b.y > canvas.height) {
      b.dead = true;
      spawnParticles(b.x, b.y, '#ff8c00', 3);
      continue;
    }

    for (const e of enemies) {
      if (e.dead || b.hitIds.has(e)) continue;
      if (rectCircle(e.x, e.y, e.w, e.h, b.x, b.y, 5)) {
        e.hp -= rollDamage(b.damage);
        e.hitFlash = 150;
        b.hitIds.add(e);
        spawnParticles(b.x, b.y, '#ff4444', 6);
        if (e.hp <= 0) killEnemy(e);
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
  skeleton: { hp: 50,  speed: 1.1, w: 26, h: 26, score: 10, gold: 1, anim: 'skelet' },
  goblin:   { hp: 35,  speed: 1.7, w: 24, h: 24, score: 15, gold: 2, anim: 'goblin' },
  demon:    { hp: 90,  speed: 0.9, w: 26, h: 40, score: 25, gold: 3, anim: 'chort' },
  brute:    { hp: 200, speed: 0.6, w: 52, h: 62, score: 50, gold: 6, anim: 'big_demon' },
};

function spawnEnemy(type) {
  const def  = ENEMY_DEFS[type];
  const side = Math.floor(Math.random() * 4);
  let x, y;
  const pad = 20;
  if (side === 0) { x = Math.random() * canvas.width;  y = -pad; }
  else if (side === 1) { x = canvas.width + pad;  y = Math.random() * canvas.height; }
  else if (side === 2) { x = Math.random() * canvas.width;  y = canvas.height + pad; }
  else                 { x = -pad; y = Math.random() * canvas.height; }

  enemies.push({
    x, y,
    w: def.w, h: def.h,
    hp: def.hp + Math.floor(wave * def.hp * 0.12),
    maxHp: def.hp + Math.floor(wave * def.hp * 0.12),
    speed: def.speed + wave * 0.04,
    score: def.score,
    goldDrop: def.gold,
    type,
    anim: def.anim,
    dead: false,
    hitFlash: 0,
  });
}

function updateEnemies(dt) {
  const factor = dt / 16.67;
  for (const e of enemies) {
    if (e.dead) continue;
    if (e.hitFlash > 0) e.hitFlash -= dt;

    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 1) {
      e.x += (dx / dist) * e.speed * factor;
      e.y += (dy / dist) * e.speed * factor;
    }

    // hit player
    if (player.invincible <= 0 && rectCircle(e.x, e.y, e.w, e.h, player.x, player.y, 10)) {
      player.hp -= 8;
      player.invincible = 600;
      spawnParticles(player.x, player.y, '#ff0000', 8);
      if (player.hp <= 0) { player.hp = 0; gameOver(); return; }
    }
  }
  enemies = enemies.filter(e => !e.dead);
}

function killEnemy(e) {
  e.dead = true;
  score += e.score;
  spawnParticles(e.x, e.y, enemyColor(e.type), 12);
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
  const allSpawned = spawnQueue.every(s => s.spawned);
  if (allSpawned && enemies.length === 0) {
    waveActive = false;
    announceWave(`WAVE ${wave} CLEAR!`);
    setTimeout(startNextWave, nextWaveDelay);
  }
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
  drawCoins();
  drawBullets();
  drawMeleeSwings();
  drawEnemies();
  drawPlayer();
  drawParticles();
}

// Tiles
function drawTiles() {
  for (let r = 0; r < mapRows; r++) {
    for (let c = 0; c < mapCols; c++) {
      const t = tileMap[r][c];
      const x = (c - 1) * TILE;
      const y = (r - 1) * TILE;

      if (t.wall) {
        ctx.fillStyle = t.variant > 0.85 ? '#141420' : '#1a1a28';
        ctx.fillRect(x, y, TILE, TILE);
        // brick lines
        ctx.strokeStyle = '#0e0e1a';
        ctx.lineWidth   = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
      } else {
        const shade = 0x14 + Math.floor(t.variant * 0x0a);
        ctx.fillStyle = `rgb(${shade},${shade},${shade + 0x10})`;
        ctx.fillRect(x, y, TILE, TILE);

        // grout lines
        ctx.strokeStyle = 'rgba(0,0,0,0.25)';
        ctx.lineWidth   = 1;
        if ((r + c) % 2 === 0) {
          ctx.beginPath();
          ctx.moveTo(x, y + TILE / 2);
          ctx.lineTo(x + TILE, y + TILE / 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x + TILE / 2, y);
          ctx.lineTo(x + TILE / 2, y + TILE);
          ctx.stroke();
        } else {
          ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
        }

        // random cracks / imperfections
        if (t.variant < 0.08) {
          ctx.strokeStyle = 'rgba(0,0,0,0.3)';
          ctx.beginPath();
          ctx.moveTo(x + 4, y + 4);
          ctx.lineTo(x + 10, y + 14);
          ctx.stroke();
        }
      }
    }
  }
}

// Torches (glow spots at room edges)
const TORCH_POSITIONS = [];
function drawTorches() {
  if (TORCH_POSITIONS.length === 0) {
    const margin = TILE * 2;
    const spacing = 160;
    for (let x = margin; x < canvas.width - margin; x += spacing) {
      TORCH_POSITIONS.push({ x, y: margin });
      TORCH_POSITIONS.push({ x, y: canvas.height - margin });
    }
    for (let y = margin + spacing; y < canvas.height - margin; y += spacing) {
      TORCH_POSITIONS.push({ x: margin, y });
      TORCH_POSITIONS.push({ x: canvas.width - margin, y });
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
  const def = CLASS_DEFS.warrior;
  for (const s of meleeSwings) {
    const progress = 1 - s.life; // 0 → 1
    const sweep    = def.arc;
    // arc sweeps from one edge to the other as life decays
    const start = s.angle - sweep / 2;
    const end   = start + sweep * Math.min(1, progress * 2.2);

    ctx.save();
    ctx.globalAlpha = s.life * 0.85;
    ctx.strokeStyle = '#ffe066';
    ctx.shadowColor = '#ff8c00';
    ctx.shadowBlur  = 12;
    ctx.lineWidth   = 5;
    ctx.beginPath();
    ctx.arc(player.x, player.y, def.range - 6, start, end);
    ctx.stroke();
    ctx.lineWidth   = 2;
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(player.x, player.y, def.range - 12, start, end);
    ctx.stroke();
    ctx.restore();
  }
}

// Enemies
function drawEnemies() {
  for (const e of enemies) {
    if (e.dead) continue;

    const frame = ANIMS[e.anim].run[animTick];
    const flip  = player.x < e.x; // face the player

    if (e.hitFlash > 0) ctx.filter = 'brightness(2.5) saturate(40%)';
    drawSprite(frame, e.x, e.y, flip);
    ctx.filter = 'none';

    // HP bar
    if (e.hp < e.maxHp) {
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

  drawSprite(frame, p.x, p.y, flip);
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
  const [sx, sy, sw, sh] = WEAPON_SPRITES[p.def.weapon];
  let angle = p.facing;

  if (p.def.attack === 'melee' && meleeSwings.length > 0) {
    const s = meleeSwings[meleeSwings.length - 1];
    const progress = Math.min(1, (1 - s.life) * 2.2);
    angle = s.angle - p.def.arc / 2 + p.def.arc * progress;
  }

  const dist = 18;
  ctx.save();
  ctx.translate(p.x + Math.cos(angle) * dist, p.y + Math.sin(angle) * dist);
  ctx.rotate(angle + Math.PI / 2); // sprites point up
  ctx.drawImage(SHEET, sx, sy, sw, sh,
    -sw * SPRITE_SCALE / 2, -sh * SPRITE_SCALE / 2,
    sw * SPRITE_SCALE, sh * SPRITE_SCALE);
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

// Particles
function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = p.life;
    ctx.fillStyle   = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}
