// Online co-op for Space Impact: the host runs the normal game, friends fly the teammate ships (up to 3 spacecraft).
// Guests send their controls and mirror the host's world. Messages travel over the direct WebRTC link when it is
// open (see rt.js) and fall back to the Redis pub/sub relay at a lower rate.
import { G, keys, profile, netStartHost, netStartGuest, toMenu, part, boom, COLS, stepParticles, shake, flash, emit } from '../engine.js'
import { sfx } from '../audio.js'
import { SP, BULLET_SPR } from '../sprites.js'
import { RT, send, onMsg, isHost, alive, roomAction, leaveRoom } from './rt.js'

const HW = 50
// every sprite both sides know about, in a stable order (so a number identifies a sprite)
const SPR_LIST = [...Object.values(SP), ...BULLET_SPR.flatMap((b) => [b.pb, b.pbS])]
const SPR_IDX = new Map(SPR_LIST.map((s, i) => [s, i]))
const IDS = new WeakMap()
let nextId = 1
const oid = (o) => { let v = IDS.get(o); if (!v) { v = nextId++; IDS.set(o, v) } return v }
const r2 = (v) => Math.round(v * 100) / 100
const FIELDS = {
  en: ['x', 'y', 'flash', 'type', 't', 'hp', 'maxhp', 'hw', 'hh', 'k'],
  eb: ['x', 'y', 'vx', 'vy', 'kind', 'hw', 'hh', 't'],
  pb: ['x', 'y', 'vx', 'vy', 'k', 'hw', 'hh'],
  pu: ['x', 'y', 'vx', 'vy', 'type', 't', 'hw', 'hh'],
  bm: ['x', 'y', 'h', 't', 'warn', 'life'],
}
function ser(o, fields) {
  const r = { _i: oid(o) }
  if (o.spr) { const ix = SPR_IDX.get(o.spr); if (ix !== undefined) r.spr = ix }
  for (const k of fields) { const v = o[k]; const t = typeof v; if (t === 'number') r[k] = r2(v); else if (t === 'string' || t === 'boolean') r[k] = v }
  return r
}
function serBoss(b) {
  const r = { _i: 1 }
  if (b.spr) { const ix = SPR_IDX.get(b.spr); if (ix !== undefined) r.spr = ix }
  for (const k in b) { const v = b[k]; const t = typeof v; if (t === 'number') r[k] = r2(v); else if (t === 'string' || t === 'boolean') r[k] = v }
  return r
}
const ship = (m) => ({ x: r2(m.x), y: r2(m.y), hp: m.hp, mh: m.maxHp, al: m.alive ? 1 : 0, inv: r2(m.inv), md: m.model, pt: m.paint, rs: m.respawn > 0 ? Math.ceil(m.respawn) : 0, rc: m.remote || null, hu: m.human ? 1 : 0 })

let installed = false
let seq = 0, lastSeq = -1, snapT = 0, inT = 0
let guests = [] // host: [{cid,name,idx}]

