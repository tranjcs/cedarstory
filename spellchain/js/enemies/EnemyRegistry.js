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
 *   stationary           never moves, attacks, or slides from knockback —
 *                        a live damage-test target
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
  shark: {
    name: 'Reef Shark',
    hp: 150, speed: 200, radius: 17, aggro: 560,
    melee: { dmg: 24, range: 44, cd: 1.6, windup: 0.5 },
    weapon: null,
    resist: { water: 0.2, lightning: 1.5 },
    body: 'shark', color: '#64748b',
  },
  ghost: {
    name: 'Drowned Ghost',
    hp: 70, speed: 115, radius: 12, aggro: 400,
    melee: { dmg: 12, range: 36, cd: 1.1, windup: 0.4 },
    weapon: null,
    resist: { earth: 0.2, arcane: 1.4, cold: 0.5 },
    undead: true,
    poisonImmune: true,
    body: 'ghost', color: '#c7d2fe',
  },
  crab: {
    name: 'Pincher Crab',
    hp: 55, speed: 70, radius: 12, aggro: 240,
    melee: { dmg: 8, range: 30, cd: 0.9, windup: 0.3 },
    weapon: null,
    resist: { water: 0.4, earth: 0.6 },
    body: 'crab', color: '#f97316',
  },
  guardsman: {
    name: 'Hyrmoor Guardsman',
    hp: 170, speed: 155, radius: 13, aggro: 2400,
    melee: { dmg: 14, range: 46, cd: 1.2, windup: 0.4 },
    weapon: 'sword',
    resist: { arcane: 0.8 },
    body: 'guardsman', color: '#94a3b8',
  },
  dragon: {
    name: 'Elder Dragon',
    hp: 1_000_000, speed: 0, radius: 46, aggro: 0,
    melee: { dmg: 0, range: 0, cd: 99, windup: 0 },
    weapon: null,
    resist: {},
    stationary: true,
    body: 'dragon', color: '#b91c1c',
  },
  goblin: {
    name: 'Gnashfang Goblin',
    hp: 65, speed: 150, radius: 12, aggro: 340,
    melee: { dmg: 10, range: 34, cd: 1.0, windup: 0.35 },
    weapon: null,
    resist: {},
    body: 'goblin', color: '#84cc16',
  },
};
