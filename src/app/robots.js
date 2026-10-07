import { SITE } from '../lib/seo'
export default function robots() {
  return { rules: [{ userAgent: '*', allow: '/', disallow: ['/api/'] }], sitemap: `${SITE}/sitemap.xml`, host: SITE }
}
