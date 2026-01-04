import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { sendEmail } from '@/lib/email/service';
import { generateTicketEmail } from '@/lib/email/templates';
import { formatFloridaTime, toFloridaTime } from '@/lib/utils/timezone';
import { sendTicketEmail as sendTicketEmailViaEdgeFunction } from '@/lib/supabase/edge-functions';
import QRCode from 'qrcode';

export async function POST(request: NextRequest) {
  if (!supabase) {
    return NextResponse.json(
      { error: 'Database service unavailable' },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const { orderId, customerEmail } = body;

    if (!orderId || !customerEmail) {
      return NextResponse.json(
        { error: 'Order ID and customer email are required' },
        { status: 400 }
      );
    }

    // Get order and tickets
    const { data: order, error: orderError } = await supabase
      .from('ticket_orders')
      .select(`
        *,
        events (
          id,
          title,
          event_start,
          event_end,
          location
        ),
        purchased_tickets (
          id,
          ticket_number,
          qr_code_data,
          qr_code_hash,
          ticket_type_name,
          price_paid,
          customer_name
        )
      `)
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    if (!order.purchased_tickets || order.purchased_tickets.length === 0) {
      return NextResponse.json(
        { error: 'No tickets found for this order' },
        { status: 404 }
      );
    }

    // Prepare event data
    const event = order.events;
    const eventTime = formatFloridaTime(event.event_start, 'h:mm a');
    const formattedEventDate = formatFloridaTime(event.event_start, 'EEEE, MM-dd-yyyy');
    
    // Generate QR codes for ALL tickets and prepare attachments
    const ticketsWithQR: Array<{
      ticketNumber: string;
      ticketTypeName: string;
      pricePaid: number;
      qrCodeCid: string; // Content-ID for email attachment
    }> = [];
    const emailAttachments: Array<{
      filename: string;
      content: Buffer | string;
      contentType: string;
      cid: string;
    }> = [];

    for (const ticket of order.purchased_tickets) {
      try {
        const qrCodeDataUrl = await QRCode.toDataURL(ticket.qr_code_data, {
          errorCorrectionLevel: 'H',
          type: 'image/png',
          width: 300,
          margin: 2,
        });

        // Extract base64 content from data URL and convert to Buffer
        const base64Data = qrCodeDataUrl.split(',')[1];
        const qrBuffer = Buffer.from(base64Data, 'base64');
        const cid = `qr-${ticket.ticket_number.replace(/[^a-zA-Z0-9]/g, '-')}@ticket`;

        // Add to attachments (nodemailer accepts Buffer or string)
        emailAttachments.push({
          filename: `qr-code-${ticket.ticket_number}.png`,
          content: qrBuffer,
          contentType: 'image/png',
          cid: cid,
        });

        ticketsWithQR.push({
          ticketNumber: ticket.ticket_number,
          ticketTypeName: ticket.ticket_type_name || 'General Admission',
          pricePaid: parseFloat(ticket.price_paid?.toString() || '0'),
          qrCodeCid: cid, // Use CID instead of data URL
        });
      } catch (qrError) {
        console.error(`Failed to generate QR code for ticket ${ticket.ticket_number}:`, qrError);
        // Add ticket without QR code
        ticketsWithQR.push({
          ticketNumber: ticket.ticket_number,
          ticketTypeName: ticket.ticket_type_name || 'General Admission',
          pricePaid: parseFloat(ticket.price_paid?.toString() || '0'),
          qrCodeCid: '', // Empty if QR generation failed
        });
      }
    }

    // Calculate total
    const totalAmount = order.purchased_tickets.reduce(
      (sum: number, ticket: any) => sum + parseFloat(ticket.price_paid?.toString() || '0'),
      0
    );
    
    // Send email (via Edge Function or direct SMTP)
    let emailSent = false;
    
    const USE_EDGE_FUNCTIONS = process.env.USE_EDGE_FUNCTIONS === 'true';
    const NEXT_PUBLIC_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || '';
    const isProduction = NEXT_PUBLIC_BASE_URL && !NEXT_PUBLIC_BASE_URL.includes('localhost');
    
    // Only use Edge Functions in production (not on localhost)
    if (USE_EDGE_FUNCTIONS && process.env.NEXT_PUBLIC_SUPABASE_URL && isProduction) {
      // Use Edge Function - it will call this API route
      emailSent = await sendTicketEmailViaEdgeFunction(orderId, customerEmail);
    } else {
      // Use direct SMTP
      const emailHtml = generateTicketEmail({
        eventTitle: event.title,
        eventDate: formattedEventDate,
        eventTime: eventTime,
        eventLocation: event.location || 'TBD',
        customerName: order.customer_name,
        orderNumber: order.order_number || orderId.slice(0, 8).toUpperCase(),
        totalAmount: totalAmount,
        tickets: ticketsWithQR,
      });

      const emailResult = await sendEmail({
        to: customerEmail,
        subject: `Your Tickets for ${event.title} - Good Times Bar & Grill`,
        html: emailHtml,
        attachments: emailAttachments,
      });
      emailSent = emailResult.success;
      if (!emailSent) {
        console.error(`[Send Email] Failed to send: ${emailResult.error || 'Unknown error'}`);
      }
    }

    // Log email sending result (but don't fail if email fails - tickets are already created)
    if (!emailSent) {
      console.error(`[Send Email] Failed to send ticket email for order ${orderId} to ${customerEmail}`);
      // Return success anyway - tickets are already created, email is non-critical
      // Customer can access tickets via the website
      return NextResponse.json({
        success: false,
        message: 'Tickets created but email sending failed. Customer can access tickets via the website.',
        warning: 'Email delivery failed',
      }, { status: 200 }); // Return 200 so it doesn't break the flow
    }

    console.log(`[Send Email] Successfully sent ticket email for order ${orderId} to ${customerEmail}`);
    return NextResponse.json({
      success: true,
      message: 'Ticket email sent successfully',
    });

  } catch (error: any) {
    console.error('Error sending ticket email:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
