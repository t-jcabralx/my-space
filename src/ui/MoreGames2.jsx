'use client'
// Lobbies and HUDs for: Connect Four, Neon Snake, Neon Breaker and Mine Sweep.
import { useRef, useState, useSyncExternalStore } from 'react'
import { subscribeC4, getC4Snap, c4Actions } from '../game/connect4.js'
import { subscribeSnake, getSnakeSnap, snakeActions } from '../game/snake.js'
import { subscribeBreaker, getBreakerSnap, breakerActions } from '../game/breaker.js'
import { subscribeMines, getMinesSnap, minesActions, LV } from '../game/mines.js'
import { useTouchPrimary } from './platform.js'

const fmt = (n) => Math.floor(n).toLocaleString()
const Stat = ({ k, v }) => <><span>{k}</span><b>{v}</b></>
function Surface({ onPtr, cursor }) {
  const ref = useRef()
  const w = (e) => { const r = ref.current.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * 100 - 50, 28 - ((e.clientY - r.top) / r.height) * 56] }
  return <div ref={ref} className="mg-surface" style={{ cursor: cursor || 'crosshair' }} onPointerDown={(e) => { e.stopPropagation(); try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* ignore */ } onPtr('down', ...w(e)) }} onPointerMove={(e) => onPtr('move', ...w(e))} onPointerUp={(e) => onPtr('up', ...w(e))} onPointerCancel={(e) => onPtr('up', ...w(e))} />
}
const PauseScreen = ({ resume, quit, help }) => <div className="screen pause"><h1>PAUSED</h1><button className="big" onClick={resume}>RESUME</button>{help && <button className="big sec" onClick={help}>❓ HOW TO PLAY</button>}<button className="big sec" onClick={quit}>QUIT TO DASHBOARD</button></div>

// ---------- CONNECT FOUR ----------
export function C4Lobby({ s, TopPlayers, onInvite }) {
  const [type, setType] = useState('bot'), [diff, setDiff] = useState(2)
  const p = s.profile
  return (
    <div className="lobby"><div className="lobbyL">
      <h4>1 · CHOOSE A MODE</h4>
      <div className="modegrid">{[['bot', '🤖', 'VS BOT', 'Three levels. The hard bot looks six moves ahead.'], ['2p', '👥', '2 PLAYERS', 'Pass the mouse, or tap in turns.']].map(([k, ico, n, d]) => <button key={k} className={'modecard ' + (type === k ? 'sel' : '')} onClick={() => setType(k)}><div className="vs"><span>{ico}</span></div><strong>{n}</strong><small>{d}</small></button>)}</div>
      {type === 'bot' && <div className="lobbyopts"><div><h4>BOT LEVEL</h4><div className="chips">{[[1, 'EASY'], [2, 'MEDIUM'], [3, 'HARD']].map(([v, n]) => <button key={v} className={'chip ' + (diff === v ? 'sel' : '')} onClick={() => setDiff(v)}>{n}</button>)}</div></div></div>}
      <div className="lobbyinfo"><b>CONNECT FOUR</b> · Drop discs into the grid. Four in a row (across, up or diagonal) wins. Click a column, or press <b>1-7</b>.</div>
      <div className="chips"><button className="big" onClick={() => c4Actions.start({ type, diff })}>▶ START</button><button className="big sec" onClick={onInvite}>🌐 INVITE FRIEND</button></div>
    </div><div className="lobbyR">
      <div className="panel"><h4>MY CONNECT FOUR STATS</h4><div className="kv"><Stat k="GAMES" v={p.c4Games || 0} /><Stat k="WINS" v={p.c4Wins || 0} /></div></div>
      <TopPlayers s={s} initial="c4" compact fixed />
    </div></div>
  )
}
export function C4UI() {
  const g = useSyncExternalStore(subscribeC4, getC4Snap)
  const [hover, setHover] = useState(-1)
  if (!g || g.mode === 'idle') return null
  const myTurn = g.type === 'bot' ? g.turn === 1 : g.type === 'online' ? g.turn === g.my : true
  const inLine = (r, c) => g.line && g.line.some(([a, b]) => a === r && b === c)
  const status = g.win ? (g.win === 3 ? 'DRAW' : g.names[g.win - 1] + ' WINS') : g.thinking ? 'BOT IS THINKING…' : (g.turn === 1 ? g.names[0] : g.names[1]) + (myTurn && g.type !== '2p' ? ' · YOUR TURN' : "'S TURN")
  return (
    <div className="screen menu mg-dom">
      <div className="mg-domhead"><button className="mg-btn" onClick={c4Actions.quit}>◀ DASHBOARD</button><h2>CONNECT FOUR <small>{g.type === 'bot' ? 'VS BOT' : g.type === 'online' ? 'ONLINE' : '2 PLAYERS'}</small></h2><span className="grow" /></div>
      <div className={'c4turn t' + g.turn}>{status}</div>
      <div className="c4board" onMouseLeave={() => setHover(-1)}>
        {Array.from({ length: 7 }).map((_, c) => (
          <div key={c} className={'c4col ' + (hover === c && myTurn && !g.win ? 'hov' : '')} onMouseEnter={() => setHover(c)} onClick={() => c4Actions.play(c)}>
            {myTurn && !g.win && hover === c && <i className={'ghost p' + g.turn} />}
            {g.b.map((row, r) => <div key={r} className="c4cell"><i className={'disc p' + row[c] + (inLine(r, c) ? ' win' : '') + (g.last && g.last[0] === r && g.last[1] === c ? ' drop' : '')} /></div>)}
          </div>
        ))}
      </div>
      <small className="dim">CLICK A COLUMN OR PRESS 1-7 · ESC DASHBOARD</small>
      {g.mode === 'over' && g.over && (
        <div className="wresult"><h3>{g.over.draw ? "IT'S A DRAW" : g.type === '2p' ? g.names[g.over.winner - 1] + ' WINS!' : g.over.win ? 'YOU WIN!' : 'YOU LOSE'}</h3>{g.over.points !== undefined && <small>SCORE {fmt(g.over.points)}</small>}<div className="chips"><button className="mg-btn go" onClick={c4Actions.rematch}>↻ REMATCH</button><button className="mg-btn" onClick={c4Actions.quit}>DASHBOARD</button></div></div>
      )}
    </div>
  )
}

