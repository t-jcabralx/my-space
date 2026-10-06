import { profile, update, ensureQuests, claimDaily, questProgress, notices, getSnap, G } from '../src/game/engine.js'
let failures = 0
const check = (n, c, i) => { if (!c) failures++; console.log(c ? 'PASS' : 'FAIL', n, i || '') }
profile.chips = 1000; profile.quests = null; profile.awardsDone = {}; profile.awardsInit = true
const q = ensureQuests()
check('3 distinct daily quests', q.list.length === 3 && new Set(q.list.map((x) => x.id)).size === 3, q.list.map((x) => x.id).join())
check('streak starts at 1', q.streak === 1)
claimDaily(); check('daily bonus pays 100', profile.chips === 1100, 'chips ' + profile.chips)
claimDaily(); check('daily bonus only once', profile.chips === 1100)
// complete a quest by raising its counter
const first = q.list[0]
const before = profile.chips
profile[first.key === 'gamesPlayed' ? 'played' : first.key] = (profile[first.key === 'gamesPlayed' ? 'played' : first.key] || 0) + first.goal
update(1.05)
check('quest completes and pays chips', first.done && profile.chips === before + first.reward, `chips ${profile.chips}`)
check('quest announced', notices.some((n) => /QUEST COMPLETE/.test(n.text)))
// award unlock popup
profile.kills = 0; profile.awardsDone = {}; profile.kills = 1
update(1.05)
check('award unlock popup', notices.some((n) => /AWARD UNLOCKED: FIRST BLOOD/.test(n.text)) && profile.awardsDone['FIRST BLOOD'])
// next day: streak continues
profile.quests.day = new Date(Date.now() - 86400000 * 1).toISOString().slice(0, 10)
const st = ensureQuests()
check('next-day streak increments', st.streak === 2, 'streak ' + st.streak)
profile.quests.day = '2000-01-01'
check('missed days reset the streak', ensureQuests().streak === 1)
const snap = getSnap(); update(0.1)
process.exit(failures ? 1 : 0)
