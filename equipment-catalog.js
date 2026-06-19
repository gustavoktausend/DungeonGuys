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
