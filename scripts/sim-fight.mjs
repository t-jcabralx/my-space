import { update, G, games, keys } from '../src/game/engine.js'
import { FT, fightActions } from '../src/game/fight.js'
import { ROSTER, STYLES, ELEMENTS } from '../src/game/roster.js'
let failures = 0
const check = (n, c, i) => { if (!c) failures++; console.log(c ? 'PASS' : 'FAIL', n, i || '') }
let n3 = 0
const api = { put: () => {}, put3: (...a) => { n3++; if (a.some((v) => !Number.isFinite(v))) throw new Error('NaN in put3: ' + a.join(',')) }, text: () => [], sprite: () => {}, pops: () => {} }
const step = (n, dt = 1 / 60, draw = false) => { for (let i = 0; i < n; i++) { update(dt); G.time += dt; if (draw && i % 6 === 0) { games.fight.draw(api); games.fight.draw3(api); games.fight.camera(1.7, 0.016) } } }
const insane = () => FT.f.map((f) => `${f.ch.name} x=${f.x} y=${f.y} hp=${f.hp} m=${f.meter} st=${f.st}`).join(' | ')
const calm = () => FT.f.forEach((f) => { f.inp = { dx: 0, up: false, down: false }; f.vx = 0; f.vy = 0; f.y = 0; f.aiT = 99; f.aiBlock = 0; f.aiReact = null; f.st = 'idle'; f.atk = null; f.stun = 0; f.buf = null; f.crouch = false; f.spCd = 0; f.armor = false; f.vis = 1; f.held = null })
const sane = () => FT.f.every((f) => Number.isFinite(f.x) && Number.isFinite(f.y) && Number.isFinite(f.hp) && f.hp >= 0 && f.hp <= f.maxHp && f.meter >= 0 && f.meter <= 100 && Math.abs(f.x) <= 41.01)

// ---- roster ----
check('3D rig draws parts with finite numbers', (() => { fightActions.start({ type: 'demo', p1: 0, p2: 1 }); step(30, 1 / 60, true); return n3 > 50 })(), 'put3 calls ' + n3)
check('40 fighters', ROSTER.length === 40)
check('10 styles x 4 elements', Object.keys(STYLES).length === 10 && Object.keys(ELEMENTS).length === 4)
check('unique fighter names', new Set(ROSTER.map((c) => c.name)).size === 40)
check('unique special names', new Set(ROSTER.map((c) => c.special.name)).size === 40)
check('unique super names', new Set(ROSTER.map((c) => c.super.name)).size === 40)
check('every fighter has special + super with damage', ROSTER.every((c) => c.special.dmg > 0 && c.super.dmg > 0 && c.special.cd > 0))

// ---- every fighter's special and super work ----
const mechs = new Set()
let bad = []
for (const c of ROSTER) {
  fightActions.start({ type: 'demo', p1: c.id, p2: (c.id + 11) % 40, diff: 1 })
  // keep the bots from interfering: freeze the AI by making them idle
  step(60 * 2.2) // intro
  const [a, b] = FT.f
  calm()
  b.x = a.x + (c.special.mech === 'grab' ? 6 : c.special.mech === 'rise' ? 5 : 12); b.hp = b.maxHp = 400; b.inv = 0
  const sp0 = FT.stats.specials
  fightActions.press(0, 'sp')
  const startedSp = FT.stats.specials === sp0 + 1
  step(60 * 2.4, 1 / 60, true)
  mechs.add(c.special.mech); mechs.add(c.super.mech)
  if (!startedSp) bad.push(c.name + ': special did not start')
  if (!sane()) bad.push(c.name + ': insane state after special')
  // super
  a.meter = 100; b.hp = b.maxHp = 400; b.x = a.x + 10; b.st = 'idle'; b.inv = 0; a.st = 'idle'; a.atk = null; b.atk = null; calm()
  const su0 = FT.stats.supers
  fightActions.press(0, 'su')
  const started = FT.stats.supers === su0 + 1 && !!FT.cine
  step(60 * 4, 1 / 60, true)
  if (!started) bad.push(c.name + ': super did not start')
  if (!sane()) bad.push(c.name + ': insane state after super')
}
check('all 40 specials and supers start cleanly', bad.length === 0, bad.slice(0, 6).join(' | '))
check('all 13 move mechanics exercised', ['rise', 'ball', 'beam', 'fist', 'lunge', 'dive', 'spin', 'quake', 'tele', 'grab', 'flurry', 'tornado', 'volley'].every((m) => mechs.has(m)), [...mechs].join(','))

