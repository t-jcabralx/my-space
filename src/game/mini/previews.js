import { fruitModel, fishModel, moleModel, wrestlerModel, basketballModel } from './models.js'
const colors=['#67cbe0','#ef8099','#a391df','#f1c677','#82ba95']
export function drawMiniPreview(r,id,t=0) {
  r.look(0,52,-115,0,12,0,46);r.begin('#a8cdda','#e0e7cf')
  const floor=(color='#afc6a2')=>r.floor(-220,-160,220,220,0,color)
  const tree=(x,z,scale=1)=>r.tree(x,0,z,40*scale,x+z,'oak','#77a987')
  if(['mole','archery','hop','wing','blob'].includes(id)){floor();tree(-64,34);tree(65,40,.8);tree(26,70,1.4)}
  if(id==='mole') {
    for(const [x,z] of [[-36,6],[0,-10],[37,9]]){r.cyl(x,0,z,19,3,'#9f815c');r.cyl(x,3,z,14,1,'#382f39');moleModel(r,x,13+Math.sin(t*3+x)*2,z-1,13,x===37,t)}
  } else if(id==='miner') {
    r.begin('#2e3c59','#65748b');floor('#687386')
    for(const x of [-50,50]){r.box(x,28,30,9,56,10,'#b39379');r.box(0,56,30,110,9,10,'#b39379')}
    r.gem(-10,20,0,46,'#858d9f');r.gem(12,17,-10,30,'#a2abbd')
    for(let i=0;i<5;i++)r.gem(-23+i*11,18+(i%2)*11,-23,9,colors[i])
    r.person(43,0,-15,'#e9b46e',t*3,2.2,{hair:'#3c354c'});r.line([37,21,-15],[21,34,-15],'#ddb989',2)
  } else if(id==='traffic') {
    r.look(30,75,-108,0,0,10,47);floor('#a9c5b0');r.box(0,-1,20,92,3,330,'#647187')
    for(let z=-90;z<150;z+=30)for(const x of [-15,15])r.box(x,1,z,1.7,1,14,'#efdfb0')
    r.car(-27,1,30,'#dd857f',4,t*4);r.car(3,1,-18,'#71cbd4',4.7,t*4);r.car(29,1,69,'#e8c77e',4,t*4);tree(-70,40);tree(70,-5)
  } else if(id==='blob') {
    for(let i=0;i<18;i++)r.sphere((i*29)%130-65,2,(i*17)%65-20,1.8,colors[i%5])
    for(const [x,z,s,c] of [[-35,5,13,'#eaad84'],[0,-12,20,'#a58bda'],[40,15,11,'#7bbec0']]) {r.ellipsoid(x,s*.75,z,s,s*.8,s,c);for(const side of [-1,1]){r.sphere(x+side*s*.28,s,z-s*.78,s*.18,'#fff');r.sphere(x+side*s*.28,s,z-s*.94,s*.08,'#303a50')}}
  } else if(['blocks','gems','memory','simon','ttt'].includes(id)) {
    r.begin('#a4b3d6','#ded9ee');floor('#bfc9df');r.box(0,2,0,106,5,72,'#667caa')
    if(id==='blocks'||id==='gems')for(let z=-2;z<=2;z++)for(let x=-3;x<=3;x++){if(id==='blocks'&&(x+z+9)%5===0)continue;const c=colors[((x+z+9)%5)];if(id==='gems')r.gem(x*13,10,z*13,12,c);else r.box(x*13,7,z*13,11,8,11,c)}
    if(id==='simon')for(let i=0;i<4;i++)r.box((i%2-.5)*46,8+Math.max(0,Math.sin(t*3+i))*2,(Math.floor(i/2)-.5)*30,40,10,24,colors[i])
    if(id==='memory')for(let i=0;i<8;i++){const x=(i%4-1.5)*24,z=(Math.floor(i/4)-.5)*30;r.box(x,8,z,20,5,26,i%3===0?'#f2e9d3':'#789bce');if(i%3===0)r.gem(x,13,z,8,colors[i%5])}
    if(id==='ttt'){for(const a of [-15,15]){r.box(a,6,0,2,2,66,'#e7edf9');r.box(0,6,a,96,2,2,'#e7edf9')}for(const x of [-31,31]){r.box(x,10,-24,5,7,21,'#e58094',{ry:.78});r.box(x,10,-24,5,7,21,'#e58094',{ry:-.78})}r.cyl(0,7,0,9,4,'#efc66f');r.cyl(0,11,0,5,1,'#667caa')}
  } else if(id==='fishing') {
    r.begin('#92cddb','#d8efe3');floor('#629ead');r.box(-35,5,12,40,8,65,'#c59871')
    r.person(-35,9,-6,'#f1c16f',0,2.1,{hair:'#51415a'});r.line([-28,26,-8],[-6,43,-8],'#726080',1.4);r.line([-6,43,-8],[5,1,-8],'#f3f0db',.5)
    fishModel(r,28,10,-25,12,1,1,t);fishModel(r,46,7,11,9,0,-1,t)
  } else if(id==='hoops') {
    floor('#d3a678');r.box(0,42,28,70,44,4,'#dae4e6');r.box(0,39,24,25,17,2,'#dd8e69');r.cyl(0,0,34,3,43,'#5a6c80')
    for(let i=0;i<20;i++){const a=i*Math.PI/10;r.sphere(Math.cos(a)*16,25,10+Math.sin(a)*10,1.2,'#dc7954');if(i%2===0)r.line([Math.cos(a)*16,25,10+Math.sin(a)*10],[Math.cos(a)*10,9,10+Math.sin(a)*6],'#f2efe1',.6)}
    basketballModel(r,-24+Math.sin(t)*5,13+Math.abs(Math.sin(t*2))*18,-22,12)
  } else if(id==='sumo') {
    floor('#b3a7a3');r.cyl(0,0,0,52,6,'#a88b72');r.cyl(0,6,0,49,2,'#e6cba6')
    wrestlerModel(r,-19,8,-5,33,'#66b3c5',1.2,t,true);wrestlerModel(r,21,8,7,35,'#d97789',-1.9,t,true)
  } else if(id==='knife'||id==='archery') {
    floor('#bec69d');r.look(0,30,-120,0,25,0,45)
    r.line([0,0,12],[0,38,12],'#9b795f',5)
    const rings=id==='knife'?[[27,'#9b795f'],[23,'#d8b282'],[15,'#b98f68'],[7,'#d8b282']]:[[28,'#f3eddb'],[23,'#546980'],[17,'#8fc6d6'],[11,'#df8b89'],[5,'#f3d68b']]
    rings.forEach(([s,c],i)=>r.disc(0,34,-i*2,s,2,c))
    r.line([-56,12,-18],[-8,31,-18],'#6f6075',2);r.pyramid(-8,28,-18,6,9,3,'#d5e5e5',{rz:-1.1})
  } else if(id==='fruit'||id==='slice') {
    r.begin('#e2b9b6','#f3dfba');floor('#d9b898')
    if(id==='fruit'){r.box(0,0,14,108,6,68,'#a88573');for(const x of [-55,55])r.box(x,17,14,5,40,68,'#bfa694')}
    for(const [x,z,k,size] of [[-31,-12,1,15],[4,-11,5,21],[32,9,4,18],[-19,27,7,23]])fruitModel(r,x,size+(id==='slice'?Math.abs(Math.sin(t+x))*14:2),z,size,k,t)
  } else if(id==='hop'||id==='runner'||id==='rift') {
    if(id!=='hop'){r.begin(id==='rift'?'#292654':'#627fa1','#b0c9d1');floor('#697ba0');for(let i=0;i<7;i++)r.box(-90+i*30,20+(i%3)*11,60,18,40+(i%3)*22,18,colors[(i+2)%5])}
    for(let i=0;i<4;i++)r.box(-48+i*30,2+i*(id==='hop'?9:0),0,23,5,25,colors[i])
    r.person(-5,8+Math.abs(Math.sin(t*3))*13,-8,id==='rift'?'#6bd4db':'#9c80d2',t*8,3.8,{hair:'#343b61',coat:true})
    if(id==='rift')for(let i=0;i<3;i++)r.box(-42-i*8,22,2,3,29,10,'#97e8dc',{alpha:.3})
  } else if(id==='pong') {
    r.begin('#8caeb4','#c9e4d2');floor('#a4b8b4');r.box(0,6,0,95,10,110,'#77a692');r.box(0,12,0,94,1,2,'#eaf5d8')
    r.box(-12,16,-42,29,5,5,'#80d4e0');r.box(19,16,42,29,5,5,'#e78f9d');r.sphere(Math.sin(t*2)*27,18,Math.cos(t*2)*30,4,'#fff5df')
  } else if(id==='tess') {
    r.look(0,0,-140,0,0,0,48);r.begin('#252749','#656189')
    for(const scale of [20,37])for(let i=0;i<8;i++){const p=[i&1?scale:-scale,i&2?scale:-scale,i&4?scale:-scale];for(let k=0;k<3;k++){const j=i^(1<<k);if(j>i){const q=[j&1?scale:-scale,j&2?scale:-scale,j&4?scale:-scale];r.line(p,q,scale===20?'#e6b9e2':'#9ddadf',1)}}r.sphere(...p,2.7,i===3?'#ffe7a0':'#c8dfe9')}
  } else if(id==='stack') {
    floor('#98b7bb');for(let i=0;i<6;i++)r.box(Math.sin(i)*2,i*9+4,0,58-i*4,8,47-i*3,colors[i%5]);r.box(Math.sin(t*2)*28,63,0,38,8,32,'#e9bbc7')
  } else if(id==='wing') {
    for(const [x,h] of [[-40,22],[40,30]])r.cyl(x,0,15,12,h,'#70ac91')
    const y=32+Math.sin(t*4)*5;r.sphere(0,y,-15,12,'#f5cc75');r.ellipsoid(-5,y-3,-24,8,3,8,'#dfa36c',{rz:Math.sin(t*6)*.3});r.sphere(6,y+3,-24,4,'#fff');r.sphere(7,y+3,-28,2,'#44516d');r.pyramid(12,y-3,-17,5,8,6,'#d98468',{rz:-1.57})
  } else if(id==='bubble') {
    r.begin('#8193c8','#c9d3ed');floor('#a7b9d6');for(let j=0;j<3;j++)for(let i=0;i<6;i++)r.sphere((i-2.5)*17+(j%2)*7,16+j*15,22,8,colors[(i+j)%5]);r.sphere(0,9,-24,10,'#ec96b1')
  }
  r.flush()
}
