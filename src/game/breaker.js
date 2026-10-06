// NEON BREAKER: bounce the ball, smash every brick. 5 levels, power-ups (wide paddle, multi-ball, slow, extra life), 3 lives.
import { G, emit as engineEmit, keys, games, profile, saveProfile, recordScore, part, ring, shake, flash, stepParticles, toMenu } from './engine.js'
import { sfx, music } from './audio.js'
import { col, rect, disk, clamp, R } from './pxl.js'

const BW = 6.4, BH = 2.4, COLS = 12, TOP = 22
const BCOL = ['#3de8ff', '#6aff9a', '#ffe84a', '#ff9a3a', '#ff4a8a', '#c58aff']
const LEVELS = [
  ['111111111111', '111111111111', '111111111111'],
  ['222222222222', '1010101010101'.slice(0, 12), '111111111111', '010101010101'],
  ['000111111000', '001122221100', '011222222110', '112233332211', '011222222110'],
  ['303030303030', '121212121212', '212121212121', '303030303030', '111111111111'],
  ['333333333333', '322222222223', '321111111123', '321000000123', '321111111123', '322222222223'],
]
export const BK = { mode: 'idle', paused: false, level: 0, bricks: [], balls: [], pad: { x: 0, w: 12, wide: 0 }, ups: [], lives: 3, score: 0, over: null, slow: 0, emitT: 0, msg: null, ptr: null, combo: 0, stuck: true, t: 0 }
let snap = null
const subs = new Set()
export const subscribeBreaker = (f) => { subs.add(f); return () => subs.delete(f) }
export const getBreakerSnap = () => snap
function emitB() { snap = { mode: BK.mode, paused: BK.paused, level: BK.level + 1, levels: LEVELS.length, lives: BK.lives, score: BK.score, over: BK.over, msg: BK.msg, stuck: BK.stuck, slow: BK.slow > 0, wide: BK.pad.wide > 0 }; subs.forEach((f) => f()) }
function load(l) {
  BK.bricks = []
  LEVELS[l].forEach((row, j) => { for (let i = 0; i < COLS; i++) { const hp = +row[i] || 0; if (hp) BK.bricks.push({ x: -38.4 + BW / 2 + i * BW, y: TOP - j * BH - BH / 2, hp, max: hp, c: BCOL[(i + j) % BCOL.length] }) } })
  BK.balls = [{ x: 0, y: -22, vx: 0, vy: 0 }]; BK.stuck = true; BK.ups = []; BK.pad.wide = 0; BK.pad.w = 12; BK.slow = 0; BK.combo = 0
}
function start() {
  BK.level = 0; BK.lives = 3; BK.score = 0; BK.over = null; BK.paused = false; BK.pad.x = 0; BK.msg = { text: 'LEVEL 1', t: 1.4 }
  load(0)
  G.mode = 'breaker'; engineEmit(); G.parts = []; G.pops = []; BK.mode = 'play'
  music.set('bomber', 0); sfx('mission'); emitB()
}
function stop() { BK.mode = 'idle'; BK.paused = false; music.set('menu'); emitB() }
function launch() { if (!BK.stuck) return; BK.stuck = false; const b = BK.balls[0]; const a = R(-0.4, 0.4); b.vx = Math.sin(a) * 36; b.vy = Math.cos(a) * 36; sfx('hkServe') }
function powerUp(x, y) {
  const r = Math.random()
  if (r > 0.2) return
  const type = ['wide', 'multi', 'slow', 'life'][r < 0.02 ? 3 : r < 0.08 ? 1 : r < 0.14 ? 0 : 2]
  BK.ups.push({ x, y, type })
}
function update(dtRaw) {
  const dt = Math.min(dtRaw, 0.03)
  if (BK.mode === 'idle' || BK.paused) return
  if (BK.mode === 'over') { stepParticles(dt); return }
  BK.t += dt
  if (BK.msg) { BK.msg.t -= dt; if (BK.msg.t <= 0) BK.msg = null }
  const k = keys
  const kx = (k.ArrowRight || k.KeyD ? 1 : 0) - (k.ArrowLeft || k.KeyA ? 1 : 0)
  if (kx) { BK.pad.x += kx * 60 * dt; BK.ptr = null } else if (BK.ptr !== null) BK.pad.x += (BK.ptr - BK.pad.x) * Math.min(1, dt * 22)
  BK.pad.w = BK.pad.wide > 0 ? 19 : 12; BK.pad.wide = Math.max(0, BK.pad.wide - dt); BK.slow = Math.max(0, BK.slow - dt)
  BK.pad.x = clamp(BK.pad.x, -40 + BK.pad.w / 2, 40 - BK.pad.w / 2)
  if (k.Space && BK.stuck) launch()
  const sp = BK.slow > 0 ? 0.65 : 1
  for (const b of BK.balls) {
    if (BK.stuck) { b.x = BK.pad.x; b.y = -22; continue }
    const sub = 3
    for (let s = 0; s < sub; s++) {
      b.x += b.vx * sp * dt / sub; b.y += b.vy * sp * dt / sub
      if (b.x < -40 + 0.9) { b.x = -39.1; b.vx = Math.abs(b.vx); sfx('hkWall') } else if (b.x > 40 - 0.9) { b.x = 39.1; b.vx = -Math.abs(b.vx); sfx('hkWall') }
      if (b.y > 25 - 0.9) { b.y = 24.1; b.vy = -Math.abs(b.vy); sfx('hkWall') }
      // paddle
      if (b.vy < 0 && b.y < -22.4 + 1.2 && b.y > -24 && Math.abs(b.x - BK.pad.x) < BK.pad.w / 2 + 0.9) {
        const u = clamp((b.x - BK.pad.x) / (BK.pad.w / 2), -1, 1), a = u * 1.05, spd = Math.min(62, Math.hypot(b.vx, b.vy) * 1.015)
        b.vx = Math.sin(a) * spd; b.vy = Math.cos(a) * spd; b.y = -21.2; sfx('hkHit'); BK.combo = 0
      }
      for (const br of BK.bricks) {
        if (br.hp <= 0) continue
        if (Math.abs(b.x - br.x) < BW / 2 + 0.9 && Math.abs(b.y - br.y) < BH / 2 + 0.9) {
          const ox = BW / 2 + 0.9 - Math.abs(b.x - br.x), oy = BH / 2 + 0.9 - Math.abs(b.y - br.y)
          if (ox < oy) b.vx = (b.x < br.x ? -1 : 1) * Math.abs(b.vx); else b.vy = (b.y < br.y ? -1 : 1) * Math.abs(b.vy)
          br.hp--; BK.combo++
          BK.score += 10 * br.max * (1 + Math.min(BK.combo, 10) * 0.1) | 0
          sfx(br.hp > 0 ? 'hkWall' : 'mgMerge', BK.combo)
          for (let i = 0; i < (br.hp > 0 ? 3 : 9); i++) part(br.x, br.y, R(-26, 26), R(-26, 26), 0.4, col(br.c), R(0.8, 1.4))
          if (br.hp <= 0) { powerUp(br.x, br.y); shake(0.15) }
          break
        }
      }
    }
  }
  BK.balls = BK.balls.filter((b) => BK.stuck || b.y > -28)
  BK.bricks = BK.bricks.filter((b) => b.hp > 0)
  for (const u of BK.ups) {
    u.y -= 14 * dt
    if (u.y < -22 + 1.4 && u.y > -25 && Math.abs(u.x - BK.pad.x) < BK.pad.w / 2 + 1.2) {
      u.got = true; sfx('mgBig')
      if (u.type === 'wide') BK.pad.wide = 14
      else if (u.type === 'slow') BK.slow = 10
      else if (u.type === 'life') BK.lives = Math.min(5, BK.lives + 1)
      else { const src = BK.balls[0]; if (src && !BK.stuck) for (let i = 0; i < 2; i++) { const a = Math.atan2(src.vy, src.vx) + (i ? 0.5 : -0.5), sp2 = Math.hypot(src.vx, src.vy); BK.balls.push({ x: src.x, y: src.y, vx: Math.cos(a) * sp2, vy: Math.sin(a) * sp2 }) } }
      BK.msg = { text: u.type === 'wide' ? 'WIDE PADDLE' : u.type === 'slow' ? 'SLOW BALL' : u.type === 'life' ? 'EXTRA LIFE' : 'MULTI-BALL', t: 1 }
    }
  }
  BK.ups = BK.ups.filter((u) => !u.got && u.y > -28)
  if (!BK.stuck && !BK.balls.length) {
    BK.lives--; sfx('rgHurt'); shake(1); flash(0.2, [1, 0.3, 0.3])
    if (BK.lives <= 0) return finish(false)
    BK.balls = [{ x: BK.pad.x, y: -22, vx: 0, vy: 0 }]; BK.stuck = true
  }
  if (!BK.bricks.length) {
    BK.score += 500 + BK.lives * 100; sfx('win')
    if (BK.level + 1 >= LEVELS.length) return finish(true)
    BK.level++; load(BK.level); BK.msg = { text: 'LEVEL ' + (BK.level + 1), t: 1.4 }
  }
  stepParticles(dt)
  BK.emitT -= dt
  if (BK.emitT <= 0) { BK.emitT = 0.12; emitB() }
}
function finish(win) {
  BK.mode = 'over'; music.stop()
  BK.over = { win, score: BK.score, level: BK.level + 1 }
  profile.breakerGames = (profile.breakerGames || 0) + 1; profile.breakerBest = Math.max(profile.breakerBest || 0, BK.score)
  recordScore('breaker', BK.score); saveProfile(); sfx(win ? 'win' : 'over'); emitB()
}
function onKey(code) {
  if (BK.mode === 'idle') return
  if (code === 'Escape' || code === 'KeyP') { if (BK.mode === 'play') { BK.paused = !BK.paused; emitB() } return }
  if (BK.mode === 'over' && code === 'Enter') return breakerActions.rematch()
  if (code === 'Space' || code === 'ArrowUp') launch()
}
export const breakerActions = {
  start, stop, quit() { toMenu() }, resume() { BK.paused = false; emitB() }, pause() { if (BK.mode === 'play' && !BK.paused) { BK.paused = true; emitB(); return true } return false }, rematch() { start() },
  pointer(type, x) { if (BK.mode !== 'play') return; BK.ptr = x; if (type === 'down') launch() }, launch,
}
function draw(api) {
  const { put } = api, t = G.time
  rect(put, -41, -26, 41, 26, col('#04060f'), 1, -3.4, 1.6)
  for (let i = 0; i < 20; i++) put(-38 + i * 4, 0, -3, 0.15, 52, 0.04, 0.07, 0.14)
  for (let y = -26; y <= 26; y += 1) { put(-40.5, y, -1, 1.1, 1.1, 0.2, 0.7, 1.4); put(40.5, y, -1, 1.1, 1.1, 0.2, 0.7, 1.4) }
  for (let x = -40; x <= 40; x += 1) put(x, 25.5, -1, 1.1, 1.1, 0.2, 0.7, 1.4)
  for (const br of BK.bricks) { const c = col(br.c), k = 0.5 + 0.5 * (br.hp / br.max); rect(put, br.x - BW / 2 + 0.2, br.y - BH / 2 + 0.2, br.x + BW / 2 - 0.2, br.y + BH / 2 - 0.2, c, 1.2 * k + (br.max > 1 ? 0.3 : 0), 0, 0.7); put(br.x, br.y + BH / 2 - 0.5, 0.2, BW - 0.6, 0.35, c[0] * 2, c[1] * 2, c[2] * 2) }
  for (const u of BK.ups) { const c = col(u.type === 'life' ? '#ff4a6a' : u.type === 'wide' ? '#3de8ff' : u.type === 'slow' ? '#9ad8ff' : '#ffe84a'); disk(put, u.x, u.y, 1.2, c, 1.8 + Math.sin(t * 10) * 0.4, 0.3, 0.4) }
  const pc = col(BK.pad.wide > 0 ? '#6aff9a' : '#3de8ff')
  rect(put, BK.pad.x - BK.pad.w / 2, -23.4, BK.pad.x + BK.pad.w / 2, -22.2, pc, 1.5, 0.2, 0.6)
  for (const b of BK.balls) { disk(put, b.x, b.y, 0.9, col('#ffffff'), 2, 0.4, 0.4); if (!BK.stuck) for (let i = 1; i < 5; i++) put(b.x - b.vx * 0.012 * i, b.y - b.vy * 0.012 * i, 0.3, 0.7 - i * 0.12, 0.7 - i * 0.12, 1.2 / i, 1.2 / i, 1.6 / i) }
  for (const q of G.parts) { const f = q.life / q.max; put(q.x, q.y, 1, q.s * (0.35 + 0.65 * f) * 0.9, q.s * (0.35 + 0.65 * f) * 0.9, q.c[0] * 1.8, q.c[1] * 1.8, q.c[2] * 1.8) }
}
if (typeof window !== 'undefined') { window.__BK = BK; window.__breaker = breakerActions }
games.breaker = { update, onKey, draw, stop, sky: () => '#03050c' }
