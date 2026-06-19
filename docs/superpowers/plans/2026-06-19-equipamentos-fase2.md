# Equipamentos — Fase 2 (Loja de Equipamentos) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir comprar e equipar equipamentos na loja entre waves: armas por arquétipo (que viram a arma ativa), itens de cada slot que dão stats, com um painel do set equipado e comparação de itens.

**Architecture:** A Fase 1 já deu ao `player` os slots (`player.equipment`) e a camada de stats efetivos (`recalcStats()`). A Fase 2 adiciona: (1) regras puras de equipar em `equipment.js` (qual slot, 1H/2H/escudo, anéis, elegibilidade) — testáveis em Node; (2) um catálogo de dados `equipment-catalog.js` (itens fixos curados, seed); (3) a mecânica `equipItem()` que coloca o item no slot, sincroniza `player.weapon` e recalcula stats; (4) a reformulação da loja com uma seção de equipamentos, o painel de slots e a comparação. Combate/render seguem lendo `player.weapon`/`player.stats`.

**Tech Stack:** HTML5 canvas, JavaScript vanilla (scripts globais, sem bundler), Node.js (apenas `node --check` e testes de módulo puro), Playwright MCP + `python -m http.server` para verificação no navegador.

## Global Constraints

- **Sem novas dependências, sem build step.** JS vanilla; scripts via `<script>`, escopo global compartilhado.
- **Módulos puros (`equipment.js`) devem rodar no navegador e em Node** (UMD guard no final).
- **Comentários de código em inglês** (estilo do projeto).
- **Por-run:** nada deste sistema é persistido em `Save`/localStorage. Os slots zeram a cada run (já garantido pela Fase 1 em `startGame`).
- **Sem regressão:** a loja de consumíveis atual (`ITEM_POOL`), heal, reroll, level-up e o combate continuam funcionando. A camada de stats da Fase 1 (`permStats`/`recalcStats`) não muda de contrato.
- **Identidade por arquétipo:** uma arma só é elegível se seu `archetype` casar com o arquétipo da classe (mago/bruxa = `elemental`; guerreiro/ninja/sacerdotisa = `melee`; arqueiro/coprobô = `ranged`). O tipo de ataque vem da arma; o special continua da classe.
- **Escudo na Fase 2 dá só `armor`** (stat já existente). O *block* (mecânica nova de anular hit) é Fase 3.
- **Catálogo seed:** esta fase inclui um catálogo inicial pequeno (cobre todos os slots + casos 1H/2H/escudo) só para tornar a loja jogável/testável. A expansão curada, o balanceamento, os ícones polidos e o sprite de escudo são Fase 3.
- **Branch:** trabalhar numa branch nova `feature/equipamentos-fase2` criada a partir de `main` (o controlador/executor cria a branch antes da Task 1). Todo commit termina com `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Sem test runner.** Verificação = `node --check <arquivo>` (sintaxe); `node tests/<arquivo>.test.js` (módulos puros); **integração no navegador** via Playwright MCP contra `python -m http.server 8080` (`browser_navigate` → `http://localhost:8080/index.html`, `browser_evaluate` com o snippet; funções do jogo são globais). Snippets e resultados esperados estão em cada task.

## Reference — funções existentes da Fase 1 (não reimplementar)

`equipment.js` (puro) já exporta: `EQUIP_SLOTS` (`['weapon','offhand','helm','armor','boots','ring1','ring2','amulet']`), `emptyEquipment()`, `sumEquipmentMods(equipment)`, `computeEffectiveStats(permStats, equipment)`, `effectiveMaxHp(permMaxHp, equipment)`.
`ui.js`: `recalcStats()` (re-deriva `player.stats`/`player.maxHp`), `startWeapon(classKey)`, `STAT_LABELS`, `PCT_STATS`, `itemPrice(item)`, `ITEM_POOL`.
`items.js`: `applyMods(mods)`, `fmtMod(k,v)`, `rollOffers()`, `renderShop()`, `buyOffer(i)`, `shopHeal()`, `shopReroll()`, `openShop()`.
`entities.js`: `playerDmgKind()` → `'melee'|'arrow'|'elemental'`.
`player` tem: `equipment` (slots), `permStats`, `permMaxHp`, `stats`, `maxHp`, `weapon`, `cls`, `def`.

## File Structure

