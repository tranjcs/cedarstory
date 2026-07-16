# Handoff — 2026-07-15 (prev: 2026-07-14)

## This session (part 5): reputation, royals, arson, and reorganization

- **Lighting**: `DayCycle.darkness` is now one continuous curve (0 at noon
  → 0.14 at 6/18 → 0.64 just after midnight); dawn/dusk lerp through it.
- **Alchemist**: all potion cooldowns are 0. Potions carry `id` now;
  moonshine's `onLand` calls `reputation.onMoonshine`.
- **Killable NPCs**: Npc gained hp/status/flash/knockback; every damage
  path (arc, beam, area, self-slam, boulder, shard, wall imbue, spray,
  chain lightning, DOT, zones) targets `world.combatTargets` = enemies +
  npcs. CombatSystem.killTarget emits `npc:killed` with a MURDERED floater.
- **Reputation** (`systems/Reputation.js`, on ctx + HUD sidebar):
  −15 murder / −40 regicide / −20 guard / −5 animal / −10 trespass /
  −6 building / ±8 moonshine (＋ only in the tavern at night — patrons
  toast you). rep<0: villagers flee with fear lines; rep≤−30: guards
  convert to hostile `guardsman` enemies near the player; witnesses
  convert immediately. rep≥30: love lines.
- **Keep expanded** (1800×1200): royal family (King Aldric IV, Queen
  Maribel, Princes Edmund & Casper, Princess Elowen — `royal: true`),
  6 guards, and `restricted` rects (royal wing + dais). MapManager tracks
  `restrictedT`; renderer reddens the screen; >4s → `reputation.trespass`.
  Dungeon has Griswold the prisoner; the store has browsing customers.
- **The Gilded Toad**: tavern building in Willowbrook (deco type 'tavern',
  windows always lit) + interior map (`alwaysLit`, `fixedCamera`, 4 patrons
  who never sleep).
- **Destructible buildings**: `building()` in maps/builders.js registers
  hp/burning/destroyed on the deco and links its collider (`c.b`). Boulders
  and area bursts damage them, fire spray/fire boulders ignite, burning
  spreads to neighbors within 150px, rain zones douse, collapse leaves
  walkable rubble (persists for the session) and costs rep.
- **Reorganized**: MapRegistry.js (was ~1450 lines) split into
  `maps/builders.js` + `maps/stages/{wilds,willowbrook,hyrmoor,sea,ports}.js`;
  MapRegistry now just assembles MAPS. Split done mechanically with sed —
  stage files share one import line (some imports unused, harmless).

All verified headlessly via CDP: murder→witness→hostile-guard chain, flee
behavior, tavern vs street moonshine, royals/restricted timing (red tint →
trespass at 4s → 5 guardsmen), burn/douse/collapse/rubble-walkthrough,
16-map boot after the split, zero console errors. Browser pane still has
no visible surface — a human visual pass is overdue.

## Previous session (part 4): the CedarStory expansion

Spellchain is now **CedarStory** (title, controls bar, README). Big batch
from the task list:

- **URL**: repo root `index.html` (generated copy of `spellchain/index.html`
  with `spellchain/`-prefixed asset paths) serves the game at
  `tranjcs.github.io/cedarstory`. **Regenerate it whenever
  `spellchain/index.html` changes** (sed one-liner in README).
