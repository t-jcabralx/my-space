// MINI GAMES: twenty-four quick original canvas games in the classic browser-arcade genres (stacker, flappy, bubble shooter,
// runner, slicer, match-3, memory, whack-a-mole, idle miner, traffic dodger). Each game is a small object the shell drives:
//   reset(), update(dt), draw(g), down(x, y), move(x, y), up(x, y), key(code)  +  score, over, label
// Logical canvas is W x H; the shell scales it to the screen and maps touch/mouse into these coordinates.
import { wrapR3 } from './r3.js'
import { createFruitWorld, FRUIT_RADII, FRUIT_BIN } from './fruitPhysics.js'
import { fruitModel, fishModel, moleModel, wrestlerModel, basketballModel, chickModel, lanternModel, flowerPatch, robotModel } from './models.js'
export const W = 360, H = 540
const TAU = Math.PI * 2
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const rnd = (a, b) => a + Math.random() * (b - a)
const ri = (a, b) => Math.floor(rnd(a, b + 1))
const pick = (arr) => arr[(Math.random() * arr.length) | 0]
const hsl = (h, s = 80, l = 55) => `hsl(${h % 360} ${s}% ${l}%)`
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath() }
function txt(g, s, x, y, size = 16, color = '#fff', align = 'center') { g.font = `bold ${size}px "Press Start 2P", monospace`; g.textAlign = align; g.textBaseline = 'middle'; g.fillStyle = color; g.fillText(s, x, y) }
function sky(g, a, b) { const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr; g.fillRect(0, 0, W, H) }
function disc(g, x, y, r, c) { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill() }
// particles shared by the games
const puff = (arr, x, y, n, c, sp = 140) => { for (let i = 0; i < n; i++) { const a = rnd(0, TAU), s = rnd(sp * 0.3, sp); arr.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, l: rnd(0.35, 0.8), c, s: rnd(2, 5) }) } }
const stepFx = (arr, dt) => { for (const p of arr) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; p.l -= dt } for (let i = arr.length - 1; i >= 0; i--) if (arr[i].l <= 0) arr.splice(i, 1) }
const drawFx = (g, arr) => { for (const p of arr) { g.globalAlpha = clamp(p.l * 2, 0, 1); g.fillStyle = p.c; g.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s) } g.globalAlpha = 1 }

// ---------------------------------------------------------------- 1. STACK TOWER
function stackTower() {
  const BH = 22
  const o = { score: 0, over: false, label: 'TAP TO DROP THE BLOCK' }
  let blocks, cur, speed, cam, combo, fx
  o.reset = () => { blocks = [{ x: 80, w: 200, h: 0 }]; cur = { x: 10, w: 200, dir: 1, h: 30 }; speed = 150; cam = 0; combo = 0; fx = []; o.score = 0; o.over = false }
  o.update = (dt) => {
    stepFx(fx, dt)
    if (o.over) return
    cur.x += cur.dir * speed * dt
    if (cur.x + cur.w > W - 6) { cur.x = W - 6 - cur.w; cur.dir = -1 } else if (cur.x < 6) { cur.x = 6; cur.dir = 1 }
    cam += (Math.max(0, (blocks.length - 9) * BH) - cam) * Math.min(1, dt * 5)
  }
  o.down = () => {
    if (o.over) return
    const t = blocks[blocks.length - 1]
    const left = Math.max(cur.x, t.x), right = Math.min(cur.x + cur.w, t.x + t.w), ov = right - left
    if (ov <= 0) { o.over = true; puff(fx, cur.x + cur.w / 2, H - 100 - blocks.length * BH + cam, 18, '#ff6a6a'); return }
    let x = left, w = ov
    if (Math.abs(cur.x - t.x) < 5) { x = t.x; w = t.w; combo++; if (combo >= 3) { w = Math.min(w + 10, 240); x = Math.max(6, Math.min(x - 5, W - 6 - w)) } puff(fx, x + w / 2, H - 100 - blocks.length * BH + cam, 12, '#ffe84a') } else combo = 0
    blocks.push({ x, w, h: blocks.length })
    o.score = blocks.length - 1
    speed = Math.min(380, speed + 5)
    cur = { x: cur.dir > 0 ? 6 : W - 6 - w, w, dir: cur.dir > 0 ? 1 : -1, h: 30 }
  }
  o.draw = (g) => {
    sky(g, '#1b2a6b', '#0a1030')
    for (let i = 0; i < blocks.length; i++) { const b = blocks[i], y = H - 100 - i * BH + cam; if (y < -BH || y > H) continue; g.fillStyle = hsl(i * 14 + 190, 75, 52); rr(g, b.x, y, b.w, BH - 2, 4); g.fill() }
    if (!o.over) { const y = H - 100 - blocks.length * BH + cam; g.fillStyle = hsl(blocks.length * 14 + 190, 85, 62); rr(g, cur.x, y, cur.w, BH - 2, 4); g.fill() }
    drawFx(g, fx)
    if (combo >= 2) txt(g, 'PERFECT x' + combo, W / 2, 80, 12, '#ffe84a')
  }

  o.draw3 = (r, g) => {
    const ty = 190 + cam
    r.look(70, ty + 150, -560, 0, ty - 20, 0, 45); r.begin('#1b2a6b', '#0a1030')
    r.floor(-700, -500, 700, 900, 0, '#101a44')
    for (let i = 0; i < blocks.length; i++) { const b = blocks[i]; r.box(b.x + b.w / 2 - W / 2, i * BH + BH / 2, 0, b.w, BH - 2, b.w * 0.8 + 30, hsl(i * 14 + 190, 75, 52)) }
    if (!o.over) r.box(cur.x + cur.w / 2 - W / 2, blocks.length * BH + BH / 2, 0, cur.w, BH - 2, cur.w * 0.8 + 30, hsl(blocks.length * 14 + 190, 85, 62), { glow: 1.15 })
    r.fx(fx, (p) => [p.x - W / 2, H - 100 - p.y + cam, -10]); r.flush()
    if (combo >= 2) txt(g, 'PERFECT x' + combo, W / 2, 80, 12, '#ffe84a')
  }
  o.key=(code)=>{if(code==='Space')o.down()}
  return o
}

// ---------------------------------------------------------------- 2. WING DASH (flappy)
function wingDash() {
  const o = { score: 0, over: false, label: 'TAP TO FLAP' }
  let b, pipes, t, started, fx
  const GR = H - 50
  o.reset = () => { b = { y: 240, vy: 0 }; pipes = []; t = 0; started = false; fx = []; o.score = 0; o.over = false }
  const flap = () => { if (o.over) return; started = true; b.vy = -310; puff(fx, 90, b.y + 8, 4, '#ffffff', 60) }
  o.down = flap; o.key = (c) => { if (c === 'Space' || c === 'ArrowUp') flap() }
  o.update = (dt) => {
    stepFx(fx, dt)
    if (o.over) return
    t += dt
    if (!started) { b.y = 240 + Math.sin(t * 5) * 8; return }
    b.vy += 900 * dt; b.y += b.vy * dt
    const last = pipes[pipes.length - 1]
    if (!last || last.x < W - 190) pipes.push({ x: W + 40, gap: rnd(150, H - 190), open: Math.max(120, 160 - o.score * 1.2), passed: false })
    const sp = 125 + Math.min(70, o.score * 2)
    for (const p of pipes) { p.x -= sp * dt; if (!p.passed && p.x + 26 < 78) { p.passed = true; o.score++ } }
    while (pipes.length && pipes[0].x < -60) pipes.shift()
    if (b.y > GR - 12 || b.y < -20) { o.over = true; puff(fx, 90, b.y, 16, '#ffd23a') }
    for (const p of pipes) if (90 + 12 > p.x && 90 - 12 < p.x + 52 && (b.y - 12 < p.gap - p.open / 2 || b.y + 12 > p.gap + p.open / 2)) { o.over = true; puff(fx, 90, b.y, 16, '#ffd23a') }
  }
  o.draw = (g) => {
    sky(g, '#5ec8ff', '#d7f3ff')
    for (const p of pipes) { g.fillStyle = '#3cb043'; g.fillRect(p.x, 0, 52, p.gap - p.open / 2); g.fillRect(p.x, p.gap + p.open / 2, 52, H); g.fillStyle = '#2a8a33'; g.fillRect(p.x - 4, p.gap - p.open / 2 - 18, 60, 18); g.fillRect(p.x - 4, p.gap + p.open / 2, 60, 18) }
    g.fillStyle = '#d9b36a'; g.fillRect(0, GR, W, 50); g.fillStyle = '#7ac74f'; g.fillRect(0, GR, W, 8)
    g.save(); g.translate(90, b.y); g.rotate(clamp(b.vy / 600, -0.5, 0.9)); disc(g, 0, 0, 13, '#ffd23a'); disc(g, 5, -4, 4, '#fff'); disc(g, 6, -4, 2, '#222'); g.fillStyle = '#ff7a2a'; g.fillRect(10, 0, 9, 5); g.fillStyle = '#ffb02e'; g.fillRect(-12, 0, 11, 6); g.restore()
    drawFx(g, fx); txt(g, String(o.score), W / 2, 60, 34, '#fff')
  }

  o.draw3 = (r, g) => {
    r.look(-30, 345, -580, 20, 270, 0, 45); r.begin('#5ec8ff', '#d7f3ff')
    r.floor(-500, -300, 500, 600, H - GR, '#d9b36a')
    for (let i = -8; i < 9; i++) { const x = ((i * 50 - t * 125) % 400 + 400) % 400 - 200; r.quad([[x, H - GR + 0.3, -120], [x + 22, H - GR + 0.3, -120], [x + 22, H - GR + 0.3, 40], [x, H - GR + 0.3, 40]], '#7ac74f') }
    r.box(0, H - GR + 4, 40, 900, 8, 24, '#7ac74f', { edge: false })
    for (const p of pipes) {
      const cx = p.x + 26 - W / 2, top = H - (p.gap - p.open / 2), bot = H - (p.gap + p.open / 2)
      r.cyl(cx, top, 0, 26, 500, '#3cb043', { top: '#6fe05a' }); r.cyl(cx, top, 0, 31, 16, '#2a8a33', { top: '#5acd48' })
      r.cyl(cx, H - GR, 0, 26, bot - (H - GR), '#3cb043', { top: '#6fe05a' }); r.cyl(cx, bot - 16, 0, 31, 16, '#2a8a33', { top: '#5acd48' })
    }
    const bx = 90 - W / 2, by = H - b.y, fl = Math.sin(t * 22) * 8
    r.shadow(bx, 0, 13, 0.25, H - GR + 0.3)
    chickModel(r,bx,by,0,13,t)
    r.fx(fx); r.flush(); txt(g, String(o.score), W / 2, 60, 34, '#fff')
  }
  return o
}

// ---------------------------------------------------------------- 3. BUBBLE POP
function bubblePop() {
  const COLS = 9, R = 20, ROWH = 35, TOPY = 24, MAXROW = 12, COLORS = ['#ff5a6a', '#ffd23a', '#3de8ff', '#7dff6a', '#b27aff']
  const o = { score: 0, over: false, label: 'AIM AND RELEASE TO SHOOT' }
  let rows, par, shot, cur, next, aim, shots, fall, fx, lvl
  const colsOf = (r) => (((r + par) % 2) ? COLS - 1 : COLS)
  const pos = (r, c) => ({ x: c * 40 + R + (((r + par) % 2) ? R : 0), y: TOPY + r * ROWH })
  const newRow = () => { const r = []; for (let c = 0; c < COLS; c++) r.push(ri(0, 4)); return r }
  const colorsLeft = () => { const s = new Set(); for (const r of rows) for (const v of r) if (v !== null) s.add(v); return s.size ? [...s] : [0, 1, 2] }
  const cells = () => { const a = []; rows.forEach((r, ri2) => r.forEach((v, c) => { if (v !== null) a.push([ri2, c]) })); return a }
  const neigh = (r, c) => { const p = pos(r, c), out = []; for (let dr = -1; dr <= 1; dr++) { const rr2 = r + dr; if (rr2 < 0 || rr2 >= rows.length) continue; rows[rr2].forEach((v, cc) => { if (v === null || (dr === 0 && cc === c)) return; const q = pos(rr2, cc); if (Math.hypot(q.x - p.x, q.y - p.y) < 44) out.push([rr2, cc]) }) } return out }
  function fill(r0, c0, test) { const seen = new Set([r0 + ',' + c0]), st = [[r0, c0]]; while (st.length) { const [r, c] = st.pop(); for (const [a, b] of neigh(r, c)) { const k = a + ',' + b; if (!seen.has(k) && test(a, b)) { seen.add(k); st.push([a, b]) } } } return [...seen].map((k) => k.split(',').map(Number)) }
  const level = () => { rows = []; par = 0; for (let r = 0; r < 5 + Math.min(3, lvl); r++) rows.push(r % 2 ? newRow().slice(0, COLS - 1) : newRow()) }
  o.reset = () => { lvl = 0; o.score = 0; o.over = false; shots = 0; fx = []; fall = []; shot = null; aim = -Math.PI / 2; level(); cur = pick(colorsLeft()); next = pick(colorsLeft()) }
  const snapShot = () => {
    let best = null
    for (let r = 0; r < MAXROW + 2; r++) {
      if (r >= rows.length) rows.push(Array(colsOf(r)).fill(null))
      for (let c = 0; c < colsOf(r); c++) {
        if (rows[r][c] !== null) continue
        if (r > 0 && !neigh(r, c).length && !(rows[r - 1] && false)) { /* needs support */ if (r > 0) { const p0 = pos(r, c); if (!rows[r - 1].some((v, cc) => v !== null && Math.hypot(pos(r - 1, cc).x - p0.x, pos(r - 1, cc).y - p0.y) < 44)) continue } }
        const p = pos(r, c), d = Math.hypot(p.x - shot.x, p.y - shot.y)
        if (!best || d < best.d) best = { r, c, d }
      }
    }
    return best
  }
  const settle = () => {
    const b = snapShot(); const col = shot.c; shot = null
    if (!b) return
    while (rows.length <= b.r) rows.push(Array(colsOf(rows.length)).fill(null))
    rows[b.r][b.c] = col
    const grp = fill(b.r, b.c, (a, c) => rows[a][c] === col)
    if (grp.length >= 3) {
      for (const [a, c] of grp) { const p = pos(a, c); puff(fx, p.x, p.y, 6, COLORS[rows[a][c]], 160); rows[a][c] = null }
      o.score += grp.length * 10
      const keep = new Set(); for (let c = 0; c < rows[0].length; c++) if (rows[0][c] !== null) for (const [a, d] of fill(0, c, (x, y) => rows[x][y] !== null)) keep.add(a + ',' + d)
      for (const [a, c] of cells()) if (!keep.has(a + ',' + c)) { const p = pos(a, c); fall.push({ x: p.x, y: p.y, vy: 0, c: COLORS[rows[a][c]] }); rows[a][c] = null; o.score += 20 }
    }
    shots++
    if (shots % 6 === 0) { par = (par + 1) % 2; rows.unshift(newRow().slice(0, colsOf(0))) }
    while (rows.length && rows[rows.length - 1].every((v) => v === null)) rows.pop()
    if (!cells().length) { lvl++; o.score += 300; level(); return }
    const low = cells().some(([r]) => r >= MAXROW)
    if (low) o.over = true
    cur = next; if (!colorsLeft().includes(cur)) cur = pick(colorsLeft()); next = pick(colorsLeft())
  }
  const setAim = (x, y) => { aim = clamp(Math.atan2(y - (H - 44), x - W / 2), -Math.PI + 0.18, -0.18) }
  o.down = (x, y) => { if (!o.over && !shot) setAim(x, y) }
  o.move = (x, y) => { if (!o.over && !shot) setAim(x, y) }
  o.up = (x, y) => { if (o.over || shot) return; setAim(x, y); shot = { x: W / 2, y: H - 44, vx: Math.cos(aim) * 640, vy: Math.sin(aim) * 640, c: cur } }
  o.key = (c) => { if (c === 'ArrowLeft') aim = clamp(aim - 0.1, -Math.PI + 0.18, -0.18); if (c === 'ArrowRight') aim = clamp(aim + 0.1, -Math.PI + 0.18, -0.18); if (c === 'Space' && !shot && !o.over) shot = { x: W / 2, y: H - 44, vx: Math.cos(aim) * 640, vy: Math.sin(aim) * 640, c: cur } }
  o.update = (dt) => {
    stepFx(fx, dt)
    for (const f of fall) { f.vy += 900 * dt; f.y += f.vy * dt }
    for (let i = fall.length - 1; i >= 0; i--) if (fall[i].y > H + 20) fall.splice(i, 1)
    if (o.over || !shot) return
    for (let s = 0; s < 4; s++) {
      shot.x += shot.vx * dt / 4; shot.y += shot.vy * dt / 4
      if (shot.x < R) { shot.x = R; shot.vx *= -1 } else if (shot.x > W - R) { shot.x = W - R; shot.vx *= -1 }
      let hit = shot.y <= TOPY
      if (!hit) for (const [r, c] of cells()) { const p = pos(r, c); if (Math.hypot(p.x - shot.x, p.y - shot.y) < 2 * R - 6) { hit = true; break } }
      if (hit) { settle(); return }
    }
  }
  o.draw = (g) => {
    sky(g, '#10163a', '#07091f')
    rows.forEach((r, ri2) => r.forEach((v, c) => { if (v === null) return; const p = pos(ri2, c); disc(g, p.x, p.y, R - 1.5, COLORS[v]); disc(g, p.x - 5, p.y - 6, 4, '#ffffff66') }))
    for (const f of fall) disc(g, f.x, f.y, R - 2, f.c)
    g.strokeStyle = '#ff4d4d55'; g.setLineDash([6, 6]); g.beginPath(); g.moveTo(0, TOPY + MAXROW * ROWH - 16); g.lineTo(W, TOPY + MAXROW * ROWH - 16); g.stroke(); g.setLineDash([])
    if (!shot && !o.over) { g.strokeStyle = '#ffffff66'; g.setLineDash([4, 8]); g.beginPath(); g.moveTo(W / 2, H - 44); let x = W / 2, y = H - 44, vx = Math.cos(aim), vy = Math.sin(aim); for (let i = 0; i < 70; i++) { x += vx * 6; y += vy * 6; if (x < R || x > W - R) vx *= -1; g.lineTo(x, y); if (y < TOPY) break } g.stroke(); g.setLineDash([]) }
    disc(g, W / 2, H - 44, R, COLORS[cur]); disc(g, 40, H - 30, 12, COLORS[next]); txt(g, 'NEXT', 40, H - 52, 8, '#9fb4e8')
    if (shot) disc(g, shot.x, shot.y, R - 1.5, COLORS[shot.c])
    drawFx(g, fx)
  }

  o.draw3 = (r, g) => {
    r.screen(); r.begin('#10163a', '#07091f')
    r.box(0, H / 2, 60, W + 80, H + 80, 20, '#0b1030', { edge: false })
    r.box(-W / 2 - 9, H / 2, 0, 18, H, 60, '#2a3a78'); r.box(W / 2 + 9, H / 2, 0, 18, H, 60, '#2a3a78'); r.box(0, H - TOPY + 22, 0, W + 36, 14, 60, '#2a3a78')
    rows.forEach((rw, ri2) => rw.forEach((v, c) => { if (v === null) return; const pp = pos(ri2, c); r.sphere(pp.x - W / 2, H - pp.y, 0, R - 1.5, COLORS[v]) }))
    for (const f of fall) r.sphere(f.x - W / 2, H - f.y, 0, R - 2, f.c)
    r.line([-W / 2, H - (TOPY + MAXROW * ROWH - 16), -20], [W / 2, H - (TOPY + MAXROW * ROWH - 16), -20], '#ff4d4d', 2)
    if (!shot && !o.over) { let x = W / 2, y = H - 44, vx = Math.cos(aim), vy = Math.sin(aim); for (let i = 0; i < 70; i++) { x += vx * 6; y += vy * 6; if (x < R || x > W - R) vx *= -1; if (i % 4 === 0) r.sphere(x - W / 2, H - y, -4, 2.6, '#ffffff', { shine: false, alpha: 0.7 }); if (y < TOPY) break } }
    r.sphere(0, 44, 0, R, COLORS[cur]); r.sphere(40 - W / 2, 30, 0, 12, COLORS[next])
    if (shot) r.sphere(shot.x - W / 2, H - shot.y, 0, R - 1.5, COLORS[shot.c])
    r.fx(fx); r.flush(); txt(g, 'NEXT', 40, H - 52, 8, '#9fb4e8')
  }
  return o
}

