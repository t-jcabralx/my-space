'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { G, update, HW, HH, profile, games } from './engine.js'
import { MISSIONS } from './levels.js'
import { textPx, rgb, SP, shipSprite } from './sprites.js'

const MAXI = 16000
const perf = { acc: 0, n: 0 }

// ---- voxel writer (direct typed-array writes into one InstancedMesh) ----
let n = 0, A = null, C = null
function put(x, y, z, sx, sy, r, g, b) {
  if (n >= MAXI) return
  const o = n * 16
  A[o] = sx; A[o + 5] = sy; A[o + 10] = 1; A[o + 12] = x; A[o + 13] = y; A[o + 14] = z; A[o + 15] = 1
  const c = n * 3
  C[c] = r; C[c + 1] = g; C[c + 2] = b
  n++
}
function sprite(s, x, y, { k = 1, sx = 1, sy = 1, flash = false, scale = 1 } = {}) {
  const px = s.px
  for (let i = 0; i < px.length; i++) {
    const p = px[i]
    const c = p.c
    const r = flash ? c[0] * 0.8 + 0.35 : c[0] * k, g = flash ? c[1] * 0.8 + 0.35 : c[1] * k, b = flash ? c[2] * 0.8 + 0.35 : c[2] * k
    put(x + p.x * sx * scale, y + p.y * scale * sy, 0, 0.9 * Math.abs(sx) * scale, 0.9 * scale * sy, r, g, b)
  }
}

