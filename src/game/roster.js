// IRON FISTS roster: 40 fighters = 10 fighting styles x 4 elements. Every fighter has a signature SPECIAL and a SUPER
// (cinematic, costs a full meter). The style decides the move mechanics, the element decides names, colours and VFX.

export const ELEMENTS = {
  fire:    { name: 'FIRE',    color: '#ff6a2a', glow: '#ffd23a', word: 'Inferno' },
  ice:     { name: 'ICE',     color: '#5ad8ff', glow: '#e6fbff', word: 'Frost' },
  thunder: { name: 'THUNDER', color: '#ffe84a', glow: '#ffffff', word: 'Volt' },
  shadow:  { name: 'SHADOW',  color: '#b04dff', glow: '#ff4de1', word: 'Shadow' },
}

// mech = how the move works in the engine (see fight.js)
export const STYLES = {
  brawler:  { name: 'BRAWLER',   hp: 118, spd: 1.0,  pow: 1.12, reach: 1.0,  w: 1.05, h: 1.0,  special: { base: 'Uppercut',     mech: 'rise',  dmg: 13, cd: 4.5, tip: 'Rising anti-air punch' },        super: { base: 'Meteor Fist',    mech: 'lunge', dmg: 32, hits: 1, tip: 'Dash and smash with a shockwave' } },
  karate:   { name: 'KARATE',    hp: 108, spd: 1.0,  pow: 1.0,  reach: 1.0,  w: 1.0,  h: 1.0,  special: { base: 'Fireball',     mech: 'ball',  dmg: 9,  cd: 3.2, tip: 'Slow projectile' },             super: { base: 'Dragon Wave',    mech: 'beam',  dmg: 30, hits: 3, tip: 'Huge energy wave' } },
  ninja:    { name: 'NINJA',     hp: 98,  spd: 1.18, pow: 0.92, reach: 0.95, w: 0.9,  h: 1.0,  special: { base: 'Shadow Dash',  mech: 'tele',  dmg: 10, cd: 4.0, tip: 'Vanish and strike from behind' }, super: { base: 'Phantom Slash',  mech: 'flurry', dmg: 30, hits: 7, tip: 'Teleport and slash 7 times' } },
  muay:     { name: 'MUAY THAI', hp: 106, spd: 1.06, pow: 1.05, reach: 1.0,  w: 1.0,  h: 1.02, special: { base: 'Flying Knee',  mech: 'lunge', dmg: 12, cd: 3.6, tip: 'Leaping knee' },               super: { base: 'Tiger Combo',    mech: 'flurry', dmg: 31, hits: 8, tip: 'Rapid elbows and knees' } },
  sumo:     { name: 'SUMO',      hp: 135, spd: 0.82, pow: 1.2,  reach: 0.92, w: 1.5,  h: 1.0,  special: { base: 'Belly Slam',   mech: 'lunge', dmg: 15, cd: 5.0, tip: 'Armoured shove' },             super: { base: 'Earthquake',     mech: 'quake', dmg: 33, hits: 1, tip: 'Ground shockwave' } },
  capoeira: { name: 'CAPOEIRA',  hp: 102, spd: 1.12, pow: 0.98, reach: 1.12, w: 0.95, h: 1.0,  special: { base: 'Spin Kick',    mech: 'spin',  dmg: 5,  cd: 3.8, tip: 'Spinning multi-hit kick' },     super: { base: 'Whirlwind',      mech: 'tornado', dmg: 28, hits: 5, tip: 'Travelling tornado' } },
  wrestler: { name: 'WRESTLER',  hp: 122, spd: 0.92, pow: 1.14, reach: 0.95, w: 1.2,  h: 1.05, special: { base: 'Suplex',       mech: 'grab',  dmg: 20, cd: 5.5, tip: 'Command grab: cannot be blocked' }, super: { base: 'Giga Piledriver', mech: 'grab', dmg: 38, hits: 1, tip: 'Cinematic grab' } },
  taekwon:  { name: 'TAEKWONDO', hp: 100, spd: 1.1,  pow: 1.0,  reach: 1.22, w: 0.92, h: 1.05, special: { base: 'Rocket Kick',  mech: 'dive',  dmg: 12, cd: 3.8, tip: 'Diagonal flying kick' },       super: { base: 'Blitz Kicks',    mech: 'flurry', dmg: 29, hits: 6, tip: 'Rapid kick storm' } },
  mystic:   { name: 'MYSTIC',    hp: 96,  spd: 0.98, pow: 1.0,  reach: 0.95, w: 0.92, h: 1.0,  special: { base: 'Spirit Beam',  mech: 'beam',  dmg: 11, cd: 3.4, tip: 'Fast energy beam' },           super: { base: 'Mega Beam',      mech: 'beam',  dmg: 34, hits: 6, tip: 'Screen-wide beam', big: true } },
  robot:    { name: 'ROBOT',     hp: 112, spd: 0.96, pow: 1.08, reach: 1.0,  w: 1.1,  h: 1.08, special: { base: 'Rocket Punch', mech: 'fist',  dmg: 12, cd: 3.6, tip: 'Flying fist' },                 super: { base: 'Laser Barrage',  mech: 'volley', dmg: 32, hits: 5, tip: 'Fires a volley of lasers' } },
}

