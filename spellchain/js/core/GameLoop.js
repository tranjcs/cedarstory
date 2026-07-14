/**
 * requestAnimationFrame-driven game loop with a clamped delta time so a
 * background tab or hitch never produces a giant simulation step.
 */
export class GameLoop {
  #last = 0;
  #running = false;

  /**
   * @param {{ update: (dt: number) => void, render: () => void }} hooks
   */
  constructor({ update, render }) {
    this.update = update;
    this.render = render;
  }

  start() {
    if (this.#running) return;
    this.#running = true;
    this.#last = performance.now();
    requestAnimationFrame(this.#tick);
  }

  stop() {
    this.#running = false;
  }

  #tick = (now) => {
    if (!this.#running) return;
    const dt = Math.min(0.033, (now - this.#last) / 1000);
    this.#last = now;
    this.update(dt);
    this.render();
    requestAnimationFrame(this.#tick);
  };
}
