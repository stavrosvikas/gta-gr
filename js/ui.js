// GTA LUBEN — UI layer: crisp overlay canvas (game coords), HUD, bubbles, toasts, dialogs, mobile controls
'use strict';
(function () {
  const U = G.ui = {};
  let bubbles = [], toasts = [], banner = null, shakeT = 0, shakeA = 0, splatT = 0, pops = [], dialog = null, subtitle = null;

  U.init = function () {
    const c = U.canvas = document.getElementById('ui');
    U.ctx = c.getContext('2d');
    const fit = () => {
      const gc = G.canvas; const dpr = window.devicePixelRatio || 1;
      c.style.width = gc.style.width; c.style.height = gc.style.height;
      const cw = parseFloat(gc.style.width), ch = parseFloat(gc.style.height);
      c.width = Math.round(cw * dpr); c.height = Math.round(ch * dpr);
      U.k = c.width / G.W;
    };
    window.addEventListener('resize', () => setTimeout(fit, 0)); fit(); U.fit = fit;
  };
  // ---------- web view: a real <iframe> laid exactly over a rect of the canvas (game coords) ----------
  // Scripts are NOT allowed in the sandbox: server-rendered pages + links work, JS ads (and any JS) don't run.
  // The owner must call U.web.place(rect) every frame; if it stops (scene changed), U.begin removes it.
  const web = U.web = {
    el: null, loaded: false, seen: -1, nav: 0, back: false, url: '',
    open(url) {
      if (web.el) return;
      const f = document.createElement('iframe');
      f.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms'); // the site needs JS to show anything; no popups and no top-navigation, so ad pop-ups/redirects can't escape
      f.setAttribute('referrerpolicy', 'no-referrer'); f.setAttribute('title', 'LUBEN'); f.setAttribute('loading', 'eager');
      f.className = 'webview'; f.style.opacity = '0';
      web.loaded = false; web.nav = -1; web.back = false; web.url = url; web.t0 = G.t;
      f.addEventListener('load', () => {
        web.loaded = true; f.style.opacity = '1';
        if (web.back) { web.back = false; web.nav = Math.max(0, web.nav - 1); } else web.nav++;
      });
      f.src = url; document.body.appendChild(f); web.el = f; web.seen = G.t;
      // keys held when the page opened would stay 'down' forever (their keyup goes to the iframe)
      G.input.keys = {}; G.input.jd = {}; G.input.virt = {}; G.input.stick = null;
    },
    close() { if (!web.el) return; web.el.remove(); web.el = null; web.loaded = false; try { window.focus(); } catch (e) {} },
    home() { if (!web.el) return; web.loaded = false; web.el.style.opacity = '0'; web.back = false; web.nav = -1; web.t0 = G.t; web.el.src = web.url + (web.url.includes('?') ? '&' : '?') + '_=' + Date.now(); },
    // back inside the site: the iframe's navigations live in the page's joint history; never go further back than the first page
    goBack() { if (!web.el || web.nav <= 0) return false; web.back = true; history.back(); return true; },
    // r = {x,y,w,h} in game px. vw = minimum CSS width the page is laid out at (scaled down to fit)
    place(r, vw = 360) {
      const f = web.el; if (!f) return; web.seen = G.t;
      const b = G.canvas.getBoundingClientRect(), k = b.width / G.W;
      const cw = r.w * k, ch = r.h * k, z = cw < vw ? cw / vw : 1;
      const css = `left:${(b.left + r.x * k).toFixed(1)}px;top:${(b.top + r.y * k).toFixed(1)}px;width:${(cw / z).toFixed(1)}px;height:${(ch / z).toFixed(1)}px;transform:scale(${z.toFixed(4)});opacity:${web.loaded ? 1 : 0}`;
      if (web.css !== css) { f.style.cssText = css; web.css = css; }
    },
  };
  // swallow game keys while the web view is open (Escape = close is handled by its owner via G.pressed('back'))
  window.addEventListener('keydown', e => { if (web.el && e.code !== 'Escape') e.stopImmediatePropagation(); }, true);
  U.begin = function () {
    if (web.el && G.t - web.seen > 0.25) web.close();
    const x = U.ctx; x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, U.canvas.width, U.canvas.height); x.setTransform(U.k, 0, 0, U.k, 0, 0); x.imageSmoothingEnabled = false; return x; };

  // ---------- text helpers ----------
  const FONT = '"Fira Sans Condensed", "Segoe UI", Arial, sans-serif'; // the ONE font of the game (Google Fonts, full Greek)
  const FS = 1.05; // size factor for this font
  U.fpx = (size, weight = 600) => `${weight} ${Math.round(size * FS * 10) / 10}px ${FONT}`;
  U.FONT = FONT;
  U.text = function (x, y, s, size = 8, col = '#fff', align = 'left', outline = '#000', weight = 'bold') {
    const c = U.ctx; c.font = U.fpx(size, weight === 'bold' ? 650 : weight); c.textAlign = align; c.textBaseline = 'alphabetic';
    if (outline) { c.lineWidth = Math.max(1.5, size / 4); c.strokeStyle = outline; c.lineJoin = 'round'; c.strokeText(s, x, y); }
    c.fillStyle = col; c.fillText(s, x, y);
  };
  // GTA-ish title text: heavy, outlined, slightly slanted
  U.title = function (x, y, s, size, col = '#fff', align = 'center') {
    const c = U.ctx; c.save(); c.translate(x, y); c.transform(1, 0, -0.12, 1, 0, 0);
    c.font = U.fpx(size, 850); c.textAlign = align;
    if (col !== '#111' && col !== '#000') { c.shadowColor = 'rgba(0,0,0,0.55)'; c.shadowBlur = Math.max(1, size / 6); c.shadowOffsetY = Math.max(0.5, size / 14); } // soft shadow instead of a stroke
    c.fillStyle = col; c.fillText(s, 0, 0); c.restore();
  };
  U.wrap = function (s, maxW, size) {
    const c = U.ctx; c.font = U.fpx(size, 650); const words = String(s).split(' '); const lines = []; let cur = '';
    for (let w of words) {
      // a single word wider than the line: hard-break it
      while (c.measureText(w).width > maxW && w.length > 1) { let k = w.length - 1; while (k > 1 && c.measureText(w.slice(0, k)).width > maxW) k--; if (cur) { lines.push(cur); cur = ''; } lines.push(w.slice(0, k)); w = w.slice(k); }
      const t = cur ? cur + ' ' + w : w; if (c.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
    }
    if (cur) lines.push(cur); return lines;
  };
  // measure / ellipsize / shrink-to-fit (same weight as U.text)
  U.measure = function (s, size, weight = 650) { const c = U.ctx; c.font = U.fpx(size, weight); return c.measureText(String(s)).width; };
  U.clip = function (s, maxW, size, weight = 650) {
    s = String(s); if (U.measure(s, size, weight) <= maxW) return s;
    let lo = 0, hi = s.length; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (U.measure(s.slice(0, m).trimEnd() + '…', size, weight) <= maxW) lo = m; else hi = m - 1; }
    return lo ? s.slice(0, lo).trimEnd() + '…' : '…';
  };
  U.fitSize = function (s, maxW, size, min = 6, weight = 650) { let z = size; while (z > min && U.measure(s, z, weight) > maxW) z -= 0.5; return z; };
  // wrap into at most n lines; the last one gets an ellipsis if text is left over
  U.wrapN = function (s, maxW, size, n) { const ls = U.wrap(s, maxW, size); if (ls.length <= n) return ls; const out = ls.slice(0, n); out[n - 1] = U.clip(ls.slice(n - 1).join(' '), maxW, size); return out; };
  // ---------- one visual language for every screen ----------
  const T = U.T = {
    panel: 'rgba(16,13,28,0.9)', panel2: 'rgba(255,255,255,0.08)', line: 'rgba(255,255,255,0.16)',
    accent: '#ff3e8a', gold: '#ffd400', green: '#4cd964', red: '#ff3b30', blue: '#5ac8fa', text: '#ffffff', sub: '#b9b4c8', r: 6,
  };
  U.rr = function (x, y, w, h, r, fill, stroke) {
    const c = U.ctx; c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h);
    if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1; c.stroke(); }
  };
  // panel: rounded dark glass with a thin border; accent = colour of a left stripe
  U.box = function (x, y, w, h, fill = T.panel, stroke = T.line, accent) {
    U.rr(x, y, w, h, T.r, fill, stroke === '#fff' || stroke === '#ffffff66' || stroke === '#ff3e8a' ? T.line : stroke);
    if (accent) U.rr(x, y + 3, 3, h - 6, 1.5, accent);
  };
  U.button = function (x, y, w, h, label, hot, size = 9) {
    U.rr(x, y, w, h, Math.min(T.r, h / 2), hot ? T.accent : 'rgba(255,255,255,0.08)', hot ? 'rgba(255,255,255,0.6)' : T.line);
    U.text(x + w / 2, y + h / 2 + size / 3, label, size, '#fff', 'center', hot ? 'rgba(0,0,0,0.35)' : null);
    return G.clicked(x, y, w, h);
  };
  // small key chip like [E]
  U.chip = function (x, y, key, align = 'left') {
    const c = U.ctx; c.font = U.fpx(7, 650); const w = Math.max(11, c.measureText(key).width + 6);
    const bx = align === 'right' ? x - w : x;
    U.rr(bx, y - 8, w, 11, 3, '#fff'); U.text(bx + w / 2, y, key, 7, '#111', 'center', null); return w;
  };
  // pill with optional key chip + text
  U.pill = function (cx, y, text, key, col = '#fff') {
    const c = U.ctx; c.font = U.fpx(8, 650); const tw = c.measureText(text).width; const kw = key ? Math.max(11, c.measureText(key).width + 6) + 5 : 0;
    const w = tw + kw + 16, x = cx - w / 2;
    U.rr(x, y - 10, w, 15, 7.5, T.panel, T.line);
    if (key) U.chip(x + 7, y, key);
    U.text(x + 8 + kw, y, text, 8, col, 'left', null);
  };

  // ---------- feedback ----------
  U.bubble = function (text, speaker, dur = 2.5) {
    if (speaker) { bubbles = bubbles.filter(b => b.sp !== speaker); bubbles.push({ text, sp: speaker, t: dur }); }
    else subtitle = { text, t: dur };
  };
  U.clearTalk = () => { bubbles = []; subtitle = null; };
  U.toast = (text, dur = 3) => { toasts.push({ text, t: dur }); if (toasts.length > 3) toasts.shift(); };
  U.banner = (big, small, col = '#ffd400', dur = 3) => { banner = { big, small, col, t: dur, d: dur }; };
  U.shake = a => { shakeT = 0.25; shakeA = Math.max(shakeA, a); };
  U.splat = d => { splatT = d; };
  U.moneyPop = (v, reason) => pops.push({ v, reason, t: 1.8 });
  U.shakeOffset = () => shakeT > 0 ? [G.rand(-shakeA, shakeA), G.rand(-shakeA, shakeA)] : [0, 0];
  // dialog with choices: opts = [{label, cb}], text
  U.dialog = function (title, text, opts) { dialog = { title, text, opts, sel: 0 }; };
  U.hasDialog = () => !!dialog;

  U.update = function (dt) {
    bubbles.forEach(b => b.t -= dt); bubbles = bubbles.filter(b => b.t > 0 && !b.sp.dead);
    toasts.forEach(b => b.t -= dt); toasts = toasts.filter(b => b.t > 0);
    pops.forEach(b => b.t -= dt); pops = pops.filter(b => b.t > 0);
    if (banner) { banner.t -= dt; if (banner.t <= 0) banner = null; }
    if (subtitle) { subtitle.t -= dt; if (subtitle.t <= 0) subtitle = null; }
    shakeT -= dt; if (shakeT <= 0) shakeA = 0; splatT = Math.max(0, splatT - dt);
    if (dialog) {
      if (G.pressed('up') || G.pressed('left')) dialog.sel = (dialog.sel + dialog.opts.length - 1) % dialog.opts.length;
      if (G.pressed('down') || G.pressed('right')) dialog.sel = (dialog.sel + 1) % dialog.opts.length;
      if (G.pressed('ok') || G.pressed('enter')) { const o = dialog.opts[dialog.sel]; dialog = null; o.cb && o.cb(); }
    }
  };

  // draw world-attached bubbles (call during UI pass with camera)
  U.drawBubbles = function (camX, camY) {
    const c = U.ctx;
    for (const b of bubbles) {
      const sx = b.sp.x - camX, sy = b.sp.y - camY - (b.sp.kind === 'veh' ? 22 : 32);
      const lines = U.wrap(b.text, 120, 8); c.font = U.fpx(8, 650);
      const w = Math.max(...lines.map(l => c.measureText(l).width)) + 10, h = lines.length * 10 + 5;
      const bx = G.clamp(sx - w / 2, 2, G.W - w - 2), by = G.clamp(sy - h - 4, 2, G.H - h - 2);
      c.fillStyle = '#fff'; c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 1;
      c.beginPath(); if (c.roundRect) c.roundRect(bx, by, w, h, 5); else c.rect(bx, by, w, h); c.fill(); c.stroke();
      const tx = G.clamp(sx, bx + 6, bx + w - 6);
      c.beginPath(); c.moveTo(tx - 3, by + h); c.lineTo(tx, by + h + 4); c.lineTo(tx + 3, by + h); c.fillStyle = '#fff'; c.fill();
      lines.forEach((l, i) => U.text(bx + w / 2, by + 10 + i * 10, l, 8, '#111', 'center', null));
    }
  };

  U.drawOverlays = function () {
    const c = U.ctx;
    if (splatT > 0) { // cake on screen
      c.globalAlpha = Math.min(1, splatT); c.fillStyle = '#f7e1c5';
      for (let i = 0; i < 9; i++) { c.beginPath(); c.arc(G.W * (0.2 + 0.08 * i) + Math.sin(i * 7) * 30, G.H * (0.3 + 0.07 * (i % 5)), 18 + (i % 3) * 9, 0, 7); c.fill(); }
      c.fillStyle = '#ff6fa3'; for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(G.W * (0.25 + 0.1 * i), G.H * (0.35 + 0.08 * (i % 3)), 6, 0, 7); c.fill(); }
      c.globalAlpha = 1;
    }
    if (subtitle) {
      const ls = U.wrap(subtitle.text, G.W - 80, 9), w = Math.min(G.W - 40, Math.max(...ls.map(l => { c.font = U.fpx(9, 650); return c.measureText(l).width; })) + 20), h = ls.length * 11 + 8;
      U.box(G.W / 2 - w / 2, G.H - 46 - h, w, h, T.panel, T.line, T.gold);
      ls.forEach((l, i) => U.text(G.W / 2, G.H - 46 - h + 13 + i * 11, l, 9, T.gold, 'center', null));
    }
    // toasts: left column, wrapped to 2 lines, never wider than the free space (the money panel sits top-right)
    let ty = (G.worldScene && G.top() === G.worldScene ? (G.device === 'mobile' ? 82 : 30) : 10);
    toasts.forEach(t => {
      const maxW = Math.min(G.W - 130, 300), ls = U.wrapN(t.text, maxW - 18, 8, 2);
      const w = Math.max(...ls.map(l => U.measure(l, 8))) + 18, h = 4 + ls.length * 10;
      const a = Math.min(1, t.t * 3); c.globalAlpha = a; U.box(8, ty, w, h, T.panel, T.line, T.accent);
      ls.forEach((l, k) => U.text(15, ty + 11 + k * 10, l, 8, '#fff', 'left', null)); c.globalAlpha = 1; ty += h + 3;
    });
    if (banner) {
      const a = Math.min(1, banner.t * 2, (banner.d - banner.t) * 4); c.globalAlpha = a;
      const w = Math.min(G.W - 30, 300), sl = U.wrapN(banner.small || '', w - 20, 9, 2), bh = 40 + sl.length * 10;
      U.box(G.W / 2 - w / 2, G.H / 2 - 30, w, bh, T.panel, T.line);
      U.rr(G.W / 2 - w / 2, G.H / 2 - 30, w, 3, 1.5, banner.col);
      U.title(G.W / 2, G.H / 2 - 2, banner.big, U.fitSize(banner.big, w - 24, 18, 10, 850), banner.col);
      sl.forEach((l, k) => U.text(G.W / 2, G.H / 2 + 13 + k * 10, l, 9, '#fff', 'center', null));
      c.globalAlpha = 1;
    }
    if (dialog) {
      c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(0, 0, G.W, G.H);
      const w = Math.min(G.W - 30, 300), lines = []; dialog.text.split('\n').forEach(p => lines.push(...(p ? U.wrap(p, w - 20, 8) : [''])));
      const maxL = Math.max(3, Math.floor((G.H - 50 - dialog.opts.length * 18) / 10)); if (lines.length > maxL) { lines.length = maxL; lines[maxL - 1] += '…'; }
      const h = 34 + lines.length * 10 + dialog.opts.length * 18;
      const x = (G.W - w) / 2, y = (G.H - h) / 2;
      U.box(x, y, w, h, T.panel, T.line); U.rr(x, y, w, 20, { tl: T.r, tr: T.r, bl: 0, br: 0 } && T.r, 'rgba(255,62,138,0.9)');
      U.rr(x, y + 14, w, 6, 0, 'rgba(255,62,138,0.9)');
      U.text(x + 10, y + 14, U.clip(dialog.title, w - 20, 9), 9, '#fff', 'left', null);
      lines.forEach((l, i) => U.text(x + 10, y + 32 + i * 10, l, 8, '#fff', 'left', null));
      dialog.opts.forEach((o, i) => {
        const by = y + 36 + lines.length * 10 + i * 18;
        if (U.button(x + 8, by, w - 16, 15, U.clip(o.label, w - 28, 8), i === dialog.sel, 8)) { dialog = null; o.cb && o.cb(); }
      });
    }
  };

  // ---------- HUD (world) ----------
  U.drawHUD = function (scene) {
    const st = G.state, c = U.ctx, mob = G.device === 'mobile';
    // --- top-right: money / health / wanted, one panel ---
    const pw = 92, px = G.W - pw - 10, py = 8;
    // 1) wanted stars (on their own)
    for (let i = 0; i < 5; i++) {
      const filled = i < st.wanted, blink = st.wanted > 0 && Math.floor(G.t * 4) % 2;
      c.save(); c.translate(px + 8 + i * 17, py); c.scale(1.6, 1.6); G.drawStar(c, 0, 0, filled && !(blink && i === st.wanted - 1)); c.restore();
    }
    // 2) health bar (on its own)
    U.rr(px, py + 15, pw, 8, 4, 'rgba(10,8,18,0.85)', 'rgba(255,255,255,0.25)');
    U.rr(px + 2, py + 17, Math.max(0, (pw - 4) * st.health / 100), 4, 2, st.health > 30 ? T.green : T.red);
    // 3) money (on its own, GTA-style outlined text)
    { const mt = G.fmtMoney(st.money), mw = U.measure(mt, 15, 850) + 14; U.rr(px + pw - mw + 4, py + 27, mw, 20, 6, 'rgba(16,13,28,0.72)'); } // dark pill so the money reads on any ground
    U.title(px + pw, py + 42, G.fmtMoney(st.money), 15, st.money < 0 ? '#ff6b6b' : '#8dff8a', 'right');
    pops.forEach((p, i) => U.text(px + pw, py + 56 + i * 10 - (1.8 - p.t) * 4, (p.v >= 0 ? '+' : '−') + G.fmtMoney(Math.abs(p.v)) + (p.reason ? ' ' + p.reason : ''), 8, p.v >= 0 ? '#8dff8a' : '#ff6b6b', 'right'));
    // --- radar: GTA-style circle, bottom-left (top-left on mobile, where the joystick isn't) ---
    const R = mob ? 30 : 38, ox = 10 + R, oy = mob ? 10 + R : G.H - 10 - R;
    const mm = G.World.minimap(), pp = G.player.vehicle || G.player, ptx = pp.x / G.TS, pty = pp.y / G.TS;
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.arc(ox + 2, oy + 3, R + 3, 0, 7); c.fill(); // shadow
    c.save(); c.beginPath(); c.arc(ox, oy, R, 0, 7); c.clip();
    c.fillStyle = '#2f7d3a'; c.fillRect(ox - R, oy - R, R * 2, R * 2);
    const zoom = 1.6; c.imageSmoothingEnabled = false;
    c.drawImage(mm, ox - ptx * zoom, oy - pty * zoom, mm.width * zoom, mm.height * zoom);
    for (const m of [...(scene.markers || []), ...(scene.places || [])]) {
      let dx = (m.tx - ptx) * zoom, dy = (m.ty - pty) * zoom; const d = Math.hypot(dx, dy), RR = R - 7;
      if (d > RR) { if (!m.main) continue; dx = dx / d * RR; dy = dy / d * RR; }
      if (m.main) U.text(ox + dx, oy + dy + 4, '★', 12, T.gold, 'center', '#000');
      else { c.fillStyle = '#000'; c.fillRect(ox + dx - 3, oy + dy - 3, 6, 6); c.fillStyle = m.col; c.fillRect(ox + dx - 2, oy + dy - 2, 4, 4); }
    }
    for (const k of G.Sim.cops) { const dx = (k.x / G.TS - ptx) * zoom, dy = (k.y / G.TS - pty) * zoom; if (Math.hypot(dx, dy) < R) { c.fillStyle = Math.floor(G.t * 6) % 2 ? '#2d6bff' : '#ff2d2d'; c.fillRect(ox + dx - 2, oy + dy - 2, 4, 4); } }
    // wanted: radar ring flashes red/blue
    c.restore();
    const ring = st.wanted > 0 ? (Math.floor(G.t * 5) % 2 ? '#ff2d2d' : '#2d6bff') : 'rgba(16,13,28,0.95)';
    c.strokeStyle = ring; c.lineWidth = 4; c.beginPath(); c.arc(ox, oy, R + 1, 0, 7); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 1; c.beginPath(); c.arc(ox, oy, R + 3.5, 0, 7); c.stroke();
    U.text(ox, oy - R + 9, 'Β', 7, '#fff', 'center', '#000'); // north
    c.save(); c.translate(ox, oy); c.rotate(pp.a != null && G.player.vehicle ? pp.a + Math.PI / 2 : [Math.PI, -Math.PI / 2, Math.PI / 2, 0][pp.dir]);
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(0, -5); c.lineTo(4, 4); c.lineTo(-4, 4); c.closePath(); c.fill(); c.strokeStyle = '#000'; c.lineWidth = 1; c.stroke(); c.restore();
    // zone name: bottom-right, GTA style
    // (mobile: top-centre, the action buttons own the bottom-right corner)
    if (scene.zoneShow > 0 || !mob) { c.globalAlpha = mob ? Math.min(1, scene.zoneShow) : Math.max(0.55, Math.min(1, scene.zoneShow + 0.55)); const zl = scene.zoneLabel || ''; if (mob) U.title(G.W / 2, 40, zl, U.fitSize(zl, G.W - 200, 13, 8, 850), '#fff', 'center'); else U.title(G.W - 10, G.H - 12, zl, U.fitSize(zl, 150, 13, 8, 850), '#fff', 'right'); c.globalAlpha = 1; }
    // --- arrest progress (cop next to you while you stand still) ---
    if (G.Sim.arrest > 0.02) {
      const w = 120, x0 = G.W / 2 - w / 2, y0 = 40;
      U.box(x0, y0, w, 22, T.panel, T.line, T.red);
      U.text(G.W / 2, y0 + 10, 'ΣΥΛΛΗΨΗ… κουνήσου!', 8, '#ff6b6b', 'center', null);
      U.rr(x0 + 8, y0 + 14, w - 16, 4, 2, 'rgba(255,255,255,0.15)'); U.rr(x0 + 8, y0 + 14, (w - 16) * G.Sim.arrest, 4, 2, T.red);
    }
    // --- top-centre: radio pill ---
    if (G.player.vehicle && st.radioOn) U.pill(G.W / 2, 18, '♪ Μην παραχαράζετε · repeat', mob ? null : 'R', T.gold);
    // --- bottom-centre: objective + interaction hint ---
    // objective: wrapped to 2 lines inside the free strip between the radar/joystick (left) and the zone name/buttons (right)
    let objTop = G.H - (mob ? 30 : 12) - 14;
    if (scene.objective) {
      const t = '★ ' + scene.objective.replace('▶ ', ''), maxW = Math.max(120, G.W - (mob ? 190 : 230));
      const ls = U.wrapN(t, maxW - 16, 8, 2), w = Math.max(...ls.map(l => U.measure(l, 8))) + 16, h = 6 + ls.length * 10;
      const y = G.H - (mob ? 30 : 12) - h + 2; objTop = y;
      U.box(G.W / 2 - w / 2, y, w, h, T.panel, T.line, T.gold);
      ls.forEach((l, k) => U.text(G.W / 2 + 2, y + 11 + k * 10, l, 8, '#fff', 'center', null));
    }
    if (scene.hint) U.pill(G.W / 2, objTop - 8, U.clip(scene.hint, Math.max(100, G.W - 220), 8), mob ? null : (scene.hintKey || 'E'), T.blue);
    // --- left under the minimap: phone shortcut ---
    if (!mob) { const unread = G.unreadSms ? G.unreadSms() : 0; U.box(8, 8, 74, 16, T.panel, T.line, unread ? T.gold : null); U.chip(14, 19, 'Q'); U.text(30, 19, 'Κινητό' + (unread ? ' (' + unread + ')' : ''), 7.5, unread ? T.gold : '#fff', 'left', null); }
  };

  // ---------- mobile controls ----------
  // layout: joystick left, buttons right. Buttons defined by current scene: scene.buttons = [{id,label}]
  const ctrl = { stickId: null, sx: 0, sy: 0, kx: 0, ky: 0, touches: new Map() };
  U.mobileButtons = [];
  U.initTouch = function () {
    const el = G.canvas;
    const pos = t => { const r = el.getBoundingClientRect(); return { x: (t.clientX - r.left) / r.width * G.W, y: (t.clientY - r.top) / r.height * G.H }; };
    const handle = e => {
      if (G.device !== 'mobile') return;
      e.preventDefault();
      G.input.virt = {}; let stick = null;
      for (const t of e.touches) {
        const p = pos(t);
        const b = U.mobileButtons.find(b => Math.hypot(p.x - b.x, p.y - b.y) < b.r + 4);
        if (b) { G.input.virt[b.id] = true; if (!ctrl.touches.has(t.identifier)) G.input.tapped[b.id] = true; ctrl.touches.set(t.identifier, b.id); continue; }
        if (p.x < G.W * 0.45 && (U.stickMode !== 'none')) {
          if (ctrl.stickId !== t.identifier) { ctrl.stickId = t.identifier; ctrl.sx = p.x; ctrl.sy = p.y; }
          stick = p;
        }
      }
      for (const id of [...ctrl.touches.keys()]) if (![...e.touches].some(t => t.identifier === id)) ctrl.touches.delete(id);
      if (stick) {
        let dx = stick.x - ctrl.sx, dy = stick.y - ctrl.sy; const d = Math.hypot(dx, dy), R = 22;
        if (d > R) { ctrl.sx += dx - dx / d * R; ctrl.sy += dy - dy / d * R; dx = dx / d * R; dy = dy / d * R; }
        ctrl.kx = dx; ctrl.ky = dy; G.input.stick = { x: Math.abs(dx) > 4 ? dx / R : 0, y: Math.abs(dy) > 4 ? dy / R : 0 };
      } else { ctrl.stickId = null; G.input.stick = null; }
    };
    el.addEventListener('touchstart', handle, { passive: false });
    el.addEventListener('touchmove', handle, { passive: false });
    el.addEventListener('touchend', handle, { passive: false });
    el.addEventListener('touchcancel', handle, { passive: false });
  };
  // scene calls this each frame to declare its buttons: [{id, label}] ; stickMode 'stick' | 'none'
  U.setMobile = function (buttons, stickMode = 'stick') {
    U.stickMode = stickMode;
    const R = 15, out = [];
    const anchors = [[G.W - 26, G.H - 30], [G.W - 62, G.H - 22], [G.W - 30, G.H - 66], [G.W - 66, G.H - 58], [G.W - 26, 60]];
    buttons.forEach((b, i) => { const [x, y] = b.pos || anchors[i]; out.push({ id: b.id, label: b.label, x, y, r: b.r || R }); });
    U.mobileButtons = out;
  };
  U.drawMobile = function () {
    if (G.device !== 'mobile') return;
    const c = U.ctx;
    if (U.stickMode !== 'none') {
      const bx = ctrl.stickId != null ? ctrl.sx : 40, by = ctrl.stickId != null ? ctrl.sy : G.H - 40;
      c.globalAlpha = 0.35; c.fillStyle = '#fff'; c.beginPath(); c.arc(bx, by, 24, 0, 7); c.fill();
      c.globalAlpha = 0.7; c.beginPath(); c.arc(bx + (ctrl.stickId != null ? ctrl.kx : 0), by + (ctrl.stickId != null ? ctrl.ky : 0), 10, 0, 7); c.fill(); c.globalAlpha = 1;
    }
    for (const b of U.mobileButtons) {
      const on = G.input.virt[b.id];
      c.globalAlpha = on ? 0.95 : 0.8; c.fillStyle = on ? T.accent : T.panel; c.beginPath(); c.arc(b.x, b.y, b.r, 0, 7); c.fill();
      c.strokeStyle = on ? '#fff' : T.line; c.lineWidth = 1.2; c.stroke(); c.globalAlpha = 1;
      U.text(b.x, b.y + 3, b.label, b.label.length > 3 ? 6 : 9, '#fff', 'center', null);
    }
  };
})();
