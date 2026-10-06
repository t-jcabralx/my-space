// IRON FISTS roster: 40 original fighters inspired by the classic 3D-fighter archetypes (10 fighting styles x 4 elements).
// Every fighter has: their own look, a signature SPECIAL, a cinematic SUPER, 8 command moves (f+punch, d+kick...) and 3 strings.
// Element effects: FIRE burns, ICE freezes (slows), THUNDER shocks (extra stun + meter), SHADOW drains life.

export const ELEMENTS = {
  fire:    { name: 'FIRE',    color: '#ff6a2a', glow: '#ffd23a', word: 'Inferno', fx: 'burn',   fxText: 'Burns the opponent for extra damage' },
  ice:     { name: 'ICE',     color: '#5ad8ff', glow: '#e6fbff', word: 'Frost',   fx: 'freeze', fxText: 'Freezes: slows the opponent and adds stun' },
  thunder: { name: 'THUNDER', color: '#ffe84a', glow: '#ffffff', word: 'Volt',    fx: 'shock',  fxText: 'Shocks: extra stun and super meter' },
  shadow:  { name: 'SHADOW',  color: '#b04dff', glow: '#ff4de1', word: 'Shadow',  fx: 'drain',  fxText: 'Drains life from the opponent' },
}

export const STYLES = {
  brawler:  { name: 'BRAWLER',   hp: 118, spd: 1.0,  pow: 1.12, reach: 1.0 },
  karate:   { name: 'KARATE',    hp: 108, spd: 1.0,  pow: 1.0,  reach: 1.0 },
  ninja:    { name: 'NINJA',     hp: 98,  spd: 1.18, pow: 0.92, reach: 0.95 },
  muay:     { name: 'MUAY THAI', hp: 106, spd: 1.06, pow: 1.05, reach: 1.0 },
  sumo:     { name: 'SUMO',      hp: 135, spd: 0.82, pow: 1.2,  reach: 0.92 },
  capoeira: { name: 'CAPOEIRA',  hp: 102, spd: 1.12, pow: 0.98, reach: 1.12 },
  wrestler: { name: 'WRESTLER',  hp: 122, spd: 0.92, pow: 1.14, reach: 0.95 },
  taekwon:  { name: 'TAEKWONDO', hp: 100, spd: 1.1,  pow: 1.0,  reach: 1.22 },
  mystic:   { name: 'MYSTIC',    hp: 96,  spd: 0.98, pow: 1.0,  reach: 0.95 },
  robot:    { name: 'ROBOT',     hp: 112, spd: 0.96, pow: 1.08, reach: 1.0 },
}
const BUILDS = { lean: { w: 0.92, h: 1.0 }, normal: { w: 1.0, h: 1.0 }, bulk: { w: 1.2, h: 1.03 }, giant: { w: 1.35, h: 1.15 }, fat: { w: 1.55, h: 1.0 }, tiny: { w: 0.85, h: 0.9 } }

