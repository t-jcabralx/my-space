// 3D look of NEON DEPTHS: a haunted forest in 3 moods, lit voxel characters with real animation, fog, lanterns, fireflies.
// Everything is drawn with the shared lit instanced-box pass (put3). Game coordinates (x, y) become world (x, 0, -y).
import { G } from './engine.js'
import { col, rng, clamp } from './pxl.js'

export const THEMES = [
  { name: 'THE WHISPERING WOODS', sky: '#030a06', fog: '#04120a', fogNear: 38, fogFar: 175, g1: [0.09, 0.2, 0.08], g2: [0.07, 0.16, 0.07], trunk: [0.22, 0.12, 0.06], leaf: [[0.05, 0.3, 0.1], [0.08, 0.38, 0.12], [0.12, 0.46, 0.14]], glow: [0.4, 2.2, 1.0], lantern: '#ffb050', lanternI: 3.2, moon: '#8fb0ff', amb: 0.55, sun: 0.75, mush: [0.5, 2.4, 1.2], rock: [0.17, 0.2, 0.17], moss: [0.1, 0.36, 0.1], kind: 'pine' },
  { name: 'THE CURSED MARSH', sky: '#05030c', fog: '#0a0716', fogNear: 30, fogFar: 150, g1: [0.1, 0.1, 0.19], g2: [0.08, 0.08, 0.15], trunk: [0.16, 0.12, 0.2], leaf: [[0.2, 0.1, 0.3], [0.26, 0.12, 0.36], [0.3, 0.16, 0.42]], glow: [1.8, 0.9, 2.8], lantern: '#9ab4ff', lanternI: 3.4, moon: '#9a8aff', amb: 0.5, sun: 0.6, mush: [1.9, 0.8, 2.8], rock: [0.17, 0.16, 0.24], moss: [0.16, 0.22, 0.28], kind: 'dead' },
  { name: 'THE VOID GROVE', sky: '#0a0206', fog: '#14040c', fogNear: 28, fogFar: 140, g1: [0.2, 0.07, 0.11], g2: [0.15, 0.05, 0.09], trunk: [0.12, 0.05, 0.08], leaf: [[0.7, 0.1, 0.3], [0.9, 0.16, 0.4], [1, 0.3, 0.5]], glow: [3, 0.7, 1.2], lantern: '#ff6a48', lanternI: 3.6, moon: '#ff8a9a', amb: 0.55, sun: 0.5, mush: [3, 0.8, 1.6], rock: [0.22, 0.12, 0.15], moss: [0.3, 0.1, 0.18], kind: 'crystal' },
  { name: 'THE CRYSTAL CAVERNS', sky: '#02060e', fog: '#04101e', fogNear: 30, fogFar: 150, g1: [0.07, 0.11, 0.2], g2: [0.05, 0.09, 0.17], trunk: [0.14, 0.2, 0.32], leaf: [[0.2, 0.5, 0.9], [0.3, 0.7, 1.1], [0.5, 0.9, 1.3]], glow: [0.6, 2.0, 3.2], lantern: '#8ad8ff', lanternI: 3.6, moon: '#7ac8ff', amb: 0.52, sun: 0.55, mush: [0.6, 2.0, 3.2], rock: [0.12, 0.17, 0.28], moss: [0.1, 0.2, 0.34], kind: 'cave' },
  { name: 'THE EMBER RUINS', sky: '#0a0402', fog: '#180804', fogNear: 30, fogFar: 150, g1: [0.16, 0.08, 0.06], g2: [0.12, 0.06, 0.05], trunk: [0.07, 0.05, 0.05], leaf: [[0.4, 0.15, 0.05], [0.5, 0.2, 0.06], [0.6, 0.25, 0.08]], glow: [3.2, 1.2, 0.3], lantern: '#ff8a40', lanternI: 3.8, moon: '#ff9a5a', amb: 0.55, sun: 0.5, mush: [3.2, 1.2, 0.3], rock: [0.2, 0.1, 0.08], moss: [0.3, 0.1, 0.05], kind: 'ash' },
]
const CHTHEME = [0, 1, 3, 4, 2]
const themeOf = (RG) => THEMES[CHTHEME[Math.min(RG.floor || 0, 4)]]
const TAU = Math.PI * 2
const RACE_IDS = ['human', 'elf', 'dwarf', 'undead', 'fairy']
let AX = 44, AY = 23
const setArena = (RG) => { AX = RG.ax || 44; AY = RG.ay || 23 }

