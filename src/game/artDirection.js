// Shared anime art language. Models use world units and never change simulation state.
import { ConeGeometry, CylinderGeometry, SphereGeometry, LatheGeometry, Vector2 } from 'three'

// Dense Empire Rise forests can exceed 8k branch pieces in a single view.
export const ART_CAPACITY = { leaf: 8192, cone: 8192, branch: 16384, organic: 8192, cloth: 8192 }
function canopyGeometry() {
  const geometry=new SphereGeometry(.5,12,8),positions=geometry.attributes.position
  for(let i=0;i<positions.count;i++) {
    const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i),a=Math.atan2(z,x)
    const lobes=1+.075*Math.sin(a*5+y*7)*Math.max(0,1-y*y*4)
    positions.setXYZ(i,x*lobes,y*(1+.055*Math.cos(a*3)),z*lobes)
  }
  geometry.computeVertexNormals()
  return geometry
}
export function artGeometries() {
  return {
    leaf: canopyGeometry(),
    cone: new ConeGeometry(0.5, 1, 9),
    branch: new CylinderGeometry(0.28, 0.5, 1, 7),
    organic: new SphereGeometry(0.5, 14, 10),
    cloth: new LatheGeometry([[0,-.5],[.3,-.48],[.41,-.3],[.5,.24],[.41,.43],[.24,.5],[0,.5]].map(([r,y]) => new Vector2(r,y)), 12),
  }
}
const shade = (c, k) => c.map(v => v * k)
export function shape(api, kind, x,y,z, sx,sy,sz, color, rz=0, ry=0) {
  if (api.putShape) api.putShape(kind,x,y,z,sx,sy,sz,rz,...color,ry)
  else (api.putBody || api.put3)(x,y,z,sx,sy,sz,rz,...color,ry)
}
export function branch(api, a,b, width, color, kind='branch') {
  const dx=b[0]-a[0], dy=b[1]-a[1], dz=b[2]-a[2], len=Math.hypot(dx,dy,dz)
  if (len < .0001) return
  shape(api,kind,(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,width,len,width,color,-Math.acos(Math.max(-1,Math.min(1,dy/len))),Math.atan2(-dz,dx))
}

export function treeModel(api,x,y,z,height=10,seed=1,time=0,o={}) {
  const pine=o.kind==='pine'||o.kind==='snow', dead=o.kind==='dead'||o.kind==='ash', crystal=o.kind==='crystal'||o.kind==='cave'
  const leaf=o.leaf||[.19,.48,.26], bark=o.bark||[.29,.17,.11], h=height, ph=seed*2.39996
  const sway=Math.sin(time*.8+ph)*h*.018, lean=Math.sin(ph)*h*.05
  if (crystal) {
    for(let i=0;i<5;i++) { const a=ph+i*2.4, hh=h*(.42+(i%3)*.23); shape(api,'cone',x+Math.cos(a)*h*.14,y+hh*.5,z+Math.sin(a)*h*.14,h*.18,hh,h*.18,shade(leaf,.75+i*.14),Math.sin(a)*.14,a) }
    return
  }
  const top=[x+lean,y+h*.72,z],bend=[x+lean*.3,y+h*.35,z+Math.sin(ph)*h*.018]
  branch(api,[x,y,z],bend,h*.12,bark)
  branch(api,bend,top,h*.079,shade(bark,1.1))
  if (!o.low) for(let i=0;i<3;i++) { const a=ph+i*2.094; branch(api,[x+Math.cos(a)*h*.13,y+.02,z+Math.sin(a)*h*.13],[x,y+h*.14,z],h*.07,shade(bark,.85)) }
  if(pine) {
    for(let i=0;i<4;i++) {
      const w=h*(.66-i*.135), hh=h*(.4-i*.025), yy=y+h*(.32+i*.17)
      shape(api,'cone',x+lean*.4+sway*(i+1)/4,yy,z,w,hh,w,shade(leaf,.72+i*.16),0,ph+i*.5)
      if(o.kind==='snow') shape(api,'cone',x+lean*.4+sway*(i+1)/4,yy+hh*.14,z,w*.73,hh*.72,w*.73,[.83,.93,1],0,ph+i*.5)
    }
  } else {
    const count=o.low?3:5
    for(let i=0;i<count;i++) {
      const a=ph+i*2.4, reach=h*(i===count-1?.08:.22), yy=y+h*(.53+(i%3)*.12)
      const tip=[x+lean+Math.cos(a)*reach+sway,y+h*(.71+(i%3)*.1),z+Math.sin(a)*reach]
      branch(api,[x+lean*.5,yy-h*.15,z],tip,h*(.045-i*.004),shade(bark,1.08))
      if(dead) {
        if(!o.low) branch(api,tip,[tip[0]+Math.cos(a+.7)*h*.12,tip[1]+h*.16,tip[2]+Math.sin(a+.7)*h*.12],h*.022,bark)
      } else {
        const w=h*(.53+(i%2)*.08),tint=shade(leaf,.78+i*.09)
        shape(api,'leaf',...tip,w,h*.37,w*.93,tint,Math.sin(a)*.16,a)
        if(!o.low) shape(api,'leaf',tip[0]-w*.08,tip[1]+h*.095,tip[2]-w*.06,w*.72,h*.25,w*.66,shade(leaf,1.14+i*.04),0,a+1)
      }
    }
    if(!dead)shape(api,'leaf',x+lean+sway,y+h*.96,z,h*.43,h*.31,h*.42,shade(leaf,1.15),0,ph)
  }
}

// Faces point along local +Z. Eyes sit on the surface; hair uses separate tapered locks.
export function animeHead(api,x,y,z,size=1,yaw=0,o={}) {
  const skin=o.skin||[.94,.71,.57], hair=o.hair||[.055,.09,.16], iris=o.iris||[.12,.62,.77]
  const c=Math.cos(yaw),s=Math.sin(yaw)
  const P=(kind,lx,ly,lz,w,h,d,col,rz=0) => shape(api,kind,x+(lx*c+lz*s)*size,y+ly*size,z+(-lx*s+lz*c)*size,w*size,h*size,d*size,col,rz,yaw)
  P('organic',0,0,0,1.04,1.18,.94,skin)
  P('organic',0,-.34,.16,.68,.55,.65,skin) // small chin, fuller cranium
  if(o.low) { P('organic',0,.35,-.12,1.12,.75,1.04,hair); P('organic',0,.06,.46,.64,.19,.04,[.06,.08,.12]); return }
  const blink=o.time===undefined?1:(o.time*1.07+Math.abs(x*.017+z*.013))%4.7<.12?.12:1
  for(const side of [-1,1]) {
    P('organic',side*.49,-.01,0,.23,.36,.2,skin)
    P('organic',side*.235,.055,.427,.335,.34*blink,.095,[.99,.98,.94])
    P('organic',side*.21,.04,.478,.185,.26*blink,.045,iris)
    P('organic',side*.205,.065,.506,.08,.18*blink,.027,[.025,.03,.06])
    if(blink>.5)P('organic',side*.24,.12,.526,.06,.07,.02,[1.7,1.7,1.7])
    P('organic',side*.235,.195,.452,.33,.035,.055,shade(hair,.7),side*.1)
    P('branch',side*.24,.25,.455,.055,.36,.045,hair,side*(1.36+(o.fierce?.2:0)))
    P('organic',side*.34,-.2,.4,.18,.045,.025,[.87,.42,.36])
  }
  P('organic',0,-.12,.485,.105,.15,.17,skin)
  P('organic',0,-.32,.422,.16,o.talking?.075:.035,.045,[.43,.19,.19])
  if(o.helmet) { P('organic',0,.3,-.025,1.15,.85,1.03,o.helmet); return }
  if(o.style==='bald') return
  P('organic',0,.38,-.1,1.13,.76,1.05,hair)
  if(o.style==='long') P('cloth',0,-.2,-.43,1.17,1.7,.5,hair)
  if(o.style==='bun') P('organic',0,.8,-.25,.5,.5,.5,hair)
  if(o.style==='afro') { P('organic',0,.42,-.15,1.45,1.2,1.35,hair); return }
  if(o.style==='bun') return
  for(let i=0;i<(o.style==='mohawk'?3:7);i++) {
    const a=i*2.39996, side=Math.cos(a)
    P('cone',side*.38,.56+Math.sin(a)*.06,Math.sin(a)*.31,.38,.75,.42,shade(hair,.9+(i%3)*.12),-side*.45)
  }
  for(let i=0;i<4;i++) P('cone',(i-1.5)*.23,.29+(i%2)*.09,.405,.32,.68,.3,shade(hair,1+i*.035),Math.PI+(i-1.5)*.13)
}

// Joint targets keep feet planted during stance, with a bent knee on the recovery step.
// attack is normalized (0..1): anticipation, fast extension, then recovery.
export function animeActor(api,x,y,z,height=6,yaw=0,time=0,o={}) {
  const sc=height/6, color=o.color||[.2,.65,.85], dark=o.dark||[.075,.11,.19], skin=o.skin||[.94,.71,.57]
  const phase=o.phase??time*7, stride=o.moving?Math.sin(phase):0, bob=o.moving?Math.abs(Math.sin(phase))*.09:Math.sin(time*2)*.025
  const attack=Math.max(0,Math.min(1,o.attack||0)), reach=attack<.28?-attack/.28*.35:attack<.52?-.35+(attack-.28)/.24*1.65:1.3*(1-(attack-.52)/.48)
  const lean=o.lean||0, ca=Math.cos(yaw),sa=Math.sin(yaw)
  const L=(a,b,c)=>[x+(a*ca+c*sa)*sc,y+b*sc,z+(-a*sa+c*ca)*sc]
  const P=(kind,a,b,c,w,h,d,col,rz=0)=>shape(api,kind,...L(a,b,c),w*sc,h*sc,d*sc,col,rz,yaw)
  const B=(a,b,w,col)=>branch(api,L(...a),L(...b),w*sc,col,'organic')
  for(const side of [-1,1]) {
    const step=stride*side, foot=[side*.43,.27,step*.65], hip=[side*.34,2.55+bob,lean*.1]
    const knee=[side*.4,1.36+Math.max(0,step)*.3,Math.max(.03,step)*.62+.12]
    B(hip,knee,.58,dark); B(knee,foot,.46,dark)
    P('organic',...knee,.5,.48,.5,shade(dark,1.3))
    P('cloth',foot[0],.25,foot[2]+.16,.61,.5,.98,dark)
    P('organic',side*.95,3.96+bob,lean,.63,.61,.7,color)
    const shoulder=[side*.97,3.95+bob,lean], elbow=[side*1.18,3.25+bob,lean-stride*side*.3]
    const hand=side===1&&attack>0?[side*.83,3.45+Math.max(0,reach)*.3,lean+.45+reach]:[side*1.16,2.66+bob,lean-stride*side*.5+.12]
    if(side===1&&attack>0) { elbow[1]+=reach*.18; elbow[2]+=reach*.45 }
    if(o.zombie) { elbow[1]=3.55+bob; elbow[2]=.65; hand[1]=3.65+bob+Math.sin(time*3+side)*.1; hand[2]=1.2+Math.max(0,reach)*.3 }
    B(shoulder,elbow,.47,color); B(elbow,hand,.37,skin); P('organic',...hand,.44,.51,.43,skin)
  }
  P('cloth',0,3.42+bob,lean*.65,1.8,1.7,1.02,color)
  P('cloth',0,2.68+bob,lean*.2,1.25,.6,.83,dark)
  P('organic',0,4.42+bob,lean,.4,.52,.43,skin)
  for(const side of [-1,1]) P('branch',side*.22,4.1+bob,.51+lean*.65,.1,.62,.09,[.92,.93,.84],side*.5)
  P('organic',0,3.53+bob,.55+lean*.65,.2,.25,.08,[1,.7,.24])
  if(!o.low) {
    P('cloth',0,2.72+bob,lean*.2,1.33,.16,.9,[.24,.19,.17])
    P('organic',0,2.72+bob,.47+lean*.2,.24,.2,.1,[.95,.72,.33])
    for(const side of [-1,1]) {
      P('organic',side*.43,.16,stride*side*.65+.34,.65,.13,.98,shade(dark,.65))
      P('organic',side*.63,3.16+bob,.49+lean*.65,.29,.37,.08,shade(color,.79))
    }
  }
  // Split coat tails and scarf follow the movement rather than rigidly tracking the torso.
  if(o.coat!==false) for(const side of [-1,1]) P('cloth',side*.47,2.55+bob,-.45-Math.abs(stride)*.24,.68,1.35,.25,shade(color,.78),side*.1+stride*.12)
  P('cloth',-.13,4.33+bob,lean,1.05,.25,1.03,o.accent||[.93,.37,.26])
  P('cloth',-.5,3.72+bob,-.66-Math.abs(stride)*.25,.33,1.28,.17,o.accent||[.93,.37,.26],Math.sin(time*4)*.12)
  animeHead(api,...L(0,5.13+bob,lean),sc,yaw,{skin,hair:o.hair,iris:o.iris,helmet:o.helmet,talking:o.talking,fierce:attack>.3,low:o.low,time})
}

// The orthographic games share the same face proportions in their raised sprite pass.
export function animePortrait(api,x,y,z,size=2.4,o={}) {
  const put=api.putBall||api.put, skin=o.skin||[1.05,.78,.61], hair=o.hair||[.08,.12,.19]
  const P=(dx,dy,dz,w,h,c)=>put(x+dx*size,y+dy*size,z+dz,w*size,h*size,...c)
  P(0,0,0,1,1.13,skin)
  for(const side of [-1,1]) {
    P(side*.21,.06,.55,.3,.34,[1.3,1.3,1.2]); P(side*.21,.045,.8,.15,.23,o.iris||[.1,.55,.72]); P(side*.22,.06,1,.067,.16,[.02,.03,.05]); P(side*.245,.12,1.15,.045,.06,[2,2,2])
  }
  P(0,-.27,.65,.16,.035,[.5,.22,.2])
  if(!o.helmet) { P(0,.39,.4,1.06,.42,hair); for(let i=0;i<5;i++) P((i-2)*.2,.51+Math.sin(i*2)*.09,.45,.29,.38,hair); P(-.4,.08,.5,.24,.65,hair) }
}
