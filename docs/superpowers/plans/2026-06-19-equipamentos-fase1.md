# Equipamentos — Fase 1 (Fundação) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir a fundação interna do sistema de equipamentos (slots no `player`, camada de stats efetivos, arma inicial por classe) e remover o antigo drop de tier, sem introduzir UI nem catálogo de itens.

**Architecture:** Um novo módulo puro `equipment.js` (sem DOM/canvas, testável em Node) define os 8 slots e o cálculo de stats. O `player` ganha `equipment` (slots), `permStats` e `permMaxHp` (camada permanente: base + forge + blessings + consumíveis). `recalcStats()` deriva `player.stats`/`player.maxHp` = camada permanente + soma dos mods do que está equipado. Combate e render seguem lendo `player.weapon` e `player.stats` sem alteração.

**Tech Stack:** HTML5 canvas, JavaScript vanilla (scripts globais, sem bundler/build), Node.js (apenas para `node --check` e testes do módulo puro), Playwright MCP + `python -m http.server` para verificação de integração no navegador.

## Global Constraints

- **Sem novas dependências, sem build step.** JS vanilla puro; scripts carregados por `<script>` em `index.html`, compartilhando escopo global (sem `import`/`export` no navegador).
- **`equipment.js` deve rodar tanto no navegador (global) quanto em Node** (para teste). Use o guard UMD no final: `if (typeof module !== 'undefined' && module.exports) module.exports = { ... }`.
- **Comentários de código em inglês** (seguir o estilo dos arquivos existentes).
- **Por-run:** nada deste sistema é persistido em `Save`/localStorage.
- **Sem regressão:** ao iniciar um jogo novo, `player.stats` e `player.maxHp` devem ficar idênticos ao baseline atual; blessings (level-up), consumíveis da loja, perks do Forge e o ganho de HP por nível devem continuar funcionando exatamente como antes.
- **Branch:** trabalhar em `feature/equipamentos` (já criada). Todo commit termina com a linha `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Não há test runner configurado.** Verificação =
  - `node --check <arquivo>` para sintaxe de cada `.js` modificado;
  - `node tests/equipment.test.js` para o módulo puro;
  - **Integração no navegador** via Playwright MCP: em um terminal, suba `python -m http.server 8080` no diretório do projeto; depois use `browser_navigate` → `http://localhost:8080/index.html` e `browser_evaluate` com o snippet indicado, conferindo o retorno. As funções do jogo (`startGame`, `applyMods`, `recalcStats`, `gainXp`, etc.) são globais e podem ser chamadas direto no `browser_evaluate`.

> **Nota de faseamento (intencional):** A Task 2 remove o drop de upgrade de arma a cada 2 waves. Durante a Fase 1 (antes da Fase 2, que adiciona armas na loja) a arma fica fixa na inicial da classe durante toda a run — isso é esperado para a fundação; a progressão de arma volta na Fase 2 via loja. Se preferir manter a progressão de arma intacta até a Fase 2, pule a Task 2 e remova o drop apenas na Fase 2 (não recomendado: deixa código morto referenciando `player.tier`, que a Task 3 elimina).

## File Structure

- **Create `equipment.js`** — módulo puro: `EQUIP_SLOTS`, `emptyEquipment()`, `sumEquipmentMods()`, `computeEffectiveStats()`, `effectiveMaxHp()`. Sem DOM. Uma única responsabilidade: representar slots e derivar stats.
- **Create `tests/equipment.test.js`** — testes Node (`assert`) do módulo puro.
- **Modify `index.html`** — incluir `equipment.js` antes de `ui.js`.
- **Modify `ui.js`** — `recalcStats()` e `startWeapon()`; remover `upgrades` da lista de globais (Task 2).
- **Modify `items.js`** — `applyMods` passa a alimentar a camada permanente; remover `spawnUpgrade`/`updateUpgrades` (Task 2).
- **Modify `entities.js`** — `gainXp` (HP de nível → camada permanente); remover o gatilho de drop em `checkWaveComplete` (Task 2).
- **Modify `engine.js`** — `startGame` inicializa `equipment`/`permStats`/`permMaxHp`, arma inicial e `recalcStats`; remover `upgrades = []` e `tier: 0` (Task 2/3).
- **Modify `combat.js`** — remover a chamada `updateUpgrades(dt)` (Task 2).
- **Modify `render.js`** — remover `drawUpgrades()` e sua chamada (Task 2).