// ---------------------------------------------------------------- 4. NEON RUNNER
function neonRunner() {
  const o = { score: 0, over: false, label: 'TAP TO JUMP · TAP IN AIR TO DOUBLE JUMP' }
  const GY = H - 120
  let p, obs, coins, dist, speed, nextSpawn, jumps, fx, coinN
  o.reset = () => { p = { y: GY, vy: 0 }; obs = []; coins = []; dist = 0; speed = 260; nextSpawn = 400; jumps = 0; fx = []; coinN = 0; o.score = 0; o.over = false }
  const jump = () => { if (o.over || jumps >= 2) return; p.vy = -640; jumps++; puff(fx, 80, p.y, 5, '#3de8ff', 80) }
  o.down = jump; o.key = (c) => { if (c === 'Space' || c === 'ArrowUp') jump() }
  o.update = (dt) => {
    stepFx(fx, dt)
    if (o.over) return
    speed = Math.min(560, 260 + dist * 0.012); dist += speed * dt
    p.vy += 1900 * dt; p.y += p.vy * dt; if (p.y >= GY) { p.y = GY; p.vy = 0; jumps = 0 }
    nextSpawn -= speed * dt
    if (nextSpawn <= 0) { const k = pick(['spike', 'spike', 'block', 'double']); obs.push({ x: W + 40, k, w: k === 'block' ? 34 : k === 'double' ? 52 : 28, h: k === 'block' ? 48 : 30 }); if (Math.random() < 0.7) for (let i = 0; i < 3; i++) coins.push({ x: W + 40 + i * 28, y: GY - rnd(70, 150) }); nextSpawn = rnd(280, 460) + speed * 0.25 }
    for (const a of obs) a.x -= speed * dt
    for (const c of coins) c.x -= speed * dt
    while (obs.length && obs[0].x < -80) obs.shift()
    while (coins.length && coins[0].x < -40) coins.shift()
    for (const a of obs) if (a.x < 80 + 12 && a.x + a.w > 80 - 12 && p.y > GY - a.h + 6) { o.over = true; puff(fx, 80, p.y - 14, 20, '#ff4d6d'); shake = 0 }
    for (let i = coins.length - 1; i >= 0; i--) if (Math.hypot(coins[i].x - 80, coins[i].y - (p.y - 16)) < 24) { puff(fx, coins[i].x, coins[i].y, 5, '#ffe84a', 90); coins.splice(i, 1); coinN++ }
    o.score = Math.floor(dist / 12) + coinN * 10
  }
  let shake = 0
  o.draw = (g) => {
    sky(g, '#2a0a4a', '#0a0420')
    for (let i = 0; i < 20; i++) { g.fillStyle = '#ffffff22'; g.fillRect((i * 97 - dist * 0.1) % W + (i * 97 - dist * 0.1 < 0 ? W : 0), (i * 53) % 280, 2, 2) }
    g.fillStyle = '#16093a'; g.fillRect(0, GY + 6, W, H); g.fillStyle = '#ff4de1'; g.fillRect(0, GY + 6, W, 3)
    for (let x = -((dist * 1) % 40); x < W; x += 40) { g.fillStyle = '#ff4de133'; g.fillRect(x, GY + 10, 2, H) }
    for (const a of obs) { if (a.k === 'block') { g.fillStyle = '#7a3cff'; rr(g, a.x, GY + 6 - a.h, a.w, a.h, 4); g.fill() } else { g.fillStyle = '#ff4d6d'; const n = a.k === 'double' ? 2 : 1; for (let i = 0; i < n; i++) { g.beginPath(); g.moveTo(a.x + i * 26, GY + 6); g.lineTo(a.x + i * 26 + 13, GY + 6 - a.h); g.lineTo(a.x + i * 26 + 26, GY + 6); g.fill() } } }
    for (const c of coins) disc(g, c.x, c.y, 8, '#ffe84a')
    if (!o.over) { g.save(); g.translate(80, p.y); g.rotate(p.y < GY ? (p.vy / 1600) : 0); g.fillStyle = '#3de8ff'; rr(g, -14, -30, 28, 30, 6); g.fill(); g.fillStyle = '#fff'; g.fillRect(2, -22, 8, 8); g.restore() }
    drawFx(g, fx)
  }

  o.draw3 = (r, g) => {
    r.screen(); r.begin('#2a0a4a', '#0a0420')
    for (let i = 0; i < 9; i++) { const x = ((i * 90 - dist * 0.15) % 720 + 720) % 720 - 360, h = 60 + (i * 37) % 110; r.box(x, 114 + h / 2, 150 + (i % 3) * 40, 44, h, 34, hsl(260 + i * 14, 60, 22), { edge: false }) }
    r.box(0, 100, 0, 800, 28, 150, '#16093a'); r.box(0, 114, -75, 800, 4, 5, '#ff4de1', { glow: 1.3, edge: false })
    for (let k = -6; k < 12; k++) { const x = k * 40 - (dist % 40) - 200; r.box(x, 114.5, 0, 3, 1, 148, '#ff4de1', { alpha: 0.3, edge: false }) }
    for (const a of obs) {
      const x = a.x + a.w / 2 - W / 2
      if (a.k === 'block') r.box(x, 114 + a.h / 2, 0, a.w, a.h, 36, '#7a3cff')
      else { const n = a.k === 'double' ? 2 : 1; for (let i = 0; i < n; i++) r.pyramid(a.x + 13 + i * 26 - W / 2, 114, 0, 26, a.h, 26, '#ff4d6d') }
    }
    for (const c of coins) r.sphere(c.x - W / 2, H - c.y, 0, 8, '#ffe84a', { glow: 1.1 })
    if (!o.over) { const px = 80 - W / 2, py = H - p.y; r.shadow(px, 0, 15, 0.35, 114); r.person(px, py, 0, '#3de8ff', dist * 0.07, 3.1, { hair:'#66301a',color:'#263756',accent:[1,.65,.12],coat:false,yaw:Math.PI*.72 }) }
    r.fx(fx); r.flush()
  }
  return o
}

// ---------------------------------------------------------------- 5. SLICE NINJA
function sliceNinja() {
  const KINDS = [['#ff5a4d', 24], ['#ffd23a', 22], ['#7dff6a', 26], ['#ff8ad0', 20], ['#3de8ff', 22]]
  const o = { score: 0, over: false, label: 'SWIPE TO SLICE · AVOID THE BOMBS' }
  let items, fx, trail, lives, t, spawnT, swiping, combo
  o.lives = 3
  o.reset = () => { items = []; fx = []; trail = []; lives = 3; o.lives = 3; t = 0; spawnT = 0.6; swiping = false; combo = 0; o.score = 0; o.over = false }
  const spawn = () => { const bomb = Math.random() < Math.min(0.28, 0.1 + t * 0.002), k = pick(KINDS); items.push({ x: rnd(50, W - 50), y: H + 30, vx: rnd(-70, 70), vy: -rnd(720, 880), r: bomb ? 22 : k[1], c: bomb ? '#222' : k[0], fruitKind: KINDS.indexOf(k), bomb, cut: false, a: 0, va: rnd(-4, 4) }) }
  const seg = (a, b, c) => { const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1, u = clamp(((c.x - a.x) * dx + (c.y - a.y) * dy) / l2, 0, 1); return Math.hypot(a.x + dx * u - c.x, a.y + dy * u - c.y) }
  o.down = (x, y) => { swiping = true; trail = [{ x, y, t: 0 }]; combo = 0 }
  o.up = () => { swiping = false; if (combo >= 3) { o.score += combo * 2; } combo = 0 }
  o.move = (x, y) => {
    if (!swiping || o.over) return
    const a = trail[trail.length - 1], b = { x, y, t: 0 }; trail.push(b)
    for (const it of items) if (!it.cut && seg(a, b, it) < it.r + 6) {
      it.cut = true
      if (it.bomb) { o.over = true; puff(fx, it.x, it.y, 30, '#ff9a3a', 260); return }
      combo++; o.score += 1; puff(fx, it.x, it.y, 10, it.c, 200)
      items.push({ x: it.x - 8, y: it.y, vx: -90, vy: -80, r: it.r * 0.7, c: it.c, bomb: false, cut: true, half: true, a: 0, va: -5 }, { x: it.x + 8, y: it.y, vx: 90, vy: -80, r: it.r * 0.7, c: it.c, bomb: false, cut: true, half: true, a: 0, va: 5 })
    }
  }
  o.update = (dt) => {
    stepFx(fx, dt)
    for (const p of trail) p.t += dt; while (trail.length && trail[0].t > 0.18) trail.shift()
    if (o.over) return
    t += dt; spawnT -= dt
    if (spawnT <= 0) { const n = Math.random() < 0.35 ? ri(2, 3) : 1; for (let i = 0; i < n; i++) spawn(); spawnT = Math.max(0.45, 1.2 - t * 0.01) }
    for (const it of items) { it.vy += 900 * dt; it.x += it.vx * dt; it.y += it.vy * dt; it.a += it.va * dt; if (!it.bomb && !it.cut && it.y > H + 40 && it.vy > 0) { it.cut = true; it.gone = true; lives--; o.lives = lives; if (lives <= 0) o.over = true } }
    for (let i = items.length - 1; i >= 0; i--) if (items[i].y > H + 60 && items[i].vy > 0) items.splice(i, 1)
  }
  o.draw = (g) => {
    sky(g, '#2b1a12', '#0d0705')
    for (const it of items) {
      if (it.half) { g.save(); g.translate(it.x, it.y); g.rotate(it.a); g.fillStyle = it.c; g.beginPath(); g.arc(0, 0, it.r, 0, Math.PI); g.fill(); g.restore(); continue }
      if (it.cut) continue
      g.save(); g.translate(it.x, it.y); g.rotate(it.a); disc(g, 0, 0, it.r, it.c); if (it.bomb) { disc(g, -6, -6, 5, '#555'); g.fillStyle = '#ff9a3a'; g.fillRect(-2, -it.r - 8, 4, 10) } else { disc(g, -it.r * 0.3, -it.r * 0.3, it.r * 0.25, '#ffffff66') } g.restore()
    }
    if (trail.length > 1) { g.strokeStyle = '#fff'; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); trail.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.stroke(); g.lineWidth = 1 }
    drawFx(g, fx)
    for (let i = 0; i < 3; i++) txt(g, i < lives ? '♥' : '♡', 30 + i * 28, 24, 18, i < lives ? '#ff5a6a' : '#664')
    if (combo >= 2) txt(g, combo + ' COMBO', W / 2, 90, 14, '#ffe84a')
  }

  o.draw3 = (r, g) => {
    r.screen(); r.begin('#2b1a12', '#0d0705')
    r.box(0, H / 2, 70, W + 100, H + 100, 24, '#3a2615', { edge: false }); for (let i = 0; i < 7; i++) r.box(0, 40 + i * 80, 54, W + 100, 3, 3, '#24150b', { edge: false })
    for(const side of [-1,1]){lanternModel(r,side*150,470,25,15);r.box(side*167,250,38,11,420,12,'#91562f')}
    for (const it of items) {
      const x = it.x - W / 2, y = H - it.y
      if (it.half) { r.sphere(x, y, 0, it.r * 0.8, it.c, { alpha: 0.9 }); continue }
      if (it.cut) continue
      if(it.bomb)r.sphere(x,y,0,it.r,'#2a2a33');else fruitModel(r,x,y,0,it.r,it.fruitKind||0,r.clock)
      if (it.bomb) { r.box(x + Math.sin(it.a) * 3, y + it.r + 6, 0, 4, 12, 4, '#8a6a4a'); r.sphere(x + Math.sin(it.a) * 3, y + it.r + 13, 0, 4, '#ff9a3a', { glow: 1.4, shine: false }) }
      else r.sphere(x - it.r * 0.3, y + it.r * 0.35, -it.r * 0.7, it.r * 0.18, '#ffffff', { alpha: 0.35, shine: false })
    }
    r.fx(fx); r.flush()
    if (trail.length > 1) { g.strokeStyle = '#fff'; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); trail.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.stroke(); g.lineWidth = 1 }
    for (let i = 0; i < 3; i++) txt(g, i < lives ? '♥' : '♡', 30 + i * 28, 24, 18, i < lives ? '#ff5a6a' : '#664')
    if (combo >= 2) txt(g, combo + ' COMBO', W / 2, 90, 14, '#ffe84a')
  }
  o.cancel=()=>{swiping=false;trail=[];combo=0}
  return o
}

// ---------------------------------------------------------------- 6. GEM CRUSH (match-3)
function gemCrush() {
  const N = 7, CS = 48, OX = 12, OY = 130, COLORS = ['#ff5a6a', '#ffd23a', '#3de8ff', '#7dff6a', '#b27aff', '#ff9a3a']
  const o = { score: 0, over: false, label: 'SWAP NEIGHBOURS TO MATCH 3', moves: 25 }
  let grid, sel, state, timer, chain, fx, drag, a1, a2
  const cell = (x, y) => { const c = Math.floor((x - OX) / CS), r = Math.floor((y - OY) / CS); return c >= 0 && c < N && r >= 0 && r < N ? [r, c] : null }
  const mk = () => ({ t: ri(0, 5), oy: 0, ox: 0 })
  function matches() { const m = new Set(); for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { const t = grid[r][c] && grid[r][c].t; if (t === null || t === undefined) continue; let k = 1; while (c + k < N && grid[r][c + k] && grid[r][c + k].t === t) k++; if (k >= 3) for (let i = 0; i < k; i++) m.add(r + ',' + (c + i)); k = 1; while (r + k < N && grid[r + k][c] && grid[r + k][c].t === t) k++; if (k >= 3) for (let i = 0; i < k; i++) m.add((r + i) + ',' + c) } return m }
  const hasMove = () => { for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) for (const [dr, dc] of [[0, 1], [1, 0]]) { const r2 = r + dr, c2 = c + dc; if (r2 >= N || c2 >= N) continue; const t = grid[r][c]; grid[r][c] = grid[r2][c2]; grid[r2][c2] = t; const ok = matches().size > 0; grid[r2][c2] = grid[r][c]; grid[r][c] = t; if (ok) return true } return false }
  const build = () => { do { grid = Array.from({ length: N }, () => Array.from({ length: N }, mk)) } while (matches().size || !hasMove()) }
  o.reset = () => { build(); sel = null; state = 'idle'; timer = 0; chain = 0; fx = []; drag = null; o.score = 0; o.moves = 25; o.over = false }
  const swap = (p, q) => { const t = grid[p[0]][p[1]]; grid[p[0]][p[1]] = grid[q[0]][q[1]]; grid[q[0]][q[1]] = t }
  const trySwap = (p, q) => { if (state !== 'idle' || Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) !== 1) return; a1 = p; a2 = q; swap(p, q); state = 'swap'; timer = 0.16; sel = null }
  o.down = (x, y) => { if (o.over || state !== 'idle') return; const c = cell(x, y); if (!c) return; if (sel && Math.abs(sel[0] - c[0]) + Math.abs(sel[1] - c[1]) === 1) { trySwap(sel, c); return } sel = c; drag = { x, y, c } }
  o.move = (x, y) => { if (!drag || state !== 'idle') return; const dx = x - drag.x, dy = y - drag.y; if (Math.hypot(dx, dy) > 22) { const [r, c] = drag.c; const q = Math.abs(dx) > Math.abs(dy) ? [r, c + Math.sign(dx)] : [r + Math.sign(dy), c]; drag = null; if (q[0] >= 0 && q[0] < N && q[1] >= 0 && q[1] < N) trySwap([r, c], q) } }
  o.up = () => { drag = null }
  const gravity = () => { for (let c = 0; c < N; c++) { let w = N - 1; for (let r = N - 1; r >= 0; r--) if (grid[r][c]) { if (w !== r) { grid[w][c] = grid[r][c]; grid[w][c].oy -= (w - r) * CS; grid[r][c] = null } w-- } for (let r = w; r >= 0; r--) { grid[r][c] = mk(); grid[r][c].oy = -(w + 1) * CS - 10 } } }
  o.update = (dt) => {
    stepFx(fx, dt)
    for (const row of grid) for (const g of row) if (g && g.oy) { g.oy = Math.min(0, g.oy + 900 * dt + Math.abs(g.oy) * dt * 6) }
    timer -= dt
    if (state === 'swap' && timer <= 0) { if (matches().size) { chain = 0; state = 'clear'; timer = 0; o.moves-- } else { swap(a1, a2); state = 'idle' } }
    if (state === 'clear' && timer <= 0) {
      const m = matches()
      if (!m.size) { state = 'idle'; if (o.moves <= 0) o.over = true; else if (!hasMove()) build(); return }
      chain++; let n = 0
      for (const k of m) { const [r, c] = k.split(',').map(Number); puff(fx, OX + c * CS + CS / 2, OY + r * CS + CS / 2, 5, COLORS[grid[r][c].t], 150); grid[r][c] = null; n++ }
      o.score += n * 10 * chain
      gravity(); timer = 0.32
    }
  }
  o.draw = (g) => {
    sky(g, '#1a1040', '#090522')
    g.fillStyle = '#ffffff0d'; rr(g, OX - 4, OY - 4, N * CS + 8, N * CS + 8, 10); g.fill()
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { const gm = grid[r][c]; if (!gm) continue; const x = OX + c * CS + CS / 2, y = OY + r * CS + CS / 2 + gm.oy; disc(g, x, y, CS / 2 - 5, COLORS[gm.t]); disc(g, x - 6, y - 7, 6, '#ffffff77') }
    if (sel) { g.strokeStyle = '#fff'; g.lineWidth = 3; rr(g, OX + sel[1] * CS + 2, OY + sel[0] * CS + 2, CS - 4, CS - 4, 10); g.stroke(); g.lineWidth = 1 }
    drawFx(g, fx)
    txt(g, 'MOVES ' + o.moves, W / 2, 80, 16, '#ffe84a'); if (chain > 1 && state === 'clear') txt(g, 'CHAIN x' + chain, W / 2, 105, 12, '#7dff6a')
  }

  o.draw3 = (r, g) => {
    r.screen(); r.begin('#1a1040', '#090522')
    r.box(0, H - (OY + (N * CS) / 2), 18, N * CS + 22, N * CS + 22, 30, '#1c1250')
    for (let rr2 = 0; rr2 < N; rr2++) for (let c = 0; c < N; c++) { r.box(OX + c * CS + CS / 2 - W / 2, H - (OY + rr2 * CS + CS / 2), 5, CS - 3, CS - 3, 6, (rr2 + c) % 2 ? '#241766' : '#2c1d78', { edge: false }) }
    for (let rr2 = 0; rr2 < N; rr2++) for (let c = 0; c < N; c++) { const gm = grid[rr2][c]; if (!gm) continue; r.gem(OX + c * CS + CS / 2 - W / 2, H - (OY + rr2 * CS + CS / 2 + gm.oy), -4, CS - 10, COLORS[gm.t], { ry: 0.5 + ((rr2 * 3 + c) % 4) * 0.2, glow: 1.12 }) }
    if (sel) r.box(OX + sel[1] * CS + CS / 2 - W / 2, H - (OY + sel[0] * CS + CS / 2), -24, CS - 2, CS - 2, 4, '#ffffff', { alpha: 0.4, edge: false })
    r.fx(fx); r.flush(); txt(g, 'MOVES ' + o.moves, W / 2, 80, 16, '#ffe84a'); if (chain > 1 && state === 'clear') txt(g, 'CHAIN x' + chain, W / 2, 105, 12, '#7dff6a')
  }
  o.cancel=()=>{drag=null}
  return o
}

