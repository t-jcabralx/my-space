'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { G, update, HW, HH, profile, games, ARCADE } from './engine.js'
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
  if (ARCADE.has(G.mode)) { if (games[G.mode]) games[G.mode].draw(slugApi); return }
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
    if (m.lz) { const z = m.lz, grow = Math.min(1, z.t / 0.12), fade = z.t > z.dur - 0.25 ? (z.dur - z.t) / 0.25 : 1; for (let x = m.x + 4; x < HW + 4; x += 1.2) for (let dy = -z.h / 2 * grow; dy <= z.h / 2 * grow; dy += 1.1) { const core = Math.abs(dy) < z.h / 4 + 0.1, fl = (0.75 + Math.random() * 0.5) * fade; put(x, m.y + dy, 0, 1.15, 1.15, (core ? 3 : 0.5) * fl, (core ? 3 : 2.2) * fl, 3 * fl) } }
    if (m.skT > 0 && (m.skT > 1 || Math.floor(t * 14) % 2 === 0)) for (let i = 0; i < 28; i++) { const a = (i / 28) * Math.PI * 2 + t * 3; put(m.x + Math.cos(a) * 7, m.y + Math.sin(a) * 6.4, 0, 0.8, 0.8, 0.5, 2.6, 1.0) }
    if (m.mine) for (const q of textPx('1')) put(m.x - 7 + q.x * 0.6, m.y + 0.4 + q.y * 0.6, 2, 0.5, 0.5, 0.4, 2.4, 0.9)
    for (let i = 0; i < m.maxHp; i++) put(m.x - 2 + i * 2, m.y + 4.2, 1, 1.3, 0.7, i < m.hp ? 0.4 : 0.5, i < m.hp ? 2.2 : 0.2, i < m.hp ? 0.7 : 0.2)
    if (m.human) for (const q of textPx('2')) put(m.x + q.x * 0.8 - 0.6, m.y + 6.4 + q.y * 0.8, 2, 0.7, 0.7, 2.4, 2.2, 0.4)
  }
  const p = G.p
  if (p && p.alive) {
    const blink = p.inv > 0 && Math.floor(t * 18) % 2 === 0
    if (!blink) sprite(shipSprite(p.sk ? p.sk[0] : profile.ship.model, p.sk ? p.sk[1] : profile.ship.paint), p.x, p.y, { k: 1.25 })
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

// ---- lit 3D pass (IRON FISTS): rotated, depth-scaled boxes with real lighting and shadows ----
const MAX3 = 16000
let n3 = 0, A3 = null, C3 = null
function put3(x, y, z, sx, sy, sz, rz, r, g, b, ry = 0) {
  if (n3 >= MAX3) return
  const o = n3 * 16
  const cz = Math.cos(rz), sz_ = Math.sin(rz)
  if (ry === 0) {
    A3[o] = cz * sx; A3[o + 1] = sz_ * sx; A3[o + 2] = 0; A3[o + 3] = 0
    A3[o + 4] = -sz_ * sy; A3[o + 5] = cz * sy; A3[o + 6] = 0; A3[o + 7] = 0
    A3[o + 8] = 0; A3[o + 9] = 0; A3[o + 10] = sz; A3[o + 11] = 0
  } else {
    const cy = Math.cos(ry), sy_ = Math.sin(ry)
    A3[o] = cz * cy * sx; A3[o + 1] = sz_ * cy * sx; A3[o + 2] = -sy_ * sx; A3[o + 3] = 0
    A3[o + 4] = -sz_ * sy; A3[o + 5] = cz * sy; A3[o + 6] = 0; A3[o + 7] = 0
    A3[o + 8] = cz * sy_ * sz; A3[o + 9] = sz_ * sy_ * sz; A3[o + 10] = cy * sz; A3[o + 11] = 0
  }
  A3[o + 12] = x; A3[o + 13] = y; A3[o + 14] = z; A3[o + 15] = 1
  const c = n3 * 3
  C3[c] = r; C3[c + 1] = g; C3[c + 2] = b
  n3++
}
function putM(x, y, z, sx, sy, sz, m, r, g, b) {
  if (n3 >= MAX3) return
  const o = n3 * 16
  A3[o] = m[0] * sx; A3[o + 1] = m[3] * sx; A3[o + 2] = m[6] * sx; A3[o + 3] = 0
  A3[o + 4] = m[1] * sy; A3[o + 5] = m[4] * sy; A3[o + 6] = m[7] * sy; A3[o + 7] = 0
  A3[o + 8] = m[2] * sz; A3[o + 9] = m[5] * sz; A3[o + 10] = m[8] * sz; A3[o + 11] = 0
  A3[o + 12] = x; A3[o + 13] = y; A3[o + 14] = z; A3[o + 15] = 1
  const c = n3 * 3; C3[c] = r; C3[c + 1] = g; C3[c + 2] = b
  n3++
}
const MAXS = 3200
let nS = 0, AS = null, CS = null
function putS(x, y, z, sx, sy, sz, r, g, b) {
  if (nS >= MAXS || !AS) return
  const o = nS * 16
  AS[o] = sx; AS[o + 1] = 0; AS[o + 2] = 0; AS[o + 3] = 0; AS[o + 4] = 0; AS[o + 5] = sy; AS[o + 6] = 0; AS[o + 7] = 0; AS[o + 8] = 0; AS[o + 9] = 0; AS[o + 10] = sz; AS[o + 11] = 0
  AS[o + 12] = x; AS[o + 13] = y; AS[o + 14] = z; AS[o + 15] = 1
  const c = nS * 3; CS[c] = r; CS[c + 1] = g; CS[c + 2] = b
  nS++
}
export const LIT3 = new Set(['rogue', 'td', 'hockey', 'pool', 'snake', 'breaker', 'rhythm', 'empire', 'ssx', 'orb', 'garden'])
const api3 = { put3, putM, putS, bulk(A, C, count) { if (!A3) return; A3.set(A.subarray(0, count * 16)); C3.set(C.subarray(0, count * 3)); n3 = count } }
export function Fighters3D() {
  const ref = useRef()
  const sph = useRef()
  const light = useRef()
  const glow = useRef()
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    const m = ref.current
    m.setColorAt(0, new THREE.Color())
    A3 = m.instanceMatrix.array; C3 = m.instanceColor.array
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.instanceColor.setUsage(THREE.DynamicDrawUsage)
    gl.shadowMap.enabled = true; gl.shadowMap.type = THREE.PCFSoftShadowMap
    const sm = sph.current
    if (sm) { sm.setColorAt(0, new THREE.Color()); AS = sm.instanceMatrix.array; CS = sm.instanceColor.array; sm.instanceMatrix.setUsage(THREE.DynamicDrawUsage); sm.instanceColor.setUsage(THREE.DynamicDrawUsage) }
  }, [gl])
  useFrame(() => {
    const m = ref.current
    if (!m || !A3) return
    const on = G.mode === 'fight' || G.mode === 'race' || LIT3.has(G.mode)
    if (sph.current) sph.current.visible = on
    m.visible = on
    if (light.current) light.current.visible = on
    if (glow.current) glow.current.visible = G.mode === 'fight' || LIT3.has(G.mode)
    if (light.current && !LIT3.has(G.mode) && light.current.intensity !== 1.6) { light.current.intensity = 1.6; light.current.color.set('#ffffff'); light.current.position.set(-16, 46, 38) }
    if (glow.current && !LIT3.has(G.mode) && glow.current.distance !== 70) { glow.current.distance = 70; glow.current.decay = 1.4 }
    if (!on) { m.count = 0; if (sph.current) sph.current.count = 0; return }
    n3 = 0; nS = 0
    try { const g3 = games[G.mode]; if (g3 && g3.draw3) g3.draw3(api3) } catch (e) { if (!api3.warned) { api3.warned = true; console.error('[lit3d]', e) } }
    m.count = n3
    m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true
    if (sph.current) { sph.current.count = nS; sph.current.instanceMatrix.needsUpdate = true; sph.current.instanceColor.needsUpdate = true }
    // colour the rim light after the element of whoever is attacking
    if (G.mode === 'race' && light.current && games.race && games.race.sun) { const p = games.race.sun(); light.current.position.set(p.x - 30, 90, p.z + 40); light.current.target.position.set(p.x, 0, p.z); light.current.target.updateMatrixWorld(); light.current.castShadow = false }
    if (G.mode === 'fight' && light.current) { light.current.castShadow = true }
    if (LIT3.has(G.mode) && games[G.mode] && games[G.mode].lights) {
      const L = games[G.mode].lights()
      if (light.current) { light.current.position.set(L.sun.x, L.sun.y, L.sun.z); light.current.color.set(L.sun.color); light.current.intensity = L.sun.intensity; light.current.castShadow = L.shadow !== false; light.current.target.position.set(L.target ? L.target.x : 0, 0, L.target ? L.target.z : 0); light.current.target.updateMatrixWorld() }
      if (glow.current) { if (L.lantern) { glow.current.position.set(L.lantern.x, L.lantern.y, L.lantern.z); glow.current.color.set(L.lantern.color); glow.current.intensity = L.lantern.intensity; glow.current.distance = L.lantern.distance; glow.current.decay = 1.1 } else glow.current.intensity = 0 }
    }
    if (glow.current && G.mode === 'fight' && games.fight && games.fight.rim) { const r = games.fight.rim(); glow.current.color.set(r.color); glow.current.intensity = r.intensity; glow.current.position.set(r.x, r.y, 14) }
  })
  return (
    <group>
      <instancedMesh ref={ref} args={[null, null, MAX3]} frustumCulled={false} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.62} metalness={0.1} />
      </instancedMesh>
      <directionalLight ref={light} position={[-16, 46, 38]} intensity={1.6} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-70} shadow-camera-right={70} shadow-camera-top={50} shadow-camera-bottom={-40} shadow-camera-near={5} shadow-camera-far={160} shadow-bias={-0.0006} />
      <pointLight ref={glow} intensity={0} distance={70} decay={1.4} />
      <instancedMesh ref={sph} args={[null, null, MAXS]} frustumCulled={false} castShadow receiveShadow>
        <sphereGeometry args={[0.5, 14, 10]} />
        <meshStandardMaterial roughness={0.35} metalness={0.2} />
      </instancedMesh>
    </group>
  )
}