---

## Task 1: Módulo puro `equipment.js` + testes Node

**Files:**
- Create: `equipment.js`
- Create: `tests/equipment.test.js`

**Interfaces:**
- Consumes: nada.
- Produces (globais no navegador; exportados via `module.exports` em Node):
  - `EQUIP_SLOTS: string[]` — `['weapon','offhand','helm','armor','boots','ring1','ring2','amulet']`
  - `emptyEquipment(): Record<slot, null>`
  - `sumEquipmentMods(equipment): Record<string, number>` — soma `item.mods` de todos os slots ocupados (inclui `maxHp`)
  - `computeEffectiveStats(permStats, equipment): object` — `{...permStats}` + mods (exceto `maxHp`); não muta `permStats`
  - `effectiveMaxHp(permMaxHp, equipment): number` — `permMaxHp` + `mods.maxHp`, com piso de 30

- [ ] **Step 1: Escrever o teste que falha**

Create `tests/equipment.test.js`:

```js
// node tests/equipment.test.js — pure-module checks (no browser needed)
const assert = require('assert');
const eq = require('../equipment.js');

// EQUIP_SLOTS
assert.strictEqual(eq.EQUIP_SLOTS.length, 8, 'should have 8 slots');
assert.ok(eq.EQUIP_SLOTS.includes('weapon') && eq.EQUIP_SLOTS.includes('amulet'));
assert.ok(eq.EQUIP_SLOTS.includes('ring1') && eq.EQUIP_SLOTS.includes('ring2'));

// emptyEquipment
const empty = eq.emptyEquipment();
assert.deepStrictEqual(Object.keys(empty).sort(), [...eq.EQUIP_SLOTS].sort());
assert.ok(eq.EQUIP_SLOTS.every(s => empty[s] === null), 'all slots null');

// sumEquipmentMods
const gear = eq.emptyEquipment();
gear.helm  = { mods: { armor: 2, dmgPct: 5 } };
gear.ring1 = { mods: { dmgPct: 3, maxHp: 20 } };
gear.boots = { /* no mods */ };
const sum = eq.sumEquipmentMods(gear);
assert.strictEqual(sum.armor, 2);
assert.strictEqual(sum.dmgPct, 8);
assert.strictEqual(sum.maxHp, 20);

// computeEffectiveStats (maxHp excluded; permStats untouched)
const perm = { dmgPct: 10, armor: 0, crit: 0 };
const stats = eq.computeEffectiveStats(perm, gear);
assert.strictEqual(stats.dmgPct, 18, 'perm 10 + equip 8');
assert.strictEqual(stats.armor, 2);
assert.strictEqual(stats.maxHp, undefined, 'maxHp must not leak into stats');
assert.strictEqual(perm.dmgPct, 10, 'permStats must not be mutated');

// effectiveMaxHp
assert.strictEqual(eq.effectiveMaxHp(100, gear), 120);
assert.strictEqual(eq.effectiveMaxHp(100, eq.emptyEquipment()), 100);
assert.strictEqual(eq.effectiveMaxHp(5, eq.emptyEquipment()), 30, 'floored at 30');

console.log('equipment.js: all tests passed');
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `node tests/equipment.test.js`
Expected: FAIL — `Cannot find module '../equipment.js'`.

- [ ] **Step 3: Implementar `equipment.js`**

Create `equipment.js`:

```js
// equipment.js — pure equipment/stat helpers (no DOM/canvas; usable in Node).
// Per-run gear lives in player.equipment; the effective stats the combat code
// reads are derived from a permanent layer plus the mods of whatever is equipped.

// the eight equipment slots; a two-handed weapon occupies 'weapon' and blocks 'offhand'
const EQUIP_SLOTS = ['weapon', 'offhand', 'helm', 'armor', 'boots', 'ring1', 'ring2', 'amulet'];

// a fresh, fully-empty equipment record
function emptyEquipment() {
  const eq = {};
  for (const s of EQUIP_SLOTS) eq[s] = null;
  return eq;
}

