import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'

/**
 * On-demand revalidation endpoint
 * Call this when data changes to immediately update the cache
 * 
 * Usage:
 * POST /api/revalidate?path=/menu&secret=YOUR_SECRET
 * POST /api/revalidate?tag=menu&secret=YOUR_SECRET
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const secret = searchParams.get('secret')
    const path = searchParams.get('path')
    const tag = searchParams.get('tag')

    // Verify secret token to prevent unauthorized revalidation
    if (secret !== process.env.REVALIDATION_SECRET) {
      return NextResponse.json(
        { message: 'Invalid secret token' },
        { status: 401 }
      )
    }

    if (!path && !tag) {
      return NextResponse.json(
        { message: 'Either path or tag parameter is required' },
        { status: 400 }
      )
    }

    // Revalidate by path
    if (path) {
      revalidatePath(path)
      return NextResponse.json({
        revalidated: true,
        path,
        now: Date.now(),
      })
    }

    // Revalidate by tag (if using fetch with tags)
    if (tag) {
      revalidateTag(tag)
      return NextResponse.json({
        revalidated: true,
        tag,
        now: Date.now(),
      })
    }
  } catch (error) {
    console.error('Revalidation error:', error)
    return NextResponse.json(
      { message: 'Error revalidating cache' },
      { status: 500 }
    )
  }
}
