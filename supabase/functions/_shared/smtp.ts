// Shared SMTP sending utility for Edge Functions
// Uses a simple HTTP-based approach since Deno doesn't have native SMTP libraries

export interface SMTPConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
  fromName: string;
}

export interface EmailData {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmailViaSMTP(
  config: SMTPConfig,
  email: EmailData
): Promise<boolean> {
  // Since Deno Edge Functions don't have good SMTP libraries,
  // we'll use the Next.js API route as an SMTP gateway
  // This allows Edge Functions to send emails while keeping SMTP logic in Next.js
  
  const nextApiUrl = Deno.env.get("NEXT_PUBLIC_BASE_URL") || Deno.env.get("NEXT_PUBLIC_SITE_URL");
  const internalApiKey = Deno.env.get("INTERNAL_API_KEY");

  if (!nextApiUrl) {
    console.error("NEXT_PUBLIC_BASE_URL not configured");
    return false;
  }

  if (!internalApiKey) {
    console.error("INTERNAL_API_KEY not configured");
    return false;
  }

  try {
    const response = await fetch(`${nextApiUrl}/api/email/internal/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${internalApiKey}`,
      },
      body: JSON.stringify({
        to: email.to,
        subject: email.subject,
        html: email.html,
        text: email.text,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Email sending failed:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error calling email API:", error);
    return false;
  }
}

