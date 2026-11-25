// GTA LUBEN — quest: Χορός στο Σύνταγμα (rhythm game, DDR-style)
'use strict';
(function () {
  const WS = G.worldScene, Wd = G.World;
  const walk = (x, y) => Wd.walkable(x, y) && !Wd.propAt(x, y);
  let spot = null;

  // ---------- rhythm constants ----------
  const LANES = ['left', 'down', 'up', 'right'];
  const LCOL = ['#c84bff', '#2fb7ff', '#3ddc84', '#ff4b6e'];
  const LROT = [-Math.PI / 2, Math.PI, 0, Math.PI / 2];
  const LABEL = ['◀', '▼', '▲', '▶'];
  const BEAT = 60 / 85.9;    // the real song (music_dance.mp3) is ~85.9 bpm
  const OFFSET = 0.407;      // its first beat, in seconds from the start of the file
  const LEAD = 2.1;          // seconds a note is visible before its hit time
  const PERF = 0.1, GOOD = 0.26; // first quest: forgiving, it's for seeing the content
  const LANE_W = 18, LANE_X = 6;
  const DECK_Y = 92, PLAYER_Y = 144;

  // deterministic PRNG so the pattern is always the same
  function rng(seed) {
    return function () {
      seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // ~60s fixed pattern: warm-up, groove, stairs, break, eighth-note section, finale
  function makePattern() {
    const r = rng(2026), out = []; let last = -1, last2 = -1;
    const add = b => {
      let l; do { l = Math.floor(r() * 4); } while (l === last && l === last2);
      last2 = last; last = l; out.push({ t: OFFSET + b * BEAT, lane: l, st: 0 });
    };
    // easy & short (~35s): one note every 2 beats, two slow "stairs", a slightly busier finale. No eighth notes.
    for (let b = 6; b <= 72;) {
      if (b === 30 || b === 48) {
        const up = b === 30;
        for (let i = 0; i < 4; i++) out.push({ t: OFFSET + (b + i * 2) * BEAT, lane: up ? i : 3 - i, st: 0 });
        last = -1; last2 = -1; b += 10;
      }
      else if (b < 60) { add(b); b += 2; }
      else { add(b); b += r() < 0.5 ? 1 : 2; }
    }
    return out;
  }

  // ---------- drawing helpers (HD-2D: gradients, light from top-left, soft shadows, thin ink) ----------
  const sceneX = () => Math.round((LANE_X + LANE_W * 4 + 6 + G.W) / 2);
  const targetY = () => G.H - (G.device === 'mobile' ? 52 : 28);
  const INK = 'rgba(28,20,36,0.85)', SHADOW = 'rgba(20,10,30,0.3)';
  const rr = (x, px, py, w, h, r) => { x.beginPath(); if (x.roundRect) x.roundRect(px, py, w, h, r); else x.rect(px, py, w, h); };
  const vg = (x, y0, y1, a, b) => { const g = x.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, a); g.addColorStop(1, b); return g; };
  const hg = (x, x0, x1, a, b) => { const g = x.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, a); g.addColorStop(1, b); return g; };
  const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; };
  const ink = (x, w = 0.6) => { x.lineWidth = w; x.strokeStyle = INK; x.stroke(); };

  // rounded arrow (points up before rotation)
  const ARROW = [[0, -7.6], [7.3, -0.3], [3.1, -0.3], [3.1, 6.9], [-3.1, 6.9], [-3.1, -0.3], [-7.3, -0.3]];
  function roundPoly(x, pts, r) {
    const n = pts.length, mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const m0 = mid(pts[n - 1], pts[0]); x.beginPath(); x.moveTo(m0[0], m0[1]);
    for (let i = 0; i < n; i++) { const p = pts[i], m = mid(p, pts[(i + 1) % n]); x.arcTo(p[0], p[1], m[0], m[1], r); }
    x.closePath();
  }
  // kind: 'note' | 'ghost' (missed) | 'target' (hit zone); glow 0..1
  function drawArrow(ctx, x, y, lane, kind, glow = 0) {
    const col = kind === 'ghost' ? '#6c6a78' : LCOL[lane], a = LROT[lane];
    ctx.save(); ctx.translate(x, y);
    if (glow > 0) {
      const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 14); g.addColorStop(0, rgba(col, 0.6 * glow)); g.addColorStop(1, rgba(col, 0));
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 14, 0, 7); ctx.fill(); ctx.globalCompositeOperation = 'source-over';
    }
    ctx.rotate(a); ctx.lineJoin = 'round';
    roundPoly(ctx, ARROW, 1.6);
    if (kind === 'target') {
      ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fill();
      ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(10,8,18,0.55)'; ctx.stroke();
      ctx.lineWidth = 0.8; ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.stroke();
    } else {
      // gradient in screen space: lighter top-left, darker bottom-right
      const c = Math.cos(-a), s = Math.sin(-a), R = (px, py) => [px * c - py * s, px * s + py * c];
      const [ax, ay] = R(-6, -6), [bx, by] = R(6, 6);
      const g = ctx.createLinearGradient(ax, ay, bx, by);
      g.addColorStop(0, G.shade(col, 0.5)); g.addColorStop(0.45, col); g.addColorStop(1, G.shade(col, -0.38));
      ctx.lineWidth = 1.8; ctx.strokeStyle = 'rgba(16,10,26,0.8)'; ctx.stroke();
      ctx.fillStyle = g; ctx.fill();
      ctx.save(); ctx.clip(); ctx.rotate(-a); // gloss, always top-left
      ctx.fillStyle = 'rgba(255,255,255,' + (kind === 'ghost' ? 0.15 : 0.38) + ')'; ctx.beginPath(); ctx.ellipse(-2.2, -2.8, 3.2, 1.6, -0.6, 0, 7); ctx.fill();
      ctx.restore();
      ctx.lineWidth = 0.7; ctx.strokeStyle = kind === 'ghost' ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.85)'; ctx.stroke();
    }
    ctx.restore();
  }

  // cartoon anger vein (four curved strokes)
  function anger(ctx, x, y, s = 1) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.lineCap = 'round';
    for (let k = 0; k < 4; k++) {
      ctx.beginPath(); ctx.moveTo(0.8, -2.6); ctx.quadraticCurveTo(0.8, -0.8, 2.6, -0.8);
      ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(60,0,0,0.6)'; ctx.stroke();
      ctx.lineWidth = 0.9; ctx.strokeStyle = '#ff3030'; ctx.stroke();
      ctx.rotate(Math.PI / 2);
    }
    ctx.restore();
  }

  function tree(x, cx, cy, r) {
    x.fillStyle = 'rgba(20,10,30,0.22)'; x.beginPath(); x.ellipse(cx + 3, cy + r * 0.75, r * 0.9, r * 0.3, 0, 0, 7); x.fill();
    const g = x.createRadialGradient(cx - r * 0.35, cy - r * 0.4, 1, cx, cy, r); g.addColorStop(0, '#8fdc72'); g.addColorStop(0.55, '#4ea045'); g.addColorStop(1, '#2a6a30');
    x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); x.lineWidth = 0.7; x.strokeStyle = 'rgba(20,40,20,0.8)'; x.stroke();
    x.fillStyle = 'rgba(255,255,255,0.16)'; x.beginPath(); x.arc(cx - r * 0.35, cy - r * 0.35, r * 0.35, 0, 7); x.fill();
  }
  function cloud(x, cx, cy, s) {
    x.fillStyle = 'rgba(160,195,225,0.35)'; x.beginPath(); x.ellipse(cx + 1, cy + 2.5 * s, 13 * s, 3 * s, 0, 0, 7); x.fill();
    x.fillStyle = 'rgba(255,255,255,0.8)';
    [[-6, 0, 6], [0, -2.5, 7], [7, 0, 5.5]].forEach(([dx, dy, r]) => { x.beginPath(); x.arc(cx + dx * s, cy + dy * s, r * s, 0, 7); x.fill(); });
  }

  // static backdrop (sky, Parliament, road, plaza), cached per resolution
  let bgC = null, bgKey = '';
  function paintBackdrop(x, sx) {
    x.lineJoin = 'round'; x.lineCap = 'round';
    // sky + sun glow from the top-left
    x.fillStyle = vg(x, 0, 64, '#5aa6de', '#cfe8f6'); x.fillRect(0, 0, G.W, 64);
    let g = x.createRadialGradient(G.W * 0.08, -6, 2, G.W * 0.08, -6, 110); g.addColorStop(0, 'rgba(255,248,215,0.75)'); g.addColorStop(1, 'rgba(255,248,215,0)');
    x.fillStyle = g; x.fillRect(0, 0, G.W, 64);
    cloud(x, sx - 150, 12, 0.9); cloud(x, sx + 150, 8, 0.75); cloud(x, sx + 60, 6, 0.55);
    // trees left/right of the Parliament
    for (let i = -1; i <= 1; i += 2) for (let k = 2; k >= 0; k--) tree(x, sx + i * (122 + k * 18), 52 - (k % 2) * 4, 11);
    // Parliament (yellow-ochre), drop shadow first
    x.fillStyle = 'rgba(20,10,30,0.22)'; rr(x, sx - 108, 26, 222, 36, 2); x.fill();
    x.fillStyle = vg(x, 24, 58, '#f2cd80', '#c8984c'); x.fillRect(sx - 110, 24, 220, 34);
    x.fillStyle = hg(x, sx - 110, sx + 110, 'rgba(255,255,255,0.1)', 'rgba(0,0,0,0.14)'); x.fillRect(sx - 110, 24, 220, 34);
    x.fillStyle = vg(x, 25, 31, 'rgba(70,40,10,0.3)', 'rgba(70,40,10,0)'); x.fillRect(sx - 110, 25, 220, 6);
    x.beginPath(); x.rect(sx - 110, 24, 220, 34); ink(x, 0.7);
    for (let row = 0; row < 2; row++) for (let wx = sx - 104; wx < sx + 104; wx += 10) {
      if (wx > sx - 38 && wx < sx + 30) continue;
      const wy = 30 + row * 14;
      x.fillStyle = 'rgba(255,240,200,0.45)'; rr(x, wx - 0.6, wy - 0.6, 5.2, 9.2, 1.6); x.fill();
      x.fillStyle = vg(x, wy, wy + 8, '#2e2218', '#6a5236'); rr(x, wx, wy, 4, 8, 1.4); x.fill(); ink(x, 0.4);
      x.fillStyle = 'rgba(160,200,240,0.35)'; rr(x, wx + 0.6, wy + 0.8, 1.2, 3.5, 0.6); x.fill();
    }
    x.fillStyle = vg(x, 21, 25, '#fff2c8', '#d6af68'); rr(x, sx - 113, 21, 226, 4, 1.2); x.fill(); ink(x, 0.6);
    x.fillStyle = vg(x, 57, 62, '#dcb46c', '#9e773a'); rr(x, sx - 113, 57, 226, 5, 1); x.fill(); ink(x, 0.6);
    // central portico with columns
    x.fillStyle = vg(x, 17, 58, '#f7d994', '#cfa25a'); rr(x, sx - 33, 17, 66, 41, 1.5); x.fill(); ink(x, 0.7);
    x.fillStyle = vg(x, 22, 56, '#2a2018', '#4e3c2a'); x.fillRect(sx - 27, 22, 54, 34);
    x.fillStyle = vg(x, 22, 28, 'rgba(0,0,0,0.45)', 'rgba(0,0,0,0)'); x.fillRect(sx - 27, 22, 54, 6);
    for (let i = 0; i < 6; i++) {
      const cx = sx - 27 + i * 10;
      x.fillStyle = 'rgba(0,0,0,0.28)'; x.fillRect(cx + 4, 24, 2.2, 32);
      x.fillStyle = hg(x, cx, cx + 4.2, '#fff6dc', '#c09a5c'); rr(x, cx, 22.5, 4.2, 33.5, 1); x.fill(); ink(x, 0.45);
      x.fillStyle = vg(x, 22, 24, '#fff2cc', '#d8b470'); rr(x, cx - 0.9, 21.6, 6, 1.8, 0.6); x.fill(); ink(x, 0.35);
    }
    x.fillStyle = vg(x, 15, 19.5, '#fff6d4', '#dcb46c'); rr(x, sx - 35, 15, 70, 4.5, 1.2); x.fill(); ink(x, 0.6);
    x.fillStyle = vg(x, 55.5, 58.5, '#f0d090', '#b88c48'); rr(x, sx - 34, 55.5, 68, 3, 1); x.fill(); ink(x, 0.5);
    // flag pole (cloth is animated, drawn live)
    x.strokeStyle = hg(x, sx, sx + 1, '#ffffff', '#9a9aa4'); x.lineWidth = 1; x.beginPath(); x.moveTo(sx + 0.5, 1.5); x.lineTo(sx + 0.5, 16); x.stroke();
    x.fillStyle = '#f2c84a'; x.beginPath(); x.arc(sx + 0.5, 1.2, 0.9, 0, 7); x.fill();
    // sidewalk + curb
    x.fillStyle = vg(x, 62, 70, '#ebe3d2', '#c9bea8'); x.fillRect(0, 62, G.W, 8);
    x.strokeStyle = 'rgba(120,100,80,0.25)'; x.lineWidth = 0.5;
    for (let px = 6; px < G.W; px += 16) { x.beginPath(); x.moveTo(px, 62.5); x.lineTo(px, 68.5); x.stroke(); }
    x.fillStyle = vg(x, 68.5, 71, '#d0c8b8', '#8c8478'); x.fillRect(0, 68.5, G.W, 2.5);
    // road
    x.fillStyle = vg(x, 70, 128, '#56575f', '#3c3d44'); x.fillRect(0, 71, G.W, 56);
    x.fillStyle = vg(x, 71, 77, 'rgba(0,0,0,0.25)', 'rgba(0,0,0,0)'); x.fillRect(0, 71, G.W, 6);
    for (let i = 0; i < 9; i++) {
      const px = G.hash(i, 7) * G.W, py = 80 + G.hash(3, i) * 38;
      x.fillStyle = i % 2 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.07)'; x.beginPath(); x.ellipse(px, py, 14 + i * 2, 4 + (i % 3), 0, 0, 7); x.fill();
    }
    x.fillStyle = 'rgba(240,240,235,0.85)'; for (let px = 0; px < G.W; px += 24) { rr(x, px, 121.2, 12, 1.6, 0.8); x.fill(); }
    // curb + plaza
    x.fillStyle = vg(x, 126, 129.5, '#cfc7b8', '#857d70'); x.fillRect(0, 126, G.W, 3.5);
    x.fillStyle = 'rgba(28,20,36,0.5)'; x.fillRect(0, 125.6, G.W, 0.6);
    x.fillStyle = vg(x, 129, G.H, '#dccfac', '#b9a77f'); x.fillRect(0, 129.5, G.W, G.H - 129.5);
    g = x.createRadialGradient(sx - 20, 128, 4, sx - 20, 128, 150); g.addColorStop(0, 'rgba(255,225,160,0.28)'); g.addColorStop(1, 'rgba(255,225,160,0)');
    x.fillStyle = g; x.fillRect(0, 129.5, G.W, G.H - 129.5);
    x.strokeStyle = 'rgba(120,98,64,0.22)'; x.lineWidth = 0.5;
    for (let y = 136; y < G.H; y += 12) { x.beginPath(); x.moveTo(0, y + 0.25); x.lineTo(G.W, y + 0.25); x.stroke(); }
    for (let y = 129.5; y < G.H; y += 12) for (let px = (Math.round((y - 129.5) / 12) % 2) * 12; px < G.W; px += 24) { x.beginPath(); x.moveTo(px + 0.25, y); x.lineTo(px + 0.25, y + 12); x.stroke(); }
    for (let i = 0; i < 10; i++) { // sparse soft stones
      const px = G.hash(i, 21) * G.W, py = 140 + G.hash(21, i) * (G.H - 145);
      x.fillStyle = 'rgba(110,90,60,0.25)'; x.beginPath(); x.ellipse(px, py, 1.6, 1, 0, 0, 7); x.fill();
      x.fillStyle = 'rgba(255,250,235,0.45)'; x.beginPath(); x.ellipse(px - 0.4, py - 0.4, 0.7, 0.4, 0, 0, 7); x.fill();
    }
    x.fillStyle = vg(x, 129.5, 137, 'rgba(40,28,16,0.22)', 'rgba(40,28,16,0)'); x.fillRect(0, 129.5, G.W, 7.5);
  }
  function drawFlag(ctx, sx) {
    const fx = sx + 1, fy = 2, FW = 13;
    const wav = c => Math.sin(G.t * 4 + c * 0.6) * 0.9 * (0.3 + 0.7 * c / FW);
    const band = (c0, c1, r0, r1, col) => {
      ctx.beginPath(); for (let c = c0; c <= c1; c++) ctx.lineTo(fx + c, fy + r0 + wav(c));
      for (let c = c1; c >= c0; c--) ctx.lineTo(fx + c, fy + r1 + wav(c)); ctx.closePath(); ctx.fillStyle = col; ctx.fill();
    };
    band(0, FW, 0, 9, '#0d5eaf');
    for (let r = 1; r < 9; r += 2) if (r > 4) band(0, FW, r, r + 1, '#fff'); else band(5, FW, r, r + 1, '#fff');
    band(2, 3, 0, 5, '#fff'); band(0, 5, 2, 3, '#fff');
    // folds: light/shadow following the wave
    const g = ctx.createLinearGradient(fx, 0, fx + FW, 0);
    for (let k = 0; k <= 6; k++) { const v = Math.cos(G.t * 4 + k * FW / 6 * 0.6); g.addColorStop(k / 6, v > 0 ? 'rgba(255,255,255,' + (0.18 * v).toFixed(3) + ')' : 'rgba(0,0,20,' + (-0.22 * v).toFixed(3) + ')'); }
    band(0, FW, 0, 9, g);
    ctx.beginPath(); for (let c = 0; c <= FW; c++) ctx.lineTo(fx + c, fy + wav(c)); for (let c = FW; c >= 0; c--) ctx.lineTo(fx + c, fy + 9 + wav(c)); ctx.closePath();
    ctx.lineWidth = 0.4; ctx.strokeStyle = INK; ctx.stroke();
  }
  function drawBackdrop(ctx, sx, beat) {
    const key = (G.RS || 2) + ',' + G.W + ',' + G.H + ',' + sx;
    if (!bgC || bgKey !== key) { const [c, x] = G.hiCanvas(G.W, G.H, G.RS || 2); paintBackdrop(x, sx); bgC = c; bgKey = key; }
    ctx.drawImage(bgC, 0, 0, G.W, G.H);
    drawFlag(ctx, sx);
  }

  function drawTruck(ctx, sx, beat) {
    const x = ctx; x.save(); x.lineJoin = 'round'; x.lineCap = 'round';
    // soft ground shadow + chassis
    x.fillStyle = SHADOW; rr(x, sx - 73, 115, 146, 10, 5); x.fill();
    x.fillStyle = vg(x, 113, 120, '#44444c', '#141418'); rr(x, sx - 76, 113.5, 142, 6.5, 2); x.fill(); ink(x);
    // lighting truss
    x.fillStyle = hg(x, sx - 76, sx - 73.5, '#dcdce4', '#6a6a74'); rr(x, sx - 76, 50, 2.4, 42, 1); x.fill(); ink(x, 0.45);
    x.fillStyle = hg(x, sx + 32, sx + 34.4, '#dcdce4', '#6a6a74'); rr(x, sx + 32, 50, 2.4, 42, 1); x.fill(); ink(x, 0.45);
    x.fillStyle = vg(x, 49, 52.5, '#e4e4ea', '#74747e'); rr(x, sx - 77, 49, 112, 3.2, 1.2); x.fill(); ink(x, 0.5);
    x.strokeStyle = 'rgba(60,60,70,0.55)'; x.lineWidth = 0.35; x.beginPath();
    for (let i = 0; i < 27; i++) { x.moveTo(sx - 76 + i * 4, 49.6); x.lineTo(sx - 74 + i * 4, 51.6); } x.stroke();
    const lc = ['#ff3e8a', '#ffd400', '#2fb7ff', '#3ddc84', '#c84bff'];
    for (let i = 0; i < 7; i++) {
      const on = (Math.floor(beat) + i) % 3 === 0, lx = sx - 70 + i * 15, col = lc[(i + Math.floor(beat)) % lc.length];
      if (on) {
        x.globalCompositeOperation = 'lighter';
        const g = x.createLinearGradient(0, 55, 0, 92); g.addColorStop(0, rgba(col, 0.38)); g.addColorStop(1, rgba(col, 0));
        x.fillStyle = g; x.beginPath(); x.moveTo(lx + 0.5, 55); x.lineTo(lx + 3.5, 55); x.lineTo(lx + 10, 92); x.lineTo(lx - 6, 92); x.closePath(); x.fill();
        const rg = x.createRadialGradient(lx + 2, 55.5, 0.3, lx + 2, 55.5, 5); rg.addColorStop(0, rgba(col, 0.9)); rg.addColorStop(1, rgba(col, 0));
        x.fillStyle = rg; x.beginPath(); x.arc(lx + 2, 55.5, 5, 0, 7); x.fill();
        x.globalCompositeOperation = 'source-over';
      }
      x.fillStyle = vg(x, 52, 56, '#4a4a54', '#121216'); rr(x, lx - 0.4, 52, 4.8, 3.8, 1.2); x.fill(); ink(x, 0.4);
      x.fillStyle = on ? G.shade(col, 0.5) : '#2a2a32'; x.beginPath(); x.ellipse(lx + 2, 55.6, 1.7, 0.7, 0, 0, 7); x.fill();
    }
    // speakers (pulse on the beat)
    const pump = Math.floor(beat * 2) % 2 ? 0.6 : 0;
    for (const bx of [sx - 75, sx + 23]) {
      x.fillStyle = 'rgba(20,10,30,0.3)'; rr(x, bx + 2, 70, 10, 23, 1.5); x.fill();
      x.fillStyle = hg(x, bx, bx + 10, '#34343e', '#0c0c10'); rr(x, bx, 68, 10, 24, 1.6); x.fill(); ink(x);
      x.fillStyle = 'rgba(255,255,255,0.12)'; rr(x, bx + 0.8, 68.6, 8.4, 1, 0.5); x.fill();
      for (const cy of [74, 84]) {
        const r = 3 + pump, cx = bx + 5, g = x.createRadialGradient(cx - 1, cy - 1, 0.3, cx, cy, r);
        g.addColorStop(0, '#6a6a78'); g.addColorStop(0.6, '#26262e'); g.addColorStop(1, '#0a0a0e');
        x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill();
        x.lineWidth = 0.5; x.strokeStyle = 'rgba(255,255,255,0.18)'; x.stroke();
        x.fillStyle = '#4a4a56'; x.beginPath(); x.arc(cx, cy, 0.9, 0, 7); x.fill();
      }
    }
    // flatbed deck (top surface, seen in 3/4)
    x.fillStyle = vg(x, 84, 94, '#babac2', '#80808a'); rr(x, sx - 76, 84, 110, 10, 1.2); x.fill();
    x.strokeStyle = 'rgba(40,40,50,0.22)'; x.lineWidth = 0.5; x.beginPath();
    for (let px = sx - 68; px < sx + 34; px += 8) { x.moveTo(px, 84.5); x.lineTo(px, 93.5); } x.stroke();
    x.fillStyle = 'rgba(255,255,255,0.4)'; x.fillRect(sx - 75, 84.4, 108, 0.7);
    rr(x, sx - 76, 84, 110, 10, 1.2); ink(x);
    // side panel with banner (text drawn crisp in hud)
    x.fillStyle = vg(x, 94, 114, '#ffffff', '#cfd4de'); rr(x, sx - 76, 94, 110, 20, 1.2); x.fill(); ink(x);
    x.fillStyle = '#1d4fb8'; x.fillRect(sx - 75.5, 94.6, 109, 1.2); x.fillRect(sx - 75.5, 112.2, 109, 1.2);
    x.fillStyle = vg(x, 97, 111, '#ffffff', '#eef1f6'); rr(x, sx - 73, 97, 104, 14, 2); x.fill();
    x.lineWidth = 0.9; x.strokeStyle = '#1d4fb8'; x.stroke();
    // cab (facing right)
    x.fillStyle = 'rgba(20,10,30,0.25)'; rr(x, sx + 38, 75, 30, 40, 4); x.fill();
    const cg = x.createLinearGradient(sx + 36, 72, sx + 66, 114); cg.addColorStop(0, '#ffffff'); cg.addColorStop(0.6, '#e4e6ec'); cg.addColorStop(1, '#a8acb6');
    x.fillStyle = cg; rr(x, sx + 36, 72, 30, 42, [2.5, 7, 2, 2]); x.fill(); ink(x, 0.7);
    x.fillStyle = vg(x, 76, 90, '#506a96', '#1c2840'); rr(x, sx + 48, 76, 16, 14, [1.5, 4.5, 1.5, 1.5]); x.fill(); ink(x, 0.5);
    x.save(); rr(x, sx + 48, 76, 16, 14, [1.5, 4.5, 1.5, 1.5]); x.clip();
    x.fillStyle = 'rgba(255,255,255,0.28)'; x.beginPath(); x.moveTo(sx + 50, 90); x.lineTo(sx + 56, 76); x.lineTo(sx + 60, 76); x.lineTo(sx + 54, 90); x.closePath(); x.fill(); x.restore();
    x.strokeStyle = 'rgba(40,40,60,0.3)'; x.lineWidth = 0.5; x.beginPath(); x.moveTo(sx + 45.5, 76); x.lineTo(sx + 45.5, 108); x.lineTo(sx + 63, 108); x.stroke();
    x.fillStyle = vg(x, 92, 94, '#e8e8ee', '#8a8a96'); rr(x, sx + 39.5, 92, 3.5, 1.6, 0.8); x.fill();
    x.fillStyle = vg(x, 109.5, 114, '#6a6a74', '#26262c'); rr(x, sx + 58, 109.5, 9, 4.5, 1.6); x.fill(); ink(x, 0.5);
    const hl = x.createRadialGradient(sx + 64.5, 105.5, 0.3, sx + 64.5, 105.5, 4); hl.addColorStop(0, 'rgba(255,246,200,1)'); hl.addColorStop(0.4, 'rgba(255,233,160,0.8)'); hl.addColorStop(1, 'rgba(255,233,160,0)');
    x.fillStyle = hl; x.beginPath(); x.arc(sx + 64.5, 105.5, 4, 0, 7); x.fill();
    // wheels
    [sx - 60, sx - 44, sx + 18, sx + 52].forEach(wx => {
      const tg = x.createRadialGradient(wx - 2, 117, 1, wx, 119, 6); tg.addColorStop(0, '#45454e'); tg.addColorStop(1, '#08080a');
      x.fillStyle = tg; x.beginPath(); x.arc(wx, 119, 6, 0, 7); x.fill(); ink(x, 0.6);
      const hg2 = x.createRadialGradient(wx - 0.8, 118.2, 0.2, wx, 119, 2.6); hg2.addColorStop(0, '#f2f2f6'); hg2.addColorStop(1, '#6e6e78');
      x.fillStyle = hg2; x.beginPath(); x.arc(wx, 119, 2.6, 0, 7); x.fill(); ink(x, 0.4);
    });
    x.restore();
  }

  // bass / guitar drawn over a front-facing musician (feet at x,y)
  function drawInstrument(ctx, x, y, body, lift) {
    y = y - lift; const c = ctx; c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
    // neck + headstock
    c.lineWidth = 1.5; c.strokeStyle = INK; c.beginPath(); c.moveTo(x - 0.5, y - 10.6); c.lineTo(x + 8.6, y - 16.2); c.stroke();
    c.lineWidth = 1; c.strokeStyle = '#7a4c24'; c.stroke();
    c.lineWidth = 0.3; c.strokeStyle = 'rgba(255,240,210,0.6)'; c.beginPath(); c.moveTo(x - 0.5, y - 10.9); c.lineTo(x + 8.4, y - 16.4); c.stroke();
    c.fillStyle = '#26262c'; c.save(); c.translate(x + 9.4, y - 16.8); c.rotate(-0.55); rr(c, -1.3, -0.9, 2.8, 1.8, 0.6); c.fill(); c.restore();
    // body: two soft lobes
    const g = c.createRadialGradient(x - 4, y - 11, 0.3, x - 2.4, y - 9.4, 4.4); g.addColorStop(0, G.shade(body, 0.45)); g.addColorStop(0.6, body); g.addColorStop(1, G.shade(body, -0.4));
    c.beginPath(); c.ellipse(x - 3, y - 8.6, 3.2, 2.6, -0.5, 0, 7); c.ellipse(x - 1.3, y - 10.7, 2.3, 1.9, -0.5, 0, 7);
    c.fillStyle = g; c.fill(); c.lineWidth = 0.5; c.strokeStyle = INK; c.stroke();
    c.fillStyle = '#141014'; c.beginPath(); c.arc(x - 2.2, y - 9.6, 0.85, 0, 7); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.3)'; c.beginPath(); c.ellipse(x - 4, y - 9.6, 1, 0.5, -0.5, 0, 7); c.fill();
    c.restore();
  }

  G.quest({
    id: 'dance', title: 'Χορός στο Σύνταγμα', short: 'Χορός', col: '#ffd400', reward: 300,
    where: () => spot || (spot = WS.placeNear([Wd.pois.vouli[0]-9, Wd.pois.vouli[1]], walk)),

    make: () => G.MiniGame({
      id: 'dance', title: 'ΧΟΡΌΣ ΣΤΟ ΣΎΝΤΑΓΜΑ', reward: 300,
      intro: {
        pc: 'Το φορτηγό-σκηνή πάρκαρε μπροστά στη Βουλή. Χόρεψε από κάτω!\nΠάτα ← ↓ ↑ → ή A S W D τη στιγμή που τα βέλη φτάνουν στους στόχους.\nΠιάσε 40% για να κερδίσεις.',
        mobile: 'Το φορτηγό-σκηνή πάρκαρε μπροστά στη Βουλή. Χόρεψε από κάτω!\nΠάτα τα κουμπιά ◀ ▼ ▲ ▶ τη στιγμή που τα βέλη φτάνουν στους στόχους.\nΠιάσε 40% για να κερδίσεις.',
      },
      buttons() {
        return LANES.map((id, i) => ({ id, label: LABEL[i], pos: [Math.round(G.W / 2 + (i - 1.5) * 38), G.H - 22], r: 17 }));
      },
      stick: 'none',

      init() {
        this.notes = makePattern(); this.total = this.notes.length;
        this.songT = 0; this.loopOff = 0; this.prevMt = null; this.musicEl = null; this.stall = 0;
        this.perfect = 0; this.good = 0; this.miss = 0; this.combo = 0; this.best = 0; this.hype = 50;
        this.judge = null; this.judgeT = 0; this.flash = [0, 0, 0, 0]; this.fx = [];
        this.pdir = 0; this.pframe = 0; this.plift = 0; this.idleT = 0; this.stumble = 0;
        this.glare = 0; this.missVoT = 0; this.comboSaid = false;
        this.ending = false; this.endT = 0; this.acc = 0;
        this.look = G.state.look || G.randomLook();
        this.singer = { x: 0, y: DECK_Y, kind: 'ped' };
        // small, varied crowd: a few random people + a couple of recognisable types
        const extra = [G.LOOKS.hipster, G.LOOKS.yiayia, G.LOOKS.tourist];
        this.crowd = [[-70, 162], [-44, 170], [-2, 164], [24, 172], [50, 160], [76, 168], [-26, 178]]
          .map(([dx, dy], i) => ({ dx, dy, look: i % 3 === 1 ? extra[(i / 3) | 0] : G.randomLook(i === 2 ? { held: 'phone' } : {}), ph: G.rand(0, 1), dir: 3 }));
      },
      onStart() {
        const r = G.audio.music('music_dance', 86);
        this.musicEl = r && r.el ? r.el : null;
        this.songT = 0;
        this.say('protopsalti_start', 'Καλησπέρα Σύνταγμα! Από τον δρόμο, με αγάπη! Πάμε να χορέψουμε!', this.singer, 3);
      },
      exit() { this.singer.dead = true; },

      clock(dt) {
        const mt = G.audio.musicTime();
        if (this.musicEl && typeof mt === 'number') {
          if (this.prevMt != null && mt < this.prevMt - 1) { // file looped
            const d = this.musicEl.duration; this.loopOff += (d && isFinite(d)) ? d : this.prevMt;
          }
          if (this.prevMt != null && Math.abs(mt - this.prevMt) < 1e-4) this.stall += dt; else this.stall = 0;
          this.prevMt = mt;
          this.songT = mt + this.loopOff;
          if (this.stall > 1.2) { this.musicEl = null; } // file not actually playing: fall back to own timer
        } else this.songT += dt;
      },

      hit(i, T) {
        this.flash[i] = 0.15;
        this.pdir = [1, 0, 3, 2][i]; this.plift = 5; this.pframe = this.pframe === 1 ? 2 : 1; this.idleT = 0.22;
        let best = null, bd = 9;
        for (const n of this.notes) {
          if (n.t > T + GOOD) break;
          if (n.st || n.lane !== i) continue;
          const d = Math.abs(n.t - T); if (d < bd) { bd = d; best = n; }
        }
        if (!best || bd > GOOD) return; // free dance move, no penalty
        best.st = 1; this.combo++; this.best = Math.max(this.best, this.combo);
        if (bd <= PERF) { this.perfect++; this.hype = Math.min(100, this.hype + 3); this.judge = ['ΤΕΛΕΙΟ!', '#ffd400']; }
        else { this.good++; this.hype = Math.min(100, this.hype + 1.5); this.judge = ['ΚΑΛΟ', '#7dd3ff']; }
        this.judgeT = 0.5; this.fx.push({ lane: i, t: 0.25, p: bd <= PERF });
        if (this.combo > 0 && this.combo % 10 === 0) G.audio.sfx('cheer');
        if (this.combo === 20 && !this.comboSaid) { this.comboSaid = true; this.say('protopsalti_combo', 'Αυτό είναι! Δώσ\' του!', this.singer, 2); }
      },
      onMiss() {
        this.combo = 0; this.miss++; this.hype = Math.max(0, this.hype - 6);
        this.judge = ['ΧΑΘΗΚΕ', '#ff5050']; this.judgeT = 0.5;
        this.glare = 1.3; this.stumble = 0.3; this.pdir = G.randi(0, 3);
        G.audio.sfx('bad');
        if (this.missVoT <= 0) {
          if (this.miss >= 3) { this.say('protopsalti_miss', 'Στον ρυθμό, παιδί μου!', this.singer, 2); this.missVoT = 8; }
          else { G.ui.bubble(G.pick(['Χμ...', 'Ε;', '...']), this.singer, 1); this.missVoT = 2; }
        }
      },
      finish() {
        this.ending = true;
        const hits = this.perfect + this.good; this.acc = hits / this.total;
        if (this.acc >= 0.7) {
          G.audio.sfx('cheer');
          this.say('protopsalti_win', 'Μπράβο ρε! Τέτοιο χορό ούτε σε πανηγύρι τον Δεκαπενταύγουστο. Έλα αύριο, σε παίρνουμε στο φορτηγό!', this.singer, 4);
        } else {
          this.say('protopsalti_lose', 'Δεν πειράζει, αγάπη μου. Ο δρόμος είναι μακρύς. Ξαναπάμε απ\' την αρχή!', this.singer, 3.5);
        }
        this.endT = 4;
      },

      update(dt) {
        this.clock(dt);
        const T = this.songT;
        for (let i = 0; i < 4; i++) this.flash[i] = Math.max(0, this.flash[i] - dt);
        this.fx.forEach(f => f.t -= dt); this.fx = this.fx.filter(f => f.t > 0);
        this.judgeT = Math.max(0, this.judgeT - dt); this.glare = Math.max(0, this.glare - dt);
        this.missVoT = Math.max(0, this.missVoT - dt); this.stumble = Math.max(0, this.stumble - dt);
        this.plift = Math.max(0, this.plift - dt * 30);
        this.idleT -= dt; if (this.idleT <= 0) this.pframe = 0;

        if (!this.ending) {
          for (let i = 0; i < 4; i++) if (G.pressed(LANES[i])) this.hit(i, T);
          for (const n of this.notes) {
            if (n.t > T) break;
            if (n.st === 0 && T - n.t > GOOD) { n.st = 2; this.onMiss(); }
          }
          if (T > this.notes[this.notes.length - 1].t + 1.2) this.finish();
        } else {
          for (let i = 0; i < 4; i++) if (G.pressed(LANES[i])) { this.pdir = [1, 0, 3, 2][i]; this.plift = 5; this.pframe = this.pframe === 1 ? 2 : 1; this.idleT = 0.22; }
          this.endT -= dt;
          if (this.endT <= 0) {
            const pct = Math.round(this.acc * 100);
            if (this.acc >= 0.4) this.win('Το Σύνταγμα χόρεψε μαζί σου! Ευστοχία ' + pct + '%, καλύτερο σερί ' + this.best + '.');
            else this.lose('Ευστοχία ' + pct + '%. Θέλει 40% για να μπεις στο φορτηγό.');
          }
        }
      },

      render(ctx) {
        const sx = sceneX(), T = this.songT, beat = Math.max(0, (T - OFFSET) / BEAT);
        drawBackdrop(ctx, sx, beat);
        drawTruck(ctx, sx, beat);
        // band on the truck
        const bob = ph => Math.max(0, Math.sin((beat + ph) * Math.PI)) * 2;
        const bf = Math.floor(beat) % 2 ? 1 : 2;
        const bl = bob(0), gl = bob(0.5);
        G.drawPerson(ctx, G.LOOKS.bassist, sx - 54, DECK_Y, 0, bf, { lift: bl });
        drawInstrument(ctx, sx - 54, DECK_Y, '#7a3b1a', bl);
        G.drawPerson(ctx, G.LOOKS.guitarist, sx + 10, DECK_Y, 0, 3 - bf, { lift: gl });
        drawInstrument(ctx, sx + 10, DECK_Y, '#b8222a', gl);
        // singer
        this.singer.x = Math.round(sx - 22 + Math.sin(beat * Math.PI / 4) * 8); this.singer.y = DECK_Y;
        const sdir = this.glare > 0 ? 0 : [0, 1, 0, 2][Math.floor(beat / 2) % 4];
        const slift = this.glare > 0 ? 0 : bob(0.25);
        G.drawPerson(ctx, G.LOOKS.protopsalti, this.singer.x, DECK_Y, sdir, this.glare > 0 ? 0 : bf, { lift: slift });
        if (this.glare > 0) { // disapproving look: frown + anger mark
          const x0 = this.singer.x - 9, y0 = DECK_Y - 25;
          ctx.save(); ctx.lineCap = 'round'; ctx.lineWidth = 0.8; ctx.strokeStyle = '#1a1218';
          ctx.beginPath(); ctx.moveTo(x0 + 5.6, y0 + 4.7); ctx.lineTo(x0 + 7.9, y0 + 6); ctx.moveTo(x0 + 12.4, y0 + 4.7); ctx.lineTo(x0 + 10.1, y0 + 6); ctx.stroke();
          ctx.restore();
          anger(ctx, x0 + 17, y0 - 0.5, 0.9);
        }
        // player + crowd, sorted by y
        const ppl = [{ y: PLAYER_Y, draw: () => {
          const wob = this.stumble > 0 ? Math.round(Math.sin(this.stumble * 40) * 2) : 0;
          G.drawPerson(ctx, this.look, sx - 22 + wob, PLAYER_Y, this.pdir, this.pframe, { lift: this.plift });
        } }];
        const amp = this.hype / 100;
        for (const c of this.crowd) ppl.push({ y: c.dy, draw: () => {
          const l = Math.max(0, Math.sin((beat + c.ph) * Math.PI)) * (1 + amp * 5);
          G.drawPerson(ctx, c.look, sx + c.dx, c.dy, c.dir, amp > 0.6 ? (Math.floor(beat + c.ph * 2) % 2 ? 1 : 2) : 0, { lift: amp > 0.3 ? l : 0 });
        } });
        ppl.sort((a, b) => a.y - b.y).forEach(p => p.draw());

        // lanes panel
        const tY = targetY();
        const px = LANE_X - 3, pw = LANE_W * 4 + 6;
        ctx.save();
        ctx.fillStyle = 'rgba(20,10,30,0.3)'; rr(ctx, px + 3, -6, pw, G.H + 12, 6); ctx.fill();
        ctx.fillStyle = hg(ctx, px, px + pw, 'rgba(22,18,38,0.84)', 'rgba(12,10,22,0.9)'); rr(ctx, px, -6, pw, G.H + 12, 6); ctx.fill();
        ctx.lineWidth = 0.8; ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.stroke();
        for (let i = 0; i < 4; i++) { // faint lane tint that brightens toward the hit zone
          const lx = LANE_X + i * LANE_W;
          ctx.fillStyle = vg(ctx, 0, tY, rgba(LCOL[i], 0), rgba(LCOL[i], 0.13 + (this.flash[i] > 0 ? 0.2 : 0))); ctx.fillRect(lx + 1, 0, LANE_W - 2, tY);
        }
        ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 0.5; ctx.beginPath();
        for (let i = 1; i < 4; i++) { ctx.moveTo(LANE_X + i * LANE_W, 0); ctx.lineTo(LANE_X + i * LANE_W, G.H); } ctx.stroke();
        // hit zone: soft glass band with rounded target arrows
        ctx.fillStyle = vg(ctx, tY - 11, tY + 11, 'rgba(255,255,255,0.13)', 'rgba(255,255,255,0.04)'); rr(ctx, px + 2, tY - 11, pw - 4, 22, 7); ctx.fill();
        ctx.lineWidth = 0.7; ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.stroke();
        for (let i = 0; i < 4; i++) {
          const x = LANE_X + i * LANE_W + LANE_W / 2, fl = this.flash[i] / 0.15;
          if (fl > 0) drawArrow(ctx, x, tY, i, 'note', fl);
          drawArrow(ctx, x, tY, i, 'target');
        }
        ctx.globalCompositeOperation = 'lighter';
        for (const f of this.fx) {
          const x = LANE_X + f.lane * LANE_W + LANE_W / 2, r = 8 + (0.25 - f.t) * 40, col = f.p ? '#ffd400' : '#7dd3ff';
          ctx.globalAlpha = Math.min(1, f.t * 4);
          ctx.strokeStyle = rgba(col, 0.35); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, tY, r, 0, 7); ctx.stroke();
          ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = 1;
        }
        ctx.globalCompositeOperation = 'source-over';
        for (const n of this.notes) {
          const d = n.t - T; if (d > LEAD) break;
          if (n.st === 1) continue;
          const y = tY - d / LEAD * (tY - 8); if (y > G.H + 8) continue;
          const x = LANE_X + n.lane * LANE_W + LANE_W / 2;
          if (n.st === 2) { ctx.globalAlpha = 0.5; drawArrow(ctx, x, y, n.lane, 'ghost'); ctx.globalAlpha = 1; }
          else drawArrow(ctx, x, y, n.lane, 'note', 0.45);
        }
        ctx.restore();
      },

      hud() {
        const U = G.ui, sx = sceneX(), tY = targetY(), T = this.songT, lc = LANE_X + LANE_W * 2;
        // truck banner (crisp)
        U.text(sx - 21, 107, 'Από τον δρόμο με αγάπη!', 7, '#1d4fb8', 'center', null);
        // floating music notes near the singer
        for (let i = 0; i < 2; i++) {
          const ph = (T * 0.8 + i * 0.5) % 1;
          U.ctx.globalAlpha = 1 - ph; U.text(this.singer.x + 8 + i * 6, DECK_Y - 26 - ph * 14, '♪', 8, i ? '#ff8fb1' : '#fff', 'center');
          U.ctx.globalAlpha = 1;
        }
        // countdown
        if (!this.ending && T < 3) U.title(lc, 90, T < 2 ? 'ΕΤΟΙΜΟΣ;' : 'ΠΑΜΕ!', 12, '#ffd400');
        // judgement + combo
        if (this.judgeT > 0 && this.judge) U.title(lc, tY - 26, this.judge[0], 11, this.judge[1]);
        if (this.combo >= 4) U.text(lc, tY - 14, this.combo + ' ΣΕΡΙ', 8, '#fff', 'center');
        // hype meter + accuracy
        const judged = this.perfect + this.good + this.miss;
        const pct = judged ? Math.round((this.perfect + this.good) / judged * 100) : 100;
        const hx = G.W - 70, TT = U.T;
        const hcol = this.hype > 70 ? TT.accent : this.hype > 35 ? TT.gold : TT.blue;
        U.box(hx - 8, 3, 74, 40, TT.panel, TT.line, hcol);
        U.text(hx, 12, 'ΚΕΦΙ ΚΟΣΜΟΥ', 7, TT.text, 'left', null);
        U.rr(hx, 15, 62, 7, 3.5, 'rgba(10,8,18,0.85)', 'rgba(255,255,255,0.25)');
        if (this.hype > 0) U.rr(hx + 1.5, 16.5, Math.max(4, 59 * this.hype / 100), 4, 2, hcol);
        U.text(hx, 31, 'ΕΥΣΤΟΧΙΑ ' + pct + '%', 7, pct >= 70 ? TT.green : '#ff8a80', 'left', null);
        const prog = G.clamp(T / (this.notes[this.notes.length - 1].t + 1), 0, 1);
        U.rr(hx, 34.5, 62, 4, 2, 'rgba(10,8,18,0.85)', null);
        if (prog > 0) U.rr(hx, 34.5, Math.max(4, 62 * prog), 4, 2, TT.sub);
        if (this.ending) U.title(sx, 136, 'ΕΥΣΤΟΧΙΑ ' + Math.round(this.acc * 100) + '%', 13, this.acc >= 0.7 ? '#4cd964' : '#ff5050');
        U.drawBubbles(0, 0);
      },
    }),
  });
})();
