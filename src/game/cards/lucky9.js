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
const L = { phase: 'idle', deck: [], dealer: null, players: [], bet: 50, msg: '', round: 1, humanDone: false, results: {}, revealed: new Set(), net: 0, sessionStart: 0, opts: {} }
const humanP = () => L.players[0]
function start(opts) {
  CS.opts = { ...opts, game: 'lucky9' }
  L.opts = opts
  L.players = [{ id: 0, name: 'YOU', avatar: '😎', human: true, hand: [], bet: 0, chips: 0 }, ...BOTS.slice(0, opts.bots === undefined ? 3 : opts.bots).map(([n, a], i) => ({ id: i + 1, name: n, avatar: a, human: false, hand: [], bet: 0, chips: 1000 }))]
  L.dealer = { id: 'D', name: 'HOUSE', avatar: '🎩', hand: [] }
  L.round = 1; L.net = 0; L.sessionStart = bank(); L.bet = Math.min(50, bank())
  if (opts.auto) { humanP().human = false; humanP().chips = 1000; humanP().auto = true }
  bettingPhase()
}
const chipsOf = (p) => (p.human ? bank() : p.chips)
function bettingPhase() {
  L.phase = 'bet'; L.results = {}; L.revealed = new Set(); L.humanDone = false
  for (const p of L.players) { p.hand = []; p.bet = 0; p.nat = false }
  L.dealer.hand = []
  if (L.deck.length < 20) { L.deck = shuffle(stdDeck()); sfx('cShuffle') }
  if (L.players.some((p) => !p.human && p.chips < 10)) for (const p of L.players) if (!p.human && p.chips < 10) p.chips = 500
  if (humanP().auto && humanP().chips < 10) humanP().chips = 500
  if (bank() < 10 && humanP().human) { L.msg = 'You are out of chips! Take a loan to keep playing.'; notify(); return }
  L.bet = Math.max(10, Math.min(L.bet, humanP().human ? bank() : humanP().chips))
  L.msg = humanP().human ? 'Place your bet, then DEAL' : 'Betting…'
  notify()
  if (humanP().auto) after(0.8, deal)
}
function deal() {
  if (L.phase !== 'bet') return
  const hp = humanP()
  hp.bet = hp.human ? Math.min(L.bet, bank()) : Math.min(L.bet, hp.chips)
  for (const p of L.players) if (!p.human) p.bet = Math.min(p.chips, [10, 20, 50, 100][Math.floor(Math.random() * 4)])
  if (hp.human) { addChips(-hp.bet); profile.jackpot = (profile.jackpot || 1000) + Math.ceil(hp.bet * 0.05); saveProfile() }
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
  const hp = humanP()
  if (hp.human && total(hp.hand) === 9 && hp.hand.length === 2) { profile.luckyNines = (profile.luckyNines || 0) + 1; saveProfile(); banner('LUCKY 9!', 'NATURAL NINE', '#ffe84a', 1.5); sfx('cWin'); speak('Lucky nine!', 0.9, 1.15) }
  if (hp.human && hp.hand.length === 2 && total(hp.hand) === 9 && hp.hand.every((c) => c.suit === hp.hand[0].suit)) {
    const jp = profile.jackpot || 1000
    addChips(jp); L.net += jp; profile.jackpot = 1000; saveProfile()
    banner('JACKPOT!!!', `SUITED NATURAL 9 · +${jp} CHIPS`, '#ffe84a', 2.4); sfx('jackpot'); speak('Jackpot!', 0.8, 1.2); celebrate()
  }
  if (natural(L.dealer.hand) || L.players.every((p) => p.nat)) { L.msg = 'A natural! Revealing…'; after(0.8, reveal); notify(); return }
  L.phase = 'act'
  if (hp.human) { L.msg = hp.nat ? 'Natural! Standing.' : 'Hit for a 3rd card or Stand'; if (hp.nat) { after(0.9, () => stand()) } }
  else L.msg = 'Players are deciding…'
  notify()
  if (!hp.human) after(0.6, () => botsAct(0))
}
function hit() {
  if (L.phase !== 'act' || L.humanDone) return
  const hp = humanP()
  if (hp.hand.length >= 3) return
  hp.hand.push(L.deck.pop()); sfx('cDraw'); notify()
  after(0.6, () => { if (hp.hand.length >= 3) stand() })
}
function doubleDown() {
  const hp = humanP()
  if (L.phase !== 'act' || L.humanDone || hp.hand.length !== 2 || hp.nat || bank() < hp.bet) return
  addChips(-hp.bet); hp.bet *= 2; sfx('cChip'); banner('DOUBLE DOWN!', `BET ${hp.bet} · ONE MORE CARD`, '#ff4de1', 1.1); notify()
  after(0.8, () => { hp.hand.push(L.deck.pop()); sfx('cDraw'); notify(); after(0.9, stand) })
}
function stand() {
  if (L.phase !== 'act' || L.humanDone) return
  L.humanDone = true; L.msg = 'Others are deciding…'; sfx('cPass'); notify()
  after(0.6, () => botsAct(1))
}
function botsAct(i) {
  const bots = L.players.filter((p) => !p.human || p.auto)
  const list = L.players.slice(humanP().human ? 1 : 0)
  if (i - (humanP().human ? 1 : 0) >= list.length || i >= L.players.length) { dealerAct(); return }
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
  const seq = [...L.players.filter((p) => !p.human || p.auto), L.dealer]
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
    if (net < 0 && p.human) net = Math.max(net, -bank() - 0) // cannot lose more than the bank + the bet already taken
    if (p.human) { addChips(p.bet + net); L.net += net } else p.chips += net
    L.results[p.id] = { net, label, value: pv, special: (net > 0 ? ps : net < 0 ? ds : { name: '' }).name }
  }
  L.msg = ''
  const me = L.results[0]
  if (humanP().human) {
    if (me.label === 'WIN') { sfx('cWin'); banner('YOU WIN!', `+${me.net} CHIPS`, '#3dff7a', 1.6); speak('You win!', 0.9, 1.1); if (me.net >= 100) celebrate() }
    else if (me.label === 'LOSE') { sfx('cLose'); banner('HOUSE WINS', `${me.net} CHIPS`, '#ff6a6a', 1.4) }
    else banner('PUSH', 'BET RETURNED', '#9fd', 1.2)
  }
  notify()
  if (humanP().auto) after(2.4, () => { L.round++; bettingPhase() })
}
function button(name, arg) {
  if (name === 'bet') { if (L.phase === 'bet') { L.bet = Math.max(10, Math.min(arg === 'all' ? bank() : arg, bank())); sfx('cChip'); notify() } return }
  if (name === 'deal') { if (bank() >= 10) deal(); return }
  if (name === 'hit') { hit(); return }
  if (name === 'stand') { stand(); return }
  if (name === 'double') { doubleDown(); return }
  if (name === 'next') { if (L.phase === 'payout') { L.round++; bettingPhase() } return }
  if (name === 'loan') { if (bank() < 10) { addChips(500); toast('Loan: +500 chips', '#ffe84a'); sfx('cChip'); bettingPhase() } return }
  if (name === 'cash') {
    const chips = bank(); recordScore('lucky9', chips)
    profile.cardGames = (profile.cardGames || 0) + 1; if (L.net > 0) profile.cardWins = (profile.cardWins || 0) + 1; saveProfile()
    finish({ title: L.net >= 0 ? 'CASHED OUT AHEAD!' : 'CASHED OUT', win: L.net > 0, rows: [['STARTED WITH', L.sessionStart], ['NOW HAVE', chips], ['NET', L.net]], score: chips, game: 'lucky9' })
    if (L.net > 0) celebrate()
  }
}
function snap() {
  const cards = []
  const spots = { 0: { x: 50, y: 75 }, 1: { x: 14, y: 57 }, 2: { x: 50, y: 46 }, 3: { x: 86, y: 57 } }
  const spotOf = (p) => (L.players.length === 2 ? (p.id === 0 ? spots[0] : spots[2]) : L.players.length === 3 ? [spots[0], spots[1], spots[3]][p.id] : spots[p.id])
  const place = (p, spot, sc, faceUp) => p.hand.forEach((c, i) => {
    const n = p.hand.length
    cards.push({ id: c.id, face: c, x: spot.x + (i - (n - 1) / 2) * (sc > 0.9 ? 6.2 : 4.4), y: spot.y + (i === 2 ? 0 : 0) - (L.phase === 'payout' && L.results[p.id] && L.results[p.id].label === 'WIN' ? 1.6 : 0), rot: (i - (n - 1) / 2) * 3, s: sc, z: 10 + i, up: faceUp, glow: L.phase === 'payout' && L.results[p.id] && L.results[p.id].label === 'WIN' })
  })
  L.players.forEach((p) => place(p, spotOf(p), p.human ? 1.05 : 0.78, (p.human && !p.auto) || L.revealed.has(p.id)))
  place(L.dealer, { x: 50, y: 17 }, 0.9, L.revealed.has('D'))
  const used = new Set(cards.map((c) => c.id))
  L.deck.forEach((c, i) => { if (!used.has(c.id) && i > L.deck.length - 10) cards.push({ id: c.id, face: c, x: 85 + i * 0.03, y: 17 - i * 0.03, rot: 0, s: 0.8, z: 1, up: false }) })
  const seats = L.players.map((p) => { const sp = spotOf(p); const r = L.results[p.id]; return { id: p.id, name: p.name, avatar: p.avatar, x: sp.x, y: sp.y + (p.human ? 20 : 11), chips: chipsOf(p), bet: p.bet, turn: L.phase === 'act' && p.human && !L.humanDone, human: p.human, tag: r ? `${r.label}${r.net ? ' ' + (r.net > 0 ? '+' : '') + r.net : ''}` : '', tagKind: r ? r.label : '', val: (p.human && !p.auto) || L.revealed.has(p.id) ? (p.hand.length ? total(p.hand) : null) : null, note: r ? r.special : p.nat && p.human ? 'NATURAL' : '' } })
  const dtag = L.revealed.has('D') ? total(L.dealer.hand) : null
  const buttons = []
  if (L.phase === 'bet' && humanP().human) {
    if (bank() < 10) buttons.push({ name: 'loan', label: 'TAKE LOAN +500', hot: true, pulse: true })
    else {
      for (const a of [10, 50, 100, 500]) buttons.push({ name: 'bet', arg: a, label: String(a), off: a > bank(), on: L.bet === a, chip: true })
      buttons.push({ name: 'bet', arg: 'all', label: 'ALL IN', off: bank() < 10, chip: true })
      buttons.push({ name: 'deal', label: `DEAL (${L.bet}) ▶`, hot: true, pulse: true })
    }
  }
  if (L.phase === 'act' && humanP().human && !L.humanDone) { buttons.push({ name: 'hit', label: 'HIT', hot: true, off: humanP().hand.length >= 3 || humanP().nat }); buttons.push({ name: 'double', label: 'DOUBLE DOWN', off: humanP().hand.length !== 2 || humanP().nat || bank() < humanP().bet }); buttons.push({ name: 'stand', label: 'STAND', hot: true }) }
  if (L.phase === 'payout' && humanP().human) buttons.push({ name: 'next', label: 'NEXT ROUND ▶', hot: true, pulse: true })
  if (humanP().human && L.phase !== 'deal') buttons.push({ name: 'cash', label: 'CASH OUT' })
  return { phase: L.phase, msg: L.msg, seats, cards, buttons, dealer: { name: 'HOUSE', avatar: '🎩', x: 50, y: 4, val: dtag, note: L.revealed.has('D') ? special(L.dealer.hand).name : '' }, info: `ROUND ${L.round} · NET ${L.net >= 0 ? '+' : ''}${L.net} · JACKPOT 🪙 ${(profile.jackpot || 1000).toLocaleString()}`, bet: L.bet }
}
registerCardGame({ id: 'lucky9', name: 'LUCKY 9', start, snap, button, click() {} })
