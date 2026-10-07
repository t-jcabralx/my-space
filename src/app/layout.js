import './globals.css'
import Link from 'next/link'
import { SITE, SITE_NAME, SITE_DESC, SITE_KEYWORDS, GAMES } from '../lib/seo'

export const metadata = {
  metadataBase: new URL(SITE),
  title: { default: `${SITE_NAME}: 30+ free online games to play with friends (FLAMES, racing, fighting and more)`, template: `%s | ${SITE_NAME}` },
  description: SITE_DESC,
  keywords: SITE_KEYWORDS,
  applicationName: SITE_NAME,
  alternates: { canonical: '/' },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
  openGraph: { type: 'website', siteName: SITE_NAME, title: `${SITE_NAME}: free online games with friends`, description: SITE_DESC, url: '/' },
  twitter: { card: 'summary_large_image', title: `${SITE_NAME}: free online games with friends`, description: SITE_DESC },
  category: 'games',
}
export const viewport = { width: 'device-width', initialScale: 1, maximumScale: 1, userScalable: false }

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet" />
      </head>
      <body>
        {children}
        {/* crawlable site map for search engines and screen readers (the game itself is a canvas app) */}
        <nav className="sr-only" aria-label="All games">
          <h2>{SITE_NAME} games</h2>
          <ul>{GAMES.map((g) => <li key={g.slug}><Link href={`/games/${g.slug}`}>{g.name}: {g.tag}</Link></li>)}</ul>
        </nav>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'WebSite', name: SITE_NAME, url: SITE, description: SITE_DESC, inLanguage: 'en', potentialAction: { '@type': 'SearchAction', target: `${SITE}/games?q={search_term_string}`, 'query-input': 'required name=search_term_string' } }) }} />
      </body>
    </html>
  )
}
