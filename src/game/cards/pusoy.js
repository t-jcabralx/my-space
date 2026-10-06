// Pusoy Dos (Filipino Big Two): 4 players, 13 cards each. 3 is lowest, 2 is highest. Suits low->high: clubs, spades, hearts, diamonds.
import { CS, after, notify, shuffle, stdDeck, fan, botFan, seatPos, banner, toast, celebrate, finish, registerCardGame, rnd, SYM } from './core.js'
import { sfx, speak } from '../audio.js'
import { profile, saveProfile } from '../engine.js'

const ORDER = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2']
const SO = { C: 0, S: 1, H: 2, D: 3 }
const NAMES = ['YOU', 'MAYA', 'JUN', 'BEA']
const AVATAR = ['😎', '🦊', '🐼', '🐸']
const ro = (c) => ORDER.indexOf(c.rank)
export const strength = (c) => ro(c) * 4 + SO[c.suit]
const rv = (c) => ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'].indexOf(c.rank) + 1
const TYPES = { 1: 'SINGLE', 2: 'PAIR', 3: 'TRIPLE' }
const F5 = ['', 'STRAIGHT', 'FLUSH', 'FULL HOUSE', 'FOUR OF A KIND', 'STRAIGHT FLUSH']

export function evalCombo(cs) {
  const n = cs.length
  if (n === 1) return { n, level: 0, key: strength(cs[0]), name: TYPES[1] }
  if (n === 2 || n === 3) {
    if (!cs.every((c) => c.rank === cs[0].rank)) return null
    return { n, level: 0, key: Math.max(...cs.map(strength)), name: TYPES[n] }
  }
  if (n !== 5) return null
  const cnt = {}
  for (const c of cs) cnt[c.rank] = (cnt[c.rank] || 0) + 1
  const counts = Object.values(cnt).sort((a, b) => b - a)
  const flush = cs.every((c) => c.suit === cs[0].suit)
  const vals = cs.map(rv).sort((a, b) => a - b)
  let straight = false, top = 0
  if (new Set(vals).size === 5) {
    if (vals[4] - vals[0] === 4) { straight = true; top = vals[4] }
    else if (vals.join() === '1,10,11,12,13') { straight = true; top = 14 }
  }
  if (straight) {
    // lowest straights: A-2-3-4-5 counts as top 5, 2-3-4-5-6 top 6 (handled by values 5/6)
    const topCard = cs.filter((c) => (top === 14 ? rv(c) === 1 : rv(c) === top)).sort((a, b) => SO[b.suit] - SO[a.suit])[0]
    const key = top * 4 + SO[topCard.suit]
    if (flush) return { n, level: 5, key, name: F5[5] }
    return { n, level: 1, key, name: F5[1] }
  }
  if (counts[0] === 4) { const q = Object.keys(cnt).find((k) => cnt[k] === 4); return { n, level: 4, key: ORDER.indexOf(q), name: F5[4] } }
  if (counts[0] === 3 && counts[1] === 2) { const t = Object.keys(cnt).find((k) => cnt[k] === 3); return { n, level: 3, key: ORDER.indexOf(t), name: F5[3] } }
  if (flush) { const hi = Math.max(...cs.map(strength)); return { n, level: 2, key: SO[cs[0].suit] * 100 + hi, name: F5[2] } }
  return null
}
export function beats(a, b) {
  if (!b) return !!a
  if (!a || a.n !== b.n) return false
  if (a.n === 5) return a.level > b.level || (a.level === b.level && a.key > b.key)
  return a.key > b.key
}
function combos(hand) {
  const out = []
  const by = {}
  for (const c of hand) (by[c.rank] = by[c.rank] || []).push(c)
  for (const c of hand) out.push([c])
  for (const g of Object.values(by)) {
    for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) out.push([g[i], g[j]])
    for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) for (let k = j + 1; k < g.length; k++) out.push([g[i], g[j], g[k]])
  }
  const n = hand.length
  if (n >= 5) {
    const idx = [0, 1, 2, 3, 4]
    for (;;) {
      const cs = idx.map((i) => hand[i])
      if (evalCombo(cs)) out.push(cs)
      let p = 4
      while (p >= 0 && idx[p] === n - 5 + p) p--
      if (p < 0) break
      idx[p]++
      for (let q = p + 1; q < 5; q++) idx[q] = idx[q - 1] + 1
    }
  }
  return out.map((cs) => ({ cs, ev: evalCombo(cs) })).filter((x) => x.ev)
}
const P = { players: [], turn: 0, table: null, tableOwner: -1, passes: 0, phase: 'idle', first: true, plays: [], sel: new Set(), msg: '', scores: [0, 0, 0, 0], round: 1, sortMode: 'rank', rot: {}, roundInfo: null, target: 40, auto: false, hintFor: null, leader: 0 }
const rotOf = (c) => P.rot[c.id] || (P.rot[c.id] = rnd(-14, 14))

