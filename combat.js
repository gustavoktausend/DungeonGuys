// combat.js — per-frame update, attacks, specials, damage pipeline, boss patterns
// ─── Update ───────────────────────────────────────────────────────────────────
function update(dt) {
  if (shakeT > 0) { shakeT -= dt; if (shakeT <= 0) shakeMag = 0; }
  if (comboTimer > 0) { comboTimer -= dt; if (comboTimer <= 0) combo = 0; }
  updatePlayer(dt);
  updateBullets(dt);
  updateEnemyBullets(dt);
  updateMeleeSwings(dt);
  updateEnemies(dt);
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

  if (dx !== 0 || dy !== 0) {
    const len = Math.sqrt(dx*dx + dy*dy);
    dx /= len; dy /= len;
  } else if (Math.abs(touchVec.x) > 0.12 || Math.abs(touchVec.y) > 0.12) {
    dx = touchVec.x; // analog: keeps the joystick's partial magnitude
    dy = touchVec.y;
  }

  p.moving = (dx !== 0 || dy !== 0);
  if (p.moving) {
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
  resolveObstacles(p, 10);

  for (const tr of traps) {
    if (trapDangerous(tr) && Math.hypot(p.x - tr.x, p.y - tr.y) < 18) damagePlayer(10);
  }

  // face toward the current aim (mouse, or nearest enemy with auto-aim)
  p.facing = aimAngle();

  // auto-fire on hold (mouse or keys); touch always auto-attacks when enemies exist
  if (mouseDown || keys['Space'] || keys['KeyZ'] || (touchActive && enemies.length > 0)) {
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

  Sfx.play(w.attack === 'melee' ? 'swing' : w.attack === 'arrow' ? 'arrow' : 'shoot');

  const angle = aimAngle();
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
    poison: w.poison || null,
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

  for (const o of obstacles) {
    if (o.dead || o.kind !== 'crate') continue;
    const od = Math.hypot(o.x - player.x, o.y - player.y);
    if (od <= range + o.r) {
      let diff = Math.atan2(o.y - player.y, o.x - player.x) - angle;
      while (diff >  Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) <= w.arc / 2) damageCrate(o, w.damage[1]);
    }
  }

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
  Sfx.play('special');

  const angle = aimAngle();
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

    case 'dash': {
      // shadow dash: teleport toward the aim, slicing everything on the path
      const d  = 170;
      const sx = player.x, sy = player.y;
      const tx = Math.max(PLAY.left + 12,  Math.min(PLAY.right  - 12, sx + Math.cos(angle) * d));
      const ty = Math.max(PLAY.top  + 12,  Math.min(PLAY.bottom - 12, sy + Math.sin(angle) * d));
      const hit = new Set();
      const steps = 10;
      for (let i = 0; i <= steps; i++) {
        const px2 = sx + (tx - sx) * i / steps;
        const py2 = sy + (ty - sy) * i / steps;
        spawnParticles(px2, py2, '#aab7c4', 3);
        for (const e of enemies) {
          if (e.dead || hit.has(e)) continue;
          const ex = e.x - px2, ey = e.y - py2;
          if (Math.sqrt(ex * ex + ey * ey) < 30 + Math.max(e.w, e.h) / 2) {
            hit.add(e);
            dealDamage(e, [50, 70], 'melee');
          }
        }
      }
      player.x = tx;
      player.y = ty;
      player.invincible = 600;
      break;
    }

    case 'nova':
      // holy nova: full-circle smite around the priestess + self heal
      meleeAttack(angle, { range: 130, arc: Math.PI * 2, damage: [60, 90], knockback: 20 });
      player.hp = Math.min(player.maxHp, player.hp + 30);
      addFloatText(player.x, player.y - 34, '+30 HP', '#ffd700');
      spawnParticles(player.x, player.y, '#ffd700', 24);
      break;

    case 'emp': {
      // EMP blast: shockwave damages and slows everything nearby
      addShake(8, 300);
      spawnParticles(player.x, player.y, '#66ccff', 28);
      meleeSwings.push({ angle: 0, life: 1, range: 150, arc: Math.PI * 2 }); // ring visual
      for (const e of enemies) {
        if (e.dead) continue;
        const dx2 = e.x - player.x, dy2 = e.y - player.y;
        if (Math.sqrt(dx2 * dx2 + dy2 * dy2) <= 150 + Math.max(e.w, e.h) / 2) {
          dealDamage(e, [40, 60], 'bullet');
          if (!e.dead) e.slowT = Math.max(e.slowT, 3000);
        }
      }
      break;
    }

    case 'hex':
      // hex: every living enemy is poisoned and slowed
      for (const e of enemies) {
        if (e.dead) continue;
        applyPoison(e, 15, 4000);
        e.slowT = Math.max(e.slowT, 4000);
        spawnParticles(e.x, e.y, '#9b59b6', 5);
      }
      addFloatText(player.x, player.y - 34, 'HEX!', '#9b59b6');
      break;
  }
}

