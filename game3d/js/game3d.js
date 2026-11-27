// GTA GR 3D test slice: one Athens-ish neighbourhood built from Kenney kits (CC0), a player you can walk/drive,
// Γαμάθ and a few pedestrians, a dog and some traffic. Babylon.js, no build step.
(async function () {
  const K = 'assets/kenney/';
  const canvas = document.getElementById('c');
  const engine = new BABYLON.Engine(canvas, true, { stencil: true });
  const scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);
  scene.fogMode = BABYLON.Scene.FOGMODE_EXP2; scene.fogDensity = 0.012; scene.fogColor = BABYLON.Color3.FromHexString('#d6b8e6');
  const C3 = h => BABYLON.Color3.FromHexString(h);

  // ---- light ----
  const hemi = new BABYLON.HemisphericLight('h', new BABYLON.Vector3(0, 1, 0), scene); hemi.intensity = 0.75; hemi.groundColor = C3('#8a80c8'); hemi.diffuse = C3('#fff0f4');
  const sun = new BABYLON.DirectionalLight('s', new BABYLON.Vector3(-0.6, -1, -0.45), scene); sun.intensity = 1.5; sun.diffuse = C3('#ffe2c8');
  sun.position = new BABYLON.Vector3(30, 50, 25);
  const shadows = new BABYLON.ShadowGenerator(2048, sun); shadows.usePercentageCloserFiltering = true; shadows.bias = 0.002;
  recolor.img = await new Promise((r, j) => { const i = new Image(); i.onload = () => r(i); i.onerror = j; i.src = K + 'mini/Textures/colormap.png'; });
  const caster = m => m.getChildMeshes(false).concat([m]).forEach(x => { if (x.getTotalVertices && x.getTotalVertices()) shadows.addShadowCaster(x); });

  // ---- model loading (one container per file, instantiated many times) ----
  const cache = {};
  async function box(kit, name) { const k = kit + '/' + name; if (!cache[k]) cache[k] = BABYLON.SceneLoader.LoadAssetContainerAsync(K + kit + '/', name + '.glb', scene); return cache[k]; }
  async function inst(kit, name, opts = {}) {
    const c = await box(kit, name), e = c.instantiateModelsToScene(n => n, false, { doNotInstantiate: true });
    const root = e.rootNodes[0]; root.metadata = { anims: {} }; e.animationGroups.forEach(a => { a.stop(); root.metadata.anims[a.name] = a; });
    if (opts.size) { const b = root.getHierarchyBoundingVectors(true), d = b.max.subtract(b.min); const s = opts.size / (opts.axis === 'y' ? d.y : Math.max(d.x, d.z)); root.scaling.scaleInPlace(s); }
    if (opts.shadow !== false) caster(root);
    root.getChildMeshes().forEach(m => { m.receiveShadows = true; });
    return root;
  }
  const footprint = root => { const b = root.getHierarchyBoundingVectors(true); return { x0: b.min.x, x1: b.max.x, z0: b.min.z, z1: b.max.z }; };

  // ---- world layout: 3x3 blocks, roads between ----
  const BLOCK = 16, ROAD = 6, N = 3, PITCH = BLOCK + ROAD, SIZE = N * PITCH + ROAD;
  const off = -SIZE / 2;
  const blockAt = (i, j) => ({ x0: off + ROAD + i * PITCH, z0: off + ROAD + j * PITCH });
  const mat = (h, spec = 0) => { const m = new BABYLON.StandardMaterial('m' + h, scene); m.diffuseColor = C3(h); m.specularColor = new BABYLON.Color3(spec, spec, spec); return m; };
  const asphalt = BABYLON.MeshBuilder.CreateGround('road', { width: SIZE + 40, height: SIZE + 40 }, scene); asphalt.material = mat('#5d5670'); asphalt.receiveShadows = true;
  const solids = []; // AABBs the player and cars collide with
  const sideMat = mat('#c9b8cf'), curbMat = mat('#e8dce8'), lineMat = mat('#f4e6b0');
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const b = blockAt(i, j);
    const sw = BABYLON.MeshBuilder.CreateBox('sw', { width: BLOCK, depth: BLOCK, height: 0.18 }, scene); sw.position.set(b.x0 + BLOCK / 2, 0.09, b.z0 + BLOCK / 2); sw.material = sideMat; sw.receiveShadows = true;
    const curb = BABYLON.MeshBuilder.CreateBox('cb', { width: BLOCK + 0.3, depth: BLOCK + 0.3, height: 0.14 }, scene); curb.position.set(b.x0 + BLOCK / 2, 0.07, b.z0 + BLOCK / 2); curb.material = curbMat;
  }
  // dashed centre lines
  for (let r = 0; r <= N; r++) for (let t = -SIZE / 2; t < SIZE / 2; t += 3) {
    const c = off + r * PITCH + ROAD / 2;
    const a = BABYLON.MeshBuilder.CreateGround('l', { width: 0.18, height: 1.4 }, scene); a.position.set(c, 0.012, t); a.material = lineMat;
    const b2 = BABYLON.MeshBuilder.CreateGround('l', { width: 1.4, height: 0.18 }, scene); b2.position.set(t, 0.012, c); b2.material = lineMat;
  }

  // buildings around each block, facing the street (Kenney commercial + modular towers as polykatoikies)
  const BLD = ['building-a', 'building-b', 'building-c', 'building-d', 'building-e', 'building-f', 'building-g', 'building-h', 'building-i', 'building-j', 'building-k', 'building-l', 'building-m', 'building-n'];
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const SPAWN = new BABYLON.Vector3(off + ROAD / 2, 0, 0); // player starts on the middle-left street
  const tasks = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const b = blockAt(i, j), inset = 2.2, lots = 3, lot = (BLOCK - inset * 2) / lots;
    if (i === 1 && j === 1) continue; // middle block: a small park (see below)
    for (let side = 0; side < 4; side++) for (let k = 0; k < lots; k++) {
      const along = inset + lot * (k + 0.5);
      let x, z, rot;
      if (side === 0) { x = b.x0 + along; z = b.z0 + inset; rot = Math.PI; }
      else if (side === 1) { x = b.x0 + along; z = b.z0 + BLOCK - inset; rot = 0; }
      else if (side === 2) { x = b.x0 + inset; z = b.z0 + along; rot = -Math.PI / 2; }
      else { x = b.x0 + BLOCK - inset; z = b.z0 + along; rot = Math.PI / 2; }
      if ((side >= 2) && (k === 0 || k === lots - 1)) continue; // corners already taken by sides 0/1
      const name = BLD[Math.floor(rnd() * BLD.length)];
      tasks.push(inst('city-kit-commercial', name, { size: lot * 0.95 }).then(r => { r.position.set(x, 0.18, z); r.rotation = new BABYLON.Vector3(0, rot, 0); r.computeWorldMatrix(true); solids.push(footprint(r)); }));
    }
  }
  // fill the inside of every block with a low courtyard mass so the streets stay streets
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { if (i === 1 && j === 1) continue;
    const b = blockAt(i, j), w = BLOCK - 2.2 * 2 - 2.4, m = BABYLON.MeshBuilder.CreateBox('core', { width: w, depth: w, height: 2.6 }, scene);
    m.position.set(b.x0 + BLOCK / 2, 1.3 + 0.18, b.z0 + BLOCK / 2); m.material = mat('#b6a6c8'); m.receiveShadows = true; caster(m);
    solids.push({ x0: m.position.x - w / 2, x1: m.position.x + w / 2, z0: m.position.z - w / 2, z1: m.position.z + w / 2 }); }
  // park in the middle block: grass, trees from the industrial kit if present, benches as boxes
  { const b = blockAt(1, 1), g = BABYLON.MeshBuilder.CreateBox('park', { width: BLOCK - 1.5, depth: BLOCK - 1.5, height: 0.22 }, scene);
    g.position.set(b.x0 + BLOCK / 2, 0.11, b.z0 + BLOCK / 2); g.material = mat('#9bc9a2'); g.receiveShadows = true;
    for (let t = 0; t < 7; t++) { // low-poly palms: trunk + leaf cones
      const px = b.x0 + 2.5 + rnd() * (BLOCK - 5), pz = b.z0 + 2.5 + rnd() * (BLOCK - 5);
      const tr = BABYLON.MeshBuilder.CreateCylinder('tr', { height: 3.2, diameterTop: 0.18, diameterBottom: 0.3, tessellation: 6 }, scene); tr.position.set(px, 1.8, pz); tr.material = mat('#8a6a8e');
      for (let l = 0; l < 6; l++) { const lf = BABYLON.MeshBuilder.CreateCylinder('lf', { height: 1.8, diameterTop: 0, diameterBottom: 0.5, tessellation: 3 }, scene);
        lf.position.set(px, 3.4, pz); lf.rotation.set(1.1, l * Math.PI / 3, 0); lf.material = mat('#6a8fd0'); lf.bakeCurrentTransformIntoVertices(); lf.position.set(px, 3.4, pz); caster(lf); }
      caster(tr); solids.push({ x0: px - 0.25, x1: px + 0.25, z0: pz - 0.25, z1: pz + 0.25 });
    }
  }
  await Promise.all(tasks);

  // ---- characters ----
  const CH = 0.95; // character height in world units (buildings ~4-5 units tall)
  async function person(base, look) {
    const r = await inst('mini', base, { size: CH, axis: 'y' });
    if (look) r.getChildMeshes().forEach(m => recolor(m, look));
    return r;
  }
  const play = (r, n, loop = true, speed = 1) => { const A = r.metadata.anims; if (r.metadata.cur === n) return; if (r.metadata.cur && A[r.metadata.cur]) A[r.metadata.cur].stop(); r.metadata.cur = n; if (A[n]) A[n].start(loop, speed); };

  const player = await person('character-male-a');
  player.position.copyFrom(SPAWN); play(player, 'idle');

  // Γαμάθ: bald on top, hair on the sides, the beard of the base model becomes the mask under the chin
  const GAMATH = { skin: '#e8b48e', hair: '#4a3a2a', mask: '#7fb6e6', jacket: '#2a4bb0', yellow: '#f2c21b', fleece: '#5a3a28', trousers: '#3a3532', shoes: '#1c1c20', bald: true };
  const gam = await person('character-male-b', GAMATH);
  gam.position.set(SPAWN.x + ROAD / 2 + 0.9, 0.18, SPAWN.z + 4.5); gam.rotation = new BABYLON.Vector3(0, -Math.PI / 2, 0); play(gam, 'idle');
  addStrap(gam);
  const gamBubble = bubble('Γαμάαθ;'); let gamT = 0;

  // pedestrians walking round the blocks on the pavement
  const peds = [];
  const PEDS = ['character-female-a', 'character-female-b', 'character-female-c', 'character-male-c', 'character-male-e', 'character-female-d', 'character-male-f', 'character-female-e'];
  for (let p = 0; p < PEDS.length; p++) {
    const i = p % N, j = Math.floor(p / N) % N, b = blockAt(i, j), e = 0.8;
    const loop = [[b.x0 + e, b.z0 + e], [b.x0 + BLOCK - e, b.z0 + e], [b.x0 + BLOCK - e, b.z0 + BLOCK - e], [b.x0 + e, b.z0 + BLOCK - e]];
    const r = await person(PEDS[p]); const k = Math.floor(rnd() * 4); r.position.set(loop[k][0], 0.18, loop[k][1]); play(r, 'walk');
    peds.push({ r, loop, k: (k + 1) % 4, sp: 1.1 + rnd() * 0.5 });
  }
  // a stray dog
  const dog = await inst('cube-pets', 'animal-dog', { size: 0.55 }); dog.position.set(SPAWN.x - 1, 0, SPAWN.z - 5); play(dog, 'walk');

  // ---- cars ----
  const cars = [];
  async function car(name, x, z, rot, ai) {
    const r = await inst('car-kit', name, { size: 2.3 }); r.position.set(x, 0, z); r.rotation = new BABYLON.Vector3(0, rot, 0);
    const c = { r, v: 0, heading: rot, ai, wheels: r.getChildMeshes().filter(m => /wheel/i.test(m.name)) }; cars.push(c); return c;
  }
  await car('taxi', SPAWN.x + 1.6, SPAWN.z - 2.5, 0, null);
  await car('police', off + ROAD + PITCH - ROAD / 2 - 1.5, off + ROAD + 3, 0, null);
  await car('sedan', off + ROAD + PITCH * 2 - 1.5 - ROAD / 2, off + ROAD + PITCH + 5, Math.PI, null);
  // traffic: loops along the ring road
  const ring = [[off + ROAD / 2 + 1, off + ROAD / 2 + 1], [SIZE / 2 - ROAD / 2 - 1, off + ROAD / 2 + 1], [SIZE / 2 - ROAD / 2 - 1, SIZE / 2 - ROAD / 2 - 1], [off + ROAD / 2 + 1, SIZE / 2 - ROAD / 2 - 1]];
  for (const [n, k] of [['sedan-sports', 0], ['van', 2], ['suv', 1], ['ambulance', 3]]) { const c = await car(n, ring[k][0], ring[k][1], 0, { k: (k + 1) % 4 }); c.v = 6; }

  // ---- input ----
  const keys = {}; addEventListener('keydown', e => { keys[e.code] = true; if (e.code === 'KeyE') act(); }); addEventListener('keyup', e => keys[e.code] = false);
  const touch = matchMedia('(pointer: coarse)').matches; const joy = { x: 0, y: 0 };
  if (touch) { const J = document.getElementById('joy'), knob = J.firstElementChild; J.style.display = 'block'; document.getElementById('act').style.display = 'block';
    document.getElementById('act').onclick = act; document.getElementById('help').style.display = 'none';
    const mv = e => { const r = J.getBoundingClientRect(), t = e.touches[0]; let x = (t.clientX - r.left - 60) / 50, y = (t.clientY - r.top - 60) / 50; const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; } joy.x = x; joy.y = y; knob.style.transform = `translate(${x * 35}px,${y * 35}px)`; e.preventDefault(); };
    J.addEventListener('touchstart', mv); J.addEventListener('touchmove', mv); J.addEventListener('touchend', () => { joy.x = joy.y = 0; knob.style.transform = ''; }); }
  const axis = () => { let x = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0), y = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0); if (joy.x || joy.y) { x = joy.x; y = joy.y; } return { x, y }; };

  let driving = null;
  function act() {
    if (driving) { driving.v = 0; player.setEnabled(true); const s = new BABYLON.Vector3(Math.cos(driving.heading), 0, -Math.sin(driving.heading)).scale(1.4); player.position.copyFrom(driving.r.position.add(s)); player.position.y = 0.18; driving = null; return; }
    let best = null, bd = 3.6; for (const c of cars) { const d = BABYLON.Vector3.Distance(c.r.position, player.position); if (d < bd) { bd = d; best = c; } }
    if (best) { driving = best; best.ai = null; player.setEnabled(false); }
  }

  // ---- camera: angled top-down follow, like the 2D game but in 3D ----
  // third person: the camera sits behind the player and swings round behind them as they move (mouse can still orbit)
  const cam = new BABYLON.ArcRotateCamera('cam', -Math.PI / 2, 1.22, 5.2, player.position.clone(), scene);
  cam.lowerRadiusLimit = 3; cam.upperRadiusLimit = 12; cam.lowerBetaLimit = 0.6; cam.upperBetaLimit = 1.45; cam.minZ = 0.05;
  const behind = (yaw, k) => { const want = -yaw - Math.PI / 2; let d = want - cam.alpha; d = Math.atan2(Math.sin(d), Math.cos(d)); cam.alpha += d * k; }; cam.attachControl(canvas, true); cam.inputs.removeByType('ArcRotateCameraKeyboardMoveInput');
  cam.wheelPrecision = 30;

  const collide = (p, rad) => { for (const s of solids) { if (p.x > s.x0 - rad && p.x < s.x1 + rad && p.z > s.z0 - rad && p.z < s.z1 + rad) {
    const dx = Math.min(p.x - (s.x0 - rad), (s.x1 + rad) - p.x), dz = Math.min(p.z - (s.z0 - rad), (s.z1 + rad) - p.z);
    if (dx < dz) p.x = p.x - (s.x0 - rad) < (s.x1 + rad) - p.x ? s.x0 - rad : s.x1 + rad; else p.z = p.z - (s.z0 - rad) < (s.z1 + rad) - p.z ? s.z0 - rad : s.z1 + rad; return true; } } return false; };
  const groundY = p => { for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const b = blockAt(i, j); if (p.x > b.x0 && p.x < b.x0 + BLOCK && p.z > b.z0 && p.z < b.z0 + BLOCK) return 0.18; } return 0; };

  scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min(0.05, engine.getDeltaTime() / 1000);
    const camYaw = cam.alpha + Math.PI / 2; // screen-relative movement
    if (!driving) {
      const a = axis(), run = keys.ShiftLeft || keys.ShiftRight || Math.hypot(a.x, a.y) > 0.95 && touch;
      if (a.x || a.y) {
        const mx = a.x * Math.cos(camYaw) - a.y * Math.sin(camYaw), mz = -a.x * Math.sin(camYaw) - a.y * Math.cos(camYaw), l = Math.hypot(mx, mz);
        const sp = (run ? 5.2 : 2.6) * dt; player.position.x += mx / l * sp; player.position.z += mz / l * sp;
        const want = Math.atan2(mx, mz); player.rotation = new BABYLON.Vector3(0, want, 0); play(player, run ? 'sprint' : 'walk');
        if (a.y < 0) behind(want, 0.04); // walking forward: camera eases in behind
      } else play(player, 'idle');
      collide(player.position, 0.25); player.position.y = groundY(player.position);
      cam.target = BABYLON.Vector3.Lerp(cam.target, player.position.add(new BABYLON.Vector3(0, 0.75, 0)), 0.2);
    } else {
      const a = axis(), c = driving;
      const acc = -a.y, steer = a.x;
      c.v += acc * 11 * dt; c.v *= 0.985; c.v = Math.max(-5, Math.min(16, c.v));
      c.heading += steer * dt * 2.2 * Math.max(-1, Math.min(1, c.v / 5));
      cam.target = BABYLON.Vector3.Lerp(cam.target, c.r.position.add(new BABYLON.Vector3(0, 0.9, 0)), 0.2);
      cam.radius += ((Math.abs(c.v) > 3 ? 8 : 7) - cam.radius) * 0.05; behind(Math.PI / 2 - c.heading, 0.06);
    }
    // cars
    for (const c of cars) {
      if (c.ai) { const t = ring[c.ai.k], dx = t[0] - c.r.position.x, dz = t[1] - c.r.position.z; if (Math.hypot(dx, dz) < 1.2) c.ai.k = (c.ai.k + 1) % 4;
        const want = Math.atan2(dx, dz) - Math.PI / 2 * 0; let d = Math.atan2(dx, dz) - (Math.PI / 2 - c.heading) ; d = Math.atan2(Math.sin(d), Math.cos(d)); c.heading -= Math.max(-2 * dt, Math.min(2 * dt, d)); }
      const fx = Math.sin(Math.PI / 2 - c.heading), fz = Math.cos(Math.PI / 2 - c.heading);
      if (c.v) { const p = c.r.position; p.x += fx * c.v * dt; p.z += fz * c.v * dt; if (collide(p, 0.9)) c.v *= -0.3; }
      c.r.rotation.y = Math.PI / 2 - c.heading;
      c.wheels.forEach(w => { w.rotation.x += c.v * dt * 2; });
    }
    // pedestrians
    for (const p of peds) { const t = p.loop[p.k], dx = t[0] - p.r.position.x, dz = t[1] - p.r.position.z, l = Math.hypot(dx, dz);
      if (l < 0.2) p.k = (p.k + 1) % 4; else { p.r.position.x += dx / l * p.sp * dt; p.r.position.z += dz / l * p.sp * dt; p.r.rotation = new BABYLON.Vector3(0, Math.atan2(dx, dz), 0); } }
    // dog wanders in a circle
    const tt = performance.now() / 1000; dog.position.x = SPAWN.x - 1 + Math.cos(tt * 0.4) * 2; dog.position.z = SPAWN.z - 5 + Math.sin(tt * 0.4) * 2; dog.rotation = new BABYLON.Vector3(0, -tt * 0.4, 0);
    // Γαμάθ: when you come close he turns to you, shakes his head and asks
    const near = !driving && BABYLON.Vector3.Distance(player.position, gam.position) < 3;
    if (near) { const d = player.position.subtract(gam.position); gam.rotation = new BABYLON.Vector3(0, Math.atan2(d.x, d.z), 0); play(gam, 'emote-no'); gamT = 2; }
    else if ((gamT -= dt) <= 0) play(gam, 'idle');
    place(gamBubble, gam, gamT > 0);
    document.getElementById('hud').textContent = driving ? 'ΟΔΗΓΕΙΣ · E για να βγεις' : 'Πήγαινε στο ταξί και πάτα E';
  });

  engine.runRenderLoop(() => scene.render()); addEventListener('resize', () => engine.resize());
  window.G3D = { scene, player, cars, cam, play };

  // ---------- helpers ----------
  function bubble(text) { const d = document.createElement('div'); d.className = 'bub'; d.textContent = text; d.style.display = 'none'; document.body.appendChild(d); return d; }
  function place(el, node, show) { if (!show) { el.style.display = 'none'; return; }
    const p = BABYLON.Vector3.Project(node.position.add(new BABYLON.Vector3(0, CH * 1.25, 0)), BABYLON.Matrix.Identity(), scene.getTransformMatrix(), cam.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight()));
    const k = canvas.clientWidth / engine.getRenderWidth(); el.style.left = p.x * k + 'px'; el.style.top = p.y * k + 'px'; el.style.display = 'block'; }
  function addStrap(r) { // black strap across the chest + small bag, parented to the torso bone
    const torso = r.getDescendants(false).find(n => n.name === 'torso'); if (!torso) return;
    const s = BABYLON.MeshBuilder.CreateBox('strap', { width: 0.05, height: 0.62, depth: 0.03 }, scene); s.material = mat('#151515');
    const b = BABYLON.MeshBuilder.CreateBox('bag', { width: 0.2, height: 0.16, depth: 0.09 }, scene); b.material = mat('#262626');
    s.parent = torso; s.position.set(0, 0.12, 0.13); s.rotation.z = 0.7; b.parent = torso; b.position.set(-0.22, -0.08, 0.1); caster(s); caster(b);
  }
  var palette = null;
  function pal(u, v) { if (!palette) { const img = recolor.img; const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0); palette = { d: x.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height }; }
    const px = Math.min(palette.w - 1, Math.max(0, Math.floor(u * palette.w))), py = Math.min(palette.h - 1, Math.max(0, Math.floor(v * palette.h))), k = (py * palette.w + px) * 4;
    return [palette.d[k] / 255, palette.d[k + 1] / 255, palette.d[k + 2] / 255]; }
  function hsl(r, g, b) { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let h = 0, s = 0; if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; } return [h, s, l]; }
  function recolor(mesh, L) {
    if (!mesh.getTotalVertices || !mesh.getTotalVertices()) return;
    mesh.makeGeometryUnique(); mesh.convertToFlatShadedMesh();
    const pos = mesh.getVerticesData('position'), uv = mesh.getVerticesData('uv'), mi = mesh.getVerticesData('matricesIndices'), mw = mesh.getVerticesData('matricesWeights');
    const bones = mesh.skeleton ? mesh.skeleton.bones : [], ind = mesh.getIndices(), n = pos.length / 3, col = new Float32Array(n * 4);
    const isHead = /head/.test(mesh.name);
    let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; for (let v = 0; v < n; v++) for (let a = 0; a < 3; a++) { mn[a] = Math.min(mn[a], pos[v * 3 + a]); mx[a] = Math.max(mx[a], pos[v * 3 + a]); }
    const nrm = (v, a) => (pos[v * 3 + a] - mn[a]) / ((mx[a] - mn[a]) || 1);
    const dom = v => { if (!mi) return ''; let bi = 0, bw = -1; for (let k = 0; k < 4; k++) if (mw[v * 4 + k] > bw) { bw = mw[v * 4 + k]; bi = mi[v * 4 + k]; } return bones[bi] ? bones[bi].name : ''; };
    for (let t = 0; t < ind.length; t += 3) {
      const A = ind[t], B = ind[t + 1], Cc = ind[t + 2], cen = a => (nrm(A, a) + nrm(B, a) + nrm(Cc, a)) / 3;
      const x = cen(0) - 0.5, y = cen(1), z = cen(2), o = pal((uv[A * 2] + uv[B * 2] + uv[Cc * 2]) / 3, (uv[A * 2 + 1] + uv[B * 2 + 1] + uv[Cc * 2 + 1]) / 3), [h, s, l] = hsl(...o), b = dom(A);
      const skin = h > 12 && h < 40 && s > 0.3 && l > 0.55 && l < 0.88, dark = l < 0.2;
      let c;
      if (isHead) {
        if (dark) c = null;                                         // eyes / mouth
        else if (!skin && z > 0.6 && y < 0.45) c = L.mask;          // beard volume -> surgical mask under the chin
        else if (L.bald && y > 0.78 && Math.abs(x) < 0.36) c = L.skin; // bald top
        else if (Math.abs(x) > 0.38 && y > 0.35 && y < 0.82 || (z < 0.22 && y > 0.3 && y < 0.82)) c = L.hair; // sides + back
        else c = L.skin;
      } else if (/arm/.test(b)) c = skin ? L.skin : (y > 0.86 ? L.yellow : L.jacket);
      else if (/leg/.test(b)) c = y < 0.1 ? L.shoes : L.trousers;
      else c = skin ? L.skin : y > 0.9 ? L.yellow : (z > 0.75 && Math.abs(x) < 0.12) ? L.fleece : y < 0.42 ? L.trousers : L.jacket;
      const rgb = c ? C3(c) : new BABYLON.Color3(...o);
      for (const v of [A, B, Cc]) col.set([rgb.r, rgb.g, rgb.b, 1], v * 4);
    }
    mesh.setVerticesData('color', col);
    const m = new BABYLON.StandardMaterial(mesh.name + '_vc', scene); m.diffuseColor = BABYLON.Color3.White(); m.specularColor = new BABYLON.Color3(0.04, 0.04, 0.04); mesh.material = m; mesh.useVertexColors = true;
  }
})().catch(e => { document.getElementById('hud').textContent = 'ERR ' + (e && e.message); console.error(e); });

