// NEON BILLIARDS: 8-ball pool. Vs bot (3 levels), 2 players on one screen, or online 1v1.
// Mouse / finger: press and drag AWAY from where you want to shoot (slingshot), release to fire. Keyboard: arrows aim, hold Space to charge.
import { G, emit as engineEmit, keys, games, profile, saveProfile, recordScore, part, ring, shake, flash, stepParticles, toMenu } from './engine.js'
import { sfx, music, speak } from './audio.js'
import { col, disk, circle, rect, line, clamp, R } from './pxl.js'

const TX = 38, TY = 20, BR = 1.15, PR = 2.7, VMAX = 120
const POCKETS = [[-TX, -TY], [0, -TY - 0.6], [TX, -TY], [-TX, TY], [0, TY + 0.6], [TX, TY]]
const DIFF = [{ name: 'EASY', err: 0.07, perr: 0.25, think: 1.1 }, { name: 'MEDIUM', err: 0.025, perr: 0.12, think: 0.9 }, { name: 'HARD', err: 0.004, perr: 0.04, think: 0.7 }]
const BCOL = ['#f4f4f4', '#ffd23a', '#2f6bff', '#ff3b3b', '#9a3bff', '#ff8a2a', '#22c26a', '#a02a2a', '#161616']
const ballColor = (n) => BCOL[n <= 8 ? n : n - 8] // 0 cue -> white, 8 black
const groupOf = (n) => (n === 0 ? 'cue' : n === 8 ? 'eight' : n < 8 ? 'solid' : 'stripe')

export const PL = { mode: 'idle', paused: false, cfg: { type: 'bot', diff: 2 }, balls: [], turn: 0, phase: 'aim', groups: [null, null], aim: { a: 0, p: 0 }, drag: null, msg: null, over: null, net: null, brk: true, shot: null, potted: [], emitT: 0, botT: 0, fouls: [0, 0], scored: [0, 0], hover: null, placeOk: true, t: 0, charge: 0, hold: false }
let snap = null
const subs = new Set()
export const subscribePool = (f) => { subs.add(f); return () => subs.delete(f) }
export const getPoolSnap = () => snap
const mine = () => (PL.net ? (PL.net.role === 'guest' ? 1 : 0) : PL.cfg.type === 'bot' ? 0 : -1) // -1 = both humans on this screen
const isMyTurn = () => mine() < 0 || PL.turn === mine()
function emitP() {
  const left = (g) => PL.balls.filter((b) => !b.in && groupOf(b.n) === g).map((b) => b.n)
  snap = { mode: PL.mode, paused: PL.paused, phase: PL.phase, type: PL.cfg.type, diff: DIFF[PL.cfg.diff - 1].name, turn: PL.turn, groups: PL.groups.slice(), msg: PL.msg ? { ...PL.msg } : null, over: PL.over, solids: left('solid'), stripes: left('stripe'), eightLive: PL.balls.some((b) => b.n === 8 && !b.in), names: PL.cfg.type === 'bot' ? ['YOU', 'BOT'] : PL.net ? (PL.net.role === 'guest' ? ['HOST', 'YOU'] : ['YOU', 'FRIEND']) : ['PLAYER 1', 'PLAYER 2'], my: mine(), power: PL.drag ? PL.aim.p : PL.charge, net: PL.net ? PL.net.role : null, brk: PL.brk }
  subs.forEach((f) => f())
}
function rack() {
  const b = [{ n: 0, x: -TX * 0.5, y: 0, vx: 0, vy: 0, in: false }]
  const pool = [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15].sort(() => Math.random() - 0.5)
  // 8 in the centre of the third row; one solid and one stripe in the back corners
  const rows = []
  let k = 0
  const spots = []
  for (let c = 0; c < 5; c++) for (let r = 0; r <= c; r++) spots.push([c, r])
  const order = pool.slice()
  const sol = order.findIndex((n) => n < 8), str = order.findIndex((n) => n > 8)
  const corners = [spots.findIndex(([c, r]) => c === 4 && r === 0), spots.findIndex(([c, r]) => c === 4 && r === 4)]
  const mid = spots.findIndex(([c, r]) => c === 2 && r === 1)
  const place = Array(15).fill(0)
  place[mid] = 8
  const s1 = order.splice(sol, 1)[0], s2 = order.splice(order.findIndex((n) => n > 8), 1)[0]
  place[corners[0]] = s1; place[corners[1]] = s2
  for (let i = 0; i < 15; i++) if (!place[i]) place[i] = order[k++]
  void rows; void str
  spots.forEach(([c, r], i) => b.push({ n: place[i], x: TX * 0.45 + c * BR * 1.75, y: (r - c / 2) * BR * 2.02, vx: 0, vy: 0, in: false }))
  return b
}
function start(cfg = {}) {
  PL.cfg = { type: 'bot', diff: 2, ...cfg }
  if (PL.cfg.type !== 'online') PL.net = null
  PL.balls = rack(); PL.turn = 0; PL.phase = 'aim'; PL.groups = [null, null]; PL.aim = { a: 0, p: 0 }; PL.drag = null; PL.msg = null; PL.over = null
  PL.brk = true; PL.shot = null; PL.fouls = [0, 0]; PL.scored = [0, 0]; PL.paused = false; PL.charge = 0; PL.hold = false; PL.botT = 1
  G.mode = 'pool'; engineEmit(); G.parts = []; G.pops = []; G.shake = 0; G.flash = 0
  PL.mode = 'play'
  music.set('cards', 0); sfx('mission'); emitP()
}
function stop() { PL.mode = 'idle'; PL.paused = false; if (PL.net) { const n = PL.net; PL.net = null; if (n.onStop) try { n.onStop() } catch { /* ignore */ } } music.set('menu'); emitP() }
const cue = () => PL.balls[0]

