import { ELEMENTS } from '../config.js';
import { rnd, clamp, dist2 } from '../core/math.js';
import { countElements } from '../spells/SpellResolver.js';

/**
 * Spell projectiles and barriers. Each has update(dt, ctx) returning
 * whether it is still alive; World sweeps the dead ones.
 */

export class Boulder {
  constructor(player, aim, elements) {
    const a = Math.atan2(aim.y - player.y, aim.x - player.x);
    const range = clamp(Math.hypot(aim.x - player.x, aim.y - player.y), 90, 460);
    this.x0 = player.x;
    this.y0 = player.y;
    this.x = player.x + Math.cos(a) * 24;
    this.y = player.y + Math.sin(a) * 24;
    this.tx = player.x + Math.cos(a) * range;
    this.ty = player.y + Math.sin(a) * range;
    this.t = 0;
    this.dur = 0.55 + range / 1200;
    this.els = elements;
  }

  /** Apparent height of the lobbed arc, for rendering. */
  get height() {
    return Math.sin(Math.PI * clamp(this.t, 0, 1)) * 90;
  }

  update(dt, ctx) {
    this.t += dt / this.dur;
    this.x = this.x0 + (this.tx - this.x0) * this.t;
    this.y = this.y0 + (this.ty - this.y0) * this.t;
    if (Math.random() < 0.5) {
      ctx.effects.add({
        x: this.x, y: this.y - this.height,
        vx: rnd(-20, 20), vy: rnd(-20, 20),
        life: 0.3, max: 0.3, c: '#78716c', r: 3,
      });
    }
    if (this.t >= 1) {
      this.#impact(ctx);
      return false;
    }
    return true;
  }

  #impact(ctx) {
    const { world, combat, effects, camera, bus } = ctx;
    const counts = countElements(this.els);
    const radius = counts.fire ? 120 : 70;
    effects.ring(this.tx, this.ty, 8, radius, 0.3, counts.fire ? ELEMENTS.fire.color : ELEMENTS.earth.color);
    effects.puff(this.tx, this.ty, counts.fire ? '#fb923c' : '#a8a29e', counts.fire ? 24 : 14);
    bus.emit('sfx', { id: 'boulderImpact' });
    camera.addShake(counts.fire ? 10 : 6);
    for (const d of world.enemies.slice()) {
      const dd = Math.hypot(d.x - this.tx, d.y - this.ty);
      if (dd < radius + 16) {
        const a = Math.atan2(d.y - this.ty, d.x - this.tx);
        combat.applyElements(d, this.els, { kx: Math.cos(a) * 380, ky: Math.sin(a) * 380 }, ctx);
      }
    }
  }
}

export class Shard {
  constructor(x, y, vx, vy, elements) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.life = 0.8;
    this.els = elements;
  }

  update(dt, ctx) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    if (this.life <= 0) return false;
    if (ctx.world.wallBlock(this.x, this.y, 6)) {
      ctx.effects.puff(this.x, this.y, ELEMENTS.ice.color, 4);
      return false;
    }
    for (const d of ctx.world.enemies.slice()) {
      if (dist2(d.x, d.y, this.x, this.y) < 22 ** 2) {
        ctx.combat.applyElements(d, this.els, {
          mult: 0.5, kx: this.vx * 0.25, ky: this.vy * 0.25, quiet: true,
        }, ctx);
        ctx.effects.puff(this.x, this.y, ELEMENTS.ice.color, 5);
        return false;
      }
    }
    return true;
  }
}

export class Wall {
  /**
   * @param {{x: number, y: number, hp: number}[]} nodes
   * @param {boolean} rock  earth-infused walls are sturdier and drawn as stone
   * @param {string[]} imbue elements that zap anything touching the barrier
   */
  constructor(nodes, rock, imbue) {
    this.nodes = nodes;
    this.rock = rock;
    this.imbue = imbue;
    this.t = 9;
  }

  update(dt, ctx) {
    this.t -= dt;
    this.nodes = this.nodes.filter((n) => n.hp > 0);
    if (this.t <= 0 || this.nodes.length === 0) {
      for (const n of this.nodes) {
        ctx.effects.puff(n.x, n.y, this.rock ? '#a8a29e' : ELEMENTS.shield.color, 5);
      }
      return false;
    }
    if (this.imbue.length) {
      for (const n of this.nodes) {
        for (const d of ctx.world.enemies.slice()) {
          if (dist2(d.x, d.y, n.x, n.y) < 34 ** 2 && Math.random() < 8 * dt) {
            ctx.combat.applyElements(d, this.imbue, {
              mult: 0.5, kx: (d.x - n.x) * 6, ky: (d.y - n.y) * 6, quiet: true,
            }, ctx);
          }
        }
      }
    }
    return true;
  }
}
