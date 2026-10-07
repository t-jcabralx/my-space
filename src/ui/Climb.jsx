'use client'
// Lobby and HUD for FROST CLIMBERS.
import { useState, useSyncExternalStore } from 'react'
import { subscribeClimb, getClimbSnap, climbActions, MOUNTAINS, SIZES } from '../game/climb.js'
import { PauseScreen } from './MoreGames2.jsx'
import { useTouchPrimary } from './platform.js'

const fmt = (n) => Math.floor(n || 0).toLocaleString()
const clock = (t) => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0')

export function ClimbLobby({ s, TopPlayers, onInvite }) {
  const p = s.profile, unlocked = Math.min(MOUNTAINS.length - 1, p.climbLevel || 0)
  const [size, setSize] = useState(SIZES.includes(p.climbSize) ? p.climbSize : 1)
  return (
    <div className="lobby"><div className="lobbyL">
      <div className="lobbyinfo"><b>FROST CLIMBERS</b> · Climb eight icy mountains, up to x20 wide (1,200 m of ice per floor). Jump up into the ice above you to smash a hole, climb through it, whack yetis and birds with your hammer, dodge icicles and reach the summit before you fall off the bottom of the screen. The ice is slippery! Play alone, with a friend on the same keyboard, or online.</div>
      <h4>MOUNTAIN WIDTH <small className="dim">(x{size} = {size * 60} m of ice per floor)</small></h4>
      <div className="chips">{SIZES.map((v) => <button key={v} className={'chip ' + (size === v ? 'sel' : '')} onClick={() => { setSize(v); climbActions.setSize(v) }}>{v === 1 ? 'x1 CLASSIC' : v === 20 ? 'x20 MEGA' : 'x' + v}</button>)}</div>
      <h4>PICK A MOUNTAIN</h4>
      <div className="orblevels">
        {MOUNTAINS.map((m, i) => (
          <button key={m.name} className={'orblevel' + (i > unlocked ? ' locked' : '')} disabled={i > unlocked} style={{ '--c': '#9fd8ff' }} onClick={() => climbActions.start({ level: i, size })}>
            <b>{i + 1}</b><small>{i > unlocked ? '🔒' : m.name}</small>
          </button>
        ))}
      </div>
      <div className="chips">
        <button className="big" onClick={() => climbActions.start({ level: unlocked, size })}>🧗 CLIMB · MOUNTAIN {unlocked + 1}</button>
        <button className="big sec" onClick={() => climbActions.start({ level: unlocked, size, two: true })}>👥 2 PLAYERS (SAME KEYBOARD)</button>
        <button className="big sec" onClick={onInvite}>🌐 CLIMB WITH A FRIEND ONLINE</button>
      </div>
      <small className="hint">P1: A D move · W / SPACE jump · J hammer · P2: ← → move · ↑ jump · , or / hammer</small>
    </div><div className="lobbyR">
      <div className="panel"><h4>MY CLIMBING</h4><div className="kv"><span>RUNS</span><b>{p.climbGames || 0}</b><span>BEST SCORE</span><b>{fmt(p.climbBest)}</b><span>HIGHEST MOUNTAIN</span><b>{Math.min(MOUNTAINS.length, (p.climbLevel || 0) + 1)}/{MOUNTAINS.length}</b></div></div>
      <TopPlayers s={s} initial="climb" compact fixed />
    </div></div>
  )
}
function Pad({ name, children, cls }) {
  const on = (v) => (e) => { e.stopPropagation(); e.preventDefault(); climbActions.press(name, v) }
  return <button className={'sxpad ' + (cls || '')} onPointerDown={on(true)} onPointerUp={on(false)} onPointerCancel={on(false)} onPointerLeave={on(false)} onContextMenu={(e) => e.preventDefault()}>{children}</button>
}
export function ClimbHUD({ openHelp }) {
  const g = useSyncExternalStore(subscribeClimb, getClimbSnap)
  const touch = useTouchPrimary()
  if (!g || g.mode === 'idle') return null
  return (
    <div className="hud mg-hud">
      <div className="mg-topbar">
        <span>🏔 {g.name} ({g.lvl}/{g.lvls})</span><span>FLOOR <b>{g.floor}/{g.floors}</b></span>{g.size > 1 && <span>WIDTH <b>x{g.size}</b></span>}<span>SCORE <b>{fmt(g.score)}</b></span>
        {g.players.map((p, i) => <span key={i} style={{ color: p.c }}>{p.me && g.online ? 'YOU' : p.n.slice(0, 8)} {p.dead && p.lives <= 0 ? '☠' : (p.lives > 6 ? '♥×' + p.lives : '♥'.repeat(Math.max(0, p.lives)))}</span>)}
        <span className="grow" />{g.env && <span className="dim">{g.night > 0.5 ? '🌙' : '☀'} {g.env}</span>}
        {g.mode === 'play' && !g.paused && !g.online && <button className="mg-btn" onClick={() => climbActions.pause()}>⏸</button>}
      </div>
      {g.msg && <div className="mg-banner" style={{ '--c': '#9fd8ff' }}><h2>{g.msg.text}</h2>{g.msg.sub && <p>{g.msg.sub}</p>}</div>}
      {g.mode === 'play' && g.time < 8 && !touch && <div className="mg-hint">JUMP UP INTO THE ICE TO BREAK IT · J = HAMMER · THE ICE IS SLIPPERY</div>}
      {touch && g.mode === 'play' && (
        <>
          <div className="sxdpad"><Pad name="left">◀</Pad><Pad name="right">▶</Pad></div>
          <div className="sxacts"><Pad name="jump" cls="a">JUMP</Pad><Pad name="hit" cls="d">HAMMER</Pad></div>
        </>
      )}
      {g.paused && <PauseScreen resume={climbActions.resume} quit={climbActions.quit} help={() => openHelp('climb')} />}
      {g.mode === 'over' && g.over && (
        <div className="screen victory"><h1 className={g.over.win ? 'gold' : 'red'}>{g.over.win ? 'ALL SUMMITS CLIMBED!' : 'YOU FELL OFF THE MOUNTAIN'}</h1>
          <ul><li><span>SCORE</span><b>{fmt(g.over.score)}</b></li><li><span>MOUNTAIN</span><b>{g.over.level}/{g.lvls}</b></li><li><span>MOUNTAIN WIDTH</span><b>x{g.over.size}</b></li><li><span>VEGETABLES</span><b>{g.over.got}</b></li>{g.over.players.map((p, i) => <li key={i}><span>{p.n}</span><b>{fmt(p.s)}</b></li>)}<li><span>TIME</span><b>{clock(g.time)}</b></li></ul>
          <button className="big" onClick={climbActions.rematch}>↻ AGAIN</button><button className="big sec" onClick={climbActions.quit}>DASHBOARD</button></div>
      )}
    </div>
  )
}
