import { seededRng } from '../../core/math.js';
import { deco, building, scatter, scatterCircle, clampPos, PATH, PLAZA, STREET, PLAZA_STONE, WATER, PLANKS } from '../builders.js';
// ------------------------------------------------------------ ocean crossing

/**
 * The Great Sea: a huge open crossing in the spirit of the Wind Waker.
 * Every far port docks off this map — it's the hub of the whole world.
 */
export function buildOcean() {
  const rng = seededRng(303);
  const map = {
    id: 'ocean', name: 'The Sapphire Crossing',
    w: 6400, h: 4200,
    outside: '#0c3350',
    floor: '#0c3350', floorAlt: '#0d3452',
    boat: true,
    regions: [
      // docks: west Willowbrook, southeast Gullrest, north Arirang,
      // northeast Momiji, south Merlion, plus the spa islet
      { kind: 'rect', x: 0, y: 2050, w: 260, h: 110, color: PLANKS, planks: true },
      { kind: 'rect', x: 6140, y: 3340, w: 260, h: 110, color: PLANKS, planks: true },
      { kind: 'rect', x: 2470, y: 0, w: 260, h: 130, color: PLANKS, planks: true },
      { kind: 'rect', x: 4870, y: 0, w: 260, h: 130, color: PLANKS, planks: true },
      { kind: 'rect', x: 3070, y: 4070, w: 260, h: 130, color: PLANKS, planks: true },
      // uncharted islets
      { kind: 'circle', x: 1400, y: 3200, r: 170, color: '#37301e' },
      { kind: 'circle', x: 3400, y: 1000, r: 190, color: '#37301e' },
      { kind: 'circle', x: 4800, y: 2600, r: 150, color: '#37301e' },
      { kind: 'circle', x: 2200, y: 1600, r: 120, color: '#37301e' },
      // spa islet with its own dock
      { kind: 'circle', x: 4300, y: 1400, r: 170, color: '#37301e' },
      { kind: 'rect', x: 4240, y: 1520, w: 120, h: 140, color: PLANKS, planks: true },
    ],
    decos: [], colliders: [],
    spawns: [
      { type: 'shark', x: 1000, y: 1000 }, { type: 'shark', x: 2600, y: 3000 },
      { type: 'shark', x: 4200, y: 3400 }, { type: 'shark', x: 5400, y: 1200 },
      { type: 'shark', x: 3000, y: 2000 }, { type: 'shark', x: 5000, y: 2200 },
      { type: 'shark', x: 1800, y: 2400 }, { type: 'shark', x: 3800, y: 500 },
    ],
    respawn: { interval: 600, cap: 10, minDist: 700 },
    gates: [
      { x: 35, y: 2105, r: 50, style: 'dock', label: 'Willowbrook', target: 'town', tx: 1240, ty: 560 },
      { x: 6365, y: 3395, r: 50, style: 'dock', label: 'Gullrest Isle', target: 'island', tx: 170, ty: 600 },
      { x: 2600, y: 30, r: 50, style: 'dock', label: 'Arirang Village', target: 'korea', tx: 900, ty: 1140 },
      { x: 5000, y: 30, r: 50, style: 'dock', label: 'Momiji Grove', target: 'japan', tx: 900, ty: 1140 },
      { x: 3200, y: 4170, r: 50, style: 'dock', label: 'Merlion Quay', target: 'sg', tx: 900, ty: 180 },
      { x: 4300, y: 1590, r: 44, style: 'dock', label: 'Steamvale Springs', target: 'spa', tx: 550, ty: 760 },
      { x: 2020, y: 2760, r: 46, style: 'dock', label: 'Board the derelict', target: 'ship', tx: 450, ty: 1300 },
    ],
  };

  // the derelict pirate ship, anchored mid-sea
  deco(map, 'ship', 2000, 2640, 1, 0.5);
  map.colliders.push({ x: 1880, y: 2520, w: 240, h: 120 });

  for (let i = 0; i < 14; i++) {
    const x = 400 + rng() * 5600, y = 300 + rng() * 3600;
    if (Math.hypot(x - 2000, y - 2640) < 320) continue; // keep the ship clear
    deco(map, 'searock', x, y, 0.9 + rng() * 0.6, rng());
    map.colliders.push({ x: x - 26, y: y - 24, w: 52, h: 26 });
  }
  // palms + crabs' shells on the islets
  for (const [cx, cy, r] of [[1400, 3200, 170], [3400, 1000, 190], [4800, 2600, 150], [2200, 1600, 120], [4300, 1400, 170]]) {
    scatterCircle(map, rng, 'palm', 3, cx, cy, r * 0.7);
  }
  for (const [x, y] of [[260, 2055], [260, 2155], [6140, 3345], [6140, 3445], [2475, 130], [2725, 130], [4875, 130], [5125, 130], [3075, 4070], [3325, 4070]]) {
    deco(map, 'dockpost', x, y);
  }
  scatter(map, rng, 'wave', 220, 100, 100, 6300, 4100);

  map.decos.sort((a, b) => a.y - b.y);
  return map;
}


