import { Player } from '../entities/Player.js';
import { Dummy } from '../entities/Dummy.js';
import { dist2 } from '../core/math.js';

/**
 * Entity registry and per-frame update orchestration. Entities update
 * themselves; the World owns their lifecycles (Factory for spawning,
 * sweep for the dead).
 */
export class World {
  player = new Player();
  /** @type {Dummy[]} */
  dummies = [];
  boulders = [];
  shards = [];
  walls = [];

  spawnDummy(x, y) {
    const dummy = new Dummy(x, y);
    this.dummies.push(dummy);
    return dummy;
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
    this.player.update(dt, ctx);
    for (const d of this.dummies) d.update(dt, ctx);
    this.dummies = this.dummies.filter((d) => !d.dead);
    this.boulders = this.boulders.filter((b) => b.update(dt, ctx));
    this.shards = this.shards.filter((s) => s.update(dt, ctx));
    this.walls = this.walls.filter((w) => w.update(dt, ctx));
  }
}
