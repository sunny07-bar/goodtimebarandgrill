import nodemailer from 'nodemailer';

// Email service configuration for GoDaddy/Office 365/Custom domains
function createTransport() {
  const host = process.env.SMTP_HOST || 'smtpout.secureserver.net';
  const port = parseInt(process.env.SMTP_PORT || '587');
  const isOffice365 = host.includes('office365.com') || host.includes('outlook.com');
  const isGmail = host.includes('gmail.com');
  
  // Determine if SMTP_USER is a full email or just username
  const smtpUser = process.env.SMTP_USER || '';
  const smtpPassword = process.env.SMTP_PASSWORD || '';

  const config: any = {
    host,
    port,
    auth: {
      user: smtpUser,
      pass: smtpPassword,
    },
  };

  // Office 365 configuration
  if (isOffice365) {
    if (port === 587) {
      config.secure = false; // Use STARTTLS
      config.requireTLS = true;
    } else if (port === 465) {
      config.secure = true; // Use SSL
    }
    config.tls = {
      minVersion: 'TLSv1.2',
      ciphers: 'TLSv1.2',
      rejectUnauthorized: false,
    };
  } else if (isGmail) {
    // Gmail configuration
    if (port === 587) {
      config.secure = false;
      config.requireTLS = true;
    } else if (port === 465) {
      config.secure = true;
    }
    config.tls = {
      rejectUnauthorized: false,
    };
  } else {
    // GoDaddy/Custom domain servers
    config.secure = port === 465;
    config.requireTLS = port === 587;
    config.tls = {
      rejectUnauthorized: false,
    };
  }

  console.log(`[Email] Creating transporter: ${host}:${port} (Office365: ${isOffice365}, Gmail: ${isGmail})`);
  console.log(`[Email] Auth user: ${smtpUser.includes('@') ? smtpUser : smtpUser + ' (username only)'}`);
  return nodemailer.createTransport(config);
}

// Cache transporter to avoid recreating connection every time
let cachedTransport: nodemailer.Transporter | null = null;
let lastConfigHash: string = '';
let connectionVerified: boolean = false;

function getConfigHash(): string {
  return `${process.env.SMTP_HOST || ''}-${process.env.SMTP_PORT || ''}-${process.env.SMTP_USER || ''}`;
}

// Create transporter with caching (only recreate if config changes)
function getTransport(): nodemailer.Transporter {
  const currentHash = getConfigHash();
  
  // Reuse cached transporter if config hasn't changed
  if (cachedTransport && lastConfigHash === currentHash) {
    return cachedTransport;
  }
  
  // Create new transporter if config changed or first time
  cachedTransport = createTransport();
  lastConfigHash = currentHash;
  connectionVerified = false; // Reset verification status
  return cachedTransport;
}

export interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  contentType?: string;
  cid?: string; // Content-ID for inline images
}

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  attachments?: EmailAttachment[];
}

