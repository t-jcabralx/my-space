// Global leaderboard client. Talks to the Next.js API routes (/api/score, /api/leaderboard).
// Fails soft: if the API is not there (plain Vite dev) everything just returns empty.
export async function submitScore(game, name, score, extra = {}) {
  try {
    const r = await fetch('/api/score', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ game, name, score, extra }) })
    return r.ok ? await r.json() : null
  } catch { return null }
}
export async function fetchTop(game, limit = 10) {
  try {
    const r = await fetch(`/api/leaderboard?game=${encodeURIComponent(game)}&limit=${limit}`, { cache: 'no-store' })
    if (!r.ok) return []
    const j = await r.json()
    return j.top || []
  } catch { return [] }
}
