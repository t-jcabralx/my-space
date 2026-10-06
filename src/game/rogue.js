// NEON DEPTHS: a 3D roguelike dungeon crawler you can play alone or with up to 2 friends online (co-op).
// 3 classes, 3 floors of 4 rooms (the last room of every floor is a boss), a perk after every room.
// Move with WASD / arrows (or the touch stick); you attack automatically. Space = dash, Q = class special, 1-3 = pick a perk.
import { G, emit as engineEmit, keys, games, profile, saveProfile, recordScore, part, ring, shake, flash, stepParticles, toMenu } from './engine.js'
import { sfx, music, speak } from './audio.js'
import { col, clamp, R } from './pxl.js'
import { drawRogue3, rogueCamera, rogueLights, unprojectGround, THEMES } from './rogue3d.js'

export const AX = 44, AY = 23
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
export const EN = {
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

// the story of the Depths (told in cut-scenes when you play alone; shown as banners in co-op)
const TALE = {
  start: [['sys', 'BENEATH THE GRID, WHERE DELETED GAMES ROT, A FOREST GREW. THE OLD PLAYERS CALL IT THE DEPTHS.'], ['nova', 'At its heart burns the Last Lantern, the one light the OVERLORD could never erase.'], ['nova', 'Three guardians keep it from you: the SLIME KING, the BONE LORD and the VOID EYE.'], ['hero', 'Then I will take it back. Every deleted game, every lost score, all of it.'], ['nova', 'Keep your own lantern lit, hero. The woods do not like the light.']],
  f1: [['sys', 'THE CURSED MARSH. THE TREES HAVE STOPPED WHISPERING.'], ['hero', 'Quiet. That is worse than the whispering.'], ['nova', 'Things in here remember being games. They are angry about being forgotten.']],
  f2: [['sys', 'THE VOID GROVE. EVEN THE LIGHT IS AFRAID HERE.'], ['nova', 'The Lantern is close. I can feel its heat.'], ['hero', 'And something is watching us.'], ['ovl', 'I HAVE WATCHED YOU SINCE THE FIRST TREE.']],
  boss: [
    [['king', 'A little snack wandered into my kingdom! Bring it to me, my jellies!'], ['hero', 'I am not food. I am the one who is going to pop you.']],
    [['lord', 'Another bright little soul. I collect those. Come, join my court.'], ['hero', 'I have a lantern and a sharp opinion about your court.']],
    [['eye', 'THE LANTERN IS MINE. EVERY GAME IS MINE. YOU ARE A BUG.'], ['hero', 'Then I am the bug that fixes you.']],
  ],
  win: 'The Last Lantern blazes in your hands. Across the Grid, every deleted game flickers awake. The Depths bloom, and the forest finally sleeps.',
  who: { sys: ['THE DEPTHS', '#6aff9a', '🌲'], nova: ['NOVA', '#ff4de1', '🤖'], hero: ['YOU', '#3de8ff', '🧑‍🚀'], ovl: ['OVERLORD', '#ff3a3a', '👁'], king: ['SLIME KING', '#3adf6a', '👑'], lord: ['BONE LORD', '#e8e8ff', '💀'], eye: ['VOID EYE', '#ff4adf', '👁️'] },
}
function say(lines) {
  if (!lines || !lines.length) return
  if (RG.net || RG.players.length > 1) { RG.msg = { text: TALE.who[lines[0][0]][0], sub: lines[0][1].slice(0, 90), color: TALE.who[lines[0][0]][1], t: 4 }; return }
  RG.tale = { lines, i: 0 }
}
const mkPlayer = (cls, name, remote) => {
  const c = CLASSES[clamp(cls | 0, 0, 2)]
  return { cls: clamp(cls | 0, 0, 2), name, remote: !!remote, x: -AX + 6, y: 0, hp: c.hp, max: c.hp, spd: c.spd, dmg: c.dmg, rate: c.rate, multi: 1, crit: 0.05, vamp: 0, shield: 0, aegis: false, pierce: 0, magnet: 4, dashCd: 1.3, spCd: 9, dashT: 0, spT: 0, atkT: 0, inv: 0, dash: 0, dx: 1, dy: 0, face: 0, mx: 0, my: 0, walk: 0, alive: true, perks: [], choices: null, swing: null, aimPt: null, aimT: -9, dashN: 0, spN: 0, seenDash: 0, seenSp: 0, inp: { mx: 0, my: 0 }, hurtT: 0, vx: 0, vy: 0 }
}
export const RG = { mode: 'idle', paused: false, floors: 3, floor: 0, room: 0, players: [], me: 0, p: null, en: [], eb: [], pb: [], loot: [], obst: [], open: false, gold: 0, kills: 0, t: 0, emitT: 0, msg: null, over: null, stick: [0, 0], fx: [], spawnQ: [], net: null, eid: 1, tale: null, rk: 0, bossT: 0, ambT: 4, heartT: 0, cam: null, doorT: 0 }
let snap = null
const subs = new Set()
export const subscribeRogue = (f) => { subs.add(f); return () => subs.delete(f) }
export const getRogueSnap = () => snap
const lp = () => RG.players[RG.me] || RG.players[0]
const alive = () => RG.players.filter((p) => p.alive)
function emitR() {
  const p = lp()
  const bossE = RG.en.find((e) => e.def && e.def.boss && !e.dead)
  snap = {
    mode: RG.mode, paused: RG.paused, cls: p ? p.cls : 0, floor: RG.floor + 1, room: RG.room + 1, hp: p ? p.hp : 0, max: p ? p.max : 0, shield: p ? p.shield : 0, gold: RG.gold, kills: RG.kills,
    dash: p ? Math.max(0, p.dashT) / p.dashCd : 0, special: p ? Math.max(0, p.spT) / p.spCd : 0,
    choices: p && p.choices ? p.choices.map((c) => ({ id: c.id, name: c.name, ico: c.ico, desc: c.desc })) : null, msg: RG.msg ? { ...RG.msg } : null, over: RG.over,
    boss: bossE ? { name: bossE.def.name, hp: Math.max(0, bossE.hp) / bossE.max } : null, perks: p ? p.perks.slice() : [], open: RG.open, rooms: RG.floor * 4 + RG.room,
    coop: RG.players.length > 1 || !!RG.net, net: RG.net ? RG.net.role : null, waiting: RG.players.filter((x) => x.choices).length,
    team: RG.players.map((x, i) => ({ name: x.name, cls: x.cls, hp: x.hp, max: x.max, alive: x.alive, me: i === RG.me })), theme: THEMES[RG.floor % 3].name, dead: !!(p && !p.alive), tale: RG.tale ? { who: TALE.who[RG.tale.lines[RG.tale.i][0]], text: RG.tale.lines[RG.tale.i][1], i: RG.tale.i, n: RG.tale.lines.length } : null,
  }
  subs.forEach((f) => f())
}
function start(cfg = {}) {
  const net = RG.net && cfg.type === 'online' ? RG.net : null
  RG.net = net
  RG.floors = clamp(cfg.floors | 0 || 3, 1, 3)
  const me = mkPlayer(cfg.cls | 0, (profile.name || 'YOU').slice(0, 10), false)
  RG.players = [me]; RG.me = 0; RG.p = me
  RG.floor = 0; RG.room = 0; RG.gold = 0; RG.kills = 0; RG.over = null; RG.paused = false; RG.t = 0; RG.fx = []; RG.eid = 1; RG.rk = 0; RG.bossT = 0
  G.mode = 'rogue'; engineEmit(); G.parts = []; G.pops = []; G.shake = 0; G.flash = 0
  RG.mode = 'play'; RG.tale = null
  enterRoom()
  say(TALE.start)
  music.set('slugboss', 0); sfx('mission'); emitR()
}
function stop() { RG.mode = 'idle'; RG.paused = false; if (RG.net) { const n = RG.net; RG.net = null; if (n.onStop) try { n.onStop() } catch { /* ignore */ } } music.set('menu'); emitR() }
function enterRoom() {
  const n = RG.players.length
  RG.players.forEach((p, i) => {
    p.x = -AX + 6; p.y = (i - (n - 1) / 2) * 7; p.inv = 1; if (p.aegis) p.shield = 1
    if (!p.alive) { p.alive = true; p.hp = Math.max(1, Math.ceil(p.max / 2)) }
    p.choices = null; p.swing = null
  })
  RG.en = []; RG.eb = []; RG.pb = []; RG.loot = []; RG.open = false; RG.spawnQ = []; RG.rk++; RG.doorT = 0
  RG.obst = []
  const boss = RG.room === 3
  const k = (boss ? 2 : 3 + RG.floor + ((Math.random() * 3) | 0))
  for (let i = 0; i < k; i++) {
    const w = 4 + 2 * ((Math.random() * 2) | 0), h = 4 + 2 * ((Math.random() * 2) | 0)
    const x = R(-26, AX - 12), y = R(-AY + 6, AY - 6)
    if (boss && Math.abs(x) < 14 && Math.abs(y) < 14) continue
    if (x + w / 2 > 10 && Math.abs(y) < h / 2 + 6) continue // keep the lane to the door open
    RG.obst.push({ x, y, w, h, s: (Math.random() * 1000) | 0 })
  }
  RG.obst = RG.obst.filter((o) => !(Math.abs(o.x + AX - 6) < o.w / 2 + 8 && Math.abs(o.y) < o.h / 2 + 8 + n * 4))
  const budget = (5 + RG.floor * 3 + RG.room * 2) * (1 + 0.4 * (n - 1))
  const sc = (1 + RG.floor * 0.3) * (1 + 0.5 * (n - 1))
  const spawn = (type, x, y, delay) => RG.spawnQ.push({ type, x, y, t: delay, sc })
  if (boss) { spawn(BOSS[RG.floor], AX - 14, 0, 1.6); RG.bossT = 3.2; sfx('rgBoss'); speak(EN[BOSS[RG.floor]].name, 0.4, 0.9) }
  else {
    let b = budget, i = 0
    const pool = ['slime', 'bat', 'archer'].concat(RG.floor >= 1 ? ['brute', 'caster'] : [], RG.room >= 2 ? ['brute'] : [])
    while (b > 0) { const t = pool[(Math.random() * pool.length) | 0], cost = t === 'brute' ? 4 : t === 'caster' ? 3 : t === 'archer' ? 2 : 1.5; b -= cost; spawn(t, R(-8, AX - 6), R(-AY + 4, AY - 4), 0.8 + i * 0.35); i++ }
  }
  if (RG.room === 0 && RG.floor > 0 && RG.t > 0) say(TALE['f' + RG.floor])
  if (boss) say(TALE.boss[RG.floor])
  RG.msg = { text: boss ? 'BOSS: ' + EN[BOSS[RG.floor]].name : THEMES[RG.floor % 3].name, sub: boss ? 'SOMETHING STIRS IN THE DARK…' : 'ROOM ' + (RG.room + 1) + ' OF 4', color: boss ? '#ff4a5a' : '#ffe84a', t: 2.4 }
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
  for (const e of RG.en) { if (e.dead || e.spawnT > 0) continue; const d = Math.hypot(e.x - x, e.y - y); if (d < maxd && (!best || d < best.d)) best = { e, d } }
  return best
}
function nearestPlayer(x, y) {
  let best = null
  for (const p of RG.players) { if (!p.alive) continue; const d = Math.hypot(p.x - x, p.y - y); if (!best || d < best.d) best = { p, d } }
  return best
}
function hitEnemy(e, d, crit, kb = 0, ax = 0, ay = 0, by = null) {
  if (e.dead || e.spawnT > 0) return
  e.hp -= d; e.flash = 0.1; e.by = by || e.by
  if (kb && !e.def.boss) { e.kx = ax * kb; e.ky = ay * kb }
  if (crit) for (let i = 0; i < 4; i++) part(e.x, e.y, R(-20, 20), R(-20, 20), 0.3, col('#ffe84a'), 1)
  if (e.hp <= 0) killEnemy(e)
}
function killEnemy(e) {
  e.dead = true; RG.kills++
  const c = col(e.def.c); for (let i = 0; i < (e.def.boss ? 40 : 10); i++) part(e.x, e.y, R(-34, 34), R(-34, 34), R(0.25, 0.7), c, R(0.8, 1.7))
  sfx('rgKill'); if (e.def.boss) { shake(2); flash(0.5, [1, 1, 1]) }
  const g = e.def.gold; for (let i = 0; i < g; i++) RG.loot.push({ k: 'gold', x: e.x + R(-2, 2), y: e.y + R(-2, 2), vx: R(-12, 12), vy: R(-12, 12), v: 1 })
  if (Math.random() < 0.07 || e.def.boss) RG.loot.push({ k: 'heart', x: e.x, y: e.y, vx: 0, vy: 0, v: 1 })
  const by = e.by
  if (by && by.alive && by.vamp && Math.random() < by.vamp) { by.hp = Math.min(by.max, by.hp + 1) }
}
function hurtPlayer(p, d) {
  if (!p.alive || p.inv > 0 || p.dash > 0 || RG.mode !== 'play') return
  if (p.shield > 0) { p.shield--; p.inv = 0.6; sfx('deflect'); ring(p.x, p.y, 16, 30, [col('#6ac8ff')]); return }
  p.hp -= d; p.inv = 1.0; p.hurtT = 0.3
  if (p === lp()) { sfx('rgHurt'); shake(1); flash(0.2, [1, 0.2, 0.2]) }
  for (let i = 0; i < 10; i++) part(p.x, p.y, R(-30, 30), R(-30, 30), 0.4, col('#ff4a5a'), R(0.8, 1.4))
  if (p.hp <= 0) {
    p.hp = 0; p.alive = false; sfx('rgBoss')
    ring(p.x, p.y, 30, 40, [col('#ff4a5a')])
    RG.msg = { text: RG.players.length > 1 ? p.name + ' HAS FALLEN' : 'YOU FELL', sub: alive().length ? 'FINISH THE ROOM TO REVIVE THEM' : '', color: '#ff4a5a', t: 2 }
    if (!alive().length) finish(false)
  }
}
function finish(win) {
  RG.mode = 'over'; music.stop()
  const rooms = RG.floor * 4 + RG.room + (win ? 1 : 0)
  const score = Math.round((RG.floor * 1500 + rooms * 150 + RG.kills * 10 + RG.gold * 2 + (win ? 4000 : 0)) * 1)
  const me = lp()
  RG.over = { win, floor: RG.floor + 1, room: RG.room + 1, kills: RG.kills, gold: RG.gold, score, perks: me ? me.perks.length : 0, cls: CLASSES[me ? me.cls : 0].name, coop: RG.players.length > 1, epilogue: win ? TALE.win : '' }
  profile.rogueRuns = (profile.rogueRuns || 0) + 1
  if (win) profile.rogueWins = (profile.rogueWins || 0) + 1
  profile.rogueKills = (profile.rogueKills || 0) + RG.kills
  profile.rogueDeep = Math.max(profile.rogueDeep || 0, rooms)
  recordScore('rogue', score); saveProfile()
  sfx(win ? 'win' : 'over'); speak(win ? 'Dungeon conquered' : 'You died', 0.5, 1)
  emitR()
}
function ebullet(x, y, a, spd, dmg = 1, r = 0.9, c = '#ff8a5a') { RG.eb.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, dmg, r, c, life: 6 }) }
function playerAttack(p, dt) {
  const cl = CLASSES[p.cls]
  p.atkT -= dt
  if (p.atkT > 0) return
  const ne = nearestEnemy(p.x, p.y, cl.id === 'knight' ? 11 : 60)
  if (!ne) return
  let a = Math.atan2(ne.e.y - p.y, ne.e.x - p.x)
  if (p.aimPt && G.time - p.aimT < 2) a = Math.atan2(p.aimPt.y - p.y, p.aimPt.x - p.x)
  p.face = a; p.atkT = p.rate
  const crit = Math.random() < p.crit, d = p.dmg * (crit ? 2.2 : 1)
  if (cl.id === 'knight') {
    const arc = 1.3 + (p.multi - 1) * 0.45, reach = 8 + (p.multi - 1) * 0.8
    p.swing = { a, arc, reach, t: 0.2, max: 0.2 }
    for (const e of RG.en) {
      if (e.dead) continue
      const dx = e.x - p.x, dy = e.y - p.y, dist = Math.hypot(dx, dy)
      if (dist > reach + e.def.r) continue
      let da = Math.atan2(dy, dx) - a; da = Math.atan2(Math.sin(da), Math.cos(da))
      if (Math.abs(da) <= arc / 2) hitEnemy(e, d, crit, 40 + p.pierce * 25, dx / (dist || 1), dy / (dist || 1), p)
    }
    for (const b of RG.eb) { if (Math.hypot(b.x - p.x, b.y - p.y) < reach) b.life = 0 }
    sfx('rgSwing')
  } else {
    const n = p.multi, spread = 0.2
    for (let i = 0; i < n; i++) {
      const aa = a + (i - (n - 1) / 2) * spread
      RG.pb.push({ x: p.x + Math.cos(aa) * 2, y: p.y + Math.sin(aa) * 2, vx: Math.cos(aa) * (cl.id === 'ranger' ? 95 : 55), vy: Math.sin(aa) * (cl.id === 'ranger' ? 95 : 55), dmg: d, crit, pierce: cl.id === 'ranger' ? 1 + p.pierce : p.pierce, homing: cl.id === 'mage', life: 1.4, c: cl.color, hit: new Set(), big: cl.id === 'mage', by: p })
    }
    sfx(cl.id === 'ranger' ? 'rgShot' : 'rgMagic')
  }
}
function special(p) {
  const cl = CLASSES[p.cls]
  if (RG.mode !== 'play' || p.spT > 0 || !p.alive) return
  p.spT = p.spCd
  if (cl.id === 'knight') { RG.fx.push({ k: 'whirl', l: 0.5, p }); for (const e of RG.en) if (!e.dead && Math.hypot(e.x - p.x, e.y - p.y) < 13) hitEnemy(e, p.dmg * 3, false, 90, (e.x - p.x) / 5, (e.y - p.y) / 5, p); p.inv = Math.max(p.inv, 0.5); shake(0.8); sfx('rgBoss') }
  else if (cl.id === 'ranger') { for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; RG.pb.push({ x: p.x, y: p.y, vx: Math.cos(a) * 85, vy: Math.sin(a) * 85, dmg: p.dmg * 1.6, pierce: 3, life: 1.2, c: cl.color, hit: new Set(), by: p }) } sfx('rgShot') }
  else { RG.fx.push({ k: 'nova', l: 0.6, p }); for (const e of RG.en) if (!e.dead && Math.hypot(e.x - p.x, e.y - p.y) < 20) { hitEnemy(e, p.dmg * 2, false, 0, 0, 0, p); e.frozen = 2.5 } RG.eb = RG.eb.filter((b) => Math.hypot(b.x - p.x, b.y - p.y) > 20); shake(0.6); sfx('tdIce') }
  ring(p.x, p.y, 30, 50, [col(cl.color)])
}
function dash(p) {
  if (RG.mode !== 'play' || p.dashT > 0 || !p.alive) return
  let dx = p.mx || 0, dy = p.my || 0
  if (!dx && !dy) { dx = Math.cos(p.face); dy = Math.sin(p.face) }
  const l = Math.hypot(dx, dy) || 1
  p.dx = dx / l; p.dy = dy / l; p.dash = 0.18; p.dashT = p.dashCd; p.inv = Math.max(p.inv, 0.3)
  sfx('rgDash')
}
function enemyAI(e, dt) {
  const np = nearestPlayer(e.x, e.y)
  if (!np) return
  const p = np.p, d = e.def, dx = p.x - e.x, dy = p.y - e.y, dist = Math.hypot(dx, dy) || 1
  e.fa = Math.atan2(dy, dx)
  const slow = e.frozen > 0 ? 0.25 : 1
  e.t += dt; e.frozen = Math.max(0, (e.frozen || 0) - dt)
  let vx = 0, vy = 0
  if (d.boss) return boss(e, dt, dx, dy, dist, slow, p)
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
      e.cast = 0.3; sfx('tdShot')
    }
    e.cast = Math.max(0, (e.cast || 0) - dt)
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
  for (const q of RG.players) if (q.alive && Math.hypot(q.x - e.x, q.y - e.y) < d.r + 1.3) hurtPlayer(q, d.dmg)
}
function boss(e, dt, dx, dy, dist, slow, tp) {
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
  void tp
  for (const q of RG.players) if (q.alive && Math.hypot(q.x - e.x, q.y - e.y) < d.r + 1.3) hurtPlayer(q, d.dmg)
}
// ---------- main loop (solo + host) ----------
function update(dtRaw) {
  const dt = Math.min(dtRaw, 0.04)
  if (RG.mode === 'idle' || RG.paused) return
  if (RG.mode === 'over') { stepParticles(dt); return }
  RG.t += dt
  if (RG.msg) { RG.msg.t -= dt; if (RG.msg.t <= 0) RG.msg = null }
  if (RG.tale) { stepParticles(dt); RG.emitT -= dt; if (RG.emitT <= 0) { RG.emitT = 0.1; emitR() } return }
  ambience(dt)
  if (RG.net && RG.net.role === 'guest') return guestStep(dt)
  RG.bossT = Math.max(0, RG.bossT - dt)
  const me = lp()
  // local input
  if (me && me.alive) {
    let mx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + RG.stick[0]
    let my = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) + RG.stick[1]
    const ml = Math.hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml }
    me.inp.mx = mx; me.inp.my = my
    if (keys.KeyQ || keys.KeyK) special(me)
  }
  for (const p of RG.players) {
    p.inv = Math.max(0, p.inv - dt); p.dashT = Math.max(0, p.dashT - dt); p.spT = Math.max(0, p.spT - dt); p.hurtT = Math.max(0, p.hurtT - dt)
    if (p.swing) { p.swing.t -= dt; if (p.swing.t <= 0) p.swing = null }
    if (!p.alive) continue
    if (p.remote) { if (p.dashN !== p.seenDash) { p.seenDash = p.dashN; dash(p) } if (p.spN !== p.seenSp) { p.seenSp = p.spN; special(p) } }
    const mx = p.inp.mx, my = p.inp.my
    p.mx = mx; p.my = my
    const ox = p.x, oy = p.y
    if (p.dash > 0) { p.dash -= dt; move(p, p.dx * 95 * dt, p.dy * 95 * dt, 1.4); part(p.x, p.y, 0, 0, 0.25, col(CLASSES[p.cls].color), 1.2) }
    else { move(p, mx * p.spd * dt, my * p.spd * dt, 1.4); if (mx || my) p.face = Math.atan2(my, mx) }
    p.walk += Math.hypot(p.x - ox, p.y - oy) * 0.5
    playerAttack(p, dt)
  }
  // spawn queue
  const n = RG.players.length
  for (const s of RG.spawnQ) s.t -= dt
  for (const s of RG.spawnQ) if (s.t <= 0 && !s.done) {
    s.done = true
    const def = { ...EN[s.type], id: s.type }
    const hp = def.hp * s.sc
    RG.en.push({ id: RG.eid++, type: s.type, def, x: s.x, y: s.y, hp, max: hp, t: 0, seed: R(0, 6), dir: Math.random() < 0.5 ? -1 : 1, shoot: R(0.8, 1.8), tp: R(1, 3), cd: 2, wind: 0, charge: 0, rest: 0, sp: 0, sum: 4, spawnT: 0.5, flash: 0, fa: Math.PI, cast: 0 })
    ring(s.x, s.y, 8, 16, [col(def.c)])
  }
  RG.spawnQ = RG.spawnQ.filter((s) => !s.done)
  for (const e of RG.en) {
    if (e.dead) continue
    e.flash = Math.max(0, e.flash - dt)
    if (e.spawnT > 0) { e.spawnT -= dt; continue }
    enemyAI(e, dt)
  }
  RG.en = RG.en.filter((e) => !e.dead)
  for (const b of RG.pb) {
    b.life -= dt
    if (b.homing) { const t = nearestEnemy(b.x, b.y, 40); if (t) { const a = Math.atan2(t.e.y - b.y, t.e.x - b.x), sp = Math.hypot(b.vx, b.vy), ca = Math.atan2(b.vy, b.vx); let da = a - ca; da = Math.atan2(Math.sin(da), Math.cos(da)); const na = ca + clamp(da, -4 * dt, 4 * dt); b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp } }
    b.x += b.vx * dt; b.y += b.vy * dt
    if (!walkable(b.x, b.y, 0.1)) { b.life = 0; continue }
    for (const e of RG.en) {
      if (e.dead || e.spawnT > 0 || b.hit.has(e)) continue
      if (Math.hypot(e.x - b.x, e.y - b.y) < e.def.r + 0.8) { b.hit.add(e); hitEnemy(e, b.dmg, b.crit, b.big ? 15 : 0, Math.sign(b.vx), Math.sign(b.vy), b.by); if (b.hit.size > b.pierce) { b.life = 0; break } }
    }
  }
  RG.pb = RG.pb.filter((b) => b.life > 0)
  for (const b of RG.eb) {
    b.life -= dt; b.x += b.vx * dt; b.y += b.vy * dt
    if (Math.abs(b.x) > AX || Math.abs(b.y) > AY) { b.life = 0; continue }
    let hit = false
    for (const q of RG.players) if (q.alive && Math.hypot(b.x - q.x, b.y - q.y) < b.r + 1.0) { b.life = 0; hurtPlayer(q, b.dmg); hit = true; break }
    if (!hit) for (const o of RG.obst) if (Math.abs(b.x - o.x) < o.w / 2 && Math.abs(b.y - o.y) < o.h / 2) { b.life = 0; break }
  }
  RG.eb = RG.eb.filter((b) => b.life > 0)
  for (const l of RG.loot) {
    l.x += l.vx * dt; l.y += l.vy * dt; l.vx *= 0.9; l.vy *= 0.9
    const np = nearestPlayer(l.x, l.y)
    if (!np) continue
    const p = np.p, d = np.d
    if (d < p.magnet && l.k === 'gold') { l.x += ((p.x - l.x) / d) * 50 * dt; l.y += ((p.y - l.y) / d) * 50 * dt }
    if (d < 2.4) { l.got = true; if (l.k === 'gold') { RG.gold++; if (p === lp()) sfx('coin') } else { p.hp = Math.min(p.max, p.hp + 1); if (p === lp()) sfx('rgPerk') } }
  }
  RG.loot = RG.loot.filter((l) => !l.got)
  for (const f of RG.fx) f.l -= dt
  RG.fx = RG.fx.filter((f) => f.l > 0)
  // room clear
  if (!RG.open && !RG.en.length && !RG.spawnQ.length) {
    RG.open = true
    for (const l of RG.loot) l.vx = l.vy = 0
    RG.msg = { text: 'ROOM CLEARED', sub: RG.room === 3 ? 'FLOOR CLEARED' : 'GO RIGHT ▶', color: '#6aff9a', t: 1.6 }
    sfx('rgDoor'); sfx('ding', 5)
    if (RG.room === 3 && RG.floor === RG.floors - 1) return finish(true)
    offerPerks()
  }
  if (RG.open && RG.players.every((p) => !p.choices) && RG.players.some((p) => p.alive && p.x > AX - 3 && Math.abs(p.y) < 7)) {
    if (RG.room === 3) { RG.floor++; RG.room = 0; for (const p of RG.players) if (p.alive) p.hp = Math.min(p.max, p.hp + 2) } else RG.room++
    enterRoom()
  }
  stepParticles(dt)
  if (RG.net && RG.net.role === 'host') netTick(dt)
  RG.emitT -= dt
  if (RG.emitT <= 0) { RG.emitT = 0.1; emitR() }
}
// suspense: distant sounds and a heartbeat when you are nearly dead
function ambience(dt) {
  RG.ambT -= dt
  if (RG.ambT <= 0) { RG.ambT = R(5, 11); sfx(['rgWind', 'rgOwl', 'rgCreak', 'rgWind'][(Math.random() * 4) | 0]) }
  const p = lp()
  if (p && p.alive && p.hp / p.max <= 0.34 && RG.mode === 'play') { RG.heartT -= dt; if (RG.heartT <= 0) { RG.heartT = 0.85; sfx('rgHeart') } }
}
function offerPerks() {
  for (const p of RG.players) {
    const pool = PERKS.filter((x) => !(x.id === 'shield' && p.aegis)).sort(() => Math.random() - 0.5)
    p.choices = pool.slice(0, 3)
  }
  sfx('rgPerk'); emitR()
}
function pickPerk(pi, i) {
  const p = RG.players[pi]
  if (!p || !p.choices || !p.choices[i]) return
  const c = p.choices[i]; c.f(p); p.perks.push(c.ico)
  p.choices = null
  if (pi === RG.me) { sfx('rgPerk'); RG.msg = { text: c.name, sub: c.desc, color: '#ffe84a', t: 1.6 }; ring(p.x, p.y, 24, 40, [col('#ffe84a')]) }
  emitR()
}
function onKey(code) {
  if (RG.mode === 'idle') return
  const me = lp()
  if (RG.tale) { if (code === 'Enter' || code === 'Space') rogueActions.nextTale(); else if (code === 'Escape') { RG.tale = null; emitR() } return }
  if (code === 'Escape' || code === 'KeyP') { if (RG.mode === 'play' && !RG.net) { RG.paused = !RG.paused; emitR() } else if (RG.paused) { RG.paused = false; emitR() } return }
  if (RG.paused) return
  if (me && me.choices) { const n = ['Digit1', 'Digit2', 'Digit3'].indexOf(code); if (n >= 0) rogueActions.pick(n); return }
  if (RG.mode === 'over') { if (code === 'Enter') rogueActions.rematch(); return }
  if (code === 'Space' || code === 'ShiftLeft' || code === 'ShiftRight') rogueActions.dash()
  else if (code === 'KeyQ' || code === 'KeyK') rogueActions.special()
}
export const rogueActions = {
  start, stop, quit() { toMenu() },
  resume() { RG.paused = false; emitR() },
  pause() { if (RG.mode === 'play' && !RG.paused && !RG.net) { RG.paused = true; emitR(); return true } return false },
  rematch() { if (RG.net) { RG.net.rematch(); return } start({ cls: lp() ? lp().cls : 0, floors: RG.floors }) },
  pick(i) {
    if (RG.net && RG.net.role === 'guest') { RG.net.perk(i); const p = lp(); if (p) { p.choices = null; emitR() } return }
    pickPerk(RG.me, i)
  },
  dash() { const p = lp(); if (!p) return; if (RG.net && RG.net.role === 'guest') { p.dashN++; return } dash(p) },
  special() { const p = lp(); if (!p) return; if (RG.net && RG.net.role === 'guest') { p.spN++; return } special(p) },
  nextTale() { const t = RG.tale; if (!t) return; sfx('wdKey'); if (t.i < t.lines.length - 1) t.i++; else RG.tale = null; emitR() },
  skipTale() { RG.tale = null; emitR() },
  stick(x, y) { RG.stick = [x, y] },
  // pointer position in arena units (the stage is 100 x 56): unprojected onto the ground to aim
  aim(x, y) { const p = lp(); if (!p || !RG.cam) return; const g = unprojectGround(RG.cam, x / 50, y / 28); if (g) { p.aimPt = g; p.aimT = G.time } },
}

