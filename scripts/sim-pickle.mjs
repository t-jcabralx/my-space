import { G, update, onKey } from '../src/game/engine.js'
import { P, pickleActions } from '../src/game/pickle.js'
for (const [type, diff] of [['demo', 3], ['demo', 1], ['bot', 2]]) {
  pickleActions.start(type, diff, 7)
  const reasons = {}
  let frames = 0, lastMsg = null
  const bots = type === 'bot'
  for (let i = 0; i < 60 * 60 * 25 && P.mode !== 'over'; i++) {
    if (bots && P.phase === 'serve' && i % 30 === 0) onKey('KeyF', true)
    if (bots && P.phase === 'rally' && i % 7 === 0) onKey('KeyF', true)
    update(1 / 60); frames++
    if (P.msg && P.msg !== lastMsg) { lastMsg = P.msg; reasons[P.msg.text] = (reasons[P.msg.text] || 0) + 1 }
  }
  console.log(type, 'diff', diff, 'mode', P.mode, 'score', P.score, 'secs', (frames / 60) | 0, 'bestRally', P.bestRally, JSON.stringify(reasons))
}
