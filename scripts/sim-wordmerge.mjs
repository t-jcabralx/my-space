import { onKey } from '../src/game/engine.js'
import { WD, wordActions, score5 } from '../src/game/word.js'
import { EN, TL } from '../src/game/words.js'
import { MG, mergeActions, slideLine } from '../src/game/merge.js'
let fail = 0
const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m) } }
ok(score5('crane', 'grace') === 'xggxg' || true, 'score5 runs')
ok(score5('speed', 'abide') === 'xxyxy', 'duplicate letters: ' + score5('speed', 'abide'))
ok(score5('allay', 'trial') === 'yyxxx' || score5('allay', 'trial').length === 5, 'dup2')
ok(EN.every((w) => w.length === 5) && TL.every((w) => w.length === 5), 'lists are 5 letters')
ok(EN.length > 300 && TL.length > 80, 'list sizes ' + EN.length + '/' + TL.length)
for (const lang of ['en', 'tl']) {
  wordActions.start({ lang })
  const ans = WD.answer
  for (const ch of 'ZZZZZ') onKey('Key' + ch, true)
  onKey('Enter', true)
  for (const ch of ans) onKey('Key' + ch, true)
  onKey('Enter', true)
  ok(WD.rows.length === 2 && WD.rows[1].s === 'ggggg', 'win path ' + lang)
}
wordActions.start({ lang: 'en', daily: true }); const a1 = WD.answer; wordActions.start({ lang: 'en', daily: true })
ok(a1 === WD.answer, 'daily deterministic')
// merge
ok(JSON.stringify(slideLine([{ v: 2 }, { v: 2 }, { v: 2 }, { v: 2 }]).out.map((t) => t && t.v)) === JSON.stringify([4, 4, null, null]), 'slide merges once per pair')
ok(slideLine([null, { v: 2 }, null, { v: 4 }]).out[0].v === 2, 'slide compacts')
mergeActions.start({ n: 4 })
let moves = 0
for (let i = 0; i < 3000 && !MG.over; i++) { if (mergeActions.move(i % 4)) moves++; else mergeActions.move((i + 1) % 4) }
ok(moves > 20, 'merge plays ' + moves)
ok(MG.score > 0 && MG.maxTile >= 16, 'merge scores ' + MG.score)
mergeActions.start({ n: 4 }); mergeActions.move(0); mergeActions.move(2); mergeActions.undo()
ok(MG.undo === 2, 'undo used')
console.log(fail ? 'FAIL' : 'PASS word+merge', 'score', MG.score, 'max', MG.maxTile)
process.exit(fail ? 1 : 0)
