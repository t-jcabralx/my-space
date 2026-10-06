// Game simulation. Pure JS (no three/react) so it can be tested headless.
import { SP, PUP_COLORS, rgb, SHIP_DEFS, BULLET_SPR, TRAIL_COLS } from './sprites.js'
import { ENEMIES, MISSIONS, BOSSES, UPGRADES, BONUS_AFTER } from './levels.js'
import { sfx, music, initAudio, speak } from './audio.js'
import { submitScore } from './online.js'
import { settings } from './settings.js'
import { ACH } from './awards.js'

export const W = 100, H = 56, HW = 50, HH = 28
const TAU = Math.PI * 2
const R = (a, b) => a + Math.random() * (b - a)
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
const lerp = (a, b, t) => a + (b - a) * t
const hit = (a, b) => Math.abs(a.x - b.x) < a.hw + b.hw && Math.abs(a.y - b.y) < a.hh + b.hh
const PUP_WEIGHTS = { P: 22, S: 14, R: 14, W: 12, L: 9, M: 9, H: 10, B: 8, U: 2, X: 6, G: 6, D: 8 }

export const keys = {}
const ARCADE = new Set(['slug', 'pickle', 'bomber', 'tetris', 'chomp', 'cards'])
export const games = {} // other game modes register themselves here (see slug.js)
export const profile = { quests: null, awardsDone: {}, awardsInit: false, jackpot: 1000, chips: 1000, cardWins: 0, cardGames: 0, unoWins: 0, pusoyWins: 0, luckyNines: 0, tongitsWins: 0, chompDots: 0, chompGhosts: 0, chompGames: 0, chompLevels: 0, chompHi: 0, tetrisLines: 0, tetrises: 0, tspins: 0, tetrisGames: 0, tetrisWins: 0, sprints: 0, bomberGames: 0, bomberWins: 0, bomberKills: 0, bricks: 0, seen: {}, name: '', pickleGames: 0, pickleWins: 0, aces: 0, ship: { model: 0, paint: 0, trail: 0, bullet: 0 }, kills: 0, bosses: 0, pows: 0, skills: 0, bonus: 0, spaceWins: 0, slugWins: 0, played: 0, spaceHi: 0, slugHi: 0, tops: { space: [], slug: [], pickle: [], bomber: [], tetris: [], chomp: [], uno: [], pusoy: [], lucky9: [], tongits: [] } }
try { const sv = JSON.parse(localStorage.getItem('si_profile') || '{}'); Object.assign(profile, sv); profile.tops = { space: [], slug: [], pickle: [], bomber: [], tetris: [], chomp: [], uno: [], pusoy: [], lucky9: [], tongits: [], ...(sv.tops || {}) }; profile.ship = { model: 0, paint: 0, trail: 0, bullet: 0, ...(sv.ship || {}) }; profile.seen = { ...(sv.seen || {}) } } catch { /* ignore */ }
export const saveProfile = () => { try { localStorage.setItem('si_profile', JSON.stringify(profile)) } catch { /* ignore */ } }
export function recordScore(game, score) {
  const t = profile.tops[game] || (profile.tops[game] = [])
  if (score > 0) submitScore(game, profile.name || 'ANON', score)
  if (score > 0) { t.push({ score, date: Date.now() }); t.sort((a, b) => b.score - a.score); t.length = Math.min(t.length, 5) }
  if (game === 'space') profile.spaceHi = Math.max(profile.spaceHi, score); else if (game === 'slug') profile.slugHi = Math.max(profile.slugHi, score)
  saveProfile()
}
export const G = {
  mode: 'menu', time: 0, hi: 0, scroll: 1,
  mission: 0, score: 0, credits: 0, lives: 3, nextLife: 20000, wlKeep: 1, droneKeep: 0,
  up: { fire: 0, rate: 0, armor: 0, magnet: 0, drone: 0, laser: 0, bomb: 0, shield: 0 },
  lz: null, bonus: null, p: null, enemies: [], pbul: [], ebul: [], pups: [], parts: [], beams: [], pops: [], boss: null,
  shake: 0, flash: 0, flashC: [1, 1, 1], slow: 1,
  stats: {}, toasts: [], banner: null, summary: null, final: null,
  meter: 0, combo: 0, comboT: 0, touchFire: false, drag: { x: 0, y: 0 }, uid: 0,
}
G.unlocked = 0
try { G.hi = +localStorage.getItem('si_hi') || 0; G.unlocked = +localStorage.getItem('si_unlock') || 0 } catch { /* ignore */ }

// ---------- store for React ----------
let snap = null
const subs = new Set()
export const subscribe = (f) => { subs.add(f); return () => subs.delete(f) }
export const getSnap = () => snap
let emitT = 0
export function emit() { snap = buildSnap(); subs.forEach((f) => f()) }

const comboMult = () => 1 + Math.min(7, Math.floor(G.combo / 5))
// ---------- active skills ----------
export const SK = {
  laser:  { key: 'Q', name: 'LASER',  color: '#3de8ff', cd: (L) => 15 - 1.7 * L },
  bomb:   { key: 'B', name: 'BOMB',   color: '#ffe84a', cd: (L) => 19 - 2.2 * L },
  shield: { key: 'E', name: 'SHIELD', color: '#3dff7a', cd: (L) => 18.5 - 2 * L },
}
export const skillLv = (k) => 1 + G.up[k]
const bsp = () => 24 + Math.min(G.mission, 9) * 1.9
const toast = (text, color = '#ffffff') => { G.toasts.push({ id: ++G.uid, text, color, t: 2.4 }); if (G.toasts.length > 4) G.toasts.shift() }

// ---------- effects ----------
export function part(x, y, vx, vy, life, c, s = 1, drag = 0, g = 0) {
  if (G.parts.length > 1800) return
  G.parts.push({ x, y, vx, vy, life, max: life, c, s, drag, g })
}
export const COLS = {
  fire: [rgb('#ffffff'), rgb('#ffe84a'), rgb('#ff9a2e'), rgb('#ff3b4e')],
  cyan: [rgb('#ffffff'), rgb('#3de8ff'), rgb('#3d7bff')],
  green: [rgb('#ffffff'), rgb('#3dff7a'), rgb('#b6ff3d')],
  purple: [rgb('#ffffff'), rgb('#a64dff'), rgb('#ff4de1')],
}
const pick = (a) => a[(Math.random() * a.length) | 0]
export function boom(x, y, n = 14, speed = 30, cols = COLS.fire, size = 1) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, v = R(0.2, 1) * speed
    part(x, y, Math.cos(a) * v, Math.sin(a) * v, R(0.3, 0.8), pick(cols), size * R(0.6, 1.2), 2)
  }
}
export function ring(x, y, n = 40, speed = 60, cols = COLS.cyan) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU
    part(x, y, Math.cos(a) * speed, Math.sin(a) * speed, 0.6, pick(cols), 1.1, 2.5)
  }
}
export const shake = (v) => { if (settings.shake) G.shake = Math.max(G.shake, v) }
export const flash = (a, c = [1, 1, 1]) => { G.flash = Math.max(G.flash, a); G.flashC = c }
export function popup(x, y, text, c = [1, 1, 0.5]) { G.pops.push({ x, y, text, life: 0.9, c }) }

// ---------- scoring ----------
function addScore(base, x, y, showPop = true) {
  const v = Math.round(base * comboMult() * (G.p && (G.p.multT > 0 || G.p.od > 0) ? 2 : 1) * (G.golden > 0 ? 2 : 1))
  G.score += v
  if (showPop && v >= 100 && G.pops.length < 14) popup(x, y + 3, String(v))
  if (G.score >= G.nextLife) { G.nextLife += 20000; G.lives = Math.min(9, G.lives + 1); toast('1UP  SCORE BONUS', '#3dff7a'); sfx('life') }
  if (G.score > G.hi) { G.hi = G.score }
}
function registerKill() {
  G.combo++; G.comboT = 2.6
  G.stats.kills++; profile.kills++; sfx('ding', G.combo)
  G.meter = Math.min(100, G.meter + 3)
  G.stats.maxCombo = Math.max(G.stats.maxCombo, G.combo)
  if (G.combo > 0 && G.combo % 5 === 0) { toast(`COMBO x${comboMult()}`, '#ffe84a'); sfx('pickup') }
}

// ---------- spawning ----------
function spawnEnemy(type, x, y, opt = {}) {
  const d = ENEMIES[type], s = SP[d.spr]
  const hp = Math.ceil(d.hp * (d.bonus ? 1 : 1 + G.mission * 0.1))
  const e = {
    kind: 'enemy', type, x, y, x0: x, y0: y, vx: 0, vy: 0, hp, maxhp: hp, spr: s, hw: s.hw * 0.78, hh: s.hh * 0.78,
    t: 0, flash: 0, ph: Math.random() * TAU, fireT: R(0.8, 2), amp: R(8, 15), n: 0, ...opt,
  }
  G.enemies.push(e)
  if (d.bonus) sfx('ufo')
  if (!d.bonus) G.stats.total++
  return e
}
function ebullet(x, y, ang, sp, kind = 'orbR', extra) {
  if (G.ebul.length > 460) return
  sfx('eshot')
  const s = SP[kind]
  G.ebul.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, spr: s, hw: s.hw * 0.55, hh: s.hh * 0.55, t: 0, kind, ...extra })
}
const aim = (x, y) => Math.atan2(G.p.y - y, G.p.x - x)
function volley(x, y, n, spread, sp, kind = 'orbR') {
  const a = aim(x, y)
  for (let i = 0; i < n; i++) ebullet(x, y, a + (n === 1 ? 0 : (i / (n - 1) - 0.5) * spread), sp, kind)
}
function dropPup(x, y, type) {
  const s = SP['pup' + type]
  G.pups.push({ kind: 'pup', type, x, y, vx: -9, vy: 0, spr: s, hw: 3.6, hh: 3.6, t: 0 })
}
function dropCoin(x, y, type = 'coin') {
  const s = SP[type]
  const a = Math.random() * TAU, v = R(5, 20)
  G.pups.push({ kind: 'pup', type, x, y, vx: Math.cos(a) * v - 4, vy: Math.sin(a) * v, spr: s, hw: 2.8, hh: 2.8, t: Math.random() * 3, drag: true })
}
function weightedPup() {
  const p = G.p
  const w = { ...PUP_WEIGHTS }
  if (p && p.wl >= 5) w.P = 4
  if (p && p.hp >= p.maxHp) w.H = 2
  let tot = 0; for (const k in w) tot += w[k]
  let r = Math.random() * tot
  for (const k in w) { r -= w[k]; if (r <= 0) return k }
  return 'P'
}
function pickWeighted(pool) {
  let tot = 0; for (const k in pool) tot += pool[k]
  let r = Math.random() * tot
  for (const k in pool) { r -= pool[k]; if (r <= 0) return k }
  return Object.keys(pool)[0]
}

