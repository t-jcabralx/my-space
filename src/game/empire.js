// EMPIRE RISE: grow a village into a city and an empire on a large shared map while rival kingdoms and raiders attack you.
// Solo against AI kingdoms, or play with friends online (up to 4 kingdoms; AI fills empty seats). Last kingdom standing, or finish the Wonder, to win.
import { G, emit as engineEmit, keys, games, profile, saveProfile, recordScore, part, ring, shake, flash, stepParticles, toMenu } from './engine.js'
import { sfx, music, speak } from './audio.js'
import { col, disk, rect, circle, clamp, R, rng } from './pxl.js'
import { drawEmpire3, empireCamera, empireLights, empireEnv } from './empire3d.js'
import { pickWeather } from './env4d.js'
import { unprojectGround } from './rogue3d.js'
import { EMCAMP, EMWHO } from './empirestory.js'

export let MW = 96, MH = 96
export const T = 2
let WORLD = MW * T
export const SIZES = [1, 2, 4, 8, 12, 20]
const BASE_SPAWNS = [[22 / 96, 22 / 96], [74 / 96, 74 / 96], [74 / 96, 22 / 96], [22 / 96, 74 / 96]]
// the map is 96 x 96 tiles times the chosen size (up to 20x each way = 1920 x 1920 tiles)
export function setMapSize(k) { const K = SIZES.includes(k) ? k : 4; MW = MH = 96 * K; WORLD = MW * T; SPAWNS.length = 0; for (const [a, b] of BASE_SPAWNS) SPAWNS.push([Math.round(a * MW), Math.round(b * MH)]); return K }
export const TERR = ['grass', 'forest', 'stone', 'gold', 'water']
export const BDEF = {
  hall: { name: 'TOWN HALL', w: 3, hp: 900, cost: {}, ico: '🏰', lv: 1 },
  house: { name: 'HOUSE', w: 2, hp: 170, cost: { wood: 30 }, ico: '🏠', lv: 1, desc: '+6 population' },
  farm: { name: 'FARM', w: 2, hp: 140, cost: { wood: 40 }, ico: '🌾', lv: 1, desc: 'Makes food', rate: { food: 1.0 } },
  lumber: { name: 'LUMBER CAMP', w: 2, hp: 150, cost: { wood: 35 }, ico: '🪓', lv: 1, desc: 'Wood. Build next to forest.', res: 1, rate: { wood: 1.4 } },
  quarry: { name: 'QUARRY', w: 2, hp: 170, cost: { wood: 45 }, ico: '⛏️', lv: 1, desc: 'Stone. Build next to rock.', res: 2, rate: { stone: 1.0 } },
  mine: { name: 'GOLD MINE', w: 2, hp: 170, cost: { wood: 60, stone: 30 }, ico: '💰', lv: 2, desc: 'Gold. Build next to ore.', res: 3, rate: { gold: 0.7 } },
  barracks: { name: 'BARRACKS', w: 3, hp: 420, cost: { wood: 100, stone: 60 }, ico: '⚔️', lv: 1, desc: 'Trains soldiers' },
  tower: { name: 'WATCH TOWER', w: 2, hp: 320, cost: { wood: 50, stone: 90 }, ico: '🗼', lv: 1, desc: 'Shoots enemies' },
  wall: { name: 'WALL', w: 1, hp: 280, cost: { stone: 12 }, ico: '🧱', lv: 1, desc: 'Blocks the way' },
  wonder: { name: 'WONDER', w: 4, hp: 1800, cost: { wood: 700, stone: 700, gold: 600 }, ico: '🗽', lv: 4, desc: 'Hold it for 2.5 minutes to win' },
}
export const BORDER = ['house', 'farm', 'lumber', 'quarry', 'mine', 'barracks', 'tower', 'wall', 'wonder']
export const HALL_UP = [null, { wood: 150, stone: 100 }, { wood: 400, stone: 300, gold: 150 }, { wood: 900, stone: 700, gold: 400 }]
export const HALL_NAME = ['', 'VILLAGE', 'TOWN', 'CITY', 'EMPIRE']
export const UDEF = {
  sword: { name: 'SWORDSMAN', ico: '🗡️', hp: 60, dmg: 11, rate: 0.9, range: 2.6, spd: 11, cost: { food: 40, wood: 20 }, pop: 1, t: 3, lv: 1 },
  archer: { name: 'ARCHER', ico: '🏹', hp: 36, dmg: 8, rate: 1.1, range: 14, spd: 10, cost: { food: 30, wood: 40 }, pop: 1, t: 4, lv: 1 },
  knight: { name: 'KNIGHT', ico: '🐎', hp: 130, dmg: 19, rate: 0.8, range: 2.8, spd: 17, cost: { food: 60, gold: 40 }, pop: 2, t: 6, lv: 3 },
  catapult: { name: 'CATAPULT', ico: '☄️', hp: 90, dmg: 30, rate: 3, range: 20, spd: 6, cost: { wood: 80, stone: 60, gold: 50 }, pop: 3, t: 10, lv: 4, siege: true },
  raider: { name: 'RAIDER', hp: 55, dmg: 10, rate: 1, range: 2.6, spd: 10, pop: 0 },
  rbrute: { name: 'RAID BRUTE', hp: 170, dmg: 20, rate: 1.3, range: 3, spd: 7, pop: 0 },
  rarcher: { name: 'RAID ARCHER', hp: 40, dmg: 9, rate: 1.2, range: 14, spd: 9, pop: 0 },
}
export const TEAM = [['#3de8ff', 'AZURE'], ['#ff5a6a', 'CRIMSON'], ['#ffd23a', 'GOLDEN'], ['#b27aff', 'VIOLET']]
const RES = ['food', 'wood', 'stone', 'gold']

export const EM = { mode: 'idle', paused: false, cfg: { ai: 3, diff: 2, speed: 1 }, seed: 1, terr: null, occ: null, B: [], U: [], P: [], me: 0, t: 0, nid: 1, cam: { x: 0, y: 0, z: 1 }, sel: null, build: null, atk: false, msg: null, over: null, emitT: 0, raidT: 75, raidN: 0, raidWarn: 0, raidDir: '', wonder: null, net: null, alerts: [], fx: [], speed: 1, hover: null, drag: null, snapT: 0, bsnapT: 0, minimap: 0, scen: null, obj: [], tale: null, beat: null, objT: 0, raidGap: 0, raidScale: 1, warn: null, warnN: 0, cam3: null }
let snap = null
const subs = new Set()
export const subscribeEmpire = (f) => { subs.add(f); return () => subs.delete(f) }
export const getEmpireSnap = () => snap

const ix = (i, j) => j * MW + i
const inMap = (i, j) => i >= 0 && j >= 0 && i < MW && j < MH
const costOk = (res, cost) => RES.every((k) => (res[k] || 0) >= (cost[k] || 0))
const pay = (res, cost) => { for (const k of RES) res[k] -= cost[k] || 0 }
const hall = (pi) => EM.B.find((b) => b.owner === pi && b.type === 'hall' && b.hp > 0)

// ---------- map generation ----------
function vnoise(r, n) { const a = Array.from({ length: n * n }, () => r()); return (x, y) => { const gx = x * (n - 1), gy = y * (n - 1), i = Math.min(n - 2, gx | 0), j = Math.min(n - 2, gy | 0), fx = gx - i, fy = gy - j; const s = (u) => u * u * (3 - 2 * u); const v = (a0, a1, f) => a0 + (a1 - a0) * s(f); return v(v(a[j * n + i], a[j * n + i + 1], fx), v(a[(j + 1) * n + i], a[(j + 1) * n + i + 1], fx), fy) } }
export const SPAWNS = [[22, 22], [74, 74], [74, 22], [22, 74]]
function genMap(seed) {
  const Kn = MW / 96, r = rng(seed * 7919 + 13), n1 = vnoise(r, Math.round(9 * Kn)), n2 = vnoise(r, Math.round(17 * Kn)), n3 = vnoise(r, Math.round(13 * Kn))
  const t = new Uint8Array(MW * MH)
  for (let j = 0; j < MH; j++) for (let i = 0; i < MW; i++) {
    const x = i / (MW - 1), y = j / (MH - 1)
    const h = n1(x, y) * 0.7 + n2(x, y) * 0.3, f = n3(x, y), e = Math.min(x, y, 1 - x, 1 - y)
    let v = 0
    if (h < 0.3 && e > 0.04) v = 4 // lakes
    else if (e < 0.02) v = 4
    else if (h > 0.72) v = 2 // mountains
    else if (f > 0.58 && h > 0.35) v = 1 // forests
    t[ix(i, j)] = v
  }
  // gold veins inside the mountains and some scattered ore
  for (let k = 0, kn = Math.round(140 * Kn * Kn); k < kn; k++) { const i = (r() * MW) | 0, j = (r() * MH) | 0; if (t[ix(i, j)] === 2 && r() < 0.5) t[ix(i, j)] = 3 }
  // on big maps make sure every kingdom starts on dry land: no lakes within 30 tiles of a spawn
  if (Kn > 1) for (const [sx, sy] of SPAWNS) for (let j = -30; j <= 30; j++) for (let i = -30; i <= 30; i++) { if (Math.hypot(i, j) < 30 && inMap(sx + i, sy + j) && t[ix(sx + i, sy + j)] === 4 && Math.min(sx + i, sy + j, MW - 1 - sx - i, MH - 1 - sy - j) > 3) t[ix(sx + i, sy + j)] = 0 }
  // clear and enrich every spawn: grass around the hall, a forest, rock and gold nearby
  for (const [sx, sy] of SPAWNS) {
    for (let j = -9; j <= 9; j++) for (let i = -9; i <= 9; i++) { const d = Math.hypot(i, j); if (d < 8.5 && inMap(sx + i, sy + j)) t[ix(sx + i, sy + j)] = 0 }
    for (let k = 0; k < 4; k++) { const a = (k / 4) * 6.28 + (sx + sy) * 0.1, d = 11; const cx = Math.round(sx + Math.cos(a) * d), cy = Math.round(sy + Math.sin(a) * d); const kind = [1, 2, 1, 3][k]; for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) { if (Math.hypot(i, j) < 3.2 && inMap(cx + i, cy + j) && t[ix(cx + i, cy + j)] !== 4) t[ix(cx + i, cy + j)] = kind === 3 ? (Math.hypot(i, j) < 1.6 ? 3 : 2) : kind } }
  }
  return t
}

