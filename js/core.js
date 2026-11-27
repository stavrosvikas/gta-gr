// GTA LUBEN — core: namespace, math, input, scene manager, save
'use strict';
const G = window.G = {
  W: 480, H: 270, t: 0, dt: 0,
  device: null,          // 'pc' | 'mobile'
  scenes: [],            // scene stack, top = active
  quests: {},            // registered quests by id
  state: null,           // save state
};

// ---------- math ----------
G.clamp = (v, a, b) => v < a ? a : v > b ? b : v;
G.lerp = (a, b, t) => a + (b - a) * t;
G.dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
G.rand = (a, b) => a + Math.random() * (b - a);
G.randi = (a, b) => Math.floor(G.rand(a, b + 1));
G.pick = arr => arr[Math.floor(Math.random() * arr.length)];
G.chance = p => Math.random() < p;
G.angleDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
G.hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
G.fmtMoney = v => (v < 0 ? '-€' : '€') + Math.abs(Math.round(v)).toLocaleString('el-GR');

// ---------- canvas ----------
G.initCanvas = function () {
  const c = G.canvas = document.getElementById('game');
  G.ctx = c.getContext('2d');
  const fit = () => {
    let sw = window.innerWidth, sh = window.innerHeight; if (!sw || !sh) { if (G.W) return; sw = 960; sh = 540; } // hidden window: keep the last size
    G.H = 270;
    G.W = G.clamp(Math.round(270 * sw / sh), 270, 600);
    // render at a higher internal resolution: the game logic stays in 'logical' pixels (G.W x G.H)
    const scaleGuess = Math.min(sw / G.W, sh / G.H) * (window.devicePixelRatio || 1);
    G.RS = G.clamp(Math.round(scaleGuess), 2, 4);
    c.width = G.W * G.RS; c.height = G.H * G.RS;
    G.ctx.imageSmoothingEnabled = false; // 1x pixel canvases stay crisp; HD canvases are drawn near native size
    const scale = Math.min(sw / G.W, sh / G.H);
    c.style.width = Math.floor(G.W * scale) + 'px';
    c.style.height = Math.floor(G.H * scale) + 'px';
    G.screenScale = scale;
    G.portrait = sh > sw;
  };
  window.addEventListener('resize', fit); fit();
};

// ---------- input ----------
// Unified actions. PC keys + mobile virtual buttons both write into G.input.
const I = G.input = {
  keys: {}, prev: {}, jd: {},
  axis: { x: 0, y: 0 },   // movement axis (-1..1)
  virt: {},               // virtual buttons held (mobile)
  tapped: {},             // virtual buttons pressed this frame
  pointer: null,          // {x,y,down,justDown} in game pixels
};
const KEYMAP = {
  up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  action: ['Space'], enter: ['KeyE', 'KeyF'], radio: ['KeyR'], map: ['KeyM', 'Tab'], ok: ['Enter', 'Space'], back: ['Escape', 'Backspace'],
  pause: ['KeyP', 'Escape'],
  a: ['KeyJ', 'Digit1'], b: ['KeyK', 'Digit2'], phone: ['KeyQ', 'KeyT'],
};
window.addEventListener('keydown', e => {
  if (!I.keys[e.code]) I.jd[e.code] = true;
  I.keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  G.audio && G.audio.unlock();
});
window.addEventListener('keyup', e => { I.keys[e.code] = false; });
G.held = name => (KEYMAP[name] || []).some(k => I.keys[k] || I.jd[k]) || !!I.virt[name];
G.pressed = name => (KEYMAP[name] || []).some(k => I.jd[k]) || !!I.tapped[name];
G.keyPressed = code => !!I.jd[code];
G.endInputFrame = () => { G.wheel = 0; I.prev = Object.assign({}, I.keys); I.tapped = {}; I.jd = {}; if (I.pointer) I.pointer.justDown = false; };
G.readAxis = () => {
  let x = 0, y = 0;
  if (G.held('left')) x -= 1; if (G.held('right')) x += 1;
  if (G.held('up')) y -= 1; if (G.held('down')) y += 1;
  if (I.stick) { x = I.stick.x; y = I.stick.y; }
  I.axis.x = x; I.axis.y = y;
  return I.axis;
};

// pointer (for menus + mobile)
function ptrPos(e) {
  const r = G.canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width * G.W, y: (e.clientY - r.top) / r.height * G.H };
}
G.initPointer = () => {
  G.canvas.addEventListener('pointerdown', e => {
    const p = ptrPos(e); I.pointer = { x: p.x, y: p.y, down: true, justDown: true };
    G.audio && G.audio.unlock();
  });
  G.canvas.addEventListener('pointermove', e => { const p = ptrPos(e); if (I.pointer) { I.pointer.x = p.x; I.pointer.y = p.y; } });
  G.canvas.addEventListener('pointerup', () => { if (I.pointer) I.pointer.down = false; });
  G.canvas.addEventListener('wheel', e => { G.wheel = (G.wheel || 0) + e.deltaY; }, { passive: true });
};
// clickable UI helper: returns true if the rect was clicked/tapped this frame
G.clicked = (x, y, w, h) => {
  const p = I.pointer; return !!(p && p.justDown && p.x >= x && p.x < x + w && p.y >= y && p.y < y + h);
};

// ---------- scenes ----------
G.push = s => { G.ui && G.ui.clearTalk && G.ui.clearTalk(); G.scenes.push(s); s.enter && s.enter(); };
G.pop = (...a) => { G.ui && G.ui.clearTalk && G.ui.clearTalk(); const s = G.scenes.pop(); s && s.exit && s.exit(...a); const top = G.top(); top && top.resume && top.resume(...a); return s; };
G.replace = s => { const o = G.scenes.pop(); o && o.exit && o.exit(); G.push(s); };
G.top = () => G.scenes[G.scenes.length - 1];

// ---------- save ----------
const SAVE_KEY = 'gta_luben_save_v1';
G.newState = () => ({
  money: 150, health: 100, wanted: 0,
  look: null, outfit: 'casual',
  done: {},              // quest id -> true
  radioOn: true, story: 0,
  playTime: 0,
});
G.load = () => { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && s.look) return s; } catch (e) {} return null; };
G.save = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(G.state)); } catch (e) {} };
G.wipe = () => { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} };

// ---------- money ----------
G.addMoney = (v, reason) => {
  G.state.money += v;
  G.ui && G.ui.moneyPop(v, reason);
  G.save();
};

// ---------- quests ----------
// Quest definition: { id, title, giver, where:{x,y} (world tile) or poiKey, desc, start() }
G.registerQuest = q => { G.quests[q.id] = q; };
G.completeQuest = (id, reward, text) => {
  if (!G.state.done[id]) G.state.done[id] = true;
  if (G.replaying === id) { reward = Math.round((reward || 0) / 2); G.replaying = null; }
  if (reward) G.addMoney(reward, 'Αποστολή');
  G.ui.banner('ΑΠΟΣΤΟΛΗ ΟΛΟΚΛΗΡΩΘΗΚΕ', text || ('+' + G.fmtMoney(reward || 0)), '#4cd964');
  G.audio.sfx('mission_pass');
  G.save();
};
G.failQuest = (id, text) => {
  G.ui.banner('ΑΠΟΣΤΟΛΗ ΑΠΕΤΥΧΕ', text || 'Ξαναδοκίμασε', '#ff3b30');
  G.audio.sfx('mission_fail');
};
