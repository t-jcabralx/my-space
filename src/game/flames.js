// FLAMES: the classic name game. Cross out the letters two names share, count what is left, then eliminate
// letters of F-L-A-M-E-S in a circle until one remains: Friends, Lovers, Affection, Marriage, Enemies, Siblings.
// Each outcome plays its own animated voxel scene. Pure JS; the DOM HUD shows the names and the striking-out.
import { G, games, profile, saveProfile, part, ring, shake, flash, popup, stepParticles, toMenu } from './engine.js'
import { rgb } from './sprites.js'
import { sfx, music, speak } from './audio.js'

const R = (a, b) => a + Math.random() * (b - a)
export const LETTERS = ['F', 'L', 'A', 'M', 'E', 'S']
export const OUTCOMES = {
  F: { word: 'FRIENDS', color: '#3de8ff', tag: 'Best buds! Walang iwanan.', icon: '🤝' },
  L: { word: 'LOVERS', color: '#ff4d8d', tag: 'Kilig overload! Destiny calls.', icon: '💕' },
  A: { word: 'AFFECTION', color: '#ffb0d0', tag: 'Someone has a crush... awww!', icon: '🌹' },
  M: { word: 'MARRIAGE', color: '#ffe84a', tag: 'Ring the bells! Habambuhay!', icon: '💍' },
  E: { word: 'ENEMIES', color: '#ff3b4e', tag: 'Rumble time! Susuntukin ka niya!', icon: '👊' },
  S: { word: 'SIBLINGS', color: '#7dff5a', tag: 'Family forever. Kulitan mode on!', icon: '🫂' },
}

// ---------- the actual game logic (pure, testable) ----------
const clean = (s) => String(s || '').toUpperCase().replace(/[^A-Z]/g, '')
export function computeFlames(n1, n2) {
  const A = [...clean(n1)], B = [...clean(n2)]
  const usedB = new Set(), pairs = []
  A.forEach((ch, i) => {
    const j = B.findIndex((x, k) => x === ch && !usedB.has(k))
    if (j >= 0) { usedB.add(j); pairs.push([i, j]) }
  })
  const remaining = A.length + B.length - pairs.length * 2
  const steps = []
  let result = 'S' // identical names: soulmates
  if (remaining > 0) {
    const list = LETTERS.slice()
    let idx = 0
    while (list.length > 1) {
      const start = idx % list.length
      const walk = []
      let at = start
      for (let k = 0; k < remaining; k++) { walk.push(list[at]); at = (at + 1) % list.length }
      const victimIdx = (start + remaining - 1) % list.length
      const victim = list[victimIdx]
      steps.push({ walk, victim, count: remaining })
      list.splice(victimIdx, 1)
      idx = victimIdx % list.length // counting resumes from the letter after the one removed
    }
    result = list[0]
  }
  return { A, B, pairs, remaining, steps, result }
}

// ---------- state ----------
export const FL = { mode: 'idle', phase: 'input', t: 0, a: '', b: '', calc: null, q: [], crossedA: [], crossedB: [], out: {}, hot: '', counter: 0, result: null, resT: 0, emitT: 0, history: [], note: '' }
let snap = null
const subs = new Set()
export const subscribeFlames = (f) => { subs.add(f); return () => subs.delete(f) }
export const getFlamesSnap = () => snap
function emitF() {
  snap = {
    mode: FL.mode, phase: FL.phase, a: FL.a, b: FL.b, A: FL.calc ? FL.calc.A : [...clean(FL.a)], B: FL.calc ? FL.calc.B : [...clean(FL.b)],
    crossedA: FL.crossedA.slice(), crossedB: FL.crossedB.slice(), remaining: FL.calc ? FL.calc.remaining : 0,
    letters: LETTERS.map((ch) => ({ ch, out: !!FL.out[ch], hot: FL.hot === ch })), counter: FL.counter, result: FL.result, out: FL.result ? OUTCOMES[FL.result] : null,
    history: (profile.flamesHistory || []).slice(0, 8), note: FL.note,
  }
  subs.forEach((f) => f())
}
const after = (sec, fn) => FL.q.push({ t: sec, fn })

