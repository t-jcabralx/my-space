// 3D scenes for AIR HOCKEY, BILLIARDS, NEON SNAKE, NEON BREAKER and NEON BEAT: glossy tables, glowing rails, real spheres and animated parts.
import { G } from './engine.js'
import { col, clamp } from './pxl.js'
const TAU = Math.PI * 2
const hex = (h, k = 1) => { const c = col(h); return [c[0] * k, c[1] * k, c[2] * k] }
const cam = (x, y, z, tx, ty, tz, fov = 40) => ({ x: x + (Math.random() - 0.5) * (G.shake || 0) * 0.5, y, z, tx, ty, tz, fov, far: 500, aspect: 100 / 56 })

// ---------- AIR HOCKEY ----------
export const hockeyCam = () => cam(0, 60, 44, 0, 0, 1)
export const hockeyLights = () => ({ sun: { x: -18, y: 60, z: 20, color: '#dfe8ff', intensity: 0.9 }, ambient: 0.8, dir: 0.1, lantern: { x: 0, y: 14, z: 0, color: '#7fb4ff', intensity: 2.2, distance: 80 } })
export function drawHockey3(api, HK, C1, C2, TX, TY, GOAL, RM, RP) {
  const { put3, putS } = api, t = G.time, c1 = hex(C1, 1.5), c2 = hex(C2, 1.5)
  put3(0, -1.2, 0, TX * 2 + 8, 1.6, TY * 2 + 8, 0, 0.12, 0.1, 0.16, 0)            // base
  put3(0, -0.3, 0, TX * 2 + 1, 0.5, TY * 2 + 1, 0, 0.04, 0.09, 0.2, 0)             // glossy play surface
  for (let x = -TX; x <= TX; x += 4) put3(x, 0.02, 0, 0.12, 0.1, TY * 2, 0, 0.1, 0.35, 0.9, 0)
  for (let z = -TY; z <= TY; z += 4) put3(0, 0.02, z, TX * 2, 0.1, 0.12, 0, 0.1, 0.35, 0.9, 0)
  for (let k = 0; k < 48; k++) { const a = (k / 48) * TAU; put3(Math.cos(a) * 7, 0.08, Math.sin(a) * 7, 0.7, 0.14, 0.7, 0, 0.5, 0.9, 2) }
  for (let z = -TY; z <= TY; z += 1.4) put3(0, 0.08, z, 0.5, 0.14, 0.8, 0, 0.5, 0.9, 2)
  putS(0, 0.05, 0, 2.2, 0.2, 2.2, 0.5, 0.9, 2)
  // rails with glowing tops, goals at the ends
  for (const sd of [-1, 1]) {
    put3(0, 1.1, sd * (TY + 1.1), TX * 2 + 4, 2.2, 1.6, 0, 0.5, 0.5, 0.62, 0); put3(0, 2.25, sd * (TY + 1.1), TX * 2 + 4, 0.2, 0.5, 0, 0.8 + Math.sin(t * 2) * 0.1, 2.4, 3, 0)
    for (const e of [-1, 1]) { const zz = e * (TY + GOAL) / 2 + e * 0.0; void zz }
  }
  for (const side of [-1, 1]) {
    const cc = side < 0 ? c1 : c2, gx = side * (TX + 1.3)
    const wallLen = TY - GOAL
    for (const e of [-1, 1]) put3(gx, 1.1, e * (GOAL + wallLen / 2), 1.6, 2.2, wallLen + 0.6, 0, 0.5, 0.5, 0.62, 0)
    put3(gx + side * 0.4, 1.5, 0, 0.5, 3, GOAL * 2, 0, cc[0] * 0.5, cc[1] * 0.5, cc[2] * 0.5, 0)
    for (let z = -GOAL; z <= GOAL; z += 1) put3(gx - side * 0.4, 0.1, z, 0.35, 0.2, 0.7, 0, cc[0] * 1.8, cc[1] * 1.8, cc[2] * 1.8, 0)
    for (const e of [-1, 1]) putS(gx, 2.4, e * GOAL, 1, 1, 1, cc[0] * 2.4, cc[1] * 2.4, cc[2] * 2.4)
  }
  if (HK.phase === 'goal') { const k = Math.max(0, 1 - HK.phaseT) * 3, cc = HK.lastScorer === 0 ? c1 : c2, gx = HK.lastScorer === 0 ? TX + 3.4 : -TX - 3.4; for (let z = -GOAL; z <= GOAL; z += 1) putS(gx, 1 + k, z, 1.4, 1.4 + k, 1.4, cc[0] * k, cc[1] * k, cc[2] * k) }
  const disc = (x, y, z, sx, sy, sz, r, g, b) => api.putCyl ? api.putCyl(x, y, z, sx, sy, sz, 0, r, g, b) : putS(x, y, z, sx, sy, sz, r, g, b)
  // trail, mallets, pucks
  for (const q of HK.trail) { const f = q.l * 3.5; putS(q.x, 0.3, -q.y, 1.6 * f + 0.2, 0.2, 1.6 * f + 0.2, 1.4 * f, 1.8 * f, 2.6 * f) }
  for (const m of HK.m) {
    const cc = m.side < 0 ? c1 : c2
    putS(m.x, 0.04, -m.y, RM * 2.6, 0.12, RM * 2.6, cc[0] * 0.8, cc[1] * 0.8, cc[2] * 0.8)           // glow on the table
    disc(m.x, 0.9, -m.y, RM * 2, 1.7, RM * 2, cc[0] * 0.55, cc[1] * 0.55, cc[2] * 0.55)               // base
    disc(m.x, 1.6, -m.y, RM * 1.5, 1.2, RM * 1.5, cc[0] * 0.9, cc[1] * 0.9, cc[2] * 0.9)
    disc(m.x, 2.7, -m.y, RM * 0.85, 1.6, RM * 0.85, 1.2, 1.2, 1.4)                                    // handle
    putS(m.x, 3.1, -m.y, RM * 0.7, 0.7, RM * 0.7, cc[0] * 2, cc[1] * 2, cc[2] * 2)
  }
  for (const pk of [HK.puck, ...HK.extra]) if (pk) { disc(pk.x, 0.45, -pk.y, RP * 2, 0.9, RP * 2, 2.2, 2.2, 2.4); disc(pk.x, 0.5, -pk.y, RP * 2.3, 0.4, RP * 2.3, 3, 2.4, 0.5); if (Math.hypot(pk.vx, pk.vy) > 50) putS(pk.x - pk.vx * 0.02, 0.4, -pk.y + pk.vy * 0.02, RP * 1.4, 0.5, RP * 1.4, 2, 1.8, 0.5) }
  for (const q of G.parts) { const f = q.life / q.max, s = q.s * (0.3 + 0.5 * f); putS(q.x, 0.6 + (1 - f) * 2, -q.y, s, s, s, q.c[0] * 2, q.c[1] * 2, q.c[2] * 2) }
}

