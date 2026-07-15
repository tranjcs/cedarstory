import { ELEMENTS, CHANNEL } from '../config.js';
import { rnd, clamp, dist2, normalizeAngle, rayCircle, angleBetween } from '../core/math.js';
import { countElements, duplicatePower } from './SpellResolver.js';
import { Boulder, Shard, Wall } from '../entities/projectiles.js';

/**
 * Cast strategies (Strategy pattern): one class per spell shape, selected
 * by SpellResolver.resolveKind. Instant shapes fire immediately and return
 * null; channelled shapes return a Channel object (State pattern) that the
 * CastSystem drives until the button is released or the charge runs out.
 *
 * Every strategy receives the shared frame context:
 * { world, combat, effects, camera, bus, aim, input }
 */

const aimAngle = (ctx) => angleBetween(ctx.world.player.x, ctx.world.player.y, ctx.aim.x, ctx.aim.y);

// ---------------------------------------------------------------- instant

class WallStrategy {
  cast(ctx, elements) {
    const { world, bus, camera } = ctx;
    const player = world.player;
    const counts = countElements(elements);
    const angle = aimAngle(ctx);
    const rock = Boolean(counts.earth);
    const nodes = [];
    for (let i = -2; i <= 2; i++) {
      const a = angle + i * 0.3;
      nodes.push({
        x: player.x + Math.cos(a) * 85,
        y: player.y + Math.sin(a) * 85,
        hp: rock ? 120 : 60,
      });
    }
    const imbue = elements.filter((el) => el !== 'shield' && el !== 'earth');
    world.walls.push(new Wall(nodes, rock, imbue, elements));
    bus.emit('sfx', { id: 'wall' });
    camera.addShake(5);
    return null;
  }
}

class BoulderStrategy {
  cast(ctx, elements) {
    const { world, bus, camera, aim } = ctx;
    world.boulders.push(new Boulder(world.player, aim, elements));
    bus.emit('sfx', { id: 'boulder' });
    camera.addShake(4);
    return null;
  }
}

class ShardStrategy {
  cast(ctx, elements) {
    const { world, bus } = ctx;
    const player = world.player;
    const counts = countElements(elements);
    const angle = aimAngle(ctx);
    const iceCount = counts.ice || 1;
    const n = 3 + 2 * (iceCount - 1) + (elements.length - (counts.ice || 0));
    for (let i = 0; i < n; i++) {
      const a = angle + rnd(-0.16, 0.16);
      const speed = rnd(620, 760);
      world.shards.push(new Shard(
        player.x + Math.cos(angle) * 22,
        player.y + Math.sin(angle) * 22,
        Math.cos(a) * speed,
        Math.sin(a) * speed,
        elements,
      ));
    }
    bus.emit('sfx', { id: 'shards' });
    return null;
  }
}

// ---------------------------------------------------------------- channelled

class Channel {
  constructor(kind, elements) {
    this.kind = kind;
    this.els = elements;
    this.dur = CHANNEL.baseDuration + CHANNEL.perElement * elements.length;
    this.t = this.dur;
    this.tick = 0;
  }
}

/** Zap dummies inside a cone ahead of the player with the queued lightning. */
export function arcZap(ctx, angle, elements, mult) {
  const { world, combat, effects, bus } = ctx;
  const player = world.player;
  let hitAny = false;
  for (const d of world.enemies.slice()) {
    const dx = d.x - player.x, dy = d.y - player.y;
    const dd = Math.hypot(dx, dy);
    if (dd >= 320) continue;
    const off = normalizeAngle(Math.atan2(dy, dx) - angle);
    if (Math.abs(off) >= 0.7) continue;
    effects.bolt(
      player.x + Math.cos(angle) * 24, player.y - 14 + Math.sin(angle) * 24,
      d.x, d.y - 16, 0.1,
    );
    combat.applyElements(d, elements.filter((el) => el === 'lightning'), {
      mult, kx: (dx / dd) * 120, ky: (dy / dd) * 120, quiet: true,
    }, ctx);
    hitAny = true;
  }
  if (!hitAny) {
    const ex = player.x + Math.cos(angle + rnd(-0.2, 0.2)) * rnd(140, 280);
    const ey = player.y + Math.sin(angle + rnd(-0.2, 0.2)) * rnd(140, 280);
    effects.bolt(
      player.x + Math.cos(angle) * 24, player.y - 14 + Math.sin(angle) * 24,
      ex, ey, 0.08,
    );
  }
  bus.emit('sfx', { id: 'zap' });
}

