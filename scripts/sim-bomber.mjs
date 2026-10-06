// Plays every Bomber Blast mode to completion; scripted humans walk, bomb and flee crudely.
import { update, onKey, keys } from '../src/game/engine.js'
import { B, bomberActions } from '../src/game/bomber.js'
let failures = 0
for (const [type, diff] of [['ffa', 2], ['duel', 3], ['local', 2], ['party', 1], ['team', 2], ['coop', 2], ['demo', 3]]) {
  bomberActions.start(type, diff, 3)
  let frames = 0, bombsPlaced = 0, maxBombs = 0, deaths = 0, chain = 0, items = 0
  const rr = (n) => Math.floor(Math.random() * n)
  for (let i = 0; i < 60 * 60 * 25 && B.mode !== 'over'; i++) {
    for (const h of B.pl.filter((p) => p.human)) {
      const k = h.human === 1 ? ['KeyW', 'KeyS', 'KeyA', 'KeyD'] : ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']
      if (i % 40 === 0) { const d = rr(4); k.forEach((c, j) => (keys[c] = j === d)) }
      if (i % 70 === 0) { onKey(h.human === 1 ? 'Space' : 'Enter', true); bombsPlaced++ }
    }
    update(1 / 60); frames++
    maxBombs = Math.max(maxBombs, B.bombs.length); items = Math.max(items, B.items.length)
  }
  const ok = B.mode === 'over'
  if (!ok) failures++
  console.log(ok ? 'PASS' : 'FAIL', type.padEnd(6), 'diff', diff, 'rounds won', B.wins.slice(0, B.pl.length).join('-'), 'kills', B.kills.join(','), 'bricks', B.bricks, 'secs', (frames / 60) | 0, 'maxBombsAtOnce', maxBombs, 'maxItems', items, 'winner', B.over && B.over.winName)
}
process.exit(failures ? 1 : 0)
