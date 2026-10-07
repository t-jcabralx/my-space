// Online card games over Redis pub/sub. The HOST simulates the game; every other human is a thin client that
// renders their own private view and forwards clicks. No separate server: all messages go through /api/rt/*.
import { CS, cardsActions, buildSnap, notify } from '../cards/core.js'
import { unoApi } from '../cards/uno.js'
import { pusoyApi } from '../cards/pusoy.js'
import { lucky9Api } from '../cards/lucky9.js'
import { tongitsApi } from '../cards/tongits.js'
import { baccaratApi } from '../cards/baccarat.js'
import { pokerApi } from '../cards/poker.js'
import { RT, send, onMsg, isHost, alive, roomAction } from './rt.js'
import { profile, saveProfile, recordScore, G, announce } from '../engine.js'
import { sfx } from '../audio.js'

let installed = false
const HOSTED = { current: null }
let LASTOPTS = {}
const APIS = { uno: unoApi, pusoy: pusoyApi, lucky9: lucky9Api, tongits: tongitsApi, baccarat: baccaratApi, poker: pokerApi }
const SEATS = { uno: 4, pusoy: 4, lucky9: 4, tongits: 3, baccarat: 4, poker: 4 }
const WINFIELD = { uno: 'unoWins', pusoy: 'pusoyWins' }

// ---------------- HOST ----------------
export async function hostCardGame(game, opts) {
  const room = RT.room
  if (!room || !isHost()) throw new Error('Only the host can start')
  if (!APIS[game]) throw new Error('That game is not online yet')
  await roomAction('start', opts)
  LASTOPTS = { ...opts, game }
  const humans = [room.players.find((p) => p.id === RT.cid), ...room.players.filter((p) => p.id !== RT.cid)].map((p) => ({ cid: p.id, name: p.name }))
  const count = game === 'uno' ? Math.min(4, Math.max(humans.length, Number(opts.count) || 4)) : SEATS[game]
  if (game === 'poker') opts = { ...opts, bots: Math.max(0, 4 - humans.length) }
  if (game === 'baccarat') opts = { ...opts, bots: Math.max(0, 3 - humans.length) }
  CS.online = { host: true, game, onEnd: () => { send('gend', {}).catch(() => {}); if (isHost()) roomAction('finish').catch(() => {}); HOSTED.current = null } }
  CS.onNotify = () => push(false)
  HOSTED.current = { game, humans, last: {}, lastSend: 0, pending: false }
  cardsActions.start(game, { ...opts, count, humans, online: true })
  push(true)
}
function unoPlayers() { const h = HOSTED.current; return h ? APIS[h.game].players() : [] }
const api = () => APIS[HOSTED.current.game]
function push(force) {
  const h = HOSTED.current
  if (!h || !CS.g) return
  const now = Date.now()
  if (!force && now - h.lastSend < 110) { if (!h.pending) { h.pending = true; setTimeout(() => { h.pending = false; push(false) }, 120) } return }
  h.lastSend = now
  unoPlayers().forEach((p, idx) => {
    if (!p.human || !p.cid || p.cid === RT.cid) return
    const s = buildSnap(idx)
    s.toasts = s.toasts.map(({ id, text, color }) => ({ id, text, color }))
    delete s.chips
    const key = JSON.stringify(s)
    if (!force && h.last[p.cid] === key) return
    h.last[p.cid] = key
    send('state', s, p.cid).catch((e) => { if (globalThis.__RT_DEBUG) console.log('state send failed', e.message) })
  })
}
function hostHandle(cid, kind, d) {
  const h = HOSTED.current
  if (!h || !CS.g || CS.mode === 'idle') return
  const idx = unoPlayers().findIndex((p) => p.cid === cid && p.human)
  if (idx < 0) return
  api().setActor(idx)
  try { if (kind === 'click') CS.g.click(d.id); else if (kind === 'btn') CS.g.button(d.name, d.arg) } finally { api().setActor(0) }
}
function hostWatch() {
  const h = HOSTED.current
  if (!h || !CS.g) return
  unoPlayers().forEach((p, idx) => {
    if (p.human && p.cid && p.cid !== RT.cid && !alive(p.cid, 15000)) { announce(`${p.name} disconnected: a bot takes their seat`, '#ff8a96', 'cBad'); api().dropToBot(idx) }
  })
}

