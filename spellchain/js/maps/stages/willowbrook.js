import { seededRng } from '../../core/math.js';
import { deco, building, scatter, scatterCircle, clampPos, PATH, PLAZA, STREET, PLAZA_STONE, WATER, PLANKS } from '../builders.js';
// ------------------------------------------------------------------ town 1

export function buildTown() {
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
      { x: 700, y: 1075, r: 48, style: 'arch', label: 'The Wilds', target: 'wilds', tx: 1800, ty: 860 },
      { x: 700, y: 25, r: 48, style: 'arch', label: 'Hyrmoor Castle Town', target: 'castle', tx: 800, ty: 1250 },
      { x: 1345, y: 560, r: 42, style: 'dock', label: 'Set sail', target: 'ocean', tx: 320, ty: 2105 },
      { x: 25, y: 560, r: 48, style: 'arch', label: 'Willowbrook Farms', target: 'farm', tx: 1680, ty: 600 },
      { x: 1020, y: 292, r: 24, style: 'door', label: 'General Store', target: 'store', tx: 260, ty: 330 },
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
  building(map, 'tavern', 480, 470, 0.5);
  map.gates.push({ x: 480, y: 484, r: 24, style: 'door', label: 'The Gilded Toad', target: 'tavern', tx: 360, ty: 400 });

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

  map.npcs = [
    {
      name: 'Marla', body: 'villager', x: 830, y: 510, wander: 70,
      palette: { robe: '#a16207', hair: '#7c2d12' },
      lines: [
        'Fresh water from the well — best in the province.',
        'You look like you’ve seen a biome or two.',
        'Mind the river, dear. The current’s stronger than it looks.',
        'Poor Edric hasn’t said a proper word in weeks. Somebody should help him.',
        'I’m up with the sun and asleep by nightfall. Honest hours.',
      ],
      chatter: ['The well’s running sweet today.', 'Have you seen Edric? He looks worse.', 'Bucket’s cracked again.'],
    },
    {
      name: 'Tomas', body: 'villager', x: 420, y: 780, wander: 110,
      palette: { robe: '#4d7c0f', hair: '#57534e' },
      lines: [
        'Slimes got into my turnips again.',
        'The Wilds aren’t safe past the gate. You know that, right?',
        'A little rain potion would do these fields good.',
        'The west gate leads out to the farms. Mind the oxen — they don’t move for anyone.',
        'More monsters prowling at night lately. Stay in after dusk.',
      ],
      chatter: ['Turnips are in.', 'Rain’s coming, I can feel it in my knee.', 'That windmill needs new sails.'],
    },
    {
      name: 'Petra', body: 'villager', x: 610, y: 700, wander: 60,
      palette: { robe: '#9f1239', hair: '#1c1917' },
      lines: [
        'Apples! Fresher than a life spell!',
        'A wizard’s coin spends as good as anyone’s.',
        'Buy something or scoot.',
        'Hamish at the general store undercuts me. HIM and his ROOF.',
        'I close at sundown. Even apples need their sleep.',
      ],
      chatter: ['Prices are up again.', 'Hamish is a crook.', 'Lovely apples this season.'],
    },
    {
      name: 'Old Finn', body: 'elder', x: 1200, y: 560, wander: 45,
      palette: { robe: '#475569', hair: '#cbd5e1' },
      lines: [
        'Gullrest Isle’s out east. Took that skiff there as a lad.',
        'Watch the rocks in the Crossing. The sea keeps what it catches.',
        'The sea remembers, wizard.',
        'Sharks in the Crossing now. Big ones. Keep that boat moving.',
        'They say a ghost ship drifts out there when the moon’s up. I believe it.',
        'Far ports past the horizon — Arirang, Momiji, the Merlion. All a skiff ride away.',
      ],
      chatter: ['Wind’s turning.', 'I’ve seen bigger waves.', 'The tide keeps its own clock.'],
    },
    {
      name: 'Pip', body: 'kid', x: 700, y: 620, wander: 160,
      palette: { robe: '#1d4ed8', hair: '#b45309' },
      lines: [
        'Are you a REAL wizard?! Do a spell! Do a spell!',
        'I saw a cat come out of a bottle once. True story!',
        'Race you to the well!',
        'Jonty’s dog can catch a stick out of the AIR.',
        'Mum says I have to be home before dark or the goblins will get me.',
      ],
      chatter: ['Bet you can’t catch me!', 'Did you see the boat?!', 'I’m not scared of goblins. Much.'],
    },
    {
      name: 'Guard Hedda', body: 'guard', x: 750, y: 130, wander: 26,
      palette: { robe: '#64748b', hair: '#292524' },
      lines: [
        'Castle Town’s through the north gate. Behave yourself.',
        'No boulders inside the walls, wizard. I’m watching you.',
        'Night watch again. The things I’ve heard past that wall after dark…',
        'The keep’s open to visitors now. Mind the guards — they’re jumpy.',
      ],
      chatter: ['All quiet.', 'Long shift.', 'Keep moving along.'],
      sleeps: false,
    },
    {
      // he can't say what's wrong — someone ought to figure it out
      name: 'Edric', body: 'villager', x: 350, y: 620, wander: 30, mystery: true,
      palette: { robe: '#57534e', hair: '#78716c' },
      lines: [
        '…',
        '*He clutches his side and winces.*',
        'M-medicine… the herbalist left town… I…',
        '*He tries to speak, but only coughs.*',
      ],
      chatter: ['…', '*cough*'],
    },
    {
      name: 'Jonty', body: 'kid', x: 950, y: 430, wander: 140,
      palette: { robe: '#0e7490', hair: '#713f12' },
      lines: [
        'This is Biscuit! She’s the best dog in the whole province.',
        'Biscuit, sit! …She never sits.',
        'Biscuit chased a cat clean across the plaza yesterday. It was AMAZING.',
        'Don’t let your cat near her. She gets ideas.',
      ],
      chatter: ['Biscuit, heel!', 'Good girl, Biscuit.', 'Who wants a stick? You want a stick?'],
    },
    {
      name: 'Biscuit', body: 'dog', x: 985, y: 445, wander: 60, follow: 'Jonty',
      palette: { robe: '#8a6b4a', hair: '#6b4f33' },
      lines: ['Woof!', '*sniff sniff*', '*wags tail*'],
    },
    {
      // follows whoever will have her — and holds a grudge against Biscuit
      name: 'Mochi', body: 'cat', x: 720, y: 940, wander: 50, follow: 'player', sleeps: false,
      palette: { robe: '#d6d3d1', hair: '#a8a29e' },
      lines: ['Mrrp.', 'Purrrrr.', '*slow blink*'],
    },
  ];
  deco(map, 'dockboat', 1345, 640, 1, 0.3);
  scatter(map, rng, 'flower', 26, 60, 60, 1280, 1040);
  scatter(map, rng, 'bush', 6, 100, 100, 600, 1000);
  for (let i = 0; i < 10; i++) deco(map, 'wave', 1325 + rng() * 60, rng() * 1100, 1, rng());

  map.decos.sort((a, b) => a.y - b.y);
  return map;
}


