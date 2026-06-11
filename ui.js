// ui.js — run state, stat/item tables, DOM wiring, share, unlocks, forge, pickers
// ─── State ────────────────────────────────────────────────────────────────────
let canvas, ctx;
let gameState = 'start'; // start | playing | paused | gameover
let lastTime   = 0;
let animId     = null;

let player, bullets, enemies, coins, particles, meleeSwings, upgrades;
let enemyBullets = [];
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
// dmgKind restricts the offer to classes using that damage type (no dead picks)
const ITEM_POOL = [
  { name: 'WHETSTONE',       icon: '🗡', price: 18, dmgKind: 'melee',     mods: { meleeDmg: 3 } },
  { name: 'BROADHEAD TIPS',  icon: '🏹', price: 18, dmgKind: 'arrow',     mods: { rangedDmg: 3 } },
  { name: 'FIRE GEM',        icon: '🔥', price: 18, dmgKind: 'elemental', mods: { elementalDmg: 3 } },
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
  const waveScale = 1 + (wave - 1) * 0.06; // pricier as waves go
  const discount  = 1 - forgeLevel('merchant') * 0.05;
  return Math.max(1, Math.round(item.price * waveScale * discount));
}
let score, gold, wave, waveTimer, waveActive;
let nextWaveDelay = 3000;
let spawnQueue   = [];
let runKills = 0, runGoldEarned = 0;
let shakeT = 0, shakeMag = 0; // screen shake timer/magnitude
let waveHasBoss = false;

function addShake(mag, dur = 220) {
  shakeMag = Math.max(shakeMag, mag);
  shakeT   = Math.max(shakeT, dur);
}
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
  levelup:  document.getElementById('levelup-screen'),
  forge:    document.getElementById('forge-screen'),
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
  if (btn) { btn.blur(); Sfx.play('click'); }
});

// keyboard-triggered clicks (Space/Enter on a focused button) have detail === 0;
// game flow buttons only respond to real mouse clicks
function mouseOnly(fn) {
  return e => { if (e.detail !== 0) fn(); };
}

document.getElementById('btn-start').addEventListener('click',   mouseOnly(() => startGame()));
document.getElementById('btn-resume').addEventListener('click',  mouseOnly(() => resumeGame()));
document.getElementById('btn-pause-restart').addEventListener('click', mouseOnly(() => startGame()));
document.getElementById('btn-quit').addEventListener('click',    mouseOnly(() => quitGame()));
document.getElementById('btn-restart').addEventListener('click', mouseOnly(() => startGame()));
document.getElementById('btn-victory-restart').addEventListener('click', mouseOnly(() => startGame()));
document.getElementById('levelup-choices').addEventListener('click', e => {
  if (e.detail === 0) return;
  const btn = e.target.closest('.shop-item[data-i]');
  if (btn) pickBlessing(Number(btn.dataset.i));
});
document.getElementById('btn-share-wa').addEventListener('click', mouseOnly(() => shareWhatsApp(false)));
document.getElementById('btn-share-wa-victory').addEventListener('click', mouseOnly(() => shareWhatsApp(true)));
document.getElementById('btn-share-tg').addEventListener('click', mouseOnly(() => shareTelegram(false)));
document.getElementById('btn-share-tg-victory').addEventListener('click', mouseOnly(() => shareTelegram(true)));

// ─── Social share ─────────────────────────────────────────────────────────────
const GAME_URL = 'https://gustavoktausend.github.io/DungeonGuys/';

function shareMessage(won) {
  return won
    ? `🏆 ${player.name} conquistou a masmorra! Zerei o DungeonGuys no nível ${player.level} ` +
      `com ${score} pontos! Consegue igualar? ⚔️`
    : `⚔️ ${player.name} lutou até a wave ${gameMode === 'endless' ? wave + ' (ENDLESS)' : wave + '/' + WAVES_TOTAL}` +
      ` e caiu no nível ${player.level}, com ${score} pontos no DungeonGuys! Consegue me superar?`;
}

function shareWhatsApp(won) {
  window.open('https://wa.me/?text=' + encodeURIComponent(shareMessage(won) + ' ' + GAME_URL),
    '_blank', 'noopener');
}

function shareTelegram(won) {
  window.open('https://t.me/share/url?url=' + encodeURIComponent(GAME_URL) +
    '&text=' + encodeURIComponent(shareMessage(won)),
    '_blank', 'noopener');
}

