// Anonymous player identity. The first time the site loads in a browser it makes a random ID (kept in localStorage and a one-year
// cookie so clearing one of them does not lose it). The ID is the key for the saved game data (Empire Rise, stats, chips...) on the
// server, and it is how a player gets their progress back on another browser.
const KEY = 'si_uid', COOKIE = 'si_uid'
const ALPHA = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ' // no 0/O/1/I so an ID is easy to read out
const makeId = () => {
  const b = new Uint8Array(12)
  try { crypto.getRandomValues(b) } catch { for (let i = 0; i < 12; i++) b[i] = Math.floor(Math.random() * 256) }
  let s = ''; for (let i = 0; i < 12; i++) s += ALPHA[b[i] % ALPHA.length]
  return 'MS-' + s.slice(0, 4) + '-' + s.slice(4, 8) + '-' + s.slice(8)
}
export const validId = (id) => /^MS-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/.test(String(id || ''))
const readCookie = () => { try { const m = document.cookie.match(/(?:^|; )si_uid=([^;]+)/); return m ? decodeURIComponent(m[1]) : '' } catch { return '' } }
const writeCookie = (id) => { try { document.cookie = COOKIE + '=' + encodeURIComponent(id) + '; max-age=31536000; path=/; SameSite=Lax' } catch { /* ignore */ } }

let uid = ''
export function getPlayerId() {
  if (uid) return uid
  if (typeof window === 'undefined') return ''
  try { const a = localStorage.getItem(KEY); if (validId(a)) uid = a } catch { /* ignore */ }
  if (!uid) { const c = readCookie(); if (validId(c)) uid = c }
  if (!uid) uid = makeId()
  try { localStorage.setItem(KEY, uid) } catch { /* ignore */ }
  writeCookie(uid)
  return uid
}
export function adoptPlayerId(id) { if (!validId(id)) return false; uid = id; try { localStorage.setItem(KEY, id) } catch { /* ignore */ } writeCookie(id); return true }

// save the profile to the server a few seconds after it last changed (fails soft: no API, no problem)
let timer = 0, last = ''
export function schedulePlayerSync(profile) {
  if (typeof window === 'undefined') return
  clearTimeout(timer)
  timer = setTimeout(() => {
    try {
      const data = JSON.stringify(profile)
      if (data === last || data.length > 90000) return
      last = data
      fetch('/api/player', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ uid: getPlayerId(), data: profile }), keepalive: data.length < 60000 }).catch(() => {})
    } catch { /* ignore */ }
  }, 4000)
}
export async function restorePlayer(id) {
  if (!validId(id)) return { ok: false, error: 'That ID does not look right (MS-XXXX-XXXX-XXXX).' }
  try {
    const r = await fetch('/api/player?uid=' + encodeURIComponent(id), { cache: 'no-store' })
    if (!r.ok) return { ok: false, error: r.status === 404 ? 'No saved data for that ID yet.' : 'The server could not load it.' }
    const j = await r.json()
    if (!j || !j.data) return { ok: false, error: 'No saved data for that ID yet.' }
    adoptPlayerId(id)
    localStorage.setItem('si_profile', JSON.stringify(j.data))
    return { ok: true }
  } catch { return { ok: false, error: 'Could not reach the server.' } }
}
