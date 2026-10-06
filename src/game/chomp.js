// Maze Chomp: a Pac-Man-style maze chase. Procedural symmetric mazes, 4 ghosts with classic personalities,
// scatter/chase/frightened modes, power pellets, fruit, tunnel, co-op and "play as a ghost" modes. Pure JS.
import { G, keys, games, profile, saveProfile, recordScore, part, ring, shake, flash, popup, COLS, stepParticles, toMenu } from './engine.js'
import { rgb } from './sprites.js'
import { sfx, music, speak } from './audio.js'

const MW = 23, MH = 23, CS = 2.1, OY = -3
const R = (a, b) => a + Math.random() * (b - a)
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
const rng = (seed) => { let s = seed >>> 0; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296 }
const DIRS = [[0, -1], [-1, 0], [0, 1], [1, 0]] // up, left, down, right (classic tie-break order)
const TUN = 7
const HOUSE = [11, 11], DOOR = [11, 10], EXIT = [11, 9]
export const MODES = {
  classic: { name: 'CLASSIC', desc: 'Eat every dot. Dodge the ghosts. 3 lives.', pacs: 1, humans: [1] },
  coop:    { name: '2P CO-OP', desc: 'Two chompers share one maze and 3 lives.', pacs: 2, humans: [1, 2] },
  ghost:   { name: 'PAC vs GHOST', desc: 'P1 is the chomper, P2 drives the red ghost.', pacs: 1, humans: [1], ghost: true },
  auto:    { name: 'AUTO DEMO', desc: 'Watch a bot chomp through the maze.', pacs: 1, humans: [] },
}
const GCOL = ['#ff3b4e', '#ff9ad0', '#3de8ff', '#ff9a2e']
const GNAME = ['BLINKY', 'PINKY', 'INKY', 'CLYDE']
const FRUITS = [['CHERRY', 100, '#ff3b4e'], ['STRAWBERRY', 300, '#ff6a8a'], ['ORANGE', 500, '#ff9a2e'], ['APPLE', 700, '#7dff5a'], ['MELON', 1000, '#3dff7a'], ['GALAXIAN', 2000, '#ffe84a'], ['BELL', 3000, '#ffd84a'], ['KEY', 5000, '#3de8ff']]

// ---------- maze generation ----------
function genMaze(seed) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const rnd = rng(seed + attempt * 977)
    const g = Array.from({ length: MH }, () => Array(MW).fill(1))
    const house = Array.from({ length: MH }, () => Array(MW).fill(false))
    const isHouseNode = (x, y) => y === 11 && [9, 11, 13].includes(x)
    const seen = new Set(), stack = [[1, 1]]
    seen.add('1,1'); g[1][1] = 0
    while (stack.length) {
      const [x, y] = stack[stack.length - 1]
      const opts = DIRS.map(([dx, dy]) => [x + dx * 2, y + dy * 2, dx, dy]).filter(([nx, ny]) => nx >= 1 && nx <= 11 && ny >= 1 && ny <= 21 && !isHouseNode(nx, ny) && !seen.has(nx + ',' + ny))
      if (!opts.length) { stack.pop(); continue }
      const [nx, ny, dx, dy] = opts[Math.floor(rnd() * opts.length)]
      g[y + dy][x + dx] = 0; g[ny][nx] = 0; seen.add(nx + ',' + ny); stack.push([nx, ny])
    }
    const mirror = () => { for (let y = 0; y < MH; y++) for (let x = 0; x <= 11; x++) g[y][MW - 1 - x] = g[y][x] }
    // loops: open extra walls between existing nodes
    for (let y = 1; y <= 21; y++) for (let x = 1; x <= 11; x++) {
      const edge = (x % 2 === 1 && y % 2 === 0) || (x % 2 === 0 && y % 2 === 1)
      if (!edge || g[y][x] === 0) continue
      const a = x % 2 === 1 ? [x, y - 1] : [x - 1, y], b = x % 2 === 1 ? [x, y + 1] : [x + 1, y]
      if (a[0] < 1 || b[0] > 11 + (x % 2 === 0 ? 0 : 0) || b[1] > 21 || a[1] < 1) continue
      if (isHouseNode(a[0], a[1]) || isHouseNode(b[0], b[1]) || b[0] > 11) continue
      if (rnd() < 0.3) g[y][x] = 0
    }
    mirror()
    // house
    for (let y = 10; y <= 12; y++) for (let x = 8; x <= 14; x++) g[y][x] = 1
    for (let x = 9; x <= 13; x++) { g[11][x] = 0; house[11][x] = true }
    g[10][11] = 0; house[10][11] = true
    // tunnel on row 7
    for (const x of [0, 1, 2, 20, 21, 22]) g[TUN][x] = 0
    // remove dead ends (twice)
    const open = (x, y) => x >= 0 && x < MW && y >= 0 && y < MH && g[y][x] === 0 && !house[y][x]
    for (let pass = 0; pass < 2; pass++) {
      for (let y = 1; y < MH - 1; y++) for (let x = 1; x <= 11; x++) {
        if (!open(x, y)) continue
        const n = DIRS.filter(([dx, dy]) => open(x + dx, y + dy)).length
        if (n !== 1) continue
        const cands = DIRS.filter(([dx, dy]) => !open(x + dx, y + dy) && open(x + dx * 2, y + dy * 2) && x + dx > 0 && x + dx < MW - 1 && y + dy > 0 && y + dy < MH - 1 && !house[y + dy][x + dx] && !(y + dy >= 10 && y + dy <= 12 && x + dx >= 8 && x + dx <= 14))
        if (cands.length) { const [dx, dy] = cands[Math.floor(rnd() * cands.length)]; g[y + dy][x + dx] = 0; g[y + dy][MW - 1 - (x + dx)] = 0 }
      }
    }
    // connectivity check from pac start
    const start = [11, 17]
    if (g[start[1]][start[0]] !== 0) continue
    const vis = new Set([start.join(',')]), q = [start]
    for (let i = 0; i < q.length; i++) { const [x, y] = q[i]; for (const [dx, dy] of DIRS) { let nx = x + dx, ny = y + dy; if (nx < 0) nx = MW - 1; if (nx >= MW) nx = 0; if (ny < 0 || ny >= MH || g[ny][nx] !== 0 || house[ny][nx] || vis.has(nx + ',' + ny)) continue; vis.add(nx + ',' + ny); q.push([nx, ny]) } }
    let total = 0
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (g[y][x] === 0 && !house[y][x]) total++
    if (vis.size !== total) continue
    return { g, house }
  }
  throw new Error('maze generation failed')
}

