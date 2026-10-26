// MAHJONG tiles. Kinds are short strings so duplicate tiles can be counted; every physical tile also has a unique id.
//   m1-m9 characters (萬), p1-p9 circles (筒), s1-s9 bamboo (索)
//   we ws ww wn  winds (東 南 西 北)     dr dg dw  dragons (中 發 白)
//   f1-f4 flowers (梅 蘭 菊 竹)           q1-q4  seasons (春 夏 秋 冬)   <- bonus tiles
export const SUIT_KINDS = []
for (const s of ['m', 'p', 's']) for (let n = 1; n <= 9; n++) SUIT_KINDS.push(s + n)
export const WINDS = ['we', 'ws', 'ww', 'wn']
export const DRAGONS = ['dr', 'dg', 'dw']
export const HONORS = [...WINDS, ...DRAGONS]
export const KINDS = [...SUIT_KINDS, ...HONORS] // the 34 playable kinds, in canonical order
export const BONUS = ['f1', 'f2', 'f3', 'f4', 'q1', 'q2', 'q3', 'q4']
export const ORPHANS = ['m1', 'm9', 'p1', 'p9', 's1', 's9', ...HONORS] // the 13 terminals and honours
export const IDX = Object.fromEntries(KINDS.map((k, i) => [k, i]))
export const isBonus = (k) => k[0] === 'f' || k[0] === 'q'
export const isSuited = (k) => k[0] === 'm' || k[0] === 'p' || k[0] === 's'
export const isHonor = (k) => k[0] === 'w' || k[0] === 'd'
export const isWind = (k) => k[0] === 'w'
export const isDragon = (k) => k[0] === 'd'
export const suitOf = (k) => (isSuited(k) ? k[0] : null)
export const numOf = (k) => (isSuited(k) ? +k[1] : 0)
export const isTerminal = (k) => isSuited(k) && (k[1] === '1' || k[1] === '9')

const NAMES = { m: 'Character', p: 'Circle', s: 'Bamboo' }
const NUM_ZH = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九']
export const SUIT_ZH = { m: '萬', p: '筒', s: '索' }
export const HONOR_ZH = { we: '東', ws: '南', ww: '西', wn: '北', dr: '中', dg: '發', dw: '白' }
export const BONUS_ZH = { f1: '梅', f2: '蘭', f3: '菊', f4: '竹', q1: '春', q2: '夏', q3: '秋', q4: '冬' }
const HONOR_EN = { we: 'East wind', ws: 'South wind', ww: 'West wind', wn: 'North wind', dr: 'Red dragon', dg: 'Green dragon', dw: 'White dragon' }
const BONUS_EN = { f1: 'Plum flower', f2: 'Orchid flower', f3: 'Chrysanthemum flower', f4: 'Bamboo flower', q1: 'Spring season', q2: 'Summer season', q3: 'Autumn season', q4: 'Winter season' }
export const tileName = (k) => (isSuited(k) ? `${numOf(k)} ${NAMES[k[0]]}` : isHonor(k) ? HONOR_EN[k] : BONUS_EN[k])
// what is printed on the tile: a big symbol and a small caption (readable without colour: the suit is a character, not just a hue)
export function tileFace(k) {
  if (isSuited(k)) return { big: k[0] === 'm' ? NUM_ZH[numOf(k)] : String(numOf(k)), small: SUIT_ZH[k[0]], suit: k[0] }
  if (isHonor(k)) return { big: HONOR_ZH[k], small: k === 'dw' ? '' : isWind(k) ? 'WIND' : 'DRAGON', suit: k[0] === 'w' ? 'w' : k }
  return { big: BONUS_ZH[k], small: k[0] === 'f' ? 'FLOWER' : 'SEASON', suit: 'b' }
}
export const order = (k) => (k in IDX ? IDX[k] : 100 + BONUS.indexOf(k))
export const sortTiles = (tiles) => tiles.slice().sort((a, b) => order(a.k) - order(b.k) || a.id - b.id)

// the traditional 144 tile set: 4 copies of each of the 34 kinds + 8 bonus tiles
export function fullSet() {
  const t = []; let id = 0
  for (const k of KINDS) for (let c = 0; c < 4; c++) t.push({ id: id++, k })
  for (const k of BONUS) t.push({ id: id++, k })
  return t
}
// a small seedable generator so tests (and saved games) can be reproduced; Math.random is used when no seed is given
export function rng(seed) {
  if (seed === undefined || seed === null) return Math.random
  let a = seed >>> 0
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
// Fisher-Yates: every ordering is equally likely
export function shuffle(arr, rand = Math.random) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }
export const countsOf = (tiles) => { const c = {}; for (const t of tiles) c[t.k] = (c[t.k] || 0) + 1; return c }
