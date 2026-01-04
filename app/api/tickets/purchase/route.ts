import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

// Helper to generate order number if function doesn't exist
async function generateOrderNumber(): Promise<string> {
  const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '')
  const random = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `TKT-${dateStr}-${random}`
}

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
      eventId,
      tickets, // Array of { ticketTypeId, quantity }
      customerName,
      customerEmail,
      customerPhone,
    } = body

    // Validate required fields
    if (!eventId || !tickets || !Array.isArray(tickets) || tickets.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: eventId and tickets' },
        { status: 400 }
      )
    }

    if (!customerName || !customerEmail) {
      return NextResponse.json(
        { error: 'Customer name and email are required' },
        { status: 400 }
      )
    }

    // Get event details
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single()

    if (eventError || !event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      )
    }

    // Check if event is in the past (compare in UTC, as events are stored in UTC)
    const eventStartUTC = new Date(event.event_start)
    const nowUTC = new Date()
    if (eventStartUTC < nowUTC) {
      return NextResponse.json(
        { error: 'Cannot purchase tickets for past events' },
        { status: 400 }
      )
    }

    // Validate tickets and calculate total
    let totalAmount = 0
    const ticketValidations = []

    for (const ticketItem of tickets) {
      // Handle base ticket price (when no ticket types are defined)
      if (ticketItem.ticketTypeId === 'base') {
        if (!event.base_ticket_price) {
          return NextResponse.json(
            { error: 'Base ticket price not set for this event' },
            { status: 400 }
          )
        }
        // Create a virtual ticket type for base price
        ticketValidations.push({
          ticketType: {
            id: 'base',
            name: 'General Admission',
            price: event.base_ticket_price,
            quantity_total: null,
            quantity_sold: 0,
            currency: event.ticket_currency || 'USD',
          },
          quantity: ticketItem.quantity,
        })
        totalAmount += parseFloat(event.base_ticket_price.toString()) * ticketItem.quantity
        continue
      }

      const { data: ticketType, error: ticketError } = await supabase
        .from('event_tickets')
        .select('*')
        .eq('id', ticketItem.ticketTypeId)
        .eq('event_id', eventId)
        .single()

      if (ticketError || !ticketType) {
        return NextResponse.json(
          { error: `Ticket type ${ticketItem.ticketTypeId} not found` },
          { status: 404 }
        )
      }

      // Check availability
      const available = (ticketType.quantity_total || 999999) - ticketType.quantity_sold
      if (ticketItem.quantity > available) {
        return NextResponse.json(
          { error: `Only ${available} ${ticketType.name} tickets available` },
          { status: 400 }
        )
      }

      totalAmount += parseFloat(ticketType.price.toString()) * ticketItem.quantity
      ticketValidations.push({ ticketType, quantity: ticketItem.quantity })
    }

    // Generate order number
    let orderNumber: string
    try {
      const { data: orderNumberData, error: rpcError } = await supabase.rpc('generate_order_number')
      if (rpcError || !orderNumberData) {
        orderNumber = await generateOrderNumber()
      } else {
        orderNumber = orderNumberData
      }
    } catch (e) {
      orderNumber = await generateOrderNumber()
    }

    // Store ticket selection for later use after payment
    const ticketSelection = ticketValidations.map(v => ({
      ticketTypeId: v.ticketType.id === 'base' ? 'base' : v.ticketType.id,
      quantity: v.quantity,
      price: parseFloat(v.ticketType.price.toString()),
      name: v.ticketType.name,
    }))

    // Create ticket order (always unpaid initially, will be updated after payment)
    const { data: order, error: orderError } = await supabase
      .from('ticket_orders')
      .insert({
        event_id: eventId,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone || null,
        total_amount: totalAmount,
        payment_status: 'unpaid', // Always start as unpaid
        payment_method: null,
        payment_transaction_id: null,
        order_number: orderNumber,
        status: 'pending', // Will be confirmed after payment
      })
      .select()
      .single()

    if (orderError) {
      console.error('Order creation error:', orderError)
      return NextResponse.json(
        { error: 'Failed to create order' },
        { status: 500 }
      )
    }

    // Store ticket selection for later use after payment
    // Note: This table may not exist, so we'll catch the error gracefully
    try {
      const { error: selectionError } = await supabase
        .from('ticket_order_selections')
        .insert({
          ticket_order_id: order.id,
          ticket_selection: ticketSelection,
        })

      if (selectionError) {
        // Only log if it's not a "table doesn't exist" error
        if (selectionError.code !== 'PGRST205') {
          console.error('Error storing ticket selection:', selectionError)
        }
        // Continue anyway - we can reconstruct from order amount if needed
      }
    } catch (err) {
      // Table doesn't exist or error - that's okay, continue silently
      // The ticket selection is also included in the response, so it's not lost
    }

    // Return payment URL instead of creating tickets immediately
    // Use environment variable if available, otherwise construct from request URL
    let siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL
    
    if (!siteUrl) {
      // Construct from request URL for serverless environments
      const url = new URL(request.url)
      siteUrl = `${url.protocol}//${url.host}`
    }
    
    // Remove trailing slash if present
    siteUrl = siteUrl.replace(/\/$/, '')
    
    // If total is 0, payment is not required
    const paymentRequired = totalAmount > 0
    
    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        orderNumber: order.order_number,
        totalAmount: order.total_amount,
        status: order.status,
      },
      paymentRequired: paymentRequired,
      paymentUrl: paymentRequired 
        ? `${siteUrl}/events/${encodeURIComponent(event.slug)}/payment?orderId=${order.id}&amount=${totalAmount}`
        : null,
      tickets: ticketSelection, // Include ticket selection in response for payment page
      event: {
        id: event.id,
        title: event.title,
        slug: event.slug,
      },
    }, { status: 201 })
  } catch (error: any) {
    console.error('Ticket purchase error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
