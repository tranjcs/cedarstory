import { seededRng } from '../../core/math.js';
import { deco, building, scatter, scatterCircle, clampPos, PATH, PLAZA, STREET, PLAZA_STONE, WATER, PLANKS } from '../builders.js';
// ------------------------------------------------------------- the wilds

/**
 * The starting stage: one large finite wilderness with five biome zones
 * (forest, tundra, desert, swamp, ashlands) around a meadow heart, fog at
 * the edges, and a road north to Willowbrook's gate.
 */
export function buildWilds() {
  const rng = seededRng(20260714);
  const map = {
    id: 'wilds', name: 'The Wilds',
    w: 3600, h: 2700,
    outside: '#0b0e14',
    fog: true,
    floor: '#121f18', floorAlt: '#132119',
    start: { x: 1800, y: 1500 },
    regions: [
      // deepwood, west
      { kind: 'circle', x: 720, y: 1150, r: 620, color: '#0e1a13' },
      { kind: 'circle', x: 1150, y: 800, r: 380, color: '#0e1a13' },
      // frostreach, north
      { kind: 'circle', x: 2000, y: 220, r: 560, color: '#151f2d' },
      { kind: 'circle', x: 2700, y: 330, r: 480, color: '#151f2d' },
      { kind: 'circle', x: 3250, y: 200, r: 420, color: '#151f2d' },
      // sunscar desert, southeast
      { kind: 'circle', x: 2980, y: 2150, r: 660, color: '#231d12' },
      { kind: 'circle', x: 2450, y: 2450, r: 420, color: '#231d12' },
      // mirefen swamp, east
      { kind: 'circle', x: 2900, y: 1050, r: 400, color: '#141c11' },
      // the ashlands, southwest
      { kind: 'circle', x: 780, y: 2300, r: 460, color: '#1e1112' },
      // road from the meadow heart up to the town gate
      { kind: 'rect', x: 1772, y: 760, w: 56, h: 760, color: PATH },
    ],
    decos: [], colliders: [], spawns: [], npcs: [],
    dummies: [{ x: 2040, y: 1420 }, { x: 2130, y: 1540 }],
    respawn: { interval: 600, cap: 26, minDist: 520 },
    gates: [
      { x: 1800, y: 720, r: 48, style: 'arch', label: 'Willowbrook', target: 'town', tx: 700, ty: 980 },
      { x: 300, y: 2580, r: 48, style: 'arch', label: 'Gnashfang Camp', target: 'camp', tx: 1450, ty: 600 },
    ],
  };

  // meadow heart: flowers, scattered trees and rocks over the whole stage
  scatter(map, rng, 'flower', 90, 80, 80, 3520, 2620);
  scatter(map, rng, 'tree', 26, 80, 80, 3520, 2620);
  scatter(map, rng, 'rock', 16, 80, 80, 3520, 2620);
  scatter(map, rng, 'bush', 20, 80, 80, 3520, 2620);
  // deepwood
  scatterCircle(map, rng, 'tree', 60, 720, 1150, 620);
  scatterCircle(map, rng, 'tree', 24, 1150, 800, 380);
  scatterCircle(map, rng, 'mushroom', 16, 720, 1150, 620);
  // frostreach
  scatterCircle(map, rng, 'pine', 26, 2000, 220, 560);
  scatterCircle(map, rng, 'pine', 22, 2700, 330, 480);
  scatterCircle(map, rng, 'pine', 16, 3250, 200, 420);
  scatterCircle(map, rng, 'snowrock', 12, 2500, 280, 700);
  scatterCircle(map, rng, 'iceshard', 10, 2500, 280, 700);
  // sunscar desert
  scatterCircle(map, rng, 'cactus', 18, 2980, 2150, 660);
  scatterCircle(map, rng, 'rock', 12, 2980, 2150, 660);
  scatterCircle(map, rng, 'bones', 8, 2800, 2250, 600);
  // mirefen
  scatterCircle(map, rng, 'mushroom', 18, 2900, 1050, 400);
  scatterCircle(map, rng, 'puddle', 12, 2900, 1050, 400);
  scatterCircle(map, rng, 'deadtree', 8, 2900, 1050, 400);
  // ashlands
  scatterCircle(map, rng, 'ember', 14, 780, 2300, 460);
  scatterCircle(map, rng, 'deadtree', 8, 780, 2300, 460);
  scatterCircle(map, rng, 'rock', 8, 780, 2300, 460);

  // enemy dens, matched to their old biome tables
  const dens = [
    ['slime', 4, 1800, 1500, 900],
    ['bandit', 2, 1500, 1900, 700],
    ['sporeling', 3, 720, 1150, 560],
    ['skeleton', 2, 1000, 950, 420],
    ['skeleton', 3, 2500, 300, 640],
    ['slime', 2, 2100, 400, 400],
    ['bandit', 3, 2980, 2150, 600],
    ['imp', 2, 2700, 2300, 460],
    ['sporeling', 2, 2900, 1050, 360],
    ['imp', 3, 780, 2300, 420],
  ];
  for (const [type, count, cx, cy, r] of dens) {
    for (let i = 0; i < count; i++) {
      const a = rng() * Math.PI * 2;
      const d = Math.sqrt(rng()) * r;
      const x = clampPos(cx + Math.cos(a) * d, 60, map.w - 60);
      const y = clampPos(cy + Math.sin(a) * d, 60, map.h - 60);
      // keep the meadow heart around the start calm
      if (Math.hypot(x - map.start.x, y - map.start.y) < 420) continue;
      map.spawns.push({ type, x, y });
    }
  }

  // boss practice target: a stationary elder dragon east of the meadow heart.
  // `once` keeps it out of the trickle-respawn waves — one dragon per visit.
  map.spawns.push({ type: 'dragon', x: 2450, y: 1650, once: true });

  map.decos.sort((a, b) => a.y - b.y);
  return map;
}


