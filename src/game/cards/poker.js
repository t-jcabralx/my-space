// TEXAS HOLD'EM POKER: 2 hole cards, 5 community cards, four betting rounds, best five-card hand wins the pot.
// Blinds 10/20. Bets are capped at what your opponents can match, so there are no side pots. Chips come from the shared bank.
import { CS, after, notify, shuffle, stdDeck, banner, toast, celebrate, finish, registerCardGame, bank, addChips } from './core.js'
import { sfx, speak } from '../audio.js'
import { profile, saveProfile, recordScore } from '../engine.js'

const RV = { 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, J: 11, Q: 12, K: 13, A: 14 }
const HAND = ['HIGH CARD', 'PAIR', 'TWO PAIR', 'THREE OF A KIND', 'STRAIGHT', 'FLUSH', 'FULL HOUSE', 'FOUR OF A KIND', 'STRAIGHT FLUSH']
// rank a 5-card hand: [category, ...tiebreakers]
export function rank5(cs) {
  const v = cs.map((c) => RV[c.rank]).sort((a, b) => b - a), flush = cs.every((c) => c.suit === cs[0].suit)
  const cnt = {}; for (const x of v) cnt[x] = (cnt[x] || 0) + 1
  const groups = Object.entries(cnt).map(([k, n]) => [n, +k]).sort((a, b) => b[0] - a[0] || b[1] - a[1])
  let straight = false, hi = v[0]
  const uniq = [...new Set(v)]
  if (uniq.length === 5) { if (v[0] - v[4] === 4) straight = true; else if (v[0] === 14 && v[1] === 5 && v[4] === 2) { straight = true; hi = 5 } }
  if (straight && flush) return [8, hi]
  if (groups[0][0] === 4) return [7, groups[0][1], groups[1][1]]
  if (groups[0][0] === 3 && groups[1][0] === 2) return [6, groups[0][1], groups[1][1]]
  if (flush) return [5, ...v]
  if (straight) return [4, hi]
  if (groups[0][0] === 3) return [3, groups[0][1], ...groups.slice(1).map((g) => g[1])]
  if (groups[0][0] === 2 && groups[1][0] === 2) return [2, groups[0][1], groups[1][1], groups[2][1]]
  if (groups[0][0] === 2) return [1, groups[0][1], ...groups.slice(1).map((g) => g[1])]
  return [0, ...v]
}
export const cmp = (a, b) => { for (let i = 0; i < Math.max(a.length, b.length); i++) { const d = (a[i] || 0) - (b[i] || 0); if (d) return d } return 0 }
export function best7(cs) {
  if (cs.length < 5) return [0, ...cs.map((c) => RV[c.rank]).sort((a, b) => b - a)]
  let best = null
  const n = cs.length, pick = []
  const rec = (start) => { if (pick.length === 5) { const r = rank5(pick.map((i) => cs[i])); if (!best || cmp(r, best) > 0) best = r; return } for (let i = start; i < n; i++) { pick.push(i); rec(i + 1); pick.pop() } }
  rec(0)
  return best
}
const strengthPre = (h) => { const a = RV[h[0].rank], b = RV[h[1].rank], hi = Math.max(a, b), lo = Math.min(a, b); let s = (hi + lo) / 28; if (a === b) s += 0.45 + hi / 40; if (h[0].suit === h[1].suit) s += 0.07; if (hi - lo <= 2) s += 0.05; return Math.min(1, s) }

const BOTS = [['MAYA', '🦊'], ['JUN', '🐼'], ['BEA', '🐸']]
const SB = 10, BB = 20
const L = { phase: 'idle', deck: [], players: [], board: [], pot: 0, cur: 0, act: -1, dealer: 0, round: 1, results: {}, net: 0, sessionStart: 0, msg: '', street: 0, minRaise: BB, gen: 0, lastWin: '' }
let ACTOR = 0
const HIDDEN = { id: 'h', kind: 'std', rank: '?', suit: 'S' }
const actor = () => L.players[ACTOR]
const banked = (p) => p.human && !CS.online && !p.auto
const chipsOf = (p) => (banked(p) ? bank() : p.chips)
const adj = (p, n) => { if (banked(p)) addChips(n); else p.chips += n }
const live = () => L.players.filter((p) => p.human && !p.auto)
const inHand = () => L.players.filter((p) => !p.folded)
const canAct = () => L.players.filter((p) => !p.folded && !p.allin)

