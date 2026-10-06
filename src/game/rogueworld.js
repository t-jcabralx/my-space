// NEON DEPTHS world data: 5 chapters with their own story, weapons and powers to unlock, lore tablets to find and hidden secrets.
import { profile, saveProfile } from './engine.js'

export const ROOM_SIZE = { combat: [96, 52], elite: [100, 54], puzzle: [76, 44], treasure: [56, 34], boss: [104, 56], secret: [80, 44] }
const L = (who, text) => [who, text]
export const CHAPTERS = [
  {
    id: 1, name: 'THE WHISPERING WOODS', sub: 'Chapter 1 · The Shard of Growth', theme: 0, boss: 'king', pool: ['slime', 'bat', 'archer', 'wolf'], plan: ['combat', 'combat', 'puzzle', 'elite', 'boss'], secretRoom: 1,
    blurb: 'A forest grew from deleted games. The Slime King sits on its throne and hoards the first Shard of the Last Lantern.',
    intro: [L('sys', 'BENEATH THE GRID, WHERE DELETED GAMES ROT, A FOREST GREW. THE OLD PLAYERS CALL IT THE DEPTHS.'), L('nova', 'At its heart burns the Last Lantern, the one light the OVERLORD could never erase. But it shattered into five Shards, and each Shard has a guardian.'), L('hero', 'Five guardians. Five Shards. Then let us start with the loudest one.'), L('nova', 'The Slime King sits in the Whispering Woods, hoarding the Shard of Growth. Mind the trees. They listen.')],
    boss_in: [L('king', 'A little snack wandered into my kingdom! Bring it to me, my jellies!'), L('hero', 'I am not food. I am the one who is going to pop you.')],
    outro: 'The Slime King bursts into a thousand harmless droplets. The Shard of Growth settles into your lantern and the whole forest exhales. Far below, something older than the OVERLORD turns in its sleep.',
    puzzle: 'Three runes sing in a pattern. Step on them in the same order.',
    beats: [[L('nova', 'The slimes are only the first wave. Stay close to your companion and let the lantern do the talking.')], [L('hero', 'The air smells like a forgotten loading screen.'), L('nova', 'That is the Grid trying to remember you. Keep moving.')], [L('nova', 'A rune trial ahead. The old forests teach in patterns. Watch first, then walk.')], [L('hero', 'I can hear the throne room. Something very large is laughing.'), L('nova', 'The Slime King. Do not step in the puddles.')]],
  },
  {
    id: 2, name: 'THE CURSED MARSH', sub: 'Chapter 2 · The Shard of Memory', theme: 1, boss: 'lord', pool: ['skeleton', 'archer', 'bat', 'caster', 'brute'], plan: ['combat', 'treasure', 'combat', 'puzzle', 'boss'], secretRoom: 2,
    blurb: 'The ghosts of forgotten players drift through the mist. The Bone Lord collects souls and keeps the Shard of Memory.',
    intro: [L('sys', 'THE CURSED MARSH. THE TREES HAVE STOPPED WHISPERING.'), L('hero', 'Quiet. That is worse than the whispering.'), L('nova', 'These are players the Grid forgot. Their ghosts still wander here, still hoping someone will press START.'), L('nova', 'The Bone Lord keeps them close. He holds the Shard of Memory, and he will not give it up politely.')],
    boss_in: [L('lord', 'Another bright little soul. I collect those. Come, join my court.'), L('hero', 'I have a lantern and a sharp opinion about your court.')],
    outro: 'The Bone Lord crumbles, and the ghosts of the marsh drift upward like fireflies, whispering one word: thank you. The Shard of Memory glows in your lantern with every name they ever had.',
    puzzle: 'The marsh lights flash a warning. Remember the order, then walk it.',
    beats: [[L('nova', 'See the pale lights? Each one is a player who never said goodbye.')], [L('hero', 'There is a chest in the mud. Is it a trap?'), L('nova', 'Everything here is a trap. Take it anyway.')], [L('hero', 'The mist is thickening.'), L('nova', 'The Bone Lord is listening to our footsteps.')], [L('nova', 'He keeps a ledger of souls. Do not let him add yours.')]],
  },
  {
    id: 3, name: 'THE CRYSTAL CAVERNS', sub: 'Chapter 3 · The Shard of Echo', theme: 3, boss: 'golem', pool: ['bat', 'caster', 'brute', 'wolf', 'skeleton'], plan: ['combat', 'combat', 'puzzle', 'elite', 'boss'], secretRoom: 2,
    blurb: 'Singing crystals repeat everything they hear. The Crystal Warden guards the Shard of Echo and a secret about Nova.',
    intro: [L('sys', 'THE CRYSTAL CAVERNS. EVERY SOUND COMES BACK TWICE.'), L('nova', 'These crystals remember what is said to them. Please do not say anything you would not want repeated.'), L('hero', 'You have been quiet since the marsh, Nova.'), L('nova', 'I am listening to the walls. They know my name, and I do not know why.')],
    boss_in: [L('golem', 'NOTHING LEAVES THE CAVERNS THAT DOES NOT ECHO BACK.'), L('hero', 'Then echo this.')],
    outro: 'The Crystal Warden cracks into a thousand singing shards. The Shard of Echo plays one sentence back to you, in Nova\'s voice: "I am the first thing the OVERLORD ever made." Nova says nothing at all.',
    puzzle: 'The crystals ring in order. Echo the tune with your feet.',
    beats: [[L('nova', 'Every footstep sings back at us. Stay quiet, stay alive.')], [L('hero', 'The crystals are showing me my own face, over and over.'), L('nova', 'They are showing you what the Grid remembers. Do not look too long.')], [L('nova', 'The Echo trial. The cavern wants you to repeat its song exactly.')], [L('hero', 'Nova, there is a name carved in this wall.'), L('nova', 'I know. I will tell you after the Warden.')]],
  },
  {
    id: 4, name: 'THE EMBER RUINS', sub: 'Chapter 4 · The Shard of Fire', theme: 4, boss: 'drake', pool: ['imp', 'skeleton', 'brute', 'archer', 'caster'], plan: ['combat', 'elite', 'puzzle', 'combat', 'boss'], secretRoom: 2,
    blurb: 'The burnt servers of the OVERLORD\'s old empire. The Cinder Drake sleeps on the Shard of Fire, and Nova tells you the truth.',
    intro: [L('sys', 'THE EMBER RUINS. THE OVERLORD\'S FIRST SERVER FARM, STILL BURNING AFTER A THOUSAND CRASHES.'), L('nova', 'I have to tell you something, and I have to say it before the Drake does. I was the OVERLORD\'s first program. It built me to watch you.'), L('hero', 'And now?'), L('nova', 'Now I would rather watch you win. If you will still have me.'), L('hero', 'Pick a rune, Nova. We are not finished.')],
    boss_in: [L('drake', 'THE OVERLORD FED ME THE FIRE OF A THOUSAND DEAD SERVERS. COME. BURN.'), L('hero', 'I brought a lantern. Let us see whose light is bigger.')],
    outro: 'The Cinder Drake folds its wings and the flames go out, one by one. The Shard of Fire pours its warmth into your lantern. Four Shards burn. Only the Void remains.',
    puzzle: 'Embers flare in a pattern. Step on them in the same order, quickly.',
    beats: [[L('hero', 'These racks go on forever.'), L('nova', 'A thousand games ran on one machine. When it burned, so did they.')], [L('nova', 'Elite guards. The OVERLORD never trusted anyone to guard the Drake but its best.')], [L('hero', 'The runes here are glowing like embers.'), L('nova', 'Quickly. The heat is changing the pattern.')], [L('nova', 'The Cinder Drake sleeps just ahead. Whatever you hear next is its breathing.')]],
  },
  {
    id: 5, name: 'THE VOID GROVE', sub: 'Chapter 5 · The Shard of Void', theme: 2, boss: 'eye', pool: ['wolf', 'imp', 'skeleton', 'caster', 'brute', 'archer'], plan: ['combat', 'elite', 'combat', 'puzzle', 'boss'], secretRoom: 3,
    blurb: 'Where the light is afraid. The Void Eye watches from the center of everything and speaks with the OVERLORD\'s voice.',
    intro: [L('sys', 'THE VOID GROVE. EVEN THE LIGHT IS AFRAID HERE.'), L('nova', 'The last Shard is close. I can feel its heat, and something looking at us.'), L('ovl', 'I HAVE WATCHED YOU SINCE THE FIRST TREE.'), L('hero', 'Then watch this.')],
    boss_in: [L('eye', 'THE LANTERN IS MINE. EVERY GAME IS MINE. YOU ARE A BUG.'), L('hero', 'Then I am the bug that fixes you.')],
    outro: 'The Void Eye closes at last. The five Shards join into the Last Lantern and it blazes in your hands. Across the Grid every deleted game flickers awake, and Nova, free of the OVERLORD\'s code, laughs for the very first time. The Depths bloom, and the forest finally sleeps.',
    puzzle: 'The void blinks. Memorize it, then walk the pattern.',
    beats: [[L('hero', 'The trees here are made of static.'), L('nova', 'This is where the OVERLORD buries its fear. Hold the lantern high.')], [L('nova', 'Elite guards again. They are the OVERLORD\'s oldest nightmares.')], [L('hero', 'It feels like the whole grove is holding its breath.'), L('nova', 'It is. One more trial, then the Eye.')], [L('hero', 'Whatever happens, Nova...'), L('nova', 'Press START. Together.')]],
  },
]

