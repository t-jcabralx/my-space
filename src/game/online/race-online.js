// Online racing: every driver simulates their own car (instant response); the host runs the AI cars and relays the field.
import { raceActions, raceNet, RC, CARS } from '../race.js'
import { RT, send, onMsg, isHost, alive, roomAction } from './rt.js'
import { profile, announce } from '../engine.js'

let installed = false
let humans = [] // [{cid,name,car}] in seat order (seat 0 = host)
const picks = {}
const myCar = () => (typeof profile.racePick === 'number' ? profile.racePick : 0)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function begin(role, cfg, list) {
  humans = list
  raceNet.reset()
  const me = list.findIndex((h) => h.cid === RT.cid)
  const host = RT.room ? RT.room.host : null
  raceNet.attach({
    role,
    state: (s) => { send('rst', s).catch(() => {}) },
    mine: (a) => { send('rmy', { a }, host).catch(() => {}) },
    ev: (d) => { send('rev', d, host).catch(() => {}) },
    hit: (i, d) => { const h = humans[i]; if (h) send('rev', d, h.cid).catch(() => {}) },
    fast: () => !!(RT.p2p && Object.keys(RT.p2p).length),
    rematch: () => { if (isHost()) hostRace(); else send('rrematch', {}, host).catch(() => {}) },
    onStop: () => { humans = []; if (isHost()) roomAction('finish').catch(() => {}) },
  })
  raceActions.start({ ...cfg, type: 'online', humans: list.map((h) => h.car) })
  RC.me = Math.max(0, me)
  RC.cars.forEach((c, i) => { c.human = i === RC.me; c.remote = role === 'host' ? i > 0 && i < list.length : i !== RC.me; c.name = i < list.length ? (list[i].name || 'P' + (i + 1)).slice(0, 8).toUpperCase() : c.name })
  if (role === 'guest') RC.cars.forEach((c, i) => { if (i >= list.length) c.remote = true })
}
let lastCfg = { track: 0, laps: 3, diff: 2, ai: 3 }
async function hostRace(cfg) {
  if (cfg) lastCfg = { ...lastCfg, ...cfg }
  const room = RT.room
  if (!room) throw new Error('No room')
  const others = room.players.filter((p) => p.id !== RT.cid)
  for (const o of others) send('rreq', {}, o.id).catch(() => {})
  for (let i = 0; i < 12 && others.some((o) => picks[o.id] === undefined); i++) await sleep(100)
  const list = [{ cid: RT.cid, name: (profile.name || 'HOST'), car: myCar() }, ...others.map((o) => ({ cid: o.id, name: o.name, car: picks[o.id] === undefined ? 0 : picks[o.id] }))].slice(0, 4)
  const used = new Set()
  list.forEach((h) => { while (used.has(h.car)) h.car = (h.car + 1) % CARS.length; used.add(h.car) })
  if (room.status !== 'playing') await roomAction('start', {})
  const cfg2 = { ...lastCfg, laps: lastCfg.laps, seed: (Math.random() * 1e9) | 0 }
  send('rstart', { cfg: cfg2, list }).catch(() => {})
  begin('host', cfg2, list)
}
export const hostRaceMatch = (cfg) => hostRace(cfg)

export function installRaceOnline() {
  if (installed) return
  installed = true
  onMsg('rreq', (d, env) => { if (!isHost() && RT.room && env.f === RT.room.host) send('rpick', { car: myCar() }, env.f).catch(() => {}) })
  onMsg('rpick', (d, env) => { if (isHost() && d && Number.isInteger(d.car)) picks[env.f] = ((d.car % CARS.length) + CARS.length) % CARS.length })
  onMsg('rstart', (d, env) => { if (!isHost() && RT.room && env.f === RT.room.host && d && d.cfg && Array.isArray(d.list)) begin('guest', d.cfg, d.list.slice(0, 4)) })
  onMsg('rev', (d, env) => { if (!raceNet.active() || !d) return; if (isHost()) { const i = humans.findIndex((h) => h.cid === env.f); if (i > 0) raceNet.hostEvent(i, d) } else if (RT.room && env.f === RT.room.host) raceNet.guestEvent(d) })
  onMsg('rrematch', () => { if (isHost() && raceNet.active()) hostRace().catch(() => {}) })
  onMsg('rmy', (d, env) => { if (!isHost() || !raceNet.active() || !d) return; const i = humans.findIndex((h) => h.cid === env.f); if (i > 0) raceNet.hostCar(i, d.a) })
  onMsg('rst', (d, env) => { if (!isHost() && raceNet.active() && env.f === (RT.room && RT.room.host)) raceNet.applyState(d) })
  onMsg('presence', (d, env) => {
    if (!env.left || !raceNet.active()) return
    if (isHost()) { const i = humans.findIndex((h) => h.cid === env.left); if (i > 0) { announce('A driver left: a bot takes the car', '#ff8a96', 'cBad'); raceNet.playerLeft(i) } }
  })
  onMsg('hostchange', () => { if (raceNet.active() && !isHost()) { announce('The host left the race', '#ff8a96', 'cBad'); raceNet.opponentLeft() } })
  setInterval(() => {
    if (!raceNet.active()) return
    if (isHost()) humans.forEach((h, i) => { if (i > 0 && !alive(h.cid, 15000)) raceNet.playerLeft(i) })
    else if (RT.room && !alive(RT.room.host, 16000)) { announce('Lost connection to the host', '#ff8a96', 'cBad'); raceNet.opponentLeft() }
  }, 3000)
}
