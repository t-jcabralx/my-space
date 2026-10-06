// NEON DEFENSE campaign: "The Wardens of the Valley". Five maps, five stories.
const L = (who, text) => [who, text]
export const TDWHO = { mira: ['CAPTAIN MIRA', '#3de8ff', '🛡️'], nova: ['NOVA', '#ff4de1', '🤖'], ovl: ['OVERLORD', '#ff3a3a', '👁'], sys: ['THE VALLEY', '#6aff9a', '🏞️'], titan: ['STATIC TITAN', '#ff8a2a', '🗿'], hero: ['YOU', '#ffe84a', '🧑‍✈️'] }
export const TDCAMP = [
  {
    name: 'GREENWAY', sub: 'Chapter 1 · The Horde Wakes', cols: 24, rows: 13, color: '#27e0a0', goal: 8, gold: 260, lives: 20,
    path: [[0, 6], [5, 6], [5, 2], [11, 2], [11, 10], [17, 10], [17, 4], [23, 4]],
    intro: [L('sys', 'THE VALLEY OF LANTERNS. FOR A HUNDRED YEARS THE VILLAGES SLEPT SAFELY BEHIND THE OLD DEFENCE GRID.'), L('mira', 'Commander! The grid has failed. The Static Horde is marching down the Greenway, straight for the village gate.'), L('nova', 'I rebooted what I could. You have pulse towers and some gold, and the horde is slow at first. Build early, build wide.'), L('hero', 'Show me where they will come from.'), L('mira', 'There, the glowing road on the left. Everything that walks it has to pass your towers.')],
    beats: { 3: [L('mira', 'More of them! They are getting braver.')], 6: [L('nova', 'The Horde leader is not here yet. These are only scouts.')] },
    outro: [L('mira', 'They are running! The Greenway is ours, Commander!'), L('nova', 'The Horde has more than scouts, though. The next valley is the River Ford. They will cross it at dawn.')],
  },
  {
    name: 'RIVER FORD', sub: 'Chapter 2 · Hold the Ford', cols: 26, rows: 14, color: '#4aa8ff', goal: 10, gold: 300, lives: 20,
    path: [[0, 2], [7, 2], [7, 11], [13, 11], [13, 3], [19, 3], [19, 10], [25, 10]],
    intro: [L('sys', 'THE RIVER FORD. THE HORDE CAN FLY HERE, AND THE WATER CARRIES THEIR STATIC ACROSS THE FIELDS.'), L('mira', 'Bats! They glide over the river and ignore the road. Cannons cannot touch them.'), L('nova', 'Build pulse, frost and sniper towers. They hit the air. Frost slows whatever it touches, and slow things die.'), L('hero', 'Anything else?'), L('nova', 'A bank. The bank pays you at the end of every wave. A patient commander is a rich one.')],
    beats: { 3: [L('mira', 'The flyers! Watch the sky!')], 7: [L('nova', 'Their formation is changing. The Horde is learning from us.')] },
    outro: [L('mira', 'The ford is red with static. We held!'), L('nova', 'Commander, the next map is the Stone Spiral. The old keep. It is built to be defended, and the Horde knows it.')],
  },
  {
    name: 'STONE SPIRAL', sub: 'Chapter 3 · The Spiral Keep', cols: 28, rows: 15, color: '#ff6ad0', goal: 12, gold: 340, lives: 20,
    path: [[0, 13], [24, 13], [24, 1], [3, 1], [3, 10], [20, 10], [20, 5], [8, 5], [8, 7], [27, 7]],
    intro: [L('sys', 'THE SPIRAL KEEP. A ROAD THAT TURNS ON ITSELF SO THAT EVERY TOWER SEES EVERY ENEMY, TWICE.'), L('mira', 'This keep was built by the first Wardens. The road coils so tightly that a tower in the middle covers three loops.'), L('nova', 'A tesla coil in the centre will chain lightning along the whole spiral. And watch the fifth wave, Commander. Something big is coming.'), L('titan', 'THE HORDE REMEMBERS THE KEEP. THE HORDE WILL PULL IT DOWN.')],
    beats: { 5: [L('mira', 'A giant! A Static Titan scout!')], 9: [L('nova', 'Airstrike is ready. Call it when the crowd is thickest.')] },
    outro: [L('mira', 'The Keep still stands, and so do we.'), L('nova', 'There is a bridge ahead, the Ember Bridge. The OVERLORD burned it to cut us off. The Horde pours across it now.')],
  },
  {
    name: 'EMBER BRIDGE', sub: 'Chapter 4 · Burn the Bridge', cols: 30, rows: 16, color: '#ff8a2a', goal: 15, gold: 380, lives: 18,
    path: [[0, 3], [9, 3], [9, 12], [18, 12], [18, 3], [26, 3], [26, 13], [29, 13]],
    intro: [L('sys', 'THE EMBER BRIDGE. FIRE RUNS BENEATH THE PLANKS AND THE AIR SHIMMERS WITH HEAT.'), L('mira', 'The Horde is thicker here. Hundreds of them, swarming.'), L('nova', 'Cannons, Commander. Cannons are made for swarms. Put them where the road bends and let the splash do the work.'), L('ovl', 'YOU ARE DEFENDING A VILLAGE THAT DOES NOT EXIST. THE VALLEY IS A SAVE FILE AND I HAVE ALREADY DELETED IT.'), L('hero', 'Then I will write it again.')],
    beats: { 5: [L('mira', 'A wave of bosses! Hold the line!')], 10: [L('nova', 'The OVERLORD is throwing everything. Upgrade your best towers, not your newest.')] },
    outro: [L('mira', 'The bridge is behind us, and the fire is out.'), L('nova', 'One road left. The Last Gate. If it falls, the Valley falls, and the Grid with it.')],
  },
  {
    name: 'THE LAST GATE', sub: 'Chapter 5 · The Last Gate', cols: 30, rows: 16, color: '#ffe84a', goal: 20, gold: 420, lives: 15,
    path: [[0, 8], [6, 8], [6, 2], [12, 2], [12, 13], [18, 13], [18, 5], [24, 5], [24, 11], [29, 11]],
    intro: [L('sys', 'THE LAST GATE. BEYOND IT: THE VILLAGE, THE LANTERN, EVERYTHING THAT IS LEFT.'), L('mira', 'This is it, Commander. Every Warden who ever lived stood where you are standing.'), L('nova', 'You have learned everything you need: pulse for speed, frost for control, cannons for crowds, snipers for giants, tesla for chains, a bank to keep the lights on.'), L('ovl', 'TWENTY WAVES. THEN THE TITAN. THEN NOTHING.'), L('hero', 'Twenty waves. Then the dawn.')],
    beats: { 10: [L('mira', 'Halfway! The Titan is stirring!')], 15: [L('nova', 'The Horde is throwing its elite. Frost the bosses, snipe the flyers.')], 19: [L('titan', 'I AM THE LAST OF THE STATIC. I AM THE SILENCE AFTER THE SIGNAL.'), L('hero', 'Then I am the signal.')] },
    outro: [L('mira', 'The gate holds! The Horde is breaking!'), L('nova', 'The OVERLORD is losing its grip on the Valley. Commander, you did not just defend a village. You saved a save file.'), L('sys', 'THE VALLEY OF LANTERNS WAKES UP. A HUNDRED LIGHTS COME ON, ONE BY ONE, ALL ALONG THE ROAD.')],
  },
]
