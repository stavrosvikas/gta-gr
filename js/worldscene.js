// GTA LUBEN — the open-world town scene + story flow
'use strict';
(function () {
  const TS = G.TS, U = G.ui, Wd = G.World, S = G.Sim;

  const WS = G.worldScene = { markers: [], zoneShow: 0, zoneLabel: '', objective: '', hint: null, camX: 0, camY: 0 };

  // ---------- STORY ----------
  // One quest at a time. Each step: where it starts (tile), and the phone message that sends you there.
  G.STORY = [
    { id: 'dance', at: () => [44, 37], place: 'την πλατεία μπροστά στη Βουλή', sms: 'Καλώς ήρθες. Λεφτά θες; Στη Βουλή παίζει συναυλία πάνω σε φορτηγό. Χόρεψε μπροστά, μαζεύεις φιλοδωρήματα από τον κόσμο.' },
    { id: 'cyclist', at: () => [70, 26], place: 'το αμάξι στον δρόμο της Αγοράς', sms: 'Μπες στο αμάξι στην Αγορά και κάνε μια βόλτα. Λένε ότι στον μονόδρομο ένας ποδηλάτης κλείνει τον δρόμο σε όλους.' },
    { id: 'pitch', at: () => [72, 65], place: 'το γήπεδο', sms: 'Μπήκε σκύλος στο γήπεδο και σταμάτησε το ματς. Ο πρόεδρος της ομάδας πληρώνει όποιον τον βγάλει.' },
    { id: 'seraios', at: () => Wd.entryOf('seraios'), via: 'train', place: 'την αυλή στις Σέρρες', sms: 'Ένας φίλος στις Σέρρες έχει πρόβλημα με ένα φίδι. Πάρε το τρένο από τον Σταθμό ΟΣΕ. Φέρε σκούπα.' },
    { id: 'crete', at: () => Wd.entryOf('crete'), via: 'boat', place: 'τις στροφές στην Κρήτη', sms: 'Στην Κρήτη ένας οδηγός δεν παίρνει τις στροφές. Το πλοίο για Κρήτη φεύγει από το λιμάνι, νότια της πόλης, και σε αφήνει ακριβώς στη στροφάρα.' },
    { id: 'ferrari', open: true, at: () => Wd.entryOf('ferrari'), place: 'το χωράφι στη Θεσσαλία', sms: 'Μια κυρία με Ferrari ψάχνει βοηθό για «αγροτικές δουλειές» στη Θεσσαλία. Πάρε ένα αμάξι και βγες στην εθνική, ανατολικά. Πληρώνει καλά. Μην ρωτάς πολλά.' },
    { id: 'shepherd', open: true, at: () => Wd.entryOf('shepherd'), place: 'το βουνό στο τέλος της εθνικής', sms: 'Θέλουμε κάποιον να περάσει μια μηχανή από το βουνό. Η εθνική τελειώνει στο βουνό, εκεί σε περιμένει. Εύκολο. Λέμε τώρα.' },
    { id: 'milos', at: () => Wd.entryOf('milos'), via: 'heli', place: 'το beach bar στη Μήλο', sms: 'Τελευταία δουλειά: σερβιτόρος στη Μήλο για πλούσιους. Σε περιμένει ελικόπτερο στο ελικοδρόμιο του πάρκου.' },
    { id: 'finale', at: () => Wd.front('tax'), place: 'την Εφορία', sms: 'Έχεις τα λεφτά. Πήγαινε στην Εφορία να ξεπληρώσεις το χρέος. Καλή τύχη με την ουρά.' },
  ];
  G.DEBT = 2000;
  // world mods: extra life on the map (beach, basketball court...). Each: { reset(), update(dt), ground(ctx,camX,camY), sprites(push,camX,camY), interact(player) -> {hint, act} }
  G.worldMods = G.worldMods || [];
  const mods = fn => { for (const m of G.worldMods) { try { fn(m); } catch (e) { console.error('worldMod', m.id, e); } } };
  // the player always has two quests to choose from (+ the always-open ones)
  WS.availSteps = function () {
    const st = G.state, out = [];
    for (const s of G.STORY) {
      if (st.done[s.id] || s.open) continue;
      if (s.id === 'finale' && out.length) break;
      out.push(s); if (out.length >= 2) break;
    }
    for (const s of G.STORY) if (s.open && !st.done[s.id] && !out.includes(s)) out.push(s);
    if (!out.length && !st.done.finale) out.push(G.STORY[G.STORY.length - 1]);
    return out;
  };
  WS.storyStepOld = () => { const st = G.state; while (st.story < G.STORY.length - 1 && st.done[G.STORY[st.story].id]) st.story++; return G.STORY[st.story]; };
  WS.storyStep = () => WS.availSteps()[0];

  WS.placeNear = function (p, pred, r = 20) { return Wd.findNear(G.clamp(p[0], 2, Wd.w - 3), G.clamp(p[1], 2, Wd.h - 3), pred, r); };
  const walk = (x, y) => Wd.walkable(x, y) && !Wd.propAt(x, y);

  WS.enter = function () {
    const st = G.state;
    if (st.story == null) st.story = 0; st.wanted = 0;
    if (st.sms) st.sms = st.sms.filter(m => !m.text.includes('έξω από τα σουβλάκια')); // old wording if (st.radioOn == null) st.radioOn = false;
    S.reset(); S.spawnParked();
    const sp = WS.placeNear([44, 46], walk);
    G.player = G.Ent.makePlayer(sp[0] * TS + 8, sp[1] * TS + 10); G.player.look = st.look; G.player.dir = 3;
    WS.setupFixed();
    WS.camX = G.player.x - G.W / 2; WS.camY = G.player.y - G.H / 2;
    WS.busted = false; WS.dead = false; WS.lastStep = null;
    mods(m => m.reset && m.reset()); WS.drops = [];
    WS.refreshMarkers();
  };
  WS.resume = function () {
    G.player.look = G.state.look;
    const before = (WS.lastStep || '').split(','); WS.refreshMarkers();
    WS.queuePhone(WS.availSteps().filter(s => !before.includes(s.id)), 3);
  };

  // ---------- phone (GTA-style message) ----------
  WS.phone = function (step) {
    if (!step) return;
    G.sms(step.sms); WS.phoneMsg = { text: step.sms, t: 8 }; G.audio.sfx('good');
    (G.state.smsSent = G.state.smsSent || {})[step.id] = true;
  };
  // messages come one at a time, in story order, with a long gap between them (never a pile-up on entering).
  // Every available mission still has its marker on the map, so you can find and start one before its message.
  WS.smsQueue = []; WS.smsGap = 0;
  WS.queuePhone = function (steps, firstIn = 2) {
    const sent = G.state.smsSent || {};
    const had = s => sent[s.id] || (G.state.sms || []).some(m => m.text === s.sms); // older saves: already in the inbox
    for (const s of steps) if (s && !had(s) && !WS.smsQueue.includes(s)) WS.smsQueue.push(s);
    if (WS.smsQueue.length) WS.smsGap = Math.min(WS.smsGap || firstIn, firstIn);
  };
  WS.tickPhone = function (dt) {
    if (!WS.smsQueue.length || WS.phoneMsg) return;
    WS.smsGap -= dt; if (WS.smsGap > 0) return;
    const s = WS.smsQueue.shift();
    if (!G.state.done[s.id] && WS.availSteps().includes(s)) WS.phone(s);
    WS.smsGap = 45; // next one after a while of free roaming
  };

  // fixed NPCs: school interview
  WS.STUDENT = [['student_1', 'Ιστορία γενικής δίναμε σήμερα.'], ['student_2', 'Τα θέματα ήταν εύκολα.'], ['student_3', 'Και εγώ δηλαδή δεν είχα παραδιαβάσει.'], ['student_4', 'Ε, θα μπορούσα και καλύτερα.'], ['student_5', 'Δε με πολυενδιαφέρει και βασικά κιόλας.']];
  WS.setupFixed = function () {
    const sc = Wd.front('school');
    const st = new G.Ent.Person(G.LOOKS.student, sc[0] * TS - 4, sc[1] * TS + 30); st.fixed = true; st.invuln = true; st.dir = 0;
    const rp = new G.Ent.Person(G.LOOKS.reporter, sc[0] * TS + 14, sc[1] * TS + 32); rp.fixed = true; rp.invuln = true; rp.dir = 1;
    const cam = new G.Ent.Person({ skin: '#d9a27a', hair: '#222', hairStyle: 'short', top: '#333', topStyle: 'jacket', legs: '#222', acc: ['cap:#222'], held: 'radio' }, sc[0] * TS + 26, sc[1] * TS + 40); cam.fixed = true; cam.invuln = true; cam.dir = 1;
    const Q = ['Τι γνώμη έχεις για τις Πανελλήνιες;', 'Πώς βλέπεις το μέλλον της χώρας;', 'Θα παίξεις το GTA VI;', 'Τι λες για την κατάληψη;', 'Σε απασχολεί η κλιματική αλλαγή;', 'Τι θα σπουδάσεις;', 'Ποιος φταίει για όλα;'];
    let qi = 0, cd = 0, pending = 0, si = 0;
    const idle = (p, dt) => p.move(0, 0, dt);
    st.script = idle; cam.script = idle;
    rp.script = (p, dt) => {
      p.move(0, 0, dt); p.dir = 1; cd -= dt;
      const pl = G.player.vehicle || G.player;
      if (pending > 0) { pending -= dt; if (pending <= 0) { const A = WS.STUDENT[si++ % WS.STUDENT.length]; G.audio.say(A[0], A[1], st, 2.6); } }
      if (cd < 0 && G.dist(pl.x, pl.y, p.x, p.y) < 55) { cd = 9; G.audio.say('reporter_q' + (qi % Q.length), Q[qi % Q.length], rp, 2.6); qi++; pending = 2.8; }
    };
    S.peds.push(st, rp, cam);
  };

  WS.refreshMarkers = function () {
    const steps = WS.availSteps(); WS.lastStep = steps.map(s => s.id).join(',');
    const COLS = ['#ffd400', '#3ee0ff', '#ff5fa2', '#9dff5a'];
    WS.markers = steps.map((step, i) => { const tg = WS.stepTarget(step), at = tg.at; return { tx: at[0] + 0.5, ty: at[1] + 0.5, col: COLS[i % 4], step, main: true, via: tg.via, place: tg.via ? tg.viaText : step.place }; });
    // quests you find by yourself (e.g. you went to Milos on your own): startable when you're near them
    const pp = G.player && (G.player.vehicle || G.player);
    if (pp) for (const s of G.STORY) {
      if (s.id === 'finale' || steps.includes(s) || (G.state.done[s.id] && !G.state.done.finale)) continue; // after the ending every quest can be replayed on the spot
      const at = s.at(); if (!at || Math.hypot(at[0] - pp.x / TS, at[1] - pp.y / TS) > 28) continue;
      WS.markers.push({ tx: at[0] + 0.5, ty: at[1] + 0.5, col: '#ffffff', step: s, main: false, found: true, place: s.place });
    }
    const ch = WS.markers.filter(m => !m.step.open);
    const gf = WS.markers.find(m => m.main && m.step.id === G.state.gpsFocus);
    WS.objective = G.state.done.finale && !WS.markers.some(m => m.main) ? 'Free roaming · οι αποστολές ξαναπαίζονται εκεί που ήταν' : gf ? 'Πήγαινε: ' + gf.place : ch.length > 1 ? 'Διάλεξε: ' + ch.map(m => (G.quests[m.step.id] || {}).title || m.place).join(' ή ') : 'Πήγαινε: ' + (WS.markers[0] ? WS.markers[0].place : '');
    // permanent places (small pink icons on the minimap only)
    WS.places = [
      { tx: Wd.front('firstdates')[0] + 0.5, ty: Wd.front('firstdates')[1] + 0.5, col: '#ff3e8a', kind: 'fd', label: 'First Dates' },
    ];
  };

  // where the marker goes: the quest itself, or first the station / port that takes you there
  WS.stepTarget = function (step) {
    const at = step.at(), pp = G.player && (G.player.vehicle || G.player);
    if (!step.via || !pp || !at) return { at };
    const me = Wd.area(Math.floor(pp.x / TS), Math.floor(pp.y / TS)), them = Wd.area(at[0], at[1]);
    if (step.via === 'train' && (me === 'town' || me === 'port')) return { at: Wd.front('station'), via: 'train', viaText: 'τον Σταθμό ΟΣΕ (τρένο για Σέρρες)' };
    if (step.via === 'heli' && me !== them) {
      if (me === 'milos') return { at: [Wd.HELIPADS.milos[0], Wd.HELIPADS.milos[1] + 1], via: 'heli', viaText: 'το ελικόπτερο (πίσω στην Αθήνα)' };
      if (me === 'crete') return { at: Wd.DOCKS.crete, via: 'boat', viaText: 'την προβλήτα (πίσω στην Αθήνα)' };
      return { at: Wd.HELIPADS.town, via: 'heli', viaText: 'το ελικοδρόμιο στο πάρκο (ελικόπτερο για Μήλο)' };
    }
    if (step.via === 'boat' && me !== them) {
      if (me === 'milos') return { at: [Wd.HELIPADS.milos[0], Wd.HELIPADS.milos[1] + 1], via: 'heli', viaText: 'το ελικόπτερο (πίσω στην Αθήνα)' };
      if (me === 'milos' || me === 'crete') return { at: Wd.DOCKS[me], via: 'boat', viaText: 'την προβλήτα (πίσω στην Αθήνα)' };
      return { at: Wd.DOCKS.port, via: 'boat', viaText: 'το λιμάνι (' + (them === 'crete' ? 'πλοίο για Κρήτη' : 'βάρκα για Μήλο') + ')' };
    }
    return { at };
  };
  WS.placePlayer = function (px, py) {
    const pl = G.player; if (pl.vehicle) WS.exitVehicle();
    pl.x = px; pl.y = py; pl.vx = pl.vy = 0;
    WS.camX = G.clamp(px - G.W / 2, 0, Wd.w * TS - G.W); WS.camY = G.clamp(py - G.H / 2, 0, Wd.h * TS - G.H);
  };

  // ---------- trains and boats: you really travel across the map ----------
  const TRAIN = [[20, 18.5], [2.5, 18.5], [2.5, 2.5], [139, 2.5]];
  const BOAT_MILOS = [[59, 89.5], [95, 112], [150, 128], [171.5, 137.5]];
  const BOAT_CRETE = [[59, 89.5], [72, 140], [125, 200], [128, 290], [112, 330], [104, 348], [60, 352], [30, 340], [30.5, 331.5]];
  const HELI = [[34.5, 62.5], [70, 90], [130, 130], [171.5, 151.5]];
  const rev = a => a.slice().reverse();
  WS.ROUTES = {
    serres: () => ({ kind: 'train', path: TRAIN, speed: 170, to: 'ΣΕΡΡΕΣ', sub: 'ΟΣΕ: καλό ταξίδι (με καθυστέρηση)', end: Wd.SERRES_STATION }),
    athens_train: () => ({ kind: 'train', path: rev(TRAIN), speed: 170, to: 'ΑΘΗΝΑ', sub: 'Τρένο για Αθήνα', end: Wd.front('station') }),
    milos: () => { const m = Wd.HELIPADS.milos; return { kind: 'heli', path: [...HELI.slice(0, -1), [m[0] + 0.5, m[1] + 0.5]], speed: 190, to: 'ΜΗΛΟΣ', sub: 'Ελικόπτερο για Μήλο (VIP, με σαμπάνια)', end: [m[0], m[1] + 1] }; },
    athens_heli: () => ({ kind: 'heli', path: rev([...HELI.slice(0, -1), [Wd.HELIPADS.milos[0] + 0.5, Wd.HELIPADS.milos[1] + 0.5]]), speed: 190, to: 'ΑΘΗΝΑ', sub: 'Ελικόπτερο για Αθήνα', end: [34, 65] }),
    crete: () => ({ kind: 'ship', path: BOAT_CRETE, speed: 100, to: 'ΚΡΗΤΗ', sub: 'Πλοίο για Κρήτη: καμπίνα με τέσσερις άγνωστους', end: Wd.DOCKS.crete }),
    athens_milos: () => ({ kind: 'boat', path: rev(BOAT_MILOS), speed: 95, to: 'ΑΘΗΝΑ', sub: 'Βάρκα για Αθήνα', end: Wd.DOCKS.port }),
    athens_crete_n: () => { const d = Wd.DOCKS.crete_north, sea = Wd.CRETE_NORTH_SEA; return { kind: 'ship', path: [[d[0] + 0.5, d[1] - 1], [sea[0] + 0.5, sea[1] + 0.5], [59.5, 96], [59, 89.5]], speed: 110, to: 'ΑΘΗΝΑ', sub: 'Πλοίο για Πειραιά (από το βόρειο λιμανάκι)', end: Wd.DOCKS.port }; },
    athens_crete: () => ({ kind: 'ship', path: rev(BOAT_CRETE), speed: 100, to: 'ΑΘΗΝΑ', sub: 'Πλοίο για Πειραιά', end: Wd.DOCKS.port }),
  };
  // people around the landing spot run away screaming (the joke: there is no helipad on Milos)
  WS.panicLanding = function (lx, ly) {
    const LOOKS = [
      { skin: '#f6c8b0', hair: '#f2dc8a', hairStyle: 'long', female: true, top: '#ff6f9c', topStyle: 'tank', legs: '#ff6f9c', skirt: true, shoes: '#f4f4f4', acc: ['shades'] },
      { skin: '#f4b8a0', hair: '#c8a060', hairStyle: 'short', top: '#ffffff', topStyle: 'tshirt', legs: '#3a9ad8', shoes: '#f4f4f4', acc: ['cap:#e84a3a'] },
      { skin: '#e8b48a', hair: '#141210', hairStyle: 'bun', female: true, top: '#ffd400', topStyle: 'tank', legs: '#ffd400', skirt: true, shoes: '#333', acc: ['shades'] },
      { skin: '#f6d3b8', hair: '#8a5a2a', hairStyle: 'slick', top: '#3ab07a', topStyle: 'shirt', top2: '#fff', legs: '#e8e0d0', shoes: '#8a5a2a', acc: [] },
      { skin: '#f0c8a8', hair: '#d8d8d8', hairStyle: 'balding', top: '#ff9f40', topStyle: 'shirt', top2: '#fff', legs: '#2d3446', shoes: '#333', acc: ['thinglasses'] },
      { skin: '#c98c62', hair: '#2b1d14', hairStyle: 'ponytail', female: true, top: '#7b5cff', topStyle: 'tshirt', legs: '#7b5cff', skirt: true, shoes: '#f4f4f4', acc: [] },
    ];
    const SCREAMS = ['Aaaaah!', 'Help!', 'Τρέχααα!', 'Oh my god!', 'Mamma mia!', 'Βοήθειααα!'];
    LOOKS.forEach((look, i) => {
      const a = (i / LOOKS.length) * Math.PI * 2 + 0.3, r = 22 + (i % 3) * 8;
      const p = new G.Ent.Person(look, lx + Math.cos(a) * r, ly + Math.sin(a) * r * 0.7);
      p.invuln = true; p.t = 0; p.fa = a;
      p.script = (q, dt) => {
        q.t += dt;
        if (q.t < 0.5) { q.move(0, 0, dt); return; }
        if (!q.yelled && q.t > 0.5 + i * 0.15) { q.yelled = true; G.audio.say('tourist_panic', SCREAMS[i % SCREAMS.length], q, 1.8); }
        const sp = 70; if (!q.move(Math.cos(q.fa) * sp, Math.sin(q.fa) * sp, dt)) q.fa += 0.9;
        const ws = WS, off = q.x < ws.camX - 30 || q.x > ws.camX + G.W + 30 || q.y < ws.camY - 30 || q.y > ws.camY + G.H + 30;
        if (off && q.t > 2) q.dead = true;
      };
      S.peds.push(p);
    });
    U.shake(3);
  };
  WS.transit = function () {
    return [
      { at: Wd.front('station'), title: 'ΣΤΑΘΜΟΣ ΟΣΕ', hint: 'Τρένο', go: [['Τρένο για Σέρρες', 'serres']] },
      { at: Wd.SERRES_STATION, title: 'ΣΤΑΘΜΟΣ ΣΕΡΡΩΝ', hint: 'Τρένο', go: [['Τρένο για Αθήνα', 'athens_train']] },
      { at: Wd.DOCKS.port, title: 'ΛΙΜΑΝΙ', hint: 'Πλοίο', go: [['Πλοίο για Κρήτη', 'crete']] },
      { at: Wd.HELIPADS.town, title: 'ΕΛΙΚΟΔΡΟΜΙΟ', hint: 'Ελικόπτερο', go: [['Ελικόπτερο για Μήλο', 'milos']] },
      { at: [Wd.HELIPADS.milos[0], Wd.HELIPADS.milos[1] + 1], title: 'ΜΗΛΟΣ · ΕΛΙΚΟΠΤΕΡΟ', hint: 'Ελικόπτερο', go: [['Ελικόπτερο για Αθήνα', 'athens_heli']] },
      { at: Wd.DOCKS.crete, title: 'ΚΡΗΤΗ · ΛΙΜΑΝΙ', hint: 'Πλοίο', go: [['Πλοίο για Αθήνα', 'athens_crete']] },
      ...(Wd.DOCKS.crete_north ? [{ at: Wd.DOCKS.crete_north, title: 'ΚΡΗΤΗ · ΒΟΡΕΙΟ ΛΙΜΑΝΑΚΙ', hint: 'Πλοίο', go: [['Πλοίο για Αθήνα', 'athens_crete_n']] }] : []),
    ];
  };
  WS.openTransit = function (t) {
    if (G.state.wanted > 0) { U.toast('Δεν σε αφήνουν να επιβιβαστείς με την αστυνομία στο κατόπι σου.'); return; }
    U.dialog(t.title, 'Πού πάμε;', [...t.go.map(([label, id]) => ({ label, cb: () => G.ride(WS.ROUTES[id]()) })), { label: 'Πουθενά', cb: () => {} }]);
  };
  G.ride = function (o) {
    const pts = o.path.map(p => [p[0] * TS, p[1] * TS]), lens = []; let L = 0;
    for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); lens.push(l); L += l; }
    const posAt = s => {
      s = G.clamp(s, 0, L);
      for (let i = 0; i < lens.length; i++) { if (s <= lens[i] || i === lens.length - 1) { const t = lens[i] ? Math.min(1, s / lens[i]) : 0, a = pts[i], b = pts[i + 1]; return { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, a: Math.atan2(b[1] - a[1], b[0] - a[0]) }; } s -= lens[i]; }
      return { x: pts[0][0], y: pts[0][1], a: 0 };
    };
    const wake = [];
    if (G.player.vehicle) WS.exitVehicle();
    G.push({
      enter() { this.s = 0; this.t = 0; this.ang = posAt(0).a; WS.riding = true; G.audio.radio(false); G.audio.sfx(o.kind === 'train' ? 'train_horn' : o.kind === 'heli' ? 'heli' : 'boat_horn'); },
      update(dt) {
        this.t += dt;
        U.setMobile([{ id: 'ok', label: '⏩' }], 'none');
        const fast = G.held('ok') || G.held('enter') || G.held('action');
        const ease = Math.min(1, 0.25 + this.s / 160) * Math.min(1, 0.2 + (L - this.s) / 180);
        this.s += o.speed * (fast ? 3 : 1) * ease * dt;
        const p = posAt(this.s); let da = p.a - this.ang; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI; this.ang += da * Math.min(1, dt * 3);
        this.p = p; G.player.x = p.x; G.player.y = p.y;
        const zn = Wd.zoneName(Math.floor(p.x / TS), Math.floor(p.y / TS)); if (zn !== WS.zoneLabel) { WS.zoneLabel = zn; WS.zoneShow = 2.5; } WS.zoneShow -= dt;
        if (o.kind !== 'train' && o.kind !== 'heli' && Math.floor(this.t * 12) !== this.wk) { this.wk = Math.floor(this.t * 12); wake.push({ x: p.x - Math.cos(this.ang) * 18, y: p.y - Math.sin(this.ang) * 18, t: 0 }); }
        for (const w of wake) w.t += dt; while (wake.length && wake[0].t > 2.2) wake.shift();
        WS.camX += (p.x + Math.cos(this.ang) * 40 - G.W / 2 - WS.camX) * Math.min(1, dt * 3); WS.camY += (p.y + Math.sin(this.ang) * 30 - G.H / 2 - WS.camY) * Math.min(1, dt * 3);
        WS.camX = G.clamp(WS.camX, 0, Wd.w * TS - G.W); WS.camY = G.clamp(WS.camY, 0, Wd.h * TS - G.H);
        S.update(dt);
        if (this.s >= L) {
          G.pop(); WS.riding = false;
          const e = o.end; WS.placePlayer(e[0] * TS + 8, e[1] * TS + 10); G.player.dir = 0;
          U.toast('Καλώς ήρθες: ' + o.to, 2.5); G.audio.sfx('door'); WS.refreshMarkers();
          if (o.kind === 'heli' && o.to === 'ΜΗΛΟΣ') WS.panicLanding(e[0] * TS + 8, e[1] * TS + 10);
        }
      },
      render(ctx) {
        WS.render(ctx, true);
        const camX = Math.round(WS.camX), camY = Math.round(WS.camY), p = this.p || posAt(0);
        if (o.kind === 'train') {
          for (let k = 0; k < 4; k++) { const q = posAt(this.s - k * 46); G.drawRideCar(ctx, 'train', q.x - camX, q.y - camY, q.a, k === 0); }
        } else {
          for (const w of wake) { const a = 1 - w.t / 2.2; ctx.fillStyle = 'rgba(255,255,255,' + (0.5 * a).toFixed(3) + ')'; ctx.beginPath(); ctx.ellipse(w.x - camX, w.y - camY, 3 + w.t * 7, 2 + w.t * 4, this.ang, 0, 7); ctx.fill(); }
          G.drawRideCar(ctx, o.kind, p.x - camX, p.y - camY, this.ang + Math.sin(this.t * 2) * 0.02, true);
        }
        U.begin();
        U.title(G.W / 2, 22, '→ ' + o.to, 16, '#fff');
        U.text(G.W / 2, 36, o.sub, 8, '#ffd400', 'center');
        const f = G.clamp(this.s / L, 0, 1), bw = 140, bx = G.W / 2 - bw / 2, by = G.H - 26;
        U.rr(bx, by, bw, 7, 3.5, 'rgba(16,13,28,0.85)', U.T.line); U.rr(bx + 1.5, by + 1.5, Math.max(4, (bw - 3) * f), 4, 2, U.T.gold);
        U.text(G.W / 2, G.H - 8, G.device === 'mobile' ? 'Κράτα ⏩ για γρηγορότερα' : 'Κράτα ENTER για γρηγορότερα', 7.5, '#fff', 'center');
        U.drawOverlays(); U.drawMobile();
      },
    });
  };
  G.drawSailboat = function (ctx, x, y, a, i) {
    const INK = 'rgba(28,20,36,0.85)';
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(-Math.cos(a) * 12, -Math.sin(a) * 12, 8, 3, a, 0, 7); ctx.fill();
    ctx.rotate(a);
    ctx.fillStyle = 'rgba(20,10,30,0.25)'; ctx.beginPath(); ctx.ellipse(3, 4, 11, 4.5, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(12, 0); ctx.quadraticCurveTo(6, -5, -9, -4); ctx.lineTo(-9, 4); ctx.quadraticCurveTo(6, 5, 12, 0); ctx.fillStyle = '#f6f4ee'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.7; ctx.stroke();
    ctx.fillStyle = '#b07a48'; ctx.fillRect(-6, -2.2, 9, 4.4);
    ctx.rotate(-0.5 + Math.sin(G.t + i) * 0.08);
    const g = ctx.createLinearGradient(0, -2, 0, 12); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#d8dbe2');
    ctx.beginPath(); ctx.moveTo(1, 0); ctx.quadraticCurveTo(6, 6, 1, 13); ctx.lineTo(0, 0); ctx.fillStyle = g; ctx.fill(); ctx.stroke();
    ctx.restore();
  };
  G.drawChapel = function (ctx, x, y) { // white chapel with a blue dome
    const INK = 'rgba(28,20,36,0.85)';
    ctx.fillStyle = 'rgba(20,10,30,0.28)'; ctx.beginPath(); ctx.ellipse(x + 4, y + 9, 13, 5, 0, 0, 7); ctx.fill();
    ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x - 10, y - 6, 20, 14, 2); else ctx.rect(x - 10, y - 6, 20, 14); ctx.fillStyle = '#f7f5ef'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.7; ctx.stroke();
    const g = ctx.createRadialGradient(x - 2, y - 8, 1, x, y - 5, 7); g.addColorStop(0, '#6aa8ff'); g.addColorStop(1, '#1f4fb0');
    ctx.beginPath(); ctx.arc(x, y - 5, 6, Math.PI, 0); ctx.closePath(); ctx.fillStyle = g; ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#7a5a3a'; ctx.fillRect(x - 2, y + 2, 4, 6);
    ctx.strokeStyle = '#333'; ctx.beginPath(); ctx.moveTo(x, y - 11); ctx.lineTo(x, y - 15); ctx.moveTo(x - 1.5, y - 13.5); ctx.lineTo(x + 1.5, y - 13.5); ctx.stroke();
  };
  // HD train carriage / boat / ship (top-down, light from the top-left)
  G.drawRideCar = function (ctx, kind, x, y, a, front, parked) {
    if (kind === 'heli') { // top-down helicopter: shadow far below, spinning rotor
      const INK = 'rgba(28,20,36,0.85)';
      ctx.save(); ctx.translate(x + (parked ? 2 : 14), y + (parked ? 4 : 22)); ctx.rotate(a); ctx.fillStyle = 'rgba(20,10,30,0.25)';
      ctx.beginPath(); ctx.ellipse(0, 0, 14, 7, 0, 0, 7); ctx.fill(); ctx.fillRect(-28, -1.5, 16, 3); ctx.restore();
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      ctx.fillStyle = '#1d1d24'; ctx.fillRect(-30, -1.6, 18, 3.2); ctx.fillRect(-32, -5, 3, 10);
      const g = ctx.createLinearGradient(0, -8, 0, 8); g.addColorStop(0, '#ff8fb8'); g.addColorStop(0.5, '#e8467c'); g.addColorStop(1, '#a8285a');
      ctx.beginPath(); ctx.ellipse(0, 0, 15, 8, 0, 0, 7); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.8; ctx.stroke();
      const gw = ctx.createLinearGradient(6, -5, 14, 5); gw.addColorStop(0, '#d8f4ff'); gw.addColorStop(1, '#4a8ab8');
      ctx.beginPath(); ctx.ellipse(8, 0, 6, 5.5, 0, -1.4, 1.4); ctx.fillStyle = gw; ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#2a2a30'; ctx.fillRect(-9, -10, 16, 1.6); ctx.fillRect(-9, 8.4, 16, 1.6);
      ctx.rotate(parked ? 0.4 : G.t * 28); ctx.strokeStyle = 'rgba(30,30,40,0.55)'; ctx.lineWidth = 2;
      for (let k = 0; k < 4; k++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(24, 0); ctx.stroke(); }
      ctx.fillStyle = 'rgba(200,210,230,0.12)'; ctx.beginPath(); ctx.arc(0, 0, 24, 0, 7); ctx.fill();
      ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(0, 0, 2.2, 0, 7); ctx.fill();
      ctx.restore(); return;
    }
    const INK = 'rgba(28,20,36,0.85)';
    const R = (px, py, w, h, r, f, st) => { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(px, py, w, h, r); else ctx.rect(px, py, w, h); ctx.fillStyle = f; ctx.fill(); if (st) { ctx.strokeStyle = st; ctx.lineWidth = 0.7; ctx.stroke(); } };
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(20,10,30,0.3)'; ctx.save(); ctx.translate(3, 4); ctx.rotate(a);
    if (kind === 'train') R(-21, -8, 42, 16, 4, 'rgba(20,10,30,0.3)'); else { ctx.beginPath(); ctx.ellipse(0, 0, kind === 'ship' ? 34 : 18, kind === 'ship' ? 12 : 8, 0, 0, 7); ctx.fill(); }
    ctx.restore(); ctx.rotate(a);
    if (kind === 'train') {
      const g = ctx.createLinearGradient(0, -8, 0, 8); g.addColorStop(0, '#ffffff'); g.addColorStop(0.6, '#dfe3ea'); g.addColorStop(1, '#a9b0bc');
      R(-21, -7.5, 42, 15, front ? 6 : 3, g, INK);
      R(-21, 3, 42, 2.2, 1, '#2d6bff');
      for (let i = -16; i < 18; i += 8) R(i, -5, 5, 3, 1, 'rgba(90,120,170,0.8)');
      R(-17, -1.2, 34, 2.4, 1.2, 'rgba(0,0,0,0.12)');
      if (front) { R(15, -6, 5, 12, 3, '#ffd400', INK); }
    } else if (kind === 'boat') { // καΐκι
      const g = ctx.createLinearGradient(0, -8, 0, 8); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#c9ced8');
      ctx.beginPath(); ctx.moveTo(19, 0); ctx.quadraticCurveTo(10, -8, -14, -7); ctx.quadraticCurveTo(-17, 0, -14, 7); ctx.quadraticCurveTo(10, 8, 19, 0); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.8; ctx.stroke();
      ctx.strokeStyle = '#2d6bff'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(16, -2.5); ctx.quadraticCurveTo(8, -6.5, -13, -5.8); ctx.moveTo(16, 2.5); ctx.quadraticCurveTo(8, 6.5, -13, 5.8); ctx.stroke();
      R(-9, -4, 10, 8, 2, '#a86a3a', INK); R(-8, -3, 8, 2.5, 1, 'rgba(255,255,255,0.25)');
      R(-15, -1, 3, 2, 1, '#333');
    } else { // ship
      const g = ctx.createLinearGradient(0, -12, 0, 12); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#c4cad4');
      ctx.beginPath(); ctx.moveTo(36, 0); ctx.quadraticCurveTo(26, -12, -30, -11); ctx.lineTo(-32, 11); ctx.quadraticCurveTo(26, 12, 36, 0); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.9; ctx.stroke();
      ctx.strokeStyle = '#1f3f9a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(32, -3); ctx.quadraticCurveTo(22, -10.5, -30, -9.5); ctx.moveTo(32, 3); ctx.quadraticCurveTo(22, 10.5, -30, 9.5); ctx.stroke();
      R(-22, -7, 30, 14, 3, '#f4f4f4', INK); R(-20, -5, 26, 3, 1, 'rgba(90,120,170,0.6)'); R(-20, 2, 26, 3, 1, 'rgba(90,120,170,0.6)');
      R(-12, -3, 8, 6, 2, '#1f3f9a', INK); R(-11, -2.5, 3, 5, 1, '#ffd400');
    }
    ctx.restore();
  };

  // ---------- damage / death / bust ----------
  WS.damage = function (n) { if (WS.dead) return; G.state.health = Math.max(0, G.state.health - n); U.shake(2); if (G.state.health <= 0) WS.die(); };
  WS.die = function () { WS.dead = true; G.state.wanted = 0; G.push(G.ReviveScene(Math.round(50 + Math.abs(G.state.money) * 0.08))); };
  WS.bust = function () {
    if (WS.busted) return; WS.busted = true;
    const fine = 60 * Math.max(1, G.state.wanted);
    const exitCar = () => { if (G.player.vehicle) WS.exitVehicle(); };
    U.dialog('ΣΥΛΛΗΨΗ!', 'Σε έπιασαν. Τι κάνουμε;', [
      { label: `Πληρώνω να βγω (${G.fmtMoney(fine)})`, cb: () => { exitCar(); G.addMoney(-fine, 'ΠΡΟΣΤΙΜΟ'); WS.afterBust(); } },
      { label: 'Πάω Κορυδαλλό (λίγα δευτερόλεπτα)', cb: () => { exitCar(); G.push(G.JailScene()); } },
    ]);
  };
  WS.afterBust = function () { G.state.wanted = 0; S.cops.forEach(c => c.dead = true); S.vehicles.forEach(v => { if (v.chase) v.dead = true; }); WS.busted = false; G.save(); };

  // ---------- update ----------
  WS.update = function (dt) {
    const pl = G.player, st = G.state;
    st.playTime += dt; WS.hint = null;
    if (WS.phoneMsg) { WS.phoneMsg.t -= dt; if (WS.phoneMsg.t <= 0) WS.phoneMsg = null; }
    WS.tickPhone(dt);
    const top = [{ id: 'phone', label: '📱', pos: [G.W - 124, 22], r: 12 }, { id: 'map', label: 'MAP', pos: [G.W - 152, 22], r: 12 }, { id: 'pause', label: '❚❚', pos: [G.W - 180, 22], r: 12 }];
    const btns = pl.vehicle ? [{ id: 'enter', label: 'ΒΓΕΣ' }, { id: 'radio', label: '📻' }, ...top]
      : [{ id: 'enter', label: 'ΜΠΕΣ' }, { id: 'action', label: 'ΧΤΥΠΑ' }, ...top];
    if (U.hasDialog()) { U.setMobile([{ id: 'ok', label: 'OK' }, { id: 'down', label: '▼' }, { id: 'up', label: '▲' }], 'none'); return; }
    U.setMobile(btns, 'stick');
    if (G.pressed('pause') && !G.pressed('back')) { G.push(G.PauseScene); return; }
    if (G.pressed('map')) { G.push(G.MapScene); return; }
    if (G.pressed('phone')) { WS.phoneMsg = null; G.push(G.PhoneScene(G.unreadSms() ? 'sms' : 'home')); return; }

    if (pl.vehicle) WS.updateDriving(dt); else WS.updateOnFoot(dt);
    S.update(dt);
    WS.sound(dt);
    mods(m => m.update && m.update(dt));
    WS.drops = (WS.drops || []).filter(d => {
      d.t += dt; if (d.t > 25) return false;
      if (!pl.vehicle && d.t > 0.4 && G.dist(d.x, d.y, pl.x, pl.y) < 13) { G.addMoney(d.v, 'ΠΟΡΤΟΦΟΛΙ'); G.audio.sfx('coin'); return false; }
      return true;
    });
    if (st.health < 100 && st.wanted === 0) st.health = Math.min(100, st.health + dt * 0.4);

    const pp = pl.vehicle || pl; const tx = Math.floor(pp.x / TS), ty = Math.floor(pp.y / TS);
    const zn = Wd.zoneName(tx, ty); if (zn !== WS.zoneLabel) { WS.zoneLabel = zn; WS.zoneShow = 2.5; } WS.zoneShow -= dt;

    // camera
    const lx = pl.vehicle ? pl.vehicle.vx * 0.3 : 0, ly = pl.vehicle ? pl.vehicle.vy * 0.3 : 0;
    WS.camX += (pp.x + lx - G.W / 2 - WS.camX) * Math.min(1, dt * 5); WS.camY += (pp.y + ly - G.H / 2 - WS.camY) * Math.min(1, dt * 5);
    WS.camX = G.clamp(WS.camX, 0, Wd.w * TS - G.W); WS.camY = G.clamp(WS.camY, 0, Wd.h * TS - G.H);

    // main quest marker
    WS.mkT = (WS.mkT || 0) - dt; if (WS.mkT <= 0) { WS.mkT = 0.5; WS.refreshMarkers(); }
    if (!pl.vehicle) for (const tr of WS.transit()) if (tr.at && Math.hypot(tr.at[0] + 0.5 - pl.x / TS, tr.at[1] + 0.5 - pl.y / TS) < 1.7) {
      WS.hint = tr.hint + ': ' + tr.go.map(g => g[0].split(' για ')[1]).join(' / ');
      if (G.pressed('enter')) { WS.openTransit(tr); return; }
    }
    const m = WS.markers.find(k => !k.via && Math.hypot(k.tx - pp.x / TS, k.ty - pp.y / TS) < 1.8);
    if (m) {
      const q = G.quests[m.step.id];
      WS.hint = m.step.id === 'finale' ? 'Πλήρωσε το χρέος' : 'Ξεκίνα: ' + (q ? q.title : 'αποστολή');
      if (G.pressed('enter')) { if (pl.vehicle) WS.exitVehicle(); WS.startStep(m.step); return; }
    }
    if (!pl.vehicle) {
      for (const p of WS.places) if (Math.hypot(p.tx - pl.x / TS, p.ty - pl.y / TS) < 1.6) {
        WS.hint = 'Μπες στο First Dates';
        if (G.pressed('enter')) { G.push(G.FirstDatesScene()); return; }
      }
      let modAct = null; mods(m => { const r = !modAct && m.interact && m.interact(pl); if (r) { WS.hint = r.hint; modAct = r; } });
      if (modAct && G.pressed('enter')) { modAct.act(); return; }
      for (const [kx, ky] of Wd.kiosks) if (Math.hypot(kx + 0.5 - pl.x / TS, ky + 1.2 - pl.y / TS) < 1.5) { WS.hint = 'Περίπτερο'; if (G.pressed('enter')) { WS.kiosk(); return; } }
    }
    if (G.pressed('radio') && pl.vehicle) { st.radioOn = !st.radioOn; G.audio.radio(st.radioOn); U.toast(st.radioOn ? '📻 Ραδιόφωνο ON' : '📻 Ραδιόφωνο OFF', 1.2); }
  };

  WS.startStep = function (step) {
    G.audio.radio(false); WS.afterBust();
    if (step.id === 'finale') { WS.finale(); return; }
    const q = G.quests[step.id]; if (!q) return;
    if (G.state.done[step.id]) G.replayQuest(step.id); else q.start(); // finished ones are replays
  };
  WS.eat = function () {
    if (G.state.health >= 100) { U.toast('Δεν πεινάς. Ο σουβλατζής προσβλήθηκε.'); return; }
    G.addMoney(-4, 'ΣΟΥΒΛΑΚΙ'); G.state.health = 100; G.audio.sfx('coin'); U.toast('Πίτα γύρος απ\' όλα. Ζωή 100.');
  };
  WS.kiosk = function () {
    const st = G.state;
    U.dialog('ΠΕΡΙΠΤΕΡΟ', 'Ο περιπτεράς σε κοιτάει με βαρεμάρα. Τι θες;', [
      { label: 'Νερό (+35 ζωή) €1', cb: () => { G.addMoney(-1, 'ΝΕΡΟ'); st.health = Math.min(100, st.health + 35); G.audio.sfx('coin'); } },
      { label: 'Αναψυκτικό (+70 ζωή) €2', cb: () => { G.addMoney(-2, 'ΑΝΑΨΥΚΤΙΚΟ'); st.health = Math.min(100, st.health + 70); G.audio.sfx('coin'); U.toast('Ζάχαρη. Πολλή ζάχαρη. Ζωή +70.'); } },
      { label: 'Ξυστό €2', cb: () => { G.addMoney(-2, 'ΞΥΣΤΟ'); if (G.chance(0.15)) { const w = G.pick([5, 10, 50]); G.addMoney(w, 'ΚΕΡΔΟΣ'); U.toast('Κέρδισες ' + G.fmtMoney(w) + '! Ο περιπτεράς δεν το πιστεύει.'); } else U.toast(G.pick(['Τίποτα. Όπως πάντα.', 'Σχεδόν! (όχι)'])); } },
      { label: 'Τίποτα', cb: () => {} },
    ]);
  };
  WS.finale = function () {
    const st = G.state;
    U.dialog('ΕΦΟΡΙΑ · ΑΑΔΕ', `Χρωστάς ${G.fmtMoney(G.DEBT)}. Έχεις ${G.fmtMoney(st.money)}.`, st.money >= G.DEBT ? [
      { label: 'Πληρώνω όλο το χρέος', cb: () => { G.addMoney(-G.DEBT, 'ΧΡΕΟΣ'); st.done.finale = true; G.save(); G.push(G.EndingScene()); } },
      { label: 'Όχι ακόμα', cb: () => {} },
    ] : [{ label: `Λείπουν ${G.fmtMoney(G.DEBT - st.money)}. Κάνε κι άλλες δουλειές (ξαναπαίξε αποστολές από τον χάρτη)`, cb: () => {} }]);
  };

  // ---------- on foot ----------
  WS.updateOnFoot = function (dt) {
    const pl = G.player;
    if (pl.updatePhysics(dt)) return;
    const ax = G.readAxis(); let mx = ax.x, my = ax.y; const m = Math.hypot(mx, my); if (m > 1) { mx /= m; my /= m; }
    pl.move(mx * pl.speed, my * pl.speed, dt);
    let best = null, bd = 1e9;
    for (const v of S.vehicles) { if (v.dias || v.chase || v.type === 'bus' || v.wrecked) continue; const d = G.dist(v.x, v.y, pl.x, pl.y - 4); if (d < v.wid / 2 + 14 + (v.len - v.wid) / 3 && d < bd) { bd = d; best = v; } }
    if (!best && S.nearScooter) best = S.nearScooter(pl.x, pl.y - 4);
    if (best && !WS.hint) WS.hint = (best.ai ? 'Κλέψε το ' : best.type === 'scooter' ? 'Ανέβα στο ' : 'Μπες στο ') + vname(best);
    if (best && G.pressed('enter') && !G.bballHolding && !WS.markers.some(k => Math.hypot(k.tx - pl.x / TS, k.ty - pl.y / TS) < 1.8)) { WS.enterVehicle(best); return; }
    pl.punchT -= dt;
    if (G.pressed('action') && pl.punchT <= 0 && !G.bballHolding) {
      pl.punchT = 0.4; const fx = [0, -1, 1, 0][pl.dir], fy = [1, 0, 0, -1][pl.dir];
      const hx = pl.x + fx * 8, hy = pl.y + fy * 6;
      // people queuing at a bus stop are drawn with the shelter: the one you hit steps out as a real pedestrian
      for (const sp of Wd.stops || []) {
        if (Math.abs(sp.tx * TS + 8 - hx) > 40 || Math.abs(sp.ty * TS + 14 - hy) > 40) continue;
        const m = sp.crowd.find(m => !m.gone && G.dist(sp.tx * TS + 8 + m.dx, sp.ty * TS + 14 + m.dy, hx, hy) < 11);
        if (!m) continue;
        const p = new G.Ent.Person(m.look || G.randomLook(), sp.tx * TS + 8 + m.dx, sp.ty * TS + 14 + m.dy);
        p.speed = G.rand(16, 26); if (S.pedWalk) p.walk = S.pedWalk; p.dir = m.dir || 0; S.peds.push(p);
        m.gone = true; m.back = G.t + 40; // someone else takes the spot a bit later
        break;
      }
      for (const p of S.peds) {
        if (p.down > 0 || p.invuln || p.cameo) continue;
        if (G.dist(p.x, p.y, hx, hy) < 11) {
          p.knock(fx, fy, 70); G.audio.sfx('punch');
          if (!p.cop && !p.robbed && !p.fixed) { p.robbed = true; const n = 1 + (G.chance(0.4) ? 1 : 0); for (let k = 0; k < n; k++) WS.drops.push({ x: p.x + G.rand(-8, 8), y: p.y + G.rand(-2, 8), v: Math.round(G.rand(3, 25)), t: 0 }); }
          if (p.cop) S.addWanted(2, 'Έσπρωξες αστυνομικό!'); else S.crime(1, 'Σε είδαν να σπρώχνεις κόσμο!', p.x, p.y);
          G.audio.say('ped_hit', G.pick(['Αστυνομίαααα!', 'Τι κάνεις ρε;', 'Θα σε πάρω βίντεο!']), p, 1.6);
          break;
        }
      }
    }
    for (const v of S.vehicles) {
      if (Math.abs(v.speed) < 45 || v === pl.vehicle) continue;
      if (G.dist(v.x, v.y, pl.x, pl.y - 4) < v.wid / 2 + 5) { pl.knock(Math.cos(v.a), Math.sin(v.a), 90); WS.damage(10); }
    }
  };
  const vname = v => ({ car: 'αμάξι', taxi: 'ταξί', van: 'βαν', moto: 'μηχανάκι', scooter: 'πατίνι', bike: 'ποδήλατο', police: 'περιπολικό', ferrari: 'Ferrari', pickup: 'αγροτικό', garbage: 'σκουπιδιάρικο', bus: 'λεωφορείο', city: 'αμάξι', mini: 'αμαξάκι', smart: 'Smart', sedan: 'αμάξι', suv: 'SUV' })[v.type] || 'όχημα';

  WS.enterVehicle = function (v) {
    if (v.scooterProp) { v = S.takeScooter(v); if (!v) return; }
    const pl = G.player;
    if (v.ai) {
      const drv = new G.Ent.Person(v.rider || G.randomLook(), v.x + 16, v.y + 8); drv.state = 'flee'; drv.timer = 4; S.peds.push(drv);
      G.audio.say('carjack', G.pick(['Το αμάξι μου!', 'Ρε συ, έχω δόσεις!', 'Πάρ\' το, ασφάλεια έχει!']), drv, 2);
      v.ai = false; v.lane = null; v.rider = null; S.crime(1, 'Κλοπή οχήματος', v.x, v.y);
    }
    v.parked = false; v.hazard = false; v.driver = pl; pl.vehicle = v; v.keep = true; v.speed = 0;
    if (v.two) v.rider = G.state.look;
    G.audio.sfx('door'); if (G.state.radioOn && !v.two) G.audio.radio(true);
  };
  WS.exitVehicle = function () {
    const pl = G.player, v = pl.vehicle; if (!v) return;
    v.driver = null; v.speed = 0; v.vx = v.vy = 0; v.parked = true; v.rider = null; pl.vehicle = null;
    const off = v.wid / 2 + 9; const cands = [[Math.cos(v.a + Math.PI / 2) * off, Math.sin(v.a + Math.PI / 2) * off], [-Math.cos(v.a + Math.PI / 2) * off, -Math.sin(v.a + Math.PI / 2) * off], [Math.cos(v.a) * (v.len / 2 + 9), Math.sin(v.a) * (v.len / 2 + 9)], [-Math.cos(v.a) * (v.len / 2 + 9), -Math.sin(v.a) * (v.len / 2 + 9)]];
    const ok = cands.map(([dx, dy]) => [v.x + dx, v.y + dy + 6]).find(([x, y]) => !pl.blocked(x, y)) || [v.x, v.y + 20];
    pl.x = ok[0]; pl.y = ok[1]; G.audio.sfx('door'); G.audio.radio(false);
  };

  // ---------- driving: the car goes where the arrows point ----------
  // world sound: every vehicle near you sounds from where it is (engines, police sirens), a quiet city bed,
  // and now and then a stray dog barking somewhere off-screen
  WS.sound = function (dt) {
    const pl = G.player, me = pl.vehicle || pl, A = G.audio;
    A.engines(me.x, me.y, S.vehicles, pl.vehicle);
    // city bed, layered so Athens sounds full: real Athens crossroad traffic + scooters/horns/voices,
    // and people walking/talking that swells with the crowd around you. Quieter inside a car, gone outside town.
    const town = Wd.area(Math.floor(me.x / TS), Math.floor(me.y / TS)) === 'town', car = !!pl.vehicle;
    if (town) {
      let crowd = 0; for (const p of S.peds) if (Math.abs(p.x - me.x) < 220 && Math.abs(p.y - me.y) < 160) crowd++;
      A.loop('amb', 'loop_city', car ? 0.3 : 0.5);
      A.loop('amb2', 'loop_city2', car ? 0.16 : 0.28);
      A.loop('walla', 'loop_walla', (car ? 0.06 : 0.14) + Math.min(0.3, crowd * 0.035) * (car ? 0.4 : 1));
      WS.hornT = (WS.hornT == null ? G.rand(5, 10) : WS.hornT) - dt;
      if (WS.hornT <= 0) { WS.hornT = G.rand(9, 20); A.sfx('horns_far', car ? 0.2 : 0.32, G.rand(-0.8, 0.8)); }
      WS.farSirenT = (WS.farSirenT == null ? G.rand(40, 70) : WS.farSirenT) - dt;
      if (WS.farSirenT <= 0) { WS.farSirenT = G.rand(60, 120); if (!G.state.wanted) A.sfx('siren', 0.12, G.rand(-0.9, 0.9)); }
    }
    WS.dogT = (WS.dogT == null ? G.rand(4, 9) : WS.dogT) - dt;
    if (WS.dogT <= 0) {
      const a = Math.random() * 6.28, r = G.rand(140, 380), n = G.chance(0.4) ? 2 : 1;
      for (let i = 0; i < n; i++) setTimeout(() => A.sfxAt('bark', me.x + Math.cos(a) * r, me.y + Math.sin(a) * r, me.x, me.y, 0.6, 450), i * G.rand(250, 450));
      WS.dogT = G.rand(9, 22);
    }
  };
  WS.updateDriving = function (dt) {
    const pl = G.player, v = pl.vehicle;
    const hit = G.driveDirect(v, dt, G.readAxis(), G.held('action') && G.device === 'pc');
    if (hit && Math.abs(v.speed) > 60) { G.audio.sfx('crash'); U.shake(3); }
    pl.x = v.x; pl.y = v.y;
    // potholes: bump + lose speed (once per hole)
    const ptx = Math.floor(v.x / TS), pty = Math.floor(v.y / TS), key = ptx + ',' + pty;
    if (Wd.isPothole(ptx, pty) && WS.lastHole !== key && Math.abs(v.speed) > 40 && !v.two) {
      WS.lastHole = key; v.speed *= 0.7; U.shake(4); G.audio.sfx('hit', 0.5);
      if (G.chance(0.35)) U.toast(G.pick(['Λακκούβα! Η ανάρτηση έκλαψε.', 'Ωχ, η ζάντα…', 'Το ΕΣΠΑ για την άσφαλτο πού πήγε;']), 2);
    } else if (!Wd.isPothole(ptx, pty)) WS.lastHole = null;
    if (G.pressed('enter') && Math.abs(v.speed) < 60) WS.exitVehicle();
  };

  // ---------- render ----------
  // GTA VI mood: warm sunset light from the top, teal-violet shadows at the bottom, soft vignette
  G.grade = function (ctx) {
    ctx.save(); ctx.setTransform(G.RS, 0, 0, G.RS, 0, 0);
    ctx.globalCompositeOperation = 'soft-light';
    const g = ctx.createLinearGradient(0, 0, G.W * 0.3, G.H);
    g.addColorStop(0, 'rgba(255,120,170,0.55)'); g.addColorStop(0.5, 'rgba(255,190,140,0.25)'); g.addColorStop(1, 'rgba(70,90,220,0.45)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, G.W, G.H);
    ctx.globalCompositeOperation = 'source-over';
    const v = ctx.createRadialGradient(G.W / 2, G.H / 2, Math.min(G.W, G.H) * 0.45, G.W / 2, G.H / 2, Math.max(G.W, G.H) * 0.75);
    v.addColorStop(0, 'rgba(60,20,90,0)'); v.addColorStop(1, 'rgba(60,20,90,0.28)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, G.W, G.H);
    ctx.restore();
  };
  WS.render = function (ctx, noUI) {
    const [shx, shy] = U.shakeOffset();
    const camX = Math.round(WS.camX + shx), camY = Math.round(WS.camY + shy);
    ctx.fillStyle = '#2f7d3a'; ctx.fillRect(0, 0, G.W, G.H);
    Wd.drawGround(ctx, camX, camY);
    // sea life: a few sailboats drifting, a chapel on an islet
    for (let i = 0; i < 5; i++) {
      const bx = [130, 70, 230, 190, 40][i] * TS + Math.sin(G.t * 0.05 + i * 2) * 140, by = [150, 200, 200, 310, 160][i] * TS + Math.cos(G.t * 0.04 + i) * 90;
      const x = bx - camX, y = by - camY; if (x < -40 || y < -40 || x > G.W + 40 || y > G.H + 40) continue;
      const a = Math.atan2(-Math.sin(G.t * 0.04 + i) * 90 * 0.04, Math.cos(G.t * 0.05 + i * 2) * 140 * 0.05);
      G.drawSailboat(ctx, x, y, a, i);
    }
    for (const e of Wd.ISLETS || []) if (e.chapel) { const x = e.cx * TS - camX, y = e.cy * TS - camY; if (x > -40 && y > -40 && x < G.W + 40 && y < G.H + 40) G.drawChapel(ctx, x, y); }
    // quest marker: glowing circle + pillar
    for (const m of WS.markers) {
      const x = m.tx * TS - camX, y = m.ty * TS - camY;
      ctx.globalAlpha = 0.5 + Math.sin(G.t * 5) * 0.2; ctx.fillStyle = m.col; ctx.beginPath(); ctx.ellipse(x, y, 13, 6, 0, 0, 7); ctx.fill();
      ctx.globalAlpha = 0.25; ctx.fillRect(x - 5, y - 60, 10, 60); ctx.globalAlpha = 1;
    }
    for (const p of WS.places) { const x = p.tx * TS - camX, y = p.ty * TS - camY; ctx.globalAlpha = 0.35; ctx.fillStyle = p.col; ctx.beginPath(); ctx.ellipse(x, y, 9, 4, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
    mods(m => m.ground && m.ground(ctx, camX, camY));
    if (!WS.riding) for (const h of [Wd.HELIPADS.town, Wd.HELIPADS.milos]) { const x = (h[0] + 0.5) * TS - camX, y = (h[1] + 0.5) * TS - camY; if (x > -60 && y > -60 && x < G.W + 60 && y < G.H + 60) G.drawRideCar(ctx, 'heli', x, y, -Math.PI / 2, true, true); }
    for (const d of WS.drops || []) {
      const x = d.x - camX, y = d.y - camY - Math.abs(Math.sin(d.t * 4)) * 2; if (x < -20 || y < -20 || x > G.W + 20 || y > G.H + 20) continue;
      if (d.t > 20 && Math.floor(d.t * 8) % 2) continue;
      ctx.fillStyle = 'rgba(20,10,30,0.3)'; ctx.beginPath(); ctx.ellipse(x, d.y - camY + 2, 6, 2, 0, 0, 7); ctx.fill();
      ctx.save(); ctx.translate(x, y); ctx.rotate(-0.2);
      ctx.fillStyle = '#2f9e5a'; ctx.strokeStyle = 'rgba(28,20,36,0.85)'; ctx.lineWidth = 0.6; ctx.fillRect(-6, -3.5, 12, 7); ctx.strokeRect(-6, -3.5, 12, 7);
      ctx.fillStyle = '#9be3b4'; ctx.fillRect(-4, -2, 8, 4); ctx.fillStyle = '#2f9e5a'; ctx.beginPath(); ctx.arc(0, 0, 1.4, 0, 7); ctx.fill(); ctx.restore();
    }
    const list = [];
    Wd.visibleStatics(camX, camY, list);
    mods(m => m.sprites && m.sprites((y, fn) => list.push({ y, draw: fn }), camX, camY));
    const inView = (o, m = 60) => o.x > camX - m && o.x < camX + G.W + m && o.y > camY - m && o.y < camY + G.H + m;
    for (const v of S.vehicles) if (inView(v)) list.push({ y: v.y, draw: c => v.draw(c, camX, camY) });
    for (const p of S.peds) if (inView(p)) list.push({ y: p.y - (p.clip ? 6 : 0), draw: c => p.draw(c, camX, camY) });
    if (!G.player.vehicle && !WS.riding) list.push({ y: G.player.y, draw: c => G.player.draw(c, camX, camY) });
    // quest regions: animated bits (water, flags) and standing things (y-sorted with everything else)
    for (const r of Wd.regions) {
      const ox = r.tx * TS - camX, oy = r.ty * TS - camY;
      if (ox > G.W + 40 || oy > G.H + 60 || ox + r.w * TS < -40 || oy + r.h * TS < -60) continue;
      if (r.live) { try { r.live(ctx, ox, oy); } catch (e) { console.error('region live', r.id, e); } }
      if (r.statics) { try { r.statics((ly, fn) => list.push({ y: r.ty * TS + ly, draw: fn }), ox, oy); } catch (e) { console.error('region statics', r.id, e); } }
    }
    list.sort((a, b) => a.y - b.y);
    for (const o of list) o.draw(ctx);
    if (Math.floor(G.t * 3) % 2) for (const v of S.vehicles) if (v.hazard && inView(v)) { ctx.fillStyle = '#ffb000'; const c = Math.cos(v.a), s = Math.sin(v.a); [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([a, b]) => ctx.fillRect(Math.round(v.x + a * c * 18 - b * s * 9 - camX), Math.round(v.y + a * s * 18 + b * c * 9 - camY), 3, 3)); }
    S.drawFx(ctx, camX, camY);
    G.grade(ctx);
    if (noUI) return;
    U.begin();
    Wd.drawSigns(camX, camY);
    U.drawBubbles(camX, camY);
    // GPS arrow towards the quest when it's off screen
    for (const m of WS.markers) {
      const mx = m.tx * TS - camX, my = m.ty * TS - camY;
      if (mx < 0 || my < 0 || mx > G.W || my > G.H) {
        const cx = G.W / 2, cy = G.H / 2, a = Math.atan2(my - cy, mx - cx);
        const r = Math.min(G.W, G.H) / 2 - 22; const ax = cx + Math.cos(a) * r * (G.W / G.H) * 0.9, ay = cy + Math.sin(a) * r;
        const c = U.ctx; c.save(); c.translate(G.clamp(ax, 20, G.W - 20), G.clamp(ay, 40, G.H - 30)); c.rotate(a);
        c.fillStyle = m.col; c.strokeStyle = '#000'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(12, 0); c.lineTo(-6, -8); c.lineTo(-2, 0); c.lineTo(-6, 8); c.closePath(); c.fill(); c.stroke(); c.restore();
      } else U.text(mx, my - 64, '★', 14, m.col, 'center');
    }
    U.drawHUD(WS);
    if (WS.phoneMsg) WS.drawPhone();
    U.drawOverlays();
    U.drawMobile();
  };
  // new-message notification card (opens the phone with Q / 📱)
  WS.drawPhone = function () {
    const T = U.T, c = U.ctx, w = 170, x = G.W - w - 8, slide = Math.max(0, (WS.phoneMsg.t - 7.7) * 600), y = 66 - slide;
    const lines = U.wrap(WS.phoneMsg.text, w - 20, 7).slice(0, 3);
    const h = 26 + lines.length * 9 + 12;
    U.box(x, y, w, h, T.panel, T.line, T.green);
    U.text(x + 10, y + 12, '✉ Νέο μήνυμα · Άγνωστος αριθμός', 7, T.green, 'left', null);
    lines.forEach((l, i) => U.text(x + 10, y + 25 + i * 9, l + (i === 2 ? '…' : ''), 7, '#fff', 'left', null));
    if (G.device === 'mobile') U.text(x + w - 8, y + h - 6, 'πάτα 📱', 6.5, T.sub, 'right', null);
    else { U.chip(x + w - 60, y + h - 4, 'Q'); U.text(x + w - 46, y + h - 4, 'Κινητό', 7, T.sub, 'left', null); }
  };

  // ---------- intro story ----------
  G.StoryIntro = function () {
    // short intro: you're back in Athens with a suitcase, and the phone starts ringing
    const cards = [
      ['ΑΘΗΝΑ, 2026', 'Γύρισες. Μια βαλίτσα, ένα κινητό, κανένα σχέδιο.'],
      ['ΤΟ ΚΙΝΗΤΟ ΧΤΥΠΑΕΙ', `Η Εφορία θέλει ${G.fmtMoney(G.DEBT)}. Το κινητό σου θα φέρνει δουλειές. Το ★ στον χάρτη δείχνει πού πας.`],
    ];
    const INK = 'rgba(28,20,36,0.9)';
    const rr = (c, x, y, w, h, r) => { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); };
    function sky(c) { // GTA VI sunset: pink -> orange -> violet, sun, skyline and palms
      const g = c.createLinearGradient(0, 0, 0, G.H); g.addColorStop(0, '#2a1450'); g.addColorStop(0.35, '#c2357a'); g.addColorStop(0.62, '#ff8a4c'); g.addColorStop(0.63, '#5a2a6a'); g.addColorStop(1, '#1c0f2c');
      c.fillStyle = g; c.fillRect(0, 0, G.W, G.H);
      const sy = G.H * 0.6, sg = c.createRadialGradient(G.W * 0.5, sy, 4, G.W * 0.5, sy, 60); sg.addColorStop(0, '#fff3b0'); sg.addColorStop(0.4, '#ffd060'); sg.addColorStop(1, 'rgba(255,160,80,0)');
      c.fillStyle = sg; c.beginPath(); c.arc(G.W * 0.5, sy, 60, Math.PI, 0); c.fill();
      c.fillStyle = '#3a1a52'; // hill + skyline
      c.beginPath(); c.moveTo(0, G.H * 0.63); c.quadraticCurveTo(G.W * 0.18, G.H * 0.5, G.W * 0.32, G.H * 0.6); c.lineTo(G.W * 0.32, G.H * 0.63); c.fill();
      for (let k = 0; k < 18; k++) { const bw = 14 + (k * 37) % 22, bh = 10 + (k * 53) % 28, bx = (k * 29) % G.W; c.fillRect(bx, G.H * 0.63 - bh, bw, bh); }
      c.fillStyle = '#2a1240'; c.fillRect(0, G.H * 0.63, G.W, G.H);
      const palm = (px, ph) => { c.strokeStyle = '#1a0a2a'; c.lineWidth = 3; c.beginPath(); c.moveTo(px, G.H * 0.66); c.quadraticCurveTo(px + 6, G.H * 0.66 - ph / 2, px + 3, G.H * 0.66 - ph); c.stroke(); c.fillStyle = '#1a0a2a'; for (let a = 0; a < 7; a++) { const an = -Math.PI + a * (Math.PI / 6) + Math.sin(G.t + a) * 0.05; c.beginPath(); c.ellipse(px + 3 + Math.cos(an) * 10, G.H * 0.66 - ph + Math.sin(an) * 5 + 3, 11, 2.4, an, 0, 7); c.fill(); } };
      palm(G.W * 0.12, 90); palm(G.W * 0.86, 104); palm(G.W * 0.93, 70);
    }
    function suitcase(c, x, y) { // rolling suitcase with travel stickers
      c.fillStyle = 'rgba(10,0,20,0.35)'; c.beginPath(); c.ellipse(x + 2, y + 1, 14, 4, 0, 0, 7); c.fill();
      c.strokeStyle = '#2a2a33'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(x - 5, y - 34); c.lineTo(x - 5, y - 48); c.lineTo(x + 5, y - 48); c.lineTo(x + 5, y - 34); c.stroke();
      const g = c.createLinearGradient(x - 12, 0, x + 12, 0); g.addColorStop(0, '#ff5fa2'); g.addColorStop(1, '#c2357a');
      rr(c, x - 12, y - 35, 24, 33, 4); c.fillStyle = g; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.2; c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 1; for (const dx of [-5, 0, 5]) { c.beginPath(); c.moveTo(x + dx, y - 32); c.lineTo(x + dx, y - 5); c.stroke(); }
      c.fillStyle = '#ffd400'; rr(c, x - 9, y - 29, 9, 6, 1.5); c.fill(); c.fillStyle = '#3ee0ff'; c.beginPath(); c.arc(x + 6, y - 14, 3.5, 0, 7); c.fill(); c.fillStyle = '#fff'; rr(c, x - 8, y - 15, 7, 4, 1); c.fill();
      c.fillStyle = '#1a1a22'; c.beginPath(); c.arc(x - 7, y - 1, 2.4, 0, 7); c.arc(x + 7, y - 1, 2.4, 0, 7); c.fill();
    }
    function phone(c, x, y, t) { // big phone with an incoming message, buzzing
      const wob = Math.sin(t * 40) * (Math.sin(t * 3) > 0.3 ? 1.6 : 0);
      c.save(); c.translate(x + wob, y); c.rotate(-0.08 + wob * 0.01);
      c.fillStyle = 'rgba(10,0,20,0.35)'; rr(c, -30, -58, 66, 124, 12); c.fill();
      rr(c, -34, -64, 68, 128, 12); c.fillStyle = '#16121e'; c.fill(); c.strokeStyle = '#ff5fa2'; c.lineWidth = 1.5; c.stroke();
      const sg = c.createLinearGradient(0, -58, 0, 58); sg.addColorStop(0, '#3a1a6a'); sg.addColorStop(1, '#c2357a');
      rr(c, -30, -58, 60, 116, 9); c.fillStyle = sg; c.fill();
      c.fillStyle = '#16121e'; rr(c, -9, -55, 18, 5, 2.5); c.fill();
      const k = Math.min(1, t * 2);
      c.globalAlpha = k; c.fillStyle = 'rgba(255,255,255,0.92)'; rr(c, -26, -40 + (1 - k) * 10, 52, 30, 7); c.fill();
      c.fillStyle = '#34c759'; c.beginPath(); c.arc(-18, -31 + (1 - k) * 10, 4, 0, 7); c.fill();
      c.fillStyle = '#c8c8d0'; rr(c, -11, -34 + (1 - k) * 10, 30, 3, 1.5); c.fill(); rr(c, -11, -28 + (1 - k) * 10, 22, 3, 1.5); c.fill(); rr(c, -20, -21 + (1 - k) * 10, 38, 3, 1.5); c.fill();
      c.globalAlpha = 1; c.restore();
      if (wob) { c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 1.5; for (const sx of [-1, 1]) for (let r = 0; r < 2; r++) { c.beginPath(); c.arc(x + sx * 44, y - 20, 6 + r * 6, sx > 0 ? -0.8 : Math.PI - 0.8, sx > 0 ? 0.8 : Math.PI + 0.8); c.stroke(); } }
    }
    return {
      enter() { this.i = 0; this.t = 0; },
      update(dt) { this.t += dt; U.setMobile([{ id: 'ok', label: '▶' }], 'none'); if (this.t > 0.5 && (G.pressed('ok') || G.pressed('enter') || (G.input.pointer && G.input.pointer.justDown))) { this.i++; this.t = 0; G.audio.sfx('blip'); if (this.i >= cards.length) { G.pop(); G.startWorld(true); } } },
      render(ctx) {
        sky(ctx);
        const cx = G.W / 2, ground = G.H * 0.86;
        if (this.i === 0) { // the player walks in with the suitcase
          const walk = Math.min(1, this.t / 1.6), px = G.lerp(-30, cx - 12, 1 - Math.pow(1 - walk, 3));
          const spr = G.personSpriteHi ? G.personSpriteHi(G.state.look, 2, walk < 1 ? [1, 0, 2, 0][Math.floor(this.t * 8) % 4] : 0, 10) : null;
          ctx.fillStyle = 'rgba(10,0,20,0.35)'; ctx.beginPath(); ctx.ellipse(px, ground, 16, 4, 0, 0, 7); ctx.fill();
          if (spr) ctx.drawImage(spr, px - 18 * 1.8, ground - 26 * 3.6 + 4, 18 * 3.6, 26 * 3.6);
          suitcase(ctx, px + 32, ground);
        } else phone(ctx, cx, G.H * 0.58, this.t);
        U.begin(); const [t, s] = cards[Math.min(this.i, cards.length - 1)];
        const a = Math.min(1, this.t * 3); U.ctx.globalAlpha = a;
        U.title(G.W / 2, 34, t, 20, '#ffd400');
        U.wrap(s, G.W - 70, 10).forEach((l, k) => U.text(G.W / 2, 54 + k * 13, l, 10, '#fff', 'center'));
        U.ctx.globalAlpha = 1;
        U.text(G.W / 2, G.H - 10, (this.i + 1) + '/' + cards.length + (G.device === 'mobile' ? '  · άγγιξε για συνέχεια' : '  · ENTER για συνέχεια'), 8, '#ffd6ea', 'center');
        U.drawMobile();
      },
    };
  };

  G.EndingScene = function () {
    return {
      enter() { this.t = 0; G.audio.sfx('mission_pass'); },
      update(dt) { this.t += dt; U.setMobile([{ id: 'ok', label: 'OK' }], 'none'); if (this.t > 6 && (G.pressed('ok') || G.pressed('enter'))) { G.pop(); WS.refreshMarkers(); U.toast('Free roaming: οι αποστολές ξαναπαίζονται όποτε θες.'); } },
      render(ctx) {
        ctx.fillStyle = '#0b0812'; ctx.fillRect(0, 0, G.W, G.H); U.begin();
        U.title(G.W / 2, 50, 'ΤΟ ΧΡΕΟΣ ΕΞΟΦΛΗΘΗΚΕ', 18, '#4cd964');
        if (this.t > 2) U.text(G.W / 2, 80, 'Η υπάλληλος σφραγίζει το χαρτί. Χαμογελάει.', 10, '#fff', 'center');
        if (this.t > 3.5) U.text(G.W / 2, 100, '«Α, και €12,40 τόκοι υπερημερίας. Περάστε την Τρίτη.»', 10, '#ffd400', 'center');
        if (this.t > 5) { if (!WS.endLogo) { WS.endLogo = new Image(); WS.endLogo.src = 'assets/logo/gta_gr.svg?v=1'; }
          const L = WS.endLogo, w = 150, h = w * 738.82 / 1315.95; U.ctx.globalAlpha = Math.min(1, (this.t - 5) * 2);
          if (L.complete && L.naturalWidth) U.ctx.drawImage(L, G.W / 2 - w / 2, 118, w, h); else U.title(G.W / 2, 160, 'GTA GR', 26, '#ff3e8a');
          U.ctx.globalAlpha = 1; }
        if (this.t > 6) U.text(G.W / 2, G.H - 16, G.device === 'mobile' ? 'Πάτα OK για free roaming' : 'Πάτα ENTER για free roaming', 8, '#ccc', 'center');
        U.drawMobile();
      },
    };
  };

  // ---------- revive (death) ----------
  G.ReviveScene = function (loss) {
    return {
      enter() { this.t = 0; G.audio.radio(false); const pl = G.player; if (pl.vehicle) WS.exitVehicle(); pl.down = 99; this.m = { x: pl.x, y: pl.y, kind: 'ped' }; },
      update(dt) {
        this.t += dt; U.setMobile([], 'none');
        if (this.t > 2.2 && !this.z) { this.z = 1; G.audio.sfx('revive'); }
        if (this.t > 1 && !this.said) { this.said = 1; G.audio.say('revive_m', 'Μην ανησυχείς. Το μηχάνημα είναι πιστοποιημένο… κάπου.', this.m, 2.4); }
        if (this.t > 4.3) { G.player.down = 0; G.state.health = 100; WS.dead = false; G.addMoney(-loss, 'ΙΑΤΡΙΚΑ'); G.pop(); U.toast('Αναστήθηκες. Το κράτος σού χρεώνει τα έξοδα.'); }
      },
      render(ctx) {
        WS.render(ctx, true);
        const pl = G.player, cx = pl.x - WS.camX, cy = pl.y - WS.camY, k = Math.min(1, this.t / 1.2);
        this.m.x = pl.x - G.lerp(70, 16, k); this.m.y = pl.y;
        G.drawPerson(ctx, G.LOOKS.revive_m, cx - G.lerp(70, 16, k), cy, 2, this.t < 1.2 ? Math.floor(this.t * 8) % 3 : 0);
        G.drawPerson(ctx, G.LOOKS.revive_f, cx + G.lerp(70, 16, k), cy + 2, 1, this.t < 1.2 ? Math.floor(this.t * 8) % 3 : 0);
        if (this.t > 1.3) {
          const mx = cx, my = cy - 24; ctx.fillStyle = '#555'; ctx.fillRect(mx - 10, my - 7, 20, 14); ctx.fillStyle = '#9cf'; ctx.fillRect(mx - 7, my - 4, 7, 5);
          ctx.fillStyle = Math.floor(this.t * 10) % 2 ? '#f33' : '#3f3'; ctx.fillRect(mx + 3, my - 3, 3, 3);
          if (this.t > 2.2 && this.t < 3.6) { ctx.strokeStyle = Math.random() < 0.5 ? '#fff' : '#7df'; ctx.beginPath(); ctx.moveTo(mx, my + 7); for (let i = 0; i < 5; i++) ctx.lineTo(cx + G.rand(-6, 6), my + 7 + i * 4); ctx.stroke(); }
        }
        if (this.t > 3.4) { ctx.fillStyle = `rgba(255,255,255,${Math.min(1, (this.t - 3.4) * 2)})`; ctx.fillRect(0, 0, G.W, G.H); }
        U.begin(); U.title(G.W / 2, 34, 'WASTED... σχεδόν', 18, '#ff5050'); U.drawBubbles(WS.camX, WS.camY); U.drawOverlays();
      },
    };
  };

  // ---------- jail ----------
  G.JailScene = function () {
    const mate = G.randomLook({ female: false, hairStyle: 'buzz', top: '#e67e22', topStyle: 'tank', acc: ['beard'] });
    const LINES = ['Για τι μπήκες; Εγώ για ένα ξυστό.', 'Θες κινητό; Έχω τρία.', 'Το φαΐ είναι καλύτερο απ\' τη δουλειά μου.', 'Γράφω βιβλίο. Λέγεται «Αθώος».', 'Αύριο έχει φασολάδα. Πάλι.'];
    const DUR = 7;
    return {
      enter() { this.t = 0; this.li = 0; G.audio.radio(false); G.audio.sfx('door'); },
      update(dt) {
        this.t += dt; U.setMobile([], 'none');
        if (Math.floor(this.t / 2.3) !== this.li) { this.li = Math.floor(this.t / 2.3); }
        if (this.t > DUR) {
          const sp = Wd.front('police'); G.player.x = sp[0] * TS + 8; G.player.y = sp[1] * TS + 12; WS.camX = G.player.x - G.W / 2; WS.camY = G.player.y - G.H / 2;
          WS.afterBust(); G.pop(); U.toast('Αποφυλακίστηκες για «καλή διαγωγή».'); G.audio.sfx('door');
        }
      },
      render(ctx) {
        const W = G.W, H = G.H;
        const P = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
        // room: cell is 220 x 170, centred
        const rw = 230, rh = 180, rx = 0, ry = 0, cx = rw / 2;
        P(0, 0, W, H, '#14121a');
        const k = Math.min((W - 40) / (rw + 28), (H - 56) / (rh + 10)), ox = W / 2 - rw * k / 2, oy = 30;
        ctx.save(); ctx.translate(ox, oy); ctx.scale(k, k);
        // back wall (3/4 view): concrete blocks, stained
        P(rx, ry, rw, 70, '#7a7670');
        for (let y = 0; y < 70; y += 10) for (let x = (y / 10 % 2) * 14; x < rw; x += 28) { P(rx + x, ry + y, 27, 9, '#86827b'); P(rx + x, ry + y + 8, 27, 1, '#6a665f'); }
        P(rx, ry + 62, rw, 8, '#5f5b55'); // skirting
        P(rx + 30, ry + 40, 18, 22, 'rgba(90,80,50,0.25)'); // damp stain
        // tally marks (μέρες)
        for (let i = 0; i < 4; i++) { for (let k = 0; k < 4; k++) P(rx + 150 + i * 14 + k * 2, ry + 30, 1, 10, '#2a2a2a'); P(rx + 149 + i * 14, ry + 35, 9, 1, '#2a2a2a'); }
        // high barred window with light beam
        P(rx + 96, ry + 8, 38, 22, '#2a2a30'); P(rx + 98, ry + 10, 34, 18, '#9fd0ff');
        for (let i = 0; i < 5; i++) P(rx + 100 + i * 7, ry + 10, 2, 18, '#333');
        ctx.fillStyle = 'rgba(255,250,200,0.12)'; ctx.beginPath(); ctx.moveTo(rx + 98, ry + 28); ctx.lineTo(rx + 132, ry + 28); ctx.lineTo(rx + 150, ry + 150); ctx.lineTo(rx + 70, ry + 150); ctx.closePath(); ctx.fill();
        // floor
        P(rx, ry + 70, rw, rh - 70, '#6b6760');
        for (let y = ry + 70; y < ry + rh; y += 16) P(rx, y, rw, 1, '#5d5953');
        for (let x = rx; x < rx + rw; x += 24) P(x, ry + 70, 1, rh - 70, '#5d5953');
        // side walls (dark)
        P(rx - 14, ry, 14, rh, '#3a3733'); P(rx + rw, ry, 14, rh, '#3a3733');
        // bunk bed (left): two metal bunks
        P(rx + 8, ry + 40, 4, 100, '#555'); P(rx + 64, ry + 40, 4, 100, '#555');
        P(rx + 8, ry + 52, 60, 18, '#6b6b70'); P(rx + 10, ry + 50, 56, 14, '#d8d2c0'); P(rx + 10, ry + 50, 14, 8, '#f0ece0'); // top bunk + pillow
        P(rx + 8, ry + 108, 60, 18, '#6b6b70'); P(rx + 10, ry + 106, 56, 14, '#c9c0a8'); P(rx + 10, ry + 106, 14, 8, '#f0ece0'); // bottom bunk
        P(rx + 26, ry + 106, 40, 14, '#3a5a8a'); // blanket
        // cellmate lying on the top bunk, talking
        ctx.save(); ctx.translate(rx + 40, ry + 56); ctx.rotate(-Math.PI / 2); ctx.imageSmoothingEnabled = true; ctx.drawImage(G.personSprite(mate, 0, 0), -9, -22, 18, 26); ctx.restore();
        // toilet + sink (right)
        P(rx + rw - 40, ry + 76, 26, 6, '#d8dde3'); P(rx + rw - 38, ry + 82, 22, 18, '#e8ecf0'); P(rx + rw - 34, ry + 85, 14, 10, '#b8c8d8'); P(rx + rw - 36, ry + 100, 18, 6, '#c8ccd2');
        P(rx + rw - 40, ry + 44, 24, 10, '#cfd4da'); P(rx + rw - 36, ry + 46, 16, 5, '#9aa8b8'); P(rx + rw - 29, ry + 38, 2, 6, '#888'); // sink + tap
        P(rx + rw - 76, ry + 120, 14, 4, '#9a8a6a'); P(rx + rw - 74, ry + 116, 10, 4, '#c8b88a'); // tray with food
        // the player standing in the middle, waiting
        G.drawPerson(ctx, G.state.look, cx + 6, ry + 140, Math.floor(this.t * 0.7) % 4 === 3 ? 3 : 0, 0);
        // front bars + door (closest to camera)
        P(rx - 14, ry + rh - 4, rw + 28, 6, '#2a2a2e');
        for (let x = rx - 10; x < rx + rw + 12; x += 24) { P(x, ry - 4, 3, rh + 6, '#4a4a52'); P(x, ry - 4, 1, rh + 6, '#8a8a94'); }
        P(rx - 14, ry - 6, rw + 28, 6, '#2a2a2e'); P(rx - 14, ry + 70, rw + 28, 4, '#2a2a2e');
        P(cx + 40, ry + 80, 10, 12, '#8a6a20'); P(cx + 43, ry + 84, 4, 4, '#2a2a2e'); // lock
        ctx.restore();
        // UI
        U.begin();
        U.title(W / 2, 18, 'ΚΟΡΥΔΑΛΛΟΣ', 18, '#fff');
        const left = Math.max(0, Math.ceil(DUR - this.t));
        U.pill(W / 2, H - 12, 'Αποφυλάκιση σε ' + left + '…', null, U.T.gold);
        const msg = LINES[this.li % LINES.length];
        const bx = ox + 60 * k, by = oy + 22 * k; const lines = U.wrap(msg, 120, 8);
        U.rr(bx - 4, by - 10, 130, lines.length * 10 + 8, 5, '#fff', 'rgba(0,0,0,0.6)');
        lines.forEach((l, i) => U.text(bx + 61, by + i * 10, l, 8, '#111', 'center', null));
        U.drawOverlays();
      },
    };
  };
})();
