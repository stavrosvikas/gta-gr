// GTA LUBEN — quest: Η στροφάρα της Κρήτης
// Top-down mountain road on Crete: dry grass, olive rows, ochre rocks, grey asphalt, hairpins with guardrails.
// White tin-can car that slides, a praying passenger, checkpoints, a goat. Forgiving timer.
// The hairpin mountain is a region of the open world (G.World.SPOTS.crete): you arrive by ship at the harbour
// (south-east), walk up the dirt path to the bottom of the road, and the quest is played right there.
// Sizes come from G.VEH and speeds from the car's spec, so it scales with the sprites.
'use strict';
(function () {
  const WS = G.worldScene, Wd = G.World, TS = G.TS || 16;
  const SP = Wd.SPOTS.crete;

  const LINE_PANAGIA = ['crete_panagia', 'Παναγία μου, θα σκοτωθούμε!'];
  const LINE_ELA = ['crete_ela', 'Οπ οπ οπ!'];               // audio key stays vo_crete_ela, bubble shows only "Έλα!"
  const LINE_STROFARA = ['crete_strofara', 'Πο πο μια στροφάρα! Έλα…!'];
  const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

  // GTA-1 style: the car goes where the arrows / stick point (engine helper). Brake: Space on PC, ΦΡΕΝΟ (b) on mobile.
  // Returns true when the car was stopped by something solid.
  function driveCar(v, dt) {
    const pre = Math.abs(v.speed);
    const brake = G.held('action') || G.held('b');
    G.driveDirect(v, dt, G.readAxis(), brake);
    return !brake && pre > 20 && Math.abs(v.speed) < pre * 0.8;
  }

  // ---------- road generation ----------
  // The map is sized to whole tiles so it can be a world region: the road is centred horizontally,
  // starts a few tiles above the bottom edge (entry) and ends in the village near the top.
  function buildRoad() {
    const tw = G.VEH.tincan.w;
    const hw = Math.max(32, Math.round(tw * 1.65));   // half road width (road >= 64px)
    const SHO = hw + 7, WALL = hw + 9;                // gravel shoulder, then rail / rock bank (solid)
    // slightly tighter than the old standalone map (R 2.3hw, rise 1.5hw) so the mountain fits on Crete
    const R = Math.round(hw * 2.1), legLen = hw * 10, rise = Math.round(hw * 1.3), N = 8;
    const M = R + WALL + 34, W0 = M * 2 + legLen, step = 3;
    const pts = [], hpStart = [], hpEnd = [];
    const push = (x, y, hp, cx, cy) => pts.push({ x, y, hp, cx, cy });
    let y = 0, dir = 1;
    for (let k = 0; k < N; k++) {
      const xs = k === 0 ? M - 30 : (dir > 0 ? M : M + legLen), xe = dir > 0 ? M + legLen : M;
      const n = Math.ceil(Math.abs(xe - xs) / step);
      for (let i = 0; i < n; i++) { const t = i / n; push(xs + (xe - xs) * t, y - rise * t + Math.sin(t * Math.PI * 2) * hw * 0.3, -1); }
      y -= rise;
      const cx = xe, cy = y - R, n2 = Math.ceil(Math.PI * R / step);
      hpStart[k] = pts.length;
      for (let i = 0; i <= n2; i++) { const th = Math.PI / 2 - dir * Math.PI * (i / n2); push(cx + R * Math.cos(th), cy + R * Math.sin(th), k, cx, cy); }
      hpEnd[k] = pts.length - 1;
      y = cy - R; dir = -dir;
    }
    // last leg to the middle, a quarter bend, then the climb into the village
    const xs = dir > 0 ? M : M + legLen, xm = M + legLen / 2, xq = xm - dir * R;
    let n = Math.ceil(Math.abs(xq - xs) / step);
    for (let i = 0; i < n; i++) push(xs + (xq - xs) * i / n, y, -1);
    n = Math.ceil(Math.PI / 2 * R / step);
    for (let i = 0; i <= n; i++) { const th = Math.PI / 2 - dir * Math.PI / 2 * (i / n); push(xq + R * Math.cos(th), y - R + R * Math.sin(th), -1); }
    y -= R;
    for (let i = 1; i <= 34; i++) push(xm, y - i * step, -1);
    const PR = hw + 34;
    const V = { x: xm, y: y - 34 * step - PR * 0.4 };
    // whole tiles: centre horizontally, top margin above the village, a short dirt track below the road start
    const TOP = 80, BOT = 50;
    let maxY = -1e9; pts.forEach(p => { if (p.y > maxY) maxY = p.y; });
    const W = Math.ceil(W0 / TS) * TS, rawH = maxY - (V.y - PR - TOP) + BOT, H = Math.ceil(rawH / TS) * TS;
    const offX = Math.round((W - W0) / 2), offY = H - BOT - maxY;
    pts.forEach(p => { p.x += offX; p.y += offY; if (p.cx != null) { p.cx += offX; p.cy += offY; } });
    V.x += offX; V.y += offY;
    // tangents, rail-side normals, arclength
    let s = 0;
    pts.forEach((p, i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      const l = Math.hypot(b.x - a.x, b.y - a.y) || 1; p.tx = (b.x - a.x) / l; p.ty = (b.y - a.y) / l;
      if (p.hp >= 0) { p.nx = (p.x - p.cx) / R; p.ny = (p.y - p.cy) / R; }   // outside of the hairpin hangs over the valley
      else { p.nx = -p.ty; p.ny = p.tx; if (p.ny < 0 || (Math.abs(p.ny) < 0.2 && p.nx < 0)) { p.nx = -p.nx; p.ny = -p.ny; } } // downhill side
      if (i) s += Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y); p.s = s;
    });
    // distance field (2px cells): distance to the centreline + nearest point
    const GS = 2, gw = Math.ceil(W / GS), gh = Math.ceil(H / GS);
    const dist = new Float32Array(gw * gh).fill(1e9), idx = new Int32Array(gw * gh).fill(-1), plaza = new Uint8Array(gw * gh);
    const RR = WALL + 16, rc = Math.ceil(RR / GS) + 1;
    pts.forEach((p, i) => {
      const gx = Math.floor(p.x / GS), gy = Math.floor(p.y / GS);
      for (let yy = Math.max(0, gy - rc); yy <= Math.min(gh - 1, gy + rc); yy++) {
        const dy = (yy + 0.5) * GS - p.y;
        for (let xx = Math.max(0, gx - rc); xx <= Math.min(gw - 1, gx + rc); xx++) {
          const dx = (xx + 0.5) * GS - p.x, d = Math.sqrt(dx * dx + dy * dy), k = yy * gw + xx;
          if (d < RR && d < dist[k]) { dist[k] = d; idx[k] = i; }
        }
      }
    });
    for (let yy = 0; yy < gh; yy++) for (let xx = 0; xx < gw; xx++) {
      if (Math.hypot((xx + 0.5) * GS - V.x, (yy + 0.5) * GS - V.y) < PR) { const k = yy * gw + xx; dist[k] = 0; idx[k] = pts.length - 1; plaza[k] = 1; }
    }
    const cell = (px, py) => (px < 0 || py < 0 || px >= W || py >= H) ? -1 : Math.floor(py / GS) * gw + Math.floor(px / GS);
    // checkpoints after hairpins 1, 3, 5, 7
    const cps = [1, 3, 5, 7].filter(k => k < N).map(k => hpEnd[k] + 6);
    return { hw, SHO, WALL, R, W, H, N, pts, hpStart, hpEnd, dist, idx, plaza, cell, V, PR, cps, gw };
  }
  const RD = buildRoad();

  // ---------- the region: placed on Crete, bottom row just above the harbour path (SP.hub row) ----------
  const RW = RD.W / TS, RH = RD.H / TS;
  const RTX = SP.tx + Math.max(0, Math.floor((SP.maxW - RW) / 2));
  const RTY = Math.max(SP.ty - 2, SP.hub[1] - 1 - RH);    // region ends on row hub-2, the dirt path comes up to row hub-1
  const ENTRY = [Math.round(RD.pts[0].x / TS) - 1, RH - 1]; // 2-tile dirt track (ENTRY x and x+1) up to the road start
  const ox = () => RTX * TS, oy = () => RTY * TS;

  // island tiles, exactly like the world paints Crete around the region: 0 sea, 1 beach sand, 2 dry grass
  const E = Wd.CRETE, SEED = 4.1;
  const landW = (x, y) => {
    const a = Math.atan2((y - E.cy) / E.ry, (x - E.cx) / E.rx), d = Math.hypot((x - E.cx) / E.rx, (y - E.cy) / E.ry);
    return d < 1 + Math.sin(a * 3 + SEED) * 0.07 + Math.sin(a * 7 + SEED * 2) * 0.04;
  };
  const CLS = new Uint8Array(RW * RH), NEAR = new Uint8Array(RW * RH);
  for (let ty = 0; ty < RH; ty++) for (let tx = 0; tx < RW; tx++) {
    const wx = RTX + tx, wy = RTY + ty, i = ty * RW + tx;
    let near = 9;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const m = Math.max(Math.abs(dx), Math.abs(dy));
      if (landW(wx, wy)) { if (m <= 2 && !landW(wx + dx, wy + dy)) near = Math.min(near, m); }
      else if (landW(wx + dx, wy + dy)) near = Math.min(near, m);
    }
    if (landW(wx, wy)) { CLS[i] = near <= 2 ? 1 : 2; NEAR[i] = 0; } else { CLS[i] = 0; NEAR[i] = near; }
  }
  const clsAt = (px, py) => { const tx = Math.floor(px / TS), ty = Math.floor(py / TS); return (tx < 0 || ty < 0 || tx >= RW || ty >= RH) ? 2 : CLS[ty * RW + tx]; };
  // inland: dry grass with no sand/sea within m px
  // (the world's smooth shoreline: beach sand reaches ~34 px inland, see W.paintCoast)
  const inland = Wd.coastDist ? (px, py, m = 0) => Wd.coastDist('crete', ox() + px, oy() + py) > 34 + m
    : (px, py, m = 0) => clsAt(px, py) === 2 && (!m || (clsAt(px - m, py) === 2 && clsAt(px + m, py) === 2 && clsAt(px, py - m) === 2 && clsAt(px, py + m) === 2));

  // ---------- static layout shared by the painter and the world collision ----------
  const { V: VIL, PR: VPR } = RD;
  const HOUSES = [];
  for (let i = 0; i < 11; i++) {
    const ang = Math.PI * 0.62 + i * (Math.PI * 1.76 / 10) + Math.PI;
    const hx = VIL.x + Math.cos(ang) * (VPR + 22), hy = VIL.y + Math.sin(ang) * (VPR + 18);
    if (hy > VIL.y + VPR * 0.55) continue;
    if (i === 5) HOUSES.push({ church: true, x: hx, y: hy, l: hx - 14, t: hy - 16, w: 28, h: 32 });
    else { const w = 26 + hash(i, 3) * 12, h = 20 + hash(i, 5) * 8; HOUSES.push({ i, x: hx, y: hy, l: hx - w / 2, t: hy - h / 2, w, h }); }
  }
  // olive trees in rows (row = every 26px, staggered columns every 24px)
  function oliveAt(row, col) {
    const gy = 10 + row * 26, gx = 8 + (row % 2) * 12 + col * 24;
    if (row < 0 || col < 0 || gy >= RD.H || gx >= RD.W) return null;
    const jx = gx + (hash(gx, gy) - 0.5) * 6, jy = gy + (hash(gy, gx) - 0.5) * 6, k = RD.cell(jx, jy);
    if (k < 0 || RD.dist[k] < RD.WALL + 12 || hash(gx * 3, gy) < 0.12) return null;
    if (Math.hypot(jx - VIL.x, jy - VIL.y) < VPR + 60) return null;
    if (!inland(jx, jy, 10)) return null;
    if (Math.abs(jx - (ENTRY[0] + 1) * TS) < 28 && jy > RD.pts[0].y) return null;    // keep the dirt track clear
    return { x: jx, y: jy, r: 6 + hash(gx, gy * 7) * 3, h: hash(gy * 3, gx) };
  }
  // big ochre boulders out in the fields (solid in the open world)
  const ROCKS = [];
  for (let gy = 40; gy < RD.H - 20; gy += 58) for (let gx = 30; gx < RD.W - 20; gx += 62) {
    const h = hash(gx * 11 + 5, gy * 7 + 3); if (h > 0.2) continue;
    const px = gx + (hash(gx, gy * 5) - 0.5) * 30, py = gy + (hash(gy * 5, gx) - 0.5) * 30, k = RD.cell(px, py);
    if (k < 0 || RD.dist[k] < RD.WALL + 22 || Math.hypot(px - VIL.x, py - VIL.y) < VPR + 70 || !inland(px, py, 14)) continue;
    if (Math.abs(px - (ENTRY[0] + 1) * TS) < 34 && py > RD.pts[0].y - 20) continue;
    const rr0 = 5 + h * 22; if (px - rr0 < 6 || py - rr0 < 6 || px + rr0 + 8 > RD.W || py + rr0 + 8 > RD.H) continue; // whole boulders only (no cut at the region border)
    ROCKS.push({ x: px, y: py, r: 5 + h * 22, a: h * 40 });
  }

  // the north pier: from the village a dirt path leads north (between the houses) to a little pier on the beach, which
  // continues out to sea as world tiles (W.DOCKS.crete_north, x-1..x+1). Local px: l..r wide, from the region top down to b.
  const NP = Wd.DOCKS && Wd.DOCKS.crete_north;
  const PIER = NP ? { l: (NP[0] - 1 - RTX) * TS, r: (NP[0] + 2 - RTX) * TS } : null;
  if (PIER) {
    PIER.cx = (PIER.l + PIER.r) / 2;
    let y = 0; while (y < 200 && !(Wd.coastDist ? Wd.coastDist('crete', ox() + PIER.cx, oy() + y) > 3 : CLS[Math.floor(y / TS) * RW + Math.floor(PIER.cx / TS)] > 0)) y += 2;
    PIER.b = y + 12;
  }

  // open-world collision (local px): sea, houses, boulders, olive trunks, rock bank + guardrail along the road.
  // The road itself, the dirt track, the fields and the village square are free to walk / drive.
  function regionSolid(lx, ly) {
    const tx = Math.floor(lx / TS), ty = Math.floor(ly / TS);
    if (tx < 0 || ty < 0 || tx >= RW || ty >= RH) return false;
    if (PIER && lx > PIER.l + 1 && lx < PIER.r - 1 && ly < PIER.b) return false;
    if (CLS[ty * RW + tx] === 0) return true;
    for (const h of HOUSES) if (lx > h.l + 1 && lx < h.l + h.w - 1 && ly > h.t + 1 && ly < h.t + h.h - 1) return true;
    const k = RD.cell(lx, ly);
    if (k >= 0 && !RD.plaza[k]) {
      const d = RD.dist[k], i = RD.idx[k];
      if (i >= 0 && d > RD.WALL && d < RD.WALL + 9 && Math.hypot(lx - VIL.x, ly - VIL.y) > VPR + 22) {
        const p0 = RD.pts[0];
        if (!(i < 10 && (lx - p0.x) * p0.tx + (ly - p0.y) * p0.ty < 4)) return true;   // the road start stays open
      }
    }
    for (const r of ROCKS) if (Math.hypot(lx - r.x, ly - r.y) < r.r * 0.8) return true;
    const row = Math.round((ly - 10) / 26);
    for (let rw = row - 1; rw <= row + 1; rw++) {
      const c0 = Math.round((lx - 8 - (((rw % 2) + 2) % 2) * 12) / 24);
      for (let c = c0 - 1; c <= c0 + 1; c++) { const o = oliveAt(rw, c); if (o && Math.hypot(lx - o.x, ly - o.y) < o.r * 0.55) return true; }
    }
    return false;
  }

  // ---------- background painter (HD-2D). Used by the world chunks AND the quest (the quest draws the world). ----------
  const INK = 'rgba(28,20,36,0.85)', SHD = 'rgba(20,10,30,0.28)', TAU = Math.PI * 2;
  function rr(x, px, py, w, h, r) { x.beginPath(); if (x.roundRect) x.roundRect(px, py, w, h, r); else x.rect(px, py, w, h); }
  function lin(x, x0, y0, x1, y1, a, b) { const g = x.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, a); g.addColorStop(1, b); return g; }
  function blob(x, px, py, r, inner, outer) { const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, inner); g.addColorStop(1, outer); x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2); }

  // ---------- Crete art shared with the open world: js/world.js paints the rest of the island with these, in world px ----------
  // The olive rows are one lattice over the whole island, anchored at the region origin (row = 26 px, columns 24 px, staggered).
  const ORX = RTX * TS, ORY = RTY * TS;
  const sstep = t => t * t * (3 - 2 * t);
  function vnoise(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y), fx = sstep(x - ix), fy = sstep(y - iy);
    const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }
  const inRegion = (wx, wy) => wx >= ORX && wy >= ORY && wx < ORX + RD.W && wy < ORY + RD.H;
  // ground that carries tints / tufts / trees: Crete land past the beach, not on world paths, piers or rocks
  function landOK(wx, wy, m) {
    if (!(Wd.coastDist ? Wd.coastDist('crete', wx, wy) > 34 + m : inRegion(wx, wy) && inland(wx - ORX, wy - ORY, m))) return false;
    if (inRegion(wx, wy)) return true;
    const c = Wd.get(Math.floor(wx / TS), Math.floor(wy / TS)); return c === 'g' || c === 's' || c === 'Z';
  }
  // orchard density: the quest's orchard is dense; out in the world it varies in big soft patches and meets the orchard smoothly
  function density(wx, wy) {
    if (inRegion(wx, wy)) return 0.88;
    const base = 0.1 + vnoise(wx / 176 + 11, wy / 176 + 5) * 0.85;
    const dx = Math.max(ORX - wx, 0, wx - ORX - RD.W), dy = Math.max(ORY - wy, 0, wy - ORY - RD.H), t = G.clamp(1 - Math.hypot(dx, dy) / 120, 0, 1);
    return base + (0.88 - base) * sstep(t);
  }
  const latInside = (row, col) => row >= 0 && col >= 0 && 10 + row * 26 < RD.H && 8 + (row % 2) * 12 + col * 24 < RD.W;
  // whole tree inside the region (with its shadow): the region paints it; trees at the border are painted by the world on top
  const oliveInterior = o => o.x - o.r - 2 > 0 && o.y - o.r - 2 > 0 && o.x + o.r + 6 < RD.W && o.y + o.r + 6 < RD.H;
  function latticeOlive(row, col) {
    if (latInside(row, col)) return oliveAt(row, col);
    const gy = 10 + row * 26, gx = 8 + (((row % 2) + 2) % 2) * 12 + col * 24;
    const jx = gx + (hash(gx, gy) - 0.5) * 6, jy = gy + (hash(gy, gx) - 0.5) * 6, wx = ORX + jx, wy = ORY + jy;
    if (hash(gx * 3, gy) < 1 - density(wx, wy) || !landOK(wx, wy, 10)) return null;
    for (const [dx, dy] of [[-12, 0], [12, 0], [0, -12], [0, 12]]) {
      const px = wx + dx, py = wy + dy;
      if (inRegion(px, py)) { const k = RD.cell(px - ORX, py - ORY); if (k >= 0 && RD.dist[k] < RD.WALL + 14) return null; continue; }
      const c = Wd.get(Math.floor(px / TS), Math.floor(py / TS)); if (c !== 'g' && c !== 's') return null;
    }
    return { x: jx, y: jy, r: 6 + hash(gx, gy * 7) * 3, h: hash(gy * 3, gx) };
  }
  const ART = G.CRETE_ART = {
    // soft tints, terrace walls along the olive rows, ochre stones and dry tufts (world px; ctx in world px)
    ground(x, X0, Y0, X1, Y1) {
      for (let gy = Math.floor((Y0 - 80) / 70) * 70; gy < Y1 + 80; gy += 70) for (let gx = Math.floor((X0 - 80) / 70) * 70; gx < X1 + 80; gx += 70) {
        const h = hash(gx, gy), px = gx + hash(gy, gx) * 50, py = gy + hash(gx + 7, gy) * 50, r = 40 + h * 40;
        if (px + r < X0 || px - r > X1 || py + r < Y0 || py - r > Y1 || !landOK(px, py, 24)) continue;
        blob(x, px, py, r, h < 0.35 ? 'rgba(214,214,140,0.34)' : h < 0.7 ? 'rgba(130,138,64,0.2)' : 'rgba(206,160,98,0.32)', 'rgba(180,188,104,0)');
      }
      x.strokeStyle = 'rgba(120,96,50,0.16)'; x.lineWidth = 1.4; x.lineCap = 'round'; x.beginPath();
      for (let gy = ORY + 23 + Math.floor((Y0 - 24 - ORY - 23) / 26) * 26; gy < Y1 + 24; gy += 26) for (let gx = ORX + Math.floor((X0 - 44 - ORX) / 40) * 40; gx < X1 + 4; gx += 40) {
        if (!landOK(gx, gy, 6) || !landOK(gx + 40, gy, 6) || density(gx + 20, gy) < 0.5) continue;
        x.moveTo(gx, gy); x.quadraticCurveTo(gx + 20, gy + (hash(gx - ORX, gy - ORY) - 0.5) * 6, gx + 40, gy);
      }
      x.stroke();
      for (let gy = Math.floor(Y0 / 22) * 22 - 22; gy < Y1 + 22; gy += 22) for (let gx = Math.floor(X0 / 22) * 22 - 22; gx < X1 + 22; gx += 22) {
        const h = hash(gx * 5 + 1, gy * 3 + 2), px = gx + hash(gx, gy * 9) * 22, py = gy + hash(gy, gx * 9) * 22;
        if (h >= 0.24 || !landOK(px, py, 0)) continue;
        if (h < 0.1) { // stone
          x.fillStyle = 'rgba(20,10,30,0.18)'; x.beginPath(); x.ellipse(px + 1, py + 1.2, 2.4, 1.6, 0, 0, TAU); x.fill();
          x.fillStyle = lin(x, px - 2, py - 2, px + 2, py + 2, '#f2d7a4', '#b08050'); x.beginPath(); x.ellipse(px, py, 2.2, 1.5, h * 30, 0, TAU); x.fill();
        } else { // dry grass tuft
          x.strokeStyle = h < 0.17 ? 'rgba(128,136,60,0.75)' : 'rgba(176,150,80,0.7)'; x.lineWidth = 0.6; x.beginPath();
          for (let i = -1; i <= 1; i++) { x.moveTo(px + i, py); x.quadraticCurveTo(px + i * 1.6, py - 2, px + i * 2.6, py - 3.5 + Math.abs(i)); }
          x.stroke();
        }
      }
    },
    // olive trees on the island lattice (except the ones the region paints itself) + ochre boulders on the world's rock tiles
    objects(x, X0, Y0, X1, Y1) {
      const r0 = Math.floor((Y0 - ORY - 40) / 26), r1 = Math.ceil((Y1 - ORY + 20) / 26);
      for (let row = r0; row <= r1; row++) {
        const par = ((row % 2) + 2) % 2, c0 = Math.floor((X0 - ORX - 8 - par * 12 - 30) / 24), c1 = Math.ceil((X1 - ORX - 8 - par * 12 + 30) / 24);
        for (let col = c0; col <= c1; col++) {
          const o = latticeOlive(row, col); if (!o || (latInside(row, col) && oliveInterior(o))) continue;
          olive(x, ORX + o.x, ORY + o.y, o.r, o.h);
        }
      }
      for (let ty = Math.floor(Y0 / TS) - 1; ty <= Math.floor(Y1 / TS) + 1; ty++) for (let tx = Math.floor(X0 / TS) - 1; tx <= Math.floor(X1 / TS) + 1; tx++) {
        if (Wd.get(tx, ty) !== 'K' || Wd.area(tx, ty) !== 'crete') continue;
        const h = hash(tx * 7 + 1, ty * 5 + 3); boulder(x, tx * TS + 8 + (h - 0.5) * 2, ty * TS + 8.5, 8.4 + h * 1.8, h * 6 - 3);
      }
    },
    // world collision: olive trunks outside the region (the region's own trees collide through its solid())
    solid(wx, wy) {
      if (Math.abs(wx / TS - E.cx) > E.rx * 1.15 || Math.abs(wy / TS - E.cy) > E.ry * 1.15) return false;
      const lx = wx - ORX, ly = wy - ORY, row = Math.round((ly - 10) / 26);
      for (let rw = row - 1; rw <= row + 1; rw++) {
        const c0 = Math.round((lx - 8 - (((rw % 2) + 2) % 2) * 12) / 24);
        for (let c = c0 - 1; c <= c0 + 1; c++) { if (latInside(rw, c)) continue; const o = latticeOlive(rw, c); if (o && Math.hypot(lx - o.x, ly - o.y) < o.r * 0.55) return true; }
      }
      return false;
    },
    olive: (x, px, py, r, h) => olive(x, px, py, r, h), boulder: (x, px, py, r, a) => boulder(x, px, py, r, a),
  };
  // grass on land, open sea far out (as the world's 'O' tiles); the shore, beach and near water come from W.paintCoast
  function baseTile(x, tx, ty) {
    const r = G.hash(RTX + tx, RTY + ty), X = tx * TS, Y = ty * TS;
    if (CLS[ty * RW + tx] === 0 && !(Wd.isleTileLand && Wd.isleTileLand('crete', RTX + tx, RTY + ty))) {
      x.fillStyle = (Wd.SEA_COLS || [])[4] || '#2468c4'; x.fillRect(X, Y, 16, 16);
      if (r < 0.18) { x.strokeStyle = 'rgba(255,255,255,0.35)'; x.lineWidth = 0.8; x.beginPath(); const wx = X + 2 + r * 40 % 9, wy = Y + 4 + (r * 97 % 8); x.moveTo(wx, wy); x.quadraticCurveTo(wx + 3, wy - 2, wx + 6, wy); x.stroke(); }
      return;
    }
    x.fillStyle = '#b4bc68'; x.fillRect(X, Y, 16, 16);
    if (r < 0.35) { x.strokeStyle = '#8f9a4a'; x.lineWidth = 0.7; x.beginPath(); x.moveTo(X + 4, Y + 10); x.quadraticCurveTo(X + 5, Y + 6, X + 7, Y + 5); x.moveTo(X + 10, Y + 13); x.quadraticCurveTo(X + 11, Y + 9, X + 12, Y + 8); x.stroke(); }
  }

  // paint the visible local rect [xa,ya]-[xb,yb] (ctx is clipped by the caller)
  function paintCrete(x, Rd, xa, ya, xb, yb) {
    const { W, H, hw, WALL, pts, V, PR } = Rd;
    const inY = (y, m = 0) => y > ya - m && y < yb + m;
    const inR = (px, py, m) => px > xa - m && px < xb + m && py > ya - m && py < yb + m;
    x.lineJoin = 'round'; x.lineCap = 'round';
    // --- island ground, beach and sea: exactly what the world paints around the region (shared painters, world px) ---
    const t0 = Math.max(0, Math.floor(xa / TS)), t1 = Math.min(RW - 1, Math.floor((xb - 0.01) / TS));
    const u0 = Math.max(0, Math.floor(ya / TS)), u1 = Math.min(RH - 1, Math.floor((yb - 0.01) / TS));
    for (let ty = u0; ty <= u1; ty++) for (let tx = t0; tx <= t1; tx++) baseTile(x, tx, ty);
    x.save(); x.translate(-ORX, -ORY);
    ART.ground(x, ORX + xa, ORY + ya, ORX + xb, ORY + yb);
    if (Wd.paintCoast) Wd.paintCoast(x, 'crete', ORX + xa, ORY + ya, ORX + xb, ORY + yb);
    x.restore();
    x.lineJoin = 'round'; x.lineCap = 'round';
    // --- the dirt track from the harbour path (bottom edge) up to the road start ---
    const p0 = pts[0], trX = (ENTRY[0] + 1) * TS;
    if (inY((p0.y + H) / 2, (H - p0.y) / 2 + 30)) {
      const track = new Path2D(); track.moveTo(trX, H + 4); track.quadraticCurveTo(trX, p0.y + 10, p0.x, p0.y);
      x.lineWidth = 40; x.strokeStyle = 'rgba(196,150,96,0.3)'; x.stroke(track);
      x.lineWidth = 32; x.strokeStyle = '#f0e2b8'; x.stroke(track);
      x.lineWidth = 22; x.strokeStyle = 'rgba(220,203,152,0.6)'; x.stroke(track);
      x.lineWidth = 12; x.strokeStyle = '#f0e2b8'; x.stroke(track);
    }
    // --- village wall ring (the road corridor painted next covers its gap) ---
    if (inY(V.y, PR + 20)) {
      x.fillStyle = SHD; x.beginPath(); x.arc(V.x + 3, V.y + 4, PR + 5, 0, TAU); x.fill();
      x.fillStyle = lin(x, V.x - PR, V.y - PR, V.x + PR, V.y + PR, '#ffffff', '#ddd6c6'); x.beginPath(); x.arc(V.x, V.y, PR + 5, 0, TAU); x.fill();
      x.strokeStyle = INK; x.lineWidth = 0.8; x.stroke();
    }
    // --- north: dirt path from the square between the houses down to the beach, and the little pier out to sea ---
    if (PIER && ya < V.y) {
      const track = new Path2D(); track.moveTo(V.x, V.y - PR + 6); track.quadraticCurveTo(V.x, PIER.b + 4, PIER.cx, PIER.b - 6);
      x.lineWidth = 26; x.strokeStyle = 'rgba(196,150,96,0.3)'; x.stroke(track);
      x.lineWidth = 20; x.strokeStyle = '#f0e2b8'; x.stroke(track);
      x.lineWidth = 12; x.strokeStyle = 'rgba(220,203,152,0.6)'; x.stroke(track);
      x.lineWidth = 6; x.strokeStyle = '#f0e2b8'; x.stroke(track);
      const { l, r, b } = PIER;
      x.fillStyle = '#a8794a'; x.fillRect(l, -2, r - l, b + 2);
      for (let i = 0; i < b; i += 4) { x.fillStyle = '#6e4a2a'; x.fillRect(l, i, r - l, 0.7); x.fillStyle = '#c89a68'; x.fillRect(l, i + 0.7, r - l, 0.6); } // planks, as the world's 'D' tiles
      x.fillStyle = '#4a3018'; x.fillRect(l, -2, 1.2, b + 2); x.fillRect(r - 1.2, -2, 1.2, b + 2);
      x.fillStyle = 'rgba(20,10,30,0.25)'; x.fillRect(l, b, r - l, 2);
    }
    // --- road corridor: everything inside WALL is drivable ---
    const path = new Path2D();   // whole centreline; the chunk clip keeps it cheap
    pts.forEach((p, i) => i ? path.lineTo(p.x, p.y) : path.moveTo(p.x, p.y));
    const stroke = (w, col) => { x.lineWidth = w; x.strokeStyle = col; x.stroke(path); };
    stroke(WALL * 2 + 30, 'rgba(196,150,96,0.22)');   // ochre verge: the cut earth blends into the dry grass
    stroke(WALL * 2 + 14, 'rgba(200,152,98,0.4)');
    stroke(WALL * 2 + 1.6, '#4a3420');           // dark edge = where the drivable area ends
    stroke(WALL * 2, '#c4a97c');                  // gravel shoulder (slow)
    stroke((hw + 7) * 2, '#bda076');
    stroke(hw * 2 + 1.2, '#4c4d50');               // asphalt rim
    stroke(hw * 2, '#6f706f');                     // asphalt
    stroke((hw - 3) * 2, '#e4e4e0');               // white edge line
    stroke((hw - 5) * 2, '#717271');
    stroke((hw - 14) * 2, 'rgba(255,255,255,0.035)');
    // gravel bits along the shoulders
    for (let i = 0; i < pts.length; i += 2) {
      const p = pts[i]; if (!inY(p.y, WALL)) continue;
      for (const sg of [-1, 1]) {
        const h = hash(i, sg + 3); if (h > 0.5) continue;
        const o = sg * (hw + 1.5 + h * 2 * (WALL - hw - 3)), gx = p.x + p.nx * o + p.tx * h * 3, gy = p.y + p.ny * o + p.ty * h * 3;
        x.fillStyle = h < 0.25 ? 'rgba(120,96,60,0.55)' : 'rgba(240,226,196,0.6)'; x.beginPath(); x.ellipse(gx, gy, 0.9 + h, 0.7 + h * 0.6, 0, 0, TAU); x.fill();
      }
    }
    // asphalt patches and cracks
    for (let i = 0; i < pts.length; i += 7) {
      const p = pts[i]; if (!inY(p.y, hw)) continue;
      const h = hash(i, 77), o = (hash(77, i) - 0.5) * (hw - 12) * 2, px = p.x + p.nx * o, py = p.y + p.ny * o;
      if (h < 0.16) { x.save(); x.translate(px, py); x.rotate(Math.atan2(p.ty, p.tx)); rr(x, -6 - h * 20, -3 - h * 10, 12 + h * 40, 6 + h * 20, 2.5); x.fillStyle = h < 0.08 ? 'rgba(60,60,64,0.35)' : 'rgba(150,150,150,0.2)'; x.fill(); x.restore(); }
      else if (h < 0.3) { x.strokeStyle = 'rgba(40,40,44,0.5)'; x.lineWidth = 0.6; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + p.tx * 5 + p.nx * 3, py + p.ty * 5 + p.ny * 3, px + p.tx * 9 - p.nx * 2, py + p.ty * 9 - p.ny * 2); x.stroke(); }
    }
    // centre dashes on the straights
    x.strokeStyle = 'rgba(236,236,232,0.92)'; x.lineWidth = 1.8; x.lineCap = 'butt'; x.beginPath();
    let on = false;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], dash = p.hp < 0 && Math.floor(p.s / 10) % 2 === 0 && inY(p.y, 20);
      if (dash && !on) { x.moveTo(p.x, p.y); on = true; } else if (dash) x.lineTo(p.x, p.y); else on = false;
    }
    x.stroke(); x.lineCap = 'round';
    // --- village square paving (drivable, it is the finish) ---
    if (inY(V.y, PR + 20)) {
      x.save(); x.beginPath(); x.arc(V.x, V.y, PR, 0, TAU); x.clip();
      const g = x.createRadialGradient(V.x - PR * 0.3, V.y - PR * 0.35, 4, V.x, V.y, PR); g.addColorStop(0, '#efe4cc'); g.addColorStop(1, '#cdbd9c'); x.fillStyle = g; x.fillRect(V.x - PR, V.y - PR, PR * 2, PR * 2);
      x.strokeStyle = 'rgba(120,100,70,0.28)'; x.lineWidth = 0.5; x.beginPath();
      for (let r = 10; r < PR; r += 9) { x.moveTo(V.x + r, V.y); x.arc(V.x, V.y, r, 0, TAU); }
      for (let a = 0; a < 24; a++) { const t = a / 24 * TAU; x.moveTo(V.x + Math.cos(t) * 10, V.y + Math.sin(t) * 10); x.lineTo(V.x + Math.cos(t) * PR, V.y + Math.sin(t) * PR); }
      x.stroke();
      x.fillStyle = lin(x, V.x, V.y - PR, V.x, V.y - PR + 8, 'rgba(20,10,30,0.25)', 'rgba(20,10,30,0)'); x.fillRect(V.x - PR, V.y - PR, PR * 2, 8);
      x.restore();
      const gap = PIER ? Math.asin(Math.min(1, 9 / PR)) : 0; // opening at the top for the path to the north pier
      x.strokeStyle = INK; x.lineWidth = 0.8; x.beginPath(); x.arc(V.x, V.y, PR, Math.PI * 0.72, Math.PI * 1.5 - gap); x.stroke();
      x.beginPath(); x.arc(V.x, V.y, PR, Math.PI * 1.5 + gap, Math.PI * 2.28); x.stroke();
    }
    // --- solid edges: rock cut on the hill side, guardrail on the valley side ---
    const { cell, idx } = Rd;
    const ok = (i, off) => {
      const p = pts[i]; if (Math.hypot(p.x - V.x, p.y - V.y) < PR + 20) return false;
      const k = cell(p.x + p.nx * off, p.y + p.ny * off); return k >= 0 && Math.abs(idx[k] - i) <= 12;
    };
    const run = (off, w, col, dx = 0, dy = 0, test = off) => {
      x.lineWidth = w; x.strokeStyle = col; x.beginPath();
      let pen = false;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        if (!inY(p.y, WALL + 30) || !ok(i, test)) { pen = false; continue; }
        if (pen && i > 0 && p.nx * pts[i - 1].nx + p.ny * pts[i - 1].ny < 0.3) pen = false; // the side flips: start a new run
        const qx = p.x + p.nx * off + dx, qy = p.y + p.ny * off + dy;
        if (!pen) { x.moveTo(qx, qy); pen = true; } else x.lineTo(qx, qy);
      }
      x.stroke();
    };
    // hill side (-n): ochre rock face
    run(-(WALL + 6), 11, 'rgba(20,10,30,0.22)', 3, 4, -(WALL + 2));
    run(-(WALL + 5.5), 10, '#8c6642', 0, 0, -(WALL + 2));
    run(-(WALL + 8.5), 3, '#a88058', 0, 0, -(WALL + 2));
    run(-(WALL + 2.5), 2.4, '#6a4a2e', 0, 0, -(WALL + 2));
    run(-(WALL + 0.6), 1.3, '#3a2616', 0, 0, -(WALL + 2));
    for (let i = 0; i < pts.length; i += 3) { // rock lumps + loose stones at the foot
      const p = pts[i]; if (!inY(p.y, WALL + 20) || !ok(i, -(WALL + 2))) continue;
      const h = hash(i, 31), o = -(WALL + 4 + h * 5), rx = p.x + p.nx * o, ry = p.y + p.ny * o, r = 2.2 + h * 2.4;
      const g = x.createRadialGradient(rx - r * 0.4, ry - r * 0.4, 0.3, rx, ry, r); g.addColorStop(0, '#b48c62'); g.addColorStop(1, '#6e4c2e');
      x.fillStyle = g; x.beginPath(); x.ellipse(rx, ry, r, r * 0.8, h * 6, 0, TAU); x.fill(); x.strokeStyle = 'rgba(28,20,36,0.5)'; x.lineWidth = 0.5; x.stroke();
      if (h < 0.4) { const fo = -(WALL - 2 - h * 4), fx = p.x + p.nx * fo, fy = p.y + p.ny * fo; x.fillStyle = '#9a7a54'; x.beginPath(); x.ellipse(fx, fy, 1.3, 1, 0, 0, TAU); x.fill(); }
    }
    // valley side (+n): slope falling away, posts, rail
    run(WALL + 7, 10, 'rgba(110,70,36,0.18)', 0, 0, WALL + 1);
    for (let i = 0; i < pts.length; i += 5) {
      const p = pts[i]; if (!inY(p.y, WALL + 10) || !ok(i, WALL + 1)) continue;
      const px = p.x + p.nx * (WALL + 2.2), py = p.y + p.ny * (WALL + 2.2);
      x.fillStyle = SHD; x.beginPath(); x.ellipse(px + 2, py + 2.5, 1.8, 1.2, 0, 0, TAU); x.fill();
      rr(x, px - 1.3, py - 1.3, 2.6, 2.6, 0.6); x.fillStyle = lin(x, px - 1.3, py - 1.3, px + 1.3, py + 1.3, '#9a9ca2', '#3e4046'); x.fill(); x.strokeStyle = INK; x.lineWidth = 0.5; x.stroke();
    }
    run(WALL + 1, 2.6, 'rgba(20,10,30,0.3)', 1.5, 2);
    run(WALL + 1, 2.8, '#2a2630');
    run(WALL + 1, 1.8, '#c9ced6');
    run(WALL + 0.6, 0.6, 'rgba(255,255,255,0.9)');
    // --- checkpoints: chequered stripe across the road + flag posts ---
    Rd.cps.forEach(ci => {
      const p = pts[ci]; if (!inY(p.y, hw + 20)) return;
      x.save(); x.translate(p.x, p.y); x.rotate(Math.atan2(p.ty, p.tx));
      for (let t = -hw, j = 0; t < hw; t += 4, j++) for (let r = 0; r < 2; r++) { x.fillStyle = (j + r) % 2 ? '#1b1b20' : '#f4f4f0'; x.fillRect(r * 4 - 4, t, 4, 4); }
      x.strokeStyle = INK; x.lineWidth = 0.5; x.strokeRect(-4, -hw, 8, hw * 2);
      x.restore();
      for (const sgn of [-1, 1]) {
        const bx = p.x + p.nx * sgn * (hw + 4), by = p.y + p.ny * sgn * (hw + 4);
        x.fillStyle = SHD; x.beginPath(); x.ellipse(bx + 3, by + 2, 3, 1.4, 0, 0, TAU); x.fill();
        x.strokeStyle = '#2e2e34'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(bx, by); x.lineTo(bx, by - 12); x.stroke();
        rr(x, bx + 0.6, by - 12.5, 8, 5.5, 1); x.fillStyle = sgn < 0 ? lin(x, bx, by - 12, bx + 8, by - 7, '#3d7fe0', '#1a4ea8') : lin(x, bx, by - 12, bx + 8, by - 7, '#ffffff', '#cfd2d8'); x.fill();
        x.strokeStyle = INK; x.lineWidth = 0.5; x.stroke();
      }
    });
    // --- ochre boulders ---
    for (const r of ROCKS) if (inR(r.x, r.y, r.r + 8)) boulder(x, r.x, r.y, r.r, r.a);
    // --- olive trees in rows ---
    for (let gy = 10, row = 0; gy < H; gy += 26, row++) {
      if (!inY(gy, 20)) continue;
      for (let col = 0; 8 + (row % 2) * 12 + col * 24 < W; col++) {
        const gx = 8 + (row % 2) * 12 + col * 24; if (gx < xa - 24 || gx > xb + 24) continue;
        const o = oliveAt(row, col); if (o && oliveInterior(o)) olive(x, o.x, o.y, o.r, o.h); // border trees: drawn whole by the world (G.CRETE_ART.objects)
      }
    }
    // --- the village at the top: whitewashed houses + a little church ---
    if (inY(V.y, PR + 60)) {
      for (const h of HOUSES) if (h.church) church(x, h.x, h.y); else house(x, h.x, h.y, h.w, h.h, h.i);
      // kafeneio tables on the square
      for (let i = 0; i < 4; i++) {
        const tx = V.x - PR * 0.55 + i * 9 + 2.5, ty = V.y - PR * 0.5 + 2.5;
        x.fillStyle = SHD; x.beginPath(); x.ellipse(tx + 2, ty + 2.5, 3.2, 2.4, 0, 0, TAU); x.fill();
        for (const sx of [-4.2, 4.2]) { rr(x, tx + sx - 1, ty - 1.5, 2, 3, 0.6); x.fillStyle = '#2f6fbf'; x.fill(); x.strokeStyle = INK; x.lineWidth = 0.4; x.stroke(); }
        const g = x.createRadialGradient(tx - 1, ty - 1, 0.3, tx, ty, 3); g.addColorStop(0, '#a47448'); g.addColorStop(1, '#5e3e22');
        x.fillStyle = g; x.beginPath(); x.arc(tx, ty, 2.8, 0, TAU); x.fill(); x.strokeStyle = INK; x.lineWidth = 0.5; x.stroke();
      }
    }
  }
  function boulder(x, px, py, r, a) {
    x.fillStyle = SHD; x.beginPath(); x.ellipse(px + 3, py + 4, r * 1.05, r * 0.72, 0, 0, TAU); x.fill();
    const g = x.createRadialGradient(px - r * 0.4, py - r * 0.45, r * 0.1, px, py, r * 1.1); g.addColorStop(0, '#e6bf86'); g.addColorStop(0.6, '#bf8a52'); g.addColorStop(1, '#8a5c32');
    x.fillStyle = g; x.beginPath(); x.ellipse(px, py, r, r * 0.78, a, 0, TAU); x.fill(); x.strokeStyle = INK; x.lineWidth = 0.7; x.stroke();
    x.strokeStyle = 'rgba(110,70,36,0.45)'; x.lineWidth = 0.6; x.beginPath(); x.moveTo(px - r * 0.2, py - r * 0.5); x.quadraticCurveTo(px + r * 0.1, py, px - r * 0.05, py + r * 0.5); x.stroke();
    x.fillStyle = 'rgba(255,240,210,0.35)'; x.beginPath(); x.ellipse(px - r * 0.38, py - r * 0.36, r * 0.32, r * 0.18, -0.5, 0, TAU); x.fill();
  }
  function olive(x, px, py, r, h) {
    x.fillStyle = 'rgba(60,40,20,0.32)'; x.beginPath(); x.ellipse(px + 3, py + 4, r + 1.5, r * 0.75, 0, 0, TAU); x.fill();
    const parts = [[0, 0, r], [-r * 0.45, -r * 0.25, r * 0.7], [r * 0.4, -r * 0.4, r * 0.6], [r * 0.3, r * 0.3, r * 0.62]];
    x.strokeStyle = INK; x.lineWidth = 1.1; for (const [a, b, s] of parts) { x.beginPath(); x.arc(px + a, py + b, s, 0, TAU); x.stroke(); }
    for (const [a, b, s] of parts) {
      const g = x.createRadialGradient(px + a - s * 0.4, py + b - s * 0.45, 0.4, px + a, py + b, s);
      g.addColorStop(0, '#9aa766'); g.addColorStop(0.55, '#64733a'); g.addColorStop(1, '#3f4a22');
      x.fillStyle = g; x.beginPath(); x.arc(px + a, py + b, s, 0, TAU); x.fill();
    }
    x.strokeStyle = 'rgba(214,222,180,0.55)'; x.lineWidth = 0.6; x.beginPath();
    for (let i = 0; i < 4; i++) { const a = h * 9 + i * 1.7, lx = px + Math.cos(a) * r * 0.45 - 1, ly = py + Math.sin(a) * r * 0.45 - 1; x.moveTo(lx, ly); x.lineTo(lx + 1.6, ly - 0.6); }
    x.stroke();
  }
  function house(x, hx, hy, w, h, i) {
    const l = hx - w / 2, t = hy - h / 2;
    rr(x, l + 3, t + 4, w, h, 2); x.fillStyle = SHD; x.fill();
    rr(x, l, t, w, h, 2); x.fillStyle = lin(x, l, t, l + w, t + h, '#ffffff', '#ddd7c8'); x.fill(); x.strokeStyle = INK; x.lineWidth = 0.8; x.stroke();
    rr(x, l + 2.5, t + 2.5, w - 5, h - 6, 1.5); x.strokeStyle = 'rgba(160,150,130,0.45)'; x.lineWidth = 0.6; x.stroke(); // flat roof parapet
    x.fillStyle = 'rgba(20,10,30,0.12)'; x.fillRect(l + 1, t + h - 3, w - 2, 2);
    rr(x, hx - 3, t + h - 7, 6, 7, 1); x.fillStyle = lin(x, hx - 3, 0, hx + 3, 0, hash(i, 9) < 0.5 ? '#3d82d6' : '#46b0a0', hash(i, 9) < 0.5 ? '#225ea8' : '#2a7a6e'); x.fill(); x.strokeStyle = INK; x.lineWidth = 0.5; x.stroke();
    for (const wx of [l + 3, l + w - 7]) { rr(x, wx, hy - 3, 4, 4, 0.8); x.fillStyle = lin(x, wx, hy - 3, wx + 4, hy + 1, '#4b8ee0', '#1f5aa6'); x.fill(); x.stroke(); }
    if (hash(i, 11) < 0.5) for (let f = 0; f < 3; f++) { const fx = l + 5 + f * 3, fy = t + 4; x.fillStyle = '#a0522d'; x.beginPath(); x.arc(fx, fy + 0.6, 1.1, 0, TAU); x.fill(); x.fillStyle = '#e0443a'; x.beginPath(); x.arc(fx, fy - 0.3, 1, 0, TAU); x.fill(); }
  }
  function church(x, hx, hy) {
    rr(x, hx - 14 + 3, hy - 16 + 4, 28, 32, 2); x.fillStyle = SHD; x.fill();
    rr(x, hx - 14, hy - 16, 28, 32, 2); x.fillStyle = lin(x, hx - 14, hy - 16, hx + 14, hy + 16, '#ffffff', '#dcd6c6'); x.fill(); x.strokeStyle = INK; x.lineWidth = 0.8; x.stroke();
    x.fillStyle = 'rgba(20,10,30,0.25)'; x.beginPath(); x.arc(hx + 1.5, hy + 0, 9.5, 0, TAU); x.fill();
    const g = x.createRadialGradient(hx - 3.5, hy - 5.5, 0.8, hx, hy - 2, 9); g.addColorStop(0, '#8cc0f4'); g.addColorStop(0.5, '#2f74c8'); g.addColorStop(1, '#1a4a8e');
    x.fillStyle = g; x.beginPath(); x.arc(hx, hy - 2, 9, 0, TAU); x.fill(); x.strokeStyle = INK; x.lineWidth = 0.7; x.stroke();
    x.strokeStyle = '#7a5a12'; x.lineWidth = 2.4; x.beginPath(); x.moveTo(hx, hy - 14.5); x.lineTo(hx, hy - 8); x.moveTo(hx - 2.6, hy - 12); x.lineTo(hx + 2.6, hy - 12); x.stroke();
    x.strokeStyle = '#f0cf5a'; x.lineWidth = 1.3; x.stroke();
    rr(x, hx - 3, hy + 10, 6, 6, 1); x.fillStyle = '#6b4a2b'; x.fill(); x.strokeStyle = INK; x.lineWidth = 0.5; x.stroke();
  }

  function drawGoat(ctx, x, y, dir, t, moving) {
    const f = dir < 0 ? -1 : 1, leg = moving ? (Math.floor(t * 8) % 2) : 0;
    ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.fillStyle = SHD; ctx.beginPath(); ctx.ellipse(x + 2, y + 1.5, 9.5, 3.2, 0, 0, TAU); ctx.fill();
    // legs
    for (const [lx, up] of [[-6, leg], [-3, 1 - leg], [2, leg], [5, 1 - leg]]) {
      rr(ctx, x + lx - 0.2, y - 4.5, 2.2, 4.5 + (up ? 0 : 0.8), 1); ctx.fillStyle = '#4a3622'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.5; ctx.stroke();
    }
    const fur = (cx, cy, r) => { const g = ctx.createRadialGradient(cx - r * 0.4, cy - r * 0.5, 0.4, cx, cy, r * 1.3); g.addColorStop(0, '#fffdf6'); g.addColorStop(1, '#cfc4ae'); return g; };
    // tail
    ctx.fillStyle = '#f2ece0'; ctx.beginPath(); ctx.ellipse(x - f * 8, y - 10.5, 1.6, 1.1, -f * 0.6, 0, TAU); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.5; ctx.stroke();
    // body
    ctx.fillStyle = fur(x, y - 7, 8); ctx.beginPath(); ctx.ellipse(x, y - 7, 8, 4.4, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.7; ctx.stroke();
    ctx.save(); ctx.clip();
    ctx.fillStyle = 'rgba(138,90,43,0.85)'; ctx.beginPath(); ctx.ellipse(x - 2, y - 8, 2.6, 1.8, 0.3, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(x + 2.5, y - 4.8, 2, 1.3, 0, 0, TAU); ctx.fill();
    ctx.restore();
    // head + neck
    const hx = x + f * 7, hy = y - 12.5;
    ctx.fillStyle = fur(hx, hy, 3.4); ctx.beginPath(); ctx.ellipse(x + f * 5, y - 9.5, 2.4, 3, f * 0.5, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(hx, hy, 3, 3.4, f * 0.3, 0, TAU); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.6; ctx.stroke();
    ctx.fillStyle = '#e8dcc6'; ctx.beginPath(); ctx.ellipse(hx - f * 2.6, hy - 0.6, 1.6, 0.9, -f * 0.4, 0, TAU); ctx.fill(); ctx.stroke(); // ear
    ctx.strokeStyle = '#6b5a45'; ctx.lineWidth = 1.1; ctx.beginPath(); // horns curving back
    ctx.moveTo(hx - f * 0.6, hy - 3); ctx.quadraticCurveTo(hx - f * 2.2, hy - 6.5, hx - f * 4.2, hy - 5.2);
    ctx.moveTo(hx + f * 0.8, hy - 3.1); ctx.quadraticCurveTo(hx - f * 0.8, hy - 6.8, hx - f * 2.8, hy - 6); ctx.stroke();
    ctx.fillStyle = '#1b1b1b'; ctx.beginPath(); ctx.arc(hx + f * 1.2, hy - 0.6, 0.6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#d8d0c0'; ctx.beginPath(); ctx.ellipse(hx + f * 1, hy + 3.6, 0.9, 1.5, 0, 0, TAU); ctx.fill(); // beard
    ctx.restore();
  }


  // ---------- register the region in the open world ----------
  G.region({
    id: 'crete', tx: RTX, ty: RTY, w: RW, h: RH,
    entry: ENTRY,
    miniDraw(c) {
      const COLS = ['#2668c4', '#ecdca0', '#b0b868'];
      for (let ty = 0; ty < RH; ty++) for (let tx = 0; tx < RW; tx++) { c.fillStyle = COLS[CLS[ty * RW + tx]]; c.fillRect(tx, ty, 1, 1); }
      c.strokeStyle = '#5c5c60'; c.lineWidth = 2.5; c.lineJoin = 'round'; c.beginPath();
      RD.pts.forEach((p, i) => i ? c.lineTo(p.x / TS, p.y / TS) : c.moveTo(p.x / TS, p.y / TS)); c.stroke();
      c.fillStyle = '#f4f0e4'; c.beginPath(); c.arc(VIL.x / TS, VIL.y / TS, VPR / TS + 1.5, 0, TAU); c.fill();
    },
    paint(x, lx0, ly0, lw, lh) { paintCrete(x, RD, lx0, ly0, lx0 + lw, ly0 + lh); },
    solid: regionSolid,
  });

  // the quest camera lives in region-local px but may look past the region (it draws the world), clamped to the map
  function clampCam(cam) {
    const mw = (Wd.w || 300) * TS, mh = (Wd.h || 356) * TS;
    cam.x = G.clamp(cam.x, -ox(), Math.max(-ox(), mw - G.W - ox())); cam.y = G.clamp(cam.y, -oy(), Math.max(-oy(), mh - G.H - oy()));
  }

  const def = G.quest({
    id: 'crete', title: 'Η στροφάρα της Κρήτης', short: 'Κρήτη', col: '#ffd400', reward: 300,
    where: () => Wd.entryOf('crete'),

    make: () => G.MiniGame({
      id: 'crete', title: 'Η ΣΤΡΟΦΆΡΑ ΤΗΣ ΚΡΉΤΗΣ', reward: 300,
      intro: {
        pc: 'Παλιό τενεκεδάκι, ορεινός δρόμος, φουρκέτες. Ο συνοδηγός ήδη προσεύχεται.\nΑνέβα ως το χωριό. Φρέναρε ΠΡΙΝ τη στροφή, το αμάξι γλιστράει.\nΒελάκια/WASD = προς τα πού πας · SPACE φρένο · Οι κατσίκες σπρώχνονται (σιγά!).',
        mobile: 'Παλιό τενεκεδάκι, ορεινός δρόμος, φουρκέτες. Ο συνοδηγός ήδη προσεύχεται.\nΑνέβα ως το χωριό. Φρέναρε ΠΡΙΝ τη στροφή, το αμάξι γλιστράει.\nJoystick = προς τα πού πας · ΦΡΕΝΟ · Οι κατσίκες σπρώχνονται (σιγά!).',
      },
      buttons: [{ id: 'b', label: 'ΦΡΕΝΟ' }],
      stick: 'stick',
      // back on the map: in the village square if you made it, otherwise at the bottom of the road (entry tile)
      exitTo() {
        if (this.phase === 'win') return [ox() + VIL.x, oy() + VIL.y + 6];
        return [ox() + ENTRY[0] * TS + 16, oy() + ENTRY[1] * TS + 8];
      },

      init() {
        const Rd = this.Rd = RD;
        this.skids = [];
        const p0 = Rd.pts[12];   // the bottom of the road, a few steps up the dirt track from the entry
        const car = this.car = new G.Ent.Vehicle('tincan', p0.x, p0.y, 0, '#f4f4f4');
        car.driver = G.player;
        this.max = car.spec.max;
        // goats: one wandering on a straight, one lying in the road
        const pk = (leg, f) => { const a = leg === 0 ? 0 : Rd.hpEnd[leg - 1], b = Rd.hpStart[leg]; return Rd.pts[Math.floor(a + (b - a) * f)]; };
        this.goats = [pk(1, 0.55), pk(4, 0.4), pk(7, 0.5)].map((p, i) => {
          const o = [-0.3, 0.25, 0][i] * Rd.hw;
          return { x: p.x + p.nx * o, y: p.y + p.ny * o, home: p, tx: p.x + p.nx * o, ty: p.y + p.ny * o, dir: 1, t: 0, flee: 0, baa: false, lazy: i > 0, moving: false };
        });
        car.solidFn = (px, py) => {
          const k = Rd.cell(px, py);
          if (k < 0 || Rd.dist[k] > Rd.WALL) return true;
          return false;
        };
        const total = Rd.pts[Rd.pts.length - 1].s / (this.max * 0.35);  // generous whole-run time
        this.timeLeft = Math.round(total * 0.42); this.cpBonus = Math.round(total * 0.16);
        this.cpDone = 0; this.prog = 12; this.inHp = -1; this.hpHits = 0; this.hpFast = false; this.hpDone = {};
        this.hits = 0; this.clean = 0; this.talkCd = 1; this.panCd = 0; this.elaT = 4; this.slowT = 0;
        this.dust = [];
        // first frame = the world camera (the player is standing on the entry tile), then follow the car
        this.cam = { x: (WS.camX || 0) - ox(), y: (WS.camY || 0) - oy() };
        clampCam(this.cam);
        this.rcx = this.cam.x; this.rcy = this.cam.y;
      },
      onStart() { G.audio.music('music_crete', 112); },

      talk(line, force) {
        if (this.talkCd > 0 && !force) return false;
        this.say(line[0], line[1], this.car, 2.2); this.talkCd = 2.2; return true;
      },
      panagia() {
        if (this.panCd > 0) return;
        if (this.talk(LINE_PANAGIA, this.talkCd < 1.2)) this.panCd = 3.5;
      },
      skid(px, py) {
        this.skids.push(px, py);
        if (this.skids.length > 6000) this.skids.splice(0, 400);
      },

      update(dt) {
        const Rd = this.Rd, v = this.car, max = this.max;
        this.talkCd -= dt; this.panCd -= dt; this.elaT -= dt; G.audio.engines(v.x, v.y, [v], v);
        // ----- drive -----
        const before = Math.abs(v.speed);
        const hit = driveCar(v, dt);
        const k = Rd.cell(v.x, v.y), d = k >= 0 ? Rd.dist[k] : 99;
        if (d > Rd.hw) { // gravel: slow + dust
          v.speed *= Math.pow(0.45, dt);
          if (Math.abs(v.speed) > 20 && G.chance(dt * 30)) this.dust.push({ x: v.x - Math.cos(v.a) * v.len / 2, y: v.y - Math.sin(v.a) * v.len / 2, t: 0.6 });
        }
        // skid marks when sliding
        const sp = Math.hypot(v.vx, v.vy);
        if (sp > max * 0.35) {
          const slip = Math.abs(G.angleDiff(v.a, Math.atan2(v.vy, v.vx)));
          if (slip > 0.3 && slip < 2.6) {
            const c = Math.cos(v.a), s = Math.sin(v.a), bx = v.x - c * (v.len / 2 - 4), by = v.y - s * (v.len / 2 - 4);
            this.skid(bx - s * (v.wid / 2 - 2), by + c * (v.wid / 2 - 2)); this.skid(bx + s * (v.wid / 2 - 2), by - c * (v.wid / 2 - 2));
          }
        }
        // ----- goats -----
        for (const gt of this.goats) {
          gt.t += dt; gt.flee -= dt;
          const dc = G.dist(gt.x, gt.y, v.x, v.y);
          if (dc < 110 && !gt.baa) { gt.baa = true; G.audio.sfx('baa'); }
          if (dc > 200) gt.baa = false;
          // the car nudges her: she's shoved along, complains, and trots off to the roadside
          const reach = v.len / 2 + 7;
          if (dc < reach) {
            const ax = (gt.x - v.x) / (dc || 1), ay = (gt.y - v.y) / (dc || 1), push = reach - dc;
            gt.x += ax * push + Math.cos(v.a) * Math.abs(v.speed) * dt * 0.6; gt.y += ay * push + Math.sin(v.a) * Math.abs(v.speed) * dt * 0.6;
            if (gt.flee <= 0) { G.audio.sfx('baa'); const side = (gt.x - gt.home.x) * gt.home.nx + (gt.y - gt.home.y) * gt.home.ny >= 0 ? 1 : -1, o = side * (Rd.hw + 16); gt.tx = gt.home.x + gt.home.nx * o; gt.ty = gt.home.y + gt.home.ny * o; }
            gt.flee = 4; v.speed *= Math.pow(0.4, dt); // pushing a goat slows you down a bit
          }
          else if (gt.flee <= 0 && !gt.lazy && G.chance(dt * 0.4)) { const o = G.rand(-0.6, 0.6) * Rd.hw; gt.tx = gt.home.x + gt.home.nx * o; gt.ty = gt.home.y + gt.home.ny * o; }
          else if (gt.flee <= 0 && gt.flee > -dt * 2 && gt.lazy) { gt.tx = gt.home.x; gt.ty = gt.home.y; } // the lazy one walks back to her spot
          const dx = gt.tx - gt.x, dy = gt.ty - gt.y, dl = Math.hypot(dx, dy), gs = gt.flee > 0 ? 34 : 10;
          gt.moving = dl > 1;
          if (gt.moving) {
            const nx = gt.x + dx / dl * Math.min(dl, gs * dt), ny = gt.y + dy / dl * Math.min(dl, gs * dt);
            if (G.dist(nx, ny, v.x, v.y) > v.len / 2 + 6) { gt.x = nx; gt.y = ny; }
            if (Math.abs(dx) > 0.5) gt.dir = dx < 0 ? -1 : 1;
          }
        }
        // ----- hits -----
        if (hit && before > max * 0.3) {
          this.hits++; this.hpHits++;
          const nearGoat = this.goats.find(gt => G.dist(gt.x, gt.y, v.x, v.y) < v.len / 2 + 14);
          if (nearGoat) { G.audio.sfx('baa'); G.ui.shake(3); }
          this.panagia();
        }
        // ----- progress along the road -----
        if (k >= 0 && Rd.idx[k] >= 0) { const ci = Rd.idx[k]; if (ci > this.prog && ci - this.prog < 90) this.prog = ci; }

        // hairpins: too fast / clean
        const hereIdx = k >= 0 && Rd.idx[k] >= 0 ? Rd.idx[k] : this.prog, here = Rd.pts[hereIdx];
        let hpNow = here.hp;
        if (hpNow < 0) for (let h = 0; h < Rd.N; h++) if (hereIdx >= Rd.hpStart[h] - 14 && hereIdx < Rd.hpStart[h]) hpNow = h; // approach counts
        if (hpNow >= 0 && hpNow !== this.inHp && !this.hpDone[hpNow]) { this.inHp = hpNow; this.hpHits = 0; this.hpFast = false; }
        if (this.inHp >= 0) {
          if (!this.hpFast && Math.abs(v.speed) > max * 0.8) { this.hpFast = true; this.panagia(); }
          if (this.prog > Rd.hpEnd[this.inHp] + 8) {
            this.hpDone[this.inHp] = true;
            if (this.hpHits === 0) { this.clean++; this.talk(LINE_STROFARA, this.talkCd < 1.2); this.elaT = Math.max(this.elaT, 4); }
            this.inHp = -1;
          }
        }
        // straights: encouragement
        if (here.hp < 0 && this.inHp < 0) {
          if (Math.abs(v.speed) < max * 0.15) this.slowT += dt; else this.slowT = 0;
          if (this.elaT <= 0 && (Math.abs(v.speed) > max * 0.6 || this.slowT > 2.5)) { if (this.talk(LINE_ELA)) this.elaT = G.rand(7, 11); this.slowT = 0; }
        }
        // checkpoints
        if (this.cpDone < Rd.cps.length && this.prog >= Rd.cps[this.cpDone]) {
          this.cpDone++; this.timeLeft += this.cpBonus; G.audio.sfx('good');
          G.ui.toast('CHECKPOINT ' + this.cpDone + '/' + Rd.cps.length + '  +' + this.cpBonus + '″');
          this.talk(LINE_ELA, true); this.elaT = 6;
        }
        // dust
        this.dust.forEach(p => p.t -= dt); this.dust = this.dust.filter(p => p.t > 0);
        // camera with a bit of look-ahead (same feel as G.camFollow, clamped to the world map instead of the region)
        const kf = Math.min(1, dt * 5);
        this.cam.x += (v.x + v.vx * 0.35 - G.W / 2 - this.cam.x) * kf; this.cam.y += (v.y + v.vy * 0.35 - G.H / 2 - this.cam.y) * kf;
        clampCam(this.cam);
        // win / lose
        if ((k >= 0 && Rd.plaza[k]) || this.prog >= Rd.pts.length - 4) {
          this.win('Φτάσατε στο χωριό! Ο συνοδηγός φίλησε το έδαφος και πήγε να ανάψει καντήλι. Καθαρές φουρκέτες: ' + this.clean + '/' + Rd.N + '.');
          return;
        }
        this.timeLeft -= dt;
        if (this.timeLeft <= 0) { this.timeLeft = 0; this.lose('Πολύ αργά. Σε προσπέρασε και η κατσίκα.'); }
      },

      render(ctx) {
        const [shx, shy] = G.ui.shakeOffset();
        const cx = Math.round(this.cam.x + shx), cy = Math.round(this.cam.y + shy);
        this.rcx = cx; this.rcy = cy;
        const wx = cx + ox(), wy = cy + oy();
        // the ground is the open world itself (the region is painted into the world chunks by paintCrete)
        ctx.fillStyle = '#b4bc68'; ctx.fillRect(0, 0, G.W, G.H);
        Wd.drawGround(ctx, wx, wy);
        // skid marks
        const sk = this.skids;
        if (sk.length) {
          ctx.fillStyle = 'rgba(30,30,30,0.28)'; ctx.beginPath();
          for (let i = 0; i < sk.length; i += 2) {
            const sx = sk[i] - cx, sy = sk[i + 1] - cy; if (sx < -4 || sy < -4 || sx > G.W + 4 || sy > G.H + 4) continue;
            ctx.moveTo(sx + 2.2, sy + 1); ctx.ellipse(sx + 1, sy + 1, 1.2, 1.2, 0, 0, TAU);
          }
          ctx.fill();
        }
        for (const p of this.dust) { const r = 3 + (0.6 - p.t) * 8, g = ctx.createRadialGradient(p.x - cx - r * 0.3, p.y - cy - r * 0.3, 0, p.x - cx, p.y - cy, r); g.addColorStop(0, 'rgba(236,214,176,' + (p.t * 1.2).toFixed(2) + ')'); g.addColorStop(1, 'rgba(216,192,154,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x - cx, p.y - cy, r, 0, 7); ctx.fill(); }
        ctx.globalAlpha = 1;
        // y-sorted: world trees/props around the region (world coords), goats and the car (local coords)
        const list = [];
        if (Wd.visibleStatics) Wd.visibleStatics(wx, wy, list);
        for (const g of this.goats) list.push({ y: g.y + oy(), draw: () => drawGoat(ctx, g.x - cx, g.y - cy, g.dir, g.t, g.moving) });
        list.push({ y: this.car.y + oy(), draw: () => this.car.draw(ctx, cx, cy) });
        list.sort((a, b) => a.y - b.y).forEach(o => o.draw(ctx));
      },

      hud() {
        const U = G.ui, Rd = this.Rd;
        U.drawBubbles(this.rcx, this.rcy);
        const t = Math.ceil(this.timeLeft);
        U.title(G.W / 2, 18, String(t), 16, t <= 10 ? '#ff3b30' : '#fff');
        U.text(G.W / 2, 30, 'Checkpoint ' + this.cpDone + '/' + Rd.cps.length + ' · Καθαρές φουρκέτες ' + this.clean, 8, '#ffd400', 'center');
        // progress to the village
        const bw = 90, f = G.clamp(this.prog / (Rd.pts.length - 1), 0, 1);
        U.box(G.W / 2 - bw / 2, 34, bw, 5, 'rgba(0,0,0,0.6)', null);
        U.ctx.fillStyle = '#4cd964'; U.ctx.fillRect(G.W / 2 - bw / 2 + 1, 35, (bw - 2) * f, 3);
        U.text(G.W / 2 + bw / 2 + 4, 39, 'ΧΩΡΙΟ', 7, '#fff');
      },
    }),
  });
})();
