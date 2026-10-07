import { update, G, profile } from '../src/game/engine.js'
import { RG, rogueActions } from '../src/game/rogue.js'
import { games } from '../src/game/engine.js'
let failures = 0
const check = (n, c, i) => { if (!c) failures++; console.log(c ? 'PASS' : 'FAIL', n, i || '') }
const api = { put3: (...a) => { if (a.slice(0, 10).some((v) => !Number.isFinite(v))) throw new Error('NaN put3 ' + a.slice(0, 10)) }, putS: (...a) => { if (a.slice(0, 9).some((v) => !Number.isFinite(v))) throw new Error('NaN putS') }, putM: () => {}, bulk: () => {} }
const me = () => RG.players[RG.me]
for (const k of [1, 4, 20]) {
  profile.depthsScale = k
  rogueActions.start({ cls: 0, chapter: 1 }); rogueActions.skipTale()
  const p = me(); p.inv = 99999; p.hp = p.max = 9999
  check(`x${k}: the combat arena is ${k}x as wide`, RG.ax === 96 * k && RG.ay === 52 * k, `ax ${RG.ax}`)
  // 1) standing still: do the enemies come to you?
  const start = { x: p.x, y: p.y }
  let close = false
  for (let i = 0; i < 60 * 40 && !close; i++) { update(1 / 60); G.time += 1 / 60; if (RG.en.some((e) => Math.hypot(e.x - p.x, e.y - p.y) < 18)) close = true }
  if (k <= 4) check(`x${k}: the enemies find you`, close, `after ${(Math.hypot(p.x - start.x, p.y - start.y)) | 0} units moved`)
  // 2) a hero that hunts them clears the room
  p.holdPtr = true
  let f = 0, bad = false
  while (!(RG.open || RG.mode === 'over') && f < 60 * 400) {
    const e = RG.en.filter((q) => !q.dead).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0]
    if (e) { const d = Math.hypot(e.x - p.x, e.y - p.y); p.aimPt = { x: e.x, y: e.y }; p.aimT = 1e9; if (d > 14) { p.x = e.x - 5; p.y = e.y } } else if (RG.spawnQ.length) { /* wait for the rest */ }
    update(1 / 60); G.time += 1 / 60; f++
    if (f % 120 === 0) { if (!Number.isFinite(p.x)) { bad = true; break } games.rogue.draw3(api) }
  }
  check(`x${k}: the room can be cleared and draws cleanly`, !bad && RG.open, `time ${(f / 60) | 0}s kills ${RG.kills} open ${RG.open} en ${RG.en.map((q) => q.type + (q.dead ? 'X' : '') + '@' + (q.x | 0) + ',' + (q.y | 0)).join(' ')} q ${RG.spawnQ.length} me ${p.x | 0},${p.y | 0} hp ${p.hp | 0}`)
  rogueActions.stop()
}
process.exit(failures ? 1 : 0)
