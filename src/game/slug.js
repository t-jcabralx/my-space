// Operation Ground Zero v2: Metal Slug-style run & gun. Pure JS; drawing goes through an api passed in by Scene.jsx.
import { G, keys, games, profile, saveProfile, recordScore, boom, ring, part, shake, flash, popup, COLS, stepParticles, toMenu } from './engine.js'
import { SP, rgb } from './sprites.js'
import { sfx, music, speak } from './audio.js'

const GROUND = -20
const R = (a, b) => a + Math.random() * (b - a)
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
const rng = (seed) => { let s = seed; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296 }
const SMOKE = [[0.35, 0.35, 0.4], [0.5, 0.5, 0.55]]

export const STAGES = [
  { name: 'JUNGLE OUTPOST', sub: 'Rescue the POWs. Take down the IRON HAWK.', len: 640, boss: 'hawk', diff: 1, theme: 'jungle', color: '#7dffb0', sky: '#102e2a', top: '#0a1c22', horizon: '#2f7a5a', far: '#14402c', near: '#1f5a36', ground: ['#5a4a2a', '#6b5a34', '#3f9a3f'], veh: [170, 430] },
  { name: 'DESERT FORTRESS', sub: 'The BIG SHIELD tank guards the gate.', len: 740, boss: 'tank', diff: 2, theme: 'desert', color: '#ffb36b', sky: '#3a2410', top: '#1a1030', horizon: '#e08a3a', far: '#7a4a22', near: '#9a6430', ground: ['#c89a58', '#d8aa68', '#b88a48'], veh: [140, 390, 600] },
  { name: 'OMEGA FACTORY', sub: 'Destroy the MECH WALKER. End the war.', len: 840, boss: 'mech', diff: 3, theme: 'factory', color: '#ff4de1', sky: '#0a0a1c', top: '#05050f', horizon: '#3a1a5a', far: '#1a1a3e', near: '#2a2a5a', ground: ['#3a3a4a', '#4a4a5a', '#2a2a38'], veh: [120, 380, 640] },
]
const BOSS_DEF = {
  hawk: { name: 'IRON HAWK', hp: 120, score: 6000 },
  tank: { name: 'BIG SHIELD', hp: 180, score: 9000 },
  mech: { name: 'MECH WALKER', hp: 280, score: 16000 },
}
const MEN = new Set(['rifle', 'runner', 'gren', 'baz', 'sniper', 'para'])
const EN = {
  rifle:  { hp: 2,  hw: 2, hh: 5,   sc: 100, pre: 'sol' },
  runner: { hp: 1,  hw: 2, hh: 5,   sc: 80,  pre: 'run' },
  gren:   { hp: 2,  hw: 2, hh: 5,   sc: 150, pre: 'gre' },
  baz:    { hp: 3,  hw: 2, hh: 5,   sc: 200, pre: 'baz' },
  sniper: { hp: 3,  hw: 2, hh: 5,   sc: 300, pre: 'snp' },
  para:   { hp: 2,  hw: 2, hh: 5,   sc: 150, pre: 'sol' },
  tank:   { hp: 16, hw: 8, hh: 4.5, sc: 800, spr: 'tank' },
  chop:   { hp: 9,  hw: 6, hh: 2.5, sc: 600, spr: 'chop', fly: true },
  jeep:   { hp: 8,  hw: 7, hh: 4,   sc: 500, spr: 'jeep' },
  plane:  { hp: 4,  hw: 8, hh: 2.5, sc: 400, spr: 'plane', fly: true },
}
const WEAPONS = {
  pistol: { name: 'PISTOL',        cd: 0.24 },
  hmg:    { name: 'HEAVY MACHINE', cd: 0.065, ammo: 150 },
  shot:   { name: 'SHOTGUN',       cd: 0.5,   ammo: 30 },
  rocket: { name: 'ROCKET',        cd: 0.6,   ammo: 15 },
}
const CRATE = { M: 'hmg', S: 'shot', R: 'rocket' }

