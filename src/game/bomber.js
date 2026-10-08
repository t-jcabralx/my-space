import { animePortrait } from './artDirection.js'
// Bomber Blast: classic grid battle arena. Pure JS; drawing goes through the api passed by Scene.jsx.
import { G, keys, games, profile, saveProfile, recordScore, part, ring, shake, flash, popup, COLS, stepParticles, toMenu } from './engine.js'
import { SP, rgb } from './sprites.js'
import { sfx, music, speak } from './audio.js'

const COLS_N = 19, ROWS_N = 11, CELL = 4
const OX = -38, OY = 20 // top-left of the grid in world units
const R = (a, b) => a + Math.random() * (b - a)
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
const wx = (c) => OX + c * CELL
const wy = (r) => OY - r * CELL
const key = (c, r) => r * COLS_N + c
const DIFF = [
  { name: 'EASY', think: 0.3, eager: 0.45, mistake: 0.12, speed: 0.92 },
  { name: 'MEDIUM', think: 0.16, eager: 0.8, mistake: 0.03, speed: 1 },
  { name: 'HARD', think: 0.07, eager: 1, mistake: 0, speed: 1.05 },
]
export const MODES = {
  ffa:   { name: 'FREE FOR ALL', desc: 'You vs 3 bots. Last one standing wins.', n: 4, humans: [0] },
  duel:  { name: '1v1 DUEL', desc: 'You vs 1 bot.', n: 2, humans: [0] },
  local: { name: '1v1 LOCAL', desc: 'Two humans, one keyboard.', n: 2, humans: [0, 1] },
  party: { name: 'PARTY (2P)', desc: '2 humans + 2 bots, free for all.', n: 4, humans: [0, 1] },
  team:  { name: '2v2 + BOT', desc: 'You and a bot partner vs 2 bots.', n: 4, humans: [0], teams: true },
  coop:  { name: '2v2 CO-OP', desc: '2 humans vs 2 bots.', n: 4, humans: [0, 1], teams: true },
  online: { name: 'ONLINE', desc: 'Friends over the internet; bots fill the rest.', n: 4, humans: [0, 1], online: true },
  demo:  { name: 'BOTS ONLY', desc: 'Watch 4 bots battle (demo).', n: 4, humans: [] },
}
const PCOL = ['#3de8ff', '#ff4de1', '#ffe84a', '#3dff7a']
const ITEMS = [['B', 'bomb', 25], ['P', 'fire', 25], ['R', 'speed', 20], ['W', 'kick', 12], ['S', 'shield', 10]]

export const B = {
  mode: 'idle', paused: false, phase: 'ready', cfg: { type: 'ffa', diff: 2, rounds: 3 }, g: [], pl: [], bombs: [], flames: [], items: [],
  round: 1, wins: [0, 0, 0, 0], t: 0, readyT: 0, elapsed: 0, sudden: false, sIdx: 0, sT: 0, spiral: [], msg: null, over: null, emitT: 0, endT: 0,
  kills: [0, 0, 0, 0], bricks: 0, resultT: 0, lastTick: 0,
}
let snap = null
const subs = new Set()
export const subscribeBomber = (f) => { subs.add(f); return () => subs.delete(f) }
export const getBomberSnap = () => snap
function emitB() {
  const m = MODES[B.cfg.type]
  snap = {
    mode: B.mode, paused: B.paused, phase: B.phase, type: B.cfg.type, modeName: m.name, diff: DIFF[B.cfg.diff - 1].name, teams: !!m.teams,
    round: B.round, rounds: B.cfg.rounds, need: Math.ceil(B.cfg.rounds / 2), time: Math.max(0, Math.ceil(150 - B.elapsed)), sudden: B.sudden,
    countdown: B.phase === 'ready' ? Math.ceil(B.readyT) : 0, msg: B.msg, over: B.over,
    players: B.pl.map((p) => ({ id: p.id, name: p.name, color: PCOL[p.id], alive: p.alive, human: p.human, wins: B.wins[p.id], kills: B.kills[p.id], bombs: p.cap, range: p.range, speed: Math.round(p.speed * 10) / 10, kick: p.kick, shield: p.shield > 0, team: p.team })),
  }
  subs.forEach((f) => f())
}