function spawnGroup(m) {
  const type = pickWeighted(m.pool)
  const mi = G.mission
  const X = HW + 8
  const yr = () => R(-21, 21)
  const n = (a, b) => Math.min(b, a + Math.floor(Math.random() * (1 + b - a)) + (mi >= 3 ? 1 : 0))
  switch (type) {
    case 'drone': case 'zig': {
      const f = (Math.random() * 3) | 0, c = n(4, 6), y0 = yr()
      for (let i = 0; i < c; i++) {
        if (f === 0) spawnEnemy(type, X + i * 7, clamp(y0, -20, 20))
        else if (f === 1) spawnEnemy(type, X + Math.abs(i - (c - 1) / 2) * 6, clamp(y0 + (i - (c - 1) / 2) * 7, -22, 22))
        else spawnEnemy(type, X + i * 6, clamp(y0 + (i - c / 2) * 4, -22, 22))
      }
      break
    }
    case 'weaver': { const c = n(2, 3); for (let i = 0; i < c; i++) spawnEnemy('weaver', X + i * 12, (i - (c - 1) / 2) * 16 + R(-4, 4)); break }
    case 'kami': { const c = n(2, 4); for (let i = 0; i < c; i++) spawnEnemy('kami', X + i * 5, yr()); break }
    case 'shooter': { const c = n(1, 3); for (let i = 0; i < c; i++) spawnEnemy('shooter', X + i * 6, (i - (c - 1) / 2) * 15 + R(-3, 3), { stopX: R(14, 40) }); break }
    case 'tank': { const c = mi >= 3 ? 2 : 1; for (let i = 0; i < c; i++) spawnEnemy('tank', X + i * 14, c === 1 ? yr() * 0.7 : (i ? 13 : -13)); break }
    case 'rock': { const c = n(2, 4); for (let i = 0; i < c; i++) spawnEnemy(Math.random() < 0.7 ? 'rockL' : 'rockS', X + i * 10, yr(), { vx: -R(10, 22), vy: R(-7, 7) }); break }
    case 'mine': { const c = n(2, 3); for (let i = 0; i < c; i++) spawnEnemy('mine', X + i * 12, yr()); break }
    case 'carrier': spawnEnemy('carrier', X, R(-12, 12)); break
    default: spawnEnemy('drone', X, yr())
  }
}

// ---------- player ----------
const SD = () => SHIP_DEFS[Math.min(profile.ship.model, SHIP_DEFS.length - 1)]
function newPlayer() {
  const U = G.up
  return {
    x: -42, y: 0, vx: 0, vy: 0, hw: SD().hw, hh: SD().hh, spd: SD().spd, rateM: SD().rate, alive: true, respawn: 0,
    hp: 3 + U.armor + SD().hp, maxHp: 3 + U.armor + SD().hp, inv: 1.5, wl: Math.max(1 + U.fire, G.wlKeep || 1),
    special: 'normal', specialT: 0, rapidT: 0, shieldT: 0, magnetT: 0, multT: 0, skT: 0, skMax: 1, od: 0, _odf: false, cd: { laser: 0, bomb: 0, shield: 0 }, cdMax: { laser: 1, bomb: 1, shield: 1 },
    fireCd: 0, sparkT: 0, drones: Math.max(U.drone, G.droneKeep || 0), dr: [],
  }
}

const BS = () => BULLET_SPR[Math.min(profile.ship.bullet, BULLET_SPR.length - 1)]
function firePlayer() {
  const p = G.p, U = G.up
  const od = p.od > 0
  const wl = od ? 5 : p.wl
  p._odf = !p._odf
  const sp = od ? (p._odf ? 'spread' : 'normal') : p.special
  const rate = (1 - 0.08 * U.rate) * (p.rapidT > 0 ? 0.55 : 1) * (od ? 0.5 : 1) * p.rateM
  const x = p.x + 5, y = p.y
  const add = (oy, ang, o) => {
    const s = o.spr, v = o.speed || 88
    G.pbul.push({ x, y: y + oy, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, spr: s, hw: s.hw * 0.7 + 0.3, hh: s.hh * 0.7 + 0.3, dmg: o.dmg || 1, pierce: !!o.pierce, homing: !!o.homing, blast: !!o.blast, k: o.k || 1.8, t: 0 })
  }
  if (sp === 'laser') {
    p.fireCd = 0.2 * rate
    add(0, 0, { spr: SP.pbL, dmg: 2 + wl * 0.5, pierce: true, speed: 140, k: 2 })
    if (wl >= 4) { add(2.5, 0.04, { spr: SP.pbL, dmg: 1.5, pierce: true, speed: 140, k: 2 }); add(-2.5, -0.04, { spr: SP.pbL, dmg: 1.5, pierce: true, speed: 140, k: 2 }) }
    sfx('laser')
  } else if (sp === 'missile') {
    p.fireCd = 0.34 * rate
    add(2, 0.15, { spr: SP.pbM, dmg: 3, homing: true, blast: true, speed: 60, k: 1.6 })
    if (wl >= 3) add(-2, -0.15, { spr: SP.pbM, dmg: 3, homing: true, blast: true, speed: 60, k: 1.6 })
    if (wl >= 5) add(0, 0, { spr: SP.pbM, dmg: 3, homing: true, blast: true, speed: 60, k: 1.6 })
    sfx('missile')
  } else if (sp === 'spread') {
    p.fireCd = 0.17 * rate
    const n = 2 + wl
    for (let i = 0; i < n; i++) add(0, (i / (n - 1) - 0.5) * 0.9, { spr: BS().pbS, dmg: 1 })
    sfx('shoot')
  } else {
    p.fireCd = 0.15 * rate
    const L = [
      [[0, 0]], [[1.3, 0], [-1.3, 0]], [[0, 0], [1.6, 0.1], [-1.6, -0.1]],
      [[1, 0], [-1, 0], [2.2, 0.15], [-2.2, -0.15]], [[0, 0], [1.6, 0.08], [-1.6, -0.08], [2.8, 0.22], [-2.8, -0.22]],
    ][wl - 1]
    for (const [oy, a] of L) add(oy, a, { spr: BS().pb })
    sfx('shoot')
  }
  part(x, y, 25, R(-8, 8), 0.12, COLS.cyan[1], 0.8)
}

function bomb() {
  const p = G.p
  if (!p || !p.alive || p.cd.bomb > 0 || G.mode !== 'playing') return
  const L = skillLv('bomb')
  profile.skills++; p.cdMax.bomb = p.cd.bomb = SK.bomb.cd(L); p.inv = Math.max(p.inv, 1 + L * 0.15); G.stats.bombs++
  sfx('bomb'); shake(2.5); flash(0.85, [0.7, 0.95, 1])
  ring(p.x, p.y, 70, 90, COLS.cyan); ring(p.x, p.y, 50, 55, COLS.fire)
  if (L >= 3) ring(p.x, p.y, 60, 120, COLS.purple)
  let gems = 0
  for (const b of G.ebul) { if (gems++ < 30) dropCoin(b.x, b.y, 'gem') }
  G.ebul.length = 0
  for (const e of G.enemies) if (!e.dead && e.x < HW + 4) hurtEnemy(e, 10 + 4 * L)
  if (G.boss && !G.boss.dying) damageBoss(20 + 8 * L)
}

function overdrive() {
  const p = G.p
  if (!p || !p.alive || p.od > 0 || G.meter < 100 || G.mode !== 'playing' || G.warped) return
  G.meter = 0; p.od = 7; p.inv = Math.max(p.inv, 7); profile.skills++
  sfx('overdrive'); shake(2.5); flash(0.8, [1, 0.5, 1]); ring(p.x, p.y, 60, 80, COLS.purple)
  speak('Overdrive!'); toast('OVERDRIVE!  MAX POWER', '#ff4de1')
}

function laser() {
  const p = G.p
  if (!p || !p.alive || p.cd.laser > 0 || G.lz || G.mode !== 'playing' || G.warped) return
  const L = skillLv('laser')
  profile.skills++
  G.lz = { t: 0, dur: 1.1 + 0.25 * L, h: 4 + L * 0.9, dmg: 1 + 0.5 * L, tick: 0 }
  p.cdMax.laser = p.cd.laser = SK.laser.cd(L) + G.lz.dur
  sfx('laserFire'); sfx('laser'); shake(1); flash(0.25, [0.6, 0.9, 1])
}
function stepLaser(dt) {
  const z = G.lz, p = G.p
  if (!z) return
  z.t += dt
  if (!p.alive || z.t > z.dur) { G.lz = null; return }
  shake(0.6)
  const x0 = p.x + 4, h2 = z.h / 2 + 0.5
  if (Math.random() < 0.7) part(HW - 1, p.y + R(-h2, h2), R(-60, -20), R(-8, 8), 0.25, COLS.cyan[0], 1)
  z.tick -= dt
  if (z.tick > 0) return
  z.tick = 0.1
  for (const e of G.enemies) {
    if (e.dead || e.x > HW + 2 || e.x + e.hw < x0 || Math.abs(e.y - p.y) > h2 + e.hh) continue
    e.hp -= z.dmg; e.flash = 0.07
    part(e.x, e.y, R(-20, 20), R(-20, 20), 0.3, COLS.cyan[0], 1)
    if (e.hp <= 0) killEnemy(e)
  }
  const b = G.boss
  if (b && !b.dying && b.x + b.hw > x0 && Math.abs(b.y - p.y) < h2 + b.hh) damageBoss(z.dmg)
  let gems = 0
  for (const q of G.ebul) if (!q.dead && q.x > x0 && Math.abs(q.y - p.y) < h2 + q.hh) { q.dead = true; if (gems++ < 4) dropCoin(q.x, q.y, 'gem'); part(q.x, q.y, 0, 0, 0.15, COLS.cyan[0], 1.3) }
}

function shieldSkill() {
  const p = G.p
  if (!p || !p.alive || p.cd.shield > 0 || G.mode !== 'playing') return
  const L = skillLv('shield')
  profile.skills++; p.skMax = p.skT = 3 + 0.8 * L
  p.cdMax.shield = p.cd.shield = SK.shield.cd(L) + p.skT
  sfx('shield'); ring(p.x, p.y, 40, 45, COLS.green); flash(0.2, [0.5, 1, 0.7])
}

