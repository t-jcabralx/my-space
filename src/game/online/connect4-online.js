// Online Connect Four: the host owns the board and validates moves; the guest sends the column it picked.
import { c4Actions, c4Net } from '../connect4.js'
import { RT, send, onMsg, isHost, alive, roomAction } from './rt.js'
import { announce } from '../engine.js'
let installed = false, peer = null
function begin(role, opp) {
  peer = opp ? opp.id : null
  c4Net.reset()
  c4Net.attach({ role, state: (s) => { send('cst', s, peer).catch(() => {}) }, input: (m) => { send('cmv', m, peer).catch(() => {}) }, rematch: () => { if (isHost()) hostStart(); else send('crematch', {}, RT.room && RT.room.host).catch(() => {}) }, onStop: () => { peer = null; if (isHost()) roomAction('finish').catch(() => {}) } })
  c4Actions.start({ type: 'online' })
  if (role === 'host') c4Net.sync()
}
async function hostStart() {
  const opp = RT.room && RT.room.players.find((p) => p.id !== RT.cid)
  if (!opp) throw new Error('Waiting for an opponent')
  if (RT.room.status !== 'playing') await roomAction('start', {})
  send('cstart', {}).catch(() => {})
  begin('host', opp)
}
export const hostC4 = () => hostStart()
export function installC4Online() {
  if (installed) return
  installed = true
  const opp = () => (RT.room ? RT.room.players.find((p) => p.id !== RT.cid) : null)
  onMsg('cstart', (d, env) => { if (!isHost() && RT.room && env.f === RT.room.host) begin('guest', opp()) })
  onMsg('crematch', () => { if (isHost() && c4Net.active()) hostStart().catch(() => {}) })
  onMsg('cmv', (d, env) => { if (isHost() && env.f === peer && c4Net.active()) c4Net.applyInput(d) })
  onMsg('cst', (d, env) => { if (!isHost() && env.f === (RT.room && RT.room.host) && c4Net.active()) c4Net.applyState(d) })
  onMsg('presence', (d, env) => { if (env.left && env.left === peer && c4Net.active()) { announce('Opponent left the match', '#ff8a96', 'cBad'); c4Net.opponentLeft() } })
  setInterval(() => { if (c4Net.active() && peer && !alive(peer, 15000)) { announce('Opponent disconnected', '#ff8a96', 'cBad'); c4Net.opponentLeft() } }, 3000)
}