// ---------- setup ----------
function names(type) {
  const m = MODES[type]
  return (i) => {
    const h = m.humans.indexOf(i)
    if (h >= 0) return (type === 'online' && B.names && B.names[h]) ? String(B.names[h]).slice(0, 8).toUpperCase() : m.humans.length === 1 ? 'YOU' : 'P' + (h + 1)
    return 'BOT ' + (i + 1)
  }
}
function genGrid(spawns) {
  const g = []
  for (let r = 0; r < ROWS_N; r++) {
    g.push([])
    for (let c = 0; c < COLS_N; c++) {
      let v = 0
      if (r === 0 || c === 0 || r === ROWS_N - 1 || c === COLS_N - 1) v = 1
      else if (r % 2 === 0 && c % 2 === 0) v = 1
      else v = Math.random() < 0.72 ? 2 : 0
      g[r].push(v)
    }
  }
  for (const [sc, sr] of spawns) for (const [dc, dr] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]]) {
    const c = sc + dc, r = sr + dr
    if (c > 0 && r > 0 && c < COLS_N - 1 && r < ROWS_N - 1 && g[r][c] !== 1) g[r][c] = 0
  }
  return g
}
function makeSpiral() {
  const out = []
  let top = 1, bot = ROWS_N - 2, lef = 1, rig = COLS_N - 2
  while (top <= bot && lef <= rig) {
    for (let c = lef; c <= rig; c++) out.push([c, top]); top++
    for (let r = top; r <= bot; r++) out.push([rig, r]); rig--
    if (top <= bot) { for (let c = rig; c >= lef; c--) out.push([c, bot]); bot-- }
    if (lef <= rig) { for (let r = bot; r >= top; r--) out.push([lef, r]); lef++ }
  }
  return out
}
function start(type = 'ffa', diff = 2, rounds = 3, opts = {}) {
  const m = MODES[type]
  if (type !== 'online') B.net = null
  else { const nh = Math.max(2, Math.min(4, opts.humans || 2)); m.humans = Array.from({ length: nh }, (_, i) => i); m.n = nh > 2 ? 4 : 2; B.names = opts.names || [] }
  B.cfg = { type, diff, rounds }
  const corners = { TL: [1, 1], TR: [COLS_N - 2, 1], BL: [1, ROWS_N - 2], BR: [COLS_N - 2, ROWS_N - 2] }
  let order
  if (m.teams) order = [corners.TL, corners.BL, corners.TR, corners.BR]
  else if (m.n === 2) order = [corners.TL, corners.BR]
  else order = [corners.TL, corners.TR, corners.BL, corners.BR]
  B.spawns = order
  const nm = names(type)
  B.pl = order.slice(0, m.n).map((s, i) => ({
    id: i, team: m.teams ? (i < 2 ? 0 : 1) : i, human: m.humans.indexOf(i) >= 0 ? m.humans.indexOf(i) + 1 : 0, name: nm(i), x: s[0] + 0.5, y: s[1] + 0.5,
    alive: true, dying: 0, cap: 1, range: 2, speed: 3.3, kick: false, shield: 0, inv: 0, face: [0, 1], anim: 0, active: 0, think: R(0, 0.3), path: null, aiDir: [0, 0], move: [0, 0],
  }))
  B.wins = [0, 0, 0, 0]; B.kills = [0, 0, 0, 0]; B.bricks = 0; B.round = 1; B.over = null
  G.mode = 'bomber'; G.parts = []; G.pops = []; G.shake = 0; G.flash = 0
  B.mode = 'play'; B.paused = false
  music.set('bomber', 0)
  newRound(); sfx('mission'); emitB()
}
function newRound() {
  B.g = genGrid(B.spawns.slice(0, B.pl.length))
  B.bombs = []; B.flames = []; B.items = []; B.sudden = false; B.sIdx = 0; B.sT = 0; B.elapsed = 0; B.endT = 0; B.rainT = 22; B.spiral = makeSpiral(); B.msg = null
  B.pl.forEach((p, i) => {
    const s = B.spawns[i]
    Object.assign(p, { x: s[0] + 0.5, y: s[1] + 0.5, alive: true, dying: 0, cap: 1, range: 2, speed: 3.3, kick: false, shield: 0, inv: 1.2, active: 0, path: null, face: [0, 1] })
  })
  B.phase = 'ready'; B.readyT = 3.4; B.lastCount = 4
  G.parts = []
}
function powerRain() {
  const free = []
  for (let r = 1; r < ROWS_N - 1; r++) for (let c = 1; c < COLS_N - 1; c++) {
    if (B.g[r][c] !== 0 || bombAt(c, r) || B.items.some((it) => it.c === c && it.r === r)) continue
    if (B.pl.some((p) => p.alive && Math.abs(p.x - c - 0.5) < 1.6 && Math.abs(p.y - r - 0.5) < 1.6)) continue
    free.push([c, r])
  }
  for (let i = 0; i < 5 && free.length; i++) {
    const [c, r] = free.splice(Math.floor(Math.random() * free.length), 1)[0]
    const pick = ITEMS[Math.floor(Math.random() * ITEMS.length)]
    B.items.push({ c, r, glyph: pick[0], kind: pick[1], t: 0, drop: 1 })
  }
  B.msg = { text: 'POWER-UP RAIN!', sub: 'ITEMS ARE FALLING · GRAB THEM FIRST', color: '#3dff7a', t: 2 }
  sfx('event'); speak('Power-up rain!', 0.7, 1.1)
}
function stop() { if (B.net) { const n = B.net; B.net = null; if (n.onStop) try { n.onStop() } catch { /* ignore */ } } B.mode = 'idle'; B.paused = false; music.set('menu'); emitB() }

// ---------- grid helpers ----------
const inb = (c, r) => c >= 0 && r >= 0 && c < COLS_N && r < ROWS_N
const bombAt = (c, r) => B.bombs.find((b) => b.c === c && b.r === r)
const flameAt = (c, r) => B.flames.some((f) => f.c === c && f.r === r)
function blocked(c, r, p) {
  if (!inb(c, r)) return true
  const v = B.g[r][c]
  if (v === 1 || v === 2) return true
  const b = bombAt(c, r)
  return !!b && !(p && b.pass.has(p.id))
}
const RAD = 0.36
function collides(x, y, p) {
  for (const dx of [-RAD, RAD]) for (const dy of [-RAD, RAD]) if (blocked(Math.floor(x + dx), Math.floor(y + dy), p)) return true
  return false
}
function blastCells(c, r, range) {
  const out = [[c, r]]
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    for (let i = 1; i <= range; i++) {
      const cc = c + dx * i, rr = r + dy * i
      if (!inb(cc, rr) || B.g[rr][cc] === 1) break
      out.push([cc, rr])
      if (B.g[rr][cc] === 2) break
    }
  }
  return out
}

