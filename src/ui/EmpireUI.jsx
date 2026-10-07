'use client'
// EMPIRE RISE: lobby, HUD (resources, build bar, building panel, minimap) and the end screen.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { subscribeEmpire, getEmpireSnap, empireActions, EM, BDEF, BORDER, UDEF, HALL_UP, HALL_NAME, TEAM, mapInfo, MW, MH, T, SIZES } from '../game/empire.js'
import { useTouchPrimary } from './platform.js'
import { EMCAMP } from '../game/empirestory.js'

const fmt = (n) => Math.floor(n).toLocaleString()
const RES_ICO = { food: '🍞', wood: '🪵', stone: '🪨', gold: '🪙' }
const costStr = (c) => Object.entries(c).map(([k, v]) => RES_ICO[k] + v).join(' ')
const canPay = (res, c) => !!res && Object.entries(c).every(([k, v]) => (res[k] || 0) >= v)
const Stat = ({ k, v }) => <><span>{k}</span><b>{v}</b></>

export function EmpireLobby({ s, TopPlayers, onInvite }) {
  const [ai, setAi] = useState(3), [diff, setDiff] = useState(2), [mode, setMode] = useState('camp'), [size, setSize] = useState(s.profile.empireSize || 4)
  const p = s.profile, cleared = (p.empireCamp && p.empireCamp.cleared) || 0
  const [sel, setSel] = useState(Math.min(cleared, EMCAMP.length - 1))
  const sc = EMCAMP[sel]
  return (
    <div className="lobby"><div className="lobbyL">
      <div className="chips">{[['camp', '📖 CAMPAIGN: FROM EMBER TO EMPIRE'], ['skirm', '⚔ SKIRMISH']].map(([k, n]) => <button key={k} className={'chip ' + (mode === k ? 'sel' : '')} onClick={() => setMode(k)}>{n}</button>)}</div>
      {mode === 'camp' ? (
        <>
          <h4>CHOOSE A SCENARIO <small className="dim">({cleared}/{EMCAMP.length} CLEARED)</small></h4>
          <div className="chapgrid">{EMCAMP.map((c, i) => { const open = i <= cleared; return <button key={c.id} className={'chapcard ' + (sel === i ? 'sel ' : '') + (open ? '' : 'locked')} disabled={!open} onClick={() => setSel(i)}><b>{open ? c.id : '🔒'}</b><strong>{c.name}</strong><small>{open ? c.sub.split('·')[1] : 'CLEAR SCENARIO ' + i}</small><em>{cleared > i ? '✔ CLEARED' : ''}</em></button> })}</div>
          <div className="lobbyinfo"><b>{sc.name}</b> · {sc.brief}<ul className="objl">{sc.objectives.map((o, i) => <li key={i}>🎯 {o.text}</li>)}</ul></div>
          <div className="chips"><button className="big" onClick={() => empireActions.start({ scen: sel })}>▶ BEGIN SCENARIO {sc.id}</button></div>
        </>
      ) : (
        <>
          <h4>HOW MANY RIVAL KINGDOMS?</h4>
          <div className="chips">{[[1, '1 RIVAL'], [2, '2 RIVALS'], [3, '3 RIVALS']].map(([v, n]) => <button key={v} className={'chip ' + (ai === v ? 'sel' : '')} onClick={() => setAi(v)}>{n}</button>)}</div>
          <h4>MAP SIZE <small className="dim">(x{size} each way = {96 * size} x {96 * size} tiles)</small></h4>
          <div className="chips">{SIZES.map((v) => <button key={v} className={'chip ' + (size === v ? 'sel' : '')} onClick={() => { setSize(v); s.profile.empireSize = v }}>{v === 1 ? 'x1 CLASSIC' : v === 20 ? 'x20 CONTINENT' : 'x' + v}</button>)}</div>
          <h4>RIVAL STRENGTH</h4>
          <div className="chips">{[[1, 'GENTLE'], [2, 'FIERCE'], [3, 'BRUTAL']].map(([v, n]) => <button key={v} className={'chip ' + (diff === v ? 'sel' : '')} onClick={() => setDiff(v)}>{n}</button>)}</div>
          <div className="chips"><button className="big" onClick={() => empireActions.start({ ai, diff, size })}>▶ BUILD MY KINGDOM</button><button className="big sec" onClick={onInvite}>🌐 INVITE FRIENDS (UP TO 4 KINGDOMS)</button></div>
        </>
      )}
      <div className="lobbyinfo"><b>EMPIRE RISE</b> · You start with a small <b>village</b> on a huge map. Build farms, lumber camps, quarries and mines, train soldiers, and upgrade your hall: <b>VILLAGE → TOWN → CITY → EMPIRE</b>. Rival kingdoms and <b>raiders</b> will attack you, so build towers and walls. Win by destroying every rival hall, or by building the <b>Wonder</b> and holding it for 2.5 minutes.</div>
      <div className="lobbyinfo"><b>CONTROLS</b> · <b>Drag</b> or <b>WASD</b> scroll · <b>wheel / + −</b> zoom · click a build icon (or <b>1-9</b>), then click the grass · click your barracks to train (<b>T</b> sword, <b>Y</b> archer) · <b>U</b> upgrade hall · <b>right-click</b> (or ⚔ ATTACK then click) sends your army · <b>H</b> recall · <b>SPACE</b> jump home · <b>F</b> speed. Phone: drag to scroll, buttons at the bottom.</div>
    </div><div className="lobbyR">
      <div className="panel"><h4>MY EMPIRE STATS</h4><div className="kv"><Stat k="GAMES" v={p.empireGames || 0} /><Stat k="VICTORIES" v={p.empireWins || 0} /><Stat k="HIGHEST RANK" v={HALL_NAME[p.empireHall || 1] || 'VILLAGE'} /></div></div>
      <TopPlayers s={s} initial="empire" compact fixed />
    </div></div>
  )
}

