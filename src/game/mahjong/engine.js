// MAHJONG game engine: wall, dealing, turns, discards, claims (chow / pung / kong / win), bonus tiles, kongs, end of round,
// scoring and dealer rotation. Pure state in, state out: it never touches the screen, so it can be tested on its own.
//
// State shape (plain JSON, so a game can be saved and restored exactly):
//   st.wall         tiles still in the live wall (front = next draw; the last 14 are the dead wall and are never drawn normally)
//   st.players[4]   { hand: tiles, melds: [{type: 'chow'|'pung'|'kong', k, tiles, concealed?, from?}], flowers: tiles, discards: tiles }
//   st.turn         whose turn it is (the seat that must discard, or that must draw next)
//   st.phase        'discard' (turn seat holds 14 tiles) | 'claim' (a discard / added kong waits for calls) | 'over'
//   st.claims       { tile, from, kind: 'discard'|'robkong', options: {seat: {hu, kong, pung, chow:[[a,b],..]}}, decisions: {seat: action} }
//   st.result       null while playing; otherwise { type: 'win'|'draw', ... score breakdown and payments }
import { fullSet, shuffle, rng, isBonus, countsOf, sortTiles, WINDS } from './tiles.js'
import { winInfo, chowOptions, canPung, canKongDiscard, concealedKongKinds, addedKongKinds } from './rules.js'
import { scoreWin, payments, DEFAULT_OPTS } from './scoring.js'

export const DEAD_WALL = 14
export const SEATS = 4
export const seatWindOf = (st, seat) => (seat - st.dealer + SEATS) % SEATS // 0 = East ... 3 = North
export const nextSeat = (s) => (s + 1) % SEATS

export function defaultMatchOpts(o = {}) { return { ...DEFAULT_OPTS, windRounds: 1, difficulty: 'normal', seed: undefined, ...o } }

// ---- a match is a series of hands: scores, dealer, prevailing wind -----------------------------------------------------
export function newMatch(options = {}) {
  const opts = defaultMatchOpts(options)
  return { opts, scores: [0, 0, 0, 0], dealer: 0, prevailing: 0, handNo: 1, dealerStreak: 0, history: [], finished: false, rngState: opts.seed === undefined ? null : opts.seed }
}

function takeFront(st) { return st.wall.shift() }
function takeBack(st) { return st.wall.pop() }
export const liveTilesLeft = (st) => Math.max(0, st.wall.length - DEAD_WALL)

// expose any bonus tiles a player holds and replace each from the back of the wall; returns false if the wall ran out
function settleBonus(st, seat) {
  const p = st.players[seat]
  for (;;) {
    const i = p.hand.findIndex((t) => isBonus(t.k))
    if (i < 0) return true
    const [t] = p.hand.splice(i, 1)
    p.flowers.push(t); st.log.push({ seat, ev: 'bonus', k: t.k })
    if (st.wall.length === 0) return false
    p.hand.push(takeBack(st))
  }
}

export function startHand(match, seedOffset = 0) {
  const rand = match.opts.seed === undefined ? Math.random : rng((match.opts.seed + match.handNo * 7919 + seedOffset) >>> 0)
  const st = {
    wall: shuffle(fullSet(), rand), players: [0, 1, 2, 3].map(() => ({ hand: [], melds: [], flowers: [], discards: [] })),
    dealer: match.dealer, prevailing: match.prevailing, turn: match.dealer, phase: 'discard', drawn: null, claims: null, result: null, log: [],
    lastDiscard: null, kongDraw: false, opts: match.opts, handNo: match.handNo,
  }
  // deal 13 each, dealer takes a 14th
  for (let r = 0; r < 13; r++) for (let s = 0; s < SEATS; s++) st.players[(match.dealer + s) % SEATS].hand.push(takeFront(st))
  st.players[match.dealer].hand.push(takeFront(st))
  for (let s = 0; s < SEATS; s++) settleBonus(st, (match.dealer + s) % SEATS)
  for (const p of st.players) p.hand = sortTiles(p.hand)
  st.drawn = null
  return st
}

