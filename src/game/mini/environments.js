import { flowerPatch, mushroomPatch, cloudModel, lanternModel } from './models.js'

// Scenery has no collision or scoring role. Keep tall silhouettes outside the arena.
export function gardenArena(r,cx,cz,time=0,size=1400) {
  const visible=(x,z,pad=0)=>Math.abs(x-cx)<560+pad&&Math.abs(z-cz)<670+pad
  r.floor(-350,-350,size+350,size+350,-4,'#a9c990')
  r.box(size/2,-3,size/2,size+36,7,size+36,'#91b974')
  r.floor(0,0,size,size,0,'#9cbd73')
  // Soft meadow islands and a worn garden path make camera movement easy to read.
  r.box(size/2,.15,size/2,104,.3,size,'#cbbd87',{edge:false})
  r.box(size/2,.2,size/2,size,.3,94,'#cbbd87',{edge:false})
  for(let i=0;i<64;i++) {
    const x=65+(i%8)*181+Math.sin(i*4.2)*24,z=60+Math.floor(i/8)*184+Math.cos(i*1.8)*25
    if(!visible(x,z))continue
    if(Math.abs(x-size/2)>95&&Math.abs(z-size/2)>95) {
      r.ellipsoid(x,.35,z,39+(i%3)*12,.6,29+(i%4)*10,i%2?'#a9c780':'#8db16b')
      if(i%4===0)flowerPatch(r,x+17,1,z,3.4,i)
      if(i%7===0)mushroomPatch(r,x-24,0,z+15,6,i)
      for(let j=0;j<3;j++)r.ellipsoid(x-26+j*6,2.7,z+24,1,4+j,1.5,'#739c59',{rz:(j-1)*.25})
    }
  }
  for(let i=0;i<15;i++) {
    const p=30+i*96
    for(const [x,z,side] of [[p,-46,0],[-46,p,1],[p,size+46,2],[size+46,p,3]]) {
      if(!visible(x,z,150))continue
      r.box(x,9,z,side%2?18:92,18,side%2?92:18,'#bfba95')
      r.ellipsoid(x,15,z,side%2?22:49,12,side%2?49:22,'#5f9365')
      if(i%3===1) {
        const tx=x+(side===1?-55:side===3?55:0),tz=z+(side===0?-55:side===2?55:0)
        r.tree(tx,0,tz,105+(i%4)*15,i+side*7,'oak',i%2?'#679959':'#86aa65')
      }
    }
  }
  // Flat stepping stones and pollen stay below the creatures' faces.
  for(let i=0;i<19;i++) {
    const x=size/2+Math.sin(i*1.7)*15,z=30+i*74
    if(visible(x,z))r.ellipsoid(x,.65,z,21,1,14,'#ddd2b0',{ry:i})
  }
  for(let i=0;i<14;i++) {
    const x=(i*197+47)%size,z=(i*263+51)%size
    if(visible(x,z))r.sphere(x+Math.sin(time*.8+i)*9,12+Math.sin(time+i)*5,z,1.6,'#fff2ad',{alpha:.6,glow:1.5})
  }
}

const wrap=(v,size)=>((v%size)+size)%size
export function skyMeadow(r,time=0,ground=50) {
  r.begin('#62c9ed','#d9f3d1')
  for(let i=0;i<6;i++)cloudModel(r,wrap(i*145-time*12,820)-410,380+(i%3)*60,170,23+(i%3)*9)
  for(let i=0;i<7;i++){
    const x=wrap(i*125-time*19,870)-435
    r.ellipsoid(x,ground+20,155,105,65+(i%3)*24,70,i%2?'#85bea0':'#a4cfa5')
  }
  r.box(0,(ground-60)/2,0,1200,ground+60,250,'#cda86e')
  r.box(0,ground-1,0,1200,5,250,'#82b653')
  for(let i=0;i<12;i++) {
    const x=wrap(i*61-time*125,730)-365
    r.ellipsoid(x,ground+1,38,22,3,18,i%2?'#a1cc6a':'#76ac4e')
    if(i%3===0)flowerPatch(r,x,ground+2,46,3,i)
  }
}

