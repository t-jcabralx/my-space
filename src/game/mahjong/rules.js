// MAHJONG rules: hand structure, winning-hand detection, claim legality and a shanten (distance-to-win) estimate.
// Everything here is pure: it only looks at tiles, so it can be tested without any interface.
import { KINDS, IDX, ORPHANS, isSuited, numOf, suitOf, isBonus, countsOf } from './tiles.js'

const next = (k, n = 1) => (isSuited(k) && numOf(k) + n <= 9 ? k[0] + (numOf(k) + n) : null)

// ---- standard hand: N sets (pung or chow) + one pair ------------------------------------------------------------------
// Returns every way to split `counts` (concealed tiles only) into `sets` sets and exactly one pair.
// Kinds are consumed in canonical order, always starting from the lowest tile left, so each split is found once.
export function decompositions(counts, sets) {
  const c = { ...counts }, out = [], cur = []
  const first = () => { for (const k of KINDS) if (c[k] > 0) return k; return null }
  function rec(pair) {
    const k = first()
    if (k === null) { if (pair && cur.length === sets) out.push({ sets: cur.slice(), pair }); return }
    if (cur.length > sets) return
    if (c[k] >= 3 && cur.length < sets) { c[k] -= 3; cur.push({ t: 'pung', k }); rec(pair); cur.pop(); c[k] += 3 }
    const k2 = next(k), k3 = next(k, 2)
    if (k2 && k3 && c[k2] > 0 && c[k3] > 0 && cur.length < sets) { c[k]--; c[k2]--; c[k3]--; cur.push({ t: 'chow', k }); rec(pair); cur.pop(); c[k]++; c[k2]++; c[k3]++ }
    if (c[k] >= 2 && !pair) { c[k] -= 2; rec(k); c[k] += 2 }
  }
  rec(null)
  return out
}

// ---- thirteen orphans (十三么): one of each terminal and honour, plus a copy of any of them as the pair ---------------
export function isThirteenOrphans(counts, meldCount = 0) {
  if (meldCount > 0) return false
  let total = 0, pair = false
  for (const k of Object.keys(counts)) { if (counts[k] > 0 && !ORPHANS.includes(k)) return false; total += counts[k] }
  if (total !== 14) return false
  for (const k of ORPHANS) { if (!counts[k]) return false; if (counts[k] === 2) { if (pair) return false; pair = true } else if (counts[k] !== 1) return false }
  return pair
}

// Is this concealed hand (+ exposed melds) a winning hand? The number of tiles is only a precondition: the structure decides.
// concealed: tiles in hand including the winning tile; melds: exposed or concealed-kong melds already made.
export function winInfo(concealed, melds = []) {
  if (concealed.some((t) => isBonus(t.k))) return { win: false }
  const need = 3 * (4 - melds.length) + 2
  if (concealed.length !== need) return { win: false }
  const counts = countsOf(concealed)
  if (isThirteenOrphans(counts, melds.length)) return { win: true, kind: 'orphans', decomps: [] }
  const d = decompositions(counts, 4 - melds.length)
  return d.length ? { win: true, kind: 'standard', decomps: d } : { win: false }
}

// the kinds that would complete a 13-tile hand (its "waits"); a kind with all four copies already visible cannot be drawn
export function waits(concealed, melds = [], visibleCounts = {}) {
  const out = []
  const have = countsOf(concealed)
  for (const k of KINDS) {
    if ((have[k] || 0) + (visibleCounts[k] || 0) >= 4) continue
    if (winInfo([...concealed, { id: -1, k }], melds).win) out.push(k)
  }
  return out
}

// ---- claims -----------------------------------------------------------------------------------------------------------
// chow: only the player after the discarder may claim, only suited tiles. Returns the two kinds from the hand for each way.
export function chowOptions(hand, k) {
  if (!isSuited(k)) return []
  const c = countsOf(hand), n = numOf(k), s = suitOf(k), out = []
  const has = (m) => m >= 1 && m <= 9 && c[s + m] > 0
  if (has(n - 2) && has(n - 1)) out.push([s + (n - 2), s + (n - 1)])
  if (has(n - 1) && has(n + 1)) out.push([s + (n - 1), s + (n + 1)])
  if (has(n + 1) && has(n + 2)) out.push([s + (n + 1), s + (n + 2)])
  return out
}
export const canPung = (hand, k) => hand.filter((t) => t.k === k).length >= 2
export const canKongDiscard = (hand, k) => hand.filter((t) => t.k === k).length >= 3
export const concealedKongKinds = (hand) => { const c = countsOf(hand); return Object.keys(c).filter((k) => c[k] === 4) }
export const addedKongKinds = (hand, melds) => melds.filter((m) => m.type === 'pung' && hand.some((t) => t.k === m.k)).map((m) => m.k)

// ---- shanten: how many tile changes a hand is away from being ready (-1 = complete, 0 = ready/tenpai) ---------------
// Standard hands only; used by the AI to judge discards. meldCount = sets already fixed by exposed melds.
export function shanten(counts, meldCount = 0) {
  const c = KINDS.map((k) => counts[k] || 0)
  let best = 8 - 2 * meldCount
  function dfs(i, sets, partials, pair) {
    while (i < 34 && c[i] === 0) i++
    if (i >= 34) { const p = Math.min(partials, 4 - sets - meldCount); const v = 8 - 2 * (sets + meldCount) - p - (pair ? 1 : 0); if (v < best) best = v; return }
    if (c[i] >= 3) { c[i] -= 3; dfs(i, sets + 1, partials, pair); c[i] += 3 }
    const suited = i < 27, n = i % 9
    if (suited && n <= 6 && c[i + 1] > 0 && c[i + 2] > 0) { c[i]--; c[i + 1]--; c[i + 2]--; dfs(i, sets + 1, partials, pair); c[i]++; c[i + 1]++; c[i + 2]++ }
    if (c[i] >= 2 && !pair) { c[i] -= 2; dfs(i, sets, partials, true); c[i] += 2 }
    if (c[i] >= 2) { c[i] -= 2; dfs(i, sets, partials + 1, pair); c[i] += 2 }
    if (suited && n <= 7 && c[i + 1] > 0) { c[i]--; c[i + 1]--; dfs(i, sets, partials + 1, pair); c[i]++; c[i + 1]++ }
    if (suited && n <= 6 && c[i + 2] > 0) { c[i]--; c[i + 2]--; dfs(i, sets, partials + 1, pair); c[i]++; c[i + 2]++ }
    c[i]--; dfs(i, sets, partials, pair); c[i]++
  }
  dfs(0, 0, 0, false)
  if (meldCount === 0) { // thirteen orphans
    let kinds = 0, pair = false
    for (const k of ORPHANS) { if (counts[k] > 0) { kinds++; if (counts[k] >= 2) pair = true } }
    best = Math.min(best, 13 - kinds - (pair ? 1 : 0))
  }
  return best
}
export { IDX }
