'use client'

import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { KG, surf } from './kong.js'
import { kongAnimePresentation, kongAnimeReady } from './kongAnimeState.js'

// Mount only during a climb. A failed asset request leaves the existing cast playable.
export default function KongAnimeActors() {
  const group=useRef(),actors=useRef(new Map())
  useEffect(()=>{
    let disposed=false
    const root=group.current,owned=actors.current
    let backdrop
    const texture=new THREE.TextureLoader().load('/art/anime/terrace.webp',map=>{
      if(disposed){map.dispose();return}
      map.colorSpace=THREE.SRGBColorSpace
      backdrop=new THREE.Mesh(new THREE.PlaneGeometry(220,145),new THREE.MeshBasicMaterial({map,toneMapped:false}))
      backdrop.name='anime-backdrop';root.add(backdrop);kongAnimeReady.add('backdrop')
    },undefined,()=>{ /* Keep the procedural skyline if the artwork is unavailable. */ })
    const ids=[...KG.players.map((_,i)=>`player:${i}`),'rescue']
    import('./animeRig.js').then(async({loadAnimeRig,styleAnimeRig})=>{
      if(disposed)return
      await Promise.all(ids.map(async id=>{
        const rig=await loadAnimeRig()
        if(disposed){rig.dispose();return}
        styleAnimeRig(rig,id==='rescue'?'#bf4974':id==='player:0'?'#42657e':'#995d91')
        const wrapper=new THREE.Group();wrapper.add(rig.scene);wrapper.scale.setScalar(4.1/rig.height)
        wrapper.visible=false;root.add(wrapper)
        const actor={rig,wrapper,hammer:null}
        if(id!=='rescue') {
          const hammer=new THREE.Group(),handle=new THREE.Mesh(new THREE.CylinderGeometry(.035,.045,.65,10),new THREE.MeshStandardMaterial({color:'#7d4825',roughness:.85}))
          handle.position.y=.22;hammer.add(handle)
          const head=new THREE.Mesh(new THREE.BoxGeometry(.48,.23,.24),new THREE.MeshStandardMaterial({color:'#a1adb8',metalness:.55,roughness:.4}))
          head.position.y=.56;hammer.add(head)
          hammer.rotation.z=-Math.PI/2
          rig.vrm.humanoid.getRawBoneNode('rightHand')?.add(hammer);actor.hammer=hammer
        }
        owned.set(id,actor)
      }).map(p=>p.catch(error=>{if(!disposed)console.warn('Anime cast unavailable; keeping fallback character.',error)})))
    }).catch(error=>{if(!disposed)console.warn('Anime renderer unavailable; keeping fallback cast.',error)})
    return()=>{
      disposed=true
      kongAnimeReady.delete('backdrop');texture.dispose()
      if(backdrop){root.remove(backdrop);backdrop.geometry.dispose();backdrop.material.dispose()}
      for(const [id,{rig,wrapper}] of owned){kongAnimeReady.delete(id);root.remove(wrapper);rig.dispose()}
      owned.clear()
    }
  },[])
  useFrame((_,delta)=>{
    const backdrop=group.current?.getObjectByName('anime-backdrop')
    if(backdrop)backdrop.position.set(KG.camX,KG.camY+12,-65)
    for(const [id,actor] of actors.current) {
      const rescue=id==='rescue',p=rescue?KG.princess:KG.players[Number(id.split(':')[1])]
      if(!p){actor.wrapper.visible=false;kongAnimeReady.delete(id);continue}
      // Guests receive positions rather than velocity for the other players.
      const motionX=kongAnimeReady.has(id)?(p.x-actor.wrapper.position.x)/Math.max(delta,.001):p.vx
      const pose=rescue?{action:'greet',time:KG.t,yaw:-.15,visible:true}:kongAnimePresentation(p,KG.t,motionX||p.vx)
      actor.wrapper.position.set(p.x,rescue?surf(p.i,p.x):p.y,.55)
      actor.wrapper.rotation.y=pose.yaw
      actor.wrapper.rotation.z=!rescue&&p.dead>0?-.25*(p.face||1):0
      actor.wrapper.visible=pose.visible
      if(actor.hammer)actor.hammer.visible=p.ham>0
      if(!KG.paused||!kongAnimeReady.has(id))actor.rig.update(pose.action,pose.time,KG.paused?0:delta,!kongAnimeReady.has(id))
      kongAnimeReady.add(id)
    }
  })
  return <group ref={group} dispose={null}/>
}
