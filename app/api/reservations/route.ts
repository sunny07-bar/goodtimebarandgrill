import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import {
  getEventsForDate,
  checkEventConflict,
  getSpecialHoursForDate,
  isTimeSlotRequiringPrepayment,
  filterCustomTicketEvents,
} from '@/lib/queries'
import {
  formatFloridaTime,
  getFloridaNow,
  toFloridaTime,
  FLORIDA_TIMEZONE,
} from '@/lib/utils/timezone'
import { fromZonedTime } from 'date-fns-tz'
import { parseISO, format } from 'date-fns'

export async function POST(request: NextRequest) {
  if (!supabase) {
    return NextResponse.json(
      { error: 'Database service unavailable.' },
      { status: 503 }
    )
  }

  try {
    const body = await request.json()
    const {
      customerName,
      customerPhone,
      customerEmail,
      guestsCount,
      reservationDate,
      reservationTime,
      area,
      notes,
      customFields,
    } = body

    /* ---------------------------------------------------- */
    /* BASIC VALIDATION */
    /* ---------------------------------------------------- */

    if (
      !customerName ||
      !customerPhone ||
      !guestsCount ||
      !reservationDate ||
      !reservationTime ||
      !area
    ) {
      return NextResponse.json(
        { error: 'Missing required fields.' },
        { status: 400 }
      )
    }

    if (guestsCount < 1 || guestsCount > 12) {
      return NextResponse.json(
        { error: 'Guests count must be between 1 and 12.' },
        { status: 400 }
      )
    }

    /* ---------------------------------------------------- */
    /* TIME VALIDATION (FLORIDA TIME) */
    /* ---------------------------------------------------- */

    const floridaNow = getFloridaNow()
    const [year, month, day] = reservationDate.split('-').map(Number)
    const [hour, minute] = reservationTime.split(':').map(Number)

    const localDate = new Date(year, month - 1, day, hour, minute, 0)
    const utcDate = fromZonedTime(localDate, FLORIDA_TIMEZONE)
    const floridaDate = toFloridaTime(utcDate)

    if (floridaDate < floridaNow) {
      return NextResponse.json(
        { error: 'Cannot book past dates or times.' },
        { status: 400 }
      )
    }

    /* ---------------------------------------------------- */
    /* EVENT CONFLICTS (CUSTOM TICKET EVENTS ONLY) */
    /* ---------------------------------------------------- */

    const events = await getEventsForDate(reservationDate)
    const blockingEvents = filterCustomTicketEvents(events)

    if (blockingEvents.length > 0) {
      const { hasConflict, conflictingEvent } = await checkEventConflict(
        reservationDate,
        reservationTime,
        blockingEvents,
        60
      )

      if (hasConflict && conflictingEvent) {
        return NextResponse.json(
          {
            error: `This time conflicts with "${conflictingEvent.title}" (${formatFloridaTime(
              conflictingEvent.event_start,
              'h:mm a'
            )}).`,
            eventConflict: true,
          },
          { status: 400 }
        )
      }
    }

    /* ---------------------------------------------------- */
    /* FETCH EVENTS FOR DATE */
    /* ---------------------------------------------------- */

    const floridaStart = new Date(year, month - 1, day, 0, 0, 0)
    const floridaEnd = new Date(year, month - 1, day, 23, 59, 59)

    const { data: eventsOnDate } = await supabase
      .from('events')
      .select('*')
      .gte(
        'event_start',
        fromZonedTime(floridaStart, FLORIDA_TIMEZONE).toISOString()
      )
      .lte(
        'event_start',
        fromZonedTime(floridaEnd, FLORIDA_TIMEZONE).toISOString()
      )

    /* ---------------------------------------------------- */
    /* IDENTIFY RESERVATION-BASED EVENT */
    /* ---------------------------------------------------- */

    let reservationEvent: any = null
    let eventStartFlorida: Date | null = null
    let eventEndFlorida: Date | null = null

    if (eventsOnDate?.length) {
      for (const event of eventsOnDate) {
        if (event.action_button_type === 'reservation') {
          const start = toFloridaTime(
            typeof event.event_start === 'string'
              ? parseISO(event.event_start)
              : new Date(event.event_start)
          )

          if (format(start, 'yyyy-MM-dd') === reservationDate) {
            reservationEvent = event
            eventStartFlorida = start

            if (event.event_end) {
              eventEndFlorida = toFloridaTime(
                typeof event.event_end === 'string'
                  ? parseISO(event.event_end)
                  : new Date(event.event_end)
              )
            } else {
              // fallback: 4 hours window if end missing
              eventEndFlorida = new Date(start.getTime() + 4 * 60 * 60 * 1000)
            }
            break
          }
        }
      }
    }

    /* ---------------------------------------------------- */
    /* EVENT RESERVATION PRICE */
    /* ---------------------------------------------------- */

    let eventReservationPrice: number | null = null

    if (reservationEvent?.reservation_price && eventStartFlorida) {
      const eventMinutes =
        eventStartFlorida.getHours() * 60 + eventStartFlorida.getMinutes()
      const resMinutes = hour * 60 + minute

      if (Math.abs(resMinutes - eventMinutes) <= 30) {
        eventReservationPrice =
          Number(reservationEvent.reservation_price) * guestsCount
      }
    }

    /* ---------------------------------------------------- */
    /* SPECIAL HOURS / PREPAYMENT */
    /* ---------------------------------------------------- */

    const specialHours = await getSpecialHoursForDate(reservationDate)

    let requiresPrepayment = false
    let prepaymentAmount: number | null = null
    let specialHoursId: string | null = null

    if (eventReservationPrice) {
      requiresPrepayment = true
      prepaymentAmount = eventReservationPrice
    } else if (specialHours?.is_open) {
      requiresPrepayment = isTimeSlotRequiringPrepayment(
        reservationTime,
        specialHours
      )

      if (requiresPrepayment) {
        specialHoursId = specialHours.id

        const { data: payment } = await supabase
          .from('special_hours_payment')
          .select('*')
          .eq('special_hours_id', specialHours.id)
          .single()

        if (payment?.prepayment_required) {
          prepaymentAmount =
            payment.prepayment_rule_type === 'per_guest'
              ? payment.prepayment_amount * guestsCount
              : payment.prepayment_amount
        }
      }
    }

    if (requiresPrepayment && !customerEmail) {
      return NextResponse.json(
        { error: 'Email required for paid reservations.' },
        { status: 400 }
      )
    }

    /* ---------------------------------------------------- */
    /* SEAT LIMIT ENFORCEMENT (EVENT + AREA + TIME WINDOW) */
    /* ---------------------------------------------------- */

    if (reservationEvent && eventStartFlorida && eventEndFlorida) {
      const { data: limit } = await supabase
        .from('event_reservation_limits')
        .select('max_seats')
        .eq('event_id', reservationEvent.id)
        .eq('area', area)
        .single()

      if (limit?.max_seats) {
        const windowStartUTC = fromZonedTime(
          eventStartFlorida,
          FLORIDA_TIMEZONE
        )
        const windowEndUTC = fromZonedTime(eventEndFlorida, FLORIDA_TIMEZONE)

        const { data: existing } = await supabase
          .from('reservations')
          .select('guests_count')
          .eq('reservation_date', reservationDate)
          .eq('area', area)
          .in('status', ['pending', 'confirmed'])

        const used =
          existing?.reduce((sum, r) => sum + (r.guests_count || 0), 0) || 0

        const remaining = Math.max(0, limit.max_seats - used)

        if (remaining < guestsCount) {
          return NextResponse.json(
            {
              error:
                remaining === 0
                  ? `${area} is FULL for this event.`
                  : `Only ${remaining} seat${remaining === 1 ? '' : 's'} remaining in ${area} for this event.`,
              capacityExceeded: true,
              remainingSeats: remaining,
            },
            { status: 400 }
          )
        }

      }
    }

    /* ---------------------------------------------------- */
    /* INSERT RESERVATION */
    /* ---------------------------------------------------- */

    const { data, error } = await supabase
      .from('reservations')
      .insert({
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail || null,
        guests_count: guestsCount,
        reservation_date: reservationDate,
        reservation_time: reservationTime,
        area,
        notes: notes || null,
        status: prepaymentAmount ? 'pending' : 'confirmed',
        special_hours_id: specialHoursId,
        prepayment_amount: prepaymentAmount,
        prepayment_status: prepaymentAmount ? 'unpaid' : 'not_required',
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: 'Failed to create reservation.' },
        { status: 500 }
      )
    }

    // Send confirmation email for standard (non-prepaid) reservations
    console.log('[API] Checking if email should be sent for free reservation:', {
      prepaymentAmount,
      id: data?.id,
      email: customerEmail
    });

    if (!prepaymentAmount && data?.id && customerEmail) {
      console.log('[API] Attempting to send confirmation email for reservation:', data.id);
      // Fire and forget - don't block response
      const { sendReservationConfirmationEmail } = require('@/lib/email/reservation-confirmation');
      sendReservationConfirmationEmail(data.id)
        .then((res: any) => console.log('[API] Email send result:', res))
        .catch((err: any) => console.error('[API] Failed to send initial confirmation email:', err));
    } else {
      console.log('[API] Skipping email trigger. Conditions not met.');
    }

    return NextResponse.json(
      {
        success: true,
        reservation: data,
        prepaymentRequired: !!prepaymentAmount,
        prepaymentAmount,
      },
      { status: 201 }
    )
  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { error: 'Internal server error.' },
      { status: 500 }
    )
  }
}