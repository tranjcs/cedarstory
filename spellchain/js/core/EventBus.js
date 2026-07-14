/**
 * Minimal publish/subscribe hub (Observer pattern).
 * Decouples producers (input, combat, casting) from consumers
 * (audio, HUD announcements, camera shake).
 */
export class EventBus {
  #listeners = new Map();

  /**
   * @param {string} type
   * @param {(payload: any) => void} handler
   * @returns {() => void} unsubscribe function
   */
  on(type, handler) {
    if (!this.#listeners.has(type)) this.#listeners.set(type, new Set());
    this.#listeners.get(type).add(handler);
    return () => this.off(type, handler);
  }

  off(type, handler) {
    this.#listeners.get(type)?.delete(handler);
  }

  emit(type, payload) {
    this.#listeners.get(type)?.forEach((handler) => handler(payload));
  }
}
