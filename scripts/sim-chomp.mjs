import { update, keys } from '../src/game/engine.js'
import { C, chompActions } from '../src/game/chomp.js'
let failures = 0
const check = (name, cond, info) => { if (!cond) failures++; console.log(cond ? 'PASS' : 'FAIL', name, info || '') }
// 1. every generated maze is fully connected (genMaze throws otherwise)
for (let lvl = 1; lvl <= 12; lvl++) { try { chompActions.start('auto', lvl); check('maze L' + lvl, C.dotsTotal > 150, 'dots ' + C.dotsTotal) } catch (e) { check('maze L' + lvl, false, e.message) } }
// 2. auto bot plays several levels
chompActions.start('auto', 1)
let frames = 0, startLvl = C.level
for (let i = 0; i < 60 * 60 * 14 && C.mode !== 'over'; i++) { update(1 / 60); frames++ }
check('auto bot progress', C.score > 1000, `mode ${C.mode} level ${C.level} score ${C.score} dots ${C.stats.dots} ghosts ${C.stats.ghosts} fruits ${C.stats.fruits} lives ${C.lives} secs ${(frames / 60) | 0}`)
// 3. classic with random human input must not crash and eventually ends
chompActions.start('classic', 1)
const dirs = ['KeyW', 'KeyA', 'KeyS', 'KeyD']
for (let i = 0; i < 60 * 600 && C.mode !== 'over'; i++) { if (i % 20 === 0) { const d = dirs[(Math.random() * 4) | 0]; dirs.forEach((k) => (keys[k] = k === d)) } update(1 / 60) }
check('classic ends', C.mode === 'over', `score ${C.score} dots ${C.stats.dots}`)
// 4. co-op and ghost modes
for (const type of ['coop', 'ghost']) {
  chompActions.start(type, 1)
  for (let i = 0; i < 60 * 300 && C.mode !== 'over'; i++) { if (i % 25 === 0) { const d = dirs[(Math.random() * 4) | 0]; dirs.forEach((k) => (keys[k] = k === d)); const a = ['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'][(Math.random() * 4) | 0]; ['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'].forEach((k) => (keys[k] = k === a)) } update(1 / 60) }
  check(type + ' runs', true, `mode ${C.mode} score ${C.score} title ${C.over && C.over.title}`)
}
process.exit(failures ? 1 : 0)
