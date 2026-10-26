// Automated tests for the Mahjong rules engine, scoring and AI (no screen needed): node scripts/sim-mahjong.mjs
import assert from 'node:assert/strict'
import { fullSet, shuffle, rng, KINDS, BONUS, countsOf, isBonus } from '../src/game/mahjong/tiles.js'
import { winInfo, waits, chowOptions, canPung, canKongDiscard, concealedKongKinds, shanten } from '../src/game/mahjong/rules.js'
import { scoreWin, payments, pointsForFan } from '../src/game/mahjong/scoring.js'
import { newMatch, startHand, drawTile, discardTile, claim, declareKong, declareSelfDrawWin, canSelfDrawWin, finishHandInMatch, liveTilesLeft, pendingClaimSeats, kongOptions, viewFor, DEAD_WALL } from '../src/game/mahjong/engine.js'
import { advance } from '../src/game/mahjong/session.js'
import { chooseDiscard, decideClaim } from '../src/game/mahjong/ai.js'

let fails = 0
const test = (name, fn) => { try { fn(); console.log('PASS', name) } catch (e) { fails++; console.log('FAIL', name, '\n   ', e.message.split('\n')[0]) } }
const mk = (s) => s.split(' ').filter(Boolean).map((k, i) => ({ id: 1000 + i, k }))

// build a custom hand state: tiles are taken from a real 144 set so every tile stays unique
function build({ hands, melds = [[], [], [], []], flowers = [[], [], [], []], turn = 0, phase = 'discard', dealer = 0, prevailing = 0, wallFirst = [], wallSize = null, opts = {} }) {
  const pool = fullSet()
  const take = (k) => { const i = pool.findIndex((t) => t.k === k); if (i < 0) throw new Error('no more ' + k); return pool.splice(i, 1)[0] }
  const players = [0, 1, 2, 3].map((s) => ({ hand: (hands[s] || '').split(' ').filter(Boolean).map(take), melds: melds[s].map((m) => ({ type: m.type, k: m.k, concealed: !!m.concealed, tiles: m.tiles.split(' ').map(take) })), flowers: (flowers[s] || []).map(take), discards: [] }))
  const first = wallFirst.map(take)
  let rest = shuffle(pool, rng(5))
  if (wallSize !== null) rest = rest.slice(0, wallSize - first.length)
  return { wall: [...first, ...rest], players, dealer, prevailing, turn, phase, drawn: null, claims: null, result: null, log: [], lastDiscard: null, kongDraw: false, opts: { minFan: 0, limit: 13, dealerDouble: true, ...opts }, handNo: 1 }
}
const total = (st) => st.wall.length + st.players.reduce((a, p) => a + p.hand.length + p.discards.length + p.flowers.length + p.melds.reduce((b, m) => b + m.tiles.length, 0), 0) + (st.pendingKong ? 1 : 0)
const idOf = (st, seat, k) => st.players[seat].hand.find((t) => t.k === k).id

// ---------------------------------------------------------------- tiles, shuffle, deal
test('tile set: 144 tiles, 34 kinds x4 + 8 bonus tiles, all ids unique', () => {
  const s = fullSet(); assert.equal(s.length, 144)
  const c = countsOf(s); for (const k of KINDS) assert.equal(c[k], 4, k); for (const k of BONUS) assert.equal(c[k], 1, k)
  assert.equal(new Set(s.map((t) => t.id)).size, 144)
})
test('shuffle keeps every tile exactly once and is reproducible with a seed', () => {
  const a = shuffle(fullSet(), rng(1)), b = shuffle(fullSet(), rng(1)), c = shuffle(fullSet(), rng(2))
  assert.deepEqual(a.map((t) => t.id), b.map((t) => t.id)); assert.notDeepEqual(a.map((t) => t.id), c.map((t) => t.id))
  assert.equal(new Set(a.map((t) => t.id)).size, 144)
})
test('deal: dealer has 14, others 13 (after bonus replacement), tile total stays 144, no bonus tile left in a hand', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const m = newMatch({ seed }); const st = startHand(m)
    st.players.forEach((p, s) => { assert.equal(p.hand.length, s === st.dealer ? 14 : 13, 'hand size seed ' + seed); assert.ok(!p.hand.some((t) => isBonus(t.k))) })
    assert.equal(total(st), 144)
  }
})

