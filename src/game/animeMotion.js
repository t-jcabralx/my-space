// Shared normalized humanoid poses. Values are radians in VRM's normalized T-pose.
const smooth = x => { x=Math.max(0,Math.min(1,x)); return x*x*(3-2*x) }
export const ANIME_ACTIONS = ['idle','greet','run','strike','jump','climb','hammer','hurt']
export function animePose(action,time) {
  const t=Number.isFinite(time)?Math.max(0,time):0, s=Math.sin, phase=t*9
  const bones={
    hips:[0,0,0],spine:[0,0,s(t*.85)*.016],chest:[0,0,0],neck:[0,s(t*.63)*.055,0],head:[0,0,0],
    leftUpperArm:[0,0,-1.25],rightUpperArm:[0,0,1.25],leftLowerArm:[0,-.12,0],rightLowerArm:[0,.12,0],
    leftHand:[0,0,-.06],rightHand:[0,0,.06],leftUpperLeg:[0,0,.014],rightUpperLeg:[0,0,-.014],
    leftLowerLeg:[.018,0,0],rightLowerLeg:[.018,0,0],leftFoot:[-.018,0,0],rightFoot:[-.018,0,0],
  }
  let bob=s(t*2.2)*.002, happy=.13, angry=0, mouth=0, impact=0
  if(action==='greet') {
    const wave=s(t*5.4)
    bones.rightUpperArm=[.05,.06,-.63];bones.rightLowerArm=[0,.1,-1.3]
    bones.rightHand=[0,wave*.24,wave*.2]
    bones.head=[-.04,.08,s(t*2)*.07];bones.chest=[0,-.06,-.025]
    happy=.6;mouth=.08+Math.max(0,s(t*4))*.08
  } else if(action==='run') {
    const stride=s(phase)
    bones.hips=[.08,0,stride*.032];bones.chest=[.04,stride*.06,0];bones.head=[-.09,0,0]
    bones.leftUpperLeg=[stride*.66,0,.025];bones.rightUpperLeg=[-stride*.66,0,-.025]
    bones.leftLowerLeg=[.22+Math.max(0,-stride)*.98,0,0];bones.rightLowerLeg=[.22+Math.max(0,stride)*.98,0,0]
    bones.leftFoot=[-.12-Math.max(0,-stride)*.35,0,0];bones.rightFoot=[-.12-Math.max(0,stride)*.35,0,0]
    bones.leftUpperArm=[-stride*.56,0,-1.28];bones.rightUpperArm=[stride*.56,0,1.28]
    bones.leftLowerArm=[0,-1.25,0];bones.rightLowerArm=[0,1.25,0]
    bob=.017+Math.abs(Math.cos(phase))*.036;happy=.02;mouth=.1
  } else if(action==='strike') {
    const cycle=t%2.4, anticipation=smooth(cycle/.65), punch=smooth((cycle-.65)/.16), recover=smooth((cycle-1.08)/.64)
    const reach=punch*(1-recover), wind=anticipation*(1-punch)
    bones.hips=[.015,-.18+wind*.28-reach*.23,0];bones.chest=[.025,-wind*.22+reach*.36,-reach*.065]
    bones.leftUpperArm=[-.16,-.28,-1.12];bones.leftLowerArm=[0,-1.52,-.22]
    bones.rightUpperArm=[.03,wind*-.24+reach*1.34,1.13-reach*.87]
    bones.rightLowerArm=[0,1.5*(1-reach),.08]
    bones.leftUpperLeg=[-.2,0,.1];bones.rightUpperLeg=[.12,0,-.13]
    bones.leftLowerLeg=[.22,0,0];bones.rightLowerLeg=[.12,0,0]
    bones.head=[-.02,-reach*.12,0]
    angry=.6;happy=0;mouth=reach*.25;impact=Math.max(0,1-Math.abs(cycle-.85)/.14)
  } else if(action==='jump') {
    bones.chest=[.12,0,0];bones.head=[-.12,0,0]
    bones.leftUpperArm=[-.35,0,-.7];bones.rightUpperArm=[-.35,0,.7]
    bones.leftLowerArm=[0,-.6,0];bones.rightLowerArm=[0,.6,0]
    bones.leftUpperLeg=[-.58,0,.06];bones.rightUpperLeg=[-.25,0,-.06]
    bones.leftLowerLeg=[1.15,0,0];bones.rightLowerLeg=[.65,0,0]
    happy=0;mouth=.15;bob=0
  } else if(action==='climb') {
    const step=s(t*5)
    bones.chest=[-.08,0,step*.035];bones.head=[-.18,0,0]
    bones.leftUpperArm=[-.24,0,.48+step*.25];bones.rightUpperArm=[-.24,0,-.48+step*.25]
    bones.leftLowerArm=[0,-.8,-.22];bones.rightLowerArm=[0,.8,.22]
    bones.leftUpperLeg=[-.4-Math.max(0,step)*.65,0,.05];bones.rightUpperLeg=[-.4-Math.max(0,-step)*.65,0,-.05]
    bones.leftLowerLeg=[.65+Math.max(0,step)*.6,0,0];bones.rightLowerLeg=[.65+Math.max(0,-step)*.6,0,0]
    bob=0;happy=0
  } else if(action==='hammer') {
    const swing=(s(t*16)+1)/2
    bones.chest=[swing*.16,0,-swing*.08]
    bones.rightUpperArm=[-.4,0,.15+swing*1.1];bones.rightLowerArm=[0,1.1-swing*.7,0]
    bones.leftUpperArm=[0,-.3,-1.05];bones.leftLowerArm=[0,-.6,0]
    bones.leftUpperLeg=[-.1,0,.1];bones.rightUpperLeg=[.1,0,-.1]
    angry=.3;happy=0
  } else if(action==='hurt') {
    bones.chest=[-.3,0,0];bones.head=[-.25,0,0]
    bones.leftUpperArm=[-.5,0,-.55];bones.rightUpperArm=[-.5,0,.55]
    bones.leftUpperLeg=[-.3,0,.15];bones.rightUpperLeg=[-.3,0,-.15]
    bones.leftLowerLeg=[.6,0,0];bones.rightLowerLeg=[.6,0,0]
    happy=0;mouth=.35
  }
  for(const side of ['left','right'])for(const finger of ['Index','Middle','Ring','Little']) {
    for(const joint of ['Proximal','Intermediate','Distal'])bones[side+finger+joint]=[0,0,(side==='left'?-1:1)*(['strike','hammer','climb'].includes(action)?.95:action==='greet'&&side==='right'?.04:.16)]
  }
  const blinkPhase=t%4.4,blink=blinkPhase<.13?Math.sin(blinkPhase/.13*Math.PI):0
  return {bones,bob,expressions:{blink,happy,angry,aa:mouth},impact}
}