// ---------- camera ----------
const C = { x: 0, z: 0, h: 52, ready: false, bx: 0, bz: 0 }
export function rogueCamera(RG, aspect, dt, peek) {
  setArena(RG)
  const ps = (RG.players || []).filter((p) => p.alive)
  let fx = 0, fz = 0
  if (ps.length) { for (const p of ps) { fx += p.x; fz += -p.y } fx /= ps.length; fz /= ps.length }
  // gentle follow: the whole arena stays in view, the camera leans toward the action
  let tx = clamp(fx * 0.95, -Math.max(8, AX - 30), Math.max(8, AX - 30)), tz = clamp(fz * 0.9, -Math.max(5, AY - 15), Math.max(5, AY - 15)), th = 43, back = 33
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
  setArena(RG)
  const th = themeOf(RG)
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
  const th = themeOf(RG), r = rng(RG.floor * 977 + RG.rk * 131 + 7)
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

function putS3(put3, x, y, z, glow, gl, dark) { put3(x, y, z, 0.6, 0.6, 0.6, 0.7, glow[0] * gl * dark, glow[1] * gl * dark, glow[2] * gl * dark, 0.4) }
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
  } else if (th.kind === 'cave') {
    for (let k = 0; k < 4; k++) { const a = tr.ph + k * 1.7, len = (h * (0.5 + (k % 3) * 0.25)), gl = 0.8 + Math.sin(t * 1.5 + k + tr.ph) * 0.2; put3(tr.x + Math.cos(a) * 1.1 * s, len / 2, tr.z + Math.sin(a) * 1.1 * s, (1.3 - k * 0.2) * s, len, (1.3 - k * 0.2) * s, Math.cos(a) * 0.18, th.leaf[k % 3][0] * gl * dark, th.leaf[k % 3][1] * gl * dark, th.leaf[k % 3][2] * gl * dark, a); putS3(put3, tr.x + Math.cos(a) * 1.1 * s, len, tr.z + Math.sin(a) * 1.1 * s, th.glow, gl, dark) }
  } else if (th.kind === 'ash') {
    for (let k = 0; k < 3; k++) { const a = tr.ph + k * 2.1, y = h * (0.55 + k * 0.15), len = (3 - k * 0.6) * s; put3(tr.x + Math.cos(a) * len * 0.4, y, tr.z + Math.sin(a) * len * 0.4, len, 0.5 * s, 0.5 * s, 0.3, th.trunk[0] * dark, th.trunk[1] * dark, th.trunk[2] * dark, -a) }
    const gl = 0.7 + Math.sin(t * 5 + tr.ph) * 0.3; put3(tr.x, h * 0.3, tr.z + 0.8 * s, 0.4 * s, h * 0.5, 0.2, 0, th.glow[0] * gl * dark, th.glow[1] * gl * dark, th.glow[2] * gl * dark, 0)
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
  const rid = RACE_IDS[p.race | 0] || 'human'
  const fa = p.face, fairy = rid === 'fairy', sc = fairy ? 0.78 : rid === 'dwarf' ? 0.9 : 1, hov = fairy ? 1.6 + Math.sin(t * 4) * 0.35 : 0
  const P = mk(put3, p.x, -p.y, fa, hov, sc)
  const cc = hex(cl.color, 1.1), cd = hex(cl.color, 0.55), skin = rid === 'undead' ? [0.5, 0.78, 0.55] : rid === 'elf' ? [0.88, 0.72, 0.6] : rid === 'dwarf' ? [0.82, 0.52, 0.4] : [0.8, 0.55, 0.42], dark = rid === 'undead' ? [0.1, 2.4, 0.9] : [0.08, 0.08, 0.12]
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
  // race looks
  if (rid === 'elf') { P(-1.0, hy + 2.9, 0, 0.9, 0.35, 0.3, skin[0], skin[1], skin[2], 0.5); P(1.0, hy + 2.9, 0, 0.9, 0.35, 0.3, skin[0], skin[1], skin[2], -0.5) }
  else if (rid === 'dwarf') { P(0, hy + 1.7, 0.75 + lean * 0.7, 1.4, 1.5, 0.5, 0.75, 0.32, 0.14); P(0, hy + 0.9, 0.7, 1.0, 0.9, 0.4, 0.7, 0.3, 0.12) }
  else if (rid === 'undead') { for (let k = 0; k < 3; k++) P(0, hy + 0.5 + k * 0.5, 0.65, 1.5, 0.15, 0.1, 0.9, 1, 0.9); P(0.8, hy + 2.4, 0.7, 0.35, 0.5, 0.15, 0.15, 0.4, 0.2) }
  else if (fairy) { const fl = Math.sin(t * 28) * 0.7; P(-1.5, hy + 1.6, -0.5, 2.2, 0.15, 1.3, 2.2, 1.9, 2.8, fl); P(1.5, hy + 1.6, -0.5, 2.2, 0.15, 1.3, 2.2, 1.9, 2.8, -fl); P(-1.2, hy + 0.7, -0.5, 1.4, 0.12, 0.9, 1.7, 1.4, 2.4, fl * 0.7); P(1.2, hy + 0.7, -0.5, 1.4, 0.12, 0.9, 1.7, 1.4, 2.4, -fl * 0.7) }
  else { P(-0.6, hy + 2.95, 0.7, 0.5, 0.18, 0.1, 0.4, 0.2, 0.15) }
  if (p.lvT > 0) { for (let k = 0; k < 10; k++) { const a = (k / 10) * TAU + t * 6, hh = ((t * 8 + k * 3) % 9); put3(p.x + Math.cos(a) * 2.2, hh, -p.y + Math.sin(a) * 2.2, 0.5, 1.6, 0.5, 0, 3, 2.6, 0.6) } }
  if (p.buff > 0) { for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU - t * 5; put3(p.x + Math.cos(a) * 2.6, 3.4 + Math.sin(t * 6 + k) * 0.5, -p.y + Math.sin(a) * 2.6, 0.55, 0.55, 0.55, 0, 3.2, 0.8, 0.4) } }
  if (dash) for (let k = 1; k < 5; k++) put3(p.x - Math.cos(fa) * k * 1.4, 1.5, -p.y + Math.sin(fa) * k * 1.4, 1.5 - k * 0.25, 2.4 - k * 0.4, 1.2, 0, cc[0] * 1.5 / k, cc[1] * 1.5 / k, cc[2] * 1.5 / k, fa)
  if (p.shield > 0) for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU + t * 3; put3(p.x + Math.cos(a) * 2.9, 2.8 + Math.sin(a * 2 + t) * 0.5, -p.y + Math.sin(a) * 2.9, 0.6, 0.6, 0.6, 0, 0.5, 1.6, 2.6) }
  if (p.hurtT > 0) put3(p.x, 3, -p.y, 4, 5, 4, 0, 2.5, 0.2, 0.2)
  void RG
}

