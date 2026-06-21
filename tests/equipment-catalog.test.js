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
