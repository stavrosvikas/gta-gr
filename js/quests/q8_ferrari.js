// GTA LUBEN — quest: Η Ferrari και τα πρόβατα
// Side quest. Herd sheep into the truck (field A), drive the bumpy farm road, the inspector counts them in field B.
// Lives on the open-world map: a farm in Thessaly right below the εθνική (region G.World.SPOTS.ferrari, entry on the top edge).
'use strict';
(function () {
  const WS = G.worldScene, Wd = G.World;

  // ---------- constants (arena = region-local tiles, 30 x 32) ----------
  const SP = Wd.SPOTS.ferrari, TS = 16, AW = 30, AH = 32, NSHEEP = 8, PAY = 40;
  const LOAD_R = 34, BOARD_T1 = 0.35, BOARD_T2 = 0.85;          // sheep this close to the ramp walk up by themselves
  const OX = SP.tx * TS, OY = SP.ty * TS;                   // region origin in world px
  const ENTRY = [15, 0];                                     // local entry tile (top edge, under the dirt path from the εθνική)
  const GATE_X = 12, ROAD_Y0 = 10, ROAD_Y1 = 13;            // field A gate (east fence) / east road rows
  const RX0 = 23, RX1 = 26;                                  // road down to field B (columns) = gate B
  const BX0 = 17, BY0 = 20, BX1 = 28, BY1 = 30;             // field B fence (gate B on its top side)
  const STILE = [11, 5];                                     // step over field A's top fence (people pass, sheep don't)
  const FER0 = { x: 18.5 * TS, y: 3 * TS, a: 0.45 };
  G.FERRARI_PARK = { x: SP.tx * TS + FER0.x, y: SP.ty * TS + FER0.y, a: FER0.a }; // world spot of the one and only Ferrari
  const _f0 = 0, LADY0 = [13.5 * TS, 3.6 * TS], DOG0 = [14.5 * TS, 3.9 * TS];
  const TRUCK0 = () => ({ x: GATE_X * TS - VD('sheeptruck').h / 2 - 2, y: (ROAD_Y0 + ROAD_Y1 + 1) / 2 * TS });
  const BOOTH = [19 * TS, 22 * TS], INSP0 = [20.5 * TS, 24.6 * TS], SIGN = [15.5 * TS, 9.5 * TS];
  const PARK = [25.5 * TS, 27 * TS];                         // where the Ferrari ends up in field B (in the mud)
  // camera may look a bit past the region (the world around it is drawn too), more on top to show the εθνική
  const CMX = 96, CMT = 176, CMB = 64;
  const camClamp = cam => { cam.x = G.clamp(cam.x, -CMX, AW * TS + CMX - G.W); cam.y = G.clamp(cam.y, -CMT, AH * TS + CMB - G.H); };
  const NUMS = ['Ένα', 'Δύο', 'Τρία', 'Τέσσερα', 'Πέντε', 'Έξι', 'Επτά', 'Οκτώ', 'Εννιά', 'Δέκα'];
  const BAAS = ['Μπεεε!', 'Μπεεεεε', 'Μπε;', 'ΜΠΕΕΕ!'];
  const INSP_LOOK = { skin: '#e0b090', hair: '#6a6a66', hairStyle: 'balding', top: '#8a8f7a', topStyle: 'suit', top2: '#ffffff', legs: '#4a4a40', acc: ['glasses', 'mustache', 'tie:#7a2a2a'], held: 'phone' };
  const VD = t => G.VEH[t] || { w: 14, h: 28 };

  // ---------- animal sprites (sheep / goat / the lady's poodle), facing right, ~14x10 ----------
  // HD-2D: smooth vector shapes baked at G.RS*1.5, light from the top-left, thin dark outlines.
  const INK = 'rgba(28,20,36,0.85)', SHADOW = 'rgba(20,10,30,0.28)';
  const rr = (x, px, py, w, h, r) => { x.beginPath(); if (x.roundRect) x.roundRect(px, py, w, h, r); else x.rect(px, py, w, h); };
  const lin = (x, x0, y0, x1, y1, stops) => { const g = x.createLinearGradient(x0, y0, x1, y1); stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s)); return g; };
  const rad = (x, x0, y0, r0, x1, y1, r1, stops) => { const g = x.createRadialGradient(x0, y0, r0, x1, y1, r1); stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s)); return g; };
  const circ = (x, cx, cy, r) => { x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); };
  const ell = (x, cx, cy, rx, ry, a = 0) => { x.beginPath(); x.ellipse(cx, cy, rx, ry, a, 0, Math.PI * 2); };
  // union of circles with a clean dark outline (outline pass, then fill pass)
  function puffs(x, list, fill) {
    x.fillStyle = INK; for (const [cx, cy, r] of list) { circ(x, cx, cy, r + 0.55); x.fill(); }
    x.fillStyle = fill; for (const [cx, cy, r] of list) { circ(x, cx, cy, r); x.fill(); }
  }
  function legs(x, xs, y0, y1, col) {
    x.lineCap = 'round';
    for (const lx of xs) { x.strokeStyle = INK; x.lineWidth = 1.7; x.beginPath(); x.moveTo(lx, y0); x.lineTo(lx, y1); x.stroke(); x.strokeStyle = col; x.lineWidth = 0.9; x.beginPath(); x.moveTo(lx, y0); x.lineTo(lx, y1 - 0.2); x.stroke(); }
  }

  const sprCache = {};
  function animalSprite(kind, frame) {
    const key = kind + frame + '@' + G.RS; if (sprCache[key]) return sprCache[key];
    const [c, x] = G.hiCanvas(18, 13, Math.max(3, (G.RS || 2) * 1.5));
    x.lineJoin = 'round'; x.lineCap = 'round';
    if (kind === 'dog') { // white poodle with a pink bow (looks suspiciously like a lamb)
      const wool = rad(x, 6, 1.5, 0.5, 8, 5, 8, ['#ffffff', '#f3eee8', '#cfc6bc']);
      legs(x, frame ? [4.5, 6.6, 9.6, 10.8] : [4.5, 5.6, 9.6, 11.6], 7, 10.6, '#e6ded4');
      puffs(x, frame ? [[4.5, 11, 1.1], [6.6, 11, 1.1], [9.6, 11, 1.1], [10.8, 11, 1.1]] : [[4.5, 11, 1.1], [5.6, 11, 1.1], [9.6, 11, 1.1], [11.6, 11, 1.1]], '#f6f1ea');
      x.fillStyle = INK; rr(x, 3.2, 4.6, 7.6, 3.6, 1.8); x.fill();
      x.fillStyle = lin(x, 0, 4.6, 0, 8.2, ['#f4efe8', '#d4cbc0']); rr(x, 3.6, 5, 6.8, 2.8, 1.4); x.fill();
      puffs(x, [[3.6, 5.6, 2.3], [1.9, 2.8, 1.3], [9.4, 5.6, 2.2], [11.6, 3.3, 2.6], [10.2, 4.6, 1.5]], wool);
      x.fillStyle = 'rgba(255,255,255,0.75)'; circ(x, 2.9, 4.7, 0.9); x.fill(); circ(x, 10.7, 2.2, 1); x.fill();
      x.fillStyle = '#1a1418'; circ(x, 14, 3.7, 0.65); x.fill(); circ(x, 12.6, 2.9, 0.45); x.fill();
      x.strokeStyle = '#ff3e8a'; x.lineWidth = 0.8; x.beginPath(); x.moveTo(9, 6.6); x.quadraticCurveTo(10.3, 7.4, 11.5, 6.2); x.stroke();
      // bow
      x.fillStyle = lin(x, 10, 0, 13, 2, ['#ff9cc4', '#ff3e8a']); x.strokeStyle = INK; x.lineWidth = 0.45;
      x.beginPath(); x.moveTo(11.8, 1); x.lineTo(10.1, 0.1); x.lineTo(10.2, 1.9); x.closePath(); x.fill(); x.stroke();
      x.beginPath(); x.moveTo(11.8, 1); x.lineTo(13.5, 0.1); x.lineTo(13.4, 1.9); x.closePath(); x.fill(); x.stroke();
      x.fillStyle = '#d81f6c'; circ(x, 11.8, 1, 0.55); x.fill();
    } else if (kind === 'goat') {
      legs(x, frame ? [3, 5, 8.6, 10.6] : [3.8, 5.4, 8, 9.8], 7.5, 11.4, '#3a2a1e');
      // tail flick
      x.strokeStyle = INK; x.lineWidth = 1.6; x.beginPath(); x.moveTo(2.2, 5); x.quadraticCurveTo(0.8, 3.6, 1.2, 2.4); x.stroke();
      x.strokeStyle = '#8a6644'; x.lineWidth = 0.8; x.stroke();
      x.fillStyle = rad(x, 5, 3.6, 0.5, 7, 6, 7, ['#c9a274', '#9a7550', '#6a4c30']); x.strokeStyle = INK; x.lineWidth = 0.6;
      ell(x, 7, 6, 5.4, 3.1); x.fill(); x.stroke();
      x.fillStyle = 'rgba(255,240,210,0.28)'; ell(x, 5.6, 4.6, 2.6, 1); x.fill();
      // neck + head
      x.fillStyle = lin(x, 10, 2, 14, 8, ['#a07a52', '#6e5236']);
      x.beginPath(); x.moveTo(9.6, 4.2); x.quadraticCurveTo(11.2, 2.2, 12.8, 3.2); x.lineTo(14.9, 5.6); x.quadraticCurveTo(14.6, 7.3, 13, 6.9); x.lineTo(10.8, 7.6); x.closePath(); x.fill(); x.stroke();
      // horns
      x.strokeStyle = INK; x.lineWidth = 1.3; x.beginPath(); x.moveTo(12.4, 3); x.quadraticCurveTo(11.6, 0.8, 10, 0.9); x.stroke();
      x.strokeStyle = '#e6dcc0'; x.lineWidth = 0.6; x.stroke();
      // ear, eye, beard
      x.fillStyle = '#5a3e26'; ell(x, 11.4, 4.3, 1.4, 0.6, 0.5); x.fill();
      x.fillStyle = '#1a1210'; circ(x, 13.2, 4.3, 0.45); x.fill();
      x.fillStyle = '#ece4cc'; x.strokeStyle = INK; x.lineWidth = 0.4; x.beginPath(); x.moveTo(13.4, 6.8); x.lineTo(14.4, 6.6); x.lineTo(13.7, 8.8); x.closePath(); x.fill(); x.stroke();
    } else { // sheep: a fluffy cloud with a dark face
      legs(x, frame ? [3, 5, 8.6, 10.6] : [3.8, 5.4, 8, 9.8], 8, 11.4, '#2e2622');
      const wool = rad(x, 4.5, 2.2, 0.5, 6.5, 6, 8.5, ['#ffffff', '#f4f1e8', '#d8d2c2', '#b6ae9c']);
      puffs(x, [[3.2, 6.9, 2.6], [5.4, 4.3, 2.9], [8.4, 3.9, 2.9], [10.6, 5.6, 2.6], [4.8, 8, 2.5], [8.4, 8.1, 2.6], [6.6, 6.2, 3.2], [2, 5.4, 1.5]], wool);
      x.fillStyle = 'rgba(255,255,255,0.8)'; circ(x, 4.6, 3.3, 1.1); x.fill(); circ(x, 7.7, 2.9, 1); x.fill(); circ(x, 2.4, 6, 0.8); x.fill();
      x.fillStyle = 'rgba(120,110,90,0.18)'; circ(x, 9, 9, 1.8); x.fill();
      // head
      x.fillStyle = INK; ell(x, 13.3, 5.9, 2.75, 3.05); x.fill();
      x.fillStyle = rad(x, 12.6, 4.6, 0.3, 13.4, 6, 3, ['#6a5a52', '#3a302c', '#1e1816']); ell(x, 13.3, 5.9, 2.2, 2.5); x.fill();
      x.fillStyle = '#2a221e'; x.strokeStyle = INK; x.lineWidth = 0.4; ell(x, 11.6, 4.6, 1.6, 0.7, -0.4); x.fill(); x.stroke();
      puffs(x, [[12.8, 3.4, 1.3]], wool);
      x.fillStyle = '#fff'; circ(x, 14.3, 5.2, 0.55); x.fill(); x.fillStyle = '#111'; circ(x, 14.45, 5.25, 0.28); x.fill();
    }
    sprCache[key] = c; return c;
  }
  function drawAnimal(ctx, kind, x, y, faceL, frame, alpha) {
    const s = animalSprite(kind, frame);
    ctx.save(); if (alpha != null) ctx.globalAlpha = alpha;
    ctx.fillStyle = SHADOW; ctx.beginPath(); ctx.ellipse(x + 1.5, y + 0.5, 7, 2.3, 0, 0, 7); ctx.fill();
    ctx.translate(x, y); if (faceL) ctx.scale(-1, 1);
    const ps = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = true;
    ctx.drawImage(s, -9, -12, 18, 13);
    ctx.imageSmoothingEnabled = ps;
    ctx.restore();
  }
  // move an animal with simple 4-point collision
  function amove(o, dx, dy, dt, solid) {
    const nx = o.x + dx * dt, ny = o.y + dy * dt;
    const bl = (x, y) => solid(x - 5, y - 1) || solid(x + 5, y - 1) || solid(x - 5, y + 1) || solid(x + 5, y + 1);
    if (!bl(nx, o.y)) o.x = nx;
    if (!bl(o.x, ny)) o.y = ny;
    if (Math.abs(dx) > 1) o.faceL = dx < 0;
    const sp = Math.hypot(dx, dy);
    if (sp > 3) { o.anim = (o.anim || 0) + dt * sp / 6; o.frame = Math.floor(o.anim) % 2; } else o.frame = 0;
  }
  function graze(o, dt, solid, speed = 8) {
    o.wt = (o.wt || 0) - dt;
    if (o.wt < 0) { o.wt = G.rand(1, 4); o.wa = G.chance(0.5) ? null : G.rand(0, 6.28); }
    if (o.wa != null) amove(o, Math.cos(o.wa) * speed, Math.sin(o.wa) * speed, dt, solid); else o.frame = 0;
  }

  // ---------- arena ----------
  let A = null;
  function buildArena() {
    let seed = 1234;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    // ground = the world's Thessaly patchwork (same formula as world.js W.outer), so the edges blend into the map:
    // 'Y' wheat, 'L' ploughed soil, 'r' grass, 'T' tree lines on the patch borders
    const worldGround = (X, Y) => {
      if (Y >= 43 && Y <= 56) return 'r';
      const cx = Math.floor((X - 100) / 11), cy = Math.floor(Y / 8), hh = G.hash(cx * 7 + 1, cy * 13 + 5);
      if ((X - 100) % 11 === 0 || Y % 8 === 0) return G.hash(X, Y * 3) < 0.35 ? 'T' : 'r';
      return hh < 0.45 ? 'Y' : hh < 0.68 ? 'L' : 'r';
    };
    const g = [], base = [], f = [];
    for (let y = 0; y < AH; y++) {
      g.push([]); base.push([]); f.push(new Array(AW).fill(null));
      for (let x = 0; x < AW; x++) { const c = worldGround(SP.tx + x, SP.ty + y); g[y].push(c); base[y].push(c === 'T' ? 'r' : c); }
    }
    // the farm (drawn into f, then stamped over the patchwork)
    const rect = (x0, y0, x1, y1, ch) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) f[y][x] = ch; };
    const fence = (x0, y0, x1, y1) => { for (let x = x0; x <= x1; x++) { f[y0][x] = 'F'; f[y1][x] = 'F'; } for (let y = y0; y <= y1; y++) { f[y][x0] = 'F'; f[y][x1] = 'F'; } };
    rect(ENTRY[0], 0, ENTRY[0] + 1, 1, 'p');                 // dirt path coming down from the εθνική
    rect(11, 2, 21, 4, 'y');                                   // farmyard at the gate (the lady waits here)
    rect(18, 5, 19, 9, 'd');                                   // track from the yard to the farm road
    // field A
    rect(1, 5, GATE_X, 19, 'g'); fence(1, 5, GATE_X, 19);
    for (let y = ROAD_Y0; y <= ROAD_Y1; y++) f[y][GATE_X] = 'D';
    f[STILE[1]][STILE[0]] = 'G';
    rect(8, 15, 11, 18, 'm');
    for (let x = 5; x <= 7; x++) { f[ROAD_Y0 - 1][x] = 'F'; f[ROAD_Y1 + 1][x] = 'F'; } // chute to the ramp
    // farm road (4 tiles wide): east, then down to field B
    rect(GATE_X + 1, ROAD_Y0, RX1, ROAD_Y1, 'd'); rect(RX0, ROAD_Y0, RX1, BY0 - 1, 'd');
    // field B
    rect(BX0, BY0, BX1, BY1, 'g'); fence(BX0, BY0, BX1, BY1);
    for (let x = RX0; x <= RX1; x++) f[BY0][x] = 'E';
    rect(RX0, 26, RX1 + 1, 28, 'm');
    rect(19, 22, 20, 23, 'B');
    rect(14, 8, 17, 9, 'r');                                   // ΕΣΠΑ sign spot
    const near = (x, y, k) => { for (let j = y - k; j <= y + k; j++) for (let i = x - k; i <= x + k; i++) if (f[j] && f[j][i] && f[j][i] !== 'r') return true; return false; };
    for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) {
      if (f[y][x]) { g[y][x] = f[y][x]; if (f[y][x] === 'r') base[y][x] = 'r'; }
      else if (g[y][x] === 'T' && near(x, y, 1)) g[y][x] = 'r';
    }
    // hay bales along the road, a few field stones in the grass
    const roadDist = (tx, ty) => { let best = 9; for (let y = ty - 3; y <= ty + 3; y++) for (let x = tx - 3; x <= tx + 3; x++) { if (y < 0 || x < 0 || y >= AH || x >= AW) continue; if (g[y][x] === 'd' && y >= ROAD_Y0) best = Math.min(best, Math.max(Math.abs(x - tx), Math.abs(y - ty))); } return best; };
    for (let y = 1; y < AH - 1; y++) for (let x = 1; x < AW - 1; x++) {
      const c = g[y][x]; if (f[y][x] || (c !== 'r' && c !== 'Y' && c !== 'L')) continue;
      const d = roadDist(x, y);
      if (d === 1 && x > GATE_X + 2 && rnd() < 0.12) g[y][x] = 'h';
      else if (c === 'r' && d >= 2 && !near(x, y, 1) && rnd() < 0.05) g[y][x] = 'S';
    }
    const rows = g.map(r => r.join(''));
    const get = (tx, ty) => (tx < 0 || ty < 0 || tx >= AW || ty >= AH) ? '#' : rows[ty][tx];
    const ground = (tx, ty) => base[ty][tx];
    const hsh = (a, b, s) => ((((a * 73856093) ^ (b * 19349663) ^ (s * 83492791)) >>> 0) % 1000) / 1000;
    const legend = {
      default: {}, r: {}, g: {}, d: {}, m: {}, D: {}, E: {}, Y: {}, L: {}, y: {}, p: {}, G: {},
      B: { solid: true }, F: { solid: true }, T: { solid: true }, S: { solid: true }, h: { solid: true },
    };
    // fence runs (computed once): horizontal and vertical rails between posts
    const isF = c => c === 'F', isGate = c => c === 'D' || c === 'E';
    const hRuns = [], vRuns = [];
    for (let ty = 0; ty < AH; ty++) for (let tx = 0; tx < AW; tx++) {
      if (isF(get(tx, ty)) && !isF(get(tx - 1, ty))) {
        let e = tx; while (isF(get(e + 1, ty))) e++;
        if (e > tx || isGate(get(tx - 1, ty)) || isGate(get(e + 1, ty))) hRuns.push([tx * TS + (get(tx - 1, ty) === 'D' ? 0 : 8), e * TS + (get(e + 1, ty) === 'D' ? 16 : 8), ty]);
      }
      if (isF(get(tx, ty)) && !isF(get(tx, ty - 1))) {
        let e = ty; while (isF(get(tx, e + 1))) e++;
        if (e > ty || isGate(get(tx, ty - 1)) || isGate(get(tx, ty + 1))) vRuns.push([ty * TS + (get(tx, ty - 1) === 'D' ? 0 : 8), e * TS + (get(tx, e + 1) === 'D' ? 16 : 8), tx]);
      }
    }

    // ---------- HD painter (logical coordinates, region ox,oy,w,h) ----------
    function paintArena(x, ox, oy, w, h) {
      const WW = AW * TS, HH = AH * TS;
      const t0x = Math.max(0, Math.floor(ox / TS) - 2), t1x = Math.min(AW - 1, Math.floor((ox + w) / TS) + 2);
      const t0y = Math.max(0, Math.floor(oy / TS) - 2), t1y = Math.min(AH - 1, Math.floor((oy + h) / TS) + 2);
      const each = fn => { for (let ty = t0y; ty <= t1y; ty++) for (let tx = t0x; tx <= t1x; tx++) fn(tx, ty, get(tx, ty)); };
      x.lineJoin = 'round'; x.lineCap = 'round';

      // 1. Thessaly patchwork, tile for tile as the world paints it (seamless edges): grass, wheat stripes, ploughed furrows
      each((tx, ty) => {
        const X = tx * TS, Y = ty * TS, c = ground(tx, ty), r = G.hash(SP.tx + tx, SP.ty + ty);
        const P = (a, b, ww, hh, col) => { x.fillStyle = col; x.fillRect(X + a, Y + b, ww, hh); };
        if (c === 'Y') { P(0, 0, 16, 16, '#e2c25a'); for (let i = 1; i < 16; i += 4) { P(0, i, 16, 1.4, '#c9a23e'); P(0, i + 1.4, 16, 0.8, '#f3dc86'); } }
        else if (c === 'L') { P(0, 0, 16, 16, '#9a6c44'); for (let i = 2; i < 16; i += 4) { P(0, i, 16, 1.6, '#7a5232'); P(0, i + 1.6, 16, 0.8, '#b08258'); } }
        else { P(0, 0, 16, 16, '#78c850'); if (r < 0.3) { P(3, 5, 1, 2, '#58a838'); P(4, 4, 1, 1, '#58a838'); P(10, 11, 1, 2, '#58a838'); P(11, 10, 1, 1, '#58a838'); } if (r > 0.85) P(7, 7, 2, 1, '#98e070'); }
      });
      // HD light: a few soft sunny / shady blotches, kept away from the region edge so the border matches the map
      each((tx, ty) => {
        if (tx < 2 || ty < 2 || tx > AW - 3 || ty > AH - 3) return;
        const v = hsh(tx, ty, 3); if (v >= 0.1) return;
        const cx = tx * TS + 8, cy = ty * TS + 8, r = 12 + hsh(tx, ty, 4) * 12, col = v < 0.05 ? '255,248,200' : '40,70,20';
        x.fillStyle = rad(x, cx, cy, 0, cx, cy, r, ['rgba(' + col + ',0.12)', 'rgba(' + col + ',0)']); x.fillRect(cx - r, cy - r, r * 2, r * 2);
      });
      // wheat ears catching the light
      each((tx, ty) => {
        if (ground(tx, ty) !== 'Y' || hsh(tx, ty, 41) > 0.5) return;
        const px = tx * TS + 2 + hsh(tx, ty, 42) * 11, py = ty * TS + 3 + hsh(ty, tx, 43) * 10;
        x.strokeStyle = 'rgba(150,110,30,0.55)'; x.lineWidth = 0.6; x.beginPath(); x.moveTo(px, py + 3); x.lineTo(px + 0.6, py); x.stroke();
        x.fillStyle = 'rgba(255,240,170,0.8)'; ell(x, px + 0.7, py - 0.4, 0.7, 1.3, 0.3); x.fill();
      });

      // 2. the two fenced fields: lush grass with soft mowing stripes
      const fieldR = (fx0, fy0, fx1, fy1) => {
        const X0 = fx0 * TS + 8, Y0 = fy0 * TS + 8, X1 = fx1 * TS + 8, Y1 = fy1 * TS + 8;
        x.fillStyle = lin(x, X0, Y0, X1, Y1, ['#7cba58', '#62a047', '#4c8737']); x.fillRect(X0, Y0, X1 - X0, Y1 - Y0);
        x.fillStyle = 'rgba(255,255,215,0.06)'; for (let sx = X0; sx < X1; sx += 32) x.fillRect(sx, Y0, Math.min(16, X1 - sx), Y1 - Y0);
        x.fillStyle = lin(x, 0, Y1 - 12, 0, Y1, ['rgba(25,50,20,0)', 'rgba(25,50,20,0.2)']); x.fillRect(X0, Y1 - 12, X1 - X0, 12);
        x.fillStyle = lin(x, X1 - 12, 0, X1, 0, ['rgba(25,50,20,0)', 'rgba(25,50,20,0.16)']); x.fillRect(X1 - 12, Y0, 12, Y1 - Y0);
      };
      fieldR(1, 5, GATE_X, 19); fieldR(BX0, BY0, BX1, BY1);

      // 3. mud patches with puddles and hoof prints
      const mudR = (mx0, my0, mx1, my1, s) => {
        const X0 = mx0 * TS + 1, Y0 = my0 * TS + 1, ww = (mx1 - mx0 + 1) * TS - 2, hh = (my1 - my0 + 1) * TS - 2;
        x.fillStyle = 'rgba(70,48,24,0.3)'; rr(x, X0 - 3, Y0 - 3, ww + 6, hh + 6, 18); x.fill();
        x.fillStyle = rad(x, X0 + ww * 0.3, Y0 + hh * 0.28, 2, X0 + ww / 2, Y0 + hh / 2, Math.max(ww, hh) * 0.72, ['#8c6642', '#6b4a2b', '#4c321b']);
        rr(x, X0, Y0, ww, hh, 15); x.fill(); x.strokeStyle = 'rgba(40,25,12,0.55)'; x.lineWidth = 0.8; x.stroke();
        for (let i = 0; i < 5; i++) {
          const pr = 3 + hsh(s, i, 3) * 5, px = X0 + 10 + hsh(s, i, 1) * (ww - 20), py = Y0 + 10 + hsh(i, s, 2) * (hh - 20);
          x.fillStyle = lin(x, px - pr, py - pr, px + pr, py + pr, ['#a8bccb', '#5b7080']); ell(x, px, py, pr, pr * 0.6); x.fill();
          x.strokeStyle = 'rgba(40,25,12,0.6)'; x.lineWidth = 0.6; x.stroke();
          x.strokeStyle = 'rgba(255,255,255,0.55)'; x.lineWidth = 0.7; x.beginPath(); x.ellipse(px, py, pr * 0.62, pr * 0.32, 0, Math.PI * 1.1, Math.PI * 1.6); x.stroke();
        }
        x.fillStyle = 'rgba(38,24,12,0.35)';
        for (let i = 0; i < 16; i++) { const px = X0 + 6 + hsh(s, i, 7) * (ww - 12), py = Y0 + 6 + hsh(i, s, 8) * (hh - 12); ell(x, px, py, 0.9, 0.6); x.fill(); ell(x, px + 1.7, py + 0.3, 0.9, 0.6); x.fill(); }
      };
      mudR(8, 15, 11, 18, 1); mudR(RX0, 26, RX1 + 1, 28, 2);

      // 4. dirt: farmyard, track and farm road (soft edge, wheel ruts, grassy crown, pebbles); the path from the εθνική fades in
      const segs = [[11, 2, 21, 4], [18, 4, 19, ROAD_Y0], [GATE_X, ROAD_Y0, RX1, ROAD_Y1], [RX0, ROAD_Y0, RX1, BY0]];
      const segR = (s, gr) => rr(x, s[0] * TS - gr, s[1] * TS - gr, (s[2] - s[0] + 1) * TS + gr * 2, (s[3] - s[1] + 1) * TS + gr * 2, 4 + gr);
      x.fillStyle = 'rgba(110,82,44,0.25)'; for (const s of segs) { segR(s, 3.5); x.fill(); }
      x.fillStyle = 'rgba(120,90,50,0.4)'; for (const s of segs) { segR(s, 1.4); x.fill(); }
      const dirt = lin(x, 0, 0, WW * 0.5, HH, ['#d2aa74', '#b48d5c', '#9a7548']);
      x.fillStyle = dirt; for (const s of segs) { segR(s, 0); x.fill(); }
      { // lane under the world's dirt path (#f0e2b8 at the region edge, farm dirt by the yard)
        const LX = ENTRY[0] * TS, LW = 2 * TS;
        x.fillStyle = 'rgba(120,90,50,0.3)'; x.fillRect(LX - 2, 0, LW + 4, 2.5 * TS);
        x.fillStyle = lin(x, 0, 0, 0, 2.6 * TS, ['#f0e2b8', '#e2c898', '#d2aa74']); x.fillRect(LX, 0, LW, 2.6 * TS);
        x.fillStyle = '#dccb98'; x.fillRect(LX, 0, 2, TS * 0.8); x.fillRect(LX + LW - 2, 0, 2, TS * 0.8);
      }
      const yR = (ROAD_Y0 + ROAD_Y1 + 1) / 2 * TS, xM = (RX0 + RX1 + 1) / 2 * TS;
      const path = o => { x.beginPath(); x.moveTo(GATE_X * TS + 4, yR + o); x.lineTo(xM - o, yR + o); x.lineTo(xM - o, BY0 * TS + 12); };
      for (const o of [-9, 9]) {
        path(o); x.strokeStyle = 'rgba(92,64,34,0.32)'; x.lineWidth = 3.2; x.stroke();
        path(o + 1.6); x.strokeStyle = 'rgba(240,212,160,0.28)'; x.lineWidth = 0.8; x.stroke();
      }
      path(0); x.strokeStyle = 'rgba(112,140,62,0.38)'; x.lineWidth = 2.4; x.stroke();
      each((tx, ty, c) => {
        if ((c !== 'd' && c !== 'y') || hsh(tx, ty, 21) > 0.45) return;
        const px = tx * TS + 2 + hsh(tx, ty, 22) * 12, py = ty * TS + 2 + hsh(ty, tx, 23) * 12, r = 0.9 + hsh(tx, ty, 24) * 0.9;
        x.fillStyle = 'rgba(60,40,20,0.25)'; ell(x, px + 0.5, py + 0.6, r, r * 0.7); x.fill();
        x.fillStyle = lin(x, px - r, py - r, px + r, py + r, ['#d8d0c0', '#8a8278']); ell(x, px, py, r, r * 0.72); x.fill();
      });

      // 5. sparse grass tufts and a few flowers
      const tuft = (cx, cy, col) => {
        x.strokeStyle = col; x.lineWidth = 0.7; x.beginPath();
        x.moveTo(cx, cy); x.quadraticCurveTo(cx - 0.8, cy - 1.8, cx - 2.2, cy - 2.8);
        x.moveTo(cx, cy); x.quadraticCurveTo(cx - 0.1, cy - 2, cx + 0.3, cy - 3.6);
        x.moveTo(cx, cy); x.quadraticCurveTo(cx + 0.9, cy - 1.6, cx + 2.1, cy - 2.6); x.stroke();
      };
      each((tx, ty, c) => {
        if (c !== 'r' && c !== 'g') return;
        if (c === 'r' && (tx < 1 || ty < 1 || tx > AW - 2 || ty > AH - 2)) return; // edge tiles stay like the map
        const v = hsh(tx, ty, 31); if (v > 0.42) return;
        const px = tx * TS + 3 + hsh(tx, ty, 32) * 10, py = ty * TS + 5 + hsh(ty, tx, 33) * 9;
        tuft(px, py, c === 'g' ? 'rgba(46,100,34,0.75)' : 'rgba(56,120,40,0.7)');
        if (v < 0.16) tuft(px + 4, py + 3, c === 'g' ? 'rgba(150,210,110,0.55)' : 'rgba(170,230,130,0.6)');
        if (c === 'g' && v < 0.06) {
          const fx = px + 5, fy = py - 4; x.fillStyle = '#fffaf0';
          for (let k = 0; k < 5; k++) { circ(x, fx + Math.cos(k * 1.256) * 0.9, fy + Math.sin(k * 1.256) * 0.9, 0.65); x.fill(); }
          x.fillStyle = '#ffcc1a'; circ(x, fx, fy, 0.55); x.fill();
        }
      });

      // 6. fences: scuffed ground, drop shadows, rails, posts (dark outline so they read as walls)
      const RY = [5, 9.6], RH = 2.5;
      x.fillStyle = 'rgba(58,42,22,0.2)';
      for (const [a, b, ty] of hRuns) { rr(x, a - 4, ty * TS + 2, b - a + 8, 13, 5); x.fill(); }
      for (const [a, b, tx] of vRuns) { rr(x, tx * TS + 2, a - 4, 13, b - a + 8, 5); x.fill(); }
      x.fillStyle = SHADOW;
      for (const [a, b, ty] of hRuns) for (const ry of RY) { rr(x, a + 2.5, ty * TS + ry + 4, b - a, RH, 1.2); x.fill(); }
      for (const [a, b, tx] of vRuns) for (const ry of RY) { rr(x, tx * TS + ry + 3, a + 3, RH, b - a, 1.2); x.fill(); }
      each((tx, ty, c) => { if (isF(c)) { rr(x, tx * TS + 8.5, ty * TS + 6.5, 4.4, 9, 1.6); x.fill(); } });
      x.strokeStyle = INK; x.lineWidth = 0.65;
      for (const [a, b, tx] of vRuns) for (const ry of RY) {
        const px = tx * TS + ry; x.fillStyle = lin(x, px, 0, px + RH, 0, ['#e2b274', '#a8743e', '#6a401e']); rr(x, px, a, RH, b - a, 1.2); x.fill(); x.stroke();
      }
      for (const [a, b, ty] of hRuns) for (const ry of RY) {
        const py = ty * TS + ry; x.fillStyle = lin(x, 0, py, 0, py + RH, ['#e2b274', '#a8743e', '#6a401e']); rr(x, a, py, b - a, RH, 1.2); x.fill(); x.stroke();
      }
      each((tx, ty, c) => {
        if (!isF(c)) return;
        const px = tx * TS + 6, py = ty * TS + 2.5;
        x.fillStyle = lin(x, px, 0, px + 4.2, 0, ['#b8814a', '#7e4c24', '#4e2c12']); x.strokeStyle = INK; x.lineWidth = 0.75;
        rr(x, px, py, 4.2, 10, 1.5); x.fill(); x.stroke();
        x.fillStyle = lin(x, px, py, px + 4, py + 3, ['#f0c88c', '#c99254']); x.lineWidth = 0.5;
        rr(x, px, py, 4.2, 2.8, 1.4); x.fill(); x.stroke();
      });
      { // the stile (σκαλοπάτι) over field A's top fence: two low wooden steps, people climb over, sheep can't
        const X = STILE[0] * TS, Y = STILE[1] * TS;
        x.fillStyle = 'rgba(58,42,22,0.22)'; rr(x, X - 1, Y + 1, 18, 15, 4); x.fill();
        for (const [sy, sw] of [[3.5, 3.2], [9, 3.6]]) {
          x.fillStyle = SHADOW; rr(x, X + 1.5, Y + sy + 3, 15, sw, 1.2); x.fill();
          x.fillStyle = lin(x, 0, Y + sy, 0, Y + sy + sw, ['#f0c88c', '#b8814a', '#7e4c24']); x.strokeStyle = INK; x.lineWidth = 0.65;
          rr(x, X - 0.5, Y + sy, 17, sw, 1.2); x.fill(); x.stroke();
        }
        x.fillStyle = 'rgba(255,240,200,0.35)'; rr(x, X + 1, Y + 9.4, 14, 0.9, 0.4); x.fill();
      }

      // 7. standing scenery, row by row: trees, boulders, hay bales
      const tree = (tx, ty) => {
        const v = hsh(tx, ty, 11), s = 0.9 + v * 0.25, olive = v < 0.3;
        x.save(); x.translate(tx * TS + 8, ty * TS + 14); x.scale(s, s); x.translate(-10, -20);
        x.fillStyle = SHADOW; ell(x, 13, 20.5, 8.5, 3.2); x.fill();
        x.fillStyle = lin(x, 8.5, 0, 11.5, 0, ['#8e6238', '#4e331d']); x.strokeStyle = INK; x.lineWidth = 0.6; rr(x, 8.5, 12, 3, 8.5, 1); x.fill(); x.stroke();
        const p = olive ? ['#b5d47c', '#6e9a46', '#365e2a'] : ['#93de74', '#4ea045', '#2a6a30'];
        x.fillStyle = rad(x, 7, 5, 1, 10, 9, 10, p); x.strokeStyle = 'rgba(20,40,20,0.85)'; x.lineWidth = 0.7;
        x.beginPath(); x.arc(10, 9, 8, 0, Math.PI * 2); x.fill(); x.stroke();
        x.fillStyle = 'rgba(255,255,255,0.18)'; circ(x, 7, 6, 3); x.fill();
        x.fillStyle = 'rgba(30,70,30,0.32)'; circ(x, 13, 12, 3.5); x.fill();
        x.restore();
      };
      const stone = (tx, ty) => {
        const cx = tx * TS + 8, cy = ty * TS + 9;
        x.fillStyle = SHADOW; ell(x, cx + 2.5, cy + 4, 6.8, 2.8); x.fill();
        x.fillStyle = rad(x, cx - 2.5, cy - 3, 0.5, cx, cy, 8, ['#d6d6cc', '#9c9c92', '#5e5e56']); x.strokeStyle = INK; x.lineWidth = 0.7;
        x.beginPath(); x.moveTo(cx - 6, cy + 3); x.quadraticCurveTo(cx - 7, cy - 3, cx - 2, cy - 5); x.quadraticCurveTo(cx + 4, cy - 6.5, cx + 6, cy - 1);
        x.quadraticCurveTo(cx + 7, cy + 4, cx + 1, cy + 4.5); x.quadraticCurveTo(cx - 4, cy + 5, cx - 6, cy + 3); x.closePath(); x.fill(); x.stroke();
        x.fillStyle = 'rgba(255,255,255,0.35)'; ell(x, cx - 2.5, cy - 2.6, 2.4, 1.2, -0.4); x.fill();
        x.strokeStyle = 'rgba(40,36,34,0.4)'; x.lineWidth = 0.5; x.beginPath(); x.moveTo(cx + 1, cy - 3); x.quadraticCurveTo(cx + 2.5, cy, cx + 1.5, cy + 2.5); x.stroke();
        x.fillStyle = lin(x, cx + 5, cy + 2, cx + 8, cy + 5, ['#c8c8be', '#76766e']); x.strokeStyle = INK; x.lineWidth = 0.5; ell(x, cx + 6.2, cy + 4, 1.8, 1.3); x.fill(); x.stroke();
      };
      const hay = (tx, ty) => {
        const X = tx * TS, Y = ty * TS;
        x.fillStyle = SHADOW; rr(x, X + 4.5, Y + 8, 13, 8, 4); x.fill();
        x.fillStyle = lin(x, 0, Y + 3.5, 0, Y + 13.5, ['#f6df8a', '#d8b450', '#a88430']); x.strokeStyle = INK; x.lineWidth = 0.7;
        rr(x, X + 1.5, Y + 3.5, 12, 10, 4.5); x.fill(); x.stroke();
        x.strokeStyle = 'rgba(140,100,30,0.55)'; x.lineWidth = 0.55;
        for (const yy of [6, 8.6, 11.2]) { x.beginPath(); x.moveTo(X + 3, Y + yy); x.quadraticCurveTo(X + 6, Y + yy - 0.8, X + 9.5, Y + yy + 0.2); x.stroke(); }
        x.strokeStyle = 'rgba(170,60,40,0.6)'; x.lineWidth = 0.6;
        for (const xx of [4.5, 8]) { x.beginPath(); x.moveTo(X + xx, Y + 3.7); x.lineTo(X + xx, Y + 13.3); x.stroke(); }
        x.fillStyle = rad(x, X + 11.8, Y + 7, 0.3, X + 12.4, Y + 8.5, 4.5, ['#f2d47a', '#c9a040', '#94702a']); x.strokeStyle = INK; x.lineWidth = 0.6;
        ell(x, X + 12.4, Y + 8.5, 2.9, 4.8); x.fill(); x.stroke();
        x.strokeStyle = 'rgba(120,84,24,0.65)'; x.lineWidth = 0.5;
        x.beginPath(); for (let a = 0; a < 9; a += 0.3) { const r = a * 0.29; x.lineTo(X + 12.4 + Math.cos(a) * r * 0.6, Y + 8.5 + Math.sin(a) * r); } x.stroke();
        x.fillStyle = 'rgba(255,255,230,0.35)'; rr(x, X + 3, Y + 4.4, 7, 1.6, 0.8); x.fill();
      };
      each((tx, ty, c) => { if (c === 'T') tree(tx, ty); else if (c === 'S') stone(tx, ty); else if (c === 'h') hay(tx, ty); });
    }

    const AR = G.Arena(rows, legend, TS);
    AR.paint = paintArena; // the world paints the region with it (chunk cache in world.js); the quest draws the world ground
    // the quest view shows the map around the farm too: world ground (incl. this region) + the world's trees/props
    AR.draw = (ctx, camX, camY) => Wd.drawGround(ctx, camX + OX, camY + OY);
    return AR;
  }
  const getA = () => A || (A = buildArena());

  // ---------- shared drawing (world statics/live and the quest render) ----------
  // one painted gate leaf (red / white farm gate) along local +x from its hinge; L = length
  function gateLeaf(ctx, L) {
    ctx.fillStyle = SHADOW; rr(ctx, 2, -1, L, 7, 1.5); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 0.65;
    for (const ry of [-3.4, 1.2]) { // two rails, white with red bands
      ctx.fillStyle = lin(ctx, 0, ry, 0, ry + 2.6, ['#ffffff', '#ece6da', '#c8c0b0']); rr(ctx, 0, ry, L, 2.6, 1.2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e8322a'; for (let sx = 3; sx < L - 3; sx += 8) { rr(ctx, sx, ry + 0.3, 4, 2, 0.8); ctx.fill(); }
    }
    ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(2, 2.4); ctx.lineTo(L - 3, -2.2); ctx.stroke();
    ctx.strokeStyle = '#e8322a'; ctx.lineWidth = 0.9; ctx.stroke();
    ctx.fillStyle = lin(ctx, L - 3, 0, L, 0, ['#ff6a5a', '#b81e18']); ctx.strokeStyle = INK; ctx.lineWidth = 0.6; rr(ctx, L - 3, -4.2, 3, 8.4, 1); ctx.fill(); ctx.stroke();
  }
  // painted gate post (red with a white cap)
  function gatePost(ctx, px, py) {
    ctx.fillStyle = SHADOW; rr(ctx, px + 2.5, py + 3.5, 6, 6.5, 1.6); ctx.fill();
    ctx.fillStyle = lin(ctx, px, 0, px + 6, 0, ['#ff6a5a', '#d82a22', '#8a1410']); ctx.strokeStyle = INK; ctx.lineWidth = 0.75;
    rr(ctx, px, py, 6, 7, 1.6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff6e8'; ctx.lineWidth = 0.5; rr(ctx, px, py, 6, 2.4, 1.3); ctx.fill(); ctx.stroke();
  }
  // gate A: big red/white farm gate; open = 0 (shut) .. 1 (both leaves swung out east); dx,dy = screen offset of the region origin
  function drawGateA(ctx, dx, dy, open) {
    const o = open === true ? 1 : G.clamp(+open || 0, 0, 1);
    const gx = GATE_X * TS + dx, gy0 = ROAD_Y0 * TS + dy, gh = (ROAD_Y1 - ROAD_Y0 + 1) * TS, L = gh / 2 - 1;
    ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (const [hy, a0] of [[gy0 + 1, Math.PI / 2], [gy0 + gh - 1, -Math.PI / 2]]) {
      ctx.save(); ctx.translate(gx + 8, hy); ctx.rotate(a0 * (1 - o)); gateLeaf(ctx, L); ctx.restore();
    }
    for (const py of [gy0 - 4, gy0 + gh - 2]) gatePost(ctx, gx + 5, py);
    ctx.restore();
  }
  // the little walk gate (πορτούλα) over field A's top fence: painted posts, leaf swung open into the field, sign board
  function drawStile(ctx, dx, dy, world) {
    // an OPEN entrance in the fence: two wooden posts, a beam across the top with a sign, nothing blocking the gap
    const X = STILE[0] * TS + dx, Y = STILE[1] * TS + dy;
    ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const post = (px) => {
      ctx.fillStyle = SHADOW; rr(ctx, px + 1.5, Y + 1, 4, 10, 1.5); ctx.fill();
      ctx.fillStyle = '#8a5a30'; ctx.strokeStyle = INK; ctx.lineWidth = 0.7; rr(ctx, px, Y - 15, 4, 25, 1.5); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#a8743e'; rr(ctx, px + 0.6, Y - 14.4, 1.4, 23.5, 0.7); ctx.fill();
    };
    post(X - 2); post(X + 14);
    // beam + sign plate hanging from it
    ctx.fillStyle = '#7a4e28'; ctx.strokeStyle = INK; ctx.lineWidth = 0.7; rr(ctx, X - 4, Y - 17, 24, 3.4, 1.2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(X + 2, Y - 13.6); ctx.lineTo(X + 2, Y - 12); ctx.moveTo(X + 14, Y - 13.6); ctx.lineTo(X + 14, Y - 12); ctx.stroke();
    ctx.fillStyle = '#d82a22'; ctx.strokeStyle = INK; ctx.lineWidth = 0.6; rr(ctx, X - 1, Y - 12.2, 18, 6.4, 1.4); ctx.fill(); ctx.stroke();
    if (world) { ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = (G.ui && G.ui.fpx) ? G.ui.fpx(4.6, 700) : 'bold 5px sans-serif'; ctx.fillText('ΕΙΣΟΔΟΣ', X + 8, Y - 8.9); }
    // soft painted arrows on the ground pointing into the field
    const k = (G.t * 1.2) % 1;
    for (let n = 0; n < 2; n++) { const ay = Y + 2 + ((n + k) % 2) * 5; ctx.globalAlpha = 0.75 - ((n + k) % 2) * 0.35; ctx.strokeStyle = '#ffe066'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(X + 4.5, ay); ctx.lineTo(X + 8, ay + 3); ctx.lineTo(X + 11.5, ay); ctx.stroke(); }
    ctx.globalAlpha = 1; ctx.restore();
  }
  // pulsing ground ring + bouncing arrow pointing down at a spot (screen px)
  function drawMarker(ctx, x, y, col = '#ffd400') {
    const p = 0.5 + Math.sin(G.t * 6) * 0.5, b = Math.abs(Math.sin(G.t * 4)) * 5;
    ctx.save(); ctx.lineJoin = 'round';
    ctx.fillStyle = rad(ctx, x, y, 0, x, y, 16, ['rgba(255,212,0,0.35)', 'rgba(255,212,0,0)']); ell(ctx, x, y, 16, 10); ctx.fill();
    ctx.globalAlpha = 0.5 + p * 0.5; ctx.strokeStyle = col; ctx.lineWidth = 1.4; ell(ctx, x, y, 9 + p * 4, 5.5 + p * 2.5); ctx.stroke(); ctx.globalAlpha = 1;
    const ay = y - 30 - b;
    ctx.fillStyle = col; ctx.strokeStyle = 'rgba(28,20,36,0.95)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, ay + 12); ctx.lineTo(x - 7, ay + 4); ctx.lineTo(x - 3, ay + 4); ctx.lineTo(x - 3, ay - 3); ctx.lineTo(x + 3, ay - 3); ctx.lineTo(x + 3, ay + 4); ctx.lineTo(x + 7, ay + 4); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; rr(ctx, x - 2, ay - 2, 1.4, 6, 0.7); ctx.fill();
    ctx.restore();
  }
  // ΕΣΠΑ road sign board (its text is drawn crisp in the quest HUD)
  function drawSign(ctx, dx, dy) {
    const sgx = SIGN[0] + dx, sgy = SIGN[1] + dy;
    ctx.save(); ctx.lineJoin = 'round';
    ctx.fillStyle = SHADOW; rr(ctx, sgx - 20, sgy - 12, 46, 14, 2.5); ctx.fill(); rr(ctx, sgx + 2, sgy - 2, 2.4, 13, 1); ctx.fill();
    ctx.fillStyle = lin(ctx, sgx - 1.2, 0, sgx + 1.2, 0, ['#8a6038', '#4a2e14']); ctx.strokeStyle = INK; ctx.lineWidth = 0.6;
    rr(ctx, sgx - 1.2, sgy - 5, 2.4, 13, 0.8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = lin(ctx, 0, sgy - 16, 0, sgy - 3, ['#2f5cbc', '#1d3f8f', '#14306e']); ctx.lineWidth = 0.75;
    rr(ctx, sgx - 23, sgy - 16.5, 46, 14, 2.2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffd400'; rr(ctx, sgx - 22.2, sgy - 15.7, 44.4, 1.4, 0.7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; rr(ctx, sgx - 22, sgy - 14, 44, 4.5, 1.5); ctx.fill();
    ctx.restore();
  }
  // inspector's booth + EU flag; bx,by = screen pos of the booth's top-left
  function drawBooth(ctx, bx, by) {
    ctx.save(); ctx.lineJoin = 'round';
    // drop shadow
    ctx.fillStyle = SHADOW; rr(ctx, bx + 2 + 3, by + 8 + 4, 30, 22, 2.5); ctx.fill(); rr(ctx, bx + 37, by + 26, 3, 5, 1); ctx.fill();
    // walls
    ctx.fillStyle = lin(ctx, bx + 2, by + 8, bx + 30, by + 30, ['#f8f5ec', '#e4dfd0', '#c8c0aa']); ctx.strokeStyle = INK; ctx.lineWidth = 0.75;
    rr(ctx, bx + 2, by + 8, 28, 22, 1.6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(60,50,40,0.1)'; rr(ctx, bx + 26, by + 9, 3.4, 20.4, 1); ctx.fill();
    // window
    ctx.fillStyle = lin(ctx, 0, by + 12, 0, by + 21, ['#7a644c', '#4a3a2a']); rr(ctx, bx + 5, by + 12, 13, 9.5, 1.4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = lin(ctx, bx + 6, by + 13, bx + 17, by + 20, ['#c4ecff', '#7ec0f0', '#3e7ab8']); rr(ctx, bx + 6, by + 13, 11, 7.5, 1); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(bx + 7.5, by + 18.5); ctx.lineTo(bx + 11, by + 14); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; rr(ctx, bx + 4.5, by + 21, 14, 1.3, 0.6); ctx.fill();
    // door
    ctx.fillStyle = lin(ctx, bx + 21, 0, bx + 28, 0, ['#9a7048', '#6b4a2b', '#4a3018']); ctx.strokeStyle = INK; ctx.lineWidth = 0.7;
    rr(ctx, bx + 21, by + 14, 7, 16, 1.2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(30,18,8,0.35)'; ctx.lineWidth = 0.5; rr(ctx, bx + 22.3, by + 15.5, 4.4, 5.5, 0.8); ctx.stroke(); rr(ctx, bx + 22.3, by + 22.5, 4.4, 6, 0.8); ctx.stroke();
    ctx.fillStyle = rad(ctx, bx + 26.2, by + 21.8, 0.1, bx + 26.5, by + 22.2, 1, ['#fff3b0', '#c9a020']); circ(ctx, bx + 26.5, by + 22.2, 0.75); ctx.fill();
    // roof with overhang shadow
    ctx.fillStyle = 'rgba(20,10,30,0.2)'; ctx.fillRect(bx + 2.4, by + 9.2, 27.2, 2);
    ctx.fillStyle = lin(ctx, 0, by + 1.5, 0, by + 9.5, ['#5c86c0', '#3a5a8a', '#24406a']); ctx.strokeStyle = INK; ctx.lineWidth = 0.75;
    rr(ctx, bx - 1, by + 1.5, 34, 8, 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.22)'; rr(ctx, bx, by + 2.3, 32, 1.6, 0.8); ctx.fill();
    // «ΕΛΕΓΚΤΗΣ» sign board (label text is drawn crisp in the HUD)
    ctx.fillStyle = lin(ctx, 0, by - 3, 0, by + 2, ['#8a8a92', '#55555e']); for (const px of [bx + 5, bx + 26]) { rr(ctx, px, by - 0.5, 1.6, 3, 0.5); ctx.fill(); }
    ctx.fillStyle = lin(ctx, 0, by - 8.5, 0, by + 2, ['#2f5cbc', '#1d3f8f', '#14306e']); ctx.strokeStyle = INK; ctx.lineWidth = 0.75;
    rr(ctx, bx - 6, by - 8.5, 44, 10.5, 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; rr(ctx, bx - 5.2, by - 7.8, 42.4, 1.1, 0.55); ctx.fill();
    // EU flag: pole + gently waving flag with a ring of stars
    ctx.fillStyle = lin(ctx, bx + 39.4, 0, bx + 41, 0, ['#e0e0e6', '#8a8a94']); ctx.strokeStyle = INK; ctx.lineWidth = 0.5;
    rr(ctx, bx + 39.4, by - 10, 1.6, 40, 0.8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = rad(ctx, bx + 39.9, by - 11.4, 0.1, bx + 40.2, by - 11, 1.4, ['#fff6c0', '#d4a820']); circ(ctx, bx + 40.2, by - 11, 1.2); ctx.fill(); ctx.stroke();
    const wv = Math.sin(G.t * 3) * 0.9, fx0 = bx + 41, fy0 = by - 10, fw = 13, fh = 9;
    ctx.fillStyle = lin(ctx, fx0, fy0, fx0 + fw, fy0 + fh, ['#3a62c8', '#1d3f8f', '#14306e']); ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(fx0, fy0); ctx.quadraticCurveTo(fx0 + fw / 2, fy0 - wv, fx0 + fw, fy0 + wv * 0.6);
    ctx.lineTo(fx0 + fw, fy0 + fh + wv * 0.6); ctx.quadraticCurveTo(fx0 + fw / 2, fy0 + fh - wv, fx0, fy0 + fh); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffd400';
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; circ(ctx, fx0 + fw / 2 + Math.cos(a) * 2.9, fy0 + fh / 2 + Math.sin(a) * 2.9 - wv * 0.3, 0.42); ctx.fill(); }
    ctx.restore();
  }
  // the parked Ferrari sinking into a soft mud splash (or just parked on the farmyard dirt)
  function drawFerrari(ctx, fx, fy, a, mud) {
    if (mud) {
      ctx.fillStyle = rad(ctx, fx, fy, 2, fx, fy, 22, ['rgba(74,50,28,0.55)', 'rgba(74,50,28,0)']); ell(ctx, fx, fy, 22, 18); ctx.fill();
    }
    G.drawVehicle(ctx, 'ferrari', '#d0161b', fx, fy, a);
    if (mud) for (let i = 0; i < 6; i++) {
      const mx = fx + Math.cos(i * 1.7) * 10, my = fy + Math.sin(i * 2.3) * 8;
      ctx.fillStyle = rad(ctx, mx - 0.4, my - 0.4, 0.1, mx, my, 1.6, ['#7a5636', '#4a3018']); ell(ctx, mx, my, 1.4 + (i % 3) * 0.3, 1); ctx.fill();
    }
  }

  // ---------- the farm on the open-world map ----------
  const isDone = () => !!(G.state && G.state.done && G.state.done.ferrari);
  let npc = null; // idle cast shown on the map before the quest (lady by her Ferrari at the gate, inspector at his booth)
  const npcs = () => npc || (npc = {
    lady: Object.assign(new G.Ent.Person(G.LOOKS.ferrari_lady, LADY0[0], LADY0[1]), { dir: 0 }),
    insp: Object.assign(new G.Ent.Person(INSP_LOOK, INSP0[0], INSP0[1]), { dir: 0 }),
  });
  // sheep grazing on the map: in field A before the quest, in field B after it
  const MAP_SHEEP_A = [[3.5, 15.6], [5.2, 17.1], [6.8, 15.9], [3.2, 18.2], [9.4, 7.6], [4.6, 7.4], [7.6, 12.4], [2.8, 11.6]];
  const MAP_SHEEP_B = [[19.5, 25.8], [21.2, 27.4], [22.4, 24.6], [20.4, 29.1], [24.2, 23.8], [26.6, 22.4], [22.8, 29.3], [18.8, 28]];
  function worldSolid(lx, ly) {
    const a = getA();
    if (a.solidAt(lx, ly)) return true;
    const tx = Math.floor(lx / TS), ty = Math.floor(ly / TS);
    if (tx === GATE_X && ty >= ROAD_Y0 && ty <= ROAD_Y1) return true; // gate A is shut on the map
    const t = TRUCK0(), d = VD('sheeptruck');
    if (Math.abs(lx - t.x) < d.h / 2 + 1 && Math.abs(ly - t.y) < d.w / 2 + 1) return true;
    // (the parked Ferrari is a real world vehicle now: it collides by itself)
    return false;
  }
  G.region({
    id: 'ferrari', tx: SP.tx, ty: SP.ty, w: AW, h: AH, entry: ENTRY, mini: '#c8b070',
    miniDraw(ctx) {
      const a = getA(), C = { Y: '#e2c25a', L: '#9a6c44', r: '#78c850', T: '#3f7a35', g: '#5f9e45', d: '#c8a070', y: '#c8a070', p: '#e8d6a8', m: '#6b4a2b', F: '#8a6038', D: '#c8a070', E: '#c8a070', G: '#8a6038', B: '#e8e4d8', S: '#78c850', h: '#d8b450' };
      for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) { ctx.fillStyle = C[a.get(x, y)] || '#78c850'; ctx.fillRect(x, y, 1, 1); }
    },
    paint(ctx, lx0, ly0, lw, lh) { getA().paint(ctx, lx0, ly0, lw, lh); },
    solid: worldSolid,
    live(ctx, ox, oy) { drawGateA(ctx, ox, oy, 0); drawStile(ctx, ox, oy, true); drawSign(ctx, ox, oy); },
    statics(push, ox, oy) {
      const n = npcs(), done = isDone();
      push(BOOTH[1] + 30, c => drawBooth(c, BOOTH[0] + ox, BOOTH[1] + oy));
      push(INSP0[1], c => n.insp.draw(c, -ox, -oy));
      const t = TRUCK0(); push(t.y + 4, c => G.drawVehicle(c, 'sheeptruck', '#4a6fa5', t.x + ox, t.y + oy, 0));
      (done ? MAP_SHEEP_B : MAP_SHEEP_A).forEach(([sx, sy], i) => push(sy * TS, c => drawAnimal(c, 'sheep', sx * TS + ox, sy * TS + oy, i % 3 === 0, 0)));
      if (done) return;
      // the Ferrari itself is a real parked car in the open world (stealable), see G.FERRARI_PARK
      push(LADY0[1], c => n.lady.draw(c, -ox, -oy));
      push(DOG0[1], c => drawAnimal(c, 'dog', DOG0[0] + ox, DOG0[1] + oy, true, 0));
    },
  });

  // ---------- quest ----------
  const def = G.quest({
    id: 'ferrari', title: 'Η Ferrari και τα πρόβατα', short: 'Ferrari', col: '#ff3e8a', reward: 300,
    hidden: () => Object.keys(G.state.done).length >= 1,
    start: () => G.push(def.make()), // you drove here yourself on the εθνική: the quest starts at the farm gate
    make: () => G.MiniGame({
      id: 'ferrari', title: 'Η FERRARI ΚΑΙ ΤΑ ΠΡΟΒΑΤΑ', reward: 300,
      // back on the map: where the player stands (herding) / next to the truck (after the drive), else the entry tile
      exitTo() {
        const ok = (lx, ly) => lx > 4 && ly > 4 && lx < AW * TS - 4 && ly < AH * TS - 4 && !worldSolid(lx, ly)
          && Wd.walkable(SP.tx + Math.floor(lx / TS), SP.ty + Math.floor(ly / TS))
          && ![[-4, -3], [4, -3], [-4, 2], [4, 2]].some(([dx, dy]) => Wd.solidAt(OX + lx + dx, OY + ly + dy) || worldSolid(lx + dx, ly + dy));
        const c = [];
        if (this.stage === 'herd' && this.player) c.push([this.player.x, this.player.y]);
        else if (this.truck) { const v = this.truck; c.push([v.x + Math.cos(v.a + Math.PI / 2) * (v.wid / 2 + 10), v.y + Math.sin(v.a + Math.PI / 2) * (v.wid / 2 + 10)], [v.x - Math.cos(v.a + Math.PI / 2) * (v.wid / 2 + 10), v.y - Math.sin(v.a + Math.PI / 2) * (v.wid / 2 + 10)]); }
        for (const [lx, ly] of c) if (ok(lx, ly)) return [OX + lx, OY + ly];
        return [OX + ENTRY[0] * TS + 8, OY + ENTRY[1] * TS + 10];
      },
      intro: {
        pc: 'Μια κόκκινη Ferrari παρκάρει στη λάσπη. «Κούκλε, θέλω βοήθεια με κάτι αγροτικές δουλειές. Έρχεται ο ελεγκτής του ΟΠΕΚΕΠΕ και τα πρόβατα πρέπει να μετρηθούν στο άλλο χωράφι.» «Δικά σας είναι;» «Από σήμερα ναι.»\nΜπες στο χωράφι από την κόκκινη πορτούλα. WASD: σπρώξε τα πρόβατα προς τη ράμπα, ανεβαίνουν μόνα τους · E: φύγαμε\nΟδήγηση: τα βελάκια δείχνουν πού πάει το φορτηγό, SPACE φρένο. Λακκούβες και τρακαρίσματα ρίχνουν πρόβατα!',
        mobile: 'Μια κόκκινη Ferrari παρκάρει στη λάσπη. «Κούκλε, θέλω βοήθεια με κάτι αγροτικές δουλειές. Έρχεται ο ελεγκτής του ΟΠΕΚΕΠΕ και τα πρόβατα πρέπει να μετρηθούν στο άλλο χωράφι.» «Δικά σας είναι;» «Από σήμερα ναι.»\nΜπες στο χωράφι από την κόκκινη πορτούλα. Joystick: σπρώξε τα πρόβατα προς τη ράμπα, ανεβαίνουν μόνα τους · ΦΥΓΑΜΕ\nΟδήγηση: το φορτηγό πάει όπου δείχνει το joystick, άφησέ το για φρένο. Οι λακκούβες ρίχνουν πρόβατα!',
      },
      buttons() {
        if (this.stage === 'herd') {
          const b = [{ id: 'action', label: 'ΦΟΡΤΩΣΕ' }];
          if (this.nearCab && this.loadedN() > 0) b.push({ id: 'enter', label: 'ΦΥΓΑΜΕ' });
          return b;
        }
        return [];
      },
      stick: 'stick',

      init() {
        getA();
        this.stage = 'herd'; this.gateOpen = false; this.gateT = 0; this.loadFx = 0; this.baaCd = 0; this.crashCd = 0; this.bounce = 0; this.roughT = 0;
        this.dropped = 0; this.saidFall = false; this.q = {}; this.nearCab = false; this.nearRamp = false;
        // truck parked inside field A, nose at the gate, ramp behind it (same spot as on the map)
        const t0 = TRUCK0();
        this.truck = new G.Ent.Vehicle('sheeptruck', t0.x, t0.y, 0, '#4a6fa5');
        this.truck.solidFn = (px, py) => this.solid(px, py, true);
        this.fer = { kind: 'veh', x: FER0.x, y: FER0.y, a: FER0.a, parked: true, inMud: false, path: null, i: 0 };
        // the player starts exactly where he stood on the map (the entry tile at the top, under the εθνική)
        let px = ENTRY[0] * TS + 8, py = ENTRY[1] * TS + 10;
        const P = G.player;
        if (P && P.x != null) {
          const lx = G.clamp(P.x - OX, 6, AW * TS - 6), ly = G.clamp(P.y - OY, 6, AH * TS - 6);
          if (!this.solid(lx, ly, false) && !this.solid(lx - 3, ly - 2, false) && !this.solid(lx + 3, ly + 1, false)) { px = lx; py = ly; }
        }
        this.player = new G.Ent.Person(G.state.look, px, py); this.player.speed = 66; this.player.dir = 0;
        this.player.solidFn = (x, y) => this.solid(x, y, false);
        // the lady waits by her Ferrari at the farm gate
        this.lady = new G.Ent.Person(G.LOOKS.ferrari_lady, LADY0[0], LADY0[1]); this.lady.hidden = false;
        this.dog = { kind: 'veh', x: DOG0[0], y: DOG0[1], ax: DOG0[0], ay: DOG0[1], faceL: true, frame: 0, anim: 0, hidden: false, run: false };
        this.insp = new G.Ent.Person(INSP_LOOK, INSP0[0], INSP0[1]); this.insp.dir = 0;
        // first frame = the world's frame (camera in region-local px)
        this.cam = { x: (WS.camX || 0) - OX, y: (WS.camY || 0) - OY }; camClamp(this.cam);
        this.camX = Math.round(this.cam.x); this.camY = Math.round(this.cam.y);
        // sheep (bottom of field A)
        this.sheep = [];
        const sol = (x, y) => this.solid(x, y, false, true);
        while (this.sheep.length < NSHEEP) {
          const x = G.rand(2.6, 7.6) * TS, y = G.rand(15.4, 18.6) * TS;
          if (sol(x - 5, y) || sol(x + 5, y)) continue;
          this.sheep.push({ kind: 'veh', x, y, vx: 0, vy: 0, st: 'field', faceL: G.chance(0.5), frame: 0, anim: 0, wt: G.rand(0, 2), wa: null, t: 0 });
        }
        // potholes on the farm road
        this.holes = [];
        const road = [];
        for (let ty = ROAD_Y0; ty < BY0; ty++) for (let tx = GATE_X + 3; tx <= RX1; tx++) if (A.get(tx, ty) === 'd') road.push([tx, ty]);
        let guard = 0;
        while (this.holes.length < 10 && guard++ < 500) {
          const [tx, ty] = G.pick(road); const x = tx * TS + 8 + G.rand(-5, 5), y = ty * TS + 8 + G.rand(-5, 5);
          if (this.holes.some(h => G.dist(h.x, h.y, x, y) < 24)) continue;
          this.holes.push({ x, y, r: G.rand(4, 6.5), cd: 0 });
        }
        // stray goats by the road
        const free = (x, y) => { // nudge a spawn point off trees / hay bales
          for (let k = 0; k < 40; k++) { const a = k * 2.4, d = k * 3, nx = x + Math.cos(a) * d, ny = y + Math.sin(a) * d; if (![[-5, -1], [5, -1], [-5, 1], [5, 1]].some(([ox, oy]) => this.solid(nx + ox, ny + oy, true, true))) return [nx, ny]; }
          return [x, y];
        };
        this.goats = [[16.5 * TS, 15.5 * TS], [21.5 * TS, 7.5 * TS], [27.5 * TS, 15.5 * TS]].map(p => free(p[0], p[1])).map(([x, y]) => ({ kind: 'veh', x, y, hx: x, hy: y, vx: 0, vy: 0, kt: 0, faceL: G.chance(0.5), frame: 0, anim: 0, wt: 0, wa: null }));
      },

      onStart() {
        G.audio.music('music_ferrari', 118);
        this.say('ferrari_hi', 'Γεια σου κούκλε! Θέλω βοήθεια με κάτι… αγροτικές δουλειές.', this.lady, 3);
      },

      // ---------- helpers ----------
      loadedN() { return this.sheep.filter(s => s.st === 'loaded').length; },
      // a sheep near the ramp walks up into the truck by itself (small animation), then it counts
      board(s) {
        if (s.st !== 'field') return;
        s.st = 'board'; s.bt = 0; s.bx = s.x; s.by = s.y; s.lift = 0; s.vx = 0; s.vy = 0;
      },
      updBoard(dt) {
        const v = this.truck, ramp = this.rampPos();
        const bed = [v.x - Math.cos(v.a) * (v.len / 2 - 8), v.y - Math.sin(v.a) * (v.len / 2 - 8)];
        for (const s of this.sheep) {
          if (s.st !== 'board') continue;
          s.bt += dt;
          const px = s.x;
          if (s.bt < BOARD_T1) { const k = s.bt / BOARD_T1; s.x = s.bx + (ramp[0] - s.bx) * k; s.y = s.by + (ramp[1] - s.by) * k; s.lift = 0; }
          else { const k = Math.min(1, (s.bt - BOARD_T1) / (BOARD_T2 - BOARD_T1)); s.x = ramp[0] + (bed[0] - ramp[0]) * k; s.y = ramp[1] + (bed[1] - ramp[1]) * k; s.lift = k * 7; }
          if (Math.abs(s.x - px) > 0.01) s.faceL = s.x < px;
          s.anim = (s.anim || 0) + dt * 9; s.frame = Math.floor(s.anim) % 2;
          if (s.bt >= BOARD_T2) {
            s.st = 'loaded'; s.lift = 0; this.loadFx = 0.8;
            const n = this.loadedN();
            G.audio.sfx('good'); this.baa(s, true);
            if (n < NSHEEP) G.ui.toast('Ανέβηκε! ' + n + '/' + NSHEEP + ' στο φορτηγό', 1.4);
          }
        }
      },
      // inside field A (the player has come through the little gate)
      inFieldA(x, y) { return x > TS + 8 && x < GATE_X * TS + 8 && y > 5 * TS + 8 && y < 19 * TS + 8; },
      rampPos() { const v = this.truck; return [v.x - Math.cos(v.a) * (v.len / 2 + 9), v.y - Math.sin(v.a) * (v.len / 2 + 9)]; },
      solid(px, py, forTruck, animal) {
        if (A.solidAt(px, py)) return true;
        const tx = Math.floor(px / TS), ty = Math.floor(py / TS);
        if (!this.gateOpen && tx === GATE_X && ty >= ROAD_Y0 && ty <= ROAD_Y1) return true;
        if ((animal || forTruck) && tx === STILE[0] && ty === STILE[1]) return true; // the stile: people only
        if (!forTruck) {
          const v = this.truck;
          if (this.stage === 'herd' && Math.abs(px - v.x) < v.len / 2 + 1 && Math.abs(py - v.y) < v.wid / 2 + 1) return true;
          if (this.fer.parked && G.dist(px, py, this.fer.x, this.fer.y) < VD('ferrari').h / 2 - 4) return true;
        }
        return false;
      },
      baa(s, force) {
        if (this.baaCd > 0 && !force) return;
        this.baaCd = 0.45; G.audio.sfx('baa'); G.ui.bubble(G.pick(BAAS), s, 1.1);
      },

      // ---------- update ----------
      update(dt) {
        this.baaCd -= dt; this.crashCd -= dt; this.bounce = Math.max(0, this.bounce - dt); this.loadFx = Math.max(0, this.loadFx - dt);
        if (this.gateOpen) this.gateT = Math.min(1, this.gateT + dt * 1.6); // the gate swings open
        if (this.stage === 'herd') this.updHerd(dt);
        else if (this.stage === 'drive') { this.updDrive(dt); const t = this.truck; G.audio.engines(t.x, t.y, [t], t); }
        else if (this.stage === 'count') this.updCount(dt);
        if (this.phase !== 'play') return;
        this.updFerrari(dt);
        this.updDog(dt);
        // camera
        const v = this.truck;
        let fx, fy;
        if (this.stage === 'herd') { fx = this.player.x; fy = this.player.y; }
        else if (this.stage === 'drive') { fx = v.x + v.vx * 0.35; fy = v.y + v.vy * 0.35; }
        else { fx = (v.x + this.insp.x + this.lady.x) / 3; fy = (v.y + this.insp.y + this.lady.y) / 3; }
        const k = Math.min(1, dt * 5);
        this.cam.x += (fx - G.W / 2 - this.cam.x) * k; this.cam.y += (fy - G.H / 2 - this.cam.y) * k;
        camClamp(this.cam);
      },

      updHerd(dt) {
        const pl = this.player, v = this.truck, ax = G.readAxis();
        let mx = ax.x, my = ax.y; const m = Math.hypot(mx, my); if (m > 1) { mx /= m; my /= m; }
        pl.move(mx * pl.speed, my * pl.speed, dt);
        const solidS = (x, y) => this.solid(x, y, false, true);
        const field = this.sheep.filter(s => s.st === 'field');
        const ramp = this.rampPos();
        // forgiving herding: a sheep walks straight away from you, and whenever "away" is roughly towards the truck
        // it bends onto the ramp; sheep already near the ramp drift onto it by themselves; almost no random wandering
        for (const s of field) {
          let dx = 0, dy = 0, spd = 0;
          const d = G.dist(s.x, s.y, pl.x, pl.y) || 1, FR = 62;
          const rd = G.dist(s.x, s.y, ramp[0], ramp[1]) || 1, rx = (ramp[0] - s.x) / rd, ry = (ramp[1] - s.y) / rd;
          if (d < FR) {
            const fx = (s.x - pl.x) / d, fy = (s.y - pl.y) / d, dot = fx * rx + fy * ry;
            const pull = dot > -0.35 ? 0.7 + Math.max(0, dot) * 1.6 : 0.3; // always a little pull towards the ramp (gets them out of corners)
            dx = fx + rx * pull; dy = fy + ry * pull;
            spd = 30 + (1 - d / FR) * 22;
            if (!s.scared) { s.scared = true; if (G.chance(0.3)) this.baa(s); }
          } else {
            s.scared = false;
            if (rd < 80) { dx = rx; dy = ry; spd = 16; }                 // close to the ramp: they go up on their own
            else {
              s.wt -= dt; if (s.wt < 0) { s.wt = G.rand(2, 5); s.wa = G.chance(0.6) ? null : G.rand(0, 6.28); }
              if (s.wa != null) { dx = Math.cos(s.wa); dy = Math.sin(s.wa); spd = 6; }
            }
          }
          for (const o of field) if (o !== s) { const e = G.dist(s.x, s.y, o.x, o.y); if (e < 10 && e > 0) { dx += (s.x - o.x) / e * 0.3; dy += (s.y - o.y) / e * 0.3; } }
          const L = Math.hypot(dx, dy);
          let ux = L > 0.05 ? dx / L : 0, uy = L > 0.05 ? dy / L : 0;
          // pinned in a corner / against a fence: slip out towards the ramp (or along the fence) for a moment
          if (s.stuck > 0.25 && spd > 0) {
            const free = (a, b) => !solidS(s.x + a * 9 - 5, s.y + b * 9) && !solidS(s.x + a * 9 + 5, s.y + b * 9) && !solidS(s.x + a * 9, s.y + b * 9 - 2);
            const c = [[rx, ry], [-ry, rx], [ry, -rx]].find(([a, b]) => free(a, b)); if (c) { s.esc = 0.9; s.ex = c[0]; s.ey = c[1]; } s.stuck = 0;
          }
          if (s.esc > 0) { s.esc -= dt; ux = s.ex; uy = s.ey; spd = Math.max(spd, 28); }
          const k = Math.min(1, dt * 6); s.vx += (ux * spd - s.vx) * k; s.vy += (uy * spd - s.vy) * k;
          const ox = s.x, oy = s.y, want = Math.hypot(s.vx, s.vy) * dt;
          amove(s, s.vx, s.vy, dt, solidS);
          if (spd > 0 && want > 0.05 && G.dist(ox, oy, s.x, s.y) < want * 0.3) s.stuck = (s.stuck || 0) + dt; else s.stuck = Math.max(0, (s.stuck || 0) - dt * 0.5);
          if (G.dist(s.x, s.y, ramp[0], ramp[1]) < LOAD_R) this.board(s); // close enough: walks up the ramp by itself
        }
        this.updBoard(dt);
        // lady: stays by her Ferrari, looks at you, drops lines
        const la = Math.atan2(pl.y - this.lady.y, pl.x - this.lady.x);
        this.lady.move(0, 0, dt); this.lady.dir = Math.abs(Math.cos(la)) > Math.abs(Math.sin(la)) ? (Math.cos(la) > 0 ? 2 : 1) : (Math.sin(la) > 0 ? 0 : 3);
        if (!this.q.herd && this.pt > 4) { this.q.herd = 1; this.say('ferrari_herd', 'Βάλ\' τα στο φορτηγό, χρυσό μου! Εγώ λάσπη δεν πατάω, είναι Gucci.', this.lady, 3.2); }
        if (!this.q.why && this.pt > 17) { this.q.why = 1; this.say('ferrari_why', 'Τα πρόβατα θα μετρηθούν στο άλλο χωράφι. Εκεί τα έχω δηλώσει.', this.lady, 3.4); }
        if (!this.q.own && this.pt > 32) { this.q.own = 1; this.say('ferrari_own', 'Το χωράφι το δήλωσα… απλώς δεν είναι δικό μου.', this.lady, 3.2); }

        // loading (automatic; SPACE / ΦΟΡΤΩΣΕ still calls the ones standing around the ramp)
        this.nearRamp = G.dist(pl.x, pl.y - 4, ramp[0], ramp[1]) < 44;
        this.nearCab = G.dist(pl.x, pl.y, v.x, v.y) < v.len / 2 + 14;
        if (G.pressed('action')) {
          if (this.nearRamp) {
            let n = 0;
            for (const s of this.sheep) if (s.st === 'field' && G.dist(s.x, s.y, ramp[0], ramp[1]) < 64) { this.board(s); n++; }
            if (!n) G.ui.toast('Κανένα πρόβατο κοντά. Σπρώξ\' τα προς τη ράμπα!', 2);
          } else G.ui.toast('Η ράμπα είναι πίσω από το φορτηγό (κίτρινος κύκλος).', 2);
        }
        const left = this.sheep.filter(s => s.st === 'field' || s.st === 'board').length;
        if (!left) { G.ui.toast('Όλα μέσα! Φύγαμε!', 2); this.startDrive(); return; }
        if (this.nearCab && this.loadedN() > 0 && G.pressed('enter')) this.startDrive();
      },

      startDrive() {
        this.stage = 'drive'; this.gateOpen = true; this.gateT = 0;
        for (const s of this.sheep) { if (s.st === 'board') { s.st = 'loaded'; s.lift = 0; } else if (s.st === 'field') s.st = 'left'; }
        G.audio.sfx('door');
        const f = this.fer; f.parked = false; f.i = 0;
        // from the farmyard down the track, along the farm road, into field B
        const yR = (ROAD_Y0 + ROAD_Y1 + 1) / 2 * TS, xM = (RX0 + RX1 + 1) / 2 * TS;
        f.path = [[19 * TS, 5 * TS], [19 * TS, yR - 6], [xM - 6, yR], [xM, yR + 10], [xM, (BY0 + 2) * TS], PARK];
        this.lady.hidden = true; this.dog.hidden = true;
        this.say('ferrari_go', 'Σε περιμένω στο άλλο χωράφι! Πρόσεχε τις λακκούβες, είναι ΕΣΠΑ.', f, 3);
      },

      updFerrari(dt) {
        const f = this.fer; if (f.parked || !f.path) return;
        const [tx, ty] = f.path[f.i]; const d = G.dist(f.x, f.y, tx, ty);
        const ta = Math.atan2(ty - f.y, tx - f.x); f.a += G.angleDiff(f.a, ta) * Math.min(1, dt * 10);
        const st = 190 * dt;
        if (d <= st) { f.x = tx; f.y = ty; f.i++; if (f.i >= f.path.length) this.parkFerrari(); }
        else { f.x += Math.cos(ta) * st; f.y += Math.sin(ta) * st; }
      },
      parkFerrari() {
        const f = this.fer;
        f.x = PARK[0]; f.y = PARK[1]; f.a = 2.5; f.parked = true; f.inMud = true; f.path = null;
        this.lady.hidden = false; this.lady.x = f.x - 30; this.lady.y = f.y + 26; this.lady.dir = 0;
        const dg = this.dog; dg.hidden = false; dg.x = dg.ax = this.lady.x + 14; dg.y = dg.ay = this.lady.y + 2;
      },
      updDog(dt) {
        const dg = this.dog; if (dg.hidden) return;
        const sol = (x, y) => this.solid(x, y, true, true);
        if (dg.run) {
          const d = G.dist(dg.x, dg.y, dg.tx, dg.ty);
          if (d > 3) amove(dg, (dg.tx - dg.x) / d * 60, (dg.ty - dg.y) / d * 60, dt, sol);
          else { dg.frame = 0; dg.faceL = dg.x > this.insp.x; }
          return;
        }
        const da = G.dist(dg.x, dg.y, dg.ax, dg.ay);
        if (da > 18) amove(dg, (dg.ax - dg.x) / da * 20, (dg.ay - dg.y) / da * 20, dt, sol);
        else graze(dg, dt, sol, 12);
      },

      updDrive(dt) {
        const v = this.truck, mx = v.spec.max, ax = G.readAxis();
        // GTA-1 style: the truck goes where the arrows / stick point
        const pre = Math.abs(v.speed);
        G.driveDirect(v, dt, ax, G.held('action') && G.device === 'pc');
        const hit = Math.abs(v.speed) < pre * 0.75; // blocked by a wall/fence/tree
        if (hit && pre > mx * 0.45 && this.crashCd <= 0) {
          this.crashCd = 0.8; G.audio.sfx('crash'); G.ui.shake(4); this.bounce = 0.4;
          this.drop(pre > mx * 0.8 ? 2 : 1);
        }
        const sp = Math.abs(v.speed);
        // rough ground off the road
        const tile = A.get(Math.floor(v.x / TS), Math.floor(v.y / TS));
        if (tile === 'r' || tile === 'm' || tile === 'Y' || tile === 'L') {
          if (sp > mx * 0.45) v.speed *= Math.pow(0.25, dt);
          this.roughT += dt * sp / 60;
          if (this.roughT > 1.4) { this.roughT = 0; G.ui.shake(1.5); this.bounce = 0.25; if (sp > mx * 0.4 && G.chance(0.25)) this.drop(1); }
        }
        // potholes
        for (const h of this.holes) {
          h.cd -= dt; if (h.cd > 0) continue;
          if (G.dist(v.x, v.y, h.x, h.y) < h.r + 7) {
            h.cd = 1;
            if (sp > mx * 0.28) {
              G.ui.shake(sp > mx * 0.6 ? 4 : 2); G.audio.sfx('hit'); this.bounce = 0.35; v.speed *= 0.8;
              if (G.chance(G.clamp((sp / mx - 0.35) / 0.6, 0, 0.85))) this.drop(1);
            }
          }
        }
        // stray goats
        const solA = (x, y) => this.solid(x, y, true);
        for (const g of this.goats) {
          if (g.kt > 0) { g.kt -= dt; amove(g, g.vx, g.vy, dt, solA); g.vx *= Math.pow(0.1, dt); g.vy *= Math.pow(0.1, dt); continue; }
          const dv = G.dist(g.x, g.y, v.x, v.y) || 1;
          if (dv < 50 && sp > 10) { amove(g, (g.x - v.x) / dv * 24, (g.y - v.y) / dv * 24, dt, solA); }
          else {
            const dh = G.dist(g.x, g.y, g.hx, g.hy);
            if (dh > 40) amove(g, (g.hx - g.x) / dh * 10, (g.hy - g.y) / dh * 10, dt, solA); else graze(g, dt, solA, 10);
          }
          if (dv < v.wid / 2 + 8) {
            if (sp > mx * 0.3 && this.crashCd <= 0) {
              this.crashCd = 0.8; G.audio.sfx('crash'); G.ui.shake(4); this.bounce = 0.4;
              g.kt = 1.2; g.vx = Math.cos(v.a) * 90 + (g.x - v.x) / dv * 40; g.vy = Math.sin(v.a) * 90 + (g.y - v.y) / dv * 40;
              G.ui.bubble('ΜΕΕΕΕ!', g, 1.2); v.speed *= 0.4; this.drop(1);
            } else { g.x += (g.x - v.x) / dv * 1.5; g.y += (g.y - v.y) / dv * 1.5; }
          }
        }
        // sheep that fell out / ran away / stayed behind
        for (const s of this.sheep) {
          if (s.st === 'fallen') {
            s.t += dt;
            if (s.t < 1.3) amove(s, s.vx, s.vy, dt, solA); else graze(s, dt, solA, 6);
            if (s.t > 0.6 && sp < mx * 0.22 && G.dist(s.x, s.y, v.x, v.y) < v.len / 2 + 14) {
              s.st = 'loaded'; this.baa(s, true); G.ui.toast('Ξαναμπήκε στην καρότσα!', 1.6);
            } else if (s.t > 10) {
              s.st = 'lost'; s.t = 0; s.vx = Math.cos(s.ra) * 70; s.vy = Math.sin(s.ra) * 70;
              G.ui.toast('Ένα πρόβατο το έσκασε για τα βουνά.', 2.2);
            }
          } else if (s.st === 'lost') { s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.faceL = s.vx < 0; s.anim += dt * 8; s.frame = Math.floor(s.anim) % 2; if (s.t > 1.8) s.st = 'gone'; }
          else if (s.st === 'left') graze(s, dt, (x, y) => this.solid(x, y, false, true));
        }
        // empty truck → fail
        if (!this.sheep.some(s => s.st === 'loaded' || s.st === 'fallen')) {
          this.lose('Η καρότσα άδειασε. Επιδότηση: μηδέν.'); return;
        }
        // arrival at field B
        const z = this.zone();
        if (G.dist(v.x, v.y, z[0], z[1]) < 30 && sp < mx * 0.35) this.startCount();
      },
      zone() { return [(RX0 + RX1 + 1) / 2 * TS, (BY0 + 2.5) * TS]; },

      drop(n) {
        const v = this.truck;
        for (let i = 0; i < n; i++) {
          const s = this.sheep.find(s => s.st === 'loaded'); if (!s) break;
          s.st = 'fallen'; s.t = 0;
          s.x = v.x - Math.cos(v.a) * (v.len / 2 + 4) + G.rand(-3, 3); s.y = v.y - Math.sin(v.a) * (v.len / 2 + 4) + 4;
          const a = v.a + Math.PI / 2 * (G.chance(0.5) ? 1 : -1) + G.rand(-0.5, 0.5);
          s.ra = a; s.vx = Math.cos(a) * 55; s.vy = Math.sin(a) * 55; s.anim = 0;
          this.baa(s, true); this.dropped++;
        }
        if (!this.saidFall) {
          this.saidFall = true;
          this.say('ferrari_fall', 'Μην τα ρίχνεις! Κάθε πρόβατο είναι σαράντα ευρώ!', null, 3);
          G.ui.toast('Σταμάτα δίπλα στο πρόβατο για να ξαναμπεί!', 3);
        }
      },

      startCount() {
        const v = this.truck;
        this.stage = 'count'; this.ct = 0; this.ci = 0; this.cf = {};
        v.speed = 0; v.vx = 0; v.vy = 0;
        for (const s of this.sheep) if (s.st === 'fallen') { s.st = 'lost'; s.t = 0; s.vx = Math.cos(s.ra || 0) * 70; s.vy = Math.sin(s.ra || 0) * 70; }
        if (!this.fer.parked) this.parkFerrari();
        this.cnt = this.sheep.filter(s => s.st === 'loaded');
        this.lady.dir = 0; this.insp.dir = 2;
        this.say('ferrari_insp_start', 'Έλεγχος ΟΠΕΚΕΠΕ! Για να μετρήσουμε…', this.insp, 2.6);
      },
      updCount(dt) {
        const v = this.truck, n = this.cnt.length, T0 = 1.8, STEP = 0.7;
        this.ct += dt;
        const solB = (x, y) => this.solid(x, y, true);
        while (this.ci < n && this.ct > T0 + this.ci * STEP) {
          const s = this.cnt[this.ci];
          s.st = 'safe'; s.x = v.x - Math.cos(v.a) * (v.len / 2 + 6); s.y = v.y - Math.sin(v.a) * (v.len / 2 + 6) + 4;
          if (solB(s.x, s.y)) { s.x = v.x; s.y = v.y + v.wid / 2 + 6; }
          s.tx = G.rand(BX0 + 1.5, BX1 - 0.5) * TS; s.ty = G.rand(BY0 + 1.5, BY1 - 0.7) * TS;
          this.ci++;
          G.ui.bubble(NUMS[this.ci - 1] + '!', this.insp, 0.8); G.audio.sfx('blip');
          if (this.ci === 1 || G.chance(0.3)) this.baa(s);
        }
        for (const s of this.sheep) {
          if (s.st === 'safe') { const d = G.dist(s.x, s.y, s.tx, s.ty); if (d > 4 && !s.arrived) amove(s, (s.tx - s.x) / d * 32, (s.ty - s.y) / d * 32, dt, solB); else { s.arrived = true; graze(s, dt, solB, 6); } }
          else if (s.st === 'lost') { s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt; if (s.t > 1.8) s.st = 'gone'; }
          else if (s.st === 'left') graze(s, dt, (x, y) => this.solid(x, y, false, true));
        }
        const tEnd = T0 + n * STEP;
        if (!this.cf.dog && this.ct > tEnd + 0.3) {
          this.cf.dog = 1; const dg = this.dog; dg.run = true; dg.tx = this.insp.x + 22; dg.ty = this.insp.y + 4; G.audio.sfx('bark');
        }
        if (!this.cf.dogc && this.ct > tEnd + 1.7) { this.cf.dogc = 1; G.ui.bubble(NUMS[n] + '!', this.insp, 1); G.audio.sfx('blip'); }
        if (!this.cf.dogl && this.ct > tEnd + 2.8) { this.cf.dogl = 1; this.say('ferrari_insp_dog', '…κι αυτό με τον φιόγκο. Γαβγίζει, αλλά πρόβατο. Το γράφω.', this.insp, 3); }
        if (!this.cf.lw && this.ct > tEnd + 5.8) { this.cf.lw = 1; this.say('ferrari_win', 'Τέλεια! Του χρόνου δηλώνουμε και τη Ferrari για τρακτέρ.', this.lady, 3); }
        if (this.ct > tEnd + 8.6) {
          const paid = n + 1;
          this.win('Ο ελεγκτής μέτρησε ' + paid + ' πρόβατα (το ένα γαβγίζει).', paid * PAY);
        }
      },

      // ---------- render ----------
      render(ctx) {
        const [shx, shy] = G.ui.shakeOffset();
        const camX = Math.round(this.cam.x + shx), camY = Math.round(this.cam.y + shy);
        this.camX = camX; this.camY = camY;
        ctx.fillStyle = '#78c850'; ctx.fillRect(0, 0, G.W, G.H);
        A.draw(ctx, camX, camY); // the world map around + this region (same painter as on the map)
        ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        // potholes: displaced dirt rim, dark hole lit on the lower-right wall, muddy water with a soft moving glint
        for (const h of this.holes) {
          const x = h.x - camX, y = h.y - camY, r = h.r; if (x < -10 || y < -10 || x > G.W + 10 || y > G.H + 10) continue;
          ctx.fillStyle = 'rgba(96,66,36,0.45)'; ell(ctx, x + 0.4, y + 0.5, r + 2.2, r * 0.7 + 2); ctx.fill();
          ctx.fillStyle = rad(ctx, x - r * 0.35, y - r * 0.3, 0.3, x, y, r + 1, ['#22160c', '#3a281a', '#7a5a3a']);
          ell(ctx, x, y, r, r * 0.7); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.6; ctx.stroke();
          ctx.fillStyle = lin(ctx, x - r, y, x + r, y + r, ['rgba(90,112,128,0.75)', 'rgba(60,78,92,0.75)']); ell(ctx, x + r * 0.12, y + r * 0.14, r * 0.62, r * 0.38); ctx.fill();
          ctx.strokeStyle = 'rgba(230,240,255,' + (0.35 + Math.sin(G.t * 2.2 + h.x * 0.1) * 0.2).toFixed(3) + ')'; ctx.lineWidth = 0.6;
          ctx.beginPath(); ctx.ellipse(x + r * 0.12, y + r * 0.14, r * 0.42, r * 0.22, 0, Math.PI * 1.1, Math.PI * 1.65); ctx.stroke();
        }
        // unload zone
        if (this.stage !== 'herd') {
          const [zx, zy] = this.zone(), a = 0.35 + Math.sin(G.t * 5) * 0.15;
          ctx.fillStyle = 'rgba(255,212,0,' + (a * 0.3).toFixed(3) + ')'; ell(ctx, zx - camX, zy - camY, 30, 18); ctx.fill();
          ctx.globalAlpha = a; ctx.strokeStyle = '#ffd400'; ctx.lineWidth = 1.6; ctx.stroke(); ctx.globalAlpha = 1;
        }
        drawGateA(ctx, -camX, -camY, this.gateOpen ? this.gateT : 0);
        drawStile(ctx, -camX, -camY);
        // ramp
        if (this.stage === 'herd') {
          const [rx, ry] = this.rampPos(), v = this.truck;
          const x = Math.round(rx - camX), y = Math.round(ry - camY), hw = Math.round(v.wid / 2) - 2;
          // loading zone: any sheep inside the yellow circle walks up by itself
          const p = 0.5 + Math.sin(G.t * 4) * 0.5;
          ctx.fillStyle = rad(ctx, x - 4, y, 0, x - 4, y, LOAD_R + 4, ['rgba(255,212,0,0.32)', 'rgba(255,212,0,0.14)', 'rgba(255,212,0,0)']);
          ell(ctx, x - 4, y, LOAD_R + 4, (LOAD_R + 4) * 0.7); ctx.fill();
          ctx.save(); ctx.setLineDash([4, 3]); ctx.lineDashOffset = -G.t * 8; ctx.globalAlpha = 0.55 + p * 0.4;
          ctx.strokeStyle = '#ffd400'; ctx.lineWidth = 1.3; ell(ctx, x - 4, y, LOAD_R, LOAD_R * 0.7); ctx.stroke(); ctx.restore();
          // chevrons on the ground pointing up the ramp into the truck
          ctx.fillStyle = 'rgba(255,212,0,' + (0.45 + p * 0.4).toFixed(3) + ')';
          for (let i = 0; i < 3; i++) { const cx0 = x - 30 + i * 7 + ((G.t * 10) % 7); ctx.beginPath(); ctx.moveTo(cx0, y - 4); ctx.lineTo(cx0 + 4, y); ctx.lineTo(cx0, y + 4); ctx.lineTo(cx0 + 1.6, y); ctx.closePath(); ctx.fill(); }
          ctx.fillStyle = SHADOW; rr(ctx, x - 9 + 2.5, y - hw + 3, 18, hw * 2, 2); ctx.fill();
          ctx.fillStyle = lin(ctx, x - 9, 0, x + 9, 0, ['#6a4a2c', '#9a7048', '#b88a58']); ctx.strokeStyle = INK; ctx.lineWidth = 0.75;
          rr(ctx, x - 9, y - hw, 18, hw * 2, 2); ctx.fill(); ctx.stroke();
          ctx.strokeStyle = 'rgba(50,30,14,0.5)'; ctx.lineWidth = 0.7;
          for (let i = 0; i < 5; i++) { const sx = x - 7 + i * 3.6; ctx.beginPath(); ctx.moveTo(sx, y - hw + 1.2); ctx.lineTo(sx, y + hw - 1.2); ctx.stroke(); }
          ctx.fillStyle = 'rgba(255,240,200,0.22)'; rr(ctx, x - 8.2, y - hw + 0.8, 16.4, 1.6, 0.8); ctx.fill();
          ctx.fillStyle = 'rgba(30,18,8,0.25)'; rr(ctx, x - 8.2, y + hw - 2.4, 16.4, 1.6, 0.8); ctx.fill();
          ctx.globalAlpha = 0.55 + p * 0.45; ctx.strokeStyle = '#ffd400'; ctx.lineWidth = this.loadFx > 0 ? 2 : 1.3; rr(ctx, x - 10, y - hw - 1, 20, hw * 2 + 2, 2.6); ctx.stroke(); ctx.globalAlpha = 1;
        }
        // markers: the little gate while you're outside field A, the ramp once you're in, gate A while the truck drives out
        if (this.stage === 'herd') {
          if (!this.inFieldA(this.player.x, this.player.y)) drawMarker(ctx, STILE[0] * TS + 8 - camX, STILE[1] * TS + 8 - camY);
          else if (G.dist(this.player.x, this.player.y, ...this.rampPos()) > 70) { const [rx, ry] = this.rampPos(); drawMarker(ctx, rx - camX, ry - camY); }
        } else if (this.stage === 'drive' && this.truck.x < (GATE_X + 2) * TS) drawMarker(ctx, GATE_X * TS + 8 - camX, (ROAD_Y0 + ROAD_Y1 + 1) / 2 * TS - camY);
        drawSign(ctx, -camX, -camY);
        ctx.restore();

        const L = [];
        const push = (y, f) => L.push({ y, f });
        { const ws = []; Wd.visibleStatics(camX + OX, camY + OY, ws); for (const o of ws) push(o.y - OY, () => o.draw(ctx)); }
        for (const s of this.sheep) {
          if (s.st === 'loaded' || s.st === 'gone') continue;
          const up = s.st === 'board' && s.bt > BOARD_T1; // on the ramp: drawn over the truck's tailgate, fades into the bed
          push(up ? this.truck.y + 5 : s.y, () => {
            const al = s.st === 'lost' ? Math.max(0, 1 - s.t / 1.8) : s.st === 'board' ? G.clamp((BOARD_T2 - s.bt) / 0.2, 0, 1) : null;
            drawAnimal(ctx, 'sheep', s.x - camX, s.y - camY - (s.lift || 0), s.faceL, s.frame, al);
            if (s.st === 'fallen') { // time left before it runs off
              const x = s.x - camX, y = s.y - camY - 18;
              ctx.fillStyle = 'rgba(20,14,28,0.82)'; rr(ctx, x - 7.5, y, 15, 3.6, 1.8); ctx.fill();
              ctx.fillStyle = s.t > 7 ? '#ff3b30' : '#ffd400'; rr(ctx, x - 6.5, y + 0.9, Math.max(0.1, 13 * (1 - s.t / 10)), 1.8, 0.9); ctx.fill();
            }
          });
        }
        for (const g of this.goats) push(g.y, () => drawAnimal(ctx, 'goat', g.x - camX, g.y - camY, g.faceL, g.frame));
        if (!this.dog.hidden) push(this.dog.y, () => drawAnimal(ctx, 'dog', this.dog.x - camX, this.dog.y - camY, this.dog.faceL, this.dog.frame));
        push(this.lady.y, () => this.lady.draw(ctx, camX, camY));
        push(this.insp.y, () => this.insp.draw(ctx, camX, camY));
        if (this.stage === 'herd') push(this.player.y, () => this.player.draw(ctx, camX, camY));
        const f = this.fer;
        push(f.y + 4, () => drawFerrari(ctx, f.x - camX, f.y - camY, f.a, f.parked && f.inMud));
        const v = this.truck;
        push(v.y + 4, () => { v.draw(ctx, camX, camY); this.drawBed(ctx, camX, camY); });
        // inspector's booth + EU flag
        const bx = BOOTH[0] - camX, by = BOOTH[1] - camY;
        push(BOOTH[1] + 30, () => drawBooth(ctx, bx, by));
        L.sort((a, b) => a.y - b.y).forEach(o => o.f());
      },
      drawBed(ctx, camX, camY) {
        const v = this.truck, d = VD(v.type);
        const load = this.sheep.filter(s => s.st === 'loaded'); if (!load.length) return;
        const top = -d.h / 2 + 10, bedH = d.h - 12, cw = Math.max(3, Math.floor((d.w - 6) / 2) - 1), rh = Math.max(3, Math.floor(bedH / 4));
        ctx.save(); ctx.translate(v.x - camX, v.y - camY); ctx.rotate(v.a + Math.PI / 2);
        load.forEach((s, i) => {
          if (i >= 8) return;
          const col = i % 2, row = i >> 1;
          const b = this.bounce > 0 ? Math.sin(G.t * 30 + i * 1.7) : 0;
          const lx = -d.w / 2 + 3 + col * (cw + 1), ly = top + row * rh + b, cx = lx + cw / 2, cy = ly + rh / 2 + 0.5;
          // fluffy back seen from above: a little cloud of wool + dark head
          const rw = Math.min(cw, rh) * 0.36;
          const P = [[cx - rw * 0.7, cy - rw * 0.2], [cx + rw * 0.7, cy - rw * 0.2], [cx, cy + rw * 0.55], [cx, cy - rw * 0.6]];
          ctx.fillStyle = INK; for (const [px, py] of P) { circ(ctx, px, py, rw + 0.5); ctx.fill(); }
          ctx.fillStyle = rad(ctx, cx - rw, cy - rw, 0.2, cx, cy, rw * 2.2, ['#ffffff', '#ece8dc', '#c4bcaa']); for (const [px, py] of P) { circ(ctx, px, py, rw); ctx.fill(); }
          ctx.fillStyle = 'rgba(255,255,255,0.8)'; circ(ctx, cx - rw * 0.6, cy - rw * 0.6, rw * 0.35); ctx.fill();
          ctx.fillStyle = '#2e2622'; ctx.strokeStyle = INK; ctx.lineWidth = 0.4; ell(ctx, cx, ly + 0.6, 1.3, 1.1); ctx.fill(); ctx.stroke();
        });
        ctx.restore();
      },

      // ---------- HUD ----------
      hud() {
        const U = G.ui, camX = this.camX, camY = this.camY, c = U.ctx;
        // world labels
        U.text(BOOTH[0] + TS - camX, BOOTH[1] - camY - 0.5, 'ΕΛΕΓΚΤΗΣ', 7, '#fff', 'center');
        U.text(SIGN[0] - camX, SIGN[1] - camY - 8, 'ΑΓΡΟΤΙΚΗ ΟΔΟΣ', 5, '#fff', 'center', null);
        U.text(SIGN[0] - camX, SIGN[1] - camY - 3, 'ΕΣΠΑ 2007–2013', 5, '#ffd400', 'center', null);
        if (this.stage !== 'herd') { const [zx, zy] = this.zone(); U.text(zx - camX, zy - camY - 22, 'ΕΚΦΟΡΤΩΣΗ', 7, '#ffd400', 'center'); }
        U.text(STILE[0] * TS + 8 - camX, STILE[1] * TS - camY - 7, 'ΕΙΣΟΔΟΣ', 4.8, '#fff', 'center', null);
        const inA = this.stage === 'herd' && this.inFieldA(this.player.x, this.player.y);
        if (this.stage === 'herd' && inA) { const [rx, ry] = this.rampPos(); U.text(rx - 4 - camX, ry - camY + LOAD_R * 0.7 + 9, 'ΡΑΜΠΑ', 7, '#ffd400', 'center'); }
        if (this.stage === 'drive' && this.truck.x < (GATE_X + 2) * TS) U.text(GATE_X * TS + 8 - camX, ROAD_Y0 * TS - camY - 8, 'ΠΟΡΤΑ', 7, '#ffd400', 'center');
        U.drawBubbles(camX, camY);
        // status box
        const loaded = this.loadedN(), lost = this.sheep.filter(s => s.st === 'lost' || s.st === 'gone' || s.st === 'left').length;
        let l1 = '', l2 = '';
        if (this.stage === 'herd') {
          // big sheep counter: label, x/8 and one dot per sheep (flashes green when one gets on)
          const T = U.T, fl = this.loadFx > 0;
          U.box(4, 4, 150, 36, T.panel, T.line, fl ? T.green : T.gold);
          U.text(11, 14, 'ΣΤΟ ΦΟΡΤΗΓΟ', 7, '#fff');
          U.text(148, 17, loaded + '/' + NSHEEP, 13, fl ? T.green : T.gold, 'right');
          for (let i = 0; i < NSHEEP; i++) U.rr(11 + i * 8, 19, 6, 5, 2.5, i < loaded ? (fl && i === loaded - 1 ? T.green : '#ffffff') : 'rgba(255,255,255,0.18)');
          U.text(11, 35, inA ? 'Σπρώξε τα προς τον κίτρινο κύκλο' : 'Μπες από την κόκκινη πορτούλα', 7, '#ffd400');
        } else {
          if (this.stage === 'drive') { l1 = 'Στην καρότσα: ' + loaded + ' · Χάθηκαν: ' + lost; l2 = this.truck.x < (GATE_X + 2) * TS ? 'Βγες από την πόρτα, δεξιά' : 'Πήγαινε στο άλλο χωράφι'; }
          else { l1 = 'Καταμέτρηση…'; l2 = 'Ο ελεγκτής μετράει'; }
          U.box(4, 4, 142, 24); U.text(9, 14, l1, 8, '#fff'); U.text(9, 24, l2, 7, '#ffd400');
        }
        // hints
        let hint = null;
        if (this.stage === 'herd') {
          if (this.nearCab && loaded > 0) hint = (G.device === 'mobile' ? 'ΦΥΓΑΜΕ' : 'E') + ': φύγε με ' + loaded + (loaded === 1 ? ' πρόβατο' : ' πρόβατα');
          if (this.nearRamp) hint = (G.device === 'mobile' ? 'ΦΟΡΤΩΣΕ' : 'SPACE') + ': φώναξε όσα είναι κοντά στη ράμπα';
        }
        if (hint) U.text(G.W / 2, G.H - 8, hint, 8, '#7dd3ff', 'center');
        // arrow to the target when it's off screen
        let tgt = null;
        if (this.stage === 'herd') tgt = inA ? this.rampPos() : [STILE[0] * TS + 8, STILE[1] * TS + 8];
        else if (this.stage === 'drive') {
          const v = this.truck, fl = this.sheep.filter(s => s.st === 'fallen').sort((a, b) => G.dist(a.x, a.y, v.x, v.y) - G.dist(b.x, b.y, v.x, v.y))[0];
          tgt = fl ? [fl.x, fl.y] : this.zone();
        }
        if (tgt) {
          const sx = tgt[0] - camX, sy = tgt[1] - camY;
          if (sx < 8 || sx > G.W - 8 || sy < 8 || sy > G.H - 8) {
            const a = Math.atan2(sy - G.H / 2, sx - G.W / 2), ex = G.clamp(sx, 14, G.W - 14), ey = G.clamp(sy, 38, G.H - 14);
            c.save(); c.translate(ex, ey); c.rotate(a); c.fillStyle = '#ffd400'; c.strokeStyle = '#000'; c.lineWidth = 1;
            c.beginPath(); c.moveTo(7, 0); c.lineTo(-5, -5); c.lineTo(-5, 5); c.closePath(); c.fill(); c.stroke(); c.restore();
          }
        }
      },
    }),
  });
})();
