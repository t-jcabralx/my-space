// Tetra Blast: full-featured Tetris. SRS rotation + wall kicks, 7-bag, hold, ghost, DAS/ARR, lock delay,
// T-spins, back-to-back, combos, perfect clears, garbage battles vs a heuristic bot or a 2nd player. Pure JS.
import { G, keys, games, profile, saveProfile, recordScore, part, ring, shake, flash, popup, COLS, stepParticles, toMenu } from './engine.js'
import { rgb } from './sprites.js'
import { sfx, music, speak } from './audio.js'

const W = 10, HV = 20, H = 22, CS = 2.2, YB = -23
const R = (a, b) => a + Math.random() * (b - a)
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
const KINDS = 'IJLOSTZ'
export const COLORS = { I: '#3de8ff', J: '#4d7bff', L: '#ff9a2e', O: '#ffe84a', S: '#3dff7a', T: '#b04dff', Z: '#ff3b4e', G: '#7a8499' }
const BASE = {
  I: { n: 4, c: [[0, 1], [1, 1], [2, 1], [3, 1]] }, J: { n: 3, c: [[0, 0], [0, 1], [1, 1], [2, 1]] }, L: { n: 3, c: [[2, 0], [0, 1], [1, 1], [2, 1]] },
  O: { n: 2, c: [[0, 0], [1, 0], [0, 1], [1, 1]] }, S: { n: 3, c: [[1, 0], [2, 0], [0, 1], [1, 1]] }, T: { n: 3, c: [[1, 0], [0, 1], [1, 1], [2, 1]] }, Z: { n: 3, c: [[0, 0], [1, 0], [1, 1], [2, 1]] },
}
export const SHAPES = {}
for (const k of KINDS) {
  SHAPES[k] = []
  let cells = BASE[k].c.map((c) => c.slice())
  for (let r = 0; r < 4; r++) { SHAPES[k].push(cells.map((c) => c.slice())); cells = cells.map(([x, y]) => [BASE[k].n - 1 - y, x]) }
}
// SRS wall kicks (written y-up, converted to y-down below)
const KJ = { '01': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]], '10': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]], '12': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]], '21': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]], '23': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]], '32': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]], '30': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]], '03': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]] }
const KI = { '01': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]], '10': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]], '12': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]], '21': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]], '23': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]], '32': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]], '30': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]], '03': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]] }
const kicks = (kind, from, to) => (kind === 'I' ? KI : KJ)[`${from}${to}`].map(([x, y]) => [x, -y])

export const MODES = {
  marathon: { name: 'MARATHON', desc: 'Clear 150 lines. It speeds up every 10 lines.', boards: 1, goal: { lines: 150 } },
  sprint:   { name: 'SPRINT 40', desc: 'Clear 40 lines as fast as you can.', boards: 1, goal: { lines: 40 } },
  ultra:    { name: 'ULTRA 2:00', desc: 'Score as much as you can in 2 minutes.', boards: 1, goal: { time: 120 } },
  zen:      { name: 'ZEN', desc: 'Relax. Endless play, no game over.', boards: 1, zen: true },
  bot:      { name: 'VS BOT', desc: 'Battle a bot: clear lines to send garbage.', boards: 2, versus: true, humans: [0] },
  versus:   { name: '2P VERSUS', desc: 'Two players on one keyboard.', boards: 2, versus: true, humans: [0, 1] },
  demo:     { name: 'BOT vs BOT', desc: 'Watch two bots battle (demo).', boards: 2, versus: true, humans: [] },
}
const DIFF = [{ name: 'EASY', delay: 0.2, lookahead: false, miss: 0.14 }, { name: 'MEDIUM', delay: 0.1, lookahead: false, miss: 0.04 }, { name: 'HARD', delay: 0.045, lookahead: true, miss: 0 }]
const DAS = 0.135, ARR = 0.032, LOCK = 0.5

export const T = { mode: 'idle', paused: false, phase: 'ready', cfg: { type: 'marathon', level: 1, diff: 2 }, bd: [], t: 0, readyT: 0, elapsed: 0, over: null, msgs: [], emitT: 0, lvlFlash: 0, bgSeed: [] }
let snap = null
const subs = new Set()
export const subscribeTetris = (f) => { subs.add(f); return () => subs.delete(f) }
export const getTetrisSnap = () => snap
function emitT() {
  const m = MODES[T.cfg.type]
  snap = {
    mode: T.mode, paused: T.paused, phase: T.phase, type: T.cfg.type, modeName: m.name, versus: !!m.versus, diff: DIFF[T.cfg.diff - 1].name, countdown: T.phase === 'ready' ? Math.ceil(T.readyT) : 0,
    time: T.elapsed, goal: m.goal || null, over: T.over, msgs: T.msgs.map((x) => ({ ...x })),
    boards: T.bd.map((b) => ({ id: b.id, human: b.human, name: b.name, score: b.score, lines: b.lines, level: b.level, combo: Math.max(0, b.combo), b2b: b.b2b, pending: b.pending.reduce((a, x) => a + x, 0), dead: b.dead, pps: T.elapsed > 1 ? +(b.stats.pieces / T.elapsed).toFixed(2) : 0, danger: b.danger, attack: b.stats.sent })),
  }
  subs.forEach((f) => f())
}
const say = (b, text, sub, color = '#fff') => { T.msgs.push({ id: ++G.uid, board: b.id, text, sub, color, t: 1.4 }); if (T.msgs.length > 6) T.msgs.shift() }

