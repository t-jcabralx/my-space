import { update } from '../src/game/engine.js'
import { FL, flamesActions, computeFlames, OUTCOMES } from '../src/game/flames.js'
import { games, G } from '../src/game/engine.js'
let failures = 0
const check = (n, c, i) => { if (!c) failures++; console.log(c ? 'PASS' : 'FAIL', n, i || '') }
// pure logic
const j = computeFlames('John', 'Jane')
check('JOHN+JANE: shared letters J and N crossed', j.pairs.length === 2 && j.remaining === 4, JSON.stringify(j.pairs))
check('JOHN+JANE => Enemies (worked by hand)', j.result === 'E', j.result)
const same = computeFlames('Ana', 'ana')
check('identical names => nothing left => Soulmates (S)', same.remaining === 0 && same.result === 'S')
const dup = computeFlames('Mama', 'Ma')
check('repeated letters match once each', dup.pairs.length === 2 && dup.remaining === 2, JSON.stringify(dup.pairs))
check('non-letters ignored', computeFlames('A-b c', 'abc').remaining === 0)
// every outcome is reachable and every step list ends with one letter
const seen = new Set()
const names = ['Maria', 'Jose', 'Pedro', 'Liza', 'Ken', 'Anna', 'Bea', 'Carlo', 'Dennis', 'Ella', 'Fe', 'Gino', 'Hanna', 'Ian', 'Jun', 'Kim', 'Lea', 'Mark', 'Nina', 'Oscar', 'Paolo', 'Rica', 'Sam', 'Tina']
for (const a of names) for (const b of names) { const c = computeFlames(a, b); seen.add(c.result); if (c.remaining > 0 && c.steps.length !== 5) check('five eliminations for ' + a + b, false) }
check('all six outcomes reachable', [...seen].sort().join('') === 'AEFLMS', [...seen].sort().join(''))
// animation run + draw each scene without errors
const calls = { n: 0 }
const api = { put: () => { calls.n++ }, text: () => [], sprite: () => {}, pops: () => {} }
for (const ch of Object.keys(OUTCOMES)) {
  let pair = null
  outer: for (const a of names) for (const b of names) if (computeFlames(a, b).result === ch) { pair = [a, b]; break outer }
  flamesActions.start()
  check('start enters input phase', FL.phase === 'input')
  check('reveal accepted ' + ch, flamesActions.reveal(...pair))
  let t = 0
  for (; t < 90 && FL.phase !== 'result'; t += 1 / 30) update(1 / 30)
  check(`${ch}: ${pair.join('+')} reaches result ${OUTCOMES[ch].word}`, FL.phase === 'result' && FL.result === ch, 'took ' + t.toFixed(1) + 's')
  let threw = null
  try { for (let k = 0; k < 600; k++) { update(1 / 30); G.time += 1 / 30; games.flames.draw(api) } } catch (e) { threw = e }
  check(`${ch}: scene animates 20s without errors`, !threw && calls.n > 0, threw && threw.message)
}
flamesActions.start(); check('empty names rejected', flamesActions.reveal('', 'x') === false)
process.exit(failures ? 1 : 0)
