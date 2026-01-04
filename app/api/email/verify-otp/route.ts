import { NextRequest, NextResponse } from 'next/server';
import { verifyOTP, getOTP } from '@/lib/email/otp-store';
import { storeVerifiedEmail } from '@/lib/email/verified-emails';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, otp } = body;

    if (!email || !otp) {
      return NextResponse.json(
        { error: 'Email and OTP are required' },
        { status: 400 }
      );
    }

    // Normalize email (lowercase and trim)
    const normalizedEmail = email.toLowerCase().trim();
    const normalizedOTP = otp.trim().replace(/\s/g, ''); // Remove any spaces

    console.log(`[OTP Verify] Attempting to verify OTP for ${normalizedEmail}`);
    console.log(`[OTP Verify] Provided OTP length: ${normalizedOTP.length}, value: ${normalizedOTP}`);

    // Check if OTP exists first (this also checks expiration)
    const stored = await getOTP(normalizedEmail);
    
    if (!stored) {
      console.log(`[OTP Verify] OTP not found or expired for ${normalizedEmail}`);
      return NextResponse.json(
        { error: 'OTP not found or expired. Please request a new code.' },
        { status: 404 }
      );
    }

    const now = Date.now();
    const timeRemaining = stored.expiresAt - now;
    const secondsRemaining = Math.floor(timeRemaining / 1000);
    
    console.log(`[OTP Verify] Stored OTP: ${stored.otp}, Provided OTP: ${normalizedOTP}, Match: ${stored.otp === normalizedOTP}`);
    console.log(`[OTP Verify] Expires at: ${new Date(stored.expiresAt).toISOString()}, Current: ${new Date(now).toISOString()}, Time remaining: ${secondsRemaining}s`);

    // Verify OTP (this will delete it if successful)
    const isValid = await verifyOTP(normalizedEmail, normalizedOTP);

    if (!isValid) {
      console.log(`[OTP Verify] Invalid OTP for ${normalizedEmail}`);
      return NextResponse.json(
        { error: 'Invalid OTP. Please check the code and try again.' },
        { status: 400 }
      );
    }

    // Store verified email in database (expires in 30 days)
    await storeVerifiedEmail(normalizedEmail, 30);

    console.log(`[OTP Verify] ✓ Successfully verified OTP for ${normalizedEmail}`);
    return NextResponse.json({
      success: true,
      message: 'Email verified successfully',
      verified: true,
    });

  } catch (error: any) {
    console.error('[OTP Verify] Error verifying OTP:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

