# Equipamentos — Fase 3 (Block, Catálogo Curado e Polish) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar o sistema de equipamentos: adicionar a mecânica de *block* do escudo, substituir o catálogo seed por um conjunto curado (nomes únicos, escudos com block, mais variedade) com teste de integridade, e dar o polish final na UI da loja.

**Architecture:** As Fases 1-2 já entregaram os slots (`player.equipment`), a camada de stats efetivos (`recalcStats()`), as regras puras de equipar (`equipment.js`), o catálogo (`equipment-catalog.js`) e a loja com seção de equipamentos. A Fase 3 adiciona um stat `block` (% chance de anular um hit) que entra na pipeline de dano logo após o dodge; recura o catálogo de dados (escudos passam a dar `block`); e melhora o painel de slots com ícones por slot. Combate, render e a loja continuam lendo as mesmas estruturas.

**Tech Stack:** HTML5 canvas, JavaScript vanilla (scripts globais, sem bundler), Node.js (apenas `node --check` e testes de módulos/dados puros), Playwright MCP + `python -m http.server` para verificação no navegador.

## Global Constraints

- **Sem novas dependências, sem build step.** JS vanilla; scripts via `<script>`, escopo global compartilhado.
- **Módulos/dados puros (`equipment.js`, `equipment-catalog.js`) devem rodar no navegador e em Node** (UMD guard).
- **Comentários de código em inglês** (estilo do projeto).
- **Por-run:** nada deste sistema é persistido em `Save`/localStorage.
- **Sem regressão:** combate, dodge, armor, level-up, a loja (consumíveis + equipamentos) e o `equipItem`/`recalcStats` das fases anteriores continuam funcionando.
- **`block` é % de chance de anular um hit**, distinto de `dodge`; aplicado depois do dodge em `damagePlayer`, cap em 75%. É um `PCT_STATS`.
- **Catálogo curado:** nomes ÚNICOS — não reutilizar nomes dos tiers de `CLASS_DEFS` (ex.: `EMERALD STAFF`, `KNIGHT SWORD`, `KATANA`, `ELVEN BOW`, `PLASMA RIFLE`…) nem dos consumíveis do `ITEM_POOL` (ex.: `TOWER SHIELD`, `IRON GREAVES`, `HEAVY PLATE`). Toda arma tem `archetype` válido e um bloco `weapon`; itens não-arma só têm `mods`. Todo `mods` key deve existir em `STAT_LABELS`.
- **Branch:** trabalhar numa branch nova `feature/equipamentos-fase3` criada a partir de `main` (o controlador/executor cria a branch antes da Task 1). Todo commit termina com `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Sem test runner.** Verificação = `node --check <arquivo>` (sintaxe); `node tests/<arquivo>.test.js` (módulos/dados puros); **integração no navegador** via Playwright MCP contra `python -m http.server 8080` (`browser_navigate` → `http://localhost:8080/index.html` com `?cb=<n>` para evitar cache; `browser_evaluate` com o snippet; funções/dados do jogo são globais). Snippets e resultados esperados estão em cada task.

## Reference — estado atual (não reimplementar)

- `ui.js`: `baseStats()` (retorna `{ …, burn:0, chill:0 }`), `recalcStats()`, `STAT_LABELS`, `PCT_STATS`, `itemPrice`, `fmtMod`.
- `entities.js`: `damagePlayer(raw)` — i-frames → dodge → armor → hp; `playerDmgKind()`, `playerArchetype()`.
- `equipment.js` (puro): `EQUIP_SLOTS`, `emptyEquipment`, `sumEquipmentMods`, `computeEffectiveStats`, `effectiveMaxHp`, `archetypeOf`, `isEligible`, `resolveRingSlot`, `targetSlot`, `canEquip`, `equipInto`.
- `equipment-catalog.js`: `const EQUIPMENT = [...]` (23 itens seed) + UMD export.
- `items.js`: `equipItem(item)` (sets `player.weapon = { ...item.weapon, name: item.name }` for weapons), `rollOffers`, `renderShop` (slots panel uses `it.icon || '▫'`), `equipDelta`, `buyEquipOffer`.

## File Structure