// ---------- BILLIARDS ----------
export const poolCam = () => cam(0, 64, 38, 0, 0, 2)
export const poolLights = () => ({ sun: { x: -10, y: 70, z: 16, color: '#fff4e0', intensity: 0.95 }, ambient: 0.7, dir: 0.1, lantern: { x: 0, y: 24, z: 0, color: '#fff0c8', intensity: 3.4, distance: 90 } })
export function drawPool3(api, PL, defs) {
  const { put3, putS } = api, { TX, TY, BR, PR, POCKETS, ballColor } = defs, t = G.time
  put3(0, -1, 0, TX * 2 + 14, 1.6, TY * 2 + 14, 0, 0.22, 0.11, 0.05, 0)                               // wooden frame
  put3(0, 0.1, TY + 3.2, TX * 2 + 14, 1.6, 4.4, 0, 0.3, 0.15, 0.07, 0); put3(0, 0.1, -TY - 3.2, TX * 2 + 14, 1.6, 4.4, 0, 0.3, 0.15, 0.07, 0)
  put3(TX + 3.2, 0.1, 0, 4.4, 1.6, TY * 2 + 14, 0, 0.3, 0.15, 0.07, 0); put3(-TX - 3.2, 0.1, 0, 4.4, 1.6, TY * 2 + 14, 0, 0.3, 0.15, 0.07, 0)
  put3(0, -0.2, 0, TX * 2, 0.5, TY * 2, 0, 0.02, 0.28, 0.17, 0)                                          // felt
  for (let x = -TX + 6; x < TX; x += 6.3) { putS(x, 0.4, TY + 1.8, 0.7, 0.2, 0.7, 2, 1.8, 1.2); putS(x, 0.4, -TY - 1.8, 0.7, 0.2, 0.7, 2, 1.8, 1.2) }
  for (const z of [-TY / 2, 0, TY / 2]) { putS(TX + 1.8, 0.4, z, 0.7, 0.2, 0.7, 2, 1.8, 1.2); putS(-TX - 1.8, 0.4, z, 0.7, 0.2, 0.7, 2, 1.8, 1.2) }
  // cushions (leaving the pockets open)
  const cu = (x, z, w, d) => put3(x, 0.7, z, w, 1.4, d, 0, 0.02, 0.2, 0.12, 0)
  cu(-TX / 2 + 1.5, TY + 0.5, TX - 6, 1.4); cu(TX / 2 - 1.5, TY + 0.5, TX - 6, 1.4); cu(-TX / 2 + 1.5, -TY - 0.5, TX - 6, 1.4); cu(TX / 2 - 1.5, -TY - 0.5, TX - 6, 1.4)
  cu(TX + 0.5, 0, 1.4, TY * 2 - 6); cu(-TX - 0.5, 0, 1.4, TY * 2 - 6)
  for (const [px, py] of POCKETS) { putS(px, -0.1, -py, PR * 2.3, 0.7, PR * 2.3, 0.01, 0.01, 0.01); for (let k = 0; k < 14; k++) { const a = (k / 14) * TAU; putS(px + Math.cos(a) * PR * 1.1, 0.5, -py + Math.sin(a) * PR * 1.1, 0.5, 0.5, 0.5, 2.4, 1.8, 0.4) } }
  // head string and spot
  put3(-TX * 0.5, 0.05, 0, 0.12, 0.08, TY * 2, 0, 0.5, 1.2, 0.9, 0); putS(TX * 0.45, 0.06, 0, 0.9, 0.1, 0.9, 1.4, 2, 1.6)
  const c = PL.balls[0]
  // aim guide, cue stick
  if (PL.phase === 'aim' && PL.mode === 'play' && c && !c.in) {
    const a = PL.aim.a, ca = Math.cos(a), sa = Math.sin(a)
    let tmin = 200, hit = null
    for (const b of PL.balls) { if (b.in || b.n === 0) continue; const dx = b.x - c.x, dy = b.y - c.y, tt = dx * ca + dy * sa; if (tt <= 0) continue; const dd = Math.hypot(dx - ca * tt, dy - sa * tt); if (dd < BR * 2) { const t2 = tt - Math.sqrt(4 * BR * BR - dd * dd); if (t2 < tmin) { tmin = t2; hit = b } } }
    for (const [lim, ax, ay] of [[TX - BR, ca, c.x], [-TX + BR, ca, c.x], [TY - BR, sa, c.y], [-TY + BR, sa, c.y]]) { const tt = (lim - ay) / (ax || 1e-9); if (tt > 0 && tt < tmin) { tmin = tt; hit = null } }
    for (let q = BR * 1.8; q < tmin; q += 1.9) putS(c.x + ca * q, BR, -(c.y + sa * q), 0.4, 0.4, 0.4, 2.4, 2.4, 2.4)
    putS(c.x + ca * tmin, BR, -(c.y + sa * tmin), BR * 2, BR * 2, BR * 2, 0.8, 0.8, 0.9)
    if (hit) { const gx = c.x + ca * tmin, gy = c.y + sa * tmin, nx = hit.x - gx, ny = hit.y - gy, nl = Math.hypot(nx, ny) || 1; for (let q = 1.6; q < 8; q += 1.6) putS(hit.x + (nx / nl) * q, BR, -(hit.y + (ny / nl) * q), 0.35, 0.35, 0.35, 2.2, 1.8, 0.4) }
    const back = BR + 1.4 + PL.aim.p * 9
    for (let q = 0; q < 6; q++) { const d0 = back + q * 4.4; put3(c.x - ca * d0, BR + 0.4 + q * 0.18, -(c.y - sa * d0), 0.45 + q * 0.06, 0.45 + q * 0.06, 4.4, 0, 0.9 - q * 0.05, 0.66 - q * 0.04, 0.34 - q * 0.02, Math.atan2(-ca, sa) * 0 + (Math.atan2(ca, -sa))) }
  }
  if (PL.phase === 'place' && c && !c.in) { const ok = PL.placeOk !== false; for (let k = 0; k < 16; k++) { const a = (k / 16) * TAU + t * 2; putS(c.x + Math.cos(a) * (BR + 1.1), 0.3, -c.y + Math.sin(a) * (BR + 1.1), 0.5, 0.3, 0.5, ok ? 0.4 : 3, ok ? 3 : 0.4, ok ? 0.9 : 0.4) } }
  for (const b of PL.balls) {
    if (b.in) continue
    const bc = hex(ballColor(b.n), 1.2)
    putS(b.x + 0.5, 0.02, -b.y + 0.5, BR * 2, 0.06, BR * 2, 0.01, 0.04, 0.02)
    if (b.n > 8) { putS(b.x, BR, -b.y, BR * 2, BR * 2, BR * 2, 2, 2, 2); putS(b.x, BR, -b.y, BR * 2.04, BR * 1.0, BR * 2.04, bc[0], bc[1], bc[2]) }
    else putS(b.x, BR, -b.y, BR * 2, BR * 2, BR * 2, b.n === 0 ? 2.4 : bc[0], b.n === 0 ? 2.4 : bc[1], b.n === 0 ? 2.4 : bc[2])
    if (b.n) { putS(b.x, BR * 1.85, -b.y, 0.9, 0.4, 0.9, 2.6, 2.6, 2.6); putS(b.x, BR * 1.98, -b.y, 0.4, 0.2, 0.4, 0.02, 0.02, 0.03) }
  }
  for (const q of G.parts) { const f = q.life / q.max, s = q.s * (0.3 + 0.5 * f); putS(q.x, 1 + (1 - f) * 3, -q.y, s, s, s, q.c[0] * 2, q.c[1] * 2, q.c[2] * 2) }
}

