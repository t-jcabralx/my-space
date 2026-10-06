// Operation Ground Zero: a Metal Slug-style run & gun. Pure JS; drawing goes through an api passed in by Scene.jsx.
import { G, keys, games, profile, saveProfile, recordScore, boom, ring, part, shake, flash, popup, COLS, stepParticles, toMenu } from './engine.js'
import { SP, rgb } from './sprites.js'
import { sfx, music, speak } from './audio.js'

const GROUND = -20
const R = (a, b) => a + Math.random() * (b - a)
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
const rng = (seed) => { let s = seed; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296 }

export const STAGES = [
  { name: 'JUNGLE OUTPOST', sub: 'Rescue the POWs. Take down the IRON HAWK.', len: 620, boss: 'hawk', diff: 1, color: '#7dffb0', sky: '#06130d', far: '#0f2a1b', near: '#173f27', ground: ['#5a4a2a', '#6b5a34', '#3f8a3f'] },
  { name: 'DESERT FORTRESS', sub: 'The BIG SHIELD tank guards the gate.', len: 720, boss: 'tank', diff: 2, color: '#ffb36b', sky: '#1e1006', far: '#3f250f', near: '#5e3c1c', ground: ['#b88a4a', '#c89a58', '#a07838'] },
  { name: 'OMEGA FACTORY', sub: 'Destroy the MECH WALKER. End the war.', len: 820, boss: 'mech', diff: 3, color: '#ff4de1', sky: '#08081a', far: '#16163a', near: '#262658', ground: ['#3a3a4a', '#4a4a5a', '#2a2a38'] },
]
const BOSS_DEF = {
  hawk: { name: 'IRON HAWK', hp: 110, score: 6000 },
  tank: { name: 'BIG SHIELD', hp: 170, score: 9000 },
  mech: { name: 'MECH WALKER', hp: 260, score: 16000 },
}
const EN = {
  rifle:  { hp: 2,  hw: 2, hh: 4.2, sc: 100, spr: 'sol' },
  runner: { hp: 1,  hw: 2, hh: 4.2, sc: 80,  spr: 'run' },
  gren:   { hp: 2,  hw: 2, hh: 4.2, sc: 150, spr: 'gre' },
  baz:    { hp: 3,  hw: 2, hh: 4.2, sc: 200, spr: 'baz' },
  tank:   { hp: 16, hw: 8, hh: 4.2, sc: 800, spr: 'tank' },
  chop:   { hp: 9,  hw: 6, hh: 2.4, sc: 600, spr: 'chop', fly: true },
}
const WEAPONS = {
  pistol: { name: 'PISTOL',        cd: 0.26 },
  hmg:    { name: 'HEAVY MACHINE', cd: 0.065, ammo: 150 },
  shot:   { name: 'SHOTGUN',       cd: 0.5,   ammo: 30 },
  rocket: { name: 'ROCKET',        cd: 0.6,   ammo: 15 },
}
const CRATE = { M: 'hmg', S: 'shot', R: 'rocket' }

// ---------- state ----------
export const S = {
  mode: 'idle', paused: false, stage: 0, score: 0, lives: 3, cam: 0, t: 0, p: null,
  en: [], bul: [], ebul: [], items: [], pows: [], gren: [], bombs: [], plats: [], spawns: [], si: 0, air: [],
  stats: {}, boss: null, bossState: 'none', toasts: [], banner: null, summary: null, final: null,
  cd: { q: 0, e: 0 }, cdMax: { q: 1, e: 1 }, shT: 0, od: 0, meter: 0, camMax: 0, hi: 0, jumpReq: false, emitT: 0, endT: 0,
}
let snap = null
const subs = new Set()
export const subscribeSlug = (f) => { subs.add(f); return () => subs.delete(f) }
export const getSlugSnap = () => snap
function emitSlug() {
  const p = S.p
  const st = STAGES[S.stage]
  const b = S.boss
  snap = {
    mode: S.mode, paused: S.paused, stage: S.stage, stages: STAGES.length, name: st.name, sub: st.sub, color: st.color,
    score: S.score, hi: Math.max(profile.slugHi, S.score), lives: S.lives, hp: p ? Math.max(0, p.hp) : 0, maxHp: 3,
    weapon: p ? WEAPONS[S.weapon].name : '', ammo: S.weapon === 'pistol' ? -1 : S.ammo, gren: S.gren,
    pows: S.stats.pows || 0, powTotal: S.stats.powTotal || 0, progress: Math.min(1, Math.max(0, S.cam / st.len)),
    boss: b ? { name: b.name, hp: b.hp, max: b.maxhp, enter: b.enter } : null,
    toasts: S.toasts.map((t) => ({ ...t })), banner: S.banner ? { ...S.banner } : null, summary: S.summary, final: S.final,
    skills: [
      { k: 'q', key: 'Q', name: 'AIRSTRIKE', color: '#ffe84a', lv: '', cd: S.cd.q, max: S.cdMax.q, active: S.air.length > 0 },
      { k: 'e', key: 'E', name: 'SHIELD', color: '#3dff7a', lv: '', cd: S.cd.e, max: S.cdMax.e, active: S.shT > 0 },
      { k: 'od', key: 'R', name: 'OVERDRIVE', color: '#ff4de1', lv: '', label: S.od > 0 ? Math.ceil(S.od) + 's' : S.meter >= 100 ? 'READY' : Math.floor(S.meter) + '%', cd: S.od > 0 || S.meter >= 100 ? 0 : 100 - S.meter, max: 100, active: S.od > 0 },
    ],
  }
  subs.forEach((f) => f())
}
const toast = (text, color = '#fff') => { S.toasts.push({ id: ++G.uid, text, color, t: 2.4 }); if (S.toasts.length > 4) S.toasts.shift() }

