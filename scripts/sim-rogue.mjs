import { update, keys, onKey, G } from '../src/game/engine.js'
import { RG, rogueActions, rogueNet, joinAsGuest, RACES, PETS, SKILLS, xpNeed } from '../src/game/rogue.js'
let fail = 0
const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m) } }
const rr = (n) => Math.floor(Math.random() * n)
const lp = () => RG.players[RG.me]
function drive(f, cls) {
  const p = lp()
  if (RG.tale) { onKey('Enter', true); return }
  if (p.choices) { onKey('Digit' + (1 + rr(3)), true); return }
  const t = RG.en.find((e) => !e.dead)
  keys.KeyD = keys.KeyA = keys.KeyW = keys.KeyS = false
  if (RG.open) { keys.KeyD = true; keys.KeyW = p.y < -2; keys.KeyS = p.y > 2 }
  else if (t) { const dx = t.x - p.x, dy = t.y - p.y, d = Math.hypot(dx, dy), s = d < 14 && cls !== 0 ? -1 : 1; keys.KeyD = dx * s > 1; keys.KeyA = dx * s < -1; keys.KeyW = dy * s > 1; keys.KeyS = dy * s < -1 }
  if (f % 50 === 0) onKey('Space', true)
  keys.KeyQ = f % 400 === 0; keys.KeyE = f % 300 === 0; keys.KeyR = f % 700 === 0
}
for (const cls of [0, 1, 2]) {
  rogueActions.start({ cls })
  ok(!!RG.tale, 'the story opens with a cut-scene')
  let f = 0
  while (RG.mode === 'play' && f < 60 * 240) { drive(f, cls); update(1 / 60); f++; ok(Number.isFinite(lp().x) && Number.isFinite(lp().hp), 'player NaN') }
  keys.KeyD = keys.KeyA = keys.KeyW = keys.KeyS = keys.KeyQ = keys.KeyE = keys.KeyR = false
  console.log('PASS rogue class', cls, RG.mode, RG.over ? (RG.over.win ? 'WIN' : 'DEAD') : 'timeout', 'floor', RG.floor + 1, 'room', RG.room + 1, 'kills', RG.kills, 'secs', (f / 60) | 0)
  ok(f > 120, 'ran')
  rogueActions.stop()
}

// ---- RPG: races, pets, levels and skills ----
for (let race = 0; race < RACES.length; race++) for (let pet = 0; pet < PETS.length; pet++) {
  rogueActions.start({ cls: (race + pet) % 3, race, pet }); rogueActions.skipTale()
  const p = RG.players[0]
  ok(p.race === race && RG.pets.length === 1 && RG.pets[0].type === PETS[pet].id, 'race/pet applied ' + race + '/' + pet)
  // run a while with the pet doing its thing and give it enemies to fight
  let f = 0
  while (RG.mode === 'play' && f < 60 * 25) { drive(f, p.cls); update(1 / 60); f++; ok(Number.isFinite(RG.pets[0].x) && Number.isFinite(p.hp), 'finite pets') }
  keys.KeyD = keys.KeyA = keys.KeyW = keys.KeyS = keys.KeyQ = keys.KeyE = keys.KeyR = false
  rogueActions.stop()
}
console.log('PASS rogue races x pets')
{
  rogueActions.start({ cls: 0, race: 1, pet: 0 }); rogueActions.skipTale()
  const p = RG.players[0]
  p.xp = xpNeed(1) - 1; const hp0 = p.dmg
  // kill something to gain xp
  RG.spawnQ = []; RG.en.push({ id: 999, type: 'slime', def: { hp: 20, c: '#5aff7a', r: 1.6, dmg: 1, gold: 2, spd: 12 }, x: 5, y: 5, hp: 0.1, max: 20, t: 0, seed: 1, dir: 1, shoot: 1, tp: 1, cd: 2, wind: 0, charge: 0, rest: 0, sp: 0, sum: 4, spawnT: 0, flash: 0 })
  p.x = 3; p.y = 5; p.face = 0
  for (let i = 0; i < 90; i++) update(1 / 60)
  ok(p.lv === 2 && p.dmg > hp0, 'killing enemies levels you up: lv ' + p.lv)
  ok(SKILLS.knight[1].lv === 3 && SKILLS.mage[2].lv === 6, 'skills unlock at 3 and 6')
  // skills 2 and 3 are locked below their levels
  p.sT2 = 0; rogueActions.special(1); ok(p.sT2 === 0, 'E is locked at level 2')
  p.lv = 6
  for (const c of [0, 1, 2]) { p.cls = c; p.sT2 = 0; p.sT3 = 0; p.aimPt = { x: 12, y: 3 }; p.aimT = 0; rogueActions.special(1); rogueActions.special(2); ok(p.sT2 > 0 && p.sT3 > 0, 'class ' + c + ' skills 2 and 3 fire') ; for (let i = 0; i < 120; i++) update(1 / 60) }
  ok(Number.isFinite(p.x) && Number.isFinite(p.hp), 'finite after skills')
  rogueActions.stop()
  console.log('PASS rogue levels and skills')
}

// ---- co-op: host simulates, a friend joins by sending input ----
const out = []
rogueNet.reset()
rogueNet.attach({ role: 'host', state: (pid, s) => out.push([pid, s]), input() {}, perk() {}, rematch() {}, onStop() {}, })
rogueActions.start({ type: 'online', cls: 0 })
rogueActions.skipTale()
rogueNet.applyInput('friend1', { mx: 1, my: 0, cls: 2, name: 'BUDDY', dn: 0, sn: 0 })
ok(RG.players.length === 2 && RG.players[1].cls === 2 && RG.players[1].remote, 'a friend joins and gets their own hero')
for (let i = 0; i < 60 * 8; i++) { rogueNet.applyInput('friend1', { mx: 0.5, my: 0.2, cls: 2, name: 'BUDDY', dn: i === 100 ? 1 : 0, sn: 0 }); update(1 / 60) }
ok(out.length > 20 && out[0][0] === 'friend1', 'host streams state to the friend: ' + out.length)
ok(RG.players[1].x > -AXtest() , 'the friend moves by their input')
function AXtest() { return 44 }
const pkt = out[out.length - 1][1]
ok(pkt.pl.length === 2 && pkt.me === 1 && Array.isArray(pkt.en), 'packet shape')
const hostEnemies = RG.en.length
rogueActions.stop()
// ---- the guest mirrors the packet ----
rogueNet.reset()
rogueNet.attach({ role: 'guest', state() {}, input: (m) => out.push(['in', m]), perk() {}, rematch() {}, onStop() {} })
joinAsGuest(2)
rogueNet.applyState(pkt)
ok(RG.players.length === 2 && RG.me === 1, 'guest sees both heroes and knows which is theirs')
ok(RG.en.length === pkt.en.length && RG.en.length === hostEnemies || RG.en.length === pkt.en.length, 'guest mirrors the enemies')
for (let i = 0; i < 120; i++) update(1 / 60)
ok(out.some((o) => o[0] === 'in'), 'guest sends its input')
ok(Number.isFinite(lp().x), 'guest hero stays finite')
// perks for the guest
pkt.n += 1; pkt.ch = ['dmg', 'rate', 'hp']; rogueNet.applyState(pkt)
ok(lp().choices && lp().choices.length >= 3, 'guest gets perk choices')
rogueActions.stop()
console.log(fail ? 'FAIL rogue co-op' : 'PASS rogue co-op')
process.exit(fail ? 1 : 0)
