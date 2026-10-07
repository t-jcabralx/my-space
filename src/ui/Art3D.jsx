'use client'
// Animated 3D thumbnail for a dashboard card, and the game logo badge. Thumbnails only animate while visible.
import { useEffect, useRef } from 'react'
import { ART } from '../game/mini/art.js'
import { makeR3 } from '../game/mini/r3.js'

export const hasArt = (id) => !!ART[id]

export function Art3D({ id }) {
  const ref = useRef(null)
  useEffect(() => {
    const c = ref.current, scene = ART[id]
    if (!c || !scene) return undefined
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    c.width = 320 * dpr; c.height = 180 * dpr
    const g = c.getContext('2d'), r = makeR3(g, 320, 180); r.flat = true
    let raf = 0, vis = true, last = 0
    const t0 = performance.now(), off = (id.length * 0.9) % 3
    let still = false
    try { still = window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { /* ignore */ }
    const draw = (now) => { g.setTransform(dpr, 0, 0, dpr, 0, 0); scene(r, (now - t0) / 1000 + off); r.flush() }
    const loop = (now) => { raf = 0; if (!vis) return; if (now - last >= 33) { last = now; draw(now) } if (!still) raf = requestAnimationFrame(loop) }
    let io = null
    if (typeof IntersectionObserver !== 'undefined') { io = new IntersectionObserver((es) => { vis = es[0].isIntersecting; if (vis && !raf) raf = requestAnimationFrame(loop) }, { rootMargin: '120px' }); io.observe(c) }
    raf = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(raf); if (io) io.disconnect() }
  }, [id])
  return <canvas ref={ref} className="art3d" aria-hidden="true" />
}

const LOGO = { space: '#3de8ff', empire: '#ffd23a', cards: '#3dff7a', slug: '#7dff6a', pickle: '#ffe84a', bomber: '#ff7a3a', tetris: '#3de8ff', chomp: '#ffe84a', race: '#ffd23a', fight: '#ff5a6a', flames: '#ff4d8a', c4: '#ff5a6a', mini: '#b27aff', snake: '#7dff6a', climb: '#9fd8ff', kong: '#ff9a3a', hunt: '#b27aff', garden: '#7dff6a', orb: '#b27aff', ssx: '#7ad8ff', breaker: '#ff4de1', mines: '#c8c8d8', hockey: '#3de8ff', pool: '#2aaa4a', td: '#3de8ff', rogue: '#ff9a3a', rhythm: '#ff4de1', word: '#ffe84a', merge: '#f2b179', topcard: '#ffd23a', shipcard: '#3de8ff' }
const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16); return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(v * k))).toString(16).padStart(2, '0')).join('') }
// the game's emblem: a small spinning 3D plaque with a coloured rim, a lit face and the game's icon
export function GameLogo({ emoji, cls }) {
  const ref = useRef(null)
  const c0 = LOGO[cls] || '#3de8ff'
  useEffect(() => {
    const c = ref.current; if (!c) return undefined
    const dpr = Math.min(2, window.devicePixelRatio || 1), S = 96
    c.width = S * dpr; c.height = S * dpr
    const g = c.getContext('2d'), r = makeR3(g, S, S); r.flat = true
    let raf = 0, vis = true, last = 0, still = false
    const off = (cls.length * 1.7) % 6, t0 = performance.now()
    try { still = window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { /* ignore */ }
    const draw = (now) => {
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      const t = (now - t0) / 1000 + off, a = Math.sin(t * 1.3) * 0.4
      r.look(0, 0, -64, 0, 0, 0, 38); r.begin(null)
      r.sphere(0, 0, 14, 25, c0, { alpha: 0.22, glow: 1.5, shine: false })
      r.box(0, 0, 0, 36, 36, 11, shade(c0, 0.5), { ry: a })
      r.box(0, 0, -3.4, 33, 33, 6, c0, { ry: a, glow: 1.12 })
      r.box(0, 0, -6.8, 27, 27, 2.4, '#0d1436', { ry: a, edge: false })
      r.box(-9, 11, -8.6, 9, 3, 1.2, '#ffffff', { ry: a, alpha: 0.5, edge: false })
      r.emoji(Math.sin(a) * -3, -1, -10, emoji, 19)
      const sp = (t * 0.7) % 1; r.sphere(-16 + sp * 32, 14 - sp * 28, -14, 1.8 * (1 - Math.abs(sp - 0.5)), '#ffffff', { glow: 1.6, shine: false })
      r.flush()
    }
    const loop = (now) => { raf = 0; if (!vis) return; if (now - last >= 50) { last = now; draw(now) } if (!still) raf = requestAnimationFrame(loop) }
    let io = null
    if (typeof IntersectionObserver !== 'undefined') { io = new IntersectionObserver((es) => { vis = es[0].isIntersecting; if (vis && !raf) raf = requestAnimationFrame(loop) }, { rootMargin: '120px' }); io.observe(c) }
    raf = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(raf); if (io) io.disconnect() }
  }, [cls, emoji])
  return <canvas ref={ref} className="glogo3d" aria-hidden="true" title={cls} />
}
export function splitTitle(title) {
  const m = String(title).match(/^(\p{Extended_Pictographic}️?(?:‍\p{Extended_Pictographic}️?)*)\s*(.*)$/u)
  return m ? [m[1], m[2]] : ['', String(title)]
}
