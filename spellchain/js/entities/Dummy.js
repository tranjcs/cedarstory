import { DUMMY } from '../config.js';
import { StatusEffects } from './StatusEffects.js';

/**
 * A training dummy: soaks damage, slides from knockback, and shows status
 * effects. Lives in the same enemies list as real hostiles so every spell
 * and potion treats it like any other target (burn/poison ticking happens
 * centrally in World).
 */
export class Dummy {
  kind = 'dummy';

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
    this.undead = false;
    this.resist = {};
    this.portalCd = 0;
    this.status = new StatusEffects();
  }

  update(dt) {
    this.status.update(dt);
    this.flash = Math.max(0, this.flash - dt);
    this.wobble = Math.max(0, this.wobble - dt);
    // knockback slide with heavy friction
    this.x += this.kx * dt;
    this.y += this.ky * dt;
    this.kx *= Math.pow(0.001, dt);
    this.ky *= Math.pow(0.001, dt);
  }
}
