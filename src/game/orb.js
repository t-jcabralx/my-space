// ORB RUSH: a marble-shooter in the style of the classic frog games. A chain of coloured orbs rolls along a track toward
// the skull hole; the frog in the middle shoots orbs to make groups of 3+. Adventure (10 levels) and online Versus (same
// level, same orbs; big combos send extra orbs to your opponent).
import { G, emit as engineEmit, keys, games, profile, saveProfile, recordScore, toMenu, shake, flash, stepParticles } from './engine.js'
import { sfx, music } from './audio.js'
import { col, clamp, rng } from './pxl.js'
import { unprojectGround } from './rogue3d.js'
import { registerNet, gameEnded } from './online/gnet.js'

const D = 2.6, PS = 0.4, LEAD = 24
export const COLORS = ['#ff4a4a', '#ffd23a', '#3dff7a', '#3de8ff', '#b07aff', '#ff8ad8']
export const LEVELS = [
  { name: 'JADE SPIRAL', turns: 2.1, r0: 25, r1: 12, A: 0, k: 0, colors: 3, balls: 34, speed: 6.5, tint: '#3dff9a' },
  { name: 'MOSS RING', turns: 2.6, r0: 26, r1: 11, A: 0, k: 0, colors: 4, balls: 44, speed: 7.2, tint: '#6aff6a' },
  { name: 'SUN CLOVER', turns: 2.2, r0: 24, r1: 12, A: 1.8, k: 3, colors: 4, balls: 52, speed: 7.8, tint: '#ffd23a' },
  { name: 'DEEP STAR', turns: 2.4, r0: 25, r1: 12, A: 2.2, k: 5, colors: 5, balls: 60, speed: 8.4, tint: '#3de8ff' },
  { name: 'TWIST GARDEN', turns: 2.9, r0: 26, r1: 11, A: 1.6, k: 4, colors: 5, balls: 70, speed: 9, tint: '#ff8ad8' },
  { name: 'LAVA LOOP', turns: 2.5, r0: 25, r1: 12, A: 2.6, k: 3, colors: 5, balls: 78, speed: 9.6, tint: '#ff6a2a' },
  { name: 'ICE PETAL', turns: 2.7, r0: 26, r1: 12, A: 2.4, k: 6, colors: 6, balls: 86, speed: 10, tint: '#9ad8ff' },
  { name: 'STORM EYE', turns: 3.0, r0: 26, r1: 11, A: 1.9, k: 5, colors: 6, balls: 96, speed: 10.6, tint: '#b07aff' },
  { name: 'CROWN MAZE', turns: 3.1, r0: 26, r1: 11, A: 2.7, k: 7, colors: 6, balls: 106, speed: 11.2, tint: '#ffe84a' },
  { name: 'SKULL TEMPLE', turns: 3.3, r0: 26, r1: 11, A: 2.4, k: 8, colors: 6, balls: 120, speed: 12, tint: '#ff4a4a' },
]
const POWERS = ['slow', 'back', 'bomb', 'stop']

export const OB = { mode: 'idle', paused: false, lvl: 0, path: null, balls: [], shot: null, cur: 0, next: 0, aim: Math.PI / 2, toSpawn: 0, spawned: 0, score: 0, lives: 3, combo: 0, slowT: 0, stopT: 0, backT: 0, rush: 0, over: null, msg: null, fx: [], t: 0, emitT: 0, cool: 0, kind: 'solo', rnd: null, jrnd: null, net: null, foe: null, matches: 0, bestCombo: 0, clearing: 0, stats: { shots: 0, hits: 0 } }
let snap = null
const subs = new Set()
export const subscribeOrb = (f) => { subs.add(f); return () => subs.delete(f) }
export const getOrbSnap = () => snap

// ---------- path ----------
const pathCache = {}
function buildPath(li) {
  if (pathCache[li]) return pathCache[li]
  const L = LEVELS[li], raw = []
  const th0 = Math.PI * (0.55 + (li % 4) * 0.5), dir = li % 2 ? -1 : 1, N = 1600
  for (let i = 0; i <= N; i++) {
    const u = i / N, th = th0 + dir * u * L.turns * Math.PI * 2
    const r = L.r0 + (L.r1 - L.r0) * u + L.A * Math.sin(L.k * u * L.turns * Math.PI * 2) * (1 - u * 0.4)
    raw.push([1.55 * r * Math.cos(th), 0.92 * r * Math.sin(th)])
  }
  // lead-in: the track comes from beyond the screen edge
  const a = raw[0], b = raw[3], dx = a[0] - b[0], dy = a[1] - b[1], dl = Math.hypot(dx, dy) || 1
  const pts0 = [[a[0] + (dx / dl) * LEAD, a[1] + (dy / dl) * LEAD], ...raw]
  // resample evenly
  const out = []
  let acc = 0, need = 0
  out.push({ x: pts0[0][0], y: pts0[0][1], s: 0 })
  for (let i = 1; i < pts0.length; i++) {
    const p = pts0[i - 1], q = pts0[i], seg = Math.hypot(q[0] - p[0], q[1] - p[1])
    let used = 0
    while (acc + (seg - used) >= PS - need) {
      const take = PS - need
      used += take; need = 0; acc = 0
      const u = used / seg
      out.push({ x: p[0] + (q[0] - p[0]) * u, y: p[1] + (q[1] - p[1]) * u, s: out.length * PS })
    }
    need += seg - used; acc = 0
  }
  const path = { pts: out, len: (out.length - 1) * PS }
  // a coarse mask of everything within reach of the track, so decorations stay off it
  { const mk = new Set(); for (let i = 0; i < out.length; i += 2) { const gx = Math.round(out[i].x / 2), gy = Math.round(out[i].y / 2); for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) mk.add((gx + a) + ',' + (gy + b)) } path.near = (x, y) => mk.has(Math.round(x / 2) + ',' + Math.round(y / 2)) }
  pathCache[li] = path
  return path
}
export function posAt(s) {
  const P = OB.path.pts, f = clamp(s / PS, 0, P.length - 1.001), i = Math.floor(f), u = f - i
  const a = P[i], b = P[i + 1]
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, tx: b.x - a.x, ty: b.y - a.y }
}

