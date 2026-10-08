import { animeHead } from '../artDirection.js'
// Mini-game props share their geometry between gameplay and the gallery.
const TAU = Math.PI * 2
export const FRUIT_COLORS = ['#ef5273','#ff922c','#9860db','#f4d54a','#8ecb52','#ffaf9c','#5c83d7','#4ca56a']
export function fruitModel(r,x,y,z,size,kind,time=0,angle=0) {
  const ca=Math.cos(angle),sa=Math.sin(angle)
  const point=(px,py,pz)=>[x+(px-x)*ca-(py-y)*sa,y+(px-x)*sa+(py-y)*ca,pz]
  const sphere=(px,py,pz,rad,col,o={})=>r.sphere(...point(px,py,pz),rad,col,o)
  const oval=(px,py,pz,sx,sy,sz,col,o={})=>r.ellipsoid(...point(px,py,pz),sx,sy,sz,col,{...o,rz:(o.rz||0)+angle})
  const line=(a,b,col,w)=>r.line(point(...a),point(...b),col,w)
  const c=FRUIT_COLORS[kind%8]
  if(kind===2) {
    for(let i=0;i<7;i++) {const a=i*2.4; sphere(x+Math.cos(a)*size*.43,y+Math.sin(a)*size*.5,z+(i%2)*size*.28,size*.46,c)}
  } else {
    if(kind===5)for(const side of [-1,1])oval(x+side*size*.27,y,z,size*.73,size*.94,size*.81,c)
    else oval(x,y,z,size*(kind===3?1.04:1),size,size*.84,c)
    if(kind===7) for(let i=-2;i<=2;i++)for(let j=0;j<13;j++) {
      const longitude=i*.47,lat=-1.2+j*2.4/13,next=lat+2.4/13
      const surface=a=>[x+Math.sin(longitude)*Math.cos(a)*size*1.012,y+Math.sin(a)*size*1.012,z-Math.cos(longitude)*Math.cos(a)*size*.85]
      line(surface(lat),surface(next),'#28704c',size*.052)
    }
    if(kind===1)for(let i=0;i<12;i++){
      const a=i*2.39996,rr=size*(.57+(i%3)*.1),xx=Math.cos(a)*rr,yy=Math.sin(a)*rr
      sphere(x+xx,y+yy,z-Math.sqrt(size*size-rr*rr)*.85,size*.023,'#dc7d2d')
    }
    if(kind===6)for(let i=0;i<5;i++){const a=i*TAU/5;oval(x+Math.cos(a)*size*.15,y+size*.93,z+Math.sin(a)*size*.15,size*.12,size*.035,size*.08,'#365ea5',{rz:a})}
  }
  line([x,y+size*.82,z],[x+size*.1,y+size*1.13,z],'#765a3c',Math.max(1.3,size*.12))
  oval(x+size*.3,y+size*1.08,z,size*.3,size*.11,size*.14,'#478b55',{rz:.4})
  const blink=(time+kind*.37)%5.2<.12?.14:1
  for(const side of [-1,1]) {
    oval(x+side*size*.25,y+size*.055,z-size*.81,size*.12,size*.155*blink,size*.048,'#fff9e7')
    oval(x+side*size*.24,y+size*.045,z-size*.856,size*.07,size*.108*blink,size*.03,'#293d45')
    if(blink>.5)sphere(x+side*size*.24-size*.023,y+size*.093,z-size*.89,size*.027,'#ffffff')
    oval(x+side*size*.44,y-size*.13,z-size*.76,size*.1,size*.046,size*.03,'#ef9b9c')
  }
  line([x-size*.09,y-size*.17,z-size*.86],[x,y-size*.215,z-size*.875],'#7c3a43',Math.max(.7,size*.032))
  line([x,y-size*.215,z-size*.875],[x+size*.09,y-size*.17,z-size*.86],'#7c3a43',Math.max(.7,size*.032))
}

