import { update } from '../src/game/engine.js'
import { CS, cardsActions } from '../src/game/cards/core.js'
import '../src/game/cards/uno.js'
import '../src/game/cards/pusoy.js'
import '../src/game/cards/lucky9.js'
import '../src/game/cards/tongits.js'
import '../src/game/cards/baccarat.js'
import '../src/game/cards/poker.js'
import { bankerDraws, total as bTotal } from '../src/game/cards/baccarat.js'
import { rank5, cmp, best7 } from '../src/game/cards/poker.js'
import { isSet, isRun, validMeld, bestMelds, dead } from '../src/game/cards/tongits.js'
import { total, special, natural } from '../src/game/cards/lucky9.js'
import { evalCombo, beats } from '../src/game/cards/pusoy.js'
let failures = 0
const check = (n, c, i) => { if (!c) failures++; console.log(c ? 'PASS' : 'FAIL', n, i || '') }
function runBots(id, opts, maxSec, humanPlay) {
  cardsActions.start(id, opts)
  let frames = 0
  for (let i = 0; i < 60 * maxSec && CS.mode !== 'over'; i++) {
    if (humanPlay && i % 20 === 0) humanPlay()
    update(1 / 60); frames++
  }
  return { frames, over: CS.mode === 'over' }
}
import { getCardsSnap, notify } from '../src/game/cards/core.js'
// UNO with an auto-playing "human"
const unoHuman = () => {
  notify(); const s = getCardsSnap()
  if (!s || s.phase === undefined) return
  if (s.prompt && s.prompt.type === 'color') { cardsActions.button('color', 'R'); return }
  if (s.phase === 'roundOver' && s.buttons.some((b) => b.name === 'next')) { cardsActions.button('next'); return }
  const me = s.seats[0]
  if (!me.turn) return
  const glow = s.cards.find((c) => c.mine && c.glow)
  if (glow) cardsActions.click(glow.id)
  else if (s.buttons.some((b) => b.name === 'pass')) cardsActions.button('pass')
  else cardsActions.button('deck')
}
for (const count of [2, 3, 4]) {
  const r = runBots('uno', { count, stack: count !== 3, target: 120 }, 900, unoHuman)
  check('UNO ' + count + 'p completes', r.over, `secs ${(r.frames / 60) | 0} title ${CS.over && CS.over.title}`)
}

// idle human: after 15s UNO auto-draws one card (or passes)
{
  cardsActions.start('uno', { count: 2, stack: false, target: 120 })
  for (let i = 0; i < 60 * 6; i++) update(1 / 60)
  notify(); const s0 = getCardsSnap()
  const before = s0.cards.filter((c) => c.mine).length
  const idle = s0.seats[0].turn
  for (let i = 0; i < 60 * 16; i++) update(1 / 60)
  notify(); const s1 = getCardsSnap()
  const after = s1.cards.filter((c) => c.mine).length
  check('UNO idle human auto-draws after 15s', !idle || after > before || !s1.seats[0].turn, `before ${before} after ${after}`)
}

