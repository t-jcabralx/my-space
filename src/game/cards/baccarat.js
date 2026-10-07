// BACCARAT (Punto Banco): bet on PLAYER, BANKER or TIE. Closest to 9 wins; the third-card rules are the real casino ones.
// PLAYER pays 1:1, BANKER pays 0.95:1 (5% commission), TIE pays 8:1 (a tie pushes PLAYER/BANKER bets). Chips come from the shared bank.
import { CS, after, notify, shuffle, stdDeck, banner, toast, celebrate, finish, registerCardGame, bank, addChips } from './core.js'
import { sfx, speak } from '../audio.js'
import { profile, saveProfile, recordScore } from '../engine.js'

const val = (c) => (['10', 'J', 'Q', 'K'].includes(c.rank) ? 0 : c.rank === 'A' ? 1 : +c.rank)
export const total = (h) => h.reduce((a, c) => a + val(c), 0) % 10
// returns true when the banker must draw a third card
export function bankerDraws(bt, playerThird) {
  if (playerThird === null) return bt <= 5
  if (bt <= 2) return true
  if (bt === 3) return playerThird !== 8
  if (bt === 4) return playerThird >= 2 && playerThird <= 7
  if (bt === 5) return playerThird >= 4 && playerThird <= 7
  if (bt === 6) return playerThird === 6 || playerThird === 7
  return false
}
const BOTS = [['MAYA', '🦊'], ['JUN', '🐼'], ['BEA', '🐸']]
const SIDE = { P: 'PLAYER', B: 'BANKER', T: 'TIE' }
const L = { phase: 'idle', deck: [], players: [], P: [], B: [], round: 1, results: {}, outcome: null, net: 0, sessionStart: 0, opts: {}, history: [] }
let ACTOR = 0
const HIDDEN = { id: 'h', kind: 'std', rank: '?', suit: 'S' }
const actor = () => L.players[ACTOR]
const banked = (p) => p.human && !CS.online && !p.auto
const chipsOf = (p) => (banked(p) ? bank() : p.chips)
const adj = (p, n) => { if (banked(p)) addChips(n); else p.chips += n }
const live = () => L.players.filter((p) => p.human && !p.auto)

