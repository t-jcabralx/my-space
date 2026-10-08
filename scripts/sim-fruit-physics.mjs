import assert from 'node:assert/strict'
import {createFruitWorld,FRUIT_BIN as BIN} from '../src/game/mini/fruitPhysics.js'
const run=(w,seconds,dt=1/120)=>{for(let t=0;t<Math.round(seconds/dt);t++)w.step(dt)}
const bounds=w=>{for(const b of w.fruits){assert.ok(Number.isFinite(b.x+b.y+b.vx+b.vy+b.angle));assert.ok(b.x-b.r>=BIN.left-1&&b.x+b.r<=BIN.right+1,'fruit stays between walls');assert.ok(b.y+b.r<=BIN.bottom+1,'fruit stays above floor')}}
{
 const w=createFruitWorld();w.spawn(3,180,76);run(w,6);const b=w.fruits[0];assert.ok(b.sleeping,'settled fruit sleeps');assert.ok(Math.abs(b.y+b.r-BIN.bottom)<.5);assert.ok(Math.hypot(b.vx,b.vy)<1);assert.equal(w.over,false);bounds(w);w.dispose()
 console.log('PASS natural drop settles without bouncing forever or false overflow')
}
{
 const w=createFruitWorld();for(const [k,y] of [[7,434],[5,305],[2,225]])w.spawn(k,180,y);run(w,8);bounds(w)
 const balls=w.fruits;for(let i=0;i<balls.length;i++)for(let j=i+1;j<balls.length;j++)assert.ok(Math.hypot(balls[i].x-balls[j].x,balls[i].y-balls[j].y)>balls[i].r+balls[j].r-1.2,'stack does not interpenetrate')
 assert.ok(balls.every(b=>b.sleeping),'mixed-size stack comes to rest');w.dispose();console.log('PASS mixed-size stack rests with separate collision surfaces')
}
{
 const w=createFruitWorld();w.spawn(7,215,434);w.spawn(0,90,486,{vx:240});run(w,.45);const small=w.fruits.find(b=>b.k===0),big=w.fruits.find(b=>b.k===7);assert.ok(big.mass>small.mass*20,'mass scales with area');assert.ok(Math.abs(big.vx)<160,'small fruit cannot launch a watermelon');assert.ok(Math.abs(small.angle)>.02,'contact friction makes fruit roll');bounds(w);w.dispose();console.log('PASS size-based mass, friction and visible rolling')
}
{
 const events=[],w=createFruitWorld({onMerge:e=>events.push(e)});for(const x of [145,172,199])w.spawn(0,x,496);run(w,.3);assert.equal(events.length,1);assert.deepEqual(w.fruits.map(b=>b.k).sort(),[0,1]);assert.equal(events[0].points,5);bounds(w);w.dispose();console.log('PASS a fruit is consumed once, with exactly one score event per pair')
}
{
 const events=[],w=createFruitWorld({onMerge:e=>events.push(e)});w.spawn(1,120,260,{vx:180,vy:100});w.spawn(1,159,260,{vx:180,vy:100});run(w,.1);assert.equal(events.length,1);const b=w.fruits[0];assert.ok(b.vx>150&&b.vx<190);assert.ok(b.vy>90,'merge preserves falling momentum instead of kicking upward');w.dispose();console.log('PASS merged fruit preserves momentum without an artificial launch')
}
{
 const w=createFruitWorld();for(const [k,y] of [[7,434],[6,294],[5,177],[4,81]])w.spawn(k,180,y);run(w,.5);assert.equal(w.over,false,'overflow has grace');run(w,4);assert.equal(w.over,true,'latest fruit can cause overflow without another drop');w.dispose();console.log('PASS sustained overflow ends after a grace period, including the newest fruit')
}
{
 const sample=dt=>{const w=createFruitWorld();w.spawn(0,80,76,{vx:120});w.spawn(4,240,140,{vx:-40});run(w,4,dt);bounds(w);const result=w.fruits.map(({x,y,angle})=>[x,y,angle]);w.dispose();return result}
 const a=sample(1/30),b=sample(1/60),c=sample(1/120);for(let i=0;i<a.length;i++)for(let j=0;j<3;j++){assert.ok(Math.abs(a[i][j]-b[i][j])<1e-6);assert.ok(Math.abs(a[i][j]-c[i][j])<1e-6)}console.log('PASS identical physics at 30, 60 and 120 FPS')
}
{
 const w=createFruitWorld();w.spawn(0,180,BIN.spawnY);assert.equal(w.canDrop(0,180),false);assert.equal(w.canDrop(0,40),true);w.dispose()
 const fast=createFruitWorld();fast.spawn(0,80,300,{vx:1600,vy:1300});run(fast,1,.1);bounds(fast);fast.dispose();console.log('PASS blocked drop lanes and fast collisions stay inside the bin')
}
console.log('ALL FRUIT PHYSICS CHECKS PASSED')