// ---------- state / lifecycle ----------
function newPlayer(i, kind, name) { return { i, kind, name, alive: true, res: { food: 120, wood: 220, stone: 110, gold: 60 }, hallLv: 1, ai: kind === 'ai' ? { t: R(0, 2), atkT: 85 + R(0, 30), want: null } : null, kills: 0, lost: 0, pid: null } }
function start(cfg = {}) {
  const online = cfg.type === 'online' && EM.net
  const sc = cfg.scen !== undefined && cfg.scen !== null && !online ? EMCAMP[clamp(cfg.scen | 0, 0, EMCAMP.length - 1)] : null
  EM.scen = sc; EM.scenIdx = sc ? EMCAMP.indexOf(sc) : -1
  if (sc) { cfg = { ...cfg, ai: sc.ai, diff: sc.diff, seed: sc.seed } }
  EM.cfg = { ai: sc ? sc.ai : clamp(cfg.ai | 0 || 3, 0, 3), diff: clamp(cfg.diff | 0 || 2, 1, 3), speed: 1, type: online ? 'online' : 'solo', seed: cfg.seed }
  if (!online) EM.net = null
  EM.seed = cfg.seed || ((Math.random() * 1e6) | 0) + 1
  { const wr = rng(EM.seed * 17 + 3); EM.tod0 = 0.3 + wr() * 0.3; EM.weather = pickWeather(EM.seed, { clear: 0.55, rain: 0.2, fog: 0.15, snow: 0.1 }) }
  EM.size = setMapSize(sc ? 1 : (cfg.size || profile.empireSize || 4))
  EM.terr = genMap(EM.seed); EM.occ = new Int32Array(MW * MH)
  EM.B = []; EM.U = []; EM.fx = []; EM.alerts = []; EM.t = 0; EM.nid = 1; EM.sel = null; EM.build = null; EM.atk = false; EM.over = null; EM.paused = false; EM.msg = null; EM.raidT = 75; EM.raidN = 0; EM.raidWarn = 0; EM.wonder = null; EM.speed = 1; EM.peers = cfg.peers || []
  const humans = online ? 1 + EM.peers.length : 1
  const total = Math.min(4, Math.max(sc && sc.ai === 0 ? 1 : 2, humans + EM.cfg.ai))
  EM.P = []
  for (let i = 0; i < total; i++) {
    const human = i < humans
    const nm = human ? (i === 0 ? (profile.name || 'YOU') : (EM.peers[i - 1] ? EM.peers[i - 1].name : 'FRIEND')) : TEAM[i][1] + ' AI'
    const pl = newPlayer(i, human ? 'human' : 'ai', String(nm).slice(0, 12)); if (human && i > 0) pl.pid = EM.peers[i - 1].id
    EM.P.push(pl)
  }
  EM.me = EM.net && EM.net.role === 'guest' ? (cfg.me | 0) : 0
  EM.obj = sc ? sc.objectives.map((o) => ({ ...o, done: false })) : []; EM.tale = null; EM.beat = null; EM.objT = 0
  EM.raidGap = sc ? sc.raids.gap : 0; EM.raidScale = sc ? sc.raids.scale : 1; EM.raidT = sc ? sc.raids.first : 75
  if (sc) { EM.P[0].res = { ...sc.res }; for (const pl of EM.P) if (pl.kind === 'ai') { pl.ai.atkT = sc.aiAtk + R(0, 25); for (const k of RES) pl.res[k] = sc.res[k] * (0.8 + EM.cfg.diff * 0.15) } }
  for (const pl of EM.P) {
    const [sx, sy] = SPAWNS[pl.i]
    place('hall', sx - 1, sy - 1, pl.i, true)
    place('farm', sx + 3, sy - 1, pl.i, true); place('lumber', sx - 4, sy + 1, pl.i, true); place('house', sx - 1, sy + 3, pl.i, true)
    for (let k = 0; k < 3; k++) spawnUnit('sword', pl.i, (sx + k - 1) * T + 1, (sy - 3) * T)
  }
  const h = hall(EM.me); EM.cam = { x: h ? (h.x + 1.5) * T : WORLD / 2, y: h ? (h.y + 1.5) * T : WORLD / 2, z: 1 }
  G.mode = 'empire'; engineEmit(); G.parts = []; G.pops = []; EM.mode = 'play'
  EM.msg = { text: sc ? sc.name : 'EMPIRE RISE', sub: sc ? sc.brief : 'GROW YOUR VILLAGE. DEFEND IT. CONQUER.', color: '#ffd23a', t: 4 }
  if (sc && sc.intro) EM.tale = { lines: sc.intro, i: 0, kind: 'intro' }
  music.set('bomber', 0); sfx('mission'); emitE()
}
function stop() { EM.mode = 'idle'; EM.paused = false; if (EM.net) { const n = EM.net; EM.net = null; if (n.onStop) try { n.onStop() } catch { /* ignore */ } } music.set('menu'); emitE() }
function place(type, i, j, owner, free) {
  const d = BDEF[type], b = { id: EM.nid++, type, x: i, y: j, w: d.w, owner, hp: d.hp, max: d.hp, lv: 1, q: [], qt: 0, acc: 0, atkT: 0, hit: 0, built: free ? 1 : 0 }
  if (type === 'hall') b.max = b.hp = d.hp
  for (let y = 0; y < d.w; y++) for (let x = 0; x < d.w; x++) if (inMap(i + x, j + y)) EM.occ[ix(i + x, j + y)] = b.id
  EM.B.push(b)
  return b
}
function removeB(b) { for (let y = 0; y < b.w; y++) for (let x = 0; x < b.w; x++) if (inMap(b.x + x, b.y + y) && EM.occ[ix(b.x + x, b.y + y)] === b.id) EM.occ[ix(b.x + x, b.y + y)] = 0 }
const bById = (id) => EM.B.find((b) => b.id === id)
function spawnUnit(type, owner, x, y) { const d = UDEF[type]; const u = { id: EM.nid++, type, owner, x, y, hp: d.hp, max: d.hp, atkT: Math.random(), order: null, tgt: 0, tb: 0, face: 0, vx: 0, vy: 0, flash: 0 }; EM.U.push(u); return u }
export function canPlace(type, i, j, owner) {
  const d = BDEF[type]
  for (let y = 0; y < d.w; y++) for (let x = 0; x < d.w; x++) {
    const a = i + x, b = j + y
    if (!inMap(a, b)) return false
    if (EM.occ[ix(a, b)] || EM.terr[ix(a, b)] === 4) return false
    const tt = EM.terr[ix(a, b)]
    if (tt === 1 || tt === 2 || tt === 3) return false // resources are harvested next to, not built on
  }
  // buildings must be near your own hall / buildings (territory)
  const h = hall(owner); if (!h) return false
  let near = false
  for (const bb of EM.B) { if (bb.owner !== owner) continue; if (Math.abs(bb.x + bb.w / 2 - (i + d.w / 2)) < 16 + h.lv * 3 && Math.abs(bb.y + bb.w / 2 - (j + d.w / 2)) < 16 + h.lv * 3) { near = true; break } }
  return near
}
const countB = (owner, type) => EM.B.filter((b) => b.owner === owner && b.type === type).length
const bldCap = (owner) => 14 + (hall(owner) ? hall(owner).lv : 1) * 10
function popOf(owner) { let used = 0; for (const u of EM.U) if (u.owner === owner) used += UDEF[u.type].pop; for (const b of EM.B) if (b.owner === owner) for (const q of b.q) used += UDEF[q.u].pop; const h = hall(owner); let cap = h ? 10 + (h.lv - 1) * 6 : 0; for (const b of EM.B) if (b.owner === owner && b.type === 'house' && b.built) cap += 6; return [used, cap] }
function resNear(b, kind) { let n = 0; for (let y = -3; y < b.w + 3; y++) for (let x = -3; x < b.w + 3; x++) { if (inMap(b.x + x, b.y + y) && EM.terr[ix(b.x + x, b.y + y)] === kind) n++ } return n }
const prodMul = (owner) => { const h = hall(owner); return 1 + 0.25 * ((h ? h.lv : 1) - 1) }

