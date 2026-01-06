import nodemailer from 'nodemailer';

// Email service configuration for Hostinger/GoDaddy/Office 365/Custom domains
function createTransport() {
  const host = process.env.SMTP_HOST || 'smtpout.secureserver.net';
  // Default to 465 for Hostinger (tested and working), fallback to 587 for other providers
  const port = parseInt(process.env.SMTP_PORT || (host.includes('hostinger.com') ? '465' : '587'));
  const isOffice365 = host.includes('office365.com') || host.includes('outlook.com');
  const isGmail = host.includes('gmail.com');
  const isHostinger = host.includes('hostinger.com') || host.includes('hpanel.net') || host.includes('titan.email');
  
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

  // Hostinger/Titan Email configuration
  if (isHostinger) {
    // Trim credentials first (important for authentication)
    const trimmedUser = smtpUser.trim();
    const trimmedPassword = smtpPassword.trim();
    
    // Update auth with trimmed values
    config.auth = {
      user: trimmedUser,
      pass: trimmedPassword,
    };
    
    // Hostinger uses port 587 with STARTTLS (TLS) or port 465 with SSL
    if (port === 587) {
      // Port 587 with STARTTLS (TLS encryption)
      config.secure = false; // Use STARTTLS for port 587
      config.requireTLS = true; // Require TLS encryption
      config.tls = {
        rejectUnauthorized: false,
        minVersion: 'TLSv1.2',
      };
    } else if (port === 465) {
      // Port 465 with SSL - EXACT match to working test script
      config.secure = true; // Use SSL for port 465
      config.tls = {
        rejectUnauthorized: false,
        minVersion: 'TLSv1', // Must be TLSv1 for port 465
      };
      // Ensure requireTLS is NOT set for port 465
      config.requireTLS = false;
    }
    // Add connection timeouts (increased for slower SMTP servers)
    config.connectionTimeout = 30000; // 30 seconds
    config.greetingTimeout = 30000; // 30 seconds
    config.socketTimeout = 30000; // 30 seconds
    
    // Hostinger/Titan requires full email as username
    if (trimmedUser && !trimmedUser.includes('@')) {
      console.warn('[Email] Hostinger/Titan Email typically requires full email address as SMTP_USER');
    }
  } else if (isOffice365) {
    // Office 365 configuration
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

  console.log(`[Email] Creating transporter: ${host}:${port} (Hostinger: ${isHostinger}, Office365: ${isOffice365}, Gmail: ${isGmail})`);
  console.log(`[Email] Auth user: "${config.auth.user}" (length: ${config.auth.user.length})${config.auth.user.includes('@') ? '' : ' ⚠️ WARNING: Username does not contain @'}`);
  console.log(`[Email] Auth password length: ${config.auth.pass.length} characters`);
  console.log(`[Email] Security: secure=${config.secure}, requireTLS=${config.requireTLS || false}`);
  if (isHostinger && port === 465) {
    console.log(`[Email] Port 465 SSL config: secure=${config.secure}, minVersion=${config.tls?.minVersion || 'not set'}, requireTLS=${config.requireTLS || false}`);
    console.log(`[Email] ✅ Configuration matches working test script`);
  }
  return nodemailer.createTransport(config);
}

// Cache transporter to avoid recreating connection every time
let cachedTransport: nodemailer.Transporter | null = null;
let lastConfigHash: string = '';
let connectionVerified: boolean = false;

function getConfigHash(): string {
  return `${process.env.SMTP_HOST || ''}-${process.env.SMTP_PORT || ''}-${process.env.SMTP_USER || ''}`;
}

function isHostingerProvider(): boolean {
  const host = process.env.SMTP_HOST || '';
  return host.includes('hostinger.com') || host.includes('hpanel.net') || host.includes('titan.email');
}

// Create transporter with caching (only recreate if config changes)
// Note: For Hostinger, we create a fresh transporter each time as caching can cause auth issues
function getTransport(): nodemailer.Transporter {
  const currentHash = getConfigHash();
  const isHostinger = isHostingerProvider();
  
  // For Hostinger, always create a fresh transporter (don't cache)
  // This prevents authentication issues that can occur with cached connections
  if (isHostinger) {
    console.log('[Email] Creating fresh transporter for Hostinger (caching disabled)');
    return createTransport();
  }
  
  // For other providers, use caching
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
    // Get raw environment variables (before trimming)
    const rawSmtpUser = process.env.SMTP_USER;
    const rawSmtpPassword = process.env.SMTP_PASSWORD;
    
    if (!rawSmtpUser || !rawSmtpPassword) {
      const errorMsg = 'SMTP credentials not configured. Please set SMTP_USER and SMTP_PASSWORD in .env.local';
      console.error('[Email]', errorMsg);
      return { success: false, error: errorMsg };
    }

    const smtpHost = process.env.SMTP_HOST || 'smtpout.secureserver.net';
    // Default to port 465 for Hostinger (tested and working), otherwise 587
    const defaultPort = (smtpHost.includes('hostinger.com') || smtpHost.includes('hpanel.net') || smtpHost.includes('titan.email')) ? '465' : '587';
    const smtpPort = process.env.SMTP_PORT || defaultPort;
    
    // Trim credentials (important for Hostinger)
    const smtpUser = rawSmtpUser.trim();
    const smtpPassword = rawSmtpPassword.trim();
    
    // Debug: Check for common issues
    if (smtpUser !== rawSmtpUser || smtpPassword !== rawSmtpPassword) {
      console.log('[Email] ⚠️ Credentials had whitespace - trimmed');
    }
    
    // Determine from email - prefer SMTP_FROM, fallback to SMTP_USER (might be full email)
    let fromEmail = options.from || process.env.SMTP_FROM;
    
    // Clean up malformed SMTP_FROM (handle format like 'Name" <email>' or '"email"')
    if (fromEmail) {
      // Extract email from format "Name" <email@domain.com>
      if (fromEmail.includes('<') && fromEmail.includes('>')) {
        const emailMatch = fromEmail.match(/<([^>]+)>/);
        if (emailMatch) {
          fromEmail = emailMatch[1]; // Extract just the email
        }
      }
      // Remove any remaining quotes
      fromEmail = fromEmail.replace(/^["']|["']$/g, '').trim();
    }
    
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
    // Note: Some SMTP servers (like Hostinger) may have issues with verify(),
    // so we'll attempt sending even if verify fails, and catch errors during actual send
    let verificationFailed = false;
    let verificationError: any = null;
    
    if (!connectionVerified) {
      try {
        await transporter.verify();
        connectionVerified = true;
        console.log('[Email] ✓ SMTP connection verified (cached for future emails)');
      } catch (verifyError: any) {
        // Don't fail immediately - some servers (like Hostinger) may have verify() issues
        // but still allow actual email sending. We'll try to send anyway.
        verificationFailed = true;
        verificationError = verifyError;
        console.warn('[Email] ⚠️ SMTP verification failed, but attempting to send anyway:', verifyError.message);
        console.warn('[Email]   (Some SMTP servers have issues with verify() but still allow sending)');
      }
    }

    try {
      const result = await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || options.html.replace(/<[^>]*>/g, ''), // Strip HTML for text version
        attachments: options.attachments || [],
      });

      // Mark as verified if send succeeded (even if verify() failed)
      // Note: For Hostinger, we always create fresh transporters, so connectionVerified stays false
      // but that's okay since we don't cache for Hostinger anyway
      if (verificationFailed && !isHostingerProvider() && !connectionVerified) {
        connectionVerified = true;
        console.log('[Email] ✓ Email sent successfully (connection verified via send)');
      }

      // Only log success for first email or in development
      if (!connectionVerified || process.env.NODE_ENV === 'development' || isHostingerProvider()) {
        console.log(`[Email] ✓ Sent email to ${options.to}: ${options.subject} (MessageID: ${result.messageId})`);
      }
      return { success: true };
    } catch (sendError: any) {
      // Clear cached transporter if send fails - force recreation on next attempt
      // For Hostinger, transporter is always fresh anyway, but clear cache for other providers
      if (!isHostingerProvider()) {
        cachedTransport = null;
      }
      connectionVerified = false;
      
      // If verification also failed, combine error messages
      if (verificationFailed && sendError.code === 'EAUTH') {
        let errorMsg = `SMTP authentication failed: ${sendError.message || 'Unable to authenticate with email server'}`;
        
        // Provide helpful guidance based on error
        if (sendError.message?.includes('Authentication Failed') || sendError.message?.includes('535')) {
            const isHostinger = (process.env.SMTP_HOST || '').includes('hostinger.com') || (process.env.SMTP_HOST || '').includes('hpanel.net') || (process.env.SMTP_HOST || '').includes('titan.email');
          
          if (isHostinger) {
            errorMsg += '\n\nTroubleshooting tips:';
            errorMsg += '\n1. ✅ Hostinger requires full email address as SMTP_USER (e.g., support@goodtimesbarandgrill.com)';
            errorMsg += '\n2. Verify SMTP_HOST is "smtp.hostinger.com" or "smtp.titan.email"';
            errorMsg += '\n3. For Hostinger, use SMTP_PORT 465 (SSL) or 587 (STARTTLS)';
            errorMsg += '\n4. Ensure SMTP_PASSWORD is correct (check your Hostinger email account password)';
            errorMsg += '\n5. Verify SMTP_FROM is set to your email address if different from SMTP_USER';
            errorMsg += '\n6. Make sure SMTP authentication is enabled in your Hostinger email settings';
          } else {
            errorMsg += '\n\nTroubleshooting tips:';
            errorMsg += '\n1. Check if SMTP_USER should be the full email (e.g., store@zeecrown.in) or just username (store)';
            errorMsg += '\n2. Verify SMTP_HOST matches your email provider';
            errorMsg += '\n3. Ensure SMTP_PASSWORD is correct (some providers require an app-specific password)';
            errorMsg += '\n4. Try SMTP_PORT 587 (STARTTLS) or 465 (SSL)';
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
      
      // Re-throw other errors to be handled by outer catch
      throw sendError;
    }
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
