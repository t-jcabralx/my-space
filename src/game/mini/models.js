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
    oval(x,y,z,size*(kind===3?1.12:1),size*(kind===5?.94:1),size*.84,c)
    if(kind===7) for(let i=-2;i<=2;i++) {
      const dx=i*size*.28, front=z-Math.sqrt(Math.max(0,size*size-dx*dx))*.84
      line([x+dx,y-size*.72,z-size*.55],[x+dx,y+size*.72,front], '#276747',size*.065)
    }
    if(kind===5) line([x,y-size*.65,z-size*.8],[x,y+size*.58,z-size*.8],'#e67876',size*.04)
  }
  line([x,y+size*.82,z],[x+size*.1,y+size*1.13,z],'#765a3c',Math.max(1.3,size*.12))
  oval(x+size*.3,y+size*1.08,z,size*.3,size*.11,size*.14,'#478b55',{rz:.4})
  // Small expressive faces sit on the actual fruit surface.
  for(const side of [-1,1]) {sphere(x+side*size*.25,y+size*.05,z-size*.81,size*.09,'#283248',{shine:false});sphere(x+side*size*.25-size*.022,y+size*.08,z-size*.89,size*.026,'#ffffff')}
  line([x-size*.09,y-size*.18,z-size*.84],[x+size*.09,y-size*.18,z-size*.84],'#7c3a43',Math.max(1,size*.045))
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
    r.box(x+dir*size*.25,y-size*.69,z,size*1.55,size*.13,size*.84,'#282c3b'); return
  }
  const colors=['#75cfe4','#f6a444','#f4d778','#aa83d8'], c=colors[kind]||colors[0]
  r.ellipsoid(x,y,z,size*(kind===2?.92:1.08),size*(kind===2?.82:.58),size*.45,c)
  if(kind===3) {
    for(let i=0;i<5;i++) {const xx=x+(i-2)*size*.3; r.line([xx,y-size*.4,z],[xx+Math.sin(time*5+i)*size*.2,y-size*1.25,z],c,size*.14)}
  } else {
    r.pyramid(x-dir*size*1.22,y-size*.48,z,size*.7,size*.95,size*.22,c,{rz:dir*.3})
    r.pyramid(x,y+size*.38,z,size*.65,size*.4,size*.16,c)
    if(kind===1) for(const offset of [-.35,.25])r.ellipsoid(x+offset*size,y,z-size*.43,size*.12,size*.48,size*.035,'#fff2d2')
    if(kind===2) for(let i=0;i<8;i++){const a=i*TAU/8;r.pyramid(x+Math.cos(a)*size*.85,y+Math.sin(a)*size*.75,z,size*.16,size*.23,size*.16,'#d4aa48',{rz:a-Math.PI/2})}
  }
  r.sphere(x+dir*size*.5,y+size*.14,z-size*.43,size*.2,'#fff7df')
  r.sphere(x+dir*size*.56,y+size*.14,z-size*.6,size*.1,'#24324a')
}

export function wrestlerModel(r,x,y,z,size,color,yaw=0,time=0,moving=false,hero=false) {
  const skin='#e9b28e', step=moving?Math.sin(time*9):0, ca=Math.cos(yaw),sa=Math.sin(yaw)
  const point=(a,b,c)=>[x+(a*ca+c*sa)*size,y+b*size,z+(-a*sa+c*ca)*size]
  const oval=(a,b,c,w,h,d,col)=>r.ellipsoid(...point(a,b,c),w*size,h*size,d*size,col,{ry:yaw})
  for(const side of [-1,1]) {
    const dz=step*side*.06
    oval(side*.15,.09,dz,.12,.13,.12,skin);oval(side*.16,.045,.055+dz,.13,.055,.18,'#d99e7e')
    r.line(point(side*.24,.61,0),point(side*.37,.43,.09),skin,size*.15)
    r.line(point(side*.37,.43,.09),point(side*.28,.48,.26),skin,size*.13)
    oval(side*.28,.48,.27,.095,.085,.09,skin)
  }
  oval(0,.43,0,.3,.29,.25,skin);oval(0,.245,0,.29,.095,.245,color)
  r.box(...point(0,.18,.23),size*.14,size*.2,size*.055,color,{ry:yaw})
  animeHead(r.modelApi,...point(0,.82,0),size*.32,yaw,{skin:[.92,.7,.56],hair:hero?[.29,.105,.035]:[.065,.075,.11],style:hero?'spiky':'bun',iris:[.36,.19,.06],fierce:true})
  if(!hero)oval(0,1.01,-.035,.08,.07,.08,'#292838')
  else {
    r.box(...point(0,.89,.14),size*.29,size*.045,size*.035,'#fff1cb',{ry:yaw})
    for(let i=-1;i<=1;i++)r.pyramid(...point(i*.045,.27,.25),size*.045,size*.07,size*.025,'#ffdc57',{ry:yaw})
    r.box(...point(0,.235,.257),size*.14,size*.025,size*.025,'#ffdc57',{ry:yaw})
  }
}

