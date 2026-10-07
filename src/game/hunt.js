// 13 DAYS OF HELL + WATCH YOUR BACK: a top-down horror survival hunt in the dark.
// You are a hunter with a rifle and a flashlight. Things only show in the beam; STALKERS creep up behind you and hit twice as
// hard from behind (but freeze when you look at them). "13 Days" = survive 13 nights with a shop at every dawn and a boss on night
// 13; "Watch Your Back" = one endless night where everything comes from behind. 1-3 hunters online (the host runs the world).
import { G, emit as engineEmit, keys, games, profile, saveProfile, recordScore, toMenu, shake, flash, stepParticles } from './engine.js'
import { sfx, music } from './audio.js'
import { clamp, rng } from './pxl.js'
import { unprojectGround } from './rogue3d.js'
import { registerNet, gameEnded } from './online/gnet.js'

export const AW = 4600, AH = 2700, DAYS = 13 // 20x the old map, generated chunk by chunk
export const CH = 48
const TAU = Math.PI * 2
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d }
export const MONS = {
  crawler: { name: 'CRAWLER', hp: 30, spd: 12, dmg: 8, r: 1.3, cost: 1, scrap: 2 },
  wraith: { name: 'WRAITH', hp: 38, spd: 10, dmg: 14, r: 1.4, cost: 3, scrap: 5 },
  howler: { name: 'HOWLER', hp: 80, spd: 6.5, dmg: 12, r: 1.8, cost: 4, scrap: 8 },
  stalker: { name: 'STALKER', hp: 48, spd: 9, dmg: 16, r: 1.5, cost: 2, scrap: 4 },
  spitter: { name: 'SPITTER', hp: 42, spd: 7, dmg: 9, r: 1.5, cost: 3, scrap: 5 },
  brute: { name: 'BRUTE', hp: 240, spd: 5.4, dmg: 30, r: 2.6, cost: 6, scrap: 14 },
  king: { name: 'THE HOLLOW KING', hp: 2400, spd: 6.6, dmg: 40, r: 4.2, cost: 0, scrap: 120 },
}
export const WEAPONS = { rifle: { name: 'RIFLE', mag: 12, cd: 0.3, dmg: 24, pellets: 1, spread: 0.05, life: 0.9, snd: 'pistol' }, shotgun: { name: 'SHOTGUN', mag: 6, cd: 0.85, dmg: 11, pellets: 6, spread: 0.3, life: 0.3, snd: 'shotgun' }, smg: { name: 'SMG', mag: 30, cd: 0.085, dmg: 10, pellets: 1, spread: 0.1, life: 0.6, snd: 'hmg' } }
const WLIST = ['rifle', 'shotgun', 'smg']
export const SHOP = [
  { k: 'ammo', name: 'AMMO PACK', icon: '🔫', desc: '+36 rounds', base: 30, max: 99 },
  { k: 'medkit', name: 'MEDKIT', icon: '🩹', desc: 'Heal 60', base: 40, max: 99 },
  { k: 'dmg', name: 'DAMAGE', icon: '💥', desc: '+20% bullet damage', base: 60, max: 5 },
  { k: 'rate', name: 'FIRE RATE', icon: '⚡', desc: '+15% fire rate', base: 60, max: 5 },
  { k: 'hp', name: 'TOUGHNESS', icon: '❤', desc: '+25 max health', base: 50, max: 5 },
  { k: 'light', name: 'FLASHLIGHT', icon: '🔦', desc: 'Longer, wider beam', base: 40, max: 4 },
  { k: 'speed', name: 'BOOTS', icon: '👟', desc: '+8% move speed', base: 45, max: 4 },
  { k: 'shotgun', name: 'SHOTGUN', icon: '💢', desc: 'Key 2 · 6 pellets, brutal up close', base: 120, max: 1 },
  { k: 'smg', name: 'SMG', icon: '🔥', desc: 'Key 3 · rapid fire', base: 150, max: 1 },
  { k: 'mines', name: 'LANDMINES x2', icon: '💣', desc: 'Press F to plant', base: 50, max: 99 },
]
const COLORS = ['#ff8a2a', '#3de8ff', '#b07aff']

export const HT = { mode: 'idle', paused: false, kind: 'days', phase: 'dawn', day: 1, t: 0, phaseT: 0, nightLen: 60, players: [], me: 0, mons: [], bul: [], spit: [], pick: [], mines: [], obst: [], fx: [], id: 1, score: 0, kills: 0, spawnQ: [], over: null, msg: null, net: null, emitT: 0, ready: {}, mouse: { x: 0, y: 1, down: false }, bossSpawned: false, netT: 0 }
let snap = null
const subs = new Set()
export const subscribeHunt = (f) => { subs.add(f); return () => subs.delete(f) }
export const getHuntSnap = () => snap

function mkPlayer(i, name) {
  return { i, name: name || 'HUNTER ' + (i + 1), x: -6 + i * 6, y: -8, hp: 100, max: 100, a: Math.PI / 2, mag: 12, reserve: 60, reload: 0, fireCd: 0, dashT: 0, dashCd: 0, mines: 2, scrap: 40, kills: 0, down: false, reviveT: 0, hit: 0, up: { dmg: 0, rate: 0, hp: 0, light: 0, speed: 0, shotgun: 0, smg: 0 }, wp: 'rifle', mags: { rifle: 12, shotgun: 0, smg: 0 }, in: { dx: 0, dy: 0, a: Math.PI / 2, fire: false }, color: COLORS[i % 3], walk: 0, kick: 0, flash: 0 }
}
// The world is made of 48x48 chunks that are generated the first time anybody gets near them. Everything is a pure function of
// the seed and the chunk coordinates, so every online player builds exactly the same forest.
const h3 = (a, b, c) => { let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2246822519); h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0 }
function genChunk(cx, cy) {
  const obs = [], decor = []
  const r = rng(h3(cx, cy, HT.seed))
  const x0 = cx * CH, y0 = cy * CH
  const ok = (x, y, rr) => Math.hypot(x, y) > 16 && !obs.some((o) => Math.hypot(o.x - x, o.y - y) < o.r + rr + 2)
  const add = (o) => { o.key = cx + ',' + cy + ',' + obs.length; if (HT.deadSet.has(o.key)) o.dead = true; obs.push(o); HT.byKey.set(o.key, o) }
  if (cx === 0 && cy === 0) { add({ x: 0, y: 0, r: 7.5, cabin: true }); decor.push({ x: 10, y: -10, fire: true }) }
  if (cx === -2 && cy === 0) for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) add({ x: -90 + i * 6, y: 10 + j * 6, r: 1.1, tomb: true })
  if (cx === 2 && cy === -1) add({ x: 100, y: -30, r: 3.2, car: true })
  // an outpost (campfire, crates, a ruined watchtower) in roughly one chunk in seven
  if (Math.abs(cx) + Math.abs(cy) > 1 && r() < 0.14) {
    const ox = x0 + 12 + r() * (CH - 24), oy = y0 + 12 + r() * (CH - 24)
    decor.push({ x: ox, y: oy, fire: true })
    for (let k = 0; k < 4; k++) add({ x: ox + Math.cos(k * 1.57 + 0.6) * 7, y: oy + Math.sin(k * 1.57 + 0.6) * 7, r: 1.6, crate: true, hp: 40 })
    add({ x: ox + 14, y: oy + 6, r: 2.4, tower: true })
  }
  const trees = 12 + ((r() * 8) | 0)
  for (let i = 0; i < trees; i++) {
    const x = x0 + r() * CH, y = y0 + r() * CH, rock = r() < 0.28, rr = rock ? 1.8 : r() < 0.7 ? 1.6 : 2.4
    if (!ok(x, y, rr)) continue
    add({ x, y, r: rr, rock, h: 0.8 + r() * 0.9 })
  }
  const crates = r() < 0.7 ? 1 + ((r() * 2) | 0) : 0
  for (let i = 0; i < crates; i++) { const x = x0 + r() * CH, y = y0 + r() * CH; if (ok(x, y, 1.6)) add({ x, y, r: 1.6, crate: true, hp: 40 }) }
  return { obs, decor }
}
const chunk = (cx, cy) => {
  const k = cx + ',' + cy
  let c = HT.chunks.get(k)
  if (!c) { if (HT.chunks.size > 900) { HT.chunks.clear(); HT.byKey.clear() } c = genChunk(cx, cy); HT.chunks.set(k, c) }
  return c
}
// every obstacle in the chunks within reach of (x, y)
function near3(x, y, reach = 1) { const out = [], ci = Math.floor(x / CH), cj = Math.floor(y / CH); for (let i = ci - reach; i <= ci + reach; i++) for (let j = cj - reach; j <= cj + reach; j++) out.push(...chunk(i, j).obs); return out }
export const worldNear = near3
function viewChunks(x, y, hw, hh) { const out = []; for (let i = Math.floor((x - hw) / CH); i <= Math.floor((x + hw) / CH); i++) for (let j = Math.floor((y - hh) / CH); j <= Math.floor((y + hh) / CH); j++) out.push(chunk(i, j)); return out }
function buildWorld(seed) { HT.seed = seed; HT.chunks = new Map(); HT.byKey = new Map(); HT.deadSet = new Set(); HT.deadKeys = [] }

