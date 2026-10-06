// IRON FISTS: a 2.5D-style 1v1 fighting game with 40 fighters. Light/heavy punches and kicks, crouching and jumping moves,
// blocking, combos, a signature SPECIAL and a cinematic SUPER per fighter. Pure JS; drawn with voxel cubes through Scene.jsx.
import { G, keys, games, profile, saveProfile, part, ring, shake, flash, popup, stepParticles, toMenu } from './engine.js'
import { rgb } from './sprites.js'
import { sfx, music, speak } from './audio.js'
import { ROSTER, ELEMENTS, rosterById } from './roster.js'

const R = (a, b) => a + Math.random() * (b - a)
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
const FLOOR = -12, XMAX = 41, GRAV = 118, JUMP = 38, ROUND_TIME = 60
const DIFF = [
  { name: 'EASY', react: 0.5, block: 0.22, aggr: 0.3, think: 0.5, sup: 0.004 },
  { name: 'MEDIUM', react: 0.3, block: 0.5, aggr: 0.55, think: 0.3, sup: 0.01 },
  { name: 'HARD', react: 0.14, block: 0.8, aggr: 0.8, think: 0.16, sup: 0.025 },
]

// ---------- normal moves ----------
// su = startup, ac = active, rc = recovery (seconds). lvl: high / mid / low. y = hit height above the feet.
const MOVES = {
  lp:  { name: 'JAB',        su: 0.07, ac: 0.06, rc: 0.12, dmg: 4,  hs: 0.26, bs: 0.13, kb: 3,  reach: 7.8,  y: 9.4, hh: 2.6, lvl: 'high', limb: 'rh', sfx: 'fPunch' },
  hp:  { name: 'STRAIGHT',   su: 0.14, ac: 0.07, rc: 0.22, dmg: 8,  hs: 0.34, bs: 0.18, kb: 6,  reach: 9.0,  y: 9.2, hh: 2.8, lvl: 'mid',  limb: 'lh', sfx: 'fHeavy' },
  lk:  { name: 'FRONT KICK', su: 0.10, ac: 0.07, rc: 0.18, dmg: 6,  hs: 0.30, bs: 0.15, kb: 4,  reach: 10.0, y: 5.5, hh: 2.6, lvl: 'mid',  limb: 'rf', sfx: 'fKick' },
  hk:  { name: 'ROUNDHOUSE', su: 0.19, ac: 0.08, rc: 0.30, dmg: 11, hs: 0.42, bs: 0.22, kb: 10, reach: 11.0, y: 9.0, hh: 3.2, lvl: 'high', limb: 'lf', sfx: 'fHeavy', knock: true },
  clp: { name: 'LOW JAB',    su: 0.08, ac: 0.06, rc: 0.13, dmg: 3,  hs: 0.24, bs: 0.12, kb: 2,  reach: 7.0,  y: 4.4, hh: 2.2, lvl: 'mid',  limb: 'rh', sfx: 'fPunch' },
  chp: { name: 'UPPERCUT',   su: 0.14, ac: 0.08, rc: 0.26, dmg: 9,  hs: 0.4,  bs: 0.2,  kb: 3,  reach: 6.2,  y: 9.5, hh: 4.2, lvl: 'mid',  limb: 'lh', sfx: 'fHeavy', launch: true },
  clk: { name: 'LOW KICK',   su: 0.11, ac: 0.06, rc: 0.17, dmg: 4,  hs: 0.26, bs: 0.13, kb: 3,  reach: 9.0,  y: 1.4, hh: 1.8, lvl: 'low',  limb: 'rf', sfx: 'fKick' },
  chk: { name: 'SWEEP',      su: 0.2,  ac: 0.08, rc: 0.34, dmg: 8,  hs: 0.5,  bs: 0.2,  kb: 6,  reach: 10.5, y: 1.2, hh: 1.8, lvl: 'low',  limb: 'lf', sfx: 'fKick', knock: true },
  ap:  { name: 'AIR PUNCH',  su: 0.08, ac: 0.16, rc: 0.1,  dmg: 6,  hs: 0.32, bs: 0.16, kb: 4,  reach: 7.5,  y: 6.0, hh: 3.2, lvl: 'high', limb: 'rh', sfx: 'fPunch', air: true },
  ak:  { name: 'AIR KICK',   su: 0.1,  ac: 0.2,  rc: 0.1,  dmg: 8,  hs: 0.36, bs: 0.18, kb: 6,  reach: 9.0,  y: 3.0, hh: 3.2, lvl: 'high', limb: 'rf', sfx: 'fKick', air: true },
}
const BTN_CODES = [
  { lp: 'KeyJ', hp: 'KeyK', lk: 'KeyU', hk: 'KeyI', sp: 'KeyL', su: 'KeyO' },
  { lp: 'KeyN', hp: 'KeyM', lk: 'Comma', hk: 'Period', sp: 'Slash', su: 'ShiftRight' },
]
const DIRS = [
  { l: ['KeyA'], r: ['KeyD'], u: ['KeyW'], d: ['KeyS'] },
  { l: ['ArrowLeft'], r: ['ArrowRight'], u: ['ArrowUp'], d: ['ArrowDown'] },
]

// ---------- state ----------
export const FT = { mode: 'idle', paused: false, phase: 'select', cfg: { type: 'cpu', diff: 2, rounds: 2, p1: 0, p2: 1, stage: 0 }, f: [], proj: [], t: 0, phaseT: 0, round: 1, wins: [0, 0], timer: ROUND_TIME, stop: 0, slow: 1, cine: null, say: null, over: null, emitT: 0, msg: null, hits: 0, stats: {} }
let snap = null
const subs = new Set()
export const subscribeFight = (f) => { subs.add(f); return () => subs.delete(f) }
export const getFightSnap = () => snap
function emitFt() {
  const c = FT.f.map((f) => ({
    id: f.id, name: f.ch.name, style: f.ch.styleName, element: f.ch.element, color: ELEMENTS[f.ch.element].color, human: f.human,
    hp: Math.max(0, Math.round(f.hp)), max: f.maxHp, meter: Math.round(f.meter), spCd: +f.spCd.toFixed(1), spMax: f.ch.special.cd, combo: f.hitsDealt > 1 ? f.hitsDealt : 0, sp: f.ch.special.name, su: f.ch.super.name,
  }))
  snap = {
    mode: FT.mode, paused: FT.paused, phase: FT.phase, type: FT.cfg.type, diff: DIFF[FT.cfg.diff - 1].name, round: FT.round, rounds: FT.cfg.rounds, wins: FT.wins.slice(), timer: Math.max(0, Math.ceil(FT.timer)),
    f: c, say: FT.say ? { ...FT.say } : null, msg: FT.msg ? { ...FT.msg } : null, cine: FT.cine ? { name: FT.cine.name, color: FT.cine.color, owner: FT.cine.owner } : null, over: FT.over,
  }
  subs.forEach((fn) => fn())
}
const say = (text, color = '#fff', t = 1.1) => { FT.say = { id: ++G.uid, text, color, t } }

// ---------- fighters ----------
function mkFighter(id, chId, human) {
  const ch = rosterById(chId)
  return {
    id, ch, human, x: id === 0 ? -16 : 16, y: 0, vx: 0, vy: 0, face: id === 0 ? 1 : -1, hp: ch.hp, maxHp: ch.hp, meter: 0, st: 'idle', t: 0, atk: null, stun: 0, inv: 0, armor: false, crouch: false, block: false,
    combo: 0, hitsDealt: 0, comboT: 0, spCd: 0, buf: null, inp: { dx: 0, up: false, down: false }, aiT: 0, aiBlock: 0, aiPlan: null, flash: 0, vis: 1, lastLimb: 0, held: null, airAtk: false, lean: 0, dizzy: 0,
  }
}
function start(cfg = {}) {
  FT.cfg = { type: 'cpu', diff: 2, rounds: 2, p1: 0, p2: 1, stage: 0, ...cfg }
  const c = FT.cfg
  const pick = (v) => (v === 'random' || v == null ? Math.floor(Math.random() * ROSTER.length) : v)
  c.p1 = pick(c.p1); c.p2 = pick(c.p2)
  if (c.p2 === c.p1 && c.type !== '2p') c.p2 = (c.p2 + 7) % ROSTER.length
  c.stage = ['fire', 'ice', 'thunder', 'shadow'].indexOf(ROSTER[c.p2].element)
  if (c.type !== 'online') FT.net = null
  FT.f = [mkFighter(0, c.p1, c.type === 'demo' ? 0 : 1), mkFighter(1, c.p2, c.type === '2p' ? 2 : 0)]
  if (c.type === 'online') { FT.f[0].human = FT.net && FT.net.role === 'host' ? 1 : 0; FT.f[1].human = 0; FT.f[1].remote = !!(FT.net && FT.net.role === 'host'); FT.f[0].remote = !!(FT.net && FT.net.role === 'guest') }
  FT.wins = [0, 0]; FT.round = 1; FT.over = null; FT.paused = false; FT.say = null; FT.cine = null; FT.stats = { hits: 0, specials: 0, supers: 0, blocked: 0, maxCombo: 0 }
  G.mode = 'fight'; G.parts = []; G.pops = []; G.shake = 0; G.flash = 0
  FT.mode = 'play'
  music.set('fight', 0)
  newRound(); sfx('mission'); emitFt()
}
function stop() { if (FT.net) { const n = FT.net; FT.net = null; if (n.onStop) try { n.onStop() } catch { /* ignore */ } } FT.mode = 'idle'; FT.paused = false; music.set('menu'); emitFt() }
function newRound() {
  FT.f.forEach((f, i) => {
    Object.assign(f, { x: i === 0 ? -16 : 16, y: 0, vx: 0, vy: 0, face: i === 0 ? 1 : -1, hp: f.maxHp, st: 'idle', t: 0, atk: null, stun: 0, inv: 0, armor: false, crouch: false, block: false, combo: 0, hitsDealt: 0, comboT: 0, spCd: 0, buf: null, flash: 0, vis: 1, held: null, airAtk: false, lean: 0, dizzy: 0, aiPlan: null })
  })
  FT.proj = []; FT.timer = ROUND_TIME; FT.stop = 0; FT.slow = 1; FT.cine = null; FT.phase = 'intro'; FT.phaseT = 0; FT.msg = { text: `ROUND ${FT.round}`, sub: `${FT.f[0].ch.name}  VS  ${FT.f[1].ch.name}`, color: '#ffe84a', t: 1.6 }
  G.parts = []; sfx('fRound')
}

