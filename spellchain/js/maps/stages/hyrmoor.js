import { seededRng } from '../../core/math.js';
import { deco, building, scatter, scatterCircle, clampPos, PATH, PLAZA, STREET, PLAZA_STONE, WATER, PLANKS } from '../builders.js';
// ------------------------------------------------------------- castle town

export function buildCastle() {
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
      { x: 800, y: 215, r: 46, style: 'door', label: 'Hyrmoor Keep', target: 'keep', tx: 900, ty: 1080 },
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

  map.npcs = [
    {
      name: 'Guard Aldric', body: 'guard', x: 715, y: 250, wander: 18,
      palette: { robe: '#64748b', hair: '#44403c' },
      lines: [
        'The keep is open to visitors. MIND THE CARPET.',
        'Move along, citizen.',
        'The dungeon stairs are off-limits. Officially.',
        'Bertram thinks he outranks me. He does not.',
      ],
      chatter: ['Boots polished?', 'Shift change can’t come sooner.', 'I outrank you, you know.'],
      sleeps: false,
    },
    {
      name: 'Guard Bertram', body: 'guard', x: 885, y: 250, wander: 18,
      palette: { robe: '#64748b', hair: '#78350f' },
      lines: [
        'Visitors may enter the keep. Touch nothing. TOUCH. NOTHING.',
        'Quiet night. I like quiet nights.',
        'Something moans under the keep at night. Probably the pipes. Probably.',
      ],
      chatter: ['All quiet.', 'You hear that? …Never mind.', 'I outrank you, you know.'],
      sleeps: false,
    },
    {
      name: 'Lady Seraphine', body: 'villager', x: 800, y: 950, wander: 150,
      palette: { robe: '#7e22ce', hair: '#fbbf24' },
      lines: [
        'A wizard in the plaza? How rustic.',
        'The fountain water is imported, you know.',
        'Do mind the hem. It’s Willowbrook silk.',
        'I summered at the hot springs across the sea. Divine. You wouldn’t know it.',
      ],
      chatter: ['Simply divine.', 'Have you seen my new brooch?', 'The plaza needs sweeping.'],
    },
    {
      name: 'Odo', body: 'villager', x: 660, y: 640, wander: 70,
      palette: { robe: '#b45309', hair: '#292524' },
      lines: [
        'Finest goods this side of the Crossing!',
        'For you? A special price. Everything’s a special price.',
        'The stalls by the fountain get all the foot traffic. Lucky Odo.',
        'I import from Merlion Quay now. Skyline mugs. They sell themselves.',
      ],
      chatter: ['Business is booming.', 'Special price, friend!', 'Mind the stall, would you?'],
    },
    {
      name: 'Lyra', body: 'villager', x: 900, y: 800, wander: 90,
      palette: { robe: '#0e7490', hair: '#e11d48' },
      lines: [
        'My ballad about the keep finally has an ending — they opened the doors!',
        'Every coin in that fountain is a story.',
        'Hum with me — no? Suit yourself.',
        'The verse about the dungeon writes itself. The rhymes are all “doom”.',
      ],
      chatter: ['La la laaa…', 'That’s going in the ballad.', 'Do you know any sea shanties?'],
    },
    {
      name: 'Milo', body: 'kid', x: 800, y: 1120, wander: 180,
      palette: { robe: '#166534', hair: '#1c1917' },
      lines: [
        'They let people in the keep now! I saw a THRONE!',
        'I bet the king eats cake every single day.',
        'There’s stairs going DOWN in there. Dares don’t count if you’re scared, right?',
      ],
      chatter: ['Tag, you’re it!', 'I saw the throne!', 'Race you to the fountain!'],
    },
  ];

  map.decos.sort((a, b) => a.y - b.y);
  return map;
}


// ----------------------------------------------------------- keep & dungeon

/**
 * The expanded royal keep: throne hall in the center, servants' west wing
 * with the Undercroft stairs, and the royal east wing. The dais and the
 * royal wing are RESTRICTED — linger and the watch is called.
 */