// ---------- stage generation ----------
function buildStage(i) {
  const st = STAGES[i], r = rng(900 + i * 131)
  const spawns = [], pows = [], plats = []
  const pool = [['rifle', 4], ['runner', 3], ['gren', 2], ['baz', i >= 1 ? 2 : 0.5], ['tank', 1], ['chop', 1.5]]
  for (let x = 70; x < st.len - 50; x += 20 + r() * 16) {
    let list = pool.filter(([t]) => (t !== 'tank' || x > 140) && (t !== 'chop' || x > 110))
    let tot = list.reduce((a, [, w]) => a + w, 0), q = r() * tot, type = 'rifle'
    for (const [t, w] of list) { q -= w; if (q <= 0) { type = t; break } }
    const n = type === 'tank' || type === 'chop' ? 1 : 1 + Math.floor(r() * (1 + st.diff))
    spawns.push({ x, type, n })
  }
  for (let x = 85; x < st.len - 70; x += 90 + r() * 30) pows.push({ x })
  for (let x = 55; x < st.len - 60; x += 55 + r() * 35) plats.push({ x, w: 10 + Math.floor(r() * 10), h: 4 + Math.floor(r() * 4) })
  return { spawns, pows, plats }
}
function groundAt(x, feetPrev) {
  let top = GROUND
  for (const pl of S.plats) {
    if (Math.abs(x - pl.x) < pl.w / 2 + 0.5) { const t = GROUND + pl.h; if (feetPrev >= t - 0.6 && t > top) top = t }
  }
  return top
}
const cy = (e) => e.fy + e.hh

// ---------- lifecycle ----------
function newPlayer() {
  return { x: S.cam - 30, fy: GROUND, vx: 0, vy: 0, hw: 1.9, hh: 4.4, face: 1, ground: true, anim: 0, hp: 3, inv: 2, alive: true, rt: 0, fcd: 0, gcd: 0, aim: 'fwd', crouch: false }
}
function startStage(i, fresh) {
  const gen = buildStage(i)
  G.mode = 'slug'; G.parts = []; G.pops = []; G.shake = 0; G.flash = 0
  Object.assign(S, {
    mode: 'play', paused: false, stage: i, cam: 0, t: 0, en: [], bul: [], ebul: [], items: [], gren: [], bombs: [], air: [],
    plats: gen.plats, spawns: gen.spawns, si: 0, boss: null, bossState: 'none', summary: null, final: null, banner: null, toasts: [],
    camMax: STAGES[i].len, shT: 0, od: 0, jumpReq: false, endT: 0, weapon: 'pistol', ammo: 0, cd: { q: 0, e: 0 }, meter: Math.min(S.meter || 0, 30),
  })
  if (fresh) { S.score = 0; S.lives = 3; S.gren = 8 }
  S.gren = Math.max(S.gren || 0, 6)
  S.pows = gen.pows.map((p) => ({ x: p.x, fy: GROUND, hw: 2, hh: 4.5, state: 'tied', t: 0, vx: 0 }))
  S.stats = { kills: 0, total: gen.spawns.reduce((a, s) => a + s.n, 0), pows: 0, powTotal: gen.pows.length, dmg: 0, time: 0, bossKilled: false }
  S.p = newPlayer(); S.p.x = -30
  const st = STAGES[i]
  S.banner = { title: 'STAGE ' + (i + 1), sub: st.name, sub2: st.sub.toUpperCase(), kind: 'intro', t: 3.2 }
  music.set('slug', i); sfx('mission'); speak('Mission start'); emitSlug()
}
function start(i = 0) { profile.played++; S.meter = 0; startStage(i, true) }
function stop() { S.mode = 'idle'; S.paused = false; music.set('menu'); emitSlug() }

// ---------- combat helpers ----------
function hurtP(d = 1) {
  const p = S.p
  if (!p.alive || p.inv > 0 || S.shT > 0 || S.od > 0 || S.mode !== 'play') return
  p.hp -= d; p.inv = 1.6; S.stats.dmg++
  shake(1.6); flash(0.4, [1, 0.15, 0.15]); sfx('hurt'); boom(p.x, cy(p), 14, 30, COLS.fire)
  if (p.hp <= 0) {
    p.alive = false; S.lives--; S.weapon = 'pistol'
    boom(p.x, cy(p), 50, 55, COLS.fire, 1.3); ring(p.x, cy(p), 30, 45, COLS.fire); sfx('bigBoom'); shake(3)
    if (S.lives <= 0) { S.endT = 2.2 } else p.rt = 1.6
  }
}
function blast(x, y, r, dmg, team) {
  boom(x, y, 22, 42, COLS.fire, 1.3); ring(x, y, 22, 42, COLS.fire); sfx('boom'); shake(0.8)
  if (team === 'p') {
    for (const e of S.en) if (!e.dead && Math.hypot(e.x - x, cy(e) - y) < r + e.hw) hurtE(e, dmg)
    const b = S.boss
    if (b && !b.dying && !b.enter && Math.hypot(b.x - x, cy(b) - y) < r + b.hw) hurtBoss(dmg)
  } else {
    const p = S.p
    if (p.alive && Math.hypot(p.x - x, cy(p) - y) < r + 1.5) hurtP(1)
  }
}
function drop(x, fy) {
  const t = ['M', 'S', 'R', 'B', 'H'][(Math.random() * 5) | 0]
  S.items.push({ x, fy, t, hw: 2.5, hh: 3.5, life: 14 })
}
function hurtE(e, d) {
  if (e.dead) return
  e.hp -= d; e.flash = 0.07
  part(e.x, cy(e), R(-15, 15), R(5, 25), 0.3, COLS.fire[2], 1)
  if (e.hp <= 0) killE(e); else sfx('hit')
}
function killE(e) {
  e.dead = true
  const d = EN[e.type], big = e.hp !== undefined && e.maxhp >= 9
  boom(e.x, cy(e), big ? 40 : 14, big ? 50 : 30, COLS.fire, big ? 1.4 : 1)
  if (big) { ring(e.x, cy(e), 28, 45, COLS.fire); shake(1.6) }
  sfx(big ? 'bigBoom' : 'boom')
  S.score += d.sc; profile.kills++; S.stats.kills++; S.meter = Math.min(100, S.meter + (big ? 14 : 4))
  if (G.pops.length < 12) popup(e.x, cy(e) + 3, String(d.sc))
  if (big || Math.random() < 0.1) drop(e.x, e.fly ? GROUND : e.fy)
}
function ebullet(x, y, ang, sp, spr = 'orbR', extra) {
  if (S.ebul.length > 220) return
  sfx('eshot')
  const s = SP[spr]
  S.ebul.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, spr: s, hw: s.hw * 0.6, hh: s.hh * 0.6, t: 0, ...extra })
}

