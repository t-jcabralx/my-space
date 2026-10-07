// GARDEN SIEGE: lane defence in the spirit of the classic plants-vs-zombies games.
// Play the PLANTS against an AI zombie horde (10 levels), play the ZOMBIES against AI defences, or play a friend online
// (one is the garden, the other is the horde). Pure JS simulation, drawn in the lit 3D pass.
import { G, emit as engineEmit, games, profile, saveProfile, recordScore, toMenu, shake, flash } from './engine.js'
import { sfx, music } from './audio.js'
import { clamp, rng } from './pxl.js'
import { unprojectGround } from './rogue3d.js'
import { registerNet, gameEnded } from './online/gnet.js'

export const ROWS = 5, COLS = 9, CW = 7.2, RH = 6.4, X0 = -32.4, Y0 = 16, SPAWN_X = 42, HOUSE_X = -36.5
const cellX = (c) => X0 + (c + 0.5) * CW, rowY = (r) => Y0 - (r + 0.5) * RH
const colAt = (x) => Math.floor((x - X0) / CW), rowAt = (y) => Math.floor((Y0 - y) / RH)

export const PLANTS = {
  sunflower: { name: 'SUNFLOWER', icon: '🌻', cost: 50, cd: 6, hp: 300, desc: 'Makes sun' },
  peashooter: { name: 'PEASHOOTER', icon: '🌱', cost: 100, cd: 6, hp: 300, fire: 1.4, dmg: 20, desc: 'Shoots peas' },
  wallnut: { name: 'WALL-NUT', icon: '🥜', cost: 50, cd: 18, hp: 1400, desc: 'Tough blocker' },
  cherry: { name: 'CHERRY BOMB', icon: '🍒', cost: 150, cd: 30, hp: 100, desc: 'Big explosion' },
  snowpea: { name: 'SNOW PEA', icon: '❄️', cost: 175, cd: 6, hp: 300, fire: 1.4, dmg: 20, snow: true, desc: 'Slows zombies' },
  mine: { name: 'POTATO MINE', icon: '🥔', cost: 25, cd: 22, hp: 100, desc: 'Arms, then blows up' },
  chomper: { name: 'CHOMPER', icon: '🪴', cost: 150, cd: 10, hp: 300, desc: 'Eats a zombie whole' },
  repeater: { name: 'REPEATER', icon: '🌿', cost: 200, cd: 6, hp: 300, fire: 1.4, dmg: 20, twin: true, desc: 'Shoots twice' },
}
export const ZOMBIES = {
  walker: { name: 'ZOMBIE', icon: '🧟', cost: 2, cd: 2.2, hp: 200, speed: 2.1, dps: 70, desc: 'Plain and shambling' },
  runner: { name: 'RUNNER', icon: '🏃', cost: 3, cd: 3, hp: 150, speed: 4.1, dps: 60, desc: 'Fast and fragile' },
  cone: { name: 'CONEHEAD', icon: '🚧', cost: 4, cd: 4, hp: 560, speed: 2.1, dps: 70, desc: 'Traffic cone helmet' },
  bucket: { name: 'BUCKETHEAD', icon: '🪣', cost: 7, cd: 7, hp: 1300, speed: 2.0, dps: 70, desc: 'Iron bucket' },
  giant: { name: 'GIANT', icon: '👹', cost: 12, cd: 14, hp: 3200, speed: 1.5, dps: 600, desc: 'Crushes plants' },
}
const UNLOCK = ['sunflower', 'peashooter', 'wallnut', 'cherry', 'snowpea', 'mine', 'chomper', 'repeater']
export const LEVELS = [
  { name: 'FRONT LAWN', seeds: 2, zs: ['walker'], n: 8, sun: 150 },
  { name: 'MORNING DEW', seeds: 3, zs: ['walker', 'cone'], n: 11, sun: 100 },
  { name: 'GARDEN PARTY', seeds: 4, zs: ['walker', 'cone', 'runner'], n: 14, sun: 100 },
  { name: 'FROSTY PATH', seeds: 5, zs: ['walker', 'cone', 'runner'], n: 17, sun: 100 },
  { name: 'MINE FIELD', seeds: 6, zs: ['walker', 'cone', 'runner', 'bucket'], n: 20, sun: 100 },
  { name: 'MIDNIGHT YARD', seeds: 7, zs: ['walker', 'cone', 'runner', 'bucket'], n: 24, sun: 100 },
  { name: 'HIGH NOON', seeds: 8, zs: ['walker', 'cone', 'runner', 'bucket', 'giant'], n: 28, sun: 100 },
  { name: 'ZOMBIE RUSH', seeds: 8, zs: ['cone', 'runner', 'bucket', 'giant'], n: 34, sun: 150 },
  { name: 'LAST STAND', seeds: 8, zs: ['walker', 'cone', 'runner', 'bucket', 'giant'], n: 40, sun: 150 },
  { name: 'THE BIG DAY', seeds: 8, zs: ['cone', 'runner', 'bucket', 'giant'], n: 50, sun: 200 },
]
export const SURVIVE_T = 200

export const GD = { mode: 'idle', paused: false, kind: 'plants', lvl: 0, t: 0, sun: 100, brain: 6, plants: [], zombies: [], peas: [], suns: [], mowers: [], fx: [], cd: {}, id: 1, sel: null, shovel: false, hover: null, dir: null, over: null, msg: null, kills: 0, planted: 0, emitT: 0, net: null, ai: null, seats: null, flagT: 0, sunT: 6, brainT: 0, score: 0 }
let snap = null
const subs = new Set()
export const subscribeGarden = (f) => { subs.add(f); return () => subs.delete(f) }
export const getGardenSnap = () => snap

