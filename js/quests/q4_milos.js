// GTA LUBEN — quest: Σερβιτόρος στη Μήλο
// The cove is a region of the open world (G.World.SPOTS.milos): you arrive by boat at the north pier and walk
// south across the island to the beach bar. Waiter job: champagne from the bar to rich tourists on floats, dodge the pufferfish.
'use strict';
(function () {
  const WS = G.worldScene, Wd = G.World, TS = 16;
  const SP = Wd.SPOTS.milos;
  const OX = SP.tx * TS, OY = SP.ty * TS; // region origin in world px
  const ENTRY = [12, 0];                   // local tile on the top edge (dirt path from the pier comes down here)
  const U = G.ui;
  const GOAL = 8;

  // ---------- helpers ----------
  // copy a look and drop the sprite-cache id, so the changed look gets its own sprite
  const L = (base, ext) => { const o = Object.assign({}, base, ext || {}); delete o._id; o.acc = (o.acc || []).slice(); return o; };
  // ---------- HD drawing helpers (light from the top-left, thin dark outlines, soft shadows) ----------
  const INK = 'rgba(28,20,36,0.85)', SHADOW = 'rgba(20,10,30,0.28)';
  function ell(ctx, x, y, rx, ry, fill, stroke, lw) {
    ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 0.7; ctx.stroke(); }
  }
  function rr(ctx, x, y, w, h, r, fill, stroke, lw) {
    ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 0.7; ctx.stroke(); }
  }
  function litGrad(ctx, x, y, r, c0, c1, c2) {
    const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.45, r * 0.08, x, y, r * 1.05);
    g.addColorStop(0, c0); g.addColorStop(0.55, c1); g.addColorStop(1, c2); return g;
  }
  function vgrad(ctx, y0, y1, c0, c1) { const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, c0); g.addColorStop(1, c1); return g; }
  // ---------- voice lines ----------
  const ORDER = [
    ['vo_milos_order1', 'Μπρο, φέρε κι άλλη!'],
    ['vo_milos_order2', 'Waiter! More σαμπάνια, παρακαλώ!'],
    ['vo_milos_order3', 'Γκαρσόν! Σαμπάνια, αλλά παγωμένη!'],
    ['vo_milos_order4', 'Excuse me φίλε... one more bottle!'],
    ['vo_milos_order5', 'Μοέ! Τώρα! Το νερό είναι ζεστό!'],
  ];
  const THANKS = [
    ['vo_milos_thanks1', 'Is this the real Greece?'],
    ['vo_milos_thanks2', 'Εφχαριστό! Very nice, very Mykonos!'],
    ['vo_milos_thanks3', 'Κράτα τα ρέστα, μεγάλε!'],
    ['vo_milos_thanks4', 'Opa! Γιάμας, my friend!'],
  ];
  const ANGRY = [
    ['vo_milos_angry1', 'Αργείς ρε! Θα σε θάψω στο TripAdvisor!'],
    ['vo_milos_angry2', 'Where is my champagne?! One star!'],
  ];

  // =====================================================================
  // PART 2: THE COVE
  // =====================================================================
  // region = 30 x 24 tiles. Top: the island's dry grass (entry path from the pier), then the beach,
  // white chalk cliffs on both sides, and the cove opens into the Aegean at the bottom edge.
  const RW = 30, RH = 24, BW = RW * TS, BH = RH * TS;
  const sandEnd = x => 108 + 6 * Math.sin(x * 0.045) + 3 * Math.sin(x * 0.13);
  const grassEnd = x => 20 + 5 * Math.sin(x * 0.04 + 1) + 3 * Math.sin(x * 0.11);
  // side cliffs: thin at the top (they rise out of the grass), widest along the cove, gone before the open sea
  const sideW = (y, s) => { const t = (y - 30) / (BH - 90); if (t <= 0 || t >= 1) return -8; return 50 * Math.pow(Math.sin(Math.PI * t), 0.55) + 5 * Math.sin(y * 0.11 + s); };
  const edgeL = y => sideW(y, 0);
  const edgeR = y => BW - sideW(y, 2);
  // chalk boulders on the top corners (a gap in the middle for the path down to the bar)
  const TOPROCKS = [[46, 30, 40, 22], [116, 18, 28, 13], [422, 28, 52, 24], [340, 16, 26, 12]]; // whole boulders, none cut by the region border
  const ISLETS = [[178, 292, 12], [404, 300, 10], [286, 206, 7]];
  const rockAt = (x, y) => x < edgeL(y) || x > edgeR(y) ||
    TOPROCKS.some(([ix, iy, rx, ry]) => ((x - ix) / rx) ** 2 + ((y - iy) / ry) ** 2 < 1) ||
    ISLETS.some(([ix, iy, r]) => (x - ix) * (x - ix) + (y - iy) * (y - iy) * 1.7 < r * r);
  const inWater = (x, y) => y > sandEnd(x);
  const BAR = { x: 240, y: 82 }; // pickup point in front of the counter
  const barSolid = (x, y) => x > 212 && x < 268 && y > 36 && y < 73;
  // inside the quest: you wade in the cove, but can't leave the region (no exit mid-shift)
  const beachSolid = (x, y) => rockAt(x, y) || barSolid(x, y) || x < 3 || x > BW - 3 || y < 4 || y > BH - 10;
  // in the open world: rocks, the bar and the water are solid, the grass and the beach are free to walk
  const regionSolid = (x, y) => rockAt(x, y) || barSolid(x, y) || y > sandEnd(x) - 1;
  const FLOATS = [[110, 152], [215, 160], [330, 158], [404, 172], [230, 250], [310, 268], [110, 270]];
  const RINGS = ['#ff7fb0', '#ffd400', '#ff8a3a', '#7ed957', '#ffffff', '#ff7fb0', '#7ec8ff'];
  const PUFF = [
    { k: 'line', cx: 240, cy: 196, ax: 115, ay: 0, sp: 0.55, ph: 0 },
    { k: 'circle', cx: 286, cy: 206, ax: 28, ay: 20, sp: 1.0, ph: 1 },
    { k: 'eight', cx: 140, cy: 210, ax: 42, ay: 26, sp: 0.55, ph: 2 },
    { k: 'vline', cx: 360, cy: 228, ax: 0, ay: 55, sp: 0.6, ph: 0.5 },
  ];
  const PUFF_EXTRA = [{ k: 'circle', cx: 178, cy: 292, ax: 32, ay: 24, sp: -0.8, ph: 0 }, { k: 'line', cx: 300, cy: 138, ax: 90, ay: 0, sp: 0.45, ph: 3 }];
  const TOURIST_LOOKS = () => [
    L(G.LOOKS.rich, { held: null }),
    { skin: '#b8784a', hair: '#151515', hairStyle: 'slick', top: '#b8784a', topStyle: 'tank', legs: '#1d4fa0', acc: ['shades', 'gold'] },
    { skin: '#d9935e', hair: '#f3dd8a', hairStyle: 'long', top: '#ff3e8a', topStyle: 'tank', legs: '#ff3e8a', acc: ['shades', 'gold', 'lipstick'], female: true },
    { skin: '#c98c62', hair: '#9a9a96', hairStyle: 'slick', top: '#ffd400', top2: '#ffffff', topStyle: 'shirt', legs: '#f4f4f4', acc: ['shades', 'gold', 'mustache'] },
    { skin: '#f6c9b0', hair: '#e0c070', hairStyle: 'bun', top: '#7ec8ff', topStyle: 'tank', legs: '#7ec8ff', acc: ['shades', 'earrings'], female: true },
    { skin: '#a8714a', hair: '#141210', hairStyle: 'buzz', top: '#a8714a', topStyle: 'tank', legs: '#111111', acc: ['shades', 'gold', 'muscles'] },
    { skin: '#e8a882', hair: '#d07a3a', hairStyle: 'long', top: '#ffffff', topStyle: 'tank', legs: '#ffffff', acc: ['shades', 'gold', 'earrings'], female: true },
  ];
  const BARMAN = { skin: '#c98c62', hair: '#141210', hairStyle: 'short', top: '#ffffff', topStyle: 'shirt', top2: '#1fa6c4', legs: '#f4f4f4', acc: ['mustache', 'gold'] };
  const SUNBATHER = { skin: '#d9935e', hair: '#f3dd8a', hairStyle: 'long', top: '#ffd400', topStyle: 'tank', legs: '#ffd400', acc: ['shades', 'gold'], female: true };

  // white volcanic rocks (Sarakiniko style) as smooth paths, matching rockAt()
  function rockPieces() {
    const out = [];
    const side = (fx, s) => { const p = new Path2D(); p.moveTo(fx(-60), 24); for (let y = 24; y <= BH - 50; y += 4) p.lineTo(fx(Math.max(-6, sideW(y, s))), y); p.lineTo(fx(-60), BH - 50); p.closePath(); return p; };
    out.push(side(v => v, 0), side(v => BW - v, 2));
    for (const [ix, iy, rx, ry] of TOPROCKS) { const p = new Path2D(); p.ellipse(ix, iy, rx, ry, 0, 0, Math.PI * 2); out.push(p); }
    for (const [ix, iy, r] of ISLETS) { const p = new Path2D(); p.ellipse(ix, iy, r, r / Math.sqrt(1.7), 0, 0, Math.PI * 2); out.push(p); }
    return out;
  }
  // ---------- blending into the open world around the region ----------
  const SEA = Wd.SEA_COLS || ['#5fb6ea', '#5fb6ea', '#4a9ae4', '#3a82dc', '#2a6ad0'];
  // Milos land is smooth white volcanic rock (Sarakiniko); the world exports its base colours
  const MC = Object.assign({ g: '#ebe9e2', T: '#ebe9e2', K: '#ebe9e2', s: '#efe7d4', p: '#e3dccc' }, Wd.MILOS_COL || {});
  // base colour of the world tile next to the region (same rules as the world's tile painter)
  function worldCol(tx, ty) {
    const c = Wd.get(tx, ty);
    if (c === 'O') {
      const iw = Wd.isleWaterCol && Wd.isleWaterCol('milos', tx * TS + 8, ty * TS + 8); if (iw) return iw; // the world's smooth island water
      let near = 9;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const n = Wd.get(tx + dx, ty + dy); if (n !== 'O' && n !== 'Z') near = Math.min(near, Math.max(Math.abs(dx), Math.abs(dy))); }
      return SEA[Math.min(4, near)];
    }
    if (c === 'D') return '#a8794a';
    return MC[c] || MC.g;
  }
  const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  // feather the edges of the region that face open water into the colour of the world's water just outside
  // (the land around the cove is the same white rock as the world's, painted by Wd.milosRockArea, so it needs no blending)
  // below the cliff tips the cove opens into the sea: there the region's water fades into the world's own island water
  // (W.paintCoast draws the same water the world shows outside; masked to the side / bottom edges)
  function cornerWater(x) {
    if (!Wd.paintCoast) return false;
    // layer = exactly the world's water here: open-sea colour + the world's depth-graded island water (W.paintCoast),
    // only where the cove has water (below the beach)
    const [lc, l] = G.hiCanvas(BW, BH, G.RS || 2), [mc, m] = G.hiCanvas(BW, BH, G.RS || 2);
    const wp = new Path2D(); wp.moveTo(-4, BH + 4); wp.lineTo(BW + 4, BH + 4); for (let sx = BW + 4; sx >= -4; sx -= 3) wp.lineTo(sx, sandEnd(sx) + 1); wp.closePath();
    l.save(); l.clip(wp);
    l.fillStyle = (Wd.SEA_COLS || [])[4] || '#2468c4'; l.fillRect(0, 0, BW, BH);
    l.translate(-OX, -OY); Wd.paintCoast(l, 'milos', OX, OY, OX + BW, OY + BH, true);
    l.restore();
    // mask: fully the world's water at the left / right / bottom edges, fading to the cove's own tint well inside
    m.globalCompositeOperation = 'lighter';
    const band = (x0, y0, x1, y1, rx, ry, rw, rh) => {
      const g = m.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.3, 'rgba(0,0,0,0.75)'); g.addColorStop(0.7, 'rgba(0,0,0,0.2)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      m.fillStyle = g; m.fillRect(rx, ry, rw, rh);
    };
    band(0, 0, 130, 0, 0, 0, 130, BH);
    band(BW, 0, BW - 130, 0, BW - 130, 0, 130, BH);
    band(0, BH, 0, BH - 150, 0, BH - 150, BW, 150);
    m.globalCompositeOperation = 'source-over';
    l.globalCompositeOperation = 'destination-in'; l.drawImage(mc, 0, 0, BW, BH); l.globalCompositeOperation = 'source-over';
    x.drawImage(lc, 0, 0, BW, BH);
    return true;
  }
  function blendEdges(x) {
    if (!Wd.t || !Wd.get) return;
    const shared = !!Wd.milosRockArea;
    const edges = [
      { n: RW, at: i => shared ? null : worldCol(SP.tx + i, SP.ty - 1), d: 26, side: 'top' },
      { n: RW, at: i => worldCol(SP.tx + i, SP.ty + RH), d: shared ? 80 : 46, side: 'bottom' },
      { n: RH, at: j => shared ? null : worldCol(SP.tx - 1, SP.ty + j), d: 20, side: 'left' },
      { n: RH, at: j => shared ? null : worldCol(SP.tx + RW, SP.ty + j), d: 20, side: 'right' },
    ];
    for (const e of edges) {
      const cols = []; for (let i = 0; i < e.n; i++) { const c = e.at(i); cols.push(c ? rgb(c) : null); }
      if (!cols.some(c => c)) continue;
      for (let i = 0; i < e.n; i++) if (!cols[i]) { let j = 1; while (!cols[i - j] && !cols[i + j] && j < e.n) j++; cols[i] = cols[i - j] || cols[i + j]; } // fill gaps, then mask strips by world land below
      const land = []; for (let i = 0; i < e.n; i++) land.push(!e.at(i));
      let gr;
      if (e.side === 'top') gr = [0, 0, 0, e.d]; else if (e.side === 'bottom') gr = [0, BH, 0, BH - e.d];
      else if (e.side === 'left') gr = [0, 0, e.d, 0]; else gr = [BW, 0, BW - e.d, 0];
      for (let s = 0; s < e.n * TS; s += 2) {
        const f = (s + 1) / TS - 0.5, fi = Math.floor(f), i0 = G.clamp(fi, 0, e.n - 1), i1 = G.clamp(fi + 1, 0, e.n - 1), k = G.clamp(f - fi, 0, 1);
        if (land[G.clamp(Math.floor(s / TS), 0, e.n - 1)]) continue;
        const c = cols[i0].map((v, q) => Math.round(v + (cols[i1][q] - v) * k)).join(',');
        const lg = x.createLinearGradient(gr[0], gr[1], gr[2], gr[3]);
        lg.addColorStop(0, `rgba(${c},1)`); lg.addColorStop(0.35, `rgba(${c},0.7)`); lg.addColorStop(1, `rgba(${c},0)`);
        x.fillStyle = lg;
        if (e.side === 'top') x.fillRect(s, 0, 2, e.d);
        else if (e.side === 'bottom') x.fillRect(s, BH - e.d, 2, e.d);
        else if (e.side === 'left') x.fillRect(0, s, e.d, 2);
        else x.fillRect(BW - e.d, s, e.d, 2);
      }
    }
  }
  let beachCache = null, beachRS = 0, beachT = null;
  function beachBG() {
    if (beachCache && beachRS === G.RS && beachT === Wd.t) return beachCache;
    beachRS = G.RS; beachT = Wd.t;
    const [cv, x] = G.hiCanvas(BW, BH, G.RS || 2);
    x.lineJoin = 'round'; x.lineCap = 'round';
    // water: turquoise shallows, deepening into the open Aegean blue at the bottom edge
    let g = x.createLinearGradient(0, 100, 0, BH);
    g.addColorStop(0, '#b4f6ee'); g.addColorStop(0.063, '#86e8e0'); g.addColorStop(0.28, '#3fcad1'); g.addColorStop(0.56, '#1fb0c9'); g.addColorStop(0.78, '#1f92cc'); g.addColorStop(1, '#2a6ad0');
    x.fillStyle = g; x.fillRect(0, 0, BW, BH);
    // soft sandy patches under the water
    for (let i = 0; i < 14; i++) {
      const px = G.hash(i, 71) * BW, py = 130 + G.hash(71, i) * 190, r = 18 + G.hash(i, 9) * 30;
      const rg = x.createRadialGradient(px, py, 0, px, py, r);
      rg.addColorStop(0, i % 3 ? 'rgba(170,250,240,0.22)' : 'rgba(10,90,140,0.16)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = rg; x.fillRect(px - r, py - r, r * 2, r * 2);
    }
    const rocks = rockPieces();
    // bright turquoise shallows hugging the rocks
    for (const p of rocks) { x.strokeStyle = 'rgba(150,240,232,0.35)'; x.lineWidth = 16; x.stroke(p); }
    for (const p of rocks) { x.strokeStyle = 'rgba(175,248,240,0.45)'; x.lineWidth = 8; x.stroke(p); }
    // sand: wet band at the waterline, then dry sand lit from the top-left
    const sandPath = dy => { const p = new Path2D(); p.moveTo(-4, -4); p.lineTo(BW + 4, -4); for (let sx = BW + 4; sx >= -4; sx -= 3) p.lineTo(sx, sandEnd(sx) + dy); p.closePath(); return p; };
    x.fillStyle = 'rgba(190,175,140,0.45)'; x.fill(sandPath(3));
    x.fillStyle = '#ddd0b2'; x.fill(sandPath(0));
    g = x.createLinearGradient(0, 20, BW * 0.3, 120); g.addColorStop(0, '#fbf5e8'); g.addColorStop(0.6, '#f3ead6'); g.addColorStop(1, '#e9dec6');
    x.fillStyle = g; x.fill(sandPath(-3.5));
    // sand ripples, footprints, shells
    x.save(); x.clip(sandPath(-2)); x.strokeStyle = 'rgba(160,150,130,0.26)'; x.lineWidth = 0.7;
    for (let i = 0; i < 40; i++) {
      const px = G.hash(i, 13) * BW, py = 34 + G.hash(13, i) * 71;
      x.beginPath(); x.moveTo(px - 5, py); x.quadraticCurveTo(px, py - 1.6, px + 5, py); x.stroke();
    }
    for (let i = 0; i < 10; i++) { const px = G.hash(i, 29) * BW, py = 40 + G.hash(29, i) * 60; ell(x, px + 0.4, py + 0.5, 1.2, 0.8, 'rgba(120,90,50,0.3)'); ell(x, px, py, 1.1, 0.8, i % 2 ? '#fff6ea' : '#f4c8b0', 'rgba(120,90,60,0.5)', 0.3); }
    x.restore();
    // the island's smooth white rock along the top (Sarakiniko), feathered into the sand
    const grassPath = dy => { const p = new Path2D(); p.moveTo(-4, -4); p.lineTo(BW + 4, -4); for (let sx = BW + 4; sx >= -4; sx -= 3) p.lineTo(sx, grassEnd(sx) + dy); p.closePath(); return p; };
    x.fillStyle = 'rgba(235,233,226,0.35)'; x.fill(grassPath(5));
    x.fillStyle = 'rgba(235,233,226,0.65)'; x.fill(grassPath(2.5));
    x.fillStyle = MC.g; x.fill(grassPath(0));
    if (Wd.milosRockArea) { x.save(); x.clip(grassPath(0)); x.translate(-OX, -OY); Wd.milosRockArea(x, OX - 4, OY - 4, OX + BW + 4, OY + 48); x.restore(); } // the world's rock, seamless at the border
    else { x.save(); x.clip(grassPath(-1));
    for (let i = 0; i < 16; i++) { // soft rounded forms: white light top-left, blue-grey shade bottom-right
      const px = G.hash(i, 37) * BW, py = 2 + G.hash(37, i) * 22, r = 14 + G.hash(i, 3) * 12;
      let rg = x.createRadialGradient(px - r * 0.2, py - r * 0.25, r * 0.15, px, py, r);
      rg.addColorStop(0, 'rgba(150,166,192,0)'); rg.addColorStop(0.72, 'rgba(150,166,192,0.2)'); rg.addColorStop(1, 'rgba(150,166,192,0)');
      x.fillStyle = rg; x.fillRect(px - r, py - r, r * 2, r * 2);
      rg = x.createRadialGradient(px - r * 0.3, py - r * 0.35, 0, px - r * 0.3, py - r * 0.35, r * 0.75);
      rg.addColorStop(0, 'rgba(255,255,255,0.7)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = rg; x.fillRect(px - r, py - r, r * 2, r * 2);
    }
    x.restore(); }
    // dirt path from the pier track down to the beach (lines up with the 2 world path tiles above the entry)
    const PX = ENTRY[0] * TS + 16, PE = grassEnd(PX);
    const dirt = new Path2D(); dirt.moveTo(PX - 16, -2); dirt.lineTo(PX + 16, -2);
    dirt.quadraticCurveTo(PX + 15, 18, PX + 10, PE + 8); dirt.quadraticCurveTo(PX, PE + 13, PX - 10, PE + 8); dirt.quadraticCurveTo(PX - 15, 18, PX - 16, -2); dirt.closePath();
    x.fillStyle = MC.p; x.fill(dirt); x.strokeStyle = 'rgba(205,196,176,0.9)'; x.lineWidth = 1.2; x.stroke(dirt);
    for (let i = 0; i < 6; i++) { const px = PX - 10 + G.hash(i, 61) * 20, py = 2 + G.hash(61, i) * 22; ell(x, px, py, 1.2, 0.7, 'rgba(170,160,140,0.45)'); }
    if (!cornerWater(x)) blendEdges(x); // the world's own water at the edges (old feathering only without the shared painter)
    // rocks: soft shadows, foam where they meet the water, outer outline, then lit fill clipped per piece (inner seams vanish)
    for (const p of rocks) { x.save(); x.translate(3, 4); x.fillStyle = 'rgba(20,40,60,0.28)'; x.fill(p); x.restore(); }
    const waterPath = new Path2D(); waterPath.moveTo(-4, BH + 4); waterPath.lineTo(BW + 4, BH + 4); for (let sx = BW + 4; sx >= -4; sx -= 3) waterPath.lineTo(sx, sandEnd(sx) + 1); waterPath.closePath();
    x.save(); x.clip(waterPath); for (const p of rocks) { x.strokeStyle = 'rgba(255,255,255,0.55)'; x.lineWidth = 3.2; x.stroke(p); } x.restore(); // foam ring
    for (const p of rocks) { x.strokeStyle = INK; x.lineWidth = 1.6; x.stroke(p); }
    g = x.createLinearGradient(0, 0, BW * 0.4, BH); g.addColorStop(0, '#fdfcf8'); g.addColorStop(0.5, '#f2efe6'); g.addColorStop(1, '#e2ddd0');
    for (const p of rocks) {
      x.save(); x.clip(p);
      x.fillStyle = '#a69f90'; x.fill(p);
      x.translate(-1.8, -2.2); x.fillStyle = '#d2ccbe'; x.fill(p);
      x.translate(-1.6, -1.8);
      if (Wd.milosRockArea) { x.clip(p); x.translate(3.4 - OX, 4 - OY); Wd.milosRockArea(x, OX - 8, OY - 8, OX + BW + 8, OY + BH + 8); } // same rock as the world around the cove
      else { x.fillStyle = g; x.fill(p); }
      x.restore();
    }
    // strata lines (only without the world's rock texture, which has its own) and pockmarks inside the rocks
    if (!Wd.milosRockArea) for (const p of rocks) {
      x.save(); x.clip(p);
      x.strokeStyle = 'rgba(150,140,120,0.3)'; x.lineWidth = 0.8;
      for (let sy = -10; sy < BH + 10; sy += 8) {
        x.beginPath();
        for (let sx = -4; sx <= BW + 4; sx += 6) { const yy = sy + 2.5 * Math.sin(sx * 0.05 + sy * 0.3) + Math.sin(sy * 0.05) * 3; sx === -4 ? x.moveTo(sx, yy) : x.lineTo(sx, yy); }
        x.stroke();
      }
      x.restore();
    }
    for (let i = 0; i < 90; i++) {
      const px = G.hash(i, 51) * BW, py = G.hash(51, i) * BH;
      if (!rockAt(px, py) || !rockAt(px + 4, py + 4) || px < 26 || px > BW - 26) continue; // none at the region border (the world's rock has none)
      ell(x, px, py, 1.4, 0.9, 'rgba(140,130,110,0.3)'); ell(x, px - 0.4, py - 0.4, 0.6, 0.35, 'rgba(255,255,255,0.6)');
    }
    cv.lw = BW; cv.lh = BH;
    beachCache = cv; return cv;
  }
  const ENTRY_PX = [ENTRY[0] * TS + 8, ENTRY[1] * TS + 10];
  // world camera clamp, in region-local px (the quest camera may look past the region: the world is drawn around it)
  function clampCam(cam) {
    if (!Wd.w) return;
    cam.x = G.clamp(cam.x, -OX, Wd.w * TS - G.W - OX); cam.y = G.clamp(cam.y, -OY, Wd.h * TS - G.H - OY);
  }
  function setupBeach(m) {
    m.stage = 'beach'; m.bt = 0; m.fade = 0;
    m.lookEmpty = L(G.state.look, { held: null }); m.lookTray = L(G.state.look, { held: 'tray' });
    // you start where you stood in the world (on the entry tile at the top of the region)
    let sx = ENTRY_PX[0], sy = ENTRY_PX[1];
    const pl = G.player;
    if (pl && isFinite(pl.x) && isFinite(pl.y)) {
      const lx = pl.x - OX, ly = pl.y - OY, qx = G.clamp(lx, 8, BW - 8), qy = G.clamp(ly, 8, BH - 14);
      if (Math.abs(qx - lx) < 24 && Math.abs(qy - ly) < 24 && !beachSolid(qx, qy)) { sx = qx; sy = qy; }
    }
    m.p = new G.Ent.Person(m.lookEmpty, sx, sy); m.p.solidFn = beachSolid; m.p.dir = 0;
    m.carry = 0; m.delivered = 0; m.tips = 0; m.lives = 3; m.inv = 0; m.kb = null; m.missed = 0;
    const looks = TOURIST_LOOKS();
    m.tourists = FLOATS.map(([x, y], i) => ({ x, y, by: y, ph: i * 1.7, ring: RINGS[i], flamingo: i === 2 || i === 5, donut: i === 0 || i === 4, lookA: looks[i], lookB: L(looks[i], { held: 'champagne' }), look: L(looks[i], { held: 'champagne' }), state: 'idle', cd: G.rand(0, 3), pat: 0, patMax: 1 }));
    m.puffers = PUFF.map(o => Object.assign({}, o, { x: o.cx, y: o.cy, inf: 0, face: 1 }));
    m.extra = 0; m.ordT = 1.2; m.parts = []; m.pops = []; m.winT = 0; m.wasWater = false; m.splT = 0; m.bossSaid = false;
    m.barman = { x: 240, y: 58 };
    // first frame lines up with the world camera
    m.cam = { x: (WS.camX || 0) - OX, y: (WS.camY || 0) - OY }; clampCam(m.cam);
    beachBG();
  }
  function splash(m, x, y, n) {
    for (let i = 0; i < n; i++) m.parts.push({ k: 'drop', x: x + G.rand(-3, 3), y: y - 1, z: 0, vx: G.rand(-25, 25), vy: G.rand(-6, 6), vz: G.rand(30, 70), t: 0, life: 0.5 });
  }
  function puffPos(f, t) {
    const a = t * f.sp + f.ph;
    if (f.k === 'line') return [f.cx + f.ax * Math.sin(a), f.cy + 2 * Math.sin(t * 2 + f.ph)];
    if (f.k === 'vline') return [f.cx + 2 * Math.sin(t * 2 + f.ph), f.cy + f.ay * Math.sin(a)];
    if (f.k === 'circle') return [f.cx + f.ax * Math.cos(a), f.cy + f.ay * Math.sin(a)];
    return [f.cx + f.ax * Math.sin(a), f.cy + f.ay * Math.sin(2 * a)]; // eight
  }
  function deliver(m, t) {
    const frac = t.pat / t.patMax;
    const tip = Math.round(15 + 30 * frac + G.rand(0, 15));
    m.carry--; m.delivered++; m.tips += tip;
    t.state = 'happy'; t.cd = G.rand(5, 9); t.look = t.lookB;
    G.audio.sfx('coin'); m.pops.push({ x: t.x, y: t.y - 30, text: '+' + G.fmtMoney(tip), t: 0 });
    const [k, s] = G.pick(THANKS); m.say(k, s, t, 2.4);
  }
  function hitPuffer(m, f) {
    const p = m.p;
    m.lives--; m.inv = 1.8; G.audio.sfx('hit'); U.shake(3);
    const a = Math.atan2(p.y - f.y, p.x - f.x); m.kb = { vx: Math.cos(a) * 130, vy: Math.sin(a) * 130, t: 0.35 };
    if (m.carry > 0) {
      for (let i = 0; i < m.carry; i++) m.parts.push({ k: 'bottle', x: p.x + i * 4, y: p.y, vx: G.rand(-12, 12), vy: G.rand(-8, 8), t: 0, life: 2.6 });
      U.toast('Έπεσε ο δίσκος! Οι σαμπάνιες πάνε για ψάρεμα.'); G.audio.sfx('crash', 0.4);
    }
    m.carry = 0; splash(m, p.x, p.y, 10);
    m.say('vo_milos_ouch', 'Άουτς! Λαγοκέφαλος!', p, 1.6);
    if (m.lives <= 0) m.lose('Οι λαγοκέφαλοι σε έφαγαν. Οι τουρίστες έμειναν διψασμένοι.');
  }
  function updateBeach(m, dt) {
    m.bt += dt;
    const p = m.p;
    if (!m.bossSaid && m.bt > 0.7) { m.bossSaid = true; m.say('vo_milos_boss', 'Πρώτη μέρα; Σαμπάνιες στους τουρίστες, γρήγορα!', m.barman, 3); }
    // ---- movement ----
    const water = inWater(p.x, p.y);
    if (water && !m.wasWater) { G.audio.sfx('splash', 0.5); splash(m, p.x, p.y, 8); }
    m.wasWater = water;
    const ax = G.readAxis(); let mx = ax.x, my = ax.y; const mg = Math.hypot(mx, my); if (mg > 1) { mx /= mg; my /= mg; }
    const sp = water ? 34 : 64;
    if (m.kb) { m.kb.t -= dt; p.move(m.kb.vx, m.kb.vy, dt); m.kb.vx *= Math.pow(0.05, dt); m.kb.vy *= Math.pow(0.05, dt); if (m.kb.t <= 0) m.kb = null; }
    else p.move(mx * sp, my * sp, dt);
    if (water && mg > 0.2) { m.splT -= dt; if (m.splT <= 0) { m.splT = 0.12; splash(m, p.x + G.rand(-4, 4), p.y, 2); } }
    p.look = m.carry > 0 ? m.lookTray : m.lookEmpty;
    m.inv = Math.max(0, m.inv - dt);

    // ---- bar / delivery ----
    const act = G.pressed('action') || G.pressed('enter') || G.pressed('a');
    const nearBar = G.dist(p.x, p.y, BAR.x, BAR.y) < 24;
    let target = null, bd = 26;
    for (const t of m.tourists) if (t.state === 'order') { const d = G.dist(p.x, p.y, t.x, t.y); if (d < bd) { bd = d; target = t; } }
    m.nearBar = nearBar; m.target = target;
    if (nearBar && m.carry < 2 && (act || m.carry === 0)) { m.carry = 2; G.audio.sfx('good'); m.pops.push({ x: p.x, y: p.y - 30, text: '+2 σαμπάνιες', t: 0 }); }
    else if (act && target) {
      if (m.carry > 0) deliver(m, target);
      else { U.toast('Άδειος δίσκος! Πήγαινε στο μπαρ.'); G.audio.sfx('bad'); }
    }

    // ---- tourists & orders ----
    for (const t of m.tourists) {
      t.y = t.by + Math.sin(G.t * 2 + t.ph);
      if (t.state === 'order') {
        t.pat -= dt;
        if (t.pat <= 0) {
          t.state = 'idle'; t.cd = 4; m.missed++; m.tips = Math.max(0, m.tips - 10); G.audio.sfx('bad');
          const [k, s] = G.pick(ANGRY); m.say(k, s, t, 2.4);
          m.pops.push({ x: t.x, y: t.y - 30, text: '-€10', t: 0, bad: true });
        }
      } else { t.cd -= dt; if (t.state === 'happy' && t.cd <= 0) { t.state = 'idle'; t.cd = G.rand(1, 3); } }
    }
    m.ordT -= dt;
    if (m.ordT <= 0 && m.delivered < GOAL) {
      m.ordT = G.rand(2.5, 4.5);
      const maxO = 2 + (m.delivered >= 3 ? 1 : 0) + (m.delivered >= 6 ? 1 : 0);
      const open = m.tourists.filter(t => t.state === 'order').length;
      const cand = m.tourists.filter(t => t.state === 'idle' && t.cd <= 0);
      if (open < maxO && cand.length) {
        const t = G.pick(cand); t.state = 'order'; t.patMax = t.pat = Math.max(16, 28 - m.delivered * 1.2); t.look = t.lookA;
        const [k, s] = G.pick(ORDER); m.say(k, s, t, 2.4); G.audio.sfx('blip');
      }
    }

    // ---- pufferfish ----
    if (m.delivered >= 3 && m.extra < 1) { m.extra = 1; m.puffers.push(Object.assign({}, PUFF_EXTRA[0], { x: PUFF_EXTRA[0].cx, y: PUFF_EXTRA[0].cy, inf: 0, face: 1 })); }
    if (m.delivered >= 5 && m.extra < 2) { m.extra = 2; m.puffers.push(Object.assign({}, PUFF_EXTRA[1], { x: PUFF_EXTRA[1].cx, y: PUFF_EXTRA[1].cy, inf: 0, face: 1 })); }
    for (const f of m.puffers) {
      const [nx, ny] = puffPos(f, m.bt);
      if (Math.abs(nx - f.x) > 0.01) f.face = nx > f.x ? 1 : -1;
      f.x = nx; f.y = ny;
      const d = G.dist(p.x, p.y - 3, f.x, f.y);
      f.inf += ((d < 46 ? 1 : 0) - f.inf) * Math.min(1, dt * 5);
      if (m.inv <= 0 && m.phase === 'play' && d < 3 + f.inf * 4 + 4) hitPuffer(m, f);
    }

    // ---- particles ----
    for (const q of m.parts) {
      q.t += dt;
      if (q.k === 'drop') { q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; q.vz -= 260 * dt; }
      else { q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= Math.pow(0.5, dt); q.vy *= Math.pow(0.5, dt); }
    }
    m.parts = m.parts.filter(q => q.t < q.life && !(q.k === 'drop' && q.z < 0 && q.t > 0.05));
    m.pops.forEach(q => q.t += dt); m.pops = m.pops.filter(q => q.t < 1.3);

    // ---- win ----
    if (m.delivered >= GOAL) {
      m.winT += dt;
      if (m.winT > 1.2) m.win('Σέρβιρες ' + GOAL + ' σαμπάνιες μέσα στη θάλασσα. Φιλοδωρήματα: ' + G.fmtMoney(m.tips) + '.', 300 + m.tips);
    }
    // follow like the world camera does (the island and the sea around the cove are drawn too)
    const k = Math.min(1, dt * 6);
    m.cam.x += (p.x - G.W / 2 - m.cam.x) * k; m.cam.y += (p.y - 10 - G.H / 2 - m.cam.y) * k; clampCam(m.cam);
  }

  // cute spiky pufferfish; inf 0..1 (inflated when you get close)
  function drawPuffer(ctx, x, y, inf, face) {
    y -= inf * 2;
    const r = 3 + inf * 4, wag = Math.sin(G.t * 14) * 0.8;
    ctx.save();
    ctx.globalAlpha = 0.8 + inf * 0.2;
    ell(ctx, x + 2, y + r + 2.4, r + 1.2, 1.6, 'rgba(10,60,90,0.28)'); // shadow on the sea bed
    if (inf > 0.4) ell(ctx, x, y + r + 1, r + 2.5 + Math.sin(G.t * 6) * 0.6, 1.5, null, 'rgba(255,255,255,0.55)', 0.6);
    ctx.translate(x, y); ctx.scale(face > 0 ? 1 : -1, 1); ctx.lineJoin = 'round';
    // tail fin
    ctx.beginPath(); ctx.moveTo(-r + 0.6, 0); ctx.lineTo(-r - 3, -2.3 + wag); ctx.quadraticCurveTo(-r - 2.2, wag * 0.5, -r - 3, 2.3 + wag); ctx.closePath();
    ctx.fillStyle = '#e8a83a'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.5; ctx.stroke();
    // spikes (grow when it inflates)
    if (inf > 0.25) {
      const n = 14, len = 0.8 + (inf - 0.25) * 3.2; ctx.fillStyle = '#7a4a12';
      for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2 + 0.2, ca = Math.cos(a), sa = Math.sin(a);
        ctx.beginPath(); ctx.moveTo(ca * (r - 0.3) - sa * 0.6, sa * (r - 0.3) + ca * 0.6); ctx.lineTo(ca * (r + len), sa * (r + len)); ctx.lineTo(ca * (r - 0.3) + sa * 0.6, sa * (r - 0.3) - ca * 0.6); ctx.closePath(); ctx.fill();
      }
    }
    // body
    ell(ctx, 0, 0, r, r, litGrad(ctx, 0, 0, r, '#fff4c2', '#f2c94c', '#c98a2a'), INK, 0.6);
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r - 0.3, 0, 7); ctx.clip(); ell(ctx, 0, r * 0.55, r * 0.85, r * 0.55, 'rgba(255,246,210,0.75)'); ctx.restore();
    ell(ctx, -r * 0.4, -r * 0.55, 0.6, 0.5, '#b07a2a'); ell(ctx, -r * 0.7, -0.4, 0.55, 0.45, '#b07a2a'); ell(ctx, -r * 0.1, -r * 0.75, 0.5, 0.4, '#b07a2a');
    // side fin
    ell(ctx, -0.6, 0.8 + (Math.sin(G.t * 12) > 0 ? 0 : 0.6), 1, 1.6, '#e8a83a', INK, 0.4);
    // big eye, blush, little "o" mouth
    const er = 1.1 + inf * 0.6, ex = r * 0.38, ey = -r * 0.42;
    ell(ctx, ex, ey, er, er, '#ffffff', INK, 0.4); ell(ctx, ex + er * 0.3, ey + er * 0.15, er * 0.5, er * 0.55, '#111'); ell(ctx, ex + er * 0.1, ey - er * 0.2, er * 0.2, er * 0.2, '#fff');
    ell(ctx, r * 0.3, r * 0.22, 0.9, 0.6, 'rgba(255,130,170,0.7)');
    ell(ctx, r * 0.96, 0.2, 0.6, 0.5 + inf * 0.35, '#c0392b');
    ctx.restore();
  }
  function drawTourist(m, ctx, t, cx, cy) {
    const fx = t.x - cx, fy = t.y - cy;
    const dark = G.shade(t.ring, -0.3), lite = G.shade(t.ring, 0.4);
    const ringFill = () => vgrad(ctx, fy - 4.6, fy + 4.6, lite, dark);
    ell(ctx, fx + 2.5, fy + 3.5, 12, 4.8, 'rgba(10,60,90,0.25)'); // shadow in the water
    // whole float (back half visible behind the tourist)
    ell(ctx, fx, fy, 10.5, 4.6, ringFill(), INK, 0.6);
    ell(ctx, fx, fy - 0.8, 5, 2, vgrad(ctx, fy - 2.8, fy + 1.2, '#1d9fb0', '#5fdcdf'), INK, 0.5);
    if (t.flamingo) {
      ctx.lineCap = 'round';
      ctx.strokeStyle = INK; ctx.lineWidth = 3.2; ctx.beginPath(); ctx.moveTo(fx + 9, fy - 1); ctx.quadraticCurveTo(fx + 11.5, fy - 7, fx + 9, fy - 13); ctx.stroke();
      ctx.strokeStyle = t.ring; ctx.lineWidth = 2.2; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(fx + 9.2, fy - 2); ctx.quadraticCurveTo(fx + 11, fy - 7, fx + 8.8, fy - 12); ctx.stroke();
      ell(ctx, fx + 8.6, fy - 14, 2.4, 1.8, litGrad(ctx, fx + 8.6, fy - 14, 2.4, lite, t.ring, dark), INK, 0.5);
      ctx.beginPath(); ctx.moveTo(fx + 6.6, fy - 14.8); ctx.quadraticCurveTo(fx + 4.6, fy - 14.4, fx + 5, fy - 12.4); ctx.lineTo(fx + 6.6, fy - 13.4); ctx.closePath(); ctx.fillStyle = '#222'; ctx.fill();
      ell(ctx, fx + 9.2, fy - 14.4, 0.5, 0.5, '#111');
    }
    G.drawPerson(ctx, t.look, fx, fy + 3, 0, 0);
    // front half of the float hides the legs
    ctx.save(); ctx.beginPath(); ctx.rect(fx - 12, fy - 0.3, 24, 7); ctx.clip();
    ell(ctx, fx, fy, 10.5, 4.6, ringFill(), INK, 0.6);
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = 0.9; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.ellipse(fx, fy, 8.6, 3.2, 0, Math.PI * 0.62, Math.PI * 0.9); ctx.stroke();
    if (t.donut) {
      const sp = ['#2d6bff', '#7ed957', '#ffd400', '#c0392b']; ctx.lineWidth = 0.8;
      for (let i = 0; i < 6; i++) { const sx = fx - 7.5 + i * 3, sy = fy + 1.4 + (i % 2) * 1.6; ctx.strokeStyle = sp[i % 4]; ctx.beginPath(); ctx.moveTo(sx - 0.5, sy - 0.3 * (i % 2 ? 1 : -1)); ctx.lineTo(sx + 0.5, sy + 0.3 * (i % 2 ? 1 : -1)); ctx.stroke(); }
    }
    // animated ripples around the float
    const rw = 12 + Math.sin(G.t * 3 + t.ph);
    ell(ctx, fx, fy + 1.5, rw, 5 + Math.sin(G.t * 3 + t.ph) * 0.4, null, 'rgba(255,255,255,0.4)', 0.6);
  }
  function drawOrderIcon(ctx, t, cx, cy) {
    const frac = Math.max(0, t.pat / t.patMax);
    const bx = Math.round(t.x - cx + 8), by = Math.round(t.y - cy - 36);
    if (!(frac < 0.25 && Math.floor(G.t * 6) % 2)) {
      rr(ctx, bx + 1, by + 1.5, 12, 15, 3, 'rgba(20,10,30,0.25)');
      ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(bx - 1, by - 1, 13, 15, 3); else ctx.rect(bx - 1, by - 1, 13, 15);
      ctx.moveTo(bx + 1, by + 13.5); ctx.lineTo(bx - 2.5, by + 16.5); ctx.lineTo(bx + 4, by + 13.5);
      ctx.fillStyle = vgrad(ctx, by - 1, by + 14, '#ffffff', '#e6ecf2'); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.7; ctx.stroke();
      // champagne bottle
      rr(ctx, bx + 4, by + 5, 3, 7.4, 1.2, litGrad(ctx, bx + 5.5, by + 8, 3.5, '#4f9a5a', '#1f5a2a', '#0f3016'), INK, 0.4);
      rr(ctx, bx + 4.8, by + 2.6, 1.4, 3, 0.5, '#1f5a2a');
      rr(ctx, bx + 4.5, by + 1.8, 2, 2, 0.6, '#e8c547');
      rr(ctx, bx + 4.1, by + 7.4, 2.8, 2, 0.4, '#e8c547');
      ell(ctx, bx + 4.8, by + 6.5, 0.4, 1.2, 'rgba(255,255,255,0.5)');
    }
    rr(ctx, bx - 1, by + 16, 13, 3.2, 1.6, 'rgba(17,17,17,0.85)');
    if (frac > 0) rr(ctx, bx, by + 16.9, Math.max(1.4, 11 * frac), 1.4, 0.7, frac > 0.5 ? '#4cd964' : frac > 0.25 ? '#ffd400' : '#ff3b30');
  }
  function drawBar(m, ctx, cx, cy) {
    const x = BAR.x - cx, y = 0 - cy;
    // poles
    for (const px of [x - 26, x + 24]) rr(ctx, px, y + 40, 2.2, 32, 1, vgrad(ctx, y + 40, y + 72, '#8a643c', '#4e331d'), INK, 0.5);
    // thatched straw roof
    ell(ctx, x + 3, y + 46, 32, 10, SHADOW);
    ell(ctx, x, y + 42, 32, 10.5, litGrad(ctx, x, y + 42, 32, '#f6dc8a', '#d9b25a', '#9a7a3a'), INK, 0.7);
    ctx.save(); ctx.beginPath(); ctx.ellipse(x, y + 42, 31.5, 10, 0, 0, 7); ctx.clip();
    ctx.strokeStyle = 'rgba(140,100,40,0.45)'; ctx.lineWidth = 0.6; ctx.beginPath();
    for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2; ctx.moveTo(x + Math.cos(a) * 4, y + 41 + Math.sin(a) * 1.3); ctx.lineTo(x + Math.cos(a) * 33, y + 42 + Math.sin(a) * 11); }
    ctx.stroke();
    ell(ctx, x, y + 42, 22, 7, null, 'rgba(150,110,45,0.35)', 0.6);
    ctx.restore();
    ell(ctx, x - 0.5, y + 40.6, 4, 1.6, litGrad(ctx, x - 0.5, y + 40.6, 4, '#e8c878', '#b8923f', '#8a6a2a'), INK, 0.4);
    G.drawPerson(ctx, BARMAN, m.barman.x - cx, m.barman.y - cy, 0, Math.floor(G.t * 2) % 3 === 0 ? 1 : 0);
    // wooden counter
    rr(ctx, x - 25, y + 63, 56, 14, 2, SHADOW);
    rr(ctx, x - 28, y + 59, 56, 14, 2, vgrad(ctx, y + 59, y + 73, '#a8743f', '#6e4524'), INK, 0.7);
    ctx.strokeStyle = 'rgba(60,35,15,0.35)'; ctx.lineWidth = 0.6; ctx.beginPath(); for (let i = -22; i < 27; i += 6) { ctx.moveTo(x + i, y + 64); ctx.lineTo(x + i, y + 72); } ctx.stroke();
    rr(ctx, x - 28, y + 58.5, 56, 5, 1.8, vgrad(ctx, y + 58.5, y + 63.5, '#dcab6e', '#b0803f'), INK, 0.6);
    ctx.strokeStyle = 'rgba(255,240,210,0.45)'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(x - 26, y + 59.6); ctx.lineTo(x + 26, y + 59.6); ctx.stroke();
    // ice bucket with bottles
    rr(ctx, x + 9.5, y + 51.5, 2, 6, 0.8, litGrad(ctx, x + 10.5, y + 54, 2.5, '#4f9a5a', '#1f5a2a', '#0f3016'), INK, 0.35);
    rr(ctx, x + 13.5, y + 50.5, 2, 7, 0.8, litGrad(ctx, x + 14.5, y + 53.5, 2.5, '#4f9a5a', '#1f5a2a', '#0f3016'), INK, 0.35);
    rr(ctx, x + 9.5, y + 51, 2, 1.3, 0.5, '#e8c547'); rr(ctx, x + 13.5, y + 50, 2, 1.3, 0.5, '#e8c547');
    rr(ctx, x + 8, y + 56.5, 8, 5.5, 1.6, vgrad(ctx, y + 56.5, y + 62, '#eef3f8', '#9aa4ae'), INK, 0.5);
    ell(ctx, x + 12, y + 57, 3.5, 0.9, '#f8fcff');
    ell(ctx, x + 9.6, y + 58.6, 0.6, 1.4, 'rgba(255,255,255,0.7)');
    // glasses
    for (const gx of [x - 18, x - 14]) { rr(ctx, gx, y + 57.8, 2.2, 3.4, 0.7, 'rgba(160,220,255,0.85)', 'rgba(40,70,100,0.6)', 0.35); ell(ctx, gx + 0.6, y + 58.8, 0.3, 0.8, 'rgba(255,255,255,0.8)'); }
  }
  function drawSunbed(ctx, x, y, col) {
    rr(ctx, x - 2, y - 5, 10, 18, 2, 'rgba(20,10,30,0.22)');
    rr(ctx, x - 5, y - 9, 10, 18, 2, '#ffffff', INK, 0.6);
    ctx.save(); rr(ctx, x - 4.4, y - 8.4, 8.8, 16.8, 1.6); ctx.clip();
    ctx.fillStyle = col; for (let i = 0; i < 18; i += 3) ctx.fillRect(x - 5, y - 9 + i, 10, 1.4);
    const sg = ctx.createLinearGradient(x - 5, y - 9, x + 5, y + 9); sg.addColorStop(0, 'rgba(255,255,255,0.3)'); sg.addColorStop(1, 'rgba(0,0,0,0.18)');
    ctx.fillStyle = sg; ctx.fillRect(x - 5, y - 9, 10, 18);
    ctx.restore();
    rr(ctx, x - 4, y - 8.6, 8, 3, 1.4, vgrad(ctx, y - 8.6, y - 5.6, '#ffffff', '#e4e4ea'), 'rgba(28,20,36,0.5)', 0.4);
  }
  function drawUmbrella(ctx, x, y, col) {
    ell(ctx, x + 4, y + 4, 12, 6, 'rgba(20,10,30,0.2)');
    rr(ctx, x - 0.6, y - 16, 1.3, 16, 0.6, '#8a6a3a', 'rgba(28,20,36,0.6)', 0.35);
    const cy0 = y - 18;
    ell(ctx, x, cy0, 12, 5.5, '#ffffff');
    ctx.fillStyle = col;
    for (let i = 0; i < 8; i += 2) { const a0 = i / 8 * Math.PI * 2, a1 = (i + 1) / 8 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(x, cy0); ctx.ellipse(x, cy0, 12, 5.5, 0, a0, a1); ctx.closePath(); ctx.fill(); }
    ell(ctx, x, cy0, 12, 5.5, litGrad(ctx, x, cy0, 12, 'rgba(255,255,255,0.35)', 'rgba(255,255,255,0)', 'rgba(0,0,0,0.22)'), INK, 0.6);
    ell(ctx, x, cy0 - 0.3, 1.2, 0.8, '#8a6a3a');
  }
  // animated water: caustics, highlight strokes, shore foam (shared by the quest and the open-world region)
  function drawWaterFx(ctx, cx, cy) {
    // drifting caustic light on the water (soft radial patches)
    for (let i = 0; i < 10; i++) {
      const px = (G.hash(i, 90) * BW + Math.sin(G.t * 0.4 + i) * 14) - cx, py = (140 + G.hash(90, i) * 180 + Math.cos(G.t * 0.33 + i * 2) * 8) - cy, r = 22 + (i % 3) * 10;
      if (px < -r || px > G.W + r || py < -r || py > G.H + r) continue;
      const cg = ctx.createRadialGradient(px, py, 0, px, py, r);
      cg.addColorStop(0, `rgba(210,255,250,${0.1 + 0.06 * Math.sin(G.t * 1.3 + i)})`); cg.addColorStop(1, 'rgba(210,255,250,0)');
      ctx.fillStyle = cg; ctx.fillRect(px - r, py - r, r * 2, r * 2);
    }
    // animated highlight strokes on the water
    const g = 18; ctx.lineCap = 'round'; ctx.lineWidth = 0.7;
    const gy0 = Math.max(0, Math.floor(cy / g)), gy1 = Math.min(BH / g, (cy + G.H) / g + 1), gx0 = Math.max(0, Math.floor(cx / g)), gx1 = Math.min(BW / g, (cx + G.W) / g + 1);
    for (let gy = gy0; gy < gy1; gy++) for (let gx = gx0; gx < gx1; gx++) {
      const h = G.hash(gx + 50, gy + 50); if (h > 0.35) continue;
      const ph = G.t * 1.7 + h * 8, wx = gx * g + h * 12 + Math.sin(ph) * 2, wy = gy * g + (h * 29) % g;
      if (!inWater(wx, wy) || rockAt(wx, wy) || wx < 3 || wx > BW - 3 || wy > BH - 2) continue;
      ctx.strokeStyle = `rgba(255,255,255,${Math.max(0, 0.2 + 0.22 * Math.sin(ph * 0.9 + 2))})`;
      ctx.beginPath(); ctx.moveTo(wx - cx - 2.5, wy - cy + 0.5); ctx.quadraticCurveTo(wx - cx, wy - cy - 1.2, wx - cx + 2.5, wy - cy + 0.5); ctx.stroke();
    }
    // shore foam: a lapping wave line plus a fainter receding one
    for (const [off, amp, al, lw] of [[1.5, 1.5, 0.8, 1.4], [5, 2.2, 0.35, 0.9]]) {
      ctx.strokeStyle = `rgba(255,255,255,${al})`; ctx.lineWidth = lw; ctx.beginPath(); let pen = false;
      for (let x = 0; x <= BW; x += 3) {
        const y = sandEnd(x) + off + Math.sin(G.t * 2 + x * 0.09 + off) * amp;
        if (rockAt(x, y) || x - cx < -6 || x - cx > G.W + 6) { pen = false; continue; }
        if (pen) ctx.lineTo(x - cx, y - cy); else { ctx.moveTo(x - cx, y - cy); pen = true; }
      }
      ctx.stroke();
    }
  }
  // standing things of the beach (bar, sunbeds, umbrellas, tourists on floats): push(localY, ctx => draw)
  const SUNBEDS = [[78, 84, '#2d6bff'], [100, 88, '#ff3e8a'], [372, 86, '#2d6bff'], [398, 82, '#ffd400']];
  function beachProps(push, cx, cy, bm, tourists) {
    push(60, c => drawBar(bm, c, cx, cy));
    SUNBEDS.forEach(([x, y, col], i) => {
      push(y + 9, c => { drawSunbed(c, x - cx, y - cy, col); if (i === 1) G.drawPerson(c, SUNBATHER, x - cx, y - cy + 6, 0, 0, { down: true }); });
      if (i % 2 === 0) push(y + 10, c => drawUmbrella(c, x + 12 - cx, y + 2 - cy, col));
    });
    for (const t of tourists) push(t.y + 4, c => drawTourist(bm, c, t, cx, cy));
  }
  function renderBeach(m, ctx) {
    const [shx, shy] = U.shakeOffset();
    const cx = Math.round(m.cam.x + shx), cy = Math.round(m.cam.y + shy); m.rcx = cx; m.rcy = cy;
    ctx.fillStyle = '#2a6ad0'; ctx.fillRect(0, 0, G.W, G.H);
    // the open world around the cove (its chunks already contain this region's background, same painter)
    if (Wd.t && Wd.drawGround) Wd.drawGround(ctx, cx + OX, cy + OY);
    else { const bg = beachBG(); ctx.drawImage(bg, -cx, -cy, bg.lw, bg.lh); }
    drawWaterFx(ctx, cx, cy);
    for (const f of m.puffers) drawPuffer(ctx, f.x - cx, f.y - cy, f.inf, f.face);
    for (const q of m.parts) if (q.k === 'bottle') {
      const bx = q.x - cx, by = q.y - cy + Math.sin(G.t * 4 + q.x) * 1;
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - q.t / q.life); ctx.translate(bx + 3, by - 1); ctx.rotate(Math.sin(G.t * 2 + q.x) * 0.3);
      ell(ctx, 0.5, 1.8, 3.6, 1, 'rgba(255,255,255,0.45)');
      rr(ctx, -3, -1.1, 5, 2.2, 1, vgrad(ctx, -1.1, 1.1, '#4f9a5a', '#163f1e'), INK, 0.4); rr(ctx, 1.8, -0.7, 1.6, 1.4, 0.5, '#e8c547');
      ctx.restore();
    }
    // y-sorted scene (plus the world's trees/props around the region)
    const list = [];
    beachProps((y, fn) => list.push({ y, fn }), cx, cy, m, m.tourists);
    if (Wd.t && Wd.visibleStatics) { const wl = []; Wd.visibleStatics(cx + OX, cy + OY, wl); for (const o of wl) list.push({ y: o.y - OY, fn: o.draw }); }
    const p = m.p;
    list.push({
      y: p.y, fn: () => {
        if (m.inv > 0 && Math.floor(G.t * 12) % 2) return;
        G.drawPerson(ctx, p.look, p.x - cx, p.y - cy, p.dir, p.frame);
        if (inWater(p.x, p.y)) {
          const px = p.x - cx, py = p.y - cy;
          // water over the legs: soft turquoise with a lit surface line and ripples
          ctx.save(); ctx.beginPath(); ctx.rect(px - 10, py - 4.2, 20, 8); ctx.clip();
          ell(ctx, px, py - 1, 8, 4.4, vgrad(ctx, py - 4.2, py + 2, 'rgba(120,230,232,0.92)', 'rgba(60,196,210,0.92)'));
          ctx.restore();
          const rw = 8 + Math.sin(G.t * 5);
          ell(ctx, px, py - 4.2, rw, 1.8, null, 'rgba(255,255,255,0.75)', 0.7);
          ell(ctx, px, py - 3.8, rw + 3, 2.6, null, 'rgba(255,255,255,0.3)', 0.5);
        }
      },
    });
    list.sort((a, b) => a.y - b.y).forEach(d => d.fn(ctx));
    for (const q of m.parts) if (q.k === 'drop') ell(ctx, q.x - cx, q.y - q.z - cy, 0.8, 0.8, q.t < 0.2 ? '#ffffff' : 'rgba(191,244,247,0.9)');
    for (const t of m.tourists) if (t.state === 'order') drawOrderIcon(ctx, t, cx, cy);
    // pickup marker at the bar: soft pulsing glow
    if (m.carry < 2) {
      const a = 0.45 + Math.sin(G.t * 5) * 0.2;
      ctx.save(); ctx.translate(BAR.x - cx, BAR.y - cy); ctx.scale(1, 0.45);
      const mg = ctx.createRadialGradient(0, 0, 0, 0, 0, 12); mg.addColorStop(0, `rgba(255,224,80,${a})`); mg.addColorStop(0.7, `rgba(255,212,0,${a * 0.6})`); mg.addColorStop(1, 'rgba(255,212,0,0)');
      ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(0, 0, 12, 0, 7); ctx.fill();
      ctx.strokeStyle = `rgba(255,212,0,${Math.min(1, a + 0.25)})`; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.arc(0, 0, 9, 0, 7); ctx.stroke();
      ctx.restore();
    }
  }
  function hudBeach(m) {
    const cx = m.rcx, cy = m.rcy;
    U.text(BAR.x - cx, 30 - cy, 'BEACH BAR «ΤΟ ΚΥΜΑ»', 7, '#fff', 'center');
    U.drawBubbles(cx, cy);
    U.text(8, 14, 'ΣΑΜΠΑΝΙΕΣ ' + Math.min(m.delivered, GOAL) + '/' + GOAL, 9, '#ffd400');
    U.text(8, 25, 'ΦΙΛΟΔΩΡΑ ' + G.fmtMoney(m.tips), 8, '#7dff7a');
    U.text(G.W - 8, 15, '♥'.repeat(Math.max(0, m.lives)) + '♡'.repeat(Math.max(0, 3 - m.lives)), 12, '#ff3b5c', 'right');
    U.text(G.W - 8, 26, 'ΔΙΣΚΟΣ ' + m.carry + '/2', 8, '#fff', 'right');
    for (const q of m.pops) U.text(q.x - cx, q.y - cy - q.t * 14, q.text, 8, q.bad ? '#ff5050' : '#7dff7a', 'center');
    let hint = '';
    const key = G.device === 'mobile' ? '' : '[SPACE] ';
    if (m.nearBar && m.carry < 2) hint = key + 'ΠΑΡΕ σαμπάνιες';
    else if (m.target && m.carry > 0) hint = key + 'ΔΩΣΕ τη σαμπάνια';
    else if (m.carry === 0 && m.bt < 12) hint = 'Πήγαινε στο μπαρ για σαμπάνιες';
    if (hint) U.text(G.W / 2, G.H - 30, hint, 8, '#7dd3ff', 'center');
  }

  // =====================================================================
  // the cove as a region of the open world (same painter as the quest)
  // =====================================================================
  const WORLD_BAR = { barman: { x: 240, y: 58 } };
  let worldTourists = null;
  const worldPuffers = PUFF.map(o => Object.assign({}, o));
  G.region({
    id: 'milos', tx: SP.tx, ty: SP.ty, w: RW, h: RH,
    entry: ENTRY,
    miniDraw(x) {
      for (let ty = 0; ty < RH; ty++) for (let tx = 0; tx < RW; tx++) {
        const px = tx * TS + 8, py = ty * TS + 8;
        x.fillStyle = rockAt(px, py) ? '#f2f0ea' : inWater(px, py) ? (py < 200 ? '#4fc8d4' : py < 320 ? '#2a92cc' : '#2a6ad0') : py < grassEnd(px) ? MC.g : '#f3ead6';
        x.fillRect(tx, ty, 1, 1);
      }
    },
    paint(ctx) { const bg = beachBG(); ctx.drawImage(bg, 0, 0, BW, BH); },
    solid: regionSolid,
    landAt: (x, y) => rockAt(x, y) || !inWater(x, y), // local px: the world's island shoreline / water colours take the cove into account
    live(ctx, ox, oy) {
      drawWaterFx(ctx, -ox, -oy);
      for (const f of worldPuffers) {
        const [x0] = puffPos(f, G.t - 0.05), [x, y] = puffPos(f, G.t);
        if (x + ox < -20 || x + ox > G.W + 20 || y + oy < -20 || y + oy > G.H + 20) continue;
        drawPuffer(ctx, x + ox, y + oy, 0, x >= x0 ? 1 : -1);
      }
    },
    statics(push, ox, oy) {
      if (!worldTourists) {
        const looks = TOURIST_LOOKS();
        worldTourists = FLOATS.map(([x, y], i) => ({ x, y, by: y, ph: i * 1.7, ring: RINGS[i], flamingo: i === 2 || i === 5, donut: i === 0 || i === 4, look: L(looks[i], { held: 'champagne' }) }));
      }
      for (const t of worldTourists) t.y = t.by + Math.sin(G.t * 2 + t.ph);
      beachProps(push, -ox, -oy, WORLD_BAR, worldTourists);
    },
  });

  // =====================================================================
  G.quest({
    id: 'milos', title: 'Σερβιτόρος στη Μήλο', short: 'Μήλος', col: '#ffd400', reward: 300,
    make: () => G.MiniGame({
      id: 'milos', title: 'ΣΕΡΒΙΤΟΡΟΣ ΣΤΗ ΜΗΛΟ', reward: 300,
      intro: {
        pc: 'Πρώτη μέρα στο beach bar της Μήλου. Πάρε σαμπάνιες από το μπαρ και πήγαινέ τες στους τουρίστες στα φουσκωτά. ' + GOAL + ' παραδόσεις. SPACE: πάρε/δώσε.\nΜην ακουμπήσεις λαγοκέφαλο! 3 ζωές.',
        mobile: 'Πρώτη μέρα στο beach bar της Μήλου. Πάρε σαμπάνιες από το μπαρ και πήγαινέ τες στους τουρίστες στα φουσκωτά. ' + GOAL + ' παραδόσεις. Κουμπί ΠΑΡΕ/ΔΩΣΕ.\nΜην ακουμπήσεις λαγοκέφαλο! 3 ζωές.',
      },
      buttons: [{ id: 'action', label: 'ΠΑΡΕ/ΔΩΣΕ' }],
      stick: 'stick',
      init() {
        this.fade = 0; this.parts = []; this.pops = [];
        setupBeach(this);
      },
      onStart() {
        G.audio.music('music_milos', 116);
      },
      update(dt) { updateBeach(this, dt); },
      render(ctx) { renderBeach(this, ctx); },
      hud() { hudBeach(this); },
      // back on the map where you stood (on the beach or the grass), or on the entry tile if you were in the water
      exitTo() {
        const p = this.p;
        if (p && !regionSolid(p.x, p.y) && p.y > 6) return [OX + p.x, OY + p.y];
        return [OX + ENTRY_PX[0], OY + ENTRY_PX[1]];
      },
    }),
  });
})();