// ---------- setup ----------
function start() {
  FL.mode = 'play'; FL.phase = 'input'; FL.a = ''; FL.b = ''; FL.calc = null; FL.q = []; FL.crossedA = []; FL.crossedB = []; FL.out = {}; FL.hot = ''; FL.counter = 0; FL.result = null; FL.resT = 0; FL.note = ''
  G.mode = 'flames'; G.parts = []; G.pops = []; G.shake = 0; G.flash = 0
  music.set('cards', 0); sfx('mission'); emitF()
}
function stop() { FL.mode = 'idle'; FL.q = []; music.set('menu'); emitF() }
function reveal(n1, n2) {
  if (FL.phase !== 'input' && FL.phase !== 'result') return false
  const c = computeFlames(n1, n2)
  if (!c.A.length || !c.B.length) { FL.note = 'Type two names with at least one letter each'; sfx('deny'); emitF(); return false }
  FL.note = ''; FL.q = []; FL.calc = c; FL.a = String(n1).trim().slice(0, 200); FL.b = String(n2).trim().slice(0, 200)
  FL.crossedA = c.A.map(() => false); FL.crossedB = c.B.map(() => false); FL.out = {}; FL.hot = ''; FL.counter = 0; FL.result = null; FL.resT = 0
  FL.phase = 'cross'; G.parts = []; G.pops = []
  sfx('cShuffle'); emitF()
  // 1) strike the shared letters, one pair at a time
  let t = 0.9
  c.pairs.forEach(([i, j]) => {
    after(t, () => { FL.crossedA[i] = true; FL.crossedB[j] = true; sfx('cFlip'); shake(0.15); emitF() })
    t += 0.62
  })
  after(t + 0.2, () => { FL.phase = 'count'; FL.counter = c.remaining; sfx('point'); popup(0, 4, String(Math.min(99, c.remaining)), [1, 0.9, 0.4]); emitF() })
  t += 1.4
  // 2) eliminate FLAMES letters
  if (c.remaining === 0) { after(t, () => finish(c.result)); return true }
  for (const st of c.steps) {
    st.walk.forEach((ch, k) => after(t + k * 0.11, () => { FL.hot = ch; FL.counter = k + 1; sfx('cSelect'); emitF() }))
    t += st.walk.length * 0.11 + 0.2
    after(t, () => { FL.out[st.victim] = true; FL.hot = ''; sfx('fault'); shake(0.5); ring(0, -10, 20, 40, [[1, 0.5, 0.2], [1, 0.8, 0.3]]); emitF() })
    t += 0.85
  }
  after(t, () => finish(c.result))
  return true
}
function finish(r) {
  FL.phase = 'result'; FL.result = r; FL.resT = 0; FL.hot = r; FL.out = Object.fromEntries(LETTERS.filter((x) => x !== r).map((x) => [x, true]))
  profile.flamesGames = (profile.flamesGames || 0) + 1
  profile.flamesHistory = [{ a: FL.a, b: FL.b, r }, ...(profile.flamesHistory || [])].slice(0, 12)
  saveProfile()
  sfx(r === 'E' ? 'over' : 'win'); speak(OUTCOMES[r].word.toLowerCase() + '!', 0.9, r === 'E' ? 0.8 : 1.15); flash(0.35, [1, 1, 1]); shake(r === 'E' ? 1.5 : 0.6)
  emitF()
}

function update(dtRaw) {
  const dt = Math.min(dtRaw, 0.05)
  if (FL.mode === 'idle') return
  FL.t += dt
  for (const e of FL.q) e.t -= dt
  const due = FL.q.filter((e) => e.t <= 0)
  if (due.length) { FL.q = FL.q.filter((e) => e.t > 0); for (const e of due) e.fn() }
  if (FL.phase === 'result') { FL.resT += dt; sceneFx(dt) }
  else ambientFx(dt)
  stepParticles(dt)
  FL.emitT -= dt
  if (FL.emitT <= 0) { FL.emitT = 0.1; emitF() }
}
function onKey(code) {
  if (FL.mode === 'idle') return
  if (code === 'Escape') toMenu()
}
export const flamesActions = {
  start, stop, reveal, quit() { toMenu() },
  again() { FL.phase = 'input'; FL.result = null; FL.calc = null; FL.q = []; FL.out = {}; FL.hot = ''; FL.crossedA = []; FL.crossedB = []; FL.note = ''; G.parts = []; G.pops = []; emitF() },
}

