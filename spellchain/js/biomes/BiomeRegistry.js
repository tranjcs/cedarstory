/**
 * Biome schema — pure data. The infinite map is a weighted Voronoi diagram:
 * the world is divided into cells of BIOME_CELL px, each cell rolls one
 * biome (by `weight`), and `size` scales how far that biome's influence
 * reaches, so some biomes sprawl (desert) and some stay pocket-sized
 * (swamp). Chunks of CHUNK_SIZE px are generated lazily as players roam.
 *
 * Schema per biome:
 *   name        display name, announced when entered
 *   weight      relative spawn likelihood when a cell rolls its biome
 *   size        Voronoi influence multiplier — bigger = larger regions
 *   floor       ground color (checkered slightly with floorAlt)
 *   decorations [type, expectedCountPerChunk] — drawn, purely cosmetic
 *   enemies     [enemyType, weight] spawn table for chunks in this biome
 */
export const BIOME_CELL = 1500;
export const CHUNK_SIZE = 360;

export const BIOMES = {
  meadow: {
    name: 'Emerald Meadow',
    weight: 3,
    size: 1.0,
    floor: '#121f18',
    floorAlt: '#132119',
    decorations: [['flower', 5], ['tree', 1.2], ['rock', 0.6]],
    enemies: [['slime', 0.6], ['bandit', 0.2]],
  },
  forest: {
    name: 'Deepwood',
    weight: 2.5,
    size: 1.15,
    floor: '#0e1a13',
    floorAlt: '#0f1b14',
    decorations: [['tree', 5], ['mushroom', 1.2], ['rock', 0.5]],
    enemies: [['sporeling', 0.5], ['skeleton', 0.3]],
  },
  desert: {
    name: 'Sunscar Desert',
    weight: 2,
    size: 1.5,
    floor: '#231d12',
    floorAlt: '#241e13',
    decorations: [['cactus', 1.4], ['rock', 1.2], ['bones', 0.5]],
    enemies: [['bandit', 0.55], ['imp', 0.15]],
  },
  tundra: {
    name: 'Frostreach',
    weight: 2,
    size: 1.25,
    floor: '#151f2d',
    floorAlt: '#16212f',
    decorations: [['pine', 2.4], ['snowrock', 1], ['iceshard', 0.8]],
    enemies: [['skeleton', 0.45], ['slime', 0.25]],
  },
  swamp: {
    name: 'Mirefen',
    weight: 2,
    size: 0.7,
    floor: '#141c11',
    floorAlt: '#151d12',
    decorations: [['mushroom', 3], ['puddle', 1.8], ['deadtree', 1.2]],
    enemies: [['sporeling', 0.6], ['slime', 0.35]],
  },
  ashlands: {
    name: 'The Ashlands',
    weight: 1,
    size: 0.9,
    floor: '#1e1112',
    floorAlt: '#1f1213',
    decorations: [['ember', 1.6], ['deadtree', 1], ['rock', 1]],
    enemies: [['imp', 0.6], ['skeleton', 0.25]],
  },
};

export const BIOME_IDS = Object.keys(BIOMES);
export const TOTAL_BIOME_WEIGHT = BIOME_IDS.reduce((sum, id) => sum + BIOMES[id].weight, 0);
