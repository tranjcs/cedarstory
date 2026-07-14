/**
 * Central, data-driven game configuration.
 * All balance numbers and element chemistry live here so gameplay can be
 * tuned without touching logic.
 */

export const MAX_QUEUE = 5;
export const DUPLICATE_POWER = 1.7; // each duplicate element multiplies its punch
export const PARTICLE_CAP = 900;

export const ELEMENTS = {
  water:     { color: '#38bdf8', key: 'Q', damage: 6,  tone: 392 },
  life:      { color: '#4ade80', key: 'W', damage: 0,  tone: 440 },
  shield:    { color: '#eab308', key: 'E', damage: 0,  tone: 494 },
  cold:      { color: '#dbeafe', key: 'R', damage: 7,  tone: 523 },
  lightning: { color: '#c084fc', key: 'A', damage: 13, tone: 587 },
  arcane:    { color: '#f43f5e', key: 'S', damage: 15, tone: 659 },
  earth:     { color: '#b45309', key: 'D', damage: 34, tone: 330 },
  fire:      { color: '#fb923c', key: 'F', damage: 10, tone: 784 },
  // compound elements (created by combining, not keyable)
  steam:     { color: '#e2e8f0',           damage: 8,  tone: 830 },
  ice:       { color: '#a5f3fc',           damage: 20, tone: 880 },
};

export const KEY_TO_ELEMENT = {
  KeyQ: 'water',
  KeyW: 'life',
  KeyE: 'shield',
  KeyR: 'cold',
  KeyA: 'lightning',
  KeyS: 'arcane',
  KeyD: 'earth',
  KeyF: 'fire',
};

/** [a, b, product] — queueing a with b present fuses them into product. */
export const COMBINATIONS = [
  ['water', 'fire', 'steam'],
  ['water', 'cold', 'ice'],
  ['steam', 'cold', 'water'],
  ['ice',   'fire', 'water'],
];

/** [a, b] — opposing elements annihilate each other in the queue. */
export const OPPOSITES = [
  ['fire', 'cold'],
  ['water', 'lightning'],
  ['earth', 'lightning'],
  ['life', 'arcane'],
  ['shield', 'shield'],
];

export const PLAYER = {
  maxHp: 100,
  regenPerSec: 2,
  speed: 265,
  accel: 14,
  chillSlow: 0.5,
  wetSlow: 0.85,
  burnDps: 6,
  dash: { duration: 0.17, speed: 950, cooldown: 1.1 },
};

export const DUMMY = {
  maxHp: 300,
  burnDps: 9,
};

export const CHANNEL = {
  baseDuration: 1.1,
  perElement: 0.55,
};
