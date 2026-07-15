import { ELEMENTS, MAX_QUEUE } from '../config.js';
import { TAU } from '../core/math.js';
import { CastSystem } from '../spells/CastSystem.js';
import { spellName, resolveKind, countElements } from '../spells/SpellResolver.js';
import { roundRect, slotBackground } from '../render/ui.js';

/**
 * The Mage — hardness 5/5. Full access to the raw element queue:
 * eight elements, combining, cancelling, channelled casts. Maximum power
 * for whoever can keep the chemistry straight under pressure.
 */
export class MageClass {
  id = 'mage';
  name = 'Mage';
  hardness = 5;

  constructor(bus) {
    this.cast = new CastSystem(bus);
  }

  onElementKey(element, ctx) {
    this.cast.queueElement(element, ctx);
  }

  onCast(mode, ctx) {
    this.cast.cast(mode, ctx);
  }

  update(dt, ctx) {
    this.cast.update(dt, ctx);
  }

  /** What the renderer should sketch at the cursor. */
  getPreview() {
    const queued = this.cast.queue.items;
    if (!queued.length || this.cast.channel) return null;
    const counts = countElements(queued);
    return {
      color: ELEMENTS[queued[queued.length - 1]].color,
      radius: resolveKind(queued) === 'boulder' ? (counts.fire ? 120 : 70) : 0,
    };
  }

  /** Color of the staff orb. */
  getOrbColor() {
    const queued = this.cast.queue.items;
    if (queued.length) return ELEMENTS[queued[queued.length - 1]].color;
    return this.cast.channel ? '#fff' : '#7d8ec9';
  }

  renderHud(g, { width, height }) {
    const s = 52, gap = 10;
    const total = MAX_QUEUE * s + (MAX_QUEUE - 1) * gap;
    const bx = width / 2 - total / 2;
    const by = height - 86;
    const queued = this.cast.queue.items;

    for (let i = 0; i < MAX_QUEUE; i++) {
      const x = bx + i * (s + gap);
      slotBackground(g, x, by, s);
      const el = queued[i];
      if (!el) continue;
      const color = ELEMENTS[el].color;
      g.save();
      g.shadowColor = color;
      g.shadowBlur = 14;
      g.fillStyle = color;
      g.beginPath(); g.arc(x + s / 2, by + s / 2, 15, 0, TAU); g.fill();
      g.restore();
      g.fillStyle = 'rgba(255,255,255,.85)';
      g.beginPath(); g.arc(x + s / 2 - 4, by + s / 2 - 5, 4, 0, TAU); g.fill();
      g.fillStyle = '#e2e8f0';
      g.font = 'bold 11px "Segoe UI",sans-serif';
      g.textAlign = 'center';
      g.fillText(el.toUpperCase(), x + s / 2, by + s - 5);
    }

    g.textAlign = 'center';
    if (queued.length) {
      g.font = '600 16px "Segoe UI",sans-serif';
      g.fillStyle = '#cbd5e1';
      g.fillText(spellName(queued), width / 2, by - 14);
    }
    if (this.cast.channel) {
      g.fillStyle = 'rgba(15,20,32,.8)';
      roundRect(g, width / 2 - 90, by - 26, 180, 10, 5);
      g.fill();
      g.fillStyle = '#a5b4fc';
      roundRect(g, width / 2 - 88, by - 24, 176 * (this.cast.channel.t / this.cast.channel.dur), 6, 3);
      g.fill();
    }
  }
}