// ---------- NEON SNAKE ----------
export function SnakeLobby({ s, TopPlayers }) {
  const [type, setType] = useState('solo')
  const p = s.profile
  return (
    <div className="lobby"><div className="lobbyL">
      <h4>1 · CHOOSE A MODE</h4>
      <div className="modegrid">{[['solo', '🐍', 'SOLO', 'Eat to grow. It speeds up and rocks appear.'], ['bot', '🤖', 'VS BOT', 'Outlast a clever bot snake.'], ['2p', '👥', '2 PLAYERS', 'P1: WASD · P2: arrows. Last one alive wins.']].map(([k, ico, n, d]) => <button key={k} className={'modecard ' + (type === k ? 'sel' : '')} onClick={() => setType(k)}><div className="vs"><span>{ico}</span></div><strong>{n}</strong><small>{d}</small></button>)}</div>
      <div className="lobbyinfo"><b>NEON SNAKE</b> · Steer with WASD / arrows, or swipe on a phone. Red apples +10, golden apples +50 and +3 length. Do not hit walls, rocks or snakes.</div>
      <button className="big" onClick={() => snakeActions.start({ type })}>▶ START</button>
    </div><div className="lobbyR">
      <div className="panel"><h4>MY SNAKE STATS</h4><div className="kv"><Stat k="GAMES" v={p.snakeGames || 0} /><Stat k="BEST SCORE" v={p.snakeBest || 0} /></div></div>
      <TopPlayers s={s} initial="snake" compact fixed />
    </div></div>
  )
}
export function SnakeHUD({ openHelp }) {
  const g = useSyncExternalStore(subscribeSnake, getSnakeSnap)
  if (!g || g.mode === 'idle') return null
  return (
    <div className="hud mg-hud">
      {g.mode === 'play' && <Surface onPtr={snakeActions.pointer} />}
      <div className="mg-topbar"><span>🐍 <b>{g.type === 'solo' ? g.score : g.len.join(' vs ')}</b></span><span className="dim">BEST {g.best}</span><span className="grow" />{g.mode === 'play' && <button className="mg-btn" onClick={() => snakeActions.pause()}>⏸</button>}</div>
      {g.msg && <div className="mg-banner" style={{ '--c': '#ffd23a' }}><h2>{g.msg.text}</h2></div>}
      {g.paused && <PauseScreen resume={snakeActions.resume} quit={snakeActions.quit} help={() => openHelp('snake')} />}
      {g.mode === 'over' && g.over && (
        <div className="screen victory">
          <h1 className={g.over.type === 'solo' || g.over.win ? 'gold' : 'red'}>{g.over.type === 'solo' ? 'GAME OVER' : g.over.draw ? 'DRAW' : g.over.type === '2p' ? 'PLAYER ' + (g.over.winner + 1) + ' WINS' : g.over.win ? 'YOU WIN!' : 'YOU LOSE'}</h1>
          {g.over.type === 'solo' && <ul><li><span>SCORE</span><b>{g.over.score}</b></li><li><span>LENGTH</span><b>{g.over.len}</b></li><li><span>BEST</span><b>{g.over.best}</b></li></ul>}
          <button className="big" onClick={snakeActions.rematch}>↻ AGAIN</button><button className="big sec" onClick={snakeActions.quit}>DASHBOARD</button>
        </div>
      )}
    </div>
  )
}