export function moleModel(r,x,y,z,size,gold=false,time=0) {
  const fur=gold?'#eebc55':'#a86a42'
  r.ellipsoid(x,y,z,size,size*.96,size*.7,fur)
  for(const side of [-1,1]) {
    r.sphere(x+side*size*.76,y+size*.62,z,size*.25,fur)
    r.sphere(x+side*size*.76,y+size*.62,z-size*.19,size*.13,'#dca9a2')
    r.sphere(x+side*size*.3,y+size*.22,z-size*.64,size*.19,'#fff4e6')
    r.sphere(x+side*size*.29,y+size*.2,z-size*.8,size*.1,'#293247')
    r.ellipsoid(x+side*size*.7,y-size*.65,z-size*.36,size*.24,size*.15,size*.22,'#d5b19d')
  }
  r.ellipsoid(x,y-size*.25,z-size*.7,size*.48,size*.3,size*.22,'#e8c7af')
  r.sphere(x,y-size*.12,z-size*.9,size*.15,'#c77484')
  r.box(x,y-size*.42,z-size*.87,size*.22,size*.19,size*.08,'#fff9ec')
  if(!gold){r.ellipsoid(x,y+size*.73,z,size*.8,size*.34,size*.66,'#365bd3');r.ellipsoid(x,y+size*.62,z-size*.55,size*.9,size*.1,size*.42,'#3150a7')}
  if(gold) for(let i=-1;i<=1;i++)r.pyramid(x+i*size*.35,y+size*.84,z,size*.3,size*.42,size*.3,'#fff1a3')
}

export function fishModel(r,x,y,z,size,kind,dir=1,time=0) {
  if(kind===4) { // Clearly distinguish the boot from a valuable fish.
    r.box(x-dir*size*.2,y+size*.22,z,size*.75,size*1.25,size*.62,'#6e6472')
    r.box(x+dir*size*.25,y-size*.43,z,size*1.5,size*.5,size*.8,'#443f52')
    r.box(x+dir*size*.25,y-size*.69,z,size*1.55,size*.13,size*.84,'#282c3b')
    for(let i=0;i<3;i++)r.line([x-dir*size*.42,y+i*size*.2,z-size*.33],[x+dir*size*.08,y+i*size*.2,z-size*.33],'#c5b8a5',size*.055)
    return
  }
  const colors=['#75cfe4','#f6a444','#f4d778','#aa83d8'], c=colors[kind]||colors[0]
  const wag=Math.sin(time*7+x*.015)*size*.12
  r.ellipsoid(x,y,z,size*(kind===2?.92:kind===3?.62:1.08),size*(kind===2?.82:kind===3?.82:.58),size*.45,c)
  r.ellipsoid(x+dir*size*.05,y-size*.24,z-size*.3,size*.75,size*.25,size*.2,kind===1?'#ffe5ae':'#d8f0dd')
  if(kind===3) {
    for(let i=0;i<5;i++) {const xx=x+(i-2)*size*.22,mid=[xx+Math.sin(time*5+i)*size*.16,y-size*.93,z];r.line([xx,y-size*.4,z],mid,c,size*.11);r.line(mid,[xx+Math.cos(time*5+i)*size*.2,y-size*1.36,z-size*.1],c,size*.07)}
  } else {
    for(const side of [-1,1])r.ellipsoid(x-dir*size*1.13,y+side*size*.22+wag,z,size*.27,size*.34,size*.1,c,{rz:side*dir*.45})
    r.ellipsoid(x-dir*size*.2,y+size*.56,z,size*.48,size*.2,size*.075,c,{rz:dir*.3})
    r.ellipsoid(x+dir*size*.02,y-size*.12,z-size*.44,size*.3,size*.15,size*.04,c,{rz:dir*(.3+Math.sin(time*10)*.18)})
    if(kind===1) for(const offset of [-.35,.25])r.ellipsoid(x+offset*size,y,z-size*.43,size*.12,size*.48,size*.035,'#fff2d2')
    if(kind===2) for(let i=0;i<8;i++){const a=i*TAU/8;r.pyramid(x+Math.cos(a)*size*.85,y+Math.sin(a)*size*.75,z,size*.16,size*.23,size*.16,'#d4aa48',{rz:a-Math.PI/2})}
    if(kind===0)for(let i=0;i<5;i++)r.ellipsoid(x-dir*size*(.15+i*.13),y+size*.19,z-size*.44,size*.06,size*.12,size*.025,'#4999b4',{rz:-dir*.5})
  }
  const eyes=kind===3?[-.22,.22]:[dir*.56]
  for(const ex of eyes){r.ellipsoid(x+size*ex,y+size*.14,z-size*.43,size*.19,size*.23,size*.09,'#fff7df');r.ellipsoid(x+size*(ex+dir*.04),y+size*.14,z-size*.52,size*.09,size*.15,size*.035,'#24324a');r.sphere(x+size*(ex+dir*.02),y+size*.2,z-size*.56,size*.033,'#ffffff')}
}

