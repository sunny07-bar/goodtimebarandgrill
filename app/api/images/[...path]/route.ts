import { NextRequest, NextResponse } from 'next/server'

/**
 * Image proxy route to ensure proper cache headers
 * Proxies Supabase Storage images and adds Cache-Control headers
 * 
 * Usage: /api/images/[bucket]/[image-path]
 * Example: /api/images/banners/hero-image.webp
 */
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

    // Get image data
    const imageBuffer = await imageResponse.arrayBuffer()
    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg'
    
    // Create response with proper cache headers
    const response = new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        // Cache for 1 year (31536000 seconds)
        'Cache-Control': 'public, max-age=31536000, immutable, stale-while-revalidate=86400',
        // Additional cache headers
        'ETag': `"${bucket}/${imagePath}"`,
        // CORS headers if needed
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
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

