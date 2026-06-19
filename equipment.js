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