// ---------- online co-op (host simulates; guests send input and mirror the state) ----------
const r1 = (v) => Math.round(v * 10) / 10
let nT = 0, nSeq = 0, lastN = -1, inT = 0
export const rogueNet = {
  attach(net) { RG.net = net },
  active: () => !!RG.net && RG.mode !== 'idle',
  reset() { nSeq = 0; lastN = -1; nT = 0; inT = 0 },
  // host: a friend's input arrives (the first message creates their hero)
  applyInput(pid, m) {
    if (!RG.net || RG.net.role !== 'host' || !m) return
    let p = RG.players.find((x) => x.pid === pid)
    if (!p) {
      if (RG.players.length >= 3) return
      p = mkPlayer(m.cls, String(m.name || 'FRIEND').slice(0, 10), true); p.pid = pid
      p.x = -AX + 6; p.y = RG.players.length * 7 - 7
      RG.players.push(p); RG.msg = { text: p.name + ' JOINED', sub: '', color: '#6aff9a', t: 1.6 }
      if (RG.open) p.choices = null
    }
    p.inp.mx = clamp(+m.mx || 0, -1, 1); p.inp.my = clamp(+m.my || 0, -1, 1)
    if (typeof m.dn === 'number') p.dashN = m.dn
    if (typeof m.sn === 'number') p.spN = m.sn
    if (m.ax !== undefined) { p.aimPt = { x: +m.ax, y: +m.ay }; p.aimT = G.time } else p.aimPt = null
    p.guestPos = m.x !== undefined ? [m.x, m.y] : null
    if (p.guestPos && p.alive && !p.dash && Math.hypot(p.guestPos[0] - p.x, p.guestPos[1] - p.y) < 4 && walkable(p.guestPos[0], p.guestPos[1], 1.4)) { p.x += (p.guestPos[0] - p.x) * 0.5; p.y += (p.guestPos[1] - p.y) * 0.5 }
  },
  applyPerk(pid, i) { const k = RG.players.findIndex((x) => x.pid === pid); if (k >= 0) pickPerk(k, i) },
  playerLeft(pid) {
    const k = RG.players.findIndex((x) => x.pid === pid)
    if (k <= 0) return
    const p = RG.players[k]; RG.players.splice(k, 1)
    RG.msg = { text: p.name + ' LEFT', sub: '', color: '#ff8a96', t: 1.6 }
    if (!alive().length && RG.mode === 'play') finish(false)
    emitR()
  },
  hostLeft() { if (RG.net && RG.mode === 'play') { RG.msg = { text: 'HOST LEFT', sub: '', color: '#ff8a96', t: 2 }; RG.mode = 'over'; RG.over = { win: false, floor: RG.floor + 1, room: RG.room + 1, kills: RG.kills, gold: RG.gold, score: 0, perks: 0, cls: '', coop: true, left: true }; music.stop(); emitR() } },
  applyState(s) {
    if (!RG.net || RG.net.role !== 'guest' || !s || s.n <= lastN) return
    lastN = s.n
    const first = RG.mode === 'idle' || !RG.players.length
    if (s.rk !== RG.rk) { // a new room
      RG.rk = s.rk; RG.obst = s.ob.map((o) => ({ x: o[0], y: o[1], w: o[2], h: o[3], s: o[4] })); RG.floor = s.fl; RG.room = s.ro
      RG.eb = []; RG.pb = []; RG.loot = []; if (!first) sfx('rgDoor')
      for (const p of RG.players) { p.choices = null }
    }
    RG.floors = s.fs
    // players
    while (RG.players.length < s.pl.length) RG.players.push(mkPlayer(0, '', true))
    RG.players.length = s.pl.length
    s.pl.forEach((q, i) => {
      const p = RG.players[i]
      const mineNow = i === s.me
      if (mineNow) RG.me = i
      if (mineNow && p.alive && Math.hypot(q[0] - p.x, q[1] - p.y) < 8 && p.hasState) { p.x += (q[0] - p.x) * 0.2; p.y += (q[1] - p.y) * 0.2 } else { p.tx = q[0]; p.ty = q[1]; if (!p.hasState || mineNow) { p.x = q[0]; p.y = q[1] } }
      if (!mineNow) { p.tx = q[0]; p.ty = q[1] }
      if (mineNow && q[2] < p.hp) { sfx('rgHurt'); shake(1); flash(0.2, [1, 0.2, 0.2]); p.hurtT = 0.3 }
      p.hp = q[2]; p.max = q[3]; p.face = q[4]; p.cls = q[5]; p.inv = q[6]; p.dash = q[7]; p.alive = !!q[9]; p.shield = q[10]; p.name = q[11]; p.dashT = q[12]; p.spT = q[13]; p.dashCd = q[14]; p.spCd = q[15]
      p.swing = q[16] ? { a: q[16][0], arc: q[16][1], reach: q[16][2], t: q[16][3], max: 0.2 } : null
      p.mx = q[17]; p.my = q[18]
      if (!mineNow) { p.walk += 0.5 * Math.hypot(q[17], q[18]) * 0.05 }
      p.hasState = true
    })
    // enemies (match by id, lerp positions)
    const old = new Map(RG.en.map((e) => [e.id, e]))
    const next = []
    for (const q of s.en) {
      let e = old.get(q[0])
      const def = { ...EN[q[1]], id: q[1] }
      if (!e) e = { id: q[0], type: q[1], def, x: q[2], y: q[3], t: 0, seed: q[0] % 7, hp: 1, max: 1, spawnT: 0, flash: 0 }
      e.tx = q[2]; e.ty = q[3]; e.hp = q[4] * 1000; e.max = 1000; e.fa = q[5]; e.frozen = q[6]; e.spawnT = q[7]; e.wind = q[8]; e.charge = q[9]; e.cast = q[10]; e.flash = q[11]
      next.push(e); old.delete(q[0])
    }
    for (const e of old.values()) { // gone: it died
      const c = col(e.def.c); for (let i = 0; i < (e.def.boss ? 30 : 8); i++) part(e.x, e.y, R(-34, 34), R(-34, 34), R(0.25, 0.7), c, R(0.8, 1.7)); sfx('rgKill')
    }
    RG.en = next
    RG.pb = s.pb.map((b) => ({ x: b[0], y: b[1], vx: b[2], vy: b[3], big: !!b[4], c: b[5] }))
    RG.eb = s.eb.map((b) => ({ x: b[0], y: b[1], vx: b[2], vy: b[3], r: b[4], c: b[5] }))
    RG.loot = s.lt.map((l) => ({ k: l[0] ? 'heart' : 'gold', x: l[1], y: l[2] }))
    RG.fx = (s.fx || []).map((f) => ({ k: f[0], l: f[1], p: RG.players[f[2]] }))
    RG.spawnQ = (s.sq || []).map((q) => ({ type: q[0], x: q[1], y: q[2], t: q[3] }))
    const wasOpen = RG.open
    RG.open = !!s.op; if (RG.open && !wasOpen) { sfx('rgDoor'); sfx('ding', 5) }
    RG.gold = s.gold; RG.kills = s.kills; RG.bossT = s.bt
    const me = lp()
    if (me) { if (s.ch && !me.choices) { const pool = PERKS.filter((x) => s.ch.includes(x.id)); me.choices = s.ch.map((id) => pool.find((x) => x.id === id)).filter(Boolean); sfx('rgPerk') } else if (!s.ch) me.choices = null; me.perks = s.pk }
    if (s.msg && (!RG.msg || RG.msg.text !== s.msg.text)) RG.msg = s.msg
    if (s.over && !RG.over) {
      RG.mode = 'over'; RG.over = s.over; music.stop()
      profile.rogueRuns = (profile.rogueRuns || 0) + 1; if (s.over.win) profile.rogueWins = (profile.rogueWins || 0) + 1
      profile.rogueDeep = Math.max(profile.rogueDeep || 0, RG.floor * 4 + RG.room + 1)
      recordScore('rogue', s.over.score); saveProfile(); sfx(s.over.win ? 'win' : 'over')
    }
    if (first) { RG.mode = 'play'; G.mode = 'rogue'; engineEmit() }
    emitR()
  },
}
function netTick(dt) {
  nT -= dt
  if (nT > 0) return
  nT = RG.net.fast && RG.net.fast() ? 0.05 : 0.1
  const mk = (i) => RG.players.map((p, k) => [r1(p.x), r1(p.y), p.hp, p.max, Math.round(p.face * 100) / 100, p.cls, p.inv > 0 ? 1 : 0, p.dash > 0 ? 1 : 0, 0, p.alive ? 1 : 0, p.shield, p.name, Math.max(0, p.dashT), Math.max(0, p.spT), p.dashCd, p.spCd, p.swing ? [Math.round(p.swing.a * 100) / 100, p.swing.arc, p.swing.reach, p.swing.t] : 0, r1(p.mx), r1(p.my)])
  void mk
  const common = {
    n: ++nSeq, rk: RG.rk, fl: RG.floor, ro: RG.room, fs: RG.floors, ob: RG.obst.map((o) => [r1(o.x), r1(o.y), o.w, o.h, o.s]),
    pl: RG.players.map((p) => [r1(p.x), r1(p.y), p.hp, p.max, Math.round(p.face * 100) / 100, p.cls, p.inv > 0 ? 1 : 0, p.dash > 0 ? 1 : 0, 0, p.alive ? 1 : 0, p.shield, p.name, Math.max(0, p.dashT), Math.max(0, p.spT), p.dashCd, p.spCd, p.swing ? [Math.round(p.swing.a * 100) / 100, p.swing.arc, p.swing.reach, p.swing.t] : 0, r1(p.mx), r1(p.my)]),
    en: RG.en.map((e) => [e.id, e.type, r1(e.x), r1(e.y), Math.round((Math.max(0, e.hp) / e.max) * 1000) / 1000, Math.round((e.fa || 0) * 100) / 100, e.frozen > 0 ? 1 : 0, e.spawnT > 0 ? Math.round(e.spawnT * 100) / 100 : 0, e.wind > 0 ? 1 : 0, e.charge > 0 ? 1 : 0, e.cast > 0 ? 1 : 0, e.flash > 0 ? 1 : 0]),
    pb: RG.pb.map((b) => [r1(b.x), r1(b.y), r1(b.vx), r1(b.vy), b.big ? 1 : 0, b.c]),
    eb: RG.eb.map((b) => [r1(b.x), r1(b.y), r1(b.vx), r1(b.vy), b.r, b.c]),
    lt: RG.loot.map((l) => [l.k === 'heart' ? 1 : 0, r1(l.x), r1(l.y)]),
    fx: RG.fx.map((f) => [f.k, Math.round(f.l * 100) / 100, RG.players.indexOf(f.p)]),
    sq: RG.spawnQ.map((q) => [q.type, r1(q.x), r1(q.y), Math.round(q.t * 100) / 100]),
    op: RG.open ? 1 : 0, gold: RG.gold, kills: RG.kills, bt: RG.bossT, msg: RG.msg, over: RG.over,
  }
  // each friend gets their own perk choices and their own index
  RG.players.forEach((p, i) => {
    if (!p.remote) return
    RG.net.state(p.pid, { ...common, me: i, ch: p.choices ? p.choices.map((c) => c.id) : 0, pk: p.perks })
  })
}
function guestStep(dt) {
  const p = lp()
  const k = 1 - Math.exp(-16 * dt)
  if (p && p.alive) {
    const mx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + RG.stick[0]
    const my = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) + RG.stick[1]
    const ml = Math.hypot(mx, my), nx = ml > 1 ? mx / ml : mx, ny = ml > 1 ? my / ml : my
    p.mx = nx; p.my = ny
    const ox = p.x, oy = p.y
    move(p, nx * p.spd * dt, ny * p.spd * dt, 1.4)
    if (nx || ny) p.face = Math.atan2(ny, nx)
    p.walk += Math.hypot(p.x - ox, p.y - oy) * 0.5
    if (keys.KeyQ || keys.KeyK) { if (!RG.spLatch) { p.spN++; RG.spLatch = true } } else RG.spLatch = false
  }
  p.dashT = Math.max(0, p.dashT - dt); p.spT = Math.max(0, p.spT - dt); p.hurtT = Math.max(0, p.hurtT - dt)
  for (const q of RG.players) { if (q !== p && q.tx !== undefined) { const ox = q.x, oy = q.y; q.x += (q.tx - q.x) * k; q.y += (q.ty - q.y) * k; q.walk += Math.hypot(q.x - ox, q.y - oy) * 0.5 } if (q.swing) q.swing.t -= dt }
  for (const e of RG.en) { e.t += dt; if (e.tx !== undefined) { e.x += (e.tx - e.x) * k; e.y += (e.ty - e.y) * k } }
  for (const b of RG.pb) { b.x += b.vx * dt; b.y += b.vy * dt }
  for (const b of RG.eb) { b.x += b.vx * dt; b.y += b.vy * dt }
  for (const f of RG.fx) f.l -= dt
  stepParticles(dt)
  inT -= dt
  if (inT <= 0 && RG.net) {
    inT = RG.net.fast && RG.net.fast() ? 0.05 : 0.1
    const aim = p && p.aimPt && G.time - p.aimT < 2 ? p.aimPt : null
    RG.net.input({ mx: r1(p ? p.mx : 0), my: r1(p ? p.my : 0), dn: p ? p.dashN : 0, sn: p ? p.spN : 0, cls: RG.myCls | 0, name: profile.name || 'FRIEND', ax: aim ? r1(aim.x) : undefined, ay: aim ? r1(aim.y) : undefined, x: p ? r1(p.x) : undefined, y: p ? r1(p.y) : undefined })
  }
  RG.emitT -= dt
  if (RG.emitT <= 0) { RG.emitT = 0.1; emitR() }
}
// the guest joins the host's game as a fresh hero of the chosen class (the host creates it when the first input arrives)
export function joinAsGuest(cls) {
  RG.myCls = cls | 0
  RG.players = [mkPlayer(cls, 'YOU', false)]; RG.me = 0; RG.p = RG.players[0]
  RG.floor = 0; RG.room = 0; RG.gold = 0; RG.kills = 0; RG.over = null; RG.paused = false; RG.t = 0; RG.fx = []; RG.rk = -1; RG.en = []; RG.eb = []; RG.pb = []; RG.loot = []; RG.obst = []; RG.open = false
  G.mode = 'rogue'; engineEmit(); G.parts = []; G.pops = []
  RG.mode = 'play'; music.set('slugboss', 0); sfx('mission'); emitR()
}
if (typeof window !== 'undefined') { window.__RG = RG; window.__rogue = rogueActions }
games.rogue = {
  update, onKey, draw() {}, stop, sky: () => THEMES[RG.floor % 3].sky,
  draw3: (api) => { RG.cam = rogueCamera(RG, 100 / 56, 0, true); drawRogue3(api, RG, CLASSES) },
  camera: (aspect, dt) => { const c = rogueCamera(RG, aspect, dt); RG.cam = c; return c },
  lights: () => rogueLights(RG),
  fog: () => THEMES[RG.floor % 3],
}