const slugApi = {
  put, sprite, text: textPx,
  pops(list, cam) {
    for (const q of list) {
      const f = Math.min(1, q.life * 3)
      for (const px of textPx(q.text)) put(q.x - cam + px.x * 0.9, q.y + px.y * 0.9, 1, 0.8, 0.8, q.c[0] * 2 * f, q.c[1] * 2 * f, q.c[2] * 2 * f)
    }
  },
}
function drawAll() {
  n = 0
  const t = G.time
  if ((G.mode === 'slug' || G.mode === 'pickle' || G.mode === 'bomber' || G.mode === 'tetris' || G.mode === 'chomp' || G.mode === 'cards' || G.mode === 'flames')) { if (games[G.mode]) games[G.mode].draw(slugApi); return }
  for (const p of G.pups) sprite(p.spr, p.x, p.y, { k: 1.15, sx: p.type === 'coin' ? Math.max(0.15, Math.abs(Math.cos(p.t * 5))) : 1, scale: p.type === 'gem' ? 1 + Math.sin(p.t * 8) * 0.15 : 1 })
  for (const e of G.enemies) {
    const mine = e.type === 'mine' ? 1 + Math.sin(e.t * 8) * 0.35 : 1
    sprite(e.spr, e.x, e.y, { flash: e.flash > 0, k: mine * (e.type === 'ufo' ? 1.5 : 1.1) })
  }
  const b = G.boss
  if (b) sprite(b.spr, b.x, b.y, { flash: b.flash > 0 || (b.invulnT > 0 && Math.floor(t * 14) % 2 === 0), k: b.k * 0.9 })
  // beams
  for (const bm of G.beams) {
    if (bm.t < bm.warn) {
      if (Math.floor(bm.t * 12) % 2 === 0) for (let x = bm.x; x > -HW - 2; x -= 3) put(x, bm.y, 0, 1, 1, 2.2, 0.15, 0.15)
    } else {
      const fade = 1 - (bm.t - bm.warn) / bm.life * 0.4
      for (let x = bm.x; x > -HW - 2; x -= 1) {
        for (let dy = -bm.h / 2; dy <= bm.h / 2; dy += 1) {
          const core = Math.abs(dy) < bm.h / 4
          const fl = 0.8 + Math.random() * 0.4
          put(x, bm.y + dy, 0, 1, 1, (core ? 3 : 2.4) * fade * fl, (core ? 3 : 0.4) * fade * fl, (core ? 3 : 0.5) * fade * fl)
        }
      }
    }
  }
  for (const q of G.ebul) {
    const sp = q.kind === 'dart' || q.kind === 'dartC' ? Math.atan2(q.vy, q.vx) : 0
    if (sp && Math.abs(sp) > 0.4 && Math.abs(sp) < 2.7) {
      // rotated darts: just draw as small orbs when angled
      put(q.x, q.y, 0, 1.3, 1.3, 2.4, 0.5, 0.5)
    } else sprite(q.spr, q.x, q.y, { k: 1.9 })
  }
  for (const q of G.pbul) sprite(q.spr, q.x, q.y, { k: q.k })
  if (G.squad) for (const m of G.squad) {
    if (!m.alive) continue
    const blink = m.inv > 0 && Math.floor(t * 18) % 2 === 0
    if (!blink) sprite(shipSprite(m.model, m.paint), m.x, m.y, { k: 1.15 })
    for (let i = 0; i < m.maxHp; i++) put(m.x - 2 + i * 2, m.y + 4.2, 1, 1.3, 0.7, i < m.hp ? 0.4 : 0.5, i < m.hp ? 2.2 : 0.2, i < m.hp ? 0.7 : 0.2)
    if (m.human) for (const q of textPx('2')) put(m.x + q.x * 0.8 - 0.6, m.y + 6.4 + q.y * 0.8, 2, 0.7, 0.7, 2.4, 2.2, 0.4)
  }
  const p = G.p
  if (p && p.alive) {
    const blink = p.inv > 0 && Math.floor(t * 18) % 2 === 0
    if (!blink) sprite(shipSprite(profile.ship.model, profile.ship.paint), p.x, p.y, { k: 1.25 })
    const z = G.lz
    if (z) {
      const grow = Math.min(1, z.t / 0.12), fade = z.t > z.dur - 0.25 ? (z.dur - z.t) / 0.25 : 1
      for (let x = p.x + 5; x < HW + 4; x += 1) {
        for (let dy = -z.h / 2; dy <= z.h / 2; dy += 1) {
          const core = Math.abs(dy) < z.h / 4 + 0.1, fl = (0.75 + Math.random() * 0.5) * fade
          const hh = z.h / 2 * grow
          if (Math.abs(dy) > hh) continue
          put(x, p.y + dy, 0, 1.05, 1.05, (core ? 3 : 0.5) * fl, (core ? 3 : 2.2) * fl, (core ? 3 : 3) * fl)
        }
      }
      for (let i = 0; i < 8; i++) { const a = Math.random() * 6.28; put(p.x + 6 + Math.cos(a) * 2.5, p.y + Math.sin(a) * 2.5, 1, 1, 1, 2.5, 3, 3) }
    }
    if (p.skT > 0 && (p.skT > 1 || Math.floor(t * 14) % 2 === 0)) {
      for (let i = 0; i < 40; i++) {
        const a = (i / 40) * Math.PI * 2 + t * 3
        put(p.x + Math.cos(a) * 9, p.y + Math.sin(a) * 8, 0, 0.9, 0.9, 0.5, 2.6, 1.0)
      }
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2 - t * 5; put(p.x + Math.cos(a) * 7, p.y + Math.sin(a) * 6.2, 0, 0.6, 0.6, 0.3, 1.2, 0.5) }
    }
    for (const d of p.dr) sprite(SP.wing, d.x, d.y, { k: 1.5, scale: 1.1 })
    if (p.shieldT > 0 && (p.shieldT > 1.5 || Math.floor(t * 12) % 2 === 0)) {
      for (let i = 0; i < 22; i++) {
        const a = (i / 22) * Math.PI * 2 + t * 2
        put(p.x + Math.cos(a) * 7.2, p.y + Math.sin(a) * 6.2, 0, 0.8, 0.8, 0.4, 2.2, 2.4)
      }
    }
    if (p.magnetT > 0) for (let i = 0; i < 6; i++) { const a = t * 3 + i; put(p.x + Math.cos(a) * 9, p.y + Math.sin(a) * 9, 0, 0.6, 0.6, 0.2, 1.5, 1.4) }
  }
  for (const q of G.parts) {
    const f = q.life / q.max
    put(q.x, q.y, 0, q.s * (0.35 + 0.65 * f) * 0.9, q.s * (0.35 + 0.65 * f) * 0.9, q.c[0] * 1.6, q.c[1] * 1.6, q.c[2] * 1.6)
  }
  for (const q of G.pops) {
    const f = Math.min(1, q.life * 3)
    for (const px of textPx(q.text)) put(q.x + px.x * 0.9, q.y + px.y * 0.9, 1, 0.8, 0.8, q.c[0] * 2 * f, q.c[1] * 2 * f, q.c[2] * 2 * f)
  }
}

export function World() {
  const ref = useRef()
  useEffect(() => {
    const m = ref.current
    m.setColorAt(0, new THREE.Color()) // allocate instanceColor
    A = m.instanceMatrix.array; C = m.instanceColor.array
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.instanceColor.setUsage(THREE.DynamicDrawUsage)
  }, [])
  useFrame((_, dt) => {
    const m = ref.current
    if (!m || !A) return
    perf.acc += dt; perf.n++
    if (perf.acc > 1.5) {
      const fps = perf.n / perf.acc
      if (fps < 28 && !G.lowQ) { G.lowQ = true; G.onQuality && G.onQuality() }
      perf.acc = 0; perf.n = 0
    }
    update(dt)
    drawAll()
    m.count = n
    m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true
  })
  return (
    <instancedMesh ref={ref} args={[null, null, MAXI]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1.3]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  )
}

