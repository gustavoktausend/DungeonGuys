// entities.js — enemy definitions and AI, spawning, XP and level-up blessings
// Enemies
const ENEMY_DEFS = {
  skeleton: { hp: 50,  speed: 1.1, w: 26, h: 26, score: 10, gold: 1, anim: 'skelet',    potion: 0.03, dmg: 8  },
  goblin:   { hp: 35,  speed: 1.7, w: 24, h: 24, score: 15, gold: 2, anim: 'goblin',    potion: 0.03, dmg: 6  },
  demon:    { hp: 90,  speed: 0.9, w: 26, h: 40, score: 25, gold: 3, anim: 'chort',     potion: 0.08, dmg: 10 },
  brute:    { hp: 200, speed: 0.6, w: 52, h: 62, score: 50, gold: 6, anim: 'big_demon', potion: 0.25, dmg: 14 },
  mimic:    { hp: 130, speed: 1.5, w: 26, h: 24, score: 40, gold: 8, anim: 'mimic',     potion: 0.5,  dmg: 10 },
  // shooter: keeps its distance and lobs dark bolts at the player
  necromancer: { hp: 70, speed: 0.85, w: 26, h: 38, score: 30, gold: 4, anim: 'necromancer', potion: 0.1, dmg: 8,
                 shooter: { range: 260, interval: 2200, bulletSpeed: 4.5, dmg: 10 } },
  // exploder: sprints at the player, flashes, and detonates
  swampy:      { hp: 45, speed: 2.0,  w: 24, h: 24, score: 20, gold: 2, anim: 'swampy', potion: 0.05, dmg: 4,
                 exploder: { fuse: 700, radius: 90, dmg: 18, triggerDist: 55 } },
  // bosses (wave 8 and 16) — bigger sprite scale, summon minions, big loot
  zombie_king:  { hp: 1500, speed: 0.8,  w: 76, h: 92, score: 500,  gold: 25, anim: 'big_zombie', potion: 1, dmg: 16,
                  boss: 'ZOMBIE KING',  scale: 3, summons: ['skeleton', 'goblin'],
                  abilities: { charge: 6500 } },
  ogre_warlord: { hp: 3200, speed: 0.9,  w: 76, h: 92, score: 1500, gold: 50, anim: 'ogre',       potion: 1, dmg: 22,
                  boss: 'OGRE WARLORD', scale: 3, summons: ['demon', 'brute'],
                  abilities: { charge: 8000, ring: 7000 } },
};

const WAVES_TOTAL   = 16;
const BOSS_WAVES    = { 8: 'zombie_king', 16: 'ogre_warlord' };
const WAVE_DURATION = 30000; // survive this long and the wave is cleared (boss waves excluded)

// ─── XP / leveling ────────────────────────────────────────────────────────────
const XP_BASE     = 100;  // xp needed for level 2
const XP_GROWTH   = 1.4;  // each level needs 40% more
const LEVEL_HP    = 10;   // max HP gained per level (also healed)

function gainXp(amount) {
  amount = Math.round(amount * (1 + forgeLevel('wise') * 0.1));
  player.xp += amount;
  while (player.xp >= player.xpNext) {
    player.xp -= player.xpNext;
    player.xpNext = Math.round(player.xpNext * XP_GROWTH);
    player.level++;
    player.maxHp += LEVEL_HP;
    player.hp = Math.min(player.maxHp, player.hp + LEVEL_HP);
    pendingLevelUps++;
    if (player.level >= 8) tryUnlock('witch');
    addFloatText(player.x, player.y - 34, 'LEVEL UP!', '#66ccff');
    Sfx.play('levelup');
    spawnParticles(player.x, player.y, '#66ccff', 16);
  }
  maybeOpenLevelUp();
}

