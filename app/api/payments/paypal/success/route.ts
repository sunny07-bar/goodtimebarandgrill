import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const token = searchParams.get('token')
  const PayerID = searchParams.get('PayerID')
  const reservationId = searchParams.get('reservationId')
  const orderId = searchParams.get('orderId')
  const type = searchParams.get('type') // 'ticket' or 'reservation'

  if (!token) {
    // Redirect to appropriate cancel page
    if (type === 'ticket') {
      return NextResponse.redirect(new URL('/events/payment/cancel', request.url))
    }
    return NextResponse.redirect(new URL('/reservations/payment/cancel', request.url))
  }

  // Use environment variable if available, otherwise construct from request URL
  let siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL
  if (!siteUrl) {
    const url = new URL(request.url)
    siteUrl = `${url.protocol}//${url.host}`
  }
  siteUrl = siteUrl.replace(/\/$/, '')
  
  if (type === 'ticket' && orderId) {
    // Redirect to ticket success page which will capture payment
    const redirectUrl = new URL(`/events/payment/success`, siteUrl)
    redirectUrl.searchParams.set('token', token)
    redirectUrl.searchParams.set('orderId', orderId)
    if (PayerID) {
      redirectUrl.searchParams.set('PayerID', PayerID)
    }
    return NextResponse.redirect(redirectUrl.toString())
  } else {
    // Reservation success
    const redirectUrl = new URL('/reservations/payment/success', siteUrl)
    redirectUrl.searchParams.set('token', token)
    if (reservationId) {
      redirectUrl.searchParams.set('reservationId', reservationId)
    }
    if (PayerID) {
      redirectUrl.searchParams.set('PayerID', PayerID)
    }
    return NextResponse.redirect(redirectUrl.toString())
  }
}

