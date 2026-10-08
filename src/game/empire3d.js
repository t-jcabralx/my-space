import { treeModel, animeActor } from './artDirection.js'
import { modelApi } from './modeling.js'
// 3D look of EMPIRE RISE: a tiny medieval world. Lit cottages, keeps that grow into castles, farms, forests, soldiers with animated walks and swings.
import { G } from './engine.js'
import { col, clamp } from './pxl.js'
const TAU = Math.PI * 2
const hex = (h, k = 1) => { const c = col(h); return [c[0] * k, c[1] * k, c[2] * k] }
const T = 2

export function empireCamera(EM, aspect) {
  const z = EM.cam.z, dist = 72 / z, s = G.shake || 0
  const tx = EM.cam.x, tz = -EM.cam.y
  return { x: tx + (Math.random() - 0.5) * s * 0.5, y: dist * 0.78, z: tz + dist * 0.62, tx, ty: 0, tz, fov: 40, far: 700, aspect }
}
import { timeOf, skyFor, labelOf, weatherFx } from './env4d.js'
// a full day every 7 minutes; the weather is picked from the map seed
export function empireEnv(EM) {
  const T = timeOf(EM.tod0 === undefined ? 0.4 : EM.tod0, EM.t || 0, 420), wx = EM.weather || 'clear'
  const E = skyFor(T, wx, { sky: '#7fb4ff', fog: '#a8c4e8', sun: '#fff1d6', sunI: 1.25, amb: 0.85, dir: 0.12 })
  E.T = T; E.wx = wx; E.label = labelOf(T, wx)
  E.fogNear = wx === 'clear' ? 0 : E.fogNear * 0.9; E.fogFar = wx === 'clear' ? 0 : E.fogFar * 0.9
  return E
}
export const empireLights = (EM) => { const E = empireEnv(EM); return { sun: { x: EM.cam.x - 40 + Math.cos(E.T.ang) * 50, y: 40 + Math.max(0.15, E.T.el) * 70, z: -EM.cam.y + 50, color: E.sunColor, intensity: E.sunI }, target: { x: EM.cam.x, z: -EM.cam.y }, ambient: E.amb, dir: E.dir, lantern: E.T.night > 0.25 ? { x: EM.cam.x, y: 14, z: -EM.cam.y + 4, color: '#ffcf8a', intensity: 2.4 * E.T.night, distance: 95 } : null } }

// ---------- terrain ----------
function tileDraw(api, EM, i, j, step, t) {
  const { put3, putS } = api
  const tt = EM.terr[j * MWc + i], x = (i + step / 2) * T, z = -((j + step / 2) * T), s = T * step + 0.05
  const n = ((i * 7 + j * 13) % 7) * 0.012
  if (tt === 0) { const g = (i + j) & 1 ? [0.08, 0.27, 0.09] : [0.1, 0.31, 0.11]; put3(x, 0, z, s, 0.6, s, 0, g[0] + n, g[1] + n, g[2] + n, 0);
    if (step === 1) {
      const h2 = (i * 53 + j * 29) % 37
      if (h2 === 0) { put3(x, 0.75, z, 1.1, 0.9, 1.1, 0, 0.05, 0.28, 0.08, i); put3(x + 0.2, 1.2, z - 0.1, 0.7, 0.6, 0.7, 0, 0.08, 0.34, 0.1, j) }              // bush
      else if (h2 === 7) { put3(x, 0.6, z, 0.9, 0.7, 0.8, 0, 0.3, 0.3, 0.34, i); put3(x + 0.5, 0.5, z + 0.3, 0.5, 0.45, 0.5, 0, 0.26, 0.26, 0.3, j) }                // rocks
      else if (h2 === 14) { put3(x, 0.55, z, 0.12, 0.5, 0.12, 0, 0.7, 0.62, 0.5, 0); put3(x, 0.85, z, 0.55, 0.22, 0.55, 0, 2, 0.3, 0.3, 0) }                          // mushroom
      else if (h2 === 21) { for (let q = 0; q < 3; q++) put3(x + (q - 1) * 0.35, 0.8, z + ((q * 5) % 3 - 1) * 0.3, 0.1, 0.9, 0.1, Math.sin(t * 2 + i + q) * 0.15, 0.12, 0.4, 0.1, 0) }  // tall grass
      else if (h2 === 28) { put3(x, 0.55, z, 0.9, 0.2, 0.28, 0, 0.36, 0.22, 0.1, i); put3(x + 0.4, 0.8, z, 0.2, 0.5, 0.2, 0, 0.36, 0.22, 0.1, 0) }                    // stump
    } if (step === 1 && ((i * 31 + j * 17) % 11) === 0) { putS(x, 0.75, z, 0.35, 0.35, 0.35, 3, 0.8 + (i % 3) * 0.7, 0.6) } if (step === 1 && ((i * 19 + j * 23) % 9) === 0) put3(x, 0.6, z, 0.12, 0.8, 0.12, 0.2 * Math.sin(t * 2 + i), 0.12, 0.5, 0.14, 0) }
  else if (tt === 4) { const w = 0.85 + Math.sin(t * 1.4 + i * 0.6 + j * 0.45) * 0.12; put3(x, -0.35, z, s, 0.5, s, 0, 0.03 * w, 0.14 * w, 0.4 * w, 0); if (step === 1 && ((i + j + (t * 0.8 | 0)) % 6) === 0) put3(x, -0.07, z, 0.9, 0.05, 0.12, 0, 0.7, 0.9, 1.4, 0) }
  else if (tt === 1) {
    put3(x, 0, z, s, 0.6, s, 0, 0.05, 0.16, 0.06, 0)
    treeModel(api,x,.3,z,4.2+(i%3)*.22,i*7+j,t,{kind:(i+j)%4===0?'oak':'pine',low:step>1})
  } else if (tt === 2) { put3(x, 0.8, z, s * 0.95, 1.8 + ((i * 3 + j) % 4) * 0.4, s * 0.95, 0, 0.2, 0.2, 0.25, i); put3(x + 0.2, 2, z, s * 0.6, 1.2, s * 0.6, 0, 0.3, 0.3, 0.36, j) }
  else { put3(x, 0.7, z, s * 0.95, 1.6, s * 0.95, 0, 0.18, 0.17, 0.2, i); const g = 0.8 + Math.sin(t * 3 + i * 2 + j) * 0.35; put3(x - 0.3, 1.9, z, 0.5, 1.3, 0.5, 0.3, 3 * g, 2.3 * g, 0.4, 0); put3(x + 0.4, 1.6, z + 0.3, 0.4, 0.9, 0.4, -0.3, 3 * g, 2.3 * g, 0.4, 0) }
}