function hurtPlayer(d = 1) {
  const p = G.p
  if (!p.alive || p.inv > 0 || G.exitT > 0 || G.bonus) return
  if (p.skT > 0) { sfx('deflect'); return }
  if (p.shieldT > 0) { p.shieldT = Math.max(0, p.shieldT - 1.2); p.inv = 0.5; sfx('deflect'); ring(p.x, p.y, 14, 30, COLS.cyan); return }
  p.hp -= d; p.inv = 1.6; G.stats.dmg++; G.combo = 0
  shake(2); flash(0.45, [1, 0.15, 0.15]); sfx('hurt'); boom(p.x, p.y, 16, 30, COLS.fire)
  if (p.hp <= 0) {
    p.alive = false; G.lives--; G.stats.lost++; G.droneKeep = Math.max(G.up.drone, (G.droneKeep || 0) - 1)
    sfx('bigBoom'); shake(3.5); boom(p.x, p.y, 60, 55, COLS.fire, 1.4); ring(p.x, p.y, 36, 50, COLS.fire)
    if (G.lives <= 0) { G.overT = 2.4 } else p.respawn = 1.8
  }
}

function collect(pu) {
  const p = G.p
  pu.dead = true
  switch (pu.type) {
    case 'coin': G.credits += 10; G.stats.coins++; sfx('coin'); if (G.pops.length < 14) popup(pu.x, pu.y + 3, '+10', [1, 0.85, 0.2]); return
    case 'gem': addScore(50, pu.x, pu.y, false); sfx('coin'); return
  }
  G.stats.pups++
  const label = { P: 'POWER UP', S: 'SHIELD', R: 'RAPID FIRE', W: 'SPREAD SHOT', L: 'LASER', M: 'HOMING MISSILES', H: 'REPAIR', B: 'OVERCHARGE', U: '1UP', X: 'SCORE x2', G: 'MAGNET', D: 'WINGMAN DRONE' }[pu.type]
  const col = '#' + '000000'
  toast(label, ['#ffe84a', '#3de8ff', '#ff9a2e', '#3dff7a', '#3d7bff', '#ff3b4e', '#ff7ab0', '#ff4de1', '#3dff7a', '#a64dff', '#12c9a5', '#b6ff3d'][Object.keys(PUP_COLORS).indexOf(pu.type)] || col)
  sfx('pickup'); ring(pu.x, pu.y, 18, 28, COLS.green)
  switch (pu.type) {
    case 'P': if (p.wl < 5) { p.wl++; G.wlKeep = p.wl; sfx('power') } else addScore(500, pu.x, pu.y); break
    case 'S': p.shieldT = 7; sfx('shield'); break
    case 'R': p.rapidT = 11; break
    case 'W': case 'L': case 'M': p.special = { W: 'spread', L: 'laser', M: 'missile' }[pu.type]; p.specialT = 15; sfx('power'); break
    case 'H': if (p.hp < p.maxHp) p.hp++; else addScore(300, pu.x, pu.y); break
    case 'B': p.cd.laser = p.cd.bomb = p.cd.shield = 0; sfx('power'); ring(p.x, p.y, 30, 60, COLS.purple); break
    case 'U': G.lives = Math.min(9, G.lives + 1); sfx('life'); break
    case 'X': p.multT = 12; break
    case 'G': p.magnetT = 10; break
    case 'D': if (p.drones < 3) { p.drones++; G.droneKeep = p.drones } else addScore(300, pu.x, pu.y); break
  }
}

// ---------- enemies ----------
function hurtEnemy(e, d) {
  if (e.dead) return
  e.hp -= d; e.flash = 0.07
  if (e.hp <= 0) killEnemy(e)
  else sfx('hit')
}
function killEnemy(e) {
  e.dead = true
  const d = ENEMIES[e.type]
  const big = e.maxhp >= 8
  boom(e.x, e.y, big ? 36 : 16, big ? 42 : 30, e.type === 'mine' ? COLS.fire : COLS.fire, big ? 1.3 : 1)
  if (big) ring(e.x, e.y, 24, 40, COLS.fire)
  sfx(big ? 'bigBoom' : 'boom'); shake(big ? 1.6 : 0.5)
  addScore(d.score, e.x, e.y)
  if (!e.noCount) registerKill()
  if (d.bonus) { G.stats.ufos++; toast('BONUS UFO DOWN!', '#ffe84a'); flash(0.3, [1, 0.95, 0.5]); dropPup(e.x, e.y, weightedPup()) }
  for (let i = 0; i < d.coins + (G.golden > 0 ? 3 : 0) + (e.rich ? 2 : 0); i++) dropCoin(e.x, e.y)
  G.dryDrone = (G.dryDrone || 0) + 1
  const dChance = e.minion ? 0.2 : e.maxhp >= 8 ? 0.2 : 0.015
  if (!d.bonus && G.p.drones < 3 && (Math.random() < dChance || G.dryDrone > 40)) { dropPup(e.x, e.y, 'D'); G.dryDrone = 0; toast('DRONE DROPPED!', '#b6ff3d') }
  G.dryKills = (G.dryKills || 0) + 1
  if (!d.bonus && (Math.random() < 0.07 || G.dryKills > 22)) { dropPup(e.x, e.y, weightedPup()); G.dryKills = 0 }
  if (e.type === 'mine') for (let i = 0; i < 10; i++) ebullet(e.x, e.y, (i / 10) * TAU + e.t, bsp() * 0.75, 'orbY')
  if (e.type === 'rockL') for (let i = 0; i < 2; i++) spawnEnemy('rockS', e.x, e.y + (i ? 3 : -3), { vx: e.vx * 0.8 - R(0, 6), vy: (i ? 14 : -14) + e.vy, noCount: true, countless: true })
}

function stepEnemies(dt) {
  const p = G.p, mi = Math.min(G.mission, 7)
  for (const e of G.enemies) {
    if (e.dead) continue
    e.t += dt; e.flash = Math.max(0, e.flash - dt)
    const sp = 18 + mi * 1.5
    switch (e.type) {
      case 'drone':
        e.x -= sp * dt; e.y = e.y0 + Math.sin(e.t * 3 + e.ph) * 5
        if (mi >= 2 && (e.fireT -= dt) < 0) { e.fireT = R(2.5, 4.5); volley(e.x, e.y, 1, 0, bsp(), 'orbR') }
        break
      case 'zig': {
        e.x -= sp * 1.05 * dt
        const tri = Math.abs(((e.t * 0.85 + e.ph) % 2) - 1) * 2 - 1
        e.y = clamp(e.y0 + tri * e.amp, -24, 24)
        if (mi >= 1 && (e.fireT -= dt) < 0) { e.fireT = R(2.2, 3.8); volley(e.x, e.y, 1, 0, bsp(), 'orbP') }
        break
      }
      case 'kami': {
        if (!e.lock) { e.x -= 20 * dt; if (e.x < 44 && e.x > p.x + 12) { e.lock = true; sfx('blink') } }
        if (e.lock) {
          const want = Math.atan2(p.y - e.y, p.x - e.x)
          e.ang = e.ang === undefined ? Math.PI : e.ang
          let da = ((want - e.ang + Math.PI * 3) % TAU) - Math.PI
          e.ang += clamp(da, -2.6 * dt, 2.6 * dt)
          const v = 30 + mi * 3
          e.x += Math.cos(e.ang) * v * dt; e.y += Math.sin(e.ang) * v * dt
          if (Math.random() < 0.5) part(e.x + 3, e.y, 10, R(-4, 4), 0.25, COLS.fire[2], 0.7)
        }
        break
      }
      case 'shooter':
        if (e.x > e.stopX && !e.leave) e.x -= 24 * dt
        else {
          e.leave = true
          e.y = e.y0 + Math.sin(e.t * 1.6 + e.ph) * 6
          if ((e.fireT -= dt) < 0) { e.fireT = R(1.4, 2.0); volley(e.x - 3, e.y, mi >= 3 ? 3 : 2, 0.3, bsp() * 1.15, 'orbC'); sfx('hit') }
          if (e.t > 9) e.x -= 28 * dt
        }
        break
      case 'weaver':
        e.x -= 15 * dt; e.y = e.y0 + Math.sin(e.t * 1.8 + e.ph) * 15
        if ((e.fireT -= dt) < 0) { e.fireT = R(1.6, 2.4); volley(e.x - 3, e.y, 1, 0, bsp() * 1.4, 'dartC') }
        break
      case 'tank':
        e.x -= 8 * dt; e.y += Math.sin(e.t) * 3 * dt
        if ((e.fireT -= dt) < 0) { e.fireT = 2.0; volley(e.x - 6, e.y, 5, 0.9, bsp(), 'orbR') }
        break
      case 'rockL': case 'rockS':
        e.x += e.vx * dt; e.y += e.vy * dt
        if (e.y > HH - 3 || e.y < -HH + 3) e.vy *= -1
        break
      case 'mine':
        e.x -= 7 * dt; e.y = e.y0 + Math.sin(e.t * 1.2 + e.ph) * 4
        break
      case 'ufo':
        e.x -= 24 * dt; e.y = e.y0 + Math.sin(e.t * 2.6) * 6
        if (!G.bonus && (e.fireT -= dt) < 0) { e.fireT = 1.4; ebullet(e.x, e.y, Math.PI / 2 * 3 + R(-0.3, 0.3), bsp() * 0.8, 'orbY') }
        break
      case 'carrier':
        if (e.x > 34) e.x -= 12 * dt
        else {
          e.y = e.y0 + Math.sin(e.t * 0.8) * 8
          if (e.n < 5 && (e.fireT -= dt) < 0) { e.fireT = 2.2; e.n++; spawnEnemy('drone', e.x - 6, e.y, { minion: true }); sfx('blink') }
          else if (e.n >= 5 && (e.fireT -= dt) < 0) { e.fireT = 1.8; volley(e.x - 6, e.y, 3, 0.5, bsp(), 'orbP') }
        }
        break
    }
    if (e.x < -HW - 14 || e.x > HW + 40 || e.y > HH + 14 || e.y < -HH - 14) e.dead = true, e.gone = true
  }
}

// ---------- bosses ----------
function startBoss() {
  G.bossState = 'warn'; G.warnT = 3.4
  G.banner = { title: 'WARNING', sub: BOSSES[G.mission].name + ' APPROACHING', kind: 'warn', t: 3.4 }
  sfx('alarm'); speak('Warning! Boss approaching.'); music.set('boss', G.mission)
}
function spawnBoss() {
  const d = BOSSES[G.mission], s = SP['boss' + G.mission]
  G.boss = {
    id: G.mission, name: d.name, x: HW + s.w / 2 + 6, y: 0, tx: 33, hp: d.hp, maxhp: d.hp, spr: s,
    hw: s.hw * 0.78, hh: s.hh * 0.78, t: 0, flash: 0, enter: true, tm: {}, ph: 1, k: 1, invulnT: 0, dying: false,
  }
  G.bossState = 'fight'
}
function damageBoss(d) {
  const b = G.boss
  if (!b || b.dying) return
  if (b.enter || b.invulnT > 0 || b.ghost) { sfx('deflect'); return }
  b.hp -= d; b.flash = 0.03; sfx('bossHit')
  G.score += 5
  if (b.hp <= 0) {
    b.hp = 0; b.dying = true; b.dieT = 3.2; G.slow = 0.5
    G.ebul.slice(0, 40).forEach((e) => dropCoin(e.x, e.y, 'gem')); G.ebul.length = 0; G.beams.length = 0
    toast(b.name + ' DESTROYED', '#ffe84a'); sfx('bigBoom'); flash(0.7)
  }
}
function addBeam(b, y, warn = 1.1, life = 0.9, h = 3.4) {
  G.beams.push({ owner: b, x: b.x - b.spr.hw * 0.8, y: clamp(y, -22, 22), warn, life, h, t: 0 })
  sfx('laserWarn')
}