// ---------- looks (one row per fighter, 4 per style: fire / ice / thunder / shadow) ----------
// [name, build, outfit, skin, hair, hairStyle, beard, accessories, top, pants, trim, gloves, gender, tagline]
const LOOKS = {
  brawler: [
    ['RAGNAR',    'bulk',   'jacket',  '#e8b48a', '#7a3a10', 'spiky',  'full',   ['scar'],            '#b8321e', '#2a2a3a', '#ffd23a', '#d02020', 'm', 'Street king with a heavy hand'],
    ['FROSTBITE', 'bulk',   'tank',    '#f6c9a0', '#e8e8e8', 'mohawk', 'stache', ['shades'],          '#cfe8ff', '#18304a', '#5ad8ff', '#3070c0', 'm', 'Cold-blooded bouncer'],
    ['BOLT',      'normal', 'jacket',  '#c98f65', '#ffe84a', 'spiky',  'none',   ['band'],            '#f2d020', '#1a1a22', '#ffffff', '#222222', 'm', 'Quick fists, quicker mouth'],
    ['GRIM',      'giant',  'coat',    '#8d5a3a', '#1a1a22', 'bald',   'goatee', ['skull'],           '#2a1a3a', '#10101a', '#b04dff', '#555555', 'm', 'A wall of bad news'],
  ],
  karate: [
    ['KENJI',     'normal', 'gi',      '#ffd2a8', '#1a1a22', 'spiky',  'none',   ['headband'],        '#f4f4f4', '#f4f4f4', '#ff3b1e', '#c02020', 'm', 'Disciplined and balanced'],
    ['YUKI',      'lean',   'gi',      '#f6c9a0', '#3de8ff', 'long',   'none',   ['band'],            '#e8f4ff', '#2a4a7a', '#ffffff', '#e8f4ff', 'f', 'Graceful as falling snow'],
    ['RAIDEN',    'normal', 'gi',      '#c98f65', '#e8e8e8', 'short',  'stache', ['headband'],        '#f8e48a', '#3a3a1a', '#222222', '#f8e48a', 'm', 'The old master of lightning'],
    ['KAGE',      'lean',   'gi',      '#e8b48a', '#1a1a22', 'bun',    'none',   ['mask'],            '#22182e', '#22182e', '#b04dff', '#22182e', 'm', 'Karate from the dark side'],
  ],
  ninja: [
    ['HANZO',     'lean',   'ninja',   '#e8b48a', '#1a1a22', 'short',  'none',   ['scarf', 'mask'],   '#7a1a10', '#22110e', '#ff6a2a', '#7a1a10', 'm', 'Silent. Burning. Gone.'],
    ['SETSUNA',   'lean',   'ninja',   '#f6c9a0', '#cfe8ff', 'long',   'none',   ['scarf', 'mask'],   '#1a3a5a', '#10202e', '#5ad8ff', '#1a3a5a', 'f', 'A blade of winter'],
    ['ZAP',       'lean',   'ninja',   '#a8714a', '#ffe84a', 'spiky',  'none',   ['scarf', 'band'],   '#2a2a10', '#1a1a10', '#ffe84a', '#2a2a10', 'm', 'Too fast for the eye'],
    ['ECLIPSE',   'normal', 'ninja',   '#ffd2a8', '#b04dff', 'bun',    'none',   ['mask', 'scarf'],   '#1a1030', '#0e0a1a', '#b04dff', '#1a1030', 'f', 'Appears when the sun hides'],
  ],
  muay: [
    ['SAMART',    'normal', 'shorts',  '#a8714a', '#1a1a22', 'short',  'none',   ['band', 'tape'],    '#a8714a', '#d02020', '#ffd23a', '#f4f4f4', 'm', 'Eight limbs of pain'],
    ['NAKHON',    'bulk',   'shorts',  '#c98f65', '#e8e8e8', 'short',  'stache', ['tape'],            '#c98f65', '#2a5ad0', '#ffffff', '#f4f4f4', 'm', 'Ring veteran, never kneels'],
    ['SAEN',      'lean',   'shorts',  '#8d5a3a', '#1a1a22', 'spiky',  'none',   ['band', 'tape'],    '#8d5a3a', '#e8c020', '#111111', '#f4f4f4', 'm', 'Strikes like a thunderclap'],
    ['MIDNIGHT',  'normal', 'shorts',  '#e8b48a', '#2a1a3a', 'long',   'none',   ['tape', 'band'],    '#e8b48a', '#20102a', '#b04dff', '#f4f4f4', 'f', 'Queen of the night ring'],
  ],
  sumo: [
    ['DAIGO',     'fat',    'mawashi', '#e8b48a', '#1a1a22', 'bun',    'none',   [],                  '#e8b48a', '#d02020', '#ffd23a', '#e8b48a', 'm', 'A mountain that walks'],
    ['TSURARA',   'fat',    'mawashi', '#f6c9a0', '#cfe8ff', 'bun',    'none',   [],                  '#f6c9a0', '#3a7ad0', '#ffffff', '#f6c9a0', 'f', 'Gentle as a glacier'],
    ['KAMINARI',  'giant',  'mawashi', '#c98f65', '#1a1a22', 'bun',    'none',   ['tattoo'],          '#c98f65', '#d0b020', '#111111', '#c98f65', 'm', 'Thunder in a giant frame'],
    ['ONI',       'giant',  'mawashi', '#8a5a7a', '#ff4d8d', 'mohawk', 'none',   ['horns'],           '#8a5a7a', '#201030', '#b04dff', '#8a5a7a', 'm', 'A demon in the dohyo'],
  ],
  capoeira: [
    ['MARCO',     'lean',   'shorts',  '#a8714a', '#1a1a22', 'afro',   'none',   ['sash'],            '#a8714a', '#f4f4f4', '#ffd23a', '#a8714a', 'm', 'Dances around you'],
    ['GELO',      'lean',   'shorts',  '#8d5a3a', '#cfe8ff', 'afro',   'none',   ['band'],            '#8d5a3a', '#e8f4ff', '#5ad8ff', '#8d5a3a', 'm', 'Cool rhythm, cold kicks'],
    ['RELAMPAGO', 'normal', 'shorts',  '#c98f65', '#ffe84a', 'spiky',  'none',   ['sash'],            '#c98f65', '#f8f0c0', '#111111', '#c98f65', 'm', 'A flash on two hands'],
    ['SOMBRA',    'lean',   'shorts',  '#8d5a3a', '#2a1a3a', 'long',   'none',   ['sash'],            '#8d5a3a', '#2a1a3a', '#b04dff', '#8d5a3a', 'f', 'A shadow that never stops moving'],
  ],
  wrestler: [
    ['EL TORO',   'bulk',   'tights',  '#c98f65', '#1a1a22', 'bald',   'none',   ['mask2', 'horns'],  '#c98f65', '#d02020', '#ffd23a', '#ffd23a', 'm', 'The raging bull of the ring'],
    ['BLIZZARD',  'giant',  'tights',  '#f6c9a0', '#e8e8e8', 'short',  'full',   [],                  '#f6c9a0', '#3a7ad0', '#ffffff', '#cfe8ff', 'm', 'Ice-cold champion'],
    ['THUNDER JACK', 'bulk', 'tights', '#e8b48a', '#ffe84a', 'long',   'stache', ['band'],            '#e8b48a', '#e8c020', '#111111', '#111111', 'm', 'The king of the sky-high slam'],
    ['REAPER',    'giant',  'tights',  '#a8714a', '#1a1a22', 'bald',   'none',   ['mask2'],           '#a8714a', '#14101e', '#b04dff', '#14101e', 'm', 'Your last match'],
  ],
  taekwon: [
    ['JIN',       'lean',   'gi',      '#ffd2a8', '#1a1a22', 'short',  'none',   ['belt'],            '#f4f4f4', '#f4f4f4', '#d02020', '#d02020', 'm', 'Kicks from another zip code'],
    ['SORA',      'lean',   'gi',      '#f6c9a0', '#cfe8ff', 'long',   'none',   ['belt'],            '#e8f4ff', '#e8f4ff', '#3a7ad0', '#3a7ad0', 'f', 'Graceful and razor sharp'],
    ['MINHO',     'normal', 'gi',      '#e8b48a', '#ffe84a', 'spiky',  'none',   ['belt'],            '#f8f4d8', '#f8f4d8', '#e8a000', '#e8a000', 'm', 'Spark in a white uniform'],
    ['LUNA',      'lean',   'gi',      '#ffd2a8', '#b04dff', 'long',   'none',   ['belt'],            '#1a1030', '#1a1030', '#ff4de1', '#ff4de1', 'f', 'Moonlit kick queen'],
  ],
  mystic: [
    ['AMBER',     'lean',   'robe',    '#e8b48a', '#ff6a2a', 'long',   'none',   ['orb', 'band'],     '#d85a1a', '#6a2a10', '#ffd23a', '#d85a1a', 'f', 'Flame-haired spirit caller'],
    ['CRYSTAL',   'lean',   'robe',    '#f6c9a0', '#e8f4ff', 'long',   'none',   ['orb', 'crown'],    '#7ad8ff', '#2a5a8a', '#ffffff', '#7ad8ff', 'f', 'Ice priestess'],
    ['STORM',     'normal', 'robe',    '#c98f65', '#e8e8e8', 'long',   'full',   ['orb'],             '#e8d040', '#6a5a10', '#ffffff', '#e8d040', 'm', 'Sky sage with a short temper'],
    ['NOX',       'lean',   'robe',    '#ffd2a8', '#1a1a22', 'long',   'none',   ['orb', 'hat'],      '#3a1a5a', '#1a0e2a', '#b04dff', '#3a1a5a', 'm', 'Whispers of the dark'],
  ],
  robot: [
    ['PYRO-9',    'bulk',   'robot',   '#aab4c8', '#ff6a2a', 'bald',   'none',   ['visor'],           '#c8d0e0', '#6a2a1a', '#ff6a2a', '#ff6a2a', 'x', 'Furnace in a steel body'],
    ['CRYO-7',    'normal', 'robot',   '#aab4c8', '#5ad8ff', 'bald',   'none',   ['visor', 'antenna'], '#d8f0ff', '#2a4a6a', '#5ad8ff', '#5ad8ff', 'x', 'Zero degrees, zero mercy'],
    ['VOLT-X',    'lean',   'robot',   '#aab4c8', '#ffe84a', 'bald',   'none',   ['visor'],           '#f0e080', '#4a4a1a', '#ffe84a', '#ffe84a', 'x', 'Overclocked'],
    ['GLITCH',    'giant',  'robot',   '#aab4c8', '#ff4de1', 'bald',   'none',   ['visor', 'horns'],  '#403060', '#201a30', '#ff4de1', '#ff4de1', 'x', 'A bug that fights back'],
  ],
}