// ---------- buildings ----------
function flag(api, x, y, z, tc, t, h = 3) { const { put3 } = api; put3(x, y + h / 2, z, 0.18, h, 0.18, 0, 0.5, 0.45, 0.4, 0); const w = Math.sin(t * 5 + x) * 0.25; for (let k = 0; k < 3; k++) put3(x + 0.5 + k * 0.45, y + h - 0.5 - k * 0.04, z + w * (k + 1) * 0.5, 0.5, 0.9, 0.08, 0, tc[0] * 1.6, tc[1] * 1.6, tc[2] * 1.6, 0) }
function drawBuilding(api, b, EM, t, TEAM) {
  const { put3, putS } = api, tc = hex(TEAM[b.owner][0], 1), cx = (b.x + b.w / 2) * T, cz = -((b.y + b.w / 2) * T), W = b.w * T
  const prog = b.built ? 1 : clamp(0.15 + (1 - (b.bt || 0) / (b.type === 'wonder' ? 40 : 4 + b.w * 2)) * 0.85, 0.15, 1)
  const hit = b.hit > 0 ? 1.8 : 1, lowhp = b.hp / b.max < 0.4
  const L = (y) => y * prog
  const stone = [0.46 * hit, 0.44 * hit, 0.48 * hit], wood = [0.34 * hit, 0.2 * hit, 0.1 * hit], wall = [0.62 * hit, 0.55 * hit, 0.42 * hit]
  put3(cx + 0.3, -0.1, cz - 0.3, W + 0.6, 0.2, W + 0.6, 0, 0.1, 0.1, 0.1, 0)                         // dirt under the building
  if (!b.built) { for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) put3(cx + ox * W * 0.46, 2, cz + oz * W * 0.46, 0.25, 4, 0.25, 0, 0.5, 0.35, 0.18, 0); put3(cx, 4, cz - W * 0.46, W, 0.2, 0.2, 0, 0.5, 0.35, 0.18, 0) }
  switch (b.type) {
    case 'hall': {
      const lv = b.lv, kh = 3.4 + lv * 1.4
      put3(cx, L(kh / 2), cz, W * 0.62, L(kh), W * 0.62, 0, wall[0], wall[1], wall[2], 0)
      put3(cx, L(kh + 0.3), cz, W * 0.72, L(0.6), W * 0.72, 0, stone[0], stone[1], stone[2], 0)
      for (let k = 0; k < 4; k++) put3(cx + (k < 2 ? -1 : 1) * W * 0.34, L(kh + 0.9), cz + (k % 2 ? -1 : 1) * W * 0.34, 0.9, L(0.8), 0.9, 0, stone[0], stone[1], stone[2], 0)
      for (let k = 0; k < 3; k++) put3(cx, L(kh + 1 + k * 1.1), cz, W * (0.5 - k * 0.15), L(1.2), W * (0.5 - k * 0.15), 0, tc[0] * (1 - k * 0.1), tc[1] * (1 - k * 0.1), tc[2] * (1 - k * 0.1), 0)
      for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { if (lv >= 2 || (ox < 0 && oz < 0)) { const th = 2.4 + lv * 1.1; put3(cx + ox * W * 0.46, L(th / 2), cz + oz * W * 0.46, 1.4, L(th), 1.4, 0, stone[0], stone[1], stone[2], 0); put3(cx + ox * W * 0.46, L(th + 0.7), cz + oz * W * 0.46, 1.9, L(0.9), 1.9, 0, tc[0], tc[1], tc[2], 0); if (lv >= 3) flag(api, cx + ox * W * 0.46, L(th + 1), cz + oz * W * 0.46, tc, t, 2) } }
      if (lv >= 3) { put3(cx, 1.2, cz + W * 0.5, W * 0.9, 2.4, 0.5, 0, stone[0], stone[1], stone[2], 0); put3(cx, 1.2, cz - W * 0.5, W * 0.9, 2.4, 0.5, 0, stone[0], stone[1], stone[2], 0); put3(cx + W * 0.5, 1.2, cz, 0.5, 2.4, W * 0.9, 0, stone[0], stone[1], stone[2], 0); put3(cx - W * 0.5, 1.2, cz, 0.5, 2.4, W * 0.9, 0, stone[0], stone[1], stone[2], 0) }
      if (lv >= 4) { putS(cx, L(kh + 5), cz, 1.8, 1.8, 1.8, 3.2 * (0.8 + Math.sin(t * 3) * 0.2), 2.6, 0.5); for (let k = 0; k < 6; k++) { const a = t * 1.2 + k; putS(cx + Math.cos(a) * 2.2, L(kh + 5) + Math.sin(a * 2), cz + Math.sin(a) * 2.2, 0.3, 0.3, 0.3, 3, 2.6, 0.8) } }
      flag(api, cx, L(kh + 3.8), cz, tc, t, 3.2)
      put3(cx, 1.2, cz + W * 0.32, 1.2, 2, 0.15, 0, 0.1, 0.05, 0.03, 0)                                // gate
      for (let k = 0; k < 3; k++) put3(cx - 1.2 + k * 1.2, kh * 0.7, cz + W * 0.32, 0.4, 0.6, 0.12, 0, 3, 2.4, 0.8, 0)  // lit windows
      break
    }
    case 'house': put3(cx, L(1.2), cz, W * 0.78, L(2.4), W * 0.68, 0, wall[0], wall[1], wall[2], 0); put3(cx, L(2.9), cz, W * 0.98, L(1.0), W * 0.82, 0, tc[0], tc[1], tc[2], 0); put3(cx, L(3.5), cz, W * 0.7, L(0.9), W * 0.6, 0, tc[0] * 0.9, tc[1] * 0.9, tc[2] * 0.9, 0); put3(cx + 1, L(3.9), cz - 0.5, 0.5, L(1.4), 0.5, 0, 0.3, 0.28, 0.3, 0); put3(cx, L(0.9), cz + W * 0.34, 0.7, L(1.4), 0.1, 0, 0.14, 0.07, 0.04, 0); if (b.built) { putS(cx + 1 + Math.sin(t) * 0.2, 5 + (t * 1.5 % 2), cz - 0.5, 0.6, 0.5, 0.6, 0.7, 0.7, 0.75) } break
    case 'farm': { put3(cx, 0.1, cz, W * 0.98, 0.3, W * 0.98, 0, 0.26, 0.17, 0.08, 0); for (let k = -1; k <= 1; k++) { const gr = 0.5 + 0.5 * Math.sin(t * 0.5 + k) * 0.1 + 0.5; put3(cx, 0.5 + L(0.4) * gr, cz + k * W * 0.28, W * 0.82, L(0.8), 0.45, 0, 0.5, 1.2 + gr * 0.3, 0.16, 0) } put3(cx + W * 0.34, L(0.8), cz - W * 0.34, 0.9, L(1.6), 0.9, 0, wood[0], wood[1], wood[2], 0); put3(cx + W * 0.34, L(1.9), cz - W * 0.34, 1.2, L(0.5), 1.2, 0, tc[0], tc[1], tc[2], 0); break }
    case 'lumber': put3(cx - 0.3, L(1), cz, W * 0.6, L(2), W * 0.6, 0, wood[0], wood[1], wood[2], 0); put3(cx - 0.3, L(2.3), cz, W * 0.76, L(0.6), W * 0.76, 0, tc[0], tc[1], tc[2], 0); for (let k = 0; k < 4; k++) put3(cx + 1.3, 0.4 + (k % 2) * 0.5, cz + 0.7 - k * 0.4, 1.8, 0.45, 0.45, 0, 0.4, 0.24, 0.1, 0); if (b.built) put3(cx + 0.8, 1.6, cz + 1.2, 1.2, 0.1, 0.3, t * 6, 1.6, 1.6, 1.8, 0); break
    case 'quarry': put3(cx, 0.2, cz, W * 0.92, 0.5, W * 0.92, 0, 0.1, 0.1, 0.12, 0); for (let k = 0; k < 4; k++) put3(cx - 1 + (k % 2) * 1.6, 0.8 + (k > 1 ? 0.7 : 0), cz - 0.8 + (k >> 1) * 1.5, 1.3, 1.2, 1.3, k * 0.4, 0.5, 0.5, 0.56, 0); put3(cx + 1.2, L(2), cz + 1.2, 0.3, L(4), 0.3, 0, wood[0], wood[1], wood[2], 0); put3(cx + 0.4, L(3.8), cz + 1.2, 1.9, 0.25, 0.25, Math.sin(t * 2) * 0.3, wood[0], wood[1], wood[2], 0); put3(cx - 1.4, L(1), cz + 1.2, 0.8, 0.5, 0.8, 0, tc[0], tc[1], tc[2], 0); break
    case 'mine': put3(cx, L(1.4), cz, W * 0.9, L(2.8), W * 0.75, 0, 0.2, 0.19, 0.22, 0); put3(cx, L(1.0), cz + W * 0.36, 1.5, L(1.8), 0.4, 0, 0.02, 0.02, 0.03, 0); for (const sd of [-1, 1]) put3(cx + sd * 0.9, L(1.1), cz + W * 0.38, 0.3, L(2.2), 0.3, 0, wood[0], wood[1], wood[2], 0); put3(cx, L(2.3), cz + W * 0.38, 2.2, 0.3, 0.3, 0, wood[0], wood[1], wood[2], 0); { const g = 0.8 + Math.sin(t * 4 + b.id) * 0.4; putS(cx + 1.3, 1, cz + 1.4, 0.9, 0.7, 0.9, 3 * g, 2.3 * g, 0.4); putS(cx - 1.3, 1.6, cz - 0.8, 0.6, 0.5, 0.6, 3 * g, 2.3 * g, 0.4) } put3(cx - 1.3, 0.6, cz + 1.4, 1.2, 0.7, 0.8, 0, tc[0], tc[1], tc[2], 0); break
    case 'barracks': { const busy = b.q.length > 0; put3(cx, L(1.6), cz, W * 0.9, L(3.2), W * 0.62, 0, wall[0], wall[1], wall[2], 0); put3(cx, L(3.6), cz, W * 1.0, L(0.8), W * 0.74, 0, tc[0], tc[1], tc[2], 0); put3(cx, L(4.5), cz, W * 0.7, L(1), W * 0.5, 0, tc[0] * 0.9, tc[1] * 0.9, tc[2] * 0.9, 0); put3(cx, L(1), cz + W * 0.32, 1.3, L(2), 0.12, 0, 0.12, 0.06, 0.03, 0); flag(api, cx - W * 0.4, L(3.8), cz + W * 0.3, tc, t, 3); for (const sd of [-1, 1]) { put3(cx + sd * W * 0.52, 0.6, cz - W * 0.2, 0.3, 1.2, 0.3, 0, wood[0], wood[1], wood[2], 0); put3(cx + sd * W * 0.52, 1.5, cz - W * 0.2, 0.9, 0.9, 0.5, 0, 0.5, 0.4, 0.2, Math.sin(t * 3 + sd) * 0.2) } if (busy) putS(cx, L(5.4), cz, 1.4, 1.4, 1.4, 3 * (0.7 + Math.sin(t * 8) * 0.3), 1.2, 0.3); break }
    case 'tower': { put3(cx, L(3), cz, W * 0.6, L(6), W * 0.6, 0, stone[0], stone[1], stone[2], 0); put3(cx, L(6.3), cz, W * 0.86, L(0.8), W * 0.86, 0, tc[0], tc[1], tc[2], 0); for (let k = 0; k < 4; k++) put3(cx + (k < 2 ? -1 : 1) * W * 0.36, L(7), cz + (k % 2 ? -1 : 1) * W * 0.36, 0.6, L(0.8), 0.6, 0, stone[0], stone[1], stone[2], 0); put3(cx, L(7.2), cz, 0.5, L(1.8), 0.5, 0, 0.5, 0.35, 0.2, 0); putS(cx, L(8.3), cz, 0.9, 0.9, 0.9, 3 * (0.6 + Math.sin(t * 5 + b.id) * 0.4), 2.2, 0.5); for (let k = 0; k < 3; k++) put3(cx, L(3 + k * 1.4), cz + W * 0.31, 0.3, 0.5, 0.1, 0, 0.02, 0.02, 0.03, 0); break }
    case 'wall': put3(cx, L(1.6), cz, W * 0.98, L(3.2), W * 0.98, 0, stone[0], stone[1], stone[2], 0); put3(cx, L(3.6), cz, W * 0.5, L(0.8), W * 0.5, 0, stone[0] * 1.2, stone[1] * 1.2, stone[2] * 1.2, 0); put3(cx, L(0.5), cz, W * 1.02, L(0.4), W * 1.02, 0, tc[0] * 0.7, tc[1] * 0.7, tc[2] * 0.7, 0); break
    case 'wonder': { const g = 0.8 + Math.sin(t * 2.5) * 0.2; for (let k = 0; k < 5; k++) put3(cx, L(0.9 + k * 1.8), cz, W * (0.98 - k * 0.17), L(1.8), W * (0.98 - k * 0.17), 0, 0.7 * hit, 0.6 * hit, 0.34 * hit, k * 0.1); for (let k = 0; k < 4; k++) put3(cx + (k < 2 ? -1 : 1) * W * 0.42, L(2.4), cz + (k % 2 ? -1 : 1) * W * 0.42, 0.9, L(4.8), 0.9, 0, 0.8, 0.7, 0.4, 0); putS(cx, L(10.4) + Math.sin(t * 2) * 0.4, cz, 2.6, 2.6, 2.6, 3.4 * g, 2.8 * g, 0.6); for (let k = 0; k < 8; k++) { const a = t * 1.5 + (k / 8) * TAU; putS(cx + Math.cos(a) * 4, 7 + Math.sin(a * 2 + t) * 1.2, cz + Math.sin(a) * 4, 0.4, 0.4, 0.4, 3, 2.6, 0.8) } for (let k = 0; k < 9; k++) put3(cx, 12 + k * 1.2, cz, 0.5, 1, 0.5, 0, 1.4 * g, 1.2 * g, 0.4 * g, 0); break }
    default: break
  }
  if (b.built && b.lv > 1 && b.type !== 'hall' && b.type !== 'wall' && b.type !== 'wonder') upgradeDress(api, b, cx, cz, W, tc, wall, t)
  if (lowhp && b.built) for (let k = 0; k < 3; k++) putS(cx + Math.sin(t * 9 + k * 2 + b.id) * W * 0.3, 2.4 + ((t * 3 + k) % 1.5) * 1.6, cz + Math.cos(t * 7 + k) * W * 0.3, 0.9, 1.2, 0.9, 3, 1 + Math.sin(t * 20 + k) * 0.4, 0.2)
  // health / build bars
  const f = b.built ? clamp(b.hp / b.max, 0, 1) : prog, top = b.type === 'hall' ? 10 + b.lv : b.type === 'wonder' ? 14 : b.type === 'tower' ? 9 : 6
  if (!b.built || b.hp < b.max) for (let u = 0; u < 10; u++) { const on = u / 10 < f; put3(cx - W * 0.4 + (u + 0.5) * (W * 0.8 / 10), top, cz, W * 0.8 / 10 * 0.92, 0.45, 0.4, 0, b.built ? (on ? (f > 0.5 ? 0.3 : 2) : 0.5) : (on ? 2.2 : 0.4), b.built ? (on ? (f > 0.5 ? 2.2 : 0.4) : 0.1) : (on ? 1.8 : 0.3), on ? 0.3 : 0.1, 0) }
  if (EM.sel === b.id) for (let k = 0; k < 24; k++) { const a = (k / 24) * TAU + t; put3(cx + Math.cos(a) * W * 0.78, 0.25, cz + Math.sin(a) * W * 0.78, 0.5, 0.2, 0.5, 0, 3, 3, 3.2, 0) }
}

