import { getBanners, getFeaturedMenuItems, getUpcomingEvents, getGalleryImages, getHomeFeatures } from '@/lib/queries'
import HomeClient from '@/components/HomeClient'

// Use ISR: Revalidate every 60 seconds (1 minute) for fresh events while still caching
export const revalidate = 60

export default async function Home() {
  const banners = await getBanners()
  const featuredItems = await getFeaturedMenuItems()
  const upcomingEvents = await getUpcomingEvents(2)
  const galleryImages = await getGalleryImages('all', 4) // Get 4 images for preview
  const partiesImages = await getGalleryImages('parties', 4) // Get 4 parties images
  const homeFeatures = await getHomeFeatures()

  return <HomeClient banners={banners} featuredItems={featuredItems} upcomingEvents={upcomingEvents} galleryImages={galleryImages} partiesImages={partiesImages} homeFeatures={homeFeatures} />
}