// ---- self-draw actions (the player who holds 14 tiles) ---------------------------------------------------------------
// draw the next tile for the turn seat (called when the previous player's discard was not claimed)
export function drawTile(st, seat) {
  if (st.phase === 'over') return { ok: false, reason: 'Hand is over' }
  if (st.turn !== seat || st.phase !== 'draw') return { ok: false, reason: 'Not your draw' }
  if (liveTilesLeft(st) <= 0) { finishDraw(st); return { ok: true, exhausted: true } }
  const p = st.players[seat]
  const t = takeFront(st)
  p.hand.push(t); st.drawn = t; st.kongDraw = false
  if (isBonus(t.k)) { if (!settleBonus(st, seat) || st.wall.length < DEAD_WALL) { finishDraw(st); return { ok: true, exhausted: true } } st.drawn = p.hand[p.hand.length - 1] }
  st.phase = 'discard'
  st.log.push({ seat, ev: 'draw' })
  return { ok: true, tile: st.drawn }
}

const hasWon = (st, seat, extraTile = null) => {
  const p = st.players[seat]
  const hand = extraTile ? [...p.hand, extraTile] : p.hand
  return winInfo(hand, p.melds).win
}

function context(st, seat, selfDraw, tile, flags = {}) {
  const p = st.players[seat]
  const hand = tile && !selfDraw ? [...p.hand, tile] : p.hand
  return { concealed: hand, melds: p.melds, flowers: p.flowers, seatWind: seatWindOf(st, seat), prevailing: st.prevailing, selfDraw, lastTile: liveTilesLeft(st) === 0 && !flags.skipLast, kongDraw: !!flags.kongDraw, robKong: !!flags.robKong, opts: st.opts }
}
// can this seat declare Mahjong right now by self-draw? returns the score breakdown (valid false when the fan minimum is not met)
export function selfDrawScore(st, seat) {
  if (st.phase !== 'discard' || st.turn !== seat) return null
  const sc = scoreWin(context(st, seat, true, null, { kongDraw: st.kongDraw }))
  return sc.reason === 'Not a winning hand' ? null : sc
}
export function canSelfDrawWin(st, seat) { const s = selfDrawScore(st, seat); return !!(s && s.valid) }

export function declareSelfDrawWin(st, seat) {
  const sc = selfDrawScore(st, seat)
  if (!sc) return { ok: false, reason: 'This is not a winning hand' }
  if (!sc.valid) return { ok: false, reason: sc.reason }
  finishWin(st, seat, null, true, sc)
  return { ok: true, score: sc }
}

// concealed kong (four in hand) or added kong (fourth tile onto an exposed pung)
export function kongOptions(st, seat) {
  if (st.phase !== 'discard' || st.turn !== seat) return []
  if (liveTilesLeft(st) <= 0) return []
  const p = st.players[seat]
  return [...concealedKongKinds(p.hand).map((k) => ({ k, type: 'concealed' })), ...addedKongKinds(p.hand, p.melds).map((k) => ({ k, type: 'added' }))]
}
export function declareKong(st, seat, k) {
  const opt = kongOptions(st, seat).find((o) => o.k === k)
  if (!opt) return { ok: false, reason: 'You cannot make a kong with that tile' }
  const p = st.players[seat]
  if (opt.type === 'concealed') {
    const tiles = p.hand.filter((t) => t.k === k); p.hand = p.hand.filter((t) => t.k !== k)
    p.melds.push({ type: 'kong', k, tiles, concealed: true })
    st.log.push({ seat, ev: 'kong', k, concealed: true })
    return kongReplacement(st, seat)
  }
  // added kong: other players may rob it by winning on that tile
  const tile = p.hand.find((t) => t.k === k)
  p.hand = p.hand.filter((t) => t.id !== tile.id)
  const meld = p.melds.find((m) => m.type === 'pung' && m.k === k)
  st.pendingKong = { seat, tile, meld }
  const options = {}
  for (let s = 0; s < SEATS; s++) { if (s === seat) continue; const sc = scoreWin(context(st, s, false, tile, { robKong: true })); if (sc.valid) options[s] = { hu: sc } }
  if (!Object.keys(options).length) { completeAddedKong(st); return kongReplacement(st, seat) }
  st.phase = 'claim'; st.claims = { tile, from: seat, kind: 'robkong', options, decisions: {} }
  return { ok: true, robbable: true }
}
function completeAddedKong(st) {
  const { seat, tile, meld } = st.pendingKong
  meld.type = 'kong'; meld.tiles = [...(meld.tiles || []), tile]
  st.log.push({ seat, ev: 'kong', k: tile.k, concealed: false }); st.pendingKong = null
}
// after any kong the player draws a replacement tile from the end of the wall (bonus tiles keep being replaced)
function kongReplacement(st, seat) {
  const p = st.players[seat]
  if (st.wall.length === 0) { finishDraw(st); return { ok: true, exhausted: true } }
  const t = takeBack(st); p.hand.push(t)
  if (isBonus(t.k) && !settleBonus(st, seat)) { finishDraw(st); return { ok: true, exhausted: true } }
  st.drawn = p.hand[p.hand.length - 1]; st.kongDraw = true; st.phase = 'discard'; st.turn = seat; st.claims = null
  if (st.wall.length < DEAD_WALL) { finishDraw(st); return { ok: true, exhausted: true } }
  return { ok: true, replacement: st.drawn }
}