// ---- damage actually lands ----
{
  let landed = 0, dmgs = []
  for (const c of ROSTER) {
    fightActions.start({ type: 'demo', p1: c.id, p2: (c.id + 5) % 40, diff: 1 })
    step(60 * 2.2)
    const [a, b] = FT.f
    calm()
    b.x = a.x + (c.special.mech === 'grab' ? 6 : c.special.mech === 'rise' ? 5 : c.special.mech === 'tele' ? 20 : 12); b.hp = b.maxHp = 500; b.inv = 0; b.counterT = 0; b.burn = null; b.slowT = 0
    fightActions.press(0, 'sp')
    if (c.special.mech === 'counter') { step(10); b.x = a.x + 5; fightActions.press(1, 'hp') } // a counter only works when the opponent attacks
    step(60 * 3)
    const d1 = 500 - b.hp
    a.meter = 100; b.x = a.x + 9; b.hp = b.maxHp = 500; b.st = 'idle'; b.inv = 0; a.st = 'idle'; a.atk = null; calm()
    fightActions.press(0, 'su'); step(60 * 5)
    const d2 = 500 - b.hp
    dmgs.push([c.name, d1, d2])
    if (d1 > 0 && d2 > 0) landed++
  }
  const noSp = dmgs.filter((d) => d[1] <= 0).map((d) => d[0]), noSu = dmgs.filter((d) => d[2] <= 0).map((d) => d[0])
  check('specials damage the opponent (at point-blank spacing)', noSp.length <= 4, 'no damage: ' + noSp.join(','))
  check('supers damage the opponent', noSu.length === 0, 'no damage: ' + noSu.join(','))
  check('supers hit harder than specials', dmgs.filter((d) => d[2] > d[1]).length >= 30)
}

// ---- normal moves, blocking and combos ----
{
  fightActions.start({ type: 'demo', p1: 0, p2: 1, diff: 1 }); step(60 * 2.2)
  const [a, b] = FT.f; calm()
  b.x = a.x + 7; b.hp = b.maxHp = 200
  for (const k of ['lp', 'hp', 'lk', 'hk']) { fightActions.press(0, k); step(40); b.st = 'idle'; b.stun = 0; b.x = a.x + 7 }
  check('light and heavy punches/kicks connect', b.hp < 200 - 15, 'hp ' + b.hp)
  const hp1 = b.hp
  b.st = 'idle'; b.block = true; b.crouch = false; b.inp = { dx: 1, up: false, down: false }
  for (let i = 0; i < 10; i++) { b.inp = { dx: 1, up: false, down: false }; b.aiT = 99; fightActions.press(0, 'lp'); step(25) ; b.x = a.x + 7 }
  check('holding back blocks (almost no damage taken)', hp1 - b.hp < 6, 'lost ' + (hp1 - b.hp).toFixed(1))
}

// ---- full AI vs AI matches always finish ----
{
  let finished = 0, nonsane = 0, longest = 0
  for (let m = 0; m < 12; m++) {
    fightActions.start({ type: 'demo', p1: Math.floor(Math.random() * 40), p2: Math.floor(Math.random() * 40), diff: 1 + (m % 3) })
    let t = 0
    while (FT.mode !== 'over' && t < 60 * 60 * 10) { step(60, 1 / 60); t += 60; if (!sane()) { nonsane++; console.log('INSANE', insane()); break } }
    longest = Math.max(longest, t / 60)
    if (FT.mode === 'over') finished++
  }
  check('AI vs AI matches finish (best of 3)', finished === 12 && nonsane === 0, `finished ${finished}/12, longest ${longest | 0}s`)
}
process.exit(failures ? 1 : 0)