// ---------- state ----------
export const C = {
  mode: 'idle', paused: false, phase: 'ready', cfg: { type: 'classic', level: 1 }, g: [], house: [], dots: [], pacs: [], ghosts: [], score: 0, hi: 0, lives: 3, level: 1, dotsLeft: 0, dotsTotal: 0, eaten: 0,
  t: 0, readyT: 0, modeT: 0, modeIdx: 0, chase: false, fright: 0, chain: 0, fruit: null, fruitCount: 0, over: null, emitT: 0, msg: null, deadT: 0, clearT: 0, wakaAlt: 0, sirenT: 0, nextLife: 10000, stats: { ghosts: 0, dots: 0, fruits: 0 }, lvlT: 0, ghostScore: 0,
}
let snap = null
const subs = new Set()
export const subscribeChomp = (f) => { subs.add(f); return () => subs.delete(f) }
export const getChompSnap = () => snap
function emitC() {
  snap = {
    mode: C.mode, paused: C.paused, phase: C.phase, type: C.cfg.type, modeName: MODES[C.cfg.type].name, score: C.score, hi: Math.max(profile.chompHi || 0, C.score), lives: C.lives, level: C.level,
    dots: C.dotsTotal - C.dotsLeft, dotsTotal: C.dotsTotal, fright: C.fright > 0, msg: C.msg, over: C.over, ghostMode: !!MODES[C.cfg.type].ghost, ghostScore: C.ghostScore,
    fruit: FRUITS[Math.min(C.level - 1, 7)], countdown: C.phase === 'ready' ? Math.ceil(C.readyT) : 0,
  }
  subs.forEach((f) => f())
}

const tilePos = (c, r) => [(c - (MW - 1) / 2) * CS, OY + ((MH - 1) / 2 - r) * CS]
const wrapX = (x) => (x < 0 ? MW - 1 : x >= MW ? 0 : x)
function walk(c, r, forGhost) {
  if (r < 0 || r >= MH) return false
  if (c < 0 || c >= MW) return r === TUN
  if (C.g[r][c] !== 0) return false
  if (C.house[r][c]) return false
  return true
}
function newEnt(c, r, dir) { return { cx: c, cy: r, tx: c, ty: r, t: 0, dir: dir || [0, 0], want: dir || [0, 0] } }
function ePos(e) { const x = e.cx + (e.tx - e.cx) * e.t, y = e.cy + (e.ty - e.cy) * e.t; return [x, y] }