// ---------------------------------------------------------------- 7. MEMORY FLIP
function memoryFlip() {
  const FACES = ['🍎', '🐶', '🚀', '⭐', '🎈', '🍕', '🐸', '🎲', '🌈', '🦄'], CW = 70, CH = 84, OX = 16, OY = 90
  const o = { score: 0, over: false, label: 'FIND ALL THE PAIRS', moves: 0, time: 0 }
  let cards, open, lock, fx
  o.reset = () => { const a = [...FACES, ...FACES].sort(() => Math.random() - 0.5); cards = a.map((f, i) => ({ f, up: false, done: false, i })); open = []; lock = 0; fx = []; o.moves = 0; o.time = 0; o.score = 0; o.over = false }
  o.down = (x, y) => {
    if (o.over || lock > 0) return
    const c = Math.floor((x - OX) / (CW + 4)), r = Math.floor((y - OY) / (CH + 4)); if (c < 0 || c > 3 || r < 0 || r > 4) return
    const k = cards[r * 4 + c]; if (!k || k.up || k.done) return
    k.up = true; open.push(k)
    if (open.length === 2) { o.moves++; if (open[0].f === open[1].f) { open.forEach((q) => (q.done = true)); open = []; if (cards.every((q) => q.done)) { o.over = true; o.score = Math.max(50, 1500 - o.moves * 25 - Math.floor(o.time) * 5) } } else lock = 0.8 }
  }
  o.update = (dt) => { stepFx(fx, dt); if (!o.over) o.time += dt; if (lock > 0) { lock -= dt; if (lock <= 0) { open.forEach((q) => (q.up = false)); open = [] } } }
  o.draw = (g) => {
    sky(g, '#0f2a2a', '#06120f')
    cards.forEach((k, i) => { const c = i % 4, r = Math.floor(i / 4), x = OX + c * (CW + 4), y = OY + r * (CH + 4); g.fillStyle = k.done ? '#1d5a3a' : k.up ? '#f4f1e6' : '#2a6adf'; rr(g, x, y, CW, CH, 10); g.fill(); if (k.up || k.done) { g.font = '36px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#000'; g.fillText(k.f, x + CW / 2, y + CH / 2 + 2) } else txt(g, '?', x + CW / 2, y + CH / 2, 22, '#ffffff99') })
    txt(g, 'MOVES ' + o.moves + '  ·  ' + Math.floor(o.time) + 's', W / 2, 50, 12, '#9fe0c0')
  }

  o.draw3 = (r, g) => {
    r.screen(); r.begin('#0f2a2a', '#06120f')
    r.box(0, H / 2 - 10, 24, W + 40, H - 40, 20, '#0a1f1c', { edge: false })
    cards.forEach((k, i) => {
      const c = i % 4, rr2 = Math.floor(i / 4), x = OX + c * (CW + 4) + CW / 2 - W / 2, y = H - (OY + rr2 * (CH + 4) + CH / 2)
      const target = k.up || k.done ? Math.PI : 0; k.fa = (k.fa || 0) + (target - (k.fa || 0)) * 0.25
      const face = k.fa > Math.PI / 2
      r.box(x, y, 0, CW, CH, 14, k.done ? '#1d5a3a' : face ? '#f4f1e6' : '#2a6adf', { ry: k.fa })
      if (k.fa > 2.7) r.emoji(x, y, -10, k.f, 44); else if (k.fa < 0.4) r.text(x, y, -10, '?', 26, '#ffffffaa')
    })
    r.flush(); txt(g, 'MOVES ' + o.moves + '  ·  ' + Math.floor(o.time) + 's', W / 2, 50, 12, '#9fe0c0')
  }
  return o
}

// ---------------------------------------------------------------- 8. MOLE SMASH
function moleSmash() {
  const HX = [70, 180, 290], HY = [190, 310, 430]
  const o = { score: 0, over: false, label: 'WHACK THE MOLES · NOT THE BOMBS', time: 45 }
  let holes, t, spawnT, fx, combo
  o.reset = () => { holes = Array.from({ length: 9 }, () => ({ k: null, t: 0, hit: 0 })); t = 45; spawnT = 0.5; fx = []; combo = 0; o.score = 0; o.over = false; o.time = 45 }
  o.down = (x, y) => {
    if (o.over) return
    for (let i = 0; i < 9; i++) { const hx = HX[i % 3], hy = HY[Math.floor(i / 3)]; if (Math.hypot(x - hx, y - hy + 18) < 42) { const h = holes[i]; if (!h.k) return; if (h.k === 'bomb') { o.score = Math.max(0, o.score - 5); combo = 0; puff(fx, hx, hy - 20, 14, '#ff7a2a', 200) } else { combo++; o.score += (h.k === 'gold' ? 5 : 1) + Math.floor(combo / 5); puff(fx, hx, hy - 20, 8, h.k === 'gold' ? '#ffe84a' : '#c98a4a', 160) } h.k = null; h.hit = 0.25; return } }
  }
  o.key = (code) => { const i=Number(code.replace('Digit',''))-1; if(i>=0&&i<9)o.down(HX[i%3],HY[Math.floor(i/3)]-18) }
  o.update = (dt) => {
    stepFx(fx, dt)
    if (o.over) return
    t -= dt; o.time = Math.max(0, Math.ceil(t)); if (t <= 0) { o.over = true; return }
    spawnT -= dt
    if (spawnT <= 0) { const free = holes.map((h, i) => (h.k ? -1 : i)).filter((i) => i >= 0); if (free.length) { const i = pick(free), r = Math.random(); holes[i].k = r < 0.12 ? 'gold' : r < 0.26 ? 'bomb' : 'mole'; holes[i].t = Math.max(0.55, 1.15 - (45 - t) * 0.012) } spawnT = Math.max(0.25, 0.7 - (45 - t) * 0.01) }
    for (const h of holes) { if (h.k) { h.t -= dt; if (h.t <= 0) { if (h.k !== 'bomb') combo = 0; h.k = null } } if (h.hit > 0) h.hit -= dt }
  }
  o.draw = (g) => {
    sky(g, '#2f7a2f', '#164416')
    for (let i = 0; i < 9; i++) { const hx = HX[i % 3], hy = HY[Math.floor(i / 3)], h = holes[i]; g.fillStyle = '#2a1608'; g.beginPath(); g.ellipse(hx, hy, 42, 16, 0, 0, TAU); g.fill(); if (h.k) { const up = Math.min(1, (h.t > 0.2 ? 1 : h.t / 0.2)) * 1; g.save(); g.beginPath(); g.rect(hx - 50, hy - 70, 100, 70 + 0); g.clip(); const c = h.k === 'gold' ? '#ffd23a' : h.k === 'bomb' ? '#2a2a2a' : '#a8703a'; disc(g, hx, hy - 20 * up, 30, c); if (h.k === 'bomb') { g.fillStyle = '#ff9a3a'; g.fillRect(hx - 2, hy - 56, 4, 10) } else { disc(g, hx - 10, hy - 28, 4, '#111'); disc(g, hx + 10, hy - 28, 4, '#111'); disc(g, hx, hy - 16, 6, '#e87a7a') } g.restore() } g.fillStyle = '#3a210d'; g.beginPath(); g.ellipse(hx, hy + 4, 42, 12, 0, 0, Math.PI); g.fill() }
    drawFx(g, fx); txt(g, 'TIME ' + o.time, 60, 40, 14, '#fff'); if (combo >= 3) txt(g, 'x' + combo, W - 50, 40, 16, '#ffe84a')
  }

  o.draw3 = (r, g) => {
    r.look(10,365,-490,0,0,15,47);r.begin('#65bdf1','#c7eec2')
    r.floor(-800,-600,800,900,-12,'#9bb89a');r.box(0,-2,15,345,20,425,'#b19b77');r.box(0,8,15,345,3,425,'#72b44c')
    for(let i=0;i<7;i++)r.tree(-260+i*87,0,270+(i%2)*35,125+(i%3)*20,i,'oak','#489844')
    for(let i=-5;i<=5;i++)r.box(i*40,29,245,9,66,10,'#ead5b2')
    r.box(0,37,243,450,7,12,'#d4b98f');r.box(0,12,243,450,7,12,'#d4b98f')
    for(const side of [-1,1])for(let j=0;j<5;j++)flowerPatch(r,side*160,12,-180+j*82,5,j)
    const targets=[]
    for(let i=0;i<9;i++) {
      const x=(i%3-1)*100,z=(Math.floor(i/3)-1)*115,h=holes[i]
      r.cyl(x,9,z,41,5,'#aa8a65');r.cyl(x,14,z,34,1,'#3e3340')
      const center=r.proj([x,31,z]);if(center)targets.push({i,...center})
      if(h.k) {
        const rise=Math.min(1,h.t/.2),yy=14+rise*22
        if(h.k==='bomb'){r.sphere(x,yy,z,24,'#374154');r.line([x,yy+22,z],[x+5,yy+34,z],'#b99571',3);r.sphere(x+5,yy+35,z,5,'#ffb958',{glow:1.6})}
        else moleModel(r,x,yy,z,26,h.k==='gold',r.clock)
      }
      r.text(x,10,z-47,String(i+1),12,'#f9efcf')
    }
    o.mapPointer=(x,y)=>{const nearest=targets.reduce((a,b)=>Math.hypot(x-b.x,y-b.y)<Math.hypot(x-a.x,y-a.y)?b:a,targets[0]);return nearest&&Math.hypot(x-nearest.x,y-nearest.y)<46*nearest.k?[HX[nearest.i%3],HY[Math.floor(nearest.i/3)]-18]:[-100,-100]}
    r.fx(fx,p=>[p.x-W/2,50+(540-p.y)%40,(Math.floor((p.y-100)/120)-1)*115]);r.flush()
    txt(g,'TIME '+o.time,64,32,13,'#294e49');if(combo>=3)txt(g,'COMBO x'+combo,260,32,12,'#895327')
  }
  return o
}

// ---------------------------------------------------------------- 9. IDLE MINER (clicker, never ends)
function idleMiner() {
  const UP = [{ n: 'PICKAXE', d: '+1 per tap', base: 15, g: 1.35 }, { n: 'MINER', d: '+1 ore/s', base: 60, g: 1.4 }, { n: 'DRILL', d: '+8 ore/s', base: 500, g: 1.45 }, { n: 'LUCKY', d: '+5% crit x5', base: 250, g: 1.6 }]
  const o = { score: 0, over: false, label: 'TAP THE ROCK · BUY UPGRADES · IT NEVER ENDS' }
  let ore, total, lv, fx, t, shakeT, floats
  const key = 'si_idle_miner'
  const per = () => 1 + lv[0], auto = () => lv[1] + lv[2] * 8, crit = () => Math.min(0.5, lv[3] * 0.05)
  const cost = (i) => Math.floor(UP[i].base * Math.pow(UP[i].g, lv[i]))
  const save = () => { try { localStorage.setItem(key, JSON.stringify({ ore, total, lv })) } catch { /* ignore */ } }
  o.reset = () => { ore = 0; total = 0; lv = [0, 0, 0, 0]; fx = []; floats = []; t = 0; shakeT = 0; o.over = false; try { const s = JSON.parse(localStorage.getItem(key) || 'null'); if (s) { ore = s.ore; total = s.total; lv = s.lv } } catch { /* ignore */ } o.score = Math.floor(total) }
  o.down = (x, y) => {
    if (y > 330) { for (let i = 0; i < 4; i++) { const yy = 346 + i * 48; if (y > yy && y < yy + 42 && ore >= cost(i)) { ore -= cost(i); lv[i]++; puff(fx, W / 2, yy + 20, 12, '#ffe84a', 160); save(); return } } return }
    let v = per(); const c = Math.random() < crit(); if (c) v *= 5
    ore += v; total += v; shakeT = 0.1; puff(fx, x, y, c ? 12 : 5, c ? '#ffe84a' : '#b9a58a', 150); floats.push({ x, y, v, c, l: 0.7 }); o.score = Math.floor(total)
  }
  o.update = (dt) => {
    stepFx(fx, dt); t += dt; shakeT = Math.max(0, shakeT - dt)
    const a = auto() * dt; ore += a; total += a; o.score = Math.floor(total)
    for (const f of floats) { f.l -= dt; f.y -= 40 * dt } for (let i = floats.length - 1; i >= 0; i--) if (floats[i].l <= 0) floats.splice(i, 1)
    if (Math.floor(t) % 5 === 0 && Math.floor(t * 10) % 10 === 0) save()
  }
  o.draw = (g) => {
    sky(g, '#3a2a1a', '#150e08')
    const s = 1 + shakeT * 1.2
    g.save(); g.translate(W / 2, 190); g.scale(s, s); g.fillStyle = '#6b5b4a'; g.beginPath(); g.moveTo(-90, 70); g.lineTo(-70, -20); g.lineTo(-20, -70); g.lineTo(40, -60); g.lineTo(85, -10); g.lineTo(95, 70); g.closePath(); g.fill(); g.fillStyle = '#85735e'; g.beginPath(); g.moveTo(-60, 60); g.lineTo(-45, -10); g.lineTo(-10, -50); g.lineTo(10, 60); g.fill(); disc(g, 30, 10, 11, '#ffd23a'); disc(g, -30, 25, 8, '#3de8ff'); disc(g, 50, 40, 7, '#ff6a8a'); g.restore()
    txt(g, '⛏ ' + Math.floor(ore), W / 2, 40, 22, '#ffe84a'); txt(g, per() + ' per tap · ' + auto() + '/s', W / 2, 72, 10, '#d9c7a6')
    for (let i = 0; i < 4; i++) { const yy = 346 + i * 48, can = ore >= cost(i); g.fillStyle = can ? '#2a6a2a' : '#2b2118'; rr(g, 14, yy, W - 28, 42, 8); g.fill(); txt(g, UP[i].n + ' LV' + lv[i], 24, yy + 15, 10, '#fff', 'left'); txt(g, UP[i].d, 24, yy + 31, 8, '#cdbba0', 'left'); txt(g, '⛏ ' + cost(i), W - 24, yy + 21, 11, can ? '#ffe84a' : '#887', 'right') }
    drawFx(g, fx); for (const f of floats) { g.globalAlpha = clamp(f.l * 2, 0, 1); txt(g, '+' + f.v, f.x, f.y, f.c ? 18 : 12, f.c ? '#ffe84a' : '#fff'); g.globalAlpha = 1 }
  }

  o.draw3 = (r, g) => {
    r.screen(); r.begin('#3a2a1a', '#150e08')
    r.box(0, H - 150, 70, W + 80, 360, 20, '#24180e', { edge: false }); r.floor(-400, -200, 400, 300, H - 290, '#3a2a1a')
    const s2 = 1 + shakeT * 1.2, base = H - 250
    r.gem(-24,base+58,0,145*s2,'#7c8192',{ry:.4});r.gem(43,base+37,-20,102*s2,'#9494a0',{ry:-.35});r.gem(-15,base+117,12,86*s2,'#a3a4ae',{ry:.6})
    for(const side of [-1,1])r.box(side*140,base+85,45,13,205,14,'#a58871');r.box(0,base+185,45,300,16,18,'#bb9b7d')
    for(let i=0;i<5;i++)r.gem(-55+i*25,base+32+(i%3)*28,-65,14+(i%2)*5,['#efc770','#85cddb','#c7a5e3'][i%3],{ry:i*.7})
    for(const side of [-1,1])lanternModel(r,side*134,base+152,20,10)
    o.mapPointer=(x,y)=>y>330?[x,y]:r.boardPoint?.(x,y)||[x,y]
    r.sphere(40, base + 70, -62, 12, '#ffd23a', { glow: 1.3 }); r.sphere(-46, base + 36, -58, 9, '#3de8ff', { glow: 1.3 }); r.sphere(60, base + 20, -58, 8, '#ff6a8a', { glow: 1.3 })
    r.fx(fx); r.flush()
    txt(g, '⛏ ' + Math.floor(ore), W / 2, 40, 22, '#ffe84a'); txt(g, per() + ' per tap · ' + auto() + '/s', W / 2, 72, 10, '#d9c7a6')
    for (let i = 0; i < 4; i++) { const yy = 346 + i * 48, can = ore >= cost(i); g.fillStyle = can ? '#2a6a2a' : '#2b2118'; rr(g, 14, yy, W - 28, 42, 8); g.fill(); g.fillStyle = can ? '#4aa04a' : '#3d3226'; rr(g, 14, yy, W - 28, 6, 3); g.fill(); txt(g, UP[i].n + ' LV' + lv[i], 24, yy + 17, 10, '#fff', 'left'); txt(g, UP[i].d, 24, yy + 32, 8, '#cdbba0', 'left'); txt(g, '⛏ ' + cost(i), W - 24, yy + 22, 11, can ? '#ffe84a' : '#887', 'right') }
    for (const f of floats) { g.globalAlpha = clamp(f.l * 2, 0, 1); txt(g, '+' + f.v, f.x, f.y, f.c ? 18 : 12, f.c ? '#ffe84a' : '#fff'); g.globalAlpha = 1 }
  }
  return o
}

