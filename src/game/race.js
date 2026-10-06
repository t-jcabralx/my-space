// TURBO RUSH: a 3D arcade racer. 5 tracks, 6 cars, drifting with mini-turbos, nitro, boost pads, AI rivals and lap records.
// Pure JS simulation (testable headlessly); drawn as lit 3D boxes through Scene.jsx (draw3) with a chase camera.
import { G, keys, games, profile, saveProfile, recordScore, toMenu } from './engine.js'
import { rgb } from './sprites.js'
import { sfx, music, speak, rev } from './audio.js'

const R = (a, b) => a + Math.random() * (b - a)
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
const TAU = Math.PI * 2
const rng = (seed) => { let s = seed >>> 0; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296 }
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d }

// ---------- tracks ----------
export const TRACKS = [
  { id: 'sunset', name: 'SUNSET CIRCUIT', desc: 'Fast and flowing. A perfect first lap.', w: 30, sky: '#ff9a5a', fog: '#ffb98a', ground: '#3c6a3a', road: '#2a2c36', accent: '#ffd23a', scenery: 'trees', laps: 3,
    pts: [[0, -300], [200, -260], [300, -100], [260, 100], [120, 230], [-60, 280], [-230, 200], [-300, 40], [-250, -140], [-120, -260]] },
  { id: 'neon', name: 'NEON CITY', desc: 'Sharp turns between glowing towers.', w: 26, sky: '#1a1040', fog: '#2a1a60', ground: '#14122a', road: '#1a1a24', accent: '#ff4de1', scenery: 'city', laps: 3,
    pts: [[0, -280], [180, -280], [250, -180], [180, -80], [250, 40], [200, 200], [40, 260], [-80, 180], [-60, 60], [-200, 40], [-280, -80], [-200, -220]] },
  { id: 'valley', name: 'GREEN VALLEY', desc: 'Long sweeping bends, big speed.', w: 32, sky: '#7ad0ff', fog: '#cfeeff', ground: '#4c8a3c', road: '#33353d', accent: '#7dff5a', scenery: 'trees', laps: 3,
    pts: [[-100, -320], [100, -320], [280, -200], [320, 0], [200, 160], [240, 300], [60, 340], [-100, 260], [-60, 120], [-220, 100], [-320, -60], [-280, -220]] },
  { id: 'ice', name: 'ICE PEAK', desc: 'Slippery hairpins and frozen pines.', w: 28, sky: '#9fd8ff', fog: '#e6f6ff', ground: '#dfeaf2', road: '#3a4252', accent: '#5ad8ff', scenery: 'snow', laps: 3,
    pts: [[-300, -220], [250, -260], [330, -100], [140, -40], [310, 80], [300, 240], [100, 310], [-60, 170], [-250, 290], [-340, 90], [-170, -60]] },
  { id: 'desert', name: 'DESERT RUN', desc: 'Wide dunes and a long back straight.', w: 34, sky: '#ffd49a', fog: '#ffe6bf', ground: '#d8b070', road: '#4a423a', accent: '#ff6a2a', scenery: 'cacti', laps: 3,
    pts: [[0, -330], [220, -300], [330, -120], [300, 120], [160, 260], [-20, 200], [-80, 300], [-250, 320], [-340, 150], [-300, -80], [-180, -250]] },
]

function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t
  return [0, 1].map((i) => 0.5 * ((2 * p1[i]) + (-p0[i] + p2[i]) * t + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t2 + (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t3))
}
const built = {}
export function buildTrack(ti) {
  if (built[ti]) return built[ti]
  const T = TRACKS[ti], c = T.pts, n = c.length
  const raw = []
  for (let i = 0; i < n; i++) for (let k = 0; k < 24; k++) raw.push(catmull(c[(i + n - 1) % n], c[i], c[(i + 1) % n], c[(i + 2) % n], k / 24))
  // resample at an even spacing
  const DS = 6
  let total = 0
  const segs = raw.map((p, i) => { const q = raw[(i + 1) % raw.length]; const d = Math.hypot(q[0] - p[0], q[1] - p[1]); total += d; return d })
  const N = Math.round(total / DS), step = total / N
  const P = []
  let acc = 0, idx = 0
  for (let k = 0; k < N; k++) {
    const target = k * step
    while (acc + segs[idx] < target) { acc += segs[idx]; idx = (idx + 1) % raw.length }
    const u = (target - acc) / segs[idx], a = raw[idx], b = raw[(idx + 1) % raw.length]
    P.push({ x: a[0] + (b[0] - a[0]) * u, z: a[1] + (b[1] - a[1]) * u, s: k * step })
  }
  for (let i = 0; i < N; i++) {
    const a = P[(i + N - 1) % N], b = P[(i + 1) % N]
    const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1
    P[i].dx = dx / l; P[i].dz = dz / l; P[i].nx = -P[i].dz; P[i].nz = P[i].dx
  }
  for (let i = 0; i < N; i++) { const a = P[i], b = P[(i + 1) % N]; P[i].k = angDiff(Math.atan2(b.dx, -b.dz), Math.atan2(a.dx, -a.dz)) / step }
  built[ti] = { T, P, N, len: N * step, step, W: T.w }
  return built[ti]
}
// fast checks used by the tests: the loop never touches itself
export function trackClearance(ti) {
  const { P, N, W } = buildTrack(ti)
  let min = 1e9
  for (let i = 0; i < N; i += 2) for (let j = i + 1; j < N; j += 2) {
    const dd = Math.min(j - i, N - (j - i))
    if (dd < 40) continue
    min = Math.min(min, Math.hypot(P[i].x - P[j].x, P[i].z - P[j].z))
  }
  return { min, need: W + 14 }
}

// ---------- cars ----------
export const CARS = [
  { id: 0, name: 'FALCON', color: '#ff3b4e', top: 1.0,  acc: 1.0,  han: 1.0,  grip: 1.0,  nitro: 1.0,  mass: 1.0, drift: 1.0, desc: 'Balanced all-rounder' },
  { id: 1, name: 'COMET',  color: '#3d7bff', top: 1.1,  acc: 0.92, han: 0.88, grip: 0.92, nitro: 1.0,  mass: 1.0, drift: 0.9, desc: 'Highest top speed, wide turns' },
  { id: 2, name: 'BEE',    color: '#ffe84a', top: 0.93, acc: 1.18, han: 1.1,  grip: 1.15, nitro: 0.9,  mass: 0.85, drift: 1.0, desc: 'Fast off the line, grippy' },
  { id: 3, name: 'TANK',   color: '#3dff7a', top: 0.95, acc: 0.9,  han: 0.95, grip: 1.1,  nitro: 1.0,  mass: 1.6, drift: 0.85, desc: 'Heavy: wins every bump' },
  { id: 4, name: 'GHOST',  color: '#b04dff', top: 1.0,  acc: 1.0,  han: 1.05, grip: 0.9,  nitro: 1.0,  mass: 1.0, drift: 1.5, desc: 'Drift master: bigger mini-turbos' },
  { id: 5, name: 'FLARE',  color: '#ff9a2e', top: 1.0,  acc: 0.98, han: 0.98, grip: 1.0,  nitro: 1.45, mass: 1.0, drift: 1.0, desc: 'Huge nitro tank' },
]
const DIFF = [{ name: 'EASY', skill: 0.8, rb: 0.5 }, { name: 'MEDIUM', skill: 0.92, rb: 0.8 }, { name: 'HARD', skill: 1.02, rb: 1.0 }]
const BASE_TOP = 78, BASE_ACC = 34