// ---------- commands (the same path for the local player, the AI and friends) ----------
export function doBuild(pi, type, i, j) {
  const pl = EM.P[pi], d = BDEF[type]
  if (!pl || !pl.alive || !d || type === 'hall') return false
  const h = hall(pi); if (!h || h.lv < d.lv) return false
  if (countB(pi, type) >= (type === 'wonder' ? 1 : 99) || EM.B.filter((b) => b.owner === pi).length >= bldCap(pi)) return false
  if (!costOk(pl.res, d.cost) || !canPlace(type, i, j, pi)) return false
  pay(pl.res, d.cost)
  const b = place(type, i, j, pi, false); b.hp = Math.round(b.max * 0.4); b.bt = 4 + d.w * 2 // construction time
  if (type === 'wonder') { b.bt = 40 }
  return b
}
export function doTrain(pi, bid, ut) {
  const pl = EM.P[pi], b = bById(bid), d = UDEF[ut]
  if (!pl || !b || b.owner !== pi || b.type !== 'barracks' || !b.built || !d || d.pop === 0) return false
  const h = hall(pi); if (!h || h.lv < d.lv || b.q.length >= 5) return false
  const [used, cap] = popOf(pi); if (used + d.pop > cap) { return false }
  if (!costOk(pl.res, d.cost)) return false
  pay(pl.res, d.cost); b.q.push({ u: ut, t: d.t }); return true
}
export function doUpgrade(pi, bid) {
  const pl = EM.P[pi], b = bById(bid)
  if (!pl || !b || b.owner !== pi || b.type !== 'hall' || b.lv >= 4) return false
  const c = HALL_UP[b.lv]; if (!costOk(pl.res, c)) return false
  pay(pl.res, c); b.lv++; b.max += 350; b.hp = Math.min(b.max, b.hp + 350); pl.hallLv = b.lv
  ring((b.x + 1.5) * T, (b.y + 1.5) * T, 40, 50, [col('#ffd23a')]); if (pi === EM.me) { sfx('emUp'); EM.msg = { text: 'YOUR ' + HALL_NAME[b.lv - 1] + ' BECOMES A ' + HALL_NAME[b.lv], sub: b.lv === 4 ? 'THE WONDER CAN NOW BE BUILT' : 'NEW BUILDINGS AND UNITS UNLOCKED', color: '#ffd23a', t: 3.5 } }
  return true
}
export function doAttack(pi, x, y, tid) {
  for (const u of EM.U) if (u.owner === pi) { u.order = { x, y, tid: tid || 0 }; u.tgt = 0 }
  return true
}
export function doRecall(pi) { const h = hall(pi); if (!h) return; for (const u of EM.U) if (u.owner === pi) { u.order = null; u.tgt = 0; u.home = true; u.hx = (h.x + 1.5) * T + R(-6, 6); u.hy = (h.y + 4.2) * T + R(-3, 3) } }
function command(pi, c) {
  if (!c) return
  if (c.k === 'build') return doBuild(pi, c.t, c.i | 0, c.j | 0)
  if (c.k === 'train') return doTrain(pi, c.b | 0, c.u)
  if (c.k === 'up') return doUpgrade(pi, c.b | 0)
  if (c.k === 'atk') return doAttack(pi, +c.x, +c.y, c.t | 0)
  if (c.k === 'rec') return doRecall(pi)
}
function localCmd(c) {
  if (EM.net && EM.net.role === 'guest') { EM.net.cmd(c); return true }
  return command(EM.me, c)
}

