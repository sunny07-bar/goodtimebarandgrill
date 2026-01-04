// Supabase Edge Function to send reservation confirmation emails
// Calls Next.js API route which handles SMTP

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

interface ReservationEmailRequest {
  reservationId: string;
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

    const { reservationId } = await req.json() as ReservationEmailRequest;

    if (!reservationId) {
      return new Response(
        JSON.stringify({ error: "Reservation ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call Next.js API route to send email
    const nextApiUrl = Deno.env.get("NEXT_PUBLIC_BASE_URL") || Deno.env.get("NEXT_PUBLIC_SITE_URL") || "http://localhost:3000";
    
    const response = await fetch(`${nextApiUrl}/api/reservations/send-confirmation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("INTERNAL_API_KEY") || ""}`,
      },
      body: JSON.stringify({
        reservationId,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to send reservation email");
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Reservation confirmation email sent successfully"
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error sending reservation email:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Failed to send reservation email",
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
