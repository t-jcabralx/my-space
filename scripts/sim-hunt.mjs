import { update, G, games } from '../src/game/engine.js'
import { HT, huntActions, MONS, SHOP, AW, AH, worldNear } from '../src/game/hunt.js'
let failures = 0
const check = (n, c, i) => { if (!c) failures++; console.log(c ? 'PASS' : 'FAIL', n, i || '') }
const api = { put3: (...a) => { if (a.slice(0, 10).some((v) => !Number.isFinite(v))) throw new Error('NaN put3 ' + a) }, putS: (...a) => { if (a.slice(0, 9).some((v) => !Number.isFinite(v))) throw new Error('NaN putS ' + a) }, putM: (...a) => { if (a.slice(0, 6).some((v) => !Number.isFinite(v))) throw new Error('NaN putM') } }
const step = (n, dt = 1 / 20) => { for (let i = 0; i < n; i++) { update(dt); G.time += dt } }
const sane = () => HT.players.every((p) => Number.isFinite(p.x) && Math.abs(p.x) <= AW + 1 && Math.abs(p.y) <= AH + 1 && p.hp <= p.max) && HT.mons.every((m) => Number.isFinite(m.x) && Number.isFinite(m.hp))
// a bot hunter: shoots the nearest monster, backs away, reloads
function bot(p) {
  let best = null, bd = 1e9
  for (const m of HT.mons) { const d = Math.hypot(m.x - p.x, m.y - p.y); if (d < bd) { bd = d; best = m } }
  const T = ['left', 'right', 'up', 'down']
  if (best) { HT.mouse.x = best.x; HT.mouse.y = best.y; HT.mouse.down = true; const a = Math.atan2(best.y - p.y, best.x - p.x), away = bd < 9, toward = bd > 15; huntActions.press('left', (away && Math.cos(a) > 0.3) || (toward && Math.cos(a) < -0.3)); huntActions.press('right', (away && Math.cos(a) < -0.3) || (toward && Math.cos(a) > 0.3)); huntActions.press('down', (away && Math.sin(a) > 0.3) || (toward && Math.sin(a) < -0.3)); huntActions.press('up', (away && Math.sin(a) < -0.3) || (toward && Math.sin(a) > 0.3)) }
  else { HT.mouse.down = false; for (const k of T) huntActions.press(k, false) }
  huntActions.press('reload', p.mag === 0)
}
const reset = () => { for (const k of ['left', 'right', 'up', 'down', 'reload']) huntActions.press(k, false); HT.mouse.down = false }
check('monsters and shop exist', Object.keys(MONS).length === 7 && SHOP.length === 10)
// a full day cycle: night, dawn, shop
huntActions.start({ kind: 'days', seed: 7 })
check('day 1 starts at dawn with a shop', HT.phase === 'dawn' && HT.day === 1)
huntActions.ready(); step(3)
check('readying up starts the night', HT.phase === 'night' && HT.spawnQ.length > 0, HT.phase)
let f = 0, bad = false
const p0 = HT.players[0]
p0.hp = p0.max = 100000; p0.reserve = 9999
while (HT.phase === 'night' && f < 20 * 200) { bot(p0); step(1); f++; if (f % 20 === 0) { if (!sane()) { bad = true; break } games.hunt.draw3(api) } }
check('the bot survives night 1 and the dawn comes', !bad && HT.phase === 'dawn' && HT.day === 2, `phase ${HT.phase} day ${HT.day} kills ${HT.kills}`)
check('kills drop scrap and the dawn pays a bonus', p0.scrap > 40, 'scrap ' + p0.scrap)
const sc = p0.scrap, dmg0 = p0.up.dmg
huntActions.buy('dmg')
check('buying an upgrade costs scrap and works', p0.up.dmg === dmg0 + 1 && p0.scrap < sc)
p0.scrap = 200; huntActions.buy('mines'); check('mines can be bought', p0.mines >= 4)
// stalkers: sprint when unseen, creep when lit, hit harder from behind
{
  reset(); huntActions.start({ kind: 'back', seed: 3 })
  const p = HT.players[0]; p.hp = p.max = 1000; p.a = 0; p.x = 0; p.y = 0
  HT.spawnQ = []; HT.rate = 999
  HT.mons = [{ id: 1, type: 'stalker', x: -20, y: 0, hp: 48, max: 48, a: 0, atkT: 0, hit: 0, t: 0, spitT: 9, sumT: 9, charge: 0, vx: 0, vy: 0, seen: 0 }]
  p.in.a = 0; HT.mouse.x = 100; HT.mouse.y = 0
  const x0 = HT.mons[0].x; step(10); const behindMove = HT.mons[0].x - x0
  HT.mons = [{ id: 2, type: 'stalker', x: 14, y: 0, hp: 48, max: 48, a: 0, atkT: 0, hit: 0, t: 0, spitT: 9, sumT: 9, charge: 0, vx: 0, vy: 0, seen: 0 }]
  const x1 = HT.mons[0].x; p.in.fire = false; step(10); const litMove = x1 - HT.mons[0].x
  check('a stalker behind you sprints; one in your beam creeps', behindMove > litMove * 2.5, `behind ${behindMove.toFixed(1)} lit ${litMove.toFixed(1)}`)
  HT.mons = [{ id: 3, type: 'stalker', x: -2, y: 0, hp: 48, max: 48, a: 0, atkT: 0, hit: 0, t: 0, spitT: 9, sumT: 9, charge: 0, vx: 0, vy: 0, seen: 0 }]
  const hp0 = p.hp; step(2)
  check('a bite from behind does double damage', hp0 - p.hp >= 30, 'lost ' + (hp0 - p.hp).toFixed(0))
}
// weapons, crates and the new monsters
{
  reset(); huntActions.start({ kind: 'back', seed: 11 })
  const p = HT.players[0]; HT.spawnQ = []; HT.rate = 999; HT.phase = 'night'
  const around = []; for (let x = -240; x <= 240; x += 48) for (let y = -240; y <= 240; y += 48) around.push(...worldNear(x, y, 0))
  check('the world is huge and full of things to find', AW >= 4000 && AH >= 2400 && around.filter((o) => o.crate).length >= 15 && around.some((o) => o.tomb) && around.some((o) => o.tower) && around.length > 150, `obstacles near the cabin ${around.length}`)
  worldNear(30, 30).forEach((o) => { if (!o.crate && Math.hypot(o.x - 30, o.y - 30) < 25) o.dead = true })
  p.x = 30; p.y = 30; p.up.shotgun = 1; p.wp = 'shotgun'; p.mag = 6; p.mags.shotgun = 6; p.a = 0; HT.mouse.sx = undefined; HT.mouse.x = 99; HT.mouse.y = 30; HT.mouse.down = true
  const b0 = HT.bul.length; step(1); HT.mouse.down = false
  check('the shotgun fires a spread of pellets', HT.bul.length - b0 >= 5, 'bullets ' + HT.bul.length)
  const cr = around.find((o) => o.crate && !o.dead); worldNear(cr.x, cr.y).forEach((o) => { if (o !== cr && Math.hypot(o.x - cr.x, o.y - cr.y) < 16) o.dead = true }); p.x = cr.x - 12; p.y = cr.y; p.wp = 'rifle'; p.mag = 12; p.a = 0; HT.mouse.x = cr.x; HT.mouse.y = cr.y; HT.mouse.down = true; step(20 * 4); HT.mouse.down = false
  check('crates can be shot open for loot', cr.dead && HT.pick.length >= 2, 'dead ' + cr.dead + ' pickups ' + HT.pick.length)
  worldNear(p.x, p.y, 2).forEach((o) => { if (!o.crate && Math.hypot(o.x - p.x, o.y - p.y) < 70) o.dead = true })
  HT.mons = [{ id: 50, type: 'wraith', x: p.x + 40, y: p.y, hp: 38, max: 38, a: 0, atkT: 0, hit: 0, t: 0, spitT: 9, sumT: 9, charge: 0, vx: 0, vy: 0, seen: 0, blink: 0.1 }]
  const wx = HT.mons[0].x; step(10)
  check('a wraith blinks toward you', wx - HT.mons[0].x > 12, 'moved ' + (wx - HT.mons[0].x).toFixed(1))
  HT.mons = [{ id: 51, type: 'howler', x: p.x + 20, y: p.y, hp: 80, max: 80, a: 0, atkT: 0, hit: 0, t: 0, spitT: 9, sumT: 0.1, charge: 0, vx: 0, vy: 0, seen: 0 }, { id: 52, type: 'crawler', x: p.x + 50, y: p.y, hp: 30, max: 30, a: 0, atkT: 0, hit: 0, t: 0, spitT: 9, sumT: 9, charge: 0, vx: 0, vy: 0, seen: 0 }]
  step(6)
  check('a howler screams and enrages nearby monsters', HT.mons.some((m) => m.rage > 0 || m.type === 'crawler' && m.x < p.x + 50 - 20))
}
// review fixes: one-shot input is not saved for later, a player who left stays gone
{
  reset(); huntActions.start({ kind: 'days', seed: 12 }); const p = HT.players[0]
  p.in.reload = true; p.mag = 12; step(2)
  check('a reload request with a full magazine is dropped, not saved', p.in.reload === false && p.reload <= 0)
  HT.players.push({ ...HT.players[0], i: 1, name: 'GONE', x: 20, y: 12, in: { dx: 1, dy: 0, a: 0, fire: true }, up: { dmg: 0, rate: 0, hp: 0, light: 0, speed: 0, shotgun: 0, smg: 0 }, mags: { rifle: 12, shotgun: 0, smg: 0 } })
  HT.players[1].down = true; HT.players[1].hp = 0; HT.players[1].gone = true
  HT.phase = 'night'; HT.spawnQ = []; HT.mons = [{ id: 5, type: 'crawler', x: 400, y: 400, hp: 1, max: 1, a: 0, atkT: 0, hit: 0, t: 0, spitT: 9, sumT: 9, charge: 0, vx: 0, vy: 0, seen: 0 }]
  HT.phaseT = 10; HT.mons[0].hp = 0; HT.mons = []; step(40)
  check('a departed hunter is not revived at dawn and does not keep walking', HT.players[1].down === true && Math.abs(HT.players[1].x - 20) < 0.5, 'x ' + HT.players[1].x)
}
// down, revive and game over
{
  reset(); huntActions.start({ kind: 'days', seed: 5 })
  HT.players.push({ ...HT.players[0], i: 1, name: 'MATE', x: 20, y: 12, in: { dx: 0, dy: 0, a: 0, fire: false }, up: { dmg: 0, rate: 0, hp: 0, light: 0, speed: 0 } })
  HT.players[0].down = true; HT.players[0].hp = 0; HT.players[1].x = 21; HT.players[1].y = 12; HT.players[0].x = 20; HT.players[0].y = 12
  step(20 * 4)
  check('a teammate standing close revives a downed hunter', !HT.players[0].down && HT.players[0].hp > 0, 'down ' + HT.players[0].down)
  HT.players.forEach((p) => { p.down = true; p.hp = 0 }); step(5)
  check('everybody down ends the run with a result', HT.mode === 'over' && HT.over && !HT.over.win)
}
// the finale: night 13 spawns the king, clearing it wins
{
  reset(); huntActions.start({ kind: 'days', seed: 9 }); HT.day = 13; HT.players[0].hp = HT.players[0].max = 1e6; HT.players[0].reserve = 99999
  huntActions.ready(); step(3)
  check('night 13 has the Hollow King', HT.spawnQ.some((q) => q.type === 'king'))
  let n = 0; while (HT.mode === 'play' && n < 20 * 400) { for (const q of HT.spawnQ) q.t = Math.min(q.t, HT.phaseT); bot(HT.players[0]); for (const m of HT.mons) m.hp = Math.min(m.hp, 40); step(1); n++ }
  check('beating night 13 wins the 13 days', HT.mode === 'over' && HT.over && HT.over.win, `mode ${HT.mode} t ${n / 20 | 0}s left ${HT.mons.map((m) => m.type + '@' + (m.x | 0) + ',' + (m.y | 0)).join(' ')} q ${HT.spawnQ.length} hp ${HT.players[0].hp | 0} phase ${HT.phase}`)
}
for (const k of ['left', 'right', 'up', 'down', 'reload']) huntActions.press(k, false); HT.mouse.down = false
huntActions.stop()
process.exit(failures ? 1 : 0)