// ─── Level-up blessings (pick 1 of 3) ─────────────────────────────────────────
const LEVELUP_POOL = [
  { name: 'MIGHT',       icon: '💪', mods: { dmgPct: 4 } },
  { name: 'HASTE',       icon: '⚡', mods: { atkSpeedPct: 5 } },
  { name: 'PRECISION',   icon: '🎯', mods: { crit: 3 } },
  { name: 'IRON SKIN',   icon: '🛡', mods: { armor: 1 } },
  { name: 'EVASION',     icon: '💨', mods: { dodge: 3 } },
  { name: 'VITALITY',    icon: '❤', mods: { maxHp: 15 } },
  { name: 'REGROWTH',    icon: '🌿', mods: { hpRegen: 1 } },
  { name: 'BLOODTHIRST', icon: '🦇', mods: { lifeSteal: 2 } },
  { name: 'SWIFTNESS',   icon: '👢', mods: { speedPct: 4 } },
  { name: 'FORTUNE',     icon: '🍀', mods: { luck: 10 } },
  { name: 'REACH',       icon: '👁', mods: { range: 15 } },
  { name: 'ENDURANCE',   icon: '🥤', mods: { stamina: 15 } },
  { name: 'SHARPNESS',   icon: '🗡', dmgKind: 'melee',     mods: { meleeDmg: 2 } },
  { name: 'PIERCING',    icon: '🏹', dmgKind: 'arrow',     mods: { rangedDmg: 2 } },
  { name: 'SORCERY',     icon: '🔥', dmgKind: 'elemental', mods: { elementalDmg: 2 } },
];

let pendingLevelUps     = 0;
let levelChoices        = [];
let pendingAfterLevelUp = null; // 'shop' | 'victory' blocked while choosing

function playerDmgKind() {
  const atk = player.weapon.attack;
  return atk === 'melee' ? 'melee'
       : (atk === 'arrow' || atk === 'bullet') ? 'arrow'
       : 'elemental';
}

function maybeOpenLevelUp() {
  if (pendingLevelUps <= 0 || gameState !== 'playing') return;
  gameState = 'levelup';
  rollLevelChoices();
  showScreen('levelup');
}

function rollLevelChoices() {
  const kind = playerDmgKind();
  const pool = LEVELUP_POOL.filter(b => !b.dmgKind || b.dmgKind === kind);
  levelChoices = [...pool].sort(() => Math.random() - 0.5).slice(0, 3);

  document.getElementById('levelup-choices').innerHTML = levelChoices.map((b, i) => {
    const fx = Object.entries(b.mods)
      .map(([k, v]) => `<span class="fx-pos">${fmtMod(k, v)}</span>`).join('');
    return `
      <button class="shop-item" data-i="${i}">
        <span class="shop-icon">${b.icon}</span>
        <span class="shop-name">${b.name}</span>
        <span class="shop-effects">${fx}</span>
      </button>`;
  }).join('');
}

function pickBlessing(i) {
  const b = levelChoices[i];
  if (!b || gameState !== 'levelup') return;
  applyMods(b.mods);
  Sfx.play('upgrade');
  pendingLevelUps--;
  if (pendingLevelUps > 0) {
    rollLevelChoices(); // queued level-ups: choose again
  } else {
    closeLevelUp();
  }
}

function closeLevelUp() {
  hideAllScreens();
  gameState = 'playing';
  lastTime  = performance.now();
  animId = requestAnimationFrame(loop);
  updateHUD();
  // wave-end events that fired while choosing resume now
  const after = pendingAfterLevelUp;
  pendingAfterLevelUp = null;
  if (after === 'shop')    openShop();
  if (after === 'victory') victory();
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
    poisonT: 0,
    poisonDps: 0,
    slowT: 0,
    shooter: def.shooter || null,
    shootT: 0,
    exploder: def.exploder || null,
    fusing: false,
    fuseT: 0,
    abilities: def.abilities || null,
    cd: {},
    bossState: 'chase',
    stateT: 0,
    trapT: 0,
    chargeDir: { x: 0, y: 0 },
    enraged: false,
  };
}

