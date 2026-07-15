import { TAU } from '../core/math.js';
import { POTIONS, POTION_IDS, ELEMENT_TO_POTION } from './potions.js';
import { PotionFlask } from '../entities/alchemy.js';
import { slotBackground } from '../render/ui.js';

/**
 * The Alchemist — hardness 4/5. Eight finished potions on the same
 * QWERASDF row, no mixing, balanced by cooldowns. Lob flasks at the
 * cursor (RMB) or drink where you stand (Shift+RMB). Passive: flowers
 * bloom in their footsteps.
 */
export class AlchemistClass {
  id = 'alchemist';
  name = 'Alchemist';
  hardness = 4;
  selected = 'mushroom';

  #cooldowns = {}; // potion id -> seconds remaining
  #lastX = null;
  #lastY = null;
  #stride = 0;

  constructor(bus) {
    this.bus = bus;
    for (const id of POTION_IDS) this.#cooldowns[id] = 0;
  }

  cooldownFor(id) {
    return this.#cooldowns[id];
  }

  /** Same physical keys as the Mage's elements — here they pick a brew. */
  onElementKey(element, ctx) {
    const id = ELEMENT_TO_POTION[element];
    if (!id) return;
    this.selected = id;
    this.bus.emit('sfx', { id: 'queued', element });
    this.bus.emit('announce', { text: POTIONS[id].name });
  }

  /**
   * @param {'aim'|'self'|'area'} mode aim throws at the cursor;
   *   self (and area) drink the brew where you stand.
   */
  onCast(mode, ctx) {
    const potion = POTIONS[this.selected];
    if (this.#cooldowns[this.selected] > 0) {
      this.bus.emit('sfx', { id: 'rejected' });
      return;
    }
    this.#cooldowns[this.selected] = potion.cd;
    if (mode === 'aim') {
      ctx.world.flasks.push(new PotionFlask(ctx.world.player, ctx.aim, potion));
      this.bus.emit('sfx', { id: 'throw' });
    } else {
      const p = ctx.world.player;
      ctx.effects.puff(p.x, p.y - 10, potion.color, 10);
      potion.onLand(ctx, p.x, p.y);
    }
  }

  update(dt, ctx) {
    for (const id of POTION_IDS) {
      this.#cooldowns[id] = Math.max(0, this.#cooldowns[id] - dt);
    }
    this.#flowerTrail(ctx);
  }

  /** Passive: flowers grow where the alchemist walks. */
  #flowerTrail(ctx) {
    const p = ctx.world.player;
    if (this.#lastX !== null) {
      this.#stride += Math.hypot(p.x - this.#lastX, p.y - this.#lastY);
      if (this.#stride > 28) {
        this.#stride = 0;
        ctx.world.trailFlowers.push({
          x: p.x + (Math.random() * 16 - 8),
          y: p.y + 6 + (Math.random() * 10 - 5),
          ttl: 18, ttl0: 18, seed: Math.random(),
        });
        if (ctx.world.trailFlowers.length > 240) ctx.world.trailFlowers.shift();
      }
    }
    this.#lastX = p.x;
    this.#lastY = p.y;
  }

  getPreview() {
    const potion = POTIONS[this.selected];
    if (this.#cooldowns[this.selected] > 0) return null;
    return { color: potion.color, radius: potion.radius };
  }

  getOrbColor() {
    return POTIONS[this.selected].color;
  }

  renderHud(g, { width, height }) {
    const s = 44, gap = 8;
    const total = POTION_IDS.length * s + (POTION_IDS.length - 1) * gap;
    const bx = width / 2 - total / 2;
    const by = height - 78;

    for (let i = 0; i < POTION_IDS.length; i++) {
      const id = POTION_IDS[i];
      const potion = POTIONS[id];
      const x = bx + i * (s + gap);
      slotBackground(g, x, by, s, id === this.selected);
      // flask
      g.save();
      g.shadowColor = potion.color;
      g.shadowBlur = 10;
      g.fillStyle = potion.color;
      g.beginPath(); g.arc(x + s / 2, by + s / 2 - 2, 10, 0, TAU); g.fill();
      g.restore();
      g.fillStyle = 'rgba(255,255,255,.8)';
      g.beginPath(); g.arc(x + s / 2 - 3, by + s / 2 - 5, 2.6, 0, TAU); g.fill();
      // hotkey
      g.fillStyle = '#94a3b8';
      g.font = 'bold 10px "Segoe UI",sans-serif';
      g.textAlign = 'center';
      g.fillText(potion.key, x + s / 2, by + s - 4);
      // cooldown veil
      const cd = this.#cooldowns[id];
      if (cd > 0) {
        g.fillStyle = 'rgba(5,8,14,.72)';
        const frac = cd / potion.cd;
        g.fillRect(x + 1, by + 1 + (s - 2) * (1 - frac), s - 2, (s - 2) * frac);
        g.fillStyle = '#e2e8f0';
        g.font = 'bold 12px "Segoe UI",sans-serif';
        g.fillText(Math.ceil(cd), x + s / 2, by + s / 2 + 4);
      }
    }

    g.textAlign = 'center';
    g.font = '600 15px "Segoe UI",sans-serif';
    g.fillStyle = '#cbd5e1';
    g.fillText(POTIONS[this.selected].name, width / 2, by - 12);
  }
}