// ---------- player actions ----------
function shoot() {
  const p = S.p
  const od = S.od > 0
  const wname = od ? 'hmg' : S.weapon
  const w = WEAPONS[wname]
  p.fcd = w.cd * (od ? 0.8 : 1)
  const up = p.aim === 'up', down = p.aim === 'down'
  const dx = up || down ? (keys.ArrowRight || keys.KeyD || keys.ArrowLeft || keys.KeyA ? p.face * 0.55 : 0) : p.face
  const dy = up ? (dx ? 0.8 : 1) : down ? -1 : 0
  const ang = Math.atan2(dy, dx || (dy === 0 ? p.face : 0))
  const mx = p.x + Math.cos(ang) * 5, my = cy(p) + (p.crouch ? -1.5 : 0.8) + Math.sin(ang) * 5
  const mk = (a, sp, dmg, o = {}) => S.bul.push({ x: mx, y: my, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, spr: o.spr || SP.sb, hw: 1.2, hh: 0.9, dmg, life: o.life || 1.2, rocket: !!o.rocket, t: 0 })
  if (wname === 'pistol') { mk(ang, 75, 1); sfx('pistol') }
  else if (wname === 'hmg') { mk(ang + R(-0.05, 0.05), 90, od ? 2 : 1); sfx('hmg') }
  else if (wname === 'shot') { for (let i = 0; i < 6; i++) mk(ang + (i - 2.5) * 0.1, R(60, 80), 1.2, { life: 0.3 }); sfx('shotgun') }
  else if (wname === 'rocket') { mk(ang, 50, 5, { spr: SP.pbM, rocket: true }); sfx('rocketLaunch') }
  if (!od && wname !== 'pistol') { S.ammo--; if (S.ammo <= 0) { S.weapon = 'pistol'; toast('OUT OF AMMO', '#ff8a96'); sfx('reload') } }
  part(mx, my, Math.cos(ang) * 20, Math.sin(ang) * 20, 0.1, COLS.fire[1], 0.9)
}
function throwGren() {
  const p = S.p
  if (S.gren <= 0 || p.gcd > 0 || !p.alive) return
  S.gren--; p.gcd = 0.4
  S.gren_ = null
  S.bombs.push({ x: p.x + p.face * 2, y: cy(p) + 2, vx: p.face * 26 + p.vx * 0.5, vy: 30, spr: SP.gr, hw: 1.2, hh: 1.2, team: 'p', g: 70, t: 0, r: 9, dmg: 6 })
  sfx('throw')
}
function airstrike() {
  if (S.cd.q > 0 || S.mode !== 'play' || !S.p.alive) return
  S.cd.q = S.cdMax.q = 18; profile.skills++
  for (let i = 0; i < 11; i++) S.air.push({ delay: i * 0.1, x: S.cam - 44 + i * 8.8 + R(-2, 2) })
  sfx('alarm'); speak('Airstrike inbound'); toast('AIRSTRIKE INBOUND!', '#ffe84a')
}
function shield() {
  if (S.cd.e > 0 || S.mode !== 'play' || !S.p.alive) return
  S.shT = 4; S.cd.e = S.cdMax.e = 18; profile.skills++
  sfx('shield'); ring(S.p.x, cy(S.p), 36, 45, COLS.green)
}
function overdrive() {
  if (S.od > 0 || S.meter < 100 || S.mode !== 'play' || !S.p.alive) return
  S.od = 7; S.meter = 0; profile.skills++
  sfx('overdrive'); shake(2.2); flash(0.7, [1, 0.5, 1]); ring(S.p.x, cy(S.p), 50, 70, COLS.purple)
  speak('Overdrive!'); toast('OVERDRIVE!  MAX FIREPOWER', '#ff4de1')
}