function start(type = 'classic', level = 1) {
  C.cfg = { type, level }
  const m = MODES[type]
  C.score = 0; C.lives = 3; C.level = level; C.nextLife = 10000; C.over = null; C.stats = { ghosts: 0, dots: 0, fruits: 0 }; C.ghostScore = 0
  G.mode = 'chomp'; G.parts = []; G.pops = []; G.shake = 0; G.flash = 0
  C.mode = 'play'; C.paused = false
  loadLevel(level)
  music.set('menu'); music.stop()
  sfx('pIntro'); emitC()
}
function loadLevel(level) {
  const { g, house } = genMaze(1337 + level * 7919)
  C.g = g; C.house = house; C.level = level
  C.dots = Array.from({ length: MH }, () => Array(MW).fill(0))
  let n = 0
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (g[y][x] === 0 && !house[y][x] && !(x === 0 || x === MW - 1) && !(x === 11 && y === 17) && !(x === 11 && y === 9)) { C.dots[y][x] = 1; n++ }
  for (const [x, y] of [[1, 1], [21, 1], [1, 21], [21, 21]]) if (C.dots[y][x]) C.dots[y][x] = 2
  C.dotsTotal = n; C.dotsLeft = n; C.fruit = null; C.fruitCount = 0
  resetActors(true)
}
function resetActors(full) {
  const m = MODES[C.cfg.type]
  C.pacs = []
  for (let i = 0; i < m.pacs; i++) {
    const e = newEnt(m.pacs === 2 ? (i ? 12 : 10) : 11, 17, [i ? 1 : -1, 0])
    Object.assign(e, { id: i, human: m.humans[i] || 0, alive: true, mouth: 0, deadT: 0, face: [i ? 1 : -1, 0], auto: m.humans.length === 0, onArrive: eatAt })
    C.pacs.push(e)
  }
  const starts = [[11, 9, 'out'], [10, 11, 'house'], [11, 11, 'house'], [12, 11, 'house']]
  C.ghosts = starts.map(([c, r, st], i) => {
    const e = newEnt(c, r, [i % 2 ? 1 : -1, 0])
    return Object.assign(e, { id: i, state: st === 'out' ? 'normal' : 'house', release: [0, 2.5, 6, 10][i] / (1 + (C.level - 1) * 0.12), bob: Math.random() * 6, human: m.ghost && i === 0 ? 2 : 0, px: c, py: r, eyes: [0, 0], flash: 0 })
  })
  C.chase = false; C.modeT = 0; C.modeIdx = 0; C.fright = 0; C.chain = 0; C.phase = 'ready'; C.readyT = full ? 2.8 : 2; C.msg = null; C.t = 0; C.sirenT = 0
}
function stop() { C.mode = 'idle'; C.paused = false; music.set('menu'); emitC() }

// ---------- speeds & helpers ----------
const lvlMul = () => 1 + Math.min(C.level - 1, 12) * 0.04
const PAC_SPD = 7.2
function ghostSpeed(g) {
  const base = 6.5 * lvlMul()
  if (g.state === 'eaten') return 16
  if (g.state === 'frightened') return 3.8
  const [x, y] = ePos(g)
  if (Math.round(y) === TUN && (x < 3 || x > MW - 4)) return base * 0.55
  return base * (g.id === 0 ? 1.02 : 1)
}
const frightTime = () => [7, 6, 5, 4, 3, 2.2, 1.5, 1, 0.5][Math.min(C.level - 1, 8)]
const SCHEDULE = [7, 20, 7, 20, 5, 20, 5, 1e9]
const dist2 = (a, b, c, d) => (a - c) * (a - c) + (b - d) * (b - d)
const nearestPac = (x, y) => C.pacs.filter((p) => p.alive).reduce((a, p) => { const [px, py] = ePos(p); const d = dist2(px, py, x, y); return !a || d < a.d ? { p, d } : a }, null)

