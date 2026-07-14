import { DUMMY } from '../config.js';
import { rnd } from '../core/math.js';
import { StatusEffects } from './StatusEffects.js';

/**
 * A training dummy: soaks damage, slides from knockback, shows statuses,
 * and burns down if set alight.
 */
export class Dummy {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.hp = DUMMY.maxHp;
    this.maxHp = DUMMY.maxHp;
    this.kx = 0;
    this.ky = 0;
    this.flash = 0;
    this.wobble = 0;
    this.dead = false;
    this.status = new StatusEffects();
  }

  update(dt, ctx) {
    this.status.update(dt);
    this.flash = Math.max(0, this.flash - dt);
    this.wobble = Math.max(0, this.wobble - dt);

    if (this.status.burn > 0) {
      this.hp -= DUMMY.burnDps * dt;
      if (Math.random() < 12 * dt) {
        ctx.effects.add({
          x: this.x + rnd(-8, 8), y: this.y - rnd(5, 30),
          vx: rnd(-15, 15), vy: -rnd(40, 90),
          life: 0.5, max: 0.5, c: '#fb923c', r: rnd(2, 4),
        });
      }
      if (this.hp <= 0) ctx.combat.killDummy(this);
    }

    // knockback slide with heavy friction
    this.x += this.kx * dt;
    this.y += this.ky * dt;
    this.kx *= Math.pow(0.001, dt);
    this.ky *= Math.pow(0.001, dt);
  }
}