// ---------------------------------------------------------------- 10. TRAFFIC DODGE
function trafficDodge() {
  const LX = [95, 180, 265]
  const o = { score: 0, over: false, label: 'SWIPE OR TAP LEFT / RIGHT TO CHANGE LANE' }
  let lane, px, cars, coins, dist, speed, spawnT, fx, coinN, sx
  o.reset = () => { lane = 1; px = LX[1]; cars = []; coins = []; dist = 0; speed = 260; spawnT = 0.6; fx = []; coinN = 0; sx = null; o.score = 0; o.over = false }
  const go = (d) => { if (!o.over) lane = clamp(lane + d, 0, 2) }
  o.key = (c) => { if (c === 'ArrowLeft' || c === 'KeyA') go(-1); if (c === 'ArrowRight' || c === 'KeyD') go(1) }
  o.down = (x) => { sx = x }
  o.move = (x) => { if (sx !== null && Math.abs(x - sx) > 30) { go(Math.sign(x - sx)); sx = null } }
  o.up = (x) => { if (sx !== null && Math.abs(x - sx) < 12) go(x < W / 2 ? -1 : 1); sx = null }
  o.update = (dt) => {
    stepFx(fx, dt)
    if (o.over) return
    px += (LX[lane] - px) * Math.min(1, dt * 14)
    speed = Math.min(620, 260 + dist * 0.01); dist += speed * dt
    spawnT -= dt
    if (spawnT <= 0) { const l = ri(0, 2); cars.push({ l, y: -80, c: hsl(ri(0, 360), 70, 50) }); if (Math.random() < 0.5) coins.push({ l: (l + ri(1, 2)) % 3, y: -60 }); spawnT = Math.max(0.35, 0.95 - dist * 0.00006) }
    for (const c of cars) c.y += (speed * 0.8) * dt
    for (const c of coins) c.y += speed * 0.8 * dt
    while (cars.length && cars[0].y > H + 90) cars.shift()
    while (coins.length && coins[0].y > H + 30) coins.shift()
    for (const c of cars) if (Math.abs(LX[c.l] - px) < 32 && Math.abs(c.y - (H - 110)) < 62) { o.over = true; puff(fx, px, H - 110, 24, '#ff9a3a', 260) }
    for (let i = coins.length - 1; i >= 0; i--) if (Math.abs(LX[coins[i].l] - px) < 28 && Math.abs(coins[i].y - (H - 110)) < 36) { puff(fx, LX[coins[i].l], coins[i].y, 6, '#ffe84a', 120); coins.splice(i, 1); coinN++ }
    o.score = Math.floor(dist / 15) + coinN * 10
  }
  const car = (g, x, y, c) => { g.fillStyle = c; rr(g, x - 20, y - 36, 40, 72, 10); g.fill(); g.fillStyle = '#0008'; rr(g, x - 14, y - 22, 28, 18, 5); g.fill(); rr(g, x - 14, y + 8, 28, 14, 5); g.fill() }
  o.draw = (g) => {
    sky(g, '#1d1d24', '#0c0c10'); g.fillStyle = '#2b2b33'; g.fillRect(40, 0, W - 80, H)
    g.fillStyle = '#ffd23a'; g.fillRect(36, 0, 4, H); g.fillRect(W - 40, 0, 4, H)
    for (let y = -((dist * 0.8) % 60); y < H; y += 60) { g.fillStyle = '#ffffff55'; g.fillRect(137, y, 4, 30); g.fillRect(221, y, 4, 30) }
    for (const c of coins) disc(g, LX[c.l], c.y, 9, '#ffe84a')
    for (const c of cars) car(g, LX[c.l], c.y, c.c)
    if (!o.over) car(g, px, H - 110, '#3de8ff')
    drawFx(g, fx)
  }

  o.draw3 = (r, g) => {
    const lx = (l) => (LX[l] - W / 2) * 0.9, zOf = (y) => (H - 110 - y) * 2.2
    r.look((px - W / 2) * 0.35, 150, -250, (px - W / 2) * 0.2, 30, 420, 60); r.begin('#16376c', '#88c5f4')
    r.floor(-900, -200, 900, 2600, 0, '#3b4663'); r.floor(-150, -200, 150, 2600, 0.2, '#2b2b33'); r.box(-152, 3, 1200, 6, 6, 3200, '#ffd23a', { edge: false }); r.box(152, 3, 1200, 6, 6, 3200, '#ffd23a', { edge: false })
    for (let z = -((dist * 0.8 * 2.2 / 60) % 1) * 130 - 130; z < 2400; z += 130) for (const sx of [-50, 50]) r.box(sx, 0.6, z, 5, 1, 60, '#ffffffcc', { edge: false })
    for (let k = 0; k < 14; k++) { const z = ((k * 190 - dist * 1.6) % 2660 + 2660) % 2660 - 200; for (const sx of [-260, 260]) { r.tree(sx,0,z,95,k+sx,'oak') } }
    for(let k=0;k<10;k++){const z=((k*260-dist*1.6)%2600+2600)%2600;for(const side of [-1,1]){const x=side*(390+(k%2)*65),h=130+(k%4)*65;r.box(x,h/2,z,110,h,110,['#294473','#416694','#26344e'][k%3]);for(let row=0;row<5;row++)r.box(x,30+row*40,z-56,76,12,2,row%2?'#73d9ff':'#ffdc6c',{glow:1.4});r.box(side*180,8,z,30,16,80,k%2?'#f3e6cb':'#ed614e')}}
    const carBox = (x, z, c) => r.car(x, 0, z, c, 10, dist * 0.08)
    for (const c of coins) r.sphere(lx(c.l), 14, zOf(c.y), 9, '#ffe84a', { glow: 1.2 })
    for (const c of cars) carBox(lx(c.l), zOf(c.y), c.c)
    if (!o.over) { r.shadow((px - W / 2) * 0.9, 0, 26, 0.35); carBox((px - W / 2) * 0.9, 0, '#ee343f') }
    r.fx(fx, (p) => [(px - W / 2) * 0.9 + (p.x - px) * 0.6, 14 + (H - 110 - p.y) * 0.5, 0]); r.flush()
  }
  o.cancel=()=>{sx=null}
  return o
}

// ---------------------------------------------------------------- 11. BLOB ARENA (.io style)
function blobArena() {
  const WW = 1400, WH = 1400
  const o = { score: 0, over: false, label: 'MOVE YOUR FINGER / MOUSE · EAT SMALLER BLOBS · AVOID BIGGER ONES' }
  let me, bots, pellets, aim, fx, t
  const held=new Set()
  const rad = (m) => 10 + Math.sqrt(m) * 2.6
  const mkBot = (i) => ({ x: rnd(100, WW - 100), y: rnd(100, WH - 100), m: rnd(20, 90), c: hsl(i * 47 + 20, 75, 55), vx: 0, vy: 0, think: 0, tx: 0, ty: 0 })
  o.reset = () => { held.clear(); me = { x: WW / 2, y: WH / 2, m: 20, vx: 0, vy: 0 }; bots = Array.from({ length: 14 }, (_, i) => mkBot(i)); pellets = Array.from({ length: 260 }, () => ({ x: rnd(20, WW - 20), y: rnd(20, WH - 20), c: hsl(ri(0, 360), 85, 60) })); aim = { x: 0, y: 0 }; fx = []; t = 0; o.score = 20; o.over = false }
  const setAim = (x, y) => { if(!held.size)aim = { x: x - W / 2, y: H / 2 - y } }
  o.down = setAim; o.move = setAim
  const keyAim=()=>{aim={x:(Number(held.has('ArrowRight'))-Number(held.has('ArrowLeft')))*100,y:(Number(held.has('ArrowUp'))-Number(held.has('ArrowDown')))*100}}
  o.key=c=>{if(c.startsWith('Arrow')){held.add(c);keyAim()}}
  o.keyup=c=>{if(held.delete(c))keyAim()}
  o.cancel=()=>{held.clear();aim={x:0,y:0}}
  const steer = (b, tx, ty, dt, k = 1) => { const dx = tx - b.x, dy = ty - b.y, d = Math.hypot(dx, dy) || 1, sp = (260 / (1 + Math.sqrt(b.m) * 0.07)) * k * Math.min(1, d / 40); b.vx += ((dx / d) * sp - b.vx) * Math.min(1, dt * 6); b.vy += ((dy / d) * sp - b.vy) * Math.min(1, dt * 6); b.x = clamp(b.x + b.vx * dt, 0, WW); b.y = clamp(b.y + b.vy * dt, 0, WH) }
  const eat = (a, b) => a.m > b.m * 1.15 && Math.hypot(a.x - b.x, a.y - b.y) < rad(a.m) - rad(b.m) * 0.4
  o.update = (dt) => {
    stepFx(fx, dt)
    if (o.over) return
    t += dt
    const len = Math.hypot(aim.x, aim.y)
    steer(me, me.x + aim.x * 4, me.y + aim.y * 4, dt, len < 8 ? 0 : 1)
    me.m = Math.max(20, me.m - me.m * 0.0006 * dt * 60 * 0.1)
    for (let i = pellets.length - 1; i >= 0; i--) { const q = pellets[i]; if (Math.hypot(q.x - me.x, q.y - me.y) < rad(me.m)) { me.m += 1.2; pellets.splice(i, 1); pellets.push({ x: rnd(20, WW - 20), y: rnd(20, WH - 20), c: hsl(ri(0, 360), 85, 60) }) } }
    for (const b of bots) {
      b.think -= dt
      if (b.think <= 0) {
        b.think = rnd(0.4, 0.9); let tx = b.x + rnd(-200, 200), ty = b.y + rnd(-200, 200), bd = 1e9, flee = null
        for (const q of pellets) { const d = Math.hypot(q.x - b.x, q.y - b.y); if (d < bd) { bd = d; tx = q.x; ty = q.y } }
        for (const other of [me, ...bots]) { if (other === b) continue; const d = Math.hypot(other.x - b.x, other.y - b.y); if (d < 260) { if (other.m > b.m * 1.2) flee = other; else if (b.m > other.m * 1.25 && d < bd * 1.5) { tx = other.x; ty = other.y; bd = d / 1.5 } } }
        if (flee) { tx = b.x - (flee.x - b.x); ty = b.y - (flee.y - b.y) }
        b.tx = tx; b.ty = ty
      }
      steer(b, b.tx, b.ty, dt, 0.92)
      for (let i = pellets.length - 1; i >= 0; i--) { const q = pellets[i]; if (Math.hypot(q.x - b.x, q.y - b.y) < rad(b.m)) { b.m += 1.2; pellets.splice(i, 1); pellets.push({ x: rnd(20, WW - 20), y: rnd(20, WH - 20), c: hsl(ri(0, 360), 85, 60) }) } }
    }
    for (let i = 0; i < bots.length; i++) {
      const b = bots[i]
      if (eat(me, b)) { me.m += b.m * 0.8; puff(fx, b.x, b.y, 14, b.c, 200); bots[i] = mkBot(i); bots[i].m = rnd(15, 60); bots[i].x = Math.random() < 0.5 ? 30 : WW - 30; continue }
      if (eat(b, me)) { o.over = true; puff(fx, me.x, me.y, 30, '#3de8ff', 260); continue }
      for (let j = 0; j < bots.length; j++) { const c = bots[j]; if (c !== b && eat(b, c)) { b.m += c.m * 0.8; bots[j] = mkBot(j); bots[j].x = Math.random() < 0.5 ? 30 : WW - 30 } }
    }
    o.score = Math.floor(me.m)
  }
  o.draw = (g) => {
    g.fillStyle = '#0b1230'; g.fillRect(0, 0, W, H)
    const k = clamp(46 / rad(me.m) * 0.9 + 0.35, 0.45, 1.1)
    g.save(); g.translate(W / 2, H / 2); g.scale(k, k); g.translate(-me.x, -me.y)
    g.strokeStyle = '#ffffff12'; g.lineWidth = 1; for (let x = 0; x <= WW; x += 70) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, WH); g.stroke() } for (let y = 0; y <= WH; y += 70) { g.beginPath(); g.moveTo(0, y); g.lineTo(WW, y); g.stroke() }
    g.strokeStyle = '#ff4de1'; g.lineWidth = 4; g.strokeRect(0, 0, WW, WH)
    for (const q of pellets) { if (Math.abs(q.x - me.x) > 400 / k || Math.abs(q.y - me.y) > 520 / k) continue; disc(g, q.x, q.y, 5, q.c) }
    const all = [...bots.map((b) => ({ ...b, bot: 1 })), { ...me, c: '#3de8ff', me: 1 }].sort((a, b) => a.m - b.m)
    for (const b of all) { const r = rad(b.m); disc(g, b.x, b.y, r, b.c); disc(g, b.x - r * 0.3, b.y - r * 0.3, r * 0.22, '#ffffff55'); if (b.me) { g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.arc(b.x, b.y, r, 0, TAU); g.stroke() } }
    drawFx(g, fx); g.restore()
    txt(g, 'MASS ' + Math.floor(me.m), 70, 24, 11, '#fff', 'center')
  }

  o.draw3 = (r, g) => {
    const k = clamp(46 / rad(me.m) * 0.9 + 0.35, 0.45, 1.1), dist2 = 520 / k
    r.look(me.x, dist2 * 0.85, me.y - dist2 * 0.55, me.x, 0, me.y + 40, 50); r.begin('#07102a', '#0b1230')
    // Map pointer rays onto the blob's plane; screen up points deeper into this scene.
    o.mapPointer=(x,y)=>{const hit=r.pickGround(x,y,rad(me.m)*.8);return hit?[W/2+hit[0]-me.x,H/2-(hit[1]-me.y)]:[W/2,H/2]}
    r.floor(0, 0, WW, WH, 0, '#0d1838')
    for (let x = 0; x <= WW; x += 70) r.line([x, 0.5, 0], [x, 0.5, WH], '#ffffff22', 1)
    for (let y = 0; y <= WH; y += 70) r.line([0, 0.5, y], [WW, 0.5, y], '#ffffff22', 1)
    r.box(WW / 2, 12, -6, WW + 24, 24, 12, '#ff4de1', { glow: 1.1, edge: false }); r.box(WW / 2, 12, WH + 6, WW + 24, 24, 12, '#ff4de1', { glow: 1.1, edge: false }); r.box(-6, 12, WH / 2, 12, 24, WH + 24, '#ff4de1', { glow: 1.1, edge: false }); r.box(WW + 6, 12, WH / 2, 12, 24, WH + 24, '#ff4de1', { glow: 1.1, edge: false })
    for (const q of pellets) { if (Math.abs(q.x - me.x) > 460 / k || Math.abs(q.y - me.y) > 600 / k) continue; r.sphere(q.x, 5, q.y, 5, q.c, { shine: false, glow: 1.2 }) }
    const all = [...bots.map((b) => ({ ...b })), { ...me, c: '#3de8ff', me: 1 }]
    for (const b of all) { const rd = rad(b.m); r.shadow(b.x, b.y, rd * 1.05, 0.3); r.ellipsoid(b.x,rd*.8,b.y,rd,rd*(.82+Math.sin(t*4+b.m)*.035),rd,b.c); for(const side of [-1,1]) {r.sphere(b.x+side*rd*.3,rd*1.12,b.y-rd*.78,rd*.18,'#ffffff');r.sphere(b.x+side*rd*.3,rd*1.12,b.y-rd*.94,rd*.09,'#293247')} if(b.me)r.text(b.x,rd*2.2,b.y,'YOU',12,'#ffffff') }
    r.fx(fx, (p) => [p.x, 20 + (p.y % 10), p.y]); r.flush(); txt(g, 'MASS ' + Math.floor(me.m), 70, 24, 11, '#fff', 'center')
  }
  return o
}

// ---------------------------------------------------------------- 12. BLOCK PUZZLE (1010 style)
function blockPuzzle() {
  const N = 8, CS = 38, OX = (W - N * CS) / 2, OY = 70
  const SHAPES = [[[1]], [[1, 1]], [[1], [1]], [[1, 1, 1]], [[1], [1], [1]], [[1, 1, 1, 1]], [[1], [1], [1], [1]], [[1, 1], [1, 1]], [[1, 1, 1], [1, 1, 1], [1, 1, 1]], [[1, 0], [1, 1]], [[0, 1], [1, 1]], [[1, 1], [1, 0]], [[1, 1], [0, 1]], [[1, 0, 0], [1, 0, 0], [1, 1, 1]], [[1, 1, 1], [0, 0, 1], [0, 0, 1]], [[1, 1, 1], [0, 1, 0]], [[1, 1, 1, 1, 1]]]
  const COL = ['#ff5a6a', '#ffd23a', '#3de8ff', '#7dff6a', '#b27aff', '#ff9a3a']
  const o = { score: 0, over: false, label: 'DRAG PIECES ONTO THE BOARD · FILL ROWS AND COLUMNS' }
  let grid, tray, drag, combo, fx
  const fits = (sh, r, c) => sh.every((row, y) => row.every((v, x) => !v || (r + y >= 0 && r + y < N && c + x >= 0 && c + x < N && !grid[r + y][c + x])))
  const canAny = () => tray.some((p) => p && (() => { for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (fits(p.sh, r, c)) return true; return false })())
  const deal = () => { tray = [0, 1, 2].map(() => ({ sh: pick(SHAPES), c: ri(0, 5) })) }
  const slot = (i) => ({ x: 20 + i * 112, y: 420, w: 100, h: 100 })
  o.reset = () => { grid = Array.from({ length: N }, () => Array(N).fill(0)); deal(); drag = null; combo = 0; fx = []; o.score = 0; o.over = false }
  o.down = (x, y) => { if (o.over) return; for (let i = 0; i < 3; i++) { const s = slot(i); if (tray[i] && x > s.x && x < s.x + s.w && y > s.y - 20 && y < s.y + s.h + 20) { drag = { i, x, y } ; return } } }
  o.move = (x, y) => { if (drag) { drag.x = x; drag.y = y } }
  const target = () => { const p = tray[drag.i], cw = p.sh[0].length, ch = p.sh.length; return { r: Math.round((drag.y - 70 - ch * CS / 2 - OY) / CS), c: Math.round((drag.x - cw * CS / 2 - OX) / CS) } }
  o.up = () => {
    if (!drag) return
    const p = tray[drag.i], t = target()
    if (fits(p.sh, t.r, t.c)) {
      let cells = 0
      p.sh.forEach((row, y) => row.forEach((v, x) => { if (v) { grid[t.r + y][t.c + x] = p.c + 1; cells++ } }))
      const rows = [], cols = []
      for (let r = 0; r < N; r++) if (grid[r].every((v) => v)) rows.push(r)
      for (let c = 0; c < N; c++) if (grid.every((row) => row[c])) cols.push(c)
      for (const r of rows) for (let c = 0; c < N; c++) { puff(fx, OX + c * CS + CS / 2, OY + r * CS + CS / 2, 3, COL[(grid[r][c] - 1) % 6], 120); grid[r][c] = 0 }
      for (const c of cols) for (let r = 0; r < N; r++) { if (grid[r][c]) puff(fx, OX + c * CS + CS / 2, OY + r * CS + CS / 2, 3, COL[(grid[r][c] - 1) % 6], 120); grid[r][c] = 0 }
      const lines = rows.length + cols.length
      combo = lines ? combo + 1 : 0
      o.score += cells + lines * 10 * lines + (combo > 1 ? combo * 5 : 0)
      tray[drag.i] = null
      if (tray.every((q) => !q)) deal()
      if (!canAny()) o.over = true
    }
    drag = null
  }
  o.update = (dt) => stepFx(fx, dt)
  const piece = (g, sh, c, x, y, cs, a = 1) => { g.globalAlpha = a; sh.forEach((row, yy) => row.forEach((v, xx) => { if (v) { g.fillStyle = COL[c % 6]; rr(g, x + xx * cs + 1, y + yy * cs + 1, cs - 2, cs - 2, 5); g.fill() } })); g.globalAlpha = 1 }
  o.draw = (g) => {
    sky(g, '#17224f', '#0a1030')
    g.fillStyle = '#0006'; rr(g, OX - 5, OY - 5, N * CS + 10, N * CS + 10, 10); g.fill()
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { g.fillStyle = grid[r][c] ? COL[(grid[r][c] - 1) % 6] : '#ffffff10'; rr(g, OX + c * CS + 1, OY + r * CS + 1, CS - 2, CS - 2, 5); g.fill() }
    if (drag) { const p = tray[drag.i], t = target(); if (fits(p.sh, t.r, t.c)) piece(g, p.sh, p.c, OX + t.c * CS, OY + t.r * CS, CS, 0.35) }
    for (let i = 0; i < 3; i++) { const p = tray[i], s = slot(i); if (!p || (drag && drag.i === i)) continue; const cs = 24, w = p.sh[0].length * cs, h = p.sh.length * cs; piece(g, p.sh, p.c, s.x + (s.w - w) / 2, s.y + (s.h - h) / 2, cs) }
    if (drag) { const p = tray[drag.i], cw = p.sh[0].length * CS, ch = p.sh.length * CS; piece(g, p.sh, p.c, drag.x - cw / 2, drag.y - 70 - ch / 2, CS) }
    drawFx(g, fx); txt(g, 'SCORE ' + Math.floor(o.score), W / 2, 32, 14, '#ffe84a'); if (combo > 1) txt(g, 'COMBO x' + combo, W / 2, 52, 10, '#7dff6a')
  }

  o.draw3 = (r, g) => {
    r.screen(); r.begin('#17224f', '#0a1030')
    r.box(0, H - (OY + (N * CS) / 2), 14, N * CS + 18, N * CS + 18, 26, '#101a44')
    for (let rr2 = 0; rr2 < N; rr2++) for (let c = 0; c < N; c++) {
      const x = OX + c * CS + CS / 2 - W / 2, y = H - (OY + rr2 * CS + CS / 2)
      if (grid[rr2][c]) r.box(x, y, -4, CS - 3, CS - 3, 20, COL[(grid[rr2][c] - 1) % 6], { glow: 1.08 }); else r.box(x, y, 4, CS - 4, CS - 4, 6, '#16215a', { edge: false })
    }
    const cube = (sh, c, x0, y0, cs, z, alpha = 1) => sh.forEach((row, yy) => row.forEach((v, xx) => { if (v) r.box(x0 + xx * cs + cs / 2 - W / 2, H - (y0 + yy * cs + cs / 2), z, cs - 3, cs - 3, cs * 0.55, COL[c % 6], { alpha, glow: 1.1 }) }))
    if (drag) { const pc = tray[drag.i], tg = target(); if (fits(pc.sh, tg.r, tg.c)) cube(pc.sh, pc.c, OX + tg.c * CS, OY + tg.r * CS, CS, -4, 0.35) }
    for (let i = 0; i < 3; i++) { const pc = tray[i], sl = slot(i); if (!pc || (drag && drag.i === i)) continue; const cs = 24, w = pc.sh[0].length * cs, h = pc.sh.length * cs; cube(pc.sh, pc.c, sl.x + (sl.w - w) / 2, sl.y + (sl.h - h) / 2, cs, -4) }
    if (drag) { const pc = tray[drag.i], cw = pc.sh[0].length * CS, ch = pc.sh.length * CS; cube(pc.sh, pc.c, drag.x - cw / 2, drag.y - 70 - ch / 2, CS, -40) }
    r.fx(fx); r.flush(); txt(g, 'SCORE ' + Math.floor(o.score), W / 2, 32, 14, '#ffe84a'); if (combo > 1) txt(g, 'COMBO x' + combo, W / 2, 52, 10, '#7dff6a')
  }
  o.cancel=()=>{drag=null}
  return o
}

