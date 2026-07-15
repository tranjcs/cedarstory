# Handoff — 2026-07-14

## This session: multi-map system

Added four connected maps on top of the infinite overworld:

1. **Overworld** (existing infinite biomes) — now has a worn road north of
   spawn leading to a stone arch gate at (0, -620).
2. **Willowbrook** (town 1) — walled town: houses, well, market stalls,
   river + dock on the east side. Safe zone.
3. **Hyrmoor Castle Town** — TP-style: central plaza with animated fountain,
   castle facade with portcullis at the north (locked, announces a message),
   shops/banners/lamps. Safe zone.
4. **The Sapphire Crossing** (ocean) — player sails a red skiff (drawn under
   the player, `map.boat` flag) between Willowbrook's dock and the island.
5. **Gullrest Isle** — sand + grass heart, palms, huts, campfire; spawns
   2 slimes + 1 bandit fresh on every visit.

### Architecture

- `js/maps/MapRegistry.js` — pure data: bounds, floor/regions, decos,
  colliders, gates, spawns. Same deco schema the chunk system uses.
- `js/maps/MapManager.js` — current map, gate triggers, 0.4s fade
  transitions (clears enemies/zones/portals/etc. on travel since each map is
  its own coordinate space), circle-vs-rect collision + bounds clamp.
- Renderer gained fixed-map floor/wall/gate drawing, ~18 new deco types
  (house, shop, hut, stall, well, lamp, palm, wave, castle, fountain, …),
  the boat, and the fade overlay. `main.js` only runs `chunks.update` on the
  overworld. HUD shows map name instead of biome inside fixed maps.

Verified in-browser: full travel loop overworld → town → castle → back,
town → ocean → island → back, collisions, locked castle gate, island spawns.
No console errors. Note: rAF throttling pauses the game when the tab is
backgrounded — transitions only advance while the tab renders.

### Ideas / next steps

- NPCs in towns (villagers with dialogue barks)
- Depth-sort players/enemies against building decos so you can walk "behind" them
- Shops that actually sell something (potions for the Alchemist?)
- More islands off the Crossing; sea enemies while sailing
- Persist visited-map state (e.g. island enemies stay dead per session)
