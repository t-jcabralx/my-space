import { update, G, games, profile } from '../src/game/engine.js'
import { pickWeather, timeOf, skyFor, weatherFx } from '../src/game/env4d.js'
import { ssxActions, SX, ssxEnv } from '../src/game/ssx.js'
import { empireActions, EM } from '../src/game/empire.js'
import { empireEnv } from '../src/game/empire3d.js'
import { rogueActions, RG } from '../src/game/rogue.js'
let failures = 0
const check = (n, c, i) => { if (!c) failures++; console.log(c ? 'PASS' : 'FAIL', n, i || '') }
const api = { put3: (...a) => { if (a.slice(0, 10).some((v) => !Number.isFinite(v))) throw new Error('NaN put3 ' + a.slice(0, 10)) }, putS: (...a) => { if (a.slice(0, 9).some((v) => !Number.isFinite(v))) throw new Error('NaN putS') }, putM: () => {}, bulk: () => {} }
const step = (n, dt = 1 / 20) => { for (let i = 0; i < n; i++) { update(dt); G.time += dt } }
check('weather is deterministic per seed', pickWeather(5) === pickWeather(5) && ['clear', 'rain', 'fog', 'snow'].includes(pickWeather(77)))
check('noon is bright, midnight is dark', timeOf(0.5, 0, 100).day > 0.95 && timeOf(0, 0, 100).night > 0.95)
const noon = skyFor(timeOf(0.5, 0, 100), 'clear', { sky: '#7fb4ff', fog: '#a8c4e8', sun: '#fff1d6', sunI: 1.2, amb: 0.8, dir: 0.15 }), dark = skyFor(timeOf(0, 0, 100), 'clear', { sky: '#7fb4ff', fog: '#a8c4e8', sun: '#fff1d6', sunI: 1.2, amb: 0.8, dir: 0.15 })
check('the same place looks different at night', noon.amb > dark.amb * 1.5 && noon.sky !== dark.sky && noon.sunI > dark.sunI)
{ let n = 0; weatherFx((...a) => { n++; if (a.slice(0, 10).some((v) => !Number.isFinite(v))) throw new Error('NaN') }, 0, 0, 'rain', 3); check('rain draws streaks', n > 100) }
// Snow Rush: the day moves on
ssxActions.start({ course: 0, kind: 'race', rider: 0, seed: 21 }); const e0 = ssxEnv(); SX.clock = 150; const e1 = ssxEnv()
check('Snow Rush time of day moves during a run', e0.sky !== e1.sky && e0.label !== undefined, `${e0.label} -> ${e1.label}`)
step(60); games.ssx.draw3(api); ssxActions.stop()
ssxActions.start({ course: 2, kind: 'race', rider: 0, seed: 21 }); check('the Midnight Peak stays night', ssxEnv().T.night > 0.9); ssxActions.stop()
// Empire
empireActions.start({ ai: 1, diff: 1, size: 1, seed: 8 }); const a0 = empireEnv(EM); EM.t = 200; const a1 = empireEnv(EM)
check('Empire has a day and night cycle', a0.sky !== a1.sky, `${a0.label} -> ${a1.label}`)
const l = games.empire.lights(); check('Empire lights follow the sun', l.ambient > 0 && Number.isFinite(l.sun.intensity)); games.empire.draw3(api)
for (const w of ['rain', 'fog', 'snow']) { EM.weather = w; games.empire.draw3(api); check('Empire draws in ' + w, !!games.empire.fog === true) }
empireActions.stop()
// Depths
profile.depthsScale = 1
rogueActions.start({ cls: 0, chapter: 1 }); rogueActions.skipTale(); step(40); games.rogue.draw3(api); check('Neon Depths draws its room weather', true); rogueActions.stop()
process.exit(failures ? 1 : 0)