// ---- discards and claims ----------------------------------------------------------------------------------------------
export function discardTile(st, seat, tileId) {
  if (st.phase !== 'discard') return { ok: false, reason: 'You cannot discard right now' }
  if (st.turn !== seat) return { ok: false, reason: 'It is not your turn' }
  const p = st.players[seat]
  const i = p.hand.findIndex((t) => t.id === tileId)
  if (i < 0) return { ok: false, reason: 'That tile is not in your hand' }
  const [tile] = p.hand.splice(i, 1)
  p.hand = sortTiles(p.hand); p.discards.push(tile)
  st.lastDiscard = { tile, from: seat }; st.drawn = null; st.kongDraw = false
  st.log.push({ seat, ev: 'discard', k: tile.k })
  // who may react?
  const options = {}
  for (let s = 0; s < SEATS; s++) {
    if (s === seat) continue
    const hand = st.players[s].hand, o = {}
    const sc = scoreWin(context(st, s, false, tile)); if (sc.valid) o.hu = sc
    if (liveTilesLeft(st) > 0) { if (canKongDiscard(hand, tile.k)) o.kong = true }
    if (canPung(hand, tile.k)) o.pung = true
    if (s === nextSeat(seat)) { const ch = chowOptions(hand, tile.k); if (ch.length) o.chow = ch }
    if (o.hu || o.kong || o.pung || o.chow) options[s] = o
  }
  if (Object.keys(options).length) { st.phase = 'claim'; st.claims = { tile, from: seat, kind: 'discard', options, decisions: {} }; return { ok: true, claimable: true } }
  return advanceTurn(st, seat)
}
function advanceTurn(st, fromSeat) {
  st.turn = nextSeat(fromSeat); st.phase = 'draw'; st.claims = null
  if (liveTilesLeft(st) <= 0) { finishDraw(st); return { ok: true, exhausted: true } }
  return { ok: true }
}
export const pendingClaimSeats = (st) => (st.claims ? Object.keys(st.claims.options).map(Number).filter((s) => st.claims.decisions[s] === undefined) : [])