// ---------- physics ----------
function beginShot(a, p) {
  const c = cue()
  const sp = 14 + clamp(p, 0, 1) * (VMAX - 14)
  c.vx = Math.cos(a) * sp; c.vy = Math.sin(a) * sp
  PL.shot = { first: null, potted: [], cueIn: false, rail: false, shooter: PL.turn }
  PL.phase = 'roll'; PL.drag = null; PL.charge = 0
  sfx('plCue', clamp(p, 0, 1)); shake(0.3 + p * 0.8)
  ring(c.x, c.y, 8, 20, [col('#ffffff')])
}
function stepBalls(dt) {
  const sub = 6, h = dt / sub
  let moving = false
  for (let s = 0; s < sub; s++) {
    for (const b of PL.balls) {
      if (b.in) continue
      b.x += b.vx * h; b.y += b.vy * h
      const sp = Math.hypot(b.vx, b.vy)
      if (sp > 0) {
        const ns = Math.max(0, sp - (7 + sp * 0.22) * h)
        b.vx *= ns / sp; b.vy *= ns / sp
        if (ns < 0.9) { b.vx = 0; b.vy = 0 }
      }
      // pockets
      for (const [px, py] of POCKETS) {
        if (Math.hypot(b.x - px, b.y - py) < PR) { pot(b); break }
      }
      if (b.in) continue
      // cushions
      if (b.x > TX - BR) { b.x = TX - BR; b.vx = -Math.abs(b.vx) * 0.8; rail(b, sp) }
      else if (b.x < -TX + BR) { b.x = -TX + BR; b.vx = Math.abs(b.vx) * 0.8; rail(b, sp) }
      if (b.y > TY - BR) { b.y = TY - BR; b.vy = -Math.abs(b.vy) * 0.8; rail(b, sp) }
      else if (b.y < -TY + BR) { b.y = -TY + BR; b.vy = Math.abs(b.vy) * 0.8; rail(b, sp) }
    }
    const bs = PL.balls
    for (let i = 0; i < bs.length; i++) {
      const a = bs[i]; if (a.in) continue
      for (let j = i + 1; j < bs.length; j++) {
        const b = bs[j]; if (b.in) continue
        const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy
        if (d2 >= 4 * BR * BR || d2 < 1e-9) continue
        const d = Math.sqrt(d2), nx = dx / d, ny = dy / d
        const ov = 2 * BR - d
        a.x -= nx * ov / 2; a.y -= ny * ov / 2; b.x += nx * ov / 2; b.y += ny * ov / 2
        const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny
        if (rv < 0) {
          const j2 = -(1 + 0.96) * rv / 2
          a.vx -= nx * j2; a.vy -= ny * j2; b.vx += nx * j2; b.vy += ny * j2
          const hard = Math.min(1, -rv / 60)
          sfx('plClack', hard)
          if (PL.shot && !PL.shot.first && (a.n === 0 || b.n === 0)) PL.shot.first = a.n === 0 ? b.n : a.n
          if (hard > 0.4) for (let k = 0; k < 3; k++) part(a.x + nx * BR, a.y + ny * BR, R(-12, 12), R(-12, 12), 0.25, col('#ffffff'), 0.7)
        }
      }
    }
  }
  for (const b of PL.balls) if (!b.in && (b.vx || b.vy)) moving = true
  return moving
}
function rail(b, sp) { if (sp > 8) sfx('plRail'); if (PL.shot) PL.shot.rail = true }
function pot(b) {
  b.in = true; b.vx = b.vy = 0
  if (PL.shot) PL.shot.potted.push(b.n)
  sfx('plPocket'); shake(0.5)
  for (let i = 0; i < 12; i++) part(b.x, b.y, R(-24, 24), R(-24, 24), R(0.3, 0.7), col(ballColor(b.n)), R(0.8, 1.4))
  ring(b.x, b.y, 14, 26, [col(ballColor(b.n))])
}
const myGroupDone = (p) => PL.groups[p] && !PL.balls.some((b) => !b.in && groupOf(b.n) === PL.groups[p])
function resolveShot() {
  const s = PL.shot, p = s.shooter, o = 1 - p
  PL.shot = null
  const pots = s.potted
  const cuePot = pots.includes(0)
  const eightPot = pots.includes(8)
  const pn = ['YOU', 'BOT'], name = (x) => (PL.cfg.type === 'bot' ? pn[x] : PL.net ? (x === mine() ? 'YOU' : 'OPPONENT') : 'PLAYER ' + (x + 1))
  // groups are assigned on the first clean pot after the break
  let foul = ''
  if (cuePot) foul = 'SCRATCH'
  else if (s.first === null) foul = 'MISSED EVERYTHING'
  else if (PL.groups[p]) {
    const need = myGroupDone(p) ? 'eight' : PL.groups[p]
    if (groupOf(s.first) !== need) foul = 'WRONG BALL FIRST'
  } else if (s.first === 8 && !PL.brk) foul = 'WRONG BALL FIRST'
  if (!foul && !s.rail && !pots.length && s.first !== null) foul = 'NO RAIL'
  if (eightPot) {
    const wasClear = PL.groups[p] && !PL.balls.some((b) => !b.in && b.n !== 8 && groupOf(b.n) === PL.groups[p] && !pots.includes(b.n))
    // 8-ball legally potted only when the shooter's group was already clear before the shot
    const clearBefore = PL.groups[p] && !PL.balls.some((b) => groupOf(b.n) === PL.groups[p] && (!b.in || pots.includes(b.n)))
    void wasClear
    if (PL.brk || !PL.groups[p] || !clearBefore || foul) return endGame(foul || PL.brk || !PL.groups[p] || !clearBefore ? o : p, foul ? 'EIGHT BALL ON A FOUL' : 'EIGHT BALL POTTED TOO EARLY')
    return endGame(p, 'EIGHT BALL POTTED')
  }
  const real = pots.filter((n) => n !== 0)
  if (!PL.groups[p] && !foul && real.length) {
    const g = groupOf(real[0])
    PL.groups[p] = g; PL.groups[o] = g === 'solid' ? 'stripe' : 'solid'
    PL.msg = { text: name(p) + ' = ' + (g === 'solid' ? 'SOLIDS' : 'STRIPES'), sub: '', color: '#ffe84a', t: 2 }
  }
  const own = real.filter((n) => PL.groups[p] ? groupOf(n) === PL.groups[p] : true)
  PL.scored[p] += own.length
  for (const n of real) if (PL.groups[o] && groupOf(n) === PL.groups[o]) PL.scored[o] += 0
  PL.brk = false
  if (cuePot) { const c = cue(); c.in = false; c.x = -TX * 0.5; c.y = 0; c.vx = c.vy = 0 }
  if (foul) {
    PL.fouls[p]++
    PL.turn = o; PL.phase = 'place'
    PL.msg = { text: 'FOUL: ' + foul, sub: name(o) + ' PLACES THE CUE BALL', color: '#ff5a6a', t: 2.4 }
    sfx('cBad')
    const c = cue(); if (!cuePot) { c.vx = c.vy = 0 }
  } else if (own.length) {
    PL.phase = 'aim'
    PL.msg = PL.msg || { text: 'NICE!', sub: 'SHOOT AGAIN', color: '#6aff9a', t: 1.2 }
    sfx('ding', own.length * 3)
  } else { PL.turn = o; PL.phase = 'aim' }
  PL.botT = DIFF[PL.cfg.diff - 1].think
  if (PL.phase === 'place' && !(isBot(PL.turn))) { PL.hover = null }
  emitP()
}
const isBot = (t) => PL.cfg.type === 'bot' && t === 1
function endGame(w, why) {
  PL.phase = 'over'; PL.mode = 'over'; music.stop()
  const me = mine() < 0 ? 0 : mine()
  const won = w === me
  const hot = PL.cfg.type !== '2p'
  PL.over = { winner: w, win: PL.cfg.type === '2p' ? true : won, why, potted: PL.scored[me], type: PL.cfg.type, fouls: PL.fouls[me] }
  if (hot) {
    profile.poolGames = (profile.poolGames || 0) + 1
    if (won) profile.poolWins = (profile.poolWins || 0) + 1
    profile.poolPots = (profile.poolPots || 0) + PL.scored[me]
    const score = Math.max(0, (won ? 1000 + PL.cfg.diff * 150 : 0) + PL.scored[me] * 60 - PL.fouls[me] * 80)
    PL.over.points = score
    recordScore('pool', score); saveProfile()
  }
  sfx(PL.over.win ? 'win' : 'over'); shake(1.5)
  emitP()
}