function explode(b) {
  Sfx.play('explosion');
  addShake(7, 280);
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
       : (kind === 'arrow' || kind === 'bullet') ? st.rangedDmg
       : st.elementalDmg; // bolt / fireball
  dmg = Math.max(1, Math.round(dmg * (1 + st.dmgPct / 100)));

  if (Math.random() < st.crit / 100) {
    dmg *= 2;
    addFloatText(e.x, e.y - e.h / 2 - 12, dmg + '!', '#f1c40f');
  } else {
    // every hit shows its number, slightly scattered so stacks stay readable
    addFloatText(e.x + (Math.random() - 0.5) * 14, e.y - e.h / 2 - 8, dmg, '#e8dcc8');
  }

  e.hp -= dmg;
  e.hitFlash = 150;
  Sfx.play('hit');
  spawnParticles(fx !== undefined ? fx : e.x, fy !== undefined ? fy : e.y, '#ff4444', 6);

  if (Math.random() < st.lifeSteal / 100 && player.hp < player.maxHp) {
    player.hp = Math.min(player.maxHp, player.hp + 1);
  }

  // elemental procs: burn scales with the weapon's hit, chill briefly slows
  if (st.burn > 0 && Math.random() < st.burn / 100) {
    applyBurn(e, Math.max(6, Math.round(player.weapon.damage[0] * 0.15)), 3000);
  }
  if (st.chill > 0 && Math.random() < st.chill / 100) {
    e.slowT = Math.max(e.slowT, 1500);
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

    let blocked = false;
    for (const o of obstacles) {
      if (o.dead) continue;
      if (Math.hypot(b.x - o.x, b.y - o.y) < o.r + 4) {
        if (o.kind === 'crate') damageCrate(o, (b.damage[0] + b.damage[1]) / 2);
        b.dead = true;
        if (b.type === 'fireball') explode(b);
        else spawnParticles(b.x, b.y, '#aab7c4', 4);
        blocked = true;
        break;
      }
    }
    if (blocked) continue;

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
        if (b.poison && !e.dead) applyPoison(e, b.poison.dps, b.poison.dur);
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

// ─── Boss attack patterns ─────────────────────────────────────────────────────
// returns true while the pattern controls the boss's movement
function updateBossPattern(e, dt, dx, dy, dist, factor) {
  if (!e.abilities) return false;

  // enrage below 30% HP: faster, angrier, shorter cooldowns
  if (!e.enraged && e.hp < e.maxHp * 0.3) {
    e.enraged = true;
    e.speed *= 1.35;
    addFloatText(e.x, e.y - e.h / 2 - 16, 'ENRAGED!', '#e74c3c');
    Sfx.play('mimic');
    spawnParticles(e.x, e.y, '#e74c3c', 18);
  }
  const cdMult = e.enraged ? 0.6 : 1;

  if (e.bossState === 'telegraph') {
    e.stateT -= dt;
    if (e.stateT <= 0) {
      e.bossState = 'charging';
      e.stateT = 520;
      Sfx.play('special');
    }
    return true; // planted, winding up
  }

  if (e.bossState === 'charging') {
    e.stateT -= dt;
    const sp = e.speed * 7;
    e.x += e.chargeDir.x * sp * factor;
    e.y += e.chargeDir.y * sp * factor;
    // slamming into a wall ends the charge early
    const cx = Math.max(PLAY.left + 24, Math.min(PLAY.right  - 24, e.x));
    const cy = Math.max(PLAY.top  + 24, Math.min(PLAY.bottom - 24, e.y));
    if (cx !== e.x || cy !== e.y) {
      e.x = cx; e.y = cy;
      e.stateT = 0;
      addShake(9, 260);
      Sfx.play('explosion');
      spawnParticles(e.x, e.y, '#aab7c4', 14);
    }
    if (e.stateT <= 0) { e.bossState = 'recover'; e.stateT = 450; }
    return true;
  }

  if (e.bossState === 'recover') {
    e.stateT -= dt;
    if (e.stateT <= 0) e.bossState = 'chase';
    return true;
  }

  // chasing: tick cooldowns and maybe start an ability
  for (const k of Object.keys(e.abilities)) e.cd[k] = (e.cd[k] || 0) + dt;

  if (e.abilities.ring && e.cd.ring >= e.abilities.ring * cdMult && dist < 420) {
    e.cd.ring = 0;
    const n = e.enraged ? 16 : 12;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      enemyBullets.push({
        x: e.x, y: e.y,
        vx: Math.cos(a) * 3.8, vy: Math.sin(a) * 3.8,
        dmg: 12, dist: 0, dead: false,
      });
    }
    Sfx.play('eshoot');
    spawnParticles(e.x, e.y, '#9b59b6', 16);
    return false;
  }

  if (e.abilities.charge && e.cd.charge >= e.abilities.charge * cdMult && dist > 120 && dist < 520) {
    e.cd.charge   = 0;
    e.bossState   = 'telegraph';
    e.stateT      = 650;
    e.chargeDir   = { x: dx / dist, y: dy / dist }; // locked now — sidestep it!
    Sfx.play('mimic');
    return true;
  }
  return false;
}

// Enemy projectiles (necromancer bolts)
function updateEnemyBullets(dt) {
  const factor = dt / 16.67;
  for (const b of enemyBullets) {
    if (b.dead) continue;
    b.x    += b.vx * factor;
    b.y    += b.vy * factor;
    b.dist += Math.sqrt(b.vx * b.vx + b.vy * b.vy) * factor;

    if (b.dist > 600 ||
        b.x < PLAY.left || b.x > PLAY.right ||
        b.y < PLAY.top  || b.y > PLAY.bottom) {
      b.dead = true;
      continue;
    }
    if (obstacles.some(o => !o.dead && Math.hypot(b.x - o.x, b.y - o.y) < o.r + 4)) {
      b.dead = true;
      spawnParticles(b.x, b.y, '#9b59b6', 4);
      continue;
    }
    const dx = b.x - player.x, dy = b.y - player.y;
    if (Math.sqrt(dx * dx + dy * dy) < 12) {
      b.dead = true;
      spawnParticles(b.x, b.y, '#9b59b6', 6);
      damagePlayer(b.dmg);
    }
  }
  enemyBullets = enemyBullets.filter(b => !b.dead);
}

