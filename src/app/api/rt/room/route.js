import { NextResponse } from 'next/server'
import { signTok, getRedis, GAME_MAX, newCode, cleanName, cleanCid, cleanCode, loadRoom, saveRoom, publicRoom, publishTo, chan, roomKey } from '../../../../lib/rt'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const err = (m, s = 400) => NextResponse.json({ error: m }, { status: s })

export async function POST(req) {
  const redis = getRedis()
  if (!redis) return err('Realtime needs UPSTASH_REDIS_REST_URL / TOKEN to be configured', 503)
  let b
  try { b = await req.json() } catch { return err('bad json') }
  const cid = cleanCid(b.cid), name = cleanName(b.name)
  if (!cid) return err('missing client id')
  const act = String(b.action || '')
  try {
    if (act === 'list') {
      const codes = (await redis.smembers('rooms:open')) || []
      const rooms = []
      for (const c of codes) {
        const r = await loadRoom(redis, c)
        if (!r || r.status !== 'open' || Date.now() - r.updated > 30 * 60 * 1000) { await redis.srem('rooms:open', c); continue }
        if (b.game && r.game !== b.game) continue
        rooms.push(publicRoom(r))
      }
      return NextResponse.json({ rooms })
    }
    if (act === 'create') {
      const game = String(b.game || '')
      if (!(game in GAME_MAX)) return err('unknown game')
      let code = newCode()
      for (let i = 0; i < 5 && (await loadRoom(redis, code)); i++) code = newCode()
      const room = { code, game, host: cid, status: 'open', max: GAME_MAX[game], opts: b.opts && typeof b.opts === 'object' ? b.opts : {}, players: [{ id: cid, name }], created: Date.now() }
      await saveRoom(redis, room)
      await redis.sadd('rooms:open', code)
      return NextResponse.json({ room: publicRoom(room), tok: signTok(code, cid) })
    }
    const code = cleanCode(b.code)
    const room = code ? await loadRoom(redis, code) : null
    if (!room) return err('Room not found (it may have closed)', 404)
    const me = room.players.find((p) => p.id === cid)
    if (act === 'join') {
      if (!me) {
        if (room.status !== 'open') return err('That game already started', 409)
        if (room.players.length >= room.max) return err('Room is full', 409)
        room.players.push({ id: cid, name })
        await saveRoom(redis, room)
        await publishTo(redis, chan(code), { t: 'presence', f: 'srv', d: publicRoom(room) })
      }
      return NextResponse.json({ room: publicRoom(room), tok: signTok(code, cid) })
    }
    if (!me) return err('You are not in that room', 403)
    if (act === 'leave') {
      room.players = room.players.filter((p) => p.id !== cid)
      if (!room.players.length) { await redis.del(roomKey(code)); await redis.srem('rooms:open', code); return NextResponse.json({ closed: true }) }
      if (room.host === cid) room.host = room.players[0].id
      await saveRoom(redis, room)
      await publishTo(redis, chan(code), { t: 'presence', f: 'srv', d: publicRoom(room), left: cid })
      return NextResponse.json({ ok: true })
    }
    if (act === 'start' || act === 'finish') {
      if (room.host !== cid) return err('Only the host can do that', 403)
      room.status = act === 'start' ? 'playing' : 'open'
      if (b.opts && typeof b.opts === 'object') room.opts = b.opts
      await saveRoom(redis, room)
      if (room.status === 'open') await redis.sadd('rooms:open', code); else await redis.srem('rooms:open', code)
      await publishTo(redis, chan(code), { t: 'presence', f: 'srv', d: publicRoom(room) })
      return NextResponse.json({ room: publicRoom(room) })
    }
    if (act === 'rename') { me.name = name; await saveRoom(redis, room); await publishTo(redis, chan(code), { t: 'presence', f: 'srv', d: publicRoom(room) }); return NextResponse.json({ ok: true }) }
    return err('unknown action')
  } catch (e) { console.error('rt room', e.message); return err('server error', 500) }
}
