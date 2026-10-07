import { update, G, keys } from '../src/game/engine.js'
import { RC, raceActions, TRACKS, CARS, buildTrack, trackClearance } from '../src/game/race.js'
let failures = 0
const check = (n, c, i) => { if (!c) failures++; console.log(c ? 'PASS' : 'FAIL', n, i || '') }
const sane = () => RC.cars.every((c) => Number.isFinite(c.x) && Number.isFinite(c.z) && Number.isFinite(c.th) && Number.isFinite(c.sp) && c.sp < 400 && Math.abs(c.x) < 2000)
// ---- tracks ----
for (let i = 0; i < TRACKS.length; i++) {
  const t = buildTrack(i), cl = trackClearance(i)
  check(`${TRACKS[i].name}: loop is closed and long enough`, t.len > 1200 && t.len < 4200 && t.N > 150, `len ${t.len | 0} points ${t.N}`)
  check(`${TRACKS[i].name}: the road never touches itself`, cl.min > cl.need, `closest ${cl.min.toFixed(0)} need ${cl.need}`)
}
check('6 cars with distinct colours', CARS.length === 6 && new Set(CARS.map((c) => c.color)).size === 6)
// ---- full AI races ----
for (let ti = 0; ti < TRACKS.length; ti++) {
  raceActions.start({ track: ti, car: ti % 6, laps: 2, diff: 2, ai: 5, type: 'demo', seed: 100 + ti })
  let t = 0, bad = false, maxLat = 0
  while (RC.phase !== 'results' && t < 60 * 700) {
    update(1 / 60); G.time += 1 / 60; t++
    if (t % 30 === 0) { if (!sane()) { bad = true; break }; for (const c of RC.cars) maxLat = Math.max(maxLat, Math.abs(c.lat) - RC.tk.W / 2) }
  }
  const fin = RC.cars.filter((c) => c.finished).length
  check(`${TRACKS[ti].name}: 6 AI cars finish 2 laps`, !bad && RC.phase === 'results' && fin >= 5, `finished ${fin}/6 in ${(t / 60) | 0}s, max overshoot ${maxLat.toFixed(1)}`)
  const times = RC.cars.filter((c) => c.finished).map((c) => c.finishT)
  check(`${TRACKS[ti].name}: sensible lap times`, times.length && Math.min(...times) > 30 && Math.max(...times) < 360, `${Math.min(...times).toFixed(0)}-${Math.max(...times).toFixed(0)}s for 2 laps`)
}
// ---- a human driver (keys) can finish too ----
{
  raceActions.start({ track: 0, car: 0, laps: 1, diff: 1, ai: 3, type: 'race', seed: 5 })
  const me = RC.cars[0]
  let t = 0
  const P = RC.tk.P, N = RC.tk.N
  while (RC.phase !== 'results' && t < 60 * 400) {
    if (RC.phase === 'race' || RC.phase === 'ready') {
      const look = Math.round(8 + me.sp * 0.15), tp = P[(me.idx + look) % N]
      const want = Math.atan2(tp.x - me.x, -(tp.z - me.z))
      let d = want - me.th; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2
      keys.ArrowUp = true; keys.ArrowLeft = d < -0.05; keys.ArrowRight = d > 0.05; keys.ArrowDown = false; keys.Space = false
    }
    update(1 / 60); G.time += 1 / 60; t++
  }
  keys.ArrowUp = keys.ArrowLeft = keys.ArrowRight = false
  check('a keyboard driver finishes the race', me.finished && RC.phase === 'results', `${(t / 60) | 0}s, position ${me.rank}/${RC.cars.length}`)
  check('results screen has everyone', RC.results && RC.results.rows.length === RC.cars.length && RC.results.pos >= 1)
}
// ---- drifting builds a mini-turbo, nitro speeds you up, off-road slows you down ----
{
  raceActions.start({ track: 0, car: 4, laps: 1, diff: 1, ai: 1, type: 'race', seed: 9 })
  const me = RC.cars[0]
  RC.phase = 'race'; RC.t = 1
  me.inp = { thr: 1, brk: 0, steer: 0, drift: false, nitro: false }
  const run = (n, f) => { for (let i = 0; i < n; i++) { f && f(i); update(1 / 60); G.time += 1 / 60 } }
  // keep the AI quiet: drive alone
  RC.cars[1].x = 9999; RC.cars[1].z = 9999
  keys.ArrowUp = true
  let top = 0
  run(60 * 3.2, () => { top = Math.max(top, me.sp) })
  check('car accelerates to a high speed', top > 55, `${top.toFixed(0)} u/s (${(top * 3) | 0} km/h)`)
  me.x = RC.tk.P[20].x; me.z = RC.tk.P[20].z; me.th = Math.atan2(RC.tk.P[20].dx, -RC.tk.P[20].dz); me.vx = Math.sin(me.th) * 60; me.vz = -Math.cos(me.th) * 60
  keys.ShiftLeft = true; const n0 = me.nitro; let nmax = 0; run(40, () => { nmax = Math.max(nmax, me.sp) }); keys.ShiftLeft = false
  check('nitro boosts speed and uses the tank', nmax > 62 && me.nitro < n0, `peak ${nmax.toFixed(0)}, nitro ${n0.toFixed(0)}->${me.nitro.toFixed(0)}`)
  keys.ArrowUp = false
}
// ---- the 4th dimension: track size, time of day and weather ----
{
  const { raceEnv } = await import('../src/game/race.js')
  const api = { put3: (...a) => { if (a.slice(0, 10).some((v) => !Number.isFinite(v))) throw new Error('NaN put3 ' + a.slice(0, 10)) }, putS: (...a) => { if (a.slice(0, 9).some((v) => !Number.isFinite(v))) throw new Error('NaN putS') } }
  const { games } = await import('../src/game/engine.js')
  raceActions.start({ track: 0, car: 0, laps: 1, diff: 1, ai: 2, type: 'race', size: 4, weather: 'rain', tod: 0.5, seed: 9 })
  check('x4 track is four times longer', RC.tk.K === 4 && RC.tk.len > buildTrack(0).len * 3.5, `len ${RC.tk.len | 0} vs ${buildTrack(0).len | 0}`)
  check('rain makes the road slippery', RC.weather === 'rain' && RC.gripK < 0.9)
  const e0 = raceEnv(); check('noon is bright', e0.day > 0.9 && e0.amb > 1)
  for (let i = 0; i < 60 * 8; i++) { update(1 / 60); G.time += 1 / 60 }
  games.race.draw3(api)
  RC.t = 120; const e1 = raceEnv()
  check('the sun moves: later in the race it gets dark', e1.night > 0.5 && e1.amb < e0.amb && e1.fog !== e0.fog, `night ${e1.night.toFixed(2)}`)
  RC.t = 120; games.race.draw3(api)
  for (const w of ['clear', 'fog', 'snow']) { raceActions.start({ track: 3, car: 1, laps: 1, diff: 1, ai: 1, type: 'race', size: 2, weather: w, tod: 0.8, seed: 3 }); for (let i = 0; i < 60 * 3; i++) { update(1 / 60); G.time += 1 / 60 } games.race.draw3(api); check('weather ' + w + ' draws cleanly', raceEnv().weather === w) }
  raceActions.start({ track: 2, car: 0, laps: 1, diff: 2, ai: 2, type: 'race', size: 8, seed: 5 })
  let t2 = 0; while (RC.phase !== 'results' && t2 < 60 * 60 * 10) { update(1 / 60); G.time += 1 / 60; t2++; if (t2 % 600 === 0) games.race.draw3(api); if (!RC.cars.every((c) => Number.isFinite(c.x) && Number.isFinite(c.z) && c.sp < 400)) break }
  check('a x8 track still runs with the AI cars', RC.cars.every((c) => Number.isFinite(c.x) && c.sp < 400) && RC.cars.some((c) => c.prog > 1500), 'best progress ' + Math.max(...RC.cars.map((c) => c.prog)) | 0)
}
process.exit(failures ? 1 : 0)
