import { NextResponse } from 'next/server'
import { getMongo, getRedis } from '../../../lib/db'

export const runtime = 'nodejs'

const ID = /^MS-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/
const MAX = 90000
const hasStore = () => !!(getRedis() || process.env.MONGODB_URI)

async function limited(req, kind, max) {
  const redis = getRedis(); if (!redis) return false
  const ip = (req.headers.get('x-forwarded-for') || 'local').split(',')[0].trim()
  const key = `rl:${kind}:${ip}:${Math.floor(Date.now() / 60000)}`
  try { const n = await redis.incr(key); if (n === 1) await redis.expire(key, 70); return n > max } catch { return false }
}

// save a player's game data under their anonymous ID
export async function POST(req) {
  let body
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }) }
  const uid = String(body.uid || '')
  if (!ID.test(uid) || !body.data || typeof body.data !== 'object' || Array.isArray(body.data)) return NextResponse.json({ error: 'invalid' }, { status: 400 })
  const text = JSON.stringify(body.data)
  if (text.length > MAX) return NextResponse.json({ error: 'too big' }, { status: 413 })
  if (await limited(req, 'psave', 20)) return NextResponse.json({ error: 'slow down' }, { status: 429 })
  const doc = { ...body.data, uid }
  let saved = { redis: false, mongo: false }
  const redis = getRedis()
  if (redis) { try { await redis.set(`player:${uid}`, JSON.stringify(doc)); saved.redis = true } catch (e) { console.error('redis', e.message) } }
  try {
    const c = await getMongo()
    if (c) { await c.db(process.env.MONGODB_DB || 'myspace').collection('players').updateOne({ uid }, { $set: { uid, data: doc, at: new Date() } }, { upsert: true }); saved.mongo = true }
  } catch (e) { console.error('mongo', e.message) }
  return NextResponse.json({ ok: saved.redis || saved.mongo, saved, configured: hasStore() })
}

// load it back (the ID is the key: it is long and random, so only the owner knows it)
export async function GET(req) {
  const uid = new URL(req.url).searchParams.get('uid') || ''
  if (!ID.test(uid)) return NextResponse.json({ error: 'invalid' }, { status: 400 })
  if (await limited(req, 'pget', 20)) return NextResponse.json({ error: 'slow down' }, { status: 429 })
  const redis = getRedis()
  if (redis) { try { const v = await redis.get(`player:${uid}`); if (v) return NextResponse.json({ data: typeof v === 'string' ? JSON.parse(v) : v }) } catch (e) { console.error('redis', e.message) } }
  try {
    const c = await getMongo()
    if (c) { const d = await c.db(process.env.MONGODB_DB || 'myspace').collection('players').findOne({ uid }); if (d && d.data) return NextResponse.json({ data: d.data }) }
  } catch (e) { console.error('mongo', e.message) }
  return NextResponse.json({ error: 'not found' }, { status: 404 })
}