// ---------- attacks ----------
const hurtBox = (f) => {
  const w = 2.6 * f.ch.w, top = (f.crouch || f.st === 'crouch' ? 8 : 14.4) * f.ch.h
  return { x0: f.x - w, x1: f.x + w, y0: f.y, y1: f.y + (f.st === 'down' || f.st === 'ko' ? 3 : top) }
}
function fx(att, k = 1) { return att.x + att.face * k }
function startNormal(f, btn) {
  const air = f.y > 0.6
  let id = btn
  if (air) id = btn === 'lp' || btn === 'hp' ? 'ap' : 'ak'
  else if (f.crouch) id = 'c' + btn
  const base = MOVES[id]
  if (!base) return false
  if (air && f.airAtk) return false
  const ch = f.ch
  const m = { ...base, su: base.su / ch.spd, rc: base.rc / ch.spd, dmg: base.dmg * ch.pow, reach: base.reach * ch.reach }
  const limb = m.limb
  f.atk = { m, name: m.name, t: 0, dur: m.su + m.ac + m.rc, limb, frames: [{ t0: m.su, t1: m.su + m.ac, dmg: m.dmg, hs: m.hs, bs: m.bs, kb: m.kb, reach: m.reach, y: m.y, hh: m.hh, lvl: m.lvl, launch: !!m.launch, knock: !!m.knock, sfx: m.sfx, done: false }], on: [], normal: true }
  if (air) f.airAtk = true
  else f.vx = 0
  f.st = 'attack'; f.t = 0
  sfx(btn === 'lk' || btn === 'hk' ? 'fWhiff' : 'fWhiff')
  return true
}
function build(f, spec, isSuper) {
  const ch = f.ch, el = ELEMENTS[ch.element], d = spec.dmg
  const o = FT.f[1 - f.id]
  const A = { name: spec.name, t: 0, mech: spec.mech, frames: [], on: [], limb: 'rh', super: isSuper, color: el.color, glow: el.glow, inv: 0, armor: false, vel: null }
  const spawn = (t, extra) => A.on.push({ t, fn: () => spawnProj(f, { dmg: d, color: el.color, glow: el.glow, ...extra }) })
  switch (spec.mech) {
    case 'rise':
      A.dur = 0.8; A.limb = 'rh'; A.inv = isSuper ? 0 : 0.3; A.pose = 'rise'
      A.frames.push({ t0: 0.1, t1: 0.42, dmg: d, hs: 0.7, bs: 0.3, kb: 4, reach: 6.5, y: 10, hh: 6.5, lvl: 'mid', launch: true, sfx: 'fRise', done: false })
      A.on.push({ t: 0.08, fn: () => { f.vy = 38; f.vx = f.face * 4; sfx('fRise'); ring(f.x, f.y + 4, 12, 30, [rgb(el.color), rgb(el.glow)]) } })
      break
    case 'ball':
      A.dur = 0.62; A.pose = 'cast'
      spawn(0.24, { kind: 'ball', vx: 34, y: 9, r: 2.4, life: 3, hs: 0.45, bs: 0.2, sfx: 'fFire' })
      A.on.push({ t: 0.24, fn: () => sfx('fFire') })
      break
    case 'beam':
      A.pose = 'cast'
      if (isSuper && spec.big) { // mystic: screen-wide beam that keeps hitting
        A.dur = 1.9
        A.on.push({ t: 0.3, fn: () => { spawnProj(f, { dmg: d / spec.hits, kind: 'megabeam', y: 9, life: 1.2, hs: 0.5, bs: 0.2, tick: 0.18, fixed: true, color: el.color, glow: el.glow, final: true }); sfx('fBeam'); shake(1.5) } })
      } else if (isSuper) { // karate dragon wave: three big pulses
        A.dur = 1.3
        for (let k = 0; k < 3; k++) A.on.push({ t: 0.3 + k * 0.28, fn: () => { spawnProj(f, { dmg: d / 3, kind: 'wave', vx: 44, y: 8, r: 4.2, life: 2.4, hs: 0.4, bs: 0.2, color: el.color, glow: el.glow, pierce: true, launch: k === 2 }); sfx('fBeam'); shake(0.7) } })
      } else { // fast thin beam
        A.dur = 0.55
        A.on.push({ t: 0.18, fn: () => { spawnProj(f, { dmg: d, kind: 'beam', vx: 78, y: 9.4, r: 1.3, life: 1.6, hs: 0.4, bs: 0.18, color: el.color, glow: el.glow }); sfx('fBeam') } })
      }
      break
    case 'fist':
      A.dur = 0.7; A.pose = 'cast'
      A.on.push({ t: 0.22, fn: () => { spawnProj(f, { dmg: d, kind: 'fist', vx: 50, y: 9.4, r: 2, life: 1.6, hs: 0.5, bs: 0.22, color: el.color, glow: el.glow }); sfx('fFire') } })
      break
    case 'volley':
      A.dur = 1.5; A.pose = 'cast'
      for (let k = 0; k < spec.hits; k++) A.on.push({ t: 0.3 + k * 0.17, fn: () => { spawnProj(f, { dmg: d / spec.hits, kind: 'laser', vx: 80, y: 6 + k * 1.6, r: 1.2, life: 1.2, hs: 0.35, bs: 0.15, color: el.color, glow: el.glow, launch: k === spec.hits - 1 }); sfx('fBeam') } })
      break
    case 'lunge': {
      const sumo = ch.style === 'sumo', big = isSuper
      A.dur = big ? 1.2 : 0.8; A.pose = ch.style === 'muay' ? 'knee' : 'lunge'; A.armor = sumo || big
      const t0 = big ? 0.35 : 0.2
      A.vel = (t) => (t > t0 && t < t0 + (big ? 0.36 : 0.3) ? f.face * (big ? 68 : sumo ? 34 : 44) : t < t0 ? 0 : null)
      A.frames.push({ t0, t1: t0 + (big ? 0.36 : 0.3), dmg: d, hs: big ? 0.8 : 0.5, bs: 0.26, kb: big ? 14 : 8, reach: big ? 9 : 8, y: 8, hh: 4.5, lvl: 'mid', launch: big, sfx: 'fSlam', done: false })
      if (big) A.on.push({ t: t0 + 0.36, fn: () => { ring(f.x + f.face * 6, FLOOR + 2, 40, 70, [rgb(el.color), rgb(el.glow)]); shake(2.2); sfx('fSlam') } })
      break
    }
    case 'dive':
      A.dur = 0.85; A.pose = 'dive'
      A.on.push({ t: 0.1, fn: () => { f.vy = 22; f.vx = f.face * 36; sfx('fDash') } })
      A.frames.push({ t0: 0.2, t1: 0.7, dmg: d, hs: 0.55, bs: 0.25, kb: 8, reach: 8, y: 3.5, hh: 4, lvl: 'high', launch: false, knock: true, sfx: 'fKick', done: false })
      break
    case 'spin':
      A.dur = 0.85; A.pose = 'spin'
      A.vel = (t) => (t > 0.1 && t < 0.62 ? f.face * 22 : null)
      for (let k = 0; k < 3; k++) A.frames.push({ t0: 0.12 + k * 0.17, t1: 0.2 + k * 0.17, dmg: d, hs: 0.3, bs: 0.15, kb: 3, reach: 9.5, y: 6, hh: 4, lvl: 'mid', launch: k === 2, sfx: 'fKick', done: false })
      A.on.push({ t: 0.1, fn: () => sfx('fDash') })
      break
    case 'tornado':
      A.dur = 1.3; A.pose = 'spin'
      A.on.push({ t: 0.3, fn: () => { spawnProj(f, { dmg: d / spec.hits, kind: 'tornado', vx: 20, y: 7, r: 4.5, life: 3.2, hs: 0.28, bs: 0.15, tick: 0.2, pierce: true, color: el.color, glow: el.glow, launch: true, final: true }); sfx('fBeam') } })
      break
    case 'quake':
      A.dur = 1.7; A.pose = 'quake'; A.armor = true
      A.on.push({ t: 0.25, fn: () => { f.vy = 46; f.vx = f.face * 4; sfx('fRise') } })
      A.on.push({ t: 0.72, fn: () => { f.vy = -60; f.vx = 0 } })
      A.on.push({ t: 0.92, fn: () => { shake(3); flash(0.4, [1, 0.9, 0.7]); sfx('fSlam'); spawnProj(f, { dmg: d, kind: 'groundwave', vx: 46, y: 1.5, r: 3, life: 1.1, hs: 0.8, bs: 0.3, launch: true, color: el.color, glow: el.glow, both: true, low: true }) } })
      break
    case 'tele':
      A.dur = 0.8; A.pose = 'tele'; A.inv = 0.4
      A.on.push({ t: 0.04, fn: () => { f.vis = 0; burst(f.x, f.y + 6, el); sfx('fDash') } })
      A.on.push({ t: 0.3, fn: () => { f.x = clamp(o.x - o.face * 7.5, -XMAX, XMAX); f.face = o.x >= f.x ? 1 : -1; f.vis = 1; burst(f.x, f.y + 6, el) } })
      A.frames.push({ t0: 0.32, t1: 0.46, dmg: d, hs: 0.5, bs: 0.2, kb: 6, reach: 8.5, y: 8, hh: 4, lvl: 'mid', launch: false, knock: true, sfx: 'fHeavy', done: false })
      break
    case 'flurry': {
      const n = spec.hits
      A.dur = 0.5 + n * 0.14 + 0.5; A.pose = 'flurry'; A.limb = ch.style === 'taekwon' ? 'rf' : 'rh'
      A.on.push({ t: 0.05, fn: () => { f.vis = 0; burst(f.x, f.y + 6, el) } })
      A.on.push({ t: 0.28, fn: () => { f.x = clamp(o.x - o.face * 6, -XMAX, XMAX); f.face = o.x >= f.x ? 1 : -1; f.vis = 1; burst(f.x, f.y + 6, el); sfx('fDash') } })
      for (let k = 0; k < n; k++) A.frames.push({ t0: 0.34 + k * 0.14, t1: 0.4 + k * 0.14, dmg: d / n, hs: 0.3, bs: 0.14, kb: 1.5, reach: 9, y: 4 + (k % 3) * 3, hh: 4, lvl: 'mid', launch: k === n - 1, sfx: k % 2 ? 'fKick' : 'fPunch', done: false, lock: true })
      break
    }
    case 'grab':
      A.dur = isSuper ? 2.0 : 1.2; A.pose = 'grab'
      A.frames.push({ t0: isSuper ? 0.3 : 0.16, t1: isSuper ? 0.42 : 0.26, dmg: d, grab: true, reach: 7.5, y: 7, hh: 6, lvl: 'throw', sfx: 'fGrab', done: false, big: isSuper })
      break
    default:
      A.dur = 0.5
  }
  return A
}
function burst(x, y, el) { for (let i = 0; i < 14; i++) part(x, y, R(-18, 18), R(-6, 22), R(0.3, 0.7), rgb(i % 2 ? el.color : el.glow), R(0.8, 1.6)); ring(x, y, 14, 30, [rgb(el.color), rgb(el.glow)]) }
function startSpecial(f) {
  if (f.spCd > 0) return false
  const A = build(f, f.ch.special, false)
  f.atk = A; f.st = 'attack'; f.t = 0; f.spCd = f.ch.special.cd; f.inv = Math.max(f.inv, A.inv); f.armor = !!A.armor
  if (f.y <= 0.001) f.vx = 0
  FT.stats.specials++
  if (f.human) say(f.ch.special.name.toUpperCase() + '!', ELEMENTS[f.ch.element].color)
  else say(f.ch.special.name.toUpperCase() + '!', ELEMENTS[f.ch.element].color)
  sfx('fSpecial'); burst(f.x, f.y + 7, ELEMENTS[f.ch.element])
  return true
}
function startSuper(f) {
  if (f.meter < 100) return false
  f.meter = 0
  FT.stats.supers++
  const el = ELEMENTS[f.ch.element]
  FT.cine = { t: 0, dur: 0.95, owner: f.id, name: f.ch.super.name.toUpperCase(), color: el.color }
  f.st = 'cine'; f.t = 0; f.inv = 2
  sfx('fSuper'); speak(f.ch.super.name.toLowerCase(), 0.8, 0.9)
  shake(1.2); flash(0.5, [1, 1, 1])
  return true
}
function launchSuper(f) {
  const A = build(f, f.ch.super, true)
  f.atk = A; f.st = 'attack'; f.t = 0; f.inv = Math.max(f.inv, 0.3); f.armor = !!A.armor
  f.vx = 0; f.vy = 0; f.y = Math.max(0, f.y)
  say(f.ch.super.name.toUpperCase() + '!!', ELEMENTS[f.ch.element].color, 1.4)
}

