// items.js — shop flow, potions, chests, floating text
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

// places a bought item into its slot, syncs the active weapon, recalculates stats
function equipItem(item) {
  player.equipment = equipInto(player.equipment, item);
  // catalog weapons nest their combat params under .weapon; player.weapon must
  // stay flat (same shape as CLASS_DEFS tiers) for combat/render/archetype
  if (item.slot === 'weapon') player.weapon = { ...item.weapon, name: item.name };
  recalcStats();
}

function rollOffers() {
  // consumables (ITEM_POOL), filtered by the player's damage kind
  const kind = playerDmgKind();
  const cPool = ITEM_POOL.filter(it => !it.dmgKind || it.dmgKind === kind);
  shopOffers = [...cPool].sort(() => Math.random() - 0.5).slice(0, 4)
    .map(it => ({ item: it, sold: false }));

  // equipment (EQUIPMENT), filtered by class/archetype eligibility
  const arch = playerArchetype();
  const ePool = EQUIPMENT.filter(it => isEligible(it, player.cls, arch));
  shopEquipOffers = [...ePool].sort(() => Math.random() - 0.5).slice(0, 4)
    .map(it => ({ item: it, sold: false }));
}

// permanent stat changes (blessings, shop consumables) feed the permanent layer;
// recalcStats() then re-derives the effective player.stats / player.maxHp.
function applyMods(mods) {
  let heal = 0;
  for (const [k, v] of Object.entries(mods)) {
    if (k === 'maxHp') {
      player.permMaxHp = Math.max(30, player.permMaxHp + v);
      if (v > 0) heal += v; // gaining permanent max HP also heals that much
    } else {
      player.permStats[k] = (player.permStats[k] || 0) + v;
    }
  }
  recalcStats();
  if (heal) player.hp = Math.min(player.maxHp, player.hp + heal);
}

function fmtMod(k, v) {
  const sign = v > 0 ? '+' : '';
  return `${sign}${v}${PCT_STATS.has(k) ? '%' : ''} ${STAT_LABELS[k]}`;
}

