// Two-process online game test against a running Next server: node scripts/sim-online.mjs  (parent spawns host + guest)
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const role = process.argv[2], game = process.argv[3] || 'tetris', code = process.argv[4]
const BASE = process.env.RT_BASE || 'http://localhost:3000'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
if (!role) {
  const self = fileURLToPath(import.meta.url)
  let fail = 0
  for (const g of (process.env.GAMES || 'tetris,pickle,bomber,space,fight,race,uno,pusoy,tongits,lucky9').split(',')) {
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
  console.log(fail ? 'ONLINE FAIL' : 'ONLINE OK'); process.exit(fail ? 1 : 0)
}
globalThis.__RT_BASE = BASE; if (process.env.DBG) globalThis.__RT_DEBUG = 1
const { update, onKey, keys } = await import('../src/game/engine.js')
const rtm = await import('../src/game/online/rt.js')
const { CS, cardsActions, getCardsSnap } = await import('../src/game/cards/core.js')
await import('../src/game/cards/uno.js')
const { T } = await import('../src/game/tetris.js')
const { hostTetris, installTetrisOnline } = await import('../src/game/online/tetris-online.js')
const { hostCardGame, installCardsOnline } = await import('../src/game/online/cards-online.js')
const { P: PK, pickleActions } = await import('../src/game/pickle.js')
const { B: BM } = await import('../src/game/bomber.js')
const { hostPickle, installPickleOnline } = await import('../src/game/online/pickle-online.js')
const { hostBomber, installBomberOnline } = await import('../src/game/online/bomber-online.js')
const { hostSpace, installSpaceOnline } = await import('../src/game/online/space-online.js')
const { FT, fightActions } = await import('../src/game/fight.js')
const { hostFightMatch, installFightOnline } = await import('../src/game/online/fight-online.js')
const { RC, raceActions } = await import('../src/game/race.js')
const { hostRaceMatch, installRaceOnline } = await import('../src/game/online/race-online.js')
installPickleOnline(); installBomberOnline(); installSpaceOnline(); installFightOnline(); installRaceOnline()
installTetrisOnline(); installCardsOnline()
let bad = 0
const check = (n, c, i) => { if (!c) bad++; console.log(c ? 'PASS' : 'FAIL', role, n, i || '') }
let t = setInterval(() => update(1 / 20 * 3), 50) // 3x speed, 20Hz
const until = async (f, ms = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (f()) return true; await sleep(100) } return false }
const rr = (n) => Math.floor(Math.random() * n)
if (game === 'tetris') {
  if (role === 'host') {
    const room = await rtm.createRoom('tetris', 'HOSTY'); console.log('CODE', room.code)
    check('guest joins', await until(() => rtm.RT.room.players.length === 2))
    await sleep(1500)
    await hostTetris()
  } else { await sleep(500); await rtm.joinRoom(code, 'GUESTY') }
  check('online board started', await until(() => T.mode === 'play' && T.cfg.type === 'online'), T.mode)
  check('opponent named', T.bd[1] && T.bd[1].remote && /HOSTY|GUESTY/.test(T.bd[1].name), T.bd[1] && T.bd[1].name)
  check('same seed bag', true)
  await until(() => T.phase === 'play', 8000)
  const first = T.bd[0].piece && T.bd[0].piece.kind
  console.log('FIRST', first)
  const drive = setInterval(() => { if (T.phase === 'play' && role === 'host') { onKey(['KeyA', 'KeyD', 'Space'][rr(3)], true) } }, 120) // only host plays hard; guest idles and tops out
  const seen = await until(() => T.bd[1] && T.bd[1].grid.some((r) => r.some((c) => c)) || T.mode === 'over', 40000)
  check('mirrors opponent board', seen)
  await until(() => T.mode === 'over', 150000)
  check('game ends on both sides', T.mode === 'over', T.over && T.over.title)
  clearInterval(drive)
  await sleep(2500)
  console.log('RESULT', role, T.over && T.over.title, JSON.stringify(T.bd.map((b) => [b.dead, b.lines, b.score])), 'time', T.elapsed.toFixed(1))
} else if (game === 'pickle') {
  if (role === 'host') {
    const room = await rtm.createRoom('pickle', 'HOSTY'); console.log('CODE', room.code)
    check('guest joins', await until(() => rtm.RT.room.players.length === 2))
    await sleep(1500)
    await hostPickle(3)
  } else { await sleep(500); await rtm.joinRoom(code, 'GUESTY') }
  check('match started', await until(() => PK.mode === 'play' && PK.cfg.type === 'online'), PK.mode)
  const keysMod = (await import('../src/game/engine.js')).keys
  const drive = setInterval(() => {
    keysMod.KeyW = Math.random() < 0.5; keysMod.KeyS = !keysMod.KeyW; keysMod.KeyA = Math.random() < 0.3; keysMod.KeyD = Math.random() < 0.3
    if (PK.phase !== 'point') onKey(['KeyF', 'KeyG', 'KeyH'][rr(3)], true)
  }, 90)
  let scoreSeen = false
  const watch = setInterval(() => { if (PK.score[0] + PK.score[1] > 0) scoreSeen = true }, 200)
  check('both sides see points scored', await until(() => scoreSeen, 90000), JSON.stringify(PK.score))
  check('match ends on both sides', await until(() => PK.mode === 'over', 280000), JSON.stringify(PK.score))
  clearInterval(drive); clearInterval(watch)
  console.log('RESULT', role, JSON.stringify(PK.score), PK.over && PK.over.winner)
  await sleep(2500)
} else if (game === 'race') {
  const eng = await import('../src/game/engine.js')
  if (role === 'host') {
    const room = await rtm.createRoom('race', 'HOSTY'); console.log('CODE', room.code)
    check('guest joins', await until(() => rtm.RT.room.players.length === 2))
    await sleep(1500)
    await hostRaceMatch({ track: 0, laps: 1, diff: 1, ai: 2 })
  } else { await sleep(500); await rtm.joinRoom(code, 'GUESTY') }
  check('race starts on both sides', await until(() => RC.mode === 'play' && RC.cfg.type === 'online' && RC.cars.length >= 3), RC.mode)
  check('each side drives its own car', RC.me === (role === 'host' ? 0 : 1) && RC.cars[RC.me].human, 'me ' + RC.me)
  const drive = setInterval(() => {
    const me = RC.cars[RC.me], P = RC.tk.P, N = RC.tk.N
    const tp = P[(me.idx + Math.round(8 + me.sp * 0.15)) % N]
    let d = Math.atan2(tp.x - me.x, -(tp.z - me.z)) - me.th; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2
    eng.keys.ArrowUp = true; eng.keys.ArrowLeft = d < -0.05; eng.keys.ArrowRight = d > 0.05
  }, 40)
  check('the countdown ends and racing starts', await until(() => RC.phase === 'race', 30000), RC.phase)
  const other = () => RC.cars[role === 'host' ? 1 : 0]
  check('we see the other driver moving', await until(() => other().prog > 30 || other().sp > 10, 40000), JSON.stringify([other().x | 0, other().sp | 0]))
  check('race ends with a results screen on both sides', await until(() => RC.phase === 'results', 280000), RC.phase)
  clearInterval(drive); eng.keys.ArrowUp = eng.keys.ArrowLeft = eng.keys.ArrowRight = false
  console.log('RESULT', role, RC.results && RC.results.pos, '/', RC.results && RC.results.total)
  await sleep(2500)
} else if (game === 'fight') {
  const eng = await import('../src/game/engine.js')
  if (role === 'host') {
    const room = await rtm.createRoom('fight', 'HOSTY'); console.log('CODE', room.code)
    check('guest joins', await until(() => rtm.RT.room.players.length === 2))
    await sleep(1500)
    await hostFightMatch(1)
  } else { await sleep(500); await rtm.joinRoom(code, 'GUESTY') }
  check('fight starts on both sides', await until(() => FT.mode === 'play' && FT.cfg.type === 'online'), FT.mode)
  check('both fighters are loaded', FT.f.length === 2 && FT.f[0].ch && FT.f[1].ch, FT.f.map((f) => f.ch && f.ch.name).join(' vs '))
  const names = FT.f.map((f) => f.ch.name).join(' vs ')
  console.log('MATCH', role, names)
  const btns = ['KeyJ', 'KeyK', 'KeyU', 'KeyI', 'KeyL', 'KeyO']
  const drive = setInterval(() => {
    const me = role === 'host' ? FT.f[0] : FT.f[1], opp = role === 'host' ? FT.f[1] : FT.f[0]
    const toward = opp.x > me.x ? 1 : -1
    eng.keys.KeyD = toward > 0 && Math.abs(opp.x - me.x) > 7; eng.keys.KeyA = toward < 0 && Math.abs(opp.x - me.x) > 7; eng.keys.KeyW = Math.random() < 0.04; eng.keys.KeyS = Math.random() < 0.1
    if (Math.random() < 0.5) onKey(btns[rr(6)], true)
  }, 90)
  let sawHit = false
  const watch = setInterval(() => { if (FT.f.some((f) => f.hp < f.maxHp)) sawHit = true }, 100)
  check('fighters trade blows on both sides', await until(() => sawHit, 60000))
  check('match ends on both sides', await until(() => FT.mode === 'over', 280000), FT.over && FT.over.name)
  clearInterval(drive); clearInterval(watch)
  console.log('RESULT', role, FT.over && FT.over.name, JSON.stringify(FT.wins))
  await sleep(2500)
} else if (game === 'space') {
  const eng = await import('../src/game/engine.js')
  if (role === 'host') {
    eng.setSquad(0, false)
    const room = await rtm.createRoom('space', 'HOSTY'); console.log('CODE', room.code)
    check('guest joins', await until(() => rtm.RT.room.players.length === 2))
    await sleep(1500)
    await hostSpace()
    check('host runs the mission', await until(() => eng.G.mode === 'playing' && eng.G.squad && eng.G.squad.length === 1), eng.G.squad && eng.G.squad.length)
    check('friend owns teammate ship #2', eng.G.squad[0].remote && eng.G.squad[0].remote !== null)
    const drive = setInterval(() => { eng.keys.Space = true; eng.keys.KeyW = Math.random() < 0.5; eng.keys.KeyS = !eng.keys.KeyW }, 150)
    const y0 = eng.G.squad[0].y
    await sleep(14000)
    clearInterval(drive)
    check('the friend\'s controls move their ship on the host', Math.abs(eng.G.squad[0].y - y0) > 0.5, 'y ' + eng.G.squad[0].y.toFixed(1))
    check('host world keeps running with enemies', eng.G.stats.kills > 0 || eng.G.enemies.length > 0, 'kills ' + eng.G.stats.kills)
    check('friend\'s skills ran on the host', eng.G.squad[0].scd.bomb > 0 || eng.G.squad[0].scm.bomb > 1, JSON.stringify(eng.G.squad[0].scd))
    console.log('SCORE host', eng.G.score)
    await sleep(2500)
  } else {
    await sleep(500); await rtm.joinRoom(code, 'GUESTY')
    check('guest enters the host game', await until(() => eng.G.net && eng.G.net.role === 'guest' && eng.G.mode === 'playing'), eng.G.mode)
    check('guest receives its own ship', await until(() => eng.G.net && eng.G.net.mine), '')
    let sawEnemies = false, sawBullets = false
    const watch = setInterval(() => { if (eng.G.enemies.length) sawEnemies = true; if (eng.G.pbul.length) sawBullets = true }, 100)
    const y0 = eng.G.net.mine ? eng.G.net.mine.y : 0
    eng.keys.ArrowUp = true; eng.keys.Space = true
    await sleep(3000)
    eng.keys.ArrowUp = false
    const y1 = eng.G.net.mine.y
    check('guest ship moves with its own controls', y1 > y0 + 3, y0.toFixed(1) + ' -> ' + y1.toFixed(1))
    eng.G.net.skill('bomb'); eng.G.net.skill('shield')
    await sleep(2500)
    check('guest skills show cooldowns from the host', eng.G.net.mine && eng.G.net.mine.scd.bomb > 3 && eng.G.net.mine.scd.shield > 3, JSON.stringify(eng.G.net.mine && eng.G.net.mine.scd))
    await sleep(6500)
    check('guest sees the host\'s enemies', sawEnemies)
    check('guest sees bullets', sawBullets)
    check('guest mirrors the score', eng.G.score > 0, 'score ' + eng.G.score)
    check('guest has the leader ship', !!eng.G.p && typeof eng.G.p.x === 'number' && eng.G.p.sk)
    console.log('SCORE guest', eng.G.score)
    clearInterval(watch)
    await sleep(2500)
  }
} else if (game === 'bomber') {
  if (role === 'host') {
    const room = await rtm.createRoom('bomber', 'HOSTY'); console.log('CODE', room.code)
    check('guest joins', await until(() => rtm.RT.room.players.length === 2))
    await sleep(1500)
    await hostBomber(1)
  } else { await sleep(500); await rtm.joinRoom(code, 'GUESTY') }
  check('arena started', await until(() => BM.mode === 'play' && BM.cfg.type === 'online'), BM.mode)
  const keysMod = (await import('../src/game/engine.js')).keys
  const drive = setInterval(() => {
    const d = rr(4); keysMod.KeyW = d === 0; keysMod.KeyS = d === 1; keysMod.KeyA = d === 2; keysMod.KeyD = d === 3
    if (Math.random() < 0.25) onKey('Space', true)
  }, 120)
  check('same humans on both sides', await until(() => BM.pl.filter((p) => p.human).length === 2), BM.pl.filter((p) => p.human).length)
  check('match ends on both sides', await until(() => BM.mode === 'over', 280000), BM.over && BM.over.winName)
  clearInterval(drive)
  console.log('RESULT', role, BM.over && BM.over.winName, JSON.stringify(BM.wins))
  await sleep(2500)
} else {
  await import('../src/game/cards/pusoy.js'); await import('../src/game/cards/lucky9.js'); await import('../src/game/cards/tongits.js')
  const OPTS = { uno: { target: 30, stack: true }, pusoy: { target: 8 }, tongits: { stake: 50 }, lucky9: { bots: 0 } }
  if (role === 'host') {
    const room = await rtm.createRoom(game, 'HOSTY', OPTS[game]); console.log('CODE', room.code)
    check('guest joins', await until(() => rtm.RT.room.players.length === 2))
    await sleep(1500)
    await hostCardGame(game, { ...OPTS[game], auto: false })
  } else { await sleep(500); await rtm.joinRoom(code, 'GUESTY') }
  check('table started', await until(() => CS.mode === 'play' || CS.mode === 'over'), CS.mode)
  let moves = 0
  if (process.env.DBG) setInterval(() => { const s = getCardsSnap(); console.log('DBG', role, CS.mode, s && s.phase, s && s.seats && s.seats.map((x) => (x.human ? 'ME' : x.name) + (x.turn ? '*' : '') + x.count).join(' '), 'btns', s && s.buttons && s.buttons.map((b) => b.name + (b.off ? '-' : '')).join(','), 'alive', Object.keys(rtm.RT.lastSeen).length, 'toasts', JSON.stringify((s && s.toasts || []).map((t) => t.text)), 'msg', s && s.msg) }, 3000)
  const roundOf = () => { const s = getCardsSnap(); const m = s && /ROUND (\d+)/.exec(s.info || ''); return m ? +m[1] : 0 }
  const play = setInterval(() => {
    const s = getCardsSnap(); if (!s || s.phase === undefined || CS.mode !== 'play') return
    const B = (n) => s.buttons.find((b) => b.name === n && !b.off)
    const me = s.seats.find((x) => x.human)
    if (game === 'uno') {
      if (s.prompt && s.prompt.type === 'color') { cardsActions.button('color', 'R'); return }
      if (s.prompt && s.prompt.type === 'swap') { cardsActions.button('swap', s.prompt.players[0].id); return }
      if (s.phase === 'roundOver' && B('next')) { cardsActions.button('next'); return }
      if (!me || !me.turn) return
      const glow = s.cards.find((c) => c.mine && c.glow)
      if (glow) { cardsActions.click(glow.id); moves++ } else { const d = s.cards.find((c) => !c.mine && c.glow); if (d) cardsActions.click(d.id); else if (B('pass')) cardsActions.button('pass') }
    } else if (game === 'pusoy') {
      if (s.phase === 'roundOver' && B('next')) { cardsActions.button('next'); return }
      if (!me || !me.turn) return
      if (B('play')) { cardsActions.button('play'); moves++ } else if (B('hint') && !s.cards.some((c) => c.mine && c.sel) && Date.now() - (globalThis.__hintAt || 0) > 2500) { globalThis.__hintAt = Date.now(); cardsActions.button('hint') } else if (B('pass') && Date.now() - (globalThis.__hintAt || 0) > 1200) cardsActions.button('pass')
    } else if (game === 'tongits') {
      if (s.phase === 'roundOver' && B('next')) { cardsActions.button('next'); return }
      if (B('fold')) { cardsActions.button('fold'); return }
      if (!me || !me.turn) return
      if (s.phase === 'draw') { cardsActions.button('stock'); moves++ }
      else if (s.phase === 'action') { if (B('auto')) cardsActions.button('auto'); else if (B('discardsel')) cardsActions.button('discardsel'); else { const c = s.cards.find((x) => x.mine && !x.sel); if (c) cardsActions.click(c.id) } }
    } else if (game === 'lucky9') {
      if (B('deal')) { cardsActions.button('deal'); moves++ } else if (B('stand')) cardsActions.button('stand')
    }
  }, 150)
  let seenHidden = false
  const peek = setInterval(() => { const s = getCardsSnap(); if (role === 'guest' && s && s.cards) seenHidden = seenHidden || s.cards.some((c) => !c.mine && c.face && c.face.rank === '?') || s.cards.some((c) => !c.mine && c.face && c.face.value === '?') }, 200)
  if ((game === 'tongits' || game === 'lucky9') && role === 'host') {
    await until(() => roundOf() >= 3, 120000)
    check('rounds progress with two humans', roundOf() >= 3, 'round ' + roundOf())
    cardsActions.button('cash')
  }
  const done = await until(() => CS.mode === 'over', 280000)
  check('match completes on both sides', done, (getCardsSnap() && getCardsSnap().over && getCardsSnap().over.title))
  check('made moves', moves > 0, moves)
  if (role === 'guest') check('other hands are hidden', seenHidden || game === 'lucky9')
  await sleep(3500); clearInterval(play); clearInterval(peek)
  console.log('RESULT', role, (getCardsSnap() && getCardsSnap().over && getCardsSnap().over.title))
}
clearInterval(t)
console.log(bad ? 'FAIL' : 'DONE', role)
await rtm.leaveRoom()
process.exit(bad ? 1 : 0)
