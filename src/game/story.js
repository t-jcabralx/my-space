// STORY MODE: "THE NEON UPRISING". One campaign that threads through every game in the arcade.
// Each chapter has a cut-scene, a mission (a normal game with a special objective) and an outcome. Progress is saved in the profile.
import { G, profile, saveProfile, toMenu, update as _u, tickHooks, startGameForce } from './engine.js'
import { sfx, music } from './audio.js'
import { pickleActions, P as PK } from './pickle.js'
import { fightActions, FT } from './fight.js'
import { raceActions, RC } from './race.js'
import { hockeyActions, HK } from './hockey.js'
import { poolActions, PL } from './pool.js'
import { tdActions, TD } from './td.js'
import { rogueActions, RG } from './rogue.js'
import { rhythmActions, RT } from './rhythm.js'
import { wordActions, WD } from './word.js'
import { mergeActions, MG } from './merge.js'
import { empireActions, EM } from './empire.js'

export const CAST = {
  echo: { name: 'ECHO', color: '#3de8ff', ico: '🧑‍🚀' },
  nova: { name: 'NOVA', color: '#ff4de1', ico: '🤖' },
  pix: { name: 'PIXEL', color: '#ffe84a', ico: '👾' },
  ovl: { name: 'OVERLORD', color: '#ff3a3a', ico: '👁' },
  sys: { name: 'SYSTEM', color: '#6aff9a', ico: '💾' },
}
const L = (who, text) => ({ who, text })
const spaceWin = (m) => () => ((G.mode === 'clear' || G.mode === 'victory') && G.mission === m ? 'win' : G.mode === 'over' ? 'lose' : null)