// ---------- NEON SNAKE ----------
export const snakeCam = () => cam(0, 72, 40, 0, 0, 1)
export const snakeLights = () => ({ sun: { x: -20, y: 70, z: 24, color: '#e8f0ff', intensity: 0.9 }, ambient: 0.8, dir: 0.1, lantern: { x: 0, y: 20, z: 0, color: '#9fd8ff', intensity: 2.0, distance: 90 } })
export function drawSnake3(api, SN, defs) {
  const { put3, putS } = api, { GW, GH, cx, cy, DIRS } = defs, t = G.time
  put3(0, -1.2, 0, GW * 2 + 6, 1.4, GH * 2 + 6, 0, 0.1, 0.1, 0.16, 0)
  for (let i = 0; i < GW; i++) for (let j = 0; j < GH; j++) { const k = (i + j) % 2 ? [0.03, 0.07, 0.13] : [0.04, 0.09, 0.16]; put3(cx(i), -0.2, -cy(j), 2.02, 0.4, 2.02, 0, k[0], k[1], k[2], 0) }
  for (let x = -GW; x <= GW; x += 2) { put3(x, 0.8, GH + 1.5, 2.1, 1.8, 1.2, 0, 0.1, 0.5 + Math.sin(t * 2 + x) * 0.1, 1.2, 0); put3(x, 0.8, -GH - 1.5, 2.1, 1.8, 1.2, 0, 0.1, 0.5 + Math.sin(t * 2 + x) * 0.1, 1.2, 0) }
  for (let z = -GH; z <= GH; z += 2) { put3(GW + 1.5, 0.8, z, 1.2, 1.8, 2.1, 0, 0.1, 0.5, 1.2, 0); put3(-GW - 1.5, 0.8, z, 1.2, 1.8, 2.1, 0, 0.1, 0.5, 1.2, 0) }
  for (const r of SN.rocks) { put3(cx(r[0]), 1, -cy(r[1]), 1.8, 2, 1.8, 0, 0.32, 0.26, 0.42, r[0]); put3(cx(r[0]) + 0.2, 2, -cy(r[1]), 1.1, 0.8, 1.1, 0, 0.2, 0.6, 0.3, r[1]) }
  if (SN.food) { const k = 1 + Math.sin(t * 8) * 0.1, x = cx(SN.food[0]), z = -cy(SN.food[1]); putS(x, 1.1, z, 1.8 * k, 1.7 * k, 1.8 * k, 2.6, 0.2, 0.3); putS(x - 0.3, 1.6, z - 0.3, 0.5, 0.4, 0.5, 3, 2.4, 2.4); put3(x + 0.2, 2.3, z, 0.3, 0.8, 0.3, 0.4, 0.2, 0.12, 0.05, 0); put3(x + 0.7, 2.5, z, 0.9, 0.2, 0.5, 0, 0.1, 0.8, 0.2, 0.4) }
  if (SN.gold) { const k = 1 + Math.sin(t * 12) * 0.15, x = cx(SN.gold[0]), z = -cy(SN.gold[1]); putS(x, 1.3 + Math.sin(t * 4) * 0.2, z, 2.2 * k, 2.1 * k, 2.2 * k, 3.2, 2.5, 0.4); for (let q = 0; q < 5; q++) { const a = t * 3 + q * 1.25; putS(x + Math.cos(a) * 2, 1.3 + Math.sin(a * 2) * 0.8, z + Math.sin(a) * 2, 0.3, 0.3, 0.3, 3, 3, 1) } }
  for (const s of SN.s) {
    const c = hex(s.col, 1.1), n = s.body.length
    s.body.forEach((b, i) => { const k = s.alive ? 1 : 0.25, f = 1 - (i / (n + 4)) * 0.45, sz = (i === 0 ? 2.1 : 1.8 * (0.85 + 0.15 * Math.sin(t * 6 - i * 0.7))) * 1; putS(cx(b[0]), 0.95 + (i === 0 ? 0.2 : 0), -cy(b[1]), sz, sz * 0.95, sz, c[0] * f * k, c[1] * f * k, c[2] * f * k) })
    const h = s.body[0], d = DIRS[s.d], hx = cx(h[0]), hz = -cy(h[1]), fx = d[0], fz = -d[1], sxv = -fz, szv = fx
    putS(hx + fx * 0.8 + sxv * 0.55, 1.9, hz + fz * 0.8 + szv * 0.55, 0.65, 0.65, 0.65, 3, 3, 3); putS(hx + fx * 0.8 - sxv * 0.55, 1.9, hz + fz * 0.8 - szv * 0.55, 0.65, 0.65, 0.65, 3, 3, 3)
    putS(hx + fx * 1.05 + sxv * 0.55, 1.9, hz + fz * 1.05 + szv * 0.55, 0.28, 0.28, 0.28, 0.02, 0.02, 0.03); putS(hx + fx * 1.05 - sxv * 0.55, 1.9, hz + fz * 1.05 - szv * 0.55, 0.28, 0.28, 0.28, 0.02, 0.02, 0.03)
    if (Math.sin(t * 9) > 0.3 && s.alive) put3(hx + fx * 1.6, 1.1, hz + fz * 1.6, 0.15, 0.1, 0.9, 0, 3, 0.3, 0.4, Math.atan2(fx, fz))
  }
  for (const q of G.parts) { const f = q.life / q.max, s = q.s * (0.3 + 0.5 * f); putS(q.x, 1 + (1 - f) * 3, -q.y, s, s, s, q.c[0] * 2, q.c[1] * 2, q.c[2] * 2) }
}

