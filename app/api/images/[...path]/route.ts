import { NextRequest, NextResponse } from 'next/server'

/**
 * Image proxy route to ensure proper cache headers
 * Proxies Supabase Storage images and adds Cache-Control headers
 * 
 * Usage: /api/images/[bucket]/[image-path]
 * Example: /api/images/banners/hero-image.webp
 */
// Support HEAD requests for cache checking without downloading the image
export async function HEAD(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> | { path: string[] } }
) {
  const resolvedParams = await Promise.resolve(params)
  const pathSegments = resolvedParams.path || []
  
  if (pathSegments.length < 2) {
    return new NextResponse(null, { status: 400 })
  }
  
  const bucket = pathSegments[0]
  const imagePath = pathSegments.slice(1).join('/')
  const etag = `"${bucket}/${imagePath}"`
  
  // Check If-None-Match header
  const ifNoneMatch = request.headers.get('if-none-match')
  if (ifNoneMatch === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        'ETag': etag,
        'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable, stale-while-revalidate=31536000, stale-if-error=604800',
      },
    })
  }
  
  // Return headers only (no body)
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable, stale-while-revalidate=31536000, stale-if-error=604800',
      'ETag': etag,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    },
  })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> | { path: string[] } }
) {
  try {
    // Handle both async and sync params (Next.js 13+ uses async params)
    const resolvedParams = await Promise.resolve(params)
    const pathSegments = resolvedParams.path || []
    
    if (pathSegments.length < 2) {
      return NextResponse.json(
        { error: 'Invalid image path. Format: /api/images/[bucket]/[image-path]' },
        { status: 400 }
      )
    }

    const bucket = pathSegments[0]
    const imagePath = pathSegments.slice(1).join('/')
    
    // Get Supabase URL from environment
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!supabaseUrl) {
      return NextResponse.json(
        { error: 'Supabase URL not configured' },
        { status: 500 }
      )
    }

    // Construct Supabase Storage URL
    const supabaseImageUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${imagePath}`
    
    // Fetch image from Supabase Storage
    const imageResponse = await fetch(supabaseImageUrl, {
      headers: {
        'Accept': 'image/*',
      },
      // Don't follow redirects - return as-is
      redirect: 'follow',
    })

    if (!imageResponse.ok) {
      return NextResponse.json(
        { error: 'Image not found' },
        { status: imageResponse.status }
      )
    }

    // Check If-None-Match header for cache validation
    const ifNoneMatch = request.headers.get('if-none-match')
    const etag = `"${bucket}/${imagePath}"`
    
    if (ifNoneMatch === etag) {
      return new NextResponse(null, {
        status: 304, // Not Modified
        headers: {
          'ETag': etag,
          'Cache-Control': 'public, max-age=31536000, immutable, stale-while-revalidate=86400',
        },
      })
    }
    
    // Get image data
    const imageBuffer = await imageResponse.arrayBuffer()
    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg'
    
    // Get Last-Modified from Supabase or use current time
    const lastModified = imageResponse.headers.get('last-modified') || new Date().toUTCString()
    
    // Create response with aggressive cache headers
    const response = new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        // Aggressive caching: 1 year with CDN support
        'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable, stale-while-revalidate=31536000, stale-if-error=604800',
        // ETag for cache validation
        'ETag': etag,
        // Last-Modified for cache validation
        'Last-Modified': lastModified,
        // Expires header (for older browsers)
        'Expires': new Date(Date.now() + 31536000 * 1000).toUTCString(),
        // CORS headers
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Max-Age': '31536000',
        // Compression hint
        'Vary': 'Accept-Encoding',
        // Performance headers
        'X-Content-Type-Options': 'nosniff',
      },
    })

    return response
  } catch (error: any) {
    console.error('[Image Proxy] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch image' },
      { status: 500 }
    )
  }
}