- **Modify `equipment.js`** — add pure equip rules: `archetypeOf`, `isEligible`, `resolveRingSlot`, `targetSlot`, `canEquip`, `equipInto`. Extend the Node export list.
- **Create `tests/equipment-equip.test.js`** — Node tests for the new rules.
- **Create `equipment-catalog.js`** — `const EQUIPMENT = [...]` seed catalog (data only; weapon entries reference `WEAPON_SPRITES` keys as strings). UMD-style global.
- **Modify `index.html`** — load `equipment-catalog.js`; rework the shop-screen markup (slots panel + equipment offers + consumables section).
- **Modify `entities.js`** — add `playerArchetype()` next to `playerDmgKind()`.
- **Modify `items.js`** — `equipItem(item)`; rework `rollOffers`/`renderShop`; add `buyEquipOffer(i)` and the equip comparison helper.
- **Modify `ui.js`** — declare `shopEquipOffers`; wire the new shop click handler.
- **Modify `style.css`** — styles for the slots panel, equip offer cards, section labels, comparison deltas.

---

## Task 1: Pure equip rules in `equipment.js` + Node tests

**Files:**
- Modify: `equipment.js`
- Create: `tests/equipment-equip.test.js`

**Interfaces:**
- Consumes: `EQUIP_SLOTS` (existing).
- Produces (globals + Node exports):
  - `archetypeOf(attack): 'melee'|'ranged'|'elemental'` — `'melee'`→melee, `'arrow'|'bullet'`→ranged, else elemental.
  - `isEligible(item, classKey, archetype): boolean` — weapon items require `item.archetype === archetype`; all items require `!item.classReq || item.classReq.includes(classKey)`.
  - `resolveRingSlot(equipment): 'ring1'|'ring2'` — first empty ring slot, else `'ring1'`.
  - `targetSlot(item, equipment): string` — the slot key the item occupies (`item.slot`, except `slot==='ring'` resolves to `resolveRingSlot`).
  - `canEquip(item, equipment): boolean` — `false` only when `item.slot==='offhand'` and the equipped weapon is two-handed; otherwise `true`.
  - `equipInto(equipment, item): equipment` — returns a NEW equipment object with `item` placed at `targetSlot`; if the item is a two-handed weapon, also clears `offhand`. Does not mutate the input.

- [ ] **Step 1: Write the failing test**

Create `tests/equipment-equip.test.js`:

