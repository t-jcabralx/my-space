import { SITE, GAMES } from '../lib/seo'
export default function sitemap() {
  const now = new Date()
  return [
    { url: SITE, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE}/games`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    ...GAMES.map((g) => ({ url: `${SITE}/games/${g.slug}`, lastModified: now, changeFrequency: 'monthly', priority: g.slug === 'flames' ? 0.95 : 0.7 })),
  ]
}
