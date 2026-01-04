export function generateOTPEmail(otp: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Email Verification</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #f4f4f4; padding: 20px; border-radius: 5px;">
        <h2 style="color: #2c3e50; margin-top: 0;">Email Verification</h2>
        <p>Thank you for your interest! Please use the following code to verify your email address:</p>
        <div style="background-color: #fff; padding: 20px; border-radius: 5px; text-align: center; margin: 20px 0;">
          <h1 style="color: #e74c3c; font-size: 32px; letter-spacing: 5px; margin: 0;">${otp}</h1>
        </div>
        <p>This code will expire in 10 minutes.</p>
        <p style="color: #7f8c8d; font-size: 12px; margin-top: 30px;">If you didn't request this code, please ignore this email.</p>
      </div>
    </body>
    </html>
  `;
}

export function generateTicketEmail(ticketData: {
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  eventLocation: string;
  customerName: string;
  orderNumber: string;
  totalAmount: number;
  tickets: Array<{
    ticketNumber: string;
    ticketTypeName: string;
    pricePaid: number;
    qrCodeCid: string; // Content-ID for email attachment instead of URL
  }>;
}): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Your Event Tickets</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
        .ticket { background: white; border: 2px solid #e5e7eb; border-radius: 10px; padding: 20px; margin: 20px 0; }
        .ticket-header { border-bottom: 2px solid #e5e7eb; padding-bottom: 15px; margin-bottom: 15px; }
        .qr-code { text-align: center; margin: 20px 0; }
        .qr-code img { max-width: 250px; height: auto; border: 3px solid #dc2626; padding: 10px; background: white; }
        .ticket-info { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 15px 0; }
        .info-item { padding: 10px; background: #f3f4f6; border-radius: 5px; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0;">🎟️ Your Event Tickets</h1>
          <p style="margin: 10px 0 0 0;">Order #${ticketData.orderNumber}</p>
        </div>
        <div class="content">
          <h2 style="color: #2c3e50; margin-top: 0;">${ticketData.eventTitle}</h2>
          <p><strong>Date:</strong> ${ticketData.eventDate}</p>
          <p><strong>Time:</strong> ${ticketData.eventTime}</p>
          <p><strong>Location:</strong> ${ticketData.eventLocation}</p>
          <p><strong>Customer:</strong> ${ticketData.customerName}</p>
          <p><strong>Total Paid:</strong> $${ticketData.totalAmount.toFixed(2)}</p>
          
          <h3 style="margin-top: 30px; color: #2c3e50;">Your Tickets (${ticketData.tickets.length})</h3>
          
          ${ticketData.tickets.map((ticket, index) => `
            <div class="ticket">
              <div class="ticket-header">
                <h3 style="margin: 0; color: #27ae60;">${ticket.ticketTypeName} - Ticket #${index + 1}</h3>
                <p style="margin: 5px 0 0 0;"><strong>Ticket Number:</strong> ${ticket.ticketNumber}</p>
              </div>
              <div class="qr-code">
                ${ticket.qrCodeCid ? `<img src="cid:${ticket.qrCodeCid}" alt="QR Code for Ticket ${ticket.ticketNumber}" style="max-width: 250px; height: auto; border: 3px solid #dc2626; padding: 10px; background: white;" />` : '<p style="color: #dc2626;">QR Code not available</p>'}
                <p style="margin-top: 10px; font-size: 12px; color: #6b7280;">Scan this QR code at the event entrance</p>
              </div>
              <div class="ticket-info">
                <div class="info-item">
                  <strong>Price Paid:</strong><br>$${ticket.pricePaid.toFixed(2)}
                </div>
              </div>
            </div>
          `).join('')}
          
          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <p style="margin: 0; font-weight: bold;">⚠️ Important:</p>
            <ul style="margin: 10px 0; padding-left: 20px;">
              <li>Each ticket can only be used once</li>
              <li>Please arrive at least 15 minutes before the event</li>
              <li>Bring a valid ID that matches the name on the ticket</li>
              <li>Keep this email safe - you'll need to show the QR code at the entrance</li>
            </ul>
          </div>
          
          <div class="footer">
            <p>Thank you for your purchase!</p>
            <p>If you have any questions, please contact us at support@goodtimesbar.com</p>
            <p style="margin-top: 20px; font-size: 10px; color: #9ca3af;">
              This is an automated email. Please do not reply.
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

export function generateReservationConfirmationEmail(reservationData: {
  reservationNumber: string;
  customerName: string;
  reservationDate: string;
  reservationTime: string;
  guestsCount: number;
  specialNotes?: string;
  prepaymentRequired?: boolean;
  prepaymentAmount?: number;
  paymentUrl?: string;
}): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reservation Confirmed</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #f4f4f4; padding: 30px; border-radius: 5px;">
        <h2 style="color: #27ae60; margin-top: 0;">✓ Reservation Confirmed</h2>
        
        <div style="background-color: #fff; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <p>Dear ${reservationData.customerName},</p>
          <p>Your reservation has been confirmed! We look forward to seeing you.</p>
          
          <div style="border-left: 4px solid #27ae60; padding-left: 15px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Reservation Number:</strong> ${reservationData.reservationNumber}</p>
            <p style="margin: 5px 0;"><strong>Date:</strong> ${reservationData.reservationDate}</p>
            <p style="margin: 5px 0;"><strong>Time:</strong> ${reservationData.reservationTime}</p>
            <p style="margin: 5px 0;"><strong>Number of Guests:</strong> ${reservationData.guestsCount}</p>
            ${reservationData.specialNotes ? `<p style="margin: 5px 0;"><strong>Special Notes:</strong> ${reservationData.specialNotes}</p>` : ''}
          </div>
        </div>

        <!-- Prepayment section removed - emails are only for confirmation -->

        <div style="background-color: #ecf0f1; padding: 15px; border-radius: 5px; margin-top: 20px;">
          <p style="margin: 0; font-size: 14px;"><strong>Please note:</strong></p>
          <ul style="margin: 10px 0; padding-left: 20px; font-size: 14px;">
            <li>Please arrive on time for your reservation</li>
            <li>If you need to cancel or modify, please contact us at least 24 hours in advance</li>
            <li>We look forward to serving you!</li>
          </ul>
        </div>

        <p style="color: #7f8c8d; font-size: 12px; margin-top: 30px;">
          Thank you for choosing Good Times Bar & Grill!<br>
          If you have any questions, please don't hesitate to contact us.
        </p>
      </div>
    </body>
    </html>
  `;
}

