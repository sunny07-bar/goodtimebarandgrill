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
  subtotalAmount?: number;
  discountAmount?: number;
  promoCode?: string;
  tickets: Array<{
    ticketNumber: string;
    ticketTypeName: string;
    pricePaid: number;
    qrCodeCid: string; // Content-ID for email attachment instead of URL
  }>;
}): string {
  const hasDiscount = (ticketData.discountAmount && ticketData.discountAmount > 0) || false;
  const subtotal = ticketData.subtotalAmount ?? ticketData.totalAmount;
  const discount = ticketData.discountAmount ?? 0;

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Your Event Tickets - Good Times Bar & Grill</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #030712; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #f3f4f6;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #030712; padding: 30px 10px;">
        <tr>
          <td align="center">
            <!-- Main Card Container -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #0b0f19; border: 1px solid #1f2937; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
              
              <!-- Brand Header -->
              <tr>
                <td style="padding: 32px 24px 20px; text-align: center; background: #0b0f19;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td align="center">
                        <span style="font-size: 11px; font-weight: 700; letter-spacing: 3px; color: #f59e0b; text-transform: uppercase;">• LIVE MUSIC & DINING •</span>
                        <h1 style="margin: 8px 0 4px; font-size: 26px; font-weight: 900; color: #ffffff; letter-spacing: 1px; text-transform: uppercase;">
                          Good Times Bar &amp; Grill
                        </h1>
                        <p style="margin: 0; font-size: 13px; color: #9ca3af; letter-spacing: 0.5px;">
                          1720 Fennell St, Maitland, FL 32751
                        </p>
                        <!-- Golden Accent Divider -->
                        <div style="height: 2px; width: 80px; background-color: #f59e0b; margin: 16px auto 0; border-radius: 2px;"></div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Event Hero Card -->
              <tr>
                <td style="padding: 0 24px 20px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #111827; border: 1px solid #374151; border-top: 3px solid #f59e0b; border-radius: 12px; overflow: hidden;">
                    <tr>
                      <td style="padding: 24px;">
                        <span style="display: inline-block; font-size: 11px; font-weight: 700; color: #f59e0b; background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.3); padding: 3px 10px; border-radius: 6px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">
                          Official Event Admission
                        </span>
                        <h2 style="margin: 8px 0 16px; font-size: 22px; font-weight: 800; color: #ffffff; line-height: 1.3;">
                          ${ticketData.eventTitle}
                        </h2>

                        <!-- 2-Column Info Grid -->
                        <table width="100%" cellpadding="0" cellspacing="0" border="0">
                          <tr>
                            <td width="50%" valign="top" style="padding-bottom: 12px;">
                              <span style="font-size: 11px; text-transform: uppercase; color: #9ca3af; font-weight: 600; letter-spacing: 0.5px;">Date</span><br>
                              <strong style="font-size: 14px; color: #ffffff;">${ticketData.eventDate}</strong>
                            </td>
                            <td width="50%" valign="top" style="padding-bottom: 12px;">
                              <span style="font-size: 11px; text-transform: uppercase; color: #9ca3af; font-weight: 600; letter-spacing: 0.5px;">Time</span><br>
                              <strong style="font-size: 14px; color: #ffffff;">${ticketData.eventTime}</strong>
                            </td>
                          </tr>
                          <tr>
                            <td width="50%" valign="top">
                              <span style="font-size: 11px; text-transform: uppercase; color: #9ca3af; font-weight: 600; letter-spacing: 0.5px;">Customer</span><br>
                              <strong style="font-size: 14px; color: #ffffff;">${ticketData.customerName}</strong>
                            </td>
                            <td width="50%" valign="top">
                              <span style="font-size: 11px; text-transform: uppercase; color: #9ca3af; font-weight: 600; letter-spacing: 0.5px;">Order Ref</span><br>
                              <span style="font-family: monospace; font-size: 13px; color: #fbbf24; background: #1f2937; padding: 2px 6px; border-radius: 4px; display: inline-block;">#${ticketData.orderNumber}</span>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Receipt & Savings Summary -->
              <tr>
                <td style="padding: 0 24px 24px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #0f172a; border: 1px solid #1e293b; border-radius: 10px; padding: 14px 18px;">
                    <tr>
                      <td style="font-size: 13px; color: #9ca3af; padding: 4px 0;">Tickets (${ticketData.tickets.length})</td>
                      <td align="right" style="font-size: 13px; color: #e2e8f0; font-weight: 600; padding: 4px 0;">$${subtotal.toFixed(2)}</td>
                    </tr>
                    ${hasDiscount ? `
                    <tr>
                      <td style="font-size: 13px; color: #34d399; padding: 4px 0;">
                        🎉 Promotion / Discount ${ticketData.promoCode ? '(' + ticketData.promoCode + ')' : ''}
                      </td>
                      <td align="right" style="font-size: 13px; color: #34d399; font-weight: 700; padding: 4px 0;">-$${discount.toFixed(2)}</td>
                    </tr>
                    ` : ''}
                    <tr>
                      <td style="border-top: 1px solid #334155; padding-top: 8px; font-size: 14px; color: #ffffff; font-weight: bold;">Total Paid</td>
                      <td align="right" style="border-top: 1px solid #334155; padding-top: 8px; font-size: 16px; color: #f59e0b; font-weight: 900;">$${ticketData.totalAmount.toFixed(2)}</td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Section Title: Admission Passes -->
              <tr>
                <td style="padding: 0 24px 12px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td>
                        <h3 style="margin: 0; font-size: 14px; font-weight: 800; color: #f59e0b; text-transform: uppercase; letter-spacing: 1.5px;">
                          🎟️ YOUR ADMISSION TICKETS (${ticketData.tickets.length})
                        </h3>
                      </td>
                      <td align="right">
                        <span style="font-size: 11px; color: #9ca3af;">Show QR code at door</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Tickets List -->
              ${ticketData.tickets.map((ticket, index) => {
                const isFree = ticket.pricePaid === 0;
                return `
                <tr>
                  <td style="padding: 0 24px 20px;">
                    <!-- VIP Pass Card -->
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #111827; border: 1px solid #374151; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);">
                      
                      <!-- Ticket Stub Header -->
                      <tr>
                        <td style="padding: 16px 20px; background-color: #182234; border-bottom: 1px solid #374151;">
                          <table width="100%" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td valign="middle">
                                <span style="font-size: 11px; color: #f59e0b; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">
                                  Pass #${index + 1}
                                </span>
                                <h4 style="margin: 2px 0 4px; font-size: 16px; font-weight: 700; color: #ffffff;">
                                  ${ticket.ticketTypeName}
                                </h4>
                                <span style="font-family: monospace; font-size: 12px; color: #9ca3af;">
                                  ${ticket.ticketNumber}
                                </span>
                              </td>
                              <td align="right" valign="middle">
                                ${isFree ? `
                                  <table cellpadding="0" cellspacing="0" border="0">
                                    <tr>
                                      <td style="background-color: #065f46; border: 1px solid #059669; padding: 6px 12px; border-radius: 8px; text-align: center;">
                                        <span style="font-size: 11px; font-weight: 800; color: #34d399; text-transform: uppercase; letter-spacing: 0.5px; display: block;">FREE PASS</span>
                                        <span style="font-size: 9px; color: #a7f3d0; text-transform: uppercase;">PROMO</span>
                                      </td>
                                    </tr>
                                  </table>
                                ` : `
                                  <table cellpadding="0" cellspacing="0" border="0">
                                    <tr>
                                      <td style="background-color: rgba(245, 158, 11, 0.15); border: 1px solid #d97706; padding: 6px 12px; border-radius: 8px; text-align: center;">
                                        <span style="font-size: 10px; font-weight: 700; color: #f59e0b; text-transform: uppercase; display: block;">PRICE PAID</span>
                                        <span style="font-size: 15px; font-weight: 900; color: #ffffff;">$${ticket.pricePaid.toFixed(2)}</span>
                                      </td>
                                    </tr>
                                  </table>
                                `}
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>

                      <!-- Perforated Tear-off Effect -->
                      <tr>
                        <td style="border-top: 2px dashed #374151; background-color: #111827; height: 1px; font-size: 0; line-height: 0;">&nbsp;</td>
                      </tr>

                      <!-- QR Code Section -->
                      <tr>
                        <td align="center" style="padding: 24px 20px; background-color: #111827;">
                          ${ticket.qrCodeCid ? `
                            <table cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; padding: 12px; border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.4); margin: 0 auto;">
                              <tr>
                                <td align="center">
                                  <img src="cid:${ticket.qrCodeCid}" width="200" height="200" alt="Ticket QR Code" style="display: block; width: 200px; height: 200px; border: 0;" />
                                </td>
                              </tr>
                            </table>
                            <p style="margin: 12px 0 2px; font-family: monospace; font-size: 13px; color: #fbbf24; font-weight: 600; letter-spacing: 1px;">
                              ${ticket.ticketNumber}
                            </p>
                            <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                              Present this QR code on your phone at entrance check-in
                            </p>
                          ` : `
                            <p style="color: #ef4444; font-size: 13px;">QR Code unavailable</p>
                          `}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                `;
              }).join('')}

              <!-- Door Entry Guidelines -->
              <tr>
                <td style="padding: 0 24px 24px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #182234; border: 1px solid #374151; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 16px;">
                    <tr>
                      <td>
                        <strong style="color: #fbbf24; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 8px;">
                          ℹ️ Door Check-In Guidelines
                        </strong>
                        <table width="100%" cellpadding="0" cellspacing="0" border="0">
                          <tr>
                            <td style="padding: 4px 0; font-size: 12px; color: #d1d5db;">
                              📱 <strong>Digital Pass:</strong> You can show this email on your phone (set screen brightness to high).
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 4px 0; font-size: 12px; color: #d1d5db;">
                              🆔 <strong>Valid Photo ID:</strong> Please ensure the order name matches your ID for entrance validation.
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 4px 0; font-size: 12px; color: #d1d5db;">
                              🚪 <strong>Arrival:</strong> Doors open 45 minutes before showtime. Seating is on a first-come basis within your tier.
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 4px 0; font-size: 12px; color: #d1d5db;">
                              🍸 <strong>Food &amp; Drinks:</strong> Full dinner menu and craft cocktails available throughout the show.
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding: 24px; text-align: center; border-top: 1px solid #1f2937; background-color: #0b0f19;">
                  <p style="margin: 0 0 6px; font-size: 13px; font-weight: 700; color: #e5e7eb;">
                    Good Times Bar &amp; Grill
                  </p>
                  <p style="margin: 0 0 12px; font-size: 11px; color: #6b7280; line-height: 1.5;">
                    1720 Fennell St, Maitland, FL 32751 • Phone: (407) 555-0199<br>
                    Need assistance? Email us at <a href="mailto:support@goodtimesbarandgrill.com" style="color: #f59e0b; text-decoration: none;">support@goodtimesbarandgrill.com</a>
                  </p>
                  <p style="margin: 0; font-size: 10px; color: #4b5563;">
                    © ${new Date().getFullYear()} Good Times Bar &amp; Grill. All rights reserved.
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
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
