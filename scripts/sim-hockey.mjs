import { update, keys } from '../src/game/engine.js'
import { HK, hockeyActions } from '../src/game/hockey.js'
let fail = 0
const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m) } }
for (const diff of [1, 2, 3]) {
  hockeyActions.start({ type: 'bot', diff, target: 5, chaos: true })
  let f = 0
  while (HK.mode !== 'over' && f < 60 * 400) {
    // a lazy human that chases the puck on its own half
    const p = HK.puck
    if (p) { HK.ptr = { x: Math.min(-3, Math.max(-36, p.x)), y: p.y, t: 1 } }
    update(1 / 60); f++
    ok(Number.isFinite(HK.puck.x) && Number.isFinite(HK.puck.y), 'puck NaN')
  }
  ok(HK.mode === 'over', 'match ends diff ' + diff)
  console.log('PASS hockey diff', diff, 'score', HK.score.join('-'), 'secs', (f / 60) | 0, 'best rally', HK.best)
  hockeyActions.stop()
}
// 2P keyboard
hockeyActions.start({ type: '2p', diff: 2, target: 3, chaos: false })
for (let i = 0; i < 60 * 30; i++) { keys.KeyD = i % 100 < 50; keys.ArrowLeft = i % 80 < 40; update(1 / 60) }
ok(HK.m[0].x > -40 && HK.m[1].x < 40, '2p mallets in bounds')
console.log('PASS hockey 2p')
keys.KeyD = keys.ArrowLeft = false
process.exit(fail ? 1 : 0)