// level 2 adds an annex and golden trim; level 3 adds banners, lanterns and a finial. Stars hover above upgraded buildings.
function upgradeDress(api, b, cx, cz, W, tc, wall, t) {
  const { put3, putS } = api, gold = [1.9, 1.5, 0.35]
  put3(cx + W * 0.62, 0.9, cz - W * 0.05, W * 0.3, 1.8, W * 0.46, 0, wall[0], wall[1], wall[2], 0)
  put3(cx + W * 0.62, 2.0, cz - W * 0.05, W * 0.4, 0.5, W * 0.56, 0, tc[0], tc[1], tc[2], 0)
  put3(cx, 0.45, cz + W * 0.5, W * 0.92, 0.18, 0.2, 0, gold[0], gold[1], gold[2], 0)
  if (b.lv >= 3) {
    for (const sd of [-1, 1]) { put3(cx + sd * W * 0.52, 1.2, cz + W * 0.5, 0.2, 2.4, 0.2, 0, 0.4, 0.28, 0.16, 0); const g = 0.8 + Math.sin(t * 5 + sd + b.id) * 0.25; putS(cx + sd * W * 0.52, 2.7, cz + W * 0.5, 0.55, 0.55, 0.55, 3 * g, 2.3 * g, 0.7 * g) }
    put3(cx - W * 0.48, 3.4, cz - W * 0.46, 0.2, 6.8, 0.2, 0, 0.45, 0.4, 0.3, 0)
    const w = Math.sin(t * 4 + b.id) * 0.3
    for (let k = 0; k < 3; k++) put3(cx - W * 0.48 + 0.5 + k * 0.4, 6.2 - k * 0.04, cz - W * 0.46 + w * (k + 1) * 0.4, 0.45, 1.1, 0.08, 0, tc[0] * 1.7, tc[1] * 1.7, tc[2] * 1.7, 0)
    putS(cx - W * 0.48, 7, cz - W * 0.46, 0.5, 0.5, 0.5, gold[0] * 1.5, gold[1] * 1.5, gold[2])
  }
  const top = b.type === 'tower' ? 10.4 : b.type === 'barracks' ? 7.6 : 6.4
  for (let k = 0; k < b.lv - 1; k++) { const a = Math.sin(t * 2.4 + k + b.id) * 0.25; putS(cx + (k - (b.lv - 2) / 2) * 1.1, top + a, cz, 0.7, 0.7, 0.7, 3, 2.5, 0.5) }
  if (b.upT > 0) for (let k = 0; k < 14; k++) { const a = (k / 14) * TAU + t * 3, u = 1 - b.upT / 2.6; putS(cx + Math.cos(a) * W * 0.7, 0.5 + u * 5 + (k % 3) * 0.4, cz + Math.sin(a) * W * 0.7, 0.35, 0.35, 0.35, 3, 2.6, 0.7) }
}
// ---------- units ----------
function drawUnit(api, u, EM, t, TEAM, UDEF) {
  api = modelApi(api)
  const { put3, putS } = api, d = UDEF[u.type], raider = u.owner < 0
  const tc = raider ? [1.1, 0.5, 0.2] : hex(TEAM[u.owner][0], 1), fl = u.flash > 0 ? 2.4 : 1
  const X = u.x, Z = -u.y, ry = (u.face || 0) + Math.PI / 2, ca = Math.cos(ry), sa = Math.sin(ry)
  const P = (lx, ly, lz, sx, sy, sz, r, g, b, rz = 0) => put3(X + lx * ca + lz * sa, ly, Z - lx * sa + lz * ca, sx, sy, sz, rz, r * fl, g * fl, b * fl, ry)
  const moving = u._lx !== undefined && Math.hypot(u.x - u._lx, u.y - u._ly) > 0.01
  u._lx = u.x; u._ly = u.y
  const ph = t * 12 + u.id, sw = moving ? Math.sin(ph) * 0.45 : 0, bob = moving ? Math.abs(Math.sin(ph)) * 0.18 : Math.sin(t * 2 + u.id) * 0.05
  const swing = u.atkT > 0 && u.atkT > d.rate - 0.25
  putS(X + 0.2, 0.03, Z + 0.2, 1.6, 0.06, 1.6, 0.01, 0.01, 0.02)
  if (u.type === 'catapult') {
    P(0, 0.6, 0, 2.2, 0.5, 3.2, 0.4, 0.26, 0.12); for (const sd of [-1, 1]) { putS(X + sd * ca * 1.2, 0.55, Z - sd * sa * 1.2, 1, 1, 1, 0.2, 0.14, 0.08) } P(0, 1.2, -0.3, 0.4, 1.4, 0.4, 0.4, 0.26, 0.12)
    const arm = swing ? -1.2 : -0.35; P(0, 1.9, -0.6 + (swing ? 0.9 : 0), 0.35, 0.35, 2.6, 0.4, 0.26, 0.12, arm * 0.0); putS(X + sa * (swing ? 1.2 : -1.0), 2.2, Z + ca * (swing ? 1.2 : -1.0), 0.8, 0.8, 0.8, 0.2, 0.2, 0.22); P(0, 1.1, 1.3, 0.8, 0.5, 0.5, tc[0], tc[1], tc[2])
  } else if (u.type === 'knight') {
    P(0, 1.1 + bob, 0, 1.2, 1.1, 2.8, 0.35, 0.25, 0.18); P(0, 1.9 + bob, 1.3, 0.7, 1.0, 0.8, 0.35, 0.25, 0.18); P(0, 1.2 + bob, -0.1, 1.3, 0.3, 1.4, tc[0] * 1.1, tc[1] * 1.1, tc[2] * 1.1)
    for (const [lx, lz] of [[-0.4, 1], [0.4, 1], [-0.4, -1], [0.4, -1]]) P(lx, 0.45, lz + (lx > 0 ? sw : -sw), 0.3, 1, 0.3, 0.3, 0.2, 0.14)
    P(0, 2.5 + bob, 0.1, 0.9, 1.5, 0.8, tc[0], tc[1], tc[2]); P(0, 3.5 + bob, 0.1, 0.8, 0.8, 0.8, 0.6, 0.6, 0.66); P(0, 4.1 + bob, 0.1, 0.2, 0.5, 0.7, tc[0] * 2, tc[1] * 2, tc[2] * 2)
    P(0.7, 2.6, 1.2 + (swing ? 1 : 0), 0.15, 0.15, 3.2, 1.6, 1.6, 1.8)
  } else {
    const k = raider ? (u.type === 'rbrute' ? 1.45 : 1) : 1
    animeActor(api,X,0,Z,3.15*k,ry,t,{moving,phase:ph,color:tc,skin:[.8,.58,.45],hair:[.12,.08,.06],attack:swing?1-(u.atkT-(d.rate-.25))/.25:0,coat:false,low:true})
    if (raider) { P(0, (2.95 + bob) * k, -0.05, 0.9 * k, 0.5 * k, 0.9 * k, 0.2, 0.12, 0.08); if (u.type === 'raider' || u.type === 'rbrute') P(0.55 * k, (1.9 + bob) * k, 0.7 + (swing ? 0.9 : 0), 0.18, 0.18, 1.4 * k, 1.6, 1.6, 1.8); if (u.type === 'rarcher') P(-0.6, 2, 0.5, 0.15, 1.5, 0.15, 0.4, 0.26, 0.12); if (t % 1 < 0.5 && u.type !== 'rarcher') putS(X + ca * 0.6 * 1 - sa * 0.0, 2.6 * k, Z - sa * 0.6, 0.35, 0.45, 0.35, 3, 1.4, 0.3) }
    else if (u.type === 'sword') { P(0, 3.1 + bob, 0, 0.8, 0.4, 0.8, 0.6, 0.6, 0.68); P(-0.7, 1.7, 0.2, 0.2, 1.0, 0.8, tc[0] * 1.3, tc[1] * 1.3, tc[2] * 1.3); P(0.6, 1.9 + bob, 0.8 + (swing ? 1.0 : 0), 0.16, 0.16, 1.7, 1.8, 1.8, 2.0); if (swing) putS(X + sa * 1.6, 2, Z + ca * 1.6, 0.8, 0.5, 0.8, 3, 3, 2.4) }
    else if (u.type === 'archer') { P(0, 3.0 + bob, -0.1, 0.9, 0.55, 0.9, tc[0] * 0.7, tc[1] * 0.7, tc[2] * 0.7); P(-0.6, 1.9, 0.7, 0.14, 1.7, 0.14, 0.45, 0.28, 0.12, 0.3); P(0.4, 1.7, -0.5, 0.35, 1, 0.35, 0.3, 0.2, 0.1) }
  }
  if (u.hp < u.max) { const f = clamp(u.hp / u.max, 0, 1), y = (u.type === 'catapult' ? 4 : u.type === 'knight' ? 5 : 4); for (let q = 0; q < 6; q++) { const on = q / 6 < f; put3(X - 0.9 + (q + 0.5) * 0.3, y, Z, 0.27, 0.3, 0.25, 0, on ? 0.3 : 0.5, on ? 2.2 : 0.1, on ? 0.4 : 0.1, 0) } }
}