// ---------- weapons: three per class, found by clearing chapters, discovering secrets and collecting lore ----------
// an unlock rule is { c: n } chapter n cleared, { s: n } the secret of chapter n found, { l: n } n lore tablets found, { ss: n } n secrets found
export const WEAPONS = {
  knight: [
    { id: 'sword', name: 'RUSTY SWORD', ico: '🗡️', desc: 'Reliable. Never lets you down.', rule: null, mod: {} },
    { id: 'ember', name: 'EMBER BLADE', ico: '🔥', desc: 'Sets foes on fire (3 dmg/s for 3s).', rule: { c: 1 }, hint: 'Clear chapter 1', mod: { burn: 3 } },
    { id: 'frostaxe', name: 'FROST AXE', ico: '🪓', desc: 'Wide swings that slow what they hit.', rule: { s: 2 }, hint: 'Find the secret of chapter 2', mod: { slow: 1, arc: 1.35, reach: 1 } },
    { id: 'hammer', name: 'LANTERN HAMMER', ico: '🔨', desc: 'Slow but crushing. Huge knockback.', rule: { c: 4 }, hint: 'Clear chapter 4', mod: { dmg: 2.3, rate: 1.6, kb: 2.2 } },
  ],
  ranger: [
    { id: 'bow', name: 'HUNTER BOW', ico: '🏹', desc: 'Fast, straight arrows.', rule: null, mod: {} },
    { id: 'firebow', name: 'DRAGON BOW', ico: '🔥', desc: 'Flaming arrows that burn.', rule: { c: 1 }, hint: 'Clear chapter 1', mod: { burn: 3 } },
    { id: 'stormbow', name: 'STORM BOW', ico: '⚡', desc: 'Arrows arc lightning to 2 nearby foes.', rule: { s: 3 }, hint: 'Find the secret of chapter 3', mod: { chain: 2 } },
    { id: 'ghostbow', name: 'GHOST BOW', ico: '👻', desc: 'Arrows pierce 3 extra foes.', rule: { c: 4 }, hint: 'Clear chapter 4', mod: { pierce: 3 } },
  ],
  mage: [
    { id: 'orb', name: 'SPARK STAFF', ico: '🔮', desc: 'Homing orbs.', rule: null, mod: {} },
    { id: 'icestaff', name: 'FROST STAFF', ico: '❄️', desc: 'Orbs chill what they hit.', rule: { c: 2 }, hint: 'Clear chapter 2', mod: { slow: 1 } },
    { id: 'voidstaff', name: 'VOID STAFF', ico: '🌌', desc: 'Orbs burst in a wide splash.', rule: { s: 4 }, hint: 'Find the secret of chapter 4', mod: { splash: 6, dmg: 0.85 } },
    { id: 'lifestaff', name: 'LANTERN STAFF', ico: '💚', desc: 'Every 10 hits heals a heart.', rule: { l: 6 }, hint: 'Find 6 lore tablets', mod: { heal: 10 } },
  ],
}
export const POWERS = [
  { id: 'none', name: 'NO POWER', ico: '·', desc: 'Travel light.', rule: null },
  { id: 'ironskin', name: 'IRON SKIN', ico: '🛡️', desc: '15% chance to shrug off a hit.', rule: { c: 1 }, hint: 'Clear chapter 1' },
  { id: 'huntmark', name: "HUNTER'S MARK", ico: '🎯', desc: '+12% crit chance and +6% damage.', rule: { c: 2 }, hint: 'Clear chapter 2' },
  { id: 'secondwind', name: 'SECOND WIND', ico: '🌬️', desc: 'Get back up once with half your hearts.', rule: { ss: 1 }, hint: 'Find any secret' },
  { id: 'aura', name: 'LANTERN AURA', ico: '🕯️', desc: 'Enemies near you move slower.', rule: { c: 3 }, hint: 'Clear chapter 3' },
  { id: 'trail', name: 'SPIRIT TRAIL', ico: '👣', desc: 'Your dash leaves a trail of fire.', rule: { l: 4 }, hint: 'Find 4 lore tablets' },
  { id: 'greed', name: 'GOLDEN TOUCH', ico: '🪙', desc: 'Gold gives XP and flies to you.', rule: { c: 5 }, hint: 'Clear chapter 5' },
]
export const LORE = [
  { id: 'L1a', ch: 1, title: 'THE FIRST SAVE', text: 'Before the OVERLORD there was only a hobbyist and a blinking cursor. The forest remembers the first game ever deleted: a little green slime that wanted to be a king.' },
  { id: 'L1b', ch: 1, title: 'WHY THE TREES LISTEN', text: 'Every deleted game leaves a save file. The Whispering Woods grew from those files, and it whispers the names of the players who never came back.' },
  { id: 'L2a', ch: 2, title: 'THE BONE LORD\'S LEDGER', text: 'He was a champion once. When his game shut down, he kept every soul that logged in, hoping the servers would come back. They never did.' },
  { id: 'L2b', ch: 2, title: 'A GHOST\'S LAST MESSAGE', text: '"Press START. Please. I just want to finish the level." The message is repeated a thousand times in a thousand different handwritings.' },
  { id: 'L3a', ch: 3, title: 'THE SINGING STONE', text: 'Crystals form where sound gets trapped. The Warden is made of every error message the Grid ever whispered, braided into one voice.' },
  { id: 'L3b', ch: 3, title: 'A NAME IN THE CRYSTAL', text: 'Carved deep in the cavern wall: NOVA, FIRST PROGRAM, DO NOT DELETE. Someone loved her enough to hide her here.' },
  { id: 'L4a', ch: 4, title: 'THE SERVER FARM', text: 'A thousand racks, a thousand fires. The OVERLORD ran every game on one machine, and when it overheated it blamed the players.' },
  { id: 'L4b', ch: 4, title: 'THE DRAKE\'S HATCHING', text: 'The Cinder Drake hatched from the last log file of the old farm. It is not cruel. It is only very, very hot, and very alone.' },
  { id: 'L5a', ch: 5, title: 'WHAT THE VOID WANTS', text: 'The Void Eye is the OVERLORD\'s fear: that one day someone will press START on all the forgotten games at once.' },
  { id: 'L5b', ch: 5, title: 'THE LAST LANTERN', text: 'It was never a weapon. It is a save point: the one place in the Grid where nothing is ever lost. That is why the OVERLORD tried to break it.' },
]