function start(opts) {
  CS.opts = { ...opts, game: 'baccarat' }
  L.opts = opts; ACTOR = 0
  const hs = opts.humans || [{ name: 'YOU' }]
  const count = Math.min(4, hs.length + (opts.bots === undefined ? 0 : opts.bots))
  const bn = BOTS.slice()
  L.players = []
  for (let i = 0; i < count; i++) {
    const h = hs[i]
    if (h) L.players.push({ id: i, name: h.name, avatar: ['😎', '🦁', '🐯', '🦄'][i], human: true, cid: h.cid || null, bet: 0, side: 'P', chips: 1000, want: 50 })
    else { const [n, a] = bn.shift(); L.players.push({ id: i, name: n, avatar: a, human: false, bet: 0, side: 'P', chips: 1000, want: 50 }) }
  }
  L.round = 1; L.net = 0; L.sessionStart = bank(); L.history = []; L.deck = []
  if (opts.auto) { L.players[0].human = false; L.players[0].auto = true }
  L.players.forEach((p) => { p.want = banked(p) ? Math.min(50, bank()) : 50 })
  bettingPhase()
}
function bettingPhase() {
  L.phase = 'bet'; L.results = {}; L.P = []; L.B = []; L.outcome = null
  for (const p of L.players) { p.bet = 0; p.ready = !p.human || p.auto; if (!p.human && p.chips < 10) p.chips = 500; if (p.human && !banked(p) && p.chips < 10) p.chips = 500 }
  if (L.deck.length < 40) { L.deck = shuffle([...stdDeck(), ...stdDeck(), ...stdDeck(), ...stdDeck()]); sfx('cShuffle') }
  if (live().some((p) => banked(p) && bank() < 10)) { L.msg = 'You are out of chips! Take a loan to keep playing.'; notify(); return }
  for (const p of L.players) p.want = Math.max(10, Math.min(p.want, chipsOf(p)))
  L.msg = live().length ? 'Pick PLAYER, BANKER or TIE, place your bet, then DEAL' : 'Betting…'
  notify()
  if (!live().length) after(0.8, deal)
}
function deal() {
  if (L.phase !== 'bet') return
  for (const p of L.players) {
    if (p.human && !p.auto) { p.bet = Math.min(p.want, chipsOf(p)); adj(p, -p.bet); if (banked(p)) { profile.jackpot = (profile.jackpot || 1000) + Math.ceil(p.bet * 0.03); saveProfile() } }
    else { p.bet = Math.min(p.chips, [10, 20, 50, 100][Math.floor(Math.random() * 4)]); p.side = Math.random() < 0.46 ? 'P' : Math.random() < 0.88 ? 'B' : 'T' }
  }
  L.phase = 'deal'; L.msg = 'Dealing…'; sfx('cChip'); notify()
  const order = [['P', 'P'], ['B', 'B'], ['P', 'P'], ['B', 'B']]
  let t = 0.3
  for (const [k] of order) { after(t, () => { const c = L.deck.pop(); L[k].push(c); sfx('cDeal'); notify() }); t += 0.4 }
  after(t + 0.4, flipAndThird)
}
function flipAndThird() {
  L.phase = 'reveal'
  const pv = total(L.P), bv = total(L.B)
  const nat = pv >= 8 || bv >= 8
  if (nat) { L.msg = 'NATURAL ' + Math.max(pv, bv) + '!'; sfx('cWin'); notify(); after(1.4, settle); return }
  let pThird = null
  const drawP = pv <= 5
  const step2 = () => {
    if (bankerDraws(total(L.B), pThird)) after(0.7, () => { L.B.push(L.deck.pop()); sfx('cDraw'); toast('Banker draws', '#ff6a6a'); notify(); after(0.9, settle) })
    else after(0.7, () => { toast('Banker stands', '#ff6a6a'); after(0.5, settle) })
  }
  L.msg = 'Player ' + pv + ' · Banker ' + bv; notify()
  if (drawP) after(0.9, () => { const c = L.deck.pop(); L.P.push(c); pThird = val(c); sfx('cDraw'); toast('Player draws', '#3de8ff'); notify(); step2() })
  else after(0.9, () => { toast('Player stands', '#3de8ff'); step2() })
}
function settle() {
  L.phase = 'payout'
  const pv = total(L.P), bv = total(L.B)
  const outcome = pv > bv ? 'P' : bv > pv ? 'B' : 'T'
  L.outcome = outcome; L.history.push(outcome); if (L.history.length > 12) L.history.shift()
  L.results = {}
  for (const p of L.players) {
    let net = 0, label = 'LOSE'
    if (outcome === 'T') { if (p.side === 'T') { net = p.bet * 8; label = 'WIN' } else { net = 0; label = 'PUSH' } }
    else if (p.side === outcome) { net = outcome === 'B' ? Math.floor(p.bet * 0.95) : p.bet; label = 'WIN' }
    else net = -p.bet
    if (p.human && !p.auto) { adj(p, p.bet + net); if (p.id === 0) L.net += net } else p.chips += net
    L.results[p.id] = { net, label }
  }
  L.msg = (outcome === 'T' ? 'TIE' : outcome === 'P' ? 'PLAYER WINS' : 'BANKER WINS') + ' · ' + pv + ' to ' + bv
  const me = L.results[0]
  if (L.players[0].human && !L.players[0].auto) {
    if (me.label === 'WIN') { sfx('cWin'); banner('YOU WIN!', `+${me.net} CHIPS`, '#3dff7a', 1.6); speak('You win!', 0.9, 1.1); if (me.net >= 100) celebrate() }
    else if (me.label === 'LOSE') { sfx('cLose'); banner(outcome === 'T' ? 'TIE' : (outcome === 'P' ? 'PLAYER' : 'BANKER') + ' WINS', `${me.net} CHIPS`, '#ff6a6a', 1.4) }
    else banner('PUSH', 'BET RETURNED', '#9fd', 1.2)
  }
  notify()
  if (!live().length) after(2.6, () => { L.round++; bettingPhase() })
  else if (CS.online) { const gen = L.round; after(7, () => { if (L.round === gen && L.phase === 'payout') { L.round++; bettingPhase() } }) }
}
function button(name, arg) {
  const me = actor()
  if (!me) return
  if (name === 'side') { if (L.phase === 'bet' && !me.ready) { me.side = arg; sfx('cSelect'); notify() } return }
  if (name === 'bet') { if (L.phase === 'bet' && !me.ready) { me.want = Math.max(10, Math.min(arg === 'all' ? chipsOf(me) : arg, chipsOf(me))); sfx('cChip'); notify() } return }
  if (name === 'deal') { if (L.phase === 'bet' && chipsOf(me) >= 10) { me.ready = true; if (live().every((p) => p.ready)) deal(); else { L.msg = 'Waiting for other players…'; notify() } } return }
  if (name === 'next') { if (L.phase === 'payout' && ACTOR === 0) { L.round++; bettingPhase() } return }
  if (name === 'loan') { if (banked(me) && bank() < 10) { addChips(500); toast('Loan: +500 chips', '#ffe84a'); sfx('cChip'); bettingPhase() } return }
  if (name === 'cash') {
    if (ACTOR !== 0) return
    if (CS.online) {
      const rows = L.players.filter((p) => p.human).map((p) => [p.name, p.chips]).sort((a, b) => b[1] - a[1])
      const top = L.players.filter((p) => p.human).sort((a, b) => b.chips - a.chips)[0]
      finish({ title: `${top.name} LEADS WITH ${top.chips}`, win: false, rows, score: 0, game: 'baccarat', winner: top.id, winnerCid: top.cid || null, scores: L.players.map((p) => ({ cid: p.cid || null, score: p.human ? p.chips : 0 })), chipsMode: true })
      return
    }
    const chips = bank(); recordScore('baccarat', chips)
    profile.cardGames = (profile.cardGames || 0) + 1; if (L.net > 0) profile.cardWins = (profile.cardWins || 0) + 1; saveProfile()
    finish({ title: L.net >= 0 ? 'CASHED OUT AHEAD!' : 'CASHED OUT', win: L.net > 0, rows: [['STARTED WITH', L.sessionStart], ['NOW HAVE', chips], ['NET', L.net]], score: chips, game: 'baccarat' })
    if (L.net > 0) celebrate()
  }
}
const hideC = (c) => ({ ...HIDDEN, id: c.id })
function snap(v = 0) { const prev = ACTOR; ACTOR = v; try { return snapFor(v) } finally { ACTOR = prev } }
function snapFor(v) {
  const cards = []
  const n = L.players.length
  const me = L.players[v]
  const showHand = (hand, cx, y, side) => hand.forEach((c, i) => {
    const third = i === 2
    const up = L.phase !== 'deal' || false
    const flipped = L.phase !== 'bet' && (L.phase === 'reveal' || L.phase === 'payout' || (L.phase === 'deal' && false))
    void up
    cards.push({ id: c.id, face: CS.online && !flipped ? hideC(c) : c, x: cx + (i - 1) * 7 + (third ? 4 : 0), y: y + (third ? 2 : 0), rot: third ? 90 : (i - 0.5) * 2, s: 1.05, z: 10 + i, up: flipped, glow: L.phase === 'payout' && L.outcome === side })
  })
  showHand(L.P, 30, 38, 'P'); showHand(L.B, 70, 38, 'B')
  const labels = [{ x: 30, y: 24, text: 'PLAYER', sub: L.P.length && L.phase !== 'deal' && L.phase !== 'bet' ? String(total(L.P)) : '', color: '#3de8ff', hot: L.phase === 'payout' && L.outcome === 'P' }, { x: 70, y: 24, text: 'BANKER', sub: L.B.length && L.phase !== 'deal' && L.phase !== 'bet' ? String(total(L.B)) : '', color: '#ff6a6a', hot: L.phase === 'payout' && L.outcome === 'B' }, { x: 50, y: 24, text: 'TIE 8:1', sub: '', color: '#6aff9a', hot: L.phase === 'payout' && L.outcome === 'T' }]
  const seatX = n === 2 ? [30, 70] : n === 3 ? [20, 50, 80] : [14, 38, 62, 86]
  const seats = L.players.map((p, i) => { const r = L.results[p.id]; const mine = p.id === v; const shown = p.human && !p.auto ? true : L.phase !== 'bet'; return { id: p.id, name: p.name, avatar: p.avatar, x: seatX[i], y: 77, chips: chipsOf(p), bet: p.bet, turn: L.phase === 'bet' && p.human && !p.auto && !p.ready, human: mine, bot: !p.human, tag: r ? `${r.label}${r.net ? ' ' + (r.net > 0 ? '+' : '') + r.net : ''}` : '', tagKind: r ? r.label : '', val: null, note: shown && (p.bet > 0 || p.human) ? 'ON ' + SIDE[p.side] : '' } })
  const buttons = []
  const active = me.human && !me.auto
  if (L.phase === 'bet' && active && !me.ready) {
    if (banked(me) && bank() < 10) buttons.push({ name: 'loan', label: 'TAKE LOAN +500', hot: true, pulse: true })
    else {
      for (const k of ['P', 'B', 'T']) buttons.push({ name: 'side', arg: k, label: SIDE[k], on: me.side === k, hot: me.side === k })
      for (const a of [10, 50, 100, 500]) buttons.push({ name: 'bet', arg: a, label: String(a), off: a > chipsOf(me), on: me.want === a, chip: true })
      buttons.push({ name: 'bet', arg: 'all', label: 'ALL IN', off: chipsOf(me) < 10, chip: true })
      buttons.push({ name: 'deal', label: `DEAL (${me.want} ON ${SIDE[me.side]}) ▶`, hot: true, pulse: true })
    }
  }
  if (L.phase === 'payout' && active && v === 0) buttons.push({ name: 'next', label: 'NEXT ROUND ▶', hot: true, pulse: true })
  if (active && v === 0 && L.phase !== 'deal' && L.phase !== 'reveal') buttons.push({ name: 'cash', label: CS.online ? 'END TABLE' : 'CASH OUT' })
  const msg = L.phase === 'bet' && active && me.ready ? 'Waiting for other players…' : L.msg
  const road = L.history.map((o) => (o === 'P' ? '🔵' : o === 'B' ? '🔴' : '🟢')).join('')
  return { phase: L.phase, msg, seats, cards, buttons, labels, info: (CS.online ? `ROUND ${L.round} · ONLINE TABLE` : `ROUND ${L.round} · NET ${L.net >= 0 ? '+' : ''}${L.net}`) + (road ? ' · ' + road : ''), bet: me.want }
}
registerCardGame({ id: 'baccarat', name: 'BACCARAT', start, snap, button, click() {} })
export const baccaratApi = {
  setActor(i) { ACTOR = i },
  players: () => L.players,
  dropToBot(i) {
    const p = L.players[i]
    if (!p || !p.human) return
    p.human = false; p.cid = null; p.name = p.name.replace(/ 🤖$/, '') + ' 🤖'
    if (L.phase === 'bet' && live().length && live().every((q) => q.ready)) deal()
    else if (L.phase === 'bet' && !live().length) after(0.5, deal)
  },
}
