// Tong-its (Tongits): 3 players, 12 cards each (dealer 13). Melds = sets (3-4 of a kind) or runs (3+ same suit, Ace low).
// Each turn: draw from the stock, or take the top discard if it makes a meld with 2+ of your cards; meld / sapaw (lay off); discard 1.
// Win by emptying your hand (TONG-ITS), by a "Draw" challenge, or lowest deadwood when the stock runs out. Burned players pay extra.
import { CS, after, notify, shuffle, stdDeck, newId, fan, botFan, seatPos, banner, toast, celebrate, finish, registerCardGame, bank, addChips, rnd, pickOne } from './core.js'
import { sfx, speak } from '../audio.js'
import { profile, saveProfile, recordScore } from '../engine.js'

const RK = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
const rv = (c) => RK.indexOf(c.rank) + 1
export const pts = (c) => Math.min(10, rv(c))
const SO = { C: 0, S: 1, H: 2, D: 3 }
export const isSet = (cs) => cs.length >= 3 && cs.length <= 4 && cs.every((c) => c.rank === cs[0].rank) && new Set(cs.map((c) => c.suit)).size === cs.length
export function isRun(cs) {
  if (cs.length < 3 || !cs.every((c) => c.suit === cs[0].suit)) return false
  const v = cs.map(rv).sort((a, b) => a - b)
  for (let i = 1; i < v.length; i++) if (v[i] !== v[i - 1] + 1) return false
  return true
}
export const validMeld = (cs) => isSet(cs) || isRun(cs)
export const dead = (hand) => hand.reduce((a, c) => a + pts(c), 0)
const NAMES = ['YOU', 'MAYA', 'JUN']
const AVATAR = ['😎', '🦊', '🐼']
function candidateMelds(hand) {
  const out = []
  const byRank = {}, bySuit = {}
  for (const c of hand) { (byRank[c.rank] = byRank[c.rank] || []).push(c); (bySuit[c.suit] = bySuit[c.suit] || []).push(c) }
  for (const g of Object.values(byRank)) {
    if (g.length >= 3) { for (let i = 0; i < g.length; i++) out.push(g.filter((_, j) => j !== i)); if (g.length === 4) out.push(g.slice()) }
  }
  for (const g of Object.values(bySuit)) {
    const s = g.slice().sort((a, b) => rv(a) - rv(b))
    for (let i = 0; i < s.length; i++) for (let j = i + 2; j < s.length; j++) {
      const seg = s.slice(i, j + 1)
      if (isRun(seg)) out.push(seg)
    }
  }
  return out
}
export function bestMelds(hand) {
  const cand = candidateMelds(hand)
  let best = { score: 0, melds: [] }
  const rec = (start, used, melds, score) => {
    if (score > best.score) best = { score, melds: melds.slice() }
    for (let i = start; i < cand.length; i++) {
      if (cand[i].some((c) => used.has(c.id))) continue
      const u2 = new Set(used); cand[i].forEach((c) => u2.add(c.id))
      melds.push(cand[i]); rec(i + 1, u2, melds, score + dead(cand[i])); melds.pop()
    }
  }
  rec(0, new Set(), [], 0)
  return best
}
function meldWith(hand, card) {
  let best = null
  const n = hand.length
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    for (const cs of [[card, hand[i], hand[j]]]) if (validMeld(cs)) { const sc = dead(cs); if (!best || sc > best.sc) best = { cs: [hand[i], hand[j]], sc } }
    for (let k = j + 1; k < n; k++) { const cs = [card, hand[i], hand[j], hand[k]]; if (validMeld(cs)) { const sc = dead(cs); if (!best || sc > best.sc) best = { cs: [hand[i], hand[j], hand[k]], sc } } }
  }
  return best
}
const T = { players: [], stock: [], discard: [], turn: 0, dealer: 0, phase: 'idle', stake: 50, sel: new Set(), msg: '', first: true, round: 1, roundInfo: null, challenge: null, sortMode: 'suit', rot: {}, net: 0, start: 0, auto: false, drew: false }
const rotOf = (c) => T.rot[c.id] || (T.rot[c.id] = rnd(-12, 12))
const me = () => T.players[0]
const allMelds = () => T.players.flatMap((p) => p.melds)