// ---------- signature special + super per fighter ----------
// [mech, name, damage, cooldown, tip, extras]   mechs: rise ball beam fist volley lunge dive spin tornado quake tele flurry grab pillar fan counter boomerang rain
const KITS = {
  brawler: {
    sp: [['rise', 'Magma Uppercut', 13, 4.5, 'Rising anti-air punch'], ['pillar', 'Frozen Stomp', 12, 5, 'Slams the ground: an icicle erupts under the foe'], ['fist', 'Spark Knuckle', 12, 3.6, 'Flying electric fist', { speed: 56 }], ['lunge', 'Grim Bulldozer', 15, 5, 'Armoured shoulder charge']],
    su: [['lunge', 'Meteor Fist', 32, 0, 'Dash and smash with a shockwave'], ['quake', 'Glacier Crash', 33, 0, 'Leaps and slams: ground shockwave'], ['rain', 'Storm of Fists', 30, 0, 'Fists rain from the sky', { hits: 6 }], ['beam', 'Haymaker Wave', 31, 0, 'Shockwave of pure power', { hits: 3 }]],
  },
  karate: {
    sp: [['ball', 'Hado Fireball', 9, 3.2, 'Classic fireball'], ['fan', 'Ice Needles', 6, 4, 'Fan of three ice needles'], ['counter', 'Thunder Parry', 14, 4.5, 'Catch an attack and strike back'], ['rise', 'Dark Dragon Punch', 13, 4.5, 'Invincible rising punch']],
    su: [['beam', 'Dragon Wave', 30, 0, 'Triple energy wave', { hits: 3 }], ['fan', 'Blizzard Barrage', 29, 0, 'A wall of ice shards', { hits: 5, big: true }], ['volley', 'Thousand Bolts', 31, 0, 'Lightning volley', { hits: 6 }], ['flurry', 'Phantom Combo', 30, 0, 'Teleports behind you for a 6-hit storm', { hits: 6 }]],
  },
  ninja: {
    sp: [['tele', 'Ember Shadow Dash', 10, 4, 'Vanish and strike from behind'], ['boomerang', 'Frost Shuriken', 8, 3.8, 'Returning shuriken'], ['counter', 'Spark Substitution', 13, 4.5, 'Dodge and counter'], ['spin', 'Night Whirl', 5, 3.8, 'Spinning blade kick']],
    su: [['flurry', 'Crimson Slash Storm', 30, 0, 'Teleport and slash 7 times', { hits: 7 }], ['rain', 'Snow Kunai Rain', 28, 0, 'Kunai fall from above', { hits: 7 }], ['tele', 'Lightning Beheader', 30, 0, 'One unblockable strike', { hits: 1 }], ['volley', 'Eclipse Shurikens', 30, 0, 'Volley of shadow stars', { hits: 5 }]],
  },
  muay: {
    sp: [['lunge', 'Blazing Flying Knee', 12, 3.6, 'Leaping knee'], ['spin', 'Frost Elbow Spin', 5, 3.8, 'Spinning elbows'], ['dive', 'Thunder Dive Kick', 12, 3.8, 'Flying diagonal kick'], ['counter', 'Midnight Block Counter', 14, 4.5, 'Shin block into a counter']],
    su: [['flurry', 'Tiger Combo', 31, 0, 'Rapid elbows and knees', { hits: 8 }], ['quake', 'Avalanche Knee', 31, 0, 'Jumping knee drop with a shockwave'], ['lunge', 'Lightning Knee Barrage', 32, 0, 'Charging knee blitz'], ['tornado', 'Shadow Cyclone', 28, 0, 'Spinning storm', { hits: 5 }]],
  },
  sumo: {
    sp: [['lunge', 'Volcano Belly Slam', 15, 5, 'Armoured shove'], ['pillar', 'Glacier Stomp', 14, 5, 'Stomp that makes an ice pillar'], ['grab', 'Thunder Throw', 20, 5.5, 'Command grab: cannot be blocked'], ['ball', 'Demon Palm Shockwave', 11, 3.6, 'Heavy shockwave palm', { size: 3.4, speed: 28 }]],
    su: [['quake', 'Earthquake', 33, 0, 'Ground shockwave'], ['grab', 'Frozen Mountain Throw', 36, 0, 'Cinematic grab', { big: true }], ['pillar', 'Thunder Dohyo Eruption', 32, 0, 'Triple eruption under the foe', { hits: 3 }], ['beam', 'Oni Roar Wave', 31, 0, 'Wave of rage', { hits: 3 }]],
  },
  capoeira: {
    sp: [['spin', 'Fire Spin Kick', 5, 3.8, 'Spinning multi-hit kick'], ['dive', 'Frost Flip Kick', 11, 3.8, 'Flip kick from the air'], ['boomerang', 'Lightning Rasteira', 9, 3.6, 'Boomerang leg-sweep wave'], ['tele', 'Phantom Ginga', 10, 4, 'Slides behind you']],
    su: [['tornado', 'Whirlwind', 28, 0, 'Travelling tornado', { hits: 5 }], ['flurry', 'Ice Dance', 29, 0, 'Dancing kick combo', { hits: 6 }], ['rain', 'Skyfall Kicks', 29, 0, 'Kicks from above', { hits: 6 }], ['flurry', 'Midnight Ginga', 30, 0, 'Teleport and breakdance combo', { hits: 7 }]],
  },
  wrestler: {
    sp: [['grab', 'Raging Bull Suplex', 20, 5.5, 'Command grab: cannot be blocked'], ['lunge', 'Blizzard Clothesline', 14, 5, 'Armoured clothesline'], ['rise', 'Thunder Chokeslam Rise', 13, 4.5, 'Rising slam'], ['counter', 'Reaper Reversal', 15, 4.5, 'Counter any strike']],
    su: [['grab', 'Giga Piledriver', 38, 0, 'Cinematic grab', { big: true }], ['quake', 'Avalanche Splash', 33, 0, 'Jump and splash with a shockwave'], ['lunge', 'Lightning Spear', 32, 0, 'A charging spear'], ['flurry', 'Death Sentence', 30, 0, 'Brutal combo', { hits: 6 }]],
  },
  taekwon: {
    sp: [['dive', 'Flare Rocket Kick', 12, 3.8, 'Diagonal flying kick'], ['rise', 'Frost Axe Kick Rise', 12, 4.2, 'Rising kick'], ['spin', 'Thunder Tornado Kick', 5, 3.8, 'Spinning kicks'], ['fan', 'Moon Crescents', 7, 4, 'Fan of crescent waves']],
    su: [['flurry', 'Blitz Kicks', 29, 0, 'Rapid kick storm', { hits: 6 }], ['rain', 'Ice Meteor Kicks', 29, 0, 'Kicks rain from above', { hits: 6 }], ['volley', 'Spark Kick Volley', 30, 0, 'Volley of energy kicks', { hits: 5 }], ['tornado', 'Lunar Cyclone', 28, 0, 'Tornado of kicks', { hits: 5 }]],
  },
  mystic: {
    sp: [['beam', 'Ember Spirit Beam', 11, 3.4, 'Fast energy beam'], ['pillar', 'Frost Pillar', 12, 4.5, 'Ice pillar under the foe'], ['fan', 'Storm Spirits', 7, 4, 'Three spirit bolts'], ['boomerang', 'Void Orb', 10, 4, 'Orb that returns']],
    su: [['beam', 'Mega Beam', 34, 0, 'Screen-wide beam', { hits: 6, big: true }], ['rain', 'Crystal Rain', 30, 0, 'Crystals fall from the sky', { hits: 7 }], ['tornado', 'Thunder Typhoon', 29, 0, 'Typhoon of lightning', { hits: 6 }], ['pillar', 'Abyss Eruption', 33, 0, 'Pillars of darkness', { hits: 3 }]],
  },
  robot: {
    sp: [['fist', 'Rocket Punch', 12, 3.6, 'Flying fist'], ['volley', 'Cryo Missiles', 10, 4.5, 'Quick missile burst', { hits: 3 }], ['beam', 'Arc Cannon', 12, 3.4, 'Fast plasma beam'], ['lunge', 'Glitch Charge', 15, 4.8, 'Armoured shoulder charge']],
    su: [['volley', 'Laser Barrage', 32, 0, 'Fires a volley of lasers', { hits: 5 }], ['beam', 'Absolute Zero Cannon', 34, 0, 'Screen-wide freeze beam', { hits: 6, big: true }], ['quake', 'Overload', 33, 0, 'Jump and slam: shockwave'], ['rain', 'Data Storm', 30, 0, 'Corrupted code rains down', { hits: 7 }]],
  },
}