export function generateReservationPendingEmail(reservationData: {
  reservationNumber: string;
  customerName: string;
  reservationDate: string;
  reservationTime: string;
  guestsCount: number;
}): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reservation Received</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #f4f4f4; padding: 30px; border-radius: 5px;">
        <h2 style="color: #f39c12; margin-top: 0;">Reservation Received</h2>
        
        <div style="background-color: #fff; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <p>Dear ${reservationData.customerName},</p>
          <p>We have received your reservation request and it is currently pending confirmation.</p>
          
          <div style="border-left: 4px solid #f39c12; padding-left: 15px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Reservation Number:</strong> ${reservationData.reservationNumber}</p>
            <p style="margin: 5px 0;"><strong>Date:</strong> ${reservationData.reservationDate}</p>
            <p style="margin: 5px 0;"><strong>Time:</strong> ${reservationData.reservationTime}</p>
            <p style="margin: 5px 0;"><strong>Number of Guests:</strong> ${reservationData.guestsCount}</p>
          </div>

          <p>We will review your reservation and send you a confirmation email shortly.</p>
        </div>

        <p style="color: #7f8c8d; font-size: 12px; margin-top: 30px;">
          Thank you for choosing Good Times Bar & Grill!
        </p>
      </div>
    </body>
    </html>
  `;
}
