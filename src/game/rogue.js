// NEON DEPTHS: a 3D roguelike dungeon crawler you can play alone or with up to 2 friends online (co-op).
// 3 classes, 3 floors of 4 rooms (the last room of every floor is a boss), a perk after every room.
// Move with WASD / arrows (or the touch stick); you attack automatically. Space = dash, Q = class special, 1-3 = pick a perk.
import { G, emit as engineEmit, keys, games, profile, saveProfile, recordScore, part, ring, shake, flash, stepParticles, toMenu } from './engine.js'
import { sfx, music, speak } from './audio.js'
import { col, clamp, R } from './pxl.js'
import { drawRogue3, rogueCamera, rogueLights, unprojectGround, THEMES } from './rogue3d.js'
import { CHAPTERS, WEAPONS, POWERS, LORE, ROOM_SIZE, weaponOk, powerOk, chapterOk, markCleared, markSecret, markLore, unlockSnap, diffUnlocks, progress, PETS, petOk, petInfo, petGain, petStageOf, savePets, PET_MAXLV, AGENDAS, ORBS, RELICS, orbOk, relicOk, markAgenda, abyssRoom, ABYSS_ROOMS, markAbyss, abyssOk, abyssBest, agendasDone } from './rogueworld.js'
export { AGENDAS, ORBS, RELICS, orbOk, relicOk, abyssRoom, ABYSS_ROOMS, abyssOk, abyssBest, agendasDone, CHAPTERS, WEAPONS, POWERS, LORE, weaponOk, powerOk, chapterOk, progress, PETS, petOk, petInfo, PET_MAXLV }
const ROOMS = 5
const themeOf = () => THEMES[CHAPTERS[Math.min(RG.floor, 4)].theme]

export let AX = 44, AY = 23
export const CLASSES = [
  { id: 'knight', name: 'KNIGHT', ico: '⚔️', color: '#ffd23a', hp: 6, spd: 30, dmg: 15, rate: 0.38, desc: 'Sweeping sword. Tough. Special: WHIRLWIND.' },
  { id: 'ranger', name: 'RANGER', ico: '🏹', color: '#6aff9a', hp: 4, spd: 34, dmg: 9, rate: 0.26, desc: 'Fast arrows that pierce. Special: ARROW VOLLEY.' },
  { id: 'mage', name: 'MAGE', ico: '🔮', color: '#c58aff', hp: 4, spd: 30, dmg: 13, rate: 0.42, desc: 'Homing orbs. Special: FROST NOVA.' },
]
const PERKS = [
  { id: 'dmg', name: 'SHARPENED', ico: '🗡️', desc: '+25% damage', f: (p) => { p.dmg *= 1.25 } },
  { id: 'rate', name: 'QUICKDRAW', ico: '⚡', desc: '+22% attack speed', f: (p) => { p.rate *= 0.82 } },
  { id: 'hp', name: 'HEART JAR', ico: '❤️', desc: '+1 max heart and heal 2', f: (p) => { p.max += 1; p.hp = Math.min(p.max, p.hp + 2) } },
  { id: 'spd', name: 'WINGED BOOTS', ico: '👟', desc: '+14% move speed', f: (p) => { p.spd *= 1.14 } },
  { id: 'multi', name: 'MULTISHOT', ico: '✨', desc: '+1 projectile (knight: wider swing)', f: (p) => { p.multi += 1 } },
  { id: 'crit', name: 'LUCKY STRIKE', ico: '🍀', desc: '+12% crit chance (x2.2)', f: (p) => { p.crit += 0.12 } },
  { id: 'vamp', name: 'VAMPIRIC', ico: '🦇', desc: '12% to heal on kill', f: (p) => { p.vamp += 0.12 } },
  { id: 'shield', name: 'AEGIS', ico: '🛡️', desc: 'Block one hit every room', f: (p) => { p.aegis = true; p.shield = 1 } },
  { id: 'dash', name: 'SLIPSTREAM', ico: '💨', desc: 'Dash recharges 35% faster', f: (p) => { p.dashCd *= 0.65 } },
  { id: 'pierce', name: 'PIERCING', ico: '🔱', desc: 'Shots pierce +1 (knight: knockback)', f: (p) => { p.pierce += 1 } },
  { id: 'magnet', name: 'MAGNET', ico: '🧲', desc: 'Pull gold from far away', f: (p) => { p.magnet += 14 } },
  { id: 'special', name: 'OVERCHARGE', ico: '🌀', desc: 'Special recharges 35% faster', f: (p) => { p.spCd *= 0.65 } },
]

// ---------- the fantasy cast: races, pets and the skills each class learns as it levels up ----------
const dp = () => profile.rogueDeep || 0
export const RACES = [
  { id: 'human', name: 'HALF-BLOOD', ico: '🧑', desc: 'Part human, part something older. +15% XP and a 4th perk to choose from.', hint: '', ok: () => true, f: (p) => { p.xpMul = 1.15; p.perkN = 4 } },
  { id: 'elf', name: 'ELF', ico: '🧝', desc: 'Swift and sharp-eyed. +12% speed, +10% crit chance.', hint: 'Finish one run', ok: () => (profile.rogueRuns || 0) >= 1, f: (p) => { p.spd *= 1.12; p.crit += 0.1 } },
  { id: 'dwarf', name: 'DWARF', ico: '🧔', desc: 'Stout and stubborn. +2 hearts and a 20% chance to shrug off a hit.', hint: 'Clear the first forest', ok: () => dp() >= 4, f: (p) => { p.max += 2; p.hp += 2; p.armor = 0.2 } },
  { id: 'undead', name: 'UNDEAD', ico: '💀', desc: 'Death is a suggestion. Rises once per run, heals 1 heart per 6 kills, but has 1 less heart.', hint: 'Clear the marsh (room 8)', ok: () => dp() >= 8 || (profile.rogueWins || 0) >= 1, f: (p) => { p.max = Math.max(2, p.max - 1); p.hp = Math.min(p.hp, p.max); p.rise = 1 } },
  { id: 'fairy', name: 'FAIRY', ico: '🧚', desc: 'Tiny and hovering. Dash recharges 40% faster and your light heals friends nearby.', hint: 'Clear the first forest', ok: () => dp() >= 4, f: (p) => { p.dashCd *= 0.6; p.glow = true; p.max = Math.max(2, p.max - 1); p.hp = Math.min(p.hp, p.max) } },
]
export const SKILLS = {
  knight: [{ name: 'WHIRLWIND', lv: 1, cd: 9, ico: '🌀' }, { name: 'SHIELD BASH', lv: 3, cd: 7, ico: '🛡️' }, { name: 'WAR CRY', lv: 6, cd: 16, ico: '📣' }],
  ranger: [{ name: 'ARROW VOLLEY', lv: 1, cd: 9, ico: '🏹' }, { name: 'SPIKE TRAP', lv: 3, cd: 8, ico: '🪤' }, { name: 'ARROW RAIN', lv: 6, cd: 16, ico: '🌧️' }],
  mage: [{ name: 'FROST NOVA', lv: 1, cd: 9, ico: '❄️' }, { name: 'BLINK', lv: 3, cd: 6, ico: '✨' }, { name: 'METEOR', lv: 6, cd: 16, ico: '☄️' }],
}
export const MAXLV = 10
export const xpNeed = (lv) => 22 + lv * 16 + lv * lv * 2
const unlockSnapshot = () => ({ races: RACES.filter((r) => r.ok()).map((r) => r.id), pets: PETS.filter((r) => petOk(r.id)).map((r) => r.id) })
export const EN = {
  slime: { hp: 20, spd: 12, c: '#5aff7a', r: 1.6, dmg: 1, gold: 2 },
  wolf: { hp: 14, spd: 21, c: '#8a93a8', r: 1.4, dmg: 1, gold: 2 },
  skeleton: { hp: 30, spd: 11, c: '#e8e8cc', r: 1.5, dmg: 1, gold: 4, shoot: 2.8 },
  bat: { hp: 10, spd: 22, c: '#c06aff', r: 1.1, dmg: 1, gold: 2 },
  archer: { hp: 16, spd: 10, c: '#ffb04a', r: 1.4, dmg: 1, gold: 3, shoot: 1.9 },
  brute: { hp: 70, spd: 9, c: '#ff5a5a', r: 2.3, dmg: 2, gold: 6 },
  caster: { hp: 22, spd: 8, c: '#4ad8ff', r: 1.4, dmg: 1, gold: 5, shoot: 2.4 },
  king: { hp: 420, spd: 8, c: '#3adf6a', r: 4.6, dmg: 2, gold: 40, boss: true, name: 'SLIME KING' },
  lord: { hp: 640, spd: 9, c: '#e8e8ff', r: 3.6, dmg: 2, gold: 60, boss: true, name: 'BONE LORD' },
  eye: { hp: 820, spd: 10, c: '#ff4adf', r: 4, dmg: 2, gold: 90, boss: true, name: 'VOID EYE' },
  golem: { hp: 900, spd: 7, c: '#6ad8ff', r: 4.8, dmg: 2, gold: 100, boss: true, name: 'CRYSTAL WARDEN' },
  drake: { hp: 1000, spd: 11, c: '#ff5a2a', r: 5, dmg: 2, gold: 120, boss: true, name: 'CINDER DRAKE' },
  imp: { hp: 26, spd: 16, c: '#ff6a3a', r: 1.3, dmg: 1, gold: 4, shoot: 1.6 },
}
const BOSS = CHAPTERS.map((c) => c.boss)
const pace = () => (RG.diff === 'story' ? 0.62 : RG.diff === 'heroic' ? 0.95 : 0.8)

// the story of the Depths (told in cut-scenes when you play alone; shown as banners in co-op)
const TALE = {
  start: [['sys', 'BENEATH THE GRID, WHERE DELETED GAMES ROT, A FOREST GREW. THE OLD PLAYERS CALL IT THE DEPTHS.'], ['nova', 'At its heart burns the Last Lantern, the one light the OVERLORD could never erase.'], ['nova', 'Three guardians keep it from you: the SLIME KING, the BONE LORD and the VOID EYE.'], ['hero', 'Then I will take it back. Every deleted game, every lost score, all of it.'], ['nova', 'Keep your own lantern lit, hero. The woods do not like the light.']],
  f1: [['sys', 'THE CURSED MARSH. THE TREES HAVE STOPPED WHISPERING.'], ['hero', 'Quiet. That is worse than the whispering.'], ['nova', 'Things in here remember being games. They are angry about being forgotten.']],
  f2: [['sys', 'THE VOID GROVE. EVEN THE LIGHT IS AFRAID HERE.'], ['nova', 'The Lantern is close. I can feel its heat.'], ['hero', 'And something is watching us.'], ['ovl', 'I HAVE WATCHED YOU SINCE THE FIRST TREE.']],
  boss: [
    [['king', 'A little snack wandered into my kingdom! Bring it to me, my jellies!'], ['hero', 'I am not food. I am the one who is going to pop you.']],
    [['lord', 'Another bright little soul. I collect those. Come, join my court.'], ['hero', 'I have a lantern and a sharp opinion about your court.']],
    [['eye', 'THE LANTERN IS MINE. EVERY GAME IS MINE. YOU ARE A BUG.'], ['hero', 'Then I am the bug that fixes you.']],
  ],
  win: 'The Last Lantern blazes in your hands. Across the Grid, every deleted game flickers awake. The Depths bloom, and the forest finally sleeps.',
  who: { golem: ['CRYSTAL WARDEN', '#6ad8ff', '💎'], drake: ['CINDER DRAKE', '#ff5a2a', '🐉'], sys: ['THE DEPTHS', '#6aff9a', '🌲'], nova: ['NOVA', '#ff4de1', '🤖'], hero: ['YOU', '#3de8ff', '🧑‍🚀'], ovl: ['OVERLORD', '#ff3a3a', '👁'], king: ['SLIME KING', '#3adf6a', '👑'], lord: ['BONE LORD', '#e8e8ff', '💀'], eye: ['VOID EYE', '#ff4adf', '👁️'] },
}
const RACE_LINE = { human: ['hero', 'Half of me belongs to the old world, half to the Grid. The forest cannot decide which half to fear.'], elf: ['hero', 'The elder trees know my people. They lean away, in respect, or in fear.'], dwarf: ['hero', 'Stone and beard and a very bad temper. Let the forest come.'], undead: ['hero', 'I have died before. It was boring. I am not afraid of the dark; I grew up in it.'], fairy: ['hero', 'I am small, yes. But a lantern is small too, and look what it does to the dark.'] }
function say(lines) {
  if (!lines || !lines.length) return
  if (RG.net || RG.players.length > 1) { RG.msg = { text: TALE.who[lines[0][0]][0], sub: lines[0][1].slice(0, 90), color: TALE.who[lines[0][0]][1], t: 4 }; return }
  RG.tale = { lines, i: 0 }
}
const mkPlayer = (cls, name, remote, race = 0, pet = 0) => {
  const c = CLASSES[clamp(cls | 0, 0, 2)]
  const pl = mkBase(cls, name, remote, c)
  pl.race = clamp(race | 0, 0, RACES.length - 1); pl.pet = clamp(pet | 0, 0, PETS.length - 1); if (!petOk(PETS[pl.pet].id)) pl.pet = 0
  RACES[pl.race].f(pl)
  return pl
}
const mkBase = (cls, name, remote, c) => {
  return { cls: clamp(cls | 0, 0, 2), orb: 'none', relic: 'none', rT: 0, orbA: 0, vk: 0, orbT: 0, wid: '', wmod: {}, pw: 'none', hitN: 0, greed: false, aura: false, trail: false, xp: 0, lv: 1, xpMul: 1, perkN: 3, armor: 0, rise: 0, killHeal: 0, glow: false, race: 0, pet: 0, buff: 0, sT2: 0, sT3: 0, hold: false, sn: [0, 0, 0, 0], seenSn: [0, 0, 0, 0], lvT: 0, name, remote: !!remote, x: -AX + 6, y: 0, hp: c.hp, max: c.hp, spd: c.spd, dmg: c.dmg, rate: c.rate, multi: 1, crit: 0.05, vamp: 0, shield: 0, aegis: false, pierce: 0, magnet: 4, dashCd: 1.3, spCd: 9, dashT: 0, spT: 0, atkT: 0, inv: 0, dash: 0, dx: 1, dy: 0, face: 0, mx: 0, my: 0, walk: 0, alive: true, perks: [], choices: null, swing: null, aimPt: null, aimT: -9, dashN: 0, spN: 0, seenDash: 0, seenSp: 0, inp: { mx: 0, my: 0 }, hurtT: 0, vx: 0, vy: 0 }
}
export const RG = { mode: 'idle', paused: false, floors: 3, floor: 0, room: 0, players: [], me: 0, p: null, en: [], eb: [], pb: [], loot: [], obst: [], open: false, gold: 0, kills: 0, t: 0, emitT: 0, msg: null, over: null, stick: [0, 0], fx: [], spawnQ: [], net: null, eid: 1, tale: null, abyss: false, ag: null, roomT: 0, hurtRoom: false, hz: [], urns: [], surv: 0, survMax: 0, slowT: 0, chapter: 1, rtype: 'combat', ax: 44, ay: 23, puz: null, chests: [], secret: null, sub: null, found: null, unlockBefore: null, rk: 0, pets: [], traps: [], rains: [], meteors: [], unlocked: null, bossT: 0, ambT: 4, heartT: 0, cam: null, doorT: 0 }
let snap = null
const subs = new Set()
export const subscribeRogue = (f) => { subs.add(f); return () => subs.delete(f) }
export const getRogueSnap = () => snap
const lp = () => RG.players[RG.me] || RG.players[0]
const alive = () => RG.players.filter((p) => p.alive)
function roomGoal() {
  if (RG.mode !== 'play') return ''
  if (RG.open) {
    if (RG.chests.some((c) => !c.open && (c.kind === 'puzzle' || c.kind === 'vault'))) return 'OPEN THE CHEST, THEN GO RIGHT ▶'
    if (RG.secret && RG.secret.found) return 'THE PURPLE LIGHT IS A SECRET VAULT, OR GO RIGHT ▶'
    return 'ROOM CLEAR: WALK TO THE GLOWING DOOR ON THE RIGHT ▶'
  }
  const t = RG.rtype
  if (t === 'puzzle') return RG.puz && RG.puz.showing ? 'WATCH THE RUNES LIGHT UP…' : 'STEP ON THE RUNES IN THE SAME ORDER'
  if (t === 'survival') return 'SURVIVE UNTIL THE TIMER ENDS'
  if (t === 'trap') return 'DEFEAT THEM · AVOID THE GLOWING FLOOR TILES'
  if (t === 'boss') return 'DEFEAT THE GUARDIAN · DODGE ITS SHOTS, CLICK TO ATTACK'
  return 'DEFEAT ALL ENEMIES · CLICK TO ATTACK · SPACE TO DASH'
}
function emitR() {
  const p = lp()
  const bossE = RG.en.find((e) => e.def && e.def.boss && !e.dead)
  snap = {
    mode: RG.mode, paused: RG.paused, cls: p ? p.cls : 0, floor: RG.floor + 1, room: RG.room + 1, hp: p ? p.hp : 0, max: p ? p.max : 0, shield: p ? p.shield : 0, gold: RG.gold, kills: RG.kills,
    dash: p ? Math.max(0, p.dashT) / p.dashCd : 0, special: p ? Math.max(0, p.spT) / p.spCd : 0,
    choices: p && p.choices ? p.choices.map((c) => ({ id: c.id, name: c.name, ico: c.ico, desc: c.desc })) : null, msg: RG.msg ? { ...RG.msg } : null, over: RG.over,
    boss: bossE ? { name: bossE.def.name, hp: Math.max(0, bossE.hp) / bossE.max } : null, perks: p ? p.perks.slice() : [], open: RG.open,
    coop: RG.players.length > 1 || !!RG.net, net: RG.net ? RG.net.role : null, waiting: RG.players.filter((x) => x.choices).length,
    team: RG.players.map((x, i) => ({ name: x.name, cls: x.cls, race: x.race, lv: x.lv, hp: x.hp, max: x.max, alive: x.alive, me: i === RG.me })), theme: themeOf().name, goal: roomGoal(), remain: RG.en.filter((e) => !e.dead).length + RG.spawnQ.length, abyss: RG.abyss, aroom: RG.room + 1, aroomN: ABYSS_ROOMS, atitle: RG.abyss ? abyssRoom(Math.min(RG.room, ABYSS_ROOMS - 1)).title : '', surv: Math.ceil(RG.surv), orb: p ? (ORBS.find((o) => o.id === p.orb) || ORBS[0]) : ORBS[0], relic: p ? (() => { const d = RELICS.find((o) => o.id === p.relic) || RELICS[0]; return { id: d.id, name: d.name, ico: d.ico, cd: d.cd ? Math.max(0, p.rT) / d.cd : 0, has: d.id !== 'none' } })() : null, shops: RG.chests.filter((c) => c.kind === 'shop' && !c.open).map((c) => ({ label: c.label, price: c.price })), hazard: RG.hz.length > 0, urns: RG.urns.length, slow: RG.slowT > 0, chapter: RG.chapter, chName: CHAPTERS[RG.chapter - 1].name, chSub: CHAPTERS[RG.chapter - 1].sub, roomN: RG.room + 1, rooms: ROOMS, rtype: RG.rtype, sub: RG.sub, puz: RG.puz ? { step: RG.puz.step, n: RG.puz.seq.length, showing: RG.puz.showing, solved: RG.puz.solved } : null, secretHint: !!(RG.secret && !RG.secret.found && RG.open), secretOpen: !!(RG.secret && RG.secret.found), wpn: p ? (WEAPONS[CLASSES[p.cls].id].find((w) => w.id === p.wid) || {}) : {}, pwr: p ? (POWERS.find((w) => w.id === p.pw) || {}) : {}, dead: !!(p && !p.alive), lv: p ? p.lv : 1, xp: p ? p.xp : 0, need: p ? (p.lv >= MAXLV ? 1 : xpNeed(p.lv)) : 1, race: p ? p.race : 0, pet: p ? p.pet : 0, petName: p && p.pet ? petInfo(PETS[p.pet].id).name : '', petLv: p && p.pet ? petInfo(PETS[p.pet].id).lv : 0, buff: p ? p.buff > 0 : false,
    skills: p ? SKILLS[CLASSES[p.cls].id].map((k, i) => ({ name: k.name, ico: k.ico, lv: k.lv, open: p.lv >= k.lv, cd: Math.max(0, i === 0 ? p.spT : i === 1 ? p.sT2 : p.sT3) / (k.cd * p.spCd / 9) })) : [], tale: RG.tale ? { who: TALE.who[RG.tale.lines[RG.tale.i][0]], text: RG.tale.lines[RG.tale.i][1], i: RG.tale.i, n: RG.tale.lines.length } : null,
  }
  subs.forEach((f) => f())
}

