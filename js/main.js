// GTA LUBEN — boot + main loop
'use strict';
(function () {
  G.startWorld = function (fresh) {
    G.scenes = [];
    G.push(G.worldScene);
    G.audio.radio(false);
    if (fresh) {
      G.ui.toast(G.device === 'mobile' ? 'Joystick = κίνηση · ΜΠΕΣ = αμάξι/αποστολή · MAP = χάρτης' : 'Βελάκια/WASD κίνηση (και στο αμάξι) · E μπες/αποστολή · M χάρτης', 7);
      G.worldScene.availSteps().forEach((st, i) => setTimeout(() => G.worldScene.phone(st), 1500 + i * 2200));
    } else G.worldScene.availSteps().forEach((st, i) => setTimeout(() => G.worldScene.phone(st), 800 + i * 2200));
  };

  function boot() {
    G.initCanvas(); G.initPointer(); G.ui.init(); G.ui.initTouch();
    G.World.load();
    G.state = G.newState();
    G.push(G.TitleScene);
    let last = performance.now();
    function frame(now) {
      let dt = (now - last) / 1000; last = now; if (dt > 0.05) dt = 0.05;
      G.dt = dt; G.t += dt;
      const s = G.top();
      try {
        if (s) { s.update(dt); }
        G.ui.update(dt);
        const s2 = G.top(); G.ctx.setTransform(G.RS, 0, 0, G.RS, 0, 0); if (s2) s2.render(G.ctx);
        if (G.device === 'mobile' && G.portrait) { const c = G.ui.ctx; c.fillStyle = 'rgba(0,0,0,0.85)'; c.fillRect(0, 0, G.W, G.H); G.ui.title(G.W / 2, G.H / 2 - 10, '↻', 40, '#ffd400'); G.ui.text(G.W / 2, G.H / 2 + 24, 'Γύρισε το κινητό οριζόντια', 14, '#fff', 'center'); }
      } catch (e) { console.error(e); G.lastError = e; }
      G.endInputFrame();
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    window.addEventListener('blur', () => { if (G.top() === G.worldScene) G.push(G.PauseScene); });
  }
  window.addEventListener('load', boot);
})();