// ---------------------------------------------------------------- 13. COLOR MEMORY (Simon says)
function colorMemory() {
  const PADS = [['#ff5a6a', 40, 120], ['#ffd23a', 190, 120], ['#3de8ff', 40, 270], ['#7dff6a', 190, 270]]
  const o = { score: 0, over: false, label: 'WATCH THE PATTERN, THEN REPEAT IT' }
  let seq, idx, state, timer, lit, fx
  o.reset = () => { seq = []; idx = 0; state = 'wait'; timer = 0.8; lit = -1; fx = []; o.score = 0; o.over = false }
  const press = (i) => { lit = i; timer = 0.28 }
  o.down = (x, y) => {
    if (o.over || state !== 'input') return
    for (let i = 0; i < 4; i++) { const [, px, py] = PADS[i]; if (x > px && x < px + 130 && y > py && y < py + 130) { press(i); state = 'inputlit'; return o._tap(i) } }
  }
  o._tap = (i) => { if (seq[idx] !== i) { o.over = true; return } idx++; if (idx >= seq.length) { o.score = seq.length; state = 'wait'; timer = 0.9 } }
  o.key = (c) => { const m = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, KeyQ: 0, KeyW: 1, KeyA: 2, KeyS: 3 }; if (m[c] !== undefined && state === 'input' && !o.over) { press(m[c]); state = 'inputlit'; o._tap(m[c]) } }
  o.update = (dt) => {
    stepFx(fx, dt)
    if (o.over) return
    timer -= dt
    if (timer > 0) return
    if (lit >= 0) { lit = -1; timer = state === 'show' ? 0.18 : 0.05; if (state === 'inputlit') state = 'input'; return }
    if (state === 'wait') { seq.push(ri(0, 3)); idx = 0; state = 'show'; o._si = 0; timer = 0.1; return }
    if (state === 'show') { if (o._si < seq.length) { press(seq[o._si]); o._si++; timer = 0.5 } else { state = 'input'; idx = 0 } }
  }
  o.draw = (g) => {
    sky(g, '#1a1a2e', '#0a0a14')
    PADS.forEach(([c, x, y], i) => { g.globalAlpha = lit === i ? 1 : 0.35; g.fillStyle = c; rr(g, x, y, 130, 130, 24); g.fill(); g.globalAlpha = 1; if (lit === i) { g.strokeStyle = '#fff'; g.lineWidth = 4; rr(g, x, y, 130, 130, 24); g.stroke(); g.lineWidth = 1 } })
    txt(g, 'ROUND ' + (seq.length || 1), W / 2, 60, 18, '#fff'); txt(g, state === 'show' ? 'WATCH…' : state === 'wait' ? 'GET READY' : o.over ? 'WRONG!' : 'YOUR TURN', W / 2, 90, 11, '#ffe84a')
    txt(g, 'KEYS 1 2 3 4', W / 2, 460, 8, '#667')
  }

  o.draw3 = (r, g) => {
    r.screen(); r.begin('#1a1a2e', '#0a0a14')
    r.box(0, H - 270, 18, 300, 300, 24, '#14142a')
    PADS.forEach(([c, x, y], i) => { const on = lit === i; r.box(x + 65 - W / 2, H - (y + 65) - (on ? 6 : 0), on ? 8 : -2, 124, 124, on ? 14 : 30, c, { glow: on ? 1.5 : 0.65 }); if (on) r.sphere(x + 65 - W / 2, H - (y + 65), -30, 50, c, { alpha: 0.25, glow: 1.6, shine: false }) })
    r.flush(); txt(g, 'ROUND ' + (seq.length || 1), W / 2, 60, 18, '#fff'); txt(g, state === 'show' ? 'WATCH…' : state === 'wait' ? 'GET READY' : o.over ? 'WRONG!' : 'YOUR TURN', W / 2, 90, 11, '#ffe84a'); txt(g, 'KEYS 1 2 3 4', W / 2, 460, 8, '#667')
  }
  return o
}

// ---------------------------------------------------------------- 14. LAKE FISHING
function lakeFishing() {
  const SURF = 110
  const o = { score: 0, over: false, label: 'MOVE TO AIM · HOLD TO DROP THE HOOK · RELEASE TO REEL IN', time: 60 }
  let hook, fish, t, down, fx, spawnT, held, line
  const KINDS = [['🐟', 10, '#7ad0ff', 18], ['🐠', 25, '#ffb02e', 16], ['🐡', 50, '#ffe84a', 20], ['🦑', -30, '#b27aff', 20], ['🥾', -10, '#8a6a4a', 18]]
  o.reset = () => { hook = { x: W / 2, y: SURF, vy: 0, load: null }; fish = []; t = 60; down = false; fx = []; spawnT = 0.2; held = false; line = SURF; o.score = 0; o.over = false; o.time = 60 }
  o.down = (x) => { hook.x = x; held = true }
  o.move = (x) => { hook.x = clamp(x, 20, W - 20) }
  o.up = () => { held = false }
  o.key = (c) => { if (c === 'ArrowLeft') hook.x = clamp(hook.x - 30, 20, W - 20); if (c === 'ArrowRight') hook.x = clamp(hook.x + 30, 20, W - 20); if (c === 'Space') held = !held }
  o.update = (dt) => {
    stepFx(fx, dt)
    if (o.over) return
    t -= dt; o.time = Math.max(0, Math.ceil(t)); if (t <= 0) { o.over = true; return }
    spawnT -= dt
    if (spawnT <= 0) { const k = pick(KINDS.concat(KINDS.slice(0, 2))), dir = Math.random() < 0.5 ? 1 : -1; fish.push({ k, x: dir > 0 ? -30 : W + 30, y: rnd(SURF + 60, H - 60), v: dir * rnd(50, 130), hooked: false }); spawnT = rnd(0.5, 1.1) }
    if (held && !hook.load) hook.vy = Math.min(hook.vy + 700 * dt, 340); else hook.vy = Math.max(hook.vy - 900 * dt, -380)
    hook.y = clamp(hook.y + hook.vy * dt, SURF, H - 30)
    if (hook.load && hook.y <= SURF + 2) { o.score = Math.max(0, o.score + hook.load.k[1]); puff(fx, hook.x, SURF, 10, hook.load.k[2], 150); hook.load = null; hook.vy = 0 }
    for (const f of fish) { if (f.hooked) { f.x = hook.x; f.y = hook.y + 12; continue } f.x += f.v * dt; if (!hook.load && Math.hypot(f.x - hook.x, f.y - (hook.y + 10)) < f.k[3] + 6) { f.hooked = true; hook.load = f; hook.vy = -200; puff(fx, f.x, f.y, 6, '#fff', 90) } }
    for (let i = fish.length - 1; i >= 0; i--) if (fish[i].hooked ? false : (fish[i].x < -60 || fish[i].x > W + 60)) fish.splice(i, 1)
    for (let i = fish.length - 1; i >= 0; i--) if (fish[i].hooked && !hook.load) fish.splice(i, 1)
  }
  o.draw = (g) => {
    sky(g, '#bfe9ff', '#bfe9ff'); g.fillStyle = '#ffd98a'; g.beginPath(); g.arc(300, 50, 28, 0, TAU); g.fill()
    const gr = g.createLinearGradient(0, SURF, 0, H); gr.addColorStop(0, '#3aa0e0'); gr.addColorStop(1, '#0a2a66'); g.fillStyle = gr; g.fillRect(0, SURF, W, H - SURF)
    g.fillStyle = '#8a5a2a'; g.fillRect(hook.x - 40, SURF - 22, 80, 14); g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(hook.x, SURF - 22); g.lineTo(hook.x, SURF - 60); g.lineTo(hook.x + 22, SURF - 24); g.fill()
    g.strokeStyle = '#ffffffaa'; g.beginPath(); g.moveTo(hook.x, SURF - 10); g.lineTo(hook.x, hook.y); g.stroke(); g.fillStyle = '#ddd'; g.fillRect(hook.x - 4, hook.y, 8, 8)
    for (const f of fish) { g.font = f.k[3] * 1.6 + 'px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.save(); g.translate(f.x, f.y); if (f.v < 0 && !f.hooked) g.scale(-1, 1); g.fillText(f.k[0], 0, 0); g.restore() }
    drawFx(g, fx); txt(g, 'TIME ' + o.time, 56, 24, 12, '#07304a'); txt(g, '$' + o.score, W - 50, 24, 14, '#07304a')
  }

  o.draw3 = (r, g) => {
    r.screen(); r.begin('#bfe9ff', '#bfe9ff')
    r.box(0, H - 40, 40, W + 100, 80, 10, '#9fd6f5', { edge: false }); r.sphere(110, H - 50, 36, 28, '#ffd98a', { glow: 1.3, shine: false })
    r.box(0, (H - SURF) / 2 - 6, 60, W + 100, H - SURF, 20, '#0f4a8a', { edge: false })
    r.box(0, (H - SURF) / 2 - 6, 0, W + 100, H - SURF, 30, '#3aa0e0', { alpha: 0.28, edge: false })
    for (let i = 0; i < 8; i++) r.box(-W / 2 + 20 + i * 48, H - SURF - 2 + Math.sin(i + r.clock*2) * 2, 0, 38, 4, 20, '#bfe9ff', { alpha: 0.6, edge: false })
    r.box(hook.x - W / 2, H - SURF + 12, -10, 84, 14, 36, '#8a5a2a'); r.pyramid(hook.x - W / 2, H - SURF + 19, -10, 24, 38, 6, '#ffffff'); r.cyl(hook.x - W / 2 - 24, H - SURF + 19, -10, 4, 22, '#6a4a2a')
    r.person(hook.x-W/2-20,H-SURF+19,-13,'#e6b675',0,2.5,{hair:'#4c3c51',coat:false})
    for(let i=0;i<12;i++){const xx=-170+i*32;r.gem(xx,10,20,20+(i%3)*8,'#647f8c');r.line([xx,5,3],[xx+Math.sin(r.clock+i)*4,35+(i%3)*15,3],'#558d82',3)}
    r.line([hook.x - W / 2, H - SURF - 4, -10], [hook.x - W / 2, H - hook.y, -10], '#ffffffcc', 2); r.box(hook.x - W / 2, H - hook.y - 4, -10, 9, 9, 6, '#dddddd')
    for (const f of fish) fishModel(r,f.x-W/2,H-f.y,-24,f.k[3],KINDS.indexOf(f.k),f.hooked?1:Math.sign(f.v),r.clock)
    r.fx(fx); r.flush(); txt(g, 'TIME ' + o.time, 56, 24, 12, '#07304a'); txt(g, '$' + o.score, W - 50, 24, 14, '#07304a')
  }
  o.cancel=()=>{held=false}
  return o
}

// ---------------------------------------------------------------- 15. HOOP SHOT (flick basketball)
function hoopShot() {
  const o = { score: 0, over: false, label: 'FLICK THE BALL UP TOWARD THE HOOP', time: 60 }
  let ball, hoop, t, sw, fx, streak
  const reset = () => { ball = { x: W / 2, y: H - 70, vx: 0, vy: 0, fly: false, scored: false, passedTop: false, r: 22 } }
  o.reset = () => { reset(); hoop = { x: W / 2, y: 150, dir: 1, w: 80 }; t = 60; sw = null; fx = []; streak = 0; o.score = 0; o.over = false; o.time = 60 }
  o.down = (x, y) => { if (!ball.fly) sw = { x, y, t: performance.now ? 0 : 0, tt: 0 } }
  o.move = (x, y) => { if (sw) { sw.cx = x; sw.cy = y; ball.x = clamp(ball.x, 40, W - 40) } }
  o.up = (x, y) => {
    if (!sw || ball.fly) { sw = null; return }
    const dx = x - sw.x, dy = y - sw.y, dur = Math.max(0.06, sw.tt)
    sw = null
    if (dy > -25) return
    ball.vx = clamp(dx / dur, -500, 500) * 0.9; ball.vy = clamp(dy / dur, -1500, -700); ball.fly = true
  }
  o.update = (dt) => {
    stepFx(fx, dt)
    if (o.over) return
    if (sw) sw.tt += dt
    t -= dt; o.time = Math.max(0, Math.ceil(t)); if (t <= 0) { o.over = true; return }
    if (o.score >= 6) { hoop.x += hoop.dir * (60 + Math.min(120, o.score * 3)) * dt; if (hoop.x > W - 70) hoop.dir = -1; if (hoop.x < 70) hoop.dir = 1 }
    if (!ball.fly) return
    const py = ball.y
    ball.vy += 1500 * dt; ball.x += ball.vx * dt; ball.y += ball.vy * dt
    if (ball.x < ball.r) { ball.x = ball.r; ball.vx *= -0.7 } else if (ball.x > W - ball.r) { ball.x = W - ball.r; ball.vx *= -0.7 }
    const lx = hoop.x - hoop.w / 2, rx = hoop.x + hoop.w / 2
    for (const rimX of [lx, rx]) { const d = Math.hypot(ball.x - rimX, ball.y - hoop.y); if (d < ball.r + 5) { const nx = (ball.x - rimX) / (d || 1), ny = (ball.y - hoop.y) / (d || 1), dot = ball.vx * nx + ball.vy * ny; ball.vx -= 1.7 * dot * nx; ball.vy -= 1.7 * dot * ny; ball.x = rimX + nx * (ball.r + 5); ball.y = hoop.y + ny * (ball.r + 5) } }
    if (py < hoop.y && ball.y >= hoop.y && ball.vy > 0 && ball.x > lx + 6 && ball.x < rx - 6 && !ball.scored) { ball.scored = true; streak++; o.score += streak > 2 ? 3 : 2; puff(fx, hoop.x, hoop.y + 20, 18, '#ffe84a', 200) }
    if (ball.y > H + 40 || (ball.vy > 0 && ball.y > H - 60 && ball.y > hoop.y + 100 && Math.abs(ball.vy) < 400 && false)) { if (!ball.scored) streak = 0; reset() }
  }
  o.draw = (g) => {
    sky(g, '#2a1a3a', '#120a1c')
    g.fillStyle = '#ffffff22'; g.fillRect(hoop.x - 50, hoop.y - 70, 100, 70)
    g.strokeStyle = '#ff6a2a'; g.lineWidth = 6; g.beginPath(); g.moveTo(hoop.x - hoop.w / 2, hoop.y); g.lineTo(hoop.x + hoop.w / 2, hoop.y); g.stroke(); g.lineWidth = 1
    g.strokeStyle = '#ffffff88'; for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(hoop.x - hoop.w / 2 + i * hoop.w / 4, hoop.y); g.lineTo(hoop.x - hoop.w / 2 + 12 + i * (hoop.w - 24) / 4, hoop.y + 38); g.stroke() }
    disc(g, ball.x, ball.y, ball.r, '#ff8a2a'); g.strokeStyle = '#6a2a00'; g.lineWidth = 2; g.beginPath(); g.arc(ball.x, ball.y, ball.r, 0, TAU); g.moveTo(ball.x - ball.r, ball.y); g.lineTo(ball.x + ball.r, ball.y); g.moveTo(ball.x, ball.y - ball.r); g.lineTo(ball.x, ball.y + ball.r); g.stroke(); g.lineWidth = 1
    drawFx(g, fx); txt(g, 'TIME ' + o.time, 56, 24, 12, '#fff'); if (streak > 1) txt(g, 'STREAK x' + streak, W / 2, 30, 12, '#ffe84a')
  }

  o.draw3 = (r, g) => {
    r.screen(); r.begin('#699dd4', '#efd0aa')
    r.floor(-600, -400, 600, 900, 0, '#4a2a1a'); for (let i = -4; i < 5; i++) r.box(i * 70, 0.5, 100, 3, 1, 1400, '#3a2010', { alpha: 0.7, edge: false })
    r.box(0, H / 2 + 40, 120, W + 160, H + 200, 20, '#557894', { edge: false });for(let i=-3;i<=3;i++)r.box(i*80,170,98,3,340,3,'#82a6b9',{edge:false})
    const hx = hoop.x - W / 2, hy = H - hoop.y
    r.cyl(hx,0,58,5,hy+32,'#667b8c');r.box(hx,hy+31,46,7,7,28,'#667b8c')
    r.box(hx, hy + 38, 30, 110, 76, 8, '#ffffff', { alpha: 0.35 }); r.box(hx, hy + 20, 26, 40, 30, 4, '#ff6a2a', { alpha: 0.5, edge: false })
    for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU, rx2 = hoop.w / 2; r.sphere(hx + Math.cos(a) * rx2, hy, 8 + Math.sin(a) * 14, 3.4, '#ff6a2a', { shine: false, glow: 1.2 }) }
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; r.line([hx + Math.cos(a) * hoop.w / 2, hy, 8 + Math.sin(a) * 14], [hx + Math.cos(a) * hoop.w / 3.4, hy - 40, 8 + Math.sin(a) * 6], '#ffffffcc', 1.5) }
    r.shadow(ball.x - W / 2, 0, ball.r, 0.35)
    basketballModel(r,ball.x-W/2,H-ball.y,0,ball.r)
    r.fx(fx); r.flush(); txt(g, 'TIME ' + o.time, 56, 24, 12, '#fff'); if (streak > 1) txt(g, 'STREAK x' + streak, W / 2, 30, 12, '#ffe84a')
  }
  o.cancel=()=>{sw=null}
  return o
}