export function Stars() {
  const ref = useRef()
  const COUNT = 220
  const stars = useMemo(() => Array.from({ length: COUNT }, () => {
    const z = -Math.random() * 45 - 2
    const hw = (77 - z) * 0.66
    return { x: (Math.random() * 2 - 1) * hw, y: (Math.random() * 2 - 1) * (77 - z) * 0.37, z, hw, sp: 60 / (1 + -z * 0.18), tw: Math.random() * 6 }
  }), [])
  const lastM = useRef(-1)
  useEffect(() => {
    ref.current.setColorAt(0, new THREE.Color())
  }, [])
  useFrame((_, dt) => {
    const m = ref.current
    if (!m) return
    m.visible = G.mode !== 'slug' && G.mode !== 'pickle' && G.mode !== 'bomber' && G.mode !== 'tetris' && G.mode !== 'chomp' && G.mode !== 'cards' && G.mode !== 'flames'
    if ((G.mode === 'slug' || G.mode === 'pickle' || G.mode === 'bomber' || G.mode === 'tetris' || G.mode === 'chomp' || G.mode === 'cards' || G.mode === 'flames')) return
    const mi = G.mode === 'menu' ? 0 : G.mission
    const tint = rgb(MISSIONS[mi].color)
    const d = Math.min(dt, 0.05)
    const arr = m.instanceMatrix.array, col = m.instanceColor.array
    stars.forEach((s, i) => {
      s.x -= s.sp * G.scroll * d
      if (s.x < -s.hw) s.x = s.hw
      const o = i * 16
      const stretch = 1 + Math.max(0, G.scroll - 1.5) * 1.6
      arr[o] = (0.18 + s.sp / 130) * stretch; arr[o + 5] = 0.18 + s.sp / 160; arr[o + 10] = 0.3; arr[o + 15] = 1
      arr[o + 12] = s.x; arr[o + 13] = s.y; arr[o + 14] = s.z
      const b = (0.35 + 0.65 * (s.sp / 60)) * (0.75 + 0.25 * Math.sin(G.time * 3 + s.tw))
      const c = i * 3
      col[c] = (0.5 + tint[0] * 0.6) * b; col[c + 1] = (0.5 + tint[1] * 0.6) * b; col[c + 2] = (0.5 + tint[2] * 0.6) * b
    })
    m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true
  })
  return (
    <instancedMesh ref={ref} args={[null, null, COUNT]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  )
}

export function Planet() {
  const g = useRef(), mat = useRef(), ringMat = useRef()
  const x = useRef(60)
  useFrame((_, dt) => {
    if (!g.current) return
    g.current.visible = G.mode !== 'slug' && G.mode !== 'pickle' && G.mode !== 'bomber' && G.mode !== 'tetris' && G.mode !== 'chomp' && G.mode !== 'cards' && G.mode !== 'flames'
    if ((G.mode === 'slug' || G.mode === 'pickle' || G.mode === 'bomber' || G.mode === 'tetris' || G.mode === 'chomp' || G.mode === 'cards' || G.mode === 'flames')) return
    const mi = G.mode === 'menu' ? 0 : G.mission
    x.current -= dt * 1.1 * G.scroll
    if (x.current < -110) x.current = 110
    g.current.position.set(x.current, 6 + Math.sin(G.time * 0.05) * 3, -70)
    g.current.rotation.y += dt * 0.08
    const c = MISSIONS[mi].planet
    mat.current.color.set(c); ringMat.current.color.set(MISSIONS[mi].color)
  })
  return (
    <group ref={g}>
      <mesh>
        <sphereGeometry args={[16, 36, 24]} />
        <meshStandardMaterial ref={mat} roughness={0.9} emissive="#101018" />
      </mesh>
      <mesh rotation={[1.2, 0.2, 0.3]}>
        <torusGeometry args={[24, 0.7, 6, 80]} />
        <meshBasicMaterial ref={ringMat} transparent opacity={0.35} />
      </mesh>
    </group>
  )
}

export function Rig() {
  useFrame((state) => {
    if (state.scene.background && state.scene.background.set) state.scene.background.set(G.mode === 'slug' && games.slug ? games.slug.sky(games.slug.stageIndex()) : G.mode === 'pickle' ? '#0a1a14' : G.mode === 'bomber' ? '#08101c' : G.mode === 'tetris' ? '#04060f' : G.mode === 'chomp' ? '#03030e' : G.mode === 'cards' ? '#06281c' : G.mode === 'flames' ? '#07040f' : '#04050d')
    const s = G.shake
    state.camera.position.x = (Math.random() - 0.5) * s * 1.6
    state.camera.position.y = (Math.random() - 0.5) * s * 1.6
    state.camera.position.z = 77 + (G.warped ? 5 : 0)
  })
  return null
}

export function FlashPlane() {
  const m = useRef()
  useFrame(() => {
    if (!m.current) return
    m.current.material.opacity = Math.min(0.9, G.flash)
    m.current.material.color.setRGB(G.flashC[0], G.flashC[1], G.flashC[2])
    m.current.visible = G.flash > 0.01
  })
  return (
    <mesh ref={m} position={[0, 0, 30]} renderOrder={999}>
      <planeGeometry args={[200, 120]} />
      <meshBasicMaterial transparent depthTest={false} opacity={0} toneMapped={false} />
    </mesh>
  )
}
