// GTA LUBEN — chibi flat-vector characters: big heads, flat fills + one shadow tone, silhouette outline.
// Overrides the old pixel renderer but keeps the same API and the same 18x26 logical box (feet at bottom centre).
'use strict';
(function () {
  const LW = 18, LH = 26;               // logical size of a person sprite
  const cache = new Map();

  G.hiCanvas = function (w, h, k = G.RS || 2) {
    const c = document.createElement('canvas'); c.width = Math.ceil(w * k); c.height = Math.ceil(h * k);
    const x = c.getContext('2d'); x.scale(k, k); c.lw = w; c.lh = h; return [c, x];
  };
  // draw an HD canvas at logical position (uses lw/lh if present)
  G.blit = (ctx, c, x, y) => ctx.drawImage(c, x, y, c.lw || c.width, c.lh || c.height);

  const sh = (c, f) => G.shade(c, f);
  // rounded rect path (arcTo, works everywhere)
  function rrp(x, px, py, w, h, r) { r = Math.max(0, Math.min(r, w / 2, h / 2)); x.moveTo(px + r, py); x.arcTo(px + w, py, px + w, py + h, r); x.arcTo(px + w, py + h, px, py + h, r); x.arcTo(px, py + h, px, py, r); x.arcTo(px, py, px + w, py, r); x.closePath(); }
  function rr(x, px, py, w, h, r) { x.beginPath(); rrp(x, px, py, w, h, r); }
  function vgrad(x, y0, y1, top, bottom) { const g = x.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, top); g.addColorStop(1, bottom); return g; }
  function hgrad(x, x0, x1, l, r) { const g = x.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, l); g.addColorStop(1, r); return g; }
  const INK = 'rgba(28,20,36,0.85)';
  const OUTLINE = '#1d1526';

  // Flat-vector chibi style: big head (~45% of the height), compact body, flat fills with ONE clean shadow tone
  // (light from the top-left), big glossy eyes, rosy cheeks, bold hair shapes. A single dark silhouette outline
  // is added around the whole sprite at the end so characters read on any ground.
  function drawPersonHD(look, dir, frame, k) {
    k = k || Math.max(3, (G.RS || 2) * 1.5);
    const [c, out] = G.hiCanvas(LW, LH, k);
    const [ic, x] = G.hiCanvas(LW, LH, k); // inner art, outlined at the end
    x.lineJoin = 'round'; x.lineCap = 'round';
    const acc = look.acc || [];
    const has = a => acc.some(s => s === a || s.startsWith(a + ':'));
    const accVal = a => { const s = acc.find(s => s.startsWith(a + ':')); return s ? s.split(':')[1] : null; };
    const fem = !!look.female, side = dir === 1 || dir === 2, back = dir === 3, front = !side && !back, flip = dir === 1;
    const skin = look.skin || '#e8b48a', hair = look.hair || '#2b1d14';
    const top = look.top || '#3a6ea5', top2 = look.top2 || sh(top, 0.35);
    const legs = look.legs || '#2d3446', shoes = has('crocs') ? null : (look.shoes || '#222');
    const hs = look.hairStyle || 'short';
    const ts = look.topStyle === 'tee' ? 'tshirt' : look.topStyle;
    const robe = ts === 'cassock' || ts === 'dress';
    const gown = ts === 'gown';
    const skirt = fem && (look.skirt || gown) && !robe;
    const step = frame === 1 ? 1 : frame === 2 ? -1 : 0;
    const cx = 9;
    if (flip) { x.translate(LW, 0); x.scale(-1, 1); }

    // fill a shape flat, with a single hard shadow crescent on the bottom-right
    const blob = (path, col, dx = -0.7, dy = -0.55, f = -0.24) => {
      x.fillStyle = sh(col, f); x.beginPath(); path(); x.fill();
      x.save(); x.beginPath(); path(); x.clip(); x.translate(dx, dy); x.fillStyle = col; x.beginPath(); path(); x.fill(); x.restore();
    };
    const line = (col, w) => { x.strokeStyle = col; x.lineWidth = w; };
    const circ = (px, py, r) => () => x.arc(px, py, r, 0, Math.PI * 2);
    const ell = (px, py, rx, ry, rot = 0) => () => x.ellipse(px, py, rx, ry, rot, 0, Math.PI * 2);
    const rrf = (px, py, w, h, r) => () => rrp(x, px, py, w, h, r);

    // ---------- head geometry ----------
    const hx = cx, HT = 1.9, HB = 12.1, HW = 5.1, hy = 7; // head box
    const bald = hs === 'bald' || hs === 'balding';
    const hasHat = !!(accVal('cap') || has('monkhat') || has('beanie'));
    const longHair = ['long', 'curly_long', 'mullet', 'afro'].includes(hs);
    const wavy = hs === 'curly_long' || hs === 'afro' || hs === 'curly';

    // bumpy cloud helper for curly hair
    const cloud = (pcx, pcy, rx, ry, r, n, from = 0, to = Math.PI * 2, ccw = false) => () => { // ccw must match the winding of the shape it is unioned with
      for (let i = 0; i <= n; i++) { const a = from + (to - from) * i / n; x.moveTo(pcx + Math.cos(a) * rx + r, pcy + Math.sin(a) * ry); x.arc(pcx + Math.cos(a) * rx, pcy + Math.sin(a) * ry, r, 0, Math.PI * 2, ccw); }
    };

    // ---------- hair BEHIND the head/body ----------
    const hairBehind = () => {
      if (hs === 'afro') { blob(() => { x.ellipse(hx, 5.6, 7.1, 5.6, 0, 0, 7); cloud(hx, 5.6, 6.0, 4.4, 1.9, 14)(); }, hair, -0.9, -0.7); return; }
      if (back) return; // from behind the mass is drawn over the head instead
      if (hs === 'long' || hs === 'curly_long') {
        if (front) blob(() => { rrp(x, hx - 6.1, 3, 12.2, 13.6, 4.5); if (wavy) cloud(hx, 16.2, 5.2, 0.4, 1.3, 5, 0, Math.PI)(); }, hair, -0.8, -0.6);
        else blob(() => { rrp(x, hx - 6.3, 2.6, 7.6, 14, 3.6); if (wavy) cloud(hx - 3.6, 9, 2.6, 6.5, 1.3, 8, Math.PI * 0.5, Math.PI * 1.5)(); }, hair, -0.8, -0.6);
      }
      if (hs === 'mullet') blob(side ? rrf(hx - 6, 4, 6, 10.2, 2.6) : rrf(hx - 5.9, 4, 11.8, 9.6, 3), hair);
      if (hs === 'bun') blob(side ? circ(hx - 4.2, 2.4, 2) : circ(hx, 1.9, 1.95), hair);
      if (hs === 'ponytail') {
        if (side) { blob(() => { x.moveTo(hx - 4.2, 4.2); x.quadraticCurveTo(hx - 8.4, 6, hx - 7.2, 13.4); x.quadraticCurveTo(hx - 6.4, 9, hx - 4.6, 8.4); x.closePath(); }, hair); }
        else blob(() => { x.moveTo(hx + 4.2, 3.6); x.quadraticCurveTo(hx + 8.2, 5.4, hx + 7.1, 12.4); x.quadraticCurveTo(hx + 6.4, 8.5, hx + 4.6, 7.8); x.closePath(); }, hair);
      }
    };

    // ---------- legs / lower body ----------
    const legTop = 17.4, legH = 6.0;
    const shoe = (sx, sy, sideways) => {
      if (!shoes) { x.fillStyle = sx < cx ? '#7ed957' : '#ff8fb1'; x.beginPath(); x.ellipse(sx, sy, sideways ? 2.1 : 1.9, 1.2, 0, 0, 7); x.fill(); x.fillStyle = 'rgba(255,255,255,0.5)'; x.beginPath(); x.arc(sx - 0.5, sy - 0.2, 0.3, 0, 7); x.arc(sx + 0.5, sy - 0.2, 0.3, 0, 7); x.fill(); return; }
      blob(() => x.ellipse(sideways ? sx + 0.5 : sx, sy, sideways ? 2.2 : 1.85, 1.25, 0, 0, 7), shoes, -0.4, -0.4, -0.3);
      x.fillStyle = 'rgba(255,255,255,0.28)'; x.beginPath(); x.ellipse((sideways ? sx + 0.5 : sx) - 0.6, sy - 0.5, 0.7, 0.3, 0, 0, 7); x.fill();
    };
    const drawLegs = () => {
      if (robe) {
        shoe(cx - 2, 24.6, side); shoe(cx + 2, 24.6, side);
        blob(() => { x.moveTo(cx - 3.8, 11.6); x.lineTo(cx + 3.8, 11.6); x.quadraticCurveTo(cx + 5.6, 18, cx + 5.6, 24.2); x.quadraticCurveTo(cx, 25, cx - 5.6, 24.2); x.quadraticCurveTo(cx - 5.6, 18, cx - 3.8, 11.6); x.closePath(); }, top, -1, 0, -0.22);
        line(sh(top, -0.3), 0.35); x.beginPath(); x.moveTo(cx - 1.6, 18); x.lineTo(cx - 2.2, 24); x.moveTo(cx + 1.8, 18); x.lineTo(cx + 2.4, 24); x.stroke();
        return;
      }
      const lw = skirt ? 2.1 : 2.6, lc = skirt ? skin : legs;
      const leg = (lx, lift, sideways) => {
        const ly = legTop - lift, h = legH;
        blob(rrf(lx, ly, lw, h, 1), lc, -0.5, 0, -0.2);
        shoe(lx + lw / 2, ly + h + 0.55, sideways);
      };
      if (side) { leg(cx - lw / 2 - step * 1.4, 0, true); leg(cx - lw / 2 + step * 1.4, 0, true); }
      else { leg(cx - 0.4 - lw, Math.max(0, step) * 0.9, false); leg(cx + 0.4, Math.max(0, -step) * 0.9, false); }
      if (!skirt) blob(side ? rrf(cx - 2.8, 16.2, 5.6, 3.2, 1.4) : rrf(cx - 3.6, 16.2, 7.2, 3.0, 1.2), legs, -0.5, 0, -0.2); // hips
      if (!skirt && has('leather')) { x.fillStyle = 'rgba(255,255,255,0.35)'; for (const lx of side ? [cx - 1] : [cx - 2.6, cx + 1.1]) { rr(x, lx, 16.8, 0.8, 5.6, 0.4); x.fill(); } }
      if (skirt) {
        const sc = gown ? top : legs, sy = gown ? 23.8 : 21.0, w0 = side ? 2.8 : 3.3, w1 = gown ? (side ? 4.4 : 5.6) : (side ? 3.7 : 4.7);
        blob(() => { x.moveTo(cx - w0, 15.8); x.lineTo(cx + w0, 15.8); x.quadraticCurveTo(cx + w1 - 0.3, sy - 2.5, cx + w1, sy); x.quadraticCurveTo(cx, sy + 0.9, cx - w1, sy); x.quadraticCurveTo(cx - w1 + 0.3, sy - 2.5, cx - w0, 15.8); x.closePath(); }, sc, -1.1, 0, -0.22);
        line(sh(sc, -0.3), 0.3); x.beginPath(); x.moveTo(cx - 1, 17); x.lineTo(cx - 1.6, sy - 0.3); x.moveTo(cx + 1.4, 17); x.lineTo(cx + 2, sy - 0.2); x.stroke();
      }
    };

    // ---------- torso ----------
    const ty = 11.3, th = 6.9;
    const tw = side ? 5.6 : (fem ? 7.2 : 8.4), tx = cx - tw / 2;
    const sleeveless = ts === 'tank' || ts === 'gown';
    const shortSleeve = ts === 'tshirt' || ts === 'jersey' || !ts;
    const sleeve = sleeveless ? skin : top;
    const armW = has('muscles') ? 3.0 : 2.3, armL = 4.9;
    // arm hanging from shoulder (sx, sy), rotated by a (radians); returns the hand position
    const arm = (sx, sy, a, dark) => {
      x.save(); x.translate(sx, sy); x.rotate(a);
      const col = dark ? sh(sleeve, -0.18) : sleeve;
      blob(rrf(-armW / 2, -0.4, armW, armL, armW / 2), col, -0.5, 0, -0.22);
      if (shortSleeve && !sleeveless) { x.save(); x.beginPath(); rrp(x, -armW / 2, -0.4, armW, armL, armW / 2); x.clip(); x.fillStyle = dark ? sh(skin, -0.15) : skin; x.fillRect(-armW, 2.2, armW * 2, armL); x.fillStyle = sh(skin, -0.25); x.fillRect(armW / 2 - 0.5, 2.2, 1, armL); x.restore(); }
      line(sh(col, -0.38), 0.28); x.beginPath(); rrp(x, -armW / 2, -0.4, armW, armL, armW / 2); x.stroke();
      if (has('tattoo') && (sleeveless || shortSleeve)) { // ink on the bare part of the arm
        const y0 = sleeveless ? 0.6 : 2.6; line('rgba(30,34,44,0.8)', 0.32); x.beginPath();
        x.moveTo(-armW / 2 + 0.4, y0); x.quadraticCurveTo(armW / 2, y0 + 0.8, -armW / 2 + 0.5, y0 + 1.6); x.quadraticCurveTo(armW / 2 - 0.2, y0 + 2.4, -0.2, armL - 0.6);
        x.moveTo(armW / 2 - 0.4, y0 + 0.3); x.lineTo(armW / 2 - 0.7, y0 + 1.4); x.stroke();
      }
      blob(circ(0, armL + 0.2, 1.3), dark ? sh(skin, -0.15) : skin, -0.4, -0.4, -0.2);
      x.restore();
      return [sx - Math.sin(a) * (armL + 0.2), sy + Math.cos(a) * (armL + 0.2)];
    };
    let hand = [cx + 6, 17.3];
    const drawTorso = () => {
      if (side) arm(cx + 0.2, ty + 0.9, step * 0.42, true); // far arm, behind the body
      if (!robe) {
        if (fem && !side) blob(() => { x.moveTo(tx + 1.2, ty); x.lineTo(tx + tw - 1.2, ty); x.quadraticCurveTo(tx + tw, ty, tx + tw, ty + 1.4); x.quadraticCurveTo(tx + tw - 0.2, ty + 3.6, tx + tw - 0.9, ty + 4.7); x.quadraticCurveTo(tx + tw + 0.1, ty + 5.8, tx + tw + 0.1, ty + th); x.lineTo(tx - 0.1, ty + th); x.quadraticCurveTo(tx - 0.1, ty + 5.8, tx + 0.9, ty + 4.7); x.quadraticCurveTo(tx + 0.2, ty + 3.6, tx, ty + 1.4); x.quadraticCurveTo(tx, ty, tx + 1.2, ty); x.closePath(); }, top, -1.1, -0.4);
        else blob(rrf(tx, ty, tw, th, side ? 2 : 2.4), top, -1.1, -0.4);
      }
      if (fem && side && !back) blob(ell(tx + tw - 0.3, ty + 2.9, 1.2, 1.25), top, -0.4, -0.4);
      const T = robe ? top : top;
      if (front) {
        switch (ts) {
          case 'shirt': x.fillStyle = top2; x.beginPath(); x.moveTo(cx - 2.1, ty + 0.2); x.lineTo(cx - 0.2, ty + 2.4); x.lineTo(cx - 0.9, ty + 0.2); x.moveTo(cx + 2.1, ty + 0.2); x.lineTo(cx + 0.2, ty + 2.4); x.lineTo(cx + 0.9, ty + 0.2); x.fill(); x.fillStyle = sh(top, -0.35); for (let i = 0; i < 3; i++) { x.beginPath(); x.arc(cx, ty + 3.2 + i * 1.3, 0.3, 0, 7); x.fill(); } break;
          case 'suit': x.fillStyle = top2; x.beginPath(); x.moveTo(cx - 2, ty); x.lineTo(cx, ty + 4.2); x.lineTo(cx + 2, ty); x.fill(); line(sh(top, -0.45), 0.35); x.beginPath(); x.moveTo(cx - 2.3, ty + 0.2); x.lineTo(cx - 0.2, ty + 4.6); x.moveTo(cx + 2.3, ty + 0.2); x.lineTo(cx + 0.2, ty + 4.6); x.stroke(); x.fillStyle = sh(top, -0.45); x.beginPath(); x.arc(cx, ty + 5.4, 0.32, 0, 7); x.fill(); { const tie = accVal('tie'); if (tie) { x.fillStyle = tie; x.beginPath(); x.moveTo(cx - 0.6, ty + 0.6); x.lineTo(cx + 0.6, ty + 0.6); x.lineTo(cx + 0.8, ty + 3.6); x.lineTo(cx, ty + 4.5); x.lineTo(cx - 0.8, ty + 3.6); x.fill(); } } break;
          case 'jacket': line(sh(top, -0.45), 0.4); x.beginPath(); x.moveTo(cx, ty + 1.2); x.lineTo(cx, ty + th); x.stroke(); x.fillStyle = top2; rr(x, tx + 0.8, ty - 0.1, tw - 1.6, 1.3, 0.6); x.fill(); x.fillStyle = sh(top, -0.3); rr(x, tx + 0.9, ty + 4.2, 2, 1.2, 0.4); x.fill(); rr(x, tx + tw - 2.9, ty + 4.2, 2, 1.2, 0.4); x.fill(); break;
          case 'jersey': x.fillStyle = top2; x.fillRect(tx + 0.3, ty + 2.6, tw - 0.6, 1.1); x.font = 'bold 2.6px sans-serif'; x.textAlign = 'center'; x.fillText(look.num || '10', cx, ty + 6.4); break;
          case 'police': x.fillStyle = '#1b1c22'; rr(x, tx + 0.8, ty + 0.8, tw - 1.6, th - 1.6, 1.3); x.fill(); x.fillStyle = '#34353f'; rr(x, tx + 1.6, ty + 1.8, 2, 1.4, 0.4); x.fill(); rr(x, tx + tw - 3.6, ty + 1.8, 2, 1.4, 0.4); x.fill(); x.fillStyle = '#f2c94c'; x.beginPath(); x.arc(cx + 1.6, ty + 4.2, 0.6, 0, 7); x.fill(); x.fillStyle = '#e8e8e8'; x.font = 'bold 1.5px sans-serif'; x.textAlign = 'center'; x.fillText('ΕΛ.ΑΣ', cx - 0.6, ty + 5.9); break;
          case 'hoodie': x.fillStyle = sh(top, -0.22); rr(x, cx - 2.2, ty + 3.8, 4.4, 2.2, 1); x.fill(); line('#f4f4f4', 0.3); x.beginPath(); x.moveTo(cx - 0.8, ty + 0.4); x.lineTo(cx - 0.9, ty + 2.6); x.moveTo(cx + 0.8, ty + 0.4); x.lineTo(cx + 0.9, ty + 2.6); x.stroke(); break;
          case 'vest': x.fillStyle = '#16161a'; x.beginPath(); x.moveTo(tx + 0.3, ty + 0.4); x.lineTo(cx - 0.7, ty + 3); x.lineTo(cx - 0.4, ty + th - 0.3); x.lineTo(tx + 0.3, ty + th - 0.3); x.fill(); x.beginPath(); x.moveTo(tx + tw - 0.3, ty + 0.4); x.lineTo(cx + 0.7, ty + 3); x.lineTo(cx + 0.4, ty + th - 0.3); x.lineTo(tx + tw - 0.3, ty + th - 0.3); x.fill(); x.fillStyle = top2 === '#111' ? '#111' : top2; x.beginPath(); x.moveTo(cx - 0.9, ty + 0.2); x.lineTo(cx, ty + 1.1); x.lineTo(cx + 0.9, ty + 0.2); x.lineTo(cx, ty + 1.8); x.fill(); break;
          case 'camo': for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? sh(top, -0.35) : sh(top, 0.25); rr(x, tx + 0.4 + (i * 2.7) % (tw - 2), ty + 0.6 + (i * 1.9) % (th - 2), 2.2, 1.3, 0.6); x.fill(); } break;
          case 'tank': x.fillStyle = skin; x.beginPath(); x.ellipse(cx, ty, 2.2, 1.6, 0, 0, Math.PI); x.fill(); break;
          case 'gown': x.fillStyle = skin; x.beginPath(); x.moveTo(tx + 0.9, ty); x.lineTo(tx + tw - 0.9, ty); x.quadraticCurveTo(cx + 1.2, ty + 2.4, cx, ty + 1.7); x.quadraticCurveTo(cx - 1.2, ty + 2.4, tx + 0.9, ty); x.fill(); x.fillStyle = '#f2c94c'; x.fillRect(tx + 0.9, ty + 4.5, tw - 1.8, 0.7); break;
          case 'cassock': x.fillStyle = sh(top, -0.35); for (let i = 0; i < 4; i++) { x.beginPath(); x.arc(cx, ty + 1.5 + i * 1.6, 0.28, 0, 7); x.fill(); } break;
          case 'dress': x.fillStyle = sh(top, 0.15); x.beginPath(); x.ellipse(cx, ty + 0.4, 2, 1, 0, 0, Math.PI); x.fill(); break;
          default: x.fillStyle = sh(top, -0.2); x.beginPath(); x.ellipse(cx, ty + 0.2, 2, 1.1, 0, 0, Math.PI); x.fill();
        }
        if (fem && !robe && ts !== 'police') { line(sh(top, -0.35), 0.3); x.beginPath(); x.arc(cx - 1.5, ty + 2.6, 1.4, 0.5, Math.PI - 0.5); x.stroke(); x.beginPath(); x.arc(cx + 1.5, ty + 2.6, 1.4, 0.5, Math.PI - 0.5); x.stroke(); }
      }
      if (back && (ts === 'police')) { x.fillStyle = '#1b1c22'; rr(x, tx + 0.8, ty + 0.8, tw - 1.6, th - 1.6, 1.3); x.fill(); }
      if (back && ts === 'jersey') { x.fillStyle = top2; x.font = 'bold 3.2px sans-serif'; x.textAlign = 'center'; x.fillText(look.num || '10', cx, ty + 5.4); }
      if (has('apron') && !back) { x.fillStyle = '#f4f4f4'; rr(x, tx + 0.8, ty + 2.6, tw - 1.6, 6, 1); x.fill(); }
      if (has('strap') && front) { line('#1b1b1b', 0.8); x.beginPath(); x.moveTo(tx + 1, ty + 0.2); x.lineTo(tx + tw - 0.8, ty + th - 0.8); x.stroke(); }
      if (has('necklace') && front) { line('#d6402f', 0.55); x.beginPath(); x.arc(cx, ty - 0.2, 2.3, 0.45, Math.PI - 0.45); x.stroke(); }
      if (has('gold') && front) { line('#f2c94c', 0.6); x.beginPath(); x.arc(cx, ty - 0.1, 2.6, 0.35, Math.PI - 0.35); x.stroke(); x.fillStyle = '#f2c94c'; x.beginPath(); x.arc(cx, ty + 2.5, 0.55, 0, 7); x.fill(); }
      { const sc = accVal('scarf'); if (sc && !back) {
        blob(() => rrp(x, tx + 0.6, ty - 0.9, tw - 1.2, 1.9, 0.9), sc, -0.3, -0.3);
        if (front) for (const ex of [cx - 1.9, cx + 0.5]) { blob(() => rrp(x, ex, ty + 0.4, 1.4, 5.4, 0.4), sc, -0.3, 0); x.fillStyle = '#141414'; x.fillRect(ex, ty + 2.2, 1.4, 0.6); x.fillRect(ex, ty + 3.8, 1.4, 0.6); }
      } }
      if (has('chain') && front) { line('#d8dce4', 0.35); x.beginPath(); x.arc(cx, ty - 0.6, 2.8, 0.3, Math.PI - 0.3); x.stroke(); }
      if (has('crossNeck') && front) { line('#f2c94c', 0.3); x.beginPath(); x.arc(cx, ty - 0.4, 2.2, 0.4, Math.PI - 0.4); x.stroke(); x.fillStyle = '#f2c94c'; x.fillRect(cx - 0.18, ty + 1.4, 0.36, 1.3); x.fillRect(cx - 0.5, ty + 1.75, 1, 0.32); }
      if (has('leather') && !robe) {
        x.fillStyle = 'rgba(255,255,255,0.32)'; rr(x, tx + 1, ty + 0.9, 1.1, th - 2.4, 0.5); x.fill();
        if (back) { line('#c9c9d2', 0.25); x.beginPath(); for (let i = 0; i < 4; i++) { const yy = ty + 1.3 + i * 1.3; x.moveTo(cx - 0.9, yy); x.lineTo(cx + 0.9, yy + 0.9); x.moveTo(cx + 0.9, yy); x.lineTo(cx - 0.9, yy + 0.9); } x.stroke(); }
      }
      // arms
      if (side) hand = arm(cx - 0.2, ty + 0.9, -step * 0.42, false);
      else {
        const sway = step * 0.35, sp = fem ? 0.05 : 0.09;
        const hl = arm(tx - armW / 2 + 0.35, ty + 0.9 + Math.max(0, -step) * 0.4, sp + (back ? -sway : sway) * 0.4, false);
        hand = arm(tx + tw + armW / 2 - 0.35, ty + 0.9 + Math.max(0, step) * 0.4, -sp + (back ? sway : -sway) * 0.4, false);
        if (back) hand = hl;
      }
      if (has('tote') && !back) { const bx = side ? cx + 0.6 : tx + tw - 0.4; line('#c9b892', 0.4); x.beginPath(); x.moveTo(bx + 0.5, ty + 0.6); x.lineTo(bx + 0.8, ty + 3); x.moveTo(bx + 2.2, ty + 0.6); x.lineTo(bx + 2.3, ty + 3); x.stroke(); blob(rrf(bx, ty + 3, 3.2, 4.2, 0.6), '#e9dcc0', -0.4, -0.3); }
    };

    // ---------- head ----------
    const ears = () => {
      if (side) return;
      blob(circ(hx - HW + 0.1, 7.9, 1.05), skin, -0.3, -0.3, -0.2); blob(circ(hx + HW - 0.1, 7.9, 1.05), skin, -0.3, -0.3, -0.2);
    };
    const headPath = () => rrp(x, hx - HW, HT, HW * 2, HB - HT, 4.6);
    const drawHead = () => {
      ears();
      blob(headPath, skin, -1.0, -0.8, -0.16);
      if (side) blob(circ(hx - 1.0, 8.0, 1.05), skin, -0.3, -0.3, -0.2);
    };

    const darkEye = '#241a2c';
    const eyeY = 7.6, browY = 5.75;
    const drawFace = () => {
      if (back) return;
      const ec = side ? [hx + 2.7] : [hx - 2.2, hx + 2.2];
      const eR = fem ? [0.85, 1.2] : [0.78, 1.08];
      // cheeks
      x.fillStyle = fem ? 'rgba(255,96,110,0.42)' : 'rgba(240,96,96,0.26)';
      if (side) { x.beginPath(); x.ellipse(hx + 2.4, 9.4, 0.95, 0.55, 0, 0, 7); x.fill(); }
      else { x.beginPath(); x.ellipse(hx - 3.3, 9.3, 0.95, 0.58, 0, 0, 7); x.ellipse(hx + 3.3, 9.3, 0.95, 0.58, 0, 0, 7); x.fill(); }
      const covered = has('shades');
      if (!covered) for (const ex of ec) {
        x.fillStyle = darkEye; x.beginPath(); x.ellipse(ex, eyeY, eR[0], eR[1], 0, 0, 7); x.fill();
        x.fillStyle = '#fff'; x.beginPath(); x.arc(ex - 0.28, eyeY - 0.42, 0.34, 0, 7); x.fill();
        x.fillStyle = 'rgba(255,255,255,0.6)'; x.beginPath(); x.arc(ex + 0.3, eyeY + 0.45, 0.15, 0, 7); x.fill();
        if (fem) { // lashes: a flick at the outer corner
          line(darkEye, 0.38); const o = side ? 1 : (ex < hx ? -1 : 1);
          x.beginPath(); x.moveTo(ex + o * 0.55, eyeY - 0.85); x.lineTo(ex + o * 1.25, eyeY - 1.35); x.moveTo(ex + o * 0.8, eyeY - 0.5); x.lineTo(ex + o * 1.45, eyeY - 0.75); x.stroke();
        }
      }
      // nose (side only) + mouth
      if (side) { blob(circ(hx + HW - 0.05, 8.7, 0.7), skin, -0.25, -0.25, -0.2); }
      else { x.fillStyle = sh(skin, -0.2); x.beginPath(); x.ellipse(hx, 8.75, 0.45, 0.3, 0, 0, 7); x.fill(); }
      if (!has('mask')) {
        const lipC = has('lipstick') ? '#c8142e' : '#d65a6c';
        if (fem) { x.fillStyle = lipC; x.beginPath(); if (side) x.ellipse(hx + 3.9, 10.05, 0.55, 0.42, 0, 0, 7); else x.ellipse(hx, 10.0, 0.82, 0.48, 0, 0, 7); x.fill(); x.fillStyle = 'rgba(255,255,255,0.45)'; x.beginPath(); x.arc(side ? hx + 3.8 : hx - 0.3, 9.85, 0.18, 0, 7); x.fill(); }
        else { line(sh(skin, -0.5), 0.42); x.beginPath(); if (side) { x.moveTo(hx + 3.3, 9.9); x.quadraticCurveTo(hx + 3.9, 10.3, hx + 4.4, 9.8); } else { x.moveTo(hx - 0.85, 9.8); x.quadraticCurveTo(hx, 10.5, hx + 0.85, 9.8); } x.stroke(); }
      }
    };
    const facial = () => { // beards / masks / glasses (on top of hair edge as needed)
      if (back) return;
      const bc = has('beardGrey') ? '#a9a8a2' : (accVal('beard') || hair);
      if (!fem && (has('beard') || has('beardGrey') || has('beardLong'))) {
        if (side) blob(() => { x.moveTo(hx - 1.6, 6.2); x.lineTo(hx - 0.4, 6.2); x.quadraticCurveTo(hx + 0.6, 9.4, hx + 3, 9.2); x.lineTo(hx + 5.2, 9.4); x.quadraticCurveTo(hx + 5.2, 12.6, hx + 2.2, 12.8); x.quadraticCurveTo(hx - 1.6, 12.6, hx - 1.6, 9); x.closePath(); }, bc, -0.5, -0.4);
        else blob(() => { x.moveTo(hx - HW - 0.1, 6.2); x.lineTo(hx - HW + 1.2, 6.2); x.quadraticCurveTo(hx - 3.6, 9.2, hx - 1.4, 9.1); x.lineTo(hx + 1.4, 9.1); x.quadraticCurveTo(hx + 3.6, 9.2, hx + HW - 1.2, 6.2); x.lineTo(hx + HW + 0.1, 6.2); x.quadraticCurveTo(hx + HW + 0.3, 12.9, hx, 13.1); x.quadraticCurveTo(hx - HW - 0.3, 12.9, hx - HW - 0.1, 6.2); x.closePath(); }, bc, -0.6, -0.5);
        if (has('beardLong')) blob(() => { if (side) { x.moveTo(hx - 0.5, 12); x.quadraticCurveTo(hx + 3, 18.4, hx + 4.4, 11.4); } else { x.moveTo(hx - 3.4, 12); x.quadraticCurveTo(hx, 19.2, hx + 3.4, 12); } x.closePath(); }, bc, -0.6, -0.4);
        x.fillStyle = sh(skin, -0.45); x.beginPath(); if (side) x.ellipse(hx + 3.9, 10.3, 0.5, 0.3, 0, 0, 7); else x.ellipse(hx, 10.3, 0.75, 0.35, 0, 0, 7); x.fill();
      }
      if (!fem && has('mustache')) { blob(() => { if (side) x.ellipse(hx + 4, 9.5, 1.3, 0.55, -0.2, 0, 7); else { x.ellipse(hx - 1.1, 9.45, 1.35, 0.6, 0.25, 0, 7); x.ellipse(hx + 1.1, 9.45, 1.35, 0.6, -0.25, 0, 7); } }, has('beardGrey') ? '#a9a8a2' : hair, -0.3, -0.3); }
      if (has('mole')) { x.fillStyle = '#3a2418'; x.beginPath(); if (side) x.arc(hx + 4.5, 9.0, 0.42, 0, 7); else x.arc(hx + 1.75, 9.15, 0.42, 0, 7); x.fill(); }
      if (has('mask')) { line('#e8e8e8', 0.25); x.beginPath(); x.moveTo(hx - HW + 0.4, 8.8); x.lineTo(hx - HW - 0.2, 7.6); x.moveTo(hx + HW - 0.4, 8.8); x.lineTo(hx + HW + 0.2, 7.6); x.stroke(); blob(side ? rrf(hx + 0.8, 8.3, 4.7, 3.3, 1.4) : rrf(hx - 4.4, 8.4, 8.8, 3.3, 1.5), '#5b8fd6', -0.4, -0.3); line('#3e6fb4', 0.25); x.beginPath(); x.moveTo(side ? hx + 1.2 : hx - 3.6, 9.5); x.lineTo(side ? hx + 5.2 : hx + 3.6, 9.5); x.moveTo(side ? hx + 1.2 : hx - 3.6, 10.5); x.lineTo(side ? hx + 5.2 : hx + 3.6, 10.5); x.stroke(); }
      if (has('shades')) {
        x.fillStyle = '#121218';
        if (side) { rr(x, hx + 1.4, 6.5, 3.6, 2.2, 0.9); x.fill(); line('#121218', 0.45); x.beginPath(); x.moveTo(hx + 1.6, 7.1); x.lineTo(hx - 0.9, 7.4); x.stroke(); }
        else { rr(x, hx - 4.3, 6.4, 3.8, 2.4, 1); x.fill(); rr(x, hx + 0.5, 6.4, 3.8, 2.4, 1); x.fill(); x.fillRect(hx - 0.6, 6.7, 1.2, 0.5); }
        x.fillStyle = 'rgba(150,215,255,0.85)'; const sx0 = side ? [hx + 2] : [hx - 3.7, hx + 1.1];
        for (const s of sx0) { x.beginPath(); x.moveTo(s, 7.6); x.lineTo(s + 0.8, 6.8); x.lineTo(s + 1.4, 6.8); x.lineTo(s + 0.6, 7.6); x.fill(); }
      }
      if (has('glasses') || has('thinglasses')) {
        line(has('glasses') ? '#18141c' : '#8e8e96', has('glasses') ? 0.5 : 0.32);
        if (side) { x.beginPath(); x.arc(hx + 2.8, eyeY, 1.45, 0, 7); x.stroke(); x.beginPath(); x.moveTo(hx + 1.35, eyeY - 0.3); x.lineTo(hx - 0.9, eyeY - 0.1); x.stroke(); }
        else { x.beginPath(); x.arc(hx - 2.2, eyeY, 1.5, 0, 7); x.stroke(); x.beginPath(); x.arc(hx + 2.2, eyeY, 1.5, 0, 7); x.stroke(); x.beginPath(); x.moveTo(hx - 0.7, eyeY - 0.2); x.lineTo(hx + 0.7, eyeY - 0.2); x.stroke(); }
        x.fillStyle = 'rgba(255,255,255,0.35)'; for (const ex of side ? [hx + 2.8] : [hx - 2.2, hx + 2.2]) { x.beginPath(); x.arc(ex + 0.5, eyeY - 0.6, 0.35, 0, 7); x.fill(); }
      }
      if (has('earrings')) { x.fillStyle = '#f2c94c'; x.beginPath(); if (side) { if (!longHair && hs !== 'bob') x.arc(hx - 1, 9.6, 0.6, 0, 7); } else { x.arc(hx - HW + 0.1, 9.5, 0.6, 0, 7); x.arc(hx + HW - 0.1, 9.5, 0.6, 0, 7); } x.fill(); }
    };
    const brows = () => {
      if (back || has('shades')) return;
      const bcol = bald ? sh(skin, -0.45) : sh(hair, hair.toLowerCase() > '#a' ? -0.35 : -0.15);
      line(bcol, fem ? 0.45 : 0.75);
      x.beginPath();
      if (side) { if (fem) { x.moveTo(hx + 1.9, browY + 0.2); x.quadraticCurveTo(hx + 2.8, browY - 0.5, hx + 3.6, browY); } else { x.moveTo(hx + 1.8, browY); x.lineTo(hx + 3.6, browY - 0.1); } }
      else if (fem) { x.moveTo(hx - 3.1, browY + 0.3); x.quadraticCurveTo(hx - 2.3, browY - 0.5, hx - 1.4, browY); x.moveTo(hx + 3.1, browY + 0.3); x.quadraticCurveTo(hx + 2.3, browY - 0.5, hx + 1.4, browY); }
      else { x.moveTo(hx - 3.1, browY - 0.1); x.lineTo(hx - 1.3, browY + 0.25); x.moveTo(hx + 3.1, browY - 0.1); x.lineTo(hx + 1.3, browY + 0.25); }
      x.stroke();
    };

    // ---------- hair on the head ----------
    const shine = (px, py, w) => { line(sh(hair, 0.35), 0.4); x.beginPath(); x.moveTo(px, py + 0.4); x.quadraticCurveTo(px + w / 2, py - 0.3, px + w, py + 0.1); x.stroke(); };
    // crown over the top of the head, sides down to sideY, fringe given as points from right to left
    const crown = (sideY, pts, soft, lift = 0) => () => {
      x.moveTo(hx - HW - 0.4, sideY); x.bezierCurveTo(hx - HW - 0.9, -0.9 - lift, hx + HW + 0.9, -0.9 - lift, hx + HW + 0.4, sideY);
      if (soft) { for (let i = 0; i < pts.length - 1; i++) { const [ax, ay] = pts[i], [bx, by] = pts[i + 1]; x.quadraticCurveTo(ax, ay, (ax + bx) / 2, (ay + by) / 2); } const l = pts[pts.length - 1]; x.lineTo(l[0], l[1]); }
      else for (const [px, py] of pts) x.lineTo(px, py);
      x.closePath();
    };
    const spiky = sideY => crown(sideY, [[hx + HW - 0.2, 4.4], [hx + 3.1, 5.0], [hx + 1.9, 3.8], [hx + 0.4, 4.8], [hx - 1.2, 3.7], [hx - 2.8, 4.7], [hx - HW + 0.2, 4.1], [hx - HW - 0.4, sideY]], false);
    const swept = (sideY) => crown(sideY, [[hx + HW + 0.4, sideY], [hx + HW - 0.2, 3.8], [hx + 1.2, 3.4], [hx - 2.6, 4.6], [hx - HW + 0.4, 6.4], [hx - HW - 0.4, sideY]], true);
    const smooth = (sideY, y) => crown(sideY, [[hx + HW + 0.4, sideY], [hx + HW - 0.4, y + 0.6], [hx, y - 0.6], [hx - HW + 0.4, y + 0.6], [hx - HW - 0.4, sideY]], true);
    const sideCap = (backBottom, frontY, opts = {}) => () => { // facing right: covers the top and the back of the head
      const bx = hx - HW - (opts.wide || 0.5);
      x.moveTo(hx + HW + 0.3, frontY); x.bezierCurveTo(hx + HW + 0.8, -0.9, bx - 0.6, -0.9, bx, 4.6);
      x.lineTo(bx, backBottom - 1); x.quadraticCurveTo(bx, backBottom, bx + 1.4, backBottom);
      if (opts.longFront) { x.lineTo(hx - 1.6, backBottom); x.lineTo(hx - 1.8, 6.6); } else { x.lineTo(hx - 2.6, Math.min(backBottom - 0.3, 9.4)); x.quadraticCurveTo(hx - 2.2, 6.6, hx - 1.2, 6.2); } x.quadraticCurveTo(hx + 0.6, 4.4, hx + 2.4, opts.fringeY || frontY + 0.3); x.quadraticCurveTo(hx + 4, frontY + 0.8, hx + HW + 0.3, frontY); x.closePath();
    };
    const drawHair = () => {
      if (hs === 'bald') { x.fillStyle = 'rgba(255,255,255,0.4)'; x.beginPath(); x.ellipse(hx - 1.8, 3.4, 1.5, 0.7, -0.3, 0, 7); x.fill(); return; }
      if (hs === 'balding') {
        if (back) blob(() => { x.moveTo(hx - HW - 0.3, 5); x.quadraticCurveTo(hx, 7.6, hx + HW + 0.3, 5); x.lineTo(hx + HW + 0.2, 9.6); x.quadraticCurveTo(hx, 11.4, hx - HW - 0.2, 9.6); x.closePath(); }, hair);
        else if (side) blob(() => { x.moveTo(hx - HW - 0.4, 4.6); x.quadraticCurveTo(hx - 3, 5.6, hx - 1.8, 5.8); x.lineTo(hx - 1.4, 9.6); x.lineTo(hx - HW + 0.6, 10.6); x.quadraticCurveTo(hx - HW - 0.6, 9, hx - HW - 0.4, 4.6); x.closePath(); }, hair);
        else { blob(ell(hx - HW + 0.2, 6.2, 1.2, 2.2), hair); blob(ell(hx + HW - 0.2, 6.2, 1.2, 2.2), hair); }
        x.fillStyle = 'rgba(255,255,255,0.4)'; x.beginPath(); x.ellipse(hx - 1.4, 3.3, 1.5, 0.7, -0.3, 0, 7); x.fill(); return;
      }
      if (back) {
        let bottom = { buzz: 8.6, short: 9.4, slick: 9.6, quiff: 9.4, curly: 9.6, bob: 11.2, bun: 10, ponytail: 10, mullet: 13.6, long: 16.6, curly_long: 16.6, afro: 11 }[hs] || 9.4;
        if (hs === 'long' || hs === 'curly_long') blob(() => { rrp(x, hx - 6.1, 1.0, 12.2, bottom - 1, 5); if (wavy) cloud(hx, bottom - 0.4, 5, 0.4, 1.3, 5, 0, Math.PI)(); }, hair, -1, -0.7);
        else blob(() => { x.moveTo(hx - HW - 0.5, bottom - 1.6); x.bezierCurveTo(hx - HW - 1.2, -1.2, hx + HW + 1.2, -1.2, hx + HW + 0.5, bottom - 1.6); x.quadraticCurveTo(hx + HW, bottom + 0.4, hx, bottom); x.quadraticCurveTo(hx - HW, bottom + 0.4, hx - HW - 0.5, bottom - 1.6); x.closePath(); if (wavy) cloud(hx, 4.6, 4.6, 3.8, 1.5, 10)(); }, hair, -1, -0.7);
        if (hs === 'buzz') { x.fillStyle = 'rgba(0,0,0,0.0)'; }
        if (hs === 'bun') blob(circ(hx, 2.0, 2.05), hair);
        if (hs === 'ponytail') { blob(rrf(hx - 1.3, 7.5, 2.6, 7.5, 1.3), hair); x.fillStyle = '#e8506a'; rr(x, hx - 1.4, 7.6, 2.8, 0.9, 0.4); x.fill(); }
        shine(hx - 3, 3.2, 3);
        return;
      }
      if (side) {
        let p;
        switch (hs) {
          case 'buzz': p = sideCap(8.4, 3.6, { fringeY: 3.6 }); break;
          case 'slick': p = sideCap(9.4, 3.4, { fringeY: 3.2 }); break;
          case 'bob': p = sideCap(11.4, 4.8, { wide: 1.1, longFront: true }); break;
          case 'long': case 'curly_long': p = sideCap(15.6, fem ? 5.2 : 4.6, { wide: 1.2, longFront: true }); break;
          case 'mullet': p = sideCap(13.4, 4.4, {}); break;
          case 'afro': p = sideCap(10.4, 4.2, { wide: 1.6 }); break;
          default: p = sideCap(9.6, fem ? 5.0 : 4.4, { fringeY: fem ? 4.6 : 3.6 });
        }
        blob(() => { p(); if (wavy) cloud(hx - 1, 4.6, 4.8, 3.2, 1.4, 7, Math.PI * 0.9, Math.PI * 1.95, true)(); }, hair, -0.9, -0.7);
        if (hs === 'quiff') blob(ell(hx + 2.2, 1.9, 3.6, 1.9, -0.2), hair, -0.5, -0.5);
        if (hs === 'ponytail') { x.fillStyle = '#e8506a'; rr(x, hx - HW - 0.9, 4.6, 1.1, 1.6, 0.4); x.fill(); }
        shine(hx - 2.5, 2.4, 3.5);
        return;
      }
      // front
      let p;
      switch (hs) {
        case 'buzz': p = smooth(6.0, 3.6); break;
        case 'slick': p = crown(6.6, [[hx + HW + 0.4, 6.6], [hx + HW - 0.3, 3.4], [hx + 1, 2.7], [hx - 3.4, 3.8], [hx - HW + 0.2, 5.2], [hx - HW - 0.4, 6.6]], true); break;
        case 'quiff': p = spiky(6.6); break;
        case 'curly': p = crown(6.6, [[hx + HW + 0.4, 6.6], [hx + HW - 0.2, 4.8], [hx - HW + 0.2, 4.8], [hx - HW - 0.4, 6.6]], true); break;
        case 'afro': p = crown(7.4, [[hx + HW + 0.4, 7.4], [hx + HW - 0.2, 4.6], [hx - HW + 0.2, 4.6], [hx - HW - 0.4, 7.4]], true); break;
        case 'bob': p = () => { x.moveTo(hx - HW - 1, 11.2); x.bezierCurveTo(hx - HW - 2.2, -1.8, hx + HW + 2.2, -1.8, hx + HW + 1, 11.2); x.lineTo(hx + HW - 0.9, 11.2); x.lineTo(hx + HW - 0.9, 5.4); x.lineTo(hx - HW + 0.9, 5.0); x.lineTo(hx - HW + 0.9, 11.2); x.closePath(); }; break;
        case 'long': case 'curly_long': p = swept(9); break;
        case 'mullet': p = spiky(7.6); break;
        case 'bun': case 'ponytail': p = fem ? swept(7.4) : smooth(6.6, 3.8); break;
        default: p = fem ? swept(7.6) : spiky(7.0);
      }
      blob(() => {
        p();
        if (hs === 'curly' || hs === 'curly_long') { cloud(hx, 4.6, 4.7, 3.6, 1.45, 9, Math.PI, Math.PI * 2)(); for (let i = 0; i < 5; i++) { x.moveTo(hx - 3.6 + i * 1.8 + 1.1, 4.7); x.arc(hx - 3.6 + i * 1.8, 4.7, 1.1, 0, 7); } }
        if (hs === 'afro') { for (let i = 0; i < 5; i++) { x.moveTo(hx - 3.6 + i * 1.8 + 1.2, 4.5); x.arc(hx - 3.6 + i * 1.8, 4.5, 1.2, 0, 7); } }
        if (hs === 'quiff') x.ellipse(hx + 0.6, 1.9, 4.2, 2.0, -0.12, 0, 7);
        if ((hs === 'long' || hs === 'curly_long') && !hasHat) { rrp(x, hx - HW - 1.1, 5.5, 2.4, 10.4, 1.2); rrp(x, hx + HW - 1.3, 5.5, 2.4, 10.4, 1.2); }
      }, hair, -0.9, -0.7);
      if (hs === 'bun' || hs === 'ponytail') { x.fillStyle = '#e8506a'; if (hs === 'ponytail') { rr(x, hx + HW + 0.1, 4, 1.1, 1.6, 0.4); x.fill(); } }
      shine(hx - 3.4, 2.5, 3.2);
    };

    // ---------- headwear ----------
    const drawHats = () => {
      const capCol = accVal('cap');
      if (capCol) {
        blob(() => { x.moveTo(hx - HW - 0.5, 5.2); x.bezierCurveTo(hx - HW - 0.9, -1.4, hx + HW + 0.9, -1.4, hx + HW + 0.5, 5.2); x.closePath(); }, capCol, -0.8, -0.6);
        x.fillStyle = sh(capCol, -0.3); x.beginPath(); x.arc(hx, 0.6, 0.6, 0, 7); x.fill();
        if (front) { blob(() => x.ellipse(hx, 5.2, HW + 0.9, 1.25, 0, 0, 7), sh(capCol, -0.12), 0, -0.4, -0.25); }
        else if (side) blob(() => x.ellipse(hx + HW + 0.6, 5.0, 3.2, 0.95, 0.05, 0, 7), sh(capCol, -0.12), 0, -0.3, -0.25);
        else { x.fillStyle = sh(capCol, -0.3); rr(x, hx - 1.6, 4, 3.2, 1.2, 0.5); x.fill(); }
      }
      const beanie = accVal('beanie') || (has('beanie') ? '#333' : null);
      if (beanie) {
        blob(() => { x.moveTo(hx - HW - 0.5, 5.4); x.bezierCurveTo(hx - HW - 0.9, -1.6, hx + HW + 0.9, -1.6, hx + HW + 0.5, 5.4); x.closePath(); }, beanie, -0.8, -0.6);
        blob(rrf(hx - HW - 0.6, 3.8, HW * 2 + 1.2, 2.0, 0.9), sh(beanie, 0.12), 0, -0.4);
        line(sh(beanie, -0.3), 0.25); x.beginPath(); for (let i = -4; i <= 4; i += 1.3) { x.moveTo(hx + i, 4.1); x.lineTo(hx + i, 5.5); } x.stroke();
      }
      if (has('monkhat')) {
        blob(() => { x.moveTo(hx - HW - 0.1, 5.6); x.lineTo(hx - HW - 0.7, 0.3); x.lineTo(hx + HW + 0.7, 0.3); x.lineTo(hx + HW + 0.1, 5.6); x.closePath(); }, '#24232a', -0.8, 0, -0.3);
        x.fillStyle = '#3a3942'; rr(x, hx - HW - 1, 0, HW * 2 + 2, 1.1, 0.5); x.fill();
        if (front) { x.fillStyle = '#d13b3b'; x.fillRect(hx - 0.35, 1.6, 0.7, 2.6); x.fillRect(hx - 1.1, 2.4, 2.2, 0.7); }
      }
    };

    // ---------- held items ----------
    const drawHeld = () => {
      const held = look.held; if (!held) return;
      const [hxR, hyR] = hand;
      const L = (x1, y1, x2, y2, col, w) => { x.strokeStyle = col; x.lineWidth = w; x.beginPath(); x.moveTo(x1, y1); x.lineTo(x2, y2); x.stroke(); };
      switch (held) {
        case 'axe': L(hxR, hyR + 2.4, hxR, hyR - 10, '#8a5a2e', 1.2); blob(() => { x.moveTo(hxR, hyR - 10.2); x.quadraticCurveTo(hxR + 2, hyR - 11.6, hxR + 3.1, hyR - 11.2); x.quadraticCurveTo(hxR + 2.4, hyR - 8.6, hxR + 3.1, hyR - 6); x.quadraticCurveTo(hxR + 1.8, hyR - 6.6, hxR, hyR - 7.4); x.closePath(); }, '#c9d2da', -0.3, -0.4); break;
        case 'broom': L(hxR, hyR + 3, hxR, hyR - 12, '#c49a5a', 1); blob(() => { x.moveTo(hxR - 1, hyR + 2); x.lineTo(hxR + 1, hyR + 2); x.lineTo(hxR + 2.4, hyR + 6.5); x.lineTo(hxR - 2.4, hyR + 6.5); x.closePath(); }, '#e2bd62'); break;
        case 'mic': L(hxR, hyR, hxR, hyR - 3.6, '#26262c', 1.1); blob(circ(hxR, hyR - 4.4, 1.35), '#6b6b74', -0.3, -0.3); break;
        case 'cross': L(hxR, hyR + 1.4, hxR, hyR - 6.5, '#d2a04a', 1.1); L(hxR - 2, hyR - 4.2, hxR + 2, hyR - 4.2, '#d2a04a', 1.1); break;
        case 'phone': blob(rrf(hxR - 1.1, hyR - 4.2, 2.4, 3.8, 0.5), '#26262c', -0.2, -0.2); x.fillStyle = '#8fd3ff'; rr(x, hxR - 0.8, hyR - 3.9, 1.8, 2.8, 0.3); x.fill(); break;
        case 'tray': blob(() => x.ellipse(hxR, hyR - 1.8, 3.2, 1, 0, 0, 7), '#dcdcdc', 0, -0.3); x.fillStyle = '#f2d36b'; rr(x, hxR - 1.8, hyR - 5.6, 1.1, 3.6, 0.3); x.fill(); rr(x, hxR + 0.6, hyR - 5.6, 1.1, 3.6, 0.3); x.fill(); break;
        case 'stick': L(hxR, hyR + 3.4, hxR - 0.5, hyR - 11, '#7a5432', 1.1); break;
        case 'cake': blob(rrf(hxR - 2.2, hyR - 2.6, 4.4, 2.8, 0.7), '#f7e1c5'); x.fillStyle = '#ff6fa3'; rr(x, hxR - 2.2, hyR - 3.2, 4.4, 1.1, 0.5); x.fill(); x.fillStyle = '#e83a4a'; x.beginPath(); x.arc(hxR, hyR - 3.6, 0.6, 0, 7); x.fill(); break;
        case 'champagne': blob(rrf(hxR - 0.8, hyR - 5.4, 1.7, 5.6, 0.6), '#1f6a32', -0.2, 0); x.fillStyle = '#f2c94c'; rr(x, hxR - 0.6, hyR - 6.6, 1.3, 1.6, 0.3); x.fill(); x.fillStyle = '#f4f0e0'; x.fillRect(hxR - 0.8, hyR - 3.4, 1.7, 1.3); break;
        case 'radio': blob(rrf(hxR - 1.2, hyR - 2.2, 2.6, 4.2, 0.5), '#26262c', -0.2, -0.2); L(hxR + 0.8, hyR - 2, hxR + 0.8, hyR - 6, '#333', 0.5); x.fillStyle = '#e04a3a'; x.beginPath(); x.arc(hxR + 0.8, hyR - 6, 0.4, 0, 7); x.fill(); break;
        case 'censer': L(hxR, hyR, hxR, hyR + 3, '#999', 0.4); blob(circ(hxR, hyR + 3.9, 1.4), '#d2a04a', -0.3, -0.3); break;
      }
      blob(circ(hxR, hyR, 1.3), skin, -0.4, -0.4, -0.2); // fingers over the grip
    };

    // ---------- draw order ----------
    hairBehind();
    drawLegs();
    drawTorso();
    if (side) drawHeld(); // seen from the side the item is held beside the body, behind the big head
    drawHead();
    if (!back) { drawFace(); facial(); }
    drawHair(); brows();
    if (side && !(longHair && hs !== 'mullet') && hs !== 'bob') blob(circ(hx - 1.0, 8.0, 1.05), skin, -0.3, -0.3, -0.2); // ear over the hair line
    drawHats();
    if (!side) drawHeld();

    // ---------- silhouette outline ----------
    const [sc, sx] = G.hiCanvas(LW, LH, k);
    sx.setTransform(1, 0, 0, 1, 0, 0); sx.drawImage(ic, 0, 0); sx.globalCompositeOperation = 'source-in'; sx.fillStyle = OUTLINE; sx.fillRect(0, 0, sc.width, sc.height);
    out.setTransform(1, 0, 0, 1, 0, 0);
    const o = 0.42 * k;
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; out.drawImage(sc, Math.cos(a) * o, Math.sin(a) * o); }
    out.drawImage(ic, 0, 0);
    return c;
  }

  G.personSprite = function (look, dir, frame) {
    if (!look._id) look._id = JSON.stringify(look);
    const key = 'h' + (G.RS || 2) + look._id + dir + frame;
    let s = cache.get(key); if (!s) { s = drawPersonHD(look, dir, frame); cache.set(key, s); }
    return s;
  };
  G.personSpriteHi = function (look, dir, frame, k = 12) {
    if (!look._id) look._id = JSON.stringify(look);
    const key = 'H' + k + look._id + dir + frame;
    let s = cache.get(key); if (!s) { s = drawPersonHD(look, dir, frame, k); cache.set(key, s); }
    return s;
  };
  // something big carried in both arms at chest height (py = top of the sprite box): an old TV, a microwave, a painting
  function drawCarry(ctx, kind, look, x, py, dir) {
    const side = dir === 1 ? -1 : dir === 2 ? 1 : 0, cx = x + side * 3.5, cy = py + 15.5;
    ctx.save(); ctx.strokeStyle = INK; ctx.lineWidth = 0.6;
    const box = (w, h, r, f) => { rr(ctx, cx - w / 2, cy - h / 2, w, h, r); ctx.fillStyle = f; ctx.fill(); ctx.stroke(); };
    if (kind === 'tv') {
      box(12, 9.5, 1.6, hgrad(ctx, cx - 6, cx + 6, '#5a5a62', '#2a2a30'));
      rr(ctx, cx - 4.8, cy - 3.6, 8, 6.6, 1.8); ctx.fillStyle = vgrad(ctx, cy - 3.6, cy + 3, '#3e5a72', '#141e28'); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(cx - 2.2, cy - 1.8, 1.6, 0.8, -0.4, 0, 7); ctx.fill();
      ctx.fillStyle = '#c8c8c8'; ctx.beginPath(); ctx.arc(cx + 4.4, cy - 1.5, 0.6, 0, 7); ctx.arc(cx + 4.4, cy + 0.8, 0.6, 0, 7); ctx.fill();
      ctx.strokeStyle = '#333'; ctx.lineWidth = 0.4; ctx.beginPath(); ctx.moveTo(cx - 1, cy - 4.8); ctx.lineTo(cx - 3.5, cy - 9); ctx.moveTo(cx + 1, cy - 4.8); ctx.lineTo(cx + 3.2, cy - 9.4); ctx.stroke();
    } else if (kind === 'microwave') {
      box(12, 7.5, 1.2, vgrad(ctx, cy - 4, cy + 4, '#f4f4f0', '#c4c4bc'));
      rr(ctx, cx - 5, cy - 2.6, 7, 5.2, 0.8); ctx.fillStyle = vgrad(ctx, cy - 2.6, cy + 2.6, '#4a4a50', '#18181c'); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(cx - 4.3, cy - 2, 2, 0.8);
      ctx.fillStyle = '#2a8a4a'; ctx.fillRect(cx + 2.8, cy - 2.4, 2.2, 1.2); ctx.fillStyle = '#888'; for (let i = 0; i < 3; i++) ctx.fillRect(cx + 2.9, cy - 0.4 + i * 1, 2, 0.5);
    } else { // painting in a gilt frame
      box(11, 12.5, 0.8, vgrad(ctx, cy - 6, cy + 6, '#f0cf6a', '#9a6a1e'));
      ctx.fillStyle = vgrad(ctx, cy - 4.6, cy + 4.6, '#8fc4ea', '#d8ecf6'); ctx.fillRect(cx - 4, cy - 4.8, 8, 9.6);
      ctx.fillStyle = '#4e8a3e'; ctx.beginPath(); ctx.moveTo(cx - 4, cy + 1.5); ctx.quadraticCurveTo(cx - 1, cy - 1.5, cx + 4, cy + 1); ctx.lineTo(cx + 4, cy + 4.8); ctx.lineTo(cx - 4, cy + 4.8); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffd86a'; ctx.beginPath(); ctx.arc(cx + 2, cy - 2.6, 1.2, 0, 7); ctx.fill();
    }
    if (dir !== 3) { // hands gripping the sides
      ctx.fillStyle = look.skin || '#e8b48a'; const hw = kind === 'painting' ? 5.6 : 6.1;
      for (const k of side ? [side] : [-1, 1]) { ctx.beginPath(); ctx.arc(cx + k * hw, cy + 1.5, 1.2, 0, 7); ctx.fill(); ctx.stroke(); }
    }
    ctx.restore();
  }
  G.drawPerson = function (ctx, look, x, y, dir = 0, frame = 0, opts = {}) {
    const s = G.personSprite(look, dir, frame);
    ctx.save();
    if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
    const prevSmooth = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = true;
    if (opts.down) { ctx.translate(x, y - 4); ctx.rotate(Math.PI / 2); ctx.drawImage(s, -LW / 2, -LH + 4, LW, LH); }
    else if (opts.wade) { // in the shallow sea: only head and shoulders above the water, gentle bob, ripple rings
      const t = G.t || 0, wl = y - 3 + Math.sin(t * 2.6 + x * 0.07) * 0.7, cut = 13.6;
      ctx.fillStyle = 'rgba(16,52,96,0.22)'; ctx.beginPath(); ctx.ellipse(x, wl + 0.6, 6.5, 2.3, 0, 0, 7); ctx.fill();
      for (let i = 0; i < 2; i++) {
        const ph = (t * 0.7 + i * 0.5 + x * 0.011) % 1;
        ctx.strokeStyle = 'rgba(235,248,255,' + (0.5 * (1 - ph)).toFixed(3) + ')'; ctx.lineWidth = 0.7;
        ctx.beginPath(); ctx.ellipse(x, wl + 0.6, 5 + ph * 8, 1.7 + ph * 2.6, 0, 0, 7); ctx.stroke();
      }
      ctx.drawImage(s, 0, 0, s.width, s.height * cut / LH, x - LW / 2, wl - cut, LW, cut);
      // water line over the shoulders: a soft bright arc in front
      ctx.strokeStyle = 'rgba(240,250,255,0.75)'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.ellipse(x, wl - 0.2, 5, 1.5, 0, 0.15, Math.PI - 0.15); ctx.stroke();
    }
    else if (opts.sit) { // sitting on the ground, legs stretched towards the camera, torso lowered
      const cut = 18, by = y - 1, legs = look.legs || '#2d3446';
      ctx.fillStyle = 'rgba(20,10,30,0.28)'; ctx.beginPath(); ctx.ellipse(x + 1, y + 1, 7, 2.6, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 0.5;
      for (const lx of [-3.6, 0.6]) {
        const g = ctx.createLinearGradient(0, by - 3, 0, by + 4); g.addColorStop(0, sh(legs, 0.1)); g.addColorStop(1, sh(legs, -0.2));
        ctx.fillStyle = g; rr(ctx, x + lx, by - 3, 3, 6.5, 1.3); ctx.fill(); ctx.stroke();
        ctx.fillStyle = look.shoes || '#222'; ctx.beginPath(); ctx.ellipse(x + lx + 1.5, by + 3.6, 1.7, 1.1, 0, 0, 7); ctx.fill();
      }
      ctx.drawImage(s, 0, 0, s.width, s.height * cut / LH, x - LW / 2, by - cut + 1, LW, cut);
      if (opts.cup) { // paper cup for change, on the ground beside him
        const cx = x + 6.5, cy = y + 1;
        ctx.fillStyle = 'rgba(20,10,30,0.25)'; ctx.beginPath(); ctx.ellipse(cx + 0.8, cy + 0.4, 2, 0.8, 0, 0, 7); ctx.fill();
        ctx.fillStyle = vgrad(ctx, cy - 3.5, cy, '#f4f0e6', '#c8c0b0'); ctx.beginPath(); ctx.moveTo(cx - 1.6, cy - 3.5); ctx.lineTo(cx + 1.6, cy - 3.5); ctx.lineTo(cx + 1.2, cy); ctx.lineTo(cx - 1.2, cy); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#e0b84a'; ctx.beginPath(); ctx.ellipse(cx, cy - 3.5, 1.4, 0.5, 0, 0, 7); ctx.fill();
      }
    }
    else {
      ctx.fillStyle = 'rgba(20,10,30,0.28)'; ctx.beginPath(); ctx.ellipse(x + 1, y - 0.5, 6.5, 2.4, 0, 0, 7); ctx.fill();
      const back = dir === 3, py = y - LH + 1 - (opts.lift || 0);
      if (opts.carry && back) drawCarry(ctx, opts.carry, look, x, py, dir);   // seen from behind: the object is in front of him
      ctx.drawImage(s, x - LW / 2, py, LW, LH);
      if (opts.carry && !back) drawCarry(ctx, opts.carry, look, x, py, dir);
    }
    ctx.imageSmoothingEnabled = prevSmooth;
    ctx.restore();
  };
})();