// ---------- bot ----------
function clearPath(x0, y0, x1, y1, ignore) {
  const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1
  for (const b of PL.balls) {
    if (b.in || ignore.includes(b.n)) continue
    const t = clamp(((b.x - x0) * dx + (b.y - y0) * dy) / L2, 0, 1)
    if (Math.hypot(x0 + dx * t - b.x, y0 + dy * t - b.y) < BR * 2 - 0.05) return false
  }
  return true
}
function botShot() {
  const D = DIFF[PL.cfg.diff - 1], c = cue(), p = PL.turn
  const g = PL.groups[p], need = g ? (myGroupDone(p) ? 'eight' : g) : null
  let best = null
  for (const b of PL.balls) {
    if (b.in || b.n === 0) continue
    const gr = groupOf(b.n)
    if (need ? gr !== need : gr === 'eight') continue
    for (const [px, py] of POCKETS) {
      const dx = px - b.x, dy = py - b.y, dl = Math.hypot(dx, dy)
      const gx = b.x - (dx / dl) * BR * 2, gy = b.y - (dy / dl) * BR * 2
      const cx = gx - c.x, cy = gy - c.y, cl = Math.hypot(cx, cy)
      const cosA = (cx * dx + cy * dy) / (cl * dl)
      if (cosA < 0.25) continue
      if (!clearPath(c.x, c.y, gx, gy, [0, b.n]) || !clearPath(b.x, b.y, px, py, [0, b.n])) continue
      const sc = cosA * 2 - (cl + dl) / 90
      if (!best || sc > best.sc) best = { sc, a: Math.atan2(cy, cx), d: cl + dl, b }
    }
  }
  if (!best) {
    // no clean shot: hit the closest legal ball softly-ish toward a rail
    let tb = null
    for (const b of PL.balls) { if (b.in || b.n === 0) continue; const gr = groupOf(b.n); if (need ? gr !== need : gr === 'eight') continue; const d = Math.hypot(b.x - c.x, b.y - c.y); if (!tb || d < tb.d) tb = { d, b } }
    if (!tb) tb = { d: 20, b: PL.balls.find((b) => !b.in && b.n) }
    best = { a: Math.atan2(tb.b.y - c.y, tb.b.x - c.x), d: tb.d + 10 }
  }
  const power = PL.brk ? 1 : clamp((best.d / 78) * 0.9 + 0.3, 0.25, 1)
  return { a: best.a + R(-1, 1) * D.err, p: clamp(power + R(-1, 1) * D.perr, 0.2, 1) }
}
function botPlace() {
  // pick the spot behind the head string that gives the best first shot
  let best = null
  for (let i = 0; i < 14; i++) {
    const x = R(-TX + 3, TX - 3), y = R(-TY + 3, TY - 3)
    if (PL.balls.some((b) => !b.in && b.n && Math.hypot(b.x - x, b.y - y) < BR * 2.4)) continue
    const c = cue(); const ox = c.x, oy = c.y; c.x = x; c.y = y
    const s = botShotScore(); c.x = ox; c.y = oy
    if (!best || s > best.s) best = { x, y, s }
  }
  return best || { x: -TX * 0.5, y: 0 }
}
function botShotScore() {
  let n = 0
  const c = cue(), p = PL.turn, g = PL.groups[p], need = g ? (myGroupDone(p) ? 'eight' : g) : null
  for (const b of PL.balls) { if (b.in || b.n === 0) continue; const gr = groupOf(b.n); if (need ? gr !== need : gr === 'eight') continue; if (clearPath(c.x, c.y, b.x, b.y, [0, b.n])) n++ }
  return n
}

