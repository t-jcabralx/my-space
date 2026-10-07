// FROST CLIMBERS: a 3D mountain-climbing platformer in the spirit of the classic ice-climbing arcade game.
// Jump up into the ice above you to smash a hole, climb through it, whack the yetis and birds with your hammer, dodge icicles,
// and reach the summit before you fall off the bottom of the screen. 1 or 2 climbers (same keyboard, or a friend online).
import { G, emit as engineEmit, keys, games, profile, saveProfile, recordScore, toMenu, shake, flash, stepParticles } from './engine.js'
import { sfx, music } from './audio.js'
import { clamp, rng } from './pxl.js'
import { registerNet, gameEnded } from './online/gnet.js'
import { pickWeather, timeOf, skyFor, weatherFx } from './env4d.js'

export const COLS = 30, BW = 2, FH = 6, THICK = 1.2, HALF = COLS * BW / 2
export const MOUNTAINS = [
  { name: 'LITTLE FROST', floors: 7, topi: 5.5, bird: 0, ice: 0, sky: '#8fc4ff' },
  { name: 'SNOWBELL RIDGE', floors: 8, topi: 5, bird: 14, ice: 0, sky: '#9fd0ff' },
  { name: 'GLACIER STEPS', floors: 9, topi: 4.5, bird: 12, ice: 6, sky: '#7fb0e8' },
  { name: 'WHITE FANG', floors: 10, topi: 4.2, bird: 10, ice: 5, sky: '#a0c0f0' },
  { name: 'BLIZZARD HORN', floors: 11, topi: 3.8, bird: 9, ice: 4.2, sky: '#8aa0c8' },
  { name: 'CRYSTAL SPIRE', floors: 12, topi: 3.5, bird: 8, ice: 3.6, sky: '#7a90d8' },
  { name: 'AURORA PEAK', floors: 13, topi: 3.2, bird: 7, ice: 3.2, sky: '#5a6ac0' },
  { name: 'THE LAST SUMMIT', floors: 14, topi: 3, bird: 6, ice: 2.8, sky: '#4a58a8' },
]
const veggies = ['🥕', '🌽', '🍆', '🥦']

export const CL = { mode: 'idle', paused: false, lvl: 0, seed: 1, t: 0, floors: [], clouds: [], players: [], foes: [], icicles: [], veg: [], fx: [], camTop: 14, topY: 0, score: 0, over: null, msg: null, id: 1, kind: 'solo', net: null, emitT: 0, clearT: 0, spawnT: 4, birdT: 8, iceT: 6, rnd: null, me: 0, netT: 0, weather: 'clear', tod0: 0.4 }
let snap = null
const subs = new Set()
export const subscribeClimb = (f) => { subs.add(f); return () => subs.delete(f) }
export const getClimbSnap = () => snap
const fx = (x, y, n, c, sp = 10, life = 0.5, s = 0.4) => { for (let i = 0; i < n && CL.fx.length < 260; i++) { const a = Math.random() * 6.283, v = Math.random() * sp; CL.fx.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.8 + 4, life, max: life, c, s: s * (0.6 + Math.random() * 0.8) }) } }
const floorY = (i) => i * FH
export const colX = (c) => -HALF + BW / 2 + c * BW
const colAt = (x) => clamp(Math.floor((x + HALF) / BW), 0, COLS - 1)

