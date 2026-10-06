import { update, G, keys, profile, startGame, setSquad } from '../src/game/engine.js'
let failures = 0
const check = (n, c, i) => { if (!c) failures++; console.log(c ? 'PASS' : 'FAIL', n, i || '') }
const run = (secs, drive) => { for (let i = 0; i < 60 * secs; i++) { if (drive) drive(i); update(1 / 60) } }
setSquad(2, false); startGame(); run(1)
check('default: no teammates until friends join (AI is opt-in)', G.squad.length === 0, G.squad.length)
setSquad(2, false, true); startGame(); run(4)
check('trio: 3 spacecraft (you + 2 teammates)', G.squad.length === 2 && G.squad.every((m) => m.alive))
check('teammates use different ships from the leader', new Set([profile.ship.model, ...G.squad.map((m) => m.model)]).size === 3)
const before = G.stats.kills
run(40, () => { keys.Space = true })
check('the squad fights: enemies destroyed', G.stats.kills > before, 'kills ' + G.stats.kills)
setSquad(2, false, true); startGame(); run(3) // a fresh mission: the long run above may already have cleared level 1
const m = G.squad[0]
G.p.shieldT = 0; G.p.skT = 0; m.hp = 1; m.inv = 0; G.ebul.push({ x: m.x + 0.5, y: m.y, vx: -10, vy: 0, hw: 1, hh: 1, spr: null, dmg: 1 })
update(1 / 60)
check('a teammate can be shot down', !m.alive && m.respawn > 0, 'alive ' + m.alive)
run(11)
check('and comes back after the respawn timer', m.alive && m.hp === m.maxHp)
setSquad(0, false, true); startGame(); run(1)
check('solo: no teammates', G.squad.length === 0)
setSquad(2, true, true); startGame(); run(1)
check('P2 human flag set for ship #2', G.squad[0].human === true && G.squad[1].human === false)
const x0 = G.squad[0].x; keys.ArrowUp = true; run(1); keys.ArrowUp = false
check('P2 steers with the arrow keys', G.squad[0].y > 5, 'y ' + G.squad[0].y.toFixed(1))
const lead = G.p.y; keys.ArrowDown = true; run(0.5); keys.ArrowDown = false
check('P1 ignores arrows when P2 is human', Math.abs(G.p.y - lead) < 0.5, 'dy ' + Math.abs(G.p.y - lead).toFixed(2))
void x0
process.exit(failures ? 1 : 0)