// ---------- boards ----------
function newBoard(id, human, name) {
  return {
    id, human, name, grid: Array.from({ length: H }, () => Array(W).fill(null)), fl: Array.from({ length: H }, () => new Float32Array(W)), rowOff: new Float32Array(H),
    piece: null, hold: null, canHold: true, queue: [], bag: [], score: 0, lines: 0, level: 1, combo: -1, b2b: false, gravT: 0, lockT: 0, lockResets: 0, onGround: false,
    das: { dir: 0, t: 0 }, state: 'wait', clearRows: [], clearT: 0, areT: 0, pending: [], dead: false, danger: false, trails: [], stats: { pieces: 0, tetrises: 0, tspins: 0, maxCombo: 0, sent: 0 },
    cx: 0, plan: null, actT: 0, deadT: 0, goalDone: false, soft: false,
  }
}
function refill(b) { const bag = KINDS.split(''); for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]] } b.bag.push(...bag) }
function nextKind(b) { while (b.queue.length < 7) { if (!b.bag.length) refill(b); b.queue.push(b.bag.shift()) } return b.queue.shift() }
function start(type = 'marathon', level = 1, diff = 2) {
  const m = MODES[type]
  T.cfg = { type, level, diff }
  const humans = m.humans || [0]
  T.bd = []
  const count = m.boards
  for (let i = 0; i < count; i++) {
    const h = humans.indexOf(i) >= 0 ? humans.indexOf(i) + 1 : 0
    const b = newBoard(i, h, m.versus ? (h ? (humans.length > 1 ? 'P' + h : 'YOU') : 'BOT') : 'YOU')
    b.level = level
    T.bd.push(b)
  }
  T.bd[0].cx = m.versus ? -27 : 0
  if (m.versus) T.bd[1].cx = 27
  T.over = null; T.msgs = []; T.elapsed = 0; T.t = 0; T.lvlFlash = 0
  T.bgSeed = Array.from({ length: 12 }, () => ({ k: KINDS[(Math.random() * 7) | 0], x: R(-48, 48), y: R(-30, 30), rot: (Math.random() * 4) | 0, v: R(1.5, 4) }))
  G.mode = 'tetris'; G.parts = []; G.pops = []; G.shake = 0; G.flash = 0
  T.mode = 'play'; T.paused = false; T.phase = 'ready'; T.readyT = 3.4; T.lastCount = 4
  for (const b of T.bd) { b.state = 'wait'; spawn(b) ; b.piece = null }
  music.set('tetris', 0); sfx('mission'); emitT()
}
function stop() { T.mode = 'idle'; T.paused = false; music.set('menu'); emitT() }

