import { ELEMENTS } from '../config.js';
import { ElementQueue } from './ElementQueue.js';
import { resolveKind, spellName } from './SpellResolver.js';
import { STRATEGIES, castArea, castSelf } from './strategies.js';

/**
 * Owns the element queue and the active channel. Queueing feedback (sfx,
 * fizzle puffs) and cast dispatch both flow through here; the actual spell
 * behavior lives in the strategy classes.
 */
export class CastSystem {
  /** @type {ElementQueue} */
  queue = new ElementQueue();
  /** @type {import('./strategies.js').Channel | null} */
  channel = null;

  constructor(bus) {
    this.bus = bus;
  }

  queueElement(element, ctx) {
    if (this.channel) return;
    const player = ctx.world.player;
    const result = this.queue.add(element);
    switch (result.status) {
      case 'combined':
        this.bus.emit('sfx', { id: 'combined', product: result.product });
        ctx.effects.puff(player.x, player.y - 26, ELEMENTS[result.product].color, 8);
        break;
      case 'cancelled':
        this.bus.emit('sfx', { id: 'cancelled' });
        ctx.effects.puff(player.x, player.y - 26, '#64748b', 6);
        break;
      case 'rejected':
        this.bus.emit('sfx', { id: 'rejected' });
        break;
      case 'queued':
        this.bus.emit('sfx', { id: 'queued', element });
        break;
    }
  }

  undo() {
    if (this.queue.pop() !== undefined) this.bus.emit('sfx', { id: 'undo' });
  }

  clear() {
    if (this.queue.clear()) this.bus.emit('sfx', { id: 'clear' });
  }

  /** @param {'aim'|'self'|'area'} mode */
  cast(mode, ctx) {
    if (this.channel || this.queue.length === 0) return;

    if (mode === 'self') {
      const elements = this.queue.take();
      this.bus.emit('announce', {
        text: 'Self: ' + elements.map((el) => el[0].toUpperCase() + el.slice(1)).join(' + '),
      });
      castSelf(ctx, elements);
      return;
    }
    if (mode === 'area') {
      const elements = this.queue.take();
      const name = spellName(elements);
      this.bus.emit('announce', {
        text: name === '—' ? 'Nova' : name.replace(/Wall|Boulder|Shard Volley|Death Beam|Mending Beam|Spray|Lightning/, 'Nova'),
      });
      castArea(ctx, elements);
      return;
    }

    const kind = resolveKind(this.queue.items);
    if (!kind) return;
    const elements = this.queue.take();
    this.bus.emit('announce', { text: spellName(elements) });
    this.channel = STRATEGIES[kind].cast(ctx, elements);
  }

  /** Advance the active channel; it ends on button release or exhaustion. */
  update(dt, ctx) {
    if (!this.channel) return;
    this.channel.t -= dt;
    if (!ctx.input.pointer.right || this.channel.t <= 0) {
      this.channel = null;
      return;
    }
    this.channel.update(dt, ctx);
  }
}
