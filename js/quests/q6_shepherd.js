// GTA LUBEN — quest: Ο τσοπάνης
// The route is a LOOP: track A goes down the mountain from the entry, ends in the sheepfold clearing,
// track B climbs back up to the εθνική next to the entry (painted arrows, signs, "wrong way" prompt).
// Part 1: orange enduro (it has HP) down track A. NO dogs. Small flocks graze on the road and scatter when you
//         pass; the shepherd jumps out and chases you; you can't run him over (the bike bounces off him) and
//         every catch is a big crook (μαγκούρα) hit. A fake "ΤΑ ΚΑΤΑΦΕΡΕΣ!" banner at the sheepfold... then
//         the THIRD hit breaks the bike, he takes it anyway and drops grandpa's bicycle right there.
// Part 2: from that spot, grandpa's rusty bicycle up track B; NOW the white sheepdogs come out and chase you
//         (they nip a little, you always outrun them by moving; "Ήσυχα, ήσυχα ρε!").
// Riders are drawn ON their bikes in 3/4 view (like G.drawLime): seated chibi torso, legs on pegs/pedals, lean in turns.
// Voice keys (no new ones): vo_shepherd_ela, vo_shepherd_stasou, vo_shepherd_kala, vo_shepherd_opa,
//   vo_shepherd_mixanimou, vo_shepherd_mixani, vo_shepherd_dora, vo_shepherd_isyxa.
'use strict';
const RIDER = [['vo_rider_1', 'Ήσυχα ρεεε!'], ['vo_rider_2', 'Εεειιι!'], ['vo_rider_3', 'Ήσυχα ρε!'], ['vo_rider_4', 'Ήσυχα!'], ['vo_rider_5', 'ΗΣΥΧΑ!!']];
(function () {
  const WS = G.worldScene, Wd = G.World;
  const U = G.ui;
  // the forest lives in the open world: region at the end of the εθνική, entered from the TOP edge.
  // Track A runs DOWN the mountain (y grows) to the sheepfold, track B runs back UP to the road. Local px = region px.
  const SP = Wd.SPOTS.shepherd, RTW = 30, RTH = 263; // region size in tiles (480 x 4208 px)
  const OX = SP.tx * 16, OY = SP.ty * 16;

  const L = (base, ext) => { const o = Object.assign({}, base, ext || {}); delete o._id; o.acc = (o.acc || []).slice(); return o; };
  // ---------- HD drawing helpers (light from the top-left, thin dark outlines, soft shadows) ----------
  const INK = 'rgba(28,20,36,0.85)', SHADOW = 'rgba(20,10,30,0.28)';
  function ell(ctx, x, y, rx, ry, fill, stroke, lw) {
    ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 0.7; ctx.stroke(); }
  }
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); }
  // radial gradient lit from the top-left of a blob
  function litGrad(ctx, x, y, r, c0, c1, c2) {
    const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.45, r * 0.08, x, y, r * 1.05);
    g.addColorStop(0, c0); g.addColorStop(0.55, c1); g.addColorStop(1, c2); return g;
  }

  // ---------- world ----------
  const WW = RTW * 16, WH = RTH * 16, TW = 64; // track 4 tiles wide
  // THE LOOP. Track A (left) comes down from the entry (the dirt path from the εθνική clearing lands on tiles
  // ENTRY_TX, ENTRY_TX+1), ends in the sheepfold clearing; track B (right) climbs back up to the top edge,
  // next to the entry. You always keep going forward.
  const ENTRY_TX = 8;
  const cxA = y => ENTRY_TX * 16 + 16 + 40 * Math.sin(y * 0.0032) + 12 * Math.sin(y * 0.0081);
  const cxB = y => 344 + 40 * Math.sin(y * 0.0029 + 2.1) + 12 * Math.sin(y * 0.0074 + 0.7);
  const START_Y = 26, TOWN_Y = 160;
  const CLR = { x: 244, y: 2470, rx: 168, ry: 80 }; // the sheepfold clearing at the bottom of the loop
  const TRACK_END = CLR.y, YJ = CLR.y - 48;          // both tracks run down into the clearing; YJ = where the route enters it
  const inClearing = (x, y, k = 1) => ((x - CLR.x) / (CLR.rx * k)) ** 2 + ((y - CLR.y) / (CLR.ry * k)) ** 2 < 1;
  const nearTrack = (x, y, m) => y < TRACK_END && (Math.abs(x - cxA(y)) < TW / 2 + m || Math.abs(x - cxB(y)) < TW / 2 + m);
  const onTrack = (x, y) => nearTrack(x, y, 0) || inClearing(x, y, 0.92);
  // the route as a polyline (A down → arc through the clearing → B up), ~8 px apart, s = distance along it
  const ROUTE = (function () {
    const P = [];
    for (let y = START_Y; y < YJ; y += 8) P.push([cxA(y), y]);
    const a = [cxA(YJ), YJ], b = [cxB(YJ), YJ], c = [CLR.x, CLR.y + 70];
    for (let i = 0; i <= 24; i++) { const t = i / 24, u = 1 - t; P.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]); }
    const iB = P.length - 1;
    for (let y = YJ - 8; y >= 0; y -= 8) P.push([cxB(y), y]);
    let s = 0; const R = P.map((p, i) => { if (i) s += Math.hypot(p[0] - P[i - 1][0], p[1] - P[i - 1][1]); return { x: p[0], y: p[1], s }; });
    R.aEnd = R[iB - 24].s; R.iB = iB; R.bStart = R[iB].s;
    R.townS = R.find((p, i) => i > iB && p.y < TOWN_Y).s;
    return R;
  })();
  function nearestRoute(x, y) {
    let bi = 0, bd = 1e18;
    for (let i = 0; i < ROUTE.length; i++) { const p = ROUTE[i]; if (Math.abs(p.y - y) > 140) continue; const d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d < bd) { bd = d; bi = i; } }
    return bi;
  }
  function routeAhead(i, d) { const s = ROUTE[i].s + d; if (d >= 0) { while (i < ROUTE.length - 1 && ROUTE[i].s < s) i++; } else { while (i > 0 && ROUTE[i].s > s) i--; } return i; }
  // signs by the road (plate with an arrow; the label is HUD text)
  const SIGNS = [
    { x: cxA(118) + TW / 2 + 24, y: 118, label: 'ΣΤΑΝΗ', ang: Math.PI / 2 },
    { x: cxB(YJ - 40) - TW / 2 - 26, y: YJ - 40, label: 'ΕΘΝΙΚΗ', ang: -Math.PI / 2 },
    { x: cxB(TOWN_Y) + TW / 2 + 24, y: TOWN_Y, label: 'ΠΟΛΗ', ang: -Math.PI / 2 },
  ];
  let WORLD = null;
  function buildWorld() {
    if (WORLD) return WORLD;
    const obs = [], deco = [], dogs = [], sheep = [], bins = new Map();
    const free = (x, y) => !nearTrack(x, y, 12) && !inClearing(x, y, 1.15) && !SIGNS.some(s => Math.abs(s.x - x) < 26 && Math.abs(s.y - y) < 18);
    for (let y = 40; y < WH - 20; y += 10) {
      for (let j = 0; j < 3; j++) {
        const x = G.hash(y, j * 31 + 7) * WW;
        if (!free(x, y)) continue;
        const h2 = G.hash(j + 3, y);
        if (h2 < 0.36) obs.push({ x, y: y - h2 * 8, r: 6 + h2 * 9, t: 'shrub' });
        else if (h2 < 0.5) obs.push({ x, y, r: 9, t: 'tree' });
        else if (h2 < 0.57) obs.push({ x, y, r: 5, t: 'rock' });
        else if (h2 < 0.72) deco.push({ x, y, t: 'tuft' });
      }
    }
    // a few rocks near the edge of the descent to dodge (the climb back stays clean), puddles on both tracks
    for (let y = 300; y < YJ - 120; y += 170) {
      const s = G.hash(y, 77) < 0.5 ? -1 : 1; obs.push({ x: cxA(y) + s * (15 + G.hash(y, 5) * 9), y, r: 5, t: 'rock' });
      deco.push({ x: cxA(y + 60) - s * 10, y: y + 60, t: 'puddle' });
      deco.push({ x: cxB(y + 20) + s * 9, y: y + 20, t: 'puddle' });
    }
    // sheepdogs (white / white-brown): two at the sheepfold and the rest sitting along the way back up (track B only)
    const dogAt = (cf, y, i, k) => {
      let s = i % 2 ? 1 : -1, x = cf(y) + s * (TW / 2 + 18 + G.hash(y, k) * 22);
      if (nearTrack(x, y, 4) || x < 30 || x > WW - 30) { s = -s; x = cf(y) + s * (TW / 2 + 18 + G.hash(y, k) * 22); }
      dogs.push({ x: G.clamp(x, 30, WW - 30), y, brown: G.hash(y, k + 7) < 0.4, face: s > 0 ? -1 : 1 });
    };
    dogs.push({ x: CLR.x - 92, y: CLR.y + 40, brown: false, face: 1, fold: true }, { x: CLR.x + 92, y: CLR.y + 46, brown: true, face: -1, fold: true });
    for (let y = YJ - 170, i = 0; y > 230; y -= 175, i++) dogAt(cxB, y, i, 4);
    // the flock at the sheepfold (bottom of the clearing) and two small flocks on the slopes
    for (let i = 0; i < 9; i++) sheep.push({ x: CLR.x - 70 + G.hash(i, 31) * 140, y: CLR.y + 34 + G.hash(31, i) * 30, ph: i });
    for (const [fx, fy] of [[cxA(900) + 90, 900], [cxB(1500) - 100, 1500]]) for (let i = 0; i < 5; i++) {
      const x = fx + G.hash(i, fy) * 50 - 25, y = fy + G.hash(fy, i) * 40; if (!nearTrack(x, y, 6)) sheep.push({ x, y, ph: i });
    }
    // edges: dense forest (world-style trees) and grey boulders, so the region melts into the mountain around it
    for (let y = 4; y < WH; y += 13) for (const side of [0, 1]) {
      const j = G.hash(y, side * 17 + 3), yy = y + j * 4;
      obs.push({ x: side ? WW - 7 - j * 4 : 7 + j * 4, y: yy, r: 8, t: 'wtree' });
      if (G.hash(side + 5, y) < 0.6) {
        const x2 = side ? WW - 22 - j * 8 : 22 + j * 8, y2 = yy + 6;
        if (!nearTrack(x2, y2, 16) && !inClearing(x2, y2, 1.15)) obs.push(G.hash(y, side + 9) < 0.22 ? { x: x2, y: y2, r: 7.5, t: 'rock' } : { x: x2, y: y2, r: 8, t: 'wtree' });
      }
    }
    for (let x = 18; x < WW - 14; x += 14) {
      const j = G.hash(x, 61);
      obs.push({ x: x + j * 4, y: WH - 5 - j * 3, r: 8, t: 'wtree' });
      const x2 = x + 7, y2 = WH - 19 - j * 4;
      if (G.hash(61, x) < 0.6 && !inClearing(x2, y2, 1.1)) obs.push(G.hash(x, 7) < 0.25 ? { x: x2, y: y2, r: 7, t: 'rock' } : { x: x2, y: y2, r: 8, t: 'wtree' });
    }
    for (const o of obs) { const k = Math.floor(o.y / 64); if (!bins.has(k)) bins.set(k, []); bins.get(k).push(o); }
    WORLD = { obs, deco, dogs, sheep, bins };
    return WORLD;
  }
  // collision in the open world: forest edges left/right/bottom; the top edge is open (entry from the εθνική)
  function solidReg(px, py) {
    if (px < 12 || px > WW - 12 || py > WH - 12) return true;
    if (!WORLD) buildWorld();
    const k = Math.floor(py / 64);
    for (let b = k - 1; b <= k + 1; b++) { const l = WORLD.bins.get(b); if (l) for (const o of l) if ((px - o.x) * (px - o.x) + (py - o.y) * (py - o.y) < o.r * o.r * 0.7) return true; }
    return false;
  }
  // inside the quest the top edge is closed too
  function solidAt(px, py) { return py < 3 || solidReg(px, py); }

  // ---------- drawing ----------
  // ground (grass, dirt track, puddles, trailhead, bottom clearing) baked into HD chunks of 480 x 512 logical px.
  // The same painter paints the region in the open world (paint(), per world chunk, culled to the visible rows).
  const CHH = 512;
  const bgChunks = new Map(); let bgRS = 0;
  let cxAt = cxA; // the track being painted (A or B)
  function trackPath(x, ya, yb, off, shift) {
    ya = Math.max(0, ya); yb = Math.min(TRACK_END, yb); if (yb <= ya) return false;
    x.beginPath();
    for (let y = ya; y <= yb + 3.9; y += 4) { const yy = Math.min(y, yb), px = cxAt(yy) - TW / 2 - off + (shift || 0); y === ya ? x.moveTo(px, yy) : x.lineTo(px, yy); }
    for (let y = yb; y >= ya - 3.9; y -= 4) { const yy = Math.max(y, ya); x.lineTo(cxAt(yy) + TW / 2 + off + (shift || 0), yy); }
    x.closePath(); return true;
  }
  function trackLine(x, ya, yb, dx) {
    ya = Math.max(0, ya); yb = Math.min(TRACK_END, yb); if (yb <= ya) return false;
    x.beginPath();
    for (let y = ya; y <= yb + 3.9; y += 4) { const yy = Math.min(y, yb), px = cxAt(yy) + dx; y === ya ? x.moveTo(px, yy) : x.lineTo(px, yy); }
    return true;
  }
  // chalk arrow painted on the dirt (soft, worn), pointing along angle a
  function groundArrow(x, px, py, a, sc) {
    x.save(); x.translate(px, py); x.rotate(a); x.scale(sc || 1, sc || 1);
    const shape = () => { x.beginPath(); x.moveTo(-11, -3.2); x.lineTo(2, -3.2); x.lineTo(2, -8.5); x.lineTo(12, 0); x.lineTo(2, 8.5); x.lineTo(2, 3.2); x.lineTo(-11, 3.2); x.closePath(); };
    x.translate(1.2, 1.5); shape(); x.fillStyle = 'rgba(60,40,20,0.3)'; x.fill(); x.translate(-1.2, -1.5);
    shape(); x.fillStyle = 'rgba(255,246,214,0.72)'; x.fill(); x.strokeStyle = 'rgba(120,96,60,0.55)'; x.lineWidth = 0.7; x.stroke();
    x.restore();
  }
  function paintGround(x, ya, yb) {
    x.lineJoin = 'round'; x.lineCap = 'round';
    // grass: soft base + large gentle light/dark blotches
    let g = x.createLinearGradient(0, 0, WW, 0); g.addColorStop(0, '#62723f'); g.addColorStop(0.5, '#5b6a3a'); g.addColorStop(1, '#4f5d33');
    x.fillStyle = g; x.fillRect(0, ya, WW, yb - ya);
    const B = 64;
    for (let gy = Math.floor(ya / B) - 2; gy <= yb / B + 1; gy++) for (let gx = -1; gx <= WW / B + 1; gx++) {
      const h = G.hash(gx * 7 + 3, gy * 5 + 11); if (h > 0.6) continue;
      const bx = gx * B + h * 50, by = gy * B + G.hash(gy, gx) * 50, r = 26 + h * 40;
      const rg = x.createRadialGradient(bx, by, 0, bx, by, r);
      rg.addColorStop(0, h < 0.3 ? 'rgba(140,160,90,0.18)' : 'rgba(30,40,20,0.16)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = rg; x.fillRect(bx - r, by - r, r * 2, r * 2);
    }
    // blend into the world's mountain grass at the borders (left/right/bottom forest, the clearing at the top)
    const WG = 'rgba(120,200,80,', EB = 46;
    g = x.createLinearGradient(0, 0, EB, 0); g.addColorStop(0, WG + '0.9)'); g.addColorStop(1, WG + '0)'); x.fillStyle = g; x.fillRect(0, ya, EB, yb - ya);
    g = x.createLinearGradient(WW, 0, WW - EB, 0); g.addColorStop(0, WG + '0.9)'); g.addColorStop(1, WG + '0)'); x.fillStyle = g; x.fillRect(WW - EB, ya, EB, yb - ya);
    if (yb > WH - EB) { g = x.createLinearGradient(0, WH, 0, WH - EB); g.addColorStop(0, WG + '0.9)'); g.addColorStop(1, WG + '0)'); x.fillStyle = g; x.fillRect(0, WH - EB, WW, EB); }
    if (ya < 110) { g = x.createLinearGradient(0, 0, 0, 110); g.addColorStop(0, WG + '0.95)'); g.addColorStop(0.5, WG + '0.35)'); g.addColorStop(1, WG + '0)'); x.fillStyle = g; x.fillRect(0, 0, WW, 110); }
    // grass tufts (small curved strokes) and a few wild flowers, never on the track
    const gs = 12;
    for (let gy = Math.floor(ya / gs) - 1; gy < yb / gs + 1; gy++) for (let gx = 0; gx < WW / gs + 1; gx++) {
      const h = G.hash(gx + 9, gy + 3); if (h > 0.3) continue;
      const wx = gx * gs + h * 10, wy = gy * gs + (h * 23) % gs;
      if (nearTrack(wx, wy, 5) || inClearing(wx, wy, 0.8)) continue;
      if (h < 0.04) { ell(x, wx, wy, 1.1, 1, '#e8e0b0', 'rgba(60,50,30,0.5)', 0.4); continue; }
      x.strokeStyle = h < 0.18 ? 'rgba(52,66,32,0.75)' : 'rgba(132,150,86,0.7)'; x.lineWidth = 0.7;
      x.beginPath(); x.moveTo(wx, wy); x.quadraticCurveTo(wx - 0.6, wy - 2, wx - 1.8, wy - 3.2);
      x.moveTo(wx + 0.8, wy); x.quadraticCurveTo(wx + 1, wy - 2.4, wx + 2, wy - 3.6);
      x.moveTo(wx + 1.6, wy); x.quadraticCurveTo(wx + 2.4, wy - 1.4, wx + 3.4, wy - 2); x.stroke();
    }
    // dirt tracks (A down, B up): soft dark shoulder, dirt with volume, ruts, grass ridge
    for (const cf of [cxA, cxB]) {
    cxAt = cf;
    if (trackPath(x, ya, yb, 5, 1.5)) { x.fillStyle = 'rgba(20,10,30,0.18)'; x.fill(); }
    if (trackPath(x, ya, yb, 3.5)) { x.fillStyle = '#4a3a22'; x.fill(); }
    if (trackPath(x, ya, yb, 1.5)) { x.fillStyle = '#7a6a45'; x.fill(); }
    if (trackPath(x, ya, yb, 0)) {
      g = x.createLinearGradient(0, 0, WW, 0); g.addColorStop(0, '#ab9064'); g.addColorStop(0.5, '#9b8058'); g.addColorStop(1, '#8a704b');
      x.fillStyle = g; x.fill();
      x.save(); x.clip();
      // edge shading inside the track (darker towards the borders)
      if (trackPath(x, ya, yb, 0)) { x.strokeStyle = 'rgba(70,50,28,0.25)'; x.lineWidth = 9; x.stroke(); x.strokeStyle = 'rgba(70,50,28,0.25)'; x.lineWidth = 4; x.stroke(); }
      for (const dx of [-14, 14]) {
        if (trackLine(x, ya - 4, yb + 4, dx)) { x.strokeStyle = 'rgba(96,74,46,0.55)'; x.lineWidth = 4; x.stroke(); }
        if (trackLine(x, ya - 4, yb + 4, dx - 1.4)) { x.strokeStyle = 'rgba(255,236,196,0.14)'; x.lineWidth = 1; x.stroke(); }
      }
      if (trackLine(x, ya - 4, yb + 4, 0)) { x.strokeStyle = 'rgba(118,124,72,0.6)'; x.lineWidth = 3.4; x.stroke(); x.strokeStyle = 'rgba(160,170,100,0.35)'; x.lineWidth = 1; x.stroke(); }
      // pebbles
      for (let y = Math.floor(ya / 9) * 9; y < yb; y += 9) {
        const h = G.hash(y, 41); if (h > 0.45) continue;
        const px = cxAt(y) + (G.hash(41, y) - 0.5) * (TW - 8);
        ell(x, px + 0.5, y + 0.6, 1.2, 0.7, 'rgba(60,45,25,0.35)'); ell(x, px, y, 1.1, 0.8, '#b8a582'); ell(x, px - 0.3, y - 0.3, 0.45, 0.3, 'rgba(255,250,230,0.6)');
      }
      x.restore();
    }
    // trailhead: the track fades into the light dirt path of the clearing at the end of the εθνική
    if (ya < 90 && trackPath(x, ya, Math.min(yb, 90), 1.5)) {
      g = x.createLinearGradient(0, 0, 0, 90); g.addColorStop(0, 'rgba(240,226,184,0.95)'); g.addColorStop(0.55, 'rgba(220,203,152,0.4)'); g.addColorStop(1, 'rgba(220,203,152,0)');
      x.fillStyle = g; x.fill();
    }
    }
    cxAt = cxA;
    // bottom clearing: a soft open patch of trodden dirt where the track ends
    if (yb > CLR.y - CLR.ry - 20 && ya < CLR.y + CLR.ry + 20) {
      x.save(); x.translate(CLR.x, CLR.y); x.scale(CLR.rx, CLR.ry);
      let cg = x.createRadialGradient(0, 0, 0, 0, 0, 1); cg.addColorStop(0, 'rgba(150,128,88,0.85)'); cg.addColorStop(0.7, 'rgba(130,112,74,0.55)'); cg.addColorStop(1, 'rgba(110,100,60,0)');
      x.fillStyle = cg; x.beginPath(); x.arc(0, 0, 1, 0, 7); x.fill();
      cg = x.createRadialGradient(-0.3, -0.35, 0, -0.3, -0.35, 0.6); cg.addColorStop(0, 'rgba(255,240,200,0.18)'); cg.addColorStop(1, 'rgba(255,240,200,0)');
      x.fillStyle = cg; x.beginPath(); x.arc(-0.3, -0.35, 0.6, 0, 7); x.fill();
      x.restore();
    }
    // static deco: tufts and puddles
    for (const d of WORLD.deco) {
      if (d.y < ya - 12 || d.y > yb + 12) continue;
      if (d.t === 'puddle') {
        ell(x, d.x, d.y, 7.5, 3.4, 'rgba(70,52,30,0.7)');
        const pg = x.createLinearGradient(d.x - 6, d.y - 2, d.x + 6, d.y + 2); pg.addColorStop(0, '#a9b8c4'); pg.addColorStop(1, '#5f6f7c');
        ell(x, d.x, d.y, 6.2, 2.5, pg, 'rgba(40,30,20,0.6)', 0.5);
        x.strokeStyle = 'rgba(255,255,255,0.55)'; x.lineWidth = 0.6; x.beginPath(); x.ellipse(d.x - 1.5, d.y - 0.6, 3, 1, 0, Math.PI * 1.05, Math.PI * 1.7); x.stroke();
      } else {
        x.strokeStyle = 'rgba(140,158,90,0.85)'; x.lineWidth = 0.8;
        x.beginPath(); x.moveTo(d.x, d.y + 2); x.quadraticCurveTo(d.x - 1, d.y - 1, d.x - 2.5, d.y - 2.5);
        x.moveTo(d.x + 1, d.y + 2); x.quadraticCurveTo(d.x + 1.2, d.y - 1.5, d.x + 1.6, d.y - 3.5);
        x.moveTo(d.x + 2, d.y + 2); x.quadraticCurveTo(d.x + 3, d.y, d.x + 4.4, d.y - 1.6); x.stroke();
      }
    }
    // chalk arrows along the loop (down A, round the sheepfold, up B): you always know which way is forward
    for (let i = 0, next = 150; i < ROUTE.length - 3; i++) {
      const p = ROUTE[i]; if (p.s < next) continue;
      next = p.s + (i > ROUTE.iB - 30 && i < ROUTE.iB + 6 ? 60 : 260);
      if (p.y < ya - 16 || p.y > yb + 16 || p.y < 60) continue;
      const q = ROUTE[i + 3]; groundArrow(x, p.x, p.y, Math.atan2(q.y - p.y, q.x - p.x), 1);
    }
  }
  function bgChunk(k) {
    if (bgRS !== G.RS) { bgChunks.clear(); bgRS = G.RS; }
    let c = bgChunks.get(k); if (c) { bgChunks.delete(k); bgChunks.set(k, c); return c; }
    while (bgChunks.size >= 4) bgChunks.delete(bgChunks.keys().next().value); // small LRU: a screen needs ≤ 2 chunks
    const y0 = k * CHH, h = Math.min(CHH, WH - y0);
    const [cv, x] = G.hiCanvas(WW, h, G.RS || 2);
    x.translate(0, -y0); paintGround(x, y0 - 10, y0 + h + 10);
    bgChunks.set(k, cv); return cv;
  }

  // obstacles: cached HD sprites (shrubs, dark forest trees, rocks), centre at (c.ox, c.oy)
  const sprCache = new Map();
  function obsSprite(t, r) {
    const ri = Math.round(r * 2) / 2, key = t + ri + '_' + G.RS;
    let c = sprCache.get(key); if (c) return c;
    const S = Math.ceil(ri * 2 + 20), m = S / 2;
    const [cv, x] = G.hiCanvas(S, S, (G.RS || 2) * 1.5);
    x.lineJoin = 'round';
    if (t === 'shrub') {
      ell(x, m + 3, m + 4, ri, ri * 0.72, SHADOW);
      const lobes = [[-0.38, 0.12, 0.62], [0.36, 0.16, 0.6], [0.02, -0.26, 0.66]];
      x.strokeStyle = 'rgba(14,24,10,0.95)'; x.lineWidth = 1.5;
      for (const [dx, dy, s] of lobes) { x.beginPath(); x.ellipse(m + dx * ri, m + dy * ri * 0.8, s * ri, s * ri * 0.85, 0, 0, 7); x.stroke(); }
      for (const [dx, dy, s] of lobes) {
        const lx = m + dx * ri, ly = m + dy * ri * 0.8;
        ell(x, lx, ly, s * ri, s * ri * 0.85, litGrad(x, lx, ly, s * ri, '#6f9a4c', '#3c5e2c', '#203619'));
      }
      ell(x, m - ri * 0.25, m - ri * 0.4, ri * 0.22, ri * 0.14, 'rgba(200,240,160,0.25)');
      ell(x, m + ri * 0.45, m - ri * 0.05, ri * 0.15, ri * 0.1, 'rgba(200,240,160,0.18)');
    } else if (t === 'tree') {
      ell(x, m + 5, m + 5, ri + 2, ri, 'rgba(20,10,30,0.32)');
      ell(x, m, m, ri + 1.5, ri + 1, litGrad(x, m, m, ri + 1.5, '#4f7a3e', '#2a4522', '#13200e'), 'rgba(10,18,8,0.95)', 0.8);
      x.save(); x.beginPath(); x.ellipse(m, m, ri + 1.5, ri + 1, 0, 0, 7); x.clip();
      for (let i = 0; i < 5; i++) { const a = i * 1.26 + 0.4, d = ri * 0.45; ell(x, m + Math.cos(a) * d, m + Math.sin(a) * d * 0.9, ri * 0.42, ri * 0.36, i < 2 ? 'rgba(130,180,95,0.2)' : 'rgba(10,20,8,0.22)'); }
      ell(x, m + ri * 0.45, m + ri * 0.5, ri * 0.9, ri * 0.6, 'rgba(5,12,4,0.25)');
      x.restore();
      ell(x, m - ri * 0.35, m - ri * 0.45, ri * 0.3, ri * 0.22, 'rgba(190,230,150,0.25)');
    } else {
      ell(x, m + 3, m + 4, ri, ri * 0.72, SHADOW);
      ell(x, m, m, ri + 0.6, ri * 0.8, litGrad(x, m, m, ri + 0.6, '#d4d4cb', '#8f8f86', '#55554f'), INK, 0.7);
      ell(x, m - ri * 0.35, m - ri * 0.3, ri * 0.38, ri * 0.22, 'rgba(255,255,255,0.45)');
      x.strokeStyle = 'rgba(50,50,45,0.5)'; x.lineWidth = 0.5; x.beginPath(); x.moveTo(m + ri * 0.1, m - ri * 0.1); x.lineTo(m + ri * 0.35, m + ri * 0.3); x.stroke();
    }
    cv.ox = m; cv.oy = m; sprCache.set(key, cv); return cv;
  }
  function drawObs(ctx, o, cx, cy) {
    if (o.t === 'wtree') { // the world's own forest tree, so the edges match the mountain around the region
      const ps = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = true;
      ctx.drawImage(Wd.treeSprite(), o.x - cx - 11, o.y - cy - 20, 20, 24); ctx.imageSmoothingEnabled = ps; return;
    }
    const s = obsSprite(o.t, o.r), ps = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true; ctx.drawImage(s, o.x - cx - s.ox, o.y - cy - s.oy, s.lw, s.lh); ctx.imageSmoothingEnabled = ps;
  }
  // white sheepdog (white / white-brown), facing right when face > 0
  function drawDog(ctx, x, y, face, frame, brown, sit, bark) {
    const Wc = '#f6f3ea', Ws = '#cbc3b0', B = '#a8743a', D = '#2a2420';
    ell(ctx, x + 2.5, y + 0.5, 8, 2.6, SHADOW);
    ctx.save(); ctx.translate(x, y); ctx.scale(face > 0 ? 1 : -1, 1); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const fur = (px, py, r) => litGrad(ctx, px, py, r, '#ffffff', Wc, Ws);
    const part = (px, py, rx, ry, fill) => ell(ctx, px, py, rx, ry, fill, INK, 0.6);
    const leg = (x0, y0, x1, y1, col) => { ctx.strokeStyle = INK; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.strokeStyle = col; ctx.lineWidth = 1.4; ctx.stroke(); };
    if (sit) {
      ctx.strokeStyle = INK; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(-4, -2); ctx.quadraticCurveTo(-8, -1.5, -8.5, -4); ctx.stroke(); ctx.strokeStyle = Wc; ctx.lineWidth = 1.2; ctx.stroke();
      part(-2.5, -2.6, 4, 2.6, fur(-2.5, -2.6, 4));
      part(-0.5, -6, 4.2, 4.6, fur(-0.5, -6, 4.6));
      if (brown) ell(ctx, -2, -6.5, 2, 2.2, B);
      leg(2, -4, 2.2, -0.3, Ws); leg(3.8, -4, 4.2, -0.3, Wc);
      part(4, -11, 3.6, 3.2, fur(4, -11, 3.6));
      part(7, -10.2, 2.1, 1.5, Wc);
      part(2.4, -12.8, 1.5, 2.2, brown ? B : Ws);
      ell(ctx, 8.8, -10.5, 0.8, 0.7, D); ell(ctx, 4.9, -11.7, 0.6, 0.7, D); ell(ctx, 4.7, -11.95, 0.2, 0.2, '#fff');
      if (bark) ell(ctx, 7.6, -8.9, 1.3, 0.8, '#c0392b', INK, 0.4);
    } else {
      const l = frame % 2 ? 1 : 0, sw = l ? 1.4 : -1.4;
      leg(-4, -5, -4 - sw, -0.3, Ws); leg(3, -5, 3 + sw, -0.3, Ws);
      ctx.strokeStyle = INK; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(-5.5, -7.5); ctx.quadraticCurveTo(-7.5, -9, -8.5, -10 - l); ctx.stroke(); ctx.strokeStyle = Wc; ctx.lineWidth = 1.2; ctx.stroke();
      part(0, -6.6, 6.2, 3.3, fur(0, -6.6, 6.2));
      if (brown) { ell(ctx, -1.5, -7.6, 2.6, 1.5, B); ell(ctx, -4, -5.8, 1.4, 1.3, B); }
      leg(-2, -5, -2 + sw, -0.3, Wc); leg(4.6, -5, 4.6 - sw, -0.3, Wc);
      part(5.6, -10, 3.4, 3, fur(5.6, -10, 3.4));
      part(8.5, -9.3, 2, 1.4, Wc);
      part(4.4, -12.3, 1.4, 2, brown ? B : Ws);
      ell(ctx, 10.2, -9.6, 0.8, 0.7, D); ell(ctx, 6.5, -10.7, 0.6, 0.7, D); ell(ctx, 6.3, -10.95, 0.2, 0.2, '#fff');
      if (bark) ell(ctx, 9, -8, 1.3, 0.8, '#c0392b', INK, 0.4);
    }
    if (bark) { // "woof" arcs
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 0.7;
      const bx = sit ? 10.5 : 12, by = sit ? -10 : -9.5;
      for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.arc(bx, by, 1.6 + i * 1.6, -0.7, 0.7); ctx.stroke(); }
    }
    ctx.restore();
  }
  // face < 0 = looking left; hop = jump height (a panicking sheep bounces)
  function drawSheep(ctx, x, y, ph, face, hop, noShadow) {
    if (!noShadow) ell(ctx, x + 2.5, y + 0.5, 6, 2.2, SHADOW);
    if (face < 0 || hop) { ctx.save(); ctx.translate(x, y - (hop || 0)); if (face < 0) ctx.scale(-1, 1); drawSheep(ctx, 0, 0, ph, 1, 0, true); ctx.restore(); return; }
    const puffs = [[-3, -3], [0, -4.5], [3, -3.2], [-1.5, -1.6], [1.8, -1.6], [0, -3]];
    ctx.strokeStyle = 'rgba(40,36,30,0.85)'; ctx.lineWidth = 1.3;
    for (const [dx, dy] of puffs) { ctx.beginPath(); ctx.arc(x + dx, y + dy, 2.4, 0, 7); ctx.stroke(); }
    for (const [dx, dy] of puffs) ell(ctx, x + dx, y + dy, 2.4, 2.4, litGrad(ctx, x + dx, y + dy, 2.4, '#ffffff', '#eeeae0', '#c9c3b4'));
    const hx = x + 5 + (Math.sin(G.t + ph) > 0.7 ? 1 : 0);
    ell(ctx, hx, y - 3.5, 1.9, 1.6, '#2a2420', INK, 0.5); ell(ctx, hx - 0.8, y - 5, 0.9, 0.5, '#3a322c');
    ell(ctx, hx + 0.5, y - 4, 0.3, 0.3, '#fff');
  }
  // road sign: blue plate, white face, an arrow painted on its right end (the label is HUD text, see hud())
  const SIGN_HW = 24;
  function drawSign(ctx, x, y, ang) {
    const hw = SIGN_HW;
    ell(ctx, x + 3, y + 1, 7, 1.8, SHADOW);
    let g = ctx.createLinearGradient(x - 1, 0, x + 1.5, 0); g.addColorStop(0, '#9a9a9e'); g.addColorStop(1, '#4a4a4e');
    rr(ctx, x - 1, y - 16, 2.2, 16, 0.8); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.5; ctx.stroke();
    g = ctx.createLinearGradient(x - hw, y - 28, x + hw, y - 15); g.addColorStop(0, '#2d5cc0'); g.addColorStop(1, '#16307a');
    rr(ctx, x - hw, y - 28, hw * 2, 13, 2.2); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.7; ctx.stroke();
    g = ctx.createLinearGradient(0, y - 27, 0, y - 16); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#e4e8f0');
    rr(ctx, x - hw + 1, y - 27, hw * 2 - 2, 11, 1.6); ctx.fillStyle = g; ctx.fill();
    ctx.save(); ctx.translate(x + hw - 7, y - 21.5); ctx.rotate(ang);
    ctx.beginPath(); ctx.moveTo(-4, -1.2); ctx.lineTo(0.5, -1.2); ctx.lineTo(0.5, -3.4); ctx.lineTo(4.2, 0); ctx.lineTo(0.5, 3.4); ctx.lineTo(0.5, 1.2); ctx.lineTo(-4, 1.2); ctx.closePath();
    ctx.fillStyle = '#1d3f8f'; ctx.fill(); ctx.restore();
  }
  // the crook (μαγκούρα) swinging down (k = 0..1), with a soft swoosh
  function drawCrook(ctx, x, y, face, k) {
    const a0 = -2.2, a1 = 0.45, a = a0 + (a1 - a0) * Math.min(1, k * 1.7);
    ctx.save(); ctx.translate(x + face * 3, y - 11); ctx.scale(face, 1); ctx.lineCap = 'round';
    if (k > 0.12 && k < 0.85) { ctx.strokeStyle = `rgba(255,255,255,${(0.6 * (1 - k)).toFixed(3)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 15, a0 + 0.3, a); ctx.stroke(); }
    ctx.rotate(a);
    const stick = (w, col) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(15, 0); ctx.arc(15, -2.6, 2.6, Math.PI / 2, -Math.PI * 0.9, true); ctx.stroke(); };
    stick(2.4, INK); stick(1.3, '#8a5a2a');
    ctx.restore();
  }

  // ---------- two-wheelers with the rider ON them (3/4 top-down view, same projection as G.drawLime) ----------
  // Bike-local units: f = forward along the heading, w = to its right, h = height above the ground. Ground depth is
  // foreshortened (0.56), height goes up the screen (0.83). lean rolls the bike around its wheel line (into turns;
  // ~1.35 = lying on its side).
  function view(x, y, a, lean) {
    const c = Math.cos(a), s = Math.sin(a), cl = Math.cos(lean || 0), sl = Math.sin(lean || 0);
    const F = [c, s * 0.56], S0 = [-s, c * 0.56], U0 = [0, -0.83];
    const S = [S0[0] * cl - U0[0] * sl, S0[1] * cl - U0[1] * sl], U = [U0[0] * cl + S0[0] * sl, U0[1] * cl + S0[1] * sl];
    return { c, s, F, S0, S, U, P: (f, w, h) => [x + f * F[0] + w * S[0] + h * U[0], y + f * F[1] + w * S[1] + h * U[1]] };
  }
  function polyline(ctx, pts) { ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); }
  function tube(ctx, pts, col, lw) { // a stroked part with a thin dark outline
    polyline(ctx, pts); ctx.strokeStyle = INK; ctx.lineWidth = lw + 0.9; ctx.stroke(); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.stroke();
  }
  function knob(ctx, p, r, col) { ell(ctx, p[0], p[1], r, r, litGrad(ctx, p[0], p[1], r, G.shade(col, 0.35), col, G.shade(col, -0.3)), INK, 0.5); }
  // a circle standing in the bike's plane (wheels, chainring): f/h centre, radius r
  function ringPath(ctx, V, f, w, h, r) {
    const p = V.P(f, w, h); ctx.beginPath();
    for (let i = 0; i <= 22; i++) { const t = i / 22 * Math.PI * 2, ct = Math.cos(t) * r, st = Math.sin(t) * r; const X = p[0] + ct * V.F[0] + st * V.U[0], Y = p[1] + ct * V.F[1] + st * V.U[1]; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
    ctx.closePath();
  }
  function wheel(ctx, V, f, r, moto, spin) {
    ringPath(ctx, V, f, 0, r, r);
    ctx.strokeStyle = INK; ctx.lineWidth = moto ? 3.3 : 2; ctx.stroke(); ctx.strokeStyle = moto ? '#232326' : '#2a2a2c'; ctx.lineWidth = moto ? 2.4 : 1.1; ctx.stroke();
    if (moto) { // knobby tyre, silver rim, dark hub
      ctx.strokeStyle = 'rgba(120,120,126,0.7)'; ctx.lineWidth = 0.5; ctx.stroke();
      ringPath(ctx, V, f, 0, r, r * 0.6); ctx.strokeStyle = '#c9ccd2'; ctx.lineWidth = 0.8; ctx.stroke();
      ringPath(ctx, V, f, 0, r, r * 0.25); ctx.fillStyle = '#4a4a50'; ctx.fill();
    } else { // thin rim + turning spokes
      ringPath(ctx, V, f, 0, r, r * 0.86); ctx.strokeStyle = '#c9ccd2'; ctx.lineWidth = 0.5; ctx.stroke();
      ctx.strokeStyle = 'rgba(215,218,224,0.75)'; ctx.lineWidth = 0.3; ctx.beginPath();
      for (let i = 0; i < 4; i++) { const t = spin * 0.6 + i * Math.PI / 4, dx = Math.cos(t) * r * 0.84, dy = Math.sin(t) * r * 0.84; const A = V.P(f + dx, 0, r + dy), B = V.P(f - dx, 0, r - dy); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); }
      ctx.stroke(); const hb = V.P(f, 0, r); ell(ctx, hb[0], hb[1], 0.6, 0.6, '#8a8a90');
    }
  }
  // 2-link leg from the hip to the foot, knee bent forward (in the f/h plane)
  function legPts(V, hip, foot, L1, L2) {
    const df = foot[0] - hip[0], dh = foot[2] - hip[2], d = Math.max(0.1, Math.min(L1 + L2 - 0.05, Math.hypot(df, dh)));
    const base = Math.atan2(dh, df), al = Math.acos(G.clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
    const k1 = [hip[0] + Math.cos(base + al) * L1, hip[2] + Math.sin(base + al) * L1], k2 = [hip[0] + Math.cos(base - al) * L1, hip[2] + Math.sin(base - al) * L1];
    const k = k1[0] > k2[0] ? k1 : k2, kw = foot[1] * 1.05;
    return [V.P(hip[0], hip[1], hip[2]), V.P(k[0], kw, k[1]), V.P(foot[0], foot[1], foot[2])];
  }
  // kind 'moto' (enduro) or 'bike' (grandpa's old bicycle); o = { col, lean, look (rider or null), spin }
  function drawRideable(ctx, kind, x, y, a, o) {
    const moto = kind === 'moto', V = view(x, y, a, o.lean || 0), P = V.P, c = V.c, s = V.s, col = o.col, look = o.look;
    const R = moto ? 3.9 : 4.5, WB = moto ? 7.8 : 7.4, front = s > 0.25, spin = o.spin || 0;
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // soft shadow on the ground (not leaned)
    ctx.fillStyle = 'rgba(20,10,30,0.28)'; ctx.beginPath();
    for (let i = 0; i <= 20; i++) { const t = i / 20 * Math.PI * 2, L = (moto ? 12.5 : 11.5) * Math.cos(t), W = (moto ? 4.2 : 3.4) * Math.sin(t); const X = x + 2 + L * V.F[0] + W * V.S0[0], Y = y + 2 + L * V.F[1] + W * V.S0[1]; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
    ctx.fill();
    // wheels, the farther one first
    const wr = () => wheel(ctx, V, -WB, R, moto, spin), wf = () => wheel(ctx, V, WB, R, moto, spin);
    if (s > 0) { wr(); wf(); } else { wf(); wr(); }
    // rider geometry (bike-local [f, w, h])
    const hip = moto ? [-3.2, 0, 11.6] : [-3, 0, 12.4];
    const footOf = k => moto ? [0.4, k * 3.1, 4.8] : (() => { const t = spin + (k > 0 ? 0 : Math.PI); return [-0.6 + Math.cos(t) * 2.3, k * 2.6, 3.9 + Math.sin(t) * 2.3]; })();
    const grip = k => moto ? [5.2, k * 5, 13.6] : [2.8, k * 4.4, 12.4];
    const legCol = (look && look.legs) || '#2d3446', shoeCol = (look && look.shoes) || '#222';
    const order = k => Math.abs(c) > 0.55 ? (c * k > 0 ? 2 : 0) : (s > 0 ? 2 : 1); // 0 behind the bike, 1 behind the torso, 2 in front
    const legs = g => {
      if (!look) return;
      for (const k of [-1, 1]) {
        if (order(k) !== g) continue;
        const ft = footOf(k);
        if (!moto) { const B = P(-0.6, k * 1.2, 3.9), Pd = P(ft[0], ft[1], ft[2]); tube(ctx, [B, Pd], '#6a6a70', 0.7); } // crank arm
        const L = legPts(V, [hip[0], k * 1.6, hip[2]], ft, moto ? 4.8 : 5.4, moto ? 4.8 : 5.2);
        tube(ctx, L, legCol, 2.5);
        ell(ctx, L[2][0] + c * 0.6, L[2][1] + s * 0.3, 1.7, 1.1, shoeCol, INK, 0.5);
      }
    };
    legs(0);
    if (moto) {
      tube(ctx, [P(-WB, 0, R), P(-1, 0, 5.2)], '#3a3a40', 1.6);               // swingarm
      tube(ctx, [P(-1.2, 1.9, 4.4), P(-7.6, 1.9, 7.4)], '#c9ccd2', 1.3);      // exhaust
      knob(ctx, P(-0.6, 0, 5.4), 2.7, '#55555c');                             // engine
      tube(ctx, [P(WB, 0, R), P(5.6, 0, 11.2)], '#d8dadf', 1.3);              // fork
      tube(ctx, [P(-9.6, 0, 9.4), P(-3, 0, 9.9), P(2.4, 0, 10.6), P(5.6, 0, 11.2)], col, 4.2); // body
      polyline(ctx, [P(-9, 0, 10.6), P(-3, 0, 11.2)]); ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 0.8; ctx.stroke();
      tube(ctx, [P(-7.4, 0, 10.9), P(-0.8, 0, 11.4)], '#1c1c20', 2.6);         // seat
      knob(ctx, P(2.6, 0, 11.3), 2.7, col);                                     // tank
      tube(ctx, [P(5.2, 0, 8.8), P(8.2, 0, 9.4), P(10.9, 0, 7.9)], col, 1.7); // high front fender
      knob(ctx, P(7.4, 0, 11.6), 1.9, col);                                     // number plate / headlight
      const hl = P(8.1, 0, 11.8); ell(ctx, hl[0], hl[1], 0.9, 0.9, '#fff7c0');
    } else {
      const BB = P(-0.6, 0, 3.9), RA = P(-WB, 0, R), ST = P(-2.8, 0, 10.6), HT0 = P(5.6, 0, 7.8), HT1 = P(5.1, 0, 10.2), FA = P(WB, 0, R);
      tube(ctx, [P(-4.6, 0, 8.6), P(-8.4, 0, 9.0), P(-11.4, 0, 6.2)], '#2f4a36', 0.9); // old green mudguards
      tube(ctx, [P(4.4, 0, 8.2), P(8.4, 0, 9.2), P(11.2, 0, 6.6)], '#2f4a36', 0.9);
      tube(ctx, [RA, BB], col, 1.0); tube(ctx, [RA, ST], col, 0.9);              // chain/seat stays
      tube(ctx, [BB, ST], col, 1.1);                                            // seat tube
      tube(ctx, [BB, P(2.6, 0, 5.4), HT0], col, 1.2);                           // step-through tubes (grandpa frame)
      tube(ctx, [P(-2.4, 0, 8.6), P(1.6, 0, 7.6), HT1], col, 1.1);
      tube(ctx, [HT0, HT1], col, 1.3); tube(ctx, [HT0, FA], '#9a9aa0', 0.9);   // head tube, fork
      tube(ctx, [ST, P(-8.8, 0, 9.4)], '#8a8a90', 0.8); tube(ctx, [P(-8.8, 0, 9.4), RA], '#8a8a90', 0.6); // rear rack
      ringPath(ctx, V, -0.6, 0.8, 3.9, 1.5); ctx.strokeStyle = '#7a7a80'; ctx.lineWidth = 0.7; ctx.stroke(); // chainring
      for (const [f, h] of [[1.2, 6.4], [-1.6, 7.6], [-5, 6.6]]) { const p = P(f, 0, h); ell(ctx, p[0], p[1], 0.6, 0.45, '#c46e34'); } // rust spots
      tube(ctx, [P(-4.4, 0, 11.7), P(-1.8, 0, 11.6)], '#5a3a22', 2.1);           // leather saddle
      // wicker basket over the front wheel
      const bk = P(7.4, 0, 12.2); rr(ctx, bk[0] - 3.2, bk[1] - 2.4, 6.4, 4.6, 1.2);
      const bg = ctx.createLinearGradient(0, bk[1] - 2.4, 0, bk[1] + 2.2); bg.addColorStop(0, '#d6ad68'); bg.addColorStop(1, '#8e6630');
      ctx.fillStyle = bg; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.6; ctx.stroke();
      ctx.strokeStyle = 'rgba(90,60,25,0.6)'; ctx.lineWidth = 0.35; ctx.beginPath();
      for (let i = -2; i <= 2; i++) { ctx.moveTo(bk[0] + i * 1.3, bk[1] - 2); ctx.lineTo(bk[0] + i * 1.3, bk[1] + 1.8); }
      ctx.moveTo(bk[0] - 2.8, bk[1]); ctx.lineTo(bk[0] + 2.8, bk[1]); ctx.stroke();
    }
    legs(1);
    const bars = () => {
      if (moto) {
        tube(ctx, [P(5.6, 0, 11.2), P(5.2, 0, 13.4)], '#2a2a2e', 1.1);
        tube(ctx, [P(5.2, -5, 13.6), P(5.4, 0, 13.4), P(5.2, 5, 13.6)], '#2a2a2e', 1.0);
        for (const k of [-1, 1]) { const g = P(5.2, k * 5, 13.6); ell(ctx, g[0], g[1], 0.9, 0.9, '#111'); }
      } else {
        tube(ctx, [P(5.1, 0, 10.2), P(4.7, 0, 12.8)], '#9a9aa0', 0.8);
        tube(ctx, [P(2.8, -4.4, 12.4), P(4.7, -2, 12.9), P(4.7, 2, 12.9), P(2.8, 4.4, 12.4)], '#c3c6cc', 0.8); // swept-back old bars
        for (const k of [-1, 1]) { const g = P(2.8, k * 4.4, 12.4); ell(ctx, g[0], g[1], 0.8, 0.8, '#3a2a20'); }
        const bl = P(4.4, -2.6, 13.3); ell(ctx, bl[0], bl[1], 0.75, 0.75, '#d8dadf', INK, 0.4); // bell
      }
    };
    if (!look) { bars(); ctx.restore(); return; }
    if (!front) bars();
    // the rider's upper body: the chibi sprite cut at the hips, sitting on the seat, rolled with the lean
    const dir = Math.abs(c) > Math.abs(s) ? (c > 0 ? 2 : 1) : (s > 0 ? 0 : 3);
    const spr = G.personSprite(look, dir, 0), CUT = 18.4, hp = P(hip[0], 0, hip[2]), rot = Math.atan2(V.U[0], -V.U[1]);
    ctx.save(); ctx.translate(hp[0], hp[1]); ctx.rotate(rot);
    const ps = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = true;
    ctx.drawImage(spr, 0, 0, spr.width, spr.height * CUT / 26, -9, -17.2, 18, CUT);
    ctx.imageSmoothingEnabled = ps;
    ell(ctx, 0, 0.6, dir === 1 || dir === 2 ? 2.6 : 3.4, 1.7, legCol, INK, 0.5);     // seat of the trousers over the cut
    const sideV = dir === 1 || dir === 2, sh = sideV ? [[(dir === 2 ? 0.6 : -0.6), -4.8]] : [[-3.4, -5], [3.4, -5]];
    const shoulders = sh.map(([sx, sy]) => [hp[0] + sx * Math.cos(rot) - sy * Math.sin(rot), hp[1] + sx * Math.sin(rot) + sy * Math.cos(rot)]);
    ctx.restore();
    legs(2);
    if (front) bars();
    if (s > -0.35) { // arms out to the grips (hidden behind the back when riding away from the camera)
      const sleeve = look.topStyle === 'tank' || look.topStyle === 'gown' ? (look.skin || '#e8b48a') : (look.top || '#3a6ea5');
      const GP = [-1, 1].map(k => { const g = grip(k); return P(g[0], g[1], g[2]); });
      for (const p of shoulders) { // side view: the near grip (lower on screen); front view: the grip on the same side
        const G2 = sideV ? (GP[0][1] > GP[1][1] ? GP[0] : GP[1]) : (Math.abs(GP[0][0] - p[0]) < Math.abs(GP[1][0] - p[0]) ? GP[0] : GP[1]);
        tube(ctx, [p, G2], sleeve, 2.0); ell(ctx, G2[0], G2[1], 1.1, 1.1, look.skin || '#e8b48a', INK, 0.4);
      }
    }
    ctx.restore();
  }
  // lean into turns (from the turn rate) and turn the wheels / pedals
  function tilt(v, dt, target) {
    if (target == null) {
      const rate = G.angleDiff(v._pa == null ? v.a : v._pa, v.a) / Math.max(dt, 1e-3);
      target = G.clamp(rate * 0.16 * Math.min(1, Math.abs(v.speed) / 110), -0.38, 0.38);
    }
    v._pa = v.a; v.lean = (v.lean || 0) + (target - (v.lean || 0)) * Math.min(1, dt * 9);
    v.spin = (v.spin || 0) + v.speed * dt * 0.12;
  }
  const drawVeh = (ctx, v, cx, cy) => drawRideable(ctx, v.type, v.x - cx, v.y - cy, v.a, { col: v.col, lean: v.lean || 0, look: v.rider, spin: v.spin || 0 });

  // ---------- setup ----------
  const mkDogs = () => WORLD.dogs.map(d => Object.assign({}, d, { state: 'sit', anim: 0, barkT: 0, bark: 0, hes: 0, back: 0, t: 0, cd: 0 }));
  function setupPart1(m) {
    m.stage = 'p1'; m.sh = null; m.faked = false; m.finalT = 0; m.parts = []; m.fade = 0;
    m.vhp = 100; m.hits = 0; m.enc = 0; m.best = 0; m.ri = 0; m.fdir = Math.PI / 2; m.wrong = false; m.wrongT = 0; m.idleT = 0;
    m.shoutCd = 0; m.biteCd = 0; m.flash = 0; m.bites = 0;
    m.moto = new G.Ent.Vehicle('moto', cxA(START_Y), START_Y, Math.PI / 2, '#ff6a1a'); m.moto.solidFn = solidAt; m.moto.rider = L(G.state.look); m.moto.lean = 0; m.moto.spin = 0;
    m.veh = m.moto; m.dogs = []; // no dogs in part 1
    // small flocks grazing ON the road before each ambush: they scatter when you ride through, and that's what brings him
    m.flock = []; m.flocks = ENC.map((e, gi) => {
      const p = ROUTE[routeAhead(0, e - 170)];
      for (let j = 0; j < 5; j++) {
        const x = p.x + (j - 2) * 11 + (G.hash(j, e) - 0.5) * 6, y = p.y + (G.hash(e, j) - 0.5) * 22;
        if (!solidAt(x, y)) m.flock.push({ x, y, vx: 0, vy: 0, g: gi, ph: j + gi, face: G.hash(j + 3, e) < 0.5 ? -1 : 1, panic: 0, hop: 0, bcd: 0 });
      }
      return { s: p.s, hit: false };
    });
    // first frame = the world camera (the player is standing on the entry tile); it then glides onto the course
    m.cam = { x: WS.camX - OX, y: WS.camY - OY };
    if (!isFinite(m.cam.x) || !isFinite(m.cam.y) || Math.abs(m.cam.y) > 400) m.cam = { x: G.clamp(m.moto.x - G.W / 2, 0, Math.max(0, WW - G.W)), y: 0 };
  }
  // part 2 starts right where the enduro broke (at = the spot where grandpa's bicycle landed); a retry starts at the sheepfold
  const DOG_GRACE = 1.4; // seconds on the bicycle before the dogs come out
  function setupPart2(m, at) {
    m._part2 = true; m.stage = 'ride'; m.rideT = 0; m.fade = at ? 0 : 1; m.sh = null; m.pl = null; m.oldBike = null; m.flock = [];
    if (!at) { m.parts = []; m.moto = null; } else if (m.moto) Object.assign(m.moto, { rider: G.LOOKS.shepherd, fallen: false, lean: 0, noclip: true }); // he putters off on it
    let p = at && !solidAt(at.x, at.y) && !solidAt(at.x, at.y - 4) ? at : ROUTE[ROUTE.iB - 12];
    const ri = nearestRoute(p.x, p.y), f = ROUTE[routeAhead(ri, 24)];
    m.bike = new G.Ent.Vehicle('bike', p.x, p.y, Math.atan2(f.y - p.y, f.x - p.x), '#8a4a2a'); m.bike.solidFn = solidAt; m.bike.rider = L(G.state.look); m.bike.lean = 0; m.bike.spin = 0;
    m.veh = m.bike; m.ri = ri; m.fdir = m.bike.a; m.wrong = false; m.wrongT = 0; m.idleT = 0;
    m.hp = 100; m.bites = 0; m.shoutCd = 0; m.biteCd = 0; m.flash = 0; m.dogsOut = false;
    m.dogs = mkDogs();
    if (!at) m.cam = { x: G.clamp(m.bike.x - G.W / 2, 0, Math.max(0, WW - G.W)), y: G.clamp(m.bike.y - G.H * 0.6, 0, WH - G.H) };
    G.audio.music('music_shepherd_chase', 150);
    U.banner('ΜΕΡΟΣ 2: ΤΟ ΠΟΔΗΛΑΤΟ', 'Γύρνα στην πόλη από τον άλλο χωματόδρομο. Βγαίνουν τα σκυλιά!', '#ffd400', 2.8);
  }
  // the shepherd putters off on the smoking enduro, down to his pastures
  function rideAway(m, dt) {
    const b = m.moto; if (!b) return;
    const ta = Math.atan2(WH - 400 - b.y, CLR.x - b.x);
    b.a += G.clamp(G.angleDiff(b.a, ta), -3 * dt, 3 * dt); b.drive(dt, 0.6, 0, false); tilt(b, dt);
    if (G.chance(dt * 6)) smoke(m, b.x, b.y, 1);
  }

  // ---------- shared riding ----------
  function ride(m, v, dt) {
    const before = Math.abs(v.speed), raw = G.readAxis(), mag = Math.min(1, Math.hypot(raw.x, raw.y));
    m.ri = nearestRoute(v.x, v.y);
    let ax = { x: raw.x, y: raw.y };
    if (mag > 0.2) {
      // road assist: pushing roughly along the road (either way) follows its curves instead of riding into the trees;
      // a diagonal push (dodging) is left alone
      const f = ROUTE[routeAhead(m.ri, 16)], bk = ROUTE[routeAhead(m.ri, -16)];
      const fa = Math.atan2(f.y - bk.y, f.x - bk.x), ia = Math.atan2(raw.y, raw.x);
      const tol = inClearing(v.x, v.y, 1.1) ? 1.05 : 0.62; // in the open sheepfold any push towards the road ahead counts
      const dir = Math.abs(G.angleDiff(ia, fa)) < tol ? 1 : Math.abs(G.angleDiff(ia, fa + Math.PI)) < tol ? -1 : 0;
      if (dir) { const t = ROUTE[routeAhead(m.ri, dir * 44)], dx = t.x - v.x, dy = t.y - v.y, d = Math.hypot(dx, dy) || 1; ax = { x: dx / d * mag, y: dy / d * mag }; }
    }
    G.driveDirect(v, dt, ax, G.device === 'pc' && G.held('action')); tilt(v, dt);
    if (!onTrack(v.x, v.y) && v.speed > v.spec.max * 0.4) { v.speed *= Math.pow(0.2, dt); if (G.chance(dt * 20)) m.parts.push({ k: 'leaf', x: v.x + G.rand(-4, 4), y: v.y, vx: G.rand(-20, 20), vy: G.rand(-20, 20), t: 0, life: 0.6 }); }
    if (before > 80 && Math.abs(v.speed) < before * 0.6) { G.audio.sfx('crash', 0.5); U.shake(3); }
    if (Math.abs(v.speed) > 40 && G.chance(dt * 25)) m.parts.push({ k: 'dust', x: v.x - Math.cos(v.a) * 11, y: v.y - Math.sin(v.a) * 11, vx: G.rand(-12, 12), vy: G.rand(-12, 12), t: 0, life: 0.55 });
    // which way is forward along the loop (camera look-ahead, the wrong-way prompt)
    const f = ROUTE[routeAhead(m.ri, 20)], bk = ROUTE[routeAhead(m.ri, -4)];
    let fx = f.x - bk.x, fy = f.y - bk.y; const fl = Math.hypot(fx, fy) || 1; fx /= fl; fy /= fl;
    m.fdir = Math.atan2(fy, fx);
    const fw = v.vx * fx + v.vy * fy;
    m.wrongT = fw < -25 ? m.wrongT + dt : 0; if (m.wrongT > 0.6) m.wrong = true; if (fw > 15) m.wrong = false;
    m.idleT = Math.abs(v.speed) < 20 ? m.idleT + dt : 0;
  }
  // part 1: the flocks on the road scatter off the track when the enduro comes through (a bump slows you down)
  function updateFlock(m, v, dt) {
    for (const q of m.flock) {
      const dx = q.x - v.x, dy = q.y - v.y, d = Math.hypot(dx, dy) || 1; q.bcd -= dt;
      if (q.panic <= 0 && d < 56 && Math.abs(v.speed) > 25) {
        const px = -Math.sin(v.a), py = Math.cos(v.a), side = dx * px + dy * py >= 0 ? 1 : -1, sp = G.rand(75, 100);
        q.vx = (px * side * 0.85 + dx / d * 0.35) * sp; q.vy = (py * side * 0.85 + dy / d * 0.35) * sp; q.panic = G.rand(0.9, 1.3); q.face = q.vx >= 0 ? 1 : -1;
        const fl = m.flocks[q.g]; if (!fl.hit) { fl.hit = true; G.audio.sfx('baa'); }
      }
      if (d < 8 && Math.abs(v.speed) > 50 && q.bcd <= 0) { // rode into one: it tumbles away, you lose speed
        q.bcd = 0.8; q.vx = dx / d * 140; q.vy = dy / d * 140; q.panic = 1; v.speed *= 0.7; G.audio.sfx('baa'); U.shake(2);
      }
      if (q.panic > 0) {
        q.panic -= dt; const nx = q.x + q.vx * dt, ny = q.y + q.vy * dt;
        if (!solidAt(nx, ny)) { q.x = nx; q.y = ny; } else { q.vx *= -0.3; q.vy *= -0.3; }
        q.vx *= Math.pow(0.3, dt); q.vy *= Math.pow(0.3, dt); q.hop = Math.abs(Math.sin(q.panic * 13)) * 2.2;
      } else q.hop = 0;
    }
  }
  function leaves(m, x, y, n) { for (let i = 0; i < n; i++) m.parts.push({ k: 'leaf', x, y: y - 6, vx: G.rand(-50, 50), vy: G.rand(-50, 30), t: 0, life: 0.7 }); }
  function smoke(m, x, y, n) { for (let i = 0; i < n; i++) m.parts.push({ k: 'smoke', x: x + G.rand(-4, 4), y: y - 4, vx: G.rand(-10, 10), vy: G.rand(-28, -12), t: 0, life: G.rand(0.9, 1.4) }); }

  // ---------- the shepherd: he chases you, you can't run him over, every catch is a crook hit ----------
  // He jumps out on the descent (only while he has hit you < 2 times); at the sheepfold he never gives up,
  // so the THIRD hit always lands there and breaks the bike.
  const ENC = [560, 1200, 1840], SH_RUN = 190, SH_FINAL = 330, HIT_DMG = 28;
  function shFace(s, dx, dy) { s.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 1) : (dy > 0 ? 0 : 3); s.face = dx >= 0 ? 1 : -1; }
  function spawnShepherd(m, final) {
    const p = ROUTE[routeAhead(m.ri, final ? 110 : 130)], side = Math.random() < 0.5 ? -1 : 1;
    const sx = p.x + side * (TW / 2 + 30), sy = p.y;
    m.sh = { x: sx, y: sy, sx, sy, tx: p.x, ty: p.y, side, final, mode: 'jump', t: 0, dir: side < 0 ? 2 : 1, face: -side, frame: 1, anim: 0, down: false, lift: 0, swing: -1 };
    leaves(m, sx, sy, 12); G.audio.sfx('whoosh');
  }
  function caught(m, s) {
    const b = m.moto, dx = b.x - s.x, dy = b.y - s.y, d = Math.hypot(dx, dy) || 1, nx = dx / d, ny = dy / d;
    // he plants the crook: the bike bounces off him
    b.speed = -Math.min(Math.abs(b.speed), 220) * 0.3; b.vx = nx * 150; b.vy = ny * 150;
    if (!b.blocked(b.x + nx * 5, b.y + ny * 5, b.a)) { b.x += nx * 5; b.y += ny * 5; }
    s.mode = 'swing'; s.t = 0; s.hit = false; s.lift = 0; shFace(s, dx, dy); s.frame = 0; G.audio.sfx('whoosh');
  }
  function breakMoto(m) {
    const b = m.moto, s = m.sh;
    m.vhp = 0; m.stage = 'cut'; m.cutT = 0; m.cutFlags = {}; G.audio.stopMusic(); G.audio.sfx('crash'); U.shake(6);
    b.speed = 0; b.vx = b.vy = 0; b.rider = null; b.fallen = true; s.mode = 'cut'; s.swing = -1; s.lift = 0;
    m.pl = { x: b.x, y: b.y + 4, vx: Math.cos(b.a + Math.PI) * 60 + G.rand(-20, 20), vy: Math.sin(b.a + Math.PI) * 60, down: true, dir: 0 };
    smoke(m, b.x, b.y, 8);
  }
  function updateShepherd(m, dt) {
    const s = m.sh, b = m.moto; if (!s) return;
    s.t += dt;
    const dist = G.dist(s.x, s.y, b.x, b.y);
    if (s.mode === 'jump') { // leaps out of the bushes onto the road ahead
      const k = Math.min(1, s.t / 0.45); s.x = G.lerp(s.sx, s.tx, k); s.y = G.lerp(s.sy, s.ty, k); s.lift = Math.sin(k * Math.PI) * 12;
      if (dist < 14) caught(m, s);
      else if (k >= 1) { s.mode = 'chase'; s.t = 0; s.lift = 0; leaves(m, s.x, s.y, 6); }
    } else if (s.mode === 'chase') {
      const px = b.x + b.vx * 0.2, py = b.y + b.vy * 0.2, dx = px - s.x, dy = py - s.y, d = Math.hypot(dx, dy) || 1;
      const sp = (s.final ? SH_FINAL : SH_RUN) * Math.min(1, 0.4 + s.t * 2);
      s.x += dx / d * sp * dt; s.y += dy / d * sp * dt; shFace(s, dx, dy);
      s.anim += dt * 10; s.frame = [0, 1, 0, 2][Math.floor(s.anim) % 4];
      if (dist < 14) caught(m, s);
      else if (!s.final && (dist > 230 || s.t > 8)) { s.mode = 'leave'; s.t = 0; m.say('vo_shepherd_kala', 'Καλά! Θα τα ξαναπούμε εμείς!', s, 2.2); }
    } else if (s.mode === 'swing') {
      s.swing = Math.min(1, s.t / 0.42);
      if (!s.hit && s.t > 0.14) {
        { const R = RIDER[(m.riderI = (m.riderI || 0) + 1) % RIDER.length]; m.say(R[0], R[1], m.veh || s, 1.2); } // the rider: «ΗΣΥΧΑ ΡΕ!»
        s.hit = true; m.hits++; m.vhp = m.hits >= 3 ? 0 : Math.max(5, m.vhp - HIT_DMG); m.flash = 0.35;
        G.audio.sfx('hit'); G.audio.sfx('crash', 0.5); U.shake(5); smoke(m, b.x, b.y, 4);
        U.toast('ΜΑΓΚΟΥΡΙΑ! ' + m.hits + '/3', 1.4);
        if (m.hits >= 3) { breakMoto(m); return; }
      }
      if (s.t > 0.42) { s.swing = -1; s.t = 0; s.mode = s.final ? 'rest' : 'leave'; }
    } else if (s.mode === 'rest') { // catches his breath, then again
      s.frame = 0; if (s.t > 0.9) { s.mode = 'chase'; s.t = 0; }
    } else if (s.mode === 'leave') { // back into the forest
      s.x += s.side * 150 * dt; s.dir = s.side > 0 ? 2 : 1; s.anim += dt * 10; s.frame = [0, 1, 0, 2][Math.floor(s.anim) % 4];
      if (s.t > 1.1) { leaves(m, s.x, s.y, 8); m.sh = null; }
    }
  }
  function updateCut(m, dt) {
    const b = m.moto, s = m.sh, p = m.pl, f = m.cutFlags; m.cutT += dt; const t = m.cutT;
    p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= Math.pow(0.02, dt); p.vy *= Math.pow(0.02, dt);
    if (G.chance(dt * 9)) smoke(m, b.x, b.y, 1); // the broken bike smokes
    if (!f.c) { b.spin = b.spin || 0; tilt(b, dt, b.fallen ? 1.35 : 0); } // lying on its side until he picks it up
    if (t > 0.5 && !f.a) { f.a = 1; m.say('vo_shepherd_mixanimou', 'Ρε, τη μηχανή μου!', p, 2); }
    if (t > 1.6 && !f.b) { f.b = 1; s.dir = 2; m.say('vo_shepherd_100', 'Περίμενε να πάρω το 100!', s, 2); }
    if (t > 3.6 && t < 4.2) { const k = (t - 3.6) / 0.6; s.x = G.lerp(s.x, b.x, k); s.y = G.lerp(s.y, b.y, k); s.frame = Math.floor(t * 8) % 2 ? 1 : 2; }
    if (t > 4.2 && !f.c) {
      f.c = 1; b.rider = G.LOOKS.shepherd; b.fallen = false; b.lean = 0; s.hidden = true; b.noclip = true;
      // grandpa's bicycle lands right here, next to you (on open ground)
      let ox = p.x + 16, oy = p.y - 6;
      if (solidAt(ox, oy) || solidAt(ox, oy - 4)) { const r = ROUTE[nearestRoute(p.x, p.y)]; ox = r.x; oy = r.y; }
      m.oldBike = { x: ox, y: oy - 24, ty: oy, t: 0 };
      m.say('vo_shepherd_dora', 'Πάρε το ποδήλατο του παππού. Αλλάξαμε!', b, 2.6);
    }
    if (f.c) {
      rideAway(m, dt);
      if (m.oldBike) { m.oldBike.t += dt; const k = Math.min(1, m.oldBike.t / 0.5); m.oldBike.cy = G.lerp(m.oldBike.y, m.oldBike.ty, k) - Math.sin(k * Math.PI) * 14; if (k >= 1 && !m.oldBike.landed) { m.oldBike.landed = true; G.audio.sfx('crash', 0.3); } }
    }
    if (t > 5.0) p.down = false;
    // you get up and walk over to the bicycle, then you're on it: part 2 starts on this very spot
    if (t > 5.3 && m.oldBike) {
      const ob = m.oldBike, dx = ob.x - 5 - p.x, dy = ob.ty - p.y, d = Math.hypot(dx, dy);
      if (d > 1) { const st = Math.min(d, 46 * dt); p.x += dx / d * st; p.y += dy / d * st; p.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 1) : (dy > 0 ? 0 : 3); p.walk = (p.walk || 0) + dt * 8; }
      else p.walk = 0;
    }
    const spot = () => m.oldBike ? { x: m.oldBike.x, y: m.oldBike.ty } : { x: p.x, y: p.y };
    if (t > 6.6 || (t > 1.5 && G.pressed('ok'))) setupPart2(m, spot());
  }

  // ---------- sheepdogs (part 2 only): they chase and nip, but you can always outrun them ----------
  function updateDogs(m, dt, v, bike) {
    const sp0 = v.spec.max * (bike ? 0.76 : 0.62), bite = bike ? 5 : 4;
    m.shoutCd -= dt; m.biteCd -= dt; m.flash = Math.max(0, m.flash - dt);
    if (m.rideT < DOG_GRACE) return; // a moment to get going first
    if (!m.dogsOut) { m.dogsOut = true; U.toast('ΤΑ ΤΣΟΠΑΝΟΣΚΥΛΑ! ΜΗ ΣΤΑΜΑΤΑΣ!', 1.8); } // the two at the sheepfold jump up right away (below)
    let closest = 1e9;
    for (const d of m.dogs) {
      d.bark = Math.max(0, d.bark - dt);
      const dist = G.dist(d.x, d.y, v.x, v.y);
      if (d.state === 'sit') {
        if (dist < 150 || d.fold) { d.state = 'chase'; d.t = 0; d.speed = sp0 * G.rand(0.92, 1.05); d.bark = 0.4; d.barkT = G.rand(0.8, 1.4); G.audio.sfx('bark'); }
        continue;
      }
      if (d.state === 'tired') { d.anim = 0; continue; }
      d.t += dt; d.hes -= dt; d.back -= dt; d.cd -= dt;
      let sp = d.speed * (d.hes > 0 ? 0.3 : 1);
      let a = Math.atan2(v.y + v.vy * 0.12 - d.y, v.x + v.vx * 0.12 - d.x);
      if (d.back > 0) { a += Math.PI; sp *= 0.5; }
      d.x += Math.cos(a) * sp * dt; d.y += Math.sin(a) * sp * dt; d.x = G.clamp(d.x, 6, WW - 6);
      d.face = Math.cos(a) >= 0 ? 1 : -1; d.anim += dt * 12;
      d.barkT -= dt; if (d.barkT <= 0 && dist < 150) { d.barkT = G.rand(1.0, 1.8); d.bark = 0.3; G.audio.sfx('bark', 0.5); }
      if (dist < 11 && d.cd <= 0 && m.biteCd <= 0) { // a nip: a small chunk, then the dog falls back
        d.cd = 1.8; d.back = 0.8; m.biteCd = 0.5; m.bites++; m.flash = 0.18; d.bark = 0.4; v.speed *= 0.85;
        if (bike) m.hp = Math.max(0, m.hp - bite); else m.vhp = Math.max(Math.min(m.vhp, 16), m.vhp - bite); // dogs alone never break the enduro
        G.audio.sfx('bark'); G.audio.sfx('hit', 0.5); U.shake(2); U.toast('ΔΑΓΚΩΜΑΤΙΑ!', 1.0);
      }
      if (d.t > 7 || dist > 240) { d.state = 'tired'; d.bark = 0; }
      if (d.back <= 0) closest = Math.min(closest, dist);
    }
    if (closest < 50 && m.shoutCd <= 0) {
      m.shoutCd = 3.2; const R = RIDER[(m.riderI = (m.riderI || 0) + 1) % RIDER.length]; m.say(R[0], R[1], v, 1.4);
      for (const d of m.dogs) if (d.state === 'chase' && G.dist(d.x, d.y, v.x, v.y) < 75) d.hes = 0.8;
    }
  }

  // camera: same as G.camFollow, but it may start outside the region (lined up with the world camera) and glide in
  function follow(m, x, y, dt, k = 6) {
    const c = m.cam, tx = G.clamp(x - G.W / 2, 0, Math.max(0, WW - G.W)), ty = G.clamp(y - G.H / 2, 0, Math.max(0, WH - G.H));
    c.x += (tx - c.x) * Math.min(1, dt * k); c.y += (ty - c.y) * Math.min(1, dt * k);
  }

  // ---------- render ----------
  function render(m, ctx) {
    const [shx, shy] = U.shakeOffset();
    const cx = Math.round(m.cam.x + shx), cy = Math.round(m.cam.y + shy); m.rcx = cx; m.rcy = cy;
    // ground + track + puddles (pre-baked HD chunks); where the camera shows past the region (the εθνική clearing
    // above the entry, at the start), the open world itself is drawn, so the first frame matches the map
    const outside = cy < 0 || cx < 0 || cx + G.W > WW || cy + G.H > WH;
    ctx.fillStyle = '#56653a'; ctx.fillRect(0, 0, G.W, G.H);
    if (outside && Wd.drawGround) Wd.drawGround(ctx, cx + OX, cy + OY);
    const c0 = Math.max(0, Math.floor(cy / CHH)), c1 = Math.min(Math.floor((WH - 1) / CHH), Math.floor((cy + G.H) / CHH));
    for (let k = c0; k <= c1; k++) { const c = bgChunk(k); ctx.drawImage(c, -cx, k * CHH - cy, c.lw, c.lh); }
    // soft puddle glints
    for (const d of WORLD.deco) {
      if (d.t !== 'puddle' || d.y < cy - 20 || d.y > cy + G.H + 20) continue;
      const a = 0.25 + 0.2 * Math.sin(G.t * 2 + d.y);
      ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.ellipse(d.x - cx + 1.5, d.y - cy + 0.4, 2.2, 0.7, 0, 0.2, Math.PI - 0.2); ctx.stroke();
    }
    // y-sorted objects
    const list = [], inView = y => y > cy - 30 && y < cy + G.H + 30;
    if (outside && Wd.visibleStatics) { const ws = []; Wd.visibleStatics(cx + OX, cy + OY, ws); for (const o of ws) list.push({ y: o.y - OY, fn: () => o.draw(ctx) }); }
    const k0 = Math.floor((cy - 30) / 64), k1 = Math.floor((cy + G.H + 30) / 64);
    for (let k = k0; k <= k1; k++) { const l = WORLD.bins.get(k); if (l) for (const o of l) list.push({ y: o.y, fn: () => drawObs(ctx, o, cx, cy) }); }
    for (const s of WORLD.sheep) if (inView(s.y)) list.push({ y: s.y, fn: () => drawSheep(ctx, s.x - cx, s.y - cy, s.ph) });
    for (const s of m.flock || []) if (inView(s.y)) list.push({ y: s.y, fn: () => drawSheep(ctx, s.x - cx, s.y - cy, s.ph, s.face, s.hop) });
    for (const d of m.dogs) if (inView(d.y)) list.push({ y: d.y, fn: () => drawDog(ctx, d.x - cx, d.y - cy, d.face, Math.floor(d.anim), d.brown, d.state !== 'chase', d.bark > 0) });
    for (const sg of SIGNS) if (inView(sg.y)) list.push({ y: sg.y, fn: () => drawSign(ctx, sg.x - cx, sg.y - cy, sg.ang) });
    if (m.sh && !m.sh.hidden) {
      const s = m.sh;
      list.push({ y: s.y, fn: () => { G.drawPerson(ctx, G.LOOKS.shepherd, s.x - cx, s.y - cy, s.dir, s.frame, { down: s.down, lift: s.lift }); if (s.swing >= 0) drawCrook(ctx, s.x - cx, s.y - cy - s.lift, s.face || 1, s.swing); } });
    }
    if (m.pl) { const p = m.pl; list.push({ y: p.y, fn: () => G.drawPerson(ctx, G.state.look, p.x - cx, p.y - cy, p.dir, p.walk ? [0, 1, 0, 2][Math.floor(p.walk) % 4] : 0, { down: p.down }) }); }
    if (m.oldBike) list.push({ y: m.oldBike.ty, fn: () => drawRideable(ctx, 'bike', m.oldBike.x - cx, (m.oldBike.cy != null ? m.oldBike.cy : m.oldBike.y) - cy, 0.15, { col: '#8a4a2a', lean: 0 }) });
    // two-wheelers drawn here (not Vehicle.draw): the rider sits ON the bike, no top-down rider boxes over dogs/sheep
    if (m.moto) list.push({ y: m.moto.y, fn: () => drawVeh(ctx, m.moto, cx, cy) });
    if (m.bike) list.push({ y: m.bike.y, fn: () => drawVeh(ctx, m.bike, cx, cy) });
    list.sort((a, b) => a.y - b.y).forEach(o => o.fn());
    for (const q of m.parts) {
      const a = Math.max(0, 1 - q.t / q.life), px = q.x - cx, py = q.y - cy;
      if (q.k === 'dust') {
        const r = 1.6 + (q.t / q.life) * 2.4, dg = ctx.createRadialGradient(px, py, 0, px, py, r);
        dg.addColorStop(0, `rgba(214,192,150,${0.7 * a})`); dg.addColorStop(1, 'rgba(214,192,150,0)');
        ctx.fillStyle = dg; ctx.beginPath(); ctx.arc(px, py, r, 0, 7); ctx.fill();
      } else if (q.k === 'smoke') {
        const r = 2.5 + (q.t / q.life) * 6, dg = ctx.createRadialGradient(px - r * 0.3, py - r * 0.3, 0, px, py, r);
        dg.addColorStop(0, 'rgba(120,118,116,' + (0.6 * a).toFixed(3) + ')'); dg.addColorStop(1, 'rgba(90,88,86,0)');
        ctx.fillStyle = dg; ctx.beginPath(); ctx.arc(px, py, r, 0, 7); ctx.fill();
      } else {
        ctx.save(); ctx.globalAlpha = a; ctx.translate(px, py); ctx.rotate(q.t * 9 + q.vx * 0.05);
        ell(ctx, 0, 0, 1.6, 0.8, '#4f8236', 'rgba(20,40,14,0.8)', 0.4); ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
    // fog: thick ahead, soft drifting wisps (radial gradients)
    const p2 = m.stage === 'ride';
    ctx.fillStyle = `rgba(215,222,228,${p2 ? 0.12 : 0.2})`; ctx.fillRect(0, 0, G.W, G.H);
    const gr = ctx.createLinearGradient(0, 0, 0, G.H);
    // thick fog ahead: down the mountain on the enduro, up towards the road on the bicycle
    if (!p2) { gr.addColorStop(0, 'rgba(222,228,234,0.05)'); gr.addColorStop(0.55, 'rgba(222,228,234,0.12)'); gr.addColorStop(1, 'rgba(222,228,234,0.8)'); }
    else { gr.addColorStop(0, 'rgba(222,228,234,0.45)'); gr.addColorStop(0.5, 'rgba(222,228,234,0.05)'); gr.addColorStop(1, 'rgba(222,228,234,0.35)'); }
    ctx.fillStyle = gr; ctx.fillRect(0, 0, G.W, G.H);
    for (let i = 0; i < 12; i++) {
      const bx = (((i * 137 + G.t * 8 * (1 + i % 3)) - cx * 0.8) % (G.W + 160) + G.W + 160) % (G.W + 160) - 80;
      const by = (((i * 89) - cy * 0.8) % (G.H + 120) + G.H + 120) % (G.H + 120) - 60;
      const rx = 56 + (i % 4) * 16, ry = 20 + (i % 3) * 7, al = 0.2 + 0.06 * Math.sin(G.t * 0.7 + i);
      ctx.save(); ctx.translate(bx, by); ctx.scale(rx, ry);
      const fg = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      fg.addColorStop(0, `rgba(234,238,242,${al})`); fg.addColorStop(0.6, `rgba(230,234,238,${al * 0.45})`); fg.addColorStop(1, 'rgba(230,234,238,0)');
      ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(0, 0, 1, 0, 7); ctx.fill(); ctx.restore();
    }
    // soft vignette so the forest edges feel deep
    const vg = ctx.createRadialGradient(G.W / 2, G.H / 2, G.H * 0.35, G.W / 2, G.H / 2, G.W * 0.7);
    vg.addColorStop(0, 'rgba(20,30,25,0)'); vg.addColorStop(1, 'rgba(20,30,25,0.28)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, G.W, G.H);
    if (m.flash > 0) { ctx.fillStyle = `rgba(255,40,40,${m.flash})`; ctx.fillRect(0, 0, G.W, G.H); }
    if (m.fade > 0) { ctx.fillStyle = `rgba(0,0,0,${m.fade})`; ctx.fillRect(0, 0, G.W, G.H); }
  }
  function hud(m) {
    const cx = m.rcx, cy = m.rcy, c = U.ctx;
    for (const sg of SIGNS) if (sg.y - cy > -10 && sg.y - cy < G.H + 30) U.text(sg.x - cx - 6, sg.y - 18 - cy, sg.label, 8, '#1d3f8f', 'center', null);
    U.drawBubbles(cx, cy);
    const bar = (x, y, w, f, col) => { U.box(x, y, w, 5, 'rgba(0,0,0,0.6)', null); c.fillStyle = col; c.fillRect(x + 1, y + 1, (w - 2) * G.clamp(f, 0, 1), 3); };
    if (m.stage === 'p1') {
      U.title(G.W / 2, 16, 'ΜΕΡΟΣ 1 · ΚΑΤΕΒΑ ΣΤΗ ΣΤΑΝΗ', 12, '#fff');
      bar(G.W / 2 - 50, 22, 100, m.best / ROUTE.aEnd, '#ff6a1a');
      U.text(G.W / 2 + 54, 27, 'ΣΤΑΝΗ', 7, '#fff');
      // the enduro's health: every crook hit is a big chunk, the 3rd breaks it
      U.text(G.W - 8, 14, 'ΜΗΧΑΝΗ', 7, '#fff', 'right'); bar(G.W - 66, 17, 58, m.vhp / 100, m.vhp > 35 ? '#ff6a1a' : '#ff3b30');
      U.text(G.W - 8, 33, 'Μαγκουριές: ' + m.hits + '/3', 7, '#ffb0b0', 'right');
    } else if (m.stage === 'ride') {
      const s0 = ROUTE.bStart, sNow = ROUTE[m.ri].s;
      U.title(G.W / 2, 16, 'ΜΕΡΟΣ 2 · ΓΥΡΝΑ ΣΤΗΝ ΠΟΛΗ', 12, '#ffd400');
      bar(G.W / 2 - 50, 22, 100, (sNow - s0) / (ROUTE.townS - s0), '#4cd964');
      U.text(G.W / 2, 37, Math.max(0, Math.round((ROUTE.townS - sNow) / 4)) + 'μ ως την πόλη', 7, '#fff', 'center');
      U.text(G.W - 8, 14, 'ΠΟΔΗΛΑΤΟ', 7, '#fff', 'right'); bar(G.W - 66, 17, 58, m.hp / 100, m.hp > 35 ? '#4cd964' : '#ff3b30');
      U.text(G.W - 8, 33, 'Δαγκωματιές: ' + m.bites, 7, '#ffb0b0', 'right');
    }
    // big arrow: riding the wrong way (or standing still for a while) → which way is forward on the loop
    if ((m.stage === 'p1' || m.stage === 'ride') && (m.wrong || m.idleT > 2.5)) {
      const ax = G.W / 2, ay = 78, sc = 1 + 0.08 * Math.sin(G.t * 8);
      c.save(); c.translate(ax, ay); c.rotate(m.fdir); c.scale(sc, sc);
      c.beginPath(); c.moveTo(-20, -6); c.lineTo(4, -6); c.lineTo(4, -15); c.lineTo(22, 0); c.lineTo(4, 15); c.lineTo(4, 6); c.lineTo(-20, 6); c.closePath();
      c.fillStyle = 'rgba(20,10,30,0.35)'; c.save(); c.translate(2, 3); c.fill(); c.restore();
      const ag = c.createLinearGradient(0, -15, 0, 15); ag.addColorStop(0, '#ffe45c'); ag.addColorStop(1, '#e0a800');
      c.fillStyle = ag; c.fill(); c.strokeStyle = INK; c.lineWidth = 1; c.stroke();
      c.restore();
      U.title(ax, ay + 32, m.wrong ? 'ΛΑΘΟΣ ΔΡΟΜΟΣ! ΓΥΡΝΑ ΠΙΣΩ' : 'ΑΠΟ ΕΔΩ!', 11, '#ffd400');
      U.text(ax, ay + 44, 'Ακολούθα τα βέλη στον χωματόδρομο', 7, '#fff', 'center');
    }
    if (m.stage === 'cut' && m.cutT > 1.5) U.text(G.W / 2, G.H - 10, G.device === 'mobile' ? '' : 'ENTER: παράλειψη', 7, '#ddd', 'center');
  }

  // ---------- the forest as a region of the open world ----------
  G.region({
    id: 'shepherd', tx: SP.tx, ty: SP.ty, w: RTW, h: RTH,
    entry: [ENTRY_TX, 0], // top edge, on the track, under the dirt path from the εθνική clearing
    miniDraw(c) {
      c.fillStyle = '#3f6a32'; c.fillRect(0, 0, RTW, RTH);
      c.fillStyle = '#9b8058'; for (let ty = 0; ty * 16 < TRACK_END; ty++) for (const cf of [cxA, cxB]) c.fillRect(Math.round(cf(ty * 16 + 8) / 16) - 2, ty, 4, 1);
      c.fillRect(Math.round((CLR.x - CLR.rx * 0.8) / 16), Math.round(CLR.y / 16) - 3, Math.round(CLR.rx * 1.6 / 16), 6);
    },
    paint(ctx, lx0, ly0, lw, lh) { buildWorld(); paintGround(ctx, Math.max(0, ly0 - 10), Math.min(WH, ly0 + lh + 10)); },
    solid: (lx, ly) => solidReg(lx, ly),
    live(ctx, ox, oy) { // puddle glints
      if (!WORLD) return;
      for (const d of WORLD.deco) {
        if (d.t !== 'puddle' || d.y + oy < -20 || d.y + oy > G.H + 20) continue;
        const a = 0.25 + 0.2 * Math.sin(G.t * 2 + d.y);
        ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.ellipse(d.x + ox + 1.5, d.y + oy + 0.4, 2.2, 0.7, 0, 0.2, Math.PI - 0.2); ctx.stroke();
      }
    },
    statics(push, ox, oy) { // trees, shrubs, rocks, resting sheep and sheepdogs, y-sorted with the world
      buildWorld();
      const y0 = -oy - 30, y1 = -oy + G.H + 40, inV = y => y > y0 && y < y1;
      for (let k = Math.floor(y0 / 64); k <= Math.floor(y1 / 64); k++) { const l = WORLD.bins.get(k); if (l) for (const o of l) push(o.y, c => drawObs(c, o, -ox, -oy)); }
      for (const s of WORLD.sheep) if (inV(s.y)) push(s.y, c => drawSheep(c, s.x + ox, s.y + oy, s.ph));
      for (const d of WORLD.dogs) if (inV(d.y)) push(d.y, c => drawDog(c, d.x + ox, d.y + oy, d.face, 0, d.brown, true, false));
    },
  });

  // =====================================================================
  const def = G.quest({
    id: 'shepherd', title: 'Ο τσοπάνης', short: 'Δάσος', col: '#ffd400', reward: 300,
    where: () => Wd.entryOf('shepherd'),
    start: () => G.push(def.make()),
    make: () => G.MiniGame({
      id: 'shepherd', title: 'Ο ΤΣΟΠΑΝΗΣ', reward: 300,
      // back on the map: where the bicycle reached the road if you won, else the entry tile
      exitTo() {
        const v = this.veh;
        if (this.phase === 'win' && v && v.y > 4 && !solidReg(v.x, v.y)) return [OX + v.x, OY + v.y];
        return [OX + ENTRY_TX * 16 + 8, OY + 10];
      },
      intro: {
        pc: 'ΜΕΡΟΣ 1: πάρε το enduro και κατέβα το βουνό ως τη στάνη. Τα πρόβατα βόσκουν στον δρόμο: αν τα τρομάξεις, ο τσοπάνης θα βγει με τη μαγκούρα... απόφυγέ τον!\nΜΕΡΟΣ 2: γύρνα στην εθνική από τον άλλο χωματόδρομο. Ακολούθα τα βέλη.\nWASD / βελάκια: η μηχανή πάει προς τα εκεί · SPACE: φρένο',
        mobile: 'ΜΕΡΟΣ 1: πάρε το enduro και κατέβα το βουνό ως τη στάνη. Τα πρόβατα βόσκουν στον δρόμο: αν τα τρομάξεις, ο τσοπάνης θα βγει με τη μαγκούρα... απόφυγέ τον!\nΜΕΡΟΣ 2: γύρνα στην εθνική από τον άλλο χωματόδρομο. Ακολούθα τα βέλη.\nΤο joystick δείχνει πού πας. Άφησέ το για φρένο.',
      },
      buttons: [], stick: 'stick',
      init() {
        buildWorld(); this.pl = null; this.oldBike = null; this.bike = null; this.parts = [];
        if (this._part2) setupPart2(this); else setupPart1(this);
      },
      onStart() {
        if (this.stage === 'p1') G.audio.music('music_shepherd', 128);
        else G.audio.music('music_shepherd_chase', 150);
      },
      update(dt) {
        const m = this;
        for (const q of m.parts) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; }
        m.parts = m.parts.filter(q => q.t < q.life);
        if (m.stage === 'p1') {
          const b = m.moto;
          if (!m.b1) { m.b1 = true; U.banner('ΜΕΡΟΣ 1: Η ΜΗΧΑΝΗ', 'Κατέβα το βουνό ως τη στάνη. Πρόσεχε τα πρόβατα!', '#ff6a1a', 2.6); }
          ride(m, b, dt); m.best = Math.max(m.best, ROUTE[m.ri].s);
          updateFlock(m, b, dt); m.flash = Math.max(0, m.flash - dt);
          // you scared his sheep: the shepherd jumps out on the descent (at most one hit per ambush, so the 3rd always
          // lands at the sheepfold); he also comes if you somehow got past a flock without scaring it
          const fl = m.flocks[m.enc];
          if (!m.sh && !m.faked && m.hits < 2 && m.enc < ENC.length && (m.best > ENC[m.enc] || (fl && fl.hit && m.best > fl.s + 60))) {
            spawnShepherd(m, false);
            if (m.enc === 0) m.say('vo_shepherd_marsars', 'Τι μαρσάρς; Τα κατσίκια τα γάμησες!', m.sh, 2.4);
            else m.say('vo_shepherd_pista', 'Τι είναι εδώ; Πίστα είναι;', m.sh, 2);
            m.enc++;
          }
          // the sheepfold: the fake "you made it" banner... then he's there and he doesn't give up
          if (!m.faked && m.best > ROUTE.aEnd - 110) {
            m.faked = true; m.finalT = 1.2; U.banner('ΤΑ ΚΑΤΑΦΕΡΕΣ!', 'Ξέφυγες από τον τσοπάνη! +' + G.fmtMoney(300), '#4cd964', 3); G.audio.sfx('mission_pass');
          }
          if (m.finalT > 0) {
            m.finalT -= dt;
            if (m.finalT <= 0) {
              if (m.sh) { m.sh.final = true; if (m.sh.mode === 'leave') { m.sh.mode = 'chase'; m.sh.t = 0; } } else spawnShepherd(m, true);
              m.say('vo_shepherd_opa', 'ΟΠΑ! Πού πας εσύ;', m.sh, 2);
            }
          }
          updateShepherd(m, dt);
          if (m.stage === 'p1') follow(m, b.x + Math.cos(m.fdir) * 55, b.y + Math.sin(m.fdir) * 55, dt);
        } else if (m.stage === 'cut') {
          updateCut(m, dt); if (m.stage === 'cut') follow(m, m.pl.x, m.pl.y + 20, dt, 2);
        } else if (m.stage === 'ride') {
          m.rideT += dt; m.fade = Math.max(0, m.fade - dt / 0.6);
          rideAway(m, dt); if (m.moto && G.dist(m.moto.x, m.moto.y, m.bike.x, m.bike.y) > 360) m.moto = null; // the shepherd is gone
          ride(m, m.bike, dt); updateDogs(m, dt, m.bike, true);
          follow(m, m.bike.x + Math.cos(m.fdir) * 50, m.bike.y + Math.sin(m.fdir) * 50, dt);
          if (m.hp <= 0) m.lose('Τα τσοπανόσκυλα σε έκαναν σουβλάκι. Ήσυχα, ήσυχα...');
          else if (m.bike.y < TOWN_Y) m.win('Γύρισες στην πόλη με το ποδήλατο του παππού. Η μηχανή βόσκει πλέον στο βουνό.');
        }
      },
      render(ctx) { render(this, ctx); },
      hud() { hud(this); },
    }),
  });
})();
