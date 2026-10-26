// MAHJONG scoring: Hong Kong Old Style fan counting and payments.
//
// RULES USED (documented so the game is internally consistent; nothing here is borrowed from other variants):
//  * 144 tiles, 13 tiles per hand, bonus tiles (flowers/seasons) are replaced from the end of the wall.
//  * A winning hand is 4 sets + a pair, or Thirteen Orphans. At least `minFan` fan are required to win (default 1; the traditional
//    table minimum is 3, selectable in the rules).
//  * The highest-scoring way of splitting the hand is always the one that is counted.
//
//  FAN LIST
//    Common hand (all chows, pair not scoring, no flowers needed)          1      Chicken hand (nothing else)   0
//    All pungs                                                           3
//    Mixed one suit (one suit + honours)                                 3      Pure one suit (one suit only) 6
//    Dragon pung (each of 中 發 白)                                       1      Prevailing wind pung          1     Seat wind pung   1
//    Small three dragons 5   Big three dragons 8   Small four winds 6   Big four winds 13 (limit)
//    All honours 10 (limit)  All terminals 13 (limit)  Thirteen orphans 13 (limit)
//    Self-draw 1   Concealed hand (won on a discard with no exposed melds) 1   Fully concealed (self-draw + concealed) 3 (replaces both)
//    Own flower / own season (the one matching your seat) 1 each   All four flowers 2   All four seasons 2
//    Won on the last tile of the wall 1   Won on the replacement draw after a kong 1   Robbing a kong 1
//  Limit hands are worth the limit (default 13 fan). Fan above the limit are capped.
//  PAYMENT TABLE (points for the winner from one payer): 0 fan 1, 1: 2, 2: 4, 3: 8, 4: 16, 5: 24, 6: 32, 7: 48, 8: 64, 9: 96,
//  10: 128, 11: 192, 12: 256, 13: 384.
//  PAYMENT RULES: on a discard win the player who discarded pays the whole amount. On a self-draw every other player pays the
//  amount. If the dealer wins, or the dealer is a payer, that payment is doubled (house rule `dealerDouble`, on by default).
import { WINDS, isSuited, isHonor, isWind, isDragon, isTerminal, suitOf, countsOf } from './tiles.js'
import { winInfo } from './rules.js'

export const DEFAULT_OPTS = { minFan: 1, limit: 13, dealerDouble: true, noFlowerFan: false }
const TABLE = [1, 2, 4, 8, 16, 24, 32, 48, 64, 96, 128, 192, 256, 384]
export const pointsForFan = (fan, limit = 13) => TABLE[Math.max(0, Math.min(fan, limit, 13))]
const FLOWER_OF_SEAT = (wind) => ['f' + (wind + 1), 'q' + (wind + 1)] // East gets flower 1/season 1, South flower 2/season 2, ...

// all tiles of a finished hand as kinds (kong counts as one set but contains four)
function allKinds(concealed, melds) { return [...concealed.map((t) => t.k), ...melds.flatMap((m) => (m.tiles ? m.tiles.map((t) => t.k) : [m.k, m.k, m.k])) ] }

function fanForStructure(sets, pairK, ctx) {
  const items = []
  const { seatWind, prevailing } = ctx
  const kinds = []
  for (const s of sets) kinds.push(s.k)
  kinds.push(pairK)
  const pungs = sets.filter((s) => s.t === 'pung' || s.t === 'kong')
  const chows = sets.filter((s) => s.t === 'chow')
  const suits = new Set(), hasHonor = kinds.some(isHonor)
  for (const k of kinds) { const su = suitOf(k); if (su) suits.add(su) }
  // limit hands first
  const windPungs = pungs.filter((s) => isWind(s.k)).length, dragonPungs = pungs.filter((s) => isDragon(s.k)).length
  const everyK = ctx.allKinds
  if (windPungs === 4) return [{ name: 'Big four winds', fan: 13, limit: true }]
  if (dragonPungs === 3) { items.push({ name: 'Big three dragons', fan: 8 }) }
  if (everyK.every(isHonor)) return [{ name: 'All honours', fan: 10, limit: true }]
  if (everyK.every(isTerminal)) return [{ name: 'All terminals', fan: 13, limit: true }]
  if (windPungs === 3 && isWind(pairK)) items.push({ name: 'Small four winds', fan: 6 })
  if (dragonPungs === 2 && isDragon(pairK)) items.push({ name: 'Small three dragons', fan: 5 })
  if (chows.length === 0 && sets.length === 4 && pungs.length === 4) items.push({ name: 'All pungs', fan: 3 })
  if (suits.size === 1 && hasHonor) items.push({ name: 'Mixed one suit', fan: 3 })
  if (suits.size === 1 && !hasHonor) items.push({ name: 'Pure one suit', fan: 6 })
  const small3 = dragonPungs === 2 && isDragon(pairK) // the two dragon pungs are already part of that 5 fan
  if (dragonPungs < 3 && !small3) for (const s of pungs) if (isDragon(s.k)) items.push({ name: 'Dragon pung (' + s.k + ')', fan: 1, tile: s.k })
  for (const s of pungs) { if (isWind(s.k) && s.k === WINDS[prevailing] ) items.push({ name: 'Prevailing wind pung', fan: 1 }); if (isWind(s.k) && s.k === WINDS[seatWind]) items.push({ name: 'Seat wind pung', fan: 1 }) }
  const scoringPair = isDragon(pairK) || pairK === WINDS[seatWind] || pairK === WINDS[prevailing]
  if (chows.length === 4 && !scoringPair) items.push({ name: 'Common hand (all chows)', fan: 1 })
  return items
}

