// SNOW RUSH: an SSX-style 3D snowboarding game. Race five riders or go for a trick score down three mountains.
// Logic space is (x sideways, y up, z downhill); the scene draws it with Z = -z so the camera sits behind the rider.
import { G, emit as engineEmit, keys, games, profile, saveProfile, recordScore, toMenu, shake, flash, stepParticles } from './engine.js'
import { sfx, music, rev } from './audio.js'
import { col, clamp, rng } from './pxl.js'
import { registerNet, gameEnded } from './online/gnet.js'

const TAU = Math.PI * 2
const GRAV = 31, GS = 34, GL = 24, KD = 0.0105, RAIL_H = 1.05, DZ = 1.8
const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t) }
const hash = (a, b = 0) => { let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296 }
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d }
const hex = (h, k = 1) => { const c = col(h); return [c[0] * k, c[1] * k, c[2] * k] }

export const COURSES = [
  { id: 'alps', name: 'ALPINE RUN', sub: 'Sunny groomed slopes with kickers and rails', len: 2300, hw: 13, curve: [9, 5], per: 95, pipe: 0, kick: 1, rails: 1, rocks: 0.55, trees: 1, ai: 0.94, sky: '#8fcaff', fog: '#c4e0ff', snow: [0.93, 0.96, 1.0], sun: '#fff1d8', amb: 0.95, sunI: 1.5, night: false, seed: 11, par: 80 },
  { id: 'pipe', name: 'GLACIER PIPE', sub: 'A giant ice half-pipe: ride the walls, fly off the lips', len: 2100, hw: 9, curve: [5, 3], per: 110, pipe: 1, kick: 0.45, rails: 0.25, rocks: 0.15, trees: 0, ai: 0.95, sky: '#79d6ff', fog: '#b4ecff', snow: [0.8, 0.94, 1.0], sun: '#e8faff', amb: 1.0, sunI: 1.4, night: false, seed: 23, par: 72 },
  { id: 'night', name: 'MIDNIGHT PEAK', sub: 'A night run: tight turns, rocks and glowing rails', len: 2600, hw: 10.5, curve: [16, 8], per: 72, pipe: 0, kick: 1.1, rails: 1.25, rocks: 1.35, trees: 1.5, ai: 1.0, sky: '#0a0f2e', fog: '#141c4a', snow: [0.66, 0.74, 0.98], sun: '#9fb4ff', amb: 0.8, sunI: 1.0, night: true, seed: 37, par: 100 },
]
export const RIDERS = [
  { id: 0, name: 'AIKO', jacket: '#ff4a8a', pants: '#232a55', board: '#ffe84a', helmet: '#ff4a8a', skin: '#f3c9a0', spd: 1.0, trk: 1.12, bal: 1.0, bio: 'Trick queen' },
  { id: 1, name: 'REX', jacket: '#3de8ff', pants: '#1c2440', board: '#ff7a2a', helmet: '#e8f0ff', skin: '#d9a07a', spd: 1.07, trk: 0.94, bal: 1.0, bio: 'Speed demon' },
  { id: 2, name: 'NOVA', jacket: '#b07aff', pants: '#2a1c44', board: '#6aff9a', helmet: '#b07aff', skin: '#8a5a3a', spd: 1.0, trk: 1.0, bal: 1.15, bio: 'Smooth landings' },
  { id: 3, name: 'BRUNO', jacket: '#ff8a2a', pants: '#3a2a1c', board: '#3de8ff', helmet: '#3a2a1c', skin: '#f0c090', spd: 1.04, trk: 0.98, bal: 1.05, bio: 'Heavy rider' },
  { id: 4, name: 'MIKA', jacket: '#6aff9a', pants: '#1c3a2e', board: '#ff4a8a', helmet: '#e8f0ff', skin: '#e8b890', spd: 0.97, trk: 1.18, bal: 1.05, bio: 'Spin master' },
  { id: 5, name: 'KODI', jacket: '#ffe84a', pants: '#2a2a2a', board: '#b07aff', helmet: '#ffe84a', skin: '#c88a60', spd: 1.03, trk: 1.04, bal: 0.95, bio: 'All-rounder' },
]
const GRABS = [
  ['INDY', 'MELON', 'MUTE', 'METHOD', 'STALEFISH'],
  ['NOSE GRAB', 'TAIL GRAB', 'JAPAN', 'SAD', 'BLUNT'],
]
const GRAB_MUL = [[1, 1.15, 1.15, 1.5, 1.4], [1.1, 1.2, 1.35, 1.6, 1.4]]

let CUR = COURSES[0]
let F = { kick: [], rails: [], rocks: [], pads: [], toks: [], gates: [] }

export const SX = { mode: 'idle', paused: false, kind: 'race', ci: 0, rid: 0, riders: [], P: null, focus: null, t: 0, clock: 0, count: 0, timeLeft: 0, len: 0, over: null, msg: null, text: null, fx: [], score: 0, toks: 0, bestTrick: 0, emitT: 0, finishT: 0, place: 0, tricks: 0 }
let snap = null
const subs = new Set()
export const subscribeSsx = (f) => { subs.add(f); return () => subs.delete(f) }
export const getSsxSnap = () => snap

// ------------------------------------------------------------------ the mountain
function xc(z) {
  const c = CUR
  return sm(0, 120, z) * (c.curve[0] * Math.sin(z / c.per) + c.curve[1] * Math.sin(z / 41 + 1.3))
}
let KA = 0 // how much of the last ground() height came from a kicker (0..1), used to tint the snow
function lowerBound(arr, z) { let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m].z < z) lo = m + 1; else hi = m } return lo }
function groundDX(dx, z) {
  const c = CUR, ad = Math.abs(dx)
  let h = -0.3 * z + 1.7 * Math.sin(z * 0.031) + 0.8 * Math.sin(z * 0.093 + 2)
  if (c.pipe) {
    const u = Math.min(0.88, Math.max(0, (ad - 3.5) / 10))
    h += 8 * (1 - Math.sqrt(1 - u * u))
    if (ad > 14) h += (ad - 14) * (ad - 14) * 0.08
  } else {
    const e = ad - c.hw
    if (e > 0) h += Math.min(e * e * 0.055, 6) + Math.max(0, e - 14) * 0.9
  }
  KA = 0
  const K = F.kick
  for (let i = lowerBound(K, z - 14); i < K.length; i++) {
    const k = K[i]
    if (k.z > z) break
    const zz = z - k.z
    if (zz > k.len) continue
    const kd = Math.abs(dx - k.dx), xs = 1 - sm(k.w, k.w + 2.2, kd)
    if (xs <= 0) continue
    const u = zz / k.len
    h += k.h * Math.pow(u, 1.15) * xs
    KA = Math.max(KA, xs)
  }
  return h
}
const ground = (x, z) => groundDX(x - xc(z), z)

function build(c, len, seed) {
  const rnd = rng(seed), f = { kick: [], rails: [], rocks: [], pads: [], toks: [], gates: [] }
  const lim = c.pipe ? 3.4 : c.hw - 4.5
  let z = 130
  const kp = 0.36 * c.kick, rp = kp + 0.22 * c.rails, op = rp + 0.26 * c.rocks, pp = op + 0.12
  while (z < len - 90) {
    const r = rnd()
    if (r < kp) {
      const big = rnd() < (c.pipe ? 0.2 : 0.3), dx = (rnd() * 2 - 1) * lim
      f.kick.push({ z, dx, w: big ? 4.6 : 3.4, len: big ? 11 : 8, h: big ? 8.5 : 5.5, big })
      for (let i = 0; i < 7; i++) f.toks.push({ z: z + 14 + i * 4.2, dx, up: 3.4 + 3.4 * Math.sin((i / 6) * Math.PI) * (big ? 1.4 : 1) })
      z += 82
    } else if (r < rp) {
      const L = 24 + rnd() * 20, dx = (rnd() * 2 - 1) * lim
      f.rails.push({ z0: z, z1: z + L, dx })
      for (let i = 0; i < 5; i++) f.toks.push({ z: z + (i + 0.5) * L / 5, dx, up: 2.7 })
      z += L + 36
    } else if (r < op) {
      const n = 1 + ((rnd() * 3) | 0)
      for (let i = 0; i < n; i++) f.rocks.push({ z: z + i * 6 + rnd() * 3, dx: (rnd() * 2 - 1) * (c.hw - 2.6), r: 1.1 + rnd() * 0.8 })
      z += 40
    } else if (r < pp) { f.pads.push({ z, dx: (rnd() * 2 - 1) * lim }); z += 42 }
    else { const dx = (rnd() * 2 - 1) * lim; for (let i = 0; i < 5; i++) f.toks.push({ z: z + i * 5, dx: dx + Math.sin(i) * 1.4, up: 1.3 }); z += 55 }
    z += 12 + rnd() * 22
  }
  for (let g = 300; g < len - 100; g += 300) f.gates.push(g)
  f.rocks.sort((a, b) => a.z - b.z)
  return f
}

