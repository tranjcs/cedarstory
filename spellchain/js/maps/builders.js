/**
 * Shared stage-building helpers and palette constants used by every
 * module in stages/. Buildings made with building() are destructible:
 * the deco record doubles as hp/burning/destroyed state and its collider
 * links back so rubble stops blocking.
 */
export const PATH = '#2e2519';
export const PLAZA = '#332a1c';
export const STREET = '#31313c';
export const PLAZA_STONE = '#3a3a44';
export const WATER = '#0c3350';
export const PLANKS = '#5e452c';

export function deco(map, type, x, y, s = 1, v = 0.5, rot = 0) {
  map.decos.push({ type, x, y, s, v, rot });
}

/** Building footprint sizes for collider generation, per deco type. */
export const FOOTPRINTS = {
  house: { w: 116, h: 58 },
  shop: { w: 120, h: 58 },
  tavern: { w: 120, h: 58 },
  hut: { w: 72, h: 40 },
  stall: { w: 68, h: 26 },
  hanok: { w: 132, h: 56 },
  tent: { w: 84, h: 34 },
  windmill: { w: 80, h: 50 },
};

/** Hit points for destructible building types. */
export const BUILDING_HP = {
  house: 320, shop: 320, tavern: 360, hut: 220,
  stall: 140, hanok: 320, tent: 160, windmill: 420,
};

/**
 * A destructible structure: one deco record that doubles as the building's
 * state (hp / burning / destroyed), a collider linked back to it (so rubble
 * stops blocking), and a register the burn/damage logic iterates.
 */
export function building(map, type, x, y, v = 0.5, s = 1) {
  deco(map, type, x, y, s, v);
  const b = map.decos[map.decos.length - 1];
  b.hp = BUILDING_HP[type] ?? 300;
  b.maxHp = b.hp;
  b.burning = 0;
  b.destroyed = false;
  const f = FOOTPRINTS[type];
  map.colliders.push({ x: x - (f.w / 2) * s, y: y - f.h * s, w: f.w * s, h: f.h * s, b });
  (map.buildings ??= []).push(b);
}

export function scatter(map, rng, type, count, x0, y0, x1, y1) {
  for (let i = 0; i < count; i++) {
    deco(map, type, x0 + rng() * (x1 - x0), y0 + rng() * (y1 - y0), 0.8 + rng() * 0.5, rng());
  }
}

export function scatterCircle(map, rng, type, count, cx, cy, r) {
  for (let i = 0; i < count; i++) {
    const a = rng() * Math.PI * 2;
    const d = Math.sqrt(rng()) * r * 0.92;
    deco(map, type, cx + Math.cos(a) * d, cy + Math.sin(a) * d, 0.8 + rng() * 0.5, rng());
  }
}
export const clampPos = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
