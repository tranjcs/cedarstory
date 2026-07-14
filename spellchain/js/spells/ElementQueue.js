import { COMBINATIONS, OPPOSITES, MAX_QUEUE } from '../config.js';

/**
 * The element queue and its chemistry rules. Adding an element may fuse
 * with a queued partner (Water+Fire -> Steam), annihilate an opposite
 * (Life vs Arcane), be rejected (queue full), or simply be queued.
 */
export class ElementQueue {
  #items = [];

  get items() {
    return [...this.#items];
  }

  get length() {
    return this.#items.length;
  }

  get last() {
    return this.#items[this.#items.length - 1];
  }

  /**
   * @param {string} element
   * @returns {{status: 'combined'|'cancelled'|'rejected'|'queued', product?: string}}
   */
  add(element) {
    // 1. fuse with a queued partner into a compound element
    for (const [a, b, product] of COMBINATIONS) {
      const partner = element === a ? b : element === b ? a : null;
      if (!partner) continue;
      const i = this.#items.lastIndexOf(partner);
      if (i >= 0) {
        this.#items[i] = product;
        return { status: 'combined', product };
      }
    }
    // 2. annihilate a queued opposite
    for (const [a, b] of OPPOSITES) {
      const partner = element === a ? b : element === b ? a : null;
      if (partner === null) continue;
      const i = this.#items.lastIndexOf(partner);
      if (i >= 0) {
        this.#items.splice(i, 1);
        return { status: 'cancelled' };
      }
    }
    // 3. queue it, if there is room
    if (this.#items.length >= MAX_QUEUE) return { status: 'rejected' };
    this.#items.push(element);
    return { status: 'queued' };
  }

  /** @returns {string | undefined} the removed element */
  pop() {
    return this.#items.pop();
  }

  /** @returns {boolean} whether anything was cleared */
  clear() {
    const had = this.#items.length > 0;
    this.#items.length = 0;
    return had;
  }

  /** Empty the queue and return its contents (used when a spell fires). */
  take() {
    return this.#items.splice(0, this.#items.length);
  }
}