// ------------------------------------------------------------------ riders
function makeRider(def, i, isP) {
  return { i, def, st: def, isP, name: def.name, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, hd: 0, spin: 0, spinV: 0, spinAcc: 0, pitch: 0, pitchV: 0, pitchAcc: 0, roll: 0, tilt: 0, cr: 0, charge: 0, grounded: true, air: 0, maxH: 0, grabT: 0, grabStyle: null, grabIdx: -1, uber: null, crash: 0, tumble: 0, inv: 0, boostT: 0, boosting: false, meter: 0, tricky: 0, grind: null, crashes: 0, fin: null, jumpPrev: false, boostPrev: false, spray: 0, lane: 0, aiDir: 1, aiSpin: 0, aiBoost: 3 + Math.random() * 6, aiMul: 1, sk: 1, bo: 0, pts: 0, t: 0 }
}
function spawnFx(x, y, z, n, c, spd = 6, up = 4, life = 0.6, s = 0.32) {
  const L = SX.fx
  for (let i = 0; i < n && L.length < 260; i++) L.push({ x, y, z, vx: (Math.random() - 0.5) * spd, vy: Math.random() * up, vz: (Math.random() - 0.5) * spd, life, max: life, c, s: s * (0.6 + Math.random() * 0.8) })
}
function say(text, c = '#ffe84a', t = 1.6) { SX.msg = { text, c, t } }
function award(r, pts, text, tricky) {
  if (!r.isP) return
  pts = Math.round(pts)
  SX.score += pts; SX.tricks += pts; SX.bestTrick = Math.max(SX.bestTrick, pts)
  SX.text = { text, pts, t: 2.4, c: pts >= 4000 ? '#ff4a8a' : pts >= 1500 ? '#ffe84a' : '#3de8ff', bad: false }
  if (!r.tricky) { r.meter = Math.min(100, r.meter + pts / 55); if (r.meter >= 100) { r.tricky = 12; say('TRICKY!  UNLIMITED BOOST', '#ff4a8a', 2.2); sfx('rNitro') } }
  sfx(pts >= 3000 ? 'mgBig' : 'tdBuild')
  void tricky
}