- **Modify `ui.js`** — `baseStats` (+`block`), `STAT_LABELS` (+`block`), `PCT_STATS` (+`block`).
- **Modify `entities.js`** — `damagePlayer`: block roll after dodge.
- **Modify `equipment-catalog.js`** — replace `EQUIPMENT` with the curated ~32-item catalog (unique names, shields with `block`, more variety).
- **Create `tests/equipment-catalog.test.js`** — Node integrity test for the catalog.
- **Modify `items.js`** — `renderShop`: per-slot icons in the slots panel.
- **Modify `style.css`** — `.shop-equip` `min-height`.

---

## Task 1: `block` stat + shield-block mechanic

**Files:**
- Modify: `ui.js` (`baseStats`, `STAT_LABELS`, `PCT_STATS`)
- Modify: `entities.js` (`damagePlayer`)

**Interfaces:**
- Produces: `player.stats.block` (% chance to negate a hit); `STAT_LABELS.block = 'BLOCK'`; `block ∈ PCT_STATS`; a block branch in `damagePlayer` after dodge.

- [ ] **Step 1: Write the failing check (browser)**

Start `python -m http.server 8080`. With Playwright MCP: `browser_navigate` → `http://localhost:8080/index.html?cb=31`, then `browser_evaluate`:

```js
() => {
  startGame();
  const out = {};
  out.hasBlockStat = 'block' in player.stats;        // expected true after impl
  out.hasLabel = STAT_LABELS.block === 'BLOCK';       // true
  out.isPct = PCT_STATS.has('block');                 // true
  // force full block and take a hit: hp must not drop
  player.permStats.block = 100; recalcStats();
  const hp0 = player.hp; player.invincible = 0;
  damagePlayer(20);
  out.blockedNoDamage = player.hp === hp0;            // true (hit negated)
  // with no block, damage applies
  player.permStats.block = 0; recalcStats();
  player.invincible = 0; player.stats.dodge = 0; player.stats.armor = 0;
  const hp1 = player.hp; damagePlayer(10);
  out.tookDamageWithoutBlock = player.hp < hp1;       // true
  return out;
}
```
Expected BEFORE impl: `hasBlockStat=false`, `hasLabel=false`, `isPct=false`. The check passes when all are true plus `blockedNoDamage=true` and `tookDamageWithoutBlock=true`.

- [ ] **Step 2: Add `block` to `baseStats` (`ui.js`)**

Old:
```js
    burn: 0,          // % chance on hit to set a fire DoT
    chill: 0,         // % chance on hit to slow the enemy
  };
}
```
New:
```js
    burn: 0,          // % chance on hit to set a fire DoT
    chill: 0,         // % chance on hit to slow the enemy
    block: 0,         // % chance to fully negate an incoming hit (shields)
  };
}
```

- [ ] **Step 3: Add `block` to `STAT_LABELS` and `PCT_STATS` (`ui.js`)**

Old:
```js
  stamina: 'STAMINA', maxHp: 'MAX HP', burn: 'BURN', chill: 'CHILL',
};
const PCT_STATS = new Set(['dmgPct', 'atkSpeedPct', 'speedPct', 'crit', 'dodge', 'lifeSteal', 'luck', 'burn', 'chill']);
```
New:
```js
  stamina: 'STAMINA', maxHp: 'MAX HP', burn: 'BURN', chill: 'CHILL', block: 'BLOCK',
};
const PCT_STATS = new Set(['dmgPct', 'atkSpeedPct', 'speedPct', 'crit', 'dodge', 'lifeSteal', 'luck', 'burn', 'chill', 'block']);
```

- [ ] **Step 4: Add the block roll in `damagePlayer` (`entities.js`)**

Old:
```js
  if (Math.random() < Math.min(60, st.dodge) / 100) {
    addFloatText(player.x, player.y - 26, 'DODGE', '#3498db');
    Sfx.play('dodge');
    return;
  }
  const dmg = Math.max(1, Math.round(raw * (1 - st.armor / (st.armor + 15))));
```
New:
```js
  if (Math.random() < Math.min(60, st.dodge) / 100) {
    addFloatText(player.x, player.y - 26, 'DODGE', '#3498db');
    Sfx.play('dodge');
    return;
  }
  // shield block: a flat chance (capped) to fully negate the hit
  if (st.block > 0 && Math.random() < Math.min(75, st.block) / 100) {
    addFloatText(player.x, player.y - 26, 'BLOCK', '#aab7c4');
    Sfx.play('dodge');
    return;
  }
  const dmg = Math.max(1, Math.round(raw * (1 - st.armor / (st.armor + 15))));
```

