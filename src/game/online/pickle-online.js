// Online Pickleball 1v1: the host simulates the match; the guest sends its movement and shots and mirrors the state.
import { pickleActions, pickleNet } from '../pickle.js'
import { RT, send, onMsg, isHost, alive, roomAction } from './rt.js'
import { announce } from '../engine.js'

let installed = false
let peer = null

function begin(role, opp, target = 11) {
  peer = opp ? opp.id : null
  pickleNet.reset()
  pickleActions.start('online', 2, target)
  pickleNet.attach({
    role, me: role === 'host' ? 1 : 2,
    state: (s) => { send('pst', s, peer).catch(() => {}) },
    input: (i) => { send('pin', i, peer).catch(() => {}) },
    shot: (type) => { send('psh', { type }, peer).catch(() => {}) },
    rematch: () => { if (isHost()) hostStart(); else send('prematch', {}, RT.room && RT.room.host).catch(() => {}) },
    onStop: () => { peer = null; if (isHost()) roomAction('finish').catch(() => {}) },
  })
}
let lastTarget = 11
async function hostStart(target) {
  if (target) lastTarget = target
  const opp = RT.room && RT.room.players.find((p) => p.id !== RT.cid)
  if (!opp) throw new Error('Waiting for an opponent')
  if (RT.room.status !== 'playing') await roomAction('start', {})
  send('pstart', { target: lastTarget }).catch(() => {})
  begin('host', opp, lastTarget)
}
export const hostPickle = (target) => hostStart(target)

export function installPickleOnline() {
  if (installed) return
  installed = true
  const opp = () => (RT.room ? RT.room.players.find((p) => p.id !== RT.cid) : null)
  onMsg('pstart', (d, env) => { if (!isHost() && RT.room && env.f === RT.room.host) begin('guest', opp(), Math.max(3, Math.min(21, (d && d.target) | 0 || 11))) })
  onMsg('prematch', () => { if (isHost() && pickleNet.active()) hostStart().catch(() => {}) })
  onMsg('pin', (d, env) => { if (isHost() && env.f === peer && pickleNet.active()) pickleNet.applyInput(d) })
  onMsg('psh', (d, env) => { if (isHost() && env.f === peer && pickleNet.active()) pickleNet.applyShot(d && d.type) })
  onMsg('pst', (d, env) => { if (!isHost() && env.f === (RT.room && RT.room.host) && pickleNet.active()) pickleNet.applyState(d) })
  onMsg('presence', (d, env) => { if (env.left && env.left === peer && pickleNet.active()) { announce('Opponent left the match', '#ff8a96', 'cBad'); pickleNet.oppGone() } })
  setInterval(() => { if (pickleNet.active() && peer && !alive(peer, 15000)) { announce('Opponent disconnected', '#ff8a96', 'cBad'); pickleNet.oppGone() } }, 3000)
}
