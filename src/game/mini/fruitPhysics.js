import Matter from 'matter-js'
const {Engine,Bodies,Body,Composite,Sleeping}=Matter
export const FRUIT_RADII=[14,20,27,34,43,53,64,76]
export const FRUIT_BIN={left:20,right:340,bottom:510,top:120,spawnY:76}
const STEP=1/120,clamp=(v,a,b)=>Math.max(a,Math.min(b,v))

// A separate fixed-step world keeps game rules, rendering and frame rate independent.
export function createFruitWorld({onMerge=()=>{},onImpact=()=>{}}={}) {
  const engine=Engine.create({enableSleeping:true,positionIterations:10,velocityIterations:8})
  engine.gravity.y=1;engine.gravity.scale=.0009
  const {left:L,right:R,bottom:B,top:TOP}=FRUIT_BIN
  const walls=[Bodies.rectangle(L-35,0,70,2400,{isStatic:true,friction:.2}),Bodies.rectangle(R+35,0,70,2400,{isStatic:true,friction:.2}),Bodies.rectangle((L+R)/2,B+35,R-L+140,70,{isStatic:true,friction:.3})]
  Composite.add(engine.world,walls)
  let fruits=[],elapsed=0,accumulator=0,nextId=1,danger=0,over=false,impactWait=0
  const wake=()=>fruits.forEach(f=>Sleeping.set(f.body,false))
  const spawn=(kind,x,y,options={})=>{
    const radius=FRUIT_RADII[kind]
    if(!radius||!Number.isFinite(x+y))throw Error('Invalid fruit')
    const body=Bodies.polygon(clamp(x,L+radius,R-radius),Math.min(y,B-radius),48,radius,{density:.002,friction:.16,frictionStatic:.5,frictionAir:.0015,restitution:.09,slop:.025,sleepThreshold:75})
    body.circleRadius=radius
    const f={id:nextId++,kind,radius,body,born:elapsed,entered:!!options.entered,merged:!!options.merged,impact:0}
    body.plugin.fruit=f
    Body.setVelocity(body,{x:(options.vx||0)/60,y:(options.vy||0)/60})
    Body.setAngularVelocity(body,(options.spin||0)/60)
    fruits.push(f);Composite.add(engine.world,body)
    return f
  }
  const view=f=>({id:f.id,k:f.kind,r:f.radius,x:f.body.position.x,y:f.body.position.y,vx:Body.getVelocity(f.body).x*60,vy:Body.getVelocity(f.body).y*60,angle:f.body.angle,spin:Body.getAngularVelocity(f.body)*60,mass:f.body.mass,sleeping:f.body.isSleeping,age:elapsed-f.born,merged:f.merged,impact:f.impact})
  const canDrop=(kind,x)=>{const r=FRUIT_RADII[kind],px=clamp(x,L+r,R-r);return !over&&!fruits.some(f=>Math.hypot(f.body.position.x-px,f.body.position.y-FRUIT_BIN.spawnY)<f.radius+r+1)}
  const landing=(kind,x)=>{
    const r=FRUIT_RADII[kind],px=clamp(x,L+r,R-r)
    let y=B-r
    for(const f of fruits){const dx=f.body.position.x-px,sum=r+f.radius;if(Math.abs(dx)<sum){const top=f.body.position.y-Math.sqrt(sum*sum-dx*dx);if(top>=FRUIT_BIN.spawnY-r)y=Math.min(y,top)}}
    return {x:px,y:Math.max(FRUIT_BIN.spawnY,y)}
  }
  const tick=()=>{
    elapsed+=STEP;impactWait=Math.max(0,impactWait-STEP)
    const speeds=new Map(fruits.map(f=>[f.body.id,Math.hypot(...Object.values(Body.getVelocity(f.body)))*60]))
    Engine.update(engine,STEP*1000)
    const used=new Set(),merges=[]
    // A body can participate in only one merge in a step. New fruit joins next step.
    for(const pair of engine.pairs.list){
      if(!pair.isActive)continue
      const a=pair.bodyA.plugin.fruit,b=pair.bodyB.plugin.fruit
      if(a&&b&&a.kind===b.kind&&!used.has(a)&&!used.has(b)&&elapsed-a.born>.055&&elapsed-b.born>.055){used.add(a);used.add(b);merges.push([a,b]);continue}
      if(impactWait===0){const speed=Math.max(speeds.get(pair.bodyA.id)||0,speeds.get(pair.bodyB.id)||0);if(speed>120){onImpact(Math.min(1,speed/650));impactWait=.12;if(a)a.impact=.12;if(b)b.impact=.12}}
    }
    if(merges.length){
      for(const [a,b] of merges){
        const mass=a.body.mass+b.body.mass,av=Body.getVelocity(a.body),bv=Body.getVelocity(b.body)
        const x=(a.body.position.x*a.body.mass+b.body.position.x*b.body.mass)/mass,y=(a.body.position.y*a.body.mass+b.body.position.y*b.body.mass)/mass
        Composite.remove(engine.world,[a.body,b.body])
        if(a.kind<FRUIT_RADII.length-1)spawn(a.kind+1,x,y,{vx:(av.x*a.body.mass+bv.x*b.body.mass)/mass*60,vy:(av.y*a.body.mass+bv.y*b.body.mass)/mass*60,spin:(Body.getAngularVelocity(a.body)+Body.getAngularVelocity(b.body))*30,entered:a.entered||b.entered,merged:true})
        onMerge({x,y,kind:a.kind+1,points:a.kind===7?150:(a.kind+1)*5})
      }
      fruits=fruits.filter(f=>!used.has(f));wake()
    }
    for(const f of fruits){f.impact=Math.max(0,f.impact-STEP);if(f.body.position.y-f.radius>=TOP+2)f.entered=true}
    // Fresh drops may cross the line freely; a settled overflow gets a visible grace period.
    const unsafe=fruits.some(f=>(f.entered||elapsed-f.born>.9)&&f.body.position.y-f.radius<TOP-2)
    danger=unsafe?danger+STEP:Math.max(0,danger-STEP*2)
    if(danger>=2)over=true
  }
  return {
    spawn,canDrop,landing,
    get fruits(){return fruits.map(view)},get danger(){return danger},get over(){return over},
    step(dt){if(!Number.isFinite(dt)||dt<=0||over)return;accumulator+=Math.min(dt,.1);while(accumulator+1e-10>=STEP&&!over){tick();accumulator-=STEP}},
    dispose(){Composite.clear(engine.world,false);Engine.clear(engine);fruits=[]},
  }
}