export const seedsFor = (kind, lvl) => (kind === 'zombies' ? Object.keys(ZOMBIES) : kind === 'versus' ? Object.keys(PLANTS) : UNLOCK.slice(0, LEVELS[lvl].seeds))
function genWaves(li, rnd) {
  const L = LEVELS[li], list = []
  let t = 16
  for (let i = 0; i < L.n; i++) {
    const w = i < 2 ? 1 : 1 + Math.floor(rnd() * 3)
    const type = i === 0 ? 'walker' : L.zs[Math.min(L.zs.length - 1, Math.floor(rnd() * (1 + i / 4)))]
    list.push({ t, type, r: (rnd() * ROWS) | 0 })
    const gap = Math.max(2.4, 8.5 - li * 0.45 - i * 0.12)
    t += gap * (0.7 + rnd() * 0.6) / (w > 2 ? 1.3 : 1)
    if (i === Math.floor(L.n * 0.5) || i === L.n - 1) { // a huge wave
      const k = 3 + Math.floor(li / 2)
      for (let j = 0; j < k; j++) list.push({ t: t + 3 + j * 0.5, type: L.zs[(rnd() * L.zs.length) | 0], r: (j + ((rnd() * ROWS) | 0)) % ROWS, flag: j === 0 })
      t += 14
    }
  }
  return list.sort((a, b) => a.t - b.t)
}
function start(o = {}) {
  GD.kind = o.kind === 'zombies' || o.kind === 'versus' ? o.kind : 'plants'
  GD.lvl = clamp(o.level | 0, 0, LEVELS.length - 1)
  GD.seed = o.seed || ((Math.random() * 1e9) | 0)
  const rnd = rng(GD.seed + GD.lvl * 31)
  GD.rnd = rnd
  GD.t = 0; GD.sun = GD.kind === 'versus' ? 200 : LEVELS[GD.lvl].sun; GD.brain = 6; GD.plants = []; GD.zombies = []; GD.peas = []; GD.suns = []; GD.fx = []; GD.cd = {}; GD.id = 1
  GD.mowers = Array.from({ length: ROWS }, () => ({ x: HOUSE_X + 3, run: false, used: false }))
  GD.sel = null; GD.shovel = false; GD.hover = null; GD.over = null; GD.msg = { text: GD.kind === 'zombies' ? 'BREAK THEIR DEFENCES!' : GD.kind === 'versus' ? 'VERSUS' : 'LEVEL ' + (GD.lvl + 1), sub: GD.kind === 'plants' ? LEVELS[GD.lvl].name : '', t: 2.4 }
  GD.kills = 0; GD.planted = 0; GD.paused = false; GD.sunT = 6; GD.brainT = 0; GD.flagT = 0; GD.score = 0; GD.waveDone = false
  GD.dir = GD.kind === 'plants' ? { list: genWaves(GD.lvl, rnd), i: 0 } : null
  GD.ai = GD.kind === 'plants' ? null : { sun: 150, t: 2, sunT: 5, unlocked: Object.keys(PLANTS) }
  GD.total = GD.dir ? GD.dir.list.length : 0
  GD.net = o.net || null
  G.mode = 'garden'; engineEmit(); G.parts = []; G.pops = []; GD.mode = 'play'
  music.set('cards', 0); sfx('mission'); emitG()
}
function stop() { GD.mode = 'idle'; GD.paused = false; if (GD.net) { gameEnded('garden'); GD.net = null } music.set('menu'); emitG() }
const fx = (x, y, z, n, c, sp = 10, life = 0.6, s = 0.5) => { for (let i = 0; i < n && GD.fx.length < 260; i++) GD.fx.push({ x, y, z, vx: (Math.random() - 0.5) * sp, vy: Math.random() * sp * 0.8, vz: (Math.random() - 0.5) * sp, life, max: life, c, s: s * (0.6 + Math.random() * 0.8) }) }

// ---------- actions (validated, host side) ----------
const plantAt = (r, c) => GD.plants.find((p) => p.r === r && p.c === c)
function canPlant(side, type, r, c) {
  const d = PLANTS[type]
  if (!d || r < 0 || r >= ROWS || c < 0 || c >= COLS || plantAt(r, c)) return false
  if (side === 'me') { if (GD.sun < d.cost || (GD.cd[type] || 0) > 0) return false }
  return true
}
function doPlant(type, r, c, free) {
  const d = PLANTS[type]
  const p = { id: GD.id++, type, r, c, hp: d.hp, max: d.hp, t: Math.random() * 2, fireT: 0.6 + Math.random() * 0.6, armed: 0, chew: 0, fuse: type === 'cherry' ? 1 : 0, burst: 0 }
  GD.plants.push(p); GD.planted++
  if (!free) { /* cost handled by caller */ }
  fx(cellX(c), 1, -rowY(r), 8, [0.4, 1.2, 0.4], 8, 0.5, 0.5)
  return p
}
function placePlant(type, r, c) { // human gardener
  if (!canPlant('me', type, r, c)) return false
  GD.sun -= PLANTS[type].cost; GD.cd[type] = PLANTS[type].cd
  doPlant(type, r, c); sfx('tdBuild')
  return true
}
function spawnZombie(type, r, x, byHuman) {
  const d = ZOMBIES[type]
  if (!d || r < 0 || r >= ROWS) return null
  const z = { id: GD.id++, type, r, x: x === undefined ? SPAWN_X + Math.random() * 3 : x, hp: d.hp, max: d.hp, slow: 0, eating: 0, hit: 0, t: Math.random() * 6, by: byHuman ? 1 : 0, dead: false }
  GD.zombies.push(z)
  return z
}
function dropZombie(type, r) { // human horde
  const d = ZOMBIES[type]
  if (!d || GD.brain < d.cost || (GD.cd[type] || 0) > 0 || r < 0 || r >= ROWS) return false
  GD.brain -= d.cost; GD.cd[type] = d.cd
  spawnZombie(type, r, SPAWN_X, true); sfx('rgDash')
  return true
}
function shovelAt(r, c) { const p = plantAt(r, c); if (!p) return false; p.hp = 0; GD.shovel = false; sfx('tdSell'); return true }
function collectSun(id) { const i = GD.suns.findIndex((s) => s.id === id); if (i < 0) return false; const s = GD.suns[i]; GD.suns.splice(i, 1); GD.sun += s.v; sfx('coin'); fx(s.x, 2, -s.y, 5, [2, 2, 0.4], 6, 0.4, 0.4); return true }