// ---- Pusoy Dos hand evaluation unit tests ----
const C = (r, su) => ({ id: r + su, kind: 'std', rank: r, suit: su })
const ev = (...a) => evalCombo(a.map(([r, s]) => C(r, s)))
check('single 2D beats AS', beats(ev(['2', 'D']), ev(['A', 'S'])))
check('pair beats lower pair', beats(ev(['5', 'C'], ['5', 'D']), ev(['4', 'H'], ['4', 'S'])))
check('pair vs single invalid', !beats(ev(['5', 'C'], ['5', 'D']), ev(['4', 'H'])))
const st = ev(['3', 'C'], ['4', 'D'], ['5', 'S'], ['6', 'H'], ['7', 'C'])
const fl = ev(['3', 'C'], ['9', 'C'], ['J', 'C'], ['4', 'C'], ['K', 'C'])
const fh = ev(['3', 'C'], ['3', 'D'], ['3', 'S'], ['4', 'C'], ['4', 'D'])
const q4 = ev(['9', 'C'], ['9', 'D'], ['9', 'S'], ['9', 'H'], ['4', 'D'])
const sf = ev(['3', 'C'], ['4', 'C'], ['5', 'C'], ['6', 'C'], ['7', 'C'])
check('hand kinds', st && st.name === 'STRAIGHT' && fl && fl.name === 'FLUSH' && fh && fh.name === 'FULL HOUSE' && q4 && q4.name === 'FOUR OF A KIND' && sf && sf.name === 'STRAIGHT FLUSH')
check('5-card ladder', beats(fl, st) && beats(fh, fl) && beats(q4, fh) && beats(sf, q4) && !beats(st, fl))
check('A-high straight beats K-high', beats(ev(['10', 'C'], ['J', 'D'], ['Q', 'S'], ['K', 'H'], ['A', 'C']), ev(['9', 'C'], ['10', 'D'], ['J', 'S'], ['Q', 'H'], ['K', 'C'])))
check('wheel A-2-3-4-5 is lowest straight', evalCombo([C('A', 'C'), C('2', 'D'), C('3', 'S'), C('4', 'H'), C('5', 'C')]) && beats(st, evalCombo([C('A', 'C'), C('2', 'D'), C('3', 'S'), C('4', 'H'), C('5', 'C')])))
check('wrap J-Q-K-A-2 invalid', !evalCombo([C('J', 'C'), C('Q', 'D'), C('K', 'S'), C('A', 'H'), C('2', 'C')]))
check('two pair invalid', !ev(['3', 'C'], ['3', 'D'], ['4', 'S'], ['4', 'C'], ['5', 'D']))
const pusoyHuman = () => {
  notify(); const s = getCardsSnap()
  if (s.phase === 'roundOver' && s.buttons.some((b) => b.name === 'next')) { cardsActions.button('next'); return }
  if (!s.seats[0].turn) return
  cardsActions.button('clear'); cardsActions.button('hint')
  const sel = getCardsSnap().cards.filter((c) => c.sel).length
  if (sel) cardsActions.button('play'); else cardsActions.button('pass')
}
{ const r = runBots('pusoy', { target: 25 }, 1800, pusoyHuman); check('Pusoy match completes', r.over, `secs ${(r.frames / 60) | 0} ${CS.over && CS.over.title}`) }
{ const r = runBots('pusoy', { target: 25, auto: true }, 1800, null); check('Pusoy bots-only completes', r.over, `secs ${(r.frames / 60) | 0}`) }

// ---- Lucky 9 rule tests + rounds ----
const L9 = (...a) => a.map(([r, su]) => C(r, su))
check('lucky9: K+9 = 9', total(L9(['K', 'S'], ['9', 'H'])) === 9)
check('lucky9: 7+8 = 5', total(L9(['7', 'S'], ['8', 'H'])) === 5)
check('lucky9: A+A+8 = 0', total(L9(['A', 'S'], ['A', 'H'], ['8', 'D'])) === 0)
check('lucky9: natural 8/9 only on 2 cards', natural(L9(['4', 'S'], ['5', 'H'])) && !natural(L9(['2', 'S'], ['3', 'H'], ['3', 'D'])))
check('lucky9: suited x2 / x3 / trips x5', special(L9(['2', 'S'], ['9', 'S'])).mult === 2 && special(L9(['2', 'S'], ['4', 'S'], ['9', 'S'])).mult === 3 && special(L9(['5', 'S'], ['5', 'H'], ['5', 'D'])).mult === 5)
{
  const { profile } = await import('../src/game/engine.js')
  profile.chips = 1000
  cardsActions.start('lucky9', { bots: 3, auto: true })
  for (let i = 0; i < 60 * 120; i++) update(1 / 60)
  check('lucky9 auto rounds run', CS.mode === 'play', 'round info ' + getCardsSnap().info)
  profile.chips = 1000
  cardsActions.start('lucky9', { bots: 3 })
  let rounds = 0
  for (let i = 0; i < 60 * 400 && rounds < 6; i++) {
    update(1 / 60); if (i % 10 === 0) {
      notify(); const s = getCardsSnap()
      const b = (n) => s.buttons.find((x) => x.name === n && !x.off)
      if (b('deal')) cardsActions.button('deal')
      else if (b('hit') && s.seats[0].val !== null && s.seats[0].val <= 5) cardsActions.button('hit')
      else if (b('stand')) cardsActions.button('stand')
      else if (b('next')) { cardsActions.button('next'); rounds++ }
      else if (b('loan')) cardsActions.button('loan')
    }
  }
  check('lucky9 human plays 6 rounds', rounds >= 6, 'rounds ' + rounds + ' chips ' + profile.chips)
  cardsActions.button('cash'); check('lucky9 cash out', CS.mode === 'over')
}