// ---------- projectiles ----------
function spawnProj(f, p) {
  const dir = f.face
  FT.proj.push({ owner: f.id, x: f.x + dir * (p.kind === 'megabeam' ? 4 : 5), y: FLOOR + f.y + (p.y || 8), vx: (p.vx || 0) * dir, dir, kind: p.kind, dmg: p.dmg, hs: p.hs || 0.4, bs: p.bs || 0.2, color: p.color, glow: p.glow, r: p.r || 2, life: p.life || 2, t: 0, pierce: !!p.pierce, tickT: 0, tick: p.tick || 0, hitCount: 0, launch: !!p.launch, fixed: !!p.fixed, both: !!p.both, low: !!p.low, final: !!p.final, dead: false, hitOnce: new Set() })
}
function stepProj(p, dt) {
  p.t += dt; p.life -= dt
  const ow = FT.f[p.owner], o = FT.f[1 - p.owner]
  if (p.fixed) { p.x = ow.x + ow.face * 4; p.dir = ow.face; p.y = FLOOR + ow.y + 9 }
  else p.x += p.vx * dt
  if (p.kind === 'tornado') p.y = FLOOR + 7 + Math.sin(p.t * 9) * 1.2
  if (p.life <= 0 || Math.abs(p.x) > 62) { p.dead = true; return }
  if (Math.random() < dt * 40) part(p.x, p.y + R(-p.r, p.r), R(-8, 8), R(-6, 10), 0.3, rgb(Math.random() < 0.5 ? p.color : p.glow), R(0.6, 1.2))
  // collide
  const hb = hurtBox(o)
  const len = p.kind === 'megabeam' ? 90 : p.kind === 'groundwave' ? 4 : p.r
  const x0 = p.kind === 'megabeam' ? Math.min(p.x, p.x + p.dir * len) : p.x - len, x1 = p.kind === 'megabeam' ? Math.max(p.x, p.x + p.dir * len) : p.x + len
  const worldY = p.kind === 'groundwave' ? FLOOR + 1.5 : p.y
  const r = p.kind === 'megabeam' ? 3.4 : p.r
  const overlap = x1 > hb.x0 && x0 < hb.x1 && worldY + r > FLOOR + hb.y0 && worldY - r < FLOOR + hb.y1
  if (!overlap) return
  if (p.low && o.y > 3) return // the shockwave runs along the floor: jump over it
  if (p.tick) { p.tickT -= dt; if (p.tickT > 0) return; p.tickT = p.tick } else if (p.hitOnce.has(o.id)) return
  p.hitOnce.add(o.id)
  p.hitCount++
  const lastHit = p.final && p.life < p.tick + 0.05
  const res = applyHit(ow, o, { dmg: p.dmg, hs: p.hs, bs: p.bs, kb: p.kind === 'tornado' ? 1 : 5, lvl: p.low ? 'low' : 'mid', launch: p.launch && (lastHit || !p.tick), sfx: 'fHit', proj: true, color: p.color, noBlockStun: false })
  if (res !== 'miss' && !p.pierce && !p.tick) p.dead = true
  if (res === 'block' && p.kind !== 'megabeam') p.dead = !p.pierce
}

// ---------- hit resolution ----------
function comboScale(n) { return Math.max(0.35, 1 - 0.07 * Math.max(0, n - 1)) }
function applyHit(att, def, h) {
  if (def.inv > 0 || def.st === 'ko' || FT.phase === 'ko') return 'miss'
  const dir = Math.sign(def.x - att.x) || att.face
  const canBlock = def.block && !h.grab && (def.st === 'idle' || def.st === 'walk' || def.st === 'crouch' || def.st === 'block' || (def.st === 'hit' && def.blocking)) && def.y < 0.6
  if (canBlock) {
    const crouching = def.crouch || def.st === 'crouch'
    const ok = h.lvl === 'low' ? crouching : h.lvl === 'high' ? !crouching || true : true
    if (ok && !(h.lvl === 'high' && crouching)) {
      def.st = 'block'; def.t = 0; def.stun = h.bs; def.blocking = true; def.vx = dir * (h.kb || 3) * 0.7
      att.vx = att.y > 0.6 ? att.vx : -dir * 1.5
      def.meter = Math.min(100, def.meter + 2); att.meter = Math.min(100, att.meter + 1)
      if (h.proj || h.special) def.hp -= h.dmg * 0.08
      sfx('fBlock'); part(def.x - dir * 2, FLOOR + def.y + 8, dir * 8, R(-4, 8), 0.25, [1, 1, 1], 1.1)
      FT.stats.blocked++; FT.stop = Math.max(FT.stop, 0.04)
      return 'block'
    }
    if (h.lvl === 'high' && crouching) return 'miss' // ducked under a high attack
  } else if (h.lvl === 'high' && (def.crouch || def.st === 'crouch') && !h.grab) return 'miss'
  // a clean hit
  if (def.combo === 0) def.comboT = 0
  def.combo++
  att.hitsDealt = def.combo
  FT.stats.hits++
  FT.stats.maxCombo = Math.max(FT.stats.maxCombo, def.combo)
  const dmg = h.dmg * comboScale(def.combo)
  def.hp -= dmg
  def.flash = 0.12
  att.meter = Math.min(100, att.meter + dmg * 0.7 + 1)
  def.meter = Math.min(100, def.meter + dmg * 0.45)
  const hx = def.x - dir * 2, hy = FLOOR + def.y + (h.y || 8)
  const el = ELEMENTS[att.ch.element]
  const big = dmg >= 9 || h.launch || h.knock
  for (let i = 0; i < (big ? 14 : 7); i++) part(hx, hy, dir * R(4, 26) + R(-6, 6), R(-10, 18), R(0.18, 0.45), rgb(i % 3 === 0 ? el.color : i % 3 === 1 ? '#ffffff' : '#ffe84a'), R(0.8, big ? 1.8 : 1.3))
  ring(hx, hy, big ? 12 : 7, big ? 46 : 30, [rgb(el.glow), rgb('#ffffff')])
  sfx(h.sfx || (big ? 'fHeavy' : 'fHit')); if (big) sfx('fHit')
  FT.stop = Math.max(FT.stop, big ? 0.1 : 0.05)
  if (big) shake(big && dmg > 12 ? 1.6 : 0.8)
  if (def.hp <= 0) { def.hp = 0; return koCheck(att, def, dir) || 'hit' }
  if (def.armor && !h.launch && !h.grab) { def.vx = 0; return 'hit' } // super-armour: takes the hit, keeps going
  def.blocking = false
  def.atk = null; def.armor = false; def.vis = 1; def.held = null
  if (h.launch || def.y > 0.6) {
    def.st = 'air'; def.t = 0; def.vy = h.launch ? 34 : 18; def.vx = dir * (h.launch ? 14 : 8); def.stun = 0; def.airHit = true
  } else if (h.knock) {
    def.st = 'air'; def.t = 0; def.vy = 14; def.vx = dir * 20; def.stun = 0
  } else {
    def.st = 'hit'; def.t = 0; def.stun = h.hs; def.vx = dir * (h.kb || 3)
  }
  return 'hit'
}
function koCheck(att, def, dir) {
  FT.phase = 'ko'; FT.phaseT = 0; FT.slow = 0.35
  def.st = 'ko'; def.t = 0; def.vy = 24; def.vx = dir * 16; def.atk = null; def.vis = 1
  sfx('fKO'); shake(3); flash(0.7, [1, 1, 1]); say('K.O.!', '#ff3b4e', 2)
  FT.msg = { text: 'K.O.!', sub: '', color: '#ff3b4e', t: 2 }
  return 'hit'
}

