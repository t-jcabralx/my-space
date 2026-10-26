// Online MAHJONG over the room relay. The HOST runs the real engine for everybody (2-4 people, bots fill the empty seats); every
// other player gets a private view of the table (their own tiles, everybody's public tiles, nobody else's hand) and sends only
// their choices back. The host validates every choice with the same engine rules as a local game.
import { RT, send, onMsg, isHost, alive, roomAction } from './rt.js'
import { newMatch, startHand, discardTile, claim, declareKong, declareSelfDrawWin, finishHandInMatch, viewState, stateFromView, pendingClaimSeats } from '../mahjong/engine.js'
import { advance } from '../mahjong/session.js'

// ---- a tiny store the UI subscribes to ----
const store = { active: false, host: false, seat: 0, names: ['', '', '', ''], st: null, match: null, log: [], finished: false, waitingFor: '', error: '', rev: 0 }
let snap = { ...store }
const subs = new Set()
export const subscribeMj = (f) => { subs.add(f); return () => subs.delete(f) }
export const getMj = () => snap
const emit = () => { store.rev++; snap = { ...store }; subs.forEach((f) => f()) }

let H = null // host-only state
const openMahjongTab = () => { try { window.dispatchEvent(new CustomEvent('si-open-tab', { detail: 'mahjong' })) } catch { /* ignore */ } }

// ---------------- host ----------------
function seatsOf() { return H.humans.map((h) => h.seat) }
function names() { const n = ['Bot East', 'Bot South', 'Bot West', 'Bot North']; for (const h of H.humans) n[h.seat] = h.name; return n.map((x, i) => (x.startsWith('Bot') ? 'Bot ' + (i + 1) : x)) }
function broadcast(extra = {}) {
  if (!H) return
  const nm = names()
  for (const h of H.humans) {
    const msg = { v: viewState(H.st, h.seat), match: { scores: H.match.scores, handNo: H.match.handNo, dealerStreak: H.match.dealerStreak, finished: H.match.finished, opts: H.match.opts }, seat: h.seat, names: nm, log: H.log, ...extra }
    if (h.cid === RT.cid) applyView(msg); else send('mjs', msg, h.cid).catch(() => {})
  }
}
function hostPump() {
  if (!H) return
  clearTimeout(H.timer)
  if (H.st.phase === 'over') { finishHand(); return }
  const out = advance(H.st, { humans: seatsOf(), levels: H.levels }, 1)
  for (const e of out.events) {
    if (e.ev === 'discard') H.log.unshift(`${names()[e.seat]} discarded`)
    else if (e.ev === 'call') H.log.unshift(`${names()[e.seat]} called ${e.action}`)
    else if (e.ev === 'kong') H.log.unshift(`${names()[e.seat]} made a kong`)
  }
  H.log = H.log.slice(0, 8)
  broadcast()
  if (H.st.phase === 'over') { finishHand(); return }
  if (out.need) return // somebody has to decide: wait for their message
  H.timer = setTimeout(hostPump, 650)
}
function finishHand() {
  if (H.counted) return
  H.counted = true
  finishHandInMatch(H.match, H.st)
  broadcast({ over: true })
}
function onAction(cid, a) {
  if (!H || !a) return
  const h = H.humans.find((x) => x.cid === cid); if (!h) return
  const seat = h.seat; let r = { ok: false, reason: 'Unknown action' }
  if (a.a === 'discard') r = discardTile(H.st, seat, a.id)
  else if (a.a === 'claim') r = claim(H.st, seat, a.action, a.pair)
  else if (a.a === 'win') r = declareSelfDrawWin(H.st, seat)
  else if (a.a === 'kong') r = declareKong(H.st, seat, a.k)
  else if (a.a === 'next') { if (isHost() && H.st.phase === 'over' && H.counted) { if (H.match.finished) { send('mjend', { final: true }).catch(() => {}); store.finished = true; emit() } else nextHand(); return } }
  if (!r.ok) { if (cid !== RT.cid) send('mjs', { err: r.reason }, cid).catch(() => {}); else { store.error = r.reason; emit() } return }
  clearTimeout(H.timer); H.timer = setTimeout(hostPump, 120); broadcast()
  if (H.st.phase === 'over') finishHand()
}
function nextHand() { H.st = startHand(H.match); H.counted = false; H.log = []; broadcast({ fresh: true }); H.timer = setTimeout(hostPump, 700) }
// a human who left is replaced by a bot so the table keeps going
function watch() {
  if (!H) return
  for (const h of H.humans.slice()) {
    if (h.cid !== RT.cid && (!RT.room || !RT.room.players.some((p) => p.id === h.cid) || !alive(h.cid, 15000))) { H.humans = H.humans.filter((x) => x !== h); H.log.unshift(`${h.name} left: a bot takes the seat`); broadcast(); clearTimeout(H.timer); H.timer = setTimeout(hostPump, 300) }
  }
}

