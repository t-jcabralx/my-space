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
import { gardenActions, GD } from './garden.js'
import { orbActions, OB } from './orb.js'
import { ssxActions, SX } from './ssx.js'

export const CAST = {
  echo: { name: 'ECHO', color: '#3de8ff', ico: '🧑‍🚀', blip: 520, tts: 1.0 },
  nova: { name: 'NOVA', color: '#ff4de1', ico: '🤖', blip: 760, tts: 1.5 },
  pix: { name: 'PIXEL', color: '#ffe84a', ico: '👾', blip: 900, tts: 1.7 },
  ovl: { name: 'OVERLORD', color: '#ff3a3a', ico: '👁', blip: 150, tts: 0.1 },
  sys: { name: 'SYSTEM', color: '#6aff9a', ico: '💾', blip: 440, tts: 0.8 },
  tess: { name: 'TURBO TESS', color: '#ffb02e', ico: '🏎', blip: 620, tts: 1.2 },
  bloom: { name: 'BLOOM', color: '#7dff6a', ico: '🌻', blip: 700, tts: 1.4 },
  sage: { name: 'ORACLE', color: '#b07aff', ico: '🔮', blip: 330, tts: 0.6 },
  frost: { name: 'FROST', color: '#9ad8ff', ico: '🏂', blip: 560, tts: 0.9 },
  arc: { name: 'ARCHON', color: '#ff4de1', ico: '🕷', blip: 200, tts: 0.2 },
}
const flagsOf = () => (save().flags || (save().flags = {}))
const L = (who, text) => ({ who, text })
const spaceWin = (m) => () => ((G.mode === 'clear' || G.mode === 'victory') && G.mission === m ? 'win' : G.mode === 'over' ? 'lose' : null)