// ---------- simulation ----------
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
const nearCam = (x, y) => Math.abs(x - EM.cam.x) < 70 / EM.cam.z && Math.abs(y - EM.cam.y) < 45 / EM.cam.z
const hostile = (a, b) => a !== b
function bCenter(b) { return { x: (b.x + b.w / 2) * T, y: (b.y + b.w / 2) * T } }
function nearestFoe(u, range, buildings) {
  let best = null, bd = range
  for (const o of EM.U) { if (o.owner === u.owner || o.hp <= 0) continue; const d = dist(u, o); if (d < bd) { bd = d; best = { u: o } } }
  if (buildings) for (const b of EM.B) { if (b.owner === u.owner || b.hp <= 0 || !b.built) continue; const c = bCenter(b), d = Math.hypot(c.x - u.x, c.y - u.y) - b.w * T / 2; if (d < bd) { bd = d; best = { b } } }
  return best
}
function hurtUnit(o, d, by) {
  if (o.hp <= 0) return
  o.hp -= d; o.flash = 0.1
  if (o.hp <= 0) { if (by !== undefined && by >= 0 && EM.P[by]) EM.P[by].kills++; for (let i = 0; i < 6; i++) part(o.x, o.y, R(-14, 14), R(-14, 14), 0.4, col(o.owner >= 0 ? TEAM[o.owner][0] : '#ff8a5a'), R(0.8, 1.3)) }
  if (o.owner >= 0 && o.owner === EM.me && o.hp > 0) alert(o.x, o.y, 'under attack')
}
function hurtBuilding(b, d, by) {
  if (b.hp <= 0) return
  b.hp -= d; b.hit = 0.12
  if (b.owner === EM.me) alert((b.x + b.w / 2) * T, (b.y + b.w / 2) * T, 'under attack')
  if (b.hp <= 0) {
    removeB(b); const c = bCenter(b); shake(0.4); if (nearCam(c.x, c.y) || b.owner === EM.me) sfx('emBoom'); ring(c.x, c.y, 30, 40, [col('#ff9a3a')])
    for (let i = 0; i < 18; i++) part(c.x, c.y, R(-30, 30), R(-30, 30), R(0.4, 1), col(['#ff6a3a', '#ffb04a', '#8a8a9a'][(Math.random() * 3) | 0]), R(1, 2))
    if (b.type === 'hall') eliminate(b.owner, by)
    if (by >= 0 && EM.P[by]) EM.P[by].kills += 2
  }
}
function alert(x, y, what) { if (EM.alerts.length && EM.t - EM.alerts[EM.alerts.length - 1].t < 6) return; EM.alerts.push({ x, y, t: EM.t, what }); if (EM.alerts.length > 4) EM.alerts.shift(); sfx('emAlarm'); EM.msg = { text: 'YOUR KINGDOM IS UNDER ATTACK!', sub: 'CLICK THE MINIMAP TO JUMP THERE', color: '#ff5a6a', t: 2.2 } }
function eliminate(pi, by) {
  const pl = EM.P[pi]; if (!pl || !pl.alive) return
  pl.alive = false
  for (const b of EM.B) if (b.owner === pi && b.hp > 0) { b.hp = 0; removeB(b) }
  EM.B = EM.B.filter((b) => b.hp > 0)
  for (const u of EM.U) if (u.owner === pi) u.hp = 0
  EM.msg = { text: pl.name + ' HAS FALLEN', sub: by >= 0 && EM.P[by] ? 'DEFEATED BY ' + EM.P[by].name : 'RAIDERS DESTROYED THEM', color: '#ff5a6a', t: 3 }
  sfx('over')
}
// when enemies come near a kingdom's buildings, every idle soldier of that kingdom runs to meet them
function computeThreats() {
  EM.threat = {}
  for (const b of EM.B) {
    if (b.owner < 0) continue
    const c = bCenter(b)
    for (const u of EM.U) { if (u.owner === b.owner || u.hp <= 0) continue; const d = Math.hypot(u.x - c.x, u.y - c.y); if (d < 30 && (!EM.threat[b.owner] || d < EM.threat[b.owner].d)) EM.threat[b.owner] = { x: u.x, y: u.y, d } }
  }
}
function stepUnits(dt) {
  EM.thrT = (EM.thrT || 0) - dt; if (EM.thrT <= 0) { EM.thrT = 0.5; computeThreats() }
  // buckets for separation and targeting
  const bk = new Map(); const key = (x, y) => ((x / 4) | 0) * 1000 + ((y / 4) | 0)
  for (const u of EM.U) { const k = key(u.x, u.y); if (!bk.has(k)) bk.set(k, []); bk.get(k).push(u) }
  for (const u of EM.U) {
    if (u.hp <= 0) continue
    const d = UDEF[u.type]
    u.atkT -= dt; u.flash = Math.max(0, u.flash - dt)
    // choose a target
    let tgt = null
    if (u.tgt) { const o = EM.U.find((x) => x.id === u.tgt); if (o && o.hp > 0 && dist(u, o) < 26) tgt = { u: o }; else u.tgt = 0 }
    if (!tgt && u.tb) { const b = bById(u.tb); if (b && b.hp > 0) tgt = { b }; else u.tb = 0 }
    const aggro = u.order || u.owner < 0 ? 13 : (EM.threat && EM.threat[u.owner] ? 24 : 11)
    if (!tgt) { const f = nearestFoe(u, aggro, !!u.order || u.owner < 0); if (f) { tgt = f; if (f.u) u.tgt = f.u.id; else u.tb = f.b.id } }
    let goal = null
    if (tgt) {
      const c = tgt.u ? tgt.u : bCenter(tgt.b), rad = tgt.b ? tgt.b.w * T / 2 : 0, dd = Math.hypot(c.x - u.x, c.y - u.y) - rad
      if (dd <= d.range + 0.3) {
        u.face = Math.atan2(c.y - u.y, c.x - u.x)
        if (u.atkT <= 0) {
          u.atkT = d.rate
          const dmg = d.dmg * (d.siege && tgt.b ? 3 : 1)
          if (d.range > 6) { EM.fx.push({ k: 'shot', x0: u.x, y0: u.y, x1: c.x, y1: c.y, l: 0.18, c: d.siege ? '#ff9a3a' : '#ffffff' }); if (nearCam(u.x, u.y)) sfx(d.siege ? 'emCata' : 'emBow') } else if (nearCam(u.x, u.y)) sfx('emSword')
          if (tgt.u) hurtUnit(tgt.u, dmg, u.owner); else hurtBuilding(tgt.b, dmg, u.owner)
        }
      } else goal = { x: c.x, y: c.y }
    } else if (u.order) {
      const dx = u.order.x - u.x, dy = u.order.y - u.y
      if (Math.hypot(dx, dy) < 3) u.order = null; else goal = { x: u.order.x, y: u.order.y }
    } else if (u.home) { if (Math.hypot(u.hx - u.x, u.hy - u.y) < 2) u.home = false; else goal = { x: u.hx, y: u.hy } }
    else if (u.owner >= 0 && EM.threat && EM.threat[u.owner]) { const th = EM.threat[u.owner]; goal = { x: th.x, y: th.y } } // auto-defend: run to the attackers
    else if (u.owner >= 0) { // idle soldiers gather near their hall
      const h = hall(u.owner); if (h) { const hx = (h.x + 1.5) * T, hy = (h.y + 5) * T; if (Math.hypot(hx - u.x, hy - u.y) > 16) goal = { x: hx + R(-5, 5), y: hy + R(-3, 3) } }
    }
    if (goal) moveUnit(u, goal, d, dt)
    // soft separation
    const k0 = key(u.x, u.y)
    for (const dk of [0, 1, -1, 1000, -1000]) { const l = bk.get(k0 + dk); if (!l) continue; for (const o of l) { if (o === u || o.hp <= 0) continue; const dx = u.x - o.x, dy = u.y - o.y, dd = Math.hypot(dx, dy); if (dd < 1.5 && dd > 0.01) { const push = (1.5 - dd) * 4 * dt; const nx = u.x + (dx / dd) * push, ny = u.y + (dy / dd) * push; if (passable(nx, ny, u.owner)) { u.x = nx; u.y = ny } } } }
  }
  // dead units are removed after the whole pass
  EM.U = EM.U.filter((u) => u.hp > 0)
}
function passable(x, y, owner) { const i = (x / T) | 0, j = (y / T) | 0; if (!inMap(i, j)) return false; if (EM.terr[ix(i, j)] === 4) return false; const id = EM.occ[ix(i, j)]; if (id) { const b = bById(id); if (b && (b.owner !== owner || b.type === 'wall') && b.hp > 0) return false } return true }
function moveUnit(u, goal, d, dt) {
  const dx = goal.x - u.x, dy = goal.y - u.y, l = Math.hypot(dx, dy) || 1
  const sp = d.spd * dt
  const base = Math.atan2(dy, dx)
  for (const off of [0, 0.7, -0.7, 1.4, -1.4, 2.1, -2.1]) {
    const a = base + off, nx = u.x + Math.cos(a) * sp, ny = u.y + Math.sin(a) * sp
    if (passable(nx, ny, u.owner)) { u.x = nx; u.y = ny; u.face = a; return }
    if (off === 0) { // something is in the way: an enemy building is attacked
      const i = (nx / T) | 0, j = (ny / T) | 0
      if (inMap(i, j) && EM.occ[ix(i, j)]) { const b = bById(EM.occ[ix(i, j)]); if (b && b.owner !== u.owner && b.hp > 0) { u.tb = b.id; return } }
    }
  }
  void l
}
function stepBuildings(dt) {
  for (const pl of EM.P) { if (!pl.alive) continue; pl.res.food += 0.3 * dt * prodMul(pl.i); pl.res.wood += 0.3 * dt * prodMul(pl.i) }
  for (const b of EM.B) {
    if (b.hit > 0) b.hit -= dt
    const pl = EM.P[b.owner]; if (!pl || !pl.alive) continue
    if (!b.built) { b.bt -= dt; b.hp = Math.min(b.max, b.hp + b.max * 0.6 * dt / Math.max(1, (b.type === 'wonder' ? 40 : 4 + b.w * 2))); if (b.bt <= 0) { b.built = 1; b.hp = b.max; if (b.owner === EM.me) sfx('emDone'); ring((b.x + b.w / 2) * T, (b.y + b.w / 2) * T, 14, 24, [col(TEAM[b.owner][0])]) } continue }
    const d = BDEF[b.type]
    if (d.rate) { const m = d.res ? clamp(resNear(b, d.res) / 10, 0.3, 1.6) : 1; for (const k in d.rate) pl.res[k] += d.rate[k] * m * prodMul(b.owner) * dt }
    if (b.type === 'barracks' && b.q.length) { b.qt += dt; const q = b.q[0], ud = UDEF[q.u]; if (b.qt >= ud.t) { b.qt = 0; b.q.shift(); const h = hall(b.owner); const sx = (b.x + 1.5) * T, sy = (b.y - 0.8) * T; spawnUnit(q.u, b.owner, sx + R(-2, 2), sy); if (h && b.owner === EM.me) sfx('emReady') } }
    if (b.type === 'tower' || b.type === 'hall') {
      b.atkT -= dt
      if (b.atkT <= 0) { const c = bCenter(b), rng2 = b.type === 'tower' ? 17 + (b.lv || 1) : 15; let best = null, bd = rng2; for (const u of EM.U) if (u.owner !== b.owner && u.hp > 0) { const dd = Math.hypot(u.x - c.x, u.y - c.y); if (dd < bd) { bd = dd; best = u } } if (best) { b.atkT = b.type === 'tower' ? 1.2 : 1.4; EM.fx.push({ k: 'shot', x0: c.x, y0: c.y + 1, x1: best.x, y1: best.y, l: 0.15, c: '#ffe84a' }); sfx('tdShot'); hurtUnit(best, b.type === 'tower' ? 12 : 9, b.owner) } else b.atkT = 0.3 }
    }
  }
  EM.B = EM.B.filter((b) => b.hp > 0)
}
function stepRaiders(dt) {
  EM.raidT -= dt
  if (EM.raidT <= 12 && !EM.raidWarn) {
    const side = ['NORTH', 'SOUTH', 'EAST', 'WEST'][(Math.random() * 4) | 0]; EM.raidDir = side; EM.raidWarn = 12
    EM.msg = { text: 'RAIDERS FROM THE ' + side + '!', sub: 'WAVE ' + (EM.raidN + 1) + ' ARRIVES IN 12 SECONDS · BUILD TOWERS AND WALLS', color: '#ff9a3a', t: 4 }; sfx('emHorn'); speak('Raiders approaching', 0.5, 1)
  }
  if (EM.raidT <= 0) {
    EM.raidN++; EM.raidAt = EM.t; EM.raidWarn = 0; EM.raidT = EM.raidGap ? Math.max(40, EM.raidGap - EM.raidN * 2) : Math.max(42, 80 - EM.raidN * 4)
    const alivePl = EM.P.filter((p) => p.alive && hall(p.i)); if (!alivePl.length) return
    const hums = alivePl.filter((p) => p.kind === 'human'), pool = hums.length && Math.random() < 0.75 ? hums : alivePl
    const target = pool[(Math.random() * pool.length) | 0], h = hall(target.i), hc = bCenter(h)
    const n = Math.max(2, Math.round((3 + Math.floor(EM.raidN * 1.8) + (EM.cfg.diff - 1) * 2) * EM.raidScale))
    // raiders appear at most ~140 world units from the village they attack, so a huge map does not mean a ten-minute walk
    const RD = 140, sx = clamp(EM.raidDir === 'WEST' ? hc.x - RD : EM.raidDir === 'EAST' ? hc.x + RD : hc.x + R(-70, 70), 4, WORLD - 4), sy = clamp(EM.raidDir === 'SOUTH' ? hc.y - RD : EM.raidDir === 'NORTH' ? hc.y + RD : hc.y + R(-70, 70), 4, WORLD - 4)
    for (let i = 0; i < n; i++) { const type = EM.raidN >= 3 && i % 5 === 0 ? 'rbrute' : i % 4 === 3 ? 'rarcher' : 'raider'; const u = spawnUnit(type, -1, sx + R(-6, 6), sy + R(-6, 6)); u.order = { x: hc.x + R(-6, 6), y: hc.y + R(-6, 6) } }
  }
}
function stepAI(dt) {
  for (const pl of EM.P) {
    if (!pl.alive || (pl.kind !== 'ai' && !pl.auto)) continue
    const ai = pl.ai; ai.t -= dt
    if (ai.t > 0) continue
    ai.t = 2.4 - EM.cfg.diff * 0.3
    const h = hall(pl.i); if (!h) continue
    const bonus = 1 + (EM.cfg.diff - 1) * 0.12; for (const k of RES) pl.res[k] += 0.15 * dt * 0 // (income handled by buildings; difficulty gives a head start below)
    if (!ai.boost) { ai.boost = 1; for (const k of RES) pl.res[k] *= bonus }
    const [used, cap] = popOf(pl.i)
    const want = []
    if (used >= cap - 3) want.push('house')
    if (countB(pl.i, 'farm') < 2 + h.lv) want.push('farm')
    if (countB(pl.i, 'lumber') < 2 + h.lv) want.push('lumber')
    if (countB(pl.i, 'quarry') < 1 + h.lv) want.push('quarry')
    if (h.lv >= 2 && countB(pl.i, 'mine') < h.lv) want.push('mine')
    if (countB(pl.i, 'barracks') < 1 + (h.lv >= 3 ? 1 : 0)) want.push('barracks')
    if (countB(pl.i, 'tower') < h.lv + 1) want.push('tower')
    if (!EM.B.some((b) => b.owner === pl.i && b.type === 'house' && !b.built) && countB(pl.i, 'house') < 3 + h.lv * 3) want.push('house')
    if (h.lv >= 4 && countB(pl.i, 'wonder') === 0 && EM.t > (EM.cfg.diff >= 3 ? 420 : 600) && EM.cfg.diff >= 2) want.push('wonder')
    // upgrade the hall when affordable and a little time has passed
    if (h.lv < 4 && EM.t > 100 * h.lv * (1.4 - EM.cfg.diff * 0.2) && costOk(pl.res, HALL_UP[h.lv])) doUpgrade(pl.i, h.id)
    else for (const t of want) { const spot = findSpot(pl.i, t); if (spot && doBuild(pl.i, t, spot[0], spot[1])) break }
    // train soldiers
    for (const b of EM.B) if (b.owner === pl.i && b.type === 'barracks' && b.built && b.q.length < 2) {
      const pool = ['sword', 'sword', 'archer'].concat(h.lv >= 3 ? ['knight', 'knight'] : [], h.lv >= 4 ? ['catapult'] : [])
      const u = pool[(Math.random() * pool.length) | 0]; if (!doTrain(pl.i, b.id, u)) doTrain(pl.i, b.id, 'sword')
    }
    // attack when the army is big enough
    ai.atkT -= 2.4
    const army = EM.U.filter((u) => u.owner === pl.i)
    const need = (4 + h.lv * 3) * (1.5 - EM.cfg.diff * 0.2)
    if (ai.atkT <= 0 && army.length >= need) {
      const foes = EM.P.filter((p) => p.alive && p.i !== pl.i && hall(p.i))
      if (foes.length) {
        foes.sort((a, b) => { const ha = hall(a.i), hb = hall(b.i); return (Math.hypot(ha.x - h.x, ha.y - h.y) + EM.U.filter((u) => u.owner === a.i).length * 2) - (Math.hypot(hb.x - h.x, hb.y - h.y) + EM.U.filter((u) => u.owner === b.i).length * 2) })
        // humans are the favourite target: they are slower to defend
        const hf = foes.filter((p) => p.kind === 'human'); const pick2 = hf.length && Math.random() < 0.65 ? hf[0] : foes[0]
        const tg = hall(pick2.i), c = bCenter(tg)
        for (const u of army) u.order = { x: c.x + R(-4, 4), y: c.y + R(-4, 4) }
        ai.atkT = 55 + R(0, 30) - EM.cfg.diff * 8
        if (pick2.kind === 'human') { const w = { to: pick2.i, text: pl.name + ' IS MARCHING ON YOUR KINGDOM!', sub: army.length + ' SOLDIERS · RECALL YOUR ARMY (H) AND MAN THE TOWERS', n: ++EM.warnN }; EM.warn = w; if (pick2.i === EM.me) { EM.msg = { text: w.text, sub: w.sub, color: '#ff5a6a', t: 5 }; sfx('rgBoss') } }
      }
    }
    // pull the army home when the base is hit
    if (army.length && EM.B.some((b) => b.owner === pl.i && b.hit > 0) && !ai.defending) { ai.defending = 6; const c = bCenter(h); for (const u of army) u.order = { x: c.x, y: c.y + 6 } }
    if (ai.defending) ai.defending -= 2.4
  }
}
function findSpot(owner, type) {
  const h = hall(owner), d = BDEF[type]; if (!h) return null
  const hx = h.x + 1, hy = h.y + 1
  let best = null, bs = -1e9
  for (let k = 0; k < 60; k++) {
    const a = Math.random() * 6.28, r = 4 + Math.random() * (9 + h.lv * 3)
    const i = Math.round(hx + Math.cos(a) * r), j = Math.round(hy + Math.sin(a) * r)
    if (!canPlace(type, i, j, owner)) continue
    let s = -r
    if (d.res) { const n = resNear({ x: i, y: j, w: d.w }, d.res); if (n < 4) continue; s += n * 2 }
    if (type === 'tower') s += r
    if (s > bs) { bs = s; best = [i, j] }
  }
  return best
}
function checkEnd() {
  const aliveP = EM.P.filter((p) => p.alive)
  const humans = EM.P.filter((p) => p.kind === 'human')
  const meP = EM.P[EM.me]
  // wonder victory
  const w = EM.B.find((b) => b.type === 'wonder' && b.built && EM.P[b.owner].alive)
  if (w) { if (!EM.wonder || EM.wonder.id !== w.id) EM.wonder = { id: w.id, owner: w.owner, t: 150 }; EM.wonder.t -= 0 } else EM.wonder = null
  if (EM.wonder) { EM.wonder.t -= 0.1 * 0; }
  if (EM.mode !== 'play') return
  if (EM.wonder && EM.wonder.t <= 0) return finish(EM.wonder.owner, 'WONDER')
  if (aliveP.length === 1 && EM.P.length > 1) return finish(aliveP[0].i, 'LAST KINGDOM')
  if (!humans.some((p) => p.alive)) return finish(aliveP.length ? aliveP[0].i : -1, 'ALL HUMANS FELL')
  void meP
}
function finish(winner, how) {
  EM.mode = 'over'; music.stop()
  const me = EM.P[EM.me], won = winner === EM.me
  const mins = EM.t / 60
  if (EM.scen && won) { const u = profile.empireCamp || (profile.empireCamp = { cleared: 0 }); u.cleared = Math.max(u.cleared, EM.scenIdx + 1); profile.chips = (profile.chips || 0) + 120 * (EM.scenIdx + 1); if (EM.scen.outro) EM.tale = { lines: EM.scen.outro, i: 0, kind: 'outro' } }
  const score = Math.max(0, Math.round((won ? 3000 : 600) + me.hallLv * 400 + me.kills * 15 + EM.B.filter((b) => b.owner === EM.me).length * 12 + (won ? Math.max(0, 1800 - EM.t) : mins * 20)))
  EM.over = { scen: EM.scenIdx, next: EM.scen && won && EM.scenIdx + 1 < EMCAMP.length ? EMCAMP[EM.scenIdx + 1].name : '', win: won, winner, how, score, time: Math.round(EM.t), hallLv: me.hallLv, kills: me.kills, bld: EM.B.filter((b) => b.owner === EM.me).length, winnerName: winner >= 0 ? EM.P[winner].name : '' }
  profile.empireGames = (profile.empireGames || 0) + 1; if (won) profile.empireWins = (profile.empireWins || 0) + 1
  profile.empireHall = Math.max(profile.empireHall || 0, me.hallLv)
  recordScore('empire', score); saveProfile()
  sfx(won ? 'win' : 'over'); speak(won ? 'Victory. Your empire stands.' : 'Your kingdom has fallen.', 0.5, 1)
  emitE()
}
function objDone(o) {
  const me = EM.me
  if (o.t === 'build') return EM.B.filter((b) => b.owner === me && b.type === o.what && b.built).length >= o.n
  if (o.t === 'army') return EM.U.filter((u) => u.owner === me).length >= o.n
  if (o.t === 'hall') { const h = hall(me); return !!h && h.lv >= o.n }
  if (o.t === 'raid') return EM.raidN >= o.n && EM.raidWarn <= 0 && (EM.U.filter((u) => u.owner < 0).length <= 1 || EM.t - (EM.raidAt || 0) > 70)
  if (o.t === 'destroy') return !EM.P[o.who].alive
  if (o.t === 'last') return EM.P.filter((p) => p.alive).length === 1 && EM.P[me].alive
  if (o.t === 'wonder') return !!(EM.wonder && EM.wonder.owner === me && EM.wonder.t <= 0)
  return false
}
function stepObjectives(dt) {
  if (!EM.scen) return
  EM.objT -= dt; if (EM.objT > 0) return; EM.objT = 0.5
  let alt = false
  if (EM.scen.alt) alt = objDone(EM.scen.alt)
  for (const o of EM.obj) if (!o.done && (objDone(o) || (o.t === 'wonder' && alt))) { o.done = true; sfx('mission'); EM.beat = { text: 'OBJECTIVE COMPLETE', sub: o.text, color: '#6aff9a', t: 4 }; { const hh = hall(EM.me); if (hh) ring((hh.x + 1.5) * T, (hh.y + 1.5) * T, 40, 50, [col('#6aff9a')]) } }
  if (EM.obj.length && EM.obj.every((o) => o.done) && EM.mode === 'play') finish(EM.me, 'SCENARIO COMPLETE')
}
function simStep(dt) {
  EM.t += dt; stepObjectives(dt)
  if (EM.wonder) EM.wonder.t -= dt
  stepBuildings(dt); stepUnits(dt); stepRaiders(dt); stepAI(dt)
  for (const f of EM.fx) f.l -= dt
  EM.fx = EM.fx.filter((f) => f.l > 0)
  checkEnd()
}
function update(dtRaw) {
  const dt = Math.min(dtRaw, 0.1)
  if (EM.mode === 'idle' || EM.paused) return
  if (EM.tale) { stepParticles(dt); EM.emitT -= dt; if (EM.emitT <= 0) { EM.emitT = 0.1; emitE() } return }
  if (EM.beat) { EM.beat.t -= dt; if (EM.beat.t <= 0) EM.beat = null }
  if (EM.mode === 'over') { stepParticles(dt); if (EM.net && EM.net.role === 'host') netTick(dt); return }
  if (EM.msg) { EM.msg.t -= dt; if (EM.msg.t <= 0) EM.msg = null }
  // camera: keys
  const k = keys, z = EM.cam.z, sp = 55 / z * dt
  if (!EM.drag) { EM.cam.x += ((k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0)) * sp; EM.cam.y += ((k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0)) * sp }
  EM.cam.x = clamp(EM.cam.x, 10, WORLD - 10); EM.cam.y = clamp(EM.cam.y, 10, WORLD - 10)
  if (EM.net && EM.net.role === 'guest') { guestStep(dt); stepParticles(dt); return }
  const steps = EM.speed
  for (let s = 0; s < steps; s++) simStep(dt)
  stepParticles(dt)
  if (EM.net && EM.net.role === 'host') netTick(dt)
  EM.emitT -= dt
  if (EM.emitT <= 0) { EM.emitT = 0.15; emitE() }
}
function emitE() {
  const me = EM.P[EM.me]
  const [used, cap] = me ? popOf(EM.me) : [0, 0]
  const h = me ? hall(EM.me) : null
  const sb = EM.sel ? bById(EM.sel) : null
  snap = {
    mode: EM.mode, paused: EM.paused, t: Math.floor(EM.t), res: me ? { food: Math.floor(me.res.food), wood: Math.floor(me.res.wood), stone: Math.floor(me.res.stone), gold: Math.floor(me.res.gold) } : null, pop: used, cap,
    hallLv: h ? h.lv : 0, hallName: h ? HALL_NAME[h.lv] : '', hallId: h ? h.id : 0, up: h && h.lv < 4 ? HALL_UP[h.lv] : null, build: EM.build, atk: EM.atk, msg: EM.msg ? { ...EM.msg } : null, over: EM.over, speed: EM.speed, net: EM.net ? EM.net.role : null,
    army: EM.U.filter((u) => u.owner === EM.me).length, bcount: EM.B.filter((b) => b.owner === EM.me).length, bcap: bldCap(EM.me),
    sel: sb ? { id: sb.id, type: sb.type, name: BDEF[sb.type].name, hp: Math.round(sb.hp), max: sb.max, lv: sb.lv, q: sb.q.map((q) => q.u), qt: sb.qt, built: !!sb.built, mine: sb.owner === EM.me, rate: BDEF[sb.type].rate ? Object.entries(BDEF[sb.type].rate).map(([k, v]) => k + ' +' + (v * (BDEF[sb.type].res ? clamp(resNear(sb, BDEF[sb.type].res) / 10, 0.3, 1.6) : 1) * prodMul(sb.owner)).toFixed(1) + '/s').join(' ') : '' } : null,
    players: EM.P.map((p) => ({ i: p.i, name: p.name, alive: p.alive, lv: p.hallLv, color: TEAM[p.i][0], kind: p.kind, army: EM.U.filter((u) => u.owner === p.i).length, me: p.i === EM.me })),
    env: EM.mode === 'idle' ? '' : empireEnv(EM).label, night: EM.mode === 'idle' ? 0 : empireEnv(EM).T.night,
    scen: EM.scen ? { name: EM.scen.name, sub: EM.scen.sub, idx: EM.scenIdx } : null, obj: EM.obj.map((o) => ({ text: o.text, done: o.done, hint: o.hint })), hint: (EM.obj.find((o) => !o.done) || {}).hint || '', beat: EM.beat ? { ...EM.beat } : null, tale: EM.tale ? { who: EMWHO[EM.tale.lines[EM.tale.i][0]], text: EM.tale.lines[EM.tale.i][1], i: EM.tale.i, n: EM.tale.lines.length, kind: EM.tale.kind } : null, raid: EM.raidWarn > 0 ? Math.ceil(Math.max(0, EM.raidT)) : 0, raidDir: EM.raidDir, nextRaid: Math.max(0, Math.ceil(EM.raidT)), wave: EM.raidN, wonder: EM.wonder ? { t: Math.max(0, Math.ceil(EM.wonder.t)), owner: EM.P[EM.wonder.owner].name, mine: EM.wonder.owner === EM.me } : null, ver: ++EM.minimap,
  }
  subs.forEach((f) => f())
}
// ---------- input ----------
const toWorld = (ax, ay, cam3) => { const g = unprojectGround(cam3 || EM.cam3 || empireCamera(EM, 100 / 56), ax / 50, ay / 28); return g ? { x: clamp(g.x, 0, WORLD), y: clamp(g.y, 0, WORLD) } : { x: EM.cam.x + ax / EM.cam.z, y: EM.cam.y + ay / EM.cam.z } }
export function pickAt(x, y) {
  const i = (x / T) | 0, j = (y / T) | 0
  if (inMap(i, j) && EM.occ[ix(i, j)]) { const b = bById(EM.occ[ix(i, j)]); if (b) return { b } }
  let best = null, bd = 2.2
  for (const u of EM.U) { const d = Math.hypot(u.x - x, u.y - y); if (d < bd) { bd = d; best = { u } } }
  return best
}
function onKey(code) {
  if (EM.mode === 'idle') return
  if (EM.tale) { if (code === 'Enter' || code === 'Space') empireActions.nextTale(); else if (code === 'Escape') empireActions.skipTale(); return }
  if (code === 'Escape') { if (EM.build || EM.atk || EM.sel) { EM.build = null; EM.atk = false; EM.sel = null; emitE(); return } if (EM.mode === 'play' && !EM.net) { EM.paused = !EM.paused; emitE() } else if (EM.paused) { EM.paused = false; emitE() } return }
  if (EM.paused) return
  if (EM.mode === 'over') { if (code === 'Enter') empireActions.rematch(); return }
  const n = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9'].indexOf(code)
  if (n >= 0) { empireActions.setBuild(BORDER[n]); return }
  if (code === 'KeyU') empireActions.upgrade()
  else if (code === 'KeyT') empireActions.train('sword')
  else if (code === 'KeyY') empireActions.train('archer')
  else if (code === 'KeyG') empireActions.attackMode()
  else if (code === 'KeyH') empireActions.recall()
  else if (code === 'Equal' || code === 'NumpadAdd') empireActions.zoom(1.15)
  else if (code === 'Minus' || code === 'NumpadSubtract') empireActions.zoom(1 / 1.15)
  else if (code === 'Space') { const h = hall(EM.me); if (h) { EM.cam.x = (h.x + 1.5) * T; EM.cam.y = (h.y + 1.5) * T } }
  else if (code === 'KeyF' && !EM.net) { EM.speed = EM.speed === 1 ? 2 : EM.speed === 2 ? 4 : 1; emitE() }
}
export const empireActions = {
  start, stop, quit() { toMenu() },
  resume() { EM.paused = false; emitE() }, pause() { if (EM.mode === 'play' && !EM.paused && !EM.net) { EM.paused = true; emitE(); return true } return false },
  rematch() { if (EM.net) { EM.net.rematch(); return } if (EM.scen) { start({ scen: EM.over && EM.over.next ? EM.scenIdx + 1 : EM.scenIdx }); return } start(EM.cfg) },
  nextTale() { const t = EM.tale; if (!t) return; sfx('wdKey'); if (t.i < t.lines.length - 1) t.i++; else EM.tale = null; emitE() },
  skipTale() { EM.tale = null; emitE() },
  setBuild(t) { if (!BDEF[t]) return; EM.build = EM.build === t ? null : t; EM.atk = false; EM.sel = null; sfx('ui'); emitE() },
  upgrade() { const h = hall(EM.me); if (h && localCmd({ k: 'up', b: h.id })) { sfx('ui'); emitE() } else sfx('cBad') },
  train(u) { const b = EM.sel ? bById(EM.sel) : EM.B.find((x) => x.owner === EM.me && x.type === 'barracks' && x.built); if (b && localCmd({ k: 'train', b: b.id, u })) { sfx('ui'); emitE() } else sfx('cBad') },
  attackMode() { EM.atk = !EM.atk; EM.build = null; sfx('ui'); emitE() },
  recall() { localCmd({ k: 'rec' }); sfx('ui') },
  zoom(f) { EM.cam.z = clamp(EM.cam.z * f, 0.55, 2.4) },
  jump(wx, wy) { EM.cam.x = clamp(wx, 10, WORLD - 10); EM.cam.y = clamp(wy, 10, WORLD - 10) },
  setSpeed() { if (!EM.net) { EM.speed = EM.speed === 1 ? 2 : EM.speed === 2 ? 4 : 1; emitE() } },
  // pointer in arena units (the stage is 100 x 56): 'down' | 'move' | 'up', button 0 left / 2 right
  pointer(type, ax, ay, button = 0) {
    if (EM.mode !== 'play' || EM.paused) return
    const w = toWorld(ax, ay)
    EM.hover = { x: w.x, y: w.y }
    if (type === 'down') { EM.drag = { ax, ay, cx: EM.cam.x, cy: EM.cam.y, moved: false, button, g0: w, cam0: { x: EM.cam.x, y: EM.cam.y, z: EM.cam.z } } }
    else if (type === 'move' && EM.drag && EM.drag.button !== 2) {
      const dx = ax - EM.drag.ax, dy = ay - EM.drag.ay
      if (Math.hypot(dx, dy) > 1.2) EM.drag.moved = true
      if (EM.drag.moved && !EM.build) { const gw = toWorld(ax, ay, empireCamera({ cam: EM.drag.cam0 }, 100 / 56)); EM.cam.x = clamp(EM.drag.cx - (gw.x - EM.drag.g0.x), 10, WORLD - 10); EM.cam.y = clamp(EM.drag.cy - (gw.y - EM.drag.g0.y), 10, WORLD - 10) }
    } else if (type === 'up' && EM.drag) {
      const d = EM.drag; EM.drag = null
      if (d.moved && !EM.build) return
      click(w, d.button)
    }
  },
}
function click(w, button) {
  const i = (w.x / T) | 0, j = (w.y / T) | 0
  if (button === 2) { const p = pickAt(w.x, w.y); localCmd({ k: 'atk', x: w.x, y: w.y, t: p && p.b ? p.b.id : 0 }); sfx('ui'); EM.fx.push({ k: 'ping', x: w.x, y: w.y, l: 0.6 }); sfx('emMarch'); return }
  if (EM.build) {
    const d = BDEF[EM.build], bi = i - (d.w >> 1), bj = j - (d.w >> 1)
    if (localCmd({ k: 'build', t: EM.build, i: bi, j: bj })) { sfx('tdBuild'); if (!keys.ShiftLeft) EM.build = null; emitE() } else { sfx('cBad'); EM.msg = { text: 'CANNOT BUILD HERE', sub: 'NEEDS FREE GRASS NEAR YOUR TOWN, AND ENOUGH RESOURCES', color: '#ff8a96', t: 1.4 } }
    return
  }
  const p = pickAt(w.x, w.y)
  if (EM.atk) { localCmd({ k: 'atk', x: w.x, y: w.y, t: p && p.b ? p.b.id : 0 }); EM.atk = false; EM.fx.push({ k: 'ping', x: w.x, y: w.y, l: 0.6 }); sfx('ui'); emitE(); return }
  if (p && p.b) { EM.sel = p.b.id; sfx('ui') }
  else if (p && p.u && p.u.owner !== EM.me) { localCmd({ k: 'atk', x: p.u.x, y: p.u.y, t: 0 }); EM.fx.push({ k: 'ping', x: p.u.x, y: p.u.y, l: 0.6 }) }
  else EM.sel = null
  emitE()
}