function start(o = {}) {
  HT.kind = o.kind === 'back' ? 'back' : 'days'
  const seed = o.seed || ((Math.random() * 1e9) | 0)
  HT.rnd = rng(seed)
  buildWorld(seed)
  const n = o.net ? o.net.players.length : 1
  HT.players = Array.from({ length: n }, (_, i) => mkPlayer(i, o.net ? o.net.players[i].name : (profile.name || 'HUNTER')))
  HT.me = o.net ? o.net.me : 0
  HT.day = 1; HT.t = 0; HT.phaseT = 0; HT.mons = []; HT.bul = []; HT.spit = []; HT.pick = []; HT.mines = []; HT.fx = []; HT.id = 1; HT.score = 0; HT.kills = 0; HT.over = null; HT.paused = false; HT.ready = {}; HT.bossSpawned = false; HT.spawnQ = []; HT.net = o.net || null; HT.boss = null
  HT.msg = null; HT.mouse.sx = undefined; CAMP.x = 0; CAMP.y = 0
  G.mode = 'hunt'; engineEmit(); G.parts = []; G.pops = []; HT.mode = 'play'
  music.set('boss', 0); sfx('mission')
  if (HT.kind === 'back') startNight(); else { HT.phase = 'dawn'; HT.phaseT = 0; HT.msg = { text: 'DAY 1', sub: 'Get ready. The sun is going down.', t: 3 } }
  emitH()
}
function stop() { if (HT.net) { gameEnded('hunt'); HT.net = null } HT.mode = 'idle'; HT.paused = false; music.set('menu'); emitH() }
const fx = (x, y, n, c, sp = 12, life = 0.5, s = 0.5, up = 4) => { for (let i = 0; i < n && HT.fx.length < 260; i++) { const a = Math.random() * TAU, v = Math.random() * sp; HT.fx.push({ x, y, h: 1.5, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vh: Math.random() * up, life, max: life, c, s: s * (0.6 + Math.random() * 0.8) }) } }

// ---------- nights ----------
function startNight() {
  HT.phase = 'night'; HT.phaseT = 0
  const d = HT.kind === 'back' ? 6 : HT.day
  HT.nightLen = HT.kind === 'back' ? 9999 : 45 + d * 2.5
  const budget = Math.round((6 + d * 4.2) * (1 + 0.45 * (HT.players.length - 1)))
  const types = ['crawler']
  if (d >= 2 || HT.kind === 'back') types.push('stalker')
  if (d >= 3) types.push('wraith')
  if (d >= 4) types.push('spitter')
  if (d >= 5) types.push('howler')
  if (d >= 6) types.push('brute')
  const q = []
  let spent = 0
  while (spent < budget) {
    const t = types[(HT.rnd() * types.length) | 0]
    if (t === 'brute' && HT.rnd() < 0.55) continue
    q.push({ t: HT.rnd() * HT.nightLen * 0.78, type: t }); spent += MONS[t].cost
  }
  if (HT.kind === 'days' && HT.day === DAYS) q.push({ t: 4, type: 'king' })
  HT.spawnQ = HT.kind === 'back' ? [] : q.sort((a, b) => a.t - b.t)
  HT.rate = 6
  HT.msg = { text: HT.kind === 'back' ? 'WATCH YOUR BACK' : HT.day === DAYS ? 'NIGHT 13: THE HOLLOW KING' : 'NIGHT ' + HT.day, sub: HT.kind === 'back' ? 'Everything comes from behind.' : 'Survive until dawn.', t: 3 }
  sfx('rgOwl'); flash(0.3, [0, 0, 0])
}
function spawnMon(type) {
  const alive = HT.players.filter((p) => !p.down)
  if (!alive.length) return
  const tgt = alive[(HT.rnd() * alive.length) | 0]
  const D = MONS[type]
  let x, y
  const behind = type === 'stalker' || HT.kind === 'back' ? HT.rnd() < (HT.kind === 'back' ? 0.92 : 0.8) : HT.rnd() < 0.15
  if (behind) { const a = tgt.a + Math.PI + (HT.rnd() - 0.5) * 1.1, d = 30 + HT.rnd() * 8; x = tgt.x + Math.cos(a) * d; y = tgt.y + Math.sin(a) * d }
  else { const a = HT.rnd() * TAU, d = 42 + HT.rnd() * 14; x = tgt.x + Math.cos(a) * d; y = tgt.y + Math.sin(a) * d }
  x = clamp(x, -AW + 1, AW - 1); y = clamp(y, -AH + 1, AH - 1)
  const sc = 1 + (HT.kind === 'back' ? Math.min(1.2, HT.t / 120) * 0.6 : HT.day * 0.05)
  const m = { id: HT.id++, type, x, y, hp: D.hp * sc, max: D.hp * sc, a: 0, atkT: 0, hit: 0, t: Math.random() * 6, spitT: 2 + Math.random() * 2, sumT: 6, charge: 0, vx: 0, vy: 0, seen: 0 }
  HT.mons.push(m)
  if (type === 'king') { HT.boss = m; HT.bossSpawned = true; sfx('rgBoss'); shake(1.4) }
}