export function buildKeep() {
  const map = {
    id: 'keep', name: 'Hyrmoor Keep',
    w: 1800, h: 1200,
    outside: '#08080c',
    floor: '#2b2b34', floorAlt: '#2d2d36',
    walled: true,
    regions: [
      { kind: 'rect', x: 860, y: 160, w: 80, h: 1040, color: '#6d1a1a' },  // royal carpet
      { kind: 'circle', x: 900, y: 200, r: 120, color: '#3a3a44' },        // dais
      { kind: 'rect', x: 1320, y: 120, w: 420, h: 500, color: '#33333e' }, // royal east wing
      { kind: 'rect', x: 60, y: 120, w: 380, h: 480, color: '#30303a' },   // servants' west wing
      { kind: 'rect', x: 440, y: 330, w: 880, h: 70, color: '#33333e' },   // cross gallery
    ],
    restricted: [
      { x: 1320, y: 120, w: 480, h: 500 },  // the royal quarters
      { x: 780, y: 60, w: 240, h: 230 },    // the dais itself
    ],
    decos: [], colliders: [], spawns: [],
    gates: [
      { x: 900, y: 1175, r: 48, style: 'door', label: 'Castle Town', target: 'castle', tx: 800, ty: 300 },
      { x: 140, y: 660, r: 40, style: 'door', label: 'The Undercroft', target: 'dungeon', tx: 200, ty: 220 },
    ],
  };

  deco(map, 'throne', 900, 170);
  map.colliders.push({ x: 870, y: 120, w: 60, h: 50 });
  for (const y of [480, 700, 920]) {
    for (const x of [620, 1180]) {
      deco(map, 'column', x, y);
      map.colliders.push({ x: x - 16, y: y - 24, w: 32, h: 24 });
    }
  }
  for (const [x, y] of [[790, 210], [1010, 210]]) deco(map, 'campfire', x, y); // braziers
  for (const [x, y] of [[620, 420], [1180, 420], [620, 860], [1180, 860], [1400, 200], [1660, 200]]) {
    deco(map, 'banner', x, y, 1.2, 0.05);
  }
  // royal quarters furnishings
  for (const [x, y] of [[1420, 320], [1620, 320], [1520, 500]]) {
    deco(map, 'counter', x, y, 0.5, 0.5); // grand tables
    map.colliders.push({ x: x - 50, y: y - 16, w: 100, h: 16 });
  }
  deco(map, 'crate', 200, 300);
  deco(map, 'barrel', 230, 312);
  deco(map, 'crate', 1680, 1080);

  map.npcs = [
    // ----- the royal family
    {
      name: 'King Aldric IV', body: 'villager', x: 900, y: 260, wander: 50, royal: true, hp: 70,
      palette: { robe: '#7e22ce', hair: '#d6d3d1' },
      lines: [
        'A wizard, in Our hall! Willowbrook breeds them bold these days.',
        'The kingdom is quiet, the taxes are late, and dinner is soon. Kingship.',
        'Mind the dais, friend. The guards mind it more than We do.',
      ],
      chatter: ['Hm. Quite.', 'We are amused.', 'Where is that steward?'],
    },
    {
      name: 'Queen Maribel', body: 'villager', x: 960, y: 300, wander: 60, royal: true, hp: 70,
      palette: { robe: '#9f1239', hair: '#1c1917' },
      lines: [
        'Welcome to the keep. Do NOT feed the princes sugar.',
        'The east wing is private. The tapestries alone are worth more than the town.',
        'A queen hears everything. Yes, even that.',
      ],
      chatter: ['Posture, dear.', 'The tapestries need airing.', 'Where are the boys?'],
    },
    {
      name: 'Prince Edmund', body: 'kid', x: 700, y: 600, wander: 200, royal: true, hp: 45,
      palette: { robe: '#7e22ce', hair: '#78350f' },
      lines: [
        'I’m going to be king one day. Casper says HE is. He is NOT.',
        'Have you fought a goblin? A REAL one? How big?',
      ],
      chatter: ['En garde, Casper!', 'I’m telling Mother!'],
    },
    {
      name: 'Prince Casper', body: 'kid', x: 1100, y: 620, wander: 200, royal: true, hp: 45,
      palette: { robe: '#1d4ed8', hair: '#78350f' },
      lines: [
        'Edmund says he’ll be king. Father says the throne picks the patient one. That’s me.',
        'The prisoner in the Undercroft sings at night. I’ve heard him.',
      ],
      chatter: ['Missed me, Edmund!', 'I’m the patient one.'],
    },
    {
      name: 'Princess Elowen', body: 'villager', x: 1520, y: 380, wander: 120, royal: true, hp: 55,
      palette: { robe: '#0e7490', hair: '#fbbf24' },
      lines: [
        'You’re in the royal wing, you know. I won’t tell — yet.',
        'I’ve read every map of the Crossing. One day I’ll sail it, crown or no crown.',
        'The guards count to four heartbeats before they come. I’ve timed them.',
      ],
      chatter: ['Another dull afternoon.', 'The sea charts don’t lie.'],
    },
    // ----- the watch
    { name: 'Castellan Roderic', body: 'guard', x: 900, y: 420, wander: 40, palette: { robe: '#64748b', hair: '#78716c' }, lines: ['Welcome to Hyrmoor Keep. The dais and the east wing are OFF LIMITS.', 'Their Majesties receive visitors. From a respectful distance.', 'The Undercroft stairs are west. I’d stay out. Things moved in.'], chatter: ['Report.', 'Steady on.'], sleeps: false },
    { name: 'Guard Willa', body: 'guard', x: 620, y: 550, wander: 70, palette: { robe: '#64748b', hair: '#7c2d12' }, lines: ['Eyes forward, feet off the carpet.', 'Third shift this week. The braziers keep me company.'], chatter: ['All clear.', 'Long night.'], sleeps: false },
    { name: 'Guard Osric', body: 'guard', x: 1180, y: 550, wander: 70, palette: { robe: '#64748b', hair: '#1c1917' }, lines: ['I heard chains rattling under the floor last night.', 'Nothing gets past me. Mostly nothing.'], chatter: ['You hear that?', 'Probably rats.'], sleeps: false },
    { name: 'Guard Tam', body: 'guard', x: 900, y: 900, wander: 100, palette: { robe: '#64748b', hair: '#44403c' }, lines: ['The columns are older than the town. Don’t chip them.', 'Visitors! Finally something to look at.'], chatter: ['Halt! …Carry on.', 'Quiet post.'], sleeps: false },
    { name: 'Guard Brenna', body: 'guard', x: 1350, y: 400, wander: 60, palette: { robe: '#64748b', hair: '#b45309' }, lines: ['This is the royal wing. Turn around, wizard.', 'One more step and I start counting.'], chatter: ['Wing secure.', 'Nothing to report.'], sleeps: false },
    { name: 'Guard Hollis', body: 'guard', x: 200, y: 500, wander: 60, palette: { robe: '#64748b', hair: '#292524' }, lines: ['Servants’ wing. Nothing to see but soup and stairs.', 'The Undercroft door stays shut after dark. MOSTLY shut.'], chatter: ['Soup again.', 'Quiet down here.'], sleeps: false },
  ];

  map.decos.sort((a, b) => a.y - b.y);
  return map;
}

