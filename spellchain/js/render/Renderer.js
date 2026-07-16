import { ELEMENTS } from '../config.js';
import { TAU, rnd, clamp } from '../core/math.js';
import { ANIMAL_BODIES } from '../entities/Npc.js';
import { roundRect } from './ui.js';

const STATUS_PIPS = [
  ['wet', '#38bdf8'],
  ['burn', '#fb923c'],
  ['chill', '#dbeafe'],
  ['frozen', '#93c5fd'],
  ['shock', '#c084fc'],
  ['poison', '#a3e635'],
  ['confusion', '#fbbf24'],
  ['haste', '#7dd3fc'],
];

/** Deco types that draw their own base — the small shared shadow would look wrong. */
const NO_SHADOW = new Set([
  'wave', 'searock', 'dockboat', 'fountain', 'castle', 'ship', 'steam',
  'windmill', 'tower', 'cellbars', 'counter', 'shelf', 'torii', 'merlion',
]);

/**
 * Canvas renderer for the world: biome floor, decorations, entities,
 * spells, potion zones, and effects. Reads game state, never mutates it.
 * HUD overlay drawing lives in Hud.
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
    const { world, camera, effects } = ctx;
    // day/night state, read by decoration drawing (lamps, windows, shops)
    this.dark = ctx.daycycle?.darkness ?? 0;
    this.lightsOn = (ctx.daycycle?.lightsOn ?? false) || Boolean(ctx.maps?.current?.alwaysLit);
    const g = this.g;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.fillStyle = '#07090f';
    g.fillRect(0, 0, this.width, this.height);

    const shake = camera.shakeOffset;
    g.save();
    g.translate(this.width / 2 - camera.x + shake.x, this.height / 2 - camera.y + shake.y);

    const map = ctx.maps.current;
    this.#drawMapFloor(g, ctx, map);
    this.#drawGrid(g, camera);
    this.#drawMapProps(g, ctx, map);
    this.#drawTrailFlowers(g, world.trailFlowers);
    this.#drawZones(g, world.zones);
    this.#drawPortals(g, world.portals);
    this.#drawDroppedWeapons(g, world.droppedWeapons);
    this.#drawCastPreview(g, ctx);
    this.#drawRings(g, effects.rings);
    this.#drawWalls(g, world.walls);
    for (const e of world.enemies) {
      if (e.kind === 'dummy') this.#drawDummy(g, e);
      else this.#drawEnemy(g, e);
    }
    for (const npc of world.npcs) {
      if (!npc.asleep) this.#drawNpc(g, npc);
    }
    for (const cat of world.cats) this.#drawCat(g, cat);
    this.#drawBoulders(g, world.boulders);
    this.#drawFlasks(g, world.flasks);
    this.#drawShards(g, world.shards);
    this.#drawBeam(g, ctx.activeClass?.cast?.channel);
    this.#drawBolts(g, effects.bolts);
    this.#drawParticles(g, effects.particles);
    for (const p of world.players) this.#drawPlayer(g, p, ctx);
    this.#drawNameLabels(g, world.players);
    this.#drawRainClouds(g, world.zones);
    if (map.fog) this.#drawFog(g, map);
    this.#drawFloaters(g, effects.floaters);
    this.#drawSpeechBubbles(g, world.npcs);

    g.restore();

    // night falls: a cool dark wash over the world (HUD is drawn after, unaffected)
    if (this.dark > 0) {
      g.fillStyle = `rgba(9, 13, 38, ${this.dark})`;
      g.fillRect(0, 0, this.width, this.height);
    }
    // trespass warning: the screen reddens the longer you overstay
    const trespass = ctx.maps?.restrictedT ?? 0;
    if (trespass > 0) {
      const pulse = 1 + Math.sin(performance.now() / 160) * 0.15;
      g.fillStyle = `rgba(153, 27, 27, ${Math.min(0.45, (trespass / 4) * 0.45) * pulse})`;
      g.fillRect(0, 0, this.width, this.height);
    }
    this.#drawVignette(g);

    // travel fade-to-black
    const fade = ctx.maps?.fadeAlpha ?? 0;
    if (fade > 0) {
      g.globalAlpha = fade;
      g.fillStyle = '#05070c';
      g.fillRect(0, 0, this.width, this.height);
      g.globalAlpha = 1;
    }
  }

  // ---------------------------------------------------------------- stages

  #drawMapFloor(g, ctx, map) {
    const { camera } = ctx;
    // beyond the bounds: void for walled towns, open sea for isles
    g.fillStyle = map.outside;
    g.fillRect(camera.x - this.width / 2 - 40, camera.y - this.height / 2 - 40, this.width + 80, this.height + 80);

    const T = 120;
    const ix0 = Math.max(0, Math.floor((camera.x - this.width / 2) / T));
    const ix1 = Math.min(Math.ceil(map.w / T) - 1, Math.floor((camera.x + this.width / 2) / T));
    const iy0 = Math.max(0, Math.floor((camera.y - this.height / 2) / T));
    const iy1 = Math.min(Math.ceil(map.h / T) - 1, Math.floor((camera.y + this.height / 2) / T));
    for (let iy = iy0; iy <= iy1; iy++) {
      for (let ix = ix0; ix <= ix1; ix++) {
        g.fillStyle = (ix + iy) % 2 === 0 ? map.floor : map.floorAlt;
        g.fillRect(ix * T, iy * T, Math.min(T, map.w - ix * T), Math.min(T, map.h - iy * T));
      }
    }

    for (const r of map.regions) {
      g.fillStyle = r.color;
      if (r.kind === 'circle') {
        g.beginPath(); g.arc(r.x, r.y, r.r, 0, TAU); g.fill();
      } else {
        g.fillRect(r.x, r.y, r.w, r.h);
        if (r.planks) {
          g.strokeStyle = 'rgba(0,0,0,.3)';
          g.lineWidth = 1.5;
          g.beginPath();
          for (let x = r.x + 14; x < r.x + r.w; x += 14) { g.moveTo(x, r.y); g.lineTo(x, r.y + r.h); }
          g.stroke();
          g.strokeStyle = '#3f2f1e';
          g.lineWidth = 4;
          g.beginPath();
          g.moveTo(r.x, r.y + 3); g.lineTo(r.x + r.w, r.y + 3);
          g.moveTo(r.x, r.y + r.h - 3); g.lineTo(r.x + r.w, r.y + r.h - 3);
          g.stroke();
        }
      }
    }
  }

  #drawMapProps(g, ctx, map) {
    if (map.walled) this.#drawTownWall(g, map);
    // cull decorations to the view (wide margin: the castle is ~700px tall)
    const { camera } = ctx;
    const vx0 = camera.x - this.width / 2 - 360, vx1 = camera.x + this.width / 2 + 360;
    const vy0 = camera.y - this.height / 2 - 400, vy1 = camera.y + this.height / 2 + 80;
    for (const d of map.decos) {
      if (d.x < vx0 || d.x > vx1 || d.y < vy0 || d.y > vy1) continue;
      this.#drawDeco(g, d);
    }
    for (const gate of map.gates) this.#drawGate(g, gate);
  }

  #drawTownWall(g, map) {
    g.strokeStyle = '#3c3c46';
    g.lineWidth = 26;
    g.strokeRect(-13, -13, map.w + 26, map.h + 26);
    g.strokeStyle = '#4a4a56';
    g.lineWidth = 12;
    g.strokeRect(-13, -13, map.w + 26, map.h + 26);
    for (const [cx, cy] of [[0, 0], [map.w, 0], [0, map.h], [map.w, map.h]]) {
      g.fillStyle = '#3c3c46';
      g.beginPath(); g.arc(cx, cy, 34, 0, TAU); g.fill();
      g.fillStyle = '#52525e';
      g.beginPath(); g.arc(cx, cy, 24, 0, TAU); g.fill();
    }
  }

  #drawGate(g, gate) {
    if (gate.style === 'none') return;
    const pulse = 0.5 + Math.sin(performance.now() / 400) * 0.25;
    g.save();
    g.globalAlpha = 0.15 + 0.3 * pulse;
    g.fillStyle = '#a5b4fc';
    g.beginPath(); g.ellipse(gate.x, gate.y, gate.r * 0.8, gate.r * 0.4, 0, 0, TAU); g.fill();
    g.restore();

    if (gate.style === 'arch') {
      g.fillStyle = '#57534e';
      g.fillRect(gate.x - 58, gate.y - 96, 18, 96);
      g.fillRect(gate.x + 40, gate.y - 96, 18, 96);
      g.fillStyle = '#44403c';
      g.fillRect(gate.x - 62, gate.y - 108, 26, 14);
      g.fillRect(gate.x + 36, gate.y - 108, 26, 14);
      g.fillStyle = '#6b5a4b';
      g.fillRect(gate.x - 62, gate.y - 124, 124, 18);
    } else if (gate.style === 'dock') {
      g.fillStyle = '#5b4633';
      g.fillRect(gate.x + 27, gate.y - 54, 6, 54);
      g.fillStyle = '#8f6b45';
      g.fillRect(gate.x + 4, gate.y - 68, 52, 18);
      g.strokeStyle = '#5b4633';
      g.lineWidth = 2;
      g.strokeRect(gate.x + 4, gate.y - 68, 52, 18);
    }

    g.font = 'bold 13px "Segoe UI",sans-serif';
    g.textAlign = 'center';
    g.globalAlpha = 0.9;
    g.fillStyle = '#e2e8f0';
    g.fillText(gate.label, gate.x, gate.y - (gate.style === 'arch' ? 132 : 76));
    g.globalAlpha = 1;
  }

  /** Soft mist along the stage edges — the world simply fades out there. */
  #drawFog(g, map) {
    const F = 170;
    const c0 = 'rgba(11,14,20,0.95)';
    const c1 = 'rgba(11,14,20,0)';
    const bands = [
      [0, 0, 0, F, 0, 0, map.w, F],                    // top
      [0, map.h, 0, map.h - F, 0, map.h - F, map.w, F], // bottom
      [0, 0, F, 0, 0, 0, F, map.h],                     // left
      [map.w, 0, map.w - F, 0, map.w - F, 0, F, map.h], // right
    ];
    for (const [gx0, gy0, gx1, gy1, rx, ry, rw, rh] of bands) {
      const grad = g.createLinearGradient(gx0, gy0, gx1, gy1);
      grad.addColorStop(0, c0);
      grad.addColorStop(1, c1);
      g.fillStyle = grad;
      g.fillRect(rx, ry, rw, rh);
    }
  }

  #drawDeco(g, d) {
    const s = d.s;
    g.save();
    g.translate(d.x, d.y);
    if (d.rot) g.rotate(d.rot);
    g.scale(s, s);
    // shared shadow (skipped for things floating on water or self-grounded)
    if (!NO_SHADOW.has(d.type)) {
      g.globalAlpha = 0.25;
      g.fillStyle = '#000';
      g.beginPath(); g.ellipse(0, 2, 10, 4, 0, 0, TAU); g.fill();
      g.globalAlpha = 1;
    }
    // a destroyed building is just a sad pile now
    if (d.destroyed) {
      g.fillStyle = '#44403c';
      g.beginPath(); g.ellipse(0, -6, 46, 16, 0, 0, TAU); g.fill();
      g.fillStyle = '#57534e';
      g.beginPath(); g.ellipse(-14, -12, 20, 9, 0.2, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(16, -10, 16, 8, -0.25, 0, TAU); g.fill();
      g.strokeStyle = '#292524'; g.lineWidth = 3.5; g.lineCap = 'round';
      g.beginPath();
      g.moveTo(-30, -8); g.lineTo(-8, -26);
      g.moveTo(22, -6); g.lineTo(4, -24);
      g.stroke();
      g.globalCompositeOperation = 'lighter';
      const glow = 0.3 + Math.sin(performance.now() / 400 + d.x) * 0.15;
      g.globalAlpha = glow;
      g.fillStyle = '#f97316';
      g.beginPath(); g.arc(-6, -10, 2.5, 0, TAU); g.arc(10, -8, 2, 0, TAU); g.fill();
      g.restore();
      return;
    }
    switch (d.type) {
      case 'tree':
        g.fillStyle = '#4a3728'; g.fillRect(-2.5, -14, 5, 16);
        g.fillStyle = '#1d3a24';
        g.beginPath(); g.arc(-6, -20, 10, 0, TAU); g.arc(7, -18, 9, 0, TAU); g.arc(0, -28, 11, 0, TAU); g.fill();
        break;
      case 'pine':
        g.fillStyle = '#4a3728'; g.fillRect(-2, -8, 4, 10);
        g.fillStyle = '#24413d';
        g.beginPath(); g.moveTo(0, -42); g.lineTo(12, -8); g.lineTo(-12, -8); g.closePath(); g.fill();
        g.fillStyle = '#dbeafe';
        g.beginPath(); g.moveTo(0, -42); g.lineTo(5, -28); g.lineTo(-5, -28); g.closePath(); g.fill();
        break;
      case 'cactus':
        g.fillStyle = '#2f5d3a';
        g.fillRect(-4, -26, 8, 28);
        g.fillRect(-14, -18, 8, 4); g.fillRect(-14, -18, 4, 10);
        g.fillRect(6, -22, 8, 4); g.fillRect(10, -22, 4, 8);
        break;
      case 'rock':
      case 'snowrock':
        g.fillStyle = '#4b5563';
        g.beginPath(); g.moveTo(-11, 2); g.lineTo(-6, -10); g.lineTo(4, -12); g.lineTo(11, 2); g.closePath(); g.fill();
        if (d.type === 'snowrock') {
          g.fillStyle = '#e2e8f0';
          g.beginPath(); g.moveTo(-6, -10); g.lineTo(4, -12); g.lineTo(7, -6); g.lineTo(-8, -5); g.closePath(); g.fill();
        }
        break;
      case 'flower': {
        const colors = ['#f9a8d4', '#fde047', '#c4b5fd', '#fca5a5'];
        g.strokeStyle = '#3f6212'; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -7); g.stroke();
        g.fillStyle = colors[Math.floor(d.v * colors.length)];
        g.beginPath(); g.arc(0, -9, 3.4, 0, TAU); g.fill();
        g.fillStyle = '#fef9c3';
        g.beginPath(); g.arc(0, -9, 1.3, 0, TAU); g.fill();
        break;
      }
      case 'mushroom':
        g.fillStyle = '#e7e5e4'; g.fillRect(-2, -8, 4, 9);
        g.fillStyle = d.v > 0.5 ? '#b45309' : '#9f1239';
        g.beginPath(); g.arc(0, -8, 7, Math.PI, 0); g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,255,255,.7)';
        g.beginPath(); g.arc(-3, -10, 1.4, 0, TAU); g.arc(3, -9, 1.1, 0, TAU); g.fill();
        break;
      case 'deadtree':
        g.strokeStyle = '#57534e'; g.lineWidth = 3; g.lineCap = 'round';
        g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -24); g.moveTo(0, -14); g.lineTo(-9, -22); g.moveTo(0, -19); g.lineTo(8, -27); g.stroke();
        break;
      case 'puddle':
        g.fillStyle = 'rgba(56,130,180,.28)';
        g.beginPath(); g.ellipse(0, 0, 14, 6, 0, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(148,200,230,.25)'; g.lineWidth = 1;
        g.beginPath(); g.ellipse(0, 0, 10, 4, 0, 0, TAU); g.stroke();
        break;
      case 'bones':
        g.strokeStyle = '#d6d3d1'; g.lineWidth = 2; g.lineCap = 'round';
        g.beginPath(); g.moveTo(-8, -2); g.lineTo(8, -4); g.moveTo(-4, -8); g.lineTo(-3, 2); g.moveTo(3, -9); g.lineTo(4, 1); g.stroke();
        break;
      case 'iceshard':
        g.fillStyle = 'rgba(165,243,252,.8)';
        g.beginPath(); g.moveTo(0, -20); g.lineTo(6, 0); g.lineTo(-6, 0); g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,255,255,.5)';
        g.beginPath(); g.moveTo(0, -20); g.lineTo(2, 0); g.lineTo(-2, 0); g.closePath(); g.fill();
        break;
      case 'ember': {
        const pulse = 0.5 + Math.sin(performance.now() / 300 + d.v * 9) * 0.3;
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = pulse;
        g.fillStyle = '#f97316';
        g.beginPath(); g.arc(0, -3, 3.5, 0, TAU); g.fill();
        g.globalAlpha = pulse * 0.4;
        g.beginPath(); g.arc(0, -3, 7, 0, TAU); g.fill();
        break;
      }
      case 'bush':
        g.fillStyle = '#1d3a24';
        g.beginPath(); g.arc(-6, -6, 8, 0, TAU); g.arc(6, -6, 8, 0, TAU); g.arc(0, -11, 8, 0, TAU); g.fill();
        break;
      case 'house': {
        g.fillStyle = d.v > 0.5 ? '#a08a6a' : '#8f7a5c';
        g.fillRect(-55, -62, 110, 60);
        g.strokeStyle = '#5b4633'; g.lineWidth = 3;
        g.strokeRect(-55, -62, 110, 60);
        g.beginPath(); g.moveTo(-55, -34); g.lineTo(55, -34); g.stroke();
        g.fillStyle = d.v > 0.5 ? '#7a3b2e' : '#5f5347';
        g.beginPath(); g.moveTo(-64, -60); g.lineTo(0, -98); g.lineTo(64, -60); g.closePath(); g.fill();
        g.fillStyle = '#4a3728'; g.fillRect(-10, -30, 20, 28);
        g.fillStyle = this.lightsOn ? '#f5d76e' : '#454a58';
        g.fillRect(-42, -52, 14, 12); g.fillRect(28, -52, 14, 12);
        g.strokeStyle = '#5b4633'; g.lineWidth = 1.5;
        g.strokeRect(-42, -52, 14, 12); g.strokeRect(28, -52, 14, 12);
        break;
      }
      case 'shop': {
        g.fillStyle = '#9b8468';
        g.fillRect(-58, -60, 116, 58);
        g.strokeStyle = '#57462f'; g.lineWidth = 3;
        g.strokeRect(-58, -60, 116, 58);
        g.fillStyle = '#6d5844'; g.fillRect(-64, -70, 128, 12);
        // striped awning over the counter
        const c = d.v > 0.66 ? '#b45309' : d.v > 0.33 ? '#166534' : '#9f1239';
        for (let i = 0; i < 6; i++) {
          g.fillStyle = i % 2 ? '#e7e5e4' : c;
          g.fillRect(-60 + i * 20, -58, 20, 16);
        }
        g.strokeStyle = '#57462f'; g.lineWidth = 2;
        g.strokeRect(-60, -58, 120, 16);
        g.fillStyle = '#4a3728'; g.fillRect(-12, -30, 24, 28);
        if (this.dark > 0.3) {
          // closed for the night: boards over the door
          g.strokeStyle = '#8a6b3a'; g.lineWidth = 3;
          g.beginPath();
          g.moveTo(-13, -28); g.lineTo(13, -6);
          g.moveTo(13, -28); g.lineTo(-13, -6);
          g.stroke();
        }
        g.fillStyle = this.dark > 0.3 ? '#454a58' : '#f5d76e';
        g.fillRect(30, -34, 16, 14);
        g.strokeStyle = '#57462f'; g.lineWidth = 1.5; g.strokeRect(30, -34, 16, 14);
        break;
      }
      case 'hut': {
        g.fillStyle = '#9c7b52';
        g.fillRect(-34, -40, 68, 38);
        g.strokeStyle = '#6d5233'; g.lineWidth = 2;
        g.strokeRect(-34, -40, 68, 38);
        g.fillStyle = '#c19a56';
        g.beginPath(); g.moveTo(-46, -38); g.lineTo(0, -74); g.lineTo(46, -38); g.closePath(); g.fill();
        g.strokeStyle = '#8a6b3a'; g.lineWidth = 2;
        g.beginPath();
        g.moveTo(-30, -42); g.lineTo(0, -66);
        g.moveTo(30, -42); g.lineTo(0, -66);
        g.stroke();
        g.fillStyle = '#4a3728';
        g.beginPath(); g.arc(0, -22, 10, Math.PI, 0); g.rect(-10, -22, 20, 20); g.fill();
        break;
      }
      case 'stall': {
        g.fillStyle = '#7c5a3a'; g.fillRect(-30, -26, 60, 24);
        g.fillStyle = '#8f6b45'; g.fillRect(-33, -30, 66, 6);
        const goods = ['#f87171', '#fbbf24', '#4ade80'][Math.floor(d.v * 3) % 3];
        g.fillStyle = goods;
        g.beginPath(); g.arc(-14, -33, 5, 0, TAU); g.arc(-4, -34, 5, 0, TAU); g.arc(8, -33, 5, 0, TAU); g.fill();
        g.fillStyle = '#5b4633'; g.fillRect(-32, -58, 4, 28); g.fillRect(28, -58, 4, 28);
        const awn = d.v > 0.5 ? '#b91c1c' : '#1d4ed8';
        for (let i = 0; i < 6; i++) {
          g.fillStyle = i % 2 ? '#f1f5f9' : awn;
          g.fillRect(-38 + i * 12.7, -66, 12.7, 12);
        }
        g.strokeStyle = '#5b4633'; g.lineWidth = 2;
        g.strokeRect(-38, -66, 76, 12);
        break;
      }
      case 'well': {
        g.fillStyle = '#6b7280';
        g.beginPath(); g.ellipse(0, -6, 24, 14, 0, 0, TAU); g.fill();
        g.fillStyle = '#111827';
        g.beginPath(); g.ellipse(0, -8, 16, 8, 0, 0, TAU); g.fill();
        g.fillStyle = '#5b4633'; g.fillRect(-22, -46, 4, 36); g.fillRect(18, -46, 4, 36);
        g.fillStyle = '#7a3b2e';
        g.beginPath(); g.moveTo(-30, -44); g.lineTo(0, -62); g.lineTo(30, -44); g.closePath(); g.fill();
        g.strokeStyle = '#d6d3d1'; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(0, -56); g.lineTo(0, -30); g.stroke();
        g.fillStyle = '#8f6b45'; g.fillRect(-4, -30, 8, 7);
        break;
      }
      case 'lamp': {
        g.fillStyle = '#2f2f3a';
        g.fillRect(-2.5, -52, 5, 52);
        g.fillRect(-8, -54, 16, 4);
        if (this.lightsOn) {
          const flick = 0.75 + Math.sin(performance.now() / 230 + d.v * 8) * 0.15;
          g.globalCompositeOperation = 'lighter';
          g.globalAlpha = flick;
          g.fillStyle = '#fbbf24';
          g.fillRect(-5, -50, 10, 12);
          g.globalAlpha = flick * 0.35;
          g.beginPath(); g.arc(0, -44, 22, 0, TAU); g.fill();
        } else {
          g.fillStyle = '#565661';
          g.fillRect(-5, -50, 10, 12);
        }
        break;
      }
      case 'fence':
        g.strokeStyle = '#7c5a3a'; g.lineWidth = 3; g.lineCap = 'round';
        g.beginPath();
        g.moveTo(-24, 0); g.lineTo(-24, -14);
        g.moveTo(0, 0); g.lineTo(0, -15);
        g.moveTo(24, 0); g.lineTo(24, -14);
        g.moveTo(-27, -6); g.lineTo(27, -6);
        g.moveTo(-27, -12); g.lineTo(27, -12);
        g.stroke();
        break;
      case 'crate':
        g.fillStyle = '#8f6b45'; g.fillRect(-11, -22, 22, 22);
        g.strokeStyle = '#5b4633'; g.lineWidth = 2;
        g.strokeRect(-11, -22, 22, 22);
        g.beginPath(); g.moveTo(-11, -22); g.lineTo(11, 0); g.moveTo(11, -22); g.lineTo(-11, 0); g.stroke();
        break;
      case 'barrel':
        g.fillStyle = '#7c5a3a';
        g.beginPath(); g.ellipse(0, -12, 10, 13, 0, 0, TAU); g.fill();
        g.strokeStyle = '#3f3f46'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(-10, -17); g.lineTo(10, -17); g.moveTo(-10, -7); g.lineTo(10, -7); g.stroke();
        g.fillStyle = '#8f6b45';
        g.beginPath(); g.ellipse(0, -24, 9, 3.5, 0, 0, TAU); g.fill();
        break;
      case 'palm': {
        const sway = Math.sin(performance.now() / 900 + d.v * 7) * 2;
        g.strokeStyle = '#8a6b3a'; g.lineWidth = 5; g.lineCap = 'round';
        g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(6, -22, 14 + sway, -44); g.stroke();
        const tx = 14 + sway, ty = -44;
        g.strokeStyle = '#15803d'; g.lineWidth = 3;
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI * (0.15 + i * 0.18);
          g.beginPath();
          g.moveTo(tx, ty);
          g.quadraticCurveTo(tx + Math.cos(a) * 18, ty + Math.sin(a) * 18 - 4, tx + Math.cos(a) * 30, ty + Math.sin(a) * 22 + 6);
          g.stroke();
        }
        g.fillStyle = '#78350f';
        g.beginPath(); g.arc(tx - 3, ty + 3, 3, 0, TAU); g.arc(tx + 4, ty + 4, 3, 0, TAU); g.fill();
        break;
      }
      case 'banner': {
        g.fillStyle = '#3f3f46'; g.fillRect(-2, -58, 4, 58);
        const flag = ['#b91c1c', '#1d4ed8', '#a16207'][Math.floor(d.v * 3) % 3];
        const flap = Math.sin(performance.now() / 500 + d.v * 9) * 3;
        g.fillStyle = flag;
        g.beginPath(); g.moveTo(2, -56); g.lineTo(26 + flap, -50); g.lineTo(2, -42); g.closePath(); g.fill();
        break;
      }
      case 'wave': {
        const ph = (performance.now() / 1600 + d.v * 3) % 3;
        const a = ph < 1.5 ? ph / 1.5 : (3 - ph) / 1.5;
        g.globalAlpha = a * 0.35;
        g.strokeStyle = '#bae6fd'; g.lineWidth = 2; g.lineCap = 'round';
        g.beginPath();
        g.arc(-6, 0, 7, Math.PI * 1.1, Math.PI * 1.9);
        g.moveTo(14, 2);
        g.arc(8, 2, 6, Math.PI * 1.1, Math.PI * 1.9);
        g.stroke();
        break;
      }
      case 'searock':
        g.strokeStyle = 'rgba(224,242,254,.5)'; g.lineWidth = 3;
        g.beginPath(); g.ellipse(0, 2, 20, 9, 0, 0, TAU); g.stroke();
        g.fillStyle = '#57534e';
        g.beginPath();
        g.moveTo(-16, 4); g.lineTo(-9, -14); g.lineTo(2, -18); g.lineTo(14, -8); g.lineTo(17, 4);
        g.closePath(); g.fill();
        g.fillStyle = '#44403c';
        g.beginPath();
        g.moveTo(2, -18); g.lineTo(14, -8); g.lineTo(17, 4); g.lineTo(4, 4);
        g.closePath(); g.fill();
        break;
      case 'dockpost':
        g.fillStyle = '#5b4633';
        g.fillRect(-4, -22, 8, 22);
        g.fillStyle = '#3f2f1e';
        g.beginPath(); g.ellipse(0, -22, 4, 2, 0, 0, TAU); g.fill();
        break;
      case 'dockboat': {
        const bob = Math.sin(performance.now() / 600 + d.v * 5) * 1.5;
        g.translate(0, bob);
        g.fillStyle = '#7f1d1d';
        g.beginPath();
        g.moveTo(-22, -6); g.quadraticCurveTo(0, 6, 22, -6);
        g.lineTo(16, -14); g.lineTo(-16, -14);
        g.closePath(); g.fill();
        g.strokeStyle = '#fbbf24'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(-19, -11); g.lineTo(19, -11); g.stroke();
        break;
      }
      case 'campfire': {
        g.strokeStyle = '#5b4633'; g.lineWidth = 4; g.lineCap = 'round';
        g.beginPath(); g.moveTo(-10, -2); g.lineTo(10, -6); g.moveTo(-10, -6); g.lineTo(10, -2); g.stroke();
        const f = 0.7 + Math.sin(performance.now() / 120 + d.v * 9) * 0.25;
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = f;
        g.fillStyle = '#f97316';
        g.beginPath();
        g.moveTo(0, -22 - f * 4); g.quadraticCurveTo(8, -12, 0, -4); g.quadraticCurveTo(-8, -12, 0, -22 - f * 4);
        g.fill();
        g.fillStyle = '#fde047';
        g.beginPath();
        g.moveTo(0, -14); g.quadraticCurveTo(4, -9, 0, -5); g.quadraticCurveTo(-4, -9, 0, -14);
        g.fill();
        g.globalAlpha = f * 0.3;
        g.fillStyle = '#fb923c';
        g.beginPath(); g.arc(0, -10, 20, 0, TAU); g.fill();
        break;
      }
      case 'fountain': {
        g.strokeStyle = '#8a93a3'; g.lineWidth = 8;
        g.beginPath(); g.arc(0, 0, 66, 0, TAU); g.stroke();
        g.strokeStyle = '#6b7280'; g.lineWidth = 3;
        g.beginPath(); g.arc(0, 0, 71, 0, TAU); g.stroke();
        g.fillStyle = '#9ca3af';
        g.beginPath(); g.ellipse(0, -2, 18, 8, 0, 0, TAU); g.fill();
        g.fillStyle = '#7b8494'; g.fillRect(-6, -34, 12, 32);
        g.fillStyle = '#9ca3af';
        g.beginPath(); g.ellipse(0, -34, 12, 5, 0, 0, TAU); g.fill();
        const t = performance.now() / 240;
        g.strokeStyle = 'rgba(125,211,252,.7)'; g.lineWidth = 2;
        g.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU + Math.sin(t / 3) * 0.2;
          const dx = Math.cos(a), dy = Math.sin(a) * 0.45;
          g.moveTo(0, -34);
          g.quadraticCurveTo(dx * 20, -46 + dy * 8, dx * 34, -8 + dy * 22);
        }
        g.stroke();
        g.fillStyle = 'rgba(186,230,253,.8)';
        for (let i = 0; i < 5; i++) {
          const ph = (t * 0.5 + i * 0.2) % 1;
          const a = i * 1.26;
          g.beginPath();
          g.arc(Math.cos(a) * (10 + ph * 26), -38 + ph * ph * 36 + Math.sin(a) * 6, 2, 0, TAU);
          g.fill();
        }
        break;
      }
      case 'castle': {
        // central keep behind the curtain wall
        g.fillStyle = '#4b5563';
        g.fillRect(-90, -252, 180, 140);
        g.fillStyle = '#3b5aa6';
        g.beginPath(); g.moveTo(-102, -248); g.lineTo(0, -318); g.lineTo(102, -248); g.closePath(); g.fill();
        g.fillStyle = '#f5d76e';
        g.fillRect(-58, -228, 14, 20); g.fillRect(44, -228, 14, 20); g.fillRect(-7, -238, 14, 20);
        g.strokeStyle = '#374151'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(0, -318); g.lineTo(0, -344); g.stroke();
        g.fillStyle = '#b91c1c';
        g.beginPath(); g.moveTo(0, -344); g.lineTo(22, -338); g.lineTo(0, -330); g.closePath(); g.fill();
        // flanking towers
        for (const tx of [-262, 262]) {
          g.fillStyle = '#565f6e';
          g.fillRect(tx - 36, -196, 72, 194);
          g.fillStyle = '#3b5aa6';
          g.beginPath(); g.moveTo(tx - 46, -192); g.lineTo(tx, -262); g.lineTo(tx + 46, -192); g.closePath(); g.fill();
          g.fillStyle = '#f5d76e';
          g.fillRect(tx - 8, -170, 16, 22);
          g.strokeStyle = '#374151'; g.lineWidth = 3;
          g.beginPath(); g.moveTo(tx, -262); g.lineTo(tx, -286); g.stroke();
          g.fillStyle = '#b91c1c';
          g.beginPath(); g.moveTo(tx, -286); g.lineTo(tx + 18, -281); g.lineTo(tx, -275); g.closePath(); g.fill();
        }
        // curtain wall with crenellations
        g.fillStyle = '#6b7280';
        g.fillRect(-262, -120, 524, 120);
        g.fillStyle = '#7b8494';
        for (let x = -262; x < 262; x += 30) g.fillRect(x, -134, 18, 14);
        g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 1.5;
        g.beginPath();
        for (let y = -96; y < -10; y += 26) { g.moveTo(-262, y); g.lineTo(262, y); }
        g.stroke();
        // sealed gate + portcullis
        g.fillStyle = '#20242e';
        g.beginPath();
        g.moveTo(-38, 0); g.lineTo(-38, -58);
        g.arc(0, -58, 38, Math.PI, 0);
        g.lineTo(38, 0);
        g.closePath(); g.fill();
        g.strokeStyle = '#8a93a3'; g.lineWidth = 3;
        g.beginPath();
        for (let x = -28; x <= 28; x += 14) { g.moveTo(x, -2); g.lineTo(x, -78); }
        g.moveTo(-36, -30); g.lineTo(36, -30);
        g.moveTo(-36, -58); g.lineTo(36, -58);
        g.stroke();
        break;
      }
      case 'windmill': {
        // tower
        g.fillStyle = '#8f7a5c';
        g.beginPath(); g.moveTo(-30, 0); g.lineTo(-16, -90); g.lineTo(16, -90); g.lineTo(30, 0); g.closePath(); g.fill();
        g.strokeStyle = '#5b4633'; g.lineWidth = 2.5;
        g.beginPath(); g.moveTo(-30, 0); g.lineTo(-16, -90); g.lineTo(16, -90); g.lineTo(30, 0); g.closePath(); g.stroke();
        g.fillStyle = '#7a3b2e';
        g.beginPath(); g.arc(0, -92, 18, Math.PI, 0); g.closePath(); g.fill();
        g.fillStyle = '#4a3728'; g.fillRect(-9, -26, 18, 26);
        // sails, turning with the hour
        const spin = performance.now() / 2400;
        g.save();
        g.translate(0, -92);
        g.strokeStyle = '#d6d3d1'; g.lineWidth = 3; g.lineCap = 'round';
        g.fillStyle = 'rgba(214,211,209,.4)';
        for (let i = 0; i < 4; i++) {
          const a = spin + (i * Math.PI) / 2;
          const bx = Math.cos(a) * 46, by = Math.sin(a) * 46;
          g.beginPath(); g.moveTo(0, 0); g.lineTo(bx, by); g.stroke();
          g.beginPath();
          g.moveTo(Math.cos(a) * 10, Math.sin(a) * 10);
          g.lineTo(bx, by);
          g.lineTo(bx + Math.cos(a + Math.PI / 2) * 12, by + Math.sin(a + Math.PI / 2) * 12);
          g.closePath(); g.fill();
        }
        g.fillStyle = '#5b4633';
        g.beginPath(); g.arc(0, 0, 4, 0, TAU); g.fill();
        g.restore();
        break;
      }
      case 'ship': {
        // a big anchored two-master, seen from the side
        const bob = Math.sin(performance.now() / 900) * 2;
        g.translate(0, bob);
        g.strokeStyle = 'rgba(224,242,254,.3)'; g.lineWidth = 3;
        g.beginPath(); g.ellipse(0, 6, 130, 18, 0, 0, TAU); g.stroke();
        g.fillStyle = '#3f2f1e';
        g.beginPath();
        g.moveTo(-120, -30);
        g.quadraticCurveTo(-90, 10, 0, 14);
        g.quadraticCurveTo(90, 10, 128, -38);
        g.lineTo(104, -44); g.lineTo(-104, -44); g.closePath(); g.fill();
        g.strokeStyle = '#8a6b3a'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(-110, -36); g.lineTo(115, -40); g.stroke();
        // masts + tattered sails
        g.fillStyle = '#57432b';
        g.fillRect(-52, -150, 7, 110); g.fillRect(38, -136, 7, 96);
        g.fillStyle = 'rgba(226,232,240,.75)';
        g.beginPath(); g.moveTo(-48, -142); g.quadraticCurveTo(-8, -120, -46, -78); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(42, -128); g.quadraticCurveTo(78, -110, 44, -72); g.closePath(); g.fill();
        // tattered flag
        g.fillStyle = '#1c1917';
        g.beginPath(); g.moveTo(-45, -150); g.lineTo(-20, -144); g.lineTo(-45, -138); g.closePath(); g.fill();
        break;
      }
      case 'mast':
        g.fillStyle = '#57432b';
        g.fillRect(-8, -110, 16, 110);
        g.strokeStyle = '#3f2f1e'; g.lineWidth = 2;
        g.strokeRect(-8, -110, 16, 110);
        g.fillStyle = 'rgba(226,232,240,.8)';
        g.beginPath(); g.moveTo(10, -104); g.quadraticCurveTo(58, -80, 12, -40); g.closePath(); g.fill();
        g.fillStyle = '#3f2f1e';
        g.beginPath(); g.ellipse(0, 0, 16, 6, 0, 0, TAU); g.fill();
        break;
      case 'wheel': {
        g.fillStyle = '#57432b'; g.fillRect(-4, -34, 8, 34);
        g.strokeStyle = '#8a6b3a'; g.lineWidth = 3;
        const rock = Math.sin(performance.now() / 1800) * 0.3;
        g.save();
        g.translate(0, -40);
        g.rotate(rock);
        g.beginPath(); g.arc(0, 0, 13, 0, TAU); g.stroke();
        g.beginPath();
        for (let i = 0; i < 4; i++) {
          const a = (i * Math.PI) / 4;
          g.moveTo(Math.cos(a) * 18, Math.sin(a) * 18);
          g.lineTo(-Math.cos(a) * 18, -Math.sin(a) * 18);
        }
        g.stroke();
        g.restore();
        break;
      }
      case 'cannon':
        g.fillStyle = '#1c1917';
        g.beginPath(); g.ellipse(8, -10, 16, 6, 0, 0, TAU); g.fill();
        g.fillStyle = '#292524';
        g.beginPath(); g.arc(-6, -10, 8, 0, TAU); g.fill();
        g.fillStyle = '#57432b';
        g.fillRect(-14, -6, 18, 6);
        break;
      case 'column':
        g.fillStyle = '#565f6e';
        g.fillRect(-12, -70, 24, 70);
        g.fillStyle = '#6b7280';
        g.fillRect(-16, -76, 32, 8);
        g.fillRect(-16, -4, 32, 6);
        g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(-5, -70); g.lineTo(-5, -4);
        g.moveTo(5, -70); g.lineTo(5, -4);
        g.stroke();
        break;
      case 'throne':
        g.fillStyle = '#6d1a1a';
        g.fillRect(-20, -56, 40, 52);
        g.fillStyle = '#a16207';
        g.beginPath();
        g.moveTo(-20, -56); g.lineTo(-14, -70) ; g.lineTo(-6, -58);
        g.lineTo(0, -72); g.lineTo(6, -58); g.lineTo(14, -70); g.lineTo(20, -56);
        g.closePath(); g.fill();
        g.fillRect(-26, -30, 8, 28); g.fillRect(18, -30, 8, 28);
        g.fillStyle = '#7f1d1d';
        g.fillRect(-14, -40, 28, 34);
        break;
      case 'torch': {
        g.fillStyle = '#3f2f1e';
        g.fillRect(-2.5, -36, 5, 36);
        g.fillStyle = '#57432b';
        g.beginPath(); g.moveTo(-5, -34); g.lineTo(5, -34); g.lineTo(3, -42); g.lineTo(-3, -42); g.closePath(); g.fill();
        const f = 0.7 + Math.sin(performance.now() / 110 + d.v * 9) * 0.25;
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = f;
        g.fillStyle = '#f97316';
        g.beginPath();
        g.moveTo(0, -56 - f * 4); g.quadraticCurveTo(6, -46, 0, -40); g.quadraticCurveTo(-6, -46, 0, -56 - f * 4);
        g.fill();
        g.globalAlpha = f * 0.3;
        g.beginPath(); g.arc(0, -46, 18, 0, TAU); g.fill();
        break;
      }
      case 'cellbars':
        g.fillStyle = '#1c1c22';
        g.fillRect(-60, -46, 120, 46);
        g.strokeStyle = '#6b7280'; g.lineWidth = 3;
        g.beginPath();
        for (let x = -52; x <= 52; x += 13) { g.moveTo(x, 0); g.lineTo(x, -44); }
        g.moveTo(-60, -44); g.lineTo(60, -44);
        g.stroke();
        break;
      case 'tent': {
        const c = d.v > 0.5 ? '#5c4430' : '#4a4a35';
        g.fillStyle = c;
        g.beginPath(); g.moveTo(-42, 0); g.lineTo(0, -46); g.lineTo(42, 0); g.closePath(); g.fill();
        g.fillStyle = 'rgba(0,0,0,.4)';
        g.beginPath(); g.moveTo(-12, 0); g.lineTo(0, -22); g.lineTo(12, 0); g.closePath(); g.fill();
        g.strokeStyle = '#3f2f1e'; g.lineWidth = 2.5;
        g.beginPath(); g.moveTo(0, -46); g.lineTo(0, -54); g.stroke();
        g.fillStyle = '#84cc16';
        g.beginPath(); g.moveTo(0, -54); g.lineTo(10, -51); g.lineTo(0, -48); g.closePath(); g.fill();
        break;
      }
      case 'totem':
      case 'jangseung': {
        // carved guardian post — goblin totems snarl, jangseung smile
        const friendly = d.type === 'jangseung';
        g.fillStyle = friendly ? '#8a6b3a' : '#57534e';
        g.fillRect(-8, -58, 16, 58);
        g.strokeStyle = friendly ? '#6d5233' : '#3f3f46'; g.lineWidth = 2;
        g.strokeRect(-8, -58, 16, 58);
        g.beginPath(); g.moveTo(-8, -20); g.lineTo(8, -20); g.moveTo(-8, -38); g.lineTo(8, -38); g.stroke();
        // face
        g.fillStyle = '#111827';
        g.beginPath(); g.arc(-3.5, -48, 1.8, 0, TAU); g.arc(3.5, -48, 1.8, 0, TAU); g.fill();
        g.strokeStyle = '#111827'; g.lineWidth = 2;
        g.beginPath();
        if (friendly) g.arc(0, -44, 4, 0.2, Math.PI - 0.2);
        else { g.moveTo(-4, -42); g.lineTo(4, -44); }
        g.stroke();
        if (friendly && d.v > 0.5) {
          // hat brim for the "grandfather" post
          g.fillStyle = '#3f2f1e';
          g.fillRect(-11, -60, 22, 4);
        }
        break;
      }
      case 'hanok': {
        // low house with a sweeping tiled roof
        g.fillStyle = '#d9c9a3';
        g.fillRect(-52, -46, 104, 44);
        g.strokeStyle = '#6d5233'; g.lineWidth = 3;
        g.strokeRect(-52, -46, 104, 44);
        g.beginPath(); g.moveTo(-18, -46); g.lineTo(-18, -2); g.moveTo(18, -46); g.lineTo(18, -2); g.stroke();
        g.fillStyle = '#4a3728'; g.fillRect(-12, -30, 24, 28);
        g.fillStyle = this.lightsOn ? '#f5d76e' : '#454a58';
        g.fillRect(-44, -38, 18, 16); g.fillRect(26, -38, 18, 16);
        // the roof: dark tiles with lifted eaves
        g.fillStyle = d.v > 0.5 ? '#374151' : '#44403c';
        g.beginPath();
        g.moveTo(-66, -42);
        g.quadraticCurveTo(-30, -52, 0, -52);
        g.quadraticCurveTo(30, -52, 66, -42);
        g.quadraticCurveTo(40, -74, 0, -76);
        g.quadraticCurveTo(-40, -74, -66, -42);
        g.closePath(); g.fill();
        g.strokeStyle = 'rgba(255,255,255,.15)'; g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(-50, -50); g.quadraticCurveTo(0, -60, 50, -50);
        g.stroke();
        break;
      }
      case 'onggi':
        g.fillStyle = '#7c4a26';
        g.beginPath();
        g.moveTo(-7, 0);
        g.quadraticCurveTo(-12, -12, -6, -20);
        g.lineTo(6, -20);
        g.quadraticCurveTo(12, -12, 7, 0);
        g.closePath(); g.fill();
        g.fillStyle = '#5c3a1e';
        g.beginPath(); g.ellipse(0, -20, 6, 2.5, 0, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 2;
        g.beginPath(); g.arc(-2, -10, 7, -1.2, 0.4); g.stroke();
        break;
      case 'torii': {
        g.fillStyle = '#b91c1c';
        g.fillRect(-34, -64, 8, 64);
        g.fillRect(26, -64, 8, 64);
        g.fillRect(-40, -58, 80, 7);
        g.beginPath();
        g.moveTo(-48, -72); g.quadraticCurveTo(0, -80, 48, -72);
        g.lineTo(48, -66); g.quadraticCurveTo(0, -74, -48, -66);
        g.closePath(); g.fill();
        g.fillStyle = '#1c1917';
        g.fillRect(-48, -70, 96, 3);
        break;
      }
      case 'pagoda': {
        g.fillStyle = '#7f1d1d';
        g.fillRect(-30, -40, 60, 38);
        g.fillStyle = '#4a3728'; g.fillRect(-10, -26, 20, 24);
        for (let t = 0; t < 3; t++) {
          const y = -38 - t * 26, w = 56 - t * 12;
          g.fillStyle = '#374151';
          g.beginPath();
          g.moveTo(-w, y); g.quadraticCurveTo(0, y - 10, w, y);
          g.lineTo(w * 0.55, y - 16); g.lineTo(-w * 0.55, y - 16);
          g.closePath(); g.fill();
          if (t < 2) { g.fillStyle = '#7f1d1d'; g.fillRect(-w * 0.5, y - 26, w, 12); }
        }
        g.strokeStyle = '#fbbf24'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(0, -96); g.lineTo(0, -106); g.stroke();
        break;
      }
      case 'stonelantern': {
        g.fillStyle = '#6b7280';
        g.fillRect(-4, -18, 8, 18);
        g.fillRect(-10, -22, 20, 5);
        g.fillStyle = '#565f6e';
        g.fillRect(-8, -34, 16, 12);
        g.fillStyle = '#6b7280';
        g.beginPath(); g.moveTo(-12, -34); g.lineTo(0, -44) ; g.lineTo(12, -34); g.closePath(); g.fill();
        if (this.lightsOn) {
          g.globalCompositeOperation = 'lighter';
          const f = 0.7 + Math.sin(performance.now() / 260 + d.v * 8) * 0.15;
          g.globalAlpha = f;
          g.fillStyle = '#fbbf24';
          g.fillRect(-5, -32, 10, 8);
          g.globalAlpha = f * 0.3;
          g.beginPath(); g.arc(0, -28, 14, 0, TAU); g.fill();
        } else {
          g.fillStyle = '#3a3f4c';
          g.fillRect(-5, -32, 10, 8);
        }
        break;
      }
      case 'sakura': {
        g.fillStyle = '#5c4038'; g.fillRect(-2.5, -16, 5, 18);
        g.fillStyle = '#f9a8d4';
        g.beginPath();
        g.arc(-7, -22, 9, 0, TAU); g.arc(7, -20, 8, 0, TAU); g.arc(0, -30, 10, 0, TAU);
        g.fill();
        g.fillStyle = '#fbcfe8';
        g.beginPath(); g.arc(-2, -26, 5, 0, TAU); g.fill();
        // drifting petal
        const t = (performance.now() / 1400 + d.v * 3) % 3;
        if (t < 2) {
          g.globalAlpha = 1 - t / 2;
          g.fillStyle = '#f9a8d4';
          g.beginPath(); g.arc(10 + t * 8, -20 + t * 12, 1.6, 0, TAU); g.fill();
          g.globalAlpha = 1;
        }
        break;
      }
      case 'tower': {
        // glass office tower, lit up after dark
        const h = 120 + d.v * 70;
        g.fillStyle = d.v > 0.5 ? '#334155' : '#3f4a5c';
        g.fillRect(-50, -h, 100, h);
        g.strokeStyle = '#1e293b'; g.lineWidth = 2;
        g.strokeRect(-50, -h, 100, h);
        g.fillStyle = this.lightsOn ? '#fde68a' : '#556274';
        for (let wy = -h + 12; wy < -14; wy += 22) {
          for (let wx = -38; wx <= 22; wx += 20) {
            if ((wx * wy * (d.v * 97 | 0)) % 7 !== 1) g.fillRect(wx, wy, 12, 10);
          }
        }
        g.fillStyle = '#1e293b';
        g.fillRect(-14, -h - 10, 28, 10);
        break;
      }
      case 'merlion': {
        // half lion, half fish, all fountain
        g.fillStyle = '#e7e5e4';
        g.beginPath();
        g.moveTo(-6, -2);
        g.quadraticCurveTo(-26, -14, -18, -34); // tail curl
        g.quadraticCurveTo(-10, -44, 0, -40);
        g.lineTo(4, -40);
        g.quadraticCurveTo(16, -52, 14, -62);  // head
        g.quadraticCurveTo(4, -70, -4, -62);
        g.quadraticCurveTo(-8, -50, -2, -44);
        g.quadraticCurveTo(10, -30, 8, -2);
        g.closePath(); g.fill();
        // mane
        g.strokeStyle = '#d6d3d1'; g.lineWidth = 2.5;
        g.beginPath();
        g.arc(4, -58, 12, -1.8, 1.6);
        g.stroke();
        // fish scales on the tail
        g.strokeStyle = 'rgba(100,116,139,.5)'; g.lineWidth = 1.5;
        g.beginPath();
        g.arc(-12, -22, 5, -0.5, 1.2); g.arc(-8, -14, 5, -0.5, 1.2);
        g.stroke();
        g.fillStyle = '#111827';
        g.beginPath(); g.arc(8, -60, 1.5, 0, TAU); g.fill();
        // the spout
        g.strokeStyle = 'rgba(125,211,252,.8)'; g.lineWidth = 2.5;
        g.beginPath();
        g.moveTo(15, -58);
        g.quadraticCurveTo(34, -52, 38, -18);
        g.stroke();
        g.fillStyle = 'rgba(186,230,253,.7)';
        const t = performance.now() / 300;
        for (let i = 0; i < 3; i++) {
          const ph = (t * 0.4 + i * 0.33) % 1;
          g.beginPath(); g.arc(15 + ph * 23, -58 + ph * ph * 42, 1.8, 0, TAU); g.fill();
        }
        // plinth
        g.fillStyle = '#9ca3af';
        g.beginPath(); g.ellipse(0, 0, 22, 8, 0, 0, TAU); g.fill();
        break;
      }
      case 'bamboo': {
        const sway = Math.sin(performance.now() / 1100 + d.v * 8) * 2;
        g.strokeStyle = '#4d7c0f'; g.lineWidth = 3.5; g.lineCap = 'round';
        g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(2, -24, sway, -48); g.stroke();
        g.strokeStyle = '#365314'; g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(-2, -14); g.lineTo(3, -14);
        g.moveTo(-1.5, -30); g.lineTo(3.5, -30);
        g.stroke();
        g.strokeStyle = '#65a30d'; g.lineWidth = 2;
        g.beginPath();
        g.moveTo(sway, -48); g.lineTo(sway + 8, -54);
        g.moveTo(sway, -44); g.lineTo(sway - 7, -50);
        g.stroke();
        break;
      }
      case 'steam': {
        // slow curls rising off the hot pools
        g.globalCompositeOperation = 'lighter';
        const t = performance.now() / 1000;
        for (let i = 0; i < 3; i++) {
          const ph = (t * 0.25 + d.v + i * 0.33) % 1;
          g.globalAlpha = (1 - ph) * 0.22;
          g.fillStyle = '#e2e8f0';
          g.beginPath();
          g.arc(Math.sin((ph + d.v) * 9) * 8, -ph * 46, 7 + ph * 8, 0, TAU);
          g.fill();
        }
        break;
      }
      case 'counter':
        g.fillStyle = '#57432b';
        g.fillRect(-100, -26, 200, 26);
        g.fillStyle = '#6d5233';
        g.fillRect(-104, -32, 208, 8);
        g.strokeStyle = '#3f2f1e'; g.lineWidth = 2;
        g.beginPath();
        for (let x = -80; x <= 80; x += 40) { g.moveTo(x, -24); g.lineTo(x, -2); }
        g.stroke();
        break;
      case 'shelf':
        g.fillStyle = '#57432b';
        g.fillRect(-40, -40, 80, 40);
        g.strokeStyle = '#3f2f1e'; g.lineWidth = 2;
        g.strokeRect(-40, -40, 80, 40);
        g.beginPath(); g.moveTo(-40, -26); g.lineTo(40, -26); g.moveTo(-40, -13); g.lineTo(40, -13); g.stroke();
        // wares
        for (let i = 0; i < 4; i++) {
          g.fillStyle = ['#b91c1c', '#1d4ed8', '#a16207', '#166534'][i];
          g.fillRect(-33 + i * 18, -37 - (i % 2) * -1, 10, 9);
        }
        break;
      case 'tavern': {
        // like a house, but the windows never sleep and the sign says ale
        g.fillStyle = '#8f7a5c';
        g.fillRect(-55, -62, 110, 60);
        g.strokeStyle = '#5b4633'; g.lineWidth = 3;
        g.strokeRect(-55, -62, 110, 60);
        g.beginPath(); g.moveTo(-55, -34); g.lineTo(55, -34); g.stroke();
        g.fillStyle = '#5f3a2e';
        g.beginPath(); g.moveTo(-64, -60); g.lineTo(0, -98); g.lineTo(64, -60); g.closePath(); g.fill();
        g.fillStyle = '#4a3728'; g.fillRect(-12, -30, 24, 28);
        g.fillStyle = '#f5d76e'; // always lit — the tavern never closes
        g.fillRect(-44, -52, 15, 12); g.fillRect(29, -52, 15, 12);
        g.strokeStyle = '#5b4633'; g.lineWidth = 1.5;
        g.strokeRect(-44, -52, 15, 12); g.strokeRect(29, -52, 15, 12);
        // hanging mug sign
        g.strokeStyle = '#3f2f1e'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(55, -58); g.lineTo(66, -58); g.moveTo(66, -58); g.lineTo(66, -50); g.stroke();
        g.fillStyle = '#a16207';
        g.fillRect(61, -50, 10, 11);
        g.fillStyle = '#f8fafc';
        g.fillRect(61, -50, 10, 3);
        break;
      }
    }
    // on fire: flames lick the roofline until the rain comes (or it doesn't)
    if (d.burning > 0) {
      const t = performance.now() / 110;
      g.globalCompositeOperation = 'lighter';
      for (const [fx, fy, seed] of [[-30, -46, 1], [2, -66, 2], [28, -44, 3]]) {
        const f = 0.7 + Math.sin(t + seed * 2.1) * 0.3;
        g.globalAlpha = f;
        g.fillStyle = '#f97316';
        g.beginPath();
        g.moveTo(fx, fy - 18 - f * 8);
        g.quadraticCurveTo(fx + 9, fy - 6, fx, fy + 4);
        g.quadraticCurveTo(fx - 9, fy - 6, fx, fy - 18 - f * 8);
        g.fill();
        g.fillStyle = '#fde047';
        g.beginPath();
        g.moveTo(fx, fy - 8);
        g.quadraticCurveTo(fx + 4, fy - 2, fx, fy + 3);
        g.quadraticCurveTo(fx - 4, fy - 2, fx, fy - 8);
        g.fill();
      }
      g.globalAlpha = 0.25;
      g.fillStyle = '#fb923c';
      g.beginPath(); g.arc(0, -50, 55, 0, TAU); g.fill();
    }
    g.restore();
  }

  #drawGrid(g, camera) {
    const gs = 90;
    g.strokeStyle = 'rgba(120,140,180,.06)';
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

  #drawVignette(g) {
    const grad = g.createRadialGradient(
      this.width / 2, this.height / 2, Math.min(this.width, this.height) * 0.35,
      this.width / 2, this.height / 2, Math.max(this.width, this.height) * 0.72,
    );
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,.42)');
    g.fillStyle = grad;
    g.fillRect(0, 0, this.width, this.height);
  }

  // ---------------------------------------------------------------- alchemy

  #drawTrailFlowers(g, flowers) {
    for (const f of flowers) {
      const a = clamp(f.ttl / f.ttl0, 0, 1);
      g.globalAlpha = a * 0.9;
      const colors = ['#f9a8d4', '#fde047', '#c4b5fd', '#fca5a5', '#86efac'];
      g.strokeStyle = '#3f6212'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(f.x, f.y); g.lineTo(f.x, f.y - 5); g.stroke();
      g.fillStyle = colors[Math.floor(f.seed * colors.length)];
      g.beginPath(); g.arc(f.x, f.y - 6.5, 2.6, 0, TAU); g.fill();
    }
    g.globalAlpha = 1;
  }

  #drawZones(g, zones) {
    for (const z of zones) {
      const fade = clamp(Math.min(z.ttl * 2, z.ttl0 - z.ttl + 0.3) / 1, 0, 1);
      g.globalAlpha = 0.16 * fade;
      g.fillStyle = z.color;
      g.beginPath(); g.arc(z.x, z.y, z.r, 0, TAU); g.fill();
      g.globalAlpha = 0.5 * fade;
      g.strokeStyle = z.color;
      g.lineWidth = 2;
      g.setLineDash([6, 8]);
      g.beginPath(); g.arc(z.x, z.y, z.r, 0, TAU); g.stroke();
      g.setLineDash([]);
      g.globalAlpha = 1;
      if (z.type === 'mushroom' && z.decos) {
        for (const m of z.decos) this.#drawDeco(g, { type: 'mushroom', x: m.x, y: m.y, s: m.s, v: 0.2 });
      }
      if (z.type === 'butterfingers') {
        g.globalAlpha = 0.35 * fade;
        g.fillStyle = '#fde68a';
        g.beginPath(); g.ellipse(z.x, z.y, z.r * 0.55, z.r * 0.3, 0.3, 0, TAU); g.fill();
        g.globalAlpha = 1;
      }
    }
  }

  /** Clouds render above everything — they are up in the sky, after all. */
  #drawRainClouds(g, zones) {
    for (const z of zones) {
      if (z.type !== 'rain') continue;
      const cy = z.y - 120;
      g.globalAlpha = 0.85;
      g.fillStyle = '#334155';
      g.beginPath();
      g.arc(z.x - 34, cy, 22, 0, TAU);
      g.arc(z.x + 2, cy - 10, 27, 0, TAU);
      g.arc(z.x + 38, cy, 21, 0, TAU);
      g.fill();
      // rain streaks
      g.strokeStyle = 'rgba(96,165,250,.5)';
      g.lineWidth = 1.5;
      g.beginPath();
      const t = performance.now() / 90;
      for (let i = 0; i < 14; i++) {
        const px = z.x + ((i * 53 + 17) % (z.r * 1.6)) - z.r * 0.8;
        const phase = ((t + i * 13) % 20) / 20;
        const py = cy + 24 + phase * (z.y - cy - 30);
        g.moveTo(px, py);
        g.lineTo(px - 2, py + 10);
      }
      g.stroke();
      g.globalAlpha = 1;
    }
  }

  #drawPortals(g, portals) {
    for (const p of portals) {
      const fade = clamp(p.ttl / 2, 0, 1);
      g.save();
      g.translate(p.x, p.y);
      g.globalAlpha = fade;
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 2; i++) {
        g.strokeStyle = i === 0 ? '#38bdf8' : '#a5b4fc';
        g.lineWidth = 3 - i;
        g.beginPath();
        g.ellipse(0, -14, 16 + i * 5, 26 + i * 5, Math.sin(p.phase + i) * 0.15, p.phase + i * 2, p.phase + i * 2 + TAU * 0.8);
        g.stroke();
      }
      g.fillStyle = 'rgba(56,189,248,.25)';
      g.beginPath(); g.ellipse(0, -14, 13, 23, 0, 0, TAU); g.fill();
      g.restore();
    }
  }

  #drawDroppedWeapons(g, drops) {
    for (const w of drops) {
      g.save();
      g.translate(w.x, w.y);
      g.rotate(w.a);
      g.globalAlpha = clamp(w.t / 2, 0, 0.9);
      g.strokeStyle = '#94a3b8';
      g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(-8, 0); g.lineTo(8, 0); g.stroke();
      if (w.weapon === 'axe') {
        g.fillStyle = '#cbd5e1';
        g.beginPath(); g.moveTo(8, -5); g.lineTo(13, 0); g.lineTo(8, 5); g.closePath(); g.fill();
      } else {
        g.strokeStyle = '#64748b';
        g.beginPath(); g.moveTo(-5, -4); g.lineTo(-5, 4); g.stroke();
      }
      g.restore();
    }
    g.globalAlpha = 1;
  }

  #drawFlasks(g, flasks) {
    for (const f of flasks) {
      const h = f.height;
      g.globalAlpha = 0.3;
      g.beginPath(); g.ellipse(f.x, f.y, 7, 3.5, 0, 0, TAU); g.fillStyle = '#000'; g.fill();
      g.globalAlpha = 1;
      g.save();
      g.translate(f.x, f.y - h);
      g.rotate(f.t * 9);
      g.fillStyle = f.potion.color;
      g.beginPath(); g.arc(0, 1, 5.5, 0, TAU); g.fill();
      g.fillStyle = '#cbd5e1';
      g.fillRect(-2, -8, 4, 6);
      g.restore();
    }
  }

  // ---------------------------------------------------------------- combat

  #drawCastPreview(g, ctx) {
    const preview = ctx.activeClass?.getPreview?.(ctx);
    if (!preview) return;
    const player = ctx.world.player;
    g.save();
    g.globalAlpha = 0.35;
    g.setLineDash([4, 8]);
    g.strokeStyle = preview.color;
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(player.x, player.y - 10);
    g.lineTo(ctx.aim.x, ctx.aim.y);
    g.stroke();
    g.setLineDash([]);
    if (preview.radius) {
      g.beginPath();
      g.arc(ctx.aim.x, ctx.aim.y, preview.radius, 0, TAU);
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
      const s = w.scale;
      for (const n of w.nodes) {
        g.globalAlpha = 0.35 * fade;
        g.beginPath();
        g.ellipse(n.x, n.y + 8 * s, 16 * s, 7 * s, 0, 0, TAU);
        g.fillStyle = '#000';
        g.fill();
        g.globalAlpha = fade;
        if (w.rock) {
          g.fillStyle = '#78716c';
          g.beginPath();
          g.moveTo(n.x - 14 * s, n.y + 8 * s); g.lineTo(n.x - 8 * s, n.y - 20 * s);
          g.lineTo(n.x + 3 * s, n.y - 26 * s); g.lineTo(n.x + 14 * s, n.y + 8 * s);
          g.closePath(); g.fill();
          g.fillStyle = '#57534e';
          g.beginPath();
          g.moveTo(n.x + 3 * s, n.y - 26 * s); g.lineTo(n.x + 14 * s, n.y + 8 * s); g.lineTo(n.x + 5 * s, n.y + 8 * s);
          g.closePath(); g.fill();
        } else {
          g.fillStyle = 'rgba(234,179,8,.25)';
          g.strokeStyle = ELEMENTS.shield.color;
          g.lineWidth = 2;
          g.beginPath();
          g.arc(n.x, n.y - 6 * s, 15 * s, 0, TAU);
          g.fill();
          g.stroke();
        }
        if (w.imbue.length) {
          g.fillStyle = ELEMENTS[w.imbue[0]].color;
          g.beginPath();
          g.arc(n.x, n.y - 8 * s, 4 * s, 0, TAU);
          g.fill();
        }
      }
    }
    g.globalAlpha = 1;
  }

  #drawHealthBar(g, e, width = 44, lift = 64) {
    const pct = clamp(e.hp / e.maxHp, 0, 1);
    g.fillStyle = 'rgba(0,0,0,.55)';
    g.fillRect(e.x - width / 2, e.y - lift, width, 6);
    g.fillStyle = pct > 0.5 ? '#4ade80' : pct > 0.25 ? '#fbbf24' : '#f87171';
    g.fillRect(e.x - width / 2, e.y - lift, width * pct, 6);
    // bosses get a running HP readout so damage tests are easy to tally
    if (e.maxHp >= 10000) {
      g.font = 'bold 12px system-ui';
      g.textAlign = 'center';
      g.fillStyle = '#fef2f2';
      g.strokeStyle = 'rgba(0,0,0,.7)';
      g.lineWidth = 3;
      const label = `${Math.ceil(e.hp).toLocaleString()} / ${e.maxHp.toLocaleString()}`;
      g.strokeText(label, e.x, e.y - lift - 6);
      g.fillText(label, e.x, e.y - lift - 6);
      g.textAlign = 'left';
    }
    let px = e.x - width / 2;
    for (const [key, color] of STATUS_PIPS) {
      if (e.status[key] > 0) {
        g.fillStyle = color;
        g.beginPath();
        g.arc(px + 3, e.y - lift - 8, 3.2, 0, TAU);
        g.fill();
        px += 9;
      }
    }
  }

  #drawStatusTint(g, e) {
    if (e.status.frozen > 0) {
      g.globalAlpha = 0.55;
      g.fillStyle = '#93c5fd';
      g.beginPath(); g.ellipse(0, -18, 18, 28, 0, 0, TAU); g.fill();
      g.globalAlpha = 1;
    } else if (e.status.wet > 0) {
      g.globalAlpha = 0.3;
      g.fillStyle = '#38bdf8';
      g.beginPath(); g.ellipse(0, -16, 14, 24, 0, 0, TAU); g.fill();
      g.globalAlpha = 1;
    }
  }

  #drawDummy(g, d) {
    const wob = Math.sin(performance.now() / 30) * d.wobble * 6;
    g.save();
    g.translate(d.x, d.y);
    g.rotate(wob * 0.04);
    g.globalAlpha = 0.35;
    g.beginPath(); g.ellipse(0, 6, 18, 8, 0, 0, TAU); g.fillStyle = '#000'; g.fill();
    g.globalAlpha = 1;
    const flash = d.flash > 0;
    g.strokeStyle = flash ? '#fff' : '#8f6b45';
    g.lineWidth = 7;
    g.lineCap = 'round';
    g.beginPath(); g.moveTo(0, 4); g.lineTo(0, -34); g.stroke();
    g.beginPath(); g.moveTo(-18, -22); g.lineTo(18, -22); g.stroke();
    g.fillStyle = flash ? '#fff' : '#c9a06c';
    g.beginPath(); g.arc(0, -42, 10, 0, TAU); g.fill();
    g.fillStyle = flash ? '#fff' : '#a97f52';
    g.beginPath(); g.ellipse(0, -12, 11, 15, 0, 0, TAU); g.fill();
    this.#drawStatusTint(g, d);
    g.restore();
    this.#drawHealthBar(g, d);
  }

  #drawEnemy(g, e) {
    const spec = e.spec;
    const wob = Math.sin(performance.now() / 30) * e.wobble * 6;
    const windupFlash = e.windingUp && Math.floor(performance.now() / 70) % 2 === 0;
    const flash = e.flash > 0 || windupFlash;
    g.save();
    g.translate(e.x, e.y);
    g.rotate(wob * 0.04);
    // shadow
    g.globalAlpha = 0.35;
    g.beginPath(); g.ellipse(0, 4, spec.radius + 3, 6, 0, 0, TAU); g.fillStyle = '#000'; g.fill();
    g.globalAlpha = 1;

    const bodyColor = flash ? '#fff' : spec.color;
    switch (spec.body) {
      case 'blob': {
        const squish = 1 + Math.sin(performance.now() / 220) * 0.08;
        g.fillStyle = bodyColor;
        g.globalAlpha = 0.85;
        g.beginPath(); g.ellipse(0, -9, spec.radius * squish, spec.radius * (2 - squish) * 0.8, 0, 0, TAU); g.fill();
        g.globalAlpha = 1;
        g.fillStyle = '#0f172a';
        g.beginPath(); g.arc(-4, -12, 2, 0, TAU); g.arc(4, -12, 2, 0, TAU); g.fill();
        break;
      }
      case 'shroom':
        g.fillStyle = flash ? '#fff' : '#e7e5e4';
        g.beginPath(); g.ellipse(0, -8, 7, 9, 0, 0, TAU); g.fill();
        g.fillStyle = bodyColor;
        g.beginPath(); g.arc(0, -16, 12, Math.PI, 0); g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,255,255,.7)';
        g.beginPath(); g.arc(-5, -19, 2, 0, TAU); g.arc(5, -18, 1.6, 0, TAU); g.fill();
        g.fillStyle = '#0f172a';
        g.beginPath(); g.arc(-3, -8, 1.6, 0, TAU); g.arc(3, -8, 1.6, 0, TAU); g.fill();
        break;
      case 'skeleton':
        g.fillStyle = flash ? '#fff' : '#cbd5e1';
        g.fillRect(-6, -22, 12, 16);
        g.strokeStyle = '#475569'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(-6, -18); g.lineTo(6, -18); g.moveTo(-6, -13); g.lineTo(6, -13); g.stroke();
        g.fillStyle = flash ? '#fff' : '#e2e8f0';
        g.beginPath(); g.arc(0, -29, 8, 0, TAU); g.fill();
        g.fillStyle = '#0f172a';
        g.beginPath(); g.arc(-3, -30, 2, 0, TAU); g.arc(3, -30, 2, 0, TAU); g.fill();
        break;
      case 'humanoid':
        g.fillStyle = flash ? '#fff' : '#7f5539';
        g.beginPath();
        g.moveTo(-9, 2); g.quadraticCurveTo(-10, -20, 0, -23);
        g.quadraticCurveTo(10, -20, 9, 2);
        g.closePath(); g.fill();
        g.fillStyle = '#e8c39e';
        g.beginPath(); g.arc(0, -27, 6.5, 0, TAU); g.fill();
        g.fillStyle = flash ? '#fff' : bodyColor; // bandana
        g.fillRect(-6.5, -32, 13, 4);
        break;
      case 'imp':
        g.fillStyle = bodyColor;
        g.beginPath(); g.ellipse(0, -10, 9, 11, 0, 0, TAU); g.fill();
        g.beginPath(); // horns
        g.moveTo(-6, -18); g.lineTo(-9, -26); g.lineTo(-3, -20);
        g.moveTo(6, -18); g.lineTo(9, -26); g.lineTo(3, -20);
        g.fill();
        g.fillStyle = '#fef08a';
        g.beginPath(); g.arc(-3, -12, 1.8, 0, TAU); g.arc(3, -12, 1.8, 0, TAU); g.fill();
        break;
      case 'shark': {
        // mostly submerged: a gliding body, dorsal fin, and a wake
        const flip = Math.cos(e.facing) < 0 ? -1 : 1;
        g.scale(flip, 1);
        g.strokeStyle = 'rgba(224,242,254,.45)';
        g.lineWidth = 2;
        g.beginPath(); g.ellipse(-4, 0, 22, 8, 0, 0, TAU); g.stroke();
        g.fillStyle = bodyColor;
        g.globalAlpha = 0.55;
        g.beginPath(); g.ellipse(0, -2, 24, 7, 0, 0, TAU); g.fill();
        g.globalAlpha = 1;
        g.beginPath(); // dorsal fin
        g.moveTo(-4, -4); g.quadraticCurveTo(2, -24, 10, -6);
        g.closePath(); g.fill();
        const swish = Math.sin(performance.now() / 160) * 4;
        g.beginPath(); // tail fin
        g.moveTo(-20, -3); g.lineTo(-28 + swish * 0.4, -14); g.lineTo(-24, -2);
        g.closePath(); g.fill();
        break;
      }
      case 'ghost': {
        const hover = Math.sin(performance.now() / 400 + e.x * 0.01) * 3;
        g.translate(0, hover);
        g.globalAlpha = 0.75;
        g.fillStyle = flash ? '#fff' : bodyColor;
        g.beginPath();
        g.arc(0, -20, 10, Math.PI, 0);
        g.lineTo(10, -6);
        // wavy hem
        for (let i = 3; i >= -3; i--) {
          g.quadraticCurveTo(i * 3.3 + 1.6, i % 2 ? -1 : -9, i * 3.3, -6);
        }
        g.closePath(); g.fill();
        g.globalAlpha = 1;
        g.fillStyle = '#1e1b4b';
        g.beginPath(); g.arc(-3.5, -21, 2, 0, TAU); g.arc(3.5, -21, 2, 0, TAU); g.fill();
        g.beginPath(); g.ellipse(0, -14, 2, 3, 0, 0, TAU); g.fill(); // wail
        break;
      }
      case 'crab': {
        const scuttle = Math.sin(performance.now() / 90) * 1.5;
        g.strokeStyle = bodyColor; g.lineWidth = 2; g.lineCap = 'round';
        g.beginPath(); // legs
        for (const side of [-1, 1]) {
          for (let i = 0; i < 3; i++) {
            g.moveTo(side * 8, -8 + i * 2);
            g.lineTo(side * (14 + i), -2 + i * 2 + scuttle * side);
          }
        }
        g.stroke();
        g.fillStyle = bodyColor;
        g.beginPath(); g.ellipse(0, -9, 10, 7, 0, 0, TAU); g.fill();
        // claws
        g.beginPath(); g.arc(-11, -14, 4, 0, TAU); g.arc(11, -14, 4, 0, TAU); g.fill();
        g.fillStyle = '#7c2d12';
        g.beginPath();
        g.moveTo(-13, -17); g.lineTo(-15, -20); g.lineTo(-11, -18);
        g.moveTo(13, -17); g.lineTo(15, -20); g.lineTo(11, -18);
        g.fill();
        g.fillStyle = '#111827';
        g.beginPath(); g.arc(-3, -14, 1.5, 0, TAU); g.arc(3, -14, 1.5, 0, TAU); g.fill();
        break;
      }
      case 'guardsman':
        // the town watch, no longer friendly
        g.fillStyle = flash ? '#fff' : '#475569';
        g.beginPath();
        g.moveTo(-9, 3); g.quadraticCurveTo(-10, -18, 0, -21);
        g.quadraticCurveTo(10, -18, 9, 3);
        g.closePath(); g.fill();
        g.fillStyle = flash ? '#fff' : bodyColor;
        g.beginPath();
        g.moveTo(-7, -5); g.quadraticCurveTo(0, -1, 7, -5);
        g.lineTo(7, -15); g.quadraticCurveTo(0, -19, -7, -15);
        g.closePath(); g.fill();
        g.fillStyle = '#e8c39e';
        g.beginPath(); g.arc(0, -25, 6, 0, TAU); g.fill();
        g.fillStyle = flash ? '#fff' : bodyColor;
        g.beginPath(); g.arc(0, -27, 6.8, Math.PI, 0); g.closePath(); g.fill();
        g.fillRect(-6.8, -28, 13.6, 2.5);
        g.fillStyle = '#0f172a';
        g.beginPath(); g.arc(-2.5, -25, 1.5, 0, TAU); g.arc(2.5, -25, 1.5, 0, TAU); g.fill();
        break;
      case 'dragon': {
        const breathe = Math.sin(performance.now() / 600) * 2;
        const wingBeat = Math.sin(performance.now() / 900) * 0.12;
        const dark = flash ? '#fff' : '#7f1d1d';
        // wings, folded high behind the body
        g.fillStyle = dark;
        for (const side of [-1, 1]) {
          g.save();
          g.scale(side, 1);
          g.rotate(wingBeat * side);
          g.beginPath();
          g.moveTo(14, -34);
          g.quadraticCurveTo(52, -78 + breathe, 66, -44);
          g.lineTo(50, -46); g.lineTo(56, -30); g.lineTo(40, -36);
          g.lineTo(44, -22); g.quadraticCurveTo(26, -30, 14, -22);
          g.closePath(); g.fill();
          g.restore();
        }
        // tail sweeping out to the left
        g.strokeStyle = bodyColor; g.lineWidth = 9; g.lineCap = 'round';
        const tailSwish = Math.sin(performance.now() / 700) * 6;
        g.beginPath();
        g.moveTo(-14, -8);
        g.quadraticCurveTo(-46, -4, -58, -20 + tailSwish);
        g.stroke();
        g.fillStyle = dark; // tail spade
        g.beginPath();
        g.moveTo(-64, -28 + tailSwish); g.lineTo(-50, -22 + tailSwish);
        g.lineTo(-60, -12 + tailSwish);
        g.closePath(); g.fill();
        // haunches and body
        g.fillStyle = bodyColor;
        g.beginPath(); g.ellipse(0, -16, 30, 24 + breathe, 0, 0, TAU); g.fill();
        g.beginPath(); g.ellipse(-18, -8, 13, 11, 0, 0, TAU); g.fill();
        g.beginPath(); g.ellipse(18, -8, 13, 11, 0, 0, TAU); g.fill();
        // belly plates
        g.fillStyle = flash ? '#fff' : '#fbbf24';
        g.beginPath(); g.ellipse(0, -10, 14, 16 + breathe * 0.5, 0, 0, TAU); g.fill();
        g.strokeStyle = flash ? '#fff' : '#d97706'; g.lineWidth = 1.5;
        for (let i = 0; i < 4; i++) {
          g.beginPath();
          g.moveTo(-11, -20 + i * 7); g.quadraticCurveTo(0, -16 + i * 7, 11, -20 + i * 7);
          g.stroke();
        }
        // neck and head
        g.fillStyle = bodyColor;
        g.beginPath(); g.ellipse(0, -42, 10, 14, 0, 0, TAU); g.fill();
        g.beginPath(); g.ellipse(0, -56, 13, 11, 0, 0, TAU); g.fill();
        g.beginPath(); // snout
        g.ellipse(0, -50, 8, 6, 0, 0, TAU); g.fill();
        g.fillStyle = dark; // horns
        g.beginPath();
        g.moveTo(-8, -62); g.lineTo(-16, -76); g.lineTo(-4, -66);
        g.moveTo(8, -62); g.lineTo(16, -76); g.lineTo(4, -66);
        g.fill();
        // ridge spikes down the spine
        g.beginPath();
        for (let i = 0; i < 3; i++) {
          g.moveTo(-4, -36 + i * 10); g.lineTo(0, -44 + i * 10); g.lineTo(4, -36 + i * 10);
        }
        g.fill();
        // smoldering eyes
        g.fillStyle = '#fde047';
        g.beginPath(); g.arc(-5, -58, 2.4, 0, TAU); g.arc(5, -58, 2.4, 0, TAU); g.fill();
        g.fillStyle = '#991b1b';
        g.beginPath(); g.arc(-5, -58, 1, 0, TAU); g.arc(5, -58, 1, 0, TAU); g.fill();
        // nostril smoke
        g.globalAlpha = 0.25 + Math.sin(performance.now() / 500) * 0.1;
        g.fillStyle = '#94a3b8';
        const drift = (performance.now() / 40) % 26;
        g.beginPath(); g.arc(-3, -50 - drift * 0.4, 2 + drift * 0.12, 0, TAU); g.fill();
        g.beginPath(); g.arc(3, -48 - drift * 0.5, 1.6 + drift * 0.1, 0, TAU); g.fill();
        g.globalAlpha = 1;
        break;
      }
      case 'goblin':
        g.fillStyle = bodyColor;
        g.beginPath(); g.ellipse(0, -9, 8, 10, 0, 0, TAU); g.fill();
        g.beginPath(); g.arc(0, -21, 6.5, 0, TAU); g.fill();
        g.beginPath(); // big pointed ears
        g.moveTo(-6, -23); g.lineTo(-13, -26); g.lineTo(-5, -19);
        g.moveTo(6, -23); g.lineTo(13, -26); g.lineTo(5, -19);
        g.fill();
        g.fillStyle = '#fef08a';
        g.beginPath(); g.arc(-2.5, -22, 1.6, 0, TAU); g.arc(2.5, -22, 1.6, 0, TAU); g.fill();
        g.fillStyle = '#f8fafc'; // snaggle teeth
        g.beginPath();
        g.moveTo(-2, -17); g.lineTo(-1, -14.5); g.lineTo(0, -17);
        g.moveTo(1, -17); g.lineTo(2, -14.5); g.lineTo(3, -17);
        g.fill();
        break;
    }

    // held weapon, pointed at the target
    if (e.weaponHeld) {
      g.rotate(e.facing);
      g.strokeStyle = '#94a3b8';
      g.lineWidth = 2.5;
      g.lineCap = 'round';
      if (spec.weapon === 'sword') {
        g.beginPath(); g.moveTo(10, -8); g.lineTo(24, -8); g.stroke();
        g.strokeStyle = '#64748b';
        g.beginPath(); g.moveTo(13, -12); g.lineTo(13, -4); g.stroke();
      } else if (spec.weapon === 'axe') {
        g.beginPath(); g.moveTo(10, -8); g.lineTo(22, -8); g.stroke();
        g.fillStyle = '#cbd5e1';
        g.beginPath(); g.moveTo(22, -13); g.lineTo(27, -8); g.lineTo(22, -3); g.closePath(); g.fill();
      }
    }
    this.#drawStatusTint(g, e);
    g.restore();
    if (spec.radius > 24) this.#drawHealthBar(g, e, 120, 100);
    else this.#drawHealthBar(g, e, 38);
  }

  #drawNpc(g, n) {
    const s = n.scale;
    const bob = n.state === 'walk' && n.talkT <= 0 ? Math.sin(n.walk) * 2 : 0;
    g.save();
    g.translate(n.x, n.y);
    g.globalAlpha = 0.35;
    g.beginPath(); g.ellipse(0, 4, 12 * s, 5.5 * s, 0, 0, TAU); g.fillStyle = '#000'; g.fill();
    g.globalAlpha = 1;
    g.scale(n.facing * s, s);
    g.translate(0, bob);

    if (ANIMAL_BODIES.has(n.body)) {
      this.#drawAnimal(g, n);
    } else if (n.body === 'guard') {
      // tunic + chest plate
      g.fillStyle = '#475569';
      g.beginPath();
      g.moveTo(-9, 3); g.quadraticCurveTo(-10, -18, 0, -21);
      g.quadraticCurveTo(10, -18, 9, 3);
      g.closePath(); g.fill();
      g.fillStyle = '#94a3b8';
      g.beginPath();
      g.moveTo(-7, -5); g.quadraticCurveTo(0, -1, 7, -5);
      g.lineTo(7, -15); g.quadraticCurveTo(0, -19, -7, -15);
      g.closePath(); g.fill();
      // head + helmet
      g.fillStyle = '#e8c39e';
      g.beginPath(); g.arc(0, -25, 6, 0, TAU); g.fill();
      g.fillStyle = '#94a3b8';
      g.beginPath(); g.arc(0, -27, 6.8, Math.PI, 0); g.closePath(); g.fill();
      g.fillRect(-6.8, -28, 13.6, 2.5);
      // spear
      g.strokeStyle = '#8a6b3a'; g.lineWidth = 2.5; g.lineCap = 'round';
      g.beginPath(); g.moveTo(10, 4); g.lineTo(10, -36); g.stroke();
      g.fillStyle = '#cbd5e1';
      g.beginPath(); g.moveTo(10, -44); g.lineTo(13, -35); g.lineTo(7, -35); g.closePath(); g.fill();
    } else {
      const elder = n.body === 'elder';
      // robe (elders stoop a little)
      g.fillStyle = n.palette.robe;
      g.beginPath();
      g.moveTo(-9, 3); g.quadraticCurveTo(-10, -18, elder ? 2 : 0, elder ? -19 : -21);
      g.quadraticCurveTo(10, -17, 9, 3);
      g.closePath(); g.fill();
      // belt
      g.fillStyle = 'rgba(0,0,0,.25)';
      g.fillRect(-8, -8, 16, 3);
      // head + hair
      const hx = elder ? 2 : 0, hy = elder ? -23 : -25;
      g.fillStyle = '#e8c39e';
      g.beginPath(); g.arc(hx, hy, 6, 0, TAU); g.fill();
      g.fillStyle = n.palette.hair;
      g.beginPath(); g.arc(hx, hy - 1.5, 6.3, Math.PI * 0.95, Math.PI * 0.05); g.closePath(); g.fill();
      if (n.body === 'kid') {
        // little cap brim
        g.fillRect(hx, hy - 5.5, 9, 2.5);
      }
      if (elder) {
        // cane
        g.strokeStyle = '#8a6b3a'; g.lineWidth = 2; g.lineCap = 'round';
        g.beginPath(); g.moveTo(9, -12); g.lineTo(11, 3); g.stroke();
      }
    }
    if (!ANIMAL_BODIES.has(n.body)) {
      // eyes on the facing side
      const ex = n.body === 'elder' ? 4 : 2, ey = n.body === 'elder' ? -24 : -26;
      g.fillStyle = '#1e293b';
      g.beginPath(); g.arc(ex, ey, 0.9, 0, TAU); g.arc(ex + 3, ey, 0.9, 0, TAU); g.fill();
    }
    if (n.flash > 0) {
      g.globalAlpha = 0.7;
      g.fillStyle = '#fff';
      g.beginPath(); g.ellipse(0, -14, 11, 16, 0, 0, TAU); g.fill();
      g.globalAlpha = 1;
    }
    this.#drawStatusTint(g, n);
    g.restore();
    if (n.hp < n.maxHp) this.#drawHealthBar(g, n, 34);

    // someone who clearly needs help
    if (n.mystery && n.talkT <= 0) {
      const qBob = Math.sin(performance.now() / 350) * 3;
      g.font = 'bold 17px "Segoe UI",sans-serif';
      g.textAlign = 'center';
      g.fillStyle = '#0f172a';
      g.fillText('?', n.x + 1, n.y - 50 * n.scale + qBob + 1);
      g.fillStyle = '#fbbf24';
      g.fillText('?', n.x, n.y - 50 * n.scale + qBob);
    }
  }

  #drawAnimal(g, n) {
    const c = n.palette.robe;
    const now = performance.now();
    const step = Math.sin(n.walk) * 2;
    switch (n.body) {
      case 'dog': {
        g.strokeStyle = c; g.lineWidth = 2.5; g.lineCap = 'round';
        g.beginPath();
        g.moveTo(-6, -6); g.lineTo(-6 + step, 1);
        g.moveTo(4, -6); g.lineTo(4 - step, 1);
        g.stroke();
        const wag = Math.sin(now / 120) * 5;
        g.beginPath(); g.moveTo(-11, -10); g.quadraticCurveTo(-16, -13 + wag * 0.2, -18, -16 + wag * 0.4); g.stroke();
        g.fillStyle = c;
        g.beginPath(); g.ellipse(-1, -8, 11, 6.5, 0, 0, TAU); g.fill();
        g.beginPath(); g.arc(9, -12, 5.5, 0, TAU); g.fill();
        g.fillStyle = '#c9ae8d';
        g.beginPath(); g.ellipse(13, -10.5, 3.5, 2.5, 0, 0, TAU); g.fill();
        g.fillStyle = '#1c1917';
        g.beginPath(); g.arc(15.5, -11, 1.2, 0, TAU); g.fill();
        g.fillStyle = '#6b4f33';
        g.beginPath(); g.ellipse(6.5, -15, 2.5, 4.5, 0.5, 0, TAU); g.fill();
        g.fillStyle = '#111827';
        g.beginPath(); g.arc(9.5, -13.5, 1, 0, TAU); g.fill();
        break;
      }
      case 'cat': {
        g.fillStyle = c;
        g.beginPath(); g.ellipse(-2, -6, 8, 5.5, 0, 0, TAU); g.fill();
        g.beginPath(); g.arc(7, -9, 4.5, 0, TAU); g.fill();
        g.beginPath();
        g.moveTo(4.5, -12); g.lineTo(5.5, -16); g.lineTo(7.5, -12.5);
        g.moveTo(9, -12.5); g.lineTo(10.5, -16); g.lineTo(11, -12);
        g.fill();
        g.strokeStyle = c; g.lineWidth = 2; g.lineCap = 'round';
        const wag = Math.sin(now / 300) * 4;
        g.beginPath(); g.moveTo(-9, -7); g.quadraticCurveTo(-15, -12, -14 + wag * 0.2, -16 + wag * 0.3); g.stroke();
        g.fillStyle = '#111827';
        g.beginPath(); g.arc(6, -9.5, 0.9, 0, TAU); g.arc(9, -9.5, 0.9, 0, TAU); g.fill();
        break;
      }
      case 'chicken': {
        g.strokeStyle = '#f59e0b'; g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(-1, -2); g.lineTo(-1 + step, 2);
        g.moveTo(2, -2); g.lineTo(2 - step, 2);
        g.stroke();
        g.fillStyle = '#f5f0e6';
        g.beginPath(); g.ellipse(0, -8, 7, 6, 0, 0, TAU); g.fill();
        g.beginPath(); g.arc(5.5, -14, 3.5, 0, TAU); g.fill();
        g.beginPath(); g.moveTo(-6, -10); g.lineTo(-11, -15); g.lineTo(-4, -7); g.closePath(); g.fill();
        g.fillStyle = '#dc2626';
        g.beginPath(); g.arc(5, -18, 1.6, 0, TAU); g.arc(7, -17.5, 1.3, 0, TAU); g.fill();
        g.beginPath(); g.arc(7, -12, 1.2, 0, TAU); g.fill();
        g.fillStyle = '#f59e0b';
        g.beginPath(); g.moveTo(8.6, -14.6); g.lineTo(11.5, -13.8); g.lineTo(8.6, -13); g.closePath(); g.fill();
        g.fillStyle = '#111827';
        g.beginPath(); g.arc(6, -15, 0.8, 0, TAU); g.fill();
        break;
      }
      case 'cow':
      case 'ox': {
        const ox = n.body === 'ox';
        const hide = ox ? '#7c5a3a' : '#f5f0e6';
        g.strokeStyle = ox ? '#6b4f33' : '#e7e0d0';
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(-9, -4); g.lineTo(-9 + step, 2);
        g.moveTo(-1, -4); g.lineTo(-1 - step, 2);
        g.moveTo(6, -4); g.lineTo(6 + step, 2);
        g.stroke();
        g.fillStyle = hide;
        g.beginPath(); g.ellipse(-1, -12, 15, 9, 0, 0, TAU); g.fill();
        if (!ox) {
          g.fillStyle = '#3f3f46';
          g.beginPath(); g.ellipse(-6, -14, 5, 3.5, 0.4, 0, TAU); g.fill();
          g.beginPath(); g.ellipse(4, -9, 4, 3, -0.3, 0, TAU); g.fill();
        }
        g.fillStyle = hide;
        g.beginPath(); g.ellipse(13, -14, 6, 5, 0, 0, TAU); g.fill();
        g.fillStyle = ox ? '#5c4430' : '#e8b7ac';
        g.beginPath(); g.ellipse(16, -12, 3.5, 2.5, 0, 0, TAU); g.fill();
        g.strokeStyle = '#d6d3d1'; g.lineWidth = ox ? 2.5 : 2; g.lineCap = 'round';
        g.beginPath();
        if (ox) {
          g.moveTo(10, -18); g.quadraticCurveTo(6, -23, 8, -26);
          g.moveTo(16, -18); g.quadraticCurveTo(20, -23, 18, -26);
        } else {
          g.moveTo(10, -18); g.lineTo(8, -21);
          g.moveTo(16, -18); g.lineTo(18, -21);
        }
        g.stroke();
        const swish = Math.sin(now / 500) * 3;
        g.strokeStyle = hide; g.lineWidth = 2;
        g.beginPath(); g.moveTo(-15, -14); g.quadraticCurveTo(-19, -10, -18 + swish * 0.3, -4); g.stroke();
        g.fillStyle = '#111827';
        g.beginPath(); g.arc(13, -15.5, 1, 0, TAU); g.fill();
        break;
      }
    }
  }

  #drawSpeechBubbles(g, npcs) {
    for (const n of npcs) {
      if (n.talkT <= 0) continue;
      const alpha = clamp(Math.min((n.talkDur - n.talkT) / 0.2, n.talkT / 0.3), 0, 1);
      g.font = '12px "Segoe UI",sans-serif';
      const lines = this.#wrapText(g, n.currentLine, 180);
      let w = 0;
      for (const line of lines) w = Math.max(w, g.measureText(line).width);
      g.font = 'bold 10px "Segoe UI",sans-serif';
      w = Math.max(w, g.measureText(n.name.toUpperCase()).width) + 20;
      const h = 16 + lines.length * 15 + 8;
      const bx = n.x - w / 2;
      const by = n.y - 62 * n.scale - h;

      g.globalAlpha = alpha * 0.95;
      g.fillStyle = '#f8fafc';
      roundRect(g, bx, by, w, h, 8);
      g.fill();
      g.beginPath();
      g.moveTo(n.x - 6, by + h);
      g.lineTo(n.x + 6, by + h);
      g.lineTo(n.x, by + h + 8);
      g.closePath(); g.fill();

      g.textAlign = 'left';
      g.fillStyle = '#6366f1';
      g.font = 'bold 10px "Segoe UI",sans-serif';
      g.fillText(n.name.toUpperCase(), bx + 10, by + 14);
      g.fillStyle = '#1e293b';
      g.font = '12px "Segoe UI",sans-serif';
      for (let i = 0; i < lines.length; i++) {
        g.fillText(lines[i], bx + 10, by + 29 + i * 15);
      }
      g.globalAlpha = 1;
    }
  }

  #wrapText(g, text, maxW) {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      const candidate = line ? line + ' ' + word : word;
      if (g.measureText(candidate).width > maxW && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  #drawCat(g, cat) {
    g.save();
    g.translate(cat.x, cat.y);
    const fade = clamp(cat.ttl, 0, 1);
    g.globalAlpha = fade;
    g.beginPath(); g.ellipse(0, 2, 9, 4, 0, 0, TAU);
    g.fillStyle = 'rgba(0,0,0,.3)'; g.fill();
    const flip = Math.cos(cat.facing) < 0 ? -1 : 1;
    g.scale(flip, 1);
    g.fillStyle = cat.color;
    // body + head + ears
    g.beginPath(); g.ellipse(-2, -6, 8, 5.5, 0, 0, TAU); g.fill();
    g.beginPath(); g.arc(7, -9, 4.5, 0, TAU); g.fill();
    g.beginPath();
    g.moveTo(4.5, -12); g.lineTo(5.5, -16); g.lineTo(7.5, -12.5);
    g.moveTo(9, -12.5); g.lineTo(10.5, -16); g.lineTo(11, -12);
    g.fill();
    // tail
    g.strokeStyle = cat.color;
    g.lineWidth = 2;
    g.lineCap = 'round';
    const wag = Math.sin(performance.now() / 200) * 4;
    g.beginPath(); g.moveTo(-9, -7); g.quadraticCurveTo(-15, -12, -14 + wag * 0.2, -16 + wag * 0.3); g.stroke();
    // eyes
    g.fillStyle = '#111827';
    g.beginPath(); g.arc(6, -9.5, 0.9, 0, TAU); g.arc(9, -9.5, 0.9, 0, TAU); g.fill();
    g.restore();
  }

  #drawBoulders(g, boulders) {
    for (const b of boulders) {
      const h = b.height;
      const s = b.scale;
      g.globalAlpha = 0.3;
      g.beginPath();
      g.ellipse(b.x, b.y, 14 * s * (1 - h / 200), 6 * s * (1 - h / 200), 0, 0, TAU);
      g.fillStyle = '#000';
      g.fill();
      g.globalAlpha = 1;
      g.fillStyle = '#8a7563';
      g.beginPath(); g.arc(b.x, b.y - h, 13 * s, 0, TAU); g.fill();
      g.fillStyle = '#6b5a4b';
      g.beginPath(); g.arc(b.x + 4 * s, b.y - h + 3, 7 * s, 0, TAU); g.fill();
    }
  }

  #drawShards(g, shards) {
    g.fillStyle = ELEMENTS.ice.color;
    for (const s of shards) {
      const a = Math.atan2(s.vy, s.vx);
      g.save();
      g.translate(s.x, s.y);
      g.rotate(a);
      g.scale(s.scale, s.scale);
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
    const scale = channel.scale;
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = color;
    g.globalAlpha = 0.35;
    g.lineWidth = (14 + Math.sin(performance.now() / 40) * 3) * scale;
    g.beginPath(); g.moveTo(b.ox, b.oy); g.lineTo(ex, ey); g.stroke();
    g.globalAlpha = 1;
    g.lineWidth = 4 * scale;
    g.strokeStyle = '#fff';
    g.beginPath(); g.moveTo(b.ox, b.oy); g.lineTo(ex, ey); g.stroke();
    g.fillStyle = color;
    g.beginPath(); g.arc(ex, ey, (8 + Math.random() * 3) * scale, 0, TAU); g.fill();
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

  #drawPlayer(g, p, ctx) {
    const bob = Math.sin(p.walk) * 2.4;
    const lean = clamp(p.vx * 0.0004, -0.12, 0.12);
    g.save();
    g.translate(p.x, p.y);
    g.globalAlpha = 0.4;
    g.beginPath(); g.ellipse(0, 6, 15, 7, 0, 0, TAU); g.fillStyle = '#000'; g.fill();
    g.globalAlpha = 1;
    if (ctx.maps?.current?.boat) this.#drawBoat(g);
    if (p.ward > 0) {
      g.globalAlpha = 0.25 + Math.sin(performance.now() / 150) * 0.08;
      g.fillStyle = ELEMENTS.shield.color;
      g.beginPath(); g.arc(0, -14, 34, 0, TAU); g.fill();
      g.globalAlpha = 1;
    }
    g.rotate(lean);
    g.translate(0, bob);
    const isAlchemist = (p.cls ?? ctx.activeClass?.id) === 'alchemist';
    // robe
    g.fillStyle = p.status.frozen > 0 ? '#93c5fd' : (isAlchemist ? '#4f6b46' : '#4c5b8f');
    g.beginPath();
    g.moveTo(-11, 4); g.quadraticCurveTo(-13, -22, 0, -26);
    g.quadraticCurveTo(13, -22, 11, 4);
    g.closePath(); g.fill();
    g.fillStyle = isAlchemist ? '#3d5437' : '#3b4977';
    g.beginPath();
    g.moveTo(-11, 4); g.quadraticCurveTo(0, -2, 11, 4);
    g.lineTo(9, 0); g.lineTo(-9, 0);
    g.closePath(); g.fill();
    // head
    g.fillStyle = '#e8c39e';
    g.beginPath(); g.arc(0, -30, 7, 0, TAU); g.fill();
    // hat
    g.fillStyle = isAlchemist ? '#43593c' : '#38406b';
    g.beginPath(); g.ellipse(0, -34, 13, 4, -0.08, 0, TAU); g.fill();
    g.beginPath();
    g.moveTo(-8, -35); g.quadraticCurveTo(-2, -58, 6, -52); g.quadraticCurveTo(2, -46, 8, -35);
    g.closePath(); g.fill();
    const a = p.facing;
    const hx = Math.cos(a) * 17, hy = -14 + Math.sin(a) * 17;
    const orbColor = ctx.activeClass?.getOrbColor?.() ?? '#7d8ec9';
    if (isAlchemist) {
      // alchemists carry no wand — just the next potion, ready to throw
      g.fillStyle = orbColor;
      g.beginPath(); g.arc(hx, hy, 4.5, 0, TAU); g.fill();
      g.fillStyle = '#cbd5e1';
      g.fillRect(hx - 1.8, hy - 10, 3.6, 5);
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.3;
      g.fillStyle = orbColor;
      g.beginPath(); g.arc(hx, hy, 9, 0, TAU); g.fill();
      g.restore();
    } else {
      // staff pointing at cursor, orb glowing with the current selection
      g.strokeStyle = '#8b6f47';
      g.lineWidth = 3;
      g.lineCap = 'round';
      g.beginPath(); g.moveTo(hx * 0.3, -8); g.lineTo(hx, hy); g.stroke();
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = orbColor;
      g.beginPath(); g.arc(hx, hy, 6, 0, TAU); g.fill();
      g.globalAlpha = 0.35;
      g.beginPath(); g.arc(hx, hy, 11, 0, TAU); g.fill();
      g.restore();
    }
    g.restore();
  }

  /** A little skiff drawn under the player while crossing the sea. */
  #drawBoat(g) {
    const bob = Math.sin(performance.now() / 500) * 2;
    g.save();
    g.translate(0, bob);
    // wake
    g.strokeStyle = 'rgba(224,242,254,.35)';
    g.lineWidth = 2;
    g.beginPath(); g.ellipse(0, 6, 30, 10, 0, 0, TAU); g.stroke();
    // mast + sail behind the pilot
    g.fillStyle = '#8a6b3a';
    g.fillRect(-14, -66, 4, 54);
    g.fillStyle = '#f8fafc';
    g.beginPath();
    g.moveTo(-10, -64); g.quadraticCurveTo(20, -56, 14, -26); g.lineTo(-10, -26);
    g.closePath(); g.fill();
    // hull
    g.fillStyle = '#9f1d20';
    g.beginPath();
    g.moveTo(-36, -26);
    g.quadraticCurveTo(-30, -8, 0, -4);
    g.quadraticCurveTo(30, -8, 38, -30);
    g.lineTo(30, -30);
    g.quadraticCurveTo(24, -16, 0, -13);
    g.quadraticCurveTo(-24, -16, -30, -26);
    g.closePath(); g.fill();
    g.strokeStyle = '#fbbf24';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(-32, -22); g.quadraticCurveTo(0, -9, 34, -26);
    g.stroke();
    g.restore();
  }

  /** MapleStory-style name tags under each wizard. */
  #drawNameLabels(g, players) {
    g.font = 'bold 11px "Segoe UI",sans-serif';
    g.textAlign = 'center';
    for (const p of players) {
      if (!p.name) continue;
      const w = g.measureText(p.name).width + 12;
      g.globalAlpha = 0.72;
      g.fillStyle = '#0b0e14';
      roundRect(g, p.x - w / 2, p.y + 12, w, 15, 4);
      g.fill();
      g.globalAlpha = 1;
      g.fillStyle = p.remote ? '#a5b4fc' : '#f1f5f9';
      g.fillText(p.name, p.x, p.y + 23);
    }
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
