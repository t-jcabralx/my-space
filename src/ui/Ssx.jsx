'use client'
// Lobby and HUD for SNOW RUSH (the SSX-style snowboarding game).
import { useState, useSyncExternalStore } from 'react'
import { subscribeSsx, getSsxSnap, ssxActions, COURSES, RIDERS } from '../game/ssx.js'
import { useTouchPrimary } from './platform.js'

const fmt = (n) => Math.floor(n || 0).toLocaleString()
const clock = (t) => { t = Math.max(0, t || 0); const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1) }
const ord = (n) => n + (['TH', 'ST', 'ND', 'RD'][n % 10 > 3 || (n % 100 >= 11 && n % 100 <= 13) ? 0 : n % 10] || 'TH')
const Bar = ({ v, c }) => <i className="sxbar"><b style={{ width: Math.round(v * 100) + '%', background: c }} /></i>

export function SsxLobby({ s, TopPlayers, onInvite }) {
  const [ci, setCi] = useState(s.profile.ssxCourse | 0), [kind, setKind] = useState(s.profile.ssxKind || 'race'), [rid, setRid] = useState(s.profile.ssxPick | 0)
  const pick = (o) => { if (o.course !== undefined) setCi(o.course); if (o.kind) setKind(o.kind); if (o.rider !== undefined) setRid(o.rider); ssxActions.setPrefs(o) }
  const p = s.profile, times = p.ssxTimes || {}
  const R = RIDERS[rid]
  return (
    <div className="lobby"><div className="lobbyL">
      <div className="lobbyinfo"><b>SNOW RUSH</b> · Race five riders down the mountain, or go for the biggest trick score. Hit the kickers, grind the rails, fill your boost with tricks and land clean. Wipe out and you lose the combo.</div>
      <div className="sxrow">
        <button className={'mg-btn ' + (kind === 'race' ? 'on' : '')} onClick={() => pick({ kind: 'race' })}>🏁 RACE</button>
        <button className={'mg-btn ' + (kind === 'trick' ? 'on' : '')} onClick={() => pick({ kind: 'trick' })}>⭐ TRICK ATTACK · 90s</button>
      </div>
      <div className="sxcourses">
        {COURSES.map((c, i) => (
          <button key={c.id} className={'sxcourse ' + c.id + (ci === i ? ' sel' : '')} onClick={() => pick({ course: i })}>
            <b>{c.name}</b><small>{c.sub}</small>
            {times[c.id] ? <em>BEST {clock(times[c.id])}</em> : <em>NO TIME YET</em>}
          </button>
        ))}
      </div>
      <div className="sxriders">
        {RIDERS.map((r) => (
          <button key={r.id} className={'sxrider ' + (rid === r.id ? 'sel' : '')} onClick={() => pick({ rider: r.id })} style={{ '--c': r.jacket }}>
            <span className="sxface" style={{ background: r.jacket }}>🏂</span><b>{r.name}</b>
          </button>
        ))}
      </div>
      <div className="sxstats"><b>{R.name}</b> <small>{R.bio}</small>
        <div><span>SPEED</span><Bar v={(R.spd - 0.9) / 0.2} c="#ff8a2a" /></div>
        <div><span>TRICKS</span><Bar v={(R.trk - 0.85) / 0.4} c="#ff4a8a" /></div>
        <div><span>BALANCE</span><Bar v={(R.bal - 0.85) / 0.4} c="#6aff9a" /></div>
      </div>
      <div className="chips"><button className="big" onClick={() => ssxActions.start({ course: ci, kind, rider: rid })}>▶ DROP IN</button>{onInvite && <button className="big sec" onClick={onInvite}>🌐 RACE FRIENDS ONLINE</button>}</div>
    </div><div className="lobbyR">
      <div className="panel"><h4>MY SNOW RUSH STATS</h4><div className="kv"><span>RUNS</span><b>{p.ssxGames || 0}</b><span>WINS</span><b>{p.ssxWins || 0}</b><span>BEST SCORE</span><b>{fmt(p.ssxBest)}</b><span>BEST TRICK</span><b>{fmt(p.ssxTrick)}</b></div></div>
      <TopPlayers s={s} initial="ssx" compact fixed />
    </div></div>
  )
}

function Pad({ name, children, cls }) {
  const on = (v) => (e) => { e.stopPropagation(); e.preventDefault(); ssxActions.press(name, v) }
  return <button className={'sxpad ' + (cls || '')} onPointerDown={on(true)} onPointerUp={on(false)} onPointerCancel={on(false)} onPointerLeave={on(false)} onContextMenu={(e) => e.preventDefault()}>{children}</button>
}

