import { update, keys } from '../src/game/engine.js'
import { RT, rhythmActions, SONGS, buildChart } from '../src/game/rhythm.js'
let fail = 0
const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m) } }
for (const s of SONGS) {
  const ch = buildChart(s)
  ok(ch.length > 60, 'chart size ' + s.name + ' ' + ch.length)
  ok(ch.every((n) => n.lane >= 0 && n.lane < 4 && Number.isFinite(n.t)), 'chart valid')
}
const play = (song, skill) => {
  rhythmActions.start({ song })
  let f = 0
  const K = ['KeyD', 'KeyF', 'KeyJ', 'KeyK']
  while (RT.mode === 'play' && f < 60 * 400) {
    // an "autoplayer" pressing each lane when a note is within skill-dependent timing error
    for (let l = 0; l < 4; l++) {
      const n = RT.notes.find((q) => q.lane === l && !q.hit && !q.miss && q.t - RT.st > -0.2)
      const hold = RT.holds[l]
      if (hold) keys[K[l]] = RT.st < hold.t + hold.len - 0.02
      else keys[K[l]] = !!(n && Math.abs(n.t - RT.st + skill.off) < 0.02 && Math.random() < skill.acc)
    }
    update(1 / 60); f++
  }
  for (const k of K) keys[k] = false
  console.log('PASS rhythm', SONGS[song].name, 'grade', RT.over.grade, 'acc', (RT.over.acc * 100).toFixed(1), 'combo', RT.over.maxCombo, 'score', RT.over.score, 'clear', RT.over.clear)
  ok(RT.mode === 'over', 'song ends')
  return RT.over
}
const a = play(0, { acc: 1, off: 0 })
ok(a.clear && a.acc > 0.8, 'good player clears song 1: ' + a.acc)
const b = play(4, { acc: 0.2, off: 0 })
ok(!b.clear || b.acc < 0.6, 'bad player on the hardest song fails or scores low')
play(2, { acc: 0.9, off: 0.03 })
rhythmActions.stop()
process.exit(fail ? 1 : 0)