export function wrestlerModel(r,x,y,z,size,color,yaw=0,time=0,moving=false,hero=false,pose={}) {
  const skin='#e9b28e',step=moving?Math.sin(time*9):0,ca=Math.cos(yaw),sa=Math.sin(yaw),push=pose.push||0,hit=pose.hit||0
  const lean=(moving?.07:0)+push*.08-hit*.13,bob=Math.abs(step)*.018-hit*.035
  const point=(a,b,c)=>{c+=b*lean;return[x+(a*ca+c*sa)*size,y+(b+bob)*size,z+(-a*sa+c*ca)*size]}
  const oval=(a,b,c,w,h,d,col)=>r.ellipsoid(...point(a,b,c),w*size,h*size,d*size,col,{ry:yaw})
  for(const side of [-1,1]) {
    const dz=step*side*.06
    oval(side*.15,.09,dz,.12,.13,.12,skin);oval(side*.16,.045,.055+dz,.13,.055,.18,'#d99e7e')
    const elbow=[side*.34,.46+push*.09,.11],hand=[side*.24,.49+push*.14,.27+push*.17-hit*.08]
    r.line(point(side*.24,.61,0),point(...elbow),skin,size*.15)
    r.line(point(...elbow),point(...hand),skin,size*.13)
    oval(...hand,.095,.1,.075,skin)
    if(hero){oval(side*.16,.12,dz,.122,.047,.125,'#f3e8d0');oval(hand[0],hand[1],hand[2]-.065,.084,.065,.05,'#f3e8d0')}
  }
  oval(0,.43,0,.3,.29,.25,skin);oval(0,.245,0,.29,.095,.245,color)
  r.box(...point(0,.18,.23),size*.14,size*.2,size*.055,color,{ry:yaw})
  const headYaw=pose.faceCamera?Math.atan2(Math.sin(yaw)*.7,Math.cos(yaw)*.7-.65):yaw
  animeHead(r.modelApi,...point(0,.82,0),size*.38,headYaw,{skin:[.92,.7,.56],hair:hero?[.29,.105,.035]:[.065,.075,.11],style:hero?'spiky':'bun',iris:[.36,.19,.06],fierce:push>.2,time,talking:hit>.2})
  if(hero) {
    r.box(...point(0,.92,.18),size*.35,size*.05,size*.035,'#fff1cb',{ry:yaw})
    for(const side of [-1,1])r.line(point(side*.1,.92,-.15),point(side*.14,.78,-.24-Math.abs(step)*.06),'#fff1cb',size*.035)
    for(let i=-1;i<=1;i++)r.pyramid(...point(i*.045,.27,.25),size*.045,size*.07,size*.025,'#ffdc57',{ry:yaw})
    r.box(...point(0,.235,.257),size*.14,size*.025,size*.025,'#ffdc57',{ry:yaw})
  }
}

export function basketballModel(r,x,y,z,size,angle=0) {
  const ca=Math.cos(angle),sa=Math.sin(angle),P=(a,b,c)=>[x+(a-x)*ca-(b-y)*sa,y+(a-x)*sa+(b-y)*ca,c]
  const seam=(a,b)=>r.line(P(...a),P(...b),'#643d30',size*.035)
  r.sphere(x,y,z,size,'#ee873e')
  for(let i=0;i<18;i++) {
    const a=i*TAU/18,b=(i+1)*TAU/18
    seam([x+Math.cos(a)*size,y+Math.sin(a)*size,z-.4],[x+Math.cos(b)*size,y+Math.sin(b)*size,z-.4])
  }
  for(let i=0;i<16;i++) {
    const a=-Math.PI/2+i*Math.PI/16,b=a+Math.PI/16
    seam([x+Math.sin(a)*size,y,z-Math.cos(a)*size*1.005],[x+Math.sin(b)*size,y,z-Math.cos(b)*size*1.005])
    seam([x,y+Math.sin(a)*size,z-Math.cos(a)*size*1.005],[x,y+Math.sin(b)*size,z-Math.cos(b)*size*1.005])
  }
}