// exploder went off by itself: no loot, no xp — just the blast
function selfDetonate(e) {
  e.dead = true;
  Sfx.play('explosion');
  addShake(7, 280);
  spawnParticles(e.x, e.y, '#2ecc71', 20);
  spawnParticles(e.x, e.y, '#ff8c00', 14);
  const ex = player.x - e.x, ey = player.y - e.y;
  if (Math.sqrt(ex * ex + ey * ey) <= e.exploder.radius + 10) {
    damagePlayer(e.exploder.dmg);
  }
}

// all damage to the player funnels here: i-frames, dodge, then armor
function damagePlayer(raw) {
  if (player.invincible > 0) return;
  player.invincible = 600;
  const st = player.stats;
  if (Math.random() < Math.min(60, st.dodge) / 100) {
    addFloatText(player.x, player.y - 26, 'DODGE', '#3498db');
    Sfx.play('dodge');
    return;
  }
  const dmg = Math.max(1, Math.round(raw * (1 - st.armor / (st.armor + 15))));
  player.hp -= dmg;
  spawnParticles(player.x, player.y, '#ff0000', 8);
  addFloatText(player.x, player.y - 30, '-' + dmg, '#e74c3c');
  addShake(6);
  const flash = document.getElementById('hurt-flash');
  flash.classList.remove('show');
  void flash.offsetWidth;
  flash.classList.add('show');
  Sfx.play('hurt');
  if (player.hp <= 0) { player.hp = 0; gameOver(); }
}

function applyPoison(e, dps, dur) {
  e.poisonDps = Math.max(e.poisonDps, dps);
  e.poisonT   = Math.max(e.poisonT, dur);
}

function spawnBoss(type, index = 0, total = 1) {
  const x = canvas.width / 2 + (index - (total - 1) / 2) * 140;
  const e = makeEnemy(type, x, PLAY.top + 60);
  enemies.push(e);
  spawnParticles(e.x, e.y, '#e74c3c', 30);
}

function updateEnemies(dt) {
  const factor = dt / 16.67;
  for (const e of enemies) {
    if (e.dead) continue;
    if (e.hitFlash > 0) e.hitFlash -= dt;
    const startX = e.x, startY = e.y; // to tell idle from running this frame

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

    // poison ticks true damage; slow drags the chase
    if (e.poisonT > 0) {
      e.poisonT -= dt;
      e.hp -= e.poisonDps * dt / 1000;
      if (Math.random() < dt * 0.008) spawnParticles(e.x, e.y, '#2ecc71', 2);
      if (e.hp <= 0) { killEnemy(e); continue; }
    }
    if (e.slowT > 0) e.slowT -= dt;
    const slowMult = e.slowT > 0 ? 0.6 : 1;

    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // exploder: arm the fuse near the player, then detonate
    if (e.exploder) {
      if (!e.fusing && dist < e.exploder.triggerDist) {
        e.fusing = true;
        e.fuseT  = e.exploder.fuse;
      }
      if (e.fusing) {
        e.fuseT -= dt;
        if (e.fuseT <= 0) { selfDetonate(e); continue; }
      }
    }

    // shooter: hold mid range and cast; everyone else chases
    let move = 1; // toward player
    if (e.shooter) {
      if (dist < e.shooter.range * 0.6)      move = -0.7; // back away
      else if (dist < e.shooter.range)       move = 0;    // hold and cast
      e.shootT += dt;
      if (e.shootT >= e.shooter.interval && dist < e.shooter.range * 1.3) {
        e.shootT = 0;
        const a = Math.atan2(dy, dx);
        enemyBullets.push({
          x: e.x, y: e.y,
          vx: Math.cos(a) * e.shooter.bulletSpeed,
          vy: Math.sin(a) * e.shooter.bulletSpeed,
          dmg: e.shooter.dmg,
          dist: 0,
          dead: false,
        });
        Sfx.play('eshoot');
        spawnParticles(e.x, e.y, '#9b59b6', 4);
      }
    }

    const bossBusy = e.boss ? updateBossPattern(e, dt, dx, dy, dist, factor) : false;

    if (!bossBusy && dist > 1 && move !== 0) {
      e.x += (dx / dist) * e.speed * slowMult * move * factor;
      e.y += (dy / dist) * e.speed * slowMult * move * factor;
    }
    if (!e.boss) resolveObstacles(e, Math.max(e.w, e.h) * 0.35);
    // did it actually move? drives the idle/run animation
    e.moving = Math.hypot(e.x - startX, e.y - startY) > 0.06;

    // spike traps hurt monsters too — lure them in
    if (e.trapT > 0) e.trapT -= dt;
    for (const tr of traps) {
      if (e.trapT <= 0 && trapDangerous(tr) &&
          Math.hypot(e.x - tr.x, e.y - tr.y) < 18 + Math.max(e.w, e.h) / 4) {
        e.trapT = 500;
        e.hp -= 15;
        e.hitFlash = 150;
        addFloatText(e.x, e.y - e.h / 2 - 8, 15, '#e8dcc8');
        if (e.hp <= 0) { killEnemy(e); break; }
      }
    }
    if (e.dead) continue;

    // hit player (dodge avoids it entirely; armor reduces it)
    // exploders skip contact damage — their threat is the blast, and contact
    // i-frames would otherwise swallow the explosion
    if (!e.exploder && rectCircle(e.x, e.y, e.w, e.h, player.x, player.y, 10)) {
      damagePlayer(e.bossState === 'charging' ? Math.round(e.dmg * 1.5) : e.dmg);
      if (gameState !== 'playing') return;
    }
  }
  enemies = enemies.filter(e => !e.dead);
}

