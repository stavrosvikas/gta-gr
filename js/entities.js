// GTA LUBEN — entities: player, vehicles, pedestrians, cameos, police
'use strict';
(function () {
  const TS = G.TS, Wd = G.World;
  const E = G.Ent = {};
  // shallow sea along the beach ('w'): people wade, vehicles can't enter. Closed lanes ('k') are solid for vehicles.
  const isShallowT = (tx, ty) => Wd.isShallow ? !!Wd.isShallow(tx, ty) : Wd.get(tx, ty) === 'w';
  const vehSolid = (px, py) => {
    if (Wd.solidAt(px, py)) return true;
    const tx = Math.floor(px / TS), ty = Math.floor(py / TS), c = Wd.get(tx, ty);
    return c === 'k' || c === 'w' || isShallowT(tx, ty);
  };
  E.vehSolid = vehSolid; E.isShallow = isShallowT;
  let UID = 0;

  // ================= VEHICLE =================
  const VSPEC = {
    car:     { max: 240, acc: 224, turn: 2.6, grip: 6 },
    city:    { max: 236, acc: 224, turn: 2.7, grip: 6 },
    mini:    { max: 216, acc: 210, turn: 2.9, grip: 6 },
    smart:   { max: 200, acc: 220, turn: 3.2, grip: 6 },
    sedan:   { max: 248, acc: 224, turn: 2.5, grip: 6 },
    suv:     { max: 236, acc: 208, turn: 2.4, grip: 6 },
    taxi:    { max: 240, acc: 224, turn: 2.6, grip: 6 },
    police:  { max: 280, acc: 272, turn: 2.8, grip: 7 },
    ferrari: { max: 368, acc: 400, turn: 3.1, grip: 8 },
    tincan:  { max: 176, acc: 144, turn: 2.4, grip: 3.5 },
    van:     { max: 192, acc: 160, turn: 2.2, grip: 6 },
    ambulance: { max: 230, acc: 190, turn: 2.3, grip: 6 },
    pickup:  { max: 200, acc: 176, turn: 2.3, grip: 5 },
    sheeptruck: { max: 168, acc: 128, turn: 2.1, grip: 5 },
    bus:     { max: 152, acc: 96, turn: 1.6, grip: 8 },
    truck:   { max: 128, acc: 80, turn: 1.4, grip: 8 },
    bike:    { max: 136, acc: 144, turn: 3.6, grip: 9 },
    scooter: { max: 112, acc: 200, turn: 4.4, grip: 12 },   // Lime πατίνι: ~58% of a car in town, nimble
    moto:    { max: 304, acc: 352, turn: 3.4, grip: 6 },
    dias:    { max: 304, acc: 352, turn: 3.4, grip: 7 },
    heli:    { max: 256, acc: 192, turn: 2.5, grip: 2 },
    garbage: { max: 150, acc: 90, turn: 1.5, grip: 8 },
  };
  const CAR_COLS = ['#c0392b', '#ecf0f1', '#2c3e50', '#7f8c8d', '#2980b9', '#27ae60', '#f1c40f', '#8e44ad', '#d35400', '#bdc3c7', '#111111', '#a04000'];
  // Athens fleet: mostly small hatchbacks; colours ~32% white, ~32% silver/grey, ~18% black, ~9% blue, ~9% red/bordeaux, a few others
  const wpick = list => { let t = 0; for (const [, w] of list) t += w; let r = Math.random() * t; for (const [v, w] of list) { if ((r -= w) <= 0) return v; } return list[0][0]; };
  const ATH_MODELS = [['city', 52], ['mini', 16], ['smart', 8], ['sedan', 12], ['suv', 12]];
  const ATH_COLS = [['#f2f3f5', 32], ['#c4c8cc', 14], ['#8a8f96', 10], ['#4a4e55', 8], ['#18181c', 18], ['#1f3f8f', 5], ['#3a78d8', 4], ['#c0182c', 6], ['#6e1626', 3], ['#d8c8a0', 1.5], ['#3a7a4a', 1], ['#f1c40f', 0.8], ['#e8742a', 0.8]];
  const MODEL_COLS = { smart: [['#18181c', 40], ['#f2f3f5', 35], ['#c0182c', 10], ['#e8742a', 8], ['#c4c8cc', 7]], mini: [['#c0182c', 22], ['#c4c8cc', 26], ['#f2f3f5', 22], ['#18181c', 14], ['#3a78d8', 10], ['#f1c40f', 6]] };
  E.athensCar = () => { const type = wpick(ATH_MODELS); return { type, col: wpick(MODEL_COLS[type] || ATH_COLS) }; };
  const isStreetCar = t => t === 'car' || t === 'city' || t === 'mini' || t === 'smart' || t === 'sedan' || t === 'suv';
  E.isStreetCar = isStreetCar;
  E.Vehicle = class {
    constructor(type, x, y, a = 0, col) {
      this.kind = 'veh'; this.type = type; this.x = x; this.y = y; this.a = a; this.speed = 0; this.vx = 0; this.vy = 0;
      if (type === 'car' && !col) { const m = E.athensCar(); type = m.type; col = m.col; this.type = type; } // every generic 'car' becomes an Athens street car
      this.col = col || (type === 'taxi' ? '#f6c400' : type === 'police' ? '#f4f4f4' : type === 'bus' ? '#3a7bd5' : type === 'garbage' ? '#2f8f4e' : type === 'dias' ? '#e8e8e8' : G.pick(CAR_COLS));
      this.spec = VSPEC[type] || VSPEC.car; this.driver = null; this.ai = null; this.hp = 100;
      const d = G.VEH[type]; this.len = d.h; this.wid = d.w; this.r = Math.max(d.w, d.h) / 2;
      this.parked = false; this.honk = 0; this.uid = ++UID;
    }
    get two() { return ['bike', 'scooter', 'moto', 'dias'].includes(this.type); }
    // corner points for collision
    corners(nx, ny, na) {
      const c = Math.cos(na), s = Math.sin(na), hl = this.len / 2 - 1, hw = this.wid / 2 - 1;
      const pts = [[hl, hw], [hl, -hw], [-hl, hw], [-hl, -hw], [hl, 0], [-hl, 0]];
      if (this.len > 30) pts.push([0, hw], [0, -hw]);                                               // sides too (bins are narrow)
      if (this.len > 44) pts.push([hl / 2, hw], [hl / 2, -hw], [-hl / 2, hw], [-hl / 2, -hw]);
      return pts.map(([a, b]) => [nx + a * c - b * s, ny + a * s + b * c]);
    }
    // dense footprint samples (every ~5 px along, 3-5 across): how many touch a solid (a tree trunk can't hide between corners)
    pen(x, y, a, list) {
      if (this.type === 'heli' || this.noclip) return 0;
      const f = this.solidFn || vehSolid, c = Math.cos(a), s = Math.sin(a), hl = this.len / 2 - 1, hw = this.wid / 2 - 1;
      const n = Math.max(2, Math.ceil(2 * hl / 5)), m = hw > 12 ? 4 : 2;
      let k = 0;
      for (let i = 0; i <= n; i++) {
        const al = -hl + 2 * hl * i / n;
        for (let j = 0; j <= m; j++) { const b = -hw + 2 * hw * j / m, px = x + al * c - b * s, py = y + al * s + b * c; if (f(px, py)) { k++; if (list) list.push(px, py); } }
      }
      return k;
    }
    blocked(nx, ny, na) { return this.pen(nx, ny, na) > 0; }
    // controls: throttle -1..1, steer -1..1, brake bool
    drive(dt, throttle, steer, brake) {
      const sp = this.spec, me = !!this.driver && this.driver === G.player;
      if (this.wrecked) { throttle = 0; steer = 0; brake = true; this._na = null; }   // a wreck only rolls to a stop
      if (this.recoil > 0) { this.recoil -= dt; throttle *= 0.35; }
      this._thr = throttle;                    // short recoil after a hard hit
      // the player's ride: calmer top speed in town (two-wheelers already slow), firmer brakes, much more grip
      let max = sp.max * (this.boost || 1);
      if (me && !this.two && Wd.area && Wd.area(Math.floor(this.x / TS), Math.floor(this.y / TS)) === 'town') max *= 0.8;
      if (throttle > 0) this.speed += sp.acc * throttle * dt;
      else if (throttle < 0) this.speed += (this.speed > 0 ? sp.acc * 1.6 : sp.acc * (me ? 1 : 0.6)) * throttle * dt;
      else this.speed *= Math.pow(me ? 0.3 : 0.35, dt);
      if (brake) this.speed *= Math.pow(me ? 0.006 : 0.02, dt);
      if (this.speed > max) this.speed = Math.max(max, this.speed - 300 * dt);   // entering town: ease down, no jolt
      this.speed = G.clamp(this.speed, -sp.max * 0.4, sp.max * (this.boost || 1));
      const turnF = G.clamp(Math.abs(this.speed) / 60, 0, 1) * Math.sign(this.speed || 1);
      // G.driveDirect hands over the wanted heading in _na (so turning into a wall is checked like any other move)
      const na = this._na != null ? this._na : this.a + steer * sp.turn * turnF * dt; this._na = null;
      // velocity with slight drift (almost none for the player: the car goes where it points)
      const tvx = Math.cos(na) * this.speed, tvy = Math.sin(na) * this.speed;
      const k = 1 - Math.exp(-(me ? Math.max(14, sp.grip * 2) : sp.grip) * dt);
      this.vx += (tvx - this.vx) * k; this.vy += (tvy - this.vy) * k;
      return this.resolveMove(dt, na, me);
    }
    // collision resolution for a wanted move (vx, vy over dt, heading na): never into (or deeper into) a solid.
    // Order: free move, glance along the wall (player), axis slides, turn with a tiny nudge, else bounce back.
    resolveMove(dt, na, me) {
      const world = !this.solidFn && G.Sim.vehicles.indexOf(this) >= 0, ex = this.vx, ey = this.vy;
      const x0 = this.x, y0 = this.y, a0 = this.a, nx = x0 + ex * dt, ny = y0 + ey * dt;
      if (world && (me || this.knockT > 0)) G.Sim.propHits(this, nx, ny, na, ex, ey);
      let P0 = this.pen(x0, y0, a0);
      if (P0 && world) { G.Sim.unstick(this, 2.5); P0 = this.pen(this.x, this.y, this.a); }
      const vehOK = world && !me ? G.Sim.vehMoveOK : null;   // NPCs driving freely (patrols) don't drive into other vehicles either
      const ok = (x, y, a) => { const p = this.pen(x, y, a); return (p === 0 || (P0 > 0 && p < P0)) && (!vehOK || vehOK(this, x, y, a, x0, y0, a0)); };
      const set = (x, y, a) => { this.x = x; this.y = y; this.a = a; };
      if (ok(nx, ny, na)) { set(nx, ny, na); return false; }
      // the wall: normal from the centre towards the solid samples of the wanted pose
      const pts = []; this.pen(nx, ny, na, pts);
      let cx = 0, cy = 0; for (let i = 0; i < pts.length; i += 2) { cx += pts[i]; cy += pts[i + 1]; }
      let wx = 0, wy = 0; if (pts.length) { wx = cx / (pts.length / 2) - nx; wy = cy / (pts.length / 2) - ny; }
      let wl = Math.hypot(wx, wy); if (wl < 0.01) { wx = Math.cos(na) * Math.sign(this.speed || 1); wy = Math.sin(na) * Math.sign(this.speed || 1); wl = 1; }
      wx /= wl; wy /= wl;
      const vn = Math.max(0, ex * wx + ey * wy);          // speed into the wall
      const tx = ex - vn * wx, ty = ey - vn * wy;         // what's left along the wall
      let done = false;
      if (me) { // glance off walls: keep the speed along the wall, steer a touch along it
        const ts = Math.hypot(tx, ty);
        if (ts > 8) for (const a2 of [na, a0, na + 0.12, na - 0.12, na + 0.3, na - 0.3]) {   // the wanted heading, else keep the heading (no wobble), else a small nudge
          const sx = this.x + tx * dt, sy = this.y + ty * dt;
          if (ok(sx, sy, a2)) { set(sx, sy, a2); done = true; break; }
        }
      }
      if (!done) for (const [x, y, a] of [[nx, y0, na], [x0, ny, na], [nx, y0, a0], [x0, ny, a0], [x0 + tx * dt, y0 + ty * dt, a0]]) if (ok(x, y, a)) { set(x, y, a); done = true; break; }
      if (!done && Math.abs(G.angleDiff(a0, na)) > 1e-4) { // turning in place against a wall: rotate with a small nudge away from it
        for (const k of [0, 0.8, 1.6, 2.4]) { const x = x0 - wx * k, y = y0 - wy * k; if (ok(x, y, na)) { set(x, y, na); done = true; break; } }
        if (!done) for (const k of [0.6, 1.2, 2]) { for (let i = 0; i < 8 && !done; i++) { const x = x0 + Math.cos(i * Math.PI / 4) * k, y = y0 + Math.sin(i * Math.PI / 4) * k; if (ok(x, y, na)) { set(x, y, na); done = true; } } if (done) break; }
      }
      // no real progress (or the wanted turn was refused): remember it, G.driveDirect then backs out
      const prog = Math.hypot(this.x - x0, this.y - y0), want = Math.hypot(nx - x0, ny - y0), rotNo = Math.abs(G.angleDiff(this.a, na)) > 1e-4;
      const transNo = !done || prog < 0.25 * want;
      if (transNo || (rotNo && prog < 0.5 * want + 0.05)) { this.blockT = G.t || 0; this.blockRev = transNo && (this._thr < 0 || ex * Math.cos(na) + ey * Math.sin(na) < -1); }
      // velocity after the contact: the part into the wall is gone (bounced back a little on hard hits)
      const e = vn > 70 ? (me ? 0.28 : 0.2) : 0, back = (1 + e) * vn;
      this.vx = ex - back * wx; this.vy = ey - back * wy;
      if (!done) { this.vx = -e * vn * wx; this.vy = -e * vn * wy; if (vn < 20) { this.vx = tx * 0.5; this.vy = ty * 0.5; } }
      this.speed = this.vx * Math.cos(this.a) + this.vy * Math.sin(this.a);
      if (e && me) this.recoil = 0.22;
      if (world && vn > 45) G.Sim.impact(this, vn * (1 + e), wx, wy, pts.length ? cx / (pts.length / 2) : nx + wx * this.len / 2, pts.length ? cy / (pts.length / 2) : ny + wy * this.len / 2, me);
      if (world && me) return false;                      // sounds and shakes are handled by the sim
      return vn > 60;
    }
    draw(ctx, camX, camY) {
      if (this.lime) { G.drawLime(ctx, this.x - camX, this.y - camY, this.a, this.rider, this.rider && Math.abs(this.speed) > 8); return; } // Lime πατίνι (rider stands on it)
      if (this.two) { // bike / moto / ΔΙΑΣ / vespa: 3/4 view, rider seated on top, leaning a little into turns
        const da = this._la == null ? 0 : G.angleDiff(this._la, this.a); this._la = this.a;
        const want = this.rider ? G.clamp(da * 60 * Math.abs(this.speed) / 600, -0.26, 0.26) : 0;
        this._lean = (this._lean || 0) + (want - (this._lean || 0)) * 0.15;
        G.drawRide(ctx, this.type, this.col, this.x - camX, this.y - camY, this.a, this.rider, { lean: this._lean, moving: Math.abs(this.speed) > 8, siren: this.type === 'dias' && !this.wrecked });
        return;
      }
      const dl = this.hp >= 100 ? 0 : this.wrecked ? 4 : this.hp > 80 ? 0 : this.hp > 55 ? 1 : this.hp > 30 ? 2 : 3;
      const dmg = dl ? { l: dl, z: this.dmgZ || 1, s: this.uid % 3 } : null;
      G.drawVehicle(ctx, this.type, this.col, this.x - camX, this.y - camY, this.a, this.wrecked ? null : ((this.type === 'police' || this.type === 'ambulance') && this.siren) || this.type === 'dias' ? 'siren' : this.type === 'garbage' ? 'beacon' : null, dmg);
      if (this.type === 'garbage') drawGarbageCrew(ctx, this, camX, camY);
    }
  };

  // ================= PERSON (peds, npc, player on foot) =================
  E.Person = class {
    constructor(look, x, y) {
      this.kind = 'ped'; this.look = look; this.x = x; this.y = y; this.dir = 0; this.frame = 0; this.anim = 0;
      this.vx = 0; this.vy = 0; this.speed = 34; this.down = 0; this.hp = 100; this.state = 'wander';
      this.target = null; this.timer = G.rand(0, 3); this.r = 4;
    }
    blocked(x, y) {
      if (this.noclip) return false; const f = this.solidFn || Wd.solidAt;
      if (f(x - 3, y - 2) || f(x + 3, y - 2) || f(x - 3, y + 1) || f(x + 3, y + 1)) return true;
      // vehicles (parked or moving) are solid for people on foot; if already touching one, only moving away is allowed
      return !this.solidFn && !this.ghostVeh && G.Sim.vehBlocks(this, x, y);
    }
    // standing in the shallow sea (wading/swimming: slower, drawn head-and-shoulders only)
    inWater() { return !this.solidFn && isShallowT(Math.floor(this.x / TS), Math.floor((this.y - 2) / TS)); }
    // how many of the 4 foot corners touch a wall/prop (0 = free)
    wallHits(x, y) { const f = this.solidFn || Wd.solidAt; return (f(x - 3, y - 2) ? 1 : 0) + (f(x + 3, y - 2) ? 1 : 0) + (f(x - 3, y + 1) ? 1 : 0) + (f(x + 3, y + 1) ? 1 : 0); }
    // ended up inside a wall (knocked, shoved, dropped off): slide to the nearest free spot instead of freezing there
    escapeWall(dt) {
      for (const d of [1, 2, 3, 4, 6, 8, 10, 13, 16, 20, 24, 30]) for (let i = 0; i < 16; i++) {
        const ux = Math.cos(i * Math.PI / 8), uy = Math.sin(i * Math.PI / 8), x = this.x + ux * d, y = this.y + uy * d;
        if (this.wallHits(x, y) || (!this.solidFn && G.Sim.blockedForPerson && G.Sim.blockedForPerson(x, y))) continue;
        const k = Math.min(d, Math.max(1, 80 * dt)); this.x += ux * k; this.y += uy * k; return true;
      }
      return false;
    }
    move(dx, dy, dt) {
      if ((dx || dy) && this.inWater()) { dx *= 0.6; dy *= 0.6; }
      let moved = false;
      const c0 = this.noclip ? 0 : this.wallHits(this.x, this.y);
      if (c0 && this.isPlayer) { this.escapeWall(dt); moved = true; }
      const nx = this.x + dx * dt, ny = this.y + dy * dt;
      // already touching a wall: any step that doesn't go deeper is fine (never frozen in place)
      const stuck = !this.noclip && this.wallHits(this.x, this.y);
      const ok = (x, y) => stuck ? this.wallHits(x, y) <= stuck && !(!this.solidFn && !this.ghostVeh && G.Sim.vehBlocks(this, x, y)) : !this.blocked(x, y);
      if (ok(nx, this.y)) { this.x = nx; moved = true; }
      if (ok(this.x, ny)) { this.y = ny; moved = true; }
      if (dx || dy) {
        this.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 1) : (dy > 0 ? 0 : 3);
        this.anim += dt * Math.hypot(dx, dy) / 7; this.frame = [0, 1, 0, 2][Math.floor(this.anim) % 4];
      } else this.frame = 0;
      return moved;
    }
    knock(fx, fy, force, by) {
      if (this.down > 0) return;
      this.down = 2.5 + Math.random(); this.vx = fx * force; this.vy = fy * force;
      this.lastKnock = { by: by || null, t: G.t };
      G.audio.sfx('hit');
    }
    updatePhysics(dt) {
      if (this.down > 0) {
        this.down -= dt; this.move(this.vx, this.vy, dt); this.vx *= Math.pow(0.05, dt); this.vy *= Math.pow(0.05, dt);
        return true;
      }
      return false;
    }
    draw(ctx, camX, camY) {
      if (this.hidden) return;
      if (this.preDraw) this.preDraw(ctx, camX, camY);                       // e.g. the ATM the priest is smashing
      if (this.pose === 'lie' && this.down <= 0) drawSleeper(ctx, this, this.x - camX, this.y - camY);
      else G.drawPerson(ctx, this.look, this.x - camX, this.y - camY, this.dir, this.frame, { down: this.down > 0, lift: this.lift || 0, wade: this.down <= 0 && !this.lift && this.inWater(), sit: this.pose === 'sit' && this.down <= 0, carry: this.down > 0 ? null : this.carry, cup: this.cup });
      if (this.postDraw && this.down <= 0) this.postDraw(ctx, camX, camY);   // e.g. his swinging arm
      if (this.marker) { // quest/NPC marker
        const sx = Math.round(this.x - camX), sy = Math.round(this.y - camY - 30 - Math.abs(Math.sin(G.t * 4)) * 3);
        ctx.fillStyle = this.marker; ctx.fillRect(sx - 2, sy - 5, 5, 5); ctx.fillRect(sx - 1, sy, 3, 2); ctx.fillRect(sx, sy + 2, 1, 1);
      }
    }
  };

  // ================= PLAYER =================
  E.makePlayer = function (x, y) {
    const p = new E.Person(G.state.look, x, y);
    p.isPlayer = true; p.speed = 62; p.vehicle = null; p.punchT = 0;
    return p;
  };

  // someone asleep on cardboard: sleeping bag + head on the pillow (breathing gently)
  function drawSleeper(ctx, p, x, y) {
    const L = p.look, br = Math.sin((G.t || 0) * 1.6 + p.x) * 0.3, OUT = '#1c1424';
    const bag = '#7a63b8', bagSh = '#5a4690', skin = L.skin || '#c98c62', skinSh = G.shade(skin, -0.18), hair = L.hair || '#8a8a86';
    ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // sleeping bag: flat fill + one hard shadow, thick outline
    ctx.beginPath(); ctx.ellipse(x - 1.5, y - 2, 7.6, 3.6 + br, 0, 0, 7); ctx.fillStyle = bag; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = OUT; ctx.stroke();
    ctx.save(); ctx.clip(); ctx.fillStyle = bagSh; ctx.fillRect(x - 10, y - 0.2 + br * 0.5, 18, 6); ctx.restore();
    ctx.strokeStyle = bagSh; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(x - 4.5, y - 4.8); ctx.quadraticCurveTo(x - 3.4, y - 2, x - 4.5, y + 0.8); ctx.stroke();
    ctx.fillStyle = '#e8e2f4'; ctx.beginPath(); ctx.ellipse(x + 4.2, y - 2.2, 2.2, 3.2, 0, 0, 7); ctx.fill(); // bag opening / pillow
    // big chibi head on the pillow
    const hx = x + 6.6, hy = y - 3;
    ctx.beginPath(); ctx.arc(hx, hy, 3.9, 0, 7); ctx.fillStyle = skin; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = OUT; ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.arc(hx, hy, 3.9, 0, 7); ctx.clip(); ctx.fillStyle = skinSh; ctx.beginPath(); ctx.arc(hx + 1.6, hy + 1.6, 3.6, 0, 7); ctx.fill();
    ctx.fillStyle = hair; ctx.beginPath(); ctx.arc(hx + 1.4, hy - 3.2, 3.8, 0, 7); ctx.fill(); ctx.restore();
    ctx.strokeStyle = OUT; ctx.lineWidth = 0.6; // closed eyes + beard stubble
    ctx.beginPath(); ctx.arc(hx - 1.7, hy + 0.2, 0.9, 0.2, Math.PI - 0.2); ctx.moveTo(hx + 0.9, hy + 0.2); ctx.arc(hx + 0.2, hy + 0.2, 0.9, 0.2, Math.PI - 0.2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,120,130,0.45)'; ctx.beginPath(); ctx.arc(hx - 2.6, hy + 1.6, 0.8, 0, 7); ctx.arc(hx + 1.4, hy + 1.6, 0.8, 0, 7); ctx.fill();
    if (Math.floor((G.t || 0) * 0.8 + p.x) % 2) { U_z(ctx, hx + 4, hy - 6); }
    ctx.restore();
  }
  function U_z(ctx, x, y) { ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = 'bold 4px sans-serif'; ctx.fillText('z', x, y); ctx.font = 'bold 3px sans-serif'; ctx.fillText('z', x + 2.5, y - 2.5); }
  // the flattened cardboard box they live on (the world prop keeps drawing just this once a real person is on it)
  function drawCardboard(ctx, x, y) {
    ctx.fillStyle = 'rgba(20,10,30,0.25)'; ctx.beginPath(); ctx.ellipse(x + 9, y + 14, 9, 3, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#c99d65'; ctx.strokeStyle = 'rgba(28,20,36,0.7)'; ctx.lineWidth = 0.6; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x - 1, y + 6, 18, 9, 1.5); else ctx.rect(x - 1, y + 6, 18, 9); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(120,80,40,0.55)'; ctx.beginPath(); ctx.moveTo(x + 8, y + 6.5); ctx.lineTo(x + 8, y + 14.5); ctx.stroke();
  }
  // litter spilled from a knocked bin (positions relative to the bin's tile)
  function drawLitter(ctx, L, x, y) {
    ctx.save(); ctx.lineWidth = 0.4; ctx.strokeStyle = 'rgba(28,20,36,0.7)';
    for (const b of L) {
      const px = x + b.x, py = y + b.y;
      ctx.save(); ctx.translate(px, py); ctx.rotate(b.a);
      if (b.k === 0) { ctx.fillStyle = '#f2ede4'; ctx.beginPath(); ctx.moveTo(-1.6, -1); ctx.lineTo(1.5, -1.3); ctx.lineTo(1.7, 1); ctx.lineTo(-1.3, 1.2); ctx.closePath(); ctx.fill(); ctx.stroke(); }  // paper
      else if (b.k === 1) { ctx.fillStyle = b.c; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(-1.6, -0.8, 3.2, 1.6, 0.7); else ctx.rect(-1.6, -0.8, 3.2, 1.6); ctx.fill(); ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(-1, -0.6, 2, 0.4); } // can
      else if (b.k === 2) { ctx.fillStyle = 'rgba(20,10,30,0.25)'; ctx.beginPath(); ctx.ellipse(1, 1.4, 3.2, 1.2, 0, 0, 7); ctx.fill(); const g = ctx.createRadialGradient(-1, -1, 0.3, 0, 0, 3.2); g.addColorStop(0, '#5a5a66'); g.addColorStop(1, '#141218'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 3.2, 2.5, 0, 0, 7); ctx.fill(); ctx.stroke(); } // bag
      else { ctx.strokeStyle = '#e8c23a'; ctx.lineWidth = 0.9; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, -1.5, 2, 0.5, 2.4); ctx.stroke(); } // banana peel
      ctx.restore();
    }
    ctx.restore();
  }
  // world props that became (or were replaced by) entities: taken scooters vanish, homeless cardboard keeps only the box
  function hookProps() {
    const od = Wd.drawProp; if (!od || od._ent) return;
    Wd.drawProp = function (ctx, p, x, y) {
      if (p.taken) return;
      if (p.type === 'homeless' && p.npc) { drawCardboard(ctx, x, y); return; }
      if (p.litter) drawLitter(ctx, p.litter, x, y);
      const wob = p.wob > 0.02 ? p.wob : 0;
      if (!(p.kx || p.ky || p.ka || p.kz || wob)) return od.call(this, ctx, p, x, y);
      // knocked / wobbling: offset + rotation about the foot of the prop
      const wt = (G.t || 0) * 38 + p.tx * 1.7, bx = x + 8, by = y + 14;
      ctx.save();
      ctx.translate(bx + (p.kx || 0) + (wob ? Math.sin(wt) * wob * 0.8 : 0), by + (p.ky || 0) - (p.kz || 0));
      ctx.rotate((p.ka || 0) + (wob ? Math.sin(wt * 0.8) * wob * 0.05 : 0));
      ctx.translate(-bx, -by);
      const r = od.call(this, ctx, p, x, y);
      ctx.restore(); return r;
    };
    Wd.drawProp._ent = true;
  }

  // ================= WORLD SIM (calm, readable) =================
  const S = G.Sim = { vehicles: [], peds: [], fx: [], cops: [] };
  const R = () => Wd.ROADS;
  const laneH = (h, dir) => (dir > 0 ? h.y + 3 : h.y + 1) * TS;   // eastbound on the south half
  const laneV = (v, dir) => (dir > 0 ? v.x + 1 : v.x + 3) * TS;   // southbound on the west half
  const angOf = (axis, dir) => axis === 'h' ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);

  S.reset = function () {
    S.vehicles = []; S.peds = []; S.fx = []; S.cops = [];
    S.cameoT = 25; S.diasT = G.rand(80, 120); S.taxT = G.rand(120, 180); S.wantedCool = 0; S.garbageT = G.rand(3, 8); S.jres = new Map(); S.jwait = new Map();
    S.lookPool = []; for (let i = 0; i < 24; i++) S.lookPool.push(G.randomLook());
    S.fixT = 0; S.fixInit = false; S.ferrari = null; S.ferrariGoneT = 0; S.atmDmg = S.atmDmg || 0;
    hookProps();
  };

  // ---------- people vs vehicles: cars are solid for anyone on foot ----------
  const personBox = (x, y) => ({ x, y: y - 2, c: 1, s: 0, hl: 3, hw: 2.5 });
  function vehAtPerson(x, y, skip) {
    const B = personBox(x, y), out = [];
    for (const v of S.vehicles) {
      if (v === skip || ghost(v) || v.hidden || Math.abs(v.x - x) > 52 || Math.abs(v.y - y) > 52) continue;
      if (obbHit(obbOf(v, v.x, v.y, v.a, -1), B)) out.push(v);
    }
    return out;
  }
  S.blockedForPerson = (px, py) => vehAtPerson(px, py, G.player && G.player.vehicle).length > 0;
  // moving person p to (x, y): refused if it creates an overlap with a vehicle, or goes deeper into one it already touches
  S.vehBlocks = function (p, x, y) {
    if (!S.vehicles.length) return false;
    const own = p.vehicle || (p.isPlayer && G.player.vehicle);
    for (const v of vehAtPerson(x, y, own)) {
      const was = obbHit(obbOf(v, v.x, v.y, v.a, -1), personBox(p.x, p.y));
      if (!was || G.dist(x, y, v.x, v.y) < G.dist(p.x, p.y, v.x, v.y) - 0.01) return true;
    }
    return false;
  };
  // the player on foot and pedestrians push each other apart softly (people standing still or asleep barely move)
  function pushPeople(dt) {
    const pl = G.player; if (!pl || pl.vehicle || pl.hidden || pl.down > 0 || pl.noclip) return;
    for (const p of S.peds) {
      if (p.hidden || p.noclip || p.down > 0 || p.dead) continue;
      const lying = p.pose === 'lie', ox = lying ? p.x + 1 : p.x, R_ = lying ? 9 : 7;
      const dx = pl.x - ox, dy = pl.y - p.y, d = Math.hypot(dx, dy); if (d >= R_ || d < 0.01) continue;
      const nx = dx / d, ny = dy / d, over = R_ - d, kp = p.fixed || p.cop || p.script ? 0 : 0.55;
      const px = p.x - nx * over * kp, py = p.y - ny * over * kp;
      if (kp && !p.blocked(px, py)) { p.x = px; p.y = py; }
      const back = over * (1 - kp), qx = pl.x + nx * back, qy = pl.y + ny * back;
      if (!pl.blocked(qx, pl.y)) pl.x = qx; if (!pl.blocked(pl.x, qy)) pl.y = qy;
    }
  }
  S.pushPeople = pushPeople;

  // ---------- Lime scooters: the props become rideable vehicles ----------
  const scooterPos = sc => [sc.tx * TS + 8 + (sc.ox || 0) + (sc.kx || 0), sc.ty * TS + 11 + (sc.oy || 0) + (sc.ky || 0)];
  // nearest free scooter prop within reach of (px, py): returns an enter-candidate stand-in (type 'scooter', .scooterProp)
  S.nearScooter = function (px, py, reach = 13) {
    let best = null, bd = reach;
    for (const sc of Wd.scooters || []) {
      if (sc.taken) continue; const [x, y] = scooterPos(sc), d = G.dist(x, y, px, py);
      if (d < bd) { bd = d; best = sc; }
    }
    if (!best) return null;
    const [x, y] = scooterPos(best);
    return { scooterProp: true, prop: best, type: 'scooter', kind: 'veh', x, y, a: 0, wid: 8, len: 18, ai: false, speed: 0 };
  };
  // turn a scooter prop (or a nearScooter() stand-in) into a real parked 'scooter' Vehicle; the prop disappears
  S.takeScooter = function (sc) {
    if (sc && sc.scooterProp) sc = sc.prop;
    if (!sc || sc.taken) return null;
    const [x, y] = scooterPos(sc);
    const v = new E.Vehicle('scooter', x, y, (sc.a || 0) + (sc.flip ? Math.PI : 0), '#2fbf4f');
    v.lime = true; v.prop = sc; v.parked = true; v.keep = true; sc.taken = true;
    S.vehicles.push(v); return v;
  };

  // ---------- parked cars (on the sidewalk edge, Athens style) ----------
  S.spawnParked = function () {
    for (const sp of Wd.parkedSpots) {
      const v = new E.Vehicle(G.chance(0.12) ? 'van' : G.chance(0.1) ? 'taxi' : 'car', sp.x, sp.y, sp.a + (G.chance(0.5) ? Math.PI : 0));
      // nudge it (up to 6px) away from the road so lane traffic, buses included, passes cleanly
      const hor = Math.abs(Math.sin(sp.a)) < 0.5;
      const sx = hor ? 0 : (Wd.at(sp.x + 16, sp.y) === 'R' ? -1 : Wd.at(sp.x - 16, sp.y) === 'R' ? 1 : 0);
      const sy = hor ? (Wd.at(sp.x, sp.y + 16) === 'R' ? -1 : Wd.at(sp.x, sp.y - 16) === 'R' ? 1 : 0) : 0;
      // tight against the wall (sprite may kiss it), sticking at most ~3px into the road
      const fits = () => { for (const n of [7, 6, 5]) { v.x = sp.x + sx * n; v.y = sp.y + sy * n; if (S.poseFree(v, 1, 3.5)) return true; } return false; };
      let ok = fits();
      if (!ok && v.type === 'van') { const c = new E.Vehicle('car', sp.x, sp.y, v.a); Object.assign(v, { type: c.type, col: c.col, spec: c.spec, len: c.len, wid: c.wid, r: c.r }); ok = fits(); }
      if (!ok) continue;   // never on a bin, a bus stop, a kiosk or another car, and never sticking far into the lane
      v.parked = true; v.hazard = G.chance(0.3);
      S.vehicles.push(v);
    }
    S.clearTurns();
  };

  // ---------- lane traffic ----------
  // Right-hand traffic on 4-tile roads. Cars follow their lane, turn on smooth arcs at junctions, U-turn on an arc at
  // dead ends, keep a gap to whatever is ahead (cars, buses, parked cars, the player, police, people, props, roadworks),
  // never move into another vehicle or a solid, merge around closed lanes, and give up politely when stuck.
  const ROADW = 4 * TS;
  const roadOf = L => (L.axis === 'h' ? R().h : R().v)[L.ri];
  const laneC = (axis, rd, dir) => axis === 'h' ? laneH(rd, dir) : laneV(rd, dir);   // lateral coordinate of a lane
  const alongOf = (o, axis) => axis === 'h' ? o.x : o.y;
  const latOf = (o, axis) => axis === 'h' ? o.y : o.x;
  const setAL = (v, axis, al, lt) => { if (axis === 'h') { v.x = al; v.y = lt; } else { v.y = al; v.x = lt; } };
  // outside the camera view by at least m px (uses the real camera when the world scene has one)
  const offscreen = (x, y, m = 40) => {
    const ws = G.worldScene, W_ = G.W || 480, H_ = G.H || 270;
    if (ws && typeof ws.camX === 'number' && typeof ws.camY === 'number' && G.player) {
      const pp = G.player.vehicle || G.player;   // a stale camera (scene not updated yet) must not hide someone next to the player
      const near = Math.abs(x - pp.x) <= W_ / 2 + m && Math.abs(y - pp.y) <= H_ / 2 + m;
      return !near && (x < ws.camX - m || x > ws.camX + W_ + m || y < ws.camY - m || y > ws.camY + H_ + m);
    }
    const pp = G.player.vehicle || G.player; return Math.abs(x - pp.x) > W_ / 2 + m || Math.abs(y - pp.y) > H_ / 2 + m;
  };
  S.offscreen = offscreen;
  function placeOnLane(v, axis, ri, dir, pos) {
    const rd = axis === 'h' ? R().h[ri] : R().v[ri];
    v.lane = { axis, ri, dir, shiftT: 0, lastJ: -1, plan: null, arc: null, merge: null };
    setAL(v, axis, pos, laneC(axis, rd, dir));
    v.a = angOf(axis, dir);
  }
  // ---- oriented boxes ----
  const obbOf = (v, x, y, a, m) => ({ x, y, c: Math.cos(a), s: Math.sin(a), hl: v.len / 2 + m, hw: v.wid / 2 + m });
  const AXES = (A, B) => [[A.c, A.s], [-A.s, A.c], [B.c, B.s], [-B.s, B.c]];
  const proj = (O, ax, ay) => Math.abs(O.c * ax + O.s * ay) * O.hl + Math.abs(-O.s * ax + O.c * ay) * O.hw;
  function obbHit(A, B) {
    const r = A.hl + A.hw + B.hl + B.hw; if (Math.abs(A.x - B.x) > r || Math.abs(A.y - B.y) > r) return false;
    for (const [ax, ay] of AXES(A, B)) if (Math.abs((B.x - A.x) * ax + (B.y - A.y) * ay) >= proj(A, ax, ay) + proj(B, ax, ay)) return false;
    return true;
  }
  function obbMTV(A, B) { // smallest push separating B from A: [nx, ny, depth], n from A towards B
    let best = null;
    for (const [ax, ay] of AXES(A, B)) {
      const d = (B.x - A.x) * ax + (B.y - A.y) * ay, o = proj(A, ax, ay) + proj(B, ax, ay) - Math.abs(d);
      if (o <= 0) return null;
      if (!best || o < best[2]) best = d >= 0 ? [ax, ay, o] : [-ax, -ay, o];
    }
    return best;
  }
  E.obbHit = obbHit; E.obbOf = obbOf;
  const ghost = o => o.type === 'heli' || o.noclip || o.dead;
  const pairSkip = (v, o) => o === v || ghost(o) || (v.dias && o.dias);
  // the (slightly shrunk) footprint touches a solid tile/prop, a closed lane or water
  function footSolid(v, x, y, a, shrink = 1.5, count) {
    if (v.type === 'heli' || v.noclip) return 0;
    const c = Math.cos(a), s = Math.sin(a), hl = v.len / 2 - shrink, hw = v.wid / 2 - shrink, n = Math.max(2, Math.ceil(v.len / 12));
    let k = 0;
    for (let i = 0; i <= n; i++) { const al = -hl + 2 * hl * i / n; for (const b of [-hw, 0, hw]) if (vehSolid(x + al * c - b * s, y + al * s + b * c)) { if (!count) return 1; k++; } }
    return k;
  }
  // moving from pose 0 to the new pose must not create an overlap (if already touching, only moving apart is allowed)
  function poseOK(v, x, y, a, x0, y0, a0) {
    const fs = footSolid(v, x, y, a, 1.5, true); if (fs && fs >= footSolid(v, x0, y0, a0, 1.5, true) + (footSolid(v, x0, y0, a0) ? 0 : 1)) return false; // never into (or deeper into) a solid
    const A = obbOf(v, x, y, a, -1), A0 = obbOf(v, x0, y0, a0, -1);
    for (const o of S.vehicles) {
      if (pairSkip(v, o)) continue;
      const B = obbOf(o, o.x, o.y, o.a, -1);
      if (!obbHit(A, B)) continue;
      if (!obbHit(A0, B)) return false;
      if (G.dist(x, y, o.x, o.y) < G.dist(x0, y0, o.x, o.y) - 0.01) return false;
    }
    return true;
  }
  // spawning: clear of everything, with a margin
  function poseFree(v, x, y, a, m, shrink) {
    if (footSolid(v, x, y, a, shrink)) return false;
    const A = obbOf(v, x, y, a, m);
    return !S.vehicles.some(o => o !== v && !ghost(o) && obbHit(A, obbOf(o, o.x, o.y, o.a, 0)));
  }
  S.poseFree = (v, m = 4, shrink) => poseFree(v, v.x, v.y, v.a, m, shrink);
  // what's in front of me (along my heading): free distance from my front bumper, and who it is
  function lookAhead(v, range) {
    const c = Math.cos(v.a), s = Math.sin(v.a), hl = v.len / 2, hw = v.wid / 2;
    let gap = Infinity, who = null;
    const test = (o, ox, oy, oa, ohl, ohw) => {
      const dx = ox - v.x, dy = oy - v.y, al = dx * c + dy * s; if (al <= 0 || al > range + hl + ohl + ohw) return;
      const rc = Math.abs(Math.cos(oa - v.a)), rs = Math.abs(Math.sin(oa - v.a));
      if (Math.abs(-dx * s + dy * c) >= hw + rs * ohl + rc * ohw - 1.5) return;
      const g = al - (rc * ohl + rs * ohw) - hl; if (g < gap) { gap = g; who = o; }
    };
    for (const o of S.vehicles) if (!pairSkip(v, o) && o !== v.ignore) test(o, o.x, o.y, o.a, o.len / 2, o.wid / 2);
    const pl = G.player; if (pl && !pl.vehicle && !pl.hidden) test(pl, pl.x, pl.y - 3, 0, 4, 4);
    for (const p of S.peds) if (p.down <= 0 && !p.hidden) test(p, p.x, p.y - 3, 0, 4, 4);
    return { gap, who };
  }
  // while turning: walk the arc ahead (then straight on) and report the first pose that would touch someone
  function arcLook(v, range) {
    const A = v.lane.arc, end = A.ph0 + A.sg * A.tot, rest = Math.abs(end - A.ph) * A.r;
    const pts = [];
    const peds = S.peds.filter(p => p.down <= 0 && !p.hidden && Math.abs(p.x - v.x) < 90 && Math.abs(p.y - v.y) < 90);
    const pl = G.player; if (pl && !pl.vehicle && !pl.hidden) peds.push(pl);
    const near = S.vehicles.filter(o => !pairSkip(v, o) && o !== v.ignore && Math.abs(o.x - v.x) < 130 && Math.abs(o.y - v.y) < 130);
    for (let d = 3; d <= range; d += 3) {
      let x, y, a;
      if (d <= rest) { const ph = A.ph + A.sg * d / A.r; x = A.cx + Math.cos(ph) * A.r; y = A.cy + Math.sin(ph) * A.r; a = ph + A.sg * Math.PI / 2; }
      else { const ea = end + A.sg * Math.PI / 2, ex = A.cx + Math.cos(end) * A.r, ey = A.cy + Math.sin(end) * A.r; x = ex + Math.cos(ea) * (d - rest); y = ey + Math.sin(ea) * (d - rest); a = ea; }
      const B = obbOf(v, x, y, a, 0), B0 = obbOf(v, v.x, v.y, v.a, 0);
      for (const o of near) { const O = obbOf(o, o.x, o.y, o.a, -0.5); if (obbHit(B, O)) { const t0 = obbHit(B0, O); if (!t0 || G.dist(x, y, o.x, o.y) < G.dist(v.x, v.y, o.x, o.y)) return { gap: t0 ? 0 : d - 3, who: o }; } }
      for (const p of peds) { const O = { x: p.x, y: p.y - 3, c: 1, s: 0, hl: 4, hw: 4 }; if (obbHit(B, O)) return { gap: d - 3, who: p }; }
    }
    return { gap: Infinity, who: null };
  }
  // free distance to a solid (prop, closed lane, water, wall) probing along angle `pa` at my current lateral position
  function staticGap(v, range, pa) {
    const c = Math.cos(pa), s = Math.sin(pa), hl = v.len / 2, hw = v.wid / 2 - 1.5;
    for (let d = 1; d <= range; d += 4) { const al = hl + d; for (const b of [-hw, 0, hw]) if (vehSolid(v.x + al * c - b * s, v.y + al * s + b * c)) return d - 1; }
    return Infinity;
  }
  const roadEnd = (L, rd) => L.dir > 0 ? ((L.axis === 'h' ? rd.x1 : rd.y1) + 1) * TS : (L.axis === 'h' ? rd.x0 : rd.y0) * TS;
  const uturnAt = (v, L, rd) => roadEnd(L, rd) - L.dir * (Math.max(v.len / 2, 16 + v.wid / 2) + 2);
  // distance until the next planned arc (turn or dead-end U-turn)
  function maneuverDist(v) {
    const L = v.lane; if (L.arc) return 0;
    const al = alongOf(v, L.axis);
    return Math.max(0, ((L.plan ? L.plan.ent : uturnAt(v, L, roadOf(L))) - al) * L.dir);
  }
  // closed lane ('k') on my lane within `dist` after `from`
  function worksAhead(ax, rd, dir, from, dist) {
    const lc = laneC(ax, rd, dir);
    for (let d = 0; d < dist; d += 8) { const p = from + d * dir; if ((ax === 'h' ? Wd.at(p, lc) : Wd.at(lc, p)) === 'k') return true; }
    return false;
  }
  function arcSg(ph0, ax, dir) { return Math.abs(G.angleDiff(ph0 + Math.PI / 2, angOf(ax, dir))) < Math.PI / 2 ? 1 : -1; }
  function turnArc(v, P, px = v.x, py = v.y) {
    const L = v.lane, ax = L.axis, pl = laneC(ax, roadOf(L), L.dir) + P.nd * P.r;
    const [cx, cy] = ax === 'h' ? [P.ent, pl] : [pl, P.ent];
    const ph0 = Math.atan2(py - cy, px - cx);
    return { cx, cy, r: Math.max(6, Math.hypot(px - cx, py - cy)), ph0, ph: ph0, sg: arcSg(ph0, ax, L.dir), tot: Math.PI / 2, ri: P.i, nd: P.nd };
  }
  // an arc that doesn't sweep over solids or parked cars (long vehicles can't take every corner)
  function arcFree(v, A) {
    for (let k = 1; k <= 16; k++) {
      const ph = A.ph0 + A.sg * A.tot * k / 16, x = A.cx + Math.cos(ph) * A.r, y = A.cy + Math.sin(ph) * A.r, a = ph + A.sg * Math.PI / 2;
      if (footSolid(v, x, y, a, 0.5)) return false;
      const B = obbOf(v, x, y, a, -0.5); if (S.vehicles.some(o => o.parked && obbHit(B, obbOf(o, o.x, o.y, o.a, -0.5)))) return false;
    }
    return true;
  }
  // cross roads met by my road: [{i, cr, cp(tile along my axis)}]
  // parked cars never stand where a bus has to swing through a corner
  S.clearTurns = function () {
    const bus = new E.Vehicle('bus', 0, 0, 0);
    for (const ax of ['h', 'v']) (ax === 'h' ? R().h : R().v).forEach((rd, ri) => {
      for (const dir of [1, -1]) for (const { i, cr, cp, c0, c1 } of crossings(ax, rd)) for (const nd of [1, -1]) {
        const myC = ax === 'h' ? rd.y : rd.x; if (!(nd > 0 ? myC + 6 < c1 : myC - 2 > c0)) continue;
        const ent = dir > 0 ? cp * TS : cp * TS + ROADW, lc = laneC(ax, rd, dir);
        if ((ent - (dir > 0 ? (ax === 'h' ? rd.x0 : rd.y0) * TS : ((ax === 'h' ? rd.x1 : rd.y1) + 1) * TS)) * dir < 48) continue; // no approach
        bus.lane = { axis: ax, ri, dir };
        const A = turnArc(bus, { i, nd, ent, r: Math.abs((ax === 'h' ? laneV(cr, nd) : laneH(cr, nd)) - ent) }, ax === 'h' ? ent : lc, ax === 'h' ? lc : ent);
        for (let k = 0; k <= 16; k++) {
          const ph = A.ph0 + A.sg * A.tot * k / 16, B = obbOf(bus, A.cx + Math.cos(ph) * A.r, A.cy + Math.sin(ph) * A.r, ph + A.sg * Math.PI / 2, 1.5);
          for (const o of S.vehicles) if (o.parked && !o.keep && obbHit(B, obbOf(o, o.x, o.y, o.a, 0))) o.dead = true;
        }
      }
    });
    S.vehicles = S.vehicles.filter(o => !o.dead);
  };
  // long vehicles only turn into roads that lead on to another junction (no dead-end stubs)
  function leadsOn(axT, rdT, ndT, fromTile) {
    return crossings(axT, rdT).some(o => ndT > 0 ? o.cp >= fromTile : o.cp + 4 <= fromTile);
  }
  function crossings(ax, rd) {
    const out = [], cross = ax === 'h' ? R().v : R().h, myC = ax === 'h' ? rd.y : rd.x, my0 = ax === 'h' ? rd.x0 : rd.y0, my1 = ax === 'h' ? rd.x1 : rd.y1;
    cross.forEach((cr, i) => { const c0 = ax === 'h' ? cr.y0 : cr.x0, c1 = ax === 'h' ? cr.y1 : cr.x1, cp = ax === 'h' ? cr.x : cr.y; if (myC >= c0 && myC <= c1 && cp >= my0 - 1 && cp <= my1) out.push({ i, cr, cp, c0, c1 }); });
    return out;
  }
  function uturnArc(v) {
    const L = v.lane, ax = L.axis, rd = roadOf(L), pl = (laneC(ax, rd, L.dir) + laneC(ax, rd, -L.dir)) / 2, al = alongOf(v, ax);
    const [cx, cy] = ax === 'h' ? [al, pl] : [pl, al];
    const ph0 = Math.atan2(v.y - cy, v.x - cx);
    return { cx, cy, r: Math.max(8, Math.hypot(v.x - cx, v.y - cy)), ph0, ph: ph0, sg: arcSg(ph0, ax, L.dir), tot: Math.PI, u: true };
  }
  function arcClear(v, A) { // every pose along the arc is free
    for (let k = 1; k <= 8; k++) {
      const ph = A.ph0 + A.sg * A.tot * k / 8, x = A.cx + Math.cos(ph) * A.r, y = A.cy + Math.sin(ph) * A.r, a = ph + A.sg * Math.PI / 2;
      if (footSolid(v, x, y, a)) return false;
      const B = obbOf(v, x, y, a, 1); if (S.vehicles.some(o => !pairSkip(v, o) && obbHit(B, obbOf(o, o.x, o.y, o.a, 0)))) return false;
    }
    return true;
  }
  // one raw step along the lane (mutates v); noLat freezes lane-keeping/merging for this step
  function laneStep(v, dt, speed, noLat) {
    const L = v.lane, ax = L.axis, dir = L.dir, rd = roadOf(L);
    if (L.arc) {
      const A = L.arc; let ph = A.ph + A.sg * speed * dt / A.r, done = false;
      if ((ph - A.ph0) * A.sg < 0) ph = A.ph0;   // backing up: not past the start of the arc
      if (Math.abs(ph - A.ph0) >= A.tot) { ph = A.ph0 + A.sg * A.tot; done = true; }
      L.arc = Object.assign({}, A, { ph });
      v.x = A.cx + Math.cos(ph) * A.r; v.y = A.cy + Math.sin(ph) * A.r; v.a = ph + A.sg * Math.PI / 2;
      if (done) {
        if (A.u) placeOnLane(v, ax, L.ri, -dir, alongOf(v, ax));
        else { const nax = ax === 'h' ? 'v' : 'h'; placeOnLane(v, nax, A.ri, A.nd, alongOf(v, nax)); }
        v.trip = (v.trip || 0) + 1;
      }
      return;
    }
    const al = alongOf(v, ax), step = speed * dt * dir;
    // junction ahead: decide once (deterministic per car and trip, so a refused step doesn't re-roll it)
    if (!L.plan) {
      const myC = ax === 'h' ? rd.y : rd.x, xs = crossings(ax, rd);
      for (const { i, cr, cp, c0, c1 } of xs) {
        if (i === L.lastJ) continue;
        const jc = cp * TS, ent = dir > 0 ? jc : jc + ROADW, toEnt = (ent - al) * dir;
        if (toEnt < 0 || toEnt > 50 + v.len / 2) continue;
        L.lastJ = i;
        const nOK = d => d > 0 ? myC + 6 < c1 : myC - 2 > c0;
        const lcl = laneC(ax, rd, dir), [sx0, sy0] = ax === 'h' ? [ent, lcl] : [lcl, ent];
        const planOf = d => ({ i, nd: d, ent, r: Math.abs((ax === 'h' ? laneV(cr, d) : laneH(cr, d)) - ent) });
        const opts = [1, -1].filter(d => nOK(d) && arcFree(v, turnArc(v, planOf(d), sx0, sy0)) && (v.len <= 50 || leadsOn(ax === 'h' ? 'v' : 'h', cr, d, d > 0 ? myC + 4 : myC)));
        const far = dir > 0 ? cp + 4 : cp;
        // must turn here if the road ends right after; long vehicles also turn at the last junction before a dead end
        const must = (roadEnd(L, rd) / TS - far) * dir < 3 || (v.len > 50 && !xs.some(o => dir > 0 ? o.cp >= far : o.cp + 4 <= far));
        let nd = 0;
        if (v.chase) { const ct = chaseTurn(v, ax); if (ct === 'U') { L.arc = uturnArc(v); return; } nd = ct && opts.includes(ct) ? ct : 0; if (!nd && must && opts.length) nd = opts[0]; }
        else {
          const r = G.hash(v.uid * 131 + i * 7 + (ax === 'h' ? 0 : 3), (v.trip || 0) * 17 + L.ri * 5 + (dir > 0 ? 1 : 0));
          const pTurn = must ? 1 : worksAhead(ax, rd, dir, far * TS, 260) ? 0.85 : v.type === 'garbage' ? 0.25 : 0.35;
          if (opts.length && r < pTurn) nd = opts.length > 1 ? (G.hash(v.uid + 7, i * 3 + (v.trip || 0)) < 0.5 ? 1 : -1) : opts[0];
          if (v.type === 'garbage' && !must) { // the bin round: prefer streets with bins on the kerb
            const withBins = opts.filter(d => binsOnLane({ axis: ax === 'h' ? 'v' : 'h', ri: i, dir: d }).length);
            if (withBins.length && r < 0.75) nd = withBins[0]; else if (!withBins.length && binsOnLane(L).some(b => (b[2] - al) * dir > 60)) nd = 0; // bins ahead: keep going
          }
        }
        if (nd && opts.includes(nd)) L.plan = planOf(nd);
        break;
      }
    }
    if (L.plan && (al + step - L.plan.ent) * dir >= 0) { setAL(v, ax, L.plan.ent, latOf(v, ax)); L.arc = turnArc(v, L.plan); L.plan = null; L.merge = null; L.shiftT = 0; return; }
    if (!L.plan && (al + step - uturnAt(v, L, rd)) * dir >= 0) { L.arc = uturnArc(v); L.merge = null; L.shiftT = 0; return; }
    // straight: lane keeping (and merging into the other lane around roadworks)
    const lc = laneC(ax, rd, dir), oc = laneC(ax, rd, -dir), tl = lc + (oc - lc) * (L.shiftT || 0) + Math.sign(oc - lc) * (L.bias || 0), lat = latOf(v, ax);
    const mv = noLat ? 0 : G.clamp(tl - lat, -26 * dt, 26 * dt);
    setAL(v, ax, al + step, lat + mv);
    const tilt = mv && speed > 15 ? G.clamp(Math.atan2(mv / dt, speed), -0.35, 0.35) * (ax === 'h' ? dir : -dir) : 0; // slow: just ease sideways
    const ta = angOf(ax, dir) + tilt; v.a += G.angleDiff(v.a, ta) * Math.min(1, dt * 10);
  }
  // advance along the lane; a step that would hit a vehicle or a solid is refused (returns false)
  function laneDrive(v, dt, speed, free) {
    const x0 = v.x, y0 = v.y, a0 = v.a, L0 = v.lane, copy = Object.assign({}, L0);
    const undo = () => { v.x = x0; v.y = y0; v.a = a0; Object.assign(L0, copy); v.lane = L0; };
    let ok = true;
    laneStep(v, dt, speed, false);
    if (!free && !poseOK(v, v.x, v.y, v.a, x0, y0, a0)) {
      undo(); laneStep(v, dt, speed, true);                     // try again without the sideways part
      if (!poseOK(v, v.x, v.y, v.a, x0, y0, a0)) { undo(); ok = false; }
    }
    const sp = ok ? speed : 0; v.speed = sp; v.vx = Math.cos(v.a) * sp; v.vy = Math.sin(v.a) * sp;
    return ok;
  }
  // roadworks: if my lane is closed ahead, borrow the other lane while it's clear, then come back
  function tryMerge(v) {
    const L = v.lane, ax = L.axis, rd = roadOf(L), dir = L.dir, al = alongOf(v, ax), lc = laneC(ax, rd, dir), oc = laneC(ax, rd, -dir);
    const hw = v.wid / 2 - 1.5;
    const clear = (p, c) => [-hw, 0, hw].every(b => !(ax === 'h' ? vehSolid(p, c + b) : vehSolid(c + b, p)));
    let end = null, run = 0, seen = false;
    for (let d = v.len / 2; d < 420; d += 4) { const p = al + d * dir; if (clear(p, lc)) { if (seen) { run += 4; if (run >= v.len + 12) { end = p - dir * run; break; } } } else { seen = true; run = 0; } }
    if (end == null) return false;
    const from = al - dir * v.len / 2, to = end + dir * (v.len / 2 + 10);
    if ((roadEnd(L, rd) - to) * dir < v.len) return false;
    for (let p = from; (to - p) * dir > 0; p += 4 * dir) if (!clear(p, oc)) return false;
    for (const o of S.vehicles) {
      if (o === v || ghost(o) || o.parked) continue;
      const oa = alongOf(o, ax), inWin = (oa - from) * dir > -40 && (oa - to) * dir < 110;
      if (inWin && (Math.abs(latOf(o, ax) - oc) < 18 || (o.lane && o.lane.arc) || !o.lane)) return false;
    }
    L.merge = { until: to }; L.shiftT = 1; return true;
  }
  // ---- junction boxes: one conflicting movement at a time (straight-through traffic on the same road can share) ----
  let JB = null;
  function jboxes() {
    if (JB && JB.roads === R()) return JB.list;
    const list = [];
    R().h.forEach((h, i) => R().v.forEach((vv, j) => {
      if (vv.x + 3 >= h.x0 && vv.x <= h.x1 && h.y + 3 >= vv.y0 && h.y <= vv.y1) list.push({ id: i + ':' + j, x0: vv.x * TS, y0: h.y * TS, x1: vv.x * TS + ROADW, y1: h.y * TS + ROADW, cx: vv.x * TS + 32, cy: h.y * TS + 32 });
    }));
    JB = { roads: R(), list }; return list;
  }
  function inBox(o, b, m) {
    const c = Math.abs(Math.cos(o.a)), s = Math.abs(Math.sin(o.a)), ex = c * o.len / 2 + s * o.wid / 2, ey = s * o.len / 2 + c * o.wid / 2;
    return o.x + ex > b.x0 - m && o.x - ex < b.x1 + m && o.y + ey > b.y0 - m && o.y - ey < b.y1 + m;
  }
  // distance to the stop line if I have to wait before the next junction box (Infinity = go).
  // Rules: conflicting movements take turns (straight traffic on the same road can share), whoever has waited long
  // gets the next turn, and nobody enters a box whose exit is jammed (no gridlock).
  const compat = (a, b) => a.straight && b.straight && a.axis === b.axis;
  function exitClear(v, b) {
    const L = v.lane; let ax, dir, lat;
    if (L.plan) { ax = L.axis === 'h' ? 'v' : 'h'; dir = L.plan.nd; lat = laneC(ax, (ax === 'h' ? R().h : R().v)[L.plan.i], dir); }
    else { ax = L.axis; dir = L.dir; lat = laneC(ax, roadOf(L), dir); }
    const from = dir > 0 ? (ax === 'h' ? b.x1 : b.y1) : (ax === 'h' ? b.x0 : b.y0);
    for (const o of S.vehicles) {
      if (o === v || ghost(o) || o.parked || Math.abs(latOf(o, ax) - lat) > 14 || Math.abs(o.speed || 0) > 25) continue;
      const rear = (alongOf(o, ax) - from) * dir - o.len / 2;
      if (rear > -o.len && rear < v.len + 6) return false;
    }
    return true;
  }
  function junctionGate(v) {
    const L = v.lane, now = G.t || 0; let gate = Infinity;
    S.jres = S.jres || new Map(); S.jwait = S.jwait || new Map();
    for (const b of jboxes()) {
      if (Math.abs(v.x - b.cx) > 150 || Math.abs(v.y - b.cy) > 150) continue;
      let res = S.jres.get(b.id); if (!res) { res = new Map(); S.jres.set(b.id, res); }
      const inside = inBox(v, b, -1);
      let ahead = Infinity;
      if (!inside && !L.arc) {
        const ax = L.axis, al = alongOf(v, ax), lt = latOf(v, ax), dir = L.dir;
        const [b0, b1, l0, l1] = ax === 'h' ? [b.x0, b.x1, b.y0, b.y1] : [b.y0, b.y1, b.x0, b.x1];
        if (lt > l0 && lt < l1) { const nose = al + dir * v.len / 2, d = dir > 0 ? b0 - nose : nose - b1; if (d >= -2 && d < 40) ahead = d; }
      }
      if (!inside && ahead === Infinity) { res.delete(v.uid); continue; }
      const mine = { v, t: now, straight: !L.arc && !L.plan, axis: L.axis };
      if (inside) { res.set(v.uid, mine); continue; }
      let ok = true, back = 10, why = '';
      for (const [uid, r] of res) {
        if (uid === v.uid) continue;
        if (now - r.t > 0.3 || r.v.dead || !S.vehicles.includes(r.v)) { res.delete(uid); continue; }
        if (!compat(mine, r)) { ok = false; why = 'busy'; back = Math.max(back, 10 + (r.v.len - 40) / 2); }
      }
      if (ok) for (const o of S.vehicles) { // someone without a claim in there (the player, police, a parked car)
        if (o === v || ghost(o) || res.has(o.uid) || Math.abs(o.x - b.cx) > 90 || Math.abs(o.y - b.cy) > 90) continue;
        if (inBox(o, b, -2) && !(o.lane && !o.lane.arc && mine.straight && o.lane.axis === mine.axis)) { ok = false; why = 'busy'; break; }
      }
      const w = S.jwait.get(b.id), wFresh = w && now - w.t < 0.3 && !w.v.dead;
      if (ok && wFresh && w.v !== v && now - w.since > 1.5 && !compat(mine, w)) { ok = false; why = 'turn'; } // let the long-waiting one go first
      if (ok && !exitClear(v, b)) { ok = false; why = 'exit'; }
      if (ok) { res.set(v.uid, mine); if (wFresh && w.v === v) S.jwait.delete(b.id); }
      else {
        res.delete(v.uid);
        if (why === 'busy' && (!wFresh || w.v === v)) S.jwait.set(b.id, Object.assign({}, mine, { since: wFresh && w.v === v ? w.since : now }));
        gate = Math.min(gate, Math.max(0, ahead - back)); // wait well clear: long turners overhang
      }
    }
    return gate;
  }
  // my lane runs next to roadworks on the other lane: wait before the narrow part while someone is merging through it
  function worksGate(v) {
    const L = v.lane; if (L.arc || L.merge || !(Wd.ROADWORKS || []).length) return Infinity;
    const ax = L.axis, rd = roadOf(L), dir = L.dir, oc = laneC(ax, rd, -dir), al = alongOf(v, ax), nose = al + dir * v.len / 2;
    let gate = Infinity;
    for (const r of Wd.ROADWORKS) {
      const [a0, a1, l0, l1] = ax === 'h' ? [r.x * TS, (r.x + r.w) * TS, r.y * TS, (r.y + r.h) * TS] : [r.y * TS, (r.y + r.h) * TS, r.x * TS, (r.x + r.w) * TS];
      if (oc < l0 || oc > l1) continue;                       // not on the other lane of my road
      const d = dir > 0 ? a0 - 30 - nose : nose - (a1 + 30); if (d < -4 || d > 70) continue;
      const busy = S.vehicles.some(o => o !== v && o.lane && o.lane.merge && o.lane.axis === ax && o.lane.ri === L.ri && o.lane.dir === -dir);
      if (busy) gate = Math.min(gate, Math.max(0, d));
    }
    return gate;
  }
  // the vehicle right behind me in my lane (for backing up)
  function behindOf(v) {
    const L = v.lane, ax = L.axis, al = alongOf(v, ax), lt = latOf(v, ax);
    let best = null, bd = 1e9;
    for (const o of S.vehicles) {
      if (o === v || ghost(o) || !o.lane || o.lane.axis !== ax || Math.abs(latOf(o, ax) - lt) > 14) continue;
      const d = (al - alongOf(o, ax)) * L.dir - v.len / 2 - o.len / 2; if (d > -4 && d < 14 && d < bd) { bd = d; best = o; }
    }
    return best;
  }
  const headOn = (v, o) => o.a != null && Math.cos(o.a - v.a) < -0.5;
  // how far (px) a wide vehicle should shift towards the centre line to clear parked cars poking into its lane
  function kerbBias(v) {
    const L = v.lane; if (L.arc || L.plan) return 0;
    const ax = L.axis, rd = roadOf(L), lc = laneC(ax, rd, L.dir), al = alongOf(v, ax), toC = Math.sign(laneC(ax, rd, -L.dir) - lc);
    if (jboxes().some(b => Math.abs((ax === 'h' ? b.cx : b.cy) - al) < 32 + v.len / 2 + 12 && Math.abs((ax === 'h' ? b.cy : b.cx) - lc) < 40)) return 0; // straight & centred through junctions
    let need = 0;
    for (const o of S.vehicles) {
      if (!o.parked || Math.abs(o.x - v.x) > 140 || Math.abs(o.y - v.y) > 140) continue;
      const d = (alongOf(o, ax) - al) * L.dir; if (d < -v.len / 2 - 20 || d > v.len / 2 + 90) continue;
      const vert = Math.abs(Math.sin(o.a - angOf(ax, 1))) > 0.5, oel = vert ? o.len / 2 : o.wid / 2;
      const into = v.wid / 2 + oel - 0.5 - Math.abs(latOf(o, ax) - lc);
      if (into > 0 && (latOf(o, ax) - lc) * toC < 0) need = Math.max(need, into);
    }
    if (!need) return 0;
    // never so far that it blocks oncoming traffic (wide oncoming vehicles leave less room)
    let room = 3.2;
    for (const o of S.vehicles) {
      if (o === v || o.parked || ghost(o) || !o.lane || o.lane.dir === L.dir || o.lane.axis !== ax || o.lane.ri !== L.ri) continue;
      const d = (alongOf(o, ax) - al) * L.dir; if (d < -v.len || d > v.len + 160) continue;
      room = Math.min(room, 3.2 - (o.lane.bias || 0) - Math.max(0, o.wid - 30) / 2);
    }
    return Math.max(0, Math.min(need, room));
  }
  function honkAt(v) {
    if (v.honked) return; v.honked = true;
    G.ui.bubble(G.pick(['Άντε ρε!', 'Κουνήσου!', 'Θα μείνουμε εδώ;']), v, 1.5);
  }
  function aiCar(v, dt) {
    if (v.type === 'garbage' && garbageStop(v, dt)) return;
    const L = v.lane; if (!L) { if (Math.abs(v.speed) > 1) v.drive(dt, 0, 0, true); return; }
    if (v.ignoreT > 0 && (v.ignoreT -= dt) <= 0) v.ignore = null;
    const ax = L.axis, lim = v.cruise;
    if (G.t - (v.makeRoom || -9) < 0.25 && !L.arc) { // a turning bus/truck needs the space I'm standing in
      if (!laneDrive(v, dt, -24)) { const b = behindOf(v); if (b) b.makeRoom = G.t; }
      v.curSpeed = 0; v.waitT = 0; return;
    }
    if (v.wid >= 26) L.bias = kerbBias(v);   // buses/trucks: steer a few px off parked cars that stick into the lane
    const look = L.arc ? arcLook(v, 45) : lookAhead(v, 64), sg = staticGap(v, Math.min(56, maneuverDist(v) + 4), L.arc ? v.a : angOf(ax, L.dir));
    const jg = Math.min(junctionGate(v), worksGate(v));
    const gap = Math.min(look.gap, sg, jg), isStatic = sg < look.gap && sg <= jg;
    let target = lim;
    if (gap < Infinity) target = Math.min(target, Math.max(0, (gap - 5) * 2.5));
    if (L.arc) target = Math.min(target, lim * 0.7 + 10);
    else if (L.plan) target = Math.min(target, 50 + Math.max(0, (L.plan.ent - alongOf(v, ax)) * L.dir) * 1.2);
    if (v.type === 'garbage') target = Math.min(target, binBrake(v));
    if (isStatic && sg < 40 && !L.arc && !L.merge) tryMerge(v);
    if (L.merge) {
      target = Math.min(target, lim * 0.55 + 5, Math.max(0, (sg - 8) * 2.5));
      if ((alongOf(v, ax) - L.merge.until) * L.dir > 0) { L.merge = null; L.shiftT = 0; }
      else if (look.who && look.gap < 30 && headOn(v, look.who)) { // someone's coming: back into my lane if it's still free here
        const lc = laneC(ax, roadOf(L), L.dir), [hx, hy] = ax === 'h' ? [v.x, lc] : [lc, v.y];
        if (!footSolid(v, hx, hy, angOf(ax, L.dir))) { L.merge = null; L.shiftT = 0; }
      }
    }
    const cur = v.curSpeed || 0;
    v.curSpeed = target < cur ? Math.max(target, cur - 520 * dt) : Math.min(target, cur + v.spec.acc * 0.45 * dt);
    if (v.backT > 0) { v.backT -= dt; laneDrive(v, dt, -16); v.curSpeed = 0; return; } // wedged: ease back a little
    const ok = laneDrive(v, dt, v.curSpeed);
    if (!ok) v.curSpeed *= 0.5;
    v.refusedT = ok || v.curSpeed < 1 && !(L.shiftT || L.bias) ? 0 : (v.refusedT || 0) + dt;
    if (v.refusedT > 1.5 && !L.arc) { v.refusedT = 0; v.backT = 0.6; }
    // held up?
    const held = target < 3 || !ok;
    v.waitT = held ? (v.waitT || 0) + dt : Math.max(0, (v.waitT || 0) - dt * 2);
    v.blocker = isStatic ? null : look.who;
    if (L.arc && look.who && look.who.lane && !look.who.lane.arc && look.who.ai && v.waitT > 0.6) look.who.makeRoom = G.t;
    const pl = G.player, atPlayer = !isStatic && look.who && (look.who === pl || look.who === pl.vehicle);
    if (atPlayer && v.waitT > 1.5) honkAt(v);   // the only horn: when the player is the one in the way
    if (gap > 30) v.honked = false;
    // deadlock breakers: mutual block -> the older car stops "seeing" the other (it still can't drive into it)
    const o = v.blocker;
    if (v.waitT > 2.5 && o && o.waitT > 2 && o.blocker === v && v.uid < o.uid) { v.ignore = o; v.ignoreT = 3; }
    if (v.waitT > 9 && !v.keep && offscreen(v.x, v.y, 60)) { v.dead = true; S.stuckGone = (S.stuckGone || 0) + 1; return; }
    if (!L.arc && (v.waitT > 10 || (isStatic && v.waitT > 3 && !L.merge)) && !atPlayer) {
      const A = uturnArc(v); if (arcClear(v, A)) { L.arc = A; L.plan = null; L.merge = null; L.shiftT = 0; v.waitT = 0; return; }
    }
    // back up a little to give the other one room: at once for a car squeezing past roadworks towards me,
    // otherwise after a long wait (only the younger car of a pair does it)
    const intruder = o && o.lane && headOn(v, o) && (o.lane.merge || Math.abs(latOf(o, o.lane.axis) - laneC(o.lane.axis, roadOf(o.lane), o.lane.dir)) > 6);
    const yieldMerge = intruder && v.waitT > 0.8;
    if (yieldMerge || (v.waitT > 13 && (!o || !o.uid || v.uid > o.uid))) {
      if (!laneDrive(v, dt, yieldMerge ? -22 : -10)) { const b = behindOf(v); if (b && yieldMerge) b.makeRoom = G.t; }
      v.curSpeed = 0;
    }
  }
  // gentle push-apart for any residual overlap (player's car and parked cars don't get pushed)
  function separate() {
    const vs = S.vehicles, pv = G.player && G.player.vehicle;
    const mov = v => v !== pv && !v.parked && !ghost(v) && !!(v.ai || v.chase || v.dias || v.wrecked);
    for (let i = 0; i < vs.length; i++) {
      const a = vs[i]; if (ghost(a)) continue; const ma = mov(a);
      for (let j = i + 1; j < vs.length; j++) {
        const b = vs[j]; if (ghost(b) || (a.dias && b.dias)) continue;
        const mb = mov(b); if (!ma && !mb) continue;
        if (Math.abs(a.x - b.x) > 110 || Math.abs(a.y - b.y) > 110) continue;
        const m = obbMTV(obbOf(a, a.x, a.y, a.a, -0.5), obbOf(b, b.x, b.y, b.a, -0.5)); if (!m) continue;
        const push = Math.min(m[2] + 0.3, 6), k = ma && mb ? 0.5 : 1;
        const shove = (v, sgn) => { const x = v.x + m[0] * push * k * sgn, y = v.y + m[1] * push * k * sgn; if ((!footSolid(v, x, y, v.a) || footSolid(v, v.x, v.y, v.a)) && S.vehMoveOK(v, x, y, v.a, v.x, v.y, v.a, v === a ? b : a)) { v.x = x; v.y = y; } };
        if (ma) shove(a, -1); if (mb) shove(b, 1);
      }
    }
  }
  S.separate = separate;

  // ================= CRASH PHYSICS: impacts, dents, knockable props, never stuck =================
  const MASS = { bus: 10, truck: 12, garbage: 11, sheeptruck: 6, van: 2.4, ambulance: 2.5, pickup: 2.2, suv: 1.7, sedan: 1.45, car: 1.3, city: 1.25, taxi: 1.35, police: 1.4, ferrari: 1.3, mini: 1.05, smart: 0.9, tincan: 1, moto: 0.35, dias: 0.4, bike: 0.2, scooter: 0.2, heli: 50 };
  const massOf = v => MASS[v.type] || 1.3;
  E.massOf = massOf;
  const DIRS16 = Array.from({ length: 16 }, (_, i) => [Math.cos(i * Math.PI / 8), Math.sin(i * Math.PI / 8)]);
  // pose with no solid under the footprint and no other vehicle overlapping
  function vehClear(v, x, y, a) {
    if (v.pen(x, y, a)) return false;
    const A = obbOf(v, x, y, a, -1);
    for (const o of S.vehicles) { if (pairSkip(v, o) || Math.abs(o.x - x) > 110 || Math.abs(o.y - y) > 110) continue; if (obbHit(A, obbOf(o, o.x, o.y, o.a, -1))) return false; }
    return true;
  }
  // inside a wall or another car: slide out along the shortest free direction, at most maxStep px per frame (never a far teleport)
  S.unstick = function (v, maxStep = 3) {
    if (v.type === 'heli' || v.noclip || v.solidFn) return 0;
    if (vehClear(v, v.x, v.y, v.a)) return 0;
    for (const d of [0.75, 1.5, 2.5, 3.5, 5, 6.5, 8, 10, 12, 15]) for (const [ux, uy] of DIRS16)
      if (vehClear(v, v.x + ux * d, v.y + uy * d, v.a)) { const k = Math.min(d, maxStep); v.x += ux * k; v.y += uy * k; return d; }
    for (const da of [0.12, -0.12, 0.25, -0.25, 0.4, -0.4]) for (const d of [0, 2, 4, 7]) for (const [ux, uy] of (d ? DIRS16 : [[0, 0]]))
      if (vehClear(v, v.x + ux * d, v.y + uy * d, v.a + da)) { const k = Math.min(d, maxStep); v.x += ux * k; v.y += uy * k; v.a += G.clamp(da, -0.1, 0.1); return Math.max(d, 1); }
    return -1;
  };
  S.vehClear = vehClear;
  // the vehicle half of poseOK: no new overlap with another vehicle, and no deeper into one already touched
  S.vehMoveOK = function (v, x, y, a, x0, y0, a0, skip) {
    const A = obbOf(v, x, y, a, -1), A0 = obbOf(v, x0, y0, a0, -1);
    for (const o of S.vehicles) {
      if (o === skip || pairSkip(v, o) || Math.abs(o.x - x) > 110 || Math.abs(o.y - y) > 110) continue;
      const B = obbOf(o, o.x, o.y, o.a, -1); if (!obbHit(A, B)) continue;
      if (!obbHit(A0, B) || G.dist(x, y, o.x, o.y) < G.dist(x0, y0, o.x, o.y) - 0.01) return false;
    }
    return true;
  };
  // a shove may not push a car into (or deeper into) anything: dense footprint + the usual vehicle rule
  const shoveOK = (v, x, y, a, x0, y0, a0) => { const p = v.pen(x, y, a); if (p && p > v.pen(x0, y0, a0)) return false; return poseOK(v, x, y, a, x0, y0, a0); };
  // ---------- damage ----------
  const zoneOf = (v, nx, ny) => { const c = Math.cos(v.a), s = Math.sin(v.a), lx = nx * c + ny * s, ly = -nx * s + ny * c; return Math.abs(lx) >= Math.abs(ly) ? (lx > 0 ? 1 : 2) : (ly > 0 ? 4 : 8); };
  function wreck(v) {
    v.wrecked = true; v.hazard = false; v.siren = false; v.boost = 0;
    if (v.ai && !v.two) { // the driver jumps out and runs
      const a = v.a + Math.PI / 2, off = v.wid / 2 + 8;
      for (const sg of [1, -1]) {
        const drv = new E.Person(v.rider || G.randomLook(), v.x + Math.cos(a) * off * sg, v.y + Math.sin(a) * off * sg + 4);
        if (drv.blocked(drv.x, drv.y)) continue;
        drv.state = 'flee'; drv.timer = 4; S.peds.push(drv); G.audio.say('driver_angry', G.pick(['Το αμάξι μου!', 'Μου το διέλυσες!', 'Ασφάλεια έχει, δεν πειράζει…']), drv, 1.8); break;
      }
    }
    if (v.ai || v.chase) { v.ai = null; v.lane = null; v.chase = false; v.rider = null; }
    if (v.driver === G.player) G.ui.toast('Το αμάξι διαλύθηκε! Βγες και βρες άλλο.', 3);
  }
  // dv: the jolt this vehicle felt (px/s); n: from it towards what it hit
  function damageVeh(v, dv, nx, ny) {
    if (v.type === 'heli' || v.lime || v.noclip || v.wrecked || dv < 50) return;
    const k = massOf(v) > 5 ? 0.45 : 1;
    v.hp = Math.max(0, (v.hp == null ? 100 : v.hp) - (dv - 50) * 0.18 * k);
    v.dmgZ = (v.dmgZ || 0) | zoneOf(v, nx, ny);
    if (v.parked && !v.keep && !v.home) v.home = { x: v.x, y: v.y, a: v.a };
    if (v.hp <= 0) wreck(v);
  }
  S.damageVeh = damageVeh;
  function crashFx(x, y, dv) {
    if (S.fx.length > 220) return;
    const n = Math.min(7, 2 + Math.floor(dv / 50));
    for (let i = 0; i < n; i++) S.fx.push({ type: 'spark', x: x + G.rand(-2, 2), y: y + G.rand(-2, 2), t: 0, dur: 0.18 + Math.random() * 0.15 });
    for (let i = 0; i < n; i++) { const a = Math.random() * 7, s = G.rand(20, 60); S.fx.push({ type: 'debris', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, a, t: 0, dur: 0.9 + Math.random() * 0.6, c: G.pick(['#dfe8f2', '#c8d4e0', '#3a3a40', '#e8302a']) }); }
  }
  // a vehicle hit something static (wall, tree, kiosk...) with jolt dv
  S.impact = function (v, dv, nx, ny, px, py, me) {
    damageVeh(v, dv, nx, ny);
    const t = G.t || 0;
    if (dv > 70 && t - (v.crashT == null ? -9 : v.crashT) > 0.35) {
      v.crashT = t;
      if (me || !offscreen(v.x, v.y, 0)) { G.audio.sfx('crash', Math.min(1, 0.35 + dv / 400)); crashFx(px, py, dv); }
      if (me) G.ui.shake(Math.min(6, 1.5 + dv / 70));
    }
  };
  // ---------- knockable props ----------
  const KP = new Set();                                              // props/pieces currently moving, wobbling or knocked
  const LIGHT = { bin: 45, suitcase: 12, scooter: 14 };              // speed needed to send them flying
  const WOBBLE = { bench: 1.6, signpost: 2.2, shrine: 1, bale: 1.4, hoop: 0.7, sentry: 0.7, evzone: 0.5, kiosk: 0.7, fridge: 1, stop: 0.8 };
  const LITTER_C = ['#d0302c', '#2f7fd0', '#e8c23a', '#9aa0a8', '#3a9a4a'];
  function spill(p, vx, vy) {
    const n = p.over ? 10 : 6, out = [];
    for (let i = 0; i < n; i++) {
      const k = p.over && i < 3 ? 2 : G.pick([0, 0, 1, 1, 3]), j = G.rand(0.25, 0.75);
      out.push({ x: 8 + G.rand(-2, 2), y: 12 + G.rand(-2, 2), vx: vx * j + G.rand(-30, 30), vy: vy * j + G.rand(-30, 30), a: Math.random() * 7, k, c: G.pick(LITTER_C) });
    }
    p.litter = out;
  }
  function knockProp(p, vx, vy, spd) {
    if (!p.knocked) {
      p.knocked = true; p.k0 = { solid: p.solid, over: p.over, lying: p.lying, lid: p.lidOpen };
      p.solid = false;
      if (p.type === 'bin') { spill(p, vx, vy); p.over = false; p.lidOpen = false; }
      if (p.type === 'scooter') p.lying = true;
      G.audio.sfx('hit', 0.5);
    }
    const j = G.rand(0.75, 1.05), sd = G.rand(-0.15, 0.15) * spd, ux = vx / (spd || 1), uy = vy / (spd || 1);
    p.kx = p.kx || 0; p.ky = p.ky || 0; p.ka = p.ka || 0; p.kz = p.kz || 0;
    p.kvx = (p.kvx || 0) * 0.3 + vx * j - uy * sd; p.kvy = (p.kvy || 0) * 0.3 + vy * j + ux * sd;
    p.kva = (Math.random() < 0.5 ? -1 : 1) * (4 + spd / 25);
    p.kvz = p.type === 'scooter' ? 18 : 30 + Math.min(spd, 200) * 0.25;
    p.knT = 0; KP.add(p);
  }
  function hitProp(p, v, vx, vy, spd) {
    const t = G.t || 0;
    if (p.taken || p.type === 'homeless' || (p.hitT != null && t - p.hitT < 0.25)) return;
    const th = LIGHT[p.type];
    if (th != null) {
      if (spd < th) { if (p.solid && !(p.wob > 0.4)) { p.wob = 0.8; KP.add(p); } return; }
      p.hitT = t; knockProp(p, vx, vy, spd);
      const f = p.type === 'bin' ? 0.85 : 0.96; v.vx *= f; v.vy *= f; v.speed *= f;
      return;
    }
    const w = WOBBLE[p.type];
    if (w && spd > 25) { p.hitT = t; p.wob = Math.min(w * 1.6, Math.max(p.wob || 0, w * Math.min(1.6, spd / 90))); KP.add(p); }
  }
  // roadworks dressing (cones, barriers) lives in W.bigStatics; find those pieces from the ROADWORKS layout
  let WORKS = null, WORKS_SRC = null;
  function worksList() {
    if (WORKS && WORKS_SRC === Wd.bigStatics) return WORKS;
    WORKS_SRC = Wd.bigStatics; WORKS = [];
    const cand = [];
    for (const r of Wd.ROADWORKS || []) {
      const hz = r.axis === 'h', x0 = r.x * TS, y0 = r.y * TS, x1 = (r.x + r.w) * TS, y1 = (r.y + r.h) * TS;
      for (const openLow of [true, false]) {
        if (hz) {
          const by = openLow ? y1 - 2 : y0 + 3;
          for (let x = x0 + 2; x < x1 - 4; x += 16) cand.push([x + 7, by, 'bar']);
          for (const ex of [x0 + 3, x1 - 3]) for (let k = 0; k < 2; k++) cand.push([ex, y0 + 8 + k * 16, 'bar']);
          for (const [ex, d] of [[x0, -1], [x1, 1]]) for (let k = 0; k < 3; k++) cand.push([ex + d * (6 + k * 9), openLow ? y0 + 22 - k * 8 : y1 - 22 + k * 8, 'cone']);
        } else {
          const bx = openLow ? x1 - 3 : x0 + 3;
          for (let y = y0 + 8; y < y1 - 2; y += 16) cand.push([bx, y + 4, 'bar']);
          for (const ey of [y0 + 3, y1 - 1]) cand.push([(x0 + x1) / 2, ey, 'bar']);
          for (const [ey, d] of [[y0, -1], [y1, 1]]) for (let k = 0; k < 3; k++) cand.push([openLow ? x0 + 22 - k * 8 : x1 - 22 + k * 8, ey + d * (6 + k * 9), 'cone']);
        }
      }
    }
    for (const o of Wd.bigStatics || []) {
      if (o.ax == null || typeof o.draw !== 'function') continue;
      const c = cand.find(([x, y]) => Math.abs(x - o.ax) < 0.01 && Math.abs(y - o.ay) < 0.01); if (!c) continue;
      o.wk = c[2]; o.b0 = [o.x0, o.y0, o.x1, o.y1]; o.kx = o.kx || 0; o.ky = o.ky || 0; o.ka = o.ka || 0; o.kz = o.kz || 0;
      if (!o._d0) { const d0 = o._d0 = o.draw; o.draw = (ctx, sx, sy) => drawPiece(o, d0, ctx, sx, sy); }
      WORKS.push(o);
    }
    return WORKS;
  }
  function drawPiece(o, d0, ctx, sx, sy) {
    const wob = o.wob > 0.02 ? o.wob : 0;
    if (!(o.kx || o.ky || o.ka || o.kz || wob)) return d0(ctx, sx, sy);
    const wt = (G.t || 0) * 38 + o.ax * 0.1;
    ctx.save(); ctx.translate(sx + o.kx + (wob ? Math.sin(wt) * wob * 0.8 : 0), sy + o.ky - o.kz); ctx.rotate(o.ka + (wob ? Math.sin(wt * 0.8) * wob * 0.04 : 0));
    d0(ctx, 0, 0); ctx.restore();
  }
  // a vehicle's footprint at pose (x, y, a) moving with (vx, vy): knock the props it touches
  S.propHits = function (v, x, y, a, vx, vy) {
    const spd = Math.hypot(vx, vy); if (spd < 10 || !Wd.propAt) return;
    const c = Math.cos(a), s = Math.sin(a), hl = v.len / 2 + 1, hw = v.wid / 2 + 1, seen = new Set(), n = Math.max(2, Math.ceil(2 * hl / 6));
    for (let i = 0; i <= n; i++) {
      const al = -hl + 2 * hl * i / n;
      for (const b of [-hw, 0, hw]) {
        const px = x + al * c - b * s, py = y + al * s + b * c, tx = Math.floor(px / TS), ty = Math.floor(py / TS), key = tx * 4096 + ty;
        if (seen.has(key)) continue; seen.add(key);
        const p = Wd.propAt(tx, ty); if (p) hitProp(p, v, vx, vy, spd);
      }
    }
    const t = G.t || 0;
    for (const o of worksList()) {
      const dx = o.ax + o.kx - x, dy = o.ay + o.ky - y; if (Math.abs(dx) > hl + hw + 6 || Math.abs(dy) > hl + hw + 6) continue;
      const al = dx * c + dy * s, lt = -dx * s + dy * c; if (Math.abs(al) > hl + 3 || Math.abs(lt) > hw + 3) continue;
      if (o.hitT != null && t - o.hitT < 0.25) continue;
      if (o.wk === 'cone') { o.hitT = t; knockProp(o, vx, vy, spd); }
      else if (spd > 30) { // barrier: wobble and shove a little (the closed lane stays closed)
        o.hitT = t; o.wob = Math.min(2.4, Math.max(o.wob || 0, spd / 70)); o.knocked = true; o.knT = 0;
        o.kx = G.clamp(o.kx + vx / spd * Math.min(3, spd / 60), -6, 6); o.ky = G.clamp(o.ky + vy / spd * Math.min(3, spd / 60), -6, 6);
        KP.add(o); G.audio.sfx('hit', 0.4);
      }
    }
  };
  const hardAt = (x, y) => Wd.at(x, y) !== 'k' && Wd.solidAt(x, y);
  function settleA(p) {
    const H = Math.PI / 2;
    if (p.type === 'bin' || p.wk === 'cone') return Math.round((p.ka - H) / Math.PI) * Math.PI + H; // lying on its side
    if (p.type === 'suitcase') return Math.round(p.ka / H) * H;
    return p.ka;
  }
  function tileFree(p) {
    if (!p.k0 || !p.k0.solid) return true;
    const B = { x: p.tx * TS + 8, y: p.ty * TS + 8, c: 1, s: 0, hl: 8, hw: 8 };
    if (S.vehicles.some(o => !ghost(o) && Math.abs(o.x - B.x) < 70 && Math.abs(o.y - B.y) < 70 && obbHit(obbOf(o, o.x, o.y, o.a, 0), B))) return false;
    const pl = G.player; return !(pl && Math.abs(pl.x - B.x) < 12 && Math.abs(pl.y - B.y) < 14) && !S.peds.some(q => Math.abs(q.x - B.x) < 12 && Math.abs(q.y - B.y) < 14);
  }
  function resetProp(p) {
    if (p.k0) { p.solid = p.k0.solid; p.over = p.k0.over; p.lying = p.k0.lying; p.lidOpen = p.k0.lid; p.k0 = null; }
    p.kx = p.ky = p.ka = p.kz = p.kvx = p.kvy = p.kva = p.kvz = 0; p.wob = 0; p.knocked = false; p.litter = null;
    if (p.b0) [p.x0, p.y0, p.x1, p.y1] = p.b0;
    KP.delete(p);
  }
  S.resetProps = () => { for (const p of [...KP]) resetProp(p); };
  function updateProps(dt) {
    for (const p of KP) {
      const isW = !!p.wk;
      if (p.wob) { p.wob *= Math.pow(0.03, dt); if (p.wob < 0.02) p.wob = 0; }
      const bx = isW ? p.ax : p.tx * TS + 8, by = isW ? p.ay : p.ty * TS + 12;
      if (p.kvx || p.kvy || p.kz || p.kvz) {
        p.kvz = (p.kvz || 0) - 300 * dt; p.kz = (p.kz || 0) + p.kvz * dt;
        if (p.kz <= 0) { p.kz = 0; p.kvz = p.kvz < -45 ? -p.kvz * 0.3 : 0; }
        const air = p.kz > 0, f = Math.pow(air ? 0.6 : 0.03, dt);
        let nx = p.kx + p.kvx * dt, ny = p.ky + p.kvy * dt;
        if (hardAt(bx + nx, by + p.ky)) { nx = p.kx; p.kvx *= -0.35; }
        if (hardAt(bx + nx, by + ny)) { ny = p.ky; p.kvy *= -0.35; }
        const lim = p.wk === 'bar' ? 6 : 40;
        p.kx = G.clamp(nx, -lim, lim); p.ky = G.clamp(ny, -lim, lim);
        p.kvx *= f; p.kvy *= f; p.ka += (p.kva || 0) * dt; p.kva = (p.kva || 0) * Math.pow(air ? 0.7 : 0.03, dt);
        if (Math.hypot(p.kvx, p.kvy) < 3 && !p.kz && !p.kvz) { p.kvx = p.kvy = 0; p.kva = 0; }
      }
      if (p.knocked && !p.kz && Math.hypot(p.kvx || 0, p.kvy || 0) < 30) { const tg = settleA(p); p.ka += (tg - p.ka) * Math.min(1, dt * 8); }
      if (isW) { p.x0 = p.b0[0] + p.kx - 6; p.x1 = p.b0[2] + p.kx + 6; p.y0 = p.b0[1] + p.ky - 6; p.y1 = p.b0[3] + p.ky + 6; }
      if (p.litter) for (const b of p.litter) if (b.vx || b.vy) {
        const nx = b.x + b.vx * dt, ny = b.y + b.vy * dt;
        if (!hardAt(p.tx * TS + nx, p.ty * TS + ny) && Math.abs(nx - 8) < 40 && Math.abs(ny - 12) < 40) { b.x = nx; b.y = ny; } else { b.vx = b.vy = 0; }
        const f = Math.pow(0.02, dt); b.vx *= f; b.vy *= f; b.a += (b.vx + b.vy) * dt * 0.1; if (Math.abs(b.vx) + Math.abs(b.vy) < 2) b.vx = b.vy = 0;
      }
      if (p.knocked) { // quietly back to normal once nobody can see it
        p.knT = (p.knT || 0) + dt;
        if (p.knT > 25 && offscreen(bx, by, 40) && offscreen(bx + p.kx, by + p.ky, 40) && tileFree(p)) resetProp(p);
      } else if (!p.wob && !p.kvx && !p.kvy && !p.kz) KP.delete(p);
    }
  }
  S.knockedProps = () => [...KP].filter(p => p.knocked).length;
  // on foot: lean on a bin for a moment and it tips over; walking into a knocked bin or a suitcase kicks it
  function footShove(pl, dt) {
    let ax = null; try { ax = G.readAxis ? G.readAxis() : null; } catch (e) { ax = null; }
    if (G._footAxis) ax = G._footAxis;
    if (!ax || pl.vehicle || pl.down > 0) return;
    const m = Math.hypot(ax.x, ax.y); if (m < 0.5) { pl.shoveT = 0; return; }
    const ux = ax.x / m, uy = ax.y / m, p = Wd.propAt(Math.floor((pl.x + ux * 6) / TS), Math.floor((pl.y - 1 + uy * 5) / TS));
    if (!p || p.taken) { pl.shoveT = 0; return; }
    if (p.type === 'bin' && p.solid) {
      pl.shoveT = (pl.shoveT || 0) + dt; if (!(p.wob > 0.2)) { p.wob = 0.45; KP.add(p); }
      if (pl.shoveT > 0.4) { pl.shoveT = 0; p.hitT = G.t; knockProp(p, ux * 65, uy * 65, 65); }
    } else if ((p.type === 'suitcase' || (p.type === 'bin' && p.knocked)) && !(p.hitT != null && (G.t || 0) - p.hitT < 0.6)) {
      p.hitT = G.t || 0; if (p.type === 'suitcase') knockProp(p, ux * 55, uy * 55, 55); else { p.kvx = (p.kvx || 0) + ux * 45; p.kvy = (p.kvy || 0) + uy * 45; KP.add(p); }
    }
  }
  // ---------- people: never inside a car ----------
  const pSolid = (p, x, y) => { const f = p.solidFn || Wd.solidAt; return f(x - 3, y - 2) || f(x + 3, y - 2) || f(x - 3, y + 1) || f(x + 3, y + 1); };
  function unstickPerson(p, own) {
    if (p.noclip || p.hidden || p.solidFn || p.ghostVeh || p.dead) return false;
    if (!vehAtPerson(p.x, p.y, own).length) return false;
    for (const d of [1, 2, 3, 4.5, 6, 8, 10, 12, 15, 18, 22, 26, 30]) for (const [ux, uy] of DIRS16) {
      const x = p.x + ux * d, y = p.y + uy * d;
      if (pSolid(p, x, y) || vehAtPerson(x, y, own).length) continue;
      const k = Math.min(d, 3), qx = p.x + ux * k, qy = p.y + uy * k; if (pSolid(p, qx, qy)) continue;
      p.x = qx; p.y = qy; return true;
    }
    return false;
  }
  S.unstickPerson = unstickPerson;
  // ---------- the player's vehicle against other vehicles and people: momentum, shove + spin, dents ----------
  const reach = (v, nx, ny) => Math.abs(Math.cos(v.a) * nx + Math.sin(v.a) * ny) * v.len / 2 + Math.abs(-Math.sin(v.a) * nx + Math.cos(v.a) * ny) * v.wid / 2;
  function carHits(pv) {
    const mA = massOf(pv), t = G.t || 0;
    for (const o of S.vehicles) {
      if (o === pv || ghost(o) || o.dias || o.hidden) continue;
      if (Math.abs(o.x - pv.x) > 110 || Math.abs(o.y - pv.y) > 110) continue;
      const m = obbMTV(obbOf(pv, pv.x, pv.y, pv.a, -0.5), obbOf(o, o.x, o.y, o.a, -0.5)); if (!m) continue;
      const [nx, ny, depth] = m, mB = massOf(o);
      const ovx = (o.vx || 0) + (o.kvx || 0), ovy = (o.vy || 0) + (o.kvy || 0);
      const vrel = (pv.vx - ovx) * nx + (pv.vy - ovy) * ny;   // closing speed along the contact normal
      if (vrel > 4) {
        const e = vrel > 60 ? 0.3 : 0.05, j = (1 + e) * vrel / (1 / mA + 1 / mB), dA = j / mA, dB = j / mB;
        pv.vx -= dA * nx; pv.vy -= dA * ny; pv.speed = pv.vx * Math.cos(pv.a) + pv.vy * Math.sin(pv.a);
        if (vrel > 60) pv.recoil = 0.22;
        const r = reach(pv, nx, ny), cpx = pv.x + nx * r, cpy = pv.y + ny * r, rx = cpx - o.x, ry = cpy - o.y;
        const I = mB * (o.len * o.len + o.wid * o.wid) / 12;
        o.kvx = (o.kvx || 0) + dB * nx; o.kvy = (o.kvy || 0) + dB * ny;
        o.kspin = G.clamp((o.kspin || 0) + (rx * ny - ry * nx) * j / I * 0.7, -3, 3);
        if (o.ai && dB > 10) { o.stunT = Math.max(o.stunT || 0, Math.min(1.6, 0.3 + vrel / 150)); o.curSpeed = 0; }
        if (o.parked && !o.keep && !o.home) o.home = { x: o.x, y: o.y, a: o.a };
        damageVeh(pv, dA, nx, ny); damageVeh(o, dB, -nx, -ny);
        if (vrel > 50 && t - (pv.crashT == null ? -9 : pv.crashT) > 0.3) {
          pv.crashT = t; G.audio.sfx('crash', Math.min(1, 0.35 + vrel / 400)); G.ui.shake(Math.min(6, 1.5 + vrel / 70)); crashFx(cpx, cpy, vrel);
          if (o.type === 'police') S.addWanted(1, 'Χτύπησες περιπολικό!');
          else if (o.ai) G.audio.say('driver_angry', G.pick(['Ρε κάνε άκρη ρε!', 'Είσαι τρελός;', 'Δίπλωμα από λαχείο πήρες;']), o, 1.8);
        }
      }
      if (vrel > 0 && (pv.vx * nx + pv.vy * ny) > 0) { pv.blockT = t; pv.blockRev = pv._thr < 0; }   // pressing into it: reverse logic may kick in
      // pull apart, shared by mass (a bus hardly moves); never into a wall or a third car
      const push = Math.min(depth + 0.25, 8);
      let pa = push * mB / (mA + mB); const pb = push - pa;
      if (pb > 0.01) {
        const x = o.x + nx * pb, y = o.y + ny * pb;
        if (shoveOK(o, x, y, o.a, o.x, o.y, o.a)) { if (o.parked && !o.keep && !o.home) o.home = { x: o.x, y: o.y, a: o.a }; o.x = x; o.y = y; } else pa = push;
      }
      if (pa > 0.01) {
        const x = pv.x - nx * pa, y = pv.y - ny * pa, p1 = pv.pen(x, y, pv.a);
        if (!p1 || p1 <= pv.pen(pv.x, pv.y, pv.a)) { pv.x = x; pv.y = y; }
        else { const x2 = o.x + nx * pa, y2 = o.y + ny * pa; if (shoveOK(o, x2, y2, o.a, o.x, o.y, o.a)) { o.x = x2; o.y = y2; } }
      }
    }
    // people: slow bumps push them aside; the ones that won't move (asleep, praying at the ATM) stop the car instead
    for (const p of S.peds) {
      if (p.down > 0 || p.hidden || p.noclip || p.dead) continue;
      if (Math.abs(p.x - pv.x) > 60 || Math.abs(p.y - pv.y) > 60) continue;
      const m = obbMTV(obbOf(pv, pv.x, pv.y, pv.a, -1), personBox(p.x, p.y)); if (!m) continue;
      const [nx, ny, d] = m, push = Math.min(d + 0.3, 5), qx = p.x + nx * push, qy = p.y + ny * push;
      if (!p.fixed && !p.script && !pSolid(p, qx, qy)) { p.x = qx; p.y = qy; continue; }
      const x = pv.x - nx * push, y = pv.y - ny * push; if (!pv.pen(x, y, pv.a)) { pv.x = x; pv.y = y; }
      pv.blockT = G.t || 0; pv.blockRev = pv._thr < 0;
      const vn = pv.vx * nx + pv.vy * ny; if (vn > 0) { pv.vx -= vn * nx; pv.vy -= vn * ny; pv.speed = pv.vx * Math.cos(pv.a) + pv.vy * Math.sin(pv.a); }
    }
  }
  // a shoved vehicle slides and spins to a stop; it never goes into walls or other cars (it passes the push on)
  function hitsWalker(v, x, y, a) {
    const pl = G.player; if (!pl || pl.vehicle || pl.hidden || pl.noclip) return false;
    if (Math.abs(pl.x - x) > 60 || Math.abs(pl.y - y) > 60) return false;
    return obbHit(obbOf(v, x, y, a, -1), personBox(pl.x, pl.y));
  }
  function knockStep(v, dt) {
    const sp = Math.hypot(v.kvx || 0, v.kvy || 0);
    if (sp < 2 && Math.abs(v.kspin || 0) < 0.05) { v.kvx = v.kvy = v.kspin = 0; v.knockT = 0; return; }
    v.knockT = 1; v.knockAt = G.t || 0; v.kvx = v.kvx || 0; v.kvy = v.kvy || 0; v.kspin = v.kspin || 0;
    const x0 = v.x, y0 = v.y, a0 = v.a, x = x0 + v.kvx * dt, y = y0 + v.kvy * dt, a = a0 + v.kspin * dt;
    if (sp > 30) S.propHits(v, x, y, a, v.kvx, v.kvy);
    if (hitsWalker(v, x, y, a)) {
      const pl = G.player;
      if (sp > 60 && !(pl.down > 0)) { pl.knock(v.kvx / sp, v.kvy / sp, Math.min(120, sp)); const ws = G.worldScene; if (ws && ws.damage) ws.damage(6); }
      else { v.kvx *= 0.3; v.kvy *= 0.3; v.kspin *= 0.3; return; }
    }
    const ok = (px, py, pa) => shoveOK(v, px, py, pa, x0, y0, a0);
    if (ok(x, y, a)) { v.x = x; v.y = y; v.a = a; }
    else if (ok(x, y, a0)) { v.x = x; v.y = y; v.kspin *= -0.3; }
    else if (ok(x, y0, a0)) { v.x = x; v.kvy *= -0.3; v.kspin *= 0.5; }
    else if (ok(x0, y, a0)) { v.y = y; v.kvx *= -0.3; v.kspin *= 0.5; }
    else {
      const A = obbOf(v, x, y, a, -0.5), pv = G.player && G.player.vehicle;
      const o = S.vehicles.find(q => q !== v && !pairSkip(v, q) && Math.abs(q.x - x) < 110 && Math.abs(q.y - y) < 110 && obbHit(A, obbOf(q, q.x, q.y, q.a, -0.5)));
      if (o && sp > 20) { // pass the push on (momentum split by mass)
        const mv = massOf(v), mo = massOf(o), k = 2 * mv / (mv + mo) * 0.55;
        if (o === pv) { o.vx += v.kvx * k; o.vy += v.kvy * k; }
        else { o.kvx = (o.kvx || 0) + v.kvx * k; o.kvy = (o.kvy || 0) + v.kvy * k; if (o.ai) o.stunT = Math.max(o.stunT || 0, 0.6); if (o.parked && !o.keep && !o.home) o.home = { x: o.x, y: o.y, a: o.a }; }
        if (sp > 60) { damageVeh(o, sp * k, -v.kvx / sp, -v.kvy / sp); if (!offscreen(v.x, v.y, 0) && (G.t || 0) - (v.crashT == null ? -9 : v.crashT) > 0.35) { v.crashT = G.t || 0; G.audio.sfx('crash', 0.45); } }
      }
      if (sp > 60) damageVeh(v, sp * 0.6, v.kvx / sp, v.kvy / sp);
      v.kvx *= -0.15; v.kvy *= -0.15; v.kspin *= 0.3;
    }
    const f = Math.pow(0.02, dt); v.kvx *= f; v.kvy *= f; v.kspin *= Math.pow(0.03, dt);
  }
  // smoke from broken engines (and wrecks)
  function smoke(v, dt) {
    if (!(v.hp < 35 || v.wrecked) || v.lime || v.type === 'heli' || offscreen(v.x, v.y, 40) || S.fx.length > 220) return;
    v.smT = (v.smT || 0) - dt; if (v.smT > 0) return;
    v.smT = v.wrecked ? 0.11 : 0.16 + (v.hp / 35) * 0.35;
    const k = v.len * 0.3, x = v.x + Math.cos(v.a) * k + G.rand(-2, 2), y = v.y + Math.sin(v.a) * k + G.rand(-2, 2);
    S.fx.push({ type: 'smoke', x, y, vx: G.rand(-5, 5) + (v.vx || 0) * 0.2, vy: G.rand(-14, -8), t: 0, dur: v.wrecked ? 1.8 : 1.3, r: v.wrecked ? 4 : 3, dark: v.wrecked || v.hp < 15 });
  }
  // parked cars that were shoved or dented: back where they were once nobody's looking
  function restoreParked(v, dt) {
    if (!v.home || !v.parked || v.keep || v.driver) return;
    if (!offscreen(v.x, v.y, 60) || !offscreen(v.home.x, v.home.y, 60)) { v.offT = 0; return; }
    v.offT = (v.offT || 0) + dt; if (v.offT < 20) return;
    const x = v.x, y = v.y, a = v.a; v.x = v.home.x; v.y = v.home.y; v.a = v.home.a;
    if (!S.poseFree(v, 0, 3.5)) { v.x = x; v.y = y; v.a = a; v.offT = 10; return; }
    v.home = null; v.hp = 100; v.dmgZ = 0; v.wrecked = false; v.kvx = v.kvy = v.kspin = 0; v.offT = 0;
  }
  // a driver who was shoved well off his lane (or onto the kerb) gives up: hazards on, the car stays put and goes away off screen
  S.afterStun = function (v) {
    const L = v.lane; if (!L) return;
    let off, da;
    if (L.arc) { const A = L.arc; off = G.dist(v.x, v.y, A.cx + Math.cos(A.ph) * A.r, A.cy + Math.sin(A.ph) * A.r); da = Math.abs(G.angleDiff(v.a, A.ph + A.sg * Math.PI / 2)); }
    else { off = Math.abs(latOf(v, L.axis) - laneC(L.axis, roadOf(L), L.dir)); da = Math.abs(G.angleDiff(v.a, angOf(L.axis, L.dir))); }
    if (off > 16 || da > 1.0 || v.pen(v.x, v.y, v.a) > 0) { v.ai = null; v.lane = null; v.hazard = true; v.speed = v.curSpeed = 0; v.abandoned = true; }
  };
  S.crashPhysics = function (dt) {
    const pl = G.player, pv = pl && pl.vehicle;
    if (pv && !ghost(pv)) { carHits(pv); S.unstick(pv, 3); }
    for (const v of S.vehicles) {
      if (v !== pv && (v.kvx || v.kvy || v.kspin)) knockStep(v, dt);
      else if (v !== pv && !v.parked && (G.t || 0) - (v.knockAt == null ? -99 : v.knockAt) < 4 && v.pen(v.x, v.y, v.a)) S.unstick(v, 1.5);   // shoved against a kerb prop: ease out
      smoke(v, dt); if (v.home) restoreParked(v, dt);
    }
    updateProps(dt);
    if (pl && !pl.vehicle) { footShove(pl, dt); unstickPerson(pl, null); }
    for (const p of S.peds) if (!p.cameo && Math.abs(p.x - pl.x) < 260 && Math.abs(p.y - pl.y) < 200) unstickPerson(p, null);
  };

  S.spawnTraffic = function (px, py) {
    // pick a lane point 230-420px away from the player, off screen, clear of other vehicles and props
    for (let tries = 0; tries < 20; tries++) {
      const axis = G.chance(0.5) ? 'h' : 'v', list = axis === 'h' ? R().h : R().v, ri = G.randi(0, list.length - 1), rd = list[ri], dir = G.chance(0.5) ? 1 : -1;
      const pos = axis === 'h' ? G.rand((rd.x0 + 3) * TS, (rd.x1 - 2) * TS) : G.rand((rd.y0 + 3) * TS, (rd.y1 - 2) * TS);
      const x = axis === 'h' ? pos : laneV(rd, dir), y = axis === 'h' ? laneH(rd, dir) : pos;
      const d = G.dist(x, y, px, py); if (d < 230 || d > 420 || !offscreen(x, y, 30)) continue;
      const type = G.chance(0.1) ? 'bus' : G.chance(0.15) ? 'taxi' : G.chance(0.12) ? 'moto' : G.chance(0.08) ? 'van' : 'car';
      const v = new E.Vehicle(type, x, y, 0);
      placeOnLane(v, axis, ri, dir, pos);
      if ((uturnAt(v, v.lane, rd) - pos) * dir < 8 || !poseFree(v, v.x, v.y, v.a, 10)) continue;
      if (v.len > 50 && !crossings(axis, rd).some(o => ((dir > 0 ? o.cp * TS : o.cp * TS + ROADW) - pos) * dir > v.len / 2 + 20)) continue; // no dead ends for buses
      if (type === 'moto') { v.col = '#c0392b'; v.rider = G.randomLook({ acc: ['cap:#c0392b'] }); } // ντελιβεράς
      v.ai = true; v.cruise = type === 'bus' ? 70 : type === 'moto' ? 130 : G.rand(85, 110); v.curSpeed = v.cruise * 0.6;
      S.vehicles.push(v); return v;
    }
    return null;
  };

  // ---------- garbage trucks (σκουπιδιάρικα): slow, stop at the bins by their lane; traffic queues behind ----------
  function binsOnLane(L) {
    const rd = roadOf(L), out = [];
    for (const [bx, by] of Wd.bins || []) {
      if (L.axis === 'h') { if (by === (L.dir > 0 ? rd.y + 4 : rd.y - 1) && bx >= rd.x0 && bx <= rd.x1) out.push([bx, by, bx * TS + 8]); }
      else if (bx === (L.dir > 0 ? rd.x - 1 : rd.x + 4) && by >= rd.y0 && by <= rd.y1) out.push([bx, by, by * TS + 8]);
    }
    return out;
  }
  // speed limit so the truck stops with its back step next to the next bin; starts the stop when it's there
  function binBrake(v) {
    const L = v.lane; if (!L || L.arc || L.merge) return Infinity;
    const al = alongOf(v, L.axis); let lim = Infinity;
    v.served = v.served || {};
    for (const [bx, by, bal] of binsOnLane(L)) {
      const key = bx + ',' + by; if (v.served[key] && G.t - v.served[key] < 90) continue;
      const stopAt = bal - L.dir * 4 + L.dir * v.len / 2, d = (stopAt - al) * L.dir;
      if (d < -3 || d > 90) continue;
      if (d < 1.5 && (v.curSpeed || 0) < 22) { v.binStop = { t: 0, dur: 5.6, bx, by }; v.served[key] = G.t; S._binStops = (S._binStops || 0) + 1; return 0; }
      lim = Math.min(lim, Math.max(6, d * 1.6));
    }
    return lim;
  }
  function garbageStop(v, dt) {
    const B = v.binStop; if (!B) return false;
    B.t += dt; v.curSpeed = 0; v.speed = 0; v.vx = v.vy = 0;
    const prop = Wd.propAt(B.bx, B.by); if (prop) prop.lidOpen = B.t > 1.4 && B.t < 3.9;
    if (B.t >= B.dur) { v.binStop = null; if (prop) { prop.lidOpen = false; prop.over = false; } } // emptied
    return true;
  }
  S.spawnGarbage = function (px, py) {
    for (let tries = 0; tries < 30; tries++) {
      const axis = G.chance(0.5) ? 'h' : 'v', list = axis === 'h' ? R().h : R().v, ri = G.randi(0, list.length - 1), rd = list[ri], dir = G.chance(0.5) ? 1 : -1;
      const a0 = axis === 'h' ? rd.x0 : rd.y0, a1 = Math.min(axis === 'h' ? rd.x1 : rd.y1, (axis === 'h' ? Wd.TOWN.w : Wd.TOWN.h) - 6);
      if (a1 - a0 < 20) continue;
      const pos = G.rand((a0 + 8) * TS, (a1 - 8) * TS), lt = laneC(axis, rd, dir), x = axis === 'h' ? pos : lt, y = axis === 'h' ? lt : pos;
      const d = G.dist(x, y, px, py); if (d < 200 || d > 430 || !offscreen(x, y, 30)) continue;
      const t = new E.Vehicle('garbage', x, y, 0); placeOnLane(t, axis, ri, dir, pos);
      if (tries < 20 && !binsOnLane(t.lane).some(b => (b[2] - pos) * dir > 80)) continue; // start on a street with bins ahead
      if (!poseFree(t, t.x, t.y, t.a, 8)) continue;
      if (!crossings(axis, rd).some(o => ((dir > 0 ? o.cp * TS : o.cp * TS + ROADW) - pos) * dir > t.len / 2 + 20)) continue;
      t.ai = true; t.cruise = G.rand(45, 55); t.curSpeed = 30; t.served = {};
      S.vehicles.push(t);
      let back = pos - dir * t.len / 2; const n = G.randi(2, 3);
      for (let k = 0; k < n; k++) {
        const c = new E.Vehicle(G.chance(0.15) ? 'taxi' : G.chance(0.1) ? 'van' : 'car', 0, 0, 0), cp = back - dir * (9 + c.len / 2);
        if ((cp - (dir > 0 ? (a0 + 3) * TS : (a1 - 2) * TS)) * dir < 0) break;
        placeOnLane(c, axis, ri, dir, cp);
        if (!poseFree(c, c.x, c.y, c.a, 2)) break;
        c.ai = true; c.cruise = G.rand(85, 110); c.curSpeed = 30; S.vehicles.push(c); back = cp - dir * c.len / 2;
      }
      return t;
    }
    return null;
  };
  // the crew: a worker on the back step who hops off to empty the bin
  const WORKER = { skin: '#c98a5e', hair: '#2b1d14', hairStyle: 'short', top: '#ff7a1a', topStyle: 'tee', legs: '#2f5a3c', shoes: '#222', acc: ['cap:#2f6f3e'] };
  function drawGarbageCrew(ctx, v, camX, camY) {
    const c = Math.cos(v.a), s = Math.sin(v.a), rx = -s, ry = c;               // forward and right
    const step = [v.x - c * (v.len / 2 + 2) + rx * (v.wid / 2 - 6), v.y - s * (v.len / 2 + 2) + ry * (v.wid / 2 - 6)];
    const B = v.ai && v.binStop;
    if (B && B.t > 0.45 && B.t < B.dur - 0.45) {
      const out = [step[0] + rx * 9, step[1] + ry * 9], bin = [B.bx * TS + 8 - rx * 10, B.by * TS + 11 - ry * 10];
      const t = B.t, dur = B.dur;
      let p, k;
      if (t < 1.4) { k = (t - 0.45) / 0.95; p = [G.lerp(out[0], bin[0], k), G.lerp(out[1], bin[1], k)]; }
      else if (t < 3.9) p = bin;
      else { k = Math.min(1, (t - 3.9) / (dur - 0.45 - 3.9)); p = [G.lerp(bin[0], out[0], k), G.lerp(bin[1], out[1], k)]; }
      const walking = t < 1.4 || t >= 3.9, mvx = t < 1.4 ? bin[0] - out[0] : out[0] - bin[0], mvy = t < 1.4 ? bin[1] - out[1] : out[1] - bin[1];
      let dir = Math.abs(mvx) > Math.abs(mvy) ? (mvx > 0 ? 2 : 1) : (mvy > 0 ? 0 : 3);
      if (!walking) { const fx = B.bx * TS + 8 - p[0], fy = B.by * TS + 8 - p[1]; dir = Math.abs(fx) > Math.abs(fy) ? (fx > 0 ? 2 : 1) : (fy > 0 ? 0 : 3); }
      const frame = walking ? [0, 1, 0, 2][Math.floor(t * 8) % 4] : 0;
      G.drawPerson(ctx, WORKER, p[0] - camX, p[1] - camY, dir, frame, { lift: walking ? 0 : Math.abs(Math.sin(t * 5)) * 1.2 });
      return;
    }
    // riding on the back step (top-down: hi-vis shoulders + cap)
    const x = step[0] - camX, y = step[1] - camY;
    ctx.save(); ctx.translate(x, y); ctx.rotate(v.a + Math.PI / 2);
    ctx.fillStyle = 'rgba(20,10,30,0.28)'; ctx.beginPath(); ctx.ellipse(1.5, 2, 4.6, 3, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(28,20,36,0.85)'; ctx.lineWidth = 0.5;
    ctx.fillStyle = '#ff7a1a'; ctx.beginPath(); ctx.ellipse(0, 0.6, 4.3, 2.6, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#eef25a'; ctx.fillRect(-4, 0.3, 8, 0.8);
    ctx.fillStyle = '#c98a5e'; ctx.beginPath(); ctx.arc(0, 0, 1.9, 0, 7); ctx.fill();
    ctx.fillStyle = '#2f6f3e'; ctx.beginPath(); ctx.arc(0, -0.3, 1.9, Math.PI, 0); ctx.fill(); ctx.fillRect(-1.3, -2.6, 2.6, 0.9);
    ctx.restore();
  }
  // which way should a chasing car turn at a junction? returns +1/-1 (turn), 0 (straight) or 'U'
  function chaseTurn(v, axis) {
    const pp = G.player.vehicle || G.player, dx = pp.x - v.x, dy = pp.y - v.y, L = v.lane;
    if (axis === 'h') { const ahead = dx * L.dir; if (Math.abs(dy) > 40 && (Math.abs(dy) > Math.abs(dx) * 0.5 || ahead < 0)) return Math.sign(dy); return ahead < -40 ? 'U' : 0; }
    const ahead = dy * L.dir; if (Math.abs(dx) > 40 && (Math.abs(dx) > Math.abs(dy) * 0.5 || ahead < 0)) return Math.sign(dx); return ahead < -40 ? 'U' : 0;
  }

  // ---------- pedestrians (few, all different) ----------
  const pedWalk = (x, y) => { const c = Wd.get(x, y); return (c === '.' || c === 'S' || c === 'p' || c === 'w') && !Wd.propAt(x, y); };
  S.pedWalk = (tx, ty) => pedWalk(tx, ty);
  S.spawnPed = function (px, py) {
    for (let i = 0; i < 20; i++) {
      const a = Math.random() * 6.283, d = G.rand(15, 24);
      const tx = Math.floor(px / TS + Math.cos(a) * d), ty = Math.floor(py / TS + Math.sin(a) * d);
      if (!pedWalk(tx, ty) || isShallowT(tx, ty) || Wd.area(tx, ty) !== 'town' || !offscreen(tx * TS + 8, ty * TS + 10, 16)) continue;
      const z = Wd.zone(tx, ty);
      const used = new Set(S.peds.map(p => p.look));
      let look;
      if (z === 'hip' && G.chance(0.5)) look = G.chance(0.5) ? G.LOOKS.hipster : G.LOOKS.hipster2;
      else if (G.chance(0.08)) look = G.LOOKS.yiayia; else if (G.chance(0.08)) look = G.LOOKS.tourist;
      else look = S.lookPool.find(l => !used.has(l)) || G.randomLook();
      if (used.has(look)) continue;
      const p = new E.Person(look, tx * TS + 8, ty * TS + 10); p.speed = G.rand(16, 26); p.walk = pedWalk;
      S.peds.push(p); return p;
    }
    return null;
  };
  function pedAI(p, dt) {
    if (p.updatePhysics(dt)) return;
    if (p.script) { p.script(p, dt); return; }
    p.timer -= dt;
    if (p.state === 'flee') { const pl = G.player.vehicle || G.player; const a = Math.atan2(p.y - pl.y, p.x - pl.x); p.move(Math.cos(a) * 55, Math.sin(a) * 55, dt); if (p.timer < 0) p.state = 'wander'; return; }
    if (!p.target || p.timer < 0 || G.dist(p.x, p.y, p.target[0], p.target[1]) < 3) {
      const tx = Math.floor(p.x / TS), ty = Math.floor(p.y / TS);
      const opts = DIRS.filter(([dx, dy]) => pedWalk(tx + dx, ty + dy) && pedWalk(tx + dx * 2, ty + dy * 2));
      if (opts.length && G.chance(0.8)) { const [dx, dy] = G.pick(opts); let n = 2; while (n < 7 && pedWalk(tx + dx * (n + 1), ty + dy * (n + 1))) n++; n = G.randi(2, n); p.target = [(tx + dx * n) * TS + 8, (ty + dy * n) * TS + 10]; }
      else { p.target = [p.x, p.y]; }
      p.timer = G.rand(3, 7);
    }
    const a = Math.atan2(p.target[1] - p.y, p.target[0] - p.x), d = G.dist(p.x, p.y, p.target[0], p.target[1]);
    if (d > 2) { if (!p.move(Math.cos(a) * p.speed, Math.sin(a) * p.speed, dt)) p.target = null; } else p.move(0, 0, dt);
  }
  const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];

  // ---------- wanted / police (cops come in patrol cars) ----------
  // ---------- crime, witnesses, police (GTA logic) ----------
  // A crime only raises the wanted level if a cop sees it, or (sometimes) a witness calls it in a few seconds later.
  S.crime = function (severity, why, x, y) {
    const pp = G.player.vehicle || G.player; x = x != null ? x : pp.x; y = y != null ? y : pp.y;
    const copSees = S.cops.some(c => G.dist(c.x, c.y, x, y) < 170) || S.vehicles.some(v => v.chase && G.dist(v.x, v.y, x, y) < 200);
    if (copSees || G.state.wanted > 0) { S.addWanted(severity, why); return; }
    const witnesses = S.peds.filter(p => !p.cop && !p.cameo && p.down <= 0 && G.dist(p.x, p.y, x, y) < 140).length;
    if (witnesses && G.chance(Math.min(0.85, 0.3 + witnesses * 0.15)) && !S.pendingCall) {
      S.pendingCall = { t: G.rand(3, 6), sev: severity, why };
      G.ui.toast('📞 Κάποιος παίρνει τηλέφωνο την αστυνομία…', 3);
    }
  };
  S.addWanted = function (n, why) {
    const st = G.state, before = st.wanted;
    st.wanted = G.clamp(st.wanted + n, 0, 5); S.wantedCool = 0;
    if (st.wanted > before) { G.audio.sfx('star'); if (why) G.ui.toast(why); if (st.wanted === 5 && before < 5) G.ui.toast('🚨 5 ΑΣΤΕΡΙΑ: όλη η Αττική σε ψάχνει. Φύγε με αμάξι!', 3); if (before === 0) S.patrolDelay = G.rand(4, 7); }
  };
  // patrol cars come from far away along the roads
  S.spawnPatrol = function () {
    const pl = G.player.vehicle || G.player;
    const cands = [];
    R().h.forEach((h, ri) => { for (const dir of [1, -1]) { const y = laneH(h, dir); for (let x = (h.x0 + 2) * TS; x < h.x1 * TS; x += 48) { const d = G.dist(x, y, pl.x, pl.y); if (d > 280 && d < 460 && (pl.x - x) * dir > 0) cands.push({ axis: 'h', ri, dir, pos: x }); } } });
    R().v.forEach((vv, ri) => { for (const dir of [1, -1]) { const x = laneV(vv, dir); for (let y = (vv.y0 + 2) * TS; y < vv.y1 * TS; y += 48) { const d = G.dist(x, y, pl.x, pl.y); if (d > 280 && d < 460 && (pl.y - y) * dir > 0) cands.push({ axis: 'v', ri, dir, pos: y }); } } });
    if (!cands.length) return;
    const v = new E.Vehicle('police', 0, 0, 0);
    let ok = false; for (let k = 0; k < 12 && !ok; k++) { const b = G.pick(cands); placeOnLane(v, b.axis, b.ri, b.dir, b.pos); ok = poseFree(v, v.x, v.y, v.a, 2); } // never inside roadworks or another car
    if (!ok) return;
    v.siren = true; v.chase = true; v.crew = 2; v.keep = true; v.state = 'chase';
    S.vehicles.push(v); G.audio.sfx('siren');
  };
  function copOnFoot(x, y, kind, car) {
    const c = new E.Person(kind === 'lera' ? G.LOOKS.cop_lera : G.LOOKS.cop_agapi, x, y); c.cop = kind; c.speed = 52 + Math.max(0, G.state.wanted - 2) * 3; c.said = 0; c.timer = 0; c.car = car;
    S.peds.push(c); S.cops.push(c); return c;
  }
  function patrolAI(v, dt) {
    const pl = G.player, tgt = pl.vehicle || pl;
    const d = G.dist(v.x, v.y, tgt.x, tgt.y);
    if (G.state.wanted <= 0) { // give up: collect the crew and drive off
      v.siren = false; v.state = 'leave';
      const crewNear = S.cops.filter(c => c.car === v);
      if (crewNear.length) { v.drive(dt, 0, 0, true); return; }
      G.driveDirect(v, dt, { x: Math.cos(v.a), y: Math.sin(v.a) }, false); v.leaveT = (v.leaveT || 0) + dt; if (v.leaveT > 6 && offscreen(v.x, v.y, 40)) v.dead = true; return;
    }
    if (v.state === 'parked') { // crew is out on foot; car waits. If the player drives away fast, crew gets back in.
      v.drive(dt, 0, 0, true);
      const crew = S.cops.filter(c => c.car === v);
      if (pl.vehicle && Math.abs(pl.vehicle.speed) > 60 && d > 90) { crew.forEach(c => c.returning = true); }
      if (!crew.length) { v.state = 'chase'; v.crew = 2; v.stuckT = 0; }
      return;
    }
    // chase: follow the roads while far, go straight at you when close
    if (v.lane && d > 120) { // on the roads: keep a gap; if traffic is in the way, leave the lane and go straight for it
      const look = lookAhead(v, 70), tgt = look.gap < Infinity ? Math.min(175, Math.max(0, (look.gap - 5) * 3)) : 175;
      const cur = v.curSpeed || 0; v.curSpeed = tgt < cur ? Math.max(tgt, cur - 600 * dt) : Math.min(tgt, cur + 260 * dt);
      const ok = laneDrive(v, dt, v.curSpeed);
      v.waitT = tgt < 25 || !ok ? (v.waitT || 0) + dt : 0;
      if (v.waitT > 1.2 && !v.lane.arc) { v.lane = null; v.speed = 0; v.waitT = 0; }
      return;
    }
    if (v.lane) { v.lane = null; v.speed = 120; }
    v.stuckT = Math.abs(v.speed) < 12 ? (v.stuckT || 0) + dt : 0;
    if (v.stuckT > 1.2 && d < 220) { const side = Math.cos(v.a + Math.PI / 2) * 16, sideY = Math.sin(v.a + Math.PI / 2) * 16; copOnFoot(v.x + side, v.y + sideY + 6, 'lera', v); copOnFoot(v.x - side, v.y - sideY + 6, 'agapi', v); v.crew = 0; v.state = 'parked'; G.audio.sfx('door'); return; }
    const a = Math.atan2(tgt.y - v.y, tgt.x - v.x);
    if (d < 85) {
      v.drive(dt, 0, 0, true);
      if (Math.abs(v.speed) < 15) { // stop and get out (both when you're on foot and when you're in a car)
        const side = Math.cos(v.a + Math.PI / 2) * 16, sideY = Math.sin(v.a + Math.PI / 2) * 16;
        copOnFoot(v.x + side, v.y + sideY + 6, 'lera', v); copOnFoot(v.x - side, v.y - sideY + 6, 'agapi', v);
        v.crew = 0; v.state = 'parked'; G.audio.sfx('door');
      }
      return;
    }
    const slow = d < 120 ? 0.5 : 1;
    G.driveDirect(v, dt, { x: Math.cos(a) * slow, y: Math.sin(a) * slow }, false);
  }
  function copAI(c, dt) {
    if (c.updatePhysics(dt)) return;
    const pl = G.player, tgt = pl.vehicle || pl;
    if (G.state.wanted <= 0 || c.returning) { // walk back to the car (or away) and disappear
      const car = c.car && !c.car.dead ? c.car : null;
      if (car) { const a = Math.atan2(car.y - c.y, car.x - c.x); if (!c.move(Math.cos(a) * 55, Math.sin(a) * 55, dt)) c.move(Math.cos(a + 1.4) * 55, Math.sin(a + 1.4) * 55, dt); if (G.dist(c.x, c.y, car.x, car.y) < Math.max(car.len, car.wid) / 2 + 7) { c.dead = true; if (c.returning && !S.cops.some(o => o !== c && o.car === car && !o.dead)) { car.state = 'chase'; car.crew = 2; } } }
      else { // no car: walk away, gone once out of view
        c.timer += dt; const pp = G.player.vehicle || G.player, a = Math.atan2(c.y - pp.y, c.x - pp.x);
        if (c.timer > 1.5 && !c.move(Math.cos(a) * 40, Math.sin(a) * 40, dt)) c.move(-Math.sin(a) * 40, Math.cos(a) * 40, dt);
        if (c.timer > 1.5 && offscreen(c.x, c.y, 30)) c.dead = true;
      }
      return;
    }
    const d = G.dist(c.x, c.y, tgt.x, tgt.y), a = Math.atan2(tgt.y - c.y, tgt.x - c.x);
    const stopAt = pl.vehicle ? Math.max(pl.vehicle.wid / 2 + 10, Math.min(pl.vehicle.len / 2 + 5, 26)) : 9;
    if (d > stopAt) { if (!c.move(Math.cos(a) * c.speed, Math.sin(a) * c.speed, dt)) c.move(Math.cos(a + 1.4) * c.speed, Math.sin(a + 1.4) * c.speed, dt); }
    else { c.move(0, 0, dt); c.dir = Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? (Math.cos(a) > 0 ? 2 : 1) : (Math.sin(a) > 0 ? 0 : 3); }
    c.said -= dt; c.hitCd = (c.hitCd || 0) - dt;
    if (G.state.wanted >= 4 && !pl.vehicle && d < 13 && c.down <= 0 && c.hitCd <= 0) {
      c.hitCd = G.state.wanted >= 5 ? 1.1 : 1.6; G.audio.sfx('punch');
      G.worldScene.damage(G.state.wanted >= 5 ? 7 : 5);
    }
    if (c.cop === 'lera' && d < 90 && c.said < 0) { G.audio.say('cop_lera', 'Μεγάλο λαμόγιο…', c); c.said = 8; }
  }
  // arrest: a cop must stay next to you while you're (almost) still, for a moment
  function arrestCheck(dt) {
    const pl = G.player, tgt = pl.vehicle || pl;
    const speed = pl.vehicle ? Math.abs(pl.vehicle.speed) : Math.hypot(G.input.axis.x, G.input.axis.y) * pl.speed;
    const reach = pl.vehicle ? pl.vehicle.wid / 2 + 16 : 14;
    const near = S.cops.find(c => !c.returning && c.down <= 0 && G.dist(c.x, c.y, tgt.x, tgt.y) < reach);
    if (near && speed < (pl.vehicle ? 25 : 30)) S.arrest = Math.min(1, (S.arrest || 0) + dt / (1.6 - Math.max(0, G.state.wanted - 2) * 0.17));
    else S.arrest = Math.max(0, (S.arrest || 0) - dt * 0.8);
    if (S.arrest >= 1 && G.top() === G.worldScene && !G.worldScene.busted) {
      S.arrest = 0;
      if (near.cop === 'agapi') G.audio.say('cop_agapi', 'Αγάπη μόνο!', near, 2); else G.audio.say('cop_lera', 'Μεγάλο λαμόγιο…', near, 2);
      G.worldScene.bust();
    }
  }
  S.arrestCheck = arrestCheck;

  // ---------- ΔΙΑΣ: a single-file line of police motorbikes ----------
  S.spawnDias = function () {
    const pl = G.player.vehicle || G.player;
    // nearest horizontal or vertical road to the player
    let best = null, bd = 1e9;
    for (let i = 0; i < R().h.length; i++) { const h = R().h[i]; const d = Math.abs((h.y + 2) * TS - pl.y); if (d < bd && pl.x > h.x0 * TS && pl.x < h.x1 * TS) { bd = d; best = { axis: 'h', ri: i }; } }
    for (let i = 0; i < R().v.length; i++) { const v = R().v[i]; const d = Math.abs((v.x + 2) * TS - pl.x); if (d < bd && pl.y > v.y0 * TS && pl.y < v.y1 * TS) { bd = d; best = { axis: 'v', ri: i }; } }
    if (!best || bd > 200) return false;
    const dir = G.chance(0.5) ? 1 : -1;
    const rd = (best.axis === 'h' ? R().h : R().v)[best.ri], lo = ((best.axis === 'h' ? rd.x0 : rd.y0) + 1) * TS + 14, hi = (best.axis === 'h' ? rd.x1 : rd.y1) * TS - 14;
    if (hi - lo < 160) return false;
    const start = G.clamp((best.axis === 'h' ? pl.x : pl.y) - dir * 300, dir > 0 ? lo + 120 : lo, dir > 0 ? hi : hi - 120); // the whole line on the road
    const line = [];
    for (let i = 0; i < 5; i++) {
      const v = new E.Vehicle('dias', 0, 0, 0); v.rider = G.LOOKS.cop_agapi; v.dias = 9; v.keep = true;
      placeOnLane(v, best.axis, best.ri, dir, start - dir * i * 30);
      if (!poseFree(v, v.x, v.y, v.a, 2)) return false;   // never on top of traffic
      line.push(v);
    }
    S.vehicles.push(...line);
    G.ui.toast('🚨 ΔΙΑΣ! Κάνε άκρη!'); G.audio.sfx('siren');
    return true;
  };
  function diasAI(v, dt) {
    v.dias -= dt; if (v.dias < 0 && offscreen(v.x, v.y, 40)) { v.dead = true; return; }   // ride on until out of view
    const look = lookAhead(v, 70), tgt = look.gap < Infinity ? Math.min(230, Math.max(0, (look.gap - 4) * 3)) : 230;
    const cur = v.curSpeed == null ? 230 : v.curSpeed; v.curSpeed = tgt < cur ? Math.max(tgt, cur - 700 * dt) : Math.min(tgt, cur + 350 * dt);
    if (v.lane) laneDrive(v, dt, v.curSpeed);
    for (const p of S.peds) if (p.down <= 0 && G.dist(p.x, p.y - 4, v.x, v.y) < 11) p.knock(Math.cos(v.a), Math.sin(v.a), 140);
    const pl = G.player;
    if (!pl.vehicle && pl.down <= 0 && G.dist(pl.x, pl.y - 4, v.x, v.y) < 11) { pl.knock(Math.cos(v.a), Math.sin(v.a), 150); G.worldScene.damage(15); }
    if (pl.vehicle && G.dist(pl.vehicle.x, pl.vehicle.y, v.x, v.y) < 18) { pl.vehicle.speed *= 0.4; }
  }

  // ---------- regulars: the red Ferrari at the Thessaly farm, the homeless on their cardboard, the priest at the bank ----------
  const say = (key, text, who, dur) => G.audio.say(key, text, who, dur);
  // a parking pose for the Ferrari by the εθνική, next to the farm's path (outside the quest region, never on the road)
  function ferrariSpot() {
    const sp = Wd.SPOTS && Wd.SPOTS.ferrari; if (!sp) return null;
    if (S._fspot && S._fspot.key === Wd.t) return S._fspot;
    if (G.FERRARI_PARK) { S._fspot = Object.assign({ key: Wd.t }, G.FERRARI_PARK); return S._fspot; } // the lady's Ferrari in the farmyard
    const v = new E.Vehicle('ferrari', 0, 0, 0, '#d0101a'), [hx, hy] = sp.hub;
    const okTile = (x, y) => { const c = Wd.get(x, y); return c && c !== 'R' && c !== 'Z' && c !== 'T' && c !== 'k' && !Wd.propAt(x, y) && (!Wd.regionAt || !Wd.regionAt(x, y)); };
    let best = null;
    for (const [dx, dy] of [[3, 0], [-2, 0], [3, 1], [-2, 1], [4, -1], [-3, -1], [5, 0], [-4, 0], [3, 2], [-2, 2], [6, 1], [-5, 1]]) {
      const tx = hx + dx, ty = hy + dy, x = tx * TS + 8, y = ty * TS + 8;
      let fine = true;
      for (let k = -2; k <= 2 && fine; k++) for (let j = -1; j <= 1 && fine; j++) if (!okTile(Math.floor((x + k * 9) / TS), Math.floor((y + j * 7) / TS))) fine = false;
      if (!fine) continue;
      v.x = x; v.y = y; v.a = dx < 0 ? 0 : Math.PI;
      if (footSolid(v, x, y, v.a, 0)) continue;
      best = { x, y, a: v.a, key: Wd.t }; break;
    }
    S._fspot = best; return best;
  }
  function ensureFerrari(dt) {
    const sp = ferrariSpot(); if (!sp) return;
    const f = S.ferrari, here = f && !f.dead && S.vehicles.includes(f) && G.dist(f.x, f.y, sp.x, sp.y) < 40;
    if (here) { S.ferrariGoneT = 0; return; }
    S.ferrariGoneT += dt;
    if (S.ferrari && S.ferrariGoneT < 90) return;                 // stolen: a new one shows up a while later
    if (S.fixInit && !offscreen(sp.x, sp.y, 60)) return;           // never pops in on screen
    const v = new E.Vehicle('ferrari', sp.x, sp.y, sp.a, '#d0101a');
    if (!poseFree(v, sp.x, sp.y, sp.a, 2)) return;
    v.parked = true; v.keep = true; v.farm = true;
    S.vehicles.push(v); S.ferrari = v; S.ferrariGoneT = 0;
  }
  // homeless: real people on the cardboard (sleep, sit up, ask for change, can be pushed, then shuffle back)
  const CHANGE = ['Ένα ευρώ, φίλε;', 'Έχεις κανά ψιλό;', 'Για ένα κουλούρι μόνο…', 'Ό,τι έχεις, αδερφέ.'];
  function homelessScript(p, dt) {
    const pl = G.player, pp = pl.vehicle || pl, [hx, hy] = p.home, dh = G.dist(p.x, p.y, hx, hy);
    p.cd -= dt;
    if (dh > 2.5) { // pushed off the cardboard: get up and shuffle back
      p.pose = null; const a = Math.atan2(hy - p.y, hx - p.x);
      if (!p.move(Math.cos(a) * 14, Math.sin(a) * 14, dt)) { p.stuckT = (p.stuckT || 0) + dt; if (p.stuckT > 4 && offscreen(p.x, p.y, 30)) { p.x = hx; p.y = hy; p.stuckT = 0; } }
      return;
    }
    p.move(0, 0, dt);
    const d = G.dist(p.x, p.y, pp.x, pp.y);
    if (!pl.vehicle && d < 42 && p.cd <= 0) {           // sits up and asks for change
      p.pose = 'sit'; p.awakeT = 6; p.cd = G.rand(14, 22);
      const a = Math.atan2(pp.y - p.y, pp.x - p.x); p.dir = Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? (Math.cos(a) > 0 ? 2 : 1) : 0;
      G.ui.bubble(G.pick(CHANGE), p, 2.4);
    }
    if (p.awakeT > 0) p.awakeT -= dt;
    else if (p.sleeper && d > 70) p.pose = 'lie';
    else if (!p.pose) p.pose = 'sit';
  }
  function ensureHomeless() {
    for (const [hx, hy] of Wd.homeless || []) {
      const prop = Wd.propAt(hx, hy); if (prop) prop.npc = true;
      const x = hx * TS + 8, y = hy * TS + 13;
      if (S.peds.some(p => p.role === 'homeless' && p.home[0] === x && p.home[1] === y)) continue;
      if (S.fixInit && !offscreen(x, y, 30)) continue;
      const i = S.peds.filter(p => p.role === 'homeless').length;
      const look = Object.assign({}, G.LOOKS.homeless, i % 2 ? { hair: '#3a2a1e', top: '#4a5a3a', acc: ['beard'] } : {});
      const p = new E.Person(look, x, y); p.fixed = true; p.role = 'homeless'; p.home = [x, y]; p.speed = 14; p.cd = G.rand(0, 4);
      p.sleeper = G.hash(hx, hy) < 0.6; p.pose = p.sleeper ? 'lie' : 'sit'; p.dir = 0; p.cup = true; p.script = homelessScript;
      S.peds.push(p);
    }
  }
  // the priest outside the bank, smashing the ATM; throws cake at you when you come close
  let PRIEST_SMASH = null;
  function atmSpot() {
    const b = Wd.places && Wd.places.bank; if (!b) return null;
    return { x: b.x * TS + 11, y: (b.y + b.h) * TS };   // ATM painted on the façade: 10x12 px, its bottom 4 px above the pavement
  }
  function drawBrokenAtm(ctx, camX, camY) {
    const A = atmSpot(); if (!A) return;
    const x = A.x - camX, y = A.y - camY, k = S.atmDmg || 0; if (k <= 0.02) return;
    ctx.save(); ctx.lineWidth = 0.5; ctx.strokeStyle = 'rgba(28,20,36,0.85)';
    // dented panel + smashed screen
    ctx.fillStyle = 'rgba(15,25,45,' + (0.35 + 0.5 * k).toFixed(3) + ')'; ctx.fillRect(x - 3, y - 14, 6, 4);
    ctx.strokeStyle = 'rgba(235,245,255,' + (0.4 + 0.5 * k).toFixed(3) + ')'; ctx.lineWidth = 0.35;
    ctx.beginPath(); ctx.moveTo(x - 0.5, y - 12.2); ctx.lineTo(x - 2.6, y - 13.6); ctx.moveTo(x - 0.5, y - 12.2); ctx.lineTo(x + 2.4, y - 10.4); ctx.moveTo(x - 0.5, y - 12.2); ctx.lineTo(x + 1.6, y - 13.8); if (k > 0.5) { ctx.moveTo(x - 0.5, y - 12.2); ctx.lineTo(x - 2.8, y - 10.6); } ctx.stroke();
    ctx.fillStyle = 'rgba(10,20,40,0.45)'; for (const [dx, dy, r] of [[-3, -7, 1.3], [2.5, -6, 1], [0, -5.2, 0.8]].slice(0, 1 + Math.floor(k * 3))) { ctx.beginPath(); ctx.ellipse(x + dx, y + dy, r * 1.3, r, 0, 0, 7); ctx.fill(); }
    if (k > 0.4) { // keypad hanging on its wires
      ctx.strokeStyle = '#d33'; ctx.lineWidth = 0.4; ctx.beginPath(); ctx.moveTo(x + 1, y - 8); ctx.quadraticCurveTo(x + 2.5, y - 5, x + 2, y - 3.2); ctx.stroke();
      ctx.strokeStyle = '#ffd400'; ctx.beginPath(); ctx.moveTo(x + 2, y - 8); ctx.quadraticCurveTo(x + 4, y - 5.5, x + 3, y - 3.2); ctx.stroke();
      ctx.fillStyle = '#6a7484'; ctx.strokeStyle = 'rgba(28,20,36,0.85)'; ctx.lineWidth = 0.4; ctx.save(); ctx.translate(x + 2.6, y - 2.6); ctx.rotate(0.5); ctx.fillRect(-1.6, -1, 3.2, 2.2); ctx.strokeRect(-1.6, -1, 3.2, 2.2); ctx.restore();
    }
    if (k > 0.7) { // a little smoke
      const t = G.t || 0;
      for (let i = 0; i < 3; i++) { const ph = (t * 0.5 + i / 3) % 1, g = ctx.createRadialGradient(x, y - 14 - ph * 10, 0, x, y - 14 - ph * 10, 2 + ph * 4); g.addColorStop(0, 'rgba(90,90,100,' + (0.35 * (1 - ph)).toFixed(3) + ')'); g.addColorStop(1, 'rgba(90,90,100,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x + Math.sin(ph * 6 + i) * 1.5, y - 14 - ph * 10, 2 + ph * 4, 0, 7); ctx.fill(); }
    }
    ctx.restore();
  }
  function priestScript(p, dt) {
    const pl = G.player, pp = pl.vehicle || pl, d = G.dist(p.x, p.y, pp.x, pp.y), [px, py] = p.home;
    p.t += dt; p.cd -= dt;
    if (G.dist(p.x, p.y, px, py) > 2 && !p.throwT) { // knocked away: back to work
      p.smash = false; const a = Math.atan2(py - p.y, px - p.x); p.move(Math.cos(a) * 26, Math.sin(a) * 26, dt); return;
    }
    p.spCd = (p.spCd || 0) - dt;
    if (!p.throwT && d < 160 && d > 90 && p.spCd <= 0) { p.spCd = G.rand(14, 20); say('priest_spasoume', 'Αυτά τα μηχανήματα πρέπει να τα σπάσουμε!', p, 2.2); }
    if (!p.throwT && d < 90 && p.cd <= 0) p.throwT = 0.001;
    if (p.throwT) { // turn round, shout, throw a cake
      p.smash = false; p.throwT += dt; p.look = G.LOOKS.priest; p.move(0, 0, dt);
      const a = Math.atan2(pp.y - p.y, pp.x - p.x); p.dir = Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? (Math.cos(a) > 0 ? 2 : 1) : (Math.sin(a) > 0 ? 0 : 3);
      if (p.throwT > 0.35 && !p.thrown) { p.thrown = true; say('priest', 'Αντίιιοοο… ΒΖΙΟΥΥΥΝ!', p, 3.6); S.fx.push({ type: 'cake', x: p.x, y: p.y - 14, tx: pp.x, ty: pp.y - 8, t: 0, dur: 0.7 }); }
      if (p.throwT > 1.8) { p.throwT = 0; p.thrown = false; p.cd = G.rand(10, 15); }
      return;
    }
    // smashing the ATM: wind up, strike, sparks
    p.smash = true; p.look = PRIEST_SMASH || (PRIEST_SMASH = Object.assign({}, G.LOOKS.priest, { held: null })); p.move(0, 0, dt); p.dir = 3;
    const ph = (p.t * 1.6) % 1, ph0 = ((p.t - dt) * 1.6) % 1;
    p.frame = ph < 0.6 ? 0 : 1;
    if (ph0 < 0.62 && ph >= 0.62) { // the hit
      const A = atmSpot(); S.atmDmg = Math.min(1, (S.atmDmg || 0) + 0.025);
      for (let i = 0; i < 4; i++) S.fx.push({ type: 'spark', x: A.x + G.rand(-4, 4), y: A.y - 12 + G.rand(-3, 3), t: 0, dur: 0.25 + Math.random() * 0.15 });
    }
  }
  function priestArm(ctx, camX, camY) { // the swinging cross (back view: raised over the head, then down on the ATM)
    const p = this; if (!p.smash) return;
    const x = p.x - camX, y = p.y - camY, ph = (p.t * 1.6) % 1;
    const up = ph < 0.6 ? ph / 0.6 : Math.max(0, 1 - (ph - 0.6) / 0.12);   // slow wind-up, fast strike
    const hx = x + 3.5, hy = y - 13 - up * 6, ang = -Math.PI / 2 - 0.9 + up * 1.4 + (ph >= 0.6 ? 0.25 : 0);
    const ex = hx + Math.cos(ang) * 8, ey = hy + Math.sin(ang) * 8;
    ctx.save(); ctx.lineCap = 'round';
    ctx.strokeStyle = '#2a2420'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(x + 3, y - 16); ctx.lineTo(hx, hy); ctx.stroke(); // sleeve
    ctx.strokeStyle = '#b07b3a'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(ex, ey); ctx.stroke();
    const cx = hx + Math.cos(ang) * 6, cy = hy + Math.sin(ang) * 6, nx = -Math.sin(ang) * 2.2, ny = Math.cos(ang) * 2.2;
    ctx.beginPath(); ctx.moveTo(cx - nx, cy - ny); ctx.lineTo(cx + nx, cy + ny); ctx.stroke();
    ctx.fillStyle = p.look.skin; ctx.beginPath(); ctx.arc(hx, hy, 1.2, 0, 7); ctx.fill();
    ctx.restore();
  }
  function ensurePriest() {
    const A = atmSpot(); if (!A || S.peds.some(p => p.role === 'priest')) return;
    let x = A.x, y = A.y + 9;
    const probe = new E.Person(G.LOOKS.priest, x, y);
    if (probe.blocked(x, y)) { const a = (Wd.atms || [])[0]; if (!a) return; x = a[0] * TS + 8; y = a[1] * TS + 9; }
    if (S.fixInit && !offscreen(x, y, 30)) return;
    const p = new E.Person(G.LOOKS.priest, x, y); p.fixed = true; p.role = 'priest'; p.home = [x, y]; p.t = G.rand(0, 1); p.cd = 0; p.dir = 3; p.speed = 26;
    p.script = priestScript; p.preDraw = drawBrokenAtm; p.postDraw = priestArm;
    S.peds.push(p);
  }
  S.ensureFixtures = function (dt) {
    S.fixT = (S.fixT || 0) + dt; if (S.fixInit && S.fixT < 1) return;   // check once a second
    const step = S.fixInit ? S.fixT : 0; S.fixT = 0;
    try { ensureFerrari(step); ensureHomeless(); ensurePriest(); } catch (e) { if (typeof console !== 'undefined') console.error('fixtures', e); }
    S.fixInit = true;
  };

  // ---------- cameos (one at a time) ----------
  S.cameo = function (kind) {
    const pl = G.player.vehicle || G.player; const ptx = pl.x / TS, pty = pl.y / TS;
    const near = (list, rmin, rmax) => { const c = list.filter(([x, y]) => { const d = Math.hypot(x - ptx, y - pty); return d > rmin && d < rmax; }); return c.length ? G.pick(c) : null; };
    let p = null;
    if (kind === 'gamath') {
      const c = near(Wd.corners, 4, 10); if (!c) return false;
      p = new E.Person(G.LOOKS.gamath, c[0] * TS + 8, c[1] * TS + 10); p.t = 0;
      p.script = (p, dt) => {
        p.t += dt; const pp = G.player.vehicle || G.player; const a = Math.atan2(pp.y - p.y, pp.x - p.x);
        if (p.t < 1.4) p.move(Math.cos(a) * 45, Math.sin(a) * 45, dt);
        else if (p.t < 3.2) { if (!p.said) { p.said = 1; G.audio.say('gamath', 'Γαμάαθ;', p, 2); } p.move(0, 0, dt); p.dir = Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? (Math.cos(a) > 0 ? 2 : 1) : (Math.sin(a) > 0 ? 0 : 3); }
        else { // walks off, gone only once out of view
          if (!p.move(-Math.cos(a) * 60, -Math.sin(a) * 60, dt)) p.move(-Math.sin(a) * 60, Math.cos(a) * 60, dt);
          if (p.t > 6 && offscreen(p.x, p.y, 30)) p.dead = true;
        }
      };
    } else if (kind === 'filos') {
      // comes OUT of a building door carrying something that clearly isn't his, says his line, walks away and off screen
      const doors = Wd.buildings.filter(b => (b.type === 'apart' || b.type === 'house') && b.door).map(b => b.door)
        .filter(([dx, dy]) => Wd.walkable(dx, dy + 1) && Wd.walkable(dx, dy + 2) && !Wd.propAt(dx, dy + 1));
      const c = near(doors, 3, 12); if (!c) return false;
      const look = Object.assign({}, G.LOOKS.filos, { held: null });
      p = new E.Person(look, c[0] * TS + 8, (c[1] + 1) * TS + 1); p.t = 0; p.noclip = true; p.dir = 0; p.speed = 30;
      p.carry = G.pick(['tv', 'microwave', 'painting']);
      p.script = (p, dt) => {
        p.t += dt; const pp = G.player.vehicle || G.player;
        if (p.t < 0.05 && !p.doored) { p.doored = true; G.audio.sfx('door'); }
        if (p.t < 0.6) { p.move(0, 24, dt); return; }                              // steps out of the doorway
        p.noclip = false;
        if (p.t < 2.8) {                                                          // stops, looks at you, says it
          if (!p.said) { p.said = 1; G.audio.say('filos', 'Είναι φίλος μου!', p, 2.2); }
          p.move(0, 0, dt); const a = Math.atan2(pp.y - p.y, pp.x - p.x); p.dir = Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? (Math.cos(a) > 0 ? 2 : 1) : (Math.sin(a) > 0 ? 0 : 3);
          return;
        }
        // walk away along the pavement, away from the player; try the other axis when blocked
        if (!p.away) { const sx = Math.sign(p.x - pp.x) || 1; p.away = [sx, 0]; }
        if (!p.move(p.away[0] * p.speed, p.away[1] * p.speed, dt)) {
          p.blockT = (p.blockT || 0) + dt;
          if (p.blockT > 0.3) { p.blockT = 0; p.away = p.away[0] ? [0, Math.sign(p.y - pp.y) || 1] : [Math.sign(p.x - pp.x) || 1, 0]; }
        }
        if (offscreen(p.x, p.y, 24)) p.dead = true;
        else if (p.t > 45) { p.noclip = true; p.ghostVeh = true; }                // squeezed in somewhere: just keep walking
      };
    } else if (kind === 'kados') {
      const c = near(Wd.bins, 1, 3.5); if (!c) return false;
      const prop = Wd.propAt(c[0], c[1]); prop.lidOpen = true;
      p = new E.Person(G.LOOKS.kados, c[0] * TS + 8, c[1] * TS + 12); p.t = 0; p.lift = 0; p.clip = true; p.noclip = true;
      p.script = (p, dt) => { p.t += dt; p.lift = p.t < 0.3 ? p.t * 30 : p.t < 2.4 ? 9 : Math.max(0, 9 - (p.t - 2.4) * 30); p.dir = p.t < 1 ? 1 : p.t < 1.5 ? 2 : 0; if (p.t > 0.4 && !p.said) { p.said = 1; G.audio.say('kados', 'Άντε γεια!', p, 2); } if (p.t > 2.7) { p.dead = true; prop.lidOpen = false; } };
    }
    if (!p) return false;
    p.cameo = kind; S.peds.push(p); return true;
  };

  // ---------- main update ----------
  S.update = function (dt) {
    const pl = G.player, pp = pl.vehicle || pl;
    const near = (o, r) => G.dist(o.x, o.y, pp.x, pp.y) < r;
    // population: calm
    const nVeh = S.vehicles.filter(v => v.ai && near(v, 420)).length;
    if (nVeh < 7 && G.chance(dt * 1.5)) S.spawnTraffic(pp.x, pp.y);
    // garbage trucks: 1-2 around town, each with a small queue behind it
    S.garbageT = (S.garbageT == null ? 5 : S.garbageT) - dt;
    if (S.garbageT < 0) {
      const ng = S.vehicles.filter(v => v.type === 'garbage' && v.ai).length;
      S.garbageT = ng < 2 && Wd.area(Math.floor(pp.x / TS), Math.floor(pp.y / TS)) === 'town' && S.spawnGarbage(pp.x, pp.y) ? G.rand(35, 60) : 6;
    }
    const nPed = S.peds.filter(p => !p.cop && !p.cameo && !p.fixed && near(p, 380)).length;
    if (nPed < 9 && G.chance(dt * 1.5)) S.spawnPed(pp.x, pp.y);
    S.ensureFixtures(dt);
    // despawn only out of view (with a margin)
    S.vehicles = S.vehicles.filter(v => !v.dead && (v.parked || v === pl.vehicle || v.keep || near(v, 520) || !offscreen(v.x, v.y, 40)));
    S.peds = S.peds.filter(p => !p.dead && (p.fixed || near(p, 460) || !offscreen(p.x, p.y, 30)));
    S.cops = S.cops.filter(c => S.peds.includes(c));

    for (const v of S.vehicles) {
      if (v === pl.vehicle) continue;
      if (v.dias) diasAI(v, dt);
      else if (v.chase) patrolAI(v, dt);
      else if (v.ai) { if (v.stunT > 0) { v.stunT -= dt; v.curSpeed = 0; v.speed = 0; v.vx = v.vy = 0; if (v.stunT <= 0) { if (v.kvx || v.kvy) v.stunT = 0.05; else S.afterStun(v); } } else aiCar(v, dt); } // dazed for a moment after a hit
      else if (v.script) v.script(v, dt);
      else if (Math.abs(v.speed) > 1) v.drive(dt, 0, 0, true);
    }
    separate();
    for (const p of S.peds) { if (p.cop) copAI(p, dt); else pedAI(p, dt); }
    pushPeople(dt);

    // player vehicle hits
    const pv = pl.vehicle;
    if (pv && Math.abs(pv.speed) > 35) {
      for (const p of S.peds) {
        if (p.down > 0 || p.invuln) continue;
        if (G.dist(p.x, p.y - 4, pv.x, pv.y) < pv.wid / 2 + 5) {
          p.knock(Math.cos(pv.a), Math.sin(pv.a), Math.abs(pv.speed) * 0.6);
          if (p.cop) S.addWanted(2, 'Πάτησες αστυνομικό!'); else S.crime(1, 'Παρέσυρες πεζό!', p.x, p.y);
          G.audio.say('ped_hit', G.pick(['Ωχ η μέση μου!', 'Είσαι τρελός;', 'Θα σε καταγγείλω!']), p, 1.6);
        }
      }
    }
    S.crashPhysics(dt);   // car-to-car momentum + dents, knockable props, smoke, never-stuck passes

    // cameos: one at a time, nicely spaced
    S.cameoT -= dt;
    const active = S.peds.some(p => p.cameo);
    if (!active && S.cameoT < 0) { const order = G.pick(['gamath', 'filos', 'filos', 'kados']); /* the priest is a regular at the bank now */ S.cameoT = S.cameo(order) ? G.rand(35, 60) : 4; }
    // ΔΙΑΣ line
    S.diasT -= dt; if (S.diasT < 0) { S.diasT = S.spawnDias() ? G.rand(100, 160) : 15; }
    // taxes (only with a reason: the HUD says why)
    S.taxT -= dt; if (S.taxT < 0) {
      S.taxT = G.rand(150, 220);
      const amt = Math.max(10, Math.round(Math.abs(G.state.money) * 0.08 + G.rand(5, 25)));
      G.addMoney(-amt, 'ΦΟΡΟΣ'); G.audio.sfx('tax');
      G.ui.toast(G.pick(['ΑΑΔΕ: Έκτακτη εισφορά αλληλεγγύης', 'ΑΑΔΕ: Τέλος επιτηδεύματος', 'ΑΑΔΕ: Φόρος πολυτελείας (έχεις παπούτσια)', 'ΑΑΔΕ: Προκαταβολή φόρου 2031']) + '  -' + G.fmtMoney(amt));
    }
    // witness phone call arrives
    if (S.pendingCall) { S.pendingCall.t -= dt; if (S.pendingCall.t <= 0) { const c = S.pendingCall; S.pendingCall = null; S.addWanted(c.sev, '📞 Σε κατέδωσαν: ' + (c.why || 'αναστάτωση')); } }
    // police only when wanted: patrol cars arrive after a short delay
    const w = G.state.wanted;
    if (w > 0) {
      S.wantedCool += dt; S.patrolDelay = (S.patrolDelay || 0) - dt;
      const patrols = S.vehicles.filter(v => v.chase).length;
      if (S.patrolDelay <= 0 && patrols < (w >= 5 ? 4 : w >= 4 ? 3 : w >= 3 ? 2 : 1)) { S.spawnPatrol(); S.patrolDelay = Math.max(3.5, 11 - w * 1.5); }
      const seen = S.cops.some(c => !c.returning && G.dist(c.x, c.y, pp.x, pp.y) < 160) || S.vehicles.some(v => v.chase && G.dist(v.x, v.y, pp.x, pp.y) < 240);
      if (seen) S.wantedCool = 0;
      if (S.wantedCool > 7 + w * 2) { G.state.wanted = w - 1; S.wantedCool = 0; if (G.state.wanted === 0) G.ui.toast('Σε έχασαν. Ησύχασε.'); }
      arrestCheck(dt);
    } else S.arrest = 0;
    // fx
    for (const f of S.fx) {
      f.t += dt;
      if (f.vx != null) { f.x += f.vx * dt; f.y += f.vy * dt; const k = Math.pow(f.type === 'smoke' ? 0.5 : 0.05, dt); f.vx *= k; f.vy *= k; }
      if (f.type === 'cake' && f.t >= f.dur && !f.hit) { f.hit = true; const q = G.player.vehicle || G.player; if (G.dist(f.tx, f.ty, q.x, q.y - 8) < 30) { G.ui.splat(1.6); G.audio.sfx('punch'); } }
    }
    S.fx = S.fx.filter(f => f.t < (f.dur || 0.5) + 0.3);
  };

  S.drawFx = function (ctx, camX, camY) {
    for (const f of S.fx) {
      if (f.type === 'smoke') { // soft grey puff, growing and fading
        const k = f.t / f.dur; if (k >= 1) continue;
        const r = f.r * (1 + k * 2.2), x = f.x - camX, y = f.y - camY, al = (f.dark ? 0.5 : 0.36) * (1 - k) * Math.min(1, k * 6 + 0.2), c = f.dark ? '40,36,40' : '120,118,126';
        const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r); g.addColorStop(0, 'rgba(' + c + ',' + al.toFixed(3) + ')'); g.addColorStop(1, 'rgba(' + c + ',0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); continue;
      }
      if (f.type === 'debris') { // glass / plastic shards skidding away
        const k = f.t / f.dur; if (k >= 1) continue;
        ctx.save(); ctx.globalAlpha = 1 - k * k; ctx.translate(f.x - camX, f.y - camY); ctx.rotate(f.a + f.t * 6); ctx.fillStyle = f.c;
        ctx.beginPath(); ctx.moveTo(-1.2, -0.6); ctx.lineTo(1.1, -0.9); ctx.lineTo(0.4, 0.9); ctx.closePath(); ctx.fill(); ctx.restore(); continue;
      }
      if (f.type === 'spark') { ctx.fillStyle = Math.random() < 0.5 ? '#ffd400' : '#fff'; ctx.fillRect(f.x - camX + G.rand(-3, 3), f.y - camY + G.rand(-3, 3), 2, 2); }
      if (f.type === 'cake' && f.t < f.dur) {
        const k = f.t / f.dur, x = G.lerp(f.x, f.tx, k) - camX, y = G.lerp(f.y, f.ty, k) - camY - Math.sin(k * Math.PI) * 26;
        ctx.fillStyle = '#f7e1c5'; ctx.fillRect(x - 4, y - 2, 8, 5); ctx.fillStyle = '#ff6fa3'; ctx.fillRect(x - 4, y - 3, 8, 2); ctx.fillStyle = '#c0182c'; ctx.fillRect(x, y - 5, 2, 2);
      }
    }
  };
})();

// ---------- direct (arcade) driving: the car goes where the arrows/stick point ----------
// Used by the world and by every quest. axis = G.readAxis() (or any {x,y}); brake = bool.
const driveDirect0 = function (v, dt, axis, brake) {
  const mag = Math.min(1, Math.hypot(axis.x, axis.y)), tNow = G.t || 0;
  if (v.revT > 0) v.revT -= dt; if (v.revCool > 0) v.revCool -= dt;
  // stick released (or brake): roll straight and brake, forget the turn
  if (mag < 0.2 || brake) { v.revT = 0; v.tgtA = null; v.turnSg = 0; return v.drive(dt, 0, 0, true); }
  const me = v.driver && v.driver === G.player, spd = Math.abs(v.speed);
  // damping: the wanted direction follows the stick smoothly (a shaky thumb doesn't wobble the car); a real new direction is taken at once
  const raw = Math.atan2(axis.y, axis.x);
  if (v.tgtA == null || Math.abs(G.angleDiff(v.tgtA, raw)) > 0.6) v.tgtA = raw; else v.tgtA += G.angleDiff(v.tgtA, raw) * Math.min(1, dt * 8);
  let ta = v.tgtA;
  // auto-straighten: a stick that points almost along a road axis means "straight along the road" (with hysteresis: no flicker at the edge)
  if (me) { const q = Math.round(ta / (Math.PI / 2)) * (Math.PI / 2); if (Math.abs(G.angleDiff(ta, q)) < (v.snapQ === q ? 0.26 : 0.2)) { ta = q; v.snapQ = q; } else v.snapQ = null; }
  const diff = G.angleDiff(v.a, ta), ad = Math.abs(diff);
  const since = tNow - (v.blockT == null ? -9 : v.blockT);
  const swing = d2 => { const r = (v.spec.turn + 1.2) * dt; v._na = v.a + G.clamp(d2, -r, r); if (v.pen && v.pen(v.x, v.y, v._na) && !v.pen(v.x, v.y, v.a)) v._na = v.a; };
  // reverse gear: only when the nose is stuck (wall, car, tree) AND the stick points backwards. Once in, it backs out (swinging the nose
  // towards the stick, a 3-point turn) until the nose has come round, something is behind, or ~0.9 s; then a cool-down: never toggling
  if (v.revT > 0) {
    if (v.wrecked || (ad < 1.0 && !v.revWedge) || (since < 0.1 && v.blockRev)) { v.revT = 0; v.revCool = 0.8; }
    else { swing(v.revSg * Math.min(ad, Math.PI)); return v.drive(dt, -mag, 0, false); }
  } else if (!v.wrecked && !(v.revCool > 0) && v.speed < 25 && since < 0.3 && !v.blockRev && ad > 1.5) {
    v.revT = 0.9; v.revWedge = false; v.revSg = Math.sign(diff) || 1; v.turnSg = 0; swing(diff); return v.drive(dt, -mag, 0, false);
  }
  // forward: turn towards the wanted direction; quick when far, easing in near it (no overshoot, no orbiting); within ~3 degrees it
  // snaps onto a road axis, otherwise holds its heading (dead zone: a shaky stick doesn't make it weave)
  const base = me ? (v.spec.turn + 1.6) * (spd < 80 ? 1.15 : 1 - Math.min(0.25, (spd - 80) / 800)) : v.spec.turn + 1.2;
  const rate = Math.min(base, 1 + ad * 9) * dt;
  // a big turn keeps one direction (near 180 degrees the shorter way flips from frame to frame); a new stick direction resets it
  if (v.turnSg && (ad < 1.6 || Math.abs(G.angleDiff(v.turnTa, ta)) > 0.7)) v.turnSg = 0;
  if (!v.turnSg && ad > 2.5) { v.turnSg = Math.sign(diff) || 1; v.turnTa = ta; }
  let na = ad < 0.06 ? (v.snapQ != null || ad < 0.01 ? ta : v.a) : v.a + (v.turnSg && Math.sign(diff) !== v.turnSg ? v.turnSg * rate : G.clamp(diff, -rate, rate));
  // turning in place is blocked (one end touches a wall or a car): swing whichever way is free, or back out if the stick points back
  if (spd < 40 && v.pen && ad > 0.05 && v.pen(v.x, v.y, na) && !v.pen(v.x, v.y, v.a)) {
    const other = 2 * v.a - na, c = Math.cos(v.a) * 2, s = Math.sin(v.a) * 2;
    const backFree = !v.pen(v.x - c, v.y - s, v.a) && !(since < 0.3 && v.blockRev);
    const aheadFree = !v.pen(v.x + c, v.y + s, v.a);
    const wedged = !aheadFree && (v.stuckHold || 0) > 0.08;   // nose stuck and no progress at all: back off a little whatever the stick says
    if (backFree && !(v.revCool > 0) && (ad > 2.3 || (ad > 1.2 && !aheadFree) || wedged)) { v.revWedge = ad <= 1.2; v.revT = v.revWedge ? 0.4 : 0.9; v.revSg = Math.sign(diff) || 1; v._na = v.a; return v.drive(dt, -mag, 0, false); }
    if (ad > 2.5 && !v.pen(v.x, v.y, other)) { na = other; v.turnSg = Math.sign(G.angleDiff(v.a, other)) || 1; v.turnTa = ta; }
    else if (!aheadFree && !backFree && !v.pen(v.x, v.y, other)) na = other;   // boxed in front and behind: pivot the other way
    else na = v.a;   // the turn is blocked: hold the heading (go straight / slide along the wall) instead of wobbling against it
  }
  v._na = na;   // Vehicle.drive applies it (and checks that turning doesn't push the car into a wall)
  // wanting to go the other way at speed: brake while turning (easy U-turns); sharp turns ease off the gas
  if (me && ad > 1.9 && spd > 50) return v.drive(dt, 0, 0, true);
  return v.drive(dt, ad > 1.2 ? (me ? 0.4 : 0.25) * mag : mag, 0, false);
};
// wrapper: if the car makes no progress for a while although the stick is held (wedged in a slot it can't turn in),
// let it wriggle out slowly towards the stick (or sideways), a fraction of a pixel per frame: never stuck for good
G.driveDirect = function (v, dt, axis, brake) {
  const x0 = v.x, y0 = v.y, a0 = v.a, r = driveDirect0(v, dt, axis, brake);
  const mag = Math.min(1, Math.hypot(axis.x, axis.y));
  if (mag < 0.2 || brake || v.wrecked || !v.pen) { v.stuckHold = 0; v.anc = null; return r; }
  const A = v.anc;   // progress over a window (rocking back and forth on the spot is no progress)
  if (!A || Math.hypot(v.x - A.x, v.y - A.y) > 3 || Math.abs(G.angleDiff(A.a, v.a)) > 0.25) v.anc = { x: v.x, y: v.y, a: v.a, t: 0 }; else A.t += dt;
  v.stuckHold = v.anc.t;
  if (v.stuckHold > 0.35) {
    const ta = Math.atan2(axis.y, axis.x), world = !v.solidFn && G.Sim.vehicles.indexOf(v) >= 0;
    const free = (x, y, a) => world ? G.Sim.vehClear(v, x, y, a) : !v.pen(x, y, a);
    for (const da of [0, 0.5, -0.5, 1.1, -1.1, 1.6, -1.6, 2.4, -2.4, Math.PI]) {
      const x = v.x + Math.cos(ta + da) * 0.8, y = v.y + Math.sin(ta + da) * 0.8;
      const turn = v.a + G.clamp(G.angleDiff(v.a, ta + (Math.abs(G.angleDiff(v.a, ta)) > 2.4 ? Math.PI : 0)), -0.02, 0.02);
      if (free(x, y, turn)) { v.x = x; v.y = y; v.a = turn; break; }
      if (free(x, y, v.a)) { v.x = x; v.y = y; break; }
    }
  }
  return r;
};
