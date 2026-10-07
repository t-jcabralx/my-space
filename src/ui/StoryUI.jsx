'use client'
// Story mode: the chapter map (a dashboard tab) and the full-screen cut-scene / result overlay.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { sfx, speak } from '../game/audio.js'
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

function Typed({ text, speed = 38, full, blip, onDone }) {
  const [n, setN] = useState(0)
  const done = useRef(onDone); done.current = onDone
  useEffect(() => {
    setN(0)
    let v = 0
    const t = setInterval(() => {
      v++
      if (text[v - 1] && text[v - 1] !== ' ' && v % 2 === 0) sfx('blip', blip)
      setN(Math.min(text.length, v))
      if (v >= text.length) { clearInterval(t); done.current && done.current() }
    }, 1000 / speed)
    return () => clearInterval(t)
  }, [text, blip])
  useEffect(() => { if (full) { setN(text.length); done.current && done.current() } }, [full, text])
  return <>{text.slice(0, n)}<i className="caret">{n < text.length ? '▌' : ''}</i></>
}

const creditsFor = (f) => ['THE NEON UPRISING', 'SEASON 2: THE LAST CABINET', '', 'ECHO · NOVA · PIXEL', 'TURBO TESS · BLOOM · ORACLE · FROST · ARCHON', 'and everyone who played', '', 'SPACE IMPACT · GROUND ZERO · PICKLEBALL', 'BOMBER BLAST · TETRA BLAST · MAZE CHOMP', 'CARD ROOM · FLAMES · IRON FISTS · TURBO RUSH', 'AIR HOCKEY · BILLIARDS · NEON DEFENSE', 'NEON DEPTHS · NEON BEAT · WORD HUNT · 2048', 'SNOW RUSH · ORB RUSH · GARDEN SIEGE · KART CLASH', '', f && f.path === 'mercy' ? 'ENDING: THE MERCIFUL GARDEN' : 'ENDING: THE DELETED ARCHON', f && f.buddy === 'pix' ? 'CO-PILOT: PIXEL' : 'CO-PILOT: NOVA', '', 'THE GRID IS FREE.', 'SEE YOU AT THE NEXT HIGH SCORE.']

export function StoryOverlay() {
  const g = useSyncExternalStore(subscribeStory, getStorySnap)
  const talk = g.phase === 'intro' || g.phase === 'outro' || g.phase === 'lost'
  const [full, setFull] = useState(false)
  const [typed, setTyped] = useState(false)
  const [voice, setVoice] = useState(() => { try { return localStorage.getItem('si_story_voice') === '1' } catch { return false } })
  const line = g.lines[g.line]
  useEffect(() => { setFull(false); setTyped(false) }, [g.line, g.phase, g.ch, line && line.text])
  const speaker = line && (CAST[line.who] || CAST.sys)
  useEffect(() => {
    if (!talk || !voice || !line) return
    speak(line.text, speaker.tts, 1.02)
    return () => { try { speechSynthesis.cancel() } catch { /* ignore */ } }
  }, [talk, voice, g.line, g.phase, g.ch])
  useEffect(() => () => { try { speechSynthesis.cancel() } catch { /* ignore */ } }, [])
  const toggleVoice = () => { const v = !voice; setVoice(v); try { localStorage.setItem('si_story_voice', v ? '1' : '0') } catch { /* ignore */ } if (!v) { try { speechSynthesis.cancel() } catch { /* ignore */ } } }
  // first tap finishes the line, the next one moves on
  const tapRef = useRef(null)
  tapRef.current = () => { if (!typed && !full) { setFull(true); return } storyActions.advance() }
  useEffect(() => {
    if (!talk && g.phase !== 'credits') return
    const k = (e) => {
      if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); e.stopPropagation(); g.phase === 'credits' ? storyActions.closeCredits() : tapRef.current() }
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
  const ch = CHAPTERS[g.ch]
  // everyone who has spoken so far in this scene stands on stage (the newest three)
  const onStage = []
  for (let i = g.line; i >= 0; i--) { const w = g.lines[i] && g.lines[i].who; if (w && !onStage.includes(w)) onStage.unshift(w) }
  const stage = onStage.slice(-3)
  return (
    <div className={'storyfull act' + (ch ? ch.act : 0) + ' ' + g.phase} onClick={() => tapRef.current()} style={{ '--c': who.color }}>
      <div className="sbg" aria-hidden="true"><span className="sbgico">{ch ? ch.icon : ''}</span><span className="sgrid" /><span className="sglow" /></div>
      <div className="sbar top" /><div className="sbar bot" />
      <div className="stitle"><small>{g.phase === 'intro' ? `CHAPTER ${g.ch + 1} · ${ACTS[ch.act].split(' · ')[1] || ''}` : g.phase === 'outro' ? 'MISSION COMPLETE' : 'MISSION FAILED'}</small><h2>{g.title}</h2></div>
      <div className="sstage">
        {stage.map((k, i) => { const w = CAST[k] || CAST.sys; const on = k === ln.who; return <div key={k} className={'spc' + (on ? ' on' : '') + (on && !typed && !full ? ' talk' : '')} style={{ '--c': w.color, '--i': i }}><span className="spe">{w.ico}</span><small>{w.name}</small></div> })}
      </div>
      <div className="sbox" key={g.line} style={{ '--c': who.color }} onClick={(e) => { e.stopPropagation(); tapRef.current() }}>
        <div className="stext"><b>{who.name}</b><p><Typed text={ln.text} full={full} blip={who.blip} onDone={() => setTyped(true)} /></p></div>
        <div className="sdots">{g.lines.map((_, i) => <i key={i} className={i === g.line ? 'on' : i < g.line ? 'past' : ''} />)}</div>
        <div className="snext">{!typed && !full ? 'TAP TO SKIP TEXT' : last ? (g.phase === 'intro' ? 'START MISSION ▶' : g.phase === 'outro' ? 'CONTINUE ▶' : 'OK') : 'NEXT ▶'}</div>
      </div>
      {g.choice && g.phase === 'intro' && <div className="schoices">{g.choice.map((t, k) => <button key={k} className="big sec" onClick={(e) => { e.stopPropagation(); storyActions.pick(k) }}>{t}</button>)}</div>}
      <div className="sbtns">
        {g.phase === 'lost' ? <><button className="big" onClick={(e) => { e.stopPropagation(); storyActions.retry() }}>↻ RETRY</button><button className="big sec" onClick={(e) => { e.stopPropagation(); storyActions.abandon() }}>BACK TO STORY</button></> : <button className="big sec" onClick={(e) => { e.stopPropagation(); storyActions.skip() }}>SKIP ▶▶</button>}
        <button className="big sec" onClick={(e) => { e.stopPropagation(); toggleVoice() }} title="Read the dialogue out loud">{voice ? '🗣 VOICE ON' : '🗣 VOICE OFF'}</button>
      </div>
      {g.phase === 'intro' && last && <div className="sgoal">🎯 OBJECTIVE: {g.goal}</div>}
    </div>
  )
}