// ---------- piece logic ----------
const cellsOf = (kind, rot, x, y) => SHAPES[kind][rot].map(([cx, cy]) => [x + cx, y + cy])
function fits(b, kind, rot, x, y) {
  for (const [cx, cy] of cellsOf(kind, rot, x, y)) { if (cx < 0 || cx >= W || cy >= H) return false; if (cy >= 0 && b.grid[cy][cx]) return false }
  return true
}
function spawn(b, forceKind) {
  const kind = forceKind || nextKind(b)
  const x = kind === 'O' ? 4 : 3
  b.piece = { kind, rot: 0, x, y: 0, yf: -1, pop: 0.12, last: 'none', kick: 0 }
  b.canHold = true; b.gravT = 0; b.lockT = 0; b.lockResets = 0; b.onGround = false; b.state = 'play'
  if (!fits(b, kind, 0, x, 0)) { topOut(b); return }
  if (fits(b, kind, 0, x, 1)) b.piece.y = 1
  b.piece.yf = b.piece.y - 1
}
function groundCheck(b) { const p = b.piece; b.onGround = !fits(b, p.kind, p.rot, p.x, p.y + 1) }
function touchReset(b) { if (b.onGround && b.lockResets < 15) { b.lockT = 0; b.lockResets++ } }
function move(b, dx) {
  const p = b.piece
  if (!p || b.state !== 'play') return false
  if (fits(b, p.kind, p.rot, p.x + dx, p.y)) { p.x += dx; p.last = 'move'; groundCheck(b); touchReset(b); sfx('tMove'); return true }
  return false
}
function rotate(b, dir) {
  const p = b.piece
  if (!p || b.state !== 'play' || p.kind === 'O') return false
  const to = (p.rot + dir + 4) % 4
  const ks = kicks(p.kind, p.rot, to)
  for (let i = 0; i < ks.length; i++) {
    const [kx, ky] = ks[i]
    if (fits(b, p.kind, to, p.x + kx, p.y + ky)) { p.rot = to; p.x += kx; p.y += ky; p.last = 'rot'; p.kick = i; groundCheck(b); touchReset(b); sfx('tRotate'); return true }
  }
  return false
}
function ghostY(b) { const p = b.piece; let y = p.y; while (fits(b, p.kind, p.rot, p.x, y + 1)) y++; return y }
function hold(b) {
  if (!b.piece || !b.canHold || b.state !== 'play') return
  const k = b.piece.kind
  const prev = b.hold
  b.hold = k
  sfx('tHold')
  if (prev) spawn(b, prev); else spawn(b)
  b.canHold = false
}
function hardDrop(b) {
  const p = b.piece
  if (!p || b.state !== 'play') return
  const gy = ghostY(b)
  const dist = gy - p.y
  if (dist > 0) { b.score += dist * 2; p.last = 'drop'; b.trails.push({ x: p.x, y0: p.y, y1: gy, kind: p.kind, rot: p.rot, t: 0.25 }) }
  p.y = gy; p.yf = gy
  sfx('tDrop')
  const x = bx(b, p.x + 2), y = by(gy + 2)
  ring(x, y, 14, 28, COLS.cyan)
  shake(0.25 + Math.min(dist, 18) * 0.02)
  lockPiece(b)
}
const bx = (b, c) => b.cx + (c - W / 2 + 0.5) * CS
const by = (r) => YB + (H - 1 - r + 0.5) * CS
function isTSpin(b) {
  const p = b.piece
  if (p.kind !== 'T' || p.last !== 'rot') return 0
  const corners = [[0, 0], [2, 0], [0, 2], [2, 2]].map(([dx, dy]) => { const x = p.x + dx, y = p.y + dy; return x < 0 || x >= W || y >= H || (y >= 0 && b.grid[y][x]) ? 1 : 0 })
  const n = corners.reduce((a, c) => a + c, 0)
  if (n < 3) return 0
  // corners in front of the T's pointing direction: rot 0 -> top (0,1), 1 -> right (1,3), 2 -> bottom (2,3), 3 -> left (0,2)
  const front = [[0, 1], [1, 3], [2, 3], [0, 2]][p.rot]
  const frontFilled = corners[front[0]] + corners[front[1]]
  return frontFilled === 2 || p.kick === 4 ? 2 : 1 // 2 = full t-spin, 1 = mini
}
function lockPiece(b) {
  const p = b.piece
  const spin = isTSpin(b)
  let top = false
  for (const [cx, cy] of cellsOf(p.kind, p.rot, p.x, p.y)) {
    if (cy < 0) { top = true; continue }
    b.grid[cy][cx] = p.kind; b.fl[cy][cx] = 0.18
    if (cy < 2) top = true
  }
  b.stats.pieces++
  sfx('tLock')
  for (const [cx, cy] of cellsOf(p.kind, p.rot, p.x, p.y)) if (cy >= 0) part(bx(b, cx), by(cy), R(-6, 6), R(-4, 10), 0.3, rgb(COLORS[p.kind]), 0.9, 2)
  b.piece = null
  const rows = []
  for (let r = 0; r < H; r++) if (b.grid[r].every((c) => c)) rows.push(r)
  if (top && !rows.length) { topOut(b); return }
  if (rows.length) startClear(b, rows, spin, p)
  else {
    b.combo = -1
    applyGarbage(b)
    if (b.dead) return
    b.state = 'are'; b.areT = 0.06
  }
}
function startClear(b, rows, spin, p) {
  const n = rows.length
  b.combo++
  b.stats.maxCombo = Math.max(b.stats.maxCombo, b.combo)
  const hard = n === 4 || spin > 0
  const gotB2B = hard && b.b2b
  let pts = 0, label = ['', 'SINGLE', 'DOUBLE', 'TRIPLE', 'TETRIS!'][n]
  if (spin === 2) { pts = [400, 800, 1200, 1600][n]; label = 'T-SPIN ' + ['', 'SINGLE', 'DOUBLE', 'TRIPLE'][n]; b.stats.tspins++; profile.tspins = (profile.tspins || 0) + (b.human ? 1 : 0) }
  else if (spin === 1) { pts = [100, 200, 400][n] || 400; label = 'T-SPIN MINI'; b.stats.tspins++ }
  else pts = [0, 100, 300, 500, 800][n]
  if (n === 4) { b.stats.tetrises++; profile.tetrises = (profile.tetrises || 0) + (b.human ? 1 : 0) }
  pts *= b.level
  if (gotB2B) pts = Math.round(pts * 1.5)
  if (b.combo > 0) pts += 50 * b.combo * b.level
  b.score += pts
  b.b2b = hard ? true : false
  b.lines += n
  b.clearRows = rows; b.clearT = 0.42; b.state = 'clear'
  profile.tetrisLines = (profile.tetrisLines || 0) + (b.human ? n : 0)
  // effects
  for (const r of rows) for (let c = 0; c < W; c++) {
    const k = b.grid[r][c]
    for (let i = 0; i < 2; i++) part(bx(b, c), by(r), R(-34, 34), R(-10, 42), R(0.5, 1.0), i ? [1, 1, 1] : rgb(COLORS[k === 'G' ? 'G' : k]), R(1, 1.9), 1.2, 60)
  }
  const cxm = b.cx, cym = by(rows[Math.floor(rows.length / 2)])
  ring(cxm, cym, 30, 55, n === 4 ? COLS.cyan : COLS.fire)
  const big = n === 4 || spin === 2
  shake(big ? 1.6 : 0.5 + n * 0.15)
  if (big) flash(0.35, n === 4 ? [0.5, 0.9, 1] : [0.8, 0.5, 1])
  sfx(n === 4 ? 'tTetris' : 'tClear', n)
  if (spin) sfx('tSpin')
  if (b.combo >= 1) sfx('tCombo', b.combo)
  say(b, label, (gotB2B ? 'BACK-TO-BACK  ' : '') + (b.combo >= 1 ? `${b.combo} COMBO` : ''), n === 4 ? '#3de8ff' : spin ? '#b04dff' : '#ffffff')
  if (b.human) speak(n === 4 ? 'Tetris!' : spin === 2 ? 'T spin!' : '', 0.5, 1.2)
  popup(cxm, cym + 3, '+' + pts, [1, 1, 0.5])
  // attack
  const t = T.cfg
  if (MODES[t.type].versus) {
    let atk = spin === 2 ? [0, 2, 4, 6][n] : spin === 1 ? [0, 0, 1][n] || 1 : [0, 0, 1, 2, 4][n]
    if (gotB2B && atk > 0) atk += 1
    atk += [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 4, 5][Math.min(b.combo, 11)]
    // perfect clear check happens after removal; handled in finishClear
    b.attackPending = atk
  }
  b.clearSpin = spin
}
function finishClear(b) {
  const rows = b.clearRows.slice().sort((a, c) => a - c)
  const n = rows.length
  const old = b.grid
  const ng = []
  const offs = new Float32Array(H)
  let removedBelow = 0
  const keep = []
  for (let r = H - 1; r >= 0; r--) { if (rows.includes(r)) { removedBelow++; continue } keep.push({ row: old[r], moved: removedBelow }) }
  for (let i = 0; i < H; i++) {
    const src = keep[i]
    const rr = H - 1 - i
    if (src) { ng[rr] = src.row; offs[rr] = src.moved * CS } else ng[rr] = Array(W).fill(null)
  }
  b.grid = ng; b.rowOff = offs; b.fl = Array.from({ length: H }, () => new Float32Array(W))
  b.clearRows = []
  if (b.grid.every((row) => row.every((c) => !c))) {
    b.score += [0, 800, 1200, 1800, 2000][n] * b.level
    say(b, 'PERFECT CLEAR!', '', '#ffe84a'); sfx('tPC'); flash(0.6, [1, 1, 0.6]); shake(2); ring(b.cx, 0, 60, 70, COLS.fire)
    if (b.human) speak('Perfect clear!', 0.5, 1.15)
    if (MODES[T.cfg.type].versus) b.attackPending = (b.attackPending || 0) + 10
  }
  // level up
  const lvl = Math.min(20, Math.floor(b.lines / 10) + T.cfg.level)
  if (lvl > b.level && !MODES[T.cfg.type].versus) {
    b.level = lvl; T.lvlFlash = 1; sfx('tLevel'); say(b, 'LEVEL ' + lvl, '', '#ffe84a'); flash(0.25, [1, 1, 0.7]); music.set('tetris', Math.min(9, lvl - 1))
  }
  // attacks: cancel incoming first
  if (b.attackPending) {
    let atk = b.attackPending
    while (atk > 0 && b.pending.length) { const take = Math.min(atk, b.pending[0]); b.pending[0] -= take; atk -= take; if (b.pending[0] <= 0) b.pending.shift() }
    if (atk > 0) { const opp = T.bd.find((o) => o !== b && !o.dead); if (opp) { opp.pending.push(atk); b.stats.sent += atk; sfx('tGarbage'); popup(opp.cx, 18, '⚠ +' + atk, [1, 0.3, 0.3]) } }
    b.attackPending = 0
  } else if (b.combo < 0) applyGarbage(b)
  checkGoals(b)
  b.state = 'are'; b.areT = 0.1
}
function applyGarbage(b) {
  if (!b.pending.length) return
  let n = 0
  while (b.pending.length && n < 8) { const take = Math.min(b.pending[0], 8 - n); n += take; b.pending[0] -= take; if (b.pending[0] <= 0) b.pending.shift() }
  if (!n) return
  const hole = Math.floor(Math.random() * W)
  // anything pushed above the top is a top-out
  for (let r = 0; r < n; r++) if (b.grid[r].some((c) => c)) { b.grid.splice(0, n); for (let i = 0; i < n; i++) b.grid.push(garbageRow(hole)); topOut(b); return }
  b.grid.splice(0, n)
  for (let i = 0; i < n; i++) b.grid.push(garbageRow(i === 0 || Math.random() < 0.7 ? hole : Math.floor(Math.random() * W)))
  b.rowOff = new Float32Array(H).fill(n * CS * 0.9)
  sfx('tGarbage'); shake(0.7); popup(b.cx, -18, '+' + n, [1, 0.4, 0.4])
}
const garbageRow = (hole) => Array.from({ length: W }, (_, c) => (c === hole ? null : 'G'))
function topOut(b) {
  const m = MODES[T.cfg.type]
  if (m.zen) { b.grid = Array.from({ length: H }, () => Array(W).fill(null)); sfx('tHold'); ring(b.cx, 0, 40, 60, COLS.cyan); spawn(b); return }
  b.dead = true; b.state = 'dead'; b.piece = null
  sfx('tTop'); shake(2.2); flash(0.5, [1, 0.2, 0.2])
  if (!m.versus) endGame(false)
  else {
    const alive = T.bd.filter((o) => !o.dead)
    if (alive.length <= 1) endGame(alive.length === 1 ? alive[0] : null)
  }
}
function checkGoals(b) {
  const g = MODES[T.cfg.type].goal
  if (g && g.lines && b.lines >= g.lines && !b.goalDone) { b.goalDone = true; endGame(true) }
}
function endGame(result) {
  if (T.over) return
  const m = MODES[T.cfg.type]
  const b0 = T.bd.find((b) => b.human) || T.bd[0]
  let win = false, title = ''
  if (m.versus) { const w = result; win = !!(w && w.human); title = w ? (w.human ? (T.bd.filter((x) => x.human).length > 1 ? w.name + ' WINS!' : 'YOU WIN!') : 'BOT WINS') : 'DRAW'; if (w && m.humans.length === 1 && !w.human) win = false }
  else if (m.goal && m.goal.lines) { win = !!result; title = win ? (T.cfg.type === 'sprint' ? 'SPRINT COMPLETE!' : 'MARATHON COMPLETE!') : 'GAME OVER' }
  else if (m.goal && m.goal.time) { win = T.elapsed >= m.goal.time - 0.01; title = win ? "TIME'S UP!" : 'GAME OVER' }
  else title = 'GAME OVER'
  let score = 0
  if (T.cfg.type === 'sprint') score = win ? Math.max(1, 100000 - Math.round(T.elapsed * 100)) : 0
  else if (T.cfg.type === 'bot') score = Math.round(b0.score / 10 + (win ? 3000 : 0) + b0.stats.sent * 60)
  else if (T.cfg.type === 'marathon' || T.cfg.type === 'ultra') score = b0.score
  T.over = { win, title, score, time: T.elapsed, lines: b0.lines, tetrises: b0.stats.tetrises, tspins: b0.stats.tspins, maxCombo: b0.stats.maxCombo, pps: T.elapsed > 1 ? +(b0.stats.pieces / T.elapsed).toFixed(2) : 0, pieces: b0.stats.pieces, boardScore: b0.score, type: T.cfg.type, scores: T.bd.map((b) => b.score) }
  T.mode = 'over'; T.phase = 'over'; music.stop()
  sfx(win ? 'win' : 'over'); speak(win ? 'Nice!' : 'Game over', 0.6, 1.05)
  if (T.bd.some((b) => b.human) && T.cfg.type !== 'demo') {
    profile.tetrisGames = (profile.tetrisGames || 0) + 1
    if (win && m.versus) profile.tetrisWins = (profile.tetrisWins || 0) + 1
    if (win && T.cfg.type === 'sprint') profile.sprints = (profile.sprints || 0) + 1
    if (score > 0 && T.cfg.type !== 'versus') recordScore('tetris', score)
    saveProfile()
  }
}

