// Supabase Edge Function to send ticket confirmation emails
// Calls Next.js API route which handles SMTP

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

interface TicketEmailRequest {
  orderId: string;
  customerEmail: string;
}

serve(async (req) => {
  try {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    };

    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    const { orderId, customerEmail } = await req.json() as TicketEmailRequest;

    if (!orderId || !customerEmail) {
      return new Response(
        JSON.stringify({ error: "Order ID and customer email are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call Next.js API route to send email
    // The API route handles all the complexity (QR codes, email generation, SMTP)
    const nextApiUrl = Deno.env.get("NEXT_PUBLIC_BASE_URL") || Deno.env.get("NEXT_PUBLIC_SITE_URL") || "http://localhost:3000";
    
    const response = await fetch(`${nextApiUrl}/api/tickets/send-email-new`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("INTERNAL_API_KEY") || ""}`,
      },
      body: JSON.stringify({
        orderId,
        customerEmail,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to send ticket email");
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Ticket email sent successfully"
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error sending ticket email:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Failed to send ticket email",
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