// Recognizable details from the supplied covers, built as geometry rather than decals.
export function chickModel(r,x,y,z,size,time=0,pitch=0) {
  const ca=Math.cos(pitch),sa=Math.sin(pitch),flap=Math.sin(time*22)*.65
  const P=(a,b,c)=>[x+(a*ca-b*sa)*size,y+(a*sa+b*ca)*size,z+c*size]
  const oval=(a,b,c,w,h,d,color,roll=0)=>r.ellipsoid(...P(a,b,c),w*size,h*size,d*size,color,{rz:roll+pitch})
  oval(0,0,0,1,.92,.78,'#ffc52f');oval(.18,-.23,-.62,.68,.59,.22,'#ffeaa1')
  for(const side of [-1,1]) {
    oval(-.5,flap*.32,side*.65,.58,.24,.25,'#f0a32c',flap)
    for(let i=0;i<3;i++)oval(-.88-i*.08,flap*.48-i*.14,side*.69,.32,.105,.15,'#ffda60',flap+i*.16)
    oval(-.15+side*.26,-.89,-.05,.12,.18,.14,'#e78b30',-.35)
  }
  for(let i=0;i<3;i++)oval(-.4+i*.22,.91+i*.035,0,.14,.35,.12,'#ffe268',.55+i*.18)
  const blink=time%4.8<.1?.16:1
  for(const [ex,ez,sc] of [[.67,-.57,1],[.06,-.77,.8]]) {
    oval(ex,.25,ez,.29*sc,.35*blink*sc,.16,'#fffaf0')
    oval(ex+.06,.23,ez-.13,.155*sc,.24*blink*sc,.07,'#694123')
    oval(ex+.085,.23,ez-.185,.073*sc,.16*blink*sc,.028,'#2f2d35')
    if(blink>.5)r.sphere(...P(ex+.02,.34,ez-.21),size*.056*sc,'#ffffff')
  }
  oval(.97,-.07,-.32,.32,.15,.23,'#f58b24');oval(.92,-.2,-.32,.24,.055,.19,'#b75a24')
}

export function cloudModel(r,x,y,z,size=20) {
  for(const [a,b,s] of [[-.72,0,.58],[-.15,.24,.73],[.5,.1,.6],[.91,-.06,.4]])r.ellipsoid(x+a*size,y+b*size,z,size*s,size*s*.6,size*s*.6,'#f2fbfc',{surface:'matte'})
}

export function courierModel(r,x,y,z,height=42,time=0,o={}) {
  const yaw=Math.PI*.72,ca=Math.cos(yaw),sa=Math.sin(yaw),phase=o.phase??time*10
  const stride=Math.sin(phase),air=!!o.airborne,bob=air?0:Math.abs(stride)*.025
  const suit=o.echo?'#2c607a':'#263958',trim=o.echo?'#96eeed':'#48d9ef',skin='#efb68e'
  const P=(a,b,c)=>[x+(a*ca+c*sa)*height,y+(b+bob)*height,z+(-a*sa+c*ca)*height]
  const oval=(a,b,c,w,h,d,col,roll=0)=>r.ellipsoid(...P(a,b,c),w*height,h*height,d*height,col,{ry:yaw,rz:roll,alpha:o.alpha??1})
  const limb=(a,b,col,w)=>r.line(P(...a),P(...b),col,w*height)
  for(const side of [-1,1]) {
    const step=stride*side,hip=[side*.085,.4,0],knee=[side*.095,air?.3:.23,air?side*.11:step*.1],foot=[side*.11,air?(side===1?.16:.05):.055,air?side*.16:step*.2]
    limb(hip,knee,suit,.105);limb(knee,foot,suit,.085)
    oval(foot[0],foot[1],foot[2]+.03,.07,.05,.12,'#172c47');oval(foot[0],foot[1]-.03,foot[2]+.035,.075,.015,.13,trim)
    const shoulder=[side*.16,.6,.04],elbow=[side*.21,air?.55:.47,air?.1:-step*.07],hand=[side*.2,air?.67:.48,air?.2:.13-step*.14]
    limb(shoulder,elbow,suit,.095);limb(elbow,hand,suit,.08);oval(...hand,.057,.055,.054,'#172c47')
    oval(hand[0],hand[1]+.025,hand[2]+.022,.039,.031,.03,skin)
    limb([side*.115,.55,.12],[side*.1,.43,.12],trim,.016)
  }
  oval(0,.51,.015,.17,.17,.12,suit);oval(0,.64,.015,.17,.055,.14,trim)
  oval(0,.54,.14,.065,.022,.022,'#efc86c')
  r.line(P(-.035,.39,.12),P(.035,.39,.12),'#e3b955',height*.025)
  const previous=r.modelAlpha;r.modelAlpha=o.alpha??1
  try {animeHead(r.modelApi,...P(0,.84,.025),height*.235,yaw,{hair:[.25,.1,.045],iris:[.4,.23,.08],time,fierce:air})}finally{r.modelAlpha=previous}
  limb([-.1,.64,-.07],[-.1,.58,-.21-Math.abs(stride)*.07],trim,.045)
}

