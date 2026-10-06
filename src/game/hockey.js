// NEON AIR HOCKEY: fast top-down air hockey. Vs bot (3 levels), 2 players on one keyboard/phone, or online 1v1 with a friend.
// Mouse / finger drags your mallet; keyboard: WASD (P1) and arrows (P2). Random "chaos" events add a second puck.
import { G, emit as engineEmit, keys, games, profile, saveProfile, recordScore, part, ring, shake, flash, popup, stepParticles, toMenu } from './engine.js'
import { sfx, music, speak } from './audio.js'
import { col, disk, circle, rect, line, clamp, R } from './pxl.js'
import { drawHockey3, hockeyCam, hockeyLights } from './arcade3d.js'
import { unprojectGround } from './rogue3d.js'

const TX = 40, TY = 22, GOAL = 7.6, RM = 3.4, RP = 2.0, VMAX = 118
const DIFF = [{ name: 'EASY', spd: 52, err: 5.5, lag: 0.22, atk: 0.35 }, { name: 'MEDIUM', spd: 82, err: 2.6, lag: 0.12, atk: 0.6 }, { name: 'HARD', spd: 118, err: 0.8, lag: 0.04, atk: 0.9 }]
const C1 = '#3de8ff', C2 = '#ff4de1'

export const HK = { mode: 'idle', paused: false, phase: 'ready', cfg: { type: 'bot', diff: 2, target: 7, chaos: true }, puck: null, extra: [], m: [], score: [0, 0], t: 0, phaseT: 0, msg: null, over: null, shake: 0, trail: [], net: null, ptr: null, emitT: 0, chaosT: 20, lastTouch: -1, rally: 0, best: 0 }
let snap = null
const subs = new Set()
export const subscribeHockey = (f) => { subs.add(f); return () => subs.delete(f) }
export const getHockeySnap = () => snap
function emitH() {
  snap = { mode: HK.mode, paused: HK.paused, phase: HK.phase, type: HK.cfg.type, diff: DIFF[HK.cfg.diff - 1].name, score: HK.score.slice(), target: HK.cfg.target, msg: HK.msg ? { ...HK.msg } : null, over: HK.over, count: HK.phase === 'ready' ? Math.ceil(HK.readyT) : 0, rally: HK.rally, net: HK.net ? HK.net.role : null, names: HK.cfg.type === 'bot' ? ['YOU', 'BOT'] : HK.cfg.type === 'online' ? (HK.net && HK.net.role === 'guest' ? ['HOST', 'YOU'] : ['YOU', 'FRIEND']) : ['PLAYER 1', 'PLAYER 2'] }
  subs.forEach((f) => f())
}
const mkMallet = (side, human) => ({ side, human, x: side * -1 * 26 * -1, y: 0, vx: 0, vy: 0, tx: side * 26, ty: 0 })
function start(cfg = {}) {
  HK.cfg = { type: 'bot', diff: 2, target: 7, chaos: true, ...cfg }
  if (HK.cfg.type !== 'online') HK.net = null
  HK.m = [mkMallet(-1, 1), mkMallet(1, HK.cfg.type === 'bot' ? 0 : HK.cfg.type === '2p' ? 2 : 0)]
  HK.m[0].x = -26; HK.m[1].x = 26
  HK.score = [0, 0]; HK.over = null; HK.paused = false; HK.t = 0; HK.extra = []; HK.trail = []; HK.chaosT = 22; HK.rally = 0; HK.best = 0
  G.mode = 'hockey'; engineEmit(); G.parts = []; G.pops = []; G.shake = 0; G.flash = 0
  HK.mode = 'play'
  serve(Math.random() < 0.5 ? -1 : 1)
  music.set('race', 0); sfx('mission'); emitH()
}
function stop() { HK.mode = 'idle'; HK.paused = false; if (HK.net) { const n = HK.net; HK.net = null; if (n.onStop) try { n.onStop() } catch { /* ignore */ } } music.set('menu'); emitH() }
function serve(toSide) {
  HK.puck = { x: toSide * -2, y: 0, vx: 0, vy: 0 }
  HK.extra = []
  HK.phase = 'ready'; HK.readyT = 1.6; HK.phaseT = 0; HK.serveSide = toSide; HK.lastTouch = -1; HK.rally = 0
}

