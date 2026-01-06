#!/usr/bin/env node

/**
 * Email Test Script
 * Tests email sending functionality by sending a test email
 * 
 * Usage: node scripts/test-email.js
 * 
 * Make sure your .env.local file has:
 * - SMTP_HOST=smtp.hostinger.com
 * - SMTP_PORT=465
 * - SMTP_USER=support@goodtimesbarandgrill.com
 * - SMTP_PASSWORD=your_password
 * - SMTP_FROM=support@goodtimesbarandgrill.com (optional)
 * - SMTP_FROM_NAME=Good Times Bar & Grill (optional)
 */

// Load environment variables from .env.local
const fs = require('fs');
const path = require('path');

// Simple .env parser
function loadEnvFile(filePath) {
  try {
    const envContent = fs.readFileSync(filePath, 'utf8');
    const lines = envContent.split('\n');
    
    lines.forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').trim();
          // Remove quotes if present
          const cleanValue = value.replace(/^["']|["']$/g, '');
          process.env[key.trim()] = cleanValue;
        }
      }
    });
  } catch (error) {
    console.warn(`Warning: Could not load ${filePath}: ${error.message}`);
  }
}

// Load .env.local
const envPath = path.join(__dirname, '..', '.env.local');
loadEnvFile(envPath);

const nodemailer = require('nodemailer');

async function testEmail() {
  try {
    console.log('📧 Email Test Script\n');
    console.log('='.repeat(50));
    
    // Check environment variables
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = parseInt(process.env.SMTP_PORT || '587');
    const smtpUser = process.env.SMTP_USER;
    const smtpPassword = process.env.SMTP_PASSWORD;
    const smtpFrom = process.env.SMTP_FROM || smtpUser;
    const smtpFromName = process.env.SMTP_FROM_NAME || 'Good Times Bar & Grill';
    
    console.log('\n📋 Configuration Check:');
    console.log(`   SMTP_HOST: ${smtpHost || '❌ NOT SET'}`);
    console.log(`   SMTP_PORT: ${smtpPort || '❌ NOT SET'}`);
    console.log(`   SMTP_USER: ${smtpUser || '❌ NOT SET'}`);
    console.log(`   SMTP_PASSWORD: ${smtpPassword ? '✅ SET' : '❌ NOT SET'}`);
    console.log(`   SMTP_FROM: ${smtpFrom || 'Not set (will use SMTP_USER)'}`);
    console.log(`   SMTP_FROM_NAME: ${smtpFromName || 'Not set (will use default)'}`);
    
    if (!smtpHost || !smtpPort || !smtpUser || !smtpPassword) {
      console.error('\n❌ Error: Missing required SMTP configuration!');
      console.error('   Please check your .env.local file and ensure all required variables are set.');
      process.exit(1);
    }
    
    // Configure transporter based on Hostinger
    const isHostinger = smtpHost.includes('hostinger.com') || smtpHost.includes('hpanel.net');
    
    const config = {
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465, // true for 465, false for other ports
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
      tls: {
        rejectUnauthorized: false,
        minVersion: 'TLSv1.2',
      },
    };
    
    if (smtpPort === 587) {
      config.requireTLS = true;
    }
    
    console.log('\n🔧 Transporter Configuration:');
    console.log(`   Host: ${smtpHost}`);
    console.log(`   Port: ${smtpPort}`);
    console.log(`   Secure (SSL): ${config.secure}`);
    console.log(`   Require TLS: ${config.requireTLS || false}`);
    console.log(`   Hostinger Detected: ${isHostinger ? '✅ Yes' : '❌ No'}`);
    
    // Create transporter
    console.log('\n🔌 Creating SMTP connection...');
    const transporter = nodemailer.createTransport(config);
    
    // Verify connection
    console.log('🔍 Verifying SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection verified!\n');
    
    // Send test email
    console.log('🚀 Sending test email...');
    console.log('   To: alam014916@gmail.com');
    console.log('   Subject: Test Email from Good Times Bar & Grill');
    
    const testEmailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 10px 10px 0 0;
          }
          .content {
            background: #f9fafb;
            padding: 30px;
            border-radius: 0 0 10px 10px;
          }
          .success {
            background: #10b981;
            color: white;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
            text-align: center;
            font-weight: bold;
          }
          .details {
            background: white;
            padding: 20px;
            border-radius: 5px;
            margin: 20px 0;
            border-left: 4px solid #f97316;
          }
          .footer {
            text-align: center;
            color: #6b7280;
            font-size: 12px;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🎉 Email Test Successful!</h1>
          <p>Good Times Bar & Grill</p>
        </div>
        <div class="content">
          <div class="success">
            ✅ Your email configuration is working correctly!
          </div>
          
          <div class="details">
            <h2>Test Details</h2>
            <p><strong>Timestamp:</strong> ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} (EST)</p>
            <p><strong>SMTP Host:</strong> ${smtpHost}</p>
            <p><strong>SMTP Port:</strong> ${smtpPort}</p>
            <p><strong>SMTP User:</strong> ${smtpUser}</p>
          </div>
          
          <p>This is a test email to verify that your email sending functionality is configured correctly.</p>
          
          <p>If you received this email, it means:</p>
          <ul>
            <li>✅ SMTP connection is working</li>
            <li>✅ Authentication is successful</li>
            <li>✅ Emails can be sent successfully</li>
          </ul>
          
          <p>You can now send emails from your application!</p>
        </div>
        
        <div class="footer">
          <p>Good Times Bar & Grill</p>
          <p>This is an automated test email</p>
        </div>
      </body>
      </html>
    `;
    
    const testEmailText = `
Email Test Successful!

Your email configuration is working correctly!

Test Details:
- Timestamp: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} (EST)
- SMTP Host: ${smtpHost}
- SMTP Port: ${smtpPort}
- SMTP User: ${smtpUser}