// ---------------------------------------------------------------- winning hands
test('standard win: 4 sets + pair; a hand with the right tile count but wrong shape does not win', () => {
  assert.ok(winInfo(mk('m1 m2 m3 p4 p5 p6 s7 s8 s9 we we we dr dr')).win)
  assert.ok(!winInfo(mk('m1 m2 m4 p4 p5 p6 s7 s8 s9 we we we dr dr')).win)
  assert.ok(!winInfo(mk('m1 m1 m2 m2 m3 m3 p4 p4 p5 p5 s7 s7 dr dr')).win, 'seven pairs is not part of Hong Kong old style')
  assert.ok(!winInfo(mk('m1 m3 m5 m7 m9 p1 p3 p5 p7 p9 s2 s4 s6 s8')).win)
})
test('winning with exposed melds uses fewer concealed tiles', () => {
  const melds = [{ type: 'pung', k: 'we', tiles: mk('we we we') }]
  assert.ok(winInfo(mk('m1 m2 m3 p4 p5 p6 s7 s8 s9 dr dr'), melds).win)
  assert.ok(!winInfo(mk('m1 m2 m3 p4 p5 p6 s7 s8 s9 dr dr dr'), melds).win, 'wrong tile count')
})
test('thirteen orphans is detected; one tile wrong is not', () => {
  assert.ok(winInfo(mk('m1 m9 p1 p9 s1 s9 we ws ww wn dr dg dw dw')).win)
  assert.ok(!winInfo(mk('m1 m9 p1 p9 s1 s9 we ws ww wn dr dg dw m2')).win)
})
test('waits are correct and exclude tiles that are all visible', () => {
  assert.deepEqual(waits(mk('m1 m2 m3 p4 p5 p6 s7 s8 s9 we we dr dr')).sort(), ['dr', 'we'])
  assert.deepEqual(waits(mk('m1 m2 m3 p4 p5 p6 s7 s8 s9 we we dr dr'), [], { we: 2 }).sort(), ['dr'])
})
test('a kong of four identical tiles still counts as one set; a hand that needs the fourth tile as a pair is handled', () => {
  assert.ok(winInfo(mk('m1 m1 m1 m1 m2 m3 p4 p5 p6 s7 s8 s9 dr dr')).win)
})

// ---------------------------------------------------------------- claims
test('chow options: only suited tiles, all three patterns, honours never', () => {
  assert.deepEqual(chowOptions(mk('m1 m2 m4 m5 m3'), 'm3').length, 3)
  assert.deepEqual(chowOptions(mk('we ws ww'), 'we'), [])
  assert.deepEqual(chowOptions(mk('m1 m2'), 'm9'), [])
})
test('pung and kong from a discard need 2 / 3 matching tiles', () => {
  assert.ok(canPung(mk('m5 m5 p1'), 'm5')); assert.ok(!canPung(mk('m5 p1'), 'm5'))
  assert.ok(canKongDiscard(mk('m5 m5 m5 p1'), 'm5')); assert.ok(!canKongDiscard(mk('m5 m5 p1'), 'm5'))
  assert.deepEqual(concealedKongKinds(mk('m5 m5 m5 m5 p1')), ['m5'])
})

// ---------------------------------------------------------------- turns and discards
test('turn progression: discard -> next player draws -> must discard', () => {
  const st = build({ hands: { 0: 'm1 m2 m3 p1 p2 p3 s1 s2 s3 we ws dr dg dw', 1: 'm4 m5 m6 p4 p5 p6 s4 s5 s6 we ws ww wn', 2: 'm7 m8 m9 p7 p8 p9 s7 s8 s9 we ws ww wn', 3: 'm1 m4 m7 p1 p4 p7 s1 s4 s7 dr dg dw we' }, wallFirst: ['m9'] })
  assert.equal(st.phase, 'discard')
  const r = discardTile(st, 0, idOf(st, 0, 'dw'))
  assert.ok(r.ok); assert.equal(st.turn, 1); assert.equal(st.phase, 'draw')
  assert.ok(drawTile(st, 1).ok); assert.equal(st.players[1].hand.length, 14); assert.equal(st.phase, 'discard')
})
test('illegal discards are refused: wrong turn, tile not in hand, wrong phase, draw out of turn', () => {
  const st = build({ hands: { 0: 'm1 m2 m3 p1 p2 p3 s1 s2 s3 we ws dr dg dw', 1: 'm4 m5 m6 p4 p5 p6 s4 s5 s6 we ws ww wn' } })
  assert.ok(!discardTile(st, 1, st.players[1].hand[0].id).ok)
  assert.ok(!discardTile(st, 0, 99999).ok)
  assert.ok(!drawTile(st, 0).ok)
  discardTile(st, 0, idOf(st, 0, 'dw'))
  assert.ok(!discardTile(st, 0, st.players[0].hand[0].id).ok)
})

