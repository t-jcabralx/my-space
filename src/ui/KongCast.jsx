'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { artGeometries } from '../game/artDirection.js'
import { beveledBoxGeometry } from '../game/modeling.js'
import { drawBarrel, drawClimber, drawGorilla, drawRescue } from '../game/kongModels.js'

const VIEWS = {
  crew: { label: 'THE CREW', x: 0, y: 5.2, distance: 32 },
  gorilla: { label: 'GORILLA', x: 0, y: 5.8, distance: 20 },
  climber: { label: 'CLIMBER', x: 8.8, y: 2.3, distance: 9.7 },
  rescue: { label: 'RESCUE', x: -8.7, y: 2.5, distance: 10 },
}

export default function KongCast() {
  const canvas = useRef(null), view = useRef('crew')
  const [selected, setSelected] = useState('crew'), [fallback, setFallback] = useState(false)
  useEffect(() => {
    let renderer
    try { renderer = new THREE.WebGLRenderer({ canvas: canvas.current, antialias: true, alpha: false }) }
    catch { setFallback(true); return }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(38, 2.3, .1, 180)
    scene.background = new THREE.Color('#b0d9ed')
    scene.add(new THREE.HemisphereLight('#ecf7ff', '#88755f', 1.1))
    const sun = new THREE.DirectionalLight('#fff0d4', 1.5)
    sun.position.set(-12, 20, 28); scene.add(sun)
    const rim = new THREE.DirectionalLight('#c3eaff', .85)
    rim.position.set(12, 10, -15); scene.add(rim)
    const geometry = { ...artGeometries(), box: beveledBoxGeometry(.06) }
    const material = new THREE.MeshToonMaterial({ color: '#ffffff' }), sculptMaterial = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .82 }), batches = {}, object = new THREE.Object3D(), color = new THREE.Color()
    for (const [name, geo] of Object.entries(geometry)) {
      const mesh = new THREE.InstancedMesh(geo, name === 'sculpt' ? sculptMaterial : material, 1024)
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false
      scene.add(mesh); batches[name] = { mesh, count: 0 }
    }
    const put = (kind,x,y,z,sx,sy,sz,rz,r,g,b,ry=0) => {
      const batch = batches[kind], index = batch.count++
      object.position.set(x,y,z); object.scale.set(sx,sy,sz); object.rotation.set(0,ry,rz,'YXZ'); object.updateMatrix()
      batch.mesh.setMatrixAt(index,object.matrix); batch.mesh.setColorAt(index,color.setRGB(r,g,b))
    }
    const api = { putShape: put, put3: (...args) => put('box',...args) }
    let disposed=false
    const animeCast=[]
    import('../game/animeRig.js').then(async({loadAnimeRig,styleAnimeRig})=>{
      if(disposed)return
      for(const [id,x,shirt] of [['climber',8.8,'#42657e'],['rescue',-8.7,'#bf4974']]) {
        const rig=await loadAnimeRig()
        if(disposed){rig.dispose();return}
        styleAnimeRig(rig,shirt)
        const wrapper=new THREE.Group();wrapper.add(rig.scene);wrapper.scale.setScalar(4.1/rig.height)
        wrapper.position.set(x,0,.55);wrapper.rotation.y=id==='climber'?-.3:.15
        rig.update(id==='climber'?'idle':'greet',1,0,true)
        scene.add(wrapper);animeCast.push({id,rig,wrapper})
      }
    }).catch(error=>{if(!disposed)console.warn('Anime cast preview unavailable; using fallback.',error)})
    let frame, visible = true, time = 2, previous = 0
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const resize = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (!width || !height) return
      renderer.setSize(width,height,false); camera.aspect = width/height; camera.updateProjectionMatrix()
    })
    resize.observe(canvas.current)
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting })
    observer.observe(canvas.current)
    function render(now) {
      frame = requestAnimationFrame(render)
      const dt = previous ? Math.min((now-previous)/1000,.05) : 0; previous = now
      if (!visible || document.hidden) return
      if (!reduced.matches) time += dt
      for (const batch of Object.values(batches)) batch.count = 0
      const shot = VIEWS[view.current]
      camera.position.set(shot.x+1.3,shot.y+3.4,shot.distance)
      camera.lookAt(shot.x,shot.y,0)
      api.put3(0,-.3,0,27,.6,6,0,.66,.07,.038)
      api.put3(0,-1.3,0,27,1.4,4.9,0,.28,.032,.021)
      api.put3(0,-2,0,27,.3,5.7,0,.53,.052,.03)
      for(let x=-12;x<13;x+=2)api.putShape('organic',x,-1.2,2.52,.19,.19,.15,0,.94,.46,.12)
      const cycle = time%9, wind = cycle>7.9 && cycle<8.5 ? 8.5-cycle : 0
      drawGorilla(api,{wind,id:0},time)
      drawBarrel(api,-5.9,1.1,1,.5)
      if(!animeCast.some(a=>a.id==='climber'))drawClimber(api,{x:8.8,y:0,face:-.35,ground:true,in:{dx:0},anim:time,ham:view.current==='climber'?1:0},time)
      if(!animeCast.some(a=>a.id==='rescue'))drawRescue(api,-8.7,0,time)
      for(const {id,rig} of animeCast)if(!reduced.matches)rig.update(id==='climber'?'idle':'greet',time,dt)
      for(const {mesh,count} of Object.values(batches)) {
        mesh.count=count; mesh.instanceMatrix.needsUpdate=true
        if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true
      }
      renderer.render(scene,camera)
    }
    frame=requestAnimationFrame(render)
    return () => {
      disposed=true
      cancelAnimationFrame(frame); resize.disconnect(); observer.disconnect()
      for(const {rig} of animeCast)rig.dispose()
      for(const {mesh} of Object.values(batches))mesh.dispose()
      for(const geo of Object.values(geometry))geo.dispose()
      material.dispose(); sculptMaterial.dispose(); renderer.dispose()
    }
  }, [])
  return <section className="kong-cast" aria-label="Girder Gorilla character preview">
    {fallback ? <img src="/art/logos/kong-9371324f-768.webp" alt="Girder Gorilla cast" /> : <canvas ref={canvas} role="img" aria-label={`Animated 3D ${VIEWS[selected].label.toLowerCase()} from Girder Gorilla`} />}
    <div className="kong-cast-caption"><span>MEET THE CREW</span><small>THE CHARACTERS YOU PLAY WITH</small></div>
    <div className="kong-cast-tabs" aria-label="Character camera">{Object.entries(VIEWS).map(([key,{label}])=><button key={key} aria-pressed={selected===key} onClick={()=>{view.current=key;setSelected(key)}}>{label}</button>)}</div>
  </section>
}
