# GTA LUBEN: HD-2D style guide (every scene must follow it)

The user rejected chunky pixel art. The game now uses an "HD-2D" look: clean, smooth shapes with volume (light from the top-left, soft shading, drop shadows). It is NOT pixelated. Reference implementations:
- characters: `js/person_hd.js` (`G.drawPerson` is already HD)
- vehicles: `drawVehicle` in `js/gfx.js` (`G.drawVehicle` is already HD)
- city: `js/world.js` (`paintBuilding`, `W.treeSprite`, the building shading block)

## Rendering facts
- The main canvas renders at `G.RS` (2–4) times the logical resolution. Your `ctx` already has `setTransform(G.RS)`, so keep drawing in logical coordinates (`G.W` x `G.H`, height 270). Fractional coordinates are fine and give smooth anti-aliased shapes.
- `ctx.imageSmoothingEnabled` is false by default. **Never** draw a 1x `G.mkCanvas` canvas: it upscales into chunky pixels.
- For offscreen canvases (backgrounds, sprite caches) use `const [c, x] = G.hiCanvas(w, h, G.RS)`. `x` is already scaled, so draw in logical units. It has `c.lw`/`c.lh`. Blit with `ctx.drawImage(c, dx, dy, c.lw, c.lh)`. For sprites you scale or rotate, create them at `G.RS * 1.5` and set `ctx.imageSmoothingEnabled = true` around that drawImage, then restore it.
- Cache keys must include `G.RS`. If you cache a background, rebuild it when `G.RS` changes.

## Look
- Shapes: rounded rects (`roundRect`), circles and ellipses, quadratic curves. No 1-px dot details or stair-stepped edges.
- Light: linear/radial gradients, lighter top-left and darker bottom-right. Use `G.shade(hex, ±f)` for tints.
- Outlines: thin dark strokes `rgba(28,20,36,0.85)`, lineWidth 0.5–0.8.
- Drop shadows on everything that stands on the ground: `rgba(20,10,30,0.28–0.3)` ellipse or rounded rect, offset (+3, +4).
- Ground textures: subtle. Large soft gradient areas plus sparse soft details (grass tufts as small curved strokes, stones as small ellipses with a highlight). Fewer, nicer details instead of noise.
- Obstacles must clearly read darker or more saturated than walkable ground, with a dark border and a shadow (the user needs to see where the walls are).
- Water: gradient plus soft animated highlight strokes (sin of `G.t`), not checkerboards.
- Fog, light beams, glows: radial gradients with alpha.
- UI text only via `G.ui.text/title/pill/box/button`: one font (Handjet) and one panel style (see `js/ui.js`, `U.T` colours). Don't invent new HUD styles; reuse `U.box(..., U.T.panel, U.T.line, accent)` and `U.pill`.

## Don't break
Keep gameplay, timings, collision, ids, voice keys and mechanics exactly as they are. Only change how things are drawn. Collision boxes stay a little smaller than the visuals.
