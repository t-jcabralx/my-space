// 2048-STYLE MERGE: slide tiles, merge equal numbers. Swipe or arrow keys. Undo, hammer and shuffle power-ups.
import { G, emit as engineEmit, games, profile, saveProfile, recordScore, toMenu } from './engine.js'
import { sfx, music } from './audio.js'

export const MG = { mode: 'idle', n: 4, grid: [], score: 0, best: 0, moves: 0, history: [], undo: 3, hammer: 2, shuffle: 1, tool: null, over: false, won: false, keepGoing: false, tiles: [], idc: 1, maxTile: 0, lastAdd: 0, msg: null }
let snap = null
const subs = new Set()
export const subscribeMerge = (f) => { subs.add(f); return () => subs.delete(f) }
export const getMergeSnap = () => snap
function emitM() {
  snap = { mode: MG.mode, n: MG.n, tiles: MG.tiles.map((t) => ({ ...t })), score: MG.score, best: MG.best, moves: MG.moves, undo: MG.undo, hammer: MG.hammer, shuffle: MG.shuffle, tool: MG.tool, over: MG.over, won: MG.won && !MG.keepGoing, max: MG.maxTile, msg: MG.msg }
  subs.forEach((f) => f())
}
const bestKey = () => (profile.mergeBest || (profile.mergeBest = {}))
function fresh() { return Array.from({ length: MG.n }, () => Array(MG.n).fill(null)) }
function rebuildTiles() {
  MG.tiles = []
  for (let r = 0; r < MG.n; r++) for (let c = 0; c < MG.n; c++) { const t = MG.grid[r][c]; if (t) MG.tiles.push({ id: t.id, v: t.v, r, c, nw: !!t.nw, mg: !!t.mg }) }
}
function addTile() {
  const empty = []
  for (let r = 0; r < MG.n; r++) for (let c = 0; c < MG.n; c++) if (!MG.grid[r][c]) empty.push([r, c])
  if (!empty.length) return
  const [r, c] = empty[(Math.random() * empty.length) | 0]
  MG.grid[r][c] = { id: MG.idc++, v: Math.random() < 0.9 ? 2 : 4, nw: true }
}
function start(cfg = {}) {
  MG.n = cfg.n === 5 ? 5 : cfg.n === 3 ? 3 : 4
  MG.grid = fresh(); MG.score = 0; MG.moves = 0; MG.history = []; MG.undo = 3; MG.hammer = 2; MG.shuffle = 1; MG.tool = null; MG.over = false; MG.won = false; MG.keepGoing = false; MG.maxTile = 2; MG.msg = null
  MG.best = bestKey()[MG.n] || 0
  addTile(); addTile()
  G.mode = 'merge'; engineEmit(); MG.mode = 'play'
  music.set('cards', 0); sfx('ui'); rebuildTiles(); emitM()
}
function stop() { MG.mode = 'idle'; music.set('menu'); emitM() }
function canMove() {
  for (let r = 0; r < MG.n; r++) for (let c = 0; c < MG.n; c++) {
    const t = MG.grid[r][c]
    if (!t) return true
    if (c + 1 < MG.n && MG.grid[r][c + 1] && MG.grid[r][c + 1].v === t.v) return true
    if (r + 1 < MG.n && MG.grid[r + 1][c] && MG.grid[r + 1][c].v === t.v) return true
  }
  return false
}
// dir: 0 left, 1 right, 2 up, 3 down
export function slideLine(line) {
  const out = [], merged = []
  let gained = 0, last = null
  for (const t of line) {
    if (!t) continue
    if (last && !last.mg && last.v === t.v) { last.v *= 2; last.mg = true; gained += last.v; merged.push(last) } else { last = { ...t, mg: false, nw: false }; out.push(last) }
  }
  while (out.length < line.length) out.push(null)
  return { out, gained }
}
function move(dir) {
  if (MG.mode !== 'play' || MG.over || (MG.won && !MG.keepGoing)) return false
  const n = MG.n, before = JSON.stringify(MG.grid.map((r) => r.map((t) => t && t.v)))
  const snapG = MG.grid.map((r) => r.map((t) => t && { ...t })), snapScore = MG.score
  let gained = 0, merges = 0
  const g = fresh()
  for (let k = 0; k < n; k++) {
    const line = []
    for (let i = 0; i < n; i++) line.push(dir === 0 ? MG.grid[k][i] : dir === 1 ? MG.grid[k][n - 1 - i] : dir === 2 ? MG.grid[i][k] : MG.grid[n - 1 - i][k])
    const { out, gained: gn } = slideLine(line)
    gained += gn; merges += out.filter((t) => t && t.mg).length
    for (let i = 0; i < n; i++) { if (dir === 0) g[k][i] = out[i]; else if (dir === 1) g[k][n - 1 - i] = out[i]; else if (dir === 2) g[i][k] = out[i]; else g[n - 1 - i][k] = out[i] }
  }
  const after = JSON.stringify(g.map((r) => r.map((t) => t && t.v)))
  if (before === after) { return false }
  MG.history.push({ grid: snapG, score: snapScore, moves: MG.moves }); if (MG.history.length > 5) MG.history.shift()
  MG.grid = g; MG.score += gained; MG.moves++
  for (const row of MG.grid) for (const t of row) if (t) MG.maxTile = Math.max(MG.maxTile, t.v)
  addTile()
  if (merges) sfx('mgMerge', Math.log2(Math.max(2, gained))); else sfx('mgSlide')
  if (MG.maxTile >= 2048 && !MG.won) { MG.won = true; sfx('mgBig'); finishSave() }
  if (MG.score > MG.best) { MG.best = MG.score; bestKey()[MG.n] = MG.best }
  rebuildTiles()
  if (!canMove()) { MG.over = true; sfx('over'); finishSave() }
  emitM()
  return true
}
function finishSave() {
  profile.mergeGames = (profile.mergeGames || 0) + (MG.over || MG.won ? 1 : 0)
  profile.mergeMax = Math.max(profile.mergeMax || 0, MG.maxTile)
  const mult = MG.n === 5 ? 0.6 : MG.n === 3 ? 3 : 1
  recordScore('merge', Math.round(MG.score * mult)); saveProfile()
}
function useUndo() { if (MG.undo <= 0 || !MG.history.length || MG.over) return; const h = MG.history.pop(); MG.grid = h.grid; MG.score = h.score; MG.moves = h.moves; MG.undo--; sfx('mgPow'); rebuildTiles(); emitM() }
function useShuffle() {
  if (MG.shuffle <= 0 || MG.over) return
  const all = []; for (const r of MG.grid) for (const t of r) if (t) all.push(t)
  all.sort(() => Math.random() - 0.5)
  MG.grid = fresh()
  const cells = []; for (let r = 0; r < MG.n; r++) for (let c = 0; c < MG.n; c++) cells.push([r, c])
  cells.sort(() => Math.random() - 0.5)
  all.forEach((t, i) => { MG.grid[cells[i][0]][cells[i][1]] = { ...t, nw: false, mg: false } })
  MG.shuffle--; sfx('mgPow'); rebuildTiles(); if (!canMove() && !MG.over) { /* still stuck: allowed, the player can undo */ } emitM()
}
function hammer(r, c) { if (MG.tool !== 'hammer' || !MG.grid[r][c]) return; MG.grid[r][c] = null; MG.hammer--; MG.tool = null; sfx('tdBoom'); rebuildTiles(); if (MG.over && canMove()) MG.over = false; emitM() }
function onKey(code) {
  if (MG.mode !== 'play') return
  if (code === 'Escape') return toMenu()
  const d = { ArrowLeft: 0, KeyA: 0, ArrowRight: 1, KeyD: 1, ArrowUp: 2, KeyW: 2, ArrowDown: 3, KeyS: 3 }[code]
  if (d !== undefined) move(d)
  else if (code === 'KeyZ' || code === 'KeyU') useUndo()
  else if (code === 'KeyR' && MG.over) mergeActions.again()
}
export const mergeActions = {
  start, stop, quit() { toMenu() }, move, undo: useUndo, shuffle: useShuffle,
  hammerMode() { if (MG.hammer > 0 && !MG.over) { MG.tool = MG.tool === 'hammer' ? null : 'hammer'; sfx('ui'); emitM() } },
  tap(r, c) { hammer(r, c) },
  keepGoing() { MG.keepGoing = true; emitM() },
  again() { start({ n: MG.n }) },
}
if (typeof window !== 'undefined') { window.__MG = MG; window.__merge = mergeActions }
games.merge = { update() {}, onKey, draw() {}, stop, sky: () => '#070a14' }