// ------------------------------------------------------------- pirate ship

export function buildShip() {
  const rng = seededRng(808);
  const map = {
    id: 'ship', name: 'The Salty Curse',
    w: 900, h: 1500,
    outside: '#0c3350',
    floor: PLANKS, floorAlt: '#5a422a',
    regions: [],
    decos: [], colliders: [],
    spawns: [
      { type: 'ghost', x: 450, y: 300 }, { type: 'ghost', x: 250, y: 700 },
      { type: 'ghost', x: 650, y: 700 }, { type: 'ghost', x: 450, y: 1000 },
      { type: 'ghost', x: 300, y: 450 },
    ],
    respawn: { interval: 600, cap: 7, minDist: 300 },
    gates: [
      { x: 70, y: 1350, r: 44, style: 'dock', label: 'Back to the skiff', target: 'ocean', tx: 2020, ty: 2860 },
    ],
  };

  // masts, helm, cannons — a deck worth haunting
  for (const y of [420, 950]) {
    deco(map, 'mast', 450, y);
    map.colliders.push({ x: 432, y: y - 20, w: 36, h: 24 });
  }
  deco(map, 'wheel', 450, 130);
  map.colliders.push({ x: 425, y: 105, w: 50, h: 22 });
  for (const y of [350, 650, 1050]) {
    deco(map, 'cannon', 60, y, 1, 0, 0);
    deco(map, 'cannon', 840, y, 1, 0, Math.PI);
  }
  for (const [x, y] of [[200, 250], [700, 1200], [650, 250], [250, 1150]]) {
    deco(map, 'crate', x, y);
    deco(map, 'barrel', x + 30, y + 12);
  }
  scatter(map, rng, 'bones', 6, 150, 200, 750, 1300);
  scatter(map, rng, 'puddle', 5, 120, 200, 780, 1300);

  map.decos.sort((a, b) => a.y - b.y);
  return map;
}


// ------------------------------------------------------------------ island

