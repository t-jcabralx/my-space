// ORB RUSH: a marble-shooter in the style of the classic frog games. A chain of coloured orbs rolls along a track toward
// the skull hole; the frog in the middle shoots orbs to make groups of 3+. Adventure (10 levels) and online Versus (same
// level, same orbs; big combos send extra orbs to your opponent).
import { G, emit as engineEmit, keys, games, profile, saveProfile, recordScore, toMenu, shake, flash } from './engine.js'
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
const camOrb = () => ({ x: 0, y: 66, z: 38, tx: 0, ty: 0, tz: -1, fov: 45, far: 400, aspect: 100 / 56 })
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
    else if (d.k === 'rematch' && OB.ctx && OB.ctx.role === 'host') OB.ctx.restart()
  },
  onLeave() { if (OB.mode === 'play') finish(true, 'Your rival left the match') },
})

// ---------- drawing ----------
const hex = (h, k = 1) => { const c = col(h); return [c[0] * k, c[1] * k, c[2] * k] }
function lights() { return { sun: { x: -20, y: 70, z: 30, color: '#fff2dc', intensity: 1.0 }, ambient: 0.8, dir: 0.1, lantern: { x: 0, y: 30, z: 4, color: '#c8ffd8', intensity: 2.0, distance: 110 }, shadow: false } }
const YAW = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c] }
function draw3(api) {
  const { put3, putS, putM } = api, t = G.time
  if (!OB.path) return
  const L = LEVELS[OB.lvl], tint = hex(L.tint), P = OB.path.pts
  // ground
  put3(0, -1.4, 0, 112, 1.6, 66, 0, 0.05, 0.14, 0.08, 0)
  put3(0, -0.4, 0, 100, 0.5, 56, 0, 0.08, 0.22, 0.12, 0)
  for (let i = 0; i < 40; i++) { const a = i * 2.399, r = 8 + (i * 7) % 40; put3(Math.cos(a) * r * 1.4, -0.1, Math.sin(a) * r * 0.8, 1.4 + (i % 3), 0.2, 1.2 + (i % 2), 0, 0.1, 0.28 + (i % 4) * 0.03, 0.12, a) }
  // track groove
  for (let i = 0; i < P.length; i += 3) { const p = P[i]; if (Math.abs(p.x) > 56 || Math.abs(p.y) > 33) continue; put3(p.x, 0.0, -p.y, 3.7, 0.3, 3.7, 0, 0.1, 0.07, 0.05, 0); if (i % 9 === 0) put3(p.x, 0.12, -p.y, 3.0, 0.1, 3.0, 0, tint[0] * 0.5, tint[1] * 0.5, tint[2] * 0.5, 0) }
  // skull hole at the end of the track
  const e = P[P.length - 1]
  put3(e.x, 0.6, -e.y, 6.4, 1.4, 6.4, 0, 0.02, 0.01, 0.02, 0)
  const pulse = 0.6 + 0.4 * Math.sin(t * 4)
  put3(e.x, 1.4, -e.y, 5.2, 0.4, 5.2, 0, 1.6 * pulse + 0.4, 0.1, 0.1, t)
  putS(e.x, 2.8, -e.y, 3.6, 3.0, 3.6, 0.9, 0.9, 0.8)
  put3(e.x - 0.8, 3.2, -e.y + 1.3, 0.8, 0.9, 0.5, 0, 0.05, 0.02, 0.02, 0); put3(e.x + 0.8, 3.2, -e.y + 1.3, 0.8, 0.9, 0.5, 0, 0.05, 0.02, 0.02, 0)
  // tunnel where the orbs come from
  const s0 = P[0]
  put3(s0.x, 2, -s0.y, 8, 4, 8, 0, 0.1, 0.1, 0.12, 0)
  // chain
  for (const b of OB.balls) {
    if (b.s < LEAD - D * 1.4) continue
    const p = posAt(b.s), c = hex(COLORS[b.c], 1.15)
    putS(p.x + 0.35, 0.04, -p.y + 0.35, D, 0.1, D, 0.01, 0.03, 0.02)
    putS(p.x, 1.3, -p.y, D, D, D, c[0], c[1], c[2])
    putS(p.x - 0.5, 2.2, -p.y - 0.4, D * 0.3, D * 0.2, D * 0.3, 2.4, 2.4, 2.4)
    if (b.pw) { const pc = b.pw === 'bomb' ? [3, 0.5, 0.2] : b.pw === 'slow' ? [0.4, 1.6, 3] : b.pw === 'stop' ? [2, 2, 3] : [0.6, 3, 1]; put3(p.x, 2.9 + Math.sin(t * 6 + b.s) * 0.2, -p.y, 1.1, 1.1, 1.1, 0, pc[0], pc[1], pc[2], t * 4) }
  }
  // the shot
  if (OB.shot) { const c = hex(COLORS[OB.shot.c], 1.2); putS(OB.shot.x, 1.5, -OB.shot.y, D, D, D, c[0], c[1], c[2]); for (let q = 1; q < 4; q++) putS(OB.shot.x - OB.shot.vx * 0.005 * q, 1.5, -(OB.shot.y - OB.shot.vy * 0.005 * q), D * (1 - q * 0.2), D * (1 - q * 0.2), D * (1 - q * 0.2), c[0] * 0.6, c[1] * 0.6, c[2] * 0.6) }
  // the frog on its stone
  const a = OB.aim, M = YAW(a), cx = (lx, ly, lz) => [Math.cos(a) * lx + Math.sin(a) * lz, ly, -(Math.sin(a) * lx - Math.cos(a) * lz)]
  void cx
  put3(0, 0.3, 0, 8.4, 0.9, 8.4, 0, 0.35, 0.36, 0.4, 0.4); put3(0, 0.9, 0, 6.6, 0.5, 6.6, 0, 0.5, 0.52, 0.56, 0.8)
  const fc = hex('#4ade5a', 1.0), fd = hex('#2a9a3a'), cur = hex(COLORS[OB.cur], 1.3), nx = hex(COLORS[OB.next], 1.1)
  const W = (lx, ly, lz) => [Math.cos(a) * lx + Math.sin(a) * lz, ly, -Math.sin(a) * lx + Math.cos(a) * lz]
  const part = (lx, ly, lz, sx, sy, sz, c) => { const w = W(lx, ly, lz); putM(w[0], w[1], w[2], sx, sy, sz, M, c[0], c[1], c[2]) }
  part(-0.4, 2.2, 0, 4.4, 2.6, 5.2, fc)            // body
  part(-0.4, 3.9, 0, 3.4, 1.0, 4.0, fd)            // back
  part(2.2, 2.5, 0, 2.6, 1.8, 3.4, fc)              // head
  part(2.8, 3.7, 1.35, 1.0, 1.0, 1.0, [3, 3, 3]); part(2.8, 3.7, -1.35, 1.0, 1.0, 1.0, [3, 3, 3])
  part(3.2, 3.7, 1.35, 0.5, 0.5, 0.5, [0.05, 0.05, 0.05]); part(3.2, 3.7, -1.35, 0.5, 0.5, 0.5, [0.05, 0.05, 0.05])
  part(-1.6, 1.2, 2.8, 2.6, 1.0, 1.4, fd); part(-1.6, 1.2, -2.8, 2.6, 1.0, 1.4, fd)
  part(3.6, 2.6, 0, 2.2, 1.0, 2.4, [1.8, 0.4, 0.5])   // mouth
  { const w = W(4.6, 3.2, 0); putS(w[0], w[1], w[2], D * 0.95, D * 0.95, D * 0.95, cur[0], cur[1], cur[2]) }
  { const w = W(-2.6, 4.6, 0); putS(w[0], w[1], w[2], D * 0.6, D * 0.6, D * 0.6, nx[0], nx[1], nx[2]) }
  // aim guide
  for (let i = 1; i <= 10; i++) { const d = 8 + i * 3.4; put3(Math.cos(a) * d, 0.4, -Math.sin(a) * d, 0.35, 0.2, 0.35, 0, 1.8 * (1 - i / 12), 1.8 * (1 - i / 12), 1.4 * (1 - i / 12), 0) }
  // particles and score pops
  for (const q of OB.fx) { const f = q.life / q.max, c = hex(COLORS[q.c], 1.8), s = q.s * (0.3 + 0.7 * f); putS(q.x, 1.5 + (1 - f) * 3, -q.y, s, s, s, c[0], c[1], c[2]) }
}
if (typeof window !== 'undefined') { window.__OB = OB; window.__orb = orbActions }
games.orb = { update, onKey, draw() {}, draw3, camera: () => camOrb(), lights, stop, sky: () => '#04100a' }
