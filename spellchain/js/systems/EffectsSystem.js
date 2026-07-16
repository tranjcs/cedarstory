import { PARTICLE_CAP } from '../config.js';
import { rnd, dist2, TAU } from '../core/math.js';

/**
 * All transient visual effects: particles (including damaging spray
 * droplets), floating combat text, expanding rings, and lightning bolts.
 * The renderer reads these arrays; nothing here draws.
 */
export class EffectsSystem {
  particles = [];
  floaters = [];
  rings = [];
  bolts = [];

  /** Low-level particle push; helpers below cover the common shapes. */
  add(particle) {
    this.particles.push(particle);
  }

  puff(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = rnd(0, TAU), speed = rnd(30, 160);
      this.add({
        x, y,
        vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - 40,
        life: rnd(0.3, 0.7), max: 0.7, c: color, r: rnd(2, 4.5),
      });
    }
  }

  /** Dash afterimage. */
  ghost(x, y) {
    this.add({ x, y, vx: 0, vy: 0, life: 0.25, max: 0.25, c: '#a5b4fc', r: 9, ghost: true });
  }

  floatText(x, y, txt, color) {
    this.floaters.push({ x, y, txt, c: color, t: 1 });
  }

  ring(x, y, r, maxr, t, color) {
    this.rings.push({ x, y, r, maxr, t, c: color });
  }

  bolt(x1, y1, x2, y2, t) {
    this.bolts.push({ x1, y1, x2, y2, t });
  }

  update(dt, ctx) {
    // particles (spray droplets carry damage and collide)
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.pow(0.05, dt);
      p.vy *= Math.pow(0.05, dt);
      if (p.spray) {
        if (ctx.world.wallBlock(p.x, p.y, 6) || ctx.world.buildingBlock(ctx, p.x, p.y, p.spray)) {
          this.particles.splice(i, 1);
          continue;
        }
        for (const d of ctx.world.combatTargets.slice()) {
          if (dist2(d.x, d.y, p.x, p.y) < 24 ** 2) {
            ctx.combat.applyElements(d, [p.spray], {
              mult: 0.22, kx: p.vx * 0.12, ky: p.vy * 0.12, quiet: true,
            }, ctx);
            this.particles.splice(i, 1);
            break;
          }
        }
      }
    }
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.t -= dt;
      f.y -= 40 * dt;
      if (f.t <= 0) this.floaters.splice(i, 1);
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.t -= dt;
      r.r += (r.maxr - r.r) * Math.min(1, 14 * dt);
      if (r.t <= 0) this.rings.splice(i, 1);
    }
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      this.bolts[i].t -= dt;
      if (this.bolts[i].t <= 0) this.bolts.splice(i, 1);
    }
    if (this.particles.length > PARTICLE_CAP) {
      this.particles.splice(0, this.particles.length - PARTICLE_CAP);
    }
  }
}