function applyGear(p, wid, pid, orb, relic) {
  p.orb = orb && orbOk(orb) ? orb : 'none'; p.relic = relic && relicOk(relic) ? relic : 'none'
  const list = WEAPONS[CLASSES[p.cls].id], w = list.find((x) => x.id === wid && weaponOk(CLASSES[p.cls].id, x.id)) || list[0]
  p.wid = w.id; p.wmod = w.mod || {}
  if (p.wmod.pierce) p.pierce += p.wmod.pierce
  const pw = POWERS.find((x) => x.id === pid && powerOk(x.id)) || POWERS[0]
  p.pw = pw.id
  if (pw.id === 'ironskin') p.armor = Math.max(p.armor, 0.15)
  else if (pw.id === 'huntmark') { p.crit += 0.12; p.dmg *= 1.06 }
  else if (pw.id === 'secondwind') p.rise += 1
  else if (pw.id === 'aura') p.aura = true
  else if (pw.id === 'trail') p.trail = true
  else if (pw.id === 'greed') { p.greed = true; p.magnet += 12 }
}
const tierOf = (lv) => (lv >= 9 ? 3 : lv >= 6 ? 2 : lv >= 3 ? 1 : 0)
export const TIER_NAME = ['', 'AWAKENED', 'ASCENDANT', 'RADIANT']
function syncTier(p, quiet) {
  while ((p.tier || 0) < tierOf(p.lv)) {
    p.tier = (p.tier || 0) + 1
    if (p.tier === 1) p.dmg *= 1.08; else if (p.tier === 2) { p.spd *= 1.08; p.dashCd *= 0.9; p.max += 1; p.hp += 1 } else { p.dmg *= 1.12; p.crit += 0.08; p.max += 1; p.hp += 1 }
    if (!quiet) { ring(p.x, p.y, 50, 60, [col(CLASSES[p.cls].color)]); shake(0.6); if (p === lp()) { sfx('mission'); RG.msg = { text: 'YOU ASCEND: ' + TIER_NAME[p.tier], sub: ['', 'A RUNE RING WAKES AROUND YOU', 'LIGHT FLOWS BEHIND YOU WHEREVER YOU RUN', 'A HALO OF THE LAST LANTERN CROWNS YOU'][p.tier], color: '#ffe84a', t: 4 } } }
  }
}
function trailStep(p, dt) { p.hT = (p.hT || 0) - dt; if (p.hT <= 0) { p.hT = 0.05; const h = p.hist || (p.hist = []); h.unshift([p.x, p.y]); if (h.length > 14) h.pop() } }
function levelTo(p, lv) { while (p.lv < lv) { p.lv++; p.dmg *= 1.06; if (p.lv % 2 === 0) { p.max += 1; p.hp += 1 } } p.hp = p.max; syncTier(p, true) }
function start(cfg = {}) {
  const net = RG.net && cfg.type === 'online' ? RG.net : null
  RG.net = net
  RG.abyss = cfg.mode === 'abyss' && abyssOk(); RG.diff = ['story', 'normal', 'heroic'].includes(cfg.diff) ? cfg.diff : 'normal'
  RG.chapter = RG.abyss ? 1 : clamp(cfg.chapter | 0 || 1, 1, CHAPTERS.length); RG.floor = RG.chapter - 1; RG.floors = 1
  const me = mkPlayer(cfg.cls | 0, (profile.name || 'YOU').slice(0, 10), false, cfg.race | 0, cfg.pet | 0)
  applyGear(me, cfg.weapon, cfg.power, cfg.orb, cfg.relic); levelTo(me, RG.abyss ? 6 : 1 + 2 * (RG.chapter - 1))
  if (RG.diff === 'story') { me.max += 2; me.hp = me.max; me.armor = Math.max(me.armor, 0.15) } else if (RG.diff === 'heroic') { me.max = Math.max(2, me.max - 1); me.hp = me.max }
  RG.players = [me]; RG.me = 0; RG.p = me; RG.pets = mkPets([me]); RG.traps = []; RG.rains = []; RG.meteors = []; RG.unlocked = unlockSnapshot(); RG.unlockBefore = unlockSnap()
  RG.room = 0; RG.sub = null; RG.gold = 0; RG.kills = 0; RG.over = null; RG.paused = false; RG.t = 0; RG.fx = []; RG.eid = 1; RG.rk = 0; RG.bossT = 0; RG.found = { secret: false, lore: [] }
  RG.ag = { urns: 0, streak: 0, shrines: 0, vault: false, puzzle: false, done: [] }; RG.slowT = 0
  G.mode = 'rogue'; engineEmit(); G.parts = []; G.pops = []; G.shake = 0; G.flash = 0
  RG.mode = 'play'; RG.tale = null
  enterRoom()
  { const ch = CHAPTERS[RG.chapter - 1], me2 = lp(), line = RACE_LINE[RACES[me2.race].id], pl = PETS[me2.pet]
    if (RG.abyss) say([['sys', 'BELOW THE FIVE FORESTS THE GRID KEPT A SIXTH PLACE: THE ABYSS. FIFTY ROOMS, EACH A LITTLE SCENARIO, EACH ONE DEEPER THAN THE LAST.'], ['nova', 'Nobody has ever reached the bottom. Rumour says the dungeon rewards those who play it differently: break the pots, walk untouched, kneel at the shrines. It keeps secrets for the curious.'], line, ['hero', 'Fifty rooms. Then let us count them.']])
    else say(RG.chapter === 1 ? [...ch.intro, line, ['nova', (pl.id === 'none' ? 'You travel alone, which is brave. Companions unlock as you play. ' : 'Your ' + petInfo(pl.id).name.toLowerCase() + ' will watch your back and grow stronger with you. ') + 'CLICK to attack, level up, learn skills, unlock stronger weapons, and keep an eye out for cracked walls and clay pots.']] : ch.intro) }
  music.set('slugboss', 0); sfx('mission'); emitR()
}
function stop() { RG.mode = 'idle'; RG.paused = false; if (RG.net) { const n = RG.net; RG.net = null; if (n.onStop) try { n.onStop() } catch { /* ignore */ } } music.set('menu'); emitR() }
const RUNE_COL = ['#ff4a8a', '#3de8ff', '#6aff9a', '#ffd23a', '#c58aff']
const SIZE_OF = { ambush: 'combat', gauntlet: 'combat', survival: 'combat', trap: 'combat', shrine: 'treasure', merchant: 'treasure' }
function enterRoom() {
  const n = RG.players.length
  const ar = RG.abyss && RG.sub !== 'secret' ? abyssRoom(Math.min(RG.room, ABYSS_ROOMS - 1)) : null
  if (ar) { RG.floor = ar.biome; RG.chapter = ar.biome + 1 }
  const ch = CHAPTERS[RG.chapter - 1]
  RG.rtype = RG.sub === 'secret' ? 'secret' : ar ? ar.type : ch.plan[Math.min(RG.room, ROOMS - 1)]
  const [sx0, sy0] = ROOM_SIZE[SIZE_OF[RG.rtype] || RG.rtype]
  // fighting rooms are stretched by the chosen map size (x1 .. x20); quiet rooms (shops, shrines, puzzles) stay cosy
  const KS = [1, 2, 4, 8, 12, 20].includes(profile.depthsScale) ? profile.depthsScale : 4
  RG.ks = ['combat', 'elite', 'boss', 'ambush', 'gauntlet', 'survival', 'trap'].includes(RG.rtype) ? KS : 1
  const sx = Math.round(sx0 * RG.ks), sy = Math.round(sy0 * RG.ks)
  RG.ax = AX = sx; RG.ay = AY = sy
  RG.players.forEach((p, i) => {
    p.x = -AX + 6; p.y = (i - (n - 1) / 2) * 7; p.inv = 1; if (p.aegis) p.shield = 1
    if (!p.alive) { p.alive = true; p.hp = Math.max(1, Math.ceil(p.max / 2)) }
    p.choices = null; p.swing = null; p.hist = []
  })
  RG.en = []; RG.eb = []; RG.pb = []; RG.loot = []; RG.open = false; RG.spawnQ = []; RG.rk++; RG.doorT = 0; RG.traps = []; RG.rains = []; RG.meteors = []
  RG.puz = null; RG.chests = []; RG.secret = null; RG.hz = []; RG.urns = []; RG.surv = 0; RG.roomT = 0; RG.hurtRoom = false
  for (const pt of RG.pets) { pt.x = pt.owner.x - 2; pt.y = pt.owner.y + 2 }
  RG.obst = []
  const boss = RG.rtype === 'boss'
  const quiet = RG.rtype === 'treasure' || RG.rtype === 'shrine' || RG.rtype === 'merchant'
  const k = quiet ? 1 : boss ? 3 : RG.rtype === 'puzzle' ? 2 : Math.min(Math.round((AX * AY) / 330), 70 + 12 * RG.ks) + ((Math.random() * 3) | 0)
  for (let i = 0; i < k; i++) {
    const w = 4 + 2 * ((Math.random() * 3) | 0), h = 4 + 2 * ((Math.random() * 3) | 0)
    const x = R(-AX + 16, AX - 14), y = R(-AY + 6, AY - 6)
    if ((boss || RG.rtype === 'puzzle') && Math.abs(x) < 16 && Math.abs(y) < 16) continue
    if (x + w / 2 > AX - 24 && Math.abs(y) < h / 2 + 7) continue // keep the lane to the door open
    RG.obst.push({ x, y, w, h, s: (Math.random() * 1000) | 0 })
  }
  RG.obst = RG.obst.filter((o) => !(Math.abs(o.x + AX - 6) < o.w / 2 + 8 && Math.abs(o.y) < o.h / 2 + 8 + n * 4))
  const dif = RG.abyss ? 1 + RG.room * 0.035 : 1
  const dm = { story: 0.6, normal: 1, heroic: 1.3 }[RG.diff] || 1
  const sc = (1 + RG.floor * 0.28) * (1 + 0.5 * (n - 1)) * dif * dm
  const areaK = clamp((AX * AY) / 2300, 0.7, 2.3) * (1 + 0.55 * (Math.sqrt(RG.ks) - 1))
  const spawn = (type, x, y, delay, elite) => RG.spawnQ.push({ type, x, y, t: delay, sc, elite: !!elite })
  const fight = (budget, eliteN, t0 = 0) => {
    let b = budget, i = 0
    const pool = ch.pool
    while (b > 0) { const t = pool[(Math.random() * pool.length) | 0], cost = t === 'brute' ? 4 : t === 'caster' || t === 'imp' ? 3 : t === 'archer' || t === 'skeleton' ? 2 : 1.5; b -= cost; if (t === 'wolf') { const bx = R(-8, AX - 8), by = R(-AY + 6, AY - 6); for (let q = 0; q < 3; q++) spawn('wolf', bx + R(-3, 3), by + R(-3, 3), t0 + 0.8 + i * 0.3); b -= 2.5; i++ } else { spawn(t, R(-6, AX - 6), R(-AY + 4, AY - 4), t0 + 0.8 + i * 0.3); i++ } }
    for (let q = 0; q < eliteN; q++) spawn(pool[(Math.random() * pool.length) | 0], R(6, AX - 8), R(-AY + 6, AY - 6), t0 + 1.2 + q * 0.6, true)
  }
  const idx = RG.abyss ? RG.room : RG.room
  const budget = ((6 + (RG.abyss ? 4 + RG.floor * 3 : RG.chapter * 3) + idx * (RG.abyss ? 0.5 : 2)) * (1 + 0.4 * (n - 1))) * areaK * 0.75 * ({ story: 0.75, normal: 1, heroic: 1.2 }[RG.diff] || 1)
  if (boss) { const bt = BOSS[Math.min(RG.floor, 4)]; spawn(bt, AX - 18, 0, 1.6); RG.bossT = 3.2; sfx('rgBoss'); speak(EN[bt].name, 0.4, 0.9) }
  else if (RG.rtype === 'combat') fight(budget, 0)
  else if (RG.rtype === 'elite') fight(budget * 1.0, 2 + (n > 1 ? 1 : 0) + (RG.abyss ? 1 : 0))
  else if (RG.rtype === 'secret') fight(budget * 1.2, 3)
  else if (RG.rtype === 'ambush') { fight(budget * 0.5, 0, 0); for (let q = 0; q < Math.round(8 * areaK); q++) { const a = Math.random() * 6.28; spawn(ch.pool[(Math.random() * ch.pool.length) | 0], clamp(Math.cos(a) * AX * 0.9, -AX + 4, AX - 4), clamp(Math.sin(a) * AY * 0.9, -AY + 4, AY - 4), 3 + q * 0.25) } }
  else if (RG.rtype === 'gauntlet') { fight(budget * 0.45, 0, 0); fight(budget * 0.45, 1, 14); fight(budget * 0.5, 1, 30) }
  else if (RG.rtype === 'survival') { RG.surv = RG.survMax = 28 + RG.floor * 4; fight(budget * 0.35, 0) }
  else if (RG.rtype === 'trap') { fight(budget * 0.7, 0); const nz = 4 + Math.round(areaK * 2); for (let q = 0; q < nz; q++) RG.hz.push({ x: R(-AX + 14, AX - 14), y: R(-AY + 6, AY - 6), w: R(6, 11), h: R(5, 9), ph: Math.random() * 3, on: false, warn: false }) }
  else if (RG.rtype === 'puzzle') initPuzzle(ch)
  else if (RG.rtype === 'treasure') { RG.chests.push({ x: AX * 0.3, y: 0, open: false, kind: 'treasure' }); RG.open = true }
  else if (RG.rtype === 'shrine') { RG.chests.push({ x: AX * 0.2, y: 0, open: false, kind: 'shrine' }); RG.open = true }
  else if (RG.rtype === 'merchant') {
    const items = [['heart', 35, 'A HEART JAR', 'MAX HEARTS +1 AND A FULL HEAL'], ['perk', 55, 'A FREE PERK', 'PICK 1 OF 3 PERKS'], ['refresh', 25, 'SKILL SCROLL', 'ALL COOLDOWNS RESET'], ['tome', 45, 'AN XP TOME', 'GAIN A LEVEL']].sort(() => Math.random() - 0.5).slice(0, 3)
    items.forEach((it, i) => RG.chests.push({ x: AX * 0.2 + 0, y: (i - 1) * 8, open: false, kind: 'shop', item: it[0], price: it[1] + RG.floor * 10, label: it[2], sub: it[3] }))
    RG.open = true
  }
  // clay pots hide in many rooms: five of them hold a secret
  if ((RG.rtype === 'combat' || RG.rtype === 'elite' || RG.rtype === 'ambush' || RG.rtype === 'trap' || RG.rtype === 'gauntlet' || RG.rtype === 'survival') && Math.random() < 0.55) for (let q = 0; q < 1 + (Math.random() < 0.4 ? 1 : 0); q++) RG.urns.push({ x: R(-AX + 10, AX - 12), y: R(-AY + 5, AY - 5), hp: 2 })
  // a hidden passage hides in one room of every chapter: a cracked wall that only opens once the room is quiet
  if (!RG.abyss && RG.rtype !== 'secret' && !boss && RG.room === ch.secretRoom - 1) RG.secret = { x: R(-AX * 0.4, AX * 0.3), y: AY - 0.8, hp: 6, found: false }
  if (boss && RG.rtype === 'boss') say(ch.boss_in)
  if (RG.abyss && RG.room % 10 === 0 && RG.room > 0) say([['sys', 'THE ABYSS DEEPENS. ' + CHAPTERS[RG.floor].name + '.'], ['nova', ['', 'The marsh again, but older, and hungrier.', 'The crystals sing in a key you have not heard before.', 'The ember rooms are hotter than the ruins ever were.', 'There is no light left but yours. Hold the lantern high.'][RG.floor] || '']])
  if (RG.abyss && RG.room >= 24) agenda('deep')
  const lab = ar ? ar.title : { combat: 'ROOM ' + (RG.room + 1) + ' OF ' + ROOMS, elite: 'ELITE GUARD', puzzle: 'RUNE TRIAL', treasure: 'TREASURE ROOM', secret: 'THE HIDDEN VAULT', boss: 'SOMETHING STIRS IN THE DARK…' }[RG.rtype]
  const head = ar ? 'ROOM ' + (RG.room + 1) + ' / ' + ABYSS_ROOMS : RG.rtype === 'boss' ? 'BOSS: ' + EN[BOSS[Math.min(RG.floor, 4)]].name : RG.room === 0 && RG.sub !== 'secret' ? ch.name : { combat: 'THE DEPTHS', elite: 'ELITE GUARD', puzzle: 'RUNE TRIAL', treasure: 'TREASURE ROOM', secret: 'HIDDEN VAULT' }[RG.rtype]
  RG.msg = { text: head, sub: lab + (RG.rtype === 'ambush' ? ' · THEY ARE COMING FROM EVERYWHERE' : RG.rtype === 'survival' ? ' · SURVIVE ' + RG.surv + 's' : RG.rtype === 'trap' ? ' · WATCH THE FLOOR' : RG.rtype === 'shrine' ? ' · KNEEL FOR A BLESSING' : RG.rtype === 'merchant' ? ' · SPEND YOUR GOLD' : ''), color: boss ? '#ff4a5a' : RG.rtype === 'secret' ? '#c58aff' : '#ffe84a', t: 3 }
  sfx('rgDoor')
}
function agenda(id) {
  if (!RG.ag || RG.ag.done.includes(id)) return
  if (!markAgenda(id)) { RG.ag.done.push(id); return }
  RG.ag.done.push(id)
  const a = AGENDAS.find((x) => x.id === id), orb = ORBS.find((x) => x.id === a.orb), rel = RELICS.find((x) => x.id === a.relic)
  RG.msg = { text: 'HIDDEN AGENDA: ' + a.name, sub: 'YOU WON ' + orb.ico + ' ' + orb.name + ' AND THE ' + rel.ico + ' ' + rel.name + ' SKILL (KEY F)', color: '#c58aff', t: 6 }
  sfx('mission'); sfx('rgPerk'); shake(1); flash(0.3, [0.8, 0.5, 1]); const p = lp(); if (p) { ring(p.x, p.y, 60, 60, [col('#c58aff')]); for (let i = 0; i < 30; i++) part(p.x, p.y, R(-40, 40), R(5, 50), R(0.5, 1.2), col('#c58aff'), R(1.2, 2)) }
}

