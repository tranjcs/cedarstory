import { PLAYER, DOTS } from '../config.js';
import { rnd, angleBetween } from '../core/math.js';
import { StatusEffects } from './StatusEffects.js';

/**
 * A wizard. Moves toward the cursor while LMB is held, dashes with Space,
 * and suffers or enjoys whatever statuses get cast on them — including
 * reversed controls while confused. Dropping to zero HP means a knockdown
 * and a shaky second wind, not a game over.
 */
export class Player {
  kind = 'player';
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  hp = PLAYER.maxHp;
  maxHp = PLAYER.maxHp;
  ward = 0;
  facing = 0;
  walk = 0;
  portalCd = 0;
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
    if (this.status.poison > 0) this.hp = Math.max(0, this.hp - DOTS.poisonDps * dt);
    this.hp = Math.min(this.maxHp, this.hp + PLAYER.regenPerSec * dt);
    if (this.hp <= 0) this.#secondWind(ctx);

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
        * (this.status.wet > 0 ? PLAYER.wetSlow : 1)
        * (this.status.haste > 0 ? 1.5 : 1);
      if (input.pointer.left && !frozen) {
        const dx = aim.x - this.x, dy = aim.y - this.y;
        const m = Math.hypot(dx, dy);
        if (m > 8) { ax = (dx / m) * speed; ay = (dy / m) * speed; }
      }
      // moonshine: controls in reverse
      if (this.status.confusion > 0) { ax = -ax; ay = -ay; }
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
    if (this.status.poison > 0 && Math.random() < 0.15) {
      effects.add({
        x: this.x + rnd(-8, 8), y: this.y - rnd(0, 26),
        vx: rnd(-8, 8), vy: -rnd(20, 50),
        life: 0.5, max: 0.5, c: '#a3e635', r: 2.5, add: true,
      });
    }
  }

  /** Knocked out: stagger back up with a brief ward, scatter attackers. */
  #secondWind(ctx) {
    this.hp = this.maxHp * 0.6;
    this.ward = 3;
    this.status.reset();
    ctx.bus.emit('announce', { text: 'Knocked down! Second wind...' });
    ctx.bus.emit('sfx', { id: 'down' });
    ctx.effects.puff(this.x, this.y - 10, '#f87171', 20);
    ctx.camera.addShake(10);
    for (const e of ctx.world.enemies) {
      const dx = e.x - this.x, dy = e.y - this.y;
      const d = Math.hypot(dx, dy);
      if (d < 260) {
        e.kx += (dx / (d || 1)) * 420;
        e.ky += (dy / (d || 1)) * 420;
      }
    }
  }
}
