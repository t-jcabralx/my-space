'use client'

import { useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import { World, Stars, Planet, Rig, FlashPlane } from './game/Scene.jsx'
import HUD from './ui/HUD.jsx'
import './game/slug.js'
import './game/pickle.js'
import { onKey, G, dragShip, setTouchFire, togglePause } from './game/engine.js'
import { unlockAudio, setMuted, isMuted } from './game/audio.js'

export default function GameApp() {
  const stage = useRef()
  const [low, setLow] = useState(false)
  useEffect(() => { G.onQuality = () => setLow(true); return () => { G.onQuality = null } }, [])

  useEffect(() => {
    const down = (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault()
      if (e.code === 'KeyM' && !e.repeat) { unlockAudio(); setMuted(!isMuted()) }
      if (!e.repeat) onKey(e.code, true)
    }
    const up = (e) => onKey(e.code, false)
    const vis = () => { if (document.hidden && G.mode === 'playing') togglePause() }
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
      <div className={'stage' + (low ? ' low' : '')} ref={stage} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onPointerLeave={onUp}>
        <Canvas camera={{ position: [0, 0, 77], fov: 40, near: 1, far: 400 }} dpr={low ? 0.75 : [1, 1.5]} gl={{ antialias: false, powerPreference: 'high-performance' }}>
          <color attach="background" args={['#04050d']} />
          <ambientLight intensity={1.2} />
          <directionalLight position={[-30, 40, 60]} intensity={2.2} />
          <Stars />
          <Planet />
          <World />
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
      </div>
    </div>
  )
}
