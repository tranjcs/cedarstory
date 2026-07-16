# CedarStory

A top-down arcane sandbox inspired by classic element-weaving action games —
and, increasingly, by MapleStory and The Wind Waker. Queue elements on the
keyboard, chain them into compound spells, and explore fifteen connected
stages under a living day/night cycle. PC only, on purpose — the whole game
is built around fast keyboard spell chaining.

Pure ES modules + Canvas 2D. No dependencies, no build step.

**Play it:** <https://tranjcs.github.io/cedarstory> ·
**Wiki:** <https://tranjcs.github.io/cedarstory/wiki/>

## Run locally

Serve the repo with any static server (ES modules don't load from `file://`):

```sh
npx serve .
```

Or use `.claude/launch.json`'s `spellchain` configuration (port 8377).
The game lives in `spellchain/`; the repo-root `index.html` wraps it so the
deployed game serves at the repo root URL. **If you change
`spellchain/index.html`, regenerate the root copy** (same file with
`css/`→`spellchain/css/`, `js/`→`spellchain/js/`).

## Controls

| Input | Action |
| --- | --- |
| Hold LMB | Move toward cursor |
| Space | Dash toward cursor |
| Q W E R / A S D F | Queue elements (Mage) / throw potions (Alchemist) |
| RMB | Cast at cursor (hold to channel beams/sprays/arcs) — Alchemist potions have **no cooldowns** |
| Shift+RMB | Cast on self / drink |
| C | Area burst (Mage) |
| Backspace / Esc | Undo last element / clear queue |
| T | Spawn training dummy at cursor |
| P / O | Change class / co-op panel |
| M / H | Mute / toggle help |

The controls bar shows only your current class's commands. Pick a character
name on the class screen — it hangs under your wizard, MapleStory style.

## The world

Sixteen finite stages joined by gates, with a minimap in the corner and fog
at the wild edges. One in-game day passes every 20 real minutes under a
continuous lighting curve — brightest at noon, deepest just after midnight:
at dusk the lamps light, shops board up, townsfolk walk home to sleep, and
monster spawn rates double until dawn. Monsters respawn in waves every 10
minutes.

### Reputation

Townsfolk are flesh and blood — every spell that hurts a monster hurts them
too, and the town keeps score (REP in the sidebar). Murder costs −15
(regicide −40), flattening a building −6, trespassing −10, throwing
moonshine at strangers −8. Below 0, villagers flee you; at −30 the watch
attacks on sight — and any guard who *witnesses* a killing goes hostile
immediately. Buying the tavern a round of moonshine after dark (+8) is the
one reliable way back into everyone's good graces.

### Buildings burn

Buildings are destructible: boulders crack them, fire catches — flames
spread to close neighbors and gnaw hp until the rain douses them or the
structure collapses into walkable rubble (for the rest of the session).

- **The Wilds** — the big starting stage: five biome zones, enemy dens, a
  goblin camp off the southwest arch, and a stationary **Elder Dragon** to the
  east (practice target: 1M HP, shows live damage readout above the health bar).
- **Willowbrook** — the market-town hub: general store with browsing
  customers (fixed camera inside), **The Gilded Toad** tavern — open all
  night, every night — river dock, and gates to everything else.
- **Willowbrook Farms** — windmills, chickens, cows, and oxen.
- **Hyrmoor Castle Town → Keep → Undercroft** — plaza, then the expanded
  keep: throne hall, royal family (king, queen, two feuding princes, one
  princess plotting her escape), six guards, and **restricted wings** that
  tint the screen red — linger four seconds and the watch turns hostile.
  Below it all, the ghost-ridden dungeon and Griswold, its singing prisoner.
- **The Sapphire Crossing** — a Wind-Waker-scale sea you sail by skiff.
  Sharks hunt between islets; a derelict pirate ship (**The Salty Curse**,
  all ghosts) drifts mid-crossing.
- **Far ports** — Gullrest Isle (crabs on the beach), Arirang Village
  (hanok + rice paddies), Momiji Grove (torii + sakura), Merlion Quay
  (towers + hawker stalls), and the Steamvale hot springs.

Townsfolk wander, chat with each other when they cross paths, and keep
pets: a boy's dog chases off the cat that follows you around (she comes
back when you do), and one villager under a hovering "?" clearly needs
help.

## Co-op (experimental)

Press **O**: one player hosts, the other joins, and you exchange two
copy-paste codes over any chat — WebRTC data channels, no game server. The
host simulates the world; the guest streams position and damage dealt. Travel
follows the host.

