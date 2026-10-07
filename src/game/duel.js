// SCORE DUELS: any solo score game becomes a head-to-head online match. Both players start the same game at once, see each
// other's live score, and the higher result wins. (Snake, Neon Breaker, 2048, Neon Beat, Neon Defense, Maze Chomp, Mine Sweep, Word Hunt.)
import { G, profile, tickHooks, toMenu } from './engine.js'
import { sfx } from './audio.js'
import { registerNet, gameEnded } from './online/gnet.js'
import { snakeActions, SN } from './snake.js'
import { breakerActions, BK } from './breaker.js'
import { mergeActions, MG } from './merge.js'
import { rhythmActions, RT } from './rhythm.js'
import { tdActions, TD } from './td.js'
import { chompActions, C } from './chomp.js'
import { minesActions, MS } from './mines.js'
import { wordActions, WD } from './word.js'

export const DUELS = {
  snake: { name: 'NEON SNAKE', start: () => snakeActions.start({ type: 'solo' }), score: () => SN.score | 0, done: () => !!SN.over, mode: 'snake' },
  breaker: { name: 'NEON BREAKER', start: () => breakerActions.start(), score: () => BK.score | 0, done: () => BK.mode === 'over', mode: 'breaker' },
  merge: { name: '2048 MERGE', start: () => mergeActions.start({ n: 4 }), score: () => MG.score | 0, done: () => !!MG.over, mode: 'merge' },
  rhythm: { name: 'NEON BEAT', start: (o) => rhythmActions.start({ song: o.song | 0 }), score: () => RT.score | 0, done: () => !!RT.over, mode: 'rhythm' },
  td: { name: 'NEON DEFENSE', start: () => tdActions.start({ map: 0, story: false }), score: () => (TD.over ? TD.over.score | 0 : TD.wave * 100 + TD.kills), done: () => !!TD.over, mode: 'td' },
  chomp: { name: 'MAZE CHOMP', start: () => chompActions.start('classic', 1), score: () => C.score | 0, done: () => !!C.over, mode: 'chomp' },
  mines: { name: 'MINE SWEEP', start: (o) => minesActions.start({ lv: 0, seed: o.seed }), score: () => (MS.over ? (MS.over.win ? 1000000 - MS.over.secs * 100 : MS.open) : MS.open), done: () => !!MS.over, mode: 'mines' },
  word: { name: 'WORD HUNT', start: (o) => wordActions.start({ lang: 'en', daily: false, seed: o.seed }), score: () => (WD.done ? (WD.win ? 1000 - WD.rows.length * 100 : 0) : WD.rows.reduce((a, r) => a + (r.s ? [...r.s].filter((c) => c === 'g').length : 0), 0)), done: () => WD.done, mode: 'word' },
}
export const D = { on: false, id: '', foe: '', foeName: 'RIVAL', foeScore: 0, foeDone: false, mine: 0, mineDone: false, result: null, ctx: null, t: 0, sendT: 0, sent: false }
let snap = { on: false }
const subs = new Set()
export const subscribeDuel = (f) => { subs.add(f); return () => subs.delete(f) }
export const getDuelSnap = () => snap
function emit() {
  snap = { on: D.on, game: D.id && DUELS[D.id] ? DUELS[D.id].name : '', foeName: D.foeName, foeScore: D.foeScore, foeDone: D.foeDone, mine: D.mine, mineDone: D.mineDone, result: D.result, host: !!(D.ctx && D.ctx.role === 'host') }
  subs.forEach((f) => f())
}
function conclude() {
  if (D.result || !D.mineDone || !D.foeDone) return
  const win = D.mine > D.foeScore, tie = D.mine === D.foeScore
  D.result = { win: win || (tie && false), tie, mine: D.mine, theirs: D.foeScore }
  profile.duelGames = (profile.duelGames || 0) + 1
  if (win) profile.duelWins = (profile.duelWins || 0) + 1
  sfx(win ? 'win' : 'over'); emit()
}
tickHooks.push((dt) => {
  if (!D.on || D.result) return
  const g = DUELS[D.id]
  if (!g) return
  D.t += dt
  if (D.t < 1.2) return
  if (G.mode !== g.mode && !D.mineDone && D.t > 4) { D.mineDone = true; D.sent = true; D.ctx.send({ k: 'done', m: D.mine }); conclude(); emit(); return } // the player quit the game
  D.mine = g.score()
  if (g.done() && !D.mineDone) { D.mineDone = true; D.mine = g.score(); D.ctx.send({ k: 'done', m: D.mine }); conclude(); emit() }
  D.sendT -= dt
  if (D.sendT <= 0) { D.sendT = 0.5; if (!D.mineDone) D.ctx.send({ k: 'sc', m: D.mine }); emit() }
})
for (const id of Object.keys(DUELS)) {
  registerNet('duel:' + id, {
    min: 2,
    begin(ctx) {
      const foe = ctx.players.find((p) => p.id !== ctx.players[ctx.me].id)
      Object.assign(D, { on: true, id, foeName: foe ? foe.name : 'RIVAL', foeScore: 0, foeDone: false, mine: 0, mineDone: false, result: null, ctx, t: 0, sendT: 0 })
      DUELS[id].start({ seed: ctx.seed, song: ctx.opts.song | 0 })
      emit()
    },
    active: () => D.on,
    onMsg(d) {
      if (!d || !D.on) return
      if (d.k === 'sc') { D.foeScore = +d.m || 0; emit() }
      else if (d.k === 'done') { D.foeScore = +d.m || 0; D.foeDone = true; conclude(); emit() }
      else if (d.k === 'rematch' && D.ctx && D.ctx.role === 'host') D.ctx.restart()
    },
    onLeave() { if (D.on && !D.result) { D.foeDone = true; D.foeScore = -1; if (!D.mineDone) { D.mineDone = true } D.result = { win: true, tie: false, mine: D.mine, theirs: 0, forfeit: true }; emit() } },
  })
}
export const duelActions = {
  rematch() { if (!D.ctx) return; if (D.ctx.role === 'host') D.ctx.restart(); else D.ctx.sendHost({ k: 'rematch' }) },
  close() { const id = D.id; D.on = false; D.result = null; D.ctx = null; gameEnded('duel:' + id); try { toMenu() } catch { /* ignore */ } emit() },
}
