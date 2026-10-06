// Pixel-art sprites. Every sprite is a list of coloured "voxels" rendered as instanced cubes.
const PAL = {
  W: '#ffffff', S: '#b9c6dc', K: '#6b7690', D: '#2b3347',
  R: '#ff3b4e', O: '#ff9a2e', Y: '#ffe84a', G: '#3dff7a', L: '#b6ff3d',
  C: '#3de8ff', B: '#3d7bff', P: '#a64dff', M: '#ff4de1', N: '#ff7ab0', T: '#12c9a5',
}

const lin = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))
export const rgb = (hex) => {
  const n = parseInt(hex.slice(1), 16)
  return [lin(((n >> 16) & 255) / 255), lin(((n >> 8) & 255) / 255), lin((n & 255) / 255)]
}

export function mk(rows, pal = PAL) {
  const w = Math.max(...rows.map((r) => r.length))
  const h = rows.length
  const px = []
  rows.forEach((r, j) => {
    for (let i = 0; i < r.length; i++) {
      const col = pal[r[i]]
      if (!col || r[i] === '.') continue
      px.push({ x: i - (w - 1) / 2, y: (h - 1) / 2 - j, c: rgb(col) })
    }
  })
  return { w, h, px, hw: w / 2, hh: h / 2 }
}
const sym = (rows) => rows.concat(rows.slice(0, -1).reverse())
const sub = (rows, from, to) => rows.map((r) => r.replaceAll(from, to))