export const S = {
  mode: 'idle', paused: false, stage: 0, score: 0, lives: 3, cam: 0, t: 0, p: null, veh: null, vp: [],
  en: [], bul: [], ebul: [], items: [], pows: [], bombs: [], props: [], decor: [], plats: [], spawns: [], si: 0, air: [],
  stats: {}, boss: null, bossState: 'none', toasts: [], banner: null, summary: null, final: null, streak: 0, streakT: 0, ambT: 2, engT: 0,
  cd: { q: 0, e: 0 }, cdMax: { q: 1, e: 1 }, shT: 0, od: 0, meter: 0, camMax: 0, jumpReq: false, emitT: 0, endT: 0, mf: 0, weapon: 'pistol', ammo: 0, gren: 8,
}
let snap = null
const subs = new Set()
export const subscribeSlug = (f) => { subs.add(f); return () => subs.delete(f) }
export const getSlugSnap = () => snap
function emitSlug() {
  const p = S.p, st = STAGES[S.stage], b = S.boss
  snap = {
    mode: S.mode, paused: S.paused, stage: S.stage, stages: STAGES.length, name: st.name, sub: st.sub, color: st.color,
    score: S.score, hi: Math.max(profile.slugHi, S.score), lives: S.lives, hp: p ? Math.max(0, p.hp) : 0, maxHp: 3,
    weapon: p ? WEAPONS[S.od > 0 ? 'hmg' : S.weapon].name : '', ammo: S.weapon === 'pistol' || S.od > 0 ? -1 : S.ammo, gren: S.gren,
    pows: S.stats.pows || 0, powTotal: S.stats.powTotal || 0, progress: Math.min(1, Math.max(0, S.cam / st.len)),
    veh: S.veh ? { hp: S.veh.hp, max: S.veh.maxhp } : null, streak: S.streak, time: Math.floor(S.stats.time || 0),
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
const cy = (e) => e.fy + e.hh
const alive = (e) => !e.dead && !(e.dying > 0)

// ---------- stage generation ----------
function buildStage(i) {
  const st = STAGES[i], r = rng(900 + i * 131)
  const spawns = [], pows = [], plats = [], props = [], decor = []
  const pool = [['rifle', 4], ['runner', 3], ['gren', 2], ['baz', i >= 1 ? 2 : 0.5], ['sniper', i >= 1 ? 1.6 : 0.7], ['para', 2], ['tank', 1], ['chop', 1.2], ['jeep', 1.3], ['plane', 0.9]]
  const gate = { tank: 140, chop: 110, jeep: 100, plane: 90, sniper: 120, para: 80 }
  for (let x = 70; x < st.len - 50; x += 17 + r() * 13) {
    const list = pool.filter(([t]) => !gate[t] || x > gate[t])
    let tot = list.reduce((a, [, w]) => a + w, 0), q = r() * tot, type = 'rifle'
    for (const [t, w] of list) { q -= w; if (q <= 0) { type = t; break } }
    const solo = ['tank', 'chop', 'jeep', 'plane', 'sniper'].includes(type)
    spawns.push({ x, type, n: solo ? 1 : 1 + Math.floor(r() * (1 + st.diff)) })
  }
  for (let x = 85; x < st.len - 70; x += 90 + r() * 30) pows.push({ x })
  for (let x = 55; x < st.len - 60; x += 55 + r() * 35) plats.push({ x, w: 10 + Math.floor(r() * 10), h: 4 + Math.floor(r() * 4) })
  const free = (x) => plats.every((p) => Math.abs(p.x - x) > p.w / 2 + 6) && pows.every((p) => Math.abs(p.x - x) > 8)
  for (let x = 48; x < st.len - 50; x += 20 + r() * 22) { if (free(x)) props.push({ type: r() < 0.45 ? 'barrel' : 'crate', x, hp: 2, hw: 2.6, hh: 3, flash: 0 }) }
  const kinds = { jungle: ['palm', 'palm', 'tire'], desert: ['cactus', 'tire', 'cactus'], factory: ['stack', 'tire', 'tire'] }[st.theme]
  for (let x = 20; x < st.len + 40; x += 11 + r() * 14) decor.push({ x, type: kinds[Math.floor(r() * kinds.length)], z: r() < 0.5 ? -2 : -1 })
  return { spawns, pows, plats, props, decor }
}
function groundAt(x, feetPrev) {
  let top = GROUND
  for (const pl of S.plats) if (Math.abs(x - pl.x) < pl.w / 2 + 0.5) { const t = GROUND + pl.h; if (feetPrev >= t - 0.6 && t > top) top = t }
  return top
}

// ---------- lifecycle ----------
function newPlayer() {
  return { x: S.cam - 30, fy: GROUND, vx: 0, vy: 0, hw: 1.9, hh: 5, face: 1, ground: true, anim: 0, hp: 3, inv: 2, alive: true, rt: 0, fcd: 0, gcd: 0, aim: 'fwd', crouch: false, inVeh: false, lf: 0, knife: 0 }
}
function startStage(i, fresh) {
  const gen = buildStage(i), st = STAGES[i]
  G.mode = 'slug'; G.parts = []; G.pops = []; G.shake = 0; G.flash = 0
  Object.assign(S, {
    mode: 'play', paused: false, stage: i, cam: 0, t: 0, en: [], bul: [], ebul: [], items: [], bombs: [], air: [], veh: null, streak: 0, streakT: 0,
    plats: gen.plats, spawns: gen.spawns, props: gen.props, decor: gen.decor, si: 0, boss: null, bossState: 'none', summary: null, final: null, banner: null, toasts: [],
    camMax: st.len, shT: 0, od: 0, jumpReq: false, endT: 0, weapon: 'pistol', ammo: 0, cd: { q: 0, e: 0 }, meter: Math.min(S.meter || 0, 30), ambT: 2, engT: 0, mf: 0,
  })
  if (fresh) { S.score = 0; S.lives = 3; S.gren = 8 }
  S.gren = Math.max(S.gren || 0, 6)
  S.pows = gen.pows.map((p) => ({ x: p.x, fy: GROUND, hw: 2, hh: 5, state: 'tied', t: 0, vx: 0, anim: 0 }))
  S.vp = st.veh.map((x) => ({ x, fy: GROUND, hp: 10, cool: 0 }))
  S.stats = { kills: 0, total: gen.spawns.reduce((a, s) => a + s.n, 0), pows: 0, powTotal: gen.pows.length, dmg: 0, time: 0, bossKilled: false, tank: false, knife: 0 }
  S.p = newPlayer(); S.p.x = -30
  S.banner = { title: 'STAGE ' + (i + 1), sub: st.name, sub2: st.sub.toUpperCase(), kind: 'intro', t: 3.2 }
  music.set('slug', i); sfx('mission'); speak('Mission start. Get ready!'); emitSlug()
}
function start(i = 0) { profile.played++; S.meter = 0; startStage(i, true) }
function stop() { S.mode = 'idle'; S.paused = false; music.set('menu'); emitSlug() }

// ---------- effects ----------
const fireCols = COLS.fire
function debris(x, y, n, cols, power = 1) {
  for (let i = 0; i < n; i++) { const a = R(0.2, Math.PI - 0.2); part(x, y, Math.cos(a) * R(10, 40) * power, Math.sin(a) * R(15, 50) * power, R(0.6, 1.2), cols[(Math.random() * cols.length) | 0], R(0.8, 1.6), 0, 90) }
}
function smoke(x, y, n = 1, s = 2) { for (let i = 0; i < n; i++) part(x + R(-1, 1), y, R(-3, 3), R(6, 14), R(0.8, 1.6), SMOKE[(Math.random() * 2) | 0], R(1.4, s), 0.4, -4) }

// ---------- combat helpers ----------
function pbox() {
  const p = S.p
  if (p.inVeh && S.veh) return { x: S.veh.x, y: cy(S.veh), hw: S.veh.hw, hh: S.veh.hh }
  return { x: p.x, y: cy(p), hw: p.hw, hh: p.hh }
}
function hurtP(d = 1) {
  const p = S.p
  if (!p.alive || S.mode !== 'play') return
  if (p.inVeh && S.veh) { hurtVeh(d); return }
  if (p.inv > 0 || S.shT > 0 || S.od > 0) return
  p.hp -= d; p.inv = 1.6; S.stats.dmg++
  shake(1.6); flash(0.4, [1, 0.15, 0.15]); sfx('hurt'); boom(p.x, cy(p), 14, 30, fireCols)
  if (p.hp <= 0) {
    p.alive = false; S.lives--; S.weapon = 'pistol'; S.streak = 0
    boom(p.x, cy(p), 50, 55, fireCols, 1.3); ring(p.x, cy(p), 30, 45, fireCols); sfx('bigBoom'); shake(3)
    if (S.lives <= 0) { S.endT = 2.2 } else p.rt = 1.6
  }
}
function hurtVeh(d) {
  const v = S.veh
  if (v.inv > 0 || S.shT > 0 || S.od > 0) return
  v.hp -= d; v.inv = 0.5; v.flash = 0.1; S.stats.dmg++
  shake(1.2); sfx('hurt'); debris(v.x, cy(v), 8, [[0.6, 0.6, 0.65], [1, 0.8, 0.3]])
  if (v.hp <= 0) {
    boom(v.x, cy(v), 70, 60, fireCols, 1.5); ring(v.x, cy(v), 40, 55, fireCols); sfx('bigBoom'); shake(3.5); flash(0.5)
    const p = S.p; p.inVeh = false; p.x = v.x; p.fy = v.fy + 8; p.vy = 38; p.inv = 2.5; S.veh = null
    toast('TANK DESTROYED! YOU BAILED OUT', '#ff8a96'); speak('Tank destroyed')
  }
}
function blast(x, y, r, dmg, team) {
  boom(x, y, 24, 44, fireCols, 1.3); ring(x, y, 22, 42, fireCols); smoke(x, y, 4, 3); debris(x, y, 6, [[0.5, 0.4, 0.3], [0.8, 0.6, 0.3]], 0.8); sfx('boom'); shake(0.9)
  if (team === 'p' || team === 'x') {
    for (const e of S.en) if (alive(e) && Math.hypot(e.x - x, cy(e) - y) < r + e.hw) hurtE(e, dmg)
    const b = S.boss
    if (b && !b.dying && !b.enter && Math.hypot(b.x - x, cy(b) - y) < r + b.hw) hurtBoss(dmg)
    for (const pr of S.props) if (!pr.dead && Math.hypot(pr.x - x, pr.fy + 3 - y) < r + 2) hitProp(pr, dmg)
  }
  if (team === 'e' || team === 'x') {
    const b = pbox()
    if (S.p.alive && Math.hypot(b.x - x, b.y - y) < r + b.hw * 0.6) hurtP(1)
  }
}
function drop(x, fy, forced) {
  const roll = Math.random()
  const t = forced || (roll < 0.17 ? 'C' : ['M', 'S', 'R', 'B', 'H'][(Math.random() * 5) | 0])
  S.items.push({ x, fy, t, hw: 2.5, hh: 3.5, life: 14, vy: 18 })
}
function hitProp(pr, d) {
  if (pr.dead) return
  pr.hp -= d; pr.flash = 0.08; sfx('hit')
  if (pr.hp > 0) return
  pr.dead = true
  if (pr.type === 'crate') { sfx('crate'); debris(pr.x, pr.fy + 3, 10, [[0.7, 0.5, 0.2], [0.9, 0.7, 0.3]]); if (Math.random() < 0.75) drop(pr.x, pr.fy) ; S.score += 50 }
  else { S.score += 100; blast(pr.x, pr.fy + 3, 11, 8, 'x') }
}
function hurtE(e, d) {
  if (!alive(e)) return
  e.hp -= d; e.flash = 0.07
  part(e.x, cy(e), R(-15, 15), R(5, 25), 0.3, fireCols[2], 1)
  if (e.hp <= 0) killE(e); else sfx('hit')
}
function killE(e, knife) {
  const d = EN[e.type], big = e.maxhp >= 8, men = MEN.has(e.type)
  S.streak++; S.streakT = 3
  const mult = 1 + Math.min(S.streak, 10) * 0.1
  const sc = Math.round((d.sc + (knife ? 200 : 0)) * mult)
  S.score += sc; profile.kills++; S.stats.kills++; S.meter = Math.min(100, S.meter + (big ? 14 : 4))
  if (G.pops.length < 12) popup(e.x, cy(e) + 5, String(sc), knife ? [1, 0.5, 0.9] : [1, 1, 0.5])
  if (S.streak >= 5 && S.streak % 5 === 0) { toast(`${S.streak} KILL STREAK!  +${S.streak * 50}`, '#ffe84a'); S.score += S.streak * 50; sfx('medal') }
  if (men) {
    e.dying = 0.85; e.vx = -e.face * (knife ? 10 : 30); e.vy = knife ? 20 : 30
    debris(e.x, cy(e), 5, [[0.8, 0.1, 0.1], [0.9, 0.7, 0.4]], 0.7); boom(e.x, cy(e), 8, 24, fireCols)
    sfx('grunt'); sfx('boom')
    if (Math.random() < 0.18) drop(e.x, e.fy)
    return
  }
  e.dead = true
  boom(e.x, cy(e), big ? 50 : 22, big ? 55 : 35, fireCols, big ? 1.5 : 1.1); smoke(e.x, cy(e), big ? 8 : 3, 3)
  if (big) { ring(e.x, cy(e), 28, 45, fireCols); shake(1.8); debris(e.x, cy(e), 14, [[0.55, 0.55, 0.6], [1, 0.8, 0.3]], 1.2) }
  sfx(big ? 'bigBoom' : 'boom')
  if (big || Math.random() < 0.12) drop(e.x, e.fly ? GROUND : e.fy)
}
function ebullet(x, y, ang, sp, spr = 'orbR', extra) {
  if (S.ebul.length > 240) return
  sfx('eshot')
  const s = SP[spr]
  S.ebul.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, spr: s, hw: s.hw * 0.6, hh: s.hh * 0.6, t: 0, ...extra })
}

