'use client'
// Lobbies and in-game HUDs for the "arcade pack 2" games: Air Hockey, Billiards, Neon Defense, Neon Depths, Neon Beat, Word Hunt, 2048 Merge.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { subscribeHockey, getHockeySnap, hockeyActions } from '../game/hockey.js'
import { subscribePool, getPoolSnap, poolActions } from '../game/pool.js'
import { subscribeTd, getTdSnap, tdActions, TOWERS, MAPS as TDMAPS, mapOk } from '../game/td.js'
import { TDCAMP } from '../game/tdstory.js'
import { subscribeRogue, getRogueSnap, rogueActions, CLASSES as RCLS, RACES, PETS, SKILLS, MAXLV, CHAPTERS, WEAPONS, POWERS, LORE, weaponOk, powerOk, chapterOk, progress } from '../game/rogue.js'
import { subscribeRhythm, getRhythmSnap, rhythmActions, SONGS, laneGeom } from '../game/rhythm.js'
import { subscribeWord, getWordSnap, wordActions } from '../game/word.js'
import { subscribeMerge, getMergeSnap, mergeActions } from '../game/merge.js'
import { useTouchPrimary } from './platform.js'

const BALLC = ['#f4f4f4', '#ffd23a', '#2f6bff', '#ff3b3b', '#9a3bff', '#ff8a2a', '#22c26a', '#a02a2a', '#161616']
const ballCol = (n) => BALLC[n <= 8 ? n : n - 8]
const fmt = (n) => Math.floor(n).toLocaleString()

// ---------- shared pieces ----------
// a transparent layer that turns mouse / finger positions into arena coordinates (the arena is always 100 x 56 units, centred)
function Surface({ onPtr, cursor }) {
  const ref = useRef()
  const w = (e) => { const r = ref.current.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * 100 - 50, 28 - ((e.clientY - r.top) / r.height) * 56] }
  return (
    <div ref={ref} className="mg-surface" style={{ cursor: cursor || 'crosshair' }}
      onPointerDown={(e) => { e.stopPropagation(); try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* ignore */ } onPtr('down', ...w(e)) }}
      onPointerMove={(e) => onPtr('move', ...w(e))}
      onPointerUp={(e) => onPtr('up', ...w(e))}
      onPointerCancel={(e) => onPtr('up', ...w(e))} />
  )
}
function PauseBtn({ onClick }) { return <button className="mg-pausebtn" onClick={onClick} aria-label="Pause">⏸</button> }
function PauseScreen({ resume, quit, help }) {
  return <div className="screen pause"><h1>PAUSED</h1><button className="big" onClick={resume}>RESUME</button>{help && <button className="big sec" onClick={help}>❓ HOW TO PLAY</button>}<button className="big sec" onClick={quit}>QUIT TO DASHBOARD</button></div>
}
function Stat({ k, v }) { return <><span>{k}</span><b>{v}</b></> }

// ---------- AIR HOCKEY ----------
export function HockeyLobby({ s, onInvite, TopPlayers }) {
  const [type, setType] = useState('bot')
  const [diff, setDiff] = useState(2)
  const [target, setTarget] = useState(7)
  const [chaos, setChaos] = useState(true)
  const p = s.profile
  return (
    <div className="lobby">
      <div className="lobbyL">
        <h4>1 · CHOOSE A MODE</h4>
        <div className="modegrid">
          {[['bot', '🤖', 'VS BOT', 'Take on the AI. Three levels.'], ['2p', '👥', '2 PLAYERS', 'One screen. P1: mouse or WASD · P2: arrows.']].map(([k, ico, n, d]) => <button key={k} className={'modecard ' + (type === k ? 'sel' : '')} onClick={() => setType(k)}><div className="vs"><span>{ico}</span></div><strong>{n}</strong><small>{d}</small></button>)}
        </div>
        <div className="lobbyopts">
          {type === 'bot' && <div><h4>BOT LEVEL</h4><div className="chips">{[[1, 'EASY'], [2, 'MEDIUM'], [3, 'HARD']].map(([v, n]) => <button key={v} className={'chip ' + (diff === v ? 'sel' : '')} onClick={() => setDiff(v)}>{n}</button>)}</div></div>}
          <div><h4>FIRST TO</h4><div className="chips">{[3, 5, 7, 11].map((v) => <button key={v} className={'chip ' + (target === v ? 'sel' : '')} onClick={() => setTarget(v)}>{v}</button>)}</div></div>
          <div><h4>CHAOS PUCK</h4><div className="chips">{[[true, 'ON'], [false, 'OFF']].map(([v, n]) => <button key={n} className={'chip ' + (chaos === v ? 'sel' : '')} onClick={() => setChaos(v)}>{n}</button>)}</div></div>
        </div>
        <div className="lobbyinfo"><b>AIR HOCKEY</b> · Drag your mallet with the mouse or your finger. Keyboard: WASD or arrows. Hit the puck into the other goal. With CHAOS on, a second puck drops in now and then.</div>
        <div className="chips"><button className="big" onClick={() => hockeyActions.start({ type, diff, target, chaos })}>▶ START</button><button className="big sec" onClick={onInvite}>🌐 INVITE FRIEND</button></div>
      </div>
      <div className="lobbyR">
        <div className="panel"><h4>MY HOCKEY STATS</h4><div className="kv"><Stat k="MATCHES" v={p.hockeyGames || 0} /><Stat k="WINS" v={p.hockeyWins || 0} /></div></div>
        <TopPlayers s={s} initial="hockey" compact fixed />
      </div>
    </div>
  )
}
export function HockeyHUD({ openHelp }) {
  const g = useSyncExternalStore(subscribeHockey, getHockeySnap)
  const touch = useTouchPrimary()
  if (!g || g.mode === 'idle') return null
  const online = g.type === 'online'
  const ptr = (t, x, y) => { if (t === 'up') hockeyActions.pointer(null); else hockeyActions.pointerScreen(x, y) }
  return (
    <div className="hud mg-hud">
      {g.mode !== 'over' && <Surface onPtr={ptr} cursor="none" />}
      <div className="mg-score">
        <div className="a"><small>{g.names[0]}</small><b>{g.score[0]}</b></div>
        <div className="mid"><small>{g.type === 'bot' ? 'VS BOT · ' + g.diff : g.type === '2p' ? '2 PLAYERS' : 'ONLINE'}</small><em>FIRST TO {g.target}</em></div>
        <div className="b"><small>{g.names[1]}</small><b>{g.score[1]}</b></div>
      </div>
      {g.phase === 'ready' && g.count > 0 && <div className="mg-big" key={g.count + 'c' + g.score.join()}>{g.count}</div>}
      {g.msg && <div className="mg-banner" style={{ '--c': g.msg.color }} key={g.msg.text + g.score.join()}><h2>{g.msg.text}</h2>{g.msg.sub && <p>{g.msg.sub}</p>}</div>}
      <div className="mg-hint">{touch ? 'DRAG TO MOVE YOUR MALLET' : g.type === '2p' ? 'P1: MOUSE / WASD · P2: ARROWS' : 'MOUSE OR WASD / ARROWS · P TO PAUSE'}{g.rally > 8 ? ` · RALLY ${g.rally}` : ''}</div>
      {!online && g.mode === 'play' && <PauseBtn onClick={() => hockeyActions.pause()} />}
      {online && <button className="mg-pausebtn" onClick={hockeyActions.quit} aria-label="Leave">✕</button>}
      {g.paused && <PauseScreen resume={hockeyActions.resume} quit={hockeyActions.quit} help={() => openHelp('hockey')} />}
      {g.mode === 'over' && g.over && (
        <div className="screen victory">
          <h1 className={g.over.win ? 'gold' : 'red'}>{g.type === '2p' ? 'PLAYER ' + (g.over.winner + 1) + ' WINS!' : g.over.win ? 'YOU WIN!' : 'YOU LOSE'}</h1>
          <div className="bigscore"><span className="a">{g.over.score[0]}</span> : <span className="b">{g.over.score[1]}</span></div>
          <ul><li><span>LONGEST RALLY</span><b>{g.over.best}</b></li>{g.over.points !== undefined && <li><span>SCORE</span><b>{fmt(g.over.points)}</b></li>}</ul>
          <button className="big" onClick={hockeyActions.rematch}>↻ REMATCH</button><button className="big sec" onClick={hockeyActions.quit}>DASHBOARD</button>
        </div>
      )}
    </div>
  )
}

