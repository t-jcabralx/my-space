// 3D look of NEON DEFENSE: a little fantasy valley with a cobbled road, animated towers, walking monsters, flying bats, cannonballs and fire.
import { G } from './engine.js'
import { col, rng, clamp } from './pxl.js'
const TAU = Math.PI * 2
const hex = (h, k = 1) => { const c = col(h); return [c[0] * k, c[1] * k, c[2] * k] }
const sg = (a, b) => (a >= b ? 1 : -1)
void sg

export function tdCamera(TD, aspect, dt) {
  const s = G.shake || 0
  return { x: (Math.random() - 0.5) * s * 0.6, y: 56 + (Math.random() - 0.5) * s * 0.4, z: 40, tx: 0, ty: 0, tz: 2, fov: 40, far: 500, aspect }
}
export const tdLights = () => ({ sun: { x: -30, y: 70, z: 32, color: '#fff0d4', intensity: 1.15 }, ambient: 0.75, dir: 0.1, lantern: null })

let ENV = null
function build(TD, MAPS) {
  const r = rng(TD.map * 131 + 17), E = { key: TD.map + ':' + TD.seedKey, deco: [], trees: [], flowers: [] }
  for (let i = -3; i < 25; i++) for (let j = -2; j < 14; j++) {
    const x = -38 + i * 4, z = -(20 - j * 4)
    const inside = i >= 0 && i < 20 && j >= 0 && j < 11
    if (!inside && (z < 22 || r() < 0.2) && r() < 0.55) E.trees.push({ x: x + (r() - 0.5) * 3, z: z + (r() - 0.5) * 3, s: (z > 21 ? 0.55 : 0.9) + r() * 0.7, ph: r() * 6, kind: r() < 0.7 ? 0 : 1 })
    else if (inside && !TD.cells.has(i + ',' + j) && r() < 0.18) E.flowers.push({ x: x + (r() - 0.5) * 2.4, z: z + (r() - 0.5) * 2.4, c: [[3, 0.6, 0.9], [3, 2.4, 0.4], [0.8, 1.4, 3], [3, 3, 3]][(r() * 4) | 0], ph: r() * 6 })
    else if (inside && !TD.cells.has(i + ',' + j) && r() < 0.06) E.deco.push({ x: x + (r() - 0.5) * 2.4, z: z + (r() - 0.5) * 2.4, s: 0.5 + r() * 0.8, ry: r() * 3 })
  }
  return E
}
function drawTower(api, t, def, TD, time, sel, rangeOf) {
  const { put3, putS } = api, c = hex(def.color, 1.1), cd = hex(def.color, 0.55)
  const X = t.x, Z = -t.y, sc = 1 + (t.lvl - 1) * 0.13, rec = t.recoil || 0
  const ry = (t.ang || 0) + Math.PI / 2
  const fx = Math.sin(ry), fz = Math.cos(ry)
  // base: stone plinth + a team-colour ring that grows with the level
  put3(X, 0.5, Z, 3.4, 1, 3.4, 0, 0.32, 0.31, 0.34, 0); put3(X, 1.1, Z, 2.8, 0.4, 2.8, 0, 0.44, 0.42, 0.46, 0)
  for (let k = 0; k < t.lvl; k++) put3(X - 1.2 + k * 0.8, 1.35, Z + 1.55, 0.5, 0.35, 0.3, 0, 3, 2.4, 0.5)
  if (def.id === 'pulse') {
    put3(X, 2.2, Z, 1.9 * sc, 2, 1.9 * sc, 0, cd[0], cd[1], cd[2], ry)
    const base = 2.9 * sc
    put3(X, base, Z, 2.3 * sc, 1.1, 2.3 * sc, 0, c[0], c[1], c[2], ry)
    for (const sd of [-0.55, 0.55]) put3(X + Math.cos(ry) * sd * sc, base + 0.1, Z - Math.sin(ry) * sd * sc, 0.4, 0.4, (2.4 - rec * 6) * sc, 0, 0.5, 0.6, 0.7, ry)
    if (rec > 0.05) putS(X + fx * 3.2 * sc, base + 0.1, Z + fz * 3.2 * sc, 1.1, 1.1, 1.1, 3, 3, 2.4)
    putS(X, base + 0.9, Z, 0.7, 0.7, 0.7, c[0] * 2, c[1] * 2, c[2] * 2)
  } else if (def.id === 'cannon') {
    put3(X, 2.1, Z, 2.8 * sc, 1.8, 2.8 * sc, 0, 0.35, 0.24, 0.12, 0)
    const lift = 0.4 + (t.lvl) * 0.1
    for (let k = 0; k < 5; k++) put3(X + fx * (0.8 + k * 0.6 - rec * 3) * sc, 3.2 * sc + k * lift * 0.25, Z + fz * (0.8 + k * 0.6 - rec * 3) * sc, (1.5 - k * 0.04) * sc, (1.5 - k * 0.04) * sc, 0.8, 0, 0.12, 0.12, 0.14, ry)
    putS(X, 3.0 * sc, Z, 1.9 * sc, 1.9 * sc, 1.9 * sc, c[0] * 0.8, c[1] * 0.8, c[2] * 0.8)
    if (rec > 0.05) { putS(X + fx * 4.2 * sc, 4 * sc, Z + fz * 4.2 * sc, 1.8, 1.8, 1.8, 3, 2, 0.5); putS(X + fx * 5.2 * sc, 4.2 * sc, Z + fz * 5.2 * sc, 1.2, 1.2, 1.2, 1, 1, 1) }
  } else if (def.id === 'frost') {
    for (let k = 0; k < 4 + t.lvl; k++) { const a = (k / (4 + t.lvl)) * TAU + time * 0.8, h = 2.4 + (k % 2) * 1.2 + t.lvl * 0.3; put3(X + Math.cos(a) * 0.9, 1.4 + h / 2, Z + Math.sin(a) * 0.9, 0.55, h, 0.55, Math.cos(a) * 0.2, c[0] * 1.4, c[1] * 1.4, c[2] * 1.9, a) }
    const g = 0.8 + Math.sin(time * 4) * 0.2
    putS(X, 4.2 + t.lvl * 0.2 + Math.sin(time * 2) * 0.3, Z, 1.5 * sc, 1.5 * sc, 1.5 * sc, 1.2 * g, 2.2 * g, 3.2 * g)
    for (let k = 0; k < 3; k++) { const a = time * 2 + k * 2.1; putS(X + Math.cos(a) * 2, 3 + Math.sin(a * 1.7) * 0.8, Z + Math.sin(a) * 2, 0.3, 0.3, 0.3, 2, 3, 3.4) }
  } else if (def.id === 'sniper') {
    put3(X, 3, Z, 1.6 * sc, 4, 1.6 * sc, 0, 0.3, 0.28, 0.3, 0); put3(X, 5.4 * sc, Z, 2.4 * sc, 1.2, 2.4 * sc, 0, c[0] * 0.7, c[1] * 0.7, c[2] * 0.7, ry)
    put3(X + fx * (2.5 - rec * 2) * sc, 5.6 * sc, Z + fz * (2.5 - rec * 2) * sc, 0.5, 0.5, 5 * sc, 0, 0.14, 0.14, 0.16, ry)
    putS(X + fx * 0.6, 6.2 * sc, Z + fz * 0.6, 0.7, 0.7, 0.7, 3, 0.3, 0.3)
    if (rec > 0.05) putS(X + fx * 5.2 * sc, 5.7 * sc, Z + fz * 5.2 * sc, 1.6, 1.6, 1.6, 3, 2.6, 2)
  } else if (def.id === 'tesla') {
    for (let k = 0; k < 4; k++) put3(X, 1.8 + k * 1.1 * sc, Z, (2.4 - k * 0.45) * sc, 0.5, (2.4 - k * 0.45) * sc, 0, 0.5, 0.45, 0.2, time * (k % 2 ? 1 : -1) * 0.5)
    const g = 1 + Math.sin(time * 14) * 0.35 + (rec > 0 ? 1 : 0)
    putS(X, 6.3 * sc, Z, 1.8 * sc, 1.8 * sc, 1.8 * sc, 3.2 * g, 2.8 * g, 0.7 * g)
    for (let k = 0; k < 4; k++) { const a = time * 6 + k * 1.57, rr = 1.6 + Math.sin(time * 9 + k) * 0.4; putS(X + Math.cos(a) * rr, 6 * sc + Math.sin(a * 2) * 0.8, Z + Math.sin(a) * rr, 0.28, 0.28, 0.28, 3, 3, 1) }
  } else if (def.id === 'bank') {
    for (let k = 0; k < 3 + t.lvl; k++) put3(X, 1.6 + k * 0.55, Z, 2.2 * sc, 0.5, 2.2 * sc, 0, 3, 2.3 + (k % 2) * 0.2, 0.4, k * 0.4 + time * 0.2)
    putS(X, 4.8 + Math.sin(time * 3) * 0.5, Z, 1.5, 1.5, 0.35, 3, 2.6, 0.5)
    put3(X, 5 + Math.sin(time * 3) * 0.5 + 0.02, Z, 1.9, 0.12, 0.2, 0, 3, 3, 1, time * 3)
  }
  if (sel) { const R = rangeOf(t); for (let k = 0; k < 56; k++) { const a = (k / 56) * TAU; put3(X + Math.cos(a) * R, 0.15, Z + Math.sin(a) * R, 0.55, 0.2, 0.55, 0, 2, 2, 2.2, 0) } for (let k = 0; k < 4; k++) put3(X + Math.cos(k * 1.57 + time) * 2.6, 0.4, Z + Math.sin(k * 1.57 + time) * 2.6, 0.6, 0.4, 0.6, 0, 3, 3, 3) }
}
function drawEnemy(api, e, time, ENEMY) {
  const { put3, putS } = api, d = e.def, c = hex(d.c, 1), dk = hex(d.c, 0.55)
  const X = e.x, Z = -e.y
  // heading from the last frame's position
  if (e._lx !== undefined) { const dx = e.x - e._lx, dy = e.y - e._ly; if (Math.hypot(dx, dy) > 0.002) e._fa = Math.atan2(dy, dx) }
  e._lx = e.x; e._ly = e.y
  const fa = e._fa !== undefined ? e._fa : 0, ry = fa + Math.PI / 2, ca = Math.cos(ry), sa = Math.sin(ry)
  const P = (lx, ly, lz, sx, sy, sz, r, g, b, rz = 0) => put3(X + lx * ca + lz * sa, ly, Z - lx * sa + lz * ca, sx, sy, sz, rz, r, g, b, ry)
  const fl = e.flash > 0 ? 2.4 : 1, ice = e.slow > 0
  const cr = (k) => (ice ? 0.7 * k : c[0] * k * fl), cg = (k) => (ice ? 1.4 * k : c[1] * k * fl), cb = (k) => (ice ? 2.2 * k : c[2] * k * fl)
  const ph = time * (d.spd > 14 ? 16 : d.spd > 8 ? 10 : 6) * (ice ? 0.5 : 1) + e.jig, wk = Math.sin(ph), bob = Math.abs(wk) * 0.4
  const type = e.type
  if (d.air) {
    const hv = 5 + Math.sin(time * 3 + e.jig) * 0.6, fl2 = Math.sin(time * 26 + e.jig) * 0.9
    putS(X + 0.5, 0.05, Z + 0.5, 2.2, 0.1, 2.2, 0.02, 0.02, 0.03)
    putS(X, hv, Z, 1.8, 1.4, 2.4, cr(0.9), cg(0.9), cb(0.9)); putS(X, hv + 0.2, Z + 1.3, 1.1, 1.1, 1.1, cr(0.8), cg(0.8), cb(0.8))
    P(-1.8, hv + 0.3, 0, 3, 0.15, 1.6, cr(0.6), cg(0.6), cb(0.6), fl2); P(1.8, hv + 0.3, 0, 3, 0.15, 1.6, cr(0.6), cg(0.6), cb(0.6), -fl2)
    P(-0.3, hv + 0.4, 1.9, 0.3, 0.3, 0.1, 3, 0.4, 0.4); P(0.3, hv + 0.4, 1.9, 0.3, 0.3, 0.1, 3, 0.4, 0.4)
  } else if (type === 'swarm') {
    putS(X + 0.3, 0.05, Z + 0.3, 1.3, 0.08, 1.3, 0.02, 0.02, 0.03)
    putS(X, 0.7 + bob * 0.4, Z, 1.2, 0.9, 1.5, cr(0.9), cg(0.9), cb(0.9)); putS(X + Math.cos(ry) * 0.2, 0.9, Z - Math.sin(ry) * 0.2 + 0.8, 0.7, 0.6, 0.7, cr(0.7), cg(0.7), cb(0.7))
    for (let k = -1; k <= 1; k++) { P(-0.8, 0.25, k * 0.45 + wk * 0.2, 0.7, 0.1, 0.1, 0.1, 0.1, 0.12); P(0.8, 0.25, k * 0.45 - wk * 0.2, 0.7, 0.1, 0.1, 0.1, 0.1, 0.12) }
  } else if (type === 'tank' || type === 'boss') {
    const big = type === 'boss' ? 1.7 : 1, st = Math.abs(wk) * 0.5 * big
    putS(X + 0.6, 0.05, Z + 0.6, 4 * big, 0.1, 4 * big, 0.02, 0.02, 0.03)
    P(-0.9 * big, 1.1 * big + st * 0.2, wk * 0.7 * big, 1.1 * big, 2.2 * big, 1.2 * big, cr(0.45), cg(0.45), cb(0.45)); P(0.9 * big, 1.1 * big + st * 0.2, -wk * 0.7 * big, 1.1 * big, 2.2 * big, 1.2 * big, cr(0.45), cg(0.45), cb(0.45))
    P(0, 3.3 * big + st * 0.3, 0, 3.4 * big, 2.6 * big, 2.4 * big, cr(0.9), cg(0.9), cb(0.9))
    P(0, 3.1 * big, 1.25 * big, 2.8 * big, 1.9 * big, 0.3, 0.45, 0.46, 0.55)
    P(0, 5.4 * big + st * 0.3, 0.2 * big, 1.9 * big, 1.7 * big, 1.8 * big, cr(0.75), cg(0.75), cb(0.75))
    P(-0.5 * big, 5.5 * big, 1.15 * big, 0.4, 0.3, 0.12, 3, 0.4, 0.4); P(0.5 * big, 5.5 * big, 1.15 * big, 0.4, 0.3, 0.12, 3, 0.4, 0.4)
    P(-2.3 * big, 3.4 * big, 0.3, 1.1 * big, 2.4 * big, 1.1 * big, cr(0.6), cg(0.6), cb(0.6)); P(2.3 * big, 3.4 * big, 0.3, 1.1 * big, 2.4 * big, 1.1 * big, cr(0.6), cg(0.6), cb(0.6))
    if (type === 'boss') { P(-1.1, 7.2, 0.2, 0.6, 1.8, 0.6, 3, 2.4, 0.6, 0.35); P(1.1, 7.2, 0.2, 0.6, 1.8, 0.6, 3, 2.4, 0.6, -0.35); for (let k = 0; k < 5; k++) P(-1.6 + k * 0.8, 6.5, 0.2, 0.5, 0.9 + (k % 2) * 0.5, 0.5, 3, 2.4, 0.5); P(2.3 * big, 4.6, 0.8, 0.7, 3.4, 0.7, 0.3, 0.3, 0.36) }
    else { P(2.3, 2.6, 0.9, 0.5, 3, 0.5, 0.4, 0.28, 0.14) }
  } else { // grunt / runner: little goblins
    const run = type === 'runner', lean = run ? 0.5 : 0.15, sw = wk * (run ? 0.9 : 0.6)
    putS(X + 0.4, 0.05, Z + 0.4, 2, 0.1, 2, 0.02, 0.02, 0.03)
    P(-0.4, 0.8 + (sw > 0 ? sw * 0.2 : 0), sw, 0.55, 1.6, 0.6, cr(0.45), cg(0.45), cb(0.45)); P(0.4, 0.8 + (sw < 0 ? -sw * 0.2 : 0), -sw, 0.55, 1.6, 0.6, cr(0.45), cg(0.45), cb(0.45))
    P(0, 2.2 + bob, lean * 0.6, run ? 1.3 : 1.6, run ? 1.5 : 1.7, run ? 1.1 : 1.3, cr(0.9), cg(0.9), cb(0.9))
    P(0, 3.6 + bob, lean * 1.2 + 0.2, 1.5, 1.3, 1.4, cr(0.75), cg(0.95), cb(0.75)); P(-1, 3.8 + bob, 0.1, 0.9, 0.35, 0.3, cr(0.7), cg(0.9), cb(0.7), 0.4); P(1, 3.8 + bob, 0.1, 0.9, 0.35, 0.3, cr(0.7), cg(0.9), cb(0.7), -0.4)
    P(-0.35, 3.7 + bob, 0.95 + lean, 0.3, 0.3, 0.1, 3, 2.6, 0.5); P(0.35, 3.7 + bob, 0.95 + lean, 0.3, 0.3, 0.1, 3, 2.6, 0.5)
    P(-1.0, 2.4 + bob, 0.5 - sw * 0.5, 0.4, 0.4, 1.8, cr(0.6), cg(0.6), cb(0.6)); P(1.0, 2.4 + bob, 0.5 + sw * 0.5, 0.4, 0.4, 1.8, cr(0.6), cg(0.6), cb(0.6))
    if (!run) P(1.0, 2.5 + bob, 1.6 + sw * 0.5, 0.5, 0.5, 1.8, 0.4, 0.28, 0.14); else P(1.0, 2.5 + bob, 1.4, 0.2, 0.2, 1.6, 2.2, 2.2, 2.4)
  }
  if (ice) for (let k = 0; k < 4; k++) { const a = k * 1.57 + time; putS(X + Math.cos(a) * d.r * 1.1, 2 + Math.sin(a * 2) * 0.6, Z + Math.sin(a) * d.r * 1.1, 0.4, 0.4, 0.4, 1.4, 2.4, 3.2) }
  if (e.hp < e.max) { const w = d.r * 2.6 + 1, f = clamp(e.hp / e.max, 0, 1), y = (d.air ? 8 : d.boss ? 11 : d.r * 3 + 3.8); for (let u = 0; u < 10; u++) { const on = u / 10 < f; put3(X - w / 2 + (u + 0.5) * (w / 10), y, Z, w / 10 * 0.9, 0.5, 0.4, 0, on ? 0.2 : 0.5, on ? 2.4 : 0.1, on ? 0.4 : 0.1, 0) } }
  void ENEMY
}
export function drawTd3(api, TD, defs) {
  const { put3, putS } = api, time = G.time, { TOWERS, MAPS, rangeOf, ENEMY } = defs
  const key = TD.map + ':' + (TD.wp ? TD.wp.length : 0) + ':' + TD.gen
  if (!ENV || ENV.key !== key) { ENV = build(TD, MAPS); ENV.key = key }
  const E = ENV, mc = hex(MAPS[TD.map].color, 1)
  // ground, road
  for (let i = 0; i < 20; i++) for (let j = 0; j < 11; j++) {
    const x = -38 + i * 4, z = -(20 - j * 4), k = i + ',' + j
    if (TD.cells.has(k)) { const n = ((i * 7 + j * 3) % 5) * 0.03; put3(x, -0.15, z, 4.05, 0.5, 4.05, 0, 0.3 + n, 0.26 + n, 0.2 + n, 0); for (let q = 0; q < 3; q++) put3(x + (((i * 5 + q * 7) % 9) - 4) * 0.35, 0.15, z + (((j * 11 + q * 5) % 9) - 4) * 0.35, 1.1, 0.2, 0.9, ((i + q) % 4) * 0.4, 0.42, 0.38, 0.34, 0) }
    else { const n = ((i * 13 + j * 7) % 6) * 0.018, g = (i + j) % 2 ? [0.07, 0.26, 0.09] : [0.09, 0.3, 0.11]; put3(x, 0, z, 4.05, 0.7 + ((i * j) % 3) * 0.08, 4.05, 0, g[0] + n, g[1] + n, g[2] + n, 0) }
  }
  // lawn outside the board
  for (let i = -3; i < 24; i += 1) { put3(-38 + i * 4, -0.5, -24, 4.05, 0.5, 4.05, 0, 0.06, 0.22, 0.08, 0); put3(-38 + i * 4, -0.5, 24, 4.05, 0.5, 4.05, 0, 0.06, 0.22, 0.08, 0) }
  for (const f of E.flowers) { const sw = Math.sin(time * 2 + f.ph) * 0.15; put3(f.x + sw, 0.9, f.z, 0.12, 1.1, 0.12, 0, 0.1, 0.5, 0.12); putS(f.x + sw * 2, 1.6, f.z, 0.5, 0.5, 0.5, f.c[0], f.c[1], f.c[2]) }
  for (const d of E.deco) { put3(d.x, d.s * 0.4, d.z, d.s * 1.6, d.s * 0.8, d.s * 1.3, 0, 0.22, 0.22, 0.26, d.ry); put3(d.x + d.s * 0.3, d.s * 0.9, d.z, d.s * 0.9, d.s * 0.4, d.s * 0.8, 0, 0.1, 0.34, 0.12, d.ry) }
  for (const t of E.trees) { const sw = Math.sin(time * 1.2 + t.ph) * 0.2; put3(t.x, t.s * 2, t.z, 0.9 * t.s, 4 * t.s, 0.9 * t.s, 0, 0.25, 0.14, 0.07, 0); if (t.kind === 0) { for (let k = 0; k < 3; k++) put3(t.x + sw * (k + 1) * 0.4, (4 + k * 2) * t.s, t.z, (5 - k * 1.4) * t.s, 2.4 * t.s, (5 - k * 1.4) * t.s, 0, 0.05 + k * 0.03, 0.3 + k * 0.05, 0.1, k + t.ph) } else { putS(t.x + sw, 6 * t.s, t.z, 5.5 * t.s, 4.6 * t.s, 5.5 * t.s, 0.1, 0.4, 0.14); putS(t.x + 1.4 * t.s + sw, 5.4 * t.s, t.z + 0.8, 3.6 * t.s, 3 * t.s, 3.6 * t.s, 0.14, 0.5, 0.18) } }
  // spawn portal and castle
  const sx = TD.wp[0][0] + 4, sy = TD.wp[0][1]
  for (let k = 0; k < 16; k++) { const a = (k / 16) * TAU + time * 2; putS(sx + 1, 3.6 + Math.sin(a) * 3.2, -sy + Math.cos(a) * 1.0 * 0 + Math.cos(a) * 3.2, 0.8, 0.8, 0.8, 3, 0.5 + Math.sin(a + time) * 0.4, 0.5) }
  putS(sx + 1, 3.6, -sy, 3.4, 3.4, 0.6, 1.2 + Math.sin(time * 3) * 0.4, 0.15, 0.2)
  const ex = TD.wp[TD.wp.length - 1][0] - 2, ez = -TD.wp[TD.wp.length - 1][1], hit = TD.leakT > 0 ? 2.2 : 1
  put3(ex + 2, 3, ez, 3, 6, 9, 0, 0.5 * hit, 0.46 * hit, 0.42 * hit, 0); put3(ex + 2, 6.4, ez - 3.5, 3.2, 3, 3.2, 0, 0.55 * hit, 0.5 * hit, 0.45 * hit, 0); put3(ex + 2, 6.4, ez + 3.5, 3.2, 3, 3.2, 0, 0.55 * hit, 0.5 * hit, 0.45 * hit, 0)
  for (let k = 0; k < 3; k++) { put3(ex + 2, 8.3, ez - 4.5 + k * 1.6 + (k > 1 ? 1.2 : 0), 1.1, 1, 1.1, 0, 0.5, 0.46, 0.42, 0); put3(ex + 2, 8.3, ez + 1.6 + k * 1.6, 1.1, 1, 1.1, 0, 0.5, 0.46, 0.42, 0) }
  put3(ex + 3.6, 3, ez, 0.3, 4, 3, 0, 0.1, 0.06, 0.04, 0); put3(ex + 2, 11, ez - 3.5, 0.2, 3, 0.2, 0, 0.5, 0.5, 0.5, 0); put3(ex + 2.6 + Math.sin(time * 4) * 0.2, 11.8, ez - 3.5, 1.6, 0.9, 0.1, 0, 3, 0.3, 0.4, 0)
  // towers
  for (const t of TD.towers) drawTower(api, t, TOWERS.find((x) => x.id === t.id), TD, time, TD.sel === t, rangeOf)
  // hover / build preview
  if (TD.hover && TD.mode === 'play') {
    const [i, j] = TD.hover, k = i + ',' + j, def = TOWERS.find((x) => x.id === TD.build), free = !TD.cells.has(k) && !TD.occ[k]
    const x = -38 + i * 4, z = -(20 - j * 4)
    if (def && free && !TD.strikeArm) { const ok = TD.gold >= def.cost, cc = ok ? [0.4, 3, 0.9] : [3, 0.4, 0.4]; for (let q = 0; q < 8; q++) put3(x + Math.cos(q * 0.785 + time * 2) * 2.4, 0.5, z + Math.sin(q * 0.785 + time * 2) * 2.4, 0.7, 0.4, 0.7, 0, cc[0], cc[1], cc[2]); putS(x, 2.4 + Math.sin(time * 4) * 0.3, z, 2.2, 2.2, 2.2, cc[0] * 0.5, cc[1] * 0.5, cc[2] * 0.5); for (let q = 0; q < 48; q++) { const a = (q / 48) * TAU; put3(x + Math.cos(a) * def.range, 0.15, z + Math.sin(a) * def.range, 0.45, 0.2, 0.45, 0, 1.6, 1.8, 2.2) } }
    if (TD.strikeArm) for (let q = 0; q < 28; q++) { const a = (q / 28) * TAU + time; put3(x + Math.cos(a) * 7, 0.3, z + Math.sin(a) * 7, 0.7, 0.3, 0.7, 0, 3, 1.2, 0.3) }
  }
  for (const e of TD.enemies) drawEnemy(api, e, time, ENEMY)
  // projectiles
  for (const s of TD.shots) { const c = hex(s.c, 2.2); const prog = s.d0 ? clamp(1 - Math.hypot(s.lx - s.x, s.ly - s.y) / s.d0, 0, 1) : 0.5, arc = s.big ? Math.sin(prog * Math.PI) * 7 : 0; putS(s.x, 3.4 + arc, -s.y, s.big ? 1.5 : 0.7, s.big ? 1.5 : 0.7, s.big ? 1.5 : 0.7, s.big ? 0.15 : c[0], s.big ? 0.12 : c[1], s.big ? 0.12 : c[2]); if (s.big) putS(s.x, 3.4 + arc, -s.y, 2, 2, 2, 1.2, 0.6, 0.1) }
  for (const f of TD.fx) {
    if (f.k === 'zap') { const n = Math.ceil(Math.hypot(f.x1 - f.x0, f.y1 - f.y0) / 1.2); for (let q = 0; q <= n; q++) { const u = q / n; putS(f.x0 + (f.x1 - f.x0) * u + (Math.random() - 0.5) * 0.9, 3.5 + Math.sin(u * 3.14) * 1.2 + (Math.random() - 0.5) * 0.9, -(f.y0 + (f.y1 - f.y0) * u) + (Math.random() - 0.5) * 0.9, 0.5, 0.5, 0.5, 3, 2.8, 0.9) } }
    else if (f.k === 'boom') { const u = 1 - f.l / 0.4, r = f.r * Math.min(1, u * 1.3); putS(f.x, 1.5 + u * 2, -f.y, r * 1.6, r * 1.2, r * 1.6, 3 * (1 - u * 0.7), 1.4 * (1 - u), 0.3 * (1 - u)); for (let q = 0; q < 14; q++) { const a = (q / 14) * TAU; put3(f.x + Math.cos(a) * r * 1.1, 0.3, -f.y + Math.sin(a) * r * 1.1, 0.8, 0.3, 0.8, 0, 2, 1.2, 0.5) } }
  }
  for (const b of TD.strikes) { const u = Math.max(0, b.t); for (let q = 0; q < 12; q++) { const a = (q / 12) * TAU; put3(b.x + Math.cos(a) * 3, 0.3, -b.y + Math.sin(a) * 3, 0.5, 0.3, 0.5, 0, 3, 0.4, 0.3) } putS(b.x, 3 + u * 60, -b.y, 1.2, 2.4, 1.2, 0.3, 0.3, 0.3); putS(b.x, 4.4 + u * 60, -b.y, 1, 1.6, 1, 3, 1.4, 0.3) }
  for (const q of G.parts) { const f = q.life / q.max, s = q.s * (0.3 + 0.5 * f); putS(q.x, 1.4 + (1 - f) * 2.5, -q.y, s, s, s, q.c[0] * 2, q.c[1] * 2, q.c[2] * 2) }
  void mc; void put3
}
