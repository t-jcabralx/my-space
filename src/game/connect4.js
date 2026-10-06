// CONNECT FOUR: drop discs, join four. Vs bot (3 levels), 2 players on one screen, or online 1v1.
import { G, emit as engineEmit, games, profile, saveProfile, recordScore, toMenu } from './engine.js'
import { sfx, music } from './audio.js'

const COLS = 7, ROWS = 6
export const C4 = { mode: 'idle', cfg: { type: 'bot', diff: 2 }, b: [], turn: 1, win: 0, line: null, last: null, moves: 0, over: null, net: null, think: 0, msg: '', t: 0 }
let snap = null
const subs = new Set()
export const subscribeC4 = (f) => { subs.add(f); return () => subs.delete(f) }
export const getC4Snap = () => snap
const mine = () => (C4.net ? (C4.net.role === 'guest' ? 2 : 1) : C4.cfg.type === 'bot' ? 1 : 0)
function emitC() {
  snap = { mode: C4.mode, type: C4.cfg.type, diff: C4.cfg.diff, b: C4.b.map((r) => r.slice()), turn: C4.turn, win: C4.win, line: C4.line, last: C4.last, over: C4.over, my: mine(), net: C4.net ? C4.net.role : null, names: C4.cfg.type === 'bot' ? ['YOU', 'BOT'] : C4.net ? (C4.net.role === 'guest' ? ['HOST', 'YOU'] : ['YOU', 'FRIEND']) : ['PLAYER 1', 'PLAYER 2'], thinking: C4.think > 0 }
  subs.forEach((f) => f())
}
const fresh = () => Array.from({ length: ROWS }, () => Array(COLS).fill(0))
function start(cfg = {}) {
  C4.cfg = { type: 'bot', diff: 2, ...cfg }
  if (C4.cfg.type !== 'online') C4.net = null
  C4.b = fresh(); C4.turn = 1; C4.win = 0; C4.line = null; C4.last = null; C4.moves = 0; C4.over = null; C4.think = 0; C4.endT = 0
  G.mode = 'c4'; engineEmit(); C4.mode = 'play'
  music.set('cards', 0); sfx('ui'); emitC()
}
function stop() { C4.mode = 'idle'; if (C4.net) { const n = C4.net; C4.net = null; if (n.onStop) try { n.onStop() } catch { /* ignore */ } } music.set('menu'); emitC() }
const rowFor = (b, c) => { for (let r = ROWS - 1; r >= 0; r--) if (!b[r][c]) return r; return -1 }
export function findLine(b, p) {
  const D = [[0, 1], [1, 0], [1, 1], [1, -1]]
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (b[r][c] !== p) continue
    for (const [dr, dc] of D) {
      const cells = [[r, c]]
      for (let k = 1; k < 4; k++) { const rr = r + dr * k, cc = c + dc * k; if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS || b[rr][cc] !== p) break; cells.push([rr, cc]) }
      if (cells.length === 4) return cells
    }
  }
  return null
}
function drop(c, who) {
  if (C4.mode !== 'play' || C4.win || who !== C4.turn) return false
  const r = rowFor(C4.b, c)
  if (r < 0) { sfx('cBad'); return false }
  C4.b[r][c] = who; C4.last = [r, c]; C4.moves++
  sfx('plClack', 0.6)
  const line = findLine(C4.b, who)
  if (line) { C4.win = who; C4.line = line; C4.endT = 0.65 }
  else if (C4.moves >= ROWS * COLS) { C4.win = 3; C4.endT = 0.4 }
  else C4.turn = who === 1 ? 2 : 1
  emitC()
  if (C4.net && C4.net.role === 'host') C4.net.state(pack())
  return true
}
function finish() {
  if (C4.mode !== 'play') return
  C4.mode = 'over'; music.stop()
  const me = mine() || 1, won = C4.win === me, draw = C4.win === 3
  C4.over = { winner: C4.win, win: C4.cfg.type === '2p' ? C4.win !== 3 : won, draw, moves: C4.moves }
  if (C4.cfg.type !== '2p' && !draw) {
    profile.c4Games = (profile.c4Games || 0) + 1
    if (won) { profile.c4Wins = (profile.c4Wins || 0) + 1; const sc = Math.max(100, 1000 - C4.moves * 12 + (C4.cfg.type === 'bot' ? C4.cfg.diff * 200 : 300)); C4.over.points = sc; recordScore('c4', sc) }
    saveProfile()
  }
  sfx(C4.over.win ? 'win' : draw ? 'ui' : 'over'); emitC()
}
// ---------- bot (minimax with alpha-beta) ----------
function score(b, p) {
  const o = p === 1 ? 2 : 1
  let s = 0
  const win = (cells) => { let a = 0, e = 0, x = 0; for (const [r, c] of cells) { if (b[r][c] === p) a++; else if (b[r][c] === o) x++; else e++ } if (a === 4) return 100000; if (x === 4) return -100000; if (a === 3 && e === 1) return 60; if (a === 2 && e === 2) return 12; if (x === 3 && e === 1) return -75; if (x === 2 && e === 2) return -8; return 0 }
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) { const cells = []; for (let k = 0; k < 4; k++) { const rr = r + dr * k, cc = c + dc * k; if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS) break; cells.push([rr, cc]) } if (cells.length === 4) s += win(cells) }
  for (let r = 0; r < ROWS; r++) if (b[r][3] === p) s += 6
  return s
}
function search(b, depth, alpha, beta, turn, me) {
  const l1 = findLine(b, me), l2 = findLine(b, me === 1 ? 2 : 1)
  if (l1) return [null, 1e6 + depth]
  if (l2) return [null, -1e6 - depth]
  const cols = [3, 2, 4, 1, 5, 0, 6].filter((c) => rowFor(b, c) >= 0)
  if (!cols.length) return [null, 0]
  if (depth === 0) return [null, score(b, me)]
  let best = cols[0]
  if (turn === me) {
    let v = -Infinity
    for (const c of cols) { const r = rowFor(b, c); b[r][c] = turn; const [, s] = search(b, depth - 1, alpha, beta, turn === 1 ? 2 : 1, me); b[r][c] = 0; if (s > v) { v = s; best = c } alpha = Math.max(alpha, v); if (alpha >= beta) break }
    return [best, v]
  }
  let v = Infinity
  for (const c of cols) { const r = rowFor(b, c); b[r][c] = turn; const [, s] = search(b, depth - 1, alpha, beta, turn === 1 ? 2 : 1, me); b[r][c] = 0; if (s < v) { v = s; best = c } beta = Math.min(beta, v); if (alpha >= beta) break }
  return [best, v]
}
export const botMove = (b, diff, me = 2) => {
  const cols = [0, 1, 2, 3, 4, 5, 6].filter((c) => rowFor(b, c) >= 0)
  if (diff === 1 && Math.random() < 0.35) return cols[(Math.random() * cols.length) | 0]
  return search(b.map((r) => r.slice()), [0, 2, 4, 6][diff], -Infinity, Infinity, me, me)[0]
}
function update(dt) {
  if (C4.mode !== 'play') return
  C4.t += dt
  if (C4.endT > 0) { C4.endT -= dt; if (C4.endT <= 0) { C4.endT = 0; finish() } return }
  if (C4.cfg.type === 'bot' && C4.turn === 2 && !C4.win) {
    if (C4.think <= 0) { C4.think = 0.7 + Math.random() * 0.5; emitC() }
    C4.think -= dt
    if (C4.think <= 0) { C4.think = 0; drop(botMove(C4.b, C4.cfg.diff, 2), 2) }
  }
}
function onKey(code) {
  if (C4.mode === 'idle') return
  if (code === 'Escape') return toMenu()
  if (C4.mode === 'over' && code === 'Enter') return c4Actions.rematch()
  const n = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7'].indexOf(code)
  if (n >= 0) c4Actions.play(n)
}
export const c4Actions = {
  start, stop, quit() { toMenu() },
  play(c) {
    if (C4.mode !== 'play') return
    const m = mine()
    if (C4.net && C4.net.role === 'guest') { if (C4.turn === 2) C4.net.input({ c }); return }
    if (C4.cfg.type === 'bot' && C4.turn !== 1) return
    if (C4.net && C4.turn !== 1) return
    drop(c, C4.turn); void m
  },
  rematch() { if (C4.net) { C4.net.rematch(); return } start(C4.cfg) },
}
// ---------- online ----------
const pack = () => ({ b: C4.b, turn: C4.turn, win: C4.win, line: C4.line, last: C4.last, moves: C4.moves })
let lastN = 0
export const c4Net = {
  attach(net) { C4.net = net },
  active: () => !!C4.net && C4.mode !== 'idle',
  reset() { lastN = 0 },
  sync() { if (C4.net && C4.net.role === 'host') C4.net.state(pack()) },
  applyInput(m) { if (C4.net && C4.net.role === 'host' && m && C4.turn === 2) drop((m.c | 0), 2) },
  applyState(s) {
    if (!C4.net || C4.net.role !== 'guest' || !s || C4.mode === 'idle') return
    const moved = s.moves !== C4.moves
    C4.b = s.b; C4.turn = s.turn; C4.win = s.win; C4.line = s.line; C4.last = s.last; C4.moves = s.moves
    if (moved) sfx('plClack', 0.6)
    if (s.win && C4.mode === 'play') C4.endT = 0.65
    emitC()
  },
  opponentLeft() { if (C4.net && C4.mode === 'play') { C4.win = C4.net.role === 'guest' ? 2 : 1; finish() } },
}
if (typeof window !== 'undefined') { window.__C4 = C4; window.__c4 = c4Actions }
games.c4 = { update, onKey, draw() {}, stop, sky: () => '#070a14' }
