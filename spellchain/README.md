# Spellchain

A top-down arcane sandbox inspired by classic element-weaving action games.
Queue elements on the keyboard, chain them into compound spells, and unleash
them as beams, sprays, boulders, walls, and lightning. PC only, on purpose —
the whole game is built around fast keyboard spell chaining.

Pure ES modules + Canvas 2D. No dependencies, no build step.

## Run

Serve the folder with any static server (ES modules don't load from `file://`):

```sh
npx serve spellchain
```

Or use the repo's `.claude/launch.json` `spellchain` configuration (port 8377).

## Controls

| Input | Action |
| --- | --- |
| Hold LMB | Move toward cursor |
| Space | Dash toward cursor |
| Q W E R / A S D F | Queue Water, Life, Shield, Cold / Lightning, Arcane, Earth, Fire |
| RMB | Cast at cursor (hold to channel beams/sprays/arcs) |
| Shift+RMB | Cast on self |
| C | Area burst around self |
| Backspace / Esc | Undo last element / clear queue |
| T | Spawn training dummy at cursor |
| M / H | Mute / toggle help |

## The world

The infinite overworld ("The Wilds") is a procedurally generated biome
Voronoi. Four handcrafted places connect to it through gates — walk into a
gate's glow to travel:

- **Willowbrook** — a walled town up the north road from spawn. Safe.
- **Hyrmoor Castle Town** — through Willowbrook's north gate: plaza,
  fountain, market stalls, and a castle whose gates are sealed. Safe.
- **The Sapphire Crossing** — board the boat at Willowbrook's east dock and
  sail it yourself, Wind Waker style.
- **Gullrest Isle** — across the water: palms, huts, a campfire, and a few
  locals who bite.

## Spell chemistry

- **Combine:** Water+Fire → Steam, Water+Cold → Ice, Steam+Cold → Water, Ice+Fire → Water
- **Opposites annihilate:** Fire↔Cold, Water↔Lightning, Earth↔Lightning, Life↔Arcane, Shield↔Shield
- **Shape priority:** Shield → wall · Earth → boulder · Ice → shard volley · Arcane/Life → beam · fluids → spray · Lightning → arc
- **Statuses:** wet doubles lightning damage · wet+cold freezes · frozen shatters under earth/ice (3×) · fire ignites (unless wet) · duplicates multiply power ×1.7 each

## Project structure

```
spellchain/
├── index.html              # markup only — no inline JS or CSS
├── css/style.css           # all styling, CSS custom properties
└── js/
    ├── main.js             # composition root: builds and wires everything
    ├── config.js           # data-driven balance numbers & element chemistry
    ├── core/               # engine plumbing (no game rules)
    │   ├── EventBus.js     #   pub/sub hub
    │   ├── GameLoop.js     #   clamped-dt rAF loop
    │   ├── Input.js        #   DOM events → semantic intents
    │   ├── Camera.js       #   follow, shake, screen↔world
    │   ├── AudioManager.js #   procedural synth, data-driven sound table
    │   └── math.js         #   pure helpers
    ├── spells/
    │   ├── ElementQueue.js #   queue chemistry (combine/cancel/reject)
    │   ├── SpellResolver.js#   queue → spell kind, name, power
    │   ├── CastSystem.js   #   queue owner + channel driver
    │   └── strategies.js   #   one strategy per spell shape
    ├── entities/
    │   ├── Player.js
    │   ├── Dummy.js
    │   ├── StatusEffects.js#   shared timed-status component
    │   └── projectiles.js  #   Boulder, Shard, Wall
    ├── systems/
    │   ├── CombatSystem.js #   damage, statuses, chain lightning, healing
    │   └── EffectsSystem.js#   particles, floaters, rings, bolts
    ├── biomes/             # infinite overworld: biome data + lazy chunks
    ├── maps/
    │   ├── MapRegistry.js  #   handcrafted maps (town, castle, ocean, island) — pure data
    │   └── MapManager.js   #   gate travel, fade transitions, map collision
    ├── classes/            # Mage & Alchemist player classes
    ├── enemies/            # enemy data + AI
    ├── world/World.js      # entity registry, spawning, lifecycle sweep
    └── render/
        ├── Renderer.js     # world-space drawing (reads state only)
        └── Hud.js          # screen-space overlay
```

## Design patterns

| Pattern | Where | Why |
| --- | --- | --- |
| Observer | `core/EventBus.js` | Input, combat, and casting publish events; audio, HUD, and camera shake subscribe — no cross-dependencies. |
| Strategy | `spells/strategies.js` | One class per spell shape, selected by `SpellResolver.resolveKind`; adding a shape means adding a strategy. |
| State | `Channel` classes in `strategies.js` | Channelled spells (beam/spray/arc) are stateful objects the `CastSystem` drives until released or exhausted. |
| Component | `entities/StatusEffects.js` | Timed statuses composed into both Player and Dummy. |
| Factory | `World.spawnDummy`, strategy registry | Centralized creation with lifecycle ownership. |
| Composition root / DI | `js/main.js` | The only module that knows every subsystem; everything else receives collaborators via constructor or frame context. |
| Data-driven config | `js/config.js`, sound table in `AudioManager` | Balance, chemistry, and sounds are data, not logic. |
