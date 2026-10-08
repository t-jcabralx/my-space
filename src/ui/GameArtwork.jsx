'use client'
import { useState } from 'react'
import { GAME_ART } from '../game/branding.js'

export function GameArtwork({ id, variant=0, className='', eager=false, decorative=false }) {
  const art=GAME_ART[id],cover=art?.covers[variant%art.covers.length]
  if(!cover)return null
  return <img className={'game-artwork '+className} src={cover.src} srcSet={`${cover.small} 320w, ${cover.src} 768w`} sizes="(max-width:600px) 46vw, 300px" width={cover.width} height={cover.height} alt={decorative?'':art.title+' — '+cover.edition} loading={eager?'eager':'lazy'} decoding="async"/>
}

export function ArtworkPicker({ id, className='' }) {
  const [variant,setVariant]=useState(0), art=GAME_ART[id]
  if(!art)return null
  return <div className={'artwork-picker '+className}>
    <GameArtwork id={id} variant={variant} eager/>
    {art.covers.length>1&&<div className="artwork-editions" aria-label="Cover artwork">{art.covers.map((cover,i)=><button key={cover.src} type="button" aria-pressed={variant===i} onClick={()=>setVariant(i)}>{cover.edition}</button>)}</div>}
  </div>
}

export function GameBrandBanner({ id }) {
  const art=GAME_ART[id]
  if(!art)return null
  return <header className="game-brand-banner" style={{'--brand-accent':art.color}}>
    <ArtworkPicker key={id} id={id}/>
    <div><span>MY SPACE ARCADE</span><h2>{art.title}</h2><p>Choose your mode. Make your next record.</p></div>
    {id==='race'&&<div className="brand-mode-art"><GameArtwork id="kart"/><span>Kart items mode</span></div>}
  </header>
}
