import { ELEMENTS } from '../config.js';
import { CHUNK_SIZE } from '../biomes/BiomeRegistry.js';
import { TAU, rnd, clamp } from '../core/math.js';

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
const NO_SHADOW = new Set(['wave', 'searock', 'dockboat', 'fountain', 'castle']);

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
    const g = this.g;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.fillStyle = '#07090f';
    g.fillRect(0, 0, this.width, this.height);

    const shake = camera.shakeOffset;
    g.save();
    g.translate(this.width / 2 - camera.x + shake.x, this.height / 2 - camera.y + shake.y);

    const map = ctx.maps?.current;
    if (map) {
      this.#drawMapFloor(g, ctx, map);
      this.#drawGrid(g, camera);
      this.#drawMapProps(g, map);
    } else {
      this.#drawTerrain(g, ctx);
      this.#drawGrid(g, camera);
      this.#drawOverworldLandmarks(g, ctx);
    }
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
    for (const cat of world.cats) this.#drawCat(g, cat);
    this.#drawBoulders(g, world.boulders);
    this.#drawFlasks(g, world.flasks);
    this.#drawShards(g, world.shards);
    this.#drawBeam(g, ctx.activeClass?.cast?.channel);
    this.#drawBolts(g, effects.bolts);
    this.#drawParticles(g, effects.particles);
    for (const p of world.players) this.#drawPlayer(g, p, ctx);
    this.#drawRainClouds(g, world.zones);
    this.#drawFloaters(g, effects.floaters);

    g.restore();
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

  // ---------------------------------------------------------------- terrain

  #drawTerrain(g, ctx) {
    const { camera, chunks } = ctx;
    if (!chunks) return;
    const cx0 = Math.floor((camera.x - this.width / 2) / CHUNK_SIZE);
    const cx1 = Math.floor((camera.x + this.width / 2) / CHUNK_SIZE);
    const cy0 = Math.floor((camera.y - this.height / 2) / CHUNK_SIZE);
    const cy1 = Math.floor((camera.y + this.height / 2) / CHUNK_SIZE);
    // floors first so decorations never sit under a neighbor's floor tile
    const visible = [];
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const chunk = chunks.getChunk(cx, cy);
        visible.push(chunk);
        g.fillStyle = (cx + cy) % 2 === 0 ? chunk.biome.floor : chunk.biome.floorAlt;
        g.fillRect(chunk.x, chunk.y, CHUNK_SIZE + 1, CHUNK_SIZE + 1);
      }
    }
    for (const chunk of visible) {
      for (const deco of chunk.decos) this.#drawDeco(g, deco);
    }
  }

  // ------------------------------------------------------------ fixed maps

  #drawMapFloor(g, ctx, map) {
    const { camera } = ctx;
    // beyond the bounds: void for walled towns, open sea for isles
    g.fillStyle = map.outside;
    g.fillRect(camera.x - this.width / 2 - 40, camera.y - this.height / 2 - 40, this.width + 80, this.height + 80);

    const T = 120;
    for (let iy = 0; iy < Math.ceil(map.h / T); iy++) {
      for (let ix = 0; ix < Math.ceil(map.w / T); ix++) {
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

  #drawMapProps(g, map) {
    if (map.walled) this.#drawTownWall(g, map);
    for (const d of map.decos) this.#drawDeco(g, d);
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

  /** The worn road and town gate that anchor the infinite overworld. */
  #drawOverworldLandmarks(g, ctx) {
    const maps = ctx.maps;
    if (!maps) return;
    g.save();
    g.globalAlpha = 0.5;
    g.fillStyle = '#3d3325';
    g.beginPath();
    g.moveTo(-22, -20); g.lineTo(22, -20);
    g.lineTo(14, -600); g.lineTo(-14, -600);
    g.closePath(); g.fill();
    g.restore();
    for (const gate of maps.gates()) this.#drawGate(g, gate);
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
        g.fillStyle = '#f5d76e'; g.fillRect(-42, -52, 14, 12); g.fillRect(28, -52, 14, 12);
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
        g.fillStyle = '#f5d76e'; g.fillRect(30, -34, 16, 14);
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
        const flick = 0.75 + Math.sin(performance.now() / 230 + d.v * 8) * 0.15;
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = flick;
        g.fillStyle = '#fbbf24';
        g.fillRect(-5, -50, 10, 12);
        g.globalAlpha = flick * 0.35;
        g.beginPath(); g.arc(0, -44, 16, 0, TAU); g.fill();
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

  #drawHealthBar(g, e, width = 44) {
    const pct = clamp(e.hp / e.maxHp, 0, 1);
    g.fillStyle = 'rgba(0,0,0,.55)';
    g.fillRect(e.x - width / 2, e.y - 64, width, 6);
    g.fillStyle = pct > 0.5 ? '#4ade80' : pct > 0.25 ? '#fbbf24' : '#f87171';
    g.fillRect(e.x - width / 2, e.y - 64, width * pct, 6);
    let px = e.x - width / 2;
    for (const [key, color] of STATUS_PIPS) {
      if (e.status[key] > 0) {
        g.fillStyle = color;
        g.beginPath();
        g.arc(px + 3, e.y - 72, 3.2, 0, TAU);
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
    this.#drawHealthBar(g, e, 38);
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
    const isAlchemist = ctx.activeClass?.id === 'alchemist';
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
    // staff pointing at cursor
    const a = p.facing;
    const hx = Math.cos(a) * 17, hy = -14 + Math.sin(a) * 17;
    g.strokeStyle = '#8b6f47';
    g.lineWidth = 3;
    g.lineCap = 'round';
    g.beginPath(); g.moveTo(hx * 0.3, -8); g.lineTo(hx, hy); g.stroke();
    // staff orb glows with the current selection
    const orbColor = ctx.activeClass?.getOrbColor?.() ?? '#7d8ec9';
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = orbColor;
    g.beginPath(); g.arc(hx, hy, 6, 0, TAU); g.fill();
    g.globalAlpha = 0.35;
    g.beginPath(); g.arc(hx, hy, 11, 0, TAU); g.fill();
    g.restore();
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
