// Plays every pickleball mode to completion with scripted humans (serving + swinging at everything reachable).
import { update, onKey, keys } from '../src/game/engine.js'
import { P, pickleActions } from '../src/game/pickle.js'
let failures = 0
for (const type of ['bot', 'local', 'duo', 'coop', 'demo']) {
  pickleActions.start(type, 2, 5)
  let frames = 0, hitsBy = {}, maxPhaseT = 0, phaseT = 0, lastPhase = '', reasons = {}, lastMsg = null
  for (let i = 0; i < 60 * 60 * 20 && P.mode !== 'over'; i++) {
    // scripted humans: walk toward ball landing, swing when close
    for (const h of P.pl.filter((p) => p.human)) {
      const up = h.human === 1 ? ['KeyW', 'KeyS', 'KeyA', 'KeyD'] : ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']
      const B = P.B
      let tx = h.team === 0 ? -34 : 34, ty = 0
      if (P.phase === 'rally' && B.live && B.lastHit !== h.team) { tx = B.x + (h.team === 0 ? -1.5 : 1.5); ty = B.y }
      keys[up[2]] = h.x > tx + 1; keys[up[3]] = h.x < tx - 1; keys[up[1]] = h.y > ty + 1; keys[up[0]] = h.y < ty - 1
      const shot = h.human === 1 ? 'KeyF' : 'Comma'
      if (P.phase === 'serve' && i % 20 === 0) onKey(shot, true)
      if (P.phase === 'rally' && B.live && B.lastHit !== h.team && Math.hypot(B.x - h.x, B.y - h.y) < 5.5 && B.bounces[h.team] >= 1) { onKey(shot, true); hitsBy[h.human] = (hitsBy[h.human] || 0) + 1 }
    }
    update(1 / 60); frames++
    if (P.phase === lastPhase) phaseT += 1 / 60; else { lastPhase = P.phase; phaseT = 0 }
    maxPhaseT = Math.max(maxPhaseT, P.phase === 'rally' ? 0 : phaseT)
    if (P.msg && P.msg !== lastMsg) { lastMsg = P.msg; reasons[P.msg.text] = (reasons[P.msg.text] || 0) + 1 }
  }
  const ok = P.mode === 'over'
  if (!ok) failures++
  console.log(ok ? 'PASS' : 'FAIL', type.padEnd(6), 'players', P.pl.length, 'score', P.score.join('-'), 'secs', (frames / 60) | 0, 'longest idle phase', maxPhaseT.toFixed(1) + 's', 'humanSwings', JSON.stringify(hitsBy), JSON.stringify(reasons))
}
process.exit(failures ? 1 : 0)
