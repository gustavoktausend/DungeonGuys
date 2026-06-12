// render.js — canvas rendering: tiles, entities, effects, HUD canvas layers
// ─── Render ───────────────────────────────────────────────────────────────────
function render() {
  animTick = Math.floor(performance.now() / 140) % 4;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  if (shakeT > 0) {
    const f = shakeT / 220; // fades out
    ctx.translate((Math.random() - 0.5) * shakeMag * f, (Math.random() - 0.5) * shakeMag * f);
  }
  drawTiles();
  drawTorches();
  drawTraps();
  drawChests();
  drawCoins();
  drawPotions();
  drawUpgrades();
  drawBullets();
  drawEnemyBullets();
  drawMeleeSwings();
  drawBossTelegraphs();
  drawObstacles();
  drawEnemies();
  drawPlayer();
  drawParticles();
  drawFloatTexts();
  ctx.restore(); // shake transform
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
    } else if (b.type === 'bullet') {
      // energy tracer
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.angle);
      ctx.shadowColor = '#66ccff';
      ctx.shadowBlur  = 8;
      ctx.fillStyle   = '#aef';
      ctx.fillRect(-7, -1.5, 14, 3);
      ctx.fillStyle = '#fff';
      ctx.fillRect(2, -1, 5, 2);
      ctx.shadowBlur = 0;
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

// Arena obstacles & traps
function drawObstacles() {
  for (const o of obstacles) {
    if (o.dead) continue;
    const [sx, sy, sw, sh] = OBSTACLE_SPRITES[o.kind];
    // bottom-anchored: sprite bottom sits at the collision circle's south edge
    drawSprite([sx, sy, sw, sh], o.x, o.y + o.r - sh, false);
  }
}

function drawTraps() {
  for (const tr of traps) {
    drawSprite(SPIKE_FRAMES[trapFrameAt(tr)], tr.x, tr.y, false);
  }
}

// charge telegraph: red warning lane in front of the boss
function drawBossTelegraphs() {
  for (const e of enemies) {
    if (e.dead || e.bossState !== 'telegraph') continue;
    const len   = 360;
    const pulse = 0.18 + Math.abs(Math.sin(performance.now() / 90)) * 0.16;
    ctx.save();
    ctx.strokeStyle = `rgba(231, 76, 60, ${pulse})`;
    ctx.lineWidth   = e.w * 0.9;
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.moveTo(e.x, e.y);
    ctx.lineTo(e.x + e.chargeDir.x * len, e.y + e.chargeDir.y * len);
    ctx.stroke();
    ctx.restore();
  }
}

// Enemy projectiles: dark pulsing orbs
function drawEnemyBullets() {
  for (const b of enemyBullets) {
    ctx.shadowColor = '#9b59b6';
    ctx.shadowBlur  = 10;
    ctx.fillStyle   = '#6c3483';
    ctx.beginPath();
    ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d2a0e8';
    ctx.beginPath();
    ctx.arc(b.x, b.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
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

    if (WEAPON_SPRITES[nextTier.sprite]) {
      drawSprite(WEAPON_SPRITES[nextTier.sprite], u.x, u.y + bobY, false);
    } else {
      // techy upgrade chip for spriteless weapons
      ctx.shadowColor = '#66ccff';
      ctx.shadowBlur  = 10;
      ctx.fillStyle   = '#1a3a5c';
      ctx.fillRect(u.x - 8, u.y + bobY - 8, 16, 16);
      ctx.fillStyle = '#66ccff';
      ctx.fillRect(u.x - 4, u.y + bobY - 4, 8, 8);
      ctx.shadowBlur = 0;
    }
  }
}

// Enemies
function drawEnemies() {
  for (const e of enemies) {
    if (e.dead) continue;

    const frame = ANIMS[e.anim].run[animTick];
    const flip  = player.x < e.x; // face the player

    if (e.hitFlash > 0) ctx.filter = 'brightness(2.5) saturate(40%)';
    else if (e.enraged) {
      ctx.filter = `saturate(2.2) hue-rotate(-25deg) brightness(${(1.15 + Math.sin(performance.now() / 90) * 0.15).toFixed(2)})`;
    }
    else if (e.fusing) {
      // exploder about to blow: accelerating red strobe
      const strobe = Math.sin(performance.now() / Math.max(20, e.fuseT / 8)) > 0;
      if (strobe) ctx.filter = 'brightness(2.2) sepia(1) saturate(6) hue-rotate(-50deg)';
    }
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
  if (!p.weapon.sprite) return; // gun classes carry the weapon in the sprite itself
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