export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
  try {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
      const errorMsg = 'SMTP credentials not configured. Please set SMTP_USER and SMTP_PASSWORD in .env.local';
      console.error('[Email]', errorMsg);
      return { success: false, error: errorMsg };
    }

    const smtpHost = process.env.SMTP_HOST || 'smtpout.secureserver.net';
    const smtpPort = process.env.SMTP_PORT || '587';
    const smtpUser = process.env.SMTP_USER;
    
    // Determine from email - prefer SMTP_FROM, fallback to SMTP_USER (might be full email)
    let fromEmail = options.from || process.env.SMTP_FROM;
    if (!fromEmail) {
      // If SMTP_USER is a full email, use it; otherwise construct from domain
      if (smtpUser.includes('@')) {
        fromEmail = smtpUser;
      } else {
        // Try to extract domain from SMTP_HOST or use a default
        const domain = smtpHost.includes('.') 
          ? smtpHost.split('.').slice(-2).join('.') 
          : 'example.com';
        fromEmail = `${smtpUser}@${domain}`;
      }
    }
    const fromName = process.env.SMTP_FROM_NAME || 'Good Times Bar & Grill';
    
    // Reduced logging for performance (only log first email or errors)
    if (!connectionVerified) {
      console.log(`[Email] Attempting to send email to ${options.to} via ${smtpHost}:${smtpPort}`);
      console.log(`[Email] From: "${fromName}" <${fromEmail}>`);
    }

    // Create transporter with current env vars (cached)
    const transporter = getTransport();

    // Skip verification if already verified (saves ~1-2 seconds per email)
    // Only verify on first email or if config changed
    if (!connectionVerified) {
      try {
        await transporter.verify();
        connectionVerified = true;
        console.log('[Email] ✓ SMTP connection verified (cached for future emails)');
      } catch (verifyError: any) {
        let errorMsg = `SMTP connection failed: ${verifyError.message || 'Unable to connect to email server'}`;
        
        // Provide helpful guidance based on error
        if (verifyError.message?.includes('Authentication Failed') || verifyError.message?.includes('535')) {
          // Check for Office365 SMTP authentication disabled error
          if (verifyError.message?.includes('SmtpClientAuthentication is disabled')) {
            errorMsg += '\n\n⚠️ Office365 SMTP Authentication is disabled for your tenant.';
            errorMsg += '\n\nTo fix this:';
            errorMsg += '\n1. Go to Microsoft 365 Admin Center → Settings → Org settings → Mail';
            errorMsg += '\n2. Enable "SMTP AUTH" for your organization or specific mailbox';
            errorMsg += '\n3. Or use an App Password instead of regular password';
            errorMsg += '\n4. Or switch to a different email provider (e.g., Hostinger, GoDaddy)';
            errorMsg += '\n\nSee: https://aka.ms/smtp_auth_disabled';
          } else {
            errorMsg += '\n\nTroubleshooting tips:';
            errorMsg += '\n1. Check if SMTP_USER should be the full email (e.g., store@zeecrown.in) or just username (store)';
            errorMsg += '\n2. Verify SMTP_HOST matches your email provider (e.g., mail.zeecrown.in, smtp.zeecrown.in, or your hosting provider\'s SMTP)';
            errorMsg += '\n3. Ensure SMTP_PASSWORD is correct (some providers require an app-specific password)';
            errorMsg += '\n4. Try SMTP_PORT 587 (STARTTLS) or 465 (SSL)';
            if (!process.env.SMTP_HOST) {
              errorMsg += '\n5. ⚠️ SMTP_HOST is not set - using default GoDaddy server. Set SMTP_HOST for your domain!';
            }
          }
        }
        
        console.error('[Email] ✗', errorMsg);
        console.error('[Email] Connection details:', {
          host: smtpHost,
          port: smtpPort,
          user: smtpUser ? (smtpUser.includes('@') ? smtpUser : smtpUser + ' (username only)') : 'MISSING',
          password: process.env.SMTP_PASSWORD ? '***configured***' : 'MISSING',
          fromEmail,
        });
        return { success: false, error: errorMsg };
      }
    }

    const result = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, ''), // Strip HTML for text version
      attachments: options.attachments || [],
    });

    // Only log success for first email or in development
    if (!connectionVerified || process.env.NODE_ENV === 'development') {
      console.log(`[Email] ✓ Sent email to ${options.to}: ${options.subject} (MessageID: ${result.messageId})`);
    }
    return { success: true };
  } catch (error: any) {
    let errorMessage = 'Failed to send email';
    
    // Provide more specific error messages
    if (error.code === 'EAUTH') {
      errorMessage = 'SMTP authentication failed. Please check your email credentials.';
    } else if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
      errorMessage = 'Unable to connect to email server. Please check your SMTP settings.';
    } else if (error.code === 'EENVELOPE') {
      errorMessage = 'Invalid email address. Please check the recipient email.';
    } else if (error.responseCode) {
      errorMessage = `Email server error (${error.responseCode}): ${error.response || error.message}`;
    } else if (error.message) {
      errorMessage = `Email error: ${error.message}`;
    }
    
    console.error('[Email] ✗ Error sending email:', {
      message: error.message,
      code: error.code,
      responseCode: error.responseCode,
      response: error.response,
      command: error.command,
      stack: error.stack,
    });
    
    return { success: false, error: errorMessage };
  }
}

export async function verifyEmailConnection(): Promise<boolean> {
  try {
    const smtpHost = process.env.SMTP_HOST || 'smtpout.secureserver.net';
    const smtpPort = process.env.SMTP_PORT || '587';
    console.log(`[Email] Testing SMTP connection to ${smtpHost}:${smtpPort}`);
    const transporter = getTransport();
    await transporter.verify();
    console.log('[Email] ✓ SMTP server is ready to send emails');
    return true;
  } catch (error: any) {
    console.error('[Email] ✗ SMTP connection failed:', {
      message: error.message,
      code: error.code,
      responseCode: error.responseCode,
      response: error.response,
      command: error.command,
    });
    return false;
  }
}
