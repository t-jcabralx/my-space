// Pickleball: top-down court, real rules (diagonal serve, two-bounce rule, kitchen, side-out scoring, win by 2).
import { G, keys, games, profile, saveProfile, recordScore, part, ring, shake, flash, popup, COLS, stepParticles, toMenu } from './engine.js'
import { rgb } from './sprites.js'
import { sfx, music, speak } from './audio.js'

const CX = 44, CY = 20, K = 14, NETH = 5.8, GR = 64, REACH = 7
const R = (a, b) => a + Math.random() * (b - a)
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
const gauss = () => R(0, 1) + R(0, 1) + R(0, 1) - 1.5
const DIFF = [
  { name: 'EASY', spd: 23, err: 1.9, react: 0.14, smash: 0.25 },
  { name: 'MEDIUM', spd: 27, err: 1.25, react: 0.09, smash: 0.55 },
  { name: 'HARD', spd: 31, err: 0.75, react: 0.05, smash: 0.85 },
]
export const MODES = {
  bot:   { name: 'VS BOT',        desc: '1v1: you against the AI',            a: 1, b: 1, humans: [[0, 0]] },
  local: { name: '1v1 LOCAL',     desc: 'Two players, one keyboard',          a: 1, b: 1, humans: [[0, 0], [1, 0]] },
  duo:   { name: '2v2 + BOT',     desc: 'You and a bot partner vs 2 bots',     a: 2, b: 2, humans: [[0, 0]] },
  coop:  { name: '2v2 CO-OP',     desc: 'Two humans vs 2 bots',                a: 2, b: 2, humans: [[0, 0], [0, 1]] },
  demo:  { name: 'BOTS vs BOTS',  desc: 'Watch 4 bots play (demo)',            a: 2, b: 2, humans: [] },
}

export const P = {
  mode: 'idle', paused: false, phase: 'serve', cfg: { type: 'bot', diff: 2, target: 11 }, pl: [], score: [0, 0], serveTeam: 0, serverNum: 1, doubles: false,
  firstIdx: [0, 0], B: null, msg: null, msgT: 0, pointT: 0, readyT: 0, rally: 0, call: '', over: null, t: 0, emitT: 0, lastResult: '', bestRally: 0, trail: [],
}
let snap = null
const subs = new Set()
export const subscribePickle = (f) => { subs.add(f); return () => subs.delete(f) }
export const getPickleSnap = () => snap
function emitP() {
  const m = MODES[P.cfg.type]
  const srv = serverPlayer()
  snap = {
    mode: P.mode, paused: P.paused, phase: P.phase, type: P.cfg.type, modeName: m.name, diff: DIFF[P.cfg.diff - 1].name, doubles: P.doubles,
    score: P.score.slice(), serveTeam: P.serveTeam, serverNum: P.serverNum, call: P.call, rally: P.rally, bestRally: P.bestRally,
    msg: P.msg, over: P.over, target: P.cfg.target,
    names: P.cfg.type === 'local' ? ['PLAYER 1', 'PLAYER 2'] : P.cfg.type === 'bot' ? ['YOU', 'BOT'] : P.cfg.type === 'demo' ? ['BOTS A', 'BOTS B'] : ['TEAM YOU', 'TEAM BOTS'],
    serverHuman: srv ? srv.human : 0,
  }
  subs.forEach((f) => f())
}