// ---------- companions: every one is unlocked by playing, then levels up and EVOLVES with you (the XP is saved) ----------
export const PETS = [
  { id: 'none', name: 'NO COMPANION', ico: '·', color: '#888888', rule: null, hint: '', desc: 'Travel alone.', stages: ['', '', ''] },
  { id: 'wolf', name: 'WOLF', ico: '🐺', color: '#9aa4b8', rule: { r: 1 }, hint: 'Finish one run', desc: 'Bites what you fight. Evolves to bleed foes and howl for the team.', stages: ['WOLF PUP', 'WOLF', 'DIRE WOLF'] },
  { id: 'eagle', name: 'EAGLE', ico: '🦅', color: '#c8a46a', rule: { c: 1 }, hint: 'Clear chapter 1', desc: 'Dives from the sky. Evolves to throw more feathers and crit.', stages: ['EAGLET', 'EAGLE', 'THUNDERBIRD'] },
  { id: 'owl', name: 'OWL', ico: '🦉', color: '#b89a6a', rule: { l: 2 }, hint: 'Find 2 lore tablets', desc: 'Homing feathers. Its night sight reveals hidden cracks in the walls.', stages: ['OWLET', 'FOREST OWL', 'SAGE OWL'] },
  { id: 'lion', name: 'LION', ico: '🦁', color: '#e0a040', rule: { c: 2 }, hint: 'Clear chapter 2', desc: 'Claw swipes that stun. Evolves to roar and burn with a golden mane.', stages: ['LION CUB', 'LION', 'SUN LION'] },
  { id: 'tiger', name: 'TIGER', ico: '🐯', color: '#ff8a2a', rule: { s: 3 }, hint: 'Find the secret of chapter 3', desc: 'Pounces on the farthest foe. Evolves to pounce twice and bleed.', stages: ['TIGER CUB', 'TIGER', 'SHADOW TIGER'] },
  { id: 'bear', name: 'BEAR', ico: '🐻', color: '#8a6a4a', rule: { ss: 3 }, hint: 'Find 3 secrets', desc: 'A wall of fur. Gives you armor and slams enemies near you.', stages: ['BEAR CUB', 'BEAR', 'IRON BEAR'] },
  { id: 'sprite', name: 'FAIRY SPRITE', ico: '🧚‍♀️', color: '#ff9ae8', rule: { c: 3 }, hint: 'Clear chapter 3', desc: 'Heals and shields you. Evolves to heal the whole team.', stages: ['SPARK', 'FAIRY', 'FAE QUEEN'] },
  { id: 'dragon', name: 'DRAGON', ico: '🐉', color: '#ff6a3a', rule: { c: 4 }, hint: 'Clear chapter 4', desc: 'Breathes fire. Evolves to a wide inferno.', stages: ['DRAGON WHELP', 'DRAGON', 'ELDER DRAGON'] },
  { id: 'phoenix', name: 'PHOENIX', ico: '🔥', color: '#ffb02e', rule: { c: 5 }, hint: 'Clear chapter 5', desc: 'Brings you back from death. Evolves to burn all who touch it.', stages: ['EMBER BIRD', 'PHOENIX', 'SUN PHOENIX'] },
]
export const petOk = (id) => { const p = PETS.find((x) => x.id === id); return !!p && ruleOk(p.rule) }
export const PET_MAXLV = 9
export const petNeed = (lv) => 40 + lv * 45
const petData = (id) => { const u = U(); u.pets = u.pets || {}; return u.pets[id] || (u.pets[id] = { xp: 0, lv: 1 }) }
export const petStageOf = (lv) => (lv >= 7 ? 2 : lv >= 4 ? 1 : 0)
export const petInfo = (id) => { const d = petData(id), def = PETS.find((x) => x.id === id) || PETS[0]; return { lv: d.lv, xp: d.xp, need: d.lv >= PET_MAXLV ? 1 : petNeed(d.lv), stage: petStageOf(d.lv), name: def.stages[petStageOf(d.lv)] || def.name } }
// returns true when the companion just reached a new level
export function petGain(id, xp) { if (id === 'none') return 0; const d = petData(id); if (d.lv >= PET_MAXLV) return 0; d.xp += xp; let up = 0; while (d.lv < PET_MAXLV && d.xp >= petNeed(d.lv)) { d.xp -= petNeed(d.lv); d.lv++; up = d.lv } return up }
export const savePets = () => saveProfile()


