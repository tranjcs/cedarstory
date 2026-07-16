import { seededRng } from '../../core/math.js';
import { deco, building, scatter, scatterCircle, clampPos, PATH, PLAZA, STREET, PLAZA_STONE, WATER, PLANKS } from '../builders.js';
// ---------------------------------------------------------- far ports

/** Korean folk village — hanok roofs, onggi jars, rice paddies. */
export function buildKorea() {
  const rng = seededRng(1010);
  const map = {
    id: 'korea', name: 'Arirang Village',
    w: 1800, h: 1300,
    outside: '#0c3350',
    floor: '#1a2418', floorAlt: '#1b2519',
    regions: [
      // rice paddies, terraced
      { kind: 'rect', x: 120, y: 160, w: 380, h: 220, color: '#1b3a2e', planks: true },
      { kind: 'rect', x: 120, y: 420, w: 380, h: 220, color: '#1b3a2e', planks: true },
      { kind: 'rect', x: 1320, y: 700, w: 360, h: 220, color: '#1b3a2e', planks: true },
      { kind: 'rect', x: 870, y: 200, w: 60, h: 1000, color: PATH },
      { kind: 'rect', x: 0, y: 1080, w: 200, h: 120, color: PLANKS, planks: true },
    ],
    decos: [], colliders: [], spawns: [],
    gates: [
      { x: 900, y: 1265, r: 48, style: 'dock', label: 'The Sapphire Crossing', target: 'ocean', tx: 2600, ty: 220 },
    ],
  };

  for (const [x, y, v] of [[700, 350, 0.2], [1150, 320, 0.7], [650, 750, 0.5], [1150, 800, 0.9]]) {
    building(map, 'hanok', x, y, v);
  }
  // village guardians at the path's ends
  deco(map, 'jangseung', 850, 260);
  deco(map, 'jangseung', 950, 260, 1, 0.8);
  for (const [x, y] of [[750, 420], [1050, 420], [750, 900], [1050, 900]]) {
    deco(map, 'stonelantern', x, y, 1, rng());
  }
  // onggi jars huddle beside every kitchen
  for (const [x, y] of [[770, 390], [800, 400], [1220, 360], [590, 790], [1230, 850], [1260, 840]]) {
    deco(map, 'onggi', x, y, 0.9 + rng() * 0.3, rng());
  }
  scatter(map, rng, 'tree', 10, 1350, 100, 1750, 600);
  scatter(map, rng, 'flower', 20, 100, 700, 800, 1200);

  map.npcs = [
    {
      name: 'Haraboji Ki', body: 'elder', x: 900, y: 500, wander: 70,
      palette: { robe: '#e7e5e4', hair: '#d6d3d1' },
      lines: [
        'Welcome, traveler. The jangseung keep bad spirits out — mostly.',
        'The paddies have fed this village for nine generations.',
        'Arirang, arirang, arariyo… ah, you don’t know the song. Sit, I’ll teach you.',
      ],
      chatter: ['The rice grows well.', 'My knees say rain.', 'Sing with me!'],
    },
    {
      name: 'Sunhee', body: 'villager', x: 700, y: 850, wander: 120,
      palette: { robe: '#be185d', hair: '#1c1917' },
      lines: [
        'The onggi jars? Kimchi. Don’t open them, the whole village will know.',
        'Mainlanders always stare at the roofs. Yes, they curve. It’s lovely. Move along.',
        'The tide market comes on the full moon. Best silk east of the Crossing.',
      ],
      chatter: ['The jars need turning.', 'Have you eaten?', 'Aigo, my back.'],
    },
    {
      name: 'Minjun', body: 'kid', x: 1000, y: 950, wander: 170,
      palette: { robe: '#1d4ed8', hair: '#1c1917' },
      lines: [
        'I can jump BOTH paddies. Wanna see? Don’t tell Sunhee.',
        'Grandfather says the totems blink at night. I believe him!',
      ],
      chatter: ['Watch this!', 'Race you to the dock!'],
    },
    { name: 'Chamsoe', body: 'ox', x: 400, y: 700, wander: 100, palette: { robe: '#7c5a3a', hair: '#5c4430' }, lines: ['Hrrmph.', '*flicks ear*'] },
  ];

  map.decos.sort((a, b) => a.y - b.y);
  return map;
}