// -------------------------------------------------------------- goblin camp

export function buildCamp() {
  const rng = seededRng(909);
  const map = {
    id: 'camp', name: 'Gnashfang Camp',
    w: 1600, h: 1200,
    outside: '#0a0c12',
    floor: '#231a12', floorAlt: '#241b13',
    fog: true,
    regions: [
      { kind: 'circle', x: 800, y: 600, r: 240, color: '#2b2013' }, // trampled center
    ],
    decos: [], colliders: [],
    spawns: [
      { type: 'goblin', x: 700, y: 450 }, { type: 'goblin', x: 950, y: 550 },
      { type: 'goblin', x: 800, y: 800 }, { type: 'goblin', x: 500, y: 700 },
      { type: 'goblin', x: 1200, y: 400 }, { type: 'goblin', x: 1100, y: 900 },
      { type: 'goblin', x: 350, y: 350 }, { type: 'imp', x: 1300, y: 700 },
    ],
    respawn: { interval: 600, cap: 10, minDist: 380 },
    gates: [
      { x: 1560, y: 600, r: 46, style: 'arch', label: 'The Wilds', target: 'wilds', tx: 380, ty: 2580 },
    ],
  };

  for (const [x, y, v] of [[550, 400, 0.2], [1050, 420, 0.6], [520, 850, 0.4], [1080, 830, 0.8]]) {
    building(map, 'tent', x, y, v);
  }
  deco(map, 'campfire', 800, 600, 1.4);
  for (const [x, y] of [[650, 550], [950, 650], [800, 480]]) deco(map, 'campfire', x, y, 0.8, rng());
  for (const [x, y] of [[300, 600], [1300, 550], [800, 220], [750, 1000]]) {
    deco(map, 'totem', x, y, 1, rng());
  }
  scatter(map, rng, 'bones', 14, 200, 200, 1400, 1000);
  scatter(map, rng, 'deadtree', 8, 100, 100, 1500, 1100);
  deco(map, 'crate', 900, 500);
  deco(map, 'barrel', 930, 515);

  map.decos.sort((a, b) => a.y - b.y);
  return map;
}