// ---------- movement ----------
function stepEnt(e, dt, speed, decide) {
  let dist = speed * dt
  let guard = 8
  while (dist > 0 && guard-- > 0) {
    if (e.t === 0 && e.cx === e.tx && e.cy === e.ty) {
      decide(e)
      if (e.tx === e.cx && e.ty === e.cy) return
    }
    const remain = 1 - e.t
    if (dist < remain) { e.t += dist; return }
    dist -= remain
    e.cx = wrapX(e.tx); e.cy = e.ty; e.tx = e.cx; e.ty = e.cy; e.t = 0
    if (e.onArrive) e.onArrive(e)
  }
}
function setNext(e, dir) { e.dir = dir; e.tx = e.cx + dir[0]; e.ty = e.cy + dir[1]; e.t = 0; if (e.tx < 0) { e.tx = -1 } if (e.tx >= MW) { e.tx = MW } }
function pacDecide(e) {
  const w = e.want
  if (w && (w[0] || w[1]) && walk(e.cx + w[0], e.cy + w[1])) { setNext(e, w); e.face = w; return }
  if ((e.dir[0] || e.dir[1]) && walk(e.cx + e.dir[0], e.cy + e.dir[1])) { setNext(e, e.dir); return }
  e.dir = [0, 0]
}
function reverseNow(e) {
  // allow an instant U-turn while between tiles
  if (e.t > 0 && (e.cx !== e.tx || e.cy !== e.ty)) {
    const [c, r, tx, ty] = [e.cx, e.cy, e.tx, e.ty]
    e.cx = wrapX(tx); e.cy = ty; e.tx = c; e.ty = r; e.t = 1 - e.t
    e.dir = [-e.dir[0], -e.dir[1]]
  }
}
function pacInput(p) {
  const two = C.pacs.length > 1 || MODES[C.cfg.type].ghost
  const k = p.human === 1 ? (two ? ['KeyW', 'KeyS', 'KeyA', 'KeyD'] : ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) : ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']
  const has = (...c) => c.some((x) => k.includes(x) && keys[x])
  if (has('KeyW', 'ArrowUp')) return [0, -1]
  if (has('KeyS', 'ArrowDown')) return [0, 1]
  if (has('KeyA', 'ArrowLeft')) return [-1, 0]
  if (has('KeyD', 'ArrowRight')) return [1, 0]
  return null
}
function bfsDir(sx, sy, goal, avoid) {
  const q = [[sx, sy, null]], seen = new Set([sx + ',' + sy])
  for (let i = 0; i < q.length && i < 700; i++) {
    const [x, y, first] = q[i]
    if ((x !== sx || y !== sy) && goal(x, y)) return first
    for (const d of DIRS) {
      const nx = wrapX(x + d[0]), ny = y + d[1]
      if (!walk(x + d[0], ny) || seen.has(nx + ',' + ny) || (avoid && avoid(nx, ny))) continue
      seen.add(nx + ',' + ny); q.push([nx, ny, first || d])
    }
  }
  return null
}
function autoPac(p) {
  // bot pacman: head for dots/fruit/frightened ghosts, avoid nearby normal ghosts
  const danger = C.ghosts.filter((g) => g.state === 'normal').map((g) => ePos(g).map(Math.round))
  const near = (x, y) => danger.some(([gx, gy]) => Math.abs(gx - x) + Math.abs(gy - y) <= 2)
  const fr = C.ghosts.filter((g) => g.state === 'frightened').map((g) => ePos(g).map(Math.round))
  let d = null
  if (C.fright > 2 && fr.length) d = bfsDir(p.cx, p.cy, (x, y) => fr.some(([gx, gy]) => gx === x && gy === y), near)
  if (!d) d = bfsDir(p.cx, p.cy, (x, y) => C.dots[y][x] > 0 || (C.fruit && C.fruit.c === x && C.fruit.r === y), near)
  if (!d) d = bfsDir(p.cx, p.cy, (x, y) => C.dots[y][x] > 0, null)
  if (d && danger.length) { const nx = wrapX(p.cx + d[0]), ny = p.cy + d[1]; if (near(nx, ny)) { const alt = DIRS.filter(([ax, ay]) => walk(p.cx + ax, p.cy + ay) && !near(wrapX(p.cx + ax), p.cy + ay)); if (alt.length) d = alt[0] } }
  return d
}
function ghostTarget(g) {
  const near = nearestPac(...ePos(g))
  const pac = near ? near.p : C.pacs[0]
  const [px, py] = ePos(pac).map(Math.round)
  const pd = pac.dir && (pac.dir[0] || pac.dir[1]) ? pac.dir : pac.face || [-1, 0]
  const scatter = [[MW - 1, 0], [0, 0], [MW - 1, MH - 1], [0, MH - 1]][g.id]
  if (!C.chase) return scatter
  if (g.id === 0) return [px, py]
  if (g.id === 1) return [px + pd[0] * 4, py + pd[1] * 4]
  if (g.id === 2) { const b = ePos(C.ghosts[0]).map(Math.round); return [2 * (px + pd[0] * 2) - b[0], 2 * (py + pd[1] * 2) - b[1]] }
  const [gx, gy] = ePos(g)
  return dist2(gx, gy, px, py) > 64 ? [px, py] : scatter
}
function ghostDecide(g) {
  if (g.human && g.state !== 'eaten') {
    const k = inputGhost()
    const w = k || g.want
    if (w && (w[0] || w[1]) && walk(g.cx + w[0], g.cy + w[1]) && !(w[0] === -g.dir[0] && w[1] === -g.dir[1] && (g.dir[0] || g.dir[1]))) { g.want = w; setNext(g, w); return }
    if ((g.dir[0] || g.dir[1]) && walk(g.cx + g.dir[0], g.cy + g.dir[1])) { setNext(g, g.dir); return }
    const opts = DIRS.filter(([dx, dy]) => walk(g.cx + dx, g.cy + dy)); if (opts.length) setNext(g, opts[0]); return
  }
  if (g.state === 'eaten') {
    if (g.cx === EXIT[0] && g.cy === EXIT[1]) { g.state = 'entering'; g.px = 11; g.py = 9; g.tx = g.cx; g.ty = g.cy; return }
    const d = bfsDir(g.cx, g.cy, (x, y) => x === EXIT[0] && y === EXIT[1], null)
    if (d) setNext(g, d); return
  }
  const opts = DIRS.filter(([dx, dy]) => walk(g.cx + dx, g.cy + dy) && !(dx === -g.dir[0] && dy === -g.dir[1]))
  const all = opts.length ? opts : DIRS.filter(([dx, dy]) => walk(g.cx + dx, g.cy + dy))
  if (!all.length) return
  if (g.state === 'frightened') { setNext(g, all[Math.floor(Math.random() * all.length)]); return }
  const [tx, ty] = ghostTarget(g)
  let best = all[0], bd = 1e9
  for (const d of all) { const dd = dist2(g.cx + d[0], g.cy + d[1], tx, ty); if (dd < bd) { bd = dd; best = d } }
  setNext(g, best)
}
function inputGhost() {
  if (keys.ArrowUp) return [0, -1]; if (keys.ArrowDown) return [0, 1]; if (keys.ArrowLeft) return [-1, 0]; if (keys.ArrowRight) return [1, 0]
  return null
}

