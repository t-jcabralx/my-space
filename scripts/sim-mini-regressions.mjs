import assert from 'node:assert/strict'
import { MINI } from '../src/game/mini/games.js'
import { makeR3 } from '../src/game/mini/r3.js'
import { drawMiniPreview } from '../src/game/mini/previews.js'

globalThis.localStorage={getItem:()=>null,setItem:()=>{}}
const gradient={addColorStop(){}}
const ctx=new Proxy({}, {get:(_,k)=>k==='createLinearGradient'||k==='createRadialGradient'?()=>gradient:()=>{},set:()=>true})
const create=id=>{const g=MINI.find(d=>d.id===id).make();g.reset();return g}
const withRandom=(value,fn)=>{const original=Math.random;try{Math.random=()=>value;fn()}finally{Math.random=original}}

// Click the projected burrow centers, exercising rendering -> input -> scoring.
for(let i=0;i<9;i++)withRandom((i+.5)/9,()=>{
  const g=create('mole'),r=makeR3(ctx)
  g.attachRenderer(r);g.update(.51);g.draw(ctx)
  const p=r.proj([(i%3-1)*100,31,(Math.floor(i/3)-1)*115])
  const hit=g.mapPointer(p.x,p.y)
  assert.deepEqual(hit,[[70,180,290][i%3],[190,310,430][Math.floor(i/3)]-18])
  g.down(...hit)
  assert.equal(g.score,i===0?5:i===1?0:1,'Projected mole hit must address the correct burrow')
})
console.log('PASS all nine projected burrows map to their matching scoring target')

withRandom(.5,()=>{
  const g=create('archery')
  g.down(54,400);g.move(0,455);g.cancel();g.up()
  assert.equal(g.arrows,10,'Canceled pull must not fire')
  g.down(54,400);g.move(0,455);g.up()
  for(let i=0;i<10&&!g.score;i++)g.update(.11)
  assert.ok(g.score>0,'An arrow crossing the target between frames must score')
})
console.log('PASS canceled bow pull and swept arrow collision at low frame rates')

withRandom(.5,()=>{
  const g=create('blocks');g.down(60,465);g.move(180,270);g.cancel();g.up();assert.equal(g.score,0)
  const tower=create('stack');tower.update(.46);tower.key('Space');assert.equal(tower.score,1)
})
console.log('PASS canceled block placement and keyboard tower drop')

withRandom(.7,()=>{
  const g=create('pong');let ballX=180,botScore=0,frames=0
  const drawContext=new Proxy({}, {get:(_,k)=>k==='fillText'?(s)=>{const m=String(s).match(/^BOT (\d+)\/7/);if(m)botScore=+m[1]}:()=>{},set:()=>true})
  const r=new Proxy({g:drawContext,clock:0,info:{},sphere(x,y,z,rad,c){if(c==='#ffffff')ballX=x+180},pickGround(){return[0,0]}},{get:(o,k)=>k in o?o[k]:()=>{}})
  g.attachRenderer(r)
  for(;frames<2400&&!g.over;frames++){g.draw(drawContext);g.down(ballX);g.update(.05)}
  g.draw(drawContext)
  assert.equal(botScore,0,'A centered paddle must return the ball even at high speed and 20 fps')
  assert.ok(frames>300||g.won,'The rally ran long enough to reach higher ball speeds')
})
console.log('PASS high-speed Pong paddle crossings at 20 fps')

// Verify screen directions against the actual camera, not just an input lookup table.
for(const [key,sx,sy] of [['ArrowUp',0,-1],['ArrowDown',0,1],['ArrowLeft',-1,0],['ArrowRight',1,0]])withRandom(.1,()=>{
  const g=create('blob'),r=makeR3(ctx);r.flat=true
  let position;const look=r.look;r.look=(...args)=>{position=[args[3],0,args[5]-40];look(...args)}
  g.attachRenderer(r);g.draw(ctx);const before=position.slice(),screen=r.proj(before)
  // Keep the starting camera so following the player cannot conceal inversion.
  const originalProject=r.proj;const E=r.E.slice(),F=r.F.slice(),R=r.R.slice(),U=r.U.slice()
  g.key(key);for(let i=0;i<12;i++)g.update(1/120);g.draw(ctx)
  r.E=E;r.F=F;r.R=R;r.U=U;const after=originalProject(position)
  if(sx)assert.ok((after.x-screen.x)*sx>0,key+' moves in the displayed horizontal direction')
  if(sy)assert.ok((after.y-screen.y)*sy>0,key+' moves in the displayed vertical direction')
  g.cancel();g.dispose?.()
})
withRandom(.1,()=>{
  const g=create('blob'),r=makeR3(ctx);r.flat=true;g.attachRenderer(r);g.draw(ctx)
  const above=g.mapPointer(180,160),below=g.mapPointer(180,380)
  assert.ok(above[1]<270&&below[1]>270,'Pointer rays above/below the blob preserve screen direction')
  let z;const look=r.look;r.look=(...args)=>{z=args[5]-40;look(...args)}
  g.key('ArrowUp');g.key('ArrowRight');g.keyup('ArrowRight');g.keyup('ArrowUp');g.update(1/60);g.draw(ctx)
  assert.equal(z,700,'Releasing the keys stops steering instead of leaving a stuck direction')
})
console.log('PASS Blob Arena screen directions, pointer rays and key release')

