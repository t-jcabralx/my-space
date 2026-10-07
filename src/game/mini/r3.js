// A tiny software 3D renderer for the mini games: perspective camera, flat-shaded boxes/pyramids/cylinders, lit spheres,
// shadows, floors and billboard text, all drawn on a normal 2D canvas with the painter's algorithm. The games keep their simple
// 2D logic and just describe a 3D scene each frame.
const W = 360, H = 540
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const cache = new Map()
export function parse(c) {
  if (Array.isArray(c)) return c
  let v = cache.get(c); if (v) return v
  if (c[0] === '#') { const h = c.length === 4 ? c.slice(1).split('').map((x) => x + x).join('') : c.slice(1, 7); v = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)] }
  else { const m = c.match(/hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%/); if (m) { const hh = +m[1] / 360, s = +m[2] / 100, l = +m[3] / 100, q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q, f = (t) => { if (t < 0) t += 1; if (t > 1) t -= 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p }; v = [Math.round(f(hh + 1 / 3) * 255), Math.round(f(hh) * 255), Math.round(f(hh - 1 / 3) * 255)] } else v = [200, 200, 200] }
  cache.set(c, v); return v
}
const rgb = (c, k = 1, a = 1) => { const p = parse(c); return `rgba(${clamp(Math.round(p[0] * k), 0, 255)},${clamp(Math.round(p[1] * k), 0, 255)},${clamp(Math.round(p[2] * k), 0, 255)},${a})` }
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l] }
const LIGHT = norm([-0.45, 0.85, -0.55])
const BOXF = [[[0, 4, 5, 1], [0, -1, 0]], [[3, 2, 6, 7], [0, 1, 0]], [[0, 1, 2, 3], [0, 0, -1]], [[4, 7, 6, 5], [0, 0, 1]], [[0, 3, 7, 4], [-1, 0, 0]], [[1, 5, 6, 2], [1, 0, 0]]]