// ---------- bombs & flames ----------
function placeBomb(p) {
  if (!p.alive || p.dying > 0 || B.phase !== 'fight') return
  const c = Math.floor(p.x), r = Math.floor(p.y)
  if (p.active >= p.cap || bombAt(c, r) || flameAt(c, r) || B.g[r][c] !== 0) return
  const pass = new Set(B.pl.filter((q) => q.alive && Math.floor(q.x - RAD) <= c && Math.floor(q.x + RAD) >= c && Math.floor(q.y - RAD) <= r && Math.floor(q.y + RAD) >= r).map((q) => q.id))
  B.bombs.push({ c, r, owner: p.id, t: 2.3, range: p.range, pass, vx: 0, vy: 0, fx: c + 0.5, fy: r + 0.5 })
  p.active++
  sfx('bombPlace')
}
function explode(b) {
  if (b.done) return
  b.done = true
  const o = B.pl[b.owner]
  if (o) o.active = Math.max(0, o.active - 1)
  const cells = [[b.c, b.r]]
  sfx('bombBoom'); shake(1.1)
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    for (let i = 1; i <= b.range; i++) {
      const c = b.c + dx * i, r = b.r + dy * i
      if (!inb(c, r) || B.g[r][c] === 1) break
      cells.push([c, r])
      if (B.g[r][c] === 2) break
      const ob = bombAt(c, r)
      if (ob && !ob.done) { ob.t = Math.min(ob.t, 0.05) ; break }
    }
  }
  for (const [c, r] of cells) {
    const ix = B.items.findIndex((it) => it.c === c && it.r === r) // exposed power-ups burn
    if (ix >= 0) { B.items.splice(ix, 1); part(wx(c) + 2, wy(r) - 2, 0, 0, 0.3, [1, 0.5, 0.2], 2) }
    if (B.g[r][c] === 2) { B.g[r][c] = 0; B.bricks++; profile.bricks = (profile.bricks || 0) + 1; brickBreak(c, r) }
    B.flames.push({ c, r, t: 0.55, owner: b.owner, team: o ? o.team : -1 })
    part(wx(c) + 2, wy(r) - 2, R(-12, 12), R(-12, 12), 0.5, COLS.fire[(Math.random() * 4) | 0], 1.6)
  }
  const kx = wx(b.c) + 2, ky = wy(b.r) - 2
  ring(kx, ky, 18, 30, COLS.fire)
  B.bombs = B.bombs.filter((x) => x !== b)
}
function brickBreak(c, r) {
  const x = wx(c) + 2, y = wy(r) - 2
  sfx('crate')
  for (let i = 0; i < 9; i++) part(x, y, R(-22, 22), R(8, 34), R(0.5, 1), i % 2 ? [0.8, 0.4, 0.2] : [0.6, 0.3, 0.15], R(0.8, 1.4), 0, 90)
  if (Math.random() < 0.4) {
    let tot = ITEMS.reduce((a, i) => a + i[2], 0), q = Math.random() * tot, pick = ITEMS[0]
    for (const it of ITEMS) { q -= it[2]; if (q <= 0) { pick = it; break } }
    B.items.push({ c, r, glyph: pick[0], kind: pick[1], t: 0 })
  }
}
function kill(p, byFlame) {
  if (!p.alive || p.dying > 0) return
  if (p.inv > 0) return
  if (p.shield > 0) { p.shield = 0; p.inv = 1.2; sfx('deflect'); ring(wx(Math.floor(p.x)) + 2, wy(Math.floor(p.y)) - 2, 20, 35, COLS.cyan); return }
  p.dying = 0.9
  sfx('die'); shake(1.4)
  const x = wx(p.x), y = wy(p.y)
  for (let i = 0; i < 24; i++) part(x, y, R(-40, 40), R(-40, 40), R(0.5, 1.1), i % 2 ? [1, 1, 1] : rgb(PCOL[p.id]), R(1, 2), 1.5)
  if (byFlame && byFlame.owner !== p.id) {
    const o = B.pl[byFlame.owner]
    if (o && o.team !== p.team) { B.kills[o.id]++; profile.bomberKills = (profile.bomberKills || 0) + (o.human ? 1 : 0); popup(x, y + 4, '+KO', [1, 0.8, 0.3]) }
  }
}

// ---------- movement ----------
function moveAxis(p, dx, dy, dt) {
  const sp = p.speed * dt
  const nx = p.x + dx * sp, ny = p.y + dy * sp
  if (!collides(nx, ny, p)) { p.x = nx; p.y = ny; return }
  // kick a bomb in our way
  if (p.kick) {
    const fc = Math.floor(p.x + dx * (RAD + 0.15)), fr = Math.floor(p.y + dy * (RAD + 0.15))
    const b = bombAt(fc, fr)
    if (b && !b.pass.has(p.id) && !b.vx && !b.vy && !blocked(fc + dx, fr + dy, null)) { b.vx = dx; b.vy = dy; sfx('kick') }
  }
  // corner assist: slide toward the lane centre
  if (dx) {
    const lane = Math.floor(p.y) + 0.5, off = lane - p.y
    if (Math.abs(off) > 0.02 && Math.abs(off) < 0.5) {
      const step = Math.sign(off) * Math.min(Math.abs(off), sp)
      if (!collides(p.x, p.y + step, p)) p.y += step
    }
  } else if (dy) {
    const lane = Math.floor(p.x) + 0.5, off = lane - p.x
    if (Math.abs(off) > 0.02 && Math.abs(off) < 0.5) {
      const step = Math.sign(off) * Math.min(Math.abs(off), sp)
      if (!collides(p.x + step, p.y, p)) p.x += step
    }
  }
}

// ---------- humans ----------
function humanInput(h) {
  if (B.net) {
    if (h !== B.net.me) return (B.netIn && B.netIn[h]) || [0, 0]
    const l = keys.KeyA || keys.ArrowLeft, r = keys.KeyD || keys.ArrowRight, u = keys.KeyW || keys.ArrowUp, d = keys.KeyS || keys.ArrowDown
    return [(r ? 1 : 0) - (l ? 1 : 0), (d ? 1 : 0) - (u ? 1 : 0)]
  }
  const two = B.pl.some((p) => p.human === 2)
  const wasd = h === 1, arrows = h === 2 || !two
  const l = (wasd && keys.KeyA) || (arrows && keys.ArrowLeft), r = (wasd && keys.KeyD) || (arrows && keys.ArrowRight)
  const u = (wasd && keys.KeyW) || (arrows && keys.ArrowUp), d = (wasd && keys.KeyS) || (arrows && keys.ArrowDown)
  return [(r ? 1 : 0) - (l ? 1 : 0), (d ? 1 : 0) - (u ? 1 : 0)]
}
function onKey(code) {
  if (B.mode === 'idle') return
  if (code === 'Escape' || code === 'KeyP') { if (B.mode === 'play' && !B.net) { B.paused = !B.paused; sfx('ui'); emitB() } return }
  if (B.paused) { if (code === 'Enter') { B.paused = false; emitB() } return }
  if (B.mode === 'over') { if (code === 'Enter') bomberActions.rematch(); return }
  if (B.net) { if (code === 'Space' || code === 'KeyF' || code === 'KeyB' || code === 'Enter') dropBomb(B.net.me); return }
  const two = B.pl.some((p) => p.human === 2)
  let who = 0
  if (code === 'Space' || code === 'KeyF' || code === 'KeyB') who = 1
  else if (code === 'Enter' || code === 'Slash' || code === 'Period' || code === 'KeyM2') who = two ? 2 : 0
  if ((code === 'Enter') && !two) who = 1
  if (!who) return
  const p = B.pl.find((q) => q.human === who)
  if (p) placeBomb(p)
}