// smooth low-poly mountain for SNOW RUSH: the game fills vertex heights and colours every frame
const TNX = 44, TNZ = 84
export function SnowTerrain() {
  const ref = useRef()
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TNX * TNZ * 3), 3))
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(TNX * TNZ * 3), 3))
    const idx = []
    for (let j = 0; j < TNZ - 1; j++) for (let i = 0; i < TNX - 1; i++) { const a = j * TNX + i, b = a + 1, c = a + TNX, d = c + 1; idx.push(a, b, c, b, d, c) }
    g.setIndex(idx)
    return g
  }, [])
  useFrame(() => {
    const m = ref.current
    if (!m) return
    const on = G.mode === 'ssx' && games.ssx && games.ssx.terrain
    m.visible = !!on
    if (!on) return
    games.ssx.terrain(geo.attributes.position.array, geo.attributes.color.array, TNX, TNZ)
    geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true
    geo.computeVertexNormals()
    geo.computeBoundingSphere()
  })
  return (
    <mesh ref={ref} geometry={geo} frustumCulled={false} receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.85} metalness={0} flatShading />
    </mesh>
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
    m.visible = !ARCADE.has(G.mode)
    if (ARCADE.has(G.mode)) return
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
    g.current.visible = !ARCADE.has(G.mode)
    if (ARCADE.has(G.mode)) return
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

