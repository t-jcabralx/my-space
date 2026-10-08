'use client'
import { useEffect, useRef } from 'react'
import { makeR3 } from '../game/mini/r3.js'
import { drawMiniPreview } from '../game/mini/previews.js'

const entry=(category,color,story,controls,goal)=>({category,color,story,controls,goal})
export const MINI_META={
  stack:entry('Puzzle','#7ecbd3','Build a skyline above the clouds.','Tap or press Space when the moving block lines up.','Perfect drops keep your tower wide.'),
  wing:entry('Adventure','#f0c878','A tiny sky courier with a very big delivery.','Tap, Space, or ↑ to flap.','Keep clear of the pipes and the ground.'),
  bubble:entry('Puzzle','#bdabea','Clear the floating crystals from the observatory.','Move to aim. Click or tap to launch.','Match at least three bubbles of one color.'),
  runner:entry('Action','#79c9d8','Race the last train through a sleeping city.','Tap, Space, or ↑ to jump. Tap again for a double jump.','Collect coins and clear the obstacles.'),
  slice:entry('Action','#e8a59d','Fresh fruit is flying through the festival kitchen.','Hold and swipe through fruit.','Avoid bombs and keep your combo alive.'),
  gems:entry('Puzzle','#b49be1','Restore color to the crystal archive.','Tap adjacent gems or drag one to swap.','Match three or more. You have 25 moves.'),
  memory:entry('Puzzle','#83c1b0','Find the matching keepsakes in the garden library.','Tap a card to turn it over.','Find every pair with fewer moves.'),
  mole:entry('Action','#a8c682','The orchard has some mischievous visitors.','Tap a mole, or use keys 1–9 for the nine burrows.','Gold moles are worth more. Avoid the bombs.'),
  miner:entry('Adventure','#cbb184','Lead a little mining crew into the lantern-lit crystal caverns.','Tap the ore. Buy tools and helpers below.','Upgrade your crew to earn ore automatically.'),
  traffic:entry('Action','#87c8d2','Thread a red sports car through the bright streets of a restless city.','Swipe, tap a side, or use ← → to change lanes.','Collect coins and keep a clear escape lane.'),
  blob:entry('Adventure','#b8a0de','A hungry little spirit explores the garden.','Move your pointer, drag, or use arrow keys to steer.','Eat smaller creatures. Stay away from bigger ones.'),
  blocks:entry('Puzzle','#dbb785','Fit the pieces in the artisan’s workshop.','Drag a piece from the tray onto the grid.','Fill a row or column to clear it.'),
  simon:entry('Puzzle','#91b9e3','Replay the melody of the four lanterns.','Watch, then tap the pads or use keys 1–4.','Each round adds one note to remember.'),
  fishing:entry('Adventure','#82c5cf','Take your skiff out beneath the pines and snowy peaks.','Move or use ← → to steer. Hold to lower the hook; release to reel. Space toggles the line.','Catch fish, avoid boots and squid. You have 60 seconds.'),
  hoops:entry('Sports','#e7ae82','The park lights are on. Chase your next streak beneath the evening skyline.','Flick upward toward the hoop. Or use ← → to aim and Space to shoot.','Follow the dotted arc. Build a streak before the 60-second buzzer.'),
  sumo:entry('Sports','#db9d9d','Enter the gold-banner tournament. Red challenger, blue champion, one ring.','Drag toward the rival to charge. Release to slow down. Arrow keys also steer.','Push your rival beyond the straw ring.'),
  knife:entry('Action','#c6ad8d','Test your timing in the woodland training yard.','Tap or press Space to throw a knife.','Fill the log without hitting another knife.'),
  fruit:entry('Puzzle','#e7aba4','Help the orchard spirits fill their harvest crate.','Move or use ← → to aim. Tap or Space to drop. The ghost shows the landing point.','Match identical fruit. Let the pile settle; a 2-second warning gives you time to clear the overflow.'),
  hop:entry('Adventure','#8fbd9d','A kangaroo explorer climbs the gardens drifting above the clouds.','Move your pointer, drag, or use ← → to steer.','Green islands are safe, blue ones move, and wooden platforms break.'),
  ttt:entry('Puzzle','#92bdcf','A friendly rival waits at the strategy table.','Tap an empty square to place X.','Make a line of three. The bot gets stronger each round.'),
  pong:entry('Sports','#8dc8b3','Challenge the crowned robot beneath the neon arena lights.','Drag or use ← → to move your paddle.','First to seven points wins.'),
  archery:entry('Sports','#b3ca99','Train with the wind in the forest range.','Pull back from the bow, then release. Follow the dotted arc.','You have ten arrows. The center earns 50 points.'),
  rift:entry('Action','#9fd6dd','Run through a city where time can turn backward.','Tap, Space, or ↑ to jump. Tap twice for a double jump.','A crash spends a rewind. Collect coins for extra chances.'),
  tess:entry('Puzzle','#baa8df','Study the changing shape inside the star observatory.','Tap the gold vertex before its ring disappears.','A 4D hypercube projected into the 3D scene. Three missed targets ends the run.'),
}

export function MiniPreview({id}) {
  const ref=useRef(null)
  useEffect(()=>{
    const c=ref.current,g=c.getContext('2d'),dpr=Math.min(2,window.devicePixelRatio||1)
    c.width=320*dpr;c.height=180*dpr
    const r=makeR3(g,320,180);r.flat=true
    let raf=0,visible=false,hover=false,last=0
    const still=matchMedia('(prefers-reduced-motion: reduce)').matches
    const draw=(t)=>{g.setTransform(dpr,0,0,dpr,0,0);drawMiniPreview(r,id,t/1000)}
    const loop=(now)=>{raf=0;if(!visible||!hover||still)return;if(now-last>80){last=now;draw(now)}raf=requestAnimationFrame(loop)}
    const card=c.closest('button'),enter=()=>{hover=true;if(visible&&!raf&&!still)raf=requestAnimationFrame(loop)},leave=()=>{hover=false;cancelAnimationFrame(raf);raf=0}
    card?.addEventListener('pointerenter',enter);card?.addEventListener('pointerleave',leave);card?.addEventListener('focus',enter);card?.addEventListener('blur',leave)
    const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible){draw(1100);if(hover&&!raf&&!still)raf=requestAnimationFrame(loop)}else leave()},{rootMargin:'100px'})
    observer.observe(c)
    return()=>{observer.disconnect();cancelAnimationFrame(raf);card?.removeEventListener('pointerenter',enter);card?.removeEventListener('pointerleave',leave);card?.removeEventListener('focus',enter);card?.removeEventListener('blur',leave)}
  },[id])
  return <canvas ref={ref} aria-hidden="true"/>
}
