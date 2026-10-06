import { update, keys, onKey } from '../src/game/engine.js'
import { RG, rogueActions } from '../src/game/rogue.js'
let fail = 0
const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m) } }
for (const cls of [0, 1, 2]) {
  rogueActions.start({ cls })
  let f = 0
  const rr = (n) => Math.floor(Math.random() * n)
  while ((RG.mode === 'play' || RG.mode === 'perk') && f < 60 * 240) {
    if (RG.mode === 'perk') onKey('Digit' + (1 + rr(3)), true)
    else {
      const t = RG.en.find((e) => !e.dead)
      // kite: move toward the nearest enemy when far, away when close; head to the door when clear
      keys.KeyD = keys.KeyA = keys.KeyW = keys.KeyS = false
      if (RG.open) { keys.KeyD = true; keys.KeyW = RG.p.y < -2; keys.KeyS = RG.p.y > 2 }
      else if (t) { const dx = t.x - RG.p.x, dy = t.y - RG.p.y, d = Math.hypot(dx, dy), s = d < 14 && cls !== 0 ? -1 : 1; keys.KeyD = dx * s > 1; keys.KeyA = dx * s < -1; keys.KeyW = dy * s > 1; keys.KeyS = dy * s < -1 }
      if (f % 50 === 0) onKey('Space', true)
      keys.KeyQ = f % 400 === 0
    }
    update(1 / 60); f++
    ok(Number.isFinite(RG.p.x) && Number.isFinite(RG.p.hp), 'player NaN')
  }
  keys.KeyD = keys.KeyA = keys.KeyW = keys.KeyS = keys.KeyQ = false
  console.log('PASS rogue class', cls, RG.mode, RG.over ? (RG.over.win ? 'WIN' : 'DEAD') : 'timeout', 'floor', RG.floor + 1, 'room', RG.room + 1, 'kills', RG.kills, 'secs', (f / 60) | 0)
  ok(f > 120, 'ran')
  rogueActions.stop()
}
process.exit(fail ? 1 : 0)
