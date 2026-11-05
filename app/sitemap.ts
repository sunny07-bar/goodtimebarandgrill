import { MetadataRoute } from 'next'
import { supabase } from '@/lib/db'
import { safeEncodeSlug } from '@/lib/utils/slug'

// Revalidate sitemap dynamically every hour (3600 seconds)
export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    'https://goodtimesbarandgrill.com'
  ).replace(/\/$/, '')

  const now = new Date()

  // 1. Core static public pages
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/events`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/menu`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/reservations`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/offers`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/order`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/gallery`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
  ]

  // 2. Dynamic event detail pages
  let eventRoutes: MetadataRoute.Sitemap = []
  try {
    if (supabase) {
      const { data: events, error } = await supabase
        .from('events')
        .select('slug, updated_at, created_at, status')
        .neq('status', 'cancelled')

      if (!error && events && events.length > 0) {
        eventRoutes = events
          .filter((e) => Boolean(e.slug && e.slug.trim()))
          .map((e) => ({
            url: `${baseUrl}/events/${safeEncodeSlug(e.slug.trim())}`,
            lastModified: e.updated_at
              ? new Date(e.updated_at)
              : e.created_at
              ? new Date(e.created_at)
              : now,
            changeFrequency: 'weekly' as const,
            priority: 0.8,
          }))
      }
    }
  } catch (err) {
    console.error('[Sitemap] Failed to fetch dynamic event routes:', err)
  }

  // 3. Dynamic menu item pages
  let menuRoutes: MetadataRoute.Sitemap = []
  try {
    if (supabase) {
      const { data: menuItems, error } = await supabase
        .from('menu_items')
        .select('id, updated_at, created_at, is_available')
        .eq('is_available', true)

      if (!error && menuItems && menuItems.length > 0) {
        menuRoutes = menuItems.map((item) => ({
          url: `${baseUrl}/menu/${item.id}`,
          lastModified: item.updated_at
            ? new Date(item.updated_at)
            : item.created_at
            ? new Date(item.created_at)
            : now,
          changeFrequency: 'weekly' as const,
          priority: 0.6,
        }))
      }
    }
  } catch (err) {
    console.error('[Sitemap] Failed to fetch dynamic menu item routes:', err)
  }

  return [...staticRoutes, ...eventRoutes, ...menuRoutes]
}
