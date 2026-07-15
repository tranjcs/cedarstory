/**
 * Timed elemental statuses, composed into anything that can be affected by
 * spells or potions (Component pattern). Each field is seconds remaining.
 */
const STATUS_KEYS = ['wet', 'burn', 'chill', 'frozen', 'shock', 'poison', 'confusion', 'haste'];

export class StatusEffects {
  wet = 0;
  burn = 0;
  chill = 0;
  frozen = 0;
  shock = 0;
  poison = 0;     // damage over time; infectious — spreads to neighbors
  confusion = 0;  // enemies walk backwards, players get reversed controls
  haste = 0;      // move 50% faster

  update(dt) {
    for (const key of STATUS_KEYS) this[key] = Math.max(0, this[key] - dt);
  }

  reset() {
    for (const key of STATUS_KEYS) this[key] = 0;
  }
}