This is a test email to verify that your email sending functionality is configured correctly.

If you received this email, it means:
- SMTP connection is working
- Authentication is successful
- Emails can be sent successfully

You can now send emails from your application!

---
Good Times Bar & Grill
This is an automated test email
    `;
    
    const result = await transporter.sendMail({
      from: `"${smtpFromName}" <${smtpFrom}>`,
      to: 'alam014916@gmail.com',
      subject: 'Test Email from Good Times Bar & Grill',
      html: testEmailHtml,
      text: testEmailText,
    });
    
    console.log('\n✅ SUCCESS! Test email sent successfully!');
    console.log(`   Message ID: ${result.messageId}`);
    console.log('   Please check the inbox for: alam014916@gmail.com');
    console.log('   (Also check spam/junk folder if not in inbox)');
    console.log('\n🎉 Email configuration is working correctly!');
    console.log('   You can now send emails from your application!');
    
  } catch (error) {
    console.error('\n❌ Error running email test:');
    console.error(`   Message: ${error.message}`);
    
    if (error.code) {
      console.error(`   Code: ${error.code}`);
    }
    
    if (error.responseCode) {
      console.error(`   Response Code: ${error.responseCode}`);
    }
    
    if (error.response) {
      console.error(`   Response: ${error.response}`);
    }
    
    if (error.message?.includes('Authentication Failed') || error.message?.includes('535')) {
      console.error('\n💡 Authentication Error - Troubleshooting:');
      console.error('   1. ✅ Verify SMTP_USER is the full email address (e.g., support@goodtimesbarandgrill.com)');
      console.error('   2. ✅ Ensure SMTP_PASSWORD is correct (use your email account password)');
      console.error('   3. ✅ Check if SMTP is enabled in your Hostinger email settings');
      console.error('   4. ✅ Try using port 587 (STARTTLS) instead of 465 (SSL) if authentication fails');
      console.error('   5. ✅ Make sure your email account allows SMTP access');
      
      if (smtpHost?.includes('hostinger.com')) {
        console.error('\n   Hostinger-specific tips:');
        console.error('   - Make sure you\'re using the full email address as SMTP_USER');
        console.error('   - Verify SMTP_HOST is "smtp.hostinger.com"');
        console.error('   - Check your Hostinger email account settings for SMTP access');
      }
    } else if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
      console.error('\n💡 Connection Error - Troubleshooting:');
      console.error('   1. Check SMTP_HOST is correct');
      console.error('   2. Verify SMTP_PORT is correct (465 for SSL, 587 for STARTTLS)');
      console.error('   3. Check your internet connection');
      console.error('   4. Verify firewall is not blocking SMTP ports');
    }
    
    console.error('\nStack trace:');
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
testEmail();

