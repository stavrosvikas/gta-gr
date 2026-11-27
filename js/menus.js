// GTA LUBEN — menus: title, device select, character creator, pause, map, travel card
'use strict';
(function () {
  const U = G.ui;

  // animated background: a slice of the real map scrolling
  function bgCity(ctx, t) {
    const W = G.World; const cx = 44 * G.TS - G.W / 2 + Math.sin(t * 0.07) * 500, cy = 34 * G.TS - G.H / 2 + Math.cos(t * 0.05) * 300;
    W.drawGround(ctx, cx, cy);
    ctx.fillStyle = 'rgba(10,6,20,0.55)'; ctx.fillRect(0, 0, G.W, G.H);
  }
  // the user's GTA GR logo (SVG)
  const LOGO = new Image(); LOGO.src = 'assets/logo/gta_gr.svg?v=4';
  function logo(y, size = 1) {
    const c = U.ctx;
    if (LOGO.complete && LOGO.naturalWidth) {
      const w = 190 * size, h = w * 738.82 / 1315.95, top = Math.max(14, y - 34 * size);
      c.drawImage(LOGO, G.W / 2 - w / 2, top, w, h);
      return;
    }
    U.title(G.W / 2 - 2, y, 'GTA', 44 * size, '#fff');
    U.title(G.W / 2 + 4, y + 30 * size, 'GR', 34 * size, '#ff3e8a');
  }

  // ---------- TITLE ----------
  G.TitleScene = {
    enter() { this.t = 0; },
    update(dt) {
      this.t += dt;
      U.setMobile([], 'none');
      if (G.pressed('ok') || (G.input.pointer && G.input.pointer.justDown)) { G.audio.sfx('coin'); G.replace(G.DeviceScene); }
    },
    render(ctx) {
      bgCity(ctx, this.t);
      const u = U.begin(); logo(60, 1.1);
      if (Math.floor(this.t * 2) % 2) { const s = 'ΠΑΤΑ ENTER / ΑΓΓΙΞΕ ΓΙΑ ΝΑ ΞΕΚΙΝΗΣΕΙΣ'; U.text(G.W / 2, G.H - 40, s, U.fitSize(s, G.W - 24, 9, 6), '#fff', 'center'); }
    },
  };

  // ---------- DEVICE ----------
  G.DeviceScene = {
    enter() { this.sel = ('ontouchstart' in window) ? 1 : 0; this.t = 0; },
    update(dt) {
      this.t += dt; U.setMobile([], 'none');
      if (G.pressed('left') || G.pressed('right') || G.pressed('up') || G.pressed('down')) this.sel = 1 - this.sel;
      if (G.pressed('ok')) this.choose(this.sel);
    },
    choose(i) {
      G.device = i ? 'mobile' : 'pc'; G.audio.sfx('coin');
      if (G.device === 'mobile') { try { document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {}); screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {}); } catch (e) {} }
      const saved = G.load();
      if (saved) { G.state = saved; G.replace(G.ContinueScene); } else { G.state = G.newState(); G.replace(G.CreatorScene); }
    },
    render(ctx) {
      bgCity(ctx, this.t + 30);
      U.begin(); U.title(G.W / 2, 34, 'ΔΙΑΛΕΞΕ ΣΥΣΚΕΥΗ', 20, '#fff');
      const w = 120, h = 92, gap = 14, x0 = G.W / 2 - w - gap / 2;
      [['💻', 'ΥΠΟΛΟΓΙΣΤΗΣ', 'WASD / βελάκια · E μπες-βγες · SPACE δράση · R ραδιόφωνο · M χάρτης'], ['📱', 'ΚΙΝΗΤΟ', 'Joystick στην οθόνη · κουμπιά δράσης · γύρνα το οριζόντια']].forEach(([ic, name, info], i) => {
        const x = x0 + i * (w + gap), y = 52;
        if (U.button(x, y, w, h, '', this.sel === i)) this.choose(i);
        U.text(x + w / 2, y + 30, ic, 22, '#fff', 'center', null);
        U.title(x + w / 2, y + 50, name, 12, '#fff');
        U.wrap(info, w - 10, 7).forEach((l, k) => U.text(x + w / 2, y + 63 + k * 8, l, 7, '#ddd', 'center', null));
      });
    },
  };

  // ---------- CONTINUE ----------
  G.ContinueScene = {
    enter() { this.t = 0; this.sel = 0; },
    update(dt) { this.t += dt; U.setMobile([], 'none'); if (G.pressed('up') || G.pressed('down')) this.sel = 1 - this.sel; if (G.pressed('ok')) this.go(this.sel); },
    go(i) { if (i === 1) { G.wipe(); G.state = G.newState(); G.replace(G.CreatorScene); } else G.startWorld(); },
    render(ctx) {
      bgCity(ctx, this.t); U.begin(); logo(40, 0.8);
      const done = Object.keys(G.state.done).filter(k => G.quests[k]).length;
      U.text(G.W / 2, 98, `Αποστολές: ${done}/${Object.keys(G.quests).length} · ${G.fmtMoney(G.state.money)}`, 8, '#fff', 'center');
      if (U.button(G.W / 2 - 70, 108, 140, 18, 'ΣΥΝΕΧΕΙΑ', this.sel === 0)) this.go(0);
      if (U.button(G.W / 2 - 70, 132, 140, 18, 'ΝΕΟ ΠΑΙΧΝΙΔΙ', this.sel === 1)) this.go(1);
    },
  };

  // ---------- CHARACTER CREATOR ----------
  const SKINS = ['#f6d3b8', '#f0c8a8', '#e8b48a', '#d9a27a', '#c98c62', '#a8714a', '#7a4a2a', '#5a341c'];
  const HAIRC = ['#141210', '#2b1d14', '#5a341c', '#8a5a2a', '#d07a3a', '#e0c070', '#d8d8d8', '#ff3e8a', '#2d6bff'];
  const HAIRS_M = ['short', 'buzz', 'curly', 'slick', 'quiff', 'long', 'mullet', 'bald', 'afro'];
  const HAIRS_F = ['long', 'bob', 'ponytail', 'bun', 'curly_long', 'curly', 'afro', 'buzz'];
  const HS_LABEL = { short: 'Κοντά', buzz: 'Ξυρισμένα', curly: 'Σγουρά', slick: 'Γλειμμένα', quiff: 'Λοφίο', long: 'Μακριά', mullet: 'Μαλλέτ', bald: 'Φαλάκρα', afro: 'Άφρο', bob: 'Καρέ', ponytail: 'Αλογοουρά', bun: 'Κότσος', curly_long: 'Σγουρά μακριά' };
  const OUTFITS = {
    casual: { label: 'CASUAL', top: '#3a6ea5', topStyle: 'tshirt', legs: '#2d3446', shoes: '#eee', acc: [] },
    formal: { label: 'FORMAL', top: '#1d2c5a', top2: '#ffffff', topStyle: 'suit', legs: '#1d2c5a', shoes: '#111', acc: ['tie:#c0392b'] },
    xyma:   { label: 'ΧΥΜΑ', top: '#9aa0a6', topStyle: 'tank', legs: '#5a6a3a', shoes: '#333', acc: ['crocs'] },
  };
  G.OUTFITS = OUTFITS;
  G.buildLook = function (o) {
    const of = OUTFITS[o.outfit];
    const look = { skin: o.skin, hair: o.hair, hairStyle: o.hairStyle, female: o.female, top: of.top, top2: of.top2, topStyle: of.topStyle, legs: of.legs, shoes: of.shoes, acc: [...of.acc] };
    if (o.female && o.outfit === 'formal') { look.top = '#9a1230'; look.top2 = null; look.topStyle = 'gown'; look.legs = '#9a1230'; look.shoes = '#111'; look.acc = ['earrings', 'gold']; } // evening dress
    if (o.female && o.outfit === 'casual') { look.top = '#ff6f9c'; look.topStyle = 'tshirt'; look.skirt = true; look.legs = '#4a78b8'; look.shoes = '#f4f4f4'; } // pink top + denim skirt
    if (o.female) look.acc.push('lipstick');
    return look;
  };
  G.CreatorScene = {
    enter() {
      this.t = 0; this.row = 0;
      this.o = { female: false, skin: SKINS[2], hair: HAIRC[1], hairStyle: 'short', outfit: 'casual' };
    },
    rows() {
      const o = this.o, hs = o.female ? HAIRS_F : HAIRS_M;
      return [
        { label: 'ΦΥΛΟ', val: o.female ? 'Γυναίκα' : 'Άντρας', step: d => { o.female = !o.female; o.hairStyle = (o.female ? HAIRS_F : HAIRS_M)[0]; } },
        { label: 'ΧΡΩΜΑ', val: '', swatch: o.skin, step: d => { o.skin = SKINS[(SKINS.indexOf(o.skin) + d + SKINS.length) % SKINS.length]; } },
        { label: 'ΜΑΛΛΙΑ', val: HS_LABEL[o.hairStyle], step: d => { o.hairStyle = hs[(hs.indexOf(o.hairStyle) + d + hs.length) % hs.length]; } },
        { label: 'ΧΡΩΜΑ ΜΑΛΛΙΩΝ', val: '', swatch: o.hair, step: d => { o.hair = HAIRC[(HAIRC.indexOf(o.hair) + d + HAIRC.length) % HAIRC.length]; } },
        { label: 'ΡΟΥΧΑ', val: OUTFITS[o.outfit].label, step: d => { const k = Object.keys(OUTFITS); o.outfit = k[(k.indexOf(o.outfit) + d + k.length) % k.length]; } },
        { label: 'ΞΕΚΙΝΑ', go: true },
      ];
    },
    update(dt) {
      this.t += dt; U.setMobile([], 'none');
      const rows = this.rows();
      if (G.pressed('up')) this.row = (this.row + rows.length - 1) % rows.length;
      if (G.pressed('down')) this.row = (this.row + 1) % rows.length;
      const r = rows[this.row];
      if (r.step && G.pressed('left')) { r.step(-1); G.audio.sfx('blip'); }
      if (r.step && G.pressed('right')) { r.step(1); G.audio.sfx('blip'); }
      if (G.pressed('ok') && r.go) this.finish();
    },
    finish() {
      G.state.look = G.buildLook(this.o); G.state.creator = this.o; G.state.outfit = this.o.outfit; G.save();
      G.audio.sfx('mission_pass'); G.replace(G.StoryIntro());
    },
    render(ctx) {
      bgCity(ctx, this.t + 60); U.begin();
      U.title(G.W / 2, 22, 'ΦΤΙΑΞΕ ΤΟΝ ΧΑΡΑΚΤΗΡΑ ΣΟΥ', 15, '#fff');
      const look = G.buildLook(this.o);
      // preview big (draw scaled sprite on UI canvas)
      const c = U.ctx; c.imageSmoothingEnabled = false;
      const dir = [0, 2, 3, 1][Math.floor(this.t * 0.8) % 4], fr = [0, 1, 0, 2][Math.floor(this.t * 6) % 4];
      const spr = G.personSpriteHi(look, dir, fr, 14);
      const px = G.W * 0.27; U.box(px - 46, 34, 92, 140, 'rgba(0,0,0,0.5)', '#ffffff55');
      c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(px, 160, 22, 6, 0, 0, 7); c.fill();
      c.imageSmoothingEnabled = true; c.drawImage(spr, px - spr.lw * 2.2, 166 - spr.lh * 4.4, spr.lw * 4.4, spr.lh * 4.4);
      const rows = this.rows(), x = G.W * 0.5, w = G.W * 0.45;
      rows.forEach((r, i) => {
        const y = 38 + i * 22, hot = i === this.row;
        if (r.go) { if (U.button(x, y, w, 18, 'ΞΕΚΙΝΑ ▶', hot, 10)) this.finish(); return; }
        U.box(x, y, w, 18, hot ? 'rgba(255,62,138,0.35)' : 'rgba(0,0,0,0.55)', hot ? '#ff3e8a' : null);
        U.text(x + 6, y + 12, U.clip(r.label, w - 88, 8), 8, '#ffd400');
        if (r.swatch) { c.fillStyle = r.swatch; c.fillRect(x + w - 52, y + 4, 22, 10); c.strokeStyle = '#fff'; c.strokeRect(x + w - 52, y + 4, 22, 10); }
        else U.text(x + w - 41, y + 12, U.clip(r.val, 40, 8), 8, '#fff', 'center');
        if (U.button(x + w - 76, y + 3, 14, 12, '◀', false, 7)) { this.row = i; r.step(-1); }
        if (U.button(x + w - 18, y + 3, 14, 12, '▶', false, 7)) { this.row = i; r.step(1); }
        if (G.clicked(x, y, w - 80, 18)) this.row = i;
      });
      U.text(x, G.H - 10, G.device === 'mobile' ? 'Πάτα τα βελάκια' : '↑↓ επιλογή · ←→ αλλαγή · ENTER', 7, '#ccc');
    },
  };

  // ---------- FULL MAP: zoom (+/− buttons, wheel, pinch, +/- keys), pan (drag, arrows/WASD), quest pins + legend ----------
  const MAP_AREAS = [['ΘΕΣΣΑΛΙΑ', 180, 66], ['ΣΕΡΡΕΣ', 150, 8], ['ΒΟΥΝΟ', 278, 150], ['ΑΙΓΑΙΟ', 190, 250], ['ΜΗΛΟΣ', 172, 162], ['ΚΡΗΤΗ', 62, 270], ['ΛΙΜΑΝΙ', 59, 84]];
  const MAP_DISTRICTS = [['ΣΤΑΘΜΟΣ', 13, 11], ['ΨΥΡΡΗ', 42, 11], ['ΕΞΑΡΧΕΙΑ', 79, 11], ['ΔΗΜ. ΥΠΗΡΕΣΙΕΣ', 13, 35], ['ΣΥΝΤΑΓΜΑ', 42, 35], ['ΑΓΟΡΑ', 79, 35], ['ΚΤΕΛ', 13, 62], ['ΠΑΡΚΟ', 42, 62], ['ΓΗΠΕΔΟ', 79, 62]];
  const VIA_NAME = { train: 'μέσω Σταθμού ΟΣΕ (τρένο)', boat: 'μέσω λιμανιού (πλοίο)', heli: 'μέσω ελικοδρομίου' };
  const stepTitle = s => s.id === 'finale' ? 'Εξόφληση στην Εφορία' : ((G.quests[s.id] || {}).title || s.place || s.id);
  // open the map centred + zoomed on a quest (and the station / port / helipad on the way). Also remembers it as the GPS choice.
  G.showOnMap = function (step) {
    G.MapScene.focusId = step ? step.id : null;
    if (step && G.state) { G.state.gpsFocus = step.id; G.save(); }
    G.push(G.MapScene);
  };
  G.MapScene = {
    z: 0, cx: 0, cy: 0, focusId: null, bound: false,
    enter() {
      this.t = 0; this.drag = null; this.pinch = null; this.selId = this.focusId; this.pulse = this.focusId ? 0 : -1;
      this.bindInput();
      const L = this.layout(), mm = G.World.minimap(), pp = G.player.vehicle || G.player;
      this.zMin = Math.min(L.vw / mm.width, L.vh / mm.height); this.zMax = 9;
      const f = this.focusId && this.pins().find(p => p.id === this.focusId);
      if (f) this.fitOn(f);
      else { if (!this.z) this.z = Math.max(this.zMin, 2.2); this.cx = pp.x / G.TS; this.cy = pp.y / G.TS; }
      this.clampView();
    },
    exit() { this.focusId = null; },
    // centre + zoom so the pin (and, for train/boat/heli quests, the far-away destination) fit in view
    fitOn(f) {
      const L = this.layout(), pts = [[f.tx, f.ty]]; if (f.via) pts.push([f.qx, f.qy]);
      const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      this.cx = (x0 + x1) / 2; this.cy = (y0 + y1) / 2;
      this.z = G.clamp(Math.min(L.vw / (x1 - x0 + 30), L.vh / (y1 - y0 + 30)), this.zMin, 5);
      this.selId = f.id; this.pulse = 0;
    },
    layout() {
      const mob = G.device === 'mobile', head = mob ? 26 : 22;
      const lw = G.W >= 380 ? Math.min(136, Math.round(G.W * 0.27)) : 0;
      const vx = 6, vy = head + 2, vw = G.W - 12 - (lw ? lw + 6 : 0), vh = G.H - vy - 6;
      const bs = mob ? 24 : 18;
      return { mob, head, vx, vy, vw, vh, lx: vx + vw + 6, ly: vy, lw, lh: vh, bs,
        close: { x: G.W - (mob ? 40 : 30) - 4, y: 2, w: mob ? 40 : 30, h: head - 4 },
        zoom: ['+', '−', '⌖'].map((l, i) => ({ l, x: vx + vw - bs - 5, y: vy + vh - (3 - i) * (bs + 4) - 1, w: bs, h: bs })) };
    },
    // quest pins (the world's markers: for train/boat/heli quests the pin is on the station / port, the ring on the destination)
    pins() {
      const WS = G.worldScene, out = [];
      (WS.markers || []).forEach((m, i) => {
        const at = m.step.at ? m.step.at() : null;
        out.push({ id: m.step.id, tx: m.tx, ty: m.ty, col: m.col, main: m.main, title: stepTitle(m.step), sub: m.via ? VIA_NAME[m.via] || m.place : m.step.place, via: m.via, qx: at ? at[0] + 0.5 : m.tx, qy: at ? at[1] + 0.5 : m.ty, n: i + 1 });
      });
      if (this.focusId && !out.some(p => p.id === this.focusId)) { // asked from the phone but not a current marker: still show it
        const s = G.STORY.find(k => k.id === this.focusId), tg = s && WS.stepTarget(s), at = s && s.at();
        if (tg && tg.at && at) out.push({ id: s.id, tx: tg.at[0] + 0.5, ty: tg.at[1] + 0.5, col: '#ffd400', main: true, title: stepTitle(s), sub: tg.via ? VIA_NAME[tg.via] : s.place, via: tg.via, qx: at[0] + 0.5, qy: at[1] + 0.5, n: out.length + 1 });
      }
      return out;
    },
    bindInput() {
      if (this.bound) return; this.bound = true;
      const cv = G.canvas, me = this;
      const gp = (cx, cy) => { const r = cv.getBoundingClientRect(); return { x: (cx - r.left) / r.width * G.W, y: (cy - r.top) / r.height * G.H }; };
      cv.addEventListener('wheel', e => { if (G.top() !== me) return; e.preventDefault(); const p = gp(e.clientX, e.clientY); me.zoomAt(p.x, p.y, Math.exp(-G.clamp(e.deltaY, -120, 120) * 0.004)); }, { passive: false });
      const pinch = e => {
        if (G.top() !== me) return;
        if (e.touches.length >= 2) {
          const a = gp(e.touches[0].clientX, e.touches[0].clientY), b = gp(e.touches[1].clientX, e.touches[1].clientY), d = Math.hypot(a.x - b.x, a.y - b.y);
          if (me.pinch && d > 4) me.zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, d / me.pinch.d);
          me.pinch = { d: Math.max(4, d) }; me.drag = null;
        } else me.pinch = null;
      };
      ['touchstart', 'touchmove', 'touchend', 'touchcancel'].forEach(ev => cv.addEventListener(ev, pinch, { passive: true }));
    },
    zoomAt(sx, sy, k) {
      const L = this.layout(), mx = L.vx + L.vw / 2, my = L.vy + L.vh / 2;
      const wx = this.cx + (sx - mx) / this.z, wy = this.cy + (sy - my) / this.z;
      this.z = G.clamp(this.z * k, this.zMin, this.zMax);
      this.cx = wx - (sx - mx) / this.z; this.cy = wy - (sy - my) / this.z; this.clampView();
    },
    clampView() {
      const L = this.layout(), mm = G.World.minimap(), hw = L.vw / 2 / this.z, hh = L.vh / 2 / this.z;
      this.cx = mm.width <= hw * 2 ? mm.width / 2 : G.clamp(this.cx, hw, mm.width - hw);
      this.cy = mm.height <= hh * 2 ? mm.height / 2 : G.clamp(this.cy, hh, mm.height - hh);
    },
    toScreen(tx, ty, L) { return [L.vx + L.vw / 2 + (tx - this.cx) * this.z, L.vy + L.vh / 2 + (ty - this.cy) * this.z]; },
    update(dt) {
      this.t += dt; if (this.pulse >= 0) this.pulse += dt;
      U.setMobile([], 'none');
      if (G.pressed('map') || G.pressed('back')) { G.pop(); return; }
      const L = this.layout(), sp = 240 * dt / this.z;
      if (G.held('left')) this.cx -= sp; if (G.held('right')) this.cx += sp;
      if (G.held('up')) this.cy -= sp; if (G.held('down')) this.cy += sp;
      const mid = [L.vx + L.vw / 2, L.vy + L.vh / 2];
      if (['Equal', 'NumpadAdd', 'PageUp', 'KeyE'].some(G.keyPressed)) this.zoomAt(mid[0], mid[1], 1.5);
      if (['Minus', 'NumpadSubtract', 'PageDown', 'KeyQ'].some(G.keyPressed)) this.zoomAt(mid[0], mid[1], 1 / 1.5);
      if (G.keyPressed('KeyC') || G.keyPressed('Home')) { const pp = G.player.vehicle || G.player; this.cx = pp.x / G.TS; this.cy = pp.y / G.TS; }
      // drag to pan (mouse or one finger); a tap without moving selects the nearest pin
      const p = G.input.pointer, onBtn = q => [L.close, ...L.zoom].some(b => q.x >= b.x && q.x < b.x + b.w && q.y >= b.y && q.y < b.y + b.h);
      if (p && p.justDown && !this.pinch && p.x >= L.vx && p.x < L.vx + L.vw && p.y >= L.vy && p.y < L.vy + L.vh && !onBtn(p)) this.drag = { x0: p.x, y0: p.y, cx: this.cx, cy: this.cy, moved: 0 };
      if (this.drag && p) {
        if (p.down && !this.pinch) {
          const dx = p.x - this.drag.x0, dy = p.y - this.drag.y0; this.drag.moved = Math.max(this.drag.moved, Math.hypot(dx, dy));
          if (this.drag.moved > 3) { this.cx = this.drag.cx - dx / this.z; this.cy = this.drag.cy - dy / this.z; }
        } else {
          if (this.drag.moved <= 3 && !this.pinch) { // tap
            let best = null, bd = 14; for (const q of this.pins()) { const [sx, sy] = this.toScreen(q.tx, q.ty, L); const d = Math.hypot(sx - this.drag.x0, sy - 8 - this.drag.y0); if (d < bd) { bd = d; best = q; } }
            this.selId = best ? best.id : null; if (best) this.pulse = 0;
          }
          this.drag = null;
        }
      }
      this.clampView();
    },
    render(ctx) {
      G.worldScene.render(ctx, true);
      U.begin(); const c = U.ctx, T = U.T, L = this.layout(), mm = G.World.minimap(), z = this.z;
      c.fillStyle = 'rgba(8,6,16,0.86)'; c.fillRect(0, 0, G.W, G.H);
      // header
      U.title(12, L.head - 7, 'ΧΑΡΤΗΣ', 12, '#fff', 'left');
      const hint = L.mob ? 'σύρε · τσίμπημα για ζουμ' : 'σύρε / βελάκια · ροδέλα ή + − ζουμ · C εσύ · M έξοδος';
      U.text(74, L.head - 8, U.clip(hint, L.close.x - 84, 6.5), 6.5, T.sub, 'left', null);
      if (U.button(L.close.x, L.close.y, L.close.w, L.close.h, '✕', true, L.mob ? 11 : 9)) { G.pop(); return; }
      // map viewport
      U.rr(L.vx - 1, L.vy - 1, L.vw + 2, L.vh + 2, 6, '#2468c4', 'rgba(255,255,255,0.35)');
      c.save(); c.beginPath(); if (c.roundRect) c.roundRect(L.vx, L.vy, L.vw, L.vh, 5); else c.rect(L.vx, L.vy, L.vw, L.vh); c.clip();
      const [ox, oy] = this.toScreen(0, 0, L);
      c.imageSmoothingEnabled = z < 1.5; c.drawImage(mm, ox, oy, mm.width * z, mm.height * z); c.imageSmoothingEnabled = false;
      const used = []; // label boxes already on screen (no overlaps)
      const free = (x, y, w, h) => x >= L.vx + 2 && y >= L.vy + 2 && x + w <= L.vx + L.vw - 2 && y + h <= L.vy + L.vh - 2 && !used.some(r => x < r.x + r.w && x + w > r.x && y < r.y + r.h && y + h > r.y);
      const label = (s, x, y, size, col, align = 'center', force = false) => {
        const w = U.measure(s, size) + 4, h = size * 1.25, lx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x, ly = y - h + 2;
        if (!force && !free(lx, ly, w, h)) return false;
        used.push({ x: lx, y: ly, w, h }); U.text(align === 'center' ? x : align === 'right' ? x - 2 : x + 2, y, s, size, col, align, '#000'); return true;
      };
      const pins = this.pins(), pp = G.player.vehicle || G.player, [px, py] = this.toScreen(pp.x / G.TS, pp.y / G.TS, L);
      const inV = (x, y, m = 0) => x >= L.vx + m && x <= L.vx + L.vw - m && y >= L.vy + m && y <= L.vy + L.vh - m;
      // zoom buttons + legend/close are reserved space for labels
      L.zoom.forEach(b => used.push({ x: b.x - 2, y: b.y - 2, w: b.w + 4, h: b.h + 4 }));
      // routes: station / port / helipad → real destination (dashed), destination ring
      for (const q of pins) if (q.via) {
        const [a, b] = this.toScreen(q.tx, q.ty, L), [d, e] = this.toScreen(q.qx, q.qy, L);
        c.save(); c.setLineDash([4, 3]); c.strokeStyle = q.col; c.globalAlpha = q.id === this.selId ? 0.95 : 0.55; c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(a, b); c.lineTo(d, e); c.stroke(); c.restore();
        c.strokeStyle = '#000'; c.lineWidth = 3; c.beginPath(); c.arc(d, e, 5, 0, 7); c.stroke(); c.strokeStyle = q.col; c.lineWidth = 2; c.beginPath(); c.arc(d, e, 5, 0, 7); c.stroke();
        used.push({ x: d - 6, y: e - 6, w: 12, h: 12 });
      }
      // pulsing highlight on the selected / asked-for quest
      const sel = pins.find(q => q.id === this.selId);
      if (sel && this.pulse >= 0) {
        const pts = [this.toScreen(sel.tx, sel.ty, L)]; if (sel.via) pts.push(this.toScreen(sel.qx, sel.qy, L));
        for (const [x, y] of pts) for (let k = 0; k < 2; k++) {
          const ph = ((this.t * 1.2) + k * 0.5) % 1; c.globalAlpha = (1 - ph) * 0.9; c.strokeStyle = sel.col; c.lineWidth = 2;
          c.beginPath(); c.arc(x, y - 4, 6 + ph * 22, 0, 7); c.stroke();
        }
        c.globalAlpha = 1;
      }
      // pins (teardrop with a number); off-view pins sit on the edge as arrows
      const pinPos = [];
      for (const q of pins) {
        const [x, y] = this.toScreen(q.tx, q.ty, L);
        if (!inV(x, y, 8)) {
          const ex = G.clamp(x, L.vx + 8, L.vx + L.vw - 8), ey = G.clamp(y, L.vy + 8, L.vy + L.vh - 8), a = Math.atan2(y - ey, x - ex);
          c.save(); c.translate(ex, ey); c.rotate(a); c.fillStyle = q.col; c.strokeStyle = '#000'; c.lineWidth = 1.2;
          c.beginPath(); c.moveTo(7, 0); c.lineTo(-4, -5); c.lineTo(-4, 5); c.closePath(); c.fill(); c.stroke(); c.restore();
          continue;
        }
        const big = q.id === this.selId ? 1.25 : 1;
        c.save(); c.translate(x, y); c.scale(big, big);
        c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.ellipse(0, 0, 3, 1.3, 0, 0, 7); c.fill();
        c.fillStyle = q.col; c.strokeStyle = '#000'; c.lineWidth = 1.2;
        c.beginPath(); c.arc(0, -10, 6, Math.PI * 0.8, Math.PI * 2.2); c.lineTo(0, 0); c.closePath(); c.fill(); c.stroke();
        c.restore();
        U.text(x, y - 10 * big + 2.5, q.main ? String(q.n) : '?', 6.5 * big, '#111', 'center', null);
        used.push({ x: x - 7 * big, y: y - 17 * big, w: 14 * big, h: 17 * big }); pinPos.push([q, x, y]);
      }
      // permanent places (small diamonds)
      for (const pl of G.worldScene.places || []) {
        const [x, y] = this.toScreen(pl.tx, pl.ty, L); if (!inV(x, y)) continue;
        c.save(); c.translate(x, y); c.rotate(Math.PI / 4); c.fillStyle = pl.col || '#ff3e8a'; c.strokeStyle = '#000'; c.lineWidth = 1; c.fillRect(-3, -3, 6, 6); c.strokeRect(-3, -3, 6, 6); c.restore();
        used.push({ x: x - 4, y: y - 4, w: 8, h: 8 });
      }
      // player
      if (inV(px, py, 4)) {
        const ph = (this.t * 1.5) % 1; c.globalAlpha = 1 - ph; c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.beginPath(); c.arc(px, py, 4 + ph * 9, 0, 7); c.stroke(); c.globalAlpha = 1;
        c.save(); c.translate(px, py); c.rotate(pp.a != null && G.player.vehicle ? pp.a + Math.PI / 2 : [Math.PI, -Math.PI / 2, Math.PI / 2, 0][pp.dir] || 0);
        c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(0, -6); c.lineTo(4.5, 4.5); c.lineTo(0, 2.5); c.lineTo(-4.5, 4.5); c.closePath(); c.fill(); c.stroke(); c.restore();
        used.push({ x: px - 6, y: py - 6, w: 12, h: 12 });
      } else {
        const ex = G.clamp(px, L.vx + 8, L.vx + L.vw - 8), ey = G.clamp(py, L.vy + 8, L.vy + L.vh - 8);
        c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineWidth = 1.2; c.beginPath(); c.arc(ex, ey, 4, 0, 7); c.fill(); c.stroke();
      }
      // callout for the selected quest (always shown, on top)
      if (sel) {
        const [x, y] = this.toScreen(sel.tx, sel.ty, L), t1 = U.clip(sel.title, 150, 8), t2 = sel.sub ? U.clip(sel.sub, 150, 6.5) : '';
        const w = Math.max(U.measure(t1, 8), t2 ? U.measure(t2, 6.5) : 0) + 14, h = t2 ? 25 : 16;
        const bx = G.clamp(x - w / 2, L.vx + 4, L.vx + L.vw - w - 4), by = G.clamp(y - 22 - h, L.vy + 4, L.vy + L.vh - h - 4);
        U.box(bx, by, w, h, T.panel, T.line, sel.col); U.text(bx + 8, by + 11, t1, 8, '#fff', 'left', null); if (t2) U.text(bx + 8, by + 20, t2, 6.5, T.sub, 'left', null);
        used.push({ x: bx, y: by, w, h });
      }
      // pin labels (short titles) where there is room: right, left, then below
      for (const [q, x, y] of pinPos) {
        if (q === sel) continue;
        const s = U.clip(q.title, 90, 7);
        label(s, x + 8, y - 6, 7, '#fff', 'left') || label(s, x - 8, y - 6, 7, '#fff', 'right') || label(s, x, y + 10, 7, '#fff', 'center');
      }
      if (inV(px, py)) label('ΕΣΥ', px, py + 14, 7, '#fff', 'center');
      // area names, then (zoomed in) the town's districts
      for (const [lab, x, y] of MAP_AREAS) { const [sx, sy] = this.toScreen(x, y, L); label(lab, sx, sy + 3, 8, 'rgba(255,255,255,0.92)', 'center'); }
      if (z < 2.6) { const [sx, sy] = this.toScreen(50, 40, L); label('ΑΘΗΝΑ', sx, sy + 3, 9, '#fff', 'center'); }
      else for (const [lab, x, y] of MAP_DISTRICTS) { const [sx, sy] = this.toScreen(x, y, L); label(lab, sx, sy + 3, 7, 'rgba(255,255,255,0.85)', 'center'); }
      for (const pl of G.worldScene.places || []) if (pl.label && z >= 2) { const [sx, sy] = this.toScreen(pl.tx, pl.ty, L); label(pl.label, sx + 6, sy + 3, 6.5, '#ffb3d0', 'left'); }
      c.restore();
      // zoom buttons
      L.zoom.forEach(b => { if (U.button(b.x, b.y, b.w, b.h, b.l, false, L.mob ? 11 : 9)) {
        G.audio.sfx('blip'); const mx = L.vx + L.vw / 2, my = L.vy + L.vh / 2;
        if (b.l === '+') this.zoomAt(mx, my, 1.6); else if (b.l === '−') this.zoomAt(mx, my, 1 / 1.6);
        else { this.cx = pp.x / G.TS; this.cy = pp.y / G.TS; this.clampView(); }
      } });
      // legend: the quests you can do now (tap = show it) + you
      if (L.lw) {
        U.box(L.lx, L.ly, L.lw, L.lh, T.panel, T.line);
        U.text(L.lx + 8, L.ly + 12, 'ΑΠΟΣΤΟΛΕΣ ΤΩΡΑ', 7, T.gold, 'left', null);
        const rowH = L.mob ? 26 : 24; let ry = L.ly + 18;
        for (const q of pins) {
          if (ry + rowH > L.ly + L.lh - rowH - 4) break;
          const hot = q.id === this.selId;
          if (hot) U.rr(L.lx + 3, ry, L.lw - 6, rowH - 2, 4, 'rgba(255,255,255,0.1)');
          c.fillStyle = q.col; c.strokeStyle = '#000'; c.lineWidth = 1; c.beginPath(); c.arc(L.lx + 12, ry + 8, 5, 0, 7); c.fill(); c.stroke();
          U.text(L.lx + 12, ry + 10.5, q.main ? String(q.n) : '?', 6, '#111', 'center', null);
          U.text(L.lx + 21, ry + 10, U.clip(q.title, L.lw - 26, 7), 7, '#fff', 'left', null);
          U.text(L.lx + 21, ry + 19, U.clip(q.sub || '', L.lw - 26, 6), 6, T.sub, 'left', null);
          if (G.clicked(L.lx, ry, L.lw, rowH - 2)) { G.audio.sfx('blip'); this.fitOn(q); this.clampView(); }
          ry += rowH;
        }
        const yy = L.ly + L.lh - rowH;
        c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineWidth = 1; c.beginPath(); c.arc(L.lx + 12, yy + 10, 4, 0, 7); c.fill(); c.stroke();
        U.text(L.lx + 21, yy + 13, U.clip('Εσύ · ' + (G.worldScene.zoneLabel || ''), L.lw - 26, 7), 7, '#fff', 'left', null);
        if (G.clicked(L.lx, yy, L.lw, rowH)) { this.cx = pp.x / G.TS; this.cy = pp.y / G.TS; this.clampView(); }
      }
      U.drawOverlays();
    },
  };

  // ---------- PAUSE ----------
  G.PauseScene = {
    enter() { this.sel = 0; },
    items() { return [['ΣΥΝΕΧΕΙΑ', () => G.pop()], ['ΗΧΟΣ: ' + (G.audio.muted ? 'ΟΧΙ' : 'ΝΑΙ'), () => { G.audio.muted = !G.audio.muted; if (G.audio.muted) G.audio.radio(false); }], ['ΑΛΛΑΓΗ ΡΟΥΧΩΝ', () => { const k = Object.keys(G.OUTFITS); const o = G.state.creator; o.outfit = k[(k.indexOf(o.outfit) + 1) % k.length]; G.state.look = G.buildLook(o); G.player.look = G.state.look; G.save(); }], ['ΣΥΣΚΕΥΗ: ' + (G.device === 'pc' ? 'PC' : 'ΚΙΝΗΤΟ'), () => { G.device = G.device === 'pc' ? 'mobile' : 'pc'; }], ['ΝΕΟ ΠΑΙΧΝΙΔΙ', () => { G.wipe(); location.reload(); }]]; },
    update() {
      U.setMobile([{ id: 'ok', label: 'OK' }, { id: 'down', label: '▼' }, { id: 'up', label: '▲' }], 'none');
      const it = this.items();
      if (G.pressed('up')) this.sel = (this.sel + it.length - 1) % it.length;
      if (G.pressed('down')) this.sel = (this.sel + 1) % it.length;
      if (G.pressed('ok')) it[this.sel][1]();
      else if (G.pressed('pause') || G.pressed('back')) G.pop();
    },
    render(ctx) {
      G.worldScene.render(ctx, true); U.begin(); U.ctx.fillStyle = 'rgba(0,0,0,0.6)'; U.ctx.fillRect(0, 0, G.W, G.H);
      U.title(G.W / 2, 40, 'ΠΑΥΣΗ', 22, '#fff');
      this.items().forEach(([l, f], i) => { if (U.button(G.W / 2 - 70, 56 + i * 22, 140, 18, l, i === this.sel)) { this.sel = i; f(); } });
      U.text(G.W / 2, G.H - 10, `Αποστολές ${Object.keys(G.state.done).filter(k => G.quests[k]).length}/${Object.keys(G.quests).length}`, 8, '#ffd400', 'center');
    },
  };

  // ---------- TRAVEL CARD (train / heli / car transitions) ----------
  // G.travel({icon:'train'|'heli'|'car'|'bike', from, to, dur}, then)
  G.travel = function (o, then) {
    G.push({
      enter() { this.t = 0; G.audio.sfx('whoosh'); },
      update(dt) { this.t += dt; U.setMobile([], 'none'); if (this.t > (o.dur || 3) || (this.t > 0.8 && G.pressed('ok'))) { G.pop(); then && then(); } },
      render(ctx) {
        const t = this.t;
        ctx.fillStyle = o.icon === 'heli' ? '#5bb8e8' : '#8fc7e8'; ctx.fillRect(0, 0, G.W, G.H);
        if (o.icon === 'heli') { // sea + islands scrolling
          ctx.fillStyle = '#2a7fc0'; ctx.fillRect(0, G.H * 0.45, G.W, G.H);
          for (let i = 0; i < 6; i++) { const x = ((i * 97 - t * 60) % (G.W + 80) + G.W + 80) % (G.W + 80) - 40; ctx.fillStyle = '#d9c48a'; ctx.beginPath(); ctx.ellipse(x, G.H * 0.6 + (i % 3) * 25, 22, 7, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#f4f4f4'; ctx.fillRect(x - 6, G.H * 0.6 + (i % 3) * 25 - 7, 4, 3); }
          G.drawVehicle(ctx, 'heli', '#e8e8e8', G.W / 2 + Math.sin(t * 2) * 10, G.H * 0.35, 0);
        } else {
          ctx.fillStyle = '#c9b48a'; ctx.fillRect(0, G.H * 0.55, G.W, G.H); // fields
          for (let i = 0; i < 12; i++) { const x = ((i * 53 - t * 140) % (G.W + 40) + G.W + 40) % (G.W + 40) - 20; ctx.fillStyle = '#4b7a3a'; ctx.beginPath(); ctx.arc(x, G.H * 0.56 + (i % 3) * 14, 6, 0, 7); ctx.fill(); }
          ctx.fillStyle = '#555'; ctx.fillRect(0, G.H * 0.5, G.W, 4); ctx.fillStyle = '#7a5a3a'; for (let x = -((t * 140) % 10); x < G.W; x += 10) ctx.fillRect(x, G.H * 0.5 + 4, 3, 2);
          if (o.icon === 'train') { // OSE-ish train
            for (let k = 0; k < 4; k++) { const x = G.W / 2 - 80 + k * 42; ctx.fillStyle = '#e8e8e8'; ctx.fillRect(x, G.H * 0.5 - 22, 40, 22); ctx.fillStyle = '#2d6bff'; ctx.fillRect(x, G.H * 0.5 - 8, 40, 3); ctx.fillStyle = '#5d7aa8'; for (let w = 0; w < 4; w++) ctx.fillRect(x + 4 + w * 9, G.H * 0.5 - 18, 6, 6); }
            ctx.fillStyle = '#fff'; ctx.font = G.ui.fpx(7); ctx.fillText('+90 λεπτά καθυστέρηση', G.W / 2 - 40, G.H * 0.5 - 26);
          } else G.drawVehicle(ctx, o.icon === 'bike' ? 'bike' : 'tincan', '#f4f4f4', G.W / 2, G.H * 0.5, 0);
        }
        U.begin(); { const tt = (o.to || '').toUpperCase(); U.title(G.W / 2, 30, tt, U.fitSize(tt, G.W - 30, 18, 10, 850), '#fff'); }
        if (o.from) U.text(G.W / 2, 44, U.clip(o.from + ' → ' + o.to, G.W - 30, 8), 8, '#fff', 'center');
        if (o.sub) U.wrapN(o.sub, G.W - 40, 8, 2).forEach((l, k, a) => U.text(G.W / 2, G.H - 14 - (a.length - 1 - k) * 10, l, 8, '#ffd400', 'center'));
      },
    });
  };
})();
