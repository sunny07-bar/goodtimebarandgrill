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

    // Use database function to redeem ticket
    const { data: redemptionResult, error: redemptionError } = await supabase.rpc(
      'redeem_ticket',
      {
        p_qr_code_hash: qrHash,
        p_redeemed_by: staffId || null,
        p_location: location || null,
      }
    )

    if (redemptionError) {
      console.error('Redemption error:', redemptionError)
      return NextResponse.json(
        { error: 'Failed to verify ticket' },
        { status: 500 }
      )
    }

    // Parse the result (it's returned as jsonb)
    const result = typeof redemptionResult === 'string' 
      ? JSON.parse(redemptionResult) 
      : redemptionResult

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          message: result.message,
          ...(result.ticket_number && { ticket_number: result.ticket_number }),
          ...(result.redeemed_at && { redeemed_at: result.redeemed_at }),
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      ticket_number: result.ticket_number,
      customer_name: result.customer_name,
      ticket_type: result.ticket_type,
      redeemed_at: result.redeemed_at,
    })
  } catch (error: any) {
    console.error('Ticket verification error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