// ---------- state ----------
export const RC = { mode: 'idle', paused: false, phase: 'select', cfg: { track: 0, car: 0, laps: 3, diff: 2, ai: 5, type: 'race' }, tk: null, cars: [], pads: [], cans: [], fx: [], t: 0, phaseT: 0, count: 3.4, lastCount: 4, timer: 0, results: null, emitT: 0, msg: null, shake: 0, net: null, me: 0 }
let snap = null
const subs = new Set()
export const subscribeRace = (f) => { subs.add(f); return () => subs.delete(f) }
export const getRaceSnap = () => snap

function mkCar(i, carId, human, name) {
  const st = CARS[carId]
  return { i, carId, st, human, name, x: 0, z: 0, th: 0, vx: 0, vz: 0, sp: 0, steer: 0, nitro: 30, boostT: 0, driftT: 0, charge: 0, drifting: false, prog: 0, lastS: 0, idx: 0, lat: 0, lap: 1, best: 0, lapStart: 0, lapTimes: [], finished: false, finishT: 0, rank: 0, off: false, cp: 0,
    inp: { thr: 0, brk: 0, steer: 0, drift: false, nitro: false }, wrong: 0, bump: 0, lane: 0, aiT: 0, hit: 0, padCd: {}, lights: 0, color: st.color, skill: 1 }
}
export function startRace(cfg = {}) {
  RC.cfg = { track: 0, car: 0, laps: 3, diff: 2, ai: 5, type: 'race', seed: (Math.random() * 1e9) | 0, humans: null, ...cfg }
  const c = RC.cfg
  if (c.type !== 'online') RC.net = null
  RC.tk = buildTrack(c.track)
  const { P, N, W } = RC.tk
  const rs = rng(c.seed || 1)
  const humans = c.humans && c.humans.length ? c.humans : [c.car]
  const nh = c.type === 'demo' ? 0 : humans.length
  const total = Math.max(nh + c.ai, 2)
  RC.cars = []
  const names = ['YOU', 'RIO', 'KAI', 'NOVA', 'MAX', 'ZED', 'LUNA', 'ACE', 'TOBI', 'MIKA']
  const used = new Set(humans.slice(0, nh))
  const pool = CARS.map((x) => x.id).filter((id) => !used.has(id))
  for (let i = 0; i < total; i++) {
    const human = i < nh
    const carId = human ? humans[i] : pool[(i - nh) % pool.length]
    const car = mkCar(i, carId, human && i === 0, human ? (i === 0 ? 'YOU' : 'P' + (i + 1)) : names[(i + 1) % names.length])
    car.humanSeat = human
    car.skill = DIFF[c.diff - 1].skill * (0.95 + rs() * 0.09)
    car.lane = ((i % 2) ? 1 : -1) * (0.1 + rs() * 0.22)
    RC.cars.push(car)
  }
  // starting grid: two columns behind the line, the player in the second row
  const order = RC.cars.map((x) => x.i).map((v) => [rs(), v]).sort((a, b) => a[0] - b[0]).map((x) => x[1])
  if (nh) { order.sort((a, b) => (a < nh ? 0 : 1) - (b < nh ? 0 : 1)); const mine = order.splice(0, nh); order.splice(Math.min(2, order.length), 0, ...mine) }
  order.forEach((ci, slot) => {
    const car = RC.cars[ci], row = Math.floor(slot / 2), side = slot % 2 ? 1 : -1
    const j = ((-(9 + row * 12) / RC.tk.step) | 0)
    const p = P[((j % N) + N) % N]
    car.x = p.x + p.nx * side * W * 0.22; car.z = p.z + p.nz * side * W * 0.22
    car.th = Math.atan2(p.dx, -p.dz); car.idx = ((j % N) + N) % N
    car.prog = -(9 + row * 12); car.lastS = p.s
  })
  RC.pads = []
  for (let k = 1; k <= 5; k++) { const j = Math.floor((k / 6) * N + 7) % N; RC.pads.push({ idx: j, lat: ((k % 3) - 1) * W * 0.22 }) }
  RC.cans = []
  const r = rng(c.track * 977 + 13)
  for (let k = 0; k < 9; k++) { const j = Math.floor(((k + 0.5) / 9) * N); RC.cans.push({ idx: j, lat: (r() - 0.5) * W * 0.6, t: 0 }) }
  RC.fx = []; RC.results = null; RC.paused = false; RC.t = 0; RC.timer = 0; RC.shake = 0
  RC.me = 0
  G.mode = 'race'; G.parts = []; G.pops = []; G.shake = 0; G.flash = 0
  RC.mode = 'play'; RC.phase = 'ready'; RC.phaseT = 0; RC.count = 3.4; RC.lastCount = 4
  RC.msg = { text: TRACKS[c.track].name, sub: `${c.laps} LAPS · ${DIFF[c.diff - 1].name}`, t: 2 }
  music.set('race', 0); rev.on(); sfx('mission'); emitR()
}
function stop() { RC.mode = 'idle'; RC.paused = false; if (RC.net) { const n = RC.net; RC.net = null; if (n.onStop) try { n.onStop() } catch { /* ignore */ } } rev.off(); music.set('menu'); emitR() }

function emitR() {
  const me = RC.cars[RC.me]
  const ranked = rankOf()
  snap = {
    mode: RC.mode, paused: RC.paused, phase: RC.phase, type: RC.cfg.type, track: RC.cfg.track, trackName: TRACKS[RC.cfg.track].name, laps: RC.cfg.laps, count: RC.phase === 'ready' ? Math.ceil(RC.count) : 0,
    me: me ? { lap: Math.min(RC.cfg.laps, me.lap), pos: me.rank || 1, total: RC.cars.length, kmh: Math.round(me.sp * 3), nitro: Math.round(me.nitro), boost: me.boostT > 0, drifting: me.drifting, charge: Math.min(1, me.charge / 0.9), lapTime: me.finished ? 0 : RC.t - me.lapStart, best: me.best, last: me.lapTimes.length ? me.lapTimes[me.lapTimes.length - 1] : 0, elapsed: me.finished ? me.finishT : RC.t, finished: me.finished, wrong: me.wrong > 1.2, off: me.off } : null,
    board: ranked.map((c) => ({ i: c.i, name: c.name, color: c.color, finished: c.finished, t: c.finishT, lap: c.lap, human: c.human })),
    map: RC.cars.map((c) => ({ i: c.i, x: c.x, z: c.z, color: c.color, me: c.i === RC.me })),
    results: RC.results, msg: RC.msg ? { ...RC.msg } : null,
  }
  subs.forEach((f) => f())
}
function rankOf() {
  const arr = RC.cars.slice().sort((a, b) => (a.finished && b.finished ? a.finishT - b.finishT : a.finished ? -1 : b.finished ? 1 : b.prog - a.prog))
  arr.forEach((c, i) => { c.rank = i + 1 })
  return arr
}

