import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email/service';
import { generateOTPEmail as generateOTPEmailTemplate } from '@/lib/email/templates';
import { storeOTP } from '@/lib/email/otp-store';
import { sendOTPEmail as sendOTPEmailViaEdgeFunction } from '@/lib/supabase/edge-functions';
import { isEmailVerified } from '@/lib/email/verified-emails';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    // Normalize and validate email
    const normalizedEmail = email ? email.toLowerCase().trim() : '';
    
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return NextResponse.json(
        { error: 'Valid email address is required' },
        { status: 400 }
      );
    }

    // Check if email is already verified
    const verifiedEntry = await isEmailVerified(normalizedEmail);
    if (verifiedEntry) {
      const daysRemaining = Math.floor(
        (new Date(verifiedEntry.expires_at).getTime() - new Date().getTime()) / (24 * 60 * 60 * 1000)
      );
      console.log(`[OTP Send] Email ${normalizedEmail} is already verified (${daysRemaining} days remaining)`);
      return NextResponse.json({
        success: true,
        message: 'Email is already verified',
        alreadyVerified: true,
        daysRemaining,
      });
    }

    // Check if SMTP is configured
    if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
      console.error('[OTP] SMTP not configured');
      return NextResponse.json(
        { error: 'Email service not configured. Please contact support.' },
        { status: 500 }
      );
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expirationMinutes = 10; // OTP expires in 10 minutes
    console.log(`[OTP Send] Generated OTP for ${normalizedEmail}: ${otp} (expires in ${expirationMinutes} minutes)`);

    // Store OTP (expires in 10 minutes = 600 seconds)
    await storeOTP(normalizedEmail, otp, expirationMinutes);
    
    // Verify it was stored correctly
    const { getOTP } = await import('@/lib/email/otp-store');
    const stored = await getOTP(normalizedEmail);
    if (stored) {
      const expiresAt = new Date(stored.expiresAt);
      const now = new Date();
      const minutesRemaining = Math.floor((stored.expiresAt - now.getTime()) / 60000);
      console.log(`[OTP Send] ✓ OTP stored successfully for ${normalizedEmail}`);
      console.log(`[OTP Send]   Expires at: ${expiresAt.toISOString()} (in ${minutesRemaining} minutes)`);
      console.log(`[OTP Send]   Current time: ${now.toISOString()}`);
    } else {
      console.error(`[OTP Send] ✗ Failed to store OTP for ${normalizedEmail}`);
    }

    // Send OTP email (via Edge Function or direct SMTP)
    let emailResult: { success: boolean; error?: string } = { success: false };
    
    const USE_EDGE_FUNCTIONS = process.env.USE_EDGE_FUNCTIONS === 'true';
    const NEXT_PUBLIC_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || '';
    const isProduction = NEXT_PUBLIC_BASE_URL && !NEXT_PUBLIC_BASE_URL.includes('localhost');
    
    // Only use Edge Functions in production (not on localhost)
    if (USE_EDGE_FUNCTIONS && process.env.NEXT_PUBLIC_SUPABASE_URL && isProduction) {
      console.log('[OTP Send] Using Edge Function for', normalizedEmail);
      const edgeResult = await sendOTPEmailViaEdgeFunction(normalizedEmail, otp);
      emailResult = { success: edgeResult };
    } else {
      // Use direct SMTP (current setup - works for local and production)
      console.log('[OTP Send] Using direct SMTP for', normalizedEmail);
      emailResult = await sendEmail({
        to: normalizedEmail,
        subject: 'Email Verification Code - Good Times Bar & Grill',
        html: generateOTPEmailTemplate(otp),
      });
    }

    if (!emailResult.success) {
      // Clean up stored OTP if email failed
      const { deleteOTP } = await import('@/lib/email/otp-store');
      await deleteOTP(normalizedEmail);
      
      // Use the specific error message from the email service, or provide a generic one
      const errorMessage = emailResult.error || 'Failed to send verification email. Please check your email settings or try again later.';
      
      console.error('[OTP Send] Email sending failed:', errorMessage);
      
      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Verification code sent to your email',
    });

  } catch (error: any) {
    console.error('Error sending OTP:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

