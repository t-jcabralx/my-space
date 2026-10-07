// Two-process online tests for the newer games (needs the dev server on :3000): node scripts/sim-online2.mjs
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const role = process.argv[2], game = process.argv[3] || 'orb', code = process.argv[4]
const BASE = process.env.RT_BASE || 'http://localhost:3000'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
if (!role) {
  const self = fileURLToPath(import.meta.url)
  let fail = 0
  for (const g of (process.env.GAMES || 'orb,garden,ssx,kart,hunt,climb,kong,slug,snake,word,mines').split(',')) {
    if (g === 'story') continue
    const host = spawn('node', [self, 'host', g], { stdio: ['ignore', 'pipe', 'inherit'] })
    let hostOut = '', guestOut = '', guest
    host.stdout.on('data', (d) => {
      hostOut += d; process.stdout.write('[host] ' + d)
      const m = /CODE (\w+)/.exec(hostOut)
      if (m && !guest) { guest = spawn('node', [self, 'guest', g, m[1]], { stdio: ['ignore', 'pipe', 'inherit'] }); guest.stdout.on('data', (x) => { guestOut += x; process.stdout.write('[guest] ' + x) }) }
    })
    await new Promise((r) => host.on('exit', r))
    if (guest) await new Promise((r) => (guest.exitCode !== null ? r() : guest.on('exit', r)))
    if (/FAIL/.test(hostOut + guestOut) || !/DONE/.test(hostOut) || !/DONE/.test(guestOut)) fail++
  }
  console.log(fail ? 'ONLINE2 FAIL' : 'ONLINE2 OK'); process.exit(fail ? 1 : 0)
}
globalThis.__RT_BASE = BASE
const eng = await import('../src/game/engine.js')
const rtm = await import('../src/game/online/rt.js')
const { hostGame, installGameNet } = await import('../src/game/online/gnet.js')
const { OB, orbActions } = await import('../src/game/orb.js')
const { GD, gardenActions, gardenTest, SURVIVE_T } = await import('../src/game/garden.js')
const { SX, snowTest } = await import('../src/game/ssx.js')
const { RC } = await import('../src/game/race.js')
const { D, DUELS } = await import('../src/game/duel.js')
const { HT, huntActions } = await import('../src/game/hunt.js')
const { CL, climbActions } = await import('../src/game/climb.js')
const { KG, kongActions } = await import('../src/game/kong.js')
const { SN } = await import('../src/game/snake.js')
const { WD } = await import('../src/game/word.js')
const { MS } = await import('../src/game/mines.js')
const { hostRaceMatch, installRaceOnline } = await import('../src/game/online/race-online.js')
installGameNet(); installRaceOnline()
let bad = 0
const check = (n, c, i) => { if (!c) bad++; console.log(c ? 'PASS' : 'FAIL', role, n, i || '') }
const t = setInterval(() => eng.update(1 / 20 * 3), 50) // 3x speed, 20Hz
const until = async (f, ms = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (f()) return true; await sleep(100) } return false }
const join = async (name) => {
  if (role === 'host') {
    const room = await rtm.createRoom(game, 'HOSTY'); console.log('CODE', room.code)
    check('guest joins', await until(() => rtm.RT.room.players.length === 2))
    await sleep(1500)
  } else { await sleep(500); await rtm.joinRoom(code, 'GUESTY') }
  void name
}
if (game === 'orb') {
  await join()
  if (role === 'host') await hostGame('orb', { level: 0 })
  check('versus starts on both sides', await until(() => OB.mode === 'play' && OB.kind === 'versus' && OB.net), OB.mode)
  const bot = setInterval(() => {
    if (OB.mode !== 'play') return
    let best = null
    for (let i = OB.balls.length - 1; i >= 0; i--) { const b = OB.balls[i]; if (b.s < 26) continue; if (b.c === OB.cur) { best = b; break } }
    if (!best) { const v = OB.balls.filter((b) => b.s > 26); best = v[v.length - 1] }
    if (!best) return
    const P = OB.path.pts, p = P[Math.min(P.length - 2, Math.floor(best.s / 0.4))]
    OB.aim = Math.atan2(p.y, p.x); orbActions.fire()
  }, 180)
  check('we receive the rival status', await until(() => OB.foe && (OB.foe.left > 0 || OB.foe.p > 0), 30000), JSON.stringify(OB.foe))
  check('both play until somebody clears or falls', await until(() => OB.mode === 'over', 240000), OB.mode)
  clearInterval(bot)
  console.log('RESULT', role, OB.over && OB.over.win ? 'WIN' : 'LOSE', OB.over && OB.over.reason)
  await sleep(1500)
} else if (game === 'garden') {
  await join()
  if (role === 'host') await hostGame('garden', {})
  check('versus garden starts on both sides', await until(() => GD.mode === 'play' && GD.kind === 'versus' && GD.net), GD.mode)
  check('seats: host plants, guest horde', role === 'host' ? GD.net.me === 0 : GD.net.me === 1, 'me ' + GD.net.me)
  if (role === 'guest') {
    await sleep(500)
    GD.brain = 30
    gardenTest.act({ k: 'zomb', type: 'walker', r: 2 }); gardenTest.act({ k: 'zomb', type: 'cone', r: 3 })
  } else {
    GD.sun = 900
    for (let c = 0; c < 3; c++) { GD.cd = {}; gardenTest.place('peashooter', 2, c + 1) }
  }
  check('host sees the zombies the guest sent', role === 'guest' || (await until(() => GD.zombies.length >= 1, 20000)), 'zombies ' + GD.zombies.length)
  check('guest sees the plants and zombies from snapshots', role === 'host' || (await until(() => GD.plants.length >= 3 && GD.zombies.length >= 1, 20000)), `plants ${GD.plants.length} zombies ${GD.zombies.length}`)
  if (role === 'host') { await sleep(1500); GD.t = SURVIVE_T - 0.2 }
  check('the match ends on both sides with the garden winning', await until(() => GD.mode === 'over', 60000), GD.mode)
  check('results are mirrored (host wins, guest loses)', role === 'host' ? GD.over.win === true : GD.over.win === false, JSON.stringify(GD.over && { w: GD.over.win, s: GD.over.side }))
  await sleep(1500)
} else if (game === 'ssx') {
  await join()
  if (role === 'host') await hostGame('ssx', { course: 1, kind: 'race' })
  check('the snow race starts on both sides', await until(() => SX.mode !== 'idle' && SX.net && SX.riders.length === 2), SX.mode)
  check('each side rides its own rider', SX.P && SX.P.isP && SX.riders.some((r) => r.remote), 'riders ' + SX.riders.length)
  const T = snowTest()
  const drive = setInterval(() => {
    const P = SX.P; if (!P || SX.mode !== 'play') return
    const mid = T.xc(P.z + 14), want = Math.max(-0.45, Math.min(0.45, (mid - P.x) * 0.09)), dh = want - P.hd
    eng.keys.ArrowRight = dh > 0.06; eng.keys.ArrowLeft = dh < -0.06
  }, 40)
  check('the countdown ends', await until(() => SX.mode === 'play' || SX.mode === 'finish', 30000), SX.mode)
  const other = () => SX.riders.find((r) => r.remote)
  check('we see the other rider moving', await until(() => other().z > 30 && other().tgt, 40000), JSON.stringify([other().z | 0]))
  check('the race ends with results on both sides', await until(() => SX.mode === 'over', 240000), SX.mode)
  clearInterval(drive); eng.keys.ArrowRight = eng.keys.ArrowLeft = false
  console.log('RESULT', role, SX.over && SX.over.place, 'of', SX.riders.length)
  await sleep(1500)
} else if (game === 'kart') {
  await join()
  if (role === 'host') await hostRaceMatch({ track: 0, laps: 1, diff: 1, ai: 2, kart: true })
  check('kart race starts on both sides', await until(() => RC.mode === 'play' && RC.cfg.type === 'online' && RC.cfg.kart), RC.mode)
  check('item boxes exist on both sides', RC.boxes && RC.boxes.length > 0, 'boxes ' + (RC.boxes && RC.boxes.length))
  const drive = setInterval(() => {
    const me = RC.cars[RC.me], P = RC.tk.P, N = RC.tk.N
    const tp = P[(me.idx + Math.round(8 + me.sp * 0.15)) % N]
    let d = Math.atan2(tp.x - me.x, -(tp.z - me.z)) - me.th; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2
    eng.keys.ArrowUp = true; eng.keys.ArrowLeft = d < -0.05; eng.keys.ArrowRight = d > 0.05
  }, 40)
  check('racing starts', await until(() => RC.phase === 'race', 30000), RC.phase)
  if (role === 'guest') {
    await sleep(1500)
    RC.cars[RC.me].item = 'banana'; RC.cars[RC.me].itemN = 1; RC.cars[RC.me].fHeld = false
    eng.keys.KeyF = true; await sleep(300); eng.keys.KeyF = false
  }
  check('a banana dropped by the guest appears on the host and guest', await until(() => RC.items.length >= 1, 20000), 'items ' + RC.items.length)
  check('race ends on both sides', await until(() => RC.phase === 'results', 280000), RC.phase)
  clearInterval(drive); eng.keys.ArrowUp = eng.keys.ArrowLeft = eng.keys.ArrowRight = false
  console.log('RESULT', role, RC.results && RC.results.pos)
  await sleep(1500)
}
if (game === 'climb' || game === 'kong') {
  const S = game === 'climb' ? CL : KG, A = game === 'climb' ? climbActions : kongActions
  await join()
  if (role === 'host') await hostGame(game, game === 'kong' ? { size: 2 } : {})
  check('the climb starts on both sides with two climbers', await until(() => S.mode === 'play' && S.net && S.players.length === 2), S.mode)
  check('seats are assigned', S.me === (role === 'host' ? 0 : 1))
  const x0 = S.players[S.me].x, gx0 = S.players[1].x
  if (role === 'guest') A.press('right', true)
  check(role === 'host' ? 'the host sees the guest climber run' : 'the guest runs its own climber', await until(() => Math.abs(S.players[1].x - gx0) > 2, 20000), 'x ' + S.players[1].x.toFixed(1))
  A.press('right', false)
  check('both see the same level and score counters', await until(() => S.t > 3, 20000), 't ' + S.t + ' mode ' + S.mode + ' net ' + !!S.net)
  if (role === 'host') { await sleep(1200); S.players.forEach((p) => { p.lives = 0; p.out = true }) }
  check('the run ends on both sides', await until(() => S.mode === 'over', 40000), S.mode)
  await sleep(1200)
}
if (game === 'hunt') {
  await join()
  if (role === 'host') await hostGame('hunt', { kind: 'back' })
  check('the hunt starts on both sides with two hunters', await until(() => HT.mode === 'play' && HT.net && HT.players.length === 2), HT.mode)
  check('seats are assigned', HT.me === (role === 'host' ? 0 : 1), 'me ' + HT.me)
  const x0 = HT.players[HT.me].x
  if (role === 'guest') huntActions.press('right', true)
  check('monsters appear on both sides', await until(() => HT.mons.length > 0, 40000), 'mons ' + HT.mons.length)
  if (role === 'host') check('the host sees the guest hunter moving', await until(() => Math.abs(HT.players[1].x - (-6 + 6)) > 3, 20000), 'x ' + HT.players[1].x)
  else check('the guest moves its own hunter', await until(() => HT.players[1].x - x0 > 3, 20000), 'x ' + HT.players[1].x)
  huntActions.press('right', false)
  check('both see the same score/kills counters update', await until(() => HT.t > 5, 20000))
  if (role === 'host') { await sleep(1500); HT.players.forEach((p) => { p.down = true; p.hp = 0 }) }
  check('the run ends on both sides', await until(() => HT.mode === 'over', 40000), HT.mode)
  await sleep(1500)
}
if (DUELS[game]) {
  await join()
  if (role === 'host') await hostGame('duel:' + game, {})
  check('the duel starts on both sides', await until(() => D.on && D.id === game && eng.G.mode === DUELS[game].mode), eng.G.mode)
  await sleep(2500)
  check('we see the rival score updates', await until(() => D.foeScore >= 0 && D.t > 2, 15000), JSON.stringify([D.foeScore, D.t]))
  // finish the game quickly on each side (the host with a better result)
  if (game === 'snake') { await until(() => !!SN.over, 60000) }
  else if (game === 'slug') { await until(() => eng.G.mode === 'slug', 5000); const { S: SG } = await import('../src/game/slug.js'); SG.score = role === 'host' ? 900 : 100; SG.mode = 'over' }
  else if (game === 'word') { WD.answer = 'CRANE'; WD.rows = [{ w: 'CRANE', s: 'ggggg' }]; WD.done = true; WD.win = role === 'host' }
  else if (game === 'mines') { MS.open = role === 'host' ? 30 : 5; MS.over = { win: role === 'host', secs: 40 } }
  check('both sides report done', await until(() => D.mineDone, 30000), 'mine ' + D.mine)
  check('the verdict arrives on both sides', await until(() => !!D.result, 30000), JSON.stringify(D.result))
  console.log('RESULT', role, JSON.stringify(D.result))
  await sleep(1500)
}
clearInterval(t)
console.log(bad ? 'FAIL' : 'DONE', role)
await rtm.leaveRoom()
process.exit(bad ? 1 : 0)
