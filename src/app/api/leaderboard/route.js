import { NextResponse } from 'next/server'
import { scoresCollection, getRedis, GAMES } from '../../../lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const game = searchParams.get('game') || 'space'
  const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit')) || 10))
  if (!(game in GAMES)) return NextResponse.json({ error: 'unknown game' }, { status: 400 })

  // 1) fast path: Redis sorted set (best score per player name)
  const redis = getRedis()
  if (redis) {
    try {
      const raw = await redis.zrange(`lb:${game}`, 0, limit - 1, { rev: true, withScores: true })
      const top = []
      for (let i = 0; i < raw.length; i += 2) top.push({ name: String(raw[i]), score: Number(raw[i + 1]) })
      if (top.length) return NextResponse.json({ top, source: 'redis' })
    } catch (e) { console.error('redis', e.message) }
  }
  // 2) fallback: MongoDB (also rebuilds the cache)
  try {
    const col = await scoresCollection()
    if (col) {
      const rows = await col.aggregate([
        { $match: { game } }, { $sort: { score: -1 } },
        { $group: { _id: '$name', score: { $max: '$score' } } }, { $sort: { score: -1 } }, { $limit: limit },
      ]).toArray()
      const top = rows.map((r) => ({ name: r._id, score: r.score }))
      if (redis && top.length) { try { await Promise.all(top.map((t) => redis.zadd(`lb:${game}`, { gt: true }, { score: t.score, member: t.name }))) } catch { /* ignore */ } }
      return NextResponse.json({ top, source: 'mongo' })
    }
  } catch (e) { console.error('mongo', e.message) }
  return NextResponse.json({ top: [], source: 'none' })
}
