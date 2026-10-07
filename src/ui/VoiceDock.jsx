'use client'
import { useSyncExternalStore } from 'react'
import { subscribeRt, getRt } from '../game/online/rt.js'
import { subscribeVoice, getVoice, joinVoice, leaveVoice, toggleMute, toggleDeaf, voiceSupported } from '../game/online/voice.js'

// Floating group-call controls, shown whenever the player is in an online room (lobby and in-game).
export default function VoiceDock() {
  const rt = useSyncExternalStore(subscribeRt, getRt, getRt)
  const v = useSyncExternalStore(subscribeVoice, getVoice, getVoice)
  if (!rt.room) return null
  const btn = { pointerEvents: 'auto', cursor: 'pointer', border: '1px solid #ffffff40', background: '#0b1220e6', color: '#fff', borderRadius: 99, padding: '6px 12px', font: 'inherit', fontWeight: 700, fontSize: 13 }
  return (
    <div style={{ position: 'fixed', right: 10, bottom: 10, zIndex: 400, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, pointerEvents: 'none' }}>
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
      <div style={{ display: 'flex', gap: 6 }}>
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
