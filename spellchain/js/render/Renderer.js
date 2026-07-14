import { ELEMENTS } from '../config.js';
import { TAU, rnd, clamp } from '../core/math.js';
import { resolveKind, countElements } from '../spells/SpellResolver.js';

const DUMMY_STATUS_PIPS = [
  ['wet', '#38bdf8'],
  ['burn', '#fb923c'],
  ['chill', '#dbeafe'],
  ['frozen', '#93c5fd'],
  ['shock', '#c084fc'],
];

/**
 * Canvas renderer for the world: floor, entities, spells, and effects.
 * Reads game state, never mutates it. HUD overlay drawing lives in Hud.
 */
export class Renderer {
  /** @param {HTMLCanvasElement} canvas */
  constructor(canvas) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this.#resize();
    window.addEventListener('resize', () => this.#resize());
  }

  #resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.canvas.style.width = this.width + 'px';
    this.canvas.style.height = this.height + 'px';
  }

  render(ctx) {
    const { world, camera, effects, cast, aim } = ctx;
    const g = this.g;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    this.#drawBackground(g);

    const shake = camera.shakeOffset;
    g.save();
    g.translate(this.width / 2 - camera.x + shake.x, this.height / 2 - camera.y + shake.y);

    this.#drawGrid(g, camera);
    this.#drawCastPreview(g, world.player, cast, aim);
    this.#drawRings(g, effects.rings);
    this.#drawWalls(g, world.walls);
    for (const d of world.dummies) this.#drawDummy(g, d);
    this.#drawBoulders(g, world.boulders);
    this.#drawShards(g, world.shards);
    this.#drawBeam(g, cast.channel);
    this.#drawBolts(g, effects.bolts);
    this.#drawParticles(g, effects.particles);
    this.#drawPlayer(g, world.player, cast);
    this.#drawFloaters(g, effects.floaters);

    g.restore();
  }

  #drawBackground(g) {
    const grad = g.createRadialGradient(
      this.width / 2, this.height / 2, 80,
      this.width / 2, this.height / 2, Math.max(this.width, this.height) * 0.75,
    );
    grad.addColorStop(0, '#141a26');
    grad.addColorStop(1, '#07090f');
    g.fillStyle = grad;
    g.fillRect(0, 0, this.width, this.height);
  }

  #drawGrid(g, camera) {
    const gs = 90;
    g.strokeStyle = 'rgba(120,140,180,.07)';
    g.lineWidth = 1;
    const x0 = Math.floor((camera.x - this.width / 2) / gs) * gs;
    const x1 = camera.x + this.width / 2;
    const y0 = Math.floor((camera.y - this.height / 2) / gs) * gs;
    const y1 = camera.y + this.height / 2;
    g.beginPath();
    for (let x = x0; x < x1 + gs; x += gs) { g.moveTo(x, y0 - gs); g.lineTo(x, y1 + gs); }
    for (let y = y0; y < y1 + gs; y += gs) { g.moveTo(x0 - gs, y); g.lineTo(x1 + gs, y); }
    g.stroke();
  }

  #drawCastPreview(g, player, cast, aim) {
    const queued = cast.queue.items;
    if (!queued.length || cast.channel) return;
    const kind = resolveKind(queued);
    g.save();
    g.globalAlpha = 0.35;
    g.setLineDash([4, 8]);
    g.strokeStyle = ELEMENTS[queued[queued.length - 1]].color;
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(player.x, player.y - 10);
    g.lineTo(aim.x, aim.y);
    g.stroke();
    g.setLineDash([]);
    if (kind === 'boulder') {
      const counts = countElements(queued);
      g.beginPath();
      g.arc(aim.x, aim.y, counts.fire ? 120 : 70, 0, TAU);
      g.stroke();
    }
    g.restore();
  }

  #drawRings(g, rings) {
    for (const r of rings) {
      g.globalAlpha = clamp(r.t * 3, 0, 0.8);
      g.strokeStyle = r.c;
      g.lineWidth = 4;
      g.beginPath();
      g.arc(r.x, r.y, r.r, 0, TAU);
      g.stroke();
    }
    g.globalAlpha = 1;
  }

  #drawWalls(g, walls) {
    for (const w of walls) {
      const fade = clamp(w.t, 0, 1);
      for (const n of w.nodes) {
        g.globalAlpha = 0.35 * fade;
        g.beginPath();
        g.ellipse(n.x, n.y + 8, 16, 7, 0, 0, TAU);
        g.fillStyle = '#000';
        g.fill();
        g.globalAlpha = fade;
        if (w.rock) {
          g.fillStyle = '#78716c';
          g.beginPath();
          g.moveTo(n.x - 14, n.y + 8); g.lineTo(n.x - 8, n.y - 20);
          g.lineTo(n.x + 3, n.y - 26); g.lineTo(n.x + 14, n.y + 8);
          g.closePath(); g.fill();
          g.fillStyle = '#57534e';
          g.beginPath();
          g.moveTo(n.x + 3, n.y - 26); g.lineTo(n.x + 14, n.y + 8); g.lineTo(n.x + 5, n.y + 8);
          g.closePath(); g.fill();
        } else {
          g.fillStyle = 'rgba(234,179,8,.25)';
          g.strokeStyle = ELEMENTS.shield.color;
          g.lineWidth = 2;
          g.beginPath();
          g.arc(n.x, n.y - 6, 15, 0, TAU);
          g.fill();
          g.stroke();
        }
        if (w.imbue.length) {
          g.fillStyle = ELEMENTS[w.imbue[0]].color;
          g.beginPath();
          g.arc(n.x, n.y - 8, 4, 0, TAU);
          g.fill();
        }
      }
    }
    g.globalAlpha = 1;
  }

  #drawDummy(g, d) {
    const wob = Math.sin(performance.now() / 30) * d.wobble * 6;
    g.save();
    g.translate(d.x, d.y);
    g.rotate(wob * 0.04);
    // shadow
    g.globalAlpha = 0.35;
    g.beginPath();
    g.ellipse(0, 6, 18, 8, 0, 0, TAU);
    g.fillStyle = '#000';
    g.fill();
    g.globalAlpha = 1;
    // post + crossbar + head
    const flash = d.flash > 0;
    g.strokeStyle = flash ? '#fff' : '#8f6b45';
    g.lineWidth = 7;
    g.lineCap = 'round';
    g.beginPath(); g.moveTo(0, 4); g.lineTo(0, -34); g.stroke();
    g.beginPath(); g.moveTo(-18, -22); g.lineTo(18, -22); g.stroke();
    g.fillStyle = flash ? '#fff' : '#c9a06c';
    g.beginPath(); g.arc(0, -42, 10, 0, TAU); g.fill();
    // straw body
    g.fillStyle = flash ? '#fff' : '#a97f52';
    g.beginPath(); g.ellipse(0, -12, 11, 15, 0, 0, TAU); g.fill();
    // status tint
    if (d.status.frozen > 0) {
      g.globalAlpha = 0.55;
      g.fillStyle = '#93c5fd';
      g.beginPath(); g.ellipse(0, -20, 18, 30, 0, 0, TAU); g.fill();
      g.globalAlpha = 1;
    } else if (d.status.wet > 0) {
      g.globalAlpha = 0.3;
      g.fillStyle = '#38bdf8';
      g.beginPath(); g.ellipse(0, -16, 14, 24, 0, 0, TAU); g.fill();
      g.globalAlpha = 1;
    }
    g.restore();
    // hp bar
    const w = 44, pct = clamp(d.hp / d.maxHp, 0, 1);
    g.fillStyle = 'rgba(0,0,0,.55)';
    g.fillRect(d.x - w / 2, d.y - 64, w, 6);
    g.fillStyle = pct > 0.5 ? '#4ade80' : pct > 0.25 ? '#fbbf24' : '#f87171';
    g.fillRect(d.x - w / 2, d.y - 64, w * pct, 6);
    // status pips
    let px = d.x - w / 2;
    const py = d.y - 72;
    for (const [key, color] of DUMMY_STATUS_PIPS) {
      if (d.status[key] > 0) {
        g.fillStyle = color;
        g.beginPath();
        g.arc(px + 3, py, 3.2, 0, TAU);
        g.fill();
        px += 9;
      }
    }
  }

  #drawBoulders(g, boulders) {
    for (const b of boulders) {
      const h = b.height;
      g.globalAlpha = 0.3;
      g.beginPath();
      g.ellipse(b.x, b.y, 14 * (1 - h / 200), 6 * (1 - h / 200), 0, 0, TAU);
      g.fillStyle = '#000';
      g.fill();
      g.globalAlpha = 1;
      g.fillStyle = '#8a7563';
      g.beginPath(); g.arc(b.x, b.y - h, 13, 0, TAU); g.fill();
      g.fillStyle = '#6b5a4b';
      g.beginPath(); g.arc(b.x + 4, b.y - h + 3, 7, 0, TAU); g.fill();
    }
  }

  #drawShards(g, shards) {
    g.fillStyle = ELEMENTS.ice.color;
    for (const s of shards) {
      const a = Math.atan2(s.vy, s.vx);
      g.save();
      g.translate(s.x, s.y);
      g.rotate(a);
      g.beginPath();
      g.moveTo(9, 0); g.lineTo(-6, -3); g.lineTo(-6, 3);
      g.closePath();
      g.fill();
      g.restore();
    }
  }

  #drawBeam(g, channel) {
    const b = channel?.beam;
    if (!b) return;
    const ex = b.ox + Math.cos(b.a) * b.len;
    const ey = b.oy + Math.sin(b.a) * b.len;
    const color = b.life ? '#4ade80' : '#f43f5e';
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = color;
    g.globalAlpha = 0.35;
    g.lineWidth = 14 + Math.sin(performance.now() / 40) * 3;
    g.beginPath(); g.moveTo(b.ox, b.oy); g.lineTo(ex, ey); g.stroke();
    g.globalAlpha = 1;
    g.lineWidth = 4;
    g.strokeStyle = '#fff';
    g.beginPath(); g.moveTo(b.ox, b.oy); g.lineTo(ex, ey); g.stroke();
    g.fillStyle = color;
    g.beginPath(); g.arc(ex, ey, 8 + Math.random() * 3, 0, TAU); g.fill();
    g.restore();
  }

  #drawBolts(g, bolts) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (const b of bolts) {
      g.strokeStyle = ELEMENTS.lightning.color;
      g.lineWidth = 2.5;
      g.globalAlpha = clamp(b.t * 10, 0, 1);
      g.beginPath();
      g.moveTo(b.x1, b.y1);
      const segments = 6;
      for (let i = 1; i <= segments; i++) {
        const t = i / segments;
        const jitter = i < segments ? rnd(-14, 14) : 0;
        g.lineTo(b.x1 + (b.x2 - b.x1) * t + jitter, b.y1 + (b.y2 - b.y1) * t + (i < segments ? rnd(-14, 14) : 0));
      }
      g.stroke();
      g.strokeStyle = '#fff';
      g.lineWidth = 1;
      g.stroke();
    }
    g.restore();
  }

  #drawParticles(g, particles) {
    g.save();
    for (const p of particles) {
      const a = clamp(p.life / p.max, 0, 1);
      g.globalCompositeOperation = p.add || p.spray ? 'lighter' : 'source-over';
      g.globalAlpha = p.ghost ? a * 0.35 : a;
      g.fillStyle = p.c;
      g.beginPath();
      g.arc(p.x, p.y, p.r * (p.ghost ? 1.6 : a), 0, TAU);
      g.fill();
    }
    g.restore();
  }

  #drawPlayer(g, p, cast) {
    const bob = Math.sin(p.walk) * 2.4;
    const lean = clamp(p.vx * 0.0004, -0.12, 0.12);
    g.save();
    g.translate(p.x, p.y);
    // shadow
    g.globalAlpha = 0.4;
    g.beginPath(); g.ellipse(0, 6, 15, 7, 0, 0, TAU); g.fillStyle = '#000'; g.fill();
    g.globalAlpha = 1;
    // ward bubble
    if (p.ward > 0) {
      g.globalAlpha = 0.25 + Math.sin(performance.now() / 150) * 0.08;
      g.fillStyle = ELEMENTS.shield.color;
      g.beginPath(); g.arc(0, -14, 34, 0, TAU); g.fill();
      g.globalAlpha = 1;
    }
    g.rotate(lean);
    g.translate(0, bob);
    // robe
    g.fillStyle = p.status.frozen > 0 ? '#93c5fd' : '#4c5b8f';
    g.beginPath();
    g.moveTo(-11, 4); g.quadraticCurveTo(-13, -22, 0, -26);
    g.quadraticCurveTo(13, -22, 11, 4);
    g.closePath(); g.fill();
    g.fillStyle = '#3b4977';
    g.beginPath();
    g.moveTo(-11, 4); g.quadraticCurveTo(0, -2, 11, 4);
    g.lineTo(9, 0); g.lineTo(-9, 0);
    g.closePath(); g.fill();
    // head
    g.fillStyle = '#e8c39e';
    g.beginPath(); g.arc(0, -30, 7, 0, TAU); g.fill();
    // hat
    g.fillStyle = '#38406b';
    g.beginPath(); g.ellipse(0, -34, 13, 4, -0.08, 0, TAU); g.fill();
    g.beginPath();
    g.moveTo(-8, -35); g.quadraticCurveTo(-2, -58, 6, -52); g.quadraticCurveTo(2, -46, 8, -35);
    g.closePath(); g.fill();
    // staff pointing at cursor
    const a = p.facing;
    const hx = Math.cos(a) * 17, hy = -14 + Math.sin(a) * 17;
    g.strokeStyle = '#8b6f47';
    g.lineWidth = 3;
    g.lineCap = 'round';
    g.beginPath(); g.moveTo(hx * 0.3, -8); g.lineTo(hx, hy); g.stroke();
    // staff orb glows with the newest queued element
    const queued = cast.queue.items;
    const orbColor = queued.length
      ? ELEMENTS[queued[queued.length - 1]].color
      : (cast.channel ? '#fff' : '#7d8ec9');
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = orbColor;
    g.beginPath(); g.arc(hx, hy, queued.length ? 6.5 : 4.5, 0, TAU); g.fill();
    g.globalAlpha = 0.35;
    g.beginPath(); g.arc(hx, hy, 11, 0, TAU); g.fill();
    g.restore();
    g.restore();
  }

  #drawFloaters(g, floaters) {
    g.textAlign = 'center';
    g.font = 'bold 15px "Segoe UI",sans-serif';
    for (const f of floaters) {
      g.globalAlpha = clamp(f.t * 2, 0, 1);
      g.fillStyle = '#000';
      g.fillText(f.txt, f.x + 1, f.y + 1);
      g.fillStyle = f.c;
      g.fillText(f.txt, f.x, f.y);
    }
    g.globalAlpha = 1;
  }
}