export function SsxHUD({ openHelp }) {
  const g = useSyncExternalStore(subscribeSsx, getSsxSnap)
  const touch = useTouchPrimary()
  if (!g || g.mode === 'idle' || !g.course) return null
  const race = g.kind === 'race'
  return (
    <div className="hud mg-hud sxhud">
      <div className="mg-topbar">
        {race ? <span>POS <b>{g.place}/{g.total}</b></span> : <span>TIME <b>{Math.ceil(g.timeLeft)}s</b></span>}
        {race && <span>TIME <b>{clock(g.time)}</b></span>}
        <span>SCORE <b>{fmt(g.score)}</b></span>
        <span className="grow" />
        {g.mode !== 'over' && <button className="mg-btn" onClick={() => ssxActions.pause()}>⏸</button>}
      </div>
      {g.online && g.board && <div className="sxboard">{g.board.map((b, i) => <div key={i} className={b.n === 'YOU' ? 'me' : ''}><i style={{ background: b.c }} />{i + 1}. {b.n}<em>{g.kind === 'trick' ? fmt(b.sc) : b.f !== null && b.f >= 0 ? clock(b.f) : b.z + 'm'}</em></div>)}</div>}
      {race && <div className="sxprog">{g.prog.map((r, i) => <i key={i} className={r.me ? 'me' : ''} style={{ left: (r.p * 100) + '%', background: r.c }} />)}<u /></div>}
      {!race && <div className="sxprog"><u /><i className="me" style={{ left: (g.pct * 100) + '%', background: '#fff' }} /></div>}
      <div className="sxspeed"><b>{g.speed}</b><small>KM/H</small></div>
      <div className={'sxboost' + (g.tricky ? ' tricky' : '') + (g.boosting ? ' fire' : '')}><span>{g.tricky ? 'TRICKY ' + g.tricky + 's' : 'BOOST'}</span><i><b style={{ width: (g.tricky ? 100 : g.boost) + '%' }} /></i></div>
      {g.text && <div className={'sxtrick' + (g.text.bad ? ' bad' : '')} style={{ '--c': g.text.c }}><b>{g.text.text}</b>{g.text.pts > 0 && <em>+{fmt(g.text.pts)}</em>}</div>}
      {g.msg && <div className="mg-banner" style={{ '--c': g.msg.c }}><h2>{g.msg.text}</h2></div>}
      {g.mode === 'ready' && g.count > 0 && <div className="sxcount">{g.count}</div>}
      {g.online && g.mode === 'finish' && <div className="mg-hint">WAITING FOR THE OTHER RIDERS…</div>}
      {g.mode === 'play' && g.time < 6 && !touch && <div className="mg-hint">← → STEER · SPACE HOLD+RELEASE JUMP · IN AIR: ← → SPIN, ↑ ↓ FLIP, J / K GRAB · SHIFT BOOST</div>}
      {touch && g.mode !== 'over' && !g.paused && (
        <>
          <div className="sxdpad"><Pad name="left">◀</Pad><div className="sxv"><Pad name="up">▲</Pad><Pad name="down">▼</Pad></div><Pad name="right">▶</Pad></div>
          <div className="sxacts"><Pad name="jump" cls="a">JUMP</Pad><Pad name="grab" cls="b">GRAB</Pad><Pad name="grab2" cls="c">GRAB 2</Pad><Pad name="boost" cls="d">BOOST</Pad></div>
        </>
      )}
      {g.paused && <div className="screen pause"><h1>PAUSED</h1><button className="big" onClick={ssxActions.resume}>RESUME</button><button className="big sec" onClick={() => openHelp('ssx')}>❓ HOW TO PLAY</button><button className="big sec" onClick={ssxActions.rematch}>↻ RESTART</button><button className="big sec" onClick={ssxActions.quit}>DASHBOARD</button></div>}
      {g.mode === 'over' && g.over && (
        <div className="screen victory">
          <h1 className={g.over.win ? 'gold' : 'red'}>{g.over.kind === 'race' ? (g.over.place === 1 ? 'YOU WIN!' : ord(g.over.place) + ' PLACE') : 'TRICK ATTACK DONE'}</h1>
          <ul>
            <li><span>COURSE</span><b>{g.over.course}</b></li>
            {g.over.kind === 'race' && <li><span>TIME</span><b>{clock(g.over.time)}{g.over.bestTime ? ' · NEW BEST' : ''}</b></li>}
            <li><span>TRICK POINTS</span><b>{fmt(g.over.tricks)}</b></li>
            <li><span>BEST TRICK</span><b>{fmt(g.over.bestTrick)}</b></li>
            <li><span>COINS</span><b>{g.over.toks}</b></li>
            {g.over.kind === 'race' && <li><span>PLACE BONUS</span><b>+{fmt(g.over.placePts)}</b></li>}
            {g.over.kind === 'race' && <li><span>TIME BONUS</span><b>+{fmt(g.over.timeBonus)}</b></li>}
            <li><span>WIPEOUTS</span><b>{g.over.crashes}</b></li>
            <li><span>TOTAL SCORE</span><b>{fmt(g.over.total)}{g.over.newBest ? ' · NEW BEST' : ''}</b></li>
          </ul>
          <button className="big" onClick={ssxActions.rematch}>↻ AGAIN</button><button className="big sec" onClick={ssxActions.quit}>DASHBOARD</button>
        </div>
      )}
    </div>
  )
}
