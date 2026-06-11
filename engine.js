// engine.js — init, screens, tilemap, run lifecycle, wave system, main loop
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
  setupTouchControls();
  // coarse pointer (phone/tablet): enable the touch UI upfront
  if (window.matchMedia && matchMedia('(pointer: coarse)').matches) enableTouchUi();
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
  if (e.code === 'KeyM') toggleSound();
  if (gameState === 'levelup' && /^(Digit|Numpad)[123]$/.test(e.code)) {
    pickBlessing(Number(e.code.slice(-1)) - 1);
  }
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
  enemyBullets = [];
  enemies     = [];
  coins       = [];
  particles   = [];
  meleeSwings = [];
  upgrades    = [];
  potions     = [];
  chests      = [];
  floatTexts  = [];
  pendingLevelUps     = 0;
  pendingAfterLevelUp = null;
  runKills      = 0;
  runGoldEarned = 0;

  recolorPlayerSheet(); // make sure the chosen outfit color is baked in
  buildTileMap();
  generateArena();

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

  // forge perks
  player.maxHp += forgeLevel('vigor') * 10;
  player.hp     = player.maxHp;
  player.stats.dmgPct   += forgeLevel('honed') * 2;
  player.stats.speedPct += forgeLevel('fleet') * 2;
  gold += forgeLevel('startgold') * 15;

  hideAllScreens();
  hud.classList.remove('hidden');
  gameState = 'playing';
  Sfx.init();
  Sfx.startMusic();
  lastTime  = performance.now();
  buildTileMap();
  startNextWave();

  if (animId) cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

function pauseGame()  { gameState = 'paused'; showScreen('pause'); }
function resumeGame() { gameState = 'playing'; hideAllScreens(); lastTime = performance.now(); animId = requestAnimationFrame(loop); }
function quitGame()   { gameState = 'start'; hud.classList.add('hidden'); showScreen('start'); cancelAnimationFrame(animId); Sfx.stopMusic(); }

function gameOver() {
  gameState = 'gameover';
  Sfx.stopMusic();
  Sfx.play('gameover');
  hud.classList.add('hidden');
  const forged = Math.round(runGoldEarned * FORGE_RATE);
  Save.data.progress.soulGold += forged;
  const newBest = Save.recordRun(player.cls,
    { score, wave, level: player.level, won: false, kills: runKills, gold: runGoldEarned, mode: gameMode });
  document.getElementById('final-forge').textContent = '+' + forged + ' ⚒';
  refreshForgeButton();
  finalScore.textContent = score;
  finalWave.textContent  = wave;
  finalGold.textContent  = gold;
  document.getElementById('final-best').textContent = Save.classRecord(player.cls).score;
  document.getElementById('new-record').classList.toggle('hidden', !newBest);
  refreshClassRecord();
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
  enemyBullets = [];

  const bossPlan = bossPlanForWave(wave);
  waveHasBoss = bossPlan.length > 0;
  // boss waves have a smaller escort so the boss is the show
  const count = waveHasBoss ? 8 + Math.max(0, Math.floor((wave - WAVES_TOTAL) / 2)) : 4 + wave * 3;
  spawnQueue = [];
  for (let i = 0; i < count; i++) {
    spawnQueue.push({
      delay: i * (Math.max(200, 900 - wave * 40)),
      type: pickEnemyType(wave),
    });
  }

  if (wave >= 6) tryUnlock('ninja');
  waveDisplay.textContent = gameMode === 'endless' ? wave + ' ∞' : wave + '/' + WAVES_TOTAL;
  if (waveHasBoss) {
    Sfx.play('bosshorn');
    bossPlan.forEach((type, i) => spawnBoss(type, i, bossPlan.length));
    if (bossPlan.length > 1) {
      announceWave(`☠ ${bossPlan.length} BOSSES! ☠`);
    } else {
      const name = ENEMY_DEFS[bossPlan[0]].boss;
      announceWave(gameMode === 'campaign' && wave === WAVES_TOTAL
        ? `☠ FINAL BOSS: ${name} ☠` : `☠ BOSS: ${name} ☠`);
    }
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
  // weighted table; stronger/special enemies unlock as waves go
  const table = [['skeleton', 40], ['goblin', w >= 2 ? 28 : 12]];
  if (w >= 3) table.push(['demon', 16], ['swampy', 12]);
  if (w >= 4) table.push(['necromancer', 13]);
  if (w >= 5) table.push(['brute', 11]);

  let total = 0;
  for (const [, p] of table) total += p;
  let r = Math.random() * total;
  for (const [type, p] of table) {
    if ((r -= p) <= 0) return type;
  }
  return 'skeleton';
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