- [ ] **Step 5: Verify**

Run: `node --check ui.js && node --check entities.js` → no output.
Browser: reload `http://localhost:8080/index.html?cb=32` and run the Step 1 snippet. Expected: `hasBlockStat=true`, `hasLabel=true`, `isPct=true`, `blockedNoDamage=true`, `tookDamageWithoutBlock=true`. `browser_console_messages` (error): none.

- [ ] **Step 6: Commit**

```bash
git add ui.js entities.js
git commit --no-verify -m "feat(equip): shield block stat (chance to negate a hit)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Curated catalog + integrity test

**Files:**
- Modify: `equipment-catalog.js` (replace the `EQUIPMENT` array)
- Create: `tests/equipment-catalog.test.js`

**Interfaces:**
- Consumes: `EQUIP_SLOTS` (equipment.js), `block` stat (Task 1).
- Produces: a curated `EQUIPMENT` (~32 items, unique names, shields with `block`, weapons across all archetypes, ≥1 item per slot) + a Node integrity test.

- [ ] **Step 1: Write the failing integrity test**

Create `tests/equipment-catalog.test.js`:

```js
// node tests/equipment-catalog.test.js — catalog integrity (no browser)
const assert = require('assert');
const { EQUIPMENT } = require('../equipment-catalog.js');

const VALID_SLOTS  = ['weapon', 'offhand', 'helm', 'armor', 'boots', 'ring', 'amulet'];
const VALID_ARCH   = ['melee', 'ranged', 'elemental'];
const VALID_ATTACK = ['melee', 'bolt', 'arrow', 'bullet'];
// keys that exist in baseStats()/STAT_LABELS (block added in Task 1) + maxHp
const VALID_STATS  = ['hpRegen', 'lifeSteal', 'dmgPct', 'meleeDmg', 'rangedDmg', 'elementalDmg',
  'atkSpeedPct', 'crit', 'armor', 'dodge', 'range', 'speedPct', 'luck', 'stamina', 'burn', 'chill', 'block', 'maxHp'];

// names that must NOT be reused (class tiers + equipment-named consumables)
const FORBIDDEN_NAMES = new Set([
  'APPRENTICE STAFF', 'EMERALD STAFF', 'ARCANE STAFF', 'CURSED STAFF', 'VENOM STAFF', 'PLAGUE STAFF',
  'SHORT BOW', 'ELVEN BOW', 'TWIN BOW', 'RUSTY SWORD', 'KNIGHT SWORD', 'ANIME BLADE',
  'KNIFE', 'MACHETE', 'KATANA', 'MACE', 'WAR HAMMER', 'GOLDEN BLADE', 'PISTOL', 'SMG', 'PLASMA RIFLE',
  'HEAVY PLATE', 'TOWER SHIELD', 'IRON GREAVES',
]);

const ids = EQUIPMENT.map(i => i.id);
assert.strictEqual(new Set(ids).size, ids.length, 'ids must be unique');
const names = EQUIPMENT.map(i => i.name);
assert.strictEqual(new Set(names).size, names.length, 'names must be unique');

for (const it of EQUIPMENT) {
  assert.ok(VALID_SLOTS.includes(it.slot), `${it.id}: invalid slot ${it.slot}`);
  assert.ok(typeof it.name === 'string' && it.name.length, `${it.id}: name`);
  assert.ok(!FORBIDDEN_NAMES.has(it.name), `${it.id}: name "${it.name}" collides with a tier/consumable`);
  assert.ok(typeof it.price === 'number' && it.price > 0, `${it.id}: price`);
  assert.ok(it.mods && typeof it.mods === 'object' && !Array.isArray(it.mods), `${it.id}: mods`);
  for (const k of Object.keys(it.mods)) assert.ok(VALID_STATS.includes(k), `${it.id}: bad mod key ${k}`);
  if (it.slot === 'weapon') {
    assert.ok(VALID_ARCH.includes(it.archetype), `${it.id}: weapon archetype`);
    assert.ok(it.weapon && VALID_ATTACK.includes(it.weapon.attack), `${it.id}: weapon.attack`);
    assert.ok(Array.isArray(it.weapon.damage) && it.weapon.damage.length === 2, `${it.id}: weapon.damage`);
  } else {
    assert.ok(!it.weapon, `${it.id}: non-weapon must not have a weapon block`);
  }
}