// ---------- rules ----------
function addScore(n, x, y, show = true) {
  C.score += n
  if (show && x !== undefined) popup(x, y + 2, String(n), [1, 1, 0.5])
  if (C.score >= C.nextLife) { C.nextLife += 10000; C.lives = Math.min(6, C.lives + 1); sfx('life'); speak('Extra life!', 0.8, 1.2); C.msg = { text: '1UP!', t: 1.2 } }
}
function eatAt(p) {
  const c = p.cx, r = p.cy
  const v = C.dots[r] ? C.dots[r][c] : 0
  if (v) {
    C.dots[r][c] = 0; C.dotsLeft--; C.stats.dots++; profile.chompDots = (profile.chompDots || 0) + 1
    const [x, y] = tilePos(c, r)
    if (v === 2) {
      addScore(50, x, y); sfx('pPower'); ring(x, y, 20, 30, COLS.fire); shake(0.4)
      C.fright = frightTime(); C.chain = 0
      for (const g of C.ghosts) if (g.state === 'normal') { g.state = 'frightened'; g.flash = 0; reverseNow(g); if (g.dir[0] || g.dir[1]) { g.dir = [-g.dir[0], -g.dir[1]] } }
      if (C.fright <= 0) for (const g of C.ghosts) if (g.state === 'frightened') g.state = 'normal'
    } else { addScore(10, x, y, false); C.wakaAlt ^= 1; sfx('waka', C.wakaAlt); part(x, y, R(-6, 6), R(-6, 6), 0.25, [1, 0.9, 0.4], 0.6) }
    const eaten = C.dotsTotal - C.dotsLeft
    if (!C.fruit && (eaten === 70 || eaten === 170) && C.fruitCount < 2) { C.fruitCount++; const gold = Math.random() < 0.2; C.fruit = { c: 11, r: 13, t: gold ? 12 : 10, gold }; sfx('pFruitSpawn'); if (gold) { C.msg = { text: 'GOLDEN FRUIT!' }; C.msgT = 1.8; sfx('event'); speak('Golden fruit!', 0.8, 1.15) } }
    if (C.dotsLeft <= 0) levelClear()
  }
  if (C.fruit && C.fruit.c === c && C.fruit.r === r) {
    const f = FRUITS[Math.min(C.level - 1, 7)]
    const [x, y] = tilePos(c, r)
    const gold = C.fruit.gold
    addScore(gold ? 5000 : f[1], x, y); if (gold) { sfx('jackpot'); ring(x, y, 36, 60, COLS.fire); shake(0.8); flash(0.3, [1, 0.9, 0.4]) }; sfx('pFruit'); C.fruit = null; C.stats.fruits++; ring(x, y, 16, 30, COLS.green)
  }
}
function levelClear() {
  C.phase = 'clear'; C.clearT = 2.2; sfx('pClear'); flash(0.4, [0.6, 0.8, 1])
  speak('Level complete', 0.7, 1.1)
}
function ghostEaten(g, pac) {
  C.chain++
  const pts = 200 * Math.pow(2, Math.min(C.chain - 1, 3))
  const [x, y] = ePos(g).map((v, i) => 0)
  const [gx, gy] = ePos(g)
  const [wx, wy] = tilePos(gx, gy)
  addScore(pts, wx, wy); g.state = 'eaten'; C.stats.ghosts++; profile.chompGhosts = (profile.chompGhosts || 0) + 1
  sfx('pEat', C.chain); shake(0.5); ring(wx, wy, 22, 40, COLS.cyan)
  C.hitStop = 0.12
  for (let i = 0; i < 14; i++) part(wx, wy, R(-30, 30), R(-30, 30), 0.5, rgb('#6a8aff'), 1.2, 2)
}
function pacDies(p) {
  if (!p.alive) return
  p.alive = false; p.deadT = 0
  C.phase = 'dying'; C.deadT = 0
  music.stop(); sfx('pDie'); shake(1.2)
}
function collide() {
  for (const p of C.pacs) {
    if (!p.alive) continue
    const [px, py] = ePos(p)
    for (const g of C.ghosts) {
      if (g.state === 'house' || g.state === 'eaten' || g.state === 'entering' || g.state === 'leaving') continue
      const [gx, gy] = g.state === 'normal' || g.state === 'frightened' ? ePos(g) : [g.px, g.py]
      if (dist2(px, py, gx, gy) < 0.45) {
        if (g.state === 'frightened') { if (!MODES[C.cfg.type].ghost || true) ghostEaten(g, p) }
        else { if (g.human) { C.ghostScore += 1000; sfx('pEat', 4) } pacDies(p); return }
      }
    }
  }
}