// ---------- the simulation ----------
const nearestPlayer = (x, y) => { let b = null, bd = 1e9; for (const p of HT.players) { if (p.down) continue; const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; b = p } } return b }
function push(e, r) {
  for (const o of near3(e.x, e.y)) { if (o.dead) continue; const dx = e.x - o.x, dy = e.y - o.y, d = Math.hypot(dx, dy), m = o.r + r; if (d < m && d > 0.001) { e.x = o.x + (dx / d) * m; e.y = o.y + (dy / d) * m } }
  e.x = clamp(e.x, -AW, AW); e.y = clamp(e.y, -AH, AH)
}
const lightR = (p) => 17 + p.up.light * 3.2, lightHalf = (p) => 0.42 + p.up.light * 0.06
function lit(p, x, y) { const dx = x - p.x, dy = y - p.y, d = Math.hypot(dx, dy); return d < 7 || (d < lightR(p) && Math.abs(angDiff(Math.atan2(dy, dx), p.a)) < lightHalf(p)) }
function hurtPlayer(p, dmg, from) {
  if (p.down || p.inv > 0) return
  p.hp -= dmg; p.hit = 0.35
  fx(p.x, p.y, 6, [1.6, 0.1, 0.1], 9, 0.4, 0.5)
  if (p.i === HT.me) { sfx('rgHurt'); shake(0.5); flash(0.12, [1, 0, 0]) }
  void from
  if (p.hp <= 0) { p.hp = 0; p.down = true; p.reviveT = 0; fx(p.x, p.y, 16, [1.6, 0.1, 0.1], 14, 0.8, 0.7); if (p.i === HT.me) sfx('over') }
}
function stepPlayer(p, dt) {
  const I = p.in
  p.hit = Math.max(0, p.hit - dt); p.inv = Math.max(0, (p.inv || 0) - dt); p.fireCd -= dt; p.dashCd -= dt; p.kick = Math.max(0, p.kick - dt)
  if (p.down) {
    // a teammate standing close revives you
    const mate = HT.players.find((q) => q !== p && !q.down && Math.hypot(q.x - p.x, q.y - p.y) < 4)
    if (mate) { p.reviveT += dt; if (p.reviveT >= 3) { p.down = false; p.hp = p.max * 0.5; p.inv = 2; sfx('rgPerk'); fx(p.x, p.y, 14, [0.4, 1.6, 0.6], 12, 0.6, 0.5) } } else p.reviveT = Math.max(0, p.reviveT - dt)
    return
  }
  const sp = 15 * (1 + p.up.speed * 0.08) * (p.dashT > 0 ? 2.6 : 1)
  let dx = I.dx, dy = I.dy; const l = Math.hypot(dx, dy)
  if (l > 1) { dx /= l; dy /= l }
  p.x += dx * sp * dt; p.y += dy * sp * dt
  if (l > 0.1) p.walk += dt * 9
  push(p, 1.2)
  p.a = I.a
  if (I.dash && p.dashCd <= 0 && l > 0.1) { p.dashT = 0.2; p.dashCd = 1.5; I.dash = false; fx(p.x, p.y, 6, [0.8, 0.8, 1], 6, 0.3, 0.4); sfx('rgDash') }
  p.dashT = Math.max(0, p.dashT - dt)
  if (I.mine && p.mines > 0) { I.mine = false; p.mines--; HT.mines.push({ id: HT.id++, x: p.x, y: p.y, owner: p.i, t: 0.8 }); sfx('bombPlace') }
  const W = WEAPONS[p.wp]
  if (I.sw) { const k = WLIST[I.sw - 1]; I.sw = 0; if (k && k !== p.wp && (k === 'rifle' || p.up[k] > 0)) { p.mags[p.wp] = p.mag; p.wp = k; p.mag = p.mags[k]; p.reload = 0; sfx('select') } }
  if (I.reload && p.reload <= 0 && p.mag < W.mag && p.reserve > 0) { p.reload = 1.3; I.reload = false; sfx('reload') }
  if (p.reload > 0) { p.reload -= dt; if (p.reload <= 0) { const take = Math.min(W.mag - p.mag, p.reserve); p.mag += take; p.reserve -= take } }
  if (I.fire && p.fireCd <= 0 && p.reload <= 0) {
    if (p.mag > 0) {
      p.mag--; p.fireCd = W.cd / (1 + p.up.rate * 0.15); p.kick = 0.12
      for (let k = 0; k < W.pellets; k++) {
        const a = p.a + (Math.random() - 0.5) * W.spread * 2
        HT.bul.push({ x: p.x + Math.cos(a) * 3, y: p.y + Math.sin(a) * 3, vx: Math.cos(a) * 95, vy: Math.sin(a) * 95, dmg: W.dmg * (1 + p.up.dmg * 0.2), owner: p.i, life: W.life })
      }
      fx(p.x + Math.cos(p.a) * 3.6, p.y + Math.sin(p.a) * 3.6, 3, [2.6, 2, 0.6], 8, 0.15, 0.4)
      if (p.i === HT.me || HT.net) sfx(W.snd)
      if (p.mag === 0 && p.reserve > 0) { p.reload = 1.3; sfx('reload') }
    } else if (p.reserve > 0) { p.reload = 1.3 } else if (p.i === HT.me && p.fireCd <= 0) { p.fireCd = 0.4; sfx('deny') }
  }
}
function stepMon(m, dt) {
  const D = MONS[m.type]
  m.t += dt; m.hit = Math.max(0, m.hit - dt); m.atkT -= dt
  const tgt = nearestPlayer(m.x, m.y)
  if (!tgt) return
  const dx = tgt.x - m.x, dy = tgt.y - m.y, d = Math.hypot(dx, dy) || 1
  let ang = Math.atan2(dy, dx), spd = D.spd
  if (m.type === 'stalker') {
    // it freezes (almost) when you look at it, and sprints when you are not watching
    const seen = lit(tgt, m.x, m.y) && Math.abs(angDiff(Math.atan2(m.y - tgt.y, m.x - tgt.x), tgt.a)) < lightHalf(tgt) + 0.15
    m.seen = seen ? 1 : 0
    spd *= seen ? 0.22 : 2.0
  } else if (m.type === 'spitter') {
    if (d < 9) ang += Math.PI; else if (d < 14) ang += Math.PI / 2
    m.spitT -= dt
    if (m.spitT <= 0 && d < 24) { m.spitT = 2.2; const a = Math.atan2(dy, dx); HT.spit.push({ x: m.x, y: m.y, vx: Math.cos(a) * 24, vy: Math.sin(a) * 24, life: 2.4, dmg: 10 + HT.day * 0.5 }); sfx('rgMagic') }
  } else if (m.type === 'wraith') {
    m.blink = (m.blink === undefined ? 2 + Math.random() * 2 : m.blink) - dt
    if (m.blink <= 0 && d > 10) { m.blink = 3.5 + Math.random() * 2; fx(m.x, m.y, 8, [1.2, 0.6, 2], 8, 0.4, 0.5); m.x += Math.cos(ang) * 9; m.y += Math.sin(ang) * 9; fx(m.x, m.y, 8, [1.2, 0.6, 2], 8, 0.4, 0.5) }
  } else if (m.type === 'howler') {
    if (d < 16) ang += Math.PI; else if (d < 24) ang += Math.PI / 2
    m.sumT -= dt
    if (m.sumT <= 0 && d < 34) { m.sumT = 7; for (const o of HT.mons) if (Math.hypot(o.x - m.x, o.y - m.y) < 45) o.rage = 4; sfx('roar'); shake(0.4); if (tgt.i === HT.me) G.flash = Math.max(G.flash || 0, 0.3) }
  } else if (m.type === 'king') {
    m.sumT -= dt
    if (m.sumT <= 0) { m.sumT = 5.5; for (let i = 0; i < 3; i++) spawnAround(m, 'crawler'); sfx('rgBoss'); shake(0.6) }
    m.charge -= dt
    if (m.charge <= 0 && d > 10 && d < 26 && m.hp < m.max * 0.7) { m.charge = 1.1; m.cd = 5 }
    if (m.charge > 0) spd *= 3.2
  }
  if (m.slow > 0) { m.slow -= dt; spd *= 0.5 }
  if (m.rage > 0) { m.rage -= dt; spd *= 1.5 }
  // steer around the cabin and trees
  for (const o of near3(m.x, m.y)) { if (o.dead) continue; const ox = o.x - m.x, oy = o.y - m.y, od = Math.hypot(ox, oy); if (od < o.r + D.r + 3 && Math.abs(angDiff(Math.atan2(oy, ox), ang)) < 1.2) { ang += (angDiff(Math.atan2(oy, ox), ang) > 0 ? -1 : 1) * 1.0 } }
  m.a = ang
  if (!(m.type === 'spitter' && d > 9 && d < 14)) { m.x += Math.cos(ang) * spd * dt; m.y += Math.sin(ang) * spd * dt }
  else { m.x += Math.cos(ang) * spd * dt * 0.6; m.y += Math.sin(ang) * spd * dt * 0.6 }
  push(m, D.r)
  // bite
  if (d < D.r + 1.8 && m.atkT <= 0 && m.type !== 'spitter') {
    m.atkT = m.type === 'brute' || m.type === 'king' ? 1.1 : 0.8
    let dmg = D.dmg * (1 + HT.day * 0.04)
    const behind = Math.abs(angDiff(Math.atan2(m.y - tgt.y, m.x - tgt.x), tgt.a)) > 2.0
    if (behind && m.type === 'stalker') { dmg *= 2; if (tgt.i === HT.me) { sfx('rgCreak'); G.flash = Math.max(G.flash || 0, 0.25) } }
    hurtPlayer(tgt, dmg, m)
    if (m.type === 'brute' || m.type === 'king') { tgt.x += Math.cos(ang) * 4; tgt.y += Math.sin(ang) * 4; push(tgt, 1.2); shake(0.5) }
  }
}
function spawnAround(m, type) {
  const D = MONS[type], a = Math.random() * TAU
  HT.mons.push({ id: HT.id++, type, x: clamp(m.x + Math.cos(a) * 6, -AW, AW), y: clamp(m.y + Math.sin(a) * 6, -AH, AH), hp: D.hp, max: D.hp, a: 0, atkT: 0, hit: 0, t: 0, spitT: 3, sumT: 9, charge: 0, vx: 0, vy: 0, seen: 0 })
}
function killMon(m) {
  m.dead = true; HT.kills++; HT.score += 10 + MONS[m.type].cost * 5
  const owner = HT.players[m.lastHit]
  if (owner) owner.kills++
  fx(m.x, m.y, 12, [0.5, 1.4, 0.4], 14, 0.7, 0.6)
  const n = Math.ceil(MONS[m.type].scrap / 3)
  for (let i = 0; i < n; i++) HT.pick.push({ id: HT.id++, k: 'scrap', v: Math.ceil(MONS[m.type].scrap / n), x: m.x + (Math.random() - 0.5) * 4, y: m.y + (Math.random() - 0.5) * 4, life: 25 })
  const r = Math.random()
  if (r < 0.1) HT.pick.push({ id: HT.id++, k: 'ammo', v: 14, x: m.x, y: m.y, life: 25 })
  else if (r < 0.15) HT.pick.push({ id: HT.id++, k: 'med', v: 30, x: m.x, y: m.y, life: 25 })
  if (m.type === 'king') { HT.boss = null }
  sfx('rgKill')
}
function update(dtRaw) {
  const dt = Math.min(dtRaw, 0.05)
  if (HT.mode === 'idle' || HT.paused) return
  stepParticles(dt)
  for (const q of HT.fx) { q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.h += q.vh * dt; q.vh -= 12 * dt }
  HT.fx = HT.fx.filter((q) => q.life > 0 && q.h > 0)
  if (HT.msg) { HT.msg.t -= dt; if (HT.msg.t <= 0) HT.msg = null }
  if (HT.mode === 'over') { emitTick(dt); return }
  if (HT.net && HT.net.role === 'guest') { guestStep(dt); emitTick(dt); return }
  HT.t += dt; HT.phaseT += dt
  readLocal(HT.players[HT.me])
  for (const p of HT.players) stepPlayer(p, dt)
  if (HT.players.every((p) => p.down)) return finish(false)
  if (HT.phase === 'dawn') {
    // the shop: wait until everyone is ready (or 40 s)
    if (HT.kind === 'days' && (HT.phaseT > 40 || HT.players.every((p) => HT.ready[p.i]))) { HT.ready = {}; startNight() }
    emitTick(dt)
    return
  }
  // night
  while (HT.spawnQ.length && HT.spawnQ[0].t <= HT.phaseT) spawnMon(HT.spawnQ.shift().type)
  if (HT.kind === 'back') { // it never ends: the pace keeps rising
    HT.rate = (HT.rate || 0) - dt
    if (HT.rate <= 0) { HT.rate = Math.max(0.7, 3.0 - HT.t / 45); spawnMon(HT.t > 40 && Math.random() < 0.16 ? 'brute' : HT.t > 25 && Math.random() < 0.15 ? 'wraith' : HT.t > 70 && Math.random() < 0.1 ? 'howler' : Math.random() < 0.6 ? 'stalker' : 'crawler') }
    if (Math.floor(HT.t) % 60 === 59 && Math.floor(HT.t - dt) % 60 === 58) HT.score += 100
  }
  for (const m of HT.mons) stepMon(m, dt)
  // bullets
  for (const b of HT.bul) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt
    for (const m of HT.mons) {
      if (m.dead) continue
      if (Math.hypot(m.x - b.x, m.y - b.y) < MONS[m.type].r + 0.7) { m.hp -= b.dmg; m.hit = 0.12; m.lastHit = b.owner; b.life = 0; fx(b.x, b.y, 3, [0.6, 1.4, 0.4], 8, 0.3, 0.4); if (m.hp <= 0) killMon(m); break }
    }
    for (const o of near3(b.x, b.y, 0)) { if (o.dead || Math.hypot(o.x - b.x, o.y - b.y) >= o.r) continue; b.life = 0; if (o.crate) { o.hp -= b.dmg; if (o.hp <= 0) { o.dead = true; HT.deadSet.add(o.key); HT.deadKeys.push(o.key); fx(o.x, o.y, 10, [1.6, 1.1, 0.4], 12, 0.5, 0.6); sfx('crate'); for (let q = 0; q < 3; q++) HT.pick.push({ id: HT.id++, k: 'scrap', v: 6, x: o.x + (Math.random() - 0.5) * 3, y: o.y + (Math.random() - 0.5) * 3, life: 40 }); HT.pick.push({ id: HT.id++, k: Math.random() < 0.6 ? 'ammo' : 'med', v: 18, x: o.x, y: o.y, life: 40 }) } } }
    if (Math.abs(b.x) > AW + 4 || Math.abs(b.y) > AH + 4) b.life = 0
  }
  HT.bul = HT.bul.filter((b) => b.life > 0)
  for (const s of HT.spit) { s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt; for (const p of HT.players) if (!p.down && Math.hypot(p.x - s.x, p.y - s.y) < 1.8) { hurtPlayer(p, s.dmg, s); s.life = 0 } }
  HT.spit = HT.spit.filter((s) => s.life > 0)
  for (const mn of HT.mines) {
    mn.t -= dt
    if (mn.t > 0) continue
    for (const m of HT.mons) if (!m.dead && Math.hypot(m.x - mn.x, m.y - mn.y) < MONS[m.type].r + 1.6) {
      mn.boom = true
      for (const q of HT.mons) if (!q.dead && Math.hypot(q.x - mn.x, q.y - mn.y) < 8) { q.hp -= 130; q.hit = 0.2; q.lastHit = mn.owner; if (q.hp <= 0) killMon(q) }
      fx(mn.x, mn.y, 22, [3, 1.4, 0.2], 24, 0.7, 1.0); sfx('boom'); shake(0.8)
      break
    }
  }
  HT.mines = HT.mines.filter((m) => !m.boom)
  HT.mons = HT.mons.filter((m) => !m.dead)
  for (const k of HT.pick) { k.life -= dt; for (const p of HT.players) if (!p.down && Math.hypot(p.x - k.x, p.y - k.y) < 2.6) { k.life = 0; if (k.k === 'scrap') { p.scrap += k.v; sfx('coin') } else if (k.k === 'ammo') { p.reserve += k.v; sfx('pickup') } else { p.hp = Math.min(p.max, p.hp + k.v); sfx('rgHeart') } } }
  HT.pick = HT.pick.filter((k) => k.life > 0)
  // anything still lurking when the sun is well up burns away (also frees stuck monsters)
  if (HT.kind === 'days' && !HT.spawnQ.length && HT.phaseT > HT.nightLen + 25) { for (const m of HT.mons) if (!m.dead && m.type !== 'king') killMon(m); HT.mons = HT.mons.filter((m) => !m.dead) }
  // dawn
  if (HT.kind === 'days' && !HT.spawnQ.length && !HT.mons.length && HT.phaseT > 5) dawn()
  // everyone down: it is over
  if (HT.players.every((p) => p.down)) return finish(false)
  emitTick(dt)
}
function dawn() {
  const bonus = 30 + HT.day * 8
  for (const p of HT.players) { p.scrap += bonus; if (p.down) { p.down = false; p.hp = p.max * 0.5 } else p.hp = Math.min(p.max, p.hp + 30) }
  HT.score += HT.day * 200
  if (HT.day >= DAYS) return finish(true)
  HT.day++; HT.phase = 'dawn'; HT.phaseT = 0; HT.mons = []; HT.spit = []; HT.bul = []; HT.ready = {}
  HT.msg = { text: 'DAWN OF DAY ' + HT.day, sub: '+' + bonus + ' scrap. Spend it in the shop.', t: 3 }
  sfx('win')
}
function finish(win) {
  HT.mode = 'over'; music.stop()
  if (win) HT.score += 5000
  const me = HT.players[HT.me]
  HT.over = { win, kind: HT.kind, day: HT.day, kills: HT.kills, mine: me ? me.kills : 0, time: HT.t, score: HT.score, players: HT.players.length }
  profile.huntGames = (profile.huntGames || 0) + 1
  profile.huntBest = Math.max(profile.huntBest || 0, HT.score)
  if (HT.kind === 'days') { profile.huntDay = Math.max(profile.huntDay || 0, win ? DAYS + 1 : HT.day); if (win) profile.huntWins = (profile.huntWins || 0) + 1 }
  else profile.huntBackBest = Math.max(profile.huntBackBest || 0, Math.floor(HT.t))
  recordScore('hunt', HT.score); saveProfile()
  sfx(win ? 'win' : 'over')
  if (HT.net && HT.net.role === 'host') HT.net.send({ k: 'end', over: HT.over })
  emitH()
}
// ---------- shop ----------
export const priceOf = (it, p) => Math.round(it.base * (it.k === 'ammo' || it.k === 'medkit' || it.k === 'mines' ? 1 : 1 + 0.6 * (p.up[it.k] || 0)))
function buy(pi, k) {
  const p = HT.players[pi], it = SHOP.find((s) => s.k === k)
  if (!p || !it || HT.phase !== 'dawn' || HT.mode !== 'play') return false
  const lv = p.up[k] || 0
  if (it.max < 99 && lv >= it.max) return false
  const cost = priceOf(it, p)
  if (p.scrap < cost) return false
  p.scrap -= cost
  if (k === 'ammo') p.reserve += 36
  else if (k === 'medkit') p.hp = Math.min(p.max, p.hp + 60)
  else if (k === 'mines') p.mines += 2
  else { p.up[k] = lv + 1; if (k === 'hp') { p.max += 25; p.hp += 25 }; if (k === 'shotgun' || k === 'smg') { p.mags[p.wp] = p.mag; p.wp = k; p.mag = WEAPONS[k].mag } }
  sfx('buy')
  return true
}
function setReady(pi) { HT.ready[pi] = true }
// ---------- input ----------
const TK = {}
function readLocal(p) {
  if (!p) return
  const dn = (...c) => c.some((k) => keys[k])
  const I = p.in
  I.dx = (dn('KeyD', 'ArrowRight') || TK.right ? 1 : 0) - (dn('KeyA', 'ArrowLeft') || TK.left ? 1 : 0)
  I.dy = (dn('KeyW', 'ArrowUp') || TK.up ? 1 : 0) - (dn('KeyS', 'ArrowDown') || TK.down ? 1 : 0)
  if (HT.mouse.sx !== undefined) { const g = unprojectGround(camNow(), HT.mouse.sx / 50, HT.mouse.sy / 28); if (g) { HT.mouse.x = g.x; HT.mouse.y = g.y } }
  I.a = Math.atan2(HT.mouse.y - p.y, HT.mouse.x - p.x)
  I.fire = HT.mouse.down || !!TK.fire
  if (dn('KeyR') || TK.reload) I.reload = true
  for (let w = 1; w <= 3; w++) if (dn('Digit' + w) || TK['w' + w]) { if (!p['wh' + w]) { I.sw = w; p['wh' + w] = true } } else p['wh' + w] = false
  if (dn('Space') || TK.dash) I.dash = true
  if (dn('KeyF') || TK.mine) { if (!p.fHeld) { I.mine = true; p.fHeld = true } } else p.fHeld = false
}
function onKey(code) {
  if (HT.mode === 'idle') return
  if (code === 'Escape' || code === 'KeyP') { if (HT.mode === 'play' && !HT.net) { HT.paused = !HT.paused; emitH() } return }
  if (HT.mode === 'over' && code === 'Enter') return huntActions.rematch()
}
function pointer(type, ax, ay) {
  HT.mouse.sx = ax; HT.mouse.sy = ay
  const g = unprojectGround(camNow(), ax / 50, ay / 28)
  if (g) { HT.mouse.x = g.x; HT.mouse.y = g.y }
  if (type === 'down') HT.mouse.down = true
  else if (type === 'up') HT.mouse.down = false
}
const CAMP = { x: 0, y: 0 }
const camNow = () => ({ x: CAMP.x, y: 66, z: -CAMP.y + 38, tx: CAMP.x, ty: 0, tz: -CAMP.y - 2, fov: 45, far: 400, aspect: 100 / 56 })
const camHunt = () => {
  const p = HT.players[HT.me]
  if (p) { CAMP.x += (clamp(p.x, -AW + 40, AW - 40) - CAMP.x) * 0.18; CAMP.y += (clamp(p.y, -AH + 24, AH - 24) - CAMP.y) * 0.18 }
  const sk = (G.shake || 0) * 0.6
  return { x: CAMP.x + (Math.random() - 0.5) * sk, y: 66, z: -CAMP.y + 38 + (Math.random() - 0.5) * sk, tx: CAMP.x, ty: 0, tz: -CAMP.y - 2, fov: 45, far: 400, aspect: 100 / 56 }
}
export const huntActions = {
  start, stop, quit() { toMenu() }, resume() { HT.paused = false; emitH() }, pause() { if (HT.mode === 'play' && !HT.paused && !HT.net) { HT.paused = true; emitH(); return true } return false },
  rematch() { if (HT.net) { if (HT.net.role === 'host') HT.net.restart(); else HT.net.sendHost({ k: 'rematch' }); return } start({ kind: HT.kind }) },
  pointer, press(n, on) { TK[n] = on },
  buy(k) { if (HT.net && HT.net.role === 'guest') { HT.net.sendHost({ k: 'buy', item: k }); return } buy(HT.me, k) },
  ready() { if (HT.net && HT.net.role === 'guest') { HT.net.sendHost({ k: 'ready' }); HT.ready[HT.me] = true; emitH(); return } setReady(HT.me); emitH() },
  setKind(k) { profile.huntKind = k; saveProfile() },
}
// ---------- online ----------
const r2 = (v) => Math.round(v * 100) / 100
function sendSnap(dt) {
  HT.netT -= dt
  if (HT.netT > 0) return
  HT.netT = 0.066
  HT.net.send({
    k: 'st', ph: HT.phase, d: HT.day, t: r2(HT.t), pt: r2(HT.phaseT), nl: r2(HT.nightLen), sc: HT.score, kl: HT.kills, rd: HT.ready, left: HT.spawnQ.length,
    p: HT.players.map((p) => [r2(p.x), r2(p.y), r2(p.a), p.hp | 0, p.max, p.mag, p.reserve, p.down ? 1 : 0, r2(p.reload), p.scrap, p.mines, p.kills, r2(p.reviveT), p.hit > 0 ? 1 : 0, p.dashT > 0 ? 1 : 0, p.up.dmg, p.up.rate, p.up.hp, p.up.light, p.up.speed, p.kick > 0 ? 1 : 0, WLIST.indexOf(p.wp), p.up.shotgun, p.up.smg]),
    m: HT.mons.map((m) => [m.id, m.type, r2(m.x), r2(m.y), m.hp | 0, r2(m.a), m.hit > 0 ? 1 : 0, m.seen]),
    b: HT.bul.map((b) => [r2(b.x), r2(b.y), r2(b.vx), r2(b.vy)]), s: HT.spit.map((s) => [r2(s.x), r2(s.y)]),
    dc: HT.deadKeys, pk: HT.pick.map((k) => [k.id, k.k, r2(k.x), r2(k.y)]), mn: HT.mines.map((m) => [r2(m.x), r2(m.y)]), msg: HT.msg,
  })
}
function applySnap(d) {
  HT.phase = d.ph; HT.day = d.d; HT.t = d.t; HT.phaseT = d.pt; HT.nightLen = d.nl; HT.score = d.sc; HT.kills = d.kl; HT.ready = d.rd || {}; HT.left = d.left
  d.p.forEach((a, i) => {
    const p = HT.players[i]; if (!p) return
    const mine = i === HT.me
    if (!mine || Math.hypot(p.x - a[0], p.y - a[1]) > 8) { p.x = a[0]; p.y = a[1] } else { p.x += (a[0] - p.x) * 0.2; p.y += (a[1] - p.y) * 0.2 }
    if (!mine) p.a = a[2]
    Object.assign(p, { hp: a[3], max: a[4], mag: a[5], reserve: a[6], down: !!a[7], reload: a[8], scrap: a[9], mines: a[10], kills: a[11], reviveT: a[12], hit: a[13] ? 0.2 : 0, dashT: a[14] ? 0.1 : 0, kick: a[20] ? 0.1 : 0 })
    p.up = { dmg: a[15], rate: a[16], hp: a[17], light: a[18], speed: a[19], shotgun: a[22] || 0, smg: a[23] || 0 }; p.wp = WLIST[a[21]] || 'rifle'
  })
  const old = new Map(HT.mons.map((m) => [m.id, m]))
  HT.mons = d.m.map((a) => { const o = old.get(a[0]) || { t: Math.random() * 6, x: a[2], y: a[3] }; return Object.assign(o, { id: a[0], type: a[1], tx: a[2], ty: a[3], hp: a[4], max: MONS[a[1]].hp, a: a[5], hit: a[6] ? 0.1 : 0, seen: a[7] }) })
  HT.bul = d.b.map((a) => ({ x: a[0], y: a[1], vx: a[2], vy: a[3] }))
  HT.spit = d.s.map((a) => ({ x: a[0], y: a[1] }))
  for (const k of d.dc || []) { if (!HT.deadSet.has(k)) { HT.deadSet.add(k); const o = HT.byKey.get(k); if (o) o.dead = true } }
  HT.pick = d.pk.map((a) => ({ id: a[0], k: a[1], x: a[2], y: a[3] }))
  HT.mines = d.mn.map((a) => ({ x: a[0], y: a[1] }))
  if (d.msg && (!HT.msg || HT.msg.text !== d.msg.text)) HT.msg = d.msg
  HT.boss = HT.mons.find((m) => m.type === 'king') || null
}
let inT = 0
function guestStep(dt) {
  const me = HT.players[HT.me]
  readLocal(me)
  if (me && !me.down) {
    const I = me.in, sp = 15 * (1 + me.up.speed * 0.08) * (me.dashT > 0 ? 2.6 : 1)
    let dx = I.dx, dy = I.dy; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l }
    me.x += dx * sp * dt; me.y += dy * sp * dt; push(me, 1.2); me.a = I.a
    if (l > 0.1) me.walk += dt * 9
  }
  for (const m of HT.mons) { if (m.tx !== undefined) { m.x += (m.tx - m.x) * Math.min(1, dt * 14); m.y += (m.ty - m.y) * Math.min(1, dt * 14) } m.t += dt }
  for (const b of HT.bul) { b.x += b.vx * dt; b.y += b.vy * dt }
  inT -= dt
  if (inT <= 0 && me) { inT = 0.05; const I = me.in; HT.net.sendHost({ k: 'in', dx: r2(I.dx), dy: r2(I.dy), a: r2(I.a), f: I.fire ? 1 : 0, r: I.reload ? 1 : 0, d: I.dash ? 1 : 0, m: I.mine ? 1 : 0 }); I.reload = I.dash = I.mine = false }
  for (const p of HT.players) { p.hit = Math.max(0, p.hit - dt); p.kick = Math.max(0, p.kick - dt) }
}
function emitTick(dt) {
  if (HT.net && HT.net.role === 'host') sendSnap(dt)
  HT.emitT -= dt
  if (HT.emitT <= 0) { HT.emitT = 0.1; emitH() }
}
const MWIN = [130, 78]
function miniMap(me) {
  const f = (x, y) => [(x - me.x + MWIN[0]) / (2 * MWIN[0]), 1 - (y - me.y + MWIN[1]) / (2 * MWIN[1])]
  const inWin = (x, y) => Math.abs(x - me.x) < MWIN[0] && Math.abs(y - me.y) < MWIN[1]
  const c = []
  for (const ch of viewChunks(me.x, me.y, MWIN[0], MWIN[1])) { for (const d of ch.decor) if (inWin(d.x, d.y)) c.push(f(d.x, d.y)); for (const o of ch.obs) if (o.cabin && inWin(o.x, o.y)) c.push(f(o.x, o.y)) }
  return {
    p: HT.players.filter((p) => inWin(p.x, p.y)).map((p) => [...f(p.x, p.y), p === HT.players[HT.me] ? 1 : 0, p.down ? 1 : 0]),
    m: HT.mons.filter((m) => inWin(m.x, m.y) && (Math.hypot(m.x - me.x, m.y - me.y) < 40 || HT.players.some((q) => !q.down && lit(q, m.x, m.y)))).slice(0, 50).map((m) => [...f(m.x, m.y), m.type === 'king' ? 1 : 0]), c,
  }
}
function emitH() {
  const me = HT.players[HT.me]
  let behind = null
  if (me && !me.down) for (const m of HT.mons) { const dx = m.x - me.x, dy = m.y - me.y, d = Math.hypot(dx, dy); if (d < 22) { const rel = angDiff(Math.atan2(dy, dx), me.a); if (Math.abs(rel) > 1.9 && (!behind || d < behind.d)) behind = { rel, d } } }
  snap = {
    mode: HT.mode, paused: HT.paused, kind: HT.kind, phase: HT.phase, day: HT.day, days: DAYS, score: HT.score, kills: HT.kills, t: HT.t, left: HT.net && HT.net.role === 'guest' ? HT.left : HT.spawnQ.length + HT.mons.length,
    nightLeft: HT.kind === 'days' ? Math.max(0, Math.ceil(HT.nightLen - HT.phaseT)) : 0, shopLeft: Math.max(0, Math.ceil(40 - HT.phaseT)),
    me: me ? { hp: me.hp, max: me.max, mag: me.mag, reserve: me.reserve, reload: me.reload > 0, scrap: me.scrap, mines: me.mines, down: me.down, revive: me.reviveT, up: { ...me.up }, wp: me.wp, wname: WEAPONS[me.wp].name, mags: WEAPONS[me.wp].mag, kills: me.kills, dashCd: Math.max(0, me.dashCd || 0) } : null,
    team: HT.players.map((p, i) => ({ n: p.name, hp: p.hp, max: p.max, down: p.down, c: p.color, me: i === HT.me, ready: !!HT.ready[i] })),
    mini: me ? miniMap(me) : null,
    behind, boss: HT.boss ? { hp: HT.boss.hp, max: HT.boss.max } : null, msg: HT.msg, over: HT.over, online: !!HT.net, ready: !!HT.ready[HT.me],
  }
  subs.forEach((f) => f())
}
registerNet('hunt', {
  min: 1,
  begin(ctx) {
    start({ kind: ctx.opts.kind === 'back' ? 'back' : 'days', seed: ctx.seed, net: { role: ctx.role, players: ctx.players, me: ctx.me, send: (d) => ctx.send(d), sendHost: (d) => ctx.sendHost(d), restart: () => ctx.restart() } })
  },
  active: () => !!HT.net && HT.mode !== 'idle',
  onMsg(d, from) {
    if (!d || !HT.net) return
    if (HT.net.role === 'host') {
      const i = HT.net.players.findIndex((p) => p.id === from), p = HT.players[i]
      if (!p) return
      if (d.k === 'in') { const I = p.in; I.dx = clamp(+d.dx || 0, -1, 1); I.dy = clamp(+d.dy || 0, -1, 1); I.a = +d.a || 0; I.fire = !!d.f; if (d.r) I.reload = true; if (d.d) I.dash = true; if (d.m) I.mine = true }
      else if (d.k === 'buy') buy(i, String(d.item))
      else if (d.k === 'ready') setReady(i)
      else if (d.k === 'rematch' && HT.mode === 'over') HT.net.restart()
    } else if (d.k === 'st') applySnap(d)
    else if (d.k === 'end') { HT.mode = 'over'; HT.over = d.over; music.stop(); sfx(d.over.win ? 'win' : 'over'); profile.huntGames = (profile.huntGames || 0) + 1; profile.huntBest = Math.max(profile.huntBest || 0, d.over.score); saveProfile(); emitH() }
  },
  onLeave(cid) { if (!HT.net) return; const i = HT.net.players.findIndex((p) => p.id === cid); if (HT.net.role === 'host' && HT.players[i]) { HT.players[i].down = true; HT.players[i].hp = 0; HT.players[i].gone = true } else if (HT.net.role === 'guest' && HT.mode === 'play' && cid === null) { finish(false) } },
})
// ---------- drawing ----------
const YAW = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c] }
function lights() {
  const p = HT.players[HT.me]
  const px = p ? p.x : 0, py = p ? p.y : 0
  return { sun: { x: -30, y: 80, z: 20, color: '#6f86d8', intensity: HT.phase === 'dawn' ? 1.1 : 0.32 }, ambient: HT.phase === 'dawn' ? 0.85 : 0.2, dir: HT.phase === 'dawn' ? 0.3 : 0.05, shadow: false, lantern: { x: px, y: 9, z: -py, color: '#ffe2a8', intensity: HT.phase === 'dawn' ? 1.2 : 2.6, distance: 52 } }
}
function drawHunter(api, p, t) {
  const { put3, putM, putS } = api
  const w = (lx, ly, lz) => [p.x + Math.cos(p.a) * lx + Math.sin(p.a) * lz, ly, -(p.y + Math.sin(p.a) * lx - Math.cos(p.a) * lz)]
  const M = YAW(p.a)
  const col = p.color === '#ff8a2a' ? [1.1, 0.5, 0.15] : p.color === '#3de8ff' ? [0.2, 0.8, 1.1] : [0.6, 0.4, 1.1]
  if (p.down) { put3(p.x, 0.5, -p.y, 4.4, 0.9, 2.2, 0, col[0] * 0.5, col[1] * 0.5, col[2] * 0.5, 0.4); if (p.reviveT > 0) put3(p.x, 3, -p.y, 5 * (p.reviveT / 3), 0.4, 0.4, 0, 0.4, 2, 0.6, 0); else putS(p.x, 3.6 + Math.sin(t * 4) * 0.4, -p.y, 1.4, 1.4, 1.4, 2.6, 0.3, 0.3); return }
  const bob = Math.sin(p.walk) * 0.25, fl = p.hit > 0 ? 1.8 : 1
  const part = (lx, ly, lz, sx, sy, sz, c) => { const q = w(lx, ly, lz); putM(q[0], q[1], q[2], sx, sy, sz, M, c[0] * fl, c[1] * fl, c[2] * fl) }
  putM(p.x + 0.4, 0.05, -p.y + 0.4, 3.2, 0.1, 3.2, M, 0.01, 0.02, 0.01)
  part(0, 1.1, 0.5 * Math.sin(p.walk), 0.9, 2.2, 0.9, [0.14, 0.12, 0.14]); part(0, 1.1, -0.5 * Math.sin(p.walk), 0.9, 2.2, 0.9, [0.14, 0.12, 0.14])
  part(0, 3.2 + bob, 0, 1.6, 2.6, 2.6, col)
  part(0, 5.1 + bob, 0, 1.6, 1.6, 1.6, [0.9, 0.7, 0.55]); part(0, 6.0 + bob, 0, 2.3, 0.5, 2.3, [0.2, 0.14, 0.1]); part(0, 6.4 + bob, 0, 1.4, 0.7, 1.4, [0.2, 0.14, 0.1])
  const k = p.kick > 0 ? -0.5 : 0
  part(2.2 + k, 3.4, 0.7, 4.2, 0.55, 0.55, [0.25, 0.25, 0.3]); part(1.0 + k, 3.2, 0.7, 1.6, 0.9, 0.8, [0.4, 0.28, 0.16])
  part(0.8, 3.6, -1.2, 0.8, 0.9, 0.8, [0.9, 0.7, 0.55])
  part(4.6 + k, 3.4, 0.7, 0.4, 0.4, 0.4, [2.6, 2.4, 1.2]) // flashlight lens
  if (p.i === HT.me) { putS(p.x, 8.4, -p.y, 0.9, 0.9, 0.9, 0.3, 2.4, 1.0) }
}
const MCOL = { wraith: [0.18, 0.2, 0.42], howler: [0.55, 0.5, 0.3], crawler: [0.5, 0.65, 0.4], stalker: [0.3, 0.3, 0.45], spitter: [0.5, 0.7, 0.2], brute: [0.65, 0.35, 0.3], king: [0.5, 0.2, 0.7] }
function drawMon(api, m, t, visible) {
  const { put3, putM, putS } = api
  const D = MONS[m.type], z = -m.y
  if (!visible) { put3(m.x + Math.cos(m.a) * 0.6, 3.4, z - Math.sin(m.a) * 0.6 + 0.5, 0.5, 0.5, 0.4, 0, 2.6, 0.1, 0.1, 0); put3(m.x + Math.cos(m.a) * 0.6, 3.4, z - Math.sin(m.a) * 0.6 - 0.5, 0.5, 0.5, 0.4, 0, 2.6, 0.1, 0.1, 0); return }
  const M = YAW(m.a), c = MCOL[m.type], fl = m.hit > 0 ? 2 : 1, sc = D.r / 1.5
  const w = (lx, ly, lz) => [m.x + Math.cos(m.a) * lx + Math.sin(m.a) * lz, ly, -(m.y + Math.sin(m.a) * lx - Math.cos(m.a) * lz)]
  const part = (lx, ly, lz, sx, sy, sz, cc) => { const q = w(lx * sc, ly * sc, lz * sc); putM(q[0], q[1], q[2], sx * sc, sy * sc, sz * sc, M, cc[0] * fl, cc[1] * fl, cc[2] * fl) }
  const sw = Math.sin(m.t * (m.type === 'crawler' ? 16 : 9))
  if (m.type === 'crawler') { part(0, 0.9, 0, 3, 1.2, 1.8, c); part(1.7, 1.0, 0, 1.2, 1, 1.2, c); part(-1 + sw * 0.5, 0.5, 1.2, 1.6, 0.4, 0.4, c); part(-1 - sw * 0.5, 0.5, -1.2, 1.6, 0.4, 0.4, c) }
  else if (m.type === 'stalker') { part(0, 2.6, 0, 1.4, 4.4, 2.0, c); part(0.2, 5.3, 0, 1.6, 1.6, 1.6, [0.7, 0.7, 0.8]); part(0, 3.8, 1.8 + sw * 0.4, 3.6, 0.45, 0.45, c); part(0, 3.8, -1.8 - sw * 0.4, 3.6, 0.45, 0.45, c) }
  else if (m.type === 'wraith') { part(0, 3.4, 0, 1.6, 6, 2.2, c); part(0.3, 6.8, 0, 1.8, 1.8, 1.8, [0.5, 0.55, 0.9]); part(0, 2.6 + sw * 0.4, 1.8, 0.5, 5, 0.5, c); part(0, 2.6 - sw * 0.4, -1.8, 0.5, 5, 0.5, c); part(-1, 1.2, 0, 1.2, 2.4, 1.6, [0.1, 0.12, 0.3]) }
  else if (m.type === 'howler') { part(0, 2.4, 0, 3, 3.6, 3.6, c); part(1.0, 5.0, 0, 3.4, 3.2, 3.8, [0.7, 0.62, 0.4]); part(2.4, 4.4 - Math.abs(sw) * 0.8, 0, 1.6, 1.4 + Math.abs(sw), 2.6, [0.12, 0.04, 0.04]); part(0, 3.4 + sw * 0.4, 2.6, 0.9, 3.4, 0.9, c); part(0, 3.4 - sw * 0.4, -2.6, 0.9, 3.4, 0.9, c) }
  else if (m.type === 'spitter') { part(0, 2.2, 0, 2.4, 3.2, 2.4, c); part(0.4, 4.4 + Math.abs(sw) * 0.3, 0, 2.2, 1.6, 2.2, [0.7, 0.9, 0.3]); part(1.4, 4.4, 0, 1.2, 0.8, 0.8, [0.2, 0.4, 0.1]) }
  else if (m.type === 'brute') { part(0, 3, 0, 3.4, 4.4, 3.8, c); part(0.6, 6.0, 0, 2, 1.8, 2, [0.75, 0.5, 0.4]); part(1.4, 3.2 + sw * 0.5, 2.6, 1.2, 3, 1.4, c); part(1.4, 3.2 - sw * 0.5, -2.6, 1.2, 3, 1.4, c) }
  else { part(0, 4, 0, 4.4, 6.4, 4.8, c); part(0.6, 8.2, 0, 2.6, 2.4, 2.6, [0.8, 0.8, 0.9]); part(0.6, 10.2, 0, 3.6, 0.8, 3.6, [1.8, 1.4, 0.3]); for (let i = -1; i <= 1; i++) part(0.6, 11, i * 1.2, 0.5, 1.6, 0.5, [1.8, 1.4, 0.3]); part(1.6, 4.4 + sw * 0.6, 3.4, 1.6, 4.2, 1.6, c); part(1.6, 4.4 - sw * 0.6, -3.4, 1.6, 4.2, 1.6, c) }
  putS(m.x + Math.cos(m.a) * 1.4 * sc, 3.4 * sc + (m.type === 'stalker' ? 2 : 0), z - Math.sin(m.a) * 1.4 * sc, 0.5, 0.5, 0.5, 2.6, 0.1, 0.1)
  if (m.type === 'stalker' && m.seen) put3(m.x, 0.2, z, 4, 0.1, 4, 0, 0.1, 0.5, 2, 0) // frozen under your light
}
function draw3(api) {
  const { put3, putS } = api, t = G.time
  const cx = CAMP.x, cy = CAMP.y
  const near = (x, y, pad = 0) => Math.abs(x - cx) < 66 + pad && Math.abs(y - cy) < 44 + pad
  // forest floor that follows the camera, with tufts and glowing mushrooms scattered by cell
  put3(cx, -1.4, -cy, 150, 1.6, 100, 0, 0.04, 0.08, 0.04, 0)
  const c0 = Math.floor(cx / 9), r0 = Math.floor(cy / 9)
  for (let i = c0 - 8; i <= c0 + 8; i++) for (let j = r0 - 5; j <= r0 + 5; j++) {
    const h1 = hash2(i, j), h2 = hash2(j, i + 7), x = (i + h1) * 9, y = (j + h2) * 9
    if (Math.abs(x) > AW || Math.abs(y) > AH) continue
    put3(x, 0.15, -y, 1.4 + h1 * 2, 0.5, 1.2 + h2 * 2, 0, 0.05, 0.13 + h1 * 0.06, 0.05, h1 * 6)
    if (h1 > 0.9) { putS(x + 1, 0.7, -(y + 1), 0.9, 0.9, 0.9, 0.2, 1.4 + Math.sin(t * 2 + i) * 0.4, 1.2) }
  }
  // the edge of the world: a stone wall
  if (Math.abs(cy) > AH - 60) for (let k = Math.floor((cx - 70) / 7) * 7; k <= cx + 70; k += 7) for (const sy of [-AH - 2, AH + 2]) if (near(k, sy, 8)) { put3(k, 2, -sy, 5, 4, 1.6, 0, 0.1, 0.1, 0.12, 0); put3(k, 4.6, -sy, 1, 1.6, 1, 0, 0.07, 0.05, 0.05, 0) }
  if (Math.abs(cx) > AW - 80) for (let k = Math.floor((cy - 46) / 7) * 7; k <= cy + 46; k += 7) for (const sx of [-AW - 2, AW + 2]) if (near(sx, k, 8)) { put3(sx, 2, -k, 1.6, 4, 5, 0, 0.1, 0.1, 0.12, 0); put3(sx, 4.6, -k, 1, 1.6, 1, 0, 0.07, 0.05, 0.05, 0) }
  const vch = viewChunks(cx, cy, 72, 48)
  const vobs = vch.flatMap((c) => c.obs)
  for (const o of vobs) {
    if (o.dead || !near(o.x, o.y, 6)) continue
    if (o.cabin) { put3(o.x, 3.2, -o.y, 11, 6.4, 8, 0, 0.32, 0.2, 0.12, 0); put3(o.x, 7.4, -o.y, 12.6, 1.8, 9.4, 0, 0.22, 0.1, 0.08, 0); put3(o.x, 9.2, -o.y, 8, 1.8, 7, 0, 0.2, 0.09, 0.07, 0); put3(o.x + 3.2, 4, -o.y + 4.1, 1.8, 2, 0.3, 0, HT.phase === 'dawn' ? 1 : 2.4, HT.phase === 'dawn' ? 1 : 1.8, 0.5, 0); put3(o.x - 3, 4, -o.y + 4.1, 1.8, 2, 0.3, 0, 2.4, 1.8, 0.5, 0); put3(o.x + 4, 9.8, -o.y, 1.4, 3.4, 1.4, 0, 0.18, 0.12, 0.1, 0); continue }
    if (o.tomb) { put3(o.x, 1.4, -o.y, 1.6, 2.8, 0.6, 0, 0.3, 0.3, 0.34, o.x); put3(o.x, 0.3, -o.y + 1.2, 2, 0.5, 2.6, 0, 0.06, 0.05, 0.04, 0); continue }
    if (o.car) { put3(o.x, 1.3, -o.y, 7, 1.8, 3.6, 0, 0.3, 0.1, 0.08, 0.3); put3(o.x - 0.5, 2.8, -o.y, 3.6, 1.4, 3, 0, 0.2, 0.08, 0.07, 0.3); put3(o.x + 1.4, 0.6, -o.y + 2, 1.2, 1.2, 0.5, 0, 0.05, 0.05, 0.05, 0); continue }
    if (o.tower) { put3(o.x, 4, -o.y, 3.4, 8, 3.4, 0, 0.16, 0.14, 0.14, 0.2); put3(o.x, 8.6, -o.y, 5.4, 1, 5.4, 0, 0.2, 0.14, 0.1, 0.2); continue }
    if (o.crate) { put3(o.x, 1.4, -o.y, 2.8, 2.8, 2.8, 0, 0.45, 0.3, 0.12, o.x); put3(o.x, 1.4, -o.y, 3, 0.4, 3, 0, 0.3, 0.2, 0.08, o.x); put3(o.x, 3.1, -o.y, 0.8, 0.5, 0.8, 0, 2.2, 1.8, 0.4, t * 2); continue }
    if (o.rock) { put3(o.x, o.r * 0.5, -o.y, o.r * 2.1, o.r * 1.2, o.r * 1.8, 0, 0.2, 0.2, 0.24, o.x); continue }
    put3(o.x, 1, -o.y, 0.7, 2, 0.7, 0, 0.18, 0.1, 0.06, 0); put3(o.x, 3 * o.h, -o.y, 3.6 * o.h, 2.2, 3.6 * o.h, 0, 0.05, 0.16, 0.07, o.x); put3(o.x, 5 * o.h, -o.y, 2.4 * o.h, 2.2, 2.4 * o.h, 0, 0.05, 0.2, 0.08, o.x + 0.4); put3(o.x, 6.8 * o.h, -o.y, 1.2 * o.h, 1.6, 1.2 * o.h, 0, 0.06, 0.22, 0.09, o.x + 0.8)
  }
  for (const d of vch.flatMap((c) => c.decor)) if (d.fire && near(d.x, d.y)) { put3(d.x, 0.5, -d.y, 3, 0.6, 3, 0, 0.1, 0.08, 0.06, 0); for (let i = 0; i < 4; i++) put3(d.x + Math.sin(t * 9 + i) * 0.5, 1.2 + i * 0.7 + Math.sin(t * 12 + i * 2) * 0.2, -d.y + Math.cos(t * 7 + i) * 0.4, 1.2 - i * 0.2, 0.9, 1.2 - i * 0.2, 0, 2.8, 1.2 + i * 0.4, 0.15, t * 3 + i) }
  // the beam on the ground
  for (const p of HT.players) {
    if (p.down || HT.phase === 'dawn') continue
    const R = lightR(p), H = lightHalf(p)
    for (let i = 0; i < 9; i++) { const f = (i - 4) / 4, a = p.a + f * H, rr = R * (0.55 + 0.45 * (1 - Math.abs(f))); put3(p.x + Math.cos(a) * rr * 0.5, 0.08, -(p.y + Math.sin(a) * rr * 0.5), rr, 0.06, 0.8, 0, 0.5, 0.46, 0.25, a) }
  }
  for (const p of HT.players) drawHunter(api, p, t)
  for (const m of HT.mons) {
    if (!near(m.x, m.y, 4)) continue
    const vis = HT.phase === 'dawn' || HT.players.some((p) => !p.down && lit(p, m.x, m.y))
    drawMon(api, m, t, vis)
  }
  for (const b of HT.bul) { putS(b.x, 3.4, -b.y, 0.9, 0.9, 0.9, 3, 2.6, 1.2); putS(b.x - b.vx * 0.012, 3.4, -(b.y - b.vy * 0.012), 0.6, 0.6, 0.6, 2, 1.6, 0.6) }
  for (const s of HT.spit) putS(s.x, 3, -s.y, 1.6, 1.6, 1.6, 0.6, 2.4, 0.3)
  for (const k of HT.pick) { if (!near(k.x, k.y)) continue; const c = k.k === 'scrap' ? [2.2, 1.8, 0.4] : k.k === 'ammo' ? [1.6, 1.6, 2.2] : [2.4, 0.3, 0.4]; put3(k.x, 1.2 + Math.sin(t * 4 + k.id) * 0.3, -k.y, 1.3, 1.3, 1.3, 0, c[0], c[1], c[2], t * 2) }
  for (const mn of HT.mines) { put3(mn.x, 0.4, -mn.y, 1.8, 0.5, 1.8, 0, 0.3, 0.3, 0.32, 0); put3(mn.x, 0.8, -mn.y, 0.5, 0.4, 0.5, 0, 2.6 * (0.5 + 0.5 * Math.sin(t * 8)), 0.1, 0.1, 0) }
  for (const q of HT.fx) { if (!near(q.x, q.y)) continue; const f = q.life / q.max, s = q.s * (0.3 + 0.7 * f); putS(q.x, q.h, -q.y, s, s, s, q.c[0], q.c[1], q.c[2]) }
}
const hash2 = (a, b) => { let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296 }
if (typeof window !== 'undefined') { window.__HT = HT; window.__hunt = huntActions }
games.hunt = { update, onKey, draw() {}, draw3, camera: () => camHunt(), lights, fog: () => ({ fog: '#02040a', fogNear: 55, fogFar: 125 }), stop, sky: () => '#02040a' }
