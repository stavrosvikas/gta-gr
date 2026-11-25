// GTA LUBEN — fantasy town (Pokémon-GBA style). Hand-laid layout, distinct buildings, clear roads.
'use strict';
(function () {
  const TS = G.TS = 16;
  const W = G.World = {};
  G.REGIONS = G.REGIONS || {};
  // quests call this at load time: { id, tx, ty, w, h (tiles), entry:[lx,ly] (local tile), mini:'#hex' | miniDraw(ctx),
  //   paint(ctx, lx0, ly0, lw, lh), solid(lx, ly)?, live(ctx, ox, oy)?, statics(push, ox, oy)? }
  G.region = def => { G.REGIONS[def.id] = def; if (G.World.t) { G.World.build(); } return def; };
  const MW = 100, MH = 76, WW = 300, WH = 356; W.TOWN = { w: MW, h: MH };

  // Tile codes:
  // '~' grass  'R' road  '.' sidewalk  'p' sand path  'S' plaza  'W' water  'T' tree  'F' flowers
  // 'f' fence  'r' rail  'B' building (solid)  'P' pitch grass  'H' helipad  'X' invisible wall
  // 'w' shallow water (walkable, you wade)  'k' roadworks (closed lane, solid)  'C' basketball court (walkable)
  W.ROADS = {
    // not a perfect grid: roads end in T-junctions, corners are left to parks and trees
    h: [{ y: 6, x0: 6, x1: 61 }, { y: 22, x0: 6, x1: 93 }, { y: 48, x0: 6, x1: 258 }, { y: 66, x0: 26, x1: 93 }], // y48 = εθνική προς Θεσσαλία
    v: [{ x: 6, y0: 6, y1: 51 }, { x: 26, y0: 6, y1: 69 }, { x: 58, y0: 6, y1: 79 }, { x: 90, y0: 22, y1: 69 }],
    width: 4,
  };

  W.build = function () {
    W.w = WW; W.h = WH;
    const t = W.t = Array.from({ length: WH }, () => Array(WW).fill('O'));
    const set = (x, y, c) => { if (x >= 0 && y >= 0 && x < WW && y < WH) t[y][x] = c; };
    const rect = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, c); };
    W.outer(rect, set);
    // forest border (around the town only)
    rect(0, 0, MW, 5, 'T'); rect(0, MH - 5, MW, 5, 'T'); rect(0, 0, 5, MH, 'T'); rect(MW - 5, 0, 5, MH, 'T');
    // roads
    const RW = W.ROADS.width;
    for (const r of W.ROADS.h) rect(r.x0, r.y, r.x1 - r.x0 + 1, RW, 'R');
    for (const r of W.ROADS.v) rect(r.x, r.y0, RW, r.y1 - r.y0 + 1, 'R');
    // sidewalks around roads
    for (let y = 1; y < WH - 1; y++) for (let x = 1; x < WW - 1; x++) {
      if (!'~TYLgs'.includes(t[y][x])) continue;
      let nearRoad = false;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (t[y + dy][x + dx] === 'R') nearRoad = true;
      if (nearRoad) t[y][x] = '.';
    }
    // exits through the forest (where trains/buses/heli leave) are just decoration
    W.buildings = []; W.signs = []; W.doors = []; W.places = {};
    W.layout(rect, set);
    // freed corners become little groves
    for (let i = 0; i < 60; i++) { const x = 62 + Math.floor(G.hash(i, 3) * 32), y = 5 + Math.floor(G.hash(3, i) * 5); if (W.t[y][x] === '~') set(x, y, G.hash(i, 9) < 0.7 ? 'T' : 'F'); }
    for (let i = 0; i < 40; i++) { const x = 5 + Math.floor(G.hash(i, 5) * 20), y = 66 + Math.floor(G.hash(5, i) * 5); if (W.t[y][x] === '~') set(x, y, G.hash(i, 11) < 0.7 ? 'T' : 'F'); }
    // curved roads: round off the outer corners so the town isn't a box
    const curve = (p0, c1, p2, wdt) => {
      const fresh = [];
      for (let i = 0; i <= 200; i++) {
        const t = i / 200, x = (1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * c1[0] + t * t * p2[0], y = (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * c1[1] + t * t * p2[1];
        for (let dy = -wdt; dy <= wdt; dy++) for (let dx = -wdt; dx <= wdt; dx++) {
          const tx = Math.floor(x + dx * 0.5), ty = Math.floor(y + dy * 0.5);
          if (Math.hypot(tx + 0.5 - x, ty + 0.5 - y) > wdt / 2) continue;
          if (ty < 5 || ty > MH - 6 || tx < 5 || tx > MW - 6) continue;
          const c = W.t[ty][tx]; if (c === '~' || c === 'T' || c === 'F' || c === '.') { if (c !== 'R') fresh.push([tx, ty]); set(tx, ty, 'R'); }
        }
      }
      for (const [x0, y0] of fresh) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const c = W.t[y0 + dy] && W.t[y0 + dy][x0 + dx]; if (c === '~' || c === 'T' || c === 'F') set(x0 + dx, y0 + dy, '.'); }
    };
    curve([60, 8], [92, 8], [92, 24], 4);   // NE: Station road bends down into the east avenue
    curve([8, 49], [8, 68], [28, 68], 4);   // SW: west avenue bends into the south road
    W.outer2(rect, set);
    for (const b of W.buildings) if (!b.door) { b.door = [b.x + Math.floor(b.w / 2), b.y + b.h - 1]; W.doors.push(b.door); }
    // building footprints solid
    for (const b of W.buildings) for (let j = 0; j < b.h; j++) for (let i = 0; i < b.w; i++) set(b.x + i, b.y + j, 'B');
    W.mountRegions(set);
    W.chunks = new Map(); W._mini = null;
    W.genProps();
  };


  // ================= the world outside the town (one continuous map) =================
  // Town (0..99 x 0..75) · ΘΕΣΣΑΛΙΑ east along the εθνική (y48) · ΣΕΡΡΕΣ north-east by train · ΒΟΥΝΟ at the end of the εθνική
  // ΛΙΜΑΝΙ south of the town · ΑΙΓΑΙΟ · ΜΗΛΟΣ (boat ~25s) · ΚΡΗΤΗ (ship ~50s)
  W.MILOS = { cx: 172, cy: 170, rx: 32, ry: 22 };
  // the shore meets the tips of the q4 cove's cliffs exactly where they touch the region's side edges (row ~192.2)
  W.MILOS_LOBES = [{ cx: 157, cy: 185.2, rx: 5, ry: 6.6 }, { cx: 187, cy: 185.2, rx: 5, ry: 6.6 }];
  W.CRETE = { cx: 62, cy: 278, rx: 50, ry: 66 };
  W.AREA_NAMES = { thessaly: 'ΘΕΣΣΑΛΙΑ', serres: 'ΣΕΡΡΕΣ', mountain: 'ΒΟΥΝΟ', sea: 'ΑΙΓΑΙΟ', milos: 'ΜΗΛΟΣ', crete: 'ΚΡΗΤΗ', port: 'ΛΙΜΑΝΙ', town: 'ΑΘΗΝΑ' };
  const inEll = (e, x, y, k = 1.12) => Math.hypot((x - e.cx) / e.rx, (y - e.cy) / e.ry) < k;
  W.area = function (tx, ty) {
    if (tx < MW && ty < MH) return 'town';
    if (inEll(W.MILOS, tx, ty) || W.MILOS_LOBES.some(e => inEll(e, tx, ty, 1.7))) return 'milos';
    if (inEll(W.CRETE, tx, ty)) return 'crete';
    const c = W.get(tx, ty);
    if (tx < MW && ty < 92 && c !== 'O') return 'port';
    if (c === 'O' || ty > 96 && tx < 248) return 'sea';
    if (tx >= 252) return 'mountain';
    if (tx >= 118 && tx < 200 && ty < 36) return 'serres';
    return 'thessaly';
  };
  // where each quest's place sits in the world. The quest registers a region with G.region({ id, tx, ty, w, h, ... }).
  // entry side: the edge of the region that faces the hub (the quest marker goes on the entry tile).
  W.SPOTS = {
    seraios:  { tx: 150, ty: 12,  maxW: 34, maxH: 22,  hub: [143, 10],  side: 'top' },
    ferrari:  { tx: 214, ty: 56,  maxW: 30, maxH: 32,  hub: [229, 53],  side: 'top' },
    shepherd: { tx: 262, ty: 58,  maxW: 31, maxH: 290, hub: [277, 53],  side: 'top' },
    milos:    { tx: 157, ty: 172, maxW: 30, maxH: 24,  hub: [171, 150], side: 'top' },
    crete:    { tx: 38,  ty: 214, maxW: 46, maxH: 128, hub: [42, 331],  side: 'bottom' },
  };
  // crete_north: end of the little pier north of the village where the Crete quest ends (the pier runs x 59..61, y 209..213,
  // then on through the quest region down to the beach). CRETE_NORTH_SEA: open sea just off it, where a ship can start.
  W.DOCKS = { port: [59, 86], milos: [171, 143], crete: [36, 331], crete_north: [60, 209] };
  W.CRETE_NORTH_SEA = [60, 205];
  W.SERRES_STATION = [143, 10];
  W.HELIPADS = { town: [34, 62], milos: [175, 168] }; // helicopter Athens <-> Milos (Milos: open rock near the beach-bar path, no pad)
  W.outer = function (rect, set) {
    const T = W.t;
    const mountX = y => 252 + Math.round(Math.sin(y / 11) * 3 + Math.sin(y / 29) * 2);
    for (let y = 0; y < WH; y++) for (let x = 0; x < WW; x++) {
      let land = false;
      if (x < MW) land = y <= 79 + Math.round(Math.sin(x / 7) * 1.2);
      else land = y <= 90 + Math.round(Math.sin(x / 9) * 2 + Math.sin(x / 23) * 2);
      if (x >= mountX(y)) land = true;
      if (land) T[y][x] = '~';
    }
    const blob = (e, seed) => {
      for (let y = Math.floor(e.cy - e.ry - 5); y <= e.cy + e.ry + 5; y++) for (let x = Math.floor(e.cx - e.rx - 5); x <= e.cx + e.rx + 5; x++) {
        const a = Math.atan2((y - e.cy) / e.ry, (x - e.cx) / e.rx), d = Math.hypot((x - e.cx) / e.rx, (y - e.cy) / e.ry);
        if (d < 1 + Math.sin(a * 3 + seed) * 0.07 + Math.sin(a * 7 + seed * 2) * 0.04) set(x, y, 'g');
      }
    };
    blob(W.MILOS, 1.3); blob(W.CRETE, 4.1);
    W.MILOS_LOBES.forEach(e => blob(e, 0.7)); // Milos: the land runs down beside the cove's white cliffs (q4 region)
    // little islets (βραχονησίδες) along the way, one with a chapel
    W.ISLETS = [{ cx: 110, cy: 158, rx: 4, ry: 3 }, { cx: 40, cy: 122, rx: 3, ry: 2 }, { cx: 205, cy: 248, rx: 6, ry: 4, chapel: true }, { cx: 165, cy: 305, rx: 4, ry: 3 }, { cx: 225, cy: 130, rx: 3, ry: 3 }];
    W.ISLETS.forEach((e, i) => blob(e, i * 2.3));
    // Thessaly: patchwork of wheat, ploughed soil and grass with tree lines
    for (let y = 0; y < 92; y++) for (let x = MW; x < 252; x++) {
      if (T[y][x] !== '~' || (y >= 43 && y <= 56)) continue;
      const cx = Math.floor((x - MW) / 11), cy = Math.floor(y / 8), h = G.hash(cx * 7 + 1, cy * 13 + 5);
      const edge = (x - MW) % 11 === 0 || y % 8 === 0;
      if (edge) { if (G.hash(x, y * 3) < 0.35) T[y][x] = 'T'; continue; }
      T[y][x] = h < 0.45 ? 'Y' : h < 0.68 ? 'L' : '~';
    }
    // mountain: dense forest and rocks
    for (let y = 0; y < WH; y++) for (let x = 248; x < WW; x++) {
      if (T[y][x] !== '~' || x < mountX(y)) continue;
      const h = G.hash(x * 3, y * 5), rock = G.hash(Math.floor(x / 4), Math.floor(y / 4) + 99);
      T[y][x] = rock < 0.18 && h < 0.6 ? 'K' : h < 0.62 ? 'T' : '~';
    }
    // islands: ochre rocks (Crete), white rocks (Milos). Crete's olive trees are drawn by G.CRETE_ART (q5), on the same rows as the quest's orchards
    for (const [e, tr, rk] of [[W.CRETE, 0, 0.014], [W.MILOS, 0, 0.05]]) for (let y = e.cy - e.ry - 5; y <= e.cy + e.ry + 5; y++) for (let x = e.cx - e.rx - 5; x <= e.cx + e.rx + 5; x++) {
      if (!T[y] || T[y][x] !== 'g') continue; const h = G.hash(x * 5 + 2, y * 3 + 7);
      if (h < tr) T[y][x] = 'T'; else if (h < tr + rk) T[y][x] = 'K';
    }
    // beaches: land touching the sea
    for (let y = 1; y < WH - 1; y++) for (let x = 1; x < WW - 1; x++) {
      if (T[y][x] === 'O') continue;
      let sea = false; for (let dy = -2; dy <= 2 && !sea; dy++) for (let dx = -2; dx <= 2; dx++) if (T[y + dy] && T[y + dy][x + dx] === 'O') { sea = true; break; }
      if (sea && (x < 248 || W.area(x, y) !== 'mountain')) T[y][x] = 's';
    }
  };
  W.outer2 = function (rect, set) {
    // railway: town station → west → north → east along the top to Serres
    for (let y = 2; y <= 19; y++) { set(2, y, 'q'); set(3, y, 'q'); }
    for (let x = 0; x <= 146; x++) { set(x, 2, 'r'); set(x, 3, 'r'); }
    for (let x = 0; x <= 3; x++) { set(x, 18, 'r'); set(x, 19, 'r'); }
    set(0, 2, 'T'); set(0, 3, 'T'); set(1, 2, 'T'); set(1, 3, 'T');
    set(4, 4, 'r'); set(4, 17, 'r'); // the inner rail of each curve passes through these corner tiles
    // ---- town beach: wider sand, then a strip of shallow water ('w', you can wade in) before the deep sea ----
    W.beachEnd = x => 80 + Math.round(Math.sin(x / 6.3) * 0.9 + Math.sin(x / 15 + 1) * 0.6);
    for (let x = 0; x < MW; x++) {
      if (x >= 54 && x <= 63) continue; // port: plaza, pier and the boat lane stay as they are
      const se = W.beachEnd(x), we = se + 2 + (Math.sin(x / 4.1 + 2) > -0.2 ? 1 : 0);
      for (let y = MH; y <= 92; y++) set(x, y, y <= se ? 's' : y <= we ? 'w' : 'O');
    }
    // openings through the forest band: dirt paths from the south road down to the beach
    W.BEACH_PATHS = [16, 30, 45, 75, 90];
    for (const cx of W.BEACH_PATHS) for (let x = cx - 1; x <= cx + 1; x++) for (let y = MH - 1; y >= 60; y--) {
      const c = W.t[y][x]; if (c === 'T' || c === 'F' || c === '~' || (c === 'p' && y >= MH - 5)) set(x, y, 'p'); else break;
    }
    // roadworks: one lane closed for a stretch (solid 'k'); traffic merges into the other lane
    W.ROADWORKS = [{ x: 41, y: 22, w: 9, h: 2, axis: 'h' }, { x: 92, y: 54, w: 2, h: 9, axis: 'v' }, { x: 36, y: 68, w: 9, h: 2, axis: 'h' }];
    for (const r of W.ROADWORKS) rect(r.x, r.y, r.w, r.h, 'k');
    // Serres station
    rect(136, 4, 12, 1, 'S');
    B({ id: 'serres_station', type: 'station', x: 138, y: 5, w: 10, h: 5, label: 'ΣΤΑΘΜΟΣ ΣΕΡΡΩΝ', roof: '#7a3b2e', wall: '#efe0c0' });
    rect(136, 10, 14, 2, 'p');
    for (const [hx, hy, rf] of [[124, 12, '#b0503a'], [130, 18, '#a8452f'], [124, 24, '#b85a3a'], [186, 14, '#a8452f'], [190, 22, '#b0503a']]) B({ type: 'house', x: hx, y: hy, w: 5, h: 4, roof: rf, wall: '#f0e2c4' });
    // port: road ends on the pier
    rect(56, 80, 6, 8, 'D'); rect(54, 76, 10, 4, 'S');
    W.signs.push({ x: 60, y: 76, text: 'ΛΙΜΑΝΙ · ΠΛΟΙΑ' });
    // docks on the islands
    rect(170, 140, 3, 10, 'D'); rect(33, 330, 9, 3, 'D'); // Crete pier on the west coast, next to the bends
    rect(W.DOCKS.crete_north[0] - 1, W.DOCKS.crete_north[1], 3, 214 - W.DOCKS.crete_north[1], 'D'); // Crete north pier (the q5 region continues it to the beach)
    // Milos: no helipad, the helicopter just lands on open white rock near the beach-bar path (clear a few rocks there)
    { const [hx, hy] = W.HELIPADS.milos; for (let y = hy - 2; y <= hy + 2; y++) for (let x = hx - 2; x <= hx + 2; x++) { const c = W.t[y][x]; if (c === 'K' || c === 'T') set(x, y, 'g'); } }
    // the εθνική: road signposts (props, see genProps) + mountain clearing at the end
    W.signs.push({ x: 141, y: 1.4, text: 'ΣΕΡΡΕΣ' });
    for (let y = 44; y <= 57; y++) for (let x = 252; x <= 296; x++) { const c = W.t[y][x]; if (c === 'T' || c === 'K' || c === '~') set(x, y, Math.abs(y - 50) + Math.abs(x - 270) * 0.15 < 7 ? 'p' : c === 'K' ? 'K' : '~'); }
    // a few trees along the εθνική
    for (let x = 104; x < 250; x += 7) for (const yy of [46, 53]) if (G.hash(x, yy) < 0.55 && '~YL'.includes(W.t[yy][x])) set(x, yy, 'T');
    // farmland fences along the εθνική: short runs with gaps (you can still walk/drive into the fields)
    for (const fy of [45, 54]) for (let x = 104; x < 248; x++) { const k = (x - MW) % 11; if (k >= 2 && k <= 8 && W.t[fy][x] === '~') set(x, fy, 'f'); }
    // farmhouses facing the road, with a dirt track to the εθνική
    for (const [hx, rf] of [[140, '#b0503a'], [206, '#a8452f']]) {
      B({ type: 'house', x: hx, y: 41, w: 5, h: 4, roof: rf, wall: '#f0e2c4' });
      for (let y = 45; y <= 46; y++) for (const xx of [hx + 2, hx + 3]) set(xx, y, 'p');
    }
    // countryside landmarks (drawn in genProps): windmill, roadside chapel, tractor, hay bales, εικονοστάσια
    W.LANDMARKS = [{ k: 'windmill', x: 190, y: 43 }, { k: 'chapel', x: 172, y: 43 }, { k: 'tractor', x: 106, y: 59 },
      { k: 'shrine', x: 118, y: 46 }, { k: 'shrine', x: 213, y: 53 },
      { k: 'bale', x: 124, y: 42 }, { k: 'bale', x: 126, y: 41 }, { k: 'bale', x: 129, y: 42 }, { k: 'bale', x: 182, y: 57 }, { k: 'bale', x: 184, y: 58 }, { k: 'bale', x: 187, y: 57 }, { k: 'bale', x: 126, y: 21 }, { k: 'bale', x: 128, y: 20 }];
    for (const l of W.LANDMARKS) { const n = l.k === 'tractor' || l.k === 'chapel' ? 2 : 1; for (let i = 0; i < n; i++) { const c = W.t[l.y][l.x + i]; if (c === 'T' || c === 'f' || c === 'K') set(l.x + i, l.y, l.k === 'tractor' ? 'L' : '~'); } }
  };
  // paths: L-shaped dirt track (2 tiles) from a hub to a region entry, never over the region itself
  W.connect = function (set, a, b) {
    const ok = (x, y) => { const c = W.get(x, y); return c !== 'Z' && c !== 'B' && c !== 'O' && c !== 'R' && c !== 'D' && c !== '.' && c !== 'r' && c !== 'q'; };
    const dx = Math.sign(b[0] - a[0]);
    for (let x = a[0]; x !== b[0] + dx && dx; x += dx) for (let k = 0; k < 2; k++) if (ok(x, a[1] + k)) set(x, a[1] + k, 'p');
    const dy = Math.sign(b[1] - a[1]);
    for (let y = a[1]; y !== b[1] + dy && dy; y += dy) for (let k = 0; k < 2; k++) if (ok(b[0] + k, y)) set(b[0] + k, y, 'p');
  };
  // ---------- quest regions ----------
  W.regions = [];
  W._rgrid = null;
  W.regionAt = (tx, ty) => { const i = W._rgrid ? W._rgrid[ty * WW + tx] : -1; return i >= 0 ? W.regions[i] : null; };
  W.mountRegions = function (set) {
    W.regions = Object.values(G.REGIONS || {});
    W._rgrid = new Int16Array(WW * WH).fill(-1);
    W.regions.forEach((r, i) => {
      for (let y = r.ty; y < r.ty + r.h; y++) for (let x = r.tx; x < r.tx + r.w; x++) { set(x, y, 'Z'); W._rgrid[y * WW + x] = i; }
    });
    for (const r of W.regions) {
      const sp = W.SPOTS[r.id]; if (!sp || !r.entry) continue;
      const e = [r.tx + r.entry[0], r.ty + r.entry[1] + (sp.side === 'bottom' ? 1 : -1)];
      W.connect(set, sp.hub, e);
    }
  };
  // world tile of a quest's entry (where its marker sits), or the planned spot if the quest has no region yet
  W.entryOf = function (id) {
    const r = (G.REGIONS || {})[id], sp = W.SPOTS[id];
    if (r && r.entry) return [r.tx + r.entry[0], r.ty + r.entry[1]];
    if (sp) return [sp.tx + 10, sp.side === 'bottom' ? sp.ty + 40 : sp.ty];
    return null;
  };

  // ---------- districts ----------
  const B = (o) => { W.buildings.push(o); if (o.id) W.places[o.id] = o; return o; };
  W.layout = function (rect, set) {
    // ---- NW: train station (block x11-25, y11-21) ----
    rect(11, 11, 15, 11, 'p');
    B({ id: 'station', type: 'station', x: 12, y: 11, w: 12, h: 6, label: 'ΣΤΑΘΜΟΣ ΟΣΕ', roof: '#7a3b2e', wall: '#efe0c0' });
    rect(5, 18, 1, 1, 'p');
    for (let x = 0; x < 26; x++) { set(x, 18, 'r'); set(x, 19, 'r'); }
    rect(12, 20, 12, 1, 'S');
    // ---- N: hipster street (block x31-57, y11-21) ----
    rect(31, 11, 27, 11, 'p'); rect(31, 18, 27, 4, 'S');
    B({ id: 'avocado', type: 'shop', x: 31, y: 12, w: 6, h: 6, label: 'AVOCADO BAR', roof: '#5c9741', wall: '#f2e1c8', awning: '#5c9741', deco: 'avocado' });
    B({ id: 'coffee', type: 'shop', x: 38, y: 11, w: 6, h: 6, label: 'FREDDOCINO ΜΠΑΝΑΝΑ', roof: '#c9a46a', wall: '#fff6e0', awning: '#7a4a25', deco: 'coffee' });
    B({ id: 'plants', type: 'shop', x: 45, y: 12, w: 5, h: 6, label: 'ΦΥΤΑ & ΨΥΧΗ', roof: '#2f6b3a', wall: '#e4f0d8', awning: '#3a8a4a', deco: 'plants' });
    B({ id: 'toys', type: 'shop', x: 51, y: 11, w: 6, h: 6, label: 'ADULT TOYS 18+', roof: '#2a1a2a', wall: '#1d1d1d', awning: '#ff6fa3', deco: 'dildo' });
    // ---- NE: graffiti district + school (block x63-89, y11-21) ----
    rect(63, 11, 27, 11, 'p');
    B({ id: 'school', type: 'school', x: 64, y: 11, w: 11, h: 7, label: '3ο ΓΥΜΝΑΣΙΟ', roof: '#b0503a', wall: '#f0d8a8' });
    rect(64, 18, 11, 1, 'f'); set(69, 18, 'p'); set(70, 18, 'p');
    B({ id: 'squat', type: 'apart', x: 77, y: 11, w: 6, h: 7, label: '', roof: '#8a8478', wall: '#b9b0a0', graffiti: true });
    B({ id: 'bar', type: 'shop', x: 84, y: 11, w: 5, h: 6, label: 'ΚΑΦΕΝΕΙΟ', roof: '#555', wall: '#9b938a', awning: '#c0392b', graffiti: true });
    // ---- W: police + tax office + houses (block x11-25, y27-47) ----
    B({ id: 'police', type: 'police', x: 11, y: 27, w: 9, h: 7, label: 'ΑΣΤΥΝΟΜΙΑ', roof: '#2d4f8a', wall: '#e8eef5' });
    B({ id: 'tax', type: 'tax', x: 11, y: 37, w: 9, h: 7, label: 'ΕΦΟΡΙΑ · ΑΑΔΕ', roof: '#6b6b70', wall: '#d9d9d4' });
    rect(11, 35, 10, 1, 'p'); rect(11, 45, 10, 2, 'p');
    rect(22, 26, 2, 22, 'R'); // narrow side street (σοκάκι), no buses fit here
    // ---- CENTER: plaza + parliament (block x31-57, y27-47) ----
    rect(31, 27, 27, 21, 'S');
    B({ id: 'vouli', type: 'parliament', x: 34, y: 27, w: 21, h: 8, label: 'ΒΟΥΛΗ', roof: '#c9a466', wall: '#e8c98a' });
  // Tomb of the Unknown Soldier + two evzones in front of the parliament (props, see genProps)
    W.TOMB = { x: 40, y: 36, w: 9 }; // wall row; guards at x37 / x52 (rows 36-37), the plaza x38-51 y37-46 stays free
    for (const [x, y] of [[32, 37], [32, 41], [32, 45], [56, 37], [56, 41], [56, 45]]) set(x, y, 'T');
    rect(36, 44, 3, 2, 'F'); rect(50, 44, 3, 2, 'F');
    // ---- E: kiosk, closed shop, bank, first dates, apartments (block x63-89, y27-47) ----
    rect(63, 27, 27, 21, 'p');
    B({ id: 'firstdates', type: 'firstdates', x: 63, y: 27, w: 9, h: 7, label: 'FIRST DATES', roof: '#7a1020', wall: '#f4ece0' });
    B({ type: 'shop', x: 74, y: 27, w: 6, h: 6, label: 'ΕΝΟΙΚΙΑΖΕΤΑΙ', roof: '#9a8f86', wall: '#e9d2c8', deco: 'closed', graffiti: true }); // closed-down shop (no function)
    B({ id: 'bank', type: 'bank', x: 82, y: 27, w: 7, h: 6, label: 'ΤΡΑΠΕΖΑ', roof: '#1f3f9a', wall: '#e4ecf4' });
    B({ id: 'apart1', type: 'apart', x: 63, y: 38, w: 7, h: 8, label: '', roof: '#d9d2c4', wall: '#f7c9c4' });
    B({ id: 'apart2', type: 'apart', x: 72, y: 37, w: 7, h: 8, label: '', roof: '#cfc6b6', wall: '#bfe8d8' });
    B({ id: 'apart3', type: 'apart', x: 81, y: 36, w: 8, h: 8, label: '', roof: '#e3ddd0', wall: '#ffd3a8' });
    // ---- SW: KTEL + houses (block x11-25, y53-65) ----
    rect(11, 53, 15, 13, 'p');
    B({ id: 'ktel', type: 'ktel', x: 11, y: 53, w: 12, h: 6, label: 'ΚΤΕΛ · ΕΠΑΡΧΙΑ', roof: '#2e7d4f', wall: '#e9e2d0' });
    B({ type: 'apart', x: 11, y: 60, w: 6, h: 6, roof: '#d6cbb5', wall: '#a9dcd8' });
    B({ type: 'apart', x: 18, y: 60, w: 7, h: 6, roof: '#c8bfae', wall: '#f4c4d4' });
    // ---- S: park (block x31-57, y53-65) ----
    rect(31, 53, 27, 13, '~');
    rect(38, 56, 9, 5, 'W');
    for (let i = 0; i < 40; i++) { const x = 31 + Math.floor(G.hash(i, 7) * 27), y = 53 + Math.floor(G.hash(7, i) * 13); if (t(x, y) === '~') set(x, y, G.hash(i, i) < 0.6 ? 'T' : 'F'); }
    for (let x = 31; x <= 57; x++) { const y = 59 + Math.round(Math.sin(x / 3.2) * 1.6); set(x, y, 'p'); set(x, y + 1, 'p'); }
    for (let y = 53; y <= 65; y++) { const x = 44 + Math.round(Math.sin(y / 2.6) * 1.8); set(x, y, 'p'); }
    // outdoor basketball half-court ('C', walkable); the hoop stands on its north side (solid prop, see genProps)
    // hoop = world px of the rim centre as drawn (elevated); ground = the spot on the floor right under the rim
    W.COURT = { x: 49, y: 60, w: 8, h: 6, hoop: [53 * TS, 60 * TS - 14], ground: [53 * TS, 60 * TS + 18] };
    rect(48, 59, 10, 1, 'p'); rect(49, 60, 8, 6, 'C');
    // ---- SE: football pitch + houses (block x63-89, y53-65) ----
    rect(63, 53, 27, 13, 'p');
    rect(64, 54, 18, 11, 'P'); // pitch
    for (let x = 63; x <= 82; x++) { set(x, 53, 'f'); set(x, 65, 'f'); } for (let y = 53; y <= 65; y++) { set(63, y, 'f'); set(82, y, 'f'); }
    set(72, 65, 'p'); set(73, 65, 'p'); // gate
    W.places.pitch = { x: 64, y: 54, w: 18, h: 11, label: 'ΓΗΠΕΔΟ' }; W.signs.push({ x: 72, y: 66, text: 'ΓΗΠΕΔΟ', place: 'pitch' });
    B({ type: 'apart', x: 84, y: 53, w: 5, h: 6, roof: '#d9d2c4', wall: '#d6c8f0' });
    B({ type: 'apart', x: 84, y: 60, w: 5, h: 6, roof: '#bdb5a5', wall: '#ffcfb0' });
    // ---- far-east strip: helipad (x95-? no: inside block x63-89 top right is used) -> put on roof-top plaza near NE corner of map
    rect(91, 11, 0, 0, '~');
    // helipad in NW top-left block corner (x 11-25,y 11)? use top-right corner of north band between roads y11-21 x 84-89 is bar. Put helipad in middle-east band x 91-94?
    // keep simple: helipad sits in the park south-west corner
    rect(32, 61, 5, 4, 'H'); W.places.helipad = { x: 32, y: 61, w: 5, h: 4, label: 'ΕΛΙΚΟΔΡΟΜΙΟ' };
    W.signs.push({ x: 34, y: 60, text: 'ΕΛΙΚΟΔΡΟΜΙΟ', place: 'helipad' });
    function t(x, y) { return W.t[y] && W.t[y][x]; }
    // shop signs live ON the façade, above the door (one sign per shop; the label text is drawn crisp by W.drawSigns)
    const FACE = {
      firstdates: { kind: 'neon', board: '#1a0c16', text: '#ffe6f2', glow: '#ff3e8a', halo: 'rgba(255,40,130,0.75)', heart: true },
      toys: { kind: 'neon', board: '#140c18', text: '#f2e2ff', glow: '#b06bff', halo: 'rgba(150,70,255,0.7)' },
      avocado: { board: '#2c4a3a', frame: '#9a6a3c', text: '#eaf7d0', icon: 'avocado' },
      coffee: { board: '#4a2a18', frame: '#c9a46a', text: '#fff1d6', icon: 'coffee' },
      plants: { board: '#2f6b3a', frame: '#e4f0d8', text: '#f2fbe8', icon: 'plant' },
      bar: { board: '#f6ead0', frame: '#1f3f9a', text: '#1f3f9a', icon: 'kafe' },
      bank: { board: '#1f3f9a', frame: '#d8e2f2', text: '#ffffff' },
      ktel: { board: '#2e7d4f', frame: '#e9e2d0', text: '#ffffff', icon: 'bus' },
    };
    for (const id in FACE) if (W.places[id]) W.places[id].face = Object.assign({ kind: 'board' }, FACE[id]);
    W.places.bank.atmCols = [1, W.places.bank.w - 2]; // two ATMs built into the bank façade (W.atms = the spot in front of each)
    // Airbnb everywhere: lockboxes by the door, a pink plaque, suitcases on the pavement
    for (const b of W.buildings) if (b.type === 'apart' && (b.id === 'apart1' || b.id === 'apart3' || (b.x === 18 && b.y === 60) || (b.x === 84 && b.y === 53))) b.airbnb = true;
    // riot zone (Εξάρχεια): spray-painted slogans on the walls (drawn by drawSpray, local px of the building)
    W.places.squat.spray = [{ lines: ['TOURIST', 'GO HOME'], x: 48, y: 64, size: 12, maxW: 84, col: '#ff2d55', rot: -0.07 }];
    W.places.school.spray = [{ lines: ['TOURISTS GO HOME'], x: 46, y: 92, size: 9, maxW: 60, col: '#ffd400', rot: 0.04 },
      { lines: ['AIRBNB =', 'ΑΚΡΙΒΑ ΕΝΟΙΚΙΑ'], x: 120, y: 84, size: 8, maxW: 46, col: '#2dd4ff', rot: -0.05 }];
    W.places.bar.spray = [{ lines: ['NO AIRBNB'], x: 17, y: 90, size: 6, maxW: 26, col: '#7ed957', rot: -0.08 }];
    // doors: one per building (centre of bottom row)
    for (const b of W.buildings) { b.door = [b.x + Math.floor(b.w / 2), b.y + b.h - 1]; W.doors.push(b.door); }
  };

  W.get = (x, y) => (x < 0 || y < 0 || x >= W.w || y >= W.h) ? 'T' : W.t[y][x];
  W.at = (px, py) => W.get(Math.floor(px / TS), Math.floor(py / TS));
  W.solidTile = c => c === 'B' || c === 'T' || c === 'W' || c === 'f' || c === 'X' || c === 'O' || c === 'K' || c === 'k';
  W.isShallow = (tx, ty) => W.get(tx, ty) === 'w';
  W.isRoad = (x, y) => W.get(x, y) === 'R';
  W.isPothole = (x, y) => W.get(x, y) === 'R' && G.hash(x * 31 + 7, y * 17 + 3) < 0.022 && !W.ROADS.v.some(v => x >= v.x && x < v.x + 4 && W.ROADS.h.some(h => y >= h.y && y < h.y + 4));
  W.walkable = (x, y) => { const c = W.get(x, y); if (c === 'Z') { const r = W.regionAt(x, y); return !r.solid || !r.solid((x - r.tx) * TS + 8, (y - r.ty) * TS + 8); } return c === '.' || c === 'S' || c === '~' || c === 'p' || c === 'F' || c === 'P' || c === 'H' || c === 's' || c === 'Y' || c === 'L' || c === 'g' || c === 'D' || c === 'w' || c === 'C'; };
  W.solidAt = (px, py) => {
    const c = W.at(px, py);
    if (c === 'Z') { const r = W.regionAt(Math.floor(px / TS), Math.floor(py / TS)); return !!(r.solid && r.solid(px - r.tx * TS, py - r.ty * TS)); }
    if (W.solidTile(c)) return true;
    if ((c === 'g' || c === 's') && G.CRETE_ART && G.CRETE_ART.solid(px, py)) return true; // olive trunks on Crete
    const p = W.propAt(Math.floor(px / TS), Math.floor(py / TS)); return !!(p && p.solid);
  };
  W.zone = function (tx, ty) {
    if (tx >= MW || ty >= MH) return 'out';
    if (ty < 22 && tx >= 30 && tx < 58) return 'hip';
    if (ty < 22 && tx >= 62) return 'riot';
    if (ty > 26 && ty < 48 && tx > 30 && tx < 58) return 'center';
    return 'normal';
  };
  W.zoneName = function (tx, ty) {
    const ar = W.area(tx, ty); if (ar === 'port' && (tx < 52 || tx > 65)) return 'ΠΑΡΑΛΙΑ'; if (ar !== 'town') return W.AREA_NAMES[ar];
    if (ty < 22) return tx < 26 ? 'ΣΤΑΘΜΟΣ' : tx < 58 ? 'ΨΥΡΡΗ' : 'ΕΞΑΡΧΕΙΑ';
    if (ty < 48) return tx < 26 ? 'ΔΗΜΟΣΙΕΣ ΥΠΗΡΕΣΙΕΣ' : tx < 58 ? 'ΣΥΝΤΑΓΜΑ' : 'ΑΓΟΡΑ';
    return tx < 26 ? 'ΚΤΕΛ' : tx < 58 ? 'ΠΑΡΚΟ' : 'ΓΗΠΕΔΟ';
  };
  W.findNear = function (cx, cy, pred, maxR = 30) {
    for (let r = 0; r <= maxR; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = cx + dx, y = cy + dy; if (x > 0 && y > 0 && x < W.w - 1 && y < W.h - 1 && pred(x, y)) return [x, y];
    }
    return null;
  };
  W.facade = (x, y) => false;
  // spot right in front of a building's door (walkable)
  W.front = id => { const b = W.places[id]; if (!b) return null; if (b.door) return [b.door[0], b.door[1] + 1]; return [b.x + Math.floor(b.w / 2), b.y + b.h]; };

  // ---------- props ----------
  W.addProp = p => { W.props.push(p); W.propGrid.set(p.tx + ',' + p.ty, p); return p; };
  W.propAt = (tx, ty) => W.propGrid.get(tx + ',' + ty);
  W.genProps = function () {
    W.props = []; W.propGrid = new Map(); W.bins = []; W.atms = []; W.kiosks = []; W.homeless = []; W.corners = []; W.parkedSpots = [];
    const add = (type, x, y, solid = true) => W.addProp({ type, tx: x, ty: y, solid });
    // kiosks (περίπτερα) at a few corners
    for (const [x, y] of [[31, 26], [63, 52], [86, 26]]) {
      if (!W.walkable(x, y) || !W.walkable(x + 1, y)) continue;
      add('kiosk', x, y); add('fridge', x + 1, y); W.kiosks.push([x, y]);
    }
    // bins along sidewalks
    for (const [x, y] of [[12, 21], [40, 21], [70, 21], [12, 47], [45, 52], [75, 52], [86, 26], [35, 26], [62, 40], [25, 35], [62, 60], [5, 30]]) if (W.walkable(x, y) && !W.propAt(x, y)) { add('bin', x, y); W.bins.push([x, y]); }
    // ATMs: on the bank and next to shops
    const bank = W.places.bank; for (const col of bank.atmCols) W.atms.push([bank.x + col, bank.y + bank.h]); // built into the façade
    // homeless on cardboard
    for (const [x, y] of [[33, 47], [64, 47], [24, 26]]) if (W.walkable(x, y) && !W.propAt(x, y)) { add('homeless', x, y, false); W.homeless.push([x, y]); }
    // bus stops (στάσεις) with a crowd waiting
    W.stops = [];
    for (const [x, y] of [[33, 21], [50, 52], [65, 21], [12, 26], [80, 52], [62, 34]]) {
      if (!W.walkable(x, y) || W.propAt(x, y)) continue;
      // orientation from the neighbouring road: vert = the road runs north-south next to the stop
      const rd = (dx, dy) => { const c = W.get(x + dx, y + dy); return c === 'R' || c === 'k'; };
      const vert = !rd(0, 1) && !rd(0, -1) && (rd(1, 0) || rd(-1, 0));
      const side = vert ? (rd(-1, 0) ? -1 : 1) : (rd(0, -1) ? -1 : 1); // where the road is: -1 west/north, +1 east/south
      const crowd = []; const n = 5 + Math.floor(G.hash(x, y) * 4);
      for (let i = 0; i < n; i++) {
        const t = G.hash(i, x) * 6, back = i > 4, k = back ? i - 5 : i;
        // people queue along the curb, between the shelter and the road
        if (vert) crowd.push({ dx: side * (back ? -4 : 3), dy: -18 + k * 9 + (back ? 4 : 0), dir: side < 0 ? 1 : 2, look: null, t });
        else crowd.push({ dx: -14 + k * 8 + (back ? 4 : 0), dy: side > 0 ? (back ? 12 : 4) : (back ? -5 : -12), dir: side > 0 ? 0 : 3, look: null, t });
      }
      if (!vert && side < 0) crowd.sort((a, b) => a.dy - b.dy);
      const p = W.addProp({ type: 'stop', tx: x, ty: y, solid: true, crowd, vert, side }); W.stops.push(p);
    }
    // shop signs are painted on the façades (see paintBuilding/paintFace); no standing sign props on the pavement any more
    W.shopSigns = [];
    // Tomb of the Unknown Soldier (solid marble wall) with an evzone and his sentry box on each side
    W.bigStatics = [];
    const TB = W.TOMB;
    // the wall is drawn from half a tile above its row to its steps: block both rows, and the tile behind each sentry box
    for (let i = 0; i < TB.w; i++) { add('solid', TB.x + i, TB.y); add('solid', TB.x + i, TB.y - 1); }
    W.bigStatics.push({ x0: TB.x * TS - 8, y0: TB.y * TS - 26, x1: (TB.x + TB.w) * TS + 8, y1: TB.y * TS + 24, y: TB.y * TS + 15, draw: (ctx, sx, sy) => drawTomb(ctx, sx, sy, TB.w * TS) , ax: TB.x * TS, ay: TB.y * TS });
    for (const [gx, flip] of [[TB.x - 3, false], [TB.x + TB.w + 3, true]]) {
      W.addProp({ type: 'sentry', tx: gx, ty: TB.y, solid: true, flip });
      W.addProp({ type: 'evzone', tx: gx, ty: TB.y + 1, solid: true, flip, ph: flip ? 1.7 : 0 });
      add('solid', gx, TB.y - 1);
    }
    // façade overlays: pulsing neon (First Dates, toy shop) and spray-painted slogans, y-sorted with the building's front
    for (const b of W.buildings) {
      const box = { x0: b.x * TS, y0: b.y * TS, x1: (b.x + b.w) * TS, y1: (b.y + b.h) * TS, y: (b.y + b.h) * TS - 1, ax: b.x * TS, ay: b.y * TS };
      if (b.face && b.face.kind === 'neon') W.bigStatics.push(Object.assign({ draw: (ctx, sx, sy) => drawNeon(ctx, b, sx, sy) }, box));
      if (b.spray) W.bigStatics.push(Object.assign({ draw: (ctx, sx, sy) => { for (const g of b.spray) drawSpray(ctx, sx, sy, g, b.x * 7 + b.y); } }, box));
    }
    // Airbnb: a suitcase or two waiting next to the door (non-solid)
    for (const b of W.buildings) if (b.airbnb && b.door) {
      const fy = b.door[1] + 1;
      [[1, 0], [-1, 1]].forEach(([ox, k]) => { const xx = b.door[0] + ox; if ((k === 0 || G.hash(b.x, b.y) < 0.6) && W.walkable(xx, fy) && !W.propAt(xx, fy)) W.addProp({ type: 'suitcase', tx: xx, ty: fy, solid: false, k: Math.floor(G.hash(b.x + k, b.y) * 4) }); });
    }
    // countryside: road signposts at the forks + landmarks, so the fields read as farmland and you know where you are
    W.posts = [];
    const freeT = (x, y) => '~YLg'.includes(W.get(x, y)) && !W.propAt(x, y);
    const post = (x, y, lines) => {
      const c = W.findNear(x, y, freeT, 3); if (!c) return;
      const bw = Math.ceil(Math.max(...lines.map(l => l.t.length)) * 3.5 + 12);
      W.posts.push(W.addProp({ type: 'signpost', tx: c[0], ty: c[1], solid: true, lines, bw }));
    };
    post(101, 46, [{ t: 'ΘΕΣΣΑΛΙΑ', d: 1 }, { t: 'ΒΟΥΝΟ', d: 1 }, { t: 'ΑΘΗΝΑ · ΛΙΜΑΝΙ', d: -1 }]);
    post(166, 53, [{ t: 'ΒΟΥΝΟ', d: 1 }, { t: 'ΑΘΗΝΑ', d: -1 }]);
    post(227, 53, [{ t: 'ΧΩΡΑΦΙΑ', d: 'd' }, { t: 'ΒΟΥΝΟ', d: 1 }, { t: 'ΑΘΗΝΑ', d: -1 }]);
    post(247, 46, [{ t: 'ΒΟΥΝΟ', d: 1 }, { t: 'ΑΘΗΝΑ', d: -1 }]);
    post(134, 12, [{ t: 'ΣΕΡΡΕΣ', d: 1 }, { t: 'ΣΤΑΘΜΟΣ', d: 'u' }]);
    for (const l of W.LANDMARKS || []) {
      const ax = l.x * TS + 8, ay = l.y * TS + 12;
      if (l.k === 'bale' || l.k === 'shrine') { if (!W.propAt(l.x, l.y)) W.addProp({ type: l.k, tx: l.x, ty: l.y, solid: true, flip: G.hash(l.x, l.y) < 0.5 }); continue; }
      const wide = l.k === 'tractor' || l.k === 'chapel';
      add('solid', l.x, l.y); if (wide) add('solid', l.x + 1, l.y);
      const cx = wide ? ax + 8 : ax;
      W.bigStatics.push({ x0: cx - 26, y0: ay - 48, x1: cx + 26, y1: ay + 12, y: ay, ax: cx, ay, draw: (ctx, sx, sy) => drawLandmark(ctx, l.k, sx, sy) });
    }
    // roadworks dressing: barriers along the open lane, cones at both ends, a digger / sand pile, an ΕΡΓΑ sign
    W.ROADWORKS.forEach((r, i) => {
      const hz = r.axis === 'h', x0 = r.x * TS, y0 = r.y * TS, x1 = (r.x + r.w) * TS, y1 = (r.y + r.h) * TS;
      const road = hz ? W.ROADS.h.find(h => r.y >= h.y && r.y < h.y + 4) : W.ROADS.v.find(v => r.x >= v.x && r.x < v.x + 4);
      const openLow = hz ? (road ? r.y === road.y : true) : (road ? r.x === road.x : true); // open lane is below / to the right
      const piece = (ax, ay, kind, o = {}) => W.bigStatics.push(Object.assign({ x0: ax - 26, y0: ay - 34, x1: ax + 26, y1: ay + 10, y: ay, draw: (ctx, sx, sy) => drawWorks(ctx, kind, sx, sy, o), ax, ay }, o));
      if (hz) {
        const by = openLow ? y1 - 2 : y0 + 3;
        for (let x = x0 + 2; x < x1 - 4; x += 16) piece(x + 7, by, 'barH');
        for (const ex of [x0 + 3, x1 - 3]) for (let k = 0; k < 2; k++) piece(ex, y0 + 8 + k * 16, 'barV');
        for (const [ex, d] of [[x0, -1], [x1, 1]]) for (let k = 0; k < 3; k++) piece(ex + d * (6 + k * 9), openLow ? y0 + 22 - k * 8 : y1 - 22 + k * 8, 'cone');
        piece(x0 + (x1 - x0) * 0.42, y0 + 20, i % 2 ? 'sand' : 'digger', { flip: i === 2 });
        if (i === 2) piece(x0 + (x1 - x0) * 0.78, y0 + 18, 'sand');
        piece(x0 - 30, openLow ? y0 - 3 : y1 + 2, 'sign');
        W.signs.push({ x: (x0 - 30) / TS, y: (openLow ? y0 - 3 : y1 + 2) / TS - 1.95, text: 'ΕΡΓΑ' });
      } else {
        const bx = openLow ? x1 - 3 : x0 + 3;
        for (let y = y0 + 8; y < y1 - 2; y += 16) piece(bx, y + 4, 'barV');
        for (const ey of [y0 + 3, y1 - 1]) piece((x0 + x1) / 2, ey, 'barH');
        for (const [ey, d] of [[y0, -1], [y1, 1]]) for (let k = 0; k < 3; k++) piece(openLow ? x0 + 22 - k * 8 : x1 - 22 + k * 8, ey + d * (6 + k * 9), 'cone');
        piece((x0 + x1) / 2, y0 + (y1 - y0) * 0.45, 'digger', { flip: true });
        piece((x0 + x1) / 2, y0 + (y1 - y0) * 0.75, 'sand');
        piece(openLow ? x0 - 10 : x1 + 10, y0 - 24, 'sign');
        W.signs.push({ x: (openLow ? x0 - 10 : x1 + 10) / TS, y: (y0 - 24) / TS - 1.95, text: 'ΕΡΓΑ' });
      }
    });
    // basketball hoop: solid post on the north side of the court
    const CT = W.COURT; W.addProp({ type: 'hoop', tx: CT.x + CT.w / 2 - 1, ty: CT.y, solid: true });
    // street lamps & benches in plaza
    for (const [x, y] of [[35, 38], [52, 38], [35, 43], [52, 43]]) add('bench', x, y);
    // corners: sidewalk tiles at road junction corners
    for (const h of W.ROADS.h) for (const v of W.ROADS.v) for (const [dx, dy] of [[-1, -1], [4, -1], [-1, 4], [4, 4]]) { const x = v.x + dx, y = h.y + dy; if (W.get(x, y) === '.') W.corners.push([x, y]); }
    // parked cars half on the sidewalk (it's Athens), away from junctions and doors
    const nearJ = (x, y) => W.ROADS.v.some(v => x >= v.x - 3 && x <= v.x + 6) && W.ROADS.h.some(h => y >= h.y - 3 && y <= h.y + 6);
    for (const h of W.ROADS.h) for (let x = h.x0 + 4; x < h.x1 - 3; x += 4) for (const yy of [h.y - 1, h.y + 4]) {
      if (x > 92 || G.hash(x, yy) > 0.33 || nearJ(x, yy) || W.get(x, yy) !== '.' || W.get(x + 1, yy) !== '.' || W.get(x - 1, yy) !== '.') continue;
      W.parkedSpots.push({ x: x * TS + 8, y: yy * TS + (yy < h.y ? 13 : 3), a: 0 });
    }
    for (const v of W.ROADS.v) for (let y = v.y0 + 4; y < v.y1 - 3; y += 4) for (const xx of [v.x - 1, v.x + 4]) {
      if (G.hash(xx, y) > 0.33 || nearJ(xx, y) || W.get(xx, y) !== '.' || W.get(xx, y + 1) !== '.' || W.get(xx, y - 1) !== '.') continue;
      W.parkedSpots.push({ x: xx * TS + (xx < v.x ? 13 : 3), y: y * TS + 8, a: Math.PI / 2 });
    }
    // a little grime: some bins overflow
    for (const b of W.bins) { const p = W.propAt(b[0], b[1]); if (p && G.hash(b[0] * 3, b[1] * 7) < 0.55) p.over = true; }
    // abandoned green-and-white e-scooters, lying around in odd places (non-solid)
    const busy = new Set();
    for (const s of W.parkedSpots) { const sx = Math.floor(s.x / TS), sy = Math.floor(s.y / TS); for (let k = -1; k <= 1; k++) busy.add(s.a ? sx + ',' + (sy + k) : (sx + k) + ',' + sy); }
    for (const d of W.doors) for (let k = -1; k <= 1; k++) busy.add((d[0] + k) + ',' + (d[1] + 1));
    for (const st of W.stops) for (let j = -2; j <= 2; j++) for (let k = -2; k <= 2; k++) busy.add((st.tx + k) + ',' + (st.ty + j));
    W.scooters = [];
    for (let i = 0; i < 6000 && W.scooters.length < 18; i++) {
      const x = 6 + Math.floor(G.hash(i, 404) * 89), y = 5 + Math.floor(G.hash(404, i) * 76), c = W.get(x, y);
      const odd = c === '~' || c === 's' || c === 'S';
      if (!(c === '.' || c === 'p' || (odd && G.hash(i, 9) < 0.35))) continue;
      if (W.propAt(x, y) || busy.has(x + ',' + y) || (x >= 37 && x <= 52 && y >= 35 && y <= 47) || W.get(x, y - 1) === 'k' || W.get(x, y + 1) === 'k') continue;
      if (W.scooters.some(s => Math.abs(s.tx - x) + Math.abs(s.ty - y) < 7)) continue;
      const r = G.hash(i, 77);
      W.scooters.push(W.addProp({ type: 'scooter', tx: x, ty: y, solid: false, lying: r < 0.6, a: (G.hash(77, i) - 0.5) * 1.2, flip: G.hash(i, 31) < 0.5, ox: (G.hash(i, 5) - 0.5) * 6, oy: (G.hash(5, i) - 0.5) * 4 }));
    }
  };

  // ================= painting =================
  // palette: Vice-City sunset mood (warm, saturated, pastel walls, violet-tinted shadows, turquoise water)
  const PAL = {
    grass: '#7ccc52', grassD: '#5aa83e', grassL: '#a4e478',
    path: '#f4dfbc', pathD: '#e2c79c', pathL: '#fcefd6',
    road: '#5c5868', roadD: '#4e4a5b', roadL: '#6c6879', line: '#fff3e0', curb: '#bca59f',
    side: '#eedcd4', sideD: '#dbc6be', plaza: '#f9ebe1', plazaD: '#e9d5c8',
    water: '#3fb6e2', waterL: '#93e4f2', pitch: '#4fa83a', pitchL: '#5fbc48',
  };
  // sea colours by distance to the shore (1..4+); q4_milos blends its region edge with the same values
  W.SEA_COLS = ['#3cb8e2', '#3cb8e2', '#30a0dc', '#2a86d2', '#2468c4'];
  // Milos: smooth white volcanic rock (Sarakiniko). Base colours, also used by the Milos region to blend its edges.
  W.MILOS_COL = { g: '#efe9dc', T: '#efe9dc', K: '#efe9dc', s: '#f1e6cc', p: '#e6dcc6' };

  // ================= islands: smooth shorelines shared by the world tiles and the island quest regions =================
  // The island shape is analytic (the same blob as W.outer). A tile is land when its top-left corner is inside, so the
  // smooth shore is evaluated half a tile up-left. Water and beach colours come from a distance field (4 px cells) drawn as a
  // smoothed low-res image, then foam / outline strokes follow the marching-squares contour. Crete's q5 region and Milos'
  // q4 region call W.paintCoast / W.milosRockArea themselves, so the region border is invisible.
  W.ISLES = {
    crete: { e: W.CRETE, seed: 4.1, lobes: [],
      water: [[0, '#62d2e6'], [14, '#3cb8e2'], [32, '#30a0dc'], [50, '#2a86d2'], [72, '#2468c4']], sand: true },
    milos: { e: W.MILOS, seed: 1.3, lobes: W.MILOS_LOBES, lobeSeed: 0.7,
      water: [[0, '#b4f6ee'], [10, '#86e8e0'], [24, '#3fcad1'], [40, '#1fb0c9'], [58, '#1f92cc'], [76, '#2468c4']], ink: true },
  };
  const blobF = (e, seed, px, py) => {
    const x = px / TS - 0.5, y = py / TS - 0.5, u = (x - e.cx) / e.rx, v = (y - e.cy) / e.ry, d = Math.hypot(u, v), a = Math.atan2(v, u);
    const b = 1 + Math.sin(a * 3 + seed) * 0.07 + Math.sin(a * 7 + seed * 2) * 0.04;
    const rr = d > 1e-6 ? Math.hypot(u * e.rx, v * e.ry) / d * TS : Math.min(e.rx, e.ry) * TS;
    return (b - d) * rr;
  };
  // ≈ signed distance to the island's shore in px (+ = on land), analytic (ignores quest regions)
  W.coastDist = function (id, px, py) {
    const I = W.ISLES[id]; let f = blobF(I.e, I.seed, px, py);
    for (const l of I.lobes) f = Math.max(f, blobF(l, I.lobeSeed, px, py));
    return f;
  };
  const mixHex = (a, b, k) => [1, 3, 5].map(i => Math.round(parseInt(a.substr(i, 2), 16) * (1 - k) + parseInt(b.substr(i, 2), 16) * k));
  const rampRaw = (stops, d) => { if (d <= stops[0][0]) return mixHex(stops[0][1], stops[0][1], 0); for (let i = 1; i < stops.length; i++) if (d <= stops[i][0]) return mixHex(stops[i - 1][1], stops[i][1], (d - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0])); return mixHex(stops[stops.length - 1][1], stops[stops.length - 1][1], 0); };
  // colour ramps are looked up per half px of distance (the field has ~300k cells)
  const rampLUT = new Map();
  const ramp = (stops, d) => { let t = rampLUT.get(stops); if (!t) { t = []; for (let i = 0; i <= 256; i++) t.push(rampRaw(stops, i / 2)); rampLUT.set(stops, t); } return t[Math.max(0, Math.min(256, Math.round(d * 2)))]; };
  const CRETE_SAND = [[0, '#d9bf8a'], [5, '#ecd29c'], [10, '#f2dcaa'], [24, '#f4ddae']];
  function isleChamfer(F, L, D, gw, gh, C) {
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
      const k = j * gw + i, l = L[k];
      if ((i > 0 && L[k - 1] !== l) || (i < gw - 1 && L[k + 1] !== l) || (j > 0 && L[k - gw] !== l) || (j < gh - 1 && L[k + gw] !== l)) D[k] = Math.min(Math.abs(F[k]), C * 0.5);
    }
    const S = C * 1.4142;
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
      const k = j * gw + i; let d = D[k];
      if (i > 0) d = Math.min(d, D[k - 1] + C);
      if (j > 0) { d = Math.min(d, D[k - gw] + C); if (i > 0) d = Math.min(d, D[k - gw - 1] + S); if (i < gw - 1) d = Math.min(d, D[k - gw + 1] + S); }
      D[k] = d;
    }
    for (let j = gh - 1; j >= 0; j--) for (let i = gw - 1; i >= 0; i--) {
      const k = j * gw + i; let d = D[k];
      if (i < gw - 1) d = Math.min(d, D[k + 1] + C);
      if (j < gh - 1) { d = Math.min(d, D[k + gw] + C); if (i < gw - 1) d = Math.min(d, D[k + gw + 1] + S); if (i > 0) d = Math.min(d, D[k + gw - 1] + S); }
      D[k] = d;
    }
  }
  function isleField(id) {
    const I = W.ISLES[id];
    if (I.f && I.t === W.t) return I.f;
    const e = I.e, C = 4;
    const tx0 = Math.max(0, Math.floor(e.cx - e.rx * 1.12 - 7)), ty0 = Math.max(0, Math.floor(e.cy - e.ry * 1.12 - 7));
    const tx1 = Math.min(W.w, Math.ceil(e.cx + e.rx * 1.12 + 7)), ty1 = Math.min(W.h, Math.ceil(e.cy + e.ry * 1.12 + 7));
    const gw = (tx1 - tx0) * 4, gh = (ty1 - ty0) * 4, X0 = tx0 * TS, Y0 = ty0 * TS, n = gw * gh;
    const F = new Float32Array(n), L = new Uint8Array(n), D = new Float32Array(n).fill(1e9), inReg = new Uint8Array(n);
    // per tile: far from the shore one sample does for its 16 cells; near the shore (or in the quest region) every cell
    for (let ty = ty0; ty < ty1; ty++) for (let tx = tx0; tx < tx1; tx++) {
      const r = W.regionAt(tx, ty), reg = r && r.id === id && r.landAt, ft = reg ? 0 : W.coastDist(id, tx * TS + 8, ty * TS + 8), far = !reg && Math.abs(ft) > 40;
      for (let j = (ty - ty0) * 4, jj = j + 4; j < jj; j++) for (let i = (tx - tx0) * 4, ii = i + 4; i < ii; i++) {
        const px = X0 + i * C + 2, py = Y0 + j * C + 2, k = j * gw + i;
        let f;
        if (reg) { f = r.landAt(px - r.tx * TS, py - r.ty * TS) ? 2 : -2; inReg[k] = 1; }
        else f = far ? ft : W.coastDist(id, px, py);
        F[k] = f; L[k] = f > 0 ? 1 : 0;
      }
    }
    // distance to the shore: seed cells next to the other class, then a 2-pass chamfer (own function: stays optimised)
    isleChamfer(F, L, D, gw, gh, C);
    // the colour image (1 px = one 4 px cell), drawn smoothed
    const cv = document.createElement('canvas'); cv.width = gw; cv.height = gh;
    const cx = cv.getContext('2d'), img = cx.createImageData(gw, gh), P = img.data;
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
      const k = j * gw + i, d = D[k];
      if (d >= 100) continue; // far from the shore: transparent (most cells)
      const c = W.get(tx0 + (i >> 2), ty0 + (j >> 2));
      let rgb = null, a = 0;
      if (c === 'D' || c === 'p') a = 0;
      else if (!L[k]) { rgb = ramp(I.water, d); a = d < 84 ? 1 : Math.max(0, 1 - (d - 84) / 16); }
      else if (I.sand) { rgb = ramp(CRETE_SAND, d); a = d < 22 ? 1 : Math.max(0, 1 - (d - 22) / 12); }
      if (rgb) { P[k * 4] = rgb[0]; P[k * 4 + 1] = rgb[1]; P[k * 4 + 2] = rgb[2]; } P[k * 4 + 3] = Math.round(a * 255);
    }
    cx.putImageData(img, 0, 0);
    // shoreline: marching squares on F (cell centres), bucketed per world chunk (256 px)
    const segs = new Map(), add = (x0, y0, x1, y1) => {
      for (let by = Math.floor((Math.min(y0, y1) - 8) / 256); by <= Math.floor((Math.max(y0, y1) + 8) / 256); by++)
        for (let bx = Math.floor((Math.min(x0, x1) - 8) / 256); bx <= Math.floor((Math.max(x0, x1) + 8) / 256); bx++) { const kk = bx + ',' + by; if (!segs.has(kk)) segs.set(kk, []); segs.get(kk).push(x0, y0, x1, y1); }
    };
    for (let j = 0; j < gh - 1; j++) for (let i = 0; i < gw - 1; i++) {
      const k = j * gw + i, s4 = L[k] + L[k + 1] + L[k + gw] + L[k + gw + 1];
      if (s4 === 0 || s4 === 4) continue;
      if (inReg[k] || inReg[k + 1] || inReg[k + gw] || inReg[k + gw + 1]) continue; // the region draws its own shore
      const v = [F[k], F[k + 1], F[k + gw + 1], F[k + gw]];
      const bx = X0 + i * C + 2, by = Y0 + j * C + 2, corner = [[0, 0], [C, 0], [C, C], [0, C]];
      const pts = [];
      for (let q = 0; q < 4; q++) { const a = v[q], b = v[(q + 1) % 4]; if ((a > 0) !== (b > 0)) { const t = a / (a - b), p0 = corner[q], p1 = corner[(q + 1) % 4]; pts.push(bx + p0[0] + (p1[0] - p0[0]) * t, by + p0[1] + (p1[1] - p0[1]) * t); } }
      const onPier = (k0) => { const c = W.get(Math.floor((pts[k0] + pts[k0 + 2]) / 2 / TS), Math.floor((pts[k0 + 1] + pts[k0 + 3]) / 2 / TS)); return c === 'D' || c === 'p'; };
      if (pts.length >= 4 && !onPier(0)) add(pts[0], pts[1], pts[2], pts[3]);
      if (pts.length === 8 && !onPier(4)) add(pts[4], pts[5], pts[6], pts[7]);
    }
    I.f = { tx0, ty0, tx1, ty1, gw, gh, X0, Y0, L, D, cv, segs }; I.t = W.t;
    return I.f;
  }
  W.isleField = isleField;
  // does this tile hold any island land (for 'O' tiles that the smooth shore partly covers)?
  W.isleTileLand = function (id, tx, ty) {
    const f = isleField(id); if (tx < f.tx0 || ty < f.ty0 || tx >= f.tx1 || ty >= f.ty1) return false;
    // generous (one cell around the tile): land painted under water is hidden by the opaque water anyway
    for (let j = -1; j < 5; j++) for (let i = -1; i < 5; i++) {
      const cj = (ty - f.ty0) * 4 + j, ci = (tx - f.tx0) * 4 + i;
      if (ci >= 0 && cj >= 0 && ci < f.gw && cj < f.gh && f.L[cj * f.gw + ci]) return true;
    }
    return false;
  };
  // water colour at a world px (null = not near this island's shore); used by regions to blend their edges
  W.isleWaterCol = function (id, px, py) {
    const f = isleField(id), i = Math.floor((px - f.X0) / 4), j = Math.floor((py - f.Y0) / 4);
    if (i < 0 || j < 0 || i >= f.gw || j >= f.gh) return null;
    const k = j * f.gw + i; if (f.L[k] || f.D[k] > 84) return null;
    const c = ramp(W.ISLES[id].water, f.D[k]); return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
  };
  // paint the island's water, beach and shoreline into the world-px rect [X0,Y0]-[X1,Y1]; ctx is in world px (caller translates)
  W.paintCoast = function (x, id, X0, Y0, X1, Y1, waterOnly) {
    const f = isleField(id), I = W.ISLES[id];
    if (X1 < f.X0 || Y1 < f.Y0 || X0 > f.X0 + f.gw * 4 || Y0 > f.Y0 + f.gh * 4) return;
    const i0 = Math.max(0, Math.floor((X0 - f.X0) / 4) - 2), j0 = Math.max(0, Math.floor((Y0 - f.Y0) / 4) - 2);
    const i1 = Math.min(f.gw, Math.ceil((X1 - f.X0) / 4) + 2), j1 = Math.min(f.gh, Math.ceil((Y1 - f.Y0) / 4) + 2);
    if (i1 <= i0 || j1 <= j0) return;
    const ps = x.imageSmoothingEnabled; x.imageSmoothingEnabled = true;
    // pixel i covers world px [X0 + 4i, X0 + 4i + 4): its centre is the cell centre, so the smoothing is centred
    x.drawImage(f.cv, i0, j0, i1 - i0, j1 - j0, f.X0 + i0 * 4, f.Y0 + j0 * 4, (i1 - i0) * 4, (j1 - j0) * 4);
    x.imageSmoothingEnabled = ps;
    if (waterOnly) return;
    // shoreline strokes (segments of the chunks this rect touches)
    const segs = [];
    for (let by = Math.floor(Y0 / 256); by <= Math.floor((Y1 - 1) / 256); by++) for (let bx = Math.floor(X0 / 256); bx <= Math.floor((X1 - 1) / 256); bx++) { const s = f.segs.get(bx + ',' + by); if (s) segs.push(s); }
    if (!segs.length) return;
    const path = (dx, dy) => { x.beginPath(); for (const s of segs) for (let k = 0; k < s.length; k += 4) { x.moveTo(s[k] + dx, s[k + 1] + dy); x.lineTo(s[k + 2] + dx, s[k + 3] + dy); } };
    x.save(); x.lineCap = 'round'; x.lineJoin = 'round';
    if (I.ink) { // Milos: white rock straight into the sea: soft shadow on the water, foam ring, dark outline (same as the q4 cove)
      path(3, 4); x.strokeStyle = 'rgba(20,40,60,0.16)'; x.lineWidth = 5; x.stroke();
      path(0, 0); x.strokeStyle = 'rgba(255,255,255,0.55)'; x.lineWidth = 3.2; x.stroke();
      x.strokeStyle = 'rgba(28,20,36,0.85)'; x.lineWidth = 1.6; x.stroke();
    } else { // Crete: wet-sand line and a soft foam line at the water's edge
      path(0, 0); x.strokeStyle = 'rgba(170,140,90,0.35)'; x.lineWidth = 2.6; x.stroke();
      x.strokeStyle = 'rgba(255,255,255,0.8)'; x.lineWidth = 1.3; x.stroke();
    }
    x.restore();
  };
  // Milos white rock (Sarakiniko) painted in world px over a rect: soft hollows + wind-carved strata, seamless everywhere
  W.milosRockArea = function (x, X0, Y0, X1, Y1) {
    x.fillStyle = W.MILOS_COL.g; x.fillRect(X0, Y0, X1 - X0, Y1 - Y0);
    for (let j = Math.floor(Y0 / 48) - 1; j <= Math.floor(Y1 / 48) + 1; j++) for (let i = Math.floor(X0 / 64) - 1; i <= Math.floor(X1 / 64) + 1; i++) {
      const mx = i * 64 + 32 + (G.hash(i * 7 + 1, j * 3 + 2) - 0.5) * 30, my = j * 48 + 24 + (G.hash(i * 5 + 3, j * 11 + 1) - 0.5) * 20, rx = 40, ry = 18;
      if (mx + rx < X0 || mx - rx > X1 || my + ry < Y0 || my - ry > Y1) continue;
      x.save(); x.translate(mx, my); x.scale(1, ry / rx);
      const g = x.createRadialGradient(-6, -8, 2, 0, 0, rx);
      g.addColorStop(0, 'rgba(255,253,246,0.55)'); g.addColorStop(0.6, 'rgba(225,220,208,0.12)'); g.addColorStop(1, 'rgba(160,170,190,0.16)');
      x.fillStyle = g; x.beginPath(); x.arc(0, 0, rx, 0, 7); x.fill(); x.restore();
    }
    for (let k = Math.floor(Y0 / 7) - 2; k <= Math.floor(Y1 / 7) + 2; k++) {
      const ph = G.hash(k, 77) * 6.28, amp = 2.5 + G.hash(k, 91) * 3;
      const yAt = px => k * 7 + Math.sin(px / 23 + ph) * amp + Math.sin(px / 9 + ph * 2) * 0.8;
      for (const [o, col, lw] of [[0, 'rgba(150,140,120,0.22)', 0.7], [-0.9, 'rgba(255,255,255,0.55)', 0.6]]) {
        x.beginPath(); for (let px = X0 - 1; px <= X1 + 1; px += 2) { const yy = yAt(px) + o; if (px === X0 - 1) x.moveTo(px, yy); else x.lineTo(px, yy); }
        x.strokeStyle = col; x.lineWidth = lw; x.stroke();
      }
    }
    for (let ty = Math.floor(Y0 / TS); ty <= Math.floor((Y1 - 1) / TS); ty++) for (let tx = Math.floor(X0 / TS); tx <= Math.floor((X1 - 1) / TS); tx++) {
      const h = G.hash(tx * 13 + 7, ty * 17 + 3); if (h >= 0.08) continue;
      const sx = tx * TS + 3 + h * 120 % 10, sy = ty * TS + 4 + h * 70 % 8, rg = x.createRadialGradient(sx, sy, 0, sx, sy, 6);
      rg.addColorStop(0, 'rgba(214,170,100,0.35)'); rg.addColorStop(1, 'rgba(214,170,100,0)'); x.fillStyle = rg; x.fillRect(sx - 6, sy - 6, 12, 12);
    }
  };
  // ---- railway: drawn in world px and clipped per tile, so it is seamless across tiles and chunks ----
  const RAIL = {
    h: [{ y: 40, x0: 72, x1: 147 * 16 }, { y: 56, x0: 72, x1: 147 * 16 }, { y: 296, x0: -16, x1: 26 * 16 }, { y: 312, x0: -16, x1: 26 * 16 }],
    v: [{ x: 40, y0: 72, y1: 280 }, { x: 56, y0: 72, y1: 280 }],
    arcs: [{ cx: 72, cy: 72, r: 32, a0: Math.PI, a1: Math.PI * 1.5 }, { cx: 72, cy: 72, r: 16, a0: Math.PI, a1: Math.PI * 1.5 },
      { cx: 72, cy: 280, r: 32, a0: Math.PI / 2, a1: Math.PI }, { cx: 72, cy: 280, r: 16, a0: Math.PI / 2, a1: Math.PI }],
  };
  function paintRail(x, tx, ty) {
    const X0 = tx * TS, Y0 = ty * TS, crossing = inV(tx) && tx < MW && ty < MH && ty > 5; // level crossing over a road
    const isR = (dx, dy) => { const c = W.get(tx + dx, ty + dy); return c === 'r' || c === 'q'; };
    if (crossing) { x.fillStyle = PAL.road; x.fillRect(0, 0, 16, 16); }
    else {
      x.fillStyle = '#a39488'; x.fillRect(0, 0, 16, 16); // ballast bed
      for (let i = 0; i < 7; i++) { // gravel
        const h1 = G.hash(X0 + i * 7, Y0 + i * 13), h2 = G.hash(Y0 + i * 5, X0 - i * 3);
        x.fillStyle = i % 2 ? 'rgba(255,245,235,0.22)' : 'rgba(60,40,60,0.2)'; x.beginPath(); x.ellipse(1 + h1 * 14, 1 + h2 * 14, 1, 0.7, 0, 0, 7); x.fill();
      }
      x.fillStyle = 'rgba(70,40,70,0.28)'; // shoulders where the bed meets other ground
      if (!isR(0, -1)) x.fillRect(0, 0, 16, 1.5); if (!isR(0, 1)) x.fillRect(0, 14.5, 16, 1.5);
      if (!isR(-1, 0) && tx > 0) x.fillRect(0, 0, 1.5, 16); if (!isR(1, 0)) x.fillRect(14.5, 0, 1.5, 16);
    }
    x.save(); x.beginPath(); x.rect(0, 0, 16, 16); x.clip(); x.translate(-X0, -Y0);
    const near = (ax0, ay0, ax1, ay1) => ax1 > X0 - 10 && ax0 < X0 + 26 && ay1 > Y0 - 10 && ay0 < Y0 + 26;
    const sleeper = (cx, cy, ang) => {
      if (crossing) return;
      x.save(); x.translate(cx, cy); x.rotate(ang);
      x.fillStyle = 'rgba(50,25,50,0.3)'; x.fillRect(-0.8, -6, 2.6, 13);
      x.fillStyle = '#7a5238'; x.fillRect(-1.3, -6.5, 2.6, 13); x.fillStyle = 'rgba(255,225,190,0.3)'; x.fillRect(-1.3, -6.5, 0.8, 13);
      x.restore();
    };
    const hs = RAIL.h.filter(l => near(l.x0, l.y - 8, l.x1, l.y + 8)), vs = RAIL.v.filter(l => near(l.x - 8, l.y0, l.x + 8, l.y1)), as = RAIL.arcs.filter(a => near(a.cx - a.r - 8, a.cy - a.r - 8, a.cx + a.r + 8, a.cy + a.r + 8));
    // sleepers on a fixed 8 px world grid, always perpendicular to the track
    for (const l of hs) for (let sx = Math.floor((X0 - 8) / 8) * 8 + 4; sx < X0 + 24; sx += 8) if (sx > l.x0 && sx < l.x1) sleeper(sx, l.y, 0);
    for (const l of vs) for (let sy = Math.floor((Y0 - 8) / 8) * 8 + 4; sy < Y0 + 24; sy += 8) if (sy > l.y0 && sy < l.y1) sleeper(l.x, sy, Math.PI / 2);
    for (const a of as) { const n = Math.round((a.a1 - a.a0) * a.r / 8); for (let k = 0; k < n; k++) { const t = a.a0 + (k + 0.5) * (a.a1 - a.a0) / n; sleeper(a.cx + Math.cos(t) * a.r, a.cy + Math.sin(t) * a.r, t - Math.PI / 2); } }
    // two steel rails per track: dark foot + bright head lit from the top-left
    x.lineCap = 'butt';
    for (const [col, lw, o] of [['#3a3240', 1.8, 0.35], ['#d9dde8', 0.9, -0.3]]) {
      x.strokeStyle = col; x.lineWidth = lw; x.beginPath();
      for (const l of hs) for (const s of [-4.5, 4.5]) { x.moveTo(Math.max(l.x0, X0 - 4), l.y + s + o); x.lineTo(Math.min(l.x1, X0 + 20), l.y + s + o); }
      for (const l of vs) for (const s of [-4.5, 4.5]) { x.moveTo(l.x + s + o, Math.max(l.y0, Y0 - 4)); x.lineTo(l.x + s + o, Math.min(l.y1, Y0 + 20)); }
      for (const a of as) for (const s of [-4.5, 4.5]) { x.moveTo(a.cx + o + Math.cos(a.a0) * (a.r + s), a.cy + o + Math.sin(a.a0) * (a.r + s)); x.arc(a.cx + o, a.cy + o, a.r + s, a.a0, a.a1); }
      x.stroke();
    }
    x.restore();
  }
  // Milos ground: soft white rock with smooth rounded forms (blue-grey shading bottom-right, light top-left)
  function milosRock(x, tx, ty) {
    const X0 = tx * TS, Y0 = ty * TS;
    x.save(); x.beginPath(); x.rect(0, 0, 16, 16); x.clip(); x.translate(-X0, -Y0);
    W.milosRockArea(x, X0, Y0, X0 + 16, Y0 + 16);
    x.restore();
  }
  // a little urban grime on pavements (stains, cigarette butts, litter), sparse
  function grime(x, tx, ty) {
    if (tx >= MW || ty >= MH) return;
    const g = G.hash(tx * 17 + 5, ty * 23 + 11), a = G.hash(ty * 7 + 3, tx * 5 + 1);
    if (g < 0.06) {
      const sx = 4 + a * 8, sy = 4 + g * 120 % 8, rg = x.createRadialGradient(sx, sy, 0, sx, sy, 4.5);
      rg.addColorStop(0, 'rgba(80,50,80,0.2)'); rg.addColorStop(1, 'rgba(80,50,80,0)'); x.fillStyle = rg; x.fillRect(sx - 5, sy - 5, 10, 10);
    } else if (g < 0.14) {
      for (let k = 0; k < 2; k++) { const bx = 2 + G.hash(tx + k, ty * 3) * 11, by = 2 + G.hash(ty + k, tx * 3) * 12; x.fillStyle = '#f2ede4'; x.fillRect(bx, by, 2, 0.8); x.fillStyle = '#d88a3c'; x.fillRect(bx + 2, by, 0.9, 0.8); }
    } else if (g < 0.175) {
      const bx = 3 + a * 9, by = 4 + g * 90 % 8;
      x.fillStyle = '#f4f1ea'; x.strokeStyle = 'rgba(90,80,90,0.6)'; x.lineWidth = 0.4; x.beginPath(); x.ellipse(bx, by, 1.8, 1.3, a * 3, 0, 7); x.fill(); x.stroke();
    } else if (g < 0.195) {
      const bx = 3 + a * 9, by = 5 + g * 70 % 7;
      x.save(); x.translate(bx, by); x.rotate(a * 6); x.fillStyle = a < 0.5 ? '#d0302c' : '#c9c9cf'; x.fillRect(-1.6, -0.8, 3.2, 1.6); x.fillStyle = 'rgba(255,255,255,0.5)'; x.fillRect(-1.6, -0.8, 3.2, 0.5); x.restore();
    }
  }
  const isRoadish = (tx, ty) => { const c = W.get(tx, ty); return c === 'R' || c === 'k'; };
  function paintTile(x, tx, ty) {
    const c = W.get(tx, ty), r = G.hash(tx, ty);
    const P = (a, b, w, h, col) => { x.fillStyle = col; x.fillRect(a, b, w, h); };
    const grass = () => { P(0, 0, 16, 16, PAL.grass); if (r < 0.3) { P(3, 5, 1, 2, PAL.grassD); P(4, 4, 1, 1, PAL.grassD); P(10, 11, 1, 2, PAL.grassD); P(11, 10, 1, 1, PAL.grassD); } if (r > 0.85) { P(7, 7, 2, 1, PAL.grassL); } };
    // islands: the water / beach near the shore is painted per chunk by W.paintCoast; here only the land underneath.
    // 'O' tiles that the smooth shoreline partly covers get land under it too.
    const ar = (c === 'g' || c === 'T' || c === 'K' || c === 's' || c === 'p' || c === 'O') ? W.area(tx, ty) : '';
    const isleLand = c === 'O' && (ar === 'milos' || ar === 'crete') && W.isleTileLand(ar, tx, ty);
    if (ar === 'milos' && ((c !== 'K' && c !== 'O') || isleLand)) {
      milosRock(x, tx, ty); // white rock right down to the sea, like the q4 cove's cliffs
      if (c === 'p') { x.fillStyle = 'rgba(222,212,192,0.8)'; x.fillRect(0, 0, 16, 16); if (r < 0.4) P(Math.floor(r * 30) % 14, Math.floor(r * 77) % 14, 2, 1, '#cfc4ac'); }
      return;
    }
    const creteGrass = () => { P(0, 0, 16, 16, '#b4bc68'); if (r < 0.35) { x.strokeStyle = '#8f9a4a'; x.lineWidth = 0.7; x.beginPath(); x.moveTo(4, 10); x.quadraticCurveTo(5, 6, 7, 5); x.moveTo(10, 13); x.quadraticCurveTo(11, 9, 12, 8); x.stroke(); } };
    if (ar === 'crete' && (c === 'g' || c === 's' || c === 'T' || isleLand || (c === 'K' && G.CRETE_ART))) { creteGrass(); return; } // olives, boulders, tints: G.CRETE_ART
    if (ar === 'crete' && c === 'p') { // dirt track in the q5 region's colours, soft rounded edges toward the grass
      creteGrass();
      const op = (dx, dy) => { const n = W.get(tx + dx, ty + dy); return n === 'p' || n === 'D' || n === 'Z'; };
      const oL = op(-1, 0), oR = op(1, 0), oT = op(0, -1), oB = op(0, 1);
      const l = oL ? 0 : 2.5, rt = oR ? 16 : 13.5, t = oT ? 0 : 2.5, b = oB ? 16 : 13.5;
      const rad = k => [!oL && !oT ? k : 0, !oR && !oT ? k : 0, !oR && !oB ? k : 0, !oL && !oB ? k : 0]; // round only the outer corners
      const box = (a, c, w, h, k) => { x.beginPath(); if (x.roundRect) x.roundRect(a, c, w, h, rad(k)); else x.rect(a, c, w, h); x.fill(); };
      x.fillStyle = 'rgba(196,150,96,0.3)'; box(oL ? 0 : l - 2, oT ? 0 : t - 2, (oR ? 16 : rt + 2) - (oL ? 0 : l - 2), (oB ? 16 : b + 2) - (oT ? 0 : t - 2), 5);
      x.fillStyle = '#f0e2b8'; box(l, t, rt - l, b - t, 4);
      if (r < 0.4) P(3 + Math.floor(r * 30) % 9, 3 + Math.floor(r * 77) % 9, 2, 1, 'rgba(176,150,100,0.6)');
      return;
    }
    switch (c) {
      case '~': case 'T': case 'B': grass(); break;
      case 'F': grass(); for (const [a, b, col] of [[3, 3, '#ff7fb0'], [10, 4, '#f8f8f8'], [6, 10, '#ffd040'], [12, 11, '#ff7fb0']]) { P(a, b, 2, 2, col); P(a, b + 2, 1, 1, PAL.grassD); } break;
      case 'p': {
        P(0, 0, 16, 16, PAL.path);
        if (r < 0.4) P(Math.floor(r * 30) % 14, Math.floor(r * 77) % 14, 2, 1, PAL.pathD);
        const g = (dx, dy) => { const n = W.get(tx + dx, ty + dy); return n === '~' || n === 'T' || n === 'F'; };
        if (g(0, -1)) P(0, 0, 16, 2, PAL.grassD); if (g(0, 1)) P(0, 14, 16, 2, PAL.pathD); if (g(-1, 0)) P(0, 0, 2, 16, PAL.pathD); if (g(1, 0)) P(14, 0, 2, 16, PAL.pathD);
        grime(x, tx, ty);
        break;
      }
      case 'S': { P(0, 0, 16, 16, PAL.plaza); P(0, 0, 16, 1, PAL.plazaD); P(0, 0, 1, 16, PAL.plazaD); P(8, 0, 1, 8, PAL.plazaD); P(0, 8, 16, 1, PAL.plazaD); P(4, 8, 1, 8, PAL.plazaD); grime(x, tx, ty); break; }
      case '.': {
        P(0, 0, 16, 16, PAL.side); P(0, 0, 16, 1, '#f2e4dc'); P(0, 8, 16, 1, PAL.sideD); P(r < 0.5 ? 5 : 11, 0, 1, 8, PAL.sideD); P(r < 0.5 ? 12 : 3, 8, 1, 8, PAL.sideD);
        grime(x, tx, ty);
        if (isRoadish(tx, ty + 1)) P(0, 13, 16, 3, PAL.curb); if (isRoadish(tx, ty - 1)) P(0, 0, 16, 2, PAL.curb);
        if (isRoadish(tx + 1, ty)) P(13, 0, 3, 16, PAL.curb); if (isRoadish(tx - 1, ty)) P(0, 0, 2, 16, PAL.curb);
        break;
      }
      case 'R': {
        P(0, 0, 16, 16, PAL.road);
        for (let i = 0; i < 4; i++) P(Math.floor(G.hash(tx * 3 + i, ty) * 16), Math.floor(G.hash(tx, ty * 3 + i) * 16), 1, 1, i % 2 ? PAL.roadD : PAL.roadL);
        // centre dashes: road is 4 wide; centre line between tile 1 and 2 of the road
        for (const h of W.ROADS.h) if (ty === h.y + 1 && !inV(tx)) { if (tx % 3 !== 0) P(2, 15, 10, 1, PAL.line); }
        for (const h of W.ROADS.h) if (ty === h.y + 2 && !inV(tx)) { if (tx % 3 !== 0) P(2, 0, 10, 1, PAL.line); }
        for (const v of W.ROADS.v) if (tx === v.x + 1 && !inH(ty)) { if (ty % 3 !== 0) P(15, 2, 1, 10, PAL.line); }
        for (const v of W.ROADS.v) if (tx === v.x + 2 && !inH(ty)) { if (ty % 3 !== 0) P(0, 2, 1, 10, PAL.line); }
        // zebra crossings next to junctions
        for (const v of W.ROADS.v) if (!inV(tx) && (tx === v.x - 1 || tx === v.x + 4) && inH(ty)) for (let i = 1; i < 16; i += 4) P(i, 2, 2, 12, PAL.line);
        for (const h of W.ROADS.h) if (!inH(ty) && (ty === h.y - 1 || ty === h.y + 4) && inV(tx)) for (let i = 1; i < 16; i += 4) P(2, i, 12, 2, PAL.line);
        // Greek road condition: patches (μπαλώματα), cracks (ρωγμές), potholes (λακκούβες)
        const r2 = G.hash(tx * 7 + 3, ty * 11 + 5), r3 = G.hash(tx * 13 + 1, ty * 5 + 9);
        if (r2 < 0.12) { const w = 6 + Math.floor(r3 * 8), h = 5 + Math.floor(r2 * 30) % 6, ox = Math.floor(r3 * (16 - w)), oy = Math.floor(G.hash(tx, ty * 3) * (16 - h)); P(ox, oy, w, h, r3 < 0.5 ? '#4c4858' : '#6c6878'); P(ox, oy, w, 1, r3 < 0.5 ? '#423e4e' : '#787486'); }
        if (r3 < 0.14) { let cx = Math.floor(r2 * 12) + 2, cy = 1; x.fillStyle = '#36323f'; for (let i = 0; i < 9; i++) { x.fillRect(cx, cy, 1, 2); cx += (G.hash(tx + i, ty) < 0.5 ? -1 : 1); cy += 2; if (cy > 15) break; } x.fillRect(cx, Math.min(cy, 14), 3, 1); }
        if (W.isPothole(tx, ty)) { x.fillStyle = '#7a7688'; x.beginPath(); x.ellipse(8, 8, 6, 4.5, 0, 0, 7); x.fill(); x.fillStyle = '#2c2832'; x.beginPath(); x.ellipse(8, 8.5, 5, 3.5, 0, 0, 7); x.fill(); x.fillStyle = '#4a7a9a'; x.fillRect(6, 9, 4, 1); x.fillStyle = '#8a8698'; x.fillRect(3, 4, 2, 1); x.fillRect(12, 12, 1, 1); }
        if (tx < MW && ty < MH && G.hash(tx * 29 + 1, ty * 31 + 7) < 0.05) { const sx = 3 + r * 10, sy = 3 + r2 * 10, rg = x.createRadialGradient(sx, sy, 0, sx, sy, 4); rg.addColorStop(0, 'rgba(30,20,40,0.3)'); rg.addColorStop(1, 'rgba(30,20,40,0)'); x.fillStyle = rg; x.fillRect(sx - 4, sy - 4, 8, 8); } // oil stain
        break;
      }
      case 'k': { // roadworks: closed lane, dug-up patch in the middle, hazard chevrons at the ends
        P(0, 0, 16, 16, PAL.road);
        const rw = (W.ROADWORKS || []).find(o => tx >= o.x && tx < o.x + o.w && ty >= o.y && ty < o.y + o.h); if (!rw) break;
        const X0 = tx * TS, Y0 = ty * TS, hz = rw.axis === 'h', sx0 = rw.x * TS, sy0 = rw.y * TS, sw = rw.w * TS, sh = rw.h * TS;
        x.save(); x.beginPath(); x.rect(0, 0, 16, 16); x.clip(); x.translate(-X0, -Y0);
        // hazard chevrons on the end tiles
        x.fillStyle = 'rgba(255,190,40,0.85)';
        for (const e of [0, 1]) {
          const ex = hz ? (e ? sx0 + sw - 16 : sx0) : sx0, ey = hz ? sy0 : (e ? sy0 + sh - 16 : sy0), ew = hz ? 16 : sw, eh = hz ? sh : 16;
          for (let k = -2; k < 4; k++) { x.beginPath(); if (hz) { x.moveTo(ex, ey + k * 10); x.lineTo(ex + 16, ey + k * 10 + 8); x.lineTo(ex + 16, ey + k * 10 + 12); x.lineTo(ex, ey + k * 10 + 4); } else { x.moveTo(ex + k * 10, ey); x.lineTo(ex + k * 10 + 8, ey + 16); x.lineTo(ex + k * 10 + 12, ey + 16); x.lineTo(ex + k * 10 + 4, ey); } x.closePath(); x.save(); x.clip(new Path2D(`M${ex} ${ey}h${ew}v${eh}h${-ew}z`)); x.fill(); x.restore(); }
        }
        // dug-up patch: dirt with a darker trench and a few stones
        const dx0 = hz ? sx0 + 20 : sx0 + 4, dy0 = hz ? sy0 + 4 : sy0 + 20, dw = hz ? sw - 40 : sw - 8, dh = hz ? sh - 8 : sh - 40;
        let g = x.createLinearGradient(dx0, dy0, dx0 + dw * 0.3, dy0 + dh); g.addColorStop(0, '#b4835a'); g.addColorStop(1, '#8a5c3c');
        x.fillStyle = 'rgba(60,30,50,0.3)'; x.beginPath(); x.roundRect ? x.roundRect(dx0 - 1, dy0 - 1, dw + 2, dh + 2, 7) : x.rect(dx0 - 1, dy0 - 1, dw + 2, dh + 2); x.fill();
        x.fillStyle = g; x.beginPath(); x.roundRect ? x.roundRect(dx0, dy0, dw, dh, 6) : x.rect(dx0, dy0, dw, dh); x.fill();
        g = x.createLinearGradient(0, dy0 + dh * 0.3, 0, dy0 + dh * 0.7); g.addColorStop(0, '#4a2e22'); g.addColorStop(1, '#6a4430');
        x.fillStyle = g; x.beginPath(); x.ellipse(dx0 + dw / 2, dy0 + dh / 2, dw * 0.36, dh * 0.24, 0, 0, 7); x.fill();
        for (let i = 0; i < 10; i++) { const px = dx0 + 3 + G.hash(i, rw.x) * (dw - 6), py = dy0 + 3 + G.hash(rw.y, i) * (dh - 6); x.fillStyle = '#c9b8a6'; x.beginPath(); x.ellipse(px, py, 1.4, 1, 0, 0, 7); x.fill(); x.fillStyle = 'rgba(255,255,255,0.5)'; x.fillRect(px - 0.8, py - 0.8, 0.8, 0.5); }
        x.restore();
        break;
      }
      case 'C': { // basketball half-court: terracotta floor, teal key and margin, white lines (world px, seamless)
        const C = W.COURT, X0 = tx * TS, Y0 = ty * TS, cx0 = C.x * TS, cy0 = C.y * TS, cw = C.w * TS, chh = C.h * TS, rx = C.ground[0], gy = C.ground[1];
        x.save(); x.beginPath(); x.rect(0, 0, 16, 16); x.clip(); x.translate(-X0, -Y0);
        x.fillStyle = '#3f9e86'; x.fillRect(cx0, cy0, cw, chh);
        x.fillStyle = '#e48a5c'; x.fillRect(cx0 + 5, cy0 + 4, cw - 10, chh - 6);
        x.fillStyle = '#2f8f96'; x.fillRect(rx - 16, cy0 + 4, 32, 42);
        let g = x.createLinearGradient(cx0, cy0, cx0 + cw, cy0 + chh); g.addColorStop(0, 'rgba(255,240,230,0.12)'); g.addColorStop(1, 'rgba(90,30,100,0.12)');
        x.fillStyle = g; x.fillRect(cx0, cy0, cw, chh);
        x.strokeStyle = 'rgba(255,255,255,0.92)'; x.lineWidth = 1.1;
        x.strokeRect(cx0 + 5, cy0 + 4, cw - 10, chh - 6); x.strokeRect(rx - 16, cy0 + 4, 32, 42);
        x.beginPath(); x.arc(rx, cy0 + 46, 12, 0, Math.PI * 2); x.stroke();
        x.beginPath(); x.moveTo(rx - 52, cy0 + 4); x.lineTo(rx - 52, gy); x.arc(rx, gy, 52, Math.PI, 0, true); x.lineTo(rx + 52, cy0 + 4); x.stroke();
        x.beginPath(); x.arc(rx, cy0 + chh - 2, 14, Math.PI, 0); x.stroke();
        x.beginPath(); x.arc(rx, gy, 6, 0, Math.PI); x.stroke(); // no-charge semicircle
        x.restore();
        break;
      }
      case 'W': {
        P(0, 0, 16, 16, PAL.water); if ((tx + ty) % 2 === 0) { P(3, 4, 4, 1, PAL.waterL); P(9, 10, 5, 1, PAL.waterL); }
        if (W.get(tx, ty - 1) !== 'W') P(0, 0, 16, 3, '#d4c4b8'); if (W.get(tx - 1, ty) !== 'W') P(0, 0, 2, 16, '#d4c4b8'); if (W.get(tx + 1, ty) !== 'W') P(14, 0, 2, 16, '#d4c4b8'); if (W.get(tx, ty + 1) !== 'W') P(0, 14, 16, 2, '#d4c4b8');
        break;
      }
      case 'f': { const g = W.get(tx, ty - 1); grass(); P(0, 6, 16, 2, '#a07848'); P(0, 11, 16, 2, '#a07848'); P(1, 4, 2, 11, '#c09060'); P(9, 4, 2, 11, '#c09060'); P(1, 4, 2, 1, '#e0b080'); P(9, 4, 2, 1, '#e0b080'); break; }
      case 'r': case 'q': paintRail(x, tx, ty); break;
      case 'P': { P(0, 0, 16, 16, tx % 2 ? PAL.pitch : PAL.pitchL); const p = W.places.pitch; if (p) { if (tx === p.x || tx === p.x + p.w - 1) P(tx === p.x ? 0 : 14, 0, 2, 16, '#f4f4f4'); if (ty === p.y || ty === p.y + p.h - 1) P(0, ty === p.y ? 0 : 14, 16, 2, '#f4f4f4'); if (tx === p.x + Math.floor(p.w / 2)) P(0, 0, 1, 16, '#f4f4f4'); } break; }
      case 'O': { // sea: turquoise near the shore, deeper blue away from it, soft wave strokes
        // (piers don't tint the water around them: no square turquoise rings)
        let near = 9; for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const n = W.get(tx + dx, ty + dy); if (n !== 'O' && n !== 'Z' && n !== 'D') near = Math.min(near, Math.max(Math.abs(dx), Math.abs(dy))); }
        P(0, 0, 16, 16, W.SEA_COLS[Math.min(4, near)]);
        if (r < 0.18) { x.strokeStyle = 'rgba(255,255,255,0.35)'; x.lineWidth = 0.8; x.beginPath(); const wx = 2 + r * 40 % 9, wy = 4 + (r * 97 % 8); x.moveTo(wx, wy); x.quadraticCurveTo(wx + 3, wy - 2, wx + 6, wy); x.stroke(); }
        if (near === 1) { x.fillStyle = 'rgba(255,255,255,0.22)'; for (const [dx, dy, a, b, w, h] of [[0, -1, 0, 0, 16, 2], [0, 1, 0, 14, 16, 2], [-1, 0, 0, 0, 2, 16], [1, 0, 14, 0, 2, 16]]) { const n = W.get(tx + dx, ty + dy); if (n !== 'O' && n !== 'Z' && n !== 'w' && n !== 'D') x.fillRect(a, b, w, h); } }
        break;
      }
      case 'w': { // shallow water: light turquoise over visible sand, soft ripples, foam at the waterline
        const X0 = tx * TS, Y0 = ty * TS;
        let d = 0; while (d < 4 && W.get(tx, ty - d - 1) === 'w') d++;
        const COLS = ['#a8ecd8', '#82dfd6', '#62cfda', '#4cc2df'], last = W.get(tx, ty + 1) !== 'w';
        let g = x.createLinearGradient(0, 0, 0, 16); g.addColorStop(0, COLS[Math.min(3, d)]); g.addColorStop(1, last ? W.SEA_COLS[1] : COLS[Math.min(3, d + 1)]);
        x.fillStyle = g; x.fillRect(0, 0, 16, 16);
        x.save(); x.beginPath(); x.rect(0, 0, 16, 16); x.clip(); x.translate(-X0, -Y0);
        // sand ripples seen through the water (world-continuous sine bands)
        x.strokeStyle = `rgba(255,244,205,${0.22 - d * 0.05})`; x.lineWidth = 1;
        for (let yy = Y0 + 3; yy < Y0 + 16; yy += 5) { x.beginPath(); for (let xx = X0 - 2; xx <= X0 + 18; xx += 2) { const v = yy + Math.sin(xx / 7 + yy * 0.9) * 1.2; xx === X0 - 2 ? x.moveTo(xx, v) : x.lineTo(xx, v); } x.stroke(); }
        // light ripples on the surface
        if (r < 0.5) { x.strokeStyle = 'rgba(255,255,255,0.45)'; x.lineWidth = 0.7; const wx = X0 + 2 + r * 20 % 9, wy = Y0 + 4 + r * 97 % 8; x.beginPath(); x.moveTo(wx, wy); x.quadraticCurveTo(wx + 2.5, wy - 1.6, wx + 5, wy); x.stroke(); }
        // foam where the water meets the sand
        if (d === 0) {
          x.fillStyle = 'rgba(255,255,255,0.75)'; x.beginPath(); x.moveTo(X0 - 1, Y0);
          for (let xx = X0 - 1; xx <= X0 + 17; xx += 2) x.lineTo(xx, Y0 + 2.2 + Math.sin(xx / 5.5) * 1 + Math.sin(xx / 2.3) * 0.4);
          x.lineTo(X0 + 17, Y0); x.closePath(); x.fill();
          x.strokeStyle = 'rgba(255,255,255,0.45)'; x.lineWidth = 0.6; x.beginPath();
          for (let xx = X0 - 1; xx <= X0 + 17; xx += 2) { const v = Y0 + 5 + Math.sin(xx / 4.5 + 1) * 0.9; xx === X0 - 1 ? x.moveTo(xx, v) : x.lineTo(xx, v); } x.stroke();
        }
        x.restore();
        break;
      }
      case 's': {
        P(0, 0, 16, 16, '#f4ddae'); if (r < 0.5) { P(Math.floor(r * 31) % 14, Math.floor(r * 71) % 14, 1, 1, '#dcbf86'); P(Math.floor(r * 53) % 14, Math.floor(r * 13) % 14, 1, 1, '#fff2cc'); }
        if (W.get(tx, ty + 1) === 'w') { const g = x.createLinearGradient(0, 9, 0, 16); g.addColorStop(0, 'rgba(190,150,100,0)'); g.addColorStop(1, 'rgba(190,150,100,0.4)'); x.fillStyle = g; x.fillRect(0, 9, 16, 7); } // wet sand
        break;
      }
      case 'g': { P(0, 0, 16, 16, '#b4bc68'); if (r < 0.35) { x.strokeStyle = '#8f9a4a'; x.lineWidth = 0.7; x.beginPath(); x.moveTo(4, 10); x.quadraticCurveTo(5, 6, 7, 5); x.moveTo(10, 13); x.quadraticCurveTo(11, 9, 12, 8); x.stroke(); } break; }
      case 'Y': { // wheat (σιτάρι)
        P(0, 0, 16, 16, '#e2c25a');
        for (let i = 1; i < 16; i += 4) { P(0, i, 16, 1.4, '#c9a23e'); P(0, i + 1.4, 16, 0.8, '#f3dc86'); }
        break;
      }
      case 'L': { // ploughed soil
        P(0, 0, 16, 16, '#9a6c44');
        for (let i = 2; i < 16; i += 4) { P(0, i, 16, 1.6, '#7a5232'); P(0, i + 1.6, 16, 0.8, '#b08258'); }
        break;
      }
      case 'K': { // boulder / rock face (solid)
        const ar = W.area(tx, ty), base = ar === 'milos' ? '#f6f5f0' : ar === 'crete' ? '#c8b08a' : '#9a968e';
        if (ar === 'milos') { // low smooth wind-carved ledge, not a ball
          milosRock(x, tx, ty);
          x.fillStyle = 'rgba(120,130,160,0.2)'; x.beginPath(); x.ellipse(9, 12, 8, 3, 0, 0, 7); x.fill();
          const gm = x.createLinearGradient(0, 4, 0, 13); gm.addColorStop(0, '#fffdf6'); gm.addColorStop(0.6, '#ece4d2'); gm.addColorStop(1, '#cfc7b6');
          x.fillStyle = gm; x.strokeStyle = 'rgba(140,130,115,0.45)'; x.lineWidth = 0.6; x.beginPath();
          x.moveTo(0.5, 11); x.bezierCurveTo(2, 5, 6, 6, 9, 5); x.bezierCurveTo(13, 4, 15.5, 7, 15.5, 11); x.quadraticCurveTo(8, 13.5, 0.5, 11); x.fill(); x.stroke();
          x.strokeStyle = 'rgba(150,140,120,0.3)'; x.beginPath(); x.moveTo(3, 9); x.quadraticCurveTo(8, 7.5, 13, 9); x.stroke();
          break;
        } else P(0, 0, 16, 16, ar === 'crete' ? '#b4bc68' : '#5f8a48');
        x.fillStyle = ar === 'milos' ? 'rgba(90,110,150,0.22)' : 'rgba(20,10,30,0.3)'; x.beginPath(); x.ellipse(9.5, 11.5, 7, 4.5, 0, 0, 7); x.fill();
        const g = x.createRadialGradient(5, 4, 1, 8, 8, 9); g.addColorStop(0, G.shade(base, 0.25)); g.addColorStop(0.6, base); g.addColorStop(1, ar === 'milos' ? '#c4ccd8' : G.shade(base, -0.35));
        x.fillStyle = g; x.strokeStyle = ar === 'milos' ? 'rgba(70,80,110,0.55)' : 'rgba(28,20,36,0.85)'; x.lineWidth = 0.7; x.beginPath();
        x.moveTo(1.5, 10); x.quadraticCurveTo(1, 3, 7, 1.5); x.quadraticCurveTo(14.5, 1.5, 14.5, 9); x.quadraticCurveTo(14, 14, 8, 14); x.quadraticCurveTo(2, 14, 1.5, 10); x.fill(); x.stroke();
        break;
      }
      case 'D': { // wooden pier
        P(0, 0, 16, 16, '#5fb6ea');
        P(0, 0, 16, 16, '#a8794a'); for (let i = 0; i < 16; i += 4) { P(0, i, 16, 0.7, '#6e4a2a'); P(0, i + 0.7, 16, 0.6, '#c89a68'); }
        if (W.get(tx - 1, ty) !== 'D') P(0, 0, 1.2, 16, '#4a3018'); if (W.get(tx + 1, ty) !== 'D') P(14.8, 0, 1.2, 16, '#4a3018');
        break;
      }
      case 'Z': break; // painted by the region
      case 'H': { P(0, 0, 16, 16, '#6b6f78'); const p = [W.places.helipad, W.places.helipad_milos].find(q => q && tx >= q.x && tx < q.x + q.w && ty >= q.y && ty < q.y + q.h) || W.places.helipad; if (tx === p.x + 2 && ty >= p.y + 1 && ty <= p.y + p.h - 2) { P(4, 0, 2, 16, '#ffd400'); P(10, 0, 2, 16, '#ffd400'); P(4, 7, 8, 2, '#ffd400'); } break; }
    }
  }
  const inV = tx => W.ROADS.v.some(v => tx >= v.x && tx < v.x + 4);
  const inH = ty => W.ROADS.h.some(h => ty >= h.y && ty < h.y + 4);

  // ---------- buildings (3/4 view, Pokémon style) ----------
  function paintBuilding(x, b) {
    const w = b.w * TS, h = b.h * TS;
    const P = (a, c, ww, hh, col) => { x.fillStyle = col; x.fillRect(a, c, ww, hh); };
    const flatRoof = ['apart', 'bank', 'police', 'tax', 'parliament'].includes(b.type);
    const roof = G.shade(b.roof, flatRoof ? -0.42 : -0.12), roofD = G.shade(roof, -0.25), roofL = G.shade(roof, 0.18), wall = G.shade(b.wall, -0.12), wallD = G.shade(wall, -0.2);
    const tall = b.type === 'apart' ? 0.62 : b.type === 'parliament' ? 0.55 : 0.45; // fraction of height that is wall
    const wallH = Math.round(h * tall / 8) * 8, roofH = h - wallH;
    // wall
    P(0, roofH, w, wallH, wall); P(0, h - 3, w, 3, wallD); P(0, roofH, 2, wallH, wallD); P(w - 2, roofH, 2, wallH, wallD);
    // roof
    if (b.type === 'apart' || b.type === 'bank' || b.type === 'police' || b.type === 'tax' || b.type === 'parliament') {
      // flat roof with parapet
      P(0, 0, w, roofH, roof); P(0, 0, w, 3, roofL); P(0, roofH - 3, w, 3, roofD); P(0, 0, 3, roofH, roofL); P(w - 3, 0, 3, roofH, roofD);
      if (b.type === 'apart') { // ταράτσα: ηλιακοί, κεραίες, δεξαμενή, πιάτο, κλιματιστικά, σκοινί με ρούχα
        // tiles pattern
        for (let yy = 4; yy < roofH - 3; yy += 6) for (let xx = 4; xx < w - 4; xx += 6) P(xx, yy, 5, 5, G.shade(roof, (xx + yy) % 12 ? -0.04 : 0.04));
        // stairwell box (κλιμακοστάσιο)
        P(w - 26, 4, 18, 14, G.shade(roof, -0.15)); P(w - 26, 4, 18, 3, G.shade(roof, 0.15)); P(w - 20, 10, 6, 8, '#6b4a2b');
        // solar heaters
        const nh = Math.max(1, Math.floor((w - 40) / 22));
        for (let i = 0; i < nh; i++) { const sx = 5 + i * 22; P(sx, 5, 18, 4, '#e8e8e8'); P(sx + 2, 4, 3, 1, '#ccc'); P(sx, 9, 18, 7, '#2d4f8a'); P(sx + 2, 11, 14, 1, '#4a78c0'); P(sx + 2, 14, 14, 1, '#4a78c0'); }
        // TV antennas (κεραίες) — several
        for (let i = 0; i < 3; i++) { const ax = 8 + Math.floor(G.hash(b.x + i, b.y) * (w - 20)), ay = roofH - 16 + i * 2; P(ax, ay - 10, 1, 12, '#444'); P(ax - 5, ay - 9, 11, 1, '#444'); P(ax - 4, ay - 6, 9, 1, '#444'); P(ax - 3, ay - 3, 7, 1, '#444'); }
        // satellite dish + water tank + AC units
        P(w - 12, roofH - 13, 6, 6, '#e4e4e4'); P(w - 11, roofH - 12, 4, 4, '#cfcfcf'); P(w - 9, roofH - 8, 1, 3, '#666');
        if (G.hash(b.y, b.x) < 0.6) { P(4, roofH - 13, 9, 8, '#2a2a2a'); P(5, roofH - 12, 7, 2, '#444'); }
        P(w / 2 - 6, roofH - 10, 8, 5, '#dcdcdc'); P(w / 2 - 5, roofH - 9, 6, 1, '#aaa');
        // washing line
        P(16, roofH - 20, w - 50 > 10 ? w - 50 : 10, 1, '#999'); for (let i = 0; i < 4; i++) P(18 + i * 6, roofH - 19, 3, 4, ['#e44', '#fff', '#4a8', '#48f'][i]);
      }
      if (b.type === 'parliament') { P(w / 2 - 1, -0, 2, 14, '#fff'); }
    } else {
      // pitched roof
      P(0, 0, w, roofH, roof);
      for (let yy = 4; yy < roofH; yy += 5) P(0, yy, w, 1, roofD);
      P(0, 0, w, 3, roofL); P(0, roofH - 3, w, 3, roofD);
      P(w / 2 - 1, 0, 2, roofH - 2, roofL);
      if (b.type === 'house') P(w - 14, 2, 6, 8, '#8a5a3a'); // chimney
    }
    // windows
    const floors = b.type === 'apart' ? Math.floor((wallH - 18) / 14) : 1;
    const winY0 = roofH + 6;
    const win = (wx, wy, ww = 8, wh = 8) => { P(wx, wy, ww, wh, '#3a5888'); P(wx + 1, wy + 1, ww - 2, wh - 2, '#78a8e0'); P(wx + 1, wy + 1, 2, 2, '#c8e0ff'); };
    if (b.type === 'apart') {
      for (let f = 0; f < floors; f++) {
        const y = winY0 + f * 14;
        for (let wx = 6; wx < w - 10; wx += 16) win(wx, y);
        P(2, y + 10, w - 4, 2, '#8f8a7e'); for (let i = 3; i < w - 3; i += 3) P(i, y + 8, 1, 2, '#6b6b6b'); // balcony
        // πράσινες τέντες (striped green canvas) over most windows
        for (let wx = 6; wx < w - 10; wx += 16) if (G.hash(b.x + wx, b.y + f) < 0.75) {
          P(wx - 2, y - 3, 12, 5, '#2f7d3a'); for (let k = 0; k < 12; k += 3) P(wx - 2 + k, y - 3, 1, 5, '#4fae55');
          P(wx - 2, y + 2, 12, 1, '#1f5a28'); for (let k = 0; k < 12; k += 2) P(wx - 2 + k, y + 3, 1, 1, '#2f7d3a');
        }
        if (G.hash(b.y, f) < 0.35) { P(w - 16, y + 5, 3, 3, '#b05a2a'); P(w - 17, y + 3, 5, 2, '#3a8a4a'); } // γλάστρα
        if (G.hash(f, b.y) < 0.4) P(10, y + 2, 4, 4, '#e0e0e0'); // AC
      }
    } else if (b.type === 'parliament') {
      for (let wx = 10; wx < w - 14; wx += 18) { win(wx, winY0, 10, 12); win(wx, winY0 + 18, 10, 12); }
    } else {
      win(6, winY0); win(w - 14, winY0);
    }
    // door
    const dx = (b.door[0] - b.x) * TS;
    if (b.type === 'parliament') { P(dx - 8, h - 20, 32, 20, '#6b4a2b'); P(dx - 6, h - 18, 28, 18, '#8b6a3b'); }
    else { P(dx + 2, h - 15, 12, 15, '#5a3a20'); P(dx + 3, h - 14, 10, 14, ['shop', 'firstdates', 'bank'].includes(b.type) ? '#a8d8f0' : '#8b5a2b'); P(dx + 3, h - 14, 10, 1, '#333'); }
    // awnings / decos for shops
    if (b.awning) { for (let i = 0; i < w; i += 6) { P(i, roofH, 3, 5, b.awning); P(i + 3, roofH, 3, 5, '#fff'); } }
    if (b.deco === 'avocado') { P(8, h - 14, 6, 8, '#3a7a2a'); P(9, h - 12, 4, 4, '#c8e070'); P(10, h - 11, 2, 2, '#7a4a25'); }
    if (b.deco === 'coffee') { P(7, h - 13, 5, 7, '#f4f4f4'); P(7, h - 13, 5, 2, '#7a4a25'); P(12, h - 11, 2, 3, '#f4f4f4'); P(w - 14, h - 12, 8, 4, '#f2d36b'); }
    if (b.deco === 'plants') { for (let i = 0; i < 3; i++) { P(4 + i * 6, h - 8, 4, 5, '#b05a2a'); P(3 + i * 6, h - 14, 6, 6, '#3a8a4a'); } P(w - 16, h - 18, 10, 14, '#2f6b3a'); }
    if (b.deco === 'dildo') { P(8, h - 16, 8, 12, '#ff9ccf'); P(10, h - 15, 3, 9, '#ff6fa3'); P(10, h - 16, 3, 2, '#ff9ccf'); P(w - 16, h - 16, 9, 12, '#ff9ccf'); P(w - 14, h - 15, 4, 8, '#b06bff'); }
    if (b.deco === 'closed') { // closed-down shop: rolled-down metal shutters, faded posters, a ΕΝΟΙΚΙΑΖΕΤΑΙ notice
      for (const [sx, sw] of [[4, w / 2 - 10], [dx + 1, 14], [w / 2 + 10, w / 2 - 14]]) { P(sx, h - 22, sw, 20, '#9a96a0'); for (let k = h - 21; k < h - 3; k += 2.5) P(sx, k, sw, 0.8, '#7a7682'); P(sx, h - 22, sw, 1.5, '#5a5662'); }
      P(8, h - 19, 9, 11, '#f4e8c8'); P(9, h - 17, 7, 1, '#c0392b'); P(9, h - 14, 6, 0.8, '#888'); P(9, h - 12, 5, 0.8, '#888');
      P(w - 22, h - 18, 12, 8, '#ffd400'); P(w - 21, h - 16, 10, 1, '#c0392b'); P(w - 21, h - 13, 8, 0.8, '#333');
    }
    if (b.type === 'school') { P(w - 30, roofH + 4, 10, 10, '#f4f4f4'); P(w - 26, roofH + 5, 1, 4, '#111'); P(w - 26, roofH + 8, 4, 1, '#111'); }
    if (b.type === 'station') { P(w / 2 - 8, roofH - 10, 16, 16, '#f4f4f4'); P(w / 2 - 7, roofH - 9, 14, 14, '#fff'); P(w / 2, roofH - 6, 1, 5, '#111'); P(w / 2, roofH - 2, 4, 1, '#111'); }
    if (b.type === 'police') { P(4, roofH - 8, 8, 6, '#2d6bff'); P(w - 12, roofH - 8, 8, 6, '#ff2d2d'); }
    if (b.type === 'bank') for (const col of b.atmCols || []) drawATM(x, col * TS + 8, h); // ATMs built into the façade
    if (false && !b.graffiti && ['apart', 'shop', 'house', 'ktel', 'tax', 'school'].includes(b.type) && b.y < MH && G.hash(b.x * 5, b.y * 3) < 0.6) { // a few spray tags
      const TC = ['#ff3e8a', '#2dd4ff', '#ffd400', '#7ed957', '#c86bff', '#1d1d1d'];
      for (let i = 0; i < 2; i++) {
        if (i && G.hash(b.y, b.x + 7) < 0.5) break;
        const gx = 6 + G.hash(b.x + i * 3, b.y) * (w - 30), gy = h - 9 - G.hash(b.y + i, b.x) * 8, col = TC[Math.floor(G.hash(i, b.x + b.y) * TC.length)];
        x.lineCap = 'round'; x.lineJoin = 'round';
        for (const [lw, cc] of [[2.2, 'rgba(20,10,30,0.55)'], [1.1, col]]) {
          x.strokeStyle = cc; x.lineWidth = lw; x.beginPath(); x.moveTo(gx, gy + 2);
          for (let k = 1; k <= 5; k++) x.quadraticCurveTo(gx + k * 3 - 1.5, gy - 3 + (k % 2) * 6, gx + k * 3, gy + (k % 2 ? -1 : 2));
          x.stroke();
        }
      }
    }
    if (b.graffiti && !b.spray) {
      const GC = ['#ff2d55', '#ffd400', '#2dd4ff', '#7ed957', '#ff7a1a', '#c86bff'];
      for (let i = 0; i < 6; i++) { const gx = Math.floor(G.hash(b.x + i, 3) * (w - 16)), gy = roofH + 4 + Math.floor(G.hash(i, b.y) * (wallH - 14)); P(gx, gy, 10 + i * 2, 4, GC[i % GC.length]); P(gx + 2, gy + 1, 6, 1, '#111'); }
    }
    // light & volume: roof lit from top-left, wall darkens towards the ground (ambient occlusion)
    let gr = x.createLinearGradient(0, 0, w, roofH); gr.addColorStop(0, 'rgba(255,255,255,0.18)'); gr.addColorStop(1, 'rgba(0,0,0,0.12)');
    x.fillStyle = gr; x.fillRect(0, 0, w, roofH);
    gr = x.createLinearGradient(0, roofH, 0, h); gr.addColorStop(0, 'rgba(0,0,0,0.22)'); gr.addColorStop(0.12, 'rgba(255,255,255,0.06)'); gr.addColorStop(0.8, 'rgba(60,10,70,0.05)'); gr.addColorStop(1, 'rgba(70,15,80,0.28)');
    x.fillStyle = gr; x.fillRect(0, roofH, w, h - roofH);
    gr = x.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, 'rgba(255,255,255,0.06)'); gr.addColorStop(1, 'rgba(0,0,0,0.14)');
    x.fillStyle = gr; x.fillRect(0, 0, w, h);
    // solid dark border so every building reads as a wall
    x.fillStyle = '#1c1622'; x.fillRect(0, 0, w, 2); x.fillRect(0, 0, 2, h); x.fillRect(w - 2, 0, 2, h); x.fillRect(0, h - 2, w, 2);
    // sign board (text drawn crisp by UI layer)
    if (b.airbnb) paintAirbnb(x, b, w, h);
    if (b.face && b.label) paintFace(x, b, w, h);
    else if (b.label) { const sw = Math.min(w - 8, b.label.length * 5 + 10); b.signRect = [Math.round(w / 2 - sw / 2), roofH - 2, sw, 10]; P(b.signRect[0], b.signRect[1], sw, 10, '#1a1a22'); P(b.signRect[0] + 1, b.signRect[1] + 1, sw - 2, 8, b.signCol || '#fff8e0'); }
  }

  const CH = 16;
  function getChunk(cx, cy) {
    const k = cx + ',' + cy; let c = W.chunks.get(k); if (c) { W.chunks.delete(k); W.chunks.set(k, c); return c; }
    while (W.chunks.size > 44) W.chunks.delete(W.chunks.keys().next().value);
    const [cv, x] = G.hiCanvas(CH * TS, CH * TS, G.RS || 2);
    for (let ty = 0; ty < CH; ty++) for (let tx = 0; tx < CH; tx++) {
      const gx = cx * CH + tx, gy = cy * CH + ty; if (gx >= W.w || gy >= W.h) continue;
      x.save(); x.translate(tx * TS, ty * TS); paintTile(x, gx, gy); x.restore();
    }
    // islands: Crete's ground tints (G.CRETE_ART, q5), then the smooth shore / water / beach of both islands (world px)
    const CX0 = cx * CH * TS, CY0 = cy * CH * TS, CX1 = CX0 + CH * TS, CY1 = CY0 + CH * TS;
    const isles = Object.keys(W.ISLES).filter(id => { const f = isleField(id); return CX1 > f.X0 && CY1 > f.Y0 && CX0 < f.X0 + f.gw * 4 && CY0 < f.Y0 + f.gh * 4; });
    for (const id of isles) {
      x.save(); x.translate(-CX0, -CY0);
      try { if (id === 'crete' && G.CRETE_ART) G.CRETE_ART.ground(x, CX0, CY0, CX1, CY1); W.paintCoast(x, id, CX0, CY0, CX1, CY1); } catch (e) { console.error('isle paint', id, e); }
      x.restore();
    }
    // buildings overlapping this chunk
    for (const b of W.buildings) {
      if (!b.canvas || b.canvasRS !== G.RS) { const [bc, bx] = G.hiCanvas(b.w * TS, b.h * TS, G.RS || 2); paintBuilding(bx, b); b.canvas = bc; b.canvasRS = G.RS; }
      const ox = b.x * TS - cx * CH * TS, oy = b.y * TS - cy * CH * TS;
      if (ox + b.w * TS < 0 || oy + b.h * TS < 0 || ox > CH * TS || oy > CH * TS) continue;
      x.fillStyle = 'rgba(70,20,90,0.3)'; x.fillRect(ox + 6, oy + 6, b.w * TS, b.h * TS);
      x.drawImage(b.canvas, ox, oy, b.w * TS, b.h * TS);
    }
    // quest regions: the quest paints its own place into the world (same art as inside the quest)
    for (const r of W.regions) {
      const rx = r.tx * TS - cx * CH * TS, ry = r.ty * TS - cy * CH * TS, rw = r.w * TS, rh = r.h * TS, S2 = CH * TS;
      if (rx >= S2 || ry >= S2 || rx + rw <= 0 || ry + rh <= 0) continue;
      x.save(); x.beginPath(); x.rect(Math.max(0, rx), Math.max(0, ry), Math.min(S2, rx + rw) - Math.max(0, rx), Math.min(S2, ry + rh) - Math.max(0, ry)); x.clip();
      x.translate(rx, ry);
      try { r.paint(x, -rx, -ry, S2, S2); } catch (e) { console.error('region paint', r.id, e); }
      x.restore();
    }
    // Crete olive trees and boulders outside the quest's own orchard (drawn after the region so trees at its border are whole)
    if (isles.includes('crete') && G.CRETE_ART) { x.save(); x.translate(-CX0, -CY0); try { G.CRETE_ART.objects(x, CX0, CY0, CX1, CY1); } catch (e) { console.error('crete objects', e); } x.restore(); }
    W.chunks.set(k, cv); return cv;
  }
  W.drawGround = function (ctx, camX, camY) {
    const x0 = Math.floor(camX / (CH * TS)), y0 = Math.floor(camY / (CH * TS));
    const x1 = Math.floor((camX + G.W) / (CH * TS)), y1 = Math.floor((camY + G.H) / (CH * TS));
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      if (cx < 0 || cy < 0) continue; ctx.drawImage(getChunk(cx, cy), Math.round((cx * CH * TS - camX) * G.RS) / G.RS, Math.round((cy * CH * TS - camY) * G.RS) / G.RS, CH * TS, CH * TS);
    }
  };
  // building signs + place labels, crisp, on UI layer
  W.drawSigns = function (camX, camY) {
    const U = G.ui;
    for (const b of W.buildings) {
      if (!b.label || !b.signRect) continue;
      const f = b.face, r = b.signRect;
      const sx = b.x * TS - camX + r[0] + r[2] / 2 + (b.signDx || 0), sy = b.y * TS - camY + r[1] + (f ? r[3] / 2 + 2.6 : 7.5);
      if (sx < -80 || sx > G.W + 80 || sy < -20 || sy > G.H + 20) continue;
      U.text(sx, sy, b.label, 6.5, f ? f.text : '#1a1a22', 'center', f && f.halo ? f.halo : null);
    }
    // Airbnb plaques by the doors
    for (const b of W.buildings) {
      if (!b.abRect) continue; const r = b.abRect, sx = b.x * TS - camX + r[0] + r[2] / 2, sy = b.y * TS - camY + r[1] + 5.4;
      if (sx < -40 || sx > G.W + 40 || sy < -20 || sy > G.H + 20) continue;
      U.text(sx, sy, 'AIRBNB', 4.3, '#ffffff', 'center', null);
    }
    // road signposts in the countryside: the names sit on the blue boards drawn by the prop
    for (const p of W.posts || []) {
      const bx = p.tx * TS + 8 - camX, by = p.ty * TS - camY;
      if (bx < -60 || bx > G.W + 60 || by < -40 || by > G.H + 20) continue;
      p.lines.forEach((l, i) => { const g = postGeom(p, i); U.text(bx + g.tx, by + g.top + 6.3, l.t, 5.2, '#ffffff', 'center', null); });
    }
    for (const s of W.signs) { const sx = s.x * TS - camX, sy = s.y * TS - camY; if (sx < -60 || sx > G.W + 60 || sy < -20 || sy > G.H + 20) continue; U.text(sx, sy, s.text, 7, '#fff', 'center'); }
  };

  // trees: Pokémon round trees, y-sorted
  let treeSpr = null, treeRS = 0;
  W.treeSprite = () => {
    if (treeSpr && treeRS === G.RS) return treeSpr;
    const [c, x] = G.hiCanvas(20, 24, (G.RS || 2) * 1.5);
    x.fillStyle = 'rgba(60,20,80,0.3)'; x.beginPath(); x.ellipse(11, 20, 8, 3, 0, 0, 7); x.fill();
    const trunk = x.createLinearGradient(8, 0, 12, 0); trunk.addColorStop(0, '#8a5e36'); trunk.addColorStop(1, '#4e331d');
    x.fillStyle = trunk; x.fillRect(8.5, 13, 3, 7);
    const g = x.createRadialGradient(7, 5, 1, 10, 9, 10); g.addColorStop(0, '#9fe47a'); g.addColorStop(0.55, '#4fae4a'); g.addColorStop(1, '#2a6a42');
    x.fillStyle = g; x.strokeStyle = 'rgba(20,40,20,0.8)'; x.lineWidth = 0.7;
    x.beginPath(); x.arc(10, 9, 8, 0, 7); x.fill(); x.stroke();
    x.fillStyle = 'rgba(255,255,255,0.18)'; x.beginPath(); x.arc(7, 6, 3, 0, 7); x.fill();
    x.fillStyle = 'rgba(30,70,30,0.35)'; x.beginPath(); x.arc(13, 12, 3.5, 0, 7); x.fill();
    c.lw = 20; c.lh = 24; treeSpr = c; treeRS = G.RS; return c;
  };
  W.visibleStatics = function (camX, camY, out) {
    const tx0 = Math.floor(camX / TS) - 1, ty0 = Math.floor(camY / TS) - 1, tx1 = tx0 + Math.ceil(G.W / TS) + 2, ty1 = ty0 + Math.ceil(G.H / TS) + 3;
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const c = W.get(tx, ty);
      if (c === 'T') out.push({ y: ty * TS + 15, draw: ctx => { const ps = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = true; ctx.drawImage(W.treeSprite(), tx * TS - camX - 2, ty * TS - camY - 8, 20, 24); ctx.imageSmoothingEnabled = ps; } });
      const p = W.propAt(tx, ty);
      if (p) out.push({ y: ty * TS + 12, draw: ctx => W.drawProp(ctx, p, tx * TS - camX, ty * TS - camY) });
    }
    // wide standing things (tomb, roadworks dressing): culled by their bounding box
    for (const o of W.bigStatics || []) {
      if (o.x1 < camX - 20 || o.x0 > camX + G.W + 20 || o.y1 < camY - 20 || o.y0 > camY + G.H + 40) continue;
      out.push({ y: o.y, draw: ctx => o.draw(ctx, o.ax - camX, o.ay - camY) });
    }
  };
  W.drawProp = function (ctx, p, x, y) {
    const P = (a, b, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x + a), Math.round(y + b), w, h); };
    switch (p.type) {
      case 'bin': {
        const R = (a, b, w, h, r, f, st) => { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x + a, y + b, w, h, r); else ctx.rect(x + a, y + b, w, h); ctx.fillStyle = f; ctx.fill(); if (st) { ctx.strokeStyle = st; ctx.lineWidth = 0.7; ctx.stroke(); } };
        ctx.fillStyle = 'rgba(20,10,30,0.3)'; ctx.beginPath(); ctx.ellipse(x + 10, y + 16, 8, 2.5, 0, 0, 7); ctx.fill();
        const g = ctx.createLinearGradient(x + 1, 0, x + 15, 0); g.addColorStop(0, '#4fb05c'); g.addColorStop(1, '#1f5a28');
        R(1.5, 2, 13, 13.5, 2.5, g, 'rgba(28,20,36,0.85)'); R(3, 7, 10, 1.2, 0.6, 'rgba(0,0,0,0.25)'); R(3, 10.5, 10, 1.2, 0.6, 'rgba(0,0,0,0.25)');
        if (p.over) { // overflowing: bags piled next to it, lid propped up, a bit of litter
          for (const [bx, by, br] of [[16, 12, 3.6], [-1, 13, 3.2], [14, 15, 2.8]]) { ctx.fillStyle = 'rgba(70,20,90,0.25)'; ctx.beginPath(); ctx.ellipse(x + bx + 1.5, y + by + 2, br, 1.2, 0, 0, 7); ctx.fill(); const bg = ctx.createRadialGradient(x + bx - 1, y + by - 1.5, 0.3, x + bx, y + by, br); bg.addColorStop(0, '#5a5a66'); bg.addColorStop(1, '#141218'); ctx.fillStyle = bg; ctx.strokeStyle = 'rgba(28,20,36,0.85)'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.ellipse(x + bx, y + by, br, br * 0.8, 0, 0, 7); ctx.fill(); ctx.stroke(); }
          ctx.fillStyle = '#3a3640'; ctx.beginPath(); ctx.ellipse(x + 8, y + 1.5, 5.5, 3, 0, 0, 7); ctx.fill();
          ctx.fillStyle = '#f2ede4'; ctx.fillRect(x + 4, y + 15.5, 2.4, 1.2); ctx.fillStyle = '#d0302c'; ctx.fillRect(x + 19, y + 16, 2, 1.2);
          R(0, -5.5, 14, 3.4, 1.5, '#3e9a4b', 'rgba(28,20,36,0.85)');
        } else if (p.lidOpen) R(1, -4, 14, 4, 2, '#3e9a4b', 'rgba(28,20,36,0.85)'); else R(1, 0.5, 14, 3, 1.5, '#57c065', 'rgba(28,20,36,0.85)');
        break;
      }
      case 'kiosk': {
        // canopy roof overhanging (τέντα-σκέπαστρο)
        P(-6, -22, 28, 6, '#1a1a1a'); P(-5, -21, 26, 4, '#c0392b'); for (let i = -4; i < 20; i += 4) P(i, -21, 2, 4, '#e8e8e8');
        // box
        P(-2, -16, 20, 30, '#111'); P(-1, -15, 18, 28, '#2a62c9');
        // hatch window (παραθυράκι) with the owner inside
        P(2, -12, 12, 11, '#111'); P(3, -11, 10, 9, '#f2e6c4');
        P(6, -10, 4, 4, '#d9a27a'); P(6, -11, 4, 1, '#555'); P(5, -6, 6, 3, '#6b6b6b'); // περιπτεράς
        P(2, -1, 12, 2, '#d0c8b0'); // counter
        for (let i = 0; i < 4; i++) P(3 + i * 3, -2, 2, 1, ['#e33', '#fd0', '#3c3', '#39f'][i]); // gum & lighters
        // newspapers hanging outside on both sides (εφημερίδες)
        const papers = ['#f4f4f4', '#ffe9a8', '#f4f4f4', '#e8f0ff'];
        for (let i = 0; i < 3; i++) {
          P(-7, -14 + i * 9, 5, 8, papers[i]); P(-7, -14 + i * 9, 5, 2, i % 2 ? '#c0392b' : '#1f3f9a'); P(-6, -11 + i * 9, 3, 1, '#888'); P(-6, -9 + i * 9, 3, 1, '#888');
          P(18, -14 + i * 9, 5, 8, papers[i + 1]); P(18, -14 + i * 9, 5, 2, i % 2 ? '#1f3f9a' : '#e67e22'); P(19, -11 + i * 9, 3, 1, '#888'); P(19, -9 + i * 9, 3, 1, '#888');
        }
        P(-8, -15, 1, 26, '#555'); P(23, -15, 1, 26, '#555'); // wire racks
        break;
      }
      case 'fridge': { // soft-drink fridge next to the kiosk
        P(2, -14, 13, 28, '#111'); P(3, -13, 11, 26, '#d4202c'); P(4, -12, 9, 4, '#fff'); P(5, -11, 7, 2, '#d4202c');
        P(4, -7, 9, 19, '#9fd0ee');
        for (let r = 0; r < 4; r++) for (let i = 0; i < 3; i++) P(5 + i * 3, -6 + r * 5, 2, 4, ['#c0392b', '#f39c12', '#27ae60', '#7a3a10'][(r + i) % 4]);
        P(4, -7, 1, 19, 'rgba(255,255,255,0.5)');
        break;
      }
      case 'homeless': {
        ctx.fillStyle = 'rgba(20,10,30,0.25)'; ctx.beginPath(); ctx.ellipse(x + 9, y + 14, 9, 3, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#c99d65'; ctx.strokeStyle = 'rgba(28,20,36,0.7)'; ctx.lineWidth = 0.6; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x - 1, y + 6, 18, 9, 1.5); else ctx.rect(x - 1, y + 6, 18, 9); ctx.fill(); ctx.stroke();
        const g = ctx.createLinearGradient(0, y + 7, 0, y + 13); g.addColorStop(0, '#8a7aaa'); g.addColorStop(1, '#4a3a6a');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x + 7, y + 10, 7, 3.2, 0, 0, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#c98c62'; ctx.beginPath(); ctx.arc(x + 14, y + 9.5, 2.6, 0, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#8a8a86'; ctx.beginPath(); ctx.arc(x + 14.6, y + 8.4, 2.2, Math.PI * 1.1, Math.PI * 2.1); ctx.fill();
        break;
      }
      case 'stop': {
        const people = () => { for (const m of p.crowd) {
          if (m.gone) { if (G.t < m.back) continue; m.gone = false; m.look = G.randomLook(); }
          if (!m.look) m.look = G.randomLook();
          const bob = Math.floor((G.t + m.t) * 1.2) % 4 === 0 ? 1 : 0;
          G.drawPerson(ctx, m.look, Math.round(x + 8 + m.dx), Math.round(y + 14 + m.dy), m.dir || 0, bob);
        } };
        const RR = (a, b, w, h, r, f, st) => { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x + a, y + b, w, h, r); else ctx.rect(x + a, y + b, w, h); ctx.fillStyle = f; ctx.fill(); if (st) { ctx.strokeStyle = st; ctx.lineWidth = 0.6; ctx.stroke(); } };
        if (p.vert) {
          // shelter along a north-south curb: long narrow roof, glass back panel, bench, sign pole on the road side
          const s = p.side, rx = s < 0 ? 16 : -11, px = s < 0 ? -1 : 16;
          ctx.fillStyle = 'rgba(70,20,90,0.25)'; ctx.fillRect(x + rx + 3, y - 18, 10, 46);
          RR(rx + 4.5, -20, 2, 44, 1, 'rgba(170,215,240,0.6)', 'rgba(40,60,90,0.6)');
          RR(rx + (s < 0 ? 0 : 6), -12, 4, 28, 1, '#b8743a', 'rgba(28,20,36,0.7)');
          for (const py of [-22, 22]) RR(rx + 4.5, py - 12, 2, 13, 0.8, '#8a8a92');
          const g = ctx.createLinearGradient(x + rx, 0, x + rx + 11, 0); g.addColorStop(0, '#3f86e6'); g.addColorStop(1, '#174a96');
          RR(rx - 1, -34, 12, 48, 2, g, 'rgba(28,20,36,0.85)'); RR(rx + 0.5, -33, 3, 46, 1.2, 'rgba(255,255,255,0.22)');
          P(px, -2, 1.2, 18, '#666'); RR(px - 3.4, -10, 8, 8, 1.5, '#1f5fbf', 'rgba(28,20,36,0.8)'); RR(px - 1.4, -8, 4, 4, 0.8, '#fff');
          people();
        } else {
          const oy = p.side < 0 ? 16 : 0;
          if (p.side < 0) people();
          ctx.fillStyle = 'rgba(70,20,90,0.22)'; ctx.fillRect(x - 12, y - 2 + oy, 44, 8);
          P(-13, -14 + oy, 2, 20, '#777'); P(27, -14 + oy, 2, 20, '#777');
          P(-11, -12 + oy, 38, 12, 'rgba(170,210,240,0.55)'); P(-6, -1 + oy, 28, 3, '#a0622a');
          const g = ctx.createLinearGradient(0, y - 20 + oy, 0, y - 13 + oy); g.addColorStop(0, '#3f86e6'); g.addColorStop(1, '#174a96');
          RR(-15, -20 + oy, 46, 7, 2, g, 'rgba(28,20,36,0.85)');
          const sx = p.side < 0 ? 30 : 30, sy = p.side < 0 ? -2 : -22;
          P(sx + 3, sy + 8, 1.2, 12, '#666'); RR(sx, sy, 8, 8, 1.5, '#1f5fbf', 'rgba(28,20,36,0.8)'); RR(sx + 2, sy + 2, 4, 4, 0.8, '#fff');
          if (p.side >= 0) people();
        }
        break;
      }
      case 'bench': {
        ctx.fillStyle = 'rgba(20,10,30,0.25)'; ctx.fillRect(x + 2, y + 12, 16, 3);
        ctx.fillStyle = '#4a4a50'; ctx.fillRect(x + 1.5, y + 9, 1.6, 5); ctx.fillRect(x + 12.9, y + 9, 1.6, 5);
        const g = ctx.createLinearGradient(0, y + 3, 0, y + 10); g.addColorStop(0, '#d8964a'); g.addColorStop(1, '#8a5222');
        ctx.fillStyle = g; ctx.strokeStyle = 'rgba(28,20,36,0.8)'; ctx.lineWidth = 0.6;
        for (const [yy, hh] of [[3.5, 2.4], [6.6, 2.4], [9.4, 2.2]]) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y + yy, 16, hh, 1); else ctx.rect(x, y + yy, 16, hh); ctx.fill(); ctx.stroke(); }
        break;
      }
      case 'shopsign': drawShopSign(ctx, p, x + 8, y); break;
      case 'sentry': drawSentry(ctx, x + 8, y + 13, p.flip); break;
      case 'evzone': drawEvzone(ctx, x + 8, y + 12, p.flip, Math.sin(G.t * 1.1 + p.ph) * 0.35); break;
      case 'hoop': break; // drawn by basketball.js (ball sorts between board and rim)
      case 'scooter': drawScooter(ctx, x + 8 + p.ox, y + 11 + p.oy, p); break;
      case 'signpost': drawSignpost(ctx, x + 8, y, p); break;
      case 'bale': drawBale(ctx, x + 8, y + 10, p.flip); break;
      case 'shrine': drawShrine(ctx, x + 8, y + 13); break;
      case 'suitcase': drawSuitcase(ctx, x + 8, y + 12, p.k); break;
    }
  };

  // ---------- standing set pieces (HD-2D: gradients, ink outlines, light from the top-left) ----------
  const INK = 'rgba(28,20,36,0.85)', SHADOW = 'rgba(70,20,90,0.28)';
  const rrect = (ctx, x, y, w, h, r) => { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); };
  const fillStroke = (ctx, f, st = INK, lw = 0.6) => { ctx.fillStyle = f; ctx.fill(); if (st) { ctx.strokeStyle = st; ctx.lineWidth = lw; ctx.stroke(); } };
  const ellF = (ctx, x, y, rx, ry, f, st, lw) => { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); fillStroke(ctx, f, st, lw); };
  const lin = (ctx, x0, y0, x1, y1, a, b) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, a); g.addColorStop(1, b); return g; };

  function drawShopIcon(ctx, icon, cx, cy) {
    if (icon === 'avocado') { ellF(ctx, cx, cy, 2.6, 3.4, '#3f8a2c', INK, 0.4); ellF(ctx, cx, cy + 0.3, 1.8, 2.5, '#d8ec88'); ellF(ctx, cx, cy + 0.9, 0.9, 0.9, '#8a5226'); }
    else if (icon === 'coffee') { rrect(ctx, cx - 2.2, cy - 2, 4.4, 5, 1); fillStroke(ctx, '#ffffff', INK, 0.4); ctx.fillStyle = '#7a4a25'; ctx.fillRect(cx - 2.2, cy - 2, 4.4, 1.3); ctx.strokeStyle = '#2dbf6a'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(cx + 0.6, cy - 1.8); ctx.lineTo(cx + 1.8, cy - 4); ctx.stroke(); }
    else if (icon === 'plant') { rrect(ctx, cx - 1.8, cy + 0.2, 3.6, 2.8, 0.6); fillStroke(ctx, '#c0663a', INK, 0.4); for (const a of [-0.9, 0, 0.9]) { ctx.save(); ctx.translate(cx, cy); ctx.rotate(a); ellF(ctx, 0, -2.2, 1.1, 2.2, '#3faa4a', INK, 0.3); ctx.restore(); } }
    else if (icon === 'kafe') { ellF(ctx, cx, cy + 1.8, 3, 0.9, '#ffffff', INK, 0.35); rrect(ctx, cx - 1.8, cy - 1.4, 3.6, 3.2, 0.8); fillStroke(ctx, '#ffffff', INK, 0.4); ctx.fillStyle = '#1f3f9a'; ctx.fillRect(cx - 1.8, cy - 0.2, 3.6, 0.6); }
    else if (icon === 'bus') { rrect(ctx, cx - 3.4, cy - 2.6, 6.8, 5.4, 1.2); fillStroke(ctx, '#ffffff', INK, 0.4); ctx.fillStyle = '#8fd0f0'; ctx.fillRect(cx - 2.6, cy - 1.9, 5.2, 2); ellF(ctx, cx - 2, cy + 2.8, 0.8, 0.8, '#222'); ellF(ctx, cx + 2, cy + 2.8, 0.8, 0.8, '#222'); }
    else if (icon === 'atm') { ellF(ctx, cx, cy, 3, 3, lin(ctx, cx - 3, cy - 3, cx + 3, cy + 3, '#ffe27a', '#c8901e'), INK, 0.4); ctx.strokeStyle = '#8a5a0a'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.arc(cx + 0.4, cy, 1.6, 0.8, 5.5); ctx.moveTo(cx - 1.8, cy - 0.5); ctx.lineTo(cx + 0.6, cy - 0.5); ctx.moveTo(cx - 1.8, cy + 0.6); ctx.lineTo(cx + 0.6, cy + 0.6); ctx.stroke(); }
  }
  function heartPath(ctx, cx, cy, s) {
    ctx.beginPath(); ctx.moveTo(cx, cy + s * 0.9);
    ctx.bezierCurveTo(cx - s * 1.4, cy - s * 0.1, cx - s * 0.7, cy - s * 1.2, cx, cy - s * 0.45);
    ctx.bezierCurveTo(cx + s * 0.7, cy - s * 1.2, cx + s * 1.4, cy - s * 0.1, cx, cy + s * 0.9); ctx.closePath();
  }
  // outside shop signs (the label text is drawn crisp on the UI layer by W.drawSigns)
  function drawShopSign(ctx, p, cx, y) {
    const bw = p.bw, L = cx - bw / 2;
    if (p.kind === 'aboard' || p.kind === 'board') {
      ellF(ctx, cx + 3, y + 14, bw / 2 + 2, 2.6, SHADOW);
      ctx.strokeStyle = '#6a4424'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(L + 2, y + 2); ctx.lineTo(L, y + 13.5); ctx.moveTo(L + bw - 2, y + 2); ctx.lineTo(L + bw, y + 13.5); ctx.stroke();
      rrect(ctx, L, y - 9, bw, 12, 1.6); fillStroke(ctx, p.kind === 'board' ? '#24427e' : '#9a6a3c', INK, 0.7);
      rrect(ctx, L + 1.3, y - 7.7, bw - 2.6, 9.4, 1); fillStroke(ctx, p.kind === 'board' ? p.board : lin(ctx, L, y - 8, L + bw, y + 2, '#33463e', '#1f2c27'), null);
      ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fillRect(L + 1.3, y - 7.7, bw - 2.6, 1.2);
      ellF(ctx, cx, y - 12.5, 4.6, 4.6, '#fffaf0', INK, 0.6); drawShopIcon(ctx, p.icon, cx, y - 12.5);
    } else if (p.kind === 'neon') {
      const pulse = 0.75 + Math.sin(G.t * 3.2 + p.tx) * 0.25;
      ellF(ctx, cx + 3, y + 14, bw / 2 + 1, 2.4, SHADOW);
      for (const sx of [L + 3, L + bw - 4]) { rrect(ctx, sx, y - 9, 1.6, 22, 0.6); fillStroke(ctx, lin(ctx, sx, 0, sx + 1.6, 0, '#e8e8f0', '#7a7a88'), INK, 0.4); }
      rrect(ctx, L, y - 20, bw, 11, 2); fillStroke(ctx, '#1a1020', INK, 0.7);
      ctx.save(); ctx.globalAlpha = 0.35 * pulse; ctx.strokeStyle = p.glow; ctx.lineWidth = 3; rrect(ctx, L + 1.5, y - 18.5, bw - 3, 8, 1.5); ctx.stroke(); ctx.restore();
      ctx.strokeStyle = p.glow; ctx.lineWidth = 0.8; rrect(ctx, L + 1.5, y - 18.5, bw - 3, 8, 1.5); ctx.stroke();
      // neon heart on top, softly pulsing
      const hy = y - 26.5, gl = ctx.createRadialGradient(cx, hy, 0, cx, hy, 11); gl.addColorStop(0, `rgba(255,80,160,${0.45 * pulse})`); gl.addColorStop(1, 'rgba(255,80,160,0)');
      ctx.fillStyle = gl; ctx.fillRect(cx - 11, hy - 11, 22, 22);
      ctx.strokeStyle = 'rgba(28,20,36,0.85)'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(cx, hy + 4); ctx.lineTo(cx, y - 20); ctx.stroke();
      heartPath(ctx, cx, hy, 4.6); ctx.fillStyle = '#2a0a1e'; ctx.fill();
      ctx.save(); ctx.globalAlpha = 0.5 * pulse; ctx.strokeStyle = p.glow; ctx.lineWidth = 2.6; heartPath(ctx, cx, hy, 3.8); ctx.stroke(); ctx.restore();
      ctx.strokeStyle = '#ffd6ea'; ctx.lineWidth = 0.9; heartPath(ctx, cx, hy, 3.8); ctx.stroke();
    } else if (p.kind === 'totem') {
      ctx.fillStyle = SHADOW; ctx.fillRect(L + 3, y + 8, bw, 5);
      rrect(ctx, L, y - 22, bw, 33, 1.6); fillStroke(ctx, lin(ctx, L, 0, L + bw, 0, '#f6f6fa', '#cfd0da'), INK, 0.7);
      rrect(ctx, L, y - 22, bw, 10.5, 1.6); fillStroke(ctx, p.board, INK, 0.7);
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(L + 1, y - 21, bw - 2, 1.4);
      drawShopIcon(ctx, p.icon, cx, y - 4);
      ctx.fillStyle = 'rgba(60,30,80,0.18)'; ctx.fillRect(L + bw - 3, y - 11, 2.4, 21);
    }
  }
  function drawSentry(ctx, cx, fy, flip) {
    ellF(ctx, cx + 3, fy + 1, 9, 3, SHADOW);
    rrect(ctx, cx - 7, fy - 24, 14, 25, 1.5); fillStroke(ctx, lin(ctx, cx - 7, 0, cx + 7, 0, '#f2e6d0', '#c8b496'), INK, 0.7);
    rrect(ctx, cx - 4.5, fy - 19, 9, 19, 3); fillStroke(ctx, lin(ctx, 0, fy - 19, 0, fy, '#2a2232', '#4a3c4a'), INK, 0.5);
    // roof: Greek blue and white stripes, a small pointed top
    ctx.beginPath(); ctx.moveTo(cx - 9, fy - 23); ctx.lineTo(cx, fy - 31); ctx.lineTo(cx + 9, fy - 23); ctx.closePath(); fillStroke(ctx, '#1f5fbf', INK, 0.7);
    ctx.save(); ctx.clip(); ctx.fillStyle = '#ffffff'; for (let k = -8; k < 9; k += 4) ctx.fillRect(cx + k, fy - 32, 2, 10); ctx.restore();
    ctx.strokeStyle = INK; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(cx - 9, fy - 23); ctx.lineTo(cx, fy - 31); ctx.lineTo(cx + 9, fy - 23); ctx.closePath(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(cx - 6, fy - 23, 1.2, 22);
  }
  // evzone (τσολιάς): red fez with long black tassel, white shirt with wide sleeves, white fustanella,
  // white stockings, red garters, black tsarouchia with pompoms, rifle on the shoulder
  function drawEvzone(ctx, cx, fy, flip, sway) {
    const OUT = '#1c1424', W1 = '#ffffff', W2 = '#d6d8e4', SK = '#e6b48a', SK2 = '#c98c62';
    const F = (fill, lw = 0.9) => { ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = OUT; ctx.stroke(); };
    ctx.save(); ctx.translate(cx, fy); if (flip) ctx.scale(-1, 1); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ellF(ctx, 1.5, 1.2, 7.5, 2.4, SHADOW);
    for (const s2 of [-1, 1]) { // short legs: white stockings, red garters, black tsarouchia with big pompoms
      const lx = s2 * 2.3;
      rrect(ctx, lx - 1.4, -7.5, 2.8, 7, 1.2); F(W1, 0.8);
      ctx.fillStyle = '#d42a36'; ctx.fillRect(lx - 1.4, -6.2, 2.8, 1.1);
      ctx.beginPath(); ctx.ellipse(lx + s2 * 0.4, -0.3, 2.3, 1.4, 0, 0, 7); F('#1a1420', 0.8);
      ctx.beginPath(); ctx.arc(lx + s2 * 0.4 + 1.4, -0.6, 1.25, 0, 7); F('#0e0a10', 0.6);
    }
    ctx.translate(sway, 0);
    // fustanella: wide flared white pleated skirt with one flat shadow
    ctx.beginPath(); ctx.moveTo(-3.8, -14.5); ctx.lineTo(3.8, -14.5); ctx.quadraticCurveTo(6.8, -10.5, 7.4, -6.6); ctx.quadraticCurveTo(0, -5.4, -7.4, -6.6); ctx.quadraticCurveTo(-6.8, -10.5, -3.8, -14.5); ctx.closePath(); F(W1);
    ctx.save(); ctx.clip(); ctx.fillStyle = W2; ctx.fillRect(1.5, -15, 8, 10); ctx.restore();
    ctx.strokeStyle = 'rgba(110,115,140,0.5)'; ctx.lineWidth = 0.4; ctx.beginPath(); for (let k = -3; k <= 3; k++) { ctx.moveTo(k * 0.9, -14.2); ctx.lineTo(k * 2, -6.3); } ctx.stroke();
    // torso: white shirt, navy vest with gold trim, black belt
    rrect(ctx, -3.8, -20, 7.6, 6.2, 1.8); F(W1);
    ctx.fillStyle = '#1f2848'; ctx.beginPath(); ctx.moveTo(-3.6, -19.6); ctx.lineTo(-1, -19.6); ctx.lineTo(-1.7, -14.4); ctx.lineTo(-3.6, -14.4); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(3.6, -19.6); ctx.lineTo(1, -19.6); ctx.lineTo(1.7, -14.4); ctx.lineTo(3.6, -14.4); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#e8c547'; ctx.lineWidth = 0.45; ctx.beginPath(); ctx.moveTo(-1, -19.6); ctx.lineTo(-1.7, -14.4); ctx.moveTo(1, -19.6); ctx.lineTo(1.7, -14.4); ctx.stroke();
    ctx.fillStyle = '#2a1a1a'; ctx.fillRect(-3.9, -15.3, 7.8, 1.1);
    // big puffy sleeves + chunky hands
    for (const s2 of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s2 * 5.1, -17.2, 2.4, 3.4, s2 * 0.15, 0, 7); F(s2 < 0 ? W1 : W2, 0.8); ctx.beginPath(); ctx.arc(s2 * 5.3, -13.6, 1.35, 0, 7); F(SK, 0.7); }
    // rifle on the right shoulder
    ctx.save(); ctx.translate(5.6, -14); ctx.rotate(-0.12);
    rrect(ctx, -0.75, -16, 1.5, 14, 0.5); F('#2c2a30', 0.6);
    rrect(ctx, -1.3, -3.5, 2.6, 6, 0.9); F('#8a5a30', 0.6);
    ctx.restore();
    // BIG chibi head: flat skin + one shadow, big eyes with highlight, cheeks, mustache
    const hy = -25.5, hr = 5;
    ctx.beginPath(); ctx.arc(0, hy, hr, 0, 7); F(SK, 1);
    ctx.save(); ctx.beginPath(); ctx.arc(0, hy, hr, 0, 7); ctx.clip(); ctx.fillStyle = SK2; ctx.beginPath(); ctx.arc(2.2, hy + 2.2, hr, 0, 7); ctx.fill(); ctx.fillStyle = SK; ctx.beginPath(); ctx.arc(-0.6, hy - 0.6, hr - 0.6, 0, 7); ctx.fill(); ctx.restore();
    for (const ex of [-1.9, 1.9]) { ctx.fillStyle = '#1c1424'; ctx.beginPath(); ctx.ellipse(ex, hy + 0.2, 0.95, 1.25, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex - 0.3, hy - 0.3, 0.38, 0, 7); ctx.fill(); }
    ctx.strokeStyle = '#2a1a14'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(-2.8, hy - 1.9); ctx.lineTo(-1.1, hy - 1.6); ctx.moveTo(2.8, hy - 1.9); ctx.lineTo(1.1, hy - 1.6); ctx.stroke();
    ctx.fillStyle = 'rgba(255,110,120,0.4)'; ctx.beginPath(); ctx.arc(-3.1, hy + 1.9, 0.9, 0, 7); ctx.arc(3.1, hy + 1.9, 0.9, 0, 7); ctx.fill();
    ctx.fillStyle = '#2a1a14'; ctx.beginPath(); ctx.ellipse(-0.9, hy + 2.5, 1.2, 0.55, 0.25, 0, 7); ctx.ellipse(0.9, hy + 2.5, 1.2, 0.55, -0.25, 0, 7); ctx.fill();
    // red fez with the long black tassel
    rrect(ctx, -3.4, hy - hr - 3.2, 6.8, 4.4, 1.4); F('#e0323e', 1);
    ctx.fillStyle = '#a81a26'; ctx.fillRect(0.8, hy - hr - 2.6, 2.4, 3.6);
    ctx.strokeStyle = '#111014'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0.6, hy - hr - 3); ctx.quadraticCurveTo(5.6, hy - hr - 2, 5.3, hy + 1.5); ctx.quadraticCurveTo(5.2, hy + 4.5, 5.8, hy + 6.5); ctx.stroke();
    ctx.restore();
  }
  // Tomb of the Unknown Soldier: long low marble wall with the relief of a lying warrior
  function drawTomb(ctx, sx, sy, w) {
    const top = sy - 8, base = sy + 15, cx = sx + w / 2;
    ctx.fillStyle = SHADOW; ctx.fillRect(sx - 4, base - 2, w + 12, 8);
    // marble steps in front
    rrect(ctx, sx - 8, base - 3, w + 16, 7, 1.5); fillStroke(ctx, lin(ctx, 0, base - 3, 0, base + 4, '#f6f1e8', '#d8cfc0'), INK, 0.6);
    // the wall: face + top cornice
    rrect(ctx, sx - 4, top, w + 8, base - top, 1); fillStroke(ctx, lin(ctx, sx, top, sx + w * 0.4, base, '#fbf7ef', '#ddd3c2'), INK, 0.8);
    rrect(ctx, sx - 6, top - 4, w + 12, 5, 1.2); fillStroke(ctx, lin(ctx, 0, top - 4, 0, top + 1, '#ffffff', '#e2d9c8'), INK, 0.7);
    ctx.strokeStyle = 'rgba(150,135,120,0.35)'; ctx.lineWidth = 0.5; ctx.beginPath(); for (let k = 1; k < 6; k++) { ctx.moveTo(sx - 4 + k * (w + 8) / 6, top + 1); ctx.lineTo(sx - 4 + k * (w + 8) / 6, base); } ctx.stroke();
    // relief panel: the lying hoplite (drawn three times offset for a carved look)
    const relief = (dx, dy, col) => {
      ctx.save(); ctx.translate(cx + dx, top + 11 + dy); ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(-26, -1, 3.6, 3.2, 0, 0, 7); ctx.fill();                      // helmet
      ctx.beginPath(); ctx.moveTo(-29, -3.5); ctx.quadraticCurveTo(-26, -8, -21, -4.5); ctx.lineTo(-22, -3); ctx.quadraticCurveTo(-26, -5.5, -28.5, -2.5); ctx.fill(); // crest
      ctx.beginPath(); ctx.moveTo(-22, -2.2); ctx.quadraticCurveTo(-8, -4.5, 6, -2.6); ctx.lineTo(6, 2.6); ctx.quadraticCurveTo(-8, 3.6, -22, 2.2); ctx.closePath(); ctx.fill(); // body
      ctx.beginPath(); ctx.moveTo(6, -2.4); ctx.lineTo(24, -1.4); ctx.lineTo(25, 0.8); ctx.lineTo(6, 2.4); ctx.closePath(); ctx.fill(); // legs
      ctx.beginPath(); ctx.ellipse(-9, -3.6, 5.2, 2.2, 0, 0, 7); ctx.fill();                        // shield on the arm
      ctx.fillRect(-20, 3, 30, 0.9);                                                               // spear along the body
      ctx.restore();
    };
    rrect(ctx, cx - 36, top + 3, 72, 15, 1); fillStroke(ctx, 'rgba(200,188,170,0.35)', 'rgba(120,105,95,0.45)', 0.5);
    relief(0.6, 0.6, 'rgba(120,100,90,0.45)'); relief(-0.5, -0.5, 'rgba(255,255,255,0.9)'); relief(0, 0, '#e4d9c6');
    // bronze shields on the wall and two inscription panels
    for (const k of [-1, 1]) {
      const bx = cx + k * (w / 2 - 14);
      ellF(ctx, bx, top + 8, 4.2, 4.2, lin(ctx, bx - 4, top + 4, bx + 4, top + 12, '#e8b860', '#9a6a28'), INK, 0.5); ellF(ctx, bx - 1, top + 7, 1.4, 1.2, 'rgba(255,255,255,0.45)');
      ctx.fillStyle = 'rgba(110,95,85,0.5)'; for (let l = 0; l < 3; l++) ctx.fillRect(cx + k * 46 - 7, top + 13 + l * 2.2, 14, 0.7);
    }
    // laurel wreath with a blue-white ribbon at the foot
    ctx.lineWidth = 2.2; ctx.strokeStyle = '#3f7a34'; ctx.beginPath(); ctx.ellipse(cx, base + 1, 5.5, 2.6, 0, 0, 7); ctx.stroke();
    ctx.lineWidth = 0.5; ctx.strokeStyle = INK; ctx.beginPath(); ctx.ellipse(cx, base + 1, 6.6, 3.6, 0, 0, 7); ctx.stroke();
    ctx.fillStyle = '#1f5fbf'; ctx.fillRect(cx - 1.4, base + 2.4, 1.2, 4); ctx.fillStyle = '#ffffff'; ctx.fillRect(cx + 0.2, base + 2.4, 1.2, 4);
  }
  // roadworks dressing pieces (anchor = their spot on the ground)
  function drawWorks(ctx, kind, sx, sy, o) {
    if (kind === 'barH') {
      ctx.fillStyle = SHADOW; ctx.fillRect(sx - 6, sy - 1, 15, 3);
      for (const fx of [-6, 5]) { rrect(ctx, sx + fx, sy - 1, 2.4, 2, 0.6); fillStroke(ctx, '#2a2a30', null); rrect(ctx, sx + fx + 0.6, sy - 9, 1.2, 9, 0.4); fillStroke(ctx, '#d8d8e0', INK, 0.3); }
      rrect(ctx, sx - 7.5, sy - 10, 15, 4.4, 0.8); ctx.save(); ctx.clip(); ctx.fillStyle = '#ffffff'; ctx.fillRect(sx - 8, sy - 11, 16, 6);
      ctx.fillStyle = '#e8402a'; for (let k = -10; k < 10; k += 4) { ctx.beginPath(); ctx.moveTo(sx + k, sy - 10); ctx.lineTo(sx + k + 2, sy - 10); ctx.lineTo(sx + k + 4.4, sy - 5.6); ctx.lineTo(sx + k + 2.4, sy - 5.6); ctx.closePath(); ctx.fill(); } ctx.restore();
      rrect(ctx, sx - 7.5, sy - 10, 15, 4.4, 0.8); ctx.strokeStyle = INK; ctx.lineWidth = 0.6; ctx.stroke();
      if (Math.floor(sx + sy) % 3 === 0 && Math.sin(G.t * 6 + sx) > 0) { ellF(ctx, sx, sy - 11.5, 1.3, 1.3, '#ffb000', INK, 0.3); }
    } else if (kind === 'barV') {
      ctx.fillStyle = SHADOW; ctx.fillRect(sx + 1, sy - 7, 3, 16);
      for (const fy of [-7, 6]) { rrect(ctx, sx - 2, sy + fy, 4, 1.8, 0.6); fillStroke(ctx, '#2a2a30', null); }
      rrect(ctx, sx - 1.4, sy - 14, 2.8, 16, 0.8); ctx.save(); ctx.clip(); ctx.fillStyle = '#ffffff'; ctx.fillRect(sx - 2, sy - 15, 4, 18); ctx.fillStyle = '#e8402a'; for (let k = -14; k < 2; k += 4) ctx.fillRect(sx - 2, sy + k, 4, 2); ctx.restore();
      rrect(ctx, sx - 1.4, sy - 14, 2.8, 16, 0.8); ctx.strokeStyle = INK; ctx.lineWidth = 0.6; ctx.stroke();
      rrect(ctx, sx - 1.4, sy - 1, 2.8, 3, 0.6); fillStroke(ctx, 'rgba(120,40,40,0.5)', null);
    } else if (kind === 'cone') {
      ellF(ctx, sx + 1.5, sy + 0.8, 4.2, 1.6, SHADOW);
      rrect(ctx, sx - 3.6, sy - 1.2, 7.2, 2.2, 0.6); fillStroke(ctx, '#c84a10', INK, 0.45);
      ctx.beginPath(); ctx.moveTo(sx - 2.8, sy - 1); ctx.lineTo(sx - 0.6, sy - 10); ctx.lineTo(sx + 0.6, sy - 10); ctx.lineTo(sx + 2.8, sy - 1); ctx.closePath(); fillStroke(ctx, lin(ctx, sx - 3, 0, sx + 3, 0, '#ffa040', '#e05a10'), INK, 0.5);
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(sx - 2, sy - 4.2); ctx.lineTo(sx - 1.3, sy - 6.6); ctx.lineTo(sx + 1.3, sy - 6.6); ctx.lineTo(sx + 2, sy - 4.2); ctx.closePath(); ctx.fill();
    } else if (kind === 'sand') {
      ellF(ctx, sx + 2, sy + 1, 12, 3.2, SHADOW);
      ctx.beginPath(); ctx.moveTo(sx - 12, sy + 1); ctx.quadraticCurveTo(sx - 6, sy - 9, sx, sy - 9.5); ctx.quadraticCurveTo(sx + 7, sy - 9, sx + 12, sy + 1); ctx.closePath();
      fillStroke(ctx, lin(ctx, sx - 8, sy - 10, sx + 8, sy + 2, '#f2d49a', '#b98a52'), INK, 0.6);
      ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.ellipse(sx - 3, sy - 6.5, 4, 1.4, -0.3, 0, 7); ctx.fill();
      ctx.save(); ctx.translate(sx + 4, sy - 7); ctx.rotate(0.5); rrect(ctx, -0.5, -9, 1, 9, 0.4); fillStroke(ctx, '#8a5a30', INK, 0.3); rrect(ctx, -1.8, 0, 3.6, 3.4, 0.8); fillStroke(ctx, '#7a7a86', INK, 0.4); ctx.restore();
    } else if (kind === 'digger') {
      ctx.save(); ctx.translate(sx, sy); if (o && o.flip) ctx.scale(-1, 1);
      ellF(ctx, 2, 1, 14, 3.6, SHADOW);
      rrect(ctx, -11, -4, 18, 5, 2.4); fillStroke(ctx, '#2c2a30', INK, 0.6);
      ctx.fillStyle = '#55525c'; for (let k = -9; k < 6; k += 3) ctx.fillRect(k, -3.4, 1.2, 3.8);
      rrect(ctx, -9, -13, 13, 9.5, 1.6); fillStroke(ctx, lin(ctx, -9, -13, 4, -3, '#ffd23a', '#d89a10'), INK, 0.6);
      rrect(ctx, -7.6, -19, 8, 7, 1.4); fillStroke(ctx, '#ffcc2a', INK, 0.6); rrect(ctx, -6.4, -18, 5.8, 4.2, 0.8); fillStroke(ctx, '#8fd0f0', null);
      ctx.strokeStyle = INK; ctx.lineWidth = 3.4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(2, -10); ctx.lineTo(9, -18); ctx.lineTo(15, -8); ctx.stroke();
      ctx.strokeStyle = '#f2c020'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(2, -10); ctx.lineTo(9, -18); ctx.lineTo(15, -8); ctx.stroke(); ctx.lineCap = 'butt';
      ctx.beginPath(); ctx.moveTo(13, -9); ctx.lineTo(18, -8); ctx.lineTo(17, -3); ctx.lineTo(13, -4); ctx.closePath(); fillStroke(ctx, '#4a4850', INK, 0.5);
      ctx.restore();
    } else if (kind === 'sign') {
      ctx.fillStyle = SHADOW; ctx.fillRect(sx - 3, sy - 1, 9, 3);
      rrect(ctx, sx - 0.7, sy - 14, 1.4, 14, 0.4); fillStroke(ctx, '#8a8a92', INK, 0.35);
      rrect(ctx, sx - 4, sy - 1, 8, 2, 0.6); fillStroke(ctx, '#2a2a30', null);
      const ty = sy - 20; ctx.beginPath(); ctx.moveTo(sx, ty - 7); ctx.lineTo(sx + 7.5, ty + 5.5); ctx.lineTo(sx - 7.5, ty + 5.5); ctx.closePath(); fillStroke(ctx, '#d8202c', INK, 0.6);
      ctx.beginPath(); ctx.moveTo(sx, ty - 3.6); ctx.lineTo(sx + 4.6, ty + 3.8); ctx.lineTo(sx - 4.6, ty + 3.8); ctx.closePath(); ctx.fillStyle = '#fff6e0'; ctx.fill();
      ctx.strokeStyle = '#111'; ctx.lineWidth = 0.7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(sx - 0.8, ty - 0.4, 0.7, 0, 7); ctx.moveTo(sx - 0.9, ty + 0.4); ctx.lineTo(sx - 1.4, ty + 2.4); ctx.lineTo(sx - 2.2, ty + 3.4); ctx.moveTo(sx - 1.4, ty + 2.4); ctx.lineTo(sx - 0.4, ty + 3.4); ctx.moveTo(sx - 1, ty + 1); ctx.lineTo(sx + 1.4, ty + 1.8); ctx.lineTo(sx + 1.8, ty + 3.2); ctx.stroke();
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.ellipse(sx + 2.4, ty + 3.3, 1.2, 0.5, 0, 0, 7); ctx.fill(); ctx.lineCap = 'butt';
    }
  }
  // basketball hoop: post on the baseline, arm, backboard and orange rim with a white net (rim = W.COURT.hoop)
  function drawHoop(ctx, cx, by) {
    const H = W.COURT ? W.COURT.hoop : [0, 0], rimY = by + (H[1] - (W.COURT.y * TS + 3));
    ctx.fillStyle = SHADOW; ctx.beginPath(); ctx.ellipse(cx + 3, by + 2, 4, 1.6, 0, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(70,20,90,0.18)'; ctx.fillRect(cx - 8, by + 9, 18, 4); // shadow of the board on the floor
    rrect(ctx, cx - 1.4, rimY - 20, 2.8, by - rimY + 21, 1); fillStroke(ctx, lin(ctx, cx - 1.4, 0, cx + 1.4, 0, '#8a8a96', '#3a3a44'), INK, 0.5);
    rrect(ctx, cx - 3, by - 1, 6, 2.4, 0.6); fillStroke(ctx, '#2a2a30', null);
    rrect(ctx, cx - 11, rimY - 17, 22, 14, 1.4); fillStroke(ctx, lin(ctx, cx - 11, rimY - 17, cx + 11, rimY - 3, '#ffffff', '#d8dee8'), INK, 0.7);
    ctx.strokeStyle = '#e8402a'; ctx.lineWidth = 0.9; ctx.strokeRect(cx - 4.5, rimY - 10.5, 9, 6.5);
    // net
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 0.45; ctx.beginPath();
    for (let k = -4; k <= 4; k += 2) { ctx.moveTo(cx + k, rimY); ctx.lineTo(cx + k * 0.55, rimY + 6.5); }
    ctx.moveTo(cx - 3.6, rimY + 2.5); ctx.lineTo(cx + 3.6, rimY + 2.5); ctx.moveTo(cx - 2.8, rimY + 5); ctx.lineTo(cx + 2.8, rimY + 5); ctx.stroke();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.ellipse(cx, rimY, 5, 1.8, 0, 0, 7); ctx.stroke();
    ctx.strokeStyle = '#ff6a1a'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.ellipse(cx, rimY, 5, 1.8, 0, 0, 7); ctx.stroke();
  }
  // abandoned green-and-white e-scooter, lying on its side or leaning on its stand
  function drawScooter(ctx, cx, cy, p) {
    ctx.save(); ctx.translate(cx, cy); if (p.flip) ctx.scale(-1, 1);
    if (p.lying) {
      ctx.rotate(p.a);
      ctx.fillStyle = SHADOW; ctx.beginPath(); ctx.ellipse(1.5, 1.2, 9, 2.4, 0, 0, 7); ctx.fill();
      ellF(ctx, -7, 0, 1.9, 1.9, '#1e1c22', INK, 0.4); ellF(ctx, 7.5, 0, 1.9, 1.9, '#1e1c22', INK, 0.4);
      rrect(ctx, -7, -1.4, 11, 2.8, 1.2); fillStroke(ctx, lin(ctx, 0, -1.4, 0, 1.4, '#5ee86a', '#20a838'), INK, 0.5);
      rrect(ctx, 3, -0.8, 11, 1.6, 0.8); fillStroke(ctx, '#f6f6f8', INK, 0.45);
      rrect(ctx, 13, -3.6, 1.6, 7.2, 0.7); fillStroke(ctx, '#2a2a30', INK, 0.35);
      ctx.fillStyle = '#20a838'; ctx.fillRect(4.6, -0.5, 3, 1);
    } else {
      ctx.fillStyle = SHADOW; ctx.beginPath(); ctx.ellipse(2.5, 1.2, 8, 2.2, 0, 0, 7); ctx.fill();
      ellF(ctx, -6, 0, 1.7, 1.7, '#1e1c22', INK, 0.4); ellF(ctx, 6, 0, 1.7, 1.7, '#1e1c22', INK, 0.4);
      rrect(ctx, -6.5, -2.6, 10.5, 2.4, 1); fillStroke(ctx, lin(ctx, 0, -2.6, 0, -0.2, '#5ee86a', '#20a838'), INK, 0.5);
      ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(5, -1.5); ctx.lineTo(7.2 + p.a * 2, -15); ctx.stroke();
      ctx.strokeStyle = '#f6f6f8'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(5, -1.5); ctx.lineTo(7.2 + p.a * 2, -15); ctx.stroke();
      ctx.strokeStyle = '#2a2a30'; ctx.lineWidth = 1.2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(4.4 + p.a * 2, -15.4); ctx.lineTo(10 + p.a * 2, -14.6); ctx.stroke(); ctx.lineCap = 'butt';
      ctx.strokeStyle = '#3a3a40'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(-2, -0.4); ctx.lineTo(-3.6, 1.4); ctx.stroke(); // kickstand
    }
    ctx.restore();
  }

  // ---------- façade signs, ATMs, Airbnb, graffiti, countryside set pieces ----------
  // shop sign fixed on the front wall above the door (painted into the building canvas; text by W.drawSigns)
  function paintFace(x, b, w, h) {
    const f = b.face, dxs = (b.door[0] - b.x) * TS + 8, ic = f.icon ? 12 : 0, neon = f.kind === 'neon';
    const sw = Math.min(w - 6, Math.round(b.label.length * 4.1 + 10 + ic)), sh = neon ? 11 : 10;
    const sx = Math.round(Math.max(3, Math.min(w - 3 - sw, dxs - sw / 2))), sy = h - 17 - sh;
    b.signRect = [sx, sy, sw, sh]; b.signDx = ic / 2;
    rrect(x, sx + 1.5, sy + 2, sw, sh, 2); x.fillStyle = 'rgba(40,20,50,0.32)'; x.fill(); // shadow on the wall
    x.fillStyle = '#5a5662'; x.fillRect(sx + 4, sy - 1.5, 1.2, 2); x.fillRect(sx + sw - 5.2, sy - 1.5, 1.2, 2); // wall brackets
    if (neon) {
      rrect(x, sx, sy, sw, sh, 2.2); fillStroke(x, f.board, INK, 0.8);
      x.save(); x.globalAlpha = 0.45; x.strokeStyle = f.glow; x.lineWidth = 2.4; rrect(x, sx + 1.6, sy + 1.6, sw - 3.2, sh - 3.2, 1.6); x.stroke(); x.restore();
      x.strokeStyle = G.shade(f.glow, 0.45); x.lineWidth = 0.8; rrect(x, sx + 1.6, sy + 1.6, sw - 3.2, sh - 3.2, 1.6); x.stroke();
    } else {
      rrect(x, sx, sy, sw, sh, 1.6); fillStroke(x, f.frame, INK, 0.7);
      rrect(x, sx + 1.2, sy + 1.2, sw - 2.4, sh - 2.4, 1); fillStroke(x, lin(x, 0, sy, 0, sy + sh, G.shade(f.board, 0.12), G.shade(f.board, -0.12)), null);
      x.fillStyle = 'rgba(255,255,255,0.18)'; x.fillRect(sx + 1.5, sy + 1.4, sw - 3, 1);
      if (f.icon) { ellF(x, sx + 6.5, sy + sh / 2, 4, 4, '#fffaf0', INK, 0.5); drawShopIcon(x, f.icon, sx + 6.5, sy + sh / 2); }
    }
  }
  // ATM built into the wall: steel body, blue header with a euro mark, glowing screen, keypad, card + cash slots
  function drawATM(x, cx, h) {
    const t = h - 27, L = cx - 6.5;
    rrect(x, L - 1.2, t - 1.2, 15.4, 25.4, 2); fillStroke(x, 'rgba(40,30,50,0.4)', null);
    rrect(x, L, t, 13, 24, 1.6); fillStroke(x, lin(x, L, t, L + 13, t + 24, '#eef2f8', '#98a4b6'), INK, 0.6);
    rrect(x, L, t, 13, 4.4, 1.4); fillStroke(x, '#1f5fbf', INK, 0.5);
    x.strokeStyle = '#ffd84a'; x.lineWidth = 0.6; x.beginPath(); x.arc(cx + 0.4, t + 2.2, 1.3, 0.7, 5.6); x.moveTo(cx - 1.5, t + 1.9); x.lineTo(cx + 0.3, t + 1.9); x.moveTo(cx - 1.5, t + 2.6); x.lineTo(cx + 0.3, t + 2.6); x.stroke();
    rrect(x, L + 2, t + 5.6, 9, 6.6, 1); fillStroke(x, '#1a2230', INK, 0.4);
    rrect(x, L + 2.8, t + 6.3, 7.4, 5.1, 0.6); fillStroke(x, lin(x, 0, t + 6, 0, t + 11.5, '#a8f4ff', '#2fa8d8'), null);
    x.fillStyle = 'rgba(255,255,255,0.6)'; x.fillRect(L + 3.5, t + 7.2, 4.2, 0.6); x.fillRect(L + 3.5, t + 8.8, 2.8, 0.6);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) { rrect(x, L + 2.4 + c * 2.3, t + 13.3 + r * 1.9, 1.7, 1.3, 0.3); fillStroke(x, r === 3 ? ['#e0402a', '#f2c230', '#38b058'][c] : '#343a46', null); }
    x.fillStyle = '#1a1a22'; x.fillRect(L + 10.1, t + 14, 1.5, 4.2); x.fillStyle = '#38d058'; x.fillRect(L + 10.1, t + 13.1, 1.5, 0.6);
    rrect(x, L + 2.5, t + 21.2, 8, 1.4, 0.5); fillStroke(x, '#14141a', null);
    x.fillStyle = 'rgba(255,255,255,0.4)'; x.fillRect(L + 0.8, t + 4.8, 0.8, 18);
  }
  // Airbnb flat: pink plaque left of the door (text by W.drawSigns), a cluster of key lockboxes right of it
  function paintAirbnb(x, b, w, h) {
    const dx = (b.door[0] - b.x) * TS, pw = 20, px = Math.max(3, dx - pw), py = h - 15;
    rrect(x, px + 1, py + 1.5, pw, 7.5, 1.6); x.fillStyle = 'rgba(40,20,50,0.3)'; x.fill();
    rrect(x, px, py, pw, 7.5, 1.6); fillStroke(x, lin(x, 0, py, 0, py + 7.5, '#ff7d96', '#e2335a'), INK, 0.5);
    x.fillStyle = 'rgba(255,255,255,0.3)'; x.fillRect(px + 1.2, py + 1, pw - 2.4, 0.8);
    b.abRect = [px, py, pw, 7.5];
    x.fillStyle = '#7a7a86'; x.fillRect(dx + 15.4, h - 17, 1.2, 15); // the drainpipe the lockboxes are chained to
    const lock = (lx, ly) => {
      x.strokeStyle = '#a8a8b4'; x.lineWidth = 0.7; x.beginPath(); x.arc(lx + 2.2, ly, 1.4, Math.PI, 0); x.stroke();
      rrect(x, lx, ly, 4.4, 5, 0.8); fillStroke(x, lin(x, lx, ly, lx + 4.4, ly + 5, '#545866', '#22242c'), INK, 0.4);
      x.fillStyle = '#d0d4e0'; for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) x.fillRect(lx + 0.9 + c * 1.7, ly + 0.9 + r * 1.3, 0.9, 0.8);
    };
    lock(dx + 17, h - 15); lock(dx + 17, h - 8.5); lock(dx + 22, h - 12);
  }
  // pulsing neon on a façade sign (+ the First Dates heart)
  function drawNeon(ctx, b, sx, sy) {
    const r = b.signRect, f = b.face; if (!r) return;
    const pulse = 0.75 + Math.sin(G.t * 3.2 + b.x) * 0.25, cx = sx + r[0] + r[2] / 2, cy = sy + r[1] + r[3] / 2;
    ctx.save(); ctx.globalAlpha = 0.3 * pulse; ctx.translate(cx, cy); ctx.scale(1, 0.42);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r[2] * 0.72); g.addColorStop(0, f.halo); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r[2] * 0.72, 0, 7); ctx.fill(); ctx.restore();
    ctx.save(); ctx.globalAlpha = 0.55 * pulse; ctx.strokeStyle = f.glow; ctx.lineWidth = 2.6; rrect(ctx, sx + r[0] - 0.6, sy + r[1] - 0.6, r[2] + 1.2, r[3] + 1.2, 2.6); ctx.stroke(); ctx.restore();
    if (f.heart) {
      const hy = sy + r[1] - 6.5, gl = ctx.createRadialGradient(cx, hy, 0, cx, hy, 11); gl.addColorStop(0, 'rgba(255,80,160,' + (0.5 * pulse) + ')'); gl.addColorStop(1, 'rgba(255,80,160,0)');
      ctx.fillStyle = gl; ctx.fillRect(cx - 11, hy - 11, 22, 22);
      heartPath(ctx, cx, hy, 4.6); ctx.fillStyle = '#2a0a1e'; ctx.fill();
      ctx.save(); ctx.globalAlpha = 0.55 * pulse; ctx.strokeStyle = f.glow; ctx.lineWidth = 2.6; heartPath(ctx, cx, hy, 3.8); ctx.stroke(); ctx.restore();
      ctx.strokeStyle = '#ffd6ea'; ctx.lineWidth = 0.9; heartPath(ctx, cx, hy, 3.8); ctx.stroke();
    }
  }
  // spray-painted slogan on a wall: overspray haze, dark outline, flat colour, a few drips (game font, crisp every frame)
  function drawSpray(ctx, sx, sy, g, seed) {
    const U = G.ui, font = sz => (U && U.fpx ? U.fpx(sz, 800) : '800 ' + Math.round(sz * 14) / 10 + 'px sans-serif');
    ctx.save(); ctx.translate(sx + g.x, sy + g.y); ctx.rotate(g.rot || 0);
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    let ly = 0;
    g.lines.forEach((s, i) => {
      let size = g.size; ctx.font = font(size); let mw = ctx.measureText(s).width;
      if (mw > g.maxW) { size *= g.maxW / mw; ctx.font = font(size); mw = g.maxW; }
      const px = size * 1.4; if (i) ly += px * 1.05;
      ctx.globalAlpha = 0.28; ctx.strokeStyle = g.col; ctx.lineWidth = px * 0.42; ctx.strokeText(s, 0, ly);
      ctx.globalAlpha = 1; ctx.strokeStyle = 'rgba(20,10,30,0.9)'; ctx.lineWidth = Math.max(0.9, px * 0.16); ctx.strokeText(s, 0, ly);
      ctx.fillStyle = g.col; ctx.fillText(s, 0, ly);
      ctx.strokeStyle = g.col; ctx.lineWidth = 0.6;
      for (let k = 0; k < 3; k++) {
        const dx = (G.hash(seed + i * 5 + k, 31) - 0.5) * mw * 0.85, dl = 1.5 + G.hash(k, seed + i) * 4;
        ctx.beginPath(); ctx.moveTo(dx, ly); ctx.lineTo(dx, ly + dl); ctx.stroke(); ctx.beginPath(); ctx.arc(dx, ly + dl, 0.5, 0, 7); ctx.fill();
      }
    });
    ctx.restore();
  }
  // road signpost: blue finger boards (pointing left/right, or with an up/down arrow), names on the UI layer
  function postGeom(p, i) {
    const n = p.lines.length, d = p.lines[i].d, shift = d === 1 ? 3 : d === -1 ? -3 : 0, L = -p.bw / 2 + shift;
    return { L, top: -2 - (n - i) * 9.5, tx: L + p.bw / 2 + (d === 'u' || d === 'd' ? -3 : 0) };
  }
  function drawSignpost(ctx, cx, y, p) {
    const top0 = -2 - p.lines.length * 9.5;
    ellF(ctx, cx + 3, y + 14, 7, 2.2, SHADOW, null);
    rrect(ctx, cx - 1.1, y + top0 - 2, 2.2, 15 - top0, 0.8); fillStroke(ctx, lin(ctx, cx - 1.1, 0, cx + 1.1, 0, '#e0e0e8', '#7a7a88'), INK, 0.45);
    p.lines.forEach((l, i) => {
      const g = postGeom(p, i), L = cx + g.L, T = y + g.top, R = L + p.bw;
      ctx.beginPath();
      if (l.d === 1) { ctx.moveTo(L, T); ctx.lineTo(R, T); ctx.lineTo(R + 4, T + 4); ctx.lineTo(R, T + 8); ctx.lineTo(L, T + 8); }
      else if (l.d === -1) { ctx.moveTo(R, T); ctx.lineTo(L, T); ctx.lineTo(L - 4, T + 4); ctx.lineTo(L, T + 8); ctx.lineTo(R, T + 8); }
      else ctx.rect(L, T, p.bw, 8);
      ctx.closePath(); fillStroke(ctx, lin(ctx, 0, T, 0, T + 8, '#3a7ee0', '#1a4ea8'), INK, 0.6);
      ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(L + 1, T + 1, p.bw - 2, 0.9);
      if (l.d === 'u' || l.d === 'd') {
        ctx.fillStyle = '#ffffff'; ctx.beginPath();
        if (l.d === 'd') { ctx.moveTo(R - 6.5, T + 2.4); ctx.lineTo(R - 1.5, T + 2.4); ctx.lineTo(R - 4, T + 6); } else { ctx.moveTo(R - 6.5, T + 6); ctx.lineTo(R - 1.5, T + 6); ctx.lineTo(R - 4, T + 2.4); }
        ctx.closePath(); ctx.fill();
      }
    });
  }
  // round hay bale lying in the field
  function drawBale(ctx, cx, cy, flip) {
    const s = flip ? -1 : 1;
    ellF(ctx, cx + 3, cy + 4.5, 9, 2.6, SHADOW, null);
    rrect(ctx, cx - 7, cy - 6, 14, 10, 4.5); fillStroke(ctx, lin(ctx, cx - 7, cy - 6, cx + 7, cy + 4, '#f2d36b', '#b88a2e'), INK, 0.6);
    ctx.strokeStyle = 'rgba(140,100,30,0.45)'; ctx.lineWidth = 0.5; ctx.beginPath();
    for (let k = -4; k <= 4; k += 2.6) { ctx.moveTo(cx + k, cy - 5.5); ctx.quadraticCurveTo(cx + k + 0.8, cy - 1, cx + k, cy + 3.5); } ctx.stroke();
    ellF(ctx, cx + s * 5.5, cy - 1, 2.8, 5, lin(ctx, 0, cy - 6, 0, cy + 4, '#f8e08a', '#c99a3a'), INK, 0.5);
    ctx.strokeStyle = 'rgba(150,105,30,0.6)'; ctx.lineWidth = 0.45;
    ctx.beginPath(); ctx.ellipse(cx + s * 5.5, cy - 1, 1.6, 3, 0, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.ellipse(cx + s * 5.5, cy - 1, 0.6, 1.2, 0, 0, 7); ctx.stroke();
  }
  // roadside shrine (εικονοστάσι) on a post, candle glowing behind the glass
  function drawShrine(ctx, cx, fy) {
    ellF(ctx, cx + 3, fy + 1, 5, 1.8, SHADOW, null);
    rrect(ctx, cx - 0.8, fy - 12, 1.6, 12.5, 0.5); fillStroke(ctx, '#7a7a86', INK, 0.4);
    rrect(ctx, cx - 4.5, fy - 21, 9, 9.5, 1); fillStroke(ctx, lin(ctx, cx - 4.5, 0, cx + 4.5, 0, '#ffffff', '#cfd0da'), INK, 0.6);
    ctx.beginPath(); ctx.moveTo(cx - 5.5, fy - 20.5); ctx.lineTo(cx, fy - 25); ctx.lineTo(cx + 5.5, fy - 20.5); ctx.closePath(); fillStroke(ctx, '#2a62c9', INK, 0.5);
    ctx.strokeStyle = '#d8b44a'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(cx, fy - 25); ctx.lineTo(cx, fy - 28); ctx.moveTo(cx - 1.2, fy - 27); ctx.lineTo(cx + 1.2, fy - 27); ctx.stroke();
    const p = 0.8 + Math.sin(G.t * 5 + cx) * 0.2, gl = ctx.createRadialGradient(cx, fy - 16, 0, cx, fy - 16, 4);
    gl.addColorStop(0, 'rgba(255,210,110,' + (0.9 * p) + ')'); gl.addColorStop(1, 'rgba(255,160,60,0.15)');
    rrect(ctx, cx - 3, fy - 19.5, 6, 6.5, 0.8); fillStroke(ctx, gl, 'rgba(28,20,36,0.6)', 0.4);
    ctx.fillStyle = '#fff2c8'; ctx.fillRect(cx - 0.5, fy - 16, 1, 2.4);
  }
  // the Airbnb guests' rolling suitcase
  function drawSuitcase(ctx, cx, fy, k) {
    const col = ['#e8335a', '#2a6ad0', '#f2c230', '#3a3a44'][k % 4];
    cx += k % 2 ? -3 : 2;
    ellF(ctx, cx + 2, fy + 0.5, 5.5, 1.6, SHADOW, null);
    ctx.strokeStyle = '#2a2a30'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(cx - 1.8, fy - 10); ctx.lineTo(cx - 1.8, fy - 14); ctx.lineTo(cx + 1.8, fy - 14); ctx.lineTo(cx + 1.8, fy - 10); ctx.stroke();
    rrect(ctx, cx - 4, fy - 10.5, 8, 10, 1.6); fillStroke(ctx, lin(ctx, cx - 4, 0, cx + 4, 0, G.shade(col, 0.2), G.shade(col, -0.25)), INK, 0.55);
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(cx - 1.6, fy - 10, 0.7, 9); ctx.fillRect(cx + 1, fy - 10, 0.7, 9);
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(cx - 3.2, fy - 9.6, 0.8, 8);
    ellF(ctx, cx - 2.6, fy, 0.9, 0.9, '#1e1c22', null); ellF(ctx, cx + 2.6, fy, 0.9, 0.9, '#1e1c22', null);
  }
  // countryside landmarks (x, y = screen position of the base, centre)
  function drawLandmark(ctx, k, x, y) {
    if (k === 'windmill') {
      ellF(ctx, x + 6, y + 2, 13, 4, SHADOW, null);
      ctx.beginPath(); ctx.moveTo(x - 8, y + 1); ctx.lineTo(x - 6.5, y - 22); ctx.lineTo(x + 6.5, y - 22); ctx.lineTo(x + 8, y + 1); ctx.closePath(); fillStroke(ctx, lin(ctx, x - 8, 0, x + 8, 0, '#ffffff', '#cfcac0'), INK, 0.7);
      rrect(ctx, x - 2.2, y - 8, 4.4, 9, 2); fillStroke(ctx, '#3f6fb8', INK, 0.5);
      rrect(ctx, x - 1.4, y - 17, 2.8, 3.2, 1); fillStroke(ctx, '#3f6fb8', INK, 0.4);
      ctx.beginPath(); ctx.moveTo(x - 7.6, y - 21); ctx.quadraticCurveTo(x, y - 35, x + 7.6, y - 21); ctx.closePath(); fillStroke(ctx, lin(ctx, x - 7, y - 30, x + 7, y - 21, '#b07a48', '#6a4424'), INK, 0.6);
      const hx = x + 1, hy = y - 24, a0 = G.t * 0.9;
      for (let i = 0; i < 4; i++) {
        const a = a0 + i * Math.PI / 2, c = Math.cos(a), s = Math.sin(a);
        ctx.strokeStyle = '#5a3a20'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + c * 16, hy + s * 16); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(hx + c * 4, hy + s * 4); ctx.lineTo(hx + c * 15, hy + s * 15); ctx.lineTo(hx + c * 15 - s * 4.5, hy + s * 15 + c * 4.5); ctx.lineTo(hx + c * 5 - s * 3, hy + s * 5 + c * 3); ctx.closePath();
        fillStroke(ctx, 'rgba(250,246,236,0.95)', INK, 0.4);
      }
      ellF(ctx, hx, hy, 1.7, 1.7, '#5a3a20', INK, 0.4);
    } else if (k === 'chapel') {
      if (G.drawChapel) G.drawChapel(ctx, x - 3, y - 6);
      ellF(ctx, x + 15, y + 1, 4, 1.6, SHADOW, null); // a cypress next to it
      ctx.beginPath(); ctx.ellipse(x + 13, y - 9, 3.2, 10, 0, 0, 7); fillStroke(ctx, lin(ctx, x + 10, y - 19, x + 16, y + 1, '#4f8a4a', '#1f4a2a'), INK, 0.5);
    } else if (k === 'tractor') {
      ellF(ctx, x + 3, y + 2, 15, 3.6, SHADOW, null);
      rrect(ctx, x - 6, y - 12, 18, 8, 2); fillStroke(ctx, lin(ctx, 0, y - 12, 0, y - 4, '#e8463a', '#a82418'), INK, 0.6);
      rrect(ctx, x - 12, y - 22, 10, 14, 1.5); fillStroke(ctx, lin(ctx, x - 12, 0, x - 2, 0, '#e8463a', '#b02a1e'), INK, 0.6);
      rrect(ctx, x - 10.5, y - 20.5, 7, 6, 1); fillStroke(ctx, lin(ctx, 0, y - 20, 0, y - 14, '#d8f4ff', '#5a9ac8'), null);
      rrect(ctx, x - 13, y - 24, 12, 2.5, 1); fillStroke(ctx, '#2a2a30', INK, 0.4);
      rrect(ctx, x + 6, y - 19, 1.6, 8, 0.6); fillStroke(ctx, '#3a3a44', INK, 0.35);
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(x - 5, y - 11, 16, 1);
      ellF(ctx, x - 8, y - 4, 6.5, 6.5, '#1e1c22', INK, 0.6); ellF(ctx, x - 8, y - 4, 3, 3, '#e8c23a', INK, 0.4);
      ellF(ctx, x + 9, y - 1.5, 3.6, 3.6, '#1e1c22', INK, 0.5); ellF(ctx, x + 9, y - 1.5, 1.6, 1.6, '#e8c23a', INK, 0.3);
    }
  }

  W.minimap = function () {
    if (W._mini) return W._mini;
    const [c, x] = G.mkCanvas(W.w, W.h); const d = x.createImageData(W.w, W.h);
    const COL = { '~': [120, 200, 80], T: [40, 110, 50], R: [70, 72, 82], '.': [200, 194, 180], p: [232, 216, 168], S: [236, 228, 208], W: [72, 144, 240], F: [150, 210, 100], f: [160, 120, 72], r: [120, 110, 100], B: [180, 90, 70], P: [80, 168, 58], H: [110, 110, 120], O: [36, 104, 196], s: [244, 221, 174], w: [120, 220, 214], k: [230, 140, 40], C: [228, 138, 92], Y: [226, 196, 90], L: [150, 108, 68], K: [128, 126, 122], D: [150, 108, 68], q: [120, 110, 100], g: [176, 184, 104], Z: [200, 180, 140] };
    const ml = [234, 232, 226];
    for (let y = 0; y < W.h; y++) for (let xx = 0; xx < W.w; xx++) { const tc = W.t[y][xx]; const col = ('gTKsp'.includes(tc) && inEll(W.MILOS, xx, y)) ? ml : COL[tc] || [0, 0, 0]; const i = (y * W.w + xx) * 4; d.data[i] = col[0]; d.data[i + 1] = col[1]; d.data[i + 2] = col[2]; d.data[i + 3] = 255; }
    x.putImageData(d, 0, 0);
    for (const r of W.regions) if (r.miniDraw) { x.save(); x.translate(r.tx, r.ty); r.miniDraw(x); x.restore(); } else if (r.mini) { x.fillStyle = r.mini; x.fillRect(r.tx, r.ty, r.w, r.h); }
    for (const b of W.buildings) { x.fillStyle = b.roof; x.fillRect(b.x, b.y, b.w, b.h); }
    W._mini = c; return c;
  };

  // compatibility
  W.load = function () { W.build(); W.pois = {}; };
})();