// ---------- physics ----------
function locate(c) {
  const { P, N, len } = RC.tk
  let best = 1e18, bj = c.idx
  for (let o = -10; o <= 10; o++) {
    const j = (c.idx + o + N) % N
    const dx = c.x - P[j].x, dz = c.z - P[j].z, d = dx * dx + dz * dz
    if (d < best) { best = d; bj = j }
  }
  c.idx = bj
  const p = P[bj]
  const dx = c.x - p.x, dz = c.z - p.z
  const along = dx * p.dx + dz * p.dz
  c.lat = dx * p.nx + dz * p.nz
  let s = p.s + along
  let d = s - c.lastS
  if (d > len / 2) d -= len; else if (d < -len / 2) d += len
  c.prog += d; c.lastS = ((s % len) + len) % len
  c.wrong = d < -0.02 && c.sp > 8 ? c.wrong + 1 / 60 : Math.max(0, c.wrong - 0.05)
}
function stepCar(c, dt) {
  const st = c.st, tk = RC.tk, W = tk.W
  const inp = c.inp
  const racing = RC.phase === 'race' || RC.phase === 'finish'
  const fwdx = Math.sin(c.th), fwdz = -Math.cos(c.th)
  let v = c.vx * fwdx + c.vz * fwdz
  c.off = Math.abs(c.lat) > W / 2 + 0.5
  const nitroOn = racing && inp.nitro && c.nitro > 0 && !c.finished
  if (nitroOn) { c.nitro = Math.max(0, c.nitro - 26 * dt); c.boostT = Math.max(c.boostT, 0.12) }
  const boost = c.boostT > 0
  const maxV = BASE_TOP * st.top * (boost ? 1.38 : 1) * (c.off ? 0.55 : 1) * (c.finished ? 0.4 : 1)
  let acc = 0
  const thr = racing && !c.finished ? inp.thr : 0
  if (thr > 0) acc = BASE_ACC * st.acc * (boost ? 1.9 : 1) * thr * clamp(1 - Math.max(0, v) / maxV, 0, 1.2)
  if ((inp.brk > 0 || c.finished) && racing) acc = v > 2 ? -62 : -22 * (c.finished ? 0 : 1)
  else if (thr <= 0) acc = v > 0 ? -16 : 16
  if (v > maxV) acc -= (v - maxV) * 3
  v += acc * dt
  // steering
  const sv = clamp(Math.abs(v) / 24, 0, 1)
  const drifting = racing && inp.drift && Math.abs(inp.steer) > 0.25 && v > 34
  const turn = (2.15 * st.han) * (1 - 0.32 * clamp(Math.abs(v) / (BASE_TOP * 1.1), 0, 1)) * (drifting ? 1.45 : 1)
  c.steer += (inp.steer - c.steer) * Math.min(1, dt * 9)
  const yaw = c.steer * turn * sv * (v >= 0 ? 1 : -1) * (c.finished ? 0 : 1)
  c.th += yaw * dt
  // lateral grip: the car slides more when drifting, braking hard or off the road
  const gripBase = 6.8 * st.grip * (c.off ? 0.5 : 1) * (drifting ? 0.28 : 1) * (inp.brk > 0 && Math.abs(v) > 40 ? 0.6 : 1)
  const nfx = Math.sin(c.th), nfz = -Math.cos(c.th), nrx = Math.cos(c.th), nrz = Math.sin(c.th)
  const slide = (c.vx * nrx + c.vz * nrz) * (1 - Math.min(1, gripBase * dt)) // sideways speed fades with grip
  c.vx = nfx * v + nrx * slide; c.vz = nfz * v + nrz * slide
  c.sp = Math.hypot(c.vx, c.vz)
  c.x += c.vx * dt; c.z += c.vz * dt
  c.boostT = Math.max(0, c.boostT - dt)
  // drift charge -> mini turbo
  if (drifting) { c.drifting = true; c.charge += dt * st.drift * (Math.abs(inp.steer) > 0.6 ? 1.25 : 0.9); if (c.i === RC.me && Math.random() < dt * 20) sfx('rDrift') }
  else if (c.drifting) { c.drifting = false; if (c.charge > 0.9) { c.boostT = Math.min(2.4, 0.55 + c.charge * 0.55 * st.drift); c.vx += nfx * 10; c.vz += nfz * 10; if (c.i === RC.me) { sfx('rBoost'); RC.shake = 0.5 } } c.charge = 0 }
  if (nitroOn && c.i === RC.me && Math.random() < dt * 3) sfx('rNitro')
  locate(c)
  // walls
  const wall = W / 2 + 6
  if (Math.abs(c.lat) > wall) {
    const p = tk.P[c.idx], side = Math.sign(c.lat)
    c.x -= p.nx * (Math.abs(c.lat) - wall) * side; c.z -= p.nz * (Math.abs(c.lat) - wall) * side
    const vn = c.vx * p.nx * side + c.vz * p.nz * side
    if (vn > 0) { c.vx -= p.nx * side * vn * 1.4; c.vz -= p.nz * side * vn * 1.4 }
    c.vx *= 0.9; c.vz *= 0.9
    if (c.hit <= 0) { c.hit = 0.3; if (c.i === RC.me) { sfx('rBump'); RC.shake = Math.max(RC.shake, vn > 20 ? 0.9 : 0.4) } for (let i = 0; i < 6; i++) fx(c.x, 1.5, c.z, R(-10, 10), R(2, 10), R(-10, 10), 0.4, '#ffd23a', 0.5) }
    c.lat = Math.sign(c.lat) * wall
  }
  c.hit -= dt
  // pads & canisters
  const N = tk.N
  for (let k = 0; k < RC.pads.length; k++) {
    const pd = RC.pads[k]
    const di = ((c.idx - pd.idx + N + N / 2) % N) - N / 2
    if (Math.abs(di) < 2 && Math.abs(c.lat - pd.lat) < 5 && (c.padCd[k] || 0) <= RC.t) { c.padCd[k] = RC.t + 2; c.boostT = Math.max(c.boostT, 1.5); c.vx += nfx * 14; c.vz += nfz * 14; if (c.i === RC.me) { sfx('rPad'); RC.shake = Math.max(RC.shake, 0.35) } for (let i = 0; i < 10; i++) fx(c.x, 1.2, c.z, R(-8, 8), R(2, 12), R(-8, 8), 0.5, '#5ad8ff', 0.6) }
  }
  for (const cn of RC.cans) {
    if (cn.t > 0) { cn.t -= dt; continue }
    const di = ((c.idx - cn.idx + N + N / 2) % N) - N / 2
    if (Math.abs(di) < 1.6 && Math.abs(c.lat - cn.lat) < 4) { cn.t = 12; c.nitro = Math.min(100 * st.nitro, c.nitro + 35); if (c.i === RC.me) sfx('rNitro') }
  }
  // exhaust, smoke and sparks
  if (c.drifting && Math.random() < dt * 40) fx(c.x - nfx * 3, 0.8, c.z - nfz * 3, R(-3, 3), R(1, 4), R(-3, 3), 0.7, '#e6e6f0', 1.3)
  if (c.off && c.sp > 20 && Math.random() < dt * 30) fx(c.x - nfx * 3, 0.8, c.z - nfz * 3, R(-4, 4), R(2, 6), R(-4, 4), 0.6, RC.tk.T.ground, 1.2)
  if (c.boostT > 0 && Math.random() < dt * 60) fx(c.x - nfx * 3.4, 1.3, c.z - nfz * 3.4, -nfx * 18 + R(-2, 2), R(-1, 2), -nfz * 18 + R(-2, 2), 0.3, '#ffb040', 0.9)
  if (c.drifting && c.charge > 0.9 && Math.random() < dt * 30) fx(c.x - nfx * 2.5 + R(-1.5, 1.5), 0.6, c.z - nfz * 2.5, R(-5, 5), R(2, 8), R(-5, 5), 0.3, c.charge > 1.8 ? '#ff4de1' : '#5ad8ff', 0.7)
  // laps
  if (racing && !c.finished) {
    const lapNow = Math.floor(c.prog / tk.len) + 1
    if (lapNow > c.lap && lapNow <= RC.cfg.laps) {
      const lt = RC.t - c.lapStart
      c.lapTimes.push(lt); if (!c.best || lt < c.best) c.best = lt
      c.lap = lapNow; c.lapStart = RC.t
      if (c.i === RC.me) { sfx('rLap'); say(`LAP ${Math.min(lapNow, RC.cfg.laps)}/${RC.cfg.laps}`, '#ffe84a') ; if (lapNow === RC.cfg.laps) { speak('Final lap!', 0.8, 1.1); RC.msg = { text: 'FINAL LAP!', sub: '', t: 1.6 } } }
    }
    if (c.prog >= RC.cfg.laps * tk.len) {
      const lt = RC.t - c.lapStart
      c.lapTimes.push(lt); if (!c.best || lt < c.best) c.best = lt
      c.finished = true; c.finishT = RC.t
      if (c.i === RC.me) { sfx('rFinish'); RC.msg = { text: 'FINISH!', sub: '', t: 2.4 }; RC.phase = 'finish'; RC.phaseT = 0 }
    }
  }
  c.lights = v < -1 || inp.brk > 0 ? 1 : 0
}
const say = (text, color) => { RC.msg = { text, sub: '', color, t: 1.1 } }
function fx(x, y, z, vx, vy, vz, life, color, size) { if (RC.fx.length < 600) RC.fx.push({ x, y, z, vx, vy, vz, life, max: life, color, size }) }