// ---------- loop ----------
function update(dtRaw) {
  const dt = Math.min(dtRaw, 0.04)
  if (PL.mode === 'idle' || PL.paused) return
  PL.t += dt
  if (PL.msg) { PL.msg.t -= dt; if (PL.msg.t <= 0) PL.msg = null }
  if (PL.net && PL.net.role === 'guest') { stepParticles(dt); PL.emitT -= dt; if (PL.emitT <= 0) { PL.emitT = 0.1; emitP() } return }
  if (PL.phase === 'roll') {
    const moving = stepBalls(dt)
    if (!moving) resolveShot()
    if (PL.net) netTick(dt)
  } else if (PL.phase === 'aim' || PL.phase === 'place') {
    if (isBot(PL.turn)) {
      PL.botT -= dt
      if (PL.botT <= 0) {
        if (PL.phase === 'place') { const q = botPlace(); const c = cue(); c.x = q.x; c.y = q.y; c.vx = c.vy = 0; PL.phase = 'aim'; PL.botT = 0.7; sfx('ui') }
        else { const s = botShot(); PL.aim = { a: s.a, p: s.p }; PL.botT = 9; PL.botFire = 0.9 }
      }
      if (PL.botFire > 0) { PL.botFire -= dt; if (PL.botFire <= 0) { PL.botFire = 0; beginShot(PL.aim.a, PL.aim.p); PL.botT = 1 } }
    } else if (isMyTurn()) humanKeys(dt)
    if (PL.net && PL.net.role === 'host') netTick(dt)
  } else if (PL.phase === 'over' && PL.net && PL.net.role === 'host') netTick(dt)
  stepParticles(dt)
  PL.emitT -= dt
  if (PL.emitT <= 0) { PL.emitT = 0.1; emitP() }
}
function humanKeys(dt) {
  const k = keys
  if (PL.phase === 'place') {
    const c = cue(), mx = (k.ArrowRight ? 1 : 0) - (k.ArrowLeft ? 1 : 0), my = (k.ArrowUp ? 1 : 0) - (k.ArrowDown ? 1 : 0)
    if (mx || my) { c.x = clamp(c.x + mx * 40 * dt, -TX + BR, TX - BR); c.y = clamp(c.y + my * 40 * dt, -TY + BR, TY - BR); PL.hover = { x: c.x, y: c.y }; PL.placeOk = placeable(c.x, c.y) }
    return
  }
  const rot = ((k.ArrowLeft ? 1 : 0) - (k.ArrowRight ? 1 : 0)) * (k.ShiftLeft ? 0.25 : 1.1)
  if (rot) PL.aim.a += rot * dt
  if (k.ArrowUp || k.ArrowDown) PL.aim.p = clamp(PL.aim.p + ((k.ArrowUp ? 1 : 0) - (k.ArrowDown ? 1 : 0)) * 0.7 * dt, 0, 1)
  if (k.Space) { PL.hold = true; PL.charge = Math.min(1, PL.charge + dt * 0.9); PL.aim.p = PL.charge }
  else if (PL.hold) { PL.hold = false; fire() }
  if (PL.net && PL.net.role === 'host' && false) void 0
}
function placeable(x, y) { return Math.abs(x) < TX - BR && Math.abs(y) < TY - BR && !PL.balls.some((b) => !b.in && b.n && Math.hypot(b.x - x, b.y - y) < BR * 2.05) }
function fire() {
  if (PL.phase !== 'aim' || !isMyTurn() || PL.aim.p < 0.06) { PL.charge = 0; return }
  if (PL.net && PL.net.role === 'guest') { PL.net.input({ k: 'shot', a: PL.aim.a, p: PL.aim.p }); PL.phase = 'roll'; PL.drag = null; PL.charge = 0; return }
  beginShot(PL.aim.a, PL.aim.p)
}
function onKey(code) {
  if (PL.mode === 'idle') return
  if (code === 'Escape' || code === 'KeyP') { if (PL.mode === 'play' && !PL.net) { PL.paused = !PL.paused; sfx('ui'); emitP() } return }
  if (PL.paused) { if (code === 'Enter') { PL.paused = false; emitP() } return }
  if (PL.mode === 'over' && code === 'Enter') { poolActions.rematch(); return }
  if (code === 'Enter' && PL.phase === 'place' && isMyTurn() && !isBot(PL.turn)) placeCue(cue().x, cue().y)
}
function placeCue(x, y) {
  if (PL.phase !== 'place' || !isMyTurn()) return
  if (!placeable(x, y)) { sfx('cBad'); return }
  if (PL.net && PL.net.role === 'guest') { PL.net.input({ k: 'place', x, y }); return }
  const c = cue(); c.x = x; c.y = y; c.vx = c.vy = 0; PL.phase = 'aim'; PL.hover = null; sfx('ui'); emitP()
  if (PL.net && PL.net.role === 'host') netNow()
}
export const poolActions = {
  start, stop, quit() { toMenu() },
  resume() { PL.paused = false; emitP() },
  pause() { if (PL.mode === 'play' && !PL.paused && !PL.net) { PL.paused = true; emitP(); return true } return false },
  rematch() { if (PL.net) { PL.net.rematch(); return } start(PL.cfg) },
  // pointer in table coordinates: type 'down' | 'move' | 'up'
  pointer(type, x, y) {
    if (PL.mode !== 'play' || PL.paused || isBot(PL.turn) || !isMyTurn()) return
    if (PL.phase === 'place') {
      if (type === 'move' || type === 'down') { const c = cue(); c.x = clamp(x, -TX + BR, TX - BR); c.y = clamp(y, -TY + BR, TY - BR); PL.hover = { x: c.x, y: c.y }; PL.placeOk = placeable(c.x, c.y) }
      if (type === 'up') placeCue(x, y)
      return
    }
    if (PL.phase !== 'aim') return
    const c = cue()
    if (type === 'down') PL.drag = { x, y }
    else if (type === 'move' && PL.drag) {
      const dx = PL.drag.x - x, dy = PL.drag.y - y, d = Math.hypot(dx, dy)
      if (d > 0.5) { PL.aim.a = Math.atan2(dy, dx); PL.aim.p = clamp(d / 24, 0, 1) }
    } else if (type === 'up' && PL.drag) { const was = PL.drag; PL.drag = null; if (PL.aim.p >= 0.08) fire(); else PL.aim.p = 0; void was; void c }
  },
  aimAt(x, y) { if (PL.phase === 'aim' && isMyTurn() && !PL.drag && !isBot(PL.turn)) { const c = cue(); PL.aim.a = Math.atan2(y - c.y, x - c.x) } },
  fireNow(p) { if (typeof p === 'number') PL.aim.p = clamp(p, 0, 1); fire() },
}