// ---------- BILLIARDS ----------
export function PoolLobby({ s, onInvite, TopPlayers }) {
  const [type, setType] = useState('bot')
  const [diff, setDiff] = useState(2)
  const p = s.profile
  return (
    <div className="lobby">
      <div className="lobbyL">
        <h4>1 · CHOOSE A MODE</h4>
        <div className="modegrid">
          {[['bot', '🤖', 'VS BOT', 'Classic 8-ball against the AI.'], ['2p', '👥', '2 PLAYERS', 'Pass the cue on one screen.']].map(([k, ico, n, d]) => <button key={k} className={'modecard ' + (type === k ? 'sel' : '')} onClick={() => setType(k)}><div className="vs"><span>{ico}</span></div><strong>{n}</strong><small>{d}</small></button>)}
        </div>
        {type === 'bot' && <div className="lobbyopts"><div><h4>BOT LEVEL</h4><div className="chips">{[[1, 'EASY'], [2, 'MEDIUM'], [3, 'HARD']].map(([v, n]) => <button key={v} className={'chip ' + (diff === v ? 'sel' : '')} onClick={() => setDiff(v)}>{n}</button>)}</div></div></div>}
        <div className="lobbyinfo"><b>8-BALL</b> · Pot all your balls (solids or stripes), then the black 8. Scratching or hitting the wrong ball first is a foul and gives your opponent the cue ball anywhere. <small>Press and drag AWAY from where you want to shoot, then release. Keyboard: ← → aim, hold SPACE to charge.</small></div>
        <div className="chips"><button className="big" onClick={() => poolActions.start({ type, diff })}>▶ START</button><button className="big sec" onClick={onInvite}>🌐 INVITE FRIEND</button></div>
      </div>
      <div className="lobbyR">
        <div className="panel"><h4>MY POOL STATS</h4><div className="kv"><Stat k="MATCHES" v={p.poolGames || 0} /><Stat k="WINS" v={p.poolWins || 0} /><Stat k="BALLS POTTED" v={p.poolPots || 0} /></div></div>
        <TopPlayers s={s} initial="pool" compact fixed />
      </div>
    </div>
  )
}
export function PoolHUD({ openHelp }) {
  const g = useSyncExternalStore(subscribePool, getPoolSnap)
  if (!g || g.mode === 'idle') return null
  const me = g.my < 0 ? g.turn : g.my
  const dots = (arr, c) => <span className="pdots">{arr.map((n) => <i key={n} style={{ background: n > 8 ? '#fff' : ballCol(n), borderColor: ballCol(n) }}>{n}</i>)}{arr.length === 0 && <em>✔</em>}</span>
  const row = (i) => (
    <div className={'pside ' + (g.turn === i ? 'on' : '')}>
      <small>{g.names[i]}{g.turn === i ? ' ◀' : ''}</small>
      {g.groups[i] ? <><b>{g.groups[i] === 'solid' ? 'SOLIDS' : 'STRIPES'}</b>{dots(g.groups[i] === 'solid' ? g.solids : g.stripes)}</> : <b>OPEN TABLE</b>}
    </div>
  )
  const ptr = (t, x, y) => { poolActions.pointerScreen(t, x, y) }
  const myTurn = g.my < 0 || g.turn === g.my
  return (
    <div className="hud mg-hud">
      {g.mode === 'play' && <Surface onPtr={ptr} />}
      <div className="mg-pool">{row(0)}<div className="pmid"><small>{g.type === 'bot' ? 'VS BOT · ' + g.diff : g.type === '2p' ? '2 PLAYERS' : 'ONLINE'}</small></div>{row(1)}</div>
      {g.phase === 'aim' && myTurn && <div className="mg-power"><i style={{ height: g.power * 100 + '%' }} /><span>POWER</span></div>}
      {g.msg && <div className="mg-banner" style={{ '--c': g.msg.color }} key={g.msg.text}><h2>{g.msg.text}</h2>{g.msg.sub && <p>{g.msg.sub}</p>}</div>}
      <div className="mg-hint">{g.phase === 'place' ? (myTurn ? 'CUE BALL IN HAND: CLICK TO PLACE IT (ARROWS + ENTER)' : 'OPPONENT IS PLACING THE CUE BALL') : g.phase === 'roll' ? '' : myTurn ? (me >= 0 && g.type !== '2p' ? 'YOUR SHOT' : 'PLAYER ' + (g.turn + 1) + "'S SHOT") + ': DRAG BACK AND RELEASE · ← → AIM · SPACE CHARGE' : g.type === 'bot' ? 'BOT IS THINKING…' : 'OPPONENT IS AIMING…'}</div>
      {!g.net && g.mode === 'play' && <PauseBtn onClick={() => poolActions.pause()} />}
      {g.net && <button className="mg-pausebtn" onClick={poolActions.quit} aria-label="Leave">✕</button>}
      {g.paused && <PauseScreen resume={poolActions.resume} quit={poolActions.quit} help={() => openHelp('pool')} />}
      {g.mode === 'over' && g.over && (
        <div className="screen victory">
          <h1 className={g.over.win ? 'gold' : 'red'}>{g.type === '2p' ? 'PLAYER ' + (g.over.winner + 1) + ' WINS!' : g.over.win ? 'YOU WIN!' : 'YOU LOSE'}</h1>
          <h3>{g.over.why}</h3>
          <ul><li><span>BALLS POTTED</span><b>{g.over.potted}</b></li><li><span>FOULS</span><b>{g.over.fouls}</b></li>{g.over.points !== undefined && <li><span>SCORE</span><b>{fmt(g.over.points)}</b></li>}</ul>
          <button className="big" onClick={poolActions.rematch}>↻ REMATCH</button><button className="big sec" onClick={poolActions.quit}>DASHBOARD</button>
        </div>
      )}
    </div>
  )
}

