import Image from 'next/image'
import { getImageUrl } from '@/lib/image-utils'

interface SupabaseImageProps {
  src: string | null | undefined
  alt: string
  fill?: boolean
  width?: number
  height?: number
  className?: string
  priority?: boolean
  bucket?: string
}

export default function SupabaseImage({
  src,
  alt,
  fill,
  width,
  height,
  className,
  priority,
  bucket,
}: SupabaseImageProps) {
  const imageUrl = getImageUrl(src, bucket)

  if (!imageUrl) {
    // Return a placeholder div instead of null to prevent layout shifts
    if (fill) {
      return (
        <div 
          className={`${className || ''} bg-gradient-to-br from-orange-100 to-orange-50 flex items-center justify-center`}
          style={{ position: 'absolute', inset: 0 }}
        >
          <span className="text-orange-400 text-sm">No image</span>
        </div>
      )
    }
    return (
      <div 
        className={`${className || ''} bg-gradient-to-br from-orange-100 to-orange-50 flex items-center justify-center`}
        style={{ width, height }}
      >
        <span className="text-orange-400 text-sm">No image</span>
      </div>
    )
  }

  // Images are unoptimized to avoid Vercel free tier limits
  // Images are served directly from Supabase Storage with proper cache headers
  // Browser caching is handled via Cache-Control headers (1 year)
  if (fill) {
    return (
      <Image
        src={imageUrl}
        alt={alt}
        fill
        className={className}
        priority={priority}
        unoptimized={true}
        // Images served directly from Supabase Storage
        // Cached for 1 year in browser via Cache-Control headers
      />
    )
  }

  return (
    <Image
      src={imageUrl}
      alt={alt}
      width={width}
      height={height}
      className={className}
      priority={priority}
      unoptimized={true}
      // Images served directly from Supabase Storage
      // Cached for 1 year in browser via Cache-Control headers
    />
  )
}