// ---------- effects ----------
const pal = (hex, k = 1) => rgb(hex).map((v) => v * k)
function ambientFx(dt) {
  if (Math.random() < dt * 8) part(R(-48, 48), -30, R(-3, 3), R(8, 18), R(1.6, 2.6), pal(['#ff9a2e', '#ff4d4d', '#ffe84a'][(Math.random() * 3) | 0], 1.6), R(0.9, 1.6))
}
function sceneFx(dt) {
  const r = FL.result, t = FL.resT
  if (r === 'F' && t > 2 && Math.random() < dt * 14) part(R(-10, 10), 6, R(-14, 14), R(8, 24), 1.2, pal(['#3de8ff', '#ffe84a', '#7dff5a', '#ff4de1'][(Math.random() * 4) | 0], 1.8), R(0.8, 1.4))
  if ((r === 'L' || r === 'A' || r === 'S') && Math.random() < dt * (r === 'L' ? 5 : 3)) part(R(-8, 8), 6, R(-3, 3), R(6, 12), 2, pal(r === 'S' ? '#7dff5a' : '#ff4d8d', 1.8), R(0.9, 1.5))
  if (r === 'M' && t > 1 && Math.random() < dt * 20) part(R(-30, 30), 30, R(-4, 4), R(-16, -8), 3, pal(['#ffffff', '#ffe84a', '#ffb0d0', '#ff4de1'][(Math.random() * 4) | 0], 1.6), R(0.7, 1.2))
  if (r === 'E') {
    const hit = Math.floor(t / 0.8), prev = Math.floor((t - dt) / 0.8)
    if (t > 1.6 && hit !== prev) { shake(0.9); sfx(hit % 2 ? 'hit' : 'smash'); ring(hit % 2 ? 5 : -5, 3, 14, 38, [[1, 0.9, 0.3], [1, 0.4, 0.2]]); for (let i = 0; i < 12; i++) part(hit % 2 ? 5 : -5, 3, R(-26, 26), R(-6, 26), R(0.3, 0.7), pal('#ffe84a', 2), R(0.8, 1.4)) }
  }
}

