'use client'
import { useEffect, useRef, useState } from 'react'
import { MINI, W, H } from '../game/mini/games.js'
import { makeMiniWebGL } from '../game/mini/webgl.js'
import { profile, saveProfile, recordScore } from '../game/engine.js'
import { sfx, unlockAudio } from '../game/audio.js'
import { MINI_META, MiniPreview } from './MiniPreview.jsx'
import { GAME_ART } from '../game/branding.js'
import { GameArtwork, ArtworkPicker } from './GameArtwork.jsx'

const best = (id) => (profile.mini && profile.mini[id]) || 0

function MiniPlayer({ def, onBack }) {
  const cv = useRef(null), gpu = useRef(null), gameRef = useRef(null), status = useRef('ready')
  const [phase, setPhase] = useState('ready'), [score, setScore] = useState(0), [extra, setExtra] = useState('')
  const [newBest, setNewBest] = useState(false), [run, setRun] = useState(0), [graphics, setGraphics] = useState('loading')
  const meta = {...MINI_META[def.id],color:GAME_ART[def.id]?.color||MINI_META[def.id].color}
  const changePhase = (value) => { status.current=value; setPhase(value) }
  // on phones the game takes over the whole screen (CSS does the layout; this asks the browser for real fullscreen too)
  useEffect(() => {
    let phone = false
    try { phone = window.matchMedia('(pointer: coarse)').matches && window.innerWidth <= 900 } catch { /* ignore */ }
    if (!phone) return undefined
    try { const p = document.documentElement.requestFullscreen && document.documentElement.requestFullscreen(); if (p && p.catch) p.catch(() => {}) } catch { /* ignore */ }
    return () => { try { if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {}) } catch { /* ignore */ } }
  }, [])
  const pause = () => { gameRef.current?.cancel?.(); if(status.current==='playing')changePhase('paused') }
  const play = () => { unlockAudio(); changePhase('playing'); cv.current?.focus({preventScroll:true}) }

  useEffect(() => {
    const game=def.make(); game.reset(); gameRef.current=game
    status.current='ready'; setPhase('ready'); setScore(0); setExtra(''); setNewBest(false)
    cv.current.closest('.screen')?.scrollTo({top:0})
    const canvas=cv.current, ctx=canvas.getContext('2d'), dpr=Math.min(2,window.devicePixelRatio||1)
    canvas.width=W*dpr; canvas.height=H*dpr
    let renderer=null, lost=false
    try { renderer=makeMiniWebGL(gpu.current,ctx,W,H); game.attachRenderer(renderer); setGraphics('3d') }
    catch(error) { console.warn('Mini arcade WebGL unavailable:',error.message); setGraphics('fallback') }
    const onLost=(e)=>{e.preventDefault();lost=true;game.cancel?.();status.current='paused';setPhase('paused');setGraphics('lost')}
    const gpuCanvas=gpu.current; gpuCanvas.addEventListener('webglcontextlost',onLost)
    let raf=0,last=performance.now(),ui=0,previousScore=0,soundWait=0,accumulator=0
    const finish=()=>{
      const sc=Math.floor(game.score)
      profile.mini=profile.mini||{}
      const nb=sc>(profile.mini[def.id]||0)
      if(nb)profile.mini[def.id]=sc
      profile.miniGames=(profile.miniGames||0)+1;saveProfile()
      if(sc>0&&def.id!=='miner')recordScore('mini_'+def.id,sc)
      setNewBest(nb&&sc>0);setScore(sc);status.current='over';setPhase('over');sfx(game.won?'win':'over')
    }
    const loop=(now)=>{
      const dt=Math.min(.06,(now-last)/1000);last=now
      if(status.current==='playing'&&!lost){
        accumulator+=dt
        while(accumulator>=1/120&&!game.over){game.update(1/120);accumulator-=1/120}
        if(renderer)renderer.clock+=dt
        for(const event of game.drainEvents?.()||[])sfx(event.sound,event.arg)
        soundWait-=dt
        const sc=Math.floor(game.score)
        // Continuous distance/mass points should not play a coin sound every frame.
        if(sc>previousScore&&soundWait<=0&&!['miner','runner','rift','traffic','blob','hop','fruit'].includes(def.id)){sfx('coin');soundWait=.14}
        previousScore=sc;ui-=dt
        if(ui<=0){ui=.1;setScore(sc);setExtra(game.status|| (game.moves!==undefined?'Moves '+game.moves:game.arrows!==undefined?game.arrows+' arrows':game.rewinds!==undefined?game.rewinds+' rewinds':game.lives!==undefined?game.lives+' lives':game.time>0?Math.ceil(game.time)+' seconds':''))}
        if(game.over)finish()
      }else accumulator=0
      if(!lost){ctx.setTransform(dpr,0,0,dpr,0,0);game.draw(ctx)}
      raf=requestAnimationFrame(loop)
    }
    raf=requestAnimationFrame(loop)
    const key=(e)=>{
      if(e.target instanceof HTMLElement&&['INPUT','TEXTAREA'].includes(e.target.tagName))return
      const used=['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyA','KeyD','KeyW','KeyS','KeyQ','KeyP','Escape','Enter'].includes(e.code)||/^Digit[1-9]$/.test(e.code)
      if(!used)return
      e.preventDefault();e.stopImmediatePropagation()
      if((e.code==='KeyP'||e.code==='Escape')&&!e.repeat){if(status.current==='playing')pause();else if(status.current==='paused'&&!lost)play();return}
      if(status.current==='ready'&&['Space','Enter'].includes(e.code)){play();return}
      if(status.current==='playing'&&(!e.repeat||e.code.startsWith('Arrow')))game.key?.(e.code)
    }
    const release=(e)=>{if(status.current==='playing')game.keyup?.(e.code)}
    const hidden=()=>{if(document.hidden)pause()}
    window.addEventListener('keydown',key,true);window.addEventListener('keyup',release,true);window.addEventListener('blur',pause);document.addEventListener('visibilitychange',hidden)
    return()=>{
      cancelAnimationFrame(raf);window.removeEventListener('keydown',key,true);window.removeEventListener('keyup',release,true);window.removeEventListener('blur',pause);document.removeEventListener('visibilitychange',hidden)
      gpuCanvas.removeEventListener('webglcontextlost',onLost);renderer?.dispose();game.dispose?.()
      if(def.id==='miner'&&game.score>0){profile.mini=profile.mini||{};profile.mini.miner=Math.max(profile.mini.miner||0,Math.floor(game.score));saveProfile()}
      gameRef.current=null
    }
  },[def,run])

  const point=(e)=>{const box=cv.current.getBoundingClientRect(),p=[(e.clientX-box.left)/box.width*W,(e.clientY-box.top)/box.height*H];return gameRef.current?.mapPointer?.(...p)||gameRef.current?.toGamePoint?.(...p)||p}
  const input=(method,e)=>{if(status.current!=='playing')return;const game=gameRef.current;if(method==='down'){unlockAudio();cv.current.focus({preventScroll:true});cv.current.setPointerCapture(e.pointerId)}game?.[method]?.(...point(e))}
  const cancel=()=>gameRef.current?.cancel?.()
  return <div className="mini-play" style={{'--mini-accent':meta.color}}>
    <div className="mini-top">
      <button className="mini-back" onClick={onBack}>← Mini arcade</button>
      <span className="mini-score-chip">{score.toLocaleString()}{extra ? <small> · {extra}</small> : null}</span>
      <span className="mini-engine">{graphics==='3d'?'● 3D':graphics==='fallback'?'Compatibility mode':graphics==='lost'?'Graphics interrupted':'Loading scene'}</span>
      <button className="mini-back" onClick={()=>phase==='playing'?pause():play()} disabled={phase==='ready'||phase==='over'||graphics==='lost'}>{phase==='paused'?'Resume':'Pause'} <kbd>P</kbd></button>
    </div>
    <div className="mini-layout">
      <aside className="mini-guide">
        <ArtworkPicker id={def.id} className="mini-game-cover"/>
        <span className="mini-eyebrow">{meta.category} / MINI ARCADE</span>
        <h2>{def.name}</h2><p>{meta.story}</p>
        <div className="mini-stats"><div><span>Score</span><strong>{score.toLocaleString()}</strong></div><div><span>Personal best</span><strong>{best(def.id).toLocaleString()}</strong></div></div>
        <div className="mini-instructions"><h3>How to play</h3><p>{meta.controls}</p><p className="mini-goal">{meta.goal}</p></div>
        <div className="mini-session" aria-live="polite">{extra||(phase==='playing'?'In play · P to pause':'Ready when you are')}</div>
        <button className="mini-back" onClick={()=>setRun(n=>n+1)}>↻ Restart</button>
      </aside>
      <div className="mini-stage">
        <canvas key={run} ref={gpu} className="mini-webgl" aria-hidden="true" />
        <canvas ref={cv} className={'mini-canvas'+(graphics==='fallback'?' fallback':'')} tabIndex={0} role="img" aria-label={def.name+' game. '+meta.controls} onPointerDown={e=>input('down',e)} onPointerMove={e=>input('move',e)} onPointerUp={e=>input('up',e)} onPointerCancel={cancel} onLostPointerCapture={cancel}/>
        {phase!=='playing'&&<div className="mini-overlay">
          <span className="mini-eyebrow">{phase==='ready'?'READY TO PLAY':phase==='paused'?'TAKE A BREATHER':newBest?'PERSONAL BEST':'ROUND COMPLETE'}</span>
          <h2>{phase==='ready'?def.name:phase==='paused'?'Paused':gameRef.current?.won?'You win!':def.id==='memory'?'All pairs found!':'Nice run.'}</h2>
          <p>{phase==='ready'?meta.controls:phase==='paused'?'Your game is waiting right here.':'Score '+score.toLocaleString()}</p>
          {graphics==='lost'?<button className="mini-primary" onClick={()=>setRun(n=>n+1)}>Reload scene</button>:<button className="mini-primary" onClick={()=>phase==='over'?setRun(n=>n+1):play()} disabled={graphics==='loading'}>{phase==='ready'?'Start game →':phase==='paused'?'Resume game →':'Play again →'}</button>}
          {phase==='over'&&<button className="mini-back" onClick={onBack}>Choose another game</button>}
        </div>}
      </div>
    </div>
  </div>
}