function start(opts) {
  CS.opts = { ...opts, game: 'tongits' }
  T.stake = opts.stake || 50; T.auto = !!opts.auto
  T.players = NAMES.map((name, i) => ({ id: i, name, avatar: AVATAR[i], human: i === 0 && !opts.auto, hand: [], melds: [], chips: 1000 }))
  T.round = 1; T.net = 0; T.start = bank(); T.dealer = Math.floor(Math.random() * 3)
  newRound()
}
function newRound() {
  const d = shuffle(stdDeck())
  for (const p of T.players) { p.hand = []; p.melds = [] }
  T.stock = []; T.discard = []; T.sel = new Set(); T.roundInfo = null; T.challenge = null; T.first = true; T.rot = {}; T.drew = false
  T.phase = 'deal'; T.msg = 'Shuffling…'; sfx('cShuffle'); T.stock = d; notify()
  for (const p of T.players) if (!p.human && p.chips < 100) p.chips = 800
  const order = []
  for (let r = 0; r < 12; r++) for (let k = 0; k < 3; k++) order.push((T.dealer + 1 + k) % 3)
  order.push(T.dealer)
  order.forEach((pi, k) => after(0.4 + k * 0.08, () => { T.players[pi].hand.push(T.stock.pop()); sfx('cDeal'); notify() }))
  after(0.5 + order.length * 0.08 + 0.3, () => {
    T.turn = T.dealer; T.phase = 'action'
    banner(`ROUND ${T.round}`, `${T.players[T.dealer].name} DEALS AND DISCARDS FIRST`, '#ffe84a', 1.3)
    notify(); beginTurn()
  })
}
function beginTurn() {
  if (T.phase === 'roundOver' || T.phase === 'challenge') return
  const p = T.players[T.turn]
  T.drew = false
  T.phase = T.first && T.turn === T.dealer ? 'action' : 'draw'
  T.sel = new Set()
  if (p.human) T.msg = T.phase === 'draw' ? 'Draw from the stock, or take the discard if it makes a meld' : 'Meld if you can, then discard one card'
  else T.msg = p.name + ' is thinking…'
  notify()
  if (!p.human) after(rnd(0.9, 1.5), () => botTurn(p))
}
function drawStock(p) {
  if (!T.stock.length) { stockOut(); return null }
  const c = T.stock.pop(); p.hand.push(c); sfx('cDraw'); T.drew = true; T.phase = 'action'; return c
}
function takeDiscard(p, cs) {
  const top = T.discard.pop()
  const meld = { id: newId('m'), owner: p.id, cards: [top, ...cs] }
  p.hand = p.hand.filter((c) => !cs.includes(c))
  p.melds.push(meld); T.drew = true; T.phase = 'action'; sfx('cWild')
  toast(`${p.name} takes the ${top.rank}${{ C: '♣', S: '♠', H: '♥', D: '♦' }[top.suit]}`, '#ffe84a')
  return meld
}
function doMeld(p, cs) {
  p.hand = p.hand.filter((c) => !cs.includes(c))
  p.melds.push({ id: newId('m'), owner: p.id, cards: cs.slice().sort((a, b) => rv(a) - rv(b)) }); sfx('cPlay')
}
function sapawOnto(p, meld, cs) {
  const merged = meld.cards.concat(cs)
  meld.cards = isRun(merged) ? merged.sort((a, b) => rv(a) - rv(b)) : merged
  p.hand = p.hand.filter((c) => !cs.includes(c)); sfx('cPlay'); toast(`${p.name}: SAPAW`, '#9fd')
}
function discardCard(p, c) {
  p.hand = p.hand.filter((x) => x !== c); T.discard.push(c); sfx('cPlay')
  if (p.hand.length === 0) { tongitsWin(p); return }
  T.turn = (T.turn + 1) % 3; T.first = false
  T.sel = new Set(); notify(); after(0.55, beginTurn)
}
function botMelds(p) {
  const best = bestMelds(p.hand)
  for (const m of best.melds) doMeld(p, m)
  let changed = true
  while (changed && p.hand.length) {
    changed = false
    for (const c of p.hand.slice()) {
      const target = allMelds().find((m) => validMeld(m.cards.concat([c])) && !(isSet(m.cards) && m.cards.length >= 4))
      if (target) { sapawOnto(p, target, [c]); changed = true; break }
    }
  }
}
function discardChoice(p) {
  let best = null
  for (const c of p.hand) {
    const same = p.hand.filter((x) => x !== c && x.rank === c.rank).length
    const near = p.hand.filter((x) => x !== c && x.suit === c.suit && Math.abs(rv(x) - rv(c)) <= 2 && x.rank !== c.rank).length
    const s = pts(c) - (same * 4 + near * 3) + Math.random() * 1.5
    if (!best || s > best.s) best = { c, s }
  }
  return best.c
}
function botTurn(p) {
  if (T.phase === 'roundOver' || T.phase === 'challenge') return
  // maybe call a challenge before drawing
  if (T.phase === 'draw' && p.melds.length && !T.first) {
    const dw = dead(p.hand)
    if (dw <= 7 || (dw <= 14 && Math.random() < 0.35)) { callDraw(p); return }
  }
  if (T.phase === 'draw') {
    const top = T.discard[T.discard.length - 1]
    const mw = top ? meldWith(p.hand, top) : null
    if (mw) takeDiscard(p, mw.cs)
    else if (!drawStock(p)) return
    notify()
  }
  after(0.8, () => {
    botMelds(p); notify()
    if (!p.hand.length) { tongitsWin(p); return }
    after(0.8, () => discardCard(p, discardChoice(p)))
  })
}
// ---- endings ----
function stockOut() {
  if (T.phase === 'roundOver') return
  toast('Stock is empty!', '#ff8a96')
  const ranked = T.players.slice().sort((a, b) => dead(a.hand) - dead(b.hand))
  settle(ranked[0], T.players.filter((q) => q !== ranked[0]).map((q) => [q, 1]), 'LOWEST HAND')
}
function tongitsWin(p) {
  banner('TONG-ITS!', p.name, '#ff4de1', 1.6); sfx('cWin'); speak('Tongits!', 0.8, 1.15)
  if (p.human) celebrate()
  settle(p, T.players.filter((q) => q !== p).map((q) => [q, 2]), 'TONG-ITS')
}
function callDraw(p) {
  T.phase = 'challenge'
  T.challenge = { caller: p.id, answers: {}, waiting: [] }
  banner('DRAW!', `${p.name} CHALLENGES`, '#ffe84a', 1.4); sfx('cUno'); speak('Draw!', 0.9, 1.1)
  const mine = dead(p.hand)
  for (const q of T.players) {
    if (q === p) continue
    if (q.human) { T.challenge.waiting.push(q.id); T.msg = `${p.name} called DRAW (${mine} points). Fight or Fold?` }
    else T.challenge.answers[q.id] = dead(q.hand) < mine ? 'fight' : (dead(q.hand) === mine && Math.random() < 0.3 ? 'fight' : 'fold')
  }
  notify()
  if (!T.challenge.waiting.length) after(1.1, resolveChallenge)
}
function resolveChallenge() {
  const ch = T.challenge, caller = T.players[ch.caller]
  const fighters = T.players.filter((q) => q !== caller && ch.answers[q.id] === 'fight')
  const folders = T.players.filter((q) => q !== caller && ch.answers[q.id] === 'fold')
  toast(folders.length ? `${folders.map((f) => f.name).join(', ')} folded` : 'Everybody fights!', '#9fd')
  if (!fighters.length) { settle(caller, folders.map((q) => [q, 1]), 'ALL FOLDED'); return }
  const pool = [caller, ...fighters].sort((a, b) => dead(a.hand) - dead(b.hand) || (a === caller ? 1 : -1))
  const winner = pool[0]
  // folders pay the caller; fighters who lost pay the winner
  const pays = []
  for (const q of folders) pays.push([q, 1, caller])
  for (const q of pool.slice(1)) pays.push([q, 1, winner])
  settle(winner, pays.filter((x) => x[2] === winner).map((x) => [x[0], x[1]]), 'DRAW FIGHT', pays.filter((x) => x[2] !== winner))
}
function settle(winner, pays, kind, extra = []) {
  T.phase = 'roundOver'
  const rows = []
  let gain = 0
  const lines = [...pays.map(([q, m]) => [q, m, winner]), ...extra.map(([q, m, w]) => [q, m, w])]
  for (const [q, mult, w] of lines) {
    const burned = q.melds.length === 0
    let amt = T.stake * mult + (burned ? T.stake : 0)
    if (q.human) amt = Math.min(amt, bank())
    else amt = Math.min(amt, q.chips)
    if (q.human) addChips(-amt); else q.chips -= amt
    if (w.human) addChips(amt); else w.chips += amt
    rows.push([`${q.name} → ${w.name}`, amt, burned ? 'BURNED' : ''])
    if (w === winner) gain += amt
  }
  const humanNet = lines.reduce((a, [q, m, w]) => a + (w.human ? 1 : 0) * (T.stake * m + (q.melds.length === 0 ? T.stake : 0)) - (q.human ? 1 : 0) * (T.stake * m + (q.melds.length === 0 ? T.stake : 0)), 0)
  T.net += humanNet
  T.roundInfo = { winner: winner.id, kind, rows, gain, humanNet }
  T.dealer = winner.id
  if (kind !== 'TONG-ITS') { sfx(winner.human ? 'cWin' : 'cLose'); banner(`${winner.name} WINS`, kind, '#3dff7a', 1.8) }
  if (winner.human) { if (kind === 'TONG-ITS') { profile.tongitsWins = (profile.tongitsWins || 0) + 1; saveProfile() } celebrate() }
  T.msg = ''
  notify()
  if (T.auto) after(3, () => { T.round++; newRound() })
}
// ---- human input ----
const hand0 = () => me().hand.slice().sort((a, b) => (T.sortMode === 'suit' ? SO[a.suit] - SO[b.suit] || rv(a) - rv(b) : rv(a) - rv(b) || SO[a.suit] - SO[b.suit]))
function selCards() { return me().hand.filter((c) => T.sel.has(c.id)) }
function click(id) {
  if (!me().human) return
  const p = me()
  if (T.stock.some((c) => c.id === id)) return button('stock')
  if (T.discard.length && T.discard[T.discard.length - 1].id === id) return button('discard')
  if (T.turn !== 0) return
  const c = p.hand.find((x) => x.id === id)
  if (c) { if (T.phase !== 'action' && T.phase !== 'draw') return; if (T.sel.has(id)) T.sel.delete(id); else T.sel.add(id); sfx('cSelect'); notify(); return }
  // clicking a meld card: sapaw with the selected cards
  const meld = allMelds().find((m) => m.cards.some((x) => x.id === id))
  if (meld && T.phase === 'action') {
    const cs = selCards()
    if (!cs.length) { toast('Select card(s) from your hand first', '#ff8a96'); sfx('cBad'); return }
    if (!validMeld(meld.cards.concat(cs))) { toast('Those cards do not fit that meld', '#ff8a96'); sfx('cBad'); return }
    sapawOnto(p, meld, cs); T.sel = new Set()
    if (!p.hand.length) { tongitsWin(p); return }
    notify()
  }
}
function button(name) {
  const p = me()
  if (name === 'sort') { T.sortMode = T.sortMode === 'suit' ? 'rank' : 'suit'; sfx('cShuffle'); notify(); return }
  if (name === 'next') { if (T.phase === 'roundOver') { T.round++; newRound() } return }
  if (name === 'cash') {
    const chips = bank(); recordScore('tongits', chips)
    profile.cardGames = (profile.cardGames || 0) + 1; if (T.net > 0) profile.cardWins = (profile.cardWins || 0) + 1; saveProfile()
    finish({ title: T.net >= 0 ? 'CASHED OUT AHEAD!' : 'CASHED OUT', win: T.net > 0, rows: [['STARTED WITH', T.start], ['NOW HAVE', chips], ['NET', T.net]], score: chips, game: 'tongits' })
    if (T.net > 0) celebrate(); return
  }
  if (T.phase === 'challenge' && T.challenge && T.challenge.waiting.includes(0)) {
    if (name === 'fight' || name === 'fold') {
      T.challenge.answers[0] = name; T.challenge.waiting = T.challenge.waiting.filter((x) => x !== 0)
      toast(name === 'fight' ? 'You FIGHT!' : 'You fold', '#ffe84a'); sfx('cSelect'); notify(); after(1, resolveChallenge)
    }
    return
  }
  if (T.turn !== 0 || !p.human) return
  if (name === 'stock' && T.phase === 'draw') { drawStock(p); T.msg = 'Meld if you can, then discard one card'; notify(); return }
  if (name === 'discard' && T.phase === 'draw') {
    const top = T.discard[T.discard.length - 1]
    if (!top) return
    const sel = selCards()
    let cs = null
    if (sel.length >= 2 && validMeld([top, ...sel])) cs = sel
    else { const mw = meldWith(p.hand, top); if (mw) cs = mw.cs }
    if (!cs) { toast('That discard does not make a meld with your cards', '#ff8a96'); sfx('cBad'); return }
    takeDiscard(p, cs); T.sel = new Set(); T.msg = 'Meld more, sapaw, then discard one card'
    if (!p.hand.length) { tongitsWin(p); return }
    notify(); return
  }
  if (name === 'call' && T.phase === 'draw') {
    if (!p.melds.length) { toast('You need an exposed meld to call Draw', '#ff8a96'); sfx('cBad'); return }
    callDraw(p); return
  }
  if (name === 'meld' && T.phase === 'action') {
    const cs = selCards()
    if (!validMeld(cs)) { toast('Not a valid meld (set of 3-4 same rank, or run of 3+ same suit)', '#ff8a96'); sfx('cBad'); return }
    doMeld(p, cs); T.sel = new Set(); T.msg = 'Meld more, sapaw, or discard one card'
    if (!p.hand.length) { tongitsWin(p); return }
    notify(); return
  }
  if (name === 'auto' && T.phase === 'action') {
    const best = bestMelds(p.hand)
    if (!best.melds.length) { toast('No melds in your hand yet', '#9fd'); return }
    for (const m of best.melds) doMeld(p, m)
    toast(`Auto-melded ${best.melds.length}`, '#3dff7a')
    if (!p.hand.length) { tongitsWin(p); return }
    notify(); return
  }
  if (name === 'discardsel' && T.phase === 'action') {
    const cs = selCards()
    if (cs.length !== 1) { toast('Select exactly one card to discard', '#ff8a96'); sfx('cBad'); return }
    discardCard(p, cs[0])
  }
}
function snap() {
  const cards = []
  const myTurn = T.turn === 0 && me().human && (T.phase === 'draw' || T.phase === 'action')
  hand0().forEach((c, i) => {
    const f = fan(me().hand.length, i, { cx: 50, cy: 86, spread: 5.0, max: 56, arc: 1.2, curve: 0.2 })
    cards.push({ id: c.id, face: c, x: f.x, y: T.sel.has(c.id) ? f.y - 5 : f.y, rot: f.rot, s: 1, z: 30 + i, up: true, mine: true, sel: T.sel.has(c.id) })
  })
  T.players.forEach((p, pi) => {
    if (pi === 0) return
    const seat = seatPos(pi, 3)
    p.hand.forEach((c, i) => { const f = botFan(p.hand.length, i, seat, 0.5); cards.push({ id: c.id, face: c, x: f.x, y: f.y + 6, rot: f.rot, s: f.s, z: 10 + i, up: T.phase === 'roundOver' }) })
  })
  // melds (face up, small)
  const anchor = (pi, i) => (pi === 0 ? { x: 12 + (i % 3) * 25, y: 63 + Math.floor(i / 3) * 9 } : pi === 1 ? { x: 21 + (i % 2) * 18, y: 17 + Math.floor(i / 2) * 11 } : { x: 62 + (i % 2) * 18, y: 17 + Math.floor(i / 2) * 11 })
  T.players.forEach((p, pi) => p.melds.forEach((m, mi) => { const a = anchor(pi, mi); m.cards.forEach((c, k) => cards.push({ id: c.id, face: c, x: a.x + k * 2.6, y: a.y, rot: 0, s: pi === 0 ? 0.62 : 0.5, z: 5 + k, up: true, glow: T.phase === 'action' && T.turn === 0 && T.sel.size > 0 && validMeld(m.cards.concat(selCards())) })) }))
  const placed = new Set(cards.map((c) => c.id))
  T.discard.forEach((c, i) => { const top = i === T.discard.length - 1; cards.push({ id: c.id, face: c, x: 57 + (i % 4) * 0.12, y: 44 + (i % 3) * 0.1, rot: rotOf(c), s: 1, z: 2 + i * 0.01, up: true, glow: top && myTurn && T.phase === 'draw' }); placed.add(c.id) })
  T.stock.forEach((c, i) => { cards.push({ id: c.id, face: c, x: 43 + i * 0.015, y: 44 - i * 0.015, rot: 0, s: 1, z: 1 + i * 0.001, up: false, glow: myTurn && T.phase === 'draw' && i === T.stock.length - 1 }); placed.add(c.id) })
  const seats = T.players.map((p, i) => { const pos = seatPos(i, 3); return { id: i, name: p.name, avatar: p.avatar, x: pos.x, y: i === 0 ? 96 : pos.y + 21, chips: p.human ? bank() : p.chips, count: p.hand.length, turn: (T.phase === 'draw' || T.phase === 'action') && T.turn === i, human: p.human, score: dead(p.hand), tag: T.phase === 'roundOver' && T.roundInfo ? (T.roundInfo.winner === i ? 'WINNER' : '') : '', note: p.melds.length ? '' : T.first ? '' : 'NO MELD' } })
  const buttons = []
  if (me().human) {
    if (T.phase === 'draw') buttons.push({ name: 'call', label: 'CALL DRAW', off: !myTurn || !me().melds.length })
    if (T.phase === 'action') {
      const sel = selCards()
      buttons.push({ name: 'meld', label: 'MELD', hot: true, off: !myTurn || !validMeld(sel), pulse: myTurn && validMeld(sel) })
      buttons.push({ name: 'auto', label: 'AUTO MELD', off: !myTurn || !bestMelds(me().hand).melds.length })
      buttons.push({ name: 'discardsel', label: 'DISCARD', hot: true, off: !myTurn || sel.length !== 1, pulse: myTurn && sel.length === 1 })
    }
    if (T.phase === 'challenge' && T.challenge && T.challenge.waiting.includes(0)) { buttons.push({ name: 'fight', label: 'FIGHT ⚔', hot: true, pulse: true }); buttons.push({ name: 'fold', label: 'FOLD', hot: true }) }
    if (T.phase === 'roundOver') buttons.push({ name: 'next', label: 'NEXT ROUND ▶', hot: true, pulse: true })
    buttons.push({ name: 'sort', label: T.sortMode === 'suit' ? 'SORT: SUIT' : 'SORT: RANK' })
    if (T.phase !== 'deal') buttons.push({ name: 'cash', label: 'CASH OUT' })
  }
  return { phase: T.phase, msg: T.msg, seats, cards, buttons, deckClick: true, info: `ROUND ${T.round} · STAKE ${T.stake} · NET ${T.net >= 0 ? '+' : ''}${T.net}`, stock: T.stock.length, roundInfo: T.roundInfo, myPoints: dead(me().hand) }
}
registerCardGame({ id: 'tongits', name: 'TONG-ITS', start, snap, click, button })
