// GIRDER GORILLA: a 3D barrel-dodging climb in the spirit of the classic giant-ape arcade game.
// Run along sloping steel girders, climb ladders, jump the rolling barrels, grab the hammer, and reach the captive at the top.
// The girders can be made up to 20 times wider (more ladders, more gorillas, a minimap). 1 or 2 players, or a friend online.
import { G, emit as engineEmit, keys, games, profile, saveProfile, recordScore, toMenu, shake, flash, stepParticles } from './engine.js'
import { sfx, music } from './audio.js'
import { clamp, rng } from './pxl.js'
import { registerNet, gameEnded } from './online/gnet.js'

export const FH = 11, AMP = 4, SIZES = [1, 2, 4, 8, 12, 20]
export const LEVELS = [
  { name: 'THE SITE', floors: 5, speed: 11, throw: 4.4, fires: 0 },
  { name: 'RIVETED RISE', floors: 6, speed: 12, throw: 4, fires: 1 },
  { name: 'STEEL CANYON', floors: 6, speed: 13, throw: 3.6, fires: 2 },
  { name: 'THE TOWER', floors: 7, speed: 14, throw: 3.3, fires: 2 },
  { name: 'SKYLINE', floors: 7, speed: 15, throw: 3, fires: 3 },
  { name: 'THUNDER ROOF', floors: 8, speed: 16, throw: 2.8, fires: 3 },
  { name: 'THE FURNACE', floors: 8, speed: 17, throw: 2.6, fires: 4 },
  { name: 'KONG\'S PENTHOUSE', floors: 9, speed: 18, throw: 2.4, fires: 4 },
]
export const KG = { mode: 'idle', paused: false, lvl: 0, size: 1, W: 60, seed: 1, floors: 0, ladders: [], hammers: [], bonus: [], players: [], barrels: [], fires: [], kongs: [], princess: null, t: 0, timer: 0, score: 0, over: null, msg: null, fx: [], id: 1, kind: 'solo', net: null, emitT: 0, clearT: 0, netT: 0, rnd: null, me: 0, camX: 0, camY: 8 }
let snap = null
const subs = new Set()
export const subscribeKong = (f) => { subs.add(f); return () => subs.delete(f) }
export const getKongSnap = () => snap
const fx = (x, y, n, c, sp = 10, life = 0.5, s = 0.4) => { for (let i = 0; i < n && KG.fx.length < 240; i++) { const a = Math.random() * 6.283, v = Math.random() * sp; KG.fx.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.8 + 3, life, max: life, c, s: s * (0.6 + Math.random() * 0.8) }) } }

// ---------- the girders ----------
const base = (i) => i * FH + 2
export const rollDir = (i) => (i % 2 === 0 ? 1 : -1) // barrels roll toward +x on even floors, -x on odd floors
export const surf = (i, x) => base(i) - rollDir(i) * AMP * (x / KG.W)
const gapOf = (i) => (i === 0 ? null : rollDir(i) > 0 ? [KG.W / 2 - 8, KG.W / 2] : [-KG.W / 2, -KG.W / 2 + 8]) // where the barrels drop to the floor below
const hasFloor = (i, x) => { if (Math.abs(x) > KG.W / 2) return false; const g = gapOf(i); if (g && x > g[0] && x < g[1]) return false; if (i === KG.floors - 1 && Math.abs(x) > KG.W / 2) return false; return true }
function build(li, size, seed) {
  const L = LEVELS[Math.min(li, LEVELS.length - 1)], r = rng(seed * 17 + li * 5 + size)
  KG.size = size; KG.W = 60 * size; KG.floors = L.floors
  KG.ladders = []; KG.hammers = []; KG.bonus = []; KG.kongs = []
  const per = 2 + Math.round(size * 1.5)
  for (let i = 0; i < KG.floors - 1; i++) {
    const xs = []
    for (let k = 0; k < per * 3 && xs.length < per; k++) { const x = (r() * 2 - 1) * (KG.W / 2 - 14); if (xs.every((q) => Math.abs(q - x) > 12) && hasFloor(i, x) && hasFloor(i + 1, x)) xs.push(x) }
    // alternate floors lean on a ladder near the middle so there is always a way up
    if (!xs.length) xs.push(0)
    xs.forEach((x, k) => KG.ladders.push({ id: KG.id++, i, x, broken: k > 0 && r() < 0.28 && xs.length > 2 }))
    for (let k = 0; k < Math.round(size * 0.5) + (i % 2); k++) { const x = (r() * 2 - 1) * (KG.W / 2 - 12); if (hasFloor(i, x)) KG.bonus.push({ id: KG.id++, i, x, t: (r() * 4) | 0, got: false }) }
  }
  for (let k = 0; k < 2 + size; k++) { const i = 1 + ((r() * (KG.floors - 2)) | 0), x = (r() * 2 - 1) * (KG.W / 2 - 14); if (hasFloor(i, x)) KG.hammers.push({ id: KG.id++, i, x, got: false }) }
  // the gorillas stand at the high end of the top floor and the captive waits at the low end
  const top = KG.floors - 1, hd = -rollDir(top), n = 1 + Math.floor(size / 2)
  for (let k = 0; k < n; k++) KG.kongs.push({ id: KG.id++, x: hd * (KG.W / 2 - 8 - k * Math.min(24, (KG.W - 30) / n)), i: top, t: 1 + r() * 2, wind: 0 })
  KG.princess = { i: top, x: rollDir(top) * (KG.W / 2 - 14) }
  return L
}
function mkPlayer(i, name) {
  return { i, name, x: -KG.W / 2 + 10 + i * 4, y: surf(0, -KG.W / 2 + 10), fl: 0, vx: 0, vy: 0, face: 1, ground: true, ladder: null, lives: 3, score: 0, dead: 0, inv: 2, ham: 0, hit: 0, anim: 0, jumped: new Set(), in: { dx: 0, dy: 0, jump: false, hit: false }, jumpHeld: false, out: false, gone: false, color: i ? '#ff6ab8' : '#ff3a3a', done: false, best: 0 }
}
function start(o = {}) {
  KG.kind = o.net ? 'coop' : o.two ? 'two' : 'solo'
  KG.lvl = clamp(o.level | 0, 0, LEVELS.length - 1); KG.seed = o.seed || ((Math.random() * 1e9) | 0)
  const size = SIZES.includes(o.size) ? o.size : SIZES.includes(profile.kongSize) ? profile.kongSize : 4
  KG.rnd = rng(KG.seed + 3); KG.id = 1; KG.t = 0; KG.score = 0; KG.over = null; KG.msg = null; KG.paused = false; KG.net = o.net || null; KG.me = o.net ? o.net.me : 0
  KG.size = size; KG.W = 60 * size
  KG.players = Array.from({ length: o.net ? o.net.players.length : o.two ? 2 : 1 }, (_, i) => mkPlayer(i, o.net ? o.net.players[i].name : i ? 'PLAYER 2' : (profile.name || 'PLAYER 1')))
  newLevel()
  G.mode = 'kong'; engineEmit(); G.parts = []; G.pops = []; KG.mode = 'play'
  music.set('bomber', 0); sfx('mission'); emitK()
}
function newLevel() {
  const L = build(KG.lvl, KG.size, KG.seed)
  KG.barrels = []; KG.fires = []; KG.fx = []; KG.clearT = 0; KG.timer = 5000 + KG.size * 200; KG.fireT = 12
  KG.players.forEach((p, i) => { p.x = -KG.W / 2 + 10 + i * 4; p.fl = 0; p.y = surf(0, p.x); p.vx = p.vy = 0; p.ground = true; p.ladder = null; p.dead = 0; p.inv = 2; p.ham = 0; p.done = false; p.best = 0; if (p.lives <= 0) p.lives = 1; p.out = false })
  KG.camX = KG.players[0].x; KG.camY = 8
  KG.msg = { text: 'LEVEL ' + (KG.lvl + 1), sub: L.name + ' · ' + KG.W + ' m WIDE', t: 3 }
}
function stop() { if (KG.net) { gameEnded('kong'); KG.net = null } KG.mode = 'idle'; KG.paused = false; music.set('menu'); emitK() }