// ---------- command moves: 8 slots + 3 strings, flavoured per style ----------
const SLOT_ORDER = ['f+lp', 'f+hp', 'f+lk', 'f+hk', 'b+hk', 'd+hp', 'd+hk', 'df+hp']
const CHAIN_ORDER = ['lp>lp', 'lp>hp', 'lk>hk']
const BASE = {
  'f+lp':  { limb: 'rh', lvl: 'mid',  su: 0.10, ac: 0.06, rc: 0.17, dmg: 6,  hs: 0.30, bs: 0.14, kb: 4,  reach: 8.2,  y: 9.3, hh: 2.6 },
  'f+hp':  { limb: 'lh', lvl: 'mid',  su: 0.17, ac: 0.07, rc: 0.26, dmg: 11, hs: 0.46, bs: 0.22, kb: 9,  reach: 8.8,  y: 9.2, hh: 3.0, knock: true },
  'f+lk':  { limb: 'rf', lvl: 'mid',  su: 0.12, ac: 0.07, rc: 0.20, dmg: 7,  hs: 0.32, bs: 0.15, kb: 5,  reach: 10.0, y: 5.2, hh: 2.6 },
  'f+hk':  { limb: 'lf', lvl: 'high', su: 0.20, ac: 0.08, rc: 0.32, dmg: 12, hs: 0.50, bs: 0.24, kb: 11, reach: 11.5, y: 9.0, hh: 3.4, knock: true },
  'b+hk':  { limb: 'lf', lvl: 'mid',  su: 0.16, ac: 0.07, rc: 0.28, dmg: 9,  hs: 0.40, bs: 0.20, kb: 6,  reach: 9.5,  y: 7.6, hh: 3.0, inv: 0.12 },
  'd+hp':  { limb: 'lh', lvl: 'mid',  su: 0.15, ac: 0.08, rc: 0.30, dmg: 10, hs: 0.55, bs: 0.22, kb: 3,  reach: 6.4,  y: 9.5, hh: 4.4, launch: true },
  'd+hk':  { limb: 'lf', lvl: 'low',  su: 0.20, ac: 0.08, rc: 0.36, dmg: 9,  hs: 0.50, bs: 0.20, kb: 7,  reach: 10.8, y: 1.2, hh: 1.8, knock: true },
  'df+hp': { limb: 'rh', lvl: 'mid',  su: 0.22, ac: 0.08, rc: 0.34, dmg: 12, hs: 0.50, bs: 0.0,  kb: 5,  reach: 8.4,  y: 9.0, hh: 3.0, gb: true },
  'lp>lp': { limb: 'lh', lvl: 'high', su: 0.07, ac: 0.06, rc: 0.15, dmg: 4,  hs: 0.26, bs: 0.12, kb: 3,  reach: 7.8,  y: 9.4, hh: 2.6 },
  'lp>hp': { limb: 'lh', lvl: 'mid',  su: 0.10, ac: 0.07, rc: 0.22, dmg: 8,  hs: 0.38, bs: 0.18, kb: 7,  reach: 8.8,  y: 9.2, hh: 2.8 },
  'lk>hk': { limb: 'lf', lvl: 'high', su: 0.12, ac: 0.08, rc: 0.28, dmg: 10, hs: 0.45, bs: 0.20, kb: 9,  reach: 11,   y: 8.8, hh: 3.2, knock: true },
}
const NOUNS = {
  brawler:  ['Body Jab', 'Haymaker', 'Gut Kick', 'Boot Stomp', 'Back Heel', 'Gut Uppercut', 'Leg Hook', 'Skull Cracker', 'Double Jab', 'One-Two Punch', 'Kick Combo'],
  karate:   ['Spear Hand', 'Palm Strike', 'Front Snap', 'Crescent Kick', 'Back Kick', 'Rising Knuckle', 'Foot Sweep', 'Guard Breaker', 'Double Strike', 'Punch Combo', 'Kick Chain'],
  ninja:    ['Blade Hand', 'Shadow Strike', 'Tiger Claw', 'Flip Kick', 'Backflip Kick', 'Skyward Slash', 'Ankle Slicer', 'Hidden Blade', 'Twin Slash', 'Cross Slash', 'Spinning Edge'],
  muay:     ['Short Elbow', 'Elbow Smash', 'Teep Kick', 'Switch Kick', 'Back Teep', 'Uppercut Elbow', 'Low Kick', 'Knee Crusher', 'Elbow Flurry', 'Punch Knee', 'Kick Check'],
  sumo:     ['Push Strike', 'Thrust', 'Stomp', 'Sweeping Slap', 'Back Shove', 'Rising Slap', 'Leg Sweep', 'Tsuppari', 'Double Slap', 'Slap Slam', 'Stomp Shove'],
  capoeira: ['Cartwheel Hand', 'Handstand Punch', 'Ginga Kick', 'Meia Lua', 'Queixada', 'Rising Armada', 'Rasteira', 'Macaco Kick', 'Esquiva Strike', 'Spin Strike', 'Kick Dance'],
  wrestler: ['Open Hand Chop', 'Lariat', 'Knee Lift', 'Big Boot', 'Back Elbow', 'Uppercut Chop', 'Drop Kick Low', 'Bear Hug Break', 'Double Chop', 'Chop Slam', 'Boot Combo'],
  taekwon:  ['Reverse Punch', 'Spear Palm', 'Quick Kick', 'Axe Kick', 'Back Spin Kick', 'Rising Kick', 'Low Sweep', 'Jump Heel', 'Double Kick', 'Punch Kick', 'Triple Kick'],
  mystic:   ['Spirit Palm', 'Orb Strike', 'Staff Poke', 'Wind Kick', 'Mist Step Kick', 'Spirit Lift', 'Root Sweep', 'Mind Breaker', 'Twin Palm', 'Palm Orb', 'Wind Chain'],
  robot:    ['Piston Jab', 'Servo Punch', 'Hydraulic Kick', 'Steel Boot', 'Rear Thruster', 'Rocket Upper', 'Ground Saw', 'Overload Punch', 'Twin Pistons', 'Punch Burst', 'Kick Protocol'],
}
const ADJ = {
  fire:    ['Blazing', 'Scorching', 'Molten', 'Searing', 'Ember', 'Flare', 'Cinder', 'Magma', 'Burning', 'Fiery', 'Blaze'],
  ice:     ['Frozen', 'Glacial', 'Chilling', 'Polar', 'Icicle', 'Frost', 'Arctic', 'Crystal', 'Snow', 'Winter', 'Sleet'],
  thunder: ['Shock', 'Voltaic', 'Crackling', 'Static', 'Thunder', 'Arc', 'Spark', 'Bolt', 'Surge', 'Storm', 'Lightning'],
  shadow:  ['Shadow', 'Dusk', 'Phantom', 'Void', 'Night', 'Umbral', 'Gloom', 'Eclipse', 'Ghost', 'Wraith', 'Dark'],
}
// style flavours: patches applied on top of BASE for specific slots (this is what makes a ninja play unlike a sumo)
const FLAVOR = {
  brawler:  { 'f+hp': { dmg: 14, su: 0.2, launch: true }, 'f+hk': { dmg: 13, kb: 12 }, 'df+hp': { dmg: 13 } },
  karate:   { 'f+hp': { gb: true, bs: 0, dmg: 9 }, 'b+hk': { inv: 0.15, dmg: 10 }, 'd+hp': { dmg: 11 } },
  ninja:    { 'f+lp': { su: 0.08, dmg: 5 }, 'b+hk': { inv: 0.25, vy: 20, vx: -14, dmg: 10, su: 0.14 }, 'f+lk': { step: 20, su: 0.1 }, 'df+hp': { su: 0.18, step: 26, dmg: 11 } },
  muay:     { 'f+hp': { hits: 2, dmg: 12, su: 0.14, pose: 'elbow' }, 'f+lk': { pose: 'knee', y: 7, reach: 7.6, dmg: 9 }, 'd+hp': { pose: 'knee', launch: true } },
  sumo:     { 'f+hp': { armor: true, dmg: 14, kb: 14, su: 0.22, reach: 7.8 }, 'f+hk': { dmg: 13 }, 'd+hk': { dmg: 11 }, 'df+hp': { armor: true, gb: true, dmg: 13 } },
  capoeira: { 'f+lk': { step: 24, su: 0.14, dmg: 8 }, 'f+hk': { reach: 12.5, dmg: 12, su: 0.22 }, 'b+hk': { inv: 0.2, dmg: 10 }, 'd+hk': { dmg: 10, reach: 11.5, su: 0.16 } },
  wrestler: { 'f+hp': { grab: true, dmg: 17, su: 0.14, reach: 7.2 }, 'df+hp': { grab: true, dmg: 19, su: 0.18, reach: 7 }, 'f+lp': { dmg: 7, reach: 7.4 }, 'd+hk': { dmg: 10 } },
  taekwon:  { 'f+hk': { reach: 13.5, dmg: 13, track: true }, 'f+lk': { reach: 11.5, su: 0.1, dmg: 8 }, 'b+hk': { reach: 11, inv: 0.18, dmg: 11 }, 'd+hp': { pose: 'axe', launch: true, y: 11 } },
  mystic:   { 'f+lp': { proj: true, dmg: 5, pdmg: 5 }, 'd+hp': { proj: true, pdmg: 8, pose: 'cast', launch: true }, 'df+hp': { proj: true, pdmg: 9, gb: true } },
  robot:    { 'f+hp': { dmg: 13, kb: 12 }, 'd+hp': { proj: true, pdmg: 9, launch: true, pose: 'cast' }, 'f+lk': { step: 14, dmg: 8 } },
}
const VAR = [ // per-element tuning, so the four fighters of a style do not play identically
  { dmg: 1.06, su: 1.0, reach: 1.0, hs: 1.0 },
  { dmg: 1.0, su: 1.0, reach: 1.08, hs: 1.08 },
  { dmg: 0.96, su: 0.9, reach: 1.0, hs: 1.0 },
  { dmg: 1.03, su: 1.0, reach: 1.0, hs: 1.12 },
]
function tags(m) {
  const t = []
  if (m.grab) t.push('GRAB')
  t.push(m.lvl === 'low' ? 'LOW' : m.lvl === 'high' ? 'HIGH' : 'MID')
  if (m.launch) t.push('LAUNCH'); else if (m.knock) t.push('KNOCKDOWN')
  if (m.gb) t.push('GUARD BREAK')
  if (m.hits > 1) t.push(m.hits + '-HIT')
  if (m.track) t.push('TRACKING')
  if (m.inv) t.push('EVASIVE')
  if (m.armor) t.push('ARMOUR')
  if (m.proj) t.push('PROJECTILE')
  if (m.step) t.push('STEP-IN')
  return t
}
function makeMoves(style, ei) {
  const out = { cmd: {}, chain: {}, list: [] }
  const fl = FLAVOR[style] || {}, v = VAR[ei], nouns = NOUNS[style], adj = ADJ[Object.keys(ELEMENTS)[ei]]
  const all = [...SLOT_ORDER, ...CHAIN_ORDER]
  all.forEach((slot, i) => {
    const m = { ...BASE[slot], ...(fl[slot] || {}) }
    m.dmg = +(m.dmg * v.dmg).toFixed(1); m.su = +(m.su * v.su).toFixed(3); m.reach = +(m.reach * v.reach).toFixed(1); m.hs = +(m.hs * v.hs).toFixed(2)
    m.name = `${adj[i]} ${nouns[i]}`
    m.slot = slot
    m.sfx = m.lvl === 'low' || m.limb === 'rf' || m.limb === 'lf' ? 'fKick' : m.dmg >= 11 ? 'fHeavy' : 'fPunch'
    m.fx = true
    if (i < SLOT_ORDER.length) out.cmd[slot] = m; else out.chain[slot] = m
    out.list.push({ input: slot.replace('>', ' › ').toUpperCase().replace(/LP/g, 'P1').replace(/HP/g, 'P2').replace(/LK/g, 'K1').replace(/HK/g, 'K2'), name: m.name, tags: tags(m), dmg: m.dmg })
  })
  return out
}

