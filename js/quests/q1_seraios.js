// GTA LUBEN — quest: Το φίδι στις Σέρρες
// A village yard near Serres station (a region of the open world, G.World.SPOTS.seraios; you arrive by the
// real train ride and walk the dirt path down to the yard gate). Hit the big snake with a broom while the
// axe man swings wildly and his cat "helps". 3 bites and you lose.
//
// Voice lines (TODO: ο χρήστης θα στείλει ήχο → assets/sounds/vo_<key>.mp3):
//   seraios_start  «Εκεί είναι! Στα χόρτα! Φέρε τη σκούπα!»
//   seraios_grigora «Γρήγορα, φίδι!»            (axe man: the first time the snake comes out = fight starts; then on some emerges)
//   seraios_ssss    «Κάνει έναν ήχο… sssss»      (axe man: when the snake hisses: comes out on its own / dodges the axe)
//   seraios_katse   «Sound, κάτσε καλά!»         (axe man: when the snake rears up to bite you)
//   seraios_swing1 «Πάρε κι αυτό!»
//   seraios_swing2 «Έλα 'δω, σκουλήκι!»
//   seraios_swing3 «Χα! Σχεδόν!»
//   seraios_oops1  «Ουπς! Συγγνώμη, φίλε!»
//   seraios_oops2  «Κάνε στην άκρη, κόβει!»
//   seraios_grass  «Μπήκε στα χόρτα!»
//   seraios_grass2 «Στα χόρτα πάλι! Δεν τα κούρεψα φέτος...»
//   seraios_car    «Κάτω απ' τ' αμάξι! Μη μου το γρατζουνίσεις!»
//   seraios_coop   «Στο κοτέτσι! Οι κότες μου, ρε!»
//   seraios_cat    «Άσε τη γάτα, αυτή βοηθάει!»
//   seraios_bite   «Σε τσίμπησε; Φτου φτου, δεν είναι τίποτα!»
//   seraios_hit    «Μπράβο! Άλλη μία!»
//   seraios_flush  «Βγήκε! Βγήκε!»
//   seraios_win    «Τέλος! Πάμε για τσίπουρα!»
'use strict';
(function () {
  const WS = G.worldScene, Wd = G.World;

  const TS = 16, OUT = '#1a1420';
  const FA = [Math.PI / 2, Math.PI, 0, -Math.PI / 2];
  const dirFrom = (dx, dy) => Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 1) : (dy > 0 ? 0 : 3);
  const hsh = (a, b) => (((a * 73856093) ^ (b * 19349663)) >>> 0);
  const NSEG = 16, SP = 3, SNAKE_HP = 3; // was 8: fight is now ~20-30 s

  // ---------- HD-2D drawing helpers (see STYLE_HD.md) ----------
  const INK = 'rgba(28,20,36,0.85)', SHADOW = 'rgba(20,10,30,0.28)';
  const sh = (c, f) => G.shade(c, f);
  const rnd = (a, b) => (hsh(a, b) % 10000) / 10000; // deterministic 0..1
  function rr(x, px, py, w, h, r) { x.beginPath(); if (x.roundRect) x.roundRect(px, py, w, h, r); else x.rect(px, py, w, h); }
  function lin(x, x0, y0, x1, y1, cols) { const g = x.createLinearGradient(x0, y0, x1, y1); cols.forEach((c, i) => g.addColorStop(i / (cols.length - 1), c)); return g; }
  function rad(x, cx, cy, r, cols, ox = -0.35, oy = -0.4) { const g = x.createRadialGradient(cx + r * ox, cy + r * oy, r * 0.1, cx, cy, r * 1.15); cols.forEach((c, i) => g.addColorStop(i / (cols.length - 1), c)); return g; }
  function ell(x, cx, cy, rx, ry, fill, stroke, lw, rot = 0) { x.beginPath(); x.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2); if (fill) { x.fillStyle = fill; x.fill(); } if (stroke) { x.strokeStyle = stroke; x.lineWidth = lw || 0.6; x.stroke(); } }
  function tri(x, a, b, c, fill, stroke) { x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.lineTo(c[0], c[1]); x.closePath(); x.fillStyle = fill; x.fill(); if (stroke) { x.strokeStyle = stroke; x.lineWidth = 0.5; x.stroke(); } }
  function star(ctx, x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); }
    ctx.closePath(); ctx.fillStyle = '#ffd400'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.4; ctx.stroke();
  }

  // orange tabby, facing right, feet at (x, y). frame 0/1 walk, 2 sit
  function drawCat(ctx, x, y, f, flip) {
    const o = '#e8913f', d = '#ad5f28', l = '#f8dcb0';
    ctx.save(); ctx.translate(x, y); if (flip) ctx.scale(-1, 1);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const tail = (pts) => { ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); ctx.quadraticCurveTo(pts[2], pts[3], pts[4], pts[5]); ctx.strokeStyle = INK; ctx.lineWidth = 2.3; ctx.stroke(); ctx.strokeStyle = o; ctx.lineWidth = 1.3; ctx.stroke(); };
    const head = (hx, hy) => {
      tri(ctx, [hx - 2.3, hy - 1.2], [hx - 1.9, hy - 4], [hx - 0.3, hy - 2.4], o, INK);
      tri(ctx, [hx + 0.6, hy - 2.5], [hx + 2.2, hy - 4], [hx + 2.4, hy - 1.1], o, INK);
      ell(ctx, hx, hy, 2.7, 2.5, rad(ctx, hx, hy, 2.7, [sh(o, 0.3), o, sh(o, -0.2)]), INK, 0.6);
      ell(ctx, hx + 1.3, hy + 1, 1.4, 0.9, l);
      ell(ctx, hx + 0.9, hy - 0.6, 0.55, 0.75, '#3a8a2a'); ell(ctx, hx + 1, hy - 0.6, 0.18, 0.55, '#111');
      ell(ctx, hx + 2.5, hy + 0.5, 0.4, 0.3, '#e88');
      ctx.strokeStyle = d; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(hx - 1.2, hy - 2); ctx.lineTo(hx - 0.9, hy - 1.1); ctx.moveTo(hx - 0.2, hy - 2.3); ctx.lineTo(hx - 0.1, hy - 1.4); ctx.stroke();
    };
    if (f === 2) {
      tail([-1, -0.8, -6.5, -0.4, -5.6, -3.4]);
      ell(ctx, 0.4, -3.4, 3.5, 3.4, lin(ctx, -3, -7, 3, 0, [sh(o, 0.2), o, sh(o, -0.25)]), INK, 0.6);
      ell(ctx, 2.3, -3, 1.3, 2.3, l);
      ctx.strokeStyle = d; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(-2.4, -4.6); ctx.quadraticCurveTo(-1.6, -3.6, -2.2, -2.4); ctx.moveTo(-1, -5.8); ctx.quadraticCurveTo(-0.2, -4.6, -0.9, -3.4); ctx.stroke();
      rr(ctx, 1.6, -1.6, 1.4, 1.6, 0.7); ctx.fillStyle = l; ctx.fill();
      head(2.4, -7.4);
    } else {
      const s = f ? 1 : -1;
      const leg = (lx, col) => { rr(ctx, lx, -3.2, 1.5, 3.2, 0.75); ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.45; ctx.stroke(); };
      leg(-4.4 + s * 0.7, d); leg(2.2 - s * 0.7, d);
      tail([-4.6, -4.8, -7.2, -5.6, -6.8, -8.6]);
      ell(ctx, -0.6, -4.6, 4.7, 2.6, lin(ctx, -4, -7.2, 2, -2, [sh(o, 0.22), o, sh(o, -0.25)]), INK, 0.6);
      ell(ctx, -0.6, -3, 3.2, 0.9, 'rgba(248,220,176,0.8)');
      ctx.strokeStyle = d; ctx.lineWidth = 0.65; ctx.beginPath();
      for (let i = 0; i < 3; i++) { const sx = -3.6 + i * 2.2; ctx.moveTo(sx, -7); ctx.quadraticCurveTo(sx + 0.7, -5.8, sx + 0.2, -4.6); }
      ctx.stroke();
      leg(-3 - s * 0.7, o); leg(3.4 + s * 0.7, o);
      head(4.4, -6.6);
    }
    ctx.restore();
  }
  // white hen, facing right, feet at (x, y)
  function drawHen(ctx, x, y, f, flip) {
    ctx.save(); ctx.translate(x, y); if (flip) ctx.scale(-1, 1);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = '#e0962a'; ctx.lineWidth = 0.6; ctx.beginPath();
    const s = f ? 0.5 : -0.5;
    ctx.moveTo(-1, -1.6); ctx.lineTo(-1 + s, 0); ctx.moveTo(0.8, -1.6); ctx.lineTo(0.8 - s, 0); ctx.stroke();
    ell(ctx, -3.1, -4.4, 1.3, 2, '#e6e2d6', INK, 0.5, -0.5);
    ell(ctx, -0.3, -3.3, 3.3, 2.3, rad(ctx, -0.3, -3.3, 3.3, ['#ffffff', '#f1eee5', '#cfcabb']), INK, 0.5);
    ell(ctx, -0.8, -3.1, 1.8, 1.05, '#dcd7ca', null, 0, -0.2);
    ell(ctx, 2.3, -5.4, 1.55, 1.5, rad(ctx, 2.3, -5.4, 1.55, ['#ffffff', '#e4e0d4']), INK, 0.5);
    ell(ctx, 2.2, -7, 0.95, 0.6, '#d8303a', INK, 0.35);
    ell(ctx, 3.1, -4.4, 0.4, 0.6, '#d8303a');
    tri(ctx, [3.6, -5.9], [5, -5.45], [3.6, -5], '#f2b33a', INK);
    ell(ctx, 2.75, -5.7, 0.32, 0.32, '#111');
    ctx.restore();
  }

  // smooth tool (axe / broom) from a hand point along an angle
  function drawTool(ctx, hx, hy, ang, len, kind) {
    const c = Math.cos(ang), s = Math.sin(ang);
    const ex = hx + c * len, ey = hy + s * len;
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(ex, ey);
    ctx.strokeStyle = INK; ctx.lineWidth = 2.1; ctx.stroke();
    ctx.strokeStyle = kind === 'axe' ? '#8a5a2e' : '#cfa565'; ctx.lineWidth = 1.15; ctx.stroke();
    ctx.translate(ex, ey); ctx.rotate(ang);
    if (kind === 'axe') {
      ctx.beginPath(); ctx.moveTo(-2.2, -1.3); ctx.lineTo(1.3, -1.3); ctx.lineTo(2.3, 3.6); ctx.quadraticCurveTo(-0.5, 4.8, -3.3, 3.6); ctx.closePath();
      ctx.fillStyle = lin(ctx, -3, -1.3, 2, 4.4, ['#f2f6f8', '#b8c0c8', '#7e8890']); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.6; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 0.45; ctx.beginPath(); ctx.moveTo(-2.6, 3.4); ctx.quadraticCurveTo(-0.5, 4.2, 1.7, 3.4); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(-0.4, -1.3); ctx.lineTo(4.6, -2.7); ctx.lineTo(4.6, 2.7); ctx.lineTo(-0.4, 1.3); ctx.closePath();
      ctx.fillStyle = lin(ctx, 0, -2.7, 4, 2.7, ['#f0d27a', '#d8b25a', '#a8823a']); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.55; ctx.stroke();
      ctx.strokeStyle = 'rgba(120,85,30,0.6)'; ctx.lineWidth = 0.35; ctx.beginPath();
      for (let k = -1; k <= 1; k++) { ctx.moveTo(0.4, k * 0.7); ctx.lineTo(4.4, k * 1.6); } ctx.stroke();
      rr(ctx, -1.3, -1.5, 1.4, 3, 0.6); ctx.fillStyle = '#b8402e'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.4; ctx.stroke();
    }
    ctx.restore();
  }
  const noId = l => { const o = Object.assign({}, l); delete o._id; return o; };
  // quest camera in yard px; follows like G.camFollow but is clamped to the WORLD (the yard sits inside it)
  function camTo(cam, x, y, dt, k = 6) {
    cam.x += (x - G.W / 2 - cam.x) * Math.min(1, dt * k); cam.y += (y - G.H / 2 - cam.y) * Math.min(1, dt * k);
    cam.x = G.clamp(cam.x, -ORX(), Wd.w * TS - G.W - ORX()); cam.y = G.clamp(cam.y, -ORY(), Wd.h * TS - G.H - ORY());
  }

  // ---------- region in the open world ----------
  // The region (RWt x RHt tiles) = a 1-tile field margin left/right, 2 rows of field above (the dirt path from
  // Serres station comes down through them to the yard gate) and 3 rows of field below. All quest coordinates
  // are YARD px: yard px (0,0) = region-local px (OX, OY).
  const RSP = Wd.SPOTS.seraios;
  const RWt = 34, RHt = 22, OX = TS, OY = 2 * TS, RW = RWt * TS, RH = RHt * TS;
  const YW = 32 * TS, YH = 17 * TS;                        // the walled yard itself (32 x 17 tiles)
  const ENTRY = [19, 0];                                   // local tile on the top edge (the path is local cols 19-20)
  const ORX = () => RSP.tx * TS + OX, ORY = () => RSP.ty * TS + OY; // world px of yard (0,0)
  const AXE0 = [338, 60], CAT0 = [270, 60];                // where the axe man and the cat wait (world statics = quest start)

  // ---------- arena ----------
  let A = null;
  function buildArena() {
    const W = 32, H = 17, g = [];
    for (let y = 0; y < H; y++) g.push(new Array(W).fill('.'));
    const rect = (x, y, w, h, ch) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) g[j][i] = ch; };
    rect(0, 0, 32, 1, 'R'); rect(0, 1, 32, 1, 'H'); rect(17, 0, 4, 2, 'w');
    [1, 4, 10, 13, 23, 29].forEach(x => { g[1][x] = 'S'; }); g[1][7] = 'D'; g[1][26] = 'D';
    rect(18, 0, 2, 2, '.');                                   // the yard gate (top), between two stone pillars
    rect(0, 2, 1, 14, '#'); rect(31, 2, 1, 14, '#');
    rect(0, 16, 32, 1, 'w'); rect(14, 16, 4, 1, '.');        // back gate (bottom) onto the fields
    rect(1, 3, 6, 4, ','); rect(20, 12, 6, 3, ','); rect(2, 13, 3, 2, ',');
    [[9, 4], [25, 3], [6, 11], [29, 13]].forEach(([x, y]) => { g[y][x] = 'T'; });
    rect(26, 8, 4, 2, 'C'); rect(3, 2, 2, 1, 'F');
    [[12, 2], [15, 2], [22, 2]].forEach(([x, y]) => { g[y][x] = 'o'; });
    const rows = g.map(r => r.join(''));
    // legend only carries collision now; the look is painted by paintYard() (A.draw is never called)
    const legend = {
      '.': { col: '#c8a46e' }, ',': { col: '#7a9a3a' }, 'r': { col: '#5c5c60' },
      'R': { col: '#c0603a', solid: true }, 'H': { col: '#f2efe6', solid: true }, 'S': { col: '#f2efe6', solid: true },
      'D': { col: '#f2efe6', solid: true }, '#': { col: '#f4f1e8', solid: true }, 'w': { col: '#9a948a', solid: true },
      'T': { col: '#c8a46e', solid: true }, 'C': { col: '#9a6a3a', solid: true }, 'F': { col: '#c8a46e', solid: true },
      'o': { col: '#c8a46e', solid: true },
    };
    return G.Arena(rows, legend, TS);
  }

  // ---------- HD background: one hi-res canvas for the whole region, painted into the world chunks ----------
  let BG = null, BGRS = 0;
  // the countryside around the yard: same tiles as world.js paints there (Thessaly/Serres field patchwork)
  function fieldType(wx, wy) {
    if ((wx - 100) % 11 === 0 || wy % 8 === 0) return G.hash(wx, wy * 3) < 0.35 ? 'T' : '~';
    const h = G.hash(Math.floor((wx - 100) / 11) * 7 + 1, Math.floor(wy / 8) * 13 + 5);
    return h < 0.45 ? 'Y' : h < 0.68 ? 'L' : '~';
  }
  const inYardTile = (i, j) => i >= 1 && i <= 32 && j >= 2 && j <= 18;          // local tile inside the walled yard
  const onPath = (i, j) => (j <= 1 && i >= 19 && i <= 20) || (j >= 19 && i >= 15 && i <= 18);
  const MTREES = [];                                                             // margin trees (local tiles), like the world's tree lines
  for (let j = 0; j < RHt; j++) for (let i = 0; i < RWt; i++) {
    if (inYardTile(i, j) || onPath(i, j)) continue;
    if (fieldType(RSP.tx + i, RSP.ty + j) === 'T') MTREES.push([i, j]);
  }
  const MTSET = new Set(MTREES.map(([i, j]) => i + ',' + j));
  function paintField(x, i, j) {
    const wx = RSP.tx + i, wy = RSP.ty + j, c = fieldType(wx, wy), r = G.hash(wx, wy);
    const P = (a, b, w, h, col) => { x.fillStyle = col; x.fillRect(i * TS + a, j * TS + b, w, h); };
    if (c === 'Y') { P(0, 0, 16, 16, '#e2c25a'); for (let k = 1; k < 16; k += 4) { P(0, k, 16, 1.4, '#c9a23e'); P(0, k + 1.4, 16, 0.8, '#f3dc86'); } }
    else if (c === 'L') { P(0, 0, 16, 16, '#9a6c44'); for (let k = 2; k < 16; k += 4) { P(0, k, 16, 1.6, '#7a5232'); P(0, k + 1.6, 16, 0.8, '#b08258'); } }
    else {
      P(0, 0, 16, 16, '#78c850');
      if (r < 0.3) { P(3, 5, 1, 2, '#58a838'); P(4, 4, 1, 1, '#58a838'); P(10, 11, 1, 2, '#58a838'); P(11, 10, 1, 1, '#58a838'); }
      if (r > 0.85) P(7, 7, 2, 1, '#98e070');
    }
  }
  function regionBG() {
    if (BG && BGRS === G.RS) return BG;
    const [c, x] = G.hiCanvas(RW, RH, G.RS || 2);
    x.lineJoin = 'round'; x.lineCap = 'round';
    // fields everywhere (the yard covers the middle); the outer ring matches the world tiles exactly -> no seam
    for (let j = 0; j < RHt; j++) for (let i = 0; i < RWt; i++) paintField(x, i, j);
    // soft grass verge hugging the yard walls: field -> grass -> wall, no hard frame
    // (a blurred halo of grass around the yard rectangle; the rectangle itself is covered by the yard)
    x.save(); x.shadowColor = 'rgba(108,186,72,0.95)'; x.shadowBlur = 11 * (G.RS || 2);
    rr(x, OX + 1, OY - 2, YW - 2, YH + 3, 6); x.fillStyle = '#6cba48'; x.fill(); x.restore();
    for (let k = 0; k < 46; k++) { // weeds along the outside of the walls
      const side = k % 3, t = rnd(k, 71);
      const tx = side === 0 ? OX + t * YW : side === 1 ? 3 + rnd(k, 73) * 10 : OX + YW + 3 + rnd(k, 73) * 10;
      const ty = side === 0 ? OY + YH + 3 + rnd(k, 79) * 12 : OY + 8 + t * (YH - 4);
      if (side === 0 && tx > OX + 220 && tx < OX + 292) continue;
      for (let b = -1; b <= 1; b++) { x.beginPath(); x.moveTo(tx + b, ty); x.quadraticCurveTo(tx + b * 1.4, ty - 2.4, tx + b * 2.3, ty - 3.8 + Math.abs(b)); x.strokeStyle = '#4c8a2c'; x.lineWidth = 0.75; x.stroke(); }
    }
    // dirt path from Serres station (world 'p' tiles continue right above the region) down to the gate
    for (let j = 0; j <= 1; j++) for (let i = 19; i <= 20; i++) {
      const P = (a, b, w, h, col) => { x.fillStyle = col; x.fillRect(i * TS + a, j * TS + b, w, h); };
      const r = G.hash(RSP.tx + i, RSP.ty + j);
      P(0, 0, 16, 16, '#f0e2b8'); if (r < 0.4) P(Math.floor(r * 30) % 14, Math.floor(r * 77) % 14, 2, 1, '#dccb98');
      if (i === 19 && '~T'.includes(fieldType(RSP.tx + 18, RSP.ty + j))) P(0, 0, 2, 16, '#dccb98');
      if (i === 20 && '~T'.includes(fieldType(RSP.tx + 21, RSP.ty + j))) P(14, 0, 2, 16, '#dccb98');
    }
    // back gate: a worn track out into the fields that fades away
    { const g = x.createLinearGradient(0, OY + YH - 4, 0, RH); g.addColorStop(0, 'rgba(214,184,132,0.95)'); g.addColorStop(0.55, 'rgba(214,184,132,0.55)'); g.addColorStop(1, 'rgba(214,184,132,0)');
      rr(x, OX + 228, OY + YH - 6, 56, RH - OY - YH + 6, 14); x.fillStyle = g; x.fill();
      x.strokeStyle = 'rgba(150,110,60,0.25)'; x.lineWidth = 2.2; x.beginPath(); x.moveTo(OX + 242, OY + YH); x.lineTo(OX + 240, RH); x.moveTo(OX + 270, OY + YH); x.lineTo(OX + 272, RH); x.stroke(); }
    // shadows the yard casts onto the field (light top-left: down-right)
    x.fillStyle = SHADOW; rr(x, OX + YW, OY + 4, 4, YH - 4, 2); x.fill();
    x.save(); x.translate(OX, OY); paintYard(x); x.restore();
    BG = c; BGRS = G.RS; return c;
  }
  function stoneWall(x, px, py, w, h, seed) {
    x.save();
    rr(x, px, py, w, h, 2); x.fillStyle = lin(x, px, py, px + w * 0.3, py + h, ['#a39c8f', '#857f74', '#6c665d']); x.fill(); x.clip();
    const sw = 9, shh = 5.4;
    for (let j = 0, yy = py; yy < py + h; j++, yy += shh) {
      for (let xx = px - (j % 2) * 4.5; xx < px + w; xx += sw) {
        const k = rnd(Math.floor(xx) + seed, j + seed * 3), base = k < 0.33 ? '#a8a194' : k < 0.66 ? '#9b9487' : '#b0a99b';
        rr(x, xx + 0.6, yy + 0.6, sw - 1.2, shh - 1.2, 1.7);
        x.fillStyle = lin(x, xx, yy, xx + sw * 0.6, yy + shh, [sh(base, 0.2), base, sh(base, -0.18)]); x.fill();
        x.strokeStyle = 'rgba(40,32,30,0.35)'; x.lineWidth = 0.5; x.stroke();
      }
    }
    x.fillStyle = lin(x, 0, py, 0, py + h, ['rgba(255,255,255,0.10)', 'rgba(0,0,0,0)', 'rgba(20,10,30,0.22)']); x.fillRect(px, py, w, h);
    x.restore();
    rr(x, px, py, w, 3, 1.5); x.fillStyle = lin(x, 0, py, 0, py + 3, ['#d8d2c6', '#aaa498']); x.fill();
    rr(x, px, py, w, h, 2); x.strokeStyle = INK; x.lineWidth = 0.8; x.stroke();
  }
  // the walled yard, in yard px (0,0)-(YW,YH); drawn into the region canvas
  function paintYard(x) {
    const rows = A.rows, Wp = A.w * TS, Hp = A.h * TS;
    x.lineJoin = 'round'; x.lineCap = 'round';
    // --- packed-dirt yard: one large soft gradient, a sun patch, worn paths, sparse pebbles ---
    x.fillStyle = lin(x, 0, 32, Wp, 256, ['#dcbb86', '#cba56e', '#b48d59']); x.fillRect(0, 0, Wp, Hp);
    let gr = x.createRadialGradient(170, 90, 10, 170, 90, 230); gr.addColorStop(0, 'rgba(255,244,210,0.22)'); gr.addColorStop(1, 'rgba(255,244,210,0)');
    x.fillStyle = gr; x.fillRect(0, 0, Wp, Hp);
    // the station path comes in through the top gate and fades into the dirt
    gr = x.createLinearGradient(0, 0, 0, 44); gr.addColorStop(0, '#f0e2b8'); gr.addColorStop(1, 'rgba(240,226,184,0)');
    x.fillStyle = gr; x.fillRect(288, 0, 32, 44);
    x.strokeStyle = 'rgba(240,222,180,0.28)'; x.lineWidth = 20;
    x.beginPath(); x.moveTo(256, 262); x.quadraticCurveTo(236, 130, 120, 40); x.moveTo(250, 190); x.quadraticCurveTo(330, 110, 424, 40); x.moveTo(304, 30); x.quadraticCurveTo(300, 90, 256, 150); x.stroke();
    for (let i = 0; i < 14; i++) { const bx = rnd(i, 3) * Wp, by = 40 + rnd(i, 5) * 210, r = 12 + rnd(i, 8) * 18; ell(x, bx, by, r, r * 0.6, 'rgba(120,85,45,0.07)'); }
    for (let i = 0; i < 80; i++) {
      const px = rnd(i, 11) * Wp, py = 36 + rnd(i, 13) * 218, r = 0.7 + rnd(i, 17) * 0.9;
      ell(x, px + 0.4, py + 0.5, r, r * 0.7, 'rgba(90,60,30,0.3)'); ell(x, px, py, r, r * 0.7, rnd(i, 19) < 0.5 ? '#b8a07a' : '#cfc0a0'); ell(x, px - r * 0.3, py - r * 0.3, r * 0.35, r * 0.25, 'rgba(255,250,235,0.7)');
    }
    // --- grass patches: soft blobs + curved tufts ---
    [[1, 3, 6, 4], [20, 12, 6, 3], [2, 13, 3, 2]].forEach(([gx, gy, gw, gh], n) => {
      const px = gx * TS, py = gy * TS, w = gw * TS, h = gh * TS;
      rr(x, px - 2, py - 1, w + 4, h + 3, 8); x.fillStyle = 'rgba(70,50,20,0.18)'; x.fill();
      rr(x, px - 2, py - 2, w + 4, h + 3, 8);
      const gg = x.createRadialGradient(px + w * 0.3, py + h * 0.3, 4, px + w / 2, py + h / 2, Math.max(w, h) * 0.7);
      gg.addColorStop(0, '#9fc858'); gg.addColorStop(0.6, '#79a63c'); gg.addColorStop(1, '#5d8a2c');
      x.fillStyle = gg; x.fill(); x.strokeStyle = 'rgba(50,80,25,0.55)'; x.lineWidth = 0.8; x.stroke();
      for (let k = 0; k < gw * gh * 3; k++) {
        const tx = px + 3 + rnd(k, 31 + n) * (w - 6), ty = py + 4 + rnd(k, 37 + n) * (h - 6);
        for (let b = -1; b <= 1; b++) {
          x.beginPath(); x.moveTo(tx + b * 1.1, ty); x.quadraticCurveTo(tx + b * 1.4, ty - 2.5, tx + b * 2.4, ty - 4 + Math.abs(b));
          x.strokeStyle = '#4c7522'; x.lineWidth = 0.8; x.stroke();
        }
        x.beginPath(); x.moveTo(tx - 0.3, ty - 0.5); x.quadraticCurveTo(tx - 0.2, ty - 2.5, tx + 0.6, ty - 3.6); x.strokeStyle = 'rgba(200,230,130,0.8)'; x.lineWidth = 0.45; x.stroke();
      }
    });
    // --- shadows of everything that stands up (light from the top-left: shadows fall down-right) ---
    x.fillStyle = lin(x, 0, 32, 0, 40, ['rgba(20,10,30,0.32)', 'rgba(20,10,30,0)']); x.fillRect(16, 32, Wp - 32, 8);
    x.fillStyle = lin(x, 16, 0, 22, 0, ['rgba(20,10,30,0.3)', 'rgba(20,10,30,0)']); x.fillRect(16, 32, 6, 224);
    x.fillStyle = lin(x, 490, 0, 496, 0, ['rgba(20,10,30,0)', 'rgba(20,10,30,0.14)']); x.fillRect(490, 32, 6, 224);
    x.fillStyle = SHADOW; rr(x, 3, 259, 224, 16, 3); x.fill(); rr(x, 291, 259, 224, 16, 3); x.fill();
    rr(x, 419, 132, 64, 32, 4); x.fill();                              // coop
    rr(x, 51, 41, 31, 10, 4); x.fill();                                // firewood
    [12, 15, 22].forEach(tx => ell(x, tx * TS + 10, 47, 5, 1.8, SHADOW)); // pots
    A.find('T').forEach(([tx, ty]) => ell(x, tx * TS + 10.5, ty * TS + 15, 8, 3, 'rgba(20,10,30,0.3)'));
    // --- houses (row 0 roof, row 1 facade) with a stone wall between them ---
    const house = (x0, x1) => {
      const w = x1 - x0;
      x.fillStyle = lin(x, x0, 0, x0 + w * 0.25, 16, ['#de8058', '#b9593a', '#8e3e22']); x.fillRect(x0, 0, w, 16);
      for (let ry = 4.5, j = 0; ry < 15; ry += 4.5, j++) {
        x.strokeStyle = 'rgba(255,205,170,0.35)'; x.lineWidth = 0.6; x.beginPath(); x.moveTo(x0, ry - 4); x.lineTo(x1, ry - 4); x.stroke();
        x.strokeStyle = 'rgba(105,38,18,0.55)'; x.lineWidth = 0.7; x.beginPath();
        for (let sx = x0 + (j % 2) * 3; sx < x1; sx += 6) { x.moveTo(sx, ry); x.arc(sx + 3, ry, 3, Math.PI, 0, true); }
        x.stroke();
      }
      x.fillStyle = lin(x, 0, 13, 0, 16, ['#7a3420', '#5a2414']); x.fillRect(x0, 13.5, w, 2.5);
      x.fillStyle = lin(x, 0, 16, 0, 32, ['#f7f4ec', '#ebe6da', '#d6cfbf']); x.fillRect(x0, 16, w, 16);
      x.fillStyle = lin(x, 0, 16, 0, 20, ['rgba(20,10,30,0.28)', 'rgba(20,10,30,0)']); x.fillRect(x0, 16, w, 4);
      x.fillStyle = lin(x, 0, 29, 0, 32, ['#bdb6a6', '#9d9686']); x.fillRect(x0, 29.5, w, 2.5);
      x.fillStyle = lin(x, x0, 0, x1, 0, ['rgba(255,255,255,0.06)', 'rgba(20,10,30,0.12)']); x.fillRect(x0, 0, w, 32);
    };
    house(0, 272); house(336, Wp);
    for (let tx = 0; tx < A.w; tx++) {
      const ch = rows[1][tx], px = tx * TS;
      if (ch === 'S') {
        rr(x, px + 5, 19, 6, 9.5, 1); x.fillStyle = lin(x, px + 5, 19, px + 11, 28.5, ['#3a4c60', '#1b2430']); x.fill(); x.strokeStyle = INK; x.lineWidth = 0.5; x.stroke();
        x.strokeStyle = 'rgba(180,215,255,0.4)'; x.lineWidth = 0.8; x.beginPath(); x.moveTo(px + 6, 24); x.lineTo(px + 9, 20.2); x.stroke();
        [px + 1.4, px + 10.6].forEach(sx => {
          rr(x, sx, 18.5, 4, 10.5, 1); x.fillStyle = lin(x, sx, 18.5, sx + 4, 29, ['#4a9acb', '#2f73a3', '#205479']); x.fill();
          x.strokeStyle = 'rgba(15,40,60,0.45)'; x.lineWidth = 0.4; x.beginPath(); for (let yy = 20.2; yy < 28.5; yy += 1.6) { x.moveTo(sx + 0.6, yy); x.lineTo(sx + 3.4, yy); } x.stroke();
          rr(x, sx, 18.5, 4, 10.5, 1); x.strokeStyle = INK; x.lineWidth = 0.5; x.stroke();
        });
        rr(x, px + 1, 28.7, 14, 1.5, 0.7); x.fillStyle = '#efeadf'; x.fill(); x.strokeStyle = 'rgba(28,20,36,0.5)'; x.lineWidth = 0.4; x.stroke();
      } else if (ch === 'D') {
        x.beginPath(); if (x.roundRect) x.roundRect(px + 3, 18.2, 10, 13.8, [4, 4, 0.5, 0.5]); else x.rect(px + 3, 18.2, 10, 13.8);
        x.fillStyle = lin(x, px + 3, 18, px + 13, 32, ['#5a86c4', '#3a5f9a', '#284777']); x.fill(); x.strokeStyle = INK; x.lineWidth = 0.6; x.stroke();
        x.strokeStyle = 'rgba(255,255,255,0.2)'; x.lineWidth = 0.5; x.beginPath(); x.moveTo(px + 8, 19.5); x.lineTo(px + 8, 31.5); x.stroke();
        x.strokeStyle = 'rgba(20,35,60,0.5)'; x.lineWidth = 0.45;
        [[4.2, 21, 4.2], [9, 21, 4.2], [4.2, 26.5, 4], [9, 26.5, 4]].forEach(([ox, oy, oh]) => { rr(x, px + ox, oy, 2.8, oh, 0.8); x.stroke(); });
        ell(x, px + 10.6, 25.8, 0.6, 0.6, '#e8c547', 'rgba(90,60,10,0.7)', 0.3);
      }
    }
    for (const [x0, x1] of [[0, 272], [336, Wp]]) { rr(x, x0 + 0.4, 0.4, x1 - x0 - 0.8, 31.6, 1.5); x.strokeStyle = INK; x.lineWidth = 0.9; x.stroke(); }
    // the yard gate: two stone pillars with a vine, the opening between them faces the path from the station
    x.fillStyle = SHADOW; rr(x, 291, 6, 3, 28, 1.5); x.fill(); rr(x, 339, 6, 3, 28, 1.5); x.fill();
    stoneWall(x, 272, 0, 16, 32, 5); stoneWall(x, 320, 0, 16, 32, 7);
    for (const px of [272, 320]) { rr(x, px - 1, -1, 18, 4, 1.5); x.fillStyle = lin(x, 0, -1, 0, 3, ['#e08a5a', '#a54e2c']); x.fill(); x.strokeStyle = INK; x.lineWidth = 0.6; x.stroke(); }
    for (let i = 0; i < 8; i++) { const px = i % 2 ? 322 : 274; ell(x, px + rnd(i, 61) * 12, 6 + rnd(i, 67) * 22, 2.2, 1.6, i % 4 < 2 ? '#5e9a34' : '#7ab848', 'rgba(30,60,20,0.6)', 0.4); }
    // --- yard walls (stone, darker than the dirt) ---
    stoneWall(x, 0, 32, 16, 224, 11); stoneWall(x, 496, 32, 16, 224, 13);
    stoneWall(x, 0, 256, 224, 16, 17); stoneWall(x, 288, 256, 224, 16, 19);
    [[216, 251], [286, 251]].forEach(([px, py]) => {
      rr(x, px + 3, py + 4, 10, 22, 2); x.fillStyle = SHADOW; x.fill();
      rr(x, px, py, 10, 22, 2); x.fillStyle = lin(x, px, py, px + 10, py + 22, ['#f2eee4', '#d6cfc0', '#b0a998']); x.fill(); x.strokeStyle = INK; x.lineWidth = 0.8; x.stroke();
      rr(x, px - 1, py - 1, 12, 3.4, 1.5); x.fillStyle = lin(x, 0, py - 1, 0, py + 2.4, ['#e08a5a', '#a54e2c']); x.fill(); x.strokeStyle = INK; x.lineWidth = 0.6; x.stroke();
    });
    // --- firewood stack ---
    rr(x, 48.5, 37, 31, 11, 3); x.fillStyle = lin(x, 48, 37, 60, 48, ['#9a6a3e', '#6e4626', '#4e301a']); x.fill(); x.strokeStyle = INK; x.lineWidth = 0.7; x.stroke();
    for (let j = 0; j < 2; j++) for (let i = 0; i < 6; i++) {
      const lx = 51.5 + i * 5.1 + (j ? 2.5 : 0), ly = j ? 40.6 : 45;
      if (j && i > 4) continue;
      ell(x, lx, ly, 2.5, 2.3, rad(x, lx, ly, 2.5, ['#f0c88c', '#d8a060', '#a8703c']), INK, 0.5);
      x.strokeStyle = 'rgba(130,80,35,0.55)'; x.lineWidth = 0.35; x.beginPath(); x.arc(lx, ly, 1.2, 0, Math.PI * 2); x.stroke();
    }
    // --- flower pots ---
    [12, 15, 22].forEach(tx => {
      const px = tx * TS, py = 32;
      x.beginPath(); x.moveTo(px + 4.6, py + 8.5); x.lineTo(px + 11.4, py + 8.5); x.lineTo(px + 10.4, py + 14.6); x.lineTo(px + 5.6, py + 14.6); x.closePath();
      x.fillStyle = lin(x, px + 4, 0, px + 12, 0, ['#e48a58', '#c0603a', '#8e3e22']); x.fill(); x.strokeStyle = INK; x.lineWidth = 0.6; x.stroke();
      ell(x, px + 8.5, py + 4.6, 5, 3.6, rad(x, px + 8.5, py + 4.6, 5, ['#86c25a', '#4f8a2e', '#2f5e1c']), INK, 0.6);
      rr(x, px + 4, py + 7.6, 9, 2, 1); x.fillStyle = lin(x, 0, py + 7.6, 0, py + 9.6, ['#f0a070', '#b8582f']); x.fill(); x.strokeStyle = INK; x.lineWidth = 0.5; x.stroke();
      [[6.4, 3.6], [10.6, 2.8], [8.6, 5.6]].forEach(([fx, fy], i) => { ell(x, px + fx, py + fy, 1.2, 1.1, i === 2 ? '#ff7a9a' : '#e8324a', 'rgba(90,10,20,0.6)', 0.3); ell(x, px + fx, py + fy, 0.4, 0.4, '#ffd400'); });
    });
    // --- trees ---
    A.find('T').forEach(([tx, ty]) => {
      const bx = tx * TS, by = ty * TS;
      rr(x, bx + 6.6, by + 8, 3.6, 7.4, 1.2); x.fillStyle = lin(x, bx + 6.6, 0, bx + 10.2, 0, ['#8a5e36', '#4e331d']); x.fill(); x.strokeStyle = INK; x.lineWidth = 0.5; x.stroke();
      ell(x, bx + 8.4, by + 5.4, 7.8, 7, rad(x, bx + 8.4, by + 5.4, 7.8, ['#9ad874', '#4ea045', '#2a6a30']), 'rgba(20,40,20,0.8)', 0.7);
      ell(x, bx + 5.6, by + 3, 2.8, 2.2, 'rgba(255,255,255,0.18)');
      ell(x, bx + 11.2, by + 8, 3.3, 2.6, 'rgba(30,70,30,0.35)');
    });
    // --- chicken coop: plank front, wire panels, dark doorway, corrugated roof ---
    rr(x, 416.5, 139, 63, 21, 2); x.fillStyle = lin(x, 416, 139, 440, 160, ['#b07c46', '#8a5a30', '#5e3c1e']); x.fill(); x.strokeStyle = INK; x.lineWidth = 0.7; x.stroke();
    [[419.5, 443], [453, 476.5]].forEach(([a, b]) => {
      x.save(); rr(x, a, 144.5, b - a, 12.5, 1); x.fillStyle = 'rgba(30,20,14,0.7)'; x.fill(); x.clip();
      x.strokeStyle = 'rgba(225,225,215,0.55)'; x.lineWidth = 0.35; x.beginPath();
      for (let d = -14; d < b - a + 14; d += 2.6) { x.moveTo(a + d, 144.5); x.lineTo(a + d + 12.5, 157); x.moveTo(a + d + 12.5, 144.5); x.lineTo(a + d, 157); }
      x.stroke(); x.restore();
      rr(x, a, 144.5, b - a, 12.5, 1); x.strokeStyle = '#4e301a'; x.lineWidth = 0.6; x.stroke();
    });
    x.beginPath(); if (x.roundRect) x.roundRect(444, 145, 8, 15, [3.5, 3.5, 0, 0]); else x.rect(444, 145, 8, 15);
    x.fillStyle = lin(x, 0, 145, 0, 160, ['#140c08', '#3a2616']); x.fill(); x.strokeStyle = INK; x.lineWidth = 0.6; x.stroke();
    x.save(); rr(x, 414, 127, 68, 15, 2); x.fillStyle = lin(x, 414, 127, 450, 142, ['#d2d6dc', '#9aa0a8', '#6a7078']); x.fill(); x.clip();
    for (let i = 415.5; i < 482; i += 3) { x.fillStyle = 'rgba(255,255,255,0.28)'; x.fillRect(i, 127, 0.8, 15); x.fillStyle = 'rgba(20,20,30,0.2)'; x.fillRect(i + 1.4, 127, 0.8, 15); }
    x.restore();
    rr(x, 414, 139.5, 68, 3, 1.5); x.fillStyle = '#585e66'; x.fill();
    rr(x, 414, 127, 68, 15.5, 2); x.strokeStyle = INK; x.lineWidth = 0.8; x.stroke();
    x.strokeStyle = '#e6c86a'; x.lineWidth = 0.5; x.beginPath(); for (let i = 0; i < 5; i++) { x.moveTo(443 + i * 2.2, 161.5); x.lineTo(444.5 + i * 2.2, 160.2 + (i % 2)); } x.stroke();
  }
  // collision slightly smaller than the visuals for small props. Yard px; outside the yard = the field margin
  // (only its trees are solid), outside the region = solid (keeps the quest inside its region).
  function solidTile(px, py) {
    if (px < 0 || py < 0 || px >= YW || py >= YH) {
      const lx = px + OX, ly = py + OY;
      if (lx < 0 || ly < 0 || lx >= RW || ly >= RH) return true;
      const i = Math.floor(lx / TS), j = Math.floor(ly / TS), fx = lx - i * TS, fy = ly - j * TS;
      return MTSET.has(i + ',' + j) && fx >= 3 && fx <= 13 && fy <= 14;
    }
    const ch = A.get(Math.floor(px / TS), Math.floor(py / TS));
    const lx = ((px % TS) + TS) % TS, ly = ((py % TS) + TS) % TS;
    if (ch === 'o') return lx >= 4 && lx <= 12 && ly >= 3;
    if (ch === 'T') return lx >= 3 && lx <= 13 && ly <= 14;
    if (ch === 'F') return ly >= 7;
    return A.solidAt(px, py);
  }

  // car (old village pickup) — size read from G.VEH
  const CAR = { type: 'pickup', col: '#e2ddd0', x: 192, y: 200 };
  const carHalf = () => { const d = G.VEH[CAR.type]; return [d.h / 2 - 2, d.w / 2 - 2]; }; // angle 0: length along x
  const inCar = (px, py) => { const [hx, hy] = carHalf(); return Math.abs(px - CAR.x) < hx && Math.abs(py - CAR.y) < hy; };
  const solidPeople = (px, py) => solidTile(px, py) || inCar(px, py);
  const solidSnake = (px, py) => solidTile(px, py) || py > 250 || py < 36;

  const SPOTS = [
    { k: 'grass', x: 64, y: 84, line: ['seraios_grass', 'Μπήκε στα χόρτα!'] },
    { k: 'car', x: CAR.x, y: CAR.y, line: ['seraios_car', 'Κάτω απ\' τ\' αμάξι! Μη μου το γρατζουνίσεις!'] },
    { k: 'coop', x: 448, y: 168, line: ['seraios_coop', 'Στο κοτέτσι! Οι κότες μου, ρε!'] },
    { k: 'grass', x: 368, y: 216, line: ['seraios_grass2', 'Στα χόρτα πάλι! Δεν τα κούρεψα φέτος...'] },
  ];
  const tailPos = sp => sp.k === 'car' ? [CAR.x + carHalf()[0] + 5, CAR.y + 4] : sp.k === 'coop' ? [sp.x + 6, sp.y - 2] : [sp.x + 12, sp.y + 6];
  const catPos = sp => sp.k === 'car' ? [CAR.x + carHalf()[0] + 14, CAR.y + 14] : sp.k === 'coop' ? [sp.x - 20, sp.y + 8] : [sp.x - 22, sp.y + 4];

  // ---------- the yard as a region of the open world ----------
  A = buildArena();
  const HENS0 = [[420, 190], [438, 204], [456, 190]];
  // margin trees, drawn like the world's trees (y-sorted); ox,oy = screen px of region-local (0,0)
  function marginTrees(push, ox, oy) {
    for (const [i, j] of MTREES) {
      const sx = ox + i * TS, sy = oy + j * TS;
      if (sx < -24 || sx > G.W + 24 || sy < -24 || sy > G.H + 24) continue;
      push(j * TS + 15, ctx => { const ps = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = true; ctx.drawImage(Wd.treeSprite(), sx - 2, sy - 8, 20, 24); ctx.imageSmoothingEnabled = ps; });
    }
  }
  G.region({
    id: 'seraios', tx: RSP.tx, ty: RSP.ty, w: RWt, h: RHt, entry: ENTRY,
    miniDraw(x) {
      for (let j = 0; j < RHt; j++) for (let i = 0; i < RWt; i++) {
        const c = onPath(i, j) && j <= 1 ? 'p' : fieldType(RSP.tx + i, RSP.ty + j);
        x.fillStyle = c === 'p' ? '#f0e2b8' : c === 'Y' ? '#e2c25a' : c === 'L' ? '#9a6c44' : c === 'T' ? '#2a6a30' : '#78c850'; x.fillRect(i, j, 1, 1);
      }
      x.fillStyle = '#c8a46e'; x.fillRect(1, 2, 32, 17);
      x.fillStyle = '#b9593a'; x.fillRect(1, 2, 17, 2); x.fillRect(22, 2, 11, 2);
      x.fillStyle = '#8a847a'; x.fillRect(1, 4, 1, 14); x.fillRect(32, 4, 1, 14); x.fillRect(1, 18, 14, 1); x.fillRect(19, 18, 14, 1); x.fillRect(18, 2, 1, 2); x.fillRect(21, 2, 1, 2);
    },
    paint(ctx) {
      const bg = regionBG(), ps = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = true; ctx.drawImage(bg, 0, 0, bg.lw, bg.lh); ctx.imageSmoothingEnabled = ps;
    },
    solid: (lx, ly) => solidPeople(lx - OX, ly - OY),
    // the snake hides in the grass before you get there: its tail wiggles
    live(ctx, ox, oy) {
      if (G.state && G.state.done && G.state.done.seraios) return;
      const sp = SPOTS[0], [tx, ty] = tailPos(sp), bx = ox + OX, by = oy + OY;
      for (let i = 2; i >= 0; i--) {
        const x = bx + tx + i * 3 + 1.5, y = by + ty + Math.sin(G.t * 8 + i) * 1.5 + 1.5, r = (3 - i) * 0.6 + 0.4;
        ell(ctx, x, y, r, r, rad(ctx, x, y, r, i === 1 ? ['#f0dc78', '#d6c255', '#a89530'] : ['#86a848', '#5f7f2a', '#3e5a1a']), INK, 0.5);
      }
    },
    // standing things: the pickup, the axe man and his cat waiting by the gate, the hens, the field trees
    statics(push, ox, oy) {
      const bx = ox + OX, by = oy + OY;
      marginTrees(push, ox, oy);
      push(OY + CAR.y + carHalf()[1] + 2, ctx => G.drawVehicle(ctx, CAR.type, CAR.col, bx + CAR.x, by + CAR.y, 0));
      push(OY + AXE0[1], ctx => G.drawPerson(ctx, G.LOOKS.seraios, bx + AXE0[0], by + AXE0[1], 0, 0));
      push(OY + CAT0[1], ctx => { ell(ctx, bx + CAT0[0] + 1, by + CAT0[1] - 0.3, 5.2, 1.7, SHADOW); drawCat(ctx, bx + CAT0[0], by + CAT0[1], 2, true); });
      HENS0.forEach(([hx, hy], k) => push(OY + hy, ctx => {
        const t = G.t + k * 1.7, wob = Math.sin(t * 0.9) * 3, f = Math.floor(t * 3) % 2;
        ell(ctx, bx + hx + wob + 1, by + hy - 0.2, 3.6, 1.3, SHADOW); drawHen(ctx, bx + hx + wob, by + hy, f, Math.cos(t * 0.9) < 0);
      }));
    },
  });

  let st = null, M = null;

  // ---------- snake helpers ----------
  function resetPath(Sn, x, y) { Sn.x = x; Sn.y = y; Sn.path = []; for (let i = 0; i <= NSEG * SP; i++) Sn.path.push({ x, y }); }
  function recordPath(Sn) {
    const p0 = Sn.path[0];
    if (G.dist(p0.x, p0.y, Sn.x, Sn.y) >= 1) { Sn.path.unshift({ x: Sn.x, y: Sn.y }); if (Sn.path.length > NSEG * SP + 1) Sn.path.length = NSEG * SP + 1; }
  }
  function segs(Sn) {
    const out = [{ x: Sn.x, y: Sn.y }];
    for (let i = 1; i < NSEG; i++) out.push(Sn.path[Math.min(i * SP, Sn.path.length - 1)]);
    return out;
  }
  function steer(Sn, tx, ty, speed, dt, wig) {
    const want = Math.atan2(ty - Sn.y, tx - Sn.x);
    Sn.a += G.clamp(G.angleDiff(Sn.a, want), -6 * dt, 6 * dt);
    const a = Sn.a + Math.sin(st.t * 9) * wig;
    const nx = Sn.x + Math.cos(a) * speed * dt, ny = Sn.y + Math.sin(a) * speed * dt;
    if (!solidSnake(nx, ny)) { Sn.x = nx; Sn.y = ny; } else Sn.a += 1.3;
    recordPath(Sn);
  }
  const snakeVisible = () => ['out', 'rear', 'flee'].includes(st.snake.state);
  const snakeHittable = () => ['out', 'rear'].includes(st.snake.state);
  function pickSpot(not) {
    const P = st.pl;
    const opts = SPOTS.filter(s => s !== not).sort((a, b) => G.dist(b.x, b.y, P.x, P.y) - G.dist(a.x, a.y, P.x, P.y));
    return G.chance(0.6) ? opts[0] : G.pick(opts);
  }
  function hideAt(sp) {
    const Sn = st.snake; Sn.state = 'hidden'; Sn.spot = sp; Sn.hideT = G.rand(3.5, 5); Sn.lift = 0;
    // the cat "knows" where it is... most of the time
    st.cat.hint = G.chance(0.7) ? sp : G.pick(SPOTS.filter(s => s !== sp)); st.cat.announced = false;
    if (sp.k === 'coop') { st.hens.forEach(h => { h.panic = 2; }); G.audio.sfx('blip'); }
    if (st.lineCd <= 0) { M.say(sp.line[0], sp.line[1], st.axe, 2.4); st.lineCd = 3; }
    st.hintT = st.firstHide ? 0 : 5; st.firstHide = true;
  }
  function emerge(flushed) {
    const Sn = st.snake, sp = Sn.spot, P = st.pl;
    resetPath(Sn, sp.k === 'car' ? CAR.x : sp.x, sp.y);
    Sn.state = 'out'; Sn.outT = G.rand(6, 8); Sn.burst = 0.6; Sn.modeT = 1.2; Sn.roam = null; Sn.a = Math.atan2(P.y - Sn.y, P.x - Sn.x);
    G.audio.sfx('hiss');
    if (!st.fought) { st.fought = true; sayV('seraios_nekro', 'Μόνο ένα νεκρό φίδι είναι καλό φίδι.', 9, true); }
    else if (flushed) { if (!(G.chance(0.5) && sayV('seraios_nekro', 'Μόνο ένα νεκρό φίδι είναι καλό φίδι.', 12)) && st.lineCd <= 0) { M.say('seraios_flush', 'Βγήκε! Βγήκε!', st.axe, 1.8); st.lineCd = 2.5; } }
    else sayV('seraios_ssss', 'Χχσσσσσσ!', 8);
    if (sp.k === 'grass') puff(Sn.x, Sn.y, '#9fc04e', 8);
  }
  // the axe man's fight lines: own cooldown per line; `force` skips the shared line cooldown
  function sayV(key, text, cd, force) {
    if ((!force && st.lineCd > 0) || st.vCd[key] > 0) return false;
    M.say(key, text, st.axe, 2.2); st.vCd[key] = cd; st.lineCd = 2.5; return true;
  }
  function puff(x, y, col, n, spd = 40) {
    for (let i = 0; i < n; i++) { const a = G.rand(0, 7); st.parts.push({ x, y, vx: Math.cos(a) * G.rand(10, spd), vy: Math.sin(a) * G.rand(10, spd) - 10, t: G.rand(0.4, 0.8), col }); }
  }
  function snakeHit() {
    const Sn = st.snake;
    Sn.hp--; Sn.flash = 0.35; G.audio.sfx('hit'); G.ui.shake(2); puff(Sn.x, Sn.y, '#e8d4a8', 8);
    if (Sn.hp <= 0) {
      Sn.state = 'ko'; Sn.lift = 0; st.done = 2.2; G.audio.sfx('cheer');
      M.say('seraios_win', 'Τέλος! Πάμε για τσίπουρα!', st.axe, 3);
      G.ui.bubble('Νιάου!', st.cat, 2); G.audio.sfx('meow');
      return;
    }
    if (st.lineCd <= 0) { M.say('seraios_hit', 'Μπράβο! Άλλη μία!', st.axe, 1.8); st.lineCd = 2; }
    Sn.state = 'flee'; Sn.target = pickSpot(Sn.spot); Sn.fleeT = 4;
  }
  function catHit() {
    const C = st.cat; C.jump = 0.45; C.run = 0.9; const a = G.rand(0, 7); C.rx = Math.cos(a); C.ry = Math.sin(a);
    G.audio.sfx('meow'); G.ui.bubble('ΜΙΑΟΥ!', C, 1.4);
    if (st.catLineCd <= 0) { M.say('seraios_cat', 'Άσε τη γάτα, αυτή βοηθάει!', st.axe, 2.2); st.catLineCd = 8; st.lineCd = 2; }
  }
  function bite() {
    const P = st.pl;
    st.bites++; P.stun = 1; P.inv = 1.8; G.audio.sfx('bad'); G.ui.shake(3);
    if (st.bites >= 3) { M.lose('Τρεις δαγκωνιές. Ο γιατρός του χωριού σε περιμένει (Τρίτη και Πέμπτη).'); return; }
    if (st.lineCd <= 0) { M.say('seraios_bite', 'Σε τσίμπησε; Φτου φτου, δεν είναι τίποτα!', st.axe, 2.4); st.lineCd = 3; }
  }
  function chopImpact() {
    const X = st.axe, P = st.pl, Sn = st.snake, fa = FA[X.dir];
    const cx = X.x + Math.cos(fa) * 14, cy = X.y - 2 + Math.sin(fa) * 14;
    G.audio.sfx('hit'); G.ui.shake(1.5); puff(cx, cy, '#e8d4a8', 7);
    st.cracks.push({ x: cx, y: cy, v: G.randi(0, 2) }); if (st.cracks.length > 14) st.cracks.shift();
    const dp = G.dist(P.x, P.y, cx, cy);
    if (dp < 16) { // near miss
      const a = Math.atan2(P.y - cy, P.x - cx); P.kb = 0.22; P.kbx = Math.cos(a) * 90; P.kby = Math.sin(a) * 90;
      G.audio.sfx('whoosh');
      if (st.oopsCd <= 0) { const o = G.chance(0.5); M.say(o ? 'seraios_oops1' : 'seraios_oops2', o ? 'Ουπς! Συγγνώμη, φίλε!' : 'Κάνε στην άκρη, κόβει!', X, 2); st.oopsCd = 5; st.lineCd = 2; }
    }
    if (snakeVisible() && G.dist(Sn.x, Sn.y, cx, cy) < 18) { Sn.a += Math.PI; Sn.burst = 0.5; G.audio.sfx('hiss'); sayV('seraios_ssss', 'Χχσσσσσσ!', 8); }
    if (G.dist(st.cat.x, st.cat.y, cx, cy) < 14 && st.cat.jump <= 0) { st.cat.jump = 0.45; G.ui.bubble('ΜΙΑΟΥ!', st.cat, 1.2); G.audio.sfx('meow'); }
  }
  function moveCat(C, tx, ty, speed, dt) {
    const dx = tx - C.x, dy = ty - C.y, d = Math.hypot(dx, dy);
    if (d < 2) { C.moving = false; return true; }
    const vx = dx / d * speed * dt, vy = dy / d * speed * dt;
    if (!solidPeople(C.x + vx, C.y)) C.x += vx; if (!solidPeople(C.x, C.y + vy)) C.y += vy;
    C.flip = dx < 0; C.moving = true; C.anim += dt * speed / 6;
    return false;
  }

  const def = G.quest({
    id: 'seraios', title: 'Το φίδι στις Σέρρες', short: 'Σέρρες', col: '#ffd400', reward: 300,
    start: () => G.push(def.make()),
    make: () => G.MiniGame({
      id: 'seraios', title: 'ΤΟ ΦΙΔΙ ΣΤΙΣ ΣΕΡΡΕΣ', reward: 300,
      intro: {
        pc: 'Ένα τεράστιο φίδι κρύβεται στην αυλή: στα χόρτα, κάτω από το αμάξι, στο κοτέτσι.\nWASD για να κινηθείς, SPACE για σκούπα. Χτύπα και τις κρυψώνες για να το βγάλεις.\nΤρεις δαγκωνιές και τέλος. Πρόσεχε και το τσεκούρι του οικοδεσπότη. Η γάτα κάτι ξέρει...',
        mobile: 'Ένα τεράστιο φίδι κρύβεται στην αυλή: στα χόρτα, κάτω από το αμάξι, στο κοτέτσι.\nJoystick για να κινηθείς, ΣΚΟΥΠΑ για χτύπημα. Χτύπα και τις κρυψώνες για να το βγάλεις.\nΤρεις δαγκωνιές και τέλος. Πρόσεχε και το τσεκούρι του οικοδεσπότη. Η γάτα κάτι ξέρει...',
      },
      buttons: [{ id: 'action', label: 'ΣΚΟΥΠΑ' }], stick: 'stick',
      // back on the map where the quest ended (if that spot is walkable there), else on the gate path
      exitTo() {
        const P = st && st.pl;
        if (P) { const wx = P.x + ORX(), wy = P.y + ORY(); if (!Wd.solidAt(wx, wy) && !Wd.solidAt(wx - 3, wy - 2) && !Wd.solidAt(wx + 3, wy - 2)) return [wx, wy]; }
        return [(RSP.tx + ENTRY[0]) * TS + 8, (RSP.ty + ENTRY[1]) * TS + 10];
      },
      init() {
        M = this;
        if (st) { st.axe.dead = true; st.cat.dead = true; }
        A = A || buildArena();
        // the player starts where they stood on the map (the gate path), the camera exactly where the map's was
        let sx = (ENTRY[0] * TS + 8) - OX, sy = (ENTRY[1] * TS + 10) - OY;
        const gp = G.player;
        if (gp) {
          const px = G.clamp(gp.x - ORX(), -OX + 6, RW - OX - 6), py = G.clamp(gp.y - ORY(), -OY + 6, RH - OY - 4);
          const bad = (x, y) => solidPeople(x - 3, y - 2) || solidPeople(x + 3, y - 2) || solidPeople(x - 3, y + 1) || solidPeople(x + 3, y + 1);
          if (!bad(px, py)) { sx = px; sy = py; }
        }
        const pl = new G.Ent.Person(noId(Object.assign({}, G.state.look, { held: 'broom' })), sx, sy);
        pl.solidFn = solidPeople; pl.dir = 0; pl.stun = 0; pl.inv = 0; pl.swing = 0; pl.cd = 0; pl.kb = 0; pl.kbx = 0; pl.kby = 0;
        const axe = new G.Ent.Person(G.LOOKS.seraios, AXE0[0], AXE0[1]);
        axe.solidFn = solidPeople; axe.dir = 0; axe.wind = 0; axe.chop = 0; axe.cd = 1.5; axe.goal = null; axe.goalT = 0;
        st = {
          t: 0, pl, axe, lineCd: 0, oopsCd: 0, catLineCd: 0, bites: 0, done: 0, ended: false, hintT: 0, firstHide: false,
          fought: false, vCd: { seraios_nekro: 0, seraios_ssss: 0, seraios_katse: 0 },
          lookBroom: pl.look, lookEmpty: noId(Object.assign({}, G.state.look, { held: null })), lookAxeEmpty: noId(Object.assign({}, G.LOOKS.seraios, { held: null })),
          cat: { kind: 'cat', x: CAT0[0], y: CAT0[1], flip: true, anim: 0, moving: false, jump: 0, run: 0, rx: 0, ry: 0, hint: null, announced: false },
          hens: HENS0.map(([x, y]) => ({ x, y, vx: 0, vy: 0, t: G.rand(0, 2), panic: 0, flip: false })),
          snake: { state: 'hidden', hp: SNAKE_HP, a: 0, lift: 0, flash: 0, burst: 0, biteCd: 0, outT: 0, hideT: 0, rearT: 0, spot: SPOTS[0], path: [] },
          parts: [], cracks: [], cam: { x: 0, y: 0 },
        };
        resetPath(st.snake, SPOTS[0].x, SPOTS[0].y);
        st.snake.hideT = 4; st.cat.hint = SPOTS[0];
        st.cam.x = (WS.camX || 0) - ORX(); st.cam.y = (WS.camY || 0) - ORY();
        if (!gp) camTo(st.cam, pl.x, pl.y, 1);
      },
      onStart() {
        G.audio.music('music_seraios', 112);
        this.say('seraios_start', 'Εκεί είναι! Στα χόρτα! Φέρε τη σκούπα!', st.axe, 3);
        st.lineCd = 3;
      },
      exit() { if (st) { st.axe.dead = true; st.cat.dead = true; } },
      update(dt) {
        const s = st, P = s.pl, Sn = s.snake, X = s.axe, C = s.cat;
        s.t += dt; s.lineCd -= dt; s.oopsCd -= dt; s.catLineCd -= dt; s.hintT -= dt;
        for (const k in s.vCd) s.vCd[k] -= dt;

        // particles
        for (const p of s.parts) { p.t -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy = p.vy * 0.92 + 30 * dt; }
        s.parts = s.parts.filter(p => p.t > 0);

        // ---- player ----
        P.stun = Math.max(0, P.stun - dt); P.inv -= dt; P.cd -= dt;
        let vx = 0, vy = 0;
        if (P.stun <= 0 && !s.done) { const ax = G.readAxis(); vx = ax.x * 64; vy = ax.y * 64; }
        if (G.dist(P.x, P.y, C.x, C.y) < 8 && C.jump <= 0) { vx *= 0.5; vy *= 0.5; } // cat underfoot
        if (P.kb > 0) { P.kb -= dt; vx += P.kbx; vy += P.kby; }
        const keepDir = P.dir;
        P.move(vx, vy, dt);
        if (P.swing > 0) {
          P.dir = keepDir; P.swing -= dt;
          if (!P.hitDone && P.swing < 0.17) {
            P.hitDone = true;
            const fa = FA[P.dir], hx = P.x + Math.cos(fa) * 11, hy = P.y - 2 + Math.sin(fa) * 11;
            puff(hx, hy, '#e8d4a8', 4, 25);
            let sd = 1e9;
            if (snakeHittable() && Sn.flash <= 0) segs(Sn).slice(0, 9).forEach(g => { sd = Math.min(sd, G.dist(g.x, g.y, hx, hy)); });
            const cd = G.dist(C.x, C.y, hx, hy);
            if (cd < 9 && cd < sd && C.jump <= 0) catHit();
            else if (sd < 11) snakeHit();
            else if (Sn.state === 'hidden' && G.dist(Sn.spot.x, Sn.spot.y, hx, hy) < 24) emerge(true);
            else if (Sn.state === 'hidden') { // wrong spot: rustle / startle hens
              SPOTS.forEach(sp => { if (G.dist(sp.x, sp.y, hx, hy) < 24 && sp.k === 'grass') puff(hx, hy, '#9fc04e', 5); });
            }
            s.hens.forEach(h => { if (G.dist(h.x, h.y, hx, hy) < 14) { h.panic = 1.5; puff(h.x, h.y - 3, '#ffffff', 4); G.audio.sfx('blip'); } });
          }
        }
        if (P.stun <= 0 && P.cd <= 0 && P.swing <= 0 && !s.done && G.pressed('action')) {
          if (snakeVisible()) { let best = null, bd = 30; segs(Sn).slice(0, 9).forEach(g => { const d = G.dist(g.x, g.y, P.x, P.y); if (d < bd) { bd = d; best = g; } }); if (best) P.dir = dirFrom(best.x - P.x, best.y - P.y); }
          P.swing = 0.25; P.cd = 0.55; P.hitDone = false; G.audio.sfx('whoosh');
        }

        // ---- snake ----
        Sn.flash -= dt; Sn.biteCd -= dt; Sn.burst -= dt;
        if (Sn.state === 'hidden') {
          Sn.hideT -= dt;
          if (Sn.hideT <= 0) emerge(false);
          if (Sn.spot.k === 'coop' && Math.random() < dt * 3) puff(Sn.spot.x + G.rand(-12, 12), Sn.spot.y - 10, '#ffffff', 1, 20);
        } else if (Sn.state === 'out') {
          Sn.outT -= dt;
          const d = G.dist(Sn.x, Sn.y, P.x, P.y);
          if (d < 18 && Sn.biteCd <= 0 && P.inv <= 0 && !s.done) { Sn.state = 'rear'; Sn.rearT = 0.65; G.audio.sfx('hiss'); sayV('seraios_katse', 'Sound, κάτσε καλά να πούμε!', 7, true); }
          else if (Sn.outT <= 0) { Sn.state = 'flee'; Sn.target = pickSpot(Sn.spot); Sn.fleeT = 4; }
          else if (Sn.roam) { steer(Sn, Sn.roam[0], Sn.roam[1], 50, dt, 0.6); Sn.modeT -= dt; if (Sn.modeT <= 0 || G.dist(Sn.x, Sn.y, Sn.roam[0], Sn.roam[1]) < 8) { Sn.roam = null; Sn.modeT = G.rand(1.2, 2.2); } }
          else if (d > 12) { steer(Sn, P.x, P.y, Sn.burst > 0 ? 70 : 36, dt, 0.6); Sn.modeT -= dt; if (Sn.modeT <= 0) { Sn.roam = [G.rand(40, 470), G.rand(60, 240)]; Sn.modeT = G.rand(1.2, 2); } }
          else steer(Sn, P.x + Math.cos(s.t) * 30, P.y + Math.sin(s.t) * 30, 30, dt, 0.5);
        } else if (Sn.state === 'rear') {
          Sn.rearT -= dt; Sn.lift = Math.min(5, Sn.lift + dt * 30);
          Sn.a += G.clamp(G.angleDiff(Sn.a, Math.atan2(P.y - Sn.y, P.x - Sn.x)), -4 * dt, 4 * dt);
          if (Sn.rearT <= 0) {
            const a = Math.atan2(P.y - Sn.y, P.x - Sn.x);
            for (let k = 0; k < 6; k++) { const nx = Sn.x + Math.cos(a), ny = Sn.y + Math.sin(a); if (!solidSnake(nx, ny)) { Sn.x = nx; Sn.y = ny; } }
            recordPath(Sn);
            if (G.dist(Sn.x, Sn.y, P.x, P.y) < 13 && P.inv <= 0) bite();
            Sn.state = 'out'; Sn.biteCd = 3; Sn.lift = 0;
          }
        } else if (Sn.state === 'flee') {
          Sn.fleeT -= dt;
          const tg = Sn.target;
          steer(Sn, tg.x, tg.y, 85, dt, 0.35);
          if (G.dist(Sn.x, Sn.y, tg.x, tg.y) < 8 || Sn.fleeT <= 0) hideAt(tg);
        }
        if (Sn.state !== 'rear') Sn.lift = Math.max(0, Sn.lift - dt * 30);

        // ---- axe man ----
        X.cd -= dt;
        if (X.wind > 0) { X.wind -= dt; X.move(0, 0, dt); if (X.wind <= 0) X.chop = 0.14; }
        else if (X.chop > 0) { X.chop -= dt; X.move(0, 0, dt); if (X.chop <= 0) chopImpact(); }
        else if (!s.done) {
          let tx, ty;
          if (snakeVisible()) { tx = Sn.x; ty = Sn.y; }
          else {
            X.goalT -= dt;
            if (!X.goal || X.goalT <= 0) { const sp = G.pick(SPOTS); X.goal = catPos(sp); X.goal = [X.goal[0] + G.rand(-10, 10), X.goal[1] + 6]; X.goalT = G.rand(2.5, 4); }
            tx = X.goal[0]; ty = X.goal[1];
          }
          const dx = tx - X.x, dy = ty - X.y, d = Math.hypot(dx, dy);
          if (d > 22) { if (!X.move(dx / d * 46, dy / d * 46, dt)) X.move(-dy / d * 46, dx / d * 46, dt); }
          else { X.move(0, 0, dt); X.dir = dirFrom(dx, dy); }
          if (snakeVisible() && d < 36 && X.cd <= 0) {
            X.wind = 0.5; X.cd = G.rand(1.7, 2.7); X.dir = dirFrom(dx, dy);
            if (s.lineCd <= 0 && G.chance(0.5)) { const k = G.randi(1, 3); M.say('seraios_swing' + k, ['Πάρε κι αυτό!', 'Έλα \'δω, σκουλήκι!', 'Χα! Σχεδόν!'][k - 1], X, 1.6); s.lineCd = 2.5; }
          }
        } else X.move(0, 0, dt);
        // keep player and axe man apart
        { const dx = P.x - X.x, dy = P.y - X.y, d = Math.hypot(dx, dy) || 1;
          if (d < 9) { const push = (9 - d) / 2; const ux = dx / d * push, uy = dy / d * push;
            if (!solidPeople(P.x + ux, P.y + uy)) { P.x += ux; P.y += uy; } if (!solidPeople(X.x - ux, X.y - uy)) { X.x -= ux; X.y -= uy; } } }

        // ---- cat ----
        C.jump = Math.max(0, C.jump - dt);
        if (C.run > 0) { C.run -= dt; moveCat(C, C.x + C.rx * 20, C.y + C.ry * 20, 80, dt); }
        else if (snakeVisible()) {
          const mx = (P.x + Sn.x) / 2 + Math.sin(s.t * 2) * 6, my = (P.y + Sn.y) / 2 + 4;
          moveCat(C, mx, my, 58, dt);
          if (!C.hissed && G.dist(C.x, C.y, Sn.x, Sn.y) < 20) { C.hissed = true; G.ui.bubble('Φσσσ!', C, 1.2); G.audio.sfx('hiss'); }
        } else if (Sn.state === 'hidden' && C.hint) {
          C.hissed = false;
          const [tx, ty] = catPos(C.hint);
          if (moveCat(C, tx, ty, 55, dt) && !C.announced) { C.announced = true; G.ui.bubble('Νιάου!', C, 1.6); G.audio.sfx('meow'); }
        } else moveCat(C, P.x - 14, P.y + 4, 50, dt);

        // ---- hens ----
        for (const h of s.hens) {
          h.t -= dt; h.panic -= dt;
          if (snakeVisible() && G.dist(h.x, h.y, Sn.x, Sn.y) < 36) h.panic = Math.max(h.panic, 0.6);
          if (h.t <= 0) { h.t = G.rand(0.8, 2); const a = G.rand(0, 7), v = G.chance(0.4) ? 0 : 14; h.vx = Math.cos(a) * v; h.vy = Math.sin(a) * v; }
          const k = h.panic > 0 ? 4 : 1;
          if (h.panic > 0 && Math.random() < dt * 4) { const a = G.rand(0, 7); h.vx = Math.cos(a) * 15; h.vy = Math.sin(a) * 15; }
          const nx = G.clamp(h.x + h.vx * k * dt, 380, 495), ny = G.clamp(h.y + h.vy * k * dt, 172, 250);
          if (!solidPeople(nx, ny)) { h.x = nx; h.y = ny; } else h.t = 0;
          if (h.vx) h.flip = h.vx < 0;
        }

        camTo(s.cam, P.x, P.y - 8, dt);

        if (s.done) { s.done -= dt; if (s.done <= 0 && !s.ended) { s.ended = true; this.win('Το φίδι νικήθηκε. Η γάτα παίρνει όλα τα εύσημα.'); } }
      },
      render(ctx) {
        const s = st; if (!s) return;
        const [shx, shy] = G.ui.shakeOffset();
        const cx = Math.round(s.cam.x + shx), cy = Math.round(s.cam.y + shy);
        s.camX = cx; s.camY = cy;
        // the ground is the open world itself (this yard is painted into it by the region's paint)
        const wcx = cx + ORX(), wcy = cy + ORY();
        ctx.fillStyle = '#2f7d3a'; ctx.fillRect(0, 0, G.W, G.H);
        Wd.drawGround(ctx, wcx, wcy);
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        // axe cracks: short dark gouges in the dirt
        for (const k of s.cracks) {
          const x = k.x - cx, y = k.y - cy;
          ctx.beginPath(); ctx.moveTo(x - 3.2, y + 0.2); ctx.quadraticCurveTo(x, y - 1 + k.v * 0.6, x + 3.2, y + 0.6);
          ctx.moveTo(x - 0.5, y - 0.2); ctx.lineTo(x - 1.6 + k.v, y - 2); ctx.moveTo(x + 1, y + 0.3); ctx.lineTo(x + 2.2 - k.v, y + 1.8);
          ctx.strokeStyle = 'rgba(255,240,210,0.35)'; ctx.lineWidth = 1.4; ctx.stroke();
          ctx.strokeStyle = 'rgba(95,62,35,0.85)'; ctx.lineWidth = 0.75; ctx.stroke();
        }
        const Sn = s.snake;
        // hidden snake tells: wiggling tail + rustle
        if (Sn.state === 'hidden') {
          const sp = Sn.spot, [tx, ty] = tailPos(sp);
          for (let i = 2; i >= 0; i--) {
            const x = tx + i * 3 - cx + 1.5, y = ty + Math.sin(s.t * 8 + i) * 1.5 - cy + 1.5, r = (3 - i) * 0.6 + 0.4;
            ell(ctx, x, y, r, r, rad(ctx, x, y, r, i === 1 ? ['#f0dc78', '#d6c255', '#a89530'] : ['#86a848', '#5f7f2a', '#3e5a1a']), INK, 0.5);
          }
          if (sp.k === 'grass') for (let k = 0; k < 6; k++) {
            const sw = Math.sin(s.t * 22 + k) * 1.5, x = sp.x + (k - 2.5) * 5 + 0.5 - cx, y = sp.y + (k % 2) * 4 - cy;
            ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + sw * 0.3, y - 2.5, x + sw, y - 4.6);
            ctx.strokeStyle = INK; ctx.lineWidth = 1.7; ctx.stroke(); ctx.strokeStyle = k % 2 ? '#b0d064' : '#5f8a30'; ctx.lineWidth = 0.9; ctx.stroke();
          }
        } else if (Sn.state !== 'hidden') drawSnake(ctx, Sn, cx, cy);

        const list = [];
        const P = s.pl, X = s.axe, C = s.cat;
        // trees around the yard: the world's own and the region's field-margin ones
        { const wl = []; Wd.visibleStatics(wcx, wcy, wl); for (const o of wl) list.push({ y: o.y - ORY(), draw: () => o.draw(ctx) }); }
        marginTrees((ly, fn) => list.push({ y: ly - OY, draw: () => fn(ctx) }), -cx - OX, -cy - OY);
        list.push({ y: CAR.y + carHalf()[1] + 2, draw: () => G.drawVehicle(ctx, CAR.type, CAR.col, CAR.x - cx, CAR.y - cy, 0) });
        list.push({ y: P.y, draw: () => {
          if (P.inv > 0 && Math.floor(s.t * 14) % 2) return;
          const px = P.x - cx, py = P.y - cy;
          if (P.swing > 0) {
            G.drawPerson(ctx, s.lookEmpty, px, py, P.dir, P.frame);
            const pr = 1 - P.swing / 0.25, fa = FA[P.dir];
            drawTool(ctx, px + (P.dir === 1 ? -4 : 4), py - 10, fa - 1.4 + 2.8 * pr, 13, 'broom');
          } else G.drawPerson(ctx, s.lookBroom, px, py, P.dir, P.frame);
          if (P.stun > 0) for (let i = 0; i < 3; i++) { const a = s.t * 6 + i * 2.1; star(ctx, px + Math.cos(a) * 6 + 1, py - 26 + Math.sin(a) * 2, 1.7); }
        } });
        list.push({ y: X.y, draw: () => {
          const px = X.x - cx, py = X.y - cy;
          if (X.wind > 0 || X.chop > 0) {
            G.drawPerson(ctx, s.lookAxeEmpty, px + (X.wind > 0 ? Math.round(Math.sin(s.t * 40)) : 0), py, X.dir, 0);
            const fa = FA[X.dir], up = -Math.PI / 2 + (X.dir === 1 ? -0.5 : 0.5);
            const ang = X.wind > 0 ? up : up + G.angleDiff(up, fa) * (1 - X.chop / 0.14);
            drawTool(ctx, px + (X.dir === 1 ? -4 : 4), py - 11, ang, 12, 'axe');
          } else G.drawPerson(ctx, X.look, px, py, X.dir, X.frame);
        } });
        list.push({ y: C.y, draw: () => {
          const lift = C.jump > 0 ? Math.sin(C.jump / 0.45 * Math.PI) * 8 : 0;
          ell(ctx, C.x - cx + 1, C.y - cy - 0.3, 5.2 - lift * 0.2, 1.7, SHADOW);
          const fr = !C.moving && C.jump <= 0 ? 2 : Math.floor(C.anim) % 2;
          drawCat(ctx, C.x - cx, C.y - cy - lift, fr, C.flip);
        } });
        for (const h of s.hens) list.push({ y: h.y, draw: () => {
          const hop = h.panic > 0 ? Math.abs(Math.sin(s.t * 18)) * 3 : 0;
          ell(ctx, h.x - cx + 1, h.y - cy - 0.2, 3.6 - hop * 0.3, 1.3, SHADOW);
          drawHen(ctx, h.x - cx, h.y - cy - hop, Math.floor(s.t * 6) % 2, h.flip);
        } });
        list.sort((a, b) => a.y - b.y);
        for (const o of list) o.draw();
        for (const p of s.parts) ell(ctx, p.x - cx + 1, p.y - cy + 1, 1.15, 1.15, p.col, 'rgba(28,20,36,0.35)', 0.3);
      },
      hud() {
        const s = st, U = G.ui, c = U.ctx;
        U.drawBubbles(s.camX || 0, s.camY || 0);
        U.text(8, 13, 'ΔΑΓΚΩΝΙΕΣ', 8, '#fff');
        for (let i = 0; i < 3; i++) U.rr(8 + i * 12, 17, 10, 10, 3, i < s.bites ? U.T.red : U.T.panel, U.T.line);
        U.text(G.W - 8, 13, 'ΦΙΔΙ', 8, '#9fdc4a', 'right');
        const w = 80, x = G.W - 8 - w;
        U.rr(x - 1, 16, w + 2, 9, 4.5, U.T.panel, U.T.line);
        const fw = w * Math.max(0, s.snake.hp) / SNAKE_HP;
        if (fw > 0) { const gb = c.createLinearGradient(0, 17, 0, 24); gb.addColorStop(0, '#9fdc4a'); gb.addColorStop(1, '#4f7f1f'); U.rr(x, 17, fw, 7, 3.5, gb); }
        if (s.hintT > 0 && s.snake.state === 'hidden') U.text(G.W / 2, 40, 'Κρύφτηκε! Ψάξε την ουρά. Η γάτα ίσως ξέρει.', 8, '#ffd400', 'center');
      },
    }),
  });

  function drawSnake(ctx, Sn, cx, cy) {
    const sg = segs(Sn), n = sg.length;
    const ko = Sn.state === 'ko', fl = Sn.flash > 0 && Math.floor(st.t * 24) % 2;
    const body = fl ? '#ffffff' : ko ? '#8c9a66' : '#5f8a2a', band = fl ? '#ffffff' : ko ? '#b8b48a' : '#d6c255';
    // body as a smooth tapered tube: shadow, ink outline, colour, top-left sheen
    const pts = sg.map((p, i) => ({ x: p.x - cx, y: p.y - cy, l: Sn.lift * Math.max(0, 1 - i / 4), w: i === 0 ? 5.6 : Math.max(2, 5 - (i / n) * 3.5) }));
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const tube = (col, extra, ox, oy, lifted, wk) => {
      ctx.strokeStyle = col;
      for (let i = n - 2; i >= 0; i--) {
        const a = pts[i + 1], b = pts[i];
        ctx.lineWidth = b.w * (wk || 1) + extra; ctx.beginPath();
        ctx.moveTo(a.x + ox, a.y + oy - (lifted ? a.l : 0)); ctx.lineTo(b.x + ox, b.y + oy - (lifted ? b.l : 0)); ctx.stroke();
      }
    };
    tube('rgba(20,10,30,0.22)', 0.4, 1.4, 2, false);
    tube(INK, 1.3, 0, 0, true);
    for (let i = n - 2; i >= 0; i--) {
      const a = pts[i + 1], b = pts[i];
      ctx.strokeStyle = (i + 1) % 4 === 2 ? band : body; ctx.lineWidth = b.w;
      ctx.beginPath(); ctx.moveTo(a.x, a.y - a.l); ctx.lineTo(b.x, b.y - b.l); ctx.stroke();
    }
    tube('rgba(20,40,10,0.28)', 0, 0.45, 0.55, true, 0.35);
    tube('rgba(255,255,230,0.32)', 0, -0.5, -0.6, true, 0.32);
    // head
    const hx = pts[0].x, hy = pts[0].y - pts[0].l;
    ctx.translate(hx, hy); ctx.rotate(Sn.a);
    ell(ctx, 0.6, 0, 4.3, 3.2, rad(ctx, 0.6, 0, 4.3, [sh(body, 0.3), body, sh(body, -0.3)]), INK, 0.7);
    for (const sy of [-1.7, 1.7]) {
      ell(ctx, 1.7, sy, 0.95, 0.75, ko ? INK : '#f7e14a', ko ? null : INK, 0.3);
      if (!ko) ell(ctx, 1.8, sy, 0.22, 0.6, '#111');
    }
    if (!ko && (Sn.state === 'rear' || Math.sin(st.t * 14) > 0.3)) {
      ctx.strokeStyle = '#e0303a'; ctx.lineWidth = 0.6; ctx.beginPath();
      ctx.moveTo(4.6, 0); ctx.lineTo(7, 0); ctx.lineTo(8, -1); ctx.moveTo(7, 0); ctx.lineTo(8, 1); ctx.stroke();
    }
    ctx.restore();
    if (Sn.state === 'rear') {
      rr(ctx, hx - 1.1, hy - 13.5, 2.4, 4.6, 1.1); ctx.fillStyle = '#ff3b30'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.5; ctx.stroke();
      ell(ctx, hx + 0.1, hy - 7.4, 1.2, 1.2, '#ff3b30', INK, 0.5);
    }
    if (ko) for (let i = 0; i < 3; i++) { const a = st.t * 5 + i * 2.1; star(ctx, hx + Math.cos(a) * 6 + 1, hy - 7 + Math.sin(a) * 2, 1.7); }
  }
})();