// ---------- bots ----------
function dangerMap() {
  const d = new Float32Array(COLS_N * ROWS_N).fill(99)
  for (const f of B.flames) d[key(f.c, f.r)] = 0
  for (const b of B.bombs) for (const [c, r] of blastCells(b.c, b.r, b.range)) d[key(c, r)] = Math.min(d[key(c, r)], b.t)
  return d
}
function bfs(sc, sr, p, okCell, goal, maxD = 40) {
  const prev = new Map(), q = [[sc, sr]]
  prev.set(key(sc, sr), null)
  for (let qi = 0; qi < q.length; qi++) {
    const [c, r] = q[qi]
    if ((c !== sc || r !== sr) && goal(c, r)) {
      const path = []
      let cur = key(c, r)
      while (cur !== null && prev.get(cur) !== null) { path.push([cur % COLS_N, Math.floor(cur / COLS_N)]); cur = prev.get(cur) }
      return path.reverse()
    }
    if (q.length > 400) break
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dx, nr = r + dy
      const k = key(nc, nr)
      if (!inb(nc, nr) || prev.has(k)) continue
      if (B.g[nr][nc] !== 0 || (bombAt(nc, nr) && !(p.pass && 0))) continue
      if (!okCell(nc, nr)) continue
      prev.set(k, key(c, r)); q.push([nc, nr])
    }
  }
  return null
}
function botThink(p, danger) {
  const cfg = DIFF[B.cfg.diff - 1]
  const c = Math.floor(p.x), r = Math.floor(p.y)
  const myDanger = danger[key(c, r)]
  const enemies = B.pl.filter((q) => q.alive && q.dying <= 0 && q.team !== p.team)
  // 1) get out of danger
  if (myDanger < 3 && Math.random() > cfg.mistake) {
    const path = bfs(c, r, p, (cc, rr) => !flameAt(cc, rr) && danger[key(cc, rr)] > 0.25, (cc, rr) => danger[key(cc, rr)] > 50)
    if (path && path.length) { p.path = path; return }
  }
  // 2) place a bomb when it is useful and safe
  if (p.active < p.cap && !bombAt(c, r) && Math.random() < cfg.eager) {
    const cells = blastCells(c, r, p.range)
    const near = cells.some(([cc, rr]) => B.g[rr][cc] === 2) || enemies.some((e) => cells.some(([cc, rr]) => Math.floor(e.x) === cc && Math.floor(e.y) === rr))
    if (near) {
      const blast = new Set(cells.map(([cc, rr]) => key(cc, rr)))
      const escape = bfs(c, r, p, (cc, rr) => !flameAt(cc, rr) && !blast.has(key(cc, rr)) || (blast.has(key(cc, rr)) && false), (cc, rr) => !blast.has(key(cc, rr)) && danger[key(cc, rr)] > 50)
      const esc2 = bfs(c, r, p, (cc, rr) => !flameAt(cc, rr) && danger[key(cc, rr)] > 0.6, (cc, rr) => !blast.has(key(cc, rr)) && danger[key(cc, rr)] > 50)
      if ((escape || esc2) && ((escape || esc2).length <= 7)) { placeBomb(p); p.path = (escape || esc2); return }
    }
  }
  // 3) go for power-ups, then towards a bombing position or an enemy
  const safe = (cc, rr) => !flameAt(cc, rr) && danger[key(cc, rr)] > 1.2
  let path = null
  if (B.items.length) path = bfs(c, r, p, safe, (cc, rr) => B.items.some((it) => it.c === cc && it.r === rr), 14)
  if (!path) path = bfs(c, r, p, safe, (cc, rr) => enemies.some((e) => Math.floor(e.x) === cc && Math.floor(e.y) === rr), 18)
  if (!path || Math.random() < 0.4) {
    const p2 = bfs(c, r, p, safe, (cc, rr) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => inb(cc + dx, rr + dy) && B.g[rr + dy][cc + dx] === 2), 40)
    if (p2) path = p2
  }
  p.path = path
}
function botStep(p, dt, danger) {
  p.think -= dt
  if (p.think <= 0) { p.think = DIFF[B.cfg.diff - 1].think * R(0.8, 1.2); botThink(p, danger) }
  let dx = 0, dy = 0
  const tc = Math.floor(p.x), tr = Math.floor(p.y)
  if (p.path && p.path.length) {
    let [nc, nr] = p.path[0]
    if (tc === nc && tr === nr && Math.abs(p.x - (nc + 0.5)) < 0.12 && Math.abs(p.y - (nr + 0.5)) < 0.12) { p.path.shift(); if (p.path.length) [nc, nr] = p.path[0]; else { nc = tc; nr = tr } }
    const tx = nc + 0.5, ty = nr + 0.5
    // align with the lane before walking the other axis
    const ox = tx - p.x, oy = ty - p.y
    if (Math.abs(ox) > 0.1 && Math.abs(oy) > 0.1) { if (Math.abs(p.y - (tr + 0.5)) > 0.15) dy = Math.sign(tr + 0.5 - p.y); else dx = Math.sign(ox) }
    else if (Math.abs(ox) > 0.06) dx = Math.sign(ox)
    else if (Math.abs(oy) > 0.06) dy = Math.sign(oy)
  }
  p.move = [dx, dy]
  if (dx || dy) { const sp = DIFF[B.cfg.diff - 1].speed; const old = p.speed; p.speed *= sp; moveAxis(p, dx, dy, dt); p.speed = old }
}