// ---------------------------------------------------------------- 16. SUMO PUSH
function sumoPush() {
  const AR = 150, CX = W / 2, CY = 270
  const o = { score: 0, over: false, label: 'DRAG TO CHARGE · PUSH THE BOT OUT OF THE RING' }
  let me, bot, aim, round, msgT, fx, state
  const mk = () => { me = { x: CX - 70, y: CY, vx: 0, vy: 0, r: 22 }; bot = { x: CX + 70, y: CY, vx: 0, vy: 0, r: 22 + Math.min(10, round) } }
  o.reset = () => { round = 0; aim = null; fx = []; msgT = 0; state = 'play'; mk(); o.score = 0; o.over = false }
  const setAim = (x, y) => { aim = { x, y } }
  o.down = setAim; o.move = (x,y) => { if(aim)setAim(x,y) }; o.up = () => { aim = null }; o.cancel = o.up
  o.key = (c) => { const m = { ArrowLeft: [CX - 200, CY], ArrowRight: [CX + 200, CY], ArrowUp: [CX, CY - 200], ArrowDown: [CX, CY + 200] }; if (m[c]) aim = { x: m[c][0] + (me.x - CX), y: m[c][1] + (me.y - CY) } }
  o.update = (dt) => {
    stepFx(fx, dt)
    if (o.over) return
    if (state === 'win' || state === 'lose') { msgT -= dt; if (msgT <= 0) { if (state === 'lose') { o.over = true } else { round++; mk(); state = 'play' } } return }
    if (aim) { const dx = aim.x - me.x, dy = aim.y - me.y, d = Math.hypot(dx, dy) || 1; me.vx += (dx / d) * 640 * dt; me.vy += (dy / d) * 640 * dt }
    { const dx = me.x - bot.x, dy = me.y - bot.y, d = Math.hypot(dx, dy) || 1, edge = Math.hypot(bot.x - CX, bot.y - CY); let ax = dx / d, ay = dy / d; if (edge > AR - 55) { ax = (CX - bot.x) / (edge || 1) * 0.8 + ax * 0.5; ay = (CY - bot.y) / (edge || 1) * 0.8 + ay * 0.5 } const k = 380 + round * 45; bot.vx += ax * k * dt; bot.vy += ay * k * dt }
    for (const b of [me, bot]) { b.vx *= Math.pow(0.18, dt); b.vy *= Math.pow(0.18, dt); b.x += b.vx * dt; b.y += b.vy * dt }
    const dx = bot.x - me.x, dy = bot.y - me.y, d = Math.hypot(dx, dy), min = me.r + bot.r
    if (d < min && d > 0) { const nx = dx / d, ny = dy / d, ov = min - d; me.x -= nx * ov / 2; me.y -= ny * ov / 2; bot.x += nx * ov / 2; bot.y += ny * ov / 2; const rv = (bot.vx - me.vx) * nx + (bot.vy - me.vy) * ny; if (rv < 0) { const mm = me.r * me.r, mb = bot.r * bot.r, j = -(1 + 0.9) * rv / (1 / mm + 1 / mb); me.vx -= j * nx / mm; me.vy -= j * ny / mm; bot.vx += j * nx / mb; bot.vy += j * ny / mb; puff(fx, (me.x + bot.x) / 2, (me.y + bot.y) / 2, 5, '#fff', 120) } }
    if (Math.hypot(bot.x - CX, bot.y - CY) > AR + bot.r * 0.4) { state = 'win'; msgT = 1; o.score = round + 1; puff(fx, bot.x, bot.y, 16, '#ffe84a', 200) }
    else if (Math.hypot(me.x - CX, me.y - CY) > AR + me.r * 0.4) { state = 'lose'; msgT = 0.9; puff(fx, me.x, me.y, 16, '#ff6a6a', 200) }
  }
  o.draw = (g) => {
    sky(g, '#2a1408', '#120804')
    g.fillStyle = '#c9a56a'; g.beginPath(); g.arc(CX, CY, AR + 10, 0, TAU); g.fill(); g.fillStyle = '#e8d3a0'; g.beginPath(); g.arc(CX, CY, AR, 0, TAU); g.fill(); g.strokeStyle = '#a2753a'; g.lineWidth = 4; g.beginPath(); g.arc(CX, CY, AR, 0, TAU); g.stroke(); g.lineWidth = 1
    disc(g, bot.x, bot.y, bot.r, '#ff5a6a'); disc(g, bot.x - 6, bot.y - 6, 6, '#ffffff66'); disc(g, me.x, me.y, me.r, '#3de8ff'); disc(g, me.x - 6, me.y - 6, 6, '#ffffff66')
    if (aim) { g.strokeStyle = '#ffffff88'; g.setLineDash([4, 6]); g.beginPath(); g.moveTo(me.x, me.y); g.lineTo(aim.x, aim.y); g.stroke(); g.setLineDash([]) }
    drawFx(g, fx); txt(g, 'WINS ' + (state === 'win' ? round + 1 : round), W / 2, 30, 14, '#fff'); if (state === 'win') txt(g, 'ROUND WON!', W / 2, 90, 16, '#7dff6a'); if (state === 'lose') txt(g, 'KNOCKED OUT', W / 2, 90, 16, '#ff6a6a')
  }

  o.draw3 = (r, g) => {
    r.look(0,350,-540,0,25,0,48); r.begin('#3d6399','#f7ce79')
    o.mapPointer=(x,y)=>{const hit=r.pickGround(x,y,12);return hit?[hit[0]+CX,hit[1]+CY]:[CX,CY]}
    r.floor(-700,-700,700,700,-18,'#a08275')
    r.cyl(0,-16,0,AR+20,24,'#af8461');r.cyl(0,8,0,AR,5,'#e6c79d')
    for(let i=0;i<48;i++){const a=i*TAU/48;r.ellipsoid(Math.cos(a)*AR,14,Math.sin(a)*AR,8,4,5,'#b79a71',{ry:-a})}
    for(const side of [-1,1]) {r.box(side*58,14,0,5,1,35,'#fff2d5');r.cyl(side*190,-16,205,10,145,'#a46f63');r.box(side*190,127,205,26,9,28,'#566981')}
    r.box(0,145,225,440,16,95,'#566981');r.box(0,127,205,405,10,22,'#d9b38b');for(let i=-3;i<=3;i++)r.box(i*50,45,230,38,90,4,'#dac4a6')
    for(const side of [-1,1]){r.box(side*160,73,174,45,75,4,side<0?'#d93c42':'#285acd');r.pyramid(side*160,48,169,20,24,3,'#ffd766');lanternModel(r,side*210,116,145,13)}
    for(let i=-3;i<=3;i++)r.person(i*46,0,195,i%2?'#d6503e':'#3863bd',0,5,{hair:'#633018',coat:false,yaw:Math.PI})
    for(const [b,c,other] of [[bot,'#2852d2',me],[me,'#e93e35',bot]]) {
      const yaw=Math.atan2(other.x-b.x,other.y-b.y)
      wrestlerModel(r,b.x-CX,14,b.y-CY,b.r*3.6,c,yaw,r.clock,Math.hypot(b.vx,b.vy)>12,b===me)
    }
    if(aim)r.line([me.x-CX,16,me.y-CY],[aim.x-CX,16,aim.y-CY],'#ffffff',2)
    r.fx(fx,p=>[p.x-CX,35,p.y-CY]);r.flush()
    txt(g,'ROUND '+(round+1),W/2,28,14,'#25394d');txt(g,'YOU '+o.score,64,H-28,11,'#a4f0ff')
    if(state==='win')txt(g,'RING OUT!',W/2,80,18,'#3a7862');if(state==='lose')txt(g,'KNOCKED OUT',W/2,80,16,'#a93e54')
  }
  o.keyup=(code)=>{if(code.startsWith('Arrow'))aim=null}
  return o
}

// ---------------------------------------------------------------- 17. KNIFE HIT
function knifeHit() {
  const o = { score: 0, over: false, label: 'TAP TO THROW · DO NOT HIT ANOTHER KNIFE' }
  const CX = W / 2, CY = 210, LR = 62
  let stuck, ang, spd, need, thrown, flying, lvl, fx, hitT, wob
  const setup = () => { stuck = []; need = 6 + Math.min(8, lvl * 2); thrown = 0; flying = null; ang = 0; spd = 1.6 + lvl * 0.25; for (let i = 0; i < Math.min(lvl, 4); i++) stuck.push(rnd(0, TAU)) }
  o.reset = () => { lvl = 0; fx = []; hitT = 0; wob = 0; setup(); o.score = 0; o.over = false }
  const throwIt = () => { if (o.over || flying) return; flying = { y: H - 70 } }
  o.down = throwIt; o.key = (c) => { if (c === 'Space') throwIt() }
  o.update = (dt) => {
    stepFx(fx, dt); hitT = Math.max(0, hitT - dt); wob = Math.max(0, wob - dt * 4)
    if (o.over) return
    ang += spd * dt * (lvl % 2 ? -1 : 1) * (1 + 0.5 * Math.sin(performance.now ? 0 : 0))
    if (lvl >= 2) spd += Math.sin(ang * 0.5) * dt * 0.8
    if (flying) {
      flying.y -= 1100 * dt
      if (flying.y <= CY + LR) {
        const a = ((Math.PI / 2 - ang) % TAU + TAU) % TAU // the angle on the log where the knife lands (bottom)
        if (stuck.some((k) => { const d = Math.abs(((k - a + Math.PI) % TAU + TAU) % TAU - Math.PI); return d < 0.17 })) { o.over = true; puff(fx, CX, CY + LR, 20, '#ff6a6a', 260); return }
        stuck.push(a); flying = null; thrown++; o.score++; wob = 1; hitT = 0.12; puff(fx, CX, CY + LR, 6, '#ffe84a', 120)
        if (thrown >= need) { lvl++; o.score += 10; puff(fx, CX, CY, 30, '#7dff6a', 260); setup() }
      }
    }
  }
  o.draw = (g) => {
    sky(g, '#1d1830', '#0b0914')
    g.save(); g.translate(CX + (wob ? Math.sin(wob * 30) * 3 * wob : 0), CY)
    g.rotate(ang)
    for (const a of stuck) { g.save(); g.rotate(a - Math.PI / 2); g.translate(0, LR); g.fillStyle = '#ddd'; g.fillRect(-3, 0, 6, 46); g.fillStyle = '#8a5a2a'; g.fillRect(-5, 46, 10, 20); g.restore() }
    disc(g, 0, 0, LR, '#a2753a'); disc(g, 0, 0, LR - 10, '#c9955a'); disc(g, 0, 0, 14, '#8a5a2a'); g.strokeStyle = '#6a4a1a'; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 36, 0, TAU); g.stroke(); g.lineWidth = 1
    g.restore()
    if (flying) { g.fillStyle = '#ddd'; g.fillRect(CX - 3, flying.y - 46, 6, 46); g.fillStyle = '#8a5a2a'; g.fillRect(CX - 5, flying.y, 10, 20) }
    else if (!o.over) { g.fillStyle = '#ddd'; g.fillRect(CX - 3, H - 116, 6, 46); g.fillStyle = '#8a5a2a'; g.fillRect(CX - 5, H - 70, 10, 20) }
    for (let i = 0; i < need - thrown; i++) { g.fillStyle = '#fff'; g.fillRect(24, H - 40 - i * 14, 14, 6) }
    drawFx(g, fx); txt(g, 'STAGE ' + (lvl + 1), W / 2, 36, 12, '#ffe84a'); txt(g, String(o.score), W / 2, 60, 20, '#fff')
  }

  o.draw3 = (r, g) => {
    r.screen(); r.begin('#1d1830', '#0b0914')
    r.box(0, H / 2, 70, W + 80, H + 80, 16, '#150f24', { edge: false })
    for(const side of [-1,1]){r.tree(side*190,0,90,430,side,'oak','#28774a');lanternModel(r,side*138,450,20,13)}
    const lx = CX - W / 2 + (wob ? Math.sin(wob * 30) * 3 * wob : 0), ly = H - CY
    r.disc(lx, ly, 0, LR, 34, '#a2753a', { top: '#c9955a' })
    for (const a of stuck) { const wa = a + ang, kx = lx + Math.cos(wa) * (LR + 22), ky = ly - Math.sin(wa) * (LR + 22) * -1; void ky; const ex = lx + Math.cos(wa) * (LR + 24), ey = ly - Math.sin(wa) * (LR + 24); r.box(ex, ey, -8, 6, 48, 6, '#e6e6ee', { rz: -(wa + Math.PI / 2) + Math.PI }); void kx }
    r.disc(lx, ly, -2, 14, 6, '#8a5a2a')
    const kn = (y) => { r.box(CX - W / 2, H - y + 24, -8, 6, 50, 6, '#e6e6ee'); r.box(CX - W / 2, H - y - 8, -8, 10, 22, 8, '#8a5a2a') }
    if (flying) kn(flying.y + 50); else if (!o.over) kn(H - 70 + 50)
    for (let i = 0; i < need - thrown; i++) r.box(-W / 2 + 31, 40 + i * 14, -6, 14, 6, 4, '#ffffff', { edge: false })
    r.fx(fx); r.flush(); txt(g, 'STAGE ' + (lvl + 1), W / 2, 36, 12, '#ffe84a'); txt(g, String(o.score), W / 2, 60, 20, '#fff')
  }
  return o
}

// ---------------------------------------------------------------- 18. FRUIT MERGE (drop and combine)
function fruitMerge() {
  const SZ=FRUIT_RADII,COLS=['#ff5a6a','#ff9a3a','#b27aff','#ffd23a','#7dff6a','#ff8ad0','#3de8ff','#5ae07a']
  const {left:L,right:R,bottom:B,top:TOP,spawnY:SPAWN}=FRUIT_BIN
  const o={score:0,over:false,label:'AIM · DROP · LET THE FRUIT SETTLE'}
  let physics,cur,next,x,cool,fx,balls,overT,events,combo,comboTime,rings
  o.reset=()=>{
    physics?.dispose();x=W/2;cur=ri(0,2);next=ri(0,3);cool=0;fx=[];balls=[];overT=0;events=[];combo=0;comboTime=0;rings=[];o.score=0;o.over=false
    physics=createFruitWorld({onMerge:m=>{
      o.score+=m.points;combo=comboTime>0?combo+1:1;comboTime=1.2
      puff(fx,m.x,m.y,12,COLS[Math.min(7,m.kind)],95)
      rings.push({x:m.x,y:m.y,r:SZ[Math.min(7,m.kind)],life:.4})
      events.push({sound:'fruitMerge',arg:Math.min(7,m.kind)})
    },onImpact:strength=>events.push({sound:'fruitLand',arg:strength})})
  }
  const aim=px=>{if(Number.isFinite(px))x=clamp(px,L+SZ[cur],R-SZ[cur])}
  const drop=()=>{
    if(o.over||cool>0||!physics.canDrop(cur,x))return
    physics.spawn(cur,x,SPAWN);cur=next;next=ri(0,3);cool=.48;aim(x);events.push({sound:'fruitDrop'})
  }
  o.down=px=>{aim(px);drop()};o.move=aim
  o.key=c=>{if(c==='ArrowLeft')aim(x-18);if(c==='ArrowRight')aim(x+18);if(c==='Space')drop()}
  o.update=dt=>{
    if(o.over)return
    stepFx(fx,dt);cool=Math.max(0,cool-dt);comboTime=Math.max(0,comboTime-dt)
    for(const ring of rings)ring.life-=dt;rings=rings.filter(r=>r.life>0)
    physics.step(dt);balls=physics.fruits;overT=physics.danger;o.over=physics.over
    o.status=overT>0?'Overflow · '+Math.max(0,2-overT).toFixed(1)+'s to settle':cool>0?'Dropping…':physics.canDrop(cur,x)?'Ready to drop':'Drop lane blocked · move left or right'
  }
  o.drainEvents=()=>events.splice(0)
  o.dispose=()=>physics?.dispose()
  o.draw3=(r,g)=>{
    let guide=null
    r.screen();r.begin('#b4d49c','#f4dfb5')
    r.box(0,H/2,85,W+100,H+100,14,'#d8c9a2',{edge:false})
    for(let i=0;i<8;i++)r.box(-160+i*46,H/2,72,2,H+80,3,'#c5b087',{edge:false})
    r.box(L-W/2-7,(H-B+H-TOP)/2,0,14,B-TOP+12,80,'#976a41')
    r.box(R-W/2+7,(H-B+H-TOP)/2,0,14,B-TOP+12,80,'#976a41')
    r.box(0,H-B-8,0,R-L+28,16,80,'#976a41')
    for(const side of [-1,1])for(const yy of [H-TOP-14,H-B+12])r.sphere(side*(R-L+14)/2,yy,-42,3,'#e4bf67')
    for(const b of balls){
      const pulse=b.merged&&b.age<.25?1+Math.sin(b.age/.25*Math.PI)*.065:1
      fruitModel(r,b.x-W/2,H-b.y,0,b.r*pulse,b.k,r.clock,-b.angle)
    }
    if(!o.over){
      const rd=SZ[cur],target=physics.landing(cur,x),ready=cool===0&&physics.canDrop(cur,x)
      if(ready){r.sphere(target.x-W/2,H-target.y,0,rd,'#97be89',{alpha:.2});guide={from:r.proj([x-W/2,H-SPAWN-rd,0]),to:r.proj([target.x-W/2,H-target.y,0]),radius:rd}}
      fruitModel(r,x-W/2,H-SPAWN,0,rd*(cool>0?.8:1),cur,r.clock)
      fruitModel(r,127,H-38,-5,11,next,r.clock)
    }
    for(const ring of rings){const progress=1-ring.life/.4,rr=ring.r*(1+progress*.55);for(let i=0;i<16;i++){const a=i*TAU/16;r.sphere(ring.x-W/2+Math.cos(a)*rr,H-ring.y+Math.sin(a)*rr,-20,2.4*(1-progress),'#ffef93',{glow:1.5})}}
    r.line([L-W/2,H-TOP,-42],[R-W/2,H-TOP,-42],overT>0?'#e54a49':'#b48368',2)
    r.fx(fx);r.flush()
    if(guide?.from&&guide.to){
      const {from,to,radius}=guide,rr=radius*to.k
      g.save();g.strokeStyle='#4b7658';g.lineWidth=1.2;g.setLineDash([3,5]);g.beginPath();g.moveTo(from.x,from.y+4);g.lineTo(to.x,to.y-rr-3);g.stroke()
      g.setLineDash([3,3]);g.beginPath();g.arc(to.x,to.y,rr,0,TAU);g.stroke();g.restore()
    }
    txt(g,'SCORE',51,23,9,'#635843');txt(g,String(o.score),51,44,19,'#304b3f')
    txt(g,'NEXT',307,17,8,'#635843')
    if(overT>0){txt(g,'OVERFLOW '+Math.max(0,2-overT).toFixed(1)+'s',W/2,TOP-12,11,'#b82435');g.fillStyle='#e34d54';g.fillRect(L,TOP-4,(R-L)*Math.min(1,overT/2),3)}
    if(combo>1&&comboTime>0)txt(g,'CHAIN ×'+combo,W/2,32,12,'#aa4a26')
    txt(g,cool>0?'LET IT DROP':physics.canDrop(cur,x)?'TAP OR SPACE TO DROP':'MOVE TO AN OPEN LANE',W/2,H-10,8,'#635843')
  }
  return o
}