// total stat mods contributed by every equipped item (includes maxHp)
function sumEquipmentMods(equipment) {
  const total = {};
  for (const s of EQUIP_SLOTS) {
    const item = equipment[s];
    if (!item || !item.mods) continue;
    for (const [k, v] of Object.entries(item.mods)) {
      total[k] = (total[k] || 0) + v;
    }
  }
  return total;
}

// permStats + equipment mods (maxHp is handled separately by effectiveMaxHp)
function computeEffectiveStats(permStats, equipment) {
  const stats = { ...permStats };
  const mods = sumEquipmentMods(equipment);
  for (const [k, v] of Object.entries(mods)) {
    if (k === 'maxHp') continue;
    stats[k] = (stats[k] || 0) + v;
  }
  return stats;
}

// permanent max HP plus any maxHp mods from equipment (never below 30)
function effectiveMaxHp(permMaxHp, equipment) {
  const bonus = sumEquipmentMods(equipment).maxHp || 0;
  return Math.max(30, permMaxHp + bonus);
}

// expose for Node tests; harmless in the browser (no `module` global there)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { EQUIP_SLOTS, emptyEquipment, sumEquipmentMods, computeEffectiveStats, effectiveMaxHp };
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `node tests/equipment.test.js`
Expected: PASS — imprime `equipment.js: all tests passed`.
Também rodar: `node --check equipment.js` → sem saída (ok).

- [ ] **Step 5: Commit**

```bash
git add equipment.js tests/equipment.test.js
git commit -m "feat(equip): pure equipment module (slots + stat derivation)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Remover o sistema de drop de tier

**Files:**
- Modify: `entities.js` (gatilho em `checkWaveComplete`)
- Modify: `items.js` (`spawnUpgrade`, `updateUpgrades`)
- Modify: `combat.js` (chamada `updateUpgrades`)
- Modify: `render.js` (`drawUpgrades` + chamada)
- Modify: `ui.js` (global `upgrades`)
- Modify: `engine.js` (`upgrades = []` e `tier: 0`)

**Interfaces:**
- Consumes: nada.
- Produces: remove `spawnUpgrade`, `updateUpgrades`, `drawUpgrades`, o array global `upgrades` e `player.tier`. Após esta task, a arma equipada não muda durante a run (fica em `cls.tiers[0]`).

- [ ] **Step 1: Escrever a verificação que falha (browser)**

Suba o servidor (terminal separado): `python -m http.server 8080`
Com o Playwright MCP: `browser_navigate` → `http://localhost:8080/index.html`, depois `browser_evaluate`:

```js
() => {
  startGame();
  // simula o fim de uma wave par com a lógica antiga ainda presente
  return {
    hasSpawnUpgrade: typeof spawnUpgrade,      // esperado depois: 'undefined'
    hasUpdateUpgrades: typeof updateUpgrades,   // esperado depois: 'undefined'
    hasDrawUpgrades: typeof drawUpgrades,       // esperado depois: 'undefined'
    playerTier: player.tier,                    // esperado depois: undefined
  };
}
```
Expected ANTES da mudança: `spawnUpgrade`/`updateUpgrades`/`drawUpgrades` = `'function'`, `playerTier` = `0`. (A verificação "passa" quando todos forem `'undefined'`/`undefined`.)

- [ ] **Step 2: Remover o gatilho em `entities.js`**

Em `entities.js`, dentro de `checkWaveComplete`, remover o bloco do drop:

Old:
```js
    Sfx.play('waveclear');
    announceWave(`WAVE ${wave} CLEAR!`);
    // weapon upgrade drop every 2 waves until max tier
    if (wave % 2 === 0 && player.tier < player.def.tiers.length - 1) {
      spawnUpgrade();
    }
    setTimeout(openShop, 1500);
```
New:
```js
    Sfx.play('waveclear');
    announceWave(`WAVE ${wave} CLEAR!`);
    setTimeout(openShop, 1500);
```

- [ ] **Step 3: Remover `spawnUpgrade` e `updateUpgrades` em `items.js`**

Em `items.js`, apagar todo o bloco (a seção "Weapon upgrades"):

