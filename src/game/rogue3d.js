// 3D look of NEON DEPTHS: a haunted forest in 3 moods, lit voxel characters with real animation, fog, lanterns, fireflies.
// Everything is drawn with the shared lit instanced-box pass (put3). Game coordinates (x, y) become world (x, 0, -y).
import { G } from './engine.js'
import { col, rng, clamp } from './pxl.js'

export const THEMES = [
  { name: 'THE WHISPERING WOODS', sky: '#030a06', fog: '#04120a', fogNear: 38, fogFar: 175, g1: [0.09, 0.2, 0.08], g2: [0.07, 0.16, 0.07], trunk: [0.22, 0.12, 0.06], leaf: [[0.05, 0.3, 0.1], [0.08, 0.38, 0.12], [0.12, 0.46, 0.14]], glow: [0.4, 2.2, 1.0], lantern: '#ffb050', lanternI: 3.2, moon: '#8fb0ff', amb: 0.55, sun: 0.75, mush: [0.5, 2.4, 1.2], rock: [0.17, 0.2, 0.17], moss: [0.1, 0.36, 0.1], kind: 'pine' },
  { name: 'THE CURSED MARSH', sky: '#05030c', fog: '#0a0716', fogNear: 30, fogFar: 150, g1: [0.1, 0.1, 0.19], g2: [0.08, 0.08, 0.15], trunk: [0.16, 0.12, 0.2], leaf: [[0.2, 0.1, 0.3], [0.26, 0.12, 0.36], [0.3, 0.16, 0.42]], glow: [1.8, 0.9, 2.8], lantern: '#9ab4ff', lanternI: 3.4, moon: '#9a8aff', amb: 0.5, sun: 0.6, mush: [1.9, 0.8, 2.8], rock: [0.17, 0.16, 0.24], moss: [0.16, 0.22, 0.28], kind: 'dead' },
  { name: 'THE VOID GROVE', sky: '#0a0206', fog: '#14040c', fogNear: 28, fogFar: 140, g1: [0.2, 0.07, 0.11], g2: [0.15, 0.05, 0.09], trunk: [0.12, 0.05, 0.08], leaf: [[0.7, 0.1, 0.3], [0.9, 0.16, 0.4], [1, 0.3, 0.5]], glow: [3, 0.7, 1.2], lantern: '#ff6a48', lanternI: 3.6, moon: '#ff8a9a', amb: 0.55, sun: 0.5, mush: [3, 0.8, 1.6], rock: [0.22, 0.12, 0.15], moss: [0.3, 0.1, 0.18], kind: 'crystal' },
]
const TAU = Math.PI * 2
const AX = 44, AY = 23