// ---------- physics ----------
function hitMallet(m, pk) {
  const dx = pk.x - m.x, dy = pk.y - m.y, d = Math.hypot(dx, dy)
  if (d >= RM + RP || d < 1e-4) return false
  const nx = dx / d, ny = dy / d, over = RM + RP - d
  pk.x += nx * over; pk.y += ny * over
  const rv = (pk.vx - m.vx) * nx + (pk.vy - m.vy) * ny
  if (rv < 0) {
    const j = -(1 + 0.92) * rv
    pk.vx += nx * j; pk.vy += ny * j
    const sp = Math.hypot(pk.vx, pk.vy)
    if (sp < 24) { pk.vx = nx * 24; pk.vy = ny * 24 } // a little pop so soft touches still move the puck
    if (sp > VMAX) { pk.vx *= VMAX / sp; pk.vy *= VMAX / sp }
    const hard = Math.min(1, sp / 90)
    sfx('hkHit'); if (hard > 0.5) { shake(0.25 + hard * 0.5); for (let i = 0; i < 6; i++) part(pk.x, pk.y, R(-26, 26), R(-26, 26), 0.3, m.side < 0 ? col(C1) : col(C2), R(0.8, 1.4)) }
    HK.lastTouch = m.side < 0 ? 0 : 1; HK.rally++; HK.best = Math.max(HK.best, HK.rally)
  }
  return true
}
function stepPuck(pk, dt) {
  const sub = 3, h = dt / sub
  for (let s = 0; s < sub; s++) {
    pk.x += pk.vx * h; pk.y += pk.vy * h
    const sp = Math.hypot(pk.vx, pk.vy)
    if (sp > 12) { pk.vx *= 1 - 0.07 * h; pk.vy *= 1 - 0.07 * h }
    // side walls
    if (pk.y > TY - RP) { pk.y = TY - RP; pk.vy = -Math.abs(pk.vy) * 0.96; sfx('hkWall') }
    else if (pk.y < -TY + RP) { pk.y = -TY + RP; pk.vy = Math.abs(pk.vy) * 0.96; sfx('hkWall') }
    // end walls (with the goal opening)
    if (Math.abs(pk.y) > GOAL - 0.2 || Math.abs(pk.x) < TX - RP - 0.5) {
      if (pk.x > TX - RP) { pk.x = TX - RP; pk.vx = -Math.abs(pk.vx) * 0.96; sfx('hkWall') }
      else if (pk.x < -TX + RP) { pk.x = -TX + RP; pk.vx = Math.abs(pk.vx) * 0.96; sfx('hkWall') }
    }
    for (const m of HK.m) hitMallet(m, pk)
  }
}
function stepMallet(m, dt, ai, o) {
  const sp = m.human ? 140 : DIFF[HK.cfg.diff - 1].spd
  let tx = m.tx, ty = m.ty
  if (m.human) {
    tx = m.x; ty = m.y // stay put unless the player moves
    const k = keys
    const left = HK.cfg.type === '2p' ? (m.human === 1 ? k.KeyA : k.ArrowLeft) : (k.KeyA || k.ArrowLeft), right = HK.cfg.type === '2p' ? (m.human === 1 ? k.KeyD : k.ArrowRight) : (k.KeyD || k.ArrowRight)
    const up = HK.cfg.type === '2p' ? (m.human === 1 ? k.KeyW : k.ArrowUp) : (k.KeyW || k.ArrowUp), down = HK.cfg.type === '2p' ? (m.human === 1 ? k.KeyS : k.ArrowDown) : (k.KeyS || k.ArrowDown)
    const kx = (right ? 1 : 0) - (left ? 1 : 0), ky = (up ? 1 : 0) - (down ? 1 : 0)
    if (kx || ky) { tx = m.x + kx * 30; ty = m.y + ky * 30; m.kb = true; if (m.human === 1 || HK.net) HK.ptr = null } else if (m.kb) { tx = m.x; ty = m.y; m.kb = false }
    if (m.human === 1 && HK.ptr && HK.ptr.t > 0) { tx = HK.ptr.x; ty = HK.ptr.y }
    if (HK.net && HK.net.role === 'guest' && HK.ptr && HK.ptr.t > 0) { tx = HK.ptr.x; ty = HK.ptr.y }
  } else ai(m, o, dt)
  if (!m.human) { tx = m.tx; ty = m.ty }
  // move toward the target at a limited speed
  const dx = tx - m.x, dy = ty - m.y, d = Math.hypot(dx, dy)
  const step = Math.min(d, sp * dt)
  const nx = d > 1e-4 ? dx / d : 0, ny = d > 1e-4 ? dy / d : 0
  const ox = m.x, oy = m.y
  m.x += nx * step; m.y += ny * step
  const lo = m.side < 0 ? -TX + RM : 2, hi = m.side < 0 ? -2 : TX - RM
  m.x = clamp(m.x, lo, hi); m.y = clamp(m.y, -TY + RM, TY - RM)
  m.vx = (m.x - ox) / dt; m.vy = (m.y - oy) / dt
}
function aiMallet(m, o, dt) {
  const D = DIFF[HK.cfg.diff - 1]
  const pk = HK.puck
  // the puck that matters most: closest to our goal and heading our way, else the nearest one
  const all = [pk, ...HK.extra]
  let tgt = all[0]
  for (const q of all) if ((m.side > 0 ? q.x : -q.x) > (m.side > 0 ? tgt.x : -tgt.x)) tgt = q
  m.think = (m.think || 0) - dt
  if (m.think <= 0) {
    m.think = D.lag
    const home = m.side * (TX - 9)
    const toward = (tgt.vx * m.side) > 6
    const onMySide = tgt.x * m.side > 0
    let gx = home, gy = 0
    if (toward || !onMySide) {
      // intercept: where will the puck cross the defence line (bouncing off the walls)?
      const t = Math.max(0, (home - tgt.x) / (Math.abs(tgt.vx) > 1 ? tgt.vx : 1))
      let py = tgt.y + tgt.vy * Math.min(t, 1.2)
      while (Math.abs(py) > TY - RP) py = Math.sign(py) * (2 * (TY - RP) - Math.abs(py))
      gy = py + (Math.random() - 0.5) * 2 * D.err
      gx = home + m.side * -2
    }
    if (onMySide && Math.hypot(tgt.vx, tgt.vy) < 55 && Math.abs(tgt.x) > 4) {
      // it is slow on our side: wind up behind it and hit it toward the other goal
      if (Math.random() < D.atk + 0.2) {
        const aimY = (Math.random() - 0.5) * 2 * GOAL * 0.8
        const ax = -m.side * TX - tgt.x, ay = aimY - tgt.y, al = Math.hypot(ax, ay) || 1
        gx = tgt.x - (ax / al) * (RM + RP - 0.3); gy = tgt.y - (ay / al) * (RM + RP - 0.3)
        if (Math.hypot(m.x - gx, m.y - gy) < 6) { gx = tgt.x + (ax / al) * 4; gy = tgt.y + (ay / al) * 4 }
      }
    }
    m.tx = clamp(gx, m.side < 0 ? -TX + RM : 2, m.side < 0 ? -2 : TX - RM); m.ty = clamp(gy, -TY + RM, TY - RM)
  }
}

