// MINE SWEEP: classic minesweeper with a flag mode for phones, safe first click, chording and a timer.
import { G, emit as engineEmit, games, profile, saveProfile, recordScore, toMenu } from './engine.js'
import { sfx, music } from './audio.js'

export const LV = [{ name: 'EASY', w: 9, h: 9, m: 10, mult: 1 }, { name: 'MEDIUM', w: 12, h: 12, m: 25, mult: 1.6 }, { name: 'HARD', w: 16, h: 14, m: 40, mult: 2.4 }]
export const MS = { mode: 'idle', lv: 0, cells: [], w: 9, h: 9, mines: 10, placed: false, flags: 0, open: 0, t0: 0, secs: 0, state: 'ready', flagMode: false, over: null }
let snap = null
const subs = new Set()
export const subscribeMines = (f) => { subs.add(f); return () => subs.delete(f) }
export const getMinesSnap = () => snap
function emitM() { snap = { mode: MS.mode, w: MS.w, h: MS.h, mines: MS.mines, flags: MS.flags, secs: MS.secs, state: MS.state, flagMode: MS.flagMode, over: MS.over, lv: MS.lv, cells: MS.cells.map((c) => (c.o ? (c.m ? 'M' : String(c.n)) : c.f ? 'F' : '.')), boom: MS.boom }; subs.forEach((f) => f()) }
function start(cfg = {}) {
  const l = LV[cfg.lv | 0] || LV[0]
  MS.lv = LV.indexOf(l); MS.w = l.w; MS.h = l.h; MS.mines = l.m
  MS.cells = Array.from({ length: l.w * l.h }, () => ({ m: false, o: false, f: false, n: 0 }))
  MS.placed = false; MS.flags = 0; MS.open = 0; MS.secs = 0; MS.state = 'ready'; MS.over = null; MS.flagMode = false; MS.boom = -1
  G.mode = 'mines'; engineEmit(); MS.mode = 'play'
  music.set('cards', 0); sfx('ui'); emitM()
}
function stop() { MS.mode = 'idle'; clearInterval(MS.timer); music.set('menu'); emitM() }
const nb = (i) => { const x = i % MS.w, y = (i / MS.w) | 0, o = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < MS.w && yy < MS.h) o.push(yy * MS.w + xx) } return o }
function place(safe) {
  const ban = new Set([safe, ...nb(safe)])
  let n = 0
  while (n < MS.mines) { const i = (Math.random() * MS.cells.length) | 0; if (ban.has(i) || MS.cells[i].m) continue; MS.cells[i].m = true; n++ }
  MS.cells.forEach((c, i) => { c.n = nb(i).filter((j) => MS.cells[j].m).length })
  MS.placed = true
}
function flood(i) {
  const st = [i]
  while (st.length) {
    const k = st.pop(), c = MS.cells[k]
    if (c.o || c.f) continue
    c.o = true; MS.open++
    if (c.n === 0 && !c.m) for (const j of nb(k)) if (!MS.cells[j].o) st.push(j)
  }
}
function reveal(i) {
  if (MS.mode !== 'play' || MS.state === 'won' || MS.state === 'lost') return
  const c = MS.cells[i]
  if (!c || c.f) return
  if (!MS.placed) { place(i); MS.state = 'run'; MS.t0 = performance.now(); clearInterval(MS.timer); MS.timer = setInterval(() => { if (MS.state === 'run') { MS.secs = Math.floor((performance.now() - MS.t0) / 1000); emitM() } }, 500) }
  if (c.o) { // chord: open the neighbours when the flags match the number
    if (c.n > 0 && nb(i).filter((j) => MS.cells[j].f).length === c.n) for (const j of nb(i)) if (!MS.cells[j].f && !MS.cells[j].o) reveal(j)
    return
  }
  if (c.m) { c.o = true; MS.boom = i; return lose() }
  flood(i); sfx('wdKey')
  if (MS.open >= MS.cells.length - MS.mines) win()
  emitM()
}
function flag(i) {
  if (MS.mode !== 'play' || MS.state === 'won' || MS.state === 'lost') return
  const c = MS.cells[i]; if (!c || c.o) return
  c.f = !c.f; MS.flags += c.f ? 1 : -1; sfx('wdFlip'); emitM()
}
function lose() { MS.state = 'lost'; clearInterval(MS.timer); for (const c of MS.cells) if (c.m) c.o = true; MS.over = { win: false, secs: MS.secs }; sfx('tdBoom'); profile.minesGames = (profile.minesGames || 0) + 1; saveProfile(); emitM() }
function win() {
  MS.state = 'won'; clearInterval(MS.timer); MS.secs = Math.floor((performance.now() - MS.t0) / 1000)
  const l = LV[MS.lv], score = Math.round(Math.max(100, 1500 - MS.secs * 8) * l.mult)
  MS.over = { win: true, secs: MS.secs, score }
  profile.minesGames = (profile.minesGames || 0) + 1; profile.minesWins = (profile.minesWins || 0) + 1
  const bt = profile.minesBest || (profile.minesBest = {}); if (!bt[MS.lv] || MS.secs < bt[MS.lv]) bt[MS.lv] = MS.secs
  recordScore('mines', score); saveProfile(); sfx('win'); emitM()
}
function onKey(code) { if (MS.mode === 'idle') return; if (code === 'Escape') toMenu(); else if (code === 'KeyR' || (code === 'Enter' && MS.over)) start({ lv: MS.lv }); else if (code === 'KeyF') { MS.flagMode = !MS.flagMode; emitM() } }
export const minesActions = { start, stop, quit() { toMenu() }, reveal, flag, tap(i) { if (MS.flagMode) flag(i); else reveal(i) }, toggleFlag() { MS.flagMode = !MS.flagMode; sfx('ui'); emitM() }, again() { start({ lv: MS.lv }) } }
if (typeof window !== 'undefined') { window.__MS = MS; window.__mines = minesActions }
games.mines = { update() {}, onKey, draw() {}, stop, sky: () => '#070a14' }