for (const a of VALID_ARCH) assert.ok(EQUIPMENT.some(i => i.slot === 'weapon' && i.archetype === a), `weapon for ${a}`);
for (const s of VALID_SLOTS) assert.ok(EQUIPMENT.some(i => i.slot === s), `item for slot ${s}`);

const shields = EQUIPMENT.filter(i => i.slot === 'offhand');
assert.ok(shields.length >= 2 && shields.every(s => s.mods.block > 0), 'shields must give block');

console.log(`equipment-catalog: all checks passed (${EQUIPMENT.length} items)`);
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node tests/equipment-catalog.test.js`
Expected: FAIL — the current seed catalog reuses forbidden names (e.g. `EMERALD STAFF`) and shields have no `block`, so an assertion throws.

- [ ] **Step 3: Replace the `EQUIPMENT` array in `equipment-catalog.js`**

Replace the entire `const EQUIPMENT = [ ... ];` array (keep the header comment and the UMD export line at the bottom) with:

```js
const EQUIPMENT = [
  // ── weapons: elemental (mage / witch) ──
  { id: 'w_runed',  name: 'RUNED STAFF',    icon: '🪄', slot: 'weapon', archetype: 'elemental', classReq: null, twoHanded: false, mods: {},                  price: 42,
    weapon: { attack: 'bolt', sprite: 'staff_green', fireRate: 185, bulletSpeed: 8, range: 430, damage: [36, 48], pierce: 1, count: 1 } },
  { id: 'w_scepter', name: 'ARCANE SCEPTER', icon: '🔮', slot: 'weapon', archetype: 'elemental', classReq: null, twoHanded: true,  mods: { elementalDmg: 2 }, price: 78,
    weapon: { attack: 'bolt', sprite: 'staff_green', fireRate: 150, bulletSpeed: 9, range: 480, damage: [48, 64], pierce: 2, count: 1 } },
  { id: 'w_plaguewand', name: 'PLAGUE WAND', icon: '🐍', slot: 'weapon', archetype: 'elemental', classReq: null, twoHanded: false, mods: {},                  price: 60,
    weapon: { attack: 'bolt', sprite: 'staff_green', fireRate: 210, bulletSpeed: 8, range: 420, damage: [24, 34], pierce: 1, count: 1, poison: { dps: 12, dur: 3000 } } },
  { id: 'w_stormrod', name: 'STORM ROD',     icon: '⚡', slot: 'weapon', archetype: 'elemental', classReq: null, twoHanded: false, mods: { atkSpeedPct: 5 },  price: 66,
    weapon: { attack: 'bolt', sprite: 'staff_green', fireRate: 130, bulletSpeed: 9, range: 440, damage: [30, 40], pierce: 1, count: 1 } },

  // ── weapons: melee (warrior / ninja / priestess) ──
  { id: 'w_sabre',  name: 'STEEL SABRE',  icon: '🗡', slot: 'weapon', archetype: 'melee', classReq: null, twoHanded: false, mods: {},                price: 44,
    weapon: { attack: 'melee', sprite: 'sword_knight', fireRate: 360, range: 70, damage: [58, 78], arc: Math.PI * 0.75, knockback: 16 } },
  { id: 'w_greatsword', name: 'GREATSWORD', icon: '⚔', slot: 'weapon', archetype: 'melee', classReq: null, twoHanded: true, mods: { meleeDmg: 3 }, price: 82,
    weapon: { attack: 'melee', sprite: 'sword_anime', fireRate: 340, range: 86, damage: [82, 108], arc: Math.PI * 0.9, knockback: 24 } },
  { id: 'w_shadowdagger', name: 'SHADOW DAGGER', icon: '🥷', slot: 'weapon', archetype: 'melee', classReq: null, twoHanded: false, mods: { atkSpeedPct: 6 }, price: 56,
    weapon: { attack: 'melee', sprite: 'katana', fireRate: 200, range: 64, damage: [40, 56], arc: Math.PI * 0.55, knockback: 10 } },
  { id: 'w_glaive', name: 'WAR GLAIVE',   icon: '🔱', slot: 'weapon', archetype: 'melee', classReq: null, twoHanded: true,  mods: { range: 10 },     price: 70,
    weapon: { attack: 'melee', sprite: 'sword_knight', fireRate: 400, range: 92, damage: [66, 88], arc: Math.PI * 0.7, knockback: 20 } },

  // ── weapons: ranged (archer / coprobo) ──
  { id: 'w_hunterbow', name: 'HUNTER BOW', icon: '🏹', slot: 'weapon', archetype: 'ranged', classReq: ['archer'], twoHanded: true, mods: {}, price: 46,
    weapon: { attack: 'arrow', sprite: 'bow_2', fireRate: 350, bulletSpeed: 12, range: 600, damage: [34, 46], pierce: 2, count: 2 } },
  { id: 'w_stormbow', name: 'STORM BOW',  icon: '🎯', slot: 'weapon', archetype: 'ranged', classReq: ['archer'], twoHanded: true, mods: {}, price: 84,
    weapon: { attack: 'arrow', sprite: 'bow_2', fireRate: 320, bulletSpeed: 13, range: 640, damage: [38, 52], pierce: 3, count: 3 } },
  { id: 'w_ion',    name: 'ION BLASTER', icon: '🔫', slot: 'weapon', archetype: 'ranged', classReq: ['coprobo'], twoHanded: true, mods: {}, price: 80,
    weapon: { attack: 'bullet', sprite: null, fireRate: 150, bulletSpeed: 13, range: 520, damage: [26, 36], pierce: 2, count: 1 } },
  { id: 'w_gatling', name: 'GATLING',    icon: '💢', slot: 'weapon', archetype: 'ranged', classReq: ['coprobo'], twoHanded: false, mods: { atkSpeedPct: 8 }, price: 58,
    weapon: { attack: 'bullet', sprite: null, fireRate: 95, bulletSpeed: 11, range: 440, damage: [13, 19], pierce: 0, count: 1 } },

  // ── offhand: shields (give block) ──
  { id: 'o_buckler', name: 'BUCKLER',     icon: '🛡', slot: 'offhand', archetype: null, classReq: null, mods: { armor: 2, block: 6 },  price: 26 },
  { id: 'o_kite',    name: 'KITE SHIELD', icon: '🔰', slot: 'offhand', archetype: null, classReq: null, mods: { armor: 4, block: 12 }, price: 44 },
  { id: 'o_bulwark', name: 'BULWARK',     icon: '🏰', slot: 'offhand', archetype: null, classReq: null, mods: { armor: 7, block: 18, atkSpeedPct: -8 }, price: 62 },

  // ── helm ──
  { id: 'h_iron',   name: 'IRON HELM',   icon: '⛑', slot: 'helm', archetype: null, classReq: null, mods: { armor: 3 },              price: 30 },
  { id: 'h_hood',   name: 'MYSTIC HOOD', icon: '🎓', slot: 'helm', archetype: null, classReq: null, mods: { dmgPct: 5, maxHp: -5 },  price: 34 },
  { id: 'h_horned', name: 'HORNED HELM', icon: '🐲', slot: 'helm', archetype: null, classReq: null, mods: { maxHp: 20, armor: 2 },   price: 36 },

  // ── armor ──
  { id: 'a_plate',   name: 'PLATE ARMOR',  icon: '🦺', slot: 'armor', archetype: null, classReq: null, mods: { armor: 5, speedPct: -3 }, price: 40 },
  { id: 'a_leather', name: 'LEATHER VEST', icon: '🧥', slot: 'armor', archetype: null, classReq: null, mods: { dodge: 6 },              price: 38 },
  { id: 'a_robe',    name: 'BATTLE ROBE',  icon: '👘', slot: 'armor', archetype: null, classReq: null, mods: { dmgPct: 8, armor: -2 },  price: 42 },

  // ── boots ──
  { id: 'b_swift',  name: 'SWIFT BOOTS',   icon: '👢', slot: 'boots', archetype: null, classReq: null, mods: { speedPct: 8 },            price: 30 },
  { id: 'b_plated', name: 'PLATED BOOTS',  icon: '🥾', slot: 'boots', archetype: null, classReq: null, mods: { armor: 2, stamina: 15 },  price: 32 },
  { id: 'b_trail',  name: 'TRAIL RUNNERS', icon: '🩴', slot: 'boots', archetype: null, classReq: null, mods: { speedPct: 5, dodge: 3 },  price: 34 },

  // ── rings ──
  { id: 'r_might',   name: 'RING OF MIGHT',   icon: '💍', slot: 'ring', archetype: null, classReq: null, mods: { dmgPct: 6 },                price: 36 },
  { id: 'r_fortune', name: 'RING OF FORTUNE', icon: '🔆', slot: 'ring', archetype: null, classReq: null, mods: { luck: 12 },                 price: 26 },
  { id: 'r_vampire', name: 'VAMPIRE RING',    icon: '🩸', slot: 'ring', archetype: null, classReq: null, mods: { lifeSteal: 4 },             price: 40 },
  { id: 'r_berserk', name: 'BERSERKER RING',  icon: '😤', slot: 'ring', archetype: null, classReq: null, mods: { atkSpeedPct: 10, armor: -2 }, price: 38 },

  // ── amulet ──
  { id: 'm_vitality', name: 'VITALITY AMULET', icon: '📿', slot: 'amulet', archetype: null, classReq: null, mods: { maxHp: 30 }, price: 38 },
  { id: 'm_crit',     name: 'CRIT PENDANT',    icon: '🎴', slot: 'amulet', archetype: null, classReq: null, mods: { crit: 8 },   price: 36 },
  { id: 'm_ember',    name: 'EMBER PENDANT',   icon: '🔥', slot: 'amulet', archetype: null, classReq: null, mods: { burn: 14 },  price: 36 },
  { id: 'm_frost',    name: 'FROST PENDANT',   icon: '❄', slot: 'amulet', archetype: null, classReq: null, mods: { chill: 16 }, price: 36 },
];
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `node tests/equipment-catalog.test.js` → PASS (`equipment-catalog: all checks passed (32 items)`).
Run: `node --check equipment-catalog.js` → no output.
Run: `node tests/equipment.test.js && node tests/equipment-equip.test.js` → still pass.

