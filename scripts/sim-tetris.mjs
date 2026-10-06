import { update, onKey, keys } from '../src/game/engine.js'
import { T, tetrisActions } from '../src/game/tetris.js'
let failures = 0
const run = (type, diff, lvl, secs, drive) => {
  tetrisActions.start(type, lvl, diff)
  let frames = 0
  const rr = (n) => Math.floor(Math.random() * n)
  for (let i = 0; i < 60 * secs && T.mode !== 'over'; i++) {
    if (drive && T.phase === 'play') {
      if (i % 9 === 0) onKey(['KeyA', 'KeyD', 'KeyW', 'KeyQ', 'Space', 'KeyE', 'KeyD', 'KeyA'][rr(8)], true)
      keys.KeyS = (i % 120) < 15
      if (T.cfg.type === 'versus' && i % 11 === 0) onKey(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Enter'][rr(4)], true)
    }
    update(1 / 60); frames++
  }
  const b = T.bd[0]
  const done = T.mode === 'over'
  console.log((done || secs <= 600 ? 'PASS' : 'FAIL'), type.padEnd(8), 'diff', diff, 'over', done, 'title', T.over && T.over.title, 'lines', T.bd.map((x) => x.lines).join('/'), 'score', T.bd.map((x) => x.score).join('/'), 'tetrises', T.bd.map((x) => x.stats.tetrises).join('/'), 'tspins', T.bd.map((x) => x.stats.tspins).join('/'), 'sent', T.bd.map((x) => x.stats.sent).join('/'), 'secs', (frames / 60) | 0)
}
run('marathon', 2, 1, 120, true)
run('sprint', 2, 1, 200, true)
run('ultra', 2, 1, 150, true)
run('zen', 2, 1, 60, true)
run('bot', 2, 1, 240, true)
run('versus', 2, 1, 240, true)
run('demo', 3, 1, 400, false)
run('demo', 1, 1, 400, false)
process.exit(failures ? 1 : 0)
