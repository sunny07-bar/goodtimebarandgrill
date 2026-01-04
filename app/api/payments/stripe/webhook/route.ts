// Stripe Webhook Handler
import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { supabase } from '@/lib/db';
import { headers } from 'next/headers';

// Force dynamic rendering for webhook
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // Ensure Node.js runtime for webhook

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request: NextRequest) {
  if (!supabase) {
    return NextResponse.json(
      { error: 'Database service unavailable' },
      { status: 503 }
    );
  }

  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is not set');
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    );
  }

  try {
    const body = await request.text();
    const headersList = await headers();
    const signature = headersList.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      );
    }

    // Verify webhook signature
    let event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return NextResponse.json(
        { error: `Webhook signature verification failed: ${err.message}` },
        { status: 400 }
      );
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any;
        
        // Handle successful payment
        if (session.payment_status === 'paid') {
          const metadata = session.metadata || {};
          const type = metadata.type;
          
          if (type === 'ticket' && metadata.orderId) {
            // Complete ticket purchase (webhook is reliable in production)
            // For webhooks, we must use environment variable (webhooks come from Stripe, not user's browser)
            const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL
            if (!siteUrl) {
              console.error('[Webhook] NEXT_PUBLIC_SITE_URL or NEXT_PUBLIC_BASE_URL must be set for webhook to work');
              return NextResponse.json({ received: true }, { status: 200 }); // Return 200 to Stripe even if we can't process
            }
            
            try {
              const cleanSiteUrl = siteUrl.replace(/\/$/, '')
              const completeResponse = await fetch(`${cleanSiteUrl}/api/tickets/complete-purchase`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  orderId: metadata.orderId,
                  paymentTransactionId: session.payment_intent as string,
                  paymentMethod: 'stripe',
                  tickets: [], // Will be fetched from stored selection
                }),
              });

              if (!completeResponse.ok) {
                const errorData = await completeResponse.json().catch(() => ({ error: 'Unknown error' }));
                console.error(`[Webhook] Failed to complete ticket purchase for order ${metadata.orderId}:`, errorData);
                // In production, you might want to retry or alert admins
                // For now, verify-session fallback will handle this
              } else {
                console.log(`[Webhook] Successfully completed ticket purchase for order ${metadata.orderId}`);
              }
            } catch (error: any) {
              console.error(`[Webhook] Error calling complete-purchase for order ${metadata.orderId}:`, error.message || error);
              // Don't throw - webhook should return 200 to Stripe even if processing fails
              // verify-session fallback will handle ticket creation
            }

            // Create payment record
            try {
              await supabase.from('payments').insert({
                order_id: metadata.orderId,
                amount: session.amount_total ? session.amount_total / 100 : 0,
                currency: session.currency || 'usd',
                payment_method: 'stripe',
                transaction_id: session.payment_intent as string,
                status: 'completed',
                type: 'ticket',
              });
            } catch (err) {
              console.log('Payments table not found or error creating payment record');
            }

          } else if (type === 'reservation' && metadata.reservationId) {
            // Update reservation payment status
            try {
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
                console.error(`[Webhook] Error updating reservation ${metadata.reservationId}:`, updateError);
              } else {
                console.log(`[Webhook] Successfully updated reservation ${metadata.reservationId}`);
                
                // Send confirmation email after payment
                try {
                  // For webhooks, we must use environment variable
                  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL
                  if (siteUrl) {
                    const cleanSiteUrl = siteUrl.replace(/\/$/, '')
                    await fetch(`${cleanSiteUrl}/api/reservations/send-confirmation`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reservationId: metadata.reservationId }),
                    }).catch(err => {
                      console.error(`[Webhook] Failed to send confirmation email for reservation ${metadata.reservationId}:`, err);
                      // Don't fail webhook if email fails
                    });
                  }
                } catch (err) {
                  console.error(`[Webhook] Error sending confirmation email for reservation ${metadata.reservationId}:`, err);
                  // Continue even if email fails
                }
              }
            } catch (error: any) {
              console.error(`[Webhook] Error updating reservation ${metadata.reservationId}:`, error.message || error);
              // Don't throw - webhook should return 200 to Stripe
            }

            // Create payment record
            try {
              await supabase.from('payments').insert({
                reservation_id: metadata.reservationId,
                amount: session.amount_total ? session.amount_total / 100 : 0,
                currency: session.currency || 'usd',
                payment_method: 'stripe',
                transaction_id: session.payment_intent as string,
                status: 'completed',
                type: 'reservation',
              });
            } catch (err) {
              console.log('Payments table not found or error creating payment record');
            }
          }
        }
        break;
      }

      case 'payment_intent.succeeded': {
        // Payment was successful, but checkout.session.completed handles our logic
        console.log('Payment intent succeeded:', event.data.object);
        break;
      }

      case 'payment_intent.payment_failed': {
        // Payment failed
        console.error('Payment intent failed:', event.data.object);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });

  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: error.message || 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