// ---------- NEON BREAKER ----------
export const breakerCam = () => cam(0, 54, 60, 0, 0, -1, 42)
export const breakerLights = () => ({ sun: { x: -20, y: 70, z: 30, color: '#e8f0ff', intensity: 0.9 }, ambient: 0.75, dir: 0.1, lantern: { x: 0, y: 24, z: 4, color: '#9ad8ff', intensity: 2.4, distance: 100 } })
export function drawBreaker3(api, BK, defs) {
  const { put3, putS } = api, { BW, BH } = defs, t = G.time
  put3(0, -1.2, 0, 90, 1.4, 60, 0, 0.08, 0.08, 0.14, 0)
  put3(0, -0.2, 0, 80, 0.4, 52, 0, 0.03, 0.05, 0.1, 0)
  for (let x = -38; x <= 38; x += 4) put3(x, 0.02, 0, 0.1, 0.1, 52, 0, 0.1, 0.25, 0.7, 0)
  for (let y = -26; y <= 26; y += 4) put3(0, 0.02, -y, 80, 0.1, 0.1, 0, 0.1, 0.25, 0.7, 0)
  for (const sd of [-1, 1]) { put3(sd * 41, 1.5, 0, 1.6, 3, 54, 0, 0.1, 0.6 + Math.sin(t * 2) * 0.1, 1.5, 0) }
  put3(0, 1.5, -26.8, 83, 3, 1.6, 0, 0.1, 0.6, 1.5, 0)
  for (const br of BK.bricks) {
    const c = hex(br.c, 1.15), k = 0.55 + 0.45 * (br.hp / br.max), hit = br.max > 1 ? 0.25 : 0
    put3(br.x, 1.2, -br.y, BW - 0.5, 2.4, BH - 0.5, 0, c[0] * k + hit, c[1] * k + hit, c[2] * k + hit, 0)
    put3(br.x, 2.5, -br.y, BW - 0.9, 0.3, BH - 0.9, 0, c[0] * 1.8 * k, c[1] * 1.8 * k, c[2] * 1.8 * k, 0)
    if (br.max > 1) for (let q = 0; q < br.hp; q++) putS(br.x - (br.hp - 1) * 0.5 + q, 2.8, -br.y, 0.45, 0.3, 0.45, 3, 2.6, 0.8)
  }
  for (const u of BK.ups) { const c = u.type === 'life' ? [3, 0.4, 0.6] : u.type === 'wide' ? [0.5, 2.4, 3] : u.type === 'slow' ? [1.4, 2.4, 3] : [3, 2.6, 0.6]; putS(u.x, 1.6, -u.y, 2.2, 1.6, 2.2, c[0], c[1], c[2]); put3(u.x, 1.7, -u.y, 3, 0.4, 0.4, 0, 3, 3, 3, t * 5) }
  const pc = BK.pad.wide > 0 ? [0.4, 2.4, 1] : [0.4, 1.8, 3], w = BK.pad.w
  put3(BK.pad.x, 0.9, 22.8, w, 1.5, 2.2, 0, pc[0] * 0.5, pc[1] * 0.5, pc[2] * 0.5, 0); put3(BK.pad.x, 1.8, 22.8, w - 1, 0.35, 1.6, 0, pc[0], pc[1], pc[2], 0)
  for (const e of [-1, 1]) putS(BK.pad.x + e * w / 2, 1, 22.8, 1.8, 1.8, 1.8, pc[0], pc[1], pc[2])
  for (const b of BK.balls) { putS(b.x + 0.4, 0.05, -b.y + 0.4, 1.8, 0.1, 1.8, 0.01, 0.02, 0.04); putS(b.x, 1, -b.y, 1.8, 1.8, 1.8, 2.6, 2.6, 2.8); putS(b.x, 1, -b.y, 2.6, 2.6, 2.6, 0.5, 1.2, 2.4); if (!BK.stuck) for (let q = 1; q < 6; q++) putS(b.x - b.vx * 0.012 * q, 1, -(b.y - b.vy * 0.012 * q), 1.5 - q * 0.22, 1.5 - q * 0.22, 1.5 - q * 0.22, 1.2 / q, 1.6 / q, 2.4 / q) }
  for (const q of G.parts) { const f = q.life / q.max, s = q.s * (0.3 + 0.5 * f); putS(q.x, 1 + (1 - f) * 3, -q.y, s, s, s, q.c[0] * 2, q.c[1] * 2, q.c[2] * 2) }
}

