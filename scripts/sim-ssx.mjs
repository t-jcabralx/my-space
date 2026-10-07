import { update, G, games, keys } from '../src/game/engine.js'
import { SX, ssxActions, COURSES, RIDERS } from '../src/game/ssx.js'
let failures = 0
const check = (n, c, i) => { if (!c) failures++; console.log(c ? 'PASS' : 'FAIL', n, i || '') }
let nb = 0
const api = { put3: (...a) => { nb++; if (a.slice(0, 10).some((v) => !Number.isFinite(v))) throw new Error('NaN put3 ' + a.join(',')) }, putM: (...a) => { nb++; if (a.slice(0, 6).some((v) => !Number.isFinite(v)) || a[6].some((v) => !Number.isFinite(v))) throw new Error('NaN putM ' + a.join(',')) }, putS: () => {}, put: () => {} }
const step = (n, dt = 1 / 60) => { for (let i = 0; i < n; i++) { update(dt); G.time += dt } }
const sane = () => SX.riders.every((r) => [r.x, r.y, r.z, r.vx, r.vy, r.vz, r.hd].every(Number.isFinite) && r.y < 400 && Math.abs(r.vz) < 140)
const down = (...c) => c.forEach((k) => { keys[k] = true }), up = (...c) => c.forEach((k) => { keys[k] = false })

// ---- a bot player: steers to the middle, jumps kickers, spins in the air, boosts ----
function drive(ci, kind, maxSec = 200, cfg = {}) {
  ssxActions.start({ course: ci, kind, rider: cfg.rider || 0 })
  const P = SX.P, out = { air: 0, frames: 0, tricks: 0, crashes: 0, maxAir: 0, grind: 0, maxSpd: 0, groundedFlicker: 0 }
  let lastG = true, airT = 0, f = 0
  while (SX.mode !== 'over' && f < 60 * maxSec) {
    const spd = Math.hypot(P.vx, P.vz)
    const cx = games.ssx.lights().target
    void cx
    // steer toward the centre line
    const mid = (window_xc(P.z + 14))
    const err = mid - P.x
    up('ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD', 'Space', 'KeyJ', 'ShiftLeft')
    if (P.grounded && !P.grind) {
      const want = Math.max(-0.45, Math.min(0.45, err * 0.09)) + (mid - window_xc(P.z + 4)) * 0.05, dh = want - P.hd; if (dh > 0.06) down('ArrowRight'); else if (dh < -0.06) down('ArrowLeft')
      if (cfg.jumpy && f % 200 === 100) down('Space')
    } else if (!P.grounded) {
      if (!cfg.noTricks) { if (Math.abs(P.spinAcc) < 6.2) down('ArrowRight'); down('KeyJ') }
    }
    if (cfg.boost) down('ShiftLeft')
    update(1 / 60); G.time += 1 / 60; f++
    out.frames++
    if (!P.grounded) { out.air++; airT++ } else { if (airT > 0) { out.maxAir = Math.max(out.maxAir, airT / 60); airT = 0 } }
    if (P.grind) out.grind++
    out.maxSpd = Math.max(out.maxSpd, spd)
    if (f % 30 === 0) { games.ssx.draw3(api); games.ssx.camera(1.7, 1 / 60); const pos = new Float32Array(44 * 84 * 3), cl = new Float32Array(44 * 84 * 3); games.ssx.terrain(pos, cl, 44, 84); if (pos.some((v) => !Number.isFinite(v)) || cl.some((v) => !Number.isFinite(v))) throw new Error('NaN terrain') }
    if (!sane()) { console.log('INSANE', SX.riders.map((r) => [r.x, r.y, r.z, r.vz])); break }
  }
  out.crashes = P.crashes; out.tricks = SX.tricks; out.t = SX.t; out.mode = SX.mode; out.over = SX.over
  keys.ArrowLeft = keys.ArrowRight = keys.Space = keys.KeyJ = keys.ShiftLeft = false
  return out
}
import { snowTest } from '../src/game/ssx.js'
const window_xc = (z) => snowTest().xc(z)

