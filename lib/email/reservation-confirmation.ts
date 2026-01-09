
import { supabase } from '@/lib/db';
import { sendEmail } from '@/lib/email/service';
import { generateReservationConfirmationEmail } from '@/lib/email/templates';
import { convert24To12, formatDateOnlyMMDDYYYY, getDayOfWeekInFlorida } from '@/lib/utils/timezone';
import { sendReservationEmail as sendReservationEmailViaEdgeFunction } from '@/lib/supabase/edge-functions';

// Shared function to send reservation confirmation email
export async function sendReservationConfirmationEmail(reservationId: string) {
    if (!reservationId) {
        return { success: false, error: 'Reservation ID is required' };
    }

    try {
        // Get reservation details
        // We need to use supabase client here. If this runs in a context where supabase isn't available
        // (unlikely given the imports), it will fail.
        // In API routes and Webhooks, supabase singleton should be available.
        if (!supabase) {
            return { success: false, error: 'Database service unavailable' };
        }

        const { data: reservation, error: reservationError } = await supabase
            .from('reservations')
            .select('*')
            .eq('id', reservationId)
            .single();

        if (reservationError || !reservation) {
            return { success: false, error: 'Reservation not found' };
        }

        if (!reservation.customer_email) {
            return { success: false, error: 'No email address found for this reservation' };
        }

        // Format date and time (using Florida timezone)
        const reservationDateFormatted = formatDateOnlyMMDDYYYY(reservation.reservation_date);
        const dayOfWeekIndex = getDayOfWeekInFlorida(reservation.reservation_date);
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayOfWeek = dayNames[dayOfWeekIndex];
        const reservationDate = `${dayOfWeek}, ${reservationDateFormatted}`;

        const reservationTime = convert24To12(reservation.reservation_time);

        // Send email (via Edge Function or direct SMTP)
        let emailSent = false;

        // Check environment variables for config
        const USE_EDGE_FUNCTIONS = process.env.USE_EDGE_FUNCTIONS === 'true';
        const NEXT_PUBLIC_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || '';
        const isProduction = NEXT_PUBLIC_BASE_URL && !NEXT_PUBLIC_BASE_URL.includes('localhost');

        // Only use Edge Functions in production (not on localhost)
        if (USE_EDGE_FUNCTIONS && process.env.NEXT_PUBLIC_SUPABASE_URL && isProduction) {
            // Use Edge Function
            emailSent = await sendReservationEmailViaEdgeFunction(reservationId);
        } else {
            // Use direct SMTP
            const emailHtml = generateReservationConfirmationEmail({
                reservationNumber: reservation.id.slice(0, 8).toUpperCase(),
                customerName: reservation.customer_name,
                reservationDate,
                reservationTime,
                guestsCount: reservation.guests_count,
                specialNotes: reservation.notes || undefined,
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
                return { success: false, error: emailResult.error || 'Email sending failed' };
            }
        }

        console.log(`[Reservation Email] Successfully sent confirmation email for reservation ${reservationId}`);
        return { success: true };

    } catch (error: any) {
        console.error('Error sending reservation confirmation email:', error);
        return { success: false, error: error.message || 'Internal server error' };
    }
}