/** Japanese grove town — torii, pagoda, sakura, stone lanterns. */
export function buildJapan() {
  const rng = seededRng(1111);
  const map = {
    id: 'japan', name: 'Momiji Grove',
    w: 1800, h: 1300,
    outside: '#0c3350',
    floor: '#1d2117', floorAlt: '#1e2218',
    regions: [
      { kind: 'rect', x: 870, y: 150, w: 60, h: 1050, color: '#332a1c' },   // shrine path
      { kind: 'circle', x: 900, y: 320, r: 150, color: '#3a3126' },          // shrine court
      { kind: 'circle', x: 420, y: 800, r: 130, color: '#12313e' },          // koi pond
      { kind: 'rect', x: 0, y: 1080, w: 200, h: 120, color: PLANKS, planks: true },
    ],
    decos: [], colliders: [], spawns: [],
    gates: [
      { x: 900, y: 1265, r: 48, style: 'dock', label: 'The Sapphire Crossing', target: 'ocean', tx: 5000, ty: 220 },
    ],
  };

  deco(map, 'pagoda', 900, 260);
  map.colliders.push({ x: 830, y: 190, w: 140, h: 70 });
  deco(map, 'torii', 900, 620);
  deco(map, 'torii', 900, 1150);
  for (const [x, y] of [[820, 700], [980, 700], [820, 950], [980, 950]]) {
    deco(map, 'stonelantern', x, y, 1, rng());
  }
  for (const [x, y] of [[500, 300], [300, 450], [1300, 350], [1500, 550], [1250, 900], [650, 1050], [1450, 1100], [250, 950], [600, 550]]) {
    deco(map, 'sakura', x, y, 0.9 + rng() * 0.4, rng());
  }
  for (const [x, y, v] of [[1350, 700, 0.3], [550, 400, 0.7]]) {
    building(map, 'hanok', x, y, v); // machiya cousin — same silhouette works
  }
  scatter(map, rng, 'bamboo', 14, 1550, 150, 1750, 900);
  scatter(map, rng, 'flower', 16, 200, 600, 800, 1200);

  map.npcs = [
    {
      name: 'Kannushi Sora', body: 'elder', x: 900, y: 450, wander: 60,
      palette: { robe: '#f8fafc', hair: '#d6d3d1' },
      lines: [
        'Bow once at the torii, once at the shrine. The spirits are counting.',
        'The maple leaves fall all year here. Nobody knows why. It’s beautiful, so nobody asks.',
        'The pagoda has stood nine hundred years. Do not test your boulder spell.',
      ],
      chatter: ['The spirits are restless.', 'Sweep, sweep.', 'A fine day for a blessing.'],
    },
    {
      name: 'Yuki', body: 'villager', x: 600, y: 850, wander: 110,
      palette: { robe: '#0e7490', hair: '#1c1917' },
      lines: [
        'The koi are older than the shrine keeper. Don’t tell him I said that.',
        'Feed the koi and your travels go smooth. Everyone knows this.',
        'The hot springs are one islet over. Best soak of your life.',
      ],
      chatter: ['The koi look hungry.', 'Petals in my tea again.', 'Lovely evening.'],
    },
    {
      name: 'Hana', body: 'kid', x: 1100, y: 1000, wander: 180,
      palette: { robe: '#be185d', hair: '#1c1917' },
      lines: [
        'I counted ALL the koi. There’s eleven. Or nine. They keep moving!',
        'If you catch a falling petal, you get a wish. I have forty wishes.',
      ],
      chatter: ['Petal! Catch it!', 'Eleven koi. Definitely eleven.'],
    },
  ];

  map.decos.sort((a, b) => a.y - b.y);
  return map;
}