// ---------- villagers at work: woodcutters, miners, farmers, builders, trainees and guards (cosmetic, driven by the clock only) ----------
const lerp = (a, b, u) => a + (b - a) * u
const ss = (u) => u * u * (3 - 2 * u)
// one little person. o: { moving, ph, sw (-1 = no swing, else 0..1 cycle), tool, carry, tint, hat, bend, yo }
function person(api, X, Z, dir, o) {
  api = modelApi(api)
  const { put3, putS } = api, yo = o.yo || 0
  const ry = Math.atan2(dir[0], dir[1]), ca = Math.cos(ry), sa = Math.sin(ry)
  const K = 1.35 // villagers are drawn a little larger than soldiers so the work is readable from the default camera
  const P = (lx, ly, lz, sx, sy, sz, r, g, b) => put3(X + (lx * ca + lz * sa) * K, yo + ly * K, Z + (-lx * sa + lz * ca) * K, sx * K, sy * K, sz * K, 0, r, g, b, ry)
  const ph = o.ph || 0, mv = o.moving, sw = mv ? Math.sin(ph) * 0.45 : 0, bob = mv ? Math.abs(Math.sin(ph)) * 0.16 : Math.sin(ph * 0.2) * 0.04
  const tint = o.tint || [0.5, 0.35, 0.2], skin = [0.8, 0.58, 0.45], dark = [0.22, 0.17, 0.14]
  let up = 0, fw = 0
  const c = o.sw === undefined ? -1 : o.sw
  if (c >= 0) { if (c < 0.6) up = ss(c / 0.6); else if (c < 0.75) { const u = (c - 0.6) / 0.15; up = 1 - u * 1.2; fw = u } else { const u = (c - 0.75) / 0.25; up = -0.2 * (1 - u); fw = 1 - u } }
  const bend = (o.bend || 0) * (0.5 + 0.5 * Math.sin(ph * 0.5))
  putS(X + 0.15, yo + 0.03, Z + 0.15, 1.5 * K, 0.06, 1.5 * K, 0.01, 0.01, 0.02)
  const hy = 1.95 + bob + up * .9 - bend * .3, hz = .5 + fw * .9 + bend * .5
  animeActor(api,X,yo,Z,3.2*K,ry,ph*.12,{moving:mv,phase:ph,color:tint,dark,skin,helmet:o.hat,coat:false,lean:bend*.4,attack:c>=0?c:0})
  const tool = o.tool
  if (tool) {
    const wood = [0.36, 0.22, 0.1], steel = [0.75, 0.78, 0.85]
    if (tool === 'sword') { P(0.65, hy, hz + 0.5, 0.12, 0.12, 1.9, steel[0], steel[1], steel[2]); P(0.65, hy, hz - 0.2, 0.5, 0.12, 0.12, 0.9, 0.7, 0.2) }
    else if (tool === 'bow') { P(0.65, hy, hz + 0.6, 0.12, 1.7, 0.12, wood[0], wood[1], wood[2]) }
    else { P(0.65, hy, hz + 0.6, 0.14, 0.14, 1.6, wood[0], wood[1], wood[2]); if (tool === 'axe') P(0.65, hy, hz + 1.5, 0.12, 0.7, 0.55, steel[0], steel[1], steel[2]); else if (tool === 'pick') P(0.65, hy, hz + 1.5, 0.12, 1.2, 0.2, steel[0], steel[1], steel[2]); else if (tool === 'hammer') P(0.65, hy, hz + 1.5, 0.5, 0.5, 0.7, 0.45, 0.45, 0.5); else if (tool === 'hoe') P(0.65, hy, hz + 1.5, 0.12, 0.2, 0.8, steel[0], steel[1], steel[2]) }
  }
  if (o.carry) { const k = o.carry; if (k.kind === 'log') { P(0, 2.3, -0.7, 1.3, 0.38, 0.38, 0.4, 0.24, 0.1); P(0, 2.7, -0.7, 1.3, 0.38, 0.38, 0.46, 0.28, 0.12) } else if (k.kind === 'stone') P(0, 2.3, -0.75, 0.95, 0.8, 0.8, 0.55, 0.55, 0.6); else if (k.kind === 'gold') putS(X - sa * 0.75 * K, yo + 2.6 * K, Z - ca * 0.75 * K, 0.8 * K, 0.7 * K, 0.8 * K, 3, 2.4, 0.4); else if (k.kind === 'sheaf') P(0, 2.4, -0.7, 0.8, 1.0, 0.5, 1.4, 1.1, 0.3) }
}
// walk between two points with pauses at each end
function pace(t, A, B, walk = 3, pause = 2) {
  const Pd = 2 * (walk + pause), m = ((t % Pd) + Pd) % Pd
  let u, f = 1, moving = true
  if (m < walk) u = ss(m / walk)
  else if (m < walk + pause) { u = 1; moving = false }
  else if (m < 2 * walk + pause) { u = 1 - ss((m - walk - pause) / walk); f = -1 }
  else { u = 0; moving = false }
  const dx = B[0] - A[0], dz = B[1] - A[1], d = Math.hypot(dx, dz) || 1
  return { x: A[0] + dx * u, z: A[1] + dz * u, moving, dir: [dx / d * f, dz / d * f] }
}
function siteOf(b, EM, kind) {
  if (b._site !== undefined && b._siteKind === kind && (b._site === null || EM.terr[b._siteIdx] === kind)) return b._site
  let best = null, bd = 1e9
  const mcx = b.x + b.w / 2, mcy = b.y + b.w / 2
  for (let dj = -5; dj < b.w + 5; dj++) for (let di = -5; di < b.w + 5; di++) {
    const i = b.x + di, j = b.y + dj
    if (i < 0 || j < 0 || i >= MWc || j >= MWc) continue
    if (di >= 0 && di < b.w && dj >= 0 && dj < b.w) continue
    if (EM.terr[j * MWc + i] !== kind) continue
    const d = Math.hypot(i + 0.5 - mcx, j + 0.5 - mcy)
    if (d < bd) { bd = d; best = [(i + 0.5) * T, -((j + 0.5) * T)]; b._siteIdx = j * MWc + i }
  }
  b._site = best; b._siteKind = kind
  return best
}
// out-and-back gatherer: walk to the work site, swing the tool several times, carry the haul home, rest
function gatherer(api, b, t, H, S, cfg) {
  const walk = cfg.walk, per = walk * 2 + cfg.work + cfg.rest, m = (((t + b.id * 1.9 + (cfg.off || 0)) % per) + per) % per
  const dx = S[0] - H[0], dz = S[1] - H[1], d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d
  const stop = Math.max(0, d - 1.7), G2 = [H[0] + ux * stop, H[1] + uz * stop]
  let x, z, moving = false, sw = -1, carry = null, dir = [ux, uz], hide = false
  if (m < walk) { const u = ss(m / walk); x = lerp(H[0], G2[0], u); z = lerp(H[1], G2[1], u); moving = true }
  else if (m < walk + cfg.work) { x = G2[0]; z = G2[1]; sw = ((((m - walk) / cfg.work) * cfg.swings) % 1 + 1) % 1; if (cfg.fx) cfg.fx(api, S, sw, t) }
  else if (m < 2 * walk + cfg.work) { const u = ss((m - walk - cfg.work) / walk); x = lerp(G2[0], H[0], u); z = lerp(G2[1], H[1], u); moving = true; carry = cfg.carry; dir = [-ux, -uz] }
  else { x = H[0]; z = H[1]; dir = [-ux, -uz]; carry = cfg.carry && m < 2 * walk + cfg.work + cfg.rest * 0.4 ? cfg.carry : null; hide = !!cfg.hide }
  if (hide) return
  person(api, x, z, dir, { moving, ph: t * 11 + b.id, sw, tool: moving && !carry ? cfg.tool : cfg.tool, carry, tint: cfg.tint, hat: cfg.hat, brim: cfg.brim, yo: 0 })
}
const chips = (col) => (api, S, sw, t) => { if (sw < 0.72) return; const a = (sw - 0.72) / 0.28; for (let k = 0; k < 4; k++) { const an = k * 1.7 + 0.5; api.putS(S[0] + Math.cos(an) * a * 1.3, 1.4 + a * 1.9 - a * a * 2.2, S[1] + Math.sin(an) * a * 1.3, 0.3, 0.3, 0.3, col[0], col[1], col[2]) } }
function drawWorkers(api, b, EM, t, TEAM) {
  const { put3 } = api, tc = hex(TEAM[b.owner][0], 1), W = b.w * T, cx = (b.x + b.w / 2) * T, cz = -((b.y + b.w / 2) * T)
  const tint = [tc[0] * 0.7 + 0.15, tc[1] * 0.7 + 0.15, tc[2] * 0.7 + 0.15]
  const H = [cx, cz + W * 0.62]
  if (!b.built) {
    // builders hammer away at the frame
    for (let k = 0; k < 2; k++) {
      const a = t * 0.6 + k * 3.1 + b.id, px = cx + Math.cos(a) * W * 0.62, pz = cz + Math.sin(a) * W * 0.62
      person(api, px, pz, [cx - px, cz - pz], { moving: false, ph: t * 4 + k, sw: ((t * 1.1 + k * 0.5) % 1), tool: 'hammer', tint, hat: [0.9, 0.75, 0.2], bend: 0.3 })
    }
    return
  }
  const wood = [0.4, 0.24, 0.1]
  switch (b.type) {
    case 'lumber': { const S = siteOf(b, EM, 1) || [cx + W * 1.3, cz]; for (let k = 0; k < 2 + (b.lv >= 3 ? 1 : 0); k++) gatherer(api, b, t, [H[0] + (k === 1 ? 1.4 : k ? 2.6 : -1.4), H[1]], S, { tool: 'axe', walk: 2.4, work: 3.4, rest: 1.2, swings: 3, carry: { kind: 'log' }, tint: [0.55, 0.14, 0.1], hat: [0.1, 0.35, 0.15], fx: chips([1.8, 1.2, 0.5]), off: k * 2.6 }); break }
    case 'quarry': { const S = siteOf(b, EM, 2) || [cx + W * 1.3, cz]; for (let k = 0; k < 2 + (b.lv >= 3 ? 1 : 0); k++) gatherer(api, b, t, [H[0] + (k === 1 ? 1.4 : k ? 2.6 : -1.4), H[1]], S, { tool: 'pick', walk: 2.4, work: 3.8, rest: 1.2, swings: 4, carry: { kind: 'stone' }, tint: [0.35, 0.33, 0.3], hat: [1.5, 1.2, 0.2], brim: true, fx: chips([2.2, 2.1, 1.8]), off: k * 3 }); break }
    case 'mine': { const S = siteOf(b, EM, 3) || [cx + W * 1.2, cz]; gatherer(api, b, t, [cx, cz + W * 0.42], S, { tool: 'pick', walk: 2, work: 3.4, rest: 2.4, swings: 3, carry: { kind: 'gold' }, tint: [0.3, 0.28, 0.35], hat: [1.5, 1.2, 0.2], brim: true, hide: true, fx: chips([3, 2.4, 0.5]) }); break }
    case 'farm': {
      for (let k = 0; k < 2; k++) {
        const row = (k ? 1 : -1) * W * 0.22, p = pace(t * 0.8 + b.id * 1.3 + k * 4, [cx - W * 0.34, cz + row], [cx + W * 0.34, cz + row], 3.2, 0.6)
        person(api, p.x, p.z, p.dir, { moving: p.moving, ph: t * 8 + k, sw: p.moving ? -1 : ((t * 1.3 + k * 0.4) % 1), tool: 'hoe', bend: 1, tint: [0.7, 0.6, 0.25], hat: [1.5, 1.25, 0.5], brim: true, carry: p.moving && k ? { kind: 'sheaf' } : null })
      }
      break
    }
    case 'house': {
      const p = pace(t * 0.7 + b.id * 2.1, [cx - W * 0.55, cz + W * 0.66], [cx + W * 0.55, cz + W * 0.66], 3.5, 3.5)
      person(api, p.x, p.z, p.dir, { moving: p.moving, ph: t * 7 + b.id, tint, hat: p.moving ? null : [tc[0], tc[1], tc[2]] })
      break
    }
    case 'barracks': {
      const dx = cx + W * 0.7, dz = cz + W * 0.55
      put3(dx, 1.3, dz, 0.3, 2.6, 0.3, 0, wood[0], wood[1], wood[2], 0); put3(dx, 2.2, dz, 1, 1.2, 0.6, 0, 1.2, 1, 0.45, 0); put3(dx, 2.9, dz, 0.6, 0.6, 0.6, 0, 1.2, 1, 0.45, 0); put3(dx, 2.5, dz, 1.6, 0.18, 0.18, 0, wood[0], wood[1], wood[2], 0)
      person(api, dx - 2.1, dz, [1, 0], { moving: false, ph: t * 2, sw: (t * 0.65 + b.id * 0.3) % 1, tool: 'sword', tint: [tc[0], tc[1], tc[2]], hat: [0.7, 0.72, 0.8] })
      person(api, cx - W * 0.36, cz + W * 0.5, [0, 1], { moving: false, ph: t * 2 + 1, tool: 'sword', tint: [tc[0], tc[1], tc[2]], hat: [0.7, 0.72, 0.8] })
      break
    }
    case 'tower': {
      const a = Math.sin(t * 0.5 + b.id) * 1.4
      person(api, cx, cz, [Math.sin(a), Math.cos(a)], { moving: false, ph: t * 2, tool: 'bow', tint: [tc[0], tc[1], tc[2]], hat: [0.7, 0.72, 0.8], yo: 6.9 })
      break
    }
    case 'hall': {
      const n = Math.min(3, b.lv + 1)
      for (let k = 0; k < n; k++) { const p = pace(t * 0.6 + b.id + k * 5, [cx - W * 0.55, cz + W * (0.62 + k * 0.1)], [cx + W * 0.55, cz + W * (0.62 + k * 0.1)], 4, 2.5); person(api, p.x, p.z, p.dir, { moving: p.moving, ph: t * 7 + k, tint: k ? tint : [tc[0], tc[1], tc[2]], hat: k === 0 ? [1.5, 1.2, 0.3] : null }) }
      person(api, cx + W * 0.2, cz + W * 0.36, [0, 1], { moving: false, ph: t * 2, tool: 'sword', tint: [tc[0], tc[1], tc[2]], hat: [0.7, 0.72, 0.8] })
      break
    }
    default: break
  }
}

