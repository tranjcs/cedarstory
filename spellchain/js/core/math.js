/** Pure math helpers shared across the game. */

export const TAU = Math.PI * 2;

export const rnd = (a, b) => a + Math.random() * (b - a);

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const dist2 = (ax, ay, bx, by) => (ax - bx) ** 2 + (ay - by) ** 2;

export const angleBetween = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);

/** Wrap an angle to [-PI, PI]. */
export function normalizeAngle(a) {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
}

/**
 * Deterministic hash of integer coordinates to [0, 1). The same inputs
 * always produce the same output — the backbone of infinite terrain.
 */
export function hash2(x, y, seed = 0) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 2246822519)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Seeded PRNG (mulberry32) — returns a function yielding [0, 1). */
export function seededRng(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Distance along a ray (origin ox/oy, angle a) to a circle, or null if the
 * ray misses.
 */
export function rayCircle(ox, oy, a, cx, cy, r) {
  const dx = Math.cos(a), dy = Math.sin(a);
  const fx = ox - cx, fy = oy - cy;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - r * r;
  const disc = b * b - 4 * c;
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / 2;
  return t > 0 ? t : null;
}
