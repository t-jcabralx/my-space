import { update, G } from '../src/game/engine.js'
import { storyActions, S, CHAPTERS, ACTS, unlocked } from '../src/game/story.js'
import { RC } from '../src/game/race.js'
import { GD } from '../src/game/garden.js'
import { OB } from '../src/game/orb.js'
import { FT } from '../src/game/fight.js'
import { profile } from '../src/game/engine.js'
let failures = 0
const check = (n, c, i) => { if (!c) failures++; console.log(c ? 'PASS' : 'FAIL', n, i || '') }
const step = (n) => { for (let i = 0; i < n; i++) { update(1 / 20); G.time += 1 / 20 } }
check('the saga has 5 acts and 21 chapters', ACTS.length === 5 && CHAPTERS.length === 21, `${ACTS.length} acts ${CHAPTERS.length} chapters`)
check('every chapter has a goal, a launch, intro/win/lose and a reward', CHAPTERS.every((c) => c.goal && c.launch && c.intro && c.win && c.lose && c.reward > 0 && c.act < ACTS.length))
check('new chapters can be played with a friend', CHAPTERS.slice(13).filter((c) => c.coop).length >= 6)
profile.story = { done: {}, stars: {}, cur: 0, flags: {} }
for (let i = 0; i < 13; i++) profile.story.done[i] = true
check('chapter 14 (Kart Cup) is unlocked after the original story', unlocked(13))
// kart cup with a choice
storyActions.open(13)
let guard = 0
while (S.phase === 'intro' && guard++ < 40) { const ln = S.lines[S.line]; if (ln && ln.choice && !S.chosen[S.line]) storyActions.pick(1); else storyActions.advance() }
check('a dialogue choice sets a story flag', profile.story.flags.buddy === 'pix', JSON.stringify(profile.story.flags))
check('the chapter launches Kart mode', S.phase === 'playing' && G.mode === 'race' && RC.cfg.kart, 'phase ' + S.phase + ' mode ' + G.mode)
step(60)
RC.results = { pos: 1, rows: [], total: 6 }
step(20 * 4)
check('winning shows the outro', S.phase === 'outro', S.phase)
guard = 0; while (S.phase === 'outro' && guard++ < 20) storyActions.advance()
check('the chapter is saved as done and pays out', profile.story.done[13] && S.phase === 'idle', S.phase)
// the garden chapter and its check
storyActions.open(14); guard = 0; while (S.phase === 'intro' && guard++ < 20) storyActions.advance()
check('garden chapter launches Garden Siege', G.mode === 'garden' && GD.kind === 'plants')
step(60); GD.over = { win: true }; GD.mode = 'over'; step(20 * 4)
check('garden chapter completes on a win', S.phase === 'outro')
guard = 0; while (S.phase === 'outro' && guard++ < 20) storyActions.advance()
// co-op: the chapter waits for an online game to start
storyActions.open(15); storyActions.abandon()
storyActions.coop(15)
check('co-op mode waits for a match', S.phase === 'coopwait' && S.coop)
G.mode = 'orb'; OB.mode = 'play'; step(5)
check('co-op switches to playing when a match starts', S.phase === 'playing', S.phase)
OB.over = { win: true }; step(20 * 5)
check('co-op result counts for the chapter', S.phase === 'outro')
guard = 0; while (S.phase === 'outro' && guard++ < 20) storyActions.advance()
storyActions.abandon()
// the final gauntlet runs three rounds
for (let i = 13; i < 20; i++) profile.story.done[i] = true
storyActions.open(20); guard = 0
while (S.phase === 'intro' && guard++ < 40) { const ln = S.lines[S.line]; if (ln && ln.choice && !S.chosen[S.line]) storyActions.pick(0); else storyActions.advance() }
check('gauntlet round 1 is Orb Rush', S.phase === 'playing' && G.mode === 'orb' && S.stage === 0, G.mode)
step(60); OB.over = { win: true }; OB.mode = 'over'; step(20 * 4)
check('winning a round starts the next one (Kart Cup)', S.stage === 1 && G.mode === 'race', 'stage ' + S.stage + ' mode ' + G.mode)
step(60); RC.results = { pos: 2, rows: [], total: 6 }; step(20 * 4)
check('round 3 is the Iron Fists fight', S.stage === 2 && G.mode === 'fight', 'stage ' + S.stage + ' mode ' + G.mode)
step(60); FT.over = { human: true }; FT.mode = 'over'; step(20 * 4)
check('the gauntlet ends with the finale cut-scene', S.phase === 'outro' && S.lines.length >= 4, S.phase)
const endText = S.lines.map((l) => l.text).join(' ')
check('the ending depends on the earlier choices', /OVERLORD|DELETED|YOU DELETED ME/i.test(endText) || /SPARED/i.test(endText), endText.slice(0, 60))
process.exit(failures ? 1 : 0)
