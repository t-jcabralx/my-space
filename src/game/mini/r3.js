import { artGeometries, treeModel, animeActor } from '../artDirection.js'
import { beveledBoxGeometry } from '../modeling.js'
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

// Cache a chamfered unit mesh once, then scale it for all mini-game pieces.
const bevelGeometry = beveledBoxGeometry(0.1)
const bevelPositions = bevelGeometry.getAttribute('position')
const bevelNormals = bevelGeometry.getAttribute('normal')
const BEVEL_VERTS = Array.from({ length: bevelPositions.count }, (_, i) => [bevelPositions.getX(i), bevelPositions.getY(i), bevelPositions.getZ(i)])
const BEVEL_FACES = Array.from({ length: bevelPositions.count / 3 }, (_, i) => [[i * 3, i * 3 + 1, i * 3 + 2], [bevelNormals.getX(i * 3), bevelNormals.getY(i * 3), bevelNormals.getZ(i * 3)]])
bevelGeometry.dispose()

const ART_MESH = Object.fromEntries(Object.entries(artGeometries()).map(([kind,g]) => {
  const geo=g.index?g.toNonIndexed():g, p=geo.getAttribute('position'), n=geo.getAttribute('normal')
  const verts=Array.from({length:p.count},(_,i)=>[p.getX(i),p.getY(i),p.getZ(i)])
  const faces=Array.from({length:p.count/3},(_,i)=>[[i*3,i*3+1,i*3+2],[n.getX(i*3),n.getY(i*3),n.getZ(i*3)]])
  geo.dispose(); if(geo!==g) g.dispose()
  return [kind,{verts,faces}]
}))