/** Singapore-inspired quay — towers, a merlion, hawker stalls. */
export function buildSg() {
  const rng = seededRng(1212);
  const map = {
    id: 'sg', name: 'Merlion Quay',
    w: 1800, h: 1300,
    outside: '#0c3350',
    floor: '#26262c', floorAlt: '#27272d',
    regions: [
      { kind: 'rect', x: 0, y: 0, w: 1800, h: 140, color: PLANKS, planks: true }, // boardwalk
      { kind: 'rect', x: 120, y: 140, w: 1560, h: 80, color: '#33333b' },          // esplanade
      { kind: 'circle', x: 900, y: 400, r: 130, color: '#3a3a42' },                // merlion plaza
      { kind: 'rect', x: 870, y: 220, w: 60, h: 1080, color: '#33333b' },
    ],
    decos: [], colliders: [], spawns: [],
    gates: [
      { x: 900, y: 35, r: 48, style: 'dock', label: 'The Sapphire Crossing', target: 'ocean', tx: 3200, ty: 3980 },
    ],
  };

  deco(map, 'merlion', 900, 430);
  map.colliders.push({ x: 870, y: 380, w: 60, h: 50 });
  // the skyline: a row of glass towers
  for (const [x, y, v] of [[350, 800, 0.2], [560, 750, 0.5], [1240, 760, 0.8], [1450, 820, 0.35], [200, 1050, 0.65], [1600, 1080, 0.15]]) {
    deco(map, 'tower', x, y, 1, v);
    map.colliders.push({ x: x - 55, y: y - 60, w: 110, h: 60 });
  }
  // hawker row — supper never closes here (stall awnings, lanterns)
  for (const [x, y, v] of [[650, 500, 0.1], [1150, 500, 0.6], [650, 620, 0.9], [1150, 620, 0.4]]) {
    building(map, 'stall', x, y, v);
  }
  for (const [x, y] of [[750, 420], [1050, 420], [500, 570], [1300, 570]]) {
    deco(map, 'lamp', x, y, 1, rng());
  }
  scatter(map, rng, 'palm', 10, 150, 200, 1650, 350);
  deco(map, 'crate', 1500, 300);
  deco(map, 'barrel', 1530, 315);

  map.npcs = [
    {
      name: 'Auntie Mei', body: 'villager', x: 900, y: 560, wander: 90,
      palette: { robe: '#dc2626', hair: '#1c1917' },
      lines: [
        'Laksa! Satay! Kaya toast! You look hungry, wizard. Sit, sit!',
        'The merlion? Half lion, half fish, all lucky. Rub the plinth, not the statue.',
        'My stall has fed sailors from every port on the Crossing.',
        'Eat first, adventure later. Auntie knows.',
      ],
      chatter: ['Order up!', 'Fresh batch coming!', 'You eat already or not?'],
    },
    {
      name: 'Darren', body: 'villager', x: 500, y: 900, wander: 130,
      palette: { robe: '#334155', hair: '#1c1917' },
      lines: [
        'The towers? Merchant guilds. They compete on height. It’s getting silly.',
        'Everything ships through this quay. Spices, silk, skyline mugs.',
        'The boardwalk lights at dusk are worth the trip alone.',
      ],
      chatter: ['Busy quarter.', 'Shipment’s late again.', 'Coffee first.'],
    },
    {
      name: 'Priya', body: 'kid', x: 1100, y: 900, wander: 180,
      palette: { robe: '#7e22ce', hair: '#1c1917' },
      lines: [
        'The merlion spits water when nobody’s looking. I’ve ALMOST seen it.',
        'One day I’ll build a tower taller than ALL of these.',
      ],
      chatter: ['Look at the boats!', 'Taller! They should build taller!'],
    },
  ];

  map.decos.sort((a, b) => a.y - b.y);
  return map;
}

/** Hot-spring islet — steaming pools among the rocks. */