// ---------- per-fighter update ----------
function controls(f, o, dt) {
  if (f.remote) { f.inp = f.netInp || { dx: 0, up: false, down: false }; return }
  if (f.human) {
    const d = FT.net ? { l: ['KeyA', 'ArrowLeft'], r: ['KeyD', 'ArrowRight'], u: ['KeyW', 'ArrowUp'], d: ['KeyS', 'ArrowDown'] } : DIRS[f.human - 1]
    const any = (arr) => arr.some((c) => keys[c])
    f.inp = { dx: (any(d.r) ? 1 : 0) - (any(d.l) ? 1 : 0), up: any(d.u), down: any(d.d) }
  } else aiThink(f, o, dt)
}
function press(f, btn) {
  if (f.st === 'ko' || FT.phase !== 'fight' || FT.cine) return
  const act = f.st === 'idle' || f.st === 'walk' || f.st === 'crouch' || (f.st === 'jump' && (btn === 'lp' || btn === 'hp' || btn === 'lk' || btn === 'hk'))
  if (btn === 'sp') { if (act) startSpecial(f); else f.buf = { btn, t: 0.18 }; return }
  if (btn === 'su') { if (act) startSuper(f); return }
  if (act) { f.crouch = f.inp.down && f.y < 0.6; startNormal(f, btn) } else f.buf = { btn, t: 0.16 }
}
function hitCheck(f, o) {
  const a = f.atk
  if (!a) return
  for (const fr of a.frames) {
    if (fr.done || a.t < fr.t0 || a.t > fr.t1) continue
    const reach = fr.reach, hx0 = f.face > 0 ? f.x + 1 : f.x - reach, hx1 = f.face > 0 ? f.x + reach : f.x - 1
    const hy = f.y + fr.y, hb = hurtBox(o)
    const ox0 = hb.x0, ox1 = hb.x1
    const over = hx1 > ox0 && hx0 < ox1 && hy + fr.hh > hb.y0 && hy - fr.hh < hb.y1
    if (!over) continue
    fr.done = true
    if (fr.grab) {
      if (o.inv > 0 || o.y > 1 || o.st === 'air' || o.st === 'down' || o.st === 'ko') { fr.done = false; continue }
      a.grabbed = o; a.slamT = a.t + (fr.big ? 1.0 : 0.5); a.grabFr = fr
      o.st = 'held'; o.t = 0; o.atk = null; o.held = f; o.stun = 0
      sfx('fGrab'); if (fr.big) { shake(1); flash(0.3, [1, 1, 1]) }
      continue
    }
    const res = applyHit(f, o, { ...fr, special: !a.normal })
    if (res === 'miss') { fr.done = false; continue }
    if (res === 'hit' && a.super && fr.lock) { o.st = 'hit'; o.stun = 0.45; o.vx = 0; o.vy = 0 }
    if (res === 'block' && a.super && fr.lock) a.frames.forEach((x) => { x.done = true }) // a blocked flurry ends
    if (a.super && a.mech === 'lunge') FT.stop = Math.max(FT.stop, 0.18)
  }
}
function stepAttack(f, o, dt) {
  const a = f.atk
  a.t += dt
  for (const e of a.on) if (!e.done && a.t >= e.t) { e.done = true; e.fn() }
  if (a.vel) { const v = a.vel(a.t); if (v !== null && v !== undefined) f.vx = v }
  hitCheck(f, o)
  if (a.grabbed) {
    const o2 = a.grabbed
    o2.x = f.x + f.face * 4.2; o2.y = Math.max(0, f.y + (a.t > a.slamT - 0.3 ? 5 : 2)); o2.vx = 0
    if (a.t >= a.slamT) {
      const g = a.grabFr
      a.grabbed = null
      const dir = f.face
      o2.held = null; o2.combo++; f.hitsDealt = o2.combo; o2.hp -= g.dmg; o2.flash = 0.2
      f.meter = Math.min(100, f.meter + g.dmg * 0.6); o2.meter = Math.min(100, o2.meter + g.dmg * 0.3)
      shake(g.big ? 3.5 : 2); flash(g.big ? 0.8 : 0.3, [1, 1, 1]); sfx('fSlam'); sfx('fHit')
      ring(o2.x, FLOOR + 1, 30, 60, [rgb(ELEMENTS[f.ch.element].color), rgb('#ffffff')])
      for (let i = 0; i < 18; i++) part(o2.x, FLOOR + 1, R(-30, 30), R(0, 26), R(0.3, 0.8), rgb(i % 2 ? '#ffffff' : ELEMENTS[f.ch.element].color), R(1, 2))
      FT.stop = 0.2
      if (o2.hp <= 0) { o2.hp = 0; koCheck(f, o2, dir) } else { o2.st = 'air'; o2.t = 0; o2.vy = 12; o2.vx = dir * 10; o2.y = 0.1 }
    }
  }
  if (a.t >= a.dur) { f.atk = null; f.armor = false; if (f.st === 'attack') { f.st = f.y > 0.6 ? 'jump' : 'idle'; f.t = 0 } if (f.vis < 1) f.vis = 1 }
}
function stepFighter(f, o, dt) {
  f.t += dt
  f.inv = Math.max(0, f.inv - dt); f.flash = Math.max(0, f.flash - dt); f.spCd = Math.max(0, f.spCd - dt)
  if (f.comboT > 0) f.comboT -= dt
  if (f.buf) { f.buf.t -= dt; if (f.buf.t <= 0) f.buf = null }
  if (f.hitsDealt > 0 && o.st !== 'hit' && o.st !== 'air' && o.st !== 'held' && o.st !== 'ko') f.hitsDealt = 0
  if (o.st !== 'hit' && o.st !== 'air' && o.st !== 'held') o.combo = 0
  const grounded = f.y <= 0.001
  // gravity & integration
  if (f.st !== 'cine' && f.st !== 'held') {
    if (f.y > 0 || f.vy > 0 || f.st === 'air' || f.st === 'jump' || f.st === 'ko' || (f.atk && f.atk.mech === 'dive') || (f.atk && f.atk.mech === 'quake') || f.vy !== 0) {
      f.vy -= GRAV * dt * (f.atk && f.atk.mech === 'quake' && f.vy < 0 ? 0.2 : 1)
      f.y += f.vy * dt
      if (f.y <= 0) {
        f.y = 0
        if (f.vy < -20 && f.st !== 'ko') part(f.x, FLOOR, R(-10, 10), R(2, 10), 0.3, [0.8, 0.8, 0.9], 1.2)
        f.vy = 0
        if (f.st === 'air') { f.st = f.airHit ? 'down' : 'down'; f.t = 0; f.vx *= 0.3; sfx('fLand'); shake(0.7); f.airHit = false }
        else if (f.st === 'jump') { f.st = 'idle'; f.t = 0; f.airAtk = false; f.vx = 0 }
        else if (f.st === 'ko') { f.vx = 0; if (f.t > 0.2 && !f.koDown) { f.koDown = true; sfx('fLand'); shake(1.4) } }
        else if (f.atk && (f.atk.mech === 'dive' || f.atk.mech === 'quake')) { f.vx = 0; if (f.atk.mech === 'dive' && f.atk.t > 0.3) f.atk.t = Math.max(f.atk.t, f.atk.dur - 0.25) }
      }
    }
    f.x += f.vx * dt
    f.x = clamp(f.x, -XMAX, XMAX)
  }
  switch (f.st) {
    case 'idle': case 'walk': case 'crouch': {
      f.airAtk = false; f.blocking = false
      if (o.x !== f.x) f.face = o.x > f.x ? 1 : -1
      const inp = f.inp
      if (f.buf && FT.phase === 'fight' && !FT.cine) { const b = f.buf; f.buf = null; press(f, b.btn); if (f.st === 'attack') break }
      if (inp.up && grounded && FT.phase === 'fight') { f.st = 'jump'; f.t = 0; f.vy = JUMP; f.vx = inp.dx * 15 * f.ch.spd; f.crouch = false; sfx('fJump'); break }
      if (inp.down && grounded) { f.st = 'crouch'; f.crouch = true; f.vx = 0 }
      else {
        f.crouch = false
        if (inp.dx && FT.phase === 'fight') { f.st = 'walk'; f.vx = inp.dx * (inp.dx === f.face ? 15 : 11) * f.ch.spd } else { f.st = 'idle'; f.vx *= 0.6; if (Math.abs(f.vx) < 0.5) f.vx = 0 }
      }
      f.block = inp.dx !== 0 && inp.dx !== f.face && FT.phase === 'fight' // holding back = guard
      break
    }
    case 'jump':
      f.block = false
      if (f.buf && !f.airAtk) { const b = f.buf; f.buf = null; press(f, b.btn) }
      break
    case 'attack': f.block = false; if (f.y <= 0.001 && !(f.atk && f.atk.vel)) f.vx *= 0.8; stepAttack(f, o, dt); break
    case 'block': f.stun -= dt; f.vx *= 0.88; if (f.stun <= 0) { f.st = f.crouch ? 'crouch' : 'idle'; f.t = 0; f.blocking = false } break
    case 'hit': f.stun -= dt; f.vx *= 0.9; if (f.stun <= 0) { f.st = 'idle'; f.t = 0; f.vx = 0 } break
    case 'air': break
    case 'down': f.vx *= 0.85; if (f.t > 0.65) { f.st = 'getup'; f.t = 0; f.inv = 0.35; f.combo = 0 } break
    case 'getup': if (f.t > 0.3) { f.st = 'idle'; f.t = 0 } break
    case 'held': break
    case 'cine': break
    case 'ko': f.vx *= 0.96; break
    case 'win': break
    default: break
  }
}

// ---------- AI ----------
function aiThink(f, o, dt) {
  const D = DIFF[FT.cfg.diff - 1]
  const dist = Math.abs(o.x - f.x), toward = o.x > f.x ? 1 : -1
  f.aiT -= dt; f.aiBlock = Math.max(0, f.aiBlock - dt)
  const inp = f.inp
  const act = f.st === 'idle' || f.st === 'walk' || f.st === 'crouch'
  // react to incoming attacks
  if (o.st === 'attack' && o.atk && dist < (o.atk.m ? o.atk.m.reach + 3 : 14) && FT.phase === 'fight' && !f.aiReact) {
    f.aiReact = { t: D.react, block: Math.random() < D.block, low: !!(o.atk.m && o.atk.m.lvl === 'low') }
  }
  if (f.aiReact) {
    f.aiReact.t -= dt
    if (f.aiReact.t <= 0) { if (f.aiReact.block) { f.aiBlock = 0.35; f.aiLow = f.aiReact.low } f.aiReact = null }
  }
  if (f.aiBlock > 0 && act) { inp.dx = -toward; inp.down = f.aiLow; inp.up = false; return }
  if (!(o.st === 'attack')) f.aiReact = null
  if (f.aiT > 0) return
  f.aiT = D.think * R(0.6, 1.3)
  inp.up = false; inp.down = false; inp.dx = 0
  if (!act || FT.phase !== 'fight' || FT.cine) return
  const sp = f.ch.special.mech
  const ranged = sp === 'ball' || sp === 'beam' || sp === 'fist'
  // super when ready
  if (f.meter >= 100 && Math.random() < D.sup * 30 * (dist < 16 || f.ch.super.mech === 'beam' || f.ch.super.mech === 'volley' ? 1 : 0.2)) { startSuper(f); return }
  if (o.y > 4 && dist < 12 && sp === 'rise' && f.spCd <= 0 && Math.random() < 0.7) { startSpecial(f); return }
  if (dist > 22) {
    if (ranged && f.spCd <= 0 && Math.random() < 0.55) { startSpecial(f); return }
    inp.dx = toward
    if (Math.random() < 0.08) inp.up = true
    return
  }
  if (dist > 12) {
    if ((ranged || sp === 'lunge' || sp === 'dive' || sp === 'tele' || sp === 'spin') && f.spCd <= 0 && Math.random() < 0.35 * D.aggr + 0.1) { startSpecial(f); return }
    inp.dx = Math.random() < D.aggr ? toward : 0
    if (Math.random() < 0.07) inp.up = true
    return
  }
  if (dist > 9.5) { inp.dx = toward; if (Math.random() < 0.25) press(f, 'lk'); return }
  // close range
  if (sp === 'grab' && f.spCd <= 0 && Math.random() < 0.18) { startSpecial(f); return }
  if (o.st === 'block' && Math.random() < 0.2) { inp.dx = -toward; return } // back off from a turtle
  const r = Math.random()
  if (r < D.aggr) {
    const pickLow = Math.random() < 0.22
    if (pickLow) { inp.down = true; f.crouch = true; press(f, Math.random() < 0.5 ? 'lk' : 'hk') }
    else press(f, ['lp', 'lp', 'hp', 'lk', 'hk'][(Math.random() * 5) | 0])
  } else if (r < D.aggr + 0.15) inp.dx = -toward // step back
  else if (r < D.aggr + 0.2 && f.spCd <= 0) startSpecial(f)
}