export async function hostMahjong(opts = {}) {
  const room = RT.room
  if (!room || !isHost()) throw new Error('Only the host can start')
  await roomAction('start', opts)
  const ordered = [room.players.find((p) => p.id === RT.cid), ...room.players.filter((p) => p.id !== RT.cid)].slice(0, 4)
  const match = newMatch({ ...opts, windRounds: opts.windRounds || 1, difficulty: opts.difficulty || 'normal' })
  H = { match, st: startHand(match), humans: ordered.map((p, i) => ({ seat: i, cid: p.id, name: p.name })), levels: ['normal', match.opts.difficulty, match.opts.difficulty, match.opts.difficulty], timer: 0, log: ['Game started'], counted: false }
  store.active = true; store.host = true; store.seat = 0; store.finished = false
  if (!H.watcher) H.watcher = setInterval(watch, 3000)
  send('mjstart', {}).catch(() => {})
  broadcast({ fresh: true }); openMahjongTab()
  H.timer = setTimeout(hostPump, 800)
}
export function stopMahjong(notify = true) {
  if (H) { clearTimeout(H.timer); clearInterval(H.watcher); H = null }
  if (notify && store.host) send('mjend', {}).catch(() => {})
  store.active = false; store.host = false; store.st = null; store.match = null; store.log = []; store.finished = false; store.openedTab = false; emit()
}

// ---------------- both: apply a view and send actions ----------------
function applyView(m) {
  if (m.err) { store.error = m.err; emit(); return }
  store.active = true; store.seat = m.seat; store.names = m.names; store.match = m.match; store.log = m.log || []; store.error = ''
  store.st = stateFromView(m.v, m.match.opts)
  emit()
}
export const mjActions = {
  discard(id) { act({ a: 'discard', id }) },
  claim(action, pair) { act({ a: 'claim', action, pair }) },
  win() { act({ a: 'win' }) },
  kong(k) { act({ a: 'kong', k }) },
  next() { act({ a: 'next' }) },
}
function act(a) {
  if (!store.active) return
  if (store.host) onAction(RT.cid, a)
  else send('mja', a, RT.room && RT.room.host).catch(() => {})
}

let installed = false
export function installMahjongOnline() {
  if (installed) return
  installed = true
  onMsg('mja', (d, env) => { if (isHost() && H) onAction(env.f, d) })
  onMsg('mjs', (d, env) => { if (!isHost() && RT.room && env.f === RT.room.host) { applyView(d); if (!store.openedTab) { store.openedTab = true; openMahjongTab() } } })
  onMsg('mjstart', (d, env) => { if (!isHost() && RT.room && env.f === RT.room.host) { store.openedTab = true; store.active = true; store.host = false; emit(); openMahjongTab() } })
  onMsg('mjend', (d, env) => { if (!isHost() && RT.room && env.f === RT.room.host) { if (d && d.final) { store.finished = true; emit(); return } store.openedTab = false; store.active = false; store.st = null; store.error = 'The host ended the game.'; emit() } })
  onMsg('open', () => { if (store.active && !store.host && RT.room) send('mjsync', {}, RT.room.host).catch(() => {}) })
  onMsg('mjsync', (d, env) => { if (isHost() && H) broadcast() })
  onMsg('hostchange', () => { if (store.active && !store.host) { store.active = false; store.st = null; store.error = 'The host left the game.'; emit() } })
}
if (typeof window !== 'undefined') installMahjongOnline()
export { pendingClaimSeats }
