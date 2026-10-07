// MINI GAMES: ten quick original canvas games in the classic browser-arcade genres (stacker, flappy, bubble shooter,
// runner, slicer, match-3, memory, whack-a-mole, idle miner, traffic dodger). Each game is a small object the shell drives:
//   reset(), update(dt), draw(g), down(x, y), move(x, y), up(x, y), key(code)  +  score, over, label
// Logical canvas is W x H; the shell scales it to the screen and maps touch/mouse into these coordinates.
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
  return o
}

// ---------------------------------------------------------------- 5. SLICE NINJA
function sliceNinja() {
  const KINDS = [['#ff5a4d', 24], ['#ffd23a', 22], ['#7dff6a', 26], ['#ff8ad0', 20], ['#3de8ff', 22]]
  const o = { score: 0, over: false, label: 'SWIPE TO SLICE · AVOID THE BOMBS' }
  let items, fx, trail, lives, t, spawnT, swiping, combo
  o.lives = 3
  o.reset = () => { items = []; fx = []; trail = []; lives = 3; o.lives = 3; t = 0; spawnT = 0.6; swiping = false; combo = 0; o.score = 0; o.over = false }
  const spawn = () => { const bomb = Math.random() < Math.min(0.28, 0.1 + t * 0.002), k = pick(KINDS); items.push({ x: rnd(50, W - 50), y: H + 30, vx: rnd(-70, 70), vy: -rnd(720, 880), r: bomb ? 22 : k[1], c: bomb ? '#222' : k[0], bomb, cut: false, a: 0, va: rnd(-4, 4) }) }
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
  return o
}

export const MINI = [
  { id: 'stack', icon: '🏗️', name: 'STACK TOWER', desc: 'Time your taps and build the tallest tower', make: stackTower },
  { id: 'wing', icon: '🐤', name: 'WING DASH', desc: 'Flap through the pipes without a single touch', make: wingDash },
  { id: 'bubble', icon: '🫧', name: 'BUBBLE POP', desc: 'Aim, bounce and pop colour clusters', make: bubblePop },
  { id: 'runner', icon: '🏃', name: 'NEON RUNNER', desc: 'Run forever. Double jump over spikes', make: neonRunner },
  { id: 'slice', icon: '🍉', name: 'SLICE NINJA', desc: 'Swipe the fruit, dodge the bombs', make: sliceNinja },
  { id: 'gems', icon: '💎', name: 'GEM CRUSH', desc: 'Match-3 puzzle with chain reactions', make: gemCrush },
  { id: 'memory', icon: '🧠', name: 'MEMORY FLIP', desc: 'Find every pair in the fewest moves', make: memoryFlip },
  { id: 'mole', icon: '🔨', name: 'MOLE SMASH', desc: 'Whack moles, golden bonuses, avoid bombs', make: moleSmash },
  { id: 'miner', icon: '⛏️', name: 'IDLE MINER', desc: 'Tap rocks, hire miners, never stop growing', make: idleMiner },
  { id: 'traffic', icon: '🚗', name: 'TRAFFIC DODGE', desc: 'Weave through traffic and grab coins', make: trafficDodge },
]
