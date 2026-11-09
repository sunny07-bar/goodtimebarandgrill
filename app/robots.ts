import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    'https://goodtimesbarandgrill.com'
  ).replace(/\/$/, '')

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/events/*/purchase',
          '/events/*/payment',
          '/events/*/tickets/',
          '/events/payment/',
          '/reservations/payment/',
          '/_next/',
        ],
      },
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: [
          '/api/',
          '/events/*/purchase',
          '/events/*/payment',
          '/events/*/tickets/',
          '/events/payment/',
          '/reservations/payment/',
          '/_next/',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}