let rigWasFight = false
export function Rig() {
  useFrame((state, dt) => {
    if (state.scene.background && state.scene.background.set) state.scene.background.set(G.mode === 'slug' && games.slug ? games.slug.sky(games.slug.stageIndex()) : G.mode === 'pickle' ? '#0a1a14' : G.mode === 'bomber' ? '#08101c' : G.mode === 'tetris' ? '#04060f' : G.mode === 'chomp' ? '#03030e' : G.mode === 'cards' ? '#06281c' : G.mode === 'flames' ? '#07040f' : G.mode === 'fight' ? '#06040e' : G.mode === 'race' && games.race ? games.race.sky() : LIT3.has(G.mode) && games[G.mode] ? games[G.mode].sky() : '#04050d')
    const s = G.shake
    // the global lights are bright for the 2D games; the forest needs them low for suspense
    const amb = state.scene.children.find((c) => c.isAmbientLight), dl = state.scene.children.find((c) => c.isDirectionalLight)
    if (LIT3.has(G.mode) && games[G.mode] && games[G.mode].lights) { const L = games[G.mode].lights(); if (amb) amb.intensity = L.ambient; if (dl) dl.intensity = L.dir } else { if (amb && amb.intensity !== 1.2) amb.intensity = 1.2; if (dl && dl.intensity !== 2.2) dl.intensity = 2.2 }
    if (LIT3.has(G.mode) && games[G.mode] && games[G.mode].camera) {
      const cam = games[G.mode].camera(state.size.width / Math.max(1, state.size.height), dt)
      state.camera.position.set(cam.x, cam.y, cam.z)
      state.camera.lookAt(cam.tx, cam.ty, cam.tz)
      if (Math.abs(state.camera.fov - cam.fov) > 0.05 || state.camera.far !== cam.far) { state.camera.fov = cam.fov; state.camera.far = cam.far; state.camera.updateProjectionMatrix() }
      const th = games[G.mode].fog ? games[G.mode].fog() : null
      if (th) { if (!state.scene.fog) state.scene.fog = new THREE.Fog(th.fog, th.fogNear, th.fogFar); state.scene.fog.color.set(th.fog); state.scene.fog.near = th.fogNear; state.scene.fog.far = th.fogFar } else if (state.scene.fog) state.scene.fog = null
      rigWasFight = true
      return
    }
    if (G.mode === 'fight' && games.fight && games.fight.camera ) {
      const cam = games.fight.camera(state.size.width / Math.max(1, state.size.height), dt)
      state.camera.position.set(cam.x + (Math.random() - 0.5) * s * 1.4, cam.y + (Math.random() - 0.5) * s * 1.4, cam.z)
      state.camera.lookAt(cam.tx, cam.ty, 0)
      rigWasFight = true
      return
    }
    if (G.mode === 'race' && games.race && games.race.camera) {
      const cam = games.race.camera(state.size.width / Math.max(1, state.size.height), dt)
      state.camera.position.set(cam.x, cam.y, cam.z)
      state.camera.lookAt(cam.tx, cam.ty, cam.tz)
      if (Math.abs(state.camera.fov - cam.fov) > 0.05 || state.camera.far !== cam.far) { state.camera.fov = cam.fov; state.camera.far = cam.far; state.camera.updateProjectionMatrix() }
      if (!state.scene.fog) state.scene.fog = new THREE.Fog(games.race.fog(), 160, 900)
      state.scene.fog.color.set(games.race.fog())
      rigWasFight = true
      return
    }
    if (state.scene.fog) state.scene.fog = null
    if (state.camera.fov !== 40 || state.camera.far !== 400) { state.camera.fov = 40; state.camera.far = 400; state.camera.updateProjectionMatrix() }
    if (rigWasFight) { state.camera.rotation.set(0, 0, 0); rigWasFight = false }
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
