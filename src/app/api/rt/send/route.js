import { NextResponse } from 'next/server'
import { getRedis, cleanCid, cleanCode, publishTo, chan, privChan, verifyTok, rateLocal } from '../../../../lib/rt'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req) {
  const redis = getRedis()
  if (!redis) return NextResponse.json({ error: 'realtime not configured' }, { status: 503 })
  let b
  try { b = await req.json() } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }) }
  const cid = cleanCid(b.cid), code = cleanCode(b.code), type = String(b.t || '').slice(0, 24)
  if (!cid || !code || !type) return NextResponse.json({ error: 'missing fields' }, { status: 400 })
  const payload = JSON.stringify(b.d ?? null)
  if (payload.length > 400_000) return NextResponse.json({ error: 'message too large' }, { status: 413 })
  if (!verifyTok(code, cid, b.tok)) return NextResponse.json({ error: 'not in room' }, { status: 403 })
  if (!rateLocal(cid)) return NextResponse.json({ error: 'slow down' }, { status: 429 })
  try {
    const to = b.to ? cleanCid(b.to) : null
    const env = { t: type, f: cid, d: b.d ?? null, ts: Date.now() }
    if (to) env.to = to
    const n = await publishTo(redis, to ? privChan(code, to) : chan(code), env)
    return NextResponse.json({ ok: true, receivers: n })
  } catch (e) { console.error('rt send', e.message); return NextResponse.json({ error: 'server error' }, { status: 500 }) }
}
