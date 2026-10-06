// Online co-op for NEON DEPTHS (up to 3 heroes). The host runs the dungeon; friends send their movement and receive the state.
import { rogueActions, rogueNet, joinAsGuest } from '../rogue.js'
import { RT, send, onMsg, isHost, alive, roomAction } from './rt.js'
import { announce, profile } from '../engine.js'

let installed = false
const pick = () => Math.max(0, Math.min(2, (profile.roguePick | 0) || 0))

function begin(role) {
  rogueNet.reset()
  rogueNet.attach({
    role,
    state: (pid, s) => { send('dst', s, pid).catch(() => {}) },
    input: (m) => { send('din', m, RT.room && RT.room.host).catch(() => {}) },
    perk: (i) => { send('dpk', { i }, RT.room && RT.room.host).catch(() => {}) },
    rematch: () => { if (isHost()) hostStart(); else send('drematch', {}, RT.room && RT.room.host).catch(() => {}) },
    onStop: () => { if (isHost()) roomAction('finish').catch(() => {}) },
  })
  if (role === 'host') rogueActions.start({ type: 'online', cls: pick() })
  else joinAsGuest(pick())
}
async function hostStart() {
  if (!RT.room || RT.room.players.length < 2) throw new Error('Waiting for a friend to join')
  if (RT.room.status !== 'playing') await roomAction('start', {})
  send('dstart', {}).catch(() => {})
  begin('host')
}
export const hostRogue = () => hostStart()

export function installRogueOnline() {
  if (installed) return
  installed = true
  onMsg('dstart', (d, env) => { if (!isHost() && RT.room && env.f === RT.room.host) begin('guest') })
  onMsg('drematch', () => { if (isHost() && rogueNet.active()) hostStart().catch(() => {}) })
  onMsg('din', (d, env) => { if (isHost() && rogueNet.active()) rogueNet.applyInput(env.f, d) })
  onMsg('dpk', (d, env) => { if (isHost() && rogueNet.active()) rogueNet.applyPerk(env.f, (d && d.i) | 0) })
  onMsg('dst', (d, env) => { if (!isHost() && env.f === (RT.room && RT.room.host) && rogueNet.active()) rogueNet.applyState(d) })
  onMsg('presence', (d, env) => {
    if (!rogueNet.active() || !env.left) return
    if (isHost()) { announce('A friend left the dungeon', '#ff8a96', 'cBad'); rogueNet.playerLeft(env.left) }
    else if (RT.room && env.left === RT.room.host) { announce('The host left', '#ff8a96', 'cBad'); rogueNet.hostLeft() }
  })
  setInterval(() => {
    if (!rogueNet.active() || !RT.room) return
    if (isHost()) { for (const p of RT.room.players) if (p.id !== RT.cid && !alive(p.id, 15000)) { rogueNet.playerLeft(p.id) } }
    else if (!alive(RT.room.host, 15000)) rogueNet.hostLeft()
  }, 3000)
}
