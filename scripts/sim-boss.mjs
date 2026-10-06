// Defeating a boss must always lead to the stage-clear screen, whatever else is going on (dead ship, no lives, held laser...).
import { update, G, keys, startGameAt, setSquad, onKey } from '../src/game/engine.js'
let failures = 0
const check = (n, c, i) => { if (!c) failures++; console.log(c ? 'PASS' : 'FAIL', n, i || '') }
G.unlocked = 9
const cases = {
  'normal': () => {},
  'leader dies during the exit': () => { if (G.exitT > 0 && !G.warped && !G.p._k1) { G.p._k1 = true; G.p.alive = false; G.p.respawn = 1.8; G.lives = 2 } },
  'leader dies during the warp': () => { if (G.warped && !G.p._k2) { G.p._k2 = true; G.p.alive = false; G.p.respawn = 1.8; G.lives = 2 } },
  'leader dead with no lives left': () => { if (G.exitT > 0 && !G.p._k3) { G.p._k3 = true; G.p.alive = false; G.p.respawn = 1.8; G.lives = 0; G.overT = 0 } },
  'laser still firing': () => { if (G.exitT > 0) G.lz = G.lz || { t: 0, dur: 99, h: 5, dmg: 1, tick: 0 } },
}
for (const [name, hook] of Object.entries(cases)) {
  setSquad(2, false, true); startGameAt(0)
  for (let i = 0; i < 60; i++) update(1 / 60)
  G.mt = 1e9
  let t = 0
  for (; t < 60 * 70 && G.mode === 'playing'; t++) {
    keys.Space = true
    if (G.boss && !G.boss.dying) { G.p.y += (G.boss.y - G.p.y) * 0.15; G.p.inv = 5; if (G.bossState === 'fight' && G.boss.hp > 4) G.boss.hp = 4 }
    hook(); update(1 / 60)
  }
  check(`boss down -> stage clear: ${name}`, G.mode === 'clear', `mode ${G.mode} after ${(t / 60).toFixed(0)}s`)
}
// ...and then the next stage really starts
onKey('Enter', true); onKey('Enter', false); check('stage clear -> shop', G.mode === 'shop')
onKey('Enter', true); onKey('Enter', false); for (let i = 0; i < 60; i++) update(1 / 60)
check('shop -> next stage starts', G.mode === 'playing' && G.mission === 1, `mode ${G.mode} mission ${G.mission}`)
process.exit(failures ? 1 : 0)
