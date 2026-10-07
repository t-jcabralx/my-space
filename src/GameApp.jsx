'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Canvas } from '@react-three/fiber'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import { World, Stars, Planet, Rig, FlashPlane, Fighters3D, SnowTerrain } from './game/Scene.jsx'
import HUD, { openHelp } from './ui/HUD.jsx'
import VoiceDock from './ui/VoiceDock.jsx'
import './game/slug.js'
import './game/pickle.js'
import { onKey, G, dragShip, setTouchFire, togglePause, subscribe, getSnap } from './game/engine.js'
import { unlockAudio, setMuted, isMuted } from './game/audio.js'
import './game/bomber.js'
import './game/tetris.js'
import './game/chomp.js'
import './game/flames.js'
import './game/fight.js'
import './game/race.js'
import './game/hockey.js'
import './game/pool.js'
import './game/td.js'
import './game/rogue.js'
import './game/rhythm.js'
import './game/word.js'
import './game/merge.js'
import './game/connect4.js'
import './game/snake.js'
import './game/breaker.js'
import './game/mines.js'
import './game/empire.js'
import './game/ssx.js'
import './game/orb.js'
import './game/garden.js'
import './game/hunt.js'
import './game/climb.js'
import './game/kong.js'
import './game/duel.js'
import './game/cards/uno.js'
import './game/cards/pusoy.js'
import './game/cards/lucky9.js'
import './game/cards/tongits.js'
import './game/cards/baccarat.js'
import './game/cards/poker.js'
import { subscribeSettings, getSettings } from './game/settings.js'
import { isTouchPrimary } from './ui/platform.js'

