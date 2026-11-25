// GTA LUBEN — cameo NPCs placed around the map (world mod: G.worldMods). No names anywhere: keys are internal.
//   court:  a player eating spanakopita on the sideline + a man in a suit who cheers every 3 baskets
//   heli:   the pilot stands by the helicopter, flies with you, and has a line when he drops you off
//   serres: a man on the platform who greets the arriving train with one word
//   port:   a fan in a yellow-black scarf who shouts when the ship leaves
//   exit:   a small excavation (one column) on the way out of town, two ladies arguing next to it
// VOICE KEYS (optional files, bubbles always show): vo_cam_onfire, vo_cam_pilot, vo_cam_telos, vo_cam_venga, vo_cam_millions
'use strict';
(function () {
  const TS = G.TS || 16;
  const INK = 'rgba(28,20,36,0.85)', SHADOW = 'rgba(20,10,30,0.28)';
  const L = k => G.LOOKS[k];
  const DIG = { x: 90, y: 10, w: 4, h: 3 }; // excavation pit (tiles), grass by the road leaving town (top-right)
  let npcs = [], lastBaskets = 0, crumbs = [], ladyT = 3;

  const say = (key, text, who, dur) => G.audio.say(key, text, who, dur);
  const near = (o, r) => { const p = G.player && (G.player.vehicle || G.player); return p && Math.hypot(p.x - o.x, p.y - o.y) < r; };
  const npc = (id, look, tx, ty, dir, extra) => Object.assign({ id, look: L(look), x: tx * TS + 8, y: ty * TS + 10, dir, frame: 0, hidden: false }, extra || {});

  function build() {
    const W = G.World, C = W.COURT || { x: 49, y: 60, w: 8, h: 6 };
    const pad = W.HELIPADS.town, ser = W.SERRES_STATION, port = W.DOCKS.port;
    npcs = [
      npc('bball', 'cam_bball', C.x + C.w + 0.4, C.y + 2, 1, { eat: 0 }),
      npc('suit', 'cam_suit', C.x - 1.3, C.y + 2.5, 2),
      npc('pilot', 'cam_pilot', pad[0] + 1.6, pad[1] + 0.6, 1, { at: 'town' }),
      npc('telos', 'cam_telos', ser[0] + 1.8, ser[1] + 0.4, 0),
      npc('venga', 'cam_venga', port[0] + 1.6, port[1] - 0.2, 0),
      npc('lady_m', 'cam_lady_m', DIG.x - 1.4, DIG.y + 1, 2),
      npc('lady_b', 'cam_lady_b', DIG.x - 2.6, DIG.y + 1, 2),
    ];
    // the two ladies face each other
    get('lady_m').dir = 1; get('lady_b').dir = 2;
  }
  const get = id => npcs.find(n => n.id === id);

  // ---------- hooks from G.ride (worldscene.js) ----------
  G.cameos = {
    depart(o) {
      if (o.kind === 'heli') get('pilot').hidden = true; // he flies you
      const v = get('venga'), p = G.player;
      if ((o.kind === 'ship' || o.kind === 'boat') && v && Math.hypot(p.x - v.x, p.y - v.y) < 160) say('cam_venga', 'VENGA VENGA!', v, 2.8);
    },
    arrive(o, ex, ey) {
      if (o.kind === 'heli') {
        const pl = get('pilot'); pl.hidden = false; pl.x = ex + 18; pl.y = ey; pl.dir = 1;
        setTimeout(() => say('cam_pilot', 'Άμα με ξαναχρειαστείς, σε βγάζω και από Κορυδαλλό.', pl, 3.4), 700);
      }
      if (o.kind === 'train' && o.to === 'ΣΕΡΡΕΣ') { const t = get('telos'); setTimeout(() => say('cam_telos', 'ΤΕΛΟΣ.', t, 2.4), 600); }
    },
  };

  const mod = {
    id: 'cameos',
    reset() { build(); lastBaskets = G.bball ? G.bball.baskets : 0; crumbs = []; },
    update(dt) {
      if (!npcs.length) build();
      // court: every 3rd basket the man in the suit cheers
      const b = G.bball ? G.bball.baskets : 0;
      if (b < lastBaskets) lastBaskets = b;
      if (b > lastBaskets) { lastBaskets = b; if (b % 3 === 0) say('cam_onfire', 'You were on fire my men!', get('suit'), 2.8); }
      // spanakopita: a bite every few seconds, a few crumbs
      const bb = get('bball'); bb.eat -= dt;
      if (bb.eat <= 0) { bb.eat = G.rand(2.5, 4.5); bb.bite = 0.35; if (near(bb, 300)) for (let i = 0; i < 4; i++) crumbs.push({ x: bb.x - 5, y: bb.y - 9, vx: G.rand(-12, 12), vy: G.rand(-6, 4), z: 0, vz: G.rand(10, 25), t: 0 }); }
      bb.bite = Math.max(0, (bb.bite || 0) - dt);
      for (const c of crumbs) { c.t += dt; c.x += c.vx * dt; c.y += c.vy * dt; c.vz -= 80 * dt; c.z = Math.max(-9, c.z + c.vz * dt); }
      crumbs = crumbs.filter(c => c.t < 1.2);
      // excavation: the line repeats while you are around
      ladyT -= dt;
      const lm = get('lady_m');
      if (ladyT <= 0) { ladyT = near(lm, 150) ? G.rand(6, 9) : 1; if (near(lm, 150)) say('cam_millions', 'Έχετε πάρει εκατομμύρια!', lm, 2.8); }
      // the ladies gesture a little while arguing
      lm.frame = Math.sin(G.t * 4) > 0.6 ? 1 : 0;
    },
    ground(ctx, camX, camY) { drawDig(ctx, DIG.x * TS - camX, DIG.y * TS - camY); },
    sprites(push, camX, camY) {
      const inView = o => o.x - camX > -30 && o.x - camX < G.W + 30 && o.y - camY > -40 && o.y - camY < G.H + 30;
      for (const n of npcs) {
        if (n.hidden || !inView(n)) continue;
        push(n.y, c => {
          G.drawPerson(c, n.look, n.x - camX, n.y - camY, n.dir, n.frame || 0);
          if (n.id === 'bball') drawPie(c, n.x - camX - 5, n.y - camY - 8 - (n.bite > 0 ? 3 : 0), n.bite > 0);
        });
      }
      for (const cr of crumbs) push(cr.y, c => { c.fillStyle = '#e8c070'; c.fillRect(cr.x - camX, cr.y - camY - cr.z - 1, 0.9, 0.9); });
      // the standing column, y-sorted so people walk behind/in front of it
      const colX = (DIG.x + 1.5) * TS - camX, colY = (DIG.y + 1.6) * TS - camY;
      if (colX > -30 && colX < G.W + 30 && colY > -60 && colY < G.H + 30) push((DIG.y + 1.6) * TS, c => drawColumn(c, colX, colY));
    },
  };

  // a triangle of spanakopita (golden filo, a green edge where it is bitten)
  function drawPie(c, x, y, bitten) {
    c.save(); c.translate(x, y);
    c.fillStyle = '#d9a440'; c.strokeStyle = INK; c.lineWidth = 0.4;
    c.beginPath(); c.moveTo(-2.6, 1.6); c.lineTo(2.6, 1.6); c.lineTo(0, -2.4); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#f2cf7a'; c.fillRect(-1.4, -0.2, 1.2, 0.5);
    if (!bitten) { c.fillStyle = '#4f8a3a'; c.fillRect(-0.8, -1.8, 1.6, 0.6); }
    c.restore();
  }
  // excavation: dug pit with stepped earth, string fence on pegs, stones, a fallen drum, a sign
  function drawDig(c, x, y) {
    const w = DIG.w * TS, h = DIG.h * TS;
    if (x > G.W + 20 || y > G.H + 20 || x + w < -20 || y + h < -20) return;
    c.fillStyle = '#9a7a52'; c.fillRect(x, y, w, h);
    c.fillStyle = '#7e6040'; c.fillRect(x + 4, y + 4, w - 8, h - 8);
    c.fillStyle = '#6a5034'; c.fillRect(x + 9, y + 9, w - 18, h - 18);
    c.fillStyle = 'rgba(255,240,210,0.18)'; for (let i = 0; i < 9; i++) c.fillRect(x + 6 + (i * 13) % (w - 12), y + 6 + (i * 7) % (h - 12), 2, 1);
    // grid strings
    c.strokeStyle = 'rgba(240,240,230,0.6)'; c.lineWidth = 0.4; c.beginPath();
    for (let i = 1; i < DIG.w; i++) { c.moveTo(x + i * TS, y + 4); c.lineTo(x + i * TS, y + h - 4); }
    c.moveTo(x + 4, y + h / 2); c.lineTo(x + w - 4, y + h / 2); c.stroke();
    // fence: pegs + red/white tape
    c.strokeStyle = '#e23a3a'; c.lineWidth = 0.8; c.setLineDash([2, 2]); c.strokeRect(x - 1, y - 1, w + 2, h + 2); c.setLineDash([]);
    c.fillStyle = '#5a3a20'; for (const [px, py] of [[x - 1, y - 1], [x + w + 1, y - 1], [x - 1, y + h + 1], [x + w + 1, y + h + 1], [x + w / 2, y - 1], [x + w / 2, y + h + 1]]) c.fillRect(px - 0.8, py - 2, 1.6, 3);
    // marble bits and a fallen column drum
    c.fillStyle = '#e6e1d4'; c.strokeStyle = INK; c.lineWidth = 0.4;
    for (const [bx, by, bw, bh] of [[x + 40, y + 30, 6, 4], [x + 47, y + 34, 4, 3], [x + 10, y + 34, 5, 3]]) { c.fillRect(bx, by, bw, bh); c.strokeRect(bx, by, bw, bh); }
    c.beginPath(); c.ellipse(x + 52, y + 14, 5, 3, 0.3, 0, 7); c.fill(); c.stroke();
    c.strokeStyle = 'rgba(150,140,120,0.7)'; c.beginPath(); c.ellipse(x + 52, y + 14, 3, 1.6, 0.3, 0, 7); c.stroke();
    // sign
    const sx = x + w / 2 - 10, sy = y + h + 4; // sign in front of the pit (the trees hide its right side)
    c.fillStyle = '#5a3a20'; c.fillRect(sx + 9.3, sy + 7, 1.4, 5);
    c.fillStyle = '#f4f0e2'; c.fillRect(sx, sy, 20, 8); c.strokeStyle = INK; c.strokeRect(sx, sy, 20, 8);
    c.fillStyle = '#1a3a6a'; c.font = 'bold 3px sans-serif'; c.textAlign = 'center'; c.fillText('ΑΝΑΣΚΑΦΗ', sx + 10, sy + 5.2);
  }
  // one standing column (broken top), with shadow
  function drawColumn(c, x, y) {
    c.fillStyle = SHADOW; c.beginPath(); c.ellipse(x + 6, y + 1, 9, 2.6, 0, 0, 7); c.fill();
    const g = c.createLinearGradient(x - 4, 0, x + 4, 0); g.addColorStop(0, '#f4f0e6'); g.addColorStop(0.6, '#dcd6c6'); g.addColorStop(1, '#a8a292');
    c.fillStyle = '#d8d2c2'; c.strokeStyle = INK; c.lineWidth = 0.5;
    c.fillRect(x - 6, y - 3, 12, 3); c.strokeRect(x - 6, y - 3, 12, 3); // base
    c.fillStyle = g; c.beginPath(); c.moveTo(x - 4, y - 3); c.lineTo(x - 3.6, y - 30); c.lineTo(x - 1, y - 31.5); c.lineTo(x + 1.5, y - 29.5); c.lineTo(x + 3.6, y - 31); c.lineTo(x + 4, y - 3); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = 'rgba(120,110,95,0.55)'; c.lineWidth = 0.35; c.beginPath();
    for (const fx of [-2, 0, 2]) { c.moveTo(x + fx, y - 4); c.lineTo(x + fx * 0.95, y - 29); } c.stroke(); // flutes
  }

  G.worldMods = G.worldMods || [];
  G.worldMods.push(mod);
})();