// ---------- gravity / timers ----------
const gravity = (lvl) => Math.max(0.012, Math.pow(0.8 - (lvl - 1) * 0.007, lvl - 1))
function stepBoard(b, dt, danger) {
  for (let r = 0; r < H; r++) { if (b.rowOff[r] > 0) b.rowOff[r] = Math.max(0, b.rowOff[r] - dt * 28 * (0.4 + b.rowOff[r] * 0.5)); for (let c = 0; c < W; c++) if (b.fl[r][c] > 0) b.fl[r][c] -= dt }
  b.trails = b.trails.filter((t) => (t.t -= dt) > 0)
  let hi = 0
  for (let r = 0; r < H; r++) if (b.grid[r].some((c) => c)) { hi = H - r; break }
  b.danger = hi > 16
  if (b.dead) { b.deadT += dt; return }
  if (b.state === 'clear') { b.clearT -= dt; if (b.clearT <= 0) finishClear(b); return }
  if (b.state === 'are') { b.areT -= dt; if (b.areT <= 0) { spawn(b); if (b.human && b.piece) nudgeHeld(b) } return }
  if (b.state !== 'play' || !b.piece) return
  const p = b.piece
  p.pop = Math.max(0, p.pop - dt)
  p.yf += (p.y - p.yf) * Math.min(1, dt * 30)
  // DAS / ARR for humans
  if (b.human) humanHold(b, dt)
  // gravity
  groundCheck(b)
  const g = b.soft ? Math.min(gravity(b.level), 0.035) : gravity(b.level)
  if (!b.onGround) {
    b.gravT += dt
    while (b.gravT >= g && fits(b, p.kind, p.rot, p.x, p.y + 1)) { b.gravT -= g; p.y++; p.last = 'fall'; if (b.soft) b.score += 1 }
    if (!fits(b, p.kind, p.rot, p.x, p.y + 1)) b.gravT = 0
  } else {
    b.lockT += dt
    if (b.lockT >= LOCK) { lockPiece(b); return }
  }
  if (!b.human) botStep(b, dt)
}