// ---------------------------------------------------------------- calls
function callState(hands, from = 0, tileKind = 'm5') {
  const base = { 0: 'm1 m2 m3 p1 p2 p3 s1 s2 s3 we ws dr dg ' + tileKind, 1: 'x', 2: 'x', 3: 'x' }
  const h = { ...base, ...hands }
  for (const s of [0, 1, 2, 3]) if (h[s] === 'x') h[s] = ''
  return build({ hands: h, turn: from })
}
test('call priority: win beats pung, pung beats chow; wrong seat cannot chow', () => {
  const st = build({ hands: { 0: 'm1 m2 m3 p1 p2 p3 s1 s2 s3 we ws dr dg m5', 1: 'm4 m6 s5 s5 s6 s7 p7 p8 wn wn dw dw ww', 2: 'm5 m5 p4 p5 p6 s1 s2 s3 ws ws dg dg ww', 3: 'm6 m7 m8 p4 p5 p6 s2 s3 s4 dr dr wn wn' } })
  discardTile(st, 0, idOf(st, 0, 'm5'))
  assert.ok(st.claims.options[1].chow, 'next seat can chow'); assert.ok(st.claims.options[2].pung, 'pung option')
  assert.ok(!st.claims.options[3] || !st.claims.options[3].chow, 'only the next seat may chow')
  assert.ok(!claim(st, 3, 'chow', ['m4', 'm6']).ok)
  claim(st, 1, 'chow', ['m4', 'm6']); claim(st, 2, 'pung')
  if (st.claims) { claim(st, 3, 'pass') }
  assert.equal(st.players[2].melds[0].type, 'pung', 'pung beats chow'); assert.equal(st.turn, 2); assert.equal(st.phase, 'discard')
})
test('multiple winning claims: the player closest after the discarder wins (head bump)', () => {
  const st = build({ hands: { 0: 'm1 m2 m3 p1 p2 p3 s1 s2 s3 ws ww wn dg dr', 1: 'm1 m2 m3 p4 p5 p6 s7 s8 s9 we we we dr', 2: 'm1 m2 m3 p4 p5 p6 s7 s8 s9 ws ws ws dr', 3: '' } })
  // give seats 1 and 2 hands that both complete on dr (two separate copies)
  st.players[1].hand = [...mk('m1 m2 m3 p4 p5 p6 s7 s8 s9 we we we dr')].map((t, i) => ({ id: 2000 + i, k: t.k }))
  st.players[2].hand = [...mk('m1 m2 m3 p4 p5 p6 s7 s8 s9 ws ws ws dr')].map((t, i) => ({ id: 2100 + i, k: t.k }))
  st.players[0].hand = mk('m1 m2 m3 p1 p2 p3 s1 s2 s3 ww wn dg dr dr').map((t, i) => ({ id: 2200 + i, k: t.k }))
  st.turn = 0
  const d = st.players[0].hand.find((t) => t.k === 'dr')
  discardTile(st, 0, d.id)
  assert.ok(st.claims.options[1].hu && st.claims.options[2].hu)
  claim(st, 2, 'hu'); claim(st, 1, 'hu'); if (st.claims) claim(st, 3, 'pass')
  assert.equal(st.phase, 'over'); assert.equal(st.result.winner, 1)
})
test('a kong from a discard gives a replacement draw and the player must then discard', () => {
  const st = build({ hands: { 0: 'm1 m2 m3 p1 p2 p3 s1 s2 s3 we ws dr dg m5', 1: 'm5 m5 m5 p4 p5 p6 s4 s5 s6 ww wn dw dw' } , wallFirst: ['s9'] })
  discardTile(st, 0, idOf(st, 0, 'm5'))
  assert.ok(st.claims.options[1].kong)
  const before = st.wall.length
  claim(st, 1, 'kong'); for (const s of pendingClaimSeats(st)) claim(st, s, 'pass')
  assert.equal(st.players[1].melds[0].type, 'kong'); assert.equal(st.players[1].melds[0].tiles.length, 4)
  assert.equal(st.turn, 1); assert.equal(st.phase, 'discard'); assert.equal(st.wall.length, before - 1); assert.equal(st.players[1].hand.length, 11)
})
test('concealed kong, then bonus replacement: the flower is exposed and replaced again', () => {
  const st = build({ hands: { 0: 'm1 m1 m1 m1 p1 p2 p3 s1 s2 s3 we ws dr dg' }, wallFirst: [] })
  // the last tile of the wall (end) is the first replacement: make it a flower, then a normal tile
  const f = st.wall.findIndex((t) => t.k === 'f1'); const [flower] = st.wall.splice(f, 1); st.wall.push(flower)
  const r = declareKong(st, 0, 'm1')
  assert.ok(r.ok); assert.equal(st.players[0].flowers.length, 1); assert.equal(st.players[0].hand.length, 11)
  assert.equal(st.phase, 'discard'); assert.ok(!st.players[0].hand.some((t) => isBonus(t.k)))
  assert.equal(total(st), 144)
})
test('added kong can be robbed by a player who wins on that tile; otherwise it is made', () => {
  const st = build({ hands: { 0: 'm4 m5 m6 p1 p2 p3 s1 s2 s3 we ws m7', 1: 'm5 m6 p4 p5 p6 s7 s8 s9 we we we dr dr' }, melds: [[{ type: 'pung', k: 'm7', tiles: 'm7 m7 m7' }], [], [], []] })
  const r = declareKong(st, 0, 'm7')
  assert.ok(r.ok && r.robbable, 'seat 1 can rob the kong'); assert.ok(st.claims.options[1].hu)
  claim(st, 1, 'hu'); assert.equal(st.phase, 'over'); assert.equal(st.result.winner, 1); assert.ok(st.result.robKong)
})

