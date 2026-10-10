import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm'
import { animePose } from './animeMotion.js'

export const ANIME_MODEL_URL='/models/anime/pixiv-sample.vrm'
export function styleAnimeRig(rig,shirt='#42657e') {
  rig.scene.traverse(o=>{if(o.isMesh){
    o.castShadow=true;o.receiveShadow=false
    for(const mat of Array.isArray(o.material)?o.material:[o.material]) {
      if(mat.name.includes('Tops_01_CLOTH')){mat.color.set(shirt);mat.shadeColorFactor?.copy(mat.color).multiplyScalar(.55)}
      if(mat.name.includes('Bottoms_01_CLOTH')){mat.color.set('#38435b');mat.shadeColorFactor?.set('#232c43')}
      if(mat.name.includes('SKIN')){mat.color.set('#ffe8d8');mat.shadeColorFactor?.set('#e8b0a5')}
    }
  }})
}
export async function loadAnimeRig(url=ANIME_MODEL_URL) {
  const loader=new GLTFLoader()
  loader.register(parser=>new VRMLoaderPlugin(parser))
  const gltf=await loader.loadAsync(url),vrm=gltf.userData.vrm
  if(!vrm)throw new Error('The character has no VRM humanoid rig.')
  VRMUtils.removeUnnecessaryVertices(vrm.scene)
  VRMUtils.combineSkeletons(vrm.scene)
  vrm.scene.traverse(object=>{object.frustumCulled=false})
  const bones={},rest={},target=new THREE.Quaternion(),euler=new THREE.Euler()
  for(const name of Object.keys(vrm.humanoid.humanBones)) {
    const node=vrm.humanoid.getNormalizedBoneNode(name)
    if(node){bones[name]=node;rest[name]=node.quaternion.clone()}
  }
  const hips=bones.hips,hipY=hips?.position.y||0
  const bounds=new THREE.Box3().setFromObject(vrm.scene),height=bounds.max.y-bounds.min.y
  return {
    vrm,scene:vrm.scene,height,
    update(action,time,delta,snap=false) {
      const pose=animePose(action,time),blend=snap?1:1-Math.exp(-Math.min(delta,.05)*14)
      for(const [name,rotation] of Object.entries(pose.bones))if(bones[name]) {
        target.setFromEuler(euler.set(...rotation));target.premultiply(rest[name]);bones[name].quaternion.slerp(target,blend)
      }
      if(hips)hips.position.y=hipY+pose.bob
      for(const [name,value] of Object.entries(pose.expressions))vrm.expressionManager?.setValue(name,value)
      vrm.update(Math.min(delta,.05))
      return pose
    },
    dispose(){VRMUtils.deepDispose(vrm.scene)},
  }
}