// a seat answers the claim window with 'hu' | 'kong' | 'pung' | 'chow' | 'pass' (chow needs `pair` = the two kinds from the hand)
export function claim(st, seat, action, pair = null) {
  const c = st.claims
  if (st.phase !== 'claim' || !c) return { ok: false, reason: 'Nothing to claim' }
  const opt = c.options[seat]
  if (!opt) return { ok: false, reason: 'You cannot claim this tile' }
  if (c.decisions[seat] !== undefined) return { ok: false, reason: 'You already answered' }
  if (action === 'pass') { c.decisions[seat] = { action: 'pass' } }
  else if (action === 'hu') { if (!opt.hu) return { ok: false, reason: 'That is not a winning hand' }; c.decisions[seat] = { action: 'hu' } }
  else if (c.kind === 'robkong') return { ok: false, reason: 'You can only win or pass against a kong' }
  else if (action === 'kong') { if (!opt.kong) return { ok: false, reason: 'You cannot kong this tile' }; c.decisions[seat] = { action: 'kong' } }
  else if (action === 'pung') { if (!opt.pung) return { ok: false, reason: 'You cannot pung this tile' }; c.decisions[seat] = { action: 'pung' } }
  else if (action === 'chow') {
    if (!opt.chow) return { ok: false, reason: 'Only the next player can chow' }
    const ok = pair && opt.chow.some((o) => o[0] === pair[0] && o[1] === pair[1])
    if (!ok) return { ok: false, reason: 'That is not a valid sequence' }
    c.decisions[seat] = { action: 'chow', pair }
  } else return { ok: false, reason: 'Unknown action' }
  if (pendingClaimSeats(st).length === 0) return resolveClaims(st)
  return { ok: true, waiting: true }
}

// Priority: Mahjong beats everything; then kong/pung; then chow. If several players want to win, the one closest in turn order
// after the discarder wins ("head bump" - the other winning claims are refused).
export function resolveClaims(st) {
  const c = st.claims, from = c.from
  const bySeat = (a) => Object.keys(c.decisions).map(Number).filter((s) => c.decisions[s].action === a).sort((x, y) => ((x - from + 4) % 4) - ((y - from + 4) % 4))
  const hu = bySeat('hu')
  if (hu.length) {
    const w = hu[0]
    if (c.kind === 'robkong') { completeAddedKongAsRobbed(st) }
    const sc = scoreWin(context(st, w, false, c.tile, { robKong: c.kind === 'robkong' }))
    if (c.kind !== 'robkong') st.players[from].discards.pop()
    st.players[w].hand.push(c.tile)
    finishWin(st, w, from, false, sc, { robKong: c.kind === 'robkong' })
    return { ok: true, resolved: 'hu', seat: w }
  }
  if (c.kind === 'robkong') { completeAddedKong(st); st.claims = null; return kongReplacement(st, from) }
  const kong = bySeat('kong')[0], pung = bySeat('pung')[0], chow = bySeat('chow')[0]
  const tile = c.tile
  const take = (seat, type, extra) => {
    const p = st.players[seat], src = st.players[from]
    src.discards.pop()
    const used = []
    const want = type === 'chow' ? extra.slice() : Array(type === 'kong' ? 3 : 2).fill(tile.k)
    for (const k of want) { const i = p.hand.findIndex((t) => t.k === k); used.push(p.hand.splice(i, 1)[0]) }
    const tiles = sortTiles([...used, tile])
    p.melds.push({ type: type === 'kong' ? 'kong' : type, k: type === 'chow' ? tiles[0].k : tile.k, tiles, from, concealed: false })
    p.hand = sortTiles(p.hand); st.log.push({ seat, ev: type, k: tile.k, from })
  }
  if (kong !== undefined) { take(kong, 'kong'); st.claims = null; st.lastDiscard = null; return kongReplacement(st, kong) }
  if (pung !== undefined) { take(pung, 'pung'); st.turn = pung; st.phase = 'discard'; st.claims = null; st.drawn = null; st.kongDraw = false; st.lastDiscard = null; return { ok: true, resolved: 'pung', seat: pung } }
  if (chow !== undefined) { take(chow, 'chow', c.decisions[chow].pair); st.turn = chow; st.phase = 'discard'; st.claims = null; st.drawn = null; st.kongDraw = false; st.lastDiscard = null; return { ok: true, resolved: 'chow', seat: chow } }
  return advanceTurn(st, from)
}
// a robbed kong never happens: the pung stays a pung and the winner takes the fourth tile
function completeAddedKongAsRobbed(st) { st.pendingKong = null }

