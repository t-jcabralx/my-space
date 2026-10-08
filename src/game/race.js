import { treeModel } from './artDirection.js'
// TURBO RUSH: a 3D arcade racer. 5 tracks, 6 cars, drifting with mini-turbos, nitro, boost pads, AI rivals and lap records.
// Pure JS simulation (testable headlessly); drawn as lit 3D boxes through Scene.jsx (draw3) with a chase camera.
import { G, keys, games, profile, saveProfile, recordScore, toMenu, flash } from './engine.js'
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
export function buildTrack(ti, K = 1) {
  const key = ti + ':' + K
  if (built[key]) return built[key]
  const T = TRACKS[ti], c = T.pts.map((q) => [q[0] * K, q[1] * K]), n = c.length
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
  built[key] = { T, P, N, len: N * step, step, W: T.w, K }
  return built[key]
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
    inp: { thr: 0, brk: 0, steer: 0, drift: false, nitro: false }, wrong: 0, bump: 0, lane: 0, aiT: 0, hit: 0, padCd: {}, lights: 0, color: st.color, skill: 1, item: null, itemN: 0, spin: 0, spinDir: 1, star: 0, slowT: 0, hitInv: 0, itemT: 0 }
}
export function startRace(cfg = {}) {
  RC.cfg = { track: 0, car: 0, laps: 3, diff: 2, ai: 5, type: 'race', seed: (Math.random() * 1e9) | 0, humans: null, ...cfg }
  const c = RC.cfg
  if (c.type !== 'online') RC.net = null
  RC.tk = buildTrack(c.track, [1, 2, 4, 8].includes(c.size) ? c.size : 1)
  // the 4th dimension: a day/night cycle and weather that change while you race (deterministic from the seed so online players share them)
  { const wr = rng((c.seed || 1) * 13 + 5), T0 = TRACKS[c.track], roll = wr()
    const auto = T0.scenery === 'snow' ? (roll < 0.6 ? 'snow' : roll < 0.8 ? 'fog' : 'clear') : T0.scenery === 'city' ? (roll < 0.5 ? 'rain' : roll < 0.7 ? 'fog' : 'clear') : T0.scenery === 'cacti' ? (roll < 0.75 ? 'clear' : 'fog') : (roll < 0.5 ? 'clear' : roll < 0.78 ? 'rain' : 'fog')
    RC.weather = ['clear', 'rain', 'fog', 'snow'].includes(c.weather) ? c.weather : auto
    RC.tod0 = typeof c.tod === 'number' ? c.tod : wr()
    RC.storm = RC.weather === 'rain' && wr() < 0.5; RC.stormT = 6 + wr() * 8
    RC.gripK = RC.weather === 'rain' ? 0.84 : RC.weather === 'snow' ? 0.72 : 1 }
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
  ENVC = null
  RC.boxes = []; RC.items = []; RC.shells = []; RC.kid = 1; RC.deadIds = {}
  if (c.kart) {
    RC.cans = []
    for (let k = 0; k < 12; k++) { const j = Math.floor(((k + 0.5) / 12) * N + 3) % N; for (const f of [-0.26, 0, 0.26]) RC.boxes.push({ idx: j, lat: f * W, t: 0 }) }
    RC.cars.forEach((x) => { x.nitro = 0 })
  }
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
    me: me ? { lap: Math.min(RC.cfg.laps, me.lap), pos: me.rank || 1, total: RC.cars.length, kmh: Math.round(me.sp * 3), nitro: Math.round(me.nitro), boost: me.boostT > 0, drifting: me.drifting, charge: Math.min(1, me.charge / 0.9), lapTime: me.finished ? 0 : RC.t - me.lapStart, best: me.best, last: me.lapTimes.length ? me.lapTimes[me.lapTimes.length - 1] : 0, elapsed: me.finished ? me.finishT : RC.t, finished: me.finished, wrong: me.wrong > 1.2, off: me.off, item: me.item, itemN: me.itemN, spin: me.spin > 0, star: me.star > 0, slow: me.slowT > 0 } : null,
    kart: !!RC.cfg.kart, envLabel: ENVC ? ENVC.label : '', night: ENVC ? ENVC.night : 0,
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
  if (c.star > 0) { c.star -= dt; c.boostT = Math.max(c.boostT, 0.1) }
  if (c.slowT > 0) c.slowT -= dt
  if (c.hitInv > 0) c.hitInv -= dt
  if (c.itemT > 0) c.itemT -= dt
  const inp = c.spin > 0 ? SPIN_INP : c.inp
  if (c.spin > 0) c.spin -= dt
  const racing = RC.phase === 'race' || RC.phase === 'finish'
  const fwdx = Math.sin(c.th), fwdz = -Math.cos(c.th)
  let v = c.vx * fwdx + c.vz * fwdz
  c.off = Math.abs(c.lat) > W / 2 + 0.5
  const nitroOn = racing && inp.nitro && c.nitro > 0 && !c.finished
  if (nitroOn) { c.nitro = Math.max(0, c.nitro - 26 * dt); c.boostT = Math.max(c.boostT, 0.12) }
  const boost = c.boostT > 0
  const maxV = BASE_TOP * st.top * (boost ? 1.38 : 1) * (c.star > 0 ? 1.22 : 1) * (c.slowT > 0 ? 0.62 : 1) * (c.off ? 0.55 : 1) * (c.finished ? 0.4 : 1)
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
  if (c.spin > 0) { c.th += 11 * dt * c.spinDir; v *= Math.exp(-2.4 * dt) }
  // lateral grip: the car slides more when drifting, braking hard or off the road
  const gripBase = 6.8 * st.grip * (RC.gripK || 1) * (c.off ? 0.5 : 1) * (drifting ? 0.28 : 1) * (inp.brk > 0 && Math.abs(v) > 40 ? 0.6 : 1)
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
  if (RC.cfg.kart) kartTouch(c)
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
const SPIN_INP = { thr: 0, brk: 0, steer: 0, drift: false, nitro: false }
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

// ---------- kart items ----------
const ITEM_ICON = { boost: '🚀', triple: '🚀', banana: '🍌', shell: '🔴', blue: '🔵', star: '⭐', bolt: '⚡' }
export { ITEM_ICON }
const evSend = (d) => { if (RC.net && RC.net.ev) RC.net.ev(d) }
const isGuest = () => !!(RC.net && RC.net.role === 'guest')
function rollItem(c) {
  const n = RC.cars.length, r = n > 1 ? clamp(((c.rank || 1) - 1) / (n - 1), 0, 1) : 0
  const w = { boost: 22, triple: 8 + 12 * r, banana: 30 - 22 * r, shell: 16 + 8 * r, star: 2 + 18 * r, bolt: r > 0.55 ? 8 + 8 * r : 0, blue: r > 0.8 && n >= 4 ? 16 : 0 }
  let tot = 0; for (const k in w) tot += w[k]
  let x = Math.random() * tot
  for (const k in w) { x -= w[k]; if (x <= 0) return k }
  return 'boost'
}
function addItem(k, x, z, owner) { RC.items.push({ id: RC.kid++, k, x, z, owner, t0: RC.t }) }
function fireShell(c, k) {
  const ranked = RC.cars.slice().sort((a, b) => (a.rank || 99) - (b.rank || 99))
  let target = null
  if (k === 'blue') target = ranked[0] !== c ? ranked[0] : null
  else { const ix = ranked.indexOf(c); target = ix > 0 ? ranked[ix - 1] : null }
  const fx_ = Math.sin(c.th), fz_ = -Math.cos(c.th)
  RC.shells.push({ id: RC.kid++, k, x: c.x + fx_ * 5, z: c.z + fz_ * 5, dx: fx_, dz: fz_, target: target ? target.i : -1, owner: c.i, life: k === 'blue' ? 14 : 5 })
}
function boltAll(by) { for (const o of RC.cars) { if (o === by || o.star > 0) continue; hitCar(o, 'bolt') } if (by.i !== RC.me) G.flash = Math.max(G.flash || 0, 0.6) }
export function hitCar(c, kind, fromNet) {
  if (c.star > 0 || c.hitInv > 0 || c.finished) return
  if (!fromNet && RC.net && RC.net.role === 'host' && c.remote) { if (RC.net.hit) RC.net.hit(c.i, { k: 'hit', kind }); return }
  if (kind === 'bolt') { c.slowT = 3.5; c.hitInv = 0.8; c.vx *= 0.7; c.vz *= 0.7 }
  else { c.spin = kind === 'blue' ? 1.7 : 1.25; c.spinDir = Math.random() < 0.5 ? -1 : 1; c.hitInv = c.spin + 1.3; c.vx *= 0.35; c.vz *= 0.35 }
  for (let i = 0; i < 14; i++) fx(c.x, 1.6, c.z, R(-12, 12), R(3, 12), R(-12, 12), 0.6, kind === 'bolt' ? '#fff27a' : '#ff8a2a', 0.9)
  if (c.i === RC.me) { sfx('rCrash'); RC.shake = Math.max(RC.shake, 0.9); RC.msg = { text: kind === 'bolt' ? 'ZAPPED!' : kind === 'banana' ? 'SLIPPED!' : 'HIT!', sub: '', color: '#ff6a4a', t: 1.2 } }
}
function useItem(c) {
  if (!c.item || c.spin > 0 || c.finished) return
  const it = c.item, fx_ = Math.sin(c.th), fz_ = -Math.cos(c.th)
  if (it === 'boost' || it === 'triple') { c.boostT = Math.max(c.boostT, it === 'triple' ? 1.3 : 2.2); c.vx += fx_ * 12; c.vz += fz_ * 12; if (c.i === RC.me) { sfx('rBoost'); RC.shake = Math.max(RC.shake, 0.4) } }
  else if (it === 'banana') { const x = c.x - fx_ * 6.5, z = c.z - fz_ * 6.5; if (isGuest()) evSend({ k: 'drop', t: 'banana', x, z }); else addItem('banana', x, z, c.i); if (c.i === RC.me) sfx('rBump') }
  else if (it === 'shell' || it === 'blue') { if (isGuest()) evSend({ k: 'shell', t: it }); else fireShell(c, it); if (c.i === RC.me) sfx('rBoost') }
  else if (it === 'star') { c.star = 7; c.boostT = Math.max(c.boostT, 1); if (c.i === RC.me) { sfx('rNitro'); RC.msg = { text: 'STAR POWER!', sub: '', color: '#ffe84a', t: 1.2 } } }
  else if (it === 'bolt') { if (isGuest()) evSend({ k: 'bolt' }); else { boltAll(c); if (RC.net && RC.net.role === 'host') RC.cars.forEach((o) => { if (o.remote && o !== c && RC.net.hit) RC.net.hit(o.i, { k: 'bolt' }) }) } if (c.i === RC.me) { sfx('rNitro'); RC.msg = { text: 'LIGHTNING!', sub: '', color: '#fff27a', t: 1.2 } } }
  c.itemN--
  if (c.itemN <= 0) c.item = null
}
function kartTouch(c) {
  if (c.finished) return
  const tk = RC.tk, N = tk.N
  for (const b of RC.boxes) {
    if (b.t > 0) continue
    const di = ((c.idx - b.idx + N + N / 2) % N) - N / 2
    if (Math.abs(di) < 1.7 && Math.abs(c.lat - b.lat) < 3.4 && !c.remote) {
      b.t = 4
      if (!c.item) { c.item = rollItem(c); c.itemN = c.item === 'triple' ? 3 : 1; c.itemT = 0.8 + Math.random() * 1.6; if (c.i === RC.me) sfx('coin') }
      for (let i = 0; i < 8; i++) fx(c.x, 2, c.z, R(-6, 6), R(2, 8), R(-6, 6), 0.5, '#ffe84a', 0.6)
    }
  }
  for (const it of RC.items) {
    if (it.dead || (it.owner === c.i && RC.t - it.t0 < 1.2)) continue
    if (Math.hypot(it.x - c.x, it.z - c.z) < 3.4) {
      if (c.star > 0) { it.dead = true; if (isGuest()) { RC.deadIds[it.id] = true; evSend({ k: 'itemhit', id: it.id }) } continue }
      it.dead = true
      hitCar(c, 'banana')
      if (isGuest()) { RC.deadIds[it.id] = true; evSend({ k: 'itemhit', id: it.id }) }
    }
  }
  RC.items = RC.items.filter((x) => !x.dead)
}
function kartWorld(dt) {
  for (const b of RC.boxes) if (b.t > 0) b.t -= dt
  RC.items = RC.items.filter((x) => RC.t - x.t0 < 40)
  for (const sh of RC.shells) {
    const tg = sh.target >= 0 ? RC.cars[sh.target] : null
    const spd = sh.k === 'blue' ? 175 : 140
    if (tg) { const dx = tg.x - sh.x, dz = tg.z - sh.z, d = Math.hypot(dx, dz) || 1; sh.dx = dx / d; sh.dz = dz / d }
    sh.x += sh.dx * spd * dt; sh.z += sh.dz * spd * dt; sh.life -= dt
    for (const o of RC.cars) {
      if (o.i === sh.owner && sh.life > (sh.k === 'blue' ? 13 : 4.6)) continue
      if (tg && o !== tg) continue
      if (Math.hypot(o.x - sh.x, o.z - sh.z) < (sh.k === 'blue' ? 6 : 3.6)) {
        sh.life = 0
        if (sh.k === 'blue') { for (const q of RC.cars) if (Math.hypot(q.x - o.x, q.z - o.z) < 14) hitCar(q, 'blue') } else hitCar(o, 'shell')
        for (let i = 0; i < 16; i++) fx(sh.x, 1.8, sh.z, R(-14, 14), R(3, 14), R(-14, 14), 0.6, sh.k === 'blue' ? '#4da8ff' : '#ff4a2a', 1)
        break
      }
    }
  }
  RC.shells = RC.shells.filter((s) => s.life > 0)
}
function aiItem(c, dt) {
  if (!c.item || c.itemT > 0 || c.spin > 0 || c.finished) return
  const it = c.item
  let ok = false
  const fx_ = Math.sin(c.th), fz_ = -Math.cos(c.th)
  if (it === 'boost' || it === 'triple') ok = Math.abs(c.inp.steer) < 0.35
  else if (it === 'banana') ok = RC.cars.some((o) => { if (o === c) return false; const dx = o.x - c.x, dz = o.z - c.z; return dx * fx_ + dz * fz_ < -4 && Math.hypot(dx, dz) < 26 })
  else if (it === 'shell') ok = (c.rank || 1) > 1 || c.itemT < -6
  else ok = true
  if (!ok) { c.itemT -= dt * 0 ; c.itemW = (c.itemW || 0) + dt; if (c.itemW > 7) ok = true }
  if (ok) { c.itemW = 0; useItem(c); c.itemT = it === 'triple' ? 0.9 : 1.5 }
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
  c.inp.nitro = !RC.cfg.kart && !!(k.ShiftLeft || k.ShiftRight || k.KeyE)
  const fk = !!(k.KeyF || k.KeyQ || (RC.cfg.kart && (k.ShiftLeft || k.ShiftRight || k.KeyE)))
  if (fk && !c.fHeld) { c.fHeld = true; if (RC.phase === 'race') useItem(c) } else if (!fk) c.fHeld = false
}

// ---------- loop ----------
function update(dtRaw) {
  const dt = Math.min(dtRaw, 0.04)
  if (RC.mode === 'idle' || RC.paused) return
  RC.t += dt
  if (RC.storm && RC.phase === 'race') { RC.stormT -= dt; if (RC.stormT <= 0) { RC.stormT = 9 + Math.random() * 10; flash(0.55, [0.8, 0.85, 1]); G.shake = Math.max(G.shake, 0.3); sfx('distant') } }
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
    if (c.human) humanInput(c); else { aiDrive(c, dt); if (RC.cfg.kart && RC.phase === 'race') aiItem(c, dt) }
    if ((RC.phase === 'race') && !c.finished && c.sp < 4 && (c.inp.thr > 0 || !c.human)) { c.stuck = (c.stuck || 0) + dt; if (c.stuck > (c.human ? 4 : 2.2)) respawn(c) } else c.stuck = 0
    if (c.human && keys.KeyR && RC.phase === 'race' && c.sp < 60 && !c.rHeld) { c.rHeld = true; respawn(c) } else if (!keys.KeyR) c.rHeld = false
    if (RC.phase === 'ready') { if (c.human) { c.inp.thr = 0 } else { c.inp.thr = 0 }; if (RC.count < 0.7 && !c.human) c.inp.thr = 1 }
    stepCar(c, dt)
  }
  carBumps()
  rankOf()
  if (RC.cfg.kart && !(RC.net && RC.net.role === 'guest')) kartWorld(dt)
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
    recordScore(RC.cfg.kart ? 'kart' : 'race', score)
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
const carSnap = (c) => [c.i, r2(c.x), r2(c.z), r2(c.th), r2(c.vx), r2(c.vz), c.lap, r2(c.prog), c.finished ? 1 : 0, r2(c.finishT), c.boostT > 0 ? 1 : 0, c.drifting ? 1 : 0, r2(c.nitro), c.lights, c.star > 0 ? 1 : 0, c.spin > 0 ? 1 : 0, c.slowT > 0 ? 1 : 0]
function netTick(dt) {
  nT -= dt
  if (nT <= 0) { nT = RC.net.fast && RC.net.fast() ? 0.05 : 0.15; RC.net.state({ n: ++nSeq, ph: RC.phase, t: r2(RC.t), cnt: r2(RC.count), cars: RC.cars.map(carSnap), cfg: RC.cfg, it: RC.items.map((x) => [x.id, x.k, r2(x.x), r2(x.z)]), sh: RC.shells.map((x) => [x.id, x.k, r2(x.x), r2(x.z)]) }) }
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
    c.boostT = a[10] ? 1 : 0; c.drifting = !!a[11]; c.nitro = a[12]; c.lights = a[13]; c.star = a[14] ? 1 : 0; c.spin = a[15] ? 0.2 : 0; c.slowT = a[16] ? 1 : 0
    if (Math.hypot(c.x - c.tx, c.z - c.tz) > 25) { c.x = c.tx; c.z = c.tz; c.th = c.tth }
  },
  // guest: the host's full field (AI cars and relayed friends) and the race clock
  applyState(s) {
    if (!RC.net || RC.net.role !== 'guest' || !s || s.n <= lastN || RC.mode === 'idle') return
    lastN = s.n
    if (s.ph === 'ready') { RC.count = s.cnt; RC.phase = 'ready' }
    else if (RC.phase === 'ready' && s.ph === 'race') { RC.phase = 'race' }
    for (const a of s.cars) raceNet.applyCar(a)
    if (s.it) RC.items = s.it.map((a) => ({ id: a[0], k: a[1], x: a[2], z: a[3], t0: -9 })).filter((x) => !RC.deadIds[x.id])
    if (s.sh) RC.shells = s.sh.map((a) => ({ id: a[0], k: a[1], x: a[2], z: a[3] }))
    if (s.ph === 'results' && RC.phase !== 'results') { const me = RC.cars[RC.me]; if (me && !me.finished) { me.finished = true; me.finishT = RC.t } finishRace() }
  },
  // kart items: a driver's request to the host, and the host's hit notices back to a driver
  hostEvent(i, d) {
    const c = RC.cars[i]
    if (!c || !d) return
    if (d.k === 'drop') addItem(d.t === 'banana' ? 'banana' : 'banana', +d.x || 0, +d.z || 0, i)
    else if (d.k === 'shell') fireShell(c, d.t === 'blue' ? 'blue' : 'shell')
    else if (d.k === 'bolt') boltAll(c)
    else if (d.k === 'itemhit') { RC.items = RC.items.filter((x) => x.id !== d.id) }
  },
  guestEvent(d) {
    const me = RC.cars[RC.me]
    if (d && d.k === 'hit' && me) hitCar(me, d.kind, true)
    else if (d && d.k === 'bolt' && me) { if (me.star <= 0) { me.slowT = 3.5; me.hitInv = 0.8 }; G.flash = Math.max(G.flash || 0, 0.6) }
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
// ---------- the 4th dimension: time of day and weather ----------
const DAYLEN = 200 // seconds for a full day (and night) while you race
const hx = (a) => '#' + a.map((v) => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, '0')).join('')
const mixc = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t) }
let ENVC = null
export function raceEnv() {
  if (!RC.tk) return { sky: '#102040', fog: '#102040', fogNear: 160, fogFar: 900, amb: 1, dir: 1.5, sunI: 1.6, sunColor: '#ffffff', night: 0, day: 1, tod: 0.5, glow: null, sun: { x: 0, y: 500, z: 0 }, weather: 'clear', label: '' }
  const T = RC.tk.T, tod = ((RC.tod0 || 0) + (RC.phase === 'ready' ? 0 : RC.t) / DAYLEN) % 1
  const el = Math.sin((tod - 0.25) * TAU), day = sstep(-0.12, 0.3, el), night = 1 - day, glowH = clamp(1 - Math.abs(el) / 0.3, 0, 1)
  const wx = RC.weather || 'clear'
  const gray = wx === 'rain' ? [0.34, 0.38, 0.44] : wx === 'snow' ? [0.78, 0.82, 0.88] : wx === 'fog' ? [0.62, 0.66, 0.7] : null
  const gk = wx === 'rain' ? 0.6 : wx === 'snow' ? 0.5 : wx === 'fog' ? 0.75 : 0
  const base = (c, nightC) => { let v = mixc(nightC, [...lc(c)], day); v = mixc(v, [1, 0.5, 0.25], glowH * 0.5 * (1 - gk * 0.5)); return gray ? mixc(v, [gray[0] * (0.25 + 0.75 * day), gray[1] * (0.25 + 0.75 * day), gray[2] * (0.25 + 0.75 * day)], gk) : v }
  const sky = base(T.sky, [0.03, 0.04, 0.12]), fog = base(T.fog, [0.04, 0.05, 0.14])
  const nf = { clear: [160, 900], rain: [80, 520], fog: [20, 240], snow: [60, 400] }[wx]
  const lamp = night > 0.4
  const me = RC.cars[RC.me]
  const ang = (tod - 0.25) * TAU
  const e = {
    sky: hx(sky), fog: hx(fog), fogNear: nf[0] * (0.5 + 0.5 * day), fogFar: nf[1] * (0.55 + 0.45 * day), night, day, tod, weather: wx, lamp,
    amb: (0.3 + 0.9 * day) * (gk ? 1 - gk * 0.25 : 1), dir: (0.25 + 1.9 * day) * (gk ? 1 - gk * 0.45 : 1), sunI: (0.3 + 1.5 * day) * (gk ? 1 - gk * 0.5 : 1),
    sunColor: hx(mixc(mixc([0.6, 0.7, 1], [1, 0.95, 0.82], day), [1, 0.55, 0.25], glowH * 0.7)),
    sun: { x: Math.cos(ang) * 700, y: Math.max(40, el * 650 + 40), z: -280 },
    glow: me ? { x: me.x + Math.sin(me.th) * 14, y: 6, z: me.z - Math.cos(me.th) * 14, color: '#ffe6b0', intensity: night * 3.6, distance: 120 } : null,
    label: (day > 0.85 ? 'DAY' : night > 0.85 ? 'NIGHT' : el > 0 === (tod < 0.5) && tod < 0.5 ? 'SUNRISE' : 'SUNSET') + (wx === 'clear' ? '' : ' · ' + wx.toUpperCase()),
  }
  ENVC = e
  return e
}
// ---------- scenery: built once per track as plain lists, drawn around the camera every frame (so a track can be any size) ----------
const sceneCache = {}
const h2 = (a, b) => { let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296 }
function buildScene(tk, ti) {
  const key = ti + ':' + tk.K
  if (sceneCache[key]) return sceneCache[key]
  const T = tk.T, P = tk.P, N = tk.N, W = tk.W
  const segs = []
  for (let i = 0; i < N; i++) { const a = P[i], b = P[(i + 1) % N]; segs.push({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, len: Math.hypot(b.x - a.x, b.z - a.z) + 0.5, ry: Math.atan2(-(b.z - a.z), b.x - a.x), nx: a.nx, nz: a.nz, i }) }
  let minx = 1e9, maxx = -1e9, minz = 1e9, maxz = -1e9
  for (const p of P) { minx = Math.min(minx, p.x); maxx = Math.max(maxx, p.x); minz = Math.min(minz, p.z); maxz = Math.max(maxz, p.z) }
  const cx = (minx + maxx) / 2, cz = (minz + maxz) / 2, rad = Math.max(maxx - minx, maxz - minz) / 2
  const r2s = rng(ti * 101 + 3 + tk.K * 7)
  // a coarse grid of road points so "is this spot clear of the road" is fast
  const grid = new Map(), GS = 60
  P.forEach((p) => { const k = Math.floor(p.x / GS) + ',' + Math.floor(p.z / GS); (grid.get(k) || grid.set(k, []).get(k)).push(p) })
  const nearRoad = (x, z, d) => { const gx = Math.floor(x / GS), gz = Math.floor(z / GS); for (let i = gx - 2; i <= gx + 2; i++) for (let j = gz - 2; j <= gz + 2; j++) { const l = grid.get(i + ',' + j); if (l) for (const p of l) if (Math.hypot(p.x - x, p.z - z) < d) return true } return false }
  const props = []
  const count = Math.min(4200, Math.round(340 * Math.sqrt(tk.K) * tk.K * 0.6 + 340))
  for (let k = 0; k < count; k++) {
    const i = Math.floor(r2s() * N), p = P[i], side = r2s() < 0.5 ? -1 : 1, dist = W / 2 + 14 + r2s() * (90 + 40 * tk.K)
    const x = p.x + p.nx * side * dist, z = p.z + p.nz * side * dist
    if (nearRoad(x, z, W / 2 + 12)) continue
    props.push({ x, z, sc: 0.8 + r2s() * 1.1, ry: r2s() * 3, s: r2s(), s2: r2s(), s3: r2s(), kind: T.scenery })
  }
  // lamp posts and little grandstands/billboards beside the road
  const lamps = []
  for (let i = 0; i < N; i += Math.max(6, 10 - tk.K)) for (const sd of [-1, 1]) { const p = P[i]; if (((i / 8) | 0) % 2 === (sd > 0 ? 0 : 1)) lamps.push({ x: p.x + p.nx * sd * (W / 2 + 4), z: p.z + p.nz * sd * (W / 2 + 4), sd, i }) }
  const mounts = []
  for (let i = 0; i < 34; i++) { const a = (i / 34) * TAU + r2s() * 0.2, d = rad + 700 + r2s() * 300, h = 90 + r2s() * 190; mounts.push({ x: cx + Math.cos(a) * d, z: cz + Math.sin(a) * d, h, w: 140 + r2s() * 160, w2: 140 + r2s() * 160, ry: r2s() * 3, s: 0.7 + r2s() * 0.4 }) }
  const sc = { segs, props, lamps, mounts, cx, cz, rad }
  sceneCache[key] = sc
  return sc
}
function drawScene(api, env, camX, camZ, t) {
  const { put3, putS } = api
  const tk = RC.tk, T = tk.T, W = tk.W, P = tk.P
  const sc = buildScene(tk, RC.cfg.track)
  const col = (hex, k = 1) => { const c = lc(hex); return [c[0] * k, c[1] * k, c[2] * k] }
  const dl = 0.35 + 0.65 * env.day // the lit pass shades the world, but flat colours should also fall with the sun
  const g = col(T.ground, 1), road = col(T.road), acc = col(T.accent)
  const wind = Math.sin(t * 0.7) * 0.5 + Math.sin(t * 1.9 + 1) * 0.25 + (env.weather === 'rain' ? Math.sin(t * 4) * 0.3 : 0)
  // ground follows the camera
  put3(camX, -1.2, camZ, 1900, 2, 1900, 0, g[0] * (T.scenery === 'snow' ? 1 : 0.9) * (env.weather === 'snow' ? 1.25 : 1), g[1] * (env.weather === 'snow' ? 1.3 : 1), g[2] * (env.weather === 'snow' ? 1.3 : 1), 0)
  // distant mountains
  for (const m of sc.mounts) {
    const dx = m.x - camX, dz = m.z - camZ; if (dx * dx + dz * dz > 2400 * 2400) continue
    const mc = T.scenery === 'city' ? col('#2a1a60', 1 + m.s * 0.4) : T.scenery === 'snow' ? col('#c8e0f0', 0.8 + m.s * 0.3) : T.scenery === 'cacti' ? col('#a06a3a', 0.8 + m.s * 0.3) : col('#5a7aa0', 0.6 + m.s * 0.4)
    put3(m.x, m.h / 2 - 2, m.z, m.w, m.h, m.w2, 0, mc[0] * dl, mc[1] * dl, mc[2] * dl, m.ry)
    if (m.h > 150) put3(m.x, m.h - 8, m.z, m.w * 0.4, 18, m.w2 * 0.4, 0, 1.2 * dl, 1.2 * dl, 1.3 * dl, m.ry)
  }
  // the road around the camera
  const R2 = 330 * 330
  for (const s of sc.segs) {
    const dx = s.x - camX, dz = s.z - camZ; if (dx * dx + dz * dz > R2) continue
    const wet = env.weather === 'rain' ? 0.75 : 1
    put3(s.x, 0, s.z, s.len, 0.5, W, 0, road[0] * wet, road[1] * wet, road[2] * wet * (env.weather === 'rain' ? 1.15 : 1), s.ry)
    const odd = s.i % 2
    for (const sd of [-1, 1]) {
      const kx = s.x + s.nx * sd * (W / 2 + 1), kz = s.z + s.nz * sd * (W / 2 + 1)
      put3(kx, 0.12, kz, s.len, 0.6, 2, 0, odd ? 1.4 : 1.4, odd ? 0.2 : 1.4, odd ? 0.2 : 1.4, s.ry)
      if (odd === 0) put3(s.x + s.nx * sd * (W / 2 + 7), 0.9, s.z + s.nz * sd * (W / 2 + 7), s.len + 0.4, 2.2, 1, 0, acc[0] * 0.9, acc[1] * 0.9, acc[2] * 0.9, s.ry)
    }
    if (s.i % 4 === 0) put3(s.x, 0.3, s.z, s.len * 0.55, 0.2, 0.7, 0, 1.5, 1.5, 1.5, s.ry)
    if (env.weather === 'rain' && s.i % 3 === 0) put3(s.x + s.nx * ((s.i * 7) % 9 - 4), 0.28, s.z + s.nz * ((s.i * 7) % 9 - 4), 5, 0.05, 2, 0, 0.35, 0.42, 0.6, s.ry) // puddles
  }
  // start / finish gantry
  { const p = P[0], ry = Math.atan2(-p.dz, p.dx)
    for (let k = 0; k < 10; k++) for (let j = 0; j < 2; j++) put3(p.x + p.dx * (j - 0.5) * 2 + p.nx * (k - 4.5) * (W / 10), 0.32, p.z + p.dz * (j - 0.5) * 2 + p.nz * (k - 4.5) * (W / 10), 2, 0.2, W / 10, 0, (k + j) % 2 ? 1.8 : 0.1, (k + j) % 2 ? 1.8 : 0.1, (k + j) % 2 ? 1.8 : 0.1, ry)
    for (const sd of [-1, 1]) put3(p.x + p.nx * sd * (W / 2 + 3), 7, p.z + p.nz * sd * (W / 2 + 3), 2, 14, 2, 0, 0.5, 0.5, 0.6, ry)
    put3(p.x, 14, p.z, 2, 3, W + 8, 0, acc[0] * 1.4, acc[1] * 1.4, acc[2] * 1.4, ry)
    // a little crowd and grandstand
    for (const sd of [-1, 1]) { put3(p.x + p.nx * sd * (W / 2 + 20) - p.dx * 10, 3, p.z + p.nz * sd * (W / 2 + 20) - p.dz * 10, 6, 6, 40, 0, 0.3, 0.3, 0.4, ry); for (let q = 0; q < 14; q++) put3(p.x + p.nx * sd * (W / 2 + 16.5) - p.dx * (q * 2.7 - 6), 7 + (q % 3) * 0.4 + Math.abs(Math.sin(t * 5 + q)) * (RC.phase === 'finish' ? 1.2 : 0.3), p.z + p.nz * sd * (W / 2 + 16.5) - p.dz * (q * 2.7 - 6), 1.6, 1.8, 1.6, 0, ...hxr(q + sd)) } }
  // lamp posts (they light up at night)
  for (const l of sc.lamps) {
    const dx = l.x - camX, dz = l.z - camZ; if (dx * dx + dz * dz > 260 * 260) continue
    const on = env.night > 0.35 ? 1 : 0
    put3(l.x, 5, l.z, 0.5, 10, 0.5, 0, 0.3, 0.3, 0.35, 0); put3(l.x, 10.4, l.z, 2.2, 0.6, 1, 0, 0.3, 0.3, 0.35, 0)
    put3(l.x - l.sd * 0.4, 10, l.z, 1.6, 0.5, 0.8, 0, 0.9 + on * 2.2, 0.85 + on * 1.8, 0.6 + on * 0.8, 0)
  }
  // props: trees sway in the wind, windows glow at night, cacti, snowy pines
  const PR = 440 * 440
  for (const q of sc.props) {
    const dx = q.x - camX, dz = q.z - camZ; if (dx * dx + dz * dz > PR) continue
    const x = q.x, z = q.z, s = q.sc, sway = wind * 0.04
    if (q.kind === 'trees') {
      const lf = col(q.s < 0.5 ? '#2f8a3a' : '#3aa04a', 0.8 + q.s2 * 0.4), autumn = env.tod > 0.7 && q.s3 < 0.3
      const lr = autumn ? 1.5 : lf[0], lg = autumn ? 0.8 : lf[1], lb = autumn ? 0.2 : lf[2]
      treeModel(api,x,0,z,14*s,q.s*37,t,{kind:q.s3>.7?'pine':'oak',leaf:[lr,lg,lb],low:dx*dx+dz*dz>180*180})
    } else if (q.kind === 'city') {
      const h = 30 + q.s * 90, w = 14 + q.s2 * 14, b = col(['#1a1a3a', '#241a4a', '#14284a'][(q.s3 * 3) | 0], 1 + q.s * 0.6)
      put3(x, h / 2, z, w, h, w, 0, b[0], b[1], b[2], q.ry)
      const lit = 0.5 + env.night * 1.6
      for (let y = 6; y < h - 4; y += 7) put3(x + 0.1, y, z, w + 0.4, 1.4, w * 0.9, 0, acc[0] * (((y * 7 + (q.s * 99) | 0) % 3) ? lit : 0.3), acc[1] * 1.2 * lit * 0.8, acc[2] * 1.8 * lit * 0.8, q.ry)
      if (q.s3 < 0.3) put3(x, h + 2, z, 1, 4, 1, 0, 2.4, 0.3, 0.3 + (Math.sin(t * 3 + q.s * 9) > 0 ? 1.4 : 0), 0)
    } else if (q.kind === 'snow') {
      const lf = col('#d8f0ff', 0.9 + q.s2 * 0.3)
      treeModel(api,x,0,z,14*s,q.s*37,t,{kind:'snow',leaf:[.13,.32,.27],low:dx*dx+dz*dz>180*180})
    } else {
      const cg = col('#3a8a3a', 0.8 + q.s2 * 0.4)
      put3(x, 4 * s, z, 2 * s, 8 * s, 2 * s, 0, cg[0], cg[1], cg[2], 0); put3(x + 2.2 * s, 5.5 * s, z, 3 * s, 1.4 * s, 1.4 * s, 0, cg[0], cg[1], cg[2], 0); put3(x + 3.4 * s, 7 * s, z, 1.4 * s, 3 * s, 1.4 * s, 0, cg[0], cg[1], cg[2], 0)
      if (q.s3 < 0.4) { const rk = col('#a07a4a', 0.8 + q.s * 0.4); put3(x + 8, 2 * s, z + 5, 7 * s, 4 * s, 6 * s, 0, rk[0], rk[1], rk[2], q.ry) }
    }
  }
  // the sky: sun and moon, stars after dark
  const cam3 = CAM, sx = cam3.x + env.sun.x, sy = env.sun.y, sz = cam3.z + env.sun.z
  if (env.day > 0.05 && env.weather !== 'rain') putS(sx, sy, sz, 90, 90, 90, 3 * env.day + 0.3, 2.4 * env.day + 0.3, 1.2 * env.day)
  if (env.night > 0.1) {
    putS(cam3.x - env.sun.x * 0.8, 520, cam3.z - 380, 64, 64, 64, 1.6 * env.night, 1.7 * env.night, 2.2 * env.night)
    if (env.weather === 'clear' || env.weather === 'snow') for (let i = 0; i < 150; i++) { const a = h2(i, 1) * TAU, e = 0.25 + h2(i, 2) * 0.7, rr = 760; put3(cam3.x + Math.cos(a) * rr * Math.cos(e), 90 + Math.sin(e) * rr * 0.9, cam3.z + Math.sin(a) * rr * Math.cos(e), 3, 3, 3, 0, (1 + Math.sin(t * 3 + i)) * env.night * 1.6 + 0.2, (1 + Math.sin(t * 3 + i)) * env.night * 1.6 + 0.2, env.night * 2 + 0.2, 0) }
  }
  // weather: rain streaks, snowflakes, wind-blown dust
  if (env.weather === 'rain' || env.weather === 'snow') {
    const n = env.weather === 'rain' ? 170 : 130
    for (let i = 0; i < n; i++) {
      const rx = (h2(i, 11) * 2 - 1) * 70, rz = (h2(i, 12) * 2 - 1) * 70, spd = env.weather === 'rain' ? 70 : 9, hh = 46
      const y = hh - ((h2(i, 13) * hh + t * spd) % hh)
      if (env.weather === 'rain') put3(camX + rx + wind * 4, y, camZ + rz, 0.07, 2.4, 0.07, 0, 0.55, 0.65, 1, 0)
      else put3(camX + rx + Math.sin(t * 0.8 + i) * 2.4, y, camZ + rz + Math.cos(t * 0.6 + i) * 1.6, 0.3, 0.3, 0.3, 0, 1.6, 1.7, 1.9, i)
    }
  }
}
const hxr = (q) => { const k = Math.abs(Math.sin(q * 12.9898)) ; return [0.4 + k, 0.3 + (1 - k) * 0.8, 0.5 + ((k * 7) % 1)] }
function draw() { /* the race is drawn entirely in the lit 3D pass (draw3) */ }
function draw3(api) {
  const { put3, putS } = api
  if (!RC.tk) return
  const env = raceEnv(), cm = RC.cars[RC.me] || { x: CAM.tx, z: CAM.tz }
  drawScene(api, env, CAM.tx, CAM.tz, G.time)
  const N = RC.tk.N, P = RC.tk.P, W = RC.tk.W
  const T = RC.tk.T, acc = lc(T.accent), t = G.time
  // pads and canisters
  for (const pd of RC.pads) { const p = P[pd.idx], ry = -Math.atan2(p.dz, p.dx); for (let k = 0; k < 3; k++) put3(p.x + p.dx * (k * 2.4 - 2.4) + p.nx * pd.lat, 0.4, p.z + p.dz * (k * 2.4 - 2.4) + p.nz * pd.lat, 4.6, 0.25, 6.4 - k * 1.2, 0, 0.4 + (Math.sin(t * 10 - k) * 0.5 + 0.5), 1.4, 2.4, ry) }
  for (const cn of RC.cans) { if (cn.t > 0) continue; const p = P[cn.idx]; put3(p.x + p.nx * cn.lat, 2.4 + Math.sin(t * 3 + cn.idx) * 0.4, p.z + p.nz * cn.lat, 1.6, 2.6, 1.6, 0, 0.3, 2.2, 1.0, t * 2) }
  for (const b of RC.boxes || []) { if (b.t > 0) continue; const p = P[b.idx], h = (t * 0.6 + b.idx * 0.1) % 1, hue = [Math.sin(h * TAU) * 0.5 + 0.5, Math.sin(h * TAU + 2.1) * 0.5 + 0.5, Math.sin(h * TAU + 4.2) * 0.5 + 0.5]; put3(p.x + p.nx * b.lat, 3.2 + Math.sin(t * 3 + b.idx) * 0.5, p.z + p.nz * b.lat, 2.6, 2.6, 2.6, 0, hue[0] * 1.6 + 0.3, hue[1] * 1.6 + 0.3, hue[2] * 1.6 + 0.3, t * 1.5); put3(p.x + p.nx * b.lat, 3.2 + Math.sin(t * 3 + b.idx) * 0.5, p.z + p.nz * b.lat, 1.2, 1.2, 1.2, 0, 2, 2, 2, -t * 2) }
  for (const it of RC.items || []) { put3(it.x, 0.9, it.z, 2.6, 0.7, 1.2, 0, 2.2, 1.9, 0.2, t * 2); put3(it.x, 1.3, it.z, 1.2, 0.6, 2.4, 0, 2.2, 1.9, 0.2, t * 2); put3(it.x, 2.4 + Math.sin(t * 4) * 0.3, it.z, 0.5, 0.5, 0.5, 0, 2.5, 0.4, 0.2, 0) }
  for (const sh of RC.shells || []) { const bl = sh.k === 'blue', sz = bl ? 3.2 : 2.4; put3(sh.x, 1.8, sh.z, sz, sz * 0.8, sz, 0, bl ? 0.2 : 2.4, bl ? 0.5 : 0.25, bl ? 2.6 : 0.2, t * 14); put3(sh.x, 2.5, sh.z, sz * 0.5, sz * 0.4, sz * 0.5, 0, 2, 2, 2, 0); if (bl) for (let k = 0; k < 4; k++) put3(sh.x + Math.cos(k * 1.57 + t * 8) * 2, 1.8, sh.z + Math.sin(k * 1.57 + t * 8) * 2, 0.8, 0.8, 0.8, 0, 2, 2, 2.4, 0) }
  for (const c of RC.cars) drawCar3(api.putBody || put3, c, t, api.putCyl || put3)
  // particles: smoke, sparks and boost flames (bright boxes)
  for (const f of RC.fx) { const k = f.life / f.max, c = lc(f.color), sz = f.size * (0.4 + 0.6 * k); put3(f.x, f.y, f.z, sz, sz, sz, 0, c[0] * 1.5 * k + 0.1, c[1] * 1.5 * k + 0.1, c[2] * 1.5 * k + 0.1) }
  const me = RC.cars[RC.me]
  // speed lines while the player is boosting
  if (me && (me.boostT > 0 || me.sp > BASE_TOP * 1.1)) {
    const fx_ = Math.sin(me.th), fz_ = -Math.cos(me.th), rx = Math.cos(me.th), rz = Math.sin(me.th), ry = -me.th
    for (let i = 0; i < 18; i++) { const a = (i * 2.399 + t * 3) % TAU, rr = 6 + ((i * 7 + t * 90) % 22), along = 8 + ((i * 13 + t * 120) % 34); put3(me.x + fx_ * along + rx * Math.cos(a) * rr, 2 + Math.abs(Math.sin(a)) * rr * 0.5, me.z + fz_ * along + rz * Math.cos(a) * rr, 0.14, 0.14, 6, 0, 1.6, 1.8, 2.4, ry) }
  }
}
function drawCar3(put3, c, t, wheel) {
  const col = lc(c.color), th = c.th, ry = -th
  const cs = Math.cos(ry), sn = Math.sin(ry)
  const roll = clamp(c.steer * c.sp * 0.0012, -0.12, 0.12) * (c.drifting ? 2 : 1)
  // local (lx sideways, lz along the car, + is forward) -> world; the car's forward axis is local -z
  const part = (lx, ly, lz, sx, sy, sz, r, g, b) => put3(c.x + lx * cs + lz * sn, ly + lx * roll, c.z - lx * sn + lz * cs, sx, sy, sz, 0, r, g, b, ry)
  const dark = [0.06, 0.06, 0.09]
  // wheels
  for (const [lx, lz] of [[-1.9, -2.3], [1.9, -2.3], [-1.9, 2.3], [1.9, 2.3]]) {
    const steer = lz < 0 ? c.steer * 0.35 : 0
    const wx = c.x + lx * cs + lz * sn, wz = c.z - lx * sn + lz * cs
    wheel(wx, 0.85, wz, 1.7, 0.9, 1.7, Math.PI / 2, ...dark, ry + steer)
    const side = Math.sign(lx), ax = Math.cos(ry + steer) * side, az = -Math.sin(ry + steer) * side
    wheel(wx + ax * 0.47, 0.85, wz + az * 0.47, 1.05, 0.08, 1.05, Math.PI / 2, 0.55, 0.59, 0.65, ry + steer)
    for (let spoke = 0; spoke < 4; spoke++) {
      const a = c.prog / 0.85 + spoke * Math.PI / 2
      put3(wx + ax * 0.52 + Math.sin(ry + steer) * Math.cos(a) * 0.3, 0.85 + Math.sin(a) * 0.3, wz + az * 0.52 + Math.cos(ry + steer) * Math.cos(a) * 0.3, 0.13, 0.16, 0.13, 0, 0.12, 0.14, 0.17)
    }
  }
  part(0, 1.35 + roll * 0, 0, 3.6, 0.9, 7.8, col[0], col[1], col[2])        // chassis
  part(0, 2.15, 0.6, 2.8, 0.9, 3.8, col[0] * 0.9, col[1] * 0.9, col[2] * 0.9) // cabin lower
  part(0, 3.0, 0.7, 2.5, 0.22, 2.5, ...col) // roof
  for (const side of [-1, 1]) {
    part(side * 1.75, 2.25, -0.65, 0.5, 0.3, 0.65, ...col) // mirrors
    part(side * 1.6, 1.25, 0.3, 0.24, 0.45, 4.2, col[0] * 0.65, col[1] * 0.65, col[2] * 0.65)
  }
  part(0, 1.35, -4.05, 2.1, 0.28, 0.16, ...dark)
  part(0, 2.55, 0.4, 2.4, 0.8, 2.6, 0.12, 0.2, 0.3)                          // glass
  part(0, 1.5, -3.5, 3.5, 0.6, 1.4, col[0] * 0.7, col[1] * 0.7, col[2] * 0.7) // nose
  part(0, 2.7, 3.2, 4.2, 0.35, 1.2, col[0] * 0.55, col[1] * 0.55, col[2] * 0.55) // spoiler
  part(-1.3, 2.2, 3.2, 0.4, 1.2, 0.5, 0.1, 0.1, 0.12); part(1.3, 2.2, 3.2, 0.4, 1.2, 0.5, 0.1, 0.1, 0.12)
  part(0, 1.95, -0.4, 0.5, 0.2, 5.4, 1.6, 1.6, 1.6) // racing stripe
  for (const sd of [-1, 1]) { part(sd * 1.2, 1.5, 3.8, 0.8, 0.5, 0.25, c.lights ? 3 : 1.1, 0.12, 0.12); part(sd * 1.2, 1.4, -3.9, 0.8, 0.5, 0.25, 2.6, 2.6, 2.2) }
  if (c.boostT > 0) for (const sd of [-0.6, 0.6]) part(sd, 1.1, 4.4 + Math.random() * 1.6, 1, 0.8, 2 + Math.random(), 2.6, 1.2, 0.2)
  if (c.drifting && c.charge > 0.9) part(0, 5.6, 0, 1.2, 1.2, 1.2, c.charge > 1.8 ? 2.4 : 0.6, c.charge > 1.8 ? 0.3 : 1.6, 2.4)
  if (c.human || c.i === RC.me) part(0, 3.6, 0.4, 0.9, 0.9, 0.9, 0.3, 2.4, 1.0) // beacon on your car
  if (c.star > 0) { const h = (t * 3) % 1; part(0, 4.8, 0.4, 5.4, 0.5, 8.6, Math.sin(h * TAU) * 0.8 + 1.2, Math.sin(h * TAU + 2.1) * 0.8 + 1.2, Math.sin(h * TAU + 4.2) * 0.8 + 1.2) }
  if (c.slowT > 0) part(0, 4.6, 0.4, 1.4, 1.4, 1.4, 1.8, 2, 0.4)
  if (RC.cfg.kart && c.item && c.i === RC.me) part(0, 5.4, 0.4, 1.1, 1.1, 1.1, 2, 2, 2)
}
if (typeof window !== 'undefined') { window.__RC = RC; window.__race = raceActions }
games.race = { update, onKey, draw, draw3, env: raceEnv, camera: raceCamera, sun: () => { const m = RC.cars[RC.me]; return { x: m ? m.x : 0, z: m ? m.z : 0 } }, stop, sky: () => raceEnv().sky, fog: () => raceEnv().fog, fov: () => 62 }
