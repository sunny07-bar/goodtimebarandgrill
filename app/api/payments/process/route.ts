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
    const {
      type, // 'ticket' or 'reservation'
      orderId,
      reservationId,
      amount,
      paymentMethod = 'credit_card',
    } = body

    // Generate a dummy transaction ID
    const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`

    if (type === 'ticket' && orderId) {
      // Dummy payment - call complete-purchase to create tickets and mark as paid
      // Use environment variable if available, otherwise construct from request
      let baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL
      
      if (!baseUrl) {
        // Construct from request URL for serverless environments
        const url = new URL(request.url)
        baseUrl = `${url.protocol}//${url.host}`
      }
      
      // Remove trailing slash if present
      const cleanBaseUrl = baseUrl.replace(/\/$/, '')
      const completePurchaseUrl = `${cleanBaseUrl}/api/tickets/complete-purchase`
      
      try {
        // Call the complete-purchase endpoint (internal call - creates tickets and marks as paid)
        const completeResponse = await fetch(completePurchaseUrl, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            // Pass through any auth headers if needed
            ...(request.headers.get('authorization') && {
              'authorization': request.headers.get('authorization')!
            }),
          },
          body: JSON.stringify({
            orderId,
            paymentTransactionId: transactionId,
            paymentMethod,
            tickets: [], // Will be fetched from stored selection
          }),
        })

        if (!completeResponse.ok) {
          const errorText = await completeResponse.text()
          let errorData: any = { error: 'Unknown error' }
          try {
            errorData = JSON.parse(errorText)
          } catch {
            errorData = { error: errorText || 'Failed to complete ticket purchase' }
          }
          throw new Error(errorData.error || 'Failed to complete ticket purchase')
        }

        const completeData = await completeResponse.json()

        // Create payment record if payments table exists
        try {
          await supabase.from('payments').insert({
            order_id: orderId,
            amount: amount,
            currency: 'USD',
            payment_method: paymentMethod,
            transaction_id: transactionId,
            status: 'completed',
            type: 'ticket',
          })
        } catch (err) {
          // Payments table might not exist, that's okay
          console.log('Payments table not found, skipping payment record creation')
        }

        return NextResponse.json({
          success: true,
          transactionId,
          orderId,
          type: 'ticket',
          redirectUrl: completeData.redirectUrl || `/events/${completeData.eventSlug}/tickets/${orderId}`,
          eventSlug: completeData.eventSlug,
        })
      } catch (fetchError: any) {
        console.error('[Payment Process] Failed to call complete-purchase:', fetchError.message)
        console.error('[Payment Process] Attempted URL:', completePurchaseUrl)
        
        // If fetch fails (e.g., in serverless), we need to handle ticket creation directly
        // For now, return error and let the client retry or contact support
        // The order should still be marked as paid to prevent double charges
        throw new Error(`Payment processing failed: ${fetchError.message}. Please try again or contact support.`)
      }
    } else if (type === 'reservation' && reservationId) {
      // Update reservation payment status
      const { error: updateError } = await supabase
        .from('reservations')
        .update({
          prepayment_status: 'paid',
          payment_status: 'paid',
          payment_method: paymentMethod,
          payment_transaction_id: transactionId,
          payment_date: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', reservationId)

      if (updateError) {
        throw new Error('Failed to update reservation payment status')
      }

      // Create payment record if payments table exists
      try {
        await supabase.from('payments').insert({
          reservation_id: reservationId,
          amount: amount,
          currency: 'USD',
          payment_method: paymentMethod,
          transaction_id: transactionId,
          status: 'completed',
          type: 'reservation',
        })
      } catch (err) {
        // Payments table might not exist, that's okay
        console.log('Payments table not found, skipping payment record creation')
      }

      return NextResponse.json({
        success: true,
        transactionId,
        reservationId,
        type: 'reservation',
        redirectUrl: `/reservations/payment/success?reservationId=${reservationId}`,
      })
    } else {
      return NextResponse.json(
        { error: 'Invalid payment type or missing ID' },
        { status: 400 }
      )
    }
  } catch (error: any) {
    console.error('Payment processing error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process payment' },
      { status: 500 }
    )
  }
}

