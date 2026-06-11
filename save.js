// save.js — unified persistent storage for DungeonGuys
// One JSON blob in localStorage holds settings, per-class records, and
// progress/unlocks. Legacy dg_* keys are migrated on first load.
const Save = (() => {
  const KEY = 'dungeonguys_save_v1';

  const defaults = () => ({
    settings: { mute: false, autoAim: false, name: '', colors: {}, mode: 'campaign' },
    records:  {}, // per class: { score, wave, level, victories }
    progress: {
      runs: 0, kills: 0, goldEarned: 0, bossKills: 0, victories: 0,
      unlocked: ['mage', 'archer', 'warrior'],
      soulGold: 0,
      forge: {}, // upgrade key -> level
    },
  });

  let data = defaults();

  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {}
  }

  function migrateLegacy() {
    try {
      const colors = localStorage.getItem('dg_colors');
      if (colors) data.settings.colors = JSON.parse(colors) || {};
      data.settings.name    = localStorage.getItem('dg_name') || '';
      data.settings.mute    = localStorage.getItem('dg_mute') === '1';
      data.settings.autoAim = localStorage.getItem('dg_autoaim') === '1';
      ['dg_colors', 'dg_name', 'dg_mute', 'dg_autoaim'].forEach(k => localStorage.removeItem(k));
      persist();
    } catch (e) {}
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        data = defaults();
        Object.assign(data.settings, parsed.settings);
        Object.assign(data.progress, parsed.progress);
        data.records = parsed.records || {};
      } else {
        migrateLegacy();
      }
    } catch (e) { data = defaults(); }
  }

  function classRecord(cls) {
    return data.records[cls] || null;
  }

  // registers a finished run; returns true when it set a new class score record
  function recordRun(cls, run) { // { score, wave, level, won, kills, gold }
    data.progress.runs++;
    data.progress.kills      += run.kills;
    data.progress.goldEarned += run.gold;
    if (run.won) data.progress.victories++;

    const prev    = data.records[cls];
    const newBest = run.score > 0 && (!prev || run.score > prev.score);
    const r = prev || { score: 0, wave: 0, level: 0, victories: 0 };
    r.score = Math.max(r.score, run.score);
    r.level = Math.max(r.level, run.level);
    if (run.mode === 'endless') r.ewave = Math.max(r.ewave || 0, run.wave);
    else                        r.wave  = Math.max(r.wave, run.wave);
    if (run.won) r.victories = (r.victories || 0) + 1;
    data.records[cls] = r;
    persist();
    return newBest;
  }

  function isUnlocked(cls) {
    return data.progress.unlocked.includes(cls);
  }

  function unlock(cls) {
    if (isUnlocked(cls)) return false;
    data.progress.unlocked.push(cls);
    persist();
    return true;
  }

  load();
  return { get data() { return data; }, persist, recordRun, classRecord, isUnlocked, unlock };
})();
