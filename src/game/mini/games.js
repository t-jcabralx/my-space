// MINI GAMES: sixteen quick original canvas games in the classic browser-arcade genres (stacker, flappy, bubble shooter,
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

// ---------------------------------------------------------------- 11. BLOB ARENA (.io style)
function blobArena() {
  const WW = 1400, WH = 1400
  const o = { score: 0, over: false, label: 'MOVE YOUR FINGER / MOUSE · EAT SMALLER BLOBS · AVOID BIGGER ONES' }
  let me, bots, pellets, aim, fx, t
  const rad = (m) => 10 + Math.sqrt(m) * 2.6
  const mkBot = (i) => ({ x: rnd(100, WW - 100), y: rnd(100, WH - 100), m: rnd(20, 90), c: hsl(i * 47 + 20, 75, 55), vx: 0, vy: 0, think: 0, tx: 0, ty: 0 })
  o.reset = () => { me = { x: WW / 2, y: WH / 2, m: 20, vx: 0, vy: 0 }; bots = Array.from({ length: 14 }, (_, i) => mkBot(i)); pellets = Array.from({ length: 260 }, () => ({ x: rnd(20, WW - 20), y: rnd(20, WH - 20), c: hsl(ri(0, 360), 85, 60) })); aim = { x: 0, y: 0 }; fx = []; t = 0; o.score = 20; o.over = false }
  const setAim = (x, y) => { aim = { x: x - W / 2, y: y - H / 2 } }
  o.down = setAim; o.move = setAim
  o.key = (c) => { if (c === 'ArrowLeft') aim = { x: -100, y: 0 }; if (c === 'ArrowRight') aim = { x: 100, y: 0 }; if (c === 'ArrowUp') aim = { x: 0, y: -100 }; if (c === 'ArrowDown') aim = { x: 0, y: 100 } }
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
  o.down = setAim; o.move = setAim; o.up = () => { aim = null }
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
  { id: 'blob', icon: '🟣', name: 'BLOB ARENA', desc: 'Eat, grow and outsmart 14 hungry blobs', make: blobArena },
  { id: 'blocks', icon: '🧩', name: 'BLOCK PUZZLE', desc: 'Drag pieces, clear lines, chain combos', make: blockPuzzle },
  { id: 'simon', icon: '🎵', name: 'COLOR MEMORY', desc: 'Repeat the growing light pattern', make: colorMemory },
  { id: 'fishing', icon: '🎣', name: 'LAKE FISHING', desc: 'Drop the hook, catch the big ones, avoid junk', make: lakeFishing },
  { id: 'hoops', icon: '🏀', name: 'HOOP SHOT', desc: 'Flick the ball and sink streaks of baskets', make: hoopShot },
  { id: 'sumo', icon: '🥋', name: 'SUMO PUSH', desc: 'Shove the bot out of the ring, round after round', make: sumoPush },
]