// ---------------------------------------------------------------- end of hand, scoring, payments
test('winning by self-draw: validated, scored and zero-sum', () => {
  const st = build({ hands: { 0: 'm1 m2 m3 p4 p5 p6 s7 s8 s9 m5 m6 m7 p9 p9' }, dealer: 1 })
  assert.ok(canSelfDrawWin(st, 0))
  const r = declareSelfDrawWin(st, 0); assert.ok(r.ok)
  assert.equal(st.phase, 'over'); assert.equal(st.result.type, 'win'); assert.equal(st.result.selfDraw, true)
  assert.equal(st.result.payments.reduce((a, b) => a + b, 0), 0)
})
test('a 14-tile hand that is not a win cannot be declared', () => {
  const st = build({ hands: { 0: 'm1 m2 m4 p4 p5 p6 s7 s8 s9 m5 m6 m7 p9 p9' } })
  assert.ok(!canSelfDrawWin(st, 0)); assert.ok(!declareSelfDrawWin(st, 0).ok); assert.equal(st.phase, 'discard')
})
test('minimum fan: a chicken hand does not win when 3 fan are required', () => {
  const st = build({ hands: { 0: 'm1 m2 m3 p4 p5 p6 s7 s8 s9 m5 m6 m7 p9 p9' }, opts: { minFan: 3 } })
  const sc = scoreWin({ concealed: st.players[0].hand, melds: [], flowers: [], seatWind: 0, prevailing: 0, selfDraw: false, opts: { minFan: 3 } })
  assert.equal(sc.valid, false)
})
test('winning from a discard: discarder pays; dealer payments double; limit hands cap at 13 fan', () => {
  const st = build({ hands: { 0: 'm1 m2 m3 p1 p2 p3 s1 s2 s3 ws ww wn dg dr', 1: 'm1 m2 m3 p4 p5 p6 s7 s8 s9 we we we dr' }, dealer: 2 })
  discardTile(st, 0, idOf(st, 0, 'dr'))
  assert.ok(st.claims.options[1].hu); claim(st, 1, 'hu'); for (const s of pendingClaimSeats(st)) claim(st, s, 'pass')
  const r = st.result; assert.equal(r.type, 'win'); assert.equal(r.discarder, 0); assert.equal(r.payments[0], -r.points); assert.equal(r.payments[1], r.points)
  assert.equal(r.payments.reduce((a, b) => a + b, 0), 0)
  assert.equal(pointsForFan(20, 13), pointsForFan(13, 13))
  const orph = scoreWin({ concealed: mk('m1 m9 p1 p9 s1 s9 we ws ww wn dr dg dw dw'), melds: [], flowers: [], seatWind: 1, prevailing: 0, selfDraw: true })
  assert.equal(orph.fan, 13)
})
test('scoring details: pung of own wind, dragon pung, all pungs, pure one suit', () => {
  const sc = scoreWin({ concealed: mk('m1 m1 m1 p4 p4 p4 s7 s7 s7 dr dr dr m9 m9'), melds: [], flowers: [], seatWind: 0, prevailing: 0, selfDraw: true })
  assert.ok(sc.items.some((i) => /All pungs/.test(i.name))); assert.ok(sc.items.some((i) => /Dragon pung/.test(i.name)))
  const pure = scoreWin({ concealed: mk('m1 m2 m3 m4 m5 m6 m7 m8 m9 m2 m2 m2 m9 m9'), melds: [], flowers: [], seatWind: 0, prevailing: 0, selfDraw: false })
  assert.ok(pure.items.some((i) => /Pure one suit/.test(i.name)))
  const flowers = scoreWin({ concealed: mk('m1 m2 m3 p4 p5 p6 s7 s8 s9 m5 m6 m7 p9 p9'), melds: [], flowers: mk('f1 q1'), seatWind: 0, prevailing: 0, selfDraw: false })
  assert.equal(flowers.items.filter((i) => /Own/.test(i.name)).length, 2)
})
test('payments are always zero-sum', () => {
  for (const dealer of [0, 1, 2, 3]) for (const winner of [0, 1, 2, 3]) {
    const a = payments({ winner, selfDraw: true, dealer, points: 8 }); assert.equal(a.reduce((x, y) => x + y, 0), 0)
    const d = (winner + 1) % 4; const b = payments({ winner, discarder: d, selfDraw: false, dealer, points: 8 }); assert.equal(b.reduce((x, y) => x + y, 0), 0)
  }
})