// put a car back on the road, facing the right way (R key, or automatically after being stuck)
function respawn(c) {
  const p = RC.tk.P[c.idx]
  c.x = p.x + p.nx * clamp(c.lat, -RC.tk.W * 0.3, RC.tk.W * 0.3) * 0.2; c.z = p.z + p.nz * clamp(c.lat, -RC.tk.W * 0.3, RC.tk.W * 0.3) * 0.2
  c.th = Math.atan2(p.dx, -p.dz); c.vx = Math.sin(c.th) * 18; c.vz = -Math.cos(c.th) * 18; c.sp = 18; c.steer = 0; c.stuck = 0; c.hit = 0.5
  for (let i = 0; i < 12; i++) fx(c.x, 1.5, c.z, R(-8, 8), R(2, 12), R(-8, 8), 0.5, '#5ad8ff', 0.8)
  if (c.i === RC.me) sfx('rPad')
}
function carBumps() {
  const cs = RC.cars
  for (let a = 0; a < cs.length; a++) for (let b = a + 1; b < cs.length; b++) {
    const A = cs[a], B = cs[b]
    const dx = B.x - A.x, dz = B.z - A.z, d = Math.hypot(dx, dz)
    if (d < 4.6 && d > 0.01) {
      const nx = dx / d, nz = dz / d, over = 4.6 - d
      const wa = B.st.mass / (A.st.mass + B.st.mass), wb = 1 - wa
      A.x -= nx * over * wa; A.z -= nz * over * wa; B.x += nx * over * wb; B.z += nz * over * wb
      const rel = (B.vx - A.vx) * nx + (B.vz - A.vz) * nz
      if (rel < 0) {
        const j = -rel * 1.1
        A.vx -= nx * j * wa; A.vz -= nz * j * wa; B.vx += nx * j * wb; B.vz += nz * j * wb
        A.sp *= 0.97; B.sp *= 0.97
        if (A.i === RC.me || B.i === RC.me) { sfx('rBump'); RC.shake = Math.max(RC.shake, Math.min(0.8, -rel / 25)) }
        for (let i = 0; i < 5; i++) fx((A.x + B.x) / 2, 1.8, (A.z + B.z) / 2, R(-8, 8), R(2, 9), R(-8, 8), 0.4, '#ffd23a', 0.5)
      }
    }
  }
}

// ---------- AI ----------
function aiDrive(c, dt) {
  const tk = RC.tk, N = tk.N, P = tk.P
  const me = RC.cars[RC.me]
  const D = DIFF[RC.cfg.diff - 1]
  const look = Math.round(10 + c.sp * 0.17)
  const t = (c.idx + look) % N
  // racing line: lane offset, and cut toward the inside of the bend ahead
  const bend = clamp(P[(c.idx + look) % N].k * 160, -1, 1)
  const off = clamp(c.lane * tk.W + bend * tk.W * 0.18, -tk.W * 0.38, tk.W * 0.38)
  // keep clear of the car in front
  let avoid = 0
  for (const o of RC.cars) if (o !== c) { const dx = o.x - c.x, dz = o.z - c.z, f = dx * Math.sin(c.th) - dz * Math.cos(c.th), s = dx * Math.cos(c.th) + dz * Math.sin(c.th); if (f > 0 && f < 14 && Math.abs(s) < 4.2) avoid += -Math.sign(s || 1) * (1 - f / 14) * 0.9 }
  const tx = P[t].x + P[t].nx * (off + avoid * 4), tz = P[t].z + P[t].nz * (off + avoid * 4)
  const want = Math.atan2(tx - c.x, -(tz - c.z))
  const err = angDiff(want, c.th)
  c.inp.steer = clamp(err * 1.9, -1, 1)
  // speed from the sharpest bend within sight
  let kmax = 0
  for (let i = 0; i < 26; i += 2) kmax = Math.max(kmax, Math.abs(P[(c.idx + i) % N].k))
  const corner = clamp(Math.sqrt((86 * c.st.grip) / Math.max(kmax, 1e-4)) / (BASE_TOP * c.st.top), 0.34, 1)
  let rb = 1
  if (me && RC.phase === 'race') { const gap = c.prog - me.prog; rb = gap > 60 ? 1 - 0.07 * D.rb : gap < -60 ? 1 + 0.07 * D.rb : 1 }
  const targetV = BASE_TOP * c.st.top * c.skill * corner * rb
  c.inp.thr = c.sp < targetV ? 1 : 0
  c.inp.brk = c.sp > targetV * 1.15 && kmax > 0.004 ? 1 : 0
  c.inp.drift = kmax > 0.0085 && c.sp > 52 && Math.abs(err) > 0.2 && c.skill > 0.95
  c.inp.nitro = c.nitro > 45 && kmax < 0.002 && RC.phase === 'race' && Math.random() < 0.2
  if (c.finished) { c.inp.thr = 0; c.inp.brk = 0; c.inp.nitro = false }
}
function humanInput(c) {
  const k = keys
  c.inp.thr = k.ArrowUp || k.KeyW ? 1 : 0
  c.inp.brk = k.ArrowDown || k.KeyS ? 1 : 0
  c.inp.steer = (k.ArrowRight || k.KeyD ? 1 : 0) - (k.ArrowLeft || k.KeyA ? 1 : 0)
  c.inp.drift = !!k.Space
  c.inp.nitro = !!(k.ShiftLeft || k.ShiftRight || k.KeyE)
}