export default function MiniArcade() {
  const [id,setId]=useState(null),[category,setCategory]=useState('All'),[query,setQuery]=useState('')
  const def=MINI.find(g=>g.id===id)
  if(def)return <MiniPlayer key={def.id} def={def} onBack={()=>setId(null)}/>
  const games=MINI.filter(g=>(category==='All'||MINI_META[g.id].category===category)&&g.name.toLowerCase().includes(query.toLowerCase()))
  return <section className="mini-gallery">
    <header className="mini-gallery-head"><div><span className="mini-eyebrow">YOUR NEXT HIGH SCORE STARTS HERE</span><h2>The mini arcade<span>24 worlds to play.</span></h2><p>Big characters. Bright worlds. One more round.</p></div><label className="mini-search"><span>Find a game</span><input type="search" placeholder="Search games…" value={query} onChange={e=>setQuery(e.target.value)}/></label></header>
    <div className="mini-filters" aria-label="Game categories">{['All','Action','Puzzle','Sports','Adventure'].map(c=><button key={c} aria-pressed={category===c} onClick={()=>setCategory(c)}>{c}{c==='All'&&<span>24</span>}</button>)}</div>
    <div className="mini-grid">{games.map(g=>{const meta={...MINI_META[g.id],color:GAME_ART[g.id]?.color||MINI_META[g.id].color};return <button key={g.id} className="mini-card" style={{'--mini-accent':meta.color}} onClick={()=>{unlockAudio();sfx('ui');setId(g.id)}} aria-label={'Play '+g.name}>
      <div className={"mini-card-art"+(GAME_ART[g.id]?" has-logo":"")}>{GAME_ART[g.id]?<GameArtwork id={g.id} decorative/>:<MiniPreview id={g.id}/>}<span className="mini-category">{meta.category}</span><span className="mini-launch" aria-hidden="true">↗</span></div>
      <div className="mini-card-copy">{GAME_ART[g.id]&&<span className="mini-cover-category">{meta.category}</span>}<b>{g.name}</b><small>{g.desc}</small><div className="mini-card-footer"><em>{best(g.id)>0?'Best '+best(g.id).toLocaleString():'Set your first record'}</em><span>Play →</span></div></div>
    </button>})}</div>
    {category==='All'&&!query&&<section className="future-art" aria-label="Future game artwork"><div className="future-art-heading"><span className="mini-eyebrow">MORE WORLDS ON THE DRAWING BOARD</span><h3>The next adventures</h3><p>Artwork previews. These three games aren't playable yet.</p></div><div className="future-art-grid">{['ocean','skydash','hoopclash'].map(key=><article key={key}><GameArtwork id={key}/><div><h4>{GAME_ART[key].title}</h4><span>Artwork preview</span></div></article>)}</div></section>}
    {!games.length&&<p className="mini-empty">No games found. Try a different name or category.</p>}
  </section>
}
