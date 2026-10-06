// Online Tetra Blast 1v1 over Redis pub/sub. Each client simulates its own board (same seeded piece bag);
// only attacks, board snapshots and top-outs travel through the Next.js realtime routes.
import { tetrisActions, tetrisNet } from '../tetris.js'
import { RT, send, onMsg, isHost, alive, roomAction } from './rt.js'
import { announce } from '../engine.js'

let installed = false
let oppCid = null
let seedN = 0

function oppOf() { const r = RT.room; return r ? r.players.find((p) => p.id !== RT.cid) : null }

function begin(seed, opp) {
  oppCid = opp ? opp.id : null
  tetrisActions.start('online', 1, 2, { seed, oppName: opp ? opp.name : 'RIVAL' })
  tetrisNet.attach({
    atk: (n) => { send('tatk', { n }, oppCid).catch(() => {}) },
    state: (s) => { send('tst', s, oppCid).catch(() => {}) },
    dead: () => { send('tdead', {}, oppCid).catch(() => {}) },
    rematch: () => { if (isHost()) hostStart(); else send('trematch', {}, RT.room && RT.room.host).catch(() => {}) },
    onStop: () => { oppCid = null; if (isHost()) roomAction('finish').catch(() => {}) },
  })
}

async function hostStart() {
  const opp = oppOf()
  if (!opp) throw new Error('Waiting for an opponent')
  if (RT.room.status !== 'playing') await roomAction('start', {})
  const seed = (Date.now() ^ (++seedN * 7919)) >>> 0
  send('tstart', { seed }).catch(() => {})
  begin(seed, opp)
}
export const hostTetris = hostStart

export function installTetrisOnline() {
  if (installed) return
  installed = true
  onMsg('tstart', (d, env) => { if (!isHost() && RT.room && env.f === RT.room.host) begin(d.seed >>> 0, oppOf()) })
  onMsg('trematch', (d, env) => { if (isHost() && tetrisNet.active()) hostStart().catch(() => {}) })
  onMsg('tatk', (d, env) => { if (env.f !== RT.cid && tetrisNet.active()) tetrisNet.applyAtk(d.n) })
  onMsg('tst', (d, env) => { if (env.f !== RT.cid && tetrisNet.active()) tetrisNet.applyState(d) })
  onMsg('tdead', (d, env) => { if (env.f !== RT.cid && tetrisNet.active()) tetrisNet.oppOut() })
  onMsg('presence', (d, env) => { if (env.left && env.left === oppCid && tetrisNet.active()) { announce('Opponent left the match', '#ff8a96', 'cBad'); tetrisNet.oppOut() } })
  setInterval(() => {
    if (tetrisNet.active() && oppCid && !alive(oppCid, 15000)) { announce('Opponent disconnected', '#ff8a96', 'cBad'); tetrisNet.oppOut() }
  }, 3000)
}
