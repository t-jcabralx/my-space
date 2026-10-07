import { update, G } from '../src/game/engine.js'
import { EM, empireActions, BDEF, UDEF, canPlace, doBuild, doTrain, doUpgrade, doMove, MW, MH } from '../src/game/empire.js'
let fail = 0
const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m) } }
const step = (sec, dt = 0.1) => { for (let i = 0; i < sec / dt && EM.mode === 'play'; i++) update(dt) }
// ---- map, start state ----
empireActions.start({ ai: 3, diff: 2, seed: 5 })
ok(EM.P.length === 4 && EM.P.every((p) => p.alive), '4 kingdoms')
ok(EM.B.filter((b) => b.type === 'hall').length === 4, 'every kingdom has a town hall')
ok(EM.U.filter((u) => u.owner === 0).length === 3, 'three starting soldiers')
ok(EM.terr.length === MW * MH && MW >= 96, 'large map')
// the player can build, train and upgrade through the same commands as friends
const me = EM.P[0], h = EM.B.find((b) => b.owner === 0 && b.type === 'hall')
me.res.wood = 5000; me.res.stone = 5000; me.res.gold = 5000; me.res.food = 5000
let built = null
for (let r = 4; r < 12 && !built; r++) for (let a = 0; a < 40 && !built; a++) { const i = Math.round(h.x + 1 + Math.cos(a / 6) * r), j = Math.round(h.y + 1 + Math.sin(a / 6) * r); built = doBuild(0, 'barracks', i, j) }
ok(!!built, 'barracks placed')
ok(!doBuild(0, 'house', h.x, h.y), 'cannot build on top of a building')
ok(!doBuild(0, 'mine', 1, 1), 'cannot build outside your territory / on water')
step(30)
ok(built.built === 1, 'construction finishes')
ok(doTrain(0, built.id, 'sword') && doTrain(0, built.id, 'archer'), 'train soldiers')
ok(!doTrain(0, built.id, 'knight'), 'knights need a city')
ok(doUpgrade(0, h.id) && h.lv === 2, 'upgrade the hall to a town')
ok(doUpgrade(0, h.id) && doUpgrade(0, h.id) && h.lv === 4, 'upgrade to an empire')
ok(doTrain(0, built.id, 'catapult') && doTrain(0, built.id, 'knight'), 'siege and cavalry after upgrades')
step(40)
ok(EM.U.filter((u) => u.owner === 0).length >= 6, 'soldiers appear: ' + EM.U.filter((u) => u.owner === 0).length)
// ---- a full match: everybody is an AI; the game must end with one winner, no NaN, and raiders must come ----
for (const pl of EM.P) { pl.auto = true; pl.ai = { t: 0, atkT: 60 } }
let t0 = EM.t
for (let i = 0; i < 12000 && EM.mode === 'play'; i++) { update(0.1); if (i % 200 === 0) { ok(EM.U.every((u) => Number.isFinite(u.x) && Number.isFinite(u.y) && Number.isFinite(u.hp)), 'units finite') } }
console.log('match ended', EM.mode, 'time', Math.round(EM.t), 'raids', EM.raidN, 'alive', EM.P.filter((p) => p.alive).map((p) => p.i).join(','), 'buildings', EM.B.length, 'units', EM.U.length)
ok(EM.raidN >= 2, 'raiders came: ' + EM.raidN)
ok(EM.mode === 'over' || EM.t > 1000, 'the match either ends or runs long without breaking')
ok(EM.B.every((b) => Number.isFinite(b.hp)), 'buildings finite')
console.log('PASS empire', EM.over ? JSON.stringify(EM.over).slice(0, 120) : 'running ' + Math.round(EM.t) + 's')
// ---- online packets round trip ----
empireActions.stop()
// ---- building upgrades ----
{
  empireActions.start({ ai: 1, diff: 1, speed: 1 })
  EM.P[0].res = { food: 5000, wood: 5000, stone: 5000, gold: 5000 }
  const h0 = EM.B.find((b) => b.owner === 0 && b.type === 'hall')
  let farm = null
  for (let r = 4; r < 14 && !farm; r++) for (let a = 0; a < 60 && !farm; a++) { const i = Math.round(h0.x + 1 + Math.cos(a / 9) * r), j = Math.round(h0.y + 1 + Math.sin(a / 9) * r); farm = doBuild(0, 'farm', i, j) }
  ok(farm && !doUpgrade(0, farm.id), 'a farm under construction cannot be upgraded')
  if (farm) { farm.built = 1; farm.bt = 0 }
  const hp0 = farm ? farm.max : 0
  ok(farm && doUpgrade(0, farm.id) && farm.lv === 2 && farm.max > hp0, 'a built farm upgrades to level 2 and gets stronger')
  ok(farm && !doUpgrade(0, farm.id), 'level 3 needs a TOWN hall')
  doUpgrade(0, h0.id)
  ok(farm && doUpgrade(0, farm.id) && farm.lv === 3, 'with a TOWN hall the farm reaches level 3')
  ok(farm && !doUpgrade(0, farm.id), 'level 3 is the maximum')
  const f0 = EM.P[0].res.food; for (let k = 0; k < 50; k++) update(0.2)
  ok(EM.P[0].res.food > f0, 'upgraded farms keep producing food')
  empireActions.stop()
}
// ---- finite forests, and moving a building ----
{
  empireActions.start({ ai: 1, diff: 1, speed: 1 })
  EM.P[0].res = { food: 5000, wood: 5000, stone: 5000, gold: 5000 }
  const h1 = EM.B.find((b) => b.owner === 0 && b.type === 'hall')
  let camp = null
  for (let r = 3; r < 16 && !camp; r++) for (let a = 0; a < 80 && !camp; a++) { const i = Math.round(h1.x + 1 + Math.cos(a / 9) * r), j = Math.round(h1.y + 1 + Math.sin(a / 9) * r); const bb = doBuild(0, 'lumber', i, j); if (bb) camp = bb }
  ok(!!camp, 'a lumber camp can be built')
  if (camp) {
    camp.built = 1; camp.bt = 0
    let moved = false; const x0 = camp.x
    for (let r = 4; r < 12 && !moved; r++) for (let a = 0; a < 60 && !moved; a++) { const i = Math.round(h1.x + 1 + Math.cos(a / 7 + 2) * r), j = Math.round(h1.y + 1 + Math.sin(a / 7 + 2) * r); if (i !== camp.x || j !== camp.y) moved = doMove(0, camp.id, i, j) }
    ok(moved && camp.x !== x0, 'a finished building can be moved for a fee')
    const trees = () => { let n = 0; for (let k = 0; k < EM.terr.length; k++) if (EM.terr[k] === 1) n++; return n }
    const t0 = trees(); for (let k = 0; k < 4500; k++) update(0.2)
    ok(trees() < t0, 'lumber camps use up the trees they cut (' + t0 + ' -> ' + trees() + ')')
    ok(EM.cleared && EM.cleared.length > 0 && EM.cleared.every((i) => EM.terr[i] === 0), 'cleared tiles become grass')
    const ob = EM.B.find((b) => b.type === 'hall'); ok(!doMove(0, ob.id, ob.x + 6, ob.y), 'the hall cannot be moved')
  }
  empireActions.stop()
}
// ---- the campaign: every scenario starts with a story, has goals, and the first ones can be won by an auto-pilot ----
import { profile } from '../src/game/engine.js'
import { EMCAMP } from '../src/game/empirestory.js'
ok(EMCAMP.length === 5 && EMCAMP.every((c) => c.intro.length >= 4 && c.outro.length >= 2 && c.objectives.length >= 2), 'five complete scenarios')
for (let i = 0; i < EMCAMP.length; i++) {
  empireActions.start({ scen: i })
  ok(EM.scen && EM.tale && EM.obj.length === EMCAMP[i].objectives.length && EM.P.length === EMCAMP[i].ai + 1, 'scenario ' + (i + 1) + ' starts with a scene and goals')
  empireActions.skipTale()
  EM.P[0].auto = true; EM.P[0].ai = { t: 0, atkT: 80 }
  if (i === 2) EM.P[0].res = { food: 3000, wood: 3000, stone: 3000, gold: 3000 }
  let f = 0
  const limit = i <= 1 ? 2400 : i === 2 ? 700 : 500 // seconds of game time
  while (EM.mode === 'play' && EM.t < limit && f++ < 40000) update(0.2)
  console.log('scenario', i + 1, EM.mode, 'time', Math.round(EM.t), 'done', EM.obj.filter((o) => o.done).length + '/' + EM.obj.length, 'raids', EM.raidN)
  ok(EM.obj.some((o) => o.done) || EM.mode === 'over', 'scenario ' + (i + 1) + ' makes progress')
  if (EM.mode === 'over' && EM.over.win) ok((profile.empireCamp && profile.empireCamp.cleared) >= i + 1, 'winning saves the campaign')
  empireActions.stop()
}
// review fixes: "no rivals" means no rivals; raiders never spawn in the water
empireActions.start({ ai: 0, diff: 1, size: 1, seed: 3 }); ok(EM.cfg.ai === 0, 'ai: 0 is respected as a setting')
{ let wet = 0
  for (let k = 0; k < 6; k++) { empireActions.start({ ai: 3, diff: 2, size: 1, seed: 20 + k }); for (const dir of ['EAST', 'NORTH', 'WEST', 'SOUTH']) { EM.raidDir = dir; EM.raidT = 0.01; EM.raidWarn = 0; const n0 = EM.U.length; update(0.1); for (const u of EM.U.slice(n0)) { const i = (u.x / 2) | 0, j = (u.y / 2) | 0; if (u.owner < 0 && EM.terr[j * MW + i] === 4) wet++ } } }
  ok(wet === 0, 'no raider starts in the water (' + wet + ')') }
