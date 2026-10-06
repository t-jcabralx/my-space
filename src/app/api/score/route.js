import { NextResponse } from 'next/server'
import { scoresCollection, getRedis, GAMES, cleanName } from '../../../lib/db'

export const runtime = 'nodejs'

export async function POST(req) {
  let body
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }) }
  const game = String(body.game || '')
  const score = Math.floor(Number(body.score))
  if (!(game in GAMES) || !Number.isFinite(score) || score <= 0 || score > GAMES[game]) return NextResponse.json({ error: 'invalid score' }, { status: 400 })
  const name = cleanName(body.name)
  const redis = getRedis()

  // tiny rate limit: 30 submissions / minute / IP
  if (redis) {
    const ip = (req.headers.get('x-forwarded-for') || 'local').split(',')[0].trim()
    const key = `rl:${ip}:${Math.floor(Date.now() / 60000)}`
    try { const n = await redis.incr(key); if (n === 1) await redis.expire(key, 70); if (n > 30) return NextResponse.json({ error: 'slow down' }, { status: 429 }) } catch { /* ignore */ }
  }
  let saved = { redis: false, mongo: false }
  if (redis) {
    try { await redis.zadd(`lb:${game}`, { gt: true }, { score, member: name }); saved.redis = true } catch (e) { console.error('redis', e.message) }
  }
  try {
    const col = await scoresCollection()
    if (col) { await col.insertOne({ game, name, score, extra: body.extra && typeof body.extra === 'object' ? body.extra : {}, at: new Date() }); saved.mongo = true }
  } catch (e) { console.error('mongo', e.message) }
  return NextResponse.json({ ok: saved.redis || saved.mongo, saved })
}
