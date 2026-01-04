// API route to check if an email is already verified
import { NextRequest, NextResponse } from 'next/server';
import { isEmailVerified } from '@/lib/email/verified-emails';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Normalize email (lowercase and trim)
    const normalizedEmail = email.toLowerCase().trim();

    // Check if email is verified
    const verifiedEntry = await isEmailVerified(normalizedEmail);

    if (verifiedEntry) {
      const expiresAt = new Date(verifiedEntry.expires_at);
      const now = new Date();
      const daysRemaining = Math.floor((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

      const response = NextResponse.json({
        verified: true,
        expiresAt: verifiedEntry.expires_at,
        daysRemaining,
        verifiedAt: verifiedEntry.verified_at,
      });
      
      // Cache verified status for 5 minutes
      response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
      
      return response;
    }

    const response = NextResponse.json({
      verified: false,
    });
    
    // Cache negative results for 1 minute
    response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
    
    return response;

  } catch (error: any) {
    console.error('[Check Verified] Error checking verified email:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