function stepBoss(dt) {
  const b = G.boss
  if (!b) return
  b.t += dt; b.flash = Math.max(0, b.flash - dt); b.invulnT = Math.max(0, b.invulnT - dt)
  if (b.dying) {
    b.dieT -= dt
    b.x += Math.sin(b.t * 60) * 0.25
    if (Math.random() < 0.7) { const x = b.x + R(-b.spr.hw, b.spr.hw) * 0.9, y = b.y + R(-b.spr.hh, b.spr.hh) * 0.9; boom(x, y, 14, 40, COLS.fire, 1.3); if (Math.random() < 0.3) sfx('boom'); shake(1.2) }
    if (b.dieT <= 0) endBoss()
    return
  }
  if (b.enter) { b.x -= 16 * dt; if (b.x <= b.tx) { b.x = b.tx; b.enter = false } return }
  const f = b.hp / b.maxhp, bs = bsp()
  const tk = (k, iv) => { b.tm[k] = (b.tm[k] ?? iv) - dt; if (b.tm[k] <= 0) { b.tm[k] += iv; return true } return false }
  const ph2 = f < 0.5
  const nose = b.x - b.spr.hw * 0.8
  switch (b.id) {
    case 0: // WARDEN
      b.y = Math.sin(b.t * (ph2 ? 1.5 : 0.9)) * 18; b.x = b.tx + Math.sin(b.t * 0.5) * 3
      if (tk('aim', ph2 ? 0.9 : 1.4)) volley(nose, b.y, ph2 ? 5 : 3, ph2 ? 0.9 : 0.5, bs * 1.2)
      if (tk('fan', 4)) for (let i = 0; i < 11; i++) ebullet(nose, b.y, Math.PI + (i / 10 - 0.5) * 1.6, bs * 0.9, 'big')
      if (ph2 && tk('drone', 5)) for (let i = 0; i < 3; i++) spawnEnemy('drone', nose, b.y + (i - 1) * 7, { minion: true })
      break
    case 1: // HIVE MOTHER
      b.y = Math.sin(b.t * 0.6) * 14; b.x = b.tx + Math.cos(b.t * 0.4) * 5
      if (tk('ring', ph2 ? 1.0 : 1.5)) { const n = ph2 ? 16 : 11; for (let i = 0; i < n; i++) ebullet(b.x - 4, b.y, b.t + (i / n) * TAU, bs * 0.8, 'orbP') }
      if (tk('kami', ph2 ? 3.5 : 5)) for (let i = 0; i < 3; i++) spawnEnemy('kami', nose, b.y + (i - 1) * 8, { minion: true })
      if (tk('aim', 2)) volley(nose, b.y, 3, 0.4, bs * 1.3)
      if (ph2 && tk('mine', 4)) spawnEnemy('mine', nose, R(-22, 22), { minion: true })
      break
    case 2: // SENTINEL
      b.y += (clamp(G.p.y, -16, 16) - b.y) * Math.min(1, dt * 0.9)
      if (tk('dart', 1.4)) volley(nose, b.y, 3, 0.25, bs * 1.5, 'dart')
      if (tk('laser', ph2 ? 4.8 : 6.5)) { addBeam(b, G.p.y); if (ph2) addBeam(b, G.p.y + (G.p.y > 0 ? -15 : 15)) }
      if (tk('ring', 3.4)) for (let i = 0; i < 12; i++) ebullet(b.x, b.y, (i / 12) * TAU, bs * 0.75, 'orbC')
      break
    case 3: case 8: { // PHANTOM / VOID REAPER
      const reaper = b.id === 8
      b.st = b.st ?? 'idle'
      if (b.st === 'idle') {
        b.ghost = false; b.k = 1; b.y += Math.sin(b.t * 2) * 0.25
        if (tk('aim', ph2 ? 0.55 : 0.8)) volley(nose, b.y, ph2 ? 3 : 1, 0.3, bs * 1.8, 'dart')
        if (tk('blink', reaper ? 2.2 : 3)) { b.st = 'out'; b.s = 0.5; sfx('blink') }
      } else if (b.st === 'out') {
        b.s -= dt; b.k = Math.max(0.12, b.s / 0.5); b.ghost = true
        if (b.s <= 0) {
          b.x = R(18, 42); b.y = R(-18, 18); b.st = 'in'; b.s = 0.4; sfx('blink')
          volley(b.x - 6, b.y, reaper ? 11 : 9, 1.5, bs * 1.1, 'orbP')
          if (ph2 || reaper) for (let i = 0; i < (reaper ? 18 : 14); i++) ebullet(b.x, b.y, (i / (reaper ? 18 : 14)) * TAU, bs * 0.7, 'orbP')
          if (reaper && ph2) addBeam(b, G.p.y, 0.9, 0.8)
        }
      } else {
        b.s -= dt; b.k = Math.max(0.12, 1 - b.s / 0.4); b.ghost = true
        if (b.s <= 0) { b.st = 'idle'; b.tm.blink = 3 }
      }
      break
    }
    case 4: // DREADNOUGHT
      b.y = Math.sin(b.t * 0.35) * 8
      if (tk('spiral', ph2 ? 0.1 : 0.15)) { b.sp = (b.sp || 0) + 0.33; for (const yy of [b.y + 11, b.y - 11]) ebullet(b.x - 10, yy, Math.PI + Math.sin(b.sp) * 1.0, bs * 0.9, 'orbC') }
      if (tk('missile', 4.5)) ebullet(nose, b.y, Math.PI, bs * 0.55, 'missile', { homing: true, life: 4 })
      if (tk('aim', 2.4)) volley(nose, b.y, 5, 0.9, bs * 1.1)
      if (ph2 && tk('spawn', 6)) { spawnEnemy('shooter', nose, b.y + 14, { minion: true, stopX: 20 }); spawnEnemy('shooter', nose, b.y - 14, { minion: true, stopX: 26 }) }
      break
    case 5: // TWIN GUARD
      b.y = Math.sin(b.t * (ph2 ? 1.4 : 1)) * 17; b.x = b.tx + Math.sin(b.t * 0.7) * 3
      if (tk('aim', ph2 ? 0.55 : 0.8)) { volley(nose, b.y + 10, 3, 0.4, bs * 1.2, 'dartC'); volley(nose, b.y - 10, 3, 0.4, bs * 1.2, 'dartC') }
      if (tk('ring', 3)) for (let i = 0; i < 12; i++) ebullet(b.x, b.y, (i / 12) * TAU + b.t, bs * 0.75, 'orbC')
      if (ph2 && tk('laser', 7)) addBeam(b, G.p.y)
      if (ph2 && tk('weaver', 6)) { spawnEnemy('weaver', nose, 14, { minion: true }); spawnEnemy('weaver', nose, -14, { minion: true }) }
      break
    case 6: // STORM WEAVER
      b.y = Math.sin(b.t * 1.1) * 20
      if (tk('spiral', 0.12)) { b.sp = (b.sp || 0) + 0.32; ebullet(nose, b.y, Math.PI + Math.sin(b.sp) * 1.4, bs, 'orbP') }
      if (tk('fan', 2.6)) for (let i = 0; i < 9; i++) ebullet(nose, b.y, Math.PI + (i / 8 - 0.5) * 1.5, bs * 0.9, 'big')
      if (ph2 && tk('laser', 5)) { addBeam(b, G.p.y); addBeam(b, G.p.y > 0 ? G.p.y - 15 : G.p.y + 15) }
      if (ph2 && tk('kami', 5)) for (let i = 0; i < 3; i++) spawnEnemy('kami', nose, b.y + (i - 1) * 9, { minion: true })
      break
    case 7: // BEHEMOTH
      b.y = Math.sin(b.t * 0.3) * 10
      if (tk('aim', 1.8)) volley(nose, b.y, 7, 1.1, bs * 1.1)
      if (tk('ring', 5)) for (let i = 0; i < 20; i++) ebullet(b.x, b.y, (i / 20) * TAU, bs * 0.7, 'orbY')
      if (tk('missile', 4)) { ebullet(nose, b.y + 8, Math.PI, bs * 0.55, 'missile', { homing: true, life: 4 }); ebullet(nose, b.y - 8, Math.PI, bs * 0.55, 'missile', { homing: true, life: 4 }) }
      if (ph2 && !b.carrier) { b.carrier = true; spawnEnemy('carrier', nose, 0, { minion: true }) }
      if (ph2 && tk('shooters', 7)) { spawnEnemy('shooter', nose, 16, { minion: true, stopX: 18 }); spawnEnemy('shooter', nose, -16, { minion: true, stopX: 24 }) }
      break
    case 9: { // OMEGA CORE
      const ph = f > 0.66 ? 1 : f > 0.33 ? 2 : 3
      if (ph !== b.ph) {
        b.ph = ph; b.invulnT = 2.4; sfx('phase'); flash(0.8, [1, 0.5, 1]); shake(3)
        G.ebul.slice(0, 40).forEach((e) => dropCoin(e.x, e.y, 'gem')); G.ebul.length = 0; G.beams.length = 0
        ring(b.x, b.y, 60, 70, COLS.purple)
        G.banner = { title: 'PHASE ' + ph, sub: ph === 2 ? 'OMEGA CORE ADAPTS' : 'OMEGA CORE ENRAGED', kind: 'warn', t: 2.4 }
        toast(ph === 2 ? 'CORE EXPOSED  -  LASERS ONLINE' : 'LAST STAND!', '#ff4de1')
      }
      if (b.invulnT > 0) { b.x = b.tx + R(-0.3, 0.3); break }
      b.y = Math.sin(b.t * (0.6 + 0.25 * ph)) * (14 + ph * 2); b.x = b.tx + Math.cos(b.t * 0.5) * 3
      if (ph === 1) {
        if (tk('spiral', 0.11)) { b.sp = (b.sp || 0) + 0.3; for (let i = 0; i < 2; i++) ebullet(nose, b.y, Math.PI + Math.sin(b.sp + i * Math.PI) * 1.2, bs * 0.95, 'orbR') }
        if (tk('aim', 1.6)) volley(nose, b.y, 3, 0.5, bs * 1.3, 'dart')
      } else if (ph === 2) {
        if (tk('spiral', 0.13)) { b.sp = (b.sp || 0) + 0.34; ebullet(nose, b.y, Math.PI + Math.sin(b.sp) * 1.3, bs, 'orbP') }
        if (tk('laser', 4.6)) { addBeam(b, G.p.y, 1.0, 0.9, 3.6); addBeam(b, G.p.y > 0 ? G.p.y - 16 : G.p.y + 16, 1.0, 0.9, 3.6) }
        if (tk('kami', 6)) for (let i = 0; i < 3; i++) spawnEnemy('kami', nose, b.y + (i - 1) * 9, { minion: true })
        if (tk('ring', 2.0)) for (let i = 0; i < 14; i++) ebullet(b.x, b.y, (i / 14) * TAU + b.t, bs * 0.7, 'orbC')
      } else {
        if (tk('spiral', 0.085)) { b.sp = (b.sp || 0) + 0.31; for (let i = 0; i < 3; i++) ebullet(nose, b.y, Math.PI + Math.sin(b.sp + i * 2.1) * 1.35, bs * 0.95, i === 0 ? 'orbR' : 'orbP') }
        if (tk('ring', 1.4)) for (let i = 0; i < 18; i++) ebullet(b.x, b.y, (i / 18) * TAU + b.t, bs * 0.7, 'orbY')
        if (tk('aim', 1.1)) volley(nose, b.y, 5, 0.8, bs * 1.35, 'dart')
        if (tk('laser', 5.2)) { addBeam(b, G.p.y, 0.9, 0.8, 3.6); addBeam(b, G.p.y + 15, 0.9, 0.8, 3.6); addBeam(b, G.p.y - 15, 0.9, 0.8, 3.6) }
        if (tk('spawn', 7)) { spawnEnemy('weaver', nose, 14, { minion: true }); spawnEnemy('weaver', nose, -14, { minion: true }) }
      }
      break
    }
  }
}

