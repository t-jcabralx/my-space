// Generic online layer for the newer games (Orb Rush, Garden Siege, Snow Rush, Mortal Arena...).
// A game registers { begin(ctx), onMsg(data, fromCid), onLeave(cid), active() }; the host starts it for the whole room.
import { RT, send, onMsg, isHost, alive, roomAction } from './rt.js'
import { announce } from '../engine.js'

const reg = {}
let installed = false
let current = null // id of the game being played online
export const registerNet = (id, impl) => { reg[id] = impl }
export const netActive = () => current

function ctxFor(id, role, cfg) {
  const players = cfg.players
  const me = Math.max(0, players.findIndex((p) => p.id === RT.cid))
  return {
    id, role, seed: cfg.seed, opts: cfg.opts || {}, players, me,
    send: (d, to) => send('gin', { g: id, d }, to).catch(() => {}),
    sendHost: (d) => send('gin', { g: id, d }, RT.room && RT.room.host).catch(() => {}),
    restart: () => { if (isHost()) hostGame(id, cfg.opts || {}).catch(() => {}) },
    end: () => { if (current === id) current = null; if (isHost()) roomAction('finish').catch(() => {}) },
  }
}
// the host starts the match for everybody in the room
export async function hostGame(id, opts = {}) {
  const room = RT.room
  if (!room) throw new Error('No room')
  if (!reg[id]) throw new Error('Game not available')
  const players = room.players.map((p) => ({ id: p.id, name: p.name }))
  if (players.length < (reg[id].min || 2)) throw new Error('Waiting for another player')
  if (room.status !== 'playing') await roomAction('start', {})
  const cfg = { g: id, seed: (Math.random() * 1e9) | 0, opts, players }
  send('ggo', cfg).catch(() => {})
  current = id
  reg[id].begin(ctxFor(id, 'host', cfg))
}
export function installGameNet() {
  if (installed) return
  installed = true
  onMsg('ggo', (d, env) => {
    if (isHost() || !RT.room || env.f !== RT.room.host || !d || !reg[d.g] || !Array.isArray(d.players)) return
    current = d.g
    reg[d.g].begin(ctxFor(d.g, 'guest', d))
  })
  onMsg('gin', (d, env) => { if (d && reg[d.g] && current === d.g && reg[d.g].onMsg) reg[d.g].onMsg(d.d, env.f) })
  onMsg('presence', (d, env) => { if (env.left && current && reg[current] && reg[current].onLeave) { announce('A player left the match', '#ff8a96', 'cBad'); reg[current].onLeave(env.left) } })
  onMsg('hostchange', () => { if (current && reg[current] && reg[current].onLeave && !isHost()) reg[current].onLeave(null) })
  setInterval(() => {
    if (!current || !reg[current] || !reg[current].onLeave || !RT.room) return
    for (const p of RT.room.players) if (p.id !== RT.cid && !alive(p.id, 20000)) reg[current].onLeave(p.id)
  }, 4000)
}
export const gameEnded = (id) => { if (current === id) current = null }