// ---------- drawing ----------
const SKIN = ['#ffd2a8', '#e8b48a', '#c98f65', '#f6c9a0']
// Draws a blocky person. o = { s, skin, shirt, pants, hair, hands:[[x,y],[x,y]] (relative to feet), lean, face (+1/-1), blush, mouth, dress, veil, tie, angry, dizzy }
function person(put, x, y, o) {
  const s = o.s || 1, f = o.face || 1, lean = o.lean || 0
  const skin = pal(o.skin || SKIN[0]), shirt = pal(o.shirt || '#3d7bff'), pants = pal(o.pants || '#2a3a78'), hair = pal(o.hair || '#2a1a10')
  const bx = x + lean * 2 * s
  const box = (cx, cy, w, h, c, k = 1, z = 1) => put(cx, cy, z, w * s, h * s, c[0] * k, c[1] * k, c[2] * k)
  const step = o.step || 0
  // legs
  if (o.dress) { for (let i = 0; i < 4; i++) box(x + lean * 0.6 * s, y + (3.2 - i * 0.9) * s, (3.2 + i * 1.1), 0.95, pal(o.dress)) }
  else { box(x - 0.9 * s + step, y + 1.4 * s, 1.5, 3, pants); box(x + 0.9 * s - step, y + 1.4 * s, 1.5, 3, pants) }
  box(x - 0.9 * s + step, y * 1 + 0.2 * s, 1.7, 0.8, pal('#1a1a22')); box(x + 0.9 * s - step, y + 0.2 * s, 1.7, 0.8, pal('#1a1a22'))
  // torso
  box(bx, y + 5.4 * s, 4, 4.6, o.dress ? pal(o.dress, 1.05) : shirt)
  if (o.tie) box(bx, y + 5.6 * s, 0.8, 3, pal(o.tie))
  // head
  const hx = bx + lean * 0.6 * s
  box(hx, y + 9.6 * s, 3.8, 3.6, skin)
  box(hx, y + 11.6 * s, 4.1, 1.3, hair); box(hx - f * 1.8 * s, y + 10.1 * s, 0.9, 2.6, hair)
  if (o.veil) { box(hx - f * 2.3 * s, y + 9 * s, 1, 5.5, pal('#ffffff', 1.2)); box(hx, y + 11.9 * s, 4.4, 0.6, pal('#ffffff', 1.4)) }
  // face
  const eyeY = y + 9.9 * s
  const blink = Math.sin(G.time * 3 + x) > 0.96
  if (!blink) { box(hx + f * 0.5 * s - 0.7 * s, eyeY, 0.55, o.angry ? 0.35 : 0.8, [0.05, 0.05, 0.1]); box(hx + f * 0.5 * s + 0.9 * s, eyeY, 0.55, o.angry ? 0.35 : 0.8, [0.05, 0.05, 0.1]) }
  if (o.angry) { box(hx + f * 0.5 * s - 0.7 * s, eyeY + 0.7 * s, 1.1, 0.3, [0.9, 0.1, 0.1], 2); box(hx + f * 0.5 * s + 0.9 * s, eyeY + 0.7 * s, 1.1, 0.3, [0.9, 0.1, 0.1], 2) }
  if (o.blush) { const bk = 1.2 + Math.sin(G.time * 6) * 0.5; box(hx - 1.2 * s, y + 9.1 * s, 0.9, 0.55, pal('#ff4d8d', bk)); box(hx + 1.4 * s, y + 9.1 * s, 0.9, 0.55, pal('#ff4d8d', bk)) }
  const m = o.mouth || 'smile'
  if (m === 'smile') { box(hx + f * 0.4 * s, y + 8.7 * s, 1.5, 0.3, [0.4, 0.05, 0.1]); box(hx + f * 0.4 * s - 0.8 * s, y + 8.9 * s, 0.3, 0.3, [0.4, 0.05, 0.1]); box(hx + f * 0.4 * s + 0.8 * s, y + 8.9 * s, 0.3, 0.3, [0.4, 0.05, 0.1]) }
  else if (m === 'open') box(hx + f * 0.4 * s, y + 8.6 * s, 1.1, 0.9, [0.5, 0.05, 0.1])
  else if (m === 'frown') { box(hx + f * 0.4 * s, y + 8.6 * s, 1.5, 0.3, [0.4, 0.05, 0.1]); box(hx + f * 0.4 * s - 0.8 * s, y + 8.4 * s, 0.3, 0.3, [0.4, 0.05, 0.1]); box(hx + f * 0.4 * s + 0.8 * s, y + 8.4 * s, 0.3, 0.3, [0.4, 0.05, 0.1]) }
  // arms: from shoulders to hand targets
  const hands = o.hands || [[-3, 4], [3, 4]]
  const sh = [[bx - 2.4 * s, y + 7.2 * s], [bx + 2.4 * s, y + 7.2 * s]]
  hands.forEach((h, i) => {
    const hxw = x + h[0] * s + lean * 2 * s, hyw = y + h[1] * s
    const n = 5
    for (let k = 0; k <= n; k++) { const u = k / n; box(sh[i][0] + (hxw - sh[i][0]) * u, sh[i][1] + (hyw - sh[i][1]) * u, 1.25, 1.25, k === n ? skin : shirt, 1, 2) }
  })
  if (o.dizzy) for (let i = 0; i < 4; i++) { const a = G.time * 6 + i * 1.57; put(hx + Math.cos(a) * 3.2 * s, y + 12.6 * s + Math.sin(a) * 0.9 * s, 3, 0.7, 0.7, 2.2, 2, 0.3) }
}
const HEART = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...']
function heart(put, x, y, sz, col, k = 1, z = 2) { HEART.forEach((row, j) => { for (let i = 0; i < 7; i++) if (row[i] === '#') put(x + (i - 3) * sz, y - j * sz, z, sz, sz, col[0] * k, col[1] * k, col[2] * k) }) }
const STAR = ['..#..', '..#..', '#####', '..#..', '..#..']
function star(put, x, y, sz, col, k = 1, z = 3) { STAR.forEach((row, j) => { for (let i = 0; i < 5; i++) if (row[i] === '#') put(x + (i - 2) * sz, y - (j - 2) * sz, z, sz, sz, col[0] * k, col[1] * k, col[2] * k) }) }
function burst(put, x, y, r, col, k = 2) { for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2, rr = r * (i % 2 ? 0.55 : 1); for (let d = 0.35; d <= 1; d += 0.3) put(x + Math.cos(a) * rr * d, y + Math.sin(a) * rr * d, 4, 0.9, 0.9, col[0] * k, col[1] * k, col[2] * k) } put(x, y, 4, r * 0.5, r * 0.5, col[0] * k, col[1] * k, col[2] * k) }
function flower(put, x, y, sz = 1, k = 1) {
  for (let i = 0; i < 5; i++) put(x, y - i * sz, 2, 0.4 * sz, sz, 0.2 * k, 0.8 * k, 0.3 * k)
  for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) put(x + dx * 0.9 * sz, y + 1.6 * sz + dy * 0.9 * sz, 3, 0.9 * sz, 0.9 * sz, 2 * k, 0.4 * k, 0.6 * k)
  put(x, y + 1.6 * sz, 3, 0.9 * sz, 0.9 * sz, 2.2 * k, 1.8 * k, 0.3 * k)
}
function ring3(put, x, y, r, col, k = 2) { for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; put(x + Math.cos(a) * r, y + Math.sin(a) * r, 3, 0.7, 0.7, col[0] * k, col[1] * k, col[2] * k) } }
const ease = (u) => (u < 0 ? 0 : u > 1 ? 1 : u * u * (3 - 2 * u))
const lerp = (a, b, u) => a + (b - a) * u

