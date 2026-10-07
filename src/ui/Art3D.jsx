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
    const g = c.getContext('2d'), r = makeR3(g, 320, 180)
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
export function GameLogo({ emoji, cls }) {
  const c = LOGO[cls] || '#3de8ff'
  return <span className="glogo" style={{ '--lc': c }} aria-hidden="true"><span className="glogo-in"><span className="glogo-e">{emoji}</span></span></span>
}
export function splitTitle(title) {
  const m = String(title).match(/^(\p{Extended_Pictographic}️?(?:‍\p{Extended_Pictographic}️?)*)\s*(.*)$/u)
  return m ? [m[1], m[2]] : ['', String(title)]
}