// ---------- NEON DEFENSE (tower defense) ----------
export function TdLobby({ s, TopPlayers }) {
  const p = s.profile, cleared = (p.tdU && p.tdU.cleared) || 0
  const [map, setMap] = useState(Math.min(cleared, TDMAPS.length - 1))
  const [auto, setAuto] = useState(false)
  const [story, setStory] = useState(true)
  const m = TDCAMP[map]
  return (
    <div className="lobby">
      <div className="lobbyL">
        <h4>1 · THE CAMPAIGN: THE WARDENS OF THE VALLEY <small className="dim">({cleared}/{TDMAPS.length} CLEARED)</small></h4>
        <div className="chapgrid">{TDMAPS.map((mm, i) => { const open = mapOk(i); return <button key={mm.name} className={'chapcard ' + (map === i ? 'sel ' : '') + (open ? '' : 'locked')} disabled={!open} onClick={() => setMap(i)}><b>{open ? i + 1 : '🔒'}</b><strong>{mm.name}</strong><small>{open ? mm.cols + '×' + mm.rows + ' · ' + mm.goal + ' WAVES' : 'CLEAR CHAPTER ' + i}</small><em>{cleared > i ? '✔ CLEARED' : ''}</em></button> })}</div>
        <div className="lobbyinfo"><b>{m.name}</b> · {m.sub}<br /><small>{m.intro[0][1].toLowerCase().replace(/^./, (c) => c.toUpperCase())}</small></div>
        <div className="lobbyopts">
          <div><h4>NEXT WAVE</h4><div className="chips">{[[false, 'MANUAL'], [true, 'AUTO']].map(([v, n]) => <button key={n} className={'chip ' + (auto === v ? 'sel' : '')} onClick={() => setAuto(v)}>{n}</button>)}</div></div>
          <div><h4>STORY SCENES</h4><div className="chips">{[[true, 'ON'], [false, 'OFF']].map(([v, n]) => <button key={n} className={'chip ' + (story === v ? 'sel' : '')} onClick={() => setStory(v)}>{n}</button>)}</div></div>
        </div>
        <div className="lobbyinfo"><b>NEON DEFENSE</b> · Stop the Static Horde before it reaches the gate. Build 6 kinds of towers, upgrade them 3 times, and call an airstrike when a boss shows up. The monsters walk slowly: plan, build, then watch. <small>Keys: 1-6 pick a tower · SPACE next wave · U upgrade · S sell · Q airstrike · F speed</small></div>
        <button className="big" onClick={() => tdActions.start({ map, auto, story })}>▶ DEFEND {m.name}</button>
      </div>
      <div className="lobbyR">
        <div className="panel"><h4>MY DEFENCE STATS</h4><div className="kv"><Stat k="GAMES" v={p.tdGames || 0} /><Stat k="VICTORIES" v={p.tdWins || 0} /><Stat k="BEST WAVE" v={(p.tdBest || 0) + '/25'} /><Stat k="ENEMIES KILLED" v={fmt(p.tdKills || 0)} /></div></div>
        <TopPlayers s={s} initial="td" compact fixed />
      </div>
    </div>
  )
}
export function TdHUD({ openHelp }) {
  const g = useSyncExternalStore(subscribeTd, getTdSnap)
  if (!g || g.mode === 'idle') return null
  const sel = g.sel
  return (
    <div className="hud mg-hud">
      {g.mode === 'play' && <Surface onPtr={(t, x, y) => tdActions.pointerScreen(t === 'up' ? 'move' : t, x, y)} cursor="cell" />}
      <div className="mg-topbar">
        <span>💰 <b>{g.gold}</b></span><span>❤️ <b>{g.lives}</b></span><span>🌊 <b>{g.wave}/{g.waves}</b></span><span>☠ <b>{g.kills}</b></span><span className="dim">{g.map}</span>
        <span className="grow" />
        {g.running ? <span className="dim">{g.left} LEFT</span> : g.wave < g.waves && <button className="mg-btn go" onClick={tdActions.next}>▶ NEXT WAVE{g.nextBonus > 0 ? ` (+${g.nextBonus * 2}💰)` : ''}</button>}
        <button className="mg-btn" onClick={tdActions.speed}>{g.speed}×</button>
        <button className={'mg-btn ' + (g.auto ? 'on' : '')} onClick={tdActions.auto}>AUTO</button>
        <button className="mg-btn" onClick={() => tdActions.pause()}>⏸</button>
      </div>
      {g.msg && !g.tale && <div className="mg-banner" style={{ '--c': g.msg.color }} key={g.msg.text}><h2>{g.msg.text}</h2>{g.msg.sub && <p>{g.msg.sub}</p>}</div>}
      {g.beat && !g.tale && <div className="mg-beat" style={{ '--c': g.beat.color }} key={g.beat.sub}><b>{g.beat.text}</b><span>{g.beat.sub}</span></div>}
      {g.tale && (
        <div className="storyfull talebox" onClick={tdActions.nextTale}>
          <div className="sbox" style={{ '--c': g.tale.who[1] }}><div className="sport">{g.tale.who[2]}</div><div className="stext"><b>{g.tale.who[0]}</b><p>{g.tale.text}</p></div><div className="snext">{g.tale.i < g.tale.n - 1 ? 'NEXT ▶' : g.tale.kind === 'intro' ? 'BEGIN ▶' : 'CONTINUE ▶'}</div></div>
          <div className="sbtns"><button className="big sec" onClick={(e) => { e.stopPropagation(); tdActions.skipTale() }}>SKIP ▶▶</button></div>
        </div>
      )}
      <div className="mg-palette">
        {TOWERS.map((t, i) => <button key={t.id} className={'mg-tw ' + (g.build === t.id && !sel ? 'sel ' : '') + (g.gold < t.cost ? 'poor' : '')} style={{ '--c': t.color }} onClick={() => tdActions.setBuild(t.id)} title={t.desc}><b>{i + 1}</b><span>{t.ico}</span><em>{t.name}</em><small>💰{t.cost}</small></button>)}
        <button className={'mg-tw air ' + (g.strikeArm ? 'sel ' : '') + (g.strike > 0 ? 'poor' : '')} onClick={tdActions.strike}><b>Q</b><span>✈️</span><em>AIRSTRIKE</em><small>{g.strike > 0 ? Math.ceil(g.strike) + 's' : 'READY'}</small></button>
      </div>
      {sel && (
        <div className="mg-sel">
          <h4>{sel.name} · LV {sel.lvl}</h4>
          {sel.id !== 'bank' ? <small>DMG {sel.dmg} · RANGE {sel.range} · KILLS {sel.kills}</small> : <small>+{30 + sel.lvl * 25} 💰 EVERY WAVE</small>}
          <div className="chips">{sel.lvl < 4 ? <button className="mg-btn go" disabled={g.gold < sel.up} onClick={tdActions.upgrade}>⬆ UPGRADE 💰{sel.up}</button> : <span className="dim">MAX LEVEL</span>}<button className="mg-btn" onClick={tdActions.sell}>SELL 💰{sel.sell}</button></div>
        </div>
      )}
      {g.paused && <PauseScreen resume={tdActions.resume} quit={tdActions.quit} help={() => openHelp('td')} />}
      {g.mode === 'over' && g.over && !g.tale && (
        <div className="screen victory">
          <h1 className={g.over.win ? 'gold' : 'red'}>{g.over.win ? 'DEFENCE HELD!' : 'BASE DESTROYED'}</h1>{g.nextMap && <h3>NEXT: {g.nextMap}</h3>}
          <ul><li><span>WAVE REACHED</span><b>{g.over.wave}/{g.waves}</b></li><li><span>ENEMIES DESTROYED</span><b>{g.over.kills}</b></li><li><span>LIVES LEFT</span><b>{g.over.lives}</b></li><li className="bonus"><span>SCORE</span><b>{fmt(g.over.score)}</b></li></ul>
          <button className="big" onClick={tdActions.rematch}>{g.nextMap ? '▶ NEXT CHAPTER' : '↻ TRY AGAIN'}</button><button className="big sec" onClick={tdActions.quit}>DASHBOARD</button>
        </div>
      )}
    </div>
  )
}