document.getElementById('btn-next-wave').addEventListener('click', mouseOnly(() => closeShop()));
document.getElementById('btn-shop-heal').addEventListener('click', mouseOnly(() => shopHeal()));
document.getElementById('btn-shop-reroll').addEventListener('click', mouseOnly(() => shopReroll()));
document.getElementById('shop-items').addEventListener('click', e => {
  if (e.detail === 0) return;
  const btn = e.target.closest('.shop-item[data-i]');
  if (btn) buyOffer(Number(btn.dataset.i));
});

// ─── Class unlocks & records ──────────────────────────────────────────────────
const UNLOCKS = {
  ninja:     'REACH WAVE 6',
  priestess: 'SLAY THE ZOMBIE KING',
  witch:     'REACH LEVEL 8',
};

function refreshClassCards() {
  document.querySelectorAll('.class-card').forEach(card => {
    const cls    = card.dataset.class;
    const desc   = card.querySelector('.class-desc');
    if (!desc.dataset.original) desc.dataset.original = desc.innerHTML;
    const locked = !!UNLOCKS[cls] && !Save.isUnlocked(cls);
    card.classList.toggle('locked', locked);
    desc.innerHTML = locked ? '🔒 ' + UNLOCKS[cls] : desc.dataset.original;
  });
}

function refreshClassRecord() {
  const r  = Save.classRecord(selectedClass);
  const el = document.getElementById('class-record');
  if (!r) { el.textContent = 'NO RUNS YET'; return; }
  const parts = ['BEST'];
  if (r.wave)  parts.push(`WAVE ${r.wave}`);
  if (r.ewave) parts.push(`∞${r.ewave}`);
  parts.push(`LV ${r.level}`, `${r.score} PTS`);
  if (r.victories) parts.push(`${r.victories}🏆`);
  el.textContent = parts.join(' · ');
}

function tryUnlock(cls) {
  if (!Save.unlock(cls)) return;
  announceWave(cls.toUpperCase() + ' UNLOCKED!');
  Sfx.play('victory');
  refreshClassCards();
}

document.querySelectorAll('.class-card').forEach(card => {
  card.addEventListener('click', () => {
    if (card.classList.contains('locked')) return;
    document.querySelectorAll('.class-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    selectedClass = card.dataset.class;
    setSliders(currentColor());
    recolorPlayerSheet();
    drawColorPreview();
    refreshClassRecord();
  });
});

// a previously selected class may be locked on a fresh save
if (UNLOCKS[selectedClass] && !Save.isUnlocked(selectedClass)) selectedClass = 'mage';
refreshClassCards();
refreshClassRecord();

// ─── PWA: service worker + platform-specific instructions ────────────────────
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

if (window.matchMedia && matchMedia('(pointer: coarse)').matches) {
  document.getElementById('inst-desktop').classList.add('hidden-inst');
  document.getElementById('inst-touch').classList.remove('hidden-inst');
}

// ─── Touch controls (mobile) ──────────────────────────────────────────────────
let touchActive = false;          // becomes true on the first touch
let joyTouchId  = null;
let joyOrigin   = { x: 0, y: 0 };
let touchVec    = { x: 0, y: 0 }; // analog movement vector, magnitude 0..1
const JOY_RADIUS = 58;

const touchUi  = document.getElementById('touch-ui');
const joyBase  = document.getElementById('joystick-base');
const joyKnob  = document.getElementById('joystick-knob');

function enableTouchUi() {
  if (touchActive) return;
  touchActive = true;
  touchUi.classList.add('enabled');
}

function setupTouchControls() {
  canvas.addEventListener('touchstart', e => {
    enableTouchUi();
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (joyTouchId === null && t.clientX < window.innerWidth * 0.55) {
        joyTouchId = t.identifier;
        joyOrigin = { x: t.clientX, y: t.clientY };
        joyBase.style.left = t.clientX + 'px';
        joyBase.style.top  = t.clientY + 'px';
        joyBase.style.display = 'block';
        joyKnob.style.transform = 'translate(-50%, -50%)';
      }
    }
  }, { passive: false });

  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier !== joyTouchId) continue;
      let dx = t.clientX - joyOrigin.x;
      let dy = t.clientY - joyOrigin.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > JOY_RADIUS) { dx = dx / len * JOY_RADIUS; dy = dy / len * JOY_RADIUS; }
      touchVec = { x: dx / JOY_RADIUS, y: dy / JOY_RADIUS };
      joyKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    }
  }, { passive: false });

  const endTouch = e => {
    for (const t of e.changedTouches) {
      if (t.identifier !== joyTouchId) continue;
      joyTouchId = null;
      touchVec = { x: 0, y: 0 };
      joyBase.style.display = 'none';
    }
  };
  canvas.addEventListener('touchend',    endTouch);
  canvas.addEventListener('touchcancel', endTouch);

  // action buttons
  const specialBtn = document.getElementById('btn-touch-special');
  const sprintBtn  = document.getElementById('btn-touch-sprint');
  const pauseBtn   = document.getElementById('btn-touch-pause');

  specialBtn.addEventListener('touchstart', e => { e.preventDefault(); castSpecial(); }, { passive: false });
  sprintBtn.addEventListener('touchstart',  e => {
    e.preventDefault();
    keys['ShiftLeft'] = true;
    sprintBtn.classList.add('held');
  }, { passive: false });
  const sprintEnd = () => { keys['ShiftLeft'] = false; sprintBtn.classList.remove('held'); };
  sprintBtn.addEventListener('touchend',    sprintEnd);
  sprintBtn.addEventListener('touchcancel', sprintEnd);
  pauseBtn.addEventListener('touchstart', e => {
    e.preventDefault();
    if (gameState === 'playing') pauseGame();
    else if (gameState === 'paused') resumeGame();
  }, { passive: false });
}

