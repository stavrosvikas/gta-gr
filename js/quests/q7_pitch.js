// GTA LUBEN — quest: Βγάλε το σκυλί από το γήπεδο
// Amateur 5x5 pitch, the match is stopped: a dog is loose. Catch it (or bribe it with a sausage)
// and get it out of the gate before the 90" are up.
//
// Voice lines (TODO: ο χρήστης θα στείλει ήχο → assets/sounds/vo_<key>.mp3):
//   pitch_skyli   «Σκυλίιιιι!»             (players: opening line + repeating shouts)
//   pitch_ouou    «Ουουουουου!»            (players: repeating shouts + when the dog runs past one)
//   pitch_mesa    «Σκυλί μπαίνει μέσα!»    (players: repeating shouts + when the dog runs into a goal)
//   pitch_dodge   «Σε πέρασε σαν σταματημένο!»
//   pitch_sausage «Δώσ' του λουκάνικο, ρε!»
//   pitch_caught  «Επιτέλους! Πάρ' το έξω!»
//   pitch_clock   «Ο διαιτητής κοιτάει το ρολόι...»
//   pitch_win     «Μπράβο ρε! Πάρε και μεταγραφή!»
'use strict';
(function () {
  const WS = G.worldScene, Wd = G.World;
  const walk = (x, y) => Wd.walkable(x, y) && !Wd.propAt(x, y);
  let spot = null;

  const TS = 16, OUT = '#1a1420', TIME = 90;
  const GATE_Y = 20 * TS; // fence row with the gate
  const dirFrom = (dx, dy) => Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 1) : (dy > 0 ? 0 : 3);
  const hsh = (a, b) => (((a * 73856093) ^ (b * 19349663)) >>> 0);
  const noId = l => { const o = Object.assign({}, l); delete o._id; return o; };

  // ---------- HD-2D drawing helpers (see STYLE_HD.md) ----------
  const INK = 'rgba(28,20,36,0.85)', SHADOW = 'rgba(20,10,30,0.28)';
  const sh = (c, f) => G.shade(c, f);
  const rnd = (a, b) => (hsh(a, b) % 10000) / 10000;
  function rr(x, px, py, w, h, r) { x.beginPath(); if (x.roundRect) x.roundRect(px, py, w, h, r); else x.rect(px, py, w, h); }
  function lin(x, x0, y0, x1, y1, cols) { const g = x.createLinearGradient(x0, y0, x1, y1); cols.forEach((c, i) => g.addColorStop(i / (cols.length - 1), c)); return g; }
  function rad(x, cx, cy, r, cols) { const g = x.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r * 1.15); cols.forEach((c, i) => g.addColorStop(i / (cols.length - 1), c)); return g; }
  function ell(x, cx, cy, rx, ry, fill, stroke, lw, rot = 0) { x.beginPath(); x.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2); if (fill) { x.fillStyle = fill; x.fill(); } if (stroke) { x.strokeStyle = stroke; x.lineWidth = lw || 0.6; x.stroke(); } }
  function tri(x, a, b, c, fill) { x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.lineTo(c[0], c[1]); x.closePath(); x.fillStyle = fill; x.fill(); x.strokeStyle = INK; x.lineWidth = 0.5; x.stroke(); }

  // border collie (black / tan / white), facing right, feet at (x, y). 0,1 run, 2 sit
  function drawDog(ctx, x, y, f, flip) {
    const k = '#221f26', w = '#f4f2ea', b = '#b0702e';
    ctx.save(); ctx.translate(x, y); if (flip) ctx.scale(-1, 1);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const fur = (x0, y0, x1, y1) => lin(ctx, x0, y0, x1, y1, ['#4a4550', k, '#121014']);
    const leg = (lx, ly, h, col) => { rr(ctx, lx, ly, 1.6, h, 0.8); ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.45; ctx.stroke(); };
    const tail = (a, c, e) => { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(c[0], c[1], e[0], e[1]); ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke(); ctx.strokeStyle = k; ctx.lineWidth = 1.5; ctx.stroke(); ell(ctx, e[0], e[1], 0.8, 0.8, w); };
    const head = (hx, hy) => {
      tri(ctx, [hx - 2.4, hy - 1], [hx - 2.2, hy - 3.8], [hx - 0.6, hy - 2], k);
      tri(ctx, [hx + 0.2, hy - 2.2], [hx + 1.6, hy - 3.8], [hx + 2, hy - 1.4], k);
      ell(ctx, hx, hy, 2.8, 2.4, rad(ctx, hx, hy, 2.8, ['#55505c', k, '#101012']), INK, 0.6);
      ell(ctx, hx + 0.6, hy - 0.4, 0.6, 2, w);
      ell(ctx, hx + 2.2, hy + 1, 1.8, 1.15, rad(ctx, hx + 2.2, hy + 1, 1.8, ['#ffffff', w, '#cfcabe']), INK, 0.45);
      ell(ctx, hx + 3.8, hy + 0.6, 0.6, 0.55, '#141216');
      ell(ctx, hx + 1.1, hy - 0.7, 0.45, 0.5, '#000'); ell(ctx, hx + 0.95, hy - 0.85, 0.15, 0.15, '#fff');
      ell(ctx, hx + 1.1, hy - 1.6, 0.5, 0.3, b);
    };
    if (f === 2) {
      tail([-2.6, -1], [-7, -0.6], [-6.4, -3.6]);
      ell(ctx, -0.4, -3.2, 3.6, 3.1, fur(-3, -6, 3, 0), INK, 0.6);
      ell(ctx, -0.6, -0.7, 2.2, 0.8, b);
      ell(ctx, 2.6, -4.3, 2.1, 3.2, lin(ctx, 1, -7, 4, -1, ['#ffffff', w, '#d6d1c4']), INK, 0.5);
      leg(1.6, -3, 3, w); leg(3.3, -3, 3, w);
      head(3.6, -8.2);
    } else {
      const s = f ? 1 : -1;
      leg(-4.6 + s, -3.4, 3.4, b); leg(2.4 - s, -3.4, 3.4, w);
      tail([-5, -5.2], [-8.4, -5.6], [-8.4, -8.6]);
      ell(ctx, -0.6, -5, 5.4, 2.7, fur(-5, -7.7, 3, -2.3), INK, 0.6);
      ell(ctx, -1.2, -3, 3.2, 0.8, 'rgba(176,112,46,0.85)');
      ell(ctx, 3.2, -4.8, 2.1, 2.3, lin(ctx, 1.5, -7, 4.5, -2.5, ['#ffffff', w, '#d6d1c4']), INK, 0.45);
      leg(-3 - s, -3.4, 3.4, w); leg(3.8 + s, -3.4, 3.4, w);
      head(5.4, -7.6);
    }
    ctx.restore();
  }
  // sausage, bottom-centre at (x, y)
  function drawSausage(ctx, x, y) {
    ctx.save(); ctx.lineCap = 'round';
    ell(ctx, x - 3.9, y - 1.5, 0.6, 0.6, '#7a2a1a'); ell(ctx, x + 3.9, y - 1.5, 0.6, 0.6, '#7a2a1a');
    rr(ctx, x - 3.5, y - 3, 7, 3, 1.5); ctx.fillStyle = lin(ctx, 0, y - 3, 0, y, ['#e07a58', '#b0442a', '#7e2a18']); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 0.5; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,225,205,0.7)'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(x - 2.1, y - 2.3); ctx.lineTo(x + 1.4, y - 2.3); ctx.stroke();
    ctx.restore();
  }

  // ---------- arena ----------
  let A = null;
  function buildArena() {
    const W = 34, H = 23, g = [];
    for (let y = 0; y < H; y++) g.push(new Array(W).fill(','));
    const rect = (x, y, w, h, ch) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) g[j][i] = ch; };
    rect(0, 0, 34, 1, '#'); rect(0, 0, 1, 21, '#'); rect(33, 0, 1, 21, '#'); rect(0, 20, 34, 1, '#');
    rect(15, 20, 4, 1, 'G'); rect(0, 21, 34, 2, 'p');
    rect(1, 8, 2, 5, 'g'); rect(1, 7, 2, 1, 'n'); rect(1, 13, 2, 1, 'n');
    rect(31, 8, 2, 5, 'g'); rect(31, 7, 2, 1, 'n'); rect(31, 13, 2, 1, 'n');
    const rows = g.map(r => r.join(''));
    // legend only carries collision now; the look is painted by pitchBG() (A.draw is never called)
    const legend = {
      ',': { col: '#48a852' }, 'g': { col: '#48a852' }, 'n': { col: '#48a852', solid: true },
      '#': { col: '#2a3a2e', solid: true }, 'G': { col: '#8a8478' }, 'p': { col: '#a8a296' },
    };
    return G.Arena(rows, legend, TS);
  }
  const solid = (px, py) => A.solidAt(px, py);
  const PITCH = { x0: 48, y0: 24, x1: 496, y1: 304 }; // line markings
  const GOALS = [{ x0: 16, y0: 128, x1: 48, y1: 208 }, { x0: 496, y0: 128, x1: 528, y1: 208 }];

  // ---------- HD background (own hi-res canvas, rebuilt when G.RS changes) ----------
  let BG = null, BGRS = 0;
  const metal = (x, x0, y0, x1, y1) => lin(x, x0, y0, x1, y1, ['#e4eaee', '#a8b2b8', '#6e787e']);
  function fence(x, px, py, w, h) {
    const horiz = w > h;
    x.save(); rr(x, px, py, w, h, 1.5);
    x.fillStyle = lin(x, px, py, px + Math.min(w, 60), py + Math.min(h, 60), ['#34493c', '#24352a', '#18241c']); x.fill(); x.clip();
    x.strokeStyle = 'rgba(175,195,185,0.34)'; x.lineWidth = 0.45; x.beginPath();
    for (let d = -h; d < w + h; d += 4) { x.moveTo(px + d, py); x.lineTo(px + d + h, py + h); x.moveTo(px + d + h, py); x.lineTo(px + d, py + h); }
    x.stroke();
    x.fillStyle = lin(x, px, py, horiz ? px : px + w, horiz ? py + h : py, ['rgba(255,255,255,0.08)', 'rgba(0,0,0,0.25)']); x.fillRect(px, py, w, h);
    x.restore();
    // top rail along the length, posts every 3 tiles
    if (horiz) { rr(x, px, py + 0.8, w, 2, 1); x.fillStyle = metal(x, 0, py + 0.8, 0, py + 2.8); }
    else { rr(x, px + 0.8, py, 2, h, 1); x.fillStyle = metal(x, px + 0.8, 0, px + 2.8, 0); }
    x.fill(); x.strokeStyle = 'rgba(28,20,36,0.6)'; x.lineWidth = 0.4; x.stroke();
    if (horiz) { for (let t = Math.ceil(px / TS); t * TS < px + w; t++) if (t % 3 === 0) { rr(x, t * TS + 6.8, py, 2.4, h, 1.2); x.fillStyle = metal(x, t * TS + 6.8, 0, t * TS + 9.2, 0); x.fill(); x.strokeStyle = INK; x.lineWidth = 0.45; x.stroke(); } }
    else { for (let t = Math.ceil(py / TS); t * TS < py + h; t++) if (t % 3 === 0) { rr(x, px, t * TS + 6.8, w, 2.4, 1.2); x.fillStyle = metal(x, 0, t * TS + 6.8, 0, t * TS + 9.2); x.fill(); x.strokeStyle = INK; x.lineWidth = 0.45; x.stroke(); } }
    rr(x, px, py, w, h, 1.5); x.strokeStyle = INK; x.lineWidth = 0.8; x.stroke();
  }
  function pitchBG() {
    if (BG && BGRS === G.RS) return BG;
    const Wp = A.w * TS, Hp = A.h * TS;
    const [c, x] = G.hiCanvas(Wp, Hp, G.RS || 2);
    x.lineJoin = 'round'; x.lineCap = 'round';
    // --- turf: soft mowing stripes + one big light gradient + worn patches + sparse tufts ---
    for (let sx = 0; sx < Wp; sx += 32) { x.fillStyle = (sx / 32) % 2 ? '#3f9a48' : '#48a852'; x.fillRect(sx, 0, 32, 336); }
    for (let sx = 32; sx < Wp; sx += 32) { x.fillStyle = lin(x, sx - 2, 0, sx + 2, 0, ['rgba(0,0,0,0)', 'rgba(255,255,255,0.05)', 'rgba(0,0,0,0)']); x.fillRect(sx - 2, 0, 4, 336); }
    x.fillStyle = lin(x, 0, 0, Wp, 336, ['rgba(255,255,225,0.14)', 'rgba(0,0,0,0)', 'rgba(0,25,5,0.18)']); x.fillRect(0, 0, Wp, 336);
    [[60, 168, 22], [484, 168, 22], [272, 164, 20]].forEach(([wx, wy, r]) => {
      const gr = x.createRadialGradient(wx, wy, 2, wx, wy, r); gr.addColorStop(0, 'rgba(176,152,92,0.32)'); gr.addColorStop(1, 'rgba(176,152,92,0)');
      x.fillStyle = gr; x.fillRect(wx - r, wy - r, r * 2, r * 2);
    });
    for (let i = 0; i < 110; i++) {
      const tx = 20 + rnd(i, 3) * (Wp - 40), ty = 20 + rnd(i, 7) * 296;
      x.beginPath(); x.moveTo(tx - 1, ty); x.quadraticCurveTo(tx - 0.8, ty - 1.6, tx - 1.6, ty - 2.6); x.moveTo(tx, ty); x.quadraticCurveTo(tx + 0.3, ty - 1.8, tx + 1.2, ty - 2.8);
      x.strokeStyle = rnd(i, 9) < 0.5 ? 'rgba(30,110,45,0.7)' : 'rgba(150,215,120,0.55)'; x.lineWidth = 0.5; x.stroke();
    }
    // shade inside the goals
    for (const g of GOALS) { rr(x, g.x0, g.y0, g.x1 - g.x0, g.y1 - g.y0, 2); x.fillStyle = 'rgba(0,30,10,0.2)'; x.fill(); }
    // --- markings ---
    x.strokeStyle = 'rgba(244,250,240,0.92)'; x.lineWidth = 1;
    x.strokeRect(PITCH.x0 + 0.5, PITCH.y0 + 0.5, PITCH.x1 - PITCH.x0, PITCH.y1 - PITCH.y0);
    const mx = (PITCH.x0 + PITCH.x1) / 2, my = (PITCH.y0 + PITCH.y1) / 2;
    x.beginPath(); x.moveTo(mx + 0.5, PITCH.y0 + 0.5); x.lineTo(mx + 0.5, PITCH.y1 + 0.5); x.stroke();
    x.beginPath(); x.arc(mx + 0.5, my + 0.5, 32, 0, Math.PI * 2); x.stroke();
    x.strokeRect(PITCH.x0 + 0.5, my - 56 + 0.5, 56, 112); x.strokeRect(PITCH.x1 - 56 + 0.5, my - 56 + 0.5, 56, 112);
    ell(x, mx + 0.5, my + 0.5, 1.6, 1.6, '#f4faf0'); ell(x, PITCH.x0 + 37, my + 1, 1.3, 1.3, '#f4faf0'); ell(x, PITCH.x1 - 35, my + 1, 1.3, 1.3, '#f4faf0');
    // --- pavement outside the gate ---
    x.fillStyle = lin(x, 0, 336, 0, Hp, ['#c2bcb0', '#aaa497', '#958f82']); x.fillRect(0, 336, Wp, Hp - 336);
    for (let ty = 21; ty < 23; ty++) for (let tx = 0; tx < A.w; tx++) {
      const t = rnd(tx, ty); if (t < 0.3) { x.fillStyle = t < 0.15 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'; x.fillRect(tx * TS, ty * TS, TS, TS); }
    }
    x.strokeStyle = 'rgba(90,84,74,0.5)'; x.lineWidth = 0.6; x.beginPath();
    for (let ty = 21; ty < 23; ty++) {
      x.moveTo(0, ty * TS + 15.7); x.lineTo(Wp, ty * TS + 15.7);
      for (let tx = 0; tx < A.w; tx++) { const sx = tx * TS + (tx % 2 ? 0 : 8) + 0.5; x.moveTo(sx, ty * TS); x.lineTo(sx, ty * TS + 16); }
    }
    x.stroke();
    for (let i = 0; i < 30; i++) ell(x, rnd(i, 21) * Wp, 338 + rnd(i, 23) * 28, 0.9, 0.55, 'rgba(120,112,100,0.45)');
    // --- gate threshold + posts ---
    x.fillStyle = lin(x, 240, 320, 300, 336, ['#b0aa9e', '#9a948a', '#827c72']); x.fillRect(240, 320, 64, 16);
    x.strokeStyle = 'rgba(90,84,74,0.55)'; x.lineWidth = 0.6; x.beginPath(); x.moveTo(240, 328.5); x.lineTo(304, 328.5); x.stroke();
    // --- shadows (light from the top-left) ---
    x.fillStyle = lin(x, 0, 16, 0, 22, ['rgba(20,10,30,0.32)', 'rgba(20,10,30,0)']); x.fillRect(16, 16, Wp - 32, 6);
    x.fillStyle = lin(x, 16, 0, 22, 0, ['rgba(20,10,30,0.32)', 'rgba(20,10,30,0)']); x.fillRect(16, 16, 6, 304);
    x.fillStyle = lin(x, 0, 336, 0, 341, ['rgba(20,10,30,0.3)', 'rgba(20,10,30,0)']); x.fillRect(3, 336, Wp, 5);
    x.fillStyle = lin(x, 522, 0, 528, 0, ['rgba(20,10,30,0)', 'rgba(20,10,30,0.14)']); x.fillRect(522, 16, 6, 304);
    x.fillStyle = lin(x, 0, 314, 0, 320, ['rgba(20,10,30,0)', 'rgba(20,10,30,0.14)']); x.fillRect(16, 314, 224, 6); x.fillRect(304, 314, 224, 6);
    // --- chain-link fence (clearly darker than the turf) ---
    fence(x, 0, 0, Wp, 16); fence(x, 0, 16, 16, 320); fence(x, Wp - 16, 16, 16, 320);
    fence(x, 0, 320, 240, 16); fence(x, 304, 320, 240, 16);
    [[237.5, 315], [301.5, 315]].forEach(([px, py]) => {
      rr(x, px + 2, py + 4, 5, 24, 2); x.fillStyle = SHADOW; x.fill();
      rr(x, px, py, 5, 24, 2); x.fillStyle = metal(x, px, 0, px + 5, 0); x.fill(); x.strokeStyle = INK; x.lineWidth = 0.7; x.stroke();
      ell(x, px + 2.5, py + 1, 3, 1.6, lin(x, 0, py - 0.6, 0, py + 2.6, ['#f4f8fa', '#8a949a']), INK, 0.6);
    });
    // --- goal side-netting bars (solid) ---
    for (const [bx, by] of [[16, 112], [16, 208], [496, 112], [496, 208]]) {
      rr(x, bx + 2, by + 7.5, 32, 6.5, 3); x.fillStyle = SHADOW; x.fill();
      rr(x, bx, by + 4.5, 32, 7, 3.5); x.fillStyle = lin(x, 0, by + 4.5, 0, by + 11.5, ['#ffffff', '#e4e8ea', '#b8bec2']); x.fill();
      x.save(); x.clip(); x.strokeStyle = 'rgba(120,130,140,0.45)'; x.lineWidth = 0.4; x.beginPath();
      for (let i = bx + 1.5; i < bx + 32; i += 3) { x.moveTo(i, by + 4.5); x.lineTo(i, by + 11.5); } x.stroke(); x.restore();
      rr(x, bx, by + 4.5, 32, 7, 3.5); x.strokeStyle = INK; x.lineWidth = 0.7; x.stroke();
    }
    BG = c; BGRS = G.RS; return c;
  }
  const inGoal = (x, y) => GOALS.some(g => x > g.x0 && x < g.x1 && y > g.y0 && y < g.y1);

  // small, varied crowd
  const SKINS = ['#f0c8a8', '#e0b090', '#c98c62', '#a8714a', '#d9a27a'];
  const HAIR = [['#2a1d16', 'short'], ['#141210', 'buzz'], ['#7a5230', 'curly'], ['#b08040', 'quiff'], ['#141210', 'bald'], ['#3a2a1a', 'mullet']];
  function vary(base, i, extra) {
    const h = HAIR[i % HAIR.length];
    return noId(Object.assign({}, base, { skin: SKINS[i % SKINS.length], hair: h[0], hairStyle: h[1] }, extra || {}));
  }

  let st = null, M = null;
  const SHOUTS = [['pitch_ouou', 'Ου ου ου ου ου!'], ['pitch_tiririn', 'Τι ρι ριν τι τιν, τι ριν τι τιν!'], ['pitch_skyli', 'Σκυλίιιι!'], ['pitch_mesa', 'Και τώρα βλέπουμε… σκυλί μπαίνει μέσαααα!']];

  function sayFrom(npc, key, text, cd) {
    if (st.lineCd > 0) return;
    M.say(key, text, npc, 2.2); st.lineCd = cd || 3;
  }
  function nearestNpc(x, y) { let b = null, bd = 1e9; for (const n of st.npcs) { const d = G.dist(n.x, n.y, x, y); if (d < bd) { bd = d; b = n; } } return b; }

  // dog movement with collision; returns fraction of intended move achieved
  function moveDog(D, vx, vy, dt) {
    const ox = D.x, oy = D.y, nx = D.x + vx * dt, ny = D.y + vy * dt;
    const blk = (x, y) => solid(x - 4, y) || solid(x + 4, y) || solid(x, y - 2) || y > GATE_Y - 4 && !D.carried && !D.following;
    if (!blk(nx, D.y)) D.x = nx; if (!blk(D.x, ny)) D.y = ny;
    if (vx) D.flip = vx < 0;
    const want = Math.hypot(vx, vy) * dt, got = Math.hypot(D.x - ox, D.y - oy);
    D.anim += got / 4; D.moving = got > 0.05;
    return want > 0 ? got / want : 1;
  }
  function pickFleeTarget(D, P) {
    let best = null, bs = -1e9;
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2 + G.rand(-0.2, 0.2), r = G.rand(40, 90);
      const x = G.clamp(D.x + Math.cos(a) * r, 24, 520), y = G.clamp(D.y + Math.sin(a) * r, 24, GATE_Y - 10);
      if (solid(x, y)) continue;
      let sc = G.dist(x, y, P.x, P.y) - G.dist(D.x, D.y, P.x, P.y) * 0.5 + G.rand(0, 30);
      // dashing straight past the player is bad; the dog likes hiding behind people or in the net
      const n = nearestNpc(x, y); if (n && G.dist(n.x, n.y, x, y) < 20) sc += 25;
      if (inGoal(x, y)) sc += 20;
      if (sc > bs) { bs = sc; best = [x, y]; }
    }
    return best || [G.rand(80, 460), G.rand(60, 280)];
  }

  G.quest({
    id: 'pitch', title: 'Βγάλε το σκυλί από το γήπεδο', short: 'Γήπεδο', col: '#ffd400', reward: 300,
    where: () => spot || (spot = WS.placeNear([Wd.pois.exarchia[0]+14, Wd.pois.exarchia[1]-6], walk)),

    make: () => G.MiniGame({
      id: 'pitch', title: 'ΒΓΑΛΕ ΤΟ ΣΚΥΛΙ ΑΠΟ ΤΟ ΓΗΠΕΔΟ', reward: 300,
      intro: {
        pc: 'Ένα σκυλί μπήκε στο γήπεδο και το ματς σταμάτησε.\nΚυνήγα το με WASD. Στρίμωξέ το ή πλησίασε και πάτα SPACE για να το πιάσεις.\nΒγάλ\' το από την πόρτα (κάτω) μέσα σε 90". Αν βρεις λουκάνικο, θα σε ακολουθήσει μόνο του.',
        mobile: 'Ένα σκυλί μπήκε στο γήπεδο και το ματς σταμάτησε.\nΚυνήγα το με το joystick. Στρίμωξέ το ή πλησίασε και πάτα ΠΙΑΣ\'ΤΟ.\nΒγάλ\' το από την πόρτα (κάτω) μέσα σε 90". Αν βρεις λουκάνικο, θα σε ακολουθήσει μόνο του.',
      },
      buttons: [{ id: 'action', label: 'ΠΙΑΣ\'ΤΟ' }], stick: 'stick',
      init() {
        M = this;
        if (st) st.npcs.forEach(n => { n.dead = true; });
        A = A || buildArena();
        const pl = new G.Ent.Person(noId(Object.assign({}, G.state.look, { held: null })), 272, 296);
        pl.solidFn = solid; pl.dir = 3; pl.cd = 0;
        const spots = [
          [G.LOOKS.footballer_w, 150, 90], [G.LOOKS.footballer_w, 190, 200], [G.LOOKS.footballer_w, 120, 250],
          [G.LOOKS.footballer_y, 330, 110], [G.LOOKS.footballer_y, 380, 230], [G.LOOKS.footballer_y, 260, 160],
          [G.LOOKS.keeper, 470, 168],
        ];
        const npcs = spots.map(([lk, x, y], i) => {
          const n = new G.Ent.Person(vary(lk, i * 2 + (lk === G.LOOKS.keeper ? 1 : 0)), x, y);
          n.solidFn = solid; n.hop = 0; n.hopCd = 0; n.keeper = lk === G.LOOKS.keeper; return n;
        });
        st = {
          t: 0, pl, npcs, lineCd: 0, done: 0, ended: false, clockSaid: false, shoutT: 3.5, shoutI: 0, lastShouter: null,
          dog: { x: 300, y: 190, flip: false, anim: 0, moving: false, state: 'roam', target: null, t: 0, stuck: 0, dash: 0, dashx: 0, dashy: 0, carried: false, following: false, barkCd: 0, inNet: false },
          sausage: null, hasSausage: false, sausageT: 22,
          parts: [], cam: { x: 0, y: 0 },
        };
        G.camFollow(st.cam, pl.x, pl.y - 8, A.w * TS, A.h * TS, 1);
      },
      onStart() {
        G.audio.music('music_pitch', 128);
        sayFrom(st.npcs[0], 'pitch_skyli', 'Σκυλίιιι!', 3); st.lastShouter = st.npcs[0];
      },
      exit() { if (st) st.npcs.forEach(n => { n.dead = true; }); },
      update(dt) {
        const s = st, P = s.pl, D = s.dog;
        s.t += dt; s.lineCd -= dt; P.cd -= dt; D.barkCd -= dt;
        for (const p of s.parts) { p.t -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 60 * dt; }
        s.parts = s.parts.filter(p => p.t > 0);
        const left = TIME - this.pt;

        // ---- celebration ----
        if (s.done) {
          s.done -= dt; P.move(0, 0, dt);
          s.npcs.forEach(n => { n.hop = Math.abs(Math.sin(s.t * 10 + n.x)) * 4; });
          if (Math.random() < dt * 12) s.parts.push({ x: P.x + G.rand(-60, 60), y: P.y - G.rand(20, 60), vx: 0, vy: -20, t: 0.6, col: G.pick(['#ffd400', '#ffffff', '#ff6a1a']) });
          if (s.done <= 0 && !s.ended) { s.ended = true; this.win(s.viaSausage ? 'Το σκυλί βγήκε έξω για ένα λουκάνικο. Όπως όλοι μας.' : 'Το σκυλί βγήκε έξω. Το ματς συνεχίζεται (0-0, όλοι κουρασμένοι).'); }
          G.camFollow(s.cam, P.x, P.y - 8, A.w * TS, A.h * TS, dt);
          return;
        }
        if (left <= 0) { this.lose('Το ματς αναβλήθηκε. Το σκυλί πήρε τον βαθμό.'); return; }
        if (!s.clockSaid && left < 40) { s.clockSaid = true; s.lineCd = 0; sayFrom(G.pick(s.npcs), 'pitch_clock', 'Ο διαιτητής κοιτάει το ρολόι...', 3); }

        // ---- player ----
        const ax = G.readAxis(), spd = D.carried ? 58 : 68;
        P.move(ax.x * spd, ax.y * spd, dt);
        for (const n of s.npcs) { // players are obstacles
          const dx = P.x - n.x, dy = P.y - n.y, d = Math.hypot(dx, dy) || 1;
          if (d < 9) { const ux = dx / d * (9 - d), uy = dy / d * (9 - d); if (!P.blocked(P.x + ux, P.y + uy)) { P.x += ux; P.y += uy; } }
        }

        // ---- sausage ----
        s.sausageT -= dt;
        if (!s.sausage && !s.hasSausage && s.sausageT <= 0 && !D.carried) {
          s.sausage = { x: 300, y: GATE_Y - 14 };
          G.ui.toast('Κάποιος πέταξε ένα λουκάνικο κοντά στην πόρτα!'); G.audio.sfx('blip');
          s.lineCd = 0; sayFrom(s.npcs[2], 'pitch_sausage', 'Δώσ\' του λουκάνικο, ρε!', 3);
        }
        if (s.sausage && G.dist(P.x, P.y, s.sausage.x, s.sausage.y) < 11) { s.sausage = null; s.hasSausage = true; G.audio.sfx('coin'); G.ui.toast('Πήρες το λουκάνικο. Το σκυλί μυρίζει κάτι...'); }

        // ---- catch ----
        if (!D.carried && P.cd <= 0 && G.pressed('action')) {
          P.cd = 0.5; G.audio.sfx('whoosh');
          const d = G.dist(P.x, P.y, D.x, D.y);
          if (d < 16) {
            if (D.following || D.state === 'hide' || D.stuck > 0.35 || D.inNet || G.chance(0.2)) {
              D.carried = true; D.following = false; D.state = 'carried'; G.audio.sfx('bark'); G.ui.shake(1);
              s.lineCd = 0; sayFrom(nearestNpc(P.x, P.y), 'pitch_caught', 'Επιτέλους! Πάρ\' το έξω!', 3);
            } else {
              const a = Math.atan2(D.y - P.y, D.x - P.x) + (G.chance(0.5) ? 1.3 : -1.3);
              D.dash = 0.45; D.dashx = Math.cos(a) * 115; D.dashy = Math.sin(a) * 115; D.state = 'flee'; D.target = null;
              G.audio.sfx('bark'); sayFrom(nearestNpc(D.x, D.y), 'pitch_dodge', 'Σε πέρασε σαν σταματημένο!', 4);
            }
          } else if (d < 30) { G.ui.toast('Πιο κοντά!', 1); }
        }

        // ---- dog ----
        D.t -= dt;
        const dp = G.dist(P.x, P.y, D.x, D.y);
        const tired = Math.max(0.7, 1 - this.pt / 90); // the dog gets tired, so it gets easier
        if (D.carried) {
          D.x = P.x; D.y = P.y + 1; D.flip = P.dir === 1;
        } else if (s.hasSausage && (D.following || dp < 130)) {
          if (!D.following) { D.following = true; D.state = 'follow'; G.audio.sfx('bark'); G.ui.bubble('Γαβ!', D, 1.2); }
          if (dp > 13) { moveDog(D, (P.x - D.x) / dp * 80, (P.y + 3 - D.y) / dp * 80, dt); } else D.moving = false;
        } else if (D.dash > 0) {
          D.dash -= dt; if (moveDog(D, D.dashx, D.dashy, dt) < 0.4) D.dash = 0;
        } else if (D.state === 'hide') {
          D.moving = false; D.stuck = 0;
          if (dp < 34 || D.t <= 0) { D.state = 'flee'; D.target = null; }
        } else if (dp < 70) {
          if (D.state !== 'flee' || !D.target || D.t <= 0) { D.state = 'flee'; D.target = pickFleeTarget(D, P); D.t = G.rand(0.5, 0.9); }
          const dx = D.target[0] - D.x, dy = D.target[1] - D.y, d = Math.hypot(dx, dy) || 1;
          const f = moveDog(D, dx / d * 96 * tired, dy / d * 96 * tired, dt);
          D.stuck = f < 0.4 ? D.stuck + dt : Math.max(0, D.stuck - dt * 2);
          if (D.stuck <= 0) D.tried = false;
          if (D.stuck > 0.3 && !D.tried) { // cornered: half the time it squeezes past you
            D.tried = true;
            if (G.chance(0.55)) { const ang = Math.atan2(P.y - D.y, P.x - D.x) + (G.chance(0.5) ? 1.1 : -1.1); D.dash = 0.5; D.dashx = Math.cos(ang) * 115; D.dashy = Math.sin(ang) * 115; D.stuck = 0; D.target = null; G.audio.sfx('bark'); }
          }
          if (D.stuck > 0.9) { D.target = pickFleeTarget(D, P); D.t = 0.6; D.stuck = 0; }
          if (d < 4) {
            const n = nearestNpc(D.x, D.y);
            if (inGoal(D.x, D.y) || (n && G.dist(n.x, n.y, D.x, D.y) < 22 && G.chance(0.5))) { D.state = 'hide'; D.t = G.rand(1.5, 3); }
            else D.target = null;
          }
        } else {
          D.stuck = 0;
          if (D.state !== 'roam' || !D.target || D.t <= 0) { D.state = 'roam'; D.target = [G.rand(70, 470), G.rand(50, 280)]; D.t = G.rand(1.5, 3); }
          const dx = D.target[0] - D.x, dy = D.target[1] - D.y, d = Math.hypot(dx, dy) || 1;
          if (d > 4) { if (moveDog(D, dx / d * 55, dy / d * 55, dt) < 0.3) D.t = 0; } else D.moving = false;
        }
        // net / dribble reactions (event-driven)
        const nowNet = !D.carried && inGoal(D.x, D.y);
        if (nowNet && !D.inNet) { const k = s.npcs.find(n => n.keeper); if (k) { s.lineCd = 0; sayFrom(k, 'pitch_mesa', 'Και τώρα βλέπουμε… σκυλί μπαίνει μέσαααα!', 3); k.hop = 4; s.lastShouter = k; s.shoutT = Math.max(s.shoutT, 3); } }
        D.inNet = nowNet;
        for (const n of s.npcs) {
          n.hopCd -= dt; n.hop = Math.max(0, n.hop - dt * 20);
          n.dir = dirFrom(D.x - n.x, D.y - n.y);
          if (!D.carried && n.hopCd <= 0 && G.dist(n.x, n.y, D.x, D.y) < 14 && D.moving) {
            n.hop = 5; n.hopCd = 3;
            if (s.lineCd <= 0) { sayFrom(n, 'pitch_ouou', 'Ου ου ου ου ου!', 3); s.lastShouter = n; s.shoutT = Math.max(s.shoutT, 2.5); }
          }
        }
        // players keep shouting while the dog is loose: a different player each time, a few seconds apart
        s.shoutT -= dt;
        if (!D.carried && !D.following && s.shoutT <= 0 && s.lineCd <= 0) {
          const pool = s.npcs.filter(n => n !== s.lastShouter).sort((a, b) => G.dist(a.x, a.y, D.x, D.y) - G.dist(b.x, b.y, D.x, D.y));
          const n = pool[G.randi(0, Math.min(2, pool.length - 1))];
          const L = SHOUTS[s.shoutI++ % SHOUTS.length];
          sayFrom(n, L[0], L[1], 2.5); n.hop = 4; s.lastShouter = n;
          s.shoutT = G.rand(3.5, 5.5);
        }

        // ---- out of the gate ----
        if ((D.carried || (D.following && G.dist(P.x, P.y, D.x, D.y) < 30)) && P.y > GATE_Y + 18) {
          s.viaSausage = D.following; D.carried = false; D.following = false; D.state = 'out'; D.x = P.x + 10; D.y = P.y + 4; D.moving = false;
          s.done = 2; G.audio.sfx('cheer'); G.audio.sfx('bark');
          s.lineCd = 0; sayFrom(s.npcs[3], 'pitch_win', 'Μπράβο ρε! Πάρε και μεταγραφή!', 3);
        }

        G.camFollow(s.cam, P.x, P.y - 8, A.w * TS, A.h * TS, dt);
      },
      render(ctx) {
        const s = st; if (!s) return;
        const [shx, shy] = G.ui.shakeOffset();
        const cx = Math.round(s.cam.x + shx), cy = Math.round(s.cam.y + shy);
        s.camX = cx; s.camY = cy;
        ctx.fillStyle = '#2a3a2e'; ctx.fillRect(0, 0, G.W, G.H);
        { const bg = pitchBG(), ps = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = true; ctx.drawImage(bg, -cx, -cy, bg.lw, bg.lh); ctx.imageSmoothingEnabled = ps; }
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';

        const P = s.pl, D = s.dog, list = [];
        if (s.sausage) list.push({ y: s.sausage.y, draw: () => {
          const b = Math.sin(s.t * 6), x = s.sausage.x - cx, y = s.sausage.y - cy;
          ell(ctx, x + 1, y + 0.3, 3.8 - Math.abs(b) * 0.4, 1.1, SHADOW);
          drawSausage(ctx, x, y - b);
        } });
        for (const n of s.npcs) list.push({ y: n.y, draw: () => {
          const x = n.x - cx, y = n.y - cy;
          G.drawPerson(ctx, n.look, x, y, n.dir, 0, { lift: Math.round(n.hop) });
          if (n.dir === 0 || n.dir === 3) { // hands on hips: elbows sticking out
            const ey = y - 12.5 - Math.round(n.hop), top = n.look.top || '#3a6ea5';
            for (const ex of [x - 8.6, x + 6.4]) {
              rr(ctx, ex, ey, 2.3, 4.2, 1.15); ctx.fillStyle = lin(ctx, ex, ey, ex + 2.3, ey + 4.2, [sh(top, 0.15), sh(top, -0.25)]); ctx.fill();
              ctx.strokeStyle = INK; ctx.lineWidth = 0.5; ctx.stroke();
            }
          }
        } });
        list.push({ y: P.y, draw: () => {
          const x = P.x - cx, y = P.y - cy;
          G.drawPerson(ctx, P.look, x, y, P.dir, P.frame);
          if (s.hasSausage && !s.done) drawSausage(ctx, x + (P.dir === 1 ? -6 : 6), y - 7);
          if (D.carried) drawDog(ctx, x, y - 6, Math.floor(s.t * 3) % 2, D.flip);
        } });
        if (!D.carried) list.push({ y: D.y, draw: () => {
          ell(ctx, D.x - cx + 1, D.y - cy - 0.3, 6.2, 1.9, SHADOW);
          const fr = D.moving ? Math.floor(D.anim) % 2 : 2;
          drawDog(ctx, D.x - cx, D.y - cy, fr, D.flip);
        } });
        list.sort((a, b) => a.y - b.y);
        for (const o of list) o.draw();
        // goal nets drawn over whatever is inside
        for (const g of GOALS) {
          const x0 = g.x0 - cx, y0 = g.y0 - cy, w = g.x1 - g.x0, h = g.y1 - g.y0;
          ctx.beginPath();
          for (let gx = 0.5; gx <= w + 0.5; gx += 3) { ctx.moveTo(x0 + gx, y0); ctx.lineTo(x0 + gx, y0 + h); }
          for (let gy = 0.5; gy <= h + 0.5; gy += 3) { ctx.moveTo(x0, y0 + gy); ctx.lineTo(x0 + w, y0 + gy); }
          ctx.strokeStyle = 'rgba(20,30,25,0.18)'; ctx.lineWidth = 0.9; ctx.stroke();
          ctx.strokeStyle = 'rgba(245,248,250,0.55)'; ctx.lineWidth = 0.45; ctx.stroke();
        }
        for (const px of [PITCH.x0, PITCH.x1]) {
          const gx = px + 0.5 - cx, gy = 127 - cy;
          rr(ctx, gx - 1.7 + 1.5, gy + 2, 3.4, 83, 1.7); ctx.fillStyle = 'rgba(20,10,30,0.22)'; ctx.fill();
          rr(ctx, gx - 1.7, gy, 3.4, 83, 1.7); ctx.fillStyle = lin(ctx, gx - 1.7, 0, gx + 1.7, 0, ['#ffffff', '#eef0f2', '#b4bac0']); ctx.fill();
          ctx.strokeStyle = INK; ctx.lineWidth = 0.6; ctx.stroke();
        }
        // gate arrow when the dog is with you
        if ((D.carried || D.following) && !s.done && Math.floor(s.t * 3) % 2) {
          const ax = 272.5 - cx, ay = GATE_Y + 4 - cy;
          const gl = ctx.createRadialGradient(ax, ay + 3, 1, ax, ay + 3, 10); gl.addColorStop(0, 'rgba(255,212,0,0.45)'); gl.addColorStop(1, 'rgba(255,212,0,0)');
          ctx.fillStyle = gl; ctx.fillRect(ax - 10, ay - 7, 20, 20);
          ctx.beginPath(); ctx.moveTo(ax - 1.7, ay - 1.2); ctx.lineTo(ax + 1.7, ay - 1.2); ctx.lineTo(ax + 1.7, ay + 2.4); ctx.lineTo(ax + 4.8, ay + 2.4);
          ctx.lineTo(ax, ay + 7); ctx.lineTo(ax - 4.8, ay + 2.4); ctx.lineTo(ax - 1.7, ay + 2.4); ctx.closePath();
          ctx.fillStyle = lin(ctx, ax - 4, ay - 1, ax + 4, ay + 7, ['#fff27a', '#ffd400', '#d89a00']); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.8; ctx.stroke();
        }
        for (const p of s.parts) { rr(ctx, p.x - cx, p.y - cy + 0.3, 2.2, 1.5, 0.6); ctx.fillStyle = p.col; ctx.fill(); ctx.strokeStyle = 'rgba(28,20,36,0.35)'; ctx.lineWidth = 0.3; ctx.stroke(); }
      },
      hud() {
        const s = st, U = G.ui;
        U.drawBubbles(s.camX || 0, s.camY || 0);
        const left = Math.max(0, Math.ceil(TIME - this.pt));
        U.text(G.W - 8, 16, Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0'), 12, left <= 15 ? '#ff3b30' : '#fff', 'right');
        const D = s.dog;
        const msg = s.done ? '' : D.carried ? 'Πάρ\' το έξω από την πόρτα!' : D.following ? 'Σε ακολουθεί! Πήγαινε στην πόρτα!' : 'Πιάσε το σκυλί';
        if (msg) U.text(8, 16, msg, 9, '#ffd400');
      },
    }),
  });
})();
