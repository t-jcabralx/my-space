import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ANIME_ACTIONS, animePose } from '../src/game/animeMotion.js'
import { kongAnimePresentation } from '../src/game/kongAnimeState.js'

const bytes=readFileSync(new URL('../public/models/anime/pixiv-sample.vrm',import.meta.url))
assert.equal(bytes.readUInt32LE(0),0x46546c67)
assert.equal(bytes.readUInt32LE(8),bytes.length)
const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString())
const avatar=gltf.extensions.VRMC_vrm
assert.equal(avatar.meta.allowRedistribution,true)
assert.equal(avatar.meta.modification,'allowModificationRedistribution')
const bones=avatar.humanoid.humanBones,expressions=avatar.expressions.preset
for(const action of ANIME_ACTIONS) {
  for(let i=0;i<600;i++) {
    const pose=animePose(action,i/60)
    assert.ok(Number.isFinite(pose.bob))
    for(const [bone,rotation] of Object.entries(pose.bones)) {
      assert.ok(bone in bones,`Model is missing ${bone}`)
      assert.equal(rotation.length,3)
      assert.ok(rotation.every(v=>Number.isFinite(v)&&Math.abs(v)<=Math.PI))
    }
    for(const [expression,value] of Object.entries(pose.expressions)) {
      assert.ok(expression in expressions,`Model is missing ${expression}`)
      assert.ok(value>=0&&value<=1)
    }
    assert.ok(pose.impact>=0&&pose.impact<=1)
  }
  console.log('PASS',action,'uses supported bones and expressions, finite bounded animation over 10 seconds')
}
assert.deepEqual(animePose('idle',NaN),animePose('idle',0))
assert.notDeepEqual(animePose('idle',1).bones,animePose('run',1).bones)
assert.notDeepEqual(animePose('strike',.6).bones,animePose('strike',.85).bones)
for(const bone of ['hips','chest','rightUpperArm','rightLowerArm'])assert.deepEqual(animePose('strike',1.9).bones[bone],animePose('strike',2.3).bones[bone])
console.log('PASS original model metadata, corrupt time handling, motion differentiation and completed attack recovery')
const player={x:0,y:12,ground:true,vx:0,face:1,anim:2,in:{},inv:0}
for(const [state,action] of [[{},'idle'],[{vx:12},'run'],[{ground:false},'jump'],[{ladder:{},ground:false},'climb'],[{ham:5,in:{hit:true}},'hammer'],[{done:true},'greet'],[{dead:1,ladder:{}},'hurt']]) {
  const p={...player,...state},before=structuredClone(p)
  assert.equal(kongAnimePresentation(p,2).action,action)
  assert.deepEqual(p,before,'Rendering must never mutate the player or inputs')
}
assert.equal(kongAnimePresentation({...player,out:true},2).visible,false)
assert.equal(kongAnimePresentation({...player,gone:true},2).visible,false)
assert.equal(kongAnimePresentation({...player,inv:1},0).visible,false)
assert.equal(kongAnimePresentation({...player,ladder:{}},2).yaw,Math.PI)
assert.equal(kongAnimePresentation({...player,ham:5,hit:.18},2).action,'hammer','Remote hammer uses the replicated action timer')
assert.equal(kongAnimePresentation(player,2,12).action,'run','Remote movement animates from replicated position changes')
assert.equal(kongAnimePresentation({...player,ladder:{},anim:10},5).time,kongAnimePresentation({...player,ladder:{},anim:20},6).time,'Climbing animation holds its pose while stationary on a rung')
console.log('PASS gameplay action priority, ladder orientation, visibility and simulation isolation')
