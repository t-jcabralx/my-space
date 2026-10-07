import { update, G, games } from '../src/game/engine.js'
import { KG, kongActions, LEVELS, SIZES, surf } from '../src/game/kong.js'
let failures = 0
const check = (n, c, i) => { if (!c) failures++; console.log(c ? 'PASS' : 'FAIL', n, i || '') }
const api = { put3: (...a) => { if (a.slice(0, 10).some((v) => !Number.isFinite(v))) throw new Error('NaN put3 ' + a.slice(0, 10)) }, putS: (...a) => { if (a.slice(0, 9).some((v) => !Number.isFinite(v))) throw new Error('NaN putS') }, putM: () => {} }
const step = (n, dt = 1 / 30) => { for (let i = 0; i < n; i++) { update(dt); G.time += dt } }
check('8 sites and sizes up to x20', LEVELS.length === 8 && SIZES.includes(20))
// the bot: run to a ladder that goes up from this floor, climb, repeat; on the top floor run to the captive
function bot(p) {
  const I = { dx: 0, dy: 0, jump: false, hit: false }
  const flush = () => { kongActions.press('left', I.dx < 0); kongActions.press('right', I.dx > 0); kongActions.press('up', I.dy > 0); kongActions.press('down', I.dy < 0); kongActions.press('jump', I.jump); kongActions.press('hit', I.hit) }
  if (p.ladder) { I.dy = 1; return flush() }
  const lads = KG.ladders.filter((l) => l.i === p.fl && !l.broken)
  if (p.fl >= KG.floors - 1) { const dx = KG.princess.x - p.x; I.dx = Math.abs(dx) > 0.5 ? Math.sign(dx) : 0; return flush() }
  let tgt = null, bd = 1e9
  for (const l of lads) { const d = Math.abs(l.x - p.x); if (d < bd) { bd = d; tgt = l } }
  if (!tgt) return flush()
  const dx = tgt.x - p.x
  if (Math.abs(dx) > 0.6) I.dx = Math.sign(dx); else I.dy = 1
  flush()
}
for (const size of [1, 4]) {
  kongActions.start({ level: 0, size, seed: 11 })
  const p = KG.players[0]; p.lives = 99
  check(`x${size}: the girders are ${60 * size} m wide with ${KG.ladders.length} ladders and ${KG.kongs.length} gorilla(s)`, KG.W === 60 * size && KG.ladders.length >= KG.floors - 1)
  let f = 0, bad = false
  while (KG.mode === 'play' && KG.lvl === 0 && f < 30 * 600) {
    for (const k of KG.kongs) k.t = 1e9 // no barrels for the pathing check
    bot(p); step(1); f++
    if (f % 90 === 0) { games.kong.draw3(api); games.kong.camera(1.7); if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) { bad = true; break } }
  }
  check(`x${size}: the climber can reach the captive and clear the site`, !bad && (KG.lvl > 0 || KG.clearT > 0 || p.done), `fl ${p.fl}/${KG.floors - 1} in ${(f / 30) | 0}s`)
  kongActions.stop()
}
// barrels: they roll down the girders, hurt you, can be jumped for points and smashed with the hammer
{
  kongActions.start({ level: 0, size: 1, seed: 3 }); const p = KG.players[0]
  p.x = -10; p.fl = 0; p.y = surf(0, p.x); for (const k of KG.kongs) k.t = 1e9
  KG.barrels.push({ id: 800, x: -16, i: 0, vx: 1, st: 'roll', dead: false, rot: 0, fall: 0, y: 0 }); p.inv = 0; step(30)
  check('a rolling barrel hurts you', p.lives < 3 || p.dead > 0, 'lives ' + p.lives)
  kongActions.stop(); kongActions.start({ level: 0, size: 1, seed: 3 }); const q = KG.players[0]; for (const k of KG.kongs) k.t = 1e9
  q.x = -10; q.y = surf(0, q.x); KG.barrels.push({ id: 801, x: -16, i: 0, vx: 1, st: 'roll', dead: false, rot: 0, fall: 0, y: 0 })
  kongActions.press('jump', true); step(1); kongActions.press('jump', false); let sc0 = q.score; step(40)
  check('jumping over a barrel scores and keeps you alive', q.score > sc0 && q.lives === 3, `score ${q.score} lives ${q.lives}`)
  kongActions.stop(); kongActions.start({ level: 0, size: 1, seed: 3 }); const r = KG.players[0]; for (const k of KG.kongs) k.t = 1e9
  r.x = -10; r.y = surf(0, r.x); r.ham = 10; KG.barrels.push({ id: 802, x: -13, i: 0, vx: 1, st: 'roll', dead: false, rot: 0, fall: 0, y: 0 }); kongActions.press('hit', true); step(30); kongActions.press('hit', false)
  check('the hammer smashes barrels', r.score >= 300 && r.lives === 3, 'score ' + r.score)
  kongActions.stop()
  kongActions.start({ level: 0, size: 1, seed: 4 }); for (const k of KG.kongs) k.t = 0.1; step(60)
  check('the gorilla throws barrels that roll down the girder', KG.barrels.length > 0)
  kongActions.stop()
}
for (const k of ['left', 'right', 'up', 'down', 'jump', 'hit']) kongActions.press(k, false)
process.exit(failures ? 1 : 0)