export function lakeScenery(r,time=0,surface=380) {
  r.begin('#87cddd','#daf1e6')
  r.sphere(114,507,155,24,'#ffe3a0',{unlit:true})
  for(let i=0;i<6;i++) {
    const x=-280+i*109,h=88+(i%3)*29
    r.pyramid(x,surface+25,145,190,h,55,i%2?'#83aeb8':'#91bbc1')
    r.pyramid(x,surface+25+h*.7,145,190*.3,h*.3,55*.3,'#e8eeec')
  }
  for(let i=0;i<9;i++)r.tree(-235+i*59,surface+13,90,46+(i%3)*18,i,'pine',i%2?'#598d7a':'#397863')
  r.box(0,surface+4,85,520,20,42,'#70977b')
  // A timber cabin and pier anchor the far shore.
  r.box(132,surface+24,60,47,36,30,'#a57852');r.pyramid(132,surface+42,60,62,23,44,'#53666c')
  for(const x of [121,141])r.box(x,surface+26,43,8,10,2,'#f4d28a',{glow:1.4})
  r.box(132,surface+5,30,78,5,34,'#af8b61')
  for(const x of [100,160])r.cyl(x,surface-8,22,2,18,'#796849')
  r.gradient(0,surface/2,70,560,surface,'#299ca9','#173d60')
  for(let i=0;i<4;i++)r.box(-140+i*91+Math.sin(time*.4+i)*8,surface*.63,52,10,surface*.74,1,'#8ccfc7',{alpha:.1,rz:-.16,edge:false,unlit:true})
  for(let i=0;i<12;i++) {
    const x=-190+i*35
    r.ellipsoid(x,8,10,23,8+(i%3)*3,12,i%2?'#849d87':'#a8b191')
    for(let j=0;j<2;j++) {
      const p=[x+j*9,6,4],mid=[x+j*9+Math.sin(time+i)*4,27+j*8,4],tip=[x+j*9+Math.sin(time+i+.7)*8,46+j*10,4]
      r.line(p,mid,'#5aab90',3);r.line(mid,tip,'#6fbf96',2)
    }
  }
  for(let i=0;i<18;i++){
    const x=(i*47)%380-190,y=18+wrap(time*14+i*37,surface-28)
    r.sphere(x+Math.sin(time+i)*3,y,12,1.4+(i%3)*.5,'#b1e3dc',{alpha:.3})
  }
  for(let i=0;i<11;i++)r.ellipsoid(-190+i*38,surface+Math.sin(time*2+i)*1.2,-3,22,1.1,3,'#c1eee3',{alpha:.7})
}

export function neonCity(r,distance=0,time=0,echo=false) {
  r.begin(echo?'#122942':'#1b183e',echo?'#244452':'#434063')
  r.sphere(107,456,260,31,echo?'#a8ebe8':'#d3cce1',{unlit:true})
  for(let layer=0;layer<2;layer++)for(let i=0;i<9;i++) {
    const x=wrap(i*91-distance*(layer?.19:.07),810)-405,h=110+(i*47+layer*23)%177,base=120
    const z=layer?115:225,w=layer?53:76,color=layer?(i%2?'#293451':'#333357'):'#42456a'
    r.box(x,base+h/2,z,w,h,45,color,{edge:false})
    r.box(x,base+h+5,z,w*.72,10,34,'#394767')
    if(layer) {
      const neon=echo?'#7ae6d7':i%2?'#f47cc9':'#62cfed'
      r.box(x-w/2+2,base+h*.48,z-24,2,h*.85,2,neon,{glow:1.6,edge:false})
      for(let row=0;row<6;row++)for(let col=0;col<3;col++)if((row+col+i)%4!==0&&20+row*32<h-14)r.box(x+(col-1)*14,base+20+row*32,z-24,5,9,1,(i+row)%3?'#88b9d0':'#edbd90',{glow:1.4,edge:false})
      if(i%3===0){r.box(x+18,base+h-24,z-30,20,52,5,'#263154');r.text(x+18,base+h-24,z-34,echo?'↶':'光',15,neon)}
    }
  }
  // A suspended rail and a moving train sit behind the playable rooftop.
  r.box(0,162,52,1000,7,17,'#536786')
  const train=wrap(distance*.38+time*18,800)-400
  for(let i=0;i<3;i++){
    const x=train+i*76
    r.box(x,181,58,71,29,23,'#768ba9');r.box(x,193,58,67,3,25,'#a9c6d1')
    for(let j=-1;j<=1;j++)r.box(x+j*19,184,45,13,11,1,'#b6e9ed',{glow:1.4})
    r.box(x,170,45,68,2,1,echo?'#82e8ce':'#ed9acf',{glow:1.5})
  }
  r.box(0,20,0,1000,200,130,'#28344d');r.box(0,119,-66,1000,3,3,echo?'#73e4d0':'#c887e1',{glow:1.7})
  r.box(0,96,-66,1000,5,4,'#40546d')
  for(let i=0;i<6;i++){
    const x=wrap(i*135-distance,810)-405
    r.box(x,51,-68,74,48,4,'#17253c');r.box(x,51,-71,66,40,3,'#53647b')
    for(let j=0;j<5;j++)r.box(x,35+j*8,-74,59,3,2,'#26364d')
    r.line([x+52,-15,-71],[x+52,93,-71],'#5a7185',3)
  }
  for(let i=0;i<17;i++){const x=wrap(i*45-distance,765)-382;r.box(x,120.3,0,1.5,.8,128,'#526380',{edge:false})}
}

