// Create Stripe Checkout Session for tickets or reservations
import { NextRequest, NextResponse } from 'next/server';
import { stripe, formatAmountForStripe } from '@/lib/stripe';
import { supabase } from '@/lib/db';

export async function POST(request: NextRequest) {
  if (!supabase) {
    return NextResponse.json(
      { error: 'Database service unavailable' },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const { type, orderId, reservationId, amount, customerEmail, customerName } = body;

    if (!type || (!orderId && !reservationId) || !amount || !customerEmail) {
      return NextResponse.json(
        { error: 'Missing required fields: type, orderId/reservationId, amount, customerEmail' },
        { status: 400 }
      );
    }

    // Validate amount
    const parsedAmount = parseFloat(amount.toString());
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      );
    }

    // Free tickets/reservations should not use Stripe
    if (parsedAmount === 0) {
      return NextResponse.json(
        { error: 'Cannot process $0 payments through Stripe. Free tickets should be handled separately.' },
        { status: 400 }
      );
    }

    // Stripe requires minimum $0.50 USD for checkout sessions
    const STRIPE_MINIMUM_AMOUNT = 0.50;
    if (parsedAmount < STRIPE_MINIMUM_AMOUNT) {
      return NextResponse.json(
        { 
          error: `Amount must be at least $${STRIPE_MINIMUM_AMOUNT.toFixed(2)} USD. Current amount: $${parsedAmount.toFixed(2)}. Free or low-cost tickets should be handled separately.`,
          code: 'amount_too_small',
          minimumAmount: STRIPE_MINIMUM_AMOUNT
        },
        { status: 400 }
      );
    }

    // Use environment variable if available, otherwise construct from request URL
    let siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL
    if (!siteUrl) {
      const url = new URL(request.url)
      siteUrl = `${url.protocol}//${url.host}`
    }
    siteUrl = siteUrl.replace(/\/$/, '')
    const amountInCents = formatAmountForStripe(parsedAmount, 'USD');

    // Determine success and cancel URLs based on type
    let successUrl: string;
    let cancelUrl: string;
    let metadata: Record<string, string> = {};

    if (type === 'ticket' && orderId) {
      // Get event slug and ticket selection for redirect
      const { data: order } = await supabase
        .from('ticket_orders')
        .select('events(slug)')
        .eq('id', orderId)
        .single();

      const eventSlug = (order?.events as any)?.slug || 'events';
      
      // Try to fetch ticket selection from stored selection table
      let ticketSelection: any[] | null = null;
      try {
        const { data: storedSelection } = await supabase
          .from('ticket_order_selections')
          .select('ticket_selection')
          .eq('ticket_order_id', orderId)
          .single();
        
        if (storedSelection && storedSelection.ticket_selection) {
          ticketSelection = storedSelection.ticket_selection;
        }
      } catch (err) {
        // Table doesn't exist or error - that's okay, we'll try to reconstruct
        console.log('Could not fetch ticket selection from ticket_order_selections');
      }
      
      // Success page is at /events/payment/success (not /events/{slug}/payment/success)
      successUrl = `${siteUrl}/events/payment/success?session_id={CHECKOUT_SESSION_ID}`;
      cancelUrl = `${siteUrl}/events/payment/cancel`;
      metadata = {
        type: 'ticket',
        orderId: orderId,
        eventSlug: eventSlug, // Store event slug in metadata for redirect
      };
      
      // Store ticket selection in metadata if available (Stripe metadata values must be strings)
      if (ticketSelection && ticketSelection.length > 0) {
        metadata.ticketSelection = JSON.stringify(ticketSelection);
      }
    } else if (type === 'reservation' && reservationId) {
      successUrl = `${siteUrl}/reservations/payment/success?session_id={CHECKOUT_SESSION_ID}`;
      cancelUrl = `${siteUrl}/reservations/payment/cancel`;
      metadata = {
        type: 'reservation',
        reservationId: reservationId,
      };
    } else {
      return NextResponse.json(
        { error: 'Invalid payment type or missing ID' },
        { status: 400 }
      );
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: type === 'ticket' ? 'Event Tickets' : 'Reservation Prepayment',
              description: type === 'ticket' 
                ? `Tickets order #${orderId}` 
                : `Reservation #${reservationId}`,
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      customer_email: customerEmail,
      metadata: metadata,
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      url: session.url,
    });

  } catch (error: any) {
    console.error('Stripe checkout creation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}