// ---------- the game ----------
function pickColor() {
  const present = [...new Set(OB.balls.map((b) => b.c))]
  const n = LEVELS[OB.lvl].colors
  if (present.length && OB.rnd() < 0.85) return present[(OB.rnd() * present.length) | 0]
  return (OB.rnd() * n) | 0
}
function loadLevel(li) {
  OB.lvl = li; OB.path = buildPath(li)
  const L = LEVELS[li]
  OB.rnd = rng(OB.seed + li * 977); OB.srnd = rng(OB.seed * 3 + li * 131 + 7)
  OB.balls = []; OB.shot = null; OB.fx = []; OB.combo = 0; OB.slowT = OB.stopT = OB.backT = 0
  OB.toSpawn = L.balls; OB.spawned = 0; OB.cool = 0.5; OB.clearing = 0
  OB.cur = (OB.rnd() * L.colors) | 0; OB.next = (OB.rnd() * L.colors) | 0
  OB.msg = { text: 'LEVEL ' + (li + 1), sub: L.name, t: 2 }
}
function start(o = {}) {
  OB.kind = o.kind === 'versus' ? 'versus' : 'solo'
  OB.seed = o.seed || ((Math.random() * 1e9) | 0)
  OB.score = 0; OB.lives = OB.kind === 'versus' ? 1 : 3; OB.over = null; OB.paused = false; OB.t = 0; OB.matches = 0; OB.bestCombo = 0; OB.stats = { shots: 0, hits: 0 }
  OB.foe = OB.kind === 'versus' ? { p: 0, left: 0, score: 0, name: o.foeName || 'RIVAL', dead: false } : null
  OB.aim = Math.PI / 2
  const li = clamp(o.level | 0, 0, LEVELS.length - 1)
  loadLevel(li)
  G.mode = 'orb'; engineEmit(); G.parts = []; G.pops = []; OB.mode = 'play'
  music.set('cards', 0); sfx('mission'); emitO()
}
function stop() { OB.mode = 'idle'; OB.paused = false; if (OB.net) { gameEnded('orb'); OB.net = null } music.set('menu'); emitO() }
function spawnFx(x, y, c, n = 8, sp = 16, life = 0.6) {
  for (let i = 0; i < n && OB.fx.length < 300; i++) { const a = Math.random() * 6.283, v = Math.random() * sp; OB.fx.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, c, s: 0.4 + Math.random() * 0.5 }) }
}
function makeBall(c) {
  const pw = OB.srnd() < 0.07 ? POWERS[(OB.srnd() * POWERS.length) | 0] : null
  return { s: 0, c, pw }
}
function contiguousRun(i) {
  const B = OB.balls
  let a = i, b = i
  while (a > 0 && B[a - 1].c === B[i].c && B[a].s - B[a - 1].s <= D + 0.2) a--
  while (b < B.length - 1 && B[b + 1].c === B[i].c && B[b + 1].s - B[b].s <= D + 0.2) b++
  return [a, b]
}
function score(n, comboBonus) { const pts = Math.round(n * 10 * (1 + 0.5 * Math.max(0, OB.combo - 1)) + comboBonus); OB.score += pts; return pts }
function removeRun(a, b, chain) {
  const B = OB.balls, n = b - a + 1
  const removed = B.splice(a, n)
  OB.combo = chain ? OB.combo + 1 : 1
  OB.bestCombo = Math.max(OB.bestCombo, OB.combo)
  OB.matches++
  const pts = score(n, n > 3 ? (n - 3) * 20 : 0)
  for (const r of removed) { const p = posAt(r.s); spawnFx(p.x, p.y, r.c, 6, 18, 0.7) }
  const mid = removed[(n / 2) | 0], mp = posAt(mid.s)
  OB.text = { x: mp.x, y: mp.y, v: '+' + pts + (OB.combo > 1 ? ' x' + OB.combo : ''), t: 1 }
  sfx(n >= 5 || OB.combo > 1 ? 'mgBig' : 'mgMerge', OB.combo)
  if (OB.combo > 1) { shake(0.12 * OB.combo) }
  // power-ups hidden in the removed orbs
  for (const r of removed) if (r.pw) applyPower(r.pw, mp)
  // an attack for the rival
  if (OB.net) { const atk = Math.max(0, n - 3) + (OB.combo > 1 ? OB.combo - 1 : 0); if (atk > 0) OB.net.send({ k: 'atk', n: Math.min(8, atk) }) }
  return a // index of the first ball behind the gap is a-1, the first ahead is a
}
function applyPower(pw, p) {
  if (pw === 'slow') { OB.slowT = 7; OB.msg = { text: 'SLOW', sub: 'The chain crawls', t: 1.2 } }
  else if (pw === 'stop') { OB.stopT = 4; OB.msg = { text: 'FREEZE', sub: 'The chain stops', t: 1.2 } }
  else if (pw === 'back') { OB.backT = 1.6; OB.msg = { text: 'REVERSE', sub: 'The chain rolls back', t: 1.2 } }
  else if (pw === 'bomb') {
    const B = OB.balls
    let n = 0
    for (let i = B.length - 1; i >= 0; i--) { const q = posAt(B[i].s); if (Math.hypot(q.x - p.x, q.y - p.y) < 13) { spawnFx(q.x, q.y, B[i].c, 8, 24, 0.8); B.splice(i, 1); n++ } }
    OB.score += n * 15; OB.msg = { text: 'BOOM!', sub: n + ' orbs', t: 1.2 }; shake(0.6); flash(0.25, [1, 0.7, 0.3]); sfx('bigBoom')
  }
  if (pw !== 'bomb') sfx('mgBig')
}
function afterGap(idx) {
  // the junction at idx-1 | idx: if the two touch and match, the chain reacts
  const B = OB.balls
  if (idx <= 0 || idx >= B.length) return
  if (B[idx].s - B[idx - 1].s <= D + 0.3 && B[idx].c === B[idx - 1].c) {
    const [a, b] = contiguousRun(idx)
    if (b - a + 1 >= 3) { const at = removeRun(a, b, true); afterGap(at) }
  }
}
function insertShot(sh, j, front) {
  const B = OB.balls
  const idx = front ? j + 1 : j
  const ball = { s: 0, c: sh.c, pw: null }
  if (idx === 0) ball.s = B[0] ? B[0].s - D : 0
  else ball.s = B[idx - 1].s + D
  B.splice(idx, 0, ball)
  // push the orbs ahead out of the way
  for (let k = idx + 1; k < B.length; k++) { const need = B[k - 1].s + D - B[k].s; if (need > 0) B[k].s += need; else break }
  OB.combo = 0
  const [a, b] = contiguousRun(idx)
  if (b - a + 1 >= 3) { const at = removeRun(a, b, false); afterGap(at) } else sfx('hkWall')
}
function fire() {
  if (OB.mode !== 'play' || OB.paused || OB.shot || OB.cool > 0) return
  const a = OB.aim, sx = Math.cos(a), sy = Math.sin(a)
  OB.shot = { x: sx * 4.2, y: sy * 4.2, vx: sx * 125, vy: sy * 125, c: OB.cur }
  OB.cur = OB.next; OB.next = pickColor(); OB.cool = 0.16; OB.stats.shots++
  sfx('hkServe')
}
function swap() { if (OB.mode !== 'play') return; const t = OB.cur; OB.cur = OB.next; OB.next = t; sfx('hkWall') }
function gapAhead(i) { const B = OB.balls; return i < B.length - 1 && B[i + 1].s - B[i].s > D + 0.01 }
function update(dtRaw) {
  const dt = Math.min(dtRaw, 0.03)
  if (OB.mode === 'idle' || OB.paused) return
  OB.t += dt
  stepParticles(dt)
  for (const q of OB.fx) { q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt }
  OB.fx = OB.fx.filter((q) => q.life > 0)
  if (OB.msg) { OB.msg.t -= dt; if (OB.msg.t <= 0) OB.msg = null }
  if (OB.text) { OB.text.t -= dt; OB.text.y += dt * 4; if (OB.text.t <= 0) OB.text = null }
  if (OB.mode === 'over') { emitTick(dt); return }
  const L = LEVELS[OB.lvl], path = OB.path
  // aim: keyboard (mouse sets OB.aim directly)
  const kx = (keys.ArrowLeft || keys.KeyA ? 1 : 0) - (keys.ArrowRight || keys.KeyD ? 1 : 0)
  if (kx) OB.aim += kx * 2.6 * dt
  if (keys.Space && !OB.spaceHeld) { OB.spaceHeld = true; fire() } else if (!keys.Space) OB.spaceHeld = false
  OB.cool -= dt
  OB.slowT = Math.max(0, OB.slowT - dt); OB.stopT = Math.max(0, OB.stopT - dt); OB.backT = Math.max(0, OB.backT - dt)
  // ---- the chain moves ----
  const B = OB.balls
  const base = L.speed * (1 + Math.min(0.12, OB.lvl * 0.01)) * (OB.slowT > 0 ? 0.35 : 1) * (OB.spawned < 12 ? 5 : 1)
  if (OB.clearing > 0) {
    // the chain is rolling into the hole
    OB.clearing -= dt
    for (const b of B) b.s += 90 * dt
    for (let i = B.length - 1; i >= 0; i--) if (B[i].s >= path.len) { B.splice(i, 1) }
  } else if (OB.backT > 0 && B.length) {
    for (const b of B) b.s = Math.max(b.s - 34 * dt, -D)
    for (let k = 1; k < B.length; k++) if (B[k].s - B[k - 1].s < D) B[k].s = B[k - 1].s + D
  } else if (OB.stopT <= 0 && B.length) {
    // the back-most cluster is pushed by the spawner; clusters ahead of a gap wait for it
    let end = 0
    while (end < B.length - 1 && B[end + 1].s - B[end].s <= D + 0.01) end++
    const catchUp = end < B.length - 1
    const v = base * (catchUp ? 3.2 : 1)
    for (let k = 0; k <= end; k++) B[k].s += v * dt
    if (catchUp) {
      const gap = B[end + 1].s - B[end].s - D
      if (gap <= 0) {
        const shift = -gap
        for (let k = 0; k <= end; k++) B[k].s -= shift
        afterGap(end + 1)
      }
    }
  }
  // spawn new orbs at the start of the track
  if (OB.clearing <= 0 && OB.toSpawn > 0 && (B.length === 0 || B[0].s >= D)) {
    const nb = makeBall(pickColorSpawn())
    nb.s = B.length ? B[0].s - D : 0
    B.unshift(nb); OB.toSpawn--; OB.spawned++
  }
  // ---- the shot orb flies ----
  const sh = OB.shot
  if (sh) {
    const sub = 2
    for (let st = 0; st < sub && OB.shot; st++) {
      sh.x += sh.vx * dt / sub; sh.y += sh.vy * dt / sub
      if (Math.abs(sh.x) > 56 || Math.abs(sh.y) > 34) { OB.shot = null; OB.combo = 0; break }
      for (let j = 0; j < B.length; j++) {
        if (B[j].s < LEAD - D) continue
        const p = posAt(B[j].s)
        if (Math.hypot(p.x - sh.x, p.y - sh.y) < D * 0.9) {
          const front = (sh.x - p.x) * p.tx + (sh.y - p.y) * p.ty > 0
          OB.shot = null; OB.stats.hits++
          insertShot(sh, j, front)
          break
        }
      }
    }
  }
  // ---- level end ----
  if (OB.clearing <= 0 && B.length && B[B.length - 1].s >= path.len - D * 1.2 && OB.mode === 'play') {
    OB.clearing = 3; sfx('over'); flash(0.2, [1, 0.2, 0.2]); shake(0.8)
  }
  if (OB.clearing > 0 && OB.balls.length === 0) lose()
  else if (OB.toSpawn <= 0 && B.length === 0 && OB.clearing <= 0 && OB.mode === 'play') win()
  emitTick(dt)
}
function pickColorSpawn() {
  // spawn colours come from the level's seeded sequence so both versus players face the same chain
  const L = LEVELS[OB.lvl]
  return (OB.srnd() * L.colors) | 0
}
function lose() {
  OB.lives--
  if (OB.net) OB.net.send({ k: 'dead' })
  if (OB.lives <= 0) return finish(false)
  OB.msg = { text: 'LIFE LOST', sub: OB.lives + ' left', t: 2 }
  loadLevel(OB.lvl)
}
function win() {
  const bonus = 500 + OB.lives * 200 + OB.lvl * 100
  OB.score += bonus
  sfx('win'); flash(0.2, [0.6, 1, 0.6])
  if (OB.net) { OB.net.send({ k: 'clear' }); return finish(true) }
  profile.orbLevel = Math.max(profile.orbLevel || 0, OB.lvl + 1)
  if (OB.lvl + 1 >= LEVELS.length) return finish(true)
  loadLevel(OB.lvl + 1)
  OB.msg = { text: 'LEVEL ' + (OB.lvl + 1), sub: LEVELS[OB.lvl].name + '  ·  +' + bonus, t: 2.4 }
}
function finish(win, reason) {
  OB.mode = 'over'; music.stop()
  OB.over = { win, score: OB.score, level: OB.lvl + 1, kind: OB.kind, matches: OB.matches, bestCombo: OB.bestCombo, acc: OB.stats.shots ? Math.round((OB.stats.hits / OB.stats.shots) * 100) : 0, reason: reason || '', foe: OB.foe ? { ...OB.foe } : null }
  profile.orbGames = (profile.orbGames || 0) + 1
  profile.orbBest = Math.max(profile.orbBest || 0, OB.score)
  if (OB.kind === 'versus' && win) profile.orbWins = (profile.orbWins || 0) + 1
  recordScore('orb', OB.score); saveProfile()
  sfx(win ? 'win' : 'over'); emitO()
}
function emitTick(dt) {
  OB.emitT -= dt
  if (OB.emitT <= 0) {
    OB.emitT = 0.1; emitO()
    if (OB.net && OB.mode === 'play') OB.net.send({ k: 'st', p: OB.balls.length ? Math.round((OB.balls[OB.balls.length - 1].s / OB.path.len) * 100) / 100 : 0, left: OB.balls.length + OB.toSpawn, score: OB.score })
  }
}
function emitO() {
  const L = LEVELS[OB.lvl] || LEVELS[0]
  snap = { mode: OB.mode, paused: OB.paused, kind: OB.kind, level: OB.lvl + 1, levels: LEVELS.length, name: L.name, score: OB.score, lives: OB.lives, combo: OB.combo, cur: OB.cur, next: OB.next, left: OB.balls.length + OB.toSpawn, total: L.balls, msg: OB.msg, over: OB.over, slow: OB.slowT > 0, stop: OB.stopT > 0, back: OB.backT > 0, foe: OB.foe ? { ...OB.foe } : null, danger: OB.balls.length ? OB.balls[OB.balls.length - 1].s / (OB.path.len) : 0 }
  subs.forEach((f) => f())
}
function onKey(code) {
  if (OB.mode === 'idle') return
  if (code === 'Escape' || code === 'KeyP') { if (OB.mode === 'play' && !OB.net) { OB.paused = !OB.paused; emitO() } return }
  if (OB.mode === 'over' && code === 'Enter') return orbActions.rematch()
  if (code === 'KeyQ' || code === 'KeyE' || code === 'ArrowUp' || code === 'ArrowDown') swap()
}
const camOrb = () => ({ x: 0, y: 52, z: 31, tx: 0, ty: 0, tz: -1, fov: 45, far: 400, aspect: 100 / 56 })
export const orbActions = {
  start, stop, quit() { toMenu() }, resume() { OB.paused = false; emitO() }, pause() { if (OB.mode === 'play' && !OB.paused && !OB.net) { OB.paused = true; emitO(); return true } return false },
  rematch() { if (OB.net) { if (OB.net.rematch) OB.net.rematch(); return } start({ level: OB.kind === 'solo' ? 0 : OB.lvl, kind: OB.kind }) },
  fire, swap,
  pointerScreen(type, ax, ay) {
    const g = unprojectGround(camOrb(), ax / 50, ay / 28)
    if (!g) return
    if (OB.mode === 'play' && !OB.paused) {
      OB.aim = Math.atan2(g.y, g.x)
      if (type === 'down') fire()
    }
  },
}