// ------------------------------------------------------------------ physics
function beginAir(r) { r.air = 0; r.spinAcc = 0; r.pitchAcc = 0; r.spinV = 0; r.pitchV = 0; r.grabT = 0; r.grabStyle = null; r.grabIdx = -1; r.uber = null; r.maxH = 0 }
function pop(r, v) { r.grounded = false; r.vy += v; beginAir(r); if (r.isP) sfx('jump') }
function recover(r) {
  const cx = xc(r.z), lim = CUR.pipe ? 5 : CUR.hw - 2
  r.crash = 0; r.inv = 1.8; r.spin = 0; r.pitch = 0; r.roll = 0; r.hd = 0; r.grounded = true; r.vx = 0; r.vz = 7; r.x = cx + clamp(r.x - cx, -lim, lim); r.y = ground(r.x, r.z); r.vy = 0; r.grind = null
}
function crashRider(r, why) {
  if (r.crash > 0 || r.inv > 0) return
  r.crash = 1.5; r.tumble = 0; r.crashes++; r.why = (r.why || '') + (why || '?')[0] + '@' + (r.z | 0) + ' '; r.vx *= 0.3; r.vz *= 0.3; r.grind = null; r.uber = null
  spawnFx(r.x, r.y + 0.6, r.z, 22, [1, 1, 1.1], 12, 8, 0.8, 0.5)
  if (r.isP) { sfx('rCrash'); shake(0.55); flash(0.15, [1, 1, 1]); SX.text = { text: why, pts: 0, t: 1.8, c: '#ff4a6a', bad: true }; r.pts = 0 }
}
function evalLanding(r) {
  const spinHalf = Math.round(Math.abs(r.spinAcc) / Math.PI), spinRem = Math.abs(Math.abs(r.spinAcc) - spinHalf * Math.PI)
  const flips = Math.round(Math.abs(r.pitchAcc) / TAU), flipRem = Math.abs(Math.abs(r.pitchAcc) - flips * TAU)
  const tol = 0.92 * r.st.bal
  const bail = spinRem > tol || flipRem > tol * 0.9 || (r.uber && r.uber.t < r.uber.dur - 0.05)
  const perfect = spinRem < 0.4 && flipRem < 0.4
  const parts = []
  let pts = 0
  if (spinHalf > 0) { pts += 100 * spinHalf * (spinHalf + 1) / 2; parts.push(spinHalf * 180 + (spinHalf >= 2 ? '' : '')) }
  if (flips > 0) { pts += 400 * flips * (flips + 1) / 2; parts.push((r.pitchAcc > 0 ? (flips > 1 ? flips + 'x BACKFLIP' : 'BACKFLIP') : (flips > 1 ? flips + 'x FRONTFLIP' : 'FRONTFLIP'))) }
  if (r.grabT > 0.25 && r.grabIdx >= 0) { const g = r.grabIdx; pts += 260 * r.grabT * GRAB_MUL[g >> 3][g & 7]; parts.push(GRABS[g >> 3][g & 7]) }
  const types = (spinHalf > 0 ? 1 : 0) + (flips > 0 ? 1 : 0) + (r.grabT > 0.25 ? 1 : 0)
  if (r.air > 0.7) pts += 60 * r.air * r.air
  let mult = 1 + 0.5 * Math.max(0, types - 1)
  if (perfect) mult *= 1.2
  if (r.tricky > 0) mult *= 2
  pts *= mult
  if (r.uber) { pts += 8000 * (r.tricky > 0 ? 1.5 : 1); parts.unshift('UBER TRICK') }
  return { bail, perfect, pts, text: parts.length ? parts.join(' ') : 'AIR', types }
}
function land(r, gy, dt) {
  const e = 0.6
  const rate = (ground(r.x + r.vx * dt * 1, r.z + r.vz * dt * 1) - gy) / Math.max(dt, 1e-3)
  const impact = Math.max(0, rate - r.vy)
  r.y = gy; r.vy = rate; r.grounded = true
  const res = r.air > 0.3 ? evalLanding(r) : null
  const sp = Math.hypot(r.vx, r.vz)
  spawnFx(r.x, r.y + 0.2, r.z, Math.min(18, 4 + impact * 0.4), [1, 1, 1.1], 7, 4, 0.55, 0.4)
  if (r.isP && impact > 8) { sfx('land'); shake(Math.min(0.5, impact * 0.012)) }
  if (res) {
    r.spin = angDiff(r.spinAcc, 0) % TAU; r.pitch = 0
    if (res.bail) crashRider(r, r.uber ? 'UBER BAIL!' : 'WIPEOUT!')
    else {
      if (res.perfect) { r.vx *= 1.03; r.vz *= 1.03 }
      if (r.isP && res.pts > 0) { award(r, res.pts, res.text + (res.perfect ? ' · PERFECT' : ''), false); if (res.pts >= 1200) { flash(0.12, [1, 0.9, 0.5]); shake(0.3) } }
      r.uber = null
    }
  } else { r.spin = 0; r.pitch = 0 }
  void e; void sp
}
// vertical motion shared by riding, tumbling and flying
function vertical(r, dt, quiet) {
  if (r.grounded) {
    const gy = ground(r.x, r.z), vyg = (gy - r.y) / dt
    if (r.vy - vyg > 6) { r.grounded = false; if (!quiet) beginAir(r) } else { r.y = gy; r.vy = vyg }
  } else {
    r.vy -= GRAV * dt; r.y += r.vy * dt
    const gy = ground(r.x, r.z)
    if (r.y <= gy) { if (quiet) { r.y = gy; r.grounded = true; r.vy = 0 } else land(r, gy, dt) }
  }
}
function stepGrind(r, inp, dt) {
  const g = r.grind, rail = g.rail
  g.t += dt
  const ox = r.x, oy = r.y
  const spd = Math.max(15, Math.hypot(r.vx, r.vz))
  r.z += spd * dt
  r.x = xc(r.z) + rail.dx
  r.y = ground(r.x, r.z) + RAIL_H
  r.vx = (r.x - ox) / dt; r.vz = spd; r.vy = (r.y - oy) / dt
  r.hd = Math.atan2(r.vx, r.vz); r.cr = 0.55; r.spin += (0 - r.spin) * Math.min(1, dt * 8)
  g.pts += 330 * dt * (r.tricky > 0 ? 2 : 1)
  r.spray += dt
  if (r.spray > 0.05) { r.spray = 0; spawnFx(r.x, r.y - 0.2, r.z, 2, [2, 1.5, 0.6], 3, 3, 0.35, 0.18) }
  const jump = inp.jump && !r.jumpPrev
  if (r.z >= rail.z1 || jump) {
    r.grind = null; r.grounded = false; r.vy += jump ? 9 : 5; beginAir(r)
    if (r.isP) { award(r, g.pts, 'GRIND', false); sfx('jump') }
  }
}
function stepRider(r, inp, dt) {
  if (r.inv > 0) r.inv -= dt
  if (r.boostT > 0) r.boostT -= dt
  r.t += dt
  if (r.crash > 0) {
    r.crash -= dt; r.tumble += dt * 11
    const f = Math.exp(-2.2 * dt); r.vx *= f; r.vz *= f
    r.x += r.vx * dt; r.z += r.vz * dt
    vertical(r, dt, true)
    if (r.crash <= 0) recover(r)
    r.jumpPrev = !!inp.jump
    return
  }
  if (r.grind) { stepGrind(r, inp, dt); r.jumpPrev = !!inp.jump; return }
  const c = CUR
  let spd = Math.hypot(r.vx, r.vz)
  const boostOn = r.boostT > 0 || !!inp.boostOn
  r.boosting = boostOn
  if (r.grounded) {
    const st = clamp(inp.steer || 0, -1, 1)
    if (inp.jump) r.charge = Math.min(0.6, r.charge + dt)
    else if (r.charge > 0.04) { pop(r, 7 + 7.5 * Math.min(1, r.charge / 0.5)); r.charge = 0 }
    else r.charge = 0
    r.cr += ((inp.jump ? 0.9 : 0) - r.cr) * Math.min(1, dt * 12)
    r.hd += st * (1.9 - Math.min(0.6, spd * 0.012)) * r.st.trk * (r.charge > 0 ? 0.55 : 1) * dt
    const vdir = spd > 1.2 ? Math.atan2(r.vx, r.vz) : r.hd
    if (!st) r.hd += angDiff(vdir, r.hd) * Math.min(1, 6 * dt)
    r.hd = clamp(r.hd, -1.15, 1.15)
    const e = 0.8
    const dgx = (ground(r.x + e, r.z) - ground(r.x - e, r.z)) / (2 * e)
    const dgz = (ground(r.x, r.z + e) - ground(r.x, r.z - e)) / (2 * e)
    r.vx += -clamp(dgx, -1.3, 1.3) * GL * (c.pipe ? 0.62 : 1) * dt
    r.vz += -clamp(dgz, -1.6, 1.6) * GS * dt
    const sh = Math.sin(r.hd), ch = Math.cos(r.hd)
    if (boostOn) { r.vx += sh * 17 * dt; r.vz += ch * 17 * dt }
    let along = r.vx * sh + r.vz * ch
    let px = r.vx - along * sh, pz = r.vz - along * ch
    const grip = Math.exp(-(r.charge > 0 ? 3 : 4.8) * dt)
    px *= grip; pz *= grip
    const off = Math.abs(r.x - xc(r.z)) > c.hw + 0.5 && !c.pipe
    along -= KD * (boostOn ? 0.72 : 1) / (r.st.spd * r.st.spd * r.sk * r.sk * r.aiMul * r.aiMul) * along * Math.abs(along) * dt
    if (off) along *= Math.exp(-0.7 * dt)
    if (inp.brake) along *= Math.exp(-1.6 * dt)
    if (r.fin) along *= Math.exp(-1.4 * dt)
    along = Math.max(along, -2)
    r.vx = along * sh + px; r.vz = along * ch + pz
    r.roll += (-st * 0.4 - r.roll) * Math.min(1, dt * 7)
    r.tilt += (Math.atan(dgz * 0.9) - r.tilt) * Math.min(1, dt * 9)
    r.spin += (0 - r.spin) * Math.min(1, dt * 12)
    r.spray -= dt
    if (r.spray <= 0 && spd > 8) { r.spray = 0.05; const k = Math.abs(st) * 1.6 + 0.5; spawnFx(r.x - Math.sin(r.hd) * 1.2, r.y + 0.1, r.z - Math.cos(r.hd) * 1.2, 1 + (k > 1.2 ? 1 : 0), c.night ? [0.8, 0.9, 1.4] : [1, 1, 1.1], 3.5 * k, 2.2 * k, 0.5, 0.26) }
  } else {
    r.air += dt
    let sIn = clamp(inp.spinDir || 0, -1, 1), pIn = clamp(inp.flip || 0, -1, 1)
    if (r.uber) { r.uber.t += dt; sIn = 1; pIn = 0 }
    const sw = r.uber ? (4 * Math.PI / r.uber.dur) : 8.4 * r.st.trk * sIn
    const pw = r.uber ? 0 : 7.2 * r.st.trk * pIn
    r.spinV += (sw - r.spinV) * Math.min(1, dt * (r.uber ? 40 : 9)); r.pitchV += (pw - r.pitchV) * Math.min(1, dt * 9)
    r.spin += r.spinV * dt; r.spinAcc += r.spinV * dt; r.pitch += r.pitchV * dt; r.pitchAcc += r.pitchV * dt
    if (r.uber) { r.pitch += (TAU / r.uber.dur) * dt; r.pitchAcc += (TAU / r.uber.dur) * dt }
    if (inp.grab && !r.uber) {
      const dirIx = inp.dirUp ? 3 : inp.dirDown ? 4 : inp.dirLeft ? 1 : inp.dirRight ? 2 : 0
      const idx = (inp.grab - 1) * 8 + dirIx
      if (r.grabIdx !== idx && r.grabT < 0.2) r.grabIdx = idx
      if (r.grabIdx < 0) r.grabIdx = idx
      r.grabT += dt
    }
    r.cr += ((inp.grab || r.uber ? 1 : 0.35) - r.cr) * Math.min(1, dt * 10)
    r.roll += (0 - r.roll) * Math.min(1, dt * 5); r.tilt += (clamp(r.vy * 0.02, -0.5, 0.5) - r.tilt) * Math.min(1, dt * 4)
    const f = Math.exp(-0.05 * dt); r.vx *= f; r.vz *= f
    r.maxH = Math.max(r.maxH, r.y - ground(r.x, r.z))
    // rails: drop onto one from above
    if (r.isP && r.crash <= 0) {
      for (const rl of F.rails) {
        if (r.z < rl.z0 - 2) break
        if (r.z > rl.z1 - 4) continue
        if (Math.abs(r.x - (xc(r.z) + rl.dx)) < 1.35) {
          const dy = r.y - (ground(r.x, r.z) + RAIL_H)
          if (dy > -0.6 && dy < 1.5 && r.vy <= 4) {
            const res = r.air > 0.3 ? evalLanding(r) : null
            if (res && res.bail) break
            if (res && res.pts > 0) award(r, res.pts, res.text, false)
            r.grind = { rail: rl, t: 0, pts: 0 }; r.grounded = true; r.spin = 0; r.pitch = 0; r.cr = 0.5
            sfx('rBump'); spawnFx(r.x, r.y, r.z, 8, [2, 1.6, 0.6], 6, 4, 0.4, 0.2)
            return
          }
        }
      }
    }
  }
  const cx0 = xc(r.z)
  r.x += r.vx * dt; r.z += r.vz * dt
  // the soft walls of the course
  const lim = c.pipe ? 24 : c.hw + 15, dxw = r.x - xc(r.z)
  if (Math.abs(dxw) > lim) { r.x = xc(r.z) + Math.sign(dxw) * lim; r.vx = -Math.sign(dxw) * Math.abs(r.vx) * 0.4; r.vz *= 0.92 }
  void cx0
  vertical(r, dt, false)
  // rocks
  if (r.crash <= 0) {
    for (let i = lowerBound(F.rocks, r.z - 4); i < F.rocks.length; i++) {
      const k = F.rocks[i]
      if (k.z > r.z + 4) break
      const kx = xc(k.z) + k.dx
      if (Math.hypot(r.x - kx, r.z - k.z) < k.r + 0.55 && r.y < ground(kx, k.z) + k.r * 1.15) { crashRider(r, 'HIT A ROCK!'); k.hit = true; break }
    }
    for (const p of F.pads) {
      if (p.z < r.z - 3) continue
      if (p.z > r.z + 3) break
      if (r.grounded && Math.abs(r.x - (xc(p.z) + p.dx)) < 2.7 && Math.abs(r.z - p.z) < 2.6 && r.boostT < 1.0) {
        r.boostT = 1.7; r.vx += Math.sin(r.hd) * 5; r.vz += Math.cos(r.hd) * 5
        if (r.isP) { sfx('rPad'); say('BOOST PAD', '#3de8ff', 0.9) }
      }
    }
    if (r.isP) {
      for (const t of F.toks) {
        if (t.got) continue
        if (t.z < r.z - 3) continue
        if (t.z > r.z + 3) break
        const tx = xc(t.z) + t.dx
        if (Math.abs(r.x - tx) < 2.3 && Math.abs(r.z - t.z) < 2.4 && Math.abs(r.y - (ground(tx, t.z) + t.up)) < 3.4) {
          t.got = true; SX.toks++; SX.score += 100; if (!r.tricky) r.meter = Math.min(99.5, r.meter + 2.5)
          sfx('coin'); spawnFx(tx, ground(tx, t.z) + t.up, t.z, 6, [2, 1.6, 0.3], 5, 5, 0.5, 0.22)
        }
      }
    }
  }
  r.jumpPrev = !!inp.jump
}

