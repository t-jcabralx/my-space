// Guards the dashboard lobbies: every offline mode must have an icon (a missing one crashed the Pickleball/Bomber tabs).
import fs from 'node:fs'
import { MODES as PM } from '../src/game/pickle.js'
import { MODES as BM } from '../src/game/bomber.js'
import { MODES as TM } from '../src/game/tetris.js'
let failures = 0
const check = (n, c, i) => { if (!c) failures++; console.log(c ? 'PASS' : 'FAIL', n, i || '') }
const src = fs.readFileSync(new URL('../src/ui/HUD.jsx', import.meta.url), 'utf8')
const keysOf = (name) => { const m = new RegExp(`const ${name} = \\{([^\\n]*)\\}`).exec(src); if (!m) return null; return [...m[1].matchAll(/([a-z0-9_]+):\s*\[/gi)].map((x) => x[1]) }
for (const [name, modes, icon] of [['pickleball', PM, 'MODE_ICON'], ['bomber', BM, 'BMODE_ICON']]) {
  const ks = keysOf(icon)
  check(`${name}: icon map found`, !!ks)
  const missing = Object.entries(modes).filter(([k, m]) => !m.online && ks && !ks.includes(k)).map(([k]) => k)
  check(`${name}: every offline mode has a lobby icon`, missing.length === 0, missing.join(','))
  check(`${name}: lobby hides online-only modes`, new RegExp(`Object.entries\\(${name === 'bomber' ? 'BMODES' : 'MODES'}\\)\\.filter\\(\\(\\[, md\\]\\) => !md\\.online\\)`).test(src))
}
const grouped = /GROUPS = \[([\s\S]*?)\]\s*\n/.exec(src)
check('tetris: lobby uses explicit mode groups (online mode not listed)', !!grouped && !/online/.test(grouped[1]))
void TM
process.exit(failures ? 1 : 0)