export function buildDungeon() {
  const rng = seededRng(707);
  const map = {
    id: 'dungeon', name: 'The Undercroft',
    w: 1400, h: 1000,
    outside: '#050507',
    floor: '#17171c', floorAlt: '#18181d',
    walled: true,
    regions: [
      { kind: 'rect', x: 120, y: 430, w: 1160, h: 90, color: '#1d1d23' }, // central corridor
    ],
    decos: [], colliders: [],
    spawns: [
      { type: 'skeleton', x: 500, y: 300 }, { type: 'skeleton', x: 1100, y: 700 },
      { type: 'skeleton', x: 800, y: 250 }, { type: 'ghost', x: 400, y: 750 },
      { type: 'ghost', x: 950, y: 480 }, { type: 'ghost', x: 1250, y: 250 },
    ],
    respawn: { interval: 600, cap: 8, minDist: 320 },
    gates: [
      { x: 160, y: 130, r: 42, style: 'door', label: 'Hyrmoor Keep', target: 'keep', tx: 220, ty: 660 },
    ],
  };

  // cells along the south wall
  for (let i = 0; i < 4; i++) {
    const x = 300 + i * 280;
    deco(map, 'cellbars', x, 940);
    map.colliders.push({ x: x - 60, y: 950, w: 120, h: 40 });
  }

  // the keep's one (living) guest, locked behind the second cell
  map.npcs = [
    {
      name: 'Griswold', body: 'elder', x: 580, y: 975, wander: 26, sleeps: false, hp: 50,
      palette: { robe: '#57534e', hair: '#a8a29e' },
      lines: [
        'A visitor! Have you come to hear my case? I’m INNOCENT.',
        'They say I stole the crown jewels. I merely… relocated them. Briefly.',
        'The ghosts are decent company once you learn to ignore the wailing.',
        'Prince Casper listens to me sing. Good lad. Terrible taste.',
      ],
      chatter: ['🎵 Ohh, the tide rolls in…', '*rattles chains rhythmically*'],
    },
  ];
  for (const [x, y] of [[300, 200], [700, 160], [1150, 200], [250, 600], [700, 620], [1200, 620], [500, 900], [1000, 900]]) {
    deco(map, 'torch', x, y, 1, rng());
  }
  scatter(map, rng, 'bones', 12, 150, 150, 1300, 900);
  scatter(map, rng, 'puddle', 6, 150, 150, 1300, 900);
  deco(map, 'crate', 1300, 880);
  deco(map, 'barrel', 1270, 900);

  map.decos.sort((a, b) => a.y - b.y);
  return map;
}

