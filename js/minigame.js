// GTA LUBEN — mini-game framework used by every quest.
// See QUEST_API.md for how to write a quest.
'use strict';
(function () {
  const U = G.ui;

  // Register a quest that appears as a marker in Athens.
  // def: { id, title, short, col, where: () => [tx,ty], hidden?: () => bool, reward, make: () => MiniGame }
  G.quest = function (def) {
    def.start = def.start || function () { G.push(def.make()); };
    G.registerQuest(def);
    return def;
  };

  // Mini-game scene with intro card, play state, win/lose card.
  // opts: { id, title, intro: 'text' | {pc, mobile}, buttons: [{id,label}], stick: 'stick'|'none',
  //         init(), update(dt), render(ctx), hud(), reward, travel: {icon,to,from,sub} }
  G.MiniGame = function (opts) {
    const m = Object.assign({}, opts);
    m.phase = 'intro'; m.t = 0; m.pt = 0;
    m.win = function (text, reward) {
      if (m.phase !== 'play') return;
      m.phase = 'win'; m.resultText = text || ''; m.reward = reward != null ? reward : (opts.reward || 0); m.rt = 0;
      G.audio.stopMusic(); G.audio.sfx('mission_pass');
    };
    m.lose = function (text) {
      if (m.phase !== 'play') return;
      m.phase = 'lose'; m.resultText = text || ''; m.rt = 0; G.audio.stopMusic(); G.audio.sfx('mission_fail');
    };
    m.say = (key, text, who, dur) => G.audio.say(key, text, who, dur);
    // quests that live in a world region put you back on the map where the quest is (opts.exitTo() -> [worldPx, worldPy])
    m.toWorld = function () { if (opts.exitTo && G.worldScene.placePlayer) { const p = opts.exitTo.call(m); if (p) G.worldScene.placePlayer(p[0], p[1]); } };
    m.enter = function () { m.phase = 'intro'; m.t = 0; m.pt = 0; m.sel = 0; opts.init && opts.init.call(m); };
    m.update = function (dt) {
      m.t += dt;
      if (U.hasDialog()) { U.setMobile([{ id: 'ok', label: 'OK' }, { id: 'down', label: '▼' }, { id: 'up', label: '▲' }], 'none'); return; }
      if (m.phase === 'intro') {
        U.setMobile([{ id: 'ok', label: 'ΠΑΜΕ' }, { id: 'back', label: 'ΠΙΣΩ', pos: [G.W - 22, 22] }], 'none');
        if (G.pressed('back')) { G.pop(); return; }
        if (m.t > 0.4 && (G.pressed('ok') || G.pressed('enter'))) { m.phase = 'play'; m.pt = 0; opts.onStart && opts.onStart.call(m); }
        return;
      }
      if (m.phase === 'play') {
        { // always a visible way out on mobile: pause menu (continue / abandon), top-right
          const bs = (typeof opts.buttons === 'function' ? opts.buttons.call(m) : (opts.buttons || [])).slice();
          const taken = bs.some(b => b.pos && b.pos[0] > G.W - 40 && b.pos[1] < 40);
          bs.push({ id: 'pause', label: 'ΕΞΟΔΟΣ', pos: [taken ? G.W - 56 : G.W - 22, 22], r: 14 });
          U.setMobile(bs, opts.stick || 'stick');
        }
        if (G.pressed('pause') && !G.input.virt.back) { G.audio.pauseMusic && G.audio.pauseMusic(true); G.push(G.PauseMini(m)); return; }
        m.pt += dt; opts.update && opts.update.call(m, dt);
        return;
      }
      // result
      m.rt += dt;
      U.setMobile(m.phase === 'win' ? [{ id: 'ok', label: 'OK' }] : [{ id: 'ok', label: 'ΞΑΝΑ' }, { id: 'back', label: 'ΕΞΟΔΟΣ' }], 'none');
      if (opts.update && opts.keepUpdating) opts.update.call(m, dt);
      if (m.rt > 0.8) {
        if (m.phase === 'win' && (G.pressed('ok') || G.pressed('enter'))) { G.pop(); m.toWorld(); G.completeQuest(opts.id, m.reward, m.resultText); return; }
        if (m.phase === 'lose' && (G.pressed('ok') || G.pressed('enter'))) { m.enter(); m.phase = 'play'; opts.onStart && opts.onStart.call(m); return; }
        if (m.phase === 'lose' && G.pressed('back')) { G.pop(); m.toWorld(); G.failQuest(opts.id, m.resultText); return; }
      }
    };
    m.exit = function () { G.audio.stopMusic(); opts.exit && opts.exit.call(m); };
    m.render = function (ctx) {
      opts.render && opts.render.call(m, ctx);
      if (G.grade) G.grade(ctx);
      U.begin();
      if (m.phase === 'play' || m.phase === 'win' || m.phase === 'lose') { opts.hud && opts.hud.call(m); }
      if (m.phase === 'play' && G.device !== 'mobile' && m.pt < 6) { U.ctx.globalAlpha = Math.min(1, (6 - m.pt) / 1.5); U.text(G.W - 6, G.H - 6, 'ESC: παύση / έξοδος', 8, '#fff', 'right'); U.ctx.globalAlpha = 1; }
      U.drawOverlays();
      if (m.phase === 'intro') {
        const c = U.ctx; c.fillStyle = 'rgba(0,0,0,0.72)'; c.fillRect(0, 0, G.W, G.H);
        U.title(G.W / 2, 42, opts.title, 18, '#ffd400');
        const intro = typeof opts.intro === 'string' ? opts.intro : (opts.intro[G.device] || opts.intro.pc);
        const lines = []; intro.split('\n').forEach(p => lines.push(...U.wrap(p, G.W - 60, 9)));
        lines.forEach((l, i) => U.text(G.W / 2, 64 + i * 12, l, 9, '#fff', 'center'));
        if (Math.floor(m.t * 2) % 2) U.text(G.W / 2, G.H - 20, G.device === 'mobile' ? 'Πάτα ΠΑΜΕ' : 'ENTER για να ξεκινήσεις · ESC πίσω', 9, '#7dd3ff', 'center');
      } else if (m.phase === 'win' || m.phase === 'lose') {
        const c = U.ctx; const a = Math.min(1, m.rt * 3); c.globalAlpha = a;
        c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(0, G.H / 2 - 34, G.W, 64);
        U.title(G.W / 2, G.H / 2 - 8, m.phase === 'win' ? 'ΑΠΟΣΤΟΛΗ ΟΛΟΚΛΗΡΩΘΗΚΕ' : 'ΑΠΟΣΤΟΛΗ ΑΠΕΤΥΧΕ', 17, m.phase === 'win' ? '#4cd964' : '#ff3b30');
        U.wrap(m.resultText + (m.phase === 'win' && m.reward ? '  +' + G.fmtMoney(m.reward) : ''), G.W - 40, 9).forEach((l, i) => U.text(G.W / 2, G.H / 2 + 8 + i * 11, l, 9, '#fff', 'center'));
        if (m.rt > 0.8) U.text(G.W / 2, G.H / 2 + 26, m.phase === 'win' ? (G.device === 'mobile' ? 'OK' : 'ENTER') : (G.device === 'mobile' ? 'ΞΑΝΑ / ΕΞΟΔΟΣ' : 'ENTER ξανά · ESC έξοδος'), 8, '#7dd3ff', 'center');
        c.globalAlpha = 1;
      }
      U.drawMobile();
    };
    return m;
  };

  G.PauseMini = function (mg) {
    return {
      enter() { this.sel = 0; },
      exit() { G.audio.pauseMusic && G.audio.pauseMusic(false); },
      update() {
        U.setMobile([{ id: 'ok', label: 'OK' }, { id: 'down', label: '▼' }, { id: 'up', label: '▲' }], 'none');
        if (G.pressed('up') || G.pressed('down')) this.sel = 1 - this.sel;
        if (G.pressed('ok')) { G.pop(); if (this.sel === 1) { G.pop(); } }
        else if (G.pressed('pause') || G.pressed('back')) G.pop();
      },
      render(ctx) {
        mg.render(ctx); U.begin(); U.ctx.fillStyle = 'rgba(0,0,0,0.6)'; U.ctx.fillRect(0, 0, G.W, G.H);
        U.title(G.W / 2, 50, 'ΠΑΥΣΗ', 20, '#fff');
        if (U.button(G.W / 2 - 70, 70, 140, 18, 'ΣΥΝΕΧΕΙΑ', this.sel === 0)) G.pop();
        if (U.button(G.W / 2 - 70, 94, 140, 18, 'ΕΓΚΑΤΑΛΕΙΨΗ ΑΠΟΣΤΟΛΗΣ', this.sel === 1)) { G.pop(); G.pop(); }
        U.drawMobile();
      },
    };
  };

  // ---------- helpers for quest arenas ----------
  // Simple tile arena with its own collision. tiles: array of strings; legend: {char: {col, solid, draw(ctx,x,y,tx,ty)}}
  G.Arena = function (rows, legend, ts = 16) {
    const A = { rows, w: rows[0].length, h: rows.length, ts, legend };
    A.get = (tx, ty) => (tx < 0 || ty < 0 || tx >= A.w || ty >= A.h) ? '#' : rows[ty][tx];
    A.solidAt = (px, py) => { const c = A.get(Math.floor(px / ts), Math.floor(py / ts)); return !!(legend[c] && legend[c].solid) || c === '#'; };
    A.find = ch => { const out = []; rows.forEach((r, y) => [...r].forEach((c, x) => { if (c === ch) out.push([x, y]); })); return out; };
    let cache = null;
    A.draw = function (ctx, camX, camY) {
      if (!cache) {
        const [cv, x] = G.mkCanvas(A.w * ts, A.h * ts);
        for (let ty = 0; ty < A.h; ty++) for (let tx = 0; tx < A.w; tx++) {
          const L = legend[rows[ty][tx]] || legend.default || { col: '#000' };
          x.fillStyle = L.col || '#000'; x.fillRect(tx * ts, ty * ts, ts, ts);
          if (L.draw) { x.save(); x.translate(tx * ts, ty * ts); L.draw(x, tx, ty); x.restore(); }
        }
        cache = cv;
      }
      ctx.drawImage(cache, -Math.round(camX), -Math.round(camY));
    };
    return A;
  };
  // follow camera clamp
  G.camFollow = (cam, x, y, ww, wh, dt, k = 6) => {
    cam.x += (x - G.W / 2 - cam.x) * Math.min(1, dt * k); cam.y += (y - G.H / 2 - cam.y) * Math.min(1, dt * k);
    cam.x = G.clamp(cam.x, 0, Math.max(0, ww - G.W)); cam.y = G.clamp(cam.y, 0, Math.max(0, wh - G.H));
  };
})();