// ---------- player actions ----------
function meleeTarget() {
  const p = S.p
  let best = null, bd = 99
  for (const e of S.en) {
    if (!alive(e) || !MEN.has(e.type)) continue
    const dx = (e.x - p.x) * p.face
    if (dx > -1.5 && dx < 6.5 && Math.abs(cy(e) - cy(p)) < 5 && dx < bd) { bd = dx; best = e }
  }
  return best
}
function shoot() {
  const p = S.p, od = S.od > 0
  if (p.inVeh) return shootVeh()
  const tgt = meleeTarget()
  if (tgt) {
    p.fcd = 0.28; p.knife = 0.22; S.stats.knife++
    sfx('knife'); part(tgt.x, cy(tgt), 0, 0, 0.15, [1, 1, 1], 2)
    killE(tgt, true)
    return
  }
  const wname = od ? 'hmg' : S.weapon
  const w = WEAPONS[wname]
  p.fcd = w.cd * (od ? 0.8 : 1)
  const up = p.aim === 'up', down = p.aim === 'down'
  const dx = up || down ? (keys.ArrowRight || keys.KeyD || keys.ArrowLeft || keys.KeyA ? p.face * 0.55 : 0) : p.face
  const dy = up ? (dx ? 0.8 : 1) : down ? -1 : 0
  const ang = Math.atan2(dy, dx || (dy === 0 ? p.face : 0))
  const mx = p.x + Math.cos(ang) * 5.5, my = cy(p) + (p.crouch ? -2 : 1.2) + Math.sin(ang) * 5.5
  const mk = (a, sp, dmg, o = {}) => S.bul.push({ x: mx, y: my, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, spr: o.spr || SP.sb, hw: 1.2, hh: 0.9, dmg, life: o.life || 1.2, rocket: !!o.rocket, t: 0 })
  if (wname === 'pistol') { mk(ang, 75, 1); sfx('pistol') }
  else if (wname === 'hmg') { mk(ang + R(-0.05, 0.05), 90, od ? 2 : 1); sfx('hmg') }
  else if (wname === 'shot') { for (let i = 0; i < 6; i++) mk(ang + (i - 2.5) * 0.1, R(60, 80), 1.2, { life: 0.3 }); sfx('shotgun'); shake(0.4) }
  else if (wname === 'rocket') { mk(ang, 50, 5, { spr: SP.pbM, rocket: true }); sfx('rocketLaunch'); shake(0.5) }
  if (!od && wname !== 'pistol') { S.ammo--; if (S.ammo <= 0) { S.weapon = 'pistol'; toast('OUT OF AMMO', '#ff8a96'); sfx('reload') } }
  S.mf = 0.06
  part(mx, my, Math.cos(ang) * 22, Math.sin(ang) * 22, 0.1, fireCols[1], 1.1)
  part(p.x, cy(p) + 1, -p.face * R(6, 14), R(14, 26), 0.6, [1, 0.85, 0.3], 0.7, 0, 90) // shell casing
}
function shootVeh() {
  const v = S.veh, p = S.p
  const up = keys.ArrowUp || keys.KeyW
  const ang = up ? (v.face > 0 ? 0.9 : Math.PI - 0.9) : v.face > 0 ? 0 : Math.PI
  p.fcd = S.od > 0 ? 0.05 : 0.08
  const mx = v.x + Math.cos(ang) * 11, my = cy(v) + 2 + Math.sin(ang) * 11
  S.bul.push({ x: mx, y: my, vx: Math.cos(ang) * 100, vy: Math.sin(ang) * 100, spr: SP.sb, hw: 1.4, hh: 1, dmg: S.od > 0 ? 2.2 : 1.3, life: 1.1, t: 0 })
  sfx('vulcan'); S.mf = 0.06; part(mx, my, Math.cos(ang) * 22, Math.sin(ang) * 22, 0.1, fireCols[1], 1.2)
}
function cannon() {
  const v = S.veh, p = S.p
  if (!v || p.gcd > 0) return
  p.gcd = 0.7
  const up = keys.ArrowUp || keys.KeyW
  const ang = up ? (v.face > 0 ? 0.8 : Math.PI - 0.8) : v.face > 0 ? 0 : Math.PI
  S.bul.push({ x: v.x + Math.cos(ang) * 12, y: cy(v) + 2 + Math.sin(ang) * 12, vx: Math.cos(ang) * 55, vy: Math.sin(ang) * 55, spr: SP.pbM, hw: 1.6, hh: 1.2, dmg: 6, life: 1.6, rocket: true, t: 0 })
  sfx('cannon'); shake(0.9); v.recoil = 0.12; boom(v.x + Math.cos(ang) * 12, cy(v) + 2, 6, 25, fireCols)
}
function throwGren() {
  const p = S.p
  if (!p.alive) return
  if (p.inVeh) return cannon()
  if (S.gren <= 0 || p.gcd > 0) return
  S.gren--; p.gcd = 0.4
  S.bombs.push({ x: p.x + p.face * 2, y: cy(p) + 3, vx: p.face * 26 + p.vx * 0.5, vy: 30, spr: SP.gr, hw: 1.2, hh: 1.2, team: 'p', g: 70, t: 0, r: 9, dmg: 6 })
  sfx('throw')
}
function leaveVeh() {
  const p = S.p, v = S.veh
  if (!p.inVeh || !v) return
  S.vp.push({ x: v.x, fy: v.fy, hp: v.hp, cool: 1.2 })
  p.inVeh = false; p.x = v.x - v.face * 3; p.fy = v.fy + 8; p.vy = 40; p.inv = Math.max(p.inv, 0.8); S.veh = null
  sfx('jump')
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
  sfx('shield'); const b = pbox(); ring(b.x, b.y, 36, 45, COLS.green)
}
function overdrive() {
  if (S.od > 0 || S.meter < 100 || S.mode !== 'play' || !S.p.alive) return
  S.od = 7; S.meter = 0; profile.skills++
  sfx('overdrive'); shake(2.2); flash(0.7, [1, 0.5, 1]); const b = pbox(); ring(b.x, b.y, 50, 70, COLS.purple)
  speak('Overdrive!'); toast('OVERDRIVE!  MAX FIREPOWER', '#ff4de1')
}