// map sizes: x4 and x20 (1920 x 1920 tiles) build, run and keep raiders close to the village
import { setMapSize } from '../src/game/empire.js'
for (const k of [4, 20]) {
  empireActions.start({ ai: 2, diff: 2, size: k, seed: 5 })
  ok(MW === 96 * k && EM.terr.length === MW * MH, 'size x' + k + ' map is ' + MW + ' tiles wide')
  const halls = EM.B.filter((b) => b.type === 'hall')
  ok(halls.length >= 3 && halls.every((h) => h.x > 2 && h.y > 2 && h.x < MW - 3 && h.y < MH - 3), 'x' + k + ': every kingdom starts inside the map')
  EM.raidT = 1
  for (let i = 0; i < 20 * 40; i++) update(0.05)
  const raiders = EM.U.filter((u) => u.owner < 0)
  ok(raiders.length > 0 && raiders.every((u) => Number.isFinite(u.x) && halls.some((h) => Math.hypot(u.x - h.x * 2, u.y - h.y * 2) < 400)), 'x' + k + ': raiders appear near the village (' + raiders.length + ')')
  { // the 3D pass must read the big map correctly: grass tiles near the hall, not water
    const { games } = await import('../src/game/engine.js')
    let grass = 0, calls = 0
    const api = { put3: (x, y, z, sx, sy, sz, rz, r, g, b) => { calls++; if (Math.abs(y) < 0.01 && g > 0.2 && g < 0.35 && r < 0.15 && b < 0.15) grass++ }, putS: () => {} }
    games.empire.draw3(api)
    ok(calls > 300 && grass > 100, 'x' + k + ': the 3D view of the home village shows land (' + grass + ' grass tiles)')
  }
  empireActions.stop()
}
void setMapSize
process.exit(fail ? 1 : 0)
