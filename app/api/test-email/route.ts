
import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email/service';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { email } = body;

        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        // Check env vars (redacted)
        const debugInfo = {
            SMTP_HOST: process.env.SMTP_HOST || 'MISSING',
            SMTP_PORT: process.env.SMTP_PORT || 'MISSING',
            SMTP_USER: process.env.SMTP_USER ? (process.env.SMTP_USER.includes('@') ? 'SET (format appears correct)' : 'SET (warning: no @ symbol)') : 'MISSING',
            SMTP_PASSWORD: process.env.SMTP_PASSWORD ? 'SET' : 'MISSING',
            SMTP_FROM: process.env.SMTP_FROM || 'MISSING',
        };

        console.log('[Test Email] Attempting to send test email to:', email);
        console.log('[Test Email] Debug info:', debugInfo);

        const result = await sendEmail({
            to: email,
            subject: 'Test Email - Good Times Bar & Grill',
            html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h1>Test Email</h1>
          <p>This is a test email from the Good Times Bar & Grill debug tool.</p>
          <p>If you received this, your email configuration is working correctly!</p>
          <hr />
          <h3>Debug Info:</h3>
          <pre>${JSON.stringify(debugInfo, null, 2)}</pre>
          <p>Timestamp: ${new Date().toISOString()}</p>
        </div>
      `,
        });

        if (!result.success) {
            console.error('[Test Email] Failed:', result.error);
            return NextResponse.json({
                success: false,
                error: result.error,
                debugInfo
            }, { status: 500 });
        }

        console.log('[Test Email] Success');
        return NextResponse.json({
            success: true,
            message: 'Test email sent successfully',
            debugInfo
        });

    } catch (error: any) {
        console.error('[Test Email] Error:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Unknown error',
        }, { status: 500 });
    }
}