// ---------- loop ----------
function update(dtRaw) {
  const dt = Math.min(dtRaw, 0.04)
  if (RC.mode === 'idle' || RC.paused) return
  RC.t += dt
  for (let i = RC.fx.length - 1; i >= 0; i--) { const f = RC.fx[i]; f.life -= dt; f.x += f.vx * dt; f.y = Math.max(0.2, f.y + f.vy * dt); f.z += f.vz * dt; f.vy -= 8 * dt; if (f.life <= 0) RC.fx.splice(i, 1) }
  if (RC.msg) { RC.msg.t -= dt; if (RC.msg.t <= 0) RC.msg = null }
  RC.shake = Math.max(0, RC.shake - dt * 2)
  if (RC.net && RC.net.role === 'guest') { guestStep(dt); return }
  RC.phaseT += dt
  if (RC.phase === 'ready') {
    RC.t = 0
    RC.count -= dt
    const n = Math.ceil(RC.count)
    if (n !== RC.lastCount && n >= 1 && n <= 3) { RC.lastCount = n; sfx('rBeep') }
    if (RC.count <= 0) { RC.phase = 'race'; RC.phaseT = 0; RC.t = 0; RC.msg = { text: 'GO!', sub: '', color: '#3dff7a', t: 1 }; sfx('rGo'); speak('Go!', 0.8, 1.1); for (const c of RC.cars) c.lapStart = 0 }
    for (const c of RC.cars) { c.vx = c.vz = 0; c.sp = 0 }
  }
  for (const c of RC.cars) {
    if (c.remote) { remoteStep(c, dt); continue }
    if (c.human) humanInput(c); else aiDrive(c, dt)
    if ((RC.phase === 'race') && !c.finished && c.sp < 4 && (c.inp.thr > 0 || !c.human)) { c.stuck = (c.stuck || 0) + dt; if (c.stuck > (c.human ? 4 : 2.2)) respawn(c) } else c.stuck = 0
    if (c.human && keys.KeyR && RC.phase === 'race' && c.sp < 60 && !c.rHeld) { c.rHeld = true; respawn(c) } else if (!keys.KeyR) c.rHeld = false
    if (RC.phase === 'ready') { if (c.human) { c.inp.thr = 0 } else { c.inp.thr = 0 }; if (RC.count < 0.7 && !c.human) c.inp.thr = 1 }
    stepCar(c, dt)
  }
  carBumps()
  rankOf()
  // end of the race
  if (RC.phase === 'race' || RC.phase === 'finish') {
    const me = RC.cars[RC.me]
    if (RC.phase === 'finish' && (RC.phaseT > (RC.cfg.type === 'demo' ? 90 : 9) || RC.cars.every((c) => c.finished))) finishRace()
    if (RC.cfg.type === 'demo' && RC.cars.every((c) => c.finished || RC.t > 400)) finishRace()
    if (RC.t > 900) finishRace()
    void me
  }
  // engine & camera feedback for the player
  const me = RC.cars[RC.me]
  if (me && RC.mode === 'play') {
    rev.set(clamp(me.sp / (BASE_TOP * 1.2), 0, 1), me.boostT > 0 ? 1 : 0, me.drifting || me.off ? 1 : 0)
    if (me.wrong > 1.2 && RC.phase === 'race' && Math.floor(RC.t * 2) !== Math.floor((RC.t - dt) * 2)) sfx('rBump')
  }
  RC.emitT -= dt
  if (RC.emitT <= 0) { RC.emitT = 0.08; emitR() }
  if (RC.net && RC.net.role === 'host') netTick(dt)
}
function finishRace() {
  if (RC.phase === 'results') return
  RC.phase = 'results'; RC.phaseT = 0
  rev.off(); music.stop()
  const board = rankOf()
  // cars still running: rank by distance
  const me = RC.cars[RC.me]
  const pos = me ? me.rank : 1
  const pts = [100, 70, 50, 35, 25, 15, 10, 5]
  RC.results = { pos, total: RC.cars.length, track: TRACKS[RC.cfg.track].name, time: me ? (me.finished ? me.finishT : 0) : 0, best: me ? me.best : 0, rows: board.map((c) => ({ i: c.i, name: c.name, color: c.color, t: c.finished ? c.finishT : 0, best: c.best, human: c.human })), pts: pts[pos - 1] || 0 }
  if (RC.cfg.type !== 'demo' && me) {
    profile.raceRaces = (profile.raceRaces || 0) + 1
    if (pos === 1) profile.raceWins = (profile.raceWins || 0) + 1
    if (pos <= 3) profile.racePodiums = (profile.racePodiums || 0) + 1
    const rb = { ...(profile.raceBest || {}) }
    if (me.best && (!rb[RC.cfg.track] || me.best < rb[RC.cfg.track])) { rb[RC.cfg.track] = me.best; RC.results.record = true }
    profile.raceBest = rb
    const score = Math.round((RC.cars.length - pos + 1) * 1500 + Math.max(0, 140 - (me.finished ? me.finishT : 140)) * 80 + (pos === 1 ? 2500 : 0))
    RC.results.score = score
    recordScore('race', score)
    saveProfile()
  }
  sfx(pos <= 3 ? 'win' : 'over')
  emitR()
}
function onKey(code) {
  if (RC.mode === 'idle') return
  if (code === 'Escape' || code === 'KeyP') { if (RC.mode === 'play' && !RC.net) { RC.paused = !RC.paused; if (RC.paused) rev.off(); else rev.on(); sfx('ui'); emitR() } return }
  if (RC.paused) { if (code === 'Enter') { RC.paused = false; rev.on(); emitR() } return }
  if (RC.phase === 'results') { if (code === 'Enter') raceActions.rematch() }
}
export const raceActions = {
  start: startRace, stop, quit() { toMenu() },
  resume() { RC.paused = false; rev.on(); emitR() },
  pause() { if (RC.mode === 'play' && !RC.paused && !RC.net) { RC.paused = true; rev.off(); emitR(); return true } return false },
  rematch() { if (RC.net) { RC.net.rematch(); return } startRace(RC.cfg) },
}
export function setRacePick(car, track) { if (car !== undefined) profile.racePick = car; if (track !== undefined) profile.raceTrack = track; saveProfile() }