// ---------- main loop ----------
function update(dtRaw) {
  const dt = Math.min(dtRaw, 0.04)
  if (FT.mode === 'idle') return
  if (FT.paused) { return }
  if (FT.net && FT.net.role === 'guest') { guestStep(dt); return }
  FT.t += dt
  if (FT.say) { FT.say.t -= dt; if (FT.say.t <= 0) FT.say = null }
  if (FT.msg) { FT.msg.t -= dt; if (FT.msg.t <= 0) FT.msg = null }
  // super cinematic: the world freezes for a moment
  if (FT.cine) {
    FT.cine.t += dt
    stepParticles(dt * 0.3)
    if (FT.cine.t > FT.cine.dur) { const f = FT.f[FT.cine.owner]; FT.cine = null; launchSuper(f) }
    emitTick(dt)
    return
  }
  if (FT.stop > 0) { FT.stop -= dt; stepParticles(dt * 0.2); emitTick(dt); return }
  const sdt = dt * FT.slow
  FT.phaseT += dt
  const [a, b] = FT.f
  if (FT.phase === 'intro') {
    if (FT.phaseT > 1.7) { FT.phase = 'fight'; FT.phaseT = 0; FT.msg = { text: 'FIGHT!', sub: '', color: '#ff4d4d', t: 0.8 }; sfx('fFight'); speak('Fight!', 0.8, 1.0) }
  } else if (FT.phase === 'fight') {
    FT.timer -= sdt
    if (FT.timer <= 0) roundOver(a.hp / a.maxHp > b.hp / b.maxHp ? 0 : a.hp / a.maxHp < b.hp / b.maxHp ? 1 : -1, 'TIME UP')
  } else if (FT.phase === 'ko') {
    if (FT.phaseT > 1.4) FT.slow = 1
    if (FT.phaseT > 2.4) roundOver(a.hp <= 0 && b.hp <= 0 ? (a.hp >= b.hp ? 0 : 1) : a.hp <= 0 ? 1 : 0, 'K.O.')
  } else if (FT.phase === 'result') {
    if (FT.phaseT > 2.6) { if (FT.wins[0] >= FT.cfg.rounds || FT.wins[1] >= FT.cfg.rounds) endMatch(); else { FT.round++; newRound() } }
  }
  for (const f of FT.f) controls(f, FT.f[1 - f.id], sdt)
  stepFighter(a, b, sdt); stepFighter(b, a, sdt)
  // fighters cannot walk through each other
  const gap = 4.4 * (a.ch.w + b.ch.w) / 2
  if (a.y < 6 && b.y < 6 && Math.abs(a.x - b.x) < gap && a.st !== 'held' && b.st !== 'held') {
    const push = (gap - Math.abs(a.x - b.x)) / 2, d = a.x <= b.x ? 1 : -1
    a.x -= push * d; b.x += push * d
    a.x = clamp(a.x, -XMAX, XMAX); b.x = clamp(b.x, -XMAX, XMAX)
    if (a.x === -XMAX || a.x === XMAX) b.x += (gap - Math.abs(a.x - b.x)) * d
    if (b.x === -XMAX || b.x === XMAX) a.x -= (gap - Math.abs(a.x - b.x)) * d
    a.x = clamp(a.x, -XMAX, XMAX); b.x = clamp(b.x, -XMAX, XMAX)
  }
  for (const p of FT.proj) stepProj(p, sdt)
  FT.proj = FT.proj.filter((p) => !p.dead)
  // projectiles cancel each other
  for (let i = 0; i < FT.proj.length; i++) for (let j = i + 1; j < FT.proj.length; j++) {
    const p = FT.proj[i], q = FT.proj[j]
    if (p.owner !== q.owner && p.kind !== 'megabeam' && q.kind !== 'megabeam' && Math.abs(p.x - q.x) < p.r + q.r && Math.abs(p.y - q.y) < p.r + q.r + 1) { p.dead = q.dead = true; ring((p.x + q.x) / 2, p.y, 10, 40, [rgb('#fff'), rgb(p.color)]); sfx('fBlock') }
  }
  stepParticles(sdt)
  // meter trickle
  for (const f of FT.f) if (FT.phase === 'fight') f.meter = Math.min(100, f.meter + sdt * 0.8)
  emitTick(dt)
  if (FT.net && FT.net.role === 'host') netTick(dt)
}
function emitTick(dt) { FT.emitT -= dt; if (FT.emitT <= 0) { FT.emitT = 0.06; emitFt() } }
function roundOver(winner, why) {
  FT.phase = 'result'; FT.phaseT = 0; FT.slow = 1
  const [a, b] = FT.f
  if (winner >= 0) { FT.wins[winner]++; const w = FT.f[winner]; w.st = 'win'; w.t = 0; w.vx = 0; w.atk = null; w.vis = 1 }
  const perfect = winner >= 0 && FT.f[winner].hp >= FT.f[winner].maxHp
  const nm = winner >= 0 ? FT.f[winner].ch.name : ''
  FT.msg = { text: winner < 0 ? 'DRAW' : perfect ? 'PERFECT!' : `${nm} WINS`, sub: why === 'TIME UP' ? 'TIME UP' : `ROUND ${FT.round}`, color: winner < 0 ? '#fff' : ELEMENTS[FT.f[winner].ch.element].color, t: 2.4 }
  if (winner >= 0) { sfx('fWin'); if (FT.f[winner].human) { speak(perfect ? 'Perfect!' : 'You win', 0.9, 1.1) } }
  void a; void b
}
function endMatch() {
  FT.phase = 'over'; FT.mode = 'over'; music.stop()
  const w = FT.wins[0] > FT.wins[1] ? 0 : 1
  const c = FT.cfg
  const humanWon = FT.f[w].human === 1
  if (c.type !== 'demo') {
    profile.fightGames = (profile.fightGames || 0) + 1
    if (humanWon) { profile.fightWins = (profile.fightWins || 0) + 1; profile.fightBeaten = { ...(profile.fightBeaten || {}), [FT.f[1].ch.id]: true } }
    saveProfile()
  }
  FT.over = { winner: w, name: FT.f[w].ch.name, element: FT.f[w].ch.element, human: humanWon, wins: FT.wins.slice(), stats: { ...FT.stats }, type: c.type }
  sfx(humanWon || c.type === '2p' ? 'win' : 'over')
  emitFt()
}
function onKey(code) {
  if (FT.mode === 'idle') return
  if (code === 'Escape' || code === 'KeyP') { if (FT.mode === 'play' && !FT.net) { FT.paused = !FT.paused; sfx('ui'); emitFt() } return }
  if (FT.paused) { if (code === 'Enter') { FT.paused = false; emitFt() } return }
  if (FT.mode === 'over') { if (code === 'Enter') fightActions.rematch(); return }
  if (FT.net) {
    const m = BTN_CODES[0]
    for (const k of ['lp', 'hp', 'lk', 'hk', 'sp', 'su']) if (code === m[k]) { if (FT.net.role === 'guest') FT.net.press(k); else press(FT.f[0], k) }
    return
  }
  for (let p = 0; p < 2; p++) {
    const f = FT.f[p]
    if (!f || !f.human || f.human !== p + 1) continue
    const m = BTN_CODES[p]
    for (const k of ['lp', 'hp', 'lk', 'hk', 'sp', 'su']) if (code === m[k]) press(f, k)
  }
}
export function setFightPick(id) { profile.fightPick = id; saveProfile() }
export const fightActions = {
  start, stop, quit() { toMenu() }, resume() { FT.paused = false; emitFt() },
  pause() { if (FT.mode === 'play' && !FT.paused && !FT.net) { FT.paused = true; emitFt(); return true } return false },
  rematch() { if (FT.net) { FT.net.rematch(); return } start({ ...FT.cfg, p1: FT.cfg.p1, p2: FT.cfg.p2 }) },
  press(p, btn) { const f = FT.f[p]; if (f) press(f, btn) },
}