// ---------- humans ----------
function maps() {
  const two = T.bd.filter((b) => b.human).length > 1
  const m1 = two ? { left: ['KeyA'], right: ['KeyD'], down: ['KeyS'], cw: ['KeyW'], ccw: ['KeyQ'], hard: ['Space'], hold: ['KeyE'] }
    : { left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], down: ['KeyS', 'ArrowDown'], cw: ['KeyW', 'ArrowUp', 'KeyX'], ccw: ['KeyZ', 'KeyQ'], hard: ['Space'], hold: ['KeyC', 'KeyE', 'ShiftLeft'] }
  const m2 = { left: ['ArrowLeft'], right: ['ArrowRight'], down: ['ArrowDown'], cw: ['ArrowUp'], ccw: ['Comma'], hard: ['Enter'], hold: ['Period', 'Slash'] }
  return { 1: m1, 2: m2 }
}
const down = (list) => list.some((k) => keys[k])
function humanHold(b, dt) {
  const m = maps()[b.human]
  b.soft = down(m.down)
  const L = down(m.left), Rr = down(m.right)
  const dir = L && !Rr ? -1 : Rr && !L ? 1 : 0
  if (dir !== b.das.dir) { b.das.dir = dir; b.das.t = 0; b.das.arr = 0 }
  if (dir) {
    b.das.t += dt
    if (b.das.t >= DAS) { b.das.arr = (b.das.arr || 0) + dt; while (b.das.arr >= ARR) { b.das.arr -= ARR; if (!move(b, dir)) break } }
  }
}
function nudgeHeld(b) { /* hold-over of the direction is handled by humanHold */ }
function onKey(code) {
  if (T.mode === 'idle') return
  if (code === 'Escape' || code === 'KeyP') { if (T.mode === 'play') { T.paused = !T.paused; sfx('ui'); emitT() } return }
  if (T.paused) { if (code === 'Enter') { T.paused = false; emitT() } return }
  if (T.mode === 'over') { if (code === 'Enter') start(T.cfg.type, T.cfg.level, T.cfg.diff); return }
  if (T.phase !== 'play') return
  const mp = maps()
  for (const b of T.bd) {
    if (!b.human || b.dead) continue
    const m = mp[b.human]
    if (m.left.includes(code)) { if (move(b, -1)) b.das.t = 0 }
    else if (m.right.includes(code)) { if (move(b, 1)) b.das.t = 0 }
    else if (m.cw.includes(code)) rotate(b, 1)
    else if (m.ccw.includes(code)) rotate(b, -1)
    else if (m.hard.includes(code)) hardDrop(b)
    else if (m.hold.includes(code)) hold(b)
  }
}

