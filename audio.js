// audio.js — procedural WebAudio sound engine for DungeonGuys (no audio assets)
const Sfx = (() => {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let muted = false;
  let musicOn = false;
  let musicTimer = null;
  let noiseBuf = null;
  let step = 0;
  let nextNoteTime = 0;
  const lastPlayed = {};

  function init() {
    if (ctx) { resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.2;
    musicGain.connect(master);
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  // one-shot oscillator with a quick attack/decay envelope
  function tone(o) {
    const t0 = o.at !== undefined ? o.at : ctx.currentTime + (o.delay || 0);
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(o.freq, t0);
    if (o.slide) osc.frequency.linearRampToValueAtTime(Math.max(20, o.freq + o.slide), t0 + o.dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(o.vol, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + o.dur);
    osc.connect(g).connect(o.dest || master);
    osc.start(t0);
    osc.stop(t0 + o.dur + 0.02);
  }

  // filtered white-noise burst (whooshes, impacts, hats)
  function noise(o) {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t0  = o.at !== undefined ? o.at : ctx.currentTime + (o.delay || 0);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = o.filter || 'bandpass';
    f.frequency.setValueAtTime(o.freq || 1000, t0);
    if (o.slide) f.frequency.linearRampToValueAtTime(Math.max(40, (o.freq || 1000) + o.slide), t0 + o.dur);
    f.Q.value = 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(o.vol, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + o.dur);
    src.connect(f).connect(g).connect(o.dest || master);
    src.start(t0);
    src.stop(t0 + o.dur + 0.02);
  }

  const SOUNDS = {
    shoot:     () => tone({ freq: 740, type: 'square', dur: 0.09, vol: 0.15, slide: -350 }),
    arrow:     () => noise({ dur: 0.12, vol: 0.18, freq: 2800, slide: -1800 }),
    swing:     () => noise({ dur: 0.14, vol: 0.2, freq: 1000, slide: -650 }),
    hit:       () => { tone({ freq: 200, type: 'triangle', dur: 0.06, vol: 0.22, slide: -70 });
                       noise({ dur: 0.04, vol: 0.1, freq: 500 }); },
    death:     () => tone({ freq: 320, type: 'sawtooth', dur: 0.22, vol: 0.2, slide: -240 }),
    coin:      () => { tone({ freq: 1318, dur: 0.05, vol: 0.15 });
                       tone({ freq: 1760, dur: 0.1, vol: 0.15, delay: 0.05 }); },
    potion:    () => { tone({ freq: 520, type: 'triangle', dur: 0.1, vol: 0.2, slide: 200 });
                       tone({ freq: 780, type: 'triangle', dur: 0.12, vol: 0.18, delay: 0.08, slide: 150 }); },
    levelup:   () => [523, 659, 784, 1047].forEach((f, i) =>
                       tone({ freq: f, dur: 0.1, vol: 0.18, delay: i * 0.07 })),
    hurt:      () => { tone({ freq: 130, type: 'sawtooth', dur: 0.18, vol: 0.3, slide: -50 });
                       noise({ dur: 0.1, vol: 0.12, freq: 300 }); },
    dodge:     () => noise({ dur: 0.08, vol: 0.12, freq: 4000, slide: -1000 }),
    special:   () => tone({ freq: 220, type: 'sawtooth', dur: 0.3, vol: 0.22, slide: 500 }),
    explosion: () => { noise({ dur: 0.4, vol: 0.4, freq: 250, slide: -180, filter: 'lowpass' });
                       tone({ freq: 90, type: 'sine', dur: 0.35, vol: 0.35, slide: -50 }); },
    chest:     () => { tone({ freq: 392, dur: 0.08, vol: 0.16 });
                       tone({ freq: 587, dur: 0.12, vol: 0.16, delay: 0.08 }); },
    mimic:     () => tone({ freq: 180, type: 'sawtooth', dur: 0.35, vol: 0.25, slide: -120 }),
    upgrade:   () => [392, 523, 784].forEach((f, i) =>
                       tone({ freq: f, dur: 0.12, vol: 0.2, delay: i * 0.09 })),
    buy:       () => { tone({ freq: 988, dur: 0.06, vol: 0.16 });
                       tone({ freq: 660, type: 'triangle', dur: 0.08, vol: 0.18, delay: 0.05 }); },
    click:     () => tone({ freq: 700, dur: 0.035, vol: 0.1 }),
    waveclear: () => [659, 880].forEach((f, i) =>
                       tone({ freq: f, dur: 0.16, vol: 0.18, delay: i * 0.12 })),
    bosshorn:  () => { tone({ freq: 110, type: 'sawtooth', dur: 0.7, vol: 0.28 });
                       tone({ freq: 111.2, type: 'sawtooth', dur: 0.7, vol: 0.18 }); // detune beat
                       tone({ freq: 55, type: 'sine', dur: 0.7, vol: 0.25 }); },
    gameover:  () => [392, 311, 233].forEach((f, i) =>
                       tone({ freq: f, type: 'triangle', dur: 0.3, vol: 0.22, delay: i * 0.25 })),
    victory:   () => [523, 659, 784, 1047, 1319].forEach((f, i) =>
                       tone({ freq: f, dur: 0.18, vol: 0.2, delay: i * 0.13 })),
  };

  function play(name) {
    if (!ctx || muted || !SOUNDS[name]) return;
    resume();
    const now = performance.now();
    if (lastPlayed[name] && now - lastPlayed[name] < 50) return; // rate limit spam
    lastPlayed[name] = now;
    SOUNDS[name]();
  }

  // ── background music: dark 32-step chiptune loop in A minor ─────────────────
  const STEP = 0.16; // seconds per 16th-ish step (~94 bpm)
  const BASS = [
    110.00, 0, 0, 110.00,  0, 0, 110.00, 0,   87.31, 0, 0, 87.31,  0, 0, 87.31, 0,
    103.83, 0, 0, 103.83,  0, 0, 103.83, 0,   98.00, 0, 0, 98.00,  0, 0, 123.47, 0,
  ];
  const LEAD = [
    0, 0, 440.00, 0,  523.25, 0, 0, 440.00,  0, 349.23, 0, 0,  440.00, 0, 0, 0,
    0, 0, 415.30, 0,  523.25, 0, 0, 622.25,  0, 0, 587.33, 0,  493.88, 0, 0, 0,
  ];

  function scheduleStep(s, at) {
    const b = BASS[s % BASS.length];
    if (b) tone({ freq: b, type: 'triangle', dur: STEP * 1.8, vol: 0.5, at, dest: musicGain });
    const l = LEAD[s % LEAD.length];
    if (l) tone({ freq: l, type: 'square', dur: STEP * 1.1, vol: 0.14, at, dest: musicGain });
    if (s % 4 === 2) noise({ dur: 0.03, vol: 0.05, freq: 6000, at, dest: musicGain }); // hat
  }

  function startMusic() {
    if (!ctx || musicOn) return;
    resume();
    musicOn = true;
    step = 0;
    nextNoteTime = ctx.currentTime + 0.1;
    musicTimer = setInterval(() => {
      while (nextNoteTime < ctx.currentTime + 0.25) {
        scheduleStep(step, nextNoteTime);
        nextNoteTime += STEP;
        step++;
      }
    }, 60);
  }

  function stopMusic() {
    musicOn = false;
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
  }

  function setMuted(m) {
    muted = m;
    if (master) master.gain.value = m ? 0 : 0.5;
  }

  return { init, play, startMusic, stopMusic, setMuted, get muted() { return muted; } };
})();
