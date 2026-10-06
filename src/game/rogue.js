// NEON DEPTHS: a roguelike dungeon crawler. 3 classes, 3 floors of 4 rooms (the last room of each floor is a boss), a perk after every room.
// Move with WASD / arrows (or the touch stick); you attack automatically. Space = dash, Q = class special, 1-3 = pick a perk.
import { G, emit as engineEmit, keys, games, profile, saveProfile, recordScore, part, ring, shake, flash, popup, stepParticles, toMenu } from './engine.js'
import { sfx, music, speak } from './audio.js'
import { col, disk, circle, rect, line, clamp, R } from './pxl.js'

const AX = 44, AY = 23
export const CLASSES = [
  { id: 'knight', name: 'KNIGHT', ico: '⚔️', color: '#ffd23a', hp: 6, spd: 30, dmg: 15, rate: 0.38, desc: 'Sweeping sword. Tough. Special: WHIRLWIND.' },
  { id: 'ranger', name: 'RANGER', ico: '🏹', color: '#6aff9a', hp: 4, spd: 34, dmg: 9, rate: 0.26, desc: 'Fast arrows that pierce. Special: ARROW VOLLEY.' },
  { id: 'mage', name: 'MAGE', ico: '🔮', color: '#c58aff', hp: 4, spd: 30, dmg: 13, rate: 0.42, desc: 'Homing orbs. Special: FROST NOVA.' },
]
const PERKS = [
  { id: 'dmg', name: 'SHARPENED', ico: '🗡️', desc: '+25% damage', f: (p) => { p.dmg *= 1.25 } },
  { id: 'rate', name: 'QUICKDRAW', ico: '⚡', desc: '+22% attack speed', f: (p) => { p.rate *= 0.82 } },
  { id: 'hp', name: 'HEART JAR', ico: '❤️', desc: '+1 max heart and heal 2', f: (p) => { p.max += 1; p.hp = Math.min(p.max, p.hp + 2) } },
  { id: 'spd', name: 'WINGED BOOTS', ico: '👟', desc: '+14% move speed', f: (p) => { p.spd *= 1.14 } },
  { id: 'multi', name: 'MULTISHOT', ico: '✨', desc: '+1 projectile (knight: wider swing)', f: (p) => { p.multi += 1 } },
  { id: 'crit', name: 'LUCKY STRIKE', ico: '🍀', desc: '+12% crit chance (x2.2)', f: (p) => { p.crit += 0.12 } },
  { id: 'vamp', name: 'VAMPIRIC', ico: '🦇', desc: '12% to heal on kill', f: (p) => { p.vamp += 0.12 } },
  { id: 'shield', name: 'AEGIS', ico: '🛡️', desc: 'Block one hit every room', f: (p) => { p.aegis = true; p.shield = 1 } },
  { id: 'dash', name: 'SLIPSTREAM', ico: '💨', desc: 'Dash recharges 35% faster', f: (p) => { p.dashCd *= 0.65 } },
  { id: 'pierce', name: 'PIERCING', ico: '🔱', desc: 'Shots pierce +1 (knight: knockback)', f: (p) => { p.pierce += 1 } },
  { id: 'magnet', name: 'MAGNET', ico: '🧲', desc: 'Pull gold from far away', f: (p) => { p.magnet += 14 } },
  { id: 'special', name: 'OVERCHARGE', ico: '🌀', desc: 'Special recharges 35% faster', f: (p) => { p.spCd *= 0.65 } },
]
const EN = {
  slime: { hp: 20, spd: 12, c: '#5aff7a', r: 1.6, dmg: 1, gold: 2 },
  bat: { hp: 10, spd: 22, c: '#c06aff', r: 1.1, dmg: 1, gold: 2 },
  archer: { hp: 16, spd: 10, c: '#ffb04a', r: 1.4, dmg: 1, gold: 3, shoot: 1.9 },
  brute: { hp: 70, spd: 9, c: '#ff5a5a', r: 2.3, dmg: 2, gold: 6 },
  caster: { hp: 22, spd: 8, c: '#4ad8ff', r: 1.4, dmg: 1, gold: 5, shoot: 2.4 },
  king: { hp: 420, spd: 8, c: '#3adf6a', r: 4.6, dmg: 2, gold: 40, boss: true, name: 'SLIME KING' },
  lord: { hp: 640, spd: 9, c: '#e8e8ff', r: 3.6, dmg: 2, gold: 60, boss: true, name: 'BONE LORD' },
  eye: { hp: 820, spd: 10, c: '#ff4adf', r: 4, dmg: 2, gold: 90, boss: true, name: 'VOID EYE' },
}
const BOSS = ['king', 'lord', 'eye']
export const RG = { mode: 'idle', paused: false, cls: 0, floor: 0, room: 0, p: null, en: [], eb: [], pb: [], loot: [], obst: [], open: false, choices: null, gold: 0, kills: 0, t: 0, emitT: 0, msg: null, over: null, stick: [0, 0], aimPt: null, aimT: 0, fx: [], swing: null, intro: 0, spawnQ: [], perks: [], hurtT: 0 }
let snap = null
const subs = new Set()
export const subscribeRogue = (f) => { subs.add(f); return () => subs.delete(f) }
export const getRogueSnap = () => snap
function emitR() {
  const p = RG.p
  snap = { mode: RG.mode, paused: RG.paused, cls: RG.cls, floor: RG.floor + 1, room: RG.room + 1, hp: p ? p.hp : 0, max: p ? p.max : 0, shield: p ? p.shield : 0, gold: RG.gold, kills: RG.kills, dash: p ? Math.max(0, p.dashT) / p.dashCd : 0, special: p ? Math.max(0, p.spT) / p.spCd : 0, choices: RG.choices ? RG.choices.map((c) => ({ id: c.id, name: c.name, ico: c.ico, desc: c.desc })) : null, msg: RG.msg ? { ...RG.msg } : null, over: RG.over, boss: bossOf(), perks: RG.perks.slice(), open: RG.open, rooms: RG.floor * 4 + RG.room }
  subs.forEach((f) => f())
}
const bossOf = () => { const b = RG.en.find((e) => e.def.boss && !e.dead); return b ? { name: b.def.name, hp: Math.max(0, b.hp) / b.max } : null }
function start(cfg = {}) {
  const c = CLASSES[clamp(cfg.cls | 0, 0, 2)]
  RG.cls = clamp(cfg.cls | 0, 0, 2); RG.floors = clamp(cfg.floors | 0 || 3, 1, 3)
  RG.p = { x: -AX + 6, y: 0, hp: c.hp, max: c.hp, spd: c.spd, dmg: c.dmg, rate: c.rate, multi: 1, crit: 0.05, vamp: 0, shield: 0, aegis: false, pierce: 0, magnet: 4, dashCd: 1.3, spCd: 9, dashT: 0, spT: 0, atkT: 0, inv: 0, dash: 0, dx: 1, dy: 0, face: 0, vx: 0, vy: 0 }
  RG.floor = 0; RG.room = 0; RG.gold = 0; RG.kills = 0; RG.perks = []; RG.over = null; RG.paused = false; RG.choices = null; RG.t = 0; RG.fx = []
  G.mode = 'rogue'; engineEmit(); G.parts = []; G.pops = []; G.shake = 0; G.flash = 0
  RG.mode = 'play'
  enterRoom()
  music.set('slugboss', 0); sfx('mission'); emitR()
}
function stop() { RG.mode = 'idle'; RG.paused = false; music.set('menu'); emitR() }
function enterRoom() {
  const p = RG.p
  p.x = -AX + 6; p.y = 0; p.inv = 1; if (p.aegis) p.shield = 1
  RG.en = []; RG.eb = []; RG.pb = []; RG.loot = []; RG.open = false; RG.choices = null; RG.swing = null; RG.spawnQ = []
  // obstacles
  RG.obst = []
  const boss = RG.room === 3
  const n = boss ? 2 : 3 + RG.floor + ((Math.random() * 3) | 0)
  for (let i = 0; i < n; i++) {
    const w = 4 + 2 * ((Math.random() * 2) | 0), h = 4 + 2 * ((Math.random() * 2) | 0)
    const x = R(-26, AX - 12), y = R(-AY + 6, AY - 6)
    if (boss && Math.abs(x) < 14 && Math.abs(y) < 14) continue
    if (x + w / 2 > 10 && Math.abs(y) < h / 2 + 6) continue // keep the lane to the door open
    RG.obst.push({ x, y, w, h })
  }
  RG.obst = RG.obst.filter((o) => !(Math.abs(o.x - p.x) < o.w / 2 + 8 && Math.abs(o.y - p.y) < o.h / 2 + 8))
  // enemies
  const budget = 5 + RG.floor * 3 + RG.room * 2
  const sc = 1 + RG.floor * 0.3
  const spawn = (type, x, y, delay) => RG.spawnQ.push({ type, x, y, t: delay, sc })
  if (boss) { spawn(BOSS[RG.floor], AX - 14, 0, 1.2); sfx('rgBoss'); speak(EN[BOSS[RG.floor]].name, 0.4, 0.9) }
  else {
    let b = budget, i = 0
    const pool = ['slime', 'bat', 'archer'].concat(RG.floor >= 1 ? ['brute', 'caster'] : [], RG.room >= 2 ? ['brute'] : [])
    while (b > 0) { const t = pool[(Math.random() * pool.length) | 0], cost = t === 'brute' ? 4 : t === 'caster' ? 3 : t === 'archer' ? 2 : 1.5; b -= cost; spawn(t, R(-8, AX - 6), R(-AY + 4, AY - 4), 0.8 + i * 0.35); i++ }
  }
  RG.msg = { text: boss ? 'BOSS: ' + EN[BOSS[RG.floor]].name : 'FLOOR ' + (RG.floor + 1) + ' · ROOM ' + (RG.room + 1), sub: '', color: boss ? '#ff4a5a' : '#ffe84a', t: 2 }
  sfx('rgDoor')
}
function walkable(x, y, r) {
  if (Math.abs(x) > AX - r || Math.abs(y) > AY - r) return false
  for (const o of RG.obst) if (Math.abs(x - o.x) < o.w / 2 + r && Math.abs(y - o.y) < o.h / 2 + r) return false
  return true
}
function move(o, dx, dy, r) {
  if (walkable(o.x + dx, o.y, r)) o.x += dx
  if (walkable(o.x, o.y + dy, r)) o.y += dy
}
function nearestEnemy(x, y, maxd = 999) {
  let best = null
  for (const e of RG.en) { if (e.dead) continue; const d = Math.hypot(e.x - x, e.y - y); if (d < maxd && (!best || d < best.d)) best = { e, d } }
  return best
}
function hitEnemy(e, d, crit, kb = 0, ax = 0, ay = 0) {
  if (e.dead || e.spawnT > 0) return
  e.hp -= d; e.flash = 0.1
  if (kb && !e.def.boss) { e.kx = ax * kb; e.ky = ay * kb }
  popup(e.x, e.y + e.def.r + 1, String(Math.round(d)), crit ? [1, 0.85, 0.2] : [1, 1, 1])
  if (e.hp <= 0) killEnemy(e)
}
function killEnemy(e) {
  e.dead = true; RG.kills++
  const c = col(e.def.c); for (let i = 0; i < (e.def.boss ? 40 : 10); i++) part(e.x, e.y, R(-34, 34), R(-34, 34), R(0.25, 0.7), c, R(0.8, 1.7))
  sfx('rgKill'); if (e.def.boss) { shake(2); flash(0.5, [1, 1, 1]) }
  const g = e.def.gold; for (let i = 0; i < g; i++) RG.loot.push({ k: 'gold', x: e.x + R(-2, 2), y: e.y + R(-2, 2), vx: R(-12, 12), vy: R(-12, 12), v: 1 })
  if (Math.random() < 0.07 || e.def.boss) RG.loot.push({ k: 'heart', x: e.x, y: e.y, vx: 0, vy: 0, v: 1 })
  if (RG.p.vamp && Math.random() < RG.p.vamp) { RG.p.hp = Math.min(RG.p.max, RG.p.hp + 1); popup(RG.p.x, RG.p.y + 3, '+♥', [1, 0.4, 0.5]) }
  if (e.def.id === 'king' || e.def.name === 'SLIME KING') { /* the king leaves nothing behind but a mess */ }
}
function hurtPlayer(d) {
  const p = RG.p
  if (p.inv > 0 || p.dash > 0 || RG.mode !== 'play') return
  if (p.shield > 0) { p.shield--; p.inv = 0.6; sfx('deflect'); ring(p.x, p.y, 16, 30, [col('#6ac8ff')]); return }
  p.hp -= d; p.inv = 1.0; RG.hurtT = 0.3
  sfx('rgHurt'); shake(1); flash(0.2, [1, 0.2, 0.2])
  for (let i = 0; i < 10; i++) part(p.x, p.y, R(-30, 30), R(-30, 30), 0.4, col('#ff4a5a'), R(0.8, 1.4))
  if (p.hp <= 0) finish(false)
}
function finish(win) {
  RG.mode = 'over'; music.stop()
  const rooms = RG.floor * 4 + RG.room + (win ? 1 : 0)
  const score = RG.floor * 1500 + rooms * 150 + RG.kills * 10 + RG.gold * 2 + (win ? 4000 : 0)
  RG.over = { win, floor: RG.floor + 1, room: RG.room + 1, kills: RG.kills, gold: RG.gold, score, perks: RG.perks.length, cls: CLASSES[RG.cls].name }
  profile.rogueRuns = (profile.rogueRuns || 0) + 1
  if (win) profile.rogueWins = (profile.rogueWins || 0) + 1
  profile.rogueKills = (profile.rogueKills || 0) + RG.kills
  profile.rogueDeep = Math.max(profile.rogueDeep || 0, rooms)
  recordScore('rogue', score); saveProfile()
  sfx(win ? 'win' : 'over'); speak(win ? 'Dungeon conquered' : 'You died', 0.5, 1)
  emitR()
}
function ebullet(x, y, a, spd, dmg = 1, r = 0.9, c = '#ff8a5a') { RG.eb.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, dmg, r, c, life: 6 }) }
function playerAttack(dt) {
  const p = RG.p, cl = CLASSES[RG.cls]
  p.atkT -= dt
  if (p.atkT > 0) return
  // direction: the pointer if it moved recently, otherwise the nearest enemy
  const ne = nearestEnemy(p.x, p.y, cl.id === 'knight' ? 11 : 60)
  if (!ne) return
  let a = Math.atan2(ne.e.y - p.y, ne.e.x - p.x)
  if (RG.aimPt && G.time - RG.aimT < 2) a = Math.atan2(RG.aimPt.y - p.y, RG.aimPt.x - p.x)
  p.face = a; p.atkT = p.rate
  const crit = Math.random() < p.crit, d = p.dmg * (crit ? 2.2 : 1)
  if (cl.id === 'knight') {
    const arc = 1.3 + (p.multi - 1) * 0.45, reach = 8 + (p.multi - 1) * 0.8
    RG.swing = { a, arc, reach, t: 0.18 }
    for (const e of RG.en) {
      if (e.dead) continue
      const dx = e.x - p.x, dy = e.y - p.y, dist = Math.hypot(dx, dy)
      if (dist > reach + e.def.r) continue
      let da = Math.atan2(dy, dx) - a; da = Math.atan2(Math.sin(da), Math.cos(da))
      if (Math.abs(da) <= arc / 2) hitEnemy(e, d, crit, 40 + p.pierce * 25, dx / (dist || 1), dy / (dist || 1))
    }
    for (const b of RG.eb) { if (Math.hypot(b.x - p.x, b.y - p.y) < reach) b.life = 0 }
    sfx('rgSwing')
  } else {
    const n = p.multi, spread = 0.2
    for (let i = 0; i < n; i++) {
      const aa = a + (i - (n - 1) / 2) * spread
      RG.pb.push({ x: p.x + Math.cos(aa) * 2, y: p.y + Math.sin(aa) * 2, vx: Math.cos(aa) * (cl.id === 'ranger' ? 95 : 55), vy: Math.sin(aa) * (cl.id === 'ranger' ? 95 : 55), dmg: d, crit, pierce: cl.id === 'ranger' ? 1 + p.pierce : p.pierce, homing: cl.id === 'mage', life: 1.4, c: cl.color, hit: new Set(), big: cl.id === 'mage' })
    }
    sfx(cl.id === 'ranger' ? 'rgShot' : 'rgMagic')
  }
}
function special() {
  const p = RG.p, cl = CLASSES[RG.cls]
  if (RG.mode !== 'play' || p.spT > 0) return
  p.spT = p.spCd
  if (cl.id === 'knight') { RG.fx.push({ k: 'whirl', l: 0.5 }); for (const e of RG.en) if (!e.dead && Math.hypot(e.x - p.x, e.y - p.y) < 13) hitEnemy(e, p.dmg * 3, false, 90, (e.x - p.x) / 5, (e.y - p.y) / 5); p.inv = Math.max(p.inv, 0.5); shake(0.8); sfx('rgBoss') }
  else if (cl.id === 'ranger') { for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; RG.pb.push({ x: p.x, y: p.y, vx: Math.cos(a) * 85, vy: Math.sin(a) * 85, dmg: p.dmg * 1.6, pierce: 3, life: 1.2, c: cl.color, hit: new Set() }) } sfx('rgShot') }
  else { RG.fx.push({ k: 'nova', l: 0.6 }); for (const e of RG.en) if (!e.dead && Math.hypot(e.x - p.x, e.y - p.y) < 20) { hitEnemy(e, p.dmg * 2, false); e.frozen = 2.5 } RG.eb = RG.eb.filter((b) => Math.hypot(b.x - p.x, b.y - p.y) > 20); shake(0.6); sfx('tdIce') }
  ring(p.x, p.y, 30, 50, [col(cl.color)])
}
function dash() {
  const p = RG.p
  if (RG.mode !== 'play' || p.dashT > 0) return
  let dx = p.mx || 0, dy = p.my || 0
  if (!dx && !dy) { dx = Math.cos(p.face); dy = Math.sin(p.face) }
  const l = Math.hypot(dx, dy) || 1
  p.dx = dx / l; p.dy = dy / l; p.dash = 0.18; p.dashT = p.dashCd; p.inv = Math.max(p.inv, 0.3)
  sfx('rgDash')
}
function enemyAI(e, dt) {
  const p = RG.p, d = e.def, dx = p.x - e.x, dy = p.y - e.y, dist = Math.hypot(dx, dy) || 1
  const slow = e.frozen > 0 ? 0.25 : 1
  e.t += dt; e.frozen = Math.max(0, (e.frozen || 0) - dt)
  let vx = 0, vy = 0
  if (d.boss) return boss(e, dt, dx, dy, dist, slow)
  if (e.type === 'slime') { vx = dx / dist; vy = dy / dist; const hop = 0.5 + 0.5 * Math.sin(e.t * 4); vx *= hop * 1.6; vy *= hop * 1.6 }
  else if (e.type === 'bat') { const w = Math.sin(e.t * 6 + e.seed) * 0.9; vx = dx / dist + (-dy / dist) * w; vy = dy / dist + (dx / dist) * w }
  else if (e.type === 'archer' || e.type === 'caster') {
    const want = e.type === 'archer' ? 22 : 26
    if (dist < want - 4) { vx = -dx / dist; vy = -dy / dist } else if (dist > want + 6) { vx = dx / dist; vy = dy / dist } else { vx = -dy / dist * e.dir; vy = dx / dist * e.dir }
    e.shoot -= dt
    if (e.shoot <= 0) {
      e.shoot = d.shoot * R(0.8, 1.2)
      const a = Math.atan2(dy, dx)
      if (e.type === 'archer') ebullet(e.x, e.y, a, 34)
      else for (let i = -1; i <= 1; i++) ebullet(e.x, e.y, a + i * 0.28, 28, 1, 1, '#4ad8ff')
      sfx('tdShot')
    }
    if (e.type === 'caster') { e.tp -= dt; if (e.tp <= 0) { e.tp = 3.5; const a = R(0, 6.28); const nx = clamp(p.x + Math.cos(a) * 18, -AX + 3, AX - 3), ny = clamp(p.y + Math.sin(a) * 14, -AY + 3, AY - 3); if (walkable(nx, ny, 1.4)) { ring(e.x, e.y, 10, 24, [col(d.c)]); e.x = nx; e.y = ny; ring(e.x, e.y, 10, 24, [col(d.c)]) } } }
  } else if (e.type === 'brute') {
    if (e.charge > 0) { e.charge -= dt; vx = e.cdx * 5.2; vy = e.cdy * 5.2; if (e.charge <= 0) e.rest = 0.6 }
    else if (e.wind > 0) { e.wind -= dt; if (e.wind <= 0) { e.charge = 0.6; e.cdx = dx / dist; e.cdy = dy / dist; sfx('rgSwing') } }
    else if (e.rest > 0) e.rest -= dt
    else { vx = dx / dist; vy = dy / dist; e.cd -= dt; if (e.cd <= 0 && dist < 36) { e.cd = 3; e.wind = 0.6 } }
  }
  const sp = d.spd * slow
  move(e, vx * sp * dt + (e.kx || 0) * dt, vy * sp * dt + (e.ky || 0) * dt, d.r * 0.8)
  e.kx = (e.kx || 0) * 0.86; e.ky = (e.ky || 0) * 0.86
  if (dist < d.r + 1.3) hurtPlayer(d.dmg)
}
function boss(e, dt, dx, dy, dist, slow) {
  const d = e.def, a = Math.atan2(dy, dx), hpf = e.hp / e.max
  if (e.type === 'king') {
    e.cd -= dt
    if (e.jump > 0) { e.jump -= dt; move(e, e.jx * 38 * dt, e.jy * 38 * dt, 3.5); if (e.jump <= 0) { ring(e.x, e.y, 24, 40, [col(d.c)]); shake(1); for (let i = 0; i < 2; i++) RG.spawnQ.push({ type: 'slime', x: e.x + R(-5, 5), y: e.y + R(-5, 5), t: 0.3, sc: 1 + RG.floor * 0.3 }); if (hpf < 0.5) for (let i = 0; i < 12; i++) ebullet(e.x, e.y, (i / 12) * 6.28 + e.t, 28, 1, 1, '#7aff9a') } }
    else if (e.cd <= 0) { e.cd = hpf < 0.5 ? 2.2 : 3.2; e.jump = 0.45; e.jx = dx / dist; e.jy = dy / dist; sfx('rgSwing') }
    else move(e, dx / dist * d.spd * slow * dt, dy / dist * d.spd * slow * dt, 3.5)
  } else if (e.type === 'lord') {
    e.sp += dt * (hpf < 0.5 ? 2.2 : 1.5)
    e.cd -= dt
    if (e.cd <= 0) { e.cd = hpf < 0.5 ? 0.18 : 0.28; for (let k = 0; k < (hpf < 0.5 ? 4 : 3); k++) ebullet(e.x, e.y, e.sp + (k * 6.28) / (hpf < 0.5 ? 4 : 3), 26, 1, 0.9, '#d8d8ff'); sfx('tdShot') }
    e.sum -= dt; if (e.sum <= 0) { e.sum = 7; for (let i = 0; i < 2; i++) RG.spawnQ.push({ type: 'bat', x: e.x + R(-6, 6), y: e.y + R(-6, 6), t: 0.4, sc: 1 + RG.floor * 0.3 }) }
    move(e, Math.cos(e.t * 0.5) * 8 * dt, Math.sin(e.t * 0.7) * 8 * dt, 3.6)
  } else {
    e.cd -= dt; e.tp -= dt
    if (e.tp <= 0) { e.tp = 5; ring(e.x, e.y, 20, 40, [col(d.c)]); const nx = R(-AX + 8, AX - 8), ny = R(-AY + 8, AY - 8); if (walkable(nx, ny, 4)) { e.x = nx; e.y = ny } ring(e.x, e.y, 20, 40, [col(d.c)]); sfx('tdZap') }
    if (e.cd <= 0) {
      e.cd = hpf < 0.5 ? 1.2 : 1.9; e.n = (e.n || 0) + 1
      if (e.n % 2) for (let i = -2; i <= 2; i++) ebullet(e.x, e.y, a + i * 0.2, 36, 1, 1, '#ff4adf')
      else for (let i = 0; i < (hpf < 0.5 ? 20 : 14); i++) ebullet(e.x, e.y, (i / (hpf < 0.5 ? 20 : 14)) * 6.28 + e.t, 24, 1, 1, '#ff8aff')
      sfx('rgMagic')
    }
  }
  if (dist < d.r + 1.3) hurtPlayer(d.dmg)
}
function update(dtRaw) {
  const dt = Math.min(dtRaw, 0.04)
  if (RG.mode === 'idle' || RG.paused) return
  if (RG.mode === 'over') { stepParticles(dt); return }
  RG.t += dt
  if (RG.msg) { RG.msg.t -= dt; if (RG.msg.t <= 0) RG.msg = null }
  RG.hurtT = Math.max(0, RG.hurtT - dt)
  if (RG.mode === 'perk') { stepParticles(dt); RG.emitT -= dt; if (RG.emitT <= 0) { RG.emitT = 0.1; emitR() } return }
  const p = RG.p
  p.inv = Math.max(0, p.inv - dt); p.dashT = Math.max(0, p.dashT - dt); p.spT = Math.max(0, p.spT - dt)
  // movement
  let mx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + RG.stick[0]
  let my = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) + RG.stick[1]
  const ml = Math.hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml }
  p.mx = mx; p.my = my
  if (p.dash > 0) { p.dash -= dt; move(p, p.dx * 95 * dt, p.dy * 95 * dt, 1.4); part(p.x, p.y, 0, 0, 0.25, col(CLASSES[RG.cls].color), 1.2) }
  else { move(p, mx * p.spd * dt, my * p.spd * dt, 1.4); if (mx || my) p.face = Math.atan2(my, mx) }
  playerAttack(dt)
  if (keys.KeyQ || keys.KeyK) special()
  // spawn queue
  for (const s of RG.spawnQ) s.t -= dt
  for (const s of RG.spawnQ) if (s.t <= 0 && !s.done) {
    s.done = true
    const def = { ...EN[s.type], id: s.type }
    const hp = def.hp * s.sc * (def.boss ? 1 : 1)
    RG.en.push({ type: s.type, def, x: s.x, y: s.y, hp, max: hp, t: 0, seed: R(0, 6), dir: Math.random() < 0.5 ? -1 : 1, shoot: R(0.8, 1.8), tp: R(1, 3), cd: 2, wind: 0, charge: 0, rest: 0, sp: 0, sum: 4, spawnT: 0.5, flash: 0 })
    ring(s.x, s.y, 8, 16, [col(def.c)])
  }
  RG.spawnQ = RG.spawnQ.filter((s) => !s.done)
  // enemies
  for (const e of RG.en) {
    if (e.dead) continue
    e.flash = Math.max(0, e.flash - dt)
    if (e.spawnT > 0) { e.spawnT -= dt; continue }
    enemyAI(e, dt)
  }
  RG.en = RG.en.filter((e) => !e.dead)
  // player bullets
  for (const b of RG.pb) {
    b.life -= dt
    if (b.homing) { const t = nearestEnemy(b.x, b.y, 40); if (t) { const a = Math.atan2(t.e.y - b.y, t.e.x - b.x), sp = Math.hypot(b.vx, b.vy), ca = Math.atan2(b.vy, b.vx); let da = a - ca; da = Math.atan2(Math.sin(da), Math.cos(da)); const na = ca + clamp(da, -4 * dt, 4 * dt); b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp } }
    b.x += b.vx * dt; b.y += b.vy * dt
    if (!walkable(b.x, b.y, 0.1)) { b.life = 0; continue }
    for (const e of RG.en) {
      if (e.dead || e.spawnT > 0 || b.hit.has(e)) continue
      if (Math.hypot(e.x - b.x, e.y - b.y) < e.def.r + 0.8) { b.hit.add(e); hitEnemy(e, b.dmg, b.crit, b.big ? 15 : 0, Math.sign(b.vx), Math.sign(b.vy)); if (b.big) { RG.fx.push({ k: 'pop', x: b.x, y: b.y, l: 0.2 }) } if (b.hit.size > b.pierce) { b.life = 0; break } }
    }
  }
  RG.pb = RG.pb.filter((b) => b.life > 0)
  for (const b of RG.eb) {
    b.life -= dt; b.x += b.vx * dt; b.y += b.vy * dt
    if (Math.abs(b.x) > AX || Math.abs(b.y) > AY) b.life = 0
    else if (Math.hypot(b.x - p.x, b.y - p.y) < b.r + 1.0) { b.life = 0; hurtPlayer(b.dmg) }
    else for (const o of RG.obst) if (Math.abs(b.x - o.x) < o.w / 2 && Math.abs(b.y - o.y) < o.h / 2) { b.life = 0; break }
  }
  RG.eb = RG.eb.filter((b) => b.life > 0)
  // loot
  for (const l of RG.loot) {
    l.x += l.vx * dt; l.y += l.vy * dt; l.vx *= 0.9; l.vy *= 0.9
    const d = Math.hypot(p.x - l.x, p.y - l.y)
    if (d < p.magnet && l.k === 'gold') { l.x += ((p.x - l.x) / d) * 50 * dt; l.y += ((p.y - l.y) / d) * 50 * dt }
    if (d < 2.4) { l.got = true; if (l.k === 'gold') { RG.gold++; sfx('coin') } else { p.hp = Math.min(p.max, p.hp + 1); popup(p.x, p.y + 3, '+♥', [1, 0.4, 0.5]); sfx('rgPerk') } }
  }
  RG.loot = RG.loot.filter((l) => !l.got)
  for (const f of RG.fx) f.l -= dt
  RG.fx = RG.fx.filter((f) => f.l > 0)
  if (RG.swing) { RG.swing.t -= dt; if (RG.swing.t <= 0) RG.swing = null }
  // room clear
  if (!RG.open && !RG.en.length && !RG.spawnQ.length) {
    RG.open = true
    for (const l of RG.loot) l.vx = l.vy = 0
    RG.msg = { text: 'ROOM CLEARED', sub: RG.room === 3 ? 'FLOOR CLEARED' : 'GO RIGHT ▶', color: '#6aff9a', t: 1.6 }
    sfx('rgDoor'); sfx('ding', 5)
    if (RG.room === 3 && RG.floor === RG.floors - 1) return finish(true)
    offerPerks()
  }
  if (RG.open && RG.mode === 'play' && p.x > AX - 3 && Math.abs(p.y) < 7) {
    if (RG.room === 3) { RG.floor++; RG.room = 0; RG.p.hp = Math.min(RG.p.max, RG.p.hp + 2) } else RG.room++
    enterRoom()
  }
  stepParticles(dt)
  RG.emitT -= dt
  if (RG.emitT <= 0) { RG.emitT = 0.1; emitR() }
}
function offerPerks() {
  const have = new Set()
  const pool = PERKS.filter((x) => !(x.id === 'shield' && RG.p.aegis)).sort(() => Math.random() - 0.5)
  RG.choices = pool.slice(0, 3); RG.mode = 'perk'
  void have; sfx('rgPerk'); emitR()
}
function pickPerk(i) {
  if (RG.mode !== 'perk' || !RG.choices || !RG.choices[i]) return
  const c = RG.choices[i]; c.f(RG.p); RG.perks.push(c.ico)
  RG.choices = null; RG.mode = 'play'; sfx('rgPerk')
  RG.msg = { text: c.name, sub: c.desc, color: '#ffe84a', t: 1.6 }
  ring(RG.p.x, RG.p.y, 24, 40, [col('#ffe84a')])
  emitR()
}
function onKey(code) {
  if (RG.mode === 'idle') return
  if (code === 'Escape' || code === 'KeyP') { if (RG.mode === 'play') { RG.paused = !RG.paused; emitR() } else if (RG.paused) { RG.paused = false; emitR() } return }
  if (RG.paused) return
  if (RG.mode === 'perk') { const n = ['Digit1', 'Digit2', 'Digit3'].indexOf(code); if (n >= 0) pickPerk(n); return }
  if (RG.mode === 'over') { if (code === 'Enter') rogueActions.rematch(); return }
  if (code === 'Space' || code === 'ShiftLeft' || code === 'ShiftRight') dash()
  else if (code === 'KeyQ' || code === 'KeyK') special()
}
export const rogueActions = {
  start, stop, quit() { toMenu() },
  resume() { RG.paused = false; emitR() },
  pause() { if (RG.mode === 'play' && !RG.paused) { RG.paused = true; emitR(); return true } return false },
  rematch() { start({ cls: RG.cls, floors: RG.floors }) },
  pick: pickPerk, dash, special,
  stick(x, y) { RG.stick = [x, y] },
  aim(x, y) { RG.aimPt = { x, y }; RG.aimT = G.time },
}
function draw(api) {
  const { put } = api, p = RG.p
  rect(put, -AX - 2, -AY - 2, AX + 2, AY + 2, col('#050912'), 1, -3.4, 1.6)
  for (let x = -AX; x <= AX; x += 4) for (let y = -AY; y <= AY; y += 4) if (((x + y) / 4) % 2 === 0) put(x, y, -3, 4, 4, 0.05, 0.075, 0.15)
  // walls and door
  for (let x = -AX - 2; x <= AX + 2; x += 1) { put(x, AY + 1.5, -1, 1.1, 1.1, 0.22, 0.2, 0.5); put(x, -AY - 1.5, -1, 1.1, 1.1, 0.22, 0.2, 0.5) }
  for (let y = -AY; y <= AY; y += 1) { put(-AX - 1.5, y, -1, 1.1, 1.1, 0.22, 0.2, 0.5); const door = Math.abs(y) < 7; if (door) { if (RG.open) put(AX + 1.5, y, -1, 1.1, 1.1, 0.4 + Math.sin(G.time * 6) * 0.3, 2, 0.8); else put(AX + 1.5, y, -1, 1.1, 1.1, 1.6, 0.2, 0.2) } else put(AX + 1.5, y, -1, 1.1, 1.1, 0.22, 0.2, 0.5) }
  for (const o of RG.obst) { rect(put, o.x - o.w / 2 + 0.5, o.y - o.h / 2 + 0.5, o.x + o.w / 2 - 0.5, o.y + o.h / 2 - 0.5, col('#3a4468'), 1, -1.2, 1); rect(put, o.x - o.w / 2 + 0.5, o.y + o.h / 2 - 1, o.x + o.w / 2 - 0.5, o.y + o.h / 2 - 0.5, col('#7a86b8'), 1, -1, 1) }
  // spawn telegraphs
  for (const s of RG.spawnQ) { const c = col(EN[s.type].c); circle(put, s.x, s.y, 2 + Math.sin(G.time * 12) * 0.6, c, 1.6, 0, 0.6) }
  for (const l of RG.loot) { if (l.k === 'gold') disk(put, l.x, l.y, 0.8, col('#ffd23a'), 1.7, 0.2, 0.4); else { disk(put, l.x - 0.6, l.y + 0.3, 0.7, col('#ff4a6a'), 1.6, 0.2, 0.35); disk(put, l.x + 0.6, l.y + 0.3, 0.7, col('#ff4a6a'), 1.6, 0.2, 0.35); disk(put, l.x, l.y - 0.4, 0.8, col('#ff4a6a'), 1.6, 0.2, 0.35) } }
  for (const e of RG.en) {
    const c = col(e.def.c), f = e.flash > 0 ? 2.2 : 1, r = e.def.r
    if (e.spawnT > 0) { circle(put, e.x, e.y, r * (1 - e.spawnT), c, 1.6, 0, 0.5); continue }
    disk(put, e.x + 0.4, e.y - 0.4, r, col('#000000'), 0, -1.3, 0.5)
    const bob = e.type === 'slime' ? Math.sin(e.t * 8) * 0.25 : 0
    disk(put, e.x, e.y, r * (1 + bob * 0.3), c, (e.frozen > 0 ? 0.5 : 0.9) * f, 0, r > 3 ? 0.55 : 0.4)
    if (e.type === 'brute' && e.wind > 0) circle(put, e.x, e.y, r + 1, col('#ff4a4a'), 2, 0.4, 0.5)
    if (e.def.boss) circle(put, e.x, e.y, r + 0.7, col('#ffe84a'), 1.3, 0.3, 0.6)
    const ex = Math.sign(RG.p.x - e.x) * 0.4
    put(e.x - r * 0.35 + ex, e.y + r * 0.2, 0.6, 0.55, 0.55, 2, 2, 2); put(e.x + r * 0.35 + ex, e.y + r * 0.2, 0.6, 0.55, 0.55, 2, 2, 2)
    if (e.frozen > 0) circle(put, e.x, e.y, r + 0.4, col('#9ad8ff'), 1.8, 0.4, 0.5)
    if (!e.def.boss && e.hp < e.max) for (let u = 0; u < r * 2; u += 0.5) put(e.x - r + u, e.y + r + 1, 0.8, 0.5, 0.5, u / (r * 2) < e.hp / e.max ? 0.3 : 0.5, u / (r * 2) < e.hp / e.max ? 1.8 : 0.1, 0.3)
  }
  for (const b of RG.pb) { const c = col(b.c); disk(put, b.x, b.y, b.big ? 1.1 : 0.55, c, 2, 0.6, 0.35) }
  for (const b of RG.eb) { const c = col(b.c); disk(put, b.x, b.y, b.r, c, 1.8, 0.6, 0.35) }
  if (p && RG.mode !== 'over') {
    const cl = CLASSES[RG.cls], c = col(cl.color), blink = p.inv > 0 && Math.floor(G.time * 20) % 2 === 0
    disk(put, p.x + 0.4, p.y - 0.4, 1.5, col('#000000'), 0, -1.3, 0.5)
    if (!blink) {
      disk(put, p.x, p.y, 1.5, c, p.dash > 0 ? 1.8 : 1, 0, 0.4)
      put(p.x + Math.cos(p.face) * 0.5 - 0.5, p.y + 0.4, 0.6, 0.45, 0.45, 0.1, 0.1, 0.2); put(p.x + Math.cos(p.face) * 0.5 + 0.5, p.y + 0.4, 0.6, 0.45, 0.45, 0.1, 0.1, 0.2)
      const wl = cl.id === 'knight' ? 2.8 : 2.2
      for (let u = 1.6; u < 1.6 + wl; u += 0.5) put(p.x + Math.cos(p.face) * u, p.y + Math.sin(p.face) * u, 0.4, 0.55, 0.55, 1.8, 1.8, 1.8)
    }
    if (p.shield > 0) circle(put, p.x, p.y, 2.6, col('#6ac8ff'), 1.8, 0.5, 0.5)
  }
  if (RG.swing) { const s = RG.swing; for (let k = 0; k <= 14; k++) { const a = s.a - s.arc / 2 + (s.arc * k) / 14; for (let u = 3; u <= s.reach; u += 1.2) put(p.x + Math.cos(a) * u, p.y + Math.sin(a) * u, 0.7, 0.9, 0.9, 1.8 * (u / s.reach), 1.7 * (u / s.reach), 0.9 * (u / s.reach)) } }
  for (const f of RG.fx) {
    if (f.k === 'whirl') circle(put, p.x, p.y, 13 * (1 - f.l / 0.5) + 2, col('#ffd23a'), 2, 0.8, 0.7)
    else if (f.k === 'nova') circle(put, p.x, p.y, 20 * (1 - f.l / 0.6) + 2, col('#9ad8ff'), 2, 0.8, 0.7)
  }
  for (const q of G.parts) { const f = q.life / q.max; put(q.x, q.y, 1, q.s * (0.35 + 0.65 * f) * 0.9, q.s * (0.35 + 0.65 * f) * 0.9, q.c[0] * 1.8, q.c[1] * 1.8, q.c[2] * 1.8) }
  api.pops(G.pops, 0)
  void line
}
if (typeof window !== 'undefined') { window.__RG = RG; window.__rogue = rogueActions }
games.rogue = { update, onKey, draw, stop, sky: () => '#05070f' }
