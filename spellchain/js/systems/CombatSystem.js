import { ELEMENTS } from '../config.js';
import { rnd, dist2 } from '../core/math.js';
import { countElements, duplicatePower } from '../spells/SpellResolver.js';

/**
 * Applies element packets to targets: raw damage (scaled by the target's
 * per-element resistances), status interplay (wet doubles lightning,
 * wet+cold freezes, frozen shatters under earth/ice), knockback, healing
 * (which sears the undead), and chain lightning.
 */
export class CombatSystem {
  constructor(bus, effects) {
    this.bus = bus;
    this.effects = effects;
  }

  /**
   * @param {object} d target (enemy or dummy)
   * @param {string[]} elements
   * @param {{mult?: number, kx?: number, ky?: number, quiet?: boolean}} opts
   * @param {object} ctx shared frame context (needs world for chaining)
   */
  applyElements(d, elements, opts = {}, ctx) {
    const { mult = 1, kx = 0, ky = 0, quiet = false } = opts;
    const counts = countElements(elements);

    let dmg = 0;
    for (const name of Object.keys(counts)) {
      if (name === 'life' || name === 'shield') continue;
      let base = ELEMENTS[name].damage * duplicatePower(elements, name);
      base *= d.resist?.[name] ?? 1;
      if (name === 'lightning' && d.status.wet > 0) base *= 2;
      if ((name === 'earth' || name === 'ice') && d.status.frozen > 0) {
        base *= 3;
        d.status.frozen = 0;
        this.effects.floatText(d.x, d.y - 66, 'SHATTER', '#a5f3fc');
      }
      dmg += base;
    }
    dmg *= mult;

    // status interplay — order matters (water wets before fire checks it)
    if (counts.water || counts.steam) { d.status.wet = 6; d.status.burn = 0; }
    if (counts.fire) {
      if (d.status.wet > 0) { d.status.wet = 0; dmg *= 0.6; }
      else if ((d.resist?.fire ?? 1) > 0) d.status.burn = 4;
      d.status.chill = 0;
      d.status.frozen = 0;
    }
    if (counts.cold) {
      d.status.chill = 5;
      if (d.status.wet > 0) {
        d.status.frozen = 3;
        d.status.wet = 0;
        this.effects.floatText(d.x, d.y - 66, 'FROZEN', '#dbeafe');
      }
    }
    if (counts.ice) d.status.chill = 4;
    if (counts.lightning) {
      d.status.shock = 0.35;
      d.status.wet = 0;
      this.chainLightning(d, dmg * 0.55, quiet, ctx);
    }
    if (counts.life) this.heal(d, 20 * duplicatePower(elements, 'life') * mult);

    if (dmg > 0) this.damageTarget(d, dmg, kx, ky, quiet);
  }

  damageTarget(d, dmg, kx = 0, ky = 0, quiet = false) {
    if (d.status.frozen > 0) { kx *= 0.1; ky *= 0.1; }
    d.hp -= dmg;
    d.flash = 0.15;
    d.wobble = 0.35;
    d.kx += kx;
    d.ky += ky;
    this.effects.floatText(
      d.x + rnd(-8, 8), d.y - 48,
      String(Math.round(dmg)),
      dmg >= 60 ? '#fde047' : '#f1f5f9',
    );
    if (!quiet) this.bus.emit('sfx', { id: 'hit' });
    if (d.hp <= 0) this.killTarget(d);
  }

  killTarget(d) {
    if (d.dead) return;
    d.dead = true;
    this.effects.puff(d.x, d.y - 14, '#94a3b8', 26);
    this.effects.floatText(d.x, d.y - 60, 'DESTROYED', '#fb923c');
    this.bus.emit('sfx', { id: 'death' });
    if (d.kind === 'enemy') this.bus.emit('enemy:killed', { type: d.type });
  }

  chainLightning(from, dmg, quiet, ctx) {
    for (const d of ctx.world.enemies.slice()) {
      if (d === from || d.dead) continue;
      if (dist2(d.x, d.y, from.x, from.y) < 170 ** 2) {
        this.effects.bolt(from.x, from.y - 20, d.x, d.y - 20, 0.12);
        this.damageTarget(d, dmg * (d.status.wet ? 2 : 1), 0, 0, quiet);
      }
    }
  }

  /** Healing mends the living but sears the undead. */
  heal(target, amount) {
    if (amount <= 0) return;
    if (target.undead) {
      this.effects.floatText(target.x, target.y - 66, 'SEARED', '#fef08a');
      this.damageTarget(target, amount, 0, 0, true);
      return;
    }
    target.hp = Math.min(target.maxHp, target.hp + amount);
    this.effects.floatText(target.x, target.y - 40, '+' + Math.round(amount), '#4ade80');
    this.effects.puff(target.x, target.y - 10, '#4ade80', 6);
  }

  hurtPlayer(player, dmg, ctx) {
    if (player.ward > 0) dmg *= 0.25;
    player.hp = Math.max(0, player.hp - dmg);
    this.effects.floatText(player.x, player.y - 40, '-' + Math.round(dmg), '#f87171');
    this.bus.emit('sfx', { id: 'playerHurt' });
    ctx.camera.addShake(3);
  }
}