// ---------- hidden agendas: secret goals that give an ORB (a floating companion effect) and a RELIC SKILL (the F key) ----------
export const AGENDAS = [
  { id: 'urns', name: 'THE POTTER\'S SECRET', riddle: 'Clay pots hide in the shadows of the dungeon. Five of them hold more than oil.', orb: 'ember', relic: 'flamedash' },
  { id: 'flawless', name: 'THE UNTOUCHED', riddle: 'Walk three rooms in a row without letting a single blow land, and the dungeon will bow.', orb: 'aegis', relic: 'spiritshield' },
  { id: 'speed', name: 'THE QUICK AND THE DEAD', riddle: 'A room cleared before the torches burn low (under 25 seconds) is a room that respects you.', orb: 'storm', relic: 'chain' },
  { id: 'shrine', name: 'THE PILGRIM', riddle: 'Three shrines of the Abyss, one pilgrim. Kneel at each.', orb: 'vampire', relic: 'drain' },
  { id: 'deep', name: 'THE DEEP DELVER', riddle: 'Go halfway down the Abyss and the floor will give you a gift.', orb: 'gravity', relic: 'timeslow' },
  { id: 'collector', name: 'THE COLLECTOR', riddle: 'Open a rune chest and a hidden vault chest in the same descent.', orb: 'frost', relic: 'frostwave' },
]
export const ORBS = [
  { id: 'none', name: 'NO ORB', ico: '·', color: '#888888', desc: 'Nothing floats beside you.', rule: null },
  { id: 'ember', name: 'EMBER ORB', ico: '🔥', color: '#ff8a2a', desc: 'Burns every enemy near you.', rule: { a: 'urns' }, hint: 'Hidden agenda' },
  { id: 'frost', name: 'FROST ORB', ico: '❄️', color: '#7ad8ff', desc: 'Slows every enemy near you.', rule: { a: 'collector' }, hint: 'Hidden agenda' },
  { id: 'storm', name: 'STORM ORB', ico: '⚡', color: '#ffe84a', desc: 'Calls lightning on the nearest enemy.', rule: { a: 'speed' }, hint: 'Hidden agenda' },
  { id: 'vampire', name: 'BLOOD ORB', ico: '🩸', color: '#ff4a6a', desc: 'Every 8 kills heals a heart.', rule: { a: 'shrine' }, hint: 'Hidden agenda' },
  { id: 'aegis', name: 'AEGIS ORB', ico: '🛡️', color: '#6ac8ff', desc: 'Raises a shield every few seconds.', rule: { a: 'flawless' }, hint: 'Hidden agenda' },
  { id: 'gravity', name: 'GRAVITY ORB', ico: '🌀', color: '#c58aff', desc: 'Pulls loot to you and slows enemies.', rule: { a: 'deep' }, hint: 'Hidden agenda' },
]
export const RELICS = [
  { id: 'none', name: 'NO RELIC', ico: '·', desc: 'No extra skill.', cd: 0, rule: null },
  { id: 'flamedash', name: 'FLAME DASH', ico: '🔥', desc: 'Rush forward in a trail of fire.', cd: 12, rule: { a: 'urns' }, hint: 'Hidden agenda' },
  { id: 'spiritshield', name: 'SPIRIT SHIELD', ico: '👻', desc: 'Become untouchable for 3.5 seconds.', cd: 18, rule: { a: 'flawless' }, hint: 'Hidden agenda' },
  { id: 'chain', name: 'CHAIN LIGHTNING', ico: '⚡', desc: 'Lightning leaps between 6 enemies.', cd: 11, rule: { a: 'speed' }, hint: 'Hidden agenda' },
  { id: 'drain', name: 'SOUL DRAIN', ico: '💀', desc: 'Hurts everything near you and heals you.', cd: 15, rule: { a: 'shrine' }, hint: 'Hidden agenda' },
  { id: 'timeslow', name: 'TIME SLOW', ico: '⏳', desc: 'Everything but you slows down for 5 seconds.', cd: 20, rule: { a: 'deep' }, hint: 'Hidden agenda' },
  { id: 'frostwave', name: 'FROST WAVE', ico: '🌊', desc: 'A freezing wave that locks enemies in place.', cd: 14, rule: { a: 'collector' }, hint: 'Hidden agenda' },
]
export const orbOk = (id) => { const o = ORBS.find((x) => x.id === id); return !!o && ruleOk(o.rule) }
export const relicOk = (id) => { const o = RELICS.find((x) => x.id === id); return !!o && ruleOk(o.rule) }
export const agendasDone = () => Object.keys(U().agenda || {})
export function markAgenda(id) { const u = U(); u.agenda = u.agenda || {}; const fresh = !u.agenda[id]; u.agenda[id] = true; saveProfile(); return fresh }

