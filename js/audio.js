// GTA LUBEN — audio. Real files go in assets/sounds/<key>.mp3 (see SOUNDS.md).
// If a file is missing, voice lines still show as speech bubbles and SFX fall back to synth beeps.
'use strict';
(function () {
  const A = G.audio = {};
  let ac = null, master = null;
  const files = {};   // key -> HTMLAudioElement or false (missing)
  A.muted = false;

  A.unlock = function () {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = 0.35; master.connect(ac.destination); } catch (e) {}
  };

  // try load a real file once
  function file(key) {
    if (key in files) return files[key];
    const el = new Audio(); let tried = 0; const exts = ['mp3', 'wav', 'ogg', 'm4a'];
    files[key] = null; // loading
    const next = () => {
      if (tried >= exts.length) { files[key] = false; return; }
      el.src = 'assets/sounds/' + key + '.' + exts[tried++];
    };
    el.addEventListener('canplaythrough', () => { files[key] = el; }, { once: true });
    el.addEventListener('error', next);
    el.preload = 'auto'; next();
    return null;
  }
  A.preload = keys => keys.forEach(file);

  function playFile(key, vol = 1, loop = false) {
    const f = file(key);
    if (!f) return null;
    const el = loop ? f : f.cloneNode();
    el.volume = A.muted ? 0 : vol; el.loop = loop;
    el.currentTime = 0; el.play().catch(() => {});
    return el;
  }

  // ---- synth ----
  function tone(freq, dur, type = 'square', vol = 0.3, slide = 0, delay = 0) {
    if (!ac || A.muted) return;
    const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.linearRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol = 0.3, delay = 0) {
    if (!ac || A.muted) return;
    const t = ac.currentTime + delay, b = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = ac.createBufferSource(), g = ac.createGain(); s.buffer = b; g.gain.value = vol; s.connect(g); g.connect(master); s.start(t);
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
  A.sfx = function (key, vol = 0.8) {
    if (A.muted) return;
    if (playFile('sfx_' + key, vol)) return;
    SYN[key] && SYN[key]();
  };

  // ---- voice lines: always show bubble, play file if exists ----
  // speaker: entity with x,y (world) or null for HUD subtitle
  A.say = function (key, text, speaker, dur = 2.6) {
    G.ui.bubble(text, speaker, dur);
    if (A.muted) return;
    const el = playFile('vo_' + String(key).replace(/^vo_/, ''), 1);
    if (!el) { for (let i = 0; i < 4; i++) setTimeout(() => SYN.blip(), i * 70); }
  };

  // ---- radio: one song on repeat ----
  let radioEl = null, radioSynth = null;
  A.radio = function (on) {
    if (on) {
      if (radioEl || radioSynth) return;
      const el = playFile('radio_song', 0.6, true);
      if (el) { radioEl = el; return; }
      // placeholder chiptune loop (generic, not the real song)
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

  // ---- music loops for mini-games (dance etc) ----
  let musicEl = null, musicSynth = null;
  A.music = function (key, bpm = 120) {
    A.stopMusic();
    const el = playFile(key, 0.7, true);
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
    if (musicEl) { musicEl.pause(); musicEl.currentTime = 0; musicEl = null; }
    if (musicSynth) { clearInterval(musicSynth); musicSynth = null; }
  };
  A.pauseMusic = on => { if (musicEl) { if (on) musicEl.pause(); else musicEl.play().catch(() => {}); } };
  A.musicTime = () => musicEl ? musicEl.currentTime : null;
})();
