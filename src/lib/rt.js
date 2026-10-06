// Realtime helpers: rooms live in Redis; messages travel over Redis pub/sub. No separate server.
import { createHmac, timingSafeEqual } from 'node:crypto'
import { getRedis } from './db'

export const GAME_MAX = { race: 4, fight: 2, space: 3, pickle: 2, bomber: 4, tetris: 2, hockey: 2, pool: 2, rogue: 3, uno: 4, pusoy: 4, lucky9: 4, tongits: 3 }
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const roomKey = (code) => `room:${code}`
export const chan = (code) => `rt:${code}`
export const privChan = (code, cid) => `rt:${code}:${cid}`
export const cleanName = (n) => String(n || '').replace(/[^\w .-]/g, '').trim().slice(0, 14) || 'PLAYER'
export const cleanCid = (c) => String(c || '').replace(/[^\w-]/g, '').slice(0, 40)
export const cleanCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5)
export const newCode = () => Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('')
export const ROOM_TTL = 7200

export async function loadRoom(redis, code) {
  const r = await redis.get(roomKey(code))
  return r && typeof r === 'object' ? r : null
}
export async function saveRoom(redis, room) {
  room.updated = Date.now()
  await redis.set(roomKey(room.code), room, { ex: ROOM_TTL })
}
export const publicRoom = (r) => ({ code: r.code, game: r.game, host: r.host, status: r.status, max: r.max, opts: r.opts || {}, players: r.players.map((p) => ({ id: p.id, name: p.name })) })
export async function publishTo(redis, channel, env) { return redis.publish(channel, JSON.stringify(env)) }
// Signed membership token: lets /send and /stream authorize without a Redis read (saves a ~250ms round trip).
const secret = () => process.env.RT_SECRET || process.env.UPSTASH_REDIS_REST_TOKEN || 'dev-secret'
export const signTok = (code, cid) => createHmac('sha256', secret()).update(`${code}:${cid}`).digest('hex').slice(0, 32)
export function verifyTok(code, cid, tok) {
  try { const a = Buffer.from(signTok(code, cid)), b = Buffer.from(String(tok || '')); return a.length === b.length && timingSafeEqual(a, b) } catch { return false }
}
const hits = new Map()
export function rateLocal(cid, perSecond = 80) {
  const k = cid + ':' + Math.floor(Date.now() / 1000)
  const n = (hits.get(k) || 0) + 1
  hits.set(k, n)
  if (hits.size > 5000) for (const key of hits.keys()) { if (!key.endsWith(String(Math.floor(Date.now() / 1000)))) hits.delete(key) }
  return n <= perSecond
}
export async function rateOk(redis, cid, perSecond = 60) {
  const k = `rl:rt:${cid}:${Math.floor(Date.now() / 1000)}`
  const n = await redis.incr(k)
  if (n === 1) await redis.expire(k, 3)
  return n <= perSecond
}
export { getRedis }
