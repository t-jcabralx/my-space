// Online Air Hockey 1v1: the host simulates the puck and its own mallet; the guest drives its own mallet and mirrors the host's state.
import { hockeyActions, hockeyNet } from '../hockey.js'
import { RT, send, onMsg, isHost, alive, roomAction } from './rt.js'
import { announce } from '../engine.js'

let installed = false
let peer = null

function begin(role, opp, target = 7) {
  peer = opp ? opp.id : null
  hockeyNet.reset()
  hockeyActions.start({ type: 'online', diff: 2, target, chaos: true })
  hockeyNet.attach({
    role,
    state: (s) => { send('hst', s, peer).catch(() => {}) },
    mine: (m) => { send('hmy', m, peer).catch(() => {}) },
    rematch: () => { if (isHost()) hostStart(); else send('hrematch', {}, RT.room && RT.room.host).catch(() => {}) },
    onStop: () => { peer = null; if (isHost()) roomAction('finish').catch(() => {}) },
  })
}
let lastTarget = 7
async function hostStart(target) {
  if (target) lastTarget = target
  const opp = RT.room && RT.room.players.find((p) => p.id !== RT.cid)
  if (!opp) throw new Error('Waiting for an opponent')
  if (RT.room.status !== 'playing') await roomAction('start', {})
  send('hstart', { target: lastTarget }).catch(() => {})
  begin('host', opp, lastTarget)
}
export const hostHockey = (target) => hostStart(target)

export function installHockeyOnline() {
  if (installed) return
  installed = true
  const opp = () => (RT.room ? RT.room.players.find((p) => p.id !== RT.cid) : null)
  onMsg('hstart', (d, env) => { if (!isHost() && RT.room && env.f === RT.room.host) begin('guest', opp(), Math.max(3, Math.min(15, (d && d.target) | 0 || 7))) })
  onMsg('hrematch', () => { if (isHost() && hockeyNet.active()) hostStart().catch(() => {}) })
  onMsg('hmy', (d, env) => { if (isHost() && env.f === peer && hockeyNet.active()) hockeyNet.applyMallet(d) })
  onMsg('hst', (d, env) => { if (!isHost() && env.f === (RT.room && RT.room.host) && hockeyNet.active()) hockeyNet.applyState(d) })
  onMsg('presence', (d, env) => { if (env.left && env.left === peer && hockeyNet.active()) { announce('Opponent left the match', '#ff8a96', 'cBad'); hockeyNet.opponentLeft() } })
  setInterval(() => { if (hockeyNet.active() && peer && !alive(peer, 15000)) { announce('Opponent disconnected', '#ff8a96', 'cBad'); hockeyNet.opponentLeft() } }, 3000)
}