const SPRAY_ORDER = ['steam', 'fire', 'cold', 'water'];

class SprayChannel extends Channel {
  constructor(elements) {
    super('spray', elements);
    this.present = SPRAY_ORDER.filter((el) => elements.includes(el));
    this.hasLightning = elements.includes('lightning');
    this.scale = 0.75 + elements.length * 0.1;
  }

  update(dt, ctx) {
    const { world, effects, bus } = ctx;
    const player = world.player;
    const angle = aimAngle(ctx);
    const ox = player.x + Math.cos(angle) * 26;
    const oy = player.y - 14 + Math.sin(angle) * 26;
    const n = Math.ceil(140 * this.scale * dt);
    for (let i = 0; i < n; i++) {
      const el = this.present[Math.floor(Math.random() * this.present.length)] || 'water';
      const a = angle + rnd(-0.22, 0.22);
      const speed = rnd(300, 460);
      effects.add({
        x: ox, y: oy,
        vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
        life: rnd(0.35, 0.55), max: 0.55,
        c: ELEMENTS[el].color, r: rnd(3, 6) * this.scale,
        spray: el, add: true,
      });
    }
    if (this.hasLightning) {
      this.tick -= dt;
      if (this.tick <= 0) {
        this.tick = 0.14;
        arcZap(ctx, angle, this.els, 0.35);
      }
    }
    if (Math.random() < 0.3) bus.emit('sfx', { id: 'sprayLoop' });
  }
}

class ArcChannel extends Channel {
  constructor(elements) {
    super('arc', elements);
  }

  update(dt, ctx) {
    this.tick -= dt;
    if (this.tick <= 0) {
      this.tick = 0.09;
      arcZap(ctx, aimAngle(ctx), this.els, 0.45);
    }
  }
}

class BeamChannel extends Channel {
  constructor(elements) {
    super('beam', elements);
    const counts = countElements(elements);
    this.isLife = Boolean(counts.life && !counts.arcane);
    this.beam = null; // {ox, oy, a, len, life} — consumed by the renderer
    this.scale = 0.7 + elements.length * 0.12;
  }

  update(dt, ctx) {
    const { world, combat, effects, bus } = ctx;
    const player = world.player;
    const angle = aimAngle(ctx);
    const ox = player.x + Math.cos(angle) * 26;
    const oy = player.y - 14 + Math.sin(angle) * 26;

    // ray to the first dummy or wall node
    let end = 500, hit = null;
    for (const d of world.enemies) {
      const t = rayCircle(ox, oy, angle, d.x, d.y - 14, 22);
      if (t !== null && t < end) { end = t; hit = d; }
    }
    for (const w of world.walls) {
      for (const node of w.nodes) {
        const t = rayCircle(ox, oy, angle, node.x, node.y, 16);
        if (t !== null && t < end) { end = t; hit = null; node.hp -= 40 * dt; }
      }
    }
    this.beam = { ox, oy, a: angle, len: end, life: this.isLife };

    if (hit) {
      if (this.isLife) {
        combat.heal(hit, 60 * dt * duplicatePower(this.els, 'life'));
      } else {
        const dps = 85 * duplicatePower(this.els, 'arcane');
        this.tick -= dt;
        if (this.tick <= 0) {
          this.tick = 0.12;
          combat.applyElements(hit, this.els, {
            mult: 0.16, kx: Math.cos(angle) * 40, ky: Math.sin(angle) * 40, quiet: true,
          }, ctx);
        }
        combat.damageTarget(hit, dps * dt, 0, 0, true);
      }
      const extras = this.els.filter((el) => el !== 'arcane' && el !== 'life');
      if (extras.length && Math.random() < 6 * dt) {
        combat.applyElements(hit, extras, { mult: 0.1, quiet: true }, ctx);
      }
      effects.puff(ox + Math.cos(angle) * end, oy + Math.sin(angle) * end, this.isLife ? '#4ade80' : '#f43f5e', 2);
    }
    if (Math.random() < 0.25) bus.emit('sfx', { id: 'beamLoop', life: this.isLife });
  }
}