// ---------- setup ----------
function makePlayers(type) {
  const m = MODES[type], out = []
  const mk = (team, idx) => {
    const hm = m.humans.find(([t, i]) => t === team && i === idx)
    return { id: out.length, team, idx, human: hm ? 1 + m.humans.indexOf(hm) : 0, x: team ? 30 : -30, y: 0, vx: 0, vy: 0, lane: idx === 0 ? -1 : 1, swingT: 0, swingK: 0, moving: false, req: null, swingDelay: 0, anim: 0 }
  }
  for (let i = 0; i < m.a; i++) out.push(mk(0, i))
  for (let i = 0; i < m.b; i++) out.push(mk(1, i))
  return out
}
const teamOf = (t) => P.pl.filter((p) => p.team === t)
const os = (team) => (team === 0 ? 1 : -1)
const serveSign = () => (P.serveTeam === 0 ? -1 : 1) * (P.score[P.serveTeam] % 2 === 0 ? 1 : -1)
function serverPlayer() {
  if (!P.pl.length) return null
  const tm = teamOf(P.serveTeam)
  if (tm.length === 1) return tm[0]
  return tm[P.serverNum === 2 ? 1 - P.firstIdx[P.serveTeam] : P.firstIdx[P.serveTeam]]
}
function placeForServe() {
  const st = P.serveTeam, rt = 1 - st, o = os(st), sgn = serveSign()
  const stm = teamOf(st), rtm = teamOf(rt)
  if (stm.length > 1) {
    if (P.serverNum === 1 && P.newTurn) { P.firstIdx[st] = stm.findIndex((p) => p.lane === sgn); if (P.firstIdx[st] < 0) P.firstIdx[st] = 0 }
    P.newTurn = false
  }
  const srv = serverPlayer()
  srv.lane = sgn
  stm.forEach((p) => { if (p !== srv) p.lane = -sgn })
  srv.x = -o * (CX + 1.5); srv.y = sgn * 9
  stm.forEach((p) => { if (p !== srv) { p.x = -o * (CX - 4); p.y = -sgn * 9 } })
  const recv = rtm.length === 1 ? rtm[0] : rtm.find((p) => p.lane === -sgn) || rtm[0]
  rtm.forEach((p) => { if (p !== recv) p.lane = sgn })
  recv.lane = -sgn
  recv.x = o * (CX - 3); recv.y = -sgn * 9
  rtm.forEach((p) => { if (p !== recv) { p.x = o * (K + 2.6); p.y = sgn * 9 } })
  P.pl.forEach((p) => { p.vx = p.vy = 0; p.req = null; p.swingDelay = 0 })
  P.B = { x: srv.x + o * 1.6, y: srv.y, h: 3, vx: 0, vy: 0, vh: 0, held: true, live: true, serve: false, serveSign: -sgn, lastHit: st, hitCount: 0, bounces: [0, 0], t: 0, lastHitter: srv }
  P.trail = []
  P.phase = 'serve'; P.readyT = 0.9; P.msg = null
  const a = P.score[st], b = P.score[rt]
  P.call = P.doubles ? `${a}-${b}-${P.serverNum}` : `${a}-${b}`
}
function start(type = 'bot', diff = 2, target = 11) {
  initState(type, diff, target)
  G.mode = 'pickle'; G.parts = []; G.pops = []
  profile.pickleGames = (profile.pickleGames || 0) + (type === 'demo' ? 0 : 0)
  music.set('pickle', 0)
  placeForServe(); sfx('mission'); speak('Pickleball. Game on.'); emitP()
}
function initState(type, diff, target) {
  P.cfg = { type, diff, target }
  P.pl = makePlayers(type)
  P.doubles = MODES[type].a > 1
  P.score = [0, 0]; P.serveTeam = 0; P.serverNum = P.doubles ? 2 : 1; P.firstIdx = [0, 0]; P.newTurn = true
  P.mode = 'play'; P.paused = false; P.over = null; P.rally = 0; P.bestRally = 0; P.pointT = 0; P.t = 0
}
function stop() { P.mode = 'idle'; P.paused = false; music.set('menu'); emitP() }