function bonusFan(flowers, seatWind, opts) {
  const items = []
  const own = FLOWER_OF_SEAT(seatWind), ks = flowers.map((t) => t.k)
  for (const k of own) if (ks.includes(k)) items.push({ name: k[0] === 'f' ? 'Own flower' : 'Own season', fan: 1 })
  if (['f1', 'f2', 'f3', 'f4'].every((k) => ks.includes(k))) items.push({ name: 'All four flowers', fan: 2 })
  if (['q1', 'q2', 'q3', 'q4'].every((k) => ks.includes(k))) items.push({ name: 'All four seasons', fan: 2 })
  if (!ks.length && opts.noFlowerFan) items.push({ name: 'No flowers', fan: 1 })
  return items
}

// Score a winning hand. input: { concealed (incl. winning tile), melds, flowers, seatWind (0=E..3=N), prevailing, selfDraw,
//   lastTile, kongDraw, robKong, opts }  ->  { valid, fan, points, items, structure }
export function scoreWin(input) {
  const opts = { ...DEFAULT_OPTS, ...(input.opts || {}) }
  const { concealed, melds = [], flowers = [], seatWind, prevailing, selfDraw = false } = input
  const info = winInfo(concealed, melds)
  if (!info.win) return { valid: false, reason: 'Not a winning hand', fan: 0, points: 0, items: [] }
  const exposed = melds.filter((m) => !m.concealed).length
  const concealedHand = exposed === 0
  const ctxAll = allKinds(concealed, melds)
  const meldSets = melds.map((m) => ({ t: m.type === 'chow' ? 'chow' : m.type === 'pung' ? 'pung' : 'kong', k: m.k }))
  const shared = []
  if (selfDraw && concealedHand) shared.push({ name: 'Fully concealed (self-draw)', fan: 3 })
  else { if (selfDraw) shared.push({ name: 'Self-draw', fan: 1 }); if (!selfDraw && concealedHand) shared.push({ name: 'Concealed hand', fan: 1 }) }
  if (input.lastTile) shared.push({ name: selfDraw ? 'Last tile from the wall' : 'Last discard', fan: 1 })
  if (input.kongDraw) shared.push({ name: 'Win on kong replacement', fan: 1 })
  if (input.robKong) shared.push({ name: 'Robbing a kong', fan: 1 })
  shared.push(...bonusFan(flowers, seatWind, opts))
  let best = null
  const consider = (items, structure) => {
    const limitHit = items.some((i) => i.limit)
    let fan = items.reduce((a, i) => a + i.fan, 0)
    if (limitHit) fan = Math.max(fan, opts.limit)
    fan = Math.min(fan, opts.limit)
    if (!best || fan > best.fan) best = { fan, items, structure }
  }
  if (info.kind === 'orphans') consider([{ name: 'Thirteen orphans', fan: 13, limit: true }], { kind: 'orphans' })
  else for (const d of info.decomps) {
    const sets = [...meldSets, ...d.sets]
    const structural = fanForStructure(sets, d.pair, { seatWind, prevailing, allKinds: ctxAll })
    const items = structural.length ? [...structural, ...shared] : [{ name: 'Chicken hand', fan: 0 }, ...shared]
    consider(items, { kind: 'standard', sets, pair: d.pair })
  }
  const valid = best.fan >= opts.minFan
  return { valid, reason: valid ? '' : `Needs at least ${opts.minFan} fan (this hand has ${best.fan})`, fan: best.fan, points: pointsForFan(best.fan, opts.limit), items: best.items, structure: best.structure }
}

// Payments for a won hand: array of 4 numbers (positive = receives, negative = pays), indexed by seat.
export function payments({ winner, discarder = null, selfDraw, dealer, points, opts }) {
  const o = { ...DEFAULT_OPTS, ...(opts || {}) }
  const pay = [0, 0, 0, 0]
  const mult = (a, b) => (o.dealerDouble && (a === dealer || b === dealer) ? 2 : 1)
  if (selfDraw) {
    for (let s = 0; s < 4; s++) if (s !== winner) { const v = points * mult(winner, s); pay[s] -= v; pay[winner] += v }
  } else {
    const v = points * mult(winner, discarder); pay[discarder] -= v; pay[winner] += v
  }
  return pay
}
export { countsOf, isSuited }