// ------------------------------------------------------------------ opponents and the player's controls
const NOINP = { steer: 0, spinDir: 0, flip: 0, jump: false, grab: 0, boostOn: false }
const TK = {}
function readInput() {
  const dn = (...c) => c.some((k) => keys[k])
  const L = dn('ArrowLeft', 'KeyA') || TK.left, Rr = dn('ArrowRight', 'KeyD') || TK.right, U = dn('ArrowUp', 'KeyW') || TK.up, D = dn('ArrowDown', 'KeyS') || TK.down
  const g1 = dn('KeyJ', 'KeyZ') || TK.grab, g2 = dn('KeyK', 'KeyC') || TK.grab2
  const s = (Rr ? 1 : 0) - (L ? 1 : 0)
  return { steer: s, spinDir: s, flip: (U ? 1 : 0) - (D ? 1 : 0), jump: dn('Space') || !!TK.jump, boost: dn('ShiftLeft', 'ShiftRight', 'KeyB', 'KeyX') || !!TK.boost, grab: g1 ? 1 : g2 ? 2 : 0, dirLeft: L, dirRight: Rr, dirUp: U, dirDown: D, brake: D && !L && !Rr }
}
function aiInput(r, dt) {
  const c = CUR, spd = Math.hypot(r.vx, r.vz)
  const inp = { steer: 0, spinDir: 0, flip: 0, jump: false, grab: 0, boostOn: false }
  if (r.crash > 0 || r.fin) return inp
  r.aiBoost -= dt
  if (r.aiBoost < -1.4) r.aiBoost = 5 + Math.random() * 8
  inp.boostOn = r.aiBoost < 0
  if (r.grounded) {
    const look = 16 + spd * 0.45
    let tx = xc(r.z + look) + r.lane
    if (c.pipe) tx = xc(r.z + look) + Math.sin(SX.clock * 0.55 + r.i * 1.7) * (8 + r.i % 3)
    const lim = c.pipe ? 18 : c.hw - 1.4
    const cx = xc(r.z + look)
    let best = tx, bc = 1e9, danger = null
    for (let cand = -lim; cand <= lim + 0.01; cand += 1.6) {
      const x = cx + cand
      let cost = Math.abs(x - tx) * 0.12 + Math.abs(x - r.x) * 0.05
      for (let i = lowerBound(F.rocks, r.z + 1); i < F.rocks.length; i++) {
        const k = F.rocks[i]
        if (k.z > r.z + look + 14) break
        const kx = xc(k.z) + k.dx, dd = Math.abs(x - kx), reach = k.r + 2.2
        if (dd < reach) cost += (reach - dd) * 9 * (1 - (k.z - r.z) / (look + 16))
      }
      if (cost < bc) { bc = cost; best = x }
    }
    tx = best
    for (let i = lowerBound(F.rocks, r.z + 2); i < F.rocks.length; i++) { const k = F.rocks[i]; if (k.z > r.z + 10) break; if (Math.abs(xc(k.z) + k.dx - r.x) < k.r + 1.2) { danger = k; break } }
    if (danger && r.aiJT <= 0) r.aiJT = 0.34
    if (!c.pipe && !danger) for (const k of F.kick) { if (k.z > r.z + look + 6) break; if (k.z > r.z + 6 && r.i % 3 !== 0 && bc < 0.8) { tx = xc(k.z) + k.dx; break } }
    tx = cx + clamp(tx - cx, -lim, lim)
    const want = clamp((tx - r.x) * 0.075, -0.5, 0.5) + xc(r.z + 6) * 0 ; inp.steer = clamp((want - r.hd) * 3.2, -1, 1)
    if (r.aiJT > 0) { r.aiJT -= dt; inp.jump = true }
    r.aiSpin = 0
    if (spd < 2.5) { r.aiStuck = (r.aiStuck || 0) + dt; if (r.aiStuck > 1.6) { r.aiStuck = 0; r.vz = 8; r.hd = 0; r.x = xc(r.z) + r.lane * 0.5 } } else r.aiStuck = 0
  } else {
    const hAbove = r.y - ground(r.x, r.z)
    const goal = Math.PI * (r.i % 2 ? 2 : 4) * (r.sk > 1.0 ? 1 : 0.5)
    if (r.air > 0.3 && r.maxH > 4 && hAbove > 3.2 && Math.abs(r.spinAcc) < goal - 0.5) inp.spinDir = r.aiDir
    else if (r.maxH > 4 || Math.abs(r.spinAcc) > 0.3) { const rem = r.spinAcc - Math.round(r.spinAcc / Math.PI) * Math.PI; inp.spinDir = clamp(-rem * 2.2 - r.spinV * 0.12, -1, 1) }
  }
  return inp
}