// ---------------- host ----------------
function hostSnapshot() {
  const p = G.p
  const out = { n: ++seq, hm: G.mode, mi: G.mission, sc: G.score, cr: G.credits, lv: G.lives, cb: G.combo, ct: r2(G.comboT || 0), mt: Math.round(G.meter || 0), sl: r2(G.scroll || 1), ex: r2(G.exitT || 0), wp: !!G.warped, ig: r2(G.golden || 0) }
  if (G.mode !== 'playing') return out
  out.bn = G.banner ? { title: G.banner.title, sub: G.banner.sub, sub2: G.banner.sub2, kind: G.banner.kind, t: r2(G.banner.t) } : null
  out.ts = G.toasts.map((t) => ({ id: t.id, text: t.text, color: t.color, t: r2(t.t) }))
  out.bo = G.bonus ? { t: r2(G.bonus.t), len: G.bonus.len, done: !!G.bonus.done } : null
  out.lz = G.lz ? { t: r2(G.lz.t), dur: r2(G.lz.dur), h: r2(G.lz.h) } : null
  if (p) out.p = { x: r2(p.x), y: r2(p.y), hp: p.hp, mh: p.maxHp, al: p.alive ? 1 : 0, inv: r2(p.inv), sk: r2(p.skT), sh: r2(p.shieldT), od: r2(p.od), md: profile.ship.model, pt: profile.ship.paint, dr: p.dr.map((d) => [r2(d.x), r2(d.y)]) }
  out.sq = (G.squad || []).map(ship)
  out.en = G.enemies.filter((e) => !e.dead).map((e) => ser(e, FIELDS.en))
  out.bs = G.boss ? serBoss(G.boss) : null
  out.pb = G.pbul.filter((b) => !b.dead).slice(0, 140).map((b) => ser(b, FIELDS.pb))
  out.eb = G.ebul.filter((b) => !b.dead).slice(0, 160).map((b) => ser(b, FIELDS.eb))
  out.pu = G.pups.filter((b) => !b.dead).map((b) => ser(b, FIELDS.pu))
  out.bm = G.beams.filter((b) => !b.dead).map((b) => ser(b, FIELDS.bm))
  return out
}
function hostTick(dt) {
  snapT -= dt
  if (snapT > 0) return
  const direct = guests.length > 0 && guests.every((g) => RT.p2p && RT.p2p[g.cid])
  snapT = direct ? 0.05 : 0.14
  send('sst', hostSnapshot()).catch(() => {})
}
export async function hostSpace() {
  const room = RT.room
  if (!room || !isHost()) throw new Error('Only the host can start')
  const others = room.players.filter((p) => p.id !== RT.cid)
  guests = others.slice(0, 2).map((p, i) => ({ cid: p.id, name: p.name, idx: i }))
  if (room.status !== 'playing') await roomAction('start', {})
  seq = 0; snapT = 0
  const remotes = guests.map((g) => g.cid)
  const net = {
    role: 'host', remotes,
    onEnd: () => { send('send', {}).catch(() => {}); if (isHost()) roomAction('finish').catch(() => {}); guests = [] },
  }
  send('sstart', { guests: guests.map((g) => ({ cid: g.cid, name: g.name, idx: g.idx })), host: profile.name || 'HOST' }).catch(() => {})
  netStartHost(net)
  hookHostLoop()
}
let hostLoop = null
function hookHostLoop() {
  if (hostLoop) return
  let last = performance.now()
  hostLoop = setInterval(() => {
    const now = performance.now(), dt = Math.min(0.2, (now - last) / 1000); last = now
    if (!G.net || G.net.role !== 'host') { clearInterval(hostLoop); hostLoop = null; return }
    hostTick(dt)
  }, 25)
}
function hostInput(cid, d) {
  if (!G.net || G.net.role !== 'host' || !G.squad) return
  const m = G.squad.find((x) => x.remote === cid)
  if (!m || !d) return
  m.in = { ix: Math.max(-1, Math.min(1, d.ix | 0)), iy: Math.max(-1, Math.min(1, d.iy | 0)), fire: !!d.f }
}
function hostDrop(cid) {
  if (!G.net || G.net.role !== 'host' || !G.squad) return
  const m = G.squad.find((x) => x.remote === cid)
  if (m) { m.remote = null; m.in = { ix: 0, iy: 0, fire: false } }
  if (G.net.remotes) G.net.remotes = G.net.remotes.map((c) => (c === cid ? null : c))
}

