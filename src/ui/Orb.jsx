'use client'
// Lobby and HUD for ORB RUSH (the marble-shooter).
import { useSyncExternalStore } from 'react'
import { subscribeOrb, getOrbSnap, orbActions, LEVELS, COLORS } from '../game/orb.js'
import { Surface, PauseScreen } from './MoreGames2.jsx'
import { useTouchPrimary } from './platform.js'

const fmt = (n) => Math.floor(n || 0).toLocaleString()

export function OrbLobby({ s, TopPlayers, onInvite }) {
  const p = s.profile, unlocked = Math.min(LEVELS.length - 1, p.orbLevel || 0)
  return (
    <div className="lobby"><div className="lobbyL">
      <div className="lobbyinfo"><b>ORB RUSH</b> · A chain of orbs rolls toward the skull hole. Aim with the mouse (or ← →), click / SPACE to shoot, Q swaps your orbs. Match 3 or more of a colour to pop them; a chain reaction scores big. Hidden power orbs: slow, freeze, reverse and bomb. Play <b>online versus</b>: your big combos send extra orbs to your rival!</div>
      <h4>ADVENTURE · PICK A LEVEL</h4>
      <div className="orblevels">
        {LEVELS.map((l, i) => (
          <button key={l.name} className={'orblevel' + (i > unlocked ? ' locked' : '')} disabled={i > unlocked} style={{ '--c': l.tint }} onClick={() => orbActions.start({ level: i })}>
            <b>{i + 1}</b><small>{i > unlocked ? '🔒' : l.name}</small>
          </button>
        ))}
      </div>
      <div className="chips"><button className="big" onClick={() => orbActions.start({ level: unlocked })}>▶ CONTINUE · LEVEL {unlocked + 1}</button><button className="big sec" onClick={onInvite}>🌐 VERSUS A FRIEND</button></div>
    </div><div className="lobbyR">
      <div className="panel"><h4>MY ORB RUSH STATS</h4><div className="kv"><span>RUNS</span><b>{p.orbGames || 0}</b><span>VERSUS WINS</span><b>{p.orbWins || 0}</b><span>BEST SCORE</span><b>{fmt(p.orbBest)}</b><span>LEVEL REACHED</span><b>{(p.orbLevel || 0) + 1}/{LEVELS.length}</b></div></div>
      <TopPlayers s={s} initial="orb" compact fixed />
    </div></div>
  )
}

export function OrbHUD({ openHelp }) {
  const g = useSyncExternalStore(subscribeOrb, getOrbSnap)
  const touch = useTouchPrimary()
  if (!g || g.mode === 'idle') return null
  const ball = (c) => <i className="orbdot" style={{ background: COLORS[c], boxShadow: '0 0 10px ' + COLORS[c] }} />
  return (
    <div className="hud mg-hud orbhud">
      {g.mode === 'play' && !g.paused && <Surface onPtr={(t, x, y) => orbActions.pointerScreen(t, x, y)} cursor="crosshair" />}
      <div className="mg-topbar">
        <span>SCORE <b>{fmt(g.score)}</b></span>
        <span>{g.kind === 'versus' ? 'VERSUS' : 'LEVEL'} <b>{g.kind === 'versus' ? g.level : g.level + '/' + g.levels}</b></span>
        {g.kind === 'solo' && <span className="hearts">{Array.from({ length: Math.max(0, g.lives) }).map((_, i) => <i key={i} className="on">♥</i>)}</span>}
        <span>LEFT <b>{g.left}</b></span>
        <span className="dim">{g.slow ? 'SLOW ' : ''}{g.stop ? 'FREEZE ' : ''}{g.back ? 'REVERSE' : ''}</span>
        <span className="grow" />
        {g.mode === 'play' && !g.paused && g.kind === 'solo' && <button className="mg-btn" onClick={() => orbActions.pause()}>⏸</button>}
      </div>
      <div className={'orbdanger' + (g.danger > 0.8 ? ' hot' : '')}><b style={{ width: Math.min(100, g.danger * 100) + '%' }} /></div>
      {g.foe && <div className="orbfoe"><b>{g.foe.name}</b><i><u style={{ width: Math.min(100, g.foe.p * 100) + '%' }} /></i><small>{g.foe.left} left · {fmt(g.foe.score)}</small></div>}
      <div className="orbnext"><small>NEXT</small>{ball(g.cur)}{ball(g.next)}<button className="mg-btn" onPointerDown={(e) => { e.stopPropagation(); orbActions.swap() }}>⇄ Q</button></div>
      {g.combo > 1 && <div className="orbcombo">COMBO x{g.combo}</div>}
      {g.msg && <div className="mg-banner" style={{ '--c': '#6aff9a' }}><h2>{g.msg.text}</h2>{g.msg.sub && <p>{g.msg.sub}</p>}</div>}
      {touch && g.mode === 'play' && <div className="mg-hint">TAP TO AIM AND SHOOT</div>}
      {g.paused && <PauseScreen resume={orbActions.resume} quit={orbActions.quit} help={() => openHelp('orb')} />}
      {g.mode === 'over' && g.over && (
        <div className="screen victory"><h1 className={g.over.win ? 'gold' : 'red'}>{g.over.kind === 'versus' ? (g.over.win ? 'YOU WIN!' : 'YOU LOST') : g.over.win ? 'ALL CLEARED!' : 'GAME OVER'}</h1>
          {g.over.reason && <p>{g.over.reason}</p>}
          <ul><li><span>SCORE</span><b>{fmt(g.over.score)}</b></li><li><span>LEVEL</span><b>{g.over.level}</b></li><li><span>MATCHES</span><b>{g.over.matches}</b></li><li><span>BEST COMBO</span><b>x{g.over.bestCombo}</b></li><li><span>ACCURACY</span><b>{g.over.acc}%</b></li></ul>
          <button className="big" onClick={orbActions.rematch}>↻ AGAIN</button><button className="big sec" onClick={orbActions.quit}>DASHBOARD</button></div>
      )}
    </div>
  )
}
