import { ELEMENTS, MAX_QUEUE } from '../config.js';
import { TAU, clamp } from '../core/math.js';
import { spellName } from '../spells/SpellResolver.js';

const PLAYER_STATUS_LABELS = [
  ['wet', '#38bdf8', 'WET'],
  ['burn', '#fb923c', 'BURNING'],
  ['chill', '#dbeafe', 'CHILLED'],
  ['frozen', '#93c5fd', 'FROZEN'],
];

/**
 * Screen-space overlay: element queue slots, spell name, channel bar,
 * announcements, HP, statuses, and dash cooldown. Subscribes to
 * `announce` events on the bus.
 */
export class Hud {
  #announce = { text: '', t: 0 };

  constructor(bus) {
    bus.on('announce', ({ text }) => {
      this.#announce = { text, t: 2.2 };
    });
  }

  update(dt) {
    this.#announce.t = Math.max(0, this.#announce.t - dt);
  }

  /**
   * @param {CanvasRenderingContext2D} g screen-space context (already reset)
   * @param {{cast: object, player: object, width: number, height: number}} view
   */
  render(g, { cast, player, width, height }) {
    this.#drawQueue(g, cast, width, height);
    this.#drawAnnounce(g, width, height);
    this.#drawPlayerBars(g, player, height);
    this.#drawDash(g, player, width, height);
  }

  #drawQueue(g, cast, width, height) {
    const s = 52, gap = 10;
    const total = MAX_QUEUE * s + (MAX_QUEUE - 1) * gap;
    const bx = width / 2 - total / 2;
    const by = height - 86;
    const queued = cast.queue.items;

    for (let i = 0; i < MAX_QUEUE; i++) {
      const x = bx + i * (s + gap);
      g.fillStyle = 'rgba(15,20,32,.8)';
      g.strokeStyle = 'rgba(148,163,184,.3)';
      g.lineWidth = 1.5;
      this.#roundRect(g, x, by, s, s, 10);
      g.fill();
      g.stroke();
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
    if (cast.channel) {
      g.fillStyle = 'rgba(15,20,32,.8)';
      this.#roundRect(g, width / 2 - 90, by - 26, 180, 10, 5);
      g.fill();
      g.fillStyle = '#a5b4fc';
      this.#roundRect(g, width / 2 - 88, by - 24, 176 * (cast.channel.t / cast.channel.dur), 6, 3);
      g.fill();
    }
  }

  #drawAnnounce(g, width, height) {
    if (this.#announce.t <= 0) return;
    g.textAlign = 'center';
    g.globalAlpha = clamp(this.#announce.t, 0, 1);
    g.font = 'bold 26px "Segoe UI",sans-serif';
    g.fillStyle = '#f1f5f9';
    g.shadowColor = '#6366f1';
    g.shadowBlur = 18;
    g.fillText(this.#announce.text, width / 2, height * 0.22);
    g.shadowBlur = 0;
    g.globalAlpha = 1;
  }

  #drawPlayerBars(g, player, height) {
    const hw = 200;
    g.fillStyle = 'rgba(15,20,32,.8)';
    this.#roundRect(g, 20, height - 46, hw, 20, 8);
    g.fill();
    g.fillStyle = player.hp > 30 ? '#ef4444' : '#7f1d1d';
    this.#roundRect(g, 22, height - 44, (hw - 4) * (player.hp / player.maxHp), 16, 6);
    g.fill();
    g.fillStyle = '#fecaca';
    g.font = 'bold 12px "Segoe UI",sans-serif';
    g.textAlign = 'left';
    g.fillText(Math.ceil(player.hp) + ' / ' + player.maxHp, 28, height - 32);

    let px = 20;
    for (const [key, color, label] of PLAYER_STATUS_LABELS) {
      if (player.status[key] > 0) {
        g.fillStyle = color;
        g.font = 'bold 11px "Segoe UI",sans-serif';
        g.fillText(label, px, height - 54);
        px += g.measureText(label).width + 12;
      }
    }
    if (player.ward > 0) {
      g.fillStyle = ELEMENTS.shield.color;
      g.fillText('WARDED', px, height - 54);
    }
  }

  #drawDash(g, player, width, height) {
    g.textAlign = 'right';
    g.font = '600 13px "Segoe UI",sans-serif';
    g.fillStyle = player.dashCooldown > 0 ? '#64748b' : '#a5b4fc';
    g.fillText(
      player.dashCooldown > 0 ? 'DASH ' + player.dashCooldown.toFixed(1) : 'DASH READY',
      width - 22, height - 30,
    );
  }

  #roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
}
