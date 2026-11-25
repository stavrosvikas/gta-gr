// GTA LUBEN — First Dates restaurant: small walkable interior (a place, not a quest; never calls win)
'use strict';
(function () {
  const TS = 16, RW = 320, RH = 224;
  const ROWS = [
    'SSSSSSSSSSSSSSSSSSSS',
    'SSSSSSSSSSSSSSSSSSSS',
    'KKKKKKKKKKKKKKKKKKKK',
    'K......C...........K',
    'KCCCCCCC...........K',
    'K..................K',
    'K..................K',
    'K..cTc..cTc..cTc...K',
    'K..................K',
    'K..................K',
    'K..cTc..cTc..cTc...K',
    'K..................K',
    'K.............P....K',
    'KKKKKKKKKKKKKKKKDKKK',
  ];
  const DOOR = [16, 13];
  const AISLE_X = [6, 11, 17].map(c => c * TS + 8), AISLE_Y = [5, 8, 11].map(r => r * TS + 12);
  const DRINK = 6;

  // ambient date talk: silent bubbles only (no voice)
  const CHAT = ['Λοιπόν... τι ζώδιο είσαι;', 'Κι εγώ λατρεύω τα ταξίδια!', 'Μένω με τη μάνα μου. Προσωρινά. Δέκα χρόνια.', 'Ο πρώην μου... α, συγγνώμη.',
    'Χαχα. Ναι. Χαχα.', 'Κάνεις crypto;', 'Έχω τρεις γάτες και ένα podcast.', 'Πόσα βγάζεις; Ρωτάω.', '...', 'Η κάμερα μάς τραβάει τώρα;', 'Εγώ πληρώνω. Το μισό.'];
  const BOTHER = [
    ['fd_player_bother1', 'Συγγνώμη, θα φιλιθείτε τελικά ή να φύγω;'],
    ['fd_player_bother2', 'Γεια σας! Τι ζώδιο είστε; Ρωτάω για φίλο.'],
    ['fd_player_bother3', 'Μπορώ να κάτσω λίγο; Το δικό μου ραντεβού δεν ήρθε.'],
    ['fd_player_bother4', 'Τον λογαριασμό θα τον μοιράσετε; Για επιστημονικούς λόγους.'],
    ['fd_player_bother5', 'Μια selfie μαζί σας; Για το story μου!'],
  ];
  const ANNOY = [
    ['fd_couple_annoyed1', 'Σοβαρά τώρα;! Αυτό ήταν, φεύγω.'],
    ['fd_couple_annoyed2', 'Ραντεβού έχουμε, όχι λαϊκή! Γεια.'],
    ['fd_couple_annoyed3', 'Μας χάλασες τη στιγμή. Πάω σπίτι.'],
  ];
  const BAR = [
    ['fd_bar_drink1', 'Ένα «Πρώτο Ραντεβού». Βότκα, ροδάκινο και άγχος.'],
    ['fd_bar_drink2', 'Πάρε αυτό. Θάρρος σε ποτήρι.'],
    ['fd_bar_drink3', 'Κι άλλο; Ποιον περιμένεις, φίλε μου;'],
  ];
  const HOST_TALK = [
    ['fd_host_talk1', 'Το ραντεβού σου θα έρθει. Μάλλον.'],
    ['fd_host_talk2', 'Αν δεν σου κάτσει κανείς, ο μπάρμαν ακούει.'],
  ];

  const noId = (l, extra) => { const o = Object.assign({}, l, extra || {}); delete o._id; return o; };
  function stepTo(o, x, y, sp, dt) {
    const dx = x - o.x, dy = y - o.y, d = Math.hypot(dx, dy);
    if (d < 1) { o.frame = 0; return true; }
    const s = Math.min(d, sp * dt); o.x += dx / d * s; o.y += dy / d * s;
    o.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 1) : (dy > 0 ? 0 : 3);
    o.anim = (o.anim || 0) + s / 7; o.frame = [0, 1, 0, 2][Math.floor(o.anim) % 4];
    return false;
  }
  function follow(o, sp, dt) { while (o.path.length && stepTo(o, o.path[0][0], o.path[0][1], sp, dt)) o.path.shift(); return !o.path.length; }
  // ---------- HD-2D drawing helpers ----------
  const INK = 'rgba(28,20,36,0.85)', SHADOW = 'rgba(20,10,30,0.3)', WALL_EDGE = '#1c1622';
  const rr = (x, px, py, w, h, r) => { x.beginPath(); if (x.roundRect) x.roundRect(px, py, w, h, r); else x.rect(px, py, w, h); };
  const vg = (x, y0, y1, a, b) => { const g = x.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, a); g.addColorStop(1, b); return g; };
  const hg = (x, x0, x1, a, b) => { const g = x.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, a); g.addColorStop(1, b); return g; };
  const dg = (x, x0, y0, x1, y1, a, b) => { const g = x.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, a); g.addColorStop(1, b); return g; };
  const ink = (x, w = 0.6) => { x.lineWidth = w; x.strokeStyle = INK; x.stroke(); };
  function heartPath(ctx) {
    ctx.beginPath(); ctx.moveTo(0, 2.6);
    ctx.bezierCurveTo(-3.3, 0.4, -3.1, -2.3, -1.45, -2.3); ctx.bezierCurveTo(-0.6, -2.3, 0, -1.7, 0, -1.05);
    ctx.bezierCurveTo(0, -1.7, 0.6, -2.3, 1.45, -2.3); ctx.bezierCurveTo(3.1, -2.3, 3.3, 0.4, 0, 2.6); ctx.closePath();
  }
  // small soft heart, (x,y) = top-left-ish anchor like the old 5x4 sprite
  function heart(ctx, x, y, col, s = 1) {
    ctx.save(); ctx.translate(x + 0.5, y + 1.8); ctx.scale(s, s);
    heartPath(ctx); const g = ctx.createLinearGradient(-2, -2, 2, 2.5); g.addColorStop(0, G.shade(col, 0.35)); g.addColorStop(1, G.shade(col, -0.25));
    ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 0.45 / s; ctx.strokeStyle = INK; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.ellipse(-1.4, -1.2, 0.75, 0.45, -0.6, 0, 7); ctx.fill();
    ctx.restore();
  }
  function anger(ctx, x, y) {
    ctx.save(); ctx.translate(x, y); ctx.lineCap = 'round';
    for (let k = 0; k < 4; k++) {
      ctx.beginPath(); ctx.moveTo(0.8, -2.6); ctx.quadraticCurveTo(0.8, -0.8, 2.6, -0.8);
      ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(60,0,0,0.6)'; ctx.stroke();
      ctx.lineWidth = 0.9; ctx.strokeStyle = '#ff3030'; ctx.stroke();
      ctx.rotate(Math.PI / 2);
    }
    ctx.restore();
  }

  // ---------- room painter (cached hi-res background, logical 320x224) ----------
  function brick(x, bx, by, w, h) {
    x.fillStyle = dg(x, bx, by, bx + w * 0.4, by + h, '#8e4a3a', '#5e2e24'); x.fillRect(bx, by, w, h);
    x.save(); x.beginPath(); x.rect(bx, by, w, h); x.clip();
    x.strokeStyle = 'rgba(30,14,10,0.35)'; x.lineWidth = 0.5; x.beginPath();
    for (let y = by + 4; y < by + h; y += 4) { x.moveTo(bx, y); x.lineTo(bx + w, y); }
    for (let r = 0, y = by; y < by + h; y += 4, r++) for (let px = bx + (r % 2) * 4 + 2; px < bx + w; px += 8) { x.moveTo(px, y); x.lineTo(px, y + 4); }
    x.stroke();
    x.fillStyle = 'rgba(255,200,170,0.08)';
    for (let i = 0; i < w * h / 90; i++) { x.beginPath(); x.ellipse(bx + G.hash(i, bx + by) * w, by + G.hash(bx + by, i) * h, 2, 0.8, 0, 0, 7); x.fill(); }
    x.restore();
  }
  function paintRoom(x) {
    x.lineJoin = 'round'; x.lineCap = 'round';
    // --- floor: warm oak planks, lit from the top-left ---
    x.fillStyle = dg(x, 0, 48, RW, RH, '#c99a6c', '#946642'); x.fillRect(0, 32, RW, RH - 32);
    x.strokeStyle = 'rgba(70,36,16,0.22)'; x.lineWidth = 0.5; x.beginPath();
    for (let y = 52, r = 0; y < RH; y += 5, r++) {
      x.moveTo(0, y); x.lineTo(RW, y);
      for (let px = (G.hash(r, 5) * 40) | 0; px < RW; px += 40) { x.moveTo(px, y - 5); x.lineTo(px, y); }
    }
    x.stroke();
    x.strokeStyle = 'rgba(255,230,190,0.07)'; x.lineWidth = 0.8; x.beginPath();
    for (let i = 0; i < 26; i++) { const px = G.hash(i, 9) * RW, py = 52 + ((G.hash(9, i) * 34) | 0) * 5 + 2.5; x.moveTo(px, py); x.quadraticCurveTo(px + 6, py - 0.6, px + 14, py); }
    x.stroke();
    for (const [lx, ly] of [[72, 128], [152, 128], [232, 128], [64, 60]]) { // warm pools of light from the ceiling lamps
      const g = x.createRadialGradient(lx - 6, ly - 8, 4, lx, ly, 70); g.addColorStop(0, 'rgba(255,214,150,0.22)'); g.addColorStop(1, 'rgba(255,214,150,0)');
      x.fillStyle = g; x.fillRect(0, 32, RW, RH - 32);
    }
    // --- back wall: wooden cube shelves (rows 0-1) ---
    x.fillStyle = vg(x, 0, 32, '#4a4540', '#34302c'); x.fillRect(0, 0, RW, 32);
    for (let ty = 0; ty < 2; ty++) {
      const off = ty % 2 ? 7 : 0;
      for (let tx = -1; tx < 20; tx++) {
        const cx = tx * TS + off, cy = ty * TS;
        // recess
        x.fillStyle = vg(x, cy, cy + 16, '#2a2420', '#3e3630'); x.fillRect(cx + 2, cy + 2, 14, 14);
        x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(cx + 2, cy + 2, 14, 2.2); x.fillRect(cx + 2, cy + 2, 1.6, 14);
        // objects
        const h = (((tx * 7 + ty * 13) % 6) + 6) % 6, ox = cx + 2;
        if (h === 0) { x.fillStyle = hg(x, ox + 5, ox + 9, '#ff5a6a', '#90101e'); rr(x, ox + 5.5, cy + 8.5, 3.6, 6.5, [1.8, 1.8, 0.8, 0.8]); x.fill(); ink(x, 0.4); }
        else if (h === 2) {
          x.fillStyle = vg(x, cy + 10, cy + 13, '#f4ead4', '#cdbf9e'); rr(x, ox + 3.5, cy + 10.5, 7, 2.2, 0.6); x.fill(); ink(x, 0.35);
          x.fillStyle = vg(x, cy + 12.5, cy + 15, '#5a8ed0', '#2a5288'); rr(x, ox + 3.5, cy + 12.7, 7, 2.3, 0.6); x.fill(); ink(x, 0.35);
        } else if (h === 4) {
          x.fillStyle = vg(x, cy + 12, cy + 15, '#efe8da', '#b8ae9c'); rr(x, ox + 5.2, cy + 11.8, 4, 3.2, [0.6, 0.6, 1.2, 1.2]); x.fill(); ink(x, 0.35);
          const g = x.createRadialGradient(ox + 6.4, cy + 8.6, 0.3, ox + 7.2, cy + 9.6, 3.2); g.addColorStop(0, '#8fdc72'); g.addColorStop(1, '#2a6a30');
          x.fillStyle = g; x.beginPath(); x.arc(ox + 7.2, cy + 9.6, 2.9, 0, 7); x.fill(); ink(x, 0.35);
        }
        // boards (frame): top and left plank, lit
        x.fillStyle = vg(x, cy, cy + 2, '#ecba7c', '#b07c44'); rr(x, cx, cy, 16, 2.2, 0.6); x.fill();
        x.fillStyle = hg(x, cx, cx + 2.2, '#e8b678', '#a87440'); rr(x, cx, cy, 2.2, 16, 0.6); x.fill();
      }
    }
    x.fillStyle = vg(x, 30, 33, '#c89058', '#6e4626'); x.fillRect(0, 30, RW, 2.5);
    // --- back wainscot row 2 + bottles behind the bar ---
    brick(x, 0, 32, RW, 16);
    x.fillStyle = vg(x, 32, 35, '#d4a06a', '#7a4e2c'); x.fillRect(0, 32, RW, 3);
    x.fillStyle = vg(x, 44, 48, '#6a4a32', '#3e2a1c'); rr(x, 16, 44.5, 96, 3.2, 0.8); x.fill(); ink(x, 0.4);
    const BC = ['#2a7a3a', '#a8481e', '#e6dcc4', '#3a74b8'];
    for (let tx = 1; tx <= 6; tx++) for (let i = 0; i < 3; i++) {
      const bx = tx * TS + 3.5 + i * 5, col = BC[(tx + i) % 4];
      x.fillStyle = 'rgba(20,10,30,0.25)'; rr(x, bx + 1, 37.5, 3, 7.5, 1); x.fill();
      x.fillStyle = hg(x, bx, bx + 3, G.shade(col, 0.4), G.shade(col, -0.35));
      x.beginPath(); x.moveTo(bx + 1, 35.2); x.lineTo(bx + 2, 35.2); x.lineTo(bx + 2, 37.4); x.quadraticCurveTo(bx + 3, 37.8, bx + 3, 39); x.lineTo(bx + 3, 44.6);
      x.lineTo(bx, 44.6); x.lineTo(bx, 39); x.quadraticCurveTo(bx, 37.8, bx + 1, 37.4); x.closePath(); x.fill(); ink(x, 0.35);
      x.fillStyle = 'rgba(255,255,255,0.45)'; rr(x, bx + 0.5, 39.2, 0.6, 4, 0.3); x.fill();
    }
    // --- side + front walls (obstacles: darker, bordered, casting a shadow on the floor) ---
    const walls = [[0, 48, 16, 176], [RW - 16, 48, 16, 176], [16, RH - 16, 240, 16], [272, RH - 16, 32, 16]];
    // floor shadows next to the walls
    x.fillStyle = hg(x, 16, 24, 'rgba(20,10,30,0.4)', 'rgba(20,10,30,0)'); x.fillRect(16, 48, 8, RH - 64);
    x.fillStyle = vg(x, 48, 56, 'rgba(20,10,30,0.42)', 'rgba(20,10,30,0)'); x.fillRect(16, 48, RW - 32, 8);
    x.fillStyle = hg(x, RW - 20, RW - 16, 'rgba(20,10,30,0)', 'rgba(20,10,30,0.22)'); x.fillRect(RW - 20, 48, 4, RH - 64);
    x.fillStyle = vg(x, RH - 20, RH - 16, 'rgba(20,10,30,0)', 'rgba(20,10,30,0.22)'); x.fillRect(16, RH - 20, RW - 32, 4);
    for (const [bx, by, w, h] of walls) brick(x, bx, by, w, h);
    // wall caps (top face catching the light) + dark border along the floor edge
    x.fillStyle = hg(x, 0, 16, 'rgba(255,220,190,0.22)', 'rgba(0,0,0,0.15)'); x.fillRect(0, 48, 16, RH - 48); x.fillRect(RW - 16, 48, 16, RH - 48);
    x.fillStyle = vg(x, RH - 16, RH, 'rgba(255,220,190,0.2)', 'rgba(0,0,0,0.2)'); x.fillRect(16, RH - 16, 240, 16); x.fillRect(272, RH - 16, 32, 16);
    x.strokeStyle = WALL_EDGE; x.lineWidth = 1.2; x.beginPath();
    x.moveTo(16, 48); x.lineTo(16, RH - 16); x.lineTo(256, RH - 16); x.lineTo(256, RH);
    x.moveTo(272, RH); x.lineTo(272, RH - 16); x.lineTo(RW - 16, RH - 16); x.lineTo(RW - 16, 48);
    x.moveTo(16, 48); x.lineTo(RW - 16, 48); x.stroke();
    x.strokeStyle = 'rgba(255,220,190,0.25)'; x.lineWidth = 0.5; x.beginPath(); x.moveTo(0.5, 48); x.lineTo(0.5, RH); x.moveTo(RW - 15.5, 48); x.lineTo(RW - 15.5, RH - 16); x.stroke();
    // --- door (16,13): opening to the street + red doormat + jambs ---
    x.fillStyle = vg(x, RH - 16, RH, '#5a3a24', '#140a06'); x.fillRect(256, RH - 16, 16, 16);
    x.fillStyle = vg(x, RH - 16, RH - 10, '#e0303e', '#8e1220'); rr(x, 257.5, RH - 15.5, 13, 5, 1.5); x.fill(); ink(x, 0.5);
    x.fillStyle = hg(x, 253.5, 258.5, '#a8784c', '#4a2c18'); rr(x, 253.5, RH - 17, 4.5, 17, 1.2); x.fill(); ink(x, 0.5);
    x.fillStyle = hg(x, 270, 275, '#a8784c', '#4a2c18'); rr(x, 270, RH - 17, 4.5, 17, 1.2); x.fill(); ink(x, 0.5);
    // --- bar counter (C tiles: row 4 cols 1-7 + row 3 col 7), L-shaped block ---
    x.fillStyle = SHADOW; rr(x, 19, 67, 112, 17, 3); x.fill(); rr(x, 115, 51, 16, 20, 3); x.fill();
    const top = () => { x.beginPath(); x.moveTo(16, 64); x.lineTo(112, 64); x.lineTo(112, 48); x.lineTo(128, 48); x.lineTo(128, 70.5); x.lineTo(16, 70.5); x.closePath(); };
    x.fillStyle = vg(x, 80, 64, '#2e1d12', '#4a3020'); x.fillRect(16, 70, 112, 10); // front face
    x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 0.6;
    for (let px = 18; px < 126; px += 8) { x.fillStyle = vg(x, 72, 79, '#4e3424', '#36241a'); rr(x, px + 0.5, 72, 6, 6.5, 1); x.fill(); x.stroke(); }
    top(); x.fillStyle = dg(x, 16, 48, 128, 71, '#b07c4c', '#6a4228'); x.fill();
    x.fillStyle = 'rgba(255,230,190,0.35)'; x.fillRect(17, 64.6, 95, 0.7); x.fillRect(112.6, 49, 0.7, 15.6);
    top(); ink(x, 0.7);
    x.lineWidth = 1; x.strokeStyle = WALL_EDGE; x.beginPath(); x.moveTo(16, 80); x.lineTo(128, 80); x.lineTo(128, 48); x.stroke();
    x.beginPath(); x.moveTo(16, 64); x.lineTo(16, 80); x.lineTo(128, 80); x.lineTo(128, 48); x.lineTo(112, 48); x.lineTo(112, 64); x.lineWidth = 0.7; x.strokeStyle = INK; x.stroke();
    // --- bar stools (row 5, decorative) ---
    for (let c = 1; c <= 6; c++) {
      const sx = c * TS + 8, sy = 5 * TS + 3.5;
      x.fillStyle = SHADOW; x.beginPath(); x.ellipse(sx + 2.5, sy + 9.5, 4.5, 1.8, 0, 0, 7); x.fill();
      x.fillStyle = hg(x, sx - 0.8, sx + 0.8, '#e4e4ea', '#55555e'); rr(x, sx - 0.8, sy + 1, 1.6, 8, 0.8); x.fill();
      x.fillStyle = vg(x, sy + 8, sy + 10, '#9a9aa4', '#3a3a42'); x.beginPath(); x.ellipse(sx, sy + 8.8, 2.8, 1, 0, 0, 7); x.fill(); ink(x, 0.35);
      const g = x.createRadialGradient(sx - 1.4, sy - 0.8, 0.3, sx, sy, 4.2); g.addColorStop(0, '#9a9ca4'); g.addColorStop(1, '#3e4046');
      x.fillStyle = g; x.beginPath(); x.ellipse(sx, sy, 4.2, 2.1, 0, 0, 7); x.fill(); ink(x, 0.5);
    }
    // --- dining tables + chairs ---
    for (let ty = 0; ty < ROWS.length; ty++) for (let tx = 0; tx < ROWS[ty].length; tx++) {
      const ch = ROWS[ty][tx], ox = tx * TS, oy = ty * TS;
      if (ch === 'c') { // grey chair, backrest on the outer side
        const left = ROWS[ty][tx + 1] === 'T', bx = left ? ox + 1.5 : ox + 9.5;
        x.fillStyle = SHADOW; rr(x, ox + 5, oy + 6, 11, 10, 3); x.fill();
        x.fillStyle = '#2a2a30'; rr(x, ox + 3.6, oy + 12, 1.4, 3.6, 0.6); x.fill(); rr(x, ox + 11, oy + 12, 1.4, 3.6, 0.6); x.fill();
        x.fillStyle = dg(x, ox + 2, oy + 6, ox + 13, oy + 14, '#a4a7ae', '#55575e'); rr(x, ox + 2.5, oy + 6.5, 11, 7, 2.5); x.fill(); ink(x);
        x.fillStyle = 'rgba(255,255,255,0.22)'; rr(x, ox + 3.6, oy + 7.3, 6, 1.1, 0.5); x.fill();
        x.fillStyle = dg(x, bx, oy, bx + 5, oy + 13, '#b4b7be', '#4c4e56'); rr(x, bx, oy + 0.5, 5, 12.5, 2.2); x.fill(); ink(x);
        x.fillStyle = 'rgba(255,255,255,0.25)'; rr(x, bx + 0.9, oy + 1.4, 1.1, 9, 0.5); x.fill();
      } else if (ch === 'T') { // table for two with a white cloth
        x.fillStyle = SHADOW; rr(x, ox + 4, oy + 7, 15, 9, 3); x.fill();
        x.fillStyle = hg(x, ox + 7, ox + 9, '#55555e', '#1e1e24'); rr(x, ox + 7, oy + 9, 2, 6, 0.8); x.fill();
        x.fillStyle = '#26262c'; x.beginPath(); x.ellipse(ox + 8, oy + 15, 3.2, 1, 0, 0, 7); x.fill();
        x.fillStyle = vg(x, oy + 8, oy + 11.5, '#d8d2c6', '#a8a296'); rr(x, ox + 0.5, oy + 7.5, 15, 4, [0, 0, 2, 2]); x.fill();
        x.fillStyle = dg(x, ox, oy + 2, ox + 16, oy + 9, '#ffffff', '#dcd7cc'); rr(x, ox + 0.5, oy + 2.5, 15, 6.5, 2); x.fill();
        rr(x, ox + 0.5, oy + 2.5, 15, 9, 2); ink(x, 0.7);
        for (const px of [ox + 3.6, ox + 12.4]) {
          x.fillStyle = '#f8f6f0'; x.beginPath(); x.ellipse(px, oy + 5.6, 2.6, 1.6, 0, 0, 7); x.fill();
          x.lineWidth = 0.4; x.strokeStyle = 'rgba(120,110,100,0.6)'; x.stroke();
          x.beginPath(); x.ellipse(px, oy + 5.6, 1.5, 0.9, 0, 0, 7); x.strokeStyle = 'rgba(150,140,128,0.4)'; x.stroke();
        }
        x.fillStyle = 'rgba(200,230,240,0.7)'; rr(x, ox + 7.2, oy + 4.2, 1.6, 2.6, 0.7); x.fill(); ink(x, 0.3);
        x.strokeStyle = '#3f7a3a'; x.lineWidth = 0.5; x.beginPath(); x.moveTo(ox + 8, oy + 4.4); x.lineTo(ox + 8, oy + 3); x.stroke();
        const rg = x.createRadialGradient(ox + 7.6, oy + 2.2, 0.2, ox + 8, oy + 2.6, 1.5); rg.addColorStop(0, '#ff5a6a'); rg.addColorStop(1, '#9a0c1c');
        x.fillStyle = rg; x.beginPath(); x.arc(ox + 8, oy + 2.6, 1.3, 0, 7); x.fill(); ink(x, 0.3);
      } else if (ch === 'P') { // hostess podium
        x.fillStyle = SHADOW; rr(x, ox + 5, oy + 5, 12, 12, 2.5); x.fill();
        x.fillStyle = dg(x, ox + 2, oy + 4, ox + 14, oy + 16, '#6a4830', '#24160c'); rr(x, ox + 2, oy + 3, 12, 13, 2); x.fill(); ink(x, 0.7);
        x.fillStyle = dg(x, ox + 1, oy + 1, ox + 15, oy + 5, '#a07048', '#4a3020'); rr(x, ox + 1, oy + 1, 14, 4, 1.5); x.fill(); ink(x, 0.6);
        x.fillStyle = 'rgba(255,230,190,0.3)'; rr(x, ox + 2, oy + 1.6, 9, 0.8, 0.4); x.fill();
        heart(x, ox + 7.5, oy + 7.5, '#e0182c', 1.1);
      }
    }
    // --- FIRST DATES heart sign on the shelves (text drawn crisp in hud) ---
    const hx = RW / 2, hy = 12;
    let g = x.createRadialGradient(hx, hy + 4, 2, hx, hy + 4, 30); g.addColorStop(0, 'rgba(255,60,90,0.45)'); g.addColorStop(1, 'rgba(255,60,90,0)');
    x.fillStyle = g; x.fillRect(hx - 32, 0, 64, 36);
    x.save(); x.translate(hx + 1.5, hy + 2.5); x.scale(5.6, 5.6); heartPath(x); x.fillStyle = 'rgba(20,10,30,0.4)'; x.fill(); x.restore();
    x.save(); x.translate(hx, hy + 1); x.scale(5.6, 5.6); heartPath(x);
    g = x.createRadialGradient(-1.2, -1.4, 0.2, 0, 0, 3.6); g.addColorStop(0, '#ff6a7c'); g.addColorStop(0.55, '#e0182c'); g.addColorStop(1, '#8a0c18');
    x.fillStyle = g; x.fill(); x.lineWidth = 0.7 / 5.6; x.strokeStyle = INK; x.stroke();
    x.fillStyle = 'rgba(255,255,255,0.35)'; x.beginPath(); x.ellipse(-1.5, -1.3, 0.8, 0.4, -0.6, 0, 7); x.fill();
    x.restore();
  }

  // tile legend: collision only (the room is painted by paintRoom, not by the 1x tile cache)
  const LEG = {
    '.': { col: '#80593a' },
    S: { col: '#77736c', solid: true },
    K: { col: '#7c5244', solid: true },
    C: { col: '#3a2618', solid: true },
    T: { col: '#80593a', solid: true },
    c: { col: '#80593a', solid: true },
    P: { col: '#80593a', solid: true },
    D: { col: '#20140c' },
  };

  // collision per tile, a bit smaller than what is drawn (no invisible edges)
  const BOX = { T: [1, 4, 15, 10], c: [3, 3, 13, 13], P: [3, 3, 13, 15] };
  function solidAt(A, px, py) {
    const tx = Math.floor(px / TS), ty = Math.floor(py / TS), ch = A.get(tx, ty);
    if (ch === '#' || ch === 'S' || ch === 'K' || ch === 'C') return true;
    const b = BOX[ch]; if (!b) return false;
    const lx = px - tx * TS, ly = py - ty * TS;
    return lx >= b[0] && lx < b[2] && ly >= b[1] && ly < b[3];
  }

  G.FirstDatesScene = () => G.MiniGame({
    id: 'firstdates', title: 'FIRST DATES',
    intro: {
      pc: 'Η υποδοχή: «Καλώς ήρθες! Κράτηση δεν έχεις, αλλά κάτι θα βρούμε.»\nWASD κίνηση · E μπαρ, φαγητό ή... ενόχληση ζευγαριών · έξοδος από την πόρτα ή Backspace.',
      mobile: 'Η υποδοχή: «Καλώς ήρθες! Κράτηση δεν έχεις, αλλά κάτι θα βρούμε.»\nJoystick κίνηση · ΚΑΝΕ για μπαρ, φαγητό ή... ενόχληση ζευγαριών · ΕΞΩ για έξοδο.',
    },
    buttons: [{ id: 'enter', label: 'ΚΑΝΕ' }, { id: 'back', label: 'ΕΞΩ', pos: [G.W - 22, 22] }],
    stick: 'stick',

    init() {
      this.A = G.Arena(ROWS, LEG);
      const look = G.state.look || G.randomLook();
      const p = this.player = new G.Ent.Person(look, DOOR[0] * TS + 8, 12 * TS + 10);
      p.solidFn = (x, y) => solidAt(this.A, x, y); p.speed = 55; p.dir = 3;
      this.bar = { look: G.LOOKS.fd_bar, x: 3 * TS + 8, y: 3 * TS + 14, dir: 0, frame: 0, kind: 'ped', path: [], wait: 1 };
      this.host = { look: G.LOOKS.fd_host, x: 13 * TS + 8, y: 12 * TS + 12, dir: 0, frame: 0, kind: 'ped', path: [] };
      this.waiters = [noId(G.LOOKS.fd_waiter1, { held: 'tray' }), noId(G.LOOKS.fd_waiter2, { held: 'tray' })].map((l, i) => ({
        look: l, x: AISLE_X[i], y: AISLE_Y[i + 1], dir: 0, frame: 0, kind: 'ped', path: [], wait: G.rand(0.5, 2) }));
      const tables = this.A.find('T');
      const free = new Set(); while (free.size < 2) free.add(G.randi(0, tables.length - 1));
      this.tables = tables.map(([tx, ty], i) => {
        const t = { tx, ty, cx: tx * TS + 8, cy: ty * TS + 8, a: null, b: null, heartT: 0, angry: 0 };
        if (!free.has(i)) {
          t.a = { look: G.randomLook(), x: (tx - 1) * TS + 8, y: ty * TS + 12, dir: 2, frame: 0, kind: 'ped' };
          t.b = { look: G.randomLook(), x: (tx + 1) * TS + 8, y: ty * TS + 12, dir: 1, frame: 0, kind: 'ped' };
        }
        return t;
      });
      this.leavers = []; this.events = [];
      this.chatT = 1.5; this.woozy = 0; this.drinks = 0; this.bothers = 0;
      this.seated = 0; this.seatTable = null; this.cool = 0; this.locked = false; this.kick = 0; this.chase = false; this.leaving = false;
      this.spot = null; this.cam = { x: 0, y: 0 }; this.camX = 0; this.camY = 0;
      this.updCam(1);
    },
    onStart() { this.say('fd_host_welcome', 'Καλώς ήρθες στο First Dates! Κάτσε όπου βρεις.', this.host, 2.6); },
    exit() { this.all().forEach(o => { o.dead = true; }); },

    all() {
      const out = [this.bar, this.host, this.player, ...this.waiters, ...this.leavers];
      this.tables.forEach(t => { if (t.a) out.push(t.a); if (t.b) out.push(t.b); });
      return out;
    },
    updCam(dt) {
      G.camFollow(this.cam, this.player.x, this.player.y, RW, RH, dt);
      this.camX = G.W >= RW ? -Math.round((G.W - RW) / 2) : this.cam.x;
      this.camY = G.H >= RH ? -Math.round((G.H - RH) / 2) : this.cam.y;
    },
    later(t, fn) { this.events.push({ t, fn }); },
    leave(text) {
      if (this.leaving) return; this.leaving = true;
      G.audio.sfx('door'); G.pop();
      if (text) G.ui.toast(text, 4);
    },

    // ---------- actions ----------
    drink() {
      G.addMoney(-DRINK, 'ΠΟΤΟ'); G.audio.sfx('coin');
      const [k, s] = BAR[Math.min(this.drinks, BAR.length - 1)]; this.drinks++;
      this.say(k, s, this.bar, 2.6);
      this.woozy = Math.min(40, this.woozy + 12); this.cool = 0.5;
    },
    eat(t) {
      const done = (price, line) => () => {
        G.addMoney(-price, 'ΦΑΓΗΤΟ'); G.state.health = 100; G.audio.sfx('coin');
        const leftSeat = !t.a;
        this.player.x = (t.tx + (leftSeat ? -1 : 1)) * TS + 8; this.player.y = t.ty * TS + 12; this.player.dir = leftSeat ? 2 : 1; this.player.frame = 0;
        this.seated = 3; this.seatTable = t; this.cool = 0.5;
        G.ui.toast(line, 4);
        const w = this.waiters[0]; w.path = [[w.x, AISLE_Y.reduce((a, b) => Math.abs(b - w.y) < Math.abs(a - w.y) ? b : a)]];
        this.say('fd_waiter_serve', 'Καλή όρεξη! Και καλή τύχη... με όλα.', w, 2.4);
      };
      G.ui.dialog('ΜΕΝΟΥ', 'Ο σερβιτόρος σού φέρνει τον κατάλογο με ένα συμπονετικό χαμόγελο. Τι θα πάρεις;', [
        { label: 'Ριζότο «Δεύτερη Ευκαιρία» €14', cb: done(14, 'Το ριζότο ήταν τέλειο. Ζωή 100%. Μοναξιά λίγο λιγότερη.') },
        { label: 'Μουσακάς για έναν €11', cb: done(11, 'Μουσακάς για έναν. Κανείς δεν σου έκλεψε μπουκιά. Ζωή 100%.') },
        { label: 'Σαλάτα avocado με αφρό avocado €9', cb: done(9, 'Πράσινο. Πολύ πράσινο. Ζωή 100% (κάπως).') },
        { label: 'Μόνο ψωμί και νερό €2', cb: done(2, 'Ο σερβιτόρος σε κοίταξε με λύπηση. Ζωή 100% πάντως.') },
        { label: 'Τίποτα, ευχαριστώ', cb: () => { this.cool = 0.4; } },
      ]);
    },
    bother(t) {
      this.bothers++; this.cool = 1.2;
      const [k, s] = G.pick(BOTHER); this.say(k, s, this.player, 2.2);
      t.heartT = 0; t.angry = 6;
      const n = this.bothers;
      this.later(1.5, () => {
        const who = t.b ? 'b' : 'a', o = t[who]; if (!o) return;
        const [k2, s2] = G.pick(ANNOY); this.say(k2, s2, o, 2.4); G.audio.sfx('hiss');
        t[who] = null;
        const wc = AISLE_X.reduce((a, b) => Math.abs(b - o.x) < Math.abs(a - o.x) ? b : a);
        const dx = DOOR[0] * TS + 8, outY = (DOOR[1] + 1) * TS + 10;
        o.path = t.ty === 7
          ? [[o.x, AISLE_Y[1]], [wc, AISLE_Y[1]], [wc, AISLE_Y[2]], [dx, AISLE_Y[2]], [dx, outY]]
          : [[o.x, AISLE_Y[2]], [dx, AISLE_Y[2]], [dx, outY]];
        this.leavers.push(o);
      });
      if (n === 2) this.later(3, () => this.say('fd_host_warn', 'Ε! Άσε τα ζευγάρια ήσυχα. Τελευταία προειδοποίηση!', this.host, 2.6));
      if (n >= 3) {
        this.locked = true;
        this.later(2.2, () => { this.chase = true; });
        this.later(3.4, () => { this.say('fd_host_kickout', 'Αυτό ήταν. Έξω! Ούτε για δεύτερο ραντεβού δεν κάνεις.', this.host, 2.6); this.kick = 2.4; });
      }
    },
    talkHost() { const [k, s] = G.pick(HOST_TALK); this.say(k, s, this.host, 2.4); this.cool = 1; },

    findSpot() {
      const p = this.player, near = (x, y, r) => Math.hypot(p.x - x, p.y - y) < r;
      if (near(DOOR[0] * TS + 8, DOOR[1] * TS + 4, 16)) return { hint: 'ΕΞΟΔΟΣ', act: () => this.leave() };
      if (near(this.host.x, this.host.y, 18)) return { hint: 'ΜΙΛΑ ΣΤΗΝ ΥΠΟΔΟΧΗ', act: () => this.talkHost() };
      if (p.y > 5 * TS && p.y < 6 * TS + 6 && p.x < 8 * TS + 4) return { hint: 'ΠΙΕΣ ΕΝΑ ΠΟΤΟ (' + G.fmtMoney(DRINK) + ')', act: () => this.drink() };
      let best = null, bd = 26;
      for (const t of this.tables) { const d = Math.hypot(p.x - t.cx, p.y - (t.cy + 4)); if (d < bd) { bd = d; best = t; } }
      if (best) {
        if (best.a || best.b) return { hint: best.a && best.b ? 'ΕΝΟΧΛΗΣΕ ΤΟ ΖΕΥΓΑΡΙ' : 'ΕΝΟΧΛΗΣΕ ΚΙ ΑΛΛΟ', act: () => this.bother(best) };
        return { hint: 'ΚΑΤΣΕ ΝΑ ΦΑΣ', act: () => this.eat(best) };
      }
      return null;
    },

    // ---------- update ----------
    update(dt) {
      if (this.leaving) return;
      this.cool -= dt; this.woozy = Math.max(0, this.woozy - dt);
      this.events.forEach(e => e.t -= dt);
      const due = this.events.filter(e => e.t <= 0); this.events = this.events.filter(e => e.t > 0); due.forEach(e => e.fn());

      // couples: hearts or awkward silence (silent bubbles)
      this.chatT -= dt;
      for (const t of this.tables) { t.heartT = Math.max(0, t.heartT - dt); t.angry = Math.max(0, t.angry - dt); }
      if (this.chatT <= 0) {
        this.chatT = G.rand(1.8, 3.2);
        const cs = this.tables.filter(t => t.a && t.b && t.angry <= 0);
        if (cs.length) { const t = G.pick(cs); if (G.chance(0.45)) t.heartT = 2.5; else G.ui.bubble(G.pick(CHAT), G.pick([t.a, t.b]), 2.2); }
      }
      // staff
      const b = this.bar;
      if (follow(b, 14, dt)) { b.dir = 0; b.wait -= dt; if (b.wait <= 0) { b.wait = G.rand(1.5, 4); b.path = [[G.randi(1, 6) * TS + 8, b.y]]; } }
      for (const w of this.waiters) {
        if (follow(w, 28, dt)) {
          w.dir = 0; w.wait -= dt;
          if (w.wait <= 0) { w.wait = G.rand(1, 3); const nx = G.pick(AISLE_X), ny = G.pick(AISLE_Y); w.path = [[nx, w.y], [nx, ny]]; }
        }
      }
      this.leavers.forEach(o => { if (follow(o, 42, dt)) o.dead = true; });
      this.leavers = this.leavers.filter(o => !o.dead);
      if (this.chase) {
        const p = this.player;
        if (Math.hypot(p.x - this.host.x, p.y - this.host.y) > 14) stepTo(this.host, p.x, p.y + 4, 55, dt); else { this.host.frame = 0; this.host.dir = 3; }
      }
      if (this.kick > 0) { this.kick -= dt; if (this.kick <= 0) { this.leave('Η υποδοχή σε πέταξε έξω από το First Dates. Ούτε δεύτερο ραντεβού.'); return; } }

      // player
      const p = this.player;
      if (this.seated > 0) {
        this.seated -= dt; p.frame = 0;
        if (this.seated <= 0) { const t = this.seatTable; p.x = t.cx; p.y = (t.ty + 1) * TS + 10; p.dir = 0; }
      } else if (!this.locked) {
        const ax = G.readAxis(); let mx = ax.x, my = ax.y;
        if (this.woozy > 0) { const k = Math.min(1, this.woozy / 8); mx += Math.sin(G.t * 2.1) * 0.45 * k; my += Math.cos(G.t * 1.6) * 0.35 * k; }
        p.move(mx * p.speed, my * p.speed, dt);
      } else p.move(0, 0, dt);

      if (G.pressed('back') && !this.locked) { this.leave(); return; }
      if (p.y >= DOOR[1] * TS + 2) { this.leave(); return; }

      this.spot = (this.locked || this.seated > 0) ? null : this.findSpot();
      if (this.spot && this.cool <= 0 && (G.pressed('enter') || G.pressed('action'))) this.spot.act();
      this.updCam(dt);
    },

    // ---------- render ----------
    render(ctx) {
      ctx.fillStyle = '#120a08'; ctx.fillRect(0, 0, G.W, G.H);
      const k = Math.min(1, this.woozy / 8), cx = this.camX, cy = this.camY;
      ctx.save();
      if (k > 0) {
        ctx.translate(G.W / 2, G.H / 2); ctx.rotate(Math.sin(G.t * 1.7) * 0.05 * k); ctx.scale(1 + 0.03 * k, 1 + 0.03 * k);
        ctx.translate(-G.W / 2 + Math.sin(G.t * 2.3) * 3 * k, -G.H / 2 + Math.cos(G.t * 1.9) * 2 * k);
      }
      // HD room background (walls, shelves, bar, stools, tables, heart sign), cached per resolution
      if (!this.bg || this.bgRS !== G.RS) { const [c, x] = G.hiCanvas(RW, RH, G.RS || 2); paintRoom(x); this.bg = c; this.bgRS = G.RS; }
      const rs = G.RS || 2;
      ctx.drawImage(this.bg, Math.round(-cx * rs) / rs, Math.round(-cy * rs) / rs, RW, RH);
      // people by depth
      const ppl = this.all().filter(o => !o.dead && o !== this.player);
      ppl.push(this.player);
      ppl.sort((a, b) => a.y - b.y).forEach(o => {
        if (o === this.player) o.draw(ctx, cx, cy);
        else G.drawPerson(ctx, o.look, o.x - cx, o.y - cy, o.dir, o.frame || 0);
      });
      // hearts / anger above tables
      for (const t of this.tables) {
        const mx = t.cx - cx, my = t.cy - 22 - cy;
        if (t.heartT > 0 && t.a && t.b) for (let i = 0; i < 3; i++) {
          const ph = ((2.5 - t.heartT) * 0.8 + i * 0.33) % 1;
          ctx.globalAlpha = 1 - ph; heart(ctx, mx + Math.sin(ph * 6 + i * 2) * 5, my - ph * 12, i % 2 ? '#ff8fb1' : '#ff2d55'); ctx.globalAlpha = 1;
        }
        if (t.angry > 0) for (const o of [t.a, t.b]) if (o) {
          const ax = o.x - cx + 5, ay = o.y - cy - 28;
          anger(ctx, ax + 2, ay + 2);
        }
      }
      ctx.restore();
      if (k > 0) { // double vision + warm haze
        ctx.globalAlpha = 0.3 * k; ctx.drawImage(ctx.canvas, 0, 0, ctx.canvas.width, ctx.canvas.height, Math.round(Math.sin(G.t * 3) * 5 * k), 0, G.W, G.H); ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(255,80,160,' + (0.12 * k).toFixed(3) + ')'; ctx.fillRect(0, 0, G.W, G.H);
      }
    },

    hud() {
      const U = G.ui, st = G.state;
      U.text(RW / 2 - this.camX, 12 - this.camY, 'FIRST', 6, '#fff', 'center', '#7a0a14');
      U.text(RW / 2 - this.camX, 19 - this.camY, 'DATES', 6, '#fff', 'center', '#7a0a14');
      U.title(8, 16, G.fmtMoney(st.money), 12, st.money < 0 ? '#ff5050' : '#7dff7a', 'left');
      U.rr(8, 21, 50, 6, 3, 'rgba(10,8,18,0.85)', 'rgba(255,255,255,0.25)');
      if (st.health > 0) U.rr(9.5, 22.5, Math.max(3, 47 * st.health / 100), 3, 1.5, st.health > 30 ? U.T.green : U.T.red);
      if (this.spot) U.pill(G.W / 2, 34, this.spot.hint, G.device === 'mobile' ? null : 'E', U.T.blue);
      if (this.woozy > 0) U.text(G.W / 2, G.H - 8, 'Ζαλίζεσαι λίγο...', 7, '#ff8fb1', 'center');
      U.drawBubbles(this.camX, this.camY);
    },
  });
})();
