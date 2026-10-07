'use client'
// Lobby and HUD for GIRDER GORILLA.
import { useState, useSyncExternalStore } from 'react'
import { subscribeKong, getKongSnap, kongActions, LEVELS, SIZES } from '../game/kong.js'
import { PauseScreen } from './MoreGames2.jsx'
import { useTouchPrimary } from './platform.js'

const fmt = (n) => Math.floor(n || 0).toLocaleString()

export function KongLobby({ s, TopPlayers, onInvite }) {
  const p = s.profile, unlocked = Math.min(LEVELS.length - 1, p.kongLevel || 0)
  const [size, setSize] = useState(SIZES.includes(p.kongSize) ? p.kongSize : 4)
  return (
    <div className="lobby"><div className="lobbyL">
      <div className="lobbyinfo"><b>GIRDER GORILLA</b> · Climb the steel girders of a building site. Giant gorillas roll barrels down the slopes: jump them, grab a hammer to smash them, take the ladders up and rescue the captive at the top. The girders can be made much <b>wider</b>: more ladders, more gorillas, and a minimap to find your way. Play alone, with a friend on the same keyboard, or online.</div>
      <h4>GIRDER WIDTH <small className="dim">(x{size} = {size * 60} m of steel per floor)</small></h4>
      <div className="chips">{SIZES.map((v) => <button key={v} className={'chip ' + (size === v ? 'sel' : '')} onClick={() => { setSize(v); kongActions.setSize(v) }}>{v === 1 ? 'x1 CLASSIC' : v === 20 ? 'x20 MEGA' : 'x' + v}</button>)}</div>
      <h4>PICK A SITE</h4>
      <div className="orblevels">
        {LEVELS.map((l, i) => (
          <button key={l.name} className={'orblevel' + (i > unlocked ? ' locked' : '')} disabled={i > unlocked} style={{ '--c': '#ff8a2a' }} onClick={() => kongActions.start({ level: i, size })}>
            <b>{i + 1}</b><small>{i > unlocked ? '🔒' : l.name}</small>
          </button>
        ))}
      </div>
      <div className="chips">
        <button className="big" onClick={() => kongActions.start({ level: unlocked, size })}>🦍 CLIMB · SITE {unlocked + 1}</button>
        <button className="big sec" onClick={() => kongActions.start({ level: unlocked, size, two: true })}>👥 2 PLAYERS (SAME KEYBOARD)</button>
        <button className="big sec" onClick={onInvite}>🌐 CLIMB WITH A FRIEND ONLINE</button>
      </div>
      <small className="hint">P1: A D run · W S ladders · SPACE jump · J hammer · P2: arrows run and climb · ENTER jump · , or / hammer</small>
    </div><div className="lobbyR">
      <div className="panel"><h4>MY CLIMBS</h4><div className="kv"><span>RUNS</span><b>{p.kongGames || 0}</b><span>BEST SCORE</span><b>{fmt(p.kongBest)}</b><span>FURTHEST SITE</span><b>{Math.min(LEVELS.length, (p.kongLevel || 0) + 1)}/{LEVELS.length}</b></div></div>
      <TopPlayers s={s} initial="kong" compact fixed />
    </div></div>
  )
}
function Pad({ name, children, cls }) {
  const on = (v) => (e) => { e.stopPropagation(); e.preventDefault(); kongActions.press(name, v) }
  return <button className={'sxpad ' + (cls || '')} onPointerDown={on(true)} onPointerUp={on(false)} onPointerCancel={on(false)} onPointerLeave={on(false)} onContextMenu={(e) => e.preventDefault()}>{children}</button>
}
export function KongHUD({ openHelp }) {
  const g = useSyncExternalStore(subscribeKong, getKongSnap)
  const touch = useTouchPrimary()
  if (!g || g.mode === 'idle') return null
  const m = g.mini
  return (
    <div className="hud mg-hud">
      <div className="mg-topbar">
        <span>🦍 {g.name} ({g.lvl}/{g.lvls})</span><span>FLOOR <b>{g.floor}/{g.floors}</b></span><span>SCORE <b>{fmt(g.score)}</b></span><span>BONUS <b>{fmt(g.timer)}</b></span>
        {g.players.map((p, i) => <span key={i} style={{ color: p.c }}>{p.me && g.online ? 'YOU' : p.n.slice(0, 8)} {p.dead ? '☠' : '♥'.repeat(Math.max(0, p.lives))}{p.ham ? ' 🔨' : ''}</span>)}
        <span className="grow" />{g.mode === 'play' && !g.paused && !g.online && <button className="mg-btn" onClick={() => kongActions.pause()}>⏸</button>}
      </div>
      {m && g.size > 1 && <div className="kmini" style={{ aspectRatio: '4 / 1.6' }}>{m.l.map((q, i) => <u key={'l' + i} style={{ left: q[0] * 100 + '%', top: (1 - q[1]) * 100 + '%' }} />)}{m.b.map((q, i) => <i key={'b' + i} style={{ left: q[0] * 100 + '%', top: (1 - q[1]) * 100 + '%' }} />)}{m.pr && <em style={{ left: m.pr[0] * 100 + '%', top: '3%' }}>♥</em>}{m.p.map((q, i) => <b key={'p' + i} className={q[2] ? 'me' : ''} style={{ left: q[0] * 100 + '%', top: (1 - q[1]) * 100 + '%' }} />)}</div>}
      {g.msg && <div className="mg-banner" style={{ '--c': '#ff8a2a' }}><h2>{g.msg.text}</h2>{g.msg.sub && <p>{g.msg.sub}</p>}</div>}
      {g.mode === 'play' && g.time < 8 && !touch && <div className="mg-hint">W / S ON A LADDER TO CLIMB · SPACE JUMPS THE BARRELS · GRAB A HAMMER TO SMASH THEM</div>}
      {touch && g.mode === 'play' && (
        <>
          <div className="sxdpad"><Pad name="left">◀</Pad><div className="sxv"><Pad name="up">▲</Pad><Pad name="down">▼</Pad></div><Pad name="right">▶</Pad></div>
          <div className="sxacts"><Pad name="jump" cls="a">JUMP</Pad><Pad name="hit" cls="d">HAMMER</Pad></div>
        </>
      )}
      {g.paused && <PauseScreen resume={kongActions.resume} quit={kongActions.quit} help={() => openHelp('kong')} />}
      {g.mode === 'over' && g.over && (
        <div className="screen victory"><h1 className={g.over.win ? 'gold' : 'red'}>{g.over.win ? 'ALL SITES CLEARED!' : 'THE GORILLA WINS THIS ROUND'}</h1>
          <ul><li><span>SCORE</span><b>{fmt(g.over.score)}</b></li><li><span>SITE</span><b>{g.over.level}/{g.lvls}</b></li><li><span>GIRDER WIDTH</span><b>x{g.over.size}</b></li>{g.over.players.map((p, i) => <li key={i}><span>{p.n}</span><b>{fmt(p.s)}</b></li>)}</ul>
          <button className="big" onClick={kongActions.rematch}>↻ AGAIN</button><button className="big sec" onClick={kongActions.quit}>DASHBOARD</button></div>
      )}
    </div>
  )
}