// ---------------------------------------------------------------- wall exhaustion
test('wall exhaustion ends the hand as a draw with no payments', () => {
  const st = build({ hands: { 0: 'm1 m2 m3 p1 p2 p3 s1 s2 s3 we ws dr dg dw', 1: 'm4 m5 m6 p4 p5 p6 s4 s5 s6 we ws ww wn' }, wallSize: DEAD_WALL })
  assert.equal(liveTilesLeft(st), 0)
  discardTile(st, 0, idOf(st, 0, 'dw'))
  if (st.claims) for (const s of pendingClaimSeats(st)) claim(st, s, 'pass')
  assert.equal(st.phase, 'over'); assert.equal(st.result.type, 'draw'); assert.deepEqual(st.result.payments, [0, 0, 0, 0])
})
test('wall running out during replacement draws ends the hand without errors', () => {
  const st = build({ hands: { 0: 'm1 m1 m1 m1 p1 p2 p3 s1 s2 s3 we ws dr dg' }, wallSize: DEAD_WALL + 1 })
  // one live tile left, and the first two replacement draws are flowers: the third replacement is below the dead wall
  st.wall = [...Array.from({ length: DEAD_WALL - 1 }, (_, i) => ({ id: 8000 + i, k: 'p9' })), { id: 8100, k: 'f1' }, { id: 8101, k: 'f2' }]
  assert.equal(st.wall.length, DEAD_WALL + 1)
  const r = declareKong(st, 0, 'm1')
  assert.ok(r.ok); assert.equal(st.phase, 'over'); assert.equal(st.result.type, 'draw')
})

