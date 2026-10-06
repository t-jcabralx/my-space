// Online IRON FISTS 1v1: the host simulates the match; the guest sends controls and mirrors the state.
// Fighters are chosen beforehand in the Fight lobby (each player's pick travels with the room messages).
import { fightActions, fightNet } from '../fight.js'
import { ROSTER } from '../roster.js'
import { RT, send, onMsg, isHost, alive, roomAction } from './rt.js'
import { profile, announce } from '../engine.js'

let installed = false
let peer = null
let peerPick = null
const myPick = () => (typeof profile.fightPick === 'number' ? profile.fightPick : Math.floor(Math.random() * ROSTER.length))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function begin(role, p1, p2, opp, rounds = 2) {
  peer = opp ? opp.id : null
  fightNet.reset()
  const host = RT.room ? RT.room.host : null
  fightNet.attach({
    role, me: role === 'host' ? 0 : 1,
    state: (s) => { send('fst', s, peer).catch(() => {}) },
    input: (i) => { send('fin', i, host).catch(() => {}) },
    press: (b) => { send('fbt', { b }, host).catch(() => {}) },
    fast: () => !!(RT.p2p && Object.keys(RT.p2p).length),
    rematch: () => { if (isHost()) hostFight(); else send('frematch', {}, host).catch(() => {}) },
    onStop: () => { peer = null; if (isHost()) roomAction('finish').catch(() => {}) },
  })
  fightActions.start({ type: 'online', p1, p2, diff: 2, rounds })
}
let lastRounds = 2
async function hostFight(rounds) {
  if (rounds) lastRounds = rounds
  const opp = RT.room && RT.room.players.find((p) => p.id !== RT.cid)
  if (!opp) throw new Error('Waiting for an opponent')
  peerPick = null
  send('freq', {}, opp.id).catch(() => {})
  for (let i = 0; i < 15 && peerPick === null; i++) await sleep(100)
  const p2 = peerPick === null ? Math.floor(Math.random() * ROSTER.length) : peerPick
  let p1 = myPick()
  if (p1 === p2) p1 = (p1 + 9) % ROSTER.length
  if (RT.room.status !== 'playing') await roomAction('start', {})
  send('fstart', { p1, p2, rounds: lastRounds }).catch(() => {})
  begin('host', p1, p2, opp, lastRounds)
}
export const hostFightMatch = (rounds) => hostFight(rounds)

export function installFightOnline() {
  if (installed) return
  installed = true
  const opp = () => (RT.room ? RT.room.players.find((p) => p.id !== RT.cid) : null)
  onMsg('freq', (d, env) => { if (!isHost() && RT.room && env.f === RT.room.host) send('fpick', { id: myPick() }, env.f).catch(() => {}) })
  onMsg('fpick', (d, env) => { if (isHost() && d && Number.isInteger(d.id)) peerPick = ((d.id % ROSTER.length) + ROSTER.length) % ROSTER.length })
  onMsg('fstart', (d, env) => { if (!isHost() && RT.room && env.f === RT.room.host && d) begin('guest', (d.p1 | 0) % ROSTER.length, (d.p2 | 0) % ROSTER.length, opp(), [1, 2, 3].includes(d.rounds) ? d.rounds : 2) })
  onMsg('frematch', () => { if (isHost() && fightNet.active()) hostFight().catch(() => {}) })
  onMsg('fin', (d, env) => { if (isHost() && env.f === peer && fightNet.active()) fightNet.applyInput(d) })
  onMsg('fbt', (d, env) => { if (isHost() && env.f === peer && fightNet.active() && d) fightNet.applyPress(d.b) })
  onMsg('fst', (d, env) => { if (!isHost() && fightNet.active() && env.f === (RT.room && RT.room.host)) fightNet.applyState(d) })
  onMsg('presence', (d, env) => {
    if (env.left && env.left === peer && fightNet.active()) { announce('Your opponent left the match', '#ff8a96', 'cBad'); if (isHost()) fightNet.guestLeft(); else fightNet.opponentLeft() }
  })
  setInterval(() => { if (fightNet.active() && peer && !alive(peer, 15000)) { announce('Opponent disconnected', '#ff8a96', 'cBad'); if (isHost()) fightNet.guestLeft(); else fightNet.opponentLeft() } }, 3000)
}
