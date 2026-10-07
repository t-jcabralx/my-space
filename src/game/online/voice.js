// Room voice chat: a WebRTC audio mesh (fine for 2-4 players). Signalling rides the existing room relay as 'vc' messages.
// Opt-in: nothing touches the microphone until the player presses JOIN VOICE.
import { RT, subscribeRt, onMsg, send } from './rt.js'

const ICE = { iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }] }
const VC = { on: false, muted: false, deaf: false, busy: false, error: '', members: {}, speaking: {} }
let snap = { ...VC }
const subs = new Set()
export const subscribeVoice = (f) => { subs.add(f); return () => subs.delete(f) }
export const getVoice = () => snap
function emit() { snap = { ...VC, members: { ...VC.members }, speaking: { ...VC.speaking } }; subs.forEach((f) => f()) }

let local = null // MediaStream
let ctx = null
const peers = new Map() // cid -> { pc, audio, an, buf, early: [] }
const sig = (to, d) => send('vc', d, to).catch(() => {})

const canVoice = () => typeof RTCPeerConnection !== 'undefined' && typeof navigator !== 'undefined' && !!navigator.mediaDevices && !!navigator.mediaDevices.getUserMedia
export const voiceSupported = canVoice
function audioCtx() {
  if (ctx) return ctx
  const A = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)
  if (A) { try { ctx = new A() } catch { ctx = null } }
  return ctx
}
function meter(stream) {
  const c = audioCtx(); if (!c) return null
  try { const an = c.createAnalyser(); an.fftSize = 512; c.createMediaStreamSource(stream).connect(an); return { an, buf: new Uint8Array(an.fftSize) } } catch { return null }
}
const level = (m) => { if (!m) return 0; m.an.getByteTimeDomainData(m.buf); let s = 0; for (let i = 0; i < m.buf.length; i++) { const v = (m.buf[i] - 128) / 128; s += v * v } return Math.sqrt(s / m.buf.length) }

function closePeer(cid) {
  const p = peers.get(cid); if (!p) return
  peers.delete(cid)
  try { p.pc.close() } catch { /* ignore */ }
  if (p.audio) { try { p.audio.pause(); p.audio.srcObject = null; p.audio.remove() } catch { /* ignore */ } }
  delete VC.members[cid]; delete VC.speaking[cid]; emit()
}
function makePeer(cid, initiator) {
  closePeer(cid)
  const pc = new RTCPeerConnection(ICE)
  const p = { pc, audio: null, m: null, early: [] }
  peers.set(cid, p)
  for (const t of local.getTracks()) pc.addTrack(t, local)
  pc.onicecandidate = (e) => { if (e.candidate) sig(cid, { k: 'ice', c: e.candidate.toJSON ? e.candidate.toJSON() : e.candidate }) }
  pc.ontrack = (e) => {
    const stream = e.streams[0] || new MediaStream([e.track])
    if (!p.audio) { p.audio = document.createElement('audio'); p.audio.autoplay = true; p.audio.playsInline = true; document.body.appendChild(p.audio) }
    p.audio.srcObject = stream; p.audio.muted = VC.deaf
    p.audio.play().catch(() => {})
    p.m = meter(stream)
    VC.members[cid] = true; emit()
  }
  pc.onconnectionstatechange = () => { if (pc.connectionState === 'failed' || pc.connectionState === 'closed') closePeer(cid) }
  if (initiator) pc.createOffer().then((o) => pc.setLocalDescription(o)).then(() => sig(cid, { k: 'offer', sdp: pc.localDescription })).catch(() => closePeer(cid))
  return p
}
// whoever has the smaller id calls, so two people who join together never both send an offer
const maybeCall = (cid) => { if (VC.on && RT.cid < cid && !peers.has(cid)) makePeer(cid, true) }

onMsg('vc', async (d, env) => {
  const from = env.f
  if (!d || !VC.on || from === RT.cid || !RT.room || !RT.room.players.some((x) => x.id === from)) return
  try {
    if (d.k === 'hello') { sig(from, { k: 'here' }); maybeCall(from) }
    else if (d.k === 'here') maybeCall(from)
    else if (d.k === 'bye') closePeer(from)
    else if (d.k === 'offer') {
      const p = makePeer(from, false)
      await p.pc.setRemoteDescription(d.sdp)
      const a = await p.pc.createAnswer(); await p.pc.setLocalDescription(a)
      sig(from, { k: 'answer', sdp: p.pc.localDescription })
      for (const c of p.early) p.pc.addIceCandidate(c).catch(() => {})
      p.early = []
    } else if (d.k === 'answer') {
      const p = peers.get(from); if (!p) return
      await p.pc.setRemoteDescription(d.sdp)
      for (const c of p.early) p.pc.addIceCandidate(c).catch(() => {})
      p.early = []
    } else if (d.k === 'ice') {
      const p = peers.get(from); if (!p) return
      if (p.pc.remoteDescription) p.pc.addIceCandidate(d.c).catch(() => {}); else p.early.push(d.c)
    }
  } catch { /* a failed handshake only costs that one link */ }
})
onMsg('presence', () => {
  if (!VC.on) return
  for (const c of [...peers.keys()]) if (!RT.room || !RT.room.players.some((x) => x.id === c)) closePeer(c)
})
// leaving the room (or being dropped) ends the call
subscribeRt(() => { if (VC.on && !RT.room) leaveVoice() })

let poll = null
function startPoll() {
  if (poll || typeof setInterval === 'undefined') return
  const lm = local ? meter(local) : null
  poll = setInterval(() => {
    let ch = false
    const set = (cid, v) => { if (!!VC.speaking[cid] !== v) { if (v) VC.speaking[cid] = true; else delete VC.speaking[cid]; ch = true } }
    set(RT.cid, !VC.muted && level(lm) > 0.03)
    for (const [cid, p] of peers) set(cid, level(p.m) > 0.025)
    if (ch) emit()
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {})
  }, 150)
}
export async function joinVoice() {
  if (VC.on || VC.busy) return
  if (!RT.room) { VC.error = 'Join a room first'; emit(); return }
  if (!canVoice()) { VC.error = 'Voice needs a secure (https) page and a browser with microphone support'; emit(); return }
  VC.busy = true; VC.error = ''; emit()
  try {
    local = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false })
  } catch (e) {
    VC.busy = false
    VC.error = e && e.name === 'NotAllowedError' ? 'Microphone blocked: allow it in your browser settings and try again' : e && e.name === 'NotFoundError' ? 'No microphone found' : 'Could not open the microphone'
    emit(); return
  }
  VC.on = true; VC.busy = false; VC.muted = false; VC.members[RT.cid] = true
  for (const t of local.getAudioTracks()) t.enabled = true
  audioCtx(); startPoll(); emit()
  send('vc', { k: 'hello' }).catch(() => {})
}
export function leaveVoice() {
  if (!VC.on && !local) return
  const was = VC.on
  VC.on = false
  if (was && RT.room) send('vc', { k: 'bye' }).catch(() => {})
  for (const c of [...peers.keys()]) closePeer(c)
  if (local) { for (const t of local.getTracks()) t.stop(); local = null }
  if (poll) { clearInterval(poll); poll = null }
  VC.members = {}; VC.speaking = {}; VC.muted = false; emit()
}
export function toggleMute() {
  if (!VC.on || !local) return
  VC.muted = !VC.muted
  for (const t of local.getAudioTracks()) t.enabled = !VC.muted
  emit()
}
export function toggleDeaf() {
  VC.deaf = !VC.deaf
  for (const p of peers.values()) if (p.audio) p.audio.muted = VC.deaf
  emit()
}