// ---------- main ----------
function endRound(winnerTeam) {
  B.phase = 'result'; B.resultT = 3
  const draw = winnerTeam < 0
  if (!draw) { for (const p of B.pl) if (p.team === winnerTeam) B.wins[p.id] = B.wins[p.id] + (MODES[B.cfg.type].teams ? 0 : 1); if (MODES[B.cfg.type].teams) { const first = B.pl.find((p) => p.team === winnerTeam); B.wins[first.id]++ } }
  const wp = B.pl.find((p) => p.team === winnerTeam)
  B.msg = draw ? { text: 'DRAW!', sub: 'NOBODY WINS THIS ROUND', color: '#ffffff' } : { text: MODES[B.cfg.type].teams ? (winnerTeam === 0 ? 'TEAM 1 WINS' : 'TEAM 2 WINS') : wp.name + ' WINS', sub: 'ROUND ' + B.round, color: PCOL[wp.id] }
  sfx(draw ? 'fault' : 'point'); if (!draw) speak(draw ? 'Draw' : B.msg.text.toLowerCase().replace('bot ', 'bot '), 0.6, 1.05)
  const need = Math.ceil(B.cfg.rounds / 2)
  const teams = MODES[B.cfg.type].teams
  const best = teams ? Math.max(teamWins(0), teamWins(1)) : Math.max(...B.wins.slice(0, B.pl.length))
  if (best >= need) B.finalNext = true
  else B.finalNext = false
}
const teamWins = (t) => B.pl.filter((p) => p.team === t).reduce((a, p) => a + B.wins[p.id], 0)
function finishMatch() {
  const teams = MODES[B.cfg.type].teams
  let winner
  if (teams) winner = teamWins(0) >= teamWins(1) ? 0 : 1
  else winner = B.pl.reduce((a, p) => (B.wins[p.id] > B.wins[a.id] ? p : a), B.pl[0]).team
  const hum = B.pl.filter((p) => p.human)
  B.over = { winner, names: teams ? ['TEAM 1', 'TEAM 2'] : null, winName: teams ? (winner === 0 ? 'TEAM 1' : 'TEAM 2') : B.pl.find((p) => p.team === winner).name, kills: B.kills.slice(0, B.pl.length), wins: B.wins.slice(0, B.pl.length), bricks: B.bricks }
  B.mode = 'over'; B.phase = 'over'; music.stop(); sfx('win')
  speak(`Match over. ${B.over.winName} wins!`)
  if (hum.length) {
    const mine = B.net ? hum.find((q) => q.human === B.net.me) || hum[0] : hum[0]
    const won = mine.team === winner
    profile.bomberGames = (profile.bomberGames || 0) + 1
    if (won) profile.bomberWins = (profile.bomberWins || 0) + 1
    const score = B.wins[mine.id] * 1000 + B.kills[mine.id] * 250 + B.bricks * 5 + (won ? 1500 : 0)
    B.over.score = score
    recordScore('bomber', score)
  }
  saveProfile()
}
function dropBomb(h) {
  if (B.net && B.net.role === 'guest' && h === B.net.me) { B.net.bomb(); return }
  const p = B.pl.find((q) => q.human === h)
  if (p) placeBomb(p)
}
function play(dt) {
  if (B.net && B.net.role === 'guest') { mirrorStep(dt); return }
  B.t += dt
  const danger = dangerMap()
  if (B.phase === 'ready') {
    B.readyT -= dt
    const n = Math.ceil(B.readyT)
    if (n !== B.lastCount && n >= 1 && n <= 3) { B.lastCount = n; sfx('beep'); }
    if (B.readyT <= 0) { B.phase = 'fight'; sfx('go'); speak(B.round === 1 ? 'Fight!' : 'Round ' + B.round + '. Fight!', 0.6, 1.1); B.msg = null }
  } else if (B.phase === 'fight') {
    B.elapsed += dt
    B.rainT = (B.rainT ?? 22) - dt
    if (B.rainT <= 0 && !B.sudden && B.elapsed > 10 && B.elapsed < 80) { B.rainT = R(24, 36); powerRain() }
    if (!B.sudden && B.elapsed > 90) { B.sudden = true; sfx('alarm'); speak('Sudden death!'); B.msg = { text: 'SUDDEN DEATH!', sub: 'THE ARENA IS CLOSING IN', color: '#ff3b4e', t: 2.5 } }
    if (B.sudden) {
      B.sT -= dt
      if (B.sT <= 0 && B.sIdx < B.spiral.length) {
        B.sT = 0.55
        const [c, r] = B.spiral[B.sIdx++]
        B.g[r][c] = 1
        B.bombs = B.bombs.filter((b) => !(b.c === c && b.r === r)); B.items = B.items.filter((it) => !(it.c === c && it.r === r))
        for (const p of B.pl) if (p.alive && Math.floor(p.x) === c && Math.floor(p.y) === r) { p.shield = 0; p.inv = 0; kill(p) }
        sfx('clank'); shake(0.6); part(wx(c) + 2, wy(r) - 2, 0, 0, 0.4, [1, 1, 1], 3)
      }
    }
  } else if (B.phase === 'result') {
    B.resultT -= dt
    if (B.resultT <= 0) {
      if (B.finalNext) finishMatch()
      else { B.round++; newRound(); emitB() }
    }
  }
  const canAct = B.phase === 'fight'
  for (const p of B.pl) {
    p.inv = Math.max(0, p.inv - dt); p.shield = Math.max(0, p.shield - dt)
    if (p.dying > 0) { p.dying -= dt; if (p.dying <= 0) p.alive = false; continue }
    if (!p.alive) continue
    p.anim += dt
    let dx = 0, dy = 0
    if (canAct) {
      if (p.human) {
        const [ix, iy] = humanInput(p.human)
        // one axis at a time (classic feel): prefer the most recently changed
        if (ix && iy) { if (p.lastAxis === 'x') dy = iy; else dx = ix } else { dx = ix; dy = iy }
        p.lastAxis = ix && !iy ? 'x' : iy && !ix ? 'y' : p.lastAxis
        p.move = [dx, dy]
        if (dx || dy) moveAxis(p, dx, dy, dt)
      } else botStep(p, dt, danger)
    }
    if (p.move && (p.move[0] || p.move[1])) p.face = [p.move[0], p.move[1]]
    // release bomb pass-through
    for (const b of B.bombs) if (b.pass.has(p.id)) { const c = Math.floor(p.x), r = Math.floor(p.y); if (!(p.x + RAD > b.c && p.x - RAD < b.c + 1 && p.y + RAD > b.r && p.y - RAD < b.r + 1)) b.pass.delete(p.id) }
    // pickups
    for (let i = B.items.length - 1; i >= 0; i--) {
      const it = B.items[i]
      if (!(it.drop > 0) && Math.floor(p.x) === it.c && Math.floor(p.y) === it.r) {
        B.items.splice(i, 1)
        if (it.kind === 'bomb') p.cap = Math.min(8, p.cap + 1); else if (it.kind === 'fire') p.range = Math.min(9, p.range + 1)
        else if (it.kind === 'speed') p.speed = Math.min(6.2, p.speed + 0.55); else if (it.kind === 'kick') p.kick = true; else if (it.kind === 'shield') { p.shield = 12 }
        sfx(it.kind === 'shield' ? 'shield' : 'pickup'); ring(wx(it.c) + 2, wy(it.r) - 2, 12, 20, COLS.green)
        if (p.human) popup(wx(it.c) + 2, wy(it.r) + 3, it.kind.toUpperCase(), [0.5, 1, 0.6])
      }
    }
  }
  for (const it of B.items) if (it.drop > 0) it.drop = Math.max(0, it.drop - dt * 2.2)
  // sliding (kicked) bombs
  for (const b of B.bombs) {
    b.t -= dt
    if (b.vx || b.vy) {
      const sp = 14 * dt / CELL * CELL / CELL
      const nfx = b.fx + b.vx * 9 * dt, nfy = b.fy + b.vy * 9 * dt
      const nc = Math.floor(nfx + b.vx * 0.5), nr = Math.floor(nfy + b.vy * 0.5)
      const bump = (nc !== b.c || nr !== b.r) && (blocked(nc, nr, null) || B.pl.some((q) => q.alive && Math.floor(q.x) === nc && Math.floor(q.y) === nr))
      if (bump) { b.vx = b.vy = 0; b.fx = b.c + 0.5; b.fy = b.r + 0.5 } else { b.fx = nfx; b.fy = nfy; b.c = Math.floor(b.fx); b.r = Math.floor(b.fy) }
    }
  }
  for (const b of B.bombs.slice()) if (b.t <= 0) explode(b)
  // flames
  for (const f of B.flames) {
    f.t -= dt
    for (const p of B.pl) if (p.alive && p.dying <= 0 && Math.floor(p.x) === f.c && Math.floor(p.y) === f.r && (f.team !== p.team || f.owner === p.id)) kill(p, f)
  }
  B.flames = B.flames.filter((f) => f.t > 0)
  // round end
  if (B.phase === 'fight') {
    const aliveT = new Set(B.pl.filter((p) => p.alive && p.dying <= 0).map((p) => p.team))
    const timeout = B.sudden && B.sIdx >= B.spiral.length
    if (aliveT.size <= 1 || timeout) {
      B.endT += dt
      if (B.endT > 1.1 || timeout) endRound(aliveT.size === 1 ? [...aliveT][0] : -1)
    } else B.endT = 0
  }
  if (B.msg && B.msg.t !== undefined) { B.msg.t -= dt; if (B.msg.t <= 0) B.msg = null }
  stepParticles(dt)
}
function update(dtRaw) {
  const dt = Math.min(dtRaw, 0.04)
  if (B.mode === 'idle') return
  if (B.mode === 'play' && !B.paused) play(dt)
  else if (B.mode === 'over') stepParticles(dt)
  if (B.net && B.mode !== 'idle') netTick(dt)
  B.emitT -= dt
  if (B.emitT <= 0) { B.emitT = 0.07; emitB() }
}
export const bomberActions = {
  start, stop, quit() { toMenu() }, resume() { B.paused = false; emitB() }, rematch() { if (B.net) { B.net.rematch(); return } start(B.cfg.type, B.cfg.diff, B.cfg.rounds) },
  pause() { if (B.mode === 'play' && !B.paused && !B.net) { B.paused = true; emitB(); return true } return false },
}