// ---------------------------------------------------------------- 19. DOODLE HOP (endless jumper)
function doodleHop() {
  const o = { score: 0, over: false, label: 'MOVE LEFT / RIGHT · BOUNCE UP THE PLATFORMS' }
  let p, plats, camY, top, tx, fx, keyDir
  const addPlat = (y) => plats.push({ x: rnd(10, W - 70), y, w: 60, k: Math.random() < Math.min(0.35, top * 0.00006) ? 'move' : Math.random() < Math.min(0.2, top * 0.00004) ? 'break' : 'norm', dir: Math.random() < 0.5 ? 1 : -1, gone: false })
  o.reset = () => { p = { x: W / 2, y: H - 100, vy: -620 }; plats = [{ x: W / 2 - 40, y: H - 60, w: 80, k: 'norm', dir: 1, gone: false }]; camY = 0; top = 0; tx = W / 2; fx = []; keyDir = 0; for (let y = H - 140; y > -H; y -= 70) addPlat(y); o.score = 0; o.over = false }
  o.down = (x) => { tx = x }; o.move = (x) => { tx = x }
  o.key = (c) => { if (c === 'ArrowLeft') tx = Math.max(0, p.x - 80); if (c === 'ArrowRight') tx = Math.min(W, p.x + 80) }
  o.update = (dt) => {
    stepFx(fx, dt)
    if (o.over) return
    p.x += (tx - p.x) * Math.min(1, dt * 9); if (p.x < -10) p.x = W + 10; if (p.x > W + 10) p.x = -10
    p.vy += 1500 * dt; p.y += p.vy * dt
    if (p.vy > 0) for (const pl of plats) { if (pl.gone) continue; if (p.x > pl.x - 8 && p.x < pl.x + pl.w + 8 && p.y + 14 >= pl.y && p.y + 14 - p.vy * dt <= pl.y + 6) { p.vy = -740; if (pl.k === 'break') { pl.gone = true; puff(fx, pl.x + 30, pl.y, 8, '#c9955a', 120) } else puff(fx, p.x, pl.y, 4, '#fff', 80); break } }
    for (const pl of plats) if (pl.k === 'move' && !pl.gone) { pl.x += pl.dir * 70 * dt; if (pl.x < 4 || pl.x + pl.w > W - 4) pl.dir *= -1 }
    const hy = H * 0.4; if (p.y - camY < hy) camY = p.y - hy
    top = Math.max(top, -camY)
    o.score = Math.floor(top / 10)
    while (plats[plats.length - 1].y > camY - 100) addPlat(plats[plats.length - 1].y - rnd(60, 68 + Math.min(40, top * 0.01)))
    while (plats[0].y > camY + H + 100) plats.shift()
    if (p.y - camY > H + 40) o.over = true
  }
  o.draw = (g) => {
    sky(g, '#bfe3ff', '#eaf6ff')
    g.save(); g.translate(0, -camY)
    for (const pl of plats) { if (pl.gone) continue; g.fillStyle = pl.k === 'move' ? '#3de8ff' : pl.k === 'break' ? '#c9955a' : '#5ac44a'; rr(g, pl.x, pl.y, pl.w, 12, 6); g.fill() }
    g.fillStyle = '#7a5aff'; rr(g, p.x - 14, p.y - 20, 28, 34, 10); g.fill(); disc(g, p.x - 5, p.y - 8, 4, '#fff'); disc(g, p.x + 5, p.y - 8, 4, '#fff'); disc(g, p.x - 5, p.y - 8, 2, '#111'); disc(g, p.x + 5, p.y - 8, 2, '#111'); g.fillStyle = '#ffb02e'; g.fillRect(p.x - 6, p.y + 14, 12, 6)
    g.restore(); drawFx(g, fx.map((f) => ({ ...f, y: f.y - camY })))
    txt(g, String(o.score), 40, 28, 20, '#0a3a6a', 'left')
  }

  o.draw3 = (r, g) => {
    r.screen(-camY); r.begin('#bfe3ff', '#eaf6ff')
    for (let i = 0; i < 7; i++) { const y = ((i * 190 - camY * 0.4) % 1330 + 1330) % 1330; r.sphere((i * 97) % 500 - 250, 1500 - y - camY - 800 + 600 + camY * 0.6, 160, 48, '#ffffff', { alpha: 0.8, shine: false }) }
    for (const pl of plats) { if (pl.gone) continue; r.box(pl.x + pl.w / 2 - W / 2, H - pl.y - 6, 0, pl.w, 12, 30, pl.k === 'move' ? '#3de8ff' : pl.k === 'break' ? '#c9955a' : '#5ac44a') }
    const px = p.x - W / 2, py = H - p.y
    r.shadow(px, 0, 1, 0)
    r.person(px,py-14,0,'#9277db',p.vy*.008,3.8,{hair:'#342f59',scarf:[1,.67,.38],yaw:Math.PI,coat:true})
    r.fx(fx, (q) => [q.x - W / 2, H - q.y, -8]); r.flush(); txt(g, String(o.score), 40, 28, 20, '#0a3a6a', 'left')
  }
  return o
}

// ---------------------------------------------------------------- 20. TIC-TAC-TOE (gets smarter every round)
function ticTacToe() {
  const o = { score: 0, over: false, label: 'GET THREE IN A ROW · THE BOT LEARNS EACH ROUND' }
  let b, turn, round, msg, msgT
  const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]]
  const win = (bd) => { for (const [a, c, d] of LINES) if (bd[a] && bd[a] === bd[c] && bd[a] === bd[d]) return bd[a]; return bd.every(Boolean) ? 'D' : null }
  const mm = (bd, pl) => { const w = win(bd); if (w === 'O') return 1; if (w === 'X') return -1; if (w === 'D') return 0; let best = pl === 'O' ? -2 : 2; for (let i = 0; i < 9; i++) if (!bd[i]) { bd[i] = pl; const v = mm(bd, pl === 'O' ? 'X' : 'O'); bd[i] = null; best = pl === 'O' ? Math.max(best, v) : Math.min(best, v) } return best }
  const botMove = () => { const free = [...Array(9).keys()].filter((i) => !b[i]); if (Math.random() < Math.max(0, 0.6 - round * 0.15)) return pick(free); let best = -3, bm = free[0]; for (const i of free) { b[i] = 'O'; const v = mm(b, 'X'); b[i] = null; if (v > best || (v === best && Math.random() < 0.3)) { best = v; bm = i } } return bm }
  const fresh = () => { b = Array(9).fill(null); turn = round % 2 === 0 ? 'X' : 'O'; if (turn === 'O') { msgT = 0.4 } }
  o.reset = () => { round = 0; msg = ''; msgT = 0; o.score = 0; o.over = false; fresh() }
  const finishRound = (w) => { if (w === 'X') { o.score += 3 + round; msg = 'YOU WIN!' ; round++ } else if (w === 'D') { o.score += 1; msg = 'DRAW'; round++ } else { msg = 'BOT WINS'; o.over = true } msgT = 1.1; turn = 'wait' }
  o.down = (x, y) => {
    if (o.over || turn !== 'X') return
    const c = Math.floor((x - 30) / 100), r = Math.floor((y - 150) / 100); if (c < 0 || c > 2 || r < 0 || r > 2 || b[r * 3 + c]) return
    b[r * 3 + c] = 'X'; const w = win(b); if (w) finishRound(w); else { turn = 'O'; msgT = 0.45 }
  }
  o.update = (dt) => {
    if (o.over && msgT <= 0) return
    if (msgT > 0) { msgT -= dt; if (msgT <= 0) { if (turn === 'O') { b[botMove()] = 'O'; const w = win(b); if (w) finishRound(w); else turn = 'X' } else if (turn === 'wait' && !o.over) { msg = ''; fresh() } } }
  }
  o.draw = (g) => {
    sky(g, '#12203a', '#08101e')
    g.strokeStyle = '#3de8ff'; g.lineWidth = 6; g.lineCap = 'round'; for (let i = 1; i < 3; i++) { g.beginPath(); g.moveTo(30 + i * 100, 156); g.lineTo(30 + i * 100, 444); g.stroke(); g.beginPath(); g.moveTo(36, 150 + i * 100); g.lineTo(324, 150 + i * 100); g.stroke() }
    b.forEach((v, i) => { const cx = 80 + (i % 3) * 100, cy = 200 + Math.floor(i / 3) * 100; if (v === 'X') { g.strokeStyle = '#ff5a6a'; g.beginPath(); g.moveTo(cx - 28, cy - 28); g.lineTo(cx + 28, cy + 28); g.moveTo(cx + 28, cy - 28); g.lineTo(cx - 28, cy + 28); g.stroke() } else if (v === 'O') { g.strokeStyle = '#ffe84a'; g.beginPath(); g.arc(cx, cy, 30, 0, TAU); g.stroke() } })
    g.lineWidth = 1; txt(g, 'ROUND ' + (round + 1), W / 2, 50, 14, '#fff'); txt(g, turn === 'X' ? 'YOUR MOVE (X)' : turn === 'O' ? 'BOT THINKING…' : msg, W / 2, 90, 12, '#ffe84a'); if (msg) txt(g, msg, W / 2, 480, 18, '#7dff6a')
  }

  o.draw3 = (r, g) => {
    r.screen(); r.begin('#12203a', '#08101e')
    r.box(0, H - 300, 16, 330, 330, 24, '#0e1a30')
    for (const i of [1, 2]) { r.box(30 + i * 100 - W / 2, H - 300, -4, 8, 300, 10, '#3de8ff', { glow: 1.1 }); r.box(0, H - (150 + i * 100), -4, 300, 8, 10, '#3de8ff', { glow: 1.1 }) }
    b.forEach((v, i) => { const cx = 80 + (i % 3) * 100 - W / 2, cy = H - (200 + Math.floor(i / 3) * 100); if (v === 'X') { r.box(cx, cy, -16, 14, 70, 14, '#ff5a6a', { rz: 0.785 }); r.box(cx, cy, -16, 14, 70, 14, '#ff5a6a', { rz: -0.785 }) } else if (v === 'O') for (let k = 0; k < 14; k++) { const a = (k / 14) * TAU; r.sphere(cx + Math.cos(a) * 28, cy + Math.sin(a) * 28, -16, 7.5, '#ffe84a', { shine: false }) } })
    r.flush(); txt(g, 'ROUND ' + (round + 1), W / 2, 50, 14, '#fff'); txt(g, turn === 'X' ? 'YOUR MOVE (X)' : turn === 'O' ? 'BOT THINKING…' : msg, W / 2, 90, 12, '#ffe84a'); if (msg) txt(g, msg, W / 2, 480, 18, '#7dff6a')
  }
  return o
}

// ---------------------------------------------------------------- 21. PONG DUEL
function pongDuel() {
  const o = { score: 0, over: false, label: 'DRAG OR USE ARROW KEYS · FIRST TO 7 WINS' }
  const PW = 80
  let me, bot, ball, bs, mx, fx, serve, lose
  const reset = (dir) => { ball = { x: W / 2, y: H / 2, vx: rnd(-120, 120), vy: dir * 280 }; serve = 0.7 }
  o.reset = () => { me = W / 2; bot = W / 2; bs = 0; lose = 0; mx = W / 2; fx = []; o.score = 0; o.over = false; o.won=false; reset(1) }
  o.down = (x) => { mx = x }; o.move = (x) => { mx = x }
  o.key = (c) => { if (c === 'ArrowLeft') mx -= 50; if (c === 'ArrowRight') mx += 50 }
  o.update = (dt) => {
    stepFx(fx, dt)
    if (o.over) return
    me += (clamp(mx, PW / 2, W - PW / 2) - me) * Math.min(1, dt * 18)
    if (serve > 0) { serve -= dt; return }
    const sp = Math.hypot(ball.vx, ball.vy); const tgt = ball.vy < 0 ? ball.x : W / 2
    bot += clamp(tgt - bot, -(150 + o.score * 14) * dt, (150 + o.score * 14) * dt); bot = clamp(bot, PW / 2, W - PW / 2)
    const previousY=ball.y, previousX=ball.x
    ball.x += ball.vx * dt; ball.y += ball.vy * dt
    const crossingX=(y)=>previousX+(ball.x-previousX)*clamp((y-previousY)/(ball.y-previousY||1),0,1)
    if (ball.x < 8) { ball.x = 8; ball.vx = Math.abs(ball.vx) } if (ball.x > W - 8) { ball.x = W - 8; ball.vx = -Math.abs(ball.vx) }
    if (ball.vy > 0 && previousY <= H - 56 && ball.y >= H - 56 && Math.abs(crossingX(H-56) - me) < PW / 2 + 8) { const off = (ball.x - me) / (PW / 2); ball.vy = -Math.min(900, sp * 1.05 + 14); ball.vx = off * 320 + ball.vx * 0.2; ball.y = H - 56; puff(fx, ball.x, ball.y, 4, '#3de8ff', 80); o.score += 0 }
    if (ball.vy < 0 && previousY >= 56 && ball.y <= 56 && Math.abs(crossingX(56) - bot) < PW / 2 + 8) { const off = (ball.x - bot) / (PW / 2); ball.vy = Math.min(900, sp * 1.02 + 10); ball.vx = off * 300; ball.y = 56; puff(fx, ball.x, ball.y, 4, '#ff5a6a', 80) }
    if (ball.y < 0) { o.score++; puff(fx, ball.x, 6, 12, '#ffe84a', 180); if(o.score>=7){o.won=true;o.over=true}else reset(1) }
    else if (ball.y > H) { bs++; puff(fx, ball.x, H - 6, 12, '#ff6a6a', 180); if (bs >= 7) o.over = true; else reset(-1) }
  }
  o.draw = (g) => {
    sky(g, '#0a2a1a', '#04140c'); g.strokeStyle = '#ffffff22'; g.setLineDash([10, 10]); g.beginPath(); g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.stroke(); g.setLineDash([])
    g.fillStyle = '#ff5a6a'; rr(g, bot - PW / 2, 36, PW, 12, 6); g.fill(); g.fillStyle = '#3de8ff'; rr(g, me - PW / 2, H - 48, PW, 12, 6); g.fill()
    disc(g, ball.x, ball.y, 8, '#fff'); drawFx(g, fx); txt(g, 'YOU ' + o.score, 50, H / 2 - 20, 12, '#3de8ff', 'center'); txt(g, 'BOT ' + bs + '/7', W - 50, H / 2 + 20, 12, '#ff5a6a', 'center')
  }

  o.draw3 = (r, g) => {
    // near paddle sits ~one focal length from the camera so it follows the finger 1:1; the table recedes in perspective
    const zOf = (y) => (H - y) * 1.0 - 40
    r.look(0, 520, -350, 0, 0, 230, 48); r.begin('#231242', '#07152e')
    r.box(0, -14, 330, W + 70, 28, 940, '#17294d'); r.box(0, 0.5, 330, W, 1, 860, '#19233e', { edge: false })
    r.box(0, 0.8, 330, W - 20, 1, 4, '#ffffff55', { edge: false })
    r.box(-W / 2 - 8, 14, 330, 16, 28, 880, '#2a3a78'); r.box(W / 2 + 8, 14, 330, 16, 28, 880, '#2a3a78')
    for(const side of [-1,1]){r.box(side*(W/2+8),30,330,6,4,880,side<0?'#ff4674':'#39dfff',{glow:2});for(let i=0;i<5;i++)r.box(side*235,20+i*18,590+i*10,40,12,18,side<0?'#dc3b73':'#246fbb')}
    robotModel(r,0,14,610,3,r.clock)
    const bz = zOf(ball.y); r.shadow(ball.x - W / 2, bz, 8, 0.4, 1)
    r.box(bot - W / 2, 8, zOf(42), PW, 14, 14, '#ff5a6a', { glow: 1.1 }); r.box(me - W / 2, 8, zOf(H - 42), PW, 14, 14, '#3de8ff', { glow: 1.1 })
    o.mapPointer=(x,y)=>{const hit=r.pickGround(x,y,8);return hit?[hit[0]+W/2,y]:[W/2,y]}
    r.sphere(ball.x - W / 2, 10, bz, 9, '#ffffff'); r.fx(fx, (p) => [p.x - W / 2, 10, zOf(p.y)]); r.flush()
    txt(g, 'YOU ' + o.score, 50, H / 2 + 120, 12, '#3de8ff', 'center'); txt(g, 'BOT ' + bs + '/7', W - 56, 60, 12, '#ff5a6a', 'center')
  }
  return o
}

// ---------------------------------------------------------------- 22. ARCHERY
function archery() {
  const o = { score: 0, over: false, label: 'DRAG BACK TO AIM AND SET POWER · RELEASE TO SHOOT', arrows: 10 }
  const BX = 54, BY = 400
  let arrow, aim, tgt, wind, fx, last
  const newTarget = () => { tgt = { x: rnd(240, 330), y: rnd(130, 360), vy: o.score > 40 ? rnd(-60, 60) : 0, r: 34 } ; wind = rnd(-60, 60) }
  o.reset = () => { arrow = null; aim = null; fx = []; last = ''; o.arrows = 10; o.score = 0; o.over = false; newTarget() }
  o.down = (x, y) => { if (!arrow && !o.over) aim = { x, y } }
  o.move = (x, y) => { if (aim) { aim.x = x; aim.y = y } }
  o.up = () => {
    if (!aim || arrow || o.over) { aim = null; return }
    const dx = BX - aim.x, dy = BY - aim.y, pw = clamp(Math.hypot(dx, dy), 20, 140)
    aim = null; if (Math.hypot(dx, dy) < 18) return
    const a = Math.atan2(dy, dx); arrow = { x: BX, y: BY, vx: Math.cos(a) * pw * 7.2, vy: Math.sin(a) * pw * 7.2, t: 0 }; o.arrows--
  }
  o.update = (dt) => {
    stepFx(fx, dt)
    if (tgt && tgt.vy) { tgt.y += tgt.vy * dt; if (tgt.y < 100 || tgt.y > 380) tgt.vy *= -1 }
    if (o.over) return
    if (arrow) {
      const previous={x:arrow.x,y:arrow.y}; arrow.vy += 520 * dt; arrow.vx += wind * dt * 0.6; arrow.x += arrow.vx * dt; arrow.y += arrow.vy * dt; arrow.t += dt
      const dx=arrow.x-previous.x,dy=arrow.y-previous.y,den=dx*dx+dy*dy
      const u=clamp(((tgt.x-previous.x)*dx+(tgt.y-previous.y)*dy)/(den||1),0,1)
      const d=Math.hypot(previous.x+dx*u-tgt.x,previous.y+dy*u-tgt.y)
      if (d < tgt.r) { const pts = d < 8 ? 50 : d < 18 ? 25 : 10; o.score += pts; last = '+' + pts; puff(fx, arrow.x, arrow.y, 12, '#ffe84a', 180); arrow = null; if (o.arrows <= 0) o.over = true; else newTarget() }
      else if (arrow.y > H || arrow.x > W + 20 || arrow.x < -20) { last = 'MISS'; arrow = null; if (o.arrows <= 0) o.over = true }
    }
  }
  o.draw = (g) => {
    sky(g, '#9fd8ff', '#e8f6ff'); g.fillStyle = '#5ac44a'; g.fillRect(0, 440, W, 100)
    g.save(); g.translate(tgt.x, tgt.y); for (const [r, c] of [[34, '#fff'], [26, '#222'], [18, '#3de8ff'], [10, '#ff5a6a'], [4, '#ffe84a']]) disc(g, 0, 0, r, c); g.restore()
    g.fillStyle = '#6a4a2a'; g.fillRect(tgt.x - 3, tgt.y + tgt.r, 6, 440 - tgt.y - tgt.r)
    g.strokeStyle = '#6a3a1a'; g.lineWidth = 5; g.beginPath(); g.arc(BX + 4, BY, 34, -1.1, 1.1); g.stroke(); g.lineWidth = 1
    if (aim) { const dx = BX - aim.x, dy = BY - aim.y, pw = clamp(Math.hypot(dx, dy), 20, 140), a = Math.atan2(dy, dx); g.strokeStyle = '#000'; g.beginPath(); g.moveTo(BX + 4 + Math.cos(-1.1) * 34, BY + Math.sin(-1.1) * 34); g.lineTo(BX - Math.cos(a) * pw * 0.35, BY - Math.sin(a) * pw * 0.35); g.lineTo(BX + 4 + Math.cos(1.1) * 34, BY + Math.sin(1.1) * 34); g.stroke(); g.fillStyle = '#ffffffaa'; for (let i = 1; i <= 14; i++) { const t = i * 0.07, vx = Math.cos(a) * pw * 7.2 + wind * t * 0.3, vy = Math.sin(a) * pw * 7.2; disc(g, BX + vx * t, BY + vy * t + 260 * t * t, 3, '#ffffffaa') } }
    if (arrow) { g.save(); g.translate(arrow.x, arrow.y); g.rotate(Math.atan2(arrow.vy, arrow.vx)); g.fillStyle = '#5a3a1a'; g.fillRect(-30, -1.5, 30, 3); g.fillStyle = '#999'; g.beginPath(); g.moveTo(0, -4); g.lineTo(10, 0); g.lineTo(0, 4); g.fill(); g.restore() }
    drawFx(g, fx); txt(g, 'SCORE ' + o.score, 70, 24, 12, '#07304a'); txt(g, 'ARROWS ' + o.arrows, W - 70, 24, 12, '#07304a'); txt(g, 'WIND ' + (wind > 0 ? '→ ' : '← ') + Math.abs(Math.round(wind / 6)), W / 2, 56, 10, '#07304a'); if (last) txt(g, last, W / 2, 90, 18, '#7a3a00')
  }

  o.draw3 = (r, g) => {
    r.screen(); r.begin('#9fd8ff', '#e8f6ff')
    for (let i = 0; i < 5; i++) { const x = -320 + i * 170, z = 160 + (i % 2) * 40; r.tree(x,H-440,z,210+(i%2)*55,i,'pine','#759c78') }
    r.floor(-700, -300, 700, 500, H - 440, '#5ac44a')
    r.box(0, (H - 440) / 2, 20, 900, H - 440, 20, '#4aa83a', { edge: false })
    for(const side of [-1,1]){lanternModel(r,side*148,355,30,12);flowerPatch(r,side*145,H-440,0,5,side)}
    const tx = tgt.x - W / 2, ty = H - tgt.y
    r.cyl(tx, H - 440, 0, 4, 440 - tgt.y - tgt.r + (H - 440) * 0 + 0, '#6a4a2a')
    for (const [rd, c, z] of [[34, '#ffffff', 0], [26, '#222222', -3], [18, '#3de8ff', -6], [10, '#ff5a6a', -9], [4, '#ffe84a', -12]]) r.disc(tx, ty, z, rd, 6, c)
    const bx = BX - W / 2, by = H - BY
    for(let i=0;i<16;i++){const a=-1.1+i*2.2/16,b=a+2.2/16;r.line([bx+4+Math.cos(a)*34,by-Math.sin(a)*34,0],[bx+4+Math.cos(b)*34,by-Math.sin(b)*34,0],'#a07550',5)}
    r.box(bx+38,by,0,5,16,7,'#534558');const tips=[-1,1].map(side=>[bx+4+Math.cos(1.1)*34,by+side*Math.sin(1.1)*34,0])
    if(!aim){r.line(tips[0],[bx,by,0],'#eee5d4',1);r.line([bx,by,0],tips[1],'#eee5d4',1)}
    if (aim) { const dx = BX - aim.x, dy = BY - aim.y, pw = clamp(Math.hypot(dx, dy), 20, 140), a = Math.atan2(dy, dx); for(const tip of tips)r.line(tip,[bx-Math.cos(a)*pw*.35,by+Math.sin(a)*pw*.35,0],'#f4e9d3',1.5); for (let i = 1; i <= 14; i++) { const t2 = i * 0.07, vx = Math.cos(a) * pw * 7.2 + wind * t2 * 0.3, vy = Math.sin(a) * pw * 7.2; r.sphere(bx + vx * t2, by - (vy * t2 + 260 * t2 * t2), -2, 3, '#ffffff', { shine: false, alpha: 0.7 }) } }
    if (arrow) { const ang2 = Math.atan2(arrow.vy, arrow.vx); r.box(arrow.x - W / 2, H - arrow.y, -4, 34, 3, 3, '#5a3a1a', { rz: -ang2 }); r.sphere(arrow.x - W / 2 + Math.cos(ang2) * 18, H - arrow.y - Math.sin(ang2) * 18, -4, 3.6, '#bbbbbb', { shine: false }) }
    r.fx(fx); r.flush(); txt(g, 'SCORE ' + o.score, 70, 24, 12, '#07304a'); txt(g, 'ARROWS ' + o.arrows, W - 70, 24, 12, '#07304a'); txt(g, 'WIND ' + (wind > 0 ? '→ ' : '← ') + Math.abs(Math.round(wind / 6)), W / 2, 56, 10, '#07304a'); if (last) txt(g, last, W / 2, 90, 18, '#7a3a00')
  }
  o.cancel=()=>{aim=null}
  return o
}

