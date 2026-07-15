import { ENEMY_TYPES } from './EnemyRegistry.js';
import { rnd } from '../core/math.js';
import { StatusEffects } from '../entities/StatusEffects.js';

/**
 * A hostile creature. Wanders idly, chases the closest player inside its
 * aggro radius, and telegraphs melee attacks with a windup flash. Shares
 * the StatusEffects component with everything else, so spells and potions
 * (wet, burn, freeze, poison, confusion, haste) all work on it.
 */
export class Enemy {
  kind = 'enemy';

  constructor(type, x, y) {
    const spec = ENEMY_TYPES[type];
    this.type = type;
    this.spec = spec;
    this.x = x;
    this.y = y;
    this.hp = spec.hp;
    this.maxHp = spec.hp;
    this.resist = spec.resist;
    this.undead = Boolean(spec.undead);
    this.poisonImmune = Boolean(spec.poisonImmune);
    this.weaponHeld = Boolean(spec.weapon);
    this.status = new StatusEffects();
    this.kx = 0;
    this.ky = 0;
    this.flash = 0;
    this.wobble = 0;
    this.dead = false;
    this.facing = rnd(0, Math.PI * 2);
    this.portalCd = 0;
    this.#wanderAngle = rnd(0, Math.PI * 2);
    this.#wanderTimer = rnd(0, 2);
    this.#attackCd = rnd(0, 0.5);
  }

  #wanderAngle;
  #wanderTimer;
  #attackCd;
  #windup = 0;

  /** Losing your weapon hurts: melee drops to fist damage. */
  get meleeDamage() {
    const base = this.spec.melee.dmg;
    return this.spec.weapon && !this.weaponHeld ? base * 0.35 : base;
  }

  dropWeapon(ctx) {
    if (!this.spec.weapon || !this.weaponHeld) return;
    this.weaponHeld = false;
    ctx.effects.floatText(this.x, this.y - 52, 'DISARMED', '#fde047');
    ctx.world.droppedWeapons.push({
      x: this.x + rnd(-24, 24), y: this.y + rnd(8, 26),
      weapon: this.spec.weapon, a: rnd(0, Math.PI * 2), t: 8,
    });
    ctx.bus.emit('sfx', { id: 'disarm' });
  }

  update(dt, ctx) {
    this.status.update(dt);
    this.flash = Math.max(0, this.flash - dt);
    this.wobble = Math.max(0, this.wobble - dt);
    this.#attackCd = Math.max(0, this.#attackCd - dt);

    // knockback slide
    this.x += this.kx * dt;
    this.y += this.ky * dt;
    this.kx *= Math.pow(0.001, dt);
    this.ky *= Math.pow(0.001, dt);

    if (this.status.frozen > 0) { this.#windup = 0; return; }

    const target = ctx.world.closestPlayer(this.x, this.y);
    if (!target) return;
    const dx = target.x - this.x, dy = target.y - this.y;
    const dist = Math.hypot(dx, dy);
    const spec = this.spec;
    let speed = spec.speed
      * (this.status.chill > 0 ? 0.45 : 1)
      * (this.status.haste > 0 ? 1.5 : 1);
    // confusion: walk the opposite way
    const dir = this.status.confusion > 0 ? -1 : 1;

    if (this.#windup > 0) {
      // committed to a swing — resolve it
      this.#windup -= dt;
      if (this.#windup <= 0) {
        if (dist < spec.melee.range + 14) {
          ctx.combat.hurtPlayer(target, this.meleeDamage, ctx);
          if (spec.melee.burn) target.status.burn = 3;
          if (spec.melee.poison) target.status.poison = 4;
          const m = dist || 1;
          target.vx += (dx / m) * 250;
          target.vy += (dy / m) * 250;
        }
        this.#attackCd = spec.melee.cd;
      }
    } else if (dist < spec.aggro) {
      this.facing = Math.atan2(dy * dir, dx * dir);
      if (dist > spec.melee.range * 0.8) {
        const m = dist || 1;
        this.x += (dx / m) * speed * dir * dt;
        this.y += (dy / m) * speed * dir * dt;
      } else if (this.#attackCd <= 0) {
        this.#windup = spec.melee.windup;
        this.flash = spec.melee.windup; // telegraph
      }
    } else {
      // idle wander
      this.#wanderTimer -= dt;
      if (this.#wanderTimer <= 0) {
        this.#wanderTimer = rnd(1.5, 4);
        this.#wanderAngle = rnd(0, Math.PI * 2);
      }
      this.facing = this.#wanderAngle;
      this.x += Math.cos(this.#wanderAngle) * speed * 0.25 * dt;
      this.y += Math.sin(this.#wanderAngle) * speed * 0.25 * dt;
    }
  }

  get windingUp() {
    return this.#windup > 0;
  }
}
