// Supabase Edge Function to send emails using SMTP
// This function handles all email types: OTP, tickets, reservations

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createTransport } from "https://deno.land/x/nodemailer@0.1.0/mod.ts";

interface EmailRequest {
  type: 'otp' | 'ticket' | 'reservation';
  to: string;
  subject: string;
  html: string;
  text?: string;
}

serve(async (req) => {
  try {
    // CORS headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    };

    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    const { type, to, subject, html, text } = await req.json() as EmailRequest;

    if (!type || !to || !subject || !html) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: type, to, subject, html" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get SMTP configuration from environment variables
    const smtpHost = Deno.env.get("SMTP_HOST") || "";
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "587");
    const smtpUser = Deno.env.get("SMTP_USER") || "";
    const smtpPassword = Deno.env.get("SMTP_PASSWORD") || "";
    const smtpFrom = Deno.env.get("SMTP_FROM") || smtpUser;
    const smtpFromName = Deno.env.get("SMTP_FROM_NAME") || "Good Times Bar & Grill";

    if (!smtpHost || !smtpUser || !smtpPassword) {
      return new Response(
        JSON.stringify({ error: "SMTP configuration missing" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Detect email provider for proper configuration
    const isHostinger = smtpHost.includes('hostinger.com') || smtpHost.includes('hpanel.net') || smtpHost.includes('titan.email');
    const isOffice365 = smtpHost.includes('office365.com') || smtpHost.includes('outlook.com');
    const isGmail = smtpHost.includes('gmail.com');

    // Configure transporter based on provider
    const transporterConfig: any = {
      host: smtpHost,
      port: smtpPort,
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
      tls: {
        rejectUnauthorized: false,
      },
    };

    // Hostinger/Titan Email configuration
    if (isHostinger) {
      // Hostinger uses port 587 with STARTTLS (TLS) - recommended setting
      // Alternative: port 465 with SSL
      if (smtpPort === 587) {
        // Port 587 with STARTTLS (TLS encryption) - Hostinger's recommended setting
        transporterConfig.secure = false; // Use STARTTLS for port 587
        transporterConfig.requireTLS = true; // Require TLS encryption
        transporterConfig.tls.minVersion = 'TLSv1.2';
      } else if (smtpPort === 465) {
        // Port 465 with SSL (alternative)
        transporterConfig.secure = true; // Use SSL
        transporterConfig.requireTLS = false;
        transporterConfig.tls.minVersion = 'TLSv1'; // Some servers need TLSv1
      }
      // Trim credentials (remove whitespace)
      transporterConfig.auth.user = smtpUser.trim();
      transporterConfig.auth.pass = smtpPassword.trim();
      // Add connection timeouts (increased for slower SMTP servers)
      transporterConfig.connectionTimeout = 30000; // 30 seconds
      transporterConfig.greetingTimeout = 30000; // 30 seconds
      transporterConfig.socketTimeout = 30000; // 30 seconds
    } else if (isOffice365) {
      // Office 365 configuration
      if (smtpPort === 587) {
        transporterConfig.secure = false; // Use STARTTLS
        transporterConfig.requireTLS = true;
      } else if (smtpPort === 465) {
        transporterConfig.secure = true; // Use SSL
      }
      transporterConfig.tls.minVersion = 'TLSv1.2';
    } else if (isGmail) {
      // Gmail configuration
      if (smtpPort === 587) {
        transporterConfig.secure = false;
        transporterConfig.requireTLS = true;
      } else if (smtpPort === 465) {
        transporterConfig.secure = true;
      }
    } else {
      // Default/GoDaddy configuration
      transporterConfig.secure = smtpPort === 465;
      transporterConfig.requireTLS = smtpPort === 587;
    }

    // Create transporter
    const transporter = createTransport(transporterConfig);

    // Send email
    const result = await transporter.sendMail({
      from: `"${smtpFromName}" <${smtpFrom}>`,
      to: to,
      subject: subject,
      html: html,
      text: text || html.replace(/<[^>]*>/g, ""),
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: result.messageId,
        message: "Email sent successfully"
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error sending email:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Failed to send email",
        details: error.toString()
      }),
      { status: 500, headers: { 
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Content-Type": "application/json" 
      } }
    );
  }
});

