// GTA LUBEN — life on the town beach (world mod: G.worldMods)
// Five little scenes spread along the sand south of the town. Decorative only: they are not in G.Sim.peds,
// so they can't be punched or run over. Everything is culled when off screen; voice lines only fire when
// the player is close (with cooldowns), sounds only on real events.
//
// VOICE KEYS (assets/sounds/vo_<key>.mp3, recorded later):
//   beach_gtr_more      «Άλλη μία!»
//   beach_gtr_again     «Πάμε απ' την αρχή!»
//   beach_gtr_hum       «♪ ♪ ♪»            (humming along)
//   beach_racket_sorry  «Συγγνώμη!»
//   beach_racket_nice   «Ωραία μπαλιά!»
//   beach_rep_q0..q2    reporter questions (see TV below)
//   beach_sun_a0..a2    sunbather answers
//   beach_buried_0      «Βγάλτε με!»
//   beach_buried_1      «Μου έρχεται φτέρνισμα!»
//   beach_bike_splash   «Πάλι βράχηκα!»
// SFX KEYS (assets/sounds/sfx_<key>.mp3, synth fallback until then):
//   tok (racket hit, quiet, only near the player) · splash (existing key, bike kid hits the water, only near)
'use strict';
(function () {
  const TS = G.TS || 16;
  const INK = 'rgba(28,20,36,0.85)', SHADOW = 'rgba(20,10,30,0.28)';
  const sh = (c, f) => (G.shade ? G.shade(c, f) : c);
  const rr = (x, px, py, w, h, r) => { x.beginPath(); if (x.roundRect) x.roundRect(px, py, w, h, r); else x.rect(px, py, w, h); };
  const vg = (x, y0, y1, a, b) => { const g = x.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, a); g.addColorStop(1, b); return g; };
  const ink = (x, w = 0.6) => { x.lineWidth = w; x.strokeStyle = INK; x.stroke(); };
  const shadow = (x, cx, cy, rx, ry) => { x.fillStyle = SHADOW; x.beginPath(); x.ellipse(cx + 1.5, cy + 1, rx, ry, 0, 0, 7); x.fill(); };
  // capsule limb with ink outline + top-left highlight
  const limb = (x, x1, y1, x2, y2, w, col) => {
    x.lineCap = 'round'; x.beginPath(); x.moveTo(x1, y1); x.lineTo(x2, y2);
    x.strokeStyle = INK; x.lineWidth = w + 0.9; x.stroke(); x.strokeStyle = col; x.lineWidth = w; x.stroke();
    x.beginPath(); x.moveTo(x1 - 0.2, y1 - w * 0.22); x.lineTo(x2 - 0.2, y2 - w * 0.22); x.strokeStyle = sh(col, 0.25); x.lineWidth = w * 0.35; x.stroke();
  };
  const ball = (x, cx, cy, r, col) => {
    const g = x.createRadialGradient(cx - r * 0.4, cy - r * 0.4, r * 0.1, cx, cy, r); g.addColorStop(0, sh(col, 0.4)); g.addColorStop(1, sh(col, -0.25));
    x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); ink(x, 0.5);
  };

  // ---------- shared tiny sound helper (file if present, otherwise a soft synth) ----------
  G.modSfx = G.modSfx || (function () {
    let ac = null, out = null; const have = {};
    const probe = key => { have[key] = !!(G.audio && G.audio.has && G.audio.has('sfx_' + key)); };
    const getAc = () => {
      if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); out = ac.createGain(); out.gain.value = 0.35; out.connect(ac.destination); } catch (e) { ac = null; } }
      if (ac && ac.state === 'suspended') ac.resume(); return ac;
    };
    const f = function (key, vol = 0.5) {
      try {
        if (G.audio && G.audio.muted) return; probe(key);
        if (have[key]) { G.audio.sfx(key, vol); return; }
        const s = f.syn[key]; if (s && getAc()) s(vol);
        else if (!s && G.audio) G.audio.sfx(key, vol);
      } catch (e) {}
    };
    f.syn = {};
    f.tone = (fr, dur, type, vol, slide = 0, delay = 0) => {
      const a = getAc(); if (!a) return; const t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
      o.type = type; o.frequency.setValueAtTime(fr, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, fr + slide), t + dur);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.02);
    };
    f.noise = (dur, vol, freq = 3000, q = 0.8, delay = 0) => {
      const a = getAc(); if (!a) return; const t = a.currentTime + delay, b = a.createBuffer(1, Math.max(1, Math.floor(a.sampleRate * dur)), a.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      const s = a.createBufferSource(), bq = a.createBiquadFilter(), g = a.createGain(); bq.type = 'bandpass'; bq.frequency.value = freq; bq.Q.value = q;
      s.buffer = b; g.gain.value = vol; s.connect(bq); bq.connect(g); g.connect(out); s.start(t);
    };
    return f;
  })();
  const SFX = G.modSfx;
  SFX.syn.tok = v => { SFX.tone(1150, 0.05, 'triangle', 0.22 * v); SFX.tone(700, 0.04, 'sine', 0.15 * v); };

  // ---------- looks (beachwear; women: long hair, female body, bikini colours) ----------
  const L = {
    gtr:   { skin: '#d9a27a', hair: '#1a1410', hairStyle: 'curly', top: '#f4f4f4', topStyle: 'tank', legs: '#2f6bb0', acc: ['beard'] },
    w1:    { skin: '#f0c8a8', hair: '#b08040', hairStyle: 'long', top: '#ff6fa3', topStyle: 'tank', legs: '#ff6fa3', acc: ['lipstick'], female: true, beachLegs: true },
    m2:    { skin: '#c98c62', hair: '#141210', hairStyle: 'buzz', top: '#ffd400', topStyle: 'tank', legs: '#1d4f7a', acc: ['shades'] },
    w2:    { skin: '#e8b48a', hair: '#141210', hairStyle: 'curly_long', top: '#1abc9c', topStyle: 'tank', legs: '#1abc9c', acc: ['earrings'], female: true, beachLegs: true },
    m3:    { skin: '#e0b090', hair: '#7a5230', hairStyle: 'short', top: '#e84a3a', topStyle: 'tshirt', legs: '#e9dcc0', acc: [] },
    rkA:   { skin: '#d9a27a', hair: '#2b1d14', hairStyle: 'short', top: '#3a9ad8', topStyle: 'tank', legs: '#1d2c5a', acc: ['cap:#f4f4f4'] },
    rkB:   { skin: '#f0c8a8', hair: '#4a2e1a', hairStyle: 'ponytail', top: '#ff8a5b', topStyle: 'tank', legs: '#ff8a5b', skirt: false, acc: ['lipstick'], female: true },
    rep:   { skin: '#e8b48a', hair: '#2b1d14', hairStyle: 'slick', top: '#2c3e50', top2: '#ffffff', topStyle: 'suit', legs: '#2c3e50', acc: ['tie:#c0392b'], held: 'mic' },
    cam:   { skin: '#c98c62', hair: '#222', hairStyle: 'short', top: '#3a3a3a', topStyle: 'tshirt', legs: '#2d3446', acc: ['cap:#111', 'beard'] },
    kid:   { skin: '#e8b48a', hair: '#4a2e1a', hairStyle: 'short', top: '#ffd400', topStyle: 'tshirt', legs: '#2f6bb0', acc: ['cap:#e84a3a'] },
  };

  // ---------- sitting person: top half of the HD sprite + folded legs ----------
  function drawSitting(x, look, sx, sy, dir, sway) {
    const s = G.personSprite(look, dir, 0); const lw = s.lw || 18, k = s.width / lw;
    const legCol = look.beachLegs ? look.skin : (look.legs || '#2d3446'), foot = look.skin;
    shadow(x, sx, sy, 8, 2.8);
    const legs = () => {
      if (dir === 0) { limb(x, sx - 5, sy - 1.2, sx + 3.5, sy + 0.6, 2.6, legCol); limb(x, sx + 5, sy - 1.2, sx - 3.5, sy + 0.6, 2.6, legCol); x.fillStyle = foot; x.beginPath(); x.ellipse(sx - 4.6, sy + 0.8, 1.3, 0.9, 0, 0, 7); x.ellipse(sx + 4.6, sy + 0.8, 1.3, 0.9, 0, 0, 7); x.fill(); }
      else if (dir === 3) { limb(x, sx - 3.5, sy - 3, sx - 4.5, sy - 7, 2.6, legCol); limb(x, sx + 3.5, sy - 3, sx + 4.5, sy - 7, 2.6, legCol); }
      else { const d = dir === 2 ? 1 : -1; limb(x, sx, sy - 1.5, sx + d * 4.5, sy - 4.5, 2.7, legCol); limb(x, sx + d * 4.5, sy - 4.5, sx + d * 8, sy - 0.6, 2.4, legCol); x.fillStyle = foot; x.beginPath(); x.ellipse(sx + d * 8.6, sy - 0.3, 1.4, 0.9, 0, 0, 7); x.fill(); }
    };
    if (dir === 3) legs();
    x.save(); x.translate(sx, sy); if (sway) x.rotate(sway);
    const prev = x.imageSmoothingEnabled; x.imageSmoothingEnabled = true;
    x.drawImage(s, 0, 0, s.width, Math.floor(17.6 * k), -lw / 2, -18.6, lw, Math.floor(17.6 * k) / k);
    x.imageSmoothingEnabled = prev; x.restore();
    if (dir !== 3) legs();
  }
  // a standing person, optionally smaller (kids)
  function drawStanding(x, look, sx, sy, dir, frame, scale = 1, lift = 0) {
    if (scale === 1) { G.drawPerson(x, look, sx, sy, dir, frame, { lift }); return; }
    x.save(); x.translate(sx, sy); x.scale(scale, scale); G.drawPerson(x, look, 0, 0, dir, frame, { lift }); x.restore();
  }
  const dirOf = (vx, vy) => Math.abs(vx) > Math.abs(vy) ? (vx > 0 ? 2 : 1) : (vy > 0 ? 0 : 3);

  // ---------- helpers ----------
  const plPos = () => { const p = G.player; if (!p) return null; return p.vehicle || p; };
  const near = (x, y, r) => { const p = plPos(); return !!p && G.dist(p.x, p.y, x, y) < r; };
  const say = (key, text, who, dur) => { try { G.audio.say(key, text, who, dur); } catch (e) {} };
  const onScreen = (x, y, camX, camY, m = 70) => x > camX - m && x < camX + G.W + m && y > camY - m && y < camY + G.H + m;

  // =====================================================================================
  // a) friends with a guitar
  function mkGuitar(cx, cy) {
    const P = [
      { look: L.gtr, dx: 0, dy: -10, dir: 0, gtr: true },
      { look: L.w1, dx: -14, dy: -1, dir: 2 },
      { look: L.m2, dx: 14, dy: -1, dir: 1 },
      { look: L.w2, dx: -7, dy: 10, dir: 3 },
      { look: L.m3, dx: 8, dy: 10, dir: 3 },
    ].map((p, i) => Object.assign(p, { x: cx + p.dx, y: cy + p.dy, i }));
    const g = { kind: 'guitar', cx, cy, P, playing: true, songT: G.rand(22, 34), pauseT: 0, humCd: G.rand(5, 9) };
    g.update = dt => {
      if (g.playing) {
        g.songT -= dt; g.humCd -= dt;
        if (g.humCd < 0) { g.humCd = G.rand(10, 16); if (near(cx, cy, 120)) say('beach_gtr_hum', '♪ ♪ ♪', G.pick(P.slice(1)), 2.2); }
        if (g.songT < 0) { g.playing = false; g.pauseT = G.rand(4, 6); }
      } else {
        g.pauseT -= dt;
        if (g.pauseT < 2.5 && !g.asked) { g.asked = true; if (near(cx, cy, 130)) { if (G.chance(0.7)) say('beach_gtr_more', 'Άλλη μία!', G.pick(P.slice(1)), 2); else say('beach_gtr_again', 'Πάμε απ\' την αρχή!', P[0], 2.2); } }
        if (g.pauseT < 0) { g.playing = true; g.asked = false; g.songT = G.rand(25, 40); g.humCd = G.rand(4, 8); }
      }
    };
    g.ground = (x, camX, camY) => {
      const sx = cx - camX, sy = cy - camY;
      // a big beach blanket under the circle
      x.save(); x.translate(sx, sy); x.rotate(-0.08);
      x.fillStyle = 'rgba(20,10,30,0.16)'; rr(x, -21, -11, 44, 26, 4); x.fill();
      x.fillStyle = vg(x, -13, 13, '#f2e6c8', '#d8c49a'); rr(x, -22, -13, 44, 26, 4); x.fill(); ink(x, 0.5);
      x.save(); rr(x, -22, -13, 44, 26, 4); x.clip(); x.fillStyle = 'rgba(214,72,58,0.55)'; for (let i = -22; i < 22; i += 7) x.fillRect(i, -13, 3, 26); x.restore();
      x.restore();
      // cool box + bottles in the middle
      x.fillStyle = SHADOW; rr(x, sx - 3, sy - 0.5, 9, 5, 1.5); x.fill();
      x.fillStyle = vg(x, sy - 3, sy + 3, '#5ac8fa', '#2a7ab0'); rr(x, sx - 4.5, sy - 3, 9, 6, 1.5); x.fill(); ink(x, 0.5);
      x.fillStyle = '#f4f4f4'; rr(x, sx - 4.5, sy - 3, 9, 2, 1); x.fill();
    };
    g.sprites = (push, camX, camY) => {
      for (const p of P) push(p.y, x => {
        const sx = p.x - camX, sy = p.y - camY, beat = g.playing ? Math.sin(G.t * 4.2 + p.i * 0.9) * 0.035 : 0;
        drawSitting(x, p.look, sx, sy, p.dir, beat);
        if (p.gtr) drawGuitar(x, sx, sy, g.playing);
      });
    };
    return g;
  }
  function drawGuitar(x, sx, sy, playing) {
    x.save(); x.translate(sx + 1, sy - 6); x.rotate(-0.45);
    // neck
    x.fillStyle = '#5a3a20'; rr(x, -13, -0.9, 11, 1.8, 0.6); x.fill(); ink(x, 0.4);
    x.fillStyle = '#3a2414'; rr(x, -15, -1.4, 2.6, 2.8, 0.6); x.fill();
    // body
    const g = x.createRadialGradient(-0.5, -1.5, 0.5, 1, 0, 5); g.addColorStop(0, '#e8b070'); g.addColorStop(1, '#a8642a');
    x.fillStyle = g; x.beginPath(); x.ellipse(1.8, 0, 3.6, 3, 0, 0, 7); x.ellipse(-1.2, 0, 2.7, 2.3, 0, 0, 7); x.fill(); ink(x, 0.5);
    x.fillStyle = '#2a1a10'; x.beginPath(); x.arc(0.2, 0, 1, 0, 7); x.fill();
    x.restore();
    // strumming hand
    const st = playing ? Math.sin(G.t * 13) * 1.3 : 0;
    limb(x, sx + 4.5, sy - 11, sx + 3 + st * 0.3, sy - 6.2 + st, 1.6, L.gtr.skin);
  }

  // =====================================================================================
  // b) beach rackets
  function mkRackets(cx, cy) {
    const A = { look: L.rkA, home: [cx - 24, cy], x: cx - 24, y: cy, dir: 2, anim: 0, swing: 0, side: 1 };
    const B = { look: L.rkB, home: [cx + 24, cy + 2], x: cx + 24, y: cy + 2, dir: 1, anim: 0, swing: 0, side: -1 };
    const b = { x: 0, y: 0, z: 0, x0: 0, y0: 0, z0: 0, x1: 0, y1: 0, z1: 0, s: 0, dur: 0.9, peak: 12, mode: 'fly', to: B, from: A, holder: null, rally: 0 };
    const r = { kind: 'rackets', cx, cy, A, B, b, cd: 0 };
    const hand = p => [p.x + p.side * 6, p.y - 0.5, 10];
    const launch = (from, to, miss) => {
      const h = hand(from); b.x0 = h[0]; b.y0 = h[1]; b.z0 = h[2]; b.from = from; b.s = 0; b.mode = 'fly'; from.swing = 0.25;
      if (miss) { b.to = null; b.x1 = to.x + from.side * G.rand(16, 30); b.y1 = to.y + G.rand(-10, 10); b.z1 = 0; b.dur = 1.05; b.peak = 16; }
      else { const t = hand(to); b.to = to; b.x1 = t[0]; b.y1 = t[1]; b.z1 = t[2]; b.dur = G.rand(0.8, 0.95); b.peak = G.rand(9, 15); }
      if (near(cx, cy, 140)) SFX('tok', 0.35);
    };
    const walkTo = (p, tx, ty, dt, sp) => { const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy); if (d < 1.2) { p.anim = 0; return true; } const m = Math.min(d, sp * dt); p.x += dx / d * m; p.y += dy / d * m; p.anim += dt * 7; p.dir = dirOf(dx, dy); return false; };
    launch(A, B, false);
    r.update = dt => {
      r.cd -= dt; A.swing -= dt; B.swing -= dt;
      if (b.mode === 'fly') {
        b.s += dt / b.dur; const s = Math.min(1, b.s);
        b.x = G.lerp(b.x0, b.x1, s); b.y = G.lerp(b.y0, b.y1, s); b.z = G.lerp(b.z0, b.z1, s) + b.peak * 4 * s * (1 - s);
        if (b.s >= 1) {
          if (b.to) {
            b.rally++;
            if (b.rally > 8 && r.cd < 0 && near(cx, cy, 120) && G.chance(0.3)) { r.cd = 14; say('beach_racket_nice', 'Ωραία μπαλιά!', b.from, 1.8); }
            launch(b.to, b.from, G.chance(b.rally > 3 ? 0.12 : 0.04));
          } else { // missed: the ball lies on the sand, the receiver goes to fetch it
            b.mode = 'ground'; b.z = 0; b.holder = b.from === A ? B : A; b.rally = 0;
            if (r.cd < 0 && near(cx, cy, 120) && G.chance(0.7)) { r.cd = 8; say('beach_racket_sorry', 'Συγγνώμη!', b.from, 1.6); }
          }
        }
      } else if (b.mode === 'ground') {
        const p = b.holder; if (walkTo(p, b.x, b.y + 1, dt, 30)) { b.mode = 'carry'; }
      } else if (b.mode === 'carry') {
        const p = b.holder; b.x = p.x + p.side * 4; b.y = p.y; b.z = 8;
        if (walkTo(p, p.home[0], p.home[1], dt, 26)) { p.dir = p === A ? 2 : 1; launch(p, p === A ? B : A, false); }
      }
      for (const p of [A, B]) if (b.mode === 'fly' && p !== b.holder) p.dir = p === A ? 2 : 1;
      if (b.mode === 'fly') b.holder = null;
    };
    r.sprites = (push, camX, camY) => {
      for (const p of [A, B]) push(p.y, x => {
        const sx = p.x - camX, sy = p.y - camY, fr = p.anim > 0 ? [0, 1, 0, 2][Math.floor(p.anim) % 4] : 0;
        drawStanding(x, p.look, sx, sy, p.dir, fr);
        // wooden racket in the leading hand
        const sw = p.swing > 0 ? Math.sin((0.25 - p.swing) / 0.25 * Math.PI) * 0.9 : 0;
        const side = p.dir === 1 ? -1 : p.dir === 2 ? 1 : p.side;
        const hx = sx + side * 5.5, hy = sy - 9;
        x.save(); x.translate(hx, hy); x.rotate(side * (-0.5 + sw));
        x.strokeStyle = '#6b4a2b'; x.lineWidth = 1; x.lineCap = 'round'; x.beginPath(); x.moveTo(0, 1.5); x.lineTo(0, -1.5); x.stroke();
        const gr = x.createRadialGradient(-0.8, -4.2, 0.3, 0, -3.6, 3); gr.addColorStop(0, '#e8c48a'); gr.addColorStop(1, '#a8743a');
        x.fillStyle = gr; x.beginPath(); x.ellipse(0, -3.8, 2.4, 2.8, 0, 0, 7); x.fill(); ink(x, 0.45);
        x.restore();
      });
      push(b.y + 0.2, x => {
        const sx = b.x - camX, sy = b.y - camY;
        x.fillStyle = 'rgba(20,10,30,0.22)'; x.beginPath(); x.ellipse(sx + 0.5, sy + 0.5, 1.6 - Math.min(0.8, b.z / 30), 0.8, 0, 0, 7); x.fill();
        ball(x, sx, sy - b.z, 1.2, '#d8f03a');
      });
    };
    return r;
  }

  // =====================================================================================
  // c) sunbather + TV crew
  // one short interview, always in this order, so each answer fits its question
  const TVQ = [
    ['Τι σας αρέσει πιο πολύ στην Ελλάδα;', 'Gyros!'],
    ['Μόνο αυτό; Κάτι άλλο;', 'Gyros souvlaki!'],
    ['Και με τι τον τρώτε;', 'Mustard sauce, ha!'],
  ];
  function mkTV(cx, cy) {
    const sun = { x: cx + 11, y: cy + 22 }; // bubble anchor just above her head
    const rep = { look: L.rep, x: cx + 23, y: cy - 1 }, cam = { look: L.cam, x: cx + 38, y: cy + 3 };
    const t = { kind: 'tv', cx, cy, cd: G.rand(1, 3), qi: 0, pending: 0, kick: 0 };
    t.update = dt => {
      t.cd -= dt;
      if (t.pending > 0) { t.pending -= dt; if (t.pending <= 0) say('beach_sun_a' + t.ai, TVQ[t.ai][1], sun, 2.4); }
      if (t.cd < 0 && near(cx + 15, cy, 105)) { t.cd = t.qi % TVQ.length === TVQ.length - 1 ? G.rand(14, 18) : 6; t.ai = t.qi % TVQ.length; say('beach_rep_q' + t.ai, TVQ[t.ai][0], rep, 2.6); t.qi++; t.pending = 2.8; }
    };
    t.ground = (x, camX, camY) => drawSunbather(x, cx - camX, cy - camY);
    t.sprites = (push, camX, camY) => {
      push(rep.y, x => {
        const sx = rep.x - camX, sy = rep.y - camY;
        drawStanding(x, rep.look, sx, sy, 1, 0);
        // mic held out towards her
        const lean = Math.sin(G.t * 1.3) * 0.6;
        limb(x, sx - 2, sy - 11, sx - 7 - lean, sy - 9.5, 1.5, rep.look.top);
        x.strokeStyle = '#222'; x.lineWidth = 1; x.beginPath(); x.moveTo(sx - 7.5 - lean, sy - 9.4); x.lineTo(sx - 9.5 - lean, sy - 10.6); x.stroke();
        ball(x, sx - 10 - lean, sy - 11, 1.3, '#555');
      });
      push(cam.y, x => {
        const sx = cam.x - camX, sy = cam.y - camY;
        drawStanding(x, cam.look, sx, sy, 1, 0);
        // shoulder camera, lens towards her, blinking REC
        x.fillStyle = vg(x, sy - 22, sy - 16, '#4a4a50', '#1d1d22'); rr(x, sx - 8, sy - 22, 11, 5.5, 1.4); x.fill(); ink(x, 0.5);
        x.fillStyle = '#111'; rr(x, sx - 10.5, sy - 21.3, 3, 4, 1); x.fill(); ink(x, 0.4);
        const lg = x.createRadialGradient(sx - 10.4, sy - 20, 0.2, sx - 10, sy - 19.3, 1.6); lg.addColorStop(0, '#9fd8ff'); lg.addColorStop(1, '#1a3a5a');
        x.fillStyle = lg; x.beginPath(); x.ellipse(sx - 10.6, sy - 19.3, 0.8, 1.6, 0, 0, 7); x.fill();
        x.fillStyle = '#2a2a2a'; rr(x, sx - 5, sy - 24, 5, 2, 0.8); x.fill();
        if (Math.floor(G.t * 2) % 2) { x.fillStyle = '#ff3b30'; x.beginPath(); x.arc(sx + 1.5, sy - 20.5, 0.8, 0, 7); x.fill(); }
      });
    };
    return t;
  }
  // she lies face-down on a striped towel, head on her folded arms, feet kicking lazily
  function drawSunbather(x, cx, cy) {
    const skin = '#f6a892', suit = '#e8283c', hair = '#f2dc8a'; // sunburnt tourist
    // towel
    x.fillStyle = 'rgba(20,10,30,0.18)'; rr(x, cx - 16, cy - 4, 34, 11, 2.5); x.fill();
    x.fillStyle = vg(x, cy - 6, cy + 5, '#ffffff', '#e4e8f0'); rr(x, cx - 18, cy - 6, 34, 11, 2.5); x.fill(); ink(x, 0.5);
    x.save(); rr(x, cx - 18, cy - 6, 34, 11, 2.5); x.clip(); x.fillStyle = 'rgba(58,154,216,0.7)'; for (let i = -18; i < 16; i += 6) x.fillRect(cx + i, cy - 6, 2.5, 11); x.restore();
    // props: sunscreen, sunglasses, straw hat
    x.fillStyle = vg(x, cy - 9, cy - 5, '#ffe08a', '#f39c12'); rr(x, cx + 18, cy - 9, 2.2, 5, 1); x.fill(); ink(x, 0.4);
    x.fillStyle = '#e8283c'; rr(x, cx + 18.2, cy - 10, 1.8, 1.4, 0.5); x.fill();
    x.fillStyle = '#1a1a1a'; x.beginPath(); x.ellipse(cx + 19.5, cy + 3, 1.6, 1.1, 0, 0, 7); x.ellipse(cx + 22.5, cy + 3, 1.6, 1.1, 0, 0, 7); x.fill();
    x.fillStyle = vg(x, cy - 13, cy - 7, '#f2dca0', '#c9a45a'); x.beginPath(); x.ellipse(cx - 22, cy - 8, 6, 3.6, 0, 0, 7); x.fill(); ink(x, 0.4);
    x.fillStyle = '#d4b070'; x.beginPath(); x.ellipse(cx - 22, cy - 8.6, 3, 1.9, 0, 0, 7); x.fill(); x.fillStyle = '#e8283c'; x.fillRect(cx - 25, cy - 8.2, 6, 0.9);
    // legs (with the classic lazy feet-kick)
    const k1 = Math.max(0, Math.sin(G.t * 1.1)) * 4, k2 = Math.max(0, Math.sin(G.t * 1.1 + 2.2)) * 4;
    limb(x, cx - 3, cy - 1.8, cx - 9, cy - 2.2, 2.7, skin); limb(x, cx - 9, cy - 2.2, cx - 14 + k1 * 0.4, cy - 2.4 - k1, 2.3, skin);
    limb(x, cx - 3, cy + 1.2, cx - 9, cy + 1.6, 2.7, skin); limb(x, cx - 9, cy + 1.6, cx - 14 + k2 * 0.4, cy + 1.5 - k2, 2.3, skin);
    // body: hips wider, waist narrow, shoulders
    x.fillStyle = vg(x, cy - 4, cy + 4, sh(skin, 0.12), sh(skin, -0.12));
    x.beginPath(); x.moveTo(cx - 4, cy - 3.6); x.quadraticCurveTo(cx + 1, cy - 2.2, cx + 3, cy - 3); x.quadraticCurveTo(cx + 7, cy - 4.6, cx + 8.5, cy - 3.4);
    x.lineTo(cx + 8.5, cy + 2.8); x.quadraticCurveTo(cx + 7, cy + 4, cx + 3, cy + 2.6); x.quadraticCurveTo(cx + 1, cy + 1.8, cx - 4, cy + 3.2);
    x.quadraticCurveTo(cx - 5.4, cy - 0.2, cx - 4, cy - 3.6); x.closePath(); x.fill(); ink(x, 0.55);
    // swimsuit bottom + untied top strap
    x.fillStyle = vg(x, cy - 3.5, cy + 3.5, sh(suit, 0.15), sh(suit, -0.2));
    x.beginPath(); x.moveTo(cx - 4.2, cy - 3.3); x.quadraticCurveTo(cx - 1, cy - 2.6, cx - 0.6, cy - 2.3); x.lineTo(cx - 0.6, cy + 1.9); x.quadraticCurveTo(cx - 1, cy + 2.5, cx - 4.2, cy + 2.9); x.quadraticCurveTo(cx - 5.2, cy - 0.2, cx - 4.2, cy - 3.3); x.fill(); ink(x, 0.45);
    x.strokeStyle = suit; x.lineWidth = 0.7; x.lineCap = 'round';
    x.beginPath(); x.moveTo(cx + 5, cy - 3.9); x.quadraticCurveTo(cx + 4.4, cy - 5.6, cx + 3, cy - 6); x.moveTo(cx + 5, cy + 3.1); x.quadraticCurveTo(cx + 4.4, cy + 4.6, cx + 3.2, cy + 5); x.stroke();
    x.fillStyle = suit; x.beginPath(); x.ellipse(cx + 5.6, cy - 3.6, 1.3, 0.8, 0, 0, 7); x.ellipse(cx + 5.6, cy + 2.9, 1.3, 0.8, 0, 0, 7); x.fill();
    // sunscreen sheen
    x.fillStyle = 'rgba(255,255,255,0.35)'; x.beginPath(); x.ellipse(cx + 4, cy - 1.6, 3, 0.7, -0.1, 0, 7); x.fill();
    // folded arms + head (face down, long blonde hair spread over the shoulders)
    limb(x, cx + 8, cy - 3.4, cx + 12.5, cy - 4.6, 1.9, skin); limb(x, cx + 8, cy + 2.7, cx + 12.5, cy + 3.6, 1.9, skin);
    limb(x, cx + 12.5, cy - 4.6, cx + 13.5, cy + 3.6, 1.8, skin);
    const hg = x.createLinearGradient(cx + 8, cy - 4, cx + 15, cy + 4); hg.addColorStop(0, sh(hair, 0.25)); hg.addColorStop(1, sh(hair, -0.25));
    x.fillStyle = hg; x.beginPath(); x.ellipse(cx + 11.6, cy - 0.4, 3.6, 3.2, 0, 0, 7); x.fill();
    x.beginPath(); x.moveTo(cx + 9, cy - 2.8); x.quadraticCurveTo(cx + 5.5, cy - 1, cx + 5.6, cy + 2.4); x.quadraticCurveTo(cx + 8, cy + 1.2, cx + 9.4, cy + 2.4); x.closePath(); x.fill(); ink(x, 0.45);
    x.strokeStyle = sh(hair, -0.3); x.lineWidth = 0.35; x.beginPath(); x.moveTo(cx + 13, cy - 2.4); x.quadraticCurveTo(cx + 10, cy - 1, cx + 7, cy + 0.8); x.moveTo(cx + 13.5, cy); x.quadraticCurveTo(cx + 10.5, cy + 1, cx + 7.6, cy + 2); x.stroke();
  }

  // =====================================================================================
  // d) kid buried in the sand
  const BURIED = [['beach_buried_0', 'Τέλεια είναι εδώ μέσα!'], ['beach_buried_1', 'Δροσιά!'], ['beach_buried_2', 'Μη με βγάλετε ποτέ!']];
  function mkBuried(cx, cy) {
    const spk = { x: cx, y: cy + 20 };
    const k = { kind: 'buried', cx, cy, cd: G.rand(3, 8), talk: 0, n: 0 };
    k.update = dt => {
      k.cd -= dt; k.talk -= dt;
      if (k.cd < 0 && near(cx, cy, 100)) { k.cd = G.rand(13, 20); const l = BURIED[k.n++ % BURIED.length]; say(l[0], l[1], spk, 2.2); k.talk = 1.6; }
    };
    k.ground = (x, camX, camY) => {
      const sx = cx - camX, sy = cy - camY;
      // bucket + spade
      x.fillStyle = SHADOW; x.beginPath(); x.ellipse(sx + 15, sy + 3, 3.6, 1.4, 0, 0, 7); x.fill();
      x.fillStyle = vg(x, sy - 3, sy + 3, '#5ac8fa', '#1f6fb0'); x.beginPath(); x.moveTo(sx + 11.2, sy - 3); x.lineTo(sx + 16.8, sy - 3); x.lineTo(sx + 16, sy + 2.6); x.lineTo(sx + 12, sy + 2.6); x.closePath(); x.fill(); ink(x, 0.5);
      x.fillStyle = '#e0c890'; x.beginPath(); x.ellipse(sx + 14, sy - 3, 2.8, 0.9, 0, 0, 7); x.fill();
      x.strokeStyle = INK; x.lineWidth = 0.4; x.beginPath(); x.arc(sx + 14, sy - 3, 3.2, Math.PI * 1.1, Math.PI * 1.9); x.stroke();
      x.strokeStyle = '#ffd400'; x.lineWidth = 0.9; x.lineCap = 'round'; x.beginPath(); x.moveTo(sx - 14, sy - 6); x.lineTo(sx - 12.5, sy - 1); x.stroke();
      x.fillStyle = '#e84a3a'; x.beginPath(); x.ellipse(sx - 12.2, sy, 1.6, 1.2, 0.3, 0, 7); x.fill(); ink(x, 0.4);
      // little sand castle
      x.fillStyle = vg(x, sy + 4, sy + 9, '#f0d898', '#c8a860'); rr(x, sx + 8, sy + 5, 6, 4, 0.8); x.fill(); rr(x, sx + 9.5, sy + 3, 3, 3, 0.6); x.fill();
      // the mound with toes peeking out
      x.fillStyle = 'rgba(20,10,30,0.2)'; x.beginPath(); x.ellipse(sx + 1.5, sy + 2, 9.5, 4.2, 0, 0, 7); x.fill();
      const mg = x.createRadialGradient(sx - 3, sy - 2, 1, sx, sy, 10); mg.addColorStop(0, '#f6e2aa'); mg.addColorStop(1, '#cfae68');
      x.fillStyle = mg; x.beginPath(); x.ellipse(sx, sy, 9.5, 4.6, 0, 0, 7); x.fill();
      x.strokeStyle = 'rgba(120,90,40,0.45)'; x.lineWidth = 0.5; x.stroke();
      const wig = Math.sin(G.t * 3) > 0.6 ? 0.5 : 0;
      x.fillStyle = L.kid.skin; x.beginPath(); x.ellipse(sx - 1.5, sy + 4 - wig, 0.9, 0.7, 0, 0, 7); x.ellipse(sx + 1.5, sy + 4 + wig, 0.9, 0.7, 0, 0, 7); x.fill();
    };
    k.sprites = (push, camX, camY) => push(cy - 3, x => {
      const sx = cx - camX, sy = cy - camY - 5, tilt = Math.sin(G.t * 1.7) * 0.12;
      x.save(); x.translate(sx, sy); x.rotate(tilt);
      const hg = x.createRadialGradient(-1.2, -2.2, 0.4, 0, -1, 4); hg.addColorStop(0, sh(L.kid.skin, 0.2)); hg.addColorStop(1, sh(L.kid.skin, -0.18));
      x.fillStyle = hg; x.beginPath(); x.arc(0, -1.5, 3.4, 0, 7); x.fill(); ink(x, 0.5);
      x.fillStyle = L.kid.hair; x.beginPath(); x.arc(0, -2.6, 3.2, Math.PI * 1.02, Math.PI * 1.98); x.fill();
      x.fillStyle = '#e84a3a'; x.beginPath(); x.arc(0, -3, 3.3, Math.PI * 1.05, Math.PI * 1.95); x.fill(); x.fillStyle = '#c0392b'; rr(x, -0.5, -3.6, 5, 1.2, 0.6); x.fill();
      x.fillStyle = '#2a1a1a'; x.beginPath(); x.ellipse(-1.2, -1.3, 0.45, 0.6, 0, 0, 7); x.ellipse(1.2, -1.3, 0.45, 0.6, 0, 0, 7); x.fill();
      if (k.talk > 0 && Math.floor(G.t * 8) % 2) { x.fillStyle = '#7a2a2a'; x.beginPath(); x.ellipse(0, 0.5, 0.9, 0.7, 0, 0, 7); x.fill(); }
      else { x.strokeStyle = '#7a3a2a'; x.lineWidth = 0.4; x.beginPath(); x.arc(0, 0, 0.8, 0.3, Math.PI - 0.3); x.stroke(); }
      x.restore();
    });
    return k;
  }

  // =====================================================================================
  // e) kid on a small bike: rides into the shallow water every 20–40 s, then pushes the bike back
  function mkBike(cx, cy, water) {
    const k = { kind: 'bike', cx, cy, x: cx, y: cy, home: [cx, cy], state: 'idle', t: G.rand(6, 14), a: Math.PI / 2, anim: 0, dir: 0, splash: null, water, wet: 0 };
    const W = G.World;
    const wetAt = (px, py) => { const c = W.get(Math.floor(px / TS), Math.floor(py / TS)); return c === 'w' || c === 'O'; };
    const blockedAt = (px, py) => { const c = W.get(Math.floor(px / TS), Math.floor(py / TS)); return c !== 's' && c !== 'p' && c !== 'w' && c !== 'O' && c !== '.' && c !== '~'; };
    k.update = dt => {
      k.t -= dt; k.wet = Math.max(0, k.wet - dt * 0.1);
      if (k.splash) { k.splash.t += dt; if (k.splash.t > 1.6) k.splash = null; }
      if (k.state === 'idle') {
        k.dir = 0; k.anim = 0;
        if (k.t < 0) { k.state = 'ride'; k.dist = 0; const tx = water ? water[0] : cx, ty = water ? water[1] + 24 : cy + 48; k.a = Math.atan2(ty - cy, tx - cx); }
      } else if (k.state === 'ride') {
        const sp = 46, nx = k.x + Math.cos(k.a) * sp * dt, ny = k.y + Math.sin(k.a) * sp * dt; k.dist += sp * dt;
        k.anim += dt * 9; k.dir = dirOf(Math.cos(k.a), Math.sin(k.a));
        if (wetAt(nx, ny)) {
          k.x = nx; k.y = ny; k.state = 'splash'; k.t = 1.4; k.splash = { x: nx, y: ny, t: 0 }; k.wet = 1;
          if (near(k.x, k.y, 150)) { try { G.audio.sfx('splash', 0.5); } catch (e) {} if (G.chance(0.5)) say('beach_bike_splash', 'Πάλι βράχηκα!', k, 2); }
        } else if (blockedAt(nx, ny) || k.dist > 14 * TS) { k.state = 'back'; k.x = nx; k.y = ny; }
        else { k.x = nx; k.y = ny; }
      } else if (k.state === 'splash') { // keeps pedalling out to sea and sinks out of sight
        k.anim += dt * 6; k.sink = Math.min(1, (k.sink || 0) + dt * 0.45);
        k.x += Math.cos(k.a) * 14 * dt; k.y += Math.sin(k.a) * 14 * dt;
        if (k.sink >= 1) { k.state = 'gone'; k.t = G.rand(12, 22); k.sink = 0; }
      } else if (k.state === 'gone') {
        if (k.t < 0) { // reappear on the sand outside the camera view and ride back to his spot
          const ws = G.worldScene || {}, left = (ws.camX || 0) - 40, right = (ws.camX || 0) + G.W + 40;
          const side = Math.abs(k.home[0] - left) < Math.abs(right - k.home[0]) ? left : right;
          k.x = side; k.y = k.home[1]; k.state = 'back';
        }
      } else if (k.state === 'back') { // rides back along the beach
        const dx = k.home[0] - k.x, dy = k.home[1] - k.y, d = Math.hypot(dx, dy);
        if (d < 1.5) { k.x = k.home[0]; k.y = k.home[1]; k.state = 'idle'; k.t = G.rand(10, 20); k.a = Math.PI / 2; }
        else { const m = Math.min(d, 40 * dt); k.x += dx / d * m; k.y += dy / d * m; k.a = Math.atan2(dy, dx); k.anim += dt * 9; k.dir = dirOf(dx, dy); }
      }
    };
    k.ground = (x, camX, camY) => {
      const s = k.splash; if (!s) return;
      const sx = s.x - camX, sy = s.y - camY;
      for (let i = 0; i < 3; i++) { const r = (s.t * 14 + i * 4); const al = Math.max(0, 0.7 - s.t * 0.45 - i * 0.12); if (al <= 0) continue; x.strokeStyle = `rgba(255,255,255,${al})`; x.lineWidth = 0.8; x.beginPath(); x.ellipse(sx, sy, r, r * 0.45, 0, 0, 7); x.stroke(); }
    };
    k.sprites = (push, camX, camY) => {
      if (k.state === 'gone') return;
      push(k.y, x => {
        const sx = k.x - camX, sy = k.y - camY;
        const riding = k.state === 'ride' || k.state === 'idle' || k.state === 'back';
        const bx = riding ? sx : sx + (k.dir === 1 ? 0 : k.dir === 2 ? 0 : 5), by = riding ? sy : sy + (k.dir === 1 || k.dir === 2 ? 3 : 0);
        const ang = k.state === 'splash' ? k.a + 0.5 : k.a;
        if (k.state !== 'splash') drawBike(x, bx, by - 1, ang);
        if (riding) {
          drawStanding(x, L.kid, sx, sy, k.dir, k.state === 'ride' ? [1, 2][Math.floor(k.anim) % 2] : 0, 0.72, 3);
        } else {
          const inWater = k.state === 'splash';
          if (inWater) { x.save(); x.beginPath(); x.rect(sx - 12, sy - 30, 24, 27 - (k.sink || 0) * 22); x.clip(); }
          drawStanding(x, L.kid, sx, sy, k.dir, inWater ? 0 : [0, 1, 0, 2][Math.floor(k.anim) % 4], 0.72);
          if (inWater) { x.restore(); if ((k.sink || 0) < 0.4) drawBike(x, sx + 6, sy + 1, ang, 0.55); }
        }
        if (k.splash && k.splash.t < 1) { // droplets
          const s = k.splash, px = s.x - camX, py = s.y - camY;
          x.fillStyle = 'rgba(220,240,255,0.85)';
          for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + (i - 3) * 0.38, v = 26 + (i % 3) * 8, tt = s.t; const dx = Math.cos(a) * v * tt, dy = Math.sin(a) * v * tt + 60 * tt * tt; if (dy > 2) continue; x.beginPath(); x.arc(px + dx, py - 4 + dy, 0.9, 0, 7); x.fill(); }
        }
      });
    };
    return k;
  }
  // small top-down kid bike, oriented along angle a (alpha < 1 when half under water)
  function drawBike(x, sx, sy, a, alpha = 1) {
    x.save(); x.globalAlpha *= alpha; x.translate(sx, sy); x.rotate(a);
    x.fillStyle = 'rgba(20,10,30,0.22)'; rr(x, -6, -0.5, 12, 3, 1.5); x.fill();
    x.fillStyle = '#1d1d22'; rr(x, 2.2, -0.9, 5, 1.8, 0.9); x.fill(); rr(x, -7.2, -0.9, 5, 1.8, 0.9); x.fill();
    x.strokeStyle = '#2f9ad8'; x.lineWidth = 1.2; x.lineCap = 'round'; x.beginPath(); x.moveTo(-4.5, 0); x.lineTo(4.5, 0); x.stroke();
    x.strokeStyle = '#888'; x.lineWidth = 0.8; x.beginPath(); x.moveTo(3.8, -3); x.lineTo(3.8, 3); x.stroke();
    x.fillStyle = '#222'; x.beginPath(); x.ellipse(-2.2, 0, 1.4, 0.9, 0, 0, 7); x.fill();
    x.restore();
  }

  // =====================================================================================
  // find spots on the town beach at runtime (the sand is being reshaped by others)
  function findSpots() {
    const W = G.World; if (!W || !W.get || !W.t) return [];
    const isS = (x, y) => W.get(x, y) === 's';
    const okArea = (x, y) => { let a = ''; try { a = W.area(x, y); } catch (e) {} return a === 'town' || (y < 95 && x < 100); };
    const cands = [];
    for (let y = 40; y < 96; y++) for (let x = 2; x < 100; x++) {
      if (!isS(x, y) || !okArea(x, y)) continue;
      if (W.propAt && W.propAt(x, y)) continue;
      let n = 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (isS(x + dx, y + dy)) n++;
      if (n >= 14) cands.push({ x, y, n });
    }
    return cands;
  }
  function waterNear(tx, ty, R = 10) {
    const W = G.World; let best = null, bd = 1e9, bestO = null, bo = 1e9;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const c = W.get(tx + dx, ty + dy), d = Math.hypot(dx, dy * 1.2);
      if (c === 'w' && d < bd) { bd = d; best = [tx + dx, ty + dy]; }
      if (c === 'O' && d < bo) { bo = d; bestO = [tx + dx, ty + dy]; }
    }
    const r = best || bestO; return r ? { t: r, d: best ? bd : bo } : null;
  }
  const ROLES = ['guitar', 'rackets', 'tv', 'buried', 'bike'];
  function place() {
    const cands = findSpots(); if (!cands.length) return [];
    const W = G.World, isS = (x, y) => W.get(x, y) === 's';
    let xa = 1e9, xb = -1e9; for (const c of cands) { xa = Math.min(xa, c.x); xb = Math.max(xb, c.x); }
    const room = {
      guitar: c => isS(c.x - 1, c.y) && isS(c.x + 1, c.y) && isS(c.x, c.y - 1) && isS(c.x, c.y + 1),
      rackets: c => [-3, -2, -1, 1, 2, 3].every(d => isS(c.x + d, c.y)),
      tv: c => [-1, 1, 2, 3].every(d => isS(c.x + d, c.y)),
      buried: c => isS(c.x + 1, c.y) && isS(c.x - 1, c.y),
      bike: () => true,
    };
    const chosen = [], out = [];
    for (let i = 0; i < ROLES.length; i++) {
      const role = ROLES[i], target = xa + (i + 0.5) * (xb - xa) / ROLES.length;
      let best = null, bs = 1e9;
      for (const minD of [10, 6, 3]) {
        for (const c of cands) {
          if (!room[role](c)) continue;
          if (chosen.some(o => Math.hypot(o.x - c.x, o.y - c.y) < minD)) continue;
          let s = Math.abs(c.x - target) + (25 - c.n) * 0.8;
          if (role === 'bike') { c.w = c.w !== undefined ? c.w : waterNear(c.x, c.y); s += c.w ? Math.abs(c.w.d - 4) * 2 : 60; }
          if (s < bs) { bs = s; best = c; }
        }
        if (best) break;
      }
      if (!best) continue;
      chosen.push(best);
      const px = best.x * TS + 8, py = best.y * TS + 9;
      let g = null;
      if (role === 'guitar') g = mkGuitar(px, py);
      else if (role === 'rackets') g = mkRackets(px, py);
      else if (role === 'tv') g = mkTV(px - 6, py);
      else if (role === 'buried') g = mkBuried(px, py);
      else { const w = best.w || waterNear(best.x, best.y); g = mkBike(px, py, w ? [w.t[0] * TS + 8, w.t[1] * TS + 8] : null); }
      out.push(g);
    }
    return out;
  }

  // =====================================================================================
  const groups = [];
  const vis = (g, camX, camY) => onScreen(g.cx, g.cy, camX, camY, 90) || (g.kind === 'bike' && onScreen(g.x, g.y, camX, camY, 60));
  const safe = (g, fn) => { try { fn(); } catch (e) { if (!g._err) { g._err = 1; console.error('beach', g.kind, e); } } };
  const mod = {
    id: 'beach',
    reset() { groups.length = 0; try { groups.push(...place()); } catch (e) { console.error('beach reset', e); } },
    update(dt) {
      if (!groups.length) return;
      const ws = G.worldScene || {}, camX = ws.camX || 0, camY = ws.camY || 0;
      for (const g of groups) {
        // things far away just wait (the bike kid keeps going so he isn't frozen mid-ride)
        if (g.kind !== 'bike' && !onScreen(g.cx, g.cy, camX, camY, 260)) continue;
        safe(g, () => g.update(dt));
      }
    },
    ground(ctx, camX, camY) { for (const g of groups) if (g.ground && vis(g, camX, camY)) safe(g, () => g.ground(ctx, camX, camY)); },
    sprites(push, camX, camY) { for (const g of groups) if (vis(g, camX, camY)) safe(g, () => g.sprites(push, camX, camY)); },
    interact() { return null; },
    groups,
  };
  G.beach = mod;
  G.worldMods = G.worldMods || [];
  G.worldMods.push(mod);
})();