function drawEnemy(api, e, t, hero) {
  const put3 = api.put3, putS = api.putS
  const d = e.def, c = hex(d.c, 1), dk = hex(d.c, 0.5), fl = e.flash > 0 ? 2.2 : 1
  const rise = e.spawnT > 0 ? -d.r * 2 * (e.spawnT / 0.5) : 0
  const fa = e.fa || 0, P = mk(put3, e.x, -e.y, fa, rise, e.elite ? 1.3 : 1)
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
  } else if (e.type === 'wolf') {
    quad(P, T, c, dk, fl, 1.15, e.charge > 0 ? 1.4 : 1, [2.6, 0.3, 0.3], 0.5)
  } else if (e.type === 'skeleton') {
    const sw = Math.sin(T * 5) * 0.4, bone = [1.5 * fl, 1.5 * fl, 1.4 * fl]
    P(-0.45, 0.85, sw, 0.55, 1.7, 0.6, bone[0] * 0.8, bone[1] * 0.8, bone[2] * 0.8); P(0.45, 0.85, -sw, 0.55, 1.7, 0.6, bone[0] * 0.8, bone[1] * 0.8, bone[2] * 0.8)
    P(0, 2.1, 0, 1.6, 0.4, 0.9, bone[0], bone[1], bone[2]); for (let k = 0; k < 3; k++) { P(0, 2.7 + k * 0.45, 0.4, 1.7 - k * 0.15, 0.2, 0.3, bone[0], bone[1], bone[2]) } P(0, 3.1, -0.1, 0.35, 1.6, 0.45, bone[0] * 0.9, bone[1] * 0.9, bone[2] * 0.9)
    P(0, 4.5, 0, 1.4, 1.3, 1.3, bone[0], bone[1], bone[2]); P(-0.3, 4.6, 0.7, 0.35, 0.35, 0.12, 0.05, 0.05, 0.08); P(0.3, 4.6, 0.7, 0.35, 0.35, 0.12, 0.05, 0.05, 0.08); P(-0.3, 4.6, 0.76, 0.18, 0.18, 0.08, 0.4, 2.4, 1.2); P(0.3, 4.6, 0.76, 0.18, 0.18, 0.08, 0.4, 2.4, 1.2)
    const raise = e.cast > 0 ? 0.9 : 0
    P(-1.1, 3.3, 0.5, 0.4, 0.4, 1.8, bone[0], bone[1], bone[2]); P(1.1, 3.3 + raise, 0.9, 0.4, 0.4, 1.8, bone[0], bone[1], bone[2]); P(1.1, 3.3 + raise, 1.9, 0.3, 0.3, 0.9, 0.9, 0.9, 0.7)
  } else if (e.type === 'imp') {
    const hv = 2.2 + Math.sin(T * 6 + e.seed) * 0.4, fl2 = Math.sin(T * 24) * 0.8, cast = e.cast > 0
    P(0, hv, 0, 1.1, 1.4, 0.9, cr(0.9), cg(0.7), cb(0.6)); P(0, hv + 1.1, 0.1, 1.0, 0.9, 0.9, cr(1), cg(0.75), cb(0.6)); P(-0.4, hv + 1.7, 0.1, 0.25, 0.7, 0.25, 1.6, 1.4, 1.2, 0.3); P(0.4, hv + 1.7, 0.1, 0.25, 0.7, 0.25, 1.6, 1.4, 1.2, -0.3)
    P(-0.25, hv + 1.2, 0.55, 0.22, 0.22, 0.1, 3, 2.6, 0.5); P(0.25, hv + 1.2, 0.55, 0.22, 0.22, 0.1, 3, 2.6, 0.5)
    P(-1.4, hv + 0.5, -0.2, 2, 0.12, 1.2, cr(0.6), cg(0.3), cb(0.25), fl2); P(1.4, hv + 0.5, -0.2, 2, 0.12, 1.2, cr(0.6), cg(0.3), cb(0.25), -fl2)
    P(0, hv - 0.9, -0.9, 0.2, 0.2, 1.4, cr(0.7), cg(0.4), cb(0.3)); P(0, hv - 0.9, -1.7, 0.4, 0.4, 0.4, 3, 1.2, 0.3)
    putS(e.x + Math.cos(ry) * 0 + Math.sin(ry) * 1.1, hv + 0.5, -e.y + Math.cos(ry) * 1.1, cast ? 1.5 : 0.8, cast ? 1.5 : 0.8, cast ? 1.5 : 0.8, 3, 1.2 + Math.sin(T * 20) * 0.4, 0.3)
  } else if (e.type === 'golem') {
    const slam = e.wind > 0, sw = Math.sin(T * 2) * 0.3, arms = slam ? 4.2 + Math.sin(T * 30) * 0.2 : 2.2
    for (const sd of [-1, 1]) P(sd * 1.7, 2.1, sw * sd, 2, 4.2, 2.2, cr(0.55), cg(0.55), cb(0.6))
    P(0, 6, 0, 5.4, 4.4, 3.4, cr(0.8), cg(0.8), cb(0.9)); P(0, 6, 1.75, 3, 3, 0.4, 1.2 * (slam ? 2.5 : 1), 2.2 * (slam ? 1.8 : 1), 3.2)
    P(0, 9.2, 0.3, 2.7, 2.2, 2.6, cr(0.7), cg(0.7), cb(0.8)); P(-0.7, 9.4, 1.65, 0.5, 0.4, 0.15, 0.4, 2.8, 3.2); P(0.7, 9.4, 1.65, 0.5, 0.4, 0.15, 0.4, 2.8, 3.2)
    for (const sd of [-1, 1]) { P(sd * 3.7, arms + 2.2, 0.4 + (slam ? 0 : sw), 1.9, 4.2, 1.9, cr(0.6), cg(0.6), cb(0.7)); P(sd * 3.7, arms - 0.2, 0.6, 2.5, 2.4, 2.5, cr(0.9), cg(0.9), cb(1)) }
    for (let k = 0; k < 6; k++) { const a = T * 1.1 + (k / 6) * TAU; put3(e.x + Math.cos(a) * 6.4, 5 + Math.sin(a * 2 + T) * 1.2, -e.y + Math.sin(a) * 6.4, 0.9, 2.4, 0.9, a, 1.0, 2.4, 3.4, a) }
  } else if (e.type === 'drake') {
    const wl = Math.sin(T * 9) * 0.55, br = e.cast > 0, wnd = e.wind > 0 || e.charge > 0, low = e.charge > 0 ? -0.6 : 0
    P(0, 3.2 + low, 0, 3.6, 3.2, 7, cr(0.85 + (wnd ? 0.6 : 0)), cg(0.45), cb(0.3)); P(0, 3.0 + low, -1.5, 3.2, 2.8, 4, cr(0.7), cg(0.35), cb(0.25))
    P(0, 4.6 + low, 3.8, 1.6, 1.8, 2.8, cr(0.85), cg(0.45), cb(0.3)); P(0, 5.0 + low, 5.6, 2.2, 1.6, 2.6, cr(0.95), cg(0.5), cb(0.32)); P(0, 4.3 + low, 6.6, 1.8, 0.5, 1.8, cr(0.7), cg(0.3), cb(0.2))
    P(-0.7, 5.8 + low, 5.9, 0.35, 0.35, 0.14, 3.2, 2.6, 0.4); P(0.7, 5.8 + low, 5.9, 0.35, 0.35, 0.14, 3.2, 2.6, 0.4); P(-0.7, 6.4 + low, 5.2, 0.4, 1.4, 0.4, 1.4, 1.2, 0.9, 0.3); P(0.7, 6.4 + low, 5.2, 0.4, 1.4, 0.4, 1.4, 1.2, 0.9, -0.3)
    P(-5.5, 5.2 + low, -0.4, 9, 0.2, 5, cr(0.5), cg(0.2), cb(0.15), wl); P(5.5, 5.2 + low, -0.4, 9, 0.2, 5, cr(0.5), cg(0.2), cb(0.15), -wl)
    for (let k = 0; k < 6; k++) P(Math.sin(T * 3 + k) * (0.3 + k * 0.15), 2.8 - k * 0.12 + low, -3.8 - k * 1.3, 1.7 - k * 0.2, 1.5 - k * 0.2, 1.5, cr(0.7), cg(0.32), cb(0.22))
    for (let k = 0; k < 5; k++) P(0, 5 + low, 2 - k * 1.4, 0.4, 0.9, 0.5, 1.6, 1.3, 0.7)
    for (const [lx, lz] of [[-1.7, 2], [1.7, 2], [-1.7, -2], [1.7, -2]]) P(lx, 1.2, lz + Math.sin(T * 6 + lx) * 0.4 * (e.charge > 0 ? 2 : 0.4), 0.9, 2.4, 1.1, cr(0.6), cg(0.28), cb(0.2))
    if (br) for (let k = 0; k < 10; k++) { const u = (k / 10 + (T * 5) % 0.2); P((Math.sin(k * 3 + T * 40)) * 0.8 * u * 3, 4.4 + low, 7 + u * 12, 1.2 + u * 3, 1.2 + u * 3, 1.6, 3, 1.5 + (1 - u) * 1.6, 0.3) }
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
  if (e.elite && e.spawnT <= 0) for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU + T * 2; putS(e.x + Math.cos(a) * d.r * 1.5, 0.6 + Math.sin(T * 5 + k) * 0.2, -e.y + Math.sin(a) * d.r * 1.5, 0.55, 0.55, 0.55, 3, 2.2, 0.4) }
  if (e.burn) for (let k = 0; k < 3; k++) putS(e.x + Math.sin(T * 12 + k * 2) * d.r * 0.6, d.r * 1.4 + ((T * 4 + k) % 1.2) * 2, -e.y + Math.cos(T * 9 + k) * d.r * 0.6, 0.8, 1.1, 0.8, 3, 1.3 + Math.sin(T * 30 + k) * 0.5, 0.2)
  // telegraph glow while spawning
  if (e.spawnT > 0) for (let k = 0; k < 10; k++) { const a = (k / 10) * TAU + e.spawnT * 6; put3(e.x + Math.cos(a) * d.r * 1.6, 0.2, -e.y + Math.sin(a) * d.r * 1.6, 0.5, 0.3, 0.5, 0, c[0] * 2, c[1] * 2, c[2] * 2) }
  // little health bar for hurt non-bosses
  if (!d.boss && e.hp < e.max && e.spawnT <= 0) { const w = d.r * 2.2, f = clamp(e.hp / e.max, 0, 1), y = d.r * 2.6 + 3; for (let u = 0; u < 8; u++) { const on = u / 8 < f; put3(e.x - w / 2 + (u + 0.5) * (w / 8), y, -e.y, w / 8 * 0.9, 0.35, 0.3, 0, on ? 0.2 : 0.4, on ? 2.2 : 0.1, on ? 0.4 : 0.1) } }
  void hero
}

