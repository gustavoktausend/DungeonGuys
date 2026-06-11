// items.js — shop flow, potions, chests, floating text, weapon upgrade drops
// ─── Shop flow ────────────────────────────────────────────────────────────────
function openShop() {
  if (gameState === 'levelup') { pendingAfterLevelUp = 'shop'; return; }
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
  const atk  = player.weapon.attack; // 'melee' | 'arrow' | 'bolt'
  const kind = atk === 'melee' ? 'melee' : atk === 'arrow' ? 'arrow' : 'elemental';
  const pool = ITEM_POOL.filter(it => !it.dmgKind || it.dmgKind === kind);
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
  Sfx.play('buy');
  updateHUD();
  renderShop();
}

function shopHeal() {
  if (gold < HEAL_PRICE || player.hp >= player.maxHp) return;
  gold -= HEAL_PRICE;
  player.hp = Math.min(player.maxHp, player.hp + 30);
  Sfx.play('potion');
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
      Sfx.play('potion');
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
  Sfx.play('chest');
  const roll = Math.random();

  if (roll < 0.15) {
    // mimic! it was never a chest at all
    ch.dead = true;
    chests = chests.filter(c => c !== ch);
    spawnParticles(ch.x, ch.y, '#9b59b6', 14);
    addFloatText(ch.x, ch.y - 24, 'MIMIC!', '#e74c3c');
    Sfx.play('mimic');
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
      Sfx.play('upgrade');
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
  else if (waveHasBoss)       timerEl.textContent = '☠';
  else timerEl.textContent = Math.max(0, Math.ceil((WAVE_DURATION - waveTimer) / 1000));

  // boss HP bar (top center) — aggregates when several bosses are alive
  const bosses  = enemies.filter(e => e.boss && !e.dead);
  const bossBar = document.getElementById('boss-bar');
  if (bosses.length > 0) {
    bossBar.classList.remove('hidden');
    document.getElementById('boss-name').textContent =
      bosses.length === 1 ? bosses[0].boss : bosses.length + ' BOSSES';
    const hp    = bosses.reduce((s, b) => s + Math.max(0, b.hp), 0);
    const maxHp = bosses.reduce((s, b) => s + b.maxHp, 0);
    document.getElementById('boss-hp').style.width = (hp / maxHp * 100) + '%';
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