// ---------- camera ----------
const C = { x: 0, z: 0, h: 52, ready: false, bx: 0, bz: 0 }
export function rogueCamera(RG, aspect, dt, peek) {
  const ps = (RG.players || []).filter((p) => p.alive)
  let fx = 0, fz = 0
  if (ps.length) { for (const p of ps) { fx += p.x; fz += -p.y } fx /= ps.length; fz /= ps.length }
  // gentle follow: the whole arena stays in view, the camera leans toward the action
  let tx = clamp(fx * 0.5, -17, 17), tz = clamp(fz * 0.55, -10, 10), th = 43, back = 33
  const boss = RG.en && RG.en.find((e) => e.def && e.def.boss && !e.dead)
  if (RG.bossT > 1.4 && boss) { tx = boss.x * 0.6; tz = -boss.y * 0.6 - 4; th = 34; back = 24 }
  else if (RG.mode === 'over') { th = 36; back = 28 }
  if (!peek) {
    if (!C.ready) { C.x = tx; C.z = tz; C.h = th; C.bx = back; C.ready = true }
    const k = 1 - Math.exp(-3 * Math.min(dt, 0.1))
    C.x += (tx - C.x) * k; C.z += (tz - C.z) * k; C.h += (th - C.h) * k; C.bx += (back - C.bx) * k
  }
  const s = G.shake || 0
  return { x: C.x + (Math.random() - 0.5) * s * 0.9, y: C.h + (Math.random() - 0.5) * s * 0.5, z: C.z + C.bx, tx: C.x, ty: 0, tz: C.z - 2, fov: 40, far: 420, aspect }
}
// turn a point on the screen (-1..1) into a point on the ground, in game coordinates
export function unprojectGround(cam, nx, ny) {
  const px = cam.x, py = cam.y, pz = cam.z
  let fx = cam.tx - px, fy = cam.ty - py, fz = cam.tz - pz
  const fl = Math.hypot(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl
  // right = f x up(0,1,0)
  let rx = -fz, ry = 0, rz = fx; const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl
  // up2 = right x f
  const ux = ry * fz - rz * fy, uy = rz * fx - rx * fz, uz = rx * fy - ry * fx
  const tv = Math.tan((cam.fov * Math.PI) / 360), th = tv * (cam.aspect || 100 / 56)
  const dx = fx + nx * th * rx + ny * tv * ux, dy = fy + nx * th * ry + ny * tv * uy, dz = fz + nx * th * rz + ny * tv * uz
  if (dy >= -1e-4) return null
  const t = -py / dy
  return { x: px + dx * t, y: -(pz + dz * t) }
}
export function rogueLights(RG) {
  const th = THEMES[RG.floor % 3]
  const me = RG.players && RG.players[RG.me]
  const t = G.time
  const fl = 1 + Math.sin(t * 13) * 0.06 + Math.sin(t * 7.3) * 0.05 + (Math.random() - 0.5) * 0.06
  const low = me && me.alive && me.hp / me.max <= 0.34
  return {
    sun: { x: -24, y: 70, z: 22, color: th.moon, intensity: th.sun },
    ambient: th.amb * (RG.bossT > 1.4 ? 0.6 : 1), dir: 0.12,
    lantern: me ? { x: me.x, y: 7, z: -me.y + 1, color: low ? '#ff5a4a' : th.lantern, intensity: th.lanternI * fl * (low ? 1.0 + Math.sin(t * 7) * 0.2 : 1), distance: 52 } : null,
  }
}

// ---------- environment (rebuilt per room, replayed every frame) ----------
let ENV = null
function buildEnv(RG) {
  const th = THEMES[RG.floor % 3], r = rng(RG.floor * 977 + RG.rk * 131 + 7)
  const E = { key: RG.floor + ':' + RG.rk, ground: [], trees: [], tufts: [], shrooms: [], rocks: [], flies: [] }
  const gc = (a, k) => [a[0] * k, a[1] * k, a[2] * k]
  for (let x = -AX - 4; x <= AX + 4; x += 4) for (let z = -AY - 4; z <= AY + 4; z += 4) {
    const k = 0.8 + r() * 0.4, c = (Math.floor(x / 4) + Math.floor(z / 4)) % 2 === 0 ? gc(th.g1, k) : gc(th.g2, k)
    E.ground.push([x, -0.3, z, 4.05, 0.6, 4.05, 0, c[0], c[1], c[2], 0])
  }
  for (let x = -76; x <= 76; x += 8) for (let z = -52; z <= 52; z += 8) {
    if (Math.abs(x) <= AX + 6 && Math.abs(z) <= AY + 6) continue
    const k = 0.5 + r() * 0.3; E.ground.push([x, -0.5, z, 8.1, 0.6, 8.1, 0, th.g2[0] * k, th.g2[1] * k, th.g2[2] * k, 0])
  }
  // a worn path to the door
  for (let x = -AX + 3; x <= AX + 2; x += 2.6) { const z = Math.sin(x * 0.12) * 1.4 + (r() - 0.5) * 1.2; const k = 0.7 + r() * 0.5; E.ground.push([x, 0.06, z, 1.7, 0.12, 1.6, (r() - 0.5) * 0.5, 0.2 * k + 0.05, 0.18 * k + 0.05, 0.14 * k + 0.05, 0]) }
  // forest wall: dense trees around the arena, a gap at the door
  const tree = (x, z, s, row) => { E.trees.push({ x, z, s, ph: r() * TAU, h: (7 + r() * 6) * s, row, lean: (r() - 0.5) * 0.12 }) }
  const low = (x, z, row) => E.trees.push({ x, z, s: 0.75 + r() * 0.35, ph: r() * TAU, h: (4.5 + r() * 3) * (row ? 1.2 : 1), row, lean: (r() - 0.5) * 0.1 })
  for (let x = -AX - 14; x <= AX + 14; x += 3.4 + r() * 1.4) { tree(x, -AY - 4 - r() * 3, 1 + r() * 0.5, 0); low(x + 1.5, AY + 6 + r() * 3, 0); tree(x, -AY - 10 - r() * 6, 1.4 + r() * 0.6, 1); low(x, AY + 12 + r() * 4, 1) }
  for (let z = -AY - 8; z <= AY + 4; z += 3.8 + r() * 1.2) { tree(-AX - 8 - r() * 3, z, 1 + r() * 0.4, 0); tree(-AX - 14 - r() * 6, z, 1.5 + r() * 0.6, 1); if (Math.abs(z) > 10) tree(AX + 7 + r() * 3, z, 1 + r() * 0.5, 0); if (Math.abs(z) > 9) tree(AX + 13 + r() * 5, z, 1.5 + r() * 0.6, 1) }
  for (let i = 0; i < 90; i++) E.tufts.push({ x: (r() - 0.5) * 2 * (AX - 1), z: (r() - 0.5) * 2 * (AY - 1), h: 0.9 + r() * 1.2, ph: r() * TAU })
  for (let i = 0; i < 16; i++) E.shrooms.push({ x: (r() - 0.5) * 2 * (AX + 2), z: (r() > 0.5 ? 1 : -1) * (AY - 1 + r() * 3), s: 0.5 + r() * 0.8, ph: r() * 6 })
  for (let i = 0; i < 26; i++) E.rocks.push({ x: (r() - 0.5) * 2 * (AX + 6), z: (r() - 0.5) * 2 * (AY + 6), s: 0.4 + r() * 0.9, ry: r() * 3 })
  for (let i = 0; i < 34; i++) E.flies.push({ x: (r() - 0.5) * 2 * (AX + 6), z: (r() - 0.5) * 2 * (AY + 4), y: 1.5 + r() * 6, ph: r() * TAU, sp: 0.3 + r() * 0.7, rad: 1 + r() * 3 })
  return E
}

function putTree(put3, th, tr, t) {
  const s = tr.s, sway = Math.sin(t * 0.9 + tr.ph) * 0.18, h = tr.h
  const dark = tr.row ? 0.6 : 1
  const tc = th.trunk
  put3(tr.x, h / 2, tr.z, 1.5 * s, h, 1.5 * s, 0, tc[0] * dark, tc[1] * dark, tc[2] * dark, tr.lean)
  if (th.kind === 'pine') {
    for (let k = 0; k < 4; k++) {
      const lc = th.leaf[k % 3], w = (8.2 - k * 1.9) * s, y = h * 0.42 + k * 2.4 * s + 1.4
      put3(tr.x + sway * (k + 1) * 0.6, y, tr.z, w, 2.5 * s, w, 0, lc[0] * dark, lc[1] * dark, lc[2] * dark, k * 0.4 + tr.ph)
    }
  } else if (th.kind === 'dead') {
    for (let k = 0; k < 4; k++) {
      const a = tr.ph + k * 1.6, y = h * (0.5 + k * 0.13), len = (3.4 - k * 0.5) * s
      put3(tr.x + Math.cos(a) * len * 0.45, y, tr.z + Math.sin(a) * len * 0.45, len, 0.45 * s, 0.45 * s, 0.4 + k * 0.1, tc[0] * dark * 1.2, tc[1] * dark * 1.2, tc[2] * dark * 1.3, -a)
    }
    if (tr.ph > 4.2) put3(tr.x, h * 0.82, tr.z + 0.9 * s, 0.35, 0.35, 0.2, 0, 1.8, 2.2, 2.6) // a pair of watching eyes
    if (tr.ph > 4.2) put3(tr.x + 0.6 * s, h * 0.82, tr.z + 0.9 * s, 0.35, 0.35, 0.2, 0, 1.8, 2.2, 2.6)
  } else {
    for (let k = 0; k < 5; k++) {
      const a = tr.ph + k * 1.25, len = (3 + (k % 3) * 1.3) * s, tilt = 0.25 + (k % 2) * 0.2
      const gl = 0.85 + Math.sin(t * 2 + k + tr.ph) * 0.15
      put3(tr.x + Math.cos(a) * len * 0.35, h * 0.62 + len * 0.45, tr.z + Math.sin(a) * len * 0.35, 0.8 * s, len, 0.8 * s, Math.cos(a) * tilt, th.glow[0] * gl * dark, th.glow[1] * gl * dark, th.glow[2] * gl * dark, 0)
    }
  }
}

// ---------- characters ----------
// a model builder: local (lx sideways, ly up, lz forward) -> world, facing the game angle `a`
function mk(put3, x, z, a, lift = 0, scale = 1) {
  const th = a + Math.PI / 2, c = Math.cos(th), s = Math.sin(th)
  return (lx, ly, lz, sx, sy, sz, r, g, b, rz = 0) => put3(x + (lx * c + lz * s) * scale, lift + ly * scale, z + (-lx * s + lz * c) * scale, sx * scale, sy * scale, sz * scale, rz, r, g, b, th)
}
const hex = (h, k = 1) => { const c = col(h); return [c[0] * k, c[1] * k, c[2] * k] }
function drawHero(put3, p, t, cl, isMe, RG) {
  if (!p.alive) { // a gravestone
    const P = mk(put3, p.x, -p.y, 0)
    P(0, 1.1, 0, 2, 2.2, 0.7, 0.25, 0.26, 0.3); P(0, 2.4, 0, 2.4, 0.7, 0.9, 0.3, 0.31, 0.35); P(0, 3.2, 0.45, 0.4, 0.4, 0.1, 2, 0.4, 0.4)
    return
  }
  const moving = Math.hypot(p.mx || 0, p.my || 0) > 0.1
  const wk = p.walk * 1.7, bob = moving ? Math.abs(Math.sin(wk)) * 0.35 : Math.sin(t * 2.2) * 0.12
  const dash = p.dash > 0
  const blink = p.inv > 0 && !dash && Math.floor(t * 18) % 2 === 0
  if (blink) return
  const fa = p.face, P = mk(put3, p.x, -p.y, fa, 0, 1)
  const cc = hex(cl.color, 1.1), cd = hex(cl.color, 0.55), skin = [0.8, 0.55, 0.42], dark = [0.08, 0.08, 0.12]
  const stretch = dash ? 1.25 : 1
  const lean = dash ? 1.2 : moving ? 0.35 : 0
  // shadow ring for readability and the player marker
  const ringN = isMe ? 14 : 9
  for (let i = 0; i < ringN; i++) { const a = (i / ringN) * TAU + t * 0.8; put3(p.x + Math.cos(a) * (isMe ? 2.6 : 2.2), 0.08, -p.y + Math.sin(a) * (isMe ? 2.6 : 2.2), 0.4, 0.1, 0.4, 0, cc[0] * 1.8, cc[1] * 1.8, cc[2] * 1.8) }
  // legs
  const sw = moving ? Math.sin(wk) * 0.85 : 0
  P(-0.55, 0.85 + (sw > 0 ? sw * 0.25 : 0), sw, 0.75, 1.7, 0.85, cd[0], cd[1], cd[2])
  P(0.55, 0.85 + (sw < 0 ? -sw * 0.25 : 0), -sw, 0.75, 1.7, 0.85, cd[0], cd[1], cd[2])
  // torso, belt, head
  const hy = 1.7 + bob
  if (cl.id === 'mage') { P(0, hy + 1.1, lean * 0.4, 2.3, 2.2, 1.5, cc[0] * 0.9, cc[1] * 0.9, cc[2] * 0.9); P(0, hy - 0.3, 0, 2.7, 0.9, 1.7, cc[0] * 0.7, cc[1] * 0.7, cc[2] * 0.7) }
  else P(0, hy + 1.0, lean * 0.4, 1.9, 1.9, 1.2, cc[0], cc[1], cc[2])
  P(0, hy + 0.2, lean * 0.3, 2.0, 0.35, 1.3, 0.3, 0.2, 0.1)
  P(0, hy + 2.5, lean * 0.7, 1.5, 1.4, 1.4, skin[0], skin[1], skin[2])
  P(-0.35, hy + 2.6, 0.75 + lean * 0.7, 0.3, 0.3, 0.1, dark[0], dark[1], dark[2]); P(0.35, hy + 2.6, 0.75 + lean * 0.7, 0.3, 0.3, 0.1, dark[0], dark[1], dark[2])
  // class gear
  if (cl.id === 'knight') {
    P(0, hy + 3.35, lean * 0.7, 1.7, 0.7, 1.6, 0.5, 0.52, 0.58); P(0, hy + 3.9, lean * 0.7, 0.35, 0.8, 1.2, cc[0] * 1.5, cc[1] * 1.5, cc[2] * 1.5) // helm + crest
    P(-1.35, hy + 1.2, 0.2, 0.7, 1.4, 0.8, 0.45, 0.47, 0.52); P(1.35, hy + 1.2, 0.2, 0.7, 1.4, 0.8, 0.45, 0.47, 0.52)
    const sg = p.swing
    if (sg) { // blade follows the swing arc
      const u = 1 - sg.t / (sg.max || 0.2), aa = -sg.arc / 2 + sg.arc * u
      const rel = sg.a - p.face + aa
      for (let k = 0; k < 6; k++) { const rr = 1.6 + k * 1.15; put3(p.x + Math.cos(sg.a + aa) * rr, hy + 1.6, -p.y - Math.sin(sg.a + aa) * rr, 0.7, 0.35, 1.3, 0, 2.6, 2.6, 3.2, sg.a + aa + Math.PI / 2) }
      void rel
    } else { P(1.7, hy + 1.4, 0.8, 0.35, 0.35, 2.8, 0.55, 0.58, 0.66); P(1.7, hy + 1.4, 2.4, 0.25, 0.25, 1.6, 1.2, 1.4, 1.8) }
  } else if (cl.id === 'ranger') {
    P(0, hy + 3.2, lean * 0.7, 1.9, 0.9, 1.8, cc[0] * 0.5, cc[1] * 0.5, cc[2] * 0.5); P(0, hy + 3.7, -0.3 + lean * 0.7, 1.2, 0.8, 1.2, cc[0] * 0.5, cc[1] * 0.5, cc[2] * 0.5) // hood
    P(0.5, hy + 1.2, -0.95, 0.7, 2, 0.5, 0.3, 0.2, 0.1) // quiver
    const draw = p.atkT > 0 && p.atkT < p.rate * 0.7 ? 0.4 : 0
    P(-1.5, hy + 1.3, 1.1, 0.25, 2.8, 0.25, 0.45, 0.28, 0.12); P(-1.5, hy + 2.6, 1.0 - draw, 0.25, 0.8, 0.25, 0.45, 0.28, 0.12, 0.5); P(-1.5, hy + 0.1, 1.0 - draw, 0.25, 0.8, 0.25, 0.45, 0.28, 0.12, -0.5)
  } else {
    P(0, hy + 3.3, lean * 0.7, 2.4, 0.4, 2.4, cc[0] * 0.6, cc[1] * 0.6, cc[2] * 0.6); P(0, hy + 4.0, lean * 0.7, 1.5, 1.2, 1.5, cc[0] * 0.6, cc[1] * 0.6, cc[2] * 0.6); P(0, hy + 4.8, lean * 0.7, 0.7, 0.9, 0.7, cc[0] * 0.6, cc[1] * 0.6, cc[2] * 0.6)
    const f = 0.7 + Math.sin(t * 6) * 0.3
    P(1.6, hy + 1.0, 0.8, 0.3, 4.2, 0.3, 0.35, 0.22, 0.12); P(1.6, hy + 3.4, 0.8, 0.9, 0.9, 0.9, 2.6 * f, 1.6 * f, 3.4 * f)
  }
  // cape / tail flutter
  if (cl.id !== 'mage') P(0, hy + 0.9, -0.8 - (moving ? 0.35 + Math.sin(wk * 1.3) * 0.2 : 0), 1.7, 2.1, 0.3, cd[0] * 0.8, cd[1] * 0.8, cd[2] * 0.8)
  if (dash) for (let k = 1; k < 5; k++) put3(p.x - Math.cos(fa) * k * 1.4, 1.5, -p.y + Math.sin(fa) * k * 1.4, 1.5 - k * 0.25, 2.4 - k * 0.4, 1.2, 0, cc[0] * 1.5 / k, cc[1] * 1.5 / k, cc[2] * 1.5 / k, fa)
  if (p.shield > 0) for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU + t * 3; put3(p.x + Math.cos(a) * 2.9, 2.8 + Math.sin(a * 2 + t) * 0.5, -p.y + Math.sin(a) * 2.9, 0.6, 0.6, 0.6, 0, 0.5, 1.6, 2.6) }
  if (p.hurtT > 0) put3(p.x, 3, -p.y, 4, 5, 4, 0, 2.5, 0.2, 0.2)
  void RG
}

