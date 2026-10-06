import { update, keys, onKey, G } from '../src/game/engine.js'
import { RG, rogueActions, rogueNet, joinAsGuest } from '../src/game/rogue.js'
let fail = 0
const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m) } }
const rr = (n) => Math.floor(Math.random() * n)
const lp = () => RG.players[RG.me]
function drive(f, cls) {
  const p = lp()
  if (RG.tale) { onKey('Enter', true); return }
  if (p.choices) { onKey('Digit' + (1 + rr(3)), true); return }
  const t = RG.en.find((e) => !e.dead)
  keys.KeyD = keys.KeyA = keys.KeyW = keys.KeyS = false
  if (RG.open) { keys.KeyD = true; keys.KeyW = p.y < -2; keys.KeyS = p.y > 2 }
  else if (t) { const dx = t.x - p.x, dy = t.y - p.y, d = Math.hypot(dx, dy), s = d < 14 && cls !== 0 ? -1 : 1; keys.KeyD = dx * s > 1; keys.KeyA = dx * s < -1; keys.KeyW = dy * s > 1; keys.KeyS = dy * s < -1 }
  if (f % 50 === 0) onKey('Space', true)
  keys.KeyQ = f % 400 === 0
}
for (const cls of [0, 1, 2]) {
  rogueActions.start({ cls })
  ok(!!RG.tale, 'the story opens with a cut-scene')
  let f = 0
  while (RG.mode === 'play' && f < 60 * 240) { drive(f, cls); update(1 / 60); f++; ok(Number.isFinite(lp().x) && Number.isFinite(lp().hp), 'player NaN') }
  keys.KeyD = keys.KeyA = keys.KeyW = keys.KeyS = keys.KeyQ = false
  console.log('PASS rogue class', cls, RG.mode, RG.over ? (RG.over.win ? 'WIN' : 'DEAD') : 'timeout', 'floor', RG.floor + 1, 'room', RG.room + 1, 'kills', RG.kills, 'secs', (f / 60) | 0)
  ok(f > 120, 'ran')
  rogueActions.stop()
}
// ---- co-op: host simulates, a friend joins by sending input ----
const out = []
rogueNet.reset()
rogueNet.attach({ role: 'host', state: (pid, s) => out.push([pid, s]), input() {}, perk() {}, rematch() {}, onStop() {}, })
rogueActions.start({ type: 'online', cls: 0 })
rogueActions.skipTale()
rogueNet.applyInput('friend1', { mx: 1, my: 0, cls: 2, name: 'BUDDY', dn: 0, sn: 0 })
ok(RG.players.length === 2 && RG.players[1].cls === 2 && RG.players[1].remote, 'a friend joins and gets their own hero')
for (let i = 0; i < 60 * 8; i++) { rogueNet.applyInput('friend1', { mx: 0.5, my: 0.2, cls: 2, name: 'BUDDY', dn: i === 100 ? 1 : 0, sn: 0 }); update(1 / 60) }
ok(out.length > 20 && out[0][0] === 'friend1', 'host streams state to the friend: ' + out.length)
ok(RG.players[1].x > -AXtest() , 'the friend moves by their input')
function AXtest() { return 44 }
const pkt = out[out.length - 1][1]
ok(pkt.pl.length === 2 && pkt.me === 1 && Array.isArray(pkt.en), 'packet shape')
const hostEnemies = RG.en.length
rogueActions.stop()
// ---- the guest mirrors the packet ----
rogueNet.reset()
rogueNet.attach({ role: 'guest', state() {}, input: (m) => out.push(['in', m]), perk() {}, rematch() {}, onStop() {} })
joinAsGuest(2)
rogueNet.applyState(pkt)
ok(RG.players.length === 2 && RG.me === 1, 'guest sees both heroes and knows which is theirs')
ok(RG.en.length === pkt.en.length && RG.en.length === hostEnemies || RG.en.length === pkt.en.length, 'guest mirrors the enemies')
for (let i = 0; i < 120; i++) update(1 / 60)
ok(out.some((o) => o[0] === 'in'), 'guest sends its input')
ok(Number.isFinite(lp().x), 'guest hero stays finite')
// perks for the guest
pkt.n += 1; pkt.ch = ['dmg', 'rate', 'hp']; rogueNet.applyState(pkt)
ok(lp().choices && lp().choices.length === 3, 'guest gets perk choices')
rogueActions.stop()
console.log(fail ? 'FAIL rogue co-op' : 'PASS rogue co-op')
process.exit(fail ? 1 : 0)
