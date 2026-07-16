import { clamp, dist2 } from '../core/math.js';
import { MAPS, START_MAP } from './MapRegistry.js';

const FADE_TIME = 0.4;

/**
 * Owns which stage the party is on and everything that follows from that:
 * gate triggers, the fade-to-black travel transition, collision against
 * buildings and stage bounds, and trickle-respawns on stages that want
 * them. Every place in the game is a finite map from the registry.
 */
export class MapManager {
  currentId = START_MAP;
  /** Seconds the player has spent inside a restricted area (0 = outside). */
  restrictedT = 0;
  #transition = null; // { phase: 'out' | 'in', t, gate }
  #gateCd = 0;        // grace period so arrivals don't instantly re-trigger
  #respawnT = 0;

  get current() {
    return MAPS[this.currentId];
  }

  get locationName() {
    return this.current.name;
  }

  /** 0..1 black overlay for the travel fade. */
  get fadeAlpha() {
    if (!this.#transition) return 0;
    const t = this.#transition.t / FADE_TIME;
    return this.#transition.phase === 'out' ? Math.min(1, t) : Math.max(0, 1 - t);
  }

  /** Place the party at the starting map's spawn and populate it. */
  init(ctx) {
    const map = this.current;
    for (const p of ctx.world.players) {
      p.x = map.start.x;
      p.y = map.start.y;
    }
    ctx.camera.snap(map.start.x, map.start.y);
    this.#populate(ctx.world, map);
  }

  update(dt, ctx) {
    this.#gateCd = Math.max(0, this.#gateCd - dt);
    // co-op guests travel with the host and don't run spawn logic
    const guest = ctx.net?.isGuest;
    if (this.#transition) this.#advanceTransition(dt, ctx);
    else if (!guest) {
      if (this.#gateCd === 0) this.#checkGates(ctx);
      this.#trickleRespawn(dt, ctx);
    }

    const map = this.current;
    for (const e of [...ctx.world.players, ...ctx.world.enemies, ...ctx.world.npcs, ...ctx.world.cats]) {
      this.#collide(e, map);
    }
    this.#watchRestricted(dt, ctx, map);
  }

  /**
   * Restricted wings: the screen reddens as a warning while you're inside;
   * linger too long and the watch is called (see Reputation.trespass).
   */
  #watchRestricted(dt, ctx, map) {
    const p = ctx.world.player;
    let inside = false;
    for (const r of map.restricted ?? []) {
      if (p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h) {
        inside = true;
        break;
      }
    }
    this.restrictedT = inside
      ? this.restrictedT + dt
      : Math.max(0, this.restrictedT - dt * 2);
    if (this.restrictedT > 4) {
      this.restrictedT = 0;
      ctx.reputation?.trespass(ctx);
    }
  }

  #checkGates(ctx) {
    const player = ctx.world.player;
    for (const gate of this.current.gates) {
      if (dist2(player.x, player.y, gate.x, gate.y) >= gate.r ** 2) continue;
      if (gate.locked) {
        ctx.bus.emit('announce', { text: gate.message });
        this.#gateCd = 2.5;
      } else {
        this.#transition = { phase: 'out', t: 0, gate };
        ctx.bus.emit('sfx', { id: 'teleport' });
      }
      break;
    }
  }

  #advanceTransition(dt, ctx) {
    const tr = this.#transition;
    tr.t += dt;
    if (tr.t < FADE_TIME) return;
    if (tr.phase === 'out') {
      this.#arrive(tr.gate, ctx);
      tr.phase = 'in';
      tr.t = 0;
    } else {
      this.#transition = null;
    }
  }

  /** Follow the host to a new map (co-op guests skip gates entirely). */
  netTravel(mapId, x, y, ctx) {
    this.#clearTransients(ctx.world);
    this.currentId = mapId;
    for (const p of ctx.world.players) {
      if (p.remote) continue;
      p.x = x; p.y = y; p.vx = 0; p.vy = 0;
    }
    ctx.camera.snap(x, y);
    this.#gateCd = 1.2;
    const map = this.current;
    ctx.bus.emit('announce', { text: map.name });
    for (const def of map.npcs ?? []) ctx.world.spawnNpc(def);
  }

