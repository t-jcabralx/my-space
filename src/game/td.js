// NEON DEFENSE: tower defense. 3 maps, 6 towers with 3 upgrades each, 25 waves, flyers, bosses and an airstrike.
// Tap a build button (or keys 1-6), tap a free cell to build, tap a tower to upgrade / sell it. Space = next wave, Q = airstrike, F = speed.
import { G, emit as engineEmit, games, profile, saveProfile, recordScore, part, ring, shake, flash, popup, stepParticles, toMenu } from './engine.js'
import { sfx, music, speak } from './audio.js'
import { col, disk, circle, rect, line, clamp, R } from './pxl.js'

export const COLS = 20, ROWS = 11, CS = 4
const cx = (i) => -38 + i * CS, cy = (j) => 20 - j * CS
export const MAPS = [
  { name: 'SERPENT', color: '#27e0a0', path: [[0, 5], [4, 5], [4, 1], [9, 1], [9, 9], [14, 9], [14, 3], [19, 3]] },
  { name: 'CROSSROADS', color: '#4aa8ff', path: [[0, 2], [6, 2], [6, 8], [12, 8], [12, 2], [16, 2], [16, 8], [19, 8]] },
  { name: 'SPIRAL', color: '#ff6ad0', path: [[0, 9], [16, 9], [16, 1], [3, 1], [3, 7], [12, 7], [12, 4], [19, 4]] },
]
export const TOWERS = [
  { id: 'pulse', name: 'PULSE', ico: '🔫', cost: 50, dmg: 8, range: 14, rate: 0.42, color: '#3de8ff', air: true, desc: 'Fast and cheap. Hits ground and air.' },
  { id: 'cannon', name: 'CANNON', ico: '💣', cost: 100, dmg: 30, range: 15, rate: 1.4, color: '#ff9a3a', air: false, splash: 5.2, desc: 'Splash damage. Ground only.' },
  { id: 'frost', name: 'FROST', ico: '❄️', cost: 80, dmg: 3, range: 13, rate: 0.7, color: '#9ad8ff', air: true, slow: 0.5, desc: 'Slows enemies in its range.' },
  { id: 'sniper', name: 'SNIPER', ico: '🎯', cost: 140, dmg: 95, range: 36, rate: 2.2, color: '#ff4a5a', air: true, desc: 'Huge range and damage, slow shots.' },
  { id: 'tesla', name: 'TESLA', ico: '⚡', cost: 160, dmg: 14, range: 13, rate: 0.9, color: '#ffe84a', air: true, chain: 3, desc: 'Lightning jumps between enemies.' },
  { id: 'bank', name: 'BANK', ico: '💰', cost: 120, dmg: 0, range: 0, rate: 0, color: '#6aff9a', air: false, desc: 'Earns gold at the end of every wave.' },
]
const ENEMY = {
  grunt: { hp: 32, spd: 9, gold: 4, c: '#ff5a6a', r: 1.5 },
  runner: { hp: 20, spd: 17, gold: 4, c: '#ffd23a', r: 1.2 },
  tank: { hp: 150, spd: 6, gold: 12, c: '#9a6bff', r: 2.1 },
  swarm: { hp: 11, spd: 12, gold: 2, c: '#7aff6a', r: 1.0 },
  flyer: { hp: 42, spd: 11, gold: 8, c: '#ff8ad8', r: 1.5, air: true },
  boss: { hp: 650, spd: 5, gold: 90, c: '#ff3a3a', r: 3.2, boss: true },
}
export const WAVES = 25
function waveList(w) {
  const L = []
  const add = (type, n, gap) => { for (let i = 0; i < n; i++) L.push({ type, t: i * gap }) }
  const off = () => (L.length ? L[L.length - 1].t + 1.5 : 0)
  if (w % 5 === 0) { add('boss', Math.max(1, Math.floor(w / 10)), 4); const o = off(); for (let i = 0; i < 4 + w / 2; i++) L.push({ type: w % 10 === 0 ? 'tank' : 'grunt', t: o + i * 0.9 }) }
  else if (w % 4 === 3) add('flyer', 4 + Math.floor(w * 0.7), 1.1)
  else if (w % 3 === 0) add('swarm', 12 + w * 2, 0.35)
  else if (w % 3 === 1) { add('runner', 5 + w, 0.7); if (w > 6) { const o = off(); for (let i = 0; i < w / 3; i++) L.push({ type: 'tank', t: o + i * 1.8 }) } }
  else { add('grunt', 6 + w, 0.8); if (w > 4) { const o = off(); for (let i = 0; i < w / 3; i++) L.push({ type: 'tank', t: o + i * 1.6 }) } }
  return L
}
const hpScale = (w) => Math.pow(1.13, w - 1) * (1 + (w > 15 ? (w - 15) * 0.08 : 0))