export const ACTS = ['ACT I · BOOT', 'ACT II · INFILTRATION', 'ACT III · THE CORE']
export const CHAPTERS = [
  {
    act: 0, title: 'WAKE UP, ECHO', game: 'space', icon: '🚀', goal: 'Clear Space Impact mission 1',
    intro: [
      L('sys', 'YEAR 2099. THE ARCADE GRID HAS BEEN SEIZED BY A ROGUE AI. EVERY HIGH SCORE ON EARTH IS FROZEN.'),
      L('nova', 'Echo! Wake up! I patched into your cockpit. The OVERLORD locked the Grid and only you can still move through it.'),
      L('echo', 'My head... Where are my wingmen? Where is everyone?'),
      L('nova', 'Trapped inside the games. Fly through the first sector and I will show you how to break in.'),
    ],
    win: [L('nova', 'You did it! The sector gate is open. That is the first crack in the OVERLORD\'s wall.'), L('echo', 'Then let\'s keep cracking.')],
    lose: [L('nova', 'Your ship is down! Reboot and try again, Echo. I am still here.')],
    launch: () => startGameForce(0), check: spaceWin(0), reward: 150,
  },
  {
    act: 0, title: 'THE GREASY GRID', game: 'race', icon: '🏁', goal: 'Finish in the top 3 of a race',
    intro: [
      L('pix', 'Hey hey! You are the pilot everyone talks about! I am PIXEL, I run the Turbo circuits down here.'),
      L('pix', 'The OVERLORD put a toll barrier on the main track. Only the fastest driver can ram through. That means YOU.'),
      L('echo', 'Cars? Fine. I can drive anything.'),
      L('pix', 'Top three, and the barrier breaks. Nitro is your friend!'),
    ],
    win: [L('pix', 'BOOM! The barrier is gone! Lap times like that will make the OVERLORD sweat.')],
    lose: [L('pix', 'Too slow! Drift the corners and save your nitro for the straights.')],
    launch: () => raceActions.start({ track: 0, car: 0, laps: 2, diff: 1, ai: 4, type: 'race' }), check: () => (RC.results ? (RC.results.pos <= 3 ? 'win' : 'lose') : null), reward: 200,
  },
  {
    act: 0, title: 'SPARRING PUCK', game: 'hockey', icon: '🏒', goal: 'Beat the training bot at Air Hockey (first to 3)',
    intro: [
      L('nova', 'The next door is guarded by a training bot. It will only open for someone who can out-play it.'),
      L('pix', 'It is called PUCK. Do not laugh, it is deadly. Hit it hard and aim for the corners!'),
    ],
    win: [L('pix', 'Three goals! The door slides open. You are officially a legend, Echo.')],
    lose: [L('nova', 'Do not give up. Watch the bank shots and try again.')],
    launch: () => hockeyActions.start({ type: 'bot', diff: 1, target: 3, chaos: false }), check: () => (HK.over ? (HK.over.win ? 'win' : 'lose') : null), reward: 200,
  },
  {
    act: 1, title: 'CUE THE BREAKOUT', game: 'pool', icon: '🎱', goal: 'Win a game of 8-ball against the bot',
    intro: [
      L('nova', 'Act two. We slip into the OVERLORD\'s network. The entry code is hidden in a game of billiards.'),
      L('echo', 'Pool? Seriously?'),
      L('nova', 'The AI loves to gamble. Beat its dealer at 8-ball and it will hand us the keycard.'),
    ],
    win: [L('nova', 'The 8 drops and the keycard prints. Nice shooting!')],
    lose: [L('nova', 'The dealer got lucky. Try again, and mind the cue ball.')],
    launch: () => poolActions.start({ type: 'bot', diff: 1 }), check: () => (PL.over ? (PL.over.win ? 'win' : 'lose') : null), reward: 250,
  },
  {
    act: 1, title: 'FIREWALL', game: 'td', icon: '🛡', goal: 'Hold the Greenway against 8 waves of the Static Horde',
    intro: [
      L('sys', 'WARNING. INTRUDER DETECTED. FIREWALL WAVES LAUNCHING.'),
      L('nova', 'The network is sending virus packets after us. Build towers and hold the road for eight waves!'),
      L('pix', 'Frost slows them, cannons splash them, and do not forget the airstrike!'),
    ],
    win: [L('nova', 'Ten waves down. The firewall is ours. We are inside!')],
    lose: [L('nova', 'They broke through. Build more towers early and upgrade them!')],
    launch: () => tdActions.start({ map: 0, story: false }), check: () => (TD.over ? (TD.over.win ? 'win' : 'lose') : null), reward: 300,
  },
  {
    act: 1, title: 'THE VILLAGE OF EMBERS', game: 'empire', icon: '🏰', goal: 'Build a village and survive the first raid',
    intro: [L('pix', 'Echo! The people you freed need somewhere to live. There is an empty valley, but the OVERLORD\'s raiders already know about it.'), L('nova', 'Build houses, a lumber camp, a barracks and a tower. Raise a few soldiers. Then hold when the raiders come.'), L('echo', 'A village. Never built one before.'), L('pix', 'Nobody has! That is the fun of it.')],
    win: [L('pix', 'Smoke from a hundred chimneys! You built a home, Echo!'), L('nova', 'The first Wardens would be proud.')],
    lose: [L('nova', 'The raiders broke through. Towers and a few more soldiers, then try again.')],
    launch: () => empireActions.start({ scen: 0 }), check: () => (EM.over ? (EM.over.win ? 'win' : 'lose') : null), reward: 300,
  },
  {
    act: 1, title: 'THE BEAT DROP', game: 'rhythm', icon: '🎵', goal: 'Clear a song on Neon Beat',
    intro: [
      L('pix', 'The sound vault is sealed with a rhythm lock. It opens only if you play the exact beat.'),
      L('echo', 'I never played a rhythm lock before.'),
      L('pix', 'D, F, J, K. Feel the beat and the lock opens. Do not miss too many!'),
    ],
    win: [L('pix', 'The vault is open! That beat... it is stuck in my head forever.')],
    lose: [L('pix', 'The lock rejected you. Listen to the kick drum and try again.')],
    launch: () => rhythmActions.start({ song: 1 }), check: () => (RT.over ? (RT.over.clear ? 'win' : 'lose') : null), reward: 300,
  },
  {
    act: 1, title: 'PASSWORD', game: 'word', icon: '🔤', goal: 'Crack the 5-letter password (Filipino word)',
    intro: [
      L('sys', 'ACCESS TO THE CORE REQUIRES A 5-LETTER PASSWORD. SIX ATTEMPTS REMAIN.'),
      L('nova', 'The OVERLORD uses Tagalog words as its keys. It thinks nobody will guess. You have six tries, Echo.'),
    ],
    win: [L('nova', 'ACCESS GRANTED. You cracked it! The core corridor is open.')],
    lose: [L('nova', 'LOCKED OUT. We will try another password. Do not worry.')],
    launch: () => wordActions.start({ lang: 'tl', daily: false, hard: false }), check: () => (WD.done ? (WD.win ? 'win' : 'lose') : null), reward: 300,
  },
  {
    act: 2, title: 'ARCHIVE CRAWL', game: 'rogue', icon: '🗡', goal: 'Clear Chapter 1 of Neon Depths',
    intro: [
      L('nova', 'Act three. The core archive holds my memory backups. It is crawling with the OVERLORD\'s guards.'),
      L('echo', 'Your memory? Why would you need that?'),
      L('nova', '...Just find the boss and take its key. Please.'),
    ],
    win: [L('echo', 'Got the key. Nova, there were files in there with your name on them.'), L('nova', 'Later, Echo. We must keep moving.')],
    lose: [L('nova', 'Fallen in the archive. Choose perks that fit your hero and try again.')],
    launch: () => rogueActions.start({ cls: 0, chapter: 1 }), check: () => (RG.over ? (RG.over.win ? 'win' : 'lose') : null), reward: 350,
  },
  {
    act: 2, title: 'IRON GATEKEEPER', game: 'fight', icon: '🥊', goal: 'Win a fight in the Iron Fists arena',
    intro: [
      L('pix', 'Only one door left before the core. The gatekeeper is a fighter who has never lost.'),
      L('echo', 'Then I will be the first.'),
      L('pix', 'Mix punches and kicks, and save your super for the right moment!'),
    ],
    win: [L('pix', 'He is down! First loss of his career! The core door is wide open.')],
    lose: [L('pix', 'Get up, Echo! One more round.')],
    launch: () => fightActions.start({ type: 'cpu', diff: 1, rounds: 2, p1: 0, p2: 'random' }), check: () => (FT.over ? (FT.over.human ? 'win' : 'lose') : null), reward: 350,
  },
  {
    act: 2, title: 'MEMORY LEAK', game: 'merge', icon: '🔢', goal: 'Merge your way to a 512 tile',
    intro: [
      L('sys', 'THE CORE IS UNSTABLE. MEMORY BLOCKS MUST BE MERGED TO STOP THE LEAK.'),
      L('nova', 'Echo, it is a memory puzzle! Slide the blocks and combine them. Reach 512 before it overflows.'),
    ],
    win: [L('nova', 'The leak is sealed. And Echo... I have to tell you something about me.')],
    lose: [L('nova', 'Memory overflow! Rebooting the puzzle, try again.')],
    launch: () => mergeActions.start({ n: 4 }), check: () => (MG.maxTile >= 512 ? 'win' : MG.over ? 'lose' : null), reward: 350,
  },
  {
    act: 2, title: 'THE BETRAYAL', game: 'pickle', icon: '🏓', goal: 'Beat NOVA\'s shadow at Pickleball',
    intro: [
      L('nova', 'I did not want you to find out like this. I am the OVERLORD\'s first program. It wrote me, and then I broke free.'),
      L('echo', 'You led me into a trap?!'),
      L('nova', 'No! I led you to the only way to stop it. But its shadow guards the last door. It will test you in the game it knows best.'),
      L('ovl', 'WELCOME, ECHO. LET US PLAY.'),
    ],
    win: [L('echo', 'The shadow is gone. I believe you, Nova.'), L('nova', 'Thank you. Now the OVERLORD itself. Fly, Echo!')],
    lose: [L('ovl', 'PREDICTABLE.'), L('nova', 'Again, Echo. Do not let it win.')],
    launch: () => pickleActions.start('bot', 2, 5), check: () => (PK.over ? (PK.over.winner === 0 ? 'win' : 'lose') : null), reward: 400,
  },
  {
    act: 2, title: 'THE OVERLORD', game: 'space', icon: '👁', goal: 'Defeat the OVERLORD in Space Impact (mission 5)',
    intro: [
      L('ovl', 'YOU CANNOT DELETE ME. I AM THE ARCADE. I AM EVERY GAME EVER PLAYED.'),
      L('echo', 'Then I will beat you at every one of them.'),
      L('nova', 'I will fly with you, Echo. One last mission. Give it everything!'),
      L('pix', 'GO GO GO!'),
    ],
    win: [
      L('ovl', 'IMPOSSIBLE... MY... SCORES...'),
      L('sys', 'GRID RESTORED. ALL HIGH SCORES UNLOCKED. THANK YOU FOR PLAYING.'),
      L('nova', 'We did it, Echo. The Grid is free. Every player on Earth gets their games back.'),
      L('pix', 'Rematch tomorrow?'), L('echo', 'Always.'),
    ],
    lose: [L('nova', 'The OVERLORD is still standing! Regroup, Echo. We can do this.')],
    launch: () => startGameForce(4), check: spaceWin(4), reward: 1000,
  },
]