// ---------------- guest ----------------
const maps = { en: new Map(), eb: new Map(), pb: new Map(), pu: new Map(), bm: new Map() }
function reconcile(key, arr) {
  const prev = maps[key], next = new Map()
  const list = (arr || []).map((d) => {
    let o = prev.get(d._i)
    if (!o) { o = { _i: d._i, x: d.x, y: d.y }; }
    for (const k in d) if (k !== 'x' && k !== 'y' && k !== 'spr' && k !== '_i') o[k] = d[k]
    if (d.spr !== undefined) o.spr = SPR_LIST[d.spr]
    o.tx = d.x; o.ty = d.y
    if (Math.abs(o.x - d.x) > 12 || Math.abs(o.y - d.y) > 12) { o.x = d.x; o.y = d.y }
    next.set(d._i, o)
    return o
  })
  maps[key] = next
  return { list, prev }
}
function guestApply(s) {
  if (!G.net || G.net.role !== 'guest' || s.n <= lastSeq) return
  lastSeq = s.n
  const net = G.net
  net.hostMode = s.hm
  net.wait = s.hm === 'playing' ? '' : ({ paused: 'THE HOST PAUSED THE GAME', clear: 'MISSION COMPLETE! THE HOST IS CHECKING THE RESULTS', shop: 'THE HOST IS IN THE UPGRADE SHOP', over: 'GAME OVER: THE HOST CAN RETRY', victory: 'VICTORY! THE GALAXY IS SAVED', menu: 'THE HOST LEFT THE GAME' }[s.hm] || 'WAITING FOR THE HOST…')
  G.mission = s.mi; G.score = s.sc; G.credits = s.cr; G.lives = s.lv; G.combo = s.cb; G.comboT = s.ct; G.meter = s.mt; G.scroll = s.sl; G.exitT = s.ex; G.warped = s.wp; G.golden = s.ig
  if (s.hm !== 'playing') { net.hostSeen = s.hm; emit(); return }
  G.banner = s.bn || null
  G.toasts = s.ts || []
  G.bonus = s.bo ? { ...s.bo } : null
  G.lz = s.lz ? { ...s.lz } : null
  const p = G.p
  if (s.p) {
    const wasHp = net.mine ? net.mine.hp : null
    p.x = s.p.x; p.y = s.p.y; p.hp = s.p.hp; p.maxHp = s.p.mh; p.alive = !!s.p.al; p.inv = s.p.inv; p.skT = s.p.sk; p.shieldT = s.p.sh; p.od = s.p.od
    p.sk = [s.p.md, s.p.pt]
    p.dr = s.p.dr.map(([x, y]) => ({ x, y }))
    void wasHp
  }
  // squad: our own ship is predicted locally, the others follow the host
  const mates = s.sq || []
  if (!G.squad) G.squad = []
  mates.forEach((m, i) => {
    let o = G.squad[i]
    if (!o) o = G.squad[i] = { id: i, x: m.x, y: m.y, vx: 0, vy: 0, maxHp: 3 }
    const mine = m.rc === RT.cid
    o.hp = m.hp; o.maxHp = m.mh; o.alive = !!m.al; o.inv = m.inv; o.model = m.md; o.paint = m.pt; o.human = !!m.hu || !!m.rc; o.remote = m.rc; o.respawn = m.rs; o.mine = mine
    o.tx = m.x; o.ty = m.y
    if (mine) { net.me = i; net.mine = o; if (!o.alive || Math.hypot(o.x - m.x, o.y - m.y) > 10) { o.x = m.x; o.y = m.y } }
    else if (Math.abs(o.x - m.x) > 12 || Math.abs(o.y - m.y) > 12) { o.x = m.x; o.y = m.y }
  })
  G.squad.length = mates.length
  const E = reconcile('en', s.en), B = reconcile('eb', s.eb), P = reconcile('pb', s.pb), U = reconcile('pu', s.pu), M = reconcile('bm', s.bm)
  // sounds and effects the host's simulation would have made
  for (const [id, o] of E.prev) if (!maps.en.has(id) && o.x > -HW + 3 && o.x < HW) { boom(o.x, o.y, 12, 26, COLS.fire); sfx('boom') }
  if (P.list.length > (net.lastPb || 0) + 1) sfx('shoot')
  net.lastPb = P.list.length
  for (const [id, o] of U.prev) if (!maps.pu.has(id)) sfx('pickup')
  if (net.mine) { if (net.lastHp !== undefined && net.mine.hp < net.lastHp) { shake(1.6); flash(0.35, [1, 0.15, 0.15]); sfx('hurt') } net.lastHp = net.mine.hp }
  G.enemies = E.list; G.ebul = B.list; G.pbul = P.list; G.pups = U.list; G.beams = M.list
  if (s.bs) { if (!G.boss) G.boss = {}; const b = G.boss; for (const k in s.bs) if (k !== 'spr') b[k] = s.bs[k]; b.spr = SPR_LIST[s.bs.spr]; b.tx2 = s.bs.x; b.ty2 = s.bs.y } else if (G.boss && !G.boss.dying) { boom(G.boss.x, G.boss.y, 40, 40, COLS.fire); sfx('bigBoom'); G.boss = null } else G.boss = null
  emit()
}
function guestStep(dt) {
  const net = G.net
  stepParticles(dt)
  const k = Math.min(1, dt * 16)
  for (const key of ['en', 'eb', 'pb', 'pu']) for (const o of maps[key].values()) {
    if (key !== 'en') { o.tx += (o.vx || 0) * dt; o.ty += (o.vy || 0) * dt }
    o.x += (o.tx - o.x) * k; o.y += (o.ty - o.y) * k
  }
  const b = G.boss
  if (b && b.tx2 !== undefined) { b.x += (b.tx2 - b.x) * k; b.y += (b.ty2 - b.y) * k }
  for (const t of G.toasts) t.t -= dt
  if (G.banner) G.banner.t -= dt
  const mine = net.mine
  for (const m of G.squad || []) {
    if (!m.alive) continue
    if (m === mine) {
      const ax = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0), ay = (keys.ArrowUp || keys.KeyW ? 1 : 0) - (keys.ArrowDown || keys.KeyS ? 1 : 0)
      const len = Math.hypot(ax, ay) || 1
      m.vx += ((ax / len) * 46 - m.vx) * Math.min(1, dt * 14); m.vy += ((ay / len) * 46 - m.vy) * Math.min(1, dt * 14)
      m.x += m.vx * dt; m.y += m.vy * dt
      m.x += (m.tx - m.x) * Math.min(1, dt * 3); m.y += (m.ty - m.y) * Math.min(1, dt * 3) // slowly pulled to the host's version
      m.x = Math.max(-HW + 8, Math.min(HW - 5, m.x)); m.y = Math.max(-24, Math.min(19.5, m.y))
      if (Math.random() < 0.7) part(m.x - 4.5, m.y, -28, 0, 0.15, COLS.cyan[1], 0.7)
    } else { m.x += (m.tx - m.x) * k; m.y += (m.ty - m.y) * k }
  }
  inT -= dt
  if (inT <= 0) {
    inT = (RT.p2p && Object.keys(RT.p2p).length) ? 0.05 : 0.12
    const ax = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0), ay = (keys.ArrowUp || keys.KeyW ? 1 : 0) - (keys.ArrowDown || keys.KeyS ? 1 : 0)
    send('sin', { ix: ax, iy: ay, f: !!(keys.Space || keys.KeyJ || keys.Enter || G.touchFire) }, RT.room && RT.room.host).catch(() => {})
  }
}
function guestBegin(d) {
  lastSeq = -1; inT = 0
  for (const k in maps) maps[k] = new Map()
  const net = {
    role: 'guest', me: -1, mine: null, wait: 'WAITING FOR THE HOST…', hostMode: 'playing',
    step: guestStep,
    leave: () => { toMenu() },
    onEnd: () => { leaveRoom().catch(() => {}) },
  }
  netStartGuest(net)
  void d
}

if (typeof window !== 'undefined') window.__space = { hostSpace }
export function installSpaceOnline() {
  if (installed) return
  installed = true
  onMsg('sstart', (d, env) => { if (!isHost() && RT.room && env.f === RT.room.host) guestBegin(d) })
  onMsg('sst', (d, env) => { if (!isHost() && G.net && G.net.role === 'guest' && env.f === (RT.room && RT.room.host)) guestApply(d) })
  onMsg('sin', (d, env) => { if (isHost()) hostInput(env.f, d) })
  onMsg('send', (d, env) => { if (!isHost() && G.net && G.net.role === 'guest' && RT.room && env.f === RT.room.host) { toMenu() } })
  onMsg('presence', (d, env) => { if (isHost() && env.left) hostDrop(env.left) })
  onMsg('hostchange', () => { if (G.net && G.net.role === 'guest') toMenu() })
  setInterval(() => {
    if (!G.net) return
    if (G.net.role === 'host') (G.net.remotes || []).forEach((c) => { if (c && !alive(c, 15000)) hostDrop(c) })
    else if (RT.room && !alive(RT.room.host, 16000)) toMenu()
  }, 3000)
}