// ---------- NEON BREAKER ----------
export function BreakerLobby({ s, TopPlayers }) {
  const p = s.profile
  return (
    <div className="lobby"><div className="lobbyL">
      <div className="lobbyinfo"><b>NEON BREAKER</b> · Move the paddle with the mouse, your finger or ← →. Press SPACE or tap to launch the ball. Break every brick in 5 levels. Falling capsules: <b>wide paddle</b>, <b>multi-ball</b>, <b>slow ball</b> and <b>extra life</b>. Hard bricks take several hits.</div>
      <button className="big" onClick={() => breakerActions.start()}>▶ START</button>
    </div><div className="lobbyR">
      <div className="panel"><h4>MY BREAKER STATS</h4><div className="kv"><Stat k="GAMES" v={p.breakerGames || 0} /><Stat k="BEST SCORE" v={fmt(p.breakerBest || 0)} /></div></div>
      <TopPlayers s={s} initial="breaker" compact fixed />
    </div></div>
  )
}
export function BreakerHUD({ openHelp }) {
  const g = useSyncExternalStore(subscribeBreaker, getBreakerSnap)
  const touch = useTouchPrimary()
  if (!g || g.mode === 'idle') return null
  return (
    <div className="hud mg-hud">
      {g.mode === 'play' && <Surface onPtr={(t, x, y) => breakerActions.pointerScreen(t, x, y)} cursor="none" />}
      <div className="mg-topbar"><span>SCORE <b>{fmt(g.score)}</b></span><span>LEVEL <b>{g.level}/{g.levels}</b></span><span className="hearts">{Array.from({ length: g.lives }).map((_, i) => <i key={i} className="on">♥</i>)}</span><span className="dim">{g.wide ? 'WIDE ' : ''}{g.slow ? 'SLOW' : ''}</span><span className="grow" />{g.mode === 'play' && <button className="mg-btn" onClick={() => breakerActions.pause()}>⏸</button>}</div>
      {g.msg && <div className="mg-banner" style={{ '--c': '#3de8ff' }}><h2>{g.msg.text}</h2></div>}
      {g.stuck && g.mode === 'play' && <div className="mg-hint">{touch ? 'TAP TO LAUNCH' : 'MOVE THE MOUSE · SPACE OR CLICK TO LAUNCH'}</div>}
      {g.paused && <PauseScreen resume={breakerActions.resume} quit={breakerActions.quit} help={() => openHelp('breaker')} />}
      {g.mode === 'over' && g.over && (
        <div className="screen victory"><h1 className={g.over.win ? 'gold' : 'red'}>{g.over.win ? 'ALL CLEARED!' : 'GAME OVER'}</h1><ul><li><span>SCORE</span><b>{fmt(g.over.score)}</b></li><li><span>LEVEL</span><b>{g.over.level}</b></li></ul><button className="big" onClick={breakerActions.rematch}>↻ AGAIN</button><button className="big sec" onClick={breakerActions.quit}>DASHBOARD</button></div>
      )}
    </div>
  )
}

