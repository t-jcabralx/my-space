export const ENEMIES = {
  drone:   { spr: 'drone',   hp: 1,  score: 100,  coins: 1 },
  zig:     { spr: 'zig',     hp: 2,  score: 150,  coins: 1 },
  kami:    { spr: 'kami',    hp: 2,  score: 200,  coins: 1 },
  shooter: { spr: 'shooter', hp: 3,  score: 250,  coins: 2 },
  weaver:  { spr: 'weaver',  hp: 3,  score: 250,  coins: 2 },
  tank:    { spr: 'tank',    hp: 9,  score: 600,  coins: 4 },
  rockL:   { spr: 'rockL',   hp: 5,  score: 150,  coins: 1 },
  rockS:   { spr: 'rockS',   hp: 2,  score: 50,   coins: 0 },
  mine:    { spr: 'mine',    hp: 2,  score: 150,  coins: 1 },
  ufo:     { spr: 'ufo',     hp: 6,  score: 1500, coins: 9, bonus: true },
  carrier: { spr: 'carrier', hp: 16, score: 1000, coins: 6 },
}

export const BOSSES = [
  { name: 'WARDEN',       hp: 130, score: 5000 },
  { name: 'HIVE MOTHER',  hp: 180, score: 7000 },
  { name: 'SENTINEL',     hp: 230, score: 9000 },
  { name: 'PHANTOM',      hp: 270, score: 11000 },
  { name: 'DREADNOUGHT',  hp: 340, score: 14000 },
  { name: 'TWIN GUARD',    hp: 380, score: 16000 },
  { name: 'STORM WEAVER',  hp: 430, score: 18000 },
  { name: 'BEHEMOTH',      hp: 480, score: 20000 },
  { name: 'VOID REAPER',   hp: 540, score: 24000 },
  { name: 'OMEGA CORE',    hp: 720, score: 40000 },
]

