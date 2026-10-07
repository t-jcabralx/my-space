'use client'
// Lobby and HUD for GIRDER GORILLA.
import { useState, useSyncExternalStore } from 'react'
import { subscribeKong, getKongSnap, kongActions, LEVELS, SIZES } from '../game/kong.js'
import { PauseScreen } from './MoreGames2.jsx'
import { useTouchPrimary } from './platform.js'

const fmt = (n) => Math.floor(n || 0).toLocaleString()

// the Girder Gorilla emblem: night skyline, red girders and ladders, a big gorilla with a barrel, and a little climber
export function KongLogo({ className = 'klogo' }) {
  return (
    <svg className={className} viewBox="0 0 240 140" role="img" aria-label="Girder Gorilla">
      <defs>
        <linearGradient id="kgSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0a0e2a" /><stop offset="1" stopColor="#3a1a4a" /></linearGradient>
        <linearGradient id="kgGirder" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ff6a4a" /><stop offset="1" stopColor="#a8241a" /></linearGradient>
        <radialGradient id="kgFur" cx=".5" cy=".35" r=".8"><stop offset="0" stopColor="#7a5238" /><stop offset="1" stopColor="#3a2416" /></radialGradient>
      </defs>
      <rect width="240" height="140" fill="url(#kgSky)" />
      <g fill="#ffd98a" opacity=".85"><circle cx="30" cy="18" r="1.4" /><circle cx="70" cy="30" r="1" /><circle cx="205" cy="16" r="1.4" /><circle cx="170" cy="34" r="1" /><circle cx="120" cy="12" r="1" /></g>
      <g fill="#14183a"><rect x="6" y="70" width="26" height="70" /><rect x="34" y="88" width="20" height="52" /><rect x="190" y="64" width="30" height="76" /><rect x="222" y="90" width="18" height="50" /></g>
      <g fill="#ffd23a" opacity=".8"><rect x="11" y="78" width="4" height="5" /><rect x="20" y="90" width="4" height="5" /><rect x="196" y="74" width="4" height="5" /><rect x="208" y="88" width="4" height="5" /></g>
      <g stroke="#e8e0d0" strokeWidth="2.2" fill="none"><path d="M74 62v32M86 62v32M74 68h12M74 76h12M74 84h12M74 92h12" /><path d="M168 98v32M180 98v32M168 104h12M168 112h12M168 120h12M168 128h12" /></g>
      <g fill="url(#kgGirder)" stroke="#5a0f0a" strokeWidth="1.2">
        <path d="M0 64 L240 56 L240 68 L0 76 Z" /><path d="M0 104 L240 112 L240 124 L0 116 Z" />
      </g>
      <g stroke="#5a0f0a" strokeWidth="1" opacity=".7"><path d="M20 63l8 12M44 62l8 12M68 61l8 12M92 60l8 12M116 59l8 12M140 59l8 11M164 58l8 11M188 57l8 11M212 56l8 11" /><path d="M20 105l8 12M60 107l8 12M100 108l8 12M140 110l8 12M180 111l8 12M220 112l8 12" /></g>
      <g transform="translate(120 4)">
        <path d="M-10 46c-16-2-26-16-24-30 2-14 14-20 34-20s32 6 34 20c2 14-8 28-24 30z" fill="url(#kgFur)" stroke="#1c1008" strokeWidth="2" />
        <ellipse cx="0" cy="26" rx="18" ry="15" fill="#d8a878" stroke="#1c1008" strokeWidth="1.5" />
        <path d="M-17 11q9 6 17 3q8 3 17-3l-2 8q-8 3-15 0q-7 3-15 0z" fill="#2a1a10" />
        <circle cx="-8" cy="19" r="3.2" fill="#fff" /><circle cx="8" cy="19" r="3.2" fill="#fff" /><circle cx="-7.2" cy="19.6" r="1.7" fill="#200" /><circle cx="8.8" cy="19.6" r="1.7" fill="#200" />
        <ellipse cx="-3" cy="27" rx="1.6" ry="2.4" fill="#4a2a18" /><ellipse cx="3" cy="27" rx="1.6" ry="2.4" fill="#4a2a18" />
        <path d="M-9 34q9 6 18 0" fill="none" stroke="#3a1a10" strokeWidth="2" strokeLinecap="round" /><path d="M-6 34l2 3l2-3M2 34l2 3l2-3" fill="#fff" />
        <circle cx="-26" cy="38" r="9" fill="url(#kgFur)" stroke="#1c1008" strokeWidth="1.6" /><circle cx="26" cy="38" r="9" fill="url(#kgFur)" stroke="#1c1008" strokeWidth="1.6" />
      </g>
      <g transform="translate(176 40) rotate(-14)"><rect x="-12" y="-10" width="24" height="22" rx="5" fill="#d8782a" stroke="#4a2008" strokeWidth="1.6" /><path d="M-12 -3h24M-12 6h24" stroke="#4a2008" strokeWidth="2" /><path d="M-5 -10v22M5 -10v22" stroke="#e8a050" strokeWidth="1" opacity=".6" /></g>
      <g transform="translate(40 92)"><rect x="-4" y="-16" width="8" height="12" rx="2" fill="#3d9bff" /><circle cx="0" cy="-22" r="5" fill="#ffd0a0" /><path d="M-5 -24h10v-3h-10z" fill="#ffd23a" /><rect x="-4" y="-5" width="3" height="6" fill="#222" /><rect x="1" y="-5" width="3" height="6" fill="#222" /><rect x="5" y="-18" width="4" height="9" fill="#9a9aa8" transform="rotate(30 5 -18)" /></g>
    </svg>
  )
}

export function KongLobby({ s, TopPlayers, onInvite }) {
  const p = s.profile, unlocked = Math.min(LEVELS.length - 1, p.kongLevel || 0)
  const [size, setSize] = useState(SIZES.includes(p.kongSize) ? p.kongSize : 4)
  return (
    <div className="lobby"><div className="lobbyL">
      <KongLogo className="klogo wide" />
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
        <span className="kchip site"><small>SITE {g.lvl}/{g.lvls}</small><b>{g.name}</b></span>
        <span className="kchip"><small>FLOOR</small><b>{g.floor}/{g.floors}</b></span>
        <span className="kchip"><small>SCORE</small><b>{fmt(g.score)}</b></span>
        <span className="kchip bonus"><small>BONUS</small><b>{fmt(g.timer)}</b><u style={{ width: Math.max(0, Math.min(100, g.timer / (5000 + g.size * 200) * 100)) + '%' }} /></span>
        {g.players.map((p, i) => <span key={i} className={'kchip pl' + (p.dead ? ' dead' : '')} style={{ '--pc': p.c }}><small>{p.me && g.online ? 'YOU' : p.n.slice(0, 8)}{p.ham ? ' 🔨' : ''}</small><b>{p.dead ? '☠' : '♥'.repeat(Math.max(0, p.lives))}</b></span>)}
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