// ---------- enemies ----------
function spawnEnemy(type, x) {
  const d = EN[type]
  const hp = Math.ceil(d.hp * (1 + (STAGES[S.stage].diff - 1) * 0.2))
  const e = { kind: 'e', type, x, fy: d.fly ? R(14, 20) : GROUND, hw: d.hw, hh: d.hh, hp, maxhp: hp, vy: 0, t: 0, flash: 0, face: -1, anim: Math.random() * 4, cd: R(0.8, 2), off: R(0, 22), ground: true, spr: SP[d.spr] }
  S.en.push(e)
  return e
}
function stepEnemies(dt) {
  const p = S.p, diff = STAGES[S.stage].diff
  for (const e of S.en) {
    if (e.dead) continue
    e.t += dt; e.flash = Math.max(0, e.flash - dt)
    e.face = p.x < e.x ? -1 : 1
    const bs = 20 + diff * 2.5
    const dxp = p.x - e.x
    const walk = (sp) => { e.x -= sp * dt; e.anim += dt * 9 }
    switch (e.type) {
      case 'rifle': {
        const want = S.cam + 14 + e.off
        if (e.x > want) walk(13)
        e.cd -= dt
        if (e.cd < 0 && Math.abs(e.x - S.cam) < 50) { e.cd = R(1.4, 2.2); ebullet(e.x + e.face * 3, cy(e) + 1, Math.atan2(cy(p) - cy(e), dxp), bs + 4, 'orbY'); sfx('hit') }
        break
      }
      case 'runner':
        e.x += Math.sign(dxp) * (24 + diff * 3) * dt; e.anim += dt * 14
        if (e.ground && Math.abs(dxp) < 14 && Math.random() < dt * 1.5) { e.vy = 36; e.ground = false }
        break
      case 'gren':
        if (e.x > S.cam + 26 + e.off) walk(12)
        e.cd -= dt
        if (e.cd < 0 && Math.abs(e.x - S.cam) < 50) {
          e.cd = R(2, 3)
          const T = 1.2, g = 60, dx = dxp, dy = cy(p) - cy(e)
          S.bombs.push({ x: e.x, y: cy(e) + 3, vx: dx / T, vy: (dy + 0.5 * g * T * T) / T, spr: SP.gr, hw: 1.2, hh: 1.2, team: 'e', g, t: 0, r: 6, dmg: 1 })
        }
        break
      case 'baz':
        if (e.x > S.cam + 34 + e.off * 0.5) walk(11)
        e.cd -= dt
        if (e.cd < 0 && Math.abs(e.x - S.cam) < 50) { e.cd = R(2.6, 3.6); ebullet(e.x - 3, cy(e) + 1, Math.PI, 20, 'missile', { rocket: true }); sfx('missile') }
        break
      case 'tank':
        if (e.x > S.cam + 30) walk(7); else e.fy = GROUND + Math.sin(e.t * 6) * 0.15
        e.cd -= dt
        if (e.cd < 0 && Math.abs(e.x - S.cam) < 52) {
          e.cd = 2.2
          ebullet(e.x - 9, cy(e) + 2, Math.atan2(cy(p) - cy(e), dxp), 30, 'big', { rocket: true }); sfx('missile')
          for (let i = -1; i <= 1; i++) ebullet(e.x - 9, cy(e) + 3, Math.atan2(cy(p) - cy(e), dxp) + i * 0.15, 26, 'orbR')
        }
        break
      case 'chop':
        e.x += (clamp(p.x + 16 + Math.sin(e.t * 0.8) * 14, S.cam - 30, S.cam + 44) - e.x) * Math.min(1, dt * 0.9)
        e.fy = 15 + Math.sin(e.t * 1.7) * 3
        e.rot = (e.rot || 0) - dt
        if (e.rot < 0) { e.rot = 0.16; if (Math.abs(e.x - S.cam) < 55) sfx('rotor') }
        e.cd -= dt
        if (e.cd < 0 && Math.abs(e.x - S.cam) < 50) {
          e.cd = 1.5; ebullet(e.x, cy(e) - 1, Math.atan2(cy(p) - cy(e), dxp), bs + 4, 'orbR'); ebullet(e.x, cy(e) - 1, Math.atan2(cy(p) - cy(e), dxp) + 0.2, bs + 4, 'orbR')
        }
        if (Math.abs(dxp) < 10) { e.bomb = (e.bomb ?? 2.5) - dt; if (e.bomb < 0) { e.bomb = 3; S.bombs.push({ x: e.x, y: cy(e) - 2, vx: 0, vy: -5, spr: SP.bm, hw: 1.2, hh: 1.5, team: 'e', g: 40, t: 0, r: 7, dmg: 1 }) } }
        break
    }
    if (!EN[e.type].fly) {
      e.vy -= 130 * dt; e.fy += e.vy * dt
      const g = groundAt(e.x, 999)
      if (e.fy <= g) { e.fy = g; e.vy = 0; e.ground = true }
    }
    if (e.x < S.cam - 75) e.dead = true
  }
}

// ---------- bosses ----------
function spawnBoss() {
  const st = STAGES[S.stage], d = BOSS_DEF[st.boss]
  const spr = st.boss === 'hawk' ? SP.chop : st.boss === 'tank' ? SP.tank : SP.mech
  const sc = st.boss === 'hawk' ? 2.2 : st.boss === 'tank' ? 1.7 : 1.7
  S.boss = {
    kind: 'b', id: st.boss, name: d.name, x: S.cam + 80, fy: st.boss === 'hawk' ? 12 : GROUND, hw: spr.hw * sc * 0.8, hh: spr.hh * sc * 0.8, hp: d.hp, maxhp: d.hp,
    spr, sc, t: 0, flash: 0, enter: true, tm: {}, dying: false, face: -1,
  }
  S.bossState = 'fight'; music.set('slugboss', S.stage); sfx('roar')
}
function hurtBoss(d) {
  const b = S.boss
  if (!b || b.dying || b.enter) { sfx('deflect'); return }
  b.hp -= d; b.flash = 0.04; sfx('bossHit'); S.score += 5; S.meter = Math.min(100, S.meter + 0.3)
  if (b.hp <= 0) {
    b.hp = 0; b.dying = true; b.dieT = 3; S.ebul.length = 0; S.bombs = S.bombs.filter((x) => x.team === 'p')
    toast(b.name + ' DESTROYED!', '#ffe84a'); sfx('bigBoom'); flash(0.7); S.stats.bossKilled = true; profile.bosses++
  }
}
function stepBoss(dt) {
  const b = S.boss, p = S.p
  if (!b) return
  b.t += dt; b.flash = Math.max(0, b.flash - dt)
  if (b.dying) {
    b.dieT -= dt
    if (Math.random() < 0.8) boom(b.x + R(-b.hw, b.hw), cy(b) + R(-b.hh, b.hh), 14, 40, COLS.fire, 1.3)
    if (Math.random() < 0.25) sfx('boom')
    shake(1.2)
    if (b.dieT <= 0) {
      boom(b.x, cy(b), 120, 90, COLS.fire, 1.6); ring(b.x, cy(b), 70, 90, COLS.fire); flash(1); shake(5); sfx('bigBoom')
      S.score += BOSS_DEF[b.id].score; popup(b.x, cy(b), String(BOSS_DEF[b.id].score), [1, 0.9, 0.3])
      for (let i = 0; i < 4; i++) drop(b.x + R(-12, 12), GROUND)
      S.boss = null; S.bossState = 'done'; S.endT = 3.2
      music.stop()
    }
    return
  }
  if (b.enter) { b.x -= 24 * dt; if (b.x <= S.cam + 30) b.enter = false; return }
  const f = b.hp / b.maxhp, ph2 = f < 0.5
  const tk = (k, iv) => { b.tm[k] = (b.tm[k] ?? iv) - dt; if (b.tm[k] <= 0) { b.tm[k] += iv; return true } return false }
  const aimA = () => Math.atan2(cy(p) - cy(b), p.x - b.x)
  const diff = STAGES[S.stage].diff, bs = 22 + diff * 2
  if (b.id === 'hawk') {
    b.x = S.cam + 26 + Math.sin(b.t * (ph2 ? 0.9 : 0.6)) * 18; b.fy = 10 + Math.sin(b.t * 1.3) * 4
    if (tk('gun', ph2 ? 0.8 : 1.2)) for (let i = -1; i <= 1; i++) ebullet(b.x - 8, cy(b) - 2, aimA() + i * 0.22, bs + 6, 'orbR')
    if (tk('bomb', ph2 ? 2.4 : 3.6)) for (let i = 0; i < 4; i++) S.bombs.push({ x: b.x - 6 + i * 4, y: cy(b) - 4, vx: -4 - i * 2, vy: -4, spr: SP.bm, hw: 1.2, hh: 1.5, team: 'e', g: 40, t: 0, r: 7, dmg: 1 })
    if (ph2 && tk('rk', 3)) ebullet(b.x - 10, cy(b) - 3, aimA(), 24, 'missile', { rocket: true })
  } else if (b.id === 'tank') {
    b.x = S.cam + 32 + Math.sin(b.t * 0.35) * 10
    if (tk('shell', ph2 ? 1.6 : 2.3)) { ebullet(b.x - 12, cy(b) + 3, aimA(), 32, 'big', { rocket: true }); sfx('missile') }
    if (tk('mg', 0.9)) for (let i = -1; i <= 1; i++) ebullet(b.x - 12, cy(b) + 5, aimA() + i * 0.14, bs + 4, 'orbR')
    if (ph2 && tk('run', 5)) { spawnEnemy('runner', S.cam + 54); spawnEnemy('runner', S.cam + 60) }
  } else {
    b.x = S.cam + 30 + Math.sin(b.t * 0.5) * 8; b.fy = GROUND + Math.abs(Math.sin(b.t * 3)) * 0.8
    if (tk('plasma', ph2 ? 1.0 : 1.5)) for (let i = -2; i <= 2; i++) ebullet(b.x - 8, cy(b) + 6, aimA() + i * 0.18, bs + 6, 'orbP')
    if (tk('wave', ph2 ? 3 : 4.2)) { ebullet(b.x - 8, GROUND + 2, Math.PI, 30, 'big', { wave: true }); sfx('bigBoom'); shake(1.2) }
    if (tk('rain', ph2 ? 3 : 4.5)) for (let i = 0; i < (ph2 ? 6 : 4); i++) S.bombs.push({ x: p.x + R(-18, 18), y: 36 + i * 3, vx: 0, vy: -10, spr: SP.bm, hw: 1.2, hh: 1.5, team: 'e', g: 30, t: 0, r: 7, dmg: 1 })
    if (ph2 && tk('add', 6)) spawnEnemy('rifle', S.cam + 54)
  }
}