- [ ] **Step 5: Commit**

```bash
git add equipment-catalog.js tests/equipment-catalog.test.js
git commit --no-verify -m "feat(equip): curated catalog (unique names, shields w/ block, more variety)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Slots-panel icons + grid polish

**Files:**
- Modify: `items.js` (`renderShop` slots panel)
- Modify: `style.css` (`.shop-equip`)

**Interfaces:**
- Consumes: `EQUIP_SLOTS`, `player.equipment`.
- Produces: per-slot fallback icons in the slots panel (so the flat starting weapon and empty slots show a meaningful icon).

- [ ] **Step 1: Write the failing check (browser)**

Start the server; `browser_navigate` → `http://localhost:8080/index.html?cb=33`; `browser_evaluate`:

```js
() => {
  startGame(); openShop();
  const chips = [...document.querySelectorAll('#shop-slots .slot-chip')];
  const weaponChip = chips[0]; // weapon slot, holds the flat starting weapon (no .icon)
  const ico = weaponChip.querySelector('.slot-ico').textContent;
  const equipMinH = getComputedStyle(document.getElementById('shop-equip')).minHeight;
  return {
    weaponIcon: ico,                  // expected: '⚔' (per-slot fallback), not '▫'
    notPlaceholder: ico !== '▫',      // true after impl
    equipHasMinHeight: equipMinH !== '0px' && equipMinH !== 'auto', // true after CSS
  };
}
```
Expected BEFORE impl: `weaponIcon='▫'`, `notPlaceholder=false`, `equipHasMinHeight=false`.