// Even a worst-case random seed must not spawn a predator on top of the player.
withRandom(.5,()=>{
  const g=create('blob'),r=makeR3(ctx),starts=[],oval=r.ellipsoid
  r.ellipsoid=(...a)=>{if(a[7]?.surface==='gel'&&a[4]<a[3]*.3&&a[6]!=='#62c6a4')starts.push([a[0],a[2]]);oval(...a)}
  g.attachRenderer(r);g.draw(ctx)
  assert.equal(starts.length,14)
  assert.ok(starts.every(([x,z])=>Math.hypot(x-700,z-700)>200),'Predators start outside the player’s immediate space')
  for(let i=0;i<120;i++)g.update(1/120)
  assert.equal(g.over,false,'The player gets time to steer away at the start')
  assert.match(g.status,/safe start/)
})
console.log('PASS Blob Arena grants a safe start when spawn positions coincide')

withRandom(.1,()=>{
  const g=create('fishing'),r=makeR3(ctx);let hookY=0,hookX=180
  const line=r.line;r.line=(a,b,color,...rest)=>{if(color==='#e5ede0'){hookX=b[0]+180;hookY=540-b[1]}line(a,b,color,...rest)}
  g.attachRenderer(r)
  g.down(9999);g.update(1/120);g.draw(ctx)
  assert.ok(hookX>180&&hookX<190,'Pointer movement steers the hook instead of teleporting it')
  for(let i=0;i<100;i++)g.update(1/120)
  g.draw(ctx);const deep=hookY;g.cancel()
  for(let i=0;i<160;i++)g.update(1/120)
  g.draw(ctx);assert.ok(hookY<deep,'Canceled input reels the hook back in')
  assert.ok(hookX<=325.01,'Boat and hook stay inside the lake')

  const catchGame=create('fishing')
  for(let i=0;i<192;i++)catchGame.update(1/120)
  catchGame.down(85)
  for(let i=0;i<240&&!catchGame.status.startsWith('Reeling');i++)catchGame.update(1/120)
  assert.match(catchGame.status,/Reeling/,'A fish can be hooked in the new lake')
  catchGame.up()
  for(let i=0;i<360;i++)catchGame.update(1/120)
  assert.equal(catchGame.score,10,'A landed fish scores exactly once')
})
console.log('PASS Fishing steering, canceled casts and single-catch scoring')

for(const [key,sx,sy] of [['ArrowUp',0,-1],['ArrowDown',0,1],['ArrowLeft',-1,0],['ArrowRight',1,0]]){
  const g=create('sumo'),r=makeR3(ctx);r.flat=true;let position,guide
  const oval=r.ellipsoid,line=r.line
  r.ellipsoid=(...a)=>{if(a[6]==='#e93e35')position=a.slice(0,3);oval(...a)}
  r.line=(a,b,c,...rest)=>{if(c==='#ffffff')guide=[a,b];line(a,b,c,...rest)}
  g.attachRenderer(r);g.draw(ctx);const before=r.proj(position)
  g.key(key);for(let i=0;i<12;i++)g.update(1/120);g.draw(ctx);const after=r.proj(position)
  if(sx)assert.ok((after.x-before.x)*sx>0,key+' moves the red sumo in the displayed direction')
  if(sy)assert.ok((after.y-before.y)*sy>0,key+' moves the red sumo in the displayed direction')
  g.cancel();guide=null;g.draw(ctx);assert.equal(guide,null,'Cancel releases all sumo steering')
}
{
  const g=create('sumo'),r=makeR3(ctx);r.flat=true;let guide
  const line=r.line;r.line=(a,b,c,...rest)=>{if(c==='#ffffff')guide=[a,b];line(a,b,c,...rest)}
  g.attachRenderer(r);g.key('ArrowUp');g.key('ArrowRight');g.keyup('ArrowRight');g.draw(ctx)
  assert.ok(guide[1][2]>guide[0][2]&&guide[1][0]===guide[0][0],'Releasing right preserves the held up direction')
  g.keyup('ArrowUp');guide=null;g.draw(ctx);assert.equal(guide,null,'Releasing the last key ends steering')
}
console.log('PASS Sumo screen directions, simultaneous keys and canceled steering')

{
  const g=create('hoops')
  g.key('Space');for(let i=0;i<240;i++)g.update(1/120)
  assert.equal(g.score,2,'The default keyboard arc scores one basket')
  for(let i=0;i<120;i++)g.update(1/120)
  assert.equal(g.score,2,'The same basket cannot score twice')
  g.key('Space');for(let i=0;i<240;i++)g.update(1/120)
  assert.equal(g.score,4,'The ball resets for the next shot')
  const canceled=create('hoops');canceled.down(180,470);canceled.move(180,340);canceled.update(.15);canceled.cancel();canceled.up(180,340)
  for(let i=0;i<240;i++)canceled.update(1/120)
  assert.equal(canceled.score,0,'Canceled swipes do not launch a shot')
}
console.log('PASS Hoop Shot keyboard arc, repeated baskets and canceled flicks')

for(const def of MINI){const r=makeR3(ctx,320,180);r.flat=true;drawMiniPreview(r,def.id,1.25)}
console.log('PASS all 24 gallery scenes render using the shared models')
console.log('ALL PASS')
