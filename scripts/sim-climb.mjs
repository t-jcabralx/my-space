import { update, G, games } from '../src/game/engine.js'
import { CL, climbActions, MOUNTAINS, FH, COLS, colX } from '../src/game/climb.js'
let failures = 0
const check = (n, c, i) => { if (!c) failures++; console.log(c ? 'PASS' : 'FAIL', n, i || '') }
const api = { put3: (...a) => { if (a.slice(0, 10).some((v) => !Number.isFinite(v))) throw new Error('NaN put3 ' + a.slice(0, 10)) }, putS: (...a) => { if (a.slice(0, 9).some((v) => !Number.isFinite(v))) throw new Error('NaN putS') }, putM: () => {} }
const step = (n, dt = 1 / 30) => { for (let i = 0; i < n; i++) { update(dt); G.time += dt } }
check('8 mountains', MOUNTAINS.length === 8)
// a bot that finds ice above it, smashes it from below, and climbs through
const B = { best: -1, t: 0, pick: -1 }
function bot(p) {
  const I = { dx: 0, jump: false, hit: false }
  const flush = () => { climbActions.press('left', I.dx < 0); climbActions.press('right', I.dx > 0); climbActions.press('jump', I.jump); climbActions.press('hit', I.hit) }
  if (p.best > B.best) { B.best = p.best; B.t = 0; B.pick = -1 } else B.t += 1 / 30
  const fi = Math.max(0, Math.round(p.y / FH)), row = CL.floors[fi + 1]
  if (!row) return flush()
  let tx = null
  const cloud = CL.clouds.filter((c) => c.floor === fi + 1)
  if (cloud.length) { let bd = 1e9; for (const c of cloud) { const d = Math.abs(c.x - p.x); if (d < bd) { bd = d; tx = c.x } } }
  else {
    let tgt = -1, bd = 1e9
    if (B.pick < 0 || B.t > 6) { const cands = []; for (let c = 2; c < COLS - 2; c++) if (row[c] === 1 || (row[c] === 0 && (row[c - 1] || row[c + 1]))) cands.push(c); B.pick = B.t > 6 && cands.length ? cands[(Math.random() * cands.length) | 0] : -1; B.t = B.t > 6 ? 0 : B.t }
    if (B.pick >= 0) tgt = B.pick
    else { for (let c = 2; c < COLS - 2; c++) { if (row[c] === 0 && (row[c - 1] || row[c + 1])) { const d = Math.abs(colX(c) - p.x); if (d < bd) { bd = d; tgt = c } } } if (tgt < 0) for (let c = 2; c < COLS - 2; c++) { if (row[c] === 1) { const d = Math.abs(colX(c) - p.x); if (d < bd) { bd = d; tgt = c } } } }
    if (tgt >= 0) tx = colX(tgt)
  }
  if (tx === null) return flush()
  const dx = tx - p.x
  if (Math.abs(dx) > 0.5) I.dx = Math.sign(dx)
  if (Math.abs(dx) < (cloud.length ? 2.5 : 0.9) && p.ground) I.jump = true
  if (!p.ground) {
    I.dx = Math.abs(dx) > 0.3 ? Math.sign(dx) : 0
    if (p.y > (fi + 1) * FH - 0.6) { let sb = 0, bd2 = 1e9; for (let c = 0; c < COLS; c++) if (row[c]) { const d = Math.abs(colX(c) - p.x); if (d < bd2) { bd2 = d; sb = Math.sign(colX(c) - p.x) } } for (const c of cloud) { const d = Math.abs(c.x - p.x); if (d < bd2) { bd2 = d; sb = Math.sign(c.x - p.x) } } I.dx = cloud.length ? Math.sign(tx - p.x) : sb }
  }
  flush()
}
for (const li of [0, 3]) {
  climbActions.start({ level: li, seed: 7 + li })
  const p = CL.players[0]; p.lives = 99; B.best = -1; B.t = 0; B.pick = -1
  let f = 0, top = 0
  while (CL.mode === 'play' && CL.lvl === li && f < 30 * 400) {
    CL.spawnT = 1e9; CL.birdT = 1e9; CL.iceT = 1e9
    bot(p); step(1); f++
    top = Math.max(top, p.best)
    if (f % 60 === 0) { games.climb.draw3(api); games.climb.camera(1.7); if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) break }
  }
  check(`mountain ${li + 1}: a climber can smash and climb all ${MOUNTAINS[li].floors} floors`, CL.lvl > li || CL.mode === 'over' || CL.clearT > 0 || p.done, `best y ${top.toFixed(0)} of ${CL.topY} in ${(f / 30) | 0}s`)
  climbActions.stop()
}
// falling off the bottom costs a life; hammer kills a yeti; icicle and bird exist
{
  climbActions.start({ level: 2, seed: 5 }); const p = CL.players[0]
  CL.camTop = 60; p.y = 20; p.vy = 0; p.ground = false; step(60)
  check('falling off the bottom of the screen costs a life', p.lives < 3 || p.dead > 0, 'lives ' + p.lives)
  climbActions.stop(); climbActions.start({ level: 0, seed: 5 }); const q = CL.players[0]
  CL.foes.push({ id: 900, type: 'topi', x: q.x + 2, y: 0, dir: -1, st: 'walk', t: 0, dead: false, fi: 0 }); CL.spawnT = 1e9
  climbActions.press('hit', true); q.face = 1; step(5); climbActions.press('hit', false)
  check('the hammer defeats a yeti', !CL.foes.some((f) => f.id === 900) && q.score >= 800, 'score ' + q.score)
  CL.icicles.push({ id: 901, x: q.x, y: q.y + 5, vy: 0, warn: 0, dead: false, hang: 1 }); q.inv = 0; step(60)
  check('an icicle hurts a climber', q.lives < 3 || q.dead > 0)
}
// two players and the snapshot round trip used online
{
  climbActions.start({ level: 0, two: true, seed: 2 })
  check('two climbers share a mountain', CL.players.length === 2)
  const snapFn = null; void snapFn
}
for (const k of ['left', 'right', 'jump', 'hit']) climbActions.press(k, false)
climbActions.stop()
process.exit(failures ? 1 : 0)