// ---------- rally logic ----------
function endRally(winner, reason) {
  if (P.phase !== 'rally' && P.phase !== 'serve') return
  const B = P.B
  B.live = false
  const serverWon = winner === P.serveTeam
  const ace = serverWon && B.hitCount === 1 && reason === 'WINNER'
  const humanSide = P.pl.some((p) => p.human && p.team === winner)
  if (serverWon) {
    P.score[winner]++
    teamOf(winner).forEach((p) => { p.lane = -p.lane })
  } else if (P.doubles && P.serverNum === 1) { P.serverNum = 2 }
  else { P.serveTeam = 1 - P.serveTeam; P.serverNum = 1; P.newTurn = true }
  P.bestRally = Math.max(P.bestRally, P.rally)
  const label = ace ? 'ACE!' : reason === 'WINNER' ? 'WINNER' : 'FAULT: ' + reason
  const tgt = P.cfg.target, sa0 = P.score[0], sb0 = P.score[1], hi0 = Math.max(sa0, sb0)
  let drama = ''
  if (hi0 >= tgt - 1 && sa0 === sb0) drama = ' · DEUCE!'
  else if (hi0 >= tgt - 1 && Math.abs(sa0 - sb0) >= 1) drama = ` · MATCH POINT ${sa0 > sb0 ? 'TEAM A' : 'TEAM B'}!`
  if (drama && !(hi0 >= tgt && Math.abs(sa0 - sb0) >= 2)) { sfx('crowd'); speak(drama.includes('DEUCE') ? 'Deuce!' : 'Match point!', 0.7, 1.1) }
  if (P.rally >= 10 && !P.over) sfx('crowd')
  P.msg = { text: label, team: winner, sub: (serverWon ? 'POINT' : 'SIDE OUT') + drama + (P.rally >= 10 ? ` · ${P.rally}-SHOT RALLY!` : '') }
  if (ace && humanSide) profile.aces = (profile.aces || 0) + 1
  P.phase = 'point'; P.pointT = 2.3
  sfx(reason === 'WINNER' || ace ? 'point' : 'fault')
  ring(B.x, B.y, 26, 40, winner === 0 ? COLS.cyan : COLS.purple)
  const a = P.score[P.serveTeam], b = P.score[1 - P.serveTeam]
  const sa = P.score[0], sb = P.score[1], t = P.cfg.target
  if ((sa >= t || sb >= t) && Math.abs(sa - sb) >= 2) {
    const w = sa > sb ? 0 : 1
    P.over = { winner: w, a: sa, b: sb }
    P.pointT = 2.5
    const human = P.pl.some((p) => p.human)
    if (human && P.cfg.type !== 'demo') {
      profile.pickleGames = (profile.pickleGames || 0) + 1
      if (P.pl.some((p) => p.human && p.team === w) && (P.cfg.type !== 'local' || true)) profile.pickleWins = (profile.pickleWins || 0) + 1
      const mine = P.pl.some((q) => q.human && q.team === 0) ? 0 : 1
      const pts = P.score[mine], opp = P.score[1 - mine]
      recordScore('pickle', Math.max(0, pts * 100 + (pts > opp ? 500 + (pts - opp) * 25 : 0)))
      saveProfile()
    }
    speak(`Game over. ${w === 0 ? 'Team A' : 'Team B'} wins ${Math.max(sa, sb)} to ${Math.min(sa, sb)}`)
    sfx('win')
  } else {
    speak(label.replace('FAULT: ', 'Fault. ').replace('ACE!', 'Ace!').toLowerCase() === 'winner' ? '' : '', 1)
    P.call = P.doubles ? `${a}-${b}-${P.serverNum}` : `${a}-${b}`
    speak(P.call.replaceAll('-', ', '), 0.7, 1.1)
  }
}
const fault = (team, reason) => endRally(1 - team, reason)

function predictLanding(B) {
  const t = (B.vh + Math.sqrt(B.vh * B.vh + 2 * GR * Math.max(B.h, 0))) / GR
  return { x: B.x + B.vx * t, y: B.y + B.vy * t, t }
}

function launch(p, type, aim = {}) {
  const B = P.B, o = os(p.team)
  const smash = type === 'drive' && B.h > 6.5 && Math.abs(p.x) < 28
  const kind = smash ? 'smash' : type
  let xt, vh
  switch (kind) {
    case 'dink': xt = o * R(3.5, 10); vh = 19; break
    case 'lob': xt = o * R(36, 43); vh = 38; break
    case 'smash': xt = o * R(16, 38); vh = -16; break
    default: xt = o * R(28, 40); vh = 17
  }
  if (aim.short) xt -= o * aim.short * 5
  let yt = aim.ty !== undefined ? aim.ty : -p.y * 0.4
  const d = Math.hypot(B.x - p.x, B.y - p.y)
  const fatigue = 1 + Math.max(0, P.rally - 6) * 0.07
  const e = (aim.err ?? 1) * fatigue * (0.7 + d * 0.22 + (p.moving ? 0.6 : 0) + (kind === 'smash' ? 0.8 : 0) + (kind === 'lob' ? 0.2 : 0))
  xt += gauss() * e * 1.1; yt += gauss() * e * 1.4
  if (!p.human) {
    // unforced errors: grow with rally length, fewer on harder levels
    const miss = (0.02 + Math.max(0, P.rally - 6) * 0.014) * [1.8, 1.35, 1][P.cfg.diff - 1]
    if (Math.random() < miss) { if (Math.random() < 0.5) xt += o * R(10, 22); else yt += (Math.random() < 0.5 ? -1 : 1) * R(18, 30) }
  }
  solveShot(B, xt, yt, vh, kind === 'smash' ? -30 : 4)
  B.lastHit = p.team; B.hitCount++; B.bounces = [0, 0]; B.serve = false; B.t = 0; B.lastHitter = p; B.held = false
  P.rally++
  if ([10, 15, 20, 30].includes(P.rally)) { popup(0, 22, `${P.rally} SHOT RALLY!`, [1, 0.9, 0.3]); sfx('crowd'); ring(0, 0, 40, 60, COLS.fire); speak(`${P.rally} shot rally!`, 0.8, 1.1) }
  p.swingT = 0.28; p.swingK = kind
  sfx(kind === 'smash' ? 'smash' : 'paddle')
  part(B.x, B.y + B.h * 0.4, 0, 0, 0.18, COLS.fire[1], 1.5)
  if (kind === 'smash') { shake(0.8); ring(B.x, B.y, 14, 30, COLS.fire) }
  if (P.rally === 10 || P.rally === 20) { popup(0, 22, String(P.rally), [1, 0.9, 0.3]); sfx('ding', 12) }
}
function solveShot(B, xt, yt, vh0, minVh) {
  let vh = vh0, T = 1, vx = 0, vy = 0
  for (let i = 0; i < 28; i++) {
    T = (vh + Math.sqrt(vh * vh + 2 * GR * B.h)) / GR
    vx = (xt - B.x) / T; vy = (yt - B.y) / T
    if (Math.sign(B.x) === Math.sign(xt)) break
    const tn = T * (Math.abs(B.x) / Math.max(1e-3, Math.abs(xt - B.x)))
    const hn = B.h + vh * tn - 0.5 * GR * tn * tn
    if (hn >= NETH + 1.5) break
    vh += 2.5
  }
  B.vx = vx; B.vy = vy; B.vh = vh
}

