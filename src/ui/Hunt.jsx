'use client'
// Lobby, HUD and dawn shop for 13 DAYS OF HELL / WATCH YOUR BACK.
import { useSyncExternalStore } from 'react'
import { subscribeHunt, getHuntSnap, huntActions, SHOP, priceOf, HT, DAYS, AW, AH } from '../game/hunt.js'
import { Surface, PauseScreen } from './MoreGames2.jsx'
import { useTouchPrimary } from './platform.js'

const fmt = (n) => Math.floor(n || 0).toLocaleString()
const clock = (t) => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0')

export function HuntLobby({ s, TopPlayers, onInvite }) {
  const p = s.profile
  return (
    <div className="lobby"><div className="lobbyL">
      <div className="lobbyinfo"><b>13 DAYS OF HELL</b> · Thirteen nights across a huge haunted forest: a cabin, a graveyard, a wrecked car and supply crates to smash for loot. Three weapons, six kinds of monsters, a minimap, and a boss. Fight until dawn, spend your scrap in the shop, and face <b>THE HOLLOW KING</b> on night 13. You only see what your flashlight touches; <b>STALKERS</b> creep up from <b>behind</b>, hit twice as hard from there, and freeze when you look at them. <b>WATCH YOUR BACK</b> is one endless night where everything comes from behind. Play solo or with up to 3 hunters online.</div>
      <div className="chips">
        <button className="big" onClick={() => huntActions.start({ kind: 'days' })}>🌙 13 DAYS OF HELL</button>
        <button className="big sec" onClick={() => huntActions.start({ kind: 'back' })}>👁 WATCH YOUR BACK</button>
        <button className="big sec" onClick={onInvite}>🌐 HUNT WITH FRIENDS</button>
      </div>
      <div className="chips"><small>ONLINE MODE:</small><button className={'chip ' + ((s.profile.huntKind || 'days') === 'days' ? 'sel' : '')} onClick={() => { huntActions.setKind('days'); s.profile.huntKind = 'days' }}>13 DAYS</button><button className={'chip ' + (s.profile.huntKind === 'back' ? 'sel' : '')} onClick={() => { huntActions.setKind('back'); s.profile.huntKind = 'back' }}>WATCH YOUR BACK</button></div>
      <small className="hint">WASD move · mouse aim · click shoot · R reload · SPACE dash · F plant a mine · stand next to a downed friend to revive them</small>
    </div><div className="lobbyR">
      <div className="panel"><h4>MY HUNT</h4><div className="kv"><span>RUNS</span><b>{p.huntGames || 0}</b><span>BEST SCORE</span><b>{fmt(p.huntBest)}</b><span>FURTHEST DAY</span><b>{Math.min(DAYS, p.huntDay || 0)}/{DAYS}</b><span>13 DAYS CLEARED</span><b>{p.huntWins || 0}</b><span>LONGEST NIGHT</span><b>{clock(p.huntBackBest || 0)}</b></div></div>
      <TopPlayers s={s} initial="hunt" compact fixed />
    </div></div>
  )
}

function Pad({ name, children, cls }) {
  const on = (v) => (e) => { e.stopPropagation(); e.preventDefault(); huntActions.press(name, v) }
  return <button className={'sxpad ' + (cls || '')} onPointerDown={on(true)} onPointerUp={on(false)} onPointerCancel={on(false)} onPointerLeave={on(false)} onContextMenu={(e) => e.preventDefault()}>{children}</button>
}

