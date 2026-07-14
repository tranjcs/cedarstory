import { DUPLICATE_POWER } from '../config.js';

/**
 * Pure functions that interpret an element list as a spell: which shape it
 * takes, what it is called, and how duplicates scale its power.
 */

/** @returns {Record<string, number>} element -> occurrence count */
export function countElements(elements) {
  const counts = {};
  for (const el of elements) counts[el] = (counts[el] || 0) + 1;
  return counts;
}

/**
 * Decide the spell shape. Priority mirrors classic element-weaving rules:
 * shield makes barriers, earth lobs boulders, ice fires shards, arcane/life
 * become beams, the fluid elements spray, and lone lightning arcs.
 * @returns {'wall'|'boulder'|'shards'|'beam'|'spray'|'arc'|null}
 */
export function resolveKind(elements) {
  const c = countElements(elements);
  if (c.shield) return 'wall';
  if (c.earth) return 'boulder';
  if (c.ice) return 'shards';
  if (c.arcane || c.life) return 'beam';
  const sprayElements = (c.water || 0) + (c.fire || 0) + (c.cold || 0) + (c.steam || 0);
  if (sprayElements) return 'spray';
  if (c.lightning) return 'arc';
  return null;
}

const ADJECTIVES = {
  steam: 'Scalding',
  fire: 'Blazing',
  cold: 'Freezing',
  water: 'Drenching',
  lightning: 'Charged',
  ice: 'Glacial',
  life: 'Vital',
  arcane: 'Arcane',
  earth: 'Stone',
  shield: 'Warding',
};

const SPRAY_NAMES = {
  steam: 'Steam Blast',
  fire: 'Flamethrower',
  cold: 'Frost Spray',
  water: 'Water Jet',
};

/** Human-readable name for the spell a queue would produce. */
export function spellName(elements) {
  const c = countElements(elements);
  const kind = resolveKind(elements);
  const core = {
    wall: 'Wall',
    boulder: 'Boulder',
    shards: 'Shard Volley',
    beam: c.life && !c.arcane ? 'Mending Beam' : 'Death Beam',
    spray: 'Spray',
    arc: 'Lightning',
  }[kind] || '—';

  const adjectives = [];
  for (const el of Object.keys(c)) {
    if (kind === 'beam' && (el === 'arcane' || el === 'life')) continue;
    if (kind === 'boulder' && el === 'earth') continue;
    if (kind === 'wall' && el === 'shield') continue;
    if (kind === 'shards' && el === 'ice') continue;
    if (kind === 'spray' && ['water', 'fire', 'cold', 'steam'].includes(el) && Object.keys(c).length === 1) continue;
    if (kind === 'arc' && el === 'lightning') continue;
    adjectives.push(ADJECTIVES[el]);
  }

  if (kind === 'spray' && adjectives.length === 0) {
    const primary = ['steam', 'fire', 'cold', 'water'].find((el) => c[el]);
    return SPRAY_NAMES[primary];
  }
  return (adjectives.length ? adjectives.join(' ') + ' ' : '') + core;
}

/** Duplicates of an element multiply its punch (x1.7 per extra copy). */
export function duplicatePower(elements, name) {
  let n = 0;
  for (const el of elements) if (el === name) n++;
  return n === 0 ? 0 : Math.pow(DUPLICATE_POWER, n - 1);
}