function serve(p, aim = {}) {
  const B = P.B, o = os(p.team)
  const tx = o * clamp(R(K + 6, CX - 5) - (aim.short || 0) * 5, K + 2, CX - 2), ty = B.serveSign * clamp(aim.ty !== undefined ? aim.ty : R(5, 16), 2, CY - 2)
  const e = (aim.err ?? 1) * 0.9
  solveShot(B, tx + gauss() * e, ty + gauss() * e * 1.2, 30, 4)
  B.held = false; B.live = true; B.serve = true; B.lastHit = p.team; B.hitCount = 1; B.bounces = [0, 0]; B.t = 0; B.lastHitter = p
  P.phase = 'rally'; P.rally = 1; P.msg = null
  p.swingT = 0.3; p.swingK = 'serve'
  sfx('paddle'); speak(P.call.replaceAll('-', ', '), 0.7, 1.15)
}

function tryHit(p, type, aim) {
  const B = P.B
  if (P.phase !== 'rally' || !B || !B.live || B.held) return false
  if (B.lastHit === p.team) return false
  const d = Math.hypot(B.x - p.x, B.y - p.y)
  if (d > REACH || B.h > 11) return false
  if ((B.x < 0 ? 0 : 1) !== p.team && Math.abs(B.x) > 2) return false
  const volley = B.bounces[p.team] === 0
  if (B.hitCount <= 2 && volley) { fault(p.team, 'TWO-BOUNCE RULE'); return true }
  if (volley && Math.abs(p.x) < K) { fault(p.team, 'KITCHEN VOLLEY'); return true }
  launch(p, type, aim)
  return true
}

function bounce() {
  const B = P.B
  B.h = 0
  const inb = Math.abs(B.x) <= CX + 0.6 && Math.abs(B.y) <= CY + 0.6
  const side = B.x < 0 ? 0 : 1
  sfx('bounce'); part(B.x, B.y, 0, 0, 0.15, COLS.cyan[0], 1.1)
  if (B.live) {
    if (B.serve) {
      const st = P.serveTeam
      if (side === st) fault(st, 'SERVE NET')
      else if (!inb) fault(st, 'SERVE OUT')
      else if (Math.abs(B.x) < K) fault(st, 'SERVE IN KITCHEN')
      else if (Math.sign(B.y) !== B.serveSign) fault(st, 'WRONG SERVICE COURT')
      else { B.serve = false; B.bounces[side] = 1 }
    } else if (side === B.lastHit) fault(B.lastHit, 'NO CROSS')
    else if (B.bounces[side] >= 1) endRally(B.lastHit, 'WINNER')
    else if (!inb) fault(B.lastHit, 'OUT')
    else B.bounces[side] = 1
  }
  B.vh = -B.vh * 0.7
  if (B.vh < 6) B.vh = 0
  B.vx *= 0.62; B.vy *= 0.62
}
function stepBall(dt) {
  const B = P.B
  if (!B) return
  if (B.held) { const s = serverPlayer(); B.x = s.x + os(s.team) * 1.6; B.y = s.y; B.h = 3 + Math.sin(P.t * 4) * 0.3; return }
  B.t += dt
  B.vh -= GR * dt
  const px = B.x
  B.x += B.vx * dt; B.y += B.vy * dt; B.h += B.vh * dt
  if (B.live && ((px < 0 && B.x >= 0) || (px > 0 && B.x <= 0))) {
    const f = Math.abs(px) / Math.max(1e-3, Math.abs(B.x - px))
    const hc = B.h - B.vh * dt * (1 - f)
    const nh = NETH + (Math.abs(B.y) / CY) * 0.3
    if (Math.abs(B.y) <= CY + 2 && hc < nh) {
      B.x = 0; B.vx *= -0.12; B.vy *= 0.3
      sfx('net'); shake(0.4); part(0, B.y, 0, 0, 0.2, COLS.cyan[0], 1.5)
      fault(B.lastHit, B.serve ? 'SERVE NET' : 'NET')
    }
  }
  if (B.h <= 0 && B.vh < 0) bounce()
  if (B.live && B.t > 9) fault(B.lastHit, 'DEAD BALL')
  if (Math.abs(B.x) > 70 || Math.abs(B.y) > 45) B.vx = B.vy = 0
  P.trail.push({ x: B.x, y: B.y + B.h * 0.45 })
  if (P.trail.length > 9) P.trail.shift()
}

