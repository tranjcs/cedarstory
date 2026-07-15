import { rnd } from '../core/math.js';
import { Zone, Portal, Cat } from '../entities/alchemy.js';

/**
 * The Alchemist's eight preset potions — pure data plus effect functions.
 * Keyed to the same QWERASDF row the Mage uses for elements. No mixing:
 * each key is one finished brew, balanced by cooldowns instead.
 *
 * Alchemy is indiscriminate: heal circles mend enemies too (but scorch
 * the undead), haste splashes speed up whoever is standing there.
 */
export const POTIONS = {
  mushroom: {
    key: 'Q', name: 'Mushroom Brew', color: '#c084fc', cd: 7, radius: 100,
    desc: 'Grows a toxic mushroom patch. Poison spreads between victims.',
    onLand(ctx, x, y) {
      const decos = [];
      for (let i = 0; i < 7; i++) {
        const a = rnd(0, Math.PI * 2), d = rnd(10, 88);
        decos.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, s: rnd(0.7, 1.3) });
      }
      ctx.world.zones.push(new Zone({
        x, y, r: 100, ttl: 8, type: 'mushroom', color: '#c084fc', interval: 1, decos,
        onTick(ctx2, zone) {
          for (const e of zone.occupants(ctx2.world)) {
            if (e.kind !== 'enemy' && e.kind !== 'dummy') continue;
            if (e.poisonImmune) continue;
            if (e.status.poison <= 0) ctx2.effects.floatText(e.x, e.y - 56, 'POISONED', '#a3e635');
            e.status.poison = 4;
          }
          ctx2.effects.puff(zone.x + rnd(-60, 60), zone.y + rnd(-60, 60), '#a3e635', 2);
        },
      }));
    },
  },

  catnip: {
    key: 'W', name: 'Catnip Tonic', color: '#f4a261', cd: 14, radius: 0,
    desc: 'Summons three ferocious allies. They do not take requests.',
    onLand(ctx, x, y) {
      for (let i = 0; i < 3; i++) ctx.world.cats.push(new Cat(x, y, ctx.world.player));
      ctx.bus.emit('sfx', { id: 'meow' });
    },
  },

  portal: {
    key: 'E', name: 'Portal Draught', color: '#38bdf8', cd: 3, radius: 26,
    desc: 'Opens a portal. Two link together; a third replaces the oldest.',
    onLand(ctx, x, y) {
      ctx.world.portals.push(new Portal(x, y));
      while (ctx.world.portals.length > 2) ctx.world.portals.shift();
      ctx.bus.emit('sfx', { id: 'portal' });
    },
  },

  heal: {
    key: 'R', name: 'Healing Salve', color: '#4ade80', cd: 9, radius: 110,
    desc: 'Mends anything inside — friend, foe, or cat. Sears the undead.',
    onLand(ctx, x, y) {
      ctx.world.zones.push(new Zone({
        x, y, r: 110, ttl: 5, type: 'heal', color: '#4ade80', interval: 0.5,
        onTick(ctx2, zone) {
          for (const e of zone.occupants(ctx2.world)) {
            if (e.maxHp === undefined) continue;
            ctx2.combat.heal(e, 6);
          }
        },
      }));
    },
  },

  alcohol: {
    key: 'A', name: 'Moonshine', color: '#fbbf24', cd: 9, radius: 120,
    desc: 'Confusion cloud: enemies stagger backwards, players steer in reverse.',
    onLand(ctx, x, y) {
      ctx.world.zones.push(new Zone({
        x, y, r: 120, ttl: 4, type: 'alcohol', color: '#fbbf24', interval: 0.4,
        onTick(ctx2, zone) {
          for (const e of zone.occupants(ctx2.world)) {
            if (!e.status) continue;
            e.status.confusion = 2.5;
          }
        },
      }));
    },
  },

  butterfingers: {
    key: 'S', name: 'Butterfingers', color: '#fde68a', cd: 7, radius: 110,
    desc: 'Armed enemies in the splash drop their weapons.',
    onLand(ctx, x, y) {
      ctx.world.zones.push(new Zone({
        x, y, r: 110, ttl: 3, type: 'butterfingers', color: '#fde68a', interval: 99,
      }));
      for (const e of ctx.world.enemies) {
        if (Math.hypot(e.x - x, e.y - y) < 110 && e.dropWeapon) e.dropWeapon(ctx);
      }
    },
  },

  haste: {
    key: 'D', name: 'Haste Philter', color: '#7dd3fc', cd: 10, radius: 100,
    desc: 'Quickens everything standing in it by half again.',
    onLand(ctx, x, y) {
      ctx.world.zones.push(new Zone({
        x, y, r: 100, ttl: 4, type: 'haste', color: '#7dd3fc', interval: 0.4,
        onTick(ctx2, zone) {
          for (const e of zone.occupants(ctx2.world)) {
            if (!e.status) continue;
            e.status.haste = 3;
          }
        },
      }));
    },
  },

  rain: {
    key: 'F', name: 'Make It Rain', color: '#60a5fa', cd: 12, radius: 130,
    desc: 'A private raincloud: soaks everything, douses fires, sprouts flowers.',
    onLand(ctx, x, y) {
      ctx.world.zones.push(new Zone({
        x, y, r: 130, ttl: 6, type: 'rain', color: '#60a5fa', interval: 0.5,
        onTick(ctx2, zone) {
          for (const e of zone.occupants(ctx2.world)) {
            if (!e.status) continue;
            e.status.wet = 2.5;
            e.status.burn = 0;
          }
          if (Math.random() < 0.4) {
            const a = rnd(0, Math.PI * 2), d = rnd(0, zone.r * 0.9);
            ctx2.world.trailFlowers.push({
              x: zone.x + Math.cos(a) * d, y: zone.y + Math.sin(a) * d,
              ttl: 18, ttl0: 18, seed: Math.random(),
            });
          }
        },
      }));
      ctx.bus.emit('sfx', { id: 'rain' });
    },
  },
};

export const POTION_IDS = Object.keys(POTIONS);

/** The Mage's element keys double as the Alchemist's potion hotbar. */
export const ELEMENT_TO_POTION = {
  water: 'mushroom',
  life: 'catnip',
  shield: 'portal',
  cold: 'heal',
  lightning: 'alcohol',
  arcane: 'butter',
  earth: 'haste',
  fire: 'rain',
  // aliases for old names
  butter: 'butterfingers',
};