function endBoss() {
  const b = G.boss, d = BOSSES[b.id]
  boom(b.x, b.y, 140, 90, COLS.fire, 1.6); ring(b.x, b.y, 80, 90, COLS.fire); ring(b.x, b.y, 60, 55, COLS.cyan)
  flash(1); shake(5); sfx('bigBoom'); speak('Boss destroyed')
  G.score += d.score; addScore(0, 0, 0, false)
  popup(b.x, b.y, String(d.score), [1, 0.9, 0.3])
  for (let i = 0; i < 30; i++) dropCoin(b.x + R(-8, 8), b.y + R(-8, 8))
  for (let i = 0; i < 3; i++) dropPup(b.x + R(-10, 10), b.y + R(-10, 10), weightedPup())
  dropPup(b.x, b.y, 'D'); toast('BOSS REWARD: WINGMAN DRONE', '#b6ff3d')
  G.stats.bossKilled = true; profile.bosses++; G.meter = Math.min(100, G.meter + 40)
  G.boss = null; G.slow = 1
  G.enemies.forEach((e) => { if (!e.dead) { e.dead = true; boom(e.x, e.y, 10, 25) } })
  G.exitT = 0.0001; G.exitWait = 4.5; G.warped = false
  G.bossState = 'done'
  music.stop()
}

// ---------- mission flow ----------
export function chalProgress() {
  const c = MISSIONS[G.mission].challenge, st = G.stats
  let cur = 0, done = false, failed = false
  switch (c.type) {
    case 'kills': cur = st.kills; done = cur >= c.target; break
    case 'pups': cur = st.pups; done = cur >= c.target; break
    case 'combo': cur = st.maxCombo; done = cur >= c.target; break
    case 'score': cur = G.score - st.scoreStart; done = cur >= c.target; break
    case 'ufo': cur = st.ufos; done = cur >= c.target; break
    case 'nodmg': failed = st.dmg > 0; done = !failed && !!st.bossKilled; break
    case 'nolife': failed = st.lost > 0; done = !failed && !!st.bossKilled; break
  }
  return { cur: Math.min(cur, c.target), target: c.target, done, failed, desc: c.desc, type: c.type }
}

function startMission(i) {
  G.mission = i; G.mode = 'playing'; G.bonus = null; G.lz = null
  G.enemies = []; G.pbul = []; G.ebul = []; G.pups = []; G.parts = []; G.beams = []; G.pops = []; G.boss = null
  G.stats = { kills: 0, total: 0, dmg: 0, pups: 0, maxCombo: 0, ufos: 0, coins: 0, lost: 0, bombs: 0, scoreStart: G.score, bossKilled: false }
  G.meter = Math.min(G.meter || 0, 40); G.mt = 0; G.dirT = 1.2; G.evtT = 20; G.golden = 0; G.meteor = 0; G.introT = 3.4; G.bossState = 'none'; G.exitT = 0; G.warped = false; G.overT = 0; G.combo = 0; G.slow = 1; G.scroll = 1
  G.specialsDone = new Set(); G.summary = null
  G.p = newPlayer()
  G.save = { droneKeep: G.droneKeep, score: G.score, credits: G.credits, lives: G.lives, up: { ...G.up }, wl: G.wlKeep, nextLife: G.nextLife }
  const m = MISSIONS[i]
  G.banner = { title: i === MISSIONS.length - 1 ? 'FINAL ROUND' : 'MISSION ' + (i + 1), sub: m.name, sub2: 'CHALLENGE: ' + m.challenge.desc.toUpperCase(), kind: 'intro', t: 3.4 }
  music.set('play', i); sfx('mission'); speak(i === MISSIONS.length - 1 ? 'Final round. Good luck.' : 'Mission ' + (i + 1)); emit()
}

function finishMission() {
  const st = G.stats, m = MISSIONS[G.mission], ch = chalProgress()
  const rate = st.total ? Math.min(1, st.kills / st.total) : 1
  const lines = []
  const killBonus = Math.round(rate * 2000)
  lines.push({ label: `ENEMIES DESTROYED  ${st.kills}/${st.total}`, value: '+' + killBonus + ' PTS', kind: 'score' })
  let scoreAdd = killBonus, credAdd = Math.round(rate * 200)
  lines.push({ label: 'SALVAGE', value: '+' + credAdd + ' CR', kind: 'cred' })
  if (st.dmg === 0) { scoreAdd += 3000; credAdd += 300; lines.push({ label: 'FLAWLESS - NO DAMAGE', value: '+3000 PTS +300 CR', kind: 'bonus' }) }
  if (st.maxCombo >= 10) { scoreAdd += st.maxCombo * 50; lines.push({ label: `MAX COMBO  ${st.maxCombo}`, value: '+' + st.maxCombo * 50 + ' PTS', kind: 'score' }) }
  if (ch.done) {
    scoreAdd += m.challenge.reward.score; credAdd += m.challenge.reward.credits
    if ((G.droneKeep || 0) < 3) G.droneKeep = (G.droneKeep || 0) + 1
    lines.push({ label: 'CHALLENGE COMPLETE: ' + m.challenge.desc.toUpperCase(), value: `+${m.challenge.reward.score} PTS +${m.challenge.reward.credits} CR +DRONE`, kind: 'bonus' })
  } else lines.push({ label: 'CHALLENGE FAILED: ' + m.challenge.desc.toUpperCase(), value: '---', kind: 'fail' })
  G.score += scoreAdd; G.credits += credAdd
  G.unlocked = Math.max(G.unlocked, Math.min(MISSIONS.length - 1, G.mission + 1))
  try { localStorage.setItem('si_unlock', String(G.unlocked)) } catch { /* ignore */ }
  if (G.score > G.hi) G.hi = G.score
  saveHi()
  const grade = st.dmg === 0 && rate > 0.9 ? 'S' : rate > 0.85 ? 'A' : rate > 0.65 ? 'B' : 'C'
  G.summary = { lines, grade, credAdd, scoreAdd, name: m.name, final: G.mission === MISSIONS.length - 1 }
  if (G.summary.final) {
    const lifeB = G.lives * 5000, hpB = G.p.hp * 1000
    G.score += lifeB + hpB
    if (G.score > G.hi) G.hi = G.score
    saveHi()
    const rank = G.score > 450000 ? 'S' : G.score > 300000 ? 'A' : G.score > 170000 ? 'B' : 'C'
    G.final = { score: G.score, lifeB, hpB, rank }
    profile.spaceWins++; recordScore('space', G.score)
    G.mode = 'victory'; sfx('win'); speak('Earth is saved. Victory!'); music.set('menu', 0)
  } else { G.mode = 'clear'; sfx('clear'); speak('Mission complete'); music.set('menu', 0) }
  emit()
}
const saveHi = () => { try { localStorage.setItem('si_hi', String(G.hi)) } catch { /* ignore */ } }