// ---------- bot ----------
function simulate(grid, kind, rot, x) {
  let y = -2
  const fit = (yy) => cellsOf(kind, rot, x, yy).every(([cx, cy]) => cx >= 0 && cx < W && cy < H && (cy < 0 || !grid[cy][cx]))
  if (!fit(y)) return null
  while (fit(y + 1)) y++
  const g = grid.map((r) => r.slice())
  for (const [cx, cy] of cellsOf(kind, rot, x, y)) { if (cy < 0) return null; g[cy][cx] = kind }
  let lines = 0
  for (let r = H - 1; r >= 0; r--) if (g[r].every((c) => c)) { g.splice(r, 1); g.unshift(Array(W).fill(null)); lines++; r++ }
  return { g, lines, y }
}
function evalGrid(g, lines) {
  let agg = 0, holes = 0, bump = 0, maxH = 0
  const hs = []
  for (let c = 0; c < W; c++) {
    let h = 0, seen = false
    for (let r = 0; r < H; r++) { if (g[r][c]) { if (!seen) { h = H - r; seen = true } } else if (seen) holes++ }
    hs.push(h); agg += h; maxH = Math.max(maxH, h)
  }
  for (let c = 0; c < W - 1; c++) bump += Math.abs(hs[c] - hs[c + 1])
  const low = maxH < 12
  const reward = low ? [0, -0.6, 0.4, 1.6, 16][lines] : [0, 1.2, 2.2, 3.2, 14][lines]
  let wellPenalty = 0
  for (let c = 0; c < W - 1; c++) if (hs[c] === 0 && hs[c + 1] > 0 && c !== 9) wellPenalty += 0.6 // stray gaps
  return -0.5 * agg + reward - 0.85 * holes - 0.18 * bump - 0.35 * Math.max(0, maxH - 10) + (hs[9] === 0 ? 1.3 : 0) - wellPenalty
}
function bestFor(grid, kind, next) {
  let best = null
  for (let rot = 0; rot < (kind === 'O' ? 1 : 4); rot++) for (let x = -2; x < W; x++) {
    const s = simulate(grid, kind, rot, x)
    if (!s) continue
    let sc = evalGrid(s.g, s.lines)
    if (next) { const n = bestFor(s.g, next, null); if (n) sc += n.score * 0.7 }
    if (!best || sc > best.score) best = { rot, x, score: sc, lines: s.lines }
  }
  return best
}
function botStep(b, dt) {
  const cfg = DIFF[T.cfg.diff - 1]
  if (!b.plan) {
    const p = b.piece
    const next = cfg.lookahead ? b.queue[0] : null
    const a = bestFor(b.grid, p.kind, next)
    let useHold = false, plan = a
    if (b.canHold && cfg.lookahead) {
      const alt = b.hold || b.queue[0]
      const c = bestFor(b.grid, alt, null)
      if (c && (!a || c.score > a.score + 1.5)) { useHold = true; plan = c }
    }
    if (!plan) plan = { rot: 0, x: 3 }
    if (Math.random() < cfg.miss) plan = { ...plan, x: plan.x + (Math.random() < 0.5 ? -1 : 1) }
    b.plan = { ...plan, useHold }
    b.actT = cfg.delay * 2
    return
  }
  b.actT -= dt
  if (b.actT > 0) return
  b.actT = cfg.delay
  const pl = b.plan, p = b.piece
  if (pl.useHold) { hold(b); pl.useHold = false; b.plan = null; return }
  if (p.rot !== pl.rot) { if (!rotate(b, 1)) { b.plan = null } return }
  // find the cell offset: plan.x is the box x for the target rotation
  if (p.x < pl.x) { if (!move(b, 1)) hardDrop(b); return }
  if (p.x > pl.x) { if (!move(b, -1)) hardDrop(b); return }
  b.plan = null
  hardDrop(b)
}

