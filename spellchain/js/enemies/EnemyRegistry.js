/**
 * Enemy schema — pure data.
 *
 *   hp / speed / radius  the basics
 *   aggro                distance at which it notices and chases the
 *                        closest player
 *   melee                { dmg, range, cd, windup } plus optional status
 *                        riders (burn / poison) applied on hit
 *   weapon               held item ('sword' | 'axe' | null). A disarmed
 *                        enemy drops it and punches for 35% damage.
 *   resist               per-element damage multiplier (0 = immune,
 *                        0.4 = takes 40%, 1.5 = vulnerable)
 *   undead               healing magic damages it instead
 *   poisonImmune         cannot be poisoned or infected
 *   body                 which sprite the renderer draws
 */
export const ENEMY_TYPES = {
  slime: {
    name: 'Slime',
    hp: 50, speed: 75, radius: 14, aggro: 260,
    melee: { dmg: 6, range: 34, cd: 1.0, windup: 0.35 },
    weapon: null,
    resist: { water: 0.3 },
    body: 'blob', color: '#4fd1c5',
  },
  sporeling: {
    name: 'Sporeling',
    hp: 45, speed: 95, radius: 12, aggro: 280,
    melee: { dmg: 6, range: 32, cd: 1.1, windup: 0.4, poison: true },
    weapon: null,
    resist: {},
    poisonImmune: true,
    body: 'shroom', color: '#c084fc',
  },
  skeleton: {
    name: 'Skeleton',
    hp: 90, speed: 120, radius: 13, aggro: 330,
    melee: { dmg: 13, range: 44, cd: 1.3, windup: 0.45 },
    weapon: 'sword',
    resist: { cold: 0.4, arcane: 0.6 },
    undead: true,
    body: 'skeleton', color: '#e2e8f0',
  },
  bandit: {
    name: 'Bandit',
    hp: 120, speed: 140, radius: 13, aggro: 350,
    melee: { dmg: 16, range: 46, cd: 1.4, windup: 0.5 },
    weapon: 'axe',
    resist: {},
    body: 'humanoid', color: '#d08770',
  },
  imp: {
    name: 'Cinder Imp',
    hp: 60, speed: 160, radius: 11, aggro: 300,
    melee: { dmg: 8, range: 34, cd: 0.9, windup: 0.3, burn: true },
    weapon: null,
    resist: { fire: 0, water: 1.5 },
    body: 'imp', color: '#f97316',
  },
};