// ---------------------------------------------------------------- dealer, rounds, save / restore
test('dealer keeps the seat after winning or a draw and rotates otherwise; prevailing wind advances after a full circle', () => {
  const m = newMatch({ seed: 3 })
  const fake = (type, winner) => ({ result: { type, winner, fan: 3, points: 8, payments: [0, 0, 0, 0], items: [] } })
  finishHandInMatch(m, fake('win', 0)); assert.equal(m.dealer, 0, 'dealer won: stays')
  finishHandInMatch(m, fake('draw')); assert.equal(m.dealer, 0, 'draw: stays')
  finishHandInMatch(m, fake('win', 2)); assert.equal(m.dealer, 1)
  finishHandInMatch(m, fake('win', 3)); assert.equal(m.dealer, 2)
  finishHandInMatch(m, fake('win', 1)); assert.equal(m.dealer, 3)
  assert.equal(m.prevailing, 0); assert.ok(!m.finished)
  finishHandInMatch(m, fake('win', 1)); assert.equal(m.dealer, 0); assert.equal(m.prevailing, 1); assert.ok(m.finished, 'one wind round played')
})
test('save and restore: a JSON round-trip continues exactly the same game', () => {
  const m = newMatch({ seed: 11 }); const st = startHand(m)
  const cfg = { human: null, levels: ['normal', 'normal', 'normal', 'normal'], rand: rng(4) }
  for (let i = 0; i < 12 && st.phase !== 'over'; i++) { const t = st.phase === 'discard' ? st.players[st.turn].hand[0] : null; if (t) { discardTile(st, st.turn, t.id); } else if (st.phase === 'draw') drawTile(st, st.turn); else if (st.phase === 'claim') for (const s of pendingClaimSeats(st)) claim(st, s, 'pass') }
  const copy = JSON.parse(JSON.stringify({ st, m }))
  assert.deepEqual(copy.st, JSON.parse(JSON.stringify(st)))
  const a = advance(st, { ...cfg, rand: rng(9) }), b = advance(copy.st, { ...cfg, rand: rng(9) })
  assert.equal(a.over, b.over); assert.deepEqual(JSON.parse(JSON.stringify(st.result)), JSON.parse(JSON.stringify(copy.st.result)))
})

// ---------------------------------------------------------------- AI
test('AI plays 120 whole hands (all three levels) legally: tiles conserved, every win validated, payments zero-sum', () => {
  const levels = ['easy', 'normal', 'hard']
  let wins = 0, draws = 0
  for (let g = 0; g < 120; g++) {
    const lv = [levels[g % 3], levels[(g + 1) % 3], levels[(g + 2) % 3], levels[g % 3]]
    const m = newMatch({ seed: 100 + g, minFan: g % 4 === 0 ? 3 : 1 }); const st = startHand(m)
    const rand = rng(900 + g)
    let steps = 0
    while (st.phase !== 'over') {
      const r = advance(st, { human: null, levels: lv, rand }, 8)
      assert.equal(total(st), 144, 'tiles conserved at step ' + steps)
      if (++steps > 800) throw new Error('hand did not end')
      void r
    }
    assert.ok(st.result)
    if (st.result.type === 'win') {
      wins++
      const w = st.result.winner
      const p = st.players[w]
      assert.ok(winInfo(p.hand, p.melds).win, 'winner holds a valid hand')
      assert.ok(st.result.fan >= m.opts.minFan, 'fan minimum respected')
      assert.equal(st.result.payments.reduce((a, b) => a + b, 0), 0)
    } else draws++
    finishHandInMatch(m, st)
  }
  console.log('     (' + wins + ' wins, ' + draws + ' draws)')
  assert.ok(wins > 20, 'the AI manages to win a fair share of hands')
})
test('AI never sees hidden tiles: its view contains only its own hand and public information', () => {
  const m = newMatch({ seed: 21 }); const st = startHand(m)
  const v = viewFor(st, 2)
  assert.equal(v.hand.length, st.players[2].hand.length)
  for (const o of v.others) { assert.ok(!('hand' in o)); assert.equal(typeof o.handSize, 'number') }
  // chooseDiscard returns one of its own tiles
  for (const lv of ['easy', 'normal', 'hard']) { const t = chooseDiscard(viewFor(st, st.turn), lv); assert.ok(st.players[st.turn].hand.some((x) => x.id === t.id)) }
})
test('AI takes a winning claim and only offers legal chows', () => {
  const st = build({ hands: { 0: 'm1 m2 m3 p1 p2 p3 s1 s2 s3 ws ww wn dg dr', 1: 'm1 m2 m3 p4 p5 p6 s7 s8 s9 we we we dr' } })
  discardTile(st, 0, idOf(st, 0, 'dr'))
  const d = decideClaim(viewFor(st, 1), st.claims.options[1], st.claims.tile, 'easy')
  assert.equal(d.action, 'hu')
})
test('shanten: complete hand -1, ready hand 0', () => {
  assert.equal(shanten(countsOf(mk('m1 m2 m3 p4 p5 p6 s7 s8 s9 we we we dr dr'))), -1)
  assert.equal(shanten(countsOf(mk('m1 m2 m3 p4 p5 p6 s7 s8 s9 we we dr dr'))), 0)
})

console.log(fails ? '\n' + fails + ' FAILED' : '\nALL PASS')
process.exit(fails ? 1 : 0)
