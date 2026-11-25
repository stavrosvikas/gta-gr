// GTA LUBEN — the in-game smartphone: Messages, Quests, ΑΑΔΕ (debt), Map, Settings
'use strict';
(function () {
  const U = G.ui;
  let PW = 150, PH = 252; // phone size in game px (the LUBEN browser turns it sideways: wider)
  const LUBEN_URL = 'https://luben.tv/';
  const LUBEN_LOGO = new Image(); LUBEN_LOGO.src = 'assets/logo/luben.svg?v=1'; // the real logo from luben.tv
  const lubenLogo = (c, cx, cy, w) => { if (!LUBEN_LOGO.complete || !LUBEN_LOGO.naturalWidth) return false; const h = w * 55 / 149; c.drawImage(LUBEN_LOGO, cx - w / 2, cy - h / 2, w, h); return true; };
  const HEAD_Y = 18, HEAD_H = 24; // app header sits under the status bar / notch

  // messages log lives in the save
  G.sms = function (text, from = 'Άγνωστος αριθμός') {
    const st = G.state; st.sms = st.sms || [];
    if (st.sms.some(m => m.text === text)) return;
    st.sms.push({ from, text, time: clock(), read: false }); G.save();
  };
  function clock() { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  G.unreadSms = () => (G.state.sms || []).filter(m => !m.read).length;

  const APPS = [
    { id: 'quests', label: 'Αποστολές', icon: '★', col: '#ffb000' },
    { id: 'sms', label: 'Μηνύματα', icon: '✉', col: '#34c759' },
    { id: 'aade', label: 'myAADE', icon: '€', col: '#1f5fbf' },
    { id: 'map', label: 'Χάρτης', icon: '⌖', col: '#ff3b30' },
    { id: 'radio', label: 'Ράδιο', icon: '♪', col: '#af52de' },
    { id: 'settings', label: 'Ρυθμίσεις', icon: '⚙', col: '#8e8e93' },
    { id: 'luben', label: 'LUBEN', icon: 'L', col: '#000000' },
  ];

  G.PhoneScene = function (startApp) {
    const P = {
      app: startApp || 'home', sel: 0, scroll: 0, t: 0, detail: null,
      enter() { this.t = 0; G.audio.sfx('blip'); if (this.app === 'sms') markRead(); },
      exit() { U.web.close(); },
      update(dt) {
        this.t += dt;
        if (this.app === 'luben') { // the web page owns the screen: no game buttons on top of it, only Esc / header buttons
          U.setMobile([], 'none');
          if (G.pressed('back')) this.back();
          return;
        }
        U.setMobile([{ id: 'ok', label: 'OK' }, { id: 'up', label: '▲' }, { id: 'down', label: '▼' }, { id: 'back', label: 'ΠΙΣΩ', pos: [G.W - 22, 22] }], 'none');
        if (U.hasDialog()) return;
        const n = this.count();
        if (this.app === 'home') {
          if (G.pressed('left')) this.sel = (this.sel + n - 1) % n;
          if (G.pressed('right')) this.sel = (this.sel + 1) % n;
          if (G.pressed('up')) this.sel = (this.sel + n - 3) % n;
          if (G.pressed('down')) this.sel = (this.sel + 3) % n;
        } else if (n) {
          if (G.pressed('up')) this.sel = (this.sel + n - 1) % n;
          if (G.pressed('down')) this.sel = (this.sel + 1) % n;
        }
        if (G.pressed('ok') || G.pressed('enter')) this.activate(this.sel);
        if (G.pressed('back') || G.pressed('phone')) this.back();
      },
      back() {
        G.audio.sfx('blip');
        if (this.detail) { this.detail = null; return; }
        if (this.app === 'home') { G.pop(); return; }
        if (this.app === 'luben') U.web.close();
        this.sel = Math.max(0, APPS.findIndex(a => a.id === this.app)); this.app = 'home';
      },
      count() {
        if (this.app === 'home') return APPS.length;
        if (this.app === 'quests') return questRows().length;
        if (this.app === 'sms') return (G.state.sms || []).length;
        if (this.app === 'settings') return settingsRows().length;
        return 0;
      },
      activate(i) {
        G.audio.sfx('blip');
        if (this.app === 'home') {
          const a = APPS[i];
          if (a.id === 'map') { G.pop(); G.push(G.MapScene); return; }
          if (a.id === 'radio') { const st = G.state; st.radioOn = !st.radioOn; G.audio.radio(st.radioOn && !!(G.player && G.player.vehicle)); return; }
          this.app = a.id; this.sel = a.id === 'quests' ? Math.max(0, questRows().findIndex(r => r.state === 'current')) : a.id === 'sms' ? 0 : 0;
          if (a.id === 'sms') markRead();
          if (a.id === 'luben') { this.webT = 0; U.web.open(LUBEN_URL); }
          return;
        }
        if (this.app === 'quests') {
          const r = questRows()[i]; if (!r) return;
          if (r.state === 'locked') { U.toast('Κλειδωμένη. Τελείωσε πρώτα τις προηγούμενες.', 2); return; }
          if (r.state === 'current') {
            U.dialog(r.title, r.desc, [
              { label: '⌖ Δείξε μου πού είναι', cb: () => { const s = G.STORY.find(k => k.id === r.id); G.pop(); G.showOnMap ? G.showOnMap(s) : G.push(G.MapScene); } },
              { label: 'Πίσω', cb: () => {} },
            ]);
          } else if (r.state === 'done' && r.id !== 'finale') {
            U.dialog(r.title, 'Την έχεις κάνει. Θες να την ξαναπαίξεις; (μισή αμοιβή, για το χαβαλέ)', [
              { label: '▶ Ξαναπαίξε τώρα', cb: () => { G.pop(); G.replayQuest(r.id); } },
              { label: 'Πίσω', cb: () => {} },
            ]);
          }
          return;
        }
        if (this.app === 'sms') { const m = (G.state.sms || []).slice().reverse()[i]; if (m) this.detail = m; return; }
        if (this.app === 'settings') { settingsRows()[i].cb(); return; }
      },
      render(ctx) {
        G.worldScene.render(ctx, true);
        U.begin(); const c = U.ctx;
        c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(0, 0, G.W, G.H);
        const slide = Math.max(0, 1 - this.t * 5);
        const web = this.app === 'luben';
        PH = G.H - 14; PW = Math.round(PH * 0.48); // one phone size everywhere (real phone proportions) // stays a phone (portrait), just a bit taller
        const x = Math.round(G.W / 2 - PW / 2), y = Math.round((G.H - PH) / 2 + slide * 200);
        drawPhone(c, x, y, this);
        U.drawOverlays(); U.drawMobile();
      },
    };
    return P;
  };

  function markRead() { (G.state.sms || []).forEach(m => m.read = true); G.save(); }

  function questRows() {
    const st = G.state; const avail = G.worldScene.availSteps();
    let reached = true;
    return G.STORY.map((s, i) => {
      const q = G.quests[s.id];
      const done = !!st.done[s.id];
      let state = done ? 'done' : (avail.includes(s) ? 'current' : 'locked');
      const title = s.id === 'finale' ? 'Εξόφληση στην Εφορία' : (q ? q.title : s.id);
      const reward = s.id === 'finale' ? -G.DEBT : (q && q.reward) || 300;
      return { id: s.id, i, title, state, reward, desc: s.sms + '\n\n★ Πού: ' + s.place };
    });
  }
  function settingsRows() {
    return [
      { label: 'Ήχος', val: G.audio.muted ? 'ΟΧΙ' : 'ΝΑΙ', cb: () => { G.audio.muted = !G.audio.muted; if (G.audio.muted) G.audio.radio(false); } },
      { label: 'Ρούχα', val: (G.OUTFITS[G.state.creator && G.state.creator.outfit] || {}).label || '-', cb: () => { const k = Object.keys(G.OUTFITS); const o = G.state.creator; o.outfit = k[(k.indexOf(o.outfit) + 1) % k.length]; G.state.look = G.buildLook(o); G.player.look = G.state.look; G.save(); } },
      { label: 'Χειρισμός', val: G.device === 'pc' ? 'PC' : 'ΚΙΝΗΤΟ', cb: () => { G.device = G.device === 'pc' ? 'mobile' : 'pc'; } },
      { label: 'Νέο παιχνίδι', val: '⟲', cb: () => U.dialog('ΣΙΓΟΥΡΑ;', 'Σβήνεται όλη η πρόοδος.', [{ label: 'Ναι, από την αρχή', cb: () => { G.wipe(); location.reload(); } }, { label: 'Όχι', cb: () => {} }]) },
    ];
  }

  // ---------- drawing ----------
  function rr(c, x, y, w, h, r, fill) { c.fillStyle = fill; c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); c.fill(); }
  function drawPhone(c, x, y, P) {
    // body
    rr(c, x - 4, y - 4, PW + 8, PH + 8, 20, '#0c0c10');
    rr(c, x - 3, y - 3, PW + 6, PH + 6, 19, '#2a2a33');
    // screen
    c.save(); c.beginPath(); if (c.roundRect) c.roundRect(x, y, PW, PH, 16); else c.rect(x, y, PW, PH); c.clip();
    const g = c.createLinearGradient(x, y, x + PW, y + PH); g.addColorStop(0, '#ff3e8a'); g.addColorStop(0.55, '#6b2fd6'); g.addColorStop(1, '#14143a');
    c.fillStyle = g; c.fillRect(x, y, PW, PH);
    // status bar (texts stay left/right of the notch)
    U.text(x + 12, y + 11, clock(), 7, '#fff', 'left', null);
    U.text(x + PW - 12, y + 11, '5G ▮▮▮ 87%', 6, '#fff', 'right', null);
    rr(c, x + PW / 2 - 18, y + 4, 36, 9, 5, '#000'); // notch
    if (P.app === 'home') drawHome(c, x, y, P);
    else if (P.app === 'luben') drawLuben(c, x, y, P);
    else {
      // app header: its own bar under the status bar, title clipped between the back arrow and the right edge
      const a = APPS.find(a => a.id === P.app), hy = y + HEAD_Y;
      rr(c, x, hy, PW, HEAD_H, 0, 'rgba(0,0,0,0.35)');
      U.text(x + 10, hy + 16, '‹', 12, '#fff', 'left', null);
      if (G.clicked(x, hy, 34, HEAD_H)) P.back();
      const lab = a ? a.label : '';
      U.text(x + PW / 2, hy + 16, U.clip(lab, PW - 64, 9), 9, '#fff', 'center', null);
      const body = { x: x + 6, y: hy + HEAD_H + 4, w: PW - 12, h: PH - HEAD_Y - HEAD_H - 16 };
      rr(c, body.x, body.y, body.w, body.h, 8, 'rgba(255,255,255,0.94)');
      c.save(); c.beginPath(); c.rect(body.x, body.y, body.w, body.h); c.clip();
      if (P.app === 'quests') drawQuests(c, body, P);
      if (P.app === 'sms') drawSms(c, body, P);
      if (P.app === 'aade') drawAade(c, body);
      if (P.app === 'settings') drawSettings(c, body, P);
      c.restore();
    }
    // home indicator
    rr(c, x + PW / 2 - 22, y + PH - 6, 44, 3, 2, 'rgba(255,255,255,0.7)');
    c.restore();
  }

  function drawHome(c, x, y, P) {
    // widget: current objective
    // widget: the jobs you can do now, one per line (max 3), + progress
    const COLS = ['#ffd400', '#3ee0ff', '#ff5fa2', '#9dff5a'];
    const av = G.worldScene.availSteps().map(s => s.id === 'finale' ? 'Εξόφληση στην Εφορία' : ((G.quests[s.id] || {}).title || s.id));
    const shown = av.length > 3 ? av.slice(0, 2) : av, more = av.length - shown.length;
    const n = shown.length + (more ? 1 : 0), wy = y + 20, wh = 30 + n * 9;
    rr(c, x + 8, wy, PW - 16, wh, 10, 'rgba(255,255,255,0.18)');
    U.text(x + 15, wy + 10, 'ΤΩΡΑ', 6.5, '#ffd400', 'left', null);
    shown.forEach((t, i) => {
      const ly = wy + 19 + i * 9; c.fillStyle = COLS[i % 4]; c.beginPath(); c.arc(x + 17, ly - 2.5, 2, 0, 7); c.fill();
      U.text(x + 22, ly, U.clip(t, PW - 40, 7), 7, '#fff', 'left', null);
    });
    if (more) U.text(x + 22, wy + 19 + shown.length * 9, '+ ' + more + ' ακόμα στις Αποστολές', 6.5, 'rgba(255,255,255,0.75)', 'left', null);
    const done = G.STORY.filter(s => G.state.done[s.id]).length, by = wy + wh - 11;
    rr(c, x + 15, by - 5, 34, 4, 2, 'rgba(0,0,0,0.35)'); rr(c, x + 15, by - 5, 34 * done / G.STORY.length, 4, 2, '#4cd964');
    U.text(x + 53, by - 1, U.clip(`${done}/${G.STORY.length} · χρέος ${G.fmtMoney(Math.max(0, G.DEBT - (G.state.done.finale ? G.DEBT : 0)))}`, PW - 76, 6), 6, '#fff', 'left', null);
    // app grid: 3 columns
    const gx = x + 14, gy = wy + wh + 10, cell = (PW - 28) / 3, rowH = 46;
    APPS.forEach((a, i) => {
      const ax = gx + (i % 3) * cell + cell / 2, ay = gy + Math.floor(i / 3) * rowH;
      const hot = P.sel === i;
      if (hot) rr(c, ax - 20, ay - 4, 40, rowH - 2, 9, 'rgba(255,255,255,0.22)');
      if (a.id === 'luben') { rr(c, ax - 14, ay, 28, 28, 8, '#000'); if (!lubenLogo(c, ax, ay + 14, 25)) U.title(ax + 1, ay + 21, 'L', 15, '#ff3e8a', 'center'); }
      else { rr(c, ax - 14, ay, 28, 28, 8, a.col); U.text(ax, ay + 20, a.icon, 14, '#fff', 'center', null); }
      U.text(ax, ay + 37, U.clip(a.label, cell + 4, 6.5), 6.5, '#fff', 'center', null);
      if (a.id === 'sms' && G.unreadSms()) { c.fillStyle = '#ff3b30'; c.beginPath(); c.arc(ax + 13, ay + 1, 6, 0, 7); c.fill(); U.text(ax + 13, ay + 4, String(G.unreadSms()), 7, '#fff', 'center', null); }
      if (a.id === 'radio') U.text(ax + 12, ay + 27, G.state.radioOn ? 'ON' : 'OFF', 6, '#fff', 'center', null);
      if (G.clicked(ax - 20, ay - 4, 40, rowH - 2)) { P.sel = i; P.activate(i); }
    });
    U.text(x + PW / 2, y + PH - 12, G.device === 'mobile' ? '' : 'βελάκια · ENTER · ESC', 6, 'rgba(255,255,255,0.7)', 'center', null);
  }

  // LUBEN app: header drawn on the canvas, the page itself is a sandboxed <iframe> (no scripts → no ads) laid over the body rect
  function drawLuben(c, x, y, P) {
    const hy = y + HEAD_Y, W = U.web;
    rr(c, x, hy, PW, HEAD_H, 0, '#000');
    c.fillStyle = '#ff3e8a'; c.fillRect(x, hy + HEAD_H - 2, PW, 2);
    const btn = (bx, label, size = 11) => { U.rr(bx + 2, hy + 3, 22, HEAD_H - 6, 5, 'rgba(255,255,255,0.1)'); U.text(bx + 13, hy + 16, label, size, '#fff', 'center', null); return G.clicked(bx, hy, 26, HEAD_H); };
    // ‹ back inside the site (or out of the app on its first page) · ⌂ luben.tv home · ✕ close the phone
    if (btn(x + 4, '‹', 13)) { G.audio.sfx('blip'); if (!W.goBack()) P.back(); }
    if (btn(x + PW - 30, '✕', 10)) { G.audio.sfx('blip'); W.close(); G.pop(); return; }
    const lw = Math.min(64, PW - 70); // the logo is also the home button
    if (!lubenLogo(c, x + PW / 2, hy + HEAD_H / 2 - 1, lw)) U.title(x + PW / 2, hy + 17, 'LUBEN', 11, '#ff3e8a', 'center');
    if (G.clicked(x + PW / 2 - lw / 2, hy, lw, HEAD_H)) { G.audio.sfx('blip'); W.home(); }
    // (ads can't be stripped from inside the game page; pop-ups and redirects are blocked by the sandbox)
    const body = { x: x + 2, y: hy + HEAD_H, w: PW - 4, h: PH - HEAD_Y - HEAD_H - 10 };
    // under the iframe: loading state (visible until the page has loaded)
    rr(c, body.x, body.y, body.w, body.h, 0, '#0b0812');
    if (!W.loaded) {
      const cx = body.x + body.w / 2, cy = body.y + body.h / 2 - 8, a = G.t * 6;
      c.strokeStyle = 'rgba(255,255,255,0.15)'; c.lineWidth = 3; c.beginPath(); c.arc(cx, cy, 10, 0, 7); c.stroke();
      c.strokeStyle = '#ff3e8a'; c.beginPath(); c.arc(cx, cy, 10, a, a + 1.6); c.stroke();
      U.text(cx, cy + 26, 'Φόρτωση luben.tv…', 8, '#fff', 'center', null);
      if (W.el && G.t - (W.t0 || 0) > 12) U.text(cx, cy + 38, U.clip('Αργεί; Πάτα ⌂ για ξανά ή ✕ για έξοδο.', body.w - 20, 7), 7, T_SUB, 'center', null);
    }
    if (!W.el && P.app === 'luben') W.open(LUBEN_URL);
    W.place(body); // every frame: follows the slide-in, resizes, and keeps the iframe alive (U.begin drops it when nobody places it)
  }
  const T_SUB = '#b9b4c8';

  // lists scroll with the arrows (selection), by dragging with the finger/mouse, or with the mouse wheel; a tap (no drag) opens a row
  function listScroll(P, rowH, body, n) {
    const visible = Math.max(1, Math.floor(body.h / rowH)), maxS = Math.max(0, n - visible), p = G.input.pointer;
    P.tap = null;
    if (p && p.justDown && p.x >= body.x && p.x < body.x + body.w && p.y >= body.y && p.y < body.y + body.h) P.drag = { y0: p.y, s0: P.scroll || 0, moved: false };
    if (P.drag && p) {
      const dy = p.y - P.drag.y0;
      if (Math.abs(dy) > 5) P.drag.moved = true;
      if (P.drag.moved) { P.scroll = G.clamp(Math.round(P.drag.s0 - dy / rowH), 0, maxS); P.sel = G.clamp(P.sel, P.scroll, P.scroll + visible - 1); }
      if (!p.down) { if (!P.drag.moved) P.tap = { x: p.x, y: p.y }; P.drag = null; }
    }
    if (G.wheel) { P.scroll = G.clamp((P.scroll || 0) + Math.sign(G.wheel), 0, maxS); P.sel = G.clamp(P.sel, P.scroll, P.scroll + visible - 1); G.wheel = 0; }
    if (!P.drag) { if (P.sel < P.scroll) P.scroll = P.sel; if (P.sel >= P.scroll + visible) P.scroll = P.sel - visible + 1; }
    P.scroll = G.clamp(P.scroll || 0, 0, maxS);
    return P.scroll;
  }
  const rowTap = (P, x, y, w, h) => !!(P.tap && P.tap.x >= x && P.tap.x < x + w && P.tap.y >= y && P.tap.y < y + h);
  function drawQuests(c, b, P) {
    const rows = questRows(), rowH = 26, sc = listScroll(P, rowH, b, rows.length);
    rows.forEach((r, i) => {
      const y = b.y + (i - sc) * rowH; if (y < b.y - rowH || y > b.y + b.h) return;
      const hot = P.sel === i;
      if (hot) rr(c, b.x + 2, y + 2, b.w - 4, rowH - 3, 6, '#ffe9a8');
      const ic = r.state === 'done' ? ['✓', '#34c759'] : r.state === 'current' ? ['★', '#ff9500'] : ['🔒', '#aaa'];
      rr(c, b.x + 5, y + 5, 17, 17, 5, ic[1]); U.text(b.x + 13.5, y + 17, ic[0], r.state === 'locked' ? 8 : 10, '#fff', 'center', null);
      const rw = r.state !== 'locked' && r.id !== 'finale' ? '+' + G.fmtMoney(r.reward) : '', rwW = rw ? U.measure(rw, 6.5) + 6 : 0;
      U.text(b.x + 27, y + 13, r.state === 'locked' ? '???' : U.clip(r.title, b.w - 33 - rwW, 7.5), 7.5, r.state === 'locked' ? '#999' : '#111', 'left', null);
      U.text(b.x + 27, y + 22, U.clip(r.state === 'done' ? 'Ολοκληρώθηκε · ξαναπαίζεται' : r.state === 'current' ? 'ΤΩΡΑ · πάτα για λεπτομέρειες' : 'Κλειδωμένη', b.w - 32, 6), 6, r.state === 'current' ? '#ff6a00' : '#777', 'left', null);
      if (rw) U.text(b.x + b.w - 6, y + 13, rw, 6.5, '#2a8a3a', 'right', null);
      c.fillStyle = '#e4e4ea'; c.fillRect(b.x + 6, y + rowH - 1, b.w - 12, 1);
      if (rowTap(P, b.x, y, b.w, rowH) && y >= b.y) { P.sel = i; P.activate(i); }
    });
  }
  function drawSms(c, b, P) {
    const list = (G.state.sms || []).slice().reverse(); // newest on top
    if (P.detail) {
      const m = P.detail;
      U.text(b.x + 8, b.y + 14, U.clip(m.from, b.w - 44, 8), 8, '#111', 'left', null); U.text(b.x + b.w - 8, b.y + 14, m.time, 6, '#888', 'right', null);
      const lines = U.wrapN(m.text, b.w - 30, 7.5, Math.floor((b.h - 50) / 10)); const h = lines.length * 10 + 10;
      rr(c, b.x + 6, b.y + 22, b.w - 22, h, 9, '#e9e9ef');
      lines.forEach((l, i) => U.text(b.x + 13, b.y + 34 + i * 10, l, 7.5, '#111', 'left', null));
      U.text(b.x + b.w / 2, b.y + b.h - 8, '‹ πίσω', 7, '#007aff', 'center', null);
      return;
    }
    if (!list.length) { U.text(b.x + b.w / 2, b.y + 40, 'Κανένα μήνυμα', 8, '#999', 'center', null); return; }
    const rowH = 30, sc = listScroll(P, rowH, b, list.length);
    list.forEach((m, i) => {
      const y = b.y + (i - sc) * rowH; if (y < b.y - rowH || y > b.y + b.h) return;
      if (P.sel === i) rr(c, b.x + 2, y + 2, b.w - 4, rowH - 3, 6, '#dbeaff');
      c.fillStyle = '#8e8e93'; c.beginPath(); c.arc(b.x + 14, y + 15, 8, 0, 7); c.fill(); U.text(b.x + 14, y + 18, '?', 8, '#fff', 'center', null);
      U.text(b.x + 27, y + 12, U.clip(m.from, b.w - 60, 7), 7, '#111', 'left', null); U.text(b.x + b.w - 6, y + 12, m.time, 6, '#888', 'right', null);
      U.text(b.x + 27, y + 22, U.clip(m.text, b.w - 33, 6), 6, '#666', 'left', null);
      c.fillStyle = '#e4e4ea'; c.fillRect(b.x + 6, y + rowH - 1, b.w - 12, 1);
      if (rowTap(P, b.x, y, b.w, rowH) && y >= b.y) { P.sel = i; P.activate(i); }
    });
  }
  function drawAade(c, b) {
    const st = G.state, paid = !!st.done.finale;
    rr(c, b.x, b.y, b.w, 28, 0, '#1f5fbf'); U.text(b.x + b.w / 2, b.y + 18, 'myAADE · Οφειλές', 8, '#fff', 'center', null);
    U.text(b.x + 8, b.y + 44, 'Οφειλή στην Εφορία', 6.5, '#555', 'left', null);
    U.title(b.x + 8, b.y + 62, paid ? '€0' : G.fmtMoney(G.DEBT), 16, paid ? '#34c759' : '#ff3b30', 'left');
    U.text(b.x + 8, b.y + 80, 'Διαθέσιμα', 6.5, '#555', 'left', null);
    U.title(b.x + 8, b.y + 96, G.fmtMoney(st.money), 14, st.money < 0 ? '#ff3b30' : '#111', 'left');
    const k = paid ? 1 : G.clamp(st.money / G.DEBT, 0, 1);
    rr(c, b.x + 8, b.y + 106, b.w - 16, 8, 4, '#e4e4ea'); rr(c, b.x + 8, b.y + 106, (b.w - 16) * k, 8, 4, k >= 1 ? '#34c759' : '#ff9500');
    U.wrapN(paid ? 'Εξοφλήθηκε. (+€12,40 τόκοι)' : k >= 1 ? 'Έχεις τα λεφτά! Πήγαινε στην Εφορία.' : 'Λείπουν ' + G.fmtMoney(G.DEBT - st.money), b.w - 16, 7, 2).forEach((l, i) => U.text(b.x + 8, b.y + 126 + i * 9, l, 7, '#111', 'left', null));
    const nl = U.wrapN('Το σύστημα θα είναι εκτός λειτουργίας Σάββατο-Κυριακή λόγω αναβάθμισης.', b.w - 16, 6, 3); nl.forEach((l, i) => U.text(b.x + 8, b.y + b.h - 6 - (nl.length - 1 - i) * 8, l, 6, '#888', 'left', null));
  }
  function drawSettings(c, b, P) {
    settingsRows().forEach((r, i) => {
      const y = b.y + i * 26;
      if (P.sel === i) rr(c, b.x + 2, y + 2, b.w - 4, 23, 6, '#e4e4ea');
      U.text(b.x + 10, y + 17, U.clip(r.label, b.w - 60, 7.5), 7.5, '#111', 'left', null); U.text(b.x + b.w - 10, y + 17, r.val, 7.5, '#007aff', 'right', null);
      if (G.clicked(b.x, y, b.w, 26)) { P.sel = i; P.activate(i); }
    });
  }

  // replay a finished quest for half the money
  G.replayQuest = function (id) {
    const q = G.quests[id]; if (!q) return;
    G.replaying = id; q.start();
  };
})();