// ---------- NEON BEAT ----------
export const LANE_W = 5.2
export const rhythmCam = (RT) => cam(0, 15 + (RT ? RT.pulse * 0.3 : 0), 28, 0, 0, -16, 46)
export const rhythmLights = (RT, color) => ({ sun: { x: 0, y: 40, z: 10, color: '#c8d4ff', intensity: 0.6 }, ambient: 0.5, dir: 0.05, shadow: false, lantern: { x: 0, y: 7, z: 6, color, intensity: 2.6 + (RT ? RT.pulse * 2.4 : 0), distance: 90 } })
export function drawRhythm3(api, RT, defs) {
  const { put3, putS } = api, { SONGS, LANE_COL, LANE_Y, TOP_Y, FALL, Wd } = defs, t = G.time, s = SONGS[RT.song], sc = hex(s.color, 1.4)
  const HZ = 8, LEN = 70, spd = LEN / FALL                                  // the line is at z = HZ, notes arrive from far away
  put3(0, -0.6, HZ - LEN / 2, LANE_W * 4 + 2, 0.8, LEN + 12, 0, 0.03, 0.04, 0.09, 0)
  for (let l = 0; l < 4; l++) {
    const x = (l - 1.5) * LANE_W, c = hex(LANE_COL[l], 1), fl = RT.flashL[l], down = RT.down[l]
    put3(x, -0.1, HZ - LEN / 2, LANE_W - 0.4, 0.3, LEN + 10, 0, 0.05 + fl * 1.2 + (down ? 0.15 : 0), 0.07 + fl * 1.2 + (down ? 0.15 : 0), 0.16 + fl * 1.4 + (down ? 0.2 : 0), 0)
    put3(x - LANE_W / 2, 0.1, HZ - LEN / 2, 0.14, 0.2, LEN + 10, 0, 0.4, 0.5, 1.2, 0)
    put3(x, 0.4, HZ, LANE_W - 0.8, 0.5, 1.3, 0, c[0] * (0.7 + fl * 5), c[1] * (0.7 + fl * 5), c[2] * (0.7 + fl * 5), 0)       // hit pad
    if (down || fl > 0) putS(x, 1.2, HZ, LANE_W * 1.1, 1.4 + fl * 6, 2, c[0] * 1.4, c[1] * 1.4, c[2] * 1.4)
  }
  put3((2) * LANE_W + 0.0, 0.1, HZ - LEN / 2, 0.14, 0.2, LEN + 10, 0, 0.4, 0.5, 1.2, 0)
  // pillars of light on both sides, pulsing with the beat
  for (let k = 0; k < 10; k++) for (const sd of [-1, 1]) { const z = HZ - 4 - k * 7, h = 6 + Math.sin(t * 2 + k * 0.7) * 2 + RT.pulse * 5; put3(sd * (LANE_W * 2 + 5), h / 2, z, 1.2, h, 1.2, 0, sc[0] * (0.25 + RT.pulse * 0.6), sc[1] * (0.25 + RT.pulse * 0.6), sc[2] * (0.25 + RT.pulse * 0.6), 0); putS(sd * (LANE_W * 2 + 5), h + 0.6, z, 1.4, 1.4, 1.4, sc[0] * 1.6, sc[1] * 1.6, sc[2] * 1.6) }
  for (let k = 0; k < 40; k++) { const a = k * 2.399, z = HZ - 10 - ((t * 6 + k * 9) % 66), x = Math.sin(a) * 30, y = 3 + (k % 7) * 3; putS(x, y, z, 0.3, 0.3, 0.3, 1.2, 1.4, 2.4) }
  for (const n of RT.notes) {
    const dt = n.t - RT.st
    if (dt > FALL + 0.15) break
    if (n.len === 0 && n.hit) continue
    const x = (n.lane - 1.5) * LANE_W, c = hex(LANE_COL[n.lane], 1.2), z = HZ - dt * spd
    if (n.len > 0) {
      const held = RT.holds[n.lane] === n, z0 = held ? HZ : z, z1 = HZ - (dt + n.len) * spd
      const len = Math.abs(z0 - z1)
      if (!(n.miss && !held) && !(n.hit && !held && !n.held && !n.broken && dt + n.len < 0)) put3(x, 0.7, (z0 + z1) / 2, LANE_W * 0.34, 0.9, len, 0, c[0] * (held ? 1.6 : 0.8), c[1] * (held ? 1.6 : 0.8), c[2] * (held ? 1.6 : 0.8), 0)
      if (n.hit) continue
    }
    if (n.miss) { put3(x, 0.5, z, LANE_W * 0.8, 0.6, 1.1, 0, 0.3, 0.3, 0.35, 0); continue }
    put3(x, 0.9, z, LANE_W * 0.82, 1.3, 1.5, 0, c[0], c[1], c[2], 0); put3(x, 1.65, z, LANE_W * 0.7, 0.2, 1.1, 0, 3, 3, 3.2, 0); putS(x, 1.0, z, 1.1, 1.1, 1.1, c[0] * 2, c[1] * 2, c[2] * 2)
  }
  for (const q of G.parts) { const f = q.life / q.max, s2 = q.s * (0.3 + 0.5 * f), x = q.x / 14 * LANE_W; putS(x, 1 + (1 - f) * 4, HZ + (q.y - LANE_Y) * 0.1, s2, s2, s2, q.c[0] * 2, q.c[1] * 2, q.c[2] * 2) }
  void TOP_Y; void Wd
}