// pool = weighted enemy mix, interval = [start,end] seconds between spawn groups, length = seconds before the boss warning
export const MISSIONS = [
  {
    name: 'OUTER RIM', sub: 'Hostile drones swarm the border', color: '#3de8ff', planet: '#2b5fbf', bpm: 120, trans: 0,
    length: 46, interval: [3.4, 2.3], pool: { drone: 5, zig: 3, shooter: 1 },
    specials: [{ t: 20, e: 'ufo' }],
    challenge: { type: 'kills', target: 25, desc: 'Destroy 25 enemies', reward: { credits: 300, score: 2500 } },
  },
  {
    name: 'ASTEROID BELT', sub: 'Dodge the rocks, avoid the mines', color: '#ffb36b', planet: '#a8643a', bpm: 126, trans: 2,
    length: 50, interval: [3.2, 2.1], pool: { rock: 5, drone: 2, kami: 2, mine: 2, zig: 1 },
    specials: [{ t: 18, e: 'ufo' }],
    challenge: { type: 'pups', target: 3, desc: 'Collect 3 power-ups', reward: { credits: 350, score: 3000 } },
  },
  {
    name: 'NEBULA MAZE', sub: 'Weavers and gunships hide in the gas', color: '#c58bff', planet: '#6a35b8', bpm: 130, trans: -2,
    length: 54, interval: [3.0, 2.0], pool: { weaver: 4, shooter: 3, tank: 1, zig: 2, kami: 1 },
    specials: [{ t: 22, e: 'ufo' }, { t: 40, e: 'carrier' }],
    challenge: { type: 'combo', target: 12, desc: 'Reach a 12 kill combo', reward: { credits: 400, score: 4000 } },
  },
  {
    name: 'CRIMSON VOID', sub: 'Kamikaze fleets in the red dark', color: '#ff6b7a', planet: '#a8243a', bpm: 134, trans: 3,
    length: 56, interval: [2.8, 1.8], pool: { kami: 5, weaver: 2, zig: 3, shooter: 2, mine: 2 },
    specials: [{ t: 15, e: 'ufo' }, { t: 38, e: 'ufo' }],
    challenge: { type: 'nodmg', target: 0, desc: 'Take NO damage', reward: { credits: 600, score: 6000 } },
  },
  {
    name: 'MACHINE CORE', sub: 'Heavy armour guards the foundry', color: '#7dffb0', planet: '#2a8a5a', bpm: 138, trans: 5,
    length: 60, interval: [2.7, 1.7], pool: { tank: 3, carrier: 2, shooter: 3, mine: 3, kami: 2, weaver: 2 },
    specials: [{ t: 20, e: 'ufo' }, { t: 42, e: 'ufo' }],
    challenge: { type: 'score', target: 20000, desc: 'Score 20,000 this mission', reward: { credits: 700, score: 7000 } },
  },
  {
    name: 'ICE FIELDS', sub: 'Frozen wrecks hide ambushers', color: '#9be8ff', planet: '#4a7aa8', bpm: 140, trans: -3,
    length: 60, interval: [2.6, 1.7], pool: { weaver: 3, kami: 3, rock: 3, shooter: 3, zig: 2, mine: 1 },
    specials: [{ t: 18, e: 'ufo' }, { t: 40, e: 'ufo' }],
    challenge: { type: 'kills', target: 45, desc: 'Destroy 45 enemies', reward: { credits: 800, score: 9000 } },
  },
  {
    name: 'SOLAR FLARE', sub: 'Burning skies, relentless swarms', color: '#ffd24a', planet: '#c8862a', bpm: 144, trans: 1,
    length: 62, interval: [2.5, 1.6], pool: { kami: 4, mine: 3, tank: 2, drone: 2, shooter: 3, weaver: 2 },
    specials: [{ t: 16, e: 'ufo' }, { t: 36, e: 'carrier' }, { t: 50, e: 'ufo' }],
    challenge: { type: 'combo', target: 20, desc: 'Reach a 20 kill combo', reward: { credits: 900, score: 10000 } },
  },
  {
    name: 'GRAVEYARD', sub: 'The fleet that never came home', color: '#b0b8d0', planet: '#4a5068', bpm: 148, trans: -5,
    length: 64, interval: [2.4, 1.5], pool: { tank: 3, carrier: 2, rock: 3, mine: 3, weaver: 2, shooter: 2 },
    specials: [{ t: 14, e: 'ufo' }, { t: 34, e: 'ufo' }, { t: 52, e: 'carrier' }],
    challenge: { type: 'ufo', target: 2, desc: 'Shoot down 2 bonus UFOs', reward: { credits: 1000, score: 11000 } },
  },
  {
    name: 'WARP GATE', sub: 'Everything at once. Hold the line.', color: '#7a8bff', planet: '#3a3aa8', bpm: 152, trans: 4,
    length: 66, interval: [2.2, 1.4], pool: { drone: 2, zig: 2, kami: 3, weaver: 3, shooter: 3, tank: 2, carrier: 1, mine: 2 },
    specials: [{ t: 16, e: 'ufo' }, { t: 38, e: 'ufo' }, { t: 56, e: 'carrier' }],
    challenge: { type: 'nodmg', target: 0, desc: 'Take NO damage', reward: { credits: 1200, score: 14000 } },
  },
  {
    name: 'FINAL ROUND', sub: 'Omega Core awaits. End this.', color: '#ff4de1', planet: '#7a1a5a', bpm: 144, trans: 0,
    length: 64, interval: [2.3, 1.3], pool: { drone: 2, zig: 2, kami: 3, weaver: 3, shooter: 3, tank: 2, carrier: 1, mine: 2, rock: 2 },
    specials: [{ t: 18, e: 'ufo' }, { t: 36, e: 'carrier' }, { t: 50, e: 'ufo' }],
    challenge: { type: 'nolife', target: 0, desc: 'Lose no ships', reward: { credits: 1000, score: 15000 } },
  },
]

export const BONUS_AFTER = [1, 3, 5, 7, 8] // a bonus round is played after these (0-based) missions
export const UPGRADES = [
  { key: 'laser',  name: 'LASER  [Q]',  desc: 'Longer, wider, harder-hitting beam; faster recharge', max: 4, cost: (n) => 450 + n * 400, skill: true },
  { key: 'bomb',   name: 'BOMB  [B]',   desc: 'Bigger blast, more damage; faster recharge',         max: 4, cost: (n) => 450 + n * 400, skill: true },
  { key: 'shield', name: 'SHIELD  [E]', desc: 'Longer bubble, ram damage, bullet reflect',          max: 4, cost: (n) => 450 + n * 400, skill: true },
  { key: 'fire',   name: 'FIREPOWER',   desc: 'Start missions with a stronger weapon',              max: 3, cost: (n) => 400 + n * 350 },
  { key: 'rate',   name: 'RAPID CORE',  desc: 'Faster rate of fire',                                max: 5, cost: (n) => 300 + n * 250 },
  { key: 'armor',  name: 'HULL PLATING', desc: '+1 maximum hit point',                              max: 4, cost: (n) => 500 + n * 400 },
  { key: 'magnet', name: 'MAGNET',      desc: 'Wider pickup range',                                 max: 3, cost: (n) => 250 + n * 200 },
  { key: 'drone',  name: 'DRONE BAY',   desc: 'Start missions with wingman drones',                 max: 2, cost: (n) => 500 + n * 500 },
  { key: 'life',   name: 'EXTRA SHIP',  desc: '+1 life (max 6)',                                    max: 99, cost: () => 900 },
]
