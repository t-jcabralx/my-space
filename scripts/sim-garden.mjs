import { update, G } from '../src/game/engine.js'
import { GD, gardenActions, gardenTest, LEVELS, PLANTS, ZOMBIES, ROWS, COLS } from '../src/game/garden.js'
import { games } from '../src/game/engine.js'
let failures = 0
const check = (n, c, i) => { if (!c) failures++; console.log(c ? 'PASS' : 'FAIL', n, i || '') }
const api = { put3: (...a) => { if (a.slice(0, 10).some((v) => !Number.isFinite(v))) throw new Error('NaN put3 ' + a) }, putS: (...a) => { if (a.slice(0, 9).some((v) => !Number.isFinite(v))) throw new Error('NaN putS ' + a) }, putM: () => {} }
const step = (n) => { for (let i = 0; i < n; i++) { update(1 / 20); G.time += 1 / 20 } }
const sane = () => GD.zombies.every((z) => Number.isFinite(z.x) && z.hp <= z.max) && GD.plants.every((p) => p.hp <= p.max + 1 && Number.isFinite(p.hp))
// a gardener bot: sunflowers behind, shooters where the zombies are, walls in front
function gardener(unlocked) {
  const has = (t) => unlocked.includes(t)
  const count = (t) => GD.plants.filter((p) => p.type === t).length
  const free = (r, c) => !GD.plants.some((p) => p.r === r && p.c === c)
  if (has('sunflower') && count('sunflower') < 5 && GD.sun >= 50 && (GD.cd.sunflower || 0) <= 0) for (let c = 0; c < 2; c++) for (let r = 0; r < ROWS; r++) if (free(r, c) && gardenTest.place('sunflower', r, c)) return
  const rows = new Set(GD.zombies.filter((z) => z.x < 40).map((z) => z.r))
  for (const r of [...rows, 0, 1, 2, 3, 4]) {
    const sh = GD.plants.filter((p) => p.r === r && PLANTS[p.type].fire).length
    if (sh < 2) for (let c = 2; c < 6; c++) if (free(r, c) && gardenTest.place(has('repeater') && GD.sun >= 200 ? 'repeater' : 'peashooter', r, c)) return
  }
  if (has('wallnut')) for (const r of rows) if (!GD.plants.some((p) => p.r === r && p.type === 'wallnut') && free(r, 6) && gardenTest.place('wallnut', r, 6)) return
}
check('8 plants and 5 zombies and 10 levels', Object.keys(PLANTS).length === 8 && Object.keys(ZOMBIES).length === 5 && LEVELS.length === 10)
// adventure: a competent gardener wins level 1 and 3
for (const li of [0, 2]) {
  gardenActions.start({ kind: 'plants', level: li, seed: 10 + li })
  const unlocked = Object.keys(PLANTS).slice(0, 8)
  let f = 0, bad = false
  while (GD.mode === 'play' && f < 20 * 700) {
    if (f % 10 === 0) gardener(unlocked)
    for (const s of GD.suns.slice()) if (s.age > 0.5) gardenTest.collectSun(s.id)
    step(1); f++
    if (f % 40 === 0) { if (!sane()) { bad = true; break } games.garden.draw3(api) }
  }
  check(`level ${li + 1}: stays sane and draws cleanly`, !bad)
  check(`level ${li + 1}: a gardener bot wins and the next level unlocks`, GD.over && GD.over.win && GD.over.plantsWon, `kills ${GD.kills} time ${(f / 20) | 0}s over ${JSON.stringify(GD.over && { w: GD.over.win, k: GD.over.kills })}`)
}
// without defences the zombies win
{
  gardenActions.start({ kind: 'plants', level: 3, seed: 3 })
  let f = 0; while (GD.mode === 'play' && f < 20 * 600) { step(1); f++ }
  check('an empty lawn loses to the horde (and the mowers fire)', GD.over && !GD.over.win && GD.mowers.some((m) => m.used || m.run), 'time ' + (f / 20 | 0))
}
// plant mechanics
{
  gardenActions.start({ kind: 'plants', level: 9, seed: 4 })
  GD.sun = 1000
  const p = gardenTest.place('peashooter', 2, 3); check('planting costs sun', p && GD.sun === 900)
  GD.cd = {}; gardenTest.place('peashooter', 2, 2); GD.cd = {}; gardenTest.place('peashooter', 2, 1)
  check('cannot plant on an occupied cell', !gardenTest.place('sunflower', 2, 3))
  GD.dir.list = [{ t: 99999, type: 'walker', r: 0 }]; GD.zombies.push({ id: 900, type: 'walker', r: 2, x: 20, hp: 200, max: 200, slow: 0, eating: 0, hit: 0, t: 0, by: 0 })
  step(20 * 20)
  check('a peashooter kills a walker in its row', !GD.zombies.some((z) => z.id === 900) && GD.kills >= 1, 'kills ' + GD.kills)
  GD.cd = {}; gardenTest.place('cherry', 1, 5); GD.zombies.push({ id: 901, type: 'bucket', r: 1, x: cellXof(5) + 3, hp: 1300, max: 1300, slow: 0, eating: 0, hit: 0, t: 0, by: 0 })
  step(30)
  check('a cherry bomb wipes a bucket head', !GD.zombies.some((z) => z.id === 901))
  GD.cd = {}; gardenTest.place('mine', 3, 7); step(20 * 15)
  GD.zombies.push({ id: 902, type: 'giant', r: 3, x: cellXof(7) + 2, hp: 3200, max: 3200, slow: 0, eating: 0, hit: 0, t: 0, by: 0 })
  step(40)
  check('an armed potato mine hurts a giant', !GD.zombies.some((z) => z.id === 902) || GD.zombies.find((z) => z.id === 902).hp < 1600)
}
function cellXof(c) { return -32.4 + (c + 0.5) * 7.2 }
// you as the zombies against the AI gardener
{
  gardenActions.start({ kind: 'zombies', level: 0, seed: 5 })
  let f = 0, bad = false
  while (GD.mode === 'play' && f < 20 * 400) {
    if (f % 20 === 0) { const r = (f / 20 | 0) % ROWS; const t = GD.brain >= 7 ? 'bucket' : GD.brain >= 4 ? 'cone' : 'walker'; gardenTest.hostAct({ k: 'zomb', type: t, r }, 'zombies') }
    step(1); f++
    if (f % 40 === 0 && !sane()) { bad = true; break }
  }
  check('zombie side: brains buy zombies, the AI gardener defends, a result arrives', !bad && GD.mode === 'over' && GD.over, `time ${(f / 20) | 0}s planted ${GD.planted} kills ${GD.kills} win ${GD.over && GD.over.win}`)
  check('zombie side: the AI planted defences', GD.planted >= 5)
}
// online versus: the guest mirrors the host's snapshots and its actions are validated by the host
{
  gardenActions.start({ kind: 'versus', level: 0, seed: 6 })
  GD.ai = null
  GD.net = { role: 'host', me: 0, foe: 'X', send() {}, sendHost() {}, restart() {} }
  GD.sun = 500
  gardenTest.hostAct({ k: 'plant', type: 'peashooter', r: 1, c: 2 }, 'plants')
  gardenTest.hostAct({ k: 'zomb', type: 'cone', r: 1 }, 'zombies')
  gardenTest.hostAct({ k: 'zomb', type: 'giant', r: 1 }, 'plants') // wrong side: ignored
  step(20 * 3)
  const snap = JSON.parse(JSON.stringify(gardenTest.snapshot()))
  check('versus: host applies actions from the right side only', GD.plants.length === 1 && GD.zombies.length === 1)
  const before = { p: GD.plants.length, z: GD.zombies.length }
  GD.plants = []; GD.zombies = []; GD.net.role = 'guest'
  gardenTest.apply(snap)
  check('versus: a guest rebuilds the board from a snapshot', GD.plants.length === before.p && GD.zombies.length === before.z && GD.zombies[0].type === 'cone')
}
gardenActions.stop()
// the later levels are playable and end with a result
{
  gardenActions.start({ kind: 'plants', level: 9, seed: 77 })
  const unlocked = Object.keys(PLANTS)
  let f = 0
  while (GD.mode === 'play' && f < 20 * 900) { if (f % 10 === 0) gardener(unlocked); for (const s of GD.suns.slice()) if (s.age > 0.5) gardenTest.collectSun(s.id); step(1); f++ }
  check('level 10: ends with a result and sane stats', GD.over && GD.over.kills > 10, `win ${GD.over && GD.over.win} kills ${GD.kills} ${(f / 20) | 0}s`)
}
process.exit(failures ? 1 : 0)
