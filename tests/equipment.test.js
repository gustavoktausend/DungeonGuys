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
