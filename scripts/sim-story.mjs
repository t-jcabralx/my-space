import { update, G, profile } from '../src/game/engine.js'
import { S, storyActions, CHAPTERS, getStorySnap } from '../src/game/story.js'
import { HK } from '../src/game/hockey.js'
import { WD } from '../src/game/word.js'
import { MG } from '../src/game/merge.js'
let fail = 0
const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m) } }
const run = (sec) => { for (let i = 0; i < sec * 20; i++) update(1 / 20) }
storyActions.reset()
ok(CHAPTERS.length === 13, '13 chapters')
ok(CHAPTERS.every((c) => c.intro.length && c.win.length && c.lose.length && typeof c.launch === 'function' && typeof c.check === 'function'), 'chapters complete')
// locked chapters cannot be opened
const IX = (t) => CHAPTERS.findIndex((c) => c.title === t)
storyActions.open(4); ok(S.phase === 'idle', 'chapter 5 is locked at the start')
// play chapter 3 (index 2, hockey) after pretending the first two are done
profile.story.done[0] = true; profile.story.done[1] = true
storyActions.open(IX('SPARRING PUCK')); ok(S.phase === 'intro', 'intro opens')
while (S.phase === 'intro') storyActions.advance()
ok(S.phase === 'playing' && G.mode === 'hockey', 'mission launched: ' + S.phase + ' ' + G.mode)
run(3)
ok(S.phase === 'playing', 'still playing, no result yet')
HK.over = { win: false }; run(5)
ok(S.phase === 'lost', 'losing shows the lost scene: ' + S.phase)
storyActions.retry(); ok(S.phase === 'playing' && G.mode === 'hockey', 'retry relaunches')
run(3); HK.over = { win: true }; run(5)
ok(S.phase === 'outro', 'win shows outro: ' + S.phase)
const chips = profile.chips
while (S.phase === 'outro') storyActions.advance()
ok(profile.story.done[IX('SPARRING PUCK')] === true && profile.chips >= chips + CHAPTERS[IX('SPARRING PUCK')].reward, 'progress and reward saved')
ok(G.mode === 'menu', 'returned to the dashboard')
// word chapter and merge chapter hooks
for (let k = 0; k < IX('PASSWORD'); k++) profile.story.done[k] = true
storyActions.open(IX('PASSWORD')); while (S.phase === 'intro') storyActions.advance(); run(3)
ok(G.mode === 'word', 'word launched'); WD.done = true; WD.win = true; run(5); ok(S.phase === 'outro', 'word win detected')
storyActions.skip(); ok(profile.story.done[IX('PASSWORD')], 'skip finishes the chapter')
for (let k = 0; k < IX('MEMORY LEAK'); k++) profile.story.done[k] = true
storyActions.open(IX('MEMORY LEAK')); while (S.phase === 'intro') storyActions.advance(); run(3)
ok(G.mode === 'merge', 'merge launched'); MG.maxTile = 512; run(5); ok(S.phase === 'outro', 'merge goal detected')
storyActions.skip()
// leaving a mission via the dashboard abandons it
storyActions.open(IX('MEMORY LEAK')); while (S.phase === 'intro') storyActions.advance(); run(3)
G.mode = 'menu'; run(3); ok(S.phase === 'idle', 'leaving the mission returns to the story map: ' + S.phase)
ok(getStorySnap().total === 13, 'snapshot')
storyActions.reset()
console.log(fail ? 'FAIL story' : 'PASS story flow')
process.exit(fail ? 1 : 0)
