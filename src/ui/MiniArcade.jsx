'use client'
// MINI GAMES: a gallery of ten quick canvas games (see src/game/mini/games.js) plus the player that runs one of them.
import { useEffect, useRef, useState } from 'react'
import { MINI, W, H } from '../game/mini/games.js'
import { profile, saveProfile, recordScore } from '../game/engine.js'
import { sfx, unlockAudio } from '../game/audio.js'

const best = (id) => (profile.mini && profile.mini[id]) || 0

function MiniPlayer({ def, onBack }) {
  const cv = useRef(null)
  const gameRef = useRef(null)
  const [score, setScore] = useState(0)
  const [over, setOver] = useState(false)
  const [extra, setExtra] = useState('')
  const [newBest, setNewBest] = useState(false)
  const [run, setRun] = useState(0)

  useEffect(() => {
    const g = def.make()
    gameRef.current = g
    g.reset()
    setScore(0); setOver(false); setNewBest(false)
    const c = cv.current, ctx = c.getContext('2d')
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    c.width = W * dpr; c.height = H * dpr
    let raf = 0, last = performance.now(), done = false, prev = 0, ui = 0
    const finish = () => {
      done = true
      const sc = Math.floor(g.score)
      profile.mini = profile.mini || {}
      const nb = sc > (profile.mini[def.id] || 0)
      if (nb) profile.mini[def.id] = sc
      profile.miniGames = (profile.miniGames || 0) + 1
      saveProfile()
      if (sc > 0 && def.id !== 'miner') recordScore('mini_' + def.id, sc)
      setNewBest(nb && sc > 0); setScore(sc); setOver(true); sfx('over')
    }
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now
      g.update(dt)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.draw(ctx)
      const sc = Math.floor(g.score)
      if (sc > prev && def.id !== 'miner') sfx('coin')
      prev = sc
      ui -= dt
      if (ui <= 0) { ui = 0.1; setScore(sc); setExtra(g.moves !== undefined ? 'MOVES ' + g.moves : g.time !== undefined && g.time !== 0 && def.id === 'mole' ? g.time + 's' : '') }
      if (g.over && !done) finish()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    const key = (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault()
      if (e.repeat) return
      if (g.key) g.key(e.code)
    }
    window.addEventListener('keydown', key)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', key); if (def.id === 'miner' && g.score > 0) { profile.mini = profile.mini || {}; profile.mini.miner = Math.max(profile.mini.miner || 0, Math.floor(g.score)); saveProfile() } }
  }, [def, run])

  const pt = (e) => { const r = cv.current.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H] }
  const down = (e) => { unlockAudio(); try { cv.current.setPointerCapture(e.pointerId) } catch { /* ignore */ } const [x, y] = pt(e); const g = gameRef.current; if (g && g.down) g.down(x, y) }
  const move = (e) => { const [x, y] = pt(e); const g = gameRef.current; if (g && g.move) g.move(x, y) }
  const up = (e) => { const [x, y] = pt(e); const g = gameRef.current; if (g && g.up) g.up(x, y) }

  return (
    <div className="mini-play">
      <div className="mini-top">
        <button className="big sec" onClick={onBack}>◀ ALL GAMES</button>
        <div className="mini-title"><b>{def.icon} {def.name}</b><small>{def.make === undefined ? '' : ''}BEST {best(def.id)}</small></div>
        <div className="mini-score"><small>SCORE</small><b>{score}</b>{extra && <small>{extra}</small>}</div>
      </div>
      <div className="mini-stage">
        <canvas ref={cv} className="mini-canvas" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
        {over && (
          <div className="mini-over">
            <h2>{def.id === 'memory' ? 'ALL PAIRS FOUND!' : 'GAME OVER'}</h2>
            <p>SCORE <b>{score}</b></p>
            {newBest && <p className="mini-nb">★ NEW BEST!</p>}
            <div className="chips"><button className="big" onClick={() => setRun((n) => n + 1)}>↻ PLAY AGAIN</button><button className="big sec" onClick={onBack}>ALL GAMES</button></div>
          </div>
        )}
      </div>
      <small className="mini-hint">{gameRef.current ? gameRef.current.label : ''}</small>
    </div>
  )
}

export default function MiniArcade() {
  const [id, setId] = useState(null)
  const [, bump] = useState(0)
  useEffect(() => { bump((n) => n + 1) }, [id])
  const def = MINI.find((g) => g.id === id)
  if (def) return <MiniPlayer key={def.id} def={def} onBack={() => setId(null)} />
  return (
    <div className="mini-gallery">
      <h2>🕹 MINI GAMES</h2>
      <p>Ten quick games made for short breaks. Tap or click to play. Works on phones and keyboards.</p>
      <div className="mini-grid">
        {MINI.map((g) => (
          <button key={g.id} className="mini-card" onClick={() => { unlockAudio(); sfx('ui'); setId(g.id) }}>
            <span className="mini-ico">{g.icon}</span>
            <b>{g.name}</b>
            <small>{g.desc}</small>
            <em>BEST {best(g.id)}</em>
          </button>
        ))}
      </div>
    </div>
  )
}