// ---------- scenery: dirt roads, a campfire and a well at each hall, chimney smoke, birds, butterflies, fireflies ----------
function drawScenery(api, EM, t, cx, cy, rx, ry2, z, E, TEAM) {
  const { put3, putS } = api
  const halls = EM.B.filter((b) => b.type === 'hall' && b.built)
  for (const h of halls) {
    const hx = (h.x + h.w / 2) * T, hz = -((h.y + h.w / 2) * T)
    if (Math.abs(hx - cx) > rx + 10) continue
    const fx = hx + h.w * T * 0.78, fz = hz + h.w * T * 0.72
    for (let k = 0; k < 4; k++) { const a = k * 1.57 + 0.6; put3(fx + Math.cos(a) * 0.7, 0.45, fz + Math.sin(a) * 0.7, 1.1, 0.25, 0.25, 0, 0.36, 0.22, 0.1, a) }
    for (let k = 0; k < 3; k++) { const g = 0.7 + Math.sin(t * 9 + k * 2) * 0.3; putS(fx, 0.9 + k * 0.55 + g * 0.3, fz, 0.8 - k * 0.2, 1 - k * 0.15, 0.8 - k * 0.2, 3 * g, (1.6 - k * 0.4) * g, 0.2) }
    const wx = hx - h.w * T * 0.85, wz = hz + h.w * T * 0.62
    put3(wx, 0.8, wz, 2.2, 1.4, 2.2, 0, 0.42, 0.4, 0.45, 0); put3(wx, 0.95, wz, 1.4, 1.2, 1.4, 0, 0.03, 0.14, 0.35, 0)
    put3(wx - 0.9, 2.2, wz, 0.2, 2.2, 0.2, 0, 0.36, 0.22, 0.1, 0); put3(wx + 0.9, 2.2, wz, 0.2, 2.2, 0.2, 0, 0.36, 0.22, 0.1, 0); put3(wx, 3.3, wz, 2.4, 0.3, 1.6, 0, 0.5, 0.18, 0.12, 0)
    // roads from the hall's door to each of its buildings
    for (const b of EM.B) {
      if (b.owner !== h.owner || b === h || b.type === 'wall') continue
      const bx = (b.x + b.w / 2) * T, bz = -((b.y + b.w / 2) * T)
      if (Math.abs(bx - cx) > rx + 8 || bz > -(cy - ry2 - 16) + 40 || bz < -(cy + ry2 + 8) - 40) continue
      const dx = bx - hx, dz = bz - (hz + h.w * T * 0.4), d = Math.hypot(dx, dz)
      if (d > 46) continue
      for (let u = 2.4; u < d - b.w * T * 0.55; u += 1.7) { const px = hx + dx * (u / d), pz = hz + h.w * T * 0.4 + dz * (u / d); put3(px, 0.32, pz, 1.35, 0.05, 1.35, 0, 0.3 + ((u * 7) % 3) * 0.015, 0.22, 0.12, u) }
    }
  }
  // chimney smoke
  for (const b of EM.B) {
    if (!b.built || (b.type !== 'house' && b.type !== 'hall') || !(b.owner === EM.me || true)) continue
    const bx = (b.x + b.w / 2) * T, bz = -((b.y + b.w / 2) * T)
    if (Math.abs(bx - cx) > rx + 4) continue
    const ox = b.type === 'house' ? 1 : 0, oy = b.type === 'house' ? 4.4 + (b.lv - 1) * 0 : 10 + b.lv
    for (let k = 0; k < 4; k++) { const a = ((t * 0.5 + k * 0.25 + b.id * 0.13) % 1); putS(bx + ox + a * 1.8 + Math.sin(a * 5 + k) * 0.3, oy + a * 5, bz - 0.5, 0.5 + a * 0.9, 0.5 + a * 0.9, 0.5 + a * 0.9, 0.7 * (1 - a), 0.7 * (1 - a), 0.75 * (1 - a)) }
  }
  // birds wheel over the camera, butterflies drift over the grass, fireflies come out at night
  for (let k = 0; k < 5; k++) { const a = t * (0.18 + k * 0.03) + k * 1.3, bx = cx + Math.cos(a) * (18 + k * 7), bz = -cy + Math.sin(a * 1.3) * (12 + k * 5), fl = Math.sin(t * 14 + k) * 0.4; put3(bx, 16 + k * 1.5, bz, 0.9, 0.12, 0.35, fl, 0.05, 0.05, 0.06, a); put3(bx - 0.4, 16 + k * 1.5 + fl * 0.4, bz, 0.6, 0.12, 0.3, -fl, 0.05, 0.05, 0.06, a) }
  if (E.T.night < 0.5) for (let k = 0; k < 9; k++) { const a = t * 0.3 + k * 2.1, bx = cx + Math.sin(a * 0.9 + k) * 32, bz = -cy + Math.cos(a * 0.7 + k * 1.7) * 20 + Math.sin(k) * 8, f = Math.sin(t * 12 + k * 3) * 0.4; put3(bx, 2.3 + Math.sin(a * 2) * 0.8, bz, 0.35, 0.12, 0.5, f, k % 3 ? 2.2 : 0.4, k % 3 === 1 ? 0.5 : 1, k % 3 === 2 ? 2.2 : 0.4, a) }
  if (E.T.night > 0.35) for (let k = 0; k < 16; k++) { const a = t * 0.2 + k * 1.9, bx = cx + Math.sin(a * 0.8 + k * 2) * 40, bz = -cy + Math.cos(a * 0.6 + k) * 24, g = 0.5 + 0.5 * Math.sin(t * 3 + k * 2.3); putS(bx, 1.6 + Math.sin(a * 2 + k) * 0.8, bz, 0.3, 0.3, 0.3, 2.2 * g * E.T.night, 2.4 * g * E.T.night, 0.5) }
}

