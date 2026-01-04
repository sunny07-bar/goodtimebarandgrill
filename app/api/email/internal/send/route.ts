// Internal API route for sending emails (called by Edge Functions)
// This route is protected and only accessible with an API key

import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email/service';

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || '';

export async function POST(request: NextRequest) {
  try {
    // Verify API key
    const authHeader = request.headers.get('authorization');
    const apiKey = authHeader?.replace('Bearer ', '');
    
    if (!INTERNAL_API_KEY || apiKey !== INTERNAL_API_KEY) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { to, subject, html, text } = body;

    if (!to || !subject || !html) {
      return NextResponse.json(
        { error: 'Missing required fields: to, subject, html' },
        { status: 400 }
      );
    }

    // Send email using existing service
    const emailResult = await sendEmail({
      to,
      subject,
      html,
      text,
    });

    if (!emailResult.success) {
      return NextResponse.json(
        { error: emailResult.error || 'Failed to send email' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Email sent successfully',
    });

  } catch (error: any) {
    console.error('Error in internal send email:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

