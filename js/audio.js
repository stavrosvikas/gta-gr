// GTA LUBEN — audio. Real files go in assets/sounds/<key>.<ext>; after adding one run `python update_sounds.py`
// (it rebuilds js/sounds_list.js, so the game knows what exists and never probes for missing files).
// Short sounds are decoded once into Web Audio buffers at boot (instant, reliable, many at once);
// long music streams from <audio>. Missing files: voice lines still show as bubbles, SFX fall back to synth beeps.
'use strict';
(function () {
  const A = G.audio = {};
  const LIST = window.SOUND_FILES || {};
  const STREAM_BYTES = 700000; // bigger than this = music, streamed instead of decoded
  let ac = null, master = null;
  const buf = {};      // key -> AudioBuffer (ready) | 'loading'
  const waiters = {};  // key -> [fn] waiting for a buffer
  const streams = {};  // key -> HTMLAudioElement
  A.muted = false;

  A.has = key => key in LIST;
  const url = key => 'assets/sounds/' + key + '.' + LIST[key][0];

  function makeCtx() {
    if (ac) return ac;
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = 0.9; master.connect(ac.destination);
    } catch (e) { ac = null; }
    return ac;
  }

  // ---- loading: fetch every short file now, decode as soon as there is a context ----
  const raw = {};
  function decode(key) {
    if (!ac || !raw[key] || buf[key] instanceof AudioBuffer) return;
    const data = raw[key]; raw[key] = null;
    const done = b => { buf[key] = b; (waiters[key] || []).forEach(f => f(b)); waiters[key] = null; };
    const fail = () => { buf[key] = false; waiters[key] = null; };
    try { const p = ac.decodeAudioData(data, done, fail); if (p && p.catch) p.catch(fail); } catch (e) { fail(); }
  }
  function load(key) {
    if (buf[key] !== undefined) return; buf[key] = 'loading';
    return fetch(url(key)).then(r => { if (!r.ok) throw 0; return r.arrayBuffer(); })
      .then(d => { raw[key] = d; decode(key); })
      .catch(() => { buf[key] = false; });
  }
  // loops + sfx first, voices next; a few at a time so nothing waits behind the whole queue
  const shortKeys = Object.keys(LIST).filter(k => LIST[k][1] <= STREAM_BYTES)
    .sort((a, b) => (/^vo_/.test(a) ? 1 : 0) - (/^vo_/.test(b) ? 1 : 0));
  (function pump(i) {
    const batch = shortKeys.slice(i, i + 6); if (!batch.length) return;
    Promise.all(batch.map(load)).then(() => pump(i + 6));
  })(0);
  makeCtx(); // created suspended; decoding works before the first tap, playback after unlock

  A.unlock = function () {
    makeCtx(); if (!ac) return;
    if (ac.state !== 'running') {
      ac.resume();
      try { const s = ac.createBufferSource(); s.buffer = ac.createBuffer(1, 1, 22050); s.connect(ac.destination); s.start(0); } catch (e) {} // iOS
    }
    Object.keys(raw).forEach(decode);
  };
  let wasRunning = false;
  document.addEventListener('visibilitychange', () => {
    if (!ac) return;
    if (document.hidden) { wasRunning = ac.state === 'running'; ac.suspend(); } else if (wasRunning) ac.resume();
  });
  A.unlocked = () => !!ac && ac.state === 'running';
  // debug: G.audio.status() in the console shows what is ready / still loading / broken
  A.status = () => { const r = { ready: 0, loading: [], failed: [], loops: [...loops.values()].map(l => l.key), state: ac && ac.state }; for (const k of shortKeys) { const b = buf[k]; if (b instanceof AudioBuffer) r.ready++; else if (b === false) r.failed.push(k); else r.loading.push(k); } return r; };

  // ---- playing a buffer ----
  // returns a handle {src, g} or null; if the file is still loading it plays as soon as it is ready (up to `wait` s late)
  function playBuf(key, vol = 1, opt = {}) {
    if (!ac || A.muted || !A.has(key)) return null;
    const b = buf[key];
    const start = bb => {
      const s = ac.createBufferSource(), g = ac.createGain(); s.buffer = bb;
      if (opt.rate) s.playbackRate.value = opt.rate;
      if (opt.loop) { s.loop = true; s.loopStart = Math.min(0.04, bb.duration / 4); s.loopEnd = bb.duration - Math.min(0.04, bb.duration / 4); }
      g.gain.value = vol; s.connect(g);
      let out = g;
      if (opt.pan != null && ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = opt.pan; g.connect(p); out = p; h.p = p; }
      out.connect(master); s.start(0, opt.loop ? s.loopStart : 0);
      h.src = s; h.g = g; return h;
    };
    const h = { src: null, g: null, p: null, key };
    if (b instanceof AudioBuffer) return start(b);
    if (b === false) return null;
    const asked = ac.currentTime, wait = opt.wait == null ? 0.8 : opt.wait;
    (waiters[key] = waiters[key] || []).push(bb => { if (!h.dead && !A.muted && ac.currentTime - asked <= wait) start(bb); });
    if (raw[key]) decode(key);
    return h; // pending handle
  }
  const stopH = (h, fade = 0.05) => {
    if (!h) return; h.dead = true; if (!h.src) return;
    try { const t = ac.currentTime; h.g.gain.cancelScheduledValues(t); h.g.gain.setValueAtTime(h.g.gain.value, t); h.g.gain.linearRampToValueAtTime(0, t + fade); h.src.stop(t + fade + 0.02); } catch (e) {}
  };

  // a key can have numbered variants: sfx_bark, sfx_bark2, sfx_bark3…
  const variants = {};
  function pickVariant(key) {
    if (!variants[key]) { const v = [key]; for (let i = 2; A.has(key + i); i++) v.push(key + i); variants[key] = v.filter(A.has); }
    const v = variants[key]; return v.length ? v[Math.floor(Math.random() * v.length)] : null;
  }

  // ---- synth fallback ----
  function tone(freq, dur, type = 'square', vol = 0.3, slide = 0, delay = 0) {
    if (!ac || A.muted) return;
    const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.linearRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(vol * 0.4, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol = 0.3, delay = 0) {
    if (!ac || A.muted) return;
    const t = ac.currentTime + delay, b = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = ac.createBufferSource(), g = ac.createGain(); s.buffer = b; g.gain.value = vol * 0.4; s.connect(g); g.connect(master); s.start(t);
  }
  const SYN = {
    coin: () => { tone(988, 0.08, 'square', 0.2); tone(1319, 0.15, 'square', 0.2, 0, 0.08); },
    hit: () => { noise(0.15, 0.4); tone(120, 0.15, 'square', 0.3, -60); },
    punch: () => { noise(0.08, 0.5); tone(90, 0.1, 'triangle', 0.4); },
    horn: () => { tone(392, 0.25, 'sawtooth', 0.15); tone(494, 0.25, 'sawtooth', 0.12); },
    crash: () => { noise(0.35, 0.6); tone(70, 0.3, 'square', 0.3, -40); },
    door: () => { tone(220, 0.06, 'square', 0.2); tone(160, 0.08, 'square', 0.2, 0, 0.06); },
    mission_pass: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.2, 'square', 0.2, 0, i * 0.12)); },
    mission_fail: () => { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.25, 'triangle', 0.25, 0, i * 0.15)); },
    star: () => { tone(880, 0.1, 'square', 0.15); tone(660, 0.1, 'square', 0.15, 0, 0.1); },
    siren: () => { tone(700, 0.4, 'sawtooth', 0.06, 300); tone(1000, 0.4, 'sawtooth', 0.06, -300, 0.4); },
    blip: () => tone(600 + Math.random() * 300, 0.04, 'square', 0.08),
    splash: () => noise(0.4, 0.35),
    bark: () => { tone(330, 0.07, 'sawtooth', 0.3, -150); tone(300, 0.08, 'sawtooth', 0.3, -150, 0.12); },
    baa: () => { tone(420, 0.35, 'sawtooth', 0.12, -40); tone(440, 0.35, 'sawtooth', 0.06, -60); },
    tax: () => { tone(200, 0.15, 'square', 0.25); tone(150, 0.3, 'square', 0.25, 0, 0.15); },
    revive: () => { for (let i = 0; i < 8; i++) tone(200 + i * 120, 0.08, 'square', 0.15, 0, i * 0.07); noise(0.3, 0.3, 0.6); },
    zap: () => { tone(1400, 0.2, 'sawtooth', 0.2, -1200); },
    step: () => tone(80, 0.03, 'triangle', 0.08),
    good: () => tone(1046, 0.08, 'square', 0.15),
    bad: () => tone(140, 0.12, 'square', 0.2),
    whoosh: () => noise(0.25, 0.25),
    cheer: () => { noise(0.8, 0.2); },
    meow: () => { tone(700, 0.25, 'triangle', 0.2, 300); },
    hiss: () => noise(0.5, 0.2),
    train_horn: () => { tone(330, 0.6, 'sawtooth', 0.08); tone(415, 0.6, 'sawtooth', 0.06); },
    boat_horn: () => { tone(110, 0.9, 'sawtooth', 0.12); tone(138, 0.9, 'sawtooth', 0.08); },
  };
  A.sfx = function (key, vol = 0.8, pan) {
    if (A.muted) return;
    const k = pickVariant('sfx_' + key);
    if (k && playBuf(k, vol, { pan, wait: 0.3 })) return;
    SYN[key] && SYN[key]();
  };
  // a one-shot coming from a point in the world (lx,ly = where the player hears from)
  A.sfxAt = function (key, x, y, lx, ly, vol = 0.8, range = 420) {
    const d = Math.hypot(x - lx, y - ly); if (d > range) return;
    const k = 1 - d / range; A.sfx(key, vol * k * k, G.clamp((x - lx) / 260, -1, 1) * 0.8);
  };

  // ---- voice lines: always show bubble, play file if exists ----
  A.say = function (key, text, speaker, dur = 2.6) {
    G.ui.bubble(text, speaker, dur);
    if (A.muted) return;
    const k = 'vo_' + String(key).replace(/^vo_/, '');
    if (!playBuf(k, 1, { wait: 1.2 })) { for (let i = 0; i < 4; i++) setTimeout(() => SYN.blip(), i * 70); }
  };

  // ---- streamed long tracks (radio, mini-game music) ----
  function stream(key) {
    if (!A.has(key)) return null;
    if (!streams[key]) { const el = new Audio(); el.preload = 'auto'; el.src = url(key); streams[key] = el; }
    return streams[key];
  }
  function playStream(key, vol, loop) {
    if (A.muted) return null;
    const el = stream(key); if (!el) return null;
    el.loop = loop; el.volume = vol; try { el.currentTime = 0; } catch (e) {}
    const p = el.play(); if (p && p.catch) p.catch(() => {});
    return el;
  }
  // start fetching the music early so the first play is quick
  setTimeout(() => Object.keys(LIST).filter(k => LIST[k][1] > STREAM_BYTES).forEach(stream), 1500);
  // music decoded as a buffer if small (e.g. a 30 s loop) — still exposed through the same API
  function shortMusic(key, vol) {
    const h = playBuf(key, vol, { loop: true, wait: 2 });
    if (!h) return null;
    const t0 = ac.currentTime;
    return { pause() { stopH(h); }, play() {}, get currentTime() { return ac.currentTime - t0; }, set currentTime(v) {}, h };
  }

  let radioEl = null, radioSynth = null;
  A.radio = function (on) {
    if (on) {
      if (radioEl || radioSynth) return;
      const el = playStream('radio_song', 0.6, true) || shortMusic('radio_song', 0.6);
      if (el) { radioEl = el; return; }
      if (!ac) return;
      const notes = [0, 3, 5, 7, 5, 3, 0, -2, 0, 3, 7, 10, 8, 7, 5, 3];
      let i = 0;
      radioSynth = setInterval(() => {
        if (A.muted) return;
        const n = notes[i % notes.length]; tone(294 * Math.pow(2, n / 12), 0.16, 'square', 0.05);
        if (i % 4 === 0) tone(147, 0.25, 'triangle', 0.08);
        i++;
      }, 170);
    } else {
      if (radioEl) { radioEl.pause(); radioEl = null; }
      if (radioSynth) { clearInterval(radioSynth); radioSynth = null; }
    }
  };

  let musicEl = null, musicSynth = null;
  A.music = function (key, bpm = 120) {
    A.stopMusic();
    const el = LIST[key] && LIST[key][1] > STREAM_BYTES ? playStream(key, 0.7, true) : shortMusic(key, 0.7);
    if (el) { musicEl = el; return { file: true, el }; }
    if (!ac) return { file: false };
    const beat = 60000 / bpm / 2; let i = 0;
    const bass = [0, 0, 7, 0, 5, 0, 7, 3];
    musicSynth = setInterval(() => {
      if (A.muted) return;
      if (i % 2 === 0) noise(0.04, 0.15);
      tone(110 * Math.pow(2, bass[i % 8] / 12), 0.12, 'triangle', 0.12);
      if (i % 4 === 2) tone(440 * Math.pow(2, bass[(i + 3) % 8] / 12), 0.1, 'square', 0.04);
      i++;
    }, beat);
    return { file: false };
  };
  A.stopMusic = function () {
    if (musicEl) { musicEl.pause(); try { musicEl.currentTime = 0; } catch (e) {} musicEl = null; }
    if (musicSynth) { clearInterval(musicSynth); musicSynth = null; }
  };
  A.pauseMusic = on => { if (musicEl) { if (on) musicEl.pause(); else { const p = musicEl.play(); if (p && p.catch) p.catch(() => {}); } } };
  A.musicTime = () => musicEl ? musicEl.currentTime : null;

  // ---- continuous sounds that a scene keeps alive by touching them every frame ----
  // A.loop(id, key, vol, rate, pan): start or update; anything not touched in a frame fades out (A.endFrame).
  const loops = new Map(); // id -> {h, key, touched}
  A.loop = function (id, key, vol, rate = 1, pan = 0) {
    if (!ac || A.muted || !A.has(key)) return;
    let L = loops.get(id);
    if (!L || L.key !== key) {
      if (L) stopH(L.h, 0.15);
      const h = playBuf(key, 0, { loop: true, rate, pan, wait: 99 });
      if (!h) return;
      L = { h, key, touched: true, vol: 0 }; loops.set(id, L);
    }
    L.touched = true;
    const h = L.h; if (!h.src) return; // still loading
    const t = ac.currentTime;
    h.g.gain.setTargetAtTime(vol, t, 0.08);
    h.src.playbackRate.setTargetAtTime(rate, t, 0.1);
    if (h.p) h.p.pan.setTargetAtTime(pan, t, 0.1);
  };
  A.endFrame = function () {
    for (const [id, L] of loops) {
      if (L.touched && !A.muted) { L.touched = false; continue; }
      stopH(L.h, 0.25); loops.delete(id);
    }
  };

  // ---- vehicles: each car / bike / bus near the listener sounds from where it is ----
  const MOTO = { moto: 1, scooter: 1, dias: 1, enduro: 1, vespa: 1 };
  const BIG = { bus: 1, truck: 1, garbage: 1, van: 1, sheeptruck: 1, pickup: 1 };
  const SILENT = { bike: 1, heli: 1, boat: 1, ship: 1, train: 1 };
  const engKind = v => SILENT[v.type] ? null : MOTO[v.type] ? 'moto' : BIG[v.type] ? 'big' : 'car';
  let hornCd = 0;
  // lx,ly = listener (the player or the player's vehicle); own = the vehicle the player is on (always heard, close)
  A.engines = function (lx, ly, list, own) {
    if (!ac || A.muted) return;
    const R = 330, near = [];
    for (const v of list) {
      if (!v || v.dead) continue;
      const d = Math.hypot(v.x - lx, v.y - ly);
      const siren = !v.wrecked && ((v.type === 'police' && v.siren) || v.type === 'dias');
      if (siren && d < 700) {
        const k = 1 - d / 700; A.loop(v, 'loop_siren', 0.55 * k * k + (v === own ? 0.1 : 0), 1, G.clamp((v.x - lx) / 260, -1, 1) * 0.8);
      }
      if (v.wrecked || (v.parked && v !== own) || d > R) continue;
      const kind = engKind(v); if (!kind) continue;
      near.push({ v, d, kind });
    }
    near.sort((a, b) => a.d - b.d);
    hornCd -= G.dt || 0.016;
    near.slice(0, 6).forEach(({ v, d, kind }) => {
      const max = (v.spec && v.spec.max) || 220, sp = Math.min(1, Math.abs(v.speed || 0) / max);
      const base = kind === 'big' ? 0.5 : kind === 'moto' ? 0.42 : 0.34;
      let vol, rate;
      if (v === own) { vol = base * (0.75 + sp * 0.5); rate = (kind === 'moto' ? 0.85 : 0.8) + sp * (kind === 'moto' ? 0.95 : 0.75); }
      else { const k = 1 - d / R; vol = base * k * k * (0.55 + sp * 0.6); rate = 0.8 + sp * 0.7; }
      A.loop('e' + (v._sid || (v._sid = Math.random())), 'loop_eng_' + kind, vol, rate, v === own ? 0 : G.clamp((v.x - lx) / 240, -1, 1) * 0.8);
      // a stuck AI driver right behind you leans on the horn (Athens)
      if (v !== own && v.ai && d < 90 && Math.abs(v.speed || 0) < 8 && hornCd <= 0 && Math.random() < 0.02) {
        hornCd = 4; A.sfxAt('horn', v.x, v.y, lx, ly, 0.7);
      }
    });
  };
  // quiet city bed under everything in Athens (the cars on screen carry the detail)
  A.ambience = function (key, vol) { A.loop('amb', key, vol, 1, 0); };
})();
