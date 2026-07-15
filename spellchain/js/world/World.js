import { Player } from '../entities/Player.js';
import { Dummy } from '../entities/Dummy.js';
import { Enemy } from '../enemies/Enemy.js';
import { DOTS } from '../config.js';
import { dist2, rnd } from '../core/math.js';

/**
 * Entity registry and per-frame update orchestration. Entities update
 * themselves; the World owns their lifecycles (Factory for spawning,
 * sweep for the dead) plus the cross-entity rules: damage-over-time,
 * poison contagion, and portal travel.
 *
 * `players` is an array from day one so enemies can target the closest
 * player when more join later.
 */
export class World {
  players = [new Player()];
  /** Hostiles and training dummies together — all combat targets. */
  enemies = [];
  cats = [];
  boulders = [];
  shards = [];
  walls = [];
  flasks = [];
  zones = [];
  portals = [];
  trailFlowers = [];
  droppedWeapons = [];

  /** Primary player — keeps single-player call sites simple. */
  get player() {
    return this.players[0];
  }

  spawnDummy(x, y) {
    const dummy = new Dummy(x, y);
    this.enemies.push(dummy);
    return dummy;
  }

  spawnEnemy(type, x, y) {
    const enemy = new Enemy(type, x, y);
    this.enemies.push(enemy);
    return enemy;
  }

  closestPlayer(x, y) {
    let best = null, bestDist = Infinity;
    for (const p of this.players) {
      const d = dist2(p.x, p.y, x, y);
      if (d < bestDist) { bestDist = d; best = p; }
    }
    return best;
  }

  /**
   * Whether a point (with radius) hits a barrier node; chips the node on
   * contact. Used by projectiles and spray droplets.
   */
  wallBlock(x, y, r) {
    for (const w of this.walls) {
      for (const n of w.nodes) {
        if (dist2(x, y, n.x, n.y) < (16 + r) ** 2) {
          n.hp -= 12;
          return true;
        }
      }
    }
    return false;
  }

  update(dt, ctx) {
    for (const p of this.players) p.update(dt, ctx);
    for (const e of this.enemies) e.update(dt, ctx);
    this.#damageOverTime(dt, ctx);
    this.#poisonContagion(dt, ctx);
    this.#separateEnemies(dt);
    this.enemies = this.enemies.filter((e) => !e.dead);
    this.cats = this.cats.filter((c) => c.update(dt, ctx));
    this.boulders = this.boulders.filter((b) => b.update(dt, ctx));
    this.shards = this.shards.filter((s) => s.update(dt, ctx));
    this.walls = this.walls.filter((w) => w.update(dt, ctx));
    this.flasks = this.flasks.filter((f) => f.update(dt, ctx));
    this.zones = this.zones.filter((z) => z.update(dt, ctx));
    this.portals = this.portals.filter((p) => p.update(dt));
    this.#portalTravel(dt, ctx);
    for (const f of this.trailFlowers) f.ttl -= dt;
    this.trailFlowers = this.trailFlowers.filter((f) => f.ttl > 0);
    for (const w of this.droppedWeapons) w.t -= dt;
    this.droppedWeapons = this.droppedWeapons.filter((w) => w.t > 0);
  }

  /** Burn and poison tick centrally so dummies and enemies share rules. */
  #damageOverTime(dt, ctx) {
    for (const e of this.enemies) {
      if (e.dead) continue;
      let dot = 0;
      if (e.status.burn > 0) {
        dot += DOTS.burnDps;
        if (Math.random() < 12 * dt) {
          ctx.effects.add({
            x: e.x + rnd(-8, 8), y: e.y - rnd(5, 30),
            vx: rnd(-15, 15), vy: -rnd(40, 90),
            life: 0.5, max: 0.5, c: '#fb923c', r: rnd(2, 4),
          });
        }
      }
      if (e.status.poison > 0 && !e.poisonImmune) {
        dot += DOTS.poisonDps;
        if (Math.random() < 6 * dt) {
          ctx.effects.add({
            x: e.x + rnd(-10, 10), y: e.y - rnd(0, 26),
            vx: rnd(-8, 8), vy: -rnd(20, 50),
            life: 0.6, max: 0.6, c: '#a3e635', r: rnd(2, 3.5), add: true,
          });
        }
      }
      if (dot > 0) {
        e.hp -= dot * dt;
        if (e.hp <= 0) ctx.combat.killTarget(e);
      }
    }
  }

  /** Poison is infectious: victims pass it to nearby targets. */
  #poisonContagion(dt, ctx) {
    for (const e of this.enemies) {
      if (e.status.poison <= 0 || e.poisonImmune) continue;
      e.spreadTimer = (e.spreadTimer ?? DOTS.poisonSpreadInterval) - dt;
      if (e.spreadTimer > 0) continue;
      e.spreadTimer = DOTS.poisonSpreadInterval;
      for (const other of this.enemies) {
        if (other === e || other.poisonImmune || other.status.poison > 0) continue;
        if (dist2(other.x, other.y, e.x, e.y) < DOTS.poisonSpreadRadius ** 2 && Math.random() < 0.7) {
          other.status.poison = 4;
          ctx.effects.floatText(other.x, other.y - 56, 'INFECTED', '#a3e635');
        }
      }
    }
  }

  /** Gentle push so chasing enemies don't stack into one blob. */
  #separateEnemies(dt) {
    for (let i = 0; i < this.enemies.length; i++) {
      for (let j = i + 1; j < this.enemies.length; j++) {
        const a = this.enemies[i], b = this.enemies[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d > 0 && d < 26) {
          const push = (26 - d) * 2 * dt;
          a.x -= (dx / d) * push; a.y -= (dy / d) * push;
          b.x += (dx / d) * push; b.y += (dy / d) * push;
        }
      }
    }
  }

  /** With two portals open, anything touching one pops out of the other. */
  #portalTravel(dt, ctx) {
    const travellers = [...this.players, ...this.enemies, ...this.cats];
    for (const t of travellers) t.portalCd = Math.max(0, (t.portalCd ?? 0) - dt);
    if (this.portals.length !== 2) return;
    for (const t of travellers) {
      if (t.portalCd > 0) continue;
      for (let i = 0; i < 2; i++) {
        if (dist2(t.x, t.y, this.portals[i].x, this.portals[i].y) < 26 ** 2) {
          const exit = this.portals[1 - i];
          ctx.effects.puff(t.x, t.y - 10, '#38bdf8', 10);
          t.x = exit.x + rnd(-10, 10);
          t.y = exit.y + 34;
          t.portalCd = 1.2;
          ctx.effects.puff(t.x, t.y - 10, '#38bdf8', 10);
          ctx.bus.emit('sfx', { id: 'teleport' });
          break;
        }
      }
    }
  }
}
