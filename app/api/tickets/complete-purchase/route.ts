import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import crypto from 'crypto'
import QRCode from 'qrcode'

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// In-memory lock to prevent duplicate processing (resets on server restart)
const processingOrders = new Set<string>()
const LOCK_TIMEOUT = 30000 // 30 seconds

// Helper to generate ticket number
async function generateTicketNumber(): Promise<string> {
  if (!supabase) {
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '')
    const random = Math.random().toString(36).substring(2, 8).toUpperCase()
    return `TKT-${dateStr}-${random}`
  }

  try {
    const { data: ticketNumberData, error: rpcError } = await supabase.rpc('generate_ticket_number')
    if (rpcError || !ticketNumberData) {
      const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '')
      const random = Math.random().toString(36).substring(2, 8).toUpperCase()
      return `TKT-${dateStr}-${random}`
    }
    return ticketNumberData
  } catch (e) {
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '')
    const random = Math.random().toString(36).substring(2, 8).toUpperCase()
    return `TKT-${dateStr}-${random}`
  }
}

export async function POST(request: NextRequest) {
  if (!supabase) {
    return NextResponse.json(
      { error: 'Database service unavailable. Please check configuration.' },
      { status: 503 }
    )
  }
  let orderId: string | undefined
  try {
    const body = await request.json()
    const {
      orderId: bodyOrderId,
      paymentTransactionId,
      paymentMethod = 'paypal',
      tickets, // Array of { ticketTypeId, quantity } - same format as purchase
    } = body

    orderId = bodyOrderId

    if (!orderId || !paymentTransactionId) {
      return NextResponse.json(
        { error: 'Order ID and payment transaction ID are required' },
        { status: 400 }
      )
    }

    // Check if this order is already being processed (prevent duplicate processing)
    if (processingOrders.has(orderId)) {
      console.log(`[Complete Purchase] Order ${orderId} is already being processed, returning success (idempotent)`)
      return NextResponse.json({
        success: true,
        message: 'Order is being processed',
      })
    }

    // Add to processing set
    processingOrders.add(orderId)
    
    // Auto-remove after timeout (safety measure)
    const currentOrderId = orderId // Capture orderId for closure
    setTimeout(() => {
      processingOrders.delete(currentOrderId)
    }, LOCK_TIMEOUT)

    // Get the order first
    const { data: order, error: orderError } = await supabase
      .from('ticket_orders')
      .select(`
        *,
        events (*)
      `)
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      processingOrders.delete(orderId) // Remove from processing set
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    // Check if already paid and tickets exist - if so, return success (idempotent)
    if (order.payment_status === 'paid') {
      // Check if tickets already exist for this order
      const { data: existingTickets, error: ticketsError } = await supabase
        .from('purchased_tickets')
        .select('id')
        .eq('ticket_order_id', orderId)
        .limit(1)

      if (existingTickets && existingTickets.length > 0) {
        // Order is paid and tickets exist - return success (idempotent call)
        console.log(`[Complete Purchase] Order ${orderId} already processed with ${existingTickets.length} ticket(s)`)
        processingOrders.delete(orderId) // Remove from processing set
        return NextResponse.json({
          success: true,
          message: 'Order already processed',
          order: {
            id: order.id,
            orderNumber: order.order_number,
            totalAmount: order.total_amount,
            status: order.status,
          },
        })
      }
      // Order is marked as paid but tickets don't exist - continue processing
      console.log(`[Complete Purchase] Order ${orderId} marked as paid but tickets not found, continuing ticket creation...`)
    }

    // Extract event early so we can use it in reconstruction
    const event = order.events

    // Check if event is in the past (compare in UTC, as events are stored in UTC)
    if (event && event.event_start) {
      const eventStartUTC = new Date(event.event_start)
      const nowUTC = new Date()
      if (eventStartUTC < nowUTC) {
        processingOrders.delete(orderId) // Remove from processing set
        return NextResponse.json(
          { error: 'Cannot complete purchase for past events' },
          { status: 400 }
        )
      }
    }

    // Get ticket selection from stored selection (tickets param is optional, we'll fetch from DB)
    let ticketSelection = tickets
    
    // Try to get from stored selection first (more reliable)
    // Handle case where table doesn't exist gracefully
    try {
      const { data: storedSelection } = await supabase
        .from('ticket_order_selections')
        .select('ticket_selection')
        .eq('ticket_order_id', orderId)
        .single()
      
      if (storedSelection && storedSelection.ticket_selection) {
        ticketSelection = storedSelection.ticket_selection
      }
    } catch (err) {
      // Table doesn't exist or error - that's okay, try to use tickets param or reconstruct
      console.log('Could not fetch from ticket_order_selections, using provided tickets or reconstructing')
    }
    
    // If still no selection, try to reconstruct from order and event
    if (!ticketSelection || ticketSelection.length === 0) {
      // Try to reconstruct from order total and event base price
      if (event && event.base_ticket_price && order.total_amount) {
        const quantity = Math.round(parseFloat(order.total_amount.toString()) / parseFloat(event.base_ticket_price.toString()))
        if (quantity > 0) {
          ticketSelection = [{ ticketTypeId: 'base', quantity }]
          console.log(`[Complete Purchase] Reconstructed ticket selection: ${quantity} base tickets`)
        }
      } else if (event && !event.base_ticket_price && order.total_amount) {
        // If base_ticket_price is null, try to find matching ticket types from event_tickets
        console.log(`[Complete Purchase] Base price is null, trying to find matching ticket types for order total: ${order.total_amount}`)
        const { data: eventTickets, error: ticketsError } = await supabase
          .from('event_tickets')
          .select('*')
          .eq('event_id', order.event_id)
          .order('price', { ascending: true })
        
        if (!ticketsError && eventTickets && eventTickets.length > 0) {
          // Try to match the order total to ticket combinations
          // Start with the simplest case: single ticket type
          for (const ticketType of eventTickets) {
            const ticketPrice = parseFloat(ticketType.price.toString())
            const orderTotal = parseFloat(order.total_amount.toString())
            
            // Check if order total is a multiple of this ticket price
            const quantity = Math.round(orderTotal / ticketPrice)
            if (quantity > 0 && Math.abs(orderTotal - (ticketPrice * quantity)) < 0.01) {
              ticketSelection = [{ ticketTypeId: ticketType.id, quantity }]
              console.log(`[Complete Purchase] Reconstructed ticket selection: ${quantity} x ${ticketType.name} (${ticketPrice} each)`)
              break
            }
          }
          
          // If still no match, try combinations of two ticket types (simple greedy approach)
          if (!ticketSelection && eventTickets.length >= 2) {
            const orderTotal = parseFloat(order.total_amount.toString())
            for (let i = 0; i < eventTickets.length; i++) {
              for (let j = i; j < eventTickets.length; j++) {
                const price1 = parseFloat(eventTickets[i].price.toString())
                const price2 = parseFloat(eventTickets[j].price.toString())
                
                // Try different quantity combinations
                for (let q1 = 1; q1 <= 10; q1++) {
                  const remaining = orderTotal - (price1 * q1)
                  if (remaining < 0) break
                  
                  const q2 = Math.round(remaining / price2)
                  if (q2 > 0 && Math.abs(remaining - (price2 * q2)) < 0.01) {
                    ticketSelection = [
                      { ticketTypeId: eventTickets[i].id, quantity: q1 },
                      { ticketTypeId: eventTickets[j].id, quantity: q2 }
                    ]
                    console.log(`[Complete Purchase] Reconstructed ticket selection: ${q1} x ${eventTickets[i].name} + ${q2} x ${eventTickets[j].name}`)
                    break
                  }
                }
                if (ticketSelection) break
              }
              if (ticketSelection) break
            }
          }
        }
      }
    }
    
    // Final check - if still no selection, return error
    if (!ticketSelection || ticketSelection.length === 0) {
      processingOrders.delete(orderId) // Remove from processing set before error
      console.error(`[Complete Purchase] Failed for order ${orderId}: Ticket selection not found. Event: ${event?.id}, Total: ${order.total_amount}, Base Price: ${event?.base_ticket_price}`)
      return NextResponse.json(
        { error: 'Ticket selection not found. Please try purchasing again.' },
        { status: 400 }
      )
    }
    
    console.log(`[Complete Purchase] Processing order ${orderId} with ticket selection:`, JSON.stringify(ticketSelection))
    const customerName = order.customer_name
    const customerEmail = order.customer_email

    // Update order payment status
    const { error: updateError } = await supabase
      .from('ticket_orders')
      .update({
        payment_status: 'paid',
        payment_method: paymentMethod,
        payment_transaction_id: paymentTransactionId,
        status: 'confirmed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)

    if (updateError) {
      processingOrders.delete(orderId) // Remove from processing set
      console.error('Error updating order:', updateError)
      return NextResponse.json(
        { error: 'Failed to update order' },
        { status: 500 }
      )
    }

    // Now create the tickets
    const purchasedTickets = []
    const ticketValidations = []

    // Validate and prepare tickets (use ticketSelection which was fetched from storage)
    for (const ticketItem of ticketSelection) {
      if (ticketItem.ticketTypeId === 'base') {
        if (!event.base_ticket_price) {
          processingOrders.delete(orderId) // Remove from processing set
          return NextResponse.json(
            { error: 'Base ticket price not set for this event' },
            { status: 400 }
          )
        }
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
        continue
      }

      const { data: ticketType, error: ticketError } = await supabase
        .from('event_tickets')
        .select('*')
        .eq('id', ticketItem.ticketTypeId)
        .eq('event_id', order.event_id)
        .single()

      if (ticketError || !ticketType) {
        processingOrders.delete(orderId) // Remove from processing set
        return NextResponse.json(
          { error: `Ticket type ${ticketItem.ticketTypeId} not found` },
          { status: 404 }
        )
      }

      // Check availability
      const available = (ticketType.quantity_total || 999999) - ticketType.quantity_sold
      if (ticketItem.quantity > available) {
        processingOrders.delete(orderId) // Remove from processing set
        return NextResponse.json(
          { error: `Only ${available} ${ticketType.name} tickets available` },
          { status: 400 }
        )
      }

      ticketValidations.push({ ticketType, quantity: ticketItem.quantity })
    }

    // Create tickets
    for (const validation of ticketValidations) {
      const { ticketType, quantity } = validation

      // Handle base ticket price
      let actualTicketTypeId = ticketType.id
      if (ticketType.id === 'base') {
        // Check if default ticket type exists
        const { data: existingDefaultTicket } = await supabase
          .from('event_tickets')
          .select('id')
          .eq('event_id', order.event_id)
          .eq('name', 'General Admission')
          .single()

        if (existingDefaultTicket) {
          actualTicketTypeId = existingDefaultTicket.id
        } else {
          // Create default ticket type
          const { data: newTicketType, error: ticketTypeError } = await supabase
            .from('event_tickets')
            .insert({
              event_id: order.event_id,
              name: 'General Admission',
              price: event.base_ticket_price,
              currency: event.ticket_currency || 'USD',
              quantity_total: null,
              quantity_sold: 0,
            })
            .select()
            .single()

          if (ticketTypeError || !newTicketType) {
            console.error('Error creating default ticket type:', ticketTypeError)
            continue
          }
          actualTicketTypeId = newTicketType.id
        }
      }

      for (let i = 0; i < quantity; i++) {
        const ticketNumber = await generateTicketNumber()

        const qrData = JSON.stringify({
          ticketId: crypto.randomUUID(),
          orderId: order.id,
          eventId: order.event_id,
          ticketNumber: ticketNumber,
          timestamp: Date.now(),
        })

        const qrHash = crypto.createHash('sha256').update(qrData).digest('hex')

        const qrCodeImage = await QRCode.toDataURL(qrData, {
          errorCorrectionLevel: 'H',
          type: 'image/png',
          width: 300,
          margin: 2,
        })

        const { data: purchasedTicket, error: ticketError } = await supabase
          .from('purchased_tickets')
          .insert({
            ticket_order_id: order.id,
            event_ticket_id: actualTicketTypeId,
            ticket_number: ticketNumber,
            qr_code_data: qrData,
            qr_code_hash: qrHash,
            status: 'valid',
            customer_name: customerName,
            ticket_type_name: ticketType.name,
            price_paid: parseFloat(ticketType.price.toString()),
          })
          .select()
          .single()

        if (ticketError) {
          console.error('Ticket creation error:', ticketError)
          continue
        }

        purchasedTickets.push({
          ...purchasedTicket,
          qr_code_image: qrCodeImage,
        })
      }

      // Update ticket type quantity sold
      if (ticketType.id !== 'base') {
        await supabase
          .from('event_tickets')
          .update({ quantity_sold: (ticketType.quantity_sold || 0) + quantity })
          .eq('id', ticketType.id)
      } else {
        // Update default ticket type quantity
        const { data: currentTicketType } = await supabase
          .from('event_tickets')
          .select('quantity_sold')
          .eq('id', actualTicketTypeId)
          .single()
        
        if (currentTicketType) {
          await supabase
            .from('event_tickets')
            .update({ quantity_sold: (currentTicketType.quantity_sold || 0) + quantity })
            .eq('id', actualTicketTypeId)
        }
      }
    }

    // Delete stored ticket selection (no longer needed)
    // Note: This table may not exist, so we'll catch the error gracefully
    try {
      await supabase
        .from('ticket_order_selections')
        .delete()
        .eq('ticket_order_id', orderId)
    } catch (err) {
      // Table doesn't exist or error - that's okay, continue
      console.log('Note: ticket_order_selections table not found, skipping cleanup')
    }

    // Send email with tickets using the new email service (non-blocking)
    // This is fire-and-forget - purchase succeeds even if email fails
    // Use environment variable if available, otherwise construct from request URL
    let siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL
    if (!siteUrl) {
      const url = new URL(request.url)
      siteUrl = `${url.protocol}//${url.host}`
    }
    siteUrl = siteUrl.replace(/\/$/, '')
    fetch(`${siteUrl}/api/tickets/send-email-new`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: order.id,
        customerEmail: customerEmail,
      }),
    }).then(response => {
      if (!response.ok) {
        console.error(`[Complete Purchase] Email sending failed for order ${order.id} (HTTP ${response.status})`)
      } else {
        console.log(`[Complete Purchase] Email sent successfully for order ${order.id}`)
      }
    }).catch(err => {
      console.error(`[Complete Purchase] Failed to send ticket email for order ${order.id}:`, err)
      // Don't fail the purchase if email fails - tickets are already created
    })

    // Remove from processing set on success
    processingOrders.delete(orderId)
    
    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        orderNumber: order.order_number,
        totalAmount: order.total_amount,
        status: order.status,
      },
      tickets: purchasedTickets,
      event: {
        id: event.id,
        title: event.title,
        slug: event.slug,
      },
      redirectUrl: `/events/${event.slug}/tickets/${order.id}`,
      eventSlug: event.slug,
    })
  } catch (error: any) {
    // Remove from processing set on error
    if (orderId) {
      processingOrders.delete(orderId)
    }
    console.error('[Complete Purchase] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