// ---------- enemies ----------
function spawnEnemy(type, x, o = {}) {
  const d = EN[type]
  const hp = Math.ceil(d.hp * (1 + (STAGES[S.stage].diff - 1) * 0.2))
  const pre = d.pre
  const e = { kind: 'e', type, x, fy: d.fly ? (type === 'plane' ? 21 : R(14, 20)) : GROUND, hw: d.hw, hh: d.hh, hp, maxhp: hp, vx: 0, vy: 0, t: 0, flash: 0, face: -1, anim: Math.random() * 4, cd: R(0.8, 2), off: R(0, 22), ground: true, pre, spr: d.spr ? SP[d.spr] : null, bombs: 0, ...o }
  if (type === 'para') { e.fy = 40; e.para = true; sfx('chute') }
  if (type === 'jeep') sfx('jeep')
  if (type === 'plane') sfx('plane')
  S.en.push(e)
  return e
}
function stepEnemies(dt) {
  const p = S.p, pb = pbox(), diff = STAGES[S.stage].diff
  for (const e of S.en) {
    if (e.dead) continue
    if (e.dying > 0) {
      e.dying -= dt; e.x += e.vx * dt; e.fy += e.vy * dt; e.vy -= 130 * dt
      const g = groundAt(e.x, 999); if (e.fy <= g) { e.fy = g; e.vy = 0; e.vx *= 0.7 }
      if (e.dying <= 0) e.dead = true
      continue
    }
    e.t += dt; e.flash = Math.max(0, e.flash - dt)
    e.face = pb.x < e.x ? -1 : 1
    const bs = 20 + diff * 2.5
    const dxp = pb.x - e.x
    const walk = (sp) => { e.x -= sp * dt; e.anim += dt * 9 }
    const aimA = (x, y) => Math.atan2(pb.y - y, pb.x - x)
    switch (e.type) {
      case 'para':
        if (e.para) { e.fy -= 11 * dt; e.x += Math.sin(e.t * 2) * 3 * dt; if (e.fy <= groundAt(e.x, 999)) { e.fy = groundAt(e.x, 999); e.para = false; e.type = 'rifle' } }
        continue
      case 'rifle': {
        const want = S.cam + 14 + e.off
        if (e.x > want) walk(13)
        e.cd -= dt
        if (e.cd < 0 && Math.abs(e.x - S.cam) < 50) { e.cd = R(1.4, 2.2); e.shoot = 0.15; ebullet(e.x + e.face * 3, cy(e) + 1, aimA(e.x, cy(e)), bs + 4, 'orbY') }
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
          e.cd = R(2, 3); e.shoot = 0.2
          const T = 1.2, g = 60
          S.bombs.push({ x: e.x, y: cy(e) + 3, vx: dxp / T, vy: (pb.y - cy(e) + 0.5 * g * T * T) / T, spr: SP.gr, hw: 1.2, hh: 1.2, team: 'e', g, t: 0, r: 6, dmg: 1 })
        }
        break
      case 'baz':
        if (e.x > S.cam + 34 + e.off * 0.5) walk(11)
        e.cd -= dt
        if (e.cd < 0 && Math.abs(e.x - S.cam) < 50) { e.cd = R(2.6, 3.6); e.shoot = 0.25; ebullet(e.x - 3, cy(e) + 1, Math.PI, 20, 'missile', { rocket: true }); sfx('missile') }
        break
      case 'sniper':
        if (e.x > S.cam + 40 + e.off * 0.4) walk(12)
        else {
          e.cd -= dt
          e.aiming = e.cd < 0.9 && e.cd > 0
          if (e.cd < 0.9 && !e.warned) { e.warned = true; sfx('sniperAim') }
          if (e.cd <= 0 && Math.abs(e.x - S.cam) < 52) { e.cd = R(2.8, 3.6); e.warned = false; e.shoot = 0.2; ebullet(e.x - 3, cy(e) + 2, aimA(e.x, cy(e)), 64, 'dart') }
        }
        break
      case 'tank':
        if (e.x > S.cam + 30) walk(7); else e.fy = GROUND + Math.sin(e.t * 6) * 0.15
        e.cd -= dt
        if (e.t % 0.5 < dt) sfx('tankEngine')
        if (e.cd < 0 && Math.abs(e.x - S.cam) < 52) {
          e.cd = 2.2; const a = aimA(e.x - 9, cy(e) + 2)
          ebullet(e.x - 9, cy(e) + 2, a, 30, 'big', { rocket: true }); sfx('cannon')
          for (let i = -1; i <= 1; i++) ebullet(e.x - 9, cy(e) + 3, a + i * 0.15, 26, 'orbR')
        }
        break
      case 'jeep':
        e.x -= 38 * dt; e.fy = GROUND + Math.abs(Math.sin(e.t * 14)) * 0.25; e.cd -= dt
        if (Math.floor(e.t * 3) !== Math.floor((e.t - dt) * 3)) sfx('jeep')
        if (e.cd < 0 && Math.abs(e.x - S.cam) < 52) { e.cd = 0.9; ebullet(e.x - 2, cy(e) + 4, aimA(e.x, cy(e) + 4), bs + 4, 'orbR') }
        break
      case 'plane':
        e.x -= 46 * dt; e.cd -= dt
        if (Math.floor(e.t * 4) !== Math.floor((e.t - dt) * 4)) sfx('plane')
        if (e.cd < 0 && e.bombs < 5 && Math.abs(e.x - S.cam) < 45) { e.cd = 0.45; e.bombs++; S.bombs.push({ x: e.x, y: e.fy - 2, vx: -14, vy: -4, spr: SP.bm, hw: 1.2, hh: 1.5, team: 'e', g: 40, t: 0, r: 7, dmg: 1 }) }
        break
      case 'chop':
        e.x += (clamp(pb.x + 16 + Math.sin(e.t * 0.8) * 14, S.cam - 30, S.cam + 44) - e.x) * Math.min(1, dt * 0.9)
        e.fy = 15 + Math.sin(e.t * 1.7) * 3
        e.rot = (e.rot || 0) - dt
        if (e.rot < 0) { e.rot = 0.16; if (Math.abs(e.x - S.cam) < 55) sfx('rotor') }
        e.cd -= dt
        if (e.cd < 0 && Math.abs(e.x - S.cam) < 50) { e.cd = 1.5; const a = aimA(e.x, cy(e) - 1); ebullet(e.x, cy(e) - 1, a, bs + 4, 'orbR'); ebullet(e.x, cy(e) - 1, a + 0.2, bs + 4, 'orbR') }
        if (Math.abs(dxp) < 10) { e.bomb = (e.bomb ?? 2.5) - dt; if (e.bomb < 0) { e.bomb = 3; S.bombs.push({ x: e.x, y: cy(e) - 2, vx: 0, vy: -5, spr: SP.bm, hw: 1.2, hh: 1.5, team: 'e', g: 40, t: 0, r: 7, dmg: 1 }) } }
        break
    }
    e.shoot = Math.max(0, (e.shoot || 0) - dt)
    if (!EN[e.type].fly && e.type !== 'para') {
      e.vy -= 130 * dt; e.fy += e.vy * dt
      const g = groundAt(e.x, 999)
      if (e.fy <= g) { e.fy = g; e.vy = 0; e.ground = true }
    }
    if (e.x < S.cam - 78) e.dead = true
  }
}

// ---------- bosses ----------
function spawnBoss() {
  const st = STAGES[S.stage], d = BOSS_DEF[st.boss]
  const spr = st.boss === 'hawk' ? SP.chop : st.boss === 'tank' ? SP.tank : SP.mech
  const sc = st.boss === 'hawk' ? 2.2 : 1.7
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
  const b = S.boss
  if (!b) return
  const pb = pbox()
  b.t += dt; b.flash = Math.max(0, b.flash - dt)
  if (b.dying) {
    b.dieT -= dt
    if (Math.random() < 0.8) { boom(b.x + R(-b.hw, b.hw), cy(b) + R(-b.hh, b.hh), 14, 40, fireCols, 1.3); smoke(b.x + R(-b.hw, b.hw), cy(b) + b.hh, 1, 3) }
    if (Math.random() < 0.25) sfx('boom')
    shake(1.2)
    if (b.dieT <= 0) {
      boom(b.x, cy(b), 120, 90, fireCols, 1.6); ring(b.x, cy(b), 70, 90, fireCols); debris(b.x, cy(b), 30, [[0.6, 0.6, 0.65], [1, 0.7, 0.2], [0.3, 0.3, 0.35]], 1.6)
      flash(1); shake(5); sfx('bigBoom')
      S.score += BOSS_DEF[b.id].score; popup(b.x, cy(b), String(BOSS_DEF[b.id].score), [1, 0.9, 0.3])
      for (let i = 0; i < 4; i++) drop(b.x + R(-12, 12), GROUND, i === 0 ? 'C' : undefined)
      S.boss = null; S.bossState = 'done'; S.endT = 3.2
      music.stop()
    }
    return
  }
  if (b.enter) { b.x -= 24 * dt; if (b.x <= S.cam + 30) b.enter = false; return }
  const f = b.hp / b.maxhp, ph2 = f < 0.5
  const tk = (k, iv) => { b.tm[k] = (b.tm[k] ?? iv) - dt; if (b.tm[k] <= 0) { b.tm[k] += iv; return true } return false }
  const aimA = () => Math.atan2(pb.y - cy(b), pb.x - b.x)
  const diff = STAGES[S.stage].diff, bs = 22 + diff * 2
  if (b.id === 'hawk') {
    b.x = S.cam + 26 + Math.sin(b.t * (ph2 ? 0.9 : 0.6)) * 18; b.fy = 10 + Math.sin(b.t * 1.3) * 4
    if (Math.floor(b.t * 6) !== Math.floor((b.t - dt) * 6)) sfx('rotor')
    if (tk('gun', ph2 ? 0.8 : 1.2)) for (let i = -1; i <= 1; i++) ebullet(b.x - 8, cy(b) - 2, aimA() + i * 0.22, bs + 6, 'orbR')
    if (tk('bomb', ph2 ? 2.4 : 3.6)) for (let i = 0; i < 4; i++) S.bombs.push({ x: b.x - 6 + i * 4, y: cy(b) - 4, vx: -4 - i * 2, vy: -4, spr: SP.bm, hw: 1.2, hh: 1.5, team: 'e', g: 40, t: 0, r: 7, dmg: 1 })
    if (ph2 && tk('rk', 3)) ebullet(b.x - 10, cy(b) - 3, aimA(), 24, 'missile', { rocket: true })
  } else if (b.id === 'tank') {
    b.x = S.cam + 32 + Math.sin(b.t * 0.35) * 10
    if (Math.floor(b.t * 4) !== Math.floor((b.t - dt) * 4)) sfx('tankEngine')
    if (tk('shell', ph2 ? 1.6 : 2.3)) { ebullet(b.x - 12, cy(b) + 3, aimA(), 32, 'big', { rocket: true }); sfx('cannon'); shake(0.8) }
    if (tk('mg', 0.9)) for (let i = -1; i <= 1; i++) ebullet(b.x - 12, cy(b) + 5, aimA() + i * 0.14, bs + 4, 'orbR')
    if (ph2 && tk('run', 5)) { spawnEnemy('runner', S.cam + 54); spawnEnemy('runner', S.cam + 60) }
  } else {
    b.x = S.cam + 30 + Math.sin(b.t * 0.5) * 8; b.fy = GROUND + Math.abs(Math.sin(b.t * 3)) * 0.8
    if (Math.floor(b.t * 3) !== Math.floor((b.t - dt) * 3)) { sfx('rumble'); shake(0.3) }
    if (tk('plasma', ph2 ? 1.0 : 1.5)) for (let i = -2; i <= 2; i++) ebullet(b.x - 8, cy(b) + 6, aimA() + i * 0.18, bs + 6, 'orbP')
    if (tk('wave', ph2 ? 3 : 4.2)) { ebullet(b.x - 8, GROUND + 2, Math.PI, 30, 'big', { wave: true }); sfx('bigBoom'); shake(1.2) }
    if (tk('rain', ph2 ? 3 : 4.5)) for (let i = 0; i < (ph2 ? 6 : 4); i++) S.bombs.push({ x: pb.x + R(-18, 18), y: 36 + i * 3, vx: 0, vy: -10, spr: SP.bm, hw: 1.2, hh: 1.5, team: 'e', g: 30, t: 0, r: 7, dmg: 1 })
    if (ph2 && tk('add', 6)) spawnEnemy('rifle', S.cam + 54)
  }
}