export function coinModel(r,x,y,z,size=8,time=0) {
  const width=Math.max(.25,Math.abs(Math.cos(time*3)))
  r.ellipsoid(x,y,z,size*width,size,size*.25,'#eeb846',{surface:'paint'})
  r.ellipsoid(x,y,z-size*.26,size*.75*width,size*.75,size*.035,'#ffdf80')
  r.ellipsoid(x,y,z-size*.3,size*.15*width,size*.4,size*.02,'#bd8331')
}

export function minerModel(r,x,y,z,height=100,time=0,swing=0) {
  const lean=Math.sin(swing*Math.PI)*.045,P=(a,b,c)=>[x+(a+b*lean)*height,y+b*height,z+c*height]
  const oval=(a,b,c,w,h,d,col,roll=0)=>r.ellipsoid(...P(a,b,c),w*height,h*height,d*height,col,{rz:roll})
  const limb=(a,b,col,w)=>r.line(P(...a),P(...b),col,w*height)
  for(const side of [-1,1]){
    limb([side*.12,.34,0],[side*.15,.1,-.03],'#324357',.12)
    oval(side*.15,.065,-.04,.1,.065,.15,'#3a302b');oval(side*.15,.03,-.06,.105,.022,.15,'#d6a33e')
  }
  oval(0,.44,0,.22,.23,.15,'#334457');oval(0,.46,-.14,.14,.17,.025,'#8a6039')
  for(const side of [-1,1])limb([side*.13,.62,-.13],[side*.1,.3,-.14],'#e4ad3e',.032)
  oval(-.22,.42,.12,.09,.19,.12,'#624b36')
  animeHead(r.modelApi,...P(.015,.78,-.015),height*.34,Math.PI*.86,{hair:[.3,.13,.06],iris:[.34,.18,.08],time,fierce:swing>.25})
  oval(.015,.955,0,.23,.12,.2,'#e4ac35');oval(.04,.9,-.02,.285,.025,.23,'#f3c354')
  oval(.1,.955,-.185,.087,.087,.04,'#50493e');oval(.1,.955,-.221,.064,.064,.015,'#fff1a4')
  // The same swing drives both hands and the pickaxe head.
  const angle=1.6-swing*1.9,grip=[.22,.5,-.17],tip=[grip[0]+Math.cos(angle)*.62,grip[1]+Math.sin(angle)*.62,-.17]
  limb([-.15,.61,-.03],[.08,.46,-.2],'#334457',.105);limb([.08,.46,-.2],grip,'#e5b082',.07)
  limb([.17,.61,-.02],[.27,.47,-.1],'#334457',.11);limb([.27,.47,-.1],grip,'#e5b082',.075)
  limb([grip[0]-Math.cos(angle)*.19,grip[1]-Math.sin(angle)*.19,-.17],tip,'#a3733c',.055)
  oval(...grip,.08,.06,.06,'#4a3a31')
  const nx=-Math.sin(angle),ny=Math.cos(angle)
  for(const side of [-1,1]){
    const mid=[tip[0]+nx*side*.16,tip[1]+ny*side*.16,-.17],end=[tip[0]+nx*side*.29-Math.cos(angle)*.11,tip[1]+ny*side*.29-Math.sin(angle)*.11,-.17]
    limb(tip,mid,'#b7c7ce',.075);limb(mid,end,'#6f8698',.045)
  }
  return P(...tip)
}

export function mineCartModel(r,x,y,z,size=50,time=0) {
  r.box(x,y+size*.32,z,size,size*.55,size*.66,'#685a55')
  for(const side of [-1,1])r.box(x+side*size*.45,y+size*.32,z-size*.35,size*.075,size*.5,size*.08,'#abb5b7')
  r.box(x,y+size*.6,z,size*1.07,size*.06,size*.74,'#aebcbd')
  for(let i=0;i<5;i++)r.gem(x+(i-2)*size*.18,y+size*(.67+(i%2)*.1),z,size*.28,i%2?'#edbd52':'#6acbe6',{ry:i})
  for(const side of [-1,1]){
    const xx=x+side*size*.32
    r.disc(xx,y+size*.03,z-size*.38,size*.14,size*.08,'#283745');r.disc(xx,y+size*.03,z-size*.43,size*.07,size*.02,'#99aeb5')
    r.line([xx,y+size*.03,z-size*.46],[xx+Math.cos(time*3)*size*.1,y+size*.03+Math.sin(time*3)*size*.1,z-size*.46],'#d5d9ce',size*.025)
  }
}