Old:
```js
// ─── Weapon upgrades ──────────────────────────────────────────────────────────
function spawnUpgrade() {
  // keep the pickup inside the playable floor and clear of solid obstacles
  const m = 90;
  let x, y, attempts = 0;
  do {
    x = PLAY.left + m + Math.random() * (PLAY.right  - PLAY.left - m * 2);
    y = PLAY.top  + m + Math.random() * (PLAY.bottom - PLAY.top  - m * 2);
  } while (attempts++ < 30 &&
           obstacles.some(o => !o.dead && Math.hypot(x - o.x, y - o.y) < o.r + 28));
  upgrades.push({ x, y, bob: 0, dead: false });
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
```
New: *(remover por completo — não deixar nada no lugar)*

- [ ] **Step 4: Remover a chamada em `combat.js`**

Em `combat.js`, dentro de `update(dt)`, remover a linha:
```js
  updateUpgrades(dt);
```

- [ ] **Step 5: Remover `drawUpgrades` em `render.js`**

Em `render.js`, remover a chamada dentro de `render()`:
```js
  drawUpgrades();
```
E apagar a função inteira `drawUpgrades()` (do comentário "Weapon upgrade pickups…" até o `}` de fechamento da função). Confirme com:
`node --check render.js`

- [ ] **Step 6: Remover o global `upgrades` e o `tier` inicial**

Em `ui.js`, na linha de declaração das globais, remover `upgrades`:

Old:
```js
let player, bullets, enemies, coins, particles, meleeSwings, upgrades;
```
New:
```js
let player, bullets, enemies, coins, particles, meleeSwings;
```

Em `engine.js`, em `startGame`, remover a linha `upgrades    = [];`:

Old:
```js
  meleeSwings = [];
  upgrades    = [];
  potions     = [];
```
New:
```js
  meleeSwings = [];
  potions     = [];
```

E remover `tier: 0,` do literal do `player` (o único consumidor era `updateUpgrades`, já removido):

Old:
```js
    def: cls,
    tier: 0,
    weapon: cls.tiers[0],
```
New:
```js
    def: cls,
    weapon: cls.tiers[0],
```

- [ ] **Step 7: Verificar sintaxe e comportamento**

Run: `node --check items.js && node --check combat.js && node --check render.js && node --check ui.js && node --check engine.js && node --check entities.js`
Expected: sem saída (todos ok).

Browser (recarregue a página): `browser_evaluate`:
```js
() => {
  startGame();
  return {
    spawnUpgrade: typeof spawnUpgrade,    // 'undefined'
    updateUpgrades: typeof updateUpgrades, // 'undefined'
    drawUpgrades: typeof drawUpgrades,     // 'undefined'
    playerTier: player.tier,               // undefined
    weapon: player.weapon && player.weapon.name, // arma inicial da classe (ex.: 'APPRENTICE STAFF')
    state: gameState,                      // 'playing'
  };
}
```
Expected: os três `typeof` = `'undefined'`, `playerTier` = `undefined`, `weapon` = nome da arma inicial, `state` = `'playing'`.
Confirme também `list_console_messages` (nível error): nenhuma mensagem.

- [ ] **Step 8: Commit**