  /** Creatures and lingering magic stay behind — each map keeps its own
   *  coordinate space, so nothing may carry stale positions over. */
  #clearTransients(world) {
    world.enemies = [];
    world.npcs = [];
    world.cats = [];
    world.boulders = [];
    world.shards = [];
    world.walls = [];
    world.flasks = [];
    world.zones = [];
    world.portals = [];
    world.trailFlowers = [];
    world.droppedWeapons = [];
  }

  /** Executed at full black: swap maps, move the party, reset transients. */
  #arrive(gate, ctx) {
    const world = ctx.world;
    this.#clearTransients(world);
    this.currentId = gate.target;
    for (const p of world.players) {
      p.x = gate.tx;
      p.y = gate.ty;
      p.vx = 0;
      p.vy = 0;
    }
    ctx.camera.snap(gate.tx, gate.ty);
    this.#gateCd = 1.2;

    const map = this.current;
    ctx.bus.emit('announce', { text: map.name });
    this.#populate(world, map);
  }

  #populate(world, map) {
    for (const s of map.spawns) world.spawnEnemy(s.type, s.x, s.y);
    for (const d of map.dummies ?? []) world.spawnDummy(d.x, d.y);
    for (const def of map.npcs ?? []) world.spawnNpc(def);
    this.#respawnT = map.respawn?.interval ?? 0;
  }

  /**
   * Stages with a respawn config refill from their spawn list in waves —
   * every `interval` seconds (10 minutes by default). At night the clock
   * runs twice as fast: monster spawn rates are doubled after dark.
   */
  #trickleRespawn(dt, ctx) {
    const map = this.current;
    if (!map.respawn || !map.spawns.length) return;
    this.#respawnT -= dt * (ctx.daycycle?.isNight ? 2 : 1);
    if (this.#respawnT > 0) return;
    this.#respawnT = map.respawn.interval;

    const world = ctx.world;
    let live = world.enemies.filter((e) => e.kind === 'enemy').length;
    const p = world.player;
    // shuffled so the same dens don't always win the refill
    const defs = [...map.spawns].sort(() => Math.random() - 0.5);
    for (const s of defs) {
      if (live >= map.respawn.cap) break;
      if (s.once) continue; // bosses only spawn on stage entry
      if (dist2(s.x, s.y, p.x, p.y) < map.respawn.minDist ** 2) continue;
      world.spawnEnemy(s.type, s.x, s.y);
      live++;
    }
  }

  /** Keep an entity inside bounds and out of building footprints. */
  #collide(e, map) {
    const r = e.spec?.radius ?? 13;
    const pad = r + (map.walled ? 22 : 0);
    e.x = clamp(e.x, pad, map.w - pad);
    e.y = clamp(e.y, pad, map.h - pad);
    for (const c of map.colliders) {
      if (c.b?.destroyed) continue; // rubble doesn't block anyone
      const nx = clamp(e.x, c.x, c.x + c.w);
      const ny = clamp(e.y, c.y, c.y + c.h);
      const dx = e.x - nx, dy = e.y - ny;
      const d2 = dx * dx + dy * dy;
      if (d2 >= r * r) continue;
      if (d2 > 1e-4) {
        const d = Math.sqrt(d2);
        e.x = nx + (dx / d) * r;
        e.y = ny + (dy / d) * r;
      } else {
        // fully inside: escape through the nearest face
        const left = e.x - c.x, right = c.x + c.w - e.x;
        const top = e.y - c.y, bottom = c.y + c.h - e.y;
        const m = Math.min(left, right, top, bottom);
        if (m === left) e.x = c.x - r;
        else if (m === right) e.x = c.x + c.w + r;
        else if (m === top) e.y = c.y - r;
        else e.y = c.y + c.h + r;
      }
    }
  }
}