// ---- Baccarat rules ----
{
  const { profile } = await import('../src/game/engine.js')
  check('baccarat: banker rules', bankerDraws(2, 9) && !bankerDraws(3, 8) && bankerDraws(4, 5) && !bankerDraws(4, 9) && bankerDraws(6, 7) && !bankerDraws(6, 5) && !bankerDraws(7, 0) && bankerDraws(5, null) && !bankerDraws(6, null))
  check('baccarat: K+9 = 9, 7+8 = 5', bTotal(L9(['K', 'S'], ['9', 'H'])) === 9 && bTotal(L9(['7', 'S'], ['8', 'H'])) === 5)
  profile.chips = 1000
  cardsActions.start('baccarat', { bots: 3, auto: true })
  for (let i = 0; i < 60 * 150; i++) update(1 / 60)
  check('baccarat auto rounds run', CS.mode === 'play', getCardsSnap().info)
  profile.chips = 1000
  cardsActions.start('baccarat', { bots: 2 })
  let rounds = 0, seen = false
  for (let i = 0; i < 60 * 400 && rounds < 8; i++) {
    update(1 / 60); if (i % 10 === 0) {
      notify(); const s = getCardsSnap(); const b = (n, a) => s.buttons.find((x) => x.name === n && (a === undefined || x.arg === a) && !x.off)
      if (b('deal')) { cardsActions.button('side', ['P', 'B', 'T'][rounds % 3]); cardsActions.button('deal') }
      else if (b('next')) { seen = seen || s.cards.length >= 4; cardsActions.button('next'); rounds++ }
      else if (b('loan')) cardsActions.button('loan')
    }
  }
  check('baccarat human plays 8 rounds', rounds >= 8 && seen, 'rounds ' + rounds + ' chips ' + profile.chips)
  cardsActions.button('cash'); check('baccarat cash out', CS.mode === 'over')
}
// ---- Poker hands and a full table ----
{
  const { profile } = await import('../src/game/engine.js')
  const H = (...cs) => cs.map(([r, su]) => ({ rank: r, suit: su }))
  const sf = rank5(H(['9', 'H'], ['10', 'H'], ['J', 'H'], ['Q', 'H'], ['K', 'H'])), quad = rank5(H(['7', 'H'], ['7', 'S'], ['7', 'D'], ['7', 'C'], ['2', 'H'])), fh = rank5(H(['3', 'H'], ['3', 'S'], ['3', 'D'], ['9', 'C'], ['9', 'H'])), fl = rank5(H(['2', 'H'], ['6', 'H'], ['9', 'H'], ['J', 'H'], ['K', 'H'])), st = rank5(H(['A', 'H'], ['2', 'S'], ['3', 'D'], ['4', 'C'], ['5', 'H'])), tk = rank5(H(['5', 'H'], ['5', 'S'], ['5', 'D'], ['9', 'C'], ['K', 'H'])), tp = rank5(H(['5', 'H'], ['5', 'S'], ['9', 'D'], ['9', 'C'], ['K', 'H'])), pr = rank5(H(['5', 'H'], ['5', 'S'], ['8', 'D'], ['9', 'C'], ['K', 'H'])), hc = rank5(H(['2', 'H'], ['5', 'S'], ['8', 'D'], ['9', 'C'], ['K', 'H']))
  check('poker: hand order', cmp(sf, quad) > 0 && cmp(quad, fh) > 0 && cmp(fh, fl) > 0 && cmp(fl, st) > 0 && cmp(st, tk) > 0 && cmp(tk, tp) > 0 && cmp(tp, pr) > 0 && cmp(pr, hc) > 0)
  check('poker: wheel straight is five-high', st[0] === 4 && st[1] === 5)
  check('poker: kickers decide pairs', cmp(rank5(H(['5', 'H'], ['5', 'S'], ['8', 'D'], ['9', 'C'], ['A', 'H'])), pr) > 0)
  check('poker: best of 7', best7(H(['A', 'H'], ['K', 'H'], ['Q', 'H'], ['J', 'H'], ['10', 'H'], ['2', 'S'], ['3', 'D']))[0] === 8)
  profile.chips = 1000
  cardsActions.start('poker', { bots: 3, auto: true })
  for (let i = 0; i < 60 * 240; i++) update(1 / 60)
  check('poker bots play many hands', CS.mode === 'play' && /HAND (\d+)/.test(getCardsSnap().info) && +/HAND (\d+)/.exec(getCardsSnap().info)[1] > 5, getCardsSnap().info)
  profile.chips = 1000
  cardsActions.start('poker', { bots: 3 })
  let hands = 0, sawFlop = false
  for (let i = 0; i < 60 * 600 && hands < 6; i++) {
    update(1 / 60); if (i % 10 === 0) {
      notify(); const s = getCardsSnap(); const b = (n) => s.buttons.find((x) => x.name === n && !x.off)
      if (s.cards.filter((c) => c.up && c.x >= 30 && c.y === 44).length >= 3) sawFlop = true
      if (b('check')) cardsActions.button('check'); else if (b('call')) cardsActions.button('call')
      else if (b('next')) { cardsActions.button('next'); hands++ }
      else if (b('loan')) cardsActions.button('loan')
    }
  }
  check('poker human plays 6 hands to showdown', hands >= 6 && sawFlop, 'hands ' + hands + ' chips ' + profile.chips)
  cardsActions.button('cash'); check('poker cash out', CS.mode === 'over')
}

