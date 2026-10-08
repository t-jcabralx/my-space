import Link from 'next/link'
import { GAME_ART } from '../../../game/branding.js'
import { notFound } from 'next/navigation'
import { GAMES, bySlug, SITE, SITE_NAME, FLAMES_FAQ } from '../../../lib/seo'

export const dynamicParams = false
export function generateStaticParams() { return GAMES.map((g) => ({ slug: g.slug })) }
export async function generateMetadata({ params }) {
  const { slug } = await params
  const g = bySlug(slug)
  if (!g) return {}
  const title = g.slug === 'flames' ? 'FLAMES game online: Friends, Lovers, Affection, Marriage, Enemies, Siblings (free)' : `${g.name}: free online ${g.genre.toLowerCase()} game`
  const cover=GAME_ART[g.tab]?.covers[0]
  const images=cover?[{url:cover.src,width:768,height:768,alt:g.name}]:undefined
  return {
    title, description: g.desc, keywords: g.keys, alternates: { canonical: `/games/${g.slug}` },
    openGraph: { title, description: g.desc, url: `/games/${g.slug}`, siteName: SITE_NAME, type: 'website', ...(images?{images}:{}) },
    twitter: { card: 'summary_large_image', title, description: g.desc, ...(images?{images}:{}) },
  }
}
export default async function GamePage({ params }) {
  const { slug } = await params
  const g = bySlug(slug)
  if (!g) notFound()
  const url = `${SITE}/games/${g.slug}`
  const ld = [
    { '@context': 'https://schema.org', '@type': 'VideoGame', name: g.name, description: g.desc, url, genre: g.genre, gamePlatform: ['Web browser', 'Mobile web'], applicationCategory: 'Game', operatingSystem: 'Any', playMode: g.multi ? ['SinglePlayer', 'MultiPlayer'] : 'SinglePlayer', inLanguage: 'en', isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, publisher: { '@type': 'Organization', name: SITE_NAME } },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: SITE_NAME, item: SITE }, { '@type': 'ListItem', position: 2, name: 'Games', item: `${SITE}/games` }, { '@type': 'ListItem', position: 3, name: g.name, item: url }] },
  ]
  if (g.slug === 'flames') ld.push({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FLAMES_FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) })
  const others = GAMES.filter((x) => x.slug !== g.slug).slice(0, 8)
  return (
    <main className="seo-page">
      {ld.map((o, i) => <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(o) }} />)}
      <nav className="seo-crumbs"><Link href="/">{SITE_NAME}</Link> › <Link href="/games">Games</Link> › {g.name}</nav>
      <header>
        {GAME_ART[g.tab]&&<img className="seo-game-cover" src={GAME_ART[g.tab].covers[0].src} alt={g.name+" cover artwork"} width="768" height="768"/>}
        <Link href={`/?play=${g.slug}`} className="seo-play">▶ PLAY {g.name.split(':')[0].toUpperCase()} NOW (FREE)</Link>
        <h1>{g.slug === 'flames' ? 'FLAMES game online: find out if you are Friends, Lovers, Affection, Marriage, Enemies or Siblings' : `${g.name}: free online ${g.genre.toLowerCase()} game`}</h1>
        <p className="seo-lead">{g.desc}</p>
      </header>
      {g.slug === 'flames' && (
        <>
          <section>
            <h2>How the FLAMES game works</h2>
            <ol>
              <li>Enter two names.</li>
              <li>Cross out every letter the two names share.</li>
              <li>Count the letters that are left.</li>
              <li>Count around the word <b>F-L-A-M-E-S</b> by that number, crossing out a letter each time, until only one letter remains.</li>
              <li>That letter is the answer: <b>F</b>riends, <b>L</b>overs, <b>A</b>ffection, <b>M</b>arriage, <b>E</b>nemies or <b>S</b>iblings.</li>
            </ol>
            <p>In My Space Arcade the whole thing is animated and explained step by step, so you can see exactly why you got your result. FLAMES is just for fun and makes a great party game with friends.</p>
          </section>
          <section>
            <h2>FLAMES questions</h2>
            {FLAMES_FAQ.map(([q, a]) => <details key={q} open><summary>{q}</summary><p>{a}</p></details>)}
          </section>
        </>
      )}
      <section>
        <h2>About {g.name}</h2>
        <p>{g.tag} {g.multi ? 'You can play alone or online with friends.' : 'It is a single-player game.'} It runs in your browser: no download, no sign-up, and it works on phones, tablets and computers.</p>
        <Link href={`/?play=${g.slug}`} className="seo-play">▶ PLAY {g.name.split(':')[0].toUpperCase()}</Link>
      </section>
      <section>
        <h2>More free games</h2>
        <div className="seo-grid">{others.map((o) => <Link key={o.slug} href={`/games/${o.slug}`} className="seo-card"><b>{o.name}</b><small>{o.genre}</small><span>{o.tag}</span></Link>)}</div>
        <p><Link href="/games">See all {GAMES.length} games</Link></p>
      </section>
    </main>
  )
}