export function crystalMine(r,time=0) {
  r.begin('#203850','#4d5360')
  r.gradient(0,365,170,530,390,'#21384d','#526e79')
  for(let i=0;i<11;i++){
    const x=-250+i*49,y=375+(i%3)*43
    r.gem(x,y,135,90+(i%3)*28,i%2?'#45576b':'#34485d',{ry:i*.7})
    if(i%3===1)r.gem(x,y-25,95,27,'#78c9d5',{ry:i,glow:1.5})
  }
  r.box(0,243,15,600,30,210,'#697075')
  for(let i=0;i<12;i++)r.box(-230+i*43,261,50,29,4,35,'#846d59')
  for(const z of [32,66])r.line([-300,265,z],[300,265,z],'#b5bec1',3)
  for(const side of [-1,1]){
    r.box(side*157,361,78,17,214,22,'#78543d');r.box(side*157,289,65,23,12,28,'#a89069')
    for(const y of [319,411,454])r.sphere(side*157,y,64,2.1,'#c4bda3')
    lanternModel(r,side*134,420,46,12)
  }
  r.box(0,464,77,334,22,25,'#98704e');r.box(0,477,77,359,9,33,'#5a483c')
  for(let i=0;i<10;i++){
    const x=-177+i*39,y=375+Math.sin(time*.6+i)*35
    r.sphere(x,y,40,1.2,'#f4d791',{alpha:.4})
  }
}

export function floatingGardens(r,cameraY=0,time=0) {
  r.begin('#8bcad8','#f1e7c8')
  const base=540-cameraY
  for(let i=0;i<7;i++){
    const yy=base+70-wrap(i*141+cameraY*.3,820)
    cloudModel(r,-235+(i*117)%520+Math.sin(time*.2+i)*9,yy,185,26+(i%3)*12)
  }
  for(let i=0;i<5;i++){
    const x=-255+(i*173)%530,y=base-wrap(i*207+cameraY*.18,920)
    r.ellipsoid(x,y-16,240,46,24,30,'#a1b7b5')
    for(let j=0;j<3;j++)r.ellipsoid(x+(j-1)*23,y-28-(j%2)*13,237,16,17+(j%2)*9,18,'#93abae')
    r.ellipsoid(x,y,240,63,10,40,i%2?'#c0d1c5':'#cbd6c2')
    for(const side of [-1,1]){r.line([x+side*36,y-4,219],[x+side*37,y-38,218],'#94b7a5',2);r.ellipsoid(x+side*39,y-25,217,5,3,2,'#a9c7b3')}
    r.tree(x+10,y+8,240,46,i,'oak','#b1cbb4')
  }
}

export function gardenPlatform(r,x,y,z,width,kind='norm',time=0) {
  if(kind==='break'){
    for(let i=0;i<4;i++)r.box(x+(i-1.5)*width/4,y-7,z,width/4-2,12,28,i%2?'#af825d':'#c79969')
    for(const side of [-1,1])r.line([x+side*width*.3,y-15,z-13],[x+side*width*.3,y+1,z-13],'#e1c58f',2)
    r.line([x-4,y+.4,z-10],[x+2,y+.4,z],'#634c40',1.4);r.line([x+2,y+.4,z],[x-3,y+.4,z+10],'#634c40',1.4)
    return
  }
  const moving=kind==='move'
  r.box(x,y-6,z,width,12,30,moving?'#6a9ca5':'#92765c')
  r.ellipsoid(x,y-15,z,width*.38,10,12,moving?'#547c94':'#7d7564')
  r.box(x,y-1,z,width+1,3,31,moving?'#9ae2d9':'#6b9e4d')
  if(moving){
    for(const side of [-1,1])r.line([x+side*width*.31,y+1,z-12],[x+side*width*.4,y+1,z-7],'#e1fff0',2)
    r.sphere(x,y-21,z,3+Math.sin(time*4)*.6,'#b4f4e0',{glow:1.6})
  }else{
    for(let i=0;i<2;i++)r.ellipsoid(x-width*.35+i*width*.7,y+1,z+6,7,2,6,'#a5cd64')
    r.line([x-width*.29,y-7,z+13],[x-width*.3+Math.sin(time)*2,y-26,z+13],'#6b9967',1.5)
    r.ellipsoid(x-width*.3-3,y-20,z+13,4,2,1.3,'#89b47a',{rz:.4})
  }
}

