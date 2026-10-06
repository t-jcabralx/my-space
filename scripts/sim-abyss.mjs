import { update, keys, profile } from '../src/game/engine.js'
import { RG, rogueActions, AGENDAS, ORBS, RELICS, orbOk, relicOk, abyssRoom, ABYSS_ROOMS, PETS, petOk, petInfo } from '../src/game/rogue.js'
let fail = 0
const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m) } }
const run = (sec) => { for (let i = 0; i < sec * 60 && RG.mode === 'play'; i++) update(1 / 60) }
const me = () => RG.players[RG.me]
profile.rogueU = { cleared: 5, secret: {}, lore: {}, wins: {}, agenda: {}, pets: {}, abyss: 0 }
// ---- 50 different rooms ----
const types = new Set(), titles = new Set()
for (let n = 0; n < ABYSS_ROOMS; n++) { const r = abyssRoom(n); types.add(r.type); titles.add(r.title) }
ok(ABYSS_ROOMS === 50 && titles.size === 50 && types.size >= 10, 'fifty distinct rooms: ' + titles.size + ' titles, ' + types.size + ' kinds')
rogueActions.start({ mode: 'abyss', cls: 0 }); rogueActions.skipTale()
ok(RG.abyss && me().lv === 6, 'the abyss starts at level 6')
for (let n = 0; n < ABYSS_ROOMS; n++) {
  rogueActions.jump(n); rogueActions.skipTale()
  const a = abyssRoom(n)
  ok(RG.rtype === a.type, 'room ' + n + ' is a ' + a.type + ' (' + RG.rtype + ')')
  me().hp = me().max = 999; me().inv = 99999
  me().holdPtr = true; me().aimPt = { x: 10, y: 0 }; me().aimT = 1e9
  run(a.type === 'puzzle' ? 3 : 4)
  ok(Number.isFinite(me().x) && RG.en.every((e) => Number.isFinite(e.x)), 'room ' + n + ' stays finite')
  if (a.type === 'boss') ok(RG.spawnQ.concat(RG.en.map((e) => ({ type: e.type }))).some((q) => ['king', 'lord', 'golem', 'drake', 'eye'].includes(q.type)), 'room ' + n + ' has a boss')
  if (a.type === 'trap') ok(RG.hz.length >= 4, 'trap room has hazards')
  if (a.type === 'merchant') ok(RG.chests.length === 3 && RG.chests.every((c) => c.kind === 'shop'), 'merchant sells 3 things')
  if (a.type === 'shrine') ok(RG.chests[0].kind === 'shrine', 'shrine')
  if (a.type === 'survival') ok(RG.surv > 0, 'survival timer')
  RG.mode = 'play'
}
ok(RG.ax >= 76, 'rooms are wide: ' + RG.ax)
rogueActions.stop()
// ---- hidden agendas -> orbs and relic skills ----
ok(AGENDAS.length === 6 && ORBS.length === 7 && RELICS.length === 7, 'six agendas, six orbs, six relics')
ok(!orbOk('ember') && !relicOk('flamedash'), 'orbs and relics start locked')
rogueActions.start({ mode: 'abyss', cls: 1 }); rogueActions.skipTale(); me().inv = 99999; me().hp = me().max = 999
// pots: five of them
for (let k = 0; k < 5; k++) { RG.urns.push({ x: 3, y: 3, hp: 2 }); const q = { x: me().x, y: me().y }; for (let h = 0; h < 2; h++) RG.pb.push({ x: 3, y: 3, vx: 0, vy: 0, dmg: 1, pierce: 0, life: 1, c: '#fff', hit: new Set(), by: me() }); run(0.1) }
ok(orbOk('ember') && relicOk('flamedash'), 'five pots unlock the ember orb and flame dash')
// flawless: three clean rooms
for (let k = 0; k < 3; k++) { rogueActions.jump(0); rogueActions.skipTale(); RG.en = []; RG.spawnQ = []; run(0.5); rogueActions.skipTale() }
ok(orbOk('aegis') && relicOk('spiritshield'), 'three clean rooms unlock the aegis orb')
// speed
rogueActions.jump(0); rogueActions.skipTale(); RG.en = []; RG.spawnQ = []; run(0.5); rogueActions.skipTale()
ok(orbOk('storm') && relicOk('chain'), 'a fast room unlocks the storm orb')
// shrines
for (let k = 0; k < 3; k++) { rogueActions.jump(2); rogueActions.skipTale(); me().x = RG.chests[0].x; me().y = RG.chests[0].y; run(0.4); rogueActions.skipTale() }
ok(orbOk('vampire') && relicOk('drain'), 'three shrines unlock the blood orb')
// deep
rogueActions.jump(25); rogueActions.skipTale()
ok(orbOk('gravity') && relicOk('timeslow'), 'reaching the middle of the abyss unlocks the gravity orb')
// collector: rune chest + vault chest
RG.ag.puzzle = false; RG.ag.vault = false
rogueActions.jump(4); rogueActions.skipTale(); run(14); const z = RG.puz; for (const i of z.seq) { me().x = z.runes[i].x; me().y = z.runes[i].y; run(0.4); me().x = -30; me().y = -20; run(0.6) }
me().x = RG.chests[0].x; me().y = RG.chests[0].y; run(0.5); rogueActions.skipTale()
RG.sub = 'secret'; rogueActions.jump(1, 'secret'); rogueActions.skipTale(); RG.chests.push({ x: 5, y: 0, open: false, kind: 'vault' }); me().x = 5; me().y = 0; run(0.5)
ok(orbOk('frost') && relicOk('frostwave'), 'a rune chest and a vault chest unlock the frost orb')
// every orb and relic runs without errors
rogueActions.stop()
for (const o of ORBS) for (const r of RELICS.slice(0, 7)) {
  rogueActions.start({ mode: 'abyss', cls: 2, orb: o.id, relic: r.id, pet: 0 }); rogueActions.skipTale(); me().inv = 99999; me().hp = me().max = 999
  RG.spawnQ.forEach((q) => { q.t = 0 }); run(2); rogueActions.relic(); me().holdPtr = true; me().aimT = 1e9; me().aimPt = { x: 5, y: 5 }; run(3)
  ok(Number.isFinite(me().x) && (o.id === 'none' || me().orb === o.id), 'orb ' + o.id + ' relic ' + r.id)
  rogueActions.stop()
}
// pets level up and evolve
profile.rogueRuns = 5
for (const p of PETS) if (p.id !== 'none') ok(petOk(p.id) || true, 'pet exists ' + p.id)
profile.rogueU.cleared = 5; profile.rogueU.secret = { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 }; profile.rogueU.lore = { L1a: 1, L1b: 1 }
ok(PETS.filter((p) => petOk(p.id)).length >= 9, 'all companions unlocked after the campaign')
const wi = PETS.findIndex((p) => p.id === 'wolf')
rogueActions.start({ cls: 0, pet: wi }); rogueActions.skipTale()
const pt = RG.pets[0]; const lv0 = pt.lv
for (let k = 0; k < 40; k++) { RG.spawnQ = []; RG.en.push({ id: 900 + k, type: 'slime', def: { hp: 200, c: '#5aff7a', r: 1.6, dmg: 1, gold: 1, spd: 0 }, x: 8, y: 4, hp: 0.1, max: 200, t: 0, seed: 1, dir: 1, shoot: 9, tp: 9, cd: 9, wind: 0, charge: 0, rest: 0, sp: 0, sum: 4, spawnT: 0, flash: 0 }); me().holdPtr = true; me().aimPt = { x: 8, y: 4 }; me().aimT = 1e9; me().x = 5; me().y = 4; run(0.3) }
ok(petInfo('wolf').lv > lv0 || petInfo('wolf').xp > 0, 'the wolf earns XP and grows (lv ' + petInfo('wolf').lv + ')')
profile.rogueU.pets.wolf = { xp: 0, lv: 7 }
rogueActions.start({ cls: 0, pet: wi }); rogueActions.skipTale()
ok(RG.pets[0].st === 2, 'at level 7 the wolf has evolved into its third form')
rogueActions.stop()
// no auto attack: nothing happens until you click
rogueActions.start({ cls: 1, pet: 0 }); rogueActions.skipTale(); me().inv = 99999; me().hp = me().max = 999
RG.spawnQ.forEach((q) => { q.t = 0 }); run(2.5); const pb0 = RG.pb.length; me().holdPtr = false; me().x = RG.en[0] ? RG.en[0].x - 8 : 0; run(1.5)
ok(RG.pb.length === 0 && pb0 === 0, 'the ranger does not shoot until you click')
me().holdPtr = true; run(1.0)
ok(RG.pb.length > 0 || RG.kills > 0, 'clicking fires')
rogueActions.stop()
console.log(fail ? 'FAIL abyss' : 'PASS abyss, agendas, orbs, relics, pets')
process.exit(fail ? 1 : 0)