export function hopperModel(r,x,y,z,height=43,time=0,vy=0,steer=0,land=0) {
  const squash=1-land*.16,lean=Math.max(-.18,Math.min(.18,steer*.003))
  const P=(a,b,c)=>[x+(a+b*lean)*height,y+b*height*squash,z+c*height]
  const oval=(a,b,c,w,h,d,col,roll=0)=>r.ellipsoid(...P(a,b,c),w*height,h*height*squash,d*height,col,{rz:roll-lean})
  const fur='#c58a5c',cream='#f4d9a8',lift=vy<0?.06:0
  r.line(P(-.1,.27,.16),P(-.43,.12,.2),fur,height*.15);r.line(P(-.43,.12,.2),P(-.67,.06,.23),fur,height*.09)
  oval(0,.39,0,.24,.31,.2,fur);oval(.01,.38,-.17,.16,.23,.06,cream)
  for(const side of [-1,1]){
    oval(side*.2,.18+lift,-.01,.14,.19,.15,fur,-side*.25)
    oval(side*.19,.04+lift,-.15,.12,.055,.25,'#b7774e')
    oval(side*.24,.49,-.1,.07,.18,.07,fur,side*(vy<0?.65:.25))
  }
  oval(0,.78,-.035,.25,.26,.21,fur)
  for(const side of [-1,1]){
    oval(side*.17,1.1,.01,.09,.28,.08,fur,side*.17+Math.sin(time*5)*.025)
    oval(side*.17,1.105,-.058,.045,.2,.018,'#eab69d',side*.17)
    const blink=time%4.7<.1?.15:1
    oval(side*.112,.81,-.23,.08,.112*blink,.035,'#fff8e4')
    oval(side*.112+lean*.07,.805,-.261,.04,.078*blink,.017,'#3d302e')
    if(blink>.5)oval(side*.112-.01,.84,-.278,.015,.023,.008,'#ffffff')
  }
  oval(0,.67,-.235,.17,.105,.08,cream);oval(0,.72,-.31,.055,.036,.025,'#634439')
  oval(0,.58,-.025,.26,.06,.22,'#5a9e9c')
  r.box(...P(-.2,.42,.18),height*.1,height*.35,height*.035,'#6dc5bd',{rz:Math.sin(time*6)*.15})
  r.box(...P(.19,.43,.16),height*.2,height*.28,height*.14,'#785341')
}

export function hoopModel(r,x,y,z,width=80,pulse=0,time=0) {
  r.cyl(x+78,0,z+58,5,y+19,'#506778');r.line([x+78,y+19,z+58],[x+40,y+38,z+29],'#506778',6)
  r.line([x+78,y-6,z+58],[x+40,y+18,z+29],'#506778',4)
  r.box(x,y+40,z+29,118,80,7,'#466987');r.box(x,y+40,z+24,108,70,3,'#aacbd4',{alpha:.55})
  for(const side of [-1,1]){r.box(x+side*55,y+40,z+20,3,76,3,'#e9e8ce');r.box(x,y+40+side*36,z+20,112,3,3,'#e9e8ce')}
  for(const side of [-1,1]){r.box(x+side*21,y+23,z+18,2,29,2,'#f2ba80');r.box(x,y+23+side*14,z+18,44,2,2,'#f2ba80')}
  const point=(a,row)=>[x+Math.cos(a)*(width/2-row*5)+Math.sin(time*20)*pulse*row*2,y-row*(12+pulse*3),z+Math.sin(a)*(14-row*2)]
  for(let i=0;i<24;i++){const a=i*TAU/24,b=(i+1)*TAU/24;r.line(point(a,0),point(b,0),'#e16e46',5)}
  for(let row=0;row<3;row++)for(let i=0;i<12;i++){
    const a=(i+(row%2)*.5)*TAU/12
    for(const side of [-1,1])r.line(point(a,row),point(a+side*Math.PI/12,row+1),'#eeeeda',1.15)
  }
}

