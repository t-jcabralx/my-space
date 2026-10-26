// MAHJONG AI. Every decision is made from a "view": the seat's own tiles plus public information (all discards, exposed melds,
// bonus tiles, wall size). The AI never looks at another player's concealed hand and may only choose legal actions that the
// engine offers it; difficulty changes how well it chooses, never what it is allowed to do.
//   easy   - plays by simple rules of thumb and often discards at random
//   normal - minimises shanten (distance to a winning hand) and keeps useful shapes
//   hard   - also counts how many tiles can still improve the hand (visible tiles are subtracted) and estimates discard danger
import { shanten } from './rules.js'
import { KINDS, countsOf, isHonor, isDragon, isWind, isTerminal, isSuited, numOf, WINDS } from './tiles.js'

const clone = (c) => ({ ...c })
const sh = (counts, melds) => shanten(counts, melds)

// how useful a tile is to keep, ignoring shanten (neighbours, pairs, value honours)
function keepValue(k, counts, view) {
  const n = counts[k] || 0
  let v = n >= 3 ? 8 : n === 2 ? 5 : 0
  if (isHonor(k)) {
    const valuable = isDragon(k) || k === WINDS[view.seatWind] || k === WINDS[view.prevailing]
    v += n >= 2 ? (valuable ? 4 : 1) : valuable ? 0.5 : -2
  } else {
    const s = k[0], x = numOf(k)
    const near = (d) => counts[s + (x + d)] || 0
    v += near(-1) * 2 + near(1) * 2 + near(-2) + near(2)
    if (x >= 3 && x <= 7) v += 1
    if (isTerminal(k)) v -= 1.5
  }
  return v
}

// how dangerous it is to throw this kind (higher = more likely to be a winning tile for somebody)
function danger(k, view) {
  const seen = view.visibleCounts[k] || 0
  let d = isHonor(k) ? 1.2 : isTerminal(k) ? 1.6 : 3 + (numOf(k) >= 4 && numOf(k) <= 6 ? 1.5 : 0)
  d *= Math.max(0.15, 1 - seen * 0.3)
  const flush = view.others.some((o) => o.seat !== view.seat && o.melds.length >= 2)
  if (flush) d *= 1.5
  // a tile the opponents have just thrown themselves is the safest thing to throw
  const thrown = view.others.some((o) => o.seat !== view.seat && o.discards.some((t) => t.k === k))
  if (thrown) d *= 0.35
  return d
}

function improvementTiles(counts, melds, view, baseShanten) {
  let total = 0
  for (const k of KINDS) {
    const left = 4 - (view.visibleCounts[k] || 0)
    if (left <= 0) continue
    counts[k] = (counts[k] || 0) + 1
    if (sh(counts, melds) < baseShanten) total += left
    counts[k]--
  }
  return total
}

export function chooseDiscard(view, level = 'normal', rand = Math.random) {
  const hand = view.hand, melds = view.melds.length
  const counts = countsOf(hand)
  const kinds = Object.keys(counts)
  const pickTile = (k) => hand.filter((t) => t.k === k).slice(-1)[0] // prefer the most recently drawn copy of that kind
  if (level === 'easy') {
    if (rand() < 0.35) return hand[Math.floor(rand() * hand.length)]
    let best = null
    for (const k of kinds) { const v = keepValue(k, counts, view) + rand() * 3; if (best === null || v < best.v) best = { k, v } }
    return pickTile(best.k)
  }
  const cand = []
  for (const k of kinds) {
    counts[k]--
    const s = sh(counts, melds)
    let score = s * 1000 - keepValue(k, counts, view) * -1 // keepValue of what stays is added below
    let imp = 0
    if (level === 'hard' && s <= 3) imp = improvementTiles(counts, melds, view, s)
    counts[k]++
    const keep = keepValue(k, counts, view)
    score = s * 1000 + keep * 6 - imp * 7
    if (level === 'hard') score += danger(k, view) * (view.others.some((o) => o.seat !== view.seat && o.melds.length >= 2) ? 14 : 5)
    cand.push({ k, score: score + (level === 'normal' ? rand() * 4 : rand() * 0.5), s })
  }
  cand.sort((a, b) => a.score - b.score)
  return pickTile(cand[0].k)
}

// shanten after claiming: take `used` kinds out of the hand, add one fixed set, then discard the best remaining tile
function shantenAfterClaim(view, used) {
  const counts = clone(countsOf(view.hand))
  for (const k of used) counts[k]--
  const melds = view.melds.length + 1
  let best = 99
  for (const k of Object.keys(counts)) { if (counts[k] <= 0) continue; counts[k]--; best = Math.min(best, sh(counts, melds)); counts[k]++ }
  return best
}

export function decideClaim(view, options, tile, level = 'normal', rand = Math.random) {
  if (options.hu) return { action: 'hu' } // everybody takes a win
  const k = tile.k, before = sh(countsOf(view.hand), view.melds.length)
  const valueHonor = isDragon(k) || k === WINDS[view.seatWind] || k === WINDS[view.prevailing]
  if (options.kong && level !== 'easy' && (valueHonor || isHonor(k) || before <= 1)) return { action: 'kong' }
  if (options.pung) {
    if (level === 'easy') { if (valueHonor && rand() < 0.4) return { action: 'pung' } }
    else {
      const after = shantenAfterClaim(view, [k, k])
      if (valueHonor && after <= before + (level === 'hard' ? 0 : 1)) return { action: 'pung' }
      if (after < before || (after === before && view.melds.length >= 1 && level === 'hard' && isSuited(k) && false)) return { action: 'pung' }
    }
  }
  if (options.chow && level !== 'easy') {
    let best = null
    for (const pair of options.chow) { const after = shantenAfterClaim(view, pair); if (best === null || after < best.after) best = { pair, after } }
    if (best && best.after < before) return { action: 'chow', pair: best.pair }
  }
  return { action: 'pass' }
}

// does this AI want to declare a kong of kind k right now?
export function wantsKong(view, kongOpt, level = 'normal') {
  if (level === 'easy') return false
  if (view.wallLeft < 12) return false
  const counts = clone(countsOf(view.hand))
  const before = sh(counts, view.melds.length)
  counts[kongOpt.k] = Math.max(0, counts[kongOpt.k] - (kongOpt.type === 'concealed' ? 4 : 1))
  const after = sh(counts, view.melds.length + 1)
  return after <= before
}

// a plain-language hint for the human player: which tile to throw and why
export function hint(view) {
  const t = chooseDiscard(view, 'hard', () => 0.5)
  const counts = countsOf(view.hand)
  const s = sh(counts, view.melds.length)
  const left = clone(counts); left[t.k]--
  const after = sh(left, view.melds.length)
  const why = isHonor(t.k) && counts[t.k] === 1 ? 'a lone honour tile rarely joins a set' : isTerminal(t.k) && counts[t.k] === 1 ? 'a lone terminal has few ways to connect' : after < s ? 'throwing it brings you closer to a winning hand' : after === s ? 'it is the least useful tile and keeps your hand just as close to winning' : 'every tile is useful; this one is the least risky'
  return { tile: t, reason: why, shanten: after }
}
export { isWind }