// ---------- the Abyss rooms: hazards, survival, pots, shrines and shops ----------
function stepHazards(dt) {
  for (const z of RG.hz) {
    const c = (RG.t + z.ph) % 3.2
    z.warn = c > 1.6 && c < 2.3; z.on = c >= 2.3
    if (z.on) for (const q of RG.players) if (q.alive && Math.abs(q.x - z.x) < z.w / 2 && Math.abs(q.y - z.y) < z.h / 2) hurtPlayer(q, 1)
  }
}
function stepSurvival(dt) {
  if (RG.rtype !== 'survival' || RG.surv <= 0) return
  RG.surv -= dt
  RG.survT = (RG.survT || 0) - dt
  if (RG.survT <= 0 && RG.surv > 0) { RG.survT = Math.max(2.2, 4.4 - RG.floor * 0.4); const ch = CHAPTERS[RG.chapter - 1], nn = 2 + RG.floor; for (let q = 0; q < nn; q++) { const a = Math.random() * 6.28; RG.spawnQ.push({ type: ch.pool[(Math.random() * ch.pool.length) | 0], x: clamp(Math.cos(a) * AX * 0.9, -AX + 4, AX - 4), y: clamp(Math.sin(a) * AY * 0.9, -AY + 4, AY - 4), t: 0.6 + q * 0.2, sc: (1 + RG.floor * 0.28) * (1 + RG.room * 0.035) }) } }
  if (RG.surv <= 0) { RG.surv = 0; RG.msg = { text: 'YOU SURVIVED', sub: 'FINISH OFF WHAT IS LEFT', color: '#6aff9a', t: 2 }; sfx('mission') }
}
function hitUrns(x, y, r) {
  for (const u of RG.urns) {
    if (u.hp <= 0 || Math.hypot(u.x - x, u.y - y) > r) continue
    u.hp--; sfx('rgSwing'); for (let i = 0; i < 6; i++) part(u.x, u.y, R(-16, 16), R(0, 24), 0.5, col('#b87a4a'), R(0.8, 1.5))
    if (u.hp <= 0) {
      sfx('rgKill'); RG.ag.urns++
      for (let i = 0; i < 4; i++) RG.loot.push({ k: 'gold', x: u.x + R(-1, 1), y: u.y + R(-1, 1), vx: R(-10, 10), vy: R(-10, 10), v: 1 })
      if (Math.random() < 0.25) RG.loot.push({ k: 'heart', x: u.x, y: u.y, vx: 0, vy: 0, v: 1 })
      RG.msg = { text: 'A CLAY POT SHATTERS', sub: 'POTS BROKEN THIS RUN: ' + RG.ag.urns + ' / 5', color: '#d8a070', t: 2 }
      if (RG.ag.urns >= 5) agenda('urns')
    }
  }
  RG.urns = RG.urns.filter((u) => u.hp > 0)
}
// orbs float beside you and do a small, constant job
function stepOrb(p, dt) {
  if (p.orb === 'none' || !p.alive) return
  p.orbA += dt * 2.6; p.orbT -= dt
  const ox = p.x + Math.cos(p.orbA) * 3.2, oy = p.y + Math.sin(p.orbA) * 3.2, lv = p.lv
  if (p.orb === 'ember') { if (p.orbT <= 0) { p.orbT = 0.5; for (const e of RG.en) if (!e.dead && e.spawnT <= 0 && Math.hypot(e.x - p.x, e.y - p.y) < 8 + e.def.r) { hitEnemy(e, 3 + lv * 0.6, false, 0, 0, 0, p); e.burn = e.burn || { t: 2, dps: 3, by: p } } part(ox, oy, R(-6, 6), R(2, 10), 0.4, col('#ff8a2a'), 1.3) } }
  else if (p.orb === 'frost') { for (const e of RG.en) if (!e.dead && e.spawnT <= 0 && Math.hypot(e.x - p.x, e.y - p.y) < 11 + e.def.r) e.frozen = Math.max(e.frozen || 0, 0.35); if (Math.random() < 0.2) part(ox, oy, R(-6, 6), R(2, 10), 0.4, col('#7ad8ff'), 1.2) }
  else if (p.orb === 'storm') { if (p.orbT <= 0) { const ne = nearestEnemy(p.x, p.y, 28); if (ne) { p.orbT = 2.2; RG.fx.push({ k: 'zap', l: 0.2, x0: ox, y0: oy, x1: ne.e.x, y1: ne.e.y }); hitEnemy(ne.e, 10 + lv * 2.2, false, 0, 0, 0, p); sfx('tdZap') } else p.orbT = 0.5 } }
  else if (p.orb === 'aegis') { if (p.orbT <= 0) { p.orbT = 7; if (p.shield < 1) { p.shield = 1; ring(p.x, p.y, 20, 30, [col('#6ac8ff')]); sfx('deflect') } } }
  else if (p.orb === 'gravity') {
    for (const l of RG.loot) { const d = Math.hypot(l.x - p.x, l.y - p.y); if (d < 30 && d > 1) { l.x += ((p.x - l.x) / d) * 40 * dt; l.y += ((p.y - l.y) / d) * 40 * dt } }
    for (const e of RG.en) if (!e.dead && e.spawnT <= 0 && !e.def.boss) { const d = Math.hypot(e.x - ox, e.y - oy); if (d < 13 && d > 1) { e.x += ((ox - e.x) / d) * 5 * dt; e.y += ((oy - e.y) / d) * 5 * dt; e.frozen = Math.max(e.frozen || 0, 0.25) } }
  }
}
// the relic skill (key F): the reward of a hidden agenda
function relicSkill(p) {
  if (RG.mode !== 'play' || !p.alive || p.relic === 'none' || p.rT > 0) return
  const def = RELICS.find((x) => x.id === p.relic); if (!def) return
  p.rT = def.cd; const lv = p.lv, d0 = 8 + lv * 2
  let aim = p.aimPt && G.time - p.aimT < 2.5 ? p.aimPt : null
  if (p.relic === 'flamedash') { const a = aim ? Math.atan2(aim.y - p.y, aim.x - p.x) : p.face; p.dx = Math.cos(a); p.dy = Math.sin(a); p.dash = 0.28; p.bash = 0.35; p.inv = Math.max(p.inv, 0.5); p.face = a; p.trail = true; p.flameT = 0.6; sfx('rgBoss'); RG.fx.push({ k: 'whirl', l: 0.3, p }) }
  else if (p.relic === 'spiritshield') { p.inv = Math.max(p.inv, 3.5); p.shield = Math.max(p.shield, 1); ring(p.x, p.y, 40, 40, [col('#c8d8ff')]); sfx('deflect') }
  else if (p.relic === 'chain') { const hit = []; let cur = { x: p.x, y: p.y }; for (let k = 0; k < 6; k++) { let best = null; for (const e of RG.en) { if (e.dead || e.spawnT > 0 || hit.includes(e)) continue; const dd = Math.hypot(e.x - cur.x, e.y - cur.y); if (dd < 26 && (!best || dd < best.d)) best = { e, d: dd } } if (!best) break; hit.push(best.e); RG.fx.push({ k: 'zap', l: 0.25, x0: cur.x, y0: cur.y, x1: best.e.x, y1: best.e.y }); hitEnemy(best.e, d0 * 1.6 + 6, false, 0, 0, 0, p); cur = best.e } if (hit.length) sfx('tdZap') }
  else if (p.relic === 'drain') { let n = 0; for (const e of RG.en) if (!e.dead && e.spawnT <= 0 && Math.hypot(e.x - p.x, e.y - p.y) < 13 + e.def.r) { hitEnemy(e, d0, false, 0, 0, 0, p); n++; for (let i = 0; i < 3; i++) part(e.x, e.y, (p.x - e.x) * 2, (p.y - e.y) * 2, 0.4, col('#c58aff'), 1.3) } p.hp = Math.min(p.max, p.hp + Math.min(3, Math.ceil(n / 3))); ring(p.x, p.y, 40, 40, [col('#c58aff')]); sfx('rgBoss') }
  else if (p.relic === 'timeslow') { RG.slowT = 5; ring(p.x, p.y, 50, 60, [col('#9ad8ff')]); sfx('tdIce'); flash(0.2, [0.6, 0.8, 1]) }
  else if (p.relic === 'frostwave') { for (const e of RG.en) if (!e.dead && e.spawnT <= 0 && Math.hypot(e.x - p.x, e.y - p.y) < 19 + e.def.r) { hitEnemy(e, d0 * 0.6, false, 0, 0, 0, p); e.frozen = Math.max(e.frozen || 0, 2.6) } RG.eb = RG.eb.filter((b) => Math.hypot(b.x - p.x, b.y - p.y) > 19); RG.fx.push({ k: 'nova', l: 0.6, p }); shake(0.6); sfx('tdIce') }
  ring(p.x, p.y, 30, 50, [col(RELIC_COL[p.relic] || '#ffffff')])
}
const RELIC_COL = { flamedash: '#ff8a2a', spiritshield: '#c8d8ff', chain: '#ffe84a', drain: '#c58aff', timeslow: '#9ad8ff', frostwave: '#7ad8ff' }

// ---------- rune trial ----------
function initPuzzle(ch) {
  const n = RG.chapter <= 1 ? 3 : RG.chapter <= 3 ? 4 : 5
  const runes = Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2 - Math.PI / 2; return { x: Math.cos(a) * 11 + 2, y: Math.sin(a) * 9, c: RUNE_COL[i % 5], lit: 0 } })
  const seq = []; let last = -1; for (let i = 0; i < n; i++) { let k; do { k = (Math.random() * n) | 0 } while (k === last); seq.push(k); last = k }
  RG.puz = { runes, seq, step: 0, show: 0, showing: true, wait: 2.2, solved: false, fails: 0, cd: 0, hint: ch.puzzle }
  RG.msg = { text: 'RUNE TRIAL', sub: ch.puzzle, color: '#c58aff', t: 4 }
}
function stepPuzzle(dt) {
  const z = RG.puz; if (!z) return
  for (const r of z.runes) r.lit = Math.max(0, r.lit - dt)
  z.cd = Math.max(0, z.cd - dt)
  if (z.solved) return
  if (z.showing) {
    z.wait -= dt
    if (z.wait <= 0) { if (z.show < z.seq.length) { const r = z.runes[z.seq[z.show]]; r.lit = 0.75; sfx('rtPerfect', z.seq[z.show] % 4); z.show++; z.wait = 0.95 } else { z.showing = false; z.step = 0; RG.msg = { text: 'YOUR TURN', sub: 'STEP ON THE RUNES IN THE SAME ORDER', color: '#6aff9a', t: 2.2 } } }
    return
  }
  // the pedestal in the middle replays the pattern
  for (const p of RG.players) {
    if (!p.alive) continue
    if (Math.hypot(p.x - 2, p.y) < 2.4 && z.cd <= 0) { z.showing = true; z.show = 0; z.wait = 0.6; z.cd = 4; return }
    z.runes.forEach((r, i) => {
      if (Math.hypot(p.x - r.x, p.y - r.y) < 2.5 && r.lit <= 0.05 && !r.hold) {
        r.hold = true
        if (i === z.seq[z.step]) { r.lit = 1.2; z.step++; sfx('rtPerfect', i % 4); ring(r.x, r.y, 16, 24, [col(r.c)]); if (z.step >= z.seq.length) solvePuzzle() }
        else { z.fails++; z.step = 0; for (const q of z.runes) q.lit = 0; sfx('rtMiss'); shake(0.6); RG.msg = { text: 'WRONG RUNE!', sub: 'THE RUNES REPLAY. WATCH CLOSELY.', color: '#ff5a6a', t: 2 }; if (z.fails % 2 === 0) for (let k = 0; k < 2; k++) RG.spawnQ.push({ type: CHAPTERS[RG.chapter - 1].pool[0], x: R(-10, 10), y: R(-8, 8), t: 0.5 + k * 0.3, sc: 1 + RG.floor * 0.28 }); z.showing = true; z.show = 0; z.wait = 1.8 }
      } else if (Math.hypot(p.x - r.x, p.y - r.y) > 3.4) r.hold = false
    })
  }
}
function solvePuzzle() {
  const z = RG.puz; z.solved = true; RG.open = true
  RG.chests.push({ x: 2, y: 0, open: false, kind: 'puzzle' })
  RG.msg = { text: 'THE RUNES ARE AWAKE', sub: 'A CHEST RISES FROM THE FLOOR', color: '#6aff9a', t: 2.6 }; sfx('mission'); shake(0.8)
  for (const r of z.runes) { r.lit = 3; ring(r.x, r.y, 24, 30, [col(r.c)]) }
}
function buyItem(c, who) {
  c.open = true; sfx('rgPerk'); ring(c.x, c.y, 24, 40, [col('#ffd23a')])
  if (c.item === 'heart') for (const q of RG.players) { q.max += 1; q.hp = q.max } else if (c.item === 'perk') offerPerks()
  else if (c.item === 'refresh') for (const q of RG.players) { q.spT = q.sT2 = q.sT3 = q.rT = q.dashT = 0 } else if (c.item === 'tome') gainXp(who, xpNeed(who.lv) - who.xp + 1)
  RG.msg = { text: 'BOUGHT: ' + c.label, sub: c.sub, color: '#ffd23a', t: 2.6 }
}
function openChest(c, by) {
  if (c.kind === 'shrine') { c.open = true; sfx('rgPerk'); shake(0.5); ring(c.x, c.y, 40, 50, [col('#9ae8ff')]); for (const q of RG.players) { q.hp = q.max; q.shield = Math.max(q.shield, 1) } RG.ag.shrines++; RG.msg = { text: 'THE SHRINE BLESSES YOU', sub: 'FULL HEALTH · SHIELD · A FREE PERK · SHRINES KNELT AT: ' + RG.ag.shrines, color: '#9ae8ff', t: 3.5 }; offerPerks(); if (RG.ag.shrines >= 3) agenda('shrine'); return }
  c.open = true; sfx('rgPerk'); shake(0.5); ring(c.x, c.y, 30, 40, [col('#ffd23a')])
  for (let i = 0; i < 18; i++) part(c.x, c.y, R(-26, 26), R(8, 40), R(0.5, 1.1), col('#ffd23a'), R(1, 1.8))
  const ch = CHAPTERS[RG.chapter - 1]
  let text = '', sub = ''
  if (c.kind === 'puzzle' || c.kind === 'vault') {
    const id = 'L' + RG.chapter + (c.kind === 'puzzle' ? 'a' : 'b'), tab = LORE.find((x) => x.id === id)
    if (c.kind === 'puzzle') RG.ag.puzzle = true; else RG.ag.vault = true
    if (RG.ag.puzzle && RG.ag.vault) agenda('collector')
    if (c.kind === 'vault') { const fresh = markSecret(RG.chapter); RG.found.secret = true; if (fresh) sub = 'THE SECRET OF ' + ch.name + ' IS YOURS. ' }
    if (tab && markLore(id)) { RG.found.lore.push(id); text = 'LORE TABLET: ' + tab.title; sub += tab.text.slice(0, 80) + '…' } else { text = c.kind === 'vault' ? 'VAULT TREASURE' : 'RUNE TREASURE'; sub += 'GOLD AND HEARTS' }
    RG.gold += 30 + RG.chapter * 12
    for (const q of RG.players) q.hp = Math.min(q.max, q.hp + 2)
    for (let i = 0; i < 12; i++) RG.loot.push({ k: 'gold', x: c.x + R(-3, 3), y: c.y + R(-3, 3), vx: R(-14, 14), vy: R(-14, 14), v: 1 })
    offerPerks()
  } else {
    text = 'TREASURE!'; sub = 'GOLD, HEARTS AND A FREE PERK'
    RG.gold += 25 + RG.chapter * 10
    for (const q of RG.players) q.hp = Math.min(q.max, q.hp + 2)
    for (let i = 0; i < 10; i++) RG.loot.push({ k: 'gold', x: c.x + R(-3, 3), y: c.y + R(-3, 3), vx: R(-14, 14), vy: R(-14, 14), v: 1 })
    offerPerks()
  }
  RG.msg = { text, sub, color: '#ffd23a', t: 4 }
  void by
}
function walkable(x, y, r) {
  if (Math.abs(x) > AX - r || Math.abs(y) > AY - r) return false
  for (const o of RG.obst) if (Math.abs(x - o.x) < o.w / 2 + r && Math.abs(y - o.y) < o.h / 2 + r) return false
  return true
}
function move(o, dx, dy, r) {
  if (walkable(o.x + dx, o.y, r)) o.x += dx
  if (walkable(o.x, o.y + dy, r)) o.y += dy
}
function nearestEnemy(x, y, maxd = 999) {
  let best = null
  for (const e of RG.en) { if (e.dead || e.spawnT > 0) continue; const d = Math.hypot(e.x - x, e.y - y); if (d < maxd && (!best || d < best.d)) best = { e, d } }
  return best
}
function nearestPlayer(x, y) {
  let best = null
  for (const p of RG.players) { if (!p.alive) continue; const d = Math.hypot(p.x - x, p.y - y); if (!best || d < best.d) best = { p, d } }
  return best
}