// ---------------------------------------------------------------- farmland

export function buildFarm() {
  const rng = seededRng(505);
  const map = {
    id: 'farm', name: 'Willowbrook Farms',
    w: 1800, h: 1200,
    outside: '#0a0c12',
    floor: '#16241b', floorAlt: '#17251c',
    fog: true,
    regions: [
      // crop plots, furrowed
      { kind: 'rect', x: 160, y: 160, w: 420, h: 260, color: '#2b2415', planks: true },
      { kind: 'rect', x: 160, y: 520, w: 420, h: 260, color: '#2b2415', planks: true },
      { kind: 'rect', x: 700, y: 160, w: 420, h: 260, color: '#2b2415', planks: true },
      { kind: 'rect', x: 700, y: 820, w: 420, h: 260, color: '#2b2415', planks: true },
      // road to town
      { kind: 'rect', x: 1120, y: 570, w: 680, h: 60, color: PATH },
      { kind: 'circle', x: 420, y: 950, r: 90, color: '#1b3038' }, // pond
    ],
    decos: [], colliders: [], spawns: [],
    gates: [
      { x: 1775, y: 600, r: 48, style: 'arch', label: 'Willowbrook', target: 'town', tx: 100, ty: 560 },
    ],
  };

  // windmills and the barn
  building(map, 'windmill', 1300, 300, 0.3);
  building(map, 'windmill', 1350, 950, 0.7);
  building(map, 'house', 900, 620, 0.9, 1.25); // the barn-red farmhouse
  deco(map, 'well', 1050, 700);
  map.colliders.push({ x: 1024, y: 678, w: 52, h: 26 });
  for (let i = 0; i < 8; i++) deco(map, 'fence', 200 + i * 52, 120);
  for (let i = 0; i < 8; i++) deco(map, 'fence', 200 + i * 52, 810);
  deco(map, 'crate', 980, 520);
  deco(map, 'barrel', 1010, 530);
  deco(map, 'crate', 850, 530);
  scatter(map, rng, 'flower', 24, 80, 80, 1720, 1120);
  scatter(map, rng, 'tree', 6, 1450, 100, 1750, 500);
  scatter(map, rng, 'bush', 8, 100, 850, 800, 1150);

  map.npcs = [
    {
      name: 'Gwen', body: 'villager', x: 950, y: 700, wander: 130,
      palette: { robe: '#a16207', hair: '#7c2d12' },
      lines: [
        'Mind the crops, wizard. That earth spell of yours stays OUTSIDE the fence.',
        'The oxen plough at dawn. The chickens supervise.',
        'Milk, eggs, and grain — Willowbrook runs on this farm.',
        'A windmill’s worth ten strong backs, my gran used to say.',
      ],
      chatter: ['Crops are coming in nice.', 'Storm coming, I reckon.', 'Where’s that rooster gone?'],
    },
    {
      name: 'Rolf', body: 'villager', x: 400, y: 400, wander: 150,
      palette: { robe: '#4d7c0f', hair: '#292524' },
      lines: [
        'Been turning this field since sun-up. The ox does most of it, honestly.',
        'Chickens got out again. If you see one in town, that’s ours.',
        'Gwen says the mill needs new sails before harvest.',
      ],
      chatter: ['Back’s killing me.', 'That ox is smarter than me.', 'Lunch soon?'],
    },
    { name: 'Clucky', body: 'chicken', x: 700, y: 500, wander: 110, palette: { robe: '#f5f0e6', hair: '#dc2626' }, lines: ['Bok.', 'Bok bok!', 'BAGAWK!'] },
    { name: 'Henrietta', body: 'chicken', x: 760, y: 540, wander: 110, palette: { robe: '#f5f0e6', hair: '#dc2626' }, lines: ['Bok?', 'Cluck cluck.'] },
    { name: 'Nugget', body: 'chicken', x: 640, y: 560, wander: 130, palette: { robe: '#f5f0e6', hair: '#dc2626' }, lines: ['Peep!', 'Bok.'] },
    { name: 'Omelette', body: 'chicken', x: 1150, y: 760, wander: 130, palette: { robe: '#f5f0e6', hair: '#dc2626' }, lines: ['Bok bok bok.'] },
    { name: 'Buttercup', body: 'cow', x: 300, y: 660, wander: 120, palette: { robe: '#f5f0e6', hair: '#3f3f46' }, lines: ['Moo.', 'Mooooo.'] },
    { name: 'Daisy', body: 'cow', x: 420, y: 700, wander: 120, palette: { robe: '#f5f0e6', hair: '#3f3f46' }, lines: ['Moo?', 'Munch munch.'] },
    { name: 'Clover', body: 'cow', x: 360, y: 760, wander: 120, palette: { robe: '#f5f0e6', hair: '#3f3f46' }, lines: ['Mooooooo.'] },
    { name: 'Bruno', body: 'ox', x: 880, y: 950, wander: 90, palette: { robe: '#7c5a3a', hair: '#5c4430' }, lines: ['Hrrmph.', '*stares*'] },
    { name: 'Magnus', body: 'ox', x: 980, y: 990, wander: 90, palette: { robe: '#7c5a3a', hair: '#5c4430' }, lines: ['*chews slowly*', 'Hrrm.'] },
  ];

  map.decos.sort((a, b) => a.y - b.y);
  return map;
}