let MWc = 96
export function drawEmpire3(api, EM, defs) {
  const { put3, putS } = api, t = G.time, { TEAM, UDEF, MW, MH } = defs
  MWc = MW
  const cx = EM.cam.x, cy = EM.cam.y, z = EM.cam.z
  const rx = 64 / z + 8, ry2 = 40 / z + 8
  const step = z < 0.78 ? 2 : 1
  const i0 = Math.max(0, (((cx - rx) / T) | 0) & ~(step - 1)), i1 = Math.min(MW - 1, ((cx + rx) / T) | 0)
  const j0 = Math.max(0, (((cy - ry2 - 14) / T) | 0) & ~(step - 1)), j1 = Math.min(MH - 1, ((cy + ry2 + 6) / T) | 0)
  for (let j = j0; j <= j1; j += step) for (let i = i0; i <= i1; i += step) tileDraw(api, EM, i, j, step, t)
  // the map edge: a dark frame so the world has an end
  put3(MW * T / 2, -0.8, -MH * T / 2, MW * T + 16, 0.4, MH * T + 16, 0, 0.02, 0.03, 0.05, 0)
  for (const b of EM.B) { const bx = (b.x + b.w / 2) * T, by = (b.y + b.w / 2) * T; if (Math.abs(bx - cx) > rx + 6 || by < cy - ry2 - 16 || by > cy + ry2 + 8) continue; drawBuilding(api, b, EM, t, TEAM); if (z >= 0.55) drawWorkers(api, b, EM, t, TEAM) }
  // placement ghost
  if (EM.moving) { const mm = EM.moving, md = defs.BDEF[mm.type], gx2 = (mm.i + md.w / 2) * T, gz2 = -((mm.j + md.w / 2) * T), c2 = mm.ok ? [0.4, 3, 0.9] : [3, 0.4, 0.4]; for (let a = 0; a < md.w * 4; a++) { const u = a / (md.w * 4); const px = gx2 + (u < 0.25 ? -1 + u * 8 : u < 0.5 ? 1 : u < 0.75 ? 1 - (u - 0.5) * 8 : -1) * md.w * T / 2, pz = gz2 + (u < 0.25 ? -1 : u < 0.5 ? -1 + (u - 0.25) * 8 : u < 0.75 ? 1 : 1 - (u - 0.75) * 8) * md.w * T / 2; putS(px, 0.5, pz, 0.5, 0.5, 0.5, c2[0], c2[1], c2[2]) } putS(gx2, 2.4 + Math.sin(t * 4) * 0.3, gz2, md.w * T * 0.5, md.w * T * 0.5, md.w * T * 0.5, c2[0] * 0.4, c2[1] * 0.4, c2[2] * 0.4) }
  if (EM.build && EM.hover) {
    const d = defs.BDEF[EM.build], i = ((EM.hover.x / T) | 0) - (d.w >> 1), j = ((EM.hover.y / T) | 0) - (d.w >> 1), ok = defs.canPlace(EM.build, i, j, EM.me) && EM.P[EM.me] && defs.costOk(EM.P[EM.me].res, d.cost)
    const gx = (i + d.w / 2) * T, gz = -((j + d.w / 2) * T), c = ok ? [0.4, 3, 0.9] : [3, 0.4, 0.4]
    for (let a = 0; a < d.w * 4; a++) { const u = a / (d.w * 4); const px = gx + (u < 0.25 ? -1 + u * 8 : u < 0.5 ? 1 : u < 0.75 ? 1 - (u - 0.5) * 8 : -1) * d.w * T / 2, pz = gz + (u < 0.25 ? -1 : u < 0.5 ? -1 + (u - 0.25) * 8 : u < 0.75 ? 1 : 1 - (u - 0.75) * 8) * d.w * T / 2; putS(px, 0.5, pz, 0.5, 0.5, 0.5, c[0], c[1], c[2]) }
    putS(gx, 2.2 + Math.sin(t * 4) * 0.3, gz, d.w * T * 0.5, d.w * T * 0.5, d.w * T * 0.5, c[0] * 0.4, c[1] * 0.4, c[2] * 0.4)
    const h = EM.B.find((b) => b.owner === EM.me && b.type === 'hall'); if (h) { const R = (16 + h.lv * 3) * T / 2, hx = (h.x + 1.5) * T, hz = -((h.y + 1.5) * T); for (let k = 0; k < 90; k++) { const a = (k / 90) * TAU; put3(hx + Math.cos(a) * R, 0.2, hz + Math.sin(a) * R, 0.5, 0.2, 0.5, 0, 1.4, 1.6, 2) } }
  }
  if (z >= 0.55) drawScenery(api, EM, t, cx, cy, rx, ry2, z, empireEnv(EM), TEAM)
  for (const u of EM.U) { if (Math.abs(u.x - cx) > rx + 4 || u.y < cy - ry2 - 16 || u.y > cy + ry2 + 8) continue; drawUnit(api, u, EM, t, TEAM, UDEF) }
  for (const f of EM.fx) {
    if (f.k === 'shot') { const n = 7; for (let k = 0; k <= n; k++) { const u = k / n, arc = Math.sin(u * Math.PI) * (f.c === '#ff9a3a' ? 7 : 1.4); putS(f.x0 + (f.x1 - f.x0) * u, 2.4 + arc, -(f.y0 + (f.y1 - f.y0) * u), 0.55, 0.55, 0.55, 2.6, 2.2, 1.2) } }
    else if (f.k === 'ping') { for (let k = 0; k < 16; k++) { const a = (k / 16) * TAU, r = 1 + (0.6 - f.l) * 7; putS(f.x + Math.cos(a) * r, 0.5, -f.y + Math.sin(a) * r, 0.5, 0.3, 0.5, 3, 2.6, 0.5) } }
  }
  for (const q of G.parts) { const f = q.life / q.max, s = q.s * (0.3 + 0.5 * f); putS(q.x, 1 + (1 - f) * 2.5, -q.y, s, s, s, q.c[0] * 2, q.c[1] * 2, q.c[2] * 2) }
  { const E = empireEnv(EM); if (E.wx === 'rain' || E.wx === 'snow') weatherFx(put3, cx, -cy, E.wx, t, { y0: 0, h: 40, r: 60 / Math.max(0.6, z) + 20, n: 150 }); else if (E.wx === 'fog') weatherFx(put3, cx, -cy, 'spores', t * 0.4, { y0: 0, h: 16, r: 50, n: 40 }) }
  // raid warning: a column of fire on the edge the raiders will come from
  if (EM.raidWarn > 0) { const dir = EM.raidDir; for (let k = -14; k <= 14; k++) { const wx = dir === 'WEST' ? 3 : dir === 'EAST' ? MW * T - 3 : cx + k * 3, wy = dir === 'SOUTH' ? 3 : dir === 'NORTH' ? MH * T - 3 : cy + k * 2.4, a = 0.6 + 0.4 * Math.sin(t * 8 + k); putS(wx, 2 + Math.abs(Math.sin(t * 6 + k)) * 2, -wy, 1.4, 2.2, 1.4, 3 * a, 0.9 * a, 0.2 * a) } }
}