// ---------- online (every player drives their own car; the host runs the AI and relays everyone) ----------
let nT = 0, inT = 0, lastN = -1, nSeq = 0
const r2 = (v) => Math.round(v * 100) / 100
const carSnap = (c) => [c.i, r2(c.x), r2(c.z), r2(c.th), r2(c.vx), r2(c.vz), c.lap, r2(c.prog), c.finished ? 1 : 0, r2(c.finishT), c.boostT > 0 ? 1 : 0, c.drifting ? 1 : 0, r2(c.nitro), c.lights]
function netTick(dt) {
  nT -= dt
  if (nT <= 0) { nT = RC.net.fast && RC.net.fast() ? 0.05 : 0.15; RC.net.state({ n: ++nSeq, ph: RC.phase, t: r2(RC.t), cnt: r2(RC.count), cars: RC.cars.map(carSnap), cfg: RC.cfg }) }
}
function remoteStep(c, dt) { // a friend's car: follow their last reported state, extrapolating a little
  if (c.tx !== undefined) { c.x += (c.tx - c.x) * Math.min(1, dt * 14); c.z += (c.tz - c.z) * Math.min(1, dt * 14); c.th += angDiff(c.tth, c.th) * Math.min(1, dt * 14) }
  c.x += c.vx * dt * 0.5; c.z += c.vz * dt * 0.5
  c.sp = Math.hypot(c.vx, c.vz)
  const pg = c.prog; locate(c); c.prog = pg
  const fwdx = Math.sin(c.th), fwdz = -Math.cos(c.th)
  if (c.boostT > 0 && Math.random() < dt * 50) fx(c.x - fwdx * 3.4, 1.3, c.z - fwdz * 3.4, -fwdx * 18, 0, -fwdz * 18, 0.3, '#ffb040', 0.9)
  if (c.drifting && Math.random() < dt * 30) fx(c.x - fwdx * 3, 0.8, c.z - fwdz * 3, R(-3, 3), R(1, 4), R(-3, 3), 0.7, '#e6e6f0', 1.3)
}
function guestStep(dt) {
  // our own car is simulated locally (instant response); the host only relays the rest of the field
  RC.phaseT += dt
  inT -= dt
  const me = RC.cars[RC.me]
  if (RC.phase === 'ready') { RC.count -= dt; for (const c of RC.cars) { c.vx = c.vz = 0; c.sp = 0 }; const n = Math.ceil(RC.count); if (n !== RC.lastCount && n >= 1 && n <= 3) { RC.lastCount = n; sfx('rBeep') }; if (RC.count <= 0) { RC.phase = 'race'; RC.t = 0; RC.msg = { text: 'GO!', sub: '', color: '#3dff7a', t: 1 }; sfx('rGo') } }
  RC.t += RC.phase === 'ready' ? 0 : dt
  for (const c of RC.cars) {
    if (c === me) { humanInput(c); if (RC.phase === 'ready') c.inp.thr = 0; stepCar(c, dt) } else { remoteStep(c, dt) }
  }
  carBumps()
  rankOf()
  if (me && inT <= 0 && RC.net) { inT = RC.net.fast && RC.net.fast() ? 0.05 : 0.12; RC.net.mine(carSnap(me)) }
  if (me) rev.set(clamp(me.sp / (BASE_TOP * 1.2), 0, 1), me.boostT > 0 ? 1 : 0, me.drifting || me.off ? 1 : 0)
  RC.emitT -= dt
  if (RC.emitT <= 0) { RC.emitT = 0.08; emitR() }
}
export const raceNet = {
  attach(net) { RC.net = net },
  active: () => !!RC.net && RC.mode !== 'idle',
  reset() { nSeq = 0; lastN = -1; nT = 0; inT = 0 },
  // a friend's car (relayed by the host, or reported straight to the host by its driver)
  applyCar(a) {
    const c = RC.cars[a[0]]
    if (!c || c.i === RC.me) return
    c.tx = a[1]; c.tz = a[2]; c.tth = a[3]; c.vx = a[4]; c.vz = a[5]; c.lap = a[6]; c.prog = a[7]; if (a[8] && !c.finished) { c.finished = true; c.finishT = a[9] }
    c.boostT = a[10] ? 1 : 0; c.drifting = !!a[11]; c.nitro = a[12]; c.lights = a[13]
    if (Math.hypot(c.x - c.tx, c.z - c.tz) > 25) { c.x = c.tx; c.z = c.tz; c.th = c.tth }
  },
  // guest: the host's full field (AI cars and relayed friends) and the race clock
  applyState(s) {
    if (!RC.net || RC.net.role !== 'guest' || !s || s.n <= lastN || RC.mode === 'idle') return
    lastN = s.n
    if (s.ph === 'ready') { RC.count = s.cnt; RC.phase = 'ready' }
    else if (RC.phase === 'ready' && s.ph === 'race') { RC.phase = 'race' }
    for (const a of s.cars) raceNet.applyCar(a)
    if (s.ph === 'results' && RC.phase !== 'results') { const me = RC.cars[RC.me]; if (me && !me.finished) { me.finished = true; me.finishT = RC.t } finishRace() }
  },
  hostCar(i, a) { const c = RC.cars[i]; if (c && c.remote) raceNet.applyCar(a) },
  playerLeft(i) { const c = RC.cars[i]; if (c) { c.remote = false; c.human = false } },
  opponentLeft() { if (RC.net && RC.net.role === 'guest' && RC.mode === 'play') finishRace() },
}