export function basketballModel(r,x,y,z,size) {
  r.sphere(x,y,z,size,'#ee873e')
  for(let i=0;i<18;i++) {
    const a=i*TAU/18,b=(i+1)*TAU/18
    r.line([x+Math.cos(a)*size,y+Math.sin(a)*size,z-.4],[x+Math.cos(b)*size,y+Math.sin(b)*size,z-.4],'#643d30',size*.035)
  }
  for(let i=0;i<16;i++) {
    const a=-Math.PI/2+i*Math.PI/16,b=a+Math.PI/16
    r.line([x+Math.sin(a)*size,y,z-Math.cos(a)*size*1.005],[x+Math.sin(b)*size,y,z-Math.cos(b)*size*1.005],'#643d30',size*.028)
    r.line([x,y+Math.sin(a)*size,z-Math.cos(a)*size*1.005],[x,y+Math.sin(b)*size,z-Math.cos(b)*size*1.005],'#643d30',size*.028)
  }
}


// Recognizable details from the supplied covers, built as geometry rather than decals.
export function chickModel(r,x,y,z,size,time=0) {
  r.ellipsoid(x,y,z,size,size*.92,size*.78,'#ffcf26')
  r.ellipsoid(x+size*.19,y-size*.25,z-size*.63,size*.67,size*.56,size*.23,'#ffe988')
  const flap=Math.sin(time*22)*.5
  for(const side of [-1,1])r.ellipsoid(x-size*.35,y+flap*size*.35,z+side*size*.73,size*.67,size*.22,size*.25,'#ffae20',{rz:flap})
  for(let i=0;i<3;i++)r.ellipsoid(x-size*.38+i*size*.2,y+size*(.86+i*.055),z,size*.14,size*.4,size*.11,'#ffe268',{rz:.4+i*.2})
  r.ellipsoid(x+size*.68,y+size*.24,z-size*.59,size*.32,size*.38,size*.18,'#fffaf0')
  r.ellipsoid(x+size*.79,y+size*.22,z-size*.73,size*.16,size*.25,size*.09,'#422b24')
  r.sphere(x+size*.82,y+size*.34,z-size*.81,size*.064,'#ffffff')
  r.ellipsoid(x+size*.96,y-size*.1,z-size*.22,size*.36,size*.14,size*.25,'#ff8628')
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

export function robotModel(r,x,y,z,size=1,time=0) {
  r.ellipsoid(x,y+size*12,z,size*8,size*8,size*5,'#ddeafa')
  r.box(x,y+size*13,z-size*4.6,size*12,size*8,size*2,'#182441')
  for(const side of [-1,1])r.ellipsoid(x+side*size*3,y+size*13,z-size*5.8,size*.9,size*1.6,size*.35,'#41e8ff',{glow:1.8})
  r.line([x-size*2,y+size*10,z-size*5.8],[x+size*2,y+size*10,z-size*5.8],'#b0fbff',size*.5)
  r.ellipsoid(x,y+size*2,z,size*5,size*5,size*4,'#5186ea')
  for(const side of [-1,1])r.ellipsoid(x+side*size*7,y+size*(4+Math.sin(time*2)*.3),z,size*2,size*4,size*2,'#daeaff')
  for(let i=-1;i<=1;i++)r.pyramid(x+i*size*3,y+size*19,z,size*2.8,size*5,size*2.8,'#ffd05a')
}
