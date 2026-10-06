import { update, keys } from '../src/game/engine.js'
import { C4, c4Actions, findLine, botMove, c4Net } from '../src/game/connect4.js'
import { SN, snakeActions } from '../src/game/snake.js'
import { BK, breakerActions } from '../src/game/breaker.js'
import { MS, minesActions, LV } from '../src/game/mines.js'
let fail = 0
const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m) } }
// ---- connect four ----
{
  const b = Array.from({ length: 6 }, () => Array(7).fill(0)); for (let c = 0; c < 4; c++) b[5][c] = 1
  ok(findLine(b, 1) && !findLine(b, 2), 'detects four in a row')
  const b2 = Array.from({ length: 6 }, () => Array(7).fill(0)); b2[5][0] = 1; b2[5][1] = 1; b2[5][2] = 1
  ok(botMove(b2, 3, 2) === 3 || botMove(b2, 3, 2) === 3, 'hard bot blocks an open three')
  const b3 = Array.from({ length: 6 }, () => Array(7).fill(0)); b3[5][0] = 2; b3[5][1] = 2; b3[5][2] = 2
  ok(botMove(b3, 2, 2) === 3, 'bot takes a winning move')
  let bw = 0
  for (const diff of [1, 2, 3]) { c4Actions.start({ type: 'bot', diff }); let f = 0; while (C4.mode === 'play' && f < 60 * 120) { if (C4.turn === 1) { const cols = [0, 1, 2, 3, 4, 5, 6].filter((c) => C4.b[0][c] === 0); c4Actions.play(cols[(Math.random() * cols.length) | 0]) } update(1 / 20); f++; } ; ok(C4.mode === 'over', 'c4 ends diff ' + diff); if (C4.win === 2) bw++ }
  ok(bw >= 2, 'the bot beats a random player (' + bw + '/3)')
  console.log('PASS connect four')
  c4Actions.stop()
}
// ---- snake ----
for (const type of ['solo', 'bot', '2p']) {
  snakeActions.start({ type }); let f = 0
  while (SN.mode === 'play' && f < 60 * 240) { if (type === 'solo') { const h = SN.s[0].body[0], t = SN.food; const dx = t[0] - h[0], dy = t[1] - h[1]; snakeActions.turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 0 : 2) : (dy < 0 ? 1 : 3)) } update(1 / 60); f++ }
  ok(SN.mode === 'over', 'snake ends ' + type)
  console.log('PASS snake', type, JSON.stringify(SN.over).slice(0, 80))
  snakeActions.stop()
}
// ---- breaker ----
{
  breakerActions.start(); let f = 0, lvlSeen = 1
  while (BK.mode === 'play' && f < 60 * 900) { const b = BK.balls[0]; if (b) { breakerActions.pointer('move', b.x + (Math.random() - 0.5) * 6); if (BK.stuck) breakerActions.launch() } update(1 / 60); f++; lvlSeen = Math.max(lvlSeen, BK.level + 1); ok(BK.balls.every((q) => Number.isFinite(q.x) && Number.isFinite(q.y)), 'ball finite') }
  ok(BK.score > 500 && lvlSeen >= 2, 'breaker progress: level ' + lvlSeen + ' score ' + BK.score)
  console.log('PASS breaker level', lvlSeen, 'score', BK.score, BK.over && BK.over.win ? 'WIN' : 'over')
  breakerActions.stop()
}
// ---- mines ----
{
  for (const lv of [0, 1, 2]) {
    minesActions.start({ lv }); minesActions.reveal(Math.floor(MS.cells.length / 2))
    ok(!MS.cells[Math.floor(MS.cells.length / 2)].m, 'first click is safe')
    ok(MS.cells.filter((c) => c.m).length === LV[lv].m, 'mine count')
    // simple solver: reveal cells that are provably safe, otherwise guess
    let guard = 0
    while (MS.state === 'run' && guard++ < 2000) {
      let acted = false
      for (let i = 0; i < MS.cells.length && MS.state === 'run'; i++) {
        const c = MS.cells[i]; if (!c.o || c.n === 0 || c.m) continue
        const x = i % MS.w, y = (i / MS.w) | 0, nbs = []
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < MS.w && yy < MS.h) nbs.push(yy * MS.w + xx) }
        const fl = nbs.filter((j) => MS.cells[j].f), cl = nbs.filter((j) => !MS.cells[j].o && !MS.cells[j].f)
        if (!cl.length) continue
        if (fl.length === c.n) { for (const j of cl) minesActions.reveal(j); acted = true }
        else if (fl.length + cl.length === c.n) { for (const j of cl) minesActions.flag(j); acted = true }
      }
      if (!acted && MS.state === 'run') { const hid = MS.cells.map((c, i) => (!c.o && !c.f ? i : -1)).filter((i) => i >= 0); minesActions.reveal(hid[(Math.random() * hid.length) | 0]) }
    }
    ok(MS.state === 'won' || MS.state === 'lost', 'mines ends lv ' + lv)
    console.log('PASS mines', LV[lv].name, MS.state, MS.secs + 's')
    minesActions.stop()
  }
}
console.log(fail ? 'FAIL arcade3' : 'PASS arcade3'); process.exit(fail ? 1 : 0)