// ---------- drawing ----------
const cc = {}
const lc = (hex) => cc[hex] || (cc[hex] = rgb(hex))
const CAM = { x: 0, y: 12, z: 40, tx: 0, ty: 3, tz: 0, fov: 62, fx: 0, fz: -1 }
export function raceCamera(aspect, dt) {
  const me = RC.cars[RC.me]
  if (!me) return { ...CAM, far: 1600 }
  const k = Math.min(1, (dt || 0.016) * 4.5)
  const fwdx = Math.sin(me.th), fwdz = -Math.cos(me.th)
  // blend the camera direction toward the heading (a little lag makes drifts feel dramatic)
  CAM.fx += (fwdx - CAM.fx) * Math.min(1, (dt || 0.016) * 6); CAM.fz += (fwdz - CAM.fz) * Math.min(1, (dt || 0.016) * 6)
  const fl = Math.hypot(CAM.fx, CAM.fz) || 1, dx = CAM.fx / fl, dz = CAM.fz / fl
  const dist = 17 + me.sp * 0.045, height = 8 + me.sp * 0.02
  let tx = me.x - dx * dist, tz = me.z - dz * dist, ty = height
  if (RC.phase === 'results' || (RC.phase === 'finish' && me.finished)) { const a = RC.phaseT * 0.5; tx = me.x + Math.cos(a) * 26; tz = me.z + Math.sin(a) * 26; ty = 12 }
  const asp = aspect || 1.6
  const wide = asp < 1.2 ? 1.25 : 1
  CAM.x += (tx - CAM.x) * k * 1.4; CAM.y += (ty - CAM.y) * k; CAM.z += (tz - CAM.z) * k * 1.4
  CAM.tx += (me.x + dx * 14 - CAM.tx) * k * 2; CAM.ty = 3.2; CAM.tz += (me.z + dz * 14 - CAM.tz) * k * 2
  const fovT = (58 + clamp(me.sp / BASE_TOP, 0, 1.5) * 12 + (me.boostT > 0 ? 8 : 0)) * wide
  CAM.fov += (fovT - CAM.fov) * k
  const sh = RC.shake
  return { x: CAM.x + (Math.random() - 0.5) * sh * 1.2, y: CAM.y + (Math.random() - 0.5) * sh * 0.8, z: CAM.z + (Math.random() - 0.5) * sh * 1.2, tx: CAM.tx, ty: CAM.ty, tz: CAM.tz, fov: CAM.fov, far: 1600 }
}
// static scenery is built once per track into typed arrays and copied each frame (it is thousands of boxes)
const staticCache = {}
function buildStatic(ti) {
  if (staticCache[ti]) return staticCache[ti]
  const tk = buildTrack(ti), T = tk.T, P = tk.P, N = tk.N, W = tk.W
  const MAXS = 7000
  const A = new Float32Array(MAXS * 16), C = new Float32Array(MAXS * 3)
  let n = 0
  const put = (x, y, z, sx, sy, sz, ry, r, g, b) => {
    if (n >= MAXS) return
    const o = n * 16, cy = Math.cos(ry), sy_ = Math.sin(ry)
    A[o] = cy * sx; A[o + 1] = 0; A[o + 2] = -sy_ * sx; A[o + 3] = 0
    A[o + 4] = 0; A[o + 5] = sy; A[o + 6] = 0; A[o + 7] = 0
    A[o + 8] = sy_ * sz; A[o + 9] = 0; A[o + 10] = cy * sz; A[o + 11] = 0
    A[o + 12] = x; A[o + 13] = y; A[o + 14] = z; A[o + 15] = 1
    const c = n * 3; C[c] = r; C[c + 1] = g; C[c + 2] = b; n++
  }
  const col = (hex, k = 1) => { const c = lc(hex); return [c[0] * k, c[1] * k, c[2] * k] }
  const g = col(T.ground), road = col(T.road), acc = col(T.accent), sky = col(T.sky)
  // ground & far mountains
  put(0, -1.2, 0, 3200, 2, 3200, 0, g[0], g[1], g[2])
  const r = rng(ti * 31 + 7)
  for (let i = 0; i < 28; i++) { const a = (i / 28) * TAU + r() * 0.2, d = 1100 + r() * 200, h = 90 + r() * 160; const m = T.scenery === 'city' ? col('#2a1a60', 1 + r() * 0.5) : T.scenery === 'snow' ? col('#c8e0f0', 0.8 + r() * 0.3) : T.scenery === 'cacti' ? col('#a06a3a', 0.8 + r() * 0.3) : col('#5a7aa0', 0.7 + r() * 0.3); put(Math.cos(a) * d, h / 2 - 2, Math.sin(a) * d, 140 + r() * 140, h, 140 + r() * 140, r() * 3, m[0], m[1], m[2]) }
  put(-300, 300, -1050, 120, 120, 4, 0, 3, 2.6, 1.6) // the sun
  // road, kerbs, barriers, dashes
  for (let i = 0; i < N; i++) {
    const a = P[i], b = P[(i + 1) % N]
    const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2, len = Math.hypot(b.x - a.x, b.z - a.z) + 0.5
    const ry = Math.atan2(-(b.z - a.z), b.x - a.x)
    put(mx, 0, mz, len, 0.5, W, ry, road[0], road[1], road[2])
    const kc = (i % 2) ? [1.6, 0.2, 0.2] : [1.6, 1.6, 1.6]
    for (const sd of [-1, 1]) {
      const kx = mx + a.nx * sd * (W / 2 + 1), kz = mz + a.nz * sd * (W / 2 + 1)
      put(kx, 0.12, kz, len, 0.6, 2, ry, kc[0], kc[1], kc[2])
      if (i % 2 === 0) put(mx + a.nx * sd * (W / 2 + 7), 0.9, mz + a.nz * sd * (W / 2 + 7), len + 0.4, 2.2, 1, ry, acc[0] * 0.9, acc[1] * 0.9, acc[2] * 0.9)
    }
    if (i % 4 === 0) put(mx, 0.3, mz, len * 0.55, 0.2, 0.7, ry, 1.5, 1.5, 1.5)
  }
  // start / finish line and gantry
  { const p = P[0], ry = Math.atan2(-p.dz, p.dx)
    for (let k = 0; k < 10; k++) for (let j = 0; j < 2; j++) put(p.x + p.dx * (j - 0.5) * 2 + p.nx * (k - 4.5) * (W / 10), 0.32, p.z + p.dz * (j - 0.5) * 2 + p.nz * (k - 4.5) * (W / 10), 2, 0.2, W / 10, ry, (k + j) % 2 ? 1.8 : 0.1, (k + j) % 2 ? 1.8 : 0.1, (k + j) % 2 ? 1.8 : 0.1)
    for (const sd of [-1, 1]) put(p.x + p.nx * sd * (W / 2 + 3), 7, p.z + p.nz * sd * (W / 2 + 3), 2, 14, 2, ry, 0.5, 0.5, 0.6)
    put(p.x, 14, p.z, 2, 3, W + 8, ry, acc[0] * 1.4, acc[1] * 1.4, acc[2] * 1.4) }
  // boost pads (chevrons)
  // scenery along the track
  const r2s = rng(ti * 101 + 3)
  const count = 340
  for (let k = 0; k < count; k++) {
    const i = Math.floor(r2s() * N), p = P[i], side = r2s() < 0.5 ? -1 : 1, dist = W / 2 + 14 + r2s() * 90
    const x = p.x + p.nx * side * dist, z = p.z + p.nz * side * dist
    // keep scenery off the road (other parts of the loop)
    let ok = true
    for (let j = 0; j < N; j += 6) { if (Math.hypot(P[j].x - x, P[j].z - z) < W / 2 + 12) { ok = false; break } }
    if (!ok) continue
    const sc = 0.8 + r2s() * 1.1
    if (T.scenery === 'trees') { const tr = col('#5a3a1a'), lf = col(r2s() < 0.5 ? '#2f8a3a' : '#3aa04a', 0.8 + r2s() * 0.4); put(x, 3 * sc, z, 1.6 * sc, 6 * sc, 1.6 * sc, 0, tr[0], tr[1], tr[2]); put(x, 8 * sc, z, 7 * sc, 5 * sc, 7 * sc, r2s() * 3, lf[0], lf[1], lf[2]); put(x, 12 * sc, z, 4.6 * sc, 4 * sc, 4.6 * sc, r2s() * 3, lf[0] * 1.1, lf[1] * 1.1, lf[2] * 1.1) }
    else if (T.scenery === 'city') { const h = 30 + r2s() * 90, b = col(['#1a1a3a', '#241a4a', '#14284a'][(r2s() * 3) | 0], 1 + r2s() * 0.6), w = 14 + r2s() * 14; put(x, h / 2, z, w, h, w, r2s() * 3, b[0], b[1], b[2]); for (let y = 6; y < h - 4; y += 7) put(x + 0.1, y, z, w + 0.4, 1.4, w * 0.9, 0, acc[0] * (r2s() < 0.5 ? 1.8 : 0.5), acc[1] * 1.2, acc[2] * 1.8); if (r2s() < 0.3) put(x, h + 2, z, 1, 4, 1, 0, 2.4, 0.3, 0.3) }
    else if (T.scenery === 'snow') { const tr = col('#4a3a2a'), lf = col('#d8f0ff', 0.9 + r2s() * 0.3); put(x, 2, z, 1.4 * sc, 4 * sc, 1.4 * sc, 0, tr[0], tr[1], tr[2]); put(x, 6 * sc, z, 8 * sc, 3 * sc, 8 * sc, r2s() * 3, lf[0] * 0.55, lf[1] * 0.75, lf[2] * 0.7); put(x, 9 * sc, z, 5.4 * sc, 3 * sc, 5.4 * sc, r2s() * 3, lf[0] * 0.7, lf[1] * 0.85, lf[2] * 0.8); put(x, 12 * sc, z, 3 * sc, 3 * sc, 3 * sc, r2s() * 3, lf[0], lf[1], lf[2]) }
    else { const cg = col('#3a8a3a', 0.8 + r2s() * 0.4); put(x, 4 * sc, z, 2 * sc, 8 * sc, 2 * sc, 0, cg[0], cg[1], cg[2]); put(x + 2.2 * sc, 5.5 * sc, z, 3 * sc, 1.4 * sc, 1.4 * sc, 0, cg[0], cg[1], cg[2]); put(x + 3.4 * sc, 7 * sc, z, 1.4 * sc, 3 * sc, 1.4 * sc, 0, cg[0], cg[1], cg[2]); if (r2s() < 0.4) { const rk = col('#a07a4a', 0.8 + r2s() * 0.4); put(x + 8, 2 * sc, z + 5, 7 * sc, 4 * sc, 6 * sc, r2s() * 3, rk[0], rk[1], rk[2]) } }
  }
  staticCache[ti] = { A, C, n }
  return staticCache[ti]
}
function draw() { /* the race is drawn entirely in the lit 3D pass (draw3) */ }
function draw3(api) {
  const { put3, bulk } = api
  if (!RC.tk) return
  const st = buildStatic(RC.cfg.track)
  bulk(st.A, st.C, st.n)
  const N = RC.tk.N, P = RC.tk.P, W = RC.tk.W
  const T = RC.tk.T, acc = lc(T.accent), t = G.time
  // pads and canisters
  for (const pd of RC.pads) { const p = P[pd.idx], ry = -Math.atan2(p.dz, p.dx); for (let k = 0; k < 3; k++) put3(p.x + p.dx * (k * 2.4 - 2.4) + p.nx * pd.lat, 0.4, p.z + p.dz * (k * 2.4 - 2.4) + p.nz * pd.lat, 4.6, 0.25, 6.4 - k * 1.2, 0, 0.4 + (Math.sin(t * 10 - k) * 0.5 + 0.5), 1.4, 2.4, ry) }
  for (const cn of RC.cans) { if (cn.t > 0) continue; const p = P[cn.idx]; put3(p.x + p.nx * cn.lat, 2.4 + Math.sin(t * 3 + cn.idx) * 0.4, p.z + p.nz * cn.lat, 1.6, 2.6, 1.6, 0, 0.3, 2.2, 1.0, t * 2) }
  for (const c of RC.cars) drawCar3(put3, c, t)
  // particles: smoke, sparks and boost flames (bright boxes)
  for (const f of RC.fx) { const k = f.life / f.max, c = lc(f.color), sz = f.size * (0.4 + 0.6 * k); put3(f.x, f.y, f.z, sz, sz, sz, 0, c[0] * 1.5 * k + 0.1, c[1] * 1.5 * k + 0.1, c[2] * 1.5 * k + 0.1) }
  const me = RC.cars[RC.me]
  // speed lines while the player is boosting
  if (me && (me.boostT > 0 || me.sp > BASE_TOP * 1.1)) {
    const fx_ = Math.sin(me.th), fz_ = -Math.cos(me.th), rx = Math.cos(me.th), rz = Math.sin(me.th), ry = -me.th
    for (let i = 0; i < 18; i++) { const a = (i * 2.399 + t * 3) % TAU, rr = 6 + ((i * 7 + t * 90) % 22), along = 8 + ((i * 13 + t * 120) % 34); put3(me.x + fx_ * along + rx * Math.cos(a) * rr, 2 + Math.abs(Math.sin(a)) * rr * 0.5, me.z + fz_ * along + rz * Math.cos(a) * rr, 0.14, 0.14, 6, 0, 1.6, 1.8, 2.4, ry) }
  }
}
function drawCar3(put3, c, t) {
  const col = lc(c.color), th = c.th, ry = -th
  const cs = Math.cos(ry), sn = Math.sin(ry)
  const roll = clamp(c.steer * c.sp * 0.0012, -0.12, 0.12) * (c.drifting ? 2 : 1)
  // local (lx sideways, lz along the car, + is forward) -> world; the car's forward axis is local -z
  const part = (lx, ly, lz, sx, sy, sz, r, g, b) => put3(c.x + lx * cs + lz * sn, ly, c.z - lx * sn + lz * cs, sx, sy, sz, 0, r, g, b, ry)
  const dark = [0.06, 0.06, 0.09]
  // wheels
  for (const [lx, lz] of [[-1.9, -2.3], [1.9, -2.3], [-1.9, 2.3], [1.9, 2.3]]) part(lx, 0.8, lz, 0.9, 1.7, 1.7, dark[0], dark[1], dark[2])
  part(0, 1.35 + roll * 0, 0, 3.6, 0.9, 7.8, col[0], col[1], col[2])        // chassis
  part(0, 2.15, 0.6, 2.8, 0.9, 3.8, col[0] * 0.9, col[1] * 0.9, col[2] * 0.9) // cabin lower
  part(0, 2.55, 0.4, 2.4, 0.8, 2.6, 0.12, 0.2, 0.3)                          // glass
  part(0, 1.5, -3.5, 3.5, 0.6, 1.4, col[0] * 0.7, col[1] * 0.7, col[2] * 0.7) // nose
  part(0, 2.7, 3.2, 4.2, 0.35, 1.2, col[0] * 0.55, col[1] * 0.55, col[2] * 0.55) // spoiler
  part(-1.3, 2.2, 3.2, 0.4, 1.2, 0.5, 0.1, 0.1, 0.12); part(1.3, 2.2, 3.2, 0.4, 1.2, 0.5, 0.1, 0.1, 0.12)
  part(0, 1.95, -0.4, 0.5, 0.2, 5.4, 1.6, 1.6, 1.6) // racing stripe
  for (const sd of [-1, 1]) { part(sd * 1.2, 1.5, 3.8, 0.8, 0.5, 0.25, c.lights ? 3 : 1.1, 0.12, 0.12); part(sd * 1.2, 1.4, -3.9, 0.8, 0.5, 0.25, 2.6, 2.6, 2.2) }
  if (c.boostT > 0) for (const sd of [-0.6, 0.6]) part(sd, 1.1, 4.4 + Math.random() * 1.6, 1, 0.8, 2 + Math.random(), 2.6, 1.2, 0.2)
  if (c.drifting && c.charge > 0.9) part(0, 5.6, 0, 1.2, 1.2, 1.2, c.charge > 1.8 ? 2.4 : 0.6, c.charge > 1.8 ? 0.3 : 1.6, 2.4)
  if (c.human || c.i === RC.me) part(0, 3.6, 0.4, 0.9, 0.9, 0.9, 0.3, 2.4, 1.0) // beacon on your car
}
if (typeof window !== 'undefined') { window.__RC = RC; window.__race = raceActions }
games.race = { update, onKey, draw, draw3, camera: raceCamera, sun: () => { const m = RC.cars[RC.me]; return { x: m ? m.x : 0, z: m ? m.z : 0 } }, stop, sky: () => (RC.tk ? RC.tk.T.sky : '#102040'), fog: () => (RC.tk ? RC.tk.T.fog : '#102040'), fov: () => 62 }
