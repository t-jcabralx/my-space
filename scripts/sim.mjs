// Headless smoke test: plays every mission with a simple bot and checks nothing throws.
import { G, update, startGame, onKey, keys, chalProgress, toShop, launchNext, getSnap } from '../src/game/engine.js'
import { MISSIONS } from '../src/game/levels.js'

globalThis.performance ??= { now: () => Date.now() }
startGame()
G.up.armor = 4 // make the bot durable so it reaches every boss
let frames = 0, lastMission = 0
const log = (...a) => console.log(...a)
for (let step = 0; step < 60 * 60 * 40; step++) {
  const p = G.p
  if (G.mode === 'playing' && p) {
    // naive bot: dodge nearest bullet vertically, track enemies, always fire, bomb when low
    keys.Space = true
    let target = G.boss ? G.boss.y : (G.enemies[0] ? G.enemies[0].y : 0)
    let dodge = 0
    for (const b of G.ebul) if (b.x > p.x && b.x < p.x + 25 && Math.abs(b.y - p.y) < 4) dodge += b.y > p.y ? -1 : 1
    keys.ArrowUp = dodge > 0 || (!dodge && target > p.y + 1)
    keys.ArrowDown = dodge < 0 || (!dodge && target < p.y - 1)
    p.hp = Math.max(p.hp, 2) // keep alive to exercise all content
    if (G.ebul.length > 90) onKey('KeyB', true)
    if (Math.random() < 0.01) onKey('KeyQ', true)
    if (Math.random() < 0.005) onKey('KeyE', true)
  }
  update(1 / 60); frames++
  if (G.mode === 'clear') { log(`mission ${G.mission + 1} clear in ${(frames / 60).toFixed(0)}s score=${G.score}`, JSON.stringify(G.summary.grade)); toShop(); launchNext() }
  if (G.mode === 'victory') { log('VICTORY', G.final, 'frames', frames); break }
  if (G.mode === 'over') { log('game over at mission', G.mission + 1); break }
}
log('final mode', G.mode, 'snap ok', !!getSnap(), 'mission', G.mission + 1)
