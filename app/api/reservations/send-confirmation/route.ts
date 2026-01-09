import { NextRequest, NextResponse } from 'next/server';
import { sendReservationConfirmationEmail } from '@/lib/email/reservation-confirmation';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { reservationId } = body;

    // Use shared function
    const result = await sendReservationConfirmationEmail(reservationId);

    if (!result.success) {
      // Return 200 even on email failure to not break client flows (consistent with previous behavior)
      // unless it's a bad request (missing ID) which the shared function handles by returning error
      // But preserving original API behavior:
      if (result.error === 'Reservation ID is required') {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      if (result.error === 'Reservation not found') {
        return NextResponse.json({ error: result.error }, { status: 404 });
      }

      return NextResponse.json({
        success: false,
        message: 'Reservation confirmed but email sending failed.',
        warning: result.error,
      }, { status: 200 });
    }

    return NextResponse.json({
      success: true,
      message: 'Confirmation email sent successfully',
    });

  } catch (error: any) {
    console.error('Error in confirmation email API:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

