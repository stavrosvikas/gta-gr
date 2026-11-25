// GTA LUBEN — pigeons on the plazas and pavements of Athens (world mod: G.worldMods)
// Small flocks peck around near the player; walk or drive close (or punch near them) and they take off with a flap.
'use strict';
(function () {
  const TS = G.TS;
  const MAX = 4, NEAR = 260, FAR = 520;
  let flocks = [], spawnT = 0;

  const okTile = (tx, ty) => {
    const W = G.World; if (W.area(tx, ty) !== 'town') return false;
    const c = W.get(tx, ty); return (c === 'S' || c === '.') && !W.propAt(tx, ty);
  };
  function spawn(px, py) {
    for (let i = 0; i < 24; i++) {
      const a = Math.random() * 6.283, d = G.rand(150, NEAR);
      const tx = Math.floor((px + Math.cos(a) * d) / TS), ty = Math.floor((py + Math.sin(a) * d) / TS);
      if (!okTile(tx, ty)) continue;
      const W = G.World, plaza = W.get(tx, ty) === 'S';
      const cx = tx * TS + 8, cy = ty * TS + 8, n = plaza ? 6 + Math.floor(Math.random() * 6) : 3 + Math.floor(Math.random() * 3);
      const birds = [];
      for (let k = 0; k < n; k++) birds.push({
        x: cx + G.rand(-14, 14), y: cy + G.rand(-10, 10), z: 0, vx: 0, vy: 0, vz: 0,
        face: Math.random() < 0.5 ? -1 : 1, hop: 0, peck: Math.random() * 3, t: Math.random() * 5,
        tone: Math.random() < 0.15 ? 'white' : Math.random() < 0.25 ? 'brown' : 'grey',
      });
      flocks.push({ cx, cy, birds, state: 'ground', t: 0 });
      return;
    }
  }
  function scare(f, sx, sy) {
    if (f.state !== 'ground') return;
    f.state = 'fly'; f.t = 0;
    for (const b of f.birds) {
      let dx = b.x - sx, dy = b.y - sy; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
      const a = Math.atan2(dy, dx) + G.rand(-0.7, 0.7), s = G.rand(70, 120);
      b.vx = Math.cos(a) * s; b.vy = Math.sin(a) * s; b.vz = G.rand(30, 55); b.delay = Math.random() * 0.25; b.face = b.vx < 0 ? -1 : 1;
    }
    const me = G.player.vehicle || G.player;
    G.audio.sfxAt('flap', f.cx, f.cy, me.x, me.y, 0.9, 380);
  }

  const mod = {
    id: 'pigeons',
    get flocks() { return flocks; },
    reset() { flocks = []; spawnT = 0; },
    update(dt) {
      const pl = G.player; if (!pl) return;
      const me = pl.vehicle || pl, spd = pl.vehicle ? Math.abs(pl.vehicle.speed || 0) : 0;
      // keep a few flocks around the player (only in the city)
      flocks = flocks.filter(f => f.state === 'gone' ? false : Math.hypot(f.cx - me.x, f.cy - me.y) < FAR);
      spawnT -= dt;
      if (spawnT <= 0 && flocks.filter(f => f.state === 'ground').length < MAX) { spawnT = G.rand(1.5, 4); spawn(me.x, me.y); }
      let nearest = 1e9;
      for (const f of flocks) {
        f.t += dt;
        if (f.state === 'ground') {
          const d = Math.hypot(f.cx - me.x, f.cy - me.y); nearest = Math.min(nearest, d);
          // spooked: someone close, a car coming fast, or a punch thrown next to them
          const punch = !pl.vehicle && pl.punchT > 0.3 && d < 50;
          if (d < (pl.vehicle ? 30 + spd * 0.2 : 34) || punch) { scare(f, me.x, me.y); continue; }
          // peds walking through also make them hop up
          for (const p of G.Sim.peds) if (Math.abs(p.x - f.cx) < 16 && Math.abs(p.y - f.cy) < 12 && p.down <= 0) { scare(f, p.x, p.y); break; }
          for (const b of f.birds) {
            b.t += dt; b.peck = (b.peck + dt * 2.4) % 3;
            if (b.hop > 0) { b.hop -= dt; b.x += b.vx * dt; b.y += b.vy * dt; }
            else if (Math.random() < dt * 0.6) { const a = Math.random() * 6.283; b.vx = Math.cos(a) * 14; b.vy = Math.sin(a) * 10; b.hop = 0.35; b.face = b.vx < 0 ? -1 : 1; }
            // stay loosely together
            b.x += (f.cx - b.x) * dt * 0.15; b.y += (f.cy - b.y) * dt * 0.15;
          }
        } else {
          let alive = 0;
          for (const b of f.birds) {
            if (b.delay > 0) { b.delay -= dt; alive++; continue; }
            b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.vz = Math.max(18, b.vz - dt * 20);
            if (b.z < 160) alive++;
          }
          if (!alive) f.state = 'gone';
        }
      }
      // cooing from the closest flock on the ground
      if (nearest < 220) { const k = 1 - nearest / 220; G.audio.loop('pigeons', 'loop_pigeons', 0.45 * k * k, 1, 0); }
    },
    ground(ctx, camX, camY) { // shadows (stay on the ground while they fly)
      ctx.fillStyle = 'rgba(20,10,30,0.22)';
      for (const f of flocks) for (const b of f.birds) {
        const x = b.x - camX, y = b.y - camY + 2; if (x < -20 || y < -20 || x > G.W + 20 || y > G.H + 20) continue;
        const s = Math.max(0.4, 1 - b.z / 140); ctx.beginPath(); ctx.ellipse(x, y, 3 * s, 1.3 * s, 0, 0, 7); ctx.fill();
      }
    },
    sprites(push, camX, camY) {
      for (const f of flocks) for (const b of f.birds) {
        const x = b.x - camX, y = b.y - camY - b.z * 0.6; if (x < -20 || y < -40 || x > G.W + 20 || y > G.H + 20) continue;
        push(b.y + (b.z > 2 ? 400 : 0), c => drawPigeon(c, x, y, b, f.state === 'fly' && !(b.delay > 0)));
      }
    },
  };

  const TONES = { grey: ['#8e93a3', '#6b7080', '#4c5060'], brown: ['#9b8370', '#7a6352', '#56443a'], white: ['#e9e7e2', '#cfccc4', '#a8a59e'] };
  function drawPigeon(c, x, y, b, flying) {
    const [body, wing, dark] = TONES[b.tone];
    c.save(); c.translate(Math.round(x), Math.round(y)); c.scale(b.face, 1);
    c.strokeStyle = 'rgba(28,20,36,0.75)'; c.lineWidth = 0.5;
    if (flying) {
      const flap = Math.sin(G.t * 26 + b.t * 7) ; // wings up/down
      c.fillStyle = wing;
      for (const s of [-1, 1]) { c.beginPath(); c.moveTo(-1, 0); c.quadraticCurveTo(-1, s * (4 + flap * 3), 3, s * (6 + flap * 3.5)); c.lineTo(2, 0); c.closePath(); c.fill(); c.stroke(); }
      c.fillStyle = body; c.beginPath(); c.ellipse(0, 0, 4, 1.8, 0, 0, 7); c.fill(); c.stroke();
      c.fillStyle = dark; c.beginPath(); c.moveTo(-4, 0); c.lineTo(-6.5, -1.4); c.lineTo(-6.5, 1.4); c.closePath(); c.fill();
      c.fillStyle = body; c.beginPath(); c.arc(4.2, 0, 1.5, 0, 7); c.fill(); c.stroke();
    } else {
      const pk = b.peck < 0.5 ? Math.sin(b.peck / 0.5 * Math.PI) * 1.6 : 0; // head bob down to peck
      c.fillStyle = dark; c.beginPath(); c.moveTo(-3, -0.5); c.lineTo(-5.5, -1.2); c.lineTo(-5.2, 0.8); c.closePath(); c.fill(); // tail
      c.fillStyle = body; c.beginPath(); c.ellipse(-0.3, -1.6, 3.6, 2.3, 0, 0, 7); c.fill(); c.stroke();
      c.fillStyle = wing; c.beginPath(); c.ellipse(-0.8, -1.9, 2.4, 1.5, -0.15, 0, 7); c.fill();
      c.fillStyle = dark; c.fillRect(-1.6, -2, 0.6, 1); c.fillRect(-0.4, -2, 0.6, 1); // wing bars
      // neck sheen + head
      c.fillStyle = Math.sin(b.t * 3) > 0 ? '#5f8a76' : '#7a5f8f'; c.beginPath(); c.arc(2.4, -2.8 + pk, 1.4, 0, 7); c.fill();
      c.fillStyle = body; c.beginPath(); c.arc(3.1, -3.8 + pk, 1.35, 0, 7); c.fill(); c.stroke();
      c.fillStyle = '#e07a3a'; c.fillRect(3.4, -4.3 + pk, 0.5, 0.5); // eye
      c.fillStyle = '#3a3238'; c.fillRect(4.3, -3.8 + pk, 1.2, 0.6); // beak
      c.fillStyle = '#d06a6a'; c.fillRect(-0.8, 0.4, 0.5, 1); c.fillRect(0.6, 0.4, 0.5, 1); // feet
    }
    c.restore();
  }

  G.worldMods = G.worldMods || [];
  G.worldMods.push(mod);
})();
