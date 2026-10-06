// Online EMPIRE RISE: the host runs the world; each friend sends commands (build, train, upgrade, attack) and mirrors the state.
import { empireActions, empireNet, EM } from '../empire.js'
import { RT, send, onMsg, isHost, alive, roomAction } from './rt.js'
import { announce } from '../engine.js'

let installed = false
let cfg = { ai: 1, diff: 2 }

function begin(role, d) {
  empireNet.reset()
  empireNet.attach({
    role,
    state: (pid, s) => { send('est', s, pid).catch(() => {}) },
    cmd: (c) => { send('ecmd', c, RT.room && RT.room.host).catch(() => {}) },
    rematch: () => { if (isHost()) hostStart(); else send('erematch', {}, RT.room && RT.room.host).catch(() => {}) },
    onStop: () => { if (isHost()) roomAction('finish').catch(() => {}) },
  })
  const players = d.players
  if (role === 'host') empireActions.start({ type: 'online', seed: d.seed, ai: d.ai, diff: d.diff, peers: players.slice(1) })
  else { const me = Math.max(0, players.findIndex((p) => p.id === RT.cid)); empireActions.start({ type: 'online', seed: d.seed, ai: d.ai, diff: d.diff, me, peers: players.slice(1) }) }
}
async function hostStart() {
  if (!RT.room || RT.room.players.length < 2) throw new Error('Waiting for a friend to join')
  if (RT.room.status !== 'playing') await roomAction('start', {})
  const players = RT.room.players.map((p) => ({ id: p.id, name: p.name }))
  const ai = Math.max(0, 4 - players.length)
  const d = { seed: ((Math.random() * 1e6) | 0) + 1, ai, diff: cfg.diff, players }
  send('estart', d).catch(() => {})
  begin('host', d)
}
export const hostEmpire = (c) => { if (c) cfg = { ...cfg, ...c }; return hostStart() }

export function installEmpireOnline() {
  if (installed) return
  installed = true
  onMsg('estart', (d, env) => { if (!isHost() && RT.room && env.f === RT.room.host && d && Array.isArray(d.players)) begin('guest', d) })
  onMsg('erematch', () => { if (isHost() && empireNet.active()) hostStart().catch(() => {}) })
  onMsg('ecmd', (d, env) => { if (isHost() && empireNet.active()) empireNet.applyCommand(env.f, d) })
  onMsg('est', (d, env) => { if (!isHost() && env.f === (RT.room && RT.room.host) && empireNet.active()) empireNet.applyState(d) })
  onMsg('presence', (d, env) => {
    if (!empireNet.active() || !env.left) return
    if (isHost()) { announce('A friend left: an AI takes over their kingdom', '#ff8a96', 'cBad'); empireNet.playerLeft(env.left) }
    else if (RT.room && env.left === RT.room.host) { announce('The host left', '#ff8a96', 'cBad'); empireNet.hostLeft() }
  })
  setInterval(() => {
    if (!empireNet.active() || !RT.room) return
    if (isHost()) { for (const p of RT.room.players) if (p.id !== RT.cid && !alive(p.id, 15000)) empireNet.playerLeft(p.id) }
    else if (!alive(RT.room.host, 15000)) empireNet.hostLeft()
  }, 3000)
}
void EM