// ---------- humans ----------
function inputFor(h) {
  const two = P.pl.some((p) => p.human === 2)
  const arrows = h === 2 || !two
  const wasd = h === 1
  const up = (wasd && keys.KeyW) || (arrows && keys.ArrowUp), dn = (wasd && keys.KeyS) || (arrows && keys.ArrowDown)
  const lf = (wasd && keys.KeyA) || (arrows && keys.ArrowLeft), rt = (wasd && keys.KeyD) || (arrows && keys.ArrowRight)
  return { mx: (rt ? 1 : 0) - (lf ? 1 : 0), my: (up ? 1 : 0) - (dn ? 1 : 0) }
}
function aimFor(p) {
  const i = inputFor(p.human), o = os(p.team)
  const opp = teamOf(1 - p.team)
  const oy = opp.reduce((a, q) => a + q.y, 0) / opp.length
  const ty = i.my ? i.my * 15 : clamp(-oy * 0.7 + R(-3, 3), -15, 15)
  const fwd = i.mx * o
  return { ty, short: fwd > 0 ? 0.8 : fwd < 0 ? -0.6 : 0, err: 0.8 }
}
const SHOT_KEYS = {
  KeyF: [1, 'drive'], KeyG: [1, 'dink'], KeyH: [1, 'lob'], Space: [1, 'drive'], KeyJ: [1, 'drive'], KeyK: [1, 'dink'], KeyL: [1, 'lob'],
  Comma: [2, 'drive'], Period: [2, 'dink'], Slash: [2, 'lob'],
}
function onKey(code) {
  if (P.mode === 'idle') return
  if (code === 'Escape' || code === 'KeyP') { if (P.mode === 'play') { P.paused = !P.paused; sfx('ui'); emitP() } return }
  if (P.paused) { if (code === 'Enter') { P.paused = false; emitP() } return }
  if (P.mode === 'over' || P.over && P.phase === 'over') { if (code === 'Enter') start(P.cfg.type, P.cfg.diff, P.cfg.target); return }
  const sk = SHOT_KEYS[code]
  if (!sk) return
  const two = P.pl.some((p) => p.human === 2)
  let [who, type] = sk
  if ((code === 'KeyJ' || code === 'KeyK' || code === 'KeyL') && two) return
  if ((code === 'Comma' || code === 'Period' || code === 'Slash') && !two) who = 1
  const group = P.pl.filter((p) => p.human === who)
  if (!group.length) return
  if (P.phase === 'serve') {
    const srv = serverPlayer()
    if (srv.human === who && P.readyT <= 0.5) serve(srv, { ...aimFor(srv), err: type === 'dink' ? 0.6 : 1 })
    return
  }
  // pick the human-controlled player closest to the ball
  const B = P.B
  const p = group.reduce((a, q) => (Math.hypot(q.x - B.x, q.y - B.y) < Math.hypot(a.x - B.x, a.y - B.y) ? q : a), group[0])
  p.req = { type, t: 0.26 }
  p.swingT = Math.max(p.swingT, 0.22); p.swingK = type
}