// ---------- the simulation ----------
function update(dtRaw) {
  const dt = Math.min(dtRaw, 0.05)
  if (GD.mode === 'idle' || GD.paused) return
  for (const q of GD.fx) { q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt - 12 * dt * dt; q.z += q.vz * dt; q.vy -= 14 * dt }
  GD.fx = GD.fx.filter((q) => q.life > 0)
  if (GD.msg) { GD.msg.t -= dt; if (GD.msg.t <= 0) GD.msg = null }
  if (GD.mode === 'over') { emitTick(dt); return }
  if (GD.net && GD.net.role === 'guest') { guestStep(dt); emitTick(dt); return }
  GD.t += dt
  for (const k in GD.cd) if (GD.cd[k] > 0) GD.cd[k] -= dt
  // sky sun for the gardener (human or AI)
  GD.sunT -= dt
  if (GD.sunT <= 0 && GD.kind !== 'zombies') { GD.sunT = 7 + Math.random() * 4; const c = (Math.random() * COLS) | 0; GD.suns.push({ id: GD.id++, x: cellX(c), y: rowY((Math.random() * ROWS) | 0), v: 25, age: 0, fall: 14 }) }
  // brains for the horde
  if (GD.kind !== 'plants') { GD.brainT += dt; if (GD.brainT >= 1.1) { GD.brainT = 0; GD.brain = Math.min(30, GD.brain + 1) } }
  // the AI zombie director
  if (GD.dir) {
    const D = GD.dir
    while (D.i < D.list.length && D.list[D.i].t <= GD.t) { const w = D.list[D.i++]; spawnZombie(w.type, w.r); if (w.flag) { GD.msg = { text: 'A HUGE WAVE IS COMING!', sub: '', t: 2.4 }; sfx('emHorn') } }
  }
  if (GD.ai) aiGarden(dt)
  stepSuns(dt); stepPlants(dt); stepZombies(dt); stepPeas(dt); stepMowers(dt)
  // remove the dead
  for (const p of GD.plants) if (p.hp <= 0 && !p.gone) { p.gone = true; fx(cellX(p.c), 2, -rowY(p.r), 10, [0.3, 1, 0.3], 10, 0.6, 0.5) }
  GD.plants = GD.plants.filter((p) => !p.gone)
  for (const z of GD.zombies) if (z.hp <= 0 && !z.dead) { z.dead = true; GD.kills++; GD.score += 50; fx(z.x, 2, -rowY(z.r), 12, [0.5, 0.7, 0.4], 12, 0.7, 0.6); sfx('rgKill') }
  GD.zombies = GD.zombies.filter((z) => !z.dead)
  // victory / defeat
  if (GD.zombies.some((z) => z.x < HOUSE_X)) return finish(false)
  if (GD.kind === 'plants') { if (GD.dir.i >= GD.dir.list.length && GD.zombies.length === 0) return finish(true) }
  else if (GD.t >= SURVIVE_T) return finish(true)
  emitTick(dt)
}
function stepSuns(dt) {
  for (const s of GD.suns) {
    s.age += dt
    if (s.fall > 0) { s.fall = Math.max(0, s.fall - 14 * dt) }
    if (s.age > (GD.kind === 'zombies' ? 1.4 : 9)) s.take = true // old sun is collected automatically
  }
  for (const s of GD.suns) if (s.take) { if (GD.kind === 'zombies' && GD.ai) GD.ai.sun += s.v; else GD.sun += s.v }
  GD.suns = GD.suns.filter((s) => !s.take)
}
function zombieAhead(p) { let best = null; for (const z of GD.zombies) if (z.r === p.r && z.x > cellX(p.c) - 1 && z.x < SPAWN_X && z.hp > 0) if (!best || z.x < best.x) best = z; return best }
function stepPlants(dt) {
  for (const p of GD.plants) {
    p.t += dt
    const d = PLANTS[p.type], px = cellX(p.c), py = rowY(p.r)
    if (p.type === 'sunflower') {
      p.fireT -= dt
      if (p.fireT <= 0) { p.fireT = 9 + Math.random() * 2; GD.suns.push({ id: GD.id++, x: px + (Math.random() - 0.5) * 3, y: py, v: 25, age: 0, fall: 0 }) }
    } else if (d.fire) {
      const tgt = zombieAhead(p)
      p.fireT -= dt
      if (tgt && p.fireT <= 0) { p.fireT = d.fire; p.burst = d.twin ? 2 : 1; p.burstT = 0 }
      if (p.burst > 0) { p.burstT -= dt; if (p.burstT <= 0) { p.burst--; p.burstT = 0.14; GD.peas.push({ id: GD.id++, r: p.r, x: px + 3, dmg: d.dmg, snow: !!d.snow }); p.kick = 0.15; sfx('tdShot') } }
      if (p.kick > 0) p.kick -= dt
    } else if (p.type === 'cherry') {
      p.fuse -= dt
      if (p.fuse <= 0) {
        for (const z of GD.zombies) if (Math.abs(z.r - p.r) <= 1 && Math.abs(z.x - px) < CW * 1.6) { z.hp -= 1800; z.hit = 0.3 }
        fx(px, 3, -py, 26, [3, 1.2, 0.2], 26, 0.8, 1.2); sfx('bigBoom'); shake(0.7); flash(0.2, [1, 0.6, 0.2]); p.hp = 0
      }
    } else if (p.type === 'mine') {
      if (p.armed < 14) p.armed += dt
      else { const z = GD.zombies.find((q) => q.r === p.r && Math.abs(q.x - px) < 3.4 && q.hp > 0); if (z) { for (const q of GD.zombies) if (q.r === p.r && Math.abs(q.x - px) < CW * 1.1) { q.hp -= 1800; q.hit = 0.3 } fx(px, 2, -py, 18, [3, 1.2, 0.2], 18, 0.7, 0.9); sfx('boom'); shake(0.4); p.hp = 0 } }
    } else if (p.type === 'chomper') {
      if (p.chew > 0) p.chew -= dt
      else { const z = GD.zombies.find((q) => q.r === p.r && q.x > px && q.x < px + CW * 1.25 && q.hp > 0 && q.type !== 'giant'); if (z) { z.hp = 0; z.eaten = true; p.chew = 18; fx(px + 2, 3, -py, 8, [0.8, 0.2, 0.9], 10, 0.5, 0.6); sfx('rgSwing') } }
    }
  }
}
function stepZombies(dt) {
  for (const z of GD.zombies) {
    const d = ZOMBIES[z.type]
    z.t += dt
    if (z.hit > 0) z.hit -= dt
    if (z.slow > 0) z.slow -= dt
    // is a plant in the way?
    let target = null
    for (const p of GD.plants) { const px = cellX(p.c); if (p.r === z.r && px < z.x + 1.2 && px > z.x - 3.2) { if (!target || px > cellX(target.c)) target = p } }
    if (target) {
      z.eating = 0.3
      target.hp -= d.dps * dt * (z.slow > 0 ? 0.6 : 1)
      if (Math.random() < dt * 2) fx(z.x - 1, 2, -rowY(z.r), 1, [0.4, 1, 0.3], 4, 0.3, 0.3)
    } else {
      z.eating = Math.max(0, z.eating - dt)
      if (z.eating <= 0) z.x -= d.speed * (z.slow > 0 ? 0.5 : 1) * dt
    }
    // the mower of this row
    const m = GD.mowers[z.r]
    if (m && !m.used && !m.run && z.x < X0 - 1.5) { m.run = true; sfx('rBoost'); GD.msg = { text: 'LAWN MOWER!', sub: '', t: 1 } }
  }
}
function stepPeas(dt) {
  for (const pe of GD.peas) {
    pe.x += 56 * dt
    for (const z of GD.zombies) {
      if (z.r !== pe.r || z.hp <= 0 || z.x > SPAWN_X - 2) continue
      if (pe.x > z.x - 1.4 && pe.x < z.x + 1.6) { z.hp -= pe.dmg; z.hit = 0.12; if (pe.snow) z.slow = 3; pe.dead = true; fx(pe.x, 3, -rowY(pe.r), 3, pe.snow ? [0.4, 0.8, 2] : [0.4, 1.4, 0.3], 6, 0.3, 0.3); break }
    }
    if (pe.x > 48) pe.dead = true
  }
  GD.peas = GD.peas.filter((p) => !p.dead)
}
function stepMowers(dt) {
  GD.mowers.forEach((m, r) => {
    if (!m.run) return
    m.x += 42 * dt
    for (const z of GD.zombies) if (z.r === r && Math.abs(z.x - m.x) < 3 && z.hp > 0) { z.hp = 0; z.hit = 0.3 }
    if (m.x > 46) { m.run = false; m.used = true }
  })
}
// ---------- the AI gardener (when you are the horde) ----------
function aiGarden(dt) {
  const A = GD.ai
  A.sunT -= dt; if (A.sunT <= 0) { A.sunT = 6; A.sun += 25 }
  A.t -= dt
  if (A.t > 0) return
  A.t = 1.1 + Math.random() * 0.6
  const diff = Math.min(1, GD.t / 150)
  const count = (type) => GD.plants.filter((p) => p.type === type).length
  const free = (r, c) => !plantAt(r, c)
  const buy = (type, r, c) => { const d = PLANTS[type]; if (A.sun < d.cost || !free(r, c)) return false; A.sun -= d.cost; doPlant(type, r, c); return true }
  const rowsWithZ = new Set(GD.zombies.filter((z) => z.x < 38 && z.hp > 0).map((z) => z.r))
  // 1. economy first
  if (count('sunflower') < 2 + Math.floor(diff * 4)) { for (let c = 0; c <= 1; c++) for (let r = 0; r < ROWS; r++) if (buy('sunflower', (r + 2) % ROWS, c)) return }
  // 2. shooters in the rows under attack
  for (const r of rowsWithZ) {
    const shooters = GD.plants.filter((p) => p.r === r && PLANTS[p.type].fire).length
    if (shooters < 1 + (diff > 0.5 ? 1 : 0)) { for (let c = 2; c <= 5; c++) { const t = A.sun >= 200 && diff > 0.4 ? 'repeater' : A.sun >= 175 && diff > 0.25 ? 'snowpea' : 'peashooter'; if (buy(t, r, c)) return } }
  }
  // 3. a cherry bomb on a crowd
  if (A.sun >= 150) {
    const crowd = GD.zombies.find((z) => z.x < 30 && GD.zombies.filter((q) => Math.abs(q.r - z.r) <= 1 && Math.abs(q.x - z.x) < 10).length >= 3)
    if (crowd) { const c = clamp(colAt(crowd.x) - 1, 0, COLS - 1); if (buy('cherry', crowd.r, c)) return }
  }
  // 4. walls and mines in the way
  for (const r of rowsWithZ) { if (A.sun >= 50 && !GD.plants.some((p) => p.r === r && p.type === 'wallnut')) { for (let c = 6; c >= 4; c--) if (buy('wallnut', r, c)) return } }
  if (A.sun >= 25 && diff > 0.3) { const r = (Math.random() * ROWS) | 0; if (count('mine') < 4) buy('mine', r, 7) }
  // 5. more shooters when rich
  if (A.sun >= 100 && count('peashooter') + count('repeater') + count('snowpea') < 4 + diff * 8) { const r = (Math.random() * ROWS) | 0; for (let c = 2; c <= 6; c++) if (buy(diff > 0.5 ? 'repeater' : 'peashooter', r, c)) return }
}
// ---------- end of the match ----------
function finish(plantsWon) {
  GD.mode = 'over'; music.stop()
  const side = mySide()
  const iWin = side === 'plants' ? plantsWon : !plantsWon
  let bonus = 0
  if (GD.kind === 'plants' && plantsWon) { bonus = 1000 + GD.lvl * 300 + GD.mowers.filter((m) => !m.used).length * 250; profile.gardenLevel = Math.max(profile.gardenLevel || 0, GD.lvl + 1) }
  if (GD.kind !== 'plants' && iWin) bonus = 1500
  GD.score += bonus
  GD.over = { win: iWin, kind: GD.kind, plantsWon, score: GD.score, kills: GD.kills, planted: GD.planted, time: GD.t, level: GD.lvl + 1, bonus, side }
  profile.gardenGames = (profile.gardenGames || 0) + 1
  if (iWin) profile.gardenWins = (profile.gardenWins || 0) + 1
  profile.gardenKills = (profile.gardenKills || 0) + GD.kills
  profile.gardenBest = Math.max(profile.gardenBest || 0, GD.score)
  recordScore('garden', GD.score); saveProfile()
  sfx(iWin ? 'win' : 'over')
  if (GD.net && GD.net.role === 'host') GD.net.send({ k: 'end', over: GD.over })
  emitG()
}
// ---------- snapshots & guests ----------
const r2 = (v) => Math.round(v * 100) / 100
function netSnapshot() {
  return {
    t: r2(GD.t), sun: GD.sun, brain: GD.brain, ai: GD.ai ? GD.ai.sun : 0, cd: Object.fromEntries(Object.entries(GD.cd).map(([k, v]) => [k, r2(Math.max(0, v))])),
    p: GD.plants.map((p) => [p.id, p.type, p.r, p.c, Math.round(p.hp), r2(p.armed), r2(p.chew), r2(p.fuse), p.kick > 0 ? 1 : 0]),
    z: GD.zombies.map((z) => [z.id, z.type, z.r, r2(z.x), Math.round(z.hp), z.slow > 0 ? 1 : 0, z.eating > 0 ? 1 : 0, z.hit > 0 ? 1 : 0]),
    pe: GD.peas.map((p) => [p.id, p.r, r2(p.x), p.snow ? 1 : 0]), su: GD.suns.map((s) => [s.id, r2(s.x), r2(s.y), s.v, r2(s.fall)]),
    m: GD.mowers.map((m) => (m.used ? 2 : m.run ? 1 : 0) + ':' + r2(m.x)), k: GD.kills,
  }
}
let netT = 0
function hostNet(dt) { netT -= dt; if (netT <= 0 && GD.net) { netT = 0.09; GD.net.send({ k: 'st', s: netSnapshot(), msg: GD.msg ? { ...GD.msg } : null }) } }
function applySnapshot(s) {
  GD.t = s.t; GD.sun = s.sun; GD.brain = s.brain; GD.cd = s.cd || {}; GD.kills = s.k
  const pm = new Map(GD.plants.map((p) => [p.id, p]))
  GD.plants = s.p.map((a) => { const o = pm.get(a[0]) || { t: Math.random() * 3 }; return Object.assign(o, { id: a[0], type: a[1], r: a[2], c: a[3], hp: a[4], max: PLANTS[a[1]].hp, armed: a[5], chew: a[6], fuse: a[7], kick: a[8] ? 0.15 : 0 }) })
  const zm = new Map(GD.zombies.map((z) => [z.id, z]))
  GD.zombies = s.z.map((a) => { const o = zm.get(a[0]) || { t: Math.random() * 6, eating: 0, hit: 0, slow: 0 }; return Object.assign(o, { id: a[0], type: a[1], r: a[2], x: a[3], hp: a[4], max: ZOMBIES[a[1]].hp, slow: a[5] ? 1 : 0, eating: a[6] ? 0.3 : 0, hit: a[7] ? 0.1 : 0 }) })
  GD.peas = s.pe.map((a) => ({ id: a[0], r: a[1], x: a[2], snow: !!a[3] }))
  GD.suns = s.su.map((a) => ({ id: a[0], x: a[1], y: a[2], v: a[3], fall: a[4], age: 0 }))
  GD.mowers = s.m.map((q) => { const [f, x] = q.split(':'); return { x: +x, run: f === '1', used: f === '2' } })
}
function guestStep(dt) {
  for (const z of GD.zombies) { z.t += dt; if (!z.eating) z.x -= ZOMBIES[z.type].speed * (z.slow ? 0.5 : 1) * dt }
  for (const p of GD.plants) p.t += dt
  for (const pe of GD.peas) pe.x += 56 * dt
  for (const m of GD.mowers) if (m.run) m.x += 42 * dt
}
function emitTick(dt) { if (GD.net && GD.net.role === 'host') hostNet(dt); GD.emitT -= dt; if (GD.emitT <= 0) { GD.emitT = 0.1; emitG() } }
function emitG() {
  const L = LEVELS[GD.lvl] || LEVELS[0]
  const mySide = GD.kind === 'plants' ? 'plants' : GD.kind === 'zombies' ? 'zombies' : GD.net ? (GD.net.me === 0 ? 'plants' : 'zombies') : 'plants'
  snap = {
    mode: GD.mode, paused: GD.paused, kind: GD.kind, side: mySide, level: GD.lvl + 1, name: L.name, t: GD.t, sun: GD.sun, brain: GD.brain, sel: GD.sel, shovel: GD.shovel, cd: { ...GD.cd }, msg: GD.msg, over: GD.over, kills: GD.kills, score: GD.score,
    wave: GD.dir ? Math.min(1, GD.dir.i / Math.max(1, GD.dir.list.length)) : Math.min(1, GD.t / SURVIVE_T), waveLeft: GD.dir ? GD.dir.list.length - GD.dir.i + GD.zombies.length : Math.max(0, Math.ceil(SURVIVE_T - GD.t)),
    seeds: mySide === 'zombies' ? Object.keys(ZOMBIES) : seedsFor(GD.kind === 'versus' ? 'versus' : 'plants', GD.lvl), online: !!GD.net, foe: GD.net ? GD.net.foe : null,
  }
  subs.forEach((f) => f())
}
// ---------- input ----------
function mySide() { return GD.kind === 'plants' ? 'plants' : GD.kind === 'zombies' ? 'zombies' : GD.net ? (GD.net.me === 0 ? 'plants' : 'zombies') : 'plants' }
function act(a) { // an action from this client: run it locally (host/solo) or ask the host (guest)
  if (GD.net && GD.net.role === 'guest') { GD.net.sendHost({ k: 'act', a }); return }
  hostAct(a, mySide())
}
function hostAct(a, side) {
  if (!a || GD.mode !== 'play') return
  if (side === 'plants') {
    if (a.k === 'plant') { if (GD.kind === 'versus' || UNLOCK.slice(0, LEVELS[GD.lvl].seeds).includes(a.type)) placePlant(a.type, a.r | 0, a.c | 0) }
    else if (a.k === 'shovel') shovelAt(a.r | 0, a.c | 0)
    else if (a.k === 'sun') collectSun(a.id)
  } else if (side === 'zombies' && a.k === 'zomb') dropZombie(a.type, a.r | 0)
}
function pointer(type, ax, ay) {
  if (GD.mode !== 'play' || GD.paused) return
  const g = unprojectGround(camGarden(), ax / 50, ay / 28)
  if (!g) return
  const r = rowAt(g.y), c = colAt(g.x)
  GD.hover = r >= 0 && r < ROWS && c >= 0 && c < COLS ? { r, c } : (r >= 0 && r < ROWS ? { r, c: -1 } : null)
  if (type !== 'down') return
  const side = mySide()
  if (side === 'plants') {
    // sun first
    let best = null, bd = 6
    for (const s of GD.suns) { const d = Math.hypot(s.x - g.x, s.y - g.y); if (d < bd) { bd = d; best = s } }
    if (best) { if (GD.net && GD.net.role === 'guest') act({ k: 'sun', id: best.id }); else collectSun(best.id); return }
    if (!GD.hover || GD.hover.c < 0) return
    if (GD.shovel) { act({ k: 'shovel', r, c }); GD.shovel = false; return }
    if (GD.sel) {
      if (GD.net && GD.net.role === 'guest') { const d = PLANTS[GD.sel]; if (!plantAt(r, c) && GD.sun >= d.cost && !((GD.cd[GD.sel] || 0) > 0)) act({ k: 'plant', type: GD.sel, r, c }) }
      else if (placePlant(GD.sel, r, c)) { /* done */ } else sfx('deny')
    }
  } else if (GD.hover && GD.sel) {
    const d = ZOMBIES[GD.sel]
    if (GD.brain >= d.cost && !((GD.cd[GD.sel] || 0) > 0)) act({ k: 'zomb', type: GD.sel, r })
    else sfx('deny')
  }
}
function onKey(code) {
  if (GD.mode === 'idle') return
  if (code === 'Escape' || code === 'KeyP') { if (GD.mode === 'play' && !GD.net) { GD.paused = !GD.paused; emitG() } return }
  if (GD.mode === 'over' && code === 'Enter') return gardenActions.rematch()
  const n = /^Digit([1-9])$/.exec(code)
  if (n && snap) { const k = snap.seeds[+n[1] - 1]; if (k) gardenActions.select(k) }
  if (code === 'KeyX') { GD.shovel = !GD.shovel; GD.sel = null; emitG() }
}
const camGarden = () => ({ x: 0, y: 70, z: 40, tx: 0, ty: 0, tz: -2, fov: 45, far: 400, aspect: 100 / 56 })
export const gardenTest = { place: placePlant, drop: dropZombie, hostAct, snapshot: netSnapshot, apply: applySnapshot, collectSun }
export const gardenActions = {
  start, stop, quit() { toMenu() }, resume() { GD.paused = false; emitG() }, pause() { if (GD.mode === 'play' && !GD.paused && !GD.net) { GD.paused = true; emitG(); return true } return false },
  rematch() { if (GD.net) { if (GD.net.role === 'host') GD.net.restart(); else GD.net.sendHost({ k: 'rematch' }); return } start({ kind: GD.kind, level: GD.kind === 'plants' && GD.over && GD.over.win ? Math.min(LEVELS.length - 1, GD.lvl + 1) : GD.lvl }) },
  select(k) { GD.sel = GD.sel === k ? null : k; GD.shovel = false; sfx('ui'); emitG() },
  toggleShovel() { GD.shovel = !GD.shovel; GD.sel = null; emitG() },
  pointer,
}
// ---------- online (versus): the host runs the sim; the guest sees snapshots and sends actions ----------
registerNet('garden', {
  min: 2,
  begin(ctx) {
    const foe = ctx.players.find((p) => p.id !== ctx.players[ctx.me].id)
    const swap = !!ctx.opts.swap
    const me = swap ? 1 - ctx.me : ctx.me // seat 0 = plants
    start({ kind: 'versus', seed: ctx.seed, level: 0 })
    GD.net = { role: ctx.role, me, foe: foe ? foe.name : 'RIVAL', send: (d) => ctx.send(d), sendHost: (d) => ctx.sendHost(d), restart: () => { ctx.opts.swap = !ctx.opts.swap; ctx.restart() } }
    GD.net.ctx = ctx
    if (ctx.role === 'host') GD.ai = null
    GD.sun = 200; emitG()
  },
  active: () => !!GD.net && GD.mode !== 'idle',
  onMsg(d, from) {
    if (!d || !GD.net) return
    if (GD.net.role === 'host') {
      if (d.k === 'act') hostAct(d.a, GD.net.me === 0 ? 'zombies' : 'plants')
      else if (d.k === 'rematch' && GD.mode === 'over') GD.net.restart()
    } else if (d.k === 'st') { applySnapshot(d.s); if (d.msg && !GD.msg) GD.msg = d.msg }
    else if (d.k === 'end') { const me0 = GD.net.me === 0, pw = d.over.plantsWon; GD.mode = 'over'; GD.over = { ...d.over, win: me0 ? pw : !pw, side: me0 ? 'plants' : 'zombies' }; sfx(GD.over.win ? 'win' : 'over'); profile.gardenGames = (profile.gardenGames || 0) + 1; if (GD.over.win) profile.gardenWins = (profile.gardenWins || 0) + 1; saveProfile(); music.stop(); emitG() }
  },
  onLeave() {
    if (GD.mode !== 'play' || !GD.net) return
    if (GD.net.role === 'host') finish(GD.net.me === 0) // the rival left: the host wins by forfeit
    else { GD.mode = 'over'; GD.over = { win: true, kind: 'versus', plantsWon: GD.net.me === 0, score: GD.score, kills: GD.kills, planted: GD.planted, time: GD.t, level: 1, bonus: 0, side: GD.net.me === 0 ? 'plants' : 'zombies', forfeit: true }; music.stop(); emitG() }
  },
})
// the host also needs to run the AI side of an empty seat; for a two-human match nothing else is needed

