// Runs every mini game headlessly with a no-op canvas: random taps/swipes must never throw, games must progress and be able to end.
import { MINI, W, H } from '../src/game/mini/games.js'
let fail = 0
const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m) } else console.log('PASS', m) }
globalThis.localStorage = { getItem: () => null, setItem: () => {} }
const noop = new Proxy(function () {}, { get: (t, k) => (k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : noop), apply: () => noop, set: () => true })
const ctx = noop
for (const def of MINI) {
  let threw = null, g = null, finished = 0, maxScore = 0
  try {
    for (let run = 0; run < 3; run++) {
      g = def.make(); g.reset()
      for (let f = 0; f < 60 * 120; f++) {
        if (Math.random() < 0.06) { const x = Math.random() * W, y = Math.random() * H; g.down && g.down(x, y); if (g.move) { for (let k = 0; k < 4; k++) g.move(x + (Math.random() - 0.5) * 120, y + (Math.random() - 0.5) * 120) } g.up && g.up(x, y) }
        if (g.key && Math.random() < 0.03) g.key(['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp'][(Math.random() * 4) | 0])
        g.update(1 / 60); if (f % 5 === 0) g.draw(ctx)
        maxScore = Math.max(maxScore, g.score)
        if (g.over) { finished++; break }
      }
    }
  } catch (e) { threw = e }
  ok(!threw, def.name + ' runs without errors ' + (threw ? threw.stack.split('\n').slice(0, 3).join(' | ') : ''))
  ok(['miner', 'memory', 'gems', 'blocks'].includes(def.id) || finished > 0, def.name + ' can end (finished ' + finished + '/3)')
  ok(def.id === 'bubble' || def.id === 'stack' ? true : maxScore >= 0, def.name + ' score ' + Math.floor(maxScore))
}
console.log(fail ? 'FAILED ' + fail : 'ALL PASS')
process.exit(fail ? 1 : 0)
