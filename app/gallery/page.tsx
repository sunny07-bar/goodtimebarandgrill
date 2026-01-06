import { getGalleryImages } from '@/lib/queries'
import GalleryClient from '@/components/GalleryClient'

// Production-ready ISR: Revalidate every 1 hour (3600 seconds) - gallery images rarely change
// Cached for fast loading; updates when gallery changes
export const revalidate = 3600

export default async function GalleryPage() {
  const images = await getGalleryImages()

  return <GalleryClient initialImages={images} />
}