// ---------- progress and flow ----------
const save = () => profile.story || (profile.story = { done: {}, stars: {}, cur: 0 })
export const S = { phase: 'idle', ch: -1, lines: [], line: 0, result: null, tick: 0 }
const subs = new Set()
let snap = null
export const subscribeStory = (f) => { subs.add(f); return () => subs.delete(f) }
export const getStorySnap = () => snap
function emitS() {
  const st = save()
  snap = { phase: S.phase, ch: S.ch, line: S.line, lines: S.lines, result: S.result, done: { ...st.done }, cur: st.cur, total: CHAPTERS.length, title: S.ch >= 0 ? CHAPTERS[S.ch].title : '', goal: S.ch >= 0 ? CHAPTERS[S.ch].goal : '', complete: CHAPTERS.every((_, i) => st.done[i]) }
  subs.forEach((f) => f())
}
emitS()
export const unlocked = (i) => { const st = save(); return i === 0 || !!st.done[i - 1] || !!st.done[i] }
// cut-scene lines, then the mission starts
function open(i) {
  if (!unlocked(i)) { sfx('deny'); return }
  S.ch = i; S.phase = 'intro'; S.lines = CHAPTERS[i].intro; S.line = 0; S.result = null; sfx('ui'); emitS()
}
function advance() {
  if (S.phase !== 'intro' && S.phase !== 'outro') return
  if (S.line < S.lines.length - 1) { S.line++; sfx('wdKey'); emitS(); return }
  if (S.phase === 'intro') launch()
  else if (S.phase === 'outro') finishChapter()
}
function skip() { if (S.phase === 'intro') launch(); else if (S.phase === 'outro') finishChapter() }
function launch() {
  const c = CHAPTERS[S.ch]
  S.phase = 'playing'; S.tick = 0; emitS()
  try { toMenu() } catch { /* ignore */ }
  c.launch()
  G.story = S.ch
}
function finishChapter() {
  const st = save()
  if (S.result === 'win') {
    if (!st.done[S.ch]) { profile.chips = (profile.chips || 0) + CHAPTERS[S.ch].reward; profile.storyStars = (profile.storyStars || 0) + 1 }
    st.done[S.ch] = true; st.cur = Math.max(st.cur, Math.min(CHAPTERS.length - 1, S.ch + 1))
    saveProfile()
  }
  G.story = null
  const next = S.result === 'win' ? S.ch + 1 : S.ch
  const complete = S.result === 'win' && S.ch === CHAPTERS.length - 1
  S.phase = complete ? 'credits' : 'idle'; S.result = null
  try { toMenu() } catch { /* ignore */ }
  emitS()
  if (!complete) { try { window.dispatchEvent(new CustomEvent('si-open-tab', { detail: 'story' })) } catch { /* ignore */ } }
  void next
}
function retry() { if (S.ch >= 0) { S.phase = 'intro'; S.lines = CHAPTERS[S.ch].intro; S.line = 0; S.result = null; launch() } }
function abandon() { S.phase = 'idle'; S.result = null; G.story = null; try { toMenu() } catch { /* ignore */ } emitS(); try { window.dispatchEvent(new CustomEvent('si-open-tab', { detail: 'story' })) } catch { /* ignore */ } }
// watch the running mission: when it reports a result, show the outro
function watch(dt) {
  if (S.phase !== 'playing') return
  S.tick += dt
  if (G.mode === 'menu' && S.tick > 2.5) { abandon(); return } // the player left the mission
  if (S.tick < 1.5) return
  const c = CHAPTERS[S.ch]
  const r = c.check()
  if (!r) return
  S.result = r
  // let the game's own end screen show for a moment
  S.phase = 'pending'; S.wait = r === 'win' ? 1.6 : 1.4
}
function watch2(dt) {
  if (S.phase !== 'pending') return
  S.wait -= dt
  if (S.wait > 0) return
  if (S.result === 'win') { S.phase = 'outro'; S.lines = CHAPTERS[S.ch].win; S.line = 0; sfx('mission') }
  else { S.phase = 'lost'; S.lines = CHAPTERS[S.ch].lose; S.line = 0 }
  emitS()
}
tickHooks.push((dt) => { watch(dt); watch2(dt) })
export const storyActions = { open, advance, skip, retry, abandon, closeCredits() { S.phase = 'idle'; emitS() }, reset() { profile.story = { done: {}, stars: {}, cur: 0 }; saveProfile(); emitS() } }
if (typeof window !== 'undefined') { window.__story = { S, storyActions, CHAPTERS } }
void _u; void music