**What's synced:**
- Player positions and class
- Enemy locations, type, and HP
- Damage dealt by either player
- Map/stage changes (guest travels with host)

**Known limitations:**
- Summoned entities (cats, projectiles) don't sync — each player sees only what they cast
- NPC interactions and movement are local only
- Spell visuals (beams, explosions) play locally but aren't networked
- Connection uses WebRTC; NAT traversal relies on Google's public STUN server
- Bandwidth is minimal (~1–2 KB/s); works well on localhost, depends on network latency for remote play

## Spell chemistry

- **Combine:** Water+Fire → Steam, Water+Cold → Ice, Steam+Cold → Water, Ice+Fire → Water
- **Opposites annihilate:** Fire↔Cold, Water↔Lightning, Earth↔Lightning, Life↔Arcane, Shield↔Shield
- **Shape priority:** Shield → wall · Earth → boulder · Ice → shard volley · Arcane/Life → beam · fluids → spray · Lightning → arc
- **Statuses:** wet doubles lightning damage · wet+cold freezes · frozen shatters under earth/ice (3×) · fire ignites (unless wet) · duplicates multiply power ×1.7 each

## Project structure

```
/ (repo root = deployed site)
├── index.html              # the game, served at the root URL (generated copy)
├── wiki/                   # static community wiki
└── spellchain/             # the game source
    ├── index.html          # markup only — no inline JS or CSS
    ├── css/style.css
    └── js/
        ├── main.js         # composition root: builds and wires everything
        ├── config.js       # data-driven balance numbers & element chemistry
        ├── core/           # engine plumbing (EventBus, GameLoop, Input,
        │                   #   Camera, AudioManager, DayCycle, math)
        ├── spells/         # queue chemistry, resolver, cast system, strategies
        ├── entities/       # Player, Dummy, Npc (townsfolk + animals),
        │                   #   StatusEffects, projectiles
        ├── systems/        # CombatSystem, EffectsSystem, Reputation
        ├── maps/
        │   ├── MapRegistry.js  # assembles the 16 stages from stages/
        │   ├── builders.js     # shared stage helpers (destructible buildings…)
        │   ├── stages/         # pure data, one module per region:
        │   │                   #   wilds, willowbrook, hyrmoor, sea, ports
        │   └── MapManager.js   # gate travel, fades, collision, respawns,
        │                       #   restricted-area enforcement
        ├── net/Net.js      # experimental WebRTC co-op (host-authoritative)
        ├── classes/        # Mage & Alchemist player classes
        ├── enemies/        # enemy data + AI
        ├── world/World.js  # entity registry, spawning, lifecycle sweep
        └── render/         # Renderer (world) + Hud (overlay, minimap, clock)
```

## Co-op architecture notes

The net layer (`js/net/Net.js`) is intentionally minimal and bandwidth-conscious:
- **Host is authoritative:** it owns the world simulation (enemies, NPCs, gates, destructions)
- **Guest is lightweight:** only self-simulated, reports damage to the host's entities
- **Snapshots, not events:** each frame the host sends a compact `(enemy id, type, x, y, hp)` array; the guest applies diffs
- **No server:** code exchange is manual (paste over chat); WebRTC direct P2P means latency depends on network, not game infrastructure

**To extend syncing** (e.g., add cats, NPCs, projectiles):
- Include new entity types in the host's snapshot message (line 91–99 in `Net.js`)
- Guest applies diffs the same way enemies work: create, update position/state, cull removed
- Bandwidth is still minimal (state snapshots are ~80 bytes, sent 12 times per second)

## Design patterns

| Pattern | Where | Why |
| --- | --- | --- |
| Observer | `core/EventBus.js` | Input, combat, and casting publish events; audio, HUD, and camera shake subscribe — no cross-dependencies. |
| Strategy | `spells/strategies.js` | One class per spell shape; adding a shape means adding a strategy. |
| State | `Channel` classes in `strategies.js` | Channelled spells are stateful objects the `CastSystem` drives until released. |
| Component | `entities/StatusEffects.js` | Timed statuses composed into players, enemies, and net shells. |
| Factory | `World.spawn*`, strategy registry | Centralized creation with lifecycle ownership. |
| Composition root / DI | `js/main.js` | The only module that knows every subsystem. |
| Data-driven config | `config.js`, `MapRegistry.js`, `EnemyRegistry.js` | Balance, stages, monsters, and sounds are data, not logic. |