// ------------------------------------------------------------------ the race
function start(o = {}) {
  const ci = clamp(o.course | 0, 0, COURSES.length - 1)
  CUR = COURSES[ci]
  SX.ci = ci; SX.kind = o.kind === 'trick' ? 'trick' : 'race'; SX.rid = clamp(o.rider | 0, 0, RIDERS.length - 1)
  SX.len = SX.kind === 'trick' ? 4600 : CUR.len
  F = build(CUR, SX.len, CUR.seed * 7 + (SX.kind === 'trick' ? 3 : 0))
  SX.riders = []; SX.fx = []; SX.score = 0; SX.toks = 0; SX.bestTrick = 0; SX.tricks = 0; SX.over = null; SX.msg = null; SX.text = null; SX.paused = false; SX.t = 0; SX.clock = 0; SX.finishT = 0; SX.place = 0
  SX.timeLeft = SX.kind === 'trick' ? 90 : 0
  const others = RIDERS.filter((d) => d.id !== SX.rid)
  const NET = o.net || null
  SX.net = NET
  const n = NET ? NET.players.length : SX.kind === 'race' ? 6 : 1
  const slots = Array.from({ length: n }, (_, i) => i)
  const mine = NET ? NET.me : SX.kind === 'race' ? 2 + ((Math.random() * 2) | 0) : 0
  const w = Math.min(CUR.hw - 2, 8)
  for (let i = 0; i < n; i++) {
    const isP = i === mine
    const def = isP ? RIDERS[SX.rid] : NET ? RIDERS[(NET.picks[NET.players[i].id] ?? (i + 1)) % RIDERS.length] : others[(i - (i > mine ? 1 : 0)) % others.length]
    const r = makeRider(def, i, isP)
    if (NET && !isP) { r.remote = true; r.pid = NET.players[i].id; r.name = (NET.players[i].name || 'P' + (i + 1)).slice(0, 8).toUpperCase(); r.tgt = null; r.sc = 0 }
    const col_ = n === 1 ? 0 : (slots[i] / (n - 1)) * 2 - 1
    r.x = xc(0) + col_ * w; r.z = -(i % 2) * 2.5; r.y = ground(r.x, r.z); r.lane = col_ * w * 0.8
    r.sk = isP ? 1 : CUR.ai * (0.97 + Math.random() * 0.06); r.aiDir = Math.random() < 0.5 ? -1 : 1
    SX.riders.push(r)
    if (isP) SX.P = r
  }
  SX.focus = SX.P
  SX.mode = 'ready'; SX.count = 3.4; SX.lastCount = 4
  G.mode = 'ssx'; engineEmit(); G.parts = []; G.pops = []
  camReset()
  music.set('race', ci); try { rev.on() } catch { /* ignore */ }
  say(CUR.name, '#3de8ff', 2.6)
  emitS()
}
function stop() { if (SX.net) { gameEnded('ssx'); SX.net = null } SX.mode = 'idle'; SX.paused = false; try { rev.off() } catch { /* ignore */ } music.set('menu'); emitS() }
function finishRace(timeUp) {
  const P = SX.P
  SX.mode = 'over'
  try { rev.off() } catch { /* ignore */ }
  music.stop()
  const time = SX.t
  let place = 1, placePts = 0, timeBonus = 0
  if (SX.kind === 'race') {
    place = SX.net ? 1 + SX.riders.filter((r) => r.remote && r.fin !== null && P.fin !== null && r.fin < P.fin).length : 1 + SX.riders.filter((r) => !r.isP && r.fin !== null).length
    placePts = [10000, 6000, 3500, 1800, 800, 300][place - 1] || 0
    timeBonus = Math.max(0, Math.round((CUR.par - time) * 150))
  }
  if (SX.net && SX.kind === 'trick') { place = 1 + SX.riders.filter((r) => r.remote && !r.gone && r.sc > SX.score).length; placePts = [6000, 3500, 1800, 800][place - 1] || 0 }
  const total = SX.score + placePts + timeBonus
  profile.ssxGames = (profile.ssxGames || 0) + 1
  if ((SX.kind === 'race' || SX.net) && place === 1) profile.ssxWins = (profile.ssxWins || 0) + 1
  const newBest = total > (profile.ssxBest || 0)
  profile.ssxBest = Math.max(profile.ssxBest || 0, total)
  profile.ssxTrick = Math.max(profile.ssxTrick || 0, SX.bestTrick)
  let bestTime = false
  if (SX.kind === 'race' && !timeUp) { const k = (profile.ssxTimes = profile.ssxTimes || {}); if (!k[CUR.id] || time < k[CUR.id]) { k[CUR.id] = Math.round(time * 10) / 10; bestTime = true } }
  recordScore('ssx', total); saveProfile()
  SX.over = { kind: SX.kind, course: CUR.name, place, total, tricks: SX.tricks, toks: SX.toks, bestTrick: SX.bestTrick, time, placePts, timeBonus, crashes: P.crashes, newBest, bestTime, win: SX.kind === 'race' ? place <= 3 : SX.tricks >= 20000 }
  sfx(SX.over.win ? 'win' : 'over')
  emitS()
}
function update(dtRaw) {
  const dt = Math.min(dtRaw, 1 / 30)
  if (SX.mode === 'idle' || SX.paused) return
  SX.clock += dt
  stepParticles(dt) // decays the screen shake and flash
  for (const q of SX.fx) { q.life -= dt; q.vy -= 14 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt }
  SX.fx = SX.fx.filter((q) => q.life > 0)
  if (SX.msg) { SX.msg.t -= dt; if (SX.msg.t <= 0) SX.msg = null }
  if (SX.text) { SX.text.t -= dt; if (SX.text.t <= 0) SX.text = null }
  const P = SX.P
  if (SX.mode === 'ready') {
    SX.count -= dt
    const ci = Math.ceil(SX.count)
    if (ci < SX.lastCount && ci >= 1) { SX.lastCount = ci; sfx('rBeep') }
    if (SX.count <= 0) { SX.mode = 'play'; sfx('rGo'); say('GO!', '#6aff9a', 1) }
    emitTick(dt)
    return
  }
  if (SX.mode === 'over') { emitTick(dt); return }
  SX.t += dt
  let inp = NOINP
  if (SX.mode === 'play') {
    inp = readInput()
    // boost meter and the uber trick
    const want = inp.boost
    inp.boostOn = false
    if (P.tricky > 0) { P.tricky -= dt; if (P.tricky <= 0) { P.tricky = 0; P.meter = 0 } }
    if (want && !P.boostPrev && !P.grounded && P.tricky > 0 && !P.uber && P.air > 0.25 && !P.grind) { P.uber = { t: 0, dur: 1.2 }; say('UBER TRICK!', '#ff4a8a', 1.4); sfx('mgBig') }
    else if (want && (P.meter > 0 || P.tricky > 0)) { inp.boostOn = true; if (P.tricky <= 0) { P.meter -= 24 * dt; if (P.meter <= 0) P.meter = 0 } }
    P.boostPrev = want
  }
  const lead = SX.riders.reduce((a, r) => (r.z > a.z ? r : a), SX.riders[0])
  for (const r of SX.riders) {
    if (r.isP) stepRider(r, inp, dt)
    else if (r.remote) remoteStep(r, dt)
    else {
      r.aiMul = clamp(1 + (P.z - r.z) * 0.0012, 0.95, 1.07)
      stepRider(r, aiInput(r, dt), dt)
    }
    if (r.z >= SX.len && r.fin === null) {
      r.fin = SX.t
      if (r.isP && SX.kind === 'race') { SX.mode = 'finish'; SX.finishT = 2.6; SX.waitT = 0; SX.place = 1 + SX.riders.filter((q) => !q.isP && q.fin !== null).length; sfx('rFinish'); say(SX.place === 1 ? 'YOU WIN!' : 'FINISH!  ' + SX.place + (['', 'ST', 'ND', 'RD'][SX.place] || 'TH'), '#ffe84a', 2.6) }
    }
  }
  void lead
  if (SX.kind === 'trick' && SX.mode === 'play') {
    SX.timeLeft -= dt
    if (SX.timeLeft <= 0) { SX.timeLeft = 0; SX.mode = 'finish'; SX.finishT = 2; SX.waitT = 0; sfx('rFinish'); say("TIME'S UP!", '#ffe84a', 2) }
  }
  if (SX.mode === 'finish') {
    SX.finishT -= dt
    if (SX.net) { SX.waitT = (SX.waitT || 0) + dt; const others = SX.riders.filter((q) => q.remote && !q.gone); const allDone = SX.kind === 'trick' ? SX.waitT > 4 : others.every((q) => q.fin !== null); if (SX.finishT <= 0 && (allDone || SX.waitT > 14)) { finishRace(SX.kind === 'trick'); return } }
    else if (SX.finishT <= 0) { finishRace(SX.kind === 'trick'); return }
  }
  // wind and board sound
  const spd = Math.hypot(P.vx, P.vz)
  try { rev.set(clamp(spd / 55, 0, 1) * (P.grounded ? 1 : 0.6), P.boosting ? 1 : 0, P.grounded && spd > 8 ? Math.abs(P.roll) * 1.4 + 0.15 : 0) } catch { /* ignore */ }
  sendState(dt)
  emitTick(dt)
}
function emitTick(dt) { SX.emitT -= dt; if (SX.emitT <= 0) { SX.emitT = 0.1; emitS() } }
function emitS() {
  const P = SX.P
  if (!P) { snap = { mode: SX.mode, paused: SX.paused }; subs.forEach((f) => f()); return }
  const order = [...SX.riders].sort((a, b) => b.z - a.z)
  snap = {
    mode: SX.mode, paused: SX.paused, kind: SX.kind, course: CUR.name, count: Math.max(0, Math.ceil(SX.count)), speed: Math.round(Math.hypot(P.vx, P.vz) * 3.3), boost: Math.round(P.meter), tricky: P.tricky > 0 ? Math.ceil(P.tricky) : 0, boosting: P.boosting,
    place: order.indexOf(P) + 1, total: SX.riders.length, time: SX.t, timeLeft: SX.timeLeft, score: SX.score, toks: SX.toks, msg: SX.msg, text: SX.text, crash: P.crash > 0, air: !P.grounded && !P.grind && P.air > 0.15,
    board: SX.net ? SX.riders.map((r) => ({ n: r.isP ? 'YOU' : r.name, c: r.def.jacket, sc: r.isP ? SX.score : r.sc | 0, f: r.fin, z: Math.round(r.z) })).sort((a, b) => (SX.kind === 'trick' ? b.sc - a.sc : b.z - a.z)) : null, online: !!SX.net,
    airPts: 0, grind: !!P.grind, over: SX.over, prog: SX.riders.map((r) => ({ p: clamp(r.z / SX.len, 0, 1), me: r.isP, c: r.def.jacket })), pct: clamp(P.z / SX.len, 0, 1), rider: P.name,
  }
  subs.forEach((f) => f())
}
function onKey(code) {
  if (SX.mode === 'idle') return
  if (code === 'Escape' || code === 'KeyP') { if (SX.mode === 'play' || SX.mode === 'ready') { SX.paused = !SX.paused; emitS() } return }
  if (SX.mode === 'over' && code === 'Enter') ssxActions.rematch()
}
export const ssxActions = {
  start, stop, quit() { toMenu() }, resume() { SX.paused = false; emitS() },
  pause() { if (!SX.net && (SX.mode === 'play' || SX.mode === 'ready') && !SX.paused) { SX.paused = true; emitS(); return true } return false },
  rematch() { if (SX.net) { if (SX.net.role === 'host') SX.net.restart(); else SX.net.sendHost({ k: 'rematch' }); return } start({ course: SX.ci, kind: SX.kind, rider: SX.rid }) },
  press(name, on) { TK[name] = on },
  setPrefs(o) { if (o.course !== undefined) profile.ssxCourse = o.course; if (o.kind) profile.ssxKind = o.kind; if (o.rider !== undefined) profile.ssxPick = o.rider; saveProfile() },
}