// a four-legged animal (wolf): the same model serves the enemy wolves and the wolf pup
function quad(P, T, c, dk, fl, k, lunge, eyeC, wag) {
  const run = Math.sin(T * 12) * 0.7 * (lunge > 1 ? 1.4 : 0.5)
  P(-0.5 * k, 0.7 * k, 1.0 * k + run, 0.45 * k, 1.4 * k, 0.5 * k, dk[0] * 0.7, dk[1] * 0.7, dk[2] * 0.7); P(0.5 * k, 0.7 * k, 1.0 * k - run, 0.45 * k, 1.4 * k, 0.5 * k, dk[0] * 0.7, dk[1] * 0.7, dk[2] * 0.7)
  P(-0.5 * k, 0.7 * k, -1.0 * k - run, 0.45 * k, 1.4 * k, 0.5 * k, dk[0] * 0.7, dk[1] * 0.7, dk[2] * 0.7); P(0.5 * k, 0.7 * k, -1.0 * k + run, 0.45 * k, 1.4 * k, 0.5 * k, dk[0] * 0.7, dk[1] * 0.7, dk[2] * 0.7)
  P(0, 1.7 * k, 0, 1.3 * k, 1.2 * k, 2.8 * k, c[0] * fl, c[1] * fl, c[2] * fl)
  P(0, 2.05 * k, 1.9 * k, 1.1 * k, 1.1 * k, 1.1 * k, c[0] * fl, c[1] * fl, c[2] * fl); P(0, 1.85 * k, 2.7 * k, 0.6 * k, 0.5 * k, 0.8 * k, dk[0], dk[1], dk[2])
  P(-0.4 * k, 2.8 * k, 1.8 * k, 0.3 * k, 0.5 * k, 0.3 * k, dk[0], dk[1], dk[2]); P(0.4 * k, 2.8 * k, 1.8 * k, 0.3 * k, 0.5 * k, 0.3 * k, dk[0], dk[1], dk[2])
  P(-0.3 * k, 2.2 * k, 2.5 * k, 0.2 * k, 0.2 * k, 0.1, eyeC[0], eyeC[1], eyeC[2]); P(0.3 * k, 2.2 * k, 2.5 * k, 0.2 * k, 0.2 * k, 0.1, eyeC[0], eyeC[1], eyeC[2])
  P(Math.sin(T * 9) * wag * k, 2.0 * k, -1.9 * k, 0.4 * k, 0.4 * k, 1.5 * k, c[0] * 0.8, c[1] * 0.8, c[2] * 0.8)
}
function drawPet(put3, pt, t) {
  if (!pt.owner || !pt.owner.alive) return
  const col3 = (h, k = 1) => hex(h, k)
  const T = pt.t || t, fa = pt.face || 0
  if (pt.type === 'wolf') { const c = col3('#a8b0c4', 1.1), dk = col3('#6a7288'); quad(mk(put3, pt.x, -pt.y, fa, 0, 0.75), T, c, dk, 1, 1, pt.act > 0 ? 1.4 : 0.6, [0.4, 2.2, 0.8], 0.6) }
  else if (pt.type === 'owl') {
    const P = mk(put3, pt.x, -pt.y, fa, 3.6 + Math.sin(T * 3) * 0.5, 0.8), fl = Math.sin(T * 18) * 0.8
    P(0, 0.6, 0, 1.4, 1.8, 1.3, 0.55, 0.4, 0.22); P(0, 1.9, 0.2, 1.4, 1.1, 1.2, 0.6, 0.45, 0.25); P(-0.4, 2.1, 0.8, 0.5, 0.5, 0.2, 2.6, 2.4, 0.6); P(0.4, 2.1, 0.8, 0.5, 0.5, 0.2, 2.6, 2.4, 0.6); P(0, 1.8, 0.9, 0.3, 0.3, 0.4, 1.4, 0.9, 0.3)
    P(-1.5, 0.9, 0, 1.8, 0.15, 1.0, 0.5, 0.36, 0.2, fl); P(1.5, 0.9, 0, 1.8, 0.15, 1.0, 0.5, 0.36, 0.2, -fl)
  } else if (pt.type === 'sprite') {
    const P = mk(put3, pt.x, -pt.y, fa, 4 + Math.sin(T * 4) * 0.7, 0.8), fl = Math.sin(T * 30) * 0.8, g = 0.8 + Math.sin(T * 6) * 0.2 + (pt.act > 0 ? 1 : 0)
    P(0, 0, 0, 0.9, 0.9, 0.9, 3 * g, 1.4 * g, 2.8 * g); P(-0.9, 0.3, -0.2, 1.3, 0.1, 0.8, 2.2, 2.2, 3, fl); P(0.9, 0.3, -0.2, 1.3, 0.1, 0.8, 2.2, 2.2, 3, -fl)
    for (let k = 0; k < 3; k++) put3(pt.x + Math.cos(T * 5 + k * 2) * 1.2, 3 + k * 0.5 + Math.sin(T * 7 + k) * 0.3, -pt.y + Math.sin(T * 5 + k * 2) * 1.2, 0.2, 0.2, 0.2, 0, 3, 2.4, 3)
  } else if (pt.type === 'dragon') {
    const P = mk(put3, pt.x, -pt.y, fa, 3 + Math.sin(T * 3) * 0.5, 0.85), fl = Math.sin(T * 14) * 0.7
    P(0, 0, 0, 1.6, 1.5, 2.6, 0.9, 0.2, 0.15); P(0, 0.5, 1.8, 1.2, 1.1, 1.3, 1.0, 0.25, 0.18); P(0, 0.35, 2.6, 0.8, 0.6, 0.7, 1.1, 0.3, 0.2); P(-0.4, 1.1, 2, 0.25, 0.5, 0.25, 2.2, 2, 0.6); P(0.4, 1.1, 2, 0.25, 0.5, 0.25, 2.2, 2, 0.6)
    P(-0.3, 0.8, 2.4, 0.22, 0.22, 0.1, 3, 2.4, 0.4); P(0.3, 0.8, 2.4, 0.22, 0.22, 0.1, 3, 2.4, 0.4)
    P(-2, 0.6, -0.1, 2.8, 0.15, 1.8, 0.7, 0.15, 0.12, fl); P(2, 0.6, -0.1, 2.8, 0.15, 1.8, 0.7, 0.15, 0.12, -fl)
    for (let k = 0; k < 4; k++) P(0, -0.1 - k * 0.15, -1.6 - k * 0.9, 0.9 - k * 0.15, 0.8 - k * 0.15, 1, 0.85, 0.18, 0.13)
    if (pt.act > 0) for (let k = 0; k < 9; k++) { const u = k / 9 + (t * 5 % 0.3); P((Math.sin(k * 3 + t * 30)) * 0.6 * u * 3, 0.4, 3 + u * 12, 1.2 + u * 2, 1.2 + u * 2, 1.6, 3, 1.6 + (1 - u) * 1.4, 0.3) }
  }
}
// ---------- main ----------
export function drawRogue3(api, RG, CLASSES) {
  setArena(RG)
  const { put3, putS } = api
  const th = themeOf(RG), t = G.time
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
  // rune trial, chests and the hidden passage
  if (RG.puz) {
    const z = RG.puz
    put3(2, 0.3, 0, 3.2, 0.6, 3.2, 0, 0.3, 0.28, 0.34, 0); putS(2, 1.1 + Math.sin(t * 3) * 0.2, 0, 1.1, 1.1, 1.1, 2.4, 2.2, 2.8)
    z.runes.forEach((r, i) => {
      const c = hex(r.c, 1), lit = clamp(r.lit, 0, 1), solved = z.solved
      put3(r.x, 0.25, -r.y, 3.6, 0.5, 3.6, 0, 0.28, 0.27, 0.32, 0)
      put3(r.x, 0.6, -r.y, 2.6, 0.2, 2.6, i * 0.3 + t * (lit > 0 ? 3 : 0), c[0] * (0.25 + lit * 3), c[1] * (0.25 + lit * 3), c[2] * (0.25 + lit * 3), 0)
      if (lit > 0.05 || solved) { putS(r.x, 2.2 + lit * 2, -r.y, 1.6 + lit, 1.6 + lit, 1.6 + lit, c[0] * 2.6, c[1] * 2.6, c[2] * 2.6); for (let k = 0; k < 8; k++) put3(r.x, 1 + k * 1.2, -r.y, 0.4, 1, 0.4, 0, c[0] * 2 * lit, c[1] * 2 * lit, c[2] * 2 * lit, 0) }
    })
  }
  for (const c of RG.chests) {
    const gold = c.kind !== 'vault', cc = gold ? [0.5, 0.32, 0.1] : [0.34, 0.16, 0.5], gl = gold ? [3, 2.3, 0.5] : [2.2, 0.9, 3]
    put3(c.x, 1, -c.y, 3.4, 2, 2.4, 0, cc[0], cc[1], cc[2], 0); put3(c.x, 2.3 + (c.open ? 1.2 : 0), -c.y - (c.open ? 1.1 : 0), 3.6, 0.8, 2.6, c.open ? -0.9 : 0, cc[0] * 1.2, cc[1] * 1.2, cc[2] * 1.2, 0)
    put3(c.x, 1.4, -c.y + 1.25, 0.5, 0.8, 0.15, 0, gl[0], gl[1], gl[2], 0)
    if (c.open) for (let k = 0; k < 7; k++) putS(c.x + Math.sin(t * 3 + k * 2) * 1.4, 3 + ((t * 2 + k * 0.4) % 3), -c.y + Math.cos(t * 3 + k) * 0.8, 0.5, 0.5, 0.5, gl[0], gl[1], gl[2])
    else { const g = 0.6 + Math.sin(t * 4) * 0.4; putS(c.x, 4 + Math.sin(t * 2) * 0.4, -c.y, 0.7, 0.7, 0.7, gl[0] * g, gl[1] * g, gl[2] * g) }
  }
  if (RG.secret) {
    const sc = RG.secret, X = sc.x, Z = -sc.y - 0.5
    if (!sc.found) { const hint = RG.open ? 0.5 + Math.sin(t * 3) * 0.5 : 0.15; put3(X, 3, Z, 5.2, 6, 1.2, 0, 0.2, 0.19, 0.22, 0); for (let k = 0; k < 4; k++) put3(X - 1.2 + k * 0.8, 3 + (k % 2) * 1.2, Z + 0.7, 0.18, 2.4 + k * 0.4, 0.1, 0.4 * (k % 2 ? 1 : -1), 1.6 * hint + 0.3, 1.2 * hint + 0.2, 0.5 * hint + 0.1, 0); if (RG.open) putS(X, 3, Z + 1, 0.5, 0.5, 0.5, 2.6 * hint, 2 * hint, 0.8 * hint) }
    else { for (let k = 0; k < 16; k++) { const a = (k / 16) * TAU + t * 2; putS(X + Math.cos(a) * 2.4, 3 + Math.sin(a) * 2.4, Z + 0.6, 0.6, 0.6, 0.6, 2.4, 1, 3) } putS(X, 3, Z + 0.5, 3.2 + Math.sin(t * 4) * 0.4, 3.2, 0.7, 1.6, 0.4, 2.6); for (let k = 0; k < 6; k++) putS(X + Math.sin(t * 2 + k) * 1.4, 1 + ((t * 2 + k) % 4), Z + 1.4, 0.35, 0.35, 0.35, 2.6, 1.4, 3) }
  }
  for (const f of RG.fx) if (f.k === 'zap') { const n = Math.ceil(Math.hypot(f.x1 - f.x0, f.y1 - f.y0) / 1.3); for (let q = 0; q <= n; q++) { const u = q / n; putS(f.x0 + (f.x1 - f.x0) * u + (Math.random() - 0.5), 2.6 + (Math.random() - 0.5), -(f.y0 + (f.y1 - f.y0) * u) + (Math.random() - 0.5), 0.5, 0.5, 0.5, 3, 2.8, 0.9) } }
  // characters
  for (const pt of RG.pets) drawPet(put3, pt, t)
  RG.players.forEach((p, i) => drawHero(put3, p, t, CLASSES[p.cls] || CLASSES[0], i === RG.me, RG))
  for (const e of RG.en) drawEnemy(api, e, t, null)
  // projectiles
  for (const b of RG.pb) { const c = hex(b.c || '#ffffff', 2.4); put3(b.x, 2.4, -b.y, b.big ? 1.5 : 0.8, b.big ? 1.5 : 0.7, b.big ? 1.5 : 2, 0, c[0] * 1.4, c[1] * 1.4, c[2] * 1.4, Math.atan2(b.vx, -b.vy)); if (b.big) put3(b.x - b.vx * 0.02, 2.4, -b.y + b.vy * 0.02, 0.9, 0.9, 0.9, 0, c[0], c[1], c[2]) }
  for (const b of RG.eb) { const c = hex(b.c || '#ff8a5a', 2); put3(b.x, 2.2, -b.y, b.r * 1.3, b.r * 1.3, b.r * 1.3, 0, c[0], c[1], c[2], t * 4) }
  // effects
  for (const f of RG.fx) {
    const p = f.p; if (!p) continue
    if (f.k === 'whirl') { const u = 1 - f.l / 0.5; for (let i = 0; i < 18; i++) { const a = (i / 18) * TAU + u * 8; put3(p.x + Math.cos(a) * (3 + u * 10), 2.5, -p.y + Math.sin(a) * (3 + u * 10), 1.4, 0.4, 0.6, 0, 3, 2.6, 0.6, -a) } }
    else if (f.k === 'nova') { const u = 1 - f.l / 0.6; for (let i = 0; i < 28; i++) { const a = (i / 28) * TAU; put3(p.x + Math.cos(a) * (2 + u * 18), 1.2, -p.y + Math.sin(a) * (2 + u * 18), 1, 1.4, 1, 0, 1, 2, 3) } }
  }
  for (const tr of RG.traps) { for (let k = 0; k < 9; k++) { const a = (k / 9) * TAU, rr = tr.r * (0.35 + (k % 3) * 0.25); put3(tr.x + Math.cos(a) * rr, 0.6, -tr.y + Math.sin(a) * rr, 0.35, 1.3, 0.35, 0, 1.6, 1.7, 1.9) } for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU; put3(tr.x + Math.cos(a) * tr.r, 0.2, -tr.y + Math.sin(a) * tr.r, 0.5, 0.2, 0.5, 0, 0.4, 2.2, 1.0) } }
  for (const rn of RG.rains) { for (let k = 0; k < 14; k++) { const a = k * 2.399 + t, rr = rn.r * ((k * 0.37) % 1), h = 14 - ((t * 30 + k * 5) % 14); put3(rn.x + Math.cos(a) * rr, h, -rn.y + Math.sin(a) * rr, 0.25, 2.4, 0.25, 0.2, 1.2, 3, 1.6) } for (let k = 0; k < 14; k++) { const a = (k / 14) * TAU; put3(rn.x + Math.cos(a) * rn.r, 0.2, -rn.y + Math.sin(a) * rn.r, 0.5, 0.2, 0.5, 0, 0.6, 2.4, 1.2) } }
  for (const m of RG.meteors) { const u = Math.max(0, m.l), hh = u * 38; for (let k = 0; k < 16; k++) { const a = (k / 16) * TAU; put3(m.x + Math.cos(a) * m.r * (1 - u * 0.4), 0.2, -m.y + Math.sin(a) * m.r * (1 - u * 0.4), 0.7, 0.2, 0.7, 0, 3, 0.6, 0.3) } put3(m.x + u * 6, hh + 2, -m.y, 3.4, 3.4, 3.4, t * 5, 3.4, 1.8, 0.5); put3(m.x + u * 6 + 1.5, hh + 5, -m.y, 2, 2, 2, t * 4, 3, 1.2, 0.3) }
  // fireflies / embers / wisps
  for (const f of E.flies) {
    const a = t * f.sp + f.ph, gl = 0.6 + Math.sin(t * 3 + f.ph * 3) * 0.4
    const x = f.x + Math.cos(a) * f.rad, z = f.z + Math.sin(a * 1.3) * f.rad
    const y = th.kind === 'crystal' || th.kind === 'ash' ? (f.y + t * 1.2 * f.sp) % 11 : f.y + Math.sin(a * 2) * 0.8
    put3(x, y, z, 0.28, 0.28, 0.28, 0, th.mush[0] * gl * 1.2 + 0.4, th.mush[1] * gl * 1.2 + 0.4, th.mush[2] * gl * 1.2 + 0.4)
  }
  // particles
  for (const q of G.parts) { const f = q.life / q.max, s = q.s * (0.3 + 0.5 * f); put3(q.x, 1.6 + (1 - f) * 1.5, -q.y, s, s, s, 0, q.c[0] * 2, q.c[1] * 2, q.c[2] * 2, q.life * 5) }
}
const EN_COL = { slime: '#5aff7a', bat: '#c06aff', archer: '#ffb04a', brute: '#ff5a5a', caster: '#4ad8ff', king: '#3adf6a', lord: '#e8e8ff', eye: '#ff4adf' }
const EN_COLOR = (t) => EN_COL[t] || '#ffffff'
