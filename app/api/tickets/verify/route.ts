import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  if (!supabase) {
    return NextResponse.json(
      { error: 'Database service unavailable. Please check configuration.' },
      { status: 503 }
    )
  }

  try {
    const body = await request.json()
    const { qrCodeData, location, staffId } = body

    if (!qrCodeData) {
      return NextResponse.json(
        { error: 'QR code data is required' },
        { status: 400 }
      )
    }

    // Determine string representation of QR code data
    let qrDataString: string = typeof qrCodeData === 'string' ? qrCodeData.trim() : JSON.stringify(qrCodeData)

    // Unescape if wrapped in quotes
    if ((qrDataString.startsWith('"') && qrDataString.endsWith('"')) || (qrDataString.startsWith("'") && qrDataString.endsWith("'"))) {
      try {
        const unescaped = JSON.parse(qrDataString)
        if (typeof unescaped === 'string') qrDataString = unescaped.trim()
      } catch (e) {}
    }

    // Compute hash of the string
    const qrHash = crypto.createHash('sha256').update(qrDataString).digest('hex')

    // Extract ticket number and other fields if available
    let extractedTicketNumber: string | null = null
    let extractedOrderId: string | null = null
    let extractedTicketId: string | null = null

    try {
      const parsed = typeof qrCodeData === 'object' ? qrCodeData : JSON.parse(qrDataString)
      if (parsed) {
        if (parsed.ticketNumber) extractedTicketNumber = String(parsed.ticketNumber).trim()
        if (parsed.orderId) extractedOrderId = String(parsed.orderId).trim()
        if (parsed.ticketId) extractedTicketId = String(parsed.ticketId).trim()
      }
    } catch {
      // Not JSON string
    }

    // If no ticket number extracted yet, check regex or prefix
    if (!extractedTicketNumber) {
      const tktMatch = qrDataString.match(/TKT-[A-Z0-9-]+/i)
      if (tktMatch) {
        extractedTicketNumber = tktMatch[0]
      } else if (/^[A-Z0-9-]{6,}$/i.test(qrDataString)) {
        extractedTicketNumber = qrDataString
      }
    }

    // If string is a URL, extract order UUID if present
    if (qrDataString.includes('http://') || qrDataString.includes('https://')) {
      const uuidMatch = qrDataString.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
      if (uuidMatch && !extractedOrderId) extractedOrderId = uuidMatch[0]
    }

    // Lookup ticket in purchased_tickets table
    let ticket: any = null

    const ticketSelectFields = `
      id,
      ticket_number,
      customer_name,
      ticket_type_name,
      status,
      checked_in,
      checked_in_at,
      redeemed_at,
      ticket_orders (
        events (
          title,
          event_start,
          event_end,
          location
        )
      )
    `

    // 1. First by ticket number (case-insensitive ilike)
    if (extractedTicketNumber) {
      const { data } = await supabase
        .from('purchased_tickets')
        .select(ticketSelectFields)
        .ilike('ticket_number', extractedTicketNumber)
        .maybeSingle()
      if (data) ticket = data
    }

    // 2. Next by ticket primary key (UUID)
    const targetTicketId = extractedTicketId || (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(qrDataString) ? qrDataString : null)
    if (!ticket && targetTicketId) {
      const { data } = await supabase
        .from('purchased_tickets')
        .select(ticketSelectFields)
        .eq('id', targetTicketId)
        .maybeSingle()
      if (data) ticket = data
    }

    // 3. Next by qr_code_hash
    if (!ticket) {
      const { data } = await supabase
        .from('purchased_tickets')
        .select(ticketSelectFields)
        .eq('qr_code_hash', qrHash)
        .maybeSingle()
      if (data) ticket = data
    }

    // 4. In case the input string is already the raw 64-char sha256 hash
    if (!ticket && qrDataString.length === 64) {
      const { data } = await supabase
        .from('purchased_tickets')
        .select(ticketSelectFields)
        .eq('qr_code_hash', qrDataString)
        .maybeSingle()
      if (data) ticket = data
    }

    // 5. Fallback by orderId (selects first unused ticket in order, or first ticket)
    if (!ticket && extractedOrderId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(extractedOrderId)) {
      const { data: orderTickets } = await supabase
        .from('purchased_tickets')
        .select(ticketSelectFields)
        .eq('ticket_order_id', extractedOrderId)
        .order('created_at', { ascending: true })

      if (orderTickets && orderTickets.length > 0) {
        ticket = orderTickets.find((t: any) => t.status === 'valid' && !t.checked_in) || orderTickets[0]
      }
    }

    if (!ticket) {
      return NextResponse.json(
        {
          success: false,
          error: 'ticket_not_found',
          message: 'Ticket not found. Please verify the QR code or ticket number.',
        },
        { status: 404 }
      )
    }

    const eventObj = (ticket.ticket_orders as any)?.events || null
    const eventTitle = eventObj?.title || null
    const eventStart = eventObj?.event_start || null
    const eventEnd = eventObj?.event_end || null
    const eventLocation = eventObj?.location || null

    // Check if ticket was already checked in or used
    if (ticket.status === 'used' || ticket.checked_in === true) {
      const redeemedTime = ticket.redeemed_at || ticket.checked_in_at || new Date().toISOString()
      return NextResponse.json(
        {
          success: false,
          error: 'already_redeemed',
          message: 'Ticket has already been used / checked in.',
          ticket_number: ticket.ticket_number,
          customer_name: ticket.customer_name,
          ticket_type: ticket.ticket_type_name,
          event_title: eventTitle,
          event_start: eventStart,
          event_end: eventEnd,
          event_location: eventLocation,
          redeemed_at: redeemedTime,
        },
        { status: 400 }
      )
    }

    // Check if ticket was cancelled or refunded
    if (ticket.status === 'cancelled' || ticket.status === 'refunded') {
      return NextResponse.json(
        {
          success: false,
          error: 'invalid_ticket',
          message: `Ticket is ${ticket.status}. Entry not permitted.`,
          ticket_number: ticket.ticket_number,
          customer_name: ticket.customer_name,
          ticket_type: ticket.ticket_type_name,
          event_title: eventTitle,
          event_start: eventStart,
          event_end: eventEnd,
          event_location: eventLocation,
        },
        { status: 400 }
      )
    }

    // Mark ticket as checked in / used
    const nowIso = new Date().toISOString()
    const validStaffUuid = (typeof staffId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(staffId)) ? staffId : null

    const { error: updateError } = await supabase
      .from('purchased_tickets')
      .update({
        status: 'used',
        checked_in: true,
        checked_in_at: nowIso,
        redeemed_at: nowIso,
        redeemed_by: validStaffUuid,
        redeemed_location: location || 'Main Entrance',
        redemption_location: location || 'Main Entrance',
        updated_at: nowIso,
      })
      .eq('id', ticket.id)

    if (updateError) {
      console.error('Failed to update ticket status:', updateError)
      return NextResponse.json(
        {
          success: false,
          error: 'update_error',
          message: 'Failed to update ticket check-in status: ' + updateError.message,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Ticket verified and checked in successfully!',
      ticket_number: ticket.ticket_number,
      customer_name: ticket.customer_name,
      ticket_type: ticket.ticket_type_name,
      event_title: eventTitle,
      event_start: eventStart,
      event_end: eventEnd,
      event_location: eventLocation,
      redeemed_at: nowIso,
    })
  } catch (error: any) {
    console.error('Ticket verification error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