// ─── Auto-aim ─────────────────────────────────────────────────────────────────
let autoAim = Save.data.settings.autoAim;

const aimToggle = document.getElementById('auto-aim-toggle');
function refreshAimToggle() {
  aimToggle.textContent = '🎯 AUTO-AIM: ' + (autoAim ? 'ON' : 'OFF');
  aimToggle.classList.toggle('on', autoAim);
}
aimToggle.addEventListener('click', () => {
  autoAim = !autoAim;
  Save.data.settings.autoAim = autoAim;
  Save.persist();
  refreshAimToggle();
});
refreshAimToggle();

function nearestEnemy() {
  let best = null, bestD = Infinity;
  for (const e of enemies) {
    if (e.dead) continue;
    const d = (e.x - player.x) ** 2 + (e.y - player.y) ** 2;
    if (d < bestD) { bestD = d; best = e; }
  }
  return best;
}

// where the player is aiming: nearest enemy when auto-aim is on (always on for
// touch — there's no mouse to aim with), else the mouse
function aimAngle() {
  if (autoAim || touchActive) {
    const t = nearestEnemy();
    if (t) return Math.atan2(t.y - player.y, t.x - player.x);
  }
  return Math.atan2(mouse.y - player.y, mouse.x - player.x);
}

// ─── Sound ────────────────────────────────────────────────────────────────────
let soundMuted = Save.data.settings.mute;
Sfx.setMuted(soundMuted);

const soundToggle = document.getElementById('sound-toggle');
function refreshSoundToggle() {
  soundToggle.textContent = (soundMuted ? '🔇' : '🔊') + ' SOUND: ' + (soundMuted ? 'OFF' : 'ON');
  soundToggle.classList.toggle('on', !soundMuted);
}
function toggleSound() {
  soundMuted = !soundMuted;
  Save.data.settings.mute = soundMuted;
  Save.persist();
  Sfx.setMuted(soundMuted);
  refreshSoundToggle();
}
soundToggle.addEventListener('click', toggleSound);
refreshSoundToggle();

// browsers only allow audio after a user gesture
const audioBoot = () => {
  Sfx.init();
  Sfx.setMuted(soundMuted);
  document.removeEventListener('pointerdown', audioBoot);
  document.removeEventListener('keydown', audioBoot);
};
document.addEventListener('pointerdown', audioBoot);
document.addEventListener('keydown', audioBoot);

// ─── Forge (permanent upgrades bought with soul gold) ────────────────────────
const FORGE_UPGRADES = [
  { key: 'vigor',     icon: '❤',  name: 'STARTING VIGOR',  max: 5, base: 50, fmt: l => `+${l * 10} STARTING MAX HP` },
  { key: 'honed',     icon: '⚔',  name: 'HONED WEAPONS',   max: 5, base: 60, fmt: l => `+${l * 2}% DAMAGE` },
  { key: 'fleet',     icon: '👢', name: 'FLEET FOOT',      max: 3, base: 55, fmt: l => `+${l * 2}% SPEED` },
  { key: 'golden',    icon: '🪙', name: 'GOLDEN TOUCH',    max: 3, base: 70, fmt: l => `${l * 10}% CHANCE OF DOUBLE COINS` },
  { key: 'wise',      icon: '📜', name: 'WISE SOUL',       max: 3, base: 70, fmt: l => `+${l * 10}% XP` },
  { key: 'merchant',  icon: '🛒', name: 'MERCHANT FRIEND', max: 3, base: 80, fmt: l => `-${l * 5}% SHOP PRICES` },
  { key: 'startgold', icon: '💰', name: 'INHERITANCE',     max: 3, base: 45, fmt: l => `START WITH +${l * 15} GOLD` },
];
const FORGE_RATE = 0.25; // share of run gold forged into soul gold