// ---- end of hand --------------------------------------------------------------------------------------------------------
function finishWin(st, winner, discarder, selfDraw, sc, extra = {}) {
  const pay = payments({ winner, discarder, selfDraw, dealer: st.dealer, points: sc.points, opts: st.opts })
  st.phase = 'over'; st.claims = null
  st.result = { type: 'win', winner, discarder, selfDraw, fan: sc.fan, points: sc.points, items: sc.items, structure: sc.structure, payments: pay, hand: st.players[winner].hand.map((t) => t.k), melds: st.players[winner].melds, robKong: !!extra.robKong }
}
function finishDraw(st) { st.phase = 'over'; st.claims = null; st.result = { type: 'draw', payments: [0, 0, 0, 0], reason: 'The wall is exhausted: nobody wins this hand.' } }

// apply a finished hand to the match: scores, dealer continuation or rotation, prevailing wind, end of match
export function finishHandInMatch(match, st) {
  const r = st.result
  if (!r) throw new Error('hand not finished')
  for (let s = 0; s < 4; s++) match.scores[s] += r.payments[s]
  match.history.push({ hand: match.handNo, dealer: match.dealer, prevailing: match.prevailing, type: r.type, winner: r.winner ?? null, fan: r.fan ?? 0, points: r.points ?? 0, selfDraw: !!r.selfDraw, items: (r.items || []).map((i) => i.name), payments: r.payments })
  const stays = r.type === 'draw' || r.winner === match.dealer // the dealer continues after winning or after a draw
  if (stays) { match.dealerStreak++ } else {
    match.dealerStreak = 0; match.dealer = nextSeat(match.dealer)
    if (match.dealer === 0) { match.prevailing++; if (match.prevailing >= match.opts.windRounds) match.finished = true } // a full circle of dealers: the next wind begins
  }
  match.handNo++
  return match
}

// ---- views for players / AI: only what that seat is allowed to see -----------------------------------------------------
export function viewFor(st, seat) {
  const visible = {}
  const note = (t) => { visible[t.k] = (visible[t.k] || 0) + 1 }
  st.players.forEach((p, s) => { p.discards.forEach(note); p.melds.forEach((m) => (m.tiles || []).forEach(note)); p.flowers.forEach(note); if (s === seat) p.hand.forEach(note) })
  return {
    seat, hand: st.players[seat].hand, melds: st.players[seat].melds, flowers: st.players[seat].flowers,
    others: st.players.map((p, s) => ({ seat: s, discards: p.discards, melds: p.melds, flowers: p.flowers, handSize: p.hand.length })),
    visibleCounts: visible, seatWind: seatWindOf(st, seat), prevailing: st.prevailing, wallLeft: liveTilesLeft(st), dealer: st.dealer, turn: st.turn,
  }
}
// ---- online play: what one seat is allowed to know, and how a client rebuilds a playable copy from it ----------------------------
// Other players' concealed tiles are never sent: only their count.
export function viewState(st, seat) {
  const c = st.claims
  return {
    phase: st.phase, turn: st.turn, dealer: st.dealer, prevailing: st.prevailing, handNo: st.handNo, wallLen: st.wall.length, kongDraw: st.kongDraw,
    players: st.players.map((p, s) => ({ hand: s === seat ? p.hand : null, handSize: p.hand.length, melds: p.melds, flowers: p.flowers, discards: p.discards })),
    claims: c ? { tile: c.tile, from: c.from, kind: c.kind, options: c.options[seat] ? { [seat]: c.options[seat] } : {}, decisions: {}, waitingOn: Object.keys(c.options).map(Number).filter((x) => c.decisions[x] === undefined) } : null,
    result: st.result, lastDiscard: st.lastDiscard,
  }
}
export function stateFromView(v, opts) {
  const players = v.players.map((p) => ({ hand: p.hand || Array.from({ length: p.handSize }, (_, i) => ({ id: -1 - i, k: '?' })), melds: p.melds, flowers: p.flowers, discards: p.discards }))
  return { wall: Array.from({ length: v.wallLen }, () => null), players, dealer: v.dealer, prevailing: v.prevailing, turn: v.turn, phase: v.phase, drawn: null, claims: v.claims, result: v.result, log: [], lastDiscard: v.lastDiscard, kongDraw: v.kongDraw, opts, handNo: v.handNo, online: true }
}
export { WINDS, countsOf }
