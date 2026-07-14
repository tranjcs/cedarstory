import { rnd } from './math.js';

/**
 * Smoothly follows a target and owns screen shake. Also converts between
 * screen and world space (the world is rendered centered on the camera).
 */
export class Camera {
  x = 0;
  y = 0;
  #shake = 0;

  /** @param {number} dt @param {{x: number, y: number}} target */
  update(dt, target) {
    this.x += (target.x - this.x) * Math.min(1, 5 * dt);
    this.y += (target.y - this.y) * Math.min(1, 5 * dt);
    this.#shake = Math.max(0, this.#shake - 30 * dt);
  }

  addShake(magnitude) {
    this.#shake = Math.max(this.#shake, magnitude);
  }

  get shakeOffset() {
    return { x: rnd(-this.#shake, this.#shake), y: rnd(-this.#shake, this.#shake) };
  }

  screenToWorld(sx, sy) {
    return {
      x: this.x + (sx - window.innerWidth / 2),
      y: this.y + (sy - window.innerHeight / 2),
    };
  }
}