// ---------------------------------------------------------------- 23. TIME RIFT RUNNER (the 4th dimension is time: rewind it)
function timeRift() {
  const o = { score: 0, over: false, label: 'TAP TO JUMP · WHEN YOU CRASH, TIME REWINDS 3 SECONDS · 3 REWINDS', rewinds: 3 }
  const GY = H - 120
  let p, obs, coins, dist, speed, nextSpawn, jumps, fx, coinN, hist, histT, rew, ghost
  const snap = () => ({ p: { ...p }, obs: obs.map((a) => ({ ...a })), coins: coins.map((c) => ({ ...c })), dist, speed, nextSpawn, jumps, coinN })
  const load = (h) => { p = { ...h.p }; obs = h.obs.map((a) => ({ ...a })); coins = h.coins.map((c) => ({ ...c })); dist = h.dist; speed = h.speed; nextSpawn = h.nextSpawn; jumps = h.jumps; coinN = h.coinN }
  o.reset = () => { p = { y: GY, vy: 0 }; obs = []; coins = []; dist = 0; speed = 250; nextSpawn = 400; jumps = 0; fx = []; coinN = 0; hist = []; histT = 0; rew = 0; ghost = null; o.rewinds = 3; o.score = 0; o.over = false }
  const jump = () => { if (o.over || rew > 0 || jumps >= 2) return; p.vy = -640; jumps++; puff(fx, 80, p.y, 5, '#3de8ff', 80) }
  o.down = jump; o.key = (c) => { if (c === 'Space' || c === 'ArrowUp') jump() }
  o.update = (dt) => {
    stepFx(fx, dt)
    if (o.over) return
    if (rew > 0) {
      // time runs backwards: replay the recorded frames in reverse, fast
      rew -= dt; const steps = Math.max(1, Math.ceil(hist.length / Math.max(1, rew / dt))); for (let k = 0; k < steps && hist.length > 1; k++) hist.pop()
      if (hist.length) load(hist[hist.length - 1])
      if (rew <= 0 || hist.length <= 1) { rew = 0; p.y = GY; p.vy = 0; jumps = 0; obs = obs.filter((a) => a.x > 260 || a.x < -60); for (const a of obs) if (a.x < 200 && a.x > -40) a.x += 260; ghost = 1.2 }
      return
    }
    ghost = ghost ? Math.max(0, ghost - dt) : 0
    speed = Math.min(540, 250 + dist * 0.012); dist += speed * dt
    p.vy += 1900 * dt; p.y += p.vy * dt; if (p.y >= GY) { p.y = GY; p.vy = 0; jumps = 0 }
    nextSpawn -= speed * dt
    if (nextSpawn <= 0) { const k = pick(['spike', 'spike', 'block', 'double', 'wall']); obs.push({ x: W + 40, k, w: k === 'block' ? 34 : k === 'double' ? 52 : k === 'wall' ? 22 : 28, h: k === 'block' ? 48 : k === 'wall' ? 74 : 30 }); if (Math.random() < 0.7) for (let q = 0; q < 3; q++) coins.push({ x: W + 40 + q * 28, y: GY - rnd(70, 160) }); nextSpawn = rnd(300, 470) + speed * 0.25 }
    for (const a of obs) a.x -= speed * dt
    for (const c of coins) c.x -= speed * dt
    while (obs.length && obs[0].x < -80) obs.shift()
    while (coins.length && coins[0].x < -40) coins.shift()
    histT += dt; if (histT >= 0.05) { histT = 0; hist.push(snap()); if (hist.length > 60) hist.shift() }
    if (!ghost) for (const a of obs) if (a.x < 80 + 12 && a.x + a.w > 80 - 12 && p.y > GY - a.h + 6) {
      if (o.rewinds > 0 && hist.length > 8) { o.rewinds--; rew = 0.7; puff(fx, 80, p.y - 14, 22, '#7af0ff', 200); break }
      o.over = true; puff(fx, 80, p.y - 14, 20, '#ff4d6d'); break
    }
    for (let i = coins.length - 1; i >= 0; i--) if (Math.hypot(coins[i].x - 80, coins[i].y - (p.y - 16)) < 24) { puff(fx, coins[i].x, coins[i].y, 5, '#ffe84a', 90); coins.splice(i, 1); coinN++; if (coinN % 12 === 0 && o.rewinds < 5) { o.rewinds++ } }
    o.score = Math.floor(dist / 12) + coinN * 10
  }
  o.draw = (g) => { sky(g, '#0a2a4a', '#021018'); txt(g, 'TIME RIFT', W / 2, 40, 16, '#7af0ff') }
  o.draw3 = (r, g) => {
    r.screen()
    const back = rew > 0
    r.begin(back ? '#0a4a6a' : '#1a0a4a', back ? '#021a2a' : '#06021a')
    for (let i = 0; i < 9; i++) { const x = ((i * 90 - dist * 0.15) % 720 + 720) % 720 - 360, h = 60 + (i * 37) % 110; r.box(x, 114 + h / 2, 150 + (i % 3) * 40, 44, h, 34, back ? hsl(190 + i * 6, 60, 26) : hsl(250 + i * 14, 60, 22), { edge: false }) }
    r.box(0, 100, 0, 800, 28, 150, back ? '#0a2a3a' : '#16093a'); r.box(0, 114, -75, 800, 4, 5, back ? '#7af0ff' : '#ff4de1', { glow: 1.3, edge: false })
    for (let k = -6; k < 12; k++) { const x = k * 40 - (dist % 40) - 200; r.box(x, 114.5, 0, 3, 1, 148, back ? '#7af0ff' : '#ff4de1', { alpha: 0.3, edge: false }) }
    for (const a of obs) {
      const x = a.x + a.w / 2 - W / 2
      if (a.k === 'block') r.box(x, 114 + a.h / 2, 0, a.w, a.h, 36, '#7a3cff')
      else if (a.k === 'wall') r.box(x, 114 + a.h / 2, 0, a.w, a.h, 40, '#ff9a3a', { glow: 1.1 })
      else { const n = a.k === 'double' ? 2 : 1; for (let q = 0; q < n; q++) r.pyramid(a.x + 13 + q * 26 - W / 2, 114, 0, 26, a.h, 26, '#ff4d6d') }
    }
    for (const c of coins) r.sphere(c.x - W / 2, H - c.y, 0, 8, '#ffe84a', { glow: 1.1 })
    if (!o.over) { const px = 80 - W / 2, py = H - p.y; r.shadow(px, 0, 15, 0.35, 114); r.person(px, py, 0, back ? '#a8f4ff' : '#3de8ff', dist * 0.07, 3.1, { alpha: ghost ? 0.55 : 1, hair: '#173a56' }); if (back) for (let q = 1; q <= 4; q++) r.box(px - q * 14, py + 15, 0, 28, 30, 24, '#7af0ff', { alpha: 0.18 / q, edge: false }) }
    r.fx(fx); r.flush()
    for (let q = 0; q < 5; q++) txt(g, '⏪', 28 + q * 22, 28, 14, q < o.rewinds ? '#7af0ff' : '#334')
    if (back) { g.fillStyle = 'rgba(122,240,255,0.12)'; g.fillRect(0, 0, W, H); txt(g, '⏪ REWINDING', W / 2, 120, 16, '#7af0ff') }
  }
  return o
}

// ---------------------------------------------------------------- 24. TESSERACT TAP (a rotating 4D hypercube)
function tesseractTap() {
  const o = { score: 0, over: false, label: 'TAP THE GLOWING CORNER OF THE 4D CUBE BEFORE IT FADES', lives: 3 }
  const V = []; for (let i = 0; i < 16; i++) V.push([(i & 1) ? 1 : -1, (i & 2) ? 1 : -1, (i & 4) ? 1 : -1, (i & 8) ? 1 : -1])
  const E = []; for (let i = 0; i < 16; i++) for (let b = 0; b < 4; b++) { const j = i ^ (1 << b); if (j > i) E.push([i, j]) }
  let ang, tgt, tleft, time, fx, pts, lives, streak, spawnGap
  const rot2 = (a, b, th) => { const c = Math.cos(th), s = Math.sin(th); return [a * c - b * s, a * s + b * c] }
  const project = () => V.map((v) => {
    let [x, y, z, w] = v
    ;[x, w] = rot2(x, w, ang * 0.9); [y, z] = rot2(y, z, ang * 0.55); [z, w] = rot2(z, w, ang * 0.7); [x, y] = rot2(x, y, ang * 0.3)
    const k = 1 / (2.3 - w * 0.55), X = x * k, Y = y * k, Z = z * k, k3 = 1 / (3.4 - Z * 0.5)
    return { x: X * 86, y: Y * 86, z: Z * 86, w, s: k3 }
  })
  o.reset = () => { ang = 0; tgt = -1; tleft = 0; time = 0; fx = []; pts = []; lives = 3; o.lives = 3; streak = 0; spawnGap = 0.5; o.score = 0; o.over = false }
  o.down = (x, y) => {
    if (o.over || tgt < 0 || !pts.length) return
    const q = pts[tgt]; if (!q.sx) return
    if (Math.hypot(x - q.sx, y - q.sy) < 40) { streak++; o.score += 10 + Math.min(40, streak * 3); puff(fx, q.sx, q.sy, 12, '#ffe84a', 200); tgt = -1; spawnGap = 0.25; tleft = 0 }
  }
  o.update = (dt) => {
    stepFx(fx, dt); ang += dt * (0.55 + Math.min(0.9, o.score / 400)); time += dt
    pts = pts.length ? pts : project()
    if (o.over) return
    if (tgt >= 0) { tleft -= dt; if (tleft <= 0) { tgt = -1; streak = 0; lives--; o.lives = lives; spawnGap = 0.5; if (lives <= 0) o.over = true } }
    else { spawnGap -= dt; if (spawnGap <= 0) { tgt = ri(0, 15); tleft = Math.max(0.9, 2.2 - o.score / 250) } }
  }
  o.draw = (g) => { sky(g, '#0a1030', '#02030a'); txt(g, 'TESSERACT', W / 2, 40, 16, '#b27aff') }
  o.draw3 = (r, g) => {
    r.look(0, 0, -330, 0, 0, 0, 45); r.begin('#0c0828', '#020108')
    for (let i = 0; i < 40; i++) r.sphere(((i * 61) % 400) - 200, ((i * 97) % 520) - 260, 160 + (i % 5) * 20, 1, '#ffffff', { shine: false, alpha: 0.5 })
    const P = project()
    P.forEach((q, i) => { const sp = r.proj([q.x, q.y, q.z]); q.sx = sp ? sp.x : 0; q.sy = sp ? sp.y : 0 })
    pts = P
    for (const [a, b] of E) { const hot = a === tgt || b === tgt; r.line([P[a].x, P[a].y, P[a].z], [P[b].x, P[b].y, P[b].z], hot ? '#ffe84a' : hsl(250 + (P[a].w + 1) * 40, 80, 60), hot ? 3 : 2) }
    P.forEach((q, i) => { const w = (q.w + 1) / 2; r.sphere(q.x, q.y, q.z, 5 + 3 * w + (i === tgt ? 2 + Math.sin(time * 14) * 1.2 : 0), i === tgt ? '#ffe84a' : hsl(250 + w * 90, 80, 58), { glow: i === tgt ? 1.7 : 1 }) })
    r.fx(fx, (p) => [p.x - W / 2, 270 - p.y, -40]); r.flush()
    if (tgt >= 0 && pts[tgt].sx) { g.strokeStyle = '#ffe84a'; g.lineWidth = 3; g.beginPath(); g.arc(pts[tgt].sx, pts[tgt].sy, 26 * (tleft / Math.max(0.9, 2.2 - o.score / 250)) + 10, 0, TAU); g.stroke(); g.lineWidth = 1 }
    for (let q = 0; q < 3; q++) txt(g, q < lives ? '♥' : '♡', 30 + q * 28, 24, 18, q < lives ? '#ff5a6a' : '#664')
    if (streak >= 3) txt(g, 'STREAK x' + streak, W / 2, 60, 12, '#ffe84a')
    txt(g, '4D ROTATION', W / 2, H - 30, 9, '#7a6aff')
  }
  return o
}

export const MINI = [
  { id: 'stack', icon: '🏗️', name: 'STACK TOWER', desc: 'Time your taps and build the tallest tower', make: wrapR3(stackTower) },
  { id: 'wing', icon: '🐤', name: 'WING DASH', desc: 'Flap through the pipes without a single touch', make: wrapR3(wingDash) },
  { id: 'bubble', icon: '🫧', name: 'BUBBLE POP', desc: 'Aim, bounce and pop colour clusters', make: wrapR3(bubblePop) },
  { id: 'runner', icon: '🏃', name: 'NEON RUNNER', desc: 'Run forever. Double jump over spikes', make: wrapR3(neonRunner) },
  { id: 'slice', icon: '🍉', name: 'SLICE NINJA', desc: 'Swipe the fruit, dodge the bombs', make: wrapR3(sliceNinja) },
  { id: 'gems', icon: '💎', name: 'GEM CRUSH', desc: 'Match-3 puzzle with chain reactions', make: wrapR3(gemCrush, true) },
  { id: 'memory', icon: '🧠', name: 'MEMORY FLIP', desc: 'Find every pair in the fewest moves', make: wrapR3(memoryFlip, true) },
  { id: 'mole', icon: '🔨', name: 'MOLE SMASH', desc: 'Whack moles, golden bonuses, avoid bombs', make: wrapR3(moleSmash) },
  { id: 'miner', icon: '⛏️', name: 'IDLE MINER', desc: 'Tap rocks, hire miners, never stop growing', make: wrapR3(idleMiner, true) },
  { id: 'traffic', icon: '🚗', name: 'TRAFFIC DODGE', desc: 'Weave through traffic and grab coins', make: wrapR3(trafficDodge) },
  { id: 'blob', icon: '🟣', name: 'BLOB ARENA', desc: 'Eat, grow and outsmart 14 hungry blobs', make: wrapR3(blobArena) },
  { id: 'blocks', icon: '🧩', name: 'BLOCK PUZZLE', desc: 'Drag pieces, clear lines, chain combos', make: wrapR3(blockPuzzle, true) },
  { id: 'simon', icon: '🎵', name: 'COLOR MEMORY', desc: 'Repeat the growing light pattern', make: wrapR3(colorMemory, true) },
  { id: 'fishing', icon: '🎣', name: 'LAKE FISHING', desc: 'Drop the hook, catch the big ones, avoid junk', make: wrapR3(lakeFishing) },
  { id: 'hoops', icon: '🏀', name: 'HOOP SHOT', desc: 'Flick the ball and sink streaks of baskets', make: wrapR3(hoopShot) },
  { id: 'sumo', icon: '🥋', name: 'SUMO PUSH', desc: 'Shove the bot out of the ring, round after round', make: wrapR3(sumoPush) },
  { id: 'knife', icon: '🔪', name: 'KNIFE HIT', desc: 'Throw knives into the spinning log, never hit another', make: wrapR3(knifeHit) },
  { id: 'fruit', icon: '🍉', name: 'FRUIT MERGE', desc: 'Drop and merge fruits up to the big watermelon', make: wrapR3(fruitMerge) },
  { id: 'hop', icon: '🦘', name: 'DOODLE HOP', desc: 'Bounce up endless platforms without falling', make: wrapR3(doodleHop) },
  { id: 'ttt', icon: '❌', name: 'TIC-TAC-TOE', desc: 'Beat a bot that gets smarter every round', make: wrapR3(ticTacToe, true) },
  { id: 'pong', icon: '🏓', name: 'PONG DUEL', desc: 'Classic paddle duel against a speeding bot', make: wrapR3(pongDuel) },
  { id: 'archery', icon: '🏹', name: 'ARCHERY', desc: 'Pull back, read the wind, hit the bullseye', make: wrapR3(archery) },
  { id: 'rift', icon: '⏪', name: 'TIME RIFT', desc: 'Run, jump and rewind time after a crash', make: wrapR3(timeRift) },
  { id: 'tess', icon: '🧊', name: 'TESSERACT TAP', desc: 'A rotating hypercube: catch the glowing vertex', make: wrapR3(tesseractTap) },
]
