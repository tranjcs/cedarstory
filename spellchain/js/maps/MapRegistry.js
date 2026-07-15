import { seededRng } from '../core/math.js';

/**
 * Fixed-map schema — pure data, like BiomeRegistry but for handcrafted
 * places. The infinite overworld is map id 'overworld'; everything here is
 * a finite room with its own coordinate space starting at (0,0).
 *
 *   w, h       bounds in px — entities are clamped inside
 *   outside    color painted beyond the bounds (void for towns, sea for isles)
 *   floor      ground color, checkered with floorAlt in 120px tiles
 *   walled     draw a stone wall + corner towers around the perimeter
 *   boat       players ride a boat here (ocean crossing)
 *   regions    [rect|circle] color patches drawn over the floor (roads,
 *              plazas, water, dock planks) in order
 *   decos      static decorations, same shape ChunkManager produces
 *   colliders  axis-aligned rects entities cannot walk through
 *   gates      circular triggers that travel to another map:
 *              { x, y, r, style, label, target, tx, ty } — tx/ty is the
 *              arrival position in the target map. `locked` gates only
 *              announce their `message`.
 *   spawns     enemies spawned fresh on every visit
 */

const PATH = '#2e2519';
const PLAZA = '#332a1c';
const STREET = '#31313c';
const PLAZA_STONE = '#3a3a44';
const WATER = '#0c3350';
const PLANKS = '#5e452c';

function deco(map, type, x, y, s = 1, v = 0.5, rot = 0) {
  map.decos.push({ type, x, y, s, v, rot });
}

/** Building footprint sizes for collider generation, per deco type. */
const FOOTPRINTS = {
  house: { w: 116, h: 58 },
  shop: { w: 120, h: 58 },
  hut: { w: 72, h: 40 },
  stall: { w: 68, h: 26 },
};

function building(map, type, x, y, v = 0.5, s = 1) {
  deco(map, type, x, y, s, v);
  const f = FOOTPRINTS[type];
  map.colliders.push({ x: x - (f.w / 2) * s, y: y - f.h * s, w: f.w * s, h: f.h * s });
}

function scatter(map, rng, type, count, x0, y0, x1, y1) {
  for (let i = 0; i < count; i++) {
    deco(map, type, x0 + rng() * (x1 - x0), y0 + rng() * (y1 - y0), 0.8 + rng() * 0.5, rng());
  }
}

// ------------------------------------------------------------------ town 1

function buildTown() {
  const rng = seededRng(101);
  const map = {
    id: 'town', name: 'Willowbrook',
    w: 1400, h: 1100,
    outside: '#0a0c12',
    floor: '#15231a', floorAlt: '#16241b',
    walled: true,
    regions: [
      { kind: 'rect', x: 670, y: 0, w: 60, h: 1100, color: PATH },
      { kind: 'rect', x: 380, y: 530, w: 930, h: 60, color: PATH },
      { kind: 'circle', x: 700, y: 560, r: 140, color: PATH },
      { kind: 'rect', x: 1310, y: 0, w: 90, h: 1100, color: WATER },
      { kind: 'rect', x: 1160, y: 522, w: 240, h: 76, color: PLANKS, planks: true },
    ],
    decos: [], colliders: [], spawns: [],
    gates: [
      { x: 700, y: 1075, r: 48, style: 'arch', label: 'The Wilds', target: 'overworld', tx: 0, ty: -500 },
      { x: 700, y: 25, r: 48, style: 'arch', label: 'Hyrmoor Castle Town', target: 'castle', tx: 800, ty: 1250 },
      { x: 1345, y: 560, r: 42, style: 'dock', label: 'Sail to Gullrest Isle', target: 'ocean', tx: 210, ty: 500 },
    ],
  };

  // the river blocks passage everywhere except the dock corridor
  map.colliders.push({ x: 1310, y: 0, w: 90, h: 512 });
  map.colliders.push({ x: 1310, y: 608, w: 90, h: 492 });

  building(map, 'house', 300, 300, 0.8);
  building(map, 'house', 560, 250, 0.3);
  building(map, 'shop', 1020, 280, 0.7);
  building(map, 'house', 260, 760, 0.2);
  building(map, 'shop', 480, 880, 0.5);
  building(map, 'house', 1000, 830, 0.9);
  building(map, 'stall', 590, 640, 0.2);
  building(map, 'stall', 820, 660, 0.8);

  deco(map, 'well', 780, 470);
  map.colliders.push({ x: 754, y: 448, w: 52, h: 26 });

  for (const [x, y] of [[646, 400], [754, 400], [646, 720], [754, 720], [1130, 510], [400, 510]]) {
    deco(map, 'lamp', x, y, 1, rng());
  }
  for (const [x, y] of [[620, 1050], [780, 1050], [620, 60], [780, 60]]) {
    deco(map, 'fence', x, y);
  }
  for (const [x, y] of [
    [150, 190], [420, 130], [890, 140], [1230, 240], [130, 520],
    [150, 930], [560, 1010], [880, 990], [1150, 900],
  ]) {
    deco(map, 'tree', x, y, 0.9 + rng() * 0.4, rng());
  }
  deco(map, 'crate', 1185, 490);
  deco(map, 'crate', 1215, 482);
  deco(map, 'barrel', 1180, 645);
  deco(map, 'dockboat', 1345, 640, 1, 0.3);
  scatter(map, rng, 'flower', 26, 60, 60, 1280, 1040);
  scatter(map, rng, 'bush', 6, 100, 100, 600, 1000);
  for (let i = 0; i < 10; i++) deco(map, 'wave', 1325 + rng() * 60, rng() * 1100, 1, rng());

  map.decos.sort((a, b) => a.y - b.y);
  return map;
}