export function makeR3(g) {
  const r = { g, q: [], cam: null, E: [0, 0, 0], R: [1, 0, 0], U: [0, 1, 0], F: [0, 0, 1], focal: 600 }
  r.look = (ex, ey, ez, tx, ty, tz, fov = 45) => {
    r.E = [ex, ey, ez]; r.F = norm([tx - ex, ty - ey, tz - ez]); r.R = norm(cross([0, 1, 0], r.F)); r.U = cross(r.F, r.R); r.focal = (H / 2) / Math.tan((fov * Math.PI) / 360)
  }
  r.proj = (p) => { const d = sub(p, r.E), zc = dot(d, r.F); if (zc < 4) return null; const k = r.focal / zc; return { x: W / 2 + dot(d, r.R) * k, y: H / 2 - dot(d, r.U) * k, z: zc, k } }
  const key = (p) => { const d = sub(p, r.E); return dot(d, d) }
  // rotation about z (roll) then y (yaw) around the centre
  const rot = (v, rz, ry) => { let [x, y, z] = v; if (rz) { const c = Math.cos(rz), s = Math.sin(rz); [x, y] = [x * c - y * s, x * s + y * c] } if (ry) { const c = Math.cos(ry), s = Math.sin(ry); [x, z] = [x * c + z * s, -x * s + z * c] } return [x, y, z] }
  r.begin = (top = '#1b2a6b', bottom = '#0a1030') => { const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, top); gr.addColorStop(1, bottom); g.fillStyle = gr; g.fillRect(0, 0, W, H); r.q.length = 0 }
  const shade = (n, base = 0.5) => base + (1 - base) * Math.max(0, dot(n, LIGHT))
  function polys(center, verts, faces, color, o) {
    const out = []
    for (const [idx, n0] of faces) {
      const n = rot(n0, o.rz || 0, o.ry || 0), fc = verts[idx[0]], toEye = sub(r.E, fc)
      if (dot(n, toEye) <= 0 && !o.both) continue
      const pts = idx.map((i) => r.proj(verts[i])); if (pts.some((p) => !p)) continue
      out.push({ pts, n })
    }
    r.q.push({ d: key(center), draw() { for (const f of out) { g.beginPath(); f.pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.closePath(); g.fillStyle = rgb(color, shade(f.n, o.ambient ?? 0.5) * (o.glow || 1), o.alpha ?? 1); g.fill(); if (o.edge !== false) { g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 1; g.stroke() } } } })
  }
  // box centred on (x, y, z) with full sizes (sx, sy, sz); opts: rz (roll), ry (yaw), alpha, glow, ambient, edge
  r.box = (x, y, z, sx, sy, sz, color, o = {}) => {
    const hx = sx / 2, hy = sy / 2, hz = sz / 2, base = [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, hy, -hz], [-hx, hy, -hz], [-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]]
    const verts = base.map((v) => { const q = rot(v, o.rz, o.ry); return [x + q[0], y + q[1], z + q[2]] })
    polys([x, y, z], verts, BOXF, color, o)
  }
  // square pyramid (point up) with base at y; w x d base, height h
  r.pyramid = (x, y, z, w, h, d, color, o = {}) => {
    const hx = w / 2, hz = d / 2, base = [[-hx, 0, -hz], [hx, 0, -hz], [hx, 0, hz], [-hx, 0, hz], [0, h, 0]]
    const verts = base.map((v) => { const q = rot(v, o.rz, o.ry); return [x + q[0], y + q[1], z + q[2]] })
    const fl = [[[0, 1, 4], norm([0, hz, -h])], [[1, 2, 4], norm([h, hx, 0])], [[2, 3, 4], norm([0, hz, h])], [[3, 0, 4], norm([-h, hx, 0])], [[0, 3, 2, 1], [0, -1, 0]]]
    polys([x, y + h / 2, z], verts, fl, color, o)
  }
  // two pyramids base to base: a cut gem
  r.gem = (x, y, z, s, color, o = {}) => { r.pyramid(x, y, z, s, s * 0.55, s, color, { ...o, ambient: 0.45 }); r.pyramid(x, y, z, s, -s * 0.55, s, color, { ...o, ambient: 0.35, both: true }) }
  // vertical cylinder: base centre (x, y, z), radius, height
  r.cyl = (x, y, z, rad, h, color, o = {}) => {
    const N = o.seg || 18, top = [], bot = []
    for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2; top.push([x + Math.cos(a) * rad, y + h, z + Math.sin(a) * rad]); bot.push([x + Math.cos(a) * rad, y, z + Math.sin(a) * rad]) }
    const out = []
    for (let i = 0; i < N; i++) { const j = (i + 1) % N, am = ((i + 0.5) / N) * Math.PI * 2, n = [Math.cos(am), 0, Math.sin(am)], fc = [(top[i][0] + top[j][0]) / 2, y + h / 2, (top[i][2] + top[j][2]) / 2]; if (dot(n, sub(r.E, fc)) <= 0) continue; const pts = [bot[i], bot[j], top[j], top[i]].map(r.proj); if (pts.some((p) => !p)) continue; out.push({ pts, n }) }
    const cap = r.E[1] > y + h ? top.map(r.proj) : null
    r.q.push({ d: key([x, y + h / 2, z]), draw() { for (const f of out) { g.beginPath(); f.pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.closePath(); g.fillStyle = rgb(color, shade(f.n, 0.5) * (o.glow || 1), o.alpha ?? 1); g.fill() } if (cap && !cap.some((p) => !p)) { g.beginPath(); cap.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.closePath(); g.fillStyle = rgb(o.top || color, 1.05 * (o.glow || 1), o.alpha ?? 1); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.2)'; g.stroke() } } })
  }
  // lit sphere
  r.sphere = (x, y, z, rad, color, o = {}) => {
    const p = r.proj([x, y, z]); if (!p) return
    const pr = rad * p.k; if (pr < 0.5 || p.x < -pr || p.x > W + pr || p.y < -pr || p.y > H + pr) return
    r.q.push({ d: key([x, y, z]), draw() {
      const gr = g.createRadialGradient(p.x - pr * 0.35, p.y - pr * 0.4, pr * 0.1, p.x, p.y, pr)
      gr.addColorStop(0, rgb(color, 1.45 * (o.glow || 1))); gr.addColorStop(0.55, rgb(color, 1 * (o.glow || 1))); gr.addColorStop(1, rgb(color, 0.5))
      g.globalAlpha = o.alpha ?? 1; g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y, pr, 0, Math.PI * 2); g.fill()
      if (o.shine !== false) { g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.ellipse(p.x - pr * 0.35, p.y - pr * 0.42, pr * 0.22, pr * 0.14, -0.6, 0, Math.PI * 2); g.fill() }
      if (o.ring) { g.strokeStyle = o.ring; g.lineWidth = Math.max(1.5, pr * 0.09); g.beginPath(); g.arc(p.x, p.y, pr, 0, Math.PI * 2); g.stroke() }
      g.globalAlpha = 1 } })
  }
  // flat disc facing the camera with a little thickness (logs, targets, coins)
  r.disc = (x, y, z, rad, thick, color, o = {}) => {
    const p = r.proj([x, y, z]), q = r.proj([x, y, z + thick]); if (!p || !q) return
    r.q.push({ d: key([x, y, z]) + 1, draw() { const pr = rad * p.k, qr = rad * q.k; g.fillStyle = rgb(color, 0.55); g.beginPath(); g.arc(q.x, q.y, qr, 0, Math.PI * 2); g.fill(); const dx = q.x - p.x, dy = q.y - p.y, l = Math.hypot(dx, dy); if (l > 0.5) { g.fillStyle = rgb(color, 0.62); const nx = -dy / l, ny = dx / l; g.beginPath(); g.moveTo(p.x + nx * pr, p.y + ny * pr); g.lineTo(q.x + nx * qr, q.y + ny * qr); g.lineTo(q.x - nx * qr, q.y - ny * qr); g.lineTo(p.x - nx * pr, p.y - ny * pr); g.fill() } g.fillStyle = rgb(o.top || color, 1.05 * (o.glow || 1)); g.beginPath(); g.arc(p.x, p.y, pr, 0, Math.PI * 2); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.2)'; g.lineWidth = 1; g.stroke() } })
  }
  // flat quad on the floor (or any 4 points), 4 corner arrays
  r.quad = (pts, color, o = {}) => { const pp = pts.map(r.proj); if (pp.some((p) => !p)) return; const c = pts.reduce((a, p) => [a[0] + p[0] / 4, a[1] + p[1] / 4, a[2] + p[2] / 4], [0, 0, 0]); r.q.push({ d: key(c) + (o.back ? 1e7 : 0), draw() { g.beginPath(); pp.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.closePath(); g.fillStyle = rgb(color, o.k || 1, o.alpha ?? 1); g.fill() } }) }
  r.floor = (x0, z0, x1, z1, y, color, o = {}) => r.quad([[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], color, { ...o, back: true })
  r.shadow = (x, z, rad, a = 0.3, y = 0.2) => { const p = r.proj([x, y, z]); if (!p) return; r.q.push({ d: 1e8, draw() { g.fillStyle = `rgba(0,0,0,${a})`; g.beginPath(); g.ellipse(p.x, p.y, rad * p.k, rad * p.k * 0.38, 0, 0, Math.PI * 2); g.fill() } }) }
  r.line = (a, b, color = '#fff', w = 2) => { const p = r.proj(a), q = r.proj(b); if (!p || !q) return; r.q.push({ d: key([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]), draw() { g.strokeStyle = rgb(color); g.lineWidth = w * Math.min(2, (p.k + q.k) / 2); g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y); g.stroke(); g.lineWidth = 1 } }) }
  r.text = (x, y, z, s, size, color = '#fff') => { const p = r.proj([x, y, z]); if (!p) return; r.q.push({ d: key([x, y, z]) - 1, draw() { g.font = `bold ${Math.max(8, size * p.k)}px "Press Start 2P", monospace`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = color; g.fillText(s, p.x, p.y) } }) }
  r.emoji = (x, y, z, s, size) => { const p = r.proj([x, y, z]); if (!p) return; r.q.push({ d: key([x, y, z]) - 1, draw() { g.font = `${Math.max(8, size * p.k)}px serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#000'; g.fillText(s, p.x, p.y + 1) } }) }
  r.flush = () => { r.q.sort((a, b) => b.d - a.d); for (const it of r.q) it.draw(); r.q.length = 0 }
  // particles stored in 2D logical coordinates are lifted into the scene as small lit cubes
  r.fx = (arr, lift = (p) => [p.x - W / 2, H - p.y, -8]) => { for (const p of arr) { const [x, y, z] = lift(p); r.box(x, y, z, p.s * 1.4, p.s * 1.4, p.s * 1.4, p.c, { alpha: clamp(p.l * 2, 0, 1), edge: false }) } }
  r.X = (x) => x - W / 2; r.Y = (y) => H - y
  return r
}
export const wrapR3 = (make) => () => {
  const o = make(), old = o.draw; let r = null
  o.draw = (g) => { if (!o.draw3) { old(g); return } if (!r || r.g !== g) r = makeR3(g); o.draw3(r, g) }
  return o
}