function killEnemy(e) {
  e.dead = true;
  score += e.score;
  runKills++;
  gainXp(e.score); // xp mirrors score value
  Sfx.play(e.boss ? 'explosion' : 'death');
  if (e.boss) {
    addShake(14, 500);
    Save.data.progress.bossKills++;
    Save.persist();
    if (e.type === 'zombie_king') tryUnlock('priestess');
  }
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
    if (dist < 14) {
      c.dead = true;
      const doubled = Math.random() < forgeLevel('golden') * 0.1 ? 2 : 1;
      gold          += doubled;
      runGoldEarned += doubled;
      spawnParticles(c.x, c.y, '#ffd700', 4);
      Sfx.play('coin');
    }
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
  if (!waveHasBoss && waveTimer >= WAVE_DURATION) {
    for (const e of enemies) {
      if (!e.dead) spawnParticles(e.x, e.y, '#9b59b6', 6); // vanish, no loot
    }
    enemies = [];
    spawnQueue.forEach(s => s.spawned = true);
  }

  const allSpawned = spawnQueue.every(s => s.spawned);
  if (allSpawned && enemies.length === 0) {
    waveActive = false;
    if (gameMode === 'campaign' && wave >= WAVES_TOTAL) {
      setTimeout(victory, 1200);
      return;
    }
    Sfx.play('waveclear');
    announceWave(`WAVE ${wave} CLEAR!`);
    // weapon upgrade drop every 2 waves until max tier
    if (wave % 2 === 0 && player.tier < player.def.tiers.length - 1) {
      spawnUpgrade();
    }
    setTimeout(openShop, 1500);
  }
}

function victory() {
  if (gameState === 'levelup') { pendingAfterLevelUp = 'victory'; return; }
  if (gameState !== 'playing') return;
  gameState = 'victory';
  Sfx.stopMusic();
  Sfx.play('victory');
  hud.classList.add('hidden');
  const forged = Math.round(runGoldEarned * FORGE_RATE);
  Save.data.progress.soulGold += forged;
  const newBest = Save.recordRun(player.cls,
    { score, wave, level: player.level, won: true, kills: runKills, gold: runGoldEarned, mode: gameMode });
  document.getElementById('victory-forge').textContent = '+' + forged + ' ⚒';
  refreshForgeButton();
  document.getElementById('victory-score').textContent = score;
  document.getElementById('victory-gold').textContent  = gold;
  document.getElementById('new-record-victory').classList.toggle('hidden', !newBest);
  refreshClassRecord();
  showScreen('victory');
}

