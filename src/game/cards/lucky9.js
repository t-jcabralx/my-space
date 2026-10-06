// Lucky 9: Filipino baccarat-style. A=1, 2-9 face, 10/J/Q/K=0; hand = sum mod 10. Natural 8/9 on two cards.
// Same suit pays 2x (2 cards) / 3x (3 cards); three of a kind pays 5x. Chips come from the shared bank.
import { CS, after, notify, shuffle, stdDeck, banner, toast, celebrate, finish, registerCardGame, bank, addChips, SYM } from './core.js'
import { sfx, speak } from '../audio.js'
import { profile, saveProfile, recordScore } from '../engine.js'

const val = (c) => (['10', 'J', 'Q', 'K'].includes(c.rank) ? 0 : c.rank === 'A' ? 1 : +c.rank)
export const total = (h) => h.reduce((a, c) => a + val(c), 0) % 10
export function special(h) {
  if (h.length >= 2 && h.every((c) => c.suit === h[0].suit)) return h.length === 2 ? { mult: 2, name: 'SUITED ×2' } : { mult: 3, name: 'SUITED ×3' }
  if (h.length === 3 && h.every((c) => c.rank === h[0].rank)) return { mult: 5, name: 'TRIPS ×5' }
  return { mult: 1, name: '' }
}

