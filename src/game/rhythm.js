// NEON BEAT: a 4-lane rhythm game. 5 generated songs, hold notes, combos and grades.
// Keys D F J K (or the arrow keys) / touch the lanes. Hit the notes as they cross the line.
import { G, emit as engineEmit, keys, games, profile, saveProfile, recordScore, part, ring, shake, flash, stepParticles, toMenu } from './engine.js'
import { sfx, music } from './audio.js'
import { col, disk, circle, rect, clamp, R, rng } from './pxl.js'
import { drawRhythm3, rhythmCam, rhythmLights } from './arcade3d.js'

export const SONGS = [
  { id: 0, name: 'NEON DAWN', bpm: 100, bars: 28, lvl: 1, color: '#3de8ff', seed: 11, dens: 0.45, root: 45 },
  { id: 1, name: 'PIXEL RUSH', bpm: 120, bars: 32, lvl: 2, color: '#6aff9a', seed: 23, dens: 0.58, root: 43 },
  { id: 2, name: 'VOID DRIVE', bpm: 135, bars: 36, lvl: 3, color: '#c58aff', seed: 37, dens: 0.7, root: 40 },
  { id: 3, name: 'STAR RIDER', bpm: 150, bars: 40, lvl: 4, color: '#ffd23a', seed: 41, dens: 0.8, root: 47 },
  { id: 4, name: 'OVERCLOCK', bpm: 172, bars: 44, lvl: 5, color: '#ff4a8a', seed: 53, dens: 0.92, root: 42 },
]
const LANE_KEYS = [['KeyD', 'ArrowLeft'], ['KeyF', 'ArrowDown'], ['KeyJ', 'ArrowUp'], ['KeyK', 'ArrowRight']]
const LANE_COL = ['#ff4a8a', '#3de8ff', '#6aff9a', '#ffd23a']
const WIN = { perfect: 0.055, great: 0.1, good: 0.15 }
const PTS = { perfect: 300, great: 200, good: 100 }
const PROG = [0, -4, -2, -5]
const SCALE = [0, 3, 5, 7, 10, 12, 15]
export const LANE_Y = -18, TOP_Y = 28, FALL = 1.55

export function buildChart(song) {
  const r = rng(song.seed * 977), spb = 60 / song.bpm, slot = spb / 4
  const notes = []
  let prev = 1, busyUntil = [0, 0, 0, 0]
  for (let bar = 0; bar < song.bars; bar++) {
    // song structure: quiet intro, build, drop, breakdown, finale
    const f = bar / song.bars
    const sect = bar < 4 ? 0.35 : f < 0.4 ? 0.75 : f < 0.5 ? 0.45 : f < 0.9 ? 1 : 0.85
    const d = song.dens * sect
    for (let s = 0; s < 16; s++) {
      const t0 = 2 + (bar * 16 + s) * slot
      if (bar === song.bars - 1 && s > 8) break
      const p = s % 4 === 0 ? 0.55 + d * 0.45 : s % 4 === 2 ? d * 0.62 : d * (song.lvl >= 2 ? 0.28 : 0.1)
      if (r() > p) continue
      let lane = (prev + [1, -1, 2, -2, 1, -1, 0][(r() * (song.lvl > 2 ? 7 : 6)) | 0] + 8) % 4
      if (busyUntil[lane] > t0 - 0.01) { lane = [0, 1, 2, 3].find((l) => busyUntil[l] <= t0 - 0.01); if (lane === undefined) continue }
      const hold = s % 4 === 0 && r() < 0.07 + song.lvl * 0.012 && bar > 3
      const len = hold ? slot * (r() < 0.5 ? 4 : 8) : 0
      notes.push({ t: t0, lane, len, hit: false, miss: false, held: false, id: notes.length })
      busyUntil[lane] = t0 + len + slot * 0.8
      prev = lane
      // chords on strong beats of hard songs
      if (song.lvl >= 3 && s % 8 === 0 && r() < 0.06 + (song.lvl - 3) * 0.05 && sect >= 0.85) {
        const l2 = [0, 1, 2, 3].filter((l) => l !== lane && busyUntil[l] <= t0)[(r() * 3) | 0]
        if (l2 !== undefined) { notes.push({ t: t0, lane: l2, len: 0, hit: false, miss: false, held: false, id: notes.length }); busyUntil[l2] = t0 + slot }
      }
    }
  }
  notes.sort((a, b) => a.t - b.t)
  return notes
}