// ---------- ghosts house script ----------
function stepHouseGhost(g, dt) {
  if (g.state === 'house') {
    g.bob += dt * 6
    g.release -= dt
    g.px = g.cx + Math.sin(g.bob) * 0.0; g.py = g.cy + Math.sin(g.bob) * 0.3
    if (g.release <= 0) { g.state = 'leaving'; g.tx = g.cx; g.ty = g.cy }
    return
  }
  if (g.state === 'leaving' || g.state === 'entering') {
    const target = g.state === 'leaving' ? EXIT : [11, 11]
    const sp = 6 * dt
    // first align horizontally to x = 11, then move vertically
    let tx = g.px, ty = g.py
    if (g.state === 'leaving') { if (Math.abs(g.px - 11) > 0.05) tx = g.px + Math.sign(11 - g.px) * Math.min(sp, Math.abs(11 - g.px)); else { tx = 11; ty = g.py + Math.sign(EXIT[1] - g.py) * Math.min(sp, Math.abs(EXIT[1] - g.py)) } }
    else { ty = g.py + Math.sign(11 - g.py) * Math.min(sp, Math.abs(11 - g.py)) }
    g.px = tx; g.py = ty
    if (g.state === 'leaving' && Math.abs(g.px - 11) < 0.06 && Math.abs(g.py - EXIT[1]) < 0.06) {
      g.state = C.fright > 0 ? 'frightened' : 'normal'; g.cx = EXIT[0]; g.cy = EXIT[1]; g.tx = g.cx; g.ty = g.cy; g.t = 0; g.dir = [Math.random() < 0.5 ? -1 : 1, 0]
    }
    if (g.state === 'entering' && Math.abs(g.py - 11) < 0.06) { g.state = 'leaving'; g.px = 11; g.py = 11; g.cx = 11; g.cy = 11 }
  }
}

// ---------- main ----------
function play(dt) {
  C.t += dt
  if (C.phase === 'ready') {
    C.readyT -= dt
    if (C.readyT <= 0) { C.phase = 'play'; C.msg = null }
    for (const g of C.ghosts) { g.bob += dt * 6; if (g.state === 'house') { g.px = g.cx; g.py = g.cy + Math.sin(g.bob) * 0.3 } }
    return
  }
  if (C.phase === 'dying') {
    C.deadT += dt
    for (const p of C.pacs) if (!p.alive) p.deadT += dt
    if (C.deadT > 1.8) {
      const anyAlive = C.pacs.some((p) => p.alive)
      C.lives--
      if (C.lives <= 0 || (MODES[C.cfg.type].ghost && C.lives <= 0)) { endGame(); return }
      resetActors(false); music.stop()
      for (const p of C.pacs) p.alive = true
    }
    stepParticles(dt)
    return
  }
  if (C.phase === 'clear') {
    C.clearT -= dt
    if (C.clearT <= 0) {
      if (MODES[C.cfg.type].ghost) { endGame(true); return }
      const lvl = C.level + 1; profile.chompLevels = (profile.chompLevels || 0) + 1
      C.score += 1000 + C.lives * 200
      loadLevel(lvl); sfx('pIntro'); shake(0)
    }
    stepParticles(dt)
    return
  }
  if (C.msg && C.msgT !== undefined) { C.msgT -= dt; if (C.msgT <= 0) { C.msg = null; C.msgT = undefined } }
  if (C.hitStop > 0) { C.hitStop -= dt; stepParticles(dt); return }
  // scatter / chase
  C.modeT += dt
  if (C.fright <= 0 && C.modeT >= SCHEDULE[Math.min(C.modeIdx, SCHEDULE.length - 1)] / (1 + (C.level - 1) * 0.05)) { C.modeT = 0; C.modeIdx++; C.chase = !C.chase; for (const g of C.ghosts) if (g.state === 'normal') reverseNow(g) }
  if (C.fright > 0) {
    C.fright -= dt
    for (const g of C.ghosts) if (g.state === 'frightened') g.flash = C.fright < 2 ? Math.floor(C.fright * 6) % 2 : 0
    if (C.fright <= 0) { C.fright = 0; for (const g of C.ghosts) if (g.state === 'frightened') g.state = 'normal'; C.chain = 0 }
  }
  // pacs
  for (const p of C.pacs) {
    if (!p.alive) continue
    p.mouth += dt * 14
    if (p.human) { const d = pacInput(p); if (d) { p.want = d; if (p.dir[0] === -d[0] && p.dir[1] === -d[1] && (p.dir[0] || p.dir[1])) { reverseNow(p); p.face = d } } }
    stepEnt(p, dt, PAC_SPD * lvlMul() * (C.fright > 0 ? 1.1 : 1), (e) => { if (e.auto) e.want = autoPac(e) || e.want; pacDecide(e) })
    p.onArrive = eatAt
    if (p.dir[0] || p.dir[1]) p.face = p.dir
  }
  // ghosts
  for (const g of C.ghosts) {
    if (g.state === 'house' || g.state === 'leaving' || g.state === 'entering') { stepHouseGhost(g, dt); continue }
    stepEnt(g, dt, ghostSpeed(g), ghostDecide)
    const [gx, gy] = ePos(g); g.px = gx; g.py = gy
    if (g.dir[0] || g.dir[1]) g.eyes = g.dir
    if (g.state === 'eaten' && g.cx === EXIT[0] && g.cy === EXIT[1] && g.t === 0) { g.state = 'entering'; g.px = 11; g.py = 9 }
  }
  if (C.fruit) { C.fruit.t -= dt; if (C.fruit.t <= 0) C.fruit = null }
  collide()
  // siren
  C.sirenT -= dt
  if (C.sirenT <= 0) {
    const prog = 1 - C.dotsLeft / Math.max(1, C.dotsTotal)
    if (C.ghosts.some((g) => g.state === 'eaten')) { sfx('pEyes'); C.sirenT = 0.22 }
    else if (C.fright > 0) { sfx('pFright'); C.sirenT = 0.18 }
    else { sfx('pSiren', prog); C.sirenT = 0.42 - prog * 0.14 }
  }
  stepParticles(dt)
}
function endGame(win = false) {
  const m = MODES[C.cfg.type]
  const ghostWin = m.ghost && !win
  C.over = { win: m.ghost ? win : false, title: m.ghost ? (win ? 'PAC WINS!' : 'GHOST WINS!') : 'GAME OVER', score: C.score, level: C.level, dots: C.stats.dots, ghosts: C.stats.ghosts, fruits: C.stats.fruits, ghostScore: C.ghostScore, type: C.cfg.type }
  C.mode = 'over'; C.phase = 'over'; music.stop(); sfx(m.ghost && win ? 'win' : 'over'); speak(C.over.title.toLowerCase(), 0.6, 1.05)
  profile.chompHi = Math.max(profile.chompHi || 0, C.score)
  if (m.humans.length) {
    profile.chompGames = (profile.chompGames || 0) + 1
    const lb = C.cfg.type === 'ghost' ? (win ? C.score + 5000 : C.score) : C.score
    if (C.cfg.type !== 'coop' && lb > 0) recordScore('chomp', lb)
    saveProfile()
  }
}
function onKey(code) {
  if (C.mode === 'idle') return
  if (code === 'Escape' || code === 'KeyP') { if (C.mode === 'play') { C.paused = !C.paused; sfx('ui'); emitC() } return }
  if (C.paused) { if (code === 'Enter') { C.paused = false; emitC() } return }
  if (C.mode === 'over' && code === 'Enter') start(C.cfg.type, C.cfg.level)
}
function update(dtRaw) {
  const dt = Math.min(dtRaw, 0.04)
  if (C.mode === 'idle') return
  if (C.mode === 'play' && !C.paused) play(dt)
  else if (C.mode === 'over') stepParticles(dt)
  C.emitT -= dt
  if (C.emitT <= 0) { C.emitT = 0.07; emitC() }
}
export const chompActions = {
  start, stop, quit() { toMenu() }, resume() { C.paused = false; emitC() }, rematch() { start(C.cfg.type, C.cfg.level) },
  pause() { if (C.mode === 'play' && !C.paused) { C.paused = true; emitC(); return true } return false },
}