```bash
git add entities.js items.js combat.js render.js ui.js engine.js
git commit -m "refactor(equip): remove the per-2-waves weapon tier drop

Weapon progression will be replaced by shop-bought weapons in Phase 2.
Removes spawnUpgrade/updateUpgrades/drawUpgrades, the upgrades array and
player.tier.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Camada de stats efetivos + slots + arma inicial

**Files:**
- Modify: `index.html` (incluir `equipment.js`)
- Modify: `ui.js` (`recalcStats`, `startWeapon`)
- Modify: `items.js` (`applyMods`)
- Modify: `entities.js` (`gainXp`)
- Modify: `engine.js` (`startGame`)

**Interfaces:**
- Consumes: `emptyEquipment`, `computeEffectiveStats`, `effectiveMaxHp` (Task 1); `baseStats()` (existente, em `ui.js`).
- Produces:
  - `player.equipment` — record de slots (`emptyEquipment()`), com `weapon` preenchido.
  - `player.permStats` — objeto de stats permanentes (base + forge + blessings + consumíveis).
  - `player.permMaxHp` — número (HP máximo permanente).
  - `recalcStats()` — recalcula `player.stats` e `player.maxHp` a partir da camada permanente + equipamento; faz clamp de `player.hp`.
  - `startWeapon(cls)` — retorna a arma inicial da classe.
  - `player.weapon` mantém-se como referência a `player.equipment.weapon`.

- [ ] **Step 1: Escrever a verificação de paridade (browser) que falha**

Com `python -m http.server 8080` no ar e a página carregada, `browser_evaluate`:

```js
() => {
  startGame();
  const baseDmg = player.stats.dmgPct;
  // blessing simulada
  applyMods({ dmgPct: 4 });
  const afterBless = player.stats.dmgPct;
  // consumível de maxHp (deve curar ao ganhar)
  const hp0 = player.hp, max0 = player.maxHp;
  applyMods({ maxHp: 25 });
  // item de equipamento fake com mods (recalc deve refletir e reverter)
  player.equipment.helm = { mods: { dmgPct: 10, maxHp: 20 } };
  recalcStats();
  const withHelm = { dmgPct: player.stats.dmgPct, maxHp: player.maxHp };
  player.equipment.helm = null;
  recalcStats();
  const noHelm = { dmgPct: player.stats.dmgPct, maxHp: player.maxHp };
  return {
    hasPermStats: typeof player.permStats,        // 'object'
    hasEquipment: !!player.equipment,             // true
    weaponSynced: player.weapon === player.equipment.weapon, // true
    blessApplied: afterBless - baseDmg,           // 4
    maxHpHealed: (player.maxHp >= max0 + 25),     // true (after the +25, before helm)
    helmDelta: withHelm.dmgPct - noHelm.dmgPct,   // 10
    helmMaxHpDelta: withHelm.maxHp - noHelm.maxHp,// 20
  };
}
```
Expected ANTES: erro/`undefined` (`player.permStats` não existe, `recalcStats`/`player.equipment` indefinidos). A verificação "passa" quando: `hasPermStats='object'`, `hasEquipment=true`, `weaponSynced=true`, `blessApplied=4`, `maxHpHealed=true`, `helmDelta=10`, `helmMaxHpDelta=20`.

- [ ] **Step 2: Incluir `equipment.js` no `index.html`**

Old:
```html
  <script src="config.js"></script>
  <script src="ui.js"></script>
```
New:
```html
  <script src="config.js"></script>
  <script src="equipment.js"></script>
  <script src="ui.js"></script>
```

- [ ] **Step 3: Adicionar `recalcStats()` e `startWeapon()` em `ui.js`**

Em `ui.js`, logo após a função `baseStats()` (que termina antes do comentário "Stamina / sprint"), inserir:

```js
// derives player.stats / player.maxHp from the permanent layer + equipped gear.
// call after any change to permStats, permMaxHp, or player.equipment.
function recalcStats() {
  player.stats  = computeEffectiveStats(player.permStats, player.equipment);
  player.maxHp  = effectiveMaxHp(player.permMaxHp, player.equipment);
  if (player.hp > player.maxHp) player.hp = player.maxHp;
}

// the weapon a class starts a run with (tier 0 of its definition for now;
// the catalog of buyable weapons arrives in Phase 3)
function startWeapon(cls) {
  return CLASS_DEFS[cls].tiers[0];
}
```

- [ ] **Step 4: Refatorar `applyMods` em `items.js`**

Old:
```js
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
```
New:
```js
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
```

- [ ] **Step 5: Refatorar o ganho de HP por nível em `entities.js`**

Em `entities.js`, dentro de `gainXp`, no laço de level-up:

Old:
```js
    player.level++;
    player.maxHp += LEVEL_HP;
    player.hp = Math.min(player.maxHp, player.hp + LEVEL_HP);
```
New:
```js
    player.level++;
    player.permMaxHp += LEVEL_HP;
    recalcStats();
    player.hp = Math.min(player.maxHp, player.hp + LEVEL_HP);