export const RT = { mode: 'idle', paused: false, song: 0, notes: [], st: -2, score: 0, combo: 0, maxCombo: 0, counts: { perfect: 0, great: 0, good: 0, miss: 0 }, life: 1, over: null, fx: [], judge: null, holds: [null, null, null, null], down: [false, false, false, false], flashL: [0, 0, 0, 0], emitT: 0, lastSlot: -9999, pulse: 0, total: 0, end: 0, speed: 1, fail: false }
let snap = null
const subs = new Set()
export const subscribeRhythm = (f) => { subs.add(f); return () => subs.delete(f) }
export const getRhythmSnap = () => snap
function emitR() {
  const done = RT.counts.perfect + RT.counts.great + RT.counts.good + RT.counts.miss
  snap = { mode: RT.mode, paused: RT.paused, song: RT.song, name: SONGS[RT.song].name, score: Math.round(RT.score), combo: RT.combo, maxCombo: RT.maxCombo, life: RT.life, acc: done ? accuracy() : 1, judge: RT.judge ? { ...RT.judge } : null, over: RT.over, prog: clamp((RT.st - 2) / (RT.end - 2), 0, 1), counts: { ...RT.counts }, lead: RT.st < 2 ? Math.max(0, 2 - RT.st) : 0 }
  subs.forEach((f) => f())
}
function accuracy() { const c = RT.counts, n = c.perfect + c.great + c.good + c.miss || 1; return (c.perfect + c.great * 0.75 + c.good * 0.4) / n }
// the arena is always 100 units wide (the stage keeps a 16:9 shape), so lanes are a fixed width
export function laneGeom() { return { lw: 14, vis: 100 } }
function start(cfg = {}) {
  const s = SONGS[clamp(cfg.song | 0, 0, SONGS.length - 1)]
  RT.song = s.id; RT.notes = buildChart(s); RT.st = -2; RT.score = 0; RT.combo = 0; RT.maxCombo = 0; RT.counts = { perfect: 0, great: 0, good: 0, miss: 0 }; RT.life = 1; RT.over = null
  RT.fx = []; RT.judge = null; RT.holds = [null, null, null, null]; RT.down = [false, false, false, false]; RT.lastSlot = -9999; RT.paused = false; RT.fail = false
  RT.total = RT.notes.length; RT.end = (RT.notes.length ? RT.notes[RT.notes.length - 1].t + RT.notes[RT.notes.length - 1].len : 10) + 2.5
  G.mode = 'rhythm'; engineEmit(); G.parts = []; G.pops = []; G.shake = 0; G.flash = 0
  RT.mode = 'play'
  music.stop(); sfx('mission'); emitR()
}
function stop() { RT.mode = 'idle'; RT.paused = false; music.set('menu'); emitR() }
function judgeText(j, lane) { RT.judge = { text: j.toUpperCase(), c: j === 'perfect' ? '#ffe84a' : j === 'great' ? '#6aff9a' : j === 'good' ? '#6ac8ff' : '#ff5a6a', t: 0.5 }; void lane }
function hit(n, j) {
  n.hit = true
  RT.counts[j]++
  RT.combo++; RT.maxCombo = Math.max(RT.maxCombo, RT.combo)
  RT.score += PTS[j] * (1 + Math.min(RT.combo, 100) / 40)
  RT.life = Math.min(1, RT.life + (j === 'good' ? 0.01 : 0.025))
  judgeText(j, n.lane)
  sfx(j === 'good' ? 'rtGood' : 'rtPerfect', n.lane)
  const c = col(LANE_COL[n.lane]), g = laneGeom()
  const x = (n.lane - 1.5) * g.lw
  RT.flashL[n.lane] = 0.2
  for (let i = 0; i < (j === 'perfect' ? 10 : 5); i++) part(x, LANE_Y, R(-22, 22), R(6, 30), R(0.2, 0.5), c, R(0.8, 1.5))
  if (j === 'perfect') ring(x, LANE_Y, 10, 24, [c])
  if (RT.combo > 0 && RT.combo % 25 === 0) { flash(0.12, [1, 1, 1]); shake(0.3) }
}
function missNote(n) {
  n.miss = true; RT.counts.miss++
  if (RT.combo >= 10) sfx('rtMiss')
  RT.combo = 0; RT.life = Math.max(0, RT.life - 0.09)
  judgeText('miss', n.lane)
  if (RT.life <= 0 && !RT.fail) { RT.fail = true }
}
function press(lane) {
  if (RT.mode !== 'play' || RT.paused || RT.st < 0.3) return
  RT.down[lane] = true
  let best = null
  for (const n of RT.notes) {
    if (n.lane !== lane || n.hit || n.miss) continue
    const dt = n.t - RT.st
    if (dt > WIN.good + 0.02) break
    if (Math.abs(dt) <= WIN.good && (!best || Math.abs(dt) < Math.abs(best.t - RT.st))) best = n
  }
  RT.flashL[lane] = Math.max(RT.flashL[lane], 0.1)
  if (!best) { sfx('rtHat'); return }
  const d = Math.abs(best.t - RT.st)
  const j = d <= WIN.perfect ? 'perfect' : d <= WIN.great ? 'great' : 'good'
  hit(best, j)
  if (best.len > 0) RT.holds[lane] = best
}
function release(lane) {
  RT.down[lane] = false
  const h = RT.holds[lane]
  if (h) {
    RT.holds[lane] = null
    if (RT.st < h.t + h.len - 0.12) { h.broken = true; RT.combo = 0; RT.life = Math.max(0, RT.life - 0.05); judgeText('miss', lane) }
    else { RT.score += 150; h.held = true }
  }
}
function update(dtRaw) {
  const dt = Math.min(dtRaw, 0.05)
  if (RT.mode === 'idle' || RT.paused) return
  if (RT.mode === 'over') { stepParticles(dt); return }
  RT.st += dt
  RT.pulse = Math.max(0, RT.pulse - dt * 3)
  if (RT.judge) { RT.judge.t -= dt; if (RT.judge.t <= 0) RT.judge = null }
  for (let i = 0; i < 4; i++) RT.flashL[i] = Math.max(0, RT.flashL[i] - dt)
  // keyboard held state -> press/release edges (so holds work)
  for (let l = 0; l < 4; l++) {
    const k = !!(keys[LANE_KEYS[l][0]] || keys[LANE_KEYS[l][1]])
    if (k && !RT.down[l]) press(l)
    else if (!k && RT.down[l] && !RT.touchDown) release(l)
  }
  // holds scoring + missed notes
  for (const h of RT.holds) if (h && RT.st >= h.t + h.len) { RT.score += 150; h.held = true; RT.holds[h.lane] = null }
  for (const n of RT.notes) {
    if (n.hit || n.miss) continue
    if (n.t - RT.st < -WIN.good) missNote(n)
    else if (n.t - RT.st > 2) break
  }
  // backing track on a 16th grid
  const s = SONGS[RT.song], slotT = 60 / s.bpm / 4
  const slot = Math.floor((RT.st - 2) / slotT)
  while (RT.lastSlot < slot && RT.st > 1.3) {
    RT.lastSlot++
    const sl = RT.lastSlot, bar = Math.floor(sl / 16), k = ((sl % 16) + 16) % 16
    if (sl < -4) continue
    if (k === 0 || k === 8 || (s.lvl >= 3 && (k === 6 || k === 14))) { sfx('rtKick'); if (k % 4 === 0) RT.pulse = 1 }
    if (k === 4 || k === 12) sfx('rtSnare')
    if (k % 2 === 0) sfx('rtHat')
    const root = s.root + PROG[((bar % 4) + 4) % 4]
    if (k === 0 || k === 6 || k === 10 || (s.lvl >= 4 && k === 14)) sfx('rtBass', root)
    if (bar >= 4 && (k === 2 || k === 7 || k === 11 || k === 15) && (bar % 8) >= 2) sfx('rtLead', root + 24 + SCALE[(bar * 3 + k) % SCALE.length])
  }
  if (RT.fail || RT.st > RT.end) return finish(!RT.fail)
  stepParticles(dt)
  RT.emitT -= dt
  if (RT.emitT <= 0) { RT.emitT = 0.08; emitR() }
}
function gradeOf(acc, clear) { return !clear ? 'F' : acc >= 0.95 ? 'S' : acc >= 0.88 ? 'A' : acc >= 0.75 ? 'B' : acc >= 0.6 ? 'C' : 'D' }
function finish(clear) {
  RT.mode = 'over'
  const acc = accuracy(), g = gradeOf(acc, clear), fc = RT.counts.miss === 0 && clear
  const score = Math.round(RT.score + (fc ? 5000 : 0))
  RT.over = { clear, grade: g, acc, score, maxCombo: RT.maxCombo, counts: { ...RT.counts }, fc, name: SONGS[RT.song].name, total: RT.total }
  profile.rhythmPlays = (profile.rhythmPlays || 0) + 1
  profile.rhythmNotes = (profile.rhythmNotes || 0) + RT.counts.perfect + RT.counts.great + RT.counts.good
  profile.rhythmBest = profile.rhythmBest || {}
  profile.rhythmBest[RT.song] = Math.max(profile.rhythmBest[RT.song] || 0, score)
  if (fc) profile.rhythmFC = (profile.rhythmFC || 0) + 1
  recordScore('rhythm', score); saveProfile()
  sfx(clear ? 'win' : 'over')
  emitR()
}
function onKey(code) {
  if (RT.mode === 'idle') return
  if (code === 'Escape' || code === 'KeyP') { if (RT.mode === 'play') { RT.paused = !RT.paused; emitR() } return }
  if (RT.paused) return
  if (RT.mode === 'over' && code === 'Enter') rhythmActions.rematch()
}
export const rhythmActions = {
  start, stop, quit() { toMenu() },
  resume() { RT.paused = false; emitR() },
  pause() { if (RT.mode === 'play' && !RT.paused) { RT.paused = true; emitR(); return true } return false },
  rematch() { start({ song: RT.song }) },
  press(l) { RT.touchDown = true; press(l) },
  release(l) { release(l); if (!RT.down.some(Boolean)) RT.touchDown = false },
}
function draw(api) {
  const { put } = api, g = laneGeom(), lw = g.lw, s = SONGS[RT.song]
  const sc = col(s.color)
  const pulse = RT.pulse
  rect(put, -g.vis / 2 - 2, -29, g.vis / 2 + 2, 29, col('#05060f'), 1, -3.4, 2)
  // background pulse
  for (let i = -6; i <= 6; i++) { const k = 0.008 + pulse * 0.03; put(i * 8, 0, -3.2, 2 + pulse * 2, 60, sc[0] * k, sc[1] * k, sc[2] * k) }
  const x0 = -2 * lw
  for (let l = 0; l < 4; l++) {
    const cx = (l - 1.5) * lw, c = col(LANE_COL[l]), fl = RT.flashL[l]
    rect(put, cx - lw / 2 + 0.3, -26, cx + lw / 2 - 0.3, 28, col('#0b1226'), 1 + fl * 2, -3, 1.2)
    for (let y = -26; y <= 28; y += 3) put(cx - lw / 2, y, -2.8, 0.3, 2.2, 0.25, 0.3, 0.55)
    // hit zone
    for (let u = -lw / 2 + 0.8; u <= lw / 2 - 0.7; u += 0.9) put(cx + u, LANE_Y, -2, 1, 1, c[0] * (0.5 + fl * 4), c[1] * (0.5 + fl * 4), c[2] * (0.5 + fl * 4))
    if (RT.down[l]) for (let y = LANE_Y; y < LANE_Y + 14; y += 1) put(cx, y, -2.4, lw - 0.8, 1.1, c[0] * 0.35 * (1 - (y - LANE_Y) / 14), c[1] * 0.35 * (1 - (y - LANE_Y) / 14), c[2] * 0.35 * (1 - (y - LANE_Y) / 14))
  }
  void x0
  // notes
  const speedY = (TOP_Y - LANE_Y) / FALL
  for (const n of RT.notes) {
    const dt = n.t - RT.st
    if (dt > FALL + 0.1) break
    const cx = (n.lane - 1.5) * lw, c = col(LANE_COL[n.lane])
    const y = LANE_Y + dt * speedY
    if (n.len > 0) {
      const ye = LANE_Y + (dt + n.len) * speedY, held = RT.holds[n.lane] === n
      const y0 = held ? LANE_Y : y
      if (!n.miss || held) for (let yy = Math.max(LANE_Y, y0); yy <= Math.min(30, ye); yy += 0.9) put(cx, yy, -1, lw * 0.34, 1.1, c[0] * (held ? 1.6 : 0.8), c[1] * (held ? 1.6 : 0.8), c[2] * (held ? 1.6 : 0.8))
      if (n.hit && !held && !n.held && !n.broken && dt + n.len < 0) continue
    }
    if (n.hit && n.len === 0) continue
    if (n.hit && n.len > 0) continue
    if (n.miss) { for (let u = -lw * 0.35; u <= lw * 0.35; u += 0.9) put(cx + u, y, 0, 1, 1.4, 0.35, 0.35, 0.35); continue }
    for (let u = -lw * 0.38; u <= lw * 0.38; u += 0.85) { put(cx + u, y, 0, 1, 1.5, c[0] * 1.5, c[1] * 1.5, c[2] * 1.5); put(cx + u, y + 0.8, 0.1, 1, 0.6, 2, 2, 2) }
  }
  // progress bar and life
  const prog = clamp((RT.st - 2) / (RT.end - 2), 0, 1)
  for (let i = 0; i < 40; i++) put(-g.vis / 2 + 2 + (i / 40) * (g.vis - 4), 27, 0, 0.9, 0.5, i / 40 < prog ? sc[0] * 1.5 : 0.2, i / 40 < prog ? sc[1] * 1.5 : 0.2, i / 40 < prog ? sc[2] * 1.5 : 0.3)
  // combo
  if (RT.combo >= 5 && api.text) { const px = api.text(String(RT.combo)); const w = Math.max(...px.map((p) => p.x), 0); for (const p of px) put(p.x * 1.6 - (w * 1.6) / 2, 6 + p.y * 1.6, 0.6, 1.4, 1.4, 1.6, 1.6, 1.8) }
  if (RT.judge && api.text) { const px = api.text(RT.judge.text); const c = col(RT.judge.c), w = Math.max(...px.map((p) => p.x), 0), k = 1 + Math.max(0, RT.judge.t - 0.4) * 5; for (const p of px) put(p.x * 0.9 * k - (w * 0.9 * k) / 2, -8 + p.y * 0.9 * k, 0.8, 0.9 * k, 0.9 * k, c[0] * 2, c[1] * 2, c[2] * 2) }
  for (const q of G.parts) { const f = q.life / q.max; put(q.x, q.y, 1, q.s * (0.35 + 0.65 * f) * 0.9, q.s * (0.35 + 0.65 * f) * 0.9, q.c[0] * 1.8, q.c[1] * 1.8, q.c[2] * 1.8) }
  void disk; void circle
}
if (typeof window !== 'undefined') { window.__RT = RT; window.__rhythm = rhythmActions }
games.rhythm = { update, onKey, draw() {}, draw3: (api) => drawRhythm3(api, RT, { SONGS, LANE_COL, LANE_Y, TOP_Y, FALL }), camera: () => rhythmCam(RT), lights: () => rhythmLights(RT, SONGS[RT.song].color), stop, sky: () => '#03040a' }