function forgeLevel(key) { return Save.data.progress.forge[key] || 0; }
function forgeCost(key, base) { return Math.round(base * Math.pow(1.7, forgeLevel(key))); }

function refreshForgeButton() {
  document.getElementById('forge-gold').textContent = Save.data.progress.soulGold;
}

function renderForge() {
  document.getElementById('soul-gold').textContent = Save.data.progress.soulGold;
  document.getElementById('forge-list').innerHTML = FORGE_UPGRADES.map(u => {
    const lvl   = forgeLevel(u.key);
    const maxed = lvl >= u.max;
    const cost  = forgeCost(u.key, u.base);
    const pips  = '◆'.repeat(lvl) + '◇'.repeat(u.max - lvl);
    const buy   = maxed
      ? `<button class="f-buy maxed" disabled>MAX</button>`
      : `<button class="f-buy" data-key="${u.key}" ${Save.data.progress.soulGold < cost ? 'disabled' : ''}>${cost} ⚒</button>`;
    return `
      <div class="forge-row">
        <span class="f-icon">${u.icon}</span>
        <span class="f-info">
          <span class="f-name">${u.name}</span>
          <span class="f-desc">${u.fmt(Math.max(1, lvl + (maxed ? 0 : 1)))}</span>
          <span class="f-pips">${pips}</span>
        </span>
        ${buy}
      </div>`;
  }).join('');
}

function buyForge(key) {
  const u = FORGE_UPGRADES.find(x => x.key === key);
  if (!u || forgeLevel(key) >= u.max) return;
  const cost = forgeCost(key, u.base);
  if (Save.data.progress.soulGold < cost) return;
  Save.data.progress.soulGold -= cost;
  Save.data.progress.forge[key] = forgeLevel(key) + 1;
  Save.persist();
  Sfx.play('buy');
  renderForge();
  refreshForgeButton();
}

document.getElementById('btn-forge').addEventListener('click', mouseOnly(() => {
  renderForge();
  showScreen('forge');
}));
document.getElementById('btn-forge-close').addEventListener('click', mouseOnly(() => showScreen('start')));
document.getElementById('forge-list').addEventListener('click', e => {
  if (e.detail === 0) return;
  const btn = e.target.closest('.f-buy[data-key]');
  if (btn) buyForge(btn.dataset.key);
});
refreshForgeButton();

// ─── Game mode (campaign 16 waves / endless) ──────────────────────────────────
let gameMode = Save.data.settings.mode === 'endless' ? 'endless' : 'campaign';

document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.classList.toggle('selected', btn.dataset.mode === gameMode);
  btn.addEventListener('click', () => {
    gameMode = btn.dataset.mode;
    Save.data.settings.mode = gameMode;
    Save.persist();
    document.querySelectorAll('.mode-btn').forEach(b =>
      b.classList.toggle('selected', b.dataset.mode === gameMode));
  });
});

// which bosses (if any) spawn on this wave
function bossPlanForWave(w) {
  if (BOSS_WAVES[w]) return [BOSS_WAVES[w]]; // fixed bosses at 8 and 16
  if (gameMode !== 'endless' || w <= WAVES_TOTAL) return [];
  // endless past 16: guaranteed every 8th wave, otherwise a 20% roll —
  // and deeper waves can stack more than one boss at once
  if (w % 8 !== 0 && Math.random() >= 0.2) return [];
  const types = Object.values(BOSS_WAVES);
  const extraChance = Math.min(0.5, (w - WAVES_TOTAL) * 0.03);
  let count = 1 + (Math.random() < extraChance ? 1 : 0);
  if (w >= 32 && Math.random() < 0.25) count++;
  const plan = [];
  for (let i = 0; i < count; i++) plan.push(types[Math.floor(Math.random() * types.length)]);
  return plan;
}

// ─── Hero name ────────────────────────────────────────────────────────────────
const nameInput = document.getElementById('hero-name');
nameInput.value = Save.data.settings.name;
nameInput.addEventListener('input', () => {
  Save.data.settings.name = nameInput.value;
  Save.persist();
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
  Save.persist();
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

