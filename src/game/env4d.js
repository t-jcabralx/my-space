// The "4th dimension": time of day and weather, shared by the 3D games. Pure helpers; every game decides how to use them.
import { clamp, rng } from './pxl.js'
const TAU = Math.PI * 2
export const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t) }
export const hexRgb = (h) => { const n = parseInt(String(h).replace('#', '').padEnd(6, '0').slice(0, 6), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255] }
export const rgbHex = (a) => '#' + a.map((v) => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, '0')).join('')
export const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]
export function pickWeather(seed, odds = { clear: 0.5, rain: 0.2, fog: 0.15, snow: 0.15 }) {
  let x = rng((seed | 0) * 31 + 7)() * Object.values(odds).reduce((a, b) => a + b, 0)
  for (const k in odds) { x -= odds[k]; if (x <= 0) return k }
  return 'clear'
}
// tod runs 0..1 (0 midnight, .25 sunrise, .5 noon, .75 sunset)
export function timeOf(tod0, t, dayLen) {
  const tod = ((tod0 || 0) + t / dayLen) % 1
  const el = Math.sin((tod - 0.25) * TAU), day = sstep(-0.12, 0.3, el)
  return { tod, el, day, night: 1 - day, glow: clamp(1 - Math.abs(el) / 0.3, 0, 1), ang: (tod - 0.25) * TAU }
}
// the look of the sky / fog / lights at that moment; base = { sky, fog, sun, amb, dir } for full daylight
export function skyFor(T, wx, base) {
  const gray = wx === 'rain' ? [0.34, 0.38, 0.44] : wx === 'snow' ? [0.78, 0.82, 0.88] : wx === 'fog' ? [0.62, 0.66, 0.7] : null
  const gk = wx === 'rain' ? 0.6 : wx === 'snow' ? 0.5 : wx === 'fog' ? 0.75 : 0
  const col = (c, nightC) => { let v = mix(nightC, hexRgb(c), T.day); v = mix(v, [1, 0.5, 0.25], T.glow * 0.5 * (1 - gk * 0.5)); return gray ? mix(v, gray.map((g) => g * (0.25 + 0.75 * T.day)), gk) : v }
  const sunC = mix(mix([0.6, 0.7, 1], hexRgb(base.sun || '#fff1d6'), T.day), [1, 0.55, 0.25], T.glow * 0.7)
  return {
    sky: rgbHex(col(base.sky, [0.03, 0.04, 0.12])), fog: rgbHex(col(base.fog || base.sky, [0.04, 0.05, 0.14])),
    sunColor: rgbHex(sunC), sunI: ((base.sunI || 1.2) * (0.3 + 1.2 * T.day)) * (1 - gk * 0.45), amb: (base.amb || 0.8) * (0.42 + 0.58 * T.day) * (1 - gk * 0.2), dir: (base.dir || 0.15) * (0.4 + 0.6 * T.day),
    fogNear: { clear: 0, rain: 90, fog: 25, snow: 70 }[wx], fogFar: { clear: 0, rain: 380, fog: 200, snow: 300 }[wx] * (0.6 + 0.4 * T.day), gk,
  }
}
export const labelOf = (T, wx) => (T.day > 0.85 ? 'DAY' : T.night > 0.85 ? 'NIGHT' : T.tod < 0.5 ? 'SUNRISE' : 'SUNSET') + (wx === 'clear' ? '' : ' · ' + wx.toUpperCase())
const h2 = (a, b) => { let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296 }
// particles around (cx, cz) in render space: rain streaks, snowflakes, drifting embers or spores
export function weatherFx(put3, cx, cz, kind, t, o = {}) {
  const n = o.n || (kind === 'rain' ? 170 : 130), R = o.r || 70, H = o.h || 46, wind = o.wind || 0, y0 = o.y0 || 0
  if (kind === 'rain') for (let i = 0; i < n; i++) { const y = y0 + H - ((h2(i, 13) * H + t * 70) % H); put3(cx + (h2(i, 11) * 2 - 1) * R + wind * 4, y, cz + (h2(i, 12) * 2 - 1) * R, 0.07, 2.4, 0.07, 0, 0.55, 0.65, 1, 0) }
  else if (kind === 'snow') for (let i = 0; i < n; i++) { const y = y0 + H - ((h2(i, 13) * H + t * 9) % H); put3(cx + (h2(i, 11) * 2 - 1) * R + Math.sin(t * 0.8 + i) * 2.4, y, cz + (h2(i, 12) * 2 - 1) * R + Math.cos(t * 0.6 + i) * 1.6, 0.3, 0.3, 0.3, 0, 1.6, 1.7, 1.9, i) }
  else if (kind === 'embers') for (let i = 0; i < n; i++) { const y = y0 + ((h2(i, 13) * H + t * 6) % H); put3(cx + (h2(i, 11) * 2 - 1) * R + Math.sin(t + i) * 2, y, cz + (h2(i, 12) * 2 - 1) * R, 0.25, 0.25, 0.25, 0, 2.8, 1.1 + h2(i, 4), 0.2, i) }
  else if (kind === 'spores') for (let i = 0; i < n; i++) { const y = y0 + 1 + ((h2(i, 13) * H * 0.5 + t * 2) % (H * 0.5)); put3(cx + (h2(i, 11) * 2 - 1) * R + Math.sin(t * 0.7 + i) * 3, y, cz + (h2(i, 12) * 2 - 1) * R + Math.cos(t * 0.5 + i) * 3, 0.22, 0.22, 0.22, 0, 0.5, 2.2, 1.4, i) }
}
