// Shared card-table core: decks, timeline scheduler, layout helpers, store and registration of the "cards" arcade mode.
import { G, games, profile, saveProfile, recordScore, toMenu } from '../engine.js'
import { sfx, music, speak } from '../audio.js'

export const SUITS = ['C', 'S', 'H', 'D'] // Pusoy Dos order, low -> high: clubs, spades, hearts, diamonds
export const SYM = { C: '♣', S: '♠', H: '♥', D: '♦' }
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
let uid = 0
export const newId = (p = 'c') => p + (uid++)
export const stdDeck = () => { const d = []; for (const s of SUITS) for (const r of RANKS) d.push({ id: newId('s'), kind: 'std', rank: r, suit: s }); return d }
export function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }
export const rnd = (a, b) => a + Math.random() * (b - a)
export const pickOne = (a) => a[Math.floor(Math.random() * a.length)]

export const CS = { remote: null, onNotify: null, online: null, mode: 'idle', paused: false, id: null, g: null, q: [], emitT: 0, over: null, banner: null, confetti: 0, toasts: [] }
let snap = null
const subs = new Set()
export const subscribeCards = (f) => { subs.add(f); return () => subs.delete(f) }
export const getCardsSnap = () => snap
export function buildSnap(viewer = 0) {
  const s = CS.g.snap(viewer)
  return { mode: CS.mode, id: CS.id, name: CS.g.name, paused: CS.paused, over: CS.over, banner: CS.banner, confetti: CS.confetti, toasts: CS.toasts.map((t) => ({ ...t })), chips: profile.chips, ...s }
}
export function notify() {
  if (CS.remote) { snap = CS.remote.snap ? { ...CS.remote.snap, chips: profile.chips, paused: CS.paused } : { mode: CS.mode, id: CS.id }; subs.forEach((f) => f()); return }
  if (!CS.g) { snap = { mode: CS.mode, id: null }; subs.forEach((f) => f()); return }
  snap = buildSnap(0)
  subs.forEach((f) => f())
  if (CS.onNotify) CS.onNotify()
}
// ---- timeline: run callbacks after a delay; respects pause ----
export function after(sec, fn) { CS.q.push({ t: sec, fn }) }
export function clearQ() { CS.q.length = 0 }
function stepQ(dt) {
  for (const it of CS.q) it.t -= dt
  const due = CS.q.filter((i) => i.t <= 0)
  CS.q = CS.q.filter((i) => i.t > 0)
  for (const it of due) it.fn()
}
export function banner(text, sub, color = '#ffe84a', sec = 1.6) { CS.banner = { id: ++uid, text, sub, color }; notify(); after(sec, () => { if (CS.banner && CS.banner.text === text) { CS.banner = null; notify() } }) }
export function toast(text, color = '#fff') { const t = { id: ++uid, text, color, t: 2.2 }; CS.toasts.push(t); if (CS.toasts.length > 4) CS.toasts.shift(); notify() }
export function celebrate() { CS.confetti = ++uid; notify() }

// ---- layout helpers (positions are % of the table) ----
export function fan(n, i, o) {
  const { cx, cy, spread = 4.4, max = 46, arc = 1.4, curve = 0.18, vertical = false, flip = 1 } = o
  const sp = Math.min(spread, n > 1 ? max / (n - 1) : spread)
  const off = i - (n - 1) / 2
  if (vertical) return { x: cx + off * off * curve * flip, y: cy + off * sp * 1.7, rot: 90 + off * arc * flip }
  return { x: cx + off * sp, y: cy + off * off * curve * flip, rot: off * arc * flip }
}
export const SEAT4 = [{ x: 50, y: 83 }, { x: 11, y: 44 }, { x: 50, y: 13 }, { x: 89, y: 44 }] // bottom, left, top, right
export const seatPos = (i, count) => (count === 2 ? [SEAT4[0], SEAT4[2]][i] : count === 3 ? [SEAT4[0], SEAT4[1], SEAT4[3]][i] : SEAT4[i])
export function botFan(n, i, seat, sc = 0.52) {
  const vertical = seat.x < 20 || seat.x > 80
  const f = fan(n, i, { cx: seat.x, cy: seat.y, spread: vertical ? 2.2 : 2.6, max: vertical ? 22 : 24, arc: vertical ? 1 : 1.2, vertical, flip: seat.x > 80 ? -1 : seat.y < 20 ? -1 : 1 })
  return { ...f, s: sc }
}
export const std = (c) => `${c.rank}${c.suit}`

