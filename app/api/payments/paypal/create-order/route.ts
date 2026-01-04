import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { amount, currency = 'USD', reservationId, description } = body

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      )
    }

    if (!reservationId) {
      return NextResponse.json(
        { error: 'Reservation ID is required' },
        { status: 400 }
      )
    }

    const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID
    const PAYPAL_SECRET_ID = process.env.PAYPAL_SECRET_ID
    const PAYPAL_BASE_URL = process.env.PAYPAL_BASE_URL || 'https://api-m.sandbox.paypal.com'

    if (!PAYPAL_CLIENT_ID || !PAYPAL_SECRET_ID) {
      console.error('PayPal credentials missing:', {
        hasClientId: !!PAYPAL_CLIENT_ID,
        hasSecretId: !!PAYPAL_SECRET_ID
      })
      return NextResponse.json(
        { error: 'PayPal credentials not configured. Please check your environment variables.' },
        { status: 500 }
      )
    }

    const type = 'reservation'
    const referenceId = reservationId
    console.log(`[PayPal] Creating order for ${type}:`, referenceId, 'Amount:', amount)

    // Get PayPal access token
    const tokenResponse = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET_ID}`).toString('base64')}`,
      },
      body: 'grant_type=client_credentials',
    })

    if (!tokenResponse.ok) {
      const error = await tokenResponse.json()
      console.error('[PayPal] Token error:', error)
      return NextResponse.json(
        { error: 'Failed to authenticate with PayPal. Please check your credentials.' },
        { status: 500 }
      )
    }

    const { access_token } = await tokenResponse.json()
    console.log('[PayPal] Access token obtained')

    // Use environment variable if available, otherwise construct from request URL
    let siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL
    if (!siteUrl) {
      const url = new URL(request.url)
      siteUrl = `${url.protocol}//${url.host}`
    }
    siteUrl = siteUrl.replace(/\/$/, '')

    // Create PayPal order
    const orderResponse = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${access_token}`,
        'PayPal-Request-Id': referenceId,
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: referenceId,
            description: description || `Reservation Prepayment - ${reservationId}`,
            amount: {
              currency_code: currency,
              value: amount.toFixed(2),
            },
          },
        ],
        application_context: {
          brand_name: 'Good Times Bar & Grill',
          landing_page: 'NO_PREFERENCE',
          user_action: 'PAY_NOW',
          return_url: `${siteUrl}/api/payments/paypal/success?reservationId=${reservationId}`,
          cancel_url: `${siteUrl}/reservations/payment/cancel`,
        },
      }),
    })

    if (!orderResponse.ok) {
      const error = await orderResponse.json()
      console.error('[PayPal] Order creation error:', error)
      return NextResponse.json(
        { error: error.message || 'Failed to create PayPal order' },
        { status: 500 }
      )
    }

    const order = await orderResponse.json()
    console.log('[PayPal] Order created:', order.id)

    const approvalUrl = order.links.find((link: any) => link.rel === 'approve')?.href

    if (!approvalUrl) {
      console.error('[PayPal] No approval URL in response:', order)
      return NextResponse.json(
        { error: 'Failed to get PayPal approval URL' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      orderId: order.id,
      approvalUrl,
    })
  } catch (error: any) {
    console.error('[PayPal] Create order error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

