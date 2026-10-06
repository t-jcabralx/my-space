// NEON SNAKE: eat, grow, don't crash. Solo (it speeds up and rocks appear), vs a bot, or 2 players on one keyboard.
import { G, emit as engineEmit, keys, games, profile, saveProfile, recordScore, part, ring, shake, flash, stepParticles, toMenu } from './engine.js'
import { sfx, music } from './audio.js'
import { col, disk, rect, clamp, R } from './pxl.js'

export const GW = 40, GH = 22
const cx = (i) => -39 + i * 2, cy = (j) => 21 - j * 2
const DIRS = [[1, 0], [0, -1], [-1, 0], [0, 1]] // right, up, left, down (j grows downward)
export const SN = { mode: 'idle', paused: false, cfg: { type: 'solo' }, s: [], food: null, gold: null, rocks: [], t: 0, acc: 0, step: 0.12, score: 0, over: null, emitT: 0, eaten: 0, msg: null, swipe: null }
let snap = null
const subs = new Set()
export const subscribeSnake = (f) => { subs.add(f); return () => subs.delete(f) }
export const getSnakeSnap = () => snap
function emitS() {
  snap = { mode: SN.mode, paused: SN.paused, type: SN.cfg.type, score: SN.score, len: SN.s.map((x) => x.body.length), alive: SN.s.map((x) => x.alive), over: SN.over, best: profile.snakeBest || 0, msg: SN.msg }
  subs.forEach((f) => f())
}
const mkSnake = (id, x, y, d, human) => ({ id, body: [[x, y], [x - DIRS[d][0], y - DIRS[d][1]], [x - 2 * DIRS[d][0], y - 2 * DIRS[d][1]]], d, nd: d, alive: true, human, col: id ? '#ff4de1' : '#3de8ff', grow: 0, score: 0 })
function start(cfg = {}) {
  SN.cfg = { type: 'solo', ...cfg }
  SN.s = [mkSnake(0, 8, 11, 0, true)]
  if (SN.cfg.type !== 'solo') SN.s.push(mkSnake(1, 31, 11, 2, SN.cfg.type === '2p'))
  SN.rocks = []; SN.food = null; SN.gold = null; SN.score = 0; SN.over = null; SN.paused = false; SN.step = SN.cfg.type === 'solo' ? 0.12 : 0.1; SN.acc = 0; SN.eaten = 0; SN.t = 0; SN.msg = null
  spawnFood()
  G.mode = 'snake'; engineEmit(); G.parts = []; G.pops = []; SN.mode = 'play'
  music.set('race', 0); sfx('mission'); emitS()
}
function stop() { SN.mode = 'idle'; SN.paused = false; music.set('menu'); emitS() }
const occupied = (x, y) => SN.s.some((s) => s.body.some((b) => b[0] === x && b[1] === y)) || SN.rocks.some((r) => r[0] === x && r[1] === y) || (SN.food && SN.food[0] === x && SN.food[1] === y)
function freeCell() { for (let i = 0; i < 200; i++) { const x = (Math.random() * GW) | 0, y = (Math.random() * GH) | 0; if (!occupied(x, y)) return [x, y] } return [0, 0] }
function spawnFood() { SN.food = freeCell() }
function bot(s) {
  // flood-safe greedy: prefer the move that gets closer to the food without crashing
  const head = s.body[0]
  let best = null
  for (let k = 0; k < 4; k++) {
    if ((k + 2) % 4 === s.d) continue
    const nx = head[0] + DIRS[k][0], ny = head[1] + DIRS[k][1]
    if (nx < 0 || ny < 0 || nx >= GW || ny >= GH || SN.s.some((o) => o.body.some((b) => b[0] === nx && b[1] === ny)) || SN.rocks.some((r) => r[0] === nx && r[1] === ny)) continue
    // count free neighbours so we avoid dead ends
    let room = 0; for (let m = 0; m < 4; m++) { const ax = nx + DIRS[m][0], ay = ny + DIRS[m][1]; if (ax >= 0 && ay >= 0 && ax < GW && ay < GH && !occupied(ax, ay)) room++ }
    const t = SN.gold || SN.food
    const d = Math.abs(nx - t[0]) + Math.abs(ny - t[1])
    const sc = -d + room * 1.5 + Math.random() * 0.4
    if (!best || sc > best.sc) best = { k, sc }
  }
  if (best) s.nd = best.k
}
function tick() {
  for (const s of SN.s) if (s.alive && !s.human) bot(s)
  const heads = []
  for (const s of SN.s) {
    if (!s.alive) { heads.push(null); continue }
    if ((s.nd + 2) % 4 !== s.d) s.d = s.nd
    const h = s.body[0], nx = h[0] + DIRS[s.d][0], ny = h[1] + DIRS[s.d][1]
    heads.push([nx, ny])
  }
  SN.s.forEach((s, i) => {
    if (!s.alive) return
    const [nx, ny] = heads[i]
    let dead = nx < 0 || ny < 0 || nx >= GW || ny >= GH || SN.rocks.some((r) => r[0] === nx && r[1] === ny)
    for (const o of SN.s) { const lim = o === s ? o.body.length - (s.grow > 0 ? 0 : 1) : o.body.length; for (let k = 0; k < lim; k++) if (o.body[k][0] === nx && o.body[k][1] === ny) dead = true }
    heads.forEach((hh, j) => { if (j !== i && hh && hh[0] === nx && hh[1] === ny) dead = true })
    if (dead) { s.alive = false; sfx('rgHurt'); shake(1.2); flash(0.2, [1, 0.3, 0.3]); for (let k = 0; k < 18; k++) part(cx(s.body[0][0]), cy(s.body[0][1]), R(-30, 30), R(-30, 30), 0.6, col(s.col), R(0.8, 1.5)); return }
    s.body.unshift([nx, ny])
    if (SN.food && nx === SN.food[0] && ny === SN.food[1]) { s.grow += 1; s.score += 10; eat(s, 10); spawnFood() }
    else if (SN.gold && nx === SN.gold[0] && ny === SN.gold[1]) { s.grow += 3; s.score += 50; eat(s, 50); SN.gold = null }
    if (s.grow > 0) s.grow--; else s.body.pop()
  })
  // end conditions
  const alive = SN.s.filter((s) => s.alive)
  if (SN.cfg.type === 'solo' ? !alive.length : alive.length <= 1) finish(alive[0])
}
function eat(s, pts) {
  sfx(pts >= 50 ? 'mgBig' : 'coin'); ring(cx(s.body[0][0]), cy(s.body[0][1]), 10, 20, [col(s.col)])
  if (SN.cfg.type === 'solo') {
    SN.score += pts; SN.eaten++
    SN.step = Math.max(0.055, 0.12 - SN.eaten * 0.0026)
    if (SN.eaten % 4 === 0) SN.rocks.push(freeCell())
    if (SN.eaten % 5 === 0 && !SN.gold) { SN.gold = freeCell(); SN.goldT = 9; SN.msg = { text: 'GOLDEN APPLE!', t: 1.4 } }
  }
}
function finish(winner) {
  SN.mode = 'over'; music.stop()
  const me = SN.s[0]
  if (SN.cfg.type === 'solo') {
    profile.snakeGames = (profile.snakeGames || 0) + 1; profile.snakeBest = Math.max(profile.snakeBest || 0, SN.score)
    SN.over = { score: SN.score, len: me.body.length, best: profile.snakeBest, type: 'solo' }
    recordScore('snake', SN.score)
  } else {
    const w = winner ? winner.id : -1
    SN.over = { winner: w, type: SN.cfg.type, win: SN.cfg.type === '2p' ? w >= 0 : w === 0, len: [SN.s[0].body.length, SN.s[1].body.length], draw: w < 0 }
    if (SN.cfg.type === 'bot') { profile.snakeGames = (profile.snakeGames || 0) + 1; if (w === 0) { const sc = 300 + me.body.length * 10; SN.over.points = sc; recordScore('snake', sc) } }
  }
  saveProfile(); sfx(SN.over.win || SN.cfg.type === 'solo' ? 'win' : 'over'); emitS()
}
function update(dtRaw) {
  const dt = Math.min(dtRaw, 0.05)
  if (SN.mode === 'idle' || SN.paused) return
  if (SN.mode === 'over') { stepParticles(dt); return }
  SN.t += dt
  if (SN.msg) { SN.msg.t -= dt; if (SN.msg.t <= 0) SN.msg = null }
  if (SN.gold) { SN.goldT -= dt; if (SN.goldT <= 0) SN.gold = null }
  // keyboard
  const k = keys, p1 = SN.s[0], p2 = SN.s[1]
  const dirOf = (up, right, down, left) => (right ? 0 : up ? 1 : left ? 2 : down ? 3 : -1)
  if (p1 && p1.human) { const d = SN.cfg.type === '2p' ? dirOf(k.KeyW, k.KeyD, k.KeyS, k.KeyA) : dirOf(k.KeyW || k.ArrowUp, k.KeyD || k.ArrowRight, k.KeyS || k.ArrowDown, k.KeyA || k.ArrowLeft); if (d >= 0 && (d + 2) % 4 !== p1.d) p1.nd = d }
  if (p2 && p2.human) { const d = dirOf(k.ArrowUp, k.ArrowRight, k.ArrowDown, k.ArrowLeft); if (d >= 0 && (d + 2) % 4 !== p2.d) p2.nd = d }
  SN.acc += dt
  while (SN.acc >= SN.step && SN.mode === 'play') { SN.acc -= SN.step; tick() }
  stepParticles(dt)
  SN.emitT -= dt
  if (SN.emitT <= 0) { SN.emitT = 0.15; emitS() }
}
function onKey(code) {
  if (SN.mode === 'idle') return
  if (code === 'Escape' || code === 'KeyP') { if (SN.mode === 'play') { SN.paused = !SN.paused; sfx('ui'); emitS() } return }
  if (SN.mode === 'over' && code === 'Enter') snakeActions.rematch()
}
export const snakeActions = {
  start, stop, quit() { toMenu() },
  resume() { SN.paused = false; emitS() }, pause() { if (SN.mode === 'play' && !SN.paused) { SN.paused = true; emitS(); return true } return false },
  rematch() { start(SN.cfg) },
  // swipe to turn (touch / mouse drag)
  pointer(type, x, y) {
    if (SN.mode !== 'play') return
    if (type === 'down') SN.swipe = [x, y]
    else if (type === 'move' && SN.swipe) {
      const dx = x - SN.swipe[0], dy = y - SN.swipe[1]
      if (Math.hypot(dx, dy) > 4) { const d = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 0 : 2) : (dy > 0 ? 1 : 3); const s = SN.s[0]; if (s && (d + 2) % 4 !== s.d) s.nd = d; SN.swipe = [x, y] }
    } else if (type === 'up') SN.swipe = null
  },
  turn(d) { const s = SN.s[0]; if (s && (d + 2) % 4 !== s.d) s.nd = d },
}
function draw(api) {
  const { put } = api, t = G.time
  rect(put, -41, -23, 41, 23, col('#04060f'), 1, -3.4, 1.6)
  for (let i = 0; i < GW; i++) for (let j = 0; j < GH; j++) if ((i + j) % 2 === 0) put(cx(i), cy(j), -3, 2.05, 2.05, 0.02, 0.05, 0.1)
  for (let x = -41; x <= 41; x += 1) { put(x, 23.5, -1, 1.1, 1.1, 0.2, 0.7, 1.4); put(x, -23.5, -1, 1.1, 1.1, 0.2, 0.7, 1.4) }
  for (let y = -23; y <= 23; y += 1) { put(-41.5, y, -1, 1.1, 1.1, 0.2, 0.7, 1.4); put(41.5, y, -1, 1.1, 1.1, 0.2, 0.7, 1.4) }
  for (const r of SN.rocks) { rect(put, cx(r[0]) - 0.8, cy(r[1]) - 0.8, cx(r[0]) + 0.8, cy(r[1]) + 0.8, col('#6a5a8a'), 1, 0, 0.8) }
  if (SN.food) { const k = 1 + Math.sin(t * 8) * 0.15; disk(put, cx(SN.food[0]), cy(SN.food[1]), 0.8 * k, col('#ff3a4a'), 2, 0.2, 0.4); put(cx(SN.food[0]), cy(SN.food[1]) + 1, 0.4, 0.3, 0.5, 0.3, 1.4, 0.4) }
  if (SN.gold) { const k = 1 + Math.sin(t * 12) * 0.2; disk(put, cx(SN.gold[0]), cy(SN.gold[1]), 0.95 * k, col('#ffd23a'), 2.4, 0.2, 0.4) }
  for (const s of SN.s) {
    const c = col(s.col)
    s.body.forEach((b, i) => { const f = 1 - i / (s.body.length + 6) * 0.6, k = s.alive ? 1 : 0.3; rect(put, cx(b[0]) - 0.85, cy(b[1]) - 0.85, cx(b[0]) + 0.85, cy(b[1]) + 0.85, c, (i === 0 ? 2 : 1.1) * f * k, 0.1, 0.85) })
    const h = s.body[0], d = DIRS[s.d]
    put(cx(h[0]) + d[1] * 0.45 + d[0] * 0.3, cy(h[1]) - d[1] * 0.3 + d[0] * 0.45, 0.8, 0.3, 0.3, 2, 2, 2); put(cx(h[0]) - d[1] * 0.45 + d[0] * 0.3, cy(h[1]) + d[1] * 0.3 - d[0] * 0.45, 0.8, 0.3, 0.3, 2, 2, 2)
  }
  for (const q of G.parts) { const f = q.life / q.max; put(q.x, q.y, 1, q.s * (0.35 + 0.65 * f) * 0.9, q.s * (0.35 + 0.65 * f) * 0.9, q.c[0] * 1.8, q.c[1] * 1.8, q.c[2] * 1.8) }
  void clamp
}
if (typeof window !== 'undefined') { window.__SN = SN; window.__snake = snakeActions }
games.snake = { update, onKey, draw, stop, sky: () => '#03050c' }