// ---------- NEON DEPTHS (roguelike) ----------
export function RogueLobby({ s, TopPlayers, onInvite }) {
  const p = s.profile
  const U = p.rogueU || { cleared: 0, secret: {}, lore: {} }
  const pg = progress()
  const [chap, setChap] = useState(Math.min(p.rogueChapter || 1, Math.max(1, U.cleared + 1)))
  const [cls, setCls] = useState(p.roguePick || 0)
  const [race, setRace] = useState(RACES[p.rogueRace || 0] && RACES[p.rogueRace || 0].ok() ? (p.rogueRace || 0) : 0)
  const [pet, setPet] = useState(PETS[p.roguePet || 0] && PETS[p.roguePet || 0].ok() ? (p.roguePet || 0) : 0)
  const cid = RCLS[cls].id
  const [weapon, setWeapon] = useState(p.rogueWeapon && weaponOk(cid, p.rogueWeapon) ? p.rogueWeapon : WEAPONS[cid][0].id)
  const [power, setPower] = useState(p.roguePower && powerOk(p.roguePower) ? p.roguePower : 'none')
  const [codex, setCodex] = useState(false)
  const save = (k, v) => { p[k] = v; try { localStorage.setItem('si_profile', JSON.stringify(p)) } catch { /* ignore */ } }
  const pickClass = (i) => { setCls(i); save('roguePick', i); const id = RCLS[i].id; const w = weaponOk(id, weapon) && WEAPONS[id].some((x) => x.id === weapon) ? weapon : WEAPONS[id][0].id; setWeapon(w); save('rogueWeapon', w) }
  const sk = SKILLS[cid]
  const ch = CHAPTERS[chap - 1]
  return (
    <div className="lobby">
      <div className="lobbyL">
        <h4>1 · CHOOSE A CHAPTER <small className="dim">({pg.cleared}/5 CLEARED · 🗝 {pg.secrets}/5 SECRETS · 📜 {pg.lore}/10 LORE)</small></h4>
        <div className="chapgrid">{CHAPTERS.map((c) => { const open = chapterOk(c.id); return <button key={c.id} className={'chapcard ' + (chap === c.id ? 'sel ' : '') + (open ? '' : 'locked')} disabled={!open} onClick={() => { setChap(c.id); save('rogueChapter', c.id) }}><b>{open ? c.id : '🔒'}</b><strong>{c.name}</strong><small>{open ? c.sub.split('·')[1] : 'CLEAR CHAPTER ' + (c.id - 1)}</small><em>{U.cleared >= c.id ? '✔ CLEARED' : ''}{U.secret && U.secret[c.id] ? ' 🗝' : ''}{(U.lore && (U.lore['L' + c.id + 'a'] ? 1 : 0) + (U.lore['L' + c.id + 'b'] ? 1 : 0)) ? ' 📜' + ((U.lore['L' + c.id + 'a'] ? 1 : 0) + (U.lore['L' + c.id + 'b'] ? 1 : 0)) : ''}</em></button> })}</div>
        <div className="lobbyinfo"><b>{ch.name}</b> · {ch.blurb} <small>5 rooms: {ch.plan.map((t) => ({ combat: '⚔', elite: '💀', puzzle: '🔮', treasure: '💰', boss: '👑' }[t])).join(' → ')} · a hidden vault waits behind a cracked wall in room {ch.secretRoom}</small></div>
        <h4>2 · CLASS</h4>
        <div className="modegrid">{RCLS.map((c, i) => <button key={c.id} className={'modecard ' + (cls === i ? 'sel' : '')} onClick={() => pickClass(i)}><div className="vs"><span>{c.ico}</span></div><strong>{c.name}</strong><small>{c.desc}</small></button>)}</div>
        <h4>3 · WEAPON <small className="dim">(unlock more by clearing chapters and finding secrets)</small></h4>
        <div className="modegrid four">{WEAPONS[cid].map((w) => { const open = weaponOk(cid, w.id); return <button key={w.id} className={'modecard ' + (weapon === w.id ? 'sel ' : '') + (open ? '' : 'locked')} disabled={!open} onClick={() => { setWeapon(w.id); save('rogueWeapon', w.id) }}><div className="vs"><span>{open ? w.ico : '🔒'}</span></div><strong>{w.name}</strong><small>{open ? w.desc : 'UNLOCK: ' + w.hint}</small></button> })}</div>
        <h4>4 · POWER <small className="dim">(a passive you carry into the dungeon)</small></h4>
        <div className="modegrid four">{POWERS.map((w) => { const open = powerOk(w.id); return <button key={w.id} className={'modecard ' + (power === w.id ? 'sel ' : '') + (open ? '' : 'locked')} disabled={!open} onClick={() => { setPower(w.id); save('roguePower', w.id) }}><div className="vs"><span>{open ? w.ico : '🔒'}</span></div><strong>{w.name}</strong><small>{open ? w.desc : 'UNLOCK: ' + w.hint}</small></button> })}</div>
        <h4>5 · RACE</h4>
        <div className="modegrid five">{RACES.map((r, i) => { const open = r.ok(); return <button key={r.id} className={'modecard ' + (race === i ? 'sel ' : '') + (open ? '' : 'locked')} disabled={!open} onClick={() => { setRace(i); save('rogueRace', i) }}><div className="vs"><span>{open ? r.ico : '🔒'}</span></div><strong>{r.name}</strong><small>{open ? r.desc : 'UNLOCK: ' + r.hint}</small></button> })}</div>
        <h4>6 · COMPANION</h4>
        <div className="modegrid four">{PETS.map((r, i) => { const open = r.ok(); return <button key={r.id} className={'modecard ' + (pet === i ? 'sel ' : '') + (open ? '' : 'locked')} disabled={!open} onClick={() => { setPet(i); save('roguePet', i) }}><div className="vs"><span>{open ? r.ico : '🔒'}</span></div><strong>{r.name}</strong><small>{open ? r.desc : 'UNLOCK: ' + r.hint}</small></button> })}</div>
        <div className="lobbyinfo"><b>HOW IT WORKS</b> · Each chapter is 5 rooms: fights, an elite guard, a <b>rune trial</b> (watch the glowing runes, then step on them in the same order), sometimes a treasure room, and a guardian. Hit the <b>cracked wall</b> in one room to find a <b>hidden vault</b> with a secret weapon and a lore tablet. Skills: {sk.map((k) => k.ico + ' ' + k.name + ' (LV ' + k.lv + ')').join(' · ')}.</div>
        <div className="lobbyinfo"><b>CONTROLS</b> · <b>WASD / arrows</b> move · <b>mouse</b> aims, <b>hold left click</b> attacks where you aim · <b>SPACE</b> dash · <b>Q / E / R</b> skills · <b>1-2-3</b> pick a perk · <b>P</b> pause. Gamepad: stick, A = dash, bumpers/triggers = skills. Phone: stick + buttons.</div>
        <div className="chips"><button className="big" onClick={() => { save('rogueChapter', chap); rogueActions.start({ chapter: chap, cls, race, pet, weapon, power }) }}>▶ ENTER CHAPTER {chap}</button><button className="big sec" onClick={onInvite}>🌐 INVITE FRIENDS (CO-OP)</button><button className="big sec" onClick={() => setCodex(!codex)}>📜 CODEX {pg.lore}/10</button></div>
        {codex && <div className="codex">{LORE.map((t) => { const got = U.lore && U.lore[t.id]; return <div key={t.id} className={'tablet ' + (got ? 'got' : '')}><b>{got ? t.title : '??? (CH ' + t.ch + ')'}</b><small>{got ? t.text : 'A lore tablet you have not found yet. Solve rune trials and search the hidden vaults.'}</small></div> })}</div>}
      </div>
      <div className="lobbyR">
        <div className="panel"><h4>MY DUNGEON STATS</h4><div className="kv"><Stat k="RUNS" v={p.rogueRuns || 0} /><Stat k="CHAPTERS CLEARED" v={pg.cleared + '/5'} /><Stat k="SECRETS FOUND" v={pg.secrets + '/5'} /><Stat k="LORE TABLETS" v={pg.lore + '/10'} /><Stat k="MONSTERS SLAIN" v={fmt(p.rogueKills || 0)} /></div></div>
        <TopPlayers s={s} initial="rogue" compact fixed />
      </div>
    </div>
  )
}
function Stick({ onMove }) {
  const ref = useRef(), [knob, setKnob] = useState([0, 0])
  const calc = (e) => { const r = ref.current.getBoundingClientRect(); let x = (e.clientX - r.left - r.width / 2) / (r.width / 2), y = (e.clientY - r.top - r.height / 2) / (r.height / 2); const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l } return [x, y] }
  const set = (e) => { const [x, y] = calc(e); setKnob([x, y]); onMove(Math.abs(x) < 0.15 ? 0 : x, Math.abs(y) < 0.15 ? 0 : -y) }
  return (
    <div ref={ref} className="mg-stick" onPointerDown={(e) => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); set(e) }} onPointerMove={(e) => { if (e.buttons || e.pointerType === 'touch') set(e) }} onPointerUp={() => { setKnob([0, 0]); onMove(0, 0) }} onPointerCancel={() => { setKnob([0, 0]); onMove(0, 0) }}>
      <i style={{ transform: `translate(${knob[0] * 45}%, ${knob[1] * 45}%)` }} />
    </div>
  )
}
export function RogueHUD({ openHelp }) {
  const g = useSyncExternalStore(subscribeRogue, getRogueSnap)
  const touch = useTouchPrimary()
  if (!g || g.mode === 'idle') return null
  const cls = RCLS[g.cls]
  const low = g.alive !== false && g.max > 0 && g.hp / g.max <= 0.34 && g.mode === 'play'
  return (
    <div className="hud mg-hud">
      {g.mode === 'play' && !g.tale && <Surface onPtr={(t, x, y) => { rogueActions.aim(x, y); if (t === 'down') rogueActions.hold(true); else if (t === 'up') rogueActions.hold(false) }} />}
      <div className={'mg-vig' + (low ? ' low' : '') + (g.boss ? ' boss' : '')} />
      <div className="mg-topbar rg">
        <span className="hearts">{Array.from({ length: g.max }).map((_, i) => <i key={i} className={i < g.hp ? 'on' : ''}>♥</i>)}{g.shield > 0 && <i className="on sh">🛡</i>}</span>
        <span title={RACES[g.race].name}>{RACES[g.race].ico}{PETS[g.pet].ico} <b>LV {g.lv}</b></span><span title={g.chName}>📖 <b>CH {g.chapter} · {g.roomN}/{g.rooms}</b> <small className="dim">{{ combat: '⚔', elite: '💀', puzzle: '🔮', treasure: '💰', boss: '👑', secret: '🗝' }[g.rtype]}</small></span><span title={(g.wpn && g.wpn.name) + ' · ' + (g.pwr && g.pwr.name)}>{g.wpn && g.wpn.ico}{g.pwr && g.pwr.ico !== '·' ? g.pwr.ico : ''}</span><span>🪙 <b>{g.gold}</b></span><span>☠ <b>{g.kills}</b></span>
        <span className="perks">{g.perks.map((p, i) => <i key={i}>{p}</i>)}</span>
        <span className="grow" />
        {g.mode === 'play' && !g.net && <button className="mg-btn" onClick={() => rogueActions.pause()}>⏸</button>}
        {g.net && <button className="mg-btn" onClick={rogueActions.quit}>✕</button>}
      </div>
      <div className="mg-xp"><b style={{ width: Math.min(100, (g.xp / g.need) * 100) + '%' }} /><span>LV {g.lv}{g.lv >= MAXLV ? ' MAX' : ''}</span></div>
      {g.coop && <div className="mg-team">{g.team.map((m, i) => <div key={i} className={'mate ' + (m.alive ? '' : 'dead ') + (m.me ? 'me' : '')}><small>{RCLS[m.cls].ico} {m.name || 'HERO'}</small><span>{m.alive ? '♥'.repeat(Math.max(0, m.hp)) : '☠ DOWN'}</span></div>)}</div>}
      {g.boss && <div className="mg-boss"><span>{g.boss.name}</span><div className="bar"><b style={{ width: g.boss.hp * 100 + '%' }} /></div></div>}
      {g.msg && !g.tale && <div className="mg-banner" style={{ '--c': g.msg.color }} key={g.msg.text}><h2>{g.msg.text}</h2>{g.msg.sub && <p>{g.msg.sub}</p>}</div>}
      {g.mode === 'play' && !g.tale && (
        <div className="mg-rgctl">
          {touch && <Stick onMove={rogueActions.stick} />}
          <div className="mg-abil">
            <button className={'mg-ab ' + (g.dash > 0 ? 'cd' : '')} onClick={rogueActions.dash}><i style={{ height: g.dash * 100 + '%' }} />💨<small>DASH</small></button>
            {g.skills.map((k, i) => <button key={k.name} className={'mg-ab ' + (!k.open ? 'locked ' : k.cd > 0 ? 'cd' : '')} disabled={!k.open} onClick={() => rogueActions.special(i)} title={k.name}><i style={{ height: (k.open ? k.cd : 1) * 100 + '%' }} />{k.open ? k.ico : '🔒'}<small>{['Q', 'E', 'R'][i]}{!k.open ? ' LV' + k.lv : ''}</small></button>)}
          </div>
        </div>
      )}
      {g.puz && !g.puz.solved && <div className="mg-hint">{g.puz.showing ? '🔮 WATCH THE RUNES…' : '🔮 STEP ON THE RUNES IN ORDER · ' + g.puz.step + '/' + g.puz.n + ' · THE MIDDLE PEDESTAL REPLAYS IT'}</div>}
      {g.secretHint && <div className="mg-hint">THE WALL AT THE TOP LOOKS CRACKED… ATTACK IT?</div>}
      {g.secretOpen && <div className="mg-hint">A HIDDEN PASSAGE IS OPEN · WALK INTO THE PURPLE LIGHT</div>}
      {g.dead && g.mode === 'play' && <div className="mg-hint">YOU ARE DOWN · YOUR FRIENDS CAN FINISH THE ROOM AND REVIVE YOU</div>}
      {g.choices && !g.tale && (
        <div className="screen perk"><h1>CHOOSE A PERK</h1>
          <div className="perkrow">{g.choices.map((c, i) => <button key={c.id} className="perkcard" onClick={() => rogueActions.pick(i)}><b>{i + 1}</b><span>{c.ico}</span><strong>{c.name}</strong><small>{c.desc}</small></button>)}</div>
          {g.coop && <small className="dim">EVERYONE PICKS THEIR OWN PERK. THE DOOR OPENS WHEN ALL HAVE CHOSEN.</small>}
        </div>
      )}
      {g.tale && (
        <div className="storyfull talebox" onClick={rogueActions.nextTale}>
          <div className="sbox" style={{ '--c': g.tale.who[1] }}>
            <div className="sport">{g.tale.who[2]}</div>
            <div className="stext"><b>{g.tale.who[0]}</b><p>{g.tale.text}</p></div>
            <div className="snext">{g.tale.i < g.tale.n - 1 ? 'NEXT ▶' : 'GO ▶'}</div>
          </div>
          <div className="sbtns"><button className="big sec" onClick={(e) => { e.stopPropagation(); rogueActions.skipTale() }}>SKIP ▶▶</button></div>
        </div>
      )}
      {g.paused && <PauseScreen resume={rogueActions.resume} quit={rogueActions.quit} help={() => openHelp('rogue')} />}
      {g.mode === 'over' && g.over && (
        <div className="screen victory">
          <h1 className={g.over.win ? 'gold' : 'red'}>{g.over.left ? 'THE HOST LEFT' : g.over.win ? (g.over.complete ? 'THE LAST LANTERN BURNS!' : 'CHAPTER ' + g.over.chapter + ' CLEARED!') : 'THE DEPTHS CLAIM YOU'}</h1>
          {g.over.win ? <p className="epilogue">{g.over.epilogue}</p> : <h3>{g.over.chName} · ROOM {g.over.room}/5</h3>}
          {g.over.win && g.over.next && <div className="lobbyinfo"><b>NEXT:</b> {g.over.next}</div>}
          <ul><li><span>MONSTERS SLAIN</span><b>{g.over.kills}</b></li><li><span>GOLD</span><b>{g.over.gold}</b></li><li><span>LORE · SECRET</span><b>{g.over.lore} 📜 · {g.over.secret ? '🗝 FOUND' : 'NONE'}</b></li><li><span>PERKS</span><b>{g.over.perks}</b></li><li className="bonus"><span>SCORE{g.over.coop ? ' (CO-OP)' : ''}</span><b>{fmt(g.over.score)}</b></li></ul>
          {g.over.unlocks && g.over.unlocks.length > 0 && <div className="lobbyinfo"><b>🎉 UNLOCKED:</b> {g.over.unlocks.join(' · ')}</div>}<ul><li><span>HERO</span><b>{g.over.race} · LV {g.over.lv}</b></li><li><span>COMPANION</span><b>{g.over.pet}</b></li></ul><button className="big" onClick={rogueActions.rematch}>{g.over.win && g.over.next ? '▶ NEXT CHAPTER' : '↻ AGAIN'}</button><button className="big sec" onClick={rogueActions.quit}>DASHBOARD</button>
        </div>
      )}
    </div>
  )
}