// ---- shared player record for the chip bank ----
export function bank() { if (typeof profile.chips !== 'number') profile.chips = 1000; return profile.chips }
export function addChips(n) { profile.chips = Math.max(0, bank() + n); saveProfile() }

// ---- actions ----
const REG = {}
export const registerCardGame = (g) => { REG[g.id] = g }
function start(id, opts = {}) {
  const g = REG[id]
  if (!g) return
  CS.remote = null; if (!opts.online) { CS.onNotify = null; CS.online = null }
  clearQ(); CS.g = g; CS.id = id; CS.over = null; CS.banner = null; CS.toasts = []; CS.paused = false; CS.confetti = 0
  G.mode = 'cards'; G.parts = []; G.pops = []
  CS.mode = 'play'
  music.set('cards', 0)
  bank()
  g.start(opts)
  notify()
}
// Online client: the host simulates the game; this table only renders host snapshots and forwards clicks.
function startRemote(id, send) {
  clearQ(); CS.g = { id, name: (REG[id] || {}).name || id.toUpperCase() }; CS.id = id; CS.over = null; CS.banner = null; CS.toasts = []; CS.paused = false
  CS.remote = { snap: null, send }; CS.mode = 'play'; CS.opts = {}
  G.mode = 'cards'; G.parts = []; G.pops = []
  music.set('cards', 0); bank(); notify()
}
export const cardsActions = {
  start, startRemote,
  click(id) { if (CS.remote) { if (CS.mode === 'play') CS.remote.send('click', { id }); return } if (CS.mode === 'play' && !CS.paused && CS.g && CS.g.click) CS.g.click(id) },
  button(name, arg) { if (CS.remote) { CS.remote.send('btn', { name, arg }); return } if (CS.mode === 'play' && !CS.paused && CS.g && CS.g.button) CS.g.button(name, arg) },
  quit() { toMenu() },
  stop() { if (CS.online && CS.online.onEnd) { const f = CS.online.onEnd; CS.online.onEnd = null; try { f() } catch { /* ignore */ } } CS.mode = 'idle'; CS.g = null; CS.remote = null; CS.onNotify = null; CS.online = null; CS.paused = false; clearQ(); music.set('menu'); notify() },
  pause() { if (CS.mode === 'play' && !CS.paused) { CS.paused = true; notify(); return true } return false },
  resume() { CS.paused = false; notify() },
  rematch() { if (CS.remote) { CS.remote.send('rematch', {}); return } if (CS.id) start(CS.id, CS.opts || {}) },
}
export function finish(result) { CS.over = result; CS.mode = 'over'; clearQ(); music.stop(); saveProfile(); notify() }

function update(dtRaw) {
  const dt = Math.min(dtRaw, 0.05)
  if (CS.mode === 'idle') return
  if (CS.mode === 'play' && !CS.paused && !CS.remote) { stepQ(dt); if (CS.g && CS.g.tick) CS.g.tick(dt) }
  for (const t of CS.toasts) t.t -= dt
  if (CS.toasts.some((t) => t.t <= 0)) { CS.toasts = CS.toasts.filter((t) => t.t > 0); notify() }
  CS.emitT -= dt
  if (CS.emitT <= 0) { CS.emitT = 0.12; notify() }
}
function onKey(code) {
  if (CS.mode === 'idle') return
  if (code === 'Escape' || code === 'KeyP') { if (CS.mode === 'play') { CS.paused = !CS.paused; sfx('ui'); notify() } return }
  if (CS.paused && code === 'Enter') { CS.paused = false; notify() }
}
if (typeof window !== 'undefined') { window.__CS = CS; window.__cards = cardsActions }
games.cards = { update, onKey, draw() {}, stop() { cardsActions.stop() }, sky: () => '#06281c' }
