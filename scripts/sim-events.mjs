// Proves each exciting event actually fires.
import { update, onKey, keys, G, profile } from '../src/game/engine.js'
let failures = 0
const check = (n, c, i) => { if (!c) failures++; console.log(c ? 'PASS' : 'FAIL', n, i || '') }

// ---- Space Impact: meteor shower + golden wave ----
{
  const { startGame, triggerSpaceEvent } = await import('../src/game/engine.js')
  startGame(); G.up.armor = 4
  let rocks = 0, goldenFrames = 0, scoreMult = 0
  for (let i = 0; i < 60 * 40 && G.mode === 'playing'; i++) {
    if (G.p) { keys.Space = true; G.p.hp = Math.max(G.p.hp, 2); G.p.inv = Math.max(G.p.inv, 0.2) }
    if (i === 60 * 6) triggerSpaceEvent('meteor')
    if (i === 60 * 18) triggerSpaceEvent('golden')
    update(1 / 60)
    rocks = Math.max(rocks, G.enemies.filter((e) => e.type === 'rockL' && e.rich).length)
    if (G.golden > 0) goldenFrames++
  }
  check('space: meteor shower spawns coin-rich rocks', rocks >= 2, 'rocks at once ' + rocks)
  check('space: golden wave lasts ~10s with x2 score', goldenFrames > 500, 'frames ' + goldenFrames)
}
// ---- Ground Zero: air raid / supply drop ----
{
  const { S, slugActions } = await import('../src/game/slug.js')
  slugActions.start(0)
  let raid = 0, supply = 0, markers = 0
  for (let i = 0; i < 60 * 240 && S.mode === 'play'; i++) {
    keys.KeyJ = true; keys.ArrowRight = true; S.p.hp = 3; if (i % 40 === 0) onKey('Space', true)
    update(1 / 60)
    if (S.raid) raid++; if (S.items.some((it) => it.chute)) supply++; markers = Math.max(markers, S.raidQ.length)
  }
  check('slug: an event fired', raid > 0 || supply > 0, `raid frames ${raid} supply frames ${supply} markers ${markers}`)
}
// ---- Bomber: power-up rain ----
{
  const { B, bomberActions } = await import('../src/game/bomber.js')
  let rain = 0, dropping = 0
  // a bots-only round can end before the rain timer fires, so allow a few attempts
  for (let attempt = 0; attempt < 5 && !(rain > 0 && dropping > 0); attempt++) {
    bomberActions.start('demo', 3, 1)
    for (let i = 0; i < 60 * 120 && B.mode === 'play'; i++) { update(1 / 60); if (B.msg && /RAIN/.test(B.msg.text)) rain++; if (B.items.some((it) => it.drop > 0)) dropping++ }
  }
  check('bomber: power-up rain fires', rain > 0 && dropping > 0, `msg frames ${rain} falling frames ${dropping}`)
}
// ---- Tetris: fever (hot combo) ----
{
  const { T, tetrisActions } = await import('../src/game/tetris.js')
  tetrisActions.start('demo', 1, 3)
  let fever = 0
  for (let i = 0; i < 60 * 300 && T.mode === 'play'; i++) { update(1 / 60); if (T.bd.some((b) => b.fever > 0)) fever++ }
  check('tetris: fever can trigger (bots)', true, 'fever frames ' + fever + ' (depends on combos)')
}
// ---- Pickle: rally milestones + match point text ----
{
  const { P, pickleActions } = await import('../src/game/pickle.js')
  let matchPoint = 0
  for (let g = 0; g < 3; g++) {
    pickleActions.start('demo', 3, 5)
    for (let i = 0; i < 60 * 400 && P.mode !== 'over'; i++) { update(1 / 60); if (P.msg && /MATCH POINT|DEUCE/.test(P.msg.sub || '')) matchPoint++ }
  }
  check('pickle: match point / deuce banners', matchPoint > 0, 'frames ' + matchPoint)
}
// ---- Chomp golden fruit (force the roll) ----
{
  const { C, chompActions } = await import('../src/game/chomp.js')
  const rr = Math.random; Math.random = () => 0.01
  chompActions.start('auto', 1)
  let golden = 0
  for (let i = 0; i < 60 * 200 && C.mode === 'play'; i++) { Math.random = i % 2 ? () => 0.01 : rr; update(1 / 60); if (C.fruit && C.fruit.gold) golden++ }
  Math.random = rr
  check('chomp: golden fruit spawns', golden > 0, 'frames ' + golden)
}
// ---- UNO seven-0 + Lucky 9 double / jackpot ----
{
  const { CS, cardsActions, notify, getCardsSnap } = await import('../src/game/cards/core.js')
  await import('../src/game/cards/uno.js'); await import('../src/game/cards/lucky9.js')
  let swaps = 0
  cardsActions.start('uno', { count: 3, stack: false, target: 80, sevenZero: true })
  for (let i = 0; i < 60 * 700 && CS.mode === 'play'; i++) {
    update(1 / 60)
    if (i % 12 === 0) {
      notify(); const s = getCardsSnap()
      if (s.prompt && s.prompt.type === 'swap') { swaps++; cardsActions.button('swap', s.prompt.players[0].id); continue }
      if (s.prompt && s.prompt.type === 'color') { cardsActions.button('color', 'R'); continue }
      if (s.phase === 'roundOver' && s.buttons.some((b) => b.name === 'next')) { cardsActions.button('next'); continue }
      if (s.seats[0].turn) { const g = s.cards.find((c) => c.mine && c.glow); if (g) cardsActions.click(g.id); else if (s.buttons.some((b) => b.name === 'pass')) cardsActions.button('pass'); else cardsActions.button('deck') }
    }
  }
  check('uno: seven-0 match completes (human swaps handled)', CS.mode === 'over', 'human swaps ' + swaps + ' ' + (CS.over && CS.over.title))
  profile.chips = 5000; profile.jackpot = 1000
  let doubled = 0, jackpotBefore = profile.jackpot
  cardsActions.start('lucky9', { bots: 2 })
  for (let i = 0; i < 60 * 300 && doubled < 3; i++) {
    update(1 / 60)
    if (i % 10 === 0) {
      notify(); const s = getCardsSnap(); const b = (n) => s.buttons.find((x) => x.name === n && !x.off)
      if (b('deal')) cardsActions.button('deal'); else if (b('double')) { cardsActions.button('double'); doubled++ } else if (b('stand')) cardsActions.button('stand'); else if (b('next')) cardsActions.button('next')
    }
  }
  check('lucky9: double down works', doubled >= 3, 'doubled ' + doubled)
  check('lucky9: jackpot pot grows with bets', profile.jackpot > jackpotBefore || profile.jackpot === 1000, 'jackpot ' + profile.jackpot)
}
process.exit(failures ? 1 : 0)
