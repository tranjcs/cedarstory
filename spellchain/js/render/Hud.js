import { ELEMENTS } from '../config.js';
import { clamp } from '../core/math.js';
import { roundRect } from './ui.js';

const PLAYER_STATUS_LABELS = [
  ['wet', '#38bdf8', 'WET'],
  ['burn', '#fb923c', 'BURNING'],
  ['chill', '#dbeafe', 'CHILLED'],
  ['frozen', '#93c5fd', 'FROZEN'],
  ['poison', '#a3e635', 'POISONED'],
  ['confusion', '#fbbf24', 'CONFUSED'],
  ['haste', '#7dd3fc', 'HASTENED'],
];

/**
 * Screen-space overlay: HP, statuses, dash cooldown, kill count, current
 * biome, and announcements. The class-specific hotbar (element queue or
 * potion belt) is delegated to the active class's renderHud.
 */
export class Hud {
  #announce = { text: '', t: 0 };
  kills = 0;

  constructor(bus) {
    bus.on('announce', ({ text }) => {
      this.#announce = { text, t: 2.2 };
    });
    bus.on('enemy:killed', () => {
      this.kills += 1;
    });
  }

  update(dt) {
    this.#announce.t = Math.max(0, this.#announce.t - dt);
  }

  /**
   * @param {CanvasRenderingContext2D} g screen-space context (already reset)
   */
  render(g, ctx, width, height) {
    const view = { width, height };
    ctx.activeClass?.renderHud(g, view);
    this.#drawAnnounce(g, width, height);
    this.#drawPlayerBars(g, ctx.world.player, height);
    this.#drawSidebar(g, ctx, width, height);
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
    roundRect(g, 20, height - 46, hw, 20, 8);
    g.fill();
    g.fillStyle = player.hp > 30 ? '#ef4444' : '#7f1d1d';
    roundRect(g, 22, height - 44, (hw - 4) * (player.hp / player.maxHp), 16, 6);
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

  #drawSidebar(g, ctx, width, height) {
    g.textAlign = 'right';
    const location = ctx.maps?.locationName ?? ctx.chunks?.currentBiome?.name;
    if (location) {
      g.font = '600 13px "Segoe UI",sans-serif';
      g.fillStyle = '#94a3b8';
      g.fillText(location.toUpperCase(), width - 22, height - 70);
    }
    g.font = '600 13px "Segoe UI",sans-serif';
    g.fillStyle = '#e2e8f0';
    g.fillText('KILLS ' + this.kills, width - 22, height - 50);
    const player = ctx.world.player;
    g.fillStyle = player.dashCooldown > 0 ? '#64748b' : '#a5b4fc';
    g.fillText(
      player.dashCooldown > 0 ? 'DASH ' + player.dashCooldown.toFixed(1) : 'DASH READY',
      width - 22, height - 30,
    );
  }
}
