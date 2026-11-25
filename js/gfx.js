// GTA LUBEN — procedural pixel art (GBA-style 3/4 view). Everything is drawn in code.
'use strict';
(function () {
  const cache = new Map();
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return [c, x]; };
  G.mkCanvas = mk;

  // colour helpers
  const hex = h => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
  const toHex = (r, g, b) => '#' + [r, g, b].map(v => G.clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
  G.shade = (h, f) => { const [r, g, b] = hex(h); return f < 0 ? toHex(r * (1 + f), g * (1 + f), b * (1 + f)) : toHex(r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f); };

  // add a dark 1px outline around opaque pixels (GBA look)
  function outline(c, col = '#1a1420') {
    const x = c.getContext('2d'); const d = x.getImageData(0, 0, c.width, c.height); const w = c.width, h = c.height;
    const a = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) a[i] = d.data[i * 4 + 3] > 0 ? 1 : 0;
    const [r, g, b] = hex(col);
    for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) {
      const i = y * w + xx; if (a[i]) continue;
      if ((xx > 0 && a[i - 1]) || (xx < w - 1 && a[i + 1]) || (y > 0 && a[i - w]) || (y < h - 1 && a[i + w])) {
        d.data[i * 4] = r; d.data[i * 4 + 1] = g; d.data[i * 4 + 2] = b; d.data[i * 4 + 3] = 255;
      }
    }
    x.putImageData(d, 0, 0);
  }
  G.outline = outline;

  // ================= PEOPLE =================
  // look = { skin, hair, hairStyle, top, top2, topStyle, legs, shoes, acc:[], held, female }
  // dir: 0 down, 1 left, 2 right, 3 up ; frame 0..2 ; returns 18x26 canvas (sprite area 16x24 +1px border)
  const PW = 18, PH = 26;
  function drawPerson(look, dir, frame) {
    const [c, x] = mk(PW, PH);
    const P = (px, py, w, h, col) => { x.fillStyle = col; x.fillRect(px + 1, py + 1, w, h); };
    const acc = look.acc || [];
    const has = a => acc.some(s => s === a || s.startsWith(a + ':'));
    const accVal = a => { const s = acc.find(s => s.startsWith(a + ':')); return s ? s.split(':')[1] : null; };
    const skin = look.skin || '#e8b48a', skinD = G.shade(skin, -0.18);
    const hair = look.hair || '#2b1d14', hairL = G.shade(hair, 0.18);
    const top = look.top || '#3a6ea5', topD = G.shade(top, -0.25), top2 = look.top2 || G.shade(top, 0.3);
    const legs = look.legs || '#2d3446', shoes = look.shoes || '#222';
    const step = frame === 1 ? 1 : frame === 2 ? -1 : 0;
    const side = dir === 1 || dir === 2, back = dir === 3;
    const robe = look.topStyle === 'cassock' || look.topStyle === 'dress';
    const hs = look.hairStyle || 'short';

    // long hair behind body
    if (['long', 'curly_long', 'afro', 'mullet', 'ponytail_long'].includes(hs) && !side) {
      P(3, 3, 10, hs === 'afro' ? 9 : 12, hair);
    }
    if (side && ['long', 'curly_long', 'mullet', 'afro'].includes(hs)) P(dir === 2 ? 3 : 7, 3, 6, hs === 'afro' ? 8 : 11, hair);

    const fem = !!look.female;
    const skirt = fem && look.skirt;
    // legs
    if (!robe && skirt && !side) {
      P(5, 18, 6, 3, look.legs || '#2d3446'); P(4, 20, 8, 1, G.shade(look.legs || '#2d3446', -0.2));
      P(5, 21, 2, 2 - Math.max(0, step), skin); P(9, 21, 2, 2 - Math.max(0, -step), skin);
      P(5, 23 - Math.max(0, step), 2, 1, shoes); P(9, 23 - Math.max(0, -step), 2, 1, shoes);
    } else if (!robe && skirt && side) {
      P(5, 18, 6, 3, look.legs || '#2d3446'); P(6 + step, 21, 2, 2, skin); P(7 - step, 21, 2, 2, skin); P(5 + step, 23, 3, 1, shoes); P(7 - step, 23, 3, 1, shoes);
    } else if (!robe) {
      if (side) {
        P(6, 18, 4, 5, legs); P(6 + step, 18, 3, 5, G.shade(legs, -0.15));
        P(5 + step, 23, 5, 1, shoes); P(6 - step, 23, 4, 1, shoes);
      } else {
        P(5, 18, 3, 5 - Math.max(0, step), legs); P(8, 18, 3, 5 - Math.max(0, -step), legs);
        P(5, 23 - Math.max(0, step), 3, 1, shoes); P(8, 23 - Math.max(0, -step), 3, 1, shoes);
        if (has('crocs')) { P(5, 23 - Math.max(0, step), 3, 1, '#7ed957'); P(8, 23 - Math.max(0, -step), 3, 1, '#ff8fb1'); }
      }
    }

    // torso
    const tx = side ? 5 : (fem ? 4 : 3), tw = side ? 6 : (fem ? 8 : 10);
    const tb = robe ? 13 : 8;
    P(tx, 10, tw, tb, top);
    P(tx, 10 + tb - 1, tw, 1, topD);
    if (robe) { P(tx - (side ? 0 : 1), 18, tw + (side ? 0 : 2), 5, top); P(tx, 23, tw, 1, topD); P(side ? 6 : 6, 23, 4, 1, shoes); }
    switch (look.topStyle) {
      case 'tank': if (!side) { P(3, 10, 2, 4, skin); P(11, 10, 2, 4, skin); } break;
      case 'shirt': if (!back && !side) { P(7, 10, 2, 6, top2); } break;
      case 'suit': if (!back && !side) { P(7, 10, 2, 4, top2); const tie = accVal('tie'); if (tie) P(7, 11, 2, 4, tie); } break;
      case 'jacket': if (!back && !side) { P(7, 10, 1, 8, topD); P(3, 10, 10, 1, top2); } break;
      case 'jersey': if (!side) { P(3, 13, 10, 1, top2); } if (!back && !side) P(9, 11, 2, 2, top2); break;
      case 'police':
        if (!side) { P(4, 11, 8, 6, '#15161b'); P(5, 12, 2, 2, '#2c2d33'); P(9, 12, 2, 2, '#2c2d33'); }
        else P(5, 11, 6, 6, '#15161b');
        break;
      case 'hoodie': if (!back && !side) { P(6, 13, 4, 2, topD); } break;
      case 'vest': if (!back && !side) { P(3, 10, 3, 8, '#141414'); P(10, 10, 3, 8, '#141414'); P(6, 10, 4, 8, top2); } break;
      case 'camo': { for (let i = 0; i < 9; i++) P(tx + (i * 3) % tw, 10 + ((i * 5) % tb), 2, 1, i % 2 ? '#5a4a2a' : '#8b8456'); break; }
    }
    if (fem && !side && !robe) {
      if (!back && look.topStyle !== 'suit') { P(7, 10, 2, 2, skin); P(6, 10, 1, 1, skin); P(9, 10, 1, 1, skin); } // neckline
      P(3, 16, 1, 2, top); P(12, 16, 1, 2, top); // hips
      if (!back) { const tl = G.shade(top, 0.22), td = G.shade(top, -0.3); P(4, 12, 3, 2, tl); P(9, 12, 3, 2, tl); P(4, 14, 3, 1, td); P(9, 14, 3, 1, td); P(7, 13, 2, 1, td); } // στήθος
    }
    if (fem && side && !robe) { P(dir === 2 ? 11 : 4, 12, 1, 2, top); P(dir === 2 ? 11 : 4, 14, 1, 1, G.shade(top, -0.3)); }
    if (has('apron') && !back) P(tx + 1, 13, tw - 2, 6, '#f2f2f2');
    if (has('tote') && !back) { P(side ? 8 : 11, 12, 3, 5, '#e9dcc0'); }
    if (has('strap') && !back && !side) { for (let i = 0; i < 7; i++) P(4 + i, 10 + i, 1, 1, '#1b1b1b'); }
    if (has('necklace') && !back && !side) { P(6, 10, 1, 2, '#c0392b'); P(9, 10, 1, 2, '#c0392b'); P(7, 12, 2, 1, '#c0392b'); }
    if (has('gold') && !back && !side) { P(6, 11, 4, 1, '#e8c547'); }

    // arms
    const sleeve = ['tank'].includes(look.topStyle) ? skin : top;
    if (side) {
      P(7 + step, 11, 2, 5, sleeve); P(7 + step, 16, 2, 1, skin);
    } else {
      const ax0 = fem ? 3 : 2, ax1 = fem ? 12 : 13;
      P(ax0, 11 + Math.max(0, -step), 1, 5, sleeve); P(ax1, 11 + Math.max(0, step), 1, 5, sleeve);
      P(ax0, 16 + Math.max(0, -step), 1, 2, skin); P(ax1, 16 + Math.max(0, step), 1, 2, skin);
      if (has('muscles')) { P(1, 11, 2, 4, sleeve); P(13, 11, 2, 4, sleeve); }
    }

    // head
    const hx = side ? 4 : 4, hw = 8;
    P(hx, 2, hw, 8, skin); P(hx, 9, hw, 1, skinD);
    if (side) P(dir === 2 ? 11 : 3, 5, 1, 2, skin); // nose
    // face
    if (!back) {
      const ey = 6;
      if (side) {
        const ex = dir === 2 ? 9 : 6; P(ex, ey, 1, 1, '#1b1b1b');
      } else { P(6, ey, 1, 1, '#1b1b1b'); P(9, ey, 1, 1, '#1b1b1b'); if (fem) { P(5, ey - 1, 2, 1, '#1b1b1b'); P(9, ey - 1, 2, 1, '#1b1b1b'); } }
      if (fem && side) P(dir === 2 ? 9 : 6, ey - 1, 2, 1, '#1b1b1b');
      if (fem && !has('lipstick')) P(side ? (dir === 2 ? 9 : 6) : 7, 8, side ? 1 : 2, 1, '#d0606a');
      if (!has('beard') && !has('beardGrey') && !has('mask')) P(side ? (dir === 2 ? 9 : 6) : 7, 8, side ? 1 : 2, 1, skinD);
      if (look.female && !side) { P(5, 7, 1, 1, '#e88'); P(10, 7, 1, 1, '#e88'); }
      if (has('lipstick') && !side) P(7, 8, 2, 1, '#c0182c');
    }
    // hair styles
    const H = (px, py, w, h) => P(px, py, w, h, hair);
    if (side) {
      const back_ = dir === 2 ? 4 : 8;
      switch (hs) {
        case 'bald': break;
        case 'balding': P(back_, 3, 4, 3, hair); break;
        case 'buzz': P(4, 2, 8, 1, hair); P(back_, 2, 4, 3, hair); break;
        default: H(4, 1, 8, 3); H(back_, 1, 4, 6); if (['curly', 'curly_long', 'afro'].includes(hs)) { H(3, 0, 10, 2); P(5, 0, 1, 1, hairL); P(9, 1, 1, 1, hairL); }
      }
    } else if (back) {
      if (hs === 'bald') { P(4, 2, 8, 2, G.shade(skin, 0.1)); }
      else if (hs === 'balding') { P(4, 4, 8, 6, hair); P(5, 2, 6, 2, skin); }
      else { H(4, 1, 8, 9); if (['curly', 'curly_long', 'afro'].includes(hs)) { H(3, 0, 10, 4); P(5, 1, 1, 1, hairL); P(10, 2, 1, 1, hairL); } }
      if (hs === 'ponytail' || hs === 'bun') H(7, hs === 'bun' ? 0 : 9, 2, 3);
    } else {
      switch (hs) {
        case 'bald': P(5, 2, 6, 1, G.shade(skin, 0.15)); break;
        case 'balding': H(4, 4, 1, 4); H(11, 4, 1, 4); break;
        case 'buzz': H(4, 2, 8, 1); break;
        case 'slick': H(4, 1, 8, 2); H(4, 3, 1, 3); H(11, 3, 1, 3); P(6, 1, 3, 1, hairL); break;
        case 'short': H(4, 1, 8, 2); H(4, 3, 1, 2); H(11, 3, 1, 2); P(6, 1, 2, 1, hairL); break;
        case 'quiff': H(4, 1, 8, 2); H(6, 0, 5, 1); H(4, 3, 1, 2); H(11, 3, 1, 2); break;
        case 'curly': H(3, 0, 10, 3); H(3, 3, 2, 4); H(11, 3, 2, 4); P(5, 0, 1, 1, hairL); P(8, 1, 1, 1, hairL); P(11, 0, 1, 1, hairL); break;
        case 'curly_long': H(3, 0, 10, 3); H(3, 3, 2, 8); H(11, 3, 2, 8); P(5, 0, 1, 1, hairL); P(9, 1, 1, 1, hairL); break;
        case 'afro': H(2, 0, 12, 3); H(2, 3, 3, 6); H(11, 3, 3, 6); P(4, 0, 1, 1, hairL); P(8, 1, 1, 1, hairL); P(12, 2, 1, 1, hairL); break;
        case 'long': H(4, 1, 8, 2); H(3, 2, 2, 11); H(11, 2, 2, 11); H(5, 3, 6, 1); P(3, 12, 1, 2, hair); P(12, 12, 1, 2, hair); break;
        case 'mullet': H(3, 1, 10, 3); H(3, 4, 2, 7); H(11, 4, 2, 7); H(5, 4, 6, 1); break;
        case 'bob': H(3, 1, 10, 3); H(3, 4, 2, 4); H(11, 4, 2, 4); break;
        case 'bun': H(4, 1, 8, 2); H(6, -1 + 1, 4, 1); H(4, 3, 1, 2); H(11, 3, 1, 2); break;
        case 'ponytail': H(4, 1, 8, 2); H(4, 3, 1, 3); H(11, 3, 1, 3); H(12, 2, 2, 2); H(13, 4, 2, 6); break;
      }
    }
    // facial accessories
    if (!back) {
      if (has('beard') || has('beardGrey') || has('beardLong')) {
        const bc = has('beardGrey') ? '#9a9a96' : hair;
        if (side) P(dir === 2 ? 6 : 4, 7, 6, 3, bc);
        else { P(4, 6, 1, 3, bc); P(11, 6, 1, 3, bc); P(4, 8, 8, 2, bc); P(7, 8, 2, 1, skinD); }
        if (has('beardLong')) { if (side) P(dir === 2 ? 7 : 5, 10, 4, 4, bc); else P(5, 10, 6, 5, bc); }
      }
      if (has('mustache')) { if (side) P(dir === 2 ? 9 : 5, 7, 2, 1, has('beardGrey') ? '#9a9a96' : hair === '#d8d8d8' ? '#bbb' : '#6b6b6b'); else P(6, 7, 4, 1, '#6b6b6b'); }
      if (has('shades')) {
        if (side) { P(dir === 2 ? 8 : 4, 5, 4, 2, '#101014'); P(dir === 2 ? 10 : 5, 5, 1, 1, '#7ec8ff'); }
        else { P(4, 5, 8, 2, '#101014'); P(5, 5, 2, 1, '#7ec8ff'); P(9, 5, 1, 1, '#b8e4ff'); }
      }
      if (has('glasses')) {
        if (side) { P(dir === 2 ? 8 : 5, 5, 3, 1, '#2a2a2a'); }
        else { P(5, 5, 2, 2, '#2a2a2a'); P(9, 5, 2, 2, '#2a2a2a'); P(6, 6, 1, 0, '#2a2a2a'); P(7, 5, 2, 1, '#2a2a2a'); P(5, 6, 1, 0, skin); }
      }
      if (has('thinglasses') && !side) { P(5, 5, 2, 1, '#bbb'); P(9, 5, 2, 1, '#bbb'); P(7, 5, 2, 1, '#bbb'); }
      if (has('mask')) { if (side) P(dir === 2 ? 7 : 4, 8, 5, 2, '#3b6fb6'); else P(4, 8, 8, 2, '#3b6fb6'); }
      if (has('earrings') && !side) { P(3, 7, 1, 2, '#e8c547'); P(12, 7, 1, 2, '#e8c547'); }
    }
    // headwear
    const cap = accVal('cap');
    if (cap) { P(4, 0, 8, 3, cap); if (!back) { if (side) P(dir === 2 ? 11 : 1, 2, 4, 1, G.shade(cap, -0.2)); else P(4, 3, 8, 1, G.shade(cap, -0.2)); } }
    if (has('monkhat')) { P(4, 0, 8, 3, '#1c1c1c'); if (!back && !side) P(7, 1, 2, 1, '#a33'); }
    if (has('beanie')) { P(4, 0, 8, 3, accVal('beanie') || '#333'); }

    // held items
    const held = look.held;
    if (held) {
      const hxR = side ? (dir === 2 ? 10 : 4) : 13, hyR = 15;
      const flip = dir === 1 ? -1 : 1;
      switch (held) {
        case 'axe': P(hxR, hyR - 9, 1, 11, '#7a4a25'); P(hxR - 2 * (dir === 1 ? -1 : 1) - (dir === 1 ? 0 : 1), hyR - 9, 3, 4, '#9aa3ab'); break;
        case 'broom': P(hxR, hyR - 12, 1, 14, '#c49a5a'); P(hxR - 1, hyR + 2, 3, 4, '#d8b25a'); break;
        case 'mic': P(hxR, hyR - 4, 1, 4, '#222'); P(hxR - 1 + (flip < 0 ? 0 : 0), hyR - 6, 2, 2, '#555'); break;
        case 'cross': P(hxR, hyR - 6, 1, 7, '#b07b3a'); P(hxR - 1, hyR - 4, 3, 1, '#b07b3a'); break;
        case 'phone': P(hxR, hyR - 4, 2, 3, '#222'); P(hxR, hyR - 4, 1, 1, '#9cf'); break;
        case 'tray': P(hxR - 2, hyR - 3, 5, 1, '#c9c9c9'); P(hxR - 1, hyR - 6, 1, 3, '#f2d36b'); P(hxR + 1, hyR - 6, 1, 3, '#f2d36b'); break;
        case 'stick': P(hxR, hyR - 10, 1, 13, '#6b4a2b'); break;
        case 'cake': P(hxR - 1, hyR - 2, 4, 3, '#f7e1c5'); P(hxR - 1, hyR - 3, 4, 1, '#ff6fa3'); break;
        case 'censer': P(hxR, hyR, 1, 3, '#888'); P(hxR - 1, hyR + 3, 3, 2, '#c33'); break;
        case 'champagne': P(hxR, hyR - 5, 1, 5, '#1f5a2a'); P(hxR, hyR - 6, 1, 1, '#e8c547'); break;
        case 'radio': P(hxR, hyR - 2, 2, 4, '#222'); P(hxR + 1, hyR - 6, 1, 4, '#333'); break;
      }
    }
    outline(c);
    return c;
  }

  G.personSprite = function (look, dir, frame) {
    if (!look._id) look._id = JSON.stringify(look);
    const key = 'p' + look._id + dir + frame;
    let s = cache.get(key); if (!s) { s = drawPerson(look, dir, frame); cache.set(key, s); }
    return s;
  };
  // draw a person with feet at (x,y) in screen coords
  G.drawPerson = function (ctx, look, x, y, dir = 0, frame = 0, opts = {}) {
    const s = G.personSprite(look, dir, frame);
    ctx.save();
    if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
    if (opts.down) { // knocked down: lie sideways
      ctx.translate(Math.round(x), Math.round(y - 4)); ctx.rotate(Math.PI / 2);
      ctx.drawImage(s, -PW / 2, -PH + 4);
    } else {
      // shadow
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(Math.round(x), Math.round(y) - 1, 6, 2, 0, 0, 7); ctx.fill();
      ctx.drawImage(s, Math.round(x - PW / 2), Math.round(y - PH + 1 - (opts.lift || 0)));
    }
    ctx.restore();
  };

  // ================= VEHICLES (drawn facing UP; rotate when rendering) =================
  const VEH = {
    car:    { w: 22, h: 40 }, taxi: { w: 22, h: 40 },
    // Athens street mix: city hatchback (Yaris/Corsa/Panda/Polo/207/C3), mini (C1/Aygo/i10), Smart, sedan (Corolla/E-class), small SUV (Qashqai)
    city: { w: 22, h: 36 }, mini: { w: 20, h: 31 }, smart: { w: 20, h: 25 }, sedan: { w: 22, h: 43 }, suv: { w: 24, h: 41 }, police: { w: 22, h: 40 }, ferrari: { w: 22, h: 40 },
    tincan: { w: 20, h: 36 }, van: { w: 24, h: 46 }, pickup: { w: 24, h: 44 }, bus: { w: 28, h: 84 },
    truck:  { w: 32, h: 90 }, bike: { w: 8, h: 22 }, scooter: { w: 8, h: 18 }, moto: { w: 10, h: 24 },
    dias:   { w: 10, h: 24 }, heli: { w: 44, h: 60 }, sheeptruck: { w: 26, h: 50 }, garbage: { w: 28, h: 62 },
  };
  G.VEH = VEH;
  const TWO = { bike: 1, scooter: 1, moto: 1, dias: 1 };
  // vehicles drawn facing UP with soft shading (a bit richer than pure pixel art)
  function drawVehicle(type, col) {
    const d = VEH[type]; const [c, x] = G.hiCanvas(d.w + 2, d.h + 2, Math.max(3, (G.RS || 2) * 1.5));
    const W = d.w, H = d.h;
    const P = (px, py, w, h, cl) => { x.fillStyle = cl; x.fillRect(px + 1, py + 1, w, h); };
    const R = (px, py, w, h, r, cl) => { x.fillStyle = cl; x.beginPath(); if (x.roundRect) x.roundRect(px + 1, py + 1, w, h, r); else x.rect(px + 1, py + 1, w, h); x.fill(); };
    const grad = (px, w, c1, c2) => { const g = x.createLinearGradient(px, 0, px + w, 0); g.addColorStop(0, c1); g.addColorStop(0.5, c2); g.addColorStop(1, c1); return g; };
    const body = col, dark = G.shade(col, -0.35), lite = G.shade(col, 0.3);
    const glass = '#22324e', glassL = '#6b8cc0';
    const wheels = (ys, ww = 4, wh = 8) => ys.forEach(y => { P(-1, y, ww, wh, '#141414'); P(W - ww + 1, y, ww, wh, '#141414'); });
    if (['city', 'mini', 'smart', 'sedan', 'suv'].includes(type)) {
      // shape table: windscreen y, roof length, rear glass, wheel rows, corner radius
      const M = {
        city:  { ws: 9, roof: 11, rear: 4, wh: [5, H - 12], r: 7 },
        mini:  { ws: 8, roof: 9, rear: 4, wh: [4, H - 11], r: 8 },
        smart: { ws: 5, roof: 9, rear: 4, wh: [3, H - 10], r: 8 },
        sedan: { ws: 11, roof: 12, rear: 4, wh: [6, H - 13], r: 6 },
        suv:   { ws: 10, roof: 15, rear: 5, wh: [5, H - 12], r: 5 },
      }[type];
      wheels(M.wh, type === 'suv' ? 5 : 4, type === 'smart' ? 7 : 8);
      R(1, 0, W - 2, H, M.r, grad(1, W - 2, dark, lite));
      R(3, 1, W - 6, H - 2, M.r - 1, body);
      P(5, 2.5, W - 10, 1, lite);
      if (type === 'suv') { P(1, 4, 2, H - 8, '#2a2a2e'); P(W - 3, 4, 2, H - 8, '#2a2a2e'); } // black wheel-arch cladding
      R(3, M.ws, W - 6, 6, 2, glass); P(5, M.ws + 1, 4, 2, glassL);
      const roofC = type === 'smart' ? '#1c1c20' : G.shade(col, 0.15);
      R(4, M.ws + 6, W - 8, M.roof, 2, roofC);
      if (type === 'smart') { P(4, M.ws + 6, W - 8, 1.2, '#2c2c32'); R(5, M.ws + 7.5, W - 10, M.roof - 3, 2, glass); P(6.5, M.ws + 8.5, 3, 1, glassL); } // the tridion cage + glass roof
      if (type === 'suv') { P(5, M.ws + 7, 1, M.roof - 2, '#9aa0a8'); P(W - 6, M.ws + 7, 1, M.roof - 2, '#9aa0a8'); } // roof rails
      R(3, M.ws + 6 + M.roof, W - 6, M.rear, 2, glass);
      P(2, M.ws + 6, 1, M.roof, glass); P(W - 3, M.ws + 6, 1, M.roof, glass);
      P(-1, M.ws + 1, 2, 2, dark); P(W - 1, M.ws + 1, 2, 2, dark);
      P(3, 0, 4, 1.8, '#fff7c0'); P(W - 7, 0, 4, 1.8, '#fff7c0'); P(3, H - 1.8, 4, 1.8, '#e8302a'); P(W - 7, H - 1.8, 4, 1.8, '#e8302a');
      if (type === 'sedan') P(5, H - 6, W - 10, 1, G.shade(col, -0.2)); // trunk line
    } else if (type === 'ferrari') { // low, wide, long bonnet, small cabin set back, engine louvres, round tail lights
      wheels([5, H - 12], 4, 8);
      const g = x.createLinearGradient(1, 0, W - 1, 0); g.addColorStop(0, dark); g.addColorStop(0.5, lite); g.addColorStop(1, dark);
      x.fillStyle = g; x.beginPath(); // body with flared hips (narrower at the waist)
      x.moveTo(1 + 5, 1); x.quadraticCurveTo(1 + W / 2, -0.5, W + 1 - 5, 1); x.quadraticCurveTo(W, 2, W, 9);
      x.quadraticCurveTo(W - 1.2, 18, W, 27); x.lineTo(W, H - 4); x.quadraticCurveTo(W, H + 0.6, W - 6, H + 0.6); x.lineTo(8, H + 0.6); x.quadraticCurveTo(2, H + 0.6, 2, H - 4);
      x.lineTo(2, 27); x.quadraticCurveTo(3.2, 18, 2, 9); x.quadraticCurveTo(2, 2, 6, 1); x.closePath(); x.fill();
      R(3.5, 1.5, W - 7, H - 3, 6, body);
      P(W / 2 - 0.5, 2, 1, 11, lite); P(6, 3, 2, 8, G.shade(col, 0.22)); P(W - 8, 3, 2, 8, G.shade(col, 0.22));   // bonnet crease + gloss
      R(4, 0.6, 4, 1.8, 0.9, '#fff7c0'); R(W - 8, 0.6, 4, 1.8, 0.9, '#fff7c0'); P(6, 0, W - 12, 1, '#1a1a1a');     // headlights + splitter
      R(W / 2 - 1.6, 4, 3.2, 3.6, 0.8, '#ffd400'); P(W / 2 - 0.5, 4.8, 1, 2, '#111');                             // badge
      const ws = 15;
      R(3.5, ws, W - 7, 5, 2, glass); P(5.5, ws + 1, 4, 1.6, glassL);
      R(4.5, ws + 5, W - 9, 7, 2, G.shade(col, 0.12));
      R(4, ws + 12, W - 8, 3.5, 1.5, glass);
      P(1.5, ws + 7, 2, 6, '#1a1a1a'); P(W - 1.5, ws + 7, 2, 6, '#1a1a1a');                                       // side intakes
      for (let yy = ws + 17; yy < H - 7; yy += 2) P(6, yy, W - 12, 0.9, G.shade(col, -0.45));                     // engine louvres
      for (const tx of [4, 7.5, W - 10.5, W - 7]) { x.fillStyle = '#e8302a'; x.beginPath(); x.arc(tx + 1.5, H - 1.6, 1.3, 0, 7); x.fill(); }
      P(W / 2 - 3, H - 1, 2, 1.6, '#888'); P(W / 2 + 1, H - 1, 2, 1.6, '#888');                                   // exhausts
      P(-1, ws + 1, 2, 2, dark); P(W - 1, ws + 1, 2, 2, dark);                                                   // mirrors
    } else if (['car', 'taxi', 'police', 'tincan'].includes(type)) {
      wheels([6, H - 13]);
      const r = type === 'ferrari' ? 7 : 6;
      R(1, 0, W - 2, H, r, grad(1, W - 2, dark, lite));
      R(3, 1, W - 6, H - 2, r - 1, body);
      P(5, 3, W - 10, 1, lite);
      const ws = type === 'ferrari' ? 13 : type === 'tincan' ? 9 : 10;
      R(3, ws, W - 6, 6, 2, glass); P(5, ws + 1, 4, 2, glassL);
      const roofH = type === 'ferrari' ? 8 : 12;
      R(4, ws + 6, W - 8, roofH, 2, type === 'taxi' ? '#ffd84a' : G.shade(col, 0.15));
      R(3, ws + 6 + roofH, W - 6, 5, 2, glass); P(5, ws + 7 + roofH, 3, 1, glassL);
      P(2, ws + 6, 1, roofH, glass); P(W - 3, ws + 6, 1, roofH, glass);
      P(-1, ws + 1, 2, 2, dark); P(W - 1, ws + 1, 2, 2, dark);
      P(3, 0, 4, 2, '#fff7c0'); P(W - 7, 0, 4, 2, '#fff7c0'); P(3, H - 2, 4, 2, '#e8302a'); P(W - 7, H - 2, 4, 2, '#e8302a');
      if (type === 'taxi') { P(W / 2 - 4, ws + 9, 8, 3, '#222'); P(W / 2 - 3, ws + 10, 6, 1, '#fff'); }
      if (type === 'police') { P(4, ws + 9, 6, 3, '#2d6bff'); P(W - 10, ws + 9, 6, 3, '#ff2d2d'); P(1, H - 14, W - 2, 3, '#1d3f8f'); }
      if (type === 'ferrari') { P(W / 2 - 1, 3, 2, 3, '#ffd400'); P(2, H - 6, W - 4, 2, '#222'); }
      if (type === 'tincan') { P(4, 4, 3, 2, '#b8a888'); P(W - 7, H - 10, 3, 3, '#a8763a'); P(5, H - 8, 2, 2, '#a8763a'); }
    } else if (type === 'van' || type === 'pickup' || type === 'sheeptruck') {
      wheels([6, H - 13]);
      R(1, 0, W - 2, H, 4, grad(1, W - 2, dark, lite)); R(3, 1, W - 6, H - 2, 3, body);
      R(3, 5, W - 6, 6, 2, glass); P(5, 6, 4, 2, glassL); P(3, 0, 4, 2, '#fff7c0'); P(W - 7, 0, 4, 2, '#fff7c0');
      if (type === 'van') { R(3, 12, W - 6, H - 15, 2, lite); P(3, H - 2, 4, 2, '#e8302a'); P(W - 7, H - 2, 4, 2, '#e8302a'); }
      else {
        P(2, 13, W - 4, 2, '#333');
        R(3, 15, W - 6, H - 17, 1, type === 'sheeptruck' ? '#8a6a48' : G.shade(col, -0.45));
        if (type === 'sheeptruck') for (let yy = 17; yy < H - 4; yy += 5) P(3, yy, W - 6, 1, '#6a4a2a');
      }
    } else if (type === 'bus') {
      wheels([8, H - 16], 4, 10);
      R(1, 0, W - 2, H, 4, grad(1, W - 2, dark, lite)); R(3, 1, W - 6, H - 2, 3, body);
      R(3, 2, W - 6, 6, 2, glass); P(5, 3, 5, 2, glassL);
      R(4, 10, W - 8, H - 14, 2, G.shade(col, 0.35));
      // roof: AC units + hatches (no heads: you can't see people through a roof)
      R(7, 16, W - 14, 12, 2, '#d8dde3'); P(9, 18, W - 18, 1, '#aab'); P(9, 22, W - 18, 1, '#aab');
      R(8, 38, W - 16, 8, 2, '#c8ccd2'); R(8, 58, W - 16, 8, 2, '#c8ccd2');
      P(3, 10, 1, H - 14, '#22324e'); P(W - 4, 10, 1, H - 14, '#22324e'); // side windows
      P(W / 2 - 3, H - 4, 6, 2, '#e8302a');
    } else if (type === 'truck') {
      wheels([6, H - 30, H - 16], 4, 10);
      R(1, 0, W - 2, 18, 4, '#f2f2f2'); R(3, 3, W - 6, 6, 2, glass);
      P(1, 19, W - 2, H - 19, '#f6f6f6'); P(1, 19, 2, H - 19, '#3a8fd6'); P(W - 3, 19, 2, H - 19, '#3a8fd6');
      P(4, 22, W - 8, H - 25, '#5a5a5a'); for (let yy = 24; yy < H - 4; yy += 6) P(4, yy, W - 8, 1, '#4a4a4a');
    } else if (type === 'garbage') { // municipal garbage truck: white cab, green body, compactor at the back
      wheels([7, H - 25, H - 14], 4, 9);
      const gD = G.shade(col, -0.32), gL = G.shade(col, 0.25);
      // cab: white with a green stripe and an orange beacon on the roof
      R(1, 0, W - 2, 17, 4, grad(1, W - 2, '#c3c9cf', '#ffffff'));
      R(3, 2, W - 6, 6, 2, glass); P(5, 3, 5, 2, glassL);
      R(4, 9, W - 8, 6, 2, '#eceff2'); P(1, 13.5, W - 2, 2, col);
      P(3, 0, 4, 1.6, '#fff7c0'); P(W - 7, 0, 4, 1.6, '#fff7c0');
      P(-1, 4, 2, 2, '#333'); P(W - 1, 4, 2, 2, '#333');
      R(W / 2 - 2.6, 9, 5.2, 3.2, 1.6, '#ff8a1a'); P(W / 2 - 1.4, 9.4, 1.6, 1, '#ffd29a');
      // container: green roof with soft ribs and white bands
      R(1, 18, W - 2, H - 32, 3, grad(1, W - 2, gD, gL));
      R(3, 19, W - 6, H - 34, 2, col);
      for (let yy = 23; yy < H - 17; yy += 5) P(4, yy, W - 8, 0.8, gD);
      P(1, 26, W - 2, 3.5, '#f2f2f2'); P(1, H - 22, W - 2, 2.5, '#f2f2f2');
      // compactor: grey-green hopper with the dark mouth, orange edge markings, back step
      R(2, H - 14, W - 4, 11, 2, grad(2, W - 4, '#3a463d', '#6e8073'));
      R(5, H - 12, W - 10, 6, 1.5, '#1b201d'); P(6, H - 11.2, W - 12, 0.8, '#55665a');
      P(1.5, H - 13, 1.6, 9, '#ff8a1a'); P(W - 3.1, H - 13, 1.6, 9, '#ff8a1a');
      P(0, H - 3.2, W, 2.4, '#4a4f55'); P(0, H - 3.2, W, 0.7, '#6d737a');
      P(2, H - 1.6, 3, 1.4, '#e8302a'); P(W - 5, H - 1.6, 3, 1.4, '#e8302a');
    } else if (type === 'bike') {
      P(2, 0, 4, 5, '#1a1a1a'); P(2, H - 5, 4, 5, '#1a1a1a'); P(3, 4, 2, H - 8, col); P(0, 4, 8, 1, '#555');
    } else if (type === 'scooter') {
      P(2, 0, 4, 4, '#1a1a1a'); P(2, H - 4, 4, 4, '#1a1a1a'); R(2, 3, 4, H - 6, 1, col); P(0, 2, 8, 1, '#555');
    } else if (type === 'moto' || type === 'dias') {
      P(2, 0, 6, 6, '#1a1a1a'); P(2, H - 6, 6, 6, '#1a1a1a'); R(1, 5, 8, H - 10, 3, col); R(2, 8, 6, 6, 2, '#2a2a2a'); P(0, 4, 10, 1, '#555');
      if (type === 'dias') { P(1, H - 9, 8, 3, '#1d3f8f'); P(2, 5, 2, 2, '#2d6bff'); P(6, 5, 2, 2, '#ff2d2d'); }
    } else if (type === 'heli') {
      R(12, 6, 20, 28, 9, grad(12, 20, dark, lite)); R(15, 8, 14, 10, 5, glass); P(17, 9, 4, 3, glassL);
      P(20, 33, 4, 22, dark); P(15, 53, 14, 4, dark); P(8, 14, 2, 22, '#333'); P(34, 14, 2, 22, '#333');
    }
    // soft dark rim instead of a pixel outline
    if (d.w >= 20 && type !== 'heli') { x.globalCompositeOperation = 'destination-over'; x.fillStyle = 'rgba(14,12,20,0.9)'; x.beginPath(); if (x.roundRect) x.roundRect(0.4, 0.4, d.w + 1.2, d.h + 1.2, 5); else x.rect(0.4, 0.4, d.w + 1.2, d.h + 1.2); x.fill(); x.globalCompositeOperation = 'source-over'; }
    return c;
  }
  G.vehicleSprite = (type, col) => { const k = 'v' + (G.RS || 2) + type + col; let s = cache.get(k); if (!s) { s = drawVehicle(type, col); cache.set(k, s); } return s; };
  // ---- damage: the clean sprite + dents, scratches, cracked glass, a loose bumper, burnt wreck (cached per level/zones/seed) ----
  // dmg = { l: 1..3 dented, 4 wrecked; z: hit zones bitmask 1 front, 2 rear, 4 right, 8 left; s: seed 0..2 }
  const DM = 3; // margin around the sprite for the hanging bumper
  function drawDamaged(type, col, dmg) {
    const d = VEH[type], base = G.vehicleSprite(type, col), W = d.w + 2, H = d.h + 2;
    const [c, x] = G.hiCanvas(W + DM * 2, H + DM * 2, Math.max(3, (G.RS || 2) * 1.5));
    c.ox = DM; c.oy = DM;
    const L = dmg.l, z = dmg.z || 1, sd = dmg.s || 0, rnd = (i) => { const v = Math.sin((i + 1) * 12.9898 + sd * 78.233 + L * 3.7) * 43758.5453; return v - Math.floor(v); };
    x.drawImage(base, DM, DM, W, H);
    x.save(); x.globalCompositeOperation = 'source-atop'; x.translate(DM, DM);
    // where the hits were: dent centres in sprite space (front = top)
    const spots = [];
    const n = Math.min(4, L + (L >= 3 ? 1 : 0));
    const zones = [1, 2, 4, 8].filter(b => z & b); if (!zones.length) zones.push(1);
    for (let i = 0; i < n * zones.length; i++) {
      const zb = zones[i % zones.length], u = rnd(i * 3), v = rnd(i * 3 + 1);
      if (zb === 1) spots.push([3 + u * (W - 6), 2 + v * H * 0.18]);
      else if (zb === 2) spots.push([3 + u * (W - 6), H - 2 - v * H * 0.18]);
      else if (zb === 4) spots.push([W - 2 - v * 3, H * 0.15 + u * H * 0.7]);
      else spots.push([2 + v * 3, H * 0.15 + u * H * 0.7]);
    }
    for (const [sx, sy] of spots) { // dent: dark crumple with a light rim
      const r = 2.2 + L * 0.9;
      const g = x.createRadialGradient(sx + r * 0.25, sy + r * 0.25, 0.2, sx, sy, r);
      g.addColorStop(0, 'rgba(20,16,24,0.55)'); g.addColorStop(0.6, 'rgba(20,16,24,0.22)'); g.addColorStop(1, 'rgba(20,16,24,0)');
      x.fillStyle = g; x.beginPath(); x.ellipse(sx, sy, r * 1.2, r, 0.4, 0, 7); x.fill();
      x.strokeStyle = 'rgba(255,255,255,0.2)'; x.lineWidth = 0.35; x.beginPath(); x.arc(sx - r * 0.2, sy - r * 0.2, r * 0.7, Math.PI * 1.0, Math.PI * 1.45); x.stroke();
    }
    // scratches: thin light strokes along the sides
    x.lineCap = 'round';
    for (let i = 0; i < L + 1; i++) {
      const left = rnd(40 + i) < 0.5, sx = left ? 2.5 + rnd(50 + i) * 3 : W - 2.5 - rnd(50 + i) * 3, sy = H * (0.2 + rnd(60 + i) * 0.55), len = 4 + rnd(70 + i) * 6;
      x.strokeStyle = 'rgba(235,235,240,0.55)'; x.lineWidth = 0.35; x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx + (rnd(80 + i) - 0.5) * 2, sy + len); x.stroke();
    }
    // cracked windscreen (spider web) from level 2
    if (L >= 2) {
      const cx = W * (0.35 + rnd(90) * 0.3), cy = H > 60 ? (z & 2 && !(z & 1) ? H - 6 : 6) : H * 0.26 + (z & 2 && !(z & 1) ? H * 0.42 : 0);
      x.strokeStyle = 'rgba(230,240,255,0.8)'; x.lineWidth = 0.3;
      x.beginPath(); for (let k = 0; k < 6; k++) { const a = k * 1.05 + rnd(100 + k); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(a) * (2.5 + rnd(110 + k) * 3), cy + Math.sin(a) * (1.6 + rnd(120 + k) * 2)); } x.stroke();
      x.beginPath(); x.arc(cx, cy, 1.4, 0, 7); x.stroke();
    }
    // burnt wreck: sooty tint + scorch blotches
    if (L >= 4) {
      x.fillStyle = 'rgba(26,20,18,0.72)'; x.fillRect(-1, -1, W + 2, H + 2);
      for (let i = 0; i < 5; i++) { const g = x.createRadialGradient(W * rnd(130 + i), H * rnd(140 + i), 0, W * rnd(130 + i), H * rnd(140 + i), 6); g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(-1, -1, W + 2, H + 2); }
      x.fillStyle = 'rgba(255,120,40,0.35)'; x.beginPath(); x.ellipse(W / 2, H * 0.14, W * 0.18, 1.6, 0, 0, 7); x.fill(); // glowing engine bay
    }
    x.restore();
    // loose bumper hanging off the most-hit end (drawn over the edge, from level 3)
    if (L >= 3) {
      const front = (z & 1) || !(z & 2), by = front ? DM + 1.2 : DM + H - 1.2, tilt = (rnd(150) < 0.5 ? -1 : 1) * (0.18 + rnd(160) * 0.12);
      x.save(); x.translate(DM + W / 2 + (rnd(170) - 0.5) * 3, by + (front ? -0.8 : 0.8)); x.rotate(tilt);
      x.fillStyle = L >= 4 ? '#2a2422' : '#3a3a40'; x.strokeStyle = 'rgba(28,20,36,0.85)'; x.lineWidth = 0.5;
      x.beginPath(); if (x.roundRect) x.roundRect(-W / 2 + 2, -1, W - 4, 2.2, 1); else x.rect(-W / 2 + 2, -1, W - 4, 2.2); x.fill(); x.stroke();
      x.fillStyle = 'rgba(255,255,255,0.25)'; x.fillRect(-W / 2 + 3, -0.8, W - 6, 0.5);
      x.restore();
    }
    return c;
  }
  G.vehicleDamagedSprite = (type, col, dmg) => {
    const k = 'd' + (G.RS || 2) + type + col + '|' + dmg.l + '|' + (dmg.z || 1) + '|' + (dmg.s || 0);
    let s = cache.get(k); if (!s) { s = drawDamaged(type, col, dmg); cache.set(k, s); } return s;
  };
  // draw vehicle centered at x,y with heading a (radians, 0 = facing right); dmg (optional) = damage overlay, see above
  G.drawVehicle = function (ctx, type, col, x, y, a, extra, dmg) {
    if (TWO[type] && G.drawRide) return G.drawRide(ctx, type, col, x, y, a, null, { siren: extra === 'siren' });
    const s = G.vehicleSprite(type, col);
    ctx.save(); ctx.translate(x, y); ctx.rotate(a + Math.PI / 2);
    const sw = s.lw || s.width, shh = s.lh || s.height;
    const ds = dmg && dmg.l && VEH[type] && VEH[type].w >= 20 && type !== 'heli' ? G.vehicleDamagedSprite(type, col, dmg) : null;
    if (type === 'heli') { ctx.fillStyle = 'rgba(20,10,30,0.22)'; ctx.beginPath(); ctx.ellipse(10, 14, 10, 15, 0, 0, 7); ctx.fill(); } // flying: soft shadow far below
    else if (['bike', 'scooter', 'moto', 'dias'].includes(type)) { ctx.fillStyle = 'rgba(20,10,30,0.28)'; ctx.beginPath(); ctx.ellipse(2, 3, sw / 2 + 1, shh / 2, 0, 0, 7); ctx.fill(); }
    else { ctx.fillStyle = 'rgba(20,10,30,0.3)'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(-sw / 2 + 3, -shh / 2 + 4, sw, shh, 6); else ctx.rect(-sw / 2 + 3, -shh / 2 + 4, sw, shh); ctx.fill(); }
    const ps = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = true;
    if (ds) ctx.drawImage(ds, -sw / 2 - ds.ox, -shh / 2 - ds.oy, ds.lw, ds.lh); else ctx.drawImage(s, -sw / 2, -shh / 2, sw, shh);
    ctx.imageSmoothingEnabled = ps;
    if (type === 'heli') { // rotor
      ctx.rotate(G.t * 30); ctx.fillStyle = 'rgba(30,30,30,0.55)'; ctx.fillRect(-32, -2, 64, 4); ctx.fillRect(-2, -32, 4, 64);
    }
    if (extra === 'beacon') { // rotating orange beacon on the cab roof
      const by = -shh / 2 + 11.6, k = 0.5 + 0.5 * Math.sin(G.t * 9), g = ctx.createRadialGradient(0, by, 0, 0, by, 13);
      g.addColorStop(0, 'rgba(255,150,40,' + (0.18 + 0.4 * k).toFixed(3) + ')'); g.addColorStop(1, 'rgba(255,150,40,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, by, 13, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,226,150,' + (0.45 + 0.55 * k).toFixed(3) + ')'; ctx.beginPath(); ctx.arc(0, by, 1.5, 0, 7); ctx.fill();
    }
    if (extra === 'siren') { ctx.fillStyle = Math.floor(G.t * 8) % 2 ? 'rgba(80,120,255,0.45)' : 'rgba(255,60,60,0.45)'; ctx.beginPath(); ctx.arc(0, -2, 14, 0, 7); ctx.fill(); }
    ctx.restore();
  };

  // ================= LIME E-SCOOTER (3/4 view: deck on the ground, stem + handlebar up front, rider standing on it) =================
  G.drawLime = function (ctx, x, y, a, rider, moving) {
    const c = Math.cos(a), s = Math.sin(a), fx = c * 7.5, fy = s * 4.2;    // half deck, foreshortened in y
    const INK = 'rgba(28,20,36,0.85)', GREEN = '#2fbf4f';
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.fillStyle = 'rgba(20,10,30,0.28)'; ctx.beginPath(); ctx.ellipse(x + 2, y + 2, Math.abs(fx) + 4, Math.abs(fy) + 2.4, 0, 0, 7); ctx.fill();
    const bob = rider && moving ? Math.sin((G.t || 0) * 18) * 0.25 : 0;
    const stem = () => { // stem from the front wheel up to the handlebar (perpendicular to the heading)
      const sx = x + fx, sy = y + fy - 1, tx = sx - c * 1.2, ty = sy - 14 + bob, hx = -s * 4, hy = c * 1.6;
      ctx.strokeStyle = INK; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.strokeStyle = GREEN; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.strokeStyle = '#f2f2f2'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(sx - 0.2, sy - 4); ctx.lineTo(tx - 0.2, ty + 3); ctx.stroke();
      ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(tx - hx, ty - hy); ctx.lineTo(tx + hx, ty + hy); ctx.stroke();
      ctx.fillStyle = '#111'; for (const k of [-1, 1]) { ctx.beginPath(); ctx.arc(tx + hx * k, ty + hy * k, 0.9, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#fff7c0'; ctx.beginPath(); ctx.arc(tx + c * 0.8, ty + 2.5, 0.7, 0, 7); ctx.fill();   // headlight
    };
    // wheels + deck
    ctx.fillStyle = '#151515'; for (const k of [-1, 1]) { ctx.beginPath(); ctx.ellipse(x + fx * k, y + fy * k + 0.6, 1.9, 1.9, 0, 0, 7); ctx.fill(); }
    ctx.strokeStyle = INK; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.moveTo(x - fx * 0.85, y - fy * 0.85); ctx.lineTo(x + fx * 0.85, y + fy * 0.85); ctx.stroke();
    ctx.strokeStyle = '#3a3a3e'; ctx.lineWidth = 2.6; ctx.stroke();
    ctx.strokeStyle = GREEN; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(x - fx * 0.8, y - fy * 0.8 - 0.8); ctx.lineTo(x + fx * 0.8, y + fy * 0.8 - 0.8); ctx.stroke();
    const front = s > 0.25;   // handlebar nearer the camera than the rider
    if (!front) stem();
    if (rider) {
      const dir = Math.abs(c) > Math.abs(s) ? (c > 0 ? 2 : 1) : (s > 0 ? 0 : 3);
      ctx.restore(); G.drawPerson(ctx, rider, x - c * 1.5, y - s * 0.8 + 0.5, dir, 0, { lift: 1.6 + bob }); ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    }
    if (front) stem();
    ctx.restore();
  };

  const HELM = new WeakMap(), helmLook = lk => { let h = HELM.get(lk); if (!h) { h = { ...lk, hairStyle: 'buzz', acc: (lk.acc || []).filter(q => !/^(cap|beanie|monkhat|shades|glasses|thinglasses)/.test(q)) }; delete h._id; HELM.set(lk, h); } return h; };
  // ================= BICYCLE / MOTORBIKE / ΔΙΑΣ / VESPA (3/4 view like the Lime: wheels standing up, rider seated on top) =================
  // P(along, side, up): along = towards the nose, side = rider's right, up = height; y is foreshortened, lean rolls "up" towards "side"
  G.drawRide = function (ctx, type, col, x, y, a, rider, opts = {}) {
    const c = Math.cos(a), s = Math.sin(a), lean = G.clamp(opts.lean || 0, -0.35, 0.35), sl = Math.sin(lean), cl = Math.cos(lean), FY = 0.6;
    const P = (al, sd, up) => { const sd2 = sd + up * sl, up2 = up * cl; return [x + c * al - s * sd2, y + (s * al + c * sd2) * FY - up2]; };
    const INK = 'rgba(28,20,36,0.85)', moto = type === 'moto' || type === 'dias', vespa = type === 'scooter';
    const L = moto ? 9 : vespa ? 6.5 : 8.5, r = moto ? 3.6 : vespa ? 2.7 : 3.4;
    const body = type === 'dias' ? '#f4f4f4' : col, dark = G.shade(body, -0.35), lite = G.shade(body, 0.3);
    const line = (pts, w, cl2) => { ctx.strokeStyle = cl2; ctx.lineWidth = w; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke(); };
    const inked = (pts, w, cl2) => { line(pts, w + 0.9, INK); line(pts, w, cl2); };
    const blob = (pts, fill) => { ctx.fillStyle = fill; ctx.strokeStyle = INK; ctx.lineWidth = 0.6; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.fill(); ctx.stroke(); };
    const ring = (al, rad, k) => { const o = []; for (let i = 0; i <= 18; i++) { const t = i / 18 * Math.PI * 2; o.push(P(al + Math.cos(t) * rad * k, 0, r + Math.sin(t) * rad * k)); } return o; };
    const wheel = al => { // tyre (thick dark ring) + rim / hub
      line(ring(al, r, 1), moto ? 2.4 : vespa ? 2.2 : 1.5, '#161616');
      line(ring(al, r, moto ? 0.5 : 0.78), moto ? 1.1 : 0.5, moto ? '#9aa0a8' : '#c8ccd2');
      if (!moto && !vespa) { const h = P(al, 0, r); ctx.fillStyle = '#c8ccd2'; ctx.beginPath(); ctx.arc(h[0], h[1], 0.5, 0, 7); ctx.fill(); }
    };
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // ground shadow
    ctx.fillStyle = 'rgba(20,10,30,0.28)'; ctx.beginPath(); ctx.ellipse(x + 2, y + 2, Math.abs(c) * (L + r) + 3, Math.abs(s) * (L + r) * FY + 2.2, 0, 0, 7); ctx.fill();
    if (opts.siren) { ctx.fillStyle = Math.floor((G.t || 0) * 8) % 2 ? 'rgba(80,120,255,0.32)' : 'rgba(255,60,60,0.32)'; ctx.beginPath(); ctx.ellipse(x, y - 5, 12, 8, 0, 0, 7); ctx.fill(); }
    wheel(-L); wheel(L);
    const head = moto ? P(L * 0.62, 0, r + 7.5) : vespa ? P(L * 0.62, 0, r + 7) : P(L * 0.6, 0, r + 7);
    const front = () => { // fork, handlebar, headlight (drawn over the rider when the bike comes towards the camera)
      if (moto) inked([P(L, 0, r), head], 1.3, '#9aa0a8');
      else if (vespa) blob([P(L * 0.95, -1.6, r + 1.5), P(L * 0.95, 1.6, r + 1.5), P(L * 0.7, 1.4, r + 7), P(L * 0.7, -1.4, r + 7)], body);   // leg shield
      else inked([P(L, 0, r), head], 0.9, dark);
      const hl = P(L * 0.6, -(moto ? 4.2 : 3.6), r + (moto ? 8 : 7.6)), hr = P(L * 0.6, moto ? 4.2 : 3.6, r + (moto ? 8 : 7.6));
      inked([hl, head, hr], moto ? 1.1 : 0.8, '#2a2a2e');
      ctx.fillStyle = '#111'; for (const p of [hl, hr]) { ctx.beginPath(); ctx.arc(p[0], p[1], 0.8, 0, 7); ctx.fill(); }
      const lp = P(L * 0.85, 0, r + (moto ? 6 : vespa ? 5.5 : 5.5)); ctx.fillStyle = '#fff7c0'; ctx.strokeStyle = INK; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.arc(lp[0], lp[1], moto ? 1.2 : 0.8, 0, 7); ctx.fill(); ctx.stroke();
      if (type === 'dias') { // twin blue/red lights on the bars
        const on = Math.floor((G.t || 0) * 8) % 2; for (const [k, cb] of [[-1, on ? '#2d6bff' : '#8fb0ff'], [1, on ? '#ffb0b0' : '#ff2d2d']]) { const p = P(L * 0.55, k * 2.4, r + 9.2); ctx.fillStyle = cb; ctx.beginPath(); ctx.arc(p[0], p[1], 0.9, 0, 7); ctx.fill(); ctx.stroke(); }
      }
    };
    if (moto) { // engine + exhaust, tank, seat, tail
      inked([P(-L * 0.2, 0, r - 0.2), P(L * 0.3, 0, r + 0.4)], 3.4, '#3a3d44'); line([P(-L * 0.1, 0, r + 1), P(L * 0.25, 0, r + 1.4)], 0.8, '#6a6e76');
      inked([P(-L * 0.1, 2.4, r - 0.6), P(-L * 1.05, 2.4, r + 0.6)], 1.3, '#b8bec6');
      blob([P(-L * 0.95, -1.6, r + 2.4), P(-L * 0.2, -2.2, r + 3.4), P(-L * 0.2, 2.2, r + 3.4), P(-L * 0.95, 1.6, r + 2.4)], dark);    // tail / frame
      blob([P(-L * 0.75, -1.9, r + 4.3), P(-L * 0.05, -2.3, r + 4.6), P(-L * 0.05, 2.3, r + 4.6), P(-L * 0.75, 1.9, r + 4.3)], '#1e1e22'); // seat
      blob([P(L * 0.0, -2.6, r + 4.4), P(L * 0.55, -2, r + 5.6), P(L * 0.62, 0, r + 6.2), P(L * 0.55, 2, r + 5.6), P(L * 0.0, 2.6, r + 4.4), P(-L * 0.02, 0, r + 5.2)], body); // fuel tank
      const t1 = P(L * 0.12, -0.8, r + 5.4), t2 = P(L * 0.45, -0.6, r + 6); line([t1, t2], 0.7, lite);
      if (type === 'dias') line([P(L * 0.0, 2.65, r + 4.5), P(L * 0.5, 2.1, r + 5.4)], 0.9, '#1d3f8f');
      const tl = P(-L * 0.98, 0, r + 3); ctx.fillStyle = '#e8302a'; ctx.beginPath(); ctx.arc(tl[0], tl[1], 0.8, 0, 7); ctx.fill();
    } else if (vespa) { // round rear body, floorboard, seat
      blob([P(-L * 0.2, -1.6, r), P(L * 0.7, -1.6, r), P(L * 0.7, 1.6, r), P(-L * 0.2, 1.6, r)], '#3a3d44');
      blob([P(-L * 1.05, -2.6, r + 1), P(-L * 0.15, -2.6, r + 1.4), P(-L * 0.1, 0, r + 4.2), P(-L * 0.15, 2.6, r + 1.4), P(-L * 1.05, 2.6, r + 1), P(-L * 1.1, 0, r + 4)], body);
      blob([P(-L * 0.9, -1.6, r + 4.4), P(-L * 0.15, -1.8, r + 4.6), P(-L * 0.15, 1.8, r + 4.6), P(-L * 0.9, 1.6, r + 4.4)], '#2a2220');
    } else { // bicycle: thin coloured frame (rear triangle, top + down tube), saddle, pedals
      const rh = P(-L, 0, r), bb = P(-L * 0.05, 0, r - 0.4), st = P(-L * 0.32, 0, r + 6), dt = P(L * 0.56, 0, r + 4);
      inked([rh, st, bb, rh], 0.9, body); inked([st, head], 0.9, body); inked([bb, dt, head], 1, body);
      const pa = (G.t || 0) * (opts.moving ? 9 : 0), p1 = P(-L * 0.05 + Math.cos(pa) * 1.6, 1.6, r - 0.4 + Math.sin(pa) * 1.6), p2 = P(-L * 0.05 - Math.cos(pa) * 1.6, -1.6, r - 0.4 - Math.sin(pa) * 1.6);
      if (!rider) line([p1, p2], 0.8, '#2a2a2e');
      const sa = P(-L * 0.38, 0, r + 6.8); ctx.fillStyle = '#1e1e22'; ctx.strokeStyle = INK; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.ellipse(sa[0], sa[1], 1.6 + Math.abs(c) * 0.6, 1 + Math.abs(s) * 0.5, 0, 0, 7); ctx.fill(); ctx.stroke();
    }
    const toCam = s > 0.25;
    if (!toCam) front();
    if (rider) { // seated rider: legs to the pegs / pedals / floorboard, torso (sprite without legs) on the seat, rolled with the lean
      const dir = Math.abs(c) > Math.abs(s) * 0.8 ? (c > 0 ? 2 : 1) : (s > 0 ? 0 : 3), helm = moto;
      const lk = helm ? helmLook(rider) : rider, spr = G.personSprite(lk, dir, 0), CUT = 18.5;
      const sa = moto ? -L * 0.32 : vespa ? -L * 0.5 : -L * 0.34, su = (moto ? r + 4.4 : vespa ? r + 4.4 : r + 6.6) + (opts.moving ? Math.sin((G.t || 0) * 16) * 0.2 : 0);
      const pa = (G.t || 0) * (opts.moving ? 9 : 0);
      for (const k of [-1, 1]) {
        const hip = P(sa + 0.6, k * 1.7, su - 0.6);
        const foot = moto ? P(sa + L * 0.42, k * 3, r - 0.8) : vespa ? P(sa + L * 0.75, k * 1.5, r + 0.6) : P(-L * 0.05 + k * Math.cos(pa) * 1.6, k * 1.8, r - 0.4 + k * Math.sin(pa) * 1.6);
        const knee = moto ? P(sa + L * 0.55, k * 3, su + 0.3) : vespa ? P(sa + L * 0.62, k * 1.9, su + 0.4) : P(sa + L * 0.42, k * 2.1, (su + r) / 2 + 2);
        inked([hip, knee, foot], 2.1, lk.legs || '#2d3446');
        ctx.fillStyle = lk.shoes || '#222'; ctx.strokeStyle = INK; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.ellipse(foot[0] + c * 0.6, foot[1] + s * 0.4, 1.4, 1, 0, 0, 7); ctx.fill(); ctx.stroke();
      }
      const hp = P(sa, 0, su);
      ctx.save(); ctx.translate(hp[0], hp[1]); ctx.transform(1, 0, s * sl, cl - FY * c * sl, 0, 0); // roll about the heading axis
      const ps = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = true;
      ctx.drawImage(spr, 0, 0, spr.width, spr.height * CUT / 26, -9, -CUT + 0.8, 18, CUT);
      ctx.imageSmoothingEnabled = ps;
      if (helm) { // full helmet over the head (sprite head box: y 1.9..12.1, half width 5.1)
        const hy = -CUT + 0.8 + 6.6, hc = type === 'dias' ? '#f4f4f4' : rider.helmet || '#26262c';
        const hg = ctx.createRadialGradient(-2, hy - 3, 0.5, 0, hy, 7); hg.addColorStop(0, G.shade(hc, 0.35)); hg.addColorStop(1, G.shade(hc, -0.3));
        ctx.fillStyle = hg; ctx.strokeStyle = INK; ctx.lineWidth = 0.6;
        ctx.beginPath(); ctx.ellipse(0, hy, 5.9, 5.6, 0, Math.PI, 0); ctx.quadraticCurveTo(5.9, hy + 3.4, 4.6, hy + 3.6); ctx.lineTo(-4.6, hy + 3.6); ctx.quadraticCurveTo(-5.9, hy + 3.4, -5.9, hy); ctx.closePath(); ctx.fill(); ctx.stroke();
        if (dir !== 3) { const vx = dir === 2 ? 1.6 : dir === 1 ? -1.6 : 0; ctx.fillStyle = 'rgba(24,30,48,0.85)'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(vx - (dir ? 3.4 : 4.4), hy - 0.4, dir ? 6.8 : 8.8, 2.6, 1.2); else ctx.rect(vx - 4.4, hy - 0.4, 8.8, 2.6); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(vx - 2.6, hy - 0.1, 2.2, 0.6); }
        if (type === 'dias') { ctx.fillStyle = '#1d3f8f'; ctx.fillRect(-5.7, hy - 2.6, 11.4, 1.1); }
      }
      ctx.restore();
    }
    if (toCam) front();
    ctx.restore();
  };

  // ================= PRESET LOOKS (no names shown in game; keys are internal) =================
  G.LOOKS = {
    seraios:   { skin: '#d9a27a', hair: '#2a1d16', hairStyle: 'curly', top: '#6b6a3e', topStyle: 'tank', legs: '#3a3a3a', acc: ['shades', 'necklace'], held: 'axe' },
    protopsalti: { skin: '#e2b08c', hair: '#141414', hairStyle: 'curly', skirt: false, top: '#7a3fb0', top2: '#e8682a', topStyle: 'shirt', legs: '#151515', acc: ['earrings', 'lipstick'], held: 'mic', female: true },
    bassist:   { skin: '#d9a27a', hair: '#1a1410', hairStyle: 'curly_long', top: '#151515', topStyle: 'shirt', legs: '#151515', acc: ['beard'] },
    guitarist: { skin: '#e0b090', hair: '#1a1410', hairStyle: 'buzz', top: '#151515', topStyle: 'tank', legs: '#151515', acc: [] },
    gamath:    { skin: '#e0a882', hair: '#4a3a2a', hairStyle: 'balding', top: '#22408c', top2: '#f2c21b', topStyle: 'jacket', legs: '#3a2c22', acc: ['mask', 'strap'] },
    kados:     { skin: '#d9a27a', hair: '#ececec', hairStyle: 'afro', top: '#2a5bd7', top2: '#ffffff', topStyle: 'jersey', legs: '#1d1d1d', acc: [] },
    priest:    { skin: '#d9a27a', hair: '#141210', hairStyle: 'short', top: '#2a2420', topStyle: 'cassock', legs: '#111', acc: ['beard', 'beardLong', 'monkhat'], held: 'cross' },
    filos:     { skin: '#d49a72', hair: '#9a9a96', hairStyle: 'short', top: '#7a6b45', topStyle: 'camo', legs: '#3a3a2a', acc: ['mustache', 'cap:#2a2f2a'], held: 'phone' },
    cop_lera:  { skin: '#e0b090', hair: '#6a6a66', hairStyle: 'slick', top: '#16244a', topStyle: 'police', legs: '#16244a', acc: ['beardGrey', 'thinglasses'] },
    cop_agapi: { skin: '#e2a882', hair: '#141210', hairStyle: 'quiff', top: '#16244a', topStyle: 'police', legs: '#16244a', acc: ['shades', 'muscles'] },
    revive_m:  { skin: '#e2b090', hair: '#8a8a86', hairStyle: 'balding', top: '#1d2c5a', top2: '#ffffff', topStyle: 'suit', legs: '#1d2c5a', acc: ['glasses', 'beardGrey', 'tie:#1f3f9a'] },
    revive_f:  { skin: '#f0c8a8', hair: '#f0dc9a', hairStyle: 'bun', top: '#9fb3c8', topStyle: 'suit', top2: '#ffffff', legs: '#9fb3c8', acc: [], female: true },
    student:   { skin: '#e0b090', hair: '#141210', hairStyle: 'mullet', top: '#e02a1a', topStyle: 'tshirt', legs: '#2d3446', acc: [] },
    reporter:  { skin: '#f0c8a8', hair: '#6a3a1a', hairStyle: 'bob', top: '#c9374a', topStyle: 'suit', top2: '#ffffff', legs: '#222', skirt: true, acc: ['lipstick'], held: 'mic', female: true },
    cyclist:   { skin: '#e0b090', hair: '#3a2a1a', hairStyle: 'short', top: '#7cc8f0', top2: '#3a9ad8', topStyle: 'jersey', legs: '#7cc8f0', acc: ['cap:#d42a2a', 'shades'] }, // γαλάζια στολή, κόκκινο καπέλο
    shepherd:  { skin: '#c98c62', hair: '#555', hairStyle: 'short', top: '#2a2a33', topStyle: 'jacket', legs: '#2a2a2a', acc: ['beanie:#1e1e1e', 'mustache'], held: 'stick' },
    fd_bar:    { skin: '#d9a27a', hair: '#2a1d16', hairStyle: 'curly', top: '#f4f4f4', top2: '#111', topStyle: 'vest', legs: '#111', acc: ['beard'] },
    fd_host:   { skin: '#f0c8a8', hair: '#121212', hairStyle: 'long', top: '#f4f4f4', topStyle: 'shirt', top2: '#f4f4f4', legs: '#151515', skirt: true, acc: ['lipstick', 'gold'], female: true },
    fd_bubble_m: { skin: '#e2b48e', hair: '#e8d6a6', hairStyle: 'buzz', top: '#141414', topStyle: 'tshirt', legs: '#161616', acc: ['beard:#2a1d16', 'chain', 'tattoo', 'muscles'] },
    fd_bubble_f: { skin: '#f4d6c2', hair: '#efe8d8', hairStyle: 'bob', top: '#121214', topStyle: 'tank', legs: '#121214', shoes: '#111', acc: ['crossNeck', 'tattoo', 'leather', 'lipstick', 'earrings'], female: true },
    fd_waiter1:{ skin: '#e0b090', hair: '#6a6a66', hairStyle: 'bald', top: '#f4f4f4', top2: '#111', topStyle: 'vest', legs: '#111', acc: ['beardGrey'] },
    fd_waiter2:{ skin: '#f0c8a8', hair: '#3a2014', hairStyle: 'curly_long', top: '#f4f4f4', topStyle: 'shirt', top2: '#111', legs: '#151515', skirt: true, acc: ['lipstick'], female: true },
    ferrari_lady: { skin: '#f0c8a8', hair: '#f3dd8a', hairStyle: 'long', top: '#ff6fa3', topStyle: 'shirt', top2: '#fff', legs: '#111', skirt: true, acc: ['shades', 'gold', 'lipstick'], female: true },
    hipster:   { skin: '#f0c8a8', hair: '#8a5a2a', hairStyle: 'bun', top: '#b9a37a', topStyle: 'tshirt', legs: '#c9b48a', acc: ['beard', 'glasses', 'tote', 'crocs'] },
    hipster2:  { skin: '#e8b48a', hair: '#d07a3a', hairStyle: 'bob', top: '#8fb996', topStyle: 'hoodie', legs: '#e9dcc0', acc: ['glasses', 'tote', 'crocs'], female: true },
    homeless:  { skin: '#c98c62', hair: '#6a6a66', hairStyle: 'long', top: '#5a4a3a', topStyle: 'jacket', legs: '#3a3a3a', acc: ['beardGrey', 'beardLong'] },
    tourist:   { skin: '#f6c9b0', hair: '#e0c070', hairStyle: 'short', top: '#ff7a3a', topStyle: 'tshirt', legs: '#e9dcc0', acc: ['cap:#fff'] },
    rich:      { skin: '#f6c9b0', hair: '#e0c070', hairStyle: 'slick', top: '#ffffff', topStyle: 'shirt', top2: '#7ec8ff', legs: '#f4f4f4', acc: ['shades', 'gold'], held: 'champagne' },
    yiayia:    { skin: '#e0b090', hair: '#d8d8d8', hairStyle: 'bun', top: '#1c1c1c', topStyle: 'dress', legs: '#1c1c1c', acc: [], female: true },
    footballer_w: { skin: '#e0b090', hair: '#2a1d16', hairStyle: 'short', top: '#f4f4f4', topStyle: 'jersey', top2: '#ddd', legs: '#f4f4f4', acc: [] },
    footballer_y: { skin: '#d9a27a', hair: '#3a2a1a', hairStyle: 'buzz', top: '#ffd400', topStyle: 'jersey', top2: '#111', legs: '#ffd400', acc: [] },
    keeper:    { skin: '#e0b090', hair: '#1a1410', hairStyle: 'short', top: '#ff6a1a', topStyle: 'jersey', top2: '#111', legs: '#ff6a1a', acc: [] },
  };
  // random civilian
  const SKINS = ['#f0c8a8', '#e8b48a', '#d9a27a', '#c98c62', '#a8714a', '#7a4a2a'];
  const HAIRS = ['#141210', '#2b1d14', '#4a2e1a', '#7a5230', '#b08040', '#d8d8d8', '#9a9a96', '#e0c070'];
  const HS = ['short', 'short', 'buzz', 'curly', 'long', 'bob', 'bald', 'balding', 'ponytail', 'bun', 'slick'];
  const TOPS = ['#3a6ea5', '#c0392b', '#27ae60', '#8e44ad', '#f39c12', '#ecf0f1', '#2c3e50', '#16a085', '#d35400', '#7f8c8d', '#e84393', '#111'];
  const TS = ['tshirt', 'tshirt', 'shirt', 'jacket', 'hoodie', 'tank'];
  const TOPS_F = ['#e84393', '#ff6fa3', '#c0392b', '#f39c12', '#9b59b6', '#ffffff', '#1abc9c', '#f1c40f', '#ff8a5b'];
  const TOPS_M = ['#3a6ea5', '#2c3e50', '#27ae60', '#7f8c8d', '#111', '#16a085', '#8e5a2a', '#34495e', '#c0392b'];
  G.randomLook = function (opts = {}) {
    const female = opts.female != null ? opts.female : G.chance(0.5);
    if (female) return {
      skin: G.pick(SKINS), hair: G.pick(['#141210', '#2b1d14', '#4a2e1a', '#7a5230', '#b08040', '#e0c070', '#d07a3a', '#d8d8d8']),
      hairStyle: G.pick(['long', 'long', 'curly_long', 'ponytail', 'long']), top: G.pick(TOPS_F), topStyle: G.pick(['shirt', 'tshirt', 'tank']),
      legs: G.pick(['#2d3446', '#111', '#c0392b', '#3a5a8a', '#e9dcc0', '#8e44ad']), skirt: G.chance(0.7),
      shoes: G.pick(['#c0392b', '#111', '#e8e8e8', '#d4a017']), acc: G.chance(0.5) ? ['earrings', 'lipstick'] : ['lipstick'], female: true, ...opts,
    };
    return {
      skin: G.pick(SKINS), hair: G.pick(HAIRS), hairStyle: G.pick(['short', 'short', 'buzz', 'curly', 'bald', 'balding', 'slick', 'quiff']),
      top: G.pick(TOPS_M), topStyle: G.pick(TS), legs: G.pick(['#2d3446', '#1d1d1d', '#3a5a8a', '#6b5a45', '#d8d0c0']),
      shoes: G.pick(['#222', '#eee', '#5a3a20']), acc: G.chance(0.3) ? [G.pick(['beard', 'mustache', 'beardGrey'])] : G.chance(0.15) ? ['shades'] : [], female: false, ...opts,
    };
  };

  // ================= small UI glyphs =================
  G.drawStar = (ctx, x, y, filled) => {
    ctx.fillStyle = filled ? '#ffe14a' : 'rgba(0,0,0,0.35)';
    const p = [[3, 0], [4, 2], [6, 2], [4.5, 3.5], [5, 6], [3, 4.5], [1, 6], [1.5, 3.5], [0, 2], [2, 2]];
    ctx.beginPath(); p.forEach(([a, b], i) => i ? ctx.lineTo(x + a, y + b) : ctx.moveTo(x + a, y + b)); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = filled ? '#000' : 'rgba(255,255,255,0.6)'; ctx.lineWidth = 0.6; ctx.stroke();
  };
})();