// ---------- online (versus) ----------
function netBegin(ctx) {
  const foe = ctx.players.find((p) => p.id !== ctx.players[ctx.me].id)
  start({ kind: 'versus', level: ctx.opts.level || 0, seed: ctx.seed, foeName: foe ? foe.name : 'RIVAL' })
  OB.net = {
    send: (d) => ctx.send(d),
    rematch: () => { if (ctx.role === 'host') ctx.restart(); else ctx.sendHost({ k: 'rematch' }) },
  }
  OB.ctx = ctx
}
registerNet('orb', {
  min: 2,
  begin: netBegin,
  active: () => !!OB.net && OB.mode !== 'idle',
  onMsg(d) {
    if (!d || OB.kind !== 'versus' || OB.mode === 'idle') return
    if (d.k === 'atk') { OB.toSpawn += clamp(d.n | 0, 0, 8); sfx('rgHurt'); OB.msg = { text: 'INCOMING!', sub: '+' + clamp(d.n | 0, 0, 8) + ' orbs', t: 1 } }
    else if (d.k === 'st' && OB.foe) { OB.foe.p = +d.p || 0; OB.foe.left = d.left | 0; OB.foe.score = d.score | 0 }
    else if (d.k === 'dead' && OB.mode === 'play') { if (OB.foe) OB.foe.dead = true; OB.score += 1000; finish(true, 'Your rival was swallowed by the hole') }
    else if (d.k === 'clear' && OB.mode === 'play') finish(false, 'Your rival cleared the board first')
    else if (d.k === 'rematch' && OB.ctx && OB.ctx.role === 'host' && OB.mode === 'over') OB.ctx.restart()
  },
  onLeave() { if (OB.mode === 'play') finish(true, 'Your rival left the match') },
})