// ---------- online (host simulates) ----------
let nT = 0, nSeq = 0, lastN = -1
const rr = (v) => Math.round(v * 100) / 100
function pack() { return { n: ++nSeq, b: PL.balls.map((b) => [rr(b.x), rr(b.y), b.in ? 1 : 0, b.n]), turn: PL.turn, ph: PL.phase, g: PL.groups, aim: [rr(PL.aim.a), rr(PL.aim.p)], msg: PL.msg, over: PL.over, sc: PL.scored, brk: PL.brk, hv: PL.hover } }
function netTick(dt) { nT -= dt; if (nT <= 0) { nT = PL.phase === 'roll' ? 0.05 : 0.15; PL.net.state(pack()) } }
function netNow() { if (PL.net && PL.net.role === 'host') PL.net.state(pack()) }
export const poolNet = {
  attach(net) { PL.net = net },
  active: () => !!PL.net && PL.mode !== 'idle',
  reset() { nSeq = 0; lastN = -1; nT = 0 },
  applyInput(m) {
    if (!PL.net || PL.net.role !== 'host' || !m || PL.turn !== 1) return
    if (m.k === 'aim' && PL.phase === 'aim') { PL.aim = { a: +m.a || 0, p: clamp(+m.p || 0, 0, 1) } }
    else if (m.k === 'shot' && PL.phase === 'aim') { PL.aim = { a: +m.a || 0, p: clamp(+m.p || 0, 0, 1) }; beginShot(PL.aim.a, PL.aim.p); netNow() }
    else if (m.k === 'place' && PL.phase === 'place') { const x = +m.x, y = +m.y; if (placeable(x, y)) { const c = cue(); c.x = x; c.y = y; c.vx = c.vy = 0; PL.phase = 'aim'; emitP(); netNow() } }
  },
  applyState(s) {
    if (!PL.net || PL.net.role !== 'guest' || !s || s.n <= lastN || PL.mode === 'idle') return
    lastN = s.n
    const prev = PL.balls.map((b) => b.in)
    if (PL.balls.length !== s.b.length) PL.balls = s.b.map((q) => ({ n: q[3], x: q[0], y: q[1], vx: 0, vy: 0, in: !!q[2] }))
    s.b.forEach((q, i) => { const b = PL.balls[i]; if (!b.in && q[2] && prev[i] === false) { sfx('plPocket'); shake(0.5); for (let k = 0; k < 10; k++) part(b.x, b.y, R(-24, 24), R(-24, 24), 0.5, col(ballColor(b.n)), 1) } const mv = Math.hypot(q[0] - b.x, q[1] - b.y); if (mv > 1.2 && s.ph === 'roll' && Math.random() < 0.15) sfx('plClack', 0.4); b.x = q[0]; b.y = q[1]; b.in = !!q[2] })
    PL.turn = s.turn; PL.phase = s.ph; PL.groups = s.g; PL.scored = s.sc; PL.brk = s.brk
    if (PL.turn !== 1) PL.aim = { a: s.aim[0], p: s.aim[1] }
    if (s.hv && !(PL.turn === 1)) PL.hover = s.hv
    if (s.msg && (!PL.msg || PL.msg.text !== s.msg.text)) PL.msg = s.msg
    if (s.over && !PL.over) {
      PL.over = { ...s.over, win: s.over.winner === 1 }; PL.mode = 'over'; music.stop()
      profile.poolGames = (profile.poolGames || 0) + 1
      const won = s.over.winner === 1
      if (won) profile.poolWins = (profile.poolWins || 0) + 1
      PL.over.points = Math.max(0, (won ? 1000 : 0) + s.sc[1] * 60)
      recordScore('pool', PL.over.points); saveProfile(); sfx(won ? 'win' : 'over')
    }
    emitP()
  },
  opponentLeft() { if (PL.net && PL.mode === 'play') endGame(PL.net.role === 'guest' ? 1 : 0, 'OPPONENT LEFT') },
}

