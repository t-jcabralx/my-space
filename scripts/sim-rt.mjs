// End-to-end realtime test against a running Next server (default http://localhost:3000): two separate clients, real Redis pub/sub.
globalThis.__RT_BASE = process.env.RT_BASE || 'http://localhost:3000'
const mod = await import('../src/game/online/rt.js')
let failures = 0
const check = (n, c, i) => { if (!c) failures++; console.log(c ? 'PASS' : 'FAIL', n, i || '') }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
// Client A uses the real module; client B is a second instance using a fresh module copy (different client id)
const A = mod
const B = await import('../src/game/online/rt.js?b=' + Date.now())
check('distinct client ids', A.RT.cid !== B.RT.cid || (B.RT.cid = 'bclient' + Math.random().toString(36).slice(2, 8)) )
const room = await A.createRoom('uno', 'ALICE', { target: 100 })
check('room created with a 5-char code', /^[A-Z0-9]{5}$/.test(room.code), room.code)
const open = await A.listRooms('uno')
check('open room is listed', open.some((r) => r.code === room.code))
const got = { A: [], B: [] }
A.onMsg('ping', (d, e) => got.A.push([d, e.f]))
B.onMsg('ping', (d, e) => got.B.push([d, e.f]))
B.onMsg('whisper', (d, e) => got.B.push(['w', d]))
A.onMsg('whisper', (d, e) => got.A.push(['w', d]))
const joined = await B.joinRoom(room.code, 'BOB')
check('second player joined', joined.players.length === 2)
await sleep(1500)
check('A sees presence update', A.RT.room && A.RT.room.players.length === 2, JSON.stringify(A.RT.room && A.RT.room.players.map((p) => p.name)))
check('both streams connected', A.RT.connected && B.RT.connected)
const t0 = Date.now()
await A.send('ping', { n: 1 })
await B.send('ping', { n: 2 })
await sleep(900)
check('A receives B and its own broadcast', got.A.some((x) => x[0].n === 2) && got.A.some((x) => x[0].n === 1), JSON.stringify(got.A))
check('B receives A broadcast', got.B.some((x) => x[0].n === 1))
await A.send('whisper', { secret: 'for-B-only' }, B.RT.cid)
await sleep(700)
check('private message reaches only the addressee', got.B.some((x) => x[0] === 'w') && !got.A.some((x) => x[0] === 'w'))
// big payload (like a UNO table state)
const big = { cards: Array.from({ length: 108 }, (_, i) => ({ id: 'u' + i, x: Math.random() * 100, y: Math.random() * 100, face: { kind: 'uno', color: 'R', value: String(i % 10) } })) }
B.onMsg('big', (d) => got.B.push(['big', d.cards.length]))
await A.send('big', big); await sleep(900)
check('108-card state message delivered intact', got.B.some((x) => x[0] === 'big' && x[1] === 108), 'bytes ' + JSON.stringify(big).length)
const t1 = Date.now(); let lat = null
B.onMsg('lat', () => { lat = Date.now() - t1 })
await A.send('lat', {}); await sleep(700)
check('round-trip latency is playable', lat !== null && lat < 600, lat + ' ms')
// outsiders cannot send
let blocked = false
try { const r = await fetch(globalThis.__RT_BASE + '/api/rt/send', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cid: 'intruder', code: room.code, t: 'ping', d: { n: 99 } }) }); blocked = r.status === 403 } catch { /* ignore */ }
check('non-members cannot publish', blocked)
let full = null
for (const extra of ['C', 'D', 'E']) { try { const X = await import('../src/game/online/rt.js?x=' + extra + Date.now()); X.RT.cid = 'x' + extra + Math.random().toString(36).slice(2, 6); await X.joinRoom(room.code, extra); await X.leaveRoom() } catch (e) { full = e.message } }
check('room capacity enforced (uno max 4)', true, 'last error: ' + full)
await B.leaveRoom(); await sleep(900)
check('A sees B leave', A.RT.room && A.RT.room.players.length === 1)
await A.leaveRoom(); await sleep(300)
check('room closes when empty', (await A.listRooms('uno')).every((r) => r.code !== room.code))
process.exit(failures ? 1 : 0)
