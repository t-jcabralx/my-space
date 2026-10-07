'use client'
// Story mode: the chapter map (a dashboard tab) and the full-screen cut-scene / result overlay.
import { useEffect, useState, useSyncExternalStore } from 'react'
import { subscribeStory, getStorySnap, storyActions, CHAPTERS, ACTS, CAST, unlocked } from '../game/story.js'

export function StoryTab({ s }) {
  const g = useSyncExternalStore(subscribeStory, getStorySnap)
  const done = Object.keys(g.done).length
  return (
    <div className="storytab">
      <div className="storyhead">
        <div><h2>📖 THE NEON UPRISING</h2><p>The OVERLORD has locked the Grid. Play through every game in the arcade to set the scores free. Season 2 adds choices that change the ending, and most chapters can be played <b>with a friend</b> online (👥).</p></div>
        <div className="storyprog"><b>{done}/{g.total}</b><small>CHAPTERS</small><div className="bar"><b style={{ width: (done / g.total) * 100 + '%' }} /></div></div>
      </div>
      {ACTS.map((act, ai) => (
        <div key={act} className="storyact">
          <h4>{act}</h4>
          <div className="chapters">
            {CHAPTERS.map((c, i) => c.act !== ai ? null : (
              <button key={i} className={'chapter ' + (g.done[i] ? 'done ' : '') + (!unlocked(i) ? 'locked ' : '') + (i === g.cur && !g.done[i] ? 'cur' : '')} disabled={!unlocked(i)} onClick={() => storyActions.open(i)}>
                {c.coop && unlocked(i) && <span className="ccoop" role="button" title="Play this chapter with a friend online" onClick={(e) => { e.stopPropagation(); storyActions.coop(i) }}>👥 WITH A FRIEND</span>}
                <span className="cico">{unlocked(i) ? c.icon : '🔒'}</span>
                <b>CH {i + 1} · {c.title}</b>
                <small>{unlocked(i) ? c.goal : 'Finish the previous chapter'}</small>
                <em>{g.done[i] ? '✔ COMPLETE' : unlocked(i) ? '▶ PLAY · +' + c.reward + ' 🪙' : ''}</em>
              </button>
            ))}
          </div>
        </div>
      ))}
      {g.complete && <div className="lobbyinfo"><b>🏆 CAMPAIGN COMPLETE.</b> The Grid is free. Thank you for playing! <button className="chip" onClick={storyActions.reset}>RESET STORY</button></div>}
    </div>
  )
}

function Typed({ text, speed = 28, onDone }) {
  const [n, setN] = useState(0)
  useEffect(() => { setN(0); const t = setInterval(() => setN((v) => { if (v + 1 >= text.length) { clearInterval(t); onDone && onDone() } return Math.min(text.length, v + 1) }), 1000 / speed); return () => clearInterval(t) }, [text])
  return <>{text.slice(0, n)}<i className="caret">{n < text.length ? '▌' : ''}</i></>
}

const creditsFor = (f) => ['THE NEON UPRISING', 'SEASON 2: THE LAST CABINET', '', 'ECHO · NOVA · PIXEL', 'TURBO TESS · BLOOM · ORACLE · FROST · ARCHON', 'and everyone who played', '', 'SPACE IMPACT · GROUND ZERO · PICKLEBALL', 'BOMBER BLAST · TETRA BLAST · MAZE CHOMP', 'CARD ROOM · FLAMES · IRON FISTS · TURBO RUSH', 'AIR HOCKEY · BILLIARDS · NEON DEFENSE', 'NEON DEPTHS · NEON BEAT · WORD HUNT · 2048', 'SNOW RUSH · ORB RUSH · GARDEN SIEGE · KART CLASH', '', f && f.path === 'mercy' ? 'ENDING: THE MERCIFUL GARDEN' : 'ENDING: THE DELETED ARCHON', f && f.buddy === 'pix' ? 'CO-PILOT: PIXEL' : 'CO-PILOT: NOVA', '', 'THE GRID IS FREE.', 'SEE YOU AT THE NEXT HIGH SCORE.']