// ---------- per-frame ----------
function stepPlayer(dt) {
  const p = G.p
  for (const k in p.cd) p.cd[k] = Math.max(0, p.cd[k] - dt)
  p.skT = Math.max(0, p.skT - dt); p.od = Math.max(0, p.od - dt); p.inv = Math.max(0, p.inv - dt)
  for (const k of ['rapidT', 'shieldT', 'magnetT', 'multT']) p[k] = Math.max(0, p[k] - dt)
  if (p.specialT > 0) { p.specialT -= dt; if (p.specialT <= 0) p.special = 'normal' }
  if (!p.alive) {
    p.respawn -= dt
    if (p.respawn <= 0 && G.lives > 0 && !G.overT) {
      Object.assign(p, { alive: true, hp: p.maxHp, inv: 3, shieldT: 2.5, x: -42, y: 0, vx: 0, vy: 0, wl: Math.max(1 + G.up.fire, p.wl - 1), special: 'normal', specialT: 0, rapidT: 0, skT: 0, drones: Math.max(G.up.drone, G.droneKeep || 0) })
      p.cd.laser = p.cd.bomb = p.cd.shield = 0; G.lz = null
      G.wlKeep = p.wl; sfx('shield')
    }
    return
  }
  if (G.warped) { p.vx += 130 * dt; p.x += p.vx * dt; p.y += (0 - p.y) * dt * 2; return }
  const ax = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0)
  const ay = (keys.ArrowUp || keys.KeyW ? 1 : 0) - (keys.ArrowDown || keys.KeyS ? 1 : 0)
  const len = Math.hypot(ax, ay) || 1
  const speed = (G.lz ? 0.6 : 1) * p.spd
  p.vx += ((ax / len) * speed - p.vx) * Math.min(1, dt * 14)
  p.vy += ((ay / len) * speed - p.vy) * Math.min(1, dt * 14)
  p.x += p.vx * dt + G.drag.x; p.y += p.vy * dt + G.drag.y
  G.drag.x = 0; G.drag.y = 0
  p.x = clamp(p.x, -HW + 5, HW - 5); p.y = clamp(p.y, -HH + 4, HH - 8.5)
  p.fireCd -= dt
  if ((keys.Space || G.touchFire || keys.KeyJ) && p.fireCd <= 0 && !G.lz) firePlayer()
  // wingman drones: orbit the ship, shoot, and absorb enemy bullets
  const SL = [[-2, 7.5], [-2, -7.5], [-9, 0]]
  const nd = p.od > 0 ? 3 : p.drones
  while (p.dr.length < nd) p.dr.push({ x: p.x, y: p.y, cd: R(0, 0.3) })
  p.dr.length = nd
  if (p.od > 0 && Math.random() < 0.8) part(p.x + R(-4, 2), p.y + R(-4, 4), R(-30, -10), R(-10, 10), 0.4, pick(COLS.purple), 1.2)
  p.dr.forEach((d, i) => {
    const bob = Math.sin(G.time * 3 + i * 2) * 1.2
    d.x += (p.x + SL[i][0] - d.x) * Math.min(1, dt * 9); d.y += (p.y + SL[i][1] + bob - d.y) * Math.min(1, dt * 9)
    d.cd -= dt
    if (d.cd <= 0 && !G.lz && (keys.Space || G.touchFire || keys.KeyJ)) {
      d.cd = 0.32
      G.pbul.push({ x: d.x + 2, y: d.y, vx: 85, vy: 0, spr: SP.pb, hw: 1.5, hh: 0.8, dmg: 1, pierce: false, homing: false, blast: false, k: 1.5, t: 0 })
    }
  })
  // engine flame
  if (Math.random() < 0.9) part(p.x - 5, p.y + R(-0.6, 0.6), R(-34, -20), R(-3, 3), R(0.15, 0.32), pick(TRAIL_COLS[Math.min(profile.ship.trail, TRAIL_COLS.length - 1)]), R(0.6, 1))
}

function stepBullets(dt) {
  for (const b of G.pbul) {
    b.t += dt
    if (b.homing) {
      let best = null, bd = 1e9
      for (const e of G.enemies) if (!e.dead && e.x > b.x - 2) { const d = Math.hypot(e.x - b.x, e.y - b.y); if (d < bd) { bd = d; best = e } }
      if (!best && G.boss && !G.boss.dying) best = G.boss
      if (best) {
        const sp = Math.hypot(b.vx, b.vy), want = Math.atan2(best.y - b.y, best.x - b.x), cur = Math.atan2(b.vy, b.vx)
        const da = ((want - cur + Math.PI * 3) % TAU) - Math.PI, a = cur + clamp(da, -5 * dt, 5 * dt)
        b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp
      }
      if (Math.random() < 0.6) part(b.x - 2, b.y, -10, R(-3, 3), 0.25, COLS.fire[2], 0.7)
    }
    b.x += b.vx * dt; b.y += b.vy * dt
    if (b.x > HW + 8 || b.x < -HW - 8 || Math.abs(b.y) > HH + 8) b.dead = true
  }
  for (const b of G.ebul) {
    b.t += dt
    if (b.homing && b.t < (b.life || 3)) {
      const sp = Math.hypot(b.vx, b.vy), want = Math.atan2(G.p.y - b.y, G.p.x - b.x), cur = Math.atan2(b.vy, b.vx)
      const da = ((want - cur + Math.PI * 3) % TAU) - Math.PI, a = cur + clamp(da, -1.6 * dt, 1.6 * dt)
      b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp
      if (Math.random() < 0.7) part(b.x + 2, b.y, 8, R(-3, 3), 0.3, COLS.fire[2], 0.7)
    }
    b.x += b.vx * dt; b.y += b.vy * dt
    if (b.x > HW + 10 || b.x < -HW - 10 || Math.abs(b.y) > HH + 10 || (b.homing && b.t > (b.life || 3) + 1.5)) b.dead = true
  }
}

function collisions() {
  const p = G.p
  // player bullets
  for (const b of G.pbul) {
    if (b.dead) continue
    for (const e of G.enemies) {
      if (e.dead || (b.hits && b.hits.has(e)) || !hit(b, e) || e.x > HW + 2) continue
      hurtEnemy(e, b.dmg)
      if (b.pierce) (b.hits || (b.hits = new Set())).add(e)
      else { b.dead = true; part(b.x, b.y, 0, 0, 0.12, COLS.cyan[0], 1.4) }
      if (b.blast) blast(b)
      if (!b.pierce) break
    }
    if (!b.dead && G.boss && !G.boss.dying && !(b.hits && b.hits.has(G.boss)) && hit(b, G.boss)) {
      damageBoss(b.dmg)
      if (b.pierce) (b.hits || (b.hits = new Set())).add(G.boss); else { b.dead = true; part(b.x, b.y, 0, 0, 0.12, COLS.cyan[0], 1.4) }
      if (b.blast) blast(b)
    }
  }
  if (!p.alive) return
  const pb = p
  for (const b of G.ebul) {
    if (b.dead) continue
    if (p.dr.some((d) => Math.abs(d.x - b.x) < 2.6 && Math.abs(d.y - b.y) < 2.4)) { b.dead = true; part(b.x, b.y, 0, 0, 0.15, COLS.cyan[0], 1.3); sfx('deflect'); continue }
    if (p.skT > 0 && Math.hypot(b.x - p.x, b.y - p.y) < 9) {
      b.dead = true; part(b.x, b.y, 0, 0, 0.15, COLS.green[1], 1.4)
      if (skillLv('shield') >= 4 && Math.random() < 0.5) G.pbul.push({ x: b.x, y: b.y, vx: 80, vy: 0, spr: SP.pbS, hw: 1.2, hh: 1.2, dmg: 2, pierce: false, homing: true, blast: false, k: 1.8, t: 0 })
      continue
    }
    if (hit(pb, b)) { b.dead = true; hurtPlayer(1) }
  }
  if (p.skT > 0) {
    const L = skillLv('shield')
    for (const e of G.enemies) {
      if (e.dead || (e.rt = (e.rt || 0) - G.dtc) > 0) continue
      if (Math.hypot(e.x - p.x, e.y - p.y) < 9 + e.hw) { e.rt = 0.25; hurtEnemy(e, 1 + L) }
    }
    const bb = G.boss
    if (bb && !bb.dying && !bb.enter && Math.hypot(bb.x - p.x, bb.y - p.y) < 9 + bb.hw && (bb.rt = (bb.rt || 0) - G.dtc) <= 0) { bb.rt = 0.4; damageBoss(1 + L) }
  }
  for (const e of G.enemies) {
    if (e.dead || e.x > HW) continue
    if (hit(pb, e)) {
      if (e.type === 'ufo') continue
      hurtPlayer(1)
      if (e.maxhp <= 6) killEnemy(e); else hurtEnemy(e, 3)
    }
  }
  if (G.boss && !G.boss.dying && !G.boss.enter && hit(pb, G.boss)) hurtPlayer(1)
  for (const bm of G.beams) {
    if (bm.t >= bm.warn && bm.t < bm.warn + bm.life && Math.abs(p.y - bm.y) < bm.h / 2 + p.hh && p.x < bm.x) hurtPlayer(1)
  }
  const mag = G.up.magnet * 5 + 9
  for (const pu of G.pups) {
    if (pu.dead) continue
    const dx = p.x - pu.x, dy = p.y - pu.y, d = Math.hypot(dx, dy)
    const rad = p.magnetT > 0 ? 55 : (pu.type === 'coin' || pu.type === 'gem' ? mag : 0)
    if (rad && d < rad) { pu.vx += (dx / d) * 220 * G.dtc; pu.vy += (dy / d) * 220 * G.dtc; pu.drag = true }
    if (Math.abs(dx) < pu.hw + 2.6 && Math.abs(dy) < pu.hh + 2.2) collect(pu)
  }
}
function blast(b) {
  boom(b.x, b.y, 14, 40, COLS.fire, 1.2); sfx('boom')
  for (const e of G.enemies) if (!e.dead && Math.hypot(e.x - b.x, e.y - b.y) < 9) hurtEnemy(e, 2)
}

export function triggerSpaceEvent(kind) { spaceEvent(kind) }
function spaceEvent(kind) {
  sfx('event')
  if (kind ? kind === 'meteor' : Math.random() < 0.5) {
    G.meteor = 8; G.meteorT = 0
    G.banner = { title: 'METEOR SHOWER!', sub: 'DODGE THE ROCKS · SHOOT THEM FOR COINS', kind: 'warn', t: 2.4 }; speak('Meteor shower!', 0.7, 1.1)
  } else {
    G.golden = 10
    G.banner = { title: 'GOLDEN WAVE!', sub: 'SCORE ×2 · EXTRA COINS · KILL EVERYTHING', kind: 'bonus', t: 2.4 }; speak('Golden wave!', 0.8, 1.15)
    for (let i = 0; i < 8; i++) spawnEnemy('drone', HW + 6 + i * 6, -16 + (i % 4) * 11)
    flash(0.3, [1, 0.9, 0.4])
  }
}
function stepDirector(dt) {
  const m = MISSIONS[G.mission]
  if (G.introT > 0) { G.introT -= dt; return }
  if (G.bonus) return stepBonus(dt)
  if (G.bossState === 'warn') {
    G.warnT -= dt
    if (G.warnT <= 0) spawnBoss()
    return
  }
  if (G.bossState !== 'none') return
  G.mt += dt
  for (const s of m.specials) {
    if (G.mt >= s.t && !G.specialsDone.has(s.t)) {
      G.specialsDone.add(s.t)
      if (s.e === 'ufo') { spawnEnemy('ufo', HW + 8, R(14, 22)); toast('BONUS UFO!', '#ffe84a'); sfx('blink') }
      else spawnEnemy(s.e, HW + 10, R(-12, 12))
    }
  }
  // random events: meteor shower / golden wave
  G.evtT = (G.evtT ?? 18) - dt
  if (G.mt > 8 && G.mt < m.length - 6 && G.evtT <= 0 && !(G.golden > 0) && !(G.meteor > 0)) { G.evtT = R(26, 40); spaceEvent() }
  if (G.meteor > 0) {
    G.meteor -= dt; G.meteorT -= dt
    if (G.meteorT <= 0) { G.meteorT = 0.3; spawnEnemy('rockL', HW + 8, R(-22, 22), { vx: -R(34, 54), vy: R(-6, 6), noCount: true, rich: true }) }
  }
  if (G.golden > 0) G.golden -= dt
  if (G.mt < m.length) {
    G.dirT -= dt
    if (G.dirT <= 0) { spawnGroup(m); G.dirT = lerp(m.interval[0], m.interval[1], G.mt / m.length) }
  } else if (G.enemies.every((e) => e.dead || ENEMIES[e.type].bonus) || G.mt > m.length + 12) startBoss()
}

