import Link from 'next/link'
import { GAMES, SITE, SITE_NAME } from '../../lib/seo'

export const metadata = {
  title: 'All games: free online browser games to play with friends',
  description: 'Every game in My Space Arcade: FLAMES, racing, fighting, snowboarding, card games, strategy, puzzles and more. Free, no download, multiplayer.',
  alternates: { canonical: '/games' },
}
export default function GamesIndex() {
  const ld = { '@context': 'https://schema.org', '@type': 'ItemList', name: `${SITE_NAME} games`, itemListElement: GAMES.map((g, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE}/games/${g.slug}`, name: g.name })) }
  return (
    <main className="seo-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <header><Link href="/" className="seo-play">▶ PLAY NOW</Link><h1>{SITE_NAME}: free online games</h1><p>{GAMES.length} games in your browser. No download, works on phones and computers, and most of them play online with friends.</p></header>
      <div className="seo-grid">
        {GAMES.map((g) => (
          <Link key={g.slug} href={`/games/${g.slug}`} className="seo-card"><b>{g.name}</b><small>{g.genre}</small><span>{g.tag}</span></Link>
        ))}
      </div>
    </main>
  )
}