- [ ] **Step 2: Add per-slot icons in `renderShop` (`items.js`)**

Old:
```js
  const slotLabels = { weapon: 'WEAPON', offhand: 'OFF-HAND', helm: 'HELM', armor: 'ARMOR',
                       boots: 'BOOTS', ring1: 'RING', ring2: 'RING', amulet: 'AMULET' };
  document.getElementById('shop-slots').innerHTML = EQUIP_SLOTS.map(s => {
    const it = player.equipment[s];
    return `<div class="slot-chip ${it ? 'filled' : 'empty'}" title="${slotLabels[s]}">
        <span class="slot-ico">${it ? (it.icon || '▫') : '·'}</span>
        <span class="slot-lbl">${it ? it.name : slotLabels[s]}</span>
      </div>`;
  }).join('');
```
New:
```js
  const slotLabels = { weapon: 'WEAPON', offhand: 'OFF-HAND', helm: 'HELM', armor: 'ARMOR',
                       boots: 'BOOTS', ring1: 'RING', ring2: 'RING', amulet: 'AMULET' };
  const slotIcons  = { weapon: '⚔', offhand: '🛡', helm: '⛑', armor: '🦺',
                       boots: '👢', ring1: '💍', ring2: '💍', amulet: '📿' };
  document.getElementById('shop-slots').innerHTML = EQUIP_SLOTS.map(s => {
    const it  = player.equipment[s];
    const ico = it ? (it.icon || slotIcons[s]) : slotIcons[s]; // empty slots show a dimmed slot icon
    return `<div class="slot-chip ${it ? 'filled' : 'empty'}" title="${slotLabels[s]}">
        <span class="slot-ico">${ico}</span>
        <span class="slot-lbl">${it ? it.name : slotLabels[s]}</span>
      </div>`;
  }).join('');
```