export function buildStore() {
  const map = {
    id: 'store', name: 'Willowbrook General',
    w: 520, h: 420,
    outside: '#08080c',
    floor: '#3a2f22', floorAlt: '#3b3023',
    walled: true,
    fixedCamera: true,
    regions: [
      { kind: 'rect', x: 60, y: 100, w: 400, h: 24, color: '#57462f' }, // back shelf line
    ],
    decos: [], colliders: [], spawns: [],
    gates: [
      { x: 260, y: 395, r: 34, style: 'door', label: 'Willowbrook', target: 'town', tx: 1020, ty: 330 },
    ],
  };

  deco(map, 'counter', 260, 210);
  map.colliders.push({ x: 160, y: 186, w: 200, h: 26 });
  for (const x of [110, 210, 310, 410]) deco(map, 'shelf', x, 96);
  map.colliders.push({ x: 60, y: 60, w: 400, h: 40 });
  deco(map, 'crate', 80, 340);
  deco(map, 'barrel', 110, 355);
  deco(map, 'crate', 440, 330);
  deco(map, 'lamp', 60, 200);
  deco(map, 'lamp', 460, 200);

  map.npcs = [
    {
      name: 'Betsy', body: 'villager', x: 160, y: 300, wander: 90,
      palette: { robe: '#9f1239', hair: '#78716c' },
      lines: [
        'Do you know if the lamp oil here is fresh? Hamish SAYS it’s fresh.',
        'I only came in for thread. Look at this basket. LOOK at it.',
      ],
      chatter: ['These prices…', 'Ooh, is that new stock?'],
    },
    {
      name: 'Colm', body: 'villager', x: 380, y: 320, wander: 90,
      palette: { robe: '#334155', hair: '#1c1917' },
      lines: [
        'Rope, nails, and a sharpening stone. A man needs little else.',
        'I’ve been comparing these two crates for ten minutes. They’re identical.',
      ],
      chatter: ['Hm. Sturdy.', 'What’s the return policy?'],
    },
    {
      name: 'Hamish', body: 'villager', x: 260, y: 160, wander: 60,
      palette: { robe: '#78350f', hair: '#a8a29e' },
      lines: [
        'Welcome to the General! Rope, lamp oil, and gossip — we stock it all.',
        'Petra says I undercut her. I call it competitive spirit.',
        'You look like a monster-fighting sort. Bandages, aisle two. You’ll want several.',
        'We close at sundown sharp. Even shopkeeps fear the dark these days.',
      ],
      chatter: ['Where did I put that ledger…', 'Stock’s low again.'],
    },
  ];

  map.decos.sort((a, b) => a.y - b.y);
  return map;
}