export function buildIsland() {
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
      { type: 'crab', x: 380, y: 180 },
      { type: 'crab', x: 1450, y: 1100 },
      { type: 'crab', x: 250, y: 900 },
      { type: 'crab', x: 1480, y: 300 },
    ],
    respawn: { interval: 600, cap: 8, minDist: 420 },
    gates: [
      { x: 40, y: 600, r: 48, style: 'dock', label: 'Sail to the Mainland', target: 'ocean', tx: 6180, ty: 3395 },
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

  map.npcs = [
    {
      name: 'Marek', body: 'villager', x: 270, y: 600, wander: 70,
      palette: { robe: '#0c4a6e', hair: '#44403c' },
      lines: [
        'Caught anything? Me neither.',
        'The slimes here taste terrible. Don’t ask how I know.',
        'That bandit’s been eyeing my catch all week.',
        'Crabs everywhere this season. Pinched my toe clean through the boot.',
        'A shark followed my line for an hour yesterday. AN HOUR.',
      ],
      chatter: ['Tide’s out.', 'Nothing biting.', 'You smell that? Storm’s coming.'],
    },
    {
      name: 'Wren', body: 'elder', x: 900, y: 700, wander: 55,
      palette: { robe: '#3f6212', hair: '#d6d3d1' },
      lines: [
        'I came to this isle for the quiet. Then the bandits came.',
        'The fire never goes out. Neither do I.',
        'Mainlanders. Always in a hurry.',
        'That derelict ship in the Crossing? Stay off it. The crew never left.',
      ],
      chatter: ['Hmph.', 'The fire wants wood.', 'Quiet, isn’t it? Good.'],
    },
    {
      name: 'Callie', body: 'kid', x: 1250, y: 850, wander: 220,
      palette: { robe: '#be185d', hair: '#78350f' },
      lines: [
        'Shells! Look at this one! LOOK AT IT!',
        'The waves bring something new every single day.',
        'I’m going to sail the Crossing myself someday.',
        'The crabs only pinch you if you’re slow. I’m never slow.',
      ],
      chatter: ['Look! A shell!', 'The sea is SO big.', 'I found a weird rock!'],
    },
  ];
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


export function buildSpa() {
  const rng = seededRng(1313);
  const map = {
    id: 'spa', name: 'Steamvale Springs',
    w: 1100, h: 900,
    outside: '#0c3350',
    floor: '#2a2620', floorAlt: '#2b2721',
    regions: [
      { kind: 'circle', x: 380, y: 350, r: 110, color: '#1d4a52' },
      { kind: 'circle', x: 680, y: 480, r: 85, color: '#1d4a52' },
      { kind: 'circle', x: 420, y: 620, r: 70, color: '#1d4a52' },
      { kind: 'rect', x: 480, y: 780, w: 140, h: 120, color: PLANKS, planks: true },
    ],
    decos: [], colliders: [], spawns: [],
    gates: [
      { x: 550, y: 865, r: 44, style: 'dock', label: 'The Sapphire Crossing', target: 'ocean', tx: 4300, ty: 1700 },
    ],
  };

  // steam rises off every pool
  for (const [x, y] of [[380, 330], [340, 380], [430, 360], [680, 460], [700, 500], [420, 600]]) {
    deco(map, 'steam', x, y, 1, rng());
  }
  building(map, 'hut', 850, 250, 0.5, 1.2); // the bathhouse
  for (const [x, y] of [[250, 250], [530, 260], [790, 420], [300, 700], [560, 560]]) {
    deco(map, 'rock', x, y, 1.3 + rng() * 0.5, rng());
    map.colliders.push({ x: x - 20, y: y - 16, w: 40, h: 18 });
  }
  for (const [x, y] of [[480, 760], [620, 760]]) deco(map, 'stonelantern', x, y, 1, rng());
  scatter(map, rng, 'bamboo', 12, 60, 60, 300, 850);
  scatter(map, rng, 'bamboo', 8, 900, 500, 1050, 850);

  map.npcs = [
    {
      name: 'Yumi', body: 'villager', x: 800, y: 350, wander: 80,
      palette: { robe: '#f5f0e6', hair: '#1c1917' },
      lines: [
        'Welcome to Steamvale. Towels by the bathhouse. Swords by the door.',
        'The middle pool is hottest. The far one fizzes. Don’t ask about the third.',
        'Soak fifteen minutes and you’ll forget every monster you’ve ever met.',
      ],
      chatter: ['Fresh towels!', 'The steam is perfect today.', 'No splashing, please.'],
    },
    {
      name: 'Bertholt', body: 'villager', x: 400, y: 380, wander: 40,
      palette: { robe: '#e8c39e', hair: '#78716c' },
      lines: [
        'Ahhhhhhh.',
        'I sailed three days for this pool and I regret NOTHING.',
        'The missus thinks I’m fishing. I am at peace.',
      ],
      chatter: ['Ahhh.', 'Bliss.', 'Five more minutes.'],
    },
  ];

  map.decos.sort((a, b) => a.y - b.y);
  return map;
}

/** A small shop interior — the camera stays put in here. */