```js
// node tests/equipment-equip.test.js — pure equip-rule checks (no browser)
const assert = require('assert');
const eq = require('../equipment.js');

// archetypeOf
assert.strictEqual(eq.archetypeOf('melee'), 'melee');
assert.strictEqual(eq.archetypeOf('arrow'), 'ranged');
assert.strictEqual(eq.archetypeOf('bullet'), 'ranged');
assert.strictEqual(eq.archetypeOf('bolt'), 'elemental');

// isEligible — weapons must match archetype; classReq gates everything
const sword = { slot: 'weapon', archetype: 'melee' };
assert.ok(eq.isEligible(sword, 'warrior', 'melee'));
assert.ok(!eq.isEligible(sword, 'mage', 'elemental'), 'wrong archetype weapon');
const ring = { slot: 'ring', archetype: null };
assert.ok(eq.isEligible(ring, 'mage', 'elemental'), 'generic ring fits anyone');
const coproGun = { slot: 'weapon', archetype: 'ranged', classReq: ['coprobo'] };
assert.ok(eq.isEligible(coproGun, 'coprobo', 'ranged'));
assert.ok(!eq.isEligible(coproGun, 'archer', 'ranged'), 'classReq excludes archer');

// resolveRingSlot
let e = eq.emptyEquipment();
assert.strictEqual(eq.resolveRingSlot(e), 'ring1');
e.ring1 = { slot: 'ring' };
assert.strictEqual(eq.resolveRingSlot(e), 'ring2');
e.ring2 = { slot: 'ring' };
assert.strictEqual(eq.resolveRingSlot(e), 'ring1', 'both full -> ring1');

// targetSlot
assert.strictEqual(eq.targetSlot({ slot: 'helm' }, eq.emptyEquipment()), 'helm');
assert.strictEqual(eq.targetSlot({ slot: 'ring' }, eq.emptyEquipment()), 'ring1');

// canEquip — shield blocked only when a two-handed weapon is equipped
const shield = { slot: 'offhand' };
let g = eq.emptyEquipment();
assert.ok(eq.canEquip(shield, g), 'shield ok with empty weapon');
g.weapon = { slot: 'weapon', twoHanded: false };
assert.ok(eq.canEquip(shield, g), 'shield ok with 1H weapon');
g.weapon = { slot: 'weapon', twoHanded: true };
assert.ok(!eq.canEquip(shield, g), 'shield blocked with 2H weapon');

// equipInto — does not mutate input; 2H clears offhand
const base = eq.emptyEquipment();
base.offhand = { slot: 'offhand', name: 'SHIELD' };
const twoH = { slot: 'weapon', name: 'GREATSWORD', twoHanded: true };
const after = eq.equipInto(base, twoH);
assert.strictEqual(after.weapon.name, 'GREATSWORD');
assert.strictEqual(after.offhand, null, '2H clears offhand');
assert.ok(base.offhand && base.offhand.name === 'SHIELD', 'input not mutated');
assert.strictEqual(base.weapon, null, 'input not mutated');
// ring goes to first free slot
const r1 = eq.equipInto(eq.emptyEquipment(), { slot: 'ring', name: 'R1' });
assert.strictEqual(r1.ring1.name, 'R1');
const r2 = eq.equipInto(r1, { slot: 'ring', name: 'R2' });
assert.strictEqual(r2.ring2.name, 'R2');
assert.strictEqual(r2.ring1.name, 'R1', 'first ring preserved');

console.log('equipment-equip: all tests passed');
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node tests/equipment-equip.test.js`
Expected: FAIL — `eq.archetypeOf is not a function` (the new functions don't exist yet).

- [ ] **Step 3: Implement the rules in `equipment.js`**

In `equipment.js`, insert these functions immediately before the UMD export block (the `if (typeof module !== 'undefined' ...)` line):

```js
// maps a weapon's attack type to its archetype bucket
function archetypeOf(attack) {
  if (attack === 'melee') return 'melee';
  if (attack === 'arrow' || attack === 'bullet') return 'ranged';
  return 'elemental';
}

// is this item usable by the given class/archetype?
// weapons must match the archetype; classReq (if present) gates any item
function isEligible(item, classKey, archetype) {
  if (item.slot === 'weapon' && item.archetype !== archetype) return false;
  if (item.classReq && !item.classReq.includes(classKey)) return false;
  return true;
}

// first empty ring slot, or ring1 when both are full
function resolveRingSlot(equipment) {
  if (!equipment.ring1) return 'ring1';
  if (!equipment.ring2) return 'ring2';
  return 'ring1';
}

// the concrete slot key an item occupies (rings resolve to ring1/ring2)
function targetSlot(item, equipment) {
  return item.slot === 'ring' ? resolveRingSlot(equipment) : item.slot;
}

// a shield (offhand) cannot be equipped while a two-handed weapon is held
function canEquip(item, equipment) {
  if (item.slot === 'offhand' && equipment.weapon && equipment.weapon.twoHanded) return false;
  return true;
}

// returns a NEW equipment object with item placed per the slot rules;
// a two-handed weapon also clears the offhand. Never mutates the input.
function equipInto(equipment, item) {
  const next = { ...equipment };
  const slot = targetSlot(item, next);
  next[slot] = item;
  if (item.slot === 'weapon' && item.twoHanded) next.offhand = null;
  return next;
}
```

Then extend the export list. Replace:

```js
  module.exports = { EQUIP_SLOTS, emptyEquipment, sumEquipmentMods, computeEffectiveStats, effectiveMaxHp };
```
with:
```js
  module.exports = { EQUIP_SLOTS, emptyEquipment, sumEquipmentMods, computeEffectiveStats, effectiveMaxHp,
                     archetypeOf, isEligible, resolveRingSlot, targetSlot, canEquip, equipInto };
```

- [ ] **Step 4: Run the tests (both files) and watch them pass**

Run: `node tests/equipment-equip.test.js` → PASS (`equipment-equip: all tests passed`).
Run: `node tests/equipment.test.js` → PASS (Phase 1 tests still green).
Run: `node --check equipment.js` → no output.

- [ ] **Step 5: Commit**

```bash
git add equipment.js tests/equipment-equip.test.js
git commit --no-verify -m "feat(equip): pure equip rules (slot/archetype/1H-2H/ring)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Seed catalog + `equipItem` mechanics

**Files:**
- Create: `equipment-catalog.js`
- Modify: `index.html` (load the catalog script)
- Modify: `entities.js` (`playerArchetype()`)
- Modify: `items.js` (`equipItem()`)

**Interfaces:**
- Consumes: `equipInto`, `targetSlot`, `archetypeOf` (Task 1); `recalcStats` (Phase 1); `player`, `WEAPON_SPRITES` keys.
- Produces:
  - global `EQUIPMENT: Array<item>` — seed catalog. Item shape:
    `{ id, name, icon, slot, archetype, classReq, twoHanded, mods, price, weapon? }` where `weapon` (only for `slot:'weapon'`) is `{ attack, sprite, fireRate, damage:[min,max], range, bulletSpeed?, pierce?, count?, arc?, knockback?, poison? }`.
  - `playerArchetype(): 'melee'|'ranged'|'elemental'` (entities.js) = `archetypeOf(player.weapon.attack)`.
  - `equipItem(item)` (items.js) — places the item via `equipInto`, syncs `player.weapon` when a weapon, then `recalcStats()`.

- [ ] **Step 1: Create the seed catalog `equipment-catalog.js`**

Create `equipment-catalog.js`:

```js
// equipment-catalog.js — fixed, curated equipment for the per-run shop (seed set).
// Weapon entries carry their own combat params (same shape as CLASS_DEFS tiers) and
// the player's attack type comes from the equipped weapon, within the class archetype.
// Non-weapon items only carry stat `mods`. Phase 3 expands/balances this list.
const EQUIPMENT = [
  // ── weapons: elemental (mage / witch) ──
  { id: 'w_emerald', name: 'EMERALD STAFF', icon: '🪄', slot: 'weapon', archetype: 'elemental', classReq: null, twoHanded: false, mods: {}, price: 42,
    weapon: { attack: 'bolt', sprite: 'staff_green', fireRate: 185, bulletSpeed: 8, range: 430, damage: [36, 48], pierce: 1, count: 1 } },
  { id: 'w_arcane', name: 'ARCANE STAFF', icon: '🔮', slot: 'weapon', archetype: 'elemental', classReq: null, twoHanded: true, mods: { elementalDmg: 2 }, price: 78,
    weapon: { attack: 'bolt', sprite: 'staff_green', fireRate: 150, bulletSpeed: 9, range: 480, damage: [48, 64], pierce: 2, count: 1 } },
  { id: 'w_venom', name: 'VENOM STAFF', icon: '🐍', slot: 'weapon', archetype: 'elemental', classReq: null, twoHanded: false, mods: {}, price: 60,
    weapon: { attack: 'bolt', sprite: 'staff_green', fireRate: 210, bulletSpeed: 8, range: 420, damage: [24, 34], pierce: 1, count: 1, poison: { dps: 12, dur: 3000 } } },

  // ── weapons: melee (warrior / ninja / priestess) ──
  { id: 'w_knight', name: 'KNIGHT SWORD', icon: '🗡', slot: 'weapon', archetype: 'melee', classReq: null, twoHanded: false, mods: {}, price: 44,
    weapon: { attack: 'melee', sprite: 'sword_knight', fireRate: 380, range: 70, damage: [60, 80], arc: Math.PI * 0.75, knockback: 17 } },
  { id: 'w_anime', name: 'ANIME BLADE', icon: '⚔', slot: 'weapon', archetype: 'melee', classReq: null, twoHanded: true, mods: { meleeDmg: 3 }, price: 80,
    weapon: { attack: 'melee', sprite: 'sword_anime', fireRate: 330, range: 84, damage: [80, 105], arc: Math.PI * 0.88, knockback: 22 } },
  { id: 'w_katana', name: 'KATANA', icon: '🥷', slot: 'weapon', archetype: 'melee', classReq: null, twoHanded: false, mods: { atkSpeedPct: 6 }, price: 58,
    weapon: { attack: 'melee', sprite: 'katana', fireRate: 205, range: 68, damage: [44, 60], arc: Math.PI * 0.6, knockback: 12 } },

  // ── weapons: ranged (archer / coprobo) ──
  { id: 'w_elven', name: 'ELVEN BOW', icon: '🏹', slot: 'weapon', archetype: 'ranged', classReq: ['archer'], twoHanded: true, mods: {}, price: 46,
    weapon: { attack: 'arrow', sprite: 'bow_2', fireRate: 350, bulletSpeed: 12, range: 600, damage: [34, 46], pierce: 2, count: 2 } },
  { id: 'w_twin', name: 'TWIN BOW', icon: '🎯', slot: 'weapon', archetype: 'ranged', classReq: ['archer'], twoHanded: true, mods: {}, price: 82,
    weapon: { attack: 'arrow', sprite: 'bow_2', fireRate: 320, bulletSpeed: 13, range: 640, damage: [38, 52], pierce: 3, count: 3 } },
  { id: 'w_plasma', name: 'PLASMA RIFLE', icon: '🔫', slot: 'weapon', archetype: 'ranged', classReq: ['coprobo'], twoHanded: true, mods: {}, price: 80,
    weapon: { attack: 'bullet', sprite: null, fireRate: 150, bulletSpeed: 13, range: 520, damage: [26, 36], pierce: 2, count: 1 } },
  { id: 'w_smg', name: 'SMG', icon: '💢', slot: 'weapon', archetype: 'ranged', classReq: ['coprobo'], twoHanded: false, mods: { atkSpeedPct: 8 }, price: 56,
    weapon: { attack: 'bullet', sprite: null, fireRate: 110, bulletSpeed: 11, range: 440, damage: [14, 20], pierce: 0, count: 1 } },

  // ── offhand: shields (armor only in Phase 2; block is Phase 3) ──
  { id: 'o_wood', name: 'WOODEN SHIELD', icon: '🛡', slot: 'offhand', archetype: null, classReq: null, mods: { armor: 3 }, price: 28 },
  { id: 'o_tower', name: 'TOWER SHIELD', icon: '🏰', slot: 'offhand', archetype: null, classReq: null, mods: { armor: 6, atkSpeedPct: -8 }, price: 48 },

  // ── helm ──
  { id: 'h_iron', name: 'IRON HELM', icon: '⛑', slot: 'helm', archetype: null, classReq: null, mods: { armor: 3 }, price: 30 },
  { id: 'h_hood', name: 'MYSTIC HOOD', icon: '🎓', slot: 'helm', archetype: null, classReq: null, mods: { dmgPct: 5, maxHp: -5 }, price: 34 },

  // ── armor ──
  { id: 'a_plate', name: 'PLATE ARMOR', icon: '🦺', slot: 'armor', archetype: null, classReq: null, mods: { armor: 5, speedPct: -3 }, price: 40 },
  { id: 'a_leather', name: 'LEATHER VEST', icon: '🧥', slot: 'armor', archetype: null, classReq: null, mods: { dodge: 6 }, price: 38 },

  // ── boots ──
  { id: 'b_swift', name: 'SWIFT BOOTS', icon: '👢', slot: 'boots', archetype: null, classReq: null, mods: { speedPct: 8 }, price: 30 },
  { id: 'b_greaves', name: 'IRON GREAVES', icon: '🥾', slot: 'boots', archetype: null, classReq: null, mods: { armor: 2, stamina: 15 }, price: 32 },

  // ── rings ──
  { id: 'r_might', name: 'RING OF MIGHT', icon: '💍', slot: 'ring', archetype: null, classReq: null, mods: { dmgPct: 6 }, price: 36 },
  { id: 'r_fortune', name: 'RING OF FORTUNE', icon: '🔆', slot: 'ring', archetype: null, classReq: null, mods: { luck: 12 }, price: 26 },
  { id: 'r_vampire', name: 'VAMPIRE RING', icon: '🩸', slot: 'ring', archetype: null, classReq: null, mods: { lifeSteal: 4 }, price: 40 },

  // ── amulet ──
  { id: 'm_vitality', name: 'VITALITY AMULET', icon: '📿', slot: 'amulet', archetype: null, classReq: null, mods: { maxHp: 30 }, price: 38 },
  { id: 'm_crit', name: 'CRIT PENDANT', icon: '🎴', slot: 'amulet', archetype: null, classReq: null, mods: { crit: 8 }, price: 36 },
];

// expose for Node (data only); harmless in the browser
if (typeof module !== 'undefined' && module.exports) module.exports = { EQUIPMENT };
```

- [ ] **Step 2: Load the catalog in `index.html`**

Find the script includes and add `equipment-catalog.js` right after `equipment.js`:

Old:
```html
  <script src="config.js"></script>
  <script src="equipment.js"></script>
  <script src="ui.js"></script>
```
New:
```html
  <script src="config.js"></script>
  <script src="equipment.js"></script>
  <script src="equipment-catalog.js"></script>
  <script src="ui.js"></script>
```

- [ ] **Step 3: Add `playerArchetype()` in `entities.js`**

In `entities.js`, immediately after the `playerDmgKind()` function, add:

```js
// the player's archetype bucket (melee | ranged | elemental), from the equipped weapon
function playerArchetype() {
  return archetypeOf(player.weapon.attack);
}
```

- [ ] **Step 4: Add `equipItem()` in `items.js`**

In `items.js`, add near the top (after `closeShop`, before `rollOffers`):

```js
// places a bought item into its slot, syncs the active weapon, recalculates stats
function equipItem(item) {
  player.equipment = equipInto(player.equipment, item);
  if (item.slot === 'weapon') player.weapon = player.equipment.weapon;
  recalcStats();
}
```

- [ ] **Step 5: Verify syntax + mechanics in the browser**

Run: `node --check equipment-catalog.js && node --check entities.js && node --check items.js` → no output.

Start the server (separate terminal): `python -m http.server 8080`. With Playwright MCP: `browser_navigate` → `http://localhost:8080/index.html`, then `browser_evaluate`:

```js
() => {
  startGame(); // mage by default -> elemental
  const out = {};
  out.archetype = playerArchetype();                       // 'elemental'
  const elig = EQUIPMENT.filter(it => isEligible(it, player.cls, playerArchetype()));
  out.eligibleWeaponArchetypes = [...new Set(elig.filter(i => i.slot==='weapon').map(i => i.archetype))]; // ['elemental']
  // equip a stronger elemental weapon
  const arcane = EQUIPMENT.find(i => i.id === 'w_arcane');
  equipItem(arcane);
  out.weaponName = player.weapon.name;                     // 'ARCANE STAFF'
  out.weaponSynced = player.weapon === player.equipment.weapon; // true
  out.elemDmgFromWeaponMod = player.stats.elementalDmg;    // 2 (arcane has mods.elementalDmg:2)
  // equip a ring then a second ring then an amulet (maxHp)
  const max0 = player.maxHp;
  equipItem(EQUIPMENT.find(i => i.id === 'r_might'));
  equipItem(EQUIPMENT.find(i => i.id === 'r_fortune'));
  equipItem(EQUIPMENT.find(i => i.id === 'm_vitality'));
  out.ring1 = player.equipment.ring1.name;                 // 'RING OF MIGHT'
  out.ring2 = player.equipment.ring2.name;                 // 'RING OF FORTUNE'
  out.dmgPctFromRing = player.stats.dmgPct >= 6;           // true
  out.luckFromRing = player.stats.luck >= 12;              // true
  out.maxHpUp = player.maxHp === max0 + 30;                // true (amulet, no heal on equip)
  // two-handed clears offhand
  equipItem(EQUIPMENT.find(i => i.id === 'o_wood'));        // shield first (1H staff? arcane is 2H!) 
  out.shieldBlockedWith2H = !canEquip(EQUIPMENT.find(i => i.id==='o_wood'), player.equipment); // true (arcane is 2H)
  return out;
}
```
Expected: `archetype='elemental'`, `eligibleWeaponArchetypes=['elemental']`, `weaponName='ARCANE STAFF'`, `weaponSynced=true`, `elemDmgFromWeaponMod=2`, `ring1='RING OF MIGHT'`, `ring2='RING OF FORTUNE'`, `dmgPctFromRing=true`, `luckFromRing=true`, `maxHpUp=true`, `shieldBlockedWith2H=true`. Also run `browser_console_messages` (error): none.

- [ ] **Step 6: Commit**

```bash
git add equipment-catalog.js index.html entities.js items.js
git commit --no-verify -m "feat(equip): seed catalog + equipItem mechanics

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Shop UI — equipment section, slots panel, comparison

**Files:**
- Modify: `index.html` (shop-screen markup)
- Modify: `ui.js` (`shopEquipOffers` state + click handler)
- Modify: `items.js` (`rollOffers`, `renderShop`, `buyEquipOffer`, `equipDelta` helper, `shopReroll`)
- Modify: `style.css` (slots panel, equip cards, section labels, deltas)

**Interfaces:**
- Consumes: `EQUIPMENT`, `isEligible`, `canEquip`, `targetSlot`, `playerArchetype`, `equipItem`, `itemPrice`, `fmtMod`, `STAT_LABELS`, `PCT_STATS`.
- Produces: global `shopEquipOffers`; functions `buyEquipOffer(i)`, `equipDelta(item)`; reworked `rollOffers`/`renderShop`/`shopReroll`.

- [ ] **Step 1: Declare `shopEquipOffers` in `ui.js`**

In `ui.js`, find the consumable shop state and add the equip array next to it. Old:
```js
let shopOffers = [];
let rerollCost = 5;
```
New:
```js
let shopOffers = [];      // consumable offers (ITEM_POOL)
let shopEquipOffers = []; // equipment offers (EQUIPMENT)
let rerollCost = 5;
```

- [ ] **Step 2: Rework the shop-screen markup in `index.html`**

Replace the `shop-main` block. Old:
```html
        <div class="shop-main">
          <div id="shop-items" class="shop-items"></div>
          <div id="shop-stats" class="shop-stats"></div>
        </div>
```
New:
```html
        <div class="shop-main">
          <div class="shop-left">
            <div id="shop-slots" class="shop-slots"></div>
            <div class="shop-section-label">— EQUIPMENT —</div>
            <div id="shop-equip" class="shop-equip"></div>
            <div class="shop-section-label">— CONSUMABLES —</div>
            <div id="shop-items" class="shop-items"></div>
          </div>
          <div id="shop-stats" class="shop-stats"></div>
        </div>
```

- [ ] **Step 3: Rework `rollOffers` in `items.js`**

Old:
```js
function rollOffers() {
  const kind = playerDmgKind(); // melee | arrow (incl. bullets) | elemental
  const pool = ITEM_POOL.filter(it => !it.dmgKind || it.dmgKind === kind);
  const picks = [...pool].sort(() => Math.random() - 0.5).slice(0, 4);
  shopOffers = picks.map(it => ({ item: it, sold: false }));
}
```
New:
```js
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
```

- [ ] **Step 4: Add the comparison helper + equip rendering + `buyEquipOffer` in `items.js`**

Add these functions (place `equipDelta` and `buyEquipOffer` right after `buyOffer`):

```js
// short comparison string vs. the item currently in the target slot.
// shows stat-mod deltas; for weapons also the average-damage delta.
function equipDelta(item) {
  const slot = targetSlot(item, player.equipment);
  const cur  = player.equipment[slot];
  const parts = [];
  // mod deltas (union of both items' mod keys)
  const keys = new Set([...Object.keys(item.mods || {}), ...Object.keys(cur && cur.mods || {})]);
  for (const k of keys) {
    const d = (item.mods?.[k] || 0) - (cur && cur.mods?.[k] || 0);
    if (d === 0) continue;
    const sign = d > 0 ? '+' : '';
    parts.push(`<span class="${d > 0 ? 'cmp-up' : 'cmp-down'}">${sign}${d}${PCT_STATS.has(k) ? '%' : ''} ${STAT_LABELS[k] || k}</span>`);
  }
  // weapon average-damage delta
  if (item.weapon) {
    const avg = w => w ? (w.damage[0] + w.damage[1]) / 2 : 0;
    const d = Math.round(avg(item.weapon) - avg(cur && cur.weapon));
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
```

- [ ] **Step 5: Rework `renderShop` in `items.js` to draw the slots panel + equip section**

Replace the whole `renderShop` function with:

```js
function renderShop() {
  document.getElementById('shop-gold').textContent = gold;

  // equipped-set panel (8 slots)
  const slotLabels = { weapon: 'WEAPON', offhand: 'OFF-HAND', helm: 'HELM', armor: 'ARMOR',
                       boots: 'BOOTS', ring1: 'RING', ring2: 'RING', amulet: 'AMULET' };
  document.getElementById('shop-slots').innerHTML = EQUIP_SLOTS.map(s => {
    const it = player.equipment[s];
    return `<div class="slot-chip ${it ? 'filled' : 'empty'}" title="${slotLabels[s]}">
        <span class="slot-ico">${it ? (it.icon || '▫') : '·'}</span>
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
```

- [ ] **Step 6: Make reroll refresh both sections (`items.js`)**

`shopReroll` already calls `rollOffers()` (which now rolls both). Confirm the current body is:
```js
function shopReroll() {
  if (gold < rerollCost) return;
  gold -= rerollCost;
  rerollCost += 5;
  rollOffers();
  updateHUD();
  renderShop();
}
```
No change needed if it matches; if `rollOffers()` is missing, add it before `updateHUD()`.

- [ ] **Step 7: Wire the equip-offer click handler in `ui.js`**

Find the existing consumable handler:
```js
document.getElementById('shop-items').addEventListener('click', e => {
  if (e.detail === 0) return;
  const btn = e.target.closest('.shop-item[data-i]');
  if (btn) buyOffer(Number(btn.dataset.i));
});
```
Add an equivalent handler for the equipment section right after it:
```js
document.getElementById('shop-equip').addEventListener('click', e => {
  if (e.detail === 0) return;
  const btn = e.target.closest('.shop-item[data-i]');
  if (btn) buyEquipOffer(Number(btn.dataset.i));
});
```

- [ ] **Step 8: Add CSS in `style.css`**

After the `.shop-item.small span { ... }` rule (end of the Shop Screen section), add:

```css
/* ─── Shop: equipment section ──────────────────────────── */
.shop-left { display: flex; flex-direction: column; gap: 10px; flex: 1; min-width: 0; }

.shop-section-label {
  font-family: var(--display-font);
  font-size: clamp(12px, 1.7vw, 15px);
  color: var(--gold);
  letter-spacing: 0.2em;
  text-align: center;
  margin-top: 4px;
}

.shop-slots {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}
.slot-chip {
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  padding: 6px 4px;
  border: 1px solid var(--bronze);
  background: linear-gradient(180deg, #1b130b, #120c07);
  min-width: 0;
}
.slot-chip.empty { opacity: 0.45; }
.slot-chip .slot-ico { font-size: clamp(14px, 2.2vw, 20px); line-height: 1; }
.slot-chip .slot-lbl {
  font-family: var(--pixel-font);
  font-size: clamp(8px, 1.2vw, 11px);
  color: var(--parchment);
  text-align: center;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;
}

.shop-equip {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.cmp-up   { color: var(--hp-green); font-size: clamp(10px, 1.4vw, 13px); }
.cmp-down { color: var(--hp-low);   font-size: clamp(10px, 1.4vw, 13px); }
.cmp-same { color: rgba(232,220,200,0.5); font-size: clamp(10px, 1.4vw, 13px); }
```

- [ ] **Step 9: Verify syntax + full shop flow in the browser**

Run: `node --check items.js && node --check ui.js` → no output.

Start the server, navigate, then `browser_evaluate`:
```js
() => {
  startGame();
  openShop();
  gold = 999; rollOffers(); renderShop();
  const out = {};
  out.slotsRendered = document.querySelectorAll('#shop-slots .slot-chip').length; // 8
  out.equipOffers   = document.querySelectorAll('#shop-equip .shop-item.offer').length; // up to 4
  out.consumOffers  = document.querySelectorAll('#shop-items .shop-item.offer').length; // up to 4
  // buy the first equipment offer
  const before = shopEquipOffers.find(o => !o.sold);
  buyEquipOffer(shopEquipOffers.indexOf(before));
  const slot = targetSlot(before.item, player.equipment);
  out.equippedName = player.equipment[slot] && player.equipment[slot].name; // == before.item.name
  out.matchesBought = out.equippedName === before.item.name; // true
  out.weaponSynced = player.weapon === player.equipment.weapon; // true
  return out;
}
```
Expected: `slotsRendered=8`, `equipOffers` between 1 and 4, `consumOffers` between 1 and 4, `matchesBought=true`, `weaponSynced=true`. `browser_console_messages` (error): none.

Then a visual check: `browser_resize` to 1100x820, `browser_evaluate` `() => { startGame(); openShop(); gold = 999; rollOffers(); renderShop(); }`, and `browser_take_screenshot` (filename `shop-fase2.png`) to confirm the slots panel, equipment offers (with green/red deltas), consumables and stats all render and fit. Read the screenshot.

- [ ] **Step 10: Commit**

```bash
git add index.html ui.js items.js style.css
git commit --no-verify -m "feat(equip): shop equipment section, slots panel and comparison

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage (design doc §5 + faseamento item 2):**
- "modelo de item" → Task 2 (catalog item shape) + Task 1 (rules). ✔
- "seção de equip na loja" → Task 3 (shop-equip + markup). ✔
- "comprar→equipar" → Task 2 (`equipItem`) + Task 3 (`buyEquipOffer`). ✔
- "comparação" → Task 3 (`equipDelta`). ✔
- "painel de set equipado" → Task 3 (`shop-slots`). ✔
- "filtro de elegibilidade" → Task 1 (`isEligible`) + Task 3 (`rollOffers`). ✔
- "reroll cobre as 2 seções" → Task 3 Step 6. ✔
- 1H/2H/escudo rules → Task 1 (`canEquip`/`equipInto`) + Task 3 (disabled offer). ✔

**2. Placeholder scan:** no "TBD/TODO"; every step has complete code/commands and expected output. The catalog is concrete (not a placeholder). ✔

**3. Type/name consistency:** `archetypeOf`, `isEligible`, `resolveRingSlot`, `targetSlot`, `canEquip`, `equipInto` (Task 1) are used with the same signatures in Tasks 2-3. `EQUIPMENT` item shape (`slot`, `archetype`, `classReq`, `twoHanded`, `mods`, `price`, `weapon`) is consistent between the catalog (Task 2) and the consumers (`equipDelta`, `rollOffers`, `renderShop`). `player.weapon` stays synced to `player.equipment.weapon` on every weapon equip (the Phase 1 review's forward-looking note is resolved: `equipItem` re-syncs on swap). `shopEquipOffers`/`shopOffers` are distinct. ✔

**4. Cross-task safety:** Task 1 is isolated (pure + tests). Task 2 leaves the game runnable (catalog loaded, equipItem usable from console) without changing the visible shop. Task 3 layers the UI on top. Each task ends green and testable. ✔

## Notes
- **Out of scope (Phase 3):** shield *block* mechanic, curated/expanded catalog + balancing, polished icons / on-character sprite for armor & shield, any UI for swapping which ring to replace.
- **Resolves the Phase 1 forward-looking note:** weapon swaps now re-sync `player.weapon` via `equipItem`, so combat/render never read a stale weapon.