function renderShop() {
  document.getElementById('shop-gold').textContent = gold;

  // equipped-set panel (8 slots)
  const slotLabels = { weapon: 'WEAPON', offhand: 'OFF-HAND', helm: 'HELM', armor: 'ARMOR',
                       boots: 'BOOTS', ring1: 'RING', ring2: 'RING', amulet: 'AMULET' };
  const slotIcons  = { weapon: '⚔', offhand: '🛡', helm: '⛑', armor: '🦺',
                       boots: '👢', ring1: '💍', ring2: '💍', amulet: '📿' };
  document.getElementById('shop-slots').innerHTML = EQUIP_SLOTS.map(s => {
    const it  = player.equipment[s];
    const ico = it ? (it.icon || slotIcons[s]) : slotIcons[s];
    return `<div class="slot-chip ${it ? 'filled' : 'empty'}" title="${slotLabels[s]}">
        <span class="slot-ico">${ico}</span>
        <span class="slot-lbl">${it ? it.name : slotLabels[s]}</span>
      </div>`;
  }).join('');

  // equipment offers (with comparison)
  document.getElementById('shop-equip').innerHTML = shopEquipOffers.map((o, i) => {
    if (o.sold) return `<div class="shop-item offer sold"><span class="shop-name">SOLD</span></div>`;
    const price   = itemPrice(o.item);
    const blocked = !canEquip(o.item, player.equipment);
    const dis     = gold < price || blocked;
    return `
      <button class="shop-item offer equip" data-i="${i}" ${dis ? 'disabled' : ''}>
        <span class="shop-icon">${o.item.icon}</span>
        <span class="shop-name">${o.item.name}</span>
        <span class="shop-effects">${equipDelta(o.item)}</span>
        ${blocked ? '<span class="cmp-down">NEEDS 1-HAND</span>' : ''}
        <span class="shop-price">${price}</span>
      </button>`;
  }).join('');

  // consumable offers (unchanged behavior)
  document.getElementById('shop-items').innerHTML = shopOffers.map((o, i) => {
    if (o.sold) return `<div class="shop-item offer sold"><span class="shop-name">SOLD</span></div>`;
    const price = itemPrice(o.item);
    const fx = Object.entries(o.item.mods)
      .map(([k, v]) => `<span class="${v > 0 ? 'fx-pos' : 'fx-neg'}">${fmtMod(k, v)}</span>`).join('');
    return `
      <button class="shop-item offer" data-i="${i}" ${gold < price ? 'disabled' : ''}>
        <span class="shop-icon">${o.item.icon}</span>
        <span class="shop-name">${o.item.name}</span>
        <span class="shop-effects">${fx}</span>
        <span class="shop-price">${price}</span>
      </button>`;
  }).join('');

  // heal / reroll
  document.getElementById('price-heal').textContent   = HEAL_PRICE;
  document.getElementById('price-reroll').textContent = rerollCost;
  document.getElementById('btn-shop-heal').disabled   = gold < HEAL_PRICE || player.hp >= player.maxHp;
  document.getElementById('btn-shop-reroll').disabled = gold < rerollCost;

  // stats panel (only non-zero stats)
  const st = player.stats;
  const rows = [['MAX HP', player.maxHp], ['HP', Math.ceil(player.hp)]]
    .concat(Object.keys(st).filter(k => st[k] !== 0).map(k => [
      STAT_LABELS[k], (st[k] > 0 ? '+' : '') + st[k] + (PCT_STATS.has(k) ? '%' : ''),
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

// short comparison string vs. the item currently in the target slot.
// shows stat-mod deltas; for weapons also the average-damage delta.
function equipDelta(item) {
  const slot = targetSlot(item, player.equipment);
  const cur  = player.equipment[slot];
  const parts = [];
  // mod deltas (union of both items' mod keys)
  const keys = new Set([...Object.keys(item.mods ?? {}), ...Object.keys(cur?.mods ?? {})]);
  for (const k of keys) {
    const d = (item.mods?.[k] ?? 0) - (cur?.mods?.[k] ?? 0);
    if (d === 0) continue;
    const sign = d > 0 ? '+' : '';
    parts.push(`<span class="${d > 0 ? 'cmp-up' : 'cmp-down'}">${sign}${d}${PCT_STATS.has(k) ? '%' : ''} ${STAT_LABELS[k] || k}</span>`);
  }
  // weapon average-damage delta
  if (item.weapon) {
    const avg = w => w ? (w.damage[0] + w.damage[1]) / 2 : 0;
    // the starting weapon is a flat tier (params at top level); catalog weapons nest them under .weapon
    const curWeapon = cur && (cur.weapon || (Array.isArray(cur.damage) ? cur : null));
    const d = Math.round(avg(item.weapon) - avg(curWeapon));
    if (d !== 0) {
      const sign = d > 0 ? '+' : '';
      parts.push(`<span class="${d > 0 ? 'cmp-up' : 'cmp-down'}">${sign}${d} DMG</span>`);
    }
  }
  return parts.length ? parts.join('') : '<span class="cmp-same">— no change —</span>';
}

function buyEquipOffer(i) {
  const o = shopEquipOffers[i];
  if (!o || o.sold) return;
  if (!canEquip(o.item, player.equipment)) return; // shield vs 2H
  const price = itemPrice(o.item);
  if (gold < price) return;
  gold -= price;
  o.sold = true;
  equipItem(o.item);
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

  // mirror the special cooldown onto the mobile button (radial sweep + glow)
  const touchSp = document.getElementById('btn-touch-special');
  touchSp.style.setProperty('--cd', (100 - spPct).toFixed(0));
  touchSp.classList.toggle('ready', spPct >= 100);

  const staPct = player.stamina / maxStamina() * 100;
  stBar.style.width = staPct + '%';
  stBar.classList.toggle('recovering', !player.sprinting && staPct < 100);

  document.getElementById('hud-name').textContent = player.name + ' · LV ' + player.level;
  document.getElementById('xp-bar').style.width = (player.xp / player.xpNext * 100) + '%';

  // kill-streak combo indicator (only once it actually multiplies score)
  const comboEl = document.getElementById('combo-display');
  const mult = comboMult();
  if (combo >= 5 && comboTimer > 0) {
    comboEl.classList.remove('hidden');
    comboEl.textContent = '×' + mult.toFixed(2).replace(/\.?0+$/, '') + ' COMBO';
  } else {
    comboEl.classList.add('hidden');
  }

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

