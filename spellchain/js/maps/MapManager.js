import { clamp, dist2 } from '../core/math.js';
import { MAPS, OVERWORLD_GATE } from './MapRegistry.js';

const FADE_TIME = 0.4;

/**
 * Owns which map the party is on ('overworld' or a fixed map from the
 * registry) and everything that follows from that: gate triggers, the
 * fade-to-black travel transition, and collision against fixed-map
 * buildings and bounds. The infinite overworld has no colliders; fixed
 * maps have no chunk generation — main.js gates ChunkManager on
 * `isOverworld`.
 */
export class MapManager {
  currentId = 'overworld';
  #transition = null; // { phase: 'out' | 'in', t, gate }
  #gateCd = 0;        // grace period so arrivals don't instantly re-trigger

  get isOverworld() {
    return this.currentId === 'overworld';
  }

  /** Current fixed map object, or null on the overworld. */
  get current() {
    return this.isOverworld ? null : MAPS[this.currentId];
  }

  get locationName() {
    return this.current?.name ?? null;
  }

  /** 0..1 black overlay for the travel fade. */
  get fadeAlpha() {
    if (!this.#transition) return 0;
    const t = this.#transition.t / FADE_TIME;
    return this.#transition.phase === 'out' ? Math.min(1, t) : Math.max(0, 1 - t);
  }

  /** Gates active on the current map (the overworld has exactly one). */
  gates() {
    return this.isOverworld ? [OVERWORLD_GATE] : this.current.gates;
  }

  update(dt, ctx) {
    this.#gateCd = Math.max(0, this.#gateCd - dt);
    if (this.#transition) this.#advanceTransition(dt, ctx);
    else if (this.#gateCd === 0) this.#checkGates(ctx);

    const map = this.current;
    if (map) {
      for (const e of [...ctx.world.players, ...ctx.world.enemies, ...ctx.world.cats]) {
        this.#collide(e, map);
      }
    }
  }

  #checkGates(ctx) {
    const player = ctx.world.player;
    for (const gate of this.gates()) {
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

  /** Executed at full black: swap maps, move the party, reset transients. */
  #arrive(gate, ctx) {
    const world = ctx.world;
    // spawned creatures and lingering magic stay behind — each map keeps
    // its own coordinate space, so nothing may carry stale positions over
    world.enemies = [];
    world.cats = [];
    world.boulders = [];
    world.shards = [];
    world.walls = [];
    world.flasks = [];
    world.zones = [];
    world.portals = [];
    world.trailFlowers = [];
    world.droppedWeapons = [];

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
    ctx.bus.emit('announce', { text: map ? map.name : 'The Wilds' });
    if (map) {
      for (const s of map.spawns) world.spawnEnemy(s.type, s.x, s.y);
    }
  }

  /** Keep an entity inside bounds and out of building footprints. */
  #collide(e, map) {
    const r = e.spec?.radius ?? 13;
    const pad = r + (map.walled ? 22 : 0);
    e.x = clamp(e.x, pad, map.w - pad);
    e.y = clamp(e.y, pad, map.h - pad);
    for (const c of map.colliders) {
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