// ---------- simulation ----------
const L0 = () => LEVELS[Math.min(KG.lvl, LEVELS.length - 1)]
function hurt(p) {
  if (p.dead > 0 || p.inv > 0 || p.out || p.done) return
  p.lives--; p.dead = 1.8; p.ladder = null; p.ham = 0; p.vy = 16
  fx(p.x, p.y + 1.5, 16, [2, 0.5, 0.3], 14, 0.7, 0.5)
  if (!KG.net || p.i === KG.me) { sfx('rgHurt'); shake(0.6) }
}
function stepPlayer(p, dt) {
  const I = p.in
  p.anim += dt; p.inv = Math.max(0, p.inv - dt); p.hit = Math.max(0, p.hit - dt)
  if (p.gone || p.out) return
  if (p.dead > 0) {
    p.dead -= dt; p.y += p.vy * dt; p.vy -= 60 * dt
    if (p.dead <= 0) {
      if (p.lives <= 0) { p.out = true; return }
      // back to where you started the floor you died on (the lowest floor if you were on a ladder)
      p.fl = Math.max(0, Math.min(p.fl, KG.floors - 2)); p.x = clamp(p.x, -KG.W / 2 + 6, KG.W / 2 - 12); if (!hasFloor(p.fl, p.x)) p.x = 0
      p.y = surf(p.fl, p.x); p.vx = p.vy = 0; p.ground = true; p.inv = 2.4
      for (const b of KG.barrels) if (Math.abs(b.x - p.x) < 10 && b.i === p.fl) b.dead = true
    }
    return
  }
  const spd = p.ham > 0 ? 8 : 12
  if (p.ham > 0) { p.ham -= dt; if (p.ham <= 0) p.ham = 0 }
  if (p.ladder) {
    // on a ladder: up and down only
    const lad = p.ladder
    p.x = lad.x; p.vx = 0
    p.y += I.dy * 8 * dt
    const lo = surf(lad.i, lad.x), hi = surf(lad.i + 1, lad.x)
    if (p.y >= hi) { p.y = hi; p.fl = lad.i + 1; p.ladder = null; p.ground = true; p.best = Math.max(p.best, p.fl) }
    else if (p.y <= lo) { p.y = lo; p.fl = lad.i; p.ladder = null; p.ground = true }
    if (I.jump && !p.jumpHeld && !I.dy) { p.ladder = null; p.vy = 8; p.ground = false; p.vx = I.dx * spd }
    p.jumpHeld = !!I.jump
    return
  }
  p.vx = I.dx * spd
  if (I.dx) p.face = Math.sign(I.dx)
  const nx = clamp(p.x + p.vx * dt, -KG.W / 2 + 1.5, KG.W / 2 - 1.5)
  if (p.ground) {
    p.x = nx
    if (!hasFloor(p.fl, p.x)) { p.ground = false; p.vy = 0 } else p.y = surf(p.fl, p.x)
    if (I.jump && !p.jumpHeld && p.ham <= 0) { p.vy = 27; p.ground = false; p.jumped = new Set(); if (!KG.net || p.i === KG.me) sfx('jump') }
    // grab a ladder: up from its foot, down from its top
    if (I.dy && p.ham <= 0) {
      for (const lad of KG.ladders) {
        if (lad.broken || Math.abs(lad.x - p.x) > 1.3) continue
        if (I.dy > 0 && lad.i === p.fl) { p.ladder = lad; break }
        if (I.dy < 0 && lad.i + 1 === p.fl) { p.ladder = lad; p.y = surf(lad.i + 1, lad.x) - 0.01; break }
      }
    }
  } else {
    p.x = nx; p.vy -= 70 * dt; const prev = p.y; p.y += p.vy * dt
    if (p.vy <= 0) {
      for (let f = KG.floors - 1; f >= 0; f--) {
        if (!hasFloor(f, p.x)) continue
        const s = surf(f, p.x)
        if (prev >= s - 0.4 && p.y <= s) { p.y = s; p.vy = 0; p.ground = true; p.fl = f; if (!KG.net || p.i === KG.me) sfx('land'); break }
      }
    }
    if (p.y < -12) hurt(p)
  }
  p.jumpHeld = !!I.jump
  p.best = Math.max(p.best, p.fl)
  // hammer swing
  if (p.ham > 0 && I.hit) { if (Math.floor(p.anim * 8) !== p.lastSw) { p.lastSw = Math.floor(p.anim * 8); smash(p) } }
  // pick things up
  for (const h of KG.hammers) if (!h.got && h.i === p.fl && Math.abs(h.x - p.x) < 1.8 && p.ground) { h.got = true; p.ham = 10; sfx('pickup'); KG.msg = { text: 'HAMMER TIME!', sub: '', t: 1 } }
  for (const b of KG.bonus) if (!b.got && b.i === p.fl && Math.abs(b.x - p.x) < 1.8 && Math.abs(p.y - surf(b.i, b.x)) < 2.5) { b.got = true; p.score += 300; KG.score += 300; sfx('coin'); fx(b.x, surf(b.i, b.x) + 1, 8, [2, 1.8, 0.4], 10, 0.5, 0.4) }
  // the captive
  const pr = KG.princess
  if (!p.done && p.fl === pr.i && Math.abs(p.x - pr.x) < 3) { p.done = true; const bonus = Math.max(0, Math.round(KG.timer)); p.score += bonus; KG.score += bonus; sfx('mgBig'); fx(pr.x, surf(pr.i, pr.x) + 3, 24, [2, 0.6, 1.4], 18, 1, 0.6) }
}
function smash(p) {
  const x0 = p.x, x1 = p.x + p.face * 3.4, lo = Math.min(x0, x1) - 0.6, hi = Math.max(x0, x1) + 0.6
  for (const b of KG.barrels) if (!b.dead && b.i === p.fl && b.x > lo && b.x < hi) { b.dead = true; p.score += 300; KG.score += 300; fx(b.x, surf(b.i, b.x) + 1, 14, [2, 1.2, 0.4], 16, 0.6, 0.5); sfx('crate') }
  for (const f of KG.fires) if (!f.dead && f.i === p.fl && f.x > lo && f.x < hi) { f.dead = true; p.score += 500; KG.score += 500; fx(f.x, surf(f.i, f.x) + 1, 14, [2.6, 1.4, 0.3], 16, 0.6, 0.5); sfx('rgKill') }
}
function throwBarrels(dt) {
  const L = L0()
  for (const k of KG.kongs) {
    k.t -= dt; k.wind = Math.max(0, k.wind - dt)
    const gap = L.throw * (1 + 0.5 * (KG.kongs.length - 1)) * (1 + 0.15 * (KG.players.length > 1 ? -1 : 0))
    if (k.t <= 0) { k.t = gap * (0.7 + KG.rnd() * 0.6); k.wind = 0.6; k.thr = 0.45 }
    if (k.thr > 0) { k.thr -= dt; if (k.thr <= 0) { KG.barrels.push({ id: KG.id++, x: k.x + rollDir(k.i) * 3, i: k.i, vx: rollDir(k.i), st: 'roll', dead: false, rot: 0, fall: 0, y: 0 }); sfx('rgSwing') } }
  }
  KG.fireT -= dt
  if (KG.fireT <= 0 && L.fires > 0) { KG.fireT = 16; if (KG.fires.filter((f) => !f.dead).length < L.fires + Math.floor(KG.size / 2)) { const x = KG.W / 2 - 4; KG.fires.push({ id: KG.id++, x, i: 0, dir: -1, dead: false, climb: null, t: 0 }) } }
}
function stepBarrels(dt) {
  const L = L0()
  for (const b of KG.barrels) {
    b.rot += dt * 6
    if (b.st === 'roll') {
      b.vx = rollDir(b.i)
      b.x += b.vx * L.speed * dt
      const g = gapOf(b.i)
      if ((b.i > 0 && ((b.vx > 0 && b.x > g[0]) || (b.vx < 0 && b.x < g[1]))) || (b.i === 0 && Math.abs(b.x) > KG.W / 2 - 1)) {
        if (b.i === 0) b.dead = true
        else { b.st = 'fall'; b.fy = surf(b.i, b.x) }
      }
      // sometimes a barrel takes a ladder down
      if (b.st === 'roll' && b.i > 0) for (const lad of KG.ladders) if (lad.i + 1 === b.i && !lad.broken && Math.abs(lad.x - b.x) < 0.4 && !b.skip && KG.rnd() < 0.08) { b.st = 'ladder'; b.lad = lad; b.x = lad.x }
      if (b.st === 'roll') b.skip = false
      b.y = surf(b.i, b.x)
    } else if (b.st === 'fall') {
      b.fy -= 26 * dt * (1 + b.fall); b.fall += dt * 2
      const s = surf(b.i - 1, b.x)
      if (b.fy <= s && hasFloor(b.i - 1, b.x)) { b.i--; b.st = 'roll'; b.fall = 0; b.skip = true }
      else if (b.fy < -10) b.dead = true
      b.y = b.fy
    } else if (b.st === 'ladder') {
      b.y -= 9 * dt
      if (b.y <= surf(b.lad.i, b.lad.x)) { b.i = b.lad.i; b.st = 'roll'; b.skip = true; b.y = surf(b.i, b.x) }
    }
    for (const p of KG.players) {
      if (b.dead || p.dead > 0 || p.out || p.gone || p.done) continue
      const dx = Math.abs(p.x - b.x)
      if (dx < 1.5 && p.y < b.y + 1.9 && p.y + 3 > b.y - 0.6 && !p.ladder) { if (p.ham > 0) { b.dead = true; p.score += 300; KG.score += 300; fx(b.x, b.y + 1, 10, [2, 1.2, 0.4], 14, 0.5, 0.4) } else hurt(p) }
      else if (dx < 1.3 && !p.ground && p.y > b.y + 1.9 && b.i === p.fl && !p.jumped.has(b.id)) { p.jumped.add(b.id); p.score += 100; KG.score += 100; sfx('coin') }
    }
  }
  KG.barrels = KG.barrels.filter((b) => !b.dead)
  for (const f of KG.fires) {
    f.t += dt
    if (f.climb) { f.cy += f.cdir * 3.5 * dt; const lo = surf(f.climb.i, f.climb.x), hi = surf(f.climb.i + 1, f.climb.x); if (f.cy >= hi) { f.i = f.climb.i + 1; f.climb = null } else if (f.cy <= lo) { f.i = f.climb.i; f.climb = null } continue }
    const tgt = KG.players.find((p) => !p.out && p.dead <= 0 && !p.gone)
    if (tgt) { const want = Math.sign(tgt.x - f.x) || 1; f.dir = Math.abs(tgt.x - f.x) > 1 ? (KG.rnd() < 0.02 ? -want : want) : f.dir }
    f.x = clamp(f.x + f.dir * 5 * dt, -KG.W / 2 + 2, KG.W / 2 - 2)
    if (!hasFloor(f.i, f.x)) f.x = clamp(f.x - f.dir * 5 * dt, -KG.W / 2 + 2, KG.W / 2 - 2)
    if (tgt && Math.abs(tgt.fl - f.i) >= 1) for (const lad of KG.ladders) if (!lad.broken && Math.abs(lad.x - f.x) < 0.8 && KG.rnd() < 0.02) { if (tgt.fl > f.i && lad.i === f.i) { f.climb = lad; f.cy = surf(lad.i, lad.x); f.cdir = 1; f.x = lad.x } else if (tgt.fl < f.i && lad.i + 1 === f.i) { f.climb = lad; f.cy = surf(f.i, lad.x); f.cdir = -1; f.x = lad.x } }
  }
  for (const f of KG.fires) { if (f.dead) continue; const fy = f.climb ? f.cy : surf(f.i, f.x); f.y = fy; for (const p of KG.players) if (p.dead <= 0 && !p.out && !p.gone && !p.done && Math.abs(p.x - f.x) < 1.4 && Math.abs(p.y - fy) < 2.6) { if (p.ham > 0) { f.dead = true; p.score += 500; KG.score += 500; fx(f.x, fy + 1, 12, [2.6, 1.4, 0.3], 14, 0.5, 0.4) } else hurt(p) } }
  KG.fires = KG.fires.filter((f) => !f.dead)
}
function update(dtRaw) {
  const dt = Math.min(dtRaw, 0.05)
  if (KG.mode === 'idle' || KG.paused) return
  stepParticles(dt)
  for (const q of KG.fx) { q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy -= 24 * dt }
  KG.fx = KG.fx.filter((q) => q.life > 0)
  if (KG.msg) { KG.msg.t -= dt; if (KG.msg.t <= 0) KG.msg = null }
  if (KG.mode === 'over') { emitTick(dt); return }
  const live = KG.players.filter((p) => !p.out && !p.gone)
  const ref = live.length ? live.reduce((a, p) => (p.i === KG.me ? p : a), live[0]) : KG.players[0]
  // the camera follows the local climber
  KG.camX += (clamp(ref.x, -KG.W / 2 + 30, KG.W / 2 - 30) - KG.camX) * Math.min(1, dt * 5)
  KG.camY += (ref.y + 5 - KG.camY) * Math.min(1, dt * 4)
  if (KG.net && KG.net.role === 'guest') { guestStep(dt); emitTick(dt); return }
  KG.t += dt
  readLocal()
  for (const p of KG.players) stepPlayer(p, dt)
  if (KG.clearT <= 0) { KG.timer = Math.max(0, KG.timer - 30 * dt); throwBarrels(dt); stepBarrels(dt) }
  if (KG.clearT <= 0 && KG.players.some((p) => p.done)) { KG.clearT = 3; KG.msg = { text: 'RESCUED!', sub: 'BONUS ' + Math.round(KG.timer), t: 3 }; sfx('win'); flash(0.3, [1, 1, 1]); profile.kongLevel = Math.max(profile.kongLevel || 0, KG.lvl + 1) }
  if (KG.clearT > 0) { KG.clearT -= dt; if (KG.clearT <= 0) { if (KG.lvl + 1 >= LEVELS.length) return finish(true); KG.lvl++; newLevel() } }
  else if (KG.players.every((p) => p.out || p.gone)) return finish(false)
  emitTick(dt)
}
function finish(win) {
  KG.mode = 'over'; music.stop()
  KG.over = { win, score: KG.score, level: KG.lvl + 1, size: KG.size, kind: KG.kind, players: KG.players.map((p) => ({ n: p.name, s: p.score })) }
  profile.kongGames = (profile.kongGames || 0) + 1; profile.kongBest = Math.max(profile.kongBest || 0, KG.score); profile.kongLevel = Math.max(profile.kongLevel || 0, win ? LEVELS.length : KG.lvl)
  recordScore('kong', KG.score); saveProfile(); sfx(win ? 'win' : 'over')
  if (KG.net && KG.net.role === 'host') KG.net.send({ k: 'end', over: KG.over })
  emitK()
}
// ---------- input ----------
const TK = {}
function readLocal() {
  const dn = (...c) => c.some((k) => keys[k])
  const p0 = KG.players[KG.net ? KG.me : 0]; if (!p0) return
  const two = KG.kind === 'two', I = p0.in
  I.dx = (dn('KeyD', two ? 'KeyD' : 'ArrowRight') || TK.right ? 1 : 0) - (dn('KeyA', two ? 'KeyA' : 'ArrowLeft') || TK.left ? 1 : 0)
  I.dy = (dn('KeyW', two ? 'KeyW' : 'ArrowUp') || TK.up ? 1 : 0) - (dn('KeyS', two ? 'KeyS' : 'ArrowDown') || TK.down ? 1 : 0)
  I.jump = dn('Space', 'KeyZ') || !!TK.jump
  I.hit = dn('KeyJ', 'KeyF', 'KeyK') || !!TK.hit
  if (two && KG.players[1]) { const q = KG.players[1].in; q.dx = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0); q.dy = (keys.ArrowUp ? 1 : 0) - (keys.ArrowDown ? 1 : 0); q.jump = !!(keys.Enter || keys.ShiftRight); q.hit = !!(keys.Comma || keys.Slash) }
}
function onKey(code) {
  if (KG.mode === 'idle') return
  if (code === 'Escape' || code === 'KeyP') { if (KG.mode === 'play' && !KG.net) { KG.paused = !KG.paused; emitK() } return }
  if (KG.mode === 'over' && code === 'Enter') return kongActions.rematch()
}
export const kongActions = {
  start, stop, quit() { toMenu() }, resume() { KG.paused = false; emitK() }, pause() { if (KG.mode === 'play' && !KG.paused && !KG.net) { KG.paused = true; emitK(); return true } return false },
  rematch() { if (KG.net) { if (KG.net.role === 'host') KG.net.restart(); else KG.net.sendHost({ k: 'rematch' }); return } start({ level: 0, two: KG.kind === 'two', size: KG.size }) },
  press(n, on) { TK[n] = on }, setSize(k) { profile.kongSize = k; saveProfile() },
}
// ---------- online ----------
const r2 = (v) => Math.round(v * 100) / 100
function sendSnap(dt) {
  KG.netT -= dt; if (KG.netT > 0) return; KG.netT = 0.066
  KG.net.send({ k: 'st', lvl: KG.lvl, t: r2(KG.t), tm: Math.round(KG.timer), sc: KG.score, clr: KG.clearT > 0 ? 1 : 0,
    p: KG.players.map((p) => [r2(p.x), r2(p.y), p.fl, p.face, p.ground ? 1 : 0, p.lives, p.score, p.dead > 0 ? 1 : 0, p.out ? 1 : 0, p.ham > 0 ? 1 : 0, p.ladder ? p.ladder.id : 0, p.done ? 1 : 0, p.inv > 0 ? 1 : 0, p.hit > 0 ? 1 : 0]),
    b: KG.barrels.map((b) => [b.id, r2(b.x), b.i, b.st === 'roll' ? 0 : b.st === 'fall' ? 1 : 2, r2(b.y), r2(b.rot)]), f: KG.fires.map((f) => [f.id, r2(f.x), f.i, f.climb ? 1 : 0, r2(f.y || 0), f.dir]),
    kg: KG.kongs.map((k) => [k.id, r2(k.wind)]), h: KG.hammers.map((h) => (h.got ? 1 : 0)).join(''), bo: KG.bonus.map((b) => (b.got ? 1 : 0)).join(''), msg: KG.msg })
}
function applySnap(d) {
  if (d.lvl !== KG.lvl) { KG.lvl = d.lvl; build(KG.lvl, KG.size, KG.seed); KG.id = 5000 }
  KG.t = d.t; KG.timer = d.tm; KG.score = d.sc; KG.clearT = d.clr ? 1 : 0
  d.p.forEach((a, i) => { const p = KG.players[i]; if (!p) return; const mine = i === KG.me; if (!mine || Math.hypot(p.x - a[0], p.y - a[1]) > 6 || a[7]) { p.x = a[0]; p.y = a[1] } else { p.x += (a[0] - p.x) * 0.2; p.y += (a[1] - p.y) * 0.2 }; Object.assign(p, { fl: a[2], face: a[3], ground: !!a[4], lives: a[5], score: a[6], dead: a[7] ? 1 : 0, out: !!a[8], ham: a[9] ? 5 : 0, ladder: a[10] ? KG.ladders.find((l) => l.id === a[10]) || { id: a[10] } : null, done: !!a[11], inv: a[12] ? 1 : 0, hit: a[13] ? 0.2 : 0 }) })
  KG.barrels = d.b.map((a) => ({ id: a[0], x: a[1], i: a[2], st: a[3] === 0 ? 'roll' : a[3] === 1 ? 'fall' : 'ladder', y: a[4], rot: a[5] }))
  KG.fires = d.f.map((a) => ({ id: a[0], x: a[1], i: a[2], climb: a[3] ? {} : null, y: a[4], dir: a[5], t: 0 }))
  d.kg.forEach((a, i) => { if (KG.kongs[i]) KG.kongs[i].wind = a[1] })
  KG.hammers.forEach((h, i) => { h.got = d.h[i] === '1' }); KG.bonus.forEach((b, i) => { b.got = d.bo[i] === '1' })
  if (d.msg && (!KG.msg || KG.msg.text !== d.msg.text)) KG.msg = d.msg
}
let inT = 0
function guestStep(dt) {
  const me = KG.players[KG.me]; readLocal()
  if (me && me.dead <= 0 && !me.out && !me.ladder) { me.x = clamp(me.x + me.in.dx * 12 * dt, -KG.W / 2 + 1.5, KG.W / 2 - 1.5); if (me.in.dx) me.face = Math.sign(me.in.dx); if (me.ground && hasFloor(me.fl, me.x)) me.y = surf(me.fl, me.x) }
  for (const p of KG.players) { p.anim += dt; p.hit = Math.max(0, p.hit - dt) }
  for (const b of KG.barrels) b.rot += dt * 6
  inT -= dt
  if (inT <= 0 && me) { inT = 0.05; const I = me.in; KG.net.sendHost({ k: 'in', dx: I.dx, dy: I.dy, j: I.jump ? 1 : 0, h: I.hit ? 1 : 0 }) }
}
function emitTick(dt) { if (KG.net && KG.net.role === 'host' && KG.mode === 'play') sendSnap(dt); KG.emitT -= dt; if (KG.emitT <= 0) { KG.emitT = 0.1; emitK() } }
function emitK() {
  const me = KG.players[KG.me] || KG.players[0]
  snap = { mode: KG.mode, paused: KG.paused, kind: KG.kind, lvl: KG.lvl + 1, lvls: LEVELS.length, name: L0().name, size: KG.size, width: KG.W, score: KG.score, timer: Math.round(KG.timer), floor: me ? me.fl + 1 : 1, floors: KG.floors, msg: KG.msg, over: KG.over, online: !!KG.net, me: KG.me, time: KG.t,
    players: KG.players.map((p, i) => ({ n: p.name, lives: p.lives, score: p.score, dead: p.out, c: p.color, me: i === KG.me, ham: p.ham > 0 })),
    mini: KG.players.length ? { w: KG.W, f: KG.floors, p: KG.players.map((p) => [(p.x + KG.W / 2) / KG.W, p.y / (KG.floors * FH), p.i === KG.me ? 1 : 0]), b: KG.barrels.slice(0, 80).map((b) => [(b.x + KG.W / 2) / KG.W, (b.y || 0) / (KG.floors * FH)]), pr: KG.princess ? [(KG.princess.x + KG.W / 2) / KG.W, 1] : null, l: KG.ladders.filter((l) => !l.broken).map((l) => [(l.x + KG.W / 2) / KG.W, (l.i + 0.5) / KG.floors]) } : null }
  subs.forEach((f) => f())
}
registerNet('kong', {
  min: 1,
  begin(ctx) { start({ seed: ctx.seed, level: 0, size: ctx.opts.size | 0, net: { role: ctx.role, players: ctx.players, me: ctx.me, send: (d) => ctx.send(d), sendHost: (d) => ctx.sendHost(d), restart: () => ctx.restart() } }) },
  active: () => !!KG.net && KG.mode !== 'idle',
  onMsg(d, from) {
    if (!d || !KG.net) return
    if (KG.net.role === 'host') {
      const i = KG.net.players.findIndex((p) => p.id === from), p = KG.players[i]; if (!p) return
      if (d.k === 'in') { p.in.dx = clamp(+d.dx || 0, -1, 1); p.in.dy = clamp(+d.dy || 0, -1, 1); p.in.jump = !!d.j; p.in.hit = !!d.h }
      else if (d.k === 'rematch' && KG.mode === 'over') KG.net.restart()
    } else if (d.k === 'st') applySnap(d)
    else if (d.k === 'end') { KG.mode = 'over'; KG.over = d.over; music.stop(); sfx(d.over.win ? 'win' : 'over'); profile.kongGames = (profile.kongGames || 0) + 1; profile.kongBest = Math.max(profile.kongBest || 0, d.over.score); saveProfile(); emitK() }
  },
  onLeave(cid) { if (!KG.net) return; const i = KG.net.players.findIndex((p) => p.id === cid); if (KG.net.role === 'host' && KG.players[i]) { KG.players[i].gone = true; KG.players[i].out = true } else if (KG.net.role === 'guest' && KG.mode === 'play' && cid === null) finish(false) },
})
// ---------- drawing ----------
function lights() { return { sun: { x: KG.camX - 30, y: KG.camY + 50, z: 40, color: '#ffe2b0', intensity: 0.9 }, ambient: 0.62, dir: 0.1, shadow: false, lantern: { x: KG.camX, y: KG.camY + 4, z: 18, color: '#ffcf8a', intensity: 2.1, distance: 120 } } }
function camera(aspect) { const sk = (G.shake || 0) * 0.5; return { x: KG.camX + (Math.random() - 0.5) * sk, y: KG.camY + 8, z: 78, tx: KG.camX, ty: KG.camY, tz: 0, fov: 42, far: 600, aspect } }
function drawHero(api, p, t) {
  const { put3 } = api
  if (p.out || p.gone) return
  if ((p.inv > 0 && Math.floor(t * 12) % 2 === 0) || (p.dead > 0 && Math.floor(t * 20) % 3 === 0)) return
  const f = p.face, run = Math.abs(p.in.dx) > 0 && p.ground ? Math.sin(p.anim * 16) : 0, x = p.x, y = p.y
  const red = p.color === '#ff6ab8' ? [1.8, 0.5, 1] : [2, 0.3, 0.25], blue = [0.3, 0.5, 1.6], skin = [1.8, 1.4, 1.1]
  const b = (lx, ly, lz, sx, sy, sz, c, rz = 0) => put3(x + lx * f, y + ly, lz, sx, sy, sz, rz * f, c[0], c[1], c[2], 0)
  if (p.ladder) { const sw = Math.sin(p.y * 2.4) * 0.4; b(-0.3, 0.7 + sw, 0.3, 0.5, 1.2, 0.6, blue); b(0.3, 0.7 - sw, -0.3, 0.5, 1.2, 0.6, blue); b(0, 1.9, 0, 1.4, 1.6, 1, blue); b(0, 3, 0, 1.1, 1, 1.1, skin); b(0, 3.5, 0, 1.4, 0.5, 1.2, red); b(0.5 - sw, 2.6, 0.7, 0.4, 1.6, 0.4, red); return }
  b(-0.3 + run * 0.35, 0.6, 0.3, 0.6, 1.2, 0.7, blue); b(0.3 - run * 0.35, 0.6, -0.3, 0.6, 1.2, 0.7, blue)
  b(0, 1.9, 0, 1.4, 1.5, 1, blue); b(0, 2.2, 0.55, 1.1, 0.8, 0.2, red); b(0, 3.1, 0, 1.1, 1, 1.1, skin); b(0, 3.65, 0, 1.4, 0.45, 1.3, red); b(0.55, 3.6, 0, 0.7, 0.3, 1.1, red); b(0.4, 3.1, 0.6, 0.25, 0.25, 0.2, [0.1, 0.1, 0.1])
  if (p.ham > 0) { const sw = Math.sin(p.anim * 16) * 0.9; b(1, 2.4, 0.7, 0.4, 2, 0.4, [0.5, 0.35, 0.2], sw); b(1 + Math.sin(sw) * 1.5, 3.2 + Math.cos(sw) * 0.8, 0.7, 1.5, 1.2, 1.2, [1.6, 1.6, 1.8]) }
  else b(0.8, 2.2 + (p.ground ? 0 : 0.5), 0.6, 0.4, 1.3, 0.4, red, p.ground ? 0 : -0.8)
}
function drawKong(api, k, t) {
  const { put3 } = api, y = surf(k.i, k.x), d = rollDir(k.i), w = k.wind > 0 ? Math.sin((0.6 - k.wind) / 0.6 * Math.PI) : 0
  const body = [0.55, 0.35, 0.22], face = [1.5, 1.1, 0.8]
  put3(k.x, y + 4, 0, 6, 6, 4.4, 0, body[0], body[1], body[2], 0); put3(k.x, y + 7.8, 0.6, 3.6, 3, 3, 0, body[0], body[1], body[2], 0); put3(k.x + d * 0.7, y + 7.6, 2.2, 2.4, 1.8, 0.4, 0, face[0], face[1], face[2], 0)
  put3(k.x + d * 0.6, y + 8.3, 2.5, 0.5, 0.5, 0.3, 0, 2.6, 2.6, 2.6, 0); put3(k.x - d * 0.6, y + 8.3, 2.5, 0.5, 0.5, 0.3, 0, 2.6, 2.6, 2.6, 0)
  put3(k.x, y + 4.8, 2.2, 4, 2.4, 0.4, 0, face[0], face[1], face[2], 0)
  put3(k.x - d * 3.6, y + 3.4 + Math.sin(t * 3) * 0.4, 0, 1.6, 4.2, 1.8, 0, body[0], body[1], body[2], 0); put3(k.x + d * 3.6, y + 4.6 + w * 3, 0, 1.6, 3.4, 1.8, 0, body[0], body[1], body[2], 0)
  put3(k.x - 1.4, y + 0.9, 0, 2, 1.8, 2.4, 0, body[0], body[1], body[2], 0); put3(k.x + 1.4, y + 0.9, 0, 2, 1.8, 2.4, 0, body[0], body[1], body[2], 0)
  if (k.wind > 0) put3(k.x + d * 4.2, y + 8.4 + w * 2, 0, 1.8, 1.8, 1.8, 0, 1.4, 0.8, 0.3, t * 2)
}
function draw3(api) {
  const { put3, putS } = api, t = G.time
  const cx = KG.camX, cy = KG.camY, lo = cy - 30, hi = cy + 34
  // the night city behind the site
  for (let k = -8; k <= 8; k++) { const x = Math.floor(cx / 30) * 30 + k * 30, h = 40 + ((Math.abs(Math.floor(x / 30)) * 37) % 60), yb = cy * 0.7 - 10; put3(x, yb + h / 2, -70 - (Math.abs(k) % 3) * 10, 22, h, 18, 0, 0.12, 0.14, 0.3, 0); for (let w = 0; w < h; w += 7) if (((w + Math.floor(x)) * 7) % 3) put3(x, yb + w + 4, -60.5 - (Math.abs(k) % 3) * 10, 16, 1.4, 0.4, 0, 1.8, 1.5, 0.5, 0) }
  // girders
  const x0 = Math.floor((cx - 80) / 4) * 4, x1 = cx + 80
  for (let i = 0; i < KG.floors; i++) {
    if (base(i) < lo - 8 || base(i) > hi + 8) continue
    for (let x = x0; x <= x1; x += 4) {
      if (Math.abs(x) > KG.W / 2 || !hasFloor(i, x)) continue
      const y = surf(i, x), n = ((x / 4) | 0) & 1
      put3(x, y - 0.7, 0, 4.1, 1.4, 5, Math.atan2(-rollDir(i) * AMP / KG.W * 4, 4), 1.6 - n * 0.2, 0.35, 0.28 - n * 0.04, 0)
      put3(x, y - 1.5, 0, 4.1, 0.5, 4.2, 0, 0.35, 0.1, 0.1, 0)
      if (n) put3(x, y + 0.05, 2.4, 0.5, 0.5, 0.3, 0, 2, 1.6, 0.5, 0)
    }
    if (i === 0) { const ox = KG.W / 2 - 6, oy = surf(0, ox); put3(ox, oy + 2, 0, 3.6, 4, 3.6, 0, 0.3, 0.4, 1.4, 0); put3(ox, oy + 4.3, 0, 3.2, 0.6, 3.2, 0, 0.1, 0.1, 0.15, 0); put3(ox, oy + 5.4 + Math.sin(t * 9) * 0.3, 0, 1.6, 1.8, 1.6, 0, 2.8, 1.3 + Math.sin(t * 12) * 0.4, 0.2, t) }
  }
  for (const l of KG.ladders) {
    if (Math.abs(l.x - cx) > 90) continue
    const a = surf(l.i, l.x), b = surf(l.i + 1, l.x)
    put3(l.x - 0.9, (a + b) / 2, 0, 0.3, b - a, 0.5, 0, l.broken ? 0.5 : 1.2, l.broken ? 0.4 : 1.4, l.broken ? 0.5 : 1.8, 0); put3(l.x + 0.9, (a + b) / 2, 0, 0.3, b - a, 0.5, 0, l.broken ? 0.5 : 1.2, l.broken ? 0.4 : 1.4, l.broken ? 0.5 : 1.8, 0)
    for (let y = a + 1; y < b - 0.5; y += 1.3) { if (l.broken && y > a + (b - a) * 0.45 && y < a + (b - a) * 0.7) continue; put3(l.x, y, 0, 1.8, 0.22, 0.4, 0, l.broken ? 0.5 : 1.2, l.broken ? 0.4 : 1.4, l.broken ? 0.5 : 1.8, 0) }
  }
  for (const k of KG.kongs) if (Math.abs(k.x - cx) < 100) drawKong(api, k, t)
  const pr = KG.princess
  if (pr && Math.abs(pr.x - cx) < 100) { const y = surf(pr.i, pr.x); put3(pr.x, y + 2, 0, 2, 2.6, 1.4, 0, 2, 0.6, 1.4, 0); put3(pr.x, y + 3.8, 0, 1.3, 1.2, 1.2, 0, 1.8, 1.4, 1.1, 0); put3(pr.x, y + 4.6, 0, 1.6, 0.8, 1.4, 0, 2, 1.7, 0.4, 0); put3(pr.x + Math.sin(t * 5) * 0.5, y + 6.2, 0, 0.5, 0.5, 0.5, 0, 2.6, 0.4, 0.4, t) }
  for (const h of KG.hammers) if (!h.got && Math.abs(h.x - cx) < 100) { const y = surf(h.i, h.x) + 1.2 + Math.sin(t * 4 + h.x) * 0.3; put3(h.x, y, 0, 0.5, 2.2, 0.5, 0.5, 0.5, 0.35, 0.2, 0); put3(h.x - 0.5, y + 1.1, 0, 1.8, 1.2, 1.2, 0.5, 1.7, 1.7, 1.9, 0) }
  for (const b of KG.bonus) if (!b.got && Math.abs(b.x - cx) < 100) { const y = surf(b.i, b.x) + 1.3 + Math.sin(t * 4 + b.x) * 0.2, c = [[2, 0.5, 1.4], [2, 1.7, 0.3], [0.6, 1.8, 2], [0.7, 2, 0.6]][b.t]; put3(b.x, y, 0.3, 1.5, 1.1, 1.1, 0, c[0], c[1], c[2], t); put3(b.x, y + 0.9, 0.3, 0.5, 0.5, 0.5, 0, 2.4, 2.4, 2.4, 0) }
  for (const b of KG.barrels) { if (Math.abs(b.x - cx) > 100) continue; const y = (b.y || 0) + 1.1; put3(b.x, y, 0, 2.2, 2.2, 2.6, b.rot, 1.1, 0.55, 0.22, 0); put3(b.x, y, 1.4, 2.3, 2.3, 0.3, b.rot, 0.3, 0.3, 0.35, 0); put3(b.x, y, 0, 0.3, 2.3, 2.7, b.rot, 0.3, 0.3, 0.35, 0) }
  for (const f of KG.fires) { if (Math.abs(f.x - cx) > 100) continue; const y = (f.y || 0) + 1; put3(f.x, y + 0.5, 0, 1.8, 1.6, 1.6, 0, 2.6, 0.9, 0.2, 0); put3(f.x, y + 1.7 + Math.sin(t * 14 + f.id) * 0.3, 0, 1.2, 1.4, 1.2, 0, 2.8, 1.8, 0.3, t * 3); put3(f.x + f.dir * 0.4, y + 0.9, 0.9, 0.35, 0.35, 0.2, 0, 2.8, 2.8, 2.8, 0) }
  for (const p of KG.players) drawHero(api, p, t)
  for (const q of KG.fx) { const f = q.life / q.max, s = q.s * (0.3 + 0.7 * f); putS(q.x, q.y, 1.5, s, s, s, q.c[0], q.c[1], q.c[2]) }
}
if (typeof window !== 'undefined') { window.__KG = KG; window.__kong = kongActions }
games.kong = { update, onKey, draw() {}, draw3, camera, lights, stop, sky: () => '#070a1c' }