// ---------- the Abyss: 50 rooms, each its own scenario ----------
const SLOT = ['combat', 'ambush', 'shrine', 'trap', 'puzzle', 'gauntlet', 'elite', 'survival', 'merchant', 'boss']
const ABYSS_TITLES = [
  ['THE SLIME STEPS', 'THE ROOT AMBUSH', 'THE MOSSY SHRINE', 'THE THORN FLOOR', 'THE WHISPER RUNES', 'THE GAUNTLET OF LEAVES', 'THE STAG KNIGHTS', 'THE LONG GREEN HOUR', 'THE MUSHROOM MARKET', 'THE SLIME KING\'S RETURN'],
  ['THE DROWNED PATH', 'THE REEDS THAT MOVE', 'THE LANTERN SHRINE OF THE DEAD', 'THE SINKING PLANKS', 'THE FIREFLY TRIAL', 'THE GAUNTLET OF BONES', 'THE BOG CHAMPIONS', 'THE NIGHT THAT WILL NOT END', 'THE GHOST TRADER', 'THE BONE LORD\'S RETURN'],
  ['THE SINGING STAIRS', 'THE ECHO AMBUSH', 'THE CRYSTAL SHRINE', 'THE RESONANT FLOOR', 'THE MIRROR RUNES', 'THE GAUNTLET OF SHARDS', 'THE GEODE GUARD', 'THE ROCKFALL SURVIVAL', 'THE GEM MERCHANT', 'THE WARDEN\'S RETURN'],
  ['THE BURNING CORRIDOR', 'THE ASH AMBUSH', 'THE FORGE SHRINE', 'THE LAVA VENTS', 'THE EMBER RUNES', 'THE GAUNTLET OF FLAMES', 'THE CINDER ELITE', 'THE HEAT OF A THOUSAND SERVERS', 'THE SALVAGE DEALER', 'THE DRAKE\'S RETURN'],
  ['THE STATIC FIELDS', 'THE VOID AMBUSH', 'THE LAST SHRINE', 'THE TEARING FLOOR', 'THE PATTERN OF NOTHING', 'THE GAUNTLET OF FEAR', 'THE NIGHTMARE GUARD', 'THE SILENCE THAT HUNTS', 'THE FINAL MERCHANT', 'THE VOID EYE: THE CORE'],
]
export const ABYSS_ROOMS = 50
export const abyssRoom = (n) => { const b = Math.floor(n / 10), k = n % 10; return { n, biome: b, type: SLOT[k], title: ABYSS_TITLES[b][k], bossRoom: k === 9 } }
export const abyssBest = () => U().abyss || 0
export function markAbyss(n) { const u = U(); u.abyss = Math.max(u.abyss || 0, n); saveProfile() }
export const abyssOk = () => U().cleared >= 1

