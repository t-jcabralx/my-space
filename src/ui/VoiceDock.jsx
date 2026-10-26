'use client'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { subscribeRt, getRt } from '../game/online/rt.js'
import { subscribeVoice, getVoice, joinVoice, leaveVoice, toggleMute, toggleDeaf, voiceSupported } from '../game/online/voice.js'

const KEY = 'si_voice_pos'
const load = () => { try { const v = JSON.parse(localStorage.getItem(KEY)); return v && typeof v.x === 'number' ? v : null } catch { return null } }

// Floating group-call controls, shown whenever the player is in an online room (lobby and in-game).
// The whole dock can be dragged anywhere (press and move any part of it); its place is remembered.
export default function VoiceDock() {
  const rt = useSyncExternalStore(subscribeRt, getRt, getRt)
  const v = useSyncExternalStore(subscribeVoice, getVoice, getVoice)
  const [pos, setPos] = useState(null)
  const box = useRef(null), drag = useRef(null), moved = useRef(false)
  useEffect(() => { setPos(load()) }, [])
  useEffect(() => {
    const fit = () => setPos((p) => { if (!p) return p; const b = box.current; const w = b ? b.offsetWidth : 120, h = b ? b.offsetHeight : 40; return { x: Math.min(Math.max(0, p.x), Math.max(0, window.innerWidth - w)), y: Math.min(Math.max(0, p.y), Math.max(0, window.innerHeight - h)) } })
    window.addEventListener('resize', fit); return () => window.removeEventListener('resize', fit)
  }, [])
  if (!rt.room) return null
  const down = (e) => {
    const b = box.current; if (!b) return
    const r = b.getBoundingClientRect()
    drag.current = { sx: e.clientX, sy: e.clientY, ox: r.left, oy: r.top, w: r.width, h: r.height, id: e.pointerId }
    moved.current = false
  }
  const move = (e) => {
    const d = drag.current; if (!d || d.id !== e.pointerId) return
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy
    if (!moved.current && Math.hypot(dx, dy) < 7) return
    if (!moved.current) { moved.current = true; try { box.current.setPointerCapture(e.pointerId) } catch { /* ignore */ } }
    const x = Math.min(Math.max(0, d.ox + dx), Math.max(0, window.innerWidth - d.w)), y = Math.min(Math.max(0, d.oy + dy), Math.max(0, window.innerHeight - d.h))
    setPos({ x, y })
  }
  const up = (e) => {
    const d = drag.current; drag.current = null
    if (d && moved.current) { try { box.current.releasePointerCapture(d.id) } catch { /* ignore */ } setPos((p) => { if (p) { try { localStorage.setItem(KEY, JSON.stringify(p)) } catch { /* ignore */ } } return p }) }
  }
  // a drag must not count as a click on the button underneath
  const swallow = (e) => { if (moved.current) { e.stopPropagation(); e.preventDefault(); moved.current = false } }
  const btn = { pointerEvents: 'auto', cursor: 'pointer', border: '1px solid #ffffff40', background: '#0b1220e6', color: '#fff', borderRadius: 999, padding: '8px 14px', font: 'inherit', fontWeight: 700, fontSize: 13, touchAction: 'none' }
  const place = pos ? { left: pos.x, top: pos.y } : { right: 10, bottom: 10 }
  return (
    <div ref={box} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onClickCapture={swallow} title="Drag me anywhere" style={{ position: 'fixed', ...place, zIndex: 400, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, pointerEvents: 'auto', touchAction: 'none', userSelect: 'none', cursor: 'grab' }}>
      {v.on && (
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 4, maxWidth: 260 }}>
          {rt.room.players.filter((p) => v.members[p.id]).map((p) => (
            <span key={p.id} style={{ background: '#0b1220e6', border: '2px solid ' + (v.speaking[p.id] ? '#3dff7a' : '#ffffff30'), borderRadius: 99, padding: '2px 9px', fontSize: 12, fontWeight: 700, color: v.speaking[p.id] ? '#3dff7a' : '#fff', boxShadow: v.speaking[p.id] ? '0 0 8px #3dff7a' : 'none' }}>
              {p.id === rt.cid && v.muted ? '🔇 ' : '🎙 '}{p.name}
            </span>
          ))}
        </div>
      )}
      {v.error && <div style={{ background: '#3a0f16ee', color: '#ff8a96', borderRadius: 8, padding: '4px 8px', fontSize: 12, maxWidth: 260 }}>{v.error}</div>}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={{ color: '#9fb4e8', fontSize: 16, lineHeight: 1, padding: '0 2px' }} aria-hidden="true">⠿</span>
        {!v.on
          ? <button style={btn} disabled={v.busy || !voiceSupported()} title={voiceSupported() ? 'Talk with the others in this room' : 'Voice needs https and microphone support'} onClick={joinVoice}>{v.busy ? '🎤 …' : '🎤 JOIN VOICE'}</button>
          : <>
            <button style={{ ...btn, background: v.muted ? '#7a1c28' : '#14532d' }} onClick={toggleMute}>{v.muted ? '🔇 UNMUTE' : '🎤 MUTE'}</button>
            <button style={{ ...btn, background: v.deaf ? '#7a1c28' : '#0b1220e6' }} onClick={toggleDeaf}>{v.deaf ? '🔈 SOUND OFF' : '🔊 SOUND'}</button>
            <button style={btn} onClick={leaveVoice}>✖ LEAVE VOICE</button>
          </>}
      </div>
    </div>
  )
}
