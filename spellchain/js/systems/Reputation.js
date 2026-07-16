import { dist2 } from '../core/math.js';

/**
 * The town's opinion of you, as a single number (−100..100, start 0).
 *
 * It falls when you murder townsfolk (regicide is much worse), level
 * buildings, trespass in the keep's restricted wings, or throw moonshine
 * at people who didn't ask for it. It rises when you buy the tavern a
 * round after dark. NPCs read it: below 0 villagers flee you, at −30 the
 * watch attacks on sight — and any guard who witnesses a killing goes
 * hostile immediately.
 */
export class Reputation {
  value = 0;
  #lastKill = null;
  #huntCd = 0;

  constructor(bus) {
    this.bus = bus;
    bus.on('npc:killed', ({ npc }) => {
      const penalty = npc.royal ? -40 : npc.body === 'guard' ? -20
        : ['dog', 'cat', 'chicken', 'cow', 'ox'].includes(npc.body) ? -5 : -15;
      this.change(penalty, npc.royal ? 'REGICIDE' : `${npc.name} was murdered`);
      this.#lastKill = { x: npc.x, y: npc.y };
    });
  }

  get standing() {
    if (this.value <= -30) return 'wanted';
    if (this.value < 0) return 'feared';
    if (this.value >= 30) return 'beloved';
    return 'neutral';
  }

  change(amount, label) {
    if (!amount) return;
    this.value = Math.max(-100, Math.min(100, this.value + amount));
    this.bus.emit('announce', {
      text: `${label} — reputation ${amount > 0 ? '+' : ''}${amount}`,
    });
  }

  /** Moonshine etiquette: a round for the tavern at night, or a nuisance. */
  onMoonshine(ctx, x, y) {
    if (ctx.maps?.currentId === 'tavern' && ctx.daycycle?.isNight) {
      this.change(8, 'The tavern roars its approval');
      const toasts = ['To the wizard!', 'A free round!', 'CHEERS!', 'Best pub night in years!'];
      for (const n of ctx.world.npcs) {
        if (!n.asleep && Math.random() < 0.8) {
          n.say(toasts[Math.floor(Math.random() * toasts.length)]);
        }
      }
    } else {
      this.change(-8, 'Public drunkenness');
    }
  }

  /** Called by MapManager when the player overstays in a restricted wing. */
  trespass(ctx) {
    this.change(-10, 'Trespassing in the royal wing');
    this.alertGuards(ctx, ctx.world.player.x, ctx.world.player.y, 1200);
  }

  /** Guard NPCs near (x, y) drop the pleasantries and draw steel. */
  alertGuards(ctx, x, y, radius = 340) {
    let alerted = 0;
    for (const n of ctx.world.npcs) {
      if (n.body !== 'guard' || n.asleep || n.dead) continue;
      if (dist2(n.x, n.y, x, y) > radius ** 2) continue;
      n.dead = true; // the friendly version steps out…
      ctx.world.spawnEnemy('guardsman', n.x, n.y); // …and the hostile one steps in
      alerted++;
    }
    if (alerted) this.bus.emit('announce', { text: 'GUARDS! SEIZE THE WIZARD!' });
    return alerted;
  }

  update(dt, ctx) {
    this.#huntCd = Math.max(0, this.#huntCd - dt);
    if (this.#lastKill) {
      // a killing in view of the watch is answered immediately
      this.alertGuards(ctx, this.#lastKill.x, this.#lastKill.y, 340);
      this.#lastKill = null;
    }
    if (this.value <= -30 && this.#huntCd === 0) {
      const p = ctx.world.player;
      if (this.alertGuards(ctx, p.x, p.y, 320)) this.#huntCd = 4;
    }
  }
}