// ---------- NEON BEAT (rhythm) ----------
export function RhythmLobby({ s, TopPlayers }) {
  const [song, setSong] = useState(0)
  const p = s.profile
  const best = p.rhythmBest || {}
  return (
    <div className="lobby">
      <div className="lobbyL">
        <h4>1 · CHOOSE A SONG</h4>
        <div className="songlist">{SONGS.map((x) => <button key={x.id} className={'songrow ' + (song === x.id ? 'sel' : '')} style={{ '--c': x.color }} onClick={() => setSong(x.id)}><b>{x.name}</b><span>{x.bpm} BPM</span><em>{'★'.repeat(x.lvl)}{'☆'.repeat(5 - x.lvl)}</em><small>BEST {fmt(best[x.id] || 0)}</small></button>)}</div>
        <div className="lobbyinfo"><b>NEON BEAT</b> · Hit the notes as they cross the line. Keys <b>D F J K</b> (or the arrow keys) · on a phone tap the four lanes. Hold long notes until they end. Miss too much and the song fails. <small>Wear headphones: the beat is part of the fun.</small></div>
        <button className="big" onClick={() => rhythmActions.start({ song })}>▶ PLAY</button>
      </div>
      <div className="lobbyR">
        <div className="panel"><h4>MY BEAT STATS</h4><div className="kv"><Stat k="SONGS PLAYED" v={p.rhythmPlays || 0} /><Stat k="NOTES HIT" v={fmt(p.rhythmNotes || 0)} /><Stat k="FULL COMBOS" v={p.rhythmFC || 0} /></div></div>
        <TopPlayers s={s} initial="rhythm" compact fixed />
      </div>
    </div>
  )
}
export function RhythmHUD({ openHelp }) {
  const g = useSyncExternalStore(subscribeRhythm, getRhythmSnap)
  if (!g || g.mode === 'idle') return null
  const { lw } = laneGeom()
  const left = 50 - 2 * lw, width = 4 * lw
  const KEYS = ['D', 'F', 'J', 'K']
  return (
    <div className="hud mg-hud">
      {g.mode === 'play' && (
        <div className="mg-lanes" style={{ left: left + '%', width: width + '%' }}>
          {KEYS.map((k, i) => <div key={k} className={'mg-lane l' + i} onPointerDown={(e) => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); rhythmActions.press(i) }} onPointerUp={() => rhythmActions.release(i)} onPointerCancel={() => rhythmActions.release(i)}><b>{k}</b></div>)}
        </div>
      )}
      <div className="mg-topbar rt"><span>🎵 <b>{g.name}</b></span><span>SCORE <b>{fmt(g.score)}</b></span><span>ACC <b>{(g.acc * 100).toFixed(1)}%</b></span><span>MAX COMBO <b>{g.maxCombo}</b></span><span className="grow" />{g.mode === 'play' && <button className="mg-btn" onClick={() => rhythmActions.pause()}>⏸</button>}</div>
      <div className="mg-life"><b style={{ width: g.life * 100 + '%', background: g.life < 0.3 ? '#ff4a5a' : '#6aff9a' }} /></div>
      {g.mode === 'play' && g.combo >= 3 && <div className="rt-combo" key={Math.floor(g.combo / 5)}><b>{g.combo}</b><small>COMBO</small></div>}
      {g.mode === 'play' && g.judge && <div className="rt-judge" style={{ color: g.judge.c }} key={g.judge.text + g.combo}>{g.judge.text}</div>}
      {g.lead > 0 && <div className="mg-big" key="lead">GET READY</div>}
      {g.paused && <PauseScreen resume={rhythmActions.resume} quit={rhythmActions.quit} help={() => openHelp('rhythm')} />}
      {g.mode === 'over' && g.over && (
        <div className="screen victory">
          <h1 className={g.over.clear ? 'gold' : 'red'}>{g.over.clear ? (g.over.fc ? 'FULL COMBO!' : 'SONG CLEAR') : 'SONG FAILED'}</h1><h3>{g.over.name}</h3>
          <div className="grade">{g.over.grade}</div>
          <ul><li><span>PERFECT / GREAT / GOOD / MISS</span><b>{g.over.counts.perfect} / {g.over.counts.great} / {g.over.counts.good} / {g.over.counts.miss}</b></li><li><span>ACCURACY</span><b>{(g.over.acc * 100).toFixed(1)}%</b></li><li><span>MAX COMBO</span><b>{g.over.maxCombo}</b></li><li className="bonus"><span>SCORE</span><b>{fmt(g.over.score)}</b></li></ul>
          <button className="big" onClick={rhythmActions.rematch}>↻ AGAIN</button><button className="big sec" onClick={rhythmActions.quit}>DASHBOARD</button>
        </div>
      )}
    </div>
  )
}