// ---------- bonus round: coin rush ----------
function bonusCoin(x, y, type = 'coin') {
  const s = SP[type]
  G.pups.push({ kind: 'pup', type, x, y, vx: -15, vy: 0, spr: s, hw: 2.8, hh: 2.8, t: Math.random() * 3 })
  G.bonus.spawned++
}
function startBonus(next) {
  G.mission = next; G.mode = 'playing'; G.lz = null
  G.enemies = []; G.pbul = []; G.ebul = []; G.pups = []; G.parts = []; G.beams = []; G.pops = []; G.boss = null
  G.stats = { kills: 0, total: 0, dmg: 0, pups: 0, maxCombo: 0, ufos: 0, coins: 0, lost: 0, bombs: 0, scoreStart: G.score, bossKilled: false }
  G.bonus = { t: 0, len: 20, next, n: 0, dirT: 0, spawned: 0, start: G.credits, done: false, endT: 0, ufo1: false, ufo2: false }
  G.introT = 2.6; G.bossState = 'none'; G.exitT = 0; G.warped = false; G.overT = 0; G.combo = 0; G.slow = 1; G.scroll = 1.8
  G.p = newPlayer(); G.p.shieldT = 0
  G.banner = { title: 'BONUS ROUND', sub: 'COIN RUSH', sub2: 'GRAB EVERYTHING - NO ENEMIES!', kind: 'bonus', t: 2.6 }
  music.set('play', next); sfx('mission'); speak('Bonus round! Grab everything.'); emit()
}
function stepBonus(dt) {
  const b = G.bonus, X = HW + 6
  b.t += dt; b.dirT -= dt
  if (b.t < b.len && b.dirT <= 0) {
    b.dirT = 1.7
    const k = b.n++ % 5, y0 = R(-14, 14)
    if (k === 0) for (let i = 0; i < 12; i++) bonusCoin(X + i * 4, Math.sin(i * 0.6) * 15)
    else if (k === 1) for (let i = 0; i < 10; i++) bonusCoin(X + i * 4, y0)
    else if (k === 2) { for (let i = 0; i < 14; i++) bonusCoin(X + 10 + Math.cos((i / 14) * TAU) * 9, y0 + Math.sin((i / 14) * TAU) * 9, i % 2 ? 'gem' : 'coin') }
    else if (k === 3) for (let i = 0; i < 8; i++) { bonusCoin(X + i * 4, -12); bonusCoin(X + i * 4, 12) }
    else for (let i = 0; i < 10; i++) bonusCoin(X + i * 3.5, -18 + i * 4)
  }
  if (!b.ufo1 && b.t > 5) { b.ufo1 = true; spawnEnemy('ufo', HW + 8, R(12, 20)); toast('TREASURE UFO!', '#ffe84a') }
  if (!b.ufo2 && b.t > 12) { b.ufo2 = true; spawnEnemy('ufo', HW + 8, R(-20, -12)); toast('TREASURE UFO!', '#ffe84a') }
  if (b.t >= b.len && !b.done) {
    b.done = true; b.endT = 3; profile.bonus++; saveProfile()
    const got = G.credits - b.start
    const perfect = G.stats.coins >= b.spawned * 0.8
    if (perfect) { G.credits += 250; G.score += 5000; toast('PERFECT COLLECT!  +250 CR', '#3dff7a') }
    G.banner = { title: 'BONUS COMPLETE', sub: `+${got + (perfect ? 250 : 0)} CREDITS`, sub2: `${G.stats.coins}/${b.spawned} COLLECTED`, kind: 'bonus', t: 3 }
    sfx('clear')
  }
  if (b.done && (b.endT -= dt) <= 0) startMission(b.next)
}

export function stepParticles(dt) {
  for (const q of G.parts) {
    q.life -= dt
    if (q.g) q.vy -= q.g * dt
    q.x += q.vx * dt; q.y += q.vy * dt
    if (q.drag) { const k = Math.max(0, 1 - q.drag * dt); q.vx *= k; q.vy *= k }
  }
  G.parts = G.parts.filter((q) => q.life > 0)
  for (const q of G.pops) { q.life -= dt; q.y += 8 * dt }
  G.pops = G.pops.filter((q) => q.life > 0)
  G.shake = Math.max(0, G.shake - dt * 5)
  G.flash = Math.max(0, G.flash - dt * 2.2)
}

function stepPlaying(dtRaw) {
  const dt = dtRaw * G.slow
  G.dtc = dt
  const p = G.p
  G.stats.time = (G.stats.time || 0) + dt
  stepPlayer(dt)
  stepLaser(dt)
  stepDirector(dt)
  stepEnemies(dt)
  stepBoss(dt)
  stepBullets(dt)
  for (const bm of G.beams) {
    bm.t += dt
    if (bm.owner && !bm.owner.dying) bm.x = bm.owner.x - bm.owner.spr.hw * 0.8
    if (bm.t > bm.warn + bm.life) bm.dead = true
    if (!bm.fired && bm.t >= bm.warn) { bm.fired = true; sfx('laserFire'); shake(1.2) }
  }
  collisions()
  for (const pu of G.pups) {
    pu.t += dt
    if (pu.drag) { const k = Math.max(0, 1 - 1.6 * dt); pu.vx *= k; pu.vy *= k; pu.vx -= 3 * dt }
    pu.x += pu.vx * dt; pu.y += pu.vy * dt
    pu.y = clamp(pu.y, -HH + 3, HH - 3)
    if (pu.x < -HW - 8) pu.dead = true
  }
  stepParticles(dt)
  // upkeep
  G.enemies = G.enemies.filter((e) => !e.dead)
  G.pbul = G.pbul.filter((b) => !b.dead)
  G.ebul = G.ebul.filter((b) => !b.dead)
  G.pups = G.pups.filter((b) => !b.dead)
  G.beams = G.beams.filter((b) => !b.dead)
  G.comboT -= dt; if (G.comboT <= 0) G.combo = 0
  for (const t of G.toasts) t.t -= dt
  G.toasts = G.toasts.filter((t) => t.t > 0)
  if (G.banner) { G.banner.t -= dt; if (G.banner.t <= 0) G.banner = null }
  // end conditions
  if (G.overT > 0) {
    G.overT -= dt
    if (G.overT <= 0) { G.overT = 0; G.mode = 'over'; if (G.score > G.hi) G.hi = G.score; saveHi(); recordScore('space', G.score); sfx('over'); speak('Game over'); music.stop(); emit() }
  }
  if (G.exitT > 0) {
    if (G.exitWait > 0) {
      G.exitWait -= dt
      if (G.exitWait < 2 && !G.warped) { G.warped = true; G.exitT = 1; sfx('warp') }
      if (G.exitT > 0 && G.warped) G.scroll = Math.min(14, G.scroll + dt * 8)
    }
    if (G.warped && p.x > HW + 10) { G.warped = false; G.exitT = 0; finishMission() }
  }
}

export function update(dtRaw) {
  metaT -= dtRaw
  if (metaT <= 0) { metaT = 1; try { tickMeta() } catch { /* ignore */ } }
  if (notices.length) { for (const n of notices) n.t -= dtRaw; if (notices.some((n) => n.t <= 0)) { notices.splice(0, notices.length, ...notices.filter((n) => n.t > 0)); emit() } }
  let left = Math.min(dtRaw, 0.2)
  while (left > 0.0001) {
    const d = Math.min(left, 1 / 30)
    left -= d
    tick(d)
  }
}
function tick(dt) {
  G.time += dt
  if (ARCADE.has(G.mode)) { G.dtc = dt; if (games[G.mode]) games[G.mode].update(dt) }
  else if (G.mode === 'playing') stepPlaying(dt)
  else if (G.mode !== 'paused') { G.dtc = dt; stepParticles(dt); G.scroll = lerp(G.scroll, G.mode === 'menu' ? 0.7 : 1, dt * 2) }
  emitT -= dt
  if (emitT <= 0) { emitT = 0.07; emit() }
}