function start(opts) {
  CS.opts = { ...opts, game: 'poker' }
  ACTOR = 0
  const hs = opts.humans || [{ name: 'YOU' }]
  const count = Math.min(4, Math.max(2, hs.length + (opts.bots === undefined ? 3 : opts.bots)))
  const bn = BOTS.slice()
  L.players = []
  for (let i = 0; i < count; i++) {
    const h = hs[i]
    if (h) L.players.push({ id: i, name: h.name, avatar: ['😎', '🦁', '🐯', '🦄'][i], human: true, cid: h.cid || null, chips: 1000, hole: [], bet: 0, total: 0 })
    else { const [n, a] = bn.shift(); L.players.push({ id: i, name: n, avatar: a, human: false, chips: 1000, hole: [], bet: 0, total: 0, style: 0.8 + Math.random() * 0.5 }) }
  }
  if (opts.auto) { L.players[0].human = false; L.players[0].auto = true; L.players[0].style = 1 }
  L.round = 1; L.net = 0; L.sessionStart = bank(); L.dealer = Math.floor(Math.random() * count)
  newHand()
}
function newHand() {
  L.gen++
  const gen = L.gen
  if (live().some((p) => banked(p) && bank() < BB)) { L.phase = 'broke'; L.msg = 'You are out of chips! Take a loan to keep playing.'; notify(); return }
  for (const p of L.players) { if (!p.human && p.chips < BB * 3) p.chips = 800; if (p.human && !banked(p) && p.chips < BB * 3) p.chips = 800 }
  L.deck = shuffle(stdDeck()); L.board = []; L.pot = 0; L.results = {}; L.street = 0; L.lastWin = ''
  for (const p of L.players) { p.hole = []; p.bet = 0; p.total = 0; p.folded = false; p.allin = false; p.acted = false; p.shown = false; p.rank = null }
  L.dealer = (L.dealer + 1) % L.players.length
  const n = L.players.length, sbI = n === 2 ? L.dealer : (L.dealer + 1) % n, bbI = n === 2 ? (L.dealer + 1) % n : (L.dealer + 2) % n
  put(L.players[sbI], SB); put(L.players[bbI], BB)
  L.cur = BB; L.minRaise = BB
  L.phase = 'deal'; L.msg = 'Dealing…'; notify(); sfx('cShuffle')
  let t = 0.3
  for (let r = 0; r < 2; r++) for (let k = 0; k < n; k++) { const p = L.players[(L.dealer + 1 + k) % n]; after(t, () => { p.hole.push(L.deck.pop()); sfx('cDeal'); notify() }); t += 0.22 }
  after(t + 0.3, () => { if (L.gen === gen) startRound((bbI + 1) % n) })
}
// put chips into the pot (never more than the player has)
function put(p, amt) { const a = Math.min(amt, chipsOf(p)); adj(p, -a); p.bet += a; p.total += a; L.pot += a; if (chipsOf(p) <= 0) p.allin = true; return a }
function startRound(first) {
  L.phase = 'bet'; for (const p of L.players) { if (L.street > 0) p.bet = 0; p.acted = false }
  if (L.street > 0) { L.cur = 0; L.minRaise = BB }
  L.act = nextActor(first - 1)
  nextTurn()
}
function nextActor(from) {
  const n = L.players.length
  for (let k = 1; k <= n; k++) { const i = ((from + k) % n + n) % n; const p = L.players[i]; if (!p.folded && !p.allin) return i }
  return -1
}
function roundDone() {
  const a = canAct()
  if (inHand().length <= 1) return true
  if (!a.length) return true
  if (a.length === 1 && a[0].bet >= L.cur && a[0].acted) return true
  return a.every((p) => p.acted && p.bet >= L.cur)
}
function nextTurn() {
  if (roundDone()) return endRound()
  if (L.act < 0) return endRound()
  const p = L.players[L.act]
  const gen = L.gen
  L.msg = p.human && !p.auto ? (L.cur > p.bet ? `Call ${Math.min(L.cur - p.bet, chipsOf(p))}, raise or fold` : 'Check or bet') : `${p.name} is thinking…`
  notify()
  if (!p.human || p.auto) after(0.8 + Math.random() * 0.8, () => { if (L.gen === gen && L.act === p.id && L.phase === 'bet') botDecide(p) })
}
function cap(p) { // the most anybody can add this round: what the richest opponent still in the hand can match
  const others = L.players.filter((q) => q !== p && !q.folded).map((q) => q.bet + chipsOf(q))
  const room = others.length ? Math.max(...others) : 0
  return Math.max(0, Math.min(chipsOf(p), room - p.bet))
}
function act(p, kind, amt = 0) {
  if (L.phase !== 'bet' || L.act !== p.id) return
  const toCall = Math.max(0, L.cur - p.bet)
  if (kind === 'fold') { p.folded = true; toast(`${p.name} folds`, '#9fb4d8'); sfx('cPass') }
  else if (kind === 'check') { if (toCall > 0) return; toast(`${p.name} checks`, '#9fd'); sfx('cSelect') }
  else if (kind === 'call') { const a = put(p, toCall); toast(`${p.name} calls ${a}`, '#9fd'); sfx('cChip') }
  else if (kind === 'raise') {
    const extra = Math.max(L.minRaise, amt)
    const want = Math.min(toCall + extra, cap(p))
    const a = put(p, want)
    if (p.bet > L.cur) { L.minRaise = Math.max(L.minRaise, p.bet - L.cur); L.cur = p.bet; for (const q of L.players) if (q !== p) q.acted = false }
    toast(`${p.name} ${chipsOf(p) <= 0 ? 'goes ALL IN' : 'raises to ' + p.bet}`, '#ffe84a'); sfx('cChip'); void a
  }
  p.acted = true
  L.act = nextActor(p.id)
  notify()
  after(0.35, nextTurn)
}
function botDecide(p) {
  const toCall = Math.max(0, L.cur - p.bet), n = inHand().length
  let str
  if (L.board.length < 3) str = strengthPre(p.hole)
  else { const r = best7([...p.hole, ...L.board]); str = Math.min(1, 0.18 + r[0] * 0.17 + (r[0] === 0 ? (r[1] || 0) / 70 : 0) + (r[0] === 1 ? r[1] / 90 : 0)) }
  str *= p.style || 1
  const pot = L.pot, odds = toCall / Math.max(1, pot + toCall), room = cap(p)
  const rnd = Math.random()
  if (toCall === 0) { if (str > 0.62 && rnd < 0.55 && room > 0) return act(p, 'raise', Math.round((pot * (0.3 + str * 0.5)) / 10) * 10 || BB); if (str > 0.45 && rnd < 0.2 && room > 0) return act(p, 'raise', BB * 2); return act(p, 'check') }
  if (str < odds * 1.15 && !(rnd < 0.07 && n <= 3)) return act(p, 'fold')
  if (str > 0.72 && rnd < 0.45 && room > toCall) return act(p, 'raise', Math.round((pot * (0.4 + str * 0.5)) / 10) * 10 || BB)
  return act(p, 'call')
}
function endRound() {
  const gen = L.gen
  if (inHand().length <= 1) return showdown()
  L.street++
  if (L.street > 3 || canAct().length <= 1 && false) return showdown()
  const reveal = L.street === 1 ? 3 : 1
  L.phase = 'deal'; L.msg = ['', 'THE FLOP', 'THE TURN', 'THE RIVER'][L.street]; notify()
  for (let k = 0; k < reveal; k++) after(0.4 + k * 0.35, () => { L.board.push(L.deck.pop()); sfx('cFlip'); notify() })
  after(0.4 + reveal * 0.35 + 0.5, () => {
    if (L.gen !== gen) return
    if (canAct().length <= 1) { return endRoundAuto() }
    startRound(nextActor(L.dealer))
  })
}
function endRoundAuto() { // everybody is all-in: run the board out
  const gen = L.gen
  const go = () => { if (L.gen !== gen) return; if (L.board.length >= 5) return showdown(); L.board.push(L.deck.pop()); sfx('cFlip'); notify(); after(0.8, go) }
  after(0.5, go)
}
function showdown() {
  const gen = L.gen
  L.phase = 'showdown'
  const alive = inHand()
  for (const p of L.players) p.shown = !p.folded
  let winners = alive
  if (alive.length > 1) {
    while (L.board.length < 5) L.board.push(L.deck.pop())
    for (const p of alive) p.rank = best7([...p.hole, ...L.board])
    const top = alive.reduce((a, p) => (cmp(p.rank, a) > 0 ? p.rank : a), alive[0].rank)
    winners = alive.filter((p) => cmp(p.rank, top) === 0)
    L.lastWin = HAND[top[0]]
  } else L.lastWin = 'EVERYONE FOLDED'
  const share = Math.floor(L.pot / winners.length)
  L.results = {}
  for (const p of L.players) {
    const won = winners.includes(p) ? share : 0
    const net = won - p.total
    if (won) adj(p, won)
    L.results[p.id] = { net, label: won ? 'WIN' : p.folded ? 'FOLD' : 'LOSE' }
    if (p.id === 0) L.net += net
  }
  L.msg = winners.map((w) => w.name).join(' & ') + ' win' + (winners.length === 1 ? 's' : '') + ' ' + share + (L.lastWin ? ' · ' + L.lastWin : '')
  const me = L.players[0]
  if (me.human && !me.auto) {
    const r = L.results[0]
    if (r.label === 'WIN') { sfx('cWin'); banner('YOU WIN!', `+${r.net} · ${L.lastWin}`, '#3dff7a', 1.8); speak('You win!', 0.9, 1.1); if (r.net >= 200) celebrate() }
    else if (r.label === 'LOSE') { sfx('cLose'); banner('YOU LOSE', `${r.net} CHIPS`, '#ff6a6a', 1.5) }
  }
  notify()
  if (!live().length) after(3.2, () => { if (L.gen === gen) { L.round++; newHand() } })
  else if (CS.online) after(8, () => { if (L.gen === gen && L.phase === 'showdown') { L.round++; newHand() } })
}
function button(name, arg) {
  const me = actor()
  if (!me) return
  if (name === 'fold') return act(me, 'fold')
  if (name === 'check') return act(me, 'check')
  if (name === 'call') return act(me, 'call')
  if (name === 'raise') return act(me, 'raise', arg)
  if (name === 'allin') return act(me, 'raise', 1e9)
  if (name === 'next') { if (L.phase === 'showdown' && ACTOR === 0) { L.round++; newHand() } return }
  if (name === 'loan') { if (banked(me) && bank() < BB) { addChips(500); toast('Loan: +500 chips', '#ffe84a'); sfx('cChip'); newHand() } return }
  if (name === 'cash') {
    if (ACTOR !== 0) return
    if (CS.online) {
      const rows = L.players.filter((p) => p.human).map((p) => [p.name, p.chips]).sort((a, b) => b[1] - a[1])
      const top = L.players.filter((p) => p.human).sort((a, b) => b.chips - a.chips)[0]
      finish({ title: `${top.name} LEADS WITH ${top.chips}`, win: false, rows, score: 0, game: 'poker', winner: top.id, winnerCid: top.cid || null, scores: L.players.map((p) => ({ cid: p.cid || null, score: p.human ? p.chips : 0 })), chipsMode: true })
      return
    }
    const chips = bank(); recordScore('poker', chips)
    profile.cardGames = (profile.cardGames || 0) + 1; if (L.net > 0) profile.cardWins = (profile.cardWins || 0) + 1; saveProfile()
    finish({ title: L.net >= 0 ? 'CASHED OUT AHEAD!' : 'CASHED OUT', win: L.net > 0, rows: [['STARTED WITH', L.sessionStart], ['NOW HAVE', chips], ['NET', L.net]], score: chips, game: 'poker' })
    if (L.net > 0) celebrate()
  }
}
const hideC = (c) => ({ ...HIDDEN, id: c.id })
function snap(v = 0) { const prev = ACTOR; ACTOR = v; try { return snapFor(v) } finally { ACTOR = prev } }
function snapFor(v) {
  const cards = [], n = L.players.length
  const spots = n === 2 ? [{ x: 50, y: 74 }, { x: 50, y: 16 }] : n === 3 ? [{ x: 50, y: 74 }, { x: 14, y: 40 }, { x: 86, y: 40 }] : [{ x: 50, y: 74 }, { x: 13, y: 42 }, { x: 50, y: 16 }, { x: 87, y: 42 }]
  const rel = (p) => (p.id - v + n) % n
  L.players.forEach((p) => {
    const sp = spots[rel(p)], mine = p.id === v && p.human && !p.auto
    const show = mine || (L.phase === 'showdown' && p.shown && !p.folded) || (!CS.online && p.human && !p.auto)
    p.hole.forEach((c, i) => cards.push({ id: c.id, face: CS.online && !show ? hideC(c) : c, x: sp.x + (i - 0.5) * (mine ? 6 : 4.6), y: sp.y - (p.folded ? 0 : 0), rot: (i - 0.5) * 4, s: mine ? 1.05 : 0.8, z: 10 + i, up: show && !p.folded, dim: p.folded, glow: L.phase === 'showdown' && L.results[p.id] && L.results[p.id].label === 'WIN' }))
  })
  L.board.forEach((c, i) => cards.push({ id: c.id, face: c, x: 30 + i * 10, y: 44, rot: 0, s: 1.0, z: 5 + i, up: true, glow: false }))
  const seats = L.players.map((p) => {
    const sp = spots[rel(p)], mine = p.id === v, r = L.results[p.id]
    const tag = r ? `${r.label}${r.net ? ' ' + (r.net > 0 ? '+' : '') + r.net : ''}` : ''
    const note = p.folded ? 'FOLDED' : p.allin ? 'ALL IN' : p.id === L.dealer ? 'DEALER' : L.phase === 'showdown' && p.rank ? HAND[p.rank[0]] : ''
    return { id: p.id, name: p.name, avatar: p.avatar, x: sp.x, y: sp.y + (mine ? 20 : 12), chips: chipsOf(p), bet: p.bet, turn: L.phase === 'bet' && L.act === p.id, human: mine, bot: !p.human, tag, tagKind: r ? r.label : '', val: null, note }
  })
  const me = L.players[v], active = me.human && !me.auto
  const buttons = []
  if (L.phase === 'broke' && active) buttons.push({ name: 'loan', label: 'TAKE LOAN +500', hot: true, pulse: true })
  if (L.phase === 'bet' && active && L.act === v) {
    const toCall = Math.max(0, L.cur - me.bet), room = cap(me)
    buttons.push({ name: 'fold', label: 'FOLD' })
    buttons.push(toCall === 0 ? { name: 'check', label: 'CHECK', hot: true } : { name: 'call', label: `CALL ${Math.min(toCall, chipsOf(me))}`, hot: true })
    for (const a of [20, 50, 100]) buttons.push({ name: 'raise', arg: a, label: `RAISE +${a}`, off: room <= toCall || a > room - toCall && room - toCall <= 0 })
    buttons.push({ name: 'allin', label: 'ALL IN', off: room <= 0, chip: true })
  }
  if (L.phase === 'showdown' && active && v === 0) buttons.push({ name: 'next', label: 'NEXT HAND ▶', hot: true, pulse: true })
  if (active && v === 0 && L.phase !== 'deal') buttons.push({ name: 'cash', label: CS.online ? 'END TABLE' : 'CASH OUT' })
  const labels = [{ x: 50, y: 31, text: 'POT 🪙 ' + L.pot, sub: L.cur > 0 ? 'BET ' + L.cur : '', color: '#ffe84a', hot: false }]
  return { phase: L.phase, msg: L.msg, seats, cards, buttons, labels, info: `HAND ${L.round} · BLINDS ${SB}/${BB} · NET ${L.net >= 0 ? '+' : ''}${L.net}`, bet: 0 }
}
registerCardGame({ id: 'poker', name: "TEXAS HOLD'EM", start, snap, button, click() {} })
export const pokerApi = {
  setActor(i) { ACTOR = i },
  players: () => L.players,
  dropToBot(i) {
    const p = L.players[i]
    if (!p || !p.human) return
    p.human = false; p.cid = null; p.style = 1; p.name = p.name.replace(/ 🤖$/, '') + ' 🤖'
    if (L.phase === 'bet' && L.act === p.id) after(0.5, () => botDecide(p))
  },
}