// ---------- WORD HUNT ----------
export function WordLobby({ s, TopPlayers }) {
  const [lang, setLang] = useState('en')
  const [daily, setDaily] = useState(true)
  const [hard, setHard] = useState(false)
  const st = (s.profile.word) || { played: 0, wins: 0, streak: 0, best: 0, dist: [0, 0, 0, 0, 0, 0] }
  return (
    <div className="lobby">
      <div className="lobbyL">
        <h4>1 · CHOOSE A LIST</h4>
        <div className="modegrid">{[['en', '🔤', 'ENGLISH', 'Classic 5-letter English words.'], ['tl', '🇵🇭', 'FILIPINO', 'Mga salitang Tagalog na may limang letra.']].map(([k, ico, n, d]) => <button key={k} className={'modecard ' + (lang === k ? 'sel' : '')} onClick={() => setLang(k)}><div className="vs"><span>{ico}</span></div><strong>{n}</strong><small>{d}</small></button>)}</div>
        <div className="lobbyopts">
          <div><h4>WORD</h4><div className="chips">{[[true, 'DAILY (SAME FOR EVERYONE)'], [false, 'PRACTICE (RANDOM)']].map(([v, n]) => <button key={n} className={'chip ' + (daily === v ? 'sel' : '')} onClick={() => setDaily(v)}>{n}</button>)}</div></div>
          <div><h4>HARD MODE</h4><div className="chips">{[[false, 'OFF'], [true, 'ON']].map(([v, n]) => <button key={n} className={'chip ' + (hard === v ? 'sel' : '')} onClick={() => setHard(v)}>{n}</button>)}</div></div>
        </div>
        <div className="lobbyinfo"><b>WORD HUNT</b> · Guess the 5-letter word in 6 tries. <b style={{ color: '#6aff9a' }}>Green</b> = right letter, right place. <b style={{ color: '#ffe84a' }}>Yellow</b> = right letter, wrong place. Grey = not in the word. Hard mode makes you reuse the green letters.</div>
        <button className="big" onClick={() => wordActions.start({ lang, daily, hard })}>▶ PLAY</button>
      </div>
      <div className="lobbyR">
        <div className="panel"><h4>MY WORD STATS</h4><div className="kv"><Stat k="PLAYED" v={st.played} /><Stat k="WON" v={st.wins} /><Stat k="STREAK" v={st.streak} /><Stat k="BEST STREAK" v={st.best} /></div></div>
        <TopPlayers s={s} initial="word" compact fixed />
      </div>
    </div>
  )
}
const KB = ['QWERTYUIOP', 'ASDFGHJKL', '+ZXCVBNM-']
export function WordUI() {
  const g = useSyncExternalStore(subscribeWord, getWordSnap)
  const [share, setShare] = useState('')
  if (!g || g.mode === 'idle') return null
  const rows = [...g.rows]
  const cells = Array.from({ length: 6 }, (_, r) => {
    const row = rows[r]
    if (row) return row.w.split('').map((ch, i) => ({ ch, s: row.s[i], rev: r === g.reveal, i }))
    if (r === rows.length) return Array.from({ length: 5 }, (_, i) => ({ ch: g.cur[i] || '', s: '', cur: true, i }))
    return Array.from({ length: 5 }, (_, i) => ({ ch: '', s: '', i }))
  })
  const emoji = () => (g.win ? g.rows.length : 'X') + '/6\n' + g.rows.map((r) => r.s.split('').map((c) => (c === 'g' ? '🟩' : c === 'y' ? '🟨' : '⬛')).join('')).join('\n')
  const copy = async () => { try { await navigator.clipboard.writeText('WORD HUNT ' + (g.lang === 'tl' ? '🇵🇭 ' : '') + emoji()); setShare('COPIED!') } catch { setShare('COPY FAILED') } setTimeout(() => setShare(''), 1500) }
  const press = (k) => { if (k === '+') wordActions.submit(); else if (k === '-') wordActions.back(); else wordActions.type(k) }
  return (
    <div className="screen menu mg-dom">
      <div className="mg-domhead"><button className="mg-btn" onClick={wordActions.quit}>◀ DASHBOARD</button><h2>WORD HUNT <small>{g.lang === 'tl' ? '🇵🇭 FILIPINO' : 'ENGLISH'} · {g.daily ? 'DAILY' : 'PRACTICE'}{g.hard ? ' · HARD' : ''}</small></h2><span className="grow" /></div>
      <div className="wgrid">{cells.map((row, r) => <div key={r} className={'wrow ' + (g.shake > 0 && r === rows.length ? 'shake' : '')}>{row.map((c) => <div key={c.i} className={'wcell ' + (c.s ? 'c' + c.s : '') + (c.ch && !c.s ? ' filled' : '') + (c.rev ? ' flip' : '')} style={c.rev ? { animationDelay: c.i * 0.18 + 's' } : undefined}>{c.ch}</div>)}</div>)}</div>
      {g.msg && <div className="wtoast">{g.msg}</div>}
      <div className="wkb">{KB.map((r) => <div key={r}>{r.split('').map((k) => <button key={k} className={'wkey ' + (g.keys[k] ? 'k' + g.keys[k] : '') + (k === '+' || k === '-' ? ' wide' : '')} onClick={() => press(k)}>{k === '+' ? 'ENTER' : k === '-' ? 'DEL' : k}</button>)}</div>)}</div>
      {g.done && (
        <div className="wresult">
          <h3>{g.win ? ['GENIUS!', 'MAGNIFICENT!', 'IMPRESSIVE!', 'SPLENDID!', 'GREAT!', 'PHEW!'][g.rows.length - 1] : 'THE WORD WAS ' + g.answer}</h3>
          <div className="wdist">{g.stats.dist.map((n, i) => <div key={i}><span>{i + 1}</span><i style={{ width: 8 + (n / Math.max(1, ...g.stats.dist)) * 90 + '%' }}>{n}</i></div>)}</div>
          <small>PLAYED {g.stats.played} · WON {g.stats.wins} · STREAK {g.stats.streak} · BEST {g.stats.best}</small>
          <div className="chips"><button className="mg-btn go" onClick={copy}>{share || '📋 SHARE RESULT'}</button><button className="mg-btn" onClick={wordActions.again}>↻ PRACTICE AGAIN</button></div>
        </div>
      )}
    </div>
  )
}