// ---------- drawing ----------
const hex = (h, k = 1) => { const c = col(h); return [c[0] * k, c[1] * k, c[2] * k] }
const gh = (a, b) => { let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296 }
function lights() { return { sun: { x: -20, y: 70, z: 30, color: '#fff2dc', intensity: 1.05 }, ambient: 0.78, dir: 0.1, lantern: { x: 0, y: 26, z: 4, color: '#d8ffe0', intensity: 2.2, distance: 110 }, shadow: false } }
const YAW = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c] }
// what the next shot would hit: the first orb along the aim line
function aimHit() {
  const a = OB.aim, dx = Math.cos(a), dy = Math.sin(a)
  for (let d = 5; d < 90; d += 1.2) {
    const x = dx * d, y = dy * d
    if (Math.abs(x) > 56 || Math.abs(y) > 34) return { d, x, y, hit: false }
    for (const b of OB.balls) { if (b.s < LEAD - D) continue; const p = posAt(b.s); if (Math.hypot(p.x - x, p.y - y) < D * 0.9) return { d, x, y, hit: true } }
  }
  return { d: 90, x: dx * 90, y: dy * 90, hit: false }
}
function drawOrb(api, x, y, z, c, size, rot, pw, t, glow = 0) {
  const { put3, putS } = api
  putS(x + 0.3, 0.05, z + 0.3, size * 0.95, 0.08, size * 0.95, 0.01, 0.03, 0.02)         // shadow on the stone
  putS(x, 0.12, z, size * 1.28, 0.1, size * 1.28, c[0] * 0.28 * (1 + glow), c[1] * 0.28 * (1 + glow), c[2] * 0.28 * (1 + glow)) // coloured glow on the ground
  putS(x, size * 0.52, z, size, size, size, c[0], c[1], c[2])                              // the orb
  putS(x, size * 0.5, z, size * 0.7, size * 0.7, size * 0.7, c[0] * 0.55, c[1] * 0.55, c[2] * 0.55) // darker core
  putS(x - size * 0.17, size * 0.88, z - size * 0.17, size * 0.3, size * 0.2, size * 0.3, 2.6, 2.6, 2.6) // shine
  putS(x + size * 0.2, size * 0.28, z + size * 0.2, size * 0.18, size * 0.1, size * 0.18, c[0] * 1.8 + 0.3, c[1] * 1.8 + 0.3, c[2] * 1.8 + 0.3)
  // a band that rolls with the orb so you can see it moving along the track
  const ca = Math.cos(rot), sa = Math.sin(rot)
  putS(x + ca * size * 0.42, size * 0.52 + sa * size * 0.42, z, size * 0.22, size * 0.22, size * 0.22, c[0] * 0.35, c[1] * 0.35, c[2] * 0.35)
  if (pw) {
    const pc = pw === 'bomb' ? [3, 0.5, 0.2] : pw === 'slow' ? [0.4, 1.8, 3] : pw === 'stop' ? [2.4, 2.4, 3] : [0.6, 3, 1], pu = 0.7 + 0.3 * Math.sin(t * 6)
    putS(x, size * 0.52, z, size * 1.2 * pu, size * 1.2 * pu, size * 1.2 * pu, pc[0] * 0.25, pc[1] * 0.25, pc[2] * 0.25)
    if (pw === 'bomb') { putS(x, size * 0.62, z, size * 0.55, size * 0.55, size * 0.55, 0.05, 0.05, 0.06); put3(x + size * 0.25, size * 1.12, z, 0.25, 0.5, 0.25, 0, 0.5, 0.4, 0.2, 0); putS(x + size * 0.32, size * 1.4 + Math.sin(t * 20) * 0.1, z, 0.35, 0.35, 0.35, 3, 2, 0.4) }
    else if (pw === 'slow') { for (let k = 0; k < 4; k++) put3(x + Math.cos(k * 1.57 + t * 2) * size * 0.45, size * 0.9, z + Math.sin(k * 1.57 + t * 2) * size * 0.45, 0.35, 0.35, 0.35, 0, pc[0], pc[1], pc[2], 0) }
    else if (pw === 'stop') { put3(x, size * 1.05, z, size * 0.5, size * 0.5, size * 0.5, 0, pc[0], pc[1], pc[2], t * 2); put3(x, size * 1.05, z, size * 0.78, 0.18, 0.18, 0, pc[0], pc[1], pc[2], t * 2) }
    else { for (let k = -1; k <= 1; k++) put3(x - k * 0.5, size * 1.0, z + 0.2, 0.5, 0.18, 0.18, 0.7 * (k % 2 ? 1 : -1), pc[0], pc[1], pc[2], 0) }
  }
}
function draw3(api) {
  const { put3, putS, putM } = api, t = G.time
  if (!OB.path) return
  const L = LEVELS[OB.lvl], tint = hex(L.tint), P = OB.path.pts, path = OB.path
  const danger = OB.balls.length ? clamp(OB.balls[OB.balls.length - 1].s / path.len, 0, 1) : 0
  // ---- the arena: a mossy temple floor with a carved frame and a forest around it ----
  put3(0, -1.6, 0, 130, 1.6, 80, 0, 0.03, 0.07, 0.04, 0)
  for (let ix = -6; ix <= 6; ix++) for (let iy = -3; iy <= 3; iy++) {
    const x = ix * 8.2, y = iy * 8.2; if (Math.abs(x) > 52 || Math.abs(y) > 30) continue
    const k = (ix + iy) & 1 ? 1 : 0.82, v = 0.9 + gh(ix, iy) * 0.2
    put3(x, -0.35, -y, 8.1, 0.7, 8.1, 0, (0.08 + tint[0] * 0.06) * k * v, (0.2 + tint[1] * 0.07) * k * v, (0.12 + tint[2] * 0.06) * k * v, 0)
  }
  // frame stones and trees at the edge
  for (let i = -26; i <= 26; i++) for (const sy of [-1, 1]) { const x = i * 2.1, y = sy * 31.5; put3(x, 0.8 + (i & 1) * 0.3, -y, 2, 1.8 + (i & 1) * 0.5, 2, 0, 0.3, 0.33, 0.36, i); if (i % 5 === 0) { put3(x, 3.2, -y - sy * 2, 1.2, 4.4, 1.2, 0, 0.18, 0.1, 0.06, 0); put3(x, 6.2, -y - sy * 2, 5.2, 3.4, 5.2, 0, 0.04, 0.2 + tint[1] * 0.1, 0.08, i); put3(x, 8.6, -y - sy * 2, 3.2, 2.6, 3.2, 0, 0.05, 0.26 + tint[1] * 0.12, 0.1, i + 1) } }
  for (let j = -15; j <= 15; j++) for (const sx of [-1, 1]) { const x = sx * 55, y = j * 2.1; put3(x, 0.8 + (j & 1) * 0.3, -y, 2, 1.8 + (j & 1) * 0.5, 2, 0, 0.3, 0.33, 0.36, j); if (j % 5 === 0) { put3(x + sx * 2, 3.2, -y, 1.2, 4.4, 1.2, 0, 0.18, 0.1, 0.06, 0); put3(x + sx * 2, 6.2, -y, 5.2, 3.4, 5.2, 0, 0.04, 0.2 + tint[1] * 0.1, 0.08, j); put3(x + sx * 2, 8.6, -y, 3.2, 2.6, 3.2, 0, 0.05, 0.26 + tint[1] * 0.12, 0.1, j + 1) } }
  // flowers, tufts and glowing mushrooms scattered by cell, never on the track
  for (let ix = -12; ix <= 12; ix++) for (let iy = -7; iy <= 7; iy++) {
    const h1 = gh(ix + 11, iy + 3), h2 = gh(iy + 5, ix + 17), x = ix * 4.4 + h1 * 3, y = iy * 4.4 + h2 * 3
    if (Math.abs(x) > 52 || Math.abs(y) > 29 || path.near(x, y) || Math.hypot(x, y) < 10) continue
    if (h1 > 0.78) { const fc = [[2, 0.5, 0.9], [2.2, 1.9, 0.4], [0.6, 1.2, 2.2], [1.8, 0.8, 2]][(h2 * 4) | 0]; put3(x, 0.5, -y, 0.2, 1, 0.2, 0, 0.1, 0.5, 0.15, 0); putS(x, 1.2, -y, 0.9, 0.5, 0.9, fc[0], fc[1], fc[2]) }
    else if (h1 > 0.5) put3(x, 0.4, -y, 1.4, 0.7, 1.0, 0, 0.05, 0.24 + h2 * 0.1, 0.07, h2 * 6)
    else if (h1 < 0.07) { put3(x, 0.5, -y, 0.4, 1, 0.4, 0, 0.8, 0.75, 0.7, 0); putS(x, 1.2, -y, 1.6, 0.9, 1.6, tint[0] * 1.6 * (0.7 + 0.3 * Math.sin(t * 2 + ix)), tint[1] * 1.6, tint[2] * 1.6) }
  }
  // ---- the carved track: a dark channel between two rows of stones, with runes flowing toward the skull ----
  for (let i = 3; i < P.length - 1; i += 3) {
    const p = P[i]; if (Math.abs(p.x) > 58 || Math.abs(p.y) > 35) continue
    const a = P[Math.max(0, i - 2)], b = P[Math.min(P.length - 1, i + 2)], tx = b.x - a.x, ty = b.y - a.y, tl = Math.hypot(tx, ty) || 1, nx = -ty / tl, ny = tx / tl
    put3(p.x, -0.02, -p.y, 4.1, 0.34, 4.1, 0, 0.05 + tint[0] * 0.03, 0.06 + tint[1] * 0.04, 0.08 + tint[2] * 0.04, 0)
    for (const sd of [-1, 1]) { const q = 2.55 * sd, k = 0.85 + ((i / 3) & 1) * 0.25; put3(p.x + nx * q, 0.55, -(p.y + ny * q), 1.45, 1.1 + ((i / 3) & 1) * 0.3, 1.45, 0, 0.3 * k, 0.33 * k, 0.37 * k, i * 0.37); if (((i / 3) | 0) % 4 === 0) put3(p.x + nx * q, 1.25, -(p.y + ny * q), 1.2, 0.2, 1.2, 0, 0.1, 0.4 + tint[1] * 0.15, 0.15, 0) }
    // a pulse of light runs along the channel toward the hole
    const wave = 0.5 + 0.5 * Math.sin(i * 0.13 - t * 3.2)
    if (((i / 3) | 0) % 3 === 0) put3(p.x, 0.2, -p.y, 1.1, 0.15, 1.1, 0, tint[0] * (0.5 + 1.8 * wave), tint[1] * (0.5 + 1.8 * wave), tint[2] * (0.5 + 1.8 * wave), 0.78)
  }
  // ---- the skull gate where the chain must never arrive ----
  const e = P[P.length - 1], ez = -e.y, pulse = 0.5 + 0.5 * Math.sin(t * (4 + danger * 14)), glowK = 0.5 + danger * 2 + pulse * (0.4 + danger)
  put3(e.x, 0.8, ez, 8.6, 1.6, 8.6, 0, 0.12, 0.1, 0.11, 0); put3(e.x, 1.7, ez, 6.8, 0.5, 6.8, 0, 0.5 * glowK, 0.04, 0.04, t * 0.4)
  putS(e.x, 3.6, ez, 6.2, 5.2, 5.2, 0.92, 0.9, 0.82); put3(e.x, 1.7, ez + 2.6, 4.2, 1.6, 2.2, 0, 0.88, 0.86, 0.78, 0)
  for (let k = -2; k <= 2; k++) put3(e.x + k * 0.8, 1.45, ez + 3.6, 0.55, 0.9, 0.4, 0, 1.8, 1.8, 1.7, 0)
  for (const sd of [-1, 1]) { putS(e.x + sd * 1.3, 4.1, ez + 2.4, 1.7, 1.7, 1.2, 0.04, 0.02, 0.02); putS(e.x + sd * 1.3, 4.1, ez + 2.9, 0.8 + pulse * 0.4, 0.8 + pulse * 0.4, 0.5, 3 * glowK, 0.2, 0.1) }
  put3(e.x, 3.1, ez + 3, 0.7, 1.1, 0.6, 0, 0.04, 0.02, 0.02, 0)
  // ---- the altar and the frog ----
  const a = OB.aim, fy = 1.2
  put3(0, 0.4, 0, 12, 0.8, 12, 0, 0.3, 0.32, 0.36, 0.4); put3(0, 0.9, 0, 10, 0.5, 10, 0, 0.42, 0.45, 0.5, 0.8); put3(0, 1.2, 0, 8, 0.3, 8, 0, 0.2, 0.22, 0.26, 0.2)
  for (let k = 0; k < 8; k++) { const ang = k * 0.785 + t * 0.6; put3(Math.cos(ang) * 5.6, 1.4, Math.sin(ang) * 5.6, 0.8, 0.3, 0.8, 0, tint[0] * 2, tint[1] * 2, tint[2] * 2, ang) }
  const M = YAW(a), W = (lx, ly, lz) => [Math.cos(a) * lx + Math.sin(a) * lz, ly, -Math.sin(a) * lx + Math.cos(a) * lz]
  const part = (lx, ly, lz, sx, sy, sz, c) => { const w = W(lx, ly, lz); putM(w[0], w[1], w[2], sx, sy, sz, M, c[0], c[1], c[2]) }
  const sph = (lx, ly, lz, sx, sy, sz, c) => { const w = W(lx, ly, lz); putS(w[0], w[1], w[2], sx, sy, sz, c[0], c[1], c[2]) }
  const gr = [0.35, 1.5, 0.45], dg = [0.18, 0.9, 0.3], bl = [1.6, 1.7, 0.9], recoil = OB.cool > 0 ? OB.cool / 0.16 : 0, breathe = 1 + Math.sin(t * 3) * 0.04
  sph(-0.6, fy + 2.1, 0, 7 * breathe, 4.6, 6.2, gr); sph(-0.4, fy + 1.7, 0, 5.8, 3, 5.2, bl) // body and belly
  sph(1.9 - recoil * 0.4, fy + 3, 0, 4.6, 3.6, 4.6, gr)                                          // head
  sph(3.6 - recoil * 0.4, fy + 2.5, 0, 3.4 + recoil * 1.2, 1.9 + recoil, 3.6, [1.8, 0.5, 0.55])    // mouth
  for (const sd of [-1, 1]) { sph(1.6, fy + 5.1, sd * 1.7, 1.9, 1.9, 1.9, gr); sph(2.1, fy + 5.2, sd * 1.8, 1.4, 1.4, 1.4, [2.6, 2.6, 2.6]); sph(2.7, fy + 5.2, sd * 1.8, 0.7, 0.8, 0.7, [0.03, 0.03, 0.05]) } // eyes look where you aim
  for (const sd of [-1, 1]) { part(-2.4, fy + 0.9, sd * 3.2, 3.4, 1.4, 1.6, dg); part(2.8, fy + 0.5, sd * 2.9, 2, 0.9, 1.4, dg); sph(-1.2, fy + 2.6, sd * 2.7, 1.4, 1.4, 1.4, [0.3, 1.9, 0.5]) } // legs and spots
  sph(2.4, fy + 1.3, 0, 2.2 + Math.sin(t * 5) * 0.3, 1.6, 2.6, bl)                                // throat sac
  const cc = hex(COLORS[OB.cur], 1.2), nn = hex(COLORS[OB.next], 1.1)
  { const w = W(4.9 - recoil * 0.4, fy + 2.9, 0); drawOrb(api, w[0], 0, w[2], cc, D * 0.98, t * 2, null, t, 1); const w2 = w; putS(w2[0], fy + 3.4, w2[2], D * 0.98, D * 0.98, D * 0.98, cc[0], cc[1], cc[2]) }
  { const w = W(-3.3, fy + 4.6, 0); putS(w[0], w[1], w[2], D * 0.62, D * 0.62, D * 0.62, nn[0], nn[1], nn[2]); putS(w[0] - 0.2, w[1] + 0.3, w[2] - 0.2, 0.5, 0.35, 0.5, 2.6, 2.6, 2.6) }
  // ---- the chain ----
  for (const b of OB.balls) {
    if (b.s < LEAD - D * 1.4) continue
    const p = posAt(b.s), c = hex(COLORS[b.c], 1.2)
    drawOrb(api, p.x, 0, -p.y, c, D, b.s / (D / 2), b.pw, t, danger > 0.8 ? 1 : 0)
  }
  // ---- aiming: a trail of light and a ghost orb where the shot would stick ----
  if (OB.mode === 'play' && !OB.shot) {
    const h = aimHit(), ac = hex(COLORS[OB.cur], 1.5)
    for (let d = 7; d < h.d - 1.5; d += 2.6) put3(Math.cos(a) * d, 1.9, -Math.sin(a) * d, 0.5, 0.3, 0.5, 0, ac[0] * 0.9, ac[1] * 0.9, ac[2] * 0.9, 0)
    if (h.hit) putS(h.x, 1.4, -h.y, D * 1.1, D * 1.1, D * 1.1, ac[0] * 0.35, ac[1] * 0.35, ac[2] * 0.35)
  }
  if (OB.shot) { const c = hex(COLORS[OB.shot.c], 1.3); drawOrb(api, OB.shot.x, 0, -OB.shot.y, c, D, OB.shot.x * 0.6, null, t, 1); for (let q = 1; q < 5; q++) putS(OB.shot.x - OB.shot.vx * 0.006 * q, 1.4, -(OB.shot.y - OB.shot.vy * 0.006 * q), D * (1 - q * 0.18), D * (1 - q * 0.18), D * (1 - q * 0.18), c[0] * 0.5, c[1] * 0.5, c[2] * 0.5) }
  // ---- sparkles and floating points ----
  for (const q of OB.fx) { const f = q.life / q.max, cc2 = hex(COLORS[q.c], 2.2), s = q.s * (0.3 + 0.9 * f); putS(q.x, 1.6 + (1 - f) * 4.5, -q.y, s, s, s, cc2[0], cc2[1], cc2[2]) }
  if (OB.text) { const f = OB.text.t; for (let k = 0; k < 6; k++) put3(OB.text.x + (k - 2.5) * 0.9, 3 + (1 - f) * 5, -OB.text.y, 0.6, 1.4 * f + 0.2, 0.3, 0, 3, 2.6, 0.5, 0) }
}
if (typeof window !== 'undefined') { window.__OB = OB; window.__orb = orbActions }
games.orb = { update, onKey, draw() {}, draw3, camera: () => camOrb(), lights, stop, sky: () => '#04100a' }