class BeamStrategy {
  cast(ctx, elements) {
    const channel = new BeamChannel(elements);
    ctx.bus.emit('sfx', { id: 'beamStart', life: channel.isLife });
    return channel;
  }
}

class SprayStrategy {
  cast(ctx, elements) {
    return new SprayChannel(elements);
  }
}

class ArcStrategy {
  cast(ctx, elements) {
    return new ArcChannel(elements);
  }
}

/** Registry mapping resolved spell kinds to their cast strategy. */
export const STRATEGIES = {
  wall: new WallStrategy(),
  boulder: new BoulderStrategy(),
  shards: new ShardStrategy(),
  beam: new BeamStrategy(),
  spray: new SprayStrategy(),
  arc: new ArcStrategy(),
};

// ---------------------------------------------------------------- cast modes

/** Area burst around the player (C key). */
export function castArea(ctx, elements) {
  const { world, combat, effects, camera, bus } = ctx;
  const player = world.player;
  const counts = countElements(elements);
  const radius = 150 + 26 * elements.length;

  effects.ring(player.x, player.y, 20, radius, 0.4, ELEMENTS[elements[elements.length - 1]].color);
  for (const d of world.enemies.slice()) {
    const dd = Math.hypot(d.x - player.x, d.y - player.y);
    if (dd < radius + 18) {
      const kb = 260 * (1 - dd / (radius + 60));
      const a = Math.atan2(d.y - player.y, d.x - player.x);
      combat.applyElements(d, elements, { mult: 0.9, kx: Math.cos(a) * kb, ky: Math.sin(a) * kb }, ctx);
    }
  }
  if (counts.life) combat.heal(player, 18 * duplicatePower(elements, 'life'));

  bus.emit('sfx', { id: 'area' });
  camera.addShake(9);
  effects.puff(player.x, player.y, '#fff', 20);
}

/** Cast the queue on yourself (Shift+RMB) — for better or worse. */
export function castSelf(ctx, elements) {
  const { world, combat, effects, camera, bus } = ctx;
  const player = world.player;
  const counts = countElements(elements);

  if (counts.life) combat.heal(player, 26 * counts.life * duplicatePower(elements, 'life'));
  if (counts.shield) player.ward = 8;
  if (counts.water) { player.status.wet = 6; player.status.burn = 0; }
  if (counts.steam) { player.status.wet = 5; combat.hurtPlayer(player, 6 * counts.steam, ctx); }
  if (counts.fire) {
    if (player.status.wet > 0) player.status.wet = 0;
    else player.status.burn = 4;
  }
  if (counts.cold) {
    player.status.chill = 4;
    if (player.status.wet > 0) { player.status.frozen = 2; player.status.wet = 0; }
  }
  if (counts.ice) { player.status.chill = 4; combat.hurtPlayer(player, 8 * counts.ice, ctx); }
  if (counts.lightning) {
    combat.hurtPlayer(player, (player.status.wet ? 2 : 1) * 14 * counts.lightning, ctx);
    player.status.wet = 0;
  }
  if (counts.arcane) combat.hurtPlayer(player, 16 * counts.arcane, ctx);
  if (counts.earth) {
    // ground slam
    effects.ring(player.x, player.y, 10, 110, 0.35, ELEMENTS.earth.color);
    for (const d of world.enemies.slice()) {
      if (dist2(d.x, d.y, player.x, player.y) < 110 ** 2) {
        const a = Math.atan2(d.y - player.y, d.x - player.x);
        combat.applyElements(d, ['earth'], { mult: 0.7, kx: Math.cos(a) * 300, ky: Math.sin(a) * 300 }, ctx);
      }
    }
    camera.addShake(7);
  }

  effects.puff(player.x, player.y - 10, ELEMENTS[elements[0]].color, 14);
  bus.emit('sfx', { id: 'self', element: elements[0] });
}