// ---------- online (host simulates; the guest sends controls and mirrors the state) ----------
let nSeq = 0, nT = 0, inT = 0, lastN = -1
const r2 = (v) => Math.round(v * 100) / 100
const fSnap = (f) => ({
  x: r2(f.x), y: r2(f.y), vx: r2(f.vx), face: f.face, st: f.st, t: r2(f.t), hp: r2(f.hp), mt: r2(f.meter), sc: r2(f.spCd), hd: f.hitsDealt, vis: f.vis, fl: r2(f.flash), cr: f.crouch, ar: f.armor,
  atk: f.atk ? { n: f.atk.normal ? 1 : 0, m: f.atk.m ? { reach: f.atk.m.reach, y: f.atk.m.y, limb: f.atk.m.limb, su: f.atk.m.su, ac: f.atk.m.ac, rc: f.atk.m.rc } : null, mech: f.atk.mech || null, pose: f.atk.pose || null, t: r2(f.atk.t), dur: r2(f.atk.dur), v: f.atk.vel ? 1 : 0, g: f.atk.grabbed ? 1 : 0, sl: f.atk.slamT || 0, nm: f.atk.name } : null,
})
function hostSnap() {
  return {
    n: ++nSeq, f: FT.f.map(fSnap), pr: FT.proj.map((p) => ({ k: p.kind, x: r2(p.x), y: r2(p.y), vx: r2(p.vx), d: p.dir, c: p.color, g: p.glow, r: p.r, l: r2(p.life), t: r2(p.t) })),
    ph: FT.phase, pt: r2(FT.phaseT), tm: r2(FT.timer), rd: FT.round, w: FT.wins, mode: FT.mode, st: r2(FT.stop), sl: FT.slow,
    ci: FT.cine ? { t: r2(FT.cine.t), dur: FT.cine.dur, o: FT.cine.owner, name: FT.cine.name, color: FT.cine.color } : null,
    say: FT.say, msg: FT.msg, over: FT.over, rounds: FT.cfg.rounds,
  }
}
function netTick(dt) {
  nT -= dt
  if (nT <= 0) { nT = FT.net.fast && FT.net.fast() ? 0.033 : 0.12; FT.net.state(hostSnap()) }
}
function guestStep(dt) {
  FT.t += dt
  // our own controls go to the host
  inT -= dt
  const m = FT.f[1]
  if (FT.mode === 'play' && inT <= 0) {
    inT = FT.net.fast && FT.net.fast() ? 0.05 : 0.14
    const any = (arr) => arr.some((c) => keys[c])
    FT.net.input({ dx: (any(['KeyD', 'ArrowRight']) ? 1 : 0) - (any(['KeyA', 'ArrowLeft']) ? 1 : 0), up: any(['KeyW', 'ArrowUp']), down: any(['KeyS', 'ArrowDown']) })
  }
  void m
  for (const f of FT.f) {
    f.t += dt
    if (f.atk) f.atk.t += dt
    if (f.tx !== undefined) { f.x += (f.tx - f.x) * Math.min(1, dt * 22); f.y += (f.ty - f.y) * Math.min(1, dt * 22) }
  }
  for (const p of FT.proj) { p.x += p.vx * dt; p.t += dt; p.life -= dt }
  if (FT.say) { FT.say.t -= dt; if (FT.say.t <= 0) FT.say = null }
  if (FT.msg) { FT.msg.t -= dt; if (FT.msg.t <= 0) FT.msg = null }
  if (FT.cine) FT.cine.t += dt
  stepParticles(dt)
  FT.emitT -= dt
  if (FT.emitT <= 0) { FT.emitT = 0.06; emitFt() }
}
export const fightNet = {
  attach(net) { FT.net = net },
  active: () => !!FT.net && FT.mode !== 'idle',
  reset() { nSeq = 0; lastN = -1; nT = 0; inT = 0 },
  // host: the guest's controls
  applyInput(d) { const f = FT.f[1]; if (f && f.remote && d) f.netInp = { dx: clamp(d.dx | 0, -1, 1), up: !!d.up, down: !!d.down } },
  applyPress(btn) { const f = FT.f[1]; if (f && f.remote && ['lp', 'hp', 'lk', 'hk', 'sp', 'su'].includes(btn)) press(f, btn) },
  guestLeft() { if (FT.net && FT.net.role === 'host' && FT.mode === 'play') { const f = FT.f[1]; f.remote = false; f.human = 0; f.aiT = 0 } },
  // guest: mirror the host's state
  applyState(s) {
    if (!FT.net || FT.net.role !== 'guest' || !s || !s.f || s.n <= lastN || FT.mode === 'idle') return
    lastN = s.n
    const prevHp = FT.f.map((f) => f.hp), prevSt = FT.f.map((f) => f.st), prevAtk = FT.f.map((f) => !!(f.atk && !f.atk.normal)), prevPhase = FT.phase, prevCine = !!FT.cine, prevProj = FT.proj.length
    s.f.forEach((d, i) => {
      const f = FT.f[i]
      f.tx = d.x; f.ty = d.y; if (Math.abs(f.x - d.x) > 14) { f.x = d.x; f.y = d.y }
      Object.assign(f, { vx: d.vx, face: d.face, st: d.st, hp: d.hp, meter: d.mt, spCd: d.sc, hitsDealt: d.hd, vis: d.vis, flash: d.fl, crouch: d.cr, armor: d.ar })
      if (d.st !== prevSt[i]) f.t = d.t
      if (d.atk) { const a = f.atk && f.atk.nm === d.atk.nm ? f.atk : (f.atk = { nm: d.atk.nm, t: d.atk.t }); Object.assign(a, { normal: !!d.atk.n, m: d.atk.m, mech: d.atk.mech, pose: d.atk.pose, dur: d.atk.dur, vel: d.atk.v ? () => 0 : null, grabbed: d.atk.g ? FT.f[1 - i] : null, slamT: d.atk.sl, name: d.atk.nm }); if (Math.abs(a.t - d.atk.t) > 0.08) a.t = d.atk.t } else f.atk = null
    })
    FT.proj = (s.pr || []).map((p) => ({ kind: p.k, x: p.x, y: p.y, vx: p.vx, dir: p.d, color: p.c, glow: p.g, r: p.r, life: p.l, t: p.t }))
    FT.phase = s.ph; FT.phaseT = s.pt; FT.timer = s.tm; FT.round = s.rd; FT.wins = s.w; FT.cfg.rounds = s.rounds; FT.slow = s.sl
    FT.cine = s.ci ? { t: s.ci.t, dur: s.ci.dur, owner: s.ci.o, name: s.ci.name, color: s.ci.color } : null
    if (s.say && (!FT.say || FT.say.id !== s.say.id)) FT.say = s.say
    if (s.msg && (!FT.msg || FT.msg.text !== s.msg.text)) FT.msg = s.msg
    // sounds and sparks the host's simulation made
    s.f.forEach((d, i) => {
      const f = FT.f[i]
      if (f.hp < prevHp[i] - 0.4) { const big = prevHp[i] - f.hp > 8; sfx(big ? 'fHeavy' : 'fHit'); ring(f.x, FLOOR + f.y + 8, big ? 12 : 7, 40, [rgb('#ffffff'), rgb(ELEMENTS[FT.f[1 - i].ch.element].glow)]); for (let k = 0; k < (big ? 12 : 6); k++) part(f.x, FLOOR + f.y + 8, R(-22, 22), R(-8, 18), R(0.2, 0.45), rgb(k % 2 ? '#ffffff' : '#ffe84a'), R(0.8, 1.6)); if (big) shake(1) }
      else if (f.st === 'block' && prevSt[i] !== 'block') sfx('fBlock')
      if (f.atk && !f.atk.normal && !prevAtk[i]) sfx('fSpecial')
      if (f.st === 'down' && prevSt[i] === 'air') { sfx('fLand'); shake(0.6) }
    })
    if (FT.cine && !prevCine) { sfx('fSuper'); shake(1.2); flash(0.5, [1, 1, 1]) }
    if (FT.proj.length > prevProj) sfx('fFire')
    if (FT.phase !== prevPhase) { if (FT.phase === 'fight') sfx('fFight'); else if (FT.phase === 'ko') { sfx('fKO'); shake(3); flash(0.7, [1, 1, 1]) } else if (FT.phase === 'intro') sfx('fRound'); else if (FT.phase === 'result') sfx('fWin') }
    if (s.over && !FT.over) {
      FT.over = s.over; FT.mode = 'over'; FT.phase = 'over'; music.stop()
      const won = s.over.winner === 1
      profile.fightGames = (profile.fightGames || 0) + 1
      if (won) { profile.fightWins = (profile.fightWins || 0) + 1; profile.fightBeaten = { ...(profile.fightBeaten || {}), [FT.f[0].ch.id]: true } }
      FT.over = { ...s.over, human: won }
      saveProfile(); sfx(won ? 'win' : 'over')
    }
    emitFt()
  },
  opponentLeft() { if (FT.net && FT.mode === 'play') { const w = FT.net.role === 'guest' ? 1 : 0; FT.over = { winner: w, name: FT.f[w].ch.name, element: FT.f[w].ch.element, human: true, wins: FT.wins.slice(), stats: { ...FT.stats }, type: 'online', left: true }; FT.mode = 'over'; FT.phase = 'over'; music.stop(); emitFt() } },
}

// ---------- drawing ----------
const cc = {}
const lc = (hex) => cc[hex] || (cc[hex] = rgb(hex))
function box(put, cx, cy, w, h, c, k = 1, z = 1) { put(cx, cy, z, w, h, c[0] * k, c[1] * k, c[2] * k) }
function limb(put, x0, y0, x1, y1, th, c, k, z, n = 5) { for (let i = 0; i <= n; i++) { const u = i / n; box(put, x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, th, th, c, k, z) } }
const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u))