// ------------------------------------------------------------------ online: every rider is simulated on their own device; the others are shown as live ghosts
let netT = 0
const r2 = (v) => Math.round(v * 100) / 100
function sendState(dt) {
  if (!SX.net || !SX.P) return
  netT -= dt
  if (netT > 0) return
  netT = 0.066
  const r = SX.P
  SX.net.send({ k: 'p', s: [r2(r.x), r2(r.y), r2(r.z), r2(r.vx), r2(r.vy), r2(r.vz), r2(r.hd), r2(r.spin), r2(r.pitch), r2(r.roll), r2(r.cr), r.grounded ? 1 : 0, r.grind ? 1 : 0, r.crash > 0 ? 1 : 0, r.fin === null ? -1 : r2(r.fin), SX.score, r2(r.tumble), r.boosting ? 1 : 0] })
}
function remoteStep(r, dt) {
  const t = r.tgt
  if (t) {
    const k = Math.min(1, dt * 12)
    if (Math.hypot(r.x - t[0], r.z - t[2]) > 30) { r.x = t[0]; r.y = t[1]; r.z = t[2] } else { r.x += (t[0] - r.x) * k + t[3] * dt * 0.4; r.y += (t[1] - r.y) * k; r.z += (t[2] - r.z) * k + t[5] * dt * 0.4 }
    r.vx = t[3]; r.vy = t[4]; r.vz = t[5]; r.hd = t[6]; r.spin = t[7]; r.pitch = t[8]; r.roll = t[9]; r.cr = t[10]; r.grounded = !!t[11]; r.grind = t[12] ? {} : null; r.crash = t[13] ? 1 : 0; r.tumble = t[16]; r.boosting = !!t[17]
    if (t[14] >= 0 && r.fin === null) r.fin = t[14]
    r.sc = t[15]
  }
  r.t += dt
  if (r.grounded && Math.hypot(r.vx, r.vz) > 8 && Math.random() < dt * 14) spawnFx(r.x, r.y + 0.1, r.z, 1, CUR.night ? [0.8, 0.9, 1.4] : [1, 1, 1.1], 3, 2, 0.5, 0.26)
}
registerNet('ssx', {
  min: 2,
  begin(ctx) {
    const picks = {}
    picks[ctx.players[ctx.me].id] = profile.ssxPick | 0
    start({ course: ctx.opts.course | 0, kind: ctx.opts.kind === 'trick' ? 'trick' : 'race', rider: profile.ssxPick | 0, net: { players: ctx.players, me: ctx.me, picks, role: ctx.role, send: (d) => ctx.send(d), sendHost: (d) => ctx.sendHost(d), restart: () => ctx.restart() } })
    ctx.send({ k: 'hi', rid: profile.ssxPick | 0 })
  },
  active: () => !!SX.net && SX.mode !== 'idle',
  onMsg(d, from) {
    if (!d || !SX.net) return
    const r = SX.riders.find((q) => q.pid === from)
    if (d.k === 'hi' && r) { SX.net.picks[from] = clamp(d.rid | 0, 0, RIDERS.length - 1); r.def = RIDERS[SX.net.picks[from]]; r.st = r.def }
    else if (d.k === 'p' && r && Array.isArray(d.s) && d.s.length >= 17) r.tgt = d.s.map((v) => (Number.isFinite(+v) ? +v : 0))
    else if (d.k === 'rematch' && SX.net.role === 'host' && SX.mode === 'over') SX.net.restart()
  },
  onLeave(cid) { const r = SX.riders.find((q) => q.pid === cid); if (r) { r.gone = true; r.fin = r.fin === null ? 1e9 : r.fin; r.z = -9999 } },
})
// ------------------------------------------------------------------ camera, lights, terrain
const CAM = { x: 0, y: 10, z: 0, hd: 0 }
function camReset() {
  const P = SX.P; if (!P) return
  CAM.hd = 0; CAM.x = P.x; CAM.z = P.z - 12; CAM.y = P.y + 5
}
function camera(aspect, dt) {
  const P = SX.focus || SX.P
  if (!P) return { x: 0, y: 20, z: 20, tx: 0, ty: 0, tz: 0, fov: 60, far: 300 }
  const spd = Math.hypot(P.vx, P.vz)
  if (SX.mode === 'ready') { CAM.hd += (0.0 - CAM.hd) * Math.min(1, dt * 4) } else {
    const target = spd > 6 ? Math.atan2(P.vx, P.vz) : P.hd
    CAM.hd += angDiff(target, CAM.hd) * Math.min(1, dt * 3.0)
  }
  const sh = Math.sin(CAM.hd), ch = Math.cos(CAM.hd)
  const d = (SX.mode === 'ready' ? 7 : 8.2) + spd * 0.05 + (P.crash > 0 ? 3 : 0)
  const h = 3.3 + (P.grounded ? 0 : 1.4) + (SX.mode === 'ready' ? -0.5 : 0)
  const gx = P.x - sh * d, gz = P.z - ch * d
  const k = Math.min(1, dt * 9)
  CAM.x += (gx - CAM.x) * k; CAM.z += (gz - CAM.z) * k
  CAM.y += (P.y + h - CAM.y) * Math.min(1, dt * 5)
  const gm = ground(CAM.x, CAM.z) + 1.8
  if (CAM.y < gm) CAM.y = gm
  const sk = G.shake || 0
  return { x: CAM.x + (Math.random() - 0.5) * sk, y: CAM.y + (Math.random() - 0.5) * sk, z: -CAM.z, tx: P.x + sh * 7, ty: P.y + 1.2, tz: -(P.z + ch * 7), fov: 56 + spd * 0.4 + (P.boosting ? 8 : 0), far: 240, aspect }
}
function lights() {
  const P = SX.focus || SX.P, c = CUR
  const px = P ? P.x : 0, py = P ? P.y : 0, pz = P ? P.z : 0
  return {
    sun: { x: px - 35, y: py + 60, z: -pz + 25, color: c.sun, intensity: c.sunI }, ambient: c.amb, dir: 0.25, shadow: false, target: { x: px, z: -pz },
    lantern: { x: px, y: py + 4, z: -pz + 3, color: c.night ? '#ffd9a0' : '#ffffff', intensity: c.night ? 2.2 : 0, distance: 55 },
  }
}
function terrain(pos, colr, NX, NZ) {
  const P = SX.focus || SX.P, c = CUR
  const zf = P ? P.z : 0, z0 = Math.floor((zf - 16) / DZ) * DZ, W = c.pipe ? 38 : 56
  const sn = c.snow, nk = c.night ? 0.8 : 1
  const row0 = Math.round(z0 / DZ)
  for (let j = 0; j < NZ; j++) {
    const z = z0 + j * DZ, cx = xc(z)
    const stripe = (Math.floor(z / 7) & 1) * 0.03
    for (let i = 0; i < NX; i++) {
      const u = (i / (NX - 1)) * 2 - 1, dx = Math.sign(u) * Math.pow(Math.abs(u), 1.45) * W, ad = Math.abs(dx)
      const h = groundDX(dx, z)
      const o = (j * NX + i) * 3
      pos[o] = cx + dx; pos[o + 1] = h; pos[o + 2] = -z
      const nz = (hash(i, row0 + j) - 0.5) * 0.05
      let k = 1 + nz
      let r = sn[0], g = sn[1], b = sn[2]
      if (c.pipe) {
        const t = clamp((ad - 3.5) / 10, 0, 1)
        r *= 1 - t * 0.12; g *= 1 - t * 0.04; b *= 1
        k *= 1 - (ad > 14 ? 0.1 : 0) + stripe * (ad < 4 ? 1 : 0)
      } else if (ad > c.hw) {
        const t = clamp((ad - c.hw) / 12, 0, 1)
        k *= 0.9 - t * 0.12; r *= 0.94; g *= 0.97
      } else k += stripe
      if (KA > 0.2) { const q = KA * 0.9; r = r * (1 - q) + 0.74 * q; g = g * (1 - q) + 0.92 * q; b = b * (1 - q) + 1.0 * q; k *= 1.06 }
      colr[o] = r * k * nk; colr[o + 1] = g * k * nk; colr[o + 2] = b * k * nk
    }
  }
}