// ---------------- CLIENT ----------------
let prev = null
function applyState(s) {
  const mine = RT.cid
  if (!CS.remote || CS.id !== s.id) { prev = null; applyState.done = null; cardsActions.startRemote(s.id, (kind, d) => { if (RT.room) send(kind, d, RT.room.host).catch(() => {}) }) }
  CS.mode = s.mode === 'over' ? 'over' : 'play'
  CS.onlineClient = true
  let snap = s
  if (s.over && s.over.winnerCid !== undefined) {
    const win = s.over.winnerCid === mine && !s.over.chipsMode
    const me = (s.over.scores || []).find((x) => x.cid === mine)
    snap = { ...s, over: { ...s.over, win, title: win ? 'YOU WIN THE MATCH!' : s.over.title, score: win && me ? me.score : 0 } }
    if (!applyState.done || applyState.done !== s.over.winner + ':' + JSON.stringify(s.over.rows)) {
      applyState.done = s.over.winner + ':' + JSON.stringify(s.over.rows)
      profile.cardGames = (profile.cardGames || 0) + 1
      if (win) { profile.cardWins = (profile.cardWins || 0) + 1; const f = WINFIELD[s.id]; if (f) profile[f] = (profile[f] || 0) + 1; if (snap.over.score > 0) recordScore(s.id, snap.over.score) }
      saveProfile()
    }
  }
  // sounds are normally played by the host's game logic: derive the important ones from state changes
  if (prev) {
    const top = s.center && s.center.top, ptop = prev.center && prev.center.top
    if (top && (!ptop || top.id !== ptop.id)) sfx(top.color === 'W' ? 'cWild' : 'cPlay')
    else if (!top && s.center && s.center.combo !== (prev.center && prev.center.combo) && s.center.combo) sfx('cPlay')
    if (s.phase !== prev.phase && s.phase === 'payout') sfx('cChip')
    const mc = s.cards.filter((c) => c.mine).length, pc = prev.cards.filter((c) => c.mine).length
    if (mc > pc) sfx('cDraw')
    if (s.banner && (!prev.banner || prev.banner.id !== s.banner.id)) sfx('cSkip')
    if (s.confetti && s.confetti !== prev.confetti) sfx('cWin')
    const myTurn = s.seats.find((x) => x.human && x.turn), wasTurn = prev.seats.find((x) => x.human && x.turn)
    if (myTurn && !wasTurn) sfx('cSelect')
    if (s.cards.length !== prev.cards.length && s.phase === 'deal') sfx('cDeal')
  }
  prev = s
  CS.remote.snap = snap
  notify()
}
function clientEnd(why) {
  if (!CS.remote) return
  const wasOver = CS.mode === 'over'
  cardsActions.stop(); prev = null; applyState.done = null
  if (!wasOver) announce(why, '#ff8a96', 'cBad')
}

export function installCardsOnline() {
  if (installed) return
  installed = true
  onMsg('click', (d, env) => { if (isHost() && env.f !== RT.cid) hostHandle(env.f, 'click', d) })
  onMsg('btn', (d, env) => { if (isHost() && env.f !== RT.cid) hostHandle(env.f, 'btn', d) })
  onMsg('rematch', (d, env) => { if (isHost() && HOSTED.current && CS.mode === 'over') { const h = HOSTED.current; cardsActions.start(h.game, { ...LASTOPTS, count: unoPlayers().length, humans: h.humans.filter((x) => alive(x.cid, 15000) || x.cid === RT.cid), online: true }); h.last = {}; push(true) } })
  onMsg('sync', (d, env) => { if (isHost() && HOSTED.current) { HOSTED.current.last = {}; push(true) } })
  onMsg('state', (d, env) => { if (!isHost() && RT.room) applyState(d) })
  onMsg('gend', (d, env) => { if (!isHost()) clientEnd('The host ended the game') })
  onMsg('presence', (d, env) => { if (isHost() && env.left) { const idx = unoPlayers().findIndex((p) => p.cid === env.left); if (idx >= 0 && HOSTED.current) api().dropToBot(idx) } })
  onMsg('hostchange', () => { if (CS.remote) clientEnd('The host left the game') })
  onMsg('open', () => { if (CS.remote) send('sync', {}, RT.room && RT.room.host).catch(() => {}) })
  setInterval(() => {
    if (HOSTED.current) { hostWatch(); push(true) }
    else if (CS.remote && RT.room && !alive(RT.room.host, 16000)) clientEnd('Lost connection to the host')
  }, 3000)
}
