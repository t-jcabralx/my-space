// UNO: 2-4 players, stacking option, call-UNO / catch mechanic, match scoring. Bots with simple strategy.
import { CS, after, notify, shuffle, newId, fan, botFan, seatPos, banner, toast, celebrate, finish, registerCardGame, rnd, pickOne } from './core.js'
import { sfx, speak } from '../audio.js'
import { profile, saveProfile } from '../engine.js'

const COLORS = ['R', 'Y', 'G', 'B']
export const UCOL = { R: '#e8384a', Y: '#f2c21a', G: '#2fb85a', B: '#2f6df0', W: '#20242c' }
const NAMES = ['YOU', 'MAYA', 'JUN', 'BEA']
const AVATAR = ['😎', '🦊', '🐼', '🐸']
const pts = (c) => (/^\d$/.test(c.value) ? +c.value : c.color === 'W' ? 50 : 20)
function deck() {
  const d = []
  for (const c of COLORS) {
    d.push({ id: newId('u'), kind: 'uno', color: c, value: '0' })
    for (let v = 1; v <= 9; v++) for (let k = 0; k < 2; k++) d.push({ id: newId('u'), kind: 'uno', color: c, value: String(v) })
    for (const v of ['S', 'R', 'D']) for (let k = 0; k < 2; k++) d.push({ id: newId('u'), kind: 'uno', color: c, value: v })
  }
  for (let k = 0; k < 4; k++) { d.push({ id: newId('u'), kind: 'uno', color: 'W', value: 'W' }); d.push({ id: newId('u'), kind: 'uno', color: 'W', value: 'W4' }) }
  return d
}
const U = { players: [], deck: [], discard: [], dir: 1, turn: 0, color: 'R', top: null, pend: 0, pendKind: null, phase: 'idle', msg: '', scores: [], opts: { count: 3, stack: true, target: 200 }, drawn: null, pick: null, round: 1, rot: {}, think: -1, roundInfo: null, uno: {} }
const rotOf = (c) => U.rot[c.id] || (U.rot[c.id] = rnd(-16, 16))
const human = () => U.players[0]
const cur = () => U.players[U.turn]
const nextIdx = (from, steps = 1) => { let i = from; for (let k = 0; k < steps; k++) i = (i + U.dir + U.players.length) % U.players.length; return i }
const canPlay = (c) => {
  if (U.pend > 0) return U.opts.stack && ((U.pendKind === 'D' && c.value === 'D') || (U.pendKind === 'W4' && c.value === 'W4'))
  return c.color === 'W' || c.color === U.color || c.value === U.top.value
}
function drawCard(p, n = 1, instant = false) {
  for (let i = 0; i < n; i++) {
    if (!U.deck.length) { const top = U.discard.pop(); U.deck = shuffle(U.discard.splice(0)); U.discard.push(top); sfx('cShuffle'); toast('RESHUFFLED', '#9fd') }
    const c = U.deck.pop(); if (!c) return null
    p.hand.push(c)
    if (!instant) sfx('cDraw')
  }
  return p.hand[p.hand.length - 1]
}
function start(opts) {
  CS.opts = opts
  U.opts = { count: opts.count || 3, stack: opts.stack !== false, target: opts.target || 200, sevenZero: !!opts.sevenZero }
  U.players = Array.from({ length: U.opts.count }, (_, i) => ({ id: i, name: NAMES[i], avatar: AVATAR[i], human: i === 0, hand: [], score: 0 }))
  U.round = 1; U.uno = {}
  CS.opts.game = 'uno'
  newRound()
}
function newRound() {
  U.deck = shuffle(deck()); U.discard = []; U.dir = 1; U.pend = 0; U.pendKind = null; U.drawn = null; U.pick = null; U.swapFrom = null; U.swapNext = null; U.roundInfo = null; U.rot = {}; U.uno = {}
  for (const p of U.players) p.hand = []
  U.phase = 'deal'; U.turn = 0; U.msg = 'Shuffling…'
  sfx('cShuffle'); notify()
  const total = U.players.length * 7
  for (let k = 0; k < total; k++) after(0.4 + k * 0.1, () => { drawCard(U.players[k % U.players.length], 1, true); sfx('cDeal'); notify() })
  after(0.5 + total * 0.1, () => {
    let first
    do { first = U.deck.pop(); if (first.color === 'W') { U.deck.unshift(first) } } while (first.color === 'W')
    U.discard.push(first); U.top = first; U.color = first.color
    sfx('cFlip'); U.phase = 'play'; U.turn = 0
    if (first.value === 'R' && U.players.length > 2) U.dir = -1
    if (first.value === 'S') U.turn = nextIdx(0)
    if (first.value === 'D') { drawCard(human(), 2); U.turn = nextIdx(0) }
    U.msg = U.turn === 0 ? 'Your turn' : cur().name + ' is thinking…'
    banner(`ROUND ${U.round}`, `FIRST TO ${U.opts.target} POINTS`, '#ffe84a', 1.2)
    notify(); beginTurn()
  })
}
function beginTurn() {
  if (U.phase !== 'play') return
  U.drawn = null
  const p = cur()
  U.msg = p.human ? (U.pend ? `Stack a ${U.pendKind === 'W4' ? '+4' : '+2'} or draw ${U.pend}!` : 'Your turn: play a card or draw') : p.name + ' is thinking…'
  notify()
  if (!p.human) after(rnd(0.9, 1.6), botTurn)
}
function playCard(p, c, chosenColor) {
  p.hand.splice(p.hand.indexOf(c), 1)
  U.discard.push(c); U.top = c
  sfx(c.color === 'W' ? 'cWild' : 'cPlay')
  U.color = c.color === 'W' ? chosenColor : c.color
  U.drawn = null
  if (c.color === 'W') toast(`${p.name} chose ${{ R: 'RED', Y: 'YELLOW', G: 'GREEN', B: 'BLUE' }[U.color]}`, UCOL[U.color])
  let skipExtra = 0
  if (c.value === 'S') { sfx('cSkip'); skipExtra = 1; banner('SKIP!', `${U.players[nextIdx(U.turn)].name} loses a turn`, UCOL[c.color], 0.9) }
  else if (c.value === 'R') { U.dir *= -1; sfx('cReverse'); if (U.players.length === 2) skipExtra = 1; banner('REVERSE!', '', UCOL[c.color], 0.9) }
  else if (c.value === 'D') { U.pend += 2; U.pendKind = 'D'; sfx('cSkip') }
  else if (c.value === 'W4') { U.pend += 4; U.pendKind = 'W4'; sfx('cSkip') }
  // UNO call window
  if (p.hand.length === 1) {
    const called = !p.human && Math.random() < 0.88
    U.uno[p.id] = { called, t: 3.2, caught: false }
    if (called) { sfx('cUno'); speak('Uno!', 1.1, 1.15); banner('UNO!', p.name, '#ff4de1', 0.9) }
    else if (p.human) toast('PRESS UNO!', '#ff4de1')
    else toast(`${p.name} forgot to say UNO! CATCH!`, '#ff4de1')
  } else delete U.uno[p.id]
  if (p.hand.length === 0) { roundWon(p); return }
  const proceed = () => {
    let n = nextIdx(U.turn)
    for (let k = 0; k < skipExtra; k++) n = nextIdx(n)
    U.turn = n
    // pending draws land on the next player unless they can stack
    const np = U.players[n]
    if (U.pend > 0 && !(U.opts.stack && np.hand.some((x) => canPlay(x)))) { forceDraw(np); return }
    notify(); after(0.55, beginTurn)
  }
  if (U.opts.sevenZero && c.color !== 'W') {
    if (c.value === '7') {
      if (p.human) { U.swapFrom = p; U.swapNext = proceed; U.msg = 'SEVEN! Pick a player to swap hands with'; notify(); return }
      const target = U.players.filter((q) => q !== p).sort((x, y) => x.hand.length - y.hand.length)[0]
      swapHands(p, target); after(0.95, proceed); return
    }
    if (c.value === '0') { rotateHands(); after(0.95, proceed); return }
  }
  proceed()
}
function swapHands(a, b) {
  const t = a.hand; a.hand = b.hand; b.hand = t
  U.uno = {}
  sfx('cReverse'); sfx('cWild'); banner('SWAP!', `${a.name} ⇄ ${b.name}`, '#ff4de1', 1.2); toast(`${a.name} swapped hands with ${b.name}`, '#ff4de1'); notify()
}
function rotateHands() {
  const n = U.players.length, hs = U.players.map((q) => q.hand)
  U.players.forEach((q, i) => { q.hand = hs[(i - U.dir + n * 2) % n] })
  U.uno = {}
  sfx('cReverse'); banner('ROTATE!', 'EVERYONE PASSES THEIR HAND', '#ff4de1', 1.2); notify()
}
function forceDraw(p) {
  const n = U.pend; U.pend = 0; U.pendKind = null
  toast(`${p.name} draws ${n}`, '#ff8a96'); banner(`+${n}`, p.name, '#ff6a6a', 0.9)
  for (let k = 0; k < n; k++) after(0.12 * k, () => { drawCard(p, 1); notify() })
  after(0.12 * n + 0.3, () => { U.turn = nextIdx(U.turn); beginTurn() })
}
function botTurn() {
  if (U.phase !== 'play') return
  const p = cur()
  if (p.human) return
  // catch a human who forgot UNO
  const playable = p.hand.filter(canPlay)
  if (U.pend && !playable.length) { forceDraw(p); return }
  if (!playable.length) {
    const c = drawCard(p, 1); notify()
    after(0.7, () => {
      if (c && canPlay(c)) playCard(p, c, bestColor(p, c)); else { U.turn = nextIdx(U.turn); beginTurn() }
    })
    return
  }
  // strategy: avoid wilds early, prefer actions when the next player is nearly out, prefer the colour we hold most
  const next = U.players[nextIdx(U.turn)]
  const colorCount = {}; for (const c of p.hand) colorCount[c.color] = (colorCount[c.color] || 0) + 1
  const score = (c) => {
    let s = 0
    if (c.color === 'W') s -= p.hand.length > 3 ? 8 : -2
    if (['S', 'R', 'D'].includes(c.value)) s += next.hand.length <= 2 ? 9 : 2
    if (c.value === 'W4') s += next.hand.length <= 2 ? 12 : 0
    s += (colorCount[c.color] || 0) * 0.8 + (/^\d$/.test(c.value) ? +c.value * 0.15 : 0)
    return s + Math.random()
  }
  const c = playable.sort((a, b) => score(b) - score(a))[0]
  playCard(p, c, c.color === 'W' ? bestColor(p, c) : null)
}
function bestColor(p, played) {
  const cnt = { R: 0, Y: 0, G: 0, B: 0 }
  for (const c of p.hand) if (c !== played && c.color !== 'W') cnt[c.color]++
  const m = Math.max(...Object.values(cnt))
  return pickOne(COLORS.filter((k) => cnt[k] === m))
}
function roundWon(p) {
  U.phase = 'roundOver'
  const gain = U.players.filter((q) => q !== p).reduce((a, q) => a + q.hand.reduce((s, c) => s + pts(c), 0), 0)
  p.score += gain
  U.roundInfo = { winner: p.id, gain, matchWin: p.score >= U.opts.target }
  sfx(p.human ? 'cWin' : 'cLose'); speak(p.human ? 'You win the round!' : p.name + ' wins the round', 0.9, 1.1)
  if (p.human) celebrate()
  banner(`${p.name} WINS THE ROUND`, `+${gain} POINTS`, '#3dff7a', 2)
  U.msg = ''
  for (const q of U.players) for (const c of q.hand) U.uno[q.id] = null
  if (U.roundInfo.matchWin) {
    after(2.2, () => {
      const won = p.human
      profile.cardWins = (profile.cardWins || 0) + (won ? 1 : 0); profile.cardGames = (profile.cardGames || 0) + 1
      if (won) profile.unoWins = (profile.unoWins || 0) + 1
      saveProfile()
      finish({ title: won ? 'YOU WIN THE MATCH!' : p.name + ' WINS THE MATCH', win: won, rows: U.players.map((q) => [q.name, q.score]), score: won ? p.score : 0, game: 'uno' })
      if (won) celebrate()
    })
  }
  notify()
}
function click(id) {
  if (U.phase !== 'play' || !cur().human || U.pick || U.swapFrom) return
  const h = human()
  const c = h.hand.find((x) => x.id === id)
  if (!c) { if (id === 'deck' || U.deck.some((x) => x.id === id)) drawHuman(); return }
  if (U.drawn && U.drawn !== c) { sfx('cBad'); return }
  if (!canPlay(c)) { sfx('cBad'); toast(U.pend ? 'You must stack or draw!' : 'That card cannot be played', '#ff8a96'); return }
  if (c.color === 'W') { U.pick = c; U.msg = 'Pick a colour'; notify(); return }
  playCard(h, c, null)
}
function drawHuman() {
  const h = human()
  if (U.drawn) return
  if (U.pend) { forceDraw(h); return }
  const c = drawCard(h, 1)
  notify()
  if (c && canPlay(c)) { U.drawn = c; U.msg = 'Play the drawn card or pass'; notify() }
  else { toast('No match: turn passes', '#9fd'); after(0.8, () => { U.turn = nextIdx(U.turn); beginTurn() }) }
}
function button(name, arg) {
  if (name === 'deck') { if (U.phase === 'play' && cur().human && !U.pick) drawHuman(); return }
  if (name === 'swap' && U.swapFrom) { const t = U.players[arg]; if (t && t !== U.swapFrom) { const f = U.swapNext; swapHands(U.swapFrom, t); U.swapFrom = null; U.swapNext = null; after(0.95, f) } return }
  if (name === 'color' && U.pick) { const c = U.pick; U.pick = null; playCard(human(), c, arg); return }
  if (name === 'pass' && U.drawn && cur().human) { U.drawn = null; U.turn = nextIdx(U.turn); beginTurn(); return }
  if (name === 'uno') {
    const st = U.uno[0]
    if (st && !st.called && human().hand.length === 1) { st.called = true; sfx('cUno'); speak('Uno!', 1.1, 1.15); banner('UNO!', 'YOU', '#ff4de1', 0.9); notify() }
    else if (human().hand.length === 2 && cur().human) { U.preUno = true; toast('UNO ready!', '#ff4de1') }
    return
  }
  if (name === 'catch') {
    for (const p of U.players) {
      const st = U.uno[p.id]
      if (!p.human && st && !st.called && !st.caught && p.hand.length === 1) { st.caught = true; sfx('cSkip'); toast(`Caught ${p.name}! +2 cards`, '#3dff7a'); drawCard(p, 2); drawCard(p, 0); notify(); return }
    }
    return
  }
  if (name === 'next') { if (U.phase === 'roundOver' && !U.roundInfo.matchWin) { U.round++; newRound() } }
}
function tick(dt) {
  for (const k of Object.keys(U.uno)) {
    const st = U.uno[k]
    if (!st) continue
    st.t -= dt
    const p = U.players[+k]
    if (p && !st.called && !st.caught && st.t < 1.8 && !p.human) { /* human may CATCH until the timer ends */ }
    if (st.t <= 0) {
      if (p && p.human && !st.called && !st.caught && p.hand.length === 1) { st.caught = true; sfx('cSkip'); toast('You forgot UNO! +2 cards', '#ff8a96'); drawCard(p, 2); notify() }
      U.uno[k] = null
    }
  }
}
function snap() {
  const cards = []
  const n = U.players.length
  const hand0 = human().hand.slice().sort((a, b) => COLORS.indexOf(a.color) - COLORS.indexOf(b.color) || a.value.localeCompare(b.value, undefined, { numeric: true }))
  const myTurn = U.phase === 'play' && cur().human && !U.pick
  const placed = new Set()
  hand0.forEach((c, i) => {
    const f = fan(hand0.length, i, { cx: 50, cy: 84, spread: 5.4, max: 56, arc: 1.5, curve: 0.2 })
    cards.push({ id: c.id, face: c, x: f.x, y: f.y, rot: f.rot, s: 1, z: 20 + i, up: true, glow: myTurn && canPlay(c) && (!U.drawn || U.drawn === c), dim: myTurn && !canPlay(c), mine: true, sel: U.drawn === c })
    placed.add(c.id)
  })
  U.players.forEach((p, pi) => {
    if (pi === 0) return
    const seat = seatPos(pi, n)
    p.hand.forEach((c, i) => { const f = botFan(p.hand.length, i, seat); cards.push({ id: c.id, face: c, x: f.x, y: f.y, rot: f.rot, s: f.s, z: 10 + i, up: U.phase === 'roundOver' }); placed.add(c.id) })
  })
  const top = U.discard.slice(-9)
  U.discard.forEach((c) => { const k = top.indexOf(c); cards.push({ id: c.id, face: c, x: 58 + (k < 0 ? 0 : (k - top.length) * 0.15), y: 45 + (k < 0 ? 0 : (k - top.length) * 0.1), rot: rotOf(c), s: 1, z: 2 + (k < 0 ? 0 : k), up: true }); placed.add(c.id) })
  U.deck.forEach((c, i) => { cards.push({ id: c.id, face: c, x: 41 + i * 0.012, y: 45 - i * 0.012, rot: 0, s: 1, z: 1 + (i / 200), up: false, glow: myTurn && !U.drawn && i === U.deck.length - 1 }); placed.add(c.id) })
  const seats = U.players.map((p, i) => { const pos = seatPos(i, n); const st = U.uno[p.id]; return { id: p.id, name: p.name, avatar: p.avatar, x: pos.x, y: i === 0 ? 96 : pos.y + (pos.y < 20 ? -9 : pos.x < 20 || pos.x > 80 ? 17 : 9), score: p.score, count: p.hand.length, turn: U.phase === 'play' && U.turn === i, uno: p.hand.length === 1 && st && st.called, danger: p.hand.length === 1 && st && !st.called, human: p.human } })
  const buttons = []
  if (U.phase === 'play') {
    buttons.push({ name: 'uno', label: 'UNO!', hot: human().hand.length <= 2, pulse: !!(U.uno[0] && !U.uno[0].called) })
    if (U.players.some((p) => !p.human && U.uno[p.id] && !U.uno[p.id].called && p.hand.length === 1)) buttons.push({ name: 'catch', label: 'CATCH!', hot: true, pulse: true })
    if (U.drawn) buttons.push({ name: 'pass', label: 'PASS' })
  }
  if (U.phase === 'roundOver' && !U.roundInfo.matchWin) buttons.push({ name: 'next', label: 'NEXT ROUND ▶', hot: true, pulse: true })
  return {
    phase: U.phase, msg: U.msg, seats, cards, buttons, deckClick: true,
    center: { color: U.color, dir: U.dir, pend: U.pend, top: U.top },
    prompt: U.pick ? { type: 'color', colors: COLORS } : U.swapFrom ? { type: 'swap', players: U.players.filter((q) => q !== U.swapFrom).map((q) => ({ id: q.id, name: q.name, count: q.hand.length })) } : null,
    info: `ROUND ${U.round} · FIRST TO ${U.opts.target}${U.opts.sevenZero ? ' · SEVEN-0' : ''}`,
    scores: U.players.map((p) => [p.name, p.score]),
  }
}
registerCardGame({ id: 'uno', name: 'UNO', start, snap, click, button, tick })