// ---------- loop ----------
function update(dtRaw) {
  const dt = Math.min(dtRaw, 0.04)
  if (HK.mode === 'idle' || HK.paused) return
  HK.t += dt
  HK.shake = Math.max(0, HK.shake - dt * 2)
  if (HK.msg) { HK.msg.t -= dt; if (HK.msg.t <= 0) HK.msg = null }
  for (let i = HK.trail.length - 1; i >= 0; i--) { HK.trail[i].l -= dt; if (HK.trail[i].l <= 0) HK.trail.splice(i, 1) }
  if (HK.net && HK.net.role === 'guest') { guestStep(dt); stepParticles(dt); return }
  HK.phaseT += dt
  if (HK.phase === 'ready') {
    HK.readyT -= dt
    for (const m of HK.m) stepMallet(m, dt, m.remote ? remoteAI : aiMallet, HK.puck)
    if (HK.readyT <= 0) { HK.phase = 'play'; HK.puck.vx = HK.serveSide * 26; HK.puck.vy = (Math.random() - 0.5) * 20; sfx('hkServe') }
  } else if (HK.phase === 'play') {
    for (const m of HK.m) stepMallet(m, dt, m.remote ? remoteAI : aiMallet, HK.puck)
    for (const pk of [HK.puck, ...HK.extra]) { stepPuck(pk, dt); HK.trail.push({ x: pk.x, y: pk.y, l: 0.25 }) }
    const all = [HK.puck, ...HK.extra]
    for (let i = 0; i < all.length; i++) {
      const pk = all[i]
      if (Math.abs(pk.y) < GOAL && Math.abs(pk.x) > TX - 0.3) { goal(pk.x > 0 ? 0 : 1, i); break }
    }
    // chaos: a second puck now and then
    if (HK.cfg.chaos) {
      HK.chaosT -= dt
      if (HK.chaosT <= 0) { HK.chaosT = 26; HK.extra = [{ x: 0, y: R(-10, 10), vx: (Math.random() < 0.5 ? -1 : 1) * 38, vy: R(-30, 30), life: 11, extra: true }]; HK.msg = { text: 'DOUBLE PUCK!', sub: '', color: '#ffe84a', t: 1.4 }; sfx('hkChaos'); shake(0.8) }
      for (const e of HK.extra) { e.life -= dt; if (e.life <= 0) { e.dead = true; ring(e.x, e.y, 10, 30, [col('#ffffff')]) } }
      HK.extra = HK.extra.filter((e) => !e.dead)
    }
  } else if (HK.phase === 'goal') {
    for (const m of HK.m) stepMallet(m, dt, m.remote ? remoteAI : aiMallet, HK.puck)
    if (HK.phaseT > 1.6) { if (HK.score[0] >= HK.cfg.target || HK.score[1] >= HK.cfg.target) endMatch(); else serve(HK.lastScorer === 0 ? 1 : -1) }
  }
  stepParticles(dt)
  if (HK.net && HK.net.role === 'host') netTick(dt)
  HK.emitT -= dt
  if (HK.emitT <= 0) { HK.emitT = 0.1; emitH() }
}
const remoteAI = () => {}
function goal(scorer, idx) {
  if (idx > 0) { HK.extra.splice(idx - 1, 1); HK.score[scorer] += 1; sfx('hkGoal'); shake(1.2); ring(scorer === 0 ? TX : -TX, 0, 24, 60, [col(scorer === 0 ? C1 : C2)]); return }
  HK.score[scorer]++; HK.lastScorer = scorer
  HK.phase = 'goal'; HK.phaseT = 0
  HK.msg = { text: 'GOAL!', sub: HK.cfg.type === 'bot' ? (scorer === 0 ? 'NICE SHOT' : 'THE BOT SCORES') : `PLAYER ${scorer + 1}`, color: scorer === 0 ? C1 : C2, t: 1.5 }
  sfx('hkGoal'); shake(2); flash(0.35, scorer === 0 ? [0.4, 0.9, 1] : [1, 0.4, 0.9])
  for (let i = 0; i < 30; i++) part(scorer === 0 ? TX : -TX, R(-GOAL, GOAL), R(-60, 60) * (scorer === 0 ? -1 : 1), R(-40, 40), R(0.4, 0.9), col(scorer === 0 ? C1 : C2), R(1, 2))
  HK.puck.vx = HK.puck.vy = 0
  if (HK.score[scorer] === HK.cfg.target - 1) { speak('Match point', 0.7, 1.1) }
  emitH()
}
function endMatch() {
  HK.phase = 'over'; HK.mode = 'over'; music.stop()
  const w = HK.score[0] > HK.score[1] ? 0 : 1
  const mine = HK.net ? (HK.net.role === 'guest' ? 1 : 0) : 0
  const won = w === mine
  const human2 = HK.cfg.type === '2p'
  HK.over = { winner: w, win: human2 ? true : won, score: HK.score.slice(), best: HK.best, type: HK.cfg.type }
  if (!human2) {
    profile.hockeyGames = (profile.hockeyGames || 0) + 1
    if (won) profile.hockeyWins = (profile.hockeyWins || 0) + 1
    const pts = HK.score[mine], opp = HK.score[1 - mine]
    const score = Math.max(0, pts * 120 + (won ? 600 + (pts - opp) * 80 : 0) + HK.best * 15)
    HK.over.points = score
    recordScore('hockey', score)
    saveProfile()
  }
  sfx(HK.over.win ? 'win' : 'over')
  emitH()
}
function onKey(code) {
  if (HK.mode === 'idle') return
  if (code === 'Escape' || code === 'KeyP') { if (HK.mode === 'play' && !HK.net) { HK.paused = !HK.paused; sfx('ui'); emitH() } return }
  if (HK.paused) { if (code === 'Enter') { HK.paused = false; emitH() } return }
  if (HK.mode === 'over' && code === 'Enter') hockeyActions.rematch()
}
export const hockeyActions = {
  start, stop, quit() { toMenu() },
  resume() { HK.paused = false; emitH() },
  pause() { if (HK.mode === 'play' && !HK.paused && !HK.net) { HK.paused = true; emitH(); return true } return false },
  rematch() { if (HK.net) { HK.net.rematch(); return } start(HK.cfg) },
  // pointer / finger in table coordinates (null when released)
  // the table is drawn in 3D: a screen position (arena units) becomes a point on the table
  pointerScreen(ax, ay) { const g = unprojectGround(hockeyCam(), ax / 50, ay / 28); if (g) hockeyActions.pointer(g.x, g.y) },
  pointer(x, y) { if (x === null) return; /* the mallet stays where the finger left it */ const side = HK.net && HK.net.role === 'guest' ? 1 : -1; HK.ptr = { x: clamp(x, side < 0 ? -TX + RM : 2, side < 0 ? -2 : TX - RM), y: clamp(y, -TY + RM, TY - RM), t: 1 } },
}

