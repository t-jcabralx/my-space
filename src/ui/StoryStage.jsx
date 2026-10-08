'use client'
import { useEffect, useRef } from 'react'
import { makeR3 } from '../game/mini/r3.js'
import { drawCinematic } from '../game/cinematics.js'

export default function StoryStage(props) {
  const canvas=useRef(null), current=useRef(props); current.current=props
  useEffect(()=>{
    const el=canvas.current, ctx=el.getContext('2d'), r=makeR3(ctx,960,540)
    let frame=0,last=0,start=0
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const draw=now=>{
      if(!start) start=now
      if(now-last>=1000/30) { drawCinematic(r,current.current,reduced?0:(now-start)/1000); last=now }
      frame=requestAnimationFrame(draw)
    }
    frame=requestAnimationFrame(draw)
    return ()=>cancelAnimationFrame(frame)
  },[])
  return <canvas ref={canvas} width={960} height={540} className="storyscene" role="img" aria-label="Animated chapter scene with the story cast" />
}