// pose: positions in the fighter's local frame (x forward, y up from the feet), before facing
function poseOf(f, t) {
  const A = f.atk
  const P = { lean: 0, drop: 0, hands: [[3.6, 11.2], [2.2, 9.6]], feet: [[-1.6, 0], [1.6, 0]], head: 0, lying: 0, spin: 0, hit: false }
  const bob = Math.sin(t * 5) * 0.25
  switch (f.st) {
    case 'idle': P.hands = [[3.6, 11.2 + bob], [2.4, 10 + bob]]; P.drop = bob * 0.5; break
    case 'walk': { const s = Math.sin(f.t * 12) * 2.6; P.feet = [[-1.6 + s, 0], [1.6 - s, Math.max(0, -Math.cos(f.t * 12) * 1.2)]]; P.hands = [[3.6, 11.2], [2.4, 10]]; break }
    case 'crouch': P.drop = 3.6; P.hands = [[3.6, 8.4], [2.2, 7.2]]; P.feet = [[-2.4, 0], [2.4, 0]]; break
    case 'jump': P.feet = [[-0.8, 3.4], [2, 2.2]]; P.hands = [[3, 11], [1.6, 10.4]]; P.drop = 0.5; break
    case 'block': P.hands = [[3.2, 13.2], [2.4, 12]]; P.lean = -0.5; P.drop = f.crouch ? 3.6 : 0; if (f.crouch) P.feet = [[-2.4, 0], [2.4, 0]]; break
    case 'hit': P.lean = -1.8; P.hands = [[0.6, 8], [-0.6, 7]]; P.head = -0.8; P.hit = true; break
    case 'air': P.lean = -1; P.hands = [[-1, 9], [-2, 8]]; P.feet = [[0, 4], [-1, 2]]; P.hit = true; break
    case 'down': case 'ko': P.lying = 1; break
    case 'getup': P.drop = 4 - f.t * 12; P.hands = [[2.4, 4], [1.2, 3]]; break
    case 'held': P.lean = -0.5; P.hands = [[-1, 11], [-2, 10]]; P.feet = [[0, 1], [-1, 1]]; break
    case 'win': { const u = Math.min(1, f.t * 3); P.hands = [[1.6, 11 + u * 6], [-1.6, 11 + u * 6]]; P.drop = -Math.abs(Math.sin(f.t * 5)) * 1.4; break }
    case 'cine': { P.hands = [[2.4, 12.8], [-0.4, 12.8]]; P.drop = 0.6 + Math.sin(f.t * 18) * 0.25; P.lean = -0.4; break }
    case 'attack': if (A) {
      const mech = A.mech
      if (A.normal) {
        const m = A.m, u = A.t, su = m.su, ac = m.ac
        const ext = u < su ? -ease(u / su) * 0.35 : u < su + ac ? 1 : Math.max(0, 1 - (u - su - ac) / m.rc)
        const lowHand = m.y < 5
        if (m.limb === 'rh' || m.limb === 'lh') {
          const tx = 3 + (m.reach - 3) * 0.78 * ext, ty = m.y + 1.2
          if (m.limb === 'rh') P.hands = [[tx, ty], [2.2, 10]]; else P.hands = [[2.6, 10.6], [tx, ty]]
          if (f.crouch || lowHand) P.drop = f.crouch ? 3.6 : 0
          P.lean = ext * 1
        } else {
          const tx = 1.5 + (m.reach - 1.5) * 0.85 * ext, ty = Math.max(0.6, m.y - 0.6) + (m.y > 6 ? 2 * ext : 0)
          const foot = [tx, ty]
          if (m.limb === 'rf') P.feet = [[-1.8, 0], foot]; else P.feet = [foot, [1.8, 0]]
          P.hands = [[3, 10.5], [1.5, 10]]; P.lean = -0.7 * ext; P.drop = f.crouch ? 3.6 : 0
          if (f.crouch) P.feet = m.limb === 'rf' ? [[-2.4, 0], [Math.min(tx, 10), 1.2]] : [[Math.min(tx, 10), 1.2], [2.4, 0]]
        }
      } else {
        const u = A.t / A.dur
        switch (A.pose) {
          case 'rise': { const k = ease(Math.min(1, A.t / 0.2)); P.hands = [[2.6, 8 + 9 * k], [-0.6, 10]]; P.feet = [[-1, 3], [1, 2]]; P.lean = 0.5; break }
          case 'cast': { const k = A.t < 0.24 ? ease(A.t / 0.24) : 1; P.hands = [[2.6 + 4 * k, 10.6], [2 + 4.4 * k, 9.8]]; P.lean = -0.3 + k * 0.6; P.drop = 0.6; break }
          case 'lunge': { P.lean = 1.8; P.hands = [[6, 10.2], [3.6, 9]]; P.feet = [[-3, 0.4], [3, 1.4]]; P.drop = 1; break }
          case 'knee': { P.lean = 1.2; P.hands = [[3.4, 12], [2.4, 10.5]]; P.feet = [[-1.6, 0], [4.6, 7]]; break }
          case 'dive': { P.lean = -1; P.hands = [[2, 10], [1, 9]]; P.feet = [[-3, 4], [7.5, 0.4]]; P.drop = 1.2; break }
          case 'spin': { const s = Math.sin(A.t * 24); P.feet = [[7.5 * s, 4.5 + 2 * Math.cos(A.t * 24)], [-6 * s, 3]]; P.hands = [[3, 9], [-1, 8]]; P.spin = A.t * 14; P.drop = -1; break }
          case 'quake': P.hands = [[2, 17], [0, 17]]; P.feet = [[-2, 3], [2, 3]]; P.drop = 0; break
          case 'tele': P.hands = [[3, 11], [2, 10]]; break
          case 'flurry': { const k = Math.floor(A.t / 0.07) % 2; P.hands = k ? [[8, 9.4], [1.6, 9]] : [[3, 9.4], [8.4, 10]]; P.feet = f.ch.style === 'taekwon' ? [[-1.8, 0], [8 * (k ? 1 : 0.4), 5 + k]] : [[-1.8, 0], [1.8, 0]]; P.lean = 0.8; break }
          case 'grab': { const k = A.grabbed ? 1 : ease(Math.min(1, A.t / 0.3)); const lift = A.grabbed ? ease((A.t - (A.slamT - 0.5)) / 0.3) * 8 : 0; P.hands = [[4.4 * k, 9.5 + lift], [3.4 * k, 9 + lift]]; P.lean = 0.6 + (A.grabbed ? -lift * 0.1 : 0); break }
          default: P.hands = [[6, 10], [3, 9.4]]
        }
        void u
      }
    } break
    default: break
  }
  return P
}
function drawFighter(put, f, t) {
  if (f.vis <= 0.01 && f.st !== 'cine') return
  const ch = f.ch, k = (f.st === 'cine' ? 1.1 : 1) * 0.95
  const sw = ch.w, sh = ch.h
  const P = poseOf(f, t)
  const flash = f.flash > 0 ? 1.8 : 1
  const skin = lc(ch.skin), top = lc(ch.top), pants = lc(ch.pants), hair = lc(ch.hair), trim = lc(ch.trim)
  const dir = f.face
  const base = FLOOR + f.y
  // local -> world
  const X = (lx) => f.x + dir * lx * k
  const Y = (ly) => base + ly * k * sh
  const kk = flash
  const bw = (v) => v * k * sw, bh = (v) => v * k * sh
  const z = 1 + (f.id === 0 ? 0.01 : 0)
  // aura
  const el = ELEMENTS[ch.element]
  if (f.st === 'cine' || (f.atk && !f.atk.normal)) { const ac = lc(el.color); for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2 + t * 8; put(f.x + Math.cos(a) * 6 * k, base + 7 + Math.sin(a) * 9 * k, 0, 1.3, 1.3, ac[0] * 2, ac[1] * 2, ac[2] * 2) } }
  if (P.lying) {
    // lying on the floor: torso horizontal, head toward the back
    const hy = base + 2.2
    const sh2 = f.st === 'ko' ? 0.7 : 1
    box(put, f.x - dir * 1, hy, bw(7), bh(4.4), top, kk * sh2, z)
    box(put, f.x - dir * 6, hy + 0.4, bw(4.2), bh(4), skin, kk * sh2, z); box(put, f.x - dir * 6, hy + 2, bw(4.4), bh(1.4), hair, kk * sh2, z)
    box(put, f.x + dir * 4.5, hy - 0.6, bw(6), bh(2.2), pants, kk * sh2, z); box(put, f.x + dir * 8.5, hy - 0.4, bw(2.4), bh(1.4), lc('#1a1a22'), 1, z)
    if (f.st === 'ko') for (let i = 0; i < 3; i++) { const a = t * 6 + i * 2.1; put(f.x - dir * 6 + Math.cos(a) * 3, hy + 4 + Math.sin(a) * 1, 3, 0.8, 0.8, 2.4, 2.2, 0.4) }
    return
  }
  const drop = P.drop || 0
  const hipY = 6 - drop * 0.5 + (f.crouch || f.st === 'crouch' ? 0 : 0)
  const lean = P.lean || 0
  // legs & feet
  P.feet.forEach(([fx0, fy0], i) => {
    const hx = (i ? 1 : -1) * 1.1 + lean * 0.2
    limb(put, X(hx), Y(hipY - drop * 0.4), X(fx0), Y(fy0 + 0.7), bw(2.3), pants, kk, z, 5)
    box(put, X(fx0 + 0.9), Y(fy0 + 0.5), bw(3), bh(1.4), lc('#16161e'), kk, z)
  })
  // torso
  const tY = hipY + 3.4 - drop * 0.5
  box(put, X(lean), Y(tY), bw(5.6), bh(6.4), top, kk, z)
  box(put, X(lean), Y(tY - 3.1), bw(5.6), bh(1), trim, kk, z) // belt / trim
  box(put, X(lean + 0.3), Y(tY + 1.4), bw(2.2), bh(1.2), trim, kk * 0.8, z)
  // head
  const hY = tY + 4.6 + (P.head || 0)
  box(put, X(lean * 1.4 + (P.head || 0)), Y(hY), bw(4.4), bh(4.2), skin, kk, z)
  const hx0 = lean * 1.4 + (P.head || 0)
  // hair styles
  switch (ch.hairStyle) {
    case 'spiky': for (let i = -2; i <= 2; i++) box(put, X(hx0 + i * 0.9), Y(hY + 2.7 + (i % 2 ? 0.8 : 1.5)), bw(1), bh(2.4), hair, kk, z); box(put, X(hx0), Y(hY + 2.1), bw(4.6), bh(1.2), hair, kk, z); break
    case 'long': box(put, X(hx0), Y(hY + 2.3), bw(4.8), bh(1.4), hair, kk, z); box(put, X(hx0 - 2.4), Y(hY - 0.6), bw(1.6), bh(5.4), hair, kk, z); break
    case 'mohawk': for (let i = -2; i <= 2; i++) box(put, X(hx0 + i * 0.5), Y(hY + 3 + Math.abs(2 - Math.abs(i)) * 0.4), bw(0.9), bh(2.6), hair, kk, z); break
    case 'bald': break
    case 'band': box(put, X(hx0), Y(hY + 2.2), bw(4.6), bh(1.2), hair, kk, z); box(put, X(hx0), Y(hY + 1.1), bw(4.8), bh(0.8), lc('#ff3b4e'), kk, z); break
    case 'bun': box(put, X(hx0), Y(hY + 2.2), bw(4.6), bh(1.2), hair, kk, z); box(put, X(hx0 - 0.4), Y(hY + 3.6), bw(2), bh(2), hair, kk, z); break
    case 'afro': box(put, X(hx0), Y(hY + 2.4), bw(6.2), bh(3.6), hair, kk, z); break
    default: box(put, X(hx0), Y(hY + 2.1), bw(4.8), bh(1.5), hair, kk, z)
  }
  // accessories
  if (ch.acc === 'mask') box(put, X(hx0 + 0.3), Y(hY - 0.9), bw(4.5), bh(2), lc('#1a1a22'), kk, z + 0.1)
  if (ch.acc === 'headband') box(put, X(hx0), Y(hY + 1.1), bw(4.8), bh(0.9), lc('#ffffff'), kk, z + 0.1)
  if (ch.acc === 'visor') box(put, X(hx0 + 0.9), Y(hY + 0.3), bw(3.2), bh(1.1), lc(el.color), 2, z + 0.1)
  if (ch.acc === 'topknot') box(put, X(hx0), Y(hY + 3.1), bw(1.8), bh(1.6), hair, kk, z)
  if (ch.acc === 'orb') { const ac = lc(el.glow); put(X(lean + 5), Y(hY + 1 + Math.sin(t * 3) * 0.6), 2, 1.4, 1.4, ac[0] * 2, ac[1] * 2, ac[2] * 2) }
  if (ch.acc === 'mask2') box(put, X(hx0 + 0.6), Y(hY - 0.4), bw(4), bh(3.2), lc(el.color), kk * 0.9, z + 0.1)
  if (ch.acc === 'sash') box(put, X(lean), Y(tY - 2), bw(5.8), bh(0.8), lc('#ffffff'), kk, z + 0.1)
  if (ch.acc === 'belt') box(put, X(lean), Y(tY - 2.4), bw(5.8), bh(1), lc('#111111'), kk, z + 0.1)
  // eyes & mouth
  const hurt = f.st === 'hit' || f.st === 'air'
  const ex = hx0 + 0.9
  if (ch.acc !== 'visor') { box(put, X(ex - 0.5), Y(hY + 0.3), bw(0.8), bh(hurt ? 0.4 : 1), [0.05, 0.05, 0.1], 1, z + 0.2); box(put, X(ex + 1.1), Y(hY + 0.3), bw(0.8), bh(hurt ? 0.4 : 1), [0.05, 0.05, 0.1], 1, z + 0.2) }
  box(put, X(ex + 0.3), Y(hY - 1.2), bw(hurt || f.atk ? 1.2 : 1.6), bh(hurt || f.atk ? 0.9 : 0.35), [0.4, 0.05, 0.1], 1, z + 0.2)
  // arms
  const shY = tY + 2.4
  P.hands.forEach(([hx, hy], i) => {
    const sx = (i ? -1 : 1) * 0.6 + lean
    const wy = hy - drop * (f.st === 'crouch' ? 0.2 : 0.7)
    limb(put, X(sx), Y(shY), X(hx), Y(wy), bw(2), top, kk * 0.9, z + 0.3, 5)
    box(put, X(hx), Y(wy), bw(2.4), bh(2.4), skin, kk, z + 0.4)
    if (f.atk && !f.atk.normal && f.atk.pose === 'cast') { const gc = lc(el.glow); box(put, X(hx + 1), Y(wy), bw(1.4), bh(1.4), gc, 2, z + 0.5) }
  })
  // afterimage trail on fast attacks
  if (f.atk && !f.atk.normal && f.atk.vel && Math.abs(f.vx) > 30) for (let i = 1; i <= 3; i++) { const ac = lc(el.color); box(put, f.x - dir * i * 3.5, base + 7, 3, 9, ac, 0.5 / i, 0) }
  if (f.st === 'win') for (let i = 0; i < 4; i++) { const a = t * 3 + i * 1.57; put(f.x + Math.cos(a) * 6, base + 17 + Math.sin(a * 2) * 1.4, 3, 0.9, 0.9, 2.4, 2.2, 0.4) }
}
function drawProj(put, p, t) {
  const c = lc(p.color), g = lc(p.glow)
  switch (p.kind) {
    case 'ball': for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2 + t * 10; put(p.x + Math.cos(a) * p.r * 0.6, p.y + Math.sin(a) * p.r * 0.6, 2, 1.1, 1.1, c[0] * 2, c[1] * 2, c[2] * 2) } put(p.x, p.y, 3, p.r, p.r, g[0] * 2.4, g[1] * 2.4, g[2] * 2.4); for (let i = 1; i <= 4; i++) put(p.x - p.dir * i * 2, p.y, 1, p.r * (1 - i * 0.18), p.r * (1 - i * 0.18), c[0] * 1.2, c[1] * 1.2, c[2] * 1.2); break
    case 'beam': case 'laser': for (let i = 0; i < 9; i++) put(p.x - p.dir * i * 1.8, p.y, 2, 2, p.r * 1.4 * (1 - i * 0.07), (i < 2 ? g : c)[0] * 2.4, (i < 2 ? g : c)[1] * 2.4, (i < 2 ? g : c)[2] * 2.4); break
    case 'fist': put(p.x, p.y, 3, 3.2, 3.2, 2.2, 2, 1.6); put(p.x - p.dir * 2.4, p.y, 2, 2.2, 2.2, c[0] * 2, c[1] * 2, c[2] * 2); for (let i = 2; i < 7; i++) put(p.x - p.dir * (i * 2 + 1), p.y + Math.sin(t * 30 + i) * 0.7, 1, 1.4, 1.4, c[0], c[1], c[2]); break
    case 'wave': for (let j = -3; j <= 3; j++) for (let i = 0; i < 4; i++) { const w = Math.abs(j) / 3; put(p.x - p.dir * (i * 1.6 + w * 3), p.y + j * 1.5, 2, 1.8, 1.7, (i === 0 ? g : c)[0] * 2.2, (i === 0 ? g : c)[1] * 2.2, (i === 0 ? g : c)[2] * 2.2) } break
    case 'megabeam': { const len = 90; const fade = Math.min(1, p.life * 2); for (let x = 0; x < len; x += 2.2) { const th = 3.4 + Math.sin(t * 40 + x) * 0.5; put(p.x + p.dir * x, p.y, 2, 2.4, th * 1.7, g[0] * 2.4 * fade, g[1] * 2.4 * fade, g[2] * 2.4 * fade); put(p.x + p.dir * x, p.y, 1, 2.4, th * 2.8, c[0] * 1.2 * fade, c[1] * 1.2 * fade, c[2] * 1.2 * fade) } break }
    case 'tornado': for (let j = 0; j < 9; j++) { const a = t * 14 + j * 0.9, w = 1.2 + j * 0.42; put(p.x + Math.cos(a) * w, p.y - 4 + j * 1.15, 2, 1.4, 1.2, (j % 2 ? g : c)[0] * 2, (j % 2 ? g : c)[1] * 2, (j % 2 ? g : c)[2] * 2) } break
    case 'groundwave': for (let i = 0; i < 5; i++) put(p.x - p.dir * i * 1.6, FLOOR + 1.5 + Math.abs(Math.sin(t * 20 + i)) * (5 - i) * 0.9, 2, 1.8, 2.4, (i < 2 ? g : c)[0] * 2.2, (i < 2 ? g : c)[1] * 2.2, (i < 2 ? g : c)[2] * 2.2); break
    default: put(p.x, p.y, 2, 2, 2, c[0] * 2, c[1] * 2, c[2] * 2)
  }
}
function drawStage(put, t) {
  const el = ELEMENTS[ROSTER[FT.cfg.p2] ? ROSTER[FT.cfg.p2].element : 'fire']
  const c = lc(el.color), g = lc(el.glow)
  const pulse = 0.5 + 0.5 * Math.sin(t * 2)
  // sky gradient bands
  for (let gy = -28; gy <= 28; gy += 4) for (let gx = -50; gx <= 50; gx += 4) {
    const v = 0.04 + (gy + 28) / 56 * 0.1 + 0.012 * Math.sin(t * 1.4 + gx * 0.3 + gy * 0.2)
    put(gx, gy, -14, 4, 4, c[0] * v * 1.4, c[1] * v * 1.4, c[2] * v * 1.6)
  }
  // distant skyline per element
  for (let i = 0; i < 16; i++) {
    const x = -50 + i * 6.4, h = 8 + ((i * 7) % 5) * 3 + (el.name === 'ICE' ? 4 : 0)
    for (let y = 0; y < h; y += 2.2) put(x, FLOOR + 3 + y, -9, 5.2, 2.2, c[0] * 0.14, c[1] * 0.14, c[2] * 0.2)
    if (el.name === 'THUNDER' && (i * 13 + Math.floor(t * 2)) % 7 === 0) put(x, FLOOR + 6 + h, -8.5, 0.8, 0.8, g[0] * 1.6, g[1] * 1.6, g[2] * 0.6)
  }
  if (el.name === 'FIRE') for (let i = 0; i < 12; i++) put(-46 + i * 8 + Math.sin(t * 2 + i) * 1.5, FLOOR + 1 + ((t * 8 + i * 5) % 14), -6, 2.2, 2.2, 2.2, 0.8, 0.1)
  if (el.name === 'SHADOW') { put(30, 18, -10, 12, 12, 0.7, 0.6, 1); put(32, 19, -9.9, 10, 10, 0.05, 0.04, 0.12) }
  if (el.name === 'ICE') for (let i = 0; i < 10; i++) put(-45 + i * 10 + Math.sin(t + i) * 1, 22 - ((t * 3 + i * 7) % 40) + 8, -7, 0.9, 0.9, 1.6, 2, 2.4)
  if (el.name === 'THUNDER' && Math.floor(t * 3) % 11 === 0) for (let y = 28; y > -8; y -= 2) put(-10 + Math.sin(y) * 3, y, -8, 1, 2.2, 2.4, 2.4, 1.4)
  // floor
  for (let x = -50; x <= 50; x += 2.4) { put(x, FLOOR - 0.6, -2, 2.6, 1.4, c[0] * (0.5 + pulse * 0.3), c[1] * (0.5 + pulse * 0.3), c[2] * (0.5 + pulse * 0.3)); put(x, FLOOR - 2.4, -2, 2.6, 2.2, c[0] * 0.12, c[1] * 0.12, c[2] * 0.14) }
  for (let x = -50; x <= 50; x += 7) put(x, FLOOR - 4.4, -3, 0.5, 3, c[0] * 0.3, c[1] * 0.3, c[2] * 0.3)
}
function draw(api) {
  const { put } = api
  const t = G.time
  drawStage(put, t)
  if (!FT.f.length) return
  // shadows
  for (const f of FT.f) if (f.vis > 0.01) put(f.x, FLOOR - 0.2, -1, 6 * f.ch.w * (1 - Math.min(0.6, f.y / 30)), 1.2, 0.02, 0.02, 0.05)
  const order = FT.f.slice().sort((a, b) => (a.st === 'attack' ? 1 : 0) - (b.st === 'attack' ? 1 : 0))
  for (const f of order) drawFighter(put, f, t)
  for (const p of FT.proj) drawProj(put, p, t)
  for (const q of G.parts) { const fq = q.life / q.max; put(q.x, q.y, 6, q.s * (0.35 + 0.65 * fq) * 0.9, q.s * (0.35 + 0.65 * fq) * 0.9, q.c[0] * 1.8, q.c[1] * 1.8, q.c[2] * 1.8) }
  api.pops(G.pops, 0)
  // super cinematic: darken the arena and streak speed lines
  if (FT.cine) {
    const ec = lc(FT.cine.color), k = Math.min(1, FT.cine.t * 6)
    for (let gx = -50; gx <= 50; gx += 4) for (let gy = -28; gy <= 28; gy += 4) put(gx, gy, 0.5, 4.2, 4.2, 0.01, 0.01, 0.03)
    const ow = FT.f[FT.cine.owner]
    for (let i = 0; i < 26; i++) { const a = (i / 26) * Math.PI * 2 + FT.cine.t * 3, r0 = 8 + ((i * 7 + t * 60) % 40); put(ow.x + Math.cos(a) * r0, FLOOR + 8 + Math.sin(a) * r0 * 0.7, 5, 6 * k, 0.8, ec[0] * 2.4, ec[1] * 2.4, ec[2] * 2.4) }
    for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2 + t * 6; put(ow.x + Math.cos(a) * 7, FLOOR + 8 + Math.sin(a) * 9, 6, 1.4, 1.4, ec[0] * 2.4, ec[1] * 2.4, ec[2] * 2.4) }
  }
}
if (typeof window !== 'undefined') { window.__FT = FT; window.__fight = fightActions }
games.fight = { update, onKey, draw, stop, sky: () => '#06040e' }