// ---------- main step ----------
function play(dt) {
  const p = S.p, st = STAGES[S.stage]
  S.t += dt; S.stats.time += dt
  for (const k of ['q', 'e']) S.cd[k] = Math.max(0, S.cd[k] - dt)
  S.shT = Math.max(0, S.shT - dt); S.od = Math.max(0, S.od - dt)
  p.inv = Math.max(0, p.inv - dt); p.fcd -= dt; p.gcd -= dt

  // player
  if (!p.alive) {
    p.rt -= dt
    if (p.rt <= 0 && S.lives > 0 && !S.endT) { Object.assign(p, { alive: true, hp: 3, inv: 3, x: S.cam - 26, fy: GROUND + 20, vy: 0 }); S.shT = 2 }
  } else {
    const ax = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0)
    const up = keys.ArrowUp || keys.KeyW, down = keys.ArrowDown || keys.KeyS
    p.crouch = !!down && p.ground
    p.hh = p.crouch ? 3 : 4.4
    if (ax) p.face = ax
    const spd = p.crouch ? 0 : S.od > 0 ? 30 : 23
    p.vx = ax * spd
    p.x += p.vx * dt
    for (const pl of S.plats) {
      if (p.fy < GROUND + pl.h - 0.8 && Math.abs(p.x - pl.x) < pl.w / 2 + p.hw) p.x = p.x < pl.x ? pl.x - pl.w / 2 - p.hw : pl.x + pl.w / 2 + p.hw
    }
    p.x = clamp(p.x, S.cam - 47, S.cam + 47)
    if (S.jumpReq && p.ground) { p.vy = 48; p.ground = false; sfx('jump') }
    S.jumpReq = false
    const prev = p.fy
    p.vy -= 130 * dt; p.fy += p.vy * dt
    const g = groundAt(p.x, prev)
    if (p.fy <= g && p.vy <= 0) { if (!p.ground && p.vy < -25) sfx('land'); p.fy = g; p.vy = 0; p.ground = true } else p.ground = false
    p.aim = up ? 'up' : down && !p.ground ? 'down' : 'fwd'
    p.anim += dt * (ax && p.ground ? 11 : 0)
    if (ax && p.ground) { const f = Math.floor(p.anim) & 1; if (f !== p.lf) { p.lf = f; sfx('step') } }
    if ((keys.KeyJ || keys.KeyZ || keys.KeyX) && p.fcd <= 0) shoot()
    if (Math.random() < 0.5 && S.od > 0) part(p.x + R(-3, 3), cy(p) + R(-4, 4), R(-10, 10), R(5, 20), 0.4, COLS.purple[1], 1.1)
  }

  // camera
  if (!S.boss && S.bossState === 'none') S.cam = clamp(Math.max(S.cam, p.x + 12), 0, S.camMax)
  // spawns
  while (S.si < S.spawns.length && S.cam + 58 >= S.spawns[S.si].x) {
    const ev = S.spawns[S.si++]
    for (let i = 0; i < ev.n; i++) spawnEnemy(ev.type, ev.x + i * 6)
  }
  if (S.bossState === 'none' && S.cam >= st.len - 2 && S.en.every((e) => e.dead || e.x > S.cam + 60 || true)) {
    S.bossState = 'warn'; S.warnT = 3.2
    S.banner = { title: 'WARNING', sub: BOSS_DEF[st.boss].name + ' APPROACHING', kind: 'warn', t: 3.2 }
    sfx('alarm'); speak('Warning!'); music.set('slugboss', S.stage)
  }
  if (S.bossState === 'warn') { S.warnT -= dt; if (S.warnT <= 0) spawnBoss() }

  // airstrike
  for (const a of S.air) {
    a.delay -= dt
    if (a.delay <= 0 && !a.done) { a.done = true; sfx('whistle'); S.bombs.push({ x: a.x, y: 36, vx: 0, vy: -50, spr: SP.bm, hw: 1.2, hh: 1.5, team: 'p', g: 60, t: 0, r: 9, dmg: 8 }) }
  }
  S.air = S.air.filter((a) => !a.done)

  stepEnemies(dt); stepBoss(dt)

  // bullets
  for (const b of S.bul) {
    b.t += dt; b.x += b.vx * dt; b.y += b.vy * dt
    if (b.t > b.life || Math.abs(b.x - S.cam) > 60 || b.y > 40 || b.y < GROUND - 3) { b.dead = true; if (b.rocket && b.y <= GROUND) blast(b.x, GROUND, 8, 4, 'p') }
    if (b.dead) continue
    for (const pl of S.plats) if (Math.abs(b.x - pl.x) < pl.w / 2 && b.y < GROUND + pl.h) { b.dead = true; part(b.x, b.y, 0, 0, 0.15, COLS.fire[1], 1.2); break }
    if (b.dead) continue
    for (const e of S.en) {
      if (e.dead || Math.abs(b.x - e.x) > e.hw + b.hw || Math.abs(b.y - cy(e)) > e.hh + b.hh) continue
      b.dead = true; hurtE(e, b.dmg); if (b.rocket) blast(b.x, b.y, 8, 4, 'p'); break
    }
    const bo = S.boss
    if (!b.dead && bo && !bo.dying && Math.abs(b.x - bo.x) < bo.hw + b.hw && Math.abs(b.y - cy(bo)) < bo.hh + b.hh) { b.dead = true; hurtBoss(b.dmg); if (b.rocket) blast(b.x, b.y, 8, 4, 'p') }
  }
  for (const b of S.ebul) {
    b.t += dt; b.x += b.vx * dt; b.y += b.vy * dt
    if (b.wave) b.y = GROUND + 1.5
    if (Math.abs(b.x - S.cam) > 62 || b.y > 42 || b.y < GROUND - 3) { b.dead = true; continue }
    if (b.rocket && b.y <= GROUND + 0.5) { b.dead = true; blast(b.x, GROUND, 6, 1, 'e'); continue }
    if (S.shT > 0 && Math.hypot(b.x - p.x, b.y - cy(p)) < 8) { b.dead = true; part(b.x, b.y, 0, 0, 0.15, COLS.green[1], 1.4); continue }
    if (p.alive && Math.abs(b.x - p.x) < p.hw + b.hw && Math.abs(b.y - cy(p)) < p.hh + b.hh) { b.dead = true; if (b.rocket) blast(b.x, b.y, 6, 1, 'e'); else hurtP(1) }
    else for (const pl of S.plats) if (Math.abs(b.x - pl.x) < pl.w / 2 && b.y < GROUND + pl.h && !b.wave) { b.dead = true; break }
  }
  for (const g of S.bombs) {
    g.t += dt; g.vy -= g.g * dt; g.x += g.vx * dt; g.y += g.vy * dt
    const gnd = groundAt(g.x, 999)
    let hitE = false
    if (g.team === 'p') {
      for (const e of S.en) if (!e.dead && Math.abs(g.x - e.x) < e.hw + 1.2 && Math.abs(g.y - cy(e)) < e.hh + 1.2) hitE = true
      const bo = S.boss
      if (bo && !bo.dying && Math.abs(g.x - bo.x) < bo.hw + 1.2 && Math.abs(g.y - cy(bo)) < bo.hh + 1.2) hitE = true
    } else if (p.alive && Math.abs(g.x - p.x) < p.hw + 1.2 && Math.abs(g.y - cy(p)) < p.hh + 1.2) hitE = true
    if (g.y <= gnd + 1 || hitE) { g.dead = true; blast(g.x, Math.max(g.y, gnd + 1), g.r, g.dmg, g.team) }
  }
  // player contact
  if (p.alive) for (const e of S.en) {
    if (e.dead || Math.abs(p.x - e.x) > p.hw + e.hw - 0.5 || Math.abs(cy(p) - cy(e)) > p.hh + e.hh - 0.5) continue
    if (e.type === 'runner') { hurtP(1); killE(e) } else if (e.type === 'tank' || e.type === 'chop') hurtP(1)
  }
  // items
  for (const it of S.items) {
    it.life -= dt
    const g = groundAt(it.x, 999); it.fy = g
    if (it.life <= 0) it.dead = true
    if (p.alive && Math.abs(p.x - it.x) < p.hw + it.hw && Math.abs(cy(p) - (it.fy + it.hh)) < p.hh + it.hh) {
      it.dead = true; sfx('pickup'); ring(it.x, it.fy + 3, 16, 25, COLS.green)
      if (CRATE[it.t]) { S.weapon = CRATE[it.t]; S.ammo = WEAPONS[S.weapon].ammo; toast(WEAPONS[S.weapon].name + '!', '#ffe84a'); sfx('reload'); speak({ hmg: 'Heavy machine gun!', shot: 'Shotgun!', rocket: 'Rocket launcher!' }[S.weapon]) }
      else if (it.t === 'B') { S.gren = Math.min(20, S.gren + 6); toast('+6 GRENADES', '#ff4de1') }
      else { p.hp = Math.min(3, p.hp + 1); toast('MEDKIT +1 HP', '#ff7ab0') }
    }
  }
  // POWs
  for (const w of S.pows) {
    w.t += dt
    const g = groundAt(w.x, 999)
    if (w.state === 'tied') {
      w.fy = g
      if (p.alive && Math.abs(p.x - w.x) < p.hw + w.hw + 1 && Math.abs(cy(p) - (w.fy + w.hh)) < p.hh + w.hh) {
        w.state = 'free'; w.vx = 18; S.stats.pows++; profile.pows++; S.score += 500
        popup(w.x, w.fy + 8, '500', [0.4, 1, 0.6]); toast('POW RESCUED!  +500', '#3dff7a'); sfx('rescue'); speak('Thank you!', 1.4, 1.1)
        const t = ['M', 'S', 'R', 'B'][(Math.random() * 4) | 0]; S.items.push({ x: w.x + 2, fy: g, t, hw: 2.5, hh: 3.5, life: 14 })
      }
    } else { w.x += w.vx * dt; w.fy = groundAt(w.x, 999) }
    if (w.x < S.cam - 70 || w.x > S.cam + 80) w.dead = true
  }
  S.en = S.en.filter((e) => !e.dead); S.bul = S.bul.filter((b) => !b.dead); S.ebul = S.ebul.filter((b) => !b.dead)
  S.bombs = S.bombs.filter((b) => !b.dead); S.items = S.items.filter((b) => !b.dead); S.pows = S.pows.filter((b) => !b.dead)
  stepParticles(dt)
  for (const t of S.toasts) t.t -= dt
  S.toasts = S.toasts.filter((t) => t.t > 0)
  if (S.banner) { S.banner.t -= dt; if (S.banner.t <= 0) S.banner = null }
  // endings
  if (S.endT > 0) {
    S.endT -= dt
    if (S.endT <= 0) {
      S.endT = 0
      if (S.bossState === 'done') finishStage()
      else { S.mode = 'over'; recordScore('slug', S.score); music.stop(); sfx('over'); speak('Mission failed'); emitSlug() }
    }
  }
}

