// Helper functions to call Supabase Edge Functions for email sending

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function sendOTPEmail(email: string, otp: string): Promise<boolean> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/send-otp-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ email, otp }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Edge Function error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error calling send-otp-email Edge Function:', error);
    return false;
  }
}

export async function sendTicketEmail(orderId: string, customerEmail: string): Promise<boolean> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/send-ticket-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ orderId, customerEmail }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Edge Function error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error calling send-ticket-email Edge Function:', error);
    return false;
  }
}

export async function sendReservationEmail(reservationId: string): Promise<boolean> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/send-reservation-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ reservationId }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Edge Function error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error calling send-reservation-email Edge Function:', error);
    return false;
  }
}

