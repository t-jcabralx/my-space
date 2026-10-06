import { update } from '../src/game/engine.js'
import { PL, poolActions } from '../src/game/pool.js'
let fail = 0
const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m) } }
for (const diff of [1, 2, 3]) {
  poolActions.start({ type: 'bot', diff })
  let f = 0, shots = 0, last = ''
  while (PL.mode !== 'over' && f < 60 * 900) {
    // the human fires random-ish shots; places the cue ball when needed
    if (PL.turn === 0) {
      if (PL.phase === 'place') poolActions.pointer('up', -20 + Math.random() * 10, (Math.random() - 0.5) * 20)
      else if (PL.phase === 'aim') { const c = PL.balls[0]; const t = PL.balls.filter((b) => !b.in && b.n)[0]; PL.aim.a = Math.atan2(t.y - c.y, t.x - c.x) + (Math.random() - 0.5) * 0.1; poolActions.fireNow(0.4 + Math.random() * 0.5); shots++ }
    }
    update(1 / 60); f++
    for (const b of PL.balls) ok(Number.isFinite(b.x) && Number.isFinite(b.y), 'ball NaN')
    last = PL.phase
  }
  ok(PL.mode === 'over', 'game ends diff ' + diff + ' phase ' + last)
  console.log('PASS pool diff', diff, 'winner', PL.over && PL.over.winner, 'why', PL.over && PL.over.why, 'shots', shots, 'secs', (f / 60) | 0)
  poolActions.stop()
}
process.exit(fail ? 1 : 0)
