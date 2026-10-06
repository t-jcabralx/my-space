import { update } from '../src/game/engine.js'
import { P, pickleActions } from '../src/game/pickle.js'
let failures = 0
const check = (n, c, i) => { if (!c) failures++; console.log(c ? 'PASS' : 'FAIL', n, i || '') }
function play(type, scoring) {
  pickleActions.start(type, 1, 15, { scoring })
  let rallies = 0, last = P.phase
  for (let i = 0; i < 60 * 300 && P.mode === 'play' && rallies < 30; i++) {
    update(1 / 60)
    if (P.phase === 'point' && last !== 'point') rallies++
    last = P.phase
  }
  return { rallies, total: P.score[0] + P.score[1], over: P.mode === 'over' }
}
for (const type of ['demo', 'duo']) {
  const r = play(type, 'rally')
  check(`${type}: rally scoring: every rally gives a point`, r.total === r.rallies && r.rallies >= 3, JSON.stringify(r))
  const c = play(type, 'side')
  check(`${type}: classic: only the server scores (some rallies give no point)`, c.total < c.rallies && c.total > 0, JSON.stringify(c))
}
const d = play('demo', 'rally')
check('the default (no option) is rally scoring', (() => { pickleActions.start('demo', 1, 11); return P.cfg.scoring === 'rally' })())
void d
process.exit(failures ? 1 : 0)