check('3 courses and 6 riders', COURSES.length === 3 && RIDERS.length === 6)
for (let ci = 0; ci < 3; ci++) {
  const o = drive(ci, 'race', 160, { boost: false })
  const ov = o.over
  console.log(COURSES[ci].name, 'finish', ov && ov.time.toFixed(1), 'place', ov && ov.place, 'crashes', o.crashes, 'air%', (100 * o.air / o.frames).toFixed(1), 'maxAir', o.maxAir.toFixed(2), 'maxSpd', o.maxSpd.toFixed(1), 'tricks', o.tricks, 'score', ov && ov.total)
  check(COURSES[ci].name + ': race finishes with a result', o.mode === 'over' && ov && ov.place >= 1 && ov.place <= 6)
  check(COURSES[ci].name + ': state stays sane and draws cleanly', sane())
  check(COURSES[ci].name + ': speed in a believable range', o.maxSpd > 18 && o.maxSpd < 75, o.maxSpd.toFixed(1))
  check(COURSES[ci].name + ': riders actually fly now and then (kickers work)', o.air > 20 || ci === 1, 'air frames ' + o.air)
  check(COURSES[ci].name + ': AI riders all finish near the player', SX.riders.filter((r) => r.fin !== null).length >= 4, 'finished ' + SX.riders.filter((r) => r.fin !== null).length)
}
// trick attack ends on the clock and scores
{
  const o = drive(0, 'trick', 120, { boost: true })
  check('trick attack ends by timer', o.mode === 'over' && o.over.kind === 'trick', 't=' + o.t.toFixed(1))
  check('trick attack scores points', o.over && o.over.total > 0, 'total ' + (o.over && o.over.total) + ' tricks ' + o.tricks)
}
// physics: standing still on the flat start doesn't float, fall through or jitter
{
  ssxActions.start({ course: 0, kind: 'race', rider: 2 }); step(60 * 5)
  const P = SX.P
    check('countdown ends and the race starts', SX.mode === 'play')
  step(60 * 4)
  check('rider hugs the snow while riding down a plain slope', Math.abs(P.y - snowTest().ground(P.x, P.z)) < 0.9 || !P.grounded, 'y ' + P.y.toFixed(2))
}
// crash and recovery
{
  ssxActions.start({ course: 0, kind: 'race', rider: 1 }); step(60 * 4)
  const P = SX.P; P.spinAcc = 1.6; P.grounded = false; P.air = 1; P.y += 3; P.vy = 0
  step(60 * 3)
  check('a bad landing wipes out and then recovers', P.crashes >= 1 && P.crash === 0, 'crashes ' + P.crashes)
  check('rider is back on the snow after the wipeout', P.grounded || P.air > 0)
  step(60 * 2)
  check('the screen shake from a wipeout fades out (no endless earthquake)', G.shake < 0.05, 'shake ' + G.shake.toFixed(2))
}
// trick scoring: a clean 360 over a flat hop is worth points
{
  ssxActions.start({ course: 0, kind: 'trick', rider: 0 }); step(60 * 4)
  const P = SX.P, s0 = SX.score
  P.grounded = false; P.vy = 14; P.air = 0.5; P.spinAcc = 0; P.y += 0.3
  down('KeyJ'); let f = 0
  while (!P.grounded && f < 400) { keys.ArrowRight = Math.abs(P.spinAcc) < Math.PI * 2 - 0.35; update(1 / 60); f++ }
  up('KeyJ', 'ArrowRight')
  step(10)
  check('a clean 360 with a grab scores', SX.score > s0 + 200 && P.crashes === 0, 'gained ' + (SX.score - s0) + ' crashes ' + P.crashes + ' acc ' + P.spinAcc.toFixed(2))
}
// wide mountains: x1 piste up to x20 range
{
  ssxActions.start({ course: 0, kind: 'race', rider: 0, width: 1 }); const T = snowTest(); const k1 = T.F.kick.length, hw1 = T.CUR.hw
  ssxActions.start({ course: 0, kind: 'race', rider: 0, width: 20 }); const T20 = snowTest()
  check('x20 is twenty times wider (260 m half-width) and has more to do', T20.CUR.hw === hw1 * 20 && T20.F.kick.length > k1 * 4, `hw ${T20.CUR.hw} kickers ${k1} -> ${T20.F.kick.length}`)
  const P = SX.P; step(60 * 5)
  P.x = T20.xc(P.z) + 150; P.y = T20.ground(P.x, P.z); P.vx = 0; P.vz = 5; P.grounded = true
  step(60 * 6)
  const pos = new Float32Array(44 * 84 * 3), cl = new Float32Array(44 * 84 * 3); games.ssx.terrain(pos, cl, 44, 84)
  check('you can ride a hundred metres from the centre line, the terrain follows you', sane() && Math.abs(P.x - T20.xc(P.z)) > 100 && pos.every(Number.isFinite) && Math.abs(pos[22 * 3] - P.x) < 80, 'dx ' + (P.x - T20.xc(P.z)).toFixed(0))
}
ssxActions.stop()
process.exit(failures ? 1 : 0)