// ---------- a mountain ----------
function build(li, seed) {
  const M = MOUNTAINS[Math.min(li, MOUNTAINS.length - 1)], r = rng(seed * 131 + li * 7)
  CL.floors = []; CL.clouds = []; CL.veg = []
  for (let i = 0; i <= M.floors; i++) {
    const row = new Array(COLS).fill(0)
    if (i === 0) row.fill(2)
    else {
      const cloudy = i >= Math.ceil(M.floors * 0.62) && i < M.floors
      if (cloudy) {
        // high up the floors are drifting clouds you must time your jumps onto
        for (let k = 0; k < 3; k++) CL.clouds.push({ id: CL.id++, floor: i, x: -20 + k * 20 + r() * 6, w: 7, dir: r() < 0.5 ? -1 : 1, sp: 4 + r() * 3 + li * 0.4 })
        for (let c = 0; c < 2; c++) { row[c] = 2; row[COLS - 1 - c] = 2 }
      } else if (i === M.floors) { for (let c = 0; c < COLS; c++) row[c] = (c < 2 || c >= COLS - 2) ? 2 : 1 } // the summit ledge: ice you smash through to stand on top
      else {
        for (let c = 0; c < COLS; c++) row[c] = 1
        for (let c = 0; c < 2; c++) { row[c] = 2; row[COLS - 1 - c] = 2 }
        // a few rock blocks that cannot be broken: go around them
        const rocks = Math.min(1 + Math.floor(i / 2) + li, 8)
        for (let k = 0; k < rocks; k++) { const c = 3 + ((r() * (COLS - 6)) | 0); row[c] = 2; if (r() < 0.5) row[c + 1] = 2 }
        // and one ready-made gap on the first few floors so beginners can find their feet
        if (i <= 2 && li === 0) { const c = 6 + ((r() * 18) | 0); row[c] = 0 }
        if (r() < 0.8) { const vc = 4 + ((r() * 22) | 0); CL.veg.push({ id: CL.id++, x: colX(vc), y: floorY(i) + 1.2, t: (r() * 4) | 0, got: false }) }
      }
    }
    CL.floors.push(row)
  }
  CL.topY = floorY(M.floors)
}
function mkPlayer(i, name) {
  return { i, name, x: -4 + i * 8, y: 0, vx: 0, vy: 0, face: 1, ground: true, lives: 3, score: 0, dead: 0, inv: 2, swing: 0, hurt: 0, anim: 0, in: { dx: 0, jump: false, hit: false }, jumpHeld: false, hitHeld: false, done: false, best: 0, gone: false, color: i ? '#ff6ab8' : '#3d9bff' }
}
function start(o = {}) {
  CL.kind = o.net ? 'coop' : o.two ? 'two' : 'solo'
  CL.lvl = clamp(o.level | 0, 0, MOUNTAINS.length - 1); CL.seed = o.seed || ((Math.random() * 1e9) | 0)
  CL.rnd = rng(CL.seed + 99)
  CL.id = 1; CL.t = 0; CL.score = 0; CL.over = null; CL.msg = null; CL.paused = false; CL.net = o.net || null; CL.me = o.net ? o.net.me : 0
  CL.weather = pickWeather(CL.seed, { clear: 0.45, snow: 0.35, fog: 0.2 }); CL.tod0 = 0.3 + (CL.seed % 100) / 100 * 0.35
  const n = o.net ? o.net.players.length : o.two ? 2 : 1
  CL.players = Array.from({ length: n }, (_, i) => mkPlayer(i, o.net ? o.net.players[i].name : i ? 'PLAYER 2' : (profile.name || 'PLAYER 1')))
  newLevel(true)
  G.mode = 'climb'; engineEmit(); G.parts = []; G.pops = []; CL.mode = 'play'
  music.set('bomber', 0); sfx('mission'); emitC()
}
function newLevel(first) {
  const M = MOUNTAINS[CL.lvl]
  build(CL.lvl, CL.seed)
  CL.foes = []; CL.icicles = []; CL.fx = []; CL.camTop = 14; CL.clearT = 0; CL.spawnT = 5; CL.birdT = M.bird ? 10 : 1e9; CL.iceT = M.ice ? 8 : 1e9; CL.lvlT = 0; CL.got = 0
  CL.players.forEach((p, i) => { p.x = -4 + i * 8; p.y = 0; p.vx = p.vy = 0; p.ground = true; p.dead = 0; p.inv = 2; p.done = false; p.best = 0; if (p.lives <= 0) p.lives = 1 })
  CL.msg = { text: 'MOUNTAIN ' + (CL.lvl + 1), sub: M.name + ' · ' + M.floors + ' FLOORS', t: 3 }
  void first
}
function stop() { if (CL.net) { gameEnded('climb'); CL.net = null } CL.mode = 'idle'; CL.paused = false; music.set('menu'); emitC() }

