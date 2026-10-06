import { getRedis, cleanCid, cleanCode, verifyTok, chan, privChan } from '../../../../lib/rt'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Server-Sent Events bridge: Upstash pub/sub (SUBSCRIBE over REST) -> browser. The client auto-reconnects.
export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const cid = cleanCid(searchParams.get('cid')), code = cleanCode(searchParams.get('code'))
  const redis = getRedis()
  if (!redis) return new Response('realtime not configured', { status: 503 })
  if (!cid || !code || !verifyTok(code, cid, searchParams.get('tok'))) return new Response('not in room', { status: 403 })

  const ac = new AbortController()
  req.signal.addEventListener('abort', () => ac.abort())
  const base = process.env.UPSTASH_REDIS_REST_URL
  let upstream
  try {
    upstream = await fetch(`${base}/subscribe/${encodeURIComponent(chan(code))}/${encodeURIComponent(privChan(code, cid))}`, {
      headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`, Accept: 'text/event-stream' }, signal: ac.signal, cache: 'no-store',
    })
  } catch { return new Response('upstream failed', { status: 502 }) }
  if (!upstream.ok || !upstream.body) return new Response('upstream error', { status: 502 })

  const enc = new TextEncoder(), dec = new TextDecoder()
  let hb
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(enc.encode('retry: 1500\n\n'))
      hb = setInterval(() => { try { controller.enqueue(enc.encode(': hb\n\n')) } catch { /* closed */ } }, 12000)
      const reader = upstream.body.getReader()
      let buf = ''
      try {
        for (;;) {
          const { value, done } = await reader.read()
          if (done) break
          buf += dec.decode(value, { stream: true })
          let i
          while ((i = buf.indexOf('\n\n')) >= 0) {
            const frame = buf.slice(0, i); buf = buf.slice(i + 2)
            if (!frame.startsWith('data: ')) continue
            const p = frame.slice(6)
            const a = p.indexOf(','), b2 = p.indexOf(',', a + 1)
            if (a < 0 || b2 < 0 || p.slice(0, a) !== 'message') continue // skip the "subscribe" acks
            controller.enqueue(enc.encode(`data: ${p.slice(b2 + 1)}\n\n`))
          }
        }
      } catch { /* aborted */ }
      clearInterval(hb)
      try { controller.close() } catch { /* closed */ }
    },
    cancel() { clearInterval(hb); ac.abort() },
  })
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' } })
}