export function HuntHUD({ openHelp }) {
  const g = useSyncExternalStore(subscribeHunt, getHuntSnap)
  const touch = useTouchPrimary()
  if (!g || g.mode === 'idle' || !g.me) return null
  const m = g.me, shop = g.phase === 'dawn' && g.kind === 'days' && g.mode === 'play'
  const p = HT.players[HT.me]
  return (
    <div className={'hud mg-hud hunthud' + (g.behind && g.behind.d < 14 ? ' scare' : '') + (m.hp < m.max * 0.3 ? ' hurt' : '')}>
      {g.mode === 'play' && !g.paused && !shop && <Surface onPtr={(t, x, y) => huntActions.pointer(t, x, y)} cursor="crosshair" />}
      <div className="mg-topbar">
        <span>{g.kind === 'days' ? '🌙 DAY ' + g.day + '/' + g.days : '👁 ' + clock(g.t)}</span>
        <span>SCORE <b>{fmt(g.score)}</b></span><span>KILLS <b>{g.kills}</b></span>
        <span>{g.phase === 'night' ? (g.kind === 'days' ? 'DAWN IN ' + g.nightLeft + 's · ' + g.left + ' LEFT' : g.left + ' NEAR') : 'DAWN'}</span>
        <span className="grow" />
        {g.mode === 'play' && !g.paused && !g.online && <button className="mg-btn" onClick={() => huntActions.pause()}>⏸</button>}
      </div>
      <div className="hhp"><i style={{ width: Math.max(0, (m.hp / m.max) * 100) + '%' }} /><span>♥ {Math.ceil(m.hp)}/{m.max}</span></div>
      <div className="hammo"><small>{m.wname} · keys 1-3</small><b>{m.reload ? 'RELOAD…' : m.mag}</b><small>/ {m.reserve} · 💣 {m.mines} · ⚙ {m.scrap}</small></div>
      {g.mini && <div className="hmini">{g.mini.c.map((c, i) => <u key={'c' + i} style={{ left: ((c[0] + AW) / (2 * AW)) * 100 + '%', top: (1 - (c[1] + AH) / (2 * AH)) * 100 + '%' }} />)}{g.mini.m.map((q, i) => <i key={'m' + i} className={q[2] ? 'k' : ''} style={{ left: ((q[0] + AW) / (2 * AW)) * 100 + '%', top: (1 - (q[1] + AH) / (2 * AH)) * 100 + '%' }} />)}{g.mini.p.map((q, i) => <b key={'p' + i} className={(q[2] ? 'me ' : '') + (q[3] ? 'dn' : '')} style={{ left: ((q[0] + AW) / (2 * AW)) * 100 + '%', top: (1 - (q[1] + AH) / (2 * AH)) * 100 + '%' }} />)}</div>}
      {g.team.length > 1 && <div className="hteam">{g.team.map((t, i) => <div key={i} className={t.me ? 'me' : ''} style={{ borderColor: t.c }}>{t.n.slice(0, 8)}<i style={{ width: (t.down ? 0 : (t.hp / t.max) * 100) + '%', background: t.c }} />{t.down ? ' ☠' : ''}</div>)}</div>}
      {g.boss && <div className="hboss"><b>THE HOLLOW KING</b><i><u style={{ width: Math.max(0, (g.boss.hp / g.boss.max) * 100) + '%' }} /></i></div>}
      {g.behind && g.phase === 'night' && <div className="hbehind" style={{ '--r': (-g.behind.rel * 180 / Math.PI) + 'deg', opacity: Math.max(0.35, 1 - g.behind.d / 24) }}><b>▲</b><span>BEHIND YOU!</span></div>}
      {m.down && <div className="mg-banner" style={{ '--c': '#ff4a4a' }}><h2>YOU ARE DOWN</h2><p>{g.team.length > 1 ? 'Wait for a friend to reach you…' : ''}</p></div>}
      {g.msg && !m.down && <div className="mg-banner" style={{ '--c': '#ff8a2a' }}><h2>{g.msg.text}</h2>{g.msg.sub && <p>{g.msg.sub}</p>}</div>}
      {touch && g.mode === 'play' && !shop && (
        <>
          <div className="sxdpad"><Pad name="left">◀</Pad><div className="sxv"><Pad name="up">▲</Pad><Pad name="down">▼</Pad></div><Pad name="right">▶</Pad></div>
          <div className="sxacts"><Pad name="dash" cls="a">DASH</Pad><Pad name="reload" cls="b">RELOAD</Pad><Pad name="mine" cls="c">MINE</Pad><Pad name="w1" cls="d">1</Pad><Pad name="w2" cls="d">2</Pad><Pad name="w3" cls="d">3</Pad></div>
          <div className="mg-hint">TAP / DRAG TO AIM AND SHOOT</div>
        </>
      )}
      {shop && (
        <div className="screen hshop" onPointerDown={(e) => e.stopPropagation()}>
          <h1>🌅 DAWN · DAY {g.day}</h1>
          <p>⚙ <b>{m.scrap}</b> scrap · next night in {g.shopLeft}s</p>
          <div className="shopgrid">
            {SHOP.map((it) => { const lv = p ? p.up[it.k] || 0 : 0, cost = p ? priceOf(it, p) : it.base, maxed = it.max < 99 && lv >= it.max; return (
              <button key={it.k} className="shopitem" disabled={maxed || m.scrap < cost} onClick={() => huntActions.buy(it.k)}>
                <b>{it.icon}</b><span>{it.name}{it.max < 99 ? ' ' + lv + '/' + it.max : ''}</span><small>{it.desc}</small><em>{maxed ? 'MAX' : cost + ' ⚙'}</em>
              </button>) })}
          </div>
          <button className="big" disabled={g.ready} onClick={huntActions.ready}>{g.ready ? 'WAITING FOR THE OTHERS…' : g.online ? '✔ READY' : '🌙 START THE NIGHT'}</button>
        </div>
      )}
      {g.paused && <PauseScreen resume={huntActions.resume} quit={huntActions.quit} help={() => openHelp('hunt')} />}
      {g.mode === 'over' && g.over && (
        <div className="screen victory"><h1 className={g.over.win ? 'gold' : 'red'}>{g.over.win ? 'YOU SURVIVED 13 DAYS!' : g.over.kind === 'back' ? 'THEY GOT YOU FROM BEHIND' : 'YOU DID NOT SEE THE DAWN'}</h1>
          <ul><li><span>SCORE</span><b>{fmt(g.over.score)}</b></li>{g.over.kind === 'days' && <li><span>DAY REACHED</span><b>{g.over.day}/{g.days}</b></li>}<li><span>KILLS</span><b>{g.over.kills}</b></li><li><span>YOUR KILLS</span><b>{g.over.mine}</b></li><li><span>TIME</span><b>{clock(g.over.time)}</b></li></ul>
          <button className="big" onClick={huntActions.rematch}>↻ AGAIN</button><button className="big sec" onClick={huntActions.quit}>DASHBOARD</button></div>
      )}
    </div>
  )
}