// ---------- bots ----------
function botHome(p, B) {
  const o = os(p.team), own = -o
  const mates = teamOf(p.team)
  const doubles = mates.length > 1
  const lane = doubles ? (mates.indexOf(p) === 0 ? -1 : 1) : 0
  const mine = B.lastHit === p.team
  const front = (B.hitCount >= 2 && B.lastHit !== P.serveTeam) || B.hitCount >= 3 || P.phase === 'serve' && p.team !== P.serveTeam && mates.indexOf(p) !== 0
  const tx = own * (front ? K + 1.9 : CX - 6)
  const ty = doubles ? lane * 8 : B.y * 0.25
  return { tx: tx, ty: mine && !front ? ty : ty }
}
function botStep(p, dt) {
  const B = P.B, cfg = DIFF[P.cfg.diff - 1]
  const o = os(p.team), own = -o
  let tx = p.x, ty = p.y, spd = cfg.spd
  if (P.phase === 'point' || P.phase === 'over') { const h = botHome(p, B); tx = h.tx; ty = h.ty; spd *= 0.4 }
  else if (P.phase === 'serve') return
  else {
    const mates = teamOf(p.team)
    const myTurn = B.live && B.lastHit !== p.team
    if (myTurn) {
      const volleyOK = B.hitCount > 2
      const pred = B.bounces[p.team] === 0 ? predictLanding(B) : { x: B.x, y: B.y }
      const lx = (B.x < 0 ? 0 : 1) === p.team || Math.abs(B.x) < 3 ? pred.x : own * (CX - 6)
      const ly = pred.y
      const dist = (q) => Math.hypot(q.x - lx, q.y - ly) + (q.lane === Math.sign(ly) ? 0 : 1.5)
      const chaser = mates.reduce((a, q) => (dist(q) < dist(a) ? q : a), mates[0])
      if (chaser === p) {
        tx = lx + own * 1.2; ty = ly
        if (B.bounces[p.team] === 0 && !(volleyOK && B.h < 9)) tx = clamp(tx, own > 0 ? K + 0.8 : -CX - 5, own > 0 ? CX + 5 : -K - 0.8)
        if (B.bounces[p.team] === 0) { if (Math.abs(tx) < K + 0.8) tx = own * (K + 0.8) }
        const near = Math.hypot(B.x - p.x, B.y - p.y)
        const canSwing = near < REACH - 1 && B.h < 8 && ((B.bounces[p.team] >= 1) || (volleyOK && Math.abs(p.x) >= K + 0.5 && B.h > 1.5))
        if (canSwing) {
          p.swingDelay -= dt
          if (p.swingDelay <= 0) {
            const opp = teamOf(1 - p.team)
            const oAvg = opp.reduce((a, q) => a + q.y, 0) / opp.length
            const oNet = opp.some((q) => Math.abs(q.x) < K + 5)
            const nearNet = Math.abs(p.x) < K + 6
            let type = 'drive'
            const r = Math.random()
            if (B.h > 6.5 && Math.abs(p.x) < 30) type = r < cfg.smash ? 'drive' : 'dink'
            else if (nearNet) type = r < 0.65 ? 'dink' : 'drive'
            else if (B.hitCount === 2) type = r < 0.6 ? 'dink' : 'drive'
            else if (oNet && r < 0.3) type = 'lob'
            else type = r < 0.82 ? 'drive' : 'dink'
            const ty2 = clamp(-oAvg * 0.9 + R(-6, 6), -16, 16)
            const ok = tryHit(p, type, { ty: ty2, err: cfg.err })
            p.swingDelay = ok ? cfg.react : 0.05
          }
        } else p.swingDelay = cfg.react * (0.6 + Math.random() * 0.8)
      } else { const h = botHome(p, B); tx = h.tx; ty = h.ty }
    } else { const h = botHome(p, B); tx = h.tx; ty = h.ty }
  }
  moveToward(p, tx, ty, spd, dt)
}
function moveToward(p, tx, ty, spd, dt) {
  const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy)
  const k = d > 0.4 ? Math.min(1, d / 3) : 0
  p.vx += ((dx / (d || 1)) * spd * k - p.vx) * Math.min(1, dt * 12)
  p.vy += ((dy / (d || 1)) * spd * k - p.vy) * Math.min(1, dt * 12)
}

