import { update } from '../src/game/engine.js'
import { TD, tdActions, TOWERS, MAPS, tdCell } from '../src/game/td.js'
let fail = 0
const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m) } }
for (let map = 0; map < MAPS.length; map++) {
  tdActions.start({ map, story: false })
  // place towers along free cells next to the path greedily as gold allows
  const free = []
  for (let i = 0; i < TD.cols; i++) for (let j = 0; j < TD.rows; j++) if (!TD.cells.has(i + ',' + j)) {
    // prefer cells adjacent to the path
    let near = 0; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]]) if (TD.cells.has((i + di) + ',' + (j + dj))) near++
    if (near) free.push([i, j, near])
  }
  free.sort((a, b) => b[2] - a[2])
  let f = 0, fi = 0
  while (TD.mode === 'play' && f < 60 * 1500) {
    if (!TD.spawn && TD.enemies.length === 0) tdActions.next()
    // build/upgrade whenever affordable
    for (let k = 0; k < 3; k++) {
      const ids = ['pulse', 'cannon', 'frost', 'sniper', 'tesla', 'bank']
      if (fi < free.length && TD.gold >= 80) { tdActions.setBuild(ids[fi % 5]); tdActions.pointer('down', ...tdCell(free[fi][0], free[fi][1])); fi++ }
      else if (TD.towers.length) { TD.sel = TD.towers[f % TD.towers.length]; tdActions.upgrade() }
    }
    update(1 / 20); f++
    if (f % 600 === 0 && TD.strike <= 0 && TD.mode === 'play') { TD.strikeArm = true; tdActions.pointer('down', 0, 0) }
  }
  for (const e of TD.enemies) ok(Number.isFinite(e.x) && Number.isFinite(e.y), 'enemy NaN')
  ok(TD.mode === 'over', 'td ends map ' + map)
  console.log('PASS td map', map, TD.over && (TD.over.win ? 'WIN' : 'LOSS'), 'wave', TD.wave, 'kills', TD.kills, 'lives', TD.lives, 'towers', TD.towers.length)
  tdActions.stop()
}
ok(TOWERS.length === 6, '6 towers')
process.exit(fail ? 1 : 0)