// ---------- drawing ----------
const rgb = (h) => { const n = parseInt(h.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255] }
const GREEN = rgb('#3fbf4a'), DGREEN = rgb('#2a8a38'), BROWN = rgb('#7a5030'), SKIN = rgb('#9fbf94'), CLOTH = rgb('#5a4a6a')
function lights() { return { sun: { x: -25, y: 80, z: 20, color: '#fff3d6', intensity: 1.2 }, ambient: 0.9, dir: 0.15, lantern: { x: 0, y: 40, z: 6, color: '#fff2c8', intensity: 1.0, distance: 130 }, shadow: false } }
function draw3(api) {
  const { put3, putS } = api, t = G.time
  // lawn: checker tiles, house, graveyard
  put3(0, -1.4, 0, 118, 1.6, 66, 0, 0.1, 0.1, 0.12, 0)
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { const k = (r + c) % 2 ? 0.95 : 0.78; put3(cellX(c), -0.2, -rowY(r), CW - 0.1, 0.5, RH - 0.1, 0, 0.22 * k, 0.62 * k, 0.2 * k, 0) }
  put3(-45, -0.2, 0, 16, 0.5, 40, 0, 0.55, 0.5, 0.45, 0)
  put3(-48, 4, 0, 8, 8, 34, 0, 0.8, 0.45, 0.35, 0); put3(-48, 9.5, 0, 9.4, 3, 36, 0, 0.45, 0.2, 0.2, 0)
  for (let r = 0; r < ROWS; r++) put3(-42.4, 1, -rowY(r), 0.5, 0.7, RH - 1.2, 0, 0.9, 0.9, 0.3, 0) // rail
  put3(44, -0.2, 0, 14, 0.5, 40, 0, 0.14, 0.18, 0.14, 0)
  for (let i = 0; i < 6; i++) { const y = -14 + i * 6; put3(47 + (i % 2), 1.6, -y, 2.2, 3.2, 0.8, 0, 0.5, 0.52, 0.55, 0); put3(47 + (i % 2), 3.4, -y, 1.4, 0.8, 0.8, 0, 0.5, 0.52, 0.55, 0) }
  // hover highlight
  if (GD.hover && GD.hover.c >= 0 && mySideSafe() === 'plants') put3(cellX(GD.hover.c), 0.2, -rowY(GD.hover.r), CW - 0.3, 0.2, RH - 0.3, 0, 1.2, 1.2, 0.6, 0)
  if (GD.hover && mySideSafe() === 'zombies') put3(0, 0.15, -rowY(GD.hover.r), CW * COLS, 0.15, RH - 0.4, 0, 0.8, 0.2, 0.2, 0)
  // mowers
  GD.mowers.forEach((m, r) => { if (m.used && !m.run) return; const y = rowY(r); put3(m.x, 1.1, -y, 3.4, 1.6, 2.8, 0, 1.4, 0.2, 0.2, 0); put3(m.x - 1, 2.1, -y, 0.8, 1.5, 0.6, 0, 0.5, 0.5, 0.5, 0); if (m.run) put3(m.x + 2.2, 1.2, -y, 0.4, 0.4, 2.6, 0, 2, 2, 2, t * 20) })
  // plants
  for (const p of GD.plants) drawPlant(put3, putS, p, t)
  for (const z of GD.zombies) drawZombie(put3, putS, z, t)
  for (const pe of GD.peas) { const c = pe.snow ? [0.4, 0.9, 2.4] : [0.4, 1.7, 0.3]; putS(pe.x, 3.4, -rowY(pe.r), 1.5, 1.5, 1.5, c[0], c[1], c[2]) }
  for (const s of GD.suns) { const gl = 0.8 + 0.3 * Math.sin(t * 6 + s.id); putS(s.x, 2 + s.fall + 0.5 * Math.sin(t * 3 + s.id), -s.y, 3.2, 3.2, 3.2, 2.6 * gl, 2.1 * gl, 0.3); put3(s.x, 2 + s.fall, -s.y, 4.6, 0.3, 0.3, 0, 2.4, 2, 0.2, t * 2); put3(s.x, 2 + s.fall, -s.y, 0.3, 0.3, 4.6, 0, 2.4, 2, 0.2, t * 2) }
  for (const q of GD.fx) { const f = q.life / q.max, s = q.s * (0.3 + 0.7 * f); putS(q.x, q.y, q.z, s, s, s, q.c[0], q.c[1], q.c[2]) }
}
function mySideSafe() { try { return mySide() } catch { return 'plants' } }
function drawPlant(put3, putS, p, t) {
  const x = cellX(p.c), z = -rowY(p.r), d = PLANTS[p.type]
  const hurt = clamp(p.hp / p.max, 0, 1), sway = Math.sin(t * 2 + p.t * 3 + p.id) * 0.25
  const shade = (c, k = 1) => [c[0] * k * (0.6 + 0.4 * hurt), c[1] * k * (0.6 + 0.4 * hurt), c[2] * k * (0.6 + 0.4 * hurt)]
  const g = shade(GREEN), dg = shade(DGREEN)
  const base = () => { put3(x, 0.4, z, 3.2, 0.8, 3.2, 0, 0.25, 0.4, 0.15, 0) }
  if (p.type === 'sunflower') {
    base(); put3(x + sway * 0.3, 2.6, z, 0.7, 4, 0.7, 0, dg[0], dg[1], dg[2], 0)
    put3(x - 1.6, 2.4, z, 2, 0.5, 0.8, 0, g[0], g[1], g[2], 0.5); put3(x + 1.6, 2.4, z, 2, 0.5, 0.8, 0, g[0], g[1], g[2], -0.5)
    for (let i = 0; i < 8; i++) { const a = i * 0.785 + t * 0.3; put3(x + sway + Math.cos(a) * 2.2, 5.6 + Math.sin(a) * 2.2, z + 0.3, 1.6, 1.6, 0.5, 0, 2.2, 1.7, 0.2, 0) }
    put3(x + sway, 5.6, z + 0.6, 2.8, 2.8, 1, 0, 0.45, 0.25, 0.1, 0); put3(x + sway + 0.5, 5.8, z + 1.1, 0.4, 0.4, 0.4, 0, 0.05, 0.05, 0.05, 0); put3(x + sway - 0.5, 5.8, z + 1.1, 0.4, 0.4, 0.4, 0, 0.05, 0.05, 0.05, 0)
  } else if (d.fire) {
    base(); const kick = p.kick > 0 ? -0.5 : 0, c = p.type === 'snowpea' ? shade(rgb('#6ac8ff')) : p.type === 'repeater' ? shade(rgb('#2f9a3a')) : g
    put3(x, 2.2, z, 0.8, 3.4, 0.8, 0, dg[0], dg[1], dg[2], 0)
    put3(x - 1.4, 1.9, z, 2, 0.5, 0.8, 0, g[0], g[1], g[2], 0.5)
    putS(x + sway * 0.5, 4.5, z, 3.2, 3.0, 3.0, c[0], c[1], c[2])
    put3(x + 1.9 + kick, 4.5, z, 1.8, 1.6, 1.6, 0, c[0] * 0.8, c[1] * 0.8, c[2] * 0.8, 0); put3(x + 2.9 + kick, 4.5, z, 0.5, 1.2, 1.2, 0, 0.05, 0.1, 0.05, 0)
    if (p.type === 'repeater') { put3(x + 1.9 + kick, 5.7, z, 1.8, 1.2, 1.2, 0, c[0] * 0.8, c[1] * 0.8, c[2] * 0.8, 0) }
    putS(x + 0.8, 5.0, z + 1.4, 0.8, 0.8, 0.5, 2.6, 2.6, 2.6); putS(x + 1.0, 5.0, z + 1.6, 0.4, 0.4, 0.3, 0.05, 0.05, 0.05)
    if (p.type === 'snowpea') put3(x, 6.4, z, 1.6, 0.5, 1.6, 0, 1.8, 2.2, 2.6, 0.3)
  } else if (p.type === 'wallnut') {
    base(); const c = shade(rgb('#a8743a')); const lean = (1 - hurt) * 0.2
    put3(x, 3.4, z, 4.6, 6, 3.8, lean, c[0], c[1], c[2], 0); put3(x, 3.4, z + 1.9, 4.0, 5.2, 0.4, lean, c[0] * 1.1, c[1] * 1.1, c[2] * 1.1, 0)
    put3(x - 1, 4.4, z + 2.2, 0.9, 0.9, 0.3, 0, 2.6, 2.6, 2.6, 0); put3(x + 1, 4.4, z + 2.2, 0.9, 0.9, 0.3, 0, 2.6, 2.6, 2.6, 0)
    put3(x - 1, 4.4, z + 2.4, 0.4, 0.4, 0.3, 0, 0.05, 0.05, 0.05, 0); put3(x + 1, 4.4, z + 2.4, 0.4, 0.4, 0.3, 0, 0.05, 0.05, 0.05, 0)
    if (hurt < 0.6) put3(x + 0.6, 5.2, z + 2.3, 1.6, 0.2, 0.2, 0.5, 0.15, 0.1, 0.05, 0)
  } else if (p.type === 'cherry') {
    base(); const f = 1 + (1 - clamp(p.fuse, 0, 1)) * 0.5, fl = Math.sin(t * 30) > 0 ? 1.6 : 1
    putS(x - 1.6, 2.6, z, 3.2 * f, 3.2 * f, 3.2 * f, 2 * fl, 0.15, 0.15); putS(x + 1.6, 2.6, z, 3.2 * f, 3.2 * f, 3.2 * f, 2 * fl, 0.15, 0.15)
    put3(x, 5, z, 0.4, 2.6, 0.4, 0, 0.2, 0.6, 0.2, 0.3); put3(x + 0.6, 6.2, z, 1.6, 0.4, 0.8, 0, 0.3, 1.2, 0.3, 0)
  } else if (p.type === 'mine') {
    const armed = p.armed >= 14
    put3(x, 0.8, z, 4.2, 1.4, 4.2, 0, 0.42, 0.28, 0.14, 0)
    put3(x, armed ? 2.2 : 1.1, z, 1.8, armed ? 1.8 : 0.8, 1.8, 0, armed ? 0.55 : 0.3, 0.38, 0.2, 0)
    if (armed) { put3(x, 3.2, z, 0.5, 0.5, 0.5, 0, 2.6 * (0.5 + 0.5 * Math.sin(t * 8)), 0.1, 0.1, 0) }
  } else if (p.type === 'chomper') {
    base(); const open = p.chew > 0 ? 0 : 0.7 + 0.3 * Math.sin(t * 5), pc = shade(rgb('#9a3ac8'))
    put3(x, 2.4, z, 0.9, 4.4, 0.9, 0, dg[0], dg[1], dg[2], 0)
    put3(x, 5.6 + (p.chew > 0 ? -0.4 : 0), z, 3.8, 2.2 + open * 1.2, 3.6, 0, pc[0], pc[1], pc[2], 0)
    put3(x + 2.4, 6.5 + open * 0.8, z, 3.4, 1.1, 3.4, 0.1 * open, pc[0] * 0.9, pc[1] * 0.9, pc[2] * 0.9, 0)
    put3(x + 2.4, 4.9 - open * 0.3, z, 3.2, 1.0, 3.0, 0, pc[0] * 0.9, pc[1] * 0.9, pc[2] * 0.9, 0)
    for (let i = -1; i <= 1; i++) put3(x + 3.7, 5.9 + open * 0.5, z + i * 1, 0.4, 0.5, 0.4, 0, 2.6, 2.6, 2.6, 0)
    putS(x + 0.5, 7, z + 1.4, 0.9, 0.9, 0.6, 2.6, 2.6, 2.6)
  }
  if (hurt < 0.35 && p.type !== 'cherry') putS(x, 9, z, 0.5, 0.5, 0.5, 3, 0.3, 0.2)
}
function drawZombie(put3, putS, z, t) {
  const d = ZOMBIES[z.type], y = rowY(z.r), zz = -y, x = z.x
  const s = z.type === 'giant' ? 1.7 : 1, walk = Math.sin(z.t * d.speed * 2.4 + z.id) * (z.eating > 0 ? 0.2 : 0.55)
  const flash = z.hit > 0 ? 1.8 : 1, lean = z.type === 'runner' ? 0.3 : 0
  const sk = SKIN.map((v) => v * flash), cl = (z.type === 'giant' ? rgb('#6a3030') : CLOTH).map((v) => v * flash)
  const sl = z.slow > 0 ? [0.7, 0.9, 1.5] : [1, 1, 1]
  // legs
  put3(x + walk * 0.8 * s, 1.5 * s, zz - 0.8 * s, 1.0 * s, 3 * s, 1.0 * s, 0, cl[0] * 0.8 * sl[0], cl[1] * 0.8 * sl[1], cl[2] * 0.8 * sl[2], 0)
  put3(x - walk * 0.8 * s, 1.5 * s, zz + 0.8 * s, 1.0 * s, 3 * s, 1.0 * s, 0, cl[0] * 0.8 * sl[0], cl[1] * 0.8 * sl[1], cl[2] * 0.8 * sl[2], 0)
  // torso, head
  put3(x + lean, 4.4 * s, zz, 1.8 * s, 3 * s, 3.0 * s, lean * 0.5, cl[0] * sl[0], cl[1] * sl[1], cl[2] * sl[2], 0)
  put3(x + lean * 1.6, 6.8 * s, zz, 2.0 * s, 2.0 * s, 2.0 * s, 0, sk[0] * sl[0], sk[1] * sl[1], sk[2] * sl[2], 0)
  put3(x + lean * 1.6 - 1.05 * s, 7.0 * s, zz - 0.5 * s, 0.2 * s, 0.5 * s, 0.5 * s, 0, 2.2, 2.2, 1.8, 0); put3(x + lean * 1.6 - 1.05 * s, 7.0 * s, zz + 0.5 * s, 0.2 * s, 0.5 * s, 0.5 * s, 0, 2.2, 2.2, 1.8, 0)
  // arms forward
  const reach = z.eating > 0 ? Math.sin(z.t * 14) * 0.4 : 0
  put3(x - 1.8 * s + reach, 5.0 * s, zz - 1.8 * s, 2.6 * s, 0.9 * s, 0.9 * s, 0, sk[0], sk[1], sk[2], 0); put3(x - 1.8 * s - reach, 5.0 * s, zz + 1.8 * s, 2.6 * s, 0.9 * s, 0.9 * s, 0, sk[0], sk[1], sk[2], 0)
  if (z.type === 'cone') { put3(x + lean * 1.6, 8.3, zz, 1.9, 1.2, 1.9, 0, 2.2, 0.9, 0.1, 0); put3(x + lean * 1.6, 9.2, zz, 1.3, 1.0, 1.3, 0, 2.2, 0.9, 0.1, 0); put3(x + lean * 1.6, 9.9, zz, 0.7, 0.8, 0.7, 0, 2.2, 0.9, 0.1, 0) }
  if (z.type === 'bucket') { put3(x + lean * 1.6, 8.4, zz, 2.5, 1.9, 2.5, 0, 0.7, 0.74, 0.8, 0); put3(x + lean * 1.6, 9.4, zz, 2.7, 0.3, 2.7, 0, 0.8, 0.84, 0.9, 0) }
  if (z.hp < z.max * 0.4) putS(x, 11 * s, zz, 0.5, 0.5, 0.5, 3, 0.3, 0.2)
}
if (typeof window !== 'undefined') { window.__GD = GD; window.__garden = gardenActions; window.__gardenT = gardenTest }
games.garden = { update, onKey, draw() {}, draw3, camera: () => camGarden(), lights, stop, sky: () => '#0c1a2a' }
