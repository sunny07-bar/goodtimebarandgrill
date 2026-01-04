import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

export async function POST(request: NextRequest) {
  if (!supabase) {
    return NextResponse.json(
      { error: 'Database service unavailable. Please check configuration.' },
      { status: 503 }
    )
  }

  try {
    const body = await request.json()
    const { orderId, reservationId, ticketOrderId, type = 'reservation' } = body

    // Either reservationId or ticketOrderId is required
    if (!orderId || (!reservationId && !ticketOrderId)) {
      return NextResponse.json(
        { error: 'Order ID and Reservation ID or Ticket Order ID are required' },
        { status: 400 }
      )
    }

    const referenceId = reservationId || ticketOrderId

    const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID
    const PAYPAL_SECRET_ID = process.env.PAYPAL_SECRET_ID
    const PAYPAL_BASE_URL = process.env.PAYPAL_BASE_URL || 'https://api-m.sandbox.paypal.com'

    if (!PAYPAL_CLIENT_ID || !PAYPAL_SECRET_ID) {
      return NextResponse.json(
        { error: 'PayPal credentials not configured' },
        { status: 500 }
      )
    }

    console.log(`[PayPal] Capturing order: ${orderId} for ${type}:`, referenceId)

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
        { error: 'Failed to authenticate with PayPal' },
        { status: 500 }
      )
    }

    const { access_token } = await tokenResponse.json()

    // Capture the PayPal order
    const captureResponse = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${access_token}`,
      },
    })

    if (!captureResponse.ok) {
      const error = await captureResponse.json()
      console.error('[PayPal] Capture error:', error)
      return NextResponse.json(
        { error: error.message || 'Failed to capture payment' },
        { status: 500 }
      )
    }

    const capture = await captureResponse.json()
    console.log('[PayPal] Capture response status:', capture.status)

    if (capture.status !== 'COMPLETED') {
      console.error('[PayPal] Payment not completed. Status:', capture.status)
      return NextResponse.json(
        { error: `Payment not completed. Status: ${capture.status}` },
        { status: 400 }
      )
    }

    // Get payment details
    const paymentAmount = parseFloat(
      capture.purchase_units[0]?.payments?.captures[0]?.amount?.value || '0'
    )
    const paypalTransactionId = capture.purchase_units[0]?.payments?.captures[0]?.id

    console.log('[PayPal] Payment captured:', {
      amount: paymentAmount,
      transactionId: paypalTransactionId
    })

    // Update reservation or ticket order with payment information
    if (type === 'ticket') {
      // Complete ticket purchase (tickets will be fetched from stored selection)
      // Use environment variable if available, otherwise construct from request URL
      let siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL
      if (!siteUrl) {
        const url = new URL(request.url)
        siteUrl = `${url.protocol}//${url.host}`
      }
      siteUrl = siteUrl.replace(/\/$/, '')
      const completeResponse = await fetch(`${siteUrl}/api/tickets/complete-purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: ticketOrderId,
          paymentTransactionId: paypalTransactionId,
          paymentMethod: 'paypal',
          tickets: [], // Will be fetched from stored selection in complete-purchase
        }),
      })

      if (!completeResponse.ok) {
        const errorData = await completeResponse.json()
        console.error('[PayPal] Error completing ticket purchase:', errorData)
        // Payment was captured but ticket creation failed
      } else {
        console.log('[PayPal] Ticket purchase completed successfully')
      }
    } else {
      // Update reservation
      const { error: updateError } = await supabase
        .from('reservations')
        .update({
          prepayment_status: 'paid',
          payment_status: 'paid',
          payment_method: 'paypal',
          payment_transaction_id: paypalTransactionId,
          payment_date: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', reservationId)

      if (updateError) {
        console.error('[PayPal] Error updating reservation:', updateError)
      } else {
        console.log('[PayPal] Reservation updated successfully')
      }
    }

    // Create payment record (check if payments table exists)
    try {
      await supabase.from('payments').insert({
        reservation_id: type === 'reservation' ? reservationId : null,
        order_id: type === 'ticket' ? ticketOrderId : null,
        amount: paymentAmount,
        currency: capture.purchase_units[0]?.payments?.captures[0]?.amount?.currency_code || 'USD',
        payment_method: 'paypal',
        transaction_id: paypalTransactionId,
        status: 'completed',
        paypal_order_id: orderId,
        metadata: JSON.stringify(capture),
      })
      console.log('[PayPal] Payment record created')
    } catch (paymentRecordError: any) {
      console.error('[PayPal] Error creating payment record (table might not exist):', paymentRecordError)
      // Continue anyway - payment was captured
    }

    return NextResponse.json({
      success: true,
      paymentId: paypalTransactionId,
      amount: paymentAmount,
      status: 'completed',
    })
  } catch (error: any) {
    console.error('[PayPal] Capture error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

