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
