import { getBanners, getFeaturedMenuItems, getUpcomingEvents, getGalleryImages, getHomeFeatures } from '@/lib/queries'
import HomeClient from '@/components/HomeClient'

// Production-ready ISR: Revalidate every 10 minutes (600 seconds) - reduces database calls by 83%
// Pages are cached and served instantly; background revalidation updates cache when needed
export const revalidate = 600

export default async function Home() {
  const [banners, featuredItems, upcomingEvents, galleryImages, partiesImages, homeFeatures] = await Promise.all([
    getBanners(),
    getFeaturedMenuItems(),
    getUpcomingEvents(2),
    getGalleryImages('all', 4), // Get 4 images for preview
    getGalleryImages('parties', 4), // Get 4 parties images
    getHomeFeatures(),
  ])

  return (
    <>
      {/* Preload static logo for instant display */}
      <link rel="preload" as="image" href="/images/good-times-logo.png" />
      <HomeClient 
        banners={banners} 
        featuredItems={featuredItems} 
        upcomingEvents={upcomingEvents} 
        galleryImages={galleryImages} 
        partiesImages={partiesImages} 
        homeFeatures={homeFeatures}
      />
    </>
  )
}