function finishStage() {
  const st = S.stats, rate = st.total ? Math.min(1, st.kills / st.total) : 1
  const lines = []
  const kb = Math.round(rate * 2000), pb = st.pows * 1000, nb = st.dmg === 0 ? 3000 : 0
  lines.push({ label: `ENEMIES DESTROYED  ${st.kills}/${st.total}`, value: '+' + kb, kind: 'score' })
  lines.push({ label: `POWs RESCUED  ${st.pows}/${st.powTotal}`, value: '+' + pb, kind: 'bonus' })
  if (nb) lines.push({ label: 'FLAWLESS - NO DAMAGE', value: '+' + nb, kind: 'bonus' })
  S.score += kb + pb + nb
  const grade = nb && rate > 0.85 ? 'S' : rate > 0.85 ? 'A' : rate > 0.6 ? 'B' : 'C'
  S.summary = { lines, grade, name: STAGES[S.stage].name, final: S.stage === STAGES.length - 1 }
  if (S.summary.final) {
    const lb = S.lives * 3000; S.score += lb
    S.final = { score: S.score, lifeB: lb, rank: S.score > 120000 ? 'S' : S.score > 80000 ? 'A' : S.score > 45000 ? 'B' : 'C' }
    S.mode = 'victory'; profile.slugWins++; recordScore('slug', S.score); sfx('win'); speak('Mission accomplished')
  } else { S.mode = 'clear'; sfx('clear'); speak('Mission complete') }
  music.set('menu'); saveProfile(); emitSlug()
}

