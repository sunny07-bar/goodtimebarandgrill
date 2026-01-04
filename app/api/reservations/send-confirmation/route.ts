import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { sendEmail } from '@/lib/email/service';
import { generateReservationConfirmationEmail } from '@/lib/email/templates';
import { convert24To12, formatFloridaTime } from '@/lib/utils/timezone';
import { sendReservationEmail as sendReservationEmailViaEdgeFunction } from '@/lib/supabase/edge-functions';

// Set to true to use Edge Functions, false to use direct SMTP
const USE_EDGE_FUNCTIONS = process.env.USE_EDGE_FUNCTIONS === 'true';

export async function POST(request: NextRequest) {
  if (!supabase) {
    return NextResponse.json(
      { error: 'Database service unavailable' },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const { reservationId } = body;

    if (!reservationId) {
      return NextResponse.json(
        { error: 'Reservation ID is required' },
        { status: 400 }
      );
    }

    // Get reservation details
    const { data: reservation, error: reservationError } = await supabase
      .from('reservations')
      .select('*')
      .eq('id', reservationId)
      .single();

    if (reservationError || !reservation) {
      return NextResponse.json(
        { error: 'Reservation not found' },
        { status: 404 }
      );
    }

    if (!reservation.customer_email) {
      return NextResponse.json(
        { error: 'No email address found for this reservation' },
        { status: 400 }
      );
    }

    // Format date and time (using Florida timezone)
    // reservation_date is a DATE type (YYYY-MM-DD), format directly without timezone conversion
    const { formatDateOnlyMMDDYYYY, getDayOfWeekInFlorida } = require('@/lib/utils/timezone');
    const reservationDateFormatted = formatDateOnlyMMDDYYYY(reservation.reservation_date);
    // Get day of week using Florida timezone
    const dayOfWeekIndex = getDayOfWeekInFlorida(reservation.reservation_date);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayOfWeek = dayNames[dayOfWeekIndex];
    const reservationDate = `${dayOfWeek}, ${reservationDateFormatted}`;

    const reservationTime = convert24To12(reservation.reservation_time);

    // Send email (via Edge Function or direct SMTP)
    // Note: Emails are only for confirmation - no prepayment info included
    let emailSent = false;
    
    const USE_EDGE_FUNCTIONS = process.env.USE_EDGE_FUNCTIONS === 'true';
    const NEXT_PUBLIC_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || '';
    const isProduction = NEXT_PUBLIC_BASE_URL && !NEXT_PUBLIC_BASE_URL.includes('localhost');
    
    // Only use Edge Functions in production (not on localhost)
    if (USE_EDGE_FUNCTIONS && process.env.NEXT_PUBLIC_SUPABASE_URL && isProduction) {
      // Use Edge Function - it will call this API route
      emailSent = await sendReservationEmailViaEdgeFunction(reservationId);
    } else {
      // Use direct SMTP - simple confirmation email only (no prepayment info)
      const emailHtml = generateReservationConfirmationEmail({
        reservationNumber: reservation.id.slice(0, 8).toUpperCase(),
        customerName: reservation.customer_name,
        reservationDate,
        reservationTime,
        guestsCount: reservation.guests_count,
        specialNotes: reservation.notes || undefined,
        // No prepayment info in emails
        prepaymentRequired: false,
        prepaymentAmount: undefined,
        paymentUrl: undefined,
      });

      const emailResult = await sendEmail({
        to: reservation.customer_email,
        subject: `Reservation Confirmed - Good Times Bar & Grill`,
        html: emailHtml,
      });
      emailSent = emailResult.success;
      if (!emailSent) {
        console.error(`[Reservation Email] Failed to send: ${emailResult.error || 'Unknown error'}`);
      }
    }

    // Log email sending result (email failure shouldn't block confirmation)
    if (!emailSent) {
      console.error(`[Reservation Email] Failed to send confirmation email for reservation ${reservationId} to ${reservation.customer_email}`);
      // Return success anyway - reservation is confirmed, email is non-critical
      return NextResponse.json({
        success: false,
        message: 'Reservation confirmed but email sending failed.',
        warning: 'Email delivery failed',
      }, { status: 200 }); // Return 200 so it doesn't break the flow
    }

    console.log(`[Reservation Email] Successfully sent confirmation email for reservation ${reservationId}`);
    return NextResponse.json({
      success: true,
      message: 'Confirmation email sent successfully',
    });

  } catch (error: any) {
    console.error('Error sending reservation confirmation email:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