// ---------- online (host simulates; guests send inputs and mirror the state) ----------
let seq = 0, lastSeq = -1, nT = 0, iT = 0
function netTick(dt) {
  const n = B.net
  if (n.role === 'host') { nT -= dt; if (nT <= 0 && B.pl.length) { nT = 0.08; n.state(hostSnap()) } }
  else { iT -= dt; if (iT <= 0) { iT = 0.07; const i = humanInput(n.me); n.input({ ix: i[0], iy: i[1] }) } }
}
const q2 = (v) => Math.round(v * 100) / 100
function hostSnap() {
  return {
    n: ++seq, g: B.g.map((r) => r.join('')), ph: B.phase, rd: B.round, wins: B.wins, kills: B.kills, el: q2(B.elapsed), rt: q2(B.readyT), rs: q2(B.resultT), sud: B.sudden, msg: B.msg, over: B.over,
    pl: B.pl.map((p) => [q2(p.x), q2(p.y), p.alive ? 1 : 0, q2(p.dying), p.cap, p.range, q2(p.speed), p.kick ? 1 : 0, q2(p.shield), q2(p.inv), p.face, p.move, p.active]),
    bombs: B.bombs.map((b) => ({ c: b.c, r: b.r, o: b.owner, t: q2(b.t), fx: q2(b.fx), fy: q2(b.fy), vx: b.vx, vy: b.vy, range: b.range })),
    flames: B.flames.map((f) => ({ c: f.c, r: f.r, t: q2(f.t), owner: f.owner, team: f.team })),
    items: B.items.map((it) => ({ c: it.c, r: it.r, glyph: it.glyph, kind: it.kind, drop: q2(it.drop || 0) })),
  }
}
function mirrorStep(dt) {
  B.t += dt
  if (B.phase === 'ready') B.readyT -= dt
  if (B.phase === 'fight') B.elapsed += dt
  for (const b of B.bombs) b.t -= dt
  for (const f of B.flames) f.t -= dt
  for (const it of B.items) if (it.drop > 0) it.drop = Math.max(0, it.drop - dt * 2.2)
  for (const p of B.pl) {
    p.inv = Math.max(0, p.inv - dt); p.shield = Math.max(0, p.shield - dt); p.anim += dt
    if (p.dying > 0) p.dying = Math.max(0.01, p.dying - dt)
    if (p.human === B.net.me && p.alive && !(p.dying > 0) && B.phase === 'fight') {
      const [ix, iy] = humanInput(p.human)
      let dx = 0, dy = 0
      if (ix && iy) { if (p.lastAxis === 'x') dy = iy; else dx = ix } else { dx = ix; dy = iy }
      p.lastAxis = ix && !iy ? 'x' : iy && !ix ? 'y' : p.lastAxis
      p.move = [dx, dy]
      if (dx || dy) moveAxis(p, dx, dy, dt)
    } else if (p.tx !== undefined) { p.x += (p.tx - p.x) * Math.min(1, dt * 14); p.y += (p.ty - p.y) * Math.min(1, dt * 14) }
    if (p.move && (p.move[0] || p.move[1])) p.face = [p.move[0], p.move[1]]
  }
  B.flames = B.flames.filter((f) => f.t > 0)
  if (B.msg && B.msg.t !== undefined) { B.msg.t -= dt; if (B.msg.t <= 0) B.msg = null }
  stepParticles(dt)
}
export const bomberNet = {
  attach(net) { B.net = net; B.netIn = {} },
  active: () => !!B.net && B.mode !== 'idle',
  reset() { seq = 0; lastSeq = -1; nT = 0; iT = 0 },
  applyInput(h, d) { if (B.net && B.net.role === 'host' && d) B.netIn[h] = [Math.max(-1, Math.min(1, d.ix | 0)), Math.max(-1, Math.min(1, d.iy | 0))] },
  applyBomb(h) { if (B.net && B.net.role === 'host') { const p = B.pl.find((q) => q.human === h); if (p) placeBomb(p) } },
  playerLeft(h) { const p = B.pl.find((q) => q.human === h); if (p) { p.human = 0; p.name = 'BOT ' + (p.id + 1); if (B.netIn) delete B.netIn[h] } },
  applyState(d) {
    if (!B.net || B.net.role !== 'guest' || !d || !d.pl || d.n <= lastSeq || B.mode === 'idle') return
    lastSeq = d.n
    const prevBombs = B.bombs.length, prevItems = B.items.length, prevPhase = B.phase
    B.g = d.g.map((r) => r.split('').map(Number))
    d.pl.forEach((a, i) => {
      const p = B.pl[i]; if (!p) return
      const wasAlive = p.alive && !(p.dying > 0)
      p.tx = a[0]; p.ty = a[1]; p.alive = !!a[2]; p.dying = a[3]; p.cap = a[4]; p.range = a[5]; p.speed = a[6]; p.kick = !!a[7]; p.shield = a[8]; p.inv = a[9]; p.active = a[12]
      if (p.human === B.net.me) { if (Math.hypot(p.tx - p.x, p.ty - p.y) > 1.1 || d.ph !== 'fight') { p.x = p.tx; p.y = p.ty } else { p.x += (p.tx - p.x) * 0.2; p.y += (p.ty - p.y) * 0.2 } }
      else { p.face = a[10]; p.move = a[11]; if (d.ph !== 'fight' || Math.hypot(p.tx - p.x, p.ty - p.y) > 3) { p.x = p.tx; p.y = p.ty } }
      if (wasAlive && p.dying > 0) { sfx('die'); shake(1.2) }
    })
    B.bombs = d.bombs.map((b) => ({ c: b.c, r: b.r, owner: b.o, t: b.t, fx: b.fx, fy: b.fy, vx: b.vx, vy: b.vy, range: b.range, pass: new Set(B.pl.filter((q) => q.alive && Math.floor(q.x) === b.c && Math.floor(q.y) === b.r).map((q) => q.id)) }))
    B.flames = d.flames
    B.items = d.items
    if (B.bombs.length > prevBombs) sfx('bombPlace')
    if (d.flames.length && !B.hadFlames) { sfx('bombBoom'); shake(1) }
    B.hadFlames = d.flames.length > 0
    if (B.items.length < prevItems) sfx('pickup')
    B.round = d.rd; B.wins = d.wins; B.kills = d.kills; B.elapsed = d.el; B.readyT = d.rt; B.resultT = d.rs; B.sudden = d.sud; B.msg = d.msg
    if (d.ph !== prevPhase) { B.phase = d.ph; if (d.ph === 'fight') sfx('go'); else if (d.ph === 'result') sfx('point') }
    if (d.over && !B.over) {
      B.over = d.over; B.mode = 'over'; B.phase = 'over'; music.stop(); sfx('win')
      const mine = B.pl.find((q) => q.human === B.net.me)
      if (mine) {
        const won = mine.team === d.over.winner
        profile.bomberGames = (profile.bomberGames || 0) + 1
        if (won) profile.bomberWins = (profile.bomberWins || 0) + 1
        const score = (d.over.wins[mine.id] || 0) * 1000 + (d.over.kills[mine.id] || 0) * 250 + (d.over.bricks || 0) * 5 + (won ? 1500 : 0)
        B.over = { ...d.over, score }
        recordScore('bomber', score)
        saveProfile()
      }
    }
    emitB()
  },
  matchAbort() { if (B.net && B.mode === 'play') { const me = B.pl.find((q) => q.human === B.net.me); B.over = { winner: me ? me.team : 0, names: null, winName: 'YOU', kills: B.kills.slice(0, B.pl.length), wins: B.wins.slice(0, B.pl.length), bricks: 0, score: 0 }; B.mode = 'over'; B.phase = 'over'; music.stop(); emitB() } },
}