```

- [ ] **Step 6: Refatorar `startGame` em `engine.js`**

Substituir o bloco que vai da criação do `player` até os perks do Forge.

Old:
```js
  const cls = CLASS_DEFS[selectedClass];
  player = {
    x: canvas.width  / 2,
    y: canvas.height / 2,
    w: 20, h: 20,
    hp: cls.hp, maxHp: cls.hp,
    speed: cls.speed,
    cls: selectedClass,
    def: cls,
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
```
New:
```js
  const cls = CLASS_DEFS[selectedClass];
  player = {
    x: canvas.width  / 2,
    y: canvas.height / 2,
    w: 20, h: 20,
    speed: cls.speed,
    cls: selectedClass,
    def: cls,
    specialTimer: 0,
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

  // equipment slots + the permanent stat layer
  player.equipment = emptyEquipment();
  player.equipment.weapon = startWeapon(selectedClass);
  player.weapon    = player.equipment.weapon; // combat/render read player.weapon
  player.permStats = baseStats();
  player.permMaxHp = cls.hp;

  // forge perks feed the permanent layer
  player.permMaxHp          += forgeLevel('vigor') * 10;
  player.permStats.dmgPct   += forgeLevel('honed') * 2;
  player.permStats.speedPct += forgeLevel('fleet') * 2;
  gold += forgeLevel('startgold') * 15;

  recalcStats();
  player.hp = player.maxHp;
```

- [ ] **Step 7: Verificar sintaxe + paridade + sem regressão**

Run: `node --check equipment.js && node --check ui.js && node --check items.js && node --check entities.js && node --check engine.js`
Expected: sem saída.

Browser (recarregue a página) — rode o snippet do Step 1. Expected: `hasPermStats='object'`, `hasEquipment=true`, `weaponSynced=true`, `blessApplied=4`, `maxHpHealed=true`, `helmDelta=10`, `helmMaxHpDelta=20`.

Verificação de baseline (sem regressão) — `browser_evaluate`:
```js
() => {
  startGame();
  // compara com baseStats() puro + forge esperado
  const base = baseStats();
  const cls = CLASS_DEFS[selectedClass];
  const expectMax = cls.hp + (Save.data.progress.forge.vigor || 0) * 10;
  return {
    statsMatchBaseKeys: Object.keys(player.stats).every(k => k in base),
    maxHpOk: player.maxHp === expectMax,
    hpFull: player.hp === player.maxHp,
    weapon: player.weapon.name,   // arma inicial
    play: gameState,              // 'playing'
  };
}
```
Expected: `statsMatchBaseKeys=true`, `maxHpOk=true`, `hpFull=true`, `weapon` = arma inicial, `play='playing'`. `list_console_messages` (error): vazio.

Jogue ~10s no browser (mova com WASD via `browser_press_key` ou apenas observe via screenshot) e confirme que combate, loja (compra de consumível) e level-up continuam funcionando sem erros no console.

- [ ] **Step 8: Commit**

```bash
git add index.html ui.js items.js entities.js engine.js
git commit -m "feat(equip): equipment slots + effective-stats layer

player gains equipment (slots) and a permanent stat layer (permStats /
permMaxHp); recalcStats() derives player.stats / player.maxHp from it plus
equipped mods. applyMods, gainXp and startGame now feed the permanent layer.
Starting weapon comes from startWeapon(cls).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage (Fase 1 do spec):**
- "slots no `player`" → Task 3 (`player.equipment` = `emptyEquipment()`). ✔
- "camada de stats efetivos (recálculo)" → Task 1 (puro) + Task 3 (`recalcStats`, `applyMods`/`gainXp`/`startGame`). ✔
- "arma inicial por classe substituindo o `tier 0`" → Task 3 (`startWeapon`, `player.equipment.weapon`). ✔
- "remover drop de tier" → Task 2. ✔

**2. Placeholder scan:** sem "TBD/TODO"; todo passo tem código/comando completo e resultado esperado. ✔

**3. Type/nome consistency:** `EQUIP_SLOTS`, `emptyEquipment`, `sumEquipmentMods`, `computeEffectiveStats`, `effectiveMaxHp`, `recalcStats`, `startWeapon`, `player.permStats`, `player.permMaxHp`, `player.equipment` — usados de forma idêntica entre Task 1/3. `player.weapon` segue como referência a `player.equipment.weapon`. ✔

**4. Ordem/segurança entre tasks:** Task 2 remove `player.tier` junto com seus únicos consumidores (`updateUpgrades`/`drawUpgrades`), então não deixa referência quebrada. Task 3 só adiciona a camada e não depende de `player.tier`. Cada task termina com o jogo rodando (Task 2: arma fixa; Task 3: paridade de stats). ✔

## Notas de escopo

Fora desta fase (vêm depois): seção de equipamentos na loja, modelo/tabela de itens equipáveis, comparação de itens, escudo + block, ícones de slot na UI, catálogo curado por arquétipo (Fases 2 e 3 do spec).
