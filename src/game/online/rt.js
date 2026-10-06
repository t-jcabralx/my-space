// Realtime client: rooms + pub/sub over Next.js routes (/api/rt/*) backed by Redis. Works in the browser and in Node (tests).
const BASE = () => (typeof globalThis !== 'undefined' && globalThis.__RT_BASE) || ''
const rid = () => Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6)
function getCid() {
  try { let c = sessionStorage.getItem('si_cid'); if (!c) { c = rid(); sessionStorage.setItem('si_cid', c) } return c } catch { return rid() }
}
export const RT = { tok: '', cid: getCid(), name: 'PLAYER', room: null, connected: false, chat: [], error: '', lastSeen: {}, rooms: [], busy: false }
let snap = { ...RT }
const subs = new Set()
export const subscribeRt = (f) => { subs.add(f); return () => subs.delete(f) }
export const getRt = () => snap
function emit() { snap = { ...RT, room: RT.room ? { ...RT.room, players: RT.room.players.slice() } : null, chat: RT.chat.slice(-60), lastSeen: { ...RT.lastSeen }, rooms: RT.rooms.slice() }; subs.forEach((f) => f()) }

async function post(path, body) {
  const r = await fetch(BASE() + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cid: RT.cid, tok: RT.tok, ...body }) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status)
  return j
}
const handlers = new Map()
export function onMsg(type, fn) {
  if (!handlers.has(type)) handlers.set(type, new Set())
  handlers.get(type).add(fn)
  return () => handlers.get(type).delete(fn)
}
const dispatch = (type, env) => { const h = handlers.get(type); if (h) for (const f of h) { try { f(env.d, env) } catch (e) { console.error('[rt] handler', type, e) } } }

let ctl = null // current stream controller
async function streamLoop(code, token) {
  let backoff = 600
  while (RT.room && RT.room.code === code && ctl === token) {
    const ac = token.ac = new AbortController()
    try {
      const res = await fetch(`${BASE()}/api/rt/stream?code=${code}&cid=${RT.cid}&tok=${RT.tok}`, { signal: ac.signal, cache: 'no-store' })
      if (!res.ok || !res.body) throw new Error('stream ' + res.status)
      RT.connected = true; RT.error = ''; backoff = 600; emit()
      dispatch('open', { d: null })
      const reader = res.body.getReader(), dec = new TextDecoder()
      let buf = ''
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        let i
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const frame = buf.slice(0, i); buf = buf.slice(i + 2)
          const line = frame.split('\n').find((l) => l.startsWith('data: '))
          if (!line) continue
          let env
          try { env = JSON.parse(line.slice(6)) } catch { continue }
          onEnvelope(env)
        }
      }
    } catch (e) { if (ctl !== token) return }
    RT.connected = false; emit()
    if (ctl !== token) return
    await new Promise((r) => setTimeout(r, backoff)); backoff = Math.min(backoff * 1.7, 5000)
  }
}
function onEnvelope(env) {
  if (!env || !env.t) return
  if (env.f && env.f !== 'srv') RT.lastSeen[env.f] = Date.now()
  if (env.t === 'presence') {
    const old = RT.room
    RT.room = env.d
    if (old && old.host !== env.d.host) dispatch('hostchange', { d: env.d.host })
    if (!env.d.players.some((p) => p.id === RT.cid)) { RT.room = null; ctl = null }
    emit(); dispatch('presence', env); return
  }
  if (env.t === 'chat') { RT.chat.push({ id: env.ts + env.f, from: env.f, name: env.d.name, text: env.d.text, ts: env.ts }); emit() }
  dispatch(env.t, env)
}
let hbTimer = null
function startHb() { stopHb(); hbTimer = setInterval(() => { if (RT.room && RT.connected) send('hb', null).catch(() => {}) }, 4000) }
function stopHb() { if (hbTimer) clearInterval(hbTimer); hbTimer = null }
function attach(room) {
  RT.room = room; RT.chat = []; RT.error = ''; RT.lastSeen = {}; RT.attachedAt = Date.now()
  const token = { ac: null }; ctl = token
  streamLoop(room.code, token); startHb(); emit()
}
export async function createRoom(game, name, opts = {}) {
  RT.name = name || RT.name; RT.busy = true; emit()
  try { const j = await post('/api/rt/room', { action: 'create', game, name: RT.name, opts }); RT.tok = j.tok; attach(j.room); return j.room }
  catch (e) { RT.error = e.message; throw e } finally { RT.busy = false; emit() }
}
export async function joinRoom(code, name) {
  RT.name = name || RT.name; RT.busy = true; emit()
  try { const j = await post('/api/rt/room', { action: 'join', code: String(code).toUpperCase(), name: RT.name }); RT.tok = j.tok; attach(j.room); return j.room }
  catch (e) { RT.error = e.message; throw e } finally { RT.busy = false; emit() }
}
export async function leaveRoom() {
  const code = RT.room && RT.room.code
  const token = ctl; ctl = null; if (token && token.ac) token.ac.abort()
  stopHb(); RT.room = null; RT.connected = false; RT.chat = []; emit()
  if (code) { try { await post('/api/rt/room', { action: 'leave', code }) } catch { /* ignore */ } }
}
export async function listRooms(game) {
  try { const j = await post('/api/rt/room', { action: 'list', game }); RT.rooms = j.rooms; emit(); return j.rooms } catch (e) { RT.error = e.message; emit(); return [] }
}
export async function roomAction(action, opts) { const j = await post('/api/rt/room', { action, code: RT.room.code, opts }); if (j.room) { RT.room = j.room; emit() } return j }
export function send(type, data, to) { if (!RT.room) return Promise.resolve(); return post('/api/rt/send', { code: RT.room.code, t: type, d: data, to }) }
export const isHost = () => !!RT.room && RT.room.host === RT.cid
export const sendChat = (text) => send('chat', { name: RT.name, text: String(text).slice(0, 140) })
// a player we have not heard from yet is given the benefit of the doubt for `ms` after we joined/created the room
export const alive = (cid, ms = 14000) => cid === RT.cid || (RT.lastSeen[cid] ? Date.now() - RT.lastSeen[cid] < ms : Date.now() - (RT.attachedAt || 0) < ms * 2)
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => { if (RT.room) try { navigator.sendBeacon(BASE() + '/api/rt/room', new Blob([JSON.stringify({ action: 'leave', cid: RT.cid, tok: RT.tok, code: RT.room.code })], { type: 'application/json' })) } catch { /* ignore */ } })
}