function backdrop(put, t, r) {
  const o = r ? OUTCOMES[r] : null
  const c = pal(o ? o.color : '#ff7a2a')
  const pulse = 0.5 + 0.5 * Math.sin(t * 2)
  for (let gx = -50; gx <= 50; gx += 4) for (let gy = -28; gy <= 28; gy += 4) {
    const k = 0.035 + 0.03 * Math.sin(t * 1.3 + gx * 0.2 + gy * 0.17) + pulse * 0.012 + (r ? 0.02 : 0)
    put(gx, gy, -12, 3.8, 3.8, c[0] * k * 2, c[1] * k * 2, c[2] * k * 2)
  }
  // floor line
  for (let x = -46; x <= 46; x += 2) put(x, -13.5, -2, 2, 0.8, c[0] * 0.5, c[1] * 0.5, c[2] * 0.5)
}
const FY = -12.5 // the floor the characters stand on

function sceneFriends(put, t) {
  const a = ease(t / 1.4), jump = t > 2.4 ? Math.abs(Math.sin((t - 2.4) * 4)) * 3.2 : 0
  const ax = lerp(-34, -6.5, a), bx = lerp(34, 6.5, a), step = t < 1.4 ? Math.sin(t * 12) * 0.5 : 0
  const hi = ease((t - 1.4) / 0.6) // high-five raise
  const pa = { s: 1.15, shirt: '#3d7bff', pants: '#2a3a78', hair: '#2a1a10', face: 1, step, mouth: t > 1.6 ? 'open' : 'smile', hands: [[-3, 3 + Math.sin(t * 12) * 1.2 * (1 - hi)], [lerp(3, 7.6, hi), lerp(3, 10.8, hi)]] }
  const pb = { s: 1.15, shirt: '#ffb02e', pants: '#7a4a1a', hair: '#7a3a10', skin: SKIN[1], face: -1, step, mouth: t > 1.6 ? 'open' : 'smile', hands: [[3, 3 + Math.sin(t * 12) * 1.2 * (1 - hi)], [lerp(-3, -7.6, hi), lerp(3, 10.8, hi)]] }
  person(put, ax, FY + jump, pa); person(put, bx, FY + jump, pb)
  if (t > 1.9) { const k = Math.max(0, 1 - (t - 1.9) * 1.2); burst(put, 0, FY + 10.8 + jump, 5 + (t - 1.9) * 6, [1, 0.9, 0.3], 1.5 * k + 0.2) }
  // rainbow
  const cols = ['#ff3b4e', '#ff9a2e', '#ffe84a', '#7dff5a', '#3de8ff', '#b04dff']
  if (t > 2.2) cols.forEach((cc, i) => { for (let k = 0; k <= 18; k++) { const an = Math.PI * (k / 18); put(Math.cos(an) * (28 - i * 1.3), -4 + Math.sin(an) * (18 - i * 0.9), -4, 1.4, 1.4, ...pal(cc, 0.8 * ease((t - 2.2) / 1))) } })
  if (t > 2.4) for (let i = 0; i < 5; i++) star(put, -20 + i * 10, 14 + Math.sin(t * 3 + i) * 2, 0.7, [1, 0.9, 0.3], 1.8)
}
function sceneLovers(put, t) {
  const a = ease(t / 1.6), lean = ease((t - 2.2) / 1)
  const ax = lerp(-32, -3.6, a), bx = lerp(32, 3.6, a)
  const step = t < 1.6 ? Math.sin(t * 12) * 0.5 : 0
  person(put, ax, FY, { s: 1.2, shirt: '#3d7bff', pants: '#2a3a78', face: 1, step, lean: lean * 0.7, blush: t > 1.6, mouth: 'smile', hands: [[-3, 3], [lerp(3, 4.5, lean), lerp(3, 6, lean)]] })
  person(put, bx, FY, { s: 1.2, dress: '#ff4d8d', hair: '#4a2210', skin: SKIN[3], face: -1, step, lean: -lean * 0.7, blush: t > 1.6, mouth: 'smile', hands: [[lerp(-4, -4.5, lean), lerp(4, 6, lean)], [3, 3]] })
  const beat = 1 + Math.sin(t * 5) * 0.12
  heart(put, 0, 15 + Math.sin(t * 2) * 1.2, 1.9 * beat * ease(t / 1.2), [1, 0.2, 0.45], 2)
  if (t > 3.2) { const k = Math.max(0, 1 - (t - 3.2) * 0.8); for (let i = 0; i < 6; i++) heart(put, Math.sin(t * 2 + i * 1.3) * 12, 8 + ((t * 5 + i * 3) % 18), 0.7, [1, 0.3, 0.6], 2 * k + 0.5) }
  if (t > 2.9 && t < 3.3) burst(put, 0, FY + 11, 7, [1, 0.5, 0.7], 1.6)
}
function sceneAffection(put, t) {
  const a = ease(t / 1.6), give = ease((t - 2) / 0.9)
  const ax = lerp(-34, -7, a), bx = 7
  const sway = Math.sin(t * 3) * 0.5
  person(put, ax + sway * (t > 1.8 ? 1 : 0), FY, { s: 1.15, shirt: '#3dff7a', pants: '#2a5a3a', face: 1, step: t < 1.6 ? Math.sin(t * 12) * 0.5 : 0, blush: t > 1.6, mouth: 'smile', hands: [[-3, 3], [lerp(-1, 7.5, give), lerp(5, 7, give)]] })
  person(put, bx, FY, { s: 1.15, dress: '#b04dff', hair: '#1a1a22', skin: SKIN[2], face: -1, blush: t > 2.4, mouth: t > 2.6 ? 'open' : 'smile', hands: [[lerp(-3, -4, give), lerp(3, 7, give)], [3, 3]] })
  if (t < 2.9 || true) flower(put, lerp(ax - 2.2, 7.2 - 2.8, give) + 3, FY + lerp(5.2, 8, give) + (t > 2.9 ? Math.sin(t * 4) * 0.2 : 0), 1.1)
  if (t > 2.6) for (let i = 0; i < 5; i++) heart(put, bx + Math.sin(t * 1.7 + i * 2) * 7, FY + 12 + ((t * 4 + i * 4) % 16), 0.65, [1, 0.5, 0.75], 2)
  if (t > 2.2) for (let i = 0; i < 8; i++) { const an = t * 2 + i * 0.8; star(put, (ax + bx) / 2 + Math.cos(an) * 12, 4 + Math.sin(an) * 7, 0.5, [1, 0.9, 0.5], 1.6) }
}
function sceneMarriage(put, t) {
  // chapel arch + bell
  const white = [1.1, 1.1, 1.2]
  for (let y = -12; y <= 16; y += 1.4) { put(-17, y, -5, 1.6, 1.4, ...white.map((v) => v * 0.6)); put(17, y, -5, 1.6, 1.4, ...white.map((v) => v * 0.6)) }
  for (let k = 0; k <= 22; k++) { const an = Math.PI * (k / 22); put(Math.cos(an) * 17, 16 + Math.sin(an) * 9, -5, 1.6, 1.6, ...white.map((v) => v * 0.7)) }
  put(0, 28, -4, 0.9, 4, 2, 1.8, 0.4); put(0, 28.5, -4, 3.4, 0.9, 2, 1.8, 0.4)
  const sw = Math.sin(t * 5) * 1.6
  for (let i = 0; i < 4; i++) put(sw * (i / 4) + 0, 22 - i * 1.1, -3, 3.2 - i * 0.3, 1, 2, 1.6, 0.3)
  const a = ease(t / 2), kiss = ease((t - 3.4) / 0.8)
  const ax = lerp(-34, -3.6, a), bx = lerp(34, 3.6, a)
  const st = t < 2 ? Math.sin(t * 10) * 0.5 : 0
  person(put, ax, FY, { s: 1.2, shirt: '#1a1a24', pants: '#101018', tie: '#ff3b4e', face: 1, step: st, lean: kiss * 0.6, mouth: 'smile', blush: t > 2.2, hands: [[-3, 3], [lerp(3, 4.5, kiss), lerp(3, 7, kiss)]] })
  person(put, bx, FY, { s: 1.2, dress: '#ffffff', veil: true, hair: '#4a2210', skin: SKIN[3], face: -1, step: st, lean: -kiss * 0.6, mouth: 'smile', blush: t > 2.2, hands: [[lerp(-4, -4.5, kiss), lerp(5, 7, kiss)], [3, 3]] })
  // rings exchanged
  if (t > 2.4) { const u = ease((t - 2.4) / 0.9), gl = 1.5 + Math.sin(t * 8) * 0.6; ring3(put, lerp(-6, -0.9, u), 5 + u * 6, 1.1, [1, 0.85, 0.2], gl); ring3(put, lerp(6, 0.9, u), 5 + u * 6, 1.1, [1, 0.85, 0.2], gl); if (t > 3.3) star(put, 0, 12.2 + Math.sin(t * 6), 0.7, [1, 1, 0.6], 2) }
  if (t > 3.6) heart(put, 0, 19 + Math.sin(t * 3), 1.4 * (1 + Math.sin(t * 5) * 0.1), [1, 0.3, 0.5], 2)
}
function sceneEnemies(put, t) {
  const a = ease(t / 1.2)
  const ax = lerp(-34, -7, a), bx = lerp(34, 7, a)
  const st = t < 1.2 ? Math.sin(t * 12) * 0.5 : 0
  // glare + lightning
  if (t > 1.2 && t < 1.7) { for (let i = 0; i < 12; i++) put(lerp(-6, 6, i / 11), 7 + (i % 2 ? 1.6 : -1.6), 3, 1.2, 1.2, 2.4, 2, 0.2) }
  const k = t - 1.7
  const phase = k < 0 ? -1 : Math.floor(k / 0.8) % 2 // 0: A punches, 1: B punches
  const u = k < 0 ? 0 : (k % 0.8) / 0.8
  const punch = k < 0 ? 0 : Math.sin(Math.min(1, u * 1.6) * Math.PI)
  const knock = (who) => (k >= 0 && phase === who ? 0 : 0)
  const hitA = k >= 0 && phase === 1 ? Math.sin(Math.min(1, u * 1.6) * Math.PI) : 0 // A is hit
  const hitB = k >= 0 && phase === 0 ? Math.sin(Math.min(1, u * 1.6) * Math.PI) : 0
  const reachA = phase === 0 ? punch : 0, reachB = phase === 1 ? punch : 0
  const pa = { s: 1.2, shirt: '#ff3b4e', pants: '#2a1a1a', face: 1, step: st, angry: true, mouth: hitA > 0.2 ? 'open' : 'frown', lean: reachA * 0.8 - hitA * 0.9, dizzy: hitA > 0.5, hands: [[-2.6, 5 + Math.sin(t * 9) * 0.5], [lerp(3.4, 13, reachA), lerp(5.5, 8.4, reachA)]] }
  const pb = { s: 1.2, shirt: '#b04dff', pants: '#2a1a3a', hair: '#e8e8e8', skin: SKIN[2], face: -1, step: st, angry: true, mouth: hitB > 0.2 ? 'open' : 'frown', lean: -reachB * 0.8 + hitB * 0.9, dizzy: hitB > 0.5, hands: [[lerp(-3.4, -13, reachB), lerp(5.5, 8.4, reachB)], [2.6, 5 + Math.sin(t * 9 + 1) * 0.5]] }
  person(put, ax - hitA * 3.5, FY + Math.abs(hitA) * 0.6, pa); person(put, bx + hitB * 3.5, FY + Math.abs(hitB) * 0.6, pb)
  void knock
  if (k >= 0 && u > 0.35 && u < 0.7) burst(put, phase === 0 ? 7 : -7, 4, 5.5, [1, 0.85, 0.2], 2.2)
  if (t > 4) for (let i = 0; i < 4; i++) { const an = t * 5 + i * 1.6; put(Math.cos(an) * 10, 15 + Math.sin(an) * 2, 3, 0.8, 0.8, 2.4, 1, 0.2) }
  if (t > 1.2) { const an = Math.floor(t * 8) % 2; put(0, 16, 3, 1.2, 1.2, an ? 2.4 : 1.2, 0.2, 0.2); put(0.7, 17, 3, 1.2, 1.2, an ? 2.4 : 1.2, 0.2, 0.2) }
  // anger marks
  if (k >= 0) { const f = Math.sin(t * 10) > 0; if (f) for (const sx of [-1, 1]) { put(sx * 7.5, 13.5, 3, 0.5, 1.6, 2.4, 0.2, 0.2); put(sx * 7.5 + 0.9, 13.5, 3, 1.6, 0.5, 2.4, 0.2, 0.2) } }
}
function sceneSiblings(put, t) {
  const cyc = t % 9
  const bigX = -4, bigS = 1.3, smallS = 0.85
  let sx, sy = 0, rub = 0, onBack = 0, face = -1, mood = 'smile', angry = false
  if (cyc < 1.6) { sx = lerp(30, 6, ease(cyc / 1.6)) }
  else if (cyc < 4) { sx = 6; rub = 1; angry = true; mood = 'frown' }
  else if (cyc < 5) { const u = ease((cyc - 4) / 1); sx = lerp(6, bigX + 1.2, u); sy = Math.sin(u * Math.PI) * 8 + u * 6.2 * smallS; onBack = u; mood = 'open' }
  else { onBack = 1; sx = bigX + 1.2 + ((cyc - 5) * 3.2) % 20 - 4; sy = 6.2 * smallS; mood = 'open' }
  const carry = cyc >= 5
  const bx = carry ? bigX + ((cyc - 5) * 3.2) % 20 - 4 : bigX
  const bounce = carry ? Math.abs(Math.sin(cyc * 6)) * 0.8 : 0
  person(put, bx, FY + bounce, { s: bigS, shirt: '#ffb02e', pants: '#3a3a5a', face: 1, mouth: 'smile', step: carry ? Math.sin(cyc * 10) * 0.6 : 0, hands: rub ? [[-3, 4], [2.6 + Math.sin(t * 16) * 1.3, 11.5 * smallS / 1 + 0.3]] : carry ? [[-3, 4], [3, 4]] : [[-3, 4], [3, 4]] })
  if (!carry || cyc < 5) {
    // the little one
    person(put, sx, FY + (onBack ? sy : 0) , { s: smallS, shirt: '#3de8ff', pants: '#2a3a78', hair: '#7a3a10', face: carry ? 1 : face, angry, mouth: mood, step: !onBack && cyc < 1.6 ? Math.sin(t * 14) * 0.5 : 0, dizzy: false, hands: onBack ? [[-3, 6], [3, 6]] : [[-3, 3.5], [3, 3.5]] })
  } else {
    person(put, sx, FY + bounce + sy, { s: smallS, shirt: '#3de8ff', pants: '#2a3a78', hair: '#7a3a10', face: 1, mouth: 'open', hands: [[-3, 8], [3, 8]] })
  }
  if (rub) { for (let i = 0; i < 3; i++) { const an = t * 12 + i * 2.1; put(sx + Math.cos(an) * 3.4, FY + 15 + Math.sin(an) * 1, 3, 0.6, 0.6, 2.2, 0.3, 0.3) } if (Math.sin(t * 10) > 0) { put(sx + 3, FY + 13, 3, 0.5, 1.5, 2.4, 0.2, 0.2); put(sx + 3.9, FY + 13, 3, 1.5, 0.5, 2.4, 0.2, 0.2) } }
  if (carry) for (let i = 0; i < 5; i++) heart(put, bx + Math.sin(t * 1.5 + i * 2) * 8, FY + 14 + ((t * 4 + i * 4) % 14), 0.6, [0.5, 1, 0.5], 2)
  if (cyc > 4.8 && cyc < 5.3) burst(put, bx + 1, FY + 8, 5, [0.6, 1, 0.5], 1.5)
}
const SCENES = { F: sceneFriends, L: sceneLovers, A: sceneAffection, M: sceneMarriage, E: sceneEnemies, S: sceneSiblings }