export const natural = (h) => h.length === 2 && total(h) >= 8
const BOTS = [['MAYA', '🦊'], ['JUN', '🐼'], ['BEA', '🐸']]
const L = { phase: 'idle', deck: [], dealer: null, players: [], bet: 50, msg: '', round: 1, results: {}, revealed: new Set(), net: 0, sessionStart: 0, opts: {} }
let ACTOR = 0
const HIDDEN = { id: 'h', kind: 'std', rank: '?', suit: 'S' }
const actor = () => L.players[ACTOR]
// Offline, the human plays with the shared chip bank. Online, every human has their own table stack.
const banked = (p) => p.human && !CS.online && !p.auto
const chipsOf = (p) => (banked(p) ? bank() : p.chips)
const adj = (p, n) => { if (banked(p)) addChips(n); else p.chips += n }
const live = () => L.players.filter((p) => p.human && !p.auto)
function start(opts) {
  CS.opts = { ...opts, game: 'lucky9' }
  L.opts = opts
  ACTOR = 0
  const hs = opts.humans || [{ name: 'YOU' }]
  const total = Math.min(4, hs.length + (opts.bots === undefined ? 3 : opts.bots))
  const bn = BOTS.slice()
  L.players = []
  for (let i = 0; i < total; i++) {
    const h = hs[i]
    if (h) L.players.push({ id: i, name: h.name, avatar: ['😎', '🦁', '🐯', '🦄'][i], human: true, cid: h.cid || null, hand: [], bet: 0, chips: 1000, want: 50 })
    else { const [n, a] = bn.shift(); L.players.push({ id: i, name: n, avatar: a, human: false, hand: [], bet: 0, chips: 1000, want: 50 }) }
  }
  L.dealer = { id: 'D', name: 'HOUSE', avatar: '🎩', hand: [] }
  L.round = 1; L.net = 0; L.sessionStart = bank()
  if (opts.auto) { L.players[0].human = false; L.players[0].chips = 1000; L.players[0].auto = true }
  L.players.forEach((p) => { p.want = banked(p) ? Math.min(50, bank()) : 50 })
  bettingPhase()
}
function bettingPhase() {
  L.phase = 'bet'; L.results = {}; L.revealed = new Set()
  for (const p of L.players) { p.hand = []; p.bet = 0; p.nat = false; p.done = false; p.ready = !p.human || p.auto }
  L.dealer.hand = []
  if (L.deck.length < 20) { L.deck = shuffle(stdDeck()); sfx('cShuffle') }
  for (const p of L.players) {
    if (!p.human && p.chips < 10) p.chips = 500
    if (p.human && !banked(p) && p.chips < 10) p.chips = 500 // online: the house tops you up
  }
  const need = live().filter((p) => banked(p) && bank() < 10)
  if (need.length) { L.msg = 'You are out of chips! Take a loan to keep playing.'; notify(); return }
  for (const p of L.players) p.want = Math.max(10, Math.min(p.want, chipsOf(p)))
  L.msg = live().length ? 'Place your bet, then DEAL' : 'Betting…'
  notify()
  if (!live().length) after(0.8, deal)
}
function deal() {
  if (L.phase !== 'bet') return
  for (const p of L.players) {
    if (p.human && !p.auto) { p.bet = Math.min(p.want, chipsOf(p)); adj(p, -p.bet); if (banked(p)) { profile.jackpot = (profile.jackpot || 1000) + Math.ceil(p.bet * 0.05); saveProfile() } }
    else p.bet = Math.min(p.chips, [10, 20, 50, 100][Math.floor(Math.random() * 4)])
  }
  L.phase = 'deal'; L.msg = 'Dealing…'; sfx('cChip'); notify()
  const order = [...L.players, L.dealer]
  let t = 0.25
  for (let round = 0; round < 2; round++) for (const p of order) {
    const who = p
    after(t, () => { const c = L.deck.pop(); who.hand.push(c); sfx('cDeal'); notify() })
    t += 0.28
  }
  after(t + 0.2, afterDeal)
}
function afterDeal() {
  for (const p of L.players) p.nat = natural(p.hand)
  for (const hp of live()) {
    if (hp.id === 0 && total(hp.hand) === 9 && hp.hand.length === 2) { profile.luckyNines = (profile.luckyNines || 0) + 1; saveProfile(); banner('LUCKY 9!', 'NATURAL NINE', '#ffe84a', 1.5); sfx('cWin'); speak('Lucky nine!', 0.9, 1.15) }
    if (banked(hp) && hp.hand.length === 2 && total(hp.hand) === 9 && hp.hand.every((c) => c.suit === hp.hand[0].suit)) {
      const jp = profile.jackpot || 1000
      addChips(jp); L.net += jp; profile.jackpot = 1000; saveProfile()
      banner('JACKPOT!!!', `SUITED NATURAL 9 · +${jp} CHIPS`, '#ffe84a', 2.4); sfx('jackpot'); speak('Jackpot!', 0.8, 1.2); celebrate()
    }
  }
  if (natural(L.dealer.hand) || L.players.every((p) => p.nat)) { L.msg = 'A natural! Revealing…'; after(0.8, reveal); notify(); return }
  L.phase = 'act'
  L.msg = live().length ? 'Hit for a 3rd card or Stand' : 'Players are deciding…'
  const gen = L.round
  for (const hp of live()) if (hp.nat) after(0.9, () => { if (L.round === gen) standP(hp) })
  notify()
  if (!live().length) after(0.6, () => botsAct(0))
}
function allDone() { return live().every((p) => p.done) }
function hit() {
  const hp = actor()
  if (L.phase !== 'act' || !hp || hp.done || !hp.human) return
  if (hp.hand.length >= 3) return
  const gen = L.round
  hp.hand.push(L.deck.pop()); sfx('cDraw'); notify()
  after(0.6, () => { if (L.round === gen && hp.hand.length >= 3) standP(hp) })
}
function doubleDown() {
  const hp = actor()
  if (L.phase !== 'act' || !hp || hp.done || hp.hand.length !== 2 || hp.nat || chipsOf(hp) < hp.bet) return
  const gen = L.round
  adj(hp, -hp.bet); hp.bet *= 2; sfx('cChip'); if (!CS.online) banner('DOUBLE DOWN!', `BET ${hp.bet} · ONE MORE CARD`, '#ff4de1', 1.1); notify()
  hp.done = true // lock the buttons while the card is drawn
  after(0.8, () => { if (L.round !== gen) return; hp.hand.push(L.deck.pop()); sfx('cDraw'); notify(); after(0.9, () => { hp.done = false; standP(hp) }) })
}
function standP(hp) {
  if (L.phase !== 'act' || !hp || hp.done) return
  hp.done = true; sfx('cPass')
  if (allDone()) { L.msg = 'Others are deciding…'; notify(); after(0.6, () => botsAct(0)) }
  else { L.msg = 'Waiting for other players…'; notify() }
}
function botsAct(i) {
  if (L.phase !== 'act') return
  if (i >= L.players.length) { dealerAct(); return }
  const p = L.players[i]
  if (!p || (p.human && !p.auto)) { botsAct(i + 1); return }
  const v = total(p.hand)
  if (!p.nat && v <= 4 || (!p.nat && v === 5 && Math.random() < 0.35)) {
    after(0.7, () => { p.hand.push(L.deck.pop()); sfx('cDraw'); toast(`${p.name} draws`, '#9fd'); notify(); after(0.6, () => botsAct(i + 1)) })
  } else after(0.5, () => { toast(`${p.name} stands`, '#9fd'); botsAct(i + 1) })
  notify()
}
function dealerAct() {
  L.msg = 'Dealer decides…'; notify()
  const d = L.dealer
  after(0.8, () => {
    const v = total(d.hand)
    if (!natural(d.hand) && (v <= 4 || (v === 5 && Math.random() < 0.3))) { d.hand.push(L.deck.pop()); sfx('cDraw'); toast('Dealer draws', '#ffe84a'); notify(); after(0.8, reveal) }
    else { toast('Dealer stands', '#ffe84a'); after(0.4, reveal) }
  })
}
function reveal() {
  L.phase = 'reveal'; L.msg = 'Showdown!'
  const seq = [...L.players.filter((p) => !p.human || p.auto || CS.online), L.dealer]
  seq.forEach((p, k) => after(0.5 + k * 0.7, () => { L.revealed.add(p.id); sfx('cFlip'); notify() }))
  after(0.5 + seq.length * 0.7 + 0.4, payout)
  notify()
}
function payout() {
  L.phase = 'payout'
  const d = L.dealer, dv = total(d.hand), ds = special(d.hand)
  L.results = {}
  for (const p of L.players) {
    const pv = total(p.hand), ps = special(p.hand)
    let net = 0, label = 'PUSH'
    if (pv > dv) { net = p.bet * ps.mult; label = 'WIN' }
    else if (pv < dv) { net = -p.bet * ds.mult; label = 'LOSE' }
    if (net < 0 && banked(p)) net = Math.max(net, -bank() - 0) // cannot lose more than the bank + the bet already taken
    if (net < 0 && p.human && !banked(p)) net = Math.max(net, -p.chips)
    if (p.human && !p.auto) { adj(p, p.bet + net); if (p.id === 0) L.net += net } else p.chips += net
    L.results[p.id] = { net, label, value: pv, special: (net > 0 ? ps : net < 0 ? ds : { name: '' }).name }
  }
  L.msg = ''
  const me = L.results[0]
  if (L.players[0].human && !L.players[0].auto) {
    if (me.label === 'WIN') { sfx('cWin'); banner('YOU WIN!', `+${me.net} CHIPS`, '#3dff7a', 1.6); speak('You win!', 0.9, 1.1); if (me.net >= 100) celebrate() }
    else if (me.label === 'LOSE') { sfx('cLose'); banner('HOUSE WINS', `${me.net} CHIPS`, '#ff6a6a', 1.4) }
    else banner('PUSH', 'BET RETURNED', '#9fd', 1.2)
  }
  notify()
  if (!live().length) after(2.4, () => { L.round++; bettingPhase() })
  else if (CS.online) { const gen = L.round; after(7, () => { if (L.round === gen && L.phase === 'payout') { L.round++; bettingPhase() } }) }
}
function button(name, arg) {
  const me = actor()
  if (!me) return
  if (name === 'bet') { if (L.phase === 'bet' && !me.ready) { me.want = Math.max(10, Math.min(arg === 'all' ? chipsOf(me) : arg, chipsOf(me))); sfx('cChip'); notify() } return }
  if (name === 'deal') {
    if (L.phase === 'bet' && chipsOf(me) >= 10) { me.ready = true; if (live().every((p) => p.ready)) deal(); else { L.msg = 'Waiting for other players…'; notify() } }
    return
  }
  if (name === 'hit') { hit(); return }
  if (name === 'stand') { standP(me); return }
  if (name === 'double') { doubleDown(); return }
  if (name === 'next') { if (L.phase === 'payout' && ACTOR === 0) { L.round++; bettingPhase() } return }
  if (name === 'loan') { if (banked(me) && bank() < 10) { addChips(500); toast('Loan: +500 chips', '#ffe84a'); sfx('cChip'); bettingPhase() } return }
  if (name === 'cash') {
    if (ACTOR !== 0) return
    if (CS.online) {
      const rows = L.players.filter((p) => p.human).map((p) => [p.name, p.chips]).sort((a, b) => b[1] - a[1])
      const top = L.players.filter((p) => p.human).sort((a, b) => b.chips - a.chips)[0]
      finish({ title: `${top.name} LEADS WITH ${top.chips}`, win: false, rows, score: 0, game: 'lucky9', winner: top.id, winnerCid: top.cid || null, scores: L.players.map((p) => ({ cid: p.cid || null, score: p.human ? p.chips : 0 })), chipsMode: true })
      return
    }
    const chips = bank(); recordScore('lucky9', chips)
    profile.cardGames = (profile.cardGames || 0) + 1; if (L.net > 0) profile.cardWins = (profile.cardWins || 0) + 1; saveProfile()
    finish({ title: L.net >= 0 ? 'CASHED OUT AHEAD!' : 'CASHED OUT', win: L.net > 0, rows: [['STARTED WITH', L.sessionStart], ['NOW HAVE', chips], ['NET', L.net]], score: chips, game: 'lucky9' })
    if (L.net > 0) celebrate()
  }
}
const hideC = (c) => ({ ...HIDDEN, id: c.id })
function snap(v = 0) {
  const prev = ACTOR; ACTOR = v
  try { return snapFor(v) } finally { ACTOR = prev }
}
function snapFor(v) {
  const cards = []
  const n = L.players.length
  const spots = { 0: { x: 50, y: 75 }, 1: { x: 14, y: 57 }, 2: { x: 50, y: 46 }, 3: { x: 86, y: 57 } }
  const rel = (p) => (p.id - v + n) % n
  const spotOf = (p) => (n === 2 ? (rel(p) === 0 ? spots[0] : spots[2]) : n === 3 ? [spots[0], spots[1], spots[3]][rel(p)] : spots[rel(p)])
  const me = L.players[v]
  const shown = (p) => (p.id === v && me.human && !me.auto) || L.revealed.has(p.id) || (!CS.online && p.human && !p.auto)
  const place = (p, spot, sc, faceUp) => p.hand.forEach((c, i) => {
    const k = p.hand.length
    const won = L.phase === 'payout' && L.results[p.id] && L.results[p.id].label === 'WIN'
    cards.push({ id: c.id, face: CS.online && !faceUp ? hideC(c) : c, x: spot.x + (i - (k - 1) / 2) * (sc > 0.9 ? 6.2 : 4.4), y: spot.y - (won ? 1.6 : 0), rot: (i - (k - 1) / 2) * 3, s: sc, z: 10 + i, up: faceUp, glow: won })
  })
  L.players.forEach((p) => place(p, spotOf(p), p.id === v && me.human ? 1.05 : 0.78, shown(p)))
  place(L.dealer, { x: 50, y: 17 }, 0.9, L.revealed.has('D'))
  const used = new Set(cards.map((c) => c.id))
  L.deck.forEach((c, i) => { if (!used.has(c.id) && i > L.deck.length - 10) cards.push({ id: c.id, face: CS.online ? hideC(c) : c, x: 85 + i * 0.03, y: 17 - i * 0.03, rot: 0, s: 0.8, z: 1, up: false }) })
  const seats = L.players.map((p) => { const sp = spotOf(p); const r = L.results[p.id]; const mine = p.id === v; return { id: p.id, name: p.name, avatar: p.avatar, x: sp.x, y: sp.y + (mine ? 20 : 11), chips: chipsOf(p), bet: p.bet, turn: L.phase === 'act' && p.human && !p.auto && !p.done, human: mine, bot: !p.human, tag: r ? `${r.label}${r.net ? ' ' + (r.net > 0 ? '+' : '') + r.net : ''}` : '', tagKind: r ? r.label : '', val: shown(p) ? (p.hand.length ? total(p.hand) : null) : null, note: r ? r.special : p.nat && shown(p) ? 'NATURAL' : '' } })
  const dtag = L.revealed.has('D') ? total(L.dealer.hand) : null
  const buttons = []
  const active = me.human && !me.auto
  if (L.phase === 'bet' && active && !me.ready) {
    if (banked(me) && bank() < 10) buttons.push({ name: 'loan', label: 'TAKE LOAN +500', hot: true, pulse: true })
    else {
      for (const a of [10, 50, 100, 500]) buttons.push({ name: 'bet', arg: a, label: String(a), off: a > chipsOf(me), on: me.want === a, chip: true })
      buttons.push({ name: 'bet', arg: 'all', label: 'ALL IN', off: chipsOf(me) < 10, chip: true })
      buttons.push({ name: 'deal', label: `DEAL (${me.want}) ▶`, hot: true, pulse: true })
    }
  }
  if (L.phase === 'act' && active && !me.done) { buttons.push({ name: 'hit', label: 'HIT', hot: true, off: me.hand.length >= 3 || me.nat }); buttons.push({ name: 'double', label: 'DOUBLE DOWN', off: me.hand.length !== 2 || me.nat || chipsOf(me) < me.bet }); buttons.push({ name: 'stand', label: 'STAND', hot: true }) }
  if (L.phase === 'payout' && active && v === 0) buttons.push({ name: 'next', label: 'NEXT ROUND ▶', hot: true, pulse: true })
  if (active && v === 0 && L.phase !== 'deal') buttons.push({ name: 'cash', label: CS.online ? 'END TABLE' : 'CASH OUT' })
  const msg = L.phase === 'bet' && active && me.ready ? 'Waiting for other players…' : L.msg
  return { phase: L.phase, msg, seats, cards, buttons, dealer: { name: 'HOUSE', avatar: '🎩', x: 50, y: 4, val: dtag, note: L.revealed.has('D') ? special(L.dealer.hand).name : '' }, info: CS.online ? `ROUND ${L.round} · ONLINE TABLE` : `ROUND ${L.round} · NET ${L.net >= 0 ? '+' : ''}${L.net} · JACKPOT 🪙 ${(profile.jackpot || 1000).toLocaleString()}`, bet: me.want }
}
registerCardGame({ id: 'lucky9', name: 'LUCKY 9', start, snap, button, click() {} })
export const lucky9Api = {
  setActor(i) { ACTOR = i },
  players: () => L.players,
  dropToBot(i) {
    const p = L.players[i]
    if (!p || !p.human) return
    p.human = false; p.cid = null; p.name = p.name.replace(/ 🤖$/, '') + ' 🤖'
    if (L.phase === 'bet' && live().length && live().every((q) => q.ready)) deal()
    else if (L.phase === 'bet' && !live().length) after(0.5, deal)
    else if (L.phase === 'act' && !p.done) { p.done = true; if (allDone()) after(0.6, () => botsAct(0)) }
  },
}
