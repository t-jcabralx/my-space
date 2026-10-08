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
  let position;const look=r.look;r.look=(...args)=>{position=[args[0],0,args[2]+(args[1]/.85)*.55];look(...args)}
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

for(const def of MINI){const r=makeR3(ctx,320,180);r.flat=true;drawMiniPreview(r,def.id,1.25)}
console.log('PASS all 24 gallery scenes render using the shared models')
console.log('ALL PASS')