function update(dtRaw) {
  const dt = Math.min(dtRaw, 0.05)
  if (S.mode === 'idle') return
  if (!S.paused && S.mode === 'play') play(dt)
  else if (!S.paused) stepParticles(dt)
  S.emitT -= dt
  if (S.emitT <= 0) { S.emitT = 0.07; emitSlug() }
}

function onKey(code) {
  if (S.mode === 'idle') return
  if (code === 'Escape' || code === 'KeyP') { if (S.mode === 'play') { S.paused = !S.paused; sfx('ui'); emitSlug() } return }
  if (S.paused) { if (code === 'Enter') { S.paused = false; emitSlug() } return }
  if (S.mode === 'play') {
    if (code === 'Space' || code === 'KeyK' || code === 'KeyC') S.jumpReq = true
    else if (code === 'KeyG' || code === 'KeyL') throwGren()
    else if (code === 'KeyQ' || code === 'Digit1') airstrike()
    else if (code === 'KeyE' || code === 'Digit2') shield()
    else if (code === 'KeyR' || code === 'Digit3') overdrive()
  } else if (code === 'Enter') {
    if (S.mode === 'clear') startStage(S.stage + 1, false)
    else if (S.mode === 'over') retry()
    else if (S.mode === 'victory') quit()
  }
}
function retry() { S.lives = 3; S.score = Math.max(0, S.score); startStage(S.stage, false); S.lives = 3 }
function next() { startStage(S.stage + 1, false) }
function quit() { toMenu() }
export const slugActions = { start, retry, next, quit, resume() { S.paused = false; emitSlug() }, skill(k) { if (k === 'q') airstrike(); else if (k === 'e') shield(); else overdrive() } }