function drawEnemy(put3, e, t, hero) {
  const d = e.def, c = hex(d.c, 1), dk = hex(d.c, 0.5), fl = e.flash > 0 ? 2.2 : 1
  const rise = e.spawnT > 0 ? -d.r * 2 * (e.spawnT / 0.5) : 0
  const fa = e.fa || 0, P = mk(put3, e.x, -e.y, fa, rise)
  const fz = e.frozen > 0 ? [0.6, 1.2, 1.8] : null
  const cr = (k) => (fz ? fz[0] * k : c[0] * k * fl), cg = (k) => (fz ? fz[1] * k : c[1] * k * fl), cb = (k) => (fz ? fz[2] * k : c[2] * k * fl)
  const T = e.t * 1
  const eye = (lx, ly, lz, s = 0.4) => P(lx, ly, lz, s, s, 0.15, 2.4, 2.4, 2.4)
  const pupil = (lx, ly, lz, s = 0.2) => P(lx, ly, lz + 0.1, s, s, 0.15, 0.05, 0.05, 0.08)
  if (e.type === 'slime' || e.type === 'king') {
    const big = e.type === 'king' ? 2.6 : 1
    const sq = 1 + Math.sin(T * 8 + e.seed) * 0.14, hop = Math.abs(Math.sin(T * 4 + e.seed)) * 0.9 * big
    P(0, 0.9 * big + hop, 0, 3 * big * (2 - sq) * 0.95, 1.9 * big * sq, 3 * big * (2 - sq) * 0.95, cr(0.5), cg(0.5), cb(0.5))
    P(0, 1.2 * big + hop, 0, 2.4 * big * (2 - sq), 2.1 * big * sq, 2.4 * big * (2 - sq), cr(0.9), cg(0.9), cb(0.9))
    P(0, 1.5 * big + hop, 0, 1.2 * big, 1.2 * big, 1.2 * big, cr(1.6), cg(1.6), cb(1.6)) // glowing core
    eye(-0.7 * big, 1.9 * big + hop, 1.3 * big, 0.5 * big); eye(0.7 * big, 1.9 * big + hop, 1.3 * big, 0.5 * big); pupil(-0.7 * big, 1.9 * big + hop, 1.3 * big, 0.25 * big); pupil(0.7 * big, 1.9 * big + hop, 1.3 * big, 0.25 * big)
    if (e.type === 'king') { // crown
      for (let k = 0; k < 5; k++) P(-2 + k, 5.4 + hop, 0, 0.7, 1.2 + (k % 2) * 0.8, 0.7, 2.4, 1.9, 0.3)
      P(0, 4.8 + hop, 0, 4.6, 0.7, 1.6, 2.2, 1.7, 0.2)
    }
  } else if (e.type === 'bat') {
    const fl2 = Math.sin(T * 22 + e.seed) * 0.9
    P(0, 3 + Math.sin(T * 5) * 0.4, 0, 0.9, 0.9, 1.4, cr(0.8), cg(0.8), cb(0.8))
    P(-1.5, 3.3 + Math.sin(T * 5) * 0.4, -0.1, 2.2, 0.15, 1.1, cr(0.6), cg(0.6), cb(0.6), fl2); P(1.5, 3.3 + Math.sin(T * 5) * 0.4, -0.1, 2.2, 0.15, 1.1, cr(0.6), cg(0.6), cb(0.6), -fl2)
    P(-0.25, 3.3, 0.7, 0.25, 0.25, 0.1, 2.6, 0.4, 0.4); P(0.25, 3.3, 0.7, 0.25, 0.25, 0.1, 2.6, 0.4, 0.4)
  } else if (e.type === 'archer') {
    const sw = Math.sin(T * 5) * 0.3
    P(-0.4, 0.8, sw, 0.7, 1.6, 0.8, 0.2, 0.15, 0.1); P(0.4, 0.8, -sw, 0.7, 1.6, 0.8, 0.2, 0.15, 0.1)
    P(0, 2.5, 0, 1.9, 2.1, 1.3, cr(0.55), cg(0.55), cb(0.55)); P(0, 4.0, 0, 1.6, 1.5, 1.5, 0.25, 0.2, 0.15); P(0, 4.5, -0.15, 1.9, 1.1, 1.8, cr(0.45), cg(0.45), cb(0.45))
    P(-0.35, 4.0, 0.76, 0.28, 0.28, 0.1, 2.6, 2.2, 0.8); P(0.35, 4.0, 0.76, 0.28, 0.28, 0.1, 2.6, 2.2, 0.8)
    const draw = e.cast > 0 ? 0.5 : 0
    P(-1.2, 2.6, 1.2, 0.25, 3, 0.25, 0.4, 0.26, 0.12); P(-1.2, 4.0, 1.1 - draw, 0.25, 0.9, 0.25, 0.4, 0.26, 0.12, 0.5); P(-1.2, 1.2, 1.1 - draw, 0.25, 0.9, 0.25, 0.4, 0.26, 0.12, -0.5)
  } else if (e.type === 'brute') {
    const wind = e.wind > 0, chg = e.charge > 0, sw = Math.sin(T * 4) * 0.35
    const glow = wind ? 1 + Math.sin(T * 40) * 0.5 : 0
    const lean = chg ? 1.1 : 0
    P(-0.9, 1.2, sw, 1.2, 2.4, 1.3, cr(0.5), cg(0.5), cb(0.5)); P(0.9, 1.2, -sw, 1.2, 2.4, 1.3, cr(0.5), cg(0.5), cb(0.5))
    P(0, 3.6, lean * 0.4, 3.6, 3, 2.4, cr(0.8 + glow), cg(0.8 + glow * 0.2), cb(0.8))
    P(0, 5.8, lean, 2.1, 1.8, 2, cr(0.7), cg(0.7), cb(0.7))
    P(-1.2, 6.9, lean, 0.5, 1.5, 0.5, 1.4, 1.3, 1.1, 0.4); P(1.2, 6.9, lean, 0.5, 1.5, 0.5, 1.4, 1.3, 1.1, -0.4) // horns
    P(-0.5, 5.9, 1.05 + lean, 0.4, 0.3, 0.1, 2.6, 0.5 + glow, 0.3); P(0.5, 5.9, 1.05 + lean, 0.4, 0.3, 0.1, 2.6, 0.5 + glow, 0.3)
    const up = wind ? 2.2 : 0
    P(-2.5, 3.6 + up, 0.4 + lean, 1.3, 1.3, 1.3, cr(0.9), cg(0.9), cb(0.9)); P(2.5, 3.6 + up, 0.4 + lean, 1.3, 1.3, 1.3, cr(0.9), cg(0.9), cb(0.9))
    if (wind) for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU + T * 6; put3(e.x + Math.cos(a) * 3.2, 0.2, -e.y + Math.sin(a) * 3.2, 0.4, 0.2, 0.4, 0, 2.6, 0.4, 0.3) }
  } else if (e.type === 'caster') {
    const hv = 1.8 + Math.sin(T * 2.5 + e.seed) * 0.5
    P(0, hv + 0.3, 0, 2.2, 2.2, 1.4, cr(0.5), cg(0.5), cb(0.5)); P(0, hv - 1.2, 0, 1.4, 1.4, 1, cr(0.35), cg(0.35), cb(0.35)); P(0, hv - 2.2, 0, 0.6, 1.0, 0.5, cr(0.25), cg(0.25), cb(0.25))
    P(0, hv + 1.9, 0, 1.4, 1.3, 1.3, 0.12, 0.1, 0.18); P(-0.3, hv + 1.95, 0.7, 0.3, 0.3, 0.1, 0.5, 2.6, 2.6); P(0.3, hv + 1.95, 0.7, 0.3, 0.3, 0.1, 0.5, 2.6, 2.6)
    const oa = T * 3, big = e.cast > 0 ? 1.5 : 1
    P(Math.cos(oa) * 1.9, hv + 0.8 + Math.sin(oa * 2) * 0.3, Math.sin(oa) * 1.9, 0.9 * big, 0.9 * big, 0.9 * big, cr(2.2), cg(2.2), cb(2.2))
  } else if (e.type === 'lord') {
    const hv = 1 + Math.sin(T * 1.6) * 0.5
    P(0, 4.6 + hv, 0, 3.4, 4.2, 2.2, 1.4, 1.4, 1.5 * fl)
    for (let k = 0; k < 4; k++) P(0, 3.3 + k * 0.95 + hv, 1.15, 3.0 - k * 0.2, 0.25, 0.2, 0.15, 0.15, 0.2)
    P(0, 7.6 + hv, 0.2, 2.6, 2.4, 2.4, 1.7, 1.7, 1.8 * fl); P(-0.6, 7.8 + hv, 1.35, 0.7, 0.7, 0.2, 0.1, 0.05, 0.1); P(0.6, 7.8 + hv, 1.35, 0.7, 0.7, 0.2, 0.1, 0.05, 0.1)
    P(-0.6, 7.8 + hv, 1.42, 0.3, 0.3, 0.1, 2.6, 0.3, 0.3); P(0.6, 7.8 + hv, 1.42, 0.3, 0.3, 0.1, 2.6, 0.3, 0.3)
    P(-1.5, 9.4 + hv, 0, 0.5, 1.8, 0.5, 1.2, 1.2, 1.3, 0.5); P(1.5, 9.4 + hv, 0, 0.5, 1.8, 0.5, 1.2, 1.2, 1.3, -0.5)
    const sw = Math.sin(T * 2) * 0.4
    P(-2.6, 5 + hv, 0.8 + sw, 0.8, 3, 0.8, 1.3, 1.3, 1.4); P(2.6, 5 + hv, 0.8 - sw, 0.8, 3, 0.8, 1.3, 1.3, 1.4)
    for (let k = 0; k < 4; k++) { const a = T * 1.6 + (k / 4) * TAU; put3(e.x + Math.cos(a) * 6, 4 + hv + Math.sin(a * 2) * 0.6, -e.y + Math.sin(a) * 6, 1.1, 1.1, 1.1, 0, 1.8, 1.8, 2.0) }
    for (let k = 0; k < 6; k++) P(-1.2 + k * 0.5, 0.4, 0, 0.4, 0.7, 0.4, 0.5, 0.5, 0.6)
  } else if (e.type === 'eye') {
    const hv = 3.6 + Math.sin(T * 1.8) * 0.7, pulse = 1 + Math.sin(T * 5) * 0.08
    P(0, hv, 0, 6.2 * pulse, 6.2 * pulse, 6.2 * pulse, 1.3 * fl, 1.2 * fl, 1.3 * fl, T * 0.4); P(0, hv, 0, 6.2 * pulse, 6.2 * pulse, 6.2 * pulse, 1.3 * fl, 1.2 * fl, 1.3 * fl, T * 0.4 + 0.78)
    P(0, hv, 3.0, 3.2, 3.2, 0.6, 3.0, 0.3, 2.4); P(0, hv, 3.4, 1.4, 2.6, 0.5, 0.05, 0.02, 0.08)
    for (let k = 0; k < 10; k++) { const a = T * 1.2 + (k / 10) * TAU; P(Math.cos(a) * 6.6, hv + Math.sin(a * 3 + T * 2) * 1.5, Math.sin(a) * 6.6, 0.9, 0.9, 0.9, 2.6, 0.4, 2.2) }
    for (let k = 0; k < 6; k++) P(-2.5 + k, hv - 3.6 - Math.sin(T * 3 + k) * 0.6, 0, 0.35, 1.8 + Math.sin(T * 3 + k) * 0.6, 0.35, 0.8, 0.2, 0.7)
  }
  // telegraph glow while spawning
  if (e.spawnT > 0) for (let k = 0; k < 10; k++) { const a = (k / 10) * TAU + e.spawnT * 6; put3(e.x + Math.cos(a) * d.r * 1.6, 0.2, -e.y + Math.sin(a) * d.r * 1.6, 0.5, 0.3, 0.5, 0, c[0] * 2, c[1] * 2, c[2] * 2) }
  // little health bar for hurt non-bosses
  if (!d.boss && e.hp < e.max && e.spawnT <= 0) { const w = d.r * 2.2, f = clamp(e.hp / e.max, 0, 1), y = d.r * 2.6 + 3; for (let u = 0; u < 8; u++) { const on = u / 8 < f; put3(e.x - w / 2 + (u + 0.5) * (w / 8), y, -e.y, w / 8 * 0.9, 0.35, 0.3, 0, on ? 0.2 : 0.4, on ? 2.2 : 0.1, on ? 0.4 : 0.1) } }
  void hero
}

