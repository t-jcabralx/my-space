'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { loadAnimeRig, styleAnimeRig } from '../game/animeRig.js'
import styles from './AnimePreview.module.css'

const MOVES=[['idle','01','Idle','Breathing & eye contact'],['greet','02','Hello','Wave & expression'],['run','03','Run','Full-body movement'],['strike','04','Strike','Wind-up & follow-through']]

export default function AnimePreview() {
  const canvas=useRef(null),settings=useRef({action:'idle',shot:'full',paused:false,orbit:false}), rigRef=useRef(null)
  const [action,setAction]=useState('idle'),[shot,setShot]=useState('full'),[paused,setPaused]=useState(false),[orbit,setOrbit]=useState(false),[state,setState]=useState('loading'),[retry,setRetry]=useState(0)
  useEffect(()=>{
    let renderer,rig,disposed=false,frame,visible=true,previous=0,time=1,actionTime=1,appliedAction='idle',appliedShot=''
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)')
    if(reduced.matches){settings.current.paused=true;setPaused(true)}
    try{renderer=new THREE.WebGLRenderer({canvas:canvas.current,antialias:true,alpha:true,powerPreference:'high-performance'})}
    catch{setState('unsupported');return}
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.setClearColor(0,0)
    renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap
    const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(33,1,.05,100)
    camera.position.set(0,1.25,3.7)
    const controls=new OrbitControls(camera,canvas.current)
    controls.target.set(0,.92,0);controls.enableDamping=true;controls.dampingFactor=.09
    controls.enablePan=false;controls.minDistance=.8;controls.maxDistance=5.5
    controls.minPolarAngle=.3;controls.maxPolarAngle=Math.PI*.57;controls.autoRotateSpeed=.7
    scene.add(new THREE.HemisphereLight('#fff6e8','#77719e',.8))
    const sun=new THREE.DirectionalLight('#fff3d8',1.05);sun.position.set(-2,4,5);sun.castShadow=true
    sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=sun.shadow.camera.bottom=-2;sun.shadow.camera.right=sun.shadow.camera.top=2
    sun.shadow.camera.near=.1;sun.shadow.camera.far=12;sun.shadow.normalBias=.004
    scene.add(sun)
    const rim=new THREE.DirectionalLight('#b6d4ff',.45);rim.position.set(2,2,-3);scene.add(rim)
    const stage=new THREE.Group();scene.add(stage)
    const platform=new THREE.Mesh(new THREE.CylinderGeometry(.84,.88,.06,80),new THREE.MeshStandardMaterial({color:'#222539',roughness:.8,metalness:.2}))
    platform.position.y=-.04;platform.receiveShadow=true;stage.add(platform)
    const shadow=new THREE.Mesh(new THREE.PlaneGeometry(6,6),new THREE.ShadowMaterial({opacity:.2}))
    shadow.rotation.x=-Math.PI/2;shadow.position.y=-.005;shadow.receiveShadow=true;stage.add(shadow)
    for(const radius of [.75,.82]) {
      const ring=new THREE.Mesh(new THREE.TorusGeometry(radius,.003,6,96),new THREE.MeshBasicMaterial({color:'#e6bc7c'}))
      ring.rotation.x=-Math.PI/2;ring.position.y=-.006;stage.add(ring)
    }
    const count=36,positions=new Float32Array(count*3)
    for(let i=0;i<count;i++){positions[i*3]=Math.sin(i*13.7)*2;positions[i*3+1]=(i*.137)%2.6;positions[i*3+2]=-1-Math.cos(i*4.7)*.8}
    const particleGeometry=new THREE.BufferGeometry();particleGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3))
    const particles=new THREE.Points(particleGeometry,new THREE.PointsMaterial({size:.012,color:'#ffddb0',transparent:true,opacity:.58,depthWrite:false}));scene.add(particles)
    const resize=new ResizeObserver(([entry])=>{const {width,height}=entry.contentRect;if(width&&height){renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix()}})
    resize.observe(canvas.current)
    const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting});observer.observe(canvas.current)
    const onLost=e=>{e.preventDefault();if(!disposed)setState('lost')}
    const element=canvas.current;element.addEventListener('webglcontextlost',onLost)
    loadAnimeRig().then(result=>{
      if(disposed){result.dispose();return}
      rig=result;rigRef.current=rig;scene.add(rig.scene)
      styleAnimeRig(rig)
      rig.update(settings.current.action,time,0,true);setState('ready')
    }).catch(error=>{if(!disposed){console.error('Anime character failed to load:',error);setState('error')}})
    function render(now) {
      frame=requestAnimationFrame(render)
      const delta=previous?Math.min((now-previous)/1000,.05):0;previous=now
      if(!visible||document.hidden)return
      const s=settings.current
      if(appliedAction!==s.action){appliedAction=s.action;actionTime=0}
      if(!s.paused){time+=delta;actionTime+=delta}
      if(appliedShot!==s.shot) {
        appliedShot=s.shot
        if(s.shot==='face'){camera.position.set(.06,1.52,1.15);controls.target.set(0,1.46,0)}
        else {camera.position.set(.18,1.15,3.8);controls.target.set(0,.89,0)}
        controls.update()
      }
      controls.autoRotate=s.orbit&&!s.paused;controls.update()
      if(rig&&!s.paused)rig.update(s.action,Math.floor(actionTime*30)/30,delta)
      if(!s.paused)particles.rotation.y=time*.025
      renderer.render(scene,camera)
    }
    frame=requestAnimationFrame(render)
    return ()=>{
      disposed=true;cancelAnimationFrame(frame);resize.disconnect();observer.disconnect();controls.dispose()
      element.removeEventListener('webglcontextlost',onLost)
      rig?.dispose();rigRef.current=null
      stage.traverse(o=>{o.geometry?.dispose();o.material?.dispose()});particleGeometry.dispose();particles.material.dispose()
      sun.shadow.dispose();renderer.dispose()
    }
  },[retry])
  function chooseMove(value){settings.current.action=value;setAction(value);if(settings.current.paused)rigRef.current?.update(value,1.1,0,true)}
  function togglePause(){const value=!settings.current.paused;settings.current.paused=value;setPaused(value)}
  function chooseShot(value){settings.current.shot=value;setShot(value)}
  return <main className={styles.page}>
    <header className={styles.header}>
      <Link href="/" className={styles.brand}><span>✦</span> MY SPACE <i>ARCADE</i></Link>
      <span className={styles.breadcrumb}>ART DIRECTION <b>/</b> ANIME</span>
      <Link href="/" className={styles.back}>← Back to arcade</Link>
    </header>
    <div className={styles.layout}>
      <aside className={styles.panel}>
        <div className={styles.eyebrow}><i /> LIVE 3D PREVIEW</div>
        <h1>Anime<br/><em>in motion.</em></h1>
        <p className={styles.intro}>Expressive eyes. Flowing hair. A character that comes to life.</p>
        <div className={styles.sectionLabel}>TRY THE MOVES <span>04</span></div>
        <div className={styles.moves}>{MOVES.map(([key,number,label,description])=><button key={key} className={action===key?styles.selected:''} aria-pressed={action===key} onClick={()=>chooseMove(key)}><span>{number}</span><div><b>{label}</b><small>{description}</small></div><i>{action===key?'↗':'→'}</i></button>)}</div>
        <div className={styles.detail}><span>THE NEW DIRECTION</span><p>Textured anime artwork, a full character rig, and animated expressions.</p><small>Now playable as the climber in Girder Gorilla. Other game casts are still being developed.</small><Link href="/?play=girder-gorilla">Play Girder Gorilla →</Link></div>
      </aside>
      <section className={styles.viewport} aria-label="Interactive anime character">
        <div className={styles.backdrop}/><div className={styles.vignette}/>
        <div className={styles.sceneLabel}><span>CHARACTER STUDY — 01</span><b>Golden hour</b></div>
        <canvas ref={canvas} className={styles.canvas} role="img" aria-label={`Live rigged anime character performing ${action}. Drag to rotate and scroll to zoom.`}/>
        {state!=='ready'&&<div className={styles.loading} role="status">{state==='loading'?<><i/>Preparing the character…</>:<><b>{state==='unsupported'?'WebGL is unavailable on this device.':'The character could not be loaded.'}</b>{state!=='unsupported'&&<button onClick={()=>{setState('loading');setRetry(v=>v+1)}}>Try again</button>}</>}</div>}
        <div className={styles.toolbar}>
          <div className={styles.shots}><button aria-pressed={shot==='full'} onClick={()=>chooseShot('full')}>Full body</button><button aria-pressed={shot==='face'} onClick={()=>chooseShot('face')}>Face detail</button></div>
          <button className={styles.iconButton} aria-label={paused?'Play animation':'Pause animation'} onClick={togglePause}>{paused?'▶':'Ⅱ'}</button>
          <button className={styles.orbit} aria-pressed={orbit} onClick={()=>{settings.current.orbit=!orbit;setOrbit(!orbit)}}>↻ Orbit</button>
        </div>
        <div className={styles.sceneFooter}><span>DRAG TO ROTATE · SCROLL TO ZOOM</span><a href="/models/anime/ATTRIBUTION.txt" target="_blank" rel="noreferrer">Model: pixiv Inc. ↗</a></div>
      </section>
    </div>
  </main>
}
