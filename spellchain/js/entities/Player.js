import { PLAYER } from '../config.js';
import { rnd, angleBetween } from '../core/math.js';
import { StatusEffects } from './StatusEffects.js';

/**
 * The wizard. Moves toward the cursor while LMB is held, dashes with Space,
 * and suffers or enjoys whatever statuses get cast on them.
 */
export class Player {
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  hp = PLAYER.maxHp;
  maxHp = PLAYER.maxHp;
  ward = 0;
  facing = 0;
  walk = 0;
  status = new StatusEffects();

  #dashT = 0;
  #dashCd = 0;
  #dashDx = 0;
  #dashDy = 0;

  get dashCooldown() {
    return this.#dashCd;
  }

  dash(ctx) {
    if (this.#dashCd > 0 || this.status.frozen > 0) return;
    const dx = ctx.aim.x - this.x, dy = ctx.aim.y - this.y;
    const m = Math.hypot(dx, dy) || 1;
    this.#dashDx = dx / m;
    this.#dashDy = dy / m;
    this.#dashT = PLAYER.dash.duration;
    this.#dashCd = PLAYER.dash.cooldown;
    ctx.bus.emit('sfx', { id: 'dash' });
  }

  update(dt, ctx) {
    const { input, aim, effects } = ctx;

    this.status.update(dt);
    this.ward = Math.max(0, this.ward - dt);
    if (this.status.burn > 0) this.hp = Math.max(0, this.hp - PLAYER.burnDps * dt);
    this.hp = Math.min(this.maxHp, this.hp + PLAYER.regenPerSec * dt);

    this.facing = angleBetween(this.x, this.y, aim.x, aim.y);
    this.#dashCd = Math.max(0, this.#dashCd - dt);
    const frozen = this.status.frozen > 0;

    if (this.#dashT > 0) {
      this.#dashT -= dt;
      this.vx = this.#dashDx * PLAYER.dash.speed;
      this.vy = this.#dashDy * PLAYER.dash.speed;
      effects.ghost(this.x, this.y - 8);
    } else {
      let ax = 0, ay = 0;
      const speed = PLAYER.speed
        * (this.status.chill > 0 ? PLAYER.chillSlow : 1)
        * (this.status.wet > 0 ? PLAYER.wetSlow : 1);
      if (input.pointer.left && !frozen) {
        const dx = aim.x - this.x, dy = aim.y - this.y;
        const m = Math.hypot(dx, dy);
        if (m > 8) { ax = (dx / m) * speed; ay = (dy / m) * speed; }
      }
      // snappy steering toward the desired velocity
      this.vx += (ax - this.vx) * Math.min(1, PLAYER.accel * dt);
      this.vy += (ay - this.vy) * Math.min(1, PLAYER.accel * dt);
      if (frozen) { this.vx = 0; this.vy = 0; }
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    const moving = Math.hypot(this.vx, this.vy) > 30;
    this.walk += (moving ? Math.hypot(this.vx, this.vy) * 0.045 : 0) * dt * 60;

    // ambient status particles
    if (this.status.burn > 0 && Math.random() < 0.5) {
      effects.add({
        x: this.x + rnd(-8, 8), y: this.y - rnd(10, 34),
        vx: rnd(-12, 12), vy: -rnd(50, 90),
        life: 0.4, max: 0.4, c: '#fb923c', r: rnd(2, 4), add: true,
      });
    }
    if (this.status.wet > 0 && Math.random() < 0.1) {
      effects.add({
        x: this.x + rnd(-8, 8), y: this.y - rnd(0, 20),
        vx: 0, vy: 60, life: 0.4, max: 0.4, c: '#38bdf8', r: 2,
      });
    }
  }
}