export default function GameApp() {
  const stage = useRef()
  const snap = useSyncExternalStore(subscribe, getSnap)
  const menu = snap && (snap.mode === 'menu' || snap.mode === 'cards' || snap.mode === 'word' || snap.mode === 'merge' || snap.mode === 'c4' || snap.mode === 'mines')
  const [autoLow, setLow] = useState(false)
  const set = useSyncExternalStore(subscribeSettings, getSettings)
  const low = set.quality === 'low' || (set.quality === 'auto' && autoLow)
  useEffect(() => { G.onQuality = () => setLow(true); return () => { G.onQuality = null } }, [])
  // phones: keep the layout in step with the real visible size when the device is turned (Safari reports stale sizes right after a rotation)
  useEffect(() => {
    const fit = () => {
      try {
        const vv = window.visualViewport, h = vv ? vv.height : window.innerHeight, w = vv ? vv.width : window.innerWidth
        document.documentElement.style.setProperty('--vh', h / 100 + 'px'); document.documentElement.style.setProperty('--vw', w / 100 + 'px')
        document.documentElement.dataset.orient = w > h ? 'landscape' : 'portrait'
      } catch { /* ignore */ }
    }
    const later = () => { fit(); setTimeout(fit, 120); setTimeout(() => { fit(); window.dispatchEvent(new Event('resize')) }, 400) }
    fit()
    window.addEventListener('resize', fit); window.addEventListener('orientationchange', later)
    if (window.visualViewport) window.visualViewport.addEventListener('resize', fit)
    if (screen.orientation && screen.orientation.addEventListener) screen.orientation.addEventListener('change', later)
    return () => { window.removeEventListener('resize', fit); window.removeEventListener('orientationchange', later); if (window.visualViewport) window.visualViewport.removeEventListener('resize', fit); if (screen.orientation && screen.orientation.removeEventListener) screen.orientation.removeEventListener('change', later) }
  }, [])
  // the first time a touch player starts a game, ask for fullscreen and landscape (browsers only allow it from a tap)
  const asked = useRef(false)
  useEffect(() => {
    if (asked.current || !snap || snap.mode === 'menu' || snap.mode === 'word' || snap.mode === 'merge' || snap.mode === 'c4' || snap.mode === 'mines' || snap.mode === 'cards') return
    if (!isTouchPrimary()) return
    asked.current = true
    try { const el = document.documentElement; const p = el.requestFullscreen ? el.requestFullscreen() : null; Promise.resolve(p).then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape')).catch(() => {}) } catch { /* ignore */ }
  }, [snap && snap.mode])

  useEffect(() => {
    const down = (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault()
      if ((e.code === 'F1' || e.key === '?') && !e.repeat) { e.preventDefault(); openHelp(); return }
      if (e.code === 'KeyM' && !e.repeat) { unlockAudio(); setMuted(!isMuted()) }
      if (!e.repeat) onKey(e.code, true)
    }
    const up = (e) => onKey(e.code, false)
    const vis = () => { if (document.hidden && G.mode === 'playing' && !G.net) togglePause() }
    const unlock = () => unlockAudio()
    window.addEventListener('pointerdown', unlock, true)
    window.addEventListener('click', unlock, true)
    window.addEventListener('touchend', unlock, true)
    window.addEventListener('keydown', unlock, true)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    document.addEventListener('visibilitychange', vis)
    return () => { window.removeEventListener('pointerdown', unlock, true); window.removeEventListener('click', unlock, true); window.removeEventListener('touchend', unlock, true); window.removeEventListener('keydown', unlock, true); window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); document.removeEventListener('visibilitychange', vis) }
  }, [])

  // gamepad: pad 1 -> WASD side, pad 2 -> arrows side
  useEffect(() => {
    const prev = [{}, {}]
    let raf
    const MAPS = [
      { axes: ['KeyA', 'KeyD', 'KeyW', 'KeyS'], btn: { 0: ['Space'], 2: ['KeyJ', 'KeyF'], 3: ['KeyG'], 1: ['KeyB', 'KeyH'], 4: ['KeyE'], 5: ['KeyR'], 6: ['KeyQ'], 7: ['KeyV'], 9: ['Escape'], 12: ['KeyW'], 13: ['KeyS'], 14: ['KeyA'], 15: ['KeyD'] } },
      { axes: ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'], btn: { 0: ['Enter'], 2: ['Comma'], 3: ['Period'], 1: ['Slash'], 12: ['ArrowUp'], 13: ['ArrowDown'], 14: ['ArrowLeft'], 15: ['ArrowRight'] } },
    ]
    const press = (code, on, st) => { if (!!st[code] === on) return; st[code] = on; onKey(code, on) }
    const loop = () => {
      const pads = (navigator.getGamepads && navigator.getGamepads()) || []
      const list = [...pads].filter(Boolean).slice(0, 2)
      list.forEach((pad, i) => {
        const m = MAPS[i], st = prev[i]
        const [l, r, u, d] = m.axes
        const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0
        press(l, ax < -0.45, st); press(r, ax > 0.45, st); press(u, ay < -0.45, st); press(d, ay > 0.45, st)
        for (const [b, codes] of Object.entries(m.btn)) {
          const on = !!(pad.buttons[b] && pad.buttons[b].pressed)
          for (const c of codes) { if (b >= 12 && b <= 15) { if (on !== !!st['b' + b]) { onKey(c, on) } } else press(c, on, st) }
          if (b >= 12 && b <= 15) st['b' + b] = on
        }
      })
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  // touch / mouse drag: ship follows finger movement and auto-fires
  const last = useRef(null)
  const onDown = (e) => {
    if (e.target.closest('button')) return
    unlockAudio()
    last.current = { x: e.clientX, y: e.clientY }
    if (G.mode === 'playing') setTouchFire(true)
  }
  const onMove = (e) => {
    if (!last.current) return
    const r = stage.current.getBoundingClientRect()
    const k = 100 / r.width
    dragShip((e.clientX - last.current.x) * k * 1.25, -(e.clientY - last.current.y) * k * 1.25)
    last.current = { x: e.clientX, y: e.clientY }
  }
  const onUp = () => { last.current = null; setTouchFire(false) }

  return (
    <div className="wrap">
      <div className={'stage' + (low ? ' low' : '') + (menu ? ' menu' : '')} ref={stage} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onPointerLeave={onUp}>
        <Canvas camera={{ position: [0, 0, 77], fov: 40, near: 1, far: 400 }} dpr={low ? 0.75 : [1, 1.5]} gl={{ antialias: false, powerPreference: 'high-performance' }}>
          <color attach="background" args={['#04050d']} />
          <ambientLight intensity={1.2} />
          <directionalLight position={[-30, 40, 60]} intensity={2.2} />
          <Stars />
          <Planet />
          <World />
          <Fighters3D />
          <SnowTerrain />
          <FlashPlane />
          <Rig />
          {!low && (
            <EffectComposer multisampling={0}>
              <Bloom intensity={0.8} luminanceThreshold={0.62} luminanceSmoothing={0.25} mipmapBlur />
              <Vignette eskil={false} offset={0.2} darkness={0.7} />
            </EffectComposer>
          )}
        </Canvas>
        <HUD />
        <VoiceDock />
      </div>
    </div>
  )
}