function draw(api) {
  const { put } = api
  const t = G.time
  backdrop(put, t, FL.phase === 'result' ? FL.result : null)
  if (FL.phase === 'result' && SCENES[FL.result]) SCENES[FL.result](put, FL.resT)
  else {
    // while names are being crossed out: two little bobbing figures wait and watch the flames
    const bob = Math.abs(Math.sin(t * 3)) * 0.8
    person(put, -22, FY + bob, { s: 1.1, shirt: '#3d7bff', face: 1, mouth: FL.phase === 'count' ? 'open' : 'smile', hands: [[-3, 3], [3, 3 + bob]] })
    person(put, 22, FY + (0.8 - bob), { s: 1.1, dress: '#ff4d8d', hair: '#4a2210', skin: SKIN[3], face: -1, mouth: FL.phase === 'count' ? 'open' : 'smile', hands: [[-3, 3 + bob], [3, 3]] })
    heart(put, 0, 4 + Math.sin(t * 2) * 1.5, 1.4 * (1 + Math.sin(t * 6) * 0.1), [1, 0.4, 0.2], 1.6)
  }
  for (const q of G.parts) { const f = q.life / q.max; put(q.x, q.y, 6, q.s * (0.35 + 0.65 * f) * 0.9, q.s * (0.35 + 0.65 * f) * 0.9, q.c[0] * 1.8, q.c[1] * 1.8, q.c[2] * 1.8) }
  api.pops(G.pops, 0)
}
if (typeof window !== 'undefined') { window.__FL = FL; window.__flames = flamesActions }
games.flames = { update, onKey, draw, stop, sky: () => '#07040f' }
