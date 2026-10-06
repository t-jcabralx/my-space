import { MongoClient } from 'mongodb'
import { Redis } from '@upstash/redis'

// Credentials come from environment variables (.env.local locally, project settings in production). Never hard-code them.
let mongoPromise = null
export function getMongo() {
  if (!process.env.MONGODB_URI) return null
  if (!globalThis._mongoPromise) globalThis._mongoPromise = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 6000 }).connect()
  mongoPromise = globalThis._mongoPromise
  return mongoPromise
}
export async function scoresCollection() {
  const c = await getMongo()
  if (!c) return null
  const col = c.db(process.env.MONGODB_DB || 'myspace').collection('scores')
  if (!globalThis._idx) { globalThis._idx = true; col.createIndex({ game: 1, score: -1 }).catch(() => {}) }
  return col
}
export function getRedis() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null
  return new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN })
}
export const GAMES = { space: 6_000_000, slug: 1_000_000, pickle: 5_000, bomber: 100_000 } // max plausible score per game
export const cleanName = (n) => String(n || '').replace(/[^\w .-]/g, '').trim().slice(0, 14) || 'ANON'