// ---------- levelling ----------
function gainXp(p, base) {
  if (!p.alive) return
  p.xp += base * p.xpMul
  while (p.lv < MAXLV && p.xp >= xpNeed(p.lv)) {
    p.xp -= xpNeed(p.lv); p.lv++
    p.dmg *= 1.06; if (p.lv % 2 === 0) { p.max += 1 } p.hp = Math.min(p.max, p.hp + 2); p.lvT = 1.6
    const sk = SKILLS[CLASSES[p.cls].id].find((k) => k.lv === p.lv)
    ring(p.x, p.y, 36, 46, [col('#ffe84a')]); for (let i = 0; i < 24; i++) part(p.x, p.y, R(-26, 26), R(10, 50), R(0.5, 1.1), col('#ffe84a'), R(0.9, 1.6))
    syncTier(p, false)
    if (p === lp()) { sfx('rgPerk'); sfx('mission'); RG.msg = { text: 'LEVEL UP!  LV ' + p.lv, sub: sk ? 'NEW SKILL: ' + sk.name + ' (' + ['Q', 'E', 'R'][SKILLS[CLASSES[p.cls].id].indexOf(sk)] + ')' : (p.lv % 2 === 0 ? '+1 HEART · STRONGER' : 'STRONGER'), color: '#ffe84a', t: 3 } }
  }
}
const xpFor = (e) => Math.round(e.def.hp * 0.22) + 3 + (e.def.boss ? 40 : 0)
function mkPet(p) {
  const def = PETS[p.pet]; if (!def || def.id === 'none') return null
  const info = petInfo(def.id)
  return { type: def.id, owner: p, x: p.x - 3, y: p.y, face: 0, atkT: 1, act: 0, hv: 0, t: Math.random() * 6, heal: 8, lv: info.lv, st: info.stage, cd2: 6, used: false, p2: 0 }
}
const mkPets = (ps) => ps.map(mkPet).filter(Boolean)
function petGrow(o, xp) {
  const pt = RG.pets.find((x) => x.owner === o); if (!pt) return
  const up = petGain(pt.type, xp)
  if (up) {
    const was = pt.st; pt.lv = up; pt.st = petStageOf(up)
    ring(pt.x, pt.y, 24, 40, [col(PETS[o.pet].color)]); sfx('rgPerk')
    if (o === lp()) { const nm = petInfo(pt.type).name; RG.msg = pt.st > was ? { text: 'YOUR COMPANION EVOLVED!', sub: nm + ' · LEVEL ' + up, color: '#ffe84a', t: 4 } : { text: PETS[o.pet].name + ' LEVEL ' + up, sub: 'IT GROWS STRONGER', color: '#9ae8ff', t: 2.4 } }
  }
}
const PET_AIR = new Set(['eagle', 'owl', 'sprite', 'dragon', 'phoenix'])
function stepPets(dt) {
  for (const pt of RG.pets) {
    const o = pt.owner
    if (!o || !o.alive) continue
    pt.t += dt; pt.atkT -= dt; pt.act = Math.max(0, pt.act - dt); pt.cd2 -= dt
    const lv = pt.lv, st = pt.st, base = 4 + lv * 1.8
    const ne = nearestEnemy(o.x, o.y, 26)
    const ground = !PET_AIR.has(pt.type)
    let tx = o.x - Math.cos(o.face) * 3.4 + Math.sin(pt.t * 1.5) * 1.4, ty = o.y - Math.sin(o.face) * 3.4 + Math.cos(pt.t * 1.3) * 1.4
    if (ground && (pt.type === 'wolf' || pt.type === 'lion' || pt.type === 'tiger') && ne && ne.d < 22) { tx = ne.e.x; ty = ne.e.y }
    if (!ground) { tx = o.x + Math.cos(pt.t * (pt.type === 'eagle' ? 1.4 : 0.9)) * (4.5 + st); ty = o.y + Math.sin(pt.t * (pt.type === 'eagle' ? 1.4 : 0.9)) * (3.5 + st) + 1.5 }
    const dx = tx - pt.x, dy = ty - pt.y, d = Math.hypot(dx, dy) || 1, sp = (pt.type === 'wolf' || pt.type === 'tiger' ? 38 : 28) * (1 + st * 0.1)
    if (d > 0.6) { pt.x += (dx / d) * Math.min(d, sp * dt * (d > 10 ? 2 : 1)); pt.y += (dy / d) * Math.min(d, sp * dt * (d > 10 ? 2 : 1)); pt.face = Math.atan2(dy, dx) }
    if (ne) pt.face = Math.atan2(ne.e.y - pt.y, ne.e.x - pt.x)
    const nearE = (r) => RG.en.filter((e) => !e.dead && e.spawnT <= 0 && Math.hypot(e.x - pt.x, e.y - pt.y) < r + e.def.r)
    const bite = (e, mul, kb = 25) => hitEnemy(e, base * mul, false, kb, Math.cos(pt.face), Math.sin(pt.face), o)
    if (pt.type === 'wolf') {
      if (ne && pt.atkT <= 0) { const t = nearE(2.8)[0]; if (t) { pt.atkT = 0.7; pt.act = 0.25; bite(t, 1.2); if (st >= 1) t.burn = { t: 3, dps: 2 + lv * 0.3, by: o }; sfx('rgSwing') } }
      if (st >= 2 && pt.cd2 <= 0 && RG.en.length) { pt.cd2 = 12; pt.act = 0.8; for (const q of RG.players) if (q.alive) q.buff = Math.max(q.buff, 4); ring(pt.x, pt.y, 40, 50, [col('#9aa4b8')]); sfx('rgBoss') }
    } else if (pt.type === 'lion') {
      if (ne && pt.atkT <= 0) { const t = nearE(5); if (t.length) { pt.atkT = 1.0; pt.act = 0.3; for (const e of t) { bite(e, 1.1, 40); e.frozen = Math.max(e.frozen || 0, 0.6) } sfx('rgSwing') } }
      if (st >= 1 && pt.cd2 <= 0 && RG.en.length) { pt.cd2 = 10; pt.act = 0.9; ring(pt.x, pt.y, 40, 60, [col('#e0a040')]); shake(0.5); sfx('rgBoss'); for (const e of nearE(14)) { e.frozen = Math.max(e.frozen || 0, 1.0); hitEnemy(e, base * 0.8, false, 80, (e.x - pt.x) / 6, (e.y - pt.y) / 6, o) } }
      if (st >= 2) { pt.p2 -= dt; if (pt.p2 <= 0) { pt.p2 = 0.5; for (const e of nearE(7)) hitEnemy(e, 2 + lv * 0.5, false, 0, 0, 0, o); part(pt.x, pt.y, R(-8, 8), R(4, 14), 0.4, col('#ffb02e'), 1.4) } }
    } else if (pt.type === 'tiger') {
      if (pt.atkT <= 0 && RG.en.length) {
        let far = null; for (const e of RG.en) { if (e.dead || e.spawnT > 0) continue; const dd = Math.hypot(e.x - pt.x, e.y - pt.y); if (dd < 30 && (!far || dd > far.d)) far = { e, d: dd } }
        if (far) { pt.atkT = 2.6 - st * 0.4; pt.act = 0.35; pt.x = far.e.x - Math.cos(pt.face) * 2; pt.y = far.e.y - Math.sin(pt.face) * 2; hitEnemy(far.e, base * 2.2, true, 60, Math.cos(pt.face), Math.sin(pt.face), o); if (st >= 2) far.e.burn = { t: 3, dps: 3 + lv * 0.4, by: o }; if (st >= 1) { const o2 = nearE(10).find((e) => e !== far.e); if (o2) { hitEnemy(o2, base * 1.6, true, 40, 0, 0, o) } } sfx('rgSwing'); ring(pt.x, pt.y, 14, 30, [col('#ff8a2a')]) }
      }
    } else if (pt.type === 'bear') {
      if (!pt.armored) { pt.armored = true; o.armor = Math.min(0.5, o.armor + 0.05 * (st + 1)) }
      if (pt.atkT <= 0) { const t = nearE(6).filter((e) => Math.hypot(e.x - o.x, e.y - o.y) < 9); if (t.length) { pt.atkT = 3.2 - st * 0.5; pt.act = 0.5; shake(0.4); ring(pt.x, pt.y, 24, 40, [col('#8a6a4a')]); sfx('rgBoss'); for (const e of t) hitEnemy(e, base * 1.5, false, 70, (e.x - pt.x) / 5, (e.y - pt.y) / 5, o) } }
    } else if (pt.type === 'eagle') {
      if (ne && pt.atkT <= 0) { pt.atkT = 1.3 - st * 0.2; pt.act = 0.25; const n = 1 + st; for (let i = 0; i < n; i++) { const a = Math.atan2(ne.e.y - pt.y, ne.e.x - pt.x) + (i - (n - 1) / 2) * 0.22; RG.pb.push({ x: pt.x, y: pt.y, vx: Math.cos(a) * 80, vy: Math.sin(a) * 80, dmg: base * (st >= 1 && Math.random() < 0.25 ? 2 : 1), crit: false, pierce: st, homing: true, life: 1.2, c: '#e8d29a', hit: new Set(), by: o }) } sfx('rgShot') }
    } else if (pt.type === 'owl') {
      if (ne && pt.atkT <= 0) { pt.atkT = 1.1; pt.act = 0.2; const a = Math.atan2(ne.e.y - pt.y, ne.e.x - pt.x); RG.pb.push({ x: pt.x, y: pt.y, vx: Math.cos(a) * 70, vy: Math.sin(a) * 70, dmg: base, crit: false, pierce: st, homing: true, life: 1.2, c: '#e8d29a', hit: new Set(), by: o }); sfx('rgShot') }
    } else if (pt.type === 'dragon') {
      if (ne && pt.atkT <= 0 && ne.d < 20) {
        pt.atkT = 2.5 - st * 0.35; pt.act = 0.6
        const a = Math.atan2(ne.e.y - pt.y, ne.e.x - pt.x), len = 15 + st * 3, wid = 0.55 + st * 0.18
        for (const e of nearE(len)) { const ex = e.x - pt.x, ey = e.y - pt.y; let da = Math.atan2(ey, ex) - a; da = Math.atan2(Math.sin(da), Math.cos(da)); if (Math.abs(da) < wid) { hitEnemy(e, base * 1.7, false, 0, 0, 0, o); e.burn = { t: 3, dps: 2 + lv * 0.4, by: o } } }
        for (let i = 0; i < 26 + st * 10; i++) { const aa = a + R(-wid, wid), sp2 = R(20, 46); part(pt.x, pt.y, Math.cos(aa) * sp2, Math.sin(aa) * sp2, R(0.25, 0.6), col(['#ff6a3a', '#ffb04a', '#ffe84a'][(Math.random() * 3) | 0]), R(1.1, 2)) }
        sfx('rgBoss')
      }
    } else if (pt.type === 'sprite') {
      pt.heal -= dt
      if (pt.heal <= 0) {
        pt.heal = 9 - st
        const tg = st >= 1 ? RG.players.filter((q) => q.alive && q.hp < q.max) : (o.hp < o.max ? [o] : [])
        if (tg.length) { for (const q of tg) q.hp = Math.min(q.max, q.hp + 1); pt.act = 0.5; ring(o.x, o.y, 14, 24, [col('#ff9ae8')]); sfx('rgPerk') }
        else if (st >= 0 && o.shield < 1) { o.shield = 1; pt.act = 0.5; ring(o.x, o.y, 14, 24, [col('#6ac8ff')]) }
      }
    } else if (pt.type === 'phoenix') {
      if (st >= 2) { pt.p2 -= dt; if (pt.p2 <= 0) { pt.p2 = 0.5; for (const e of nearE(8)) { hitEnemy(e, 3 + lv * 0.6, false, 0, 0, 0, o); e.burn = e.burn || { t: 2, dps: 3, by: o } } part(pt.x, pt.y, R(-8, 8), R(4, 14), 0.4, col('#ffb02e'), 1.5) } }
    }
  }
}
// ---------- skills 2 and 3 (traps, rain, blink, meteor, war cry, shield bash) ----------
function tickWorld(dt) {
  for (const t of RG.traps) {
    t.l -= dt; t.tick -= dt
    for (const e of RG.en) { if (e.dead || e.spawnT > 0) continue; if (Math.hypot(e.x - t.x, e.y - t.y) < t.r + e.def.r) { e.frozen = Math.max(e.frozen || 0, 0.5); if (t.tick <= 0) hitEnemy(e, t.dmg, false, 0, 0, 0, t.by) } }
    if (t.tick <= 0) t.tick = 0.35
  }
  RG.traps = RG.traps.filter((t) => t.l > 0)
  for (const r of RG.rains) {
    r.l -= dt; r.tick -= dt
    if (r.tick <= 0) { r.tick = 0.35; sfx('rgShot'); for (const e of RG.en) if (!e.dead && e.spawnT <= 0 && Math.hypot(e.x - r.x, e.y - r.y) < r.r + e.def.r) hitEnemy(e, r.dmg, false, 0, 0, 0, r.by); for (let i = 0; i < 6; i++) part(r.x + R(-r.r, r.r), r.y + R(-r.r, r.r), 0, R(-10, 10), 0.3, col('#6aff9a'), 1.2) }
  }
  RG.rains = RG.rains.filter((r) => r.l > 0)
  for (const m of RG.meteors) {
    m.l -= dt
    if (m.l <= 0 && !m.done) { m.done = true; shake(1.6); flash(0.3, [1, 0.6, 0.3]); sfx('tdBoom'); ring(m.x, m.y, 40, 60, [col('#ff9a3a')]); for (let i = 0; i < 40; i++) part(m.x, m.y, R(-50, 50), R(-50, 50), R(0.3, 0.9), col(['#ff6a3a', '#ffb04a', '#ffe84a'][(Math.random() * 3) | 0]), R(1.2, 2.4)); for (const e of RG.en) if (!e.dead && e.spawnT <= 0 && Math.hypot(e.x - m.x, e.y - m.y) < m.r + e.def.r) hitEnemy(e, m.dmg, false, 60, (e.x - m.x) / 8, (e.y - m.y) / 8, m.by) }
  }
  RG.meteors = RG.meteors.filter((m) => !m.done)
}
function weaponHit(p, e, d) {
  const m = p.wmod || {}
  if (m.burn) e.burn = { t: 3, dps: m.burn, by: p }
  if (m.slow) e.frozen = Math.max(e.frozen || 0, 1.0)
  if (m.chain) { let n = 0; for (const o of RG.en) { if (n >= m.chain) break; if (o === e || o.dead || o.spawnT > 0 || Math.hypot(o.x - e.x, o.y - e.y) > 13) continue; n++; RG.fx.push({ k: 'zap', l: 0.15, x0: e.x, y0: e.y, x1: o.x, y1: o.y }); hitEnemy(o, d * 0.5, false, 0, 0, 0, p, false) } if (n) sfx('tdZap') }
  if (m.splash) { for (const o of RG.en) { if (o === e || o.dead || o.spawnT > 0 || Math.hypot(o.x - e.x, o.y - e.y) > m.splash) continue; hitEnemy(o, d * 0.6, false, 0, 0, 0, p, false) } ring(e.x, e.y, 14, 24, [col('#c58aff')]) }
  if (m.heal) { p.hitN = (p.hitN || 0) + 1; if (p.hitN >= m.heal) { p.hitN = 0; p.hp = Math.min(p.max, p.hp + 1); part(p.x, p.y, 0, 14, 0.6, col('#6aff9a'), 1.6) } }
}
function hitEnemy(e, d, crit, kb = 0, ax = 0, ay = 0, by = null, wpn = false) {
  if (e.dead || e.spawnT > 0) return
  e.hp -= d; e.flash = 0.1; e.by = by || e.by
  if (wpn && by && by.wmod) weaponHit(by, e, d)
  if (kb && !e.def.boss) { e.kx = ax * kb; e.ky = ay * kb }
  if (crit) for (let i = 0; i < 4; i++) part(e.x, e.y, R(-20, 20), R(-20, 20), 0.3, col('#ffe84a'), 1)
  if (e.hp <= 0) killEnemy(e)
}
function killEnemy(e) {
  e.dead = true; RG.kills++
  const c = col(e.def.c); for (let i = 0; i < (e.def.boss ? 40 : 10); i++) part(e.x, e.y, R(-34, 34), R(-34, 34), R(0.25, 0.7), c, R(0.8, 1.7))
  sfx('rgKill'); if (e.def.boss) { shake(2); flash(0.5, [1, 1, 1]) }
  const g = e.def.gold; for (let i = 0; i < g; i++) RG.loot.push({ k: 'gold', x: e.x + R(-2, 2), y: e.y + R(-2, 2), vx: R(-12, 12), vy: R(-12, 12), v: 1 })
  if (Math.random() < (RG.diff === 'story' ? 0.2 : 0.07) || e.def.boss) RG.loot.push({ k: 'heart', x: e.x, y: e.y, vx: 0, vy: 0, v: 1 })
  const by = e.by
  if (by && by.alive && by.vamp && Math.random() < by.vamp) { by.hp = Math.min(by.max, by.hp + 1) }
  if (by && by.alive && by.orb === 'vampire') { by.vk++; if (by.vk >= 8) { by.vk = 0; by.hp = Math.min(by.max, by.hp + 1); part(by.x, by.y, 0, 14, 0.6, col('#ff4a6a'), 1.6) } }
  const xp = xpFor(e)
  for (const q of RG.players) if (q.alive && q.pet) petGrow(q, Math.max(1, Math.round(xp * 0.5)))
  for (const q of RG.players) { gainXp(q, q === by ? xp : Math.round(xp * 0.6)); if (q.alive && q.race === 3 && q === by) { q.killHeal++; if (q.killHeal >= 6) { q.killHeal = 0; q.hp = Math.min(q.max, q.hp + 1); part(q.x, q.y, 0, 14, 0.6, col('#6aff9a'), 1.6) } } }
}
function hurtPlayer(p, d) {
  if (!p.alive || p.inv > 0 || p.dash > 0 || RG.mode !== 'play') return
  if (p.shield > 0) { p.shield--; p.inv = 0.6; sfx('deflect'); ring(p.x, p.y, 16, 30, [col('#6ac8ff')]); return }
  if (p.armor && Math.random() < p.armor) { p.inv = 0.5; sfx('deflect'); for (let i = 0; i < 6; i++) part(p.x, p.y, R(-20, 20), R(-20, 20), 0.3, col('#cfd6e8'), 1.1); return }
  p.hp -= d; p.inv = 1.0; p.hurtT = 0.3; RG.hurtRoom = true
  if (p === lp()) { sfx('rgHurt'); shake(1); flash(0.2, [1, 0.2, 0.2]) }
  for (let i = 0; i < 10; i++) part(p.x, p.y, R(-30, 30), R(-30, 30), 0.4, col('#ff4a5a'), R(0.8, 1.4))
  if (p.hp <= 0) { const ph = RG.pets.find((x) => x.owner === p && x.type === 'phoenix' && !x.used); if (ph) { ph.used = true; ph.act = 1; p.hp = Math.max(1, Math.ceil(p.max / 2)); p.inv = 2.5; ring(p.x, p.y, 50, 60, [col('#ffb02e')]); shake(1); sfx('rgBoss'); for (let i = 0; i < 30; i++) part(p.x, p.y, R(-40, 40), R(5, 50), R(0.5, 1.2), col(['#ff6a3a', '#ffb04a', '#ffe84a'][(Math.random() * 3) | 0]), R(1.2, 2.2)); if (ph.st >= 1) for (const q of RG.players) if (q.alive) q.hp = Math.min(q.max, q.hp + 2); RG.msg = { text: 'THE PHOENIX RISES!', sub: 'YOU ARE BACK ON YOUR FEET', color: '#ffb02e', t: 2.6 }; return } }
  if (p.hp <= 0 && p.rise > 0) { p.rise--; p.hp = Math.max(1, Math.ceil(p.max / 2)); p.inv = 2; RG.msg = { text: 'THE UNDEAD RISE AGAIN', sub: '', color: '#6aff9a', t: 2 }; ring(p.x, p.y, 40, 50, [col('#6aff9a')]); sfx('rgBoss'); return }
  if (p.hp <= 0) {
    p.hp = 0; p.alive = false; sfx('rgBoss')
    ring(p.x, p.y, 30, 40, [col('#ff4a5a')])
    RG.msg = { text: RG.players.length > 1 ? p.name + ' HAS FALLEN' : 'YOU FELL', sub: alive().length ? 'FINISH THE ROOM TO REVIVE THEM' : '', color: '#ff4a5a', t: 2 }
    if (!alive().length) finish(false)
  }
}
function finish(win) {
  RG.mode = 'over'; music.stop()
  const ch = CHAPTERS[RG.chapter - 1]
  const roomsDone = RG.room + (win ? 1 : 0)
  const lore = (RG.found ? RG.found.lore.length : 0), sec = RG.found && RG.found.secret ? 1 : 0
  const abyss = RG.abyss
  const score = abyss ? Math.round(roomsDone * 230 + RG.kills * 10 + RG.gold * 2 + lore * 250 + (win ? 12000 : 0)) : Math.round(RG.chapter * 1800 + roomsDone * 160 + RG.kills * 10 + RG.gold * 2 + lore * 250 + sec * 600 + (win ? 3500 + RG.chapter * 500 : 0))
  const me = lp()
  if (win && !abyss) markCleared(RG.chapter)
  if (abyss) markAbyss(roomsDone)
  RG.over = { win, diff: RG.diff, abyss, rooms: roomsDone, chapter: RG.chapter, chName: abyss ? 'THE ABYSS' : ch.name, room: RG.room + 1, floor: RG.chapter, kills: RG.kills, gold: RG.gold, score, perks: me ? me.perks.length : 0, cls: CLASSES[me ? me.cls : 0].name, coop: RG.players.length > 1, epilogue: win ? (abyss ? 'The fiftieth door opens onto a plain white room. A single save point glows in the middle of it. You press START. Somewhere above, five forests breathe out, and every deleted game remembers its name.' : ch.outro) : '', lv: me ? me.lv : 1, race: me ? RACES[me.race].name : '', pet: me ? PETS[me.pet].name : '', lore, secret: !!sec, next: win && !abyss && RG.chapter < CHAPTERS.length ? CHAPTERS[RG.chapter].name : '', complete: win && (abyss || RG.chapter === CHAPTERS.length), agendas: agendasDone().length, weapon: me ? me.wid : '', power: me ? me.pw : '' }
  profile.rogueRuns = (profile.rogueRuns || 0) + 1
  if (win) { profile.rogueWins = (profile.rogueWins || 0) + 1; profile.chips = (profile.chips || 0) + (abyss ? 800 : 100 * RG.chapter) }
  profile.rogueKills = (profile.rogueKills || 0) + RG.kills
  if (!abyss) profile.rogueDeep = Math.max(profile.rogueDeep || 0, (RG.chapter - 1) * 5 + roomsDone)
  recordScore('rogue', score); saveProfile()
  { const now = unlockSnapshot(), old = RG.unlocked || now; RG.over.unlocks = [...RACES.filter((r) => now.races.includes(r.id) && !old.races.includes(r.id)).map((r) => r.ico + ' ' + r.name + ' (race)'), ...(RG.unlockBefore ? diffUnlocks(RG.unlockBefore) : [])] }
  sfx(win ? 'win' : 'over'); speak(win ? (RG.over.complete ? 'The Last Lantern burns' : 'Guardian defeated') : 'You died', 0.5, 1)
  emitR()
}
function ebullet(x, y, a, spd, dmg = 1, r = 0.9, c = '#ff8a5a') { RG.eb.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, dmg, r, c, life: 6 }) }
function playerAttack(p, dt) {
  const cl = CLASSES[p.cls]
  p.atkT -= dt * (p.buff > 0 ? 1.35 : 1)
  if (p.atkT > 0) return
  if (!p.hold) return // you attack only when you click / press the attack button / hold J
  const ne = nearestEnemy(p.x, p.y, 70)
  let a = ne ? Math.atan2(ne.e.y - p.y, ne.e.x - p.x) : p.face
  if (p.aimPt && G.time - p.aimT < 2.5) a = Math.atan2(p.aimPt.y - p.y, p.aimPt.x - p.x)
  { // aim assist: a click that lands close to an enemy snaps onto it
    let best = null
    for (const e of RG.en) { if (e.dead || e.spawnT > 0) continue; const ea = Math.atan2(e.y - p.y, e.x - p.x), dd = Math.hypot(e.x - p.x, e.y - p.y); let da = ea - a; da = Math.abs(Math.atan2(Math.sin(da), Math.cos(da))); const lim = RG.diff === 'story' ? 0.55 : 0.35; if (da < lim && dd < 70 && (!best || da < best.da)) best = { ea, da } }
    if (best) a = best.ea
  }
  const wm = p.wmod || {}
  p.face = a; p.atkT = p.rate * (wm.rate || 1)
  const crit = Math.random() < p.crit, d = p.dmg * (wm.dmg || 1) * (crit ? 2.2 : 1) * (p.buff > 0 ? 1.5 : 1)
  if (cl.id === 'knight') {
    const arc = (1.3 + (p.multi - 1) * 0.45) * (wm.arc || 1), reach = 8 + (p.multi - 1) * 0.8 + (wm.reach || 0)
    p.swing = { a, arc, reach, t: 0.2, max: 0.2 }
    if (RG.secret && !RG.secret.found && RG.open) { const sx = RG.secret.x - p.x, sy = RG.secret.y - p.y; if (Math.hypot(sx, sy) < reach + 2) hitSecret() }
    hitUrns(p.x + Math.cos(a) * reach * 0.6, p.y + Math.sin(a) * reach * 0.6, reach * 0.7)
    for (const e of RG.en) {
      if (e.dead) continue
      const dx = e.x - p.x, dy = e.y - p.y, dist = Math.hypot(dx, dy)
      if (dist > reach + e.def.r) continue
      let da = Math.atan2(dy, dx) - a; da = Math.atan2(Math.sin(da), Math.cos(da))
      if (Math.abs(da) <= arc / 2) hitEnemy(e, d, crit, (40 + p.pierce * 25) * (wm.kb || 1), dx / (dist || 1), dy / (dist || 1), p, true)
    }
    for (const b of RG.eb) { if (Math.hypot(b.x - p.x, b.y - p.y) < reach) b.life = 0 }
    sfx('rgSwing')
  } else {
    const n = p.multi, spread = 0.2
    for (let i = 0; i < n; i++) {
      const aa = a + (i - (n - 1) / 2) * spread
      RG.pb.push({ x: p.x + Math.cos(aa) * 2, y: p.y + Math.sin(aa) * 2, vx: Math.cos(aa) * (cl.id === 'ranger' ? 95 : 55), vy: Math.sin(aa) * (cl.id === 'ranger' ? 95 : 55), dmg: d, crit, pierce: cl.id === 'ranger' ? 1 + p.pierce : p.pierce, homing: cl.id === 'mage', life: 1.4, c: cl.color, hit: new Set(), big: cl.id === 'mage', by: p, wp: true })
    }
    sfx(cl.id === 'ranger' ? 'rgShot' : 'rgMagic')
  }
}
function hitSecret() {
  const sc = RG.secret; if (!sc || sc.found) return
  sc.hp--; sfx('rgSwing'); shake(0.3); for (let i = 0; i < 6; i++) part(sc.x, sc.y, R(-16, 16), R(-16, 0), 0.4, col('#c8b8a0'), 1.2)
  if (sc.hp <= 0) { sc.found = true; RG.msg = { text: 'A HIDDEN PASSAGE OPENS!', sub: 'WALK INTO THE LIGHT TO ENTER THE HIDDEN VAULT', color: '#c58aff', t: 3.6 }; sfx('mission'); shake(1); ring(sc.x, sc.y, 40, 40, [col('#c58aff')]) }
}
function skill(p, slot = 0) {
  const cl = CLASSES[p.cls], sk = SKILLS[cl.id][slot]
  if (RG.mode !== 'play' || !p.alive || !sk || p.lv < sk.lv) return
  const key = slot === 0 ? 'spT' : slot === 1 ? 'sT2' : 'sT3'
  if (p[key] > 0) return
  const cdm = p.spCd / 9
  const aimAt = () => { if (p.aimPt && G.time - p.aimT < 2.5) return p.aimPt; const ne = nearestEnemy(p.x, p.y, 40); return ne ? { x: ne.e.x, y: ne.e.y } : { x: p.x + Math.cos(p.face) * 14, y: p.y + Math.sin(p.face) * 14 } }
  if (slot === 0) {
    p.spT = sk.cd * cdm
    if (cl.id === 'knight') { RG.fx.push({ k: 'whirl', l: 0.5, p }); for (const e of RG.en) if (!e.dead && Math.hypot(e.x - p.x, e.y - p.y) < 13) hitEnemy(e, p.dmg * 3, false, 90, (e.x - p.x) / 5, (e.y - p.y) / 5, p); p.inv = Math.max(p.inv, 0.5); shake(0.8); sfx('rgBoss') }
    else if (cl.id === 'ranger') { for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; RG.pb.push({ x: p.x, y: p.y, vx: Math.cos(a) * 85, vy: Math.sin(a) * 85, dmg: p.dmg * 1.6, pierce: 3, life: 1.2, c: cl.color, hit: new Set(), by: p }) } sfx('rgShot') }
    else { RG.fx.push({ k: 'nova', l: 0.6, p }); for (const e of RG.en) if (!e.dead && Math.hypot(e.x - p.x, e.y - p.y) < 20) { hitEnemy(e, p.dmg * 2, false, 0, 0, 0, p); e.frozen = 2.5 } RG.eb = RG.eb.filter((b) => Math.hypot(b.x - p.x, b.y - p.y) > 20); shake(0.6); sfx('tdIce') }
  } else if (slot === 1) {
    p[key] = sk.cd * cdm
    if (cl.id === 'knight') { const t = aimAt(); const a = Math.atan2(t.y - p.y, t.x - p.x); p.dx = Math.cos(a); p.dy = Math.sin(a); p.dash = 0.22; p.bash = 0.3; p.inv = Math.max(p.inv, 0.4); p.face = a; sfx('rgBoss'); RG.fx.push({ k: 'whirl', l: 0.3, p }) }
    else if (cl.id === 'ranger') { RG.traps.push({ x: p.x, y: p.y, r: 5, l: 12, tick: 0.2, dmg: p.dmg * 1.4, by: p }); sfx('tdBuild') }
    else { const t = aimAt(), d = Math.hypot(t.x - p.x, t.y - p.y), k = Math.min(1, 24 / (d || 1)); let nx = p.x + (t.x - p.x) * k, ny = p.y + (t.y - p.y) * k; if (!walkable(nx, ny, 1.4)) { nx = p.x; ny = p.y }
      for (const q of [[p.x, p.y], [nx, ny]]) { ring(q[0], q[1], 24, 40, [col('#c58aff')]); for (const e of RG.en) if (!e.dead && e.spawnT <= 0 && Math.hypot(e.x - q[0], e.y - q[1]) < 8 + e.def.r) hitEnemy(e, p.dmg * 1.8, false, 40, (e.x - q[0]) / 6, (e.y - q[1]) / 6, p) }
      p.x = nx; p.y = ny; p.inv = Math.max(p.inv, 0.5); sfx('tdZap') }
  } else {
    p[key] = sk.cd * cdm
    if (cl.id === 'knight') { p.buff = 7; p.hp = Math.min(p.max, p.hp + 1); for (const q of RG.players) if (q.alive && Math.hypot(q.x - p.x, q.y - p.y) < 22) { q.buff = 7 } ring(p.x, p.y, 40, 40, [col('#ffd23a')]); shake(0.6); sfx('rgBoss') }
    else if (cl.id === 'ranger') { const t = aimAt(); RG.rains.push({ x: t.x, y: t.y, r: 10, l: 3.2, tick: 0.3, dmg: p.dmg * 1.1, by: p }); sfx('rgShot') }
    else { const t = aimAt(); RG.meteors.push({ x: t.x, y: t.y, r: 9, l: 1.1, dmg: p.dmg * 6, by: p }); sfx('rgBoss') }
  }
  ring(p.x, p.y, 30, 50, [col(cl.color)])
}
const special = (p) => skill(p, 0)
function dash(p) {
  if (RG.mode !== 'play' || p.dashT > 0 || !p.alive) return
  let dx = p.mx || 0, dy = p.my || 0
  if (!dx && !dy) { dx = Math.cos(p.face); dy = Math.sin(p.face) }
  const l = Math.hypot(dx, dy) || 1
  p.dx = dx / l; p.dy = dy / l; p.dash = 0.18; p.dashT = p.dashCd; p.inv = Math.max(p.inv, 0.3)
  sfx('rgDash')
}
function enemyAI(e, dt) {
  const np = nearestPlayer(e.x, e.y)
  if (!np) return
  const p = np.p, d = e.def, dx = p.x - e.x, dy = p.y - e.y, dist = Math.hypot(dx, dy) || 1
  e.fa = Math.atan2(dy, dx)
  const slow = e.frozen > 0 ? 0.25 : 1
  e.t += dt; e.frozen = Math.max(0, (e.frozen || 0) - dt)
  let vx = 0, vy = 0
  if (d.boss) return boss(e, dt, dx, dy, dist, slow, p)
  if (e.type === 'slime') { vx = dx / dist; vy = dy / dist; const hop = 0.5 + 0.5 * Math.sin(e.t * 4); vx *= hop * 1.6; vy *= hop * 1.6 }
  else if (e.type === 'wolf') {
    // pack hunter: circles, then lunges
    e.cd -= dt
    if (e.charge > 0) { e.charge -= dt; vx = e.cdx * 3.4; vy = e.cdy * 3.4 }
    else if (dist < 14 && e.cd <= 0) { e.charge = 0.35; e.cd = R(1.6, 2.6); e.cdx = dx / dist; e.cdy = dy / dist; sfx('rgSwing') }
    else { const w = Math.sin(e.t * 3 + e.seed) * 0.8; vx = dx / dist + (-dy / dist) * w * 0.6; vy = dy / dist + (dx / dist) * w * 0.6 }
  }
  else if (e.type === 'bat') { const w = Math.sin(e.t * 6 + e.seed) * 0.9; vx = dx / dist + (-dy / dist) * w; vy = dy / dist + (dx / dist) * w }
  else if (e.type === 'skeleton') {
    if (dist > 12) { vx = dx / dist; vy = dy / dist } else if (dist < 7) { vx = -dx / dist * 0.5; vy = -dy / dist * 0.5 }
    e.shoot -= dt
    if (e.shoot <= 0) { e.shoot = d.shoot * R(0.8, 1.2); e.cast = 0.3; ebullet(e.x, e.y, Math.atan2(dy, dx), 24, 1, 1.1, '#f0f0d8'); sfx('tdShot') }
    e.cast = Math.max(0, (e.cast || 0) - dt)
  }
  else if (e.type === 'archer' || e.type === 'caster' || e.type === 'imp') {
    const want = e.type === 'archer' ? 22 : e.type === 'imp' ? 16 : 26
    if (dist < want - 4) { vx = -dx / dist; vy = -dy / dist } else if (dist > want + 6) { vx = dx / dist; vy = dy / dist } else { vx = -dy / dist * e.dir; vy = dx / dist * e.dir }
    e.shoot -= dt
    if (e.shoot <= 0) {
      e.shoot = d.shoot * R(0.8, 1.2)
      const a = Math.atan2(dy, dx)
      if (e.type === 'archer') ebullet(e.x, e.y, a, 34)
      else if (e.type === 'imp') { for (let i = -1; i <= 1; i += 2) ebullet(e.x, e.y, a + i * 0.16, 30, 1, 1, '#ff7a3a') }
      else for (let i = -1; i <= 1; i++) ebullet(e.x, e.y, a + i * 0.28, 28, 1, 1, '#4ad8ff')
      e.cast = 0.3; sfx('tdShot')
    }
    e.cast = Math.max(0, (e.cast || 0) - dt)
    if (e.type === 'caster' || e.type === 'imp') { e.tp -= dt; if (e.tp <= 0) { e.tp = e.type === 'imp' ? 2.6 : 3.5; const a = R(0, 6.28); const nx = clamp(p.x + Math.cos(a) * 18, -AX + 3, AX - 3), ny = clamp(p.y + Math.sin(a) * 14, -AY + 3, AY - 3); if (walkable(nx, ny, 1.4)) { ring(e.x, e.y, 10, 24, [col(d.c)]); e.x = nx; e.y = ny; ring(e.x, e.y, 10, 24, [col(d.c)]) } } }
  } else if (e.type === 'brute') {
    if (e.charge > 0) { e.charge -= dt; vx = e.cdx * 5.2; vy = e.cdy * 5.2; if (e.charge <= 0) e.rest = 0.6 }
    else if (e.wind > 0) { e.wind -= dt; if (e.wind <= 0) { e.charge = 0.6; e.cdx = dx / dist; e.cdy = dy / dist; sfx('rgSwing') } }
    else if (e.rest > 0) e.rest -= dt
    else { vx = dx / dist; vy = dy / dist; e.cd -= dt; if (e.cd <= 0 && dist < 36) { e.cd = 3; e.wind = 0.6 } }
  }
  const sp = d.spd * slow
  move(e, vx * sp * dt + (e.kx || 0) * dt, vy * sp * dt + (e.ky || 0) * dt, d.r * 0.8)
  e.kx = (e.kx || 0) * 0.86; e.ky = (e.ky || 0) * 0.86
  for (const q of RG.players) if (q.alive && Math.hypot(q.x - e.x, q.y - e.y) < d.r + 1.3) hurtPlayer(q, d.dmg)
}
function boss(e, dt, dx, dy, dist, slow, tp) {
  const d = e.def, a = Math.atan2(dy, dx), hpf = e.hp / e.max
  if (e.type === 'king') {
    e.cd -= dt
    if (e.jump > 0) { e.jump -= dt; move(e, e.jx * 38 * dt, e.jy * 38 * dt, 3.5); if (e.jump <= 0) { ring(e.x, e.y, 24, 40, [col(d.c)]); shake(1); for (let i = 0; i < 2; i++) RG.spawnQ.push({ type: 'slime', x: e.x + R(-5, 5), y: e.y + R(-5, 5), t: 0.3, sc: 1 + RG.floor * 0.3 }); if (hpf < 0.5) for (let i = 0; i < 12; i++) ebullet(e.x, e.y, (i / 12) * 6.28 + e.t, 28, 1, 1, '#7aff9a') } }
    else if (e.cd <= 0) { e.cd = hpf < 0.5 ? 2.2 : 3.2; e.jump = 0.45; e.jx = dx / dist; e.jy = dy / dist; sfx('rgSwing') }
    else move(e, dx / dist * d.spd * slow * dt, dy / dist * d.spd * slow * dt, 3.5)
  } else if (e.type === 'lord') {
    e.sp += dt * (hpf < 0.5 ? 2.2 : 1.5)
    e.cd -= dt
    if (e.cd <= 0) { e.cd = hpf < 0.5 ? 0.18 : 0.28; for (let k = 0; k < (hpf < 0.5 ? 4 : 3); k++) ebullet(e.x, e.y, e.sp + (k * 6.28) / (hpf < 0.5 ? 4 : 3), 26, 1, 0.9, '#d8d8ff'); sfx('tdShot') }
    e.sum -= dt; if (e.sum <= 0) { e.sum = 7; for (let i = 0; i < 2; i++) RG.spawnQ.push({ type: 'bat', x: e.x + R(-6, 6), y: e.y + R(-6, 6), t: 0.4, sc: 1 + RG.floor * 0.3 }) }
    move(e, Math.cos(e.t * 0.5) * 8 * dt, Math.sin(e.t * 0.7) * 8 * dt, 3.6)
  } else if (e.type === 'golem') {
    e.cd -= dt; e.sum -= dt
    if (e.wind > 0) { e.wind -= dt; if (e.wind <= 0) { shake(1.4); ring(e.x, e.y, 40, 60, [col(d.c)]); sfx('tdBoom'); for (const q of RG.players) if (q.alive && Math.hypot(q.x - e.x, q.y - e.y) < 11) hurtPlayer(q, 2); const nn = hpf < 0.5 ? 20 : 14; for (let i = 0; i < nn; i++) ebullet(e.x, e.y, (i / nn) * 6.28 + e.t, 22, 1, 1, '#9ae8ff') } }
    else if (e.cd <= 0) { e.cd = hpf < 0.5 ? 3.2 : 4.4; e.wind = 0.9; sfx('rgBoss') }
    else move(e, dx / dist * d.spd * slow * dt, dy / dist * d.spd * slow * dt, 4.4)
    if (e.sum <= 0) { e.sum = hpf < 0.5 ? 5 : 8; for (let i = 0; i < 2; i++) RG.spawnQ.push({ type: 'bat', x: e.x + R(-6, 6), y: e.y + R(-6, 6), t: 0.4, sc: 1 + RG.floor * 0.28 }) }
  } else if (e.type === 'drake') {
    e.cd -= dt; e.tp -= dt
    if (e.charge > 0) { e.charge -= dt; move(e, e.cdx * 38 * dt, e.cdy * 38 * dt, 4); if (e.charge <= 0) { ring(e.x, e.y, 30, 50, [col('#ff6a3a')]); shake(1); for (let i = 0; i < 12; i++) ebullet(e.x, e.y, (i / 12) * 6.28, 24, 1, 1, '#ff7a3a') } }
    else if (e.wind > 0) { e.wind -= dt; if (e.wind <= 0) { e.charge = 0.55; e.cdx = dx / dist; e.cdy = dy / dist; sfx('rgSwing') } }
    else {
      move(e, dx / dist * d.spd * slow * dt * 0.6, dy / dist * d.spd * slow * dt * 0.6, 4)
      if (e.cd <= 0) { e.cd = hpf < 0.5 ? 1.5 : 2.1; e.cast = 0.5; for (let i = -3; i <= 3; i++) ebullet(e.x, e.y, a + i * 0.12, 27, 1, 1.1, '#ff7a3a'); sfx('rgMagic') }
      if (e.tp <= 0) { e.tp = hpf < 0.5 ? 5 : 7.5; e.wind = 0.8 }
    }
    e.cast = Math.max(0, (e.cast || 0) - dt)
  } else {
    e.cd -= dt; e.tp -= dt
    if (e.tp <= 0) { e.tp = 5; ring(e.x, e.y, 20, 40, [col(d.c)]); const nx = R(-AX + 8, AX - 8), ny = R(-AY + 8, AY - 8); if (walkable(nx, ny, 4)) { e.x = nx; e.y = ny } ring(e.x, e.y, 20, 40, [col(d.c)]); sfx('tdZap') }
    if (e.cd <= 0) {
      e.cd = hpf < 0.5 ? 1.2 : 1.9; e.n = (e.n || 0) + 1
      if (e.n % 2) for (let i = -2; i <= 2; i++) ebullet(e.x, e.y, a + i * 0.2, 36, 1, 1, '#ff4adf')
      else for (let i = 0; i < (hpf < 0.5 ? 20 : 14); i++) ebullet(e.x, e.y, (i / (hpf < 0.5 ? 20 : 14)) * 6.28 + e.t, 24, 1, 1, '#ff8aff')
      sfx('rgMagic')
    }
  }
  void tp
  for (const q of RG.players) if (q.alive && Math.hypot(q.x - e.x, q.y - e.y) < d.r + 1.3) hurtPlayer(q, d.dmg)
}
// ---------- main loop (solo + host) ----------
function update(dtRaw) {
  const dt = Math.min(dtRaw, 0.04)
  if (RG.mode === 'idle' || RG.paused) return
  if (RG.mode === 'over') { stepParticles(dt); return }
  RG.t += dt
  if (RG.msg) { RG.msg.t -= dt; if (RG.msg.t <= 0) RG.msg = null }
  if (RG.tale) { stepParticles(dt); RG.emitT -= dt; if (RG.emitT <= 0) { RG.emitT = 0.1; emitR() } return }
  ambience(dt)
  if (RG.net && RG.net.role === 'guest') return guestStep(dt)
  RG.bossT = Math.max(0, RG.bossT - dt); RG.slowT = Math.max(0, RG.slowT - dt); RG.roomT += dt
  const me = lp()
  // local input
  if (me && me.alive) {
    let mx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + RG.stick[0]
    let my = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) + RG.stick[1]
    const ml = Math.hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml }
    me.inp.mx = mx; me.inp.my = my
    me.tapT = Math.max(0, (me.tapT || 0) - dt); me.hold = !!(me.holdPtr || keys.KeyJ || me.tapT > 0)
    if (keys.KeyQ || keys.KeyK) skill(me, 0)
    if (keys.KeyE) skill(me, 1)
    if (keys.KeyR) skill(me, 2)
    if (keys.KeyF) relicSkill(me)
  }
  for (const p of RG.players) {
    p.inv = Math.max(0, p.inv - dt); p.dashT = Math.max(0, p.dashT - dt); p.spT = Math.max(0, p.spT - dt); p.sT2 = Math.max(0, p.sT2 - dt); p.sT3 = Math.max(0, p.sT3 - dt); p.rT = Math.max(0, p.rT - dt); p.hurtT = Math.max(0, p.hurtT - dt); p.buff = Math.max(0, p.buff - dt); p.lvT = Math.max(0, p.lvT - dt); p.bash = Math.max(0, (p.bash || 0) - dt)
    if (p.swing) { p.swing.t -= dt; if (p.swing.t <= 0) p.swing = null }
    if (!p.alive) continue
    if (p.remote) { if (p.dashN !== p.seenDash) { p.seenDash = p.dashN; dash(p) } for (let k = 0; k < 4; k++) if (p.sn[k] !== p.seenSn[k]) { p.seenSn[k] = p.sn[k]; if (k === 3) relicSkill(p); else skill(p, k) } }
    const mx = p.inp.mx, my = p.inp.my
    p.mx = mx; p.my = my
    const ox = p.x, oy = p.y
    if (p.dash > 0) { p.dash -= dt; move(p, p.dx * 95 * dt, p.dy * 95 * dt, 1.4); part(p.x, p.y, 0, 0, 0.25, col(CLASSES[p.cls].color), 1.2); if (p.trail) { for (const e of RG.en) if (!e.dead && e.spawnT <= 0 && Math.hypot(e.x - p.x, e.y - p.y) < 4 + e.def.r && !e.burn) e.burn = { t: 3, dps: 4, by: p }; part(p.x, p.y, R(-4, 4), R(2, 10), 0.5, col('#ff9a3a'), 1.4) } if (p.bash > 0) { for (const e of RG.en) if (!e.dead && e.spawnT <= 0 && Math.hypot(e.x - p.x, e.y - p.y) < 3.6 + e.def.r && !(e.bashed === p.dash)) { e.bashed = p.dash; hitEnemy(e, p.dmg * 2.2, false, 70, p.dx, p.dy, p); e.frozen = 1.2 } } }
    else { move(p, mx * p.spd * dt, my * p.spd * dt, 1.4); if (mx || my) p.face = Math.atan2(my, mx) }
    p.walk += Math.hypot(p.x - ox, p.y - oy) * 0.5
    trailStep(p, dt)
    stepOrb(p, dt)
    playerAttack(p, dt)
  }
  tickWorld(dt); stepPets(dt)
  for (const q of RG.players) if (q.glow && q.alive) for (const o of RG.players) if (o !== q && o.alive && o.hp < o.max && Math.hypot(o.x - q.x, o.y - q.y) < 12) { o.regen = (o.regen || 0) + dt; if (o.regen > 14) { o.regen = 0; o.hp++ } }
  // spawn queue
  const n = RG.players.length
  for (const s of RG.spawnQ) s.t -= dt
  for (const s of RG.spawnQ) if (s.t <= 0 && !s.done) {
    s.done = true
    const def = { ...EN[s.type], id: s.type }
    if (s.elite) { def.gold = def.gold * 3; def.r = def.r * 1.25 }
    const hp = def.hp * s.sc * (s.elite ? 2.6 : 1)
    RG.en.push({ id: RG.eid++, type: s.type, def, x: s.x, y: s.y, hp, max: hp, t: 0, seed: R(0, 6), dir: Math.random() < 0.5 ? -1 : 1, shoot: R(0.8, 1.8), tp: R(1, 3), cd: 2, wind: 0, charge: 0, rest: 0, sp: 0, sum: 4, spawnT: 0.5, flash: 0, fa: Math.PI, cast: 0, elite: !!s.elite })
    ring(s.x, s.y, 8, 16, [col(def.c)])
  }
  RG.spawnQ = RG.spawnQ.filter((s) => !s.done)
  for (const e of RG.en) {
    if (e.dead) continue
    e.flash = Math.max(0, e.flash - dt)
    if (e.spawnT > 0) { e.spawnT -= dt; continue }
    // the monsters move a little slower than the heroes: the dungeon is something to read, not just to survive
    let edt = dt * pace() * (RG.slowT > 0 ? 0.35 : 1)
    if (e.burn) { e.burn.t -= dt; e.hp -= e.burn.dps * dt; if (Math.random() < 0.3) part(e.x + R(-1, 1), e.y + R(-1, 1), 0, 14, 0.4, col('#ff9a3a'), 1.1); if (e.burn.t <= 0) e.burn = null; if (e.hp <= 0) { e.by = e.burn ? e.burn.by : e.by; killEnemy(e); continue } }
    for (const q of RG.players) if (q.aura && q.alive && Math.hypot(q.x - e.x, q.y - e.y) < 11) { edt *= 0.7; break }
    enemyAI(e, edt)
  }
  RG.en = RG.en.filter((e) => !e.dead)
  for (const b of RG.pb) {
    b.life -= dt
    if (b.homing) { const t = nearestEnemy(b.x, b.y, 40); if (t) { const a = Math.atan2(t.e.y - b.y, t.e.x - b.x), sp = Math.hypot(b.vx, b.vy), ca = Math.atan2(b.vy, b.vx); let da = a - ca; da = Math.atan2(Math.sin(da), Math.cos(da)); const na = ca + clamp(da, -4 * dt, 4 * dt); b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp } }
    b.x += b.vx * dt; b.y += b.vy * dt
    if (RG.urns.length) hitUrns(b.x, b.y, 2.2)
    if (RG.secret && !RG.secret.found && RG.open && Math.hypot(b.x - RG.secret.x, b.y - RG.secret.y) < 3.2) { b.life = 0; hitSecret(); continue }
    if (!walkable(b.x, b.y, 0.1)) { b.life = 0; continue }
    for (const e of RG.en) {
      if (e.dead || e.spawnT > 0 || b.hit.has(e)) continue
      if (Math.hypot(e.x - b.x, e.y - b.y) < e.def.r + 0.8) { b.hit.add(e); hitEnemy(e, b.dmg, b.crit, b.big ? 15 : 0, Math.sign(b.vx), Math.sign(b.vy), b.by, !!b.wp); if (b.hit.size > b.pierce) { b.life = 0; break } }
    }
  }
  RG.pb = RG.pb.filter((b) => b.life > 0)
  for (const b of RG.eb) {
    b.life -= dt; b.x += b.vx * dt * pace(); b.y += b.vy * dt * pace()
    if (Math.abs(b.x) > AX || Math.abs(b.y) > AY) { b.life = 0; continue }
    let hit = false
    for (const q of RG.players) if (q.alive && Math.hypot(b.x - q.x, b.y - q.y) < b.r + 1.0) { b.life = 0; hurtPlayer(q, b.dmg); hit = true; break }
    if (!hit) for (const o of RG.obst) if (Math.abs(b.x - o.x) < o.w / 2 && Math.abs(b.y - o.y) < o.h / 2) { b.life = 0; break }
  }
  RG.eb = RG.eb.filter((b) => b.life > 0)
  for (const l of RG.loot) {
    l.x += l.vx * dt; l.y += l.vy * dt; l.vx *= 0.9; l.vy *= 0.9
    const np = nearestPlayer(l.x, l.y)
    if (!np) continue
    const p = np.p, d = np.d
    if (d < p.magnet && l.k === 'gold') { l.x += ((p.x - l.x) / d) * 50 * dt; l.y += ((p.y - l.y) / d) * 50 * dt }
    if (d < 2.4) { l.got = true; if (l.k === 'gold') { RG.gold++; if (p.greed) gainXp(p, 1.2); if (p === lp()) sfx('coin') } else { p.hp = Math.min(p.max, p.hp + 1); if (p === lp()) sfx('rgPerk') } }
  }
  RG.loot = RG.loot.filter((l) => !l.got)
  for (const f of RG.fx) f.l -= dt
  RG.fx = RG.fx.filter((f) => f.l > 0)
  // puzzles, hazards, survival, chests and the hidden passage
  stepPuzzle(dt); stepHazards(dt); stepSurvival(dt)
  for (const c of RG.chests) {
    if (c.open) continue
    const near = RG.players.find((p) => p.alive && Math.hypot(p.x - c.x, p.y - c.y) < 3)
    if (!near) { c.warned = false; continue }
    if (c.kind === 'shop') { if (RG.gold >= c.price) { RG.gold -= c.price; buyItem(c, near) } else if (!c.warned) { c.warned = true; sfx('cBad'); RG.msg = { text: 'NEED ' + c.price + ' GOLD', sub: c.label + ': ' + c.sub, color: '#ff8a96', t: 1.8 } } }
    else openChest(c)
  }
  // room clear
  const fightRoom = ['combat', 'elite', 'boss', 'secret', 'ambush', 'gauntlet', 'survival', 'trap'].includes(RG.rtype)
  if (!RG.open && fightRoom && !RG.en.length && !RG.spawnQ.length && !(RG.rtype === 'survival' && RG.surv > 0)) {
    RG.open = true
    for (const l of RG.loot) l.vx = l.vy = 0
    const final = RG.rtype === 'boss' && (!RG.abyss || RG.room >= ABYSS_ROOMS - 1)
    RG.msg = { text: RG.rtype === 'boss' ? 'GUARDIAN DEFEATED' : RG.rtype === 'secret' ? 'THE VAULT IS YOURS' : 'ROOM CLEARED', sub: final ? 'THE SHARD IS YOURS' : RG.rtype === 'secret' ? 'OPEN THE CHEST' : 'GO RIGHT ▶', color: '#6aff9a', t: 1.8 }
    sfx('rgDoor'); sfx('ding', 5)
    if (RG.abyss) markAbyss(RG.room + 1)
    // hidden agendas
    if (RG.rtype !== 'boss' && RG.rtype !== 'secret' && RG.rtype !== 'survival') { if (!RG.hurtRoom) { RG.ag.streak++; if (RG.ag.streak >= 3) agenda('flawless') } else RG.ag.streak = 0; if (RG.roomT < 25 && RG.rtype !== 'gauntlet') agenda('speed') }
    if (final) return finish(true)
    if (RG.rtype === 'secret') RG.chests.push({ x: AX * 0.25, y: 0, open: false, kind: 'vault' })
    else { offerPerks(); const bt = !RG.abyss && CHAPTERS[RG.chapter - 1].beats && CHAPTERS[RG.chapter - 1].beats[RG.room]; if (bt) say(bt) }
  }
  const secPortal = RG.secret && RG.secret.found
  const required = (c) => c.kind === 'puzzle' || c.kind === 'vault'
  if (secPortal && RG.open && RG.players.every((p) => !p.choices) && RG.players.some((p) => p.alive && Math.hypot(p.x - RG.secret.x, p.y - (RG.secret.y - 2.5)) < 3.4)) {
    RG.sub = 'secret'; RG.msg = null; enterRoom(); say([['sys', 'A HIDDEN VAULT, SEALED SINCE BEFORE THE GRID. SOMETHING OLD STIRS INSIDE.']])
  } else if (RG.open && RG.players.every((p) => !p.choices) && RG.chests.every((c) => c.open || !required(c)) && RG.players.some((p) => p.alive && p.x > AX - 3 && Math.abs(p.y) < 7)) {
    if (RG.sub === 'secret') RG.sub = null
    RG.room++
    if (RG.abyss && RG.room >= ABYSS_ROOMS) return finish(true)
    for (const p of RG.players) if (p.alive) p.hp = Math.min(p.max, p.hp + 1)
    enterRoom()
  }
  stepParticles(dt)
  if (RG.net && RG.net.role === 'host') netTick(dt)
  RG.emitT -= dt
  if (RG.emitT <= 0) { RG.emitT = 0.1; emitR() }
}
// suspense: distant sounds and a heartbeat when you are nearly dead
function ambience(dt) {
  RG.ambT -= dt
  if (RG.ambT <= 0) { RG.ambT = R(5, 11); sfx(['rgWind', 'rgOwl', 'rgCreak', 'rgWind'][(Math.random() * 4) | 0]) }
  const p = lp()
  if (p && p.alive && p.hp / p.max <= 0.34 && RG.mode === 'play') { RG.heartT -= dt; if (RG.heartT <= 0) { RG.heartT = 0.85; sfx('rgHeart') } }
}
function offerPerks() {
  for (const p of RG.players) {
    const pool = PERKS.filter((x) => !(x.id === 'shield' && p.aegis)).sort(() => Math.random() - 0.5)
    p.choices = pool.slice(0, p.perkN || 3)
  }
  sfx('rgPerk'); emitR()
}
function pickPerk(pi, i) {
  const p = RG.players[pi]
  if (!p || !p.choices || !p.choices[i]) return
  const c = p.choices[i]; c.f(p); p.perks.push(c.ico)
  p.choices = null
  if (pi === RG.me) { sfx('rgPerk'); RG.msg = { text: c.name, sub: c.desc, color: '#ffe84a', t: 1.6 }; ring(p.x, p.y, 24, 40, [col('#ffe84a')]) }
  emitR()
}
function onKey(code) {
  if (RG.mode === 'idle') return
  const me = lp()
  if (RG.tale) { if (code === 'Enter' || code === 'Space') rogueActions.nextTale(); else if (code === 'Escape') { RG.tale = null; emitR() } return }
  if (code === 'Escape' || code === 'KeyP') { if (RG.mode === 'play' && !RG.net) { RG.paused = !RG.paused; emitR() } else if (RG.paused) { RG.paused = false; emitR() } return }
  if (RG.paused) return
  if (me && me.choices) { const n = ['Digit1', 'Digit2', 'Digit3'].indexOf(code); if (n >= 0) rogueActions.pick(n); return }
  if (RG.mode === 'over') { if (code === 'Enter') rogueActions.rematch(); return }
  if (code === 'Space' || code === 'ShiftLeft' || code === 'ShiftRight') rogueActions.dash()
  else if (code === 'KeyQ' || code === 'KeyK') rogueActions.special(0)
  else if (code === 'KeyE') rogueActions.special(1)
  else if (code === 'KeyR') rogueActions.special(2)
  else if (code === 'KeyF') rogueActions.relic()
}
export const rogueActions = {
  start, stop, quit() { toMenu() },
  resume() { RG.paused = false; emitR() },
  pause() { if (RG.mode === 'play' && !RG.paused && !RG.net) { RG.paused = true; emitR(); return true } return false },
  rematch() { if (RG.net) { RG.net.rematch(); return } { const q = lp(); start({ mode: RG.abyss ? 'abyss' : '', orb: q ? q.orb : '', relic: q ? q.relic : '', cls: q ? q.cls : 0, race: q ? q.race : 0, pet: q ? q.pet : 0, weapon: q ? q.wid : '', power: q ? q.pw : '', chapter: RG.over && RG.over.win && RG.over.next ? RG.chapter + 1 : RG.chapter }) } },
  pick(i) {
    if (RG.net && RG.net.role === 'guest') { RG.net.perk(i); const p = lp(); if (p) { p.choices = null; emitR() } return }
    pickPerk(RG.me, i)
  },
  dash() { const p = lp(); if (!p) return; if (RG.net && RG.net.role === 'guest') { p.dashN++; return } dash(p) },
  relic() { const p = lp(); if (!p) return; if (RG.net && RG.net.role === 'guest') { p.sn[3]++; return } relicSkill(p) },
  special(slot = 0) { const p = lp(); if (!p) return; if (RG.net && RG.net.role === 'guest') { p.sn[slot]++; return } skill(p, slot) },
  hold(on) { const p = lp(); if (p) p.holdPtr = !!on },
  // one tap on the attack button (phones): aim at the nearest enemy and swing once
  attackTap() { const p = lp(); if (!p) return; p.aimPt = null; p.tapT = 0.2 },
  nextTale() { const t = RG.tale; if (!t) return; sfx('wdKey'); if (t.i < t.lines.length - 1) t.i++; else RG.tale = null; emitR() },
  skipTale() { RG.tale = null; emitR() },
  stick(x, y) { RG.stick = [x, y] },
  // used by the tests and the lobby preview: jump straight to a room of the current chapter
  jump(room, sub) { RG.room = room; RG.sub = sub || null; enterRoom() },
  // pointer position in arena units (the stage is 100 x 56): unprojected onto the ground to aim
  aim(x, y) { const p = lp(); if (!p || !RG.cam) return; const g = unprojectGround(RG.cam, x / 50, y / 28); if (g) { p.aimPt = g; p.aimT = G.time } },
}

