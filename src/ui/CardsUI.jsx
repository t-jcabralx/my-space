'use client'
import { memo, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { sfx, speak } from '../game/audio.js'
import { subscribeCards, getCardsSnap, cardsActions } from '../game/cards/core.js'

const SYM = { C: '♣', S: '♠', H: '♥', D: '♦' }
const UCOL = { R: '#e8384a', Y: '#f2c21a', G: '#2fb85a', B: '#2f6df0', W: '#20242c' }
const UGLYPH = { S: '⊘', R: '⇄', D: '+2', W: '★', W4: '+4' }

function Face({ f }) {
  if (f.kind === 'uno') {
    const g = UGLYPH[f.value] || f.value
    const wild = f.color === 'W'
    return (
      <div className={'pcf uno' + (wild ? ' wild' : '')} style={{ '--c': UCOL[f.color] }}>
        <span className="cn tl">{g}</span>
        <div className="uoval"><b>{g}</b></div>
        <span className="cn br">{g}</span>
      </div>
    )
  }
  const red = f.suit === 'H' || f.suit === 'D'
  const face = ['J', 'Q', 'K'].includes(f.rank)
  return (
    <div className={'pcf std' + (red ? ' red' : '')}>
      <span className="cn tl"><b>{f.rank}</b><i>{SYM[f.suit]}</i></span>
      <div className="cmid">{face ? <><em>{f.rank === 'K' ? '♚' : f.rank === 'Q' ? '♛' : '♝'}</em><u>{SYM[f.suit]}</u></> : f.rank === 'A' ? <strong>{SYM[f.suit]}</strong> : <span>{SYM[f.suit]}</span>}</div>
      <span className="cn br"><b>{f.rank}</b><i>{SYM[f.suit]}</i></span>
    </div>
  )
}
const PCard = memo(function PCard({ c, onClick }) {
  return (
    <div
      className={'pc' + (c.up ? ' up' : '') + (c.glow ? ' glow' : '') + (c.sel ? ' sel' : '') + (c.dim ? ' dim' : '') + (c.mine ? ' mine' : '')}
      style={{ '--x': c.x + '%', '--y': c.y + '%', '--r': c.rot + 'deg', '--s': c.s, zIndex: Math.round(c.z * 10) }}
      onClick={() => onClick(c.id)}
    >
      <div className="pc-in">
        <div className="pc-front"><Face f={c.face} /></div>
        <div className={'pc-back ' + (c.face.kind === 'uno' ? 'ubk' : 'sbk')}><span>{c.face.kind === 'uno' ? 'UNO' : '♠'}</span></div>
      </div>
    </div>
  )
}, (a, b) => a.c.x === b.c.x && a.c.y === b.c.y && a.c.rot === b.c.rot && a.c.s === b.c.s && a.c.up === b.c.up && a.c.glow === b.c.glow && a.c.sel === b.c.sel && a.c.dim === b.c.dim && a.c.z === b.c.z && a.c.face === b.c.face)

function Confetti({ id }) {
  const bits = useMemo(() => Array.from({ length: 70 }, (_, i) => ({ l: Math.random() * 100, d: Math.random() * 0.8, t: 2.2 + Math.random() * 1.8, c: ['#ffe84a', '#3de8ff', '#ff4de1', '#3dff7a', '#ff6a6a', '#ffffff'][i % 6], r: Math.random() * 360, w: 6 + Math.random() * 6, x: (Math.random() - 0.5) * 30 })), [id])
  if (!id) return null
  return <div className="confetti" key={id}>{bits.map((b, i) => <i key={i} style={{ left: b.l + '%', animationDelay: b.d + 's', animationDuration: b.t + 's', background: b.c, width: b.w, height: b.w * 1.6, '--rx': b.r + 'deg', '--dx': b.x + 'cqw' }} />)}</div>
}

export default function CardsHUD({ SoundBtn, openHelp, TopPlayersMini }) {
  const s = useSyncExternalStore(subscribeCards, getCardsSnap)
  const [aim, setAim] = useState(false)
  const seen = useRef(null)
  useEffect(() => {
    const rs = (s && s.reacts) || []
    if (seen.current === null) { seen.current = new Set(rs.map((r) => r.id)); return }
    for (const r of rs) {
      if (seen.current.has(r.id)) continue
      seen.current.add(r.id)
      if (r.kind === 'banana') { sfx('slip'); setTimeout(() => sfx('splat'), 560) }
      else if (r.kind === 'tease') sfx('slip')
      else { sfx('ha'); if (r.kind === 'rofl') speak('Hahahaha!', 1.5, 1.3) }
    }
  }, [s])
  if (!s || s.mode === 'idle' || !s.cards) return null
  const click = (id) => cardsActions.click(id)
  const over = s.mode === 'over' && s.over
  const color = s.center && s.center.color
  return (
    <div className="hud cardhud">
      <div className="cardtable">
        {/* header */}
        <div className="ct-top">
          <div className="ct-title"><b>{s.name}</b><small>{s.info}</small></div>
          <div className="ct-right"><div className="ct-chips">🪙 {Number(s.chips || 0).toLocaleString()}</div><SoundBtn /></div>
        </div>
        {s.msg && <div className="ct-mid" style={s.id === 'lucky9' || s.id === 'baccarat' ? { top: '31%' } : s.id === 'poker' ? { top: '57%' } : undefined}><div className="ct-msg" key={s.msg}>{s.msg}</div></div>}
        {s.id === 'uno' && s.timer != null && <div className={'uno-timer' + (s.timer <= 5 ? ' low' : '')}>⏱ {s.timer}</div>}
        {/* UNO centre decorations */}
        {s.id === 'uno' && s.center && (
          <div className="uno-center" style={{ '--c': UCOL[color] }}>
            <div className={'uno-ring' + (s.center.dir < 0 ? ' rev' : '')} />
            {s.center.pend > 0 && <div className="uno-pend" key={s.center.pend}>+{s.center.pend}</div>}
            <div className="uno-cap">{{ R: 'RED', Y: 'YELLOW', G: 'GREEN', B: 'BLUE' }[color]}</div>
          </div>
        )}
        {s.id === 'pusoy' && s.center && (s.center.combo || s.center.sel) && (
          <div className="pusoy-tag" key={(s.center.combo || '') + (s.center.owner || '')}>{s.center.combo ? `${s.center.owner}: ${s.center.combo}` : 'LEAD ANYTHING'}</div>
        )}
        {s.id === 'tongits' && <div className="tong-stock">STOCK {s.stock}</div>}
        {s.labels && s.labels.map((l, i) => <div key={i} className={'ct-label' + (l.hot ? ' hot' : '')} style={{ left: l.x + '%', top: l.y + '%', color: l.color }}><b>{l.text}</b>{l.sub !== '' && l.sub !== undefined && <span>{l.sub}</span>}</div>)}
        {s.id === 'lucky9' && s.dealer && (
          <div className="seat dealer" style={{ left: '50%', top: '4%' }}>
            <div className="av">{s.dealer.avatar}</div><b>{s.dealer.name}</b>{s.dealer.val !== null && <span className="val">{s.dealer.val}</span>}{s.dealer.note && <em>{s.dealer.note}</em>}
          </div>
        )}
        {/* cards */}
        {s.cards.map((c) => <PCard key={c.id} c={c} onClick={click} />)}
        {/* seat plates */}
        {s.seats.map((p) => (
          <div key={p.id} className={'seat' + (p.turn ? ' turn' : '') + (p.human ? ' me' : '') + (p.danger ? ' danger' : '') + (aim && !p.human ? ' aimable' : '') + ((s.reacts || []).some((r) => r.kind === 'banana' && r.to === p.id && r.t < 2.1 && r.t > 1.2) ? ' hit' : '')} style={{ left: p.x + '%', top: p.y + '%', '--sx': p.x }} onClick={aim && !p.human ? () => { cardsActions.react('banana', p.id); setAim(false) } : undefined}>
            <div className="av">{p.avatar}</div>
            <div className="sn"><b>{p.name}</b>
              <small>{s.id === 'lucky9' || s.id === 'tongits' || s.id === 'baccarat' || s.id === 'poker' ? `🪙 ${Number(p.chips).toLocaleString()}` : s.id === 'pusoy' ? `${p.score} pts · ${p.count} cards` : `${p.score} pts · ${p.count} cards`}{s.id === 'tongits' ? ` · ${p.count} cards` : ''}</small>
            </div>
            {p.uno && <span className="badge uno">UNO!</span>}
            {p.val !== null && p.val !== undefined && <span className="val">{p.val}</span>}
            {p.status && <span className="badge">{p.status}</span>}
            {p.note && <span className="badge note">{p.note}</span>}
            {p.tag && <span className={'badge res ' + (p.tagKind || '').toLowerCase()} key={p.tag}>{p.tag}</span>}
            {(s.id === 'lucky9' || s.id === 'baccarat' || s.id === 'poker') && p.bet > 0 && <div className="betstack" key={p.bet}>{Array.from({ length: Math.min(5, 1 + Math.floor(p.bet / 100)) }, (_, i) => <i key={i} style={{ bottom: i * 4 }} />)}<span>{p.bet}</span></div>}
          </div>
        ))}
        {/* thrown bananas and laughs */}
        {(s.reacts || []).map((r) => {
          const from = s.seats.find((x) => x.id === r.from), to = r.to >= 0 ? s.seats.find((x) => x.id === r.to) : null
          if (!from) return null
          if (r.kind === 'banana' && to) return <div key={r.id} className="react-layer"><i className="banana-fly" style={{ '--x0': from.x + '%', '--y0': from.y + '%', '--x1': to.x + '%', '--y1': to.y + '%' }}>🍌</i><i className="banana-hit" style={{ left: to.x + '%', top: to.y + '%' }}>💥</i></div>
          return <div key={r.id} className="laugh" style={{ left: from.x + '%', top: from.y + '%' }}><span>{r.kind === 'rofl' ? '🤣' : r.kind === 'tease' ? '😜' : '😂'}</span><small>{r.kind === 'tease' ? 'TIRA NA!' : 'HAHAHA'}</small></div>
        })}
        {s.mode === 'play' && s.seats.length > 1 && (
          <div className="react-bar">
            {[['laugh', '😂'], ['rofl', '🤣'], ['tease', '😜']].map(([k, e]) => <button key={k} title="React" onClick={() => cardsActions.react(k, -1)}>{e}</button>)}
            <button className={aim ? 'on' : ''} title="Throw a banana at someone who is too slow" onClick={() => setAim((v) => !v)}>🍌</button>
            {aim && <small>PICK A PLAYER TO HIT</small>}
          </div>
        )}
        {/* buttons */}
        <div className={'ct-buttons' + (s.id === 'lucky9' || s.id === 'baccarat' || s.id === 'poker' ? ' low' : '')}>
          {s.buttons.map((b, i) => (
            <button key={b.name + (b.arg ?? '') + i} className={'ct-btn' + (b.hot ? ' hot' : '') + (b.pulse ? ' pulse' : '') + (b.off ? ' off' : '') + (b.chip ? ' chip' : '') + (b.on ? ' on' : '')} disabled={b.off} onClick={() => cardsActions.button(b.name, b.arg)}>{b.label}</button>
          ))}
        </div>
        {/* UNO colour picker */}
        {s.prompt && s.prompt.type === 'color' && (
          <div className="ct-overlay"><div className="colorpick"><h3>CHOOSE A COLOUR</h3><div>{s.prompt.colors.map((k) => <button key={k} style={{ background: UCOL[k] }} onClick={() => cardsActions.button('color', k)}>{{ R: 'RED', Y: 'YELLOW', G: 'GREEN', B: 'BLUE' }[k]}</button>)}</div></div></div>
        )}
        {s.prompt && s.prompt.type === 'swap' && (
          <div className="ct-overlay"><div className="colorpick"><h3>7 · SWAP HANDS WITH…</h3><div>{s.prompt.players.map((q) => <button key={q.id} style={{ background: '#6a2a8a' }} onClick={() => cardsActions.button('swap', q.id)}>{q.name} ({q.count} cards)</button>)}</div></div></div>
        )}
        {/* round result panel */}
        {s.roundInfo && s.phase === 'roundOver' && (
          <div className="roundinfo"><b>{s.id === 'tongits' ? s.roundInfo.kind : 'ROUND RESULT'}</b>
            {s.roundInfo.rows.map((r, i) => <div key={i}><span>{r[0]}</span><em>{Array.isArray(r) && r.length > 2 && typeof r[1] === 'number' && s.id === 'pusoy' ? `${r[1]} cards = ${r[2]} pts` : r[1] + (r[2] ? ' ' + r[2] : '')}</em></div>)}
            {s.id === 'tongits' && <div className="net"><span>YOUR NET</span><em style={{ color: s.roundInfo.humanNet >= 0 ? '#3dff7a' : '#ff6a6a' }}>{s.roundInfo.humanNet >= 0 ? '+' : ''}{s.roundInfo.humanNet}</em></div>}
          </div>
        )}
        {s.id === 'pusoy' && s.center && s.center.sel && s.phase === 'play' && <div className={'selhint' + (s.center.sel === 'INVALID' ? ' bad' : '')}>{s.center.sel}</div>}
        {/* banner + toasts */}
        {s.banner && <div className="ct-banner" key={s.banner.id} style={{ color: s.banner.color, textShadow: `0 0 24px ${s.banner.color}` }}><b>{s.banner.text}</b>{s.banner.sub && <small>{s.banner.sub}</small>}</div>}
        <div className="ct-toasts">{s.toasts.map((t) => <div key={t.id} className="toast" style={{ color: t.color, borderColor: t.color }}>{t.text}</div>)}</div>
        <Confetti id={s.confetti} />
        {s.paused && <div className="screen pause"><h1>PAUSED</h1><button className="big" onClick={cardsActions.resume}>RESUME</button><button className="big sec" onClick={() => openHelp('cards')}>❓ HOW TO PLAY</button><button className="big sec" onClick={cardsActions.quit}>QUIT TO DASHBOARD</button></div>}
        {over && (
          <div className="screen victory">
            <h1 className={over.win ? 'gold' : 'red'}>{over.title}</h1>
            <ul>{over.rows.map((r, i) => <li key={i}><span>{r[0]}</span><b>{typeof r[1] === 'number' ? r[1].toLocaleString() : r[1]}</b></li>)}{over.score > 0 && <li className="bonus"><span>LEADERBOARD SCORE</span><b>{over.score.toLocaleString()}</b></li>}</ul>
            {over.score > 0 && <div className="overboard"><TopPlayersMini game={over.game} /></div>}
            <button className="big" onClick={cardsActions.rematch}>↻ PLAY AGAIN</button>
            <button className="big sec" onClick={cardsActions.quit}>DASHBOARD</button>
          </div>
        )}
      </div>
    </div>
  )
}
