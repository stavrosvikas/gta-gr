# GTA LUBEN: how to write a quest

Vanilla JS, no build step, no libraries. Everything is drawn in code as GBA-style pixel art (a Pokémon-era 3/4 top-down view). Internal resolution: `G.W` x `G.H` (height 216, width 216–480 depending on screen). Tiles are 16px (`G.TS`).

Brief with all the content: `../_brief/BRIEF.md`. Read your quest's section in it, and the "ΒΑΣΙΚΗ ΑΡΧΗ" rule: everything is for the joke, keep it short, fun and forgiving. A quest should take 1–3 minutes.

## Hard rules
- **No character names anywhere on screen.** Use descriptions ("ο τύπος με το τσεκούρι") or nothing.
- Each quest is a **self-contained file** in `js/quests/`. Edit ONLY your file(s). Do not touch the engine files. If you really need an engine change, write it in your final report instead.
- It must work on **PC and mobile**. `G.device` is `'pc'` or `'mobile'`. Give mobile on-screen buttons via the `buttons` option (see below). Joystick input arrives through `G.readAxis()` on both devices.
- All on-screen text is in Greek.
- Voice lines: `this.say('vo_key', 'Κείμενο', entityOrNull, dur)`. That shows a speech bubble and plays `assets/sounds/vo_<key>.mp3` if the user adds it later. Use a stable key for every line, and list them all in your report so they can go into SOUNDS.md.
- Music: `G.audio.music('music_<key>', bpm)` plays `assets/sounds/music_<key>.mp3` if it exists, otherwise a synth loop. `G.audio.stopMusic()`.
- SFX: `G.audio.sfx(name)`. The synth has: coin hit punch horn crash door mission_pass mission_fail star siren blip splash bark baa tax revive zap step good bad whoosh cheer meow hiss.

## Skeleton
```js
'use strict';
(function () {
  const WS = G.worldScene, Wd = G.World;
  const walk = (x, y) => Wd.walkable(x, y) && !Wd.propAt(x, y);
  let spot = null;
  G.quest({
    id: 'dance', title: 'Χορός στο Σύνταγμα', short: 'Χορός', col: '#ffd400', reward: 300,
    where: () => spot || (spot = WS.placeNear([...], walk)),   // KEEP the existing where() from the placeholder file
    make: () => G.MiniGame({
      id: 'dance', title: 'ΧΟΡΟΣ ΣΤΟ ΣΥΝΤΑΓΜΑ', reward: 300,
      intro: { pc: 'Οδηγίες για PC...', mobile: 'Οδηγίες για κινητό...' },
      buttons: [{ id: 'action', label: 'ΔΡΑΣΗ' }],      // or a function returning the list each frame
      stick: 'stick',                                     // 'none' to hide the joystick
      init() { /* reset all state on this */ },           // called on enter and on retry
      onStart() { /* when the player presses start */ },
      update(dt) { /* this.pt = play time. call this.win(text, reward?) or this.lose(text) */ },
      render(ctx) { /* draw the world onto the pixel canvas ctx */ },
      hud() { /* draw UI text with G.ui.* (crisp overlay, same coordinates) */ },
    }),
  });
})();
```
`G.MiniGame` handles the intro card, pause, the win/lose card, retry, quitting back to Athens, and paying the reward (`G.completeQuest`). Travel transitions: `G.travel({icon:'train'|'heli'|'car'|'bike', from:'Αθήνα', to:'Σέρρες', sub:'...'}, () => G.push(mini))`. To use one, set the quest's `start: () => G.travel(..., () => G.push(def.make()))` instead of the default.

## Input
- `G.readAxis()` → `{x,y}` in -1..1 (WASD, arrows or joystick).
- `G.held(name)` / `G.pressed(name)`, where name is one of `up down left right action enter ok back a b horn`.
  - PC keys: action=Space, enter=E/F, ok=Enter/Space, a=J/1, b=K/2.
  - Mobile: `pressed(id)` is true when the on-screen button with that `id` is tapped.
- Raw key: `G.keyPressed('KeyW')`.

## Drawing
- `G.drawPerson(ctx, look, x, y, dir, frame, {down, lift, alpha})`: feet at (x,y). dir: 0 down, 1 left, 2 right, 3 up. frame: 0 stand, 1/2 walk.
- Preset looks in `G.LOOKS`: seraios protopsalti bassist guitarist gamath kados priest filos cop_lera cop_agapi revive_m revive_f student reporter cyclist shepherd fd_bar fd_host fd_waiter1 fd_waiter2 ferrari_lady hipster hipster2 homeless tourist rich yiayia footballer_w footballer_y keeper. Player look: `G.state.look`. Random person: `G.randomLook()`. You can make new look objects; see `G.LOOKS` in js/gfx.js for the fields (`hairStyle`, `topStyle`, `acc`, `held`...).
- `G.drawVehicle(ctx, type, colour, x, y, angle)`: types car taxi police ferrari tincan van pickup sheeptruck bus truck bike scooter moto dias heli. angle 0 = facing right.
- Physics vehicle: `new G.Ent.Vehicle(type, x, y, angle, col)`. Set `v.solidFn = (px,py)=>bool` for your arena's collision, then `v.drive(dt, throttle, steer, brake)` each frame and `v.draw(ctx, camX, camY)`.
- Person entity: `new G.Ent.Person(look, x, y)`. Set `p.solidFn`, then use `p.move(vx, vy, dt)` (it animates by itself) and `p.draw(ctx, camX, camY)`.
- Arena helper: `G.Arena(rows, legend)`. `rows` is an array of strings, `legend[char] = {col, solid, draw(ctx,tx,ty)}`. Gives `A.solidAt(px,py)`, `A.draw(ctx,camX,camY)`, `A.find(char)`. Camera: `G.camFollow(cam, x, y, worldW, worldH, dt)`.
- `G.shade(hex, f)` lightens or darkens a colour. `G.mkCanvas(w,h)` returns `[canvas, ctx]`.
- UI (crisp text, call inside `hud()`): `G.ui.text(x,y,str,size,col,align)`, `G.ui.title(x,y,str,size,col,align)` (the GTA-ish heavy text), `G.ui.box(x,y,w,h)`, `G.ui.bubble(text, entity, dur)`, `G.ui.toast(text)`, `G.ui.shake(px)`, `G.ui.splat(sec)`.
- Helpers: `G.rand G.randi G.pick G.chance G.clamp G.lerp G.dist G.angleDiff`.

## Checking your work
Run `node --check yourfile.js`. Then read your code through once, carefully, against the API above. The lead developer tests in the browser.