// A seated angler and a plank-built skiff, sized for the lake's side-on view.
export function fishingBoatModel(r,x,y,z,time=0,reeling=false) {
  const bob=Math.sin(time*2)*1.3
  r.ellipsoid(x,y-5+bob,z,42,11,18,'#815336')
  r.box(x,y+1+bob,z,68,8,26,'#b98853')
  for(let i=-3;i<=3;i++)r.box(x+i*10,y+6+bob,z,8.5,2,25,'#d6a774')
  for(const side of [-1,1])r.line([x-35,y+8+bob,z+side*15],[x+35,y+8+bob,z+side*15],'#704c36',3)
  r.box(x-14,y+11+bob,z,24,5,29,'#90613d')
  const px=x-12,py=y+14+bob
  r.ellipsoid(px,py+14,z,9,13,6,'#6d8050');r.ellipsoid(px+2,py+4,z-2,10,4,7,'#35465a')
  for(const side of [-1,1]){
    r.line([px+side*5,py+5,z],[px+side*5+3,py-2,z-9],'#35465a',5)
    r.ellipsoid(px+side*5+4,py-3,z-11,4,3,5,'#514333')
    r.line([px+side*8,py+19,z],[px+11,py+12,z-5],'#d6a775',4)
  }
  animeHead(r.modelApi,px,py+34,z,19,Math.PI*.87,{hair:[.26,.11,.05],iris:[.35,.23,.09],time})
  r.ellipsoid(px,py+47,z,12,6,11,'#bd995a');r.ellipsoid(px+3,py+44,z-3,15,1.3,12,'#cda66b')
  r.box(px+5,py+46,z-11,3,3,1,'#e8cc7a')
  const tip=[x+36,py+53+Math.sin(time*8)*(reeling?2:.3),z-5]
  const joint=[x+17,py+32,z-5]
  r.line([px+11,py+12,z-5],joint,'#66513b',2.2);r.line(joint,tip,'#42494b',1.4)
  r.ellipsoid(px+11,py+11,z-7,3.5,3.5,1.5,'#d5ad64')
  r.ellipsoid(x+23,y+10+bob,z-3,7,8,7,'#6c95a5');r.ellipsoid(x+23,y+17+bob,z-3,7.2,1.2,7.2,'#bfdae0')
  return tip
}

export function lanternModel(r,x,y,z,size=12) {
  r.line([x,y+size,z],[x,y+size*1.6,z],'#e8b95a',size*.1)
  r.ellipsoid(x,y,z,size*.7,size,size*.7,'#ff8c35')
  for(const side of [-1,1])r.cyl(x,y+side*size*.82,z,size*.66,size*.12,'#6a3925')
  r.cyl(x,y-size,z,size*.12,size*1.9,'#ffdd70',{glow:1.7})
}

export function flowerPatch(r,x,y,z,size=5,seed=0) {
  for(let j=0;j<3;j++) {
    const xx=x+(j-1)*size*2.6,zz=z+Math.sin(seed+j)*size*2
    r.line([xx,y,zz],[xx,y+size*2.2,zz],'#368341',size*.25)
    for(let i=0;i<5;i++){const a=i*TAU/5;r.sphere(xx+Math.cos(a)*size*.7,y+size*2.2,zz+Math.sin(a)*size*.7,size*.48,j%2?'#fff3cc':'#ffcc51')}
    r.sphere(xx,y+size*2.4,zz,size*.38,'#a96b2a')
  }
}