function start(opts) {
  CS.opts = { ...opts, game: 'pusoy' }
  P.players = NAMES.map((name, i) => ({ id: i, name, avatar: AVATAR[i], human: i === 0 && !opts.auto, hand: [] }))
  P.scores = [0, 0, 0, 0]; P.round = 1; P.target = opts.target || 40; P.auto = !!opts.auto
  newRound()
}
function newRound() {
  const d = shuffle(stdDeck())
  P.players.forEach((p) => (p.hand = []))
  P.table = null; P.tableOwner = -1; P.passes = 0; P.first = true; P.plays = []; P.sel = new Set(); P.roundInfo = null; P.rot = {}; P.hintFor = null
  P.phase = 'deal'; P.msg = 'Shuffling…'; sfx('cShuffle'); notify()
  const all = d.map((c) => c)
  P.deckLeft = all
  for (let k = 0; k < 52; k++) after(0.35 + k * 0.07, () => { P.players[k % 4].hand.push(all[k]); P.deckLeft = all.slice(k + 1); sfx('cDeal'); notify() })
  after(0.4 + 52 * 0.07 + 0.2, () => {
    P.leader = P.players.findIndex((p) => p.hand.some((c) => c.rank === '3' && c.suit === 'C'))
    P.turn = P.leader; P.phase = 'play'
    banner(`ROUND ${P.round}`, `${P.players[P.turn].name} HAS THE 3♣ AND LEADS`, '#ffe84a', 1.4)
    notify(); beginTurn()
  })
}
const sorted = (h) => h.slice().sort((a, b) => (P.sortMode === 'suit' ? SO[a.suit] - SO[b.suit] || strength(a) - strength(b) : strength(a) - strength(b)))
function beginTurn() {
  if (P.phase !== 'play') return
  const p = P.players[P.turn]
  if (p.human) P.msg = P.table ? `Beat the ${P.table.name} or pass` : P.first ? 'You lead: your play must include the 3♣' : 'You lead: play anything'
  else P.msg = p.name + ' is thinking…'
  notify()
  if (!p.human) after(rnd(0.9, 1.7), () => botMove(p))
}
function legal(p) {
  const need = P.first && P.leader === p.id
  return combos(p.hand).filter((x) => beats(x.ev, P.table) && (!need || x.cs.some((c) => c.rank === '3' && c.suit === 'C')))
}
function botMove(p) {
  if (P.phase !== 'play') return
  let opts = legal(p)
  if (!opts.length) { passTurn(p); return }
  const minOpp = Math.min(...P.players.filter((q) => q !== p).map((q) => q.hand.length))
  let choice
  if (!P.table) {
    // leading: dump the largest low combo containing our lowest card
    const low = p.hand.slice().sort((a, b) => strength(a) - strength(b))[0]
    let cand = opts.filter((x) => x.cs.includes(low))
    if (!cand.length) cand = opts
    cand.sort((a, b) => b.cs.length - a.cs.length || a.ev.key - b.ev.key)
    choice = minOpp <= 2 ? opts.filter((x) => x.cs.length > 1).sort((a, b) => b.cs.length - a.cs.length || a.ev.key - b.ev.key)[0] || opts.sort((a, b) => b.ev.key - a.ev.key)[0] : cand[0]
  } else {
    opts.sort((a, b) => (a.ev.level - b.ev.level) || a.ev.key - b.ev.key)
    choice = opts[0]
    const high = choice.cs.some((c) => ro(c) >= 11)
    if (high && p.hand.length > 6 && minOpp > 2 && Math.random() < 0.55) { passTurn(p); return }
  }
  playCombo(p, choice.cs, choice.ev)
}
function playCombo(p, cs, ev) {
  p.hand = p.hand.filter((c) => !cs.includes(c))
  P.table = ev; P.tableOwner = p.id; P.passes = 0; P.first = false
  P.plays.push({ cs, owner: p.id })
  P.tableCards = cs
  P.sel = new Set(); P.hintFor = null
  sfx(ev.level >= 3 ? 'cWild' : 'cPlay')
  if (ev.name === 'FOUR OF A KIND' || ev.name === 'STRAIGHT FLUSH') { banner(ev.name + '!', p.name, '#ff4de1', 1) }
  toast(`${p.name}: ${ev.name}`, '#fff')
  if (p.hand.length === 0) { roundWon(p); return }
  if (p.hand.length === 1) { toast(`${p.name} has ONE card left!`, '#ff8a96'); sfx('cUno') }
  P.turn = (P.turn + 1) % 4
  notify(); after(0.6, beginTurn)
}
function passTurn(p) {
  if (!P.table) { sfx('cBad'); return }
  P.passes++; toast(`${p.name} passes`, '#9fd'); sfx('cPass')
  P.turn = (P.turn + 1) % 4
  if (P.passes >= 3) {
    // everyone passed: the last player to play leads a fresh trick
    P.turn = P.tableOwner
    after(0.5, () => { P.table = null; P.passes = 0; P.tableCards = null; toast(`${P.players[P.turn].name} leads`, '#ffe84a'); notify(); after(0.4, beginTurn) })
    notify(); return
  }
  notify(); after(0.45, beginTurn)
}
function penalty(n) { return n >= 13 ? n * 4 : n >= 10 ? n * 3 : n >= 8 ? n * 2 : n }
function roundWon(p) {
  P.phase = 'roundOver'
  let gain = 0
  const rows = P.players.filter((q) => q !== p).map((q) => { const pen = penalty(q.hand.length); gain += pen; return [q.name, q.hand.length, pen] })
  P.scores[p.id] += gain
  P.roundInfo = { winner: p.id, gain, rows, matchWin: P.scores[p.id] >= P.target }
  sfx(p.human ? 'cWin' : 'cLose'); speak(p.human ? 'You win the round!' : p.name + ' wins', 0.9, 1.1)
  if (p.human) celebrate()
  banner(`${p.name} WINS THE ROUND`, `+${gain} POINTS`, '#3dff7a', 2)
  P.msg = ''
  if (P.auto && !P.roundInfo.matchWin) after(2.6, () => { if (P.phase === 'roundOver') { P.round++; newRound() } })
  if (P.roundInfo.matchWin) {
    after(2.4, () => {
      const won = p.human
      profile.cardWins = (profile.cardWins || 0) + (won ? 1 : 0); profile.cardGames = (profile.cardGames || 0) + 1; if (won) profile.pusoyWins = (profile.pusoyWins || 0) + 1
      saveProfile()
      finish({ title: won ? 'YOU WIN THE MATCH!' : p.name + ' WINS THE MATCH', win: won, rows: P.players.map((q) => [q.name, P.scores[q.id]]), score: won ? P.scores[0] : 0, game: 'pusoy' })
      if (won) celebrate()
    })
  }
  notify()
}
function click(id) {
  if (P.phase !== 'play') return
  const me = P.players[0]
  if (!me.human || P.turn !== 0) return
  const c = me.hand.find((x) => x.id === id)
  if (!c) return
  if (P.sel.has(id)) P.sel.delete(id); else { if (P.sel.size >= 5) { sfx('cBad'); return } P.sel.add(id) }
  sfx('cSelect'); notify()
}
function selected() { return P.players[0].hand.filter((c) => P.sel.has(c.id)) }
function button(name) {
  const me = P.players[0]
  if (name === 'sort') { P.sortMode = P.sortMode === 'rank' ? 'suit' : 'rank'; sfx('cShuffle'); notify(); return }
  if (name === 'next') { if (P.phase === 'roundOver' && !P.roundInfo.matchWin) { P.round++; newRound() } return }
  if (P.phase !== 'play' || P.turn !== 0 || !me.human) return
  if (name === 'clear') { P.sel = new Set(); notify(); return }
  if (name === 'hint') {
    const o = legal(me)
    if (!o.length) { toast('No play beats the table: you must pass', '#ff8a96'); sfx('cBad'); return }
    o.sort((a, b) => (a.ev.level - b.ev.level) || a.ev.key - b.ev.key)
    const pick = !P.table ? (o.filter((x) => x.cs.includes(sorted(me.hand)[0])).sort((a, b) => b.cs.length - a.cs.length)[0] || o[0]) : o[0]
    P.sel = new Set(pick.cs.map((c) => c.id)); sfx('cSelect'); notify(); return
  }
  if (name === 'pass') { if (!P.table) { toast('You must lead: you cannot pass', '#ff8a96'); sfx('cBad'); return } P.sel = new Set(); passTurn(me); return }
  if (name === 'play') {
    const cs = selected()
    const ev = evalCombo(cs)
    if (!ev) { toast('Not a valid combination', '#ff8a96'); sfx('cBad'); return }
    if (P.first && P.leader === 0 && !cs.some((c) => c.rank === '3' && c.suit === 'C')) { toast('First play must include the 3♣', '#ff8a96'); sfx('cBad'); return }
    if (!beats(ev, P.table)) { toast(P.table ? `Must beat the ${P.table.name}` : 'Cannot play that', '#ff8a96'); sfx('cBad'); return }
    playCombo(me, cs, ev)
  }
}
function snap() {
  const cards = []
  const me = P.players[0]
  const myTurn = P.phase === 'play' && P.turn === 0 && me.human
  const selCards = selected()
  const selEv = selCards.length ? evalCombo(selCards) : null
  sorted(me.hand).forEach((c, i) => {
    const f = fan(me.hand.length, i, { cx: 50, cy: 85, spread: 5.8, max: 60, arc: 1.2, curve: 0.2 })
    cards.push({ id: c.id, face: c, x: f.x, y: P.sel.has(c.id) ? f.y - 5 : f.y, rot: f.rot, s: 1, z: 20 + i, up: true, mine: true, sel: P.sel.has(c.id), dim: !myTurn && P.phase === 'play' })
  })
  P.players.forEach((p, pi) => {
    if (pi === 0) return
    const seat = seatPos(pi, 4)
    p.hand.forEach((c, i) => { const f = botFan(p.hand.length, i, seat, 0.5); cards.push({ id: c.id, face: c, x: f.x, y: f.y, rot: f.rot, s: f.s, z: 10 + i, up: P.phase === 'roundOver' }) })
  })
  const inHand = new Set(cards.map((c) => c.id))
  const cur = P.tableCards || []
  const old = P.plays.slice(0, P.tableCards ? -1 : undefined)
  const oldCards = old.flatMap((pl) => pl.cs)
  oldCards.forEach((c, i) => { if (!inHand.has(c.id) && !cur.includes(c)) cards.push({ id: c.id, face: c, x: 27 + (i % 7) * 0.2, y: 44 + (i % 5) * 0.2, rot: rotOf(c), s: 0.7, z: 1 + i * 0.01, up: true, dim: true }) })
  cur.forEach((c, i) => { const f = fan(cur.length, i, { cx: 50, cy: 43, spread: 5.6, max: 30, arc: 2.2, curve: 0.15 }); cards.push({ id: c.id, face: c, x: f.x, y: f.y, rot: f.rot + rotOf(c) * 0.1, s: 1.05, z: 30 + i, up: true, glow: true }) })
  const left = (P.deckLeft || []).filter((c) => !inHand.has(c.id) && !cards.some((x) => x.id === c.id))
  left.forEach((c, i) => cards.push({ id: c.id, face: c, x: 50, y: 40 - i * 0.02, rot: 0, s: 1, z: 1, up: false }))
  const seats = P.players.map((p, i) => { const pos = seatPos(i, 4); return { id: i, name: p.name, avatar: p.avatar, x: pos.x, y: i === 0 ? 96 : pos.y + (pos.y < 20 ? -9 : 17), score: P.scores[i], count: p.hand.length, turn: P.phase === 'play' && P.turn === i, human: p.human, status: P.tableOwner === i && P.table ? 'LEADING' : '' } })
  const buttons = []
  if (P.phase === 'play' && me.human) {
    buttons.push({ name: 'play', label: 'PLAY ▶', hot: true, off: !myTurn || !selEv || !beats(selEv, P.table) || (P.first && P.leader === 0 && !selCards.some((c) => c.rank === '3' && c.suit === 'C')), pulse: myTurn && !!selEv })
    buttons.push({ name: 'pass', label: 'PASS', off: !myTurn || !P.table })
    buttons.push({ name: 'hint', label: 'HINT', off: !myTurn })
    buttons.push({ name: 'clear', label: 'CLEAR', off: !P.sel.size })
  }
  buttons.push({ name: 'sort', label: P.sortMode === 'rank' ? 'SORT: RANK' : 'SORT: SUIT' })
  if (P.phase === 'roundOver' && !P.roundInfo.matchWin) buttons.push({ name: 'next', label: 'NEXT ROUND ▶', hot: true, pulse: true })
  return {
    phase: P.phase, msg: P.msg, seats, cards, buttons,
    center: { combo: P.table ? P.table.name : null, owner: P.tableOwner >= 0 ? P.players[P.tableOwner].name : null, sel: selEv ? selEv.name : selCards.length ? 'INVALID' : null },
    info: `ROUND ${P.round} · FIRST TO ${P.target} POINTS`, scores: P.players.map((p, i) => [p.name, P.scores[i]]),
    roundInfo: P.roundInfo,
  }
}
registerCardGame({ id: 'pusoy', name: 'PUSOY DOS', start, snap, click, button })
