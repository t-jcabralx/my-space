import { animeHead } from './artDirection.js'
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
  FT.wins = [0, 0]; FT.round = 1; FT.over = null; FT.paused = false; FT.say = null; FT.cine = null; FT.fin = null; FT.stats = { hits: 0, specials: 0, supers: 0, blocked: 0, maxCombo: 0 }
  G.mode = 'fight'; G.parts = []; G.pops = []; G.shake = 0; G.flash = 0
  FT.mode = 'play'
  music.set('fight', 0)
  newRound(); sfx('mission'); emitFt()
}
function stop() { if (FT.net) { const n = FT.net; FT.net = null; if (n.onStop) try { n.onStop() } catch { /* ignore */ } } FT.mode = 'idle'; FT.paused = false; music.set('menu'); emitFt() }
function newRound() {
  FT.f.forEach((f, i) => {
    Object.assign(f, { x: i === 0 ? -16 : 16, y: 0, vx: 0, vy: 0, face: i === 0 ? 1 : -1, hp: f.maxHp, st: 'idle', t: 0, atk: null, stun: 0, inv: 0, armor: false, crouch: false, block: false, combo: 0, hitsDealt: 0, comboT: 0, spCd: 0, buf: null, flash: 0, vis: 1, held: null, airAtk: false, lean: 0, dizzy: 0, aiPlan: null, counterT: 0, slowT: 0, burn: null, shockX: 0 })
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
function dirOf(f) {
  const i = f.inp || {}
  const fwd = i.dx !== 0 && i.dx === f.face, back = i.dx !== 0 && i.dx === -f.face
  return (i.down ? 'd' : '') + (fwd ? 'f' : back ? 'b' : '')
}
// Every strike (plain normal, command move or string) goes through here. spec uses the MOVES field names.
function startStrike(f, base, id, chained = false) {
  const ch = f.ch
  const m = { ...base, su: base.su / ch.spd, rc: base.rc / ch.spd, dmg: base.dmg * ch.pow, reach: base.reach * ch.reach }
  const el = ELEMENTS[ch.element]
  const hits = Math.max(1, m.hits || 1)
  const frames = []
  for (let k = 0; k < hits; k++) {
    const t0 = m.su + k * (m.ac + 0.04)
    frames.push({ t0, t1: t0 + m.ac, dmg: m.dmg / hits * (hits > 1 ? 1.15 : 1), hs: m.hs, bs: m.bs, kb: m.kb, reach: m.reach, y: m.y, hh: m.hh + (m.track ? 2 : 0), lvl: m.lvl, launch: !!m.launch && k === hits - 1, knock: !!m.knock && k === hits - 1, gb: !!m.gb, grab: !!m.grab, sfx: m.sfx, fx: !!m.fx, done: false, lock: hits > 1 })
  }
  const end = m.su + hits * (m.ac + 0.04)
  const A = { m, id, name: m.name, t: 0, dur: end + m.rc, limb: m.limb, frames, on: [], normal: true, chained, color: el.color, glow: el.glow }
  if (m.grab) { A.frames[0].big = false; A.frames[0].y = 7; A.frames[0].hh = 6 }
  if (m.step) A.vel = (t) => (t > m.su * 0.5 && t < end ? f.face * m.step : t < m.su * 0.5 ? 0 : null)
  if (m.vy || m.vx) A.on.push({ t: 0.02, fn: () => { f.vy = m.vy || 0; f.vx = f.face * (m.vx || 0) } })
  if (m.proj) A.on.push({ t: m.su, fn: () => { spawnProj(f, { dmg: m.pdmg || m.dmg, kind: 'ball', vx: 40, y: m.y, r: 1.7, life: 2, hs: 0.35, bs: 0.16, color: el.color, glow: el.glow, fx: true }); sfx('fFire') } })
  f.inv = Math.max(f.inv, m.inv || 0)
  f.armor = !!m.armor
  f.st = 'attack'; f.t = 0; f.atk = A
  if (!m.vy && !m.vx && !m.step && f.y <= 0.001) f.vx = 0
  sfx('fWhiff')
  if (m.dmg >= 9 || Math.random() < 0.3) sfx('fVoice', { id: ch.id, f: ch.gender === 'f', kind: 'atk' })
  return true
}
function startNormal(f, btn) {
  const air = f.y > 0.6
  if (air) { if (f.airAtk) return false; const base = MOVES[btn === 'lp' || btn === 'hp' ? 'ap' : 'ak']; f.airAtk = true; return startStrike(f, base, null) }
  // command moves: direction + button (Tekken-style), then the crouch normals, then the plain normals
  const d = dirOf(f)
  if (d) { const c = f.ch.cmd[`${d}+${btn}`]; if (c) return startStrike(f, c, c.slot) }
  const id = f.crouch ? 'c' + btn : btn
  const base = MOVES[id]
  if (!base) return false
  return startStrike(f, base, f.crouch ? null : btn)
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
      spawn(0.24, { kind: 'ball', vx: spec.speed || 34, y: 9, r: spec.size || 2.4, life: 3, hs: 0.45, bs: 0.2, sfx: 'fFire' })
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
      A.on.push({ t: 0.22, fn: () => { spawnProj(f, { dmg: d, kind: 'fist', vx: spec.speed || 50, y: 9.4, r: 2, life: 1.6, hs: 0.5, bs: 0.22, color: el.color, glow: el.glow }); sfx('fFire') } })
      break
    case 'volley':
      A.dur = 1.5; A.pose = 'cast'
      for (let k = 0; k < spec.hits; k++) A.on.push({ t: 0.3 + k * 0.17, fn: () => { spawnProj(f, { dmg: d / spec.hits, kind: 'laser', vx: 80, y: 6 + k * 1.6, r: 1.2, life: 1.2, hs: 0.35, bs: 0.15, color: el.color, glow: el.glow, launch: k === spec.hits - 1 }); sfx('fBeam') } })
      break
    case 'lunge': {
      const sumo = ch.style === 'sumo', big = isSuper
      A.dur = big ? 1.2 : 0.8; A.pose = ch.style === 'muay' ? 'knee' : 'lunge'; A.armor = sumo || big || ['wrestler', 'robot', 'brawler'].includes(ch.style)
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
      A.frames.push({ t0: 0.32, t1: 0.46, dmg: d, hs: 0.5, bs: 0.2, kb: 6, reach: 8.5, y: 8, hh: 4, lvl: 'mid', launch: isSuper, gb: isSuper, knock: !isSuper, sfx: 'fHeavy', done: false })
      break
    case 'pillar': {
      const n = isSuper ? Math.max(2, spec.hits || 3) : 1
      A.dur = 0.7 + n * 0.4; A.pose = 'stomp'
      for (let k = 0; k < n; k++) A.on.push({ t: 0.25 + k * 0.4, fn: () => { spawnProj(f, { kind: 'warn', at: clamp(o.x + (k ? R(-8, 8) : 0), -XMAX, XMAX), y: 1, r: 3, life: 1, eruptAt: 0.42, dmg: d / n, color: el.color, glow: el.glow, vx: 0 }); sfx('fRise'); shake(0.4) } })
      break
    }
    case 'fan': {
      const n = isSuper ? Math.max(3, spec.hits || 5) : 3
      A.dur = isSuper ? 1.2 : 0.7; A.pose = 'cast'
      A.on.push({ t: 0.25, fn: () => { for (let k = 0; k < n; k++) { const u = n === 1 ? 0 : k / (n - 1) - 0.5; spawnProj(f, { dmg: d / n, kind: 'beam', vx: 44, vy: u * 34, y: 8.5, r: isSuper ? 1.9 : 1.4, life: 1.4, hs: 0.32, bs: 0.15, color: el.color, glow: el.glow, launch: isSuper && k === n - 1 }) } sfx('fBeam') } })
      break
    }
    case 'counter':
      A.dur = 0.95; A.pose = 'counter'
      A.on.push({ t: 0.02, fn: () => { f.counterT = 0.55; sfx('fBlock'); ring(f.x, FLOOR + f.y + 8, 12, 24, [rgb(el.color), rgb(el.glow)]) } })
      break
    case 'boomerang':
      A.dur = 0.8; A.pose = 'cast'
      A.on.push({ t: 0.2, fn: () => { spawnProj(f, { dmg: d, kind: 'boomerang', vx: 46, y: 8.5, r: 2.2, life: 1.9, turn: 0.55, hs: 0.38, bs: 0.18, color: el.color, glow: el.glow }); sfx('fDash') } })
      break
    case 'rain': {
      const n = Math.max(4, spec.hits || 6)
      A.dur = 0.5 + n * 0.14 + 0.7; A.pose = 'sky'
      A.on.push({ t: 0.05, fn: () => sfx('fRise') })
      for (let k = 0; k < n; k++) A.on.push({ t: 0.3 + k * 0.14, fn: () => { spawnProj(f, { dmg: d / n, kind: 'rock', at: clamp(o.x + R(-16, 16) * (k % 2 ? 1 : 0.4), -XMAX, XMAX), absY: 34, vx: 0, vy: -64, r: 2, life: 1.3, hs: 0.3, bs: 0.14, color: el.color, glow: el.glow, launch: k === n - 1 }); sfx('fWhiff') } })
      break
    }
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
  sfx('fSpecial'); sfx('fVoice', { id: f.ch.id, f: f.ch.gender === 'f', kind: 'special' }); burst(f.x, f.y + 7, ELEMENTS[f.ch.element])
  return true
}
function startSuper(f) {
  if (f.meter < 100) return false
  f.meter = 0
  FT.stats.supers++
  const el = ELEMENTS[f.ch.element]
  FT.cine = { t: 0, dur: 0.95, owner: f.id, name: f.ch.super.name.toUpperCase(), color: el.color }
  f.st = 'cine'; f.t = 0; f.inv = 2
  sfx('fSuper'); sfx('fVoice', { id: f.ch.id, f: f.ch.gender === 'f', kind: 'special' }); sfx('fCrowd'); speak(f.ch.super.name.toLowerCase(), 0.8, 0.9)
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
  FT.proj.push({ owner: f.id, x: p.at !== undefined ? p.at : f.x + dir * (p.kind === 'megabeam' ? 4 : 5), y: p.absY !== undefined ? p.absY : FLOOR + f.y + (p.y || 8), vx: (p.vx || 0) * dir, vy: p.vy || 0, fx: p.fx !== false, turn: p.turn || 0, eruptAt: p.eruptAt || 0, dir, kind: p.kind, dmg: p.dmg, hs: p.hs || 0.4, bs: p.bs || 0.2, color: p.color, glow: p.glow, r: p.r || 2, life: p.life || 2, t: 0, pierce: !!p.pierce, tickT: 0, tick: p.tick || 0, hitCount: 0, launch: !!p.launch, fixed: !!p.fixed, both: !!p.both, low: !!p.low, final: !!p.final, dead: false, hitOnce: new Set() })
}
function stepProj(p, dt) {
  p.t += dt; p.life -= dt
  const ow = FT.f[p.owner], o = FT.f[1 - p.owner]
  if (p.fixed) { p.x = ow.x + ow.face * 4; p.dir = ow.face; p.y = FLOOR + ow.y + 9 }
  else { p.x += p.vx * dt; p.y += (p.vy || 0) * dt }
  if (p.kind === 'boomerang' && p.turn && p.t > p.turn && !p.turned) { p.turned = true; p.vx = -p.vx; p.hitOnce.clear() }
  if (p.kind === 'warn') { if (p.t > p.eruptAt) { p.dead = true; spawnProj(ow, { kind: 'pillar', at: p.x, y: 1, r: 3.4, life: 0.32, dmg: p.dmg, hs: 0.7, bs: 0.3, launch: true, color: p.color, glow: p.glow, vx: 0 }); shake(1); sfx('fSlam'); ring(p.x, FLOOR + 1, 18, 50, [rgb(p.color), rgb(p.glow)]) } return }
  if (p.kind === 'rock' && p.y < FLOOR + 1) { p.dead = true; ring(p.x, FLOOR + 1, 7, 30, [rgb(p.color), rgb(p.glow)]); return }
  if (p.kind === 'tornado') p.y = FLOOR + 7 + Math.sin(p.t * 9) * 1.2
  if (p.life <= 0 || Math.abs(p.x) > 62) { p.dead = true; return }
  if (Math.random() < dt * 40) part(p.x, p.y + R(-p.r, p.r), R(-8, 8), R(-6, 10), 0.3, rgb(Math.random() < 0.5 ? p.color : p.glow), R(0.6, 1.2))
  // collide
  const hb = hurtBox(o)
  const len = p.kind === 'megabeam' ? 90 : p.kind === 'groundwave' ? 4 : p.r
  const x0 = p.kind === 'megabeam' ? Math.min(p.x, p.x + p.dir * len) : p.x - len, x1 = p.kind === 'megabeam' ? Math.max(p.x, p.x + p.dir * len) : p.x + len
  const worldY = p.kind === 'groundwave' ? FLOOR + 1.5 : p.kind === 'pillar' ? FLOOR + 9 : p.y
  const r = p.kind === 'megabeam' ? 3.4 : p.kind === 'pillar' ? 10 : p.r
  const overlap = x1 > hb.x0 && x0 < hb.x1 && worldY + r > FLOOR + hb.y0 && worldY - r < FLOOR + hb.y1
  if (!overlap) return
  if (p.low && o.y > 3) return // the shockwave runs along the floor: jump over it
  if (p.tick) { p.tickT -= dt; if (p.tickT > 0) return; p.tickT = p.tick } else if (p.hitOnce.has(o.id)) return
  p.hitOnce.add(o.id)
  p.hitCount++
  const lastHit = p.final && p.life < p.tick + 0.05
  const res = applyHit(ow, o, { dmg: p.dmg, hs: p.hs, bs: p.bs, kb: p.kind === 'tornado' ? 1 : 5, lvl: p.low ? 'low' : 'mid', launch: p.launch && (lastHit || !p.tick), sfx: 'fHit', proj: true, fx: p.fx, color: p.color, noBlockStun: false })
  if (res !== 'miss' && !p.pierce && !p.tick) p.dead = true
  if (res === 'block' && p.kind !== 'megabeam') p.dead = !p.pierce
}

// ---------- hit resolution ----------
function comboScale(n) { return Math.max(0.35, 1 - 0.07 * Math.max(0, n - 1)) }
function applyHit(att, def, h) {
  if (def.inv > 0 || def.st === 'ko' || FT.phase === 'ko') return 'miss'
  const dir = Math.sign(def.x - att.x) || att.face
  if (def.counterT > 0 && !h.grab && def.st === 'attack') return counterStrike(att, def, h)
  const canBlock = def.block && !h.grab && !h.gb && (def.st === 'idle' || def.st === 'walk' || def.st === 'crouch' || def.st === 'block' || (def.st === 'hit' && def.blocking)) && def.y < 0.6
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
  if (big || Math.random() < 0.35) sfx('fVoice', { id: def.ch.id, f: def.ch.gender === 'f', kind: 'hurt' })
  FT.stop = Math.max(FT.stop, big ? 0.1 : 0.05)
  if (big) shake(big && dmg > 12 ? 1.6 : 0.8)
  if (def.hp <= 0) { def.hp = 0; return koCheck(att, def, dir) || 'hit' }
  if (def.armor && !h.launch && !h.grab) { def.vx = 0; return 'hit' } // super-armour: takes the hit, keeps going
  elementFx(att, def, dmg, h)
  def.blocking = false
  def.atk = null; def.armor = false; def.vis = 1; def.held = null; def.counterT = 0
  if (h.launch || def.y > 0.6) {
    def.st = 'air'; def.t = 0; def.vy = h.launch ? 34 : 18; def.vx = dir * (h.launch ? 14 : 8); def.stun = 0; def.airHit = true
  } else if (h.knock) {
    def.st = 'air'; def.t = 0; def.vy = 14; def.vx = dir * 20; def.stun = 0
  } else {
    def.st = 'hit'; def.t = 0; def.stun = h.hs + (h.gb ? 0.2 : 0) + (def.shockX || 0); def.vx = dir * (h.kb || 3)
    def.shockX = 0
  }
  return 'hit'
}
// element effects: fire burns, ice slows, thunder shocks (extra stun + meter), shadow drains life
function elementFx(att, def, dmg, h) {
  if (!(h.fx || h.special || h.proj)) return
  const E = ELEMENTS[att.ch.element]
  const fx = E.fx
  if (fx === 'burn') { def.burn = { t: 3, dps: 1 + dmg * 0.07 }; for (let i = 0; i < 6; i++) part(def.x, FLOOR + def.y + 8, R(-8, 8), R(4, 18), R(0.3, 0.6), rgb(i % 2 ? '#ff6a2a' : '#ffd23a'), R(0.8, 1.4)) }
  else if (fx === 'freeze') { def.slowT = 2.4; for (let i = 0; i < 6; i++) part(def.x, FLOOR + def.y + 8, R(-8, 8), R(2, 12), R(0.3, 0.6), rgb(i % 2 ? '#e6fbff' : '#5ad8ff'), R(0.8, 1.3)) }
  else if (fx === 'shock') { def.shockX = 0.12; att.meter = Math.min(100, att.meter + 3); for (let i = 0; i < 6; i++) part(def.x + R(-3, 3), FLOOR + def.y + R(2, 14), R(-14, 14), R(-8, 14), R(0.15, 0.35), rgb('#ffffff'), R(0.7, 1.2)) }
  else if (fx === 'drain') { const g = Math.min(att.maxHp - att.hp, dmg * 0.22); if (g > 0) { att.hp += g; for (let i = 0; i < 5; i++) part(def.x, FLOOR + def.y + 8, (att.x - def.x) * 2 + R(-4, 4), R(-2, 10), R(0.3, 0.6), rgb('#ff4de1'), R(0.8, 1.2)) } }
}
// counter stance: absorbs a strike and hits back
function counterStrike(att, def, h) {
  def.counterT = 0; def.atk = null; def.st = 'idle'; def.t = 0; def.vis = 1
  const el = ELEMENTS[def.ch.element]
  const dmg = def.ch.special.dmg * 1.15
  sfx('fSpecial'); sfx('fHeavy'); say('COUNTER!', el.color, 1)
  ring(att.x, FLOOR + att.y + 8, 16, 50, [rgb(el.color), rgb('#ffffff')]); shake(1.6); FT.stop = Math.max(FT.stop, 0.14)
  const dir = Math.sign(att.x - def.x) || def.face
  att.hp -= dmg; att.flash = 0.15; def.meter = Math.min(100, def.meter + dmg * 0.6); att.combo++; def.hitsDealt = att.combo
  FT.stats.hits++
  if (att.hp <= 0) { att.hp = 0; koCheck(def, att, dir); return 'block' }
  att.atk = null; att.armor = false; att.st = 'air'; att.t = 0; att.vy = 26; att.vx = dir * 16; att.airHit = true
  return 'block'
}
function koCheck(att, def, dir) {
  FT.phase = 'ko'; FT.phaseT = 0; FT.slow = 0.35
  def.st = 'ko'; def.t = 0; def.vy = 24; def.vx = dir * 16; def.atk = null; def.vis = 1
  sfx('fKO'); sfx('fVoice', { id: def.ch.id, f: def.ch.gender === 'f', kind: 'ko' }); sfx('fCrowd'); shake(3); flash(0.7, [1, 1, 1]); say('K.O.!', '#ff3b4e', 2)
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
  if (FT.phase === 'finish') { if (FT.fin && FT.fin.state === 'wait' && (btn === 'su' || btn === 'sp') && f.id === FT.fin.win) startFinisher(); return }
  if (f.st === 'ko' || FT.phase !== 'fight' || FT.cine) return
  if (f.st === 'attack' && f.atk && f.atk.normal && f.atk.id && !f.atk.chained && ['lp', 'hp', 'lk', 'hk'].includes(btn)) {
    const c = f.ch.chain[`${f.atk.id}>${btn}`]
    if (c && f.atk.t >= f.atk.m.su * 0.9) { startStrike(f, c, c.slot, true); return }
  }
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
  if (f.counterT > 0) f.counterT -= dt
  if (f.slowT > 0) f.slowT -= dt
  if (f.burn) { f.burn.t -= dt; f.hp = Math.max(1, f.hp - f.burn.dps * dt); if (Math.random() < dt * 14) part(f.x + R(-2, 2), FLOOR + f.y + R(2, 12), R(-3, 3), R(6, 16), 0.4, rgb(Math.random() < 0.5 ? '#ff6a2a' : '#ffd23a'), R(0.7, 1.2)); if (f.burn.t <= 0) f.burn = null }
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
        if (inp.dx && FT.phase === 'fight') { f.st = 'walk'; f.vx = inp.dx * (inp.dx === f.face ? 15 : 11) * f.ch.spd * (f.slowT > 0 ? 0.62 : 1) } else { f.st = 'idle'; f.vx *= 0.6; if (Math.abs(f.vx) < 0.5) f.vx = 0 }
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
  } else if (FT.phase === 'finish') {
    stepFinish(sdt)
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
  if (winner >= 0) { sfx('fWin'); sfx('fCrowd'); sfx('fVoice', { id: FT.f[winner].ch.id, f: FT.f[winner].ch.gender === 'f', kind: 'win' }); if (FT.f[winner].human) { speak(perfect ? 'Perfect!' : 'You win', 0.9, 1.1) } }
  void a; void b
  // the match is decided by a K.O.: the winner gets a moment to finish the loser
  if (winner >= 0 && why === 'K.O.' && FT.wins[winner] >= FT.cfg.rounds && FT.cfg.type !== 'demo' && FT.f[1 - winner].hp <= 0) {
    const w = FT.f[winner], l = FT.f[1 - winner]
    FT.phase = 'finish'; FT.phaseT = 0
    FT.fin = { t: 0, state: 'wait', win: winner, vic: 1 - winner, kind: w.ch.element, dur: 4.4, hideAt: { fire: 1.9, ice: 1.5, thunder: 0.9, shadow: 1.5 }[w.ch.element] || 1.5, name: FINISHERS[w.ch.element] || 'FINISHER', ox: l.x, oy: l.y, ai: !w.human && !w.remote, aiAt: 1.1 + Math.random() * 1.3 }
    FT.msg = { text: 'FINISH HIM!', sub: w.human || w.remote ? 'PRESS SPECIAL OR SUPER' : '', color: '#ff2a2a', t: 4.8 }
    sfx('fRound'); speak('Finish him!', 0.5, 0.9)
  }
}
const FINISHERS = { fire: 'INFERNO', ice: 'ABSOLUTE ZERO', thunder: 'THUNDER GOD', shadow: 'SOUL EATER' }
function startFinisher() {
  const F = FT.fin
  if (!F || F.state !== 'wait') return
  const l = FT.f[F.vic], w = FT.f[F.win], el = ELEMENTS[F.kind]
  F.state = 'play'; F.t = 0; F.ox = l.x; F.oy = l.y; FT.slow = 0.7
  FT.msg = { text: F.name, sub: 'FINISHER', color: el.color, t: 3.4 }
  sfx('fSuper'); sfx('fSlam'); shake(1.4); flash(0.5, [1, 1, 1]); speak(F.name.toLowerCase(), 0.5, 0.9)
  void w
}
function stepFinish(dt) {
  const F = FT.fin
  if (!F) { FT.phase = 'result'; FT.phaseT = 0; return }
  F.t += dt
  const l = FT.f[F.vic]
  if (F.state === 'wait') {
    if (F.ai && !F.aiDone && F.t > F.aiAt) { F.aiDone = true; if (Math.random() < 0.8) startFinisher() }
    if (F.t > 5) { FT.fin = null; FT.phase = 'result'; FT.phaseT = 0 }
  } else {
    if (!F.hid && F.t >= F.hideAt) { F.hid = true; l.vis = 0; shake(1.8); flash(0.6, [1, 1, 1]); sfx(F.kind === 'ice' ? 'fBlock' : F.kind === 'thunder' ? 'fBeam' : 'fHeavy'); sfx('fKO') }
    if (F.t > F.dur) { FT.slow = 1; FT.phase = 'result'; FT.phaseT = 0; F.done = true }
  }
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
    fin: FT.fin ? { t: r2(FT.fin.t), s: FT.fin.state, w: FT.fin.win, v: FT.fin.vic, k: FT.fin.kind, d: FT.fin.dur, h: FT.fin.hideAt, n: FT.fin.name, ox: r2(FT.fin.ox), oy: r2(FT.fin.oy) } : null,
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
  if (FT.fin) FT.fin.t += dt * (FT.fin.state === 'play' ? 0.7 : 1)
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
    FT.fin = s.fin ? { t: s.fin.t, state: s.fin.s, win: s.fin.w, vic: s.fin.v, kind: s.fin.k, dur: s.fin.d, hideAt: s.fin.h, name: s.fin.n, ox: s.fin.ox, oy: s.fin.oy } : null
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
    case 'walk': {
      const phase = f.t * 12, stride = Math.sin(phase) * 2.1
      P.feet = [[-1.6 + stride, Math.max(0, Math.cos(phase)) * 0.9], [1.6 - stride, Math.max(0, -Math.cos(phase)) * 0.9]]
      P.drop = Math.abs(Math.sin(phase)) * 0.3
      P.lean = (f.inp?.dx || 0) * f.face * 0.35
      P.hands = [[3.6 - stride * 0.12, 11.2 + bob], [2.4 + stride * 0.12, 10 - bob]]
      break
    }
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
        // Travel out of anticipation into contact continuously; recover into guard.
        const launch = Math.min(0.045, su * 0.4)
        const ext = u < su - launch ? -ease(u / (su - launch)) * 0.22 : u < su ? -0.22 + 1.22 * ease((u - su + launch) / launch) : u < su + ac ? 1 : 1 - ease((u - su - ac) / m.rc)
        const lowHand = m.y < 5
        if (m.pose === 'knee') { const tx = 1.5 + (m.reach - 1.5) * 0.7 * ext; P.feet = [[-1.8, 0], [tx, Math.max(3, m.y - 1) + 2 * ext]]; P.hands = [[3.4, 11.4], [2, 10.4]]; P.lean = 0.7 * ext; P.drop = 0 }
        else if (m.pose === 'axe') { const lift = u < su ? ease(u / su) : 1 - Math.min(1, (u - su) / (ac + 0.1)); P.feet = [[-1.8, 0], [2 + (m.reach - 4) * ext * 0.5, 4 + 9 * lift - 4 * ext]]; P.hands = [[3, 10.5], [1.5, 10]]; P.lean = -0.6 }
        else if (m.limb === 'rh' || m.limb === 'lh') {
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
          case 'counter': P.hands = [[3.4, 13], [2.6, 11.4]]; P.lean = -0.9; P.drop = 0.8 + Math.sin(A.t * 30) * 0.2; P.feet = [[-2.2, 0], [2.2, 0]]; break
          case 'stomp': { const k = A.t < 0.25 ? ease(A.t / 0.25) : 1 - Math.min(1, (A.t - 0.25) * 4); P.feet = [[-1.6, 0], [1.8, 4.6 * Math.max(0, k)]]; P.hands = [[3, 12], [1, 11]]; P.lean = -0.4; break }
          case 'sky': { P.hands = [[1.4, 15 + Math.sin(A.t * 14)], [-1.4, 15 + Math.cos(A.t * 14)]]; P.feet = [[-1.6, 0], [1.6, 0]]; P.drop = -0.6; break }
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
// ---------- 3D fighter rig (lit boxes: real depth, rotated limbs, shadows) ----------
function ik2(ax, ay, tx, ty, l1, l2, bend) {
  let dx = tx - ax, dy = ty - ay
  let d = Math.hypot(dx, dy) || 0.001
  const max = l1 + l2 - 0.02, min = Math.abs(l1 - l2) + 0.05
  const dd = clamp(d, min, max)
  const a0 = Math.atan2(dy, dx)
  const A = Math.acos(clamp((l1 * l1 + dd * dd - l2 * l2) / (2 * l1 * dd), -1, 1))
  const ea = a0 + bend * A
  return { ex: ax + Math.cos(ea) * l1, ey: ay + Math.sin(ea) * l1, hx: ax + Math.cos(a0) * dd, hy: ay + Math.sin(a0) * dd }
}
const mul = (c, k) => [c[0] * k, c[1] * k, c[2] * k]
function drawFighter3(api, f, t) {
  const put3 = api.putBody || api.put3
  if (f.vis <= 0.01 && f.st !== 'cine') return
  const ch = f.ch, el = ELEMENTS[ch.element], dir = f.face
  const P = poseOf(f, t)
  const sw = ch.w, sh = ch.h, k = 0.95
  const flash = f.flash > 0 ? 1.7 : 1
  const skin = lc(ch.skin), top = lc(ch.top), pants = lc(ch.pants), hair = lc(ch.hair), trim = lc(ch.trim), gl = lc(ch.gloves), glow = lc(el.glow), ec = lc(el.color)
  const outfit = ch.outfit, base = FLOOR + f.y
  // local -> world (x forward along the facing direction; z toward the camera)
  const W = (lx) => f.x + dir * lx * k * (0.5 + 0.5 * sw)
  const Yw = (ly) => base + ly * k * sh
  const bx = (lx, ly, lz, sx, sy, szz, col, sh2 = 1, rz = 0) => put3(W(lx), Yw(ly), lz * k * sw, sx * k * (0.55 + 0.45 * sw), sy * k * sh, szz * k * sw, dir > 0 ? rz : -rz, col[0] * sh2 * flash, col[1] * sh2 * flash, col[2] * sh2 * flash)
  // limb between two local points
  const limb3 = (x0, y0, x1, y1, th, lz, col, sh2) => {
    const wx0 = W(x0), wy0 = Yw(y0), wx1 = W(x1), wy1 = Yw(y1)
    const len = Math.hypot(wx1 - wx0, wy1 - wy0) + th * 0.32
    put3((wx0 + wx1) / 2, (wy0 + wy1) / 2, lz * k * sw, len, th * k, th * k * (0.7 + 0.3 * sw), Math.atan2(wy1 - wy0, wx1 - wx0), col[0] * sh2 * flash, col[1] * sh2 * flash, col[2] * sh2 * flash)
  }
  const bareArms = ['tank', 'jacket', 'shorts', 'mawashi', 'tights'].includes(outfit)
  const bareLegs = ['shorts', 'mawashi', 'tights'].includes(outfit) && outfit !== 'tights'
  const armCol = bareArms ? skin : outfit === 'robot' ? lc('#b8c0d0') : top
  const legCol = outfit === 'robot' ? lc('#9aa4b8') : pants
  const fat = outfit === 'mawashi' ? 1.35 : 1
  // aura sparks (basic glow, drawn in the main pass)
  if (P.lying) {
    const ko = f.st === 'ko'
    const hy = 1.6
    bx(0, hy + 0.2, 0, 5.6, 3.2 * fat, 5.4, top, 1)
    bx(-3.8, hy + 0.2, 0, 3.6, 3.4, 3.6, skin, 1); bx(-3.6, hy + 1.9, 0, 3.8, 1.2, 3.8, hair, 1)
    bx(4.6, hy - 0.4, 1.3, 6, 2, 2, legCol, 1); bx(4.6, hy - 0.4, -1.3, 6, 2, 2, legCol, 0.8)
    bx(8, hy - 0.6, 1.3, 1.8, 1.2, 2, lc('#1a1a22'), 1); bx(8, hy - 0.6, -1.3, 1.8, 1.2, 2, lc('#1a1a22'), 0.8)
    limb3(1, hy + 0.4, 2.8, hy - 0.4, 1.6, 3.2, armCol, 1); limb3(1, hy + 0.4, -1.5, hy - 0.2, 1.6, -3.2, armCol, 0.8)
    return
  }
  const drop = P.drop || 0, lean = P.lean || 0
  const hipY = 6.4 - drop * 0.5
  const tilt = -lean * 0.09
  const tY = hipY + 3.5 - drop * 0.4
  // ---- legs (IK: thigh + shin) ----
  P.feet.forEach(([fx0, fy0], i) => {
    const near = i === 1, lz = near ? 1.4 : -1.4, shd = near ? 1 : 0.78
    const hx = lean * 0.2, hy0 = hipY - drop * 0.3
    const r = ik2(hx, hy0, fx0, fy0 + 0.9, 3.3, 3.3, 1)
    const thick = (outfit === 'gi' || outfit === 'robe' ? 2.7 : 2.4) * (outfit === 'mawashi' ? 1.3 : 1)
    const upperCol = bareLegs ? (outfit === 'shorts' ? legCol : skin) : legCol
    limb3(hx, hy0, r.ex, r.ey, thick, lz, upperCol, shd)
    limb3(r.ex, r.ey, r.hx, r.hy, thick * 0.88, lz, bareLegs && outfit !== 'shorts' ? skin : bareLegs ? skin : legCol, shd)
    bx(r.ex, r.ey, lz, thick * 0.86, thick * 0.86, thick * 0.86, outfit === 'robot' ? trim : bareLegs ? skin : legCol, shd)
    bx(r.hx + 0.8, Math.max(0.55, r.hy - 0.5), lz, 3.6, 1.3, 2, lc(outfit === 'robot' ? '#59647a' : '#17171f'), shd)
  })
  // ---- pelvis & torso ----
  bx(lean * 0.2, hipY + 0.2 - drop * 0.1, 0, 3.2, 2.4, 4.6 * fat, outfit === 'mawashi' ? lc(ch.pants) : legCol, 1)
  const chestW = 5.7 * (outfit === 'robot' ? 1.1 : 1) * fat
  const bareChest = ['jacket', 'shorts', 'mawashi', 'tights'].includes(outfit)
  const torsoCol = bareChest ? skin : top
  // Rib cage, abdomen and paired pectorals make a readable shoulder-to-waist taper.
  bx(lean * 0.35, tY - 1.55, 0, 3.1 * fat, 2.7, chestW * 0.77, torsoCol, 0.94, tilt)
  bx(lean * 0.45, tY + 0.7, 0, 3.6 * fat, 3.65, chestW, torsoCol, 1, tilt)
  if (bareChest && outfit !== 'mawashi') for (const side of [-1, 1]) {
    bx(lean * 0.45 + 1.35, tY + 1.1, side * chestW * 0.23, 1.1, 1.9, chestW * 0.46, skin, 1.04, tilt)
  }
  if (outfit === 'mawashi') bx(lean * 0.35 + 0.45, tY - 0.8, 0, 4.7, 4.6, chestW * 0.95, skin, 1, tilt)
  // outfit details
  switch (outfit) {
    case 'gi': bx(lean * 0.5 + 1.8, tY + 1.2, 0, 0.5, 2.6, 1.6, skin, 1); bx(lean * 0.3, hipY + 1.1, 0, 3.9, 0.9, 5.9, trim, 1); bx(lean * 0.3 - 1.4, hipY + 0.2, 1.8, 1, 2.4, 0.8, trim, 0.9, -0.2); break
    case 'jacket': bx(lean * 0.45, tY, 2.9, 3.9, 5.5, 1.3, top, 1, tilt); bx(lean * 0.45, tY, -2.9, 3.9, 5.5, 1.3, top, 0.8, tilt); bx(lean * 0.45 + 0.5, tY + 3.1, 0, 2.4, 0.9, 6.4, top, 1.1, tilt); for (let r = 0; r < 3; r++) bx(lean * 0.45 + 1.9, tY + 1.6 - r * 1.5, 0, 0.3, 0.5, 4.4, mul(skin, 0.82), 1, tilt); break
    case 'tank': bx(lean * 0.5 + 1.9, tY - 0.6, 0, 0.3, 0.7, 4.8, trim, 1); break
    case 'shorts': for (let r = 0; r < 3; r++) bx(lean * 0.45 + 1.9, tY + 1.8 - r * 1.5, 0, 0.3, 0.5, 4.6, mul(skin, 0.8), 1, tilt); bx(lean * 0.2, hipY + 0.9, 0, 3.7, 1, 5, trim, 1); break
    case 'coat': bx(lean * 0.2, hipY - 1.6, 0, 3.8, 5.4, 5.9, top, 0.92); bx(lean * 0.45, tY + 2.7, 0, 3.8, 1.1, 6.2, mul(top, 1.15), 1); break
    case 'armor': bx(lean * 0.45, tY + 2.6, 3.4, 3.2, 1.8, 2.6, trim, 1, tilt); bx(lean * 0.45, tY + 2.6, -3.4, 3.2, 1.8, 2.6, trim, 0.8, tilt); bx(lean * 0.45 + 1.9, tY, 0, 0.5, 3.4, 3.6, trim, 1, tilt); break
    case 'ninja': bx(lean * 0.3, hipY + 1.1, 0, 3.9, 0.8, 5.9, trim, 1); break
    case 'robe': bx(lean * 0.2, hipY - 2.2, 0, 4.2, 7, 5.6, top, 0.95); bx(lean * 0.3, hipY + 1.1, 0, 4.2, 0.9, 5.8, trim, 1); bx(lean * 0.45 + 1.8, tY + 1.4, 0, 0.4, 2.6, 1.6, trim, 1); break
    case 'mawashi': bx(lean * 0.3 + 1.1, hipY + 0.4, 0, 2.2, 4.2, 4.8, lc(ch.pants), 1); bx(lean * 0.3, hipY + 1.2, 0, 4.4 * fat, 1.1, 6.6 * fat, trim, 1); break
    case 'tights': bx(lean * 0.3, hipY + 1.3, 0, 3.8, 1.3, 5.5, trim, 1); for (let r = 0; r < 2; r++) bx(lean * 0.45 + 1.9, tY + 1.5 - r * 1.8, 0, 0.3, 0.5, 4.4, mul(skin, 0.8), 1, tilt); break
    case 'robot': bx(lean * 0.45 + 1.9, tY + 0.6, 0, 0.5, 2, 3.4, trim, 1.7, tilt); bx(lean * 0.45 + 1.9, tY - 1.8, 0, 0.5, 0.7, 4, mul(trim, 0.6), 1); break
    default: break
  }
  if (ch.accs.includes('pads')) { bx(lean * 0.45, tY + 2.6, 3.4, 2.8, 1.6, 2.4, trim, 1); bx(lean * 0.45, tY + 2.6, -3.4, 2.8, 1.6, 2.4, trim, 0.8) }
  if (ch.accs.includes('tattoo')) for (let r = 0; r < 3; r++) bx(lean * 0.45 + 1.9, tY + 1.4 - r * 1.2, 1.2, 0.3, 0.45, 2.6, lc(el.color), 1.1)
  if (ch.accs.includes('sash') || ch.accs.includes('belt')) bx(lean * 0.3, hipY + 1.15, 0, 3.9, 0.7, 5.9, ch.accs.includes('belt') ? lc('#111111') : lc('#f4f4f4'), 1)
  if (ch.accs.includes('scarf')) { const w = Math.sin(t * 9) * 0.8; bx(lean * 0.45 - 0.5, tY + 3, 0, 3.6, 1.1, 6.3, trim, 1); bx(lean * 0.45 - 3.6, tY + 2.3 + w, -1.2, 5.4, 1, 1.2, trim, 0.9, 0.12); bx(lean * 0.45 - 6.6, tY + 1.9 + w * 1.6, -1.2, 4, 1, 1.2, trim, 0.85, 0.2) }
  if (ch.accs.includes('cape')) bx(lean * 0.2 - 2.4, tY - 0.6, 0, 0.8, 7, 5.6, trim, 0.9)
  // ---- head ----
  const hx0 = lean * 0.9 + (P.head || 0), hY = tY + 4.5
  bx(hx0 * 0.5, tY + 3, 0, 1.6, 1.4, 1.8, skin, 0.9)
  const hr = hair, hurt = f.st === 'hit' || f.st === 'air', dark = [.05,.05,.1]
  animeHead(api,W(hx0),Yw(hY),0,3.25*k*sh,dir*1.05,{skin:mul(outfit==='robot'?lc('#b8c0d0'):skin,flash),hair:hr,iris:ec,style:ch.hairStyle,talking:hurt||!!f.atk,fierce:true})
  if (ch.accs.includes('visor')) bx(hx0 + 1.7, hY + 0.5, 0, 0.8, 1.1, 3.2, ec, 1.9)
  if (ch.accs.includes('shades')) bx(hx0 + 1.9, hY + 0.5, 0, 0.6, 1.1, 3.4, lc('#0a0a12'), 1)
  if (!ch.accs.includes('mask') && !ch.accs.includes('mask2')) bx(hx0 + 1.9, hY - 1.1, 0, 0.3, hurt || f.atk ? 0.9 : 0.4, 1.6, [0.45, 0.06, 0.1], 1)
  if (ch.accs.includes('mask')) bx(hx0 + 1.9, hY - 0.6, 0, 0.5, 2.6, 3.9, lc('#14141e'), 1)
  if (ch.accs.includes('mask2')) { bx(hx0 + 0.2, hY + 0.2, 0, 3.9, 4.1, 4, ec, 1); bx(hx0 + 2, hY + 0.5, 0.9, 0.3, 0.8, 0.9, lc('#ffffff'), 1.3); bx(hx0 + 2, hY + 0.5, -0.9, 0.3, 0.8, 0.9, lc('#ffffff'), 1.3) }
  if (ch.beard === 'full') bx(hx0 + 1.5, hY - 1.4, 0, 1.2, 2, 3.7, hr, 0.9)
  if (ch.beard === 'goatee') bx(hx0 + 1.7, hY - 1.7, 0, 0.9, 1.4, 1.4, hr, 0.9)
  if (ch.beard === 'stache') bx(hx0 + 1.95, hY - 0.5, 0, 0.5, 0.6, 2.6, hr, 0.9)
  if (ch.accs.includes('headband')) bx(hx0, hY + 1.3, 0, 3.95, 0.8, 4, lc('#ffffff'), 1)
  if (ch.accs.includes('band')) bx(hx0, hY + 1.3, 0, 3.95, 0.8, 4, trim, 1)
  if (ch.accs.includes('scar')) bx(hx0 + 1.95, hY + 0.2, 0.9, 0.3, 1.8, 0.35, lc('#7a2a2a'), 1, 0.3)
  if (ch.accs.includes('horns')) { bx(hx0 - 0.2, hY + 3.2, 1.6, 0.9, 2.2, 0.9, lc('#f2e8c8'), 1, 0.3); bx(hx0 - 0.2, hY + 3.2, -1.6, 0.9, 2.2, 0.9, lc('#f2e8c8'), 0.85, -0.3) }
  if (ch.accs.includes('crown')) { bx(hx0, hY + 2.5, 0, 3.9, 0.8, 4, lc('#ffd23a'), 1.3); for (let i = -1; i <= 1; i++) bx(hx0, hY + 3.3, i * 1.4, 0.9, 1, 0.9, lc('#ffd23a'), 1.4) }
  if (ch.accs.includes('hat')) { bx(hx0, hY + 2.3, 0, 5.2, 0.6, 5.6, trim, 0.9); bx(hx0 - 0.2, hY + 4, 0, 2.6, 3.4, 2.8, trim, 0.9) }
  if (ch.accs.includes('skull')) bx(hx0 + 1.95, hY - 0.8, 0, 0.4, 1.6, 2.6, lc('#e8e8e0'), 1)
  if (ch.accs.includes('antenna')) { bx(hx0 - 0.6, hY + 3.4, 0, 0.5, 2.4, 0.5, lc('#9aa4b8'), 1); bx(hx0 - 0.6, hY + 4.7, 0, 1, 1, 1, ec, 2) }
  if (ch.accs.includes('orb')) { const ob = Math.sin(t * 3) * 0.7; bx(5.5, tY + 3 + ob, 0, 2, 2, 2, glow, 2.2); bx(5.5, tY + 3 + ob, 0, 3, 3, 3, ec, 0.9) }
  // ---- arms (IK: upper arm + forearm), gloves and hands ----
  P.hands.forEach(([hx, hy], i) => {
    const near = i === 0, lz = near ? 3.2 : -3.2, shd = near ? 1 : 0.78
    const sx = lean * 0.45 + (i ? -0.2 : 0.2), sy = tY + 2.3
    const wy = hy - drop * (f.st === 'crouch' ? 0.2 : 0.7)
    const r = ik2(sx, sy, hx, wy, 3, 3, -1)
    const thick = (outfit === 'gi' || outfit === 'robe' ? 2.1 : bareArms ? 1.9 : 2.0) * (fat > 1 ? 1.25 : 1)
    limb3(sx, sy, r.ex, r.ey, thick, lz, outfit === 'robe' ? top : armCol, shd)
    limb3(r.ex, r.ey, r.hx, r.hy, thick * 0.9, lz, outfit === 'gi' || outfit === 'robe' ? top : bareArms ? skin : armCol, shd)
    bx(sx, sy - 0.25, lz, thick * 1.2, thick * 1.25, thick * 1.15, armCol, shd)
    bx(r.ex, r.ey, lz, thick * 0.83, thick * 0.83, thick * 0.83, outfit === 'robot' ? trim : armCol, shd)
    bx(r.hx, r.hy, lz, 1.7, 1.65, 1.8, ch.accs.includes('tape') ? lc('#eee9dc') : trim, shd)
    bx(r.hx + 0.2, r.hy, lz, 2.35, 2.1, 2.3, gl, shd)
    bx(r.hx + 0.1, r.hy - 0.7, lz + (near ? 0.85 : -0.85), 1.2, 1, 0.9, gl, shd)
    if (f.atk && !f.atk.normal && f.atk.pose === 'cast') bx(r.hx + 1.3, r.hy, lz, 1.6, 1.6, 1.6, glow, 2.4)
  })
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
    case 'warn': { const k = 0.6 + 0.4 * Math.sin(p.t * 40); for (let i = -3; i <= 3; i++) put(p.x + i * 1.2, FLOOR + 0.4, 2, 1.1, 0.7, c[0] * 2.2 * k, c[1] * 2.2 * k, c[2] * 2.2 * k); for (let i = 0; i < 4; i++) put(p.x + Math.sin(p.t * 30 + i) * 2.4, FLOOR + 1 + i * 1.6, 2, 0.9, 0.9, g[0] * 2, g[1] * 2, g[2] * 2); break }
    case 'pillar': for (let y = 0; y < 22; y += 1.4) { const w = 3.4 - y * 0.05 + Math.sin(t * 40 + y) * 0.4; put(p.x, FLOOR + y, 2, w * 1.5, 1.5, (y > 12 ? g : c)[0] * 2.3, (y > 12 ? g : c)[1] * 2.3, (y > 12 ? g : c)[2] * 2.3) } break
    case 'boomerang': for (let i = 0; i < 4; i++) { const a = t * 22 + i * 1.57; put(p.x + Math.cos(a) * 2.2, p.y + Math.sin(a) * 2.2, 3, 1.4, 1.4, (i % 2 ? g : c)[0] * 2.2, (i % 2 ? g : c)[1] * 2.2, (i % 2 ? g : c)[2] * 2.2) } put(p.x, p.y, 3, 1.4, 1.4, g[0] * 2.4, g[1] * 2.4, g[2] * 2.4); break
    case 'rock': for (let i = 0; i < 5; i++) put(p.x, p.y + i * 1.6, 2, 1.8 - i * 0.25, 1.8, (i === 0 ? g : c)[0] * 2.2, (i === 0 ? g : c)[1] * 2.2, (i === 0 ? g : c)[2] * 2.2); break
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
function drawFx(put, f, t) {
  const el = ELEMENTS[f.ch.element], ec = lc(el.color), gl = lc(el.glow), base = FLOOR + f.y
  if (f.st === 'cine' || (f.atk && !f.atk.normal)) for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2 + t * 8; put(f.x + Math.cos(a) * 6.5, base + 7 + Math.sin(a) * 9, 2, 1.3, 1.3, ec[0] * 2, ec[1] * 2, ec[2] * 2) }
  if (f.st === 'ko') for (let i = 0; i < 3; i++) { const a = t * 6 + i * 2.1; put(f.x - f.face * 4 + Math.cos(a) * 3, base + 5 + Math.sin(a), 3, 0.8, 0.8, 2.4, 2.2, 0.4) }
  if (f.st === 'win') for (let i = 0; i < 4; i++) { const a = t * 3 + i * 1.57; put(f.x + Math.cos(a) * 6, base + 17 + Math.sin(a * 2) * 1.4, 3, 0.9, 0.9, gl[0] * 2.2, gl[1] * 2.2, gl[2] * 2.2) }
  if (f.atk && !f.atk.normal && f.atk.vel && Math.abs(f.vx) > 30) for (let i = 1; i <= 4; i++) put(f.x - f.face * i * 3.2, base + 7, 0, 3, 9, ec[0] * 0.7 / i, ec[1] * 0.7 / i, ec[2] * 0.7 / i)
  if (f.burn) for (let i = 0; i < 3; i++) put(f.x + Math.sin(t * 9 + i * 2) * 2.4, base + 4 + ((t * 9 + i * 4) % 10), 2, 1.1, 1.1, 2.2, 0.9, 0.15)
  if (f.slowT > 0) for (let i = 0; i < 3; i++) put(f.x + Math.sin(t * 6 + i * 2) * 3, base + 3 + i * 3.5, 2, 0.9, 0.9, 1.5, 2.2, 2.6)
  if (f.counterT > 0) for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2 + t * 10; put(f.x + Math.cos(a) * 6, base + 8 + Math.sin(a) * 8, 3, 1, 1, gl[0] * 2.4, gl[1] * 2.4, gl[2] * 2.4) }
}
function draw(api) {
  const { put } = api
  const t = G.time
  drawStage(put, t)
  if (!FT.f.length) return
  for (const f of FT.f) drawFx(put, f, t)
  for (const p of FT.proj) drawProj(put, p, t)
  for (const q of G.parts) { const fq = q.life / q.max; put(q.x, q.y, 6, q.s * (0.35 + 0.65 * fq) * 0.9, q.s * (0.35 + 0.65 * fq) * 0.9, q.c[0] * 1.8, q.c[1] * 1.8, q.c[2] * 1.8) }
  api.pops(G.pops, 0)
  // super cinematic: darken the arena (behind the fighters) and streak speed lines
  if (FT.cine) {
    const ec = lc(FT.cine.color), k = Math.min(1, FT.cine.t * 6)
    for (let gx = -70; gx <= 70; gx += 4) for (let gy = -40; gy <= 40; gy += 4) put(gx, gy, -6, 4.2, 4.2, 0.01, 0.01, 0.03)
    const ow = FT.f[FT.cine.owner]
    for (let i = 0; i < 26; i++) { const a = (i / 26) * Math.PI * 2 + FT.cine.t * 3, r0 = 8 + ((i * 7 + t * 60) % 40); put(ow.x + Math.cos(a) * r0, FLOOR + 8 + Math.sin(a) * r0 * 0.7, -4, 6 * k, 0.8, ec[0] * 2.4, ec[1] * 2.4, ec[2] * 2.4) }
    for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2 + t * 6; put(ow.x + Math.cos(a) * 7, FLOOR + 8 + Math.sin(a) * 9, 6, 1.4, 1.4, ec[0] * 2.4, ec[1] * 2.4, ec[2] * 2.4) }
  }
}
// lit 3D pass: floor slab + fighters (Scene.jsx supplies put3 = rotated, depth-scaled boxes)
function draw3(api) {
  const { put3 } = api
  const t = G.time
  const el = ELEMENTS[ROSTER[FT.cfg.p2] ? ROSTER[FT.cfg.p2].element : 'fire'], c = lc(el.color)
  put3(0, FLOOR - 1.4, 0, 150, 2.8, 36, 0, c[0] * 0.22 + 0.06, c[1] * 0.22 + 0.06, c[2] * 0.26 + 0.08)
  for (let x = -66; x <= 66; x += 11) put3(x, FLOOR + 0.02, 6, 0.45, 0.1, 22, 0, c[0] * 0.8, c[1] * 0.8, c[2] * 0.8)
  put3(0, FLOOR + 0.02, 6, 150, 0.1, 0.5, 0, c[0] * 0.8, c[1] * 0.8, c[2] * 0.8)
  if (!FT.f.length) return
  for (const f of FT.f) drawFighter3(api, f, t)
  if (FT.fin && FT.fin.state === 'play') drawFinisher(put3, FT.fin)
}
const hsh = (i, k) => { const q = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return q - Math.floor(q) }
function drawFinisher(put3, F) {
  const tt = F.t, ox = F.ox, by = FLOOR + 2, w = FT.f[F.win], vx = F.ox
  const el = ELEMENTS[F.kind], c = lc(el.color), g = lc(el.glow)
  const shatter = tt - F.hideAt
  if (F.kind === 'ice') {
    if (shatter < 0) {
      const u = Math.min(1, tt / 0.8)
      put3(vx, by + 3.2, 0, 14 * u, 7.4 * u, 7.5, 0, 0.18, 0.55, 0.9)
      put3(vx, by + 3.2, 0, 11.5 * u, 5.2 * u, 5.5, 0, 0.35, 0.9, 1.35)
      for (let i = 0; i < 6; i++) put3(vx - 5.5 + i * 2.2, by + 7.2 * u, 0, 0.8, 2.4 * u, 0.8, 0, 1.2, 1.9, 2.4, i)
    } else for (let i = 0; i < 70; i++) { const a = hsh(i, 1) * 6.283, sp = 6 + hsh(i, 2) * 26, u = shatter; put3(vx + Math.cos(a) * sp * u, by + 4 + Math.abs(Math.sin(a)) * sp * u * 0.8 - 22 * u * u, (hsh(i, 3) - 0.5) * 10 * u, 1.2 + hsh(i, 4) * 1.6, 1.2 + hsh(i, 5) * 1.6, 1.2, 0, 0.8 * (1 - u * 0.3), 1.8, 2.4, a + u * 6) }
  } else if (F.kind === 'fire') {
    if (shatter < 0) for (let i = 0; i < 16; i++) { const a = hsh(i, 1) * 6.283, hgt = (4 + hsh(i, 2) * 12) * (0.6 + 0.4 * Math.sin(tt * 14 + i)) * Math.min(1, tt / 0.6), r = 1 + hsh(i, 3) * 5; put3(vx + Math.cos(a) * r, by + hgt / 2, Math.sin(a) * 2.5, 2.2, hgt, 2.2, 0, 2.6, 1.0 + hsh(i, 4) * 1.2, 0.1, tt * 3 + i) }
    else { for (let i = 0; i < 70; i++) { const u = shatter, a = hsh(i, 1) * 6.283; put3(vx + Math.cos(a) * 14 * u * hsh(i, 6), by + 2 + u * (8 + hsh(i, 2) * 26) - 4 * u * u, Math.sin(a) * 4 * u, 0.9, 0.9, 0.9, 0, 2.6 * (1 - u * 0.35), 1.2, 0.15, a) } put3(vx, by + 0.4, 0, 9, 0.8, 5, 0, 0.12, 0.1, 0.1); put3(vx + 1, by + 1.1, 0, 5, 0.9, 3.5, 0, 0.2, 0.16, 0.14) }
  } else if (F.kind === 'thunder') {
    if (tt < 0.9) {
      const fl = Math.sin(tt * 60) > 0 ? 3 : 1.2, top = FLOOR + 80
      let px = vx + (hsh(Math.floor(tt * 30), 1) - 0.5) * 6
      for (let y = top; y > by; y -= 5) { const nx = vx + (hsh(Math.floor(tt * 30), y) - 0.5) * 7 * (y - by) / 80; put3((px + nx) / 2, y - 2.5, 0, 1.6, 5.4, 1.6, Math.atan2(nx - px, 5) * 0.5, 2.8 * fl, 2.8 * fl, 1.2 * fl); px = nx }
      put3(vx, by + 1, 0, 16 * Math.min(1, tt * 3), 0.6, 8, 0, 2.6, 2.4, 0.6)
    } else {
      // the X-ray silhouette is blasted into the sky
      const u = tt - 0.9, hy = by + 6 + u * u * 38, spin = u * 7, fl = Math.sin(u * 40) > 0 ? 2.6 : 0.6
      put3(vx + u * 6, hy, 0, 1.6, 7, 1.2, spin, fl, fl, 2.8); put3(vx + u * 6, hy + 4.4, 0, 2.2, 2.2, 1.2, spin, fl, fl, 2.8)
      put3(vx + u * 6 - 2.4, hy + 1, 0, 4, 0.7, 0.7, spin + 0.6, fl, fl, 2.8); put3(vx + u * 6 + 2.4, hy + 1, 0, 4, 0.7, 0.7, spin - 0.6, fl, fl, 2.8)
      put3(vx + u * 6 - 1, hy - 4.5, 0, 0.8, 4.4, 0.8, spin + 0.3, fl, fl, 2.8); put3(vx + u * 6 + 1, hy - 4.5, 0, 0.8, 4.4, 0.8, spin - 0.3, fl, fl, 2.8)
      if (shatter > 0) for (let i = 0; i < 50; i++) { const a = hsh(i, 1) * 6.283, sp = 8 + hsh(i, 2) * 24, q = shatter; put3(vx + 6 * u + Math.cos(a) * sp * q, hy + Math.sin(a) * sp * q, 0, 0.9, 0.9, 0.9, 0, 3, 2.8 * (1 - q * 0.3), 0.6, a) }
    }
  } else { // shadow: the soul is drawn out and absorbed by the winner
    const wx = w ? w.x : vx
    if (shatter < 0) for (let i = 0; i < 14; i++) { const u = (tt * 0.9 + hsh(i, 1)) % 1, a = hsh(i, 2) * 6.283 + tt * 3; put3(vx + Math.cos(a) * 3 * (1 - u), by + u * 14, Math.sin(a) * 3 * (1 - u), 1.3, 1.3, 1.3, 0, 1.6, 0.3, 2.2, a) }
    else for (let i = 0; i < 40; i++) { const u = clamp(shatter / 1.8 - hsh(i, 1) * 0.5, 0, 1), px = vx + (wx - vx) * u, py = by + 4 + Math.sin(u * 3.14) * (8 + hsh(i, 2) * 12) * (hsh(i, 3) > 0.5 ? 1 : -0.3), pz = Math.sin(u * 9 + i) * 3 * (1 - u); if (u < 1) put3(px, py + (1 - u) * 2, pz, 1.2 + (1 - u), 1.2 + (1 - u), 1.2, 0, 2.0, 0.4, 2.6, i + u * 5) }
    if (shatter > 1.0 && w) put3(wx, FLOOR + 10, 0, 12, 22, 4, 0, 0.9 * (1 - Math.min(1, (shatter - 1) / 1.2)) + 0.1, 0.1, 1.3 * (1 - Math.min(1, (shatter - 1) / 1.2)) + 0.1)
  }
  void c; void g
}
export function fightRim() {
  let best = null
  for (const f of FT.f) if (f.st === 'cine' || (f.atk && !f.atk.normal)) best = f
  if (!best) return { color: '#ffffff', intensity: FT.stop > 0 ? 700 : 0, x: FT.f.length ? (FT.f[0].x + FT.f[1].x) / 2 : 0, y: FLOOR + 10 }
  return { color: ELEMENTS[best.ch.element].color, intensity: 1400, x: best.x, y: FLOOR + 8 + best.y }
}
// camera: follows the action, zooms for super moves and K.O.s
const CAM = { x: 0, y: 3, z: 70, tx: 0, ty: -2 }
export function fightCamera(aspect, dt) {
  const [a, b] = FT.f.length ? FT.f : [{ x: -10 }, { x: 10 }]
  const mid = (a.x + b.x) / 2, gap = Math.abs(a.x - b.x)
  const tan = 0.364 // tan(fov / 2) for fov 40
  const halfW = Math.max(30, gap / 2 + 18), jump = Math.max(a.y || 0, b.y || 0)
  const halfH = 16 + jump * .5
  let tx = mid * .85, ty = -2 + jump * .4, y = ty + 4, z = clamp(Math.max(halfW / (tan * aspect), halfH / tan), 44, 180), x = tx * .95
  if (FT.cine) { const o = FT.f[FT.cine.owner], u = Math.min(1, FT.cine.t / 0.35); z = z + (34 - z) * u; tx = o.x + (mid - o.x) * (1 - u); ty = FLOOR + 8; y = ty + 3; x = o.x + o.face * -14 * u + Math.sin(FT.cine.t * 2) * 3 }
  else if (FT.phase === 'finish' && FT.fin && FT.f.length) { const v = FT.f[FT.fin.vic], u = FT.fin.state === 'play' ? 1 : Math.min(1, FT.fin.t / 0.8) * 0.6; z = z + (40 - z) * u; tx = tx + (v.x - tx) * u; x = tx; ty = ty + (FLOOR + 4 - ty) * u * 0.6 }
  else if (FT.phase === 'ko' && FT.f.length) { const l = a.hp <= 0 ? a : b; const u = Math.min(1, FT.phaseT / 0.6); z = z + (46 - z) * u * 0.6; tx = tx + (l.x - tx) * u * 0.7; x = tx; ty = ty + 4 * u }
  const k = Math.min(1, (dt || 0.016) * 5)
  CAM.x += (x - CAM.x) * k; CAM.y += (y - CAM.y) * k; CAM.z += (z - CAM.z) * k; CAM.tx += (tx - CAM.tx) * k; CAM.ty += (ty - CAM.ty) * k
  return CAM
}
if (typeof window !== 'undefined') { window.__FT = FT; window.__fight = fightActions; window.__fcam = (a, d) => fightCamera(a, d) }
games.fight = { update, onKey, draw, draw3, rim: fightRim, camera: fightCamera, stop, sky: () => '#06040e' }