// ------------------------------------------------------------- castle town

function buildCastle() {
  const rng = seededRng(202);
  const map = {
    id: 'castle', name: 'Hyrmoor Castle Town',
    w: 1600, h: 1400,
    outside: '#0a0c12',
    floor: '#26262e', floorAlt: '#28282f',
    walled: true,
    regions: [
      { kind: 'rect', x: 750, y: 170, w: 100, h: 1230, color: STREET },
      { kind: 'rect', x: 220, y: 670, w: 1160, h: 100, color: STREET },
      { kind: 'circle', x: 800, y: 720, r: 230, color: PLAZA_STONE },
      { kind: 'circle', x: 800, y: 720, r: 64, color: WATER },
    ],
    decos: [], colliders: [], spawns: [],
    gates: [
      { x: 800, y: 1375, r: 50, style: 'arch', label: 'To Willowbrook', target: 'town', tx: 700, ty: 120 },
      { x: 800, y: 215, r: 46, style: 'none', locked: true, message: 'The castle gates are sealed. Royal orders.' },
    ],
  };

  deco(map, 'castle', 800, 172, 1.1);
  map.colliders.push({ x: 480, y: 0, w: 640, h: 168 });

  deco(map, 'fountain', 800, 720);
  map.colliders.push({ x: 742, y: 662, w: 116, h: 116 });

  building(map, 'shop', 300, 430, 0.1);
  building(map, 'house', 530, 380, 0.6);
  building(map, 'shop', 1090, 400, 0.9);
  building(map, 'house', 1310, 450, 0.4);
  building(map, 'shop', 300, 1060, 0.7);
  building(map, 'house', 530, 1140, 0.2);
  building(map, 'shop', 1080, 1120, 0.35);
  building(map, 'house', 1300, 1050, 0.8);
  building(map, 'stall', 630, 600, 0.15);
  building(map, 'stall', 970, 600, 0.55);
  building(map, 'stall', 630, 880, 0.85);
  building(map, 'stall', 970, 880, 0.4);

  for (const [x, y] of [[735, 320], [865, 320], [735, 1000], [865, 1000], [735, 1240], [865, 1240]]) {
    deco(map, 'banner', x, y, 1, rng());
  }
  for (const [x, y] of [[660, 560], [940, 560], [660, 880], [940, 880], [280, 700], [1320, 700]]) {
    deco(map, 'lamp', x, y, 1, rng());
  }
  deco(map, 'crate', 380, 460);
  deco(map, 'barrel', 410, 470);
  deco(map, 'crate', 1160, 430);
  deco(map, 'barrel', 250, 1080);
  deco(map, 'crate', 1150, 1140);

  map.decos.sort((a, b) => a.y - b.y);
  return map;
}

// ------------------------------------------------------------ ocean crossing

