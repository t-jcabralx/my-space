import { update, keys } from '../src/game/engine.js'
import { RG, rogueActions, CHAPTERS, WEAPONS, POWERS, LORE, weaponOk, powerOk, chapterOk, progress } from '../src/game/rogue.js'
import { profile } from '../src/game/engine.js'
let fail = 0
const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m) } }
const run = (sec) => { for (let i = 0; i < sec * 60 && RG.mode === 'play'; i++) update(1 / 60) }
const me = () => RG.players[RG.me]
ok(CHAPTERS.length === 5 && CHAPTERS.every((c) => c.plan.length === 5 && c.plan[4] === 'boss' && c.intro.length >= 3 && c.beats.length === 4 && c.outro), 'five complete chapters')
ok(LORE.length === 10 && Object.values(WEAPONS).every((l) => l.length === 4) && POWERS.length === 7, 'weapons, powers and lore exist')
ok(chapterOk(1) && !chapterOk(2), 'chapter 2 is locked at first')
ok(weaponOk('knight', 'sword') && !weaponOk('knight', 'ember') && !powerOk('ironskin'), 'weapons and powers start locked')
for (let ch = 1; ch <= 5; ch++) {
  const C = CHAPTERS[ch - 1]
  profile.rogueU = { cleared: 5, secret: {}, lore: {}, wins: {} }
  rogueActions.start({ cls: ch % 3, chapter: ch }); rogueActions.skipTale()
  ok(RG.chapter === ch && me().lv === 1 + 2 * (ch - 1), 'chapter ' + ch + ' starts at the right level ' + me().lv)
  // the rune trial: the pattern is shown, then walking it opens a chest
  const pi = C.plan.indexOf('puzzle'); rogueActions.jump(pi); rogueActions.skipTale()
  ok(RG.puz && RG.rtype === 'puzzle' && RG.ax < 90, 'ch' + ch + ' puzzle room')
  run(14)
  ok(RG.puz && !RG.puz.showing, 'ch' + ch + ' pattern finished showing')
  const z = RG.puz; const seq = z.seq.slice()
  for (const i of seq) { me().x = z.runes[i].x; me().y = z.runes[i].y; run(0.4); me().x = -30; me().y = -20; run(0.6) }
  ok(z.solved && RG.open && RG.chests.length === 1, 'ch' + ch + ' puzzle solved: ' + z.step + '/' + seq.length)
  me().x = RG.chests[0].x; me().y = RG.chests[0].y; run(0.5)
  ok(RG.chests[0].open && (RG.found.lore.includes('L' + ch + 'a') || me().choices || true), 'ch' + ch + ' chest opens')
  ok(profile.rogueU.lore['L' + ch + 'a'], 'ch' + ch + ' lore tablet saved')
  // a wrong rune resets and punishes
  rogueActions.jump(pi); rogueActions.skipTale(); run(14)
  const z2 = RG.puz, wrong = z2.seq[0] === 0 ? 1 : 0
  me().x = z2.runes[wrong].x; me().y = z2.runes[wrong].y; run(0.3)
  ok(z2.step === 0 && z2.fails === 1 && z2.showing, 'ch' + ch + ' wrong rune replays the pattern')
  // treasure room if the chapter has one
  const ti = C.plan.indexOf('treasure')
  if (ti >= 0) { rogueActions.jump(ti); rogueActions.skipTale(); ok(RG.open && RG.chests.length === 1 && RG.ax < 60, 'ch' + ch + ' treasure room is small and open'); me().x = RG.chests[0].x; me().y = 0; const g0 = RG.gold; run(0.5); ok(RG.gold > g0, 'treasure pays gold') }
  // the hidden passage: break the cracked wall, step in, clear the vault, open the chest
  rogueActions.jump(C.secretRoom - 1); rogueActions.skipTale()
  ok(RG.secret && !RG.secret.found, 'ch' + ch + ' has a hidden passage in room ' + C.secretRoom)
  RG.en = []; RG.spawnQ = []; run(0.5); rogueActions.skipTale()
  ok(RG.open, 'room clear opens the way ' + RG.mode + ' ' + RG.rtype + ' tale ' + !!RG.tale + ' alive ' + me().alive + ' en ' + RG.en.length + ' sq ' + RG.spawnQ.length)
  for (let k = 0; k < 8; k++) RG.pb.push({ x: RG.secret.x, y: RG.secret.y - 1, vx: 0, vy: 1, dmg: 1, pierce: 0, life: 1, c: '#fff', hit: new Set(), by: me() }), run(0.1)
  ok(RG.secret.found, 'cracked wall breaks after hits')
  for (const p of RG.players) p.choices = null
  me().x = RG.secret.x; me().y = RG.secret.y - 2.5; run(0.3); rogueActions.skipTale()
  ok(RG.sub === 'secret' && RG.rtype === 'secret', 'portal leads to the hidden vault')
  for (const e of RG.en) e.hp = 0.01; RG.spawnQ.forEach((q) => { q.t = 0 }); run(1); for (let i = 0; i < 4; i++) { for (const e of RG.en) { e.spawnT = 0; e.hp = 0.01; e.def.r = 99 } me().x = 0; me().y = 0; for (const p of RG.pb) void p; run(0.3) }
  RG.en = []; RG.spawnQ = []; run(0.3); rogueActions.skipTale(); run(0.3)
  ok(RG.chests.some((c) => c.kind === 'vault'), 'vault chest appears after the fight')
  const vc = RG.chests.find((c) => c.kind === 'vault'); me().x = vc.x; me().y = vc.y; run(0.5)
  ok(profile.rogueU.secret[ch], 'secret of chapter ' + ch + ' recorded')
  ok(profile.rogueU.lore['L' + ch + 'b'], 'vault lore tablet recorded')
  // the boss
  rogueActions.jump(4); rogueActions.skipTale()
  const boss = RG.spawnQ[0]
  ok(boss && boss.type === C.boss, 'ch' + ch + ' boss is ' + C.boss)
  me().hp = 999; me().max = 999; me().inv = 99999
  for (let i = 0; i < 20 * 60 && RG.mode === 'play'; i++) { update(1 / 60); if (i % 5 === 0) { const e = RG.en[0]; if (e) { me().x = e.x - 6; me().y = e.y } } ok(RG.players[0].x === RG.players[0].x, 'finite') }
  for (const e of RG.en) { e.hp = 0 }
  run(1)
  const sp = RG.spawnQ.length; void sp
  ok(RG.en.every((e) => Number.isFinite(e.x) && Number.isFinite(e.y)), 'boss stays finite')
  rogueActions.stop()
}
// persistence and unlocks
profile.rogueU = { cleared: 0, secret: {}, lore: {}, wins: {} }
rogueActions.start({ cls: 0, chapter: 1 }); rogueActions.skipTale(); rogueActions.jump(4); rogueActions.skipTale()
me().hp = 999; me().max = 999; me().inv = 99999; RG.spawnQ.forEach((q) => { q.t = 0 }); run(2)
for (const e of RG.en) e.dead = true; run(1)
ok(RG.mode === 'over' && RG.over.win && profile.rogueU.cleared === 1, 'clearing chapter 1 saves progress: ' + RG.mode)
ok(chapterOk(2) && weaponOk('knight', 'ember') && powerOk('ironskin'), 'clearing chapter 1 unlocks chapter 2, a weapon and a power')
ok(RG.over.unlocks.some((u) => /EMBER BLADE/.test(u)) && RG.over.next, 'the end screen announces the unlocks')
// weapon effects
rogueActions.start({ cls: 0, chapter: 1, weapon: 'ember', power: 'ironskin' }); rogueActions.skipTale()
ok(me().wid === 'ember' && me().armor >= 0.15 && me().wmod.burn === 3, 'weapon and power are applied')
RG.spawnQ.forEach((q) => { q.t = 0 }); run(1.5)
const t = RG.en[0]; if (t) { me().x = t.x - 3; me().y = t.y; me().aimPt = { x: t.x, y: t.y }; me().holdPtr = true; me().aimT = 1e9; run(1.5); ok(!!t.burn || t.hp < t.max || t.dead, 'ember blade burns') }
rogueActions.stop()
console.log(fail ? 'FAIL rogue2' : 'PASS rogue chapters, puzzles, secrets and unlocks')
process.exit(fail ? 1 : 0)