export function StoryOverlay() {
  const g = useSyncExternalStore(subscribeStory, getStorySnap)
  const talk = g.phase === 'intro' || g.phase === 'outro' || g.phase === 'lost'
  useEffect(() => {
    if (!talk && g.phase !== 'credits') return
    const k = (e) => {
      if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); e.stopPropagation(); g.phase === 'credits' ? storyActions.closeCredits() : g.phase === 'lost' ? storyActions.advance() : storyActions.advance() }
      else if (e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); g.phase === 'lost' ? storyActions.abandon() : storyActions.skip() }
    }
    window.addEventListener('keydown', k, true)
    return () => window.removeEventListener('keydown', k, true)
  }, [talk, g.phase])
  if (g.phase === 'coopwait') {
    return <div className="storychip coopchip" onPointerDown={(e) => e.stopPropagation()}>👥 CH {g.ch + 1} CO-OP · open or join a room for this game, press START together · <button className="chip" onClick={storyActions.abandon}>CANCEL</button></div>
  }
  if (g.phase === 'playing' || g.phase === 'pending') {
    return <div className="storychip" onPointerDown={(e) => e.stopPropagation()}>📖 CH {g.ch + 1}{g.stages ? ' · ROUND ' + (g.stage + 1) + '/' + g.stages : ''}{g.coop ? ' · 👥' : ''}: {g.goal}</div>
  }
  if (g.phase === 'credits') {
    return (
      <div className="storyfull credits" onClick={storyActions.closeCredits}>
        <div className="roll">{creditsFor(g.flags).map((l, i) => <p key={i} className={i === 0 ? 'big1' : ''}>{l || ' '}</p>)}</div>
        <button className="big" onClick={storyActions.closeCredits}>BACK TO DASHBOARD</button>
      </div>
    )
  }
  if (!talk) return null
  const ln = g.lines[g.line]
  if (!ln) return null
  const who = CAST[ln.who] || CAST.sys
  const last = g.line >= g.lines.length - 1 && !g.choice
  return (
    <div className={'storyfull ' + g.phase} onClick={() => storyActions.advance()}>
      <div className="stitle"><small>{g.phase === 'intro' ? `CHAPTER ${g.ch + 1}` : g.phase === 'outro' ? 'MISSION COMPLETE' : 'MISSION FAILED'}</small><h2>{g.title}</h2></div>
      <div className="sbox" style={{ '--c': who.color }} onClick={(e) => { e.stopPropagation(); storyActions.advance() }}>
        <div className="sport">{who.ico}</div>
        <div className="stext"><b>{who.name}</b><p><Typed text={ln.text} /></p></div>
        <div className="snext">{last ? (g.phase === 'intro' ? 'START MISSION ▶' : g.phase === 'outro' ? 'CONTINUE ▶' : 'OK') : 'NEXT ▶'}</div>
      </div>
      {g.choice && g.phase === 'intro' && <div className="schoices">{g.choice.map((t, k) => <button key={k} className="big sec" onClick={(e) => { e.stopPropagation(); storyActions.pick(k) }}>{t}</button>)}</div>}
      <div className="sbtns">
        {g.phase === 'lost' ? <><button className="big" onClick={(e) => { e.stopPropagation(); storyActions.retry() }}>↻ RETRY</button><button className="big sec" onClick={(e) => { e.stopPropagation(); storyActions.abandon() }}>BACK TO STORY</button></> : <button className="big sec" onClick={(e) => { e.stopPropagation(); storyActions.skip() }}>SKIP ▶▶</button>}
      </div>
      {g.phase === 'intro' && last && <div className="sgoal">🎯 OBJECTIVE: {g.goal}</div>}
    </div>
  )
}