// ---------- physics ----------
const solidAt = (fi, x) => { const row = CL.floors[fi]; if (!row) return 0; return row[colAt(x)] }
function cloudAt(fi, x, w = 0.7) { for (const c of CL.clouds) if (c.floor === fi && x + w > c.x - c.w / 2 && x - w < c.x + c.w / 2) return c; return null }
function landingFloor(prevFeet, feet, x) {
  // the highest floor top the feet fell through this step
  for (let fi = CL.floors.length - 1; fi >= 0; fi--) {
    const top = floorY(fi)
    if (prevFeet >= top - 0.05 && feet <= top + 0.0) {
      const l = solidAt(fi, x - 0.55), r = solidAt(fi, x + 0.55), c = cloudAt(fi, x)
      if (l || r || c) return { fi, top, cloud: c }
    }
  }
  return null
}
function hurt(p, why) {
  if (p.dead > 0 || p.inv > 0 || p.done) return
  p.lives--; p.dead = 1.6; p.hurt = 0.6; p.vx = 0; p.vy = 18
  fx(p.x, p.y + 1.5, 14, [1.6, 0.4, 0.3], 14, 0.6, 0.5)
  if (!CL.net || p.i === CL.me) { sfx('rgHurt'); shake(0.5) }
  void why
}
function stepPlayer(p, dt) {
  const I = p.in
  p.anim += dt; p.inv = Math.max(0, p.inv - dt); p.hurt = Math.max(0, p.hurt - dt); p.swing = Math.max(0, p.swing - dt)
  if (p.gone) return
  if (p.dead > 0) {
    p.dead -= dt; p.y += p.vy * dt; p.vy -= 60 * dt
    if (p.dead <= 0) {
      if (p.lives <= 0) { p.out = true; return }
      // come back on the highest floor you reached that has solid ground at its middle
      let fi = Math.min(CL.floors.length - 1, Math.floor(p.best / FH))
      while (fi > 0 && !CL.floors[fi].some((c, ci) => c && Math.abs(colX(ci)) < 8)) fi--
      const camMin = CL.camTop - 26; while (fi < CL.floors.length - 1 && floorY(fi) < camMin) fi++
      const mate = CL.players.find((q) => q !== p && !q.out && q.dead <= 0 && !q.gone)
      p.x = mate ? mate.x + 2 : 0; p.y = mate ? mate.y + 0.2 : floorY(fi) + 0.1; p.vx = 0; p.vy = 0; p.inv = 2.2; p.ground = false
    }
    return
  }
  if (p.out) return
  // run: slippery ice, quick to start, slow to stop
  const tgt = I.dx * 13, acc = I.dx ? 70 : (p.ground ? 12 : 4)
  p.vx += clamp(tgt - p.vx, -acc * dt, acc * dt)
  if (I.dx) p.face = Math.sign(I.dx)
  p.x = clamp(p.x + p.vx * dt, -HALF + 2.6, HALF - 2.6)
  // jump (on press) and hammer
  if (I.jump && !p.jumpHeld && p.ground) { p.vy = 34; p.ground = false; if (!CL.net || p.i === CL.me) sfx('jump') }
  p.jumpHeld = !!I.jump
  if (I.hit && !p.hitHeld && p.swing <= 0) { p.swing = 0.3; sfx('rgSwing'); hammer(p) }
  p.hitHeld = !!I.hit
  // vertical
  const prevFeet = p.y, prevHead = p.y + 3
  p.vy -= 78 * dt; p.vy = Math.max(p.vy, -46)
  p.y += p.vy * dt
  if (p.vy > 0) {
    // the head meets the floor above: ice breaks, rock does not
    for (let fi = 1; fi < CL.floors.length; fi++) {
      const bot = floorY(fi) - THICK
      if (prevHead <= bot + 0.05 && p.y + 3 > bot) {
        let hit = -1, bd = 9
        for (let c = colAt(p.x - 0.6); c <= colAt(p.x + 0.6); c++) { const t = CL.floors[fi][c]; if (!t) continue; const d = Math.abs(colX(c) - p.x); if (d < bd) { bd = d; hit = c } }
        if (hit >= 0) {
          p.y = bot - 3 - 0.01
          if (CL.floors[fi][hit] === 1) { CL.floors[fi][hit] = 0; p.score += 10; CL.score += 10; fx(colX(hit), bot, 10, [0.6, 1.6, 2.2], 14, 0.6, 0.4); sfx('crate'); p.vy = -4 } else { p.vy = 0; sfx('hkWall') }
          break
        }
      }
    }
  } else {
    const L = landingFloor(prevFeet, p.y, p.x)
    if (L) { if (!p.ground && prevFeet - p.y > 0 && p.vy < -22 && (!CL.net || p.i === CL.me)) sfx('land'); p.y = L.top; p.vy = 0; p.ground = true; if (L.cloud) p.x += L.cloud.dir * L.cloud.sp * dt } else p.ground = false
  }
  // standing on a block that vanished (a yeti or a friend broke it): you fall
  if (p.ground) { const fi = Math.round(p.y / FH); if (Math.abs(p.y - floorY(fi)) < 0.2 && !(solidAt(fi, p.x - 0.55) || solidAt(fi, p.x + 0.55) || cloudAt(fi, p.x))) p.ground = false }
  p.best = Math.max(p.best, p.y)
  if (p.y > CL.topY - 0.2 && !p.done) { p.done = true; p.score += 1000; CL.score += 1000; sfx('mgBig'); fx(p.x, p.y + 2, 20, [2, 1.8, 0.4], 18, 0.8, 0.6) }
  // fell off the bottom of the screen
  if (p.y < CL.camTop - 34 && p.dead <= 0) hurt(p, 'fall')
}
function hammer(p) {
  const x0 = p.x, x1 = p.x + p.face * 3.6, lo = Math.min(x0, x1) - 0.4, hi = Math.max(x0, x1) + 0.4
  for (const f of CL.foes) if (!f.dead && f.x > lo && f.x < hi && Math.abs(f.y - p.y) < 3.6) { f.dead = true; const pts = f.type === 'bird' ? 400 : 800; p.score += pts; CL.score += pts; fx(f.x, f.y + 1, 14, [2, 2, 2.4], 16, 0.7, 0.5); sfx('rgKill') }
  for (const ic of CL.icicles) if (!ic.dead && ic.x > lo && ic.x < hi && Math.abs(ic.y - p.y - 2) < 3) { ic.dead = true; p.score += 50; CL.score += 50; fx(ic.x, ic.y, 8, [1, 1.8, 2.4], 12, 0.5, 0.35) }
}
function foeFloor(f) { return Math.round(f.y / FH) }
function spawnFoes(dt) {
  const M = MOUNTAINS[CL.lvl]
  CL.spawnT -= dt
  if (CL.spawnT <= 0) {
    CL.spawnT = M.topi * (0.7 + CL.rnd() * 0.6) / (1 + 0.3 * (CL.players.length - 1))
    const lo = Math.max(1, Math.floor((CL.camTop - 26) / FH)), hi = Math.min(CL.floors.length - 2, Math.floor((CL.camTop + 4) / FH))
    if (hi >= lo) { const fi = lo + ((CL.rnd() * (hi - lo + 1)) | 0); if (!CL.clouds.some((c) => c.floor === fi) && fi > 0) { const side = CL.rnd() < 0.5 ? -1 : 1; CL.foes.push({ id: CL.id++, type: 'topi', x: side * (HALF - 4), y: floorY(fi), dir: -side, st: 'walk', t: 0, dead: false, fi }) } }
  }
  CL.birdT -= dt
  if (CL.birdT <= 0) { CL.birdT = M.bird * (0.7 + CL.rnd() * 0.6); const side = CL.rnd() < 0.5 ? -1 : 1; CL.foes.push({ id: CL.id++, type: 'bird', x: side * (HALF + 2), y: CL.camTop - 6 - CL.rnd() * 14, dir: -side, st: 'fly', t: 0, dead: false, base: 0 }) ; CL.foes[CL.foes.length - 1].base = CL.foes[CL.foes.length - 1].y }
  CL.iceT -= dt
  if (CL.iceT <= 0) {
    CL.iceT = M.ice * (0.6 + CL.rnd() * 0.8)
    // an icicle snaps off the ceiling above a climber (the underside of the next floor) and drops through the gap
    const live = CL.players.filter((p) => !p.out && !p.gone && p.dead <= 0)
    if (live.length) { const p = live[(CL.rnd() * live.length) | 0], hang = Math.min(CL.floors.length - 1, Math.round(p.y / FH) + 1), c = clamp(colAt(p.x + (CL.rnd() * 2 - 1) * 8), 2, COLS - 3); if (CL.floors[hang] && CL.floors[hang][c] === 1) CL.icicles.push({ id: CL.id++, x: colX(c), y: floorY(hang) - THICK - 0.4, vy: 0, warn: 1.1, dead: false, hang }) }
  }
}
function stepFoes(dt) {
  for (const f of CL.foes) {
    f.t += dt
    if (f.type === 'topi') {
      if (f.st === 'walk') {
        f.x += f.dir * 5.5 * dt
        // above a hole on its own floor? it stops to plug it with ice
        const row = CL.floors[f.fi]
        const ahead = colAt(f.x + f.dir * 1.2)
        if (row && !row[ahead] && ahead > 2 && ahead < COLS - 3) { f.st = 'plug'; f.t = 0; f.hole = ahead }
        if (Math.abs(f.x) > HALF + 3) f.dead = true
      } else if (f.st === 'plug') {
        if (f.t > 1.4) { const row = CL.floors[f.fi]; if (row && !row[f.hole]) { row[f.hole] = 1; fx(colX(f.hole), f.y, 8, [0.8, 1.6, 2], 8, 0.5, 0.4) } f.st = 'walk' }
      }
      f.y = floorY(f.fi)
    } else if (f.type === 'bird') {
      f.x += f.dir * 9 * dt; f.y = f.base + Math.sin(f.t * 2.4) * 3
      if (Math.abs(f.x) > HALF + 6) f.dead = true
    }
    for (const p of CL.players) if (!f.dead && p.dead <= 0 && !p.out && !p.gone && Math.abs(p.x - f.x) < 1.5 && p.y + 3 > f.y && p.y < f.y + 2.4) hurt(p, f.type)
  }
  CL.foes = CL.foes.filter((f) => !f.dead)
  for (const ic of CL.icicles) {
    if (ic.warn > 0) { ic.warn -= dt; continue }
    ic.vy -= 40 * dt; ic.y += ic.vy * dt
    for (const p of CL.players) if (!ic.dead && p.dead <= 0 && !p.out && !p.gone && Math.abs(p.x - ic.x) < 1.1 && ic.y > p.y - 0.5 && ic.y < p.y + 3.6) { hurt(p, 'icicle'); ic.dead = true }
    // an icicle shatters on any solid floor
    const fi = Math.round((ic.y - 1) / FH)
    if (!ic.dead && fi < (ic.hang === undefined ? 99 : ic.hang) && Math.abs(ic.y - 1 - floorY(fi)) < 1.5 && solidAt(fi, ic.x)) { ic.dead = true; fx(ic.x, ic.y, 6, [1, 1.8, 2.4], 10, 0.4, 0.3) }
    if (ic.y < CL.camTop - 40) ic.dead = true
  }
  CL.icicles = CL.icicles.filter((i) => !i.dead)
}
function update(dtRaw) {
  const dt = Math.min(dtRaw, 0.05)
  if (CL.mode === 'idle' || CL.paused) return
  stepParticles(dt)
  for (const q of CL.fx) { q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy -= 22 * dt }
  CL.fx = CL.fx.filter((q) => q.life > 0)
  if (CL.msg) { CL.msg.t -= dt; if (CL.msg.t <= 0) CL.msg = null }
  if (CL.mode === 'over') { emitTick(dt); return }
  if (CL.net && CL.net.role === 'guest') { guestStep(dt); emitTick(dt); return }
  CL.t += dt; CL.lvlT += dt
  readLocal()
  for (const c of CL.clouds) { c.x += c.dir * c.sp * dt; if (c.x < -HALF + 6) c.dir = 1; if (c.x > HALF - 6) c.dir = -1 }
  for (const p of CL.players) stepPlayer(p, dt)
  // the screen only ever scrolls up, following the best climber
  const best = Math.max(...CL.players.filter((p) => !p.out && !p.gone).map((p) => p.best), 0)
  CL.camTop = Math.max(CL.camTop, Math.min(best + 14, CL.topY + 10))
  if (CL.clearT <= 0) spawnFoes(dt)
  stepFoes(dt)
  for (const v of CL.veg) if (!v.got) for (const p of CL.players) if (p.dead <= 0 && !p.out && Math.abs(p.x - v.x) < 1.6 && Math.abs(p.y + 1.5 - v.y) < 2.4) { v.got = true; p.score += 300; CL.score += 300; CL.got++; sfx('coin'); fx(v.x, v.y, 8, [2, 1.8, 0.4], 10, 0.5, 0.4) }
  // the mountain is climbed once somebody stands on the summit
  const alive = CL.players.filter((p) => !p.out && !p.gone)
  if (CL.clearT <= 0 && CL.players.some((p) => p.done)) { CL.clearT = 3; const bonus = Math.max(0, Math.round(3000 - CL.lvlT * 20)) + CL.got * 100; CL.score += bonus; CL.msg = { text: 'SUMMIT!', sub: 'TIME BONUS +' + bonus, t: 3 }; sfx('win'); flash(0.3, [1, 1, 1]); for (const p of CL.players) p.score += Math.round(bonus / CL.players.length); profile.climbLevel = Math.max(profile.climbLevel || 0, CL.lvl + 1) }
  if (CL.clearT > 0) { CL.clearT -= dt; if (CL.clearT <= 0) { if (CL.lvl + 1 >= MOUNTAINS.length) return finish(true); CL.lvl++; newLevel() } }
  else if (alive.length === 0 || CL.players.every((p) => p.out || p.gone)) return finish(false)
  emitTick(dt)
}
function finish(win) {
  CL.mode = 'over'; music.stop()
  CL.over = { win, score: CL.score, level: CL.lvl + 1, kind: CL.kind, players: CL.players.map((p) => ({ n: p.name, s: p.score })), got: CL.got }
  profile.climbGames = (profile.climbGames || 0) + 1; profile.climbBest = Math.max(profile.climbBest || 0, CL.score); profile.climbLevel = Math.max(profile.climbLevel || 0, win ? MOUNTAINS.length : CL.lvl)
  recordScore('climb', CL.score); saveProfile(); sfx(win ? 'win' : 'over')
  if (CL.net && CL.net.role === 'host') CL.net.send({ k: 'end', over: CL.over })
  emitC()
}
// ---------- input ----------
const TK = {}
function readLocal() {
  const dn = (...c) => c.some((k) => keys[k])
  const p0 = CL.players[CL.net ? CL.me : 0]
  if (!p0) return
  const I = p0.in
  const two = CL.kind === 'two'
  I.dx = (dn('KeyD', two ? 'KeyD' : 'ArrowRight') || TK.right ? 1 : 0) - (dn('KeyA', two ? 'KeyA' : 'ArrowLeft') || TK.left ? 1 : 0)
  I.jump = dn('KeyW', 'Space', two ? 'KeyW' : 'ArrowUp') || !!TK.jump
  I.hit = dn('KeyJ', 'KeyF', 'KeyK') || !!TK.hit
  if (two && CL.players[1]) { const q = CL.players[1].in; q.dx = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0); q.jump = !!keys.ArrowUp; q.hit = !!(keys.Comma || keys.Slash || keys.Period) }
}
function onKey(code) {
  if (CL.mode === 'idle') return
  if (code === 'Escape' || code === 'KeyP') { if (CL.mode === 'play' && !CL.net) { CL.paused = !CL.paused; emitC() } return }
  if (CL.mode === 'over' && code === 'Enter') return climbActions.rematch()
}
export const climbActions = {
  start, stop, quit() { toMenu() }, resume() { CL.paused = false; emitC() }, pause() { if (CL.mode === 'play' && !CL.paused && !CL.net) { CL.paused = true; emitC(); return true } return false },
  rematch() { if (CL.net) { if (CL.net.role === 'host') CL.net.restart(); else CL.net.sendHost({ k: 'rematch' }); return } start({ level: 0, two: CL.kind === 'two' }) },
  press(n, on) { TK[n] = on },
}
// ---------- online: the host climbs the world, the guest sends controls and mirrors ----------
const r2 = (v) => Math.round(v * 100) / 100
function sendSnap(dt) {
  CL.netT -= dt; if (CL.netT > 0) return; CL.netT = 0.066
  CL.net.send({ k: 'st', lvl: CL.lvl, t: r2(CL.t), cam: r2(CL.camTop), sc: CL.score, got: CL.got, clr: CL.clearT > 0 ? 1 : 0,
    p: CL.players.map((p) => [r2(p.x), r2(p.y), r2(p.vx), r2(p.vy), p.face, p.ground ? 1 : 0, p.lives, p.score, p.dead > 0 ? 1 : 0, p.swing > 0 ? 1 : 0, p.out ? 1 : 0, p.done ? 1 : 0, p.inv > 0 ? 1 : 0, r2(p.best)]),
    f: CL.foes.map((f) => [f.id, f.type, r2(f.x), r2(f.y), f.dir, f.st === 'plug' ? 1 : 0]), i: CL.icicles.map((i) => [i.id, r2(i.x), r2(i.y), i.warn > 0 ? 1 : 0]),
    c: CL.clouds.map((c) => [c.id, c.floor, r2(c.x), c.dir]), b: CL.floors.map((row) => row.join('')), v: CL.veg.map((v) => (v.got ? 1 : 0)).join(''), msg: CL.msg })
}
function applySnap(d) {
  if (d.lvl !== CL.lvl || CL.floors.length !== d.b.length) { CL.lvl = d.lvl; build(CL.lvl, CL.seed); CL.id = 1000 }
  CL.t = d.t; CL.camTop = d.cam; CL.score = d.sc; CL.got = d.got; CL.clearT = d.clr ? 1 : 0
  d.p.forEach((a, i) => { const p = CL.players[i]; if (!p) return; const mine = i === CL.me; if (!mine || Math.hypot(p.x - a[0], p.y - a[1]) > 5 || a[8]) { p.x = a[0]; p.y = a[1]; p.vx = a[2]; p.vy = a[3] } else { p.x += (a[0] - p.x) * 0.2; p.y += (a[1] - p.y) * 0.2 }; Object.assign(p, { face: a[4], ground: !!a[5], lives: a[6], score: a[7], dead: a[8] ? 1 : 0, swing: a[9] ? 0.2 : 0, out: !!a[10], done: !!a[11], inv: a[12] ? 1 : 0, best: a[13] }) })
  CL.floors = d.b.map((s) => [...s].map(Number))
  const fm = new Map(CL.foes.map((f) => [f.id, f]))
  CL.foes = d.f.map((a) => Object.assign(fm.get(a[0]) || { t: 0 }, { id: a[0], type: a[1], x: a[2], y: a[3], dir: a[4], st: a[5] ? 'plug' : 'walk' }))
  CL.icicles = d.i.map((a) => ({ id: a[0], x: a[1], y: a[2], warn: a[3] ? 1 : 0 }))
  CL.clouds = d.c.map((a) => ({ id: a[0], floor: a[1], x: a[2], dir: a[3], w: 7, sp: 5 }))
  CL.veg.forEach((v, i) => { v.got = d.v[i] === '1' })
  if (d.msg && (!CL.msg || CL.msg.text !== d.msg.text)) CL.msg = d.msg
}
let inT = 0
function guestStep(dt) {
  const me = CL.players[CL.me]
  readLocal()
  if (me && !me.dead && !me.out) { // predict our own run locally so the controls feel instant; the host corrects us
    const I = me.in; me.vx += clamp(I.dx * 13 - me.vx, -70 * dt, 70 * dt); me.x = clamp(me.x + me.vx * dt, -HALF + 2.6, HALF - 2.6); if (I.dx) me.face = Math.sign(I.dx)
  }
  me && (me.anim += dt)
  for (const p of CL.players) { p.swing = Math.max(0, p.swing - dt); p.anim += dt }
  for (const f of CL.foes) { f.t = (f.t || 0) + dt; if (f.type === 'bird') f.x += f.dir * 9 * dt; else if (f.st !== 'plug') f.x += f.dir * 5.5 * dt }
  for (const c of CL.clouds) c.x += c.dir * c.sp * dt
  inT -= dt
  if (inT <= 0 && me) { inT = 0.05; const I = me.in; CL.net.sendHost({ k: 'in', dx: I.dx, j: I.jump ? 1 : 0, h: I.hit ? 1 : 0 }) }
}
function emitTick(dt) { if (CL.net && CL.net.role === 'host' && CL.mode === 'play') sendSnap(dt); CL.emitT -= dt; if (CL.emitT <= 0) { CL.emitT = 0.1; emitC() } }
function emitC() {
  const M = MOUNTAINS[Math.min(CL.lvl, MOUNTAINS.length - 1)]
  const T = timeOf(CL.tod0, CL.t, 260)
  snap = { mode: CL.mode, paused: CL.paused, kind: CL.kind, lvl: CL.lvl + 1, lvls: MOUNTAINS.length, name: M.name, score: CL.score, floor: Math.max(0, ...CL.players.map((p) => Math.floor(p.best / FH))), floors: CL.floors.length - 1, time: CL.t, msg: CL.msg, over: CL.over, online: !!CL.net, me: CL.me,
    players: CL.players.map((p, i) => ({ n: p.name, lives: p.lives, score: p.score, dead: p.dead > 0 || p.out, c: p.color, me: i === CL.me })), env: labelOfClimb(T), night: T.night }
  subs.forEach((f) => f())
}
const labelOfClimb = (T) => (T.day > 0.85 ? 'DAY' : T.night > 0.85 ? 'NIGHT' : 'DUSK') + (CL.weather === 'clear' ? '' : ' · ' + CL.weather.toUpperCase())
registerNet('climb', {
  min: 1,
  begin(ctx) { start({ seed: ctx.seed, level: 0, net: { role: ctx.role, players: ctx.players, me: ctx.me, send: (d) => ctx.send(d), sendHost: (d) => ctx.sendHost(d), restart: () => ctx.restart() } }) },
  active: () => !!CL.net && CL.mode !== 'idle',
  onMsg(d, from) {
    if (!d || !CL.net) return
    if (CL.net.role === 'host') {
      const i = CL.net.players.findIndex((p) => p.id === from), p = CL.players[i]
      if (!p) return
      if (d.k === 'in') { p.in.dx = clamp(+d.dx || 0, -1, 1); p.in.jump = !!d.j; p.in.hit = !!d.h }
      else if (d.k === 'rematch' && CL.mode === 'over') CL.net.restart()
    } else if (d.k === 'st') applySnap(d)
    else if (d.k === 'end') { CL.mode = 'over'; CL.over = d.over; music.stop(); sfx(d.over.win ? 'win' : 'over'); profile.climbGames = (profile.climbGames || 0) + 1; profile.climbBest = Math.max(profile.climbBest || 0, d.over.score); saveProfile(); emitC() }
  },
  onLeave(cid) { if (!CL.net) return; const i = CL.net.players.findIndex((p) => p.id === cid); if (CL.net.role === 'host' && CL.players[i]) { CL.players[i].gone = true; CL.players[i].out = true } else if (CL.net.role === 'guest' && CL.mode === 'play' && cid === null) finish(false) },
})
// ---------- drawing ----------
const YAW = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c] }
export function climbEnv() {
  const M = MOUNTAINS[Math.min(CL.lvl, MOUNTAINS.length - 1)], T = timeOf(CL.tod0, CL.t, 260), E = skyFor(T, CL.weather, { sky: M.sky, fog: '#bcd8ff', sun: '#fff4e0', sunI: 1.2, amb: 0.9, dir: 0.2 })
  E.T = T; E.fogNear = E.fogFar ? E.fogNear * 0.7 : 0
  return E
}
function lights() { const E = climbEnv(); return { sun: { x: -30, y: CL.camTop + 40, z: 50, color: E.sunColor, intensity: E.sunI }, ambient: E.amb, dir: E.dir, shadow: false, lantern: { x: 0, y: CL.camTop - 8, z: 14, color: '#bfe6ff', intensity: 0.7 + E.T.night * 1.4, distance: 90 } } }
function camera(aspect) {
  const cx = 0, cy = CL.camTop - 12, sk = (G.shake || 0) * 0.5
  return { x: cx + (Math.random() - 0.5) * sk, y: cy + 4 + (Math.random() - 0.5) * sk, z: 66, tx: cx, ty: cy, tz: 0, fov: 42, far: 500, aspect }
}
function drawClimber(api, p, t) {
  const { put3, putM } = api
  if (p.out || p.gone) return
  const blink = p.inv > 0 && Math.floor(t * 12) % 2 === 0
  if (blink || (p.dead > 0 && p.dead < 1.5 && Math.floor(t * 20) % 3 === 0)) return
  const f = p.face, walk = Math.abs(p.vx) > 1 && p.ground ? Math.sin(p.anim * 14) : 0, air = !p.ground
  const col = p.color === '#ff6ab8' ? [[1.4, 0.4, 0.75], [1.8, 1.1, 1.4]] : [[0.3, 0.55, 1.4], [1.2, 1.5, 2]]
  const x = p.x, y = p.y
  const b = (lx, ly, lz, sx, sy, sz, c, rz = 0) => put3(x + lx * f, y + ly, lz, sx, sy, sz, rz * f, c[0], c[1], c[2], 0)
  b(-0.3 + walk * 0.3, 0.55, 0.3, 0.6, 1.1, 0.7, [0.15, 0.12, 0.2]); b(0.3 - walk * 0.3, 0.55, -0.3, 0.6, 1.1, 0.7, [0.15, 0.12, 0.2]) // boots
  b(0, 1.8 + (air ? 0.3 : 0), 0, 1.5, 1.7, 1.2, col[0]) // parka
  b(0, 2.9 + (air ? 0.3 : 0), 0, 1.3, 1.1, 1.2, [1.7, 1.4, 1.2]) // face
  b(0, 3.5 + (air ? 0.3 : 0), 0, 1.6, 0.9, 1.4, col[0]); b(0.5, 3.0, 0.55, 0.3, 0.3, 0.2, [0.1, 0.1, 0.15]) // hood and eye
  b(0.4, 3.7, 0, 0.5, 0.5, 0.5, col[1]) // pom-pom
  b(0, 1.4, -0.8, 0.9, 1.1, 0.5, col[1]) // pack
  // the hammer swings in an arc
  const sw = p.swing > 0 ? (1 - p.swing / 0.3) : 0, ang = -1.2 + sw * 2.6
  b(1.0, 2.2, 0.7, 0.4, 0.4 + 1.6, 0.4, [0.4, 0.28, 0.16], ang); b(1.0 + Math.sin(ang) * 1.3, 2.2 + Math.cos(ang) * 1.3, 0.7, 1.2, 0.9, 0.9, [0.8, 0.8, 0.9])
}
function drawFoe(api, f, t) {
  const { put3 } = api, d = f.dir || 1
  if (f.type === 'topi') {
    const w = Math.sin(t * 9 + f.id) * 0.3
    put3(f.x, f.y + 1.2, 0, 2.6, 1.8, 1.8, 0, 1.7, 1.75, 1.9, 0); put3(f.x + d * 1.4, f.y + 1.5, 0, 1.2, 1.2, 1.2, 0, 1.8, 1.8, 2); put3(f.x + d * 2, f.y + 1.5, 0.5, 0.3, 0.3, 0.2, 0, 0.1, 0.1, 0.1, 0)
    put3(f.x - d * 0.8, f.y + 0.3 + w * 0.3, 0.6, 0.8, 0.6, 0.6, 0, 0.6, 0.5, 0.45, 0); put3(f.x + d * 0.8, f.y + 0.3 - w * 0.3, -0.6, 0.8, 0.6, 0.6, 0, 0.6, 0.5, 0.45, 0)
    put3(f.x, f.y + 2.4, 0, 0.8, 0.5, 1.1, 0, 2.2, 0.2, 0.2, 0) // scarf
    if (f.st === 'plug') put3(f.x + d * 2.4, f.y + 0.9, 0, 1.6, 1.4, 1.6, 0, 0.5, 1.4, 2.2, 0) // the ice block it carries
  } else {
    const fl = Math.sin(t * 16 + f.id) * 0.8
    put3(f.x, f.y + 1, 0, 1.8, 1.1, 1.2, 0, 1.6, 0.4, 0.3, 0); put3(f.x + d * 1.1, f.y + 1.2, 0, 0.9, 0.9, 0.9, 0, 1.7, 0.5, 0.35, 0); put3(f.x + d * 1.8, f.y + 1.1, 0, 0.7, 0.3, 0.3, 0, 2.4, 1.8, 0.3, 0)
    put3(f.x - d * 0.2, f.y + 1.8 + fl * 0.5, 0.9, 1.2, 0.3, 1.8, fl * 0.6, 1.3, 0.35, 0.28, 0); put3(f.x - d * 0.2, f.y + 1.8 - fl * 0.5, -0.9, 1.2, 0.3, 1.8, -fl * 0.6, 1.3, 0.35, 0.28, 0)
  }
}
function draw3(api) {
  const { put3, putS } = api, t = G.time
  const E = climbEnv(), M = MOUNTAINS[Math.min(CL.lvl, MOUNTAINS.length - 1)]
  const cy = CL.camTop - 12, lo = cy - 34, hi = cy + 30
  // far mountains (parallax) and snow clouds
  for (let k = 0; k < 9; k++) { const x = -150 + k * 38 + Math.sin(k * 7) * 8, h = 90 + (k * 37 % 60), w = 60 + (k * 13 % 30), by = cy * 0.55 - 30; put3(x, by + h / 2, -80 - (k % 3) * 14, w, h, w, 0, (0.55 + (k % 3) * 0.1) * (0.4 + 0.6 * E.T.day), (0.65 + (k % 3) * 0.08) * (0.4 + 0.6 * E.T.day), (0.9 + (k % 3) * 0.05) * (0.45 + 0.55 * E.T.day), k); put3(x, by + h - 6, -80 - (k % 3) * 14, w * 0.45, 16, w * 0.45, 0, 1.6 * E.T.day + 0.4, 1.7 * E.T.day + 0.4, 1.9 * E.T.day + 0.5, k) }
  if (E.T.night > 0.3) for (let i = 0; i < 80; i++) put3(-120 + (i * 53 % 240), cy + 20 + (i * 29 % 70), -120, 1.4, 1.4, 1.4, 0, 1.6 * E.T.night, 1.7 * E.T.night, 2.2 * E.T.night, 0)
  // side walls of the mountain
  for (let i = Math.max(0, Math.floor(lo / FH)); i <= Math.min(CL.floors.length - 1, Math.ceil(hi / FH)); i++) for (const s of [-1, 1]) { put3(s * (HALF + 6), floorY(i) + FH / 2 - 0.4, 0, 12, FH, 6, 0, 0.42 + (i % 2) * 0.05, 0.46, 0.55, 0); put3(s * (HALF + 0.5), floorY(i) + FH - 0.4, 0.2, 1.4, 0.7, 5.6, 0, 1.8, 1.85, 2, 0) }
  // floors
  for (let i = Math.max(0, Math.floor(lo / FH) - 1); i <= Math.min(CL.floors.length - 1, Math.ceil(hi / FH)); i++) {
    const row = CL.floors[i], y = floorY(i)
    if (i === CL.floors.length - 1) put3(0, y + 4, -1, 16, 8, 0.6, 0, 0.5, 0.5, 0.6, 0) // the summit marker wall
    for (let c = 0; c < COLS; c++) {
      const ty = row[c]; if (!ty) continue
      const x = colX(c)
      if (ty === 1) { const sh = 0.9 + ((c * 7 + i * 3) % 5) * 0.04; put3(x, y - THICK / 2, 0, BW - 0.06, THICK, 4.6, 0, 0.5 * sh, 1.35 * sh, 1.9 * sh, 0); put3(x, y + 0.05, 0.4, BW - 0.2, 0.18, 3.6, 0, 1.9, 2.2, 2.4, 0) }
      else { put3(x, y - THICK / 2, 0, BW - 0.04, THICK, 4.6, 0, 0.36, 0.38, 0.46, 0); put3(x, y + 0.08, 0.3, BW - 0.1, 0.22, 4, 0, 1.7, 1.75, 1.9, 0) }
    }
  }
  for (const c of CL.clouds) { const y = floorY(c.floor); put3(c.x, y - 0.5, 0, c.w, 1.2, 4, 0, 1.8, 1.85, 2.1, 0); put3(c.x - 1.4, y + 0.3, 0.3, 3, 1, 3, 0, 1.9, 1.95, 2.2, 0); put3(c.x + 1.6, y + 0.2, -0.2, 2.4, 0.9, 2.8, 0, 1.85, 1.9, 2.15, 0) }
  for (const v of CL.veg) if (!v.got) { const cl = [[2.2, 1, 0.3], [2.2, 1.8, 0.3], [1.4, 0.4, 1.6], [0.5, 1.6, 0.5]][v.t]; put3(v.x, v.y + 0.5 + Math.sin(t * 4 + v.x) * 0.2, 0.4, 0.9, 1.5, 0.9, 0, cl[0], cl[1], cl[2], t); put3(v.x, v.y + 1.5 + Math.sin(t * 4 + v.x) * 0.2, 0.4, 0.5, 0.4, 0.5, 0, 0.4, 1.8, 0.4, 0) }
  for (const f of CL.foes) if (f.y > lo - 4 && f.y < hi) drawFoe(api, f, t)
  for (const ic of CL.icicles) { if (ic.warn > 0) { put3(ic.x, ic.y - 3, 0, 0.8, 6, 0.4, 0, 2.2 * (0.5 + 0.5 * Math.sin(t * 20)), 0.4, 0.4, 0); put3(ic.x, ic.y - 0.4, 0, 1, 2.2, 1, 0, 1.6, 2.2, 2.6, 0); continue } put3(ic.x, ic.y, 0, 1, 2.2, 1, 0, 1.6, 2.2, 2.6, 0); put3(ic.x, ic.y - 1.4, 0, 0.5, 1.2, 0.5, 0, 1.8, 2.4, 2.8, 0) }
  for (const p of CL.players) drawClimber(api, p, t)
  for (const q of CL.fx) { const f = q.life / q.max, s = q.s * (0.3 + 0.7 * f); putS(q.x, q.y, 1.5, s, s, s, q.c[0], q.c[1], q.c[2]) }
  weatherFx(put3, 0, cy + 4, CL.weather === 'clear' ? 'snow' : CL.weather === 'fog' ? 'spores' : 'snow', t, { y0: cy - 28, h: 56, r: 60, n: CL.weather === 'snow' ? 180 : 70 })
  void M
}
if (typeof window !== 'undefined') { window.__CL = CL; window.__climb = climbActions }
games.climb = { update, onKey, draw() {}, draw3, camera, lights, fog: () => { const E = climbEnv(); return E.fogFar ? { fog: E.fog, fogNear: E.fogNear, fogFar: E.fogFar } : null }, stop, sky: () => climbEnv().sky }