// ---- Tong-its rule tests ----
check('tongits: set of 3', isSet(L9(['7', 'S'], ['7', 'H'], ['7', 'D'])))
check('tongits: set of 4', isSet(L9(['7', 'S'], ['7', 'H'], ['7', 'D'], ['7', 'C'])))
check('tongits: set needs distinct suits', !isSet(L9(['7', 'S'], ['7', 'S'], ['7', 'D'])))
check('tongits: run A-2-3', isRun(L9(['A', 'S'], ['2', 'S'], ['3', 'S'])))
check('tongits: run Q-K-A invalid (Ace is low)', !isRun(L9(['Q', 'S'], ['K', 'S'], ['A', 'S'])))
check('tongits: run needs one suit', !isRun(L9(['4', 'S'], ['5', 'H'], ['6', 'S'])))
check('tongits: gap is not a run', !validMeld(L9(['4', 'S'], ['5', 'S'], ['7', 'S'])))
check('tongits: deadwood points A=1 face=10', dead(L9(['A', 'S'], ['K', 'H'], ['9', 'D'])) === 20)
const bm = bestMelds(L9(['3', 'S'], ['3', 'H'], ['3', 'D'], ['4', 'S'], ['5', 'S'], ['6', 'S'], ['K', 'C']))
check('tongits: best melds finds set + run', bm.melds.length === 2 && bm.score === 9 + 15, 'score ' + bm.score)
const tongitsHuman = () => {
  notify(); const s = getCardsSnap(); const on = (n) => s.buttons.find((b) => b.name === n && !b.off)
  if (on('next')) { cardsActions.button('next'); return }
  if (on('fight')) { cardsActions.button('fight'); return }
  if (!s.seats[0].turn) return
  if (s.phase === 'draw') { cardsActions.button('stock'); return }
  if (s.phase === 'action') { if (on('auto')) { cardsActions.button('auto'); return } const hc = s.cards.filter((c) => c.mine); const worst = hc.sort((a, b) => ({ A: 1, J: 10, Q: 10, K: 10 }[b.face.rank] || +b.face.rank) - ({ A: 1, J: 10, Q: 10, K: 10 }[a.face.rank] || +a.face.rank))[0]; if (worst) { cardsActions.click(worst.id); cardsActions.button('discardsel') } }
}
{
  const { profile } = await import('../src/game/engine.js')
  profile.chips = 1000
  cardsActions.start('tongits', { stake: 50 })
  let rounds = 0, seen = new Set()
  for (let i = 0; i < 60 * 900 && rounds < 6; i++) {
    update(1 / 60); if (i % 8 === 0) { notify(); if (getCardsSnap().phase === 'roundOver') rounds++; tongitsHuman() }
  }
  check('tongits human plays several rounds', rounds >= 5, `rounds ${rounds} chips ${profile.chips} ${getCardsSnap().info}`)
  cardsActions.button('cash'); check('tongits cash out', CS.mode === 'over')
}
{
  cardsActions.start('tongits', { stake: 50, auto: true })
  for (let i = 0; i < 60 * 300; i++) update(1 / 60)
  check('tongits bots-only keeps going', CS.mode === 'play', getCardsSnap().info)
}
process.exit(failures ? 1 : 0)