// ---------- online (host simulates; friends send commands and mirror the state) ----------
let nSeq = 0, lastN = -1
const r1 = (v) => Math.round(v * 10) / 10
export const empireNet = {
  attach(net) { EM.net = net },
  active: () => !!EM.net && EM.mode !== 'idle',
  reset() { nSeq = 0; lastN = -1 },
  applyCommand(pid, c) { const pl = EM.P.find((p) => p.pid === pid); if (!pl || !pl.alive || EM.mode !== 'play') return; command(pl.i, c) },
  playerLeft(pid) { const pl = EM.P.find((p) => p.pid === pid); if (pl && pl.alive) { pl.kind = 'ai'; pl.ai = { t: 1, atkT: 120 }; pl.name = pl.name + ' (AI)' } },
  hostLeft() { if (EM.net && EM.mode === 'play') { EM.mode = 'over'; EM.over = { win: false, how: 'HOST LEFT', score: 0, time: Math.round(EM.t), hallLv: 0, kills: 0, bld: 0, left: true }; music.stop(); emitE() } },
  applyState(s) {
    if (!EM.net || EM.net.role !== 'guest' || !s || s.n <= lastN || EM.mode === 'idle') return
    lastN = s.n
    if (s.b) { // full building list
      const occ = new Int32Array(MW * MH); EM.B = s.b.map((q) => { const d = BDEF[q[2]]; const b = { id: q[0], owner: q[1], type: q[2], x: q[3], y: q[4], w: d.w, hp: q[5], max: q[6], lv: q[7], q: Array.from({ length: q[8] }, () => ({ u: 'sword' })), built: q[9], hit: 0, qt: q[10] || 0 }; for (let y = 0; y < b.w; y++) for (let x = 0; x < b.w; x++) if (inMap(b.x + x, b.y + y)) occ[ix(b.x + x, b.y + y)] = b.id; return b }); EM.occ = occ
      const bb = s.b.filter((q) => q[1] === EM.me && q[2] === 'hall')[0]; if (bb) { EM.P[EM.me].hallLv = bb[7] }
    }
    const old = new Map(EM.U.map((u) => [u.id, u]))
    EM.U = s.u.map((q) => { let u = old.get(q[0]); if (!u) u = { id: q[0], x: q[3], y: q[4], atkT: 0, flash: 0, face: 0 }; const hp0 = u.hp; u.owner = q[1]; u.type = q[2]; u.tx = q[3]; u.ty = q[4]; u.hp = q[5]; u.max = UDEF[q[2]].hp; if (hp0 !== undefined && q[5] < hp0) u.flash = 0.1; return u })
    s.r.forEach((r, i) => { const pl = EM.P[i]; if (pl) { pl.res = { food: r[0], wood: r[1], stone: r[2], gold: r[3] }; pl.alive = !!r[4]; pl.kills = r[5] } })
    EM.t = s.t; EM.raidT = s.rt; EM.raidWarn = s.rw; EM.raidDir = s.rd; EM.raidN = s.rn; EM.wonder = s.wo ? { owner: s.wo[0], t: s.wo[1], id: 1 } : null; EM.speed = 1
    if (s.msg && (!EM.msg || EM.msg.text !== s.msg.text)) EM.msg = s.msg
    if (s.wn && s.wn.n !== EM.lastWarn) { EM.lastWarn = s.wn.n; if (s.wn.to === EM.me) { EM.msg = { text: s.wn.text, sub: s.wn.sub, color: '#ff5a6a', t: 5 }; sfx('rgBoss') } }
    if (s.over && !EM.over) { EM.mode = 'over'; EM.over = s.over; EM.over.win = s.over.winner === EM.me; music.stop(); const me = EM.P[EM.me]; profile.empireGames = (profile.empireGames || 0) + 1; if (EM.over.win) profile.empireWins = (profile.empireWins || 0) + 1; const sc = Math.round((EM.over.win ? 3000 : 600) + (me.hallLv || 1) * 400 + (me.kills || 0) * 15); EM.over.score = sc; recordScore('empire', sc); saveProfile(); sfx(EM.over.win ? 'win' : 'over') }
    emitE()
  },
}
function netTick(dt) {
  EM.snapT -= dt; EM.bsnapT -= dt
  if (EM.snapT > 0) return
  EM.snapT = 0.2
  const full = EM.bsnapT <= 0; if (full) EM.bsnapT = 0.6
  const pk = { n: ++nSeq, t: Math.round(EM.t), rt: Math.round(EM.raidT), rw: EM.raidWarn, rd: EM.raidDir, rn: EM.raidN, wo: EM.wonder ? [EM.wonder.owner, Math.round(EM.wonder.t)] : 0,
    u: EM.U.map((u) => [u.id, u.owner, u.type, r1(u.x), r1(u.y), Math.round(u.hp)]), r: EM.P.map((p) => [Math.floor(p.res.food), Math.floor(p.res.wood), Math.floor(p.res.stone), Math.floor(p.res.gold), p.alive ? 1 : 0, p.kills]), msg: EM.msg, over: EM.over, wn: EM.warn }
  if (full) pk.b = EM.B.map((b) => [b.id, b.owner, b.type, b.x, b.y, Math.round(b.hp), b.max, b.lv, b.q.length, b.built, Math.round(b.qt * 10) / 10])
  for (const pl of EM.P) if (pl.kind === 'human' && pl.pid) EM.net.state(pl.pid, pk)
}
function guestStep(dt) {
  const k = 1 - Math.exp(-14 * dt)
  for (const u of EM.U) { u.flash = Math.max(0, (u.flash || 0) - dt); if (u.tx !== undefined) { const dx = u.tx - u.x, dy = u.ty - u.y; if (Math.hypot(dx, dy) > 0.2) u.face = Math.atan2(dy, dx); u.x += dx * k; u.y += dy * k } }
  for (const f of EM.fx) f.l -= dt
  EM.fx = EM.fx.filter((f) => f.l > 0)
  if (EM.msg) { EM.msg.t -= dt }
  EM.emitT -= dt
  if (EM.emitT <= 0) { EM.emitT = 0.15; emitE() }
}
// the guest starts from the same seed; the host assigns the seat
export function startGuest(seed, me, players, cfg) {
  EM.net = EM.net
  start({ type: 'online', seed, ai: cfg.ai, diff: cfg.diff, me, peers: players.slice(1) })
}

