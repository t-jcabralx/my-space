// UNO: 2-4 players, stacking option, call-UNO / catch mechanic, match scoring. Bots with simple strategy.
import { CS, after, notify, shuffle, newId, fan, botFan, seatPos, banner, toast, celebrate, finish, registerCardGame, rnd, pickOne } from './core.js'
import { sfx, speak } from '../audio.js'
import { profile, saveProfile, recordScore } from '../engine.js'

const COLORS = ['R', 'Y', 'G', 'B']
export const UCOL = { R: '#e8384a', Y: '#f2c21a', G: '#2fb85a', B: '#2f6df0', W: '#20242c' }
const NAMES = ['YOU', 'MAYA', 'JUN', 'BEA']
const AVATAR = ['😎', '🦊', '🐼', '🐸']
const TURN_SECS = 15 // a human who doesn't lay a card in time auto-draws one
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
const U = { players: [], deck: [], discard: [], dir: 1, turn: 0, color: 'R', top: null, pend: 0, pendKind: null, phase: 'idle', msg: '', scores: [], opts: { count: 3, stack: true, target: 200 }, drawn: null, pick: null, round: 1, rot: {}, think: -1, roundInfo: null, uno: {}, turnT: 1e9 }
const rotOf = (c) => U.rot[c.id] || (U.rot[c.id] = rnd(-16, 16))
let ACTOR = 0
const actor = () => U.players[ACTOR]
const HIDDEN = { id: 'h', kind: 'uno', color: 'W', value: '?' }
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
  const humans = opts.humans || [{ name: 'YOU' }]
  const botNames = ['MAYA', 'JUN', 'BEA', 'KAI'].filter((n) => !humans.some((h) => h.name === n))
  U.players = Array.from({ length: U.opts.count }, (_, i) => {
    const h = humans[i]
    return { id: i, name: h ? h.name : botNames.shift(), avatar: AVATAR[i % AVATAR.length], human: !!h, cid: h ? h.cid : null, hand: [], score: 0 }
  })
  ACTOR = 0
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
    if (first.value === 'D') { drawCard(U.players[0], 2); U.turn = nextIdx(0) }
    U.msg = ''
    banner(`ROUND ${U.round}`, `FIRST TO ${U.opts.target} POINTS`, '#ffe84a', 1.2)
    notify(); beginTurn()
  })
}
function beginTurn() {
  if (U.phase !== 'play') return
  U.drawn = null
  const p = cur()
  U.turnT = p.human ? TURN_SECS : 1e9
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
    else if (p.human) toast(`${p.name}: PRESS UNO!`, '#ff4de1')
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
      if (p.human) { U.swapFrom = p; U.swapNext = proceed; notify(); return }
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
  sfx(p.id === 0 ? 'cWin' : 'cLose'); speak(p.id === 0 && !CS.online ? 'You win the round!' : p.name + ' wins the round', 0.9, 1.1)
  if (p.human) celebrate()
  banner(`${p.name} WINS THE ROUND`, `+${gain} POINTS`, '#3dff7a', 2)
  U.msg = ''
  U.uno = {}
  if (U.roundInfo.matchWin) {
    after(2.2, () => {
      const won = p.id === 0 && p.human
      const online = !!CS.online
      if (p.id === 0 && won && p.score > 0) recordScore('uno', p.score)
      if (p.id === 0) { profile.cardWins = (profile.cardWins || 0) + (won ? 1 : 0); profile.cardGames = (profile.cardGames || 0) + 1; if (won) profile.unoWins = (profile.unoWins || 0) + 1; saveProfile() }
      finish({ title: online ? `${p.name} WINS THE MATCH!` : won ? 'YOU WIN THE MATCH!' : p.name + ' WINS THE MATCH', win: won, rows: U.players.map((q) => [q.name, q.score]), score: won ? p.score : 0, game: 'uno', winner: p.id, winnerCid: p.cid || null, scores: U.players.map((q) => ({ cid: q.cid, score: q.score })) })
      if (p.human) celebrate()
    })
  }
  notify()
}
function click(id) {
  if (U.phase !== 'play' || cur().id !== ACTOR || !cur().human || U.pick || U.swapFrom) return
  const h = actor()
  const c = h.hand.find((x) => x.id === id)
  if (!c) { if (id === 'deck' || U.deck.some((x) => x.id === id)) drawFor(h); return }
  if (U.drawn && U.drawn !== c) { sfx('cBad'); return }
  if (!canPlay(c)) { sfx('cBad'); toast(U.pend ? 'You must stack or draw!' : 'That card cannot be played', '#ff8a96'); return }
  if (c.color === 'W') { U.pick = c; U.pickBy = ACTOR; notify(); return }
  playCard(h, c, null)
}
function drawFor(h) {
  if (U.drawn) return
  if (U.pend) { forceDraw(h); return }
  const c = drawCard(h, 1)
  notify()
  if (c && canPlay(c)) { U.drawn = c; U.turnT = TURN_SECS; notify() }
  else { toast('No match: turn passes', '#9fd'); after(0.8, () => { U.turn = nextIdx(U.turn); beginTurn() }) }
}
function button(name, arg) {
  if (name === 'deck') { if (U.phase === 'play' && cur().id === ACTOR && cur().human && !U.pick && !U.swapFrom) drawFor(actor()); return }
  if (name === 'swap' && U.swapFrom && U.swapFrom.id === ACTOR) { const t = U.players[arg]; if (t && t !== U.swapFrom) { const f = U.swapNext; swapHands(U.swapFrom, t); U.swapFrom = null; U.swapNext = null; after(0.95, f) } return }
  if (name === 'color' && U.pick && U.pickBy === ACTOR) { const c = U.pick; U.pick = null; playCard(actor(), c, ['R', 'Y', 'G', 'B'].includes(arg) ? arg : 'R'); return }
  if (name === 'pass' && U.drawn && cur().id === ACTOR) { U.drawn = null; U.turn = nextIdx(U.turn); beginTurn(); return }
  if (name === 'uno') {
    const st = U.uno[ACTOR]
    if (st && !st.called && actor().hand.length === 1) { st.called = true; sfx('cUno'); speak('Uno!', 1.1, 1.15); banner('UNO!', actor().name, '#ff4de1', 0.9); notify() }
    return
  }
  if (name === 'catch') {
    for (const p of U.players) {
      const st = U.uno[p.id]
      if (p.id !== ACTOR && st && !st.called && !st.caught && p.hand.length === 1) { st.caught = true; sfx('cSkip'); toast(`${actor().name} caught ${p.name}! +2 cards`, '#3dff7a'); drawCard(p, 2); notify(); return }
    }
    return
  }
  if (name === 'next') { if (ACTOR === 0 && U.phase === 'roundOver' && !U.roundInfo.matchWin) { U.round++; newRound() } }
}
function tick(dt) {
  if (U.phase === 'play' && cur().human && !U.pick && !U.swapFrom && U.turnT < 1e8) {
    U.turnT -= dt
    if (U.turnT <= 0) {
      const h = cur(); U.turnT = 1e9
      if (U.drawn) { toast(`${h.name} ran out of time: pass`, '#9fd'); U.drawn = null; U.turn = nextIdx(U.turn); beginTurn() }
      else { toast(`${h.name} ran out of time: draws a card`, '#ff8a96'); drawFor(h) }
    }
  }
  for (const k of Object.keys(U.uno)) {
    const st = U.uno[k]
    if (!st) continue
    st.t -= dt
    const p = U.players[+k]
    if (st.t <= 0) {
      if (p && p.human && !st.called && !st.caught && p.hand.length === 1) { st.caught = true; sfx('cSkip'); toast(`${p.name} forgot UNO! +2 cards`, '#ff8a96'); drawCard(p, 2); notify() }
      U.uno[k] = null
    }
  }
}
function viewerMsg(v) {
  if (U.phase !== 'play') return U.msg
  if (U.swapFrom) return U.swapFrom.id === v ? 'SEVEN! Pick a player to swap hands with' : `${U.swapFrom.name} is choosing who to swap with…`
  if (U.pick) return U.pickBy === v ? 'Pick a colour' : `${cur().name} is choosing a colour…`
  const p = cur()
  if (p.id === v && p.human) return U.drawn ? 'Play the drawn card or pass' : U.pend ? `Stack a ${U.pendKind === 'W4' ? '+4' : '+2'} or draw ${U.pend}!` : 'Your turn: play a card or draw'
  return p.name + (p.human ? ' is playing…' : ' is thinking…')
}
function snap(v = 0) {
  const cards = []
  const n = U.players.length
  const me = U.players[v]
  const hidden = !!CS.online
  const hide = (c) => (hidden && U.phase !== 'roundOver' ? HIDDEN : c)
  const rel = (i) => (i - v + n) % n
  const hand0 = me.hand.slice().sort((a, b) => COLORS.indexOf(a.color) - COLORS.indexOf(b.color) || a.value.localeCompare(b.value, undefined, { numeric: true }))
  const myTurn = U.phase === 'play' && cur().id === v && cur().human && !U.pick && !U.swapFrom
  hand0.forEach((c, i) => {
    const f = fan(hand0.length, i, { cx: 50, cy: 84, spread: 5.4, max: 56, arc: 1.5, curve: 0.2 })
    cards.push({ id: c.id, face: c, x: f.x, y: f.y, rot: f.rot, s: 1, z: 20 + i, up: true, glow: myTurn && canPlay(c) && (!U.drawn || U.drawn === c), dim: myTurn && !canPlay(c), mine: true, sel: U.drawn === c })
  })
  U.players.forEach((p, pi) => {
    if (pi === v) return
    const seat = seatPos(rel(pi), n)
    p.hand.forEach((c, i) => { const f = botFan(p.hand.length, i, seat); cards.push({ id: c.id, face: hide(c), x: f.x, y: f.y, rot: f.rot, s: f.s, z: 10 + i, up: U.phase === 'roundOver' }) })
  })
  const top = U.discard.slice(-9)
  U.discard.forEach((c) => { const k = top.indexOf(c); cards.push({ id: c.id, face: c, x: 58 + (k < 0 ? 0 : (k - top.length) * 0.15), y: 45 + (k < 0 ? 0 : (k - top.length) * 0.1), rot: rotOf(c), s: 1, z: 2 + (k < 0 ? 0 : k), up: true }) })
  U.deck.forEach((c, i) => { cards.push({ id: c.id, face: hide(c), x: 41 + i * 0.012, y: 45 - i * 0.012, rot: 0, s: 1, z: 1 + (i / 200), up: false, glow: myTurn && !U.drawn && i === U.deck.length - 1 }) })
  const seats = U.players.map((p, i) => { const pos = seatPos(rel(i), n); const st = U.uno[p.id]; return { id: p.id, name: p.name, avatar: p.avatar, x: pos.x, y: rel(i) === 0 ? 96 : pos.y + (pos.y < 20 ? -9 : pos.x < 20 || pos.x > 80 ? 17 : 9), score: p.score, count: p.hand.length, turn: U.phase === 'play' && U.turn === i, uno: p.hand.length === 1 && st && st.called, danger: p.hand.length === 1 && st && !st.called, human: i === v, bot: !p.human } })
  const buttons = []
  if (U.phase === 'play') {
    buttons.push({ name: 'uno', label: 'UNO!', hot: me.hand.length <= 2, pulse: !!(U.uno[v] && !U.uno[v].called) })
    if (U.players.some((p) => p.id !== v && U.uno[p.id] && !U.uno[p.id].called && p.hand.length === 1)) buttons.push({ name: 'catch', label: 'CATCH!', hot: true, pulse: true })
    if (U.drawn && myTurn) buttons.push({ name: 'pass', label: 'PASS' })
  }
  if (U.phase === 'roundOver' && !U.roundInfo.matchWin && v === 0) buttons.push({ name: 'next', label: 'NEXT ROUND ▶', hot: true, pulse: true })
  const prompt = U.pick && U.pickBy === v ? { type: 'color', colors: COLORS } : U.swapFrom && U.swapFrom.id === v ? { type: 'swap', players: U.players.filter((q) => q !== U.swapFrom).map((q) => ({ id: q.id, name: q.name, count: q.hand.length })) } : null
  return {
    phase: U.phase, msg: viewerMsg(v), seats, cards, buttons, deckClick: true, viewer: v,
    center: { color: U.color, dir: U.dir, pend: U.pend, top: U.top && { id: U.top.id, color: U.top.color, value: U.top.value } },
    prompt, timer: myTurn ? Math.max(0, Math.ceil(U.turnT)) : null,
    info: `ROUND ${U.round} · FIRST TO ${U.opts.target}${U.opts.sevenZero ? ' · SEVEN-0' : ''}${CS.online ? ' · ONLINE' : ''}`,
    scores: U.players.map((p) => [p.name, p.score]),
  }
}
// ---- hooks for the online host ----
export const unoApi = {
  setActor(i) { ACTOR = i },
  players: () => U.players,
  // a human left: a bot takes the seat and finishes any decision they owed
  dropToBot(i) {
    const p = U.players[i]
    if (!p || !p.human) return
    p.human = false; p.cid = null; p.name = p.name.replace(/ 🤖$/, '') + ' 🤖'
    if (U.pick && U.pickBy === i) { const c = U.pick; U.pick = null; playCard(p, c, bestColor(p, c)); return }
    if (U.swapFrom && U.swapFrom.id === i) { const t = U.players.filter((q) => q !== p).sort((x, y) => x.hand.length - y.hand.length)[0]; const f = U.swapNext; swapHands(p, t); U.swapFrom = null; U.swapNext = null; after(0.95, f); return }
    if (U.phase === 'play' && cur().id === i && !U.drawn) after(0.8, botTurn)
    notify()
  },
}
registerCardGame({ id: 'uno', name: 'UNO', start, snap, click, button, tick })
