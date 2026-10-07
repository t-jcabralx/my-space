import { update, G, keys } from '../src/game/engine.js'
import { OB, orbActions, LEVELS } from '../src/game/orb.js'
let failures = 0
const check = (n, c, i) => { if (!c) failures++; console.log(c ? 'PASS' : 'FAIL', n, i || '') }
const sane = () => OB.balls.every((b, i) => Number.isFinite(b.s) && (i === 0 || b.s - OB.balls[i - 1].s >= 2.6 - 0.05)) && OB.balls.every((b) => b.c >= 0 && b.c < 6)
const api = { put3: (...a) => { if (a.slice(0, 10).some((v) => !Number.isFinite(v))) throw new Error('NaN put3 ' + a) }, putS: (...a) => { if (a.slice(0, 9).some((v) => !Number.isFinite(v))) throw new Error('NaN putS ' + a) }, putM: (...a) => { if (a.slice(0, 6).some((v) => !Number.isFinite(v))) throw new Error('NaN putM') } }
import { games, } from '../src/game/engine.js'
import { posAt } from '../src/game/orb.js'
// a bot that aims at the chain orb closest to the hole whose colour matches the loaded orb
function botAim() {
  let best = null
  for (let i = OB.balls.length - 1; i >= 0; i--) {
    const b = OB.balls[i]
    if (b.s < 26) continue
    if (b.c === OB.cur) { best = b; break }
  }
  if (!best) { const vis = OB.balls.filter((b) => b.s > 26); best = vis[vis.length - 1] }
  if (!best) return
  const p = posAt(best.s)
  OB.aim = Math.atan2(p.y, p.x)
}
for (const li of [0, 1, 2]) {
  orbActions.start({ level: li, seed: 5 + li })
  let f = 0, bad = false, maxCombo = 0, lost = 0
  const lives0 = OB.lives
  while (OB.mode === 'play' && OB.lvl === li && f < 60 * 400) {
    if (f % 6 === 0) { botAim(); if (f % 12 === 0) orbActions.fire() }
    update(1 / 60); G.time += 1 / 60; f++
    if (f % 30 === 0) { if (!sane()) { bad = true; console.log('insane', OB.balls.slice(0, 5).map((b) => b.s)); break } games.orb.draw3(api) }
    maxCombo = Math.max(maxCombo, OB.combo)
  }
  check(`level ${li + 1}: stays consistent and draws cleanly`, !bad)
  check(`level ${li + 1}: the bot makes matches and progresses`, OB.matches >= 8 && OB.score > 200, `matches ${OB.matches} score ${OB.score} lives ${OB.lives} lvl ${OB.lvl + 1} time ${(f / 60) | 0}s`)
  void maxCombo; void lost; void lives0
}
// shooting mechanics
{
  orbActions.start({ level: 0, seed: 9 })
  for (let i = 0; i < 60 * 4; i++) { update(1 / 60); G.time += 1 / 60 }
  const n0 = OB.balls.length
  const target = OB.balls.filter((b) => b.s > 26)[1]
  check('the chain has entered the board', n0 >= 8 && !!target, 'balls ' + n0)
  const p = posAt(target.s); OB.aim = Math.atan2(p.y, p.x); OB.cur = (target.c + 1) % 6
  const sc = OB.balls.length
  orbActions.fire(); for (let i = 0; i < 90; i++) { update(1 / 60); G.time += 1 / 60 }
  check('a shot orb joins the chain', OB.balls.length >= sc, `before ${sc} after ${OB.balls.length}`)
  // three in a row pop
  const base = OB.balls.length
  OB.balls = []; OB.toSpawn = 5; OB.spawned = 20
  for (let i = 0; i < 6; i++) OB.balls.push({ s: 40 + i * 2.6, c: i < 2 ? 1 : 2, pw: null })
  OB.balls.push({ s: 40 + 6 * 2.6, c: 2, pw: null }) ; void base
  OB.cur = 1; OB.shot = null; OB.cool = 0
  const q = posAt(OB.balls[1].s); OB.aim = Math.atan2(q.y, q.x); orbActions.fire()
  for (let i = 0; i < 60; i++) { update(1 / 60); G.time += 1 / 60 }
  check('three of a colour pop and score', OB.matches >= 1 && OB.score > 0, `matches ${OB.matches} score ${OB.score} balls ${OB.balls.length}`)
}
// losing: a chain that reaches the hole costs a life and ends the game at zero
{
  orbActions.start({ level: 0, seed: 1 })
  OB.lives = 1
  OB.balls = [{ s: OB.path.len - 3, c: 0, pw: null }]
  for (let i = 0; i < 60 * 8 && OB.mode === 'play'; i++) { update(1 / 60); G.time += 1 / 60 }
  check('the hole ends the game when out of lives', OB.mode === 'over' && OB.over && !OB.over.win)
}
// versus: junk orbs come from a rival and a clear ends the match
{
  const sent = []
  orbActions.start({ level: 0, seed: 2, kind: 'versus' })
  OB.net = { send: (d) => sent.push(d) }
  OB.balls = [{ s: 40, c: 1, pw: null }, { s: 42.6, c: 1, pw: null }, { s: 45.2, c: 3, pw: null }]; OB.toSpawn = 0; OB.spawned = 20; OB.cur = 1; OB.cool = 0
  const q = posAt(45.2); OB.aim = Math.atan2(q.y, q.x)
  OB.balls[2].c = 1; OB.cur = 1
  const p3 = posAt(OB.balls[2].s); OB.aim = Math.atan2(p3.y, p3.x)
  orbActions.fire(); for (let i = 0; i < 40; i++) { update(1 / 60); G.time += 1 / 60 }
  check('versus: clearing the board sends a "clear" and wins', sent.some((d) => d.k === 'clear') && OB.mode === 'over' && OB.over.win, JSON.stringify(sent.map((d) => d.k)))
}
orbActions.stop()
process.exit(failures ? 1 : 0)