// ---------- online co-op (host simulates; guests send input and mirror the state) ----------
const r1 = (v) => Math.round(v * 10) / 10
let nT = 0, nSeq = 0, lastN = -1, inT = 0
export const rogueNet = {
  attach(net) { RG.net = net },
  active: () => !!RG.net && RG.mode !== 'idle',
  reset() { nSeq = 0; lastN = -1; nT = 0; inT = 0 },
  // host: a friend's input arrives (the first message creates their hero)
  applyInput(pid, m) {
    if (!RG.net || RG.net.role !== 'host' || !m) return
    let p = RG.players.find((x) => x.pid === pid)
    if (!p) {
      if (RG.players.length >= 3) return
      p = mkPlayer(m.cls, String(m.name || 'FRIEND').slice(0, 10), true, m.race, m.pet); p.pid = pid; applyGear(p, m.wid, m.pw, m.orb, m.relic); levelTo(p, RG.abyss ? 6 : 1 + 2 * (RG.chapter - 1)); { const pp = mkPet(p); if (pp) RG.pets.push(pp) }
      p.x = -AX + 6; p.y = RG.players.length * 7 - 7
      RG.players.push(p); RG.msg = { text: p.name + ' JOINED', sub: '', color: '#6aff9a', t: 1.6 }
      if (RG.open) p.choices = null
    }
    p.inp.mx = clamp(+m.mx || 0, -1, 1); p.inp.my = clamp(+m.my || 0, -1, 1)
    if (typeof m.dn === 'number') p.dashN = m.dn
    if (Array.isArray(m.sn)) p.sn = m.sn.map((v) => v | 0)
    p.hold = !!m.hd
    if (m.ax !== undefined) { p.aimPt = { x: +m.ax, y: +m.ay }; p.aimT = G.time } else p.aimPt = null
    p.guestPos = m.x !== undefined ? [m.x, m.y] : null
    if (p.guestPos && p.alive && !p.dash && Math.hypot(p.guestPos[0] - p.x, p.guestPos[1] - p.y) < 4 && walkable(p.guestPos[0], p.guestPos[1], 1.4)) { p.x += (p.guestPos[0] - p.x) * 0.5; p.y += (p.guestPos[1] - p.y) * 0.5 }
  },
  applyPerk(pid, i) { const k = RG.players.findIndex((x) => x.pid === pid); if (k >= 0) pickPerk(k, i) },
  playerLeft(pid) {
    const k = RG.players.findIndex((x) => x.pid === pid)
    if (k <= 0) return
    const p = RG.players[k]; RG.players.splice(k, 1); RG.pets = RG.pets.filter((t) => t.owner !== p)
    RG.msg = { text: p.name + ' LEFT', sub: '', color: '#ff8a96', t: 1.6 }
    if (!alive().length && RG.mode === 'play') finish(false)
    emitR()
  },
  hostLeft() { if (RG.net && RG.mode === 'play') { RG.msg = { text: 'HOST LEFT', sub: '', color: '#ff8a96', t: 2 }; RG.mode = 'over'; RG.over = { win: false, floor: RG.floor + 1, room: RG.room + 1, kills: RG.kills, gold: RG.gold, score: 0, perks: 0, cls: '', coop: true, left: true }; music.stop(); emitR() } },
  applyState(s) {
    if (!RG.net || RG.net.role !== 'guest' || !s || s.n <= lastN) return
    lastN = s.n
    const first = RG.mode === 'idle' || !RG.players.length
    if (s.rk !== RG.rk) { // a new room
      RG.rk = s.rk; RG.obst = s.ob.map((o) => ({ x: o[0], y: o[1], w: o[2], h: o[3], s: o[4] })); RG.floor = s.fl; RG.room = s.ro; RG.chapter = s.fl + 1; RG.ax = AX = s.ax; RG.ay = AY = s.ay; RG.rtype = s.rty
      RG.eb = []; RG.pb = []; RG.loot = []; if (!first) sfx('rgDoor')
      for (const p of RG.players) { p.choices = null }
    }
    RG.floors = s.fs
    // puzzle, chests and the hidden passage mirror the host
    RG.puz = s.pz ? { runes: s.pz.r.map((q) => ({ x: q[0], y: q[1], c: RUNE_COL[q[2] % 5], lit: q[3] })), seq: [], step: s.pz.st, showing: !!s.pz.sh, solved: !!s.pz.sv } : null
    RG.chests = (s.cx || []).map((c) => ({ x: c[0], y: c[1], open: !!c[2], kind: c[3], price: c[4], label: c[5] }))
    RG.abyss = !!s.ab; RG.hz = (s.hzs || []).map((z) => ({ x: z[0], y: z[1], w: z[2], h: z[3], on: z[4] === 1, warn: z[4] === 2 })); RG.urns = (s.urs || []).map((u) => ({ x: u[0], y: u[1], hp: 2 })); RG.surv = s.sv || 0; RG.slowT = s.slw ? 1 : 0
    RG.secret = s.sx ? { x: s.sx[0], y: s.sx[1], hp: s.sx[2], found: !!s.sx[3] } : null
    // players
    while (RG.players.length < s.pl.length) RG.players.push(mkPlayer(0, '', true))
    RG.players.length = s.pl.length
    s.pl.forEach((q, i) => {
      const p = RG.players[i]
      const mineNow = i === s.me
      if (mineNow) RG.me = i
      if (mineNow && p.alive && Math.hypot(q[0] - p.x, q[1] - p.y) < 8 && p.hasState) { p.x += (q[0] - p.x) * 0.2; p.y += (q[1] - p.y) * 0.2 } else { p.tx = q[0]; p.ty = q[1]; if (!p.hasState || mineNow) { p.x = q[0]; p.y = q[1] } }
      if (!mineNow) { p.tx = q[0]; p.ty = q[1] }
      if (mineNow && q[2] < p.hp) { sfx('rgHurt'); shake(1); flash(0.2, [1, 0.2, 0.2]); p.hurtT = 0.3 }
      p.hp = q[2]; p.max = q[3]; p.face = q[4]; p.cls = q[5]; p.inv = q[6]; p.dash = q[7]; p.alive = !!q[9]; p.shield = q[10]; p.name = q[11]; p.dashT = q[12]; p.spT = q[13]; p.dashCd = q[14]; p.spCd = q[15]
      p.swing = q[16] ? { a: q[16][0], arc: q[16][1], reach: q[16][2], t: q[16][3], max: 0.2 } : null
      p.mx = q[17]; p.my = q[18]; p.race = q[19] | 0; p.lv = q[20] | 1; p.xp = q[21] | 0; p.buff = q[22] ? 1 : 0; p.pet = q[23] | 0; p.sT2 = q[24] || 0; p.sT3 = q[25] || 0; p.orb = (ORBS[q[26]] || ORBS[0]).id; p.relic = (RELICS[q[27]] || RELICS[0]).id; p.rT = q[28] || 0
      if (!mineNow) { p.walk += 0.5 * Math.hypot(q[17], q[18]) * 0.05 }
      p.hasState = true
    })
    // pets, traps, rain and meteors (visuals only; the host does the damage)
    const oldPets = RG.pets
    RG.pets = (s.pt || []).map((q, i) => { const o = oldPets[i], owner = RG.players[q[0]]; const t = o && o.type === q[1] ? o : { type: q[1], x: q[2], y: q[3], t: Math.random() * 6, act: 0 }; t.st = q[6] | 0; t.lv = q[7] | 1; if (q[5] && !(t.act > 0)) { t.act = q[1] === 'dragon' ? 0.6 : 0.25; if (q[1] === 'dragon') for (let k = 0; k < 20; k++) { const aa = q[4] + R(-0.45, 0.45), sp2 = R(20, 46); part(t.x, t.y, Math.cos(aa) * sp2, Math.sin(aa) * sp2, R(0.25, 0.6), col(['#ff6a3a', '#ffb04a', '#ffe84a'][(Math.random() * 3) | 0]), R(1.1, 2)) } } t.owner = owner; t.tx = q[2]; t.ty = q[3]; t.face = q[4]; return t })
    RG.traps = (s.tr || []).map((t) => ({ x: t[0], y: t[1], r: t[2], l: t[3] })); RG.rains = (s.rn || []).map((t) => ({ x: t[0], y: t[1], r: t[2], l: t[3] })); RG.meteors = (s.mt || []).map((t) => ({ x: t[0], y: t[1], r: t[2], l: t[3] }))
    // enemies (match by id, lerp positions)
    const old = new Map(RG.en.map((e) => [e.id, e]))
    const next = []
    for (const q of s.en) {
      let e = old.get(q[0])
      const def = { ...EN[q[1]], id: q[1] }
      if (!e) e = { id: q[0], type: q[1], def, x: q[2], y: q[3], t: 0, seed: q[0] % 7, hp: 1, max: 1, spawnT: 0, flash: 0 }
      e.tx = q[2]; e.ty = q[3]; e.hp = q[4] * 1000; e.max = 1000; e.fa = q[5]; e.frozen = q[6]; e.spawnT = q[7]; e.wind = q[8]; e.charge = q[9]; e.cast = q[10]; e.flash = q[11]
      next.push(e); old.delete(q[0])
    }
    for (const e of old.values()) { // gone: it died
      const c = col(e.def.c); for (let i = 0; i < (e.def.boss ? 30 : 8); i++) part(e.x, e.y, R(-34, 34), R(-34, 34), R(0.25, 0.7), c, R(0.8, 1.7)); sfx('rgKill')
    }
    RG.en = next
    RG.pb = s.pb.map((b) => ({ x: b[0], y: b[1], vx: b[2], vy: b[3], big: !!b[4], c: b[5] }))
    RG.eb = s.eb.map((b) => ({ x: b[0], y: b[1], vx: b[2], vy: b[3], r: b[4], c: b[5] }))
    RG.loot = s.lt.map((l) => ({ k: l[0] ? 'heart' : 'gold', x: l[1], y: l[2] }))
    RG.fx = (s.fx || []).map((f) => ({ k: f[0], l: f[1], p: RG.players[f[2]] }))
    RG.spawnQ = (s.sq || []).map((q) => ({ type: q[0], x: q[1], y: q[2], t: q[3] }))
    const wasOpen = RG.open
    RG.open = !!s.op; if (RG.open && !wasOpen) { sfx('rgDoor'); sfx('ding', 5) }
    RG.gold = s.gold; RG.kills = s.kills; RG.bossT = s.bt
    const me = lp()
    if (me) { if (s.ch && !me.choices) { const pool = PERKS.filter((x) => s.ch.includes(x.id)); me.choices = s.ch.map((id) => pool.find((x) => x.id === id)).filter(Boolean); sfx('rgPerk') } else if (!s.ch) me.choices = null; me.perks = s.pk }
    if (s.msg && (!RG.msg || RG.msg.text !== s.msg.text)) RG.msg = s.msg
    if (s.over && !RG.over) {
      RG.mode = 'over'; RG.over = s.over; music.stop()
      profile.rogueRuns = (profile.rogueRuns || 0) + 1; if (s.over.win) profile.rogueWins = (profile.rogueWins || 0) + 1
      profile.rogueDeep = Math.max(profile.rogueDeep || 0, RG.floor * 5 + RG.room + 1); if (s.over.win) markCleared(RG.floor + 1)
      recordScore('rogue', s.over.score); saveProfile(); sfx(s.over.win ? 'win' : 'over')
    }
    if (first) { RG.mode = 'play'; G.mode = 'rogue'; engineEmit() }
    emitR()
  },
}
function netTick(dt) {
  nT -= dt
  if (nT > 0) return
  nT = RG.net.fast && RG.net.fast() ? 0.05 : 0.1
  const mk = (i) => RG.players.map((p, k) => [r1(p.x), r1(p.y), p.hp, p.max, Math.round(p.face * 100) / 100, p.cls, p.inv > 0 ? 1 : 0, p.dash > 0 ? 1 : 0, 0, p.alive ? 1 : 0, p.shield, p.name, Math.max(0, p.dashT), Math.max(0, p.spT), p.dashCd, p.spCd, p.swing ? [Math.round(p.swing.a * 100) / 100, p.swing.arc, p.swing.reach, p.swing.t] : 0, r1(p.mx), r1(p.my)])
  void mk
  const common = {
    n: ++nSeq, rk: RG.rk, fl: RG.floor, ro: RG.room, fs: RG.floors, ax: RG.ax, ay: RG.ay, rty: RG.rtype,
    pz: RG.puz ? { r: RG.puz.runes.map((r) => [r.x, r.y, RUNE_COL.indexOf(r.c), Math.round(r.lit * 10) / 10]), st: RG.puz.step, sh: RG.puz.showing ? 1 : 0, sv: RG.puz.solved ? 1 : 0 } : 0,
    cx: RG.chests.map((c) => [r1(c.x), r1(c.y), c.open ? 1 : 0, c.kind, c.price || 0, c.label || '']), sx: RG.secret ? [r1(RG.secret.x), r1(RG.secret.y), RG.secret.hp, RG.secret.found ? 1 : 0] : 0, ob: RG.obst.map((o) => [r1(o.x), r1(o.y), o.w, o.h, o.s]),
    pl: RG.players.map((p) => [r1(p.x), r1(p.y), p.hp, p.max, Math.round(p.face * 100) / 100, p.cls, p.inv > 0 ? 1 : 0, p.dash > 0 ? 1 : 0, 0, p.alive ? 1 : 0, p.shield, p.name, Math.max(0, p.dashT), Math.max(0, p.spT), p.dashCd, p.spCd, p.swing ? [Math.round(p.swing.a * 100) / 100, p.swing.arc, p.swing.reach, p.swing.t] : 0, r1(p.mx), r1(p.my), p.race, p.lv, Math.round(p.xp), p.buff > 0 ? 1 : 0, p.pet, Math.max(0, p.sT2), Math.max(0, p.sT3), ORBS.findIndex((o) => o.id === p.orb), RELICS.findIndex((o) => o.id === p.relic), Math.max(0, p.rT)]),
    ab: RG.abyss ? 1 : 0, rm: RG.room, hzs: RG.hz.map((z) => [r1(z.x), r1(z.y), z.w, z.h, z.on ? 1 : z.warn ? 2 : 0]), urs: RG.urns.map((u) => [r1(u.x), r1(u.y)]), sv: Math.round(RG.surv * 10) / 10, slw: RG.slowT > 0 ? 1 : 0,
    pt: RG.pets.map((t) => [RG.players.indexOf(t.owner), t.type, r1(t.x), r1(t.y), Math.round(t.face * 100) / 100, t.act > 0 ? 1 : 0, t.st, t.lv]),
    tr: RG.traps.map((t) => [r1(t.x), r1(t.y), t.r, Math.round(t.l * 10) / 10]), rn: RG.rains.map((t) => [r1(t.x), r1(t.y), t.r, Math.round(t.l * 10) / 10]), mt: RG.meteors.map((t) => [r1(t.x), r1(t.y), t.r, Math.round(t.l * 100) / 100]),
    en: RG.en.map((e) => [e.id, e.type, r1(e.x), r1(e.y), Math.round((Math.max(0, e.hp) / e.max) * 1000) / 1000, Math.round((e.fa || 0) * 100) / 100, e.frozen > 0 ? 1 : 0, e.spawnT > 0 ? Math.round(e.spawnT * 100) / 100 : 0, e.wind > 0 ? 1 : 0, e.charge > 0 ? 1 : 0, e.cast > 0 ? 1 : 0, e.flash > 0 ? 1 : 0]),
    pb: RG.pb.map((b) => [r1(b.x), r1(b.y), r1(b.vx), r1(b.vy), b.big ? 1 : 0, b.c]),
    eb: RG.eb.map((b) => [r1(b.x), r1(b.y), r1(b.vx), r1(b.vy), b.r, b.c]),
    lt: RG.loot.map((l) => [l.k === 'heart' ? 1 : 0, r1(l.x), r1(l.y)]),
    fx: RG.fx.map((f) => [f.k, Math.round(f.l * 100) / 100, RG.players.indexOf(f.p)]),
    sq: RG.spawnQ.map((q) => [q.type, r1(q.x), r1(q.y), Math.round(q.t * 100) / 100]),
    op: RG.open ? 1 : 0, gold: RG.gold, kills: RG.kills, bt: RG.bossT, msg: RG.msg, over: RG.over,
  }
  // each friend gets their own perk choices and their own index
  RG.players.forEach((p, i) => {
    if (!p.remote) return
    RG.net.state(p.pid, { ...common, me: i, ch: p.choices ? p.choices.map((c) => c.id) : 0, pk: p.perks })
  })
}
function guestStep(dt) {
  const p = lp()
  const k = 1 - Math.exp(-16 * dt)
  if (p && p.alive) {
    p.tapT = Math.max(0, (p.tapT || 0) - dt); p.hold = !!(p.holdPtr || keys.KeyJ || p.tapT > 0)
    const mx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + RG.stick[0]
    const my = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) + RG.stick[1]
    const ml = Math.hypot(mx, my), nx = ml > 1 ? mx / ml : mx, ny = ml > 1 ? my / ml : my
    p.mx = nx; p.my = ny
    const ox = p.x, oy = p.y
    move(p, nx * p.spd * dt, ny * p.spd * dt, 1.4)
    if (nx || ny) p.face = Math.atan2(ny, nx)
    p.walk += Math.hypot(p.x - ox, p.y - oy) * 0.5; trailStep(p, dt)
    RG.skLatch = RG.skLatch || [false, false, false, false]
    ;[[keys.KeyQ || keys.KeyK, 0], [keys.KeyE, 1], [keys.KeyR, 2], [keys.KeyF, 3]].forEach(([on, k]) => { if (on) { if (!RG.skLatch[k]) { p.sn[k]++; RG.skLatch[k] = true } } else RG.skLatch[k] = false })
  }
  p.dashT = Math.max(0, p.dashT - dt); p.spT = Math.max(0, p.spT - dt); p.sT2 = Math.max(0, p.sT2 - dt); p.sT3 = Math.max(0, p.sT3 - dt); p.hurtT = Math.max(0, p.hurtT - dt)
  for (const q of RG.players) { if (q !== p && q.tx !== undefined) { const ox = q.x, oy = q.y; q.x += (q.tx - q.x) * k; q.y += (q.ty - q.y) * k; q.walk += Math.hypot(q.x - ox, q.y - oy) * 0.5; trailStep(q, dt) } if (q.swing) q.swing.t -= dt }
  for (const t of RG.pets) { t.t += dt; t.act = Math.max(0, (t.act || 0) - dt); if (t.tx !== undefined) { t.x += (t.tx - t.x) * k; t.y += (t.ty - t.y) * k } }
  for (const e of RG.en) { e.t += dt; if (e.tx !== undefined) { e.x += (e.tx - e.x) * k; e.y += (e.ty - e.y) * k } }
  for (const b of RG.pb) { b.x += b.vx * dt; b.y += b.vy * dt }
  for (const b of RG.eb) { b.x += b.vx * dt; b.y += b.vy * dt }
  for (const f of RG.fx) f.l -= dt
  stepParticles(dt)
  inT -= dt
  if (inT <= 0 && RG.net) {
    inT = RG.net.fast && RG.net.fast() ? 0.05 : 0.1
    const aim = p && p.aimPt && G.time - p.aimT < 2 ? p.aimPt : null
    RG.net.input({ mx: r1(p ? p.mx : 0), my: r1(p ? p.my : 0), dn: p ? p.dashN : 0, sn: p ? p.sn : [0, 0, 0, 0], hd: p && p.hold ? 1 : 0, race: RG.myRace | 0, pet: RG.myPet | 0, wid: RG.myWid || '', pw: RG.myPw || '', orb: RG.myOrb || '', relic: RG.myRelic || '', cls: RG.myCls | 0, name: profile.name || 'FRIEND', ax: aim ? r1(aim.x) : undefined, ay: aim ? r1(aim.y) : undefined, x: p ? r1(p.x) : undefined, y: p ? r1(p.y) : undefined })
  }
  RG.emitT -= dt
  if (RG.emitT <= 0) { RG.emitT = 0.1; emitR() }
}
// the guest joins the host's game as a fresh hero of the chosen class (the host creates it when the first input arrives)
export function joinAsGuest(cls, race = 0, pet = 0, weapon = '', power = '', orb = '', relic = '') {
  RG.myCls = cls | 0; RG.myRace = race | 0; RG.myPet = pet | 0; RG.myWid = weapon; RG.myPw = power; RG.myOrb = orb; RG.myRelic = relic
  RG.players = [mkPlayer(cls, 'YOU', false, race, pet)]; RG.pets = []; RG.traps = []; RG.rains = []; RG.meteors = []; RG.me = 0; RG.p = RG.players[0]
  RG.floor = 0; RG.chapter = 1; RG.room = 0; RG.gold = 0; RG.kills = 0; RG.over = null; RG.paused = false; RG.t = 0; RG.fx = []; RG.rk = -1; RG.en = []; RG.eb = []; RG.pb = []; RG.loot = []; RG.obst = []; RG.open = false
  G.mode = 'rogue'; engineEmit(); G.parts = []; G.pops = []
  RG.mode = 'play'; music.set('slugboss', 0); sfx('mission'); emitR()
}
if (typeof window !== 'undefined') { window.__RG = RG; window.__rogue = rogueActions }
games.rogue = {
  update, onKey, draw() {}, stop, sky: () => themeOf().sky,
  draw3: (api) => { RG.cam = rogueCamera(RG, 100 / 56, 0, true); drawRogue3(api, RG, CLASSES) },
  camera: (aspect, dt) => { const c = rogueCamera(RG, aspect, dt); RG.cam = c; return c },
  lights: () => rogueLights(RG),
  fog: () => themeOf(),
}
