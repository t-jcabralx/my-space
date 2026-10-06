// Tiny pixel-drawing helpers shared by the 2D voxel games (disks, rings, boxes, bitmap sprites).
import { rgb } from './sprites.js'
const cache = {}
export const col = (hex) => cache[hex] || (cache[hex] = rgb(hex))
export function disk(put, x, y, r, c, k = 1, z = 0, st = 0.7) {
  const n = Math.ceil(r / st)
  for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) {
    const dx = i * st, dy = j * st
    if (dx * dx + dy * dy <= r * r) put(x + dx, y + dy, z, st * 1.02, st * 1.02, c[0] * k, c[1] * k, c[2] * k)
  }
}
export function circle(put, x, y, r, c, k = 1, z = 0, st = 0.7) {
  const n = Math.max(8, Math.round((Math.PI * 2 * r) / st))
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; put(x + Math.cos(a) * r, y + Math.sin(a) * r, z, st, st, c[0] * k, c[1] * k, c[2] * k) }
}
export function rect(put, x0, y0, x1, y1, c, k = 1, z = 0, st = 1) {
  for (let x = x0; x <= x1 + 1e-6; x += st) for (let y = y0; y <= y1 + 1e-6; y += st) put(x, y, z, st * 1.02, st * 1.02, c[0] * k, c[1] * k, c[2] * k)
}
export function line(put, x0, y0, x1, y1, c, k = 1, z = 0, st = 0.8, dot = 0.6) {
  const d = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(d / st))
  for (let i = 0; i <= n; i++) { const u = i / n; put(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, z, dot, dot, c[0] * k, c[1] * k, c[2] * k) }
}
// bitmap sprite from string rows and a palette map; origin at the centre
export function bmp(put, rows, pal, x, y, px = 0.7, z = 0, k = 1, flip = false) {
  const h = rows.length, w = rows[0].length
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const ch = rows[j][i]; if (ch === '.' || ch === ' ') continue
    const c = pal[ch]; if (!c) continue
    const ix = flip ? w - 1 - i : i
    put(x + (ix - (w - 1) / 2) * px, y + ((h - 1) / 2 - j) * px, z, px * 1.04, px * 1.04, c[0] * k, c[1] * k, c[2] * k)
  }
}
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
export const R = (a, b) => a + Math.random() * (b - a)
export const rng = (seed) => { let s = seed >>> 0; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296 }