export function makeR3(g, W = 360, H = 540) {
  const r = { g, q: [], cam: null, E: [0, 0, 0], R: [1, 0, 0], U: [0, 1, 0], F: [0, 0, 1], focal: 600, clock: 0, phase: Math.random(), weather: 'clear', indoor: false, flat: false, info: { tod: 'DAY', weather: 'CLEAR' } }
  let lastNow = 0
  r.setWeather = (w) => { r.weather = w }
  r.look = (ex, ey, ez, tx, ty, tz, fov = 45) => {
    r.orthographic = false
    const sw = Math.sin(r.clock * 0.7) * 1.4, sh = Math.cos(r.clock * 0.5) * 0.8; r.E = [ex + sw, ey + sh, ez]; r.F = norm([tx - ex - sw, ty - ey - sh, tz - ez]); r.R = norm(cross([0, 1, 0], r.F)); r.U = cross(r.F, r.R); r.focal = (H / 2) / Math.tan((fov * Math.PI) / 360)
  }
  r.screen = (offsetY = 0) => { r.orthographic=true; r.E=[0,H/2+offsetY,-1000]; r.R=[1,0,0]; r.U=[0,1,0]; r.F=[0,0,1] }
  r.proj = (p) => { const d = sub(p, r.E), zc = dot(d, r.F); if (zc < 4) return null; const k = r.orthographic ? 1 : r.focal / zc; return { x: W / 2 + dot(d, r.R) * k, y: H / 2 - dot(d, r.U) * k, z: zc, k } }
  r.pickGround = (x,y,height=0) => { const dx=(x-W/2)/r.focal, dy=(H/2-y)/r.focal, ray=r.F.map((v,i)=>v+dx*r.R[i]+dy*r.U[i]), t=(height-r.E[1])/ray[1]; return Number.isFinite(t)&&t>0?[r.E[0]+ray[0]*t,r.E[2]+ray[2]*t]:null }
  r.ellipsoid = (x,y,z,sx,sy,sz,c,o={}) => { const p=parse(c); r.modelApi.putShape('organic',x,y,z,sx*2,sy*2,sz*2,o.rz||0,p[0]/255,p[1]/255,p[2]/255,o.ry||0) }
  const key = (p) => { const d = sub(p, r.E); return dot(d, d) }
  // rotation about z (roll) then y (yaw) around the centre
  const rot = (v, rz, ry) => { let [x, y, z] = v; if (rz) { const c = Math.cos(rz), s = Math.sin(rz); [x, y] = [x * c - y * s, x * s + y * c] } if (ry) { const c = Math.cos(ry), s = Math.sin(ry); [x, z] = [x * c + z * s, -x * s + z * c] } return [x, y, z] }
  r.begin = (top = '#1b2a6b', bottom = '#0a1030') => {
    const now = typeof performance !== 'undefined' ? performance.now() : 0; if (lastNow) r.clock += Math.min(0.1, (now - lastNow) / 1000); lastNow = now
    if (top === null) g.clearRect(0, 0, W, H); else { const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, top); gr.addColorStop(1, bottom); g.fillStyle = gr; g.fillRect(0, 0, W, H) }
    r.q.length = 0
    // a sun or moon crosses the sky as the day goes by
    if (!r.indoor && !r.flat) { const tod = (r.phase + r.clock / 100) % 1, day = tod < 0.5, u = (day ? tod : tod - 0.5) / 0.5, x = 30 + u * (W - 60), y = 80 - Math.sin(u * Math.PI) * 48; g.globalAlpha = 0.55; g.fillStyle = day ? '#fff2b0' : '#dfe8ff'; g.beginPath(); g.arc(x, y, day ? 16 : 11, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1 }
  }
  const shade = (n, base = 0.5) => base + (1 - base) * (Math.max(0, dot(n, LIGHT)) > .65 ? 1 : Math.max(0, dot(n, LIGHT)) > .15 ? .62 : .12)
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
    if (o.bevel !== false && o.edge !== false) {
      const verts = BEVEL_VERTS.map(([a, b, c]) => { const p = rot([a * sx, b * sy, c * sz], o.rz, o.ry); return [x + p[0], y + p[1], z + p[2]] })
      // Inverse scale keeps the lighting normal correct for long, thin pieces.
      const faces = BEVEL_FACES.map(([idx, n]) => [idx, norm([n[0] / (sx || 1), n[1] / (sy || 1), n[2] / (sz || 1)])])
      polys([x, y, z], verts, faces, color, { ...o, edge: false })
      return
    }
    const hx = sx / 2, hy = sy / 2, hz = sz / 2, base = [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, hy, -hz], [-hx, hy, -hz], [-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]]
    const verts = base.map((v) => { const q = rot(v, o.rz, o.ry); return [x + q[0], y + q[1], z + q[2]] })
    polys([x, y, z], verts, BOXF, color, o)
  }
  r.modelApi = {
    putShape(kind,x,y,z,sx,sy,sz,rz,red,green,blue,ry=0) {
      const mesh=ART_MESH[kind], color=[red*255,green*255,blue*255]
      const verts=mesh.verts.map(v=>{const p=rot([v[0]*sx,v[1]*sy,v[2]*sz],rz,ry);return [x+p[0],y+p[1],z+p[2]]})
      const faces=mesh.faces.map(([idx,n])=>[idx,norm([n[0]/(sx||1),n[1]/(sy||1),n[2]/(sz||1)])])
      polys([x,y,z],verts,faces,color,{rz,ry,edge:false,ambient:.5,alpha:r.modelAlpha??1})
    },
    put3(x,y,z,sx,sy,sz,rz,red,green,blue,ry=0) { r.box(x,y,z,sx,sy,sz,[red*255,green*255,blue*255],{rz,ry}) },
  }
  r.tree=(x,y,z,h=14,seed=1,kind='oak',color='#44854a')=>treeModel(r.modelApi,x,y,z,h,seed,r.clock,{kind,leaf:parse(color).map(v=>v/255),low:true})
  r.person=(x,y,z,color,phase=0,scale=1,o={})=>{
    const previous=r.modelAlpha; r.modelAlpha=o.alpha??1
    try { animeActor(r.modelApi,x,y,z,10*scale,o.yaw??Math.PI,r.clock,{...o,color:parse(color).map(v=>v/255),phase,moving:Math.abs(phase)>.01,hair:o.hair?parse(o.hair).map(v=>v/255):undefined}) }
    finally { r.modelAlpha=previous }
  }
  r.car = (x, y, z, color, scale = 1, phase = 0) => {
    const box = (a, b, c, w, h, d, col) => r.box(x + a * scale, y + b * scale, z + c * scale, w * scale, h * scale, d * scale, col)
    box(0, 1.3, 0, 3.8, 1.3, 7, color)
    box(0, 2.4, -0.3, 3, 1.2, 3.3, '#25445b')
    box(0, 3.05, -0.3, 3, 0.3, 2.7, color)
    box(0, 1.35, -3.5, 2, 0.35, 0.25, '#17202b')
    for (const side of [-1, 1]) {
      box(side * 1.3, 1.55, -3.5, 0.8, 0.35, 0.3, '#fff3b0')
      box(side * 1.3, 1.55, 3.5, 0.8, 0.35, 0.3, '#ff394a')
      for (const dz of [-2.2, 2.2]) {
        box(side * 1.9, 0.8, dz, 0.6, 1.6, 1.65, '#151923')
        box(side * 2.23, 0.8, dz, 0.12, 0.9, 0.9, '#abb9c8')
        box(side * 2.3, 0.8 + Math.sin(phase) * 0.22, dz + Math.cos(phase) * 0.22, 0.13, 0.2, 0.2, '#39495c')
      }
    }
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
  r.gradient=(x,y,z,w,h,top,bottom)=>{
    const pts=[[-1,1],[1,1],[1,-1],[-1,-1]].map(([a,b])=>r.proj([x+a*w/2,y+b*h/2,z]));if(pts.some(p=>!p))return
    r.q.push({d:key([x,y,z]),draw(){const gr=g.createLinearGradient(pts[0].x,pts[0].y,pts[3].x,pts[3].y);gr.addColorStop(0,top);gr.addColorStop(1,bottom);g.beginPath();pts.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));g.closePath();g.fillStyle=gr;g.fill()}})
  }
  r.floor = (x0, z0, x1, z1, y, color, o = {}) => r.quad([[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], color, { ...o, back: true })
  r.shadow = (x, z, rad, a = 0.3, y = 0.2) => { const p = r.proj([x, y, z]); if (!p) return; r.q.push({ d: 1e8, draw() { g.fillStyle = `rgba(0,0,0,${a})`; g.beginPath(); g.ellipse(p.x, p.y, rad * p.k, rad * p.k * 0.38, 0, 0, Math.PI * 2); g.fill() } }) }
  r.line = (a, b, color = '#fff', w = 2) => { const p = r.proj(a), q = r.proj(b); if (!p || !q) return; r.q.push({ d: key([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]), draw() { g.strokeStyle = rgb(color); g.lineWidth = w * Math.min(2, (p.k + q.k) / 2); g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y); g.stroke(); g.lineWidth = 1 } }) }
  r.text = (x, y, z, s, size, color = '#fff') => { const p = r.proj([x, y, z]); if (!p) return; r.q.push({ d: key([x, y, z]) - 1, draw() { g.font = `bold ${Math.max(8, size * p.k)}px "Press Start 2P", monospace`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = color; g.fillText(s, p.x, p.y) } }) }
  r.emoji = (x, y, z, s, size) => { const p = r.proj([x, y, z]); if (!p) return; r.q.push({ d: key([x, y, z]) - 1, draw() { g.font = `${Math.max(8, size * p.k)}px serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#000'; g.fillText(s, p.x, p.y + 1) } }) }
  r.flush = () => {
    r.q.sort((a, b) => b.d - a.d); for (const it of r.q) it.draw(); r.q.length = 0
    if (r.flat) return
    // 4th dimension: time of day tints the whole scene, and weather drifts through it
    const tod = (r.phase + r.clock / 100) % 1, d = clamp(Math.sin(tod * Math.PI * 2) * 1.4 + 0.35, 0, 1), k = r.indoor ? 0.35 : 1
    const warm = clamp(1 - Math.abs(d - 0.35) * 3.2, 0, 1) * (tod > 0.4 && tod < 0.6 || tod > 0.93 || tod < 0.07 ? 1 : 0)
    const lerp = (a, b, u) => a + (b - a) * u
    const cr = lerp(255, lerp(95, 255, d), k), cg = lerp(255, lerp(110, 255, d), k), cb = lerp(255, lerp(175, 255, d), k)
    g.globalCompositeOperation = 'multiply'; g.fillStyle = `rgb(${Math.round(lerp(cr, 255, warm * 0.4))},${Math.round(lerp(cg, 215, warm * 0.45 * k))},${Math.round(lerp(cb, 175, warm * 0.5 * k))})`; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over'
    const wx = r.indoor ? 'clear' : r.weather, t = r.clock
    if (wx === 'rain') { g.strokeStyle = 'rgba(190,215,255,0.5)'; g.lineWidth = 1; g.beginPath(); for (let i = 0; i < 70; i++) { const x = ((i * 53 + t * 140) % (W + 40)) - 20, y = ((i * 97 + t * 520) % (H + 40)) - 20; g.moveTo(x, y); g.lineTo(x - 5, y + 14) } g.stroke(); if (Math.sin(t * 0.7) > 0.985) { g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(0, 0, W, H) } }
    else if (wx === 'snow') { g.fillStyle = 'rgba(255,255,255,0.85)'; for (let i = 0; i < 60; i++) { const x = ((i * 61 + Math.sin(t + i) * 14 + t * 10) % (W + 20)) - 10, y = ((i * 89 + t * (30 + (i % 4) * 14)) % (H + 20)) - 10; g.fillRect(x, y, 2.4, 2.4) } }
    else if (wx === 'fog') { const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(210,225,240,0.05)'); gr.addColorStop(0.55, 'rgba(210,225,240,0.32)'); gr.addColorStop(1, 'rgba(210,225,240,0.1)'); g.fillStyle = gr; g.fillRect(0, 0, W, H) }
    r.info = { tod: d > 0.75 ? 'DAY' : d > 0.3 ? (tod < 0.5 ? 'DAWN' : 'DUSK') : 'NIGHT', weather: wx.toUpperCase() }
  }
  // particles stored in 2D logical coordinates are lifted into the scene as small lit cubes
  r.fx = (arr, lift = (p) => [p.x - W / 2, H - p.y, -8]) => { for (const p of arr) { const [x, y, z] = lift(p); r.box(x, y, z, p.s * 1.4, p.s * 1.4, p.s * 1.4, p.c, { alpha: clamp(p.l * 2, 0, 1), edge: false }) } }
  r.X = (x) => x - W / 2; r.Y = (y) => H - y
  return r
}
const WEATHERS = ['clear', 'clear', 'clear', 'rain', 'snow', 'fog']
export const wrapR3 = (make, indoor = false) => () => {
  const o = make(), old = o.draw, reset = o.reset; let r = null, wx = WEATHERS[(Math.random() * WEATHERS.length) | 0]
  o.attachRenderer = (renderer) => { r = renderer; r.indoor = indoor }
  o.toGamePoint = (x,y) => r?.boardPoint?.(x,y) || [x,y]
  o.reset = (...a) => { wx = WEATHERS[(Math.random() * WEATHERS.length) | 0]; return reset(...a) }
  o.draw = (g) => { if (!o.draw3) { old(g); return } if (!r || r.g !== g) { r = makeR3(g); r.indoor = indoor } r.weather = wx; o.draw3(r, g); o.env4d = r.info }
  return o
}