// ---------- main step ----------
function play(dt) {
  P.t += dt
  const B = P.B
  P.readyT -= dt
  for (const p of P.pl) {
    p.swingT = Math.max(0, p.swingT - dt)
    if (p.human) {
      const i = inputFor(p.human), len = Math.hypot(i.mx, i.my) || 1
      const sp = 30
      if (P.phase !== 'serve') {
        p.vx += ((i.mx / len) * sp - p.vx) * Math.min(1, dt * 14)
        p.vy += ((i.my / len) * sp - p.vy) * Math.min(1, dt * 14)
      } else { p.vx = p.vy = 0 }
      if (p.req) {
        if (tryHit(p, p.req.type, aimFor(p))) p.req = null
        else { p.req.t -= dt; if (p.req.t <= 0) p.req = null }
      }
    } else botStep(p, dt)
    p.x += p.vx * dt; p.y += p.vy * dt
    p.moving = Math.hypot(p.vx, p.vy) > 6
    p.anim += dt * Math.hypot(p.vx, p.vy) * 0.35
    const lo = p.team === 0 ? -CX - 6 : 1.8, hi = p.team === 0 ? -1.8 : CX + 6
    p.x = clamp(p.x, lo, hi); p.y = clamp(p.y, -CY - 5, CY + 5)
  }
  if (P.phase === 'serve') {
    const srv = serverPlayer()
    if (!srv.human && P.readyT <= -0.2 - R(0, 0.5)) {
      const cfg = DIFF[P.cfg.diff - 1]
      serve(srv, { err: cfg.err, ty: R(5, 16) })
    }
    stepBall(dt)
  } else {
    stepBall(dt)
    if (P.phase === 'point') {
      P.pointT -= dt
      if (P.pointT <= 0) {
        if (P.over) { P.mode = 'over'; P.phase = 'over'; music.stop(); emitP(); return }
        placeForServe()
      }
    }
  }
  stepParticles(dt)
}
function update(dtRaw) {
  const dt = Math.min(dtRaw, 0.04)
  if (P.mode === 'idle') return
  if (P.mode === 'play' && !P.paused) play(dt)
  else if (P.mode === 'over') stepParticles(dt)
  P.emitT -= dt
  if (P.emitT <= 0) { P.emitT = 0.07; emitP() }
}
export const pickleActions = {
  pause() { if (P.mode === 'play' && !P.paused) { P.paused = true; emitP(); return true } return false },
  start, stop, quit() { toMenu() }, resume() { P.paused = false; emitP() },
  rematch() { start(P.cfg.type, P.cfg.diff, P.cfg.target) },
}