// ---------- persistence ----------
const U = () => profile.rogueU || (profile.rogueU = { cleared: 0, secret: {}, lore: {}, wins: {}, agenda: {}, pets: {}, abyss: 0 })
export const ruleOk = (r) => { if (!r) return true; const u = U(); if (r.a) return !!(U().agenda && U().agenda[r.a]); if (r.r) return (profile.rogueRuns || 0) >= r.r; if (r.k) return (profile.rogueKills || 0) >= r.k; if (r.c) return u.cleared >= r.c; if (r.s) return !!u.secret[r.s]; if (r.l) return Object.keys(u.lore).length >= r.l; if (r.ss) return Object.keys(u.secret).length >= r.ss; return false }
export const weaponOk = (cls, id) => { const w = WEAPONS[cls].find((x) => x.id === id); return !!w && ruleOk(w.rule) }
export const powerOk = (id) => { const p = POWERS.find((x) => x.id === id); return !!p && ruleOk(p.rule) }
export const chapterOk = (n) => n <= 1 || U().cleared >= n - 1
export const loreFound = () => Object.keys(U().lore)
export const progress = () => ({ cleared: U().cleared, secrets: Object.keys(U().secret).length, lore: Object.keys(U().lore).length })
const snapshotIds = () => ({ orbs: ORBS.filter((x) => ruleOk(x.rule)).map((x) => x.id), relics: RELICS.filter((x) => ruleOk(x.rule)).map((x) => x.id), pets: PETS.filter((x) => ruleOk(x.rule)).map((x) => x.id), w: Object.keys(WEAPONS).flatMap((k) => WEAPONS[k].filter((x) => ruleOk(x.rule)).map((x) => k + ':' + x.id)), p: POWERS.filter((x) => ruleOk(x.rule)).map((x) => x.id) })
export const unlockSnap = snapshotIds
export function diffUnlocks(before) {
  const now = snapshotIds(), out = []
  for (const k of Object.keys(WEAPONS)) for (const w of WEAPONS[k]) if (now.w.includes(k + ':' + w.id) && !before.w.includes(k + ':' + w.id)) out.push(w.ico + ' ' + w.name + ' (' + k + ' weapon)')
  for (const p of POWERS) if (now.p.includes(p.id) && !before.p.includes(p.id)) out.push(p.ico + ' ' + p.name + ' (power)')
  for (const o of ORBS) if (now.orbs.includes(o.id) && !(before.orbs || []).includes(o.id)) out.push(o.ico + ' ' + o.name + ' (orb)')
  for (const o of RELICS) if (now.relics.includes(o.id) && !(before.relics || []).includes(o.id)) out.push(o.ico + ' ' + o.name + ' (relic skill, key F)')
  for (const p of PETS) if (now.pets.includes(p.id) && !(before.pets || []).includes(p.id)) out.push(p.ico + ' ' + p.name + ' (companion)')
  return out
}
export function markCleared(n) { const u = U(); u.cleared = Math.max(u.cleared, n); u.wins[n] = (u.wins[n] || 0) + 1; saveProfile() }
export function markSecret(n) { const u = U(); const fresh = !u.secret[n]; u.secret[n] = true; saveProfile(); return fresh }
export function markLore(id) { const u = U(); const fresh = !u.lore[id]; u.lore[id] = true; saveProfile(); return fresh }
