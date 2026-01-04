// Verify Stripe Checkout Session and return order/reservation details
import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';

// Force dynamic rendering (uses request.url)
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Retrieve the checkout session
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    const metadata = session.metadata || {};
    const type = metadata.type;

    if (type === 'ticket' && metadata.orderId) {
      // Get event slug from metadata (stored during checkout) or fetch from DB
      let eventSlug = metadata.eventSlug;
      const { supabase } = await import('@/lib/db');
      
      if (!eventSlug && supabase) {
        // Fallback: fetch from database if not in metadata
        const { data: order } = await supabase
          .from('ticket_orders')
          .select('events(slug)')
          .eq('id', metadata.orderId)
          .single();

        eventSlug = (order?.events as any)?.slug || 'events';
      } else {
        eventSlug = eventSlug || 'events';
      }

      // Check if payment is successful and update order status if needed
      if (session.payment_status === 'paid' && supabase) {
        // First, update order payment status if it's not already paid
        const { data: currentOrder } = await supabase
          .from('ticket_orders')
          .select('payment_status, payment_transaction_id')
          .eq('id', metadata.orderId)
          .single();

        if (currentOrder && currentOrder.payment_status !== 'paid') {
          console.log(`[Verify Session] Updating order ${metadata.orderId} payment status to paid`);
          await supabase
            .from('ticket_orders')
            .update({
              payment_status: 'paid',
              payment_method: 'stripe',
              payment_transaction_id: session.payment_intent as string,
              status: 'confirmed',
              updated_at: new Date().toISOString(),
            })
            .eq('id', metadata.orderId);
        }

        // Check if tickets already exist for this order
        const { data: existingTickets } = await supabase
          .from('purchased_tickets')
          .select('id')
          .eq('ticket_order_id', metadata.orderId)
          .limit(1);

        // If no tickets exist and payment is successful, trigger ticket creation (webhook fallback)
        if (!existingTickets || existingTickets.length === 0) {
          console.log(`[Verify Session] Triggering complete-purchase for order ${metadata.orderId}`);
          // Use environment variable if available, otherwise construct from request URL
          let siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL
          if (!siteUrl) {
            const url = new URL(request.url)
            siteUrl = `${url.protocol}//${url.host}`
          }
          siteUrl = siteUrl.replace(/\/$/, '')
          
          // Get ticket selection from metadata if available
          let ticketSelection: any[] | null = null;
          if (metadata.ticketSelection) {
            try {
              ticketSelection = JSON.parse(metadata.ticketSelection);
            } catch (err) {
              console.error('Error parsing ticket selection from metadata:', err);
            }
          }
          
          // Call complete-purchase and wait for it (like free tickets do)
          try {
            const completeResponse = await fetch(`${siteUrl}/api/tickets/complete-purchase`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                orderId: metadata.orderId,
                paymentTransactionId: session.payment_intent as string,
                paymentMethod: 'stripe',
                tickets: ticketSelection || [], // Use ticket selection from metadata if available
              }),
            });

            if (!completeResponse.ok) {
              const errorData = await completeResponse.json().catch(() => ({ error: 'Unknown error' }));
              console.error(`[Verify Session] Complete-purchase failed for order ${metadata.orderId}:`, errorData);
              // Don't throw - we'll return success anyway and let the ticket page handle it
            } else {
              const completeData = await completeResponse.json();
              console.log(`[Verify Session] Successfully created tickets for order ${metadata.orderId}`);
            }
          } catch (err: any) {
            console.error(`[Verify Session] Error calling complete-purchase for order ${metadata.orderId}:`, err.message || err);
            // Don't throw - return success and let ticket page handle retry
          }
        } else {
          console.log(`[Verify Session] Order ${metadata.orderId} already has tickets, skipping complete-purchase`);
        }
      }

      return NextResponse.json({
        success: true,
        orderId: metadata.orderId,
        eventSlug: eventSlug || 'events',
        paymentStatus: session.payment_status,
      });
    } else if (type === 'reservation' && metadata.reservationId) {
      const { supabase } = await import('@/lib/db');
      
      // Update reservation payment status if payment is successful
      if (session.payment_status === 'paid' && supabase) {
        // Check current reservation status
        const { data: currentReservation } = await supabase
          .from('reservations')
          .select('payment_status, status')
          .eq('id', metadata.reservationId)
          .single();

        // Update payment status if not already paid
        if (currentReservation && currentReservation.payment_status !== 'paid') {
          console.log(`[Verify Session] Updating reservation ${metadata.reservationId} payment status to paid`);
          const { error: updateError } = await supabase
            .from('reservations')
            .update({
              prepayment_status: 'paid',
              payment_status: 'paid',
              payment_method: 'stripe',
              payment_transaction_id: session.payment_intent as string,
              payment_date: new Date().toISOString(),
              status: 'confirmed', // Set status to confirmed after payment
              updated_at: new Date().toISOString(),
            })
            .eq('id', metadata.reservationId);

          if (updateError) {
            console.error(`[Verify Session] Error updating reservation ${metadata.reservationId}:`, updateError);
          } else {
            // Send confirmation email after payment
            try {
              // Use environment variable if available, otherwise construct from request URL
              let siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL
              if (!siteUrl) {
                const url = new URL(request.url)
                siteUrl = `${url.protocol}//${url.host}`
              }
              siteUrl = siteUrl.replace(/\/$/, '')
              await fetch(`${siteUrl}/api/reservations/send-confirmation`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reservationId: metadata.reservationId }),
              }).catch(err => {
                console.error(`[Verify Session] Failed to send confirmation email for reservation ${metadata.reservationId}:`, err);
                // Don't fail if email fails
              });
            } catch (err) {
              console.error(`[Verify Session] Error sending confirmation email for reservation ${metadata.reservationId}:`, err);
              // Continue even if email fails
            }
          }
        }
      }

      return NextResponse.json({
        success: true,
        reservationId: metadata.reservationId,
        paymentStatus: session.payment_status,
      });
    }

    return NextResponse.json({
      success: true,
      paymentStatus: session.payment_status,
    });

  } catch (error: any) {
    console.error('Error verifying session:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to verify session' },
      { status: 500 }
    );
  }
}