export function slimeModel(r,x,y,z,size,color,time=0,o={}) {
  const speed=Math.min(1,Math.hypot(o.vx||0,o.vz||0)/180),phase=time*(3+speed*6)+(o.seed||0)
  const spring=Math.sin(phase)*(.025+speed*.045),squash=1+(o.bite||0)*.13
  const height=size*(.8+spring)/squash,leanX=(o.vx||0)*.025,leanZ=(o.vz||0)*.018
  r.ellipsoid(x,y+size*.13,z,size*.88,size*.17,size*.83,color,{surface:'gel'})
  r.ellipsoid(x+leanX,y+height,z+leanZ,size*squash,height,size*.92,color,{surface:'gel'})
  r.ellipsoid(x-size*.25+leanX,y+height*1.62,z-size*.65+leanZ,size*.2,size*.09,size*.025,'#e9fff0',{rz:-.4,alpha:.65})
  const eyeY=y+height*1.14,front=z-size*.83+leanZ,blink=(time+(o.seed||0)*.31)%4.3<.11?.13:1
  for(const side of [-1,1]) {
    r.ellipsoid(x+leanX+side*size*.29,eyeY,front,size*.185,size*.235*blink,size*.065,'#fff8ed')
    r.ellipsoid(x+leanX+side*size*.28,eyeY-size*.01,front-size*.06,size*.095,size*.15*blink,size*.034,'#243b44')
    if(blink>.5)r.sphere(x+leanX+side*size*.28-size*.025,eyeY+size*.047,front-size*.091,size*.035,'#ffffff')
    r.ellipsoid(x+leanX+side*size*.5,eyeY-size*.23,front+size*.06,size*.13,size*.062,size*.024,'#ed9d9b',{alpha:.7})
    if(o.danger)r.line([x+side*size*.15+leanX,eyeY+size*.23,front],[x+side*size*.42+leanX,eyeY+size*.3,front],'#34444d',size*.045)
  }
  const mouthY=eyeY-size*.25,mouthZ=front-size*.025
  if(o.bite>.1)r.ellipsoid(x+leanX,mouthY,mouthZ,size*.11,size*.11,size*.04,'#354151')
  else {r.line([x-size*.1+leanX,mouthY,mouthZ],[x+leanX,mouthY-size*.04,mouthZ],'#354151',size*.04);r.line([x+leanX,mouthY-size*.04,mouthZ],[x+size*.1+leanX,mouthY,mouthZ],'#354151',size*.04)}
  const top=y+height*1.94
  if(o.hero) {
    r.line([x+leanX,top-.04*size,z],[x+leanX+Math.sin(time*3)*size*.08,top+size*.26,z],'#427b4c',size*.06)
    for(const side of [-1,1])r.ellipsoid(x+leanX+side*size*.2,top+size*.28,z,size*.28,size*.095,size*.13,side<0?'#5eac63':'#a2d568',{rz:side*.35})
  } else if((o.seed||0)%3===0) {
    for(const side of [-1,1])r.ellipsoid(x+side*size*.58,top-size*.14,z+size*.08,size*.2,size*.38,size*.18,color,{rz:-side*.4,surface:'gel'})
  } else if((o.seed||0)%3===1) {
    for(let i=0;i<5;i++){const a=i*TAU/5;r.ellipsoid(x+Math.cos(a)*size*.17,top+size*.03,z+Math.sin(a)*size*.17,size*.16,size*.07,size*.13,'#ffe9c1')}
    r.sphere(x,top+size*.06,z,size*.095,'#efbf57')
  }
}

export function mushroomPatch(r,x,y,z,size=8,seed=0) {
  for(let i=0;i<2;i++) {
    const s=size*(i?.65:1),xx=x+i*size,zz=z+i*size*.55
    r.cyl(xx,y,zz,s*.24,s*.95,'#f4dfbb')
    r.ellipsoid(xx,y+s*.95,zz,s,s*.43,s*.82,seed%2?'#db827d':'#dfae61')
    for(let j=0;j<3;j++){const a=j*2.1+seed;r.ellipsoid(xx+Math.cos(a)*s*.46,y+s*1.27,zz+Math.sin(a)*s*.38,s*.14,s*.035,s*.11,'#fff0d1')}
  }
}

export function robotModel(r,x,y,z,size=1,time=0) {
  r.ellipsoid(x,y+size*12,z,size*8,size*8,size*5,'#ddeafa')
  r.box(x,y+size*13,z-size*4.6,size*12,size*8,size*2,'#182441')
  for(const side of [-1,1])r.ellipsoid(x+side*size*3,y+size*13,z-size*5.8,size*.9,size*1.6,size*.35,'#41e8ff',{glow:1.8})
  r.line([x-size*2,y+size*10,z-size*5.8],[x+size*2,y+size*10,z-size*5.8],'#b0fbff',size*.5)
  r.ellipsoid(x,y+size*2,z,size*5,size*5,size*4,'#5186ea')
  for(const side of [-1,1])r.ellipsoid(x+side*size*7,y+size*(4+Math.sin(time*2)*.3),z,size*2,size*4,size*2,'#daeaff')
  for(let i=-1;i<=1;i++)r.pyramid(x+i*size*3,y+size*19,z,size*2.8,size*5,size*2.8,'#ffd05a')
}
