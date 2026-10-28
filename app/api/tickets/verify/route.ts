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

    // QR code data is stored as a JSON string in the database
    // We need to hash it exactly as it was stored (as a string, not parsed)
    let qrDataString: string
    
    if (typeof qrCodeData === 'string') {
      // If it's already a string, use it directly (this is how it's stored in DB)
      qrDataString = qrCodeData
    } else {
      // If it's an object, stringify it (shouldn't happen, but handle it)
      qrDataString = JSON.stringify(qrCodeData)
    }

    // Generate hash from QR data string (must match how it was hashed during purchase)
    const qrHash = crypto.createHash('sha256').update(qrDataString).digest('hex')

    // Extract ticket number if input was JSON or a direct ticket number string
    let extractedTicketNumber: string | null = null
    try {
      const parsed = typeof qrCodeData === 'object' ? qrCodeData : JSON.parse(qrDataString)
      if (parsed && parsed.ticketNumber) {
        extractedTicketNumber = parsed.ticketNumber
      }
    } catch {
      // Not JSON, check if it looks like a ticket number (e.g., TKT-...)
      if (qrDataString.startsWith('TKT-') || qrDataString.length > 5) {
        extractedTicketNumber = qrDataString.trim()
      }
    }

    // Attempt 1: Try database RPC function 'redeem_ticket'
    try {
      const { data: redemptionResult, error: redemptionError } = await supabase.rpc(
        'redeem_ticket',
        {
          p_qr_code_hash: qrHash,
          p_redeemed_by: staffId || null,
          p_location: location || null,
        }
      )

      if (!redemptionError && redemptionResult) {
        const result = typeof redemptionResult === 'string' 
          ? JSON.parse(redemptionResult) 
          : redemptionResult

        if (result.success) {
          return NextResponse.json({
            success: true,
            message: result.message || 'Ticket verified successfully',
            ticket_number: result.ticket_number,
            customer_name: result.customer_name,
            ticket_type: result.ticket_type,
            redeemed_at: result.redeemed_at || new Date().toISOString(),
          })
        } else if (result.error === 'already_redeemed') {
          return NextResponse.json(
            {
              success: false,
              error: result.error,
              message: result.message || 'Ticket has already been redeemed',
              ticket_number: result.ticket_number,
              redeemed_at: result.redeemed_at,
            },
            { status: 400 }
          )
        }
      }
    } catch (rpcErr) {
      console.warn('RPC redeem_ticket failed or unavailable, falling back to direct query:', rpcErr)
    }

    // Attempt 2: Direct lookup in purchased_tickets table (supports both QR hash & manual ticket number entry)
    let ticketQuery = supabase
      .from('purchased_tickets')
      .select('id, ticket_number, customer_name, ticket_type_name, status, updated_at, qr_code_hash')

    if (extractedTicketNumber) {
      ticketQuery = ticketQuery.or(`qr_code_hash.eq.${qrHash},ticket_number.eq.${extractedTicketNumber}`)
    } else {
      ticketQuery = ticketQuery.eq('qr_code_hash', qrHash)
    }

    const { data: ticket, error: ticketError } = await ticketQuery.maybeSingle()

    if (ticketError || !ticket) {
      return NextResponse.json(
        {
          success: false,
          error: 'ticket_not_found',
          message: 'Ticket not found. Please verify the QR code or ticket number.',
        },
        { status: 404 }
      )
    }

    // Check status
    if (ticket.status === 'used') {
      return NextResponse.json(
        {
          success: false,
          error: 'already_redeemed',
          message: 'Ticket has already been used / checked in.',
          ticket_number: ticket.ticket_number,
          customer_name: ticket.customer_name,
          ticket_type: ticket.ticket_type_name,
          redeemed_at: ticket.updated_at,
        },
        { status: 400 }
      )
    }

    if (ticket.status === 'cancelled' || ticket.status === 'refunded') {
      return NextResponse.json(
        {
          success: false,
          error: 'invalid_ticket',
          message: `Ticket is ${ticket.status}. Entry not permitted.`,
          ticket_number: ticket.ticket_number,
          customer_name: ticket.customer_name,
          ticket_type: ticket.ticket_type_name,
        },
        { status: 400 }
      )
    }

    // Mark ticket as used/checked in
    const nowIso = new Date().toISOString()
    const { error: updateError } = await supabase
      .from('purchased_tickets')
      .update({
        status: 'used',
        updated_at: nowIso,
      })
      .eq('id', ticket.id)

    if (updateError) {
      console.error('Failed to update ticket status:', updateError)
      return NextResponse.json(
        {
          success: false,
          error: 'update_error',
          message: 'Failed to update ticket check-in status',
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

