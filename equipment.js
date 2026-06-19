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

// expose for Node tests; harmless in the browser (no `module` global there)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { EQUIP_SLOTS, emptyEquipment, sumEquipmentMods, computeEffectiveStats, effectiveMaxHp,
                     archetypeOf, isEligible, resolveRingSlot, targetSlot, canEquip, equipInto };
}