- [ ] **Step 3: Give `.shop-equip` a min-height (`style.css`)**

Old:
```css
.shop-equip {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
```
New:
```css
.shop-equip {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  min-height: 72px; /* keeps the section labels apart even with no eligible offers */
}
```

- [ ] **Step 4: Verify + screenshot**

Run: `node --check items.js` → no output.
Browser: reload `http://localhost:8080/index.html?cb=34`, run the Step 1 snippet. Expected: `weaponIcon='⚔'`, `notPlaceholder=true`, `equipHasMinHeight=true`. `browser_console_messages` (error): none.
Then resize to 1100x860, `browser_evaluate` `() => { startGame(); openShop(); gold = 999; equipItem(EQUIPMENT.find(i=>i.id==='o_kite')); rollOffers(); renderShop(); }`, and `browser_take_screenshot` (filename `shop-fase3.png`) — confirm the slots panel shows meaningful icons (weapon ⚔ for the starting weapon, the equipped KITE SHIELD in off-hand) and equip offers show block deltas where relevant. Read the screenshot.

- [ ] **Step 5: Commit**

```bash
git add items.js style.css
git commit --no-verify -m "feat(equip): per-slot icons in the shop slots panel + grid min-height

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage (design §6/§ faseamento item 3 — "escudo + block, conjunto curado, ícones, balanceamento"):**
- block (escudo) → Task 1 (stat + `damagePlayer`) + Task 2 (shields give block). ✔
- conjunto curado por slot/arquétipo + balanceamento → Task 2 (32 items, unique names, prices). ✔
- ícones → Task 3 (per-slot icons). ✔
- integrity guard so the catalog stays valid → Task 2 (Node test). ✔

**2. Placeholder scan:** no "TBD/TODO"; every step has complete code/commands and expected output; the catalog is concrete. ✔

**3. Type/name consistency:** `block` is added to `baseStats`/`STAT_LABELS`/`PCT_STATS` (Task 1) and used by shields (Task 2) and validated by the integrity test's `VALID_STATS` (which includes `block`). Catalog item shape matches the consumers (`equipItem`, `equipDelta`, `renderShop`) from Phase 2 — `slot`, `archetype`, `classReq`, `twoHanded`, `mods`, `price`, `weapon`. Weapon `sprite` keys (`staff_green`, `sword_knight`, `sword_anime`, `katana`, `bow_2`, `null`) all exist in `WEAPON_SPRITES`. ✔

**4. Cross-task safety:** Task 1 is self-contained (block has no effect until a shield grants it). Task 2 depends on Task 1 only for the `block` label/stat (the integrity test lists `block` as valid). Task 3 is independent UI polish. Each task leaves the game runnable and green. ✔

## Notes
- **Out of scope (separate deploy concern, not equipment):** asset/service-worker cache-busting so players receive updated `style.css`/JS after a deploy. Worth a small dedicated change to `sw.js` / asset versioning later.
- After Phase 3 the design doc's three phases are complete: per-run gear with slots, archetype weapons replacing tiers, a curated catalog, comparison shop UI, and shield block.