// ---------- main step ----------
function ambience(dt) {
  S.ambT -= dt
  if (S.ambT > 0) return
  const th = STAGES[S.stage].theme
  if (th === 'jungle') { sfx('bird'); S.ambT = R(1.8, 4.5); if (Math.random() < 0.2) sfx('distant') }
  else if (th === 'desert') { sfx('wind'); S.ambT = R(4, 7); if (Math.random() < 0.3) sfx('distant') }
  else { sfx(Math.random() < 0.6 ? 'clank' : 'hum'); S.ambT = R(1.4, 3.2); if (Math.random() < 0.15) sfx('distant') }
}
function play(dt) {
  const p = S.p, st = STAGES[S.stage]
  S.t += dt; S.stats.time += dt
  for (const k of ['q', 'e']) S.cd[k] = Math.max(0, S.cd[k] - dt)
  S.shT = Math.max(0, S.shT - dt); S.od = Math.max(0, S.od - dt); S.mf = Math.max(0, S.mf - dt)
  p.inv = Math.max(0, p.inv - dt); p.fcd -= dt; p.gcd -= dt; p.knife = Math.max(0, p.knife - dt)
  S.streakT -= dt; if (S.streakT <= 0) S.streak = 0
  ambience(dt)

  if (!p.alive) {
    p.rt -= dt
    if (p.rt <= 0 && S.lives > 0 && !S.endT) { Object.assign(p, { alive: true, hp: 3, inv: 3, x: S.cam - 26, fy: GROUND + 20, vy: 0 }); S.shT = 2 }
  } else if (p.inVeh && S.veh) stepVeh(dt)
  else stepInfantry(dt)

  // parked tanks: boarding
  for (const vp of S.vp) {
    vp.cool = Math.max(0, (vp.cool || 0) - dt)
    if (p.alive && !p.inVeh && vp.cool <= 0 && Math.abs(p.x - vp.x) < 9 && Math.abs(p.fy - vp.fy) < 8) {
      S.veh = { x: vp.x, fy: vp.fy, vx: 0, vy: 0, hp: vp.hp, maxhp: 10, face: 1, ground: true, hw: 8.5, hh: 4.8, anim: 0, inv: 0.6, flash: 0, recoil: 0 }
      p.inVeh = true; vp.taken = true; S.stats.tank = true
      sfx('vehIn'); speak('Battle tank!'); toast('TANK!  J FIRE · G CANNON · V EXIT', '#7dffb0')
    }
  }
  S.vp = S.vp.filter((v) => !v.taken)

  // camera & spawns
  const track = p.inVeh && S.veh ? S.veh.x : p.x
  if (!S.boss && S.bossState === 'none') S.cam = clamp(Math.max(S.cam, track + 12), 0, S.camMax)
  while (S.si < S.spawns.length && S.cam + 58 >= S.spawns[S.si].x) {
    const ev = S.spawns[S.si++]
    for (let i = 0; i < ev.n; i++) spawnEnemy(ev.type, ev.x + i * 6)
  }
  if (S.bossState === 'none' && S.cam >= st.len - 2) {
    S.bossState = 'warn'; S.warnT = 3.2
    S.banner = { title: 'WARNING', sub: BOSS_DEF[st.boss].name + ' APPROACHING', kind: 'warn', t: 3.2 }
    sfx('alarm'); speak('Warning!'); music.set('slugboss', S.stage)
  }
  if (S.bossState === 'warn') { S.warnT -= dt; if (S.warnT <= 0) spawnBoss() }

  for (const a of S.air) {
    a.delay -= dt
    if (a.delay <= 0 && !a.done) { a.done = true; sfx('whistle'); S.bombs.push({ x: a.x, y: 36, vx: 0, vy: -50, spr: SP.bm, hw: 1.2, hh: 1.5, team: 'p', g: 60, t: 0, r: 9, dmg: 8 }) }
  }
  S.air = S.air.filter((a) => !a.done)
  stepEnemies(dt); stepBoss(dt)

  // player bullets
  for (const b of S.bul) {
    b.t += dt; b.x += b.vx * dt; b.y += b.vy * dt
    if (b.t > b.life || Math.abs(b.x - S.cam) > 60 || b.y > 40 || b.y < GROUND - 3) { b.dead = true; if (b.rocket && b.y <= GROUND + 1) blast(b.x, GROUND, 8, 4, 'p') }
    if (b.dead) continue
    for (const pl of S.plats) if (Math.abs(b.x - pl.x) < pl.w / 2 && b.y < GROUND + pl.h) { b.dead = true; part(b.x, b.y, 0, 0, 0.15, fireCols[1], 1.2); break }
    if (b.dead) continue
    for (const pr of S.props) if (!pr.dead && Math.abs(b.x - pr.x) < pr.hw + b.hw && Math.abs(b.y - (pr.fy + pr.hh)) < pr.hh + b.hh) { b.dead = true; hitProp(pr, b.dmg); if (b.rocket) blast(b.x, b.y, 8, 4, 'p'); break }
    if (b.dead) continue
    for (const e of S.en) {
      if (!alive(e) || Math.abs(b.x - e.x) > e.hw + b.hw || Math.abs(b.y - cy(e)) > e.hh + b.hh) continue
      b.dead = true; hurtE(e, b.dmg); if (b.rocket) blast(b.x, b.y, 8, 4, 'p'); break
    }
    const bo = S.boss
    if (!b.dead && bo && !bo.dying && Math.abs(b.x - bo.x) < bo.hw + b.hw && Math.abs(b.y - cy(bo)) < bo.hh + b.hh) { b.dead = true; hurtBoss(b.dmg); if (b.rocket) blast(b.x, b.y, 8, 4, 'p') }
  }
  const pbx = pbox()
  for (const b of S.ebul) {
    b.t += dt; b.x += b.vx * dt; b.y += b.vy * dt
    if (b.wave) b.y = GROUND + 1.5
    if (Math.abs(b.x - S.cam) > 62 || b.y > 42 || b.y < GROUND - 3) { b.dead = true; continue }
    if (b.rocket && b.y <= GROUND + 0.5) { b.dead = true; blast(b.x, GROUND, 6, 1, 'e'); continue }
    if (S.shT > 0 && Math.hypot(b.x - pbx.x, b.y - pbx.y) < 8) { b.dead = true; part(b.x, b.y, 0, 0, 0.15, COLS.green[1], 1.4); continue }
    if (p.alive && Math.abs(b.x - pbx.x) < pbx.hw + b.hw && Math.abs(b.y - pbx.y) < pbx.hh + b.hh) { b.dead = true; if (b.rocket) blast(b.x, b.y, 6, 1, 'e'); else hurtP(1) }
    else for (const pl of S.plats) if (Math.abs(b.x - pl.x) < pl.w / 2 && b.y < GROUND + pl.h && !b.wave) { b.dead = true; break }
  }
  for (const g of S.bombs) {
    g.t += dt; g.vy -= g.g * dt; g.x += g.vx * dt; g.y += g.vy * dt
    const gnd = groundAt(g.x, 999)
    let hitE = false
    if (g.team === 'p') {
      for (const e of S.en) if (alive(e) && Math.abs(g.x - e.x) < e.hw + 1.2 && Math.abs(g.y - cy(e)) < e.hh + 1.2) hitE = true
      const bo = S.boss
      if (bo && !bo.dying && Math.abs(g.x - bo.x) < bo.hw + 1.2 && Math.abs(g.y - cy(bo)) < bo.hh + 1.2) hitE = true
    } else if (p.alive && Math.abs(g.x - pbx.x) < pbx.hw + 1.2 && Math.abs(g.y - pbx.y) < pbx.hh + 1.2) hitE = true
    if (g.y <= gnd + 1 || hitE) { g.dead = true; blast(g.x, Math.max(g.y, gnd + 1), g.r, g.dmg, g.team) }
  }
  // contact damage & crushing
  if (p.alive) for (const e of S.en) {
    if (!alive(e) || Math.abs(pbx.x - e.x) > pbx.hw + e.hw - 0.5 || Math.abs(pbx.y - cy(e)) > pbx.hh + e.hh - 0.5) continue
    if (p.inVeh && S.veh && MEN.has(e.type)) { killE(e); sfx('crate'); continue }
    if (e.type === 'runner') { hurtP(1); killE(e) } else if (e.type === 'tank' || e.type === 'chop' || e.type === 'jeep') hurtP(1)
  }
  if (p.alive && S.boss && !S.boss.dying && !S.boss.enter && Math.abs(pbx.x - S.boss.x) < pbx.hw + S.boss.hw && Math.abs(pbx.y - cy(S.boss)) < pbx.hh + S.boss.hh) hurtP(1)
  // items
  for (const it of S.items) {
    it.life -= dt
    const g = groundAt(it.x, 999)
    it.vy = (it.vy || 0) - 90 * dt; it.fy += it.vy * dt; if (it.fy <= g) { it.fy = g; it.vy = 0 }
    if (it.life <= 0) it.dead = true
    if (p.alive && Math.abs(pbx.x - it.x) < pbx.hw + it.hw && Math.abs(pbx.y - (it.fy + it.hh)) < pbx.hh + it.hh) {
      it.dead = true; ring(it.x, it.fy + 3, 16, 25, COLS.green)
      if (it.t === 'C') { S.score += 500; popup(it.x, it.fy + 6, '500', [1, 0.9, 0.3]); sfx('medal') }
      else if (CRATE[it.t]) { S.weapon = CRATE[it.t]; S.ammo = WEAPONS[S.weapon].ammo; toast(WEAPONS[S.weapon].name + '!', '#ffe84a'); sfx('reload'); speak({ hmg: 'Heavy machine gun!', shot: 'Shotgun!', rocket: 'Rocket launcher!' }[S.weapon]) }
      else if (it.t === 'B') { S.gren = Math.min(20, S.gren + 6); toast('+6 GRENADES', '#ff4de1'); sfx('pickup') }
      else { p.hp = Math.min(3, p.hp + 1); if (S.veh) S.veh.hp = Math.min(S.veh.maxhp, S.veh.hp + 3); toast('MEDKIT: REPAIRED', '#ff7ab0'); sfx('pickup') }
    }
  }
  // POWs
  for (const w of S.pows) {
    w.t += dt; w.anim += dt * (w.state === 'free' ? 11 : 0)
    const g = groundAt(w.x, 999)
    if (w.state === 'tied') {
      w.fy = g
      if (p.alive && Math.abs(pbx.x - w.x) < pbx.hw + w.hw + 1 && Math.abs(pbx.y - (w.fy + w.hh)) < pbx.hh + w.hh) {
        w.state = 'free'; w.vx = 18; S.stats.pows++; profile.pows++; S.score += 500
        popup(w.x, w.fy + 10, '500', [0.4, 1, 0.6]); toast('POW RESCUED!  +500', '#3dff7a'); sfx('rescue'); speak('Thank you!', 1.4, 1.1)
        const t = ['M', 'S', 'R', 'B'][(Math.random() * 4) | 0]; S.items.push({ x: w.x + 2, fy: g + 4, t, hw: 2.5, hh: 3.5, life: 14, vy: 20 })
      }
    } else { w.x += w.vx * dt; w.fy = groundAt(w.x, 999) }
    if (w.x < S.cam - 70 || w.x > S.cam + 80) w.dead = true
  }
  for (const pr of S.props) { pr.flash = Math.max(0, pr.flash - dt); pr.fy = groundAt(pr.x, 999) }
  // smoke from damaged tank / factory stacks
  if (S.veh && S.veh.hp <= 4 && Math.random() < dt * 14) smoke(S.veh.x, cy(S.veh) + 4, 1, 2.4)
  S.en = S.en.filter((e) => !e.dead); S.bul = S.bul.filter((b) => !b.dead); S.ebul = S.ebul.filter((b) => !b.dead)
  S.bombs = S.bombs.filter((b) => !b.dead); S.items = S.items.filter((b) => !b.dead); S.pows = S.pows.filter((b) => !b.dead); S.props = S.props.filter((b) => !b.dead)
  stepParticles(dt)
  for (const t of S.toasts) t.t -= dt
  S.toasts = S.toasts.filter((t) => t.t > 0)
  if (S.banner) { S.banner.t -= dt; if (S.banner.t <= 0) S.banner = null }
  if (S.endT > 0) {
    S.endT -= dt
    if (S.endT <= 0) {
      S.endT = 0
      if (S.bossState === 'done') finishStage()
      else { S.mode = 'over'; recordScore('slug', S.score); music.stop(); sfx('over'); speak('Mission failed'); emitSlug() }
    }
  }
}