// ---------- rendering ----------
const cc = {}
const lc = (hex) => cc[hex] || (cc[hex] = rgb(hex))
function disc(put, x, y, r, col, k, z, step = 0.5, cut) {
  for (let gx = -r; gx <= r + 1e-6; gx += step) for (let gy = -r; gy <= r + 1e-6; gy += step) {
    if (gx * gx + gy * gy > r * r) continue
    if (cut && cut(gx, gy)) continue
    put(x + gx, y + gy, z, step * 1.02, step * 1.02, col[0] * k, col[1] * k, col[2] * k)
  }
}
function draw(api) {
  const { put } = api
  const t = G.time
  const flashWalls = C.phase === 'clear' && Math.floor(C.clearT * 6) % 2 === 0
  const wallCol = flashWalls ? [2.2, 2.2, 2.4] : lc(['#2a4aff', '#ff4de1', '#3dff7a', '#ffb02a', '#3de8ff', '#b04dff'][(C.level - 1) % 6])
  // background glow
  for (let gx = -50; gx <= 50; gx += 5) for (let gy = -28; gy <= 28; gy += 5) { const k = 0.025 + 0.012 * Math.sin(t * 1.3 + gx * 0.2 + gy * 0.17); put(gx, gy, -9, 4.8, 4.8, k * 0.6, k * 0.8, k * 2) }
  if (!C.g.length) return
  for (let r = 0; r < MH; r++) for (let c = 0; c < MW; c++) {
    const [x, y] = tilePos(c, r)
    if (C.g[r][c] === 1) {
      put(x, y, -1, CS, CS, 0.03, 0.05, 0.16)
      for (const [dx, dy] of DIRS) {
        const nc = c + dx, nr = r + dy
        const open = nr >= 0 && nr < MH && nc >= 0 && nc < MW && C.g[nr][nc] === 0
        if (open) put(x + dx * CS * 0.42, y - dy * CS * 0.42, 0, dx ? 0.45 : CS * 1.02, dy ? 0.45 : CS * 1.02, wallCol[0] * 1.5, wallCol[1] * 1.5, wallCol[2] * 1.5)
      }
    } else if (C.house[r][c]) {
      if (r === 10) put(x, y, 0, CS, 0.4, 2.2, 1.3, 1.9)
    }
    const dv = C.dots[r] && C.dots[r][c]
    if (dv === 1) put(x, y, 0, 0.5, 0.5, 2.2, 1.9, 1.3)
    else if (dv === 2) { const s = 1.1 + 0.5 * Math.sin(t * 8); disc(put, x, y, 0.7 * s, [2.4, 2.1, 1.2], 1, 0.5, 0.35) }
  }
  // fruit
  if (C.fruit) { const [x, y] = tilePos(C.fruit.c, C.fruit.r); const f = FRUITS[Math.min(C.level - 1, 7)]; const col = C.fruit.gold ? [2.6, 2 + 0.5 * Math.sin(t * 12), 0.3] : lc(f[2]); if (C.fruit.gold) for (let i = 0; i < 6; i++) { const a = t * 3 + i; put(x + Math.cos(a) * 1.7, y + Math.sin(a) * 1.7, 2, 0.5, 0.5, 2.6, 2.4, 0.8) }; disc(put, x, y + Math.sin(t * 5) * 0.2, 0.85, col, 1.8, 0.5, 0.42); put(x + 0.4, y + 1.1, 1, 0.4, 0.8, 0.3, 1.2, 0.3) }
  // pacs
  for (const p of C.pacs) {
    const [px, py] = ePos(p); const [x, y] = tilePos(px, py)
    const col = p.id ? [0.4, 1.8, 2.2] : [2.4, 2.1, 0.2]
    if (!p.alive) {
      const u = Math.min(1, p.deadT / 1.2)
      if (u < 1) disc(put, x, y, 1.05 * (1 - u * 0.2), col, 1, 1, 0.45, (gx, gy) => { const a = Math.atan2(gy, gx); const open = 0.2 + u * 2.9; return Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))) < open })
      continue
    }
    const open = (Math.abs(Math.sin(p.mouth)) * 0.9) * ((p.dir[0] || p.dir[1]) ? 1 : 0.3)
    const face = p.face || [-1, 0]
    const ang = Math.atan2(-face[1], face[0])
    disc(put, x, y, 1.05, col, 1, 1, 0.45, (gx, gy) => { const a = Math.atan2(gy, gx) - ang; return Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < open })
  }
  // ghosts
  for (const g of C.ghosts) {
    const [px, py] = g.state === 'normal' || g.state === 'frightened' || g.state === 'eaten' ? [g.px, g.py] : [g.px, g.py]
    const [x, y] = tilePos(px, py)
    let col = lc(GCOL[g.id]), k = 1.5
    if (g.state === 'frightened') { col = g.flash ? [2.2, 2.2, 2.4] : lc('#2a3aff'); k = 1.3 }
    const eyesOnly = g.state === 'eaten' || g.state === 'entering'
    if (!eyesOnly) {
      for (let gx = -1.05; gx <= 1.06; gx += 0.45) for (let gy = -1.05; gy <= 1.06; gy += 0.45) {
        const top = gy >= 0 ? gx * gx + gy * gy <= 1.1 : Math.abs(gx) <= 1.05
        if (!top) continue
        if (gy < -0.5 && Math.floor((gx + t * 3 + 4) / 0.45) % 2 === 0) continue
        put(x + gx, y + gy, 1, 0.47, 0.47, col[0] * k, col[1] * k, col[2] * k)
      }
      if (g.human) for (let i = 0; i < 6; i++) { const a = t * 4 + i; put(x + Math.cos(a) * 1.8, y + Math.sin(a) * 1.8, 2, 0.4, 0.4, 2, 2, 0.4) }
    }
    if (g.state === 'frightened' && !eyesOnly) { put(x - 0.4, y + 0.3, 2, 0.3, 0.3, 2.2, 1.6, 1); put(x + 0.4, y + 0.3, 2, 0.3, 0.3, 2.2, 1.6, 1) }
    else { const e = g.eyes || [0, 0]; for (const sx of [-0.45, 0.45]) { put(x + sx, y + 0.35, 2, 0.6, 0.7, 2.6, 2.6, 2.6); put(x + sx + e[0] * 0.18, y + 0.35 - e[1] * 0.18, 2.5, 0.3, 0.3, 0.1, 0.2, 1.4) } }
  }
  for (const q of G.parts) { const f = q.life / q.max; put(q.x, q.y, 3, q.s * (0.35 + 0.65 * f) * 0.9, q.s * (0.35 + 0.65 * f) * 0.9, q.c[0] * 1.8, q.c[1] * 1.8, q.c[2] * 1.8) }
  api.pops(G.pops, 0)
}
if (typeof window !== 'undefined') { window.__C = C; window.__chomp = chompActions }
games.chomp = { update, onKey, draw, stop, sky: () => '#03030e' }