// ---------- rendering ----------
const cc = {}
const lc = (hex) => cc[hex] || (cc[hex] = rgb(hex))
const hash = (a, b) => Math.abs(Math.sin(a * 12.9898 + b * 78.233) * 43758.5453) % 1
function draw(api) {
  const { put } = api
  const B = P.B, t = G.time
  const col = (hex, k = 1) => { const c = lc(hex); return [c[0] * k, c[1] * k, c[2] * k] }
  // floor
  for (let cx = -49; cx <= 49; cx += 2) {
    for (let cy = -27; cy <= 27; cy += 2) {
      const inCourt = Math.abs(cx) < CX && Math.abs(cy) < CY
      const kitchen = inCourt && Math.abs(cx) < K
      const v = 0.9 + hash(cx, cy) * 0.2
      const c = inCourt ? col(kitchen ? '#1c8a86' : '#2a5fb8', v * 1.15) : col('#1d4d2f', v * 1.1)
      put(cx, cy, -1.5, 2.02, 2.02, c[0], c[1], c[2])
    }
  }
  // lines
  const L = (x, y) => put(x, y, -0.6, 1.05, 1.05, 2.3, 2.3, 2.3)
  for (let y = -CY; y <= CY; y += 1) { L(-CX, y); L(CX, y); L(-K, y); L(K, y) }
  for (let x = -CX; x <= CX; x += 1) { L(x, -CY); L(x, CY) }
  for (let x = K; x <= CX; x += 1) { L(x, 0); L(-x, 0) }
  // net
  for (let y = -CY - 2; y <= CY + 2; y += 1) {
    const top = Math.floor(y) % 2 === 0
    put(0, y, 1.8, 1.1, 1.05, top ? 1.8 : 1.2, top ? 1.8 : 1.2, top ? 1.8 : 1.2)
    put(0, y, 3.2, 1.2, 1.05, 2.6, 2.6, 2.6)
  }
  for (const s of [-1, 1]) put(0, s * (CY + 2.3), 2.4, 1.8, 1.8, 2.4, 2.0, 0.4)
  if (!B) return
  // serve target highlight
  if (P.phase === 'serve' && B.held) {
    const o = os(P.serveTeam), pulse = 0.6 + 0.4 * Math.sin(t * 6)
    for (let x = K; x <= CX; x += 2) for (const y of [0, B.serveSign * CY]) put(o * x, y + (y === 0 ? B.serveSign * 0.6 : -B.serveSign * 0.6), -0.4, 1.1, 1.1, 0.4 * pulse, 2.4 * pulse, 0.8 * pulse)
  }
  // players
  const sorted = P.pl.slice().sort((a, b) => b.y - a.y)
  for (const p of sorted) {
    const o = os(p.team)
    const base = p.team === 0 ? (p.human ? '#3de8ff' : '#6aa8ff') : (p.human ? '#ff4de1' : '#ff8ab8')
    const sh = col(base, 1.4), dark = col('#20242c', 1)
    // shadow
    put(p.x, p.y - 1.4, -0.3, 5.4, 2.4, 0.03, 0.03, 0.06)
    const bob = Math.sin(p.anim) * 0.35
    // legs
    const lg = Math.sin(p.anim * 1.7) * 0.9
    put(p.x - 0.9, p.y - 1.2 + lg, 0.5, 1.3, 1.8, dark[0], dark[1], dark[2]); put(p.x + 0.9, p.y - 1.2 - lg, 0.5, 1.3, 1.8, dark[0], dark[1], dark[2])
    // torso + head
    put(p.x, p.y + 0.5 + bob, 1.4, 4.2, 3.2, sh[0], sh[1], sh[2])
    put(p.x - o * 0.2, p.y + 2.6 + bob, 2.4, 2.3, 2.3, 2.0, 1.55, 1.2)
    put(p.x, p.y + 3.2 + bob, 3.0, 2.4, 1.0, dark[0] * 2, dark[1] * 2, dark[2] * 2)
    // paddle (swing arc)
    const sw = p.swingT > 0 ? 1 - p.swingT / 0.28 : 0
    const ang = p.swingT > 0 ? (-1.1 + sw * 2.2) : -0.5
    const px = p.x + o * (3 + Math.cos(ang) * 1.6), py = p.y + 0.8 + Math.sin(ang) * 3.2
    const pc = p.swingT > 0 ? [2.6, 1.6, 0.3] : [2.0, 0.5, 0.4]
    put(px, py, 2.4, 2.4, 3.0, pc[0], pc[1], pc[2])
    put(px - o * 0.8, py - 1.8, 2.4, 0.9, 1.4, 0.4, 0.3, 0.2)
    if (p.human) for (const q of api.text(String(p.human))) put(p.x + q.x * 0.8, p.y + 7 + q.y * 0.8, 3, 0.7, 0.7, 2.4, 2.4, 2.4)
    if (P.phase === 'serve' && serverPlayer() === p) { for (let i = 0; i < 18; i++) { const a = (i / 18) * 6.28 + t * 2; put(p.x + Math.cos(a) * 5.5, p.y + Math.sin(a) * 4.5, 0.2, 0.7, 0.7, 2.4, 2.2, 0.4) } }
  }
  // ball: trail, shadow, ball
  P.trail.forEach((q, i) => { const f = (i + 1) / P.trail.length; put(q.x, q.y, 2.5, 0.9 * f, 0.9 * f, 1.4 * f, 2.2 * f, 0.4 * f) })
  const sc = 1 + B.h * 0.035
  put(B.x, B.y, -0.2, 2.2 * sc * 0.9, 1.4, 0.02, 0.02, 0.04)
  const by = B.y + B.h * 0.45
  put(B.x, by, 3.4 + B.h * 0.1, 2.6 * sc, 2.6 * sc, 3.0, 3.4, 0.7)
  for (const [dx, dy] of [[-0.5, 0.3], [0.5, -0.3], [0, -0.6]]) put(B.x + dx * sc, by + dy * sc, 4.4 + B.h * 0.1, 0.5, 0.5, 0.8, 0.9, 0.1)
  for (const q of G.parts) { const f = q.life / q.max; put(q.x, q.y, 4, q.s * (0.35 + 0.65 * f) * 0.9, q.s * (0.35 + 0.65 * f) * 0.9, q.c[0] * 1.6, q.c[1] * 1.6, q.c[2] * 1.6) }
  api.pops(G.pops, 0)
}
if (typeof window !== 'undefined') { window.__P = P; window.__pickle = pickleActions }
games.pickle = { update, onKey, draw, stop, sky: () => '#0a1a14' }