// ---------- rendering ----------
const cc = {}
const lc = (hex) => cc[hex] || (cc[hex] = rgb(hex))
function draw(api) {
  const { put, sprite } = api
  const round = api.putBall || put
  const t = G.time
  // floor
  for (let r = 0; r < ROWS_N; r++) for (let c = 0; c < COLS_N; c++) {
    const v = B.g[r] ? B.g[r][c] : 1
    const x = wx(c) + 2, y = wy(r) - 2
    if (v === 1) {
      const edge = r === 0 || c === 0 || r === ROWS_N - 1 || c === COLS_N - 1
      const base = edge ? [0.2, 0.23, 0.38] : [0.3, 0.34, 0.5]
      for (const [dx, dy] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) put(x + dx, y + dy, 0.5, 2.02, 2.02, base[0], base[1], base[2])
      put(x, y, 1.8, 3, 3, base[0] * 1.25, base[1] * 1.25, base[2] * 1.25)
      put(x - 0.7, y + 0.7, 2.6, 1.2, 1.2, base[0] * 1.9, base[1] * 1.9, base[2] * 1.9)
    } else {
      const chk = (r + c) % 2 === 0
      const fl = chk ? [0.1, 0.38, 0.2] : [0.13, 0.46, 0.25]
      for (const [dx, dy] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) put(x + dx, y + dy, -1.2, 2.02, 2.02, fl[0], fl[1], fl[2])
      if (v === 2) {
        const alt = (r * 3 + c) % 2 === 0
        const br = alt ? [0.8, 0.36, 0.16] : [0.66, 0.28, 0.12]
        for (const [dx, dy] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) put(x + dx, y + dy, 0.8, 2.02, 2.02, br[0], br[1], br[2])
        put(x, y, 1.9, 3.4, 3.4, br[0] * 1.15, br[1] * 1.15, br[2] * 1.15)
        put(x, y + 0.2, 2.6, 3.4, 0.35, 0.3, 0.14, 0.06); put(x, y - 1.2, 2.6, 3.4, 0.35, 0.3, 0.14, 0.06); put(x + (alt ? 0.8 : -0.8), y + 1.2, 2.6, 0.35, 1.2, 0.3, 0.14, 0.06)
      }
    }
  }
  // sudden death preview
  if (B.sudden && B.sIdx < B.spiral.length) { const [c, r] = B.spiral[B.sIdx]; const k = 1 + Math.sin(t * 14) * 0.5; put(wx(c) + 2, wy(r) - 2, 3, 3.8, 3.8, 2.2 * k, 0.2, 0.2) }
  // items
  for (const it of B.items) sprite(SP['pup' + it.glyph], wx(it.c) + 2, wy(it.r) - 2 + Math.sin(t * 5 + it.c) * 0.4 + (it.drop || 0) * 14, { scale: 0.52, k: 1.6 })
  // bombs
  for (const b of B.bombs) {
    const x = wx(b.fx !== undefined ? b.fx : b.c + 0.5), y = wy(b.fy !== undefined ? b.fy : b.r + 0.5)
    const pulse = 1 + Math.sin(t * (b.t < 0.8 ? 30 : 9)) * 0.12
    const hot = b.t < 0.7 && Math.floor(t * 14) % 2 === 0
    const k = hot ? 2.2 : 0.2
    for (const [dx, dy, s] of [[0, 0, 3.2], [0, 0.5, 2.6]]) round(x + dx, y + dy, 1.6, s * pulse, s * pulse, k, hot ? 0.3 : 0.2, hot ? 0.3 : 0.28)
    put(x - 0.7, y + 0.8, 2.6, 0.9, 0.9, 1.6, 1.6, 1.8)
    put(x + 0.9, y + 2.1, 2.4, 0.7, 1.1, 0.5, 0.35, 0.2)
    if (Math.floor(t * 18) % 2 === 0) put(x + 1.3, y + 2.8, 3, 1.1, 1.1, 3, 2.2, 0.4)
  }
  // flames
  for (const f of B.flames) {
    const x = wx(f.c) + 2, y = wy(f.r) - 2, a = Math.min(1, f.t * 3)
    const fl = 0.8 + Math.random() * 0.5
    put(x, y, 2.2, 4.0, 4.0, 2.6 * a * fl, 0.8 * a * fl, 0.15 * a)
    put(x, y, 3.0, 2.8, 2.8, 3 * a, 2.2 * a * fl, 0.6 * a)
    put(x, y, 3.6, 1.4, 1.4, 3 * a, 3 * a, 2.4 * a)
  }
  // players
  const order = B.pl.slice().sort((a, b) => b.y - a.y)
  for (const p of order) {
    if (!p.alive) continue
    const col = lc(PCOL[p.id]), x = wx(p.x), y = wy(p.y)
    const dy = p.dying > 0 ? 1 - p.dying / 0.9 : 0
    const sc = p.dying > 0 ? Math.max(0.1, 1 - dy) : 1
    if (p.inv > 0 && p.dying <= 0 && Math.floor(t * 16) % 2 === 0) continue
    const bob = p.move && (p.move[0] || p.move[1]) ? Math.sin(p.anim * 16) * 0.45 : 0
    put(x, y - 1.7, -0.5, 3.4 * sc, 1.4 * sc, 0.02, 0.03, 0.05)
    const lg = p.move && (p.move[0] || p.move[1]) ? Math.sin(p.anim * 16) * 0.8 : 0
    put(x - 0.9, y - 1.2 + lg * 0.4, 1, 1.1 * sc, 1.4 * sc, 0.1, 0.1, 0.14); put(x + 0.9, y - 1.2 - lg * 0.4, 1, 1.1 * sc, 1.4 * sc, 0.1, 0.1, 0.14)
    put(x, y - 0.1 + bob, 1.8, 3.2 * sc, 2.4 * sc, col[0] * 1.4, col[1] * 1.4, col[2] * 1.4)
    round(x, y + 1.6 + bob, 2.7, 3.6 * sc, 3.2 * sc, col[0] * 1.4, col[1] * 1.4, col[2] * 1.4)
    animePortrait(api,x,y+1.55+bob,3,2.45*sc,{helmet:true,iris:col})
    for (const side of [-1, 1]) {
      round(x + side * 1.8 * sc, y - 0.1 + bob - side * lg * 0.3, 2.0, 1.1 * sc, 1.4 * sc, col[0], col[1], col[2])
      round(x + side * 2 * sc, y - 0.7 + bob - side * lg * 0.3, 2.2, 1.1 * sc, 1.1 * sc, 1.7, 1.7, 1.8)
    }
    round(x, y + 3.5 + bob, 3, 1.2 * sc, 1.2 * sc, col[0] * 2, col[1] * 2, col[2] * 2)
    put(x, y + 2.8 + bob, 3, 0.4 * sc, 0.9 * sc, 1, 1, 1)
    if (p.shield > 0 && (p.shield > 2 || Math.floor(t * 12) % 2 === 0)) for (let i = 0; i < 20; i++) { const a = (i / 20) * 6.28 + t * 3; put(x + Math.cos(a) * 3, y + 0.7 + Math.sin(a) * 3, 3, 0.7, 0.7, 0.4, 2.4, 2.4) }
    if (p.human) for (const q of api.text(String(p.human))) put(x + q.x * 0.7, y + 6 + q.y * 0.7, 4, 0.6, 0.6, col[0] * 2.4, col[1] * 2.4, col[2] * 2.4)
  }
  for (const q of G.parts) { const f = q.life / q.max; put(q.x, q.y, 4, q.s * (0.35 + 0.65 * f) * 0.9, q.s * (0.35 + 0.65 * f) * 0.9, q.c[0] * 1.6, q.c[1] * 1.6, q.c[2] * 1.6) }
  api.pops(G.pops, 0)
}
if (typeof window !== 'undefined') { window.__B = B; window.__bomber = bomberActions }
games.bomber = { update, onKey, draw, stop, sky: () => '#08101c' }
