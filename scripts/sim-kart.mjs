import { update, G, keys } from '../src/game/engine.js'
import { RC, raceActions, hitCar } from '../src/game/race.js'
let failures = 0
const check = (n, c, i) => { if (!c) failures++; console.log(c ? 'PASS' : 'FAIL', n, i || '') }
const sane = () => RC.cars.every((c) => Number.isFinite(c.x) && Number.isFinite(c.z) && Number.isFinite(c.th) && Number.isFinite(c.sp) && c.sp < 500)
// full kart race with a human driving and using items
for (const ti of [0, 3]) {
  raceActions.start({ track: ti, car: 1, laps: 2, diff: 2, ai: 5, type: 'race', kart: true, seed: 40 + ti })
  const me = RC.cars[0], P = RC.tk.P, N = RC.tk.N
  let t = 0, bad = false, uses = 0, picked = 0, hits = 0, maxItems = 0, maxShells = 0
  const seen = new Set(), kinds = new Set()
  while (RC.phase !== 'results' && t < 60 * 700) {
    if (RC.phase === 'race' || RC.phase === 'ready') {
      const look = Math.round(8 + me.sp * 0.15), tp = P[(me.idx + look) % N]
      const want = Math.atan2(tp.x - me.x, -(tp.z - me.z))
      let d = want - me.th; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2
      keys.ArrowUp = true; keys.ArrowLeft = d < -0.05; keys.ArrowRight = d > 0.05; keys.ArrowDown = false; keys.Space = false
      if (me.item && t % 50 === 0) { kinds.add(me.item); keys.KeyF = true; uses++ } else keys.KeyF = false
    }
    const before = RC.cars.map((c) => c.spin > 0 ? 1 : 0).join('')
    update(1 / 60); G.time += 1 / 60; t++
    for (const c of RC.cars) { if (c.item) seen.add(c.item) }
    const after = RC.cars.map((c) => c.spin > 0 ? 1 : 0).join('')
    if (before !== after) hits++
    maxItems = Math.max(maxItems, RC.items.length); maxShells = Math.max(maxShells, RC.shells.length)
    if (t % 30 === 0 && !sane()) { bad = true; break }
  }
  keys.ArrowUp = keys.ArrowLeft = keys.ArrowRight = keys.KeyF = false
  const fin = RC.cars.filter((c) => c.finished).length
  check(`track ${ti}: kart race finishes cleanly`, !bad && RC.phase === "results" && fin >= 1, `finished ${fin}/6 in ${(t / 60) | 0}s`)
  check(`track ${ti}: items are picked up and used`, seen.size >= 2, `kinds ${[...seen].join(',')} player uses ${uses}`)
  check(`track ${ti}: bananas and shells were in play and cars got hit`, (maxItems > 0 || maxShells > 0) && hits >= 1, `maxBananas ${maxItems} maxShells ${maxShells} spinouts ${hits}`)
  check(`track ${ti}: score recorded as kart`, RC.results && RC.results.score > 0)
}
// direct hit mechanics
{
  raceActions.start({ track: 0, car: 0, laps: 1, diff: 1, ai: 3, type: 'race', kart: true, seed: 3 })
  for (let i = 0; i < 60 * 5; i++) { update(1 / 60); G.time += 1 / 60 }
  const c = RC.cars[1]
  hitCar(c, 'shell'); check('a shell hit spins the car', c.spin > 1)
  const c2 = RC.cars[2]; c2.star = 3; hitCar(c2, 'shell'); check('a star makes you unstoppable', !(c2.spin > 0))
  const c3 = RC.cars[3]; hitCar(c3, 'bolt'); check('lightning slows the car', c3.slowT > 3)
  RC.cars[0].item = 'banana'; RC.cars[0].itemN = 1; keys.KeyF = true; update(1 / 60); keys.KeyF = false
  check('using a banana drops it on the track', RC.items.length >= 1 && RC.cars[0].item === null)
  RC.cars[0].item = 'shell'; RC.cars[0].itemN = 1; RC.cars[0].fHeld = false; keys.KeyF = true; update(1 / 60); keys.KeyF = false
  check('firing a shell launches it', RC.shells.length >= 1)
}
process.exit(failures ? 1 : 0)