function stepInfantry(dt) {
  const p = S.p
  const ax = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0)
  const up = keys.ArrowUp || keys.KeyW, down = keys.ArrowDown || keys.KeyS
  p.crouch = !!down && p.ground
  p.hh = p.crouch ? 3.5 : 5
  if (ax) p.face = ax
  const spd = p.crouch ? 0 : S.od > 0 ? 30 : 23
  p.vx = ax * spd
  p.x += p.vx * dt
  for (const pl of S.plats) if (p.fy < GROUND + pl.h - 0.8 && Math.abs(p.x - pl.x) < pl.w / 2 + p.hw) p.x = p.x < pl.x ? pl.x - pl.w / 2 - p.hw : pl.x + pl.w / 2 + p.hw
  p.x = clamp(p.x, S.cam - 47, S.cam + 47)
  if (S.jumpReq && p.ground) { p.vy = 48; p.ground = false; sfx('jump') }
  S.jumpReq = false
  const prev = p.fy
  p.vy -= 130 * dt; p.fy += p.vy * dt
  const g = groundAt(p.x, prev)
  if (p.fy <= g && p.vy <= 0) { if (!p.ground && p.vy < -25) { sfx('land'); part(p.x, g + 1, R(-8, 8), R(6, 14), 0.4, SMOKE[0], 1.3, 0.5) } p.fy = g; p.vy = 0; p.ground = true } else p.ground = false
  p.aim = up ? 'up' : down && !p.ground ? 'down' : 'fwd'
  p.anim += dt * (ax && p.ground ? 11 : 0)
  if (ax && p.ground) { const f = Math.floor(p.anim) & 3; if (f !== p.lf) { p.lf = f; if (f % 2 === 0) { sfx('step'); part(p.x - p.face * 2, p.fy + 0.6, -p.face * R(2, 8), R(3, 8), 0.35, SMOKE[1], 1) } } }
  if ((keys.KeyJ || keys.KeyZ || keys.KeyX) && p.fcd <= 0) shoot()
  if (Math.random() < 0.5 && S.od > 0) part(p.x + R(-3, 3), cy(p) + R(-4, 4), R(-10, 10), R(5, 20), 0.4, COLS.purple[1], 1.1)
}
function stepVeh(dt) {
  const p = S.p, v = S.veh
  const ax = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0)
  v.inv = Math.max(0, v.inv - dt); v.flash = Math.max(0, v.flash - dt); v.recoil = Math.max(0, (v.recoil || 0) - dt)
  if (ax) v.face = ax
  v.vx += (ax * 22 - v.vx) * Math.min(1, dt * 6)
  v.x += v.vx * dt
  v.x = clamp(v.x, S.cam - 44, S.cam + 44)
  if (S.jumpReq && v.ground) { v.vy = 34; v.ground = false; sfx('jump') }
  S.jumpReq = false
  const g = Math.max(groundAt(v.x - 6, 999), groundAt(v.x + 6, 999), groundAt(v.x, 999)) // the tank drives over low cover
  if (v.fy < g - 0.01 && v.vy <= 0) { v.fy = Math.min(g, v.fy + 55 * dt); v.vy = 0; v.ground = true }
  else { v.vy -= 120 * dt; v.fy += v.vy * dt }
  if (v.fy <= g && v.vy <= 0) { if (!v.ground && v.vy < -20) { sfx('land'); shake(0.5); smoke(v.x, g + 1, 3, 2.5) } v.fy = g; v.vy = 0; v.ground = true } else v.ground = false
  v.anim += Math.abs(v.vx) * dt * 0.8
  S.engT -= dt
  if (S.engT <= 0) { S.engT = Math.abs(v.vx) > 3 ? 0.18 : 0.42; sfx('tankEngine') }
  if (Math.abs(v.vx) > 6 && Math.random() < dt * 20) smoke(v.x - v.face * 9, v.fy + 2, 1, 1.6)
  p.x = v.x; p.fy = v.fy; p.face = v.face; p.vx = v.vx
  if ((keys.KeyJ || keys.KeyZ || keys.KeyX) && p.fcd <= 0) shoot()
}

function finishStage() {
  const st = S.stats, rate = st.total ? Math.min(1, st.kills / st.total) : 1
  const lines = []
  const kb = Math.round(rate * 2000), pb = st.pows * 1000, nb = st.dmg === 0 ? 3000 : 0, kn = st.knife * 150
  lines.push({ label: `ENEMIES DESTROYED  ${st.kills}/${st.total}`, value: '+' + kb, kind: 'score' })
  lines.push({ label: `POWs RESCUED  ${st.pows}/${st.powTotal}`, value: '+' + pb, kind: 'bonus' })
  if (kn) lines.push({ label: `KNIFE KILLS  ${st.knife}`, value: '+' + kn, kind: 'bonus' })
  if (nb) lines.push({ label: 'FLAWLESS - NO DAMAGE', value: '+' + nb, kind: 'bonus' })
  S.score += kb + pb + nb + kn
  const grade = nb && rate > 0.85 ? 'S' : rate > 0.85 ? 'A' : rate > 0.6 ? 'B' : 'C'
  S.summary = { lines, grade, name: STAGES[S.stage].name, final: S.stage === STAGES.length - 1 }
  if (S.summary.final) {
    const lb = S.lives * 3000; S.score += lb
    S.final = { score: S.score, lifeB: lb, rank: S.score > 130000 ? 'S' : S.score > 85000 ? 'A' : S.score > 48000 ? 'B' : 'C' }
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
    else if (code === 'KeyV') leaveVeh()
    else if (code === 'KeyQ' || code === 'Digit1') airstrike()
    else if (code === 'KeyE' || code === 'Digit2') shield()
    else if (code === 'KeyR' || code === 'Digit3') overdrive()
  } else if (code === 'Enter') {
    if (S.mode === 'clear') startStage(S.stage + 1, false)
    else if (S.mode === 'over') retry()
    else if (S.mode === 'victory') quit()
  }
}
function retry() { S.lives = 3; startStage(S.stage, false); S.lives = 3 }
function next() { startStage(S.stage + 1, false) }
function quit() { toMenu() }
export const slugActions = { pause() { if (S.mode === 'play' && !S.paused) { S.paused = true; emitSlug(); return true } return false }, start, retry, next, quit, resume() { S.paused = false; emitSlug() }, skill(k) { if (k === 'q') airstrike(); else if (k === 'e') shield(); else overdrive() } }