// ---------- main ----------
function play(dt) {
  T.t += dt
  T.lvlFlash = Math.max(0, T.lvlFlash - dt)
  for (const m of T.msgs) m.t -= dt
  T.msgs = T.msgs.filter((m) => m.t > 0)
  for (const s of T.bgSeed) { s.y -= s.v * dt * (1 + (T.bd[0] ? T.bd[0].level : 1) * 0.15); if (s.y < -34) { s.y = 34; s.x = R(-48, 48); s.k = KINDS[(Math.random() * 7) | 0] } }
  if (T.phase === 'ready') {
    T.readyT -= dt
    const n = Math.ceil(T.readyT)
    if (n !== T.lastCount && n >= 1 && n <= 3) { T.lastCount = n; sfx('beep') }
    if (T.readyT <= 0) { T.phase = 'play'; sfx('go'); for (const b of T.bd) spawn(b) }
  } else if (T.phase === 'play') {
    T.elapsed += dt
    const g = MODES[T.cfg.type].goal
    if (g && g.time && T.elapsed >= g.time) { endGame(true); return }
    const live = T.bd.filter((b) => !b.dead)
    for (const b of T.bd) stepBoard(b, dt)
    if (T.bd.some((b) => b.danger) && Math.floor(T.t * 3) !== Math.floor((T.t - dt) * 3)) sfx('tWarn')
  } else {
    for (const b of T.bd) stepBoard(b, dt)
  }
  stepParticles(dt)
}
function update(dtRaw) {
  const dt = Math.min(dtRaw, 0.04)
  if (T.mode === 'idle') return
  if (T.mode === 'play' && !T.paused) play(dt)
  else if (T.mode === 'over') { T.t += dt; for (const b of T.bd) if (b.dead) b.deadT += dt; stepParticles(dt) }
  T.emitT -= dt
  if (T.emitT <= 0) { T.emitT = 0.07; emitT() }
}
export const tetrisActions = {
  start, stop, quit() { toMenu() }, resume() { T.paused = false; emitT() }, rematch() { start(T.cfg.type, T.cfg.level, T.cfg.diff) },
  pause() { if (T.mode === 'play' && !T.paused) { T.paused = true; emitT(); return true } return false },
}

