'use client'
// Lobby and HUD for GARDEN SIEGE (plants vs zombies style lane defence).
import { useState, useSyncExternalStore } from 'react'
import { subscribeGarden, getGardenSnap, gardenActions, LEVELS, PLANTS, ZOMBIES } from '../game/garden.js'
import { Surface, PauseScreen } from './MoreGames2.jsx'

const fmt = (n) => Math.floor(n || 0).toLocaleString()

export function GardenLobby({ s, TopPlayers, onInvite }) {
  const p = s.profile, unlocked = Math.min(LEVELS.length - 1, p.gardenLevel || 0)
  const [lv, setLv] = useState(unlocked)
  return (
    <div className="lobby"><div className="lobbyL">
      <div className="lobbyinfo"><b>GARDEN SIEGE</b> · The zombies are coming down five lanes! Collect <b>sun</b>, plant shooters and blockers, and stop them before they reach your house. Or flip it around and lead the <b>horde</b> with brains. Online, one friend is the garden and the other is the horde.</div>
      <h4>🌱 DEFEND THE GARDEN · 10 LEVELS vs AI ZOMBIES</h4>
      <div className="orblevels">
        {LEVELS.map((l, i) => (
          <button key={l.name} className={'orblevel' + (i > unlocked ? ' locked' : '') + (lv === i ? ' sel' : '')} disabled={i > unlocked} style={{ '--c': '#6aff9a' }} onClick={() => setLv(i)}>
            <b>{i + 1}</b><small>{i > unlocked ? '🔒' : l.name}</small>
          </button>
        ))}
      </div>
      <div className="chips">
        <button className="big" onClick={() => gardenActions.start({ kind: 'plants', level: lv })}>🌱 PLAY LEVEL {lv + 1}</button>
        <button className="big sec" onClick={() => gardenActions.start({ kind: 'zombies', level: 0 })}>🧟 BE THE ZOMBIES vs AI</button>
        <button className="big sec" onClick={onInvite}>🌐 VERSUS A FRIEND</button>
      </div>
      <h4>YOUR PLANTS</h4>
      <div className="gseeds">{Object.entries(PLANTS).map(([k, d]) => <div key={k} className="gseed"><b>{d.icon}</b><span>{d.name}</span><small>{d.cost}☀ · {d.desc}</small></div>)}</div>
      <h4>THE HORDE</h4>
      <div className="gseeds">{Object.entries(ZOMBIES).map(([k, d]) => <div key={k} className="gseed z"><b>{d.icon}</b><span>{d.name}</span><small>{d.cost}🧠 · {d.desc}</small></div>)}</div>
    </div><div className="lobbyR">
      <div className="panel"><h4>MY GARDEN STATS</h4><div className="kv"><span>GAMES</span><b>{p.gardenGames || 0}</b><span>WINS</span><b>{p.gardenWins || 0}</b><span>ZOMBIES DEFEATED</span><b>{fmt(p.gardenKills)}</b><span>BEST SCORE</span><b>{fmt(p.gardenBest)}</b><span>LEVEL REACHED</span><b>{(p.gardenLevel || 0) + 1}/{LEVELS.length}</b></div></div>
      <TopPlayers s={s} initial="garden" compact fixed />
    </div></div>
  )
}

export function GardenHUD({ openHelp }) {
  const g = useSyncExternalStore(subscribeGarden, getGardenSnap)
  if (!g || g.mode === 'idle') return null
  const zombie = g.side === 'zombies'
  const defs = zombie ? ZOMBIES : PLANTS
  const cur = zombie ? g.brain : g.sun
  return (
    <div className="hud mg-hud gardenhud">
      {g.mode === 'play' && !g.paused && <Surface onPtr={(t, x, y) => gardenActions.pointer(t, x, y)} cursor="pointer" />}
      <div className="mg-topbar">
        <span>{zombie ? '🧠' : '☀'} <b>{Math.floor(cur)}</b></span>
        <span>{g.kind === 'plants' ? 'LEVEL ' + g.level : g.kind === 'versus' ? 'VERSUS' + (g.foe ? ' · ' + g.foe : '') : 'HORDE MODE'}</span>
        <span>KILLS <b>{g.kills}</b></span>
        <span>{g.kind === 'plants' ? 'WAVE' : 'SURVIVE'} <b>{g.kind === 'plants' ? Math.round(g.wave * 100) + '%' : g.waveLeft + 's'}</b></span>
        <span className="grow" />
        {!zombie && <button className={'mg-btn' + (g.shovel ? ' on' : '')} onClick={gardenActions.toggleShovel}>⛏ SHOVEL (X)</button>}
        {g.mode === 'play' && !g.paused && !g.online && <button className="mg-btn" onClick={() => gardenActions.pause()}>⏸</button>}
      </div>
      <div className="gwave"><b style={{ width: Math.round(g.wave * 100) + '%' }} /></div>
      <div className="gbar">
        {g.seeds.map((k, i) => {
          const d = defs[k], cd = g.cd[k] || 0, ok = cur >= d.cost
          return (
            <button key={k} className={'gpack' + (g.sel === k ? ' sel' : '') + (ok && cd <= 0 ? '' : ' dim')} onPointerDown={(e) => { e.stopPropagation(); gardenActions.select(k) }}>
              <b>{d.icon}</b><small>{d.cost}{zombie ? '🧠' : '☀'}</small><em>{i + 1}</em>
              {cd > 0 && <i style={{ height: Math.min(100, (cd / d.cd) * 100) + '%' }} />}
            </button>
          )
        })}
      </div>
      {g.mode === 'play' && !g.msg && !g.sel && !g.shovel && g.t < 20 && <div className="mg-hint">{zombie ? 'PICK A ZOMBIE, THEN TAP A LANE · KEYS 1-5' : 'COLLECT THE SUN · PICK A SEED, THEN TAP A LAWN SQUARE · KEYS 1-8 · X SHOVEL'}</div>}
      {g.msg && <div className="mg-banner" style={{ '--c': '#6aff9a' }}><h2>{g.msg.text}</h2>{g.msg.sub && <p>{g.msg.sub}</p>}</div>}
      {g.paused && <PauseScreen resume={gardenActions.resume} quit={gardenActions.quit} help={() => openHelp('garden')} />}
      {g.mode === 'over' && g.over && (
        <div className="screen victory">
          <h1 className={g.over.win ? 'gold' : 'red'}>{g.over.forfeit ? 'YOU WIN! (rival left)' : g.over.win ? (g.over.side === 'plants' ? 'THE GARDEN HOLDS!' : 'BRAAAINS! THE HORDE WINS!') : (g.over.side === 'plants' ? 'THE ZOMBIES ATE YOUR BRAINS' : 'THE GARDEN HELD')}</h1>
          <ul><li><span>SCORE</span><b>{fmt(g.over.score)}</b></li><li><span>ZOMBIES DEFEATED</span><b>{g.over.kills}</b></li><li><span>PLANTS GROWN</span><b>{g.over.planted}</b></li><li><span>TIME</span><b>{Math.floor(g.over.time)}s</b></li>{g.over.bonus > 0 && <li><span>BONUS</span><b>+{fmt(g.over.bonus)}</b></li>}</ul>
          <button className="big" onClick={gardenActions.rematch}>{g.over.kind === 'plants' && g.over.win ? '▶ NEXT LEVEL' : '↻ AGAIN'}</button><button className="big sec" onClick={gardenActions.quit}>DASHBOARD</button>
        </div>
      )}
    </div>
  )
}
