// One place that decides "is this a touch-first device?". A Windows laptop with a touch screen still has a mouse and keyboard,
// so it must NOT get the on-screen touch pads that phones get: only treat the device as touch-first when the PRIMARY pointer is coarse.
import { useEffect, useState } from 'react'
export function isTouchPrimary() {
  try {
    if (typeof window === 'undefined') return false
    const mm = (q) => window.matchMedia && window.matchMedia(q).matches
    if (mm('(pointer: fine)') && mm('(hover: hover)')) return false // mouse/trackpad present as the main input
    return mm('(pointer: coarse)') || mm('(hover: none)') || (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '') && navigator.maxTouchPoints > 0)
  } catch { return false }
}
export function useTouchPrimary() {
  const [t, setT] = useState(false)
  useEffect(() => {
    const f = () => setT(isTouchPrimary())
    f()
    const m = window.matchMedia && window.matchMedia('(pointer: coarse)')
    if (m && m.addEventListener) { m.addEventListener('change', f); return () => m.removeEventListener('change', f) }
  }, [])
  return t
}
export const isWindows = () => typeof navigator !== 'undefined' && /Windows/i.test(navigator.userAgent || '')