// ---------- rendering (called from Scene.jsx with drawing primitives) ----------
const colCache = {}
const lc = (hex) => colCache[hex] || (colCache[hex] = rgb(hex))
const hash = (x) => Math.abs(Math.sin(x * 12.9898) * 43758.5453) % 1
function draw(api) {
  const { put, sprite } = api
  const st = STAGES[S.stage], cam = S.cam, t = G.time
  // parallax silhouettes
  const far = lc(st.far), near = lc(st.near)
  for (let sx = -56; sx <= 56; sx += 2) {
    const wx = sx + cam * 0.25
    const h = 7 + 6 * Math.sin(wx * 0.07) + 3 * Math.sin(wx * 0.21 + 1)
    for (let y = GROUND; y < GROUND + h; y += 2) put(sx, y, -6, 2.05, 2.05, far[0] * 1.2, far[1] * 1.2, far[2] * 1.2)
  }
  for (let sx = -56; sx <= 56; sx += 2) {
    const wx = sx + cam * 0.55
    const h = 3 + 3 * Math.sin(wx * 0.13 + 2) + 2 * Math.sin(wx * 0.37)
    for (let y = GROUND; y < GROUND + h; y += 2) put(sx, y, -3, 2.05, 2.05, near[0] * 1.4, near[1] * 1.4, near[2] * 1.4)
  }
  // ground
  for (let sx = -54; sx <= 54; sx += 1) {
    const wx = Math.floor(sx + cam)
    const r = hash(wx)
    const c0 = lc(st.ground[r > 0.5 ? 0 : 1]), c1 = lc(st.ground[2])
    put(sx, GROUND - 0.5, 0, 1.02, 1.02, c1[0], c1[1], c1[2])
    put(sx, GROUND - 1.5, 0, 1.02, 1.02, c0[0], c0[1], c0[2])
    put(sx, GROUND - 2.5, 0, 1.02, 1.02, c0[0] * 0.7, c0[1] * 0.7, c0[2] * 0.7)
    put(sx, GROUND - 3.5, 0, 1.02, 1.02, c0[0] * 0.5, c0[1] * 0.5, c0[2] * 0.5)
  }
  // platforms (sandbag walls)
  for (const pl of S.plats) {
    const sx = pl.x - cam
    if (sx < -60 || sx > 60) continue
    for (let x = -pl.w / 2; x < pl.w / 2; x += 1) for (let y = 0; y < pl.h; y += 1) {
      const c = lc(((Math.floor(x) + y) & 1) ? '#c8a860' : '#a88848')
      put(sx + x + 0.5, GROUND + y + 0.5, 0.2, 1.02, 1.02, c[0] * 1.3, c[1] * 1.3, c[2] * 1.3)
    }
  }
  // items & pows
  for (const it of S.items) sprite(SP['pup' + it.t], it.x - cam, it.fy + 3.5 + Math.sin(t * 4) * 0.6, { k: 1.4 })
  for (const w of S.pows) sprite(SP.pow, w.x - cam, w.fy + 4.5, { sx: w.state === 'free' ? 1 : -1, k: 1.1 })
  // enemies
  for (const e of S.en) {
    if (e.dead) continue
    if (e.type === 'tank') sprite(e.spr, e.x - cam, cy(e) + 0.3, { sx: e.face > 0 ? -1 : 1, flash: e.flash > 0, k: 1.15 })
    else if (e.type === 'chop') {
      sprite(e.spr, e.x - cam, cy(e), { sx: e.face > 0 ? -1 : 1, flash: e.flash > 0, k: 1.15 })
      for (let i = -8; i <= 8; i++) if (Math.floor(t * 40 + i) % 3) put(e.x - cam + i, cy(e) + 3.4, 0, 1, 0.5, 1.1, 1.1, 1.1)
    } else {
      const fr = Math.floor(e.anim) & 1
      const key = EN[e.type].spr
      sprite(fr ? SP[key + '2'] : SP[key], e.x - cam, cy(e), { sx: e.face, flash: e.flash > 0, k: 1.2 })
      if (e.type === 'baz') for (let i = 0; i < 7; i++) put(e.x - cam + e.face * (2 + i * 0.9), cy(e) + 1.5, 0, 1, 1, 0.3, 0.45, 0.3)
    }
  }
  const b = S.boss
  if (b) sprite(b.spr, b.x - cam, cy(b), { sx: -1 * (b.sc || 1), scale: b.sc, flash: b.flash > 0, k: 1.2 })
  if (b && b.id === 'hawk') for (let i = -14; i <= 14; i++) if (Math.floor(t * 40 + i) % 3) put(b.x - cam + i, cy(b) + 6.8, 0, 1, 0.7, 1.1, 1.1, 1.1)
  // player
  const p = S.p
  if (p && p.alive && !(p.inv > 0 && Math.floor(t * 18) % 2 === 0 && S.shT <= 0)) {
    const fr = p.ground ? Math.floor(p.anim) & 1 : 1
    const sy = p.crouch ? 0.7 : 1
    const px = p.x - cam, pcy = p.fy + 4.5 * sy
    sprite(fr ? SP.hero2 : SP.hero, px, pcy, { sx: p.face, sy, k: 1.25 })
    // gun
    const wn = S.od > 0 ? 'hmg' : S.weapon
    const len = wn === 'pistol' ? 2 : wn === 'rocket' ? 6 : 5
    const gc = wn === 'rocket' ? [0.3, 0.45, 0.2] : wn === 'shot' ? [0.5, 0.3, 0.12] : [0.5, 0.55, 0.65]
    for (let i = 0; i < len; i++) {
      if (p.aim === 'up') put(px + p.face * 1.5, pcy + 3 + i, 0.5, 0.9, 0.9, gc[0] * 1.3, gc[1] * 1.3, gc[2] * 1.3)
      else if (p.aim === 'down') put(px + p.face * 1.2, pcy - 2 - i, 0.5, 0.9, 0.9, gc[0] * 1.3, gc[1] * 1.3, gc[2] * 1.3)
      else put(px + p.face * (2 + i), pcy + (p.crouch ? -0.5 : 0.8), 0.5, 0.9, 0.9, gc[0] * 1.3, gc[1] * 1.3, gc[2] * 1.3)
    }
    if (S.shT > 0 && (S.shT > 1 || Math.floor(t * 14) % 2 === 0)) for (let i = 0; i < 36; i++) { const a = (i / 36) * 6.28 + t * 3; put(px + Math.cos(a) * 8, pcy + Math.sin(a) * 8, 0, 0.9, 0.9, 0.5, 2.6, 1) }
    if (S.od > 0) for (let i = 0; i < 14; i++) { const a = (i / 14) * 6.28 - t * 5; put(px + Math.cos(a) * 6.5, pcy + Math.sin(a) * 6.5, 0, 0.8, 0.8, 2.4, 0.6, 2.4) }
  }
  for (const q of S.bul) sprite(q.spr, q.x - cam, q.y, { k: 2, sx: q.vx < 0 ? -1 : 1 })
  for (const q of S.ebul) sprite(q.spr, q.x - cam, q.y, { k: 1.9 })
  for (const q of S.bombs) sprite(q.spr, q.x - cam, q.y, { k: 1.5 })
  // airstrike warning markers
  for (const a of S.air) put(a.x - cam, GROUND + 1, 0, 1.2, 1.2, 2.4, 0.3, 0.3)
  for (const q of G.parts) { const f = q.life / q.max; put(q.x - cam, q.y, 1, q.s * (0.35 + 0.65 * f) * 0.9, q.s * (0.35 + 0.65 * f) * 0.9, q.c[0] * 1.6, q.c[1] * 1.6, q.c[2] * 1.6) }
  api.pops(G.pops, cam)
}
games.slug = { update, onKey, draw, stop, sky: (i) => STAGES[i].sky, stageIndex: () => S.stage }
