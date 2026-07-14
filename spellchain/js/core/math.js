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
