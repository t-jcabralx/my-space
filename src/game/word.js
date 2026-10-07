// WORD HUNT: guess the 5-letter word in 6 tries. Daily word (same for everybody), practice, and a Filipino (Tagalog) list.
import { G, emit as engineEmit, games, profile, saveProfile, recordScore, toMenu } from './engine.js'
import { sfx, music } from './audio.js'
import { EN, TL, VALID_EXTRA } from './words.js'

export const WD = { mode: 'idle', lang: 'en', daily: false, answer: '', rows: [], cur: '', done: false, win: false, shake: 0, reveal: -1, msg: null, keys: {}, hard: false, stats: null, practiceN: 0 }
let snap = null
const subs = new Set()
export const subscribeWord = (f) => { subs.add(f); return () => subs.delete(f) }
export const getWordSnap = () => snap
const dayKey = () => { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate() }
export const score5 = (guess, ans) => {
  const r = Array(5).fill('x'), left = {}
  for (let i = 0; i < 5; i++) if (guess[i] === ans[i]) r[i] = 'g'; else left[ans[i]] = (left[ans[i]] || 0) + 1
  for (let i = 0; i < 5; i++) if (r[i] !== 'g' && left[guess[i]] > 0) { r[i] = 'y'; left[guess[i]]-- }
  return r.join('')
}
function stats() {
  const s = profile.word || (profile.word = { played: 0, wins: 0, streak: 0, best: 0, dist: [0, 0, 0, 0, 0, 0], last: 0, daily: {} })
  return s
}
function emitW() {
  const s = stats()
  snap = { mode: WD.mode, lang: WD.lang, daily: WD.daily, rows: WD.rows.map((r) => ({ w: r.w, s: r.s })), cur: WD.cur, done: WD.done, win: WD.win, reveal: WD.reveal, msg: WD.msg, keys: { ...WD.keys }, answer: WD.done ? WD.answer : null, shake: WD.shake, stats: { played: s.played, wins: s.wins, streak: s.streak, best: s.best, dist: s.dist.slice() }, hard: WD.hard, dailyDone: !!(s.daily && s.daily[dayKey() + WD.lang]) }
  subs.forEach((f) => f())
}
const list = (lang) => (lang === 'tl' ? TL : EN)
function pickAnswer(lang, daily) {
  const L = list(lang)
  if (daily) { let h = dayKey() * 2654435761 + (lang === 'tl' ? 17 : 3); h = (h ^ (h >>> 13)) >>> 0; return L[h % L.length] }
  return L[(Math.random() * L.length) | 0]
}
function start(cfg = {}) {
  WD.lang = cfg.lang === 'tl' ? 'tl' : 'en'; WD.daily = !!cfg.daily; WD.hard = !!cfg.hard
  WD.answer = (cfg.seed ? list(WD.lang)[cfg.seed % list(WD.lang).length] : pickAnswer(WD.lang, WD.daily)).toUpperCase()
  WD.rows = []; WD.cur = ''; WD.done = false; WD.win = false; WD.reveal = -1; WD.msg = null; WD.keys = {}
  G.mode = 'word'; engineEmit(); WD.mode = 'play'
  music.set('cards', 0); sfx('ui'); emitW()
}
function stop() { WD.mode = 'idle'; music.set('menu'); emitW() }
const valid = (w) => { const l = w.toLowerCase(); return EN.includes(l) || TL.includes(l) || VALID_EXTRA.includes(l) || /^[a-z]{5}$/.test(l) }
function toast(t) { WD.msg = t; WD.shake = 0.4; sfx('wdBad'); emitW(); setTimeout(() => { if (WD.msg === t) { WD.msg = null; emitW() } }, 1400) }
function submit() {
  if (WD.done || WD.cur.length < 5) { if (!WD.done) toast('NOT ENOUGH LETTERS'); return }
  const w = WD.cur
  if (!valid(w)) return toast('NOT A WORD')
  if (WD.hard) {
    const last = WD.rows[WD.rows.length - 1]
    if (last) for (let i = 0; i < 5; i++) if (last.s[i] === 'g' && w[i] !== last.w[i]) return toast('HARD MODE: KEEP GREEN LETTERS')
  }
  const s = score5(w.toLowerCase(), WD.answer.toLowerCase())
  WD.rows.push({ w, s }); WD.cur = ''
  WD.reveal = WD.rows.length - 1
  for (let i = 0; i < 5; i++) { const c = w[i], v = s[i]; const old = WD.keys[c]; if (!old || (old === 'y' && v === 'g') || (old === 'x' && v !== 'x')) WD.keys[c] = v; sfx('wdFlip', i) }
  const won = s === 'ggggg'
  if (won || WD.rows.length >= 6) setTimeout(() => finish(won), 700)
  else WD.done = false
  emitW()
}
function finish(won) {
  WD.done = true; WD.win = won
  const st = stats(), n = WD.rows.length
  st.played++
  if (won) { st.wins++; st.streak++; st.best = Math.max(st.best, st.streak); st.dist[n - 1]++ } else st.streak = 0
  if (WD.daily) { st.daily[dayKey() + WD.lang] = won ? n : 7 }
  profile.wordGames = st.played
  const score = won ? (7 - n) * 150 + st.streak * 25 + (WD.daily ? 200 : 0) + (WD.lang === 'tl' ? 100 : 0) + (WD.hard ? 150 : 0) : 0
  WD.score = score
  if (won) recordScore('word', score)
  saveProfile()
  sfx(won ? 'wdGood' : 'over'); emitW()
}
function type(ch) { if (WD.done || WD.mode !== 'play' || WD.cur.length >= 5) return; WD.cur += ch.toUpperCase(); sfx('wdKey'); emitW() }
function back() { if (WD.done) return; WD.cur = WD.cur.slice(0, -1); emitW() }
function onKey(code) {
  if (WD.mode !== 'play') return
  if (code === 'Escape') return toMenu()
  if (code === 'Enter') return WD.done ? wordActions.again() : submit()
  if (code === 'Backspace') return back()
  const m = /^Key([A-Z])$/.exec(code)
  if (m) type(m[1])
}
export const wordActions = { start, stop, quit() { toMenu() }, type, back, submit, again() { start({ lang: WD.lang, daily: false, hard: WD.hard }) } }
if (typeof window !== 'undefined') { window.__WD = WD; window.__word = wordActions }
games.word = { update() {}, onKey, draw() {}, stop, sky: () => '#070a14' }