// ---------- drawing ----------
const TC = { grass: [[0.07, 0.2, 0.08], [0.09, 0.24, 0.1]], forest: [0.04, 0.22, 0.07], stone: [0.2, 0.2, 0.25], gold: [0.5, 0.4, 0.06], water: [0.04, 0.12, 0.3] }
function draw2dUnused(api) {
  const { put } = api, z = EM.cam.z, cx = EM.cam.x, cy = EM.cam.y, t = G.time
  const sx = (x) => (x - cx) * z, sy = (y) => (y - cy) * z
  const hw = 52 / z, hh = 30 / z
  const i0 = Math.max(0, ((cx - hw) / T) | 0), i1 = Math.min(MW - 1, ((cx + hw) / T) | 0), j0 = Math.max(0, ((cy - hh) / T) | 0), j1 = Math.min(MH - 1, ((cy + hh) / T) | 0)
  const ts = T * z * 1.03
  rect(put, -52, -30, 52, 30, col('#02040a'), 1, -3.5, 3)
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const tt = EM.terr[ix(i, j)], x = sx((i + 0.5) * T), y = sy((j + 0.5) * T)
    if (tt === 0) { const c = TC.grass[(i + j) & 1], k = 0.85 + ((i * 7 + j * 13) % 5) * 0.06; put(x, y, -3, ts, ts, c[0] * k, c[1] * k, c[2] * k) }
    else if (tt === 4) { const w = 0.8 + Math.sin(t * 1.5 + i * 0.7 + j * 0.5) * 0.15; put(x, y, -3, ts, ts, TC.water[0] * w, TC.water[1] * w, TC.water[2] * w * 1.3) }
    else if (tt === 1) { put(x, y, -3, ts, ts, 0.05, 0.14, 0.06); const s = ts * 0.55; put(x, y - ts * 0.15, -2.5, s, s, 0.05, 0.3, 0.08); put(x, y + ts * 0.12, -2.4, s * 0.62, s * 0.62, 0.08, 0.4, 0.12); put(x, y - ts * 0.4, -2.6, ts * 0.12, ts * 0.2, 0.25, 0.14, 0.06) }
    else if (tt === 2) { put(x, y, -3, ts, ts, 0.14, 0.14, 0.18); put(x, y, -2.5, ts * 0.8, ts * 0.7, 0.24, 0.24, 0.3); put(x, y + ts * 0.15, -2.4, ts * 0.45, ts * 0.3, 0.34, 0.34, 0.42) }
    else { put(x, y, -3, ts, ts, 0.14, 0.14, 0.18); put(x, y, -2.5, ts * 0.8, ts * 0.7, 0.24, 0.24, 0.3); const g = 0.8 + Math.sin(t * 4 + i) * 0.4; put(x - ts * 0.15, y, -2.3, ts * 0.3, ts * 0.3, 2.6 * g, 2 * g, 0.4); put(x + ts * 0.2, y + ts * 0.15, -2.3, ts * 0.2, ts * 0.2, 2.6 * g, 2 * g, 0.4) }
  }
  // buildings
  for (const b of EM.B) {
    const bx = b.x * T, by = b.y * T, w = b.w * T
    if (bx + w < cx - hw || bx > cx + hw || by + w < cy - hh || by > cy + hh) continue
    const tc = col(TEAM[b.owner][0]), x = sx(bx + w / 2), y = sy(by + w / 2), s = w * z, flash = b.hit > 0 ? 1.8 : 1, bi = b.built ? 1 : 0.5
    const wall = b.type === 'wall'
    put(x + s * 0.04, y - s * 0.04, -2.2, s * 0.98, s * 0.98, 0.02, 0.02, 0.03)
    if (b.type === 'hall') {
      put(x, y, -2, s * 0.95, s * 0.95, 0.42 * flash, 0.36 * flash, 0.3 * flash); put(x, y, -1.9, s * 0.75, s * 0.75, 0.55 * flash, 0.48 * flash, 0.4 * flash)
      for (const [ox, oy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) put(x + ox * s * 0.4, y + oy * s * 0.4, -1.7, s * 0.2, s * 0.2, tc[0] * 1.2, tc[1] * 1.2, tc[2] * 1.2)
      put(x, y, -1.6, s * 0.34, s * 0.34, tc[0] * 1.6, tc[1] * 1.6, tc[2] * 1.6); put(x, y + s * 0.06, -1.5, s * 0.12, s * 0.12, 2.6, 2, 0.4)
      for (let l = 0; l < b.lv; l++) put(x - s * 0.3 + l * s * 0.2, y - s * 0.46, -1.4, s * 0.12, s * 0.12, 2.6, 2.2, 0.5)
    } else if (b.type === 'house') { put(x, y, -2, s * 0.8, s * 0.8, 0.5 * flash * bi, 0.4 * flash * bi, 0.3 * flash * bi); put(x, y + s * 0.18, -1.8, s * 0.9, s * 0.5, tc[0] * 0.9 * bi, tc[1] * 0.9 * bi, tc[2] * 0.9 * bi) }
    else if (b.type === 'farm') { put(x, y, -2, s * 0.95, s * 0.95, 0.4 * bi, 0.3 * bi, 0.1); for (let k = -1; k <= 1; k++) put(x, y + k * s * 0.28, -1.8, s * 0.85, s * 0.1, 0.6 * bi, 1.4 * bi, 0.2) }
    else if (b.type === 'lumber') { put(x, y, -2, s * 0.85, s * 0.85, 0.3 * bi, 0.2 * bi, 0.1); put(x, y - s * 0.15, -1.8, s * 0.7, s * 0.2, 0.55 * bi, 0.35 * bi, 0.15); put(x + s * 0.2, y + s * 0.2, -1.7, s * 0.25, s * 0.25, tc[0] * bi, tc[1] * bi, tc[2] * bi) }
    else if (b.type === 'quarry') { put(x, y, -2, s * 0.85, s * 0.85, 0.3 * bi, 0.3 * bi, 0.34 * bi); put(x - s * 0.1, y, -1.8, s * 0.4, s * 0.4, 0.55 * bi, 0.55 * bi, 0.6 * bi); put(x + s * 0.25, y + s * 0.2, -1.7, s * 0.25, s * 0.25, tc[0] * bi, tc[1] * bi, tc[2] * bi) }
    else if (b.type === 'mine') { put(x, y, -2, s * 0.85, s * 0.85, 0.28 * bi, 0.25 * bi, 0.2 * bi); put(x, y - s * 0.1, -1.8, s * 0.4, s * 0.4, 0.04, 0.03, 0.03); put(x + s * 0.2, y + s * 0.22, -1.7, s * 0.2, s * 0.2, 2.6 * bi, 2 * bi, 0.4) }
    else if (b.type === 'barracks') { put(x, y, -2, s * 0.92, s * 0.92, 0.3 * flash * bi, 0.22 * flash * bi, 0.22 * flash * bi); put(x, y, -1.8, s * 0.7, s * 0.7, tc[0] * 0.7 * bi, tc[1] * 0.7 * bi, tc[2] * 0.7 * bi); put(x, y, -1.6, s * 0.2, s * 0.5, 2.2, 2.2, 2.4); put(x, y, -1.6, s * 0.5, s * 0.2, 2.2, 2.2, 2.4) }
    else if (b.type === 'tower') { put(x, y, -2, s * 0.7, s * 0.7, 0.45 * flash * bi, 0.45 * flash * bi, 0.5 * flash * bi); put(x, y, -1.8, s * 0.5, s * 0.5, tc[0] * bi, tc[1] * bi, tc[2] * bi); put(x, y, -1.6, s * 0.2, s * 0.2, 2.6, 2.2, 0.5) }
    else if (wall) { put(x, y, -2, s * 1.0, s * 1.0, 0.5 * flash * bi, 0.5 * flash * bi, 0.56 * flash * bi); put(x, y, -1.8, s * 0.6, s * 0.6, 0.64 * bi, 0.64 * bi, 0.7 * bi) }
    else if (b.type === 'wonder') { put(x, y, -2, s * 0.95, s * 0.95, 0.5 * bi, 0.45 * bi, 0.3 * bi); put(x, y, -1.8, s * 0.7, s * 0.7, 0.8 * bi, 0.7 * bi, 0.4 * bi); const g = 1 + Math.sin(t * 3) * 0.3; put(x, y, -1.5, s * 0.34, s * 0.34, 3 * g, 2.4 * g, 0.5); for (let k = 0; k < 6; k++) { const a = t * 1.5 + k; put(x + Math.cos(a) * s * 0.6, y + Math.sin(a) * s * 0.6, -1.3, s * 0.1, s * 0.1, 3, 2.4, 0.6) } }
    if (!b.built) { const f = b.bt !== undefined ? clamp(1 - b.bt / (b.type === 'wonder' ? 40 : 4 + b.w * 2), 0, 1) : 0.5; put(x - s * 0.5 + (s * f) / 2, y - s * 0.6, -1.2, s * f, s * 0.08, 2, 1.8, 0.4) }
    else if (b.hp < b.max) { const f = b.hp / b.max; put(x - s * 0.5 + (s * f) / 2, y + s * 0.62, -1.2, s * f, s * 0.08, f > 0.5 ? 0.3 : 2, f > 0.5 ? 2 : 0.4, 0.3) }
    if (EM.sel === b.id) { for (const [ox, oy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) put(x + ox * s * 0.55, y + oy * s * 0.55, -1, s * 0.12, s * 0.12, 2.6, 2.6, 2.6) }
  }
  // ghost for placing
  if (EM.build && EM.hover) {
    const d = BDEF[EM.build], i = ((EM.hover.x / T) | 0) - (d.w >> 1), j = ((EM.hover.y / T) | 0) - (d.w >> 1), ok = canPlace(EM.build, i, j, EM.me) && EM.P[EM.me] && costOk(EM.P[EM.me].res, d.cost)
    const x = sx((i + d.w / 2) * T), y = sy((j + d.w / 2) * T), s = d.w * T * z
    put(x, y, -1.5, s, s, ok ? 0.1 : 1.6, ok ? 1.5 : 0.2, 0.2); const h = hall(EM.me); if (h) circle(put, sx((h.x + 1.5) * T), sy((h.y + 1.5) * T), (16 + h.lv * 3) * T / 2 * z, col('#ffffff'), 0.6, -3.3, 1.2)
  }
  // units
  for (const u of EM.U) {
    if (u.x < cx - hw - 3 || u.x > cx + hw + 3 || u.y < cy - hh - 3 || u.y > cy + hh + 3) continue
    const d = UDEF[u.type], c = u.owner >= 0 ? col(TEAM[u.owner][0]) : col('#ff8a3a'), x = sx(u.x), y = sy(u.y), r = (d.siege ? 1.5 : u.type === 'knight' || u.type === 'rbrute' ? 1.2 : 0.9) * z, f = u.flash > 0 ? 2 : 1, bob = Math.sin(t * 10 + u.id) * 0.1 * z
    put(x + r * 0.2, y - r * 0.5, -1.2, r * 1.6, r * 0.6, 0.02, 0.02, 0.03)
    disk(put, x, y + bob, r, c, 1.4 * f, -1, Math.max(0.35, r * 0.5)); put(x, y + bob + r * 0.1, -0.9, r * 0.8, r * 0.8, 0.8 * f, 0.7 * f, 0.6 * f)
    if (d.range > 6 && !d.siege) put(x + Math.cos(u.face) * r * 1.2, y + Math.sin(u.face) * r * 1.2, -0.8, r * 0.3, r * 0.3, 2.4, 2.2, 1.2)
    else put(x + Math.cos(u.face) * r * 1.2, y + Math.sin(u.face) * r * 1.2, -0.8, r * 0.5, r * 0.15, 2, 2, 2.2)
    if (u.hp < u.max) { const hpf = u.hp / u.max; put(x - r * 0.9 + r * 0.9 * hpf, y + r * 1.3, -0.7, r * 1.8 * hpf, r * 0.2, hpf > 0.5 ? 0.3 : 2, hpf > 0.5 ? 2 : 0.4, 0.3) }
  }
  for (const f of EM.fx) {
    if (f.k === 'shot') { const n = 6; for (let k = 0; k <= n; k++) { const u = k / n; put(sx(f.x0 + (f.x1 - f.x0) * u), sy(f.y0 + (f.y1 - f.y0) * u), -0.5, 0.5 * z, 0.5 * z, 2.2, 2, 1) } }
    else if (f.k === 'ping') circle(put, sx(f.x), sy(f.y), (1 + (0.6 - f.l) * 6) * z, col('#ffe84a'), 2, -0.4, 0.5)
  }
  for (const q of G.parts) { const f = q.life / q.max, s = q.s * (0.35 + 0.65 * f) * 0.9 * z; put(sx(q.x), sy(q.y), 1, s, s, q.c[0] * 1.8, q.c[1] * 1.8, q.c[2] * 1.8) }
  // warning on the map edge before a raid
  if (EM.raidWarn > 0) { const dir = EM.raidDir, a = 0.5 + 0.5 * Math.sin(t * 8); for (let k = -20; k <= 20; k++) { const x = dir === 'WEST' ? -50 : dir === 'EAST' ? 50 : k * 2.4, y = dir === 'SOUTH' ? -28 : dir === 'NORTH' ? 28 : k * 1.3; put(x, y, 1, 1.2, 1.2, 3 * a, 0.6 * a, 0.3 * a) } }
}
void draw2dUnused
export const mapInfo = () => ({ terr: EM.terr, MW, MH, B: EM.B, U: EM.U, cam: EM.cam, me: EM.me })
if (typeof window !== 'undefined') { window.__EM = EM; window.__empire = empireActions }
games.empire = {
  update, onKey, draw() {}, stop, sky: () => (EM.mode === 'idle' ? '#04070e' : empireEnv(EM).sky), fog: () => { const E = empireEnv(EM); return E.fogFar ? { fog: E.fog, fogNear: E.fogNear, fogFar: E.fogFar } : null },
  draw3: (api) => { EM.cam3 = empireCamera(EM, 100 / 56); drawEmpire3(api, EM, { TEAM, UDEF, MW, MH, BDEF, canPlace, costOk }) },
  camera: (aspect) => { const c = empireCamera(EM, aspect); EM.cam3 = c; return c },
  lights: () => empireLights(EM),
}