function buildOcean() {
  const rng = seededRng(303);
  const map = {
    id: 'ocean', name: 'The Sapphire Crossing',
    w: 2400, h: 1000,
    outside: '#0c3350',
    floor: '#0c3350', floorAlt: '#0d3452',
    boat: true,
    regions: [
      { kind: 'rect', x: 0, y: 445, w: 250, h: 110, color: PLANKS, planks: true },
      { kind: 'rect', x: 2150, y: 445, w: 250, h: 110, color: PLANKS, planks: true },
    ],
    decos: [], colliders: [], spawns: [],
    gates: [
      { x: 35, y: 500, r: 50, style: 'dock', label: 'Willowbrook Dock', target: 'town', tx: 1240, ty: 560 },
      { x: 2365, y: 500, r: 50, style: 'dock', label: 'Gullrest Isle', target: 'island', tx: 170, ty: 600 },
    ],
  };

  for (const [x, y] of [[760, 260], [1210, 720], [1690, 300], [1450, 120], [980, 840]]) {
    deco(map, 'searock', x, y, 0.9 + rng() * 0.5, rng());
    map.colliders.push({ x: x - 26, y: y - 24, w: 52, h: 26 });
  }
  for (const [x, y] of [[250, 450], [250, 550], [2150, 450], [2150, 550]]) {
    deco(map, 'dockpost', x, y);
  }
  scatter(map, rng, 'wave', 46, 100, 40, 2300, 960);

  map.decos.sort((a, b) => a.y - b.y);
  return map;
}

// ------------------------------------------------------------------ island

function buildIsland() {
  const rng = seededRng(404);
  const map = {
    id: 'island', name: 'Gullrest Isle',
    w: 1600, h: 1300,
    outside: '#0c3350',
    floor: '#37301e', floorAlt: '#383120',
    regions: [
      { kind: 'circle', x: 840, y: 620, r: 400, color: '#18271c' },
      { kind: 'rect', x: 0, y: 558, w: 230, h: 84, color: PLANKS, planks: true },
    ],
    decos: [], colliders: [],
    spawns: [
      { type: 'slime', x: 1250, y: 330 },
      { type: 'slime', x: 1220, y: 1000 },
      { type: 'bandit', x: 1370, y: 650 },
    ],
    gates: [
      { x: 40, y: 600, r: 48, style: 'dock', label: 'Sail to the Mainland', target: 'ocean', tx: 2190, ty: 500 },
    ],
  };

  building(map, 'hut', 700, 470, 0.3);
  building(map, 'hut', 990, 540, 0.7);
  building(map, 'hut', 760, 800, 0.5);
  deco(map, 'campfire', 860, 660);

  for (const [x, y] of [
    [300, 300], [480, 180], [950, 150], [1250, 260], [1420, 520],
    [1380, 900], [1150, 1120], [700, 1180], [330, 1000], [200, 760],
  ]) {
    deco(map, 'palm', x, y, 0.9 + rng() * 0.4, rng());
  }
  deco(map, 'rock', 1300, 350, 1.6, 0.2);
  deco(map, 'rock', 1350, 400, 1.2, 0.7);
  deco(map, 'banner', 1330, 330, 1, 0.1);
  deco(map, 'crate', 260, 540);
  deco(map, 'crate', 290, 615);
  deco(map, 'dockboat', 140, 680, 1, 0.6);
  scatter(map, rng, 'flower', 18, 520, 320, 1150, 940);
  scatter(map, rng, 'bush', 8, 500, 300, 1180, 960);

  // surf along the coast
  for (let i = 0; i < 14; i++) {
    deco(map, 'wave', rng() * 1600, rng() < 0.5 ? -24 : 1324, 1, rng());
  }
  for (let i = 0; i < 12; i++) {
    deco(map, 'wave', rng() < 0.5 ? -26 : 1626, rng() * 1300, 1, rng());
  }

  map.decos.sort((a, b) => a.y - b.y);
  return map;
}

export const MAPS = {
  town: buildTown(),
  castle: buildCastle(),
  ocean: buildOcean(),
  island: buildIsland(),
};

/** The town entrance standing in the infinite overworld, north of spawn. */
export const OVERWORLD_GATE = {
  x: 0, y: -620, r: 48, style: 'arch', label: 'Willowbrook', target: 'town', tx: 700, ty: 980,
};