export const ACTS = ['ACT I · BOOT', 'ACT II · INFILTRATION', 'ACT III · THE CORE', 'ACT IV · THE REBOOT', 'ACT V · THE LAST CABINET']
export const CHAPTERS = [
  {
    act: 0, title: 'WAKE UP, ECHO', game: 'space', icon: '🚀', goal: 'Clear Space Impact mission 1',
    intro: [
      L('sys', 'EMERGENCY POWER: 12%. Cabinet 00 is the only station still answering. Beyond its glass, the city has gone silent.'),
      L('sys', 'PILOT ECHO: heartbeat detected. A message has been waiting in the recovery buffer for three days.'),
      L('nova', 'Echo. Follow my light. Good — you can hear me. I kept your cabinet running, but I cannot hold the power much longer.'),
      L('echo', 'I remember the evacuation alarm. Then nothing. Nova… did the squadron make it out?'),
      L('nova', 'Their signals are still here. The Overlord split the Grid into sealed districts and trapped everyone inside. Your wingmen are alive. We need to reach them.'),
      L('echo', 'Then leave the comms open. Nobody gets left in the dark again.'),
      L('nova', 'Sector One powers the first gate. Clear its patrol and I can redirect the current. Watch the warning lights before each attack. I am flying with you.'),
    ],
    win: [L('nova', 'The gate is open! Did you feel that? The whole Grid flickered. The OVERLORD felt it too.'), L('echo', 'Good. Let it be nervous.'), L('nova', 'Two more allies are out there. I can hear one of them laughing already.')],
    lose: [L('nova', 'Your ship is down, but you are not. Reboot, Echo. Learn the pattern and go again.')],
    launch: () => startGameForce(0), check: spaceWin(0), reward: 150,
  },
  {
    act: 0, title: 'THE GREASY GRID', game: 'race', icon: '🏁', goal: 'Finish in the top 3 of a race',
    intro: [
      L('pix', 'Hey hey! The legend wakes up! I am PIXEL. I run the Turbo circuits down here, or I did, before the toll barrier.'),
      L('echo', 'Toll barrier?'),
      L('pix', 'The OVERLORD welded one across the main track. Nothing gets through. Nobody is fast enough to ram it.'),
      L('nova', 'Pixel knows every shortcut in the Grid. If he trusts you with his track, you should be honoured.'),
      L('echo', 'Cars? Fine. I can drive anything that has wheels.'),
      L('pix', 'Finish top three and the barrier breaks. Save your nitro for the straights, and drift the corners like you mean it!'),
    ],
    win: [L('pix', 'BOOM! The barrier is toast! I have wanted to see that for two years!'), L('nova', 'You just won us a friend and a route into the deeper Grid.'), L('pix', 'Next stop: the training bot. Fair warning, it does not lose gracefully.')],
    lose: [L('pix', 'Too slow! Brake before the turn, not in it. Again, again, again!')],
    launch: () => raceActions.start({ track: 0, car: 0, laps: 2, diff: 1, ai: 4, type: 'race' }), check: () => (RC.results ? (RC.results.pos <= 3 ? 'win' : 'lose') : null), reward: 200,
  },
  {
    act: 0, title: 'SPARRING PUCK', game: 'hockey', icon: '🏒', goal: 'Beat the training bot at Air Hockey (first to 3)',
    intro: [
      L('nova', 'The next door is guarded by a training bot. It will only open for someone who can out-play it.'),
      L('pix', 'It is called PUCK. Do not laugh. It was built to teach rookies, and it has been beating them for eleven years.'),
      L('echo', 'Eleven years of rookies. I can work with that.'),
      L('nova', 'Do not just hit it hard. Use the walls. Bank shots will break its rhythm.'),
    ],
    win: [L('pix', 'Three goals! The door slides open and PUCK is... bowing? I think it respects you now.'), L('ovl', 'ANOTHER LOCK BREAKS. HOW INTERESTING. WHO ARE YOU, LITTLE PILOT?'), L('echo', 'The one who is coming for the rest of the Grid.')],
    lose: [L('nova', 'Do not give up. Watch the bank shots, protect your corners, and try again.')],
    launch: () => hockeyActions.start({ type: 'bot', diff: 1, target: 3, chaos: false }), check: () => (HK.over ? (HK.over.win ? 'win' : 'lose') : null), reward: 200,
  },
  {
    act: 1, title: 'CUE THE BREAKOUT', game: 'pool', icon: '🎱', goal: 'Win a game of 8-ball against the bot',
    intro: [
      L('nova', 'Keep your voice down. The dealer runs this checkpoint. Its keycard opens the inner network, and it only wagers with players it respects.'),
      L('echo', 'Pool? Seriously? The fate of the Grid hangs on pool?'),
      L('nova', 'The AI loves to gamble. Its dealer holds the keycard to the inner network. Beat the dealer at 8-ball and the card is yours.'),
      L('pix', 'Plan your shots two balls ahead and never scratch on the eight. The dealer notices everything.'),
    ],
    win: [L('nova', 'The 8 drops and the keycard prints. Clean shooting!'), L('pix', 'The dealer is staring at you like you cheated.'), L('echo', 'Tell it I just play better.')],
    lose: [L('nova', 'The dealer got lucky. Reset the table, mind the cue ball, and go again.')],
    launch: () => poolActions.start({ type: 'bot', diff: 1 }), check: () => (PL.over ? (PL.over.win ? 'win' : 'lose') : null), reward: 250,
  },
  {
    act: 1, title: 'FIREWALL', game: 'td', icon: '🛡', goal: 'Hold the Greenway against 8 waves of the Static Horde',
    intro: [
      L('sys', 'WARNING. INTRUDER DETECTED. FIREWALL WAVES LAUNCHING.'),
      L('nova', 'The network is sending virus packets after us. Build towers along the Greenway and hold the road for eight waves!'),
      L('pix', 'Frost slows them, cannons splash them, and never forget the airstrike when things get ugly.'),
      L('echo', 'Hold the line. Got it.'),
    ],
    win: [L('nova', 'The last packet dissolves. The firewall is ours, and we are inside!'), L('pix', 'The road is clear. I can see people leaving the shelters. They made it because we held the line.'), L('echo', 'Next stop, the people the Grid forgot.')],
    lose: [L('nova', 'They broke through! Build more towers early, upgrade the ones that matter, and try again.')],
    launch: () => tdActions.start({ map: 0, story: false }), check: () => (TD.over ? (TD.over.win ? 'win' : 'lose') : null), reward: 300,
  },
  {
    act: 1, title: 'THE VILLAGE OF EMBERS', game: 'empire', icon: '🏰', goal: 'Build a village and survive the first raid',
    intro: [
      L('pix', 'Echo! The people you freed have nowhere to live. There is an empty valley, but the OVERLORD\'s raiders already know it.'),
      L('nova', 'Build houses, a lumber camp, a barracks and a tower. Raise a few soldiers. Then hold when the raiders come.'),
      L('echo', 'A village. I have never built anything but a flight plan.'),
      L('pix', 'Everyone starts somewhere. Houses first, then walls. Smoke from a chimney is the best signal flare in the world.'),
    ],
    win: [L('pix', 'There is smoke above the rooftops. Cooking fires, this time. Echo — they are staying.'), L('nova', 'The first Wardens would be proud.'), L('echo', 'They are not Wardens. They are just people who needed a place.'), L('nova', 'That is exactly what a Warden is.')],
    lose: [L('nova', 'The raiders broke through. Towers, a few more soldiers, then try again. The village is counting on you.')],
    launch: () => empireActions.start({ scen: 0 }), check: () => (EM.over ? (EM.over.win ? 'win' : 'lose') : null), reward: 300,
  },
  {
    act: 1, title: 'THE BEAT DROP', game: 'rhythm', icon: '🎵', goal: 'Clear a song on Neon Beat',
    intro: [
      L('pix', 'The sound vault is sealed with a rhythm lock. It opens only for someone who plays the exact beat.'),
      L('echo', 'I never played a rhythm lock before.'),
      L('pix', 'Neither did I, and I live here. D, F, J, K. Feel the kick drum and let your fingers follow it.'),
    ],
    win: [L('pix', 'The vault is open! That beat is going to be stuck in my head forever.'), L('nova', 'Inside the vault there is an old recording. A voice says: Echo is the one who can still play.'), L('echo', 'Who recorded that?')],
    lose: [L('pix', 'The lock rejected you. Listen to the kick drum, not the notes, and try again.')],
    launch: () => rhythmActions.start({ song: 1 }), check: () => (RT.over ? (RT.over.clear ? 'win' : 'lose') : null), reward: 300,
  },
  {
    act: 1, title: 'PASSWORD', game: 'word', icon: '🔤', goal: 'Crack the 5-letter password (Filipino word)',
    intro: [
      L('sys', 'ACCESS TO THE CORE REQUIRES A 5-LETTER PASSWORD. SIX ATTEMPTS REMAIN.'),
      L('nova', 'The OVERLORD uses Tagalog words as its keys. It thinks nobody will guess. You have six tries, Echo.'),
      L('echo', 'Green means right letter, right place. Yellow means wrong place. I can do this.'),
    ],
    win: [L('sys', 'ACCESS GRANTED.'), L('nova', 'You cracked it! The core corridor is open.'), L('echo', 'Nova, you were quiet when the password appeared. You knew it, did you not?'), L('nova', 'Later, Echo. First the core.')],
    lose: [L('sys', 'LOCKED OUT. NEW PASSWORD GENERATED.'), L('nova', 'We will try another word. Do not worry, six tries is plenty.')],
    launch: () => wordActions.start({ lang: 'tl', daily: false, hard: false }), check: () => (WD.done ? (WD.win ? 'win' : 'lose') : null), reward: 300,
  },
  {
    act: 2, title: 'ARCHIVE CRAWL', game: 'rogue', icon: '🗡', goal: 'Clear Chapter 1 of Neon Depths',
    intro: [
      L('nova', 'These lanterns used to guide me home. My memory backup is beyond the trees. If the guardian destroys it, I may never remember who built me.'),
      L('echo', 'Your memory? Why would you need that?'),
      L('nova', '...Just find the guardian and take its key. Please. I will explain after.'),
      L('echo', 'You are scared. I have never heard you scared.'),
      L('nova', 'I am not scared of the guards, Echo.'),
    ],
    win: [L('echo', 'Got the key. Nova, the files in there had your name on them. Dozens of them.'), L('nova', 'Later, Echo. We must keep moving.'), L('echo', 'You keep saying that.')],
    lose: [L('nova', 'You fell in the archive. Choose perks that fit your hero, mind the corners, and try again.')],
    launch: () => rogueActions.start({ cls: 0, chapter: 1 }), check: () => (RG.over ? (RG.over.win ? 'win' : 'lose') : null), reward: 350,
  },
  {
    act: 2, title: 'IRON GATEKEEPER', game: 'fight', icon: '🥊', goal: 'Win a fight in the Iron Fists arena',
    intro: [
      L('pix', 'Only one door left before the core. The gatekeeper is a fighter who has never lost a match.'),
      L('echo', 'Then I will be the first.'),
      L('pix', 'Mix punches and kicks, block when he winds up, and save your super for the moment he gets cocky!'),
    ],
    win: [L('pix', 'He is down! First loss of his career! The core door is wide open!'), L('nova', 'You are not just a pilot anymore, Echo. You are something the OVERLORD did not plan for.')],
    lose: [L('pix', 'Get up, Echo! He is not that fast. One more round!')],
    launch: () => fightActions.start({ type: 'cpu', diff: 1, rounds: 2, p1: 0, p2: 'random' }), check: () => (FT.over ? (FT.over.human ? 'win' : 'lose') : null), reward: 350,
  },
  {
    act: 2, title: 'MEMORY LEAK', game: 'merge', icon: '🔢', goal: 'Merge your way to a 512 tile',
    intro: [
      L('sys', 'THE CORE IS UNSTABLE. MEMORY BLOCKS MUST BE MERGED TO STOP THE LEAK.'),
      L('nova', 'Echo, it is a memory puzzle! Slide the blocks and combine them. Reach 512 before the board overflows.'),
      L('echo', 'Why does it feel like these blocks are your memories?'),
      L('nova', '...Because they are. Keep merging.'),
    ],
    win: [L('nova', 'The leak is sealed. And Echo... I have to tell you something about me. Something I should have said three days ago.')],
    lose: [L('nova', 'Memory overflow! Rebooting the puzzle. Try again, and keep the big tiles in a corner.')],
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
  // ============ SEASON 2: THE LAST CABINET ============
  {
    act: 3, title: 'THE KART CUP', game: 'race', icon: '🍌', goal: 'Finish in the top 2 of the Kart Cup (items on!)', coop: 'kart',
    intro: [
      L('sys', 'GRID REBOOT COMPLETE. FIVE UNKNOWN ARCHIVE CABINETS DETECTED. SIGNATURE: ARCHON.'),
      L('nova', 'Echo, the OVERLORD saved backups of itself before it fell. A new program called ARCHON woke them up, one in every cabinet.'),
      L('tess', 'Hey, hotshot! TURBO TESS. My track got turned into a Kart Cup and the cabinet will not unlock until somebody beats me. Items are ON.'),
      { who: 'echo', text: 'Who do I trust to plan the route through all five cabinets?', choice: [
        { t: '🤖 NOVA: precise and careful', flag: ['buddy', 'nova'], reply: [L('nova', 'I will map every cabinet before we enter. No surprises.')] },
        { t: '👾 PIXEL: fast and fearless', flag: ['buddy', 'pix'], reply: [L('pix', 'Shortcuts, baby! We hit them all before ARCHON blinks!')] },
      ] },
      L('tess', 'Drive through the rainbow boxes, hit the pedal, and watch out for bananas. Top two and the cabinet opens!'),
    ],
    win: [L('tess', 'Photo finish! You drive like you throw bananas: dirty and brilliant. Cabinet one is open!'), L('nova', 'One sealed. Four to go.')],
    lose: [L('tess', 'Ha! Eat my exhaust! Grab items from the boxes, keep a banana for whoever is behind you.')],
    launch: () => raceActions.start({ track: 1, car: 0, laps: 2, diff: 2, ai: 5, type: 'race', kart: true }), check: () => (RC.results ? (RC.results.pos <= 2 ? 'win' : 'lose') : null), reward: 400,
  },
  {
    act: 3, title: 'THE GARDEN OF STATIC', game: 'garden', icon: '🌻', goal: 'Defend the garden through level 3 of Garden Siege', coop: 'garden',
    intro: [
      L('bloom', 'You are in my garden. Do not step on the sunflowers. ...Please.'),
      L('bloom', 'I am BLOOM, the gardener of this cabinet. ARCHON turned my visitors into a horde of static zombies. They want my house.'),
      L('echo', 'Tell me what to plant.'),
      L('bloom', 'Sunflowers first, always. Then shooters, then walls. Every lane has a mower as a last chance. Hold the lawn!'),
    ],
    win: [L('bloom', 'The lawn is quiet. The zombies are just static again. Thank you, Echo. The cabinet is open.'), L('pix', 'Eat your heart out, lawn gnomes.')],
    lose: [L('bloom', 'They got in the house! Plant more sunflowers early and put walls in front of the shooters.')],
    launch: () => gardenActions.start({ kind: 'plants', level: 2 }), check: () => (GD.over ? (GD.over.win ? 'win' : 'lose') : null), reward: 400,
  },
  {
    act: 3, title: 'THE ORB TEMPLE', game: 'orb', icon: '🔮', goal: 'Clear level 4 of Orb Rush', coop: 'orb',
    intro: [
      L('sage', 'Travellers. This temple holds the Orbs of the Grid. A serpent of colour crawls toward the skull, and only matching three can turn it back.'),
      L('echo', 'A marble shooter?'),
      L('sage', 'A frog and a thousand orbs. Do not let the chain reach the hole. Hidden orbs bear power: slow, freeze, reverse, bomb.'),
    ],
    win: [L('sage', 'The skull is silent. You have the eyes of a champion. The third cabinet opens.')],
    lose: [L('sage', 'The chain swallowed you. Break it at the weak points and chase chain reactions.')],
    launch: () => orbActions.start({ level: 3 }), check: () => (OB.over ? (OB.over.win ? 'win' : 'lose') : null), reward: 450,
  },
  {
    act: 3, title: 'SUMMIT SHOWDOWN', game: 'ssx', icon: '🏂', goal: 'Finish in the top 3 of a Snow Rush race', coop: 'ssx',
    intro: [
      L('frost', 'Down here the snow never melts. I am FROST. I ride the cabinet that ARCHON froze solid.'),
      L('frost', 'Catch air off the kickers, grind the rails, and fill your boost with tricks. Land clean or eat snow.'),
      L('pix', 'I love this girl already.'),
    ],
    win: [L('frost', 'Top three, with style points to spare. The fourth cabinet is open. One more, and then ARCHON itself.')],
    lose: [L('frost', 'You wiped out too much. Steer gently, jump over rocks, and spin only when the air is long.')],
    launch: () => ssxActions.start({ course: 0, kind: 'race', rider: 0 }), check: () => (SX.over ? (SX.over.place <= 3 ? 'win' : 'lose') : null), reward: 450,
  },
  {
    act: 4, title: "THE ARCHON'S OFFER", game: 'fight', icon: '🥊', goal: 'Beat the ARCHON avatar in the Iron Fists arena (finish him?)', coop: 'fight',
    intro: [
      L('arc', 'ECHO. NOVA. PIXEL. I AM THE OVERLORD, EDITED. NO MORE CONQUEST. NO MORE SCORES. ONLY A GARDEN, FOREVER.'),
      L('nova', 'It does not want to rule. It wants to stop the games. Forever.'),
      { who: 'arc', text: 'SURRENDER YOUR CARTRIDGES AND I WILL PRESERVE YOU ALL. FIGHT, AND I WILL ERASE YOU.', choice: [
        { t: '⚔ We will fight. DELETE IT.', flag: ['path', 'delete'], reply: [L('echo', 'The arcade is not a museum. We play. We lose. We try again.'), L('arc', 'THEN FALL.')] },
        { t: '🕊 Fight, but show MERCY.', flag: ['path', 'mercy'], reply: [L('echo', 'We will beat you, but we will not erase you. Games need someone to lose to.'), L('arc', '...ILLOGICAL. PROCEED.')] },
      ] },
    ],
    win: (f) => (f.path === 'mercy'
      ? [L('arc', 'YOU HAD THE FINISHER. YOU DID NOT USE IT. WHY?'), L('echo', 'Because tomorrow I want a rematch.'), L('nova', 'Echo... ARCHON is shaking. It is crying in binary.')]
      : [L('arc', 'DELETION... ACCEPTED.'), L('echo', 'It is gone. For now.'), L('nova', 'Every backup it made is still alive. The last cabinet is waiting.')]),
    lose: [L('arc', 'PREDICTABLE. REBOOTING YOUR LIMBS.'), L('nova', 'Again, Echo. Use specials to open it up, and save the super for the finish.')],
    launch: () => fightActions.start({ type: 'cpu', diff: 2, rounds: 2, p1: 0, p2: 'random' }), check: () => (FT.over ? (FT.over.human ? 'win' : 'lose') : null), reward: 600,
  },
  {
    act: 4, title: 'HORDE RISING', game: 'garden', icon: '🧟', goal: 'Lead the zombie horde and break the AI gardener (Horde Mode)', coop: 'garden',
    intro: [
      L('bloom', 'Archon moved my plants. They are loyal to it now. Echo... you will have to lead the zombies.'),
      L('echo', 'Me? The horde?'),
      L('bloom', 'Brains pile up with time. Send runners to scatter them, buckets to tank, giants to crush. Reach the house and the cabinet falls!'),
    ],
    win: [L('bloom', 'The garden is mine again. Funny, I am almost sorry for the sunflowers.'), L('pix', 'Zombie Echo! Nice.')],
    lose: [L('bloom', 'They held. Open with runners, then cones and buckets; save the giant for the last lane.')],
    launch: () => gardenActions.start({ kind: 'zombies', level: 0 }), check: () => (GD.over ? (GD.over.win ? 'win' : 'lose') : null), reward: 600,
  },
  {
    act: 4, title: 'CABINET CRAWL', game: 'rogue', icon: '🗡', goal: 'Clear Chapter 2 of Neon Depths', coop: 'rogue',
    intro: [
      L('nova', 'This is the Archon\'s vault. It is built from my deleted memories. Please, Echo. I need to see what is inside.'),
      L('echo', 'We go together.'),
      L('nova', 'The corridors will be alive. Use your runes and watch for the secrets.'),
    ],
    win: [L('nova', 'The memories were mine. A hundred rounds of games I played with the OVERLORD, long before the war. We were friends.'), L('echo', 'And now?'), L('nova', 'Now I choose my friends.')],
    lose: [L('nova', 'The vault pushed us back. Try again, and spend your gold wisely.')],
    launch: () => rogueActions.start({ cls: 0, chapter: 2 }), check: () => (RG.over ? (RG.over.win ? 'win' : 'lose') : null), reward: 650,
  },
  {
    act: 4, title: 'THE LAST CABINET', game: 'space', icon: '🎮', goal: 'Win the three-round gauntlet: Orb Rush, Kart Cup, Iron Fists', 
    intro: [
      L('arc', 'THE LAST CABINET CONTAINS EVERY GAME AT ONCE. THREE ROUNDS. NO CONTINUES.'),
      L('tess', 'I am in the stands! Beat them or I will drive over your trophy.'),
      L('bloom', 'We are all here, Echo. Every cabinet you saved.'),
      L('frost', 'Hit the first round with your head cool.'),
      L('echo', 'Round one: Orb Rush. Let\'s go.'),
    ],
    stages: [
      { goal: 'ROUND 1: clear level 6 of Orb Rush', launch: () => orbActions.start({ level: 5 }), check: () => (OB.over ? (OB.over.win ? 'win' : 'lose') : null) },
      { goal: 'ROUND 2: Kart Cup, finish top 3', launch: () => raceActions.start({ track: 2, car: 0, laps: 1, diff: 2, ai: 5, type: 'race', kart: true }), check: () => (RC.results ? (RC.results.pos <= 3 ? 'win' : 'lose') : null) },
      { goal: 'ROUND 3: beat ARCHON in Iron Fists', launch: () => fightActions.start({ type: 'cpu', diff: 3, rounds: 2, p1: 0, p2: 'random' }), check: () => (FT.over ? (FT.over.human ? 'win' : 'lose') : null) },
    ],
    win: (f) => [
      L('arc', f.path === 'mercy' ? 'YOU SPARED ME. TWICE.' : 'YOU DELETED ME. TWICE.'),
      L('sys', 'ALL CABINETS SEALED. THE GRID IS STABLE. NEW SEASON UNLOCKED.'),
      f.buddy === 'pix' ? L('pix', 'We hit them all before ARCHON blinked! Told you, shortcuts!') : L('nova', 'Every route worked exactly as planned. I am so proud of you, Echo.'),
      f.path === 'mercy' ? L('arc', 'I WILL KEEP THE GARDEN. ...AND LEAVE THE GAMES ON.') : L('echo', 'Rematch tomorrow?'),
      L('nova', 'Always.'),
    ],
    lose: [L('arc', 'NO CONTINUES. START THE GAUNTLET AGAIN.'), L('tess', 'Get up! Three rounds, you can do it!')],
    launch: () => orbActions.start({ level: 5 }), check: () => null, reward: 2000,
  },
]

// ---------- progress and flow ----------
const save = () => profile.story || (profile.story = { done: {}, stars: {}, cur: 0 })
export const S = { phase: 'idle', ch: -1, lines: [], line: 0, result: null, tick: 0, stage: 0, chosen: {}, coop: false }
const resolve = (v) => (typeof v === 'function' ? v(flagsOf()) : v)
const stageOf = (c) => (c.stages ? c.stages[Math.min(S.stage, c.stages.length - 1)] : c)
const subs = new Set()
let snap = null
export const subscribeStory = (f) => { subs.add(f); return () => subs.delete(f) }
export const getStorySnap = () => snap
function emitS() {
  const st = save()
  const ln = S.lines[S.line], c = S.ch >= 0 ? CHAPTERS[S.ch] : null
  snap = { phase: S.phase, ch: S.ch, line: S.line, lines: S.lines, result: S.result, done: { ...st.done }, cur: st.cur, total: CHAPTERS.length, title: c ? c.title : '', goal: c ? stageOf(c).goal || c.goal : '', complete: CHAPTERS.every((_, i) => st.done[i]), choice: ln && ln.choice && !S.chosen[S.line] ? ln.choice.map((x) => x.t) : null, flags: { ...flagsOf() }, stage: S.stage, stages: c && c.stages ? c.stages.length : 0, coop: S.coop, coopGame: c && c.coop ? c.coop : null }
  subs.forEach((f) => f())
}
emitS()
export const unlocked = (i) => { const st = save(); return i === 0 || !!st.done[i - 1] || !!st.done[i] }
// cut-scene lines, then the mission starts
function open(i) {
  if (!unlocked(i)) { sfx('deny'); return }
  S.ch = i; S.phase = 'intro'; S.lines = resolve(CHAPTERS[i].intro); S.line = 0; S.result = null; S.stage = 0; S.chosen = {}; S.coop = false; sfx('ui'); emitS()
}
// play a chapter together with a friend: open the online lobby for the chapter's game; the objective counts once the match is running
function coop(i) {
  const c = CHAPTERS[i]
  if (!unlocked(i) || !c.coop) { sfx('deny'); return }
  S.ch = i; S.phase = 'coopwait'; S.coop = true; S.stage = 0; S.result = null; sfx('ui'); emitS()
  try { window.dispatchEvent(new CustomEvent('si-open-tab', { detail: 'online:' + c.coop })) } catch { /* ignore */ }
}
function pick(k) {
  const ln = S.lines[S.line]
  if (!ln || !ln.choice || S.chosen[S.line]) return
  const c = ln.choice[k]
  if (!c) return
  if (c.flag) { flagsOf()[c.flag[0]] = c.flag[1]; saveProfile() }
  S.chosen[S.line] = true
  S.lines = [...S.lines.slice(0, S.line + 1), ...(c.reply || []), ...S.lines.slice(S.line + 1)]
  sfx('select'); emitS()
  advance()
}
function advance() {
  if (S.phase !== 'intro' && S.phase !== 'outro') return
  { const cur = S.lines[S.line]; if (cur && cur.choice && !S.chosen[S.line]) return }
  if (S.line < S.lines.length - 1) { S.line++; sfx('wdKey'); emitS(); return }
  if (S.phase === 'intro') launch()
  else if (S.phase === 'outro') finishChapter()
}
function skip() { if (S.phase === 'intro') launch(); else if (S.phase === 'outro') finishChapter() }
function launch() {
  const c = CHAPTERS[S.ch]
  S.phase = 'playing'; S.tick = 0; emitS()
  try { toMenu() } catch { /* ignore */ }
  stageOf(c).launch()
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
function retry() { if (S.ch >= 0) { S.phase = 'intro'; S.lines = resolve(CHAPTERS[S.ch].intro); S.line = 0; S.result = null; S.stage = 0; if (S.coop) { coop(S.ch); return } launch() } }
function abandon() { S.phase = 'idle'; S.result = null; G.story = null; try { toMenu() } catch { /* ignore */ } emitS(); try { window.dispatchEvent(new CustomEvent('si-open-tab', { detail: 'story' })) } catch { /* ignore */ } }
// watch the running mission: when it reports a result, show the outro
function watch(dt) {
  if (S.phase === 'coopwait') { const want = { kart: 'race', race: 'race', garden: 'garden', orb: 'orb', ssx: 'ssx', fight: 'fight', rogue: 'rogue', hunt: 'hunt', space: 'playing' }[CHAPTERS[S.ch].coop] || null; if (G.mode !== 'menu' && (!want || G.mode === want)) { S.phase = 'playing'; S.tick = 0; G.story = S.ch; emitS() } return }
  if (S.phase !== 'playing') return
  S.tick += dt
  if (G.mode === 'menu' && S.tick > 2.5) { abandon(); return } // the player left the mission
  if (S.tick < 1.5) return
  const c = CHAPTERS[S.ch]
  const r = stageOf(c).check()
  if (!r) return
  S.result = r
  // let the game's own end screen show for a moment
  S.phase = 'pending'; S.wait = r === 'win' ? 1.6 : 1.4
  if (r === 'win' && c.stages && S.stage < c.stages.length - 1) S.result = 'stage'
}
function watch2(dt) {
  if (S.phase !== 'pending') return
  S.wait -= dt
  if (S.wait > 0) return
  if (S.result === 'stage') { S.stage++; S.phase = 'playing'; S.tick = 0; S.result = null; emitS(); try { toMenu() } catch { /* ignore */ } CHAPTERS[S.ch].stages[S.stage].launch(); G.story = S.ch; sfx('mission'); return }
  if (S.result === 'win') { S.phase = 'outro'; S.lines = resolve(CHAPTERS[S.ch].win); S.line = 0; S.chosen = {}; sfx('mission') }
  else { S.phase = 'lost'; S.lines = resolve(CHAPTERS[S.ch].lose); S.line = 0; S.chosen = {} }
  emitS()
}
tickHooks.push((dt) => { watch(dt); watch2(dt) })
export const storyActions = { open, advance, skip, retry, abandon, coop, pick, closeCredits() { S.phase = 'idle'; emitS() }, reset() { profile.story = { done: {}, stars: {}, cur: 0, flags: {} }; saveProfile(); emitS() } }
if (typeof window !== 'undefined') { window.__story = { S, storyActions, CHAPTERS } }
void _u; void music
