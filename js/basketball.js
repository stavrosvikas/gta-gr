// GTA LUBEN — outdoor half-court with one hoop (world mod: G.worldMods)
// Walk to the ball: «Πάρε την μπάλα» (ENTER / ΜΠΕΣ). With the ball you dribble while walking.
// Shoot: hold ENTER/ΜΠΕΣ (or SPACE/ΣΠΡΩΞΕ), a power bar fills and empties; release inside the green band.
// The band is smaller (and higher) the further you are; outside the arc a basket is worth 3.
//
// FLAGS / API for the lead:
//   G.bballHolding  true while the player holds the ball (also while charging a shot).
//                   worldscene should skip "enter vehicle" (and punching on 'action') while it's true.
//   G.bball.drop()  drop the ball where the player stands (e.g. before cutscenes / quests).
//   G.bball.drawSurface = false   if world.js already paints the court surface + lines itself.
// Court: G.World.COURT = {x, y, w, h, hoop:[px,py]} (tiles; hoop = world px of the rim, on the ground).
//
// VOICE KEYS: none (only toasts).
// SFX KEYS (assets/sounds/sfx_<key>.mp3, synth fallback until then; all only when the ball is near the camera):
//   ball_bounce (dribble / loose bounces, quiet) · ball_swish (clean basket) · ball_rim (rim / backboard)
'use strict';
(function () {
  const TS = G.TS || 16;
  const INK = 'rgba(28,20,36,0.85)', SHADOW = 'rgba(20,10,30,0.28)';
  const sh = (c, f) => (G.shade ? G.shade(c, f) : c);
  const rr = (x, px, py, w, h, r) => { x.beginPath(); if (x.roundRect) x.roundRect(px, py, w, h, r); else x.rect(px, py, w, h); };
  const vg = (x, y0, y1, a, b) => { const g = x.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, a); g.addColorStop(1, b); return g; };
  const ink = (x, w = 0.6) => { x.lineWidth = w; x.strokeStyle = INK; x.stroke(); };

  // ---------- shared tiny sound helper (same as beach.js; whichever loads first defines it) ----------
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
  SFX.syn.ball_bounce = v => { SFX.tone(150, 0.09, 'sine', 0.5 * v, -80); SFX.noise(0.04, 0.12 * v, 900, 1); };
  SFX.syn.ball_swish = v => { SFX.noise(0.28, 0.35 * v, 5200, 0.6); };
  SFX.syn.ball_rim = v => { SFX.tone(540, 0.22, 'triangle', 0.25 * v); SFX.tone(820, 0.16, 'sine', 0.12 * v, 0, 0.01); };

  const RIMH = 22;        // rim height above the ground (px)
  const GRAV = 320;
  let C = null;           // court in world px: { x0,y0,x1,y1, hx,hy, nx,ny, base, r3, cx,cy }
  const B = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, state: 'ground', spin: 0 };
  const P = { holding: false, charging: false, power: 0, pt: 0, dribble: 0, lastSin: 0, pickT: 0, made: 0, pts: 0, flight: null, toastCd: 0, hintT: 0 };

  function courtFromWorld() {
    let c = null; try { c = G.World && G.World.COURT; } catch (e) {}
    const k = (c && c.w > 0 && c.h > 0) ? c : { x: 49, y: 60, w: 8, h: 6 };
    const hp = (c && c.ground) ? c.ground : (c && c.hoop) ? c.hoop : (c ? [(c.x + c.w / 2) * TS, c.y * TS + 10] : [53 * TS, 60 * TS + 10]);
    const x0 = k.x * TS, y0 = k.y * TS, x1 = (k.x + k.w) * TS, y1 = (k.y + k.h) * TS, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const hx = hp[0], hy = hp[1];
    // which side is the hoop on: the normal points from the hoop into the court
    const dl = hx - x0, dr = x1 - hx, dt = hy - y0, db = y1 - hy, m = Math.min(dl, dr, dt, db);
    let nx = 0, ny = 1, base = dt;
    if (m === dt) { nx = 0; ny = 1; base = dt; } else if (m === db) { nx = 0; ny = -1; base = db; }
    else if (m === dl) { nx = 1; ny = 0; base = dl; } else { nx = -1; ny = 0; base = dr; }
    base = Math.max(4, base);
    const depth = ny ? (y1 - y0) : (x1 - x0), width = ny ? (x1 - x0) : (y1 - y0);
    const r3 = Math.max(36, Math.min(width / 2 - 6, depth - base - 12));
    return { x0, y0, x1, y1, cx, cy, hx, hy, nx, ny, base, r3, depth, width };
  }
  const spot = () => [C.hx + C.nx * (C.r3 * 0.55) + (C.ny ? 14 : 0), C.hy + C.ny * (C.r3 * 0.55) + (C.nx ? 10 : 0)];
  const placeBall = () => { const s = spot(); Object.assign(B, { x: s[0], y: s[1], z: 0, vx: 0, vy: 0, vz: 0, state: 'ground' }); };
  const pl = () => G.player;
  const onFoot = () => !!G.player && !G.player.vehicle;
  const inCourt = (x, y, m = 0) => !!C && x > C.x0 - m && x < C.x1 + m && y > C.y0 - m && y < C.y1 + m;
  const camNear = (x, y, m = 40) => { const ws = G.worldScene; if (!ws) return false; return x > ws.camX - m && x < ws.camX + G.W + m && y > ws.camY - m && y < ws.camY + G.H + m; };
  const toast = (t, d) => { try { G.ui.toast(t, d); } catch (e) {} };
  const setHold = v => { P.holding = v; G.bballHolding = v; if (!v) { P.charging = false; P.power = 0; } };

  // ---------- shooting ----------
  function shotParams(px, py) {
    const d = G.dist(px, py, C.hx, C.hy), f = G.clamp(d / 150, 0, 1);
    return { d, center: 0.38 + 0.5 * f, half: G.lerp(0.14, 0.045, f), three: d > C.r3 + 2 };
  }
  function shoot() {
    const p = pl(), sp = shotParams(p.x, p.y), err = P.power - sp.center, ae = Math.abs(err);
    let res = ae <= sp.half ? 'make' : ae <= sp.half * 2.3 ? 'rim' : err < 0 ? 'short' : 'long';
    const dx = C.hx - p.x, dy = C.hy - p.y, d = Math.max(1, Math.hypot(dx, dy)), ux = dx / d, uy = dy / d;
    let ex = C.hx, ey = C.hy, ez = RIMH;
    if (res === 'rim') { const side = G.chance(0.5) ? 1 : -1; ex += -uy * side * 2.5 + ux * Math.sign(err) * 3; ey += ux * side * 2.5 + uy * Math.sign(err) * 3; }
    if (res === 'short') { const s = G.clamp(ae * 120 + 10, 12, d * 0.8); ex = C.hx - ux * s; ey = C.hy - uy * s; ez = 0; }
    if (res === 'long') { ex = C.hx + ux * 3; ey = C.hy + uy * 3; ez = RIMH + 6; }
    const T = 0.62 + d / 300, peak = 16 + d * 0.22;
    P.flight = { x0: p.x + (p.dir === 1 ? -3 : p.dir === 2 ? 3 : 0), y0: p.y - 1, z0: 18, x1: ex, y1: ey, z1: ez, T, t: 0, peak, res, pts: sp.three ? 3 : 2 };
    B.state = 'flight'; setHold(false); P.pickT = 0.5;
  }
  function endFlight() {
    const f = P.flight; P.flight = null; const near = camNear(B.x, B.y);
    const vx = (f.x1 - f.x0) / f.T, vy = (f.y1 - f.y0) / f.T, vz = (f.z1 - f.z0) / f.T - f.peak * 4 / f.T;
    B.state = 'loose';
    if (f.res === 'make' || (f.res === 'rim' && G.chance(0.3))) {
      if (f.res === 'rim' && near) SFX('ball_rim', 0.4);
      if (near) SFX('ball_swish', 0.6);
      Object.assign(B, { x: C.hx, y: C.hy, z: RIMH - 4, vx: C.nx * 10, vy: C.ny * 10, vz: -30, through: 0.35 });
      P.made++; P.pts += f.pts;
      toast(f.pts === 3 ? 'Τρίποντο! Καλάθι!' : 'Καλάθι!', 1.6);
      try { if (typeof G.addMoney === 'function' && G.state) G.addMoney(1, 'ΚΑΛΑΘΙ'); } catch (e) {}
    } else if (f.res === 'rim' || f.res === 'long') {
      if (near) SFX('ball_rim', 0.5);
      const a = Math.atan2(C.ny, C.nx) + G.rand(-0.9, 0.9), sp = G.rand(35, 60);
      Object.assign(B, { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: G.rand(50, 80) });
      if (P.toastCd <= 0) { P.toastCd = 4; toast(f.res === 'rim' ? G.pick(['Σίδερο!', 'Στεφάνι και έξω.']) : 'Ταμπλό…', 1.4); }
    } else { // short: lands on the court and keeps rolling
      Object.assign(B, { vx: vx * 0.55, vy: vy * 0.55, vz: Math.abs(vz) * 0.45 });
      if (near) SFX('ball_bounce', 0.35);
      if (P.toastCd <= 0) { P.toastCd = 4; toast('Αέρας!', 1.2); }
    }
  }

  // ---------- update ----------
  function update(dt) {
    if (!C || !G.player) return;
    const p = pl(); P.pickT -= dt; P.toastCd -= dt;
    // safety: the player got into a car / left on a train with the ball
    if (P.holding && (!onFoot() || (G.worldScene && G.worldScene.riding))) { drop(); }
    if (P.holding) {
      // too far from the court: the ball goes back
      const far = G.dist(p.x, p.y, C.cx, C.cy) > Math.max(C.x1 - C.x0, C.y1 - C.y0) / 2 + 7 * TS;
      if (far) { setHold(false); placeBall(); toast('Η μπάλα μένει στο γήπεδο.', 1.6); return; }
      const moving = Math.hypot(G.input.axis.x, G.input.axis.y) > 0.15;
      // shoot: press to start charging, release to shoot (fresh press only, not the one that picked it up)
      if (!P.charging && P.pickT <= 0 && (G.pressed('enter') || G.pressed('action'))) { P.charging = true; P.pt = 0; P.power = 0; }
      if (P.charging) {
        P.pt += dt; const ph = (P.pt / 0.8) % 2; P.power = ph < 1 ? ph : 2 - ph;
        if (!G.held('enter') && !G.held('action')) { P.charging = false; shoot(); return; }
      }
      // ball beside the player: dribble while walking, held at the chest when still, over the head while charging
      const side = p.dir === 1 ? -1 : p.dir === 2 ? 1 : 1, fwd = p.dir === 0 ? 2 : p.dir === 3 ? -2 : 0;
      B.x = p.x + side * (p.dir === 1 || p.dir === 2 ? 4 : 6); B.y = p.y + fwd + 0.5;
      if (P.charging) { B.z = G.lerp(B.z, 21, Math.min(1, dt * 14)); B.x = p.x + side * 1.5; B.y = p.y - 0.5; P.dribble = 0; }
      else if (moving) {
        P.dribble += dt * 2.6 * Math.PI; const s = Math.abs(Math.sin(P.dribble)); B.z = s * 9;
        if (s < P.lastSin && s < 0.12 && P.lastSin >= 0.12 && camNear(B.x, B.y)) SFX('ball_bounce', 0.22);
        P.lastSin = s;
      } else { B.z = G.lerp(B.z, 10, Math.min(1, dt * 10)); P.dribble = 0; P.lastSin = 1; }
      return;
    }
    if (B.state === 'flight' && P.flight) {
      const f = P.flight; f.t += dt; const s = Math.min(1, f.t / f.T);
      B.x = G.lerp(f.x0, f.x1, s); B.y = G.lerp(f.y0, f.y1, s); B.z = G.lerp(f.z0, f.z1, s) + f.peak * 4 * s * (1 - s); B.spin += dt * 10;
      if (f.t >= f.T) endFlight();
      return;
    }
    // loose / resting ball physics
    if (B.through > 0) B.through -= dt;
    if (B.state === 'loose') {
      B.vz -= GRAV * dt; B.x += B.vx * dt; B.y += B.vy * dt; B.z += B.vz * dt; B.spin += dt * Math.hypot(B.vx, B.vy) * 0.2;
      if (B.z <= 0) {
        B.z = 0;
        if (B.vz < -28) { B.vz = -B.vz * 0.58; if (camNear(B.x, B.y)) SFX('ball_bounce', G.clamp(B.vz / 140, 0.08, 0.35)); }
        else B.vz = 0;
      }
      if (B.z === 0 && B.vz === 0) { const fr = Math.pow(0.3, dt); B.vx *= fr; B.vy *= fr; if (Math.hypot(B.vx, B.vy) < 2) { B.vx = B.vy = 0; B.state = 'ground'; } }
      // the fence around the court keeps it close
      const m = 10;
      if (B.x < C.x0 - m) { B.x = C.x0 - m; B.vx = Math.abs(B.vx) * 0.5; } if (B.x > C.x1 + m) { B.x = C.x1 + m; B.vx = -Math.abs(B.vx) * 0.5; }
      if (B.y < C.y0 - m) { B.y = C.y0 - m; B.vy = Math.abs(B.vy) * 0.5; } if (B.y > C.y1 + m) { B.y = C.y1 + m; B.vy = -Math.abs(B.vy) * 0.5; }
    }
    if (!inCourt(B.x, B.y, 40)) placeBall();
  }
  function pickUp() { if (!onFoot()) return; setHold(true); B.state = 'held'; P.pickT = 0.25; P.flight = null; P.lastSin = 1; }
  function drop() {
    const p = pl(); setHold(false); P.flight = null;
    Object.assign(B, { x: p ? p.x + 4 : B.x, y: p ? p.y + 1 : B.y, z: 0, vx: 0, vy: 0, vz: 0, state: 'ground' });
    if (!inCourt(B.x, B.y, 40)) placeBall();
  }

  // ---------- drawing ----------
  function drawBall(x, sx, sy, z, spin) {
    const r = 3;
    x.fillStyle = 'rgba(20,10,30,' + (0.3 - Math.min(0.18, z / 120)) + ')';
    x.beginPath(); x.ellipse(sx + 1, sy + 0.6, Math.max(1.6, r - z / 22), Math.max(0.8, 1.3 - z / 50), 0, 0, 7); x.fill();
    const by = sy - z - r + 0.5;
    const g = x.createRadialGradient(sx - 1.1, by - 1.2, 0.3, sx, by, r); g.addColorStop(0, '#ffb070'); g.addColorStop(0.6, '#e8701e'); g.addColorStop(1, '#a8460e');
    x.fillStyle = g; x.beginPath(); x.arc(sx, by, r, 0, 7); x.fill(); ink(x, 0.55);
    x.save(); x.beginPath(); x.arc(sx, by, r, 0, 7); x.clip();
    x.strokeStyle = 'rgba(40,20,10,0.75)'; x.lineWidth = 0.4;
    const o = Math.sin(spin || 0) * 1.4;
    x.beginPath(); x.moveTo(sx - r, by + o * 0.3); x.quadraticCurveTo(sx, by - 0.6 + o * 0.3, sx + r, by + o * 0.3); x.stroke();
    x.beginPath(); x.moveTo(sx + o, by - r); x.quadraticCurveTo(sx + o - 0.6, by, sx + o, by + r); x.stroke();
    x.beginPath(); x.arc(sx - r * 1.2 + o * 0.4, by, r * 0.9, -0.9, 0.9); x.stroke();
    x.restore();
  }
  function groundCourt(x, camX, camY) {
    const X0 = C.x0 - camX, Y0 = C.y0 - camY, w = C.x1 - C.x0, h = C.y1 - C.y0;
    if (X0 > G.W + 20 || Y0 > G.H + 20 || X0 + w < -20 || Y0 + h < -20) return;
    if (G.World.COURT && G.World.COURT.ground) return; // world.js paints the floor + lines
    if (mod.drawSurface !== false) {
      x.fillStyle = 'rgba(20,10,30,0.22)'; rr(x, X0 + 2, Y0 + 3, w, h, 3); x.fill();
      const g = x.createLinearGradient(X0, Y0, X0 + w, Y0 + h); g.addColorStop(0, '#d0684a'); g.addColorStop(1, '#a84a32');
      x.fillStyle = g; rr(x, X0, Y0, w, h, 3); x.fill(); x.strokeStyle = 'rgba(28,20,36,0.6)'; x.lineWidth = 0.8; x.stroke();
      // soft sun patch
      const rg = x.createRadialGradient(X0 + w * 0.3, Y0 + h * 0.3, 4, X0 + w * 0.3, Y0 + h * 0.3, Math.max(w, h) * 0.8);
      rg.addColorStop(0, 'rgba(255,240,210,0.18)'); rg.addColorStop(1, 'rgba(255,240,210,0)'); x.fillStyle = rg; rr(x, X0, Y0, w, h, 3); x.fill();
    }
    // lines (in hoop space: +y points into the court)
    x.save(); rr(x, X0 + 1.5, Y0 + 1.5, w - 3, h - 3, 2); x.clip();
    x.translate(C.hx - camX, C.hy - camY); x.rotate(Math.atan2(C.ny, C.nx) - Math.PI / 2);
    const kw = Math.min(22, C.width * 0.18), kl = Math.min(64, C.depth - C.base - 8);
    x.fillStyle = 'rgba(40,90,150,0.55)'; x.fillRect(-kw, -C.base, kw * 2, kl + C.base);
    x.strokeStyle = 'rgba(255,255,255,0.85)'; x.lineWidth = 1;
    x.strokeRect(-kw, -C.base, kw * 2, kl + C.base);
    x.beginPath(); x.arc(0, kl, kw * 0.85, 0, Math.PI); x.stroke();
    x.beginPath(); x.arc(0, 0, C.r3, 0, Math.PI); x.lineTo(-C.r3, -C.base); x.moveTo(C.r3, 0); x.lineTo(C.r3, -C.base); x.stroke();
    x.restore();
    x.strokeStyle = 'rgba(255,255,255,0.85)'; x.lineWidth = 1; rr(x, X0 + 2, Y0 + 2, w - 4, h - 4, 2); x.stroke();
  }
  // hoop: pole + backboard behind the rim, rim/net in front of a falling ball
  function hoopBack(x, camX, camY) {
    const hx = C.hx - camX, hy = C.hy - camY, nx = C.nx, ny = C.ny;
    const px = hx - nx * 9, py = hy - ny * 9; // pole foot (behind the rim)
    x.fillStyle = SHADOW; x.beginPath(); x.ellipse(px + 3, py + 2, 3.5, 1.5, 0, 0, 7); x.fill();
    x.fillStyle = 'rgba(20,10,30,0.16)'; x.beginPath(); x.ellipse(hx + 4, hy + 3, 9, 3, 0, 0, 7); x.fill(); // board shadow on the court
    x.fillStyle = vg(x, py - RIMH - 12, py, '#8a96a6', '#4a5462'); rr(x, px - 1.4, py - RIMH - 10, 2.8, RIMH + 10, 1.2); x.fill(); ink(x, 0.5);
    const bx = hx - nx * 3, by = hy - ny * 3; // board just behind the rim
    if (ny) {
      const bw = 18, bh = 12, top = by - RIMH - 10;
      x.fillStyle = vg(x, top, top + bh, '#ffffff', '#d8dee6'); rr(x, bx - bw / 2, top, bw, bh, 1.5); x.fill(); ink(x, 0.6);
      x.strokeStyle = '#e8402a'; x.lineWidth = 0.8; x.strokeRect(bx - 4, top + bh - 7, 8, 5.5);
    } else {
      const top = by - RIMH - 10;
      x.fillStyle = vg(x, top - 3, top + 12, '#ffffff', '#c8ced6'); rr(x, bx - 1.4, top - 3, 2.8, 15, 1); x.fill(); ink(x, 0.6);
    }
    // back half of the rim
    x.strokeStyle = '#c84a1a'; x.lineWidth = 1; x.beginPath(); x.ellipse(hx, hy - RIMH, 4.6, 1.8, 0, Math.PI, Math.PI * 2); x.stroke();
  }
  function hoopFront(x, camX, camY) {
    const hx = C.hx - camX, ry = C.hy - camY - RIMH, sway = B.through > 0 ? Math.sin(G.t * 40) * B.through * 2 : 0;
    // net
    x.strokeStyle = 'rgba(255,255,255,0.85)'; x.lineWidth = 0.45;
    for (let i = -2; i <= 2; i++) { x.beginPath(); x.moveTo(hx + i * 2.2, ry + 0.6); x.lineTo(hx + i * 1.2 + sway, ry + 6.5); x.stroke(); }
    x.beginPath(); x.ellipse(hx + sway * 0.6, ry + 3.6, 3.6, 1.2, 0, 0, Math.PI); x.stroke();
    x.beginPath(); x.ellipse(hx + sway, ry + 6.4, 2.6, 0.9, 0, 0, Math.PI); x.stroke();
    // front half of the rim
    x.strokeStyle = '#e8601e'; x.lineWidth = 1.1; x.beginPath(); x.ellipse(hx, ry, 4.6, 1.8, 0, 0, Math.PI); x.stroke();
  }
  // HUD bits drawn on the world canvas at the end of the y-sorted list (UI helpers, one font)
  function withUI(ctx, fn) { const U = G.ui; if (!U || !U.text) return; const prev = U.ctx; U.ctx = ctx; try { fn(U); } finally { U.ctx = prev; } }
  function drawMeter(x, camX, camY) {
    const p = pl(), sp = shotParams(p.x, p.y);
    const mx = p.x - camX + 12, my = p.y - camY - 30, h = 26, w = 4.5;
    x.fillStyle = 'rgba(16,13,28,0.85)'; rr(x, mx - 1.5, my - 1.5, w + 3, h + 3, 2.5); x.fill(); x.strokeStyle = 'rgba(255,255,255,0.25)'; x.lineWidth = 0.6; x.stroke();
    const z0 = G.clamp(sp.center - sp.half, 0, 1), z1 = G.clamp(sp.center + sp.half, 0, 1);
    x.fillStyle = 'rgba(76,217,100,0.85)'; x.fillRect(mx, my + h * (1 - z1), w, h * (z1 - z0));
    x.fillStyle = 'rgba(255,212,0,0.35)'; x.fillRect(mx, my + h * (1 - G.clamp(sp.center + sp.half * 2.3, 0, 1)), w, h * (G.clamp(sp.center + sp.half * 2.3, 0, 1) - z1));
    x.fillRect(mx, my + h * (1 - z0), w, h * (z0 - G.clamp(sp.center - sp.half * 2.3, 0, 1)));
    const py = my + h * (1 - P.power);
    x.fillStyle = '#fff'; rr(x, mx - 2.5, py - 1, w + 5, 2, 1); x.fill(); ink(x, 0.4);
    if (sp.three) withUI(x, U => U.text(mx + w / 2, my - 4, '3', 7, '#ffd400', 'center'));
  }
  function drawCounter(x) {
    withUI(x, U => {
      const t = 'Καλάθια: ' + P.made + (P.pts ? '  ·  Πόντοι: ' + P.pts : ''); x.font = U.fpx(8, 650);
      const w = x.measureText(t).width + 22, y = 30;
      U.box(G.W / 2 - w / 2, y, w, 16, U.T.panel, U.T.line, '#ff8a2a');
      U.text(G.W / 2 + 3, y + 11, t, 8, '#fff', 'center', null);
    });
  }

  // ---------- the mod ----------
  const mod = {
    id: 'basketball', drawSurface: true,
    reset() {
      try { C = courtFromWorld(); setHold(false); P.flight = null; P.made = 0; P.pts = 0; placeBall(); } catch (e) { C = null; console.error('basketball reset', e); }
    },
    update(dt) {
      if (!C) { mod.reset(); if (!C) return; }
      // pick up the court again if world.js added/moved it after we started
      const wc = G.World && G.World.COURT; if (wc && wc !== mod._src) { mod._src = wc; const h = P.holding; C = courtFromWorld(); if (!h) placeBall(); }
      update(dt);
    },
    ground(ctx, camX, camY) { if (C) groundCourt(ctx, camX, camY); },
    sprites(push, camX, camY) {
      if (!C) return;
      const vis = C.x1 > camX - 60 && C.x0 < camX + G.W + 60 && C.y1 > camY - 80 && C.y0 < camY + G.H + 60;
      if (vis) {
        push(C.hy - 1, x => hoopBack(x, camX, camY));
        push(C.hy + 1, x => hoopFront(x, camX, camY));
      }
      if (camNear(B.x, B.y, 30) && B.state !== 'gone') {
        // in flight near the hoop the ball sorts between the board and the front rim
        const nearHoop = G.dist(B.x, B.y, C.hx, C.hy) < 10 && B.z > RIMH - 8;
        let y = P.holding ? pl().y + (pl().dir === 3 ? -1 : 0.6) : B.y;
        if (nearHoop) y = (B.through > 0 || (P.flight && P.flight.res === 'make')) ? C.hy : C.hy + 0.5;
        push(y, x => drawBall(x, B.x - camX, B.y - camY, B.z, B.spin));
      }
      if (P.charging && onFoot()) push(1e9, x => drawMeter(x, camX, camY));
      const p = pl(); if (p && inCourt(p.x, p.y, 2 * TS) && (P.made > 0 || P.holding || B.state === 'flight')) push(1e9 + 1, x => drawCounter(x));
    },
    interact(player) {
      if (!C || !player || player.vehicle) return null;
      if (P.holding) return { hint: P.charging ? 'Άφησε για σουτ!' : 'Σουτ: κράτα πατημένο και άφησε', act() {} };
      if ((B.state === 'ground' || B.state === 'loose') && B.z < 7 && P.pickT <= 0 && G.dist(player.x, player.y, B.x, B.y) < 15)
        return { hint: 'Πάρε την μπάλα', act: pickUp };
      return null;
    },
    drop() { if (P.holding) drop(); },
    get holding() { return P.holding; },
    get baskets() { return P.made; },
  };
  G.bball = mod;
  G.bballHolding = false;
  G.worldMods = G.worldMods || [];
  G.worldMods.push(mod);
})();