/** The Gilded Toad — Willowbrook's tavern, open all night, every night. */
export function buildTavern() {
  const map = {
    id: 'tavern', name: 'The Gilded Toad',
    w: 720, h: 520,
    outside: '#08080c',
    floor: '#3a2c1e', floorAlt: '#3b2d1f',
    walled: true,
    fixedCamera: true,
    alwaysLit: true,
    regions: [
      { kind: 'rect', x: 80, y: 90, w: 380, h: 24, color: '#57462f' }, // back bar
    ],
    decos: [], colliders: [], spawns: [],
    gates: [
      { x: 360, y: 495, r: 34, style: 'door', label: 'Willowbrook', target: 'town', tx: 480, ty: 520 },
    ],
  };

  deco(map, 'counter', 270, 200);
  map.colliders.push({ x: 170, y: 176, w: 200, h: 26 });
  for (const x of [120, 220, 320, 420]) deco(map, 'barrel', x, 92);
  map.colliders.push({ x: 80, y: 50, w: 380, h: 42 });
  // tables (sturdy crates, honestly)
  for (const [x, y] of [[150, 340], [320, 360], [520, 300], [560, 420]]) {
    deco(map, 'crate', x, y);
  }
  deco(map, 'lamp', 80, 240);
  deco(map, 'lamp', 640, 240);
  deco(map, 'campfire', 620, 140, 0.8);

  map.npcs = [
    {
      name: 'Marta', body: 'villager', x: 270, y: 160, wander: 70, sleeps: false,
      palette: { robe: '#a16207', hair: '#7c2d12' },
      lines: [
        'Welcome to the Toad! Open all night, every night — someone has to be.',
        'The night crowd’s rowdy but they tip. The morning crowd apologizes.',
        'House rule: throw a round of moonshine after dark and you’re family.',
        'Second rule: what happens at the Toad stays at the Toad.',
      ],
      chatter: ['Another round?', 'Wipe the counter, wipe the counter…'],
    },
    {
      name: 'Dunstan', body: 'villager', x: 180, y: 340, wander: 60, sleeps: false,
      palette: { robe: '#4d7c0f', hair: '#57534e' },
      lines: [
        'I only came in for one. That was yesterday.',
        'The keep opened its doors, the farms got windmills — the world moves fast, friend.',
        'To the wizard! Wait, are you the wizard? TO YOU!',
      ],
      chatter: ['*hic*', 'One more, Marta!', 'You’re my best friend.'],
    },
    {
      name: 'Sable', body: 'villager', x: 520, y: 340, wander: 80, sleeps: false,
      palette: { robe: '#334155', hair: '#1c1917' },
      lines: [
        'I work nights at the dock. This is my breakfast. Don’t judge.',
        'A shark took my best net. The sea keeps score, wizard.',
        'Quietest corner in Willowbrook, right here. Usually.',
      ],
      chatter: ['Long shift.', 'The tide waits.', 'Mm.'],
    },
    {
      name: 'Old Merek', body: 'elder', x: 420, y: 420, wander: 40, sleeps: false,
      palette: { robe: '#57534e', hair: '#d6d3d1' },
      lines: [
        'I’ve had this same stool for forty years. It knows me.',
        'They say the tavern cat ran off with a wizard. Good for her.',
        'In MY day the moonshine flew every night. Wonderful times. Terrible mornings.',
      ],
      chatter: ['Heh.', 'That reminds me of a story…', '*taps stool fondly*'],
    },
  ];

  map.decos.sort((a, b) => a.y - b.y);
  return map;
}

