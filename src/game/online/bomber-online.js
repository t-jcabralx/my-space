// Online Bomber Blast (2-4 humans, bots fill the arena): the host simulates, guests send inputs and mirror the state.
import { bomberActions, bomberNet } from '../bomber.js'
import { RT, send, onMsg, isHost, alive, roomAction } from './rt.js'
import { announce } from '../engine.js'

let installed = false
let humans = [] // [{cid,name}] in seat order; seat index + 1 = B player.human

function begin(role, list, rounds = 3) {
  humans = list
  const me = list.findIndex((h) => h.cid === RT.cid) + 1
  bomberNet.reset()
  bomberActions.start('online', 2, rounds, { humans: list.length, names: list.map((h) => h.name) })
  const host = RT.room.host
  bomberNet.attach({
    role, me,
    state: (s) => { send('bst', s).catch(() => {}) },
    input: (i) => { send('bin', i, host).catch(() => {}) },
    bomb: () => { send('bbomb', {}, host).catch(() => {}) },
    rematch: () => { if (isHost()) hostStart(); else send('brematch', {}, host).catch(() => {}) },
    onStop: () => { humans = []; if (isHost()) roomAction('finish').catch(() => {}) },
  })
}
let lastRounds = 3
async function hostStart(rounds) {
  if (rounds) lastRounds = rounds
  const room = RT.room
  const list = [room.players.find((p) => p.id === RT.cid), ...room.players.filter((p) => p.id !== RT.cid)].map((p) => ({ cid: p.id, name: p.name }))
  if (list.length < 2) throw new Error('Waiting for at least one friend')
  if (room.status !== 'playing') await roomAction('start', {})
  send('bstart', { humans: list, rounds: lastRounds }).catch(() => {})
  begin('host', list, lastRounds)
}
export const hostBomber = (rounds) => hostStart(rounds)

export function installBomberOnline() {
  if (installed) return
  installed = true
  onMsg('bstart', (d, env) => { if (!isHost() && RT.room && env.f === RT.room.host && Array.isArray(d.humans)) begin('guest', d.humans.slice(0, 4), [1, 3, 5].includes(d.rounds) ? d.rounds : 3) })
  onMsg('brematch', () => { if (isHost() && bomberNet.active()) hostStart().catch(() => {}) })
  onMsg('bin', (d, env) => { if (!isHost() || !bomberNet.active()) return; const i = humans.findIndex((h) => h.cid === env.f); if (i > 0) bomberNet.applyInput(i + 1, d) })
  onMsg('bbomb', (d, env) => { if (!isHost() || !bomberNet.active()) return; const i = humans.findIndex((h) => h.cid === env.f); if (i > 0) bomberNet.applyBomb(i + 1) })
  onMsg('bst', (d, env) => { if (!isHost() && bomberNet.active() && env.f === (RT.room && RT.room.host)) bomberNet.applyState(d) })
  onMsg('presence', (d, env) => {
    if (!env.left || !bomberNet.active()) return
    if (isHost()) { const i = humans.findIndex((h) => h.cid === env.left); if (i > 0) { announce('A player left: a bot takes over', '#ff8a96', 'cBad'); bomberNet.playerLeft(i + 1) } }
  })
  onMsg('hostchange', () => { if (bomberNet.active() && !isHost()) { announce('The host left the game', '#ff8a96', 'cBad'); bomberNet.matchAbort() } })
  setInterval(() => {
    if (!bomberNet.active()) return
    if (isHost()) humans.forEach((h, i) => { if (i > 0 && !alive(h.cid, 15000)) bomberNet.playerLeft(i + 1) })
    else if (RT.room && !alive(RT.room.host, 16000)) { announce('Lost connection to the host', '#ff8a96', 'cBad'); bomberNet.matchAbort() }
  }, 3000)
}