// ---------- rendering ----------
const cc = {}
const lc = (hex) => cc[hex] || (cc[hex] = rgb(hex))
function hsv(h, s, v) { const i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s); return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6] }
function cell(put, x, y, color, k = 1, s = 1, z = 0) {
  const d = CS * 0.96 * s
  put(x, y, z, d, d, color[0] * 0.55 * k, color[1] * 0.55 * k, color[2] * 0.55 * k)
  put(x, y, z + 0.7, d * 0.74, d * 0.74, color[0] * 1.15 * k, color[1] * 1.15 * k, color[2] * 1.15 * k)
  put(x - d * 0.2, y + d * 0.2, z + 1.4, d * 0.28, d * 0.28, color[0] * 2 * k, color[1] * 2 * k, color[2] * 2 * k)
}
function drawPiecePanel(put, kind, cx, cy, size, k = 1, bob = 0) {
  const sh = SHAPES[kind][0], n = BASE[kind].n
  const minx = Math.min(...sh.map((c) => c[0])), maxx = Math.max(...sh.map((c) => c[0])), miny = Math.min(...sh.map((c) => c[1])), maxy = Math.max(...sh.map((c) => c[1]))
  const col = lc(COLORS[kind])
  for (const [x, y] of sh) {
    const px = cx + (x - (minx + maxx) / 2) * size, py = cy - (y - (miny + maxy) / 2) * size + bob
    const d = size * 0.94
    put(px, py, 0, d, d, col[0] * 0.55 * k, col[1] * 0.55 * k, col[2] * 0.55 * k)
    put(px, py, 0.7, d * 0.72, d * 0.72, col[0] * 1.15 * k, col[1] * 1.15 * k, col[2] * 1.15 * k)
  }
}
function draw(api) {
  const { put } = api
  const t = G.time
  const lvl = T.bd[0] ? T.bd[0].level : 1
  const hue = ((lvl - 1) * 0.085 + 0.58) % 1
  const pulse = 0.5 + 0.5 * Math.sin(t * (2.2 + lvl * 0.15))
  // animated backdrop: breathing grid + drifting silhouettes
  for (let gx = -50; gx <= 50; gx += 4) for (let gy = -28; gy <= 28; gy += 4) {
    const k = 0.05 + 0.03 * Math.sin(t * 1.2 + gx * 0.2 + gy * 0.15) + pulse * 0.015 + T.lvlFlash * 0.12
    const c = hsv(hue, 0.7, 1)
    put(gx, gy, -12, 3.8, 3.8, c[0] * k, c[1] * k, c[2] * k)
  }
  for (const s of T.bgSeed) { const c = lc(COLORS[s.k]); for (const [x, y] of SHAPES[s.k][s.rot]) put(s.x + x * 2.4, s.y - y * 2.4, -9, 2.2, 2.2, c[0] * 0.2, c[1] * 0.2, c[2] * 0.2) }
  for (const b of T.bd) drawBoard(api, b, t, hue, pulse)
  for (const q of G.parts) { const f = q.life / q.max; put(q.x, q.y, 6, q.s * (0.35 + 0.65 * f) * 0.9, q.s * (0.35 + 0.65 * f) * 0.9, q.c[0] * 1.8, q.c[1] * 1.8, q.c[2] * 1.8) }
  api.pops(G.pops, 0)
}
function drawBoard(api, b, t, hue, pulse) {
  const { put } = api
  const x0 = b.cx
  // backdrop + frame
  for (let r = 2; r < H; r++) for (let c = 0; c < W; c++) { const d = ((r + c) & 1) ? 0.045 : 0.07; put(bx(b, c), by(r), -3, CS, CS, d * 0.8, d * 0.9, d * 1.4) }
  const fc = b.danger ? [2.2 * (0.5 + 0.5 * Math.sin(t * 12)), 0.2, 0.2] : hsv(hue, 0.6, 1.2 + pulse * 0.5)
  for (let r = 2; r <= H; r++) { put(x0 - (W / 2 + 0.5) * CS, by(r) + 0, 0, CS * 0.7, CS, fc[0], fc[1], fc[2]); put(x0 + (W / 2 + 0.5) * CS, by(r), 0, CS * 0.7, CS, fc[0], fc[1], fc[2]) }
  for (let c = -1; c <= W; c++) put(bx(b, c), by(H), 0, CS, CS * 0.7, fc[0], fc[1], fc[2])
  // incoming garbage meter
  const inc = b.pending.reduce((a, x) => a + x, 0)
  for (let i = 0; i < Math.min(inc, 20); i++) put(x0 - (W / 2 + 2) * CS, by(H - 1 - i), 1, CS * 0.5, CS * 0.9, 2.4, 0.3 + 0.2 * Math.sin(t * 10), 0.3)
  // placed cells
  const dying = b.dead ? Math.min(1, b.deadT * 1.3) : 0
  for (let r = 2; r < H; r++) for (let c = 0; c < W; c++) {
    const k = b.grid[r][c]
    if (!k) continue
    const clearing = b.state === 'clear' && b.clearRows.includes(r)
    let col = lc(COLORS[k]), kk = 1, s = 1
    if (clearing) { const u = 1 - b.clearT / 0.42; const blink = Math.floor(u * 10) % 2 === 0; col = blink ? [2.4, 2.4, 2.4] : col; s = 1 + u * 0.5; kk = 1 + (1 - u) }
    if (b.fl[r][c] > 0) kk += b.fl[r][c] * 9
    let y = by(r) + b.rowOff[r]
    if (b.dead && dying * H > H - r) { col = [0.35, 0.37, 0.42]; kk = 0.7; y -= Math.sin(b.deadT * 6 + c) * 0.2 }
    cell(put, bx(b, c), y, col, kk, s)
  }
  // active piece, ghost, trails
  if (b.piece && b.state === 'play') {
    const p = b.piece, col = lc(COLORS[p.kind])
    const gy = ghostY(b)
    for (const [cx, cy] of cellsOf(p.kind, p.rot, p.x, gy)) if (cy >= 2) { const gk = 0.28 + 0.12 * Math.sin(t * 8); put(bx(b, cx), by(cy), -1, CS * 0.96, CS * 0.96, col[0] * gk, col[1] * gk, col[2] * gk); put(bx(b, cx), by(cy), -0.5, CS * 0.6, CS * 0.6, col[0] * gk * 0.5, col[1] * gk * 0.5, col[2] * gk * 0.5) }
    const lockK = b.onGround ? 1 + (b.lockT / LOCK) * 1.2 : 1
    const sc = 1 + p.pop * 3
    const dy = p.yf - p.y
    for (const [cx, cy] of cellsOf(p.kind, p.rot, p.x, p.y)) if (cy >= 2 || (cy >= 0 && dy < 0 && false)) cell(put, bx(b, cx), by(cy) - dy * CS * -1, col, lockK, sc, 0.5)
  }
  for (const tr of b.trails) {
    const col = lc(COLORS[tr.kind])
    for (const [cx] of cellsOf(tr.kind, tr.rot, tr.x, 0)) for (let r = Math.max(2, tr.y0); r < tr.y1; r++) { const f = tr.t / 0.25; put(bx(b, cx), by(r), -0.5, CS * 0.5, CS, col[0] * 1.6 * f, col[1] * 1.6 * f, col[2] * 1.6 * f) }
  }
  // hold & next panels
  const versus = MODES[T.cfg.type].versus
  const hx = versus ? (b.id === 0 ? x0 - 16.5 : x0 + 16.5) : x0 - 17.5
  const nx = versus ? (b.id === 0 ? x0 + 16.5 : x0 - 16.5) : x0 + 17.5
  for (const [px, py] of [[hx, 17]]) { for (let i = -3; i <= 3; i++) { put(px + i * 1.4, py + 4.6, 0, 1.4, 0.4, 0.5, 0.5, 0.7); put(px + i * 1.4, py - 4.2, 0, 1.4, 0.4, 0.5, 0.5, 0.7) } }
  if (b.hold) drawPiecePanel(put, b.hold, hx, 17, 1.7, b.canHold ? 1.3 : 0.4)
  for (let i = 0; i < 5; i++) if (b.queue[i]) drawPiecePanel(put, b.queue[i], nx, 17 - i * 6.2, i === 0 ? 1.8 : 1.4, i === 0 ? 1.4 : 1, i === 0 ? Math.sin(t * 4) * 0.3 : 0)
}
if (typeof window !== 'undefined') { window.__T = T; window.__tetris = tetrisActions }
games.tetris = { update, onKey, draw, stop, sky: () => '#04060f' }