// ---------- actions (UI) ----------
export function startGame() {
  initAudio()
  Object.assign(G, { score: 0, credits: 0, lives: 3, nextLife: 20000, wlKeep: 1, droneKeep: 0, up: { fire: 0, rate: 0, armor: 0, magnet: 0, drone: 0, laser: 0, bomb: 0, shield: 0 }, toasts: [], final: null })
  profile.played++; saveProfile(); sfx('ui'); startMission(0)
}
export function startGameAt(i) {
  if (i > G.unlocked) { sfx('deny'); return }
  startGame(); if (i > 0) { G.credits = 300 * i; startMission(i) }
}
export function toMenu() { if (games.slug) games.slug.stop(); if (games.pickle) games.pickle.stop(); if (games.bomber) games.bomber.stop(); if (games.tetris) games.tetris.stop(); if (games.chomp) games.chomp.stop(); if (games.cards) games.cards.stop(); G.parts = []; G.pops = []; G.shake = 0; G.flash = 0; saveProfile(); G.mode = 'menu'; G.banner = null; G.boss = null; G.enemies = []; G.ebul = []; G.pbul = []; G.pups = []; G.beams = []; initAudio(); music.set('menu'); sfx('ui'); emit() }
export function retryMission() {
  const s = G.save
  G.score = s.score; G.credits = s.credits; G.lives = Math.max(3, s.lives); G.up = { ...s.up }; G.wlKeep = s.wl; G.droneKeep = s.droneKeep || 0; G.nextLife = s.nextLife
  sfx('ui'); startMission(G.mission)
}
export function toShop() { G.mode = 'shop'; sfx('ui'); emit() }
export function launchNext() { sfx('ui'); if (BONUS_AFTER.includes(G.mission)) startBonus(G.mission + 1); else startMission(G.mission + 1) }
export function buy(key) {
  const u = UPGRADES.find((x) => x.key === key)
  if (!u) return
  const lvl = key === 'life' ? 0 : G.up[key]
  const cost = u.cost(lvl)
  const full = key === 'life' ? G.lives >= 6 : lvl >= u.max
  if (full || G.credits < cost) { sfx('deny'); return }
  G.credits -= cost
  if (key === 'life') G.lives++; else G.up[key]++
  sfx('buy'); emit()
}
export function markSeen(g) { if (!profile.seen[g]) { profile.seen[g] = true; saveProfile() } }
// ---------- meta systems: daily quests, login streak, award popups ----------
export const notices = []
export function announce(text, color = '#ffe84a', snd = 'cChip') {
  notices.push({ id: ++G.uid, text, color, t: 5 })
  if (notices.length > 4) notices.shift()
  sfx(snd); emit()
}
const dayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const gamesPlayed = (p) => (p.played || 0) + (p.pickleGames || 0) + (p.bomberGames || 0) + (p.tetrisGames || 0) + (p.chompGames || 0) + (p.cardGames || 0)
const counter = (key) => (key === 'gamesPlayed' ? gamesPlayed(profile) : profile[key] || 0)
export const QUEST_POOL = [
  { id: 'kills', desc: 'Destroy 40 enemies (Space Impact / Ground Zero)', key: 'kills', goal: 40, reward: 150 },
  { id: 'bosses', desc: 'Defeat 1 boss', key: 'bosses', goal: 1, reward: 250 },
  { id: 'pows', desc: 'Rescue 3 POWs in Ground Zero', key: 'pows', goal: 3, reward: 200 },
  { id: 'skills', desc: 'Use 10 skills in Space Impact or Ground Zero', key: 'skills', goal: 10, reward: 150 },
  { id: 'lines', desc: 'Clear 20 lines in Tetra Blast', key: 'tetrisLines', goal: 20, reward: 150 },
  { id: 'tetris', desc: 'Clear 4 lines at once (a TETRIS)', key: 'tetrises', goal: 1, reward: 250 },
  { id: 'dots', desc: 'Eat 150 dots in Maze Chomp', key: 'chompDots', goal: 150, reward: 150 },
  { id: 'ghosts', desc: 'Eat 5 ghosts in Maze Chomp', key: 'chompGhosts', goal: 5, reward: 200 },
  { id: 'blocks', desc: 'Blow up 30 blocks in Bomber Blast', key: 'bricks', goal: 30, reward: 150 },
  { id: 'bwin', desc: 'Win a Bomber Blast match', key: 'bomberWins', goal: 1, reward: 250 },
  { id: 'pwin', desc: 'Win a Pickleball game', key: 'pickleWins', goal: 1, reward: 250 },
  { id: 'aces', desc: 'Serve 2 aces in Pickleball', key: 'aces', goal: 2, reward: 200 },
  { id: 'cwin', desc: 'Win a game in the Card Room', key: 'cardWins', goal: 1, reward: 250 },
  { id: 'played', desc: 'Play 3 games of anything', key: 'gamesPlayed', goal: 3, reward: 150 },
]
export function ensureQuests() {
  const d = dayKey()
  const q = profile.quests
  if (q && q.day === d) return q
  let streak = 1
  if (q && q.day) { const diff = Math.round((Date.parse(d) - Date.parse(q.day)) / 86400000); streak = diff === 1 ? (q.streak || 1) + 1 : 1 }
  const pool = QUEST_POOL.slice().sort(() => Math.random() - 0.5).slice(0, 3)
  profile.quests = { day: d, streak, bonusClaimed: false, list: pool.map((def) => ({ ...def, base: counter(def.key), done: false })) }
  saveProfile()
  return profile.quests
}
export function claimDaily() {
  const q = ensureQuests()
  if (q.bonusClaimed) return
  const amt = 100 + 50 * Math.min(q.streak - 1, 6)
  q.bonusClaimed = true
  profile.chips = (profile.chips || 0) + amt
  saveProfile()
  announce(`DAILY BONUS +${amt} CHIPS  ·  DAY ${q.streak} STREAK`, '#ffe84a', 'life')
}
export const questProgress = (qu) => Math.min(qu.goal, Math.max(0, counter(qu.key) - qu.base))
function tickMeta() {
  const q = ensureQuests()
  for (const qu of q.list) {
    if (!qu.done && counter(qu.key) - qu.base >= qu.goal) {
      qu.done = true; profile.chips = (profile.chips || 0) + qu.reward; saveProfile()
      announce(`QUEST COMPLETE: ${qu.desc}  +${qu.reward} CHIPS`, '#3dff7a', 'cChip')
    }
  }
  if (!profile.awardsInit) { for (const [name, , get, goal] of ACH) if (get(profile, G.unlocked) >= goal) profile.awardsDone[name] = true; profile.awardsInit = true; saveProfile(); return }
  for (const [name, desc, get, goal] of ACH) {
    if (!profile.awardsDone[name] && get(profile, G.unlocked) >= goal) {
      profile.awardsDone[name] = true; profile.chips = (profile.chips || 0) + 100; saveProfile()
      announce(`🏆 AWARD UNLOCKED: ${name}  (+100 CHIPS)`, '#ffe84a', 'tLevel')
    }
  }
}
let metaT = 0

export function setName(n) { profile.name = String(n || '').replace(/[^\w .-]/g, '').slice(0, 14); saveProfile(); emit() }
export function setShip(k, v) { profile.ship[k] = v; saveProfile(); sfx('ui'); emit() }
export function togglePause() {
  if (G.mode === 'playing') { G.mode = 'paused'; sfx('ui') } else if (G.mode === 'paused') { G.mode = 'playing'; sfx('ui') }
  emit()
}
export function useBomb() { bomb() }
export function useSkill(k) { if (k === 'od') overdrive(); else if (k === 'laser') laser(); else if (k === 'bomb') bomb(); else if (k === 'shield') shieldSkill() }
export function setTouchFire(v) { G.touchFire = v }
export function dragShip(dx, dy) { G.drag.x += dx; G.drag.y += dy }

export function onKey(code, down) {
  keys[code] = down
  if (!down) return
  initAudio()
  if (ARCADE.has(G.mode)) { if (games[G.mode]) games[G.mode].onKey(code); return }
  if (code === 'KeyP' || code === 'Escape') togglePause()
  else if (G.mode === 'playing' && (code === 'KeyB' || code === 'KeyX' || code === 'ShiftLeft' || code === 'Digit2')) bomb()
  else if (G.mode === 'playing' && (code === 'KeyQ' || code === 'Digit1')) laser()
  else if (G.mode === 'playing' && (code === 'KeyE' || code === 'Digit3')) shieldSkill()
  else if (G.mode === 'playing' && (code === 'KeyR' || code === 'Digit4')) overdrive()
  else if (code === 'Enter' || code === 'Space') {
    if (G.mode === 'menu') startGame()
    else if (G.mode === 'clear') toShop()
    else if (G.mode === 'shop' && code === 'Enter') launchNext()
    else if (G.mode === 'over' && code === 'Enter') retryMission()
    else if (G.mode === 'victory' && code === 'Enter') toMenu()
    else if (G.mode === 'paused') togglePause()
  } else if (G.mode === 'shop' && /^Digit[1-9]$/.test(code)) buy(UPGRADES[+code.slice(5) - 1].key)
}

// ---------- snapshot ----------
function buildSnap() {
  const p = G.p
  const m = MISSIONS[G.mission]
  const ch = G.stats && G.stats.kills !== undefined ? chalProgress() : null
  const b = G.boss
  return {
    golden: G.golden > 0 ? G.golden : 0, meteor: G.meteor > 0 ? G.meteor : 0,
    notices: notices.map((n) => ({ id: n.id, text: n.text, color: n.color })),
    quests: (() => { const q = ensureQuests(); return { streak: q.streak, bonusClaimed: q.bonusClaimed, list: q.list.map((x) => ({ id: x.id, desc: x.desc, goal: x.goal, reward: x.reward, done: x.done, value: questProgress(x) })) } })(),
    seen: { ...profile.seen }, unlocked: G.unlocked, mode: G.mode, score: G.score, hi: G.hi, credits: G.credits, lives: G.lives,
    mission: G.mission, missionName: m.name, missionSub: m.sub, missions: MISSIONS.length, color: m.color,
    hp: p ? Math.max(0, p.hp) : 0, maxHp: p ? p.maxHp : 3,
    skills: p ? Object.keys(SK).map((k) => ({ k, key: SK[k].key, name: SK[k].name, color: SK[k].color, lv: skillLv(k), cd: p.cd[k], max: p.cdMax[k], active: k === 'laser' ? !!G.lz : k === 'shield' ? p.skT > 0 : p.cd.bomb > p.cdMax.bomb - 0.6 })).concat([{ k: 'od', key: 'R', name: 'OVERDRIVE', color: '#ff4de1', lv: '', label: p.od > 0 ? `${Math.ceil(p.od)}s` : G.meter >= 100 ? 'READY' : Math.floor(G.meter) + '%', cd: p.od > 0 ? 0 : G.meter >= 100 ? 0 : 100 - G.meter, max: 100, active: p.od > 0 }]) : [],
    profile: { ...profile, tops: { space: profile.tops.space.slice(), slug: profile.tops.slug.slice(), pickle: (profile.tops.pickle || []).slice(), bomber: (profile.tops.bomber || []).slice(), tetris: (profile.tops.tetris || []).slice(), chomp: (profile.tops.chomp || []).slice(), uno: (profile.tops.uno || []).slice(), pusoy: (profile.tops.pusoy || []).slice(), lucky9: (profile.tops.lucky9 || []).slice(), tongits: (profile.tops.tongits || []).slice() } }, wl: p ? p.wl : 1,
    special: p ? p.special : 'normal', specialT: p ? p.specialT : 0, rapidT: p ? p.rapidT : 0, shieldT: p ? p.shieldT : 0,
    magnetT: p ? p.magnetT : 0, multT: p ? p.multT : 0,
    combo: G.combo, comboMult: comboMult(), comboT: G.comboT,
    banner: G.banner ? { ...G.banner } : null,
    toasts: G.toasts.map((t) => ({ id: t.id, text: t.text, color: t.color })),
    boss: b ? { name: b.name, hp: b.hp, max: b.maxhp, ph: b.ph, enter: b.enter, dying: b.dying } : null,
    drones: p ? p.drones : 0, bonus: G.bonus ? { t: G.bonus.t, len: G.bonus.len, coins: G.stats.coins, done: G.bonus.done } : null,
    bonusNext: BONUS_AFTER.includes(G.mission),
    challenge: G.bonus ? null : ch, summary: G.summary, final: G.final, up: { ...G.up },
  }
}
emit()
music.set('menu')
if (typeof window !== 'undefined') window.__G = G

// dev helper: ?m=<mission 0-5>&sim=<seconds>&boss=1  fast-forwards into a mission / boss fight
export function debugStart(m, seconds = 0, boss = false) {
  startGame(); startMission(m)
  G.p.inv = 9999; G.p.wl = 3
  if (boss) G.mt = MISSIONS[m].length
  keys.Space = true
  for (let i = 0; i < seconds * 60; i++) update(1 / 60)
  keys.Space = false
}

export function debugBonus(next, seconds = 0) { startGame(); G.up.drone = 2; startBonus(next); keys.Space = true; for (let i = 0; i < seconds * 60; i++) update(1 / 60); keys.Space = false }
if (typeof window !== 'undefined') window.__update = update