export const TD = { mode: 'idle', paused: false, map: 0, path: [], cells: new Set(), occ: {}, towers: [], enemies: [], shots: [], fx: [], wave: 0, spawn: null, gold: 0, lives: 20, kills: 0, sel: null, build: 'pulse', hover: null, speed: 1, auto: false, over: null, strike: 0, strikeArm: false, strikes: [], t: 0, emitT: 0, msg: null, bonusT: 0, nextT: 0, leaked: 0, over2: false }
let snap = null
const subs = new Set()
export const subscribeTd = (f) => { subs.add(f); return () => subs.delete(f) }
export const getTdSnap = () => snap
const upCost = (t) => Math.round(TOWERS.find((x) => x.id === t.id).cost * 0.75 * t.lvl)
const sellVal = (t) => Math.round(t.invested * 0.7)
function emitT() {
  const st = TD.sel
  snap = { mode: TD.mode, paused: TD.paused, map: MAPS[TD.map].name, wave: TD.wave, waves: TD.goal || WAVES, gold: Math.floor(TD.gold), lives: TD.lives, kills: TD.kills, build: TD.build, speed: TD.speed, auto: TD.auto, over: TD.over, msg: TD.msg ? { ...TD.msg } : null, running: !!TD.spawn || TD.enemies.length > 0, left: (TD.spawn ? TD.spawn.list.length : 0) + TD.enemies.length, strike: Math.max(0, TD.strike), strikeArm: TD.strikeArm, sel: st ? { id: st.id, name: TOWERS.find((x) => x.id === st.id).name, lvl: st.lvl, up: st.lvl < 4 ? upCost(st) : 0, sell: sellVal(st), dmg: Math.round(dmgOf(st)), range: Math.round(rangeOf(st)), kills: st.kills } : null, nextBonus: Math.max(0, Math.ceil(TD.nextT)) }
  subs.forEach((f) => f())
}
function pathRaster(path) {
  const set = new Set()
  for (let k = 0; k < path.length - 1; k++) {
    const [a, b] = [path[k], path[k + 1]]
    const n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]))
    for (let i = 0; i <= n; i++) set.add(Math.round(a[0] + ((b[0] - a[0]) * i) / (n || 1)) + ',' + Math.round(a[1] + ((b[1] - a[1]) * i) / (n || 1)))
  }
  return set
}
function start(cfg = {}) {
  const m = clamp(cfg.map | 0, 0, MAPS.length - 1)
  TD.map = m; TD.goal = clamp(cfg.goal | 0 || WAVES, 3, WAVES)
  TD.wp = MAPS[m].path.map(([i, j]) => [cx(i), cy(j)])
  TD.wp[0][0] -= 4; TD.wp[TD.wp.length - 1][0] += 4
  TD.seg = []; let tot = 0
  for (let k = 0; k < TD.wp.length - 1; k++) { const L = Math.hypot(TD.wp[k + 1][0] - TD.wp[k][0], TD.wp[k + 1][1] - TD.wp[k][1]); TD.seg.push(L); tot += L }
  TD.plen = tot
  TD.cells = pathRaster(MAPS[m].path)
  TD.occ = {}; TD.towers = []; TD.enemies = []; TD.shots = []; TD.strikes = []; TD.wave = 0; TD.spawn = null; TD.gold = 170; TD.lives = 20; TD.kills = 0; TD.sel = null; TD.build = 'pulse'; TD.speed = 1; TD.auto = !!cfg.auto
  TD.over = null; TD.strike = 10; TD.strikeArm = false; TD.paused = false; TD.msg = { text: 'BUILD YOUR DEFENCES', sub: 'THEN PRESS NEXT WAVE', color: '#3de8ff', t: 3 }; TD.nextT = 0; TD.leaked = 0
  G.mode = 'td'; engineEmit(); G.parts = []; G.pops = []; G.shake = 0; G.flash = 0
  TD.mode = 'play'
  music.set('bomber', 0); sfx('mission'); emitT()
}
function stop() { TD.mode = 'idle'; TD.paused = false; music.set('menu'); emitT() }
const dmgOf = (t) => TOWERS.find((x) => x.id === t.id).dmg * (1 + (t.lvl - 1) * 0.55)
const rangeOf = (t) => TOWERS.find((x) => x.id === t.id).range * (1 + (t.lvl - 1) * 0.08)
const rateOf = (t) => TOWERS.find((x) => x.id === t.id).rate * Math.pow(0.88, t.lvl - 1)
function posAt(d) {
  let k = 0
  while (k < TD.seg.length - 1 && d > TD.seg[k]) { d -= TD.seg[k]; k++ }
  const f = clamp(d / TD.seg[k], 0, 1), a = TD.wp[k], b = TD.wp[k + 1]
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]
}
function spawnEnemy(type) {
  const def = ENEMY[type], hp = def.hp * hpScale(TD.wave) * (def.boss ? 1 + TD.wave / 8 : 1)
  const e = { type, hp, max: hp, d: 0, slow: 0, slowT: 0, def, x: TD.wp[0][0], y: TD.wp[0][1], dead: false, jig: Math.random() * 6 }
  if (def.air) { e.x = TD.wp[0][0]; e.y = TD.wp[0][1]; e.fy = R(-14, 14); e.t = 0 }
  TD.enemies.push(e)
}
function nextWave() {
  if (TD.mode !== 'play' || TD.spawn || TD.wave >= (TD.goal || WAVES)) return
  if (TD.enemies.length === 0 || TD.wave === 0 || true) {
    TD.wave++
    TD.spawn = { list: waveList(TD.wave), t: 0 }
    if (TD.nextT > 0 && TD.wave > 1) { const b = Math.ceil(TD.nextT) * 2; TD.gold += b; popup(0, -24, '+' + b + ' EARLY BONUS', [1, 0.9, 0.3]) }
    TD.nextT = 0
    const boss = TD.wave % 5 === 0
    TD.msg = { text: boss ? 'BOSS WAVE ' + TD.wave : 'WAVE ' + TD.wave, sub: TD.spawn.list.length + ' ENEMIES', color: boss ? '#ff4a5a' : '#ffe84a', t: 2 }
    sfx(boss ? 'rgBoss' : 'tdWave'); if (boss) { speak('Boss incoming', 0.4, 0.95); shake(1) }
    emitT()
  }
}
function cellAt(x, y) { const i = Math.floor((x + 40) / CS), j = Math.floor((22 - y) / CS); return i >= 0 && i < COLS && j >= 0 && j < ROWS ? [i, j] : null }
function kill(e, byStrike) {
  if (e.dead) return
  e.dead = true; TD.kills++; TD.gold += e.def.gold; if (!byStrike) sfx('tdKill')
  popup(e.x, e.y + 2, '+' + e.def.gold, [1, 0.9, 0.3])
  const c = col(e.def.c); for (let i = 0; i < (e.def.boss ? 30 : 8); i++) part(e.x, e.y, R(-30, 30), R(-30, 30), R(0.2, 0.6), c, R(0.8, 1.6))
  if (e.def.boss) { shake(1.5); flash(0.3, [1, 0.6, 0.4]); sfx('tdBoom') }
}
function hurt(e, d, t) {
  if (e.dead) return
  e.hp -= d; e.flash = 0.08
  if (e.hp <= 0) { if (t) t.kills++; kill(e) }
}
function pick(t, range) {
  const def = TOWERS.find((x) => x.id === t.id)
  let best = null
  for (const e of TD.enemies) {
    if (e.dead || (e.def.air && !def.air)) continue
    if (Math.hypot(e.x - t.x, e.y - t.y) > range) continue
    const pr = e.def.air ? e.t * 60 : e.d
    if (!best || pr > best.pr) best = { e, pr }
  }
  return best && best.e
}
function fireTower(t) {
  const def = TOWERS.find((x) => x.id === t.id), range = rangeOf(t)
  const e = pick(t, range)
  if (!e) return false
  t.ang = Math.atan2(e.y - t.y, e.x - t.x)
  t.cd = rateOf(t); t.recoil = 0.12
  const dmg = dmgOf(t)
  if (def.id === 'pulse') { TD.shots.push({ x: t.x, y: t.y, tx: e, spd: 90, dmg, c: def.color, t }); sfx('tdShot') }
  else if (def.id === 'cannon') { TD.shots.push({ x: t.x, y: t.y, tx: e, spd: 50, dmg, c: def.color, splash: def.splash + t.lvl * 0.4, big: true, t }); sfx('tdShot') }
  else if (def.id === 'sniper') { TD.shots.push({ x: t.x, y: t.y, tx: e, spd: 220, dmg, c: def.color, t }); sfx('tdBoom') }
  else if (def.id === 'frost') { e.slow = def.slow + t.lvl * 0.05; e.slowT = 1.6; TD.shots.push({ x: t.x, y: t.y, tx: e, spd: 80, dmg, c: def.color, t }); sfx('tdIce') }
  else if (def.id === 'tesla') {
    const hit = [e]; let cur = e
    for (let k = 1; k < def.chain + t.lvl - 1; k++) {
      let nx = null
      for (const q of TD.enemies) { if (q.dead || hit.includes(q) || (q.def.air && !def.air)) continue; const d = Math.hypot(q.x - cur.x, q.y - cur.y); if (d < 9 && (!nx || d < nx.d)) nx = { q, d } }
      if (!nx) break
      hit.push(nx.q); cur = nx.q
    }
    let px = t.x, py = t.y
    for (const q of hit) { TD.fx.push({ k: 'zap', x0: px, y0: py, x1: q.x, y1: q.y, l: 0.18, c: def.color }); hurt(q, dmg, t); px = q.x; py = q.y }
    sfx('tdZap')
  }
  return true
}
function update(dtRaw) {
  if (TD.mode === 'idle' || TD.paused) return
  if (TD.over) { stepParticles(dtRaw); return }
  const dt = Math.min(dtRaw, 0.04) * TD.speed
  TD.t += dt
  TD.strike = Math.max(0, TD.strike - dt)
  if (TD.msg) { TD.msg.t -= dtRaw; if (TD.msg.t <= 0) TD.msg = null }
  // spawning
  if (TD.spawn) {
    TD.spawn.t += dt
    while (TD.spawn.list.length && TD.spawn.list[0].t <= TD.spawn.t) spawnEnemy(TD.spawn.list.shift().type)
    if (!TD.spawn.list.length) TD.spawn = null
  }
  // enemies
  for (const e of TD.enemies) {
    if (e.dead) continue
    e.slowT -= dt; if (e.slowT <= 0) e.slow = 0
    e.flash = Math.max(0, (e.flash || 0) - dt)
    const sp = e.def.spd * (1 - e.slow)
    if (e.def.air) {
      e.t += dt * sp / 100; const span = TD.wp[TD.wp.length - 1][0] - TD.wp[0][0]
      e.x = TD.wp[0][0] + span * e.t; e.y = e.fy + Math.sin(e.t * 18 + e.jig) * 3
      if (e.t >= 1) leak(e)
    } else {
      e.d += sp * dt
      const [x, y] = posAt(e.d); e.x = x; e.y = y
      if (e.d >= TD.plen) leak(e)
    }
  }
  // towers
  for (const t of TD.towers) {
    t.recoil = Math.max(0, (t.recoil || 0) - dt)
    if (t.id === 'bank') continue
    t.cd -= dt
    if (t.cd <= 0) { if (!fireTower(t)) t.cd = 0.05 }
  }
  // projectiles
  for (const s of TD.shots) {
    const e = s.tx
    if (!e || e.dead) { if (s.splash) { s.tx = { x: s.lx || s.x, y: s.ly || s.y, dead: false, ghost: true } } else { s.done = true; continue } }
    const tx = s.tx.x, ty = s.tx.y
    s.lx = tx; s.ly = ty
    const dx = tx - s.x, dy = ty - s.y, d = Math.hypot(dx, dy), st = s.spd * dt
    if (d <= st + 0.6) {
      s.done = true
      if (s.splash) {
        for (const q of TD.enemies) if (!q.dead && !q.def.air && Math.hypot(q.x - tx, q.y - ty) <= s.splash) hurt(q, s.dmg, s.t)
        TD.fx.push({ k: 'boom', x: tx, y: ty, l: 0.35, r: s.splash }); sfx('tdBoom'); shake(0.25)
        for (let i = 0; i < 10; i++) part(tx, ty, R(-28, 28), R(-28, 28), 0.35, col('#ffb04a'), R(0.8, 1.5))
      } else if (!s.tx.ghost) hurt(s.tx, s.dmg, s.t)
    } else { s.x += (dx / d) * st; s.y += (dy / d) * st }
  }
  TD.shots = TD.shots.filter((s) => !s.done)
  // airstrike bombs
  for (const b of TD.strikes) {
    b.t -= dt
    if (b.t <= 0 && !b.done) {
      b.done = true
      for (const q of TD.enemies) if (!q.dead && Math.hypot(q.x - b.x, q.y - b.y) < 7) hurt(q, 70 + TD.wave * 6, null)
      TD.fx.push({ k: 'boom', x: b.x, y: b.y, l: 0.45, r: 7 }); sfx('tdBoom'); shake(0.4)
      for (let i = 0; i < 14; i++) part(b.x, b.y, R(-36, 36), R(-36, 36), 0.4, col('#ffcf4a'), R(1, 1.8))
    }
  }
  TD.strikes = TD.strikes.filter((b) => !b.done)
  for (const f of TD.fx) f.l -= dt
  TD.fx = TD.fx.filter((f) => f.l > 0)
  TD.enemies = TD.enemies.filter((e) => !e.dead && !e.gone)
  // wave end
  if (TD.wave > 0 && !TD.spawn && TD.enemies.length === 0 && !TD.waveDone) {
    TD.waveDone = true
    const bank = TD.towers.filter((t) => t.id === 'bank').reduce((a, t) => a + 30 + t.lvl * 25, 0)
    const bonus = 25 + TD.wave * 3 + bank
    TD.gold += bonus; TD.nextT = 12
    popup(0, -22, 'WAVE CLEAR  +' + bonus, [0.5, 1, 0.6]); sfx('ding', 6)
    if (TD.wave >= TD.goal) return finish(true)
    if (TD.auto) TD.nextT = 3
  }
  if (TD.waveDone && TD.spawn) TD.waveDone = false
  if (TD.waveDone && TD.nextT > 0) { TD.nextT -= dt; if (TD.auto && TD.nextT <= 0) { TD.waveDone = false; nextWave() } else if (TD.nextT < 0) TD.nextT = 0 }
  stepParticles(dt)
  TD.emitT -= dtRaw
  if (TD.emitT <= 0) { TD.emitT = 0.1; emitT() }
}
function leak(e) {
  e.dead = true; e.gone = true
  const l = e.def.boss ? 5 : 1
  TD.lives = Math.max(0, TD.lives - l); TD.leaked += l
  sfx('tdLeak'); shake(0.6); flash(0.2, [1, 0.3, 0.3])
  popup(TD.wp[TD.wp.length - 1][0] - 4, e.y, '-' + l + '♥', [1, 0.3, 0.3])
  if (TD.lives <= 0) finish(false)
}
function finish(won) {
  TD.mode = 'over'; music.stop()
  const score = TD.wave * 120 + TD.lives * 40 + TD.kills * 2 + (won ? 2000 + (TD.leaked === 0 ? 1500 : 0) : 0)
  TD.over = { win: won, wave: TD.wave, kills: TD.kills, lives: TD.lives, score, map: MAPS[TD.map].name }
  profile.tdGames = (profile.tdGames || 0) + 1
  if (won) profile.tdWins = (profile.tdWins || 0) + 1
  profile.tdBest = Math.max(profile.tdBest || 0, TD.wave)
  profile.tdKills = (profile.tdKills || 0) + TD.kills
  recordScore('td', score); saveProfile()
  sfx(won ? 'win' : 'over'); speak(won ? 'Defence held' : 'Base destroyed', 0.5, 1)
  emitT()
}
function build(i, j) {
  const k = i + ',' + j
  if (TD.cells.has(k) || TD.occ[k]) return false
  const def = TOWERS.find((x) => x.id === TD.build)
  if (!def || TD.gold < def.cost) { sfx('cBad'); popup(cx(i), cy(j), 'NEED ' + (def ? def.cost : 0), [1, 0.4, 0.4]); return false }
  TD.gold -= def.cost
  const t = { id: def.id, i, j, x: cx(i), y: cy(j), lvl: 1, cd: 0.3, ang: 0, invested: def.cost, kills: 0 }
  TD.towers.push(t); TD.occ[k] = t; TD.sel = t
  sfx('tdBuild'); ring(t.x, t.y, 10, 20, [col(def.color)])
  return true
}
export const tdActions = {
  start, stop, quit() { toMenu() },
  resume() { TD.paused = false; emitT() },
  pause() { if (TD.mode === 'play' && !TD.paused) { TD.paused = true; emitT(); return true } return false },
  rematch() { start({ map: TD.map, auto: TD.auto, goal: TD.goal }) },
  next: nextWave,
  setBuild(id) { TD.build = id; TD.sel = null; sfx('ui'); emitT() },
  speed() { TD.speed = TD.speed === 1 ? 2 : TD.speed === 2 ? 3 : 1; sfx('ui'); emitT() },
  auto() { TD.auto = !TD.auto; sfx('ui'); emitT() },
  upgrade() { const t = TD.sel; if (!t || t.lvl >= 4) return; const c = upCost(t); if (TD.gold < c) { sfx('cBad'); return } TD.gold -= c; t.invested += c; t.lvl++; sfx('rgPerk'); ring(t.x, t.y, 14, 26, [col('#ffffff')]); emitT() },
  sell() { const t = TD.sel; if (!t) return; TD.gold += sellVal(t); TD.towers = TD.towers.filter((x) => x !== t); delete TD.occ[t.i + ',' + t.j]; TD.sel = null; sfx('tdSell'); emitT() },
  strike() { if (TD.strike > 0 || TD.mode !== 'play') { sfx('cBad'); return } TD.strikeArm = !TD.strikeArm; sfx('ui'); emitT() },
  pointer(type, x, y) {
    if (TD.mode !== 'play' || TD.paused) return
    const c = cellAt(x, y); TD.hover = c
    if (type !== 'down' || !c) return
    if (TD.strikeArm) {
      TD.strikeArm = false; TD.strike = 40
      for (let k = 0; k < 9; k++) TD.strikes.push({ x: x + R(-6, 6), y: y + R(-6, 6), t: 0.25 + k * 0.09 })
      sfx('tdWave'); emitT(); return
    }
    const t = TD.occ[c[0] + ',' + c[1]]
    if (t) { TD.sel = t; sfx('ui'); emitT(); return }
    if (TD.build && build(c[0], c[1])) emitT(); else { TD.sel = null; emitT() }
  },
}
function onKey(code) {
  if (TD.mode === 'idle') return
  if (code === 'Escape' || code === 'KeyP') { if (TD.mode === 'play') { TD.paused = !TD.paused; emitT() } return }
  if (TD.paused) return
  if (TD.mode === 'over') { if (code === 'Enter') tdActions.rematch(); return }
  const n = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'].indexOf(code)
  if (n >= 0) tdActions.setBuild(TOWERS[n].id)
  else if (code === 'Space' || code === 'Enter') nextWave()
  else if (code === 'KeyU') tdActions.upgrade()
  else if (code === 'KeyS' || code === 'Delete') tdActions.sell()
  else if (code === 'KeyQ') tdActions.strike()
  else if (code === 'KeyF') tdActions.speed()
}
function drawTower(put, t, sel) {
  const def = TOWERS.find((x) => x.id === t.id), c = col(def.color)
  rect(put, t.x - 1.6, t.y - 1.6, t.x + 1.6, t.y + 1.6, col('#1a2638'), 1, -1.4, 0.8)
  disk(put, t.x, t.y, 1.5 + t.lvl * 0.15, c, 0.8, -1, 0.5)
  if (def.id === 'bank') { const k = 0.7 + Math.sin(G.time * 3 + t.i) * 0.3; disk(put, t.x, t.y, 0.9, col('#ffe84a'), 1.4 * k, 0, 0.4) }
  else {
    const a = t.ang, r = 2.4 - (t.recoil || 0) * 8
    for (let u = 0.6; u < r + (def.id === 'sniper' ? 2.4 : 0.6); u += 0.5) put(t.x + Math.cos(a) * u, t.y + Math.sin(a) * u, 0, 0.8, 0.8, c[0] * 1.5, c[1] * 1.5, c[2] * 1.5)
    disk(put, t.x, t.y, 0.9, c, 1.6, 0.3, 0.4)
  }
  for (let l = 0; l < t.lvl - 1; l++) put(t.x - 1.2 + l * 1.2, t.y - 2.3, 0.5, 0.7, 0.7, 2, 1.8, 0.4)
  if (sel) { circle(put, t.x, t.y, rangeOf(t), col('#ffffff'), 0.7, -2, 0.9); circle(put, t.x, t.y, 2.8, col('#ffffff'), 1.6, 0.6, 0.5) }
}
function draw(api) {
  const { put } = api
  rect(put, -40, -22, 40, 22, col('#02050c'), 1, -3.2, 1.6)
  for (let i = 0; i < COLS; i++) for (let j = 0; j < ROWS; j++) {
    const k = i + ',' + j
    if (TD.cells.has(k)) rect(put, cx(i) - 1.7, cy(j) - 1.7, cx(i) + 1.7, cy(j) + 1.7, col(MAPS[TD.map].color), 0.18, -2.8, 0.85)
    else if ((i + j) % 2 === 0) put(cx(i), cy(j), -3, 3.9, 3.9, 0.012, 0.028, 0.055)
  }
  // base and spawn
  const ex = TD.wp[TD.wp.length - 1][0], ey = TD.wp[TD.wp.length - 1][1]
  for (let k = -2; k <= 2; k++) put(ex + 1, ey + k * 1.4, -1, 1.3, 1.3, 0.5, 2, 1)
  const sx = TD.wp[0][0], sy = TD.wp[0][1]
  for (let k = -2; k <= 2; k++) put(sx + 2.5, sy + k * 1.4, -1, 1.3, 1.3, 2, 0.5, 0.5)
  // hover / build preview
  if (TD.hover && TD.mode === 'play') {
    const [i, j] = TD.hover, k = i + ',' + j, def = TOWERS.find((x) => x.id === TD.build)
    const free = !TD.cells.has(k) && !TD.occ[k]
    if (def && free && !TD.strikeArm) { circle(put, cx(i), cy(j), def.range, col(def.color), 0.55, -2, 0.9); circle(put, cx(i), cy(j), 2.2, TD.gold >= def.cost ? col('#6aff9a') : col('#ff4a5a'), 1.8, 0.2, 0.5) }
    if (TD.strikeArm) circle(put, cx(i), cy(j), 7, col('#ff8a2a'), 1.6, 0.2, 0.7)
  }
  for (const t of TD.towers) drawTower(put, t, TD.sel === t)
  // enemies
  for (const e of TD.enemies) {
    const c = col(e.def.c), r = e.def.r, f = e.flash > 0 ? 2 : 1
    disk(put, e.x + 0.4, e.y - 0.4, r, col('#000000'), 0, -1.3, 0.5)
    if (e.def.air) { for (let s = -1; s <= 1; s += 2) for (let u = 0; u < 3; u++) put(e.x - u * 0.9, e.y + s * (0.8 + u * 0.9), 0.2, 0.8, 0.8, c[0] * f, c[1] * f, c[2] * f); disk(put, e.x, e.y, r * 0.6, c, 1.3 * f, 0.4, 0.4) }
    else if (e.def.boss) { disk(put, e.x, e.y, r, c, 0.8 * f, 0, 0.45); circle(put, e.x, e.y, r + 0.5, col('#ffe84a'), 1.4, 0.3, 0.5); put(e.x - 1, e.y + 0.6, 0.6, 0.7, 0.7, 2, 2, 2); put(e.x + 1, e.y + 0.6, 0.6, 0.7, 0.7, 2, 2, 2) }
    else disk(put, e.x, e.y, r, c, (e.slow ? 0.5 : 1) * f, 0, 0.45)
    if (e.slow) circle(put, e.x, e.y, r + 0.5, col('#9ad8ff'), 1.6, 0.4, 0.6)
    if (e.hp < e.max) { const w = Math.max(2, r * 2), f2 = e.hp / e.max; for (let u = 0; u < w * 2; u++) { const g = u / (w * 2) < f2; put(e.x - w / 2 + u * 0.5, e.y + r + 1, 0.8, 0.5, 0.5, g ? 0.3 : 0.5, g ? 1.8 : 0.1, g ? 0.4 : 0.1) } }
  }
  for (const s of TD.shots) { const c = col(s.c); disk(put, s.x, s.y, s.big ? 0.9 : 0.55, c, 2, 0.6, 0.35) }
  for (const f of TD.fx) {
    if (f.k === 'zap') { const n = Math.ceil(Math.hypot(f.x1 - f.x0, f.y1 - f.y0) / 0.9); for (let i = 0; i <= n; i++) { const u = i / n; put(f.x0 + (f.x1 - f.x0) * u + R(-0.5, 0.5), f.y0 + (f.y1 - f.y0) * u + R(-0.5, 0.5), 0.9, 0.5, 0.5, 2.2, 2, 0.6) } }
    else if (f.k === 'boom') { const u = 1 - f.l / 0.4; circle(put, f.x, f.y, f.r * Math.min(1, u * 1.4), col('#ffb04a'), 2 * (1 - u * 0.6), 0.8, 0.7) }
  }
  for (const b of TD.strikes) { const u = Math.max(0, b.t); circle(put, b.x, b.y, 1 + u * 8, col('#ff5a3a'), 1.5, 0.5, 0.6); put(b.x, b.y, 0.5, 0.9, 0.9, 2.2, 0.6, 0.4) }
  for (const q of G.parts) { const f = q.life / q.max; put(q.x, q.y, 1, q.s * (0.35 + 0.65 * f) * 0.9, q.s * (0.35 + 0.65 * f) * 0.9, q.c[0] * 1.8, q.c[1] * 1.8, q.c[2] * 1.8) }
  api.pops(G.pops, 0)
  void line
}
if (typeof window !== 'undefined') { window.__TD = TD; window.__td = tdActions }
games.td = { update, onKey, draw, stop, sky: () => '#04080f' }