// ---------- drawing ----------
function draw(api) {
  const { put } = api
  const felt = col('#0b6b4a')
  rect(put, -TX - 3, -TY - 3, TX + 3, TY + 3, col('#3a1e0e'), 1, -3, 1.6)
  rect(put, -TX, -TY, TX, TY, felt, 1, -2.8, 1.2)
  for (let x = -TX; x <= TX; x += 3) for (let y = -TY; y <= TY; y += 3) put(x, y, -2.6, 0.3, 0.3, 0.05, 0.5, 0.35)
  // head string and spot
  for (let y = -TY; y <= TY; y += 1.4) put(-TX * 0.5, y, -2.4, 0.3, 0.8, 0.5, 0.9, 0.7)
  disk(put, TX * 0.45, 0, 0.5, col('#9ff7c8'), 1, -2.4, 0.4)
  // cushions (lighter strip) and pockets
  for (let x = -TX; x <= TX; x += 1) { put(x, TY + 0.9, -2, 1.1, 1.1, 0.2, 0.9, 0.65); put(x, -TY - 0.9, -2, 1.1, 1.1, 0.2, 0.9, 0.65) }
  for (let y = -TY; y <= TY; y += 1) { put(TX + 0.9, y, -2, 1.1, 1.1, 0.2, 0.9, 0.65); put(-TX - 0.9, y, -2, 1.1, 1.1, 0.2, 0.9, 0.65) }
  for (const [px, py] of POCKETS) { disk(put, px, py, PR * 0.95, col('#020805'), 1, -1.8, 0.5); circle(put, px, py, PR, col('#ffcf4a'), 1.4, -1.7, 0.6) }
  // aim guide
  const c = cue()
  const myAim = PL.phase === 'aim' && !c.in && PL.mode === 'play'
  if (myAim) {
    const a = PL.aim.a, ca = Math.cos(a), sa = Math.sin(a)
    // ray to first ball / rail
    let tmin = 200, hit = null
    for (const b of PL.balls) {
      if (b.in || b.n === 0) continue
      const dx = b.x - c.x, dy = b.y - c.y, t = dx * ca + dy * sa
      if (t <= 0) continue
      const dd = Math.hypot(dx - ca * t, dy - sa * t)
      if (dd < BR * 2) { const tt = t - Math.sqrt(4 * BR * BR - dd * dd); if (tt < tmin) { tmin = tt; hit = b } }
    }
    for (const [lim, ax, ay] of [[TX - BR, ca, c.x], [-TX + BR, ca, c.x], [TY - BR, sa, c.y], [-TY + BR, sa, c.y]]) { const t = (lim - ay) / (ax || 1e-9); if (t > 0 && t < tmin) { tmin = t; hit = null } }
    const mine1 = isMyTurn() || PL.net
    for (let t = BR * 1.6; t < tmin; t += 2) put(c.x + ca * t, c.y + sa * t, -1, 0.5, 0.5, 1.6, 1.6, 1.6)
    circle(put, c.x + ca * tmin, c.y + sa * tmin, BR, col('#ffffff'), 1.4, -1, 0.5)
    if (hit) {
      const gx = c.x + ca * tmin, gy = c.y + sa * tmin, nx = hit.x - gx, ny = hit.y - gy, nl = Math.hypot(nx, ny) || 1
      for (let t = 1.6; t < 8; t += 1.6) put(hit.x + (nx / nl) * t, hit.y + (ny / nl) * t, -1, 0.45, 0.45, 1.3, 1.3, 0.5)
    }
    // cue stick
    const back = BR + 1.5 + PL.aim.p * 9
    for (let t = back; t < back + 26; t += 0.9) { const k = 1 - (t - back) / 40; put(c.x - ca * t, c.y - sa * t, 0.3, 0.7, 0.7, 1.9 * k, 1.5 * k, 0.9 * k) }
    void mine1
  }
  if (PL.phase === 'place' && !c.in) { circle(put, c.x, c.y, BR + 0.8, PL.placeOk === false ? col('#ff4a5a') : col('#6aff9a'), 2, 0, 0.5) }
  // balls
  for (const b of PL.balls) {
    if (b.in) continue
    const bc = col(ballColor(b.n))
    disk(put, b.x + 0.3, b.y - 0.3, BR, col('#000000'), 0, -1.2, 0.5)
    if (b.n > 8) { disk(put, b.x, b.y, BR, col('#f2f2f2'), 1, 0.2, 0.4); for (let dy = -0.45; dy <= 0.46; dy += 0.4) for (let dx = -BR + 0.1; dx <= BR - 0.1; dx += 0.4) if (dx * dx + dy * dy <= BR * BR) put(b.x + dx, b.y + dy, 0.25, 0.42, 0.42, bc[0], bc[1], bc[2]) }
    else disk(put, b.x, b.y, BR, bc, b.n === 0 ? 1.3 : 1, 0.2, 0.4)
    if (b.n) disk(put, b.x, b.y, 0.45, col('#ffffff'), 1.2, 0.5, 0.3)
    put(b.x - 0.4, b.y + 0.4, 0.8, 0.3, 0.3, 2, 2, 2)
  }
  for (const q of G.parts) { const f = q.life / q.max; put(q.x, q.y, 1, q.s * (0.35 + 0.65 * f) * 0.9, q.s * (0.35 + 0.65 * f) * 0.9, q.c[0] * 1.8, q.c[1] * 1.8, q.c[2] * 1.8) }
  void line; void flash; void speak
}
if (typeof window !== 'undefined') { window.__PL = PL; window.__pool = poolActions }
games.pool = { update, onKey, draw, stop, sky: () => '#04100c' }