// ---------- online (host simulates the puck; each driver moves their own mallet locally) ----------
let nT = 0, rT = 0, nSeq = 0, lastN = -1
const r2 = (v) => Math.round(v * 100) / 100
function netTick(dt) {
  nT -= dt
  if (nT <= 0) { nT = HK.net.fast && HK.net.fast() ? 0.033 : 0.1; HK.net.state({ n: ++nSeq, pk: [r2(HK.puck.x), r2(HK.puck.y), r2(HK.puck.vx), r2(HK.puck.vy)], ex: HK.extra.map((e) => [r2(e.x), r2(e.y), r2(e.vx), r2(e.vy)]), m0: [r2(HK.m[0].x), r2(HK.m[0].y), r2(HK.m[0].vx), r2(HK.m[0].vy)], sc: HK.score, ph: HK.phase, rd: r2(HK.readyT), msg: HK.msg, over: HK.over, rally: HK.rally, ss: HK.serveSide }) }
}
function guestStep(dt) {
  const m = HK.m[1]
  stepMallet(m, dt, remoteAI, null)
  rT -= dt
  if (rT <= 0 && HK.net) { rT = HK.net.fast && HK.net.fast() ? 0.033 : 0.09; HK.net.mine([r2(m.x), r2(m.y), r2(m.vx), r2(m.vy)]) }
  const pk = HK.puck
  pk.x += pk.vx * dt; pk.y += pk.vy * dt
  for (const e of HK.extra) { e.x += e.vx * dt; e.y += e.vy * dt }
  for (const q of [pk, ...HK.extra]) HK.trail.push({ x: q.x, y: q.y, l: 0.2 })
  HK.emitT -= dt
  if (HK.emitT <= 0) { HK.emitT = 0.1; emitH() }
}
export const hockeyNet = {
  attach(net) {
    HK.net = net
    if (net.role === 'guest') { HK.m[0].human = 0; HK.m[0].remote = true; HK.m[1].human = 1 } else { HK.m[0].human = 1; HK.m[1].human = 0; HK.m[1].remote = true }
  },
  active: () => !!HK.net && HK.mode !== 'idle',
  reset() { nSeq = 0; lastN = -1; nT = 0; rT = 0 },
  // host: the friend's mallet
  applyMallet(a) { const m = HK.m[1]; if (!m || !a) return; m.remote = true; m.human = 0; m.tx = clamp(a[0], 2, TX - RM); m.ty = clamp(a[1], -TY + RM, TY - RM); const ox = m.x, oy = m.y; m.x = m.tx; m.y = m.ty; m.vx = a[2]; m.vy = a[3]; void ox; void oy },
  // guest: mirror the host
  applyState(s) {
    if (!HK.net || HK.net.role !== 'guest' || !s || s.n <= lastN || HK.mode === 'idle') return
    lastN = s.n
    const prevScore = HK.score.slice(), prevPhase = HK.phase
    HK.puck = { x: s.pk[0], y: s.pk[1], vx: s.pk[2], vy: s.pk[3] }
    HK.extra = (s.ex || []).map((e) => ({ x: e[0], y: e[1], vx: e[2], vy: e[3] }))
    const m0 = HK.m[0]; m0.x = s.m0[0]; m0.y = s.m0[1]; m0.vx = s.m0[2]; m0.vy = s.m0[3]
    HK.score = s.sc; HK.phase = s.ph; HK.readyT = s.rd; HK.rally = s.rally
    if (s.msg && (!HK.msg || HK.msg.text !== s.msg.text)) HK.msg = s.msg
    if (s.sc[0] !== prevScore[0] || s.sc[1] !== prevScore[1]) { sfx('hkGoal'); shake(1.6); flash(0.3, [1, 1, 1]) }
    if (s.ph === 'play' && prevPhase !== 'play') sfx('hkServe')
    if (s.over && !HK.over) {
      HK.over = { ...s.over, win: s.over.winner === 1 }; HK.mode = 'over'; HK.phase = 'over'; music.stop()
      profile.hockeyGames = (profile.hockeyGames || 0) + 1
      const won = s.over.winner === 1
      if (won) profile.hockeyWins = (profile.hockeyWins || 0) + 1
      const pts = s.sc[1], opp = s.sc[0]
      HK.over.points = Math.max(0, pts * 120 + (won ? 600 + (pts - opp) * 80 : 0))
      recordScore('hockey', HK.over.points); saveProfile(); sfx(won ? 'win' : 'over')
    }
    emitH()
  },
  opponentLeft() { if (HK.net && HK.mode === 'play') { const w = HK.net.role === 'guest' ? 1 : 0; HK.score[w] = HK.cfg.target; endMatch() } },
}

