import { getGalleryImages } from '@/lib/queries'
import GalleryClient from '@/components/GalleryClient'

// Cache gallery for 10 minutes (images don't change frequently)
export const revalidate = 600

export default async function GalleryPage() {
  const images = await getGalleryImages()

  return <GalleryClient initialImages={images} />
}