// 4 fighters per style, in element order fire / ice / thunder / shadow
const NAMES = {
  brawler:  ['RAGNAR', 'FROSTBITE', 'BOLT', 'GRIM'],
  karate:   ['KENJI', 'YUKI', 'RAIDEN', 'KAGE'],
  ninja:    ['HANZO', 'SETSUNA', 'ZAP', 'ECLIPSE'],
  muay:     ['SAMART', 'NAKHON', 'SAEN', 'MIDNIGHT'],
  sumo:     ['DAIGO', 'TSURARA', 'KAMINARI', 'ONI'],
  capoeira: ['MARCO', 'GELO', 'RELAMPAGO', 'SOMBRA'],
  wrestler: ['EL TORO', 'BLIZZARD', 'THUNDER JACK', 'REAPER'],
  taekwon:  ['JIN', 'SORA', 'MINHO', 'LUNA'],
  mystic:   ['AMBER', 'CRYSTAL', 'STORM', 'NOX'],
  robot:    ['PYRO-9', 'CRYO-7', 'VOLT-X', 'GLITCH'],
}
const SKINS = ['#ffd2a8', '#e8b48a', '#c98f65', '#8d5a3a', '#f6c9a0', '#a8714a']
const HAIR = ['#2a1a10', '#7a3a10', '#e8e8e8', '#ff4d8d', '#3de8ff', '#ffe84a', '#1a1a22', '#b04dff']
const HAIRSTYLE = ['short', 'spiky', 'long', 'mohawk', 'bald', 'band', 'bun', 'afro']
const TAGS = {
  brawler: 'Street fighter with a heavy hand', karate: 'Disciplined and balanced', ninja: 'Fast, sneaky, dangerous', muay: 'Eight limbs of pain',
  sumo: 'A wall of power', capoeira: 'Dances around you', wrestler: 'Grabs and slams', taekwon: 'Long-range kicker', mystic: 'Master of the spirit', robot: 'Built to fight',
}

export const ROSTER = []
const keys = Object.keys(STYLES), els = Object.keys(ELEMENTS)
keys.forEach((sk, si) => {
  const S = STYLES[sk]
  els.forEach((ek, ei) => {
    const i = ROSTER.length
    const E = ELEMENTS[ek]
    const robot = sk === 'robot'
    // small deterministic stat variation so every fighter feels a little different
    const v = ((i * 37) % 11) / 100
    const hp = Math.round(S.hp * (1 + (ei === 0 ? 0.0 : ei === 1 ? 0.04 : ei === 2 ? -0.04 : -0.02)))
    const spd = +(S.spd * (ei === 2 ? 1.06 : ei === 3 ? 1.02 : 1)).toFixed(2)
    const pow = +(S.pow * (ei === 0 ? 1.06 : ei === 3 ? 1.03 : 1)).toFixed(2)
    ROSTER.push({
      id: i, key: `${sk}_${ek}`, style: sk, element: ek, name: NAMES[sk][ei], styleName: S.name, tag: TAGS[sk],
      hp, spd, pow, reach: +(S.reach + v * 0.2).toFixed(2), w: S.w, h: S.h,
      skin: robot ? '#aab4c8' : SKINS[(i * 5 + si) % SKINS.length],
      hair: robot ? E.color : HAIR[(i * 3 + ei) % HAIR.length], hairStyle: robot ? 'bald' : HAIRSTYLE[(i * 7 + ei * 3) % HAIRSTYLE.length],
      top: ei % 2 ? '#f2f4ff' : E.color, pants: ei === 3 ? '#1a1030' : ei === 2 ? '#3a2e10' : ei === 1 ? '#10304a' : '#3a1208',
      trim: E.glow, acc: sk === 'ninja' ? 'mask' : sk === 'karate' ? 'headband' : sk === 'mystic' ? 'orb' : sk === 'robot' ? 'visor' : sk === 'sumo' ? 'topknot' : sk === 'taekwon' ? 'belt' : sk === 'capoeira' ? 'sash' : sk === 'wrestler' ? 'mask2' : 'wrap',
      special: { ...S.special, name: `${E.word} ${S.special.base}`, mech: S.special.mech, dmg: Math.round(S.special.dmg * pow) },
      super: { ...S.super, name: `${E.word} ${S.super.base}`, mech: S.super.mech, dmg: Math.round(S.super.dmg * pow), hits: S.super.hits },
    })
  })
})
export const rosterById = (i) => ROSTER[((i % ROSTER.length) + ROSTER.length) % ROSTER.length]