function Minimap({ ver }) {
  const ref = useRef(), base = useRef(null)
  useEffect(() => {
    const c = ref.current; if (!c) return
    const info = mapInfo(); if (!info.terr) return
    if (!base.current || base.current.seedKey !== EM.seed) {
      const o = document.createElement('canvas'); o.width = MW; o.height = MH; const g = o.getContext('2d'), id = g.createImageData(MW, MH)
      const C = [[28, 70, 32], [14, 50, 22], [80, 80, 96], [200, 160, 30], [18, 50, 120]]
      for (let j = 0; j < MH; j++) for (let i = 0; i < MW; i++) { const t = info.terr[j * MW + i], k = ((MH - 1 - j) * MW + i) * 4, col = C[t]; id.data[k] = col[0]; id.data[k + 1] = col[1]; id.data[k + 2] = col[2]; id.data[k + 3] = 255 }
      g.putImageData(id, 0, 0); o.seedKey = EM.seed; base.current = o
    }
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false
    g.drawImage(base.current, 0, 0, c.width, c.height)
    const sc = c.width / MW
    for (const b of info.B) { g.fillStyle = TEAM[b.owner][0]; g.fillRect(b.x * sc, (MH - b.y - b.w) * sc, Math.max(2, b.w * sc), Math.max(2, b.w * sc)) }
    for (const u of info.U) { g.fillStyle = u.owner >= 0 ? TEAM[u.owner][0] : '#ff8a3a'; g.fillRect((u.x / T) * sc - 0.5, (MH - u.y / T) * sc - 0.5, 1.5, 1.5) }
    const z = info.cam.z; g.strokeStyle = '#fff'; g.lineWidth = 1; g.strokeRect(((info.cam.x - 50 / z) / T) * sc, (MH - (info.cam.y + 28 / z) / T) * sc, (100 / z / T) * sc, (56 / z / T) * sc)
  }, [ver])
  const jump = (e) => { const r = ref.current.getBoundingClientRect(); const i = ((e.clientX - r.left) / r.width) * MW, j = MH - ((e.clientY - r.top) / r.height) * MH; empireActions.jump(i * T, j * T) }
  return <canvas ref={ref} className="em-mini" width={132} height={132} onPointerDown={(e) => { e.stopPropagation(); jump(e) }} onPointerMove={(e) => { if (e.buttons) jump(e) }} />
}
function Surface({ onPtr }) {
  const ref = useRef()
  const w = (e) => { const r = ref.current.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * 100 - 50, 28 - ((e.clientY - r.top) / r.height) * 56] }
  return <div ref={ref} className="mg-surface" style={{ cursor: 'grab' }} onContextMenu={(e) => e.preventDefault()}
    onWheel={(e) => empireActions.zoom(e.deltaY < 0 ? 1.12 : 1 / 1.12)}
    onPointerDown={(e) => { e.stopPropagation(); try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* ignore */ } onPtr('down', ...w(e), e.button) }}
    onPointerMove={(e) => onPtr('move', ...w(e), e.button)} onPointerUp={(e) => onPtr('up', ...w(e), e.button)} onPointerCancel={(e) => onPtr('up', ...w(e), e.button)} />
}
export function EmpireHUD({ openHelp }) {
  const g = useSyncExternalStore(subscribeEmpire, getEmpireSnap)
  const touch = useTouchPrimary()
  if (!g || g.mode === 'idle') return null
  const mins = Math.floor(g.t / 60), secs = String(g.t % 60).padStart(2, '0')
  const sel = g.sel
  return (
    <div className="hud mg-hud em-hud">
      {g.env && <div className="renv" style={{ top: '5.2cqw', left: 'auto', right: '2cqw', transform: 'none' }}>{g.night > 0.5 ? '🌙' : '☀'} {g.env}</div>}
      {g.mode === 'play' && <Surface onPtr={(t, x, y, b) => empireActions.pointer(t, x, y, b)} />}
      <div className="em-top">
        {Object.entries(RES_ICO).map(([k, ico]) => <span key={k} title={k}>{ico} <b>{g.res ? g.res[k] : 0}</b></span>)}
        <span title="Population">👥 <b className={g.pop >= g.cap ? 'full' : ''}>{g.pop}/{g.cap}</b></span>
        <span title="Your army">⚔ <b>{g.army}</b></span>
        <span className="rank">🏰 <b>{g.hallName}</b></span>
        <span className="grow" />
        <span className="dim">⏱ {mins}:{secs}</span>
        {g.raid > 0 ? <span className="raid">⚠ RAIDERS FROM {g.raidDir} IN {g.raid}s</span> : <span className="dim">NEXT RAID {g.nextRaid}s</span>}
        {g.wonder && <span className={g.wonder.mine ? 'ok' : 'raid'}>🗽 {g.wonder.owner}: {g.wonder.t}s</span>}
        {!g.net && <button className="mg-btn" onClick={empireActions.setSpeed}>{g.speed}×</button>}
        {!g.net && <button className="mg-btn" onClick={() => empireActions.pause()}>⏸</button>}
        {g.net && <button className="mg-btn" onClick={empireActions.quit}>✕</button>}
      </div>
      <div className="em-players">{g.players.map((p) => <div key={p.i} className={'em-pl ' + (p.alive ? '' : 'dead ') + (p.me ? 'me' : '')} style={{ '--c': p.color }}><i />{p.name}<small>{p.alive ? HALL_NAME[p.lv] + ' · ⚔' + p.army : 'FALLEN'}</small></div>)}</div>
      {g.scen && <div className="em-obj"><h4>🎯 {g.scen.name}</h4>{g.obj.map((o, i) => <div key={i} className={o.done ? 'done' : ''}>{o.done ? '✔' : '○'} {o.text}</div>)}</div>}
      {g.beat && !g.tale && <div className="mg-beat" style={{ '--c': g.beat.color }} key={g.beat.sub}><b>{g.beat.text}</b><span>{g.beat.sub}</span></div>}
      {g.tale && (
        <div className="storyfull talebox" onClick={empireActions.nextTale}>
          <div className="sbox" style={{ '--c': g.tale.who[1] }}><div className="sport">{g.tale.who[2]}</div><div className="stext"><b>{g.tale.who[0]}</b><p>{g.tale.text}</p></div><div className="snext">{g.tale.i < g.tale.n - 1 ? 'NEXT ▶' : g.tale.kind === 'intro' ? 'BEGIN ▶' : 'CONTINUE ▶'}</div></div>
          <div className="sbtns"><button className="big sec" onClick={(e) => { e.stopPropagation(); empireActions.skipTale() }}>SKIP ▶▶</button></div>
        </div>
      )}
      {g.msg && !g.tale && <div className="mg-banner" style={{ '--c': g.msg.color }} key={g.msg.text}><h2>{g.msg.text}</h2>{g.msg.sub && <p>{g.msg.sub}</p>}</div>}
      <div className="em-side">
        <Minimap ver={g.ver} />
        <div className="em-zoom"><button className="mg-btn" onClick={() => empireActions.zoom(1.2)}>＋</button><button className="mg-btn" onClick={() => empireActions.zoom(1 / 1.2)}>－</button><button className="mg-btn" onClick={() => empireActions.jump(...homePos())} title="Jump home">🏰</button></div>
      </div>
      {sel && sel.mine && (
        <div className="em-sel">
          <h4>{sel.name}{sel.type === 'hall' ? ' · ' + HALL_NAME[sel.lv] : ''}</h4>
          <small>HP {sel.hp}/{sel.max}{!sel.built ? ' · BUILDING…' : ''}{sel.rate ? ' · ' + sel.rate : ''}</small>
          {sel.type === 'hall' && g.up && <button className="mg-btn go" disabled={!canPay(g.res, g.up)} onClick={empireActions.upgrade}>⬆ BECOME A {HALL_NAME[sel.lv + 1]}<br /><small>{costStr(g.up)}</small></button>}
          {sel.type === 'hall' && !g.up && <small>THE GREATEST EMPIRE! BUILD THE WONDER.</small>}
          {sel.type === 'barracks' && sel.built && (
            <div className="em-train">{Object.entries(UDEF).filter(([k, u]) => u.cost).map(([k, u]) => <button key={k} className="mg-btn" disabled={!canPay(g.res, u.cost) || g.hallLv < u.lv} onClick={() => empireActions.train(k)} title={u.name}>{u.ico} {u.name}<small>{g.hallLv < u.lv ? 'NEEDS ' + HALL_NAME[u.lv] : costStr(u.cost)}</small></button>)}
              {sel.q.length > 0 && <small>TRAINING: {sel.q.map((u) => UDEF[u].ico).join(' ')}</small>}</div>
          )}
        </div>
      )}
      {sel && !sel.mine && <div className="em-sel"><h4>ENEMY {sel.name}</h4><small>HP {sel.hp}/{sel.max}</small><button className="mg-btn go" onClick={() => { EM.atk = true; empireActions.attackMode(); }}>⚔ SEND ARMY</button></div>}
      <div className="em-bar">
        {BORDER.map((t, i) => { const d = BDEF[t], locked = g.hallLv < d.lv; return <button key={t} className={'em-b ' + (g.build === t ? 'sel ' : '') + (locked ? 'lock' : (!canPay(g.res, d.cost) ? 'poor' : ''))} disabled={locked} onClick={() => empireActions.setBuild(t)} title={d.desc || ''}><b>{i + 1}</b><span>{d.ico}</span><em>{d.name}</em><small>{locked ? 'NEEDS ' + HALL_NAME[d.lv] : costStr(d.cost)}</small></button> })}
        <button className={'em-b act ' + (g.atk ? 'sel' : '')} onClick={empireActions.attackMode}><b>G</b><span>⚔</span><em>ATTACK</em><small>{g.atk ? 'CLICK TARGET' : 'ARMY ' + g.army}</small></button>
        <button className="em-b act" onClick={empireActions.recall}><b>H</b><span>🛡</span><em>RECALL</em><small>DEFEND</small></button>
      </div>
      {g.scen && g.hint && !g.build && !g.tale && <div className="mg-hint">💡 {g.hint}</div>}
      {g.build && <div className="mg-hint">{BDEF[g.build].name}: CLICK THE GRASS TO PLACE · SHIFT KEEPS BUILDING · ESC CANCELS</div>}
      {!g.build && !touch && g.t < 40 && <div className="mg-hint">DRAG TO SCROLL · PICK A BUILDING BELOW · RIGHT-CLICK SENDS YOUR ARMY</div>}
      {g.mode === 'over' && g.over && !g.tale && (
        <div className="screen victory">
          <h1 className={g.over.win ? 'gold' : 'red'}>{g.over.left ? 'THE HOST LEFT' : g.over.win ? 'YOUR EMPIRE STANDS!' : 'YOUR KINGDOM HAS FALLEN'}</h1>
          <h3>{g.over.win ? 'VICTORY BY ' + g.over.how : g.over.winnerName ? g.over.winnerName + ' WON (' + g.over.how + ')' : g.over.how}</h3>
          <ul><li><span>TIME</span><b>{Math.floor(g.over.time / 60)}:{String(g.over.time % 60).padStart(2, '0')}</b></li><li><span>HIGHEST RANK</span><b>{HALL_NAME[g.over.hallLv] || '-'}</b></li><li><span>ENEMIES DEFEATED</span><b>{g.over.kills}</b></li><li className="bonus"><span>SCORE</span><b>{fmt(g.over.score)}</b></li></ul>
          {g.over.next && <h3>NEXT: {g.over.next}</h3>}<button className="big" onClick={empireActions.rematch}>{g.over.next ? '▶ NEXT SCENARIO' : '↻ NEW GAME'}</button><button className="big sec" onClick={empireActions.quit}>DASHBOARD</button>
        </div>
      )}
      {g.paused && <div className="screen pause"><h1>PAUSED</h1><button className="big" onClick={empireActions.resume}>RESUME</button><button className="big sec" onClick={() => openHelp('empire')}>❓ HOW TO PLAY</button><button className="big sec" onClick={empireActions.quit}>QUIT TO DASHBOARD</button></div>}
    </div>
  )
}
const homePos = () => { const h = EM.B.find((b) => b.owner === EM.me && b.type === 'hall'); return h ? [(h.x + 1.5) * T, (h.y + 1.5) * T] : [96, 96] }