// ------------------------------------------------------------------ drawing
const mm = (A, B) => [
  A[0] * B[0] + A[1] * B[3] + A[2] * B[6], A[0] * B[1] + A[1] * B[4] + A[2] * B[7], A[0] * B[2] + A[1] * B[5] + A[2] * B[8],
  A[3] * B[0] + A[4] * B[3] + A[5] * B[6], A[3] * B[1] + A[4] * B[4] + A[5] * B[7], A[3] * B[2] + A[4] * B[5] + A[5] * B[8],
  A[6] * B[0] + A[7] * B[3] + A[8] * B[6], A[6] * B[1] + A[7] * B[4] + A[8] * B[7], A[6] * B[2] + A[7] * B[5] + A[8] * B[8]]
const RX = (a) => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c] }
const RZ = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1] }
const HF = (hd) => { const s = Math.sin(hd), c = Math.cos(hd); return [c, 0, -s, 0, 1, 0, s, 0, c] }
const ID = [1, 0, 0, 0, 1, 0, 0, 0, 1]
function limb(api, a, b, w, c) {
  let dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2]
  const len = Math.hypot(dx, dy, dz) || 1e-3
  dx /= len; dy /= len; dz /= len
  let hx = 0, hy = 1, hz = 0
  if (Math.abs(dy) > 0.92) { hx = 1; hy = 0 }
  let xx = hy * dz - hz * dy, xy = hz * dx - hx * dz, xz = hx * dy - hy * dx
  const xl = Math.hypot(xx, xy, xz) || 1; xx /= xl; xy /= xl; xz /= xl
  const zx = xy * dz - xz * dy, zy = xz * dx - xx * dz, zz = xx * dy - xy * dx
  api.putM((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, w, len, w, [xx, dx, zx, xy, dy, zy, xz, dz, zz], c[0], c[1], c[2])
}
function drawRider(api, r, t) {
  const { putM } = api
  const crashed = r.crash > 0
  const yaw = r.hd + r.spin + (crashed ? r.tumble * 0.6 : 0)
  const pitch = r.tilt + r.pitch + (crashed ? Math.sin(r.tumble * 0.9) * 1.1 : 0)
  const roll = r.roll + (crashed ? Math.cos(r.tumble) * 0.9 : 0)
  const M = mm(mm(HF(yaw), RX(pitch)), RZ(roll))
  const bx = r.x, by = r.y, bz = -r.z
  const L = (lx, ly, lz) => [bx + M[0] * lx + M[1] * ly + M[2] * lz, by + M[3] * lx + M[4] * ly + M[5] * lz, bz + M[6] * lx + M[7] * ly + M[8] * lz]
  const d = r.def, cr = r.cr, blink = r.inv > 0 && Math.floor(t * 14) % 2 === 0
  if (blink) return
  const jk = hex(d.jacket, 1.1), pn = hex(d.pants), bd = hex(d.board, 1.15), sk = hex(d.skin), hl = hex(d.helmet, 1.1)
  const grab = r.grabT > 0.05 && !r.grounded
  const bo = (r.grounded ? 0 : 0.12) + (grab ? 0.32 : 0.1 * cr) + (r.grind ? 0.0 : 0)
  // shadow blob on the snow
  if (!r.grind) { const gy = ground(r.x, r.z), hgt = Math.max(0, r.y - gy), sz = Math.max(0.5, 1.9 - hgt * 0.12); putM(r.x, gy + 0.06, bz, 0.9 * sz, 0.04, 2.3 * sz, HF(r.hd), 0.5, 0.58, 0.74) }
  // board
  putM(...L(0, 0.12 + bo, 0), 0.62, 0.13, 2.7, M, bd[0], bd[1], bd[2])
  putM(...L(0, 0.2 + bo, 0), 0.5, 0.05, 1.5, M, 0.12, 0.12, 0.18)
  putM(...L(0, 0.2 + bo, -1.4), 0.55, 0.13, 0.45, mm(M, RX(0.35)), bd[0], bd[1], bd[2])
  putM(...L(0, 0.2 + bo, 1.4), 0.55, 0.13, 0.45, mm(M, RX(-0.35)), bd[0], bd[1], bd[2])
  // legs and boots
  const hipY = 0.5 + bo + (0.78 - 0.34 * cr)
  for (const s of [-1, 1]) {
    const foot = [0, 0.3 + bo, s * 0.55], hip = [0, hipY, s * 0.2]
    const knee = [0.16 + 0.34 * cr, (foot[1] + hip[1]) / 2 + 0.05, (foot[2] + hip[2]) / 2 + s * 0.08]
    putM(...L(0, 0.27 + bo, s * 0.55), 0.38, 0.22, 0.55, M, 0.1, 0.1, 0.14)
    limb(api, L(...foot), L(...knee), 0.27, pn); limb(api, L(...knee), L(...hip), 0.27, pn)
  }
  // torso, head
  const tors = 0.86 - 0.1 * cr
  const tc = L(0.03 + 0.06 * cr, hipY + tors / 2, 0)
  putM(tc[0], tc[1], tc[2], 0.44, tors, 0.82, mm(M, RX(0)), jk[0], jk[1], jk[2])
  putM(...L(0.03 + 0.06 * cr, hipY + 0.1, 0), 0.47, 0.16, 0.85, M, pn[0] * 1.4, pn[1] * 1.4, pn[2] * 1.4)
  const hy = hipY + tors + 0.3
  putM(...L(0.08 + 0.08 * cr, hy, 0), 0.46, 0.46, 0.46, M, sk[0], sk[1], sk[2])
  putM(...L(0.06 + 0.08 * cr, hy + 0.17, 0), 0.54, 0.26, 0.54, M, hl[0], hl[1], hl[2])
  putM(...L(0.33 + 0.08 * cr, hy + 0.04, 0), 0.07, 0.15, 0.4, M, 0.05, 0.05, 0.12)
  putM(...L(0.375 + 0.08 * cr, hy + 0.04, 0), 0.03, 0.09, 0.32, M, 0.4, 1.4, 2.0)
  // arms
  const sy = hipY + tors - 0.12
  for (const s of [-1, 1]) {
    const sh = [0.03 + 0.06 * cr, sy, s * 0.5]
    let hand
    if (grab && ((r.grabIdx & 7) % 2 === 0 ? s === 1 : s === -1)) hand = [0.3, 0.3 + bo, s * 0.15]
    else if (r.grind) hand = [0.1, sy - 0.5, s * (0.5 + 0.75 + Math.sin(t * 6 + s) * 0.1)]
    else if (r.grounded) { const sw = 0.55 + Math.sin(t * 3 + s) * 0.08 + Math.abs(r.roll) * 0.5; hand = [0.12, sy - 0.62, s * (0.5 + 0.62 * sw)] }
    else hand = [0.1, sy - 0.1 + Math.sin(t * 7 + s) * 0.1, s * (0.5 + 0.95)]
    limb(api, L(...sh), L(...hand), 0.23, jk)
    const h2 = L(...hand); putM(h2[0], h2[1], h2[2], 0.24, 0.24, 0.24, M, 0.15, 0.15, 0.2)
  }
}
function drawTree(api, x, y, z, s, h, night) {
  const { put3 } = api
  const g = night ? 0.06 : 0.08, gg = night ? 0.2 : 0.38
  put3(x, y + 0.7 * s, z, 0.55 * s, 1.5 * s, 0.55 * s, 0, 0.3, 0.2, 0.12, h * 6)
  put3(x, y + 2.0 * s, z, 3.4 * s, 1.5 * s, 3.4 * s, 0, g, gg, 0.12, h * 6)
  put3(x, y + 3.2 * s, z, 2.5 * s, 1.5 * s, 2.5 * s, 0, g, gg + 0.04, 0.14, h * 6 + 0.3)
  put3(x, y + 4.4 * s, z, 1.6 * s, 1.5 * s, 1.6 * s, 0, g, gg + 0.08, 0.16, h * 6 + 0.6)
  put3(x, y + 5.3 * s, z, 0.8 * s, 0.5 * s, 0.8 * s, 0, 0.9, 0.95, 1.0, h * 6)
}
function draw3(api) {
  const { put3, putM } = api, t = SX.clock, c = CUR
  const P = SX.focus || SX.P
  if (!P) return
  const z0 = P.z - 14, z1 = P.z + 140
  const night = c.night
  // trees
  if (c.trees) {
    const cs = 8
    for (let ci = Math.floor(z0 / cs); ci <= Math.floor(z1 / cs); ci++) {
      for (let k = 0; k < 2; k++) {
        const h1 = hash(ci, k * 7 + 1)
        if (h1 > c.trees * 0.7) continue
        const side = hash(ci, k * 7 + 2) < 0.5 ? -1 : 1, off = c.hw + 5 + hash(ci, k * 7 + 3) * 16, z = ci * cs + hash(ci, k * 7 + 4) * cs
        const x = xc(z) + side * off, s = 0.8 + hash(ci, k * 7 + 5) * 0.9
        drawTree(api, x, groundDX(side * off, z), -z, s, hash(ci, k * 7 + 6), night)
      }
    }
  }
  // edge poles and gates
  const pg = 12
  for (let z = Math.ceil(z0 / pg) * pg; z < z1; z += pg) {
    if (z < 0) continue
    for (const s of [-1, 1]) {
      const off = c.pipe ? 3.2 : c.hw + 0.3, x = xc(z) + s * (c.pipe ? 3.0 : c.hw), y = groundDX(s * off, z)
      if (c.pipe) { put3(xc(z) + s * 14.3, groundDX(s * 14.3, z) + 1.2, -z, 0.3, 2.4, 0.3, 0, night ? 0.4 : 0.9, 1.6, 2.2, 0) } else {
        put3(x, y + 1.1, -z, 0.26, 2.2, 0.26, 0, 0.55, 0.55, 0.62, 0)
        put3(x, y + 2.3, -z, 0.36, 0.3, 0.36, 0, s < 0 ? 2.0 : 0.3, s < 0 ? 0.3 : 0.9, s < 0 ? 0.3 : 2.0, 0)
      }
    }
  }
  const arch = (z, wide, checker) => {
    const x0 = xc(z), hw = wide
    for (const s of [-1, 1]) put3(x0 + s * hw, groundDX(s * hw, z) + 3.5, -z, 0.7, 7, 0.7, 0, 0.35, 0.35, 0.45, 0)
    const yb = Math.max(groundDX(-hw, z), groundDX(hw, z)) + 7.2
    if (checker) for (let i = 0; i < Math.floor(hw * 2); i++) put3(x0 - hw + 0.5 + i, yb, -z, 1, 1.2, 0.8, 0, i % 2 ? 0.1 : 1.6, i % 2 ? 0.1 : 1.6, i % 2 ? 0.12 : 1.6, 0)
    else put3(x0, yb, -z, hw * 2, 1.1, 0.8, 0, 0.2, 1.2, 2.2, 0)
  }
  const aw = c.pipe ? 6 : c.hw + 1
  if (z0 < 12) arch(0, aw, true)
  if (SX.len - 20 < z1 && SX.kind === 'race') arch(SX.len, aw, true)
  for (const g of F.gates) if (g > z0 && g < z1) arch(g, aw, false)
  // kickers: side flags and chevrons
  for (const k of F.kick) {
    if (k.z + k.len < z0) continue
    if (k.z > z1) break
    const z = k.z + k.len, x0 = xc(z) + k.dx
    for (const s of [-1, 1]) { const xx = x0 + s * (k.w + 0.6), gy = groundDX(xx - xc(z), z); put3(xx, gy + 1.4, -z, 0.22, 2.8, 0.22, 0, 0.5, 0.5, 0.6, 0); put3(xx - s * 0.35, gy + 2.6, -z, 0.7, 0.5, 0.1, 0, s < 0 ? 2 : 0.3, s < 0 ? 0.4 : 1.2, s < 0 ? 0.4 : 2, 0) }
    const sl = Math.atan((k.h / k.len) * 1.15)
    for (let i = 0; i < 3; i++) {
      const zz = k.z + k.len * (0.25 + i * 0.25), xx = x0, gy = ground(xx, zz)
      const pulse = 0.6 + 0.6 * Math.sin(t * 6 - i * 1.2)
      putM(xx, gy + 0.12, -zz, k.w * 1.2, 0.08, 0.7, mm(HF(0), RX(sl)), 0.2 * pulse, 1.4 * pulse + 0.3, 2.0 * pulse + 0.3)
    }
  }
  // rails
  for (const rl of F.rails) {
    if (rl.z1 < z0) continue
    if (rl.z0 > z1) break
    for (let z = rl.z0; z < rl.z1; z += 4) {
      const a = [xc(z) + rl.dx, ground(xc(z) + rl.dx, z) + RAIL_H, -z], b = [xc(z + 4) + rl.dx, ground(xc(z + 4) + rl.dx, z + 4) + RAIL_H, -(z + 4)]
      limb(api, a, b, 0.3, night ? [0.4, 1.8, 2.2] : [1.0, 1.2, 1.5])
      if (((z - rl.z0) / 4) % 2 === 0) put3(a[0], (ground(a[0], z)) + RAIL_H / 2 - 0.1, -z, 0.16, RAIL_H, 0.16, 0, 0.4, 0.4, 0.5, 0)
    }
  }
  // rocks
  for (let i = lowerBound(F.rocks, z0); i < F.rocks.length; i++) {
    const k = F.rocks[i]
    if (k.z > z1) break
    const x = xc(k.z) + k.dx, y = ground(x, k.z)
    put3(x, y + k.r * 0.4, -k.z, k.r * 1.9, k.r * 1.3, k.r * 1.7, 0, 0.36, 0.38, 0.44, k.z)
    put3(x + 0.3, y + k.r * 0.95, -k.z, k.r * 1.1, k.r * 0.7, k.r * 1.0, 0, 0.9, 0.95, 1.0, k.z + 0.5)
  }
  // boost pads
  for (const p of F.pads) {
    if (p.z < z0) continue
    if (p.z > z1) break
    const x = xc(p.z) + p.dx, y = ground(x, p.z), sl = Math.atan((ground(x, p.z + 1.5) - ground(x, p.z - 1.5)) / 3)
    const m = mm(HF(0), RX(sl))
    putM(x, y + 0.1, -p.z, 4.6, 0.12, 5, m, 0.1, 0.5, 0.9)
    for (let i = 0; i < 3; i++) { const pl = 0.5 + 0.5 * Math.sin(t * 8 - i * 1.3); putM(x, y + 0.2, -(p.z + (i - 1) * 1.4), 2.4 - i * 0.3, 0.08, 0.5, m, 0.2 * pl + 0.2, 1.6 * pl + 0.4, 2.4 * pl + 0.4) }
  }
  // tokens
  for (const k of F.toks) {
    if (k.got) continue
    if (k.z < z0) continue
    if (k.z > z1) break
    const x = xc(k.z) + k.dx, y = ground(x, k.z) + k.up
    putM(x, y + Math.sin(t * 4 + k.z) * 0.15, -k.z, 0.8, 0.8, 0.16, HF(t * 3 + k.z), 2.4, 1.8, 0.3)
  }
  // riders
  for (const r of SX.riders) if (r.z > z0 - 10 && r.z < z1) drawRider(api, r, t)
  // name tag marker above the opponents
  for (const r of SX.riders) { if (r.isP || r.z < P.z - 10 || r.z > P.z + 90) continue; put3(r.x, r.y + 3.4, -r.z, 0.5, 0.5, 0.5, 0, ...hex(r.def.jacket, 1.8), t * 3) }
  // snow spray and speed lines
  for (const q of SX.fx) { const f = q.life / q.max, s = q.s * (0.4 + 0.6 * f); put3(q.x, q.y, -q.z, s, s, s, 0, q.c[0], q.c[1], q.c[2], q.life * 4) }
  const sp = Math.hypot(P.vx, P.vz)
  if (sp > 36 && SX.mode !== 'over') {
    const n = Math.min(14, Math.floor((sp - 30) * 0.6))
    for (let i = 0; i < n; i++) {
      const a = hash(i, 91) * TAU, rr = 2.5 + hash(i, 92) * 5, zz = P.z + 4 + ((hash(i, 93) * 40 - t * 70) % 40 + 40) % 40
      put3(P.x + Math.cos(a) * rr, P.y + 1.6 + Math.sin(a) * rr * 0.6, -zz, 0.06, 0.06, 2.4 + sp * 0.04, 0, 1.4, 1.5, 1.7, 0)
    }
  }
}
export function snowTest() { return { ground, xc, F, CUR, terrain } }
if (typeof window !== 'undefined') { window.__SX = SX; window.__ssx = ssxActions; window.__snow = snowTest }
games.ssx = { update, onKey, draw() {}, draw3, camera, lights, fog: () => ({ fog: CUR.fog, fogNear: 38, fogFar: 140 }), terrain, stop, sky: () => CUR.sky }
