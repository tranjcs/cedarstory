import { ELEMENTS } from '../config.js';
import { TAU, clamp } from '../core/math.js';
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
    this.#drawMinimap(g, ctx, width);
  }

  /** Top-right overview of the current stage with live entity dots. */
  #drawMinimap(g, ctx, width) {
    const map = ctx.maps?.current;
    if (!map) return;
    const sc = Math.min(170 / map.w, 130 / map.h);
    const mw = map.w * sc, mh = map.h * sc;
    const x0 = width - mw - 18, y0 = 18;

    g.save();
    g.fillStyle = 'rgba(10,13,20,.78)';
    roundRect(g, x0 - 5, y0 - 5, mw + 10, mh + 10, 7);
    g.fill();

    g.save();
    g.beginPath(); g.rect(x0, y0, mw, mh); g.clip();
    g.fillStyle = map.floor;
    g.fillRect(x0, y0, mw, mh);
    for (const r of map.regions) {
      g.fillStyle = r.color;
      if (r.kind === 'circle') {
        g.beginPath(); g.arc(x0 + r.x * sc, y0 + r.y * sc, r.r * sc, 0, TAU); g.fill();
      } else {
        g.fillRect(x0 + r.x * sc, y0 + r.y * sc, r.w * sc, r.h * sc);
      }
    }
    for (const c of map.colliders) {
      g.fillStyle = 'rgba(148,163,184,.25)';
      g.fillRect(x0 + c.x * sc, y0 + c.y * sc, Math.max(1.5, c.w * sc), Math.max(1.5, c.h * sc));
    }

    const pulse = 0.6 + Math.sin(performance.now() / 350) * 0.3;
    for (const gate of map.gates) {
      if (gate.locked) continue;
      g.globalAlpha = pulse;
      g.fillStyle = '#a5b4fc';
      g.beginPath(); g.arc(x0 + gate.x * sc, y0 + gate.y * sc, 3, 0, TAU); g.fill();
      g.globalAlpha = 1;
    }
    for (const e of ctx.world.enemies) {
      g.fillStyle = e.kind === 'dummy' ? '#c9a06c' : '#f87171';
      g.beginPath(); g.arc(x0 + e.x * sc, y0 + e.y * sc, 2, 0, TAU); g.fill();
    }
    g.fillStyle = '#4ade80';
    for (const n of ctx.world.npcs) {
      g.beginPath(); g.arc(x0 + n.x * sc, y0 + n.y * sc, 2, 0, TAU); g.fill();
    }
    for (const p of ctx.world.players) {
      g.fillStyle = '#0f172a';
      g.beginPath(); g.arc(x0 + p.x * sc, y0 + p.y * sc, 4, 0, TAU); g.fill();
      g.fillStyle = '#f8fafc';
      g.beginPath(); g.arc(x0 + p.x * sc, y0 + p.y * sc, 2.8, 0, TAU); g.fill();
    }
    g.restore();

    g.strokeStyle = 'rgba(148,163,184,.4)';
    g.lineWidth = 1;
    g.strokeRect(x0 - 0.5, y0 - 0.5, mw + 1, mh + 1);
    g.restore();
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
    const day = ctx.daycycle;
    if (day) {
      const icon = day.phase === 'day' ? '☀' : day.phase === 'night' ? '☾' : '☁';
      g.font = '600 13px "Segoe UI",sans-serif';
      g.fillStyle = day.isNight ? '#a5b4fc' : '#fbbf24';
      g.fillText(icon + '  ' + day.clock, width - 22, height - 90);
    }
    const location = ctx.maps?.locationName;
    if (location) {
      g.font = '600 13px "Segoe UI",sans-serif';
      g.fillStyle = '#94a3b8';
      g.fillText(location.toUpperCase(), width - 22, height - 70);
    }
    const rep = ctx.reputation;
    if (rep) {
      g.font = '600 13px "Segoe UI",sans-serif';
      g.fillStyle = rep.value < 0 ? '#f87171' : rep.value >= 30 ? '#4ade80' : '#94a3b8';
      const label = rep.standing === 'neutral' ? '' : ' · ' + rep.standing.toUpperCase();
      g.fillText('REP ' + (rep.value > 0 ? '+' : '') + rep.value + label, width - 22, height - 110);
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
