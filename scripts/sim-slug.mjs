import { G, update, keys, onKey } from '../src/game/engine.js'
import { S, slugActions, getSlugSnap } from '../src/game/slug.js'
slugActions.start(0)
let frames = 0
for (let i = 0; i < 60 * 60 * 30; i++) {
  if (S.mode === 'play' && S.p) {
    const p = S.p
    keys.KeyJ = true
    keys.ArrowRight = S.bossState === 'none' || p.x < S.cam + 10
    keys.ArrowLeft = S.boss && p.x > S.cam + 15
    if (S.boss) keys.ArrowUp = Math.random() < 0.3; else keys.ArrowUp = false
    if (Math.random() < 0.02) onKey('Space', true)
    if (Math.random() < 0.01) onKey('KeyG', true)
    if (Math.random() < 0.004) onKey('KeyQ', true)
    if (Math.random() < 0.004) onKey('KeyE', true)
    if (Math.random() < 0.003) onKey('KeyR', true)
    p.hp = Math.max(p.hp, 2)
    if (S.lives < 3) S.lives = 3
  }
  update(1 / 60); frames++
  if (S.mode === 'clear') { console.log('stage', S.stage + 1, 'clear', (frames / 60) | 0, 's score', S.score, S.summary.grade); onKey('Enter', true) }
  if (S.mode === 'victory') { console.log('VICTORY', S.final, (frames / 60) | 0, 's'); break }
  if (S.mode === 'over') { console.log('over', S.stage + 1); break }
}
console.log('mode', S.mode, 'snap', !!getSlugSnap(), 'G.mode', G.mode)