// ---------- glyphs for power-up icons ----------
const GLYPH = {
  P: ['####.', '#...#', '####.', '#....', '#....'],
  S: ['.####', '#....', '.###.', '....#', '####.'],
  R: ['####.', '#...#', '####.', '#..#.', '#...#'],
  W: ['#...#', '#...#', '#.#.#', '##.##', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'],
  H: ['..#..', '..#..', '#####', '..#..', '..#..'],
  B: ['####.', '#...#', '####.', '#...#', '####.'],
  U: ['.#.#.', '#####', '#####', '.###.', '..#..'],
  X: ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  G: ['.###.', '#....', '#.###', '#...#', '.###.'],
  D: ['.#.#.', '..#..', '#####', '..#..', '.#.#.'],
}
export const PUP_COLORS = { P: 'Y', S: 'C', R: 'O', W: 'G', L: 'B', M: 'R', H: 'N', B: 'M', U: 'G', X: 'P', G: 'T', D: 'L' }
function icon(letter, border) {
  const g = GLYPH[letter].map((r) => r.replaceAll('#', 'W'))
  const rows = ['.' + border.repeat(5) + '.']
  g.forEach((r) => rows.push(border + r + border))
  rows.push('.' + border.repeat(5) + '.')
  return mk(rows)
}
const orb = (c) => mk(['.X.', 'XWX', '.X.'].map((r) => r.replaceAll('X', c)))

const bossPal = (a, b, c, d, e) => ({ ...PAL, a, b, c, d, e, f: '#ffffff' })

export const SP = {
  player: mk(['SS.......', '.SBS.....', '.SBBSSS..', 'SSBCCCSSW', '.SBBSSS..', '.SBS.....', 'SS.......']),
  drone: mk(sym(['..OOO..', '.ORRRO.', 'WRRYRRO'])),
  zig: mk(sym(['..PP...', '.PMMP..', 'WPMYMPP'])),
  kami: mk(sym(['R...R..', '.RRRRR.', 'YOYRRRR'])),
  shooter: mk(sym(['...GGG...', '..GGLGG..', '.GGGLLGGG', 'WWGGGGGGG'])),
  weaver: mk(sym(['..CC.....', '.CBBC.CC.', 'WCBBBCCCC'])),
  tank: mk(sym(['....KKKKK....', '..KKSSSSSKK..', '.KSSSRRSSSSK.', 'WKSSRRRRSSSSK', 'WKSSSSSSSSSSK'])),
  carrier: mk(sym(['......KKKKK......', '....KKSSSSSKK....', '..KKSSSSOOSSSKK..', 'WKKSSSOOOOSSSSSKK', 'WKSSSSSSSSSSSSSSK'])),
  rockL: mk(['..KKKKK..', '.KSSKKSK.', 'KSSKKKSSK', 'KSKKSKKSK', 'KKKSSKKKK', 'KSKKKKSSK', 'KKSSKKKSK', '.KKKSKKK.', '..KKKKK..']),
  rockS: mk(['.KKK.', 'KSKKK', 'KKKSK', 'KSKKK', '.KKK.']),
  mine: mk(['...R...', '.K.R.K.', '..KKK..', 'RKKOKKR', '..KKK..', '.K.R.K.', '...R...']),
  ufo: mk(['...BBBBB...', '..BCCCCCB..', '.SSSSSSSSS.', 'SSYSSYSSYSS', '..K.....K..']),
  orbR: orb('R'), orbP: orb('P'), orbC: orb('C'), orbY: orb('Y'),
  big: mk(['.MMM.', 'MMWMM', 'MWWWM', 'MMWMM', '.MMM.']),
  dart: mk(['WRR']),
  dartC: mk(['WCC']),
  missile: mk(['.OO..', 'WORRR', '.OO..']),
  pb: mk(['CCW']),
  pbS: mk(['GG', 'GG']),
  pbL: mk(['BBBBBBBBBBBBWW', 'WWWWWWWWWWWWWW', 'BBBBBBBBBBBBWW']),
  pbM: mk(['.OO..', 'RRROW', '.OO..'].map((r) => r)),
  wing: mk(['.C.', 'CWC', '.C.']),
  coin: mk(['.YYY.', 'YYOYY', 'YOYYY', 'YYOYY', '.YYY.']),
  gem: mk(['.C.', 'CWC', '.C.']),
  // bosses
  boss0: mk(
    sym([
      '...........dd........', '..........dabd.......', '.....dd..dabbbd......', '....dabdddabbbbd.....',
      '...dabbbbbbbbbbbd....', '..dabbbbbbcccbbbbd...', 'fdabbbbbbcceecbbbbd..', 'fdabbbbbbbcccbbbbbbd.',
    ]),
    bossPal('#ffb36b', '#e8503a', '#ffe84a', '#4a1a1a', '#ffffff'),
  ),
  boss1: mk(
    sym([
      '....ddddddd........', '..ddaabbbbbdd......', '.daabbbbbbbbbd.....', 'dabbbbbbbbbbbbd....',
      'dabbbbeeebbbbbbd...', 'fdabbeeeeebbbbbbd..', 'fdaabbbeeebbbbbbbd.', '..ddabbbbbbbbbbbbd.',
    ]),
    bossPal('#c9ff6b', '#3dbb5a', '#ffe84a', '#143a1f', '#ff4de1'),
  ),
  boss2: mk(
    sym([
      '.......dd......', '......dabd.....', '.....dabbd.....', '....dabbbbd....', '...dabbbbbbd...',
      '..dabbbccbbbd..', '..dabbcceebbbd.', 'f.dabbbccbbbbbd', 'ffdabbbbbbbbbbd',
    ]),
    bossPal('#8fd8ff', '#3d7bff', '#a64dff', '#14204a', '#ffffff'),
  ),
  boss3: mk(
    sym([
      '..........dd........', '......dddabbd.......', '....dabbbbbbbd......', '..dabbbbbbbbbbdd....',
      'fdabbbbbbbbbbbbbdd..', 'fdabbcceebbbbbbbbbd.',
    ]),
    bossPal('#e6b3ff', '#a64dff', '#ff4de1', '#2a1245', '#3de8ff'),
  ),
  boss4: mk(
    sym([
      '....dddddddddddddd..........', '...dabbbbbbbbbbbbbd.........', '..dabbbddddddbbbbbbd........',
      '.dabbbdcccccdbbbbbbbd.......', 'fdabbbdceeeecdbbbbbbbbd.....', 'fdabbbbdcccccdbbbbbbbbbbd...',
      '..dabbbbbddddbbbbbbbbbbbbd..', '..dabbbbbbbbbbbbbbbbbbbbbbd.',
    ]),
    bossPal('#cfd8e6', '#6b7690', '#ff9a2e', '#1a2030', '#ff3b4e'),
  ),
  boss9: mk(
    sym([
      '.........ddd................', '........dabbd...............', '....dd..dabbbd..dd..........',
      '...dabdddabbbbdddabd........', '..dabbbbbbbbbbbbbbbbd.......', '.dabbbbbccccccccbbbbbd......',
      'fdabbbbcceeeeeeccbbbbbd.....', 'fdabbbbbcceeeeccbbbbbbbd....', '.ffdabbbbbcceeccbbbbbbbbd...',
    ]),
    bossPal('#ffd1d1', '#ff3b4e', '#a64dff', '#2b0a14', '#ffffff'),
  ),
  boss5: mk(
    sym(['......dd.........', '....ddabbd.......', '..ddabbbbbd......', '.dabbbbbbbbbd....', 'dabbbcccbbbbbd...', 'fdabbceeecbbbbd..', 'fdabbbcccbbbbbbd.']),
    bossPal('#d8f6ff', '#5fb8ff', '#ffffff', '#10304a', '#3de8ff'),
  ),
  boss6: mk(
    sym(['d....d............', 'dd..dad...........', '.dddabd.dd........', '..dabbbddabd......', '..dabbbbbbbbd.....', 'fdabbbcccbbbbbd...', 'fdabbcceeccbbbbbd.']),
    bossPal('#fff2a0', '#ff9a2e', '#ff3b4e', '#4a2000', '#ffffff'),
  ),
  boss7: mk(
    sym(['..dddddddddddddddd.....', '.dabbbbbbbbbbbbbbbd....', 'dabbbddddddddddbbbbd...', 'dabbdcccccccccdbbbbbd..', 'fdabdceeeeeeeecdbbbbbd.', 'fdabdcccccccccdbbbbbbbd']),
    bossPal('#d0d4e0', '#7a8098', '#ffe84a', '#1a1c28', '#ff9a2e'),
  ),
  boss8: mk(
    sym(['........dd.......', '......ddabd......', '....ddabbbbd.....', '..ddabbbbbbbdd...', '.dabbbcbbbbbbbdd.', 'fdabbcceebbbbbbbd']),
    bossPal('#c0c8ff', '#4a3ad8', '#ff4de1', '#10104a', '#ffffff'),
  ),
}
for (const k of Object.keys(GLYPH)) SP['pup' + k] = icon(k, PUP_COLORS[k])

// ---------- tiny 3x5 pixel font for score pop-ups ----------
const FONT = {
  0: ['###', '#.#', '#.#', '#.#', '###'], 1: ['.#.', '##.', '.#.', '.#.', '###'],
  2: ['###', '..#', '###', '#..', '###'], 3: ['###', '..#', '###', '..#', '###'],
  4: ['#.#', '#.#', '###', '..#', '..#'], 5: ['###', '#..', '###', '..#', '###'],
  6: ['###', '#..', '###', '#.#', '###'], 7: ['###', '..#', '..#', '.#.', '.#.'],
  8: ['###', '#.#', '###', '#.#', '###'], 9: ['###', '#.#', '###', '..#', '###'],
  '+': ['...', '.#.', '###', '.#.', '...'], x: ['...', '#.#', '.#.', '#.#', '...'],
}
const textCache = {}
export function textPx(str) {
  if (textCache[str]) return textCache[str]
  const out = []
  const total = str.length * 4 - 1
  ;[...str].forEach((ch, ci) => {
    const g = FONT[ch]
    if (!g) return
    g.forEach((row, j) => {
      for (let i = 0; i < 3; i++) if (row[i] === '#') out.push({ x: ci * 4 + i - (total - 1) / 2, y: 2 - j })
    })
  })
  return (textCache[str] = out)
}

// ---------- aircraft customization ----------
export const SHIP_DEFS = [
  { id: 'viper',  name: 'VIPER',  desc: 'Balanced all-rounder',                 unlock: 0, spd: 50, hp: 0,  rate: 1,    hw: 1.7, hh: 1.4,
    rows: ['SS.......', '.SBS.....', '.SBBSSS..', 'SSBCCCSSW', '.SBBSSS..', '.SBS.....', 'SS.......'] },
  { id: 'falcon', name: 'FALCON', desc: 'Fastest and tiny hitbox, -1 hull',    unlock: 0, spd: 60, hp: -1, rate: 1,    hw: 1.4, hh: 1.0,
    rows: ['SS.........', '.SSBS......', 'SSBBCCSSSSW', '.SSBS......', 'SS.........'] },
  { id: 'manta',  name: 'MANTA',  desc: '15% faster fire, wide hitbox',         unlock: 2, spd: 50, hp: 0,  rate: 0.85, hw: 1.9, hh: 1.8,
    rows: ['S........', 'SS.......', '.SSBS....', '.SSBBSS..', 'SSBCCCSSW', '.SSBBSS..', '.SSBS....', 'SS.......', 'S........'] },
  { id: 'titan',  name: 'TITAN',  desc: '+2 hull, slow and heavy',              unlock: 5, spd: 42, hp: 2,  rate: 1,    hw: 2.4, hh: 2.2,
    rows: ['KKK........', '.KSSS......', '.KSBBSSS...', 'KSSBBBSSS..', 'KSSBCCCSSSW', 'KSSBBBSSS..', '.KSBBSSS...', '.KSSS......', 'KKK........'] },
]
// [name, body, accent, glow]
export const PAINTS = [
  ['STEEL', '#b9c6dc', '#3d7bff', '#3de8ff'], ['CRIMSON', '#ffb3b8', '#ff3b4e', '#ffe84a'], ['TOXIC', '#d8ffb0', '#3dff7a', '#b6ff3d'],
  ['VIOLET', '#e6c8ff', '#a64dff', '#ff4de1'], ['SOLAR', '#fff2b0', '#ff9a2e', '#ffffff'], ['GHOST', '#ffffff', '#6b7690', '#3de8ff'],
  ['CYBER', '#3de8ff', '#ff4de1', '#ffe84a'], ['GOLD', '#ffe84a', '#c8862a', '#ff3b4e'],
]
export const TRAILS = [['PLASMA', '#3de8ff'], ['FIRE', '#ff9a2e'], ['TOXIC', '#3dff7a'], ['VOID', '#a64dff'], ['SNOW', '#ffffff'], ['RAINBOW', null]]
export const BULLET_COLORS = [['CYAN', '#3de8ff'], ['LIME', '#b6ff3d'], ['GOLD', '#ffe84a'], ['PINK', '#ff4de1'], ['RED', '#ff3b4e'], ['WHITE', '#ffffff']]
const shipCache = {}
export function shipSprite(model, paint) {
  const k = model + '_' + paint
  if (!shipCache[k]) {
    const [, body, acc, glow] = PAINTS[paint] || PAINTS[0]
    shipCache[k] = mk(SHIP_DEFS[model].rows, { S: body, B: acc, C: glow, W: '#ffffff', K: '#3a4258' })
  }
  return shipCache[k]
}
export const BULLET_SPR = BULLET_COLORS.map(([, c]) => ({ pb: mk(['XXW'], { X: c, W: '#ffffff' }), pbS: mk(['XX', 'XX'], { X: c }) }))
export const TRAIL_COLS = TRAILS.map(([, c]) => (c ? [rgb(c)] : [rgb('#ff4d4d'), rgb('#ffe84a'), rgb('#3dff7a'), rgb('#3de8ff'), rgb('#a64dff')]))

// ---------- run & gun (ground zero) sprites ----------
const SPAL = {
  k: '#f2c08a', r: '#d03030', g: '#3a8a3a', b: '#6b4a2a', d: '#20242c', t: '#c8a860', w: '#f2f2f2', y: '#ffd84a', B: '#3a6ad8',
  K: '#6b7690', o: '#ff9a2e', e: '#ff3b4e', s: '#b9c6dc', M: '#7a5a2a', G: '#4a5a2a', h: '#7a8a4a', c: '#3de8ff', n: '#ff7ab0', x: '#2a2a3a',
}
function man(H, T, P, frame, pal = SPAL) {
  const legs = frame ? ['.PP..', '..PP.'] : ['P..P.', 'd..d.']
  return mk(['HHHH.', 'kkkk.', 'kdkk.', 'TTTT.', 'TTTT.', 'TnTT.', 'PPPP.', ...legs].map((r) => r.replaceAll('H', H).replaceAll('T', T).replaceAll('P', P).replaceAll('n', 'd')), pal)
}
Object.assign(SP, {
  hero: man('r', 'g', 'b', 0), hero2: man('r', 'g', 'b', 1),
  sol: man('M', 't', 'x', 0), sol2: man('M', 't', 'x', 1),
  run: man('e', 't', 'x', 0), run2: man('e', 't', 'x', 1),
  gre: man('B', 't', 'x', 0), gre2: man('B', 't', 'x', 1),
  baz: man('K', 'G', 'x', 0), baz2: man('K', 'G', 'x', 1),
  pow: mk(['.kkk.', 'kdkk.', 'wwww.', 'wwww.', 'wywr.', 'wwww.', 'kwwk.', '.kk..', '.kk..'], SPAL),
  tank: mk([
    '......GGGGGGG......', '.....GGhhhhhhGG....', 'ddddGGhhyyhhhGGd...', '.....GGGGGGGGGGGd..',
    '..dddddddddddddddd.', '.dKdKdKdKdKdKdKdKd.', '.dddddddddddddddddd', '..dKKdKKdKKdKKdKKd.', '...dddddddddddddd..',
  ], SPAL),
  chop: mk([
    '......d......', '.GGGGGGGGG...', 'dGccGGGGGGGGd', '.GGGGGGGGG.d.', '..d.....d....',
  ], SPAL),
  mech: mk([
    '....dddddd....', '...dKKKKKKd...', '...dKeeeeKd...', '..dKKKKKKKKd..', '.dKKKdKKdKKKd.', 'dKKKKdKKdKKKKd', 'dKKd.dKKd.dKKd',
    'dKd..dKKd..dKd', '.d...dKKd...d.', '....dKKKKd....', '...ddd..ddd...', '..dKKd..dKKd..', '..dKKd..dKKd..', '.dKKKd..dKKKd.', '.dddd....dddd.',
  ], SPAL),
  sb: mk(['yy'], SPAL),
  gr: mk(['.G.', 'GGG', '.G.'], SPAL),
  bm: mk(['.K.', 'KKK', 'KKK', '.o.'], SPAL),
  sandbag: mk(['tbtbtb', 'btbtbt'], SPAL),
})

// ---------- ground zero v2: detailed soldiers with 4-frame run, vehicles, props, scenery ----------
function soldier(c, frame) {
  const L = {
    S: ['.dPPPd.', '.dPdPd.', '.dbdbd.'], 0: ['.dPPPd.', 'dPd.dPd', 'db...bd'], 1: ['.dPPPd.', '..dPd..', '..dbd..'],
    2: ['.dPPPd.', 'dPd..dP.', 'db..db.'], 3: ['.dPPPd.', '.dPdPd.', 'dbd.dbd'], J: ['.dPPPd.', 'dP...Pd', '.db.bd.'],
  }[frame]
  const rows = ['.dHHHd.', 'dHhHHHd', 'dkkkkkd', '.kkkek.', '..dkd..', '.dTTTd.', 'dTTtTTd', 'dBBBBBd', ...L]
  return mk(rows, { d: '#15181f', H: c.H, h: c.h, k: '#f2c08a', e: '#15181f', T: c.T, t: c.t, B: c.B, P: c.P, b: c.b })
}
const SOLDIERS = {
  hero: { H: '#d03030', h: '#ff6a6a', T: '#3a8a3a', t: '#5ac05a', B: '#7a5a2a', P: '#3a4a7a', b: '#4a2a1a' },
  sol:  { H: '#7a5a2a', h: '#a88848', T: '#c8a860', t: '#e0c880', B: '#5a4020', P: '#4a4a3a', b: '#22221e' },
  run:  { H: '#e03030', h: '#ff6060', T: '#d8c890', t: '#f0e0b0', B: '#5a4020', P: '#4a4a3a', b: '#22221e' },
  gre:  { H: '#3a6ad8', h: '#6a9aff', T: '#c8a860', t: '#e0c880', B: '#5a4020', P: '#3a3a4a', b: '#22221e' },
  baz:  { H: '#6b7690', h: '#9aa6c0', T: '#4a5a2a', t: '#6a7a3a', B: '#3a2a10', P: '#2a3a2a', b: '#22221e' },
  snp:  { H: '#2a3a2a', h: '#4a5a4a', T: '#3a4a3a', t: '#5a6a5a', B: '#2a2a20', P: '#2a3a2a', b: '#15181f' },
  pow:  { H: '#8a6a4a', h: '#a8886a', T: '#ececec', t: '#ffffff', B: '#a07a40', P: '#9a9a8a', b: '#5a4a3a' },
}
for (const [name, c] of Object.entries(SOLDIERS)) for (const f of ['S', 0, 1, 2, 3, 'J']) SP[name + f] = soldier(c, f)
const GP = { d: '#15181f', G: '#4a5a2a', h: '#7a8a4a', K: '#6b7690', y: '#ffd84a', o: '#ff9a2e', e: '#ff3b4e', g: '#3a8a3a', b: '#6b4a2a', M: '#a8783a', m: '#c89a58', R: '#d03030', r: '#ff6a6a', s: '#b9c6dc', c: '#3de8ff', w: '#f2f2f2', p: '#7a8a9a' }
Object.assign(SP, {
  vsv: mk(['........dddddd.......', '.......dGGGGGGd......', '......dGGhhhhGGd.....', '.....dGGGGGGGGGd.....', '..dddddddddddddddd...', '.dGGGGGGGGGGGGGGGGd..', 'dGGhGGGGGGGGGGGGhGGd.', 'dddddddddddddddddddd.', 'dKdKdKdKdKdKdKdKdKd..', '.dddddddddddddddddd..'], GP),
  jeep: mk(['....dddddd.....', '...dGGhhGGd....', '..dGGhhhhGGd...', 'dddddddddddddd.', 'dGGGGGGGGGGGGGd', 'dGGGGGGGGGGyGGd', '.dKKdddddddKKd.', '..KKK.....KKK..'], GP),
  plane: mk(['......dd.........', '.dddddGGGGGGGGGd.', 'dGGGGGGGhhGGGGGGd', '.dddddGGGGGGGGGd.', '......dd.........'], GP),
  barrel: mk(['.ddd.', 'dRRRd', 'drrRd', 'dyyyd', 'dRRRd', '.ddd.'], GP),
  crate: mk(['dMMMMd', 'dMmmMd', 'dMmmMd', 'dMmmMd', 'dMMMMd', 'dddddd'], GP),
  palm: mk(['...gg.gg...', '.gggggggggg', 'ggg.gg.ggg.', '.g..bb..g..', '.....b.....', '.....b.....', '.....b.....', '.....b.....', '.....b.....', '.....bb....'], GP),
  cactus: mk(['..g..', 'g.g.g', 'g.g.g', 'ggggg', '..g..', '..g..', '..g..', '..g..'], GP),
  stack: mk(['.dddd.', 'dMMMMd', 'dMmmMd', 'dMMMMd', 'dMmmMd', 'dMMMMd', 'dMmmMd', 'dMMMMd', 'dMmmMd', 'dMMMMd', 'dMmmMd', 'dMMMMd', 'dddddd'], GP),
  tire: mk(['.ddd.', 'dKKKd', 'dKdKd', 'dKKKd', '.ddd.'], GP),
  crown: mk(['y.y.y', 'yyyyy'], GP),
})