// ---------- MINE SWEEP ----------
export function MinesLobby({ s, TopPlayers }) {
  const [lv, setLv] = useState(0)
  const p = s.profile, best = p.minesBest || {}
  return (
    <div className="lobby"><div className="lobbyL">
      <h4>1 · CHOOSE A BOARD</h4>
      <div className="modegrid">{LV.map((l, i) => <button key={l.name} className={'modecard ' + (lv === i ? 'sel' : '')} onClick={() => setLv(i)}><div className="vs"><span>💣</span></div><strong>{l.name}</strong><small>{l.w}×{l.h} · {l.m} mines · BEST {best[i] !== undefined ? best[i] + 's' : '-'}</small></button>)}</div>
      <div className="lobbyinfo"><b>MINE SWEEP</b> · Reveal every safe square. Numbers show how many mines touch a square. Your first click is always safe. <b>Right-click</b> (or the 🚩 button on a phone) flags a mine. Click a number to open its neighbours once enough flags are placed.</div>
      <button className="big" onClick={() => minesActions.start({ lv })}>▶ START</button>
    </div><div className="lobbyR">
      <div className="panel"><h4>MY SWEEP STATS</h4><div className="kv"><Stat k="GAMES" v={p.minesGames || 0} /><Stat k="CLEARED" v={p.minesWins || 0} /></div></div>
      <TopPlayers s={s} initial="mines" compact fixed />
    </div></div>
  )
}
const NCOL = ['', '#3de8ff', '#6aff9a', '#ff6a6a', '#9a8aff', '#ff9a3a', '#3de8c8', '#fff', '#aaa']
export function MinesUI() {
  const g = useSyncExternalStore(subscribeMines, getMinesSnap)
  const press = useRef(null)
  if (!g || g.mode === 'idle') return null
  const down = (i) => { press.current = setTimeout(() => { press.current = 'long'; minesActions.flag(i) }, 420) }
  const up = (i) => { if (press.current === 'long') { press.current = null; return } clearTimeout(press.current); press.current = null; minesActions.tap(i) }
  return (
    <div className="screen menu mg-dom">
      <div className="mg-domhead"><button className="mg-btn" onClick={minesActions.quit}>◀ DASHBOARD</button><h2>MINE SWEEP <small>{LV[g.lv].name}</small></h2><span className="grow" /><div className="mscore"><small>MINES</small><b>{g.mines - g.flags}</b></div><div className="mscore"><small>TIME</small><b>{g.secs}</b></div></div>
      <div className="mboardx" style={{ gridTemplateColumns: `repeat(${g.w}, 1fr)`, width: `min(${g.w * 4.2}cqw, 94vw, ${g.w / g.h * 66}vh)` }} onContextMenu={(e) => e.preventDefault()}>
        {g.cells.map((c, i) => (
          <button key={i} className={'mcx ' + (c === '.' || c === 'F' ? 'closed' : 'open') + (g.boom === i ? ' boom' : '')} style={{ color: NCOL[+c] || '#fff' }}
            onPointerDown={(e) => { if (e.button === 2) return; down(i) }} onPointerUp={(e) => { if (e.button === 2) return; up(i) }} onPointerLeave={() => { if (press.current && press.current !== 'long') { clearTimeout(press.current); press.current = null } }}
            onContextMenu={(e) => { e.preventDefault(); minesActions.flag(i) }}>{c === 'F' ? '🚩' : c === 'M' ? '💣' : c === '0' || c === '.' ? '' : c}</button>
        ))}
      </div>
      <div className="mtools"><button className={'mg-btn ' + (g.flagMode ? 'on' : '')} onClick={minesActions.toggleFlag}>🚩 FLAG MODE {g.flagMode ? 'ON' : 'OFF'}</button><button className="mg-btn" onClick={minesActions.again}>↻ NEW BOARD</button></div>
      <small className="dim">CLICK OPENS · RIGHT-CLICK / LONG-PRESS FLAGS · F TOGGLES FLAG MODE · R RESTARTS</small>
      {g.over && <div className="wresult"><h3>{g.over.win ? 'CLEARED IN ' + g.over.secs + 's!' : 'BOOM!'}</h3>{g.over.score && <small>SCORE {fmt(g.over.score)}</small>}<div className="chips"><button className="mg-btn go" onClick={minesActions.again}>↻ AGAIN</button><button className="mg-btn" onClick={minesActions.quit}>DASHBOARD</button></div></div>}
    </div>
  )
}
export const MORE2_MODES = ['c4', 'snake', 'breaker', 'mines']
export function More2HUD({ mode, openHelp }) {
  if (mode === 'c4') return <C4UI />
  if (mode === 'snake') return <SnakeHUD openHelp={openHelp} />
  if (mode === 'breaker') return <BreakerHUD openHelp={openHelp} />
  if (mode === 'mines') return <MinesUI />
  return null
}