// ---------- rendering ----------
const colCache = {}
const lc = (hex) => colCache[hex] || (colCache[hex] = rgb(hex))
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
const hash = (x) => Math.abs(Math.sin(x * 12.9898) * 43758.5453) % 1

function drawBackdrop(api, st, cam, t) {
  const { put } = api
  const hz = lc(st.horizon), tp = lc(st.top)
  // sky gradient
  for (let y = -24; y < 30; y += 4) {
    const c = mix(hz, tp, clamp((y + 24) / 52, 0, 1))
    for (let x = -52; x <= 52; x += 4) put(x, y + 2, -14, 4.1, 4.1, c[0], c[1], c[2])
  }
  // sun / moon
  const sx = 30 - (cam * 0.02) % 120, sc = st.theme === 'factory' ? [1.6, 1.7, 2.2] : st.theme === 'desert' ? [3, 1.9, 0.6] : [2.6, 2.5, 1.2]
  for (let dx = -6; dx <= 6; dx += 1) for (let dy = -6; dy <= 6; dy += 1) { const d = Math.hypot(dx, dy); if (d < 6) put(sx + dx, 17 + dy, -13, 1.05, 1.05, sc[0] * (d < 5 ? 1 : 0.5), sc[1] * (d < 5 ? 1 : 0.5), sc[2] * (d < 5 ? 1 : 0.5)) }
  // stars (night)
  if (st.theme === 'factory') for (let i = 0; i < 40; i++) { const x = ((hash(i) * 120 - cam * 0.03) % 110 + 110) % 110 - 55, y = 4 + hash(i + 9) * 24, b = 0.6 + 0.4 * Math.sin(t * 3 + i); put(x, y, -13, 0.7, 0.7, 1.4 * b, 1.4 * b, 1.8 * b) }
  // clouds
  const cl = st.theme === 'factory' ? [0.5, 0.45, 0.7] : st.theme === 'desert' ? [1.4, 0.9, 0.7] : [1.1, 1.3, 1.3]
  for (let i = 0; i < 5; i++) {
    const cx = (((i * 31 - t * 1.4 - cam * 0.06) % 150) + 150) % 150 - 75, cyy = 13 + (i % 3) * 3.5
    for (let b = 0; b < 4; b++) put(cx + b * 2.6 - 4, cyy + (b % 2) * 0.9, -12, 3.2, 1.8, cl[0], cl[1], cl[2])
    put(cx - 1, cyy + 1.8, -12, 5, 1.2, cl[0] * 1.1, cl[1] * 1.1, cl[2] * 1.1)
  }
  // far layer
  const far = lc(st.far), near = lc(st.near)
  for (let sxx = -56; sxx <= 56; sxx += 2) {
    const wx = sxx + cam * 0.2
    let h
    if (st.theme === 'desert') { h = 6 + 5 * Math.sin(wx * 0.05) + 2 * Math.sin(wx * 0.17); const pyr = Math.abs(((wx + 40) % 110) - 55); if (pyr < 12) h = Math.max(h, 16 - pyr * 1.1) }
    else if (st.theme === 'factory') { h = 8 + Math.floor(hash(Math.floor(wx / 6)) * 12) }
    else h = 8 + 6 * Math.sin(wx * 0.06) + 3 * Math.sin(wx * 0.2 + 1)
    for (let y = GROUND; y < GROUND + h; y += 2) {
      let k = 1.15
      if (st.theme === 'factory' && ((Math.floor(wx / 6) * 7 + y) % 5 === 0) && hash(Math.floor(wx) + y + Math.floor(t * 0.5)) > 0.5) put(sxx, y, -7.5, 1, 1, 2.2, 2, 0.8)
      put(sxx, y, -8, 2.05, 2.05, far[0] * k, far[1] * k, far[2] * k)
    }
  }
  // near layer
  for (let sxx = -56; sxx <= 56; sxx += 2) {
    const wx = sxx + cam * 0.5
    let h = 3 + 3 * Math.sin(wx * 0.13 + 2) + 2 * Math.sin(wx * 0.37)
    if (st.theme === 'jungle') h += Math.abs(Math.sin(wx * 0.5)) * 3
    for (let y = GROUND; y < GROUND + h; y += 2) put(sxx, y, -5, 2.05, 2.05, near[0] * 1.4, near[1] * 1.4, near[2] * 1.4)
  }
}
function drawHero(api, px, fy, face, sx, sy, k, flashed) {
  const p = S.p
  let key = 'heroS'
  if (!p.ground) key = 'heroJ'; else if (Math.abs(p.vx) > 1) key = 'hero' + (Math.floor(p.anim) & 3)
  api.sprite(SP[key], px, fy + 5.5 * sy, { sx: face, sy, k, flash: flashed })
}
function drawGun(api, px, pcy, p, wn) {
  const { put } = api
  const len = wn === 'pistol' ? 2.5 : wn === 'rocket' ? 7 : wn === 'shot' ? 6 : 5.5
  const gc = wn === 'rocket' ? [0.3, 0.45, 0.2] : wn === 'shot' ? [0.6, 0.35, 0.14] : wn === 'hmg' ? [0.55, 0.6, 0.7] : [0.7, 0.72, 0.8]
  for (let i = 0; i < len; i++) {
    if (p.aim === 'up') put(px + p.face * 2, pcy + 3 + i, 0.5, 1, 1, gc[0] * 1.3, gc[1] * 1.3, gc[2] * 1.3)
    else if (p.aim === 'down') put(px + p.face * 1.5, pcy - 2 - i, 0.5, 1, 1, gc[0] * 1.3, gc[1] * 1.3, gc[2] * 1.3)
    else put(px + p.face * (2 + i), pcy + (p.crouch ? -0.6 : 1), 0.5, 1, 1, gc[0] * 1.3, gc[1] * 1.3, gc[2] * 1.3)
  }
  if (S.mf > 0) { const mx = p.aim === 'up' ? px + p.face * 2 : px + p.face * (2 + len + 1), my = p.aim === 'up' ? pcy + 3 + len + 1 : pcy + (p.crouch ? -0.6 : 1); put(mx, my, 1, 2.6, 2.6, 3, 3, 1.4); put(mx + p.face * 1.2, my, 1, 1.6, 1.6, 3, 2, 0.6) }
}
function draw(api) {
  const { put, sprite } = api
  const st = STAGES[S.stage], cam = S.cam, t = G.time, P = S.p
  drawBackdrop(api, st, cam, t)
  // decor
  for (const d of S.decor) {
    const sx = d.x - cam
    if (sx < -30 || sx > 30 + 50) continue
    const spr = SP[d.type]
    sprite(spr, sx, GROUND + spr.h / 2 - 0.5, { k: 0.8, scale: d.type === 'palm' ? 1.5 : d.type === 'stack' ? 1.4 : 1.1 })
    if (d.type === 'stack') for (let i = 0; i < 6; i++) { const ph = (t * 0.5 + i * 0.17) % 1; put(sx + Math.sin(ph * 6 + i) * 2 + ph * 4, GROUND + spr.h * 1.4 + ph * 14, -1.5, 2 + ph * 3, 2 + ph * 3, 0.5 * (1 - ph), 0.5 * (1 - ph), 0.55 * (1 - ph)) }
  }
  // ground
  for (let sx = -54; sx <= 54; sx += 1) {
    const wx = Math.floor(sx + cam), r = hash(wx)
    const c0 = lc(st.ground[r > 0.5 ? 0 : 1]), c1 = lc(st.ground[2])
    put(sx, GROUND - 0.5, 0, 1.02, 1.02, c1[0], c1[1], c1[2])
    if (r > 0.82) put(sx, GROUND + 0.4, 0, 0.7, 1.2, c1[0] * 1.1, c1[1] * 1.1, c1[2] * 1.1)
    put(sx, GROUND - 1.5, 0, 1.02, 1.02, c0[0], c0[1], c0[2])
    put(sx, GROUND - 2.5, 0, 1.02, 1.02, c0[0] * 0.7, c0[1] * 0.7, c0[2] * 0.7)
    put(sx, GROUND - 3.5, 0, 1.02, 1.02, c0[0] * 0.5, c0[1] * 0.5, c0[2] * 0.5)
  }
  for (const pl of S.plats) {
    const sx = pl.x - cam
    if (sx < -60 || sx > 60) continue
    for (let x = -pl.w / 2; x < pl.w / 2; x += 1) for (let y = 0; y < pl.h; y += 1) {
      const c = lc(((Math.floor(x) + y) & 1) ? '#c8a860' : '#a88848')
      put(sx + x + 0.5, GROUND + y + 0.5, 0.2, 1.02, 1.02, c[0] * 1.3, c[1] * 1.3, c[2] * 1.3)
    }
  }
  for (const pr of S.props) sprite(SP[pr.type], pr.x - cam, pr.fy + (pr.type === 'barrel' ? 3 : 3), { flash: pr.flash > 0, k: 1.2 })
  for (const vp of S.vp) {
    const px = vp.x - cam
    sprite(SP.vsv, px, vp.fy + 5, { k: 1.1 })
    const bob = Math.sin(t * 5) * 0.8
    sprite(SP.crown, px, vp.fy + 14 + bob, { k: 2 })
    put(px, vp.fy + 11.5 + bob, 1, 1.4, 1.4, 2.4, 2.2, 0.5)
  }
  for (const it of S.items) {
    const bob = Math.sin(t * 4 + it.x) * 0.6
    if (it.t === 'C') sprite(SP.coin, it.x - cam, it.fy + 3.5 + bob, { k: 1.8, sx: Math.max(0.2, Math.abs(Math.cos(t * 5))) })
    else sprite(SP['pup' + it.t], it.x - cam, it.fy + 3.5 + bob, { k: 1.4 })
  }
  for (const w of S.pows) {
    const px = w.x - cam
    if (w.state === 'tied') {
      sprite(SP.powS, px, w.fy + 5.5, { sx: -1, k: 1.1 })
      const wave = Math.floor(t * 3) & 1
      put(px + 3, w.fy + 11 + wave, 0.5, 1, 1.6, 1.8, 1.4, 1.1)
      for (let i = 0; i < 3; i++) put(px, w.fy + 3.5 + i, 0.6, 5, 0.7, 0.8, 0.5, 0.2)
    } else sprite(SP['pow' + (Math.floor(w.anim) & 3)], px, w.fy + 5.5, { sx: 1, k: 1.1 })
  }
  // enemies
  for (const e of S.en) {
    if (e.dead) continue
    const px = e.x - cam
    if (e.dying > 0) { sprite(SP[e.pre + 'S'], px, cy(e) + 0.5, { sx: e.face, sy: e.dying > 0.5 ? 1 : -1, k: 1.2 * Math.min(1, e.dying * 3) + 0.2, flash: e.dying > 0.7 }); continue }
    if (e.type === 'tank') sprite(e.spr, px, cy(e) + 0.3, { sx: e.face > 0 ? -1 : 1, flash: e.flash > 0, k: 1.15 })
    else if (e.type === 'jeep') sprite(e.spr, px, cy(e), { sx: e.face > 0 ? -1 : 1, flash: e.flash > 0, k: 1.15 })
    else if (e.type === 'plane') { sprite(e.spr, px, e.fy, { sx: -1, flash: e.flash > 0, k: 1.15 }); for (let i = -1; i <= 1; i++) if (Math.floor(t * 40 + i) % 2) put(px - 9, e.fy + i * 0.8, 0, 2.2, 0.5, 1.2, 1.2, 1.2) }
    else if (e.type === 'chop') {
      sprite(e.spr, px, cy(e), { sx: e.face > 0 ? -1 : 1, flash: e.flash > 0, k: 1.15 })
      for (let i = -8; i <= 8; i++) if (Math.floor(t * 40 + i) % 3) put(px + i, cy(e) + 3.4, 0, 1, 0.5, 1.1, 1.1, 1.1)
    } else {
      let key = e.pre + 'S'
      if (e.para) key = e.pre + 'J'; else if (!e.ground) key = e.pre + 'J'
      else if (e.type === 'runner' || (e.type !== 'sniper' && Math.abs(e.x - (e.px ?? e.x)) > 0.02)) key = e.pre + (Math.floor(e.anim) & 3)
      e.px = e.x
      sprite(SP[key], px, e.fy + 5.5, { sx: e.face, flash: e.flash > 0, k: 1.2 })
      if (e.type === 'baz') for (let i = 0; i < 8; i++) put(px + e.face * (2 + i * 0.9), e.fy + 7.5, 0, 1, 1, 0.3, 0.45, 0.3)
      if (e.type === 'sniper') for (let i = 0; i < 6; i++) put(px + e.face * (2 + i), e.fy + 7.2, 0, 1, 0.7, 0.2, 0.25, 0.2)
      if (e.shoot > 0) put(px + e.face * (e.type === 'baz' ? 9 : 6), e.fy + 7.2, 1, 2.2, 2.2, 3, 2.6, 1)
      if (e.para) { for (let i = -4; i <= 4; i++) put(px + i, e.fy + 17 - Math.abs(i) * 0.18, 0, 1.1, 1, 1.9, 0.4, 0.3); for (const s of [-4, 4]) for (let j = 0; j < 5; j++) put(px + s * (1 - j * 0.2), e.fy + 17 - j * 1.4 - 0.5, 0, 0.35, 1.4, 1.4, 1.4, 1.4) }
      if (e.aiming) { for (let i = 1; i < 60; i += 2) { const f = i / 60; const ax = px - 3 + (S.p.x - e.x) * f, ay = e.fy + 8 + (cy(S.p) - (e.fy + 8)) * f; put(ax, ay, 2, 0.5, 0.5, 2.6, 0.2, 0.2) } }
    }
  }
  const b = S.boss
  if (b) sprite(b.spr, b.x - cam, cy(b), { sx: -1 * (b.sc || 1), scale: b.sc, flash: b.flash > 0, k: 1.2 })
  if (b && b.id === 'hawk') for (let i = -14; i <= 14; i++) if (Math.floor(t * 40 + i) % 3) put(b.x - cam + i, cy(b) + 6.8, 0, 1, 0.7, 1.1, 1.1, 1.1)
  // player / tank
  if (P && P.alive) {
    const v = S.veh
    const blink = P.inv > 0 && Math.floor(t * 18) % 2 === 0 && S.shT <= 0 && S.od <= 0
    if (v) {
      const vx = v.x - cam
      if (!(v.inv > 0 && Math.floor(t * 20) % 2 === 0)) {
        const rec = (v.recoil || 0) * -v.face * 10
        sprite(SP.heroS, vx - v.face * 1, v.fy + 14, { sx: v.face, scale: 0.8, k: 1.3 })
        sprite(SP.vsv, vx + rec * 0.3, v.fy + 5, { sx: v.face, k: 1.2, flash: v.flash > 0 })
        for (let i = 0; i < 18; i += 2) if (Math.floor(v.anim + i) % 2) put(vx - 8.5 + i, v.fy + 1.4, 1, 1, 1, 0.5, 0.5, 0.55)
        const up = keys.ArrowUp || keys.KeyW
        for (let i = 0; i < 9; i++) { const a = up ? 0.9 : 0, bx = vx + v.face * (9 + Math.cos(a) * i) + rec, by = v.fy + 8 + Math.sin(a) * i; put(bx, by, 0.8, 1.1, 1.1, 0.5, 0.58, 0.4) }
        if (S.mf > 0) put(vx + v.face * 20, v.fy + (up ? 15 : 8), 1, 3, 3, 3, 3, 1.4)
      }
    } else if (!blink) {
      const sy = P.crouch ? 0.72 : 1
      const px = P.x - cam, pcy = P.fy + 5.5 * sy
      drawHero(api, px, P.fy, P.face, 1, sy, 1.25, P.knife > 0)
      if (P.knife > 0) for (let i = 0; i < 6; i++) { const a = -1.2 + (1 - P.knife / 0.22) * 2.4 + i * 0.05; put(px + P.face * (3 + Math.cos(a) * 3.5), pcy + Math.sin(a) * 4, 2, 0.9, 0.9, 2.8, 2.8, 3) }
      else drawGun(api, px, pcy, P, S.od > 0 ? 'hmg' : S.weapon)
    }
    const bx = pbox(), pcx = bx.x - cam
    if (S.shT > 0 && (S.shT > 1 || Math.floor(t * 14) % 2 === 0)) for (let i = 0; i < 36; i++) { const a = (i / 36) * 6.28 + t * 3; put(pcx + Math.cos(a) * (bx.hw + 7), bx.y + Math.sin(a) * (bx.hh + 5), 0, 0.9, 0.9, 0.5, 2.6, 1) }
    if (S.od > 0) for (let i = 0; i < 14; i++) { const a = (i / 14) * 6.28 - t * 5; put(pcx + Math.cos(a) * (bx.hw + 4), bx.y + Math.sin(a) * (bx.hh + 3), 0, 0.8, 0.8, 2.4, 0.6, 2.4) }
  }
  for (const q of S.bul) { sprite(q.spr, q.x - cam, q.y, { k: 2, sx: q.vx < 0 ? -1 : 1 }) }
  for (const q of S.ebul) sprite(q.spr, q.x - cam, q.y, { k: 1.9 })
  for (const q of S.bombs) sprite(q.spr, q.x - cam, q.y, { k: 1.5 })
  for (const a of S.air) put(a.x - cam, GROUND + 1, 0, 1.2, 1.2, 2.4, 0.3, 0.3)
  for (const q of G.parts) { const f = q.life / q.max; put(q.x - cam, q.y, 1, q.s * (0.35 + 0.65 * f) * 0.9, q.s * (0.35 + 0.65 * f) * 0.9, q.c[0] * 1.6, q.c[1] * 1.6, q.c[2] * 1.6) }
  api.pops(G.pops, cam)
}
if (typeof window !== 'undefined') { window.__S = S; window.__slug = slugActions }
games.slug = { update, onKey, draw, stop, sky: (i) => STAGES[i].sky, stageIndex: () => S.stage }