// ---------- main ----------
export function drawRogue3(api, RG, CLASSES) {
  const { put3 } = api
  const th = THEMES[RG.floor % 3], t = G.time
  const key = RG.floor + ':' + RG.rk
  if (!ENV || ENV.key !== key) ENV = buildEnv(RG)
  const E = ENV
  // ground
  for (const g of E.ground) put3(g[0], g[1], g[2], g[3], g[4], g[5], g[6], g[7], g[8], g[9], g[10])
  // rocks
  for (const r of E.rocks) { const k = th.rock; put3(r.x, r.s * 0.4, r.z, r.s * 1.6, r.s * 0.9, r.s * 1.3, 0, k[0], k[1], k[2], r.ry); put3(r.x + r.s * 0.4, r.s * 0.95, r.z, r.s * 0.9, r.s * 0.5, r.s * 0.8, 0, th.moss[0], th.moss[1], th.moss[2], r.ry + 0.4) }
  // grass tufts swaying
  for (const g of E.tufts) { const sw = Math.sin(t * 1.6 + g.ph) * 0.25; for (let b = -1; b <= 1; b++) put3(g.x + b * 0.3 + sw * 0.5, g.h * 0.5, g.z, 0.2, g.h, 0.2, sw * 0.4 + b * 0.15, th.leaf[1][0] * 0.9, th.leaf[1][1] * 0.9, th.leaf[1][2] * 0.9, 0) }
  // glowing mushrooms
  for (const m of E.shrooms) { const gl = 0.7 + Math.sin(t * 2 + m.ph) * 0.3; put3(m.x, m.s * 0.6, m.z, 0.3 * m.s, m.s * 1.2, 0.3 * m.s, 0, 0.7, 0.65, 0.6); put3(m.x, m.s * 1.35, m.z, m.s * 1.5, m.s * 0.5, m.s * 1.5, 0, th.mush[0] * gl, th.mush[1] * gl, th.mush[2] * gl) }
  // trees (sway)
  for (const tr of E.trees) putTree(put3, th, tr, t)
  // obstacles: mossy ruins and boulders
  for (const o of RG.obst) {
    const rr = rng((o.s || 1) * 31 + 5), k = th.rock
    const lay = 3 + (o.w >= 6 || o.h >= 6 ? 1 : 0)
    for (let i = 0; i < lay; i++) { const inset = i * 0.6, hgt = 1.9; put3(o.x + (rr() - 0.5) * 0.5, hgt * (i + 0.5), -o.y + (rr() - 0.5) * 0.5, o.w - inset * 1.2, hgt, o.h - inset * 1.2, 0, k[0] * (1 + i * 0.12), k[1] * (1 + i * 0.12), k[2] * (1 + i * 0.12), (rr() - 0.5) * 0.25) }
    put3(o.x, lay * 1.9 + 0.1, -o.y, o.w - lay * 1.2, 0.35, o.h - lay * 1.2, 0, th.moss[0], th.moss[1], th.moss[2], 0)
    for (let i = 0; i < 3; i++) { const gl = 0.8 + Math.sin(t * 2.4 + i + o.s) * 0.2; put3(o.x + (rr() - 0.5) * o.w * 0.6, lay * 1.9 + 0.7, -o.y + (rr() - 0.5) * o.h * 0.6, 0.4, 0.7 + rr() * 0.5, 0.4, 0, th.mush[0] * gl, th.mush[1] * gl, th.mush[2] * gl) }
  }
  // the exit: thorn barrier while closed, shimmering gate when open; flickering torches
  for (const sd of [-1, 1]) {
    const z = sd * 9, fl = 1 + Math.sin(t * 14 + sd) * 0.25
    put3(AX + 3, 3, z, 1.3, 6, 1.3, 0, 0.2, 0.17, 0.14); put3(AX + 3, 6.6, z, 2, 0.8, 2, 0, 0.26, 0.22, 0.18)
    put3(AX + 3, 7.5, z, 0.9 * fl, 1.4 * fl, 0.9 * fl, t * 3, 3.2, 1.7 * fl, 0.4); put3(AX + 3, 8.4, z, 0.5, 0.9 * fl, 0.5, 0, 3.4, 2.4, 0.7)
  }
  put3(AX + 3, 7.6, 0, 1.2, 1.2, 18, 0, 0.2, 0.17, 0.14)
  if (RG.open) { for (let k = -8; k <= 8; k += 1) { const gl = 0.6 + Math.sin(t * 5 + k) * 0.4; put3(AX + 3, 3.2 + Math.sin(t * 3 + k * 0.7) * 0.4, k, 0.5, 6, 0.9, 0, th.glow[0] * gl + 0.3, th.glow[1] * gl + 0.3, th.glow[2] * gl + 0.3) } }
  else for (let k = -8; k <= 8; k += 2) { put3(AX + 3, 3, k, 0.7, 6.5, 0.7, Math.sin(k) * 0.2, 0.4, 0.1, 0.12); put3(AX + 3, 5, k + 1, 0.7, 0.7, 0.7, 0, 2.2, 0.2, 0.25) }
  // spawn points
  for (const s of RG.spawnQ) { const c = hex(EN_COLOR(s.type), 1); for (let k = 0; k < 10; k++) { const a = (k / 10) * TAU + t * 3, rr = 2.2 + Math.sin(t * 8 + k) * 0.4; put3(s.x + Math.cos(a) * rr, 0.3, -s.y + Math.sin(a) * rr, 0.5, 0.4, 0.5, 0, c[0] * 2.2, c[1] * 2.2, c[2] * 2.2) } }
  // loot
  for (const l of RG.loot) {
    if (l.k === 'gold') put3(l.x, 1.6 + Math.sin(t * 4 + l.x) * 0.3, -l.y, 1, 1.3, 0.3, 0, 3, 2.3, 0.4, t * 5 + l.x)
    else { const bb = 1.8 + Math.sin(t * 3) * 0.3; put3(l.x - 0.55, bb + 0.3, -l.y, 0.9, 0.9, 0.9, 0, 3, 0.4, 0.6, t * 2); put3(l.x + 0.55, bb + 0.3, -l.y, 0.9, 0.9, 0.9, 0, 3, 0.4, 0.6, t * 2); put3(l.x, bb - 0.4, -l.y, 1, 1, 0.9, 0, 3, 0.4, 0.6, t * 2) }
  }
  // characters
  RG.players.forEach((p, i) => drawHero(put3, p, t, CLASSES[p.cls] || CLASSES[0], i === RG.me, RG))
  for (const e of RG.en) drawEnemy(put3, e, t, null)
  // projectiles
  for (const b of RG.pb) { const c = hex(b.c || '#ffffff', 2.4); put3(b.x, 2.4, -b.y, b.big ? 1.5 : 0.8, b.big ? 1.5 : 0.7, b.big ? 1.5 : 2, 0, c[0] * 1.4, c[1] * 1.4, c[2] * 1.4, Math.atan2(b.vx, -b.vy)); if (b.big) put3(b.x - b.vx * 0.02, 2.4, -b.y + b.vy * 0.02, 0.9, 0.9, 0.9, 0, c[0], c[1], c[2]) }
  for (const b of RG.eb) { const c = hex(b.c || '#ff8a5a', 2); put3(b.x, 2.2, -b.y, b.r * 1.3, b.r * 1.3, b.r * 1.3, 0, c[0], c[1], c[2], t * 4) }
  // effects
  for (const f of RG.fx) {
    const p = f.p; if (!p) continue
    if (f.k === 'whirl') { const u = 1 - f.l / 0.5; for (let i = 0; i < 18; i++) { const a = (i / 18) * TAU + u * 8; put3(p.x + Math.cos(a) * (3 + u * 10), 2.5, -p.y + Math.sin(a) * (3 + u * 10), 1.4, 0.4, 0.6, 0, 3, 2.6, 0.6, -a) } }
    else if (f.k === 'nova') { const u = 1 - f.l / 0.6; for (let i = 0; i < 28; i++) { const a = (i / 28) * TAU; put3(p.x + Math.cos(a) * (2 + u * 18), 1.2, -p.y + Math.sin(a) * (2 + u * 18), 1, 1.4, 1, 0, 1, 2, 3) } }
  }
  // fireflies / embers / wisps
  for (const f of E.flies) {
    const a = t * f.sp + f.ph, gl = 0.6 + Math.sin(t * 3 + f.ph * 3) * 0.4
    const x = f.x + Math.cos(a) * f.rad, z = f.z + Math.sin(a * 1.3) * f.rad
    const y = th.kind === 'crystal' ? (f.y + t * 1.2 * f.sp) % 11 : f.y + Math.sin(a * 2) * 0.8
    put3(x, y, z, 0.28, 0.28, 0.28, 0, th.mush[0] * gl * 1.2 + 0.4, th.mush[1] * gl * 1.2 + 0.4, th.mush[2] * gl * 1.2 + 0.4)
  }
  // particles
  for (const q of G.parts) { const f = q.life / q.max, s = q.s * (0.3 + 0.5 * f); put3(q.x, 1.6 + (1 - f) * 1.5, -q.y, s, s, s, 0, q.c[0] * 2, q.c[1] * 2, q.c[2] * 2, q.life * 5) }
}
const EN_COL = { slime: '#5aff7a', bat: '#c06aff', archer: '#ffb04a', brute: '#ff5a5a', caster: '#4ad8ff', king: '#3adf6a', lord: '#e8e8ff', eye: '#ff4adf' }
const EN_COLOR = (t) => EN_COL[t] || '#ffffff'
