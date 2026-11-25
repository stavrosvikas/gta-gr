# Quests that live on the map (regions)

The user: quests must NOT feel like separate instances. Milos is an island you reach by boat, Crete is further by ship, the Ferrari field is in Thessaly (a 10 s drive on the εθνική), Serres by train, the mountain at the end of the εθνική. The world (`js/world.js`) now contains all of those places in one map (300 x 356 tiles, TS = 16). Trains and boats are real rides across the map (`G.ride` in `js/worldscene.js`).

Each remote quest owns a **region**: a rectangle of the world where the quest's own art is drawn into the open world, so the place you walk/drive into is exactly the place the quest is played in.

## Where each region sits (`G.World.SPOTS`)
| id | tx, ty (tiles) | max w x h | entry side | what's around it |
|---|---|---|---|---|
| seraios | 150, 12 | 34 x 22 | top (dirt path from Serres station at 143,10) | Thessaly/Serres countryside: wheat `Y`, ploughed soil `L`, grass `~`, tree lines; village houses with tiled roofs nearby |
| ferrari | 214, 56 | 30 x 32 | top (the εθνική, road y 48-51, is right above) | Thessaly fields (wheat, ploughed soil, grass) |
| shepherd | 262, 58 | 31 x 290 | top (dirt clearing at the end of the εθνική) | dense mountain forest + grey boulders |
| milos | 157, 172 | 30 x 24 | top (dirt path from the Milos pier at 171,140-149) | Milos: dry grass `g` #b4bc68, sand `s` #efd9a0, white chalk rocks; the open sea is right below the region (south) |
| crete | 38, 214 | 46 x 128 | bottom (dirt path from the Crete harbour at 88..101, 329..331) | Crete: dry grass `g`, olive trees, sandy-ochre rocks |

You may shift tx/ty by a few tiles and choose w/h up to the max. Keep the edges blending into the surrounding terrain (match its colours at the border, no hard frame).

## API (in `js/world.js`)
Register at load time (top level of your quest IIFE, after your painter exists):
```js
const SP = G.World.SPOTS.<id>;
G.region({
  id: '<id>', tx: SP.tx, ty: SP.ty, w, h,            // tiles
  entry: [lx, ly],                                     // local TILE on the entry side; the quest marker sits here
  mini: '#c8b088',                                     // minimap colour (or miniDraw(ctx) drawing 1px = 1 tile, local coords)
  paint(ctx, lx0, ly0, lw, lh) { ... },               // paint your background; ctx is already translated so local px (0,0) = region top-left and
                                                       // clipped to one 256x256 world chunk; [lx0,ly0,lw,lh] is the local px rect that is visible. Static only.
  solid(lx, ly) { return bool },                      // local px; walls/fences/water/cliffs for free roaming in the open world (player on foot and cars)
  live(ctx, ox, oy) { ... },                           // optional: animated ground-level stuff (water shimmer, flags); ox,oy = screen pos of the region origin
  statics(push, ox, oy) { push(localY, ctx => draw at screen ox+lx, oy+ly) }, // optional: standing things (trees, houses, NPC idling) y-sorted with world sprites
});
```
- `paint` is called once per chunk and cached (LRU). It must be deterministic. Reuse your existing background painter; if you cache a big background canvas, keep canvases ≤ 4096 px per side (RS can be 4), or paint directly per call with culling to the visible rect.
- World collision inside the region uses only `solid`. Return false for open ground.
- The quest marker is at `entry`; the story uses `G.World.entryOf(id)`; your old `where:` is ignored.

## Quest flow changes
- `start: () => G.push(def.make())`. No `G.travel(...)` card any more (the train / boat / car trip already happened on the map).
- Remove any part of the quest that was only "getting there" (e.g. Milos helicopter flight, Ferrari's long road from Athens, Seraios train arrival) — keep everything that is real gameplay.
- Arena coordinates = region-local px. When the quest starts, the player is standing on the entry tile: start the quest's player/car near the entry, and set the quest camera so the first frame lines up with the world: `cam.x = G.worldScene.camX - SP.tx*16; cam.y = G.worldScene.camY - SP.ty*16` (clamped as you already do), then follow as usual.
- In `G.MiniGame` opts add `exitTo() { return [worldPx, worldPy] }` → after win / giving up, the player is put back on the map there (on the entry tile, or wherever the quest ended if that spot is walkable in the world).
- Your quest background and the world region must look the same (the same painter).
- Keep gameplay, timings, voice keys, ids, rewards, HD-2D style (`STYLE_HD.md`), and the one-font UI.

## Testing
Don't use the browser (several people work in parallel; the lead tests in the browser). Check syntax with `node -e "new Function(require('fs').readFileSync('js/quests/<file>','utf8'))"`. Edit only your own quest file.