// ---------- drawing ----------
function draw(api) {
  const { put } = api
  const t = G.time
  const c1 = col(C1), c2 = col(C2)
  // table
  rect(put, -TX, -TY, TX, TY, col('#07142a'), 1, -3, 1.6)
  for (let x = -TX; x <= TX; x += 4) for (let y = -TY; y <= TY; y += 4) put(x, y, -2.8, 0.35, 0.35, 0.1, 0.25, 0.4)
  // centre line and circle
  for (let y = -TY; y <= TY; y += 1.2) put(0, y, -2.4, 0.5, 0.7, 0.4, 0.5, 0.9)
  circle(put, 0, 0, 7, col('#3a5aa0'), 1, -2.4, 0.8); disk(put, 0, 0, 1.4, col('#3a5aa0'), 1, -2.4, 0.7)
  // rails, goals
  for (let x = -TX - 2; x <= TX + 2; x += 1) { put(x, TY + 1.2, -1, 1.1, 1.1, 0.5, 0.7, 1.6); put(x, -TY - 1.2, -1, 1.1, 1.1, 0.5, 0.7, 1.6) }
  for (let y = -TY; y <= TY; y += 1) {
    const inGoal = Math.abs(y) < GOAL
    for (const sd of [-1, 1]) {
      const cc = sd < 0 ? c1 : c2
      if (inGoal) put(sd * (TX + 1.6), y, -1, 1.1, 1.1, cc[0] * 2.2, cc[1] * 2.2, cc[2] * 2.2)
      else put(sd * (TX + 1.2), y, -1, 1.1, 1.1, 0.5, 0.7, 1.6)
    }
  }
  // goal flash
  if (HK.phase === 'goal') { const k = Math.max(0, 1 - HK.phaseT) * 2; const sc = HK.lastScorer === 0 ? c1 : c2; for (let y = -GOAL; y <= GOAL; y += 1) put(HK.lastScorer === 0 ? TX + 3.2 : -TX - 3.2, y, 0, 1.4, 1.4, sc[0] * k * 2, sc[1] * k * 2, sc[2] * k * 2) }
  // trail
  for (const q of HK.trail) put(q.x, q.y, -0.5, 1.3 * (q.l * 3), 1.3 * (q.l * 3), 1.6 * q.l * 3, 1.6 * q.l * 3, 2.2 * q.l * 3)
  // mallets
  for (const m of HK.m) {
    const cc = m.side < 0 ? c1 : c2
    disk(put, m.x, m.y, RM, cc, 0.7, 0, 0.7); disk(put, m.x, m.y, RM * 0.55, cc, 1.6, 0.4, 0.7); circle(put, m.x, m.y, RM + 0.4, cc, 2.2, 0.2, 0.7)
  }
  // pucks
  for (const pk of [HK.puck, ...HK.extra]) if (pk) { disk(put, pk.x, pk.y, RP, col('#ffffff'), 1.4, 0.5, 0.6); circle(put, pk.x, pk.y, RP + 0.3, col('#ffe84a'), 2, 0.6, 0.6) }
  for (const q of G.parts) { const f = q.life / q.max; put(q.x, q.y, 1, q.s * (0.35 + 0.65 * f) * 0.9, q.s * (0.35 + 0.65 * f) * 0.9, q.c[0] * 1.8, q.c[1] * 1.8, q.c[2] * 1.8) }
  api.pops(G.pops, 0)
  void t; void line
}
if (typeof window !== 'undefined') { window.__HK = HK; window.__hockey = hockeyActions }
games.hockey = { update, onKey, draw() {}, draw3: (api) => drawHockey3(api, HK, C1, C2, TX, TY, GOAL, RM, RP), camera: () => hockeyCam(), lights: hockeyLights, stop, sky: () => '#030712' }