export function sunsetCourt(r,time=0) {
  r.begin('#6c8cbc','#e7b7a1')
  r.sphere(-128,463,390,28,'#f5d49b',{unlit:true})
  for(let i=0;i<9;i++){
    const x=-360+i*89,h=125+(i*43)%147
    r.box(x,100+h/2,350,65,h,50,i%2?'#737f9f':'#8b92ad')
    for(let row=0;row<5;row++)if(row*29+30<h)for(const side of [-1,1])r.box(x+side*16,130+row*29,323,7,12,1,'#d6bbb1')
  }
  r.floor(-900,-300,900,2600,0,'#77939c')
  r.floor(-138,-30,138,1300,1,'#b2807a')
  for(const side of [-1,1])r.line([side*138,2,-30],[side*138,2,1300],'#eee0c8',2)
  r.line([-138,2,720],[138,2,720],'#eee0c8',2)
  for(let i=0;i<48;i++){const a=i*Math.PI/24,b=a+Math.PI/24;r.line([Math.cos(a)*85,2,720+Math.sin(a)*120],[Math.cos(b)*85,2,720+Math.sin(b)*120],'#eee0c8',2)}
  for(let i=-5;i<=5;i++)r.cyl(i*70,0,170,2.5,220,'#4b647b')
  for(let j=0;j<=8;j++)r.line([-410,j*26,170],[410,j*26,170],'#647c8c',1)
  for(let i=-15;i<=15;i++)r.line([i*28,0,170],[i*28,220,170],'#647c8c',.8)
  for(const side of [-1,1]){
    r.cyl(side*174,0,95,4,368,'#4d6176');r.box(side*174,366,95,64,17,12,'#e6dbb9')
    for(let i=-2;i<=2;i++)r.sphere(side*174+i*11,367,87,4.5,'#fff4bf',{unlit:true})
    r.box(side*158,24,28,63,7,24,'#aa8770');for(const dx of [-23,23])r.box(side*158+dx,10,28,4,24,19,'#536578')
  }
}

export function sumoPavilion(r,time=0) {
  r.floor(-700,-650,700,750,-18,'#b8aaa0')
  for(const side of [-1,1])for(let row=0;row<3;row++){
    const x=side*(227+row*34)
    r.box(x,row*23,50,37,18,350,'#927764')
    for(let i=0;i<7;i++){
      const z=-78+i*48,base=row*23+10
      r.ellipsoid(x,base+15,z,10,16,9,i%3===0?'#789eab':i%3===1?'#d99882':'#ac9cbb')
      r.sphere(x,base+36,z,9,'#e8b993');r.ellipsoid(x,base+42,z+1,10,5,9,'#51434a')
      const cheer=Math.sin(time*3+i+row)*5
      r.line([x-side*8,base+22,z],[x-side*19,base+30+cheer,z],'#e8b993',5)
    }
  }
  for(const side of [-1,1]){
    r.cyl(side*196,-16,218,11,188,'#9c6157');r.box(side*196,156,218,30,11,40,'#80504c')
    r.box(side*147,101,192,51,93,4,side<0?'#bc5b55':'#507ca6')
    for(let i=-1;i<=1;i++)r.pyramid(side*147+i*9,108,187,14,22,3,'#efd593')
    r.box(side*147,104,187,35,5,3,'#efd593');lanternModel(r,side*207,140,144,16)
    r.tree(side*286,-16,242,170,side,'oak','#cfaca7')
  }
  r.box(0,174,235,467,18,96,'#655675');r.box(0,186,235,425,10,102,'#84738d')
  r.box(0,156,211,405,10,22,'#d9b38b')
  for(let i=-2;i<=2;i++){r.box(i*67,68,244,60,150,8,'#e0cdb0');for(let j=0;j<4;j++)r.box(i*67,21+j*33,238,60,2,2,'#b7a082')}
}