export const ROSTER = []
const styleKeys = Object.keys(STYLES), elKeys = Object.keys(ELEMENTS)
styleKeys.forEach((sk) => {
  const S = STYLES[sk]
  elKeys.forEach((ek, ei) => {
    const L = LOOKS[sk][ei]
    const [name, build, outfit, skin, hair, hairStyle, beard, accs, top, pants, trim, gloves, gender, tag] = L
    const E = ELEMENTS[ek], B = BUILDS[build]
    const id = ROSTER.length
    const hp = Math.round(S.hp * (build === 'giant' ? 1.08 : build === 'lean' ? 0.96 : 1) * (ei === 1 ? 1.04 : ei === 2 ? 0.96 : ei === 3 ? 0.98 : 1))
    const spd = +(S.spd * (ei === 2 ? 1.06 : ei === 3 ? 1.02 : 1) * (build === 'lean' ? 1.03 : build === 'giant' ? 0.94 : 1)).toFixed(2)
    const pow = +(S.pow * (ei === 0 ? 1.06 : ei === 3 ? 1.03 : 1) * (build === 'giant' ? 1.05 : build === 'lean' ? 0.97 : 1)).toFixed(2)
    const reach = +(S.reach * (build === 'giant' ? 1.05 : 1)).toFixed(2)
    const mv = makeMoves(sk, ei)
    const mk = (a, isSuper) => {
      const [mech, nm, dmg, cd, tip, extra = {}] = a
      return { mech, name: nm, dmg: Math.round(dmg * pow), cd, tip, hits: extra.hits || 1, big: !!extra.big, speed: extra.speed, size: extra.size }
    }
    ROSTER.push({
      id, key: `${sk}_${ek}`, style: sk, element: ek, name, styleName: S.name, tag, gender, build, outfit, beard, accs,
      hp, spd, pow, reach, w: B.w, h: B.h,
      skin, hair, hairStyle, top, pants, trim, gloves,
      acc: accs[0] || '',
      special: mk(KITS[sk].sp[ei], false), super: mk(KITS[sk].su[ei], true),
      cmd: mv.cmd, chain: mv.chain, movelist: mv.list,
    })
  })
})
export const rosterById = (i) => ROSTER[((i % ROSTER.length) + ROSTER.length) % ROSTER.length]
export const NORMAL_LIST = [
  { input: 'P1', name: 'Jab' }, { input: 'P2', name: 'Straight' }, { input: 'K1', name: 'Front Kick' }, { input: 'K2', name: 'Roundhouse' },
]