// ---------- 2048 MERGE ----------
export function MergeLobby({ s, TopPlayers }) {
  const [n, setN] = useState(4)
  const p = s.profile, best = p.mergeBest || {}
  return (
    <div className="lobby">
      <div className="lobbyL">
        <h4>1 · CHOOSE A BOARD</h4>
        <div className="modegrid">{[[3, '3×3', 'Tiny and brutal. Score ×3.'], [4, '4×4', 'The classic.'], [5, '5×5', 'Roomy. Aim for 4096. Score ×0.6.']].map(([v, nm, d]) => <button key={v} className={'modecard ' + (n === v ? 'sel' : '')} onClick={() => setN(v)}><div className="vs"><span>🔢</span></div><strong>{nm}</strong><small>{d} · BEST {fmt(best[v] || 0)}</small></button>)}</div>
        <div className="lobbyinfo"><b>2048 MERGE</b> · Slide the whole board with the arrow keys, WASD or a swipe. Equal tiles merge into one. Reach <b>2048</b>. You get 3 undos, 2 hammers (smash any tile) and 1 shuffle per game.</div>
        <button className="big" onClick={() => mergeActions.start({ n })}>▶ PLAY</button>
      </div>
      <div className="lobbyR">
        <div className="panel"><h4>MY MERGE STATS</h4><div className="kv"><Stat k="GAMES" v={p.mergeGames || 0} /><Stat k="BIGGEST TILE" v={p.mergeMax || 0} /></div></div>
        <TopPlayers s={s} initial="merge" compact fixed />
      </div>
    </div>
  )
}
const TCOL = { 2: ['#eee4da', '#776e65'], 4: ['#ede0c8', '#776e65'], 8: ['#f2b179', '#fff'], 16: ['#f59563', '#fff'], 32: ['#f67c5f', '#fff'], 64: ['#f65e3b', '#fff'], 128: ['#edcf72', '#fff'], 256: ['#edcc61', '#fff'], 512: ['#edc850', '#fff'], 1024: ['#edc53f', '#fff'], 2048: ['#edc22e', '#fff'] }
export function MergeUI() {
  const g = useSyncExternalStore(subscribeMerge, getMergeSnap)
  const start = useRef(null)
  if (!g || g.mode === 'idle') return null
  const n = g.n, pct = 100 / n
  const down = (e) => { start.current = [e.clientX, e.clientY] }
  const up = (e) => { if (!start.current) return; const dx = e.clientX - start.current[0], dy = e.clientY - start.current[1]; start.current = null; if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return; if (Math.abs(dx) > Math.abs(dy)) mergeActions.move(dx > 0 ? 1 : 0); else mergeActions.move(dy > 0 ? 3 : 2) }
  return (
    <div className="screen menu mg-dom">
      <div className="mg-domhead"><button className="mg-btn" onClick={mergeActions.quit}>◀ DASHBOARD</button><h2>2048 MERGE <small>{n}×{n}</small></h2><span className="grow" /><div className="mscore"><small>SCORE</small><b>{fmt(g.score)}</b></div><div className="mscore"><small>BEST</small><b>{fmt(g.best)}</b></div></div>
      <div className="mboard" style={{ touchAction: 'none' }} onPointerDown={down} onPointerUp={up} onPointerCancel={() => { start.current = null }}>
        {Array.from({ length: n * n }).map((_, i) => <div key={i} className="mcell" style={{ left: (i % n) * pct + '%', top: Math.floor(i / n) * pct + '%', width: pct + '%', height: pct + '%' }} onClick={() => mergeActions.tap(Math.floor(i / n), i % n)} />)}
        {g.tiles.map((t) => { const [bg, fg] = TCOL[Math.min(t.v, 2048)] || ['#3c3a32', '#fff']; return <div key={t.id} className={'mtile' + (t.nw ? ' nw' : '') + (t.mg ? ' mg' : '') + (g.tool === 'hammer' ? ' hit' : '')} style={{ left: t.c * pct + '%', top: t.r * pct + '%', width: pct + '%', height: pct + '%', background: bg, color: fg, fontSize: (t.v >= 1000 ? 2.6 : t.v >= 100 ? 3.4 : 4.4) * (4 / n) + 'cqw' }} onClick={() => mergeActions.tap(t.r, t.c)}>{t.v}</div> })}
        {(g.over || g.won) && <div className="mover"><h3>{g.over ? 'GAME OVER' : '2048! YOU WIN'}</h3><div className="chips">{g.won && !g.over && <button className="mg-btn go" onClick={mergeActions.keepGoing}>KEEP GOING</button>}<button className="mg-btn" onClick={mergeActions.again}>↻ NEW GAME</button>{g.over && g.undo > 0 && <button className="mg-btn" onClick={mergeActions.undo}>↶ UNDO</button>}</div></div>}
      </div>
      <div className="mtools">
        <button className="mg-btn" disabled={g.undo <= 0} onClick={mergeActions.undo}>↶ UNDO ({g.undo})</button>
        <button className={'mg-btn ' + (g.tool === 'hammer' ? 'on' : '')} disabled={g.hammer <= 0} onClick={mergeActions.hammerMode}>🔨 HAMMER ({g.hammer}){g.tool === 'hammer' ? ': TAP A TILE' : ''}</button>
        <button className="mg-btn" disabled={g.shuffle <= 0} onClick={mergeActions.shuffle}>🔀 SHUFFLE ({g.shuffle})</button>
      </div>
      <small className="dim">ARROWS / WASD / SWIPE · Z UNDO · ESC DASHBOARD</small>
    </div>
  )
}

export const MORE_MODES = ['hockey', 'pool', 'td', 'rogue', 'rhythm', 'word', 'merge']
export function MoreHUD({ mode, openHelp }) {
  if (mode === 'hockey') return <HockeyHUD openHelp={openHelp} />
  if (mode === 'pool') return <PoolHUD openHelp={openHelp} />
  if (mode === 'td') return <TdHUD openHelp={openHelp} />
  if (mode === 'rogue') return <RogueHUD openHelp={openHelp} />
  if (mode === 'rhythm') return <RhythmHUD openHelp={openHelp} />
  if (mode === 'word') return <WordUI />
  if (mode === 'merge') return <MergeUI />
  return null
}
