// GTA LUBEN — quest: Ο ποδηλάτης
// Long one-way Athens street, scrolling up. A cyclist blocks you on purpose.
// Overtake him and get ahead before the time runs out, without touching him.
// All sizes come from G.VEH and all speeds from the car's spec, so the quest scales with the sprites.
'use strict';
(function () {
  const WS = G.worldScene, Wd = G.World;
  const walk = (x, y) => Wd.walkable(x, y) && !Wd.propAt(x, y);
  let spot = null;

  const TIME = 50;
  const MIN_T = 9;   // no gaps (and no win) before this: the shouting lines get heard first
  // his distractions: each opens a readable gap for a few seconds (he pulls to one side and slows down)
  const EVENTS = [
    { k: 'phone', say: 'Για στάσου… μήνυμα.', slow: 0.6 },
    { k: 'water', say: '*γουλιά νερό*', slow: 0.4 },
    { k: 'wave', say: 'Γεια σου κυρα-Λένη!', slow: 0.7 },
    { k: 'phone', say: 'Story πρέπει να ανεβάσω.', slow: 0.6 },
  ];
  // player shouts while stuck behind him (rotating). 3..6 are placeholders: the user will send more.
  const SHOUTS = [
    ['cyclist_1', 'Ρε κάνε άκρη ρε!'],
    ['cyclist_2', 'Είσαι τρελός;'],
    ['cyclist_3', 'Μονόδρομος είναι, όχι ποδηλατόδρομος!'],
    ['cyclist_4', 'Τον Γύρο της Γαλλίας βγήκες να κάνεις;'],
    ['cyclist_5', 'Άντε ρε φίλε, άργησα!'],
    ['cyclist_6', 'Πάτα λίγο ρε, πάτα!'],
  ];
  const CAR_COLS = ['#c0392b', '#ecf0f1', '#2c3e50', '#7f8c8d', '#2980b9', '#27ae60', '#f1c40f', '#8e44ad', '#d35400', '#bdc3c7', '#111111'];
  const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

  // GTA-1 style: the car goes where the arrows / stick point (engine helper). Brake: Space on PC, ΦΡΕΝΟ (b) on mobile.
  // Returns true when the car was stopped by something solid.
  function driveCar(v, dt) {
    const pre = Math.abs(v.speed);
    const brake = G.held('action') || G.held('b');
    G.driveDirect(v, dt, G.readAxis(), brake);
    return !brake && pre > 20 && Math.abs(v.speed) < pre * 0.8;
  }

  // ---------- street generation ----------
  function buildStreet(cycBase) {
    const cw = G.VEH.car.w, cl = G.VEH.car.h;
    const S = { cw, cl, SIDE: 44, PARK: cw + 6, FREE: cw * 3 + 8 };
    S.curbL = S.SIDE; S.curbR = S.SIDE + S.PARK * 2 + S.FREE; S.W = S.curbR + S.SIDE; S.mid = S.W / 2;
    S.len = Math.round(cycBase * (TIME + 14) + 300);
    S.B = 64; S.buckets = []; S.rects = []; S.pots = []; S.decor = [];
    const add = (cx, cy, w, h, o) => {
      const r = Object.assign({ x: cx - w / 2, y: cy - h / 2, w, h, cx, cy }, o);
      S.rects.push(r);
      for (let b = Math.floor(r.y / S.B); b <= Math.floor((r.y + r.h) / S.B); b++) (S.buckets[b] = S.buckets[b] || []).push(r);
    };
    // parked cars along both curbs (gaps hold bins)
    for (const side of [-1, 1]) {
      let y = 90;
      const x = side < 0 ? S.curbL + S.PARK / 2 : S.curbR - S.PARK / 2;
      while (y < S.len - 30) {
        if (G.chance(0.82)) {
          const type = G.chance(0.12) ? 'van' : G.chance(0.1) ? 'taxi' : 'car', d = G.VEH[type];
          add(x, y + d.h / 2, d.w, d.h, { kind: 'car', type, col: type === 'taxi' ? '#f6c400' : G.pick(CAR_COLS), a: G.chance(0.5) ? -Math.PI / 2 : Math.PI / 2 });
          y += d.h + G.randi(3, 12);
        } else {
          if (G.chance(0.6)) add(x, y + 10, 16, 13, { kind: 'bin' });
          y += cl * 0.8;
        }
      }
    }
    // double-parked cars with hazards (start zone kept clear)
    let y = 260;
    while (y < S.len - cl * 7) {
      const side = G.chance(0.5) ? -1 : 1, type = G.chance(0.15) ? 'van' : 'car', d = G.VEH[type];
      const x = side < 0 ? S.curbL + S.PARK + d.w / 2 + 1 : S.curbR - S.PARK - d.w / 2 - 1;
      add(x, y, d.w, d.h, { kind: 'car', type, col: G.pick(CAR_COLS), a: -Math.PI / 2, hz: true });
      y += G.rand(cl * 4, cl * 8);
    }
    // potholes in the free lane
    for (let py = 220; py < S.len - cl * 5; py += G.rand(cl * 3, cl * 6)) {
      S.pots.push({ x: G.rand(S.curbL + S.PARK + 8, S.curbR - S.PARK - 8), y: py, r: G.rand(5, 8), cd: 0 });
    }
    // sidewalk decor (not solid; sidewalk is behind the curb)
    for (const side of [-1, 1]) {
      for (let dy = 30; dy < S.len; dy += G.rand(26, 60)) {
        const x = side < 0 ? G.rand(10, S.SIDE - 12) : G.rand(S.curbR + 12, S.W - 10);
        const kind = G.pick(['tree', 'tree', 'scoot', 'scoot', 'dump', 'bag', 'kiosk_sign']);
        S.decor.push({ kind, x, y: dy, a: G.rand(-0.6, 0.6) + (G.chance(0.5) ? Math.PI / 2 : -Math.PI / 2), col: G.pick(['#7ed957', '#111', '#ff5a1f', '#2dd4ff', '#e8e8e8']) });
      }
    }
    S.solid = (px, py) => {
      if (px < S.curbL || px > S.curbR || py < 0 || py > S.len) return true;
      const b = S.buckets[Math.floor(py / S.B)];
      if (b) for (const r of b) if (px > r.x && px < r.x + r.w && py > r.y && py < r.y + r.h) return true;
      return false;
    };
    // free driving interval at height y
    S.freeAt = (fy) => {
      let L = S.curbL, R = S.curbR;
      const b = S.buckets[Math.floor(fy / S.B)];
      if (b) for (const r of b) if (fy > r.y - 4 && fy < r.y + r.h + 4) { if (r.cx < S.mid) L = Math.max(L, r.x + r.w); else R = Math.min(R, r.x); }
      return [L, R];
    };
    return S;
  }

  // ---------- small drawings (HD-2D: light from top-left, soft shadows, thin ink outlines) ----------
  const INK = 'rgba(28,20,36,0.85)', SHD = 'rgba(20,10,30,0.28)';
  const BW = 52, BH = 60; // rooftop block size
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); }
  function lin(ctx, x0, y0, x1, y1, a, b) { const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, a); g.addColorStop(1, b); return g; }
  function ell(ctx, x, y, rx, ry, col) { ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); }

  // rooftops are cached as HD sprites (a few variants), rebuilt when G.RS changes
  const roofCache = new Map();
  function roofSprite(v1, v2) {
    const key = G.RS + ':' + v1 + ':' + v2; let s = roofCache.get(key); if (s) return s;
    const [c, x] = G.hiCanvas(BW, BH, G.RS || 2);
    x.lineJoin = 'round'; x.lineCap = 'round';
    const s1 = (v1 + 0.5) / 6, s2 = (v2 + 0.5) / 6, w = BW, h = BH;
    const base = ['#bdb6aa', '#aca59a', '#c7c0b3', '#a19b91'][v1 % 4];
    // slab + parapet
    x.fillStyle = lin(x, 0, 0, w, h, G.shade(base, 0.12), G.shade(base, -0.12)); x.fillRect(0, 0, w, h);
    rr(x, 3, 3, w - 6, h - 6, 2); x.fillStyle = lin(x, 0, 0, w, h, G.shade(base, -0.04), G.shade(base, -0.16)); x.fill();
    x.strokeStyle = 'rgba(255,255,255,0.35)'; x.lineWidth = 0.8; x.beginPath(); x.moveTo(3.5, h - 4); x.lineTo(3.5, 3.5); x.lineTo(w - 4, 3.5); x.stroke();
    x.strokeStyle = 'rgba(40,30,30,0.25)'; x.beginPath(); x.moveTo(w - 3.5, 4); x.lineTo(w - 3.5, h - 3.5); x.lineTo(4, h - 3.5); x.stroke();
    // a few soft stains
    for (let i = 0; i < 3; i++) { const g = x.createRadialGradient(8 + G.hash(v1 + i, v2) * (w - 16), 8 + G.hash(v2, v1 + i * 5) * (h - 16), 0, 8 + G.hash(v1 + i, v2) * (w - 16), 8 + G.hash(v2, v1 + i * 5) * (h - 16), 9); g.addColorStop(0, 'rgba(70,60,50,0.12)'); g.addColorStop(1, 'rgba(70,60,50,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); }
    if (s2 < 0.65) { // solar water heater: white tank + blue panel, on a tilted frame
      const sx = 6 + s1 * 10, sy = 8 + s2 * 12;
      rr(x, sx + 2.5, sy + 3.5, 18, 16, 2); x.fillStyle = SHD; x.fill();
      rr(x, sx, sy + 6, 18, 10, 1.5); x.fillStyle = lin(x, sx, sy + 6, sx + 18, sy + 16, '#4d74b4', '#1f3a68'); x.fill(); x.strokeStyle = INK; x.lineWidth = 0.6; x.stroke();
      x.strokeStyle = 'rgba(170,200,255,0.45)'; x.lineWidth = 0.5; x.beginPath(); x.moveTo(sx + 9, sy + 6.5); x.lineTo(sx + 9, sy + 15.5); x.moveTo(sx + 1, sy + 11); x.lineTo(sx + 17, sy + 11); x.stroke();
      rr(x, sx - 0.5, sy, 19, 5.5, 2.75); x.fillStyle = lin(x, 0, sy, 0, sy + 5.5, '#ffffff', '#bfc0bc'); x.fill(); x.strokeStyle = INK; x.lineWidth = 0.6; x.stroke();
    }
    if (s1 > 0.4) { // stairwell box with a door
      const bx = w - 19, by = h - 22;
      rr(x, bx + 2.5, by + 3, 13, 12, 1.5); x.fillStyle = SHD; x.fill();
      rr(x, bx, by, 13, 12, 1.5); x.fillStyle = lin(x, bx, by, bx + 13, by + 12, '#ecebe6', '#bdbab2'); x.fill(); x.strokeStyle = INK; x.lineWidth = 0.6; x.stroke();
      rr(x, bx + 4, by + 8, 5, 4, 0.8); x.fillStyle = '#6b4a2b'; x.fill();
    } else { // AC unit
      const bx = w - 16, by = h - 15;
      rr(x, bx + 2, by + 2.5, 9, 6, 1); x.fillStyle = SHD; x.fill();
      rr(x, bx, by, 9, 6, 1); x.fillStyle = lin(x, bx, by, bx + 9, by + 6, '#f2f2ee', '#b8b8b2'); x.fill(); x.strokeStyle = INK; x.lineWidth = 0.5; x.stroke();
      x.beginPath(); x.arc(bx + 5.5, by + 3, 1.8, 0, Math.PI * 2); x.strokeStyle = 'rgba(60,60,60,0.6)'; x.stroke();
    }
    if (s2 > 0.7) { // TV antenna: mast + bars, with a soft shadow
      const ax = 9, ay = h - 6;
      for (const [ox, oy, col, lw] of [[2, 2.5, 'rgba(20,10,30,0.25)', 1.2], [0, 0, '#3e3e44', 0.9]]) {
        x.strokeStyle = col; x.lineWidth = lw; x.beginPath();
        x.moveTo(ax + ox, ay + oy); x.lineTo(ax + ox, ay - 12 + oy);
        for (let i = 0; i < 3; i++) { const yy = ay - 11 + i * 3 + oy, hw = 5 - i; x.moveTo(ax - hw + ox, yy); x.lineTo(ax + hw + ox, yy); }
        x.stroke();
      }
    }
    x.strokeStyle = INK; x.lineWidth = 0.8; x.strokeRect(0.4, 0.4, w - 0.8, h - 0.8);
    roofCache.set(key, c); return c;
  }
  function drawRoof(ctx, x, y, w, h, s1, s2) {
    ctx.drawImage(roofSprite(Math.min(5, Math.floor(s1 * 6)), Math.min(5, Math.floor(s2 * 6))), x, y, w, h);
  }
  // green striped balcony awning hanging over the sidewalk (side: -1 = building on the left)
  function drawAwning(ctx, x, y, side) {
    const w = 7, h = 14, ax = side < 0 ? x : x - w;
    rr(ctx, ax + 2, y + 3, w, h, 1.5); ctx.fillStyle = SHD; ctx.fill();
    rr(ctx, ax, y, w, h, 1.5); ctx.fillStyle = lin(ctx, ax, y, ax + w, y + h, '#5dbb63', '#23692e'); ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.28)'; for (let i = 1; i < h; i += 4) ctx.fillRect(ax, y + i, w, 1.6);
    ctx.restore();
    ctx.strokeStyle = INK; ctx.lineWidth = 0.6; rr(ctx, ax, y, w, h, 1.5); ctx.stroke();
    // scalloped edge on the street side
    const ex = side < 0 ? ax + w : ax;
    ctx.fillStyle = '#1f5a28'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(ex, y + 2.5 + i * 4.5, 1.3, 0, Math.PI * 2); ctx.fill(); }
  }
  function drawBin(ctx, x, y) { // Athens green wheelie bin (top-down), a solid obstacle
    rr(ctx, x - 6, y - 3, 17, 13, 3); ctx.fillStyle = SHD; ctx.fill();
    rr(ctx, x - 9, y - 7, 18, 15, 2.5); ctx.fillStyle = lin(ctx, x - 9, y - 7, x + 9, y + 8, '#3f9a4b', '#1d5a27'); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.8; ctx.stroke();
    rr(ctx, x - 8, y - 6, 16, 5, 2); ctx.fillStyle = lin(ctx, 0, y - 6, 0, y - 1, '#5cb768', '#2c7a37'); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(x - 7, y - 5.2); ctx.lineTo(x + 6, y - 5.2); ctx.stroke();
    ctx.strokeStyle = 'rgba(10,40,15,0.6)'; ctx.beginPath(); ctx.moveTo(x - 7, y + 1); ctx.lineTo(x + 7, y + 1); ctx.stroke();
    drawBags(ctx, x - 2, y + 9, 0.8);
  }
  function drawBags(ctx, x, y, k = 1) { // black rubbish bags
    for (const [ox, oy, r] of [[-2, 0, 3.4], [4, -1, 3], [1, 2, 2.6]]) {
      ell(ctx, x + ox * k + 1.5, y + oy * k + 1.8, r * k, r * k * 0.7, 'rgba(20,10,30,0.22)');
      const g = ctx.createRadialGradient(x + ox * k - r * 0.4, y + oy * k - r * 0.4, 0.3, x + ox * k, y + oy * k, r * k);
      g.addColorStop(0, '#4a4a52'); g.addColorStop(1, '#0e0e12'); ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x + ox * k, y + oy * k, r * k, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.5; ctx.stroke();
    }
  }
  function drawTree(ctx, x, y) { // bitter-orange tree in a square pit
    rr(ctx, x - 6, y - 4, 12, 9, 1.5); ctx.fillStyle = lin(ctx, x - 6, y - 4, x + 6, y + 5, '#4a3424', '#6b4a2e'); ctx.fill(); ctx.strokeStyle = 'rgba(28,20,36,0.5)'; ctx.lineWidth = 0.6; ctx.stroke();
    ell(ctx, x + 3, y - 4, 12, 8, SHD);
    const blobs = [[-4, -9, 7], [4, -10, 7], [0, -5, 7.5], [0, -13, 6.5]];
    ctx.strokeStyle = INK; ctx.lineWidth = 1.2; for (const [a, b, r] of blobs) { ctx.beginPath(); ctx.arc(x + a, y + b, r, 0, Math.PI * 2); ctx.stroke(); }
    for (const [a, b, r] of blobs) {
      const g = ctx.createRadialGradient(x + a - r * 0.4, y + b - r * 0.45, 0.5, x + a, y + b, r);
      g.addColorStop(0, '#6aa85a'); g.addColorStop(0.6, '#3d7a38'); g.addColorStop(1, '#265224');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x + a, y + b, r, 0, Math.PI * 2); ctx.fill();
    }
    for (const [a, b] of [[-5, -12], [3, -6], [5, -13], [-2, -4], [-7, -6]]) {
      ell(ctx, x + a, y + b, 1.4, 1.4, '#ff9a1f'); ell(ctx, x + a - 0.4, y + b - 0.5, 0.5, 0.5, '#ffd9a0');
    }
  }
  function drawKioskSign(ctx, x, y) {
    ell(ctx, x + 2, y + 2, 3, 1.4, SHD);
    ctx.strokeStyle = '#3a3a40'; ctx.lineWidth = 1.1; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, y + 1); ctx.lineTo(x, y - 9); ctx.stroke();
    rr(ctx, x - 4.5, y - 15, 10, 7, 1.5); ctx.fillStyle = lin(ctx, x - 4.5, y - 15, x + 5.5, y - 8, '#5a8cff', '#1d4fc4'); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.6; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(x - 2, y - 11.5); ctx.lineTo(x + 3, y - 11.5); ctx.stroke();
  }
  function drawBollard(ctx, x, y) { // metal anti-parking bollard
    ell(ctx, x + 2.5, y + 2.5, 3, 1.8, SHD);
    rr(ctx, x - 1.8, y - 9, 3.6, 10, 1.6); ctx.fillStyle = lin(ctx, x - 1.8, 0, x + 1.8, 0, '#b9bec5', '#4d525a'); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.6; ctx.stroke();
    ell(ctx, x, y - 9, 1.8, 0.9, '#d6dae0');
  }
  function drawPothole(ctx, x, y, r) {
    ell(ctx, x, y, r + 2.2, r * 0.7 + 2, 'rgba(120,122,128,0.75)'); // broken asphalt rim
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.25, 0.5, x, y, r);
    g.addColorStop(0, '#1c1d21'); g.addColorStop(1, '#3a3c42');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 0.6; ctx.stroke();
    ctx.strokeStyle = 'rgba(200,200,205,0.45)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.ellipse(x, y, r - 0.6, r * 0.7 - 0.6, 0, 0.2, Math.PI * 0.9); ctx.stroke(); // lit far wall
    ctx.strokeStyle = 'rgba(140,175,210,0.5)'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(x - r * 0.4, y + 0.8); ctx.quadraticCurveTo(x, y + 1.6, x + r * 0.3, y + 0.6); ctx.stroke(); // puddle glint
  }
  function drawPalm(ctx, x, y, t) { // the classic open-palm gesture (μούτζα)
    x += Math.sin(t * 18) * 1;
    // arm (sleeve + forearm)
    rr(ctx, x - 1.5, y - 1, 6, 9, 2.5); ctx.fillStyle = lin(ctx, x - 1.5, 0, x + 4.5, 0, '#3a6ea5', '#1f3f66'); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.6; ctx.stroke();
    const skin = lin(ctx, x - 2, y - 10, x + 6, y, '#f4c8a4', '#c88e66');
    // fingers
    ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const fx = x - 1 + i * 1.8, fy = y - 6;
      ctx.strokeStyle = INK; ctx.lineWidth = 2.1; ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx - 0.3 + i * 0.2, fy - 3.6 - (i === 1 || i === 2 ? 0.8 : 0)); ctx.stroke();
      ctx.strokeStyle = skin; ctx.lineWidth = 1.3; ctx.stroke();
    }
    ctx.strokeStyle = INK; ctx.lineWidth = 2.1; ctx.beginPath(); ctx.moveTo(x + 4.5, y - 3.5); ctx.lineTo(x + 6.8, y - 5); ctx.stroke();
    ctx.strokeStyle = skin; ctx.lineWidth = 1.3; ctx.stroke();
    // palm
    rr(ctx, x - 2, y - 7, 7, 6, 2.2); ctx.fillStyle = skin; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.6; ctx.stroke();
    ctx.strokeStyle = 'rgba(150,90,60,0.5)'; ctx.lineWidth = 0.4; ctx.beginPath(); ctx.moveTo(x - 0.5, y - 4); ctx.quadraticCurveTo(x + 1.5, y - 3, x + 3.5, y - 4.5); ctx.stroke();
  }
  function glow(ctx, x, y, r, col) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(0.35, col.replace(/[\d.]+\)$/, '0.55)')); g.addColorStop(1, col.replace(/[\d.]+\)$/, '0)'));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  function drawOneWay(ctx, x, y) { // Greek one-way sign: blue plate, white arrow up, ΜΟΝΟΔΡΟΜΟΣ, on a pole
    ell(ctx, x + 3, y + 3, 4, 1.8, SHD);
    ctx.strokeStyle = '#3a3a40'; ctx.lineWidth = 1.2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, y + 1); ctx.lineTo(x, y - 12); ctx.stroke();
    rr(ctx, x - 7 + 2, y - 33 + 3, 14, 22, 2); ctx.fillStyle = SHD; ctx.fill();
    rr(ctx, x - 7, y - 33, 14, 22, 2); ctx.fillStyle = lin(ctx, x - 7, y - 33, x + 7, y - 11, '#3d7bff', '#1747b8'); ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.8; rr(ctx, x - 6, y - 32, 12, 20, 1.5); ctx.stroke();
    ctx.strokeStyle = INK; ctx.lineWidth = 0.6; rr(ctx, x - 7, y - 33, 14, 22, 2); ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.beginPath();
    ctx.moveTo(x, y - 30.5); ctx.lineTo(x + 4, y - 25); ctx.lineTo(x + 1.3, y - 25); ctx.lineTo(x + 1.3, y - 18.5); ctx.lineTo(x - 1.3, y - 18.5); ctx.lineTo(x - 1.3, y - 25); ctx.lineTo(x - 4, y - 25); ctx.closePath(); ctx.fill();
    ctx.font = (G.ui && G.ui.fpx) ? G.ui.fpx(2.4, 800) : 'bold 2.5px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('ΜΟΝΟΔΡΟΜΟΣ', x, y - 15.2);
  }
  function drawDistraction(ctx, k, x, y, t) { // what he's busy with while the gap is open
    if (k === 'wave') { drawPalm(ctx, x, y + Math.sin(t * 9) * 1.5, t * 0.3); return; }
    ell(ctx, x + 2, y + 3, 3, 1.4, SHD);
    if (k === 'phone') {
      rr(ctx, x - 2.2, y - 4, 4.4, 7.5, 1); ctx.fillStyle = '#1b1b22'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.5; ctx.stroke();
      rr(ctx, x - 1.5, y - 3.2, 3, 5.8, 0.6); ctx.fillStyle = lin(ctx, x - 1.5, y - 3, x + 1.5, y + 2.6, '#bfe8ff', '#4a9be0'); ctx.fill();
      glow(ctx, x, y, 6, 'rgba(160,215,255,0.35)');
    } else { // water bottle, tilted up to drink
      ctx.save(); ctx.translate(x, y); ctx.rotate(-0.6);
      rr(ctx, -2, -5, 4, 9, 1.4); ctx.fillStyle = lin(ctx, -2, 0, 2, 0, '#dff3ff', '#5fa8d8'); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.5; ctx.stroke();
      rr(ctx, -1.2, -6.6, 2.4, 1.8, 0.5); ctx.fillStyle = '#2d6fd0'; ctx.fill();
      ctx.restore();
    }
  }

  G.quest({
    id: 'cyclist', title: 'Ο ποδηλάτης', short: 'Ποδήλατο', col: '#ffd400', reward: 300,
    where: () => spot || (spot = WS.placeNear([Wd.pois.omonia[0]+14, Wd.pois.omonia[1]+18], walk)),

    make: () => G.MiniGame({
      id: 'cyclist', title: 'Ο ΠΟΔΗΛΆΤΗΣ', reward: 300,
      intro: {
        pc: 'Ένας ποδηλάτης σου κλείνει τον μονόδρομο. Επίτηδες.\nΜόλις του φύγει η προσοχή (κινητό, νερό, χαιρετούρες) ανοίγει κενό: πέρασέ τον και ξέφυγε μπροστά. ΜΗΝ τον ακουμπήσεις.\nΒελάκια/WASD = προς τα πού πας · SPACE φρένο.',
        mobile: 'Ένας ποδηλάτης σου κλείνει τον μονόδρομο. Επίτηδες.\nΜόλις του φύγει η προσοχή (κινητό, νερό, χαιρετούρες) ανοίγει κενό: πέρασέ τον και ξέφυγε μπροστά. ΜΗΝ τον ακουμπήσεις.\nJoystick = προς τα πού πας · ΦΡΕΝΟ.',
      },
      buttons: [{ id: 'b', label: 'ΦΡΕΝΟ' }],
      stick: 'stick',

      init() {
        const car = new G.Ent.Vehicle('car', 0, 0, -Math.PI / 2, '#c0392b');
        this.max = car.spec.max; this.cycBase = this.max * 0.4;
        const S = this.S = buildStreet(this.cycBase);
        car.x = S.mid; car.y = S.len - S.cl; car.driver = G.player;
        this.car = car;
        car.solidFn = (px, py) => S.solid(px, py);   // one-way street: no traffic coming down it
        this.cyc = { kind: 'ped', x: S.mid, y: car.y - S.cl * 5, sp: this.cycBase, tx: S.mid, anim: 0, lean: 0,
          brake: 0, bcCd: G.rand(4, 6), slow: 0, gest: 0, ev: null, evT: 0, hold: 0, evCd: G.rand(MIN_T, MIN_T + 1.5), evI: Math.floor(Math.random() * EVENTS.length) };
        this.hist = [];
        this.timeLeft = TIME; this.penalties = 0; this.hitCd = 0; this.shoutT = 0.9; this.shoutI = 0;
        this.camX = (S.W - G.W) / 2; this.camY = G.clamp(car.y - G.H * 0.65, 0, S.len - G.H);
        this.rcx = this.camX; this.rcy = this.camY;
      },
      onStart() { G.audio.music('music_cyclist', 124); },

      update(dt) {
        const S = this.S, v = this.car, c = this.cyc, cl = S.cl;
        // ----- player -----
        driveCar(v, dt); G.audio.engines(v.x, v.y, [v], v);
        // potholes
        for (const p of S.pots) {
          p.cd -= dt;
          if (p.cd <= 0 && Math.abs(v.speed) > this.max * 0.25 && G.dist(v.x, v.y, p.x, p.y) < p.r + 5) {
            p.cd = 1; v.speed *= 0.6; G.ui.shake(2); G.audio.sfx('hit');
          }
        }
        this.hist.push([this.pt, v.x]); while (this.hist.length > 2 && this.hist[1][0] < this.pt - (this.pt < MIN_T ? 0.1 : 0.25)) this.hist.shift(); // he reacts, but not instantly (sharp at the start)
        const lagX = this.hist[0][1] + G.clamp(v.vx * 0.2, -20, 20);

        // ----- cyclist AI -----
        const dy = v.y - c.y; // >0: player behind him
        const f1 = S.freeAt(c.y), f2 = S.freeAt(c.y - cl * 0.7), f3 = S.freeAt(c.y - cl * 1.6);
        const L = Math.max(f1[0], f2[0]) + 6, R = Math.min(f1[1], f2[1]) - 6;
        const La = Math.max(L, f3[0] + 6), Ra = Math.min(R, f3[1] - 6); // plans around double-parked cars early (never gets boxed in)
        c.brake -= dt; c.bcCd -= dt; c.slow -= dt; c.gest -= dt; c.evCd -= dt; c.hold -= dt;
        // distractions: a readable gap every few seconds (none before MIN_T, so the lines get heard)
        if (c.ev) { c.evT -= dt; if (c.evT <= 0) { c.ev = null; c.evCd = G.rand(3.5, 5.5); c.hold = 2; } }
        else if (c.evCd <= 0 && this.pt >= MIN_T) {
          c.ev = EVENTS[c.evI++ % EVENTS.length]; c.evT = G.rand(2.8, 3.6);
          // he pulls over to one side, mostly away from you (so the gap opens where you are)
          const away = v.x < (La + Ra) / 2 ? 1 : -1;
          c.evSide = G.chance(0.75) ? away : -away;
          G.ui.bubble(c.ev.say, c, 2.2);
        }
        let target;
        if (c.ev) target = c.evSide > 0 ? Ra : La;                  // distracted: hugs one side of the lane
        else if (c.hold > 0 && Math.abs(dy) < cl * 2.5) target = c.x; // you were already going for it: he keeps his line, no cutting in
        else if (dy > cl * 0.6 && dy < cl * 8) target = lagX;      // blocks you (with a slow reaction)
        else if (Math.abs(dy) <= cl * 0.6) target = v.x + (v.x < c.x ? 1 : -1) * (v.wid / 2 + 9); // squeezes you when alongside
        else target = S.mid;
        if ((c.ev || c.hold > 0) && Math.abs(dy) < cl * 1.2) target = v.x < c.x ? Ra : La; // distracted but not suicidal: moves away when you come alongside
        if (!c.ev && !(c.hold > 0)) target += Math.sin(this.pt * 2.3) * 6;
        // swerve around potholes ahead
        for (const p of S.pots) if (c.y - p.y > 0 && c.y - p.y < cl * 2.2 && Math.abs(p.x - target) < p.r + 8) target = p.x + (target < p.x ? -(p.r + 10) : p.r + 10);
        target = G.clamp(target, La, Math.max(La, Ra));
        const lat = this.cycBase * (c.ev ? 0.9 : this.pt < MIN_T ? 1.2 : 0.95) * dt;
        const nx = G.clamp(c.x + G.clamp(target - c.x, -lat, lat), L, Math.max(L, R));
        const prevX = c.x; c.x = nx;
        if (this.touching()) c.x = prevX; // he never rams you sideways, he just gets really close
        c.lean = G.clamp((c.x - prevX) / Math.max(dt, 0.001) / this.cycBase, -0.35, 0.35);
        // speed
        if (!c.ev && c.bcCd <= 0 && dy > 0 && dy < cl * 2.4 && G.chance(dt * 0.5)) { c.brake = 0.7; c.bcCd = G.rand(5, 8); }
        let want = this.cycBase * (1 + 0.1 * Math.sin(this.pt * 0.7));
        if (c.ev) want *= c.ev.slow;
        // when you come alongside he races you (only before MIN_T he really keeps up; later he soon runs out of breath)
        else if (Math.abs(dy) < cl * 1.4) want = Math.max(want, Math.min(Math.abs(v.speed) * (this.pt < MIN_T ? 1 : 0.9), this.max * (this.pt < MIN_T ? 1 : 0.5)));
        if (c.slow > 0) want *= 0.7;
        if (c.brake > 0) want *= 0.45;
        c.sp += G.clamp(want - c.sp, -this.cycBase * 2 * dt, this.cycBase * 1.2 * dt);
        c.y = Math.max(20, c.y - c.sp * dt);
        c.anim += c.sp * dt / 9;

        // ----- contact with the cyclist -----
        this.hitCd -= dt;
        if (this.touching() && this.hitCd <= 0) {
          const rel = Math.hypot(v.vx, v.vy + c.sp);
          const nose = (c.x - v.x) * Math.cos(v.a) + (c.y - v.y) * Math.sin(v.a) > v.len / 2 - 4; // rammed with the front (a side scrape while passing only costs time)
          if (rel > this.max * 0.3 && nose) { // hitting him is not a way through
            G.audio.sfx('crash'); G.ui.shake(5); c.down = true;
            this.lose('Τον πήρες σβάρνα. Σηκώθηκε, σε τράβηξε βίντεο και έγινες viral στο TikTok.');
            return;
          }
          this.hitCd = 1; this.penalties++; this.timeLeft -= 8;
          G.audio.sfx('hit'); G.ui.shake(2); G.ui.toast('Τον ακούμπησες! -8″ (πιο δυνατά και χάνεις)');
          c.gest = 1.4; c.slow = 1.5; G.ui.bubble('ΝΑ!', c, 1.2);
          v.speed = 0; v.vx = 0; v.vy = 0;
          for (let i = 0; i < 12 && this.touching(); i++) {
            const bx = v.x - Math.cos(v.a) * 2, by = v.y - Math.sin(v.a) * 2;
            if (v.blocked(bx, by, v.a)) break; v.x = bx; v.y = by;
          }
        }

        // ----- shouting while stuck behind him -----
        this.shoutT -= dt;
        if (dy > 0 && dy < cl * 6 && this.shoutT <= 0) {
          const [k, t] = SHOUTS[this.shoutI % SHOUTS.length]; this.shoutI++;
          this.say(k, t, v, 2.2); this.shoutT = 3.6;
        }

        // ----- camera -----
        const ty = v.y - G.H * 0.65 + G.clamp(v.vy * 0.25, -40, 40);
        this.camY += (ty - this.camY) * Math.min(1, dt * 6);
        this.camY = G.clamp(this.camY, 0, S.len - G.H);
        this.camX = (S.W - G.W) / 2;

        // ----- result -----
        if (c.y - v.y > cl * 3.2 && this.pt >= MIN_T) {
          this.win('Τον πέρασες! Στο επόμενο φανάρι σε πρόλαβε, χτύπησε το τζάμι και σου έκανε διάλεξη για το περιβάλλον.');
          return;
        }
        this.timeLeft -= dt;
        if (this.timeLeft <= 0) { this.timeLeft = 0; this.lose('Όλο τον δρόμο πίσω του με 15 χλμ/ώρα. Άργησες, και σου έκανε και μούτζα.'); }
      },

      // oriented-box test: car vs bike
      touching() {
        const v = this.car, c = this.cyc;
        const dx = c.x - v.x, dy = c.y - v.y, ca = Math.cos(v.a), sa = Math.sin(v.a);
        const lx = dx * ca + dy * sa, ly = -dx * sa + dy * ca;
        return Math.abs(lx) < v.len / 2 + G.VEH.bike.h / 2 - 2 && Math.abs(ly) < v.wid / 2 + G.VEH.bike.w / 2 + 1;
      },

      render(ctx) {
        const S = this.S, cl = S.cl;
        const [shx, shy] = G.ui.shakeOffset();
        const cx = Math.round(this.camX + shx), cy = Math.round(this.camY + shy);
        this.rcx = cx; this.rcy = cy;
        const y0 = cy - 60, y1 = cy + G.H + 60;
        ctx.save();
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        ctx.fillStyle = '#9a9387'; ctx.fillRect(0, 0, G.W, G.H);
        // rooftops beside the street (cached HD sprites)
        for (let by = Math.floor(cy / BH); by * BH < cy + G.H; by++) {
          for (let bx = -1; bx * BW + BW > cx; bx--) drawRoof(ctx, bx * BW - cx, by * BH - cy, BW, BH, hash(bx, by), hash(by, bx * 3));
          for (let bx = 0; S.W + bx * BW < cx + G.W; bx++) drawRoof(ctx, S.W + bx * BW - cx, by * BH - cy, BW, BH, hash(bx + 99, by), hash(by, bx + 7));
        }
        const sw = -cx, ew = S.W - cx, lx = S.curbL - cx, rx = S.curbR - cx;
        // sidewalks (walkable for people, NOT for the car)
        ctx.fillStyle = lin(ctx, sw, 0, lx, 0, '#ddd6c8', '#c9c1b1'); ctx.fillRect(sw, 0, S.curbL, G.H);
        ctx.fillStyle = lin(ctx, rx, 0, ew, 0, '#d9d2c4', '#c2baaa'); ctx.fillRect(rx, 0, S.W - S.curbR, G.H);
        ctx.strokeStyle = 'rgba(120,108,92,0.32)'; ctx.lineWidth = 0.5; ctx.beginPath();
        for (let yy = Math.floor(cy / 14) * 14; yy < cy + G.H + 14; yy += 14) {
          const py = yy - cy, row = Math.floor(yy / 14) & 1;
          ctx.moveTo(sw, py); ctx.lineTo(lx - 6, py); ctx.moveTo(rx + 6, py); ctx.lineTo(ew, py);
          for (let xx = row * 9 + 4; xx < S.curbL - 6; xx += 18) { ctx.moveTo(sw + xx, py); ctx.lineTo(sw + xx, py + 14); }
          for (let xx = S.curbR + 6 + row * 9 + 4; xx < S.W; xx += 18) { ctx.moveTo(xx - cx, py); ctx.lineTo(xx - cx, py + 14); }
        }
        ctx.stroke();
        // buildings throw soft shadow onto the sidewalk (light from top-left)
        ctx.fillStyle = lin(ctx, sw, 0, sw + 9, 0, 'rgba(20,10,30,0.34)', 'rgba(20,10,30,0)'); ctx.fillRect(sw, 0, 9, G.H);
        ctx.fillStyle = lin(ctx, ew, 0, ew - 4, 0, 'rgba(20,10,30,0.2)', 'rgba(20,10,30,0)'); ctx.fillRect(ew - 4, 0, 4, G.H);
        ctx.strokeStyle = INK; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(sw, 0); ctx.lineTo(sw, G.H); ctx.moveTo(ew, 0); ctx.lineTo(ew, G.H); ctx.stroke();
        // green balcony awnings sticking out over the sidewalk
        for (let ay = Math.floor(cy / 30) * 30; ay < cy + G.H + 30; ay += 30) {
          if (hash(ay, 17) < 0.6) drawAwning(ctx, sw, ay - cy + hash(ay, 3) * 10, -1);
          if (hash(ay, 29) < 0.6) drawAwning(ctx, ew, ay - cy + hash(ay, 5) * 10, 1);
        }
        // road: asphalt with darker gutters
        const rg = ctx.createLinearGradient(lx, 0, rx, 0);
        rg.addColorStop(0, '#46484d'); rg.addColorStop(0.06, '#56585d'); rg.addColorStop(0.45, '#5f6166'); rg.addColorStop(0.94, '#54565b'); rg.addColorStop(1, '#45474c');
        ctx.fillStyle = rg; ctx.fillRect(lx, 0, rx - lx, G.H);
        ctx.save(); ctx.beginPath(); ctx.rect(lx, 0, rx - lx, G.H); ctx.clip();
        for (let ty = Math.floor(cy / 32) - 1; ty * 32 < cy + G.H; ty++) for (let tx = 0; tx < 6; tx++) {
          const h = hash(tx, ty); if (h > 0.55) continue;
          const px = S.curbL + 6 + tx * (S.curbR - S.curbL - 12) / 6 + h * 20 - cx, py = ty * 32 + h * 30 - cy;
          if (h < 0.18) { rr(ctx, px - 2, py - 2, 9 + h * 30, 6 + h * 16, 2.5); ctx.fillStyle = h < 0.09 ? 'rgba(40,42,48,0.4)' : 'rgba(120,122,128,0.22)'; ctx.fill(); }
          else if (h < 0.4) { ctx.strokeStyle = 'rgba(32,32,38,0.55)'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(px, py); ctx.quadraticCurveTo(px + 3 + h * 6, py + 3, px + 2, py + 6 + h * 10); ctx.stroke(); }
          else { ell(ctx, px + 2, py + 2, 3 + h * 4, 1.6, 'rgba(255,255,255,0.05)'); }
        }
        // parking lane marks + one-way arrows
        ctx.fillStyle = 'rgba(240,240,230,0.55)';
        for (let yy = Math.floor(cy / 24) * 24; yy < cy + G.H; yy += 24) { rr(ctx, S.curbL + S.PARK - cx - 0.6, yy - cy, 1.2, 12, 0.6); ctx.fill(); rr(ctx, S.curbR - S.PARK - cx - 0.6, yy - cy, 1.2, 12, 0.6); ctx.fill(); }
        // one-way: big painted arrows, all pointing up the street (two side by side, repeated often)
        for (let ay = Math.floor(y0 / 170) * 170 + 80; ay < y1; ay += 170) {
          const ayy = ay - cy;
          for (const ox of [-S.FREE / 4, S.FREE / 4]) {
            const ax = S.mid + ox - cx;
            ctx.fillStyle = 'rgba(240,240,230,0.78)'; ctx.beginPath();
            ctx.moveTo(ax, ayy - 12); ctx.lineTo(ax + 8, ayy + 1); ctx.lineTo(ax + 2.6, ayy + 1); ctx.lineTo(ax + 2.6, ayy + 30); ctx.lineTo(ax - 2.6, ayy + 30); ctx.lineTo(ax - 2.6, ayy + 1); ctx.lineTo(ax - 8, ayy + 1); ctx.closePath(); ctx.fill();
          }
        }
        // the raised kerb casts a shadow onto the road
        ctx.fillStyle = lin(ctx, lx, 0, lx + 5, 0, 'rgba(20,10,30,0.42)', 'rgba(20,10,30,0)'); ctx.fillRect(lx, 0, 5, G.H);
        ctx.fillStyle = lin(ctx, rx, 0, rx - 2, 0, 'rgba(20,10,30,0.4)', 'rgba(20,10,30,0)'); ctx.fillRect(rx - 2, 0, 2, G.H);
        ctx.restore();
        // kerbs (solid edge): raised stones painted black/white, thin ink outline
        for (let yy = Math.floor(cy / 16) * 16 - 16; yy < cy + G.H + 16; yy += 16) {
          const py = yy - cy;
          for (const kx of [lx - 6, rx + 1]) {
            rr(ctx, kx, py + 0.3, 5, 15.4, 1.3); ctx.fillStyle = lin(ctx, kx, py, kx + 5, py + 16, '#ffffff', '#d4d0c4'); ctx.fill();
            ctx.save(); ctx.clip(); ctx.fillStyle = lin(ctx, kx, py, kx + 5, py + 6, '#4a4a52', '#1e1e24'); ctx.fillRect(kx, py, 5, 6); ctx.restore();
            ctx.strokeStyle = INK; ctx.lineWidth = 0.6; rr(ctx, kx, py + 0.3, 5, 15.4, 1.3); ctx.stroke();
          }
        }
        ctx.strokeStyle = '#1a1420'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(lx - 0.5, 0); ctx.lineTo(lx - 0.5, G.H); ctx.moveTo(rx + 0.5, 0); ctx.lineTo(rx + 0.5, G.H); ctx.stroke();
        for (let yy = Math.floor(cy / 40) * 40 + 20; yy < cy + G.H + 10; yy += 40) { drawBollard(ctx, lx - 8.5, yy - cy + 1); drawBollard(ctx, rx + 9.5, yy - cy + 1); }
        // potholes
        for (const p of S.pots) if (p.y > y0 && p.y < y1) drawPothole(ctx, p.x - cx, p.y - cy, p.r);
        // sidewalk decor
        for (const d of S.decor) if (d.y > y0 && d.y < y1) {
          const x = d.x - cx, y = d.y - cy;
          if (d.kind === 'tree') drawTree(ctx, x, y);
          else if (d.kind === 'scoot') G.drawVehicle(ctx, 'scooter', d.col, x, y, d.a);
          else if (d.kind === 'dump') drawBin(ctx, x, y);
          else if (d.kind === 'bag') drawBags(ctx, x, y);
          else drawKioskSign(ctx, x, y);
        }
        // ΜΟΝΟΔΡΟΜΟΣ signs on both sidewalks
        for (let sy = Math.floor(y0 / 230) * 230 + 40; sy < y1; sy += 230) { drawOneWay(ctx, S.curbL - 15 - cx, sy - cy); drawOneWay(ctx, S.curbR + 15 - cx, sy + 115 - cy); }
        // parked stuff
        const blink = Math.floor(G.t * 3) % 2;
        for (const r of S.rects) if (r.cy > y0 && r.cy < y1) {
          if (r.kind === 'bin') { drawBin(ctx, r.cx - cx, r.cy - cy); continue; }
          G.drawVehicle(ctx, r.type, r.col, r.cx - cx, r.cy - cy, r.a);
          if (r.hz && blink) for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) glow(ctx, r.cx + b * (r.w / 2 - 2) - cx, r.cy + a * (r.h / 2 - 2) - cy, 3.4, 'rgba(255,176,0,0.95)');
        }
        // moving things, sorted by y
        const list = [];
        list.push({ y: this.car.y, d: () => this.car.draw(ctx, cx, cy) });
        const c = this.cyc;
        list.push({ y: c.y, d: () => {
          const sx = c.x - cx, sy = c.y - cy, bh = G.VEH.bike.h;
          G.drawVehicle(ctx, 'bike', '#2dd4ff', sx, sy, -Math.PI / 2 + c.lean);
          if (c.down) { G.drawPerson(ctx, G.LOOKS.cyclist, sx + 8, sy + 4, 3, 0, { down: true }); return; }
          G.drawPerson(ctx, G.LOOKS.cyclist, sx, sy + bh * 0.25, 3, c.sp > 5 ? [1, 2][Math.floor(c.anim) % 2] : 0);
          if (c.gest > 0) drawPalm(ctx, sx + 8, sy + bh * 0.25 - 16, G.t);
          else if (c.ev) drawDistraction(ctx, c.ev.k, sx + 7, sy + bh * 0.25 - 14, G.t);
        } });
        list.sort((a, b) => a.y - b.y).forEach(o => o.d());
        ctx.restore();
      },

      hud() {
        const U = G.ui, S = this.S, v = this.car, c = this.cyc, cl = S.cl;
        U.drawBubbles(this.rcx, this.rcy);
        const t = Math.ceil(this.timeLeft);
        U.title(G.W / 2, 18, String(t), 16, t <= 10 ? '#ff3b30' : '#fff');
        const gap = c.y - v.y, need = cl * 2.2;
        const open = c.ev && gap < -cl * 0.6;
        const msg = open ? 'ΚΕΝΟ! ΠΕΡΑΣΕ ΤΩΡΑ!' : gap < -cl * 0.6 ? 'Πέρασέ τον!' : gap < cl * 0.6 ? 'ΤΩΡΑ! ΠΕΡΑΣΕ!' : 'Ξέφυγε μπροστά!';
        U.text(G.W / 2, 30, msg, 8, open ? '#4cd964' : '#ffd400', 'center');
        const bw = 80, f = G.clamp((gap + cl * 6) / (need + cl * 6), 0, 1);
        U.box(G.W / 2 - bw / 2, 34, bw, 5, 'rgba(0,0,0,0.6)', null);
        U.ctx.fillStyle = f > 0.75 ? '#4cd964' : '#ffd400'; U.ctx.fillRect(G.W / 2 - bw / 2 + 1, 35, (bw - 2) * f, 3);
        if (this.penalties) U.text(6, 14, 'Ακουμπήματα: ' + this.penalties, 8, '#ff8a80');
      },
    }),
  });
})();
