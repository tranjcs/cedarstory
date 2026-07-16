import { rnd, clamp, dist2 } from '../core/math.js';
import { StatusEffects } from './StatusEffects.js';

/**
 * Alchemist toolkit entities: thrown flasks, lingering potion zones,
 * linked portals, and summoned cats.
 */

export class PotionFlask {
  constructor(player, aim, potion) {
    const a = Math.atan2(aim.y - player.y, aim.x - player.x);
    const range = clamp(Math.hypot(aim.x - player.x, aim.y - player.y), 60, 420);
    this.x0 = player.x;
    this.y0 = player.y;
    this.x = player.x;
    this.y = player.y;
    this.tx = player.x + Math.cos(a) * range;
    this.ty = player.y + Math.sin(a) * range;
    this.t = 0;
    this.dur = 0.4 + range / 1400;
    this.potion = potion;
  }

  get height() {
    return Math.sin(Math.PI * clamp(this.t, 0, 1)) * 60;
  }

  update(dt, ctx) {
    this.t += dt / this.dur;
    this.x = this.x0 + (this.tx - this.x0) * this.t;
    this.y = this.y0 + (this.ty - this.y0) * this.t;
    if (this.t >= 1) {
      ctx.bus.emit('sfx', { id: 'shatter' });
      ctx.effects.puff(this.tx, this.ty, this.potion.color, 12);
      this.potion.onLand(ctx, this.tx, this.ty);
      return false;
    }
    return true;
  }
}

/**
 * A lingering circle on the ground that ticks an effect on everything
 * inside (players, enemies, cats — alchemy is indiscriminate).
 */
export class Zone {
  /**
   * @param {{x, y, r, ttl, type, color, interval, onTick, decos?}} opts
   */
  constructor(opts) {
    Object.assign(this, opts);
    this.ttl0 = this.ttl;
    this.timer = 0;
  }

  update(dt, ctx) {
    this.ttl -= dt;
    if (this.ttl <= 0) return false;
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = this.interval;
      this.onTick?.(ctx, this);
    }
    return true;
  }

  /** Everything inside the circle. */
  occupants(world) {
    const hits = [];
    for (const list of [world.players, world.enemies, world.npcs, world.cats]) {
      for (const e of list) {
        if (dist2(e.x, e.y, this.x, this.y) < this.r ** 2) hits.push(e);
      }
    }
    return hits;
  }
}

export class Portal {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.ttl = 25;
    this.phase = rnd(0, Math.PI * 2);
  }

  update(dt) {
    this.ttl -= dt;
    this.phase += dt * 3;
    return this.ttl > 0;
  }
}

/**
 * A summoned cat: pounces on the nearest enemy, otherwise pads along
 * beside its alchemist. Enemies only target players, so cats fight with
 * impunity — for a while, then wander off to do cat things.
 */
export class Cat {
  kind = 'cat';

  constructor(x, y, owner) {
    const spread = rnd(60, 140);
    const angle = rnd(0, Math.PI * 2);
    this.x = x + Math.cos(angle) * spread;
    this.y = y + Math.sin(angle) * spread;
    this.owner = owner;
    this.ttl = 14;
    this.facing = rnd(0, Math.PI * 2);
    this.color = ['#f4a261', '#4a4a55', '#e9e5dc'][Math.floor(rnd(0, 3))];
    this.status = new StatusEffects();
    this.portalCd = 0;
    this.#attackCd = 0;
    this.#personality = Math.random(); // 0-1: affects wander behavior
  }

  #attackCd;
  #personality;

  update(dt, ctx) {
    this.ttl -= dt;
    if (this.ttl <= 0) {
      ctx.effects.puff(this.x, this.y - 8, this.color, 8);
      return false;
    }
    this.status.update(dt);
    this.#attackCd = Math.max(0, this.#attackCd - dt);
    const speed = 220 * (this.status.haste > 0 ? 1.5 : 1);

    // nearest enemy within pounce range
    let prey = null, best = 420 ** 2;
    for (const e of ctx.world.enemies) {
      const d = dist2(e.x, e.y, this.x, this.y);
      if (d < best) { best = d; prey = e; }
    }

    if (prey) {
      const dx = prey.x - this.x, dy = prey.y - this.y;
      const dist = Math.hypot(dx, dy) || 1;
      this.facing = Math.atan2(dy, dx);
      if (dist > 24) {
        this.x += (dx / dist) * speed * dt;
        this.y += (dy / dist) * speed * dt;
      } else if (this.#attackCd <= 0) {
        this.#attackCd = 0.8;
        ctx.combat.damageTarget(prey, 7, (dx / dist) * 90, (dy / dist) * 90, true);
        ctx.effects.puff(prey.x, prey.y - 10, this.color, 3);
      }
    } else if (this.owner) {
      const dx = this.owner.x - this.x, dy = this.owner.y - this.y;
      const dist = Math.hypot(dx, dy);
      const wander = this.#personality > 0.5;
      const maxDist = wander ? 120 : 70;
      const moveSpeed = wander ? speed * 0.5 : speed * 0.8;

      if (dist > maxDist) {
        this.facing = Math.atan2(dy, dx);
        this.x += (dx / dist) * moveSpeed * dt;
        this.y += (dy / dist) * moveSpeed * dt;
      } else if (wander && Math.random() < 0.06 * dt) {
        // randomly wander away
        this.facing = rnd(0, Math.PI * 2);
        const wSpeed = speed * 0.3;
        this.x += Math.cos(this.facing) * wSpeed * dt;
        this.y += Math.sin(this.facing) * wSpeed * dt;
      }
    }
    return true;
  }
}