- **Day/night** (`core/DayCycle.js`): 20 real min/day, night 19–05,
  sunrise/sunset hours lerp a dark overlay. Lamps/windows/lanterns lit only
  after dark (`renderer.lightsOn`), shops board their doors, HUD clock.
  NPCs walk home and sleep at night (guards + Mochi exempt; pets sleep at
  their owner's home). Respawn waves every 600s per stage, timer runs 2×
  at night.
- **NPCs** (`entities/Npc.js` rewrite): follow behavior (player or named
  NPC), NPC↔NPC proximity chats (chatter arrays + generic pool, reply after
  a beat), expanded dialogue everywhere. New Willowbrook cast: Edric
  (mystery "?" over his head — quest hook, unresolved by design), Jonty +
  Biscuit (dog follows boy), Mochi (cat follows player; dogs scare her —
  she bolts, sulks, resumes when you fetch her away from the dog; scare
  check runs BEFORE the talking early-return, that ordering matters).
  Animal bodies: dog/cat/chicken/cow/ox.
- **Enemies**: shark (ocean), ghost (ship/dungeon), crab (island), goblin
  (camp) — data + bodies.
- **10 new stages** (15 total): farm (windmills/livestock, west of town),
  ocean rebuilt 6400×4200 as the travel hub (7 docks incl. pirate ship
  boarding), ship, keep (castle gate now opens; 4 guards), dungeon (below
  keep), goblin camp (SW Wilds), korea/japan/sg/spa far ports, store
  interior (`fixedCamera: true` — camera locks to map center in main.js).
- **Co-op** (`net/Net.js`): WebRTC manual-signal (O key panel), host
  authoritative — host streams enemy snapshots by id, guest streams pos +
  damage deltas (detected via `netHp` watermark), guest travel follows
  host via `MapManager.netTravel`. Character name on class screen; name
  tags under wizards. Untested against a real second peer — needs a
  two-browser smoke test.
- **Wand removed** from Alchemist (holds the selected potion instead).
  Controls bar is class-filtered (`data-for` attributes).
- **Wiki**: repo-root `wiki/` static site (6 pages), linked from README.

Verified headlessly (CDP): boot, all 15 stages travel + render, night
sleep/wake, NPC chat exchange, cat/dog full arc, respawn waves (601s → 5
spawns; 301s at night), store fixed camera, no console errors. Not yet
verified: co-op with a real peer, visual pass (Browser pane surfaceless).

## Previous session (part 3): finite world, minimap, edge fog

The infinite chunk overworld is gone. Every place is now a finite stage in
`MapRegistry.js`; the game starts on **The Wilds** (`START_MAP`), a
3600×2700 stage with five biome zones (deepwood, frostreach, sunscar
desert, mirefen, ashlands as region circles) around a meadow heart, a road
north to the Willowbrook arch, ~24 seeded enemy dens, and 2 training
dummies near the start.

- Deleted `js/biomes/` (ChunkManager + BiomeRegistry) and the `WORLD`
  config block; `main.js` calls `maps.init(ctx)` to place + populate.
- Map schema additions: `start`, `fog`, `dummies`, `respawn`
  ({ interval, cap, minDist } — the Wilds trickle-respawns one enemy from
  its spawn list every 14s up to 18 alive, never within 520px of you).
- **Minimap** (Hud top-right): floor + regions + collider footprints,
  pulsing gate dots, red enemy / tan dummy / green NPC dots, white player
  dot. Scales to ≤170×130.
- **Edge fog**: `map.fog` draws four gradient mist bands (~170px) along
  stage edges, drawn over entities — used on the Wilds instead of a wall.
- Renderer now culls floor tiles and decos to the camera view.

Verified headlessly via CDP (Browser pane has no visible surface — rAF
paused; screenshots unavailable): start state, full render + HUD frame
(fog + minimap), Wilds↔town round-trip with repopulation, edge clamping,
town→ocean→island chain. No console errors. **Worth a visual pass when
the pane is back.**

## Previous session (part 2): NPCs with dialogue

Fixed maps now have wandering townsfolk with proximity dialogue:

- `js/entities/Npc.js` — wander state machine around a home anchor; when a
  player comes within 70px (and their chat cooldown is up) they stop, face
  the player, and speak their next line. Lines cycle per NPC.
- NPC rosters live in `MapRegistry.js` per map (`npcs: [...]`): Willowbrook
  has 6 (incl. Guard Hedda at the north gate, Old Finn on the dock), Castle
  Town has 6 (two castle-gate guards, a noble, a bard, a merchant, a kid),
  Gullrest Isle has 3. Ocean has none.
- Body variants: villager / elder (stooped, cane, slower) / guard (armor,
  spear, tight wander) / kid (small, fast, wide wander). Palette per NPC.
- Renderer draws NPCs between enemies and cats, and speech bubbles (white
  rounded rect, name tag, word-wrapped text, fade in/out) above everything.
- NPCs live in `world.npcs` — never combat targets; MapManager collides
  them against buildings and clears/respawns them on map travel.

Verified headlessly via CDP (Browser pane lost its surface mid-session):
gate travel spawns all rosters, dialogue triggers with correct lines, NPCs
wander, and a forced `Renderer.render()` frame with an active speech bubble
throws no errors.

## Previous session (part 1): multi-map system

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

- Depth-sort players/enemies against building decos so you can walk "behind" them
- Shops that actually sell something (potions for the Alchemist?)
- More islands off the Crossing; sea enemies while sailing
- Persist visited-map state (e.g. island enemies stay dead per session)
