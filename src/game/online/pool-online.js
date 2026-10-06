// Online Billiards 1v1: the host simulates the balls; the guest sends its aim, shots and cue-ball placement and mirrors the table.
import { poolActions, poolNet } from '../pool.js'
import { RT, send, onMsg, isHost, alive, roomAction } from './rt.js'
import { announce } from '../engine.js'

let installed = false
let peer = null

function begin(role, opp) {
  peer = opp ? opp.id : null
  poolNet.reset()
  poolActions.start({ type: 'online', diff: 2 })
  poolNet.attach({
    role,
    state: (s) => { send('ost', s, peer).catch(() => {}) },
    input: (m) => { send('oin', m, peer).catch(() => {}) },
    rematch: () => { if (isHost()) hostStart(); else send('orematch', {}, RT.room && RT.room.host).catch(() => {}) },
    onStop: () => { peer = null; if (isHost()) roomAction('finish').catch(() => {}) },
  })
}
async function hostStart() {
  const opp = RT.room && RT.room.players.find((p) => p.id !== RT.cid)
  if (!opp) throw new Error('Waiting for an opponent')
  if (RT.room.status !== 'playing') await roomAction('start', {})
  send('ostart', {}).catch(() => {})
  begin('host', opp)
}
export const hostPool = () => hostStart()

export function installPoolOnline() {
  if (installed) return
  installed = true
  const opp = () => (RT.room ? RT.room.players.find((p) => p.id !== RT.cid) : null)
  onMsg('ostart', (d, env) => { if (!isHost() && RT.room && env.f === RT.room.host) begin('guest', opp()) })
  onMsg('orematch', () => { if (isHost() && poolNet.active()) hostStart().catch(() => {}) })
  onMsg('oin', (d, env) => { if (isHost() && env.f === peer && poolNet.active()) poolNet.applyInput(d) })
  onMsg('ost', (d, env) => { if (!isHost() && env.f === (RT.room && RT.room.host) && poolNet.active()) poolNet.applyState(d) })
  onMsg('presence', (d, env) => { if (env.left && env.left === peer && poolNet.active()) { announce('Opponent left the match', '#ff8a96', 'cBad'); poolNet.opponentLeft() } })
  setInterval(() => { if (poolNet.active() && peer && !alive(peer, 15000)) { announce('Opponent disconnected', '#ff8a96', 'cBad'); poolNet.opponentLeft() } }, 3000)
}
