import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import { getEventsForDate, checkEventConflict, getSpecialHoursForDate, isTimeSlotRequiringPrepayment, getSpecialHoursBufferWindow, filterEventsWithPaidTickets, filterCustomTicketEvents } from '@/lib/queries'
import { formatFloridaTime, getFloridaNow, toFloridaTime, FLORIDA_TIMEZONE } from '@/lib/utils/timezone'
import { fromZonedTime } from 'date-fns-tz'
import { parseISO, format } from 'date-fns'

export async function POST(request: NextRequest) {
  if (!supabase) {
    return NextResponse.json(
      { error: 'Database service unavailable. Please check configuration.' },
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
      specialHoursId,
      customFields,
    } = body

    // Validate required fields (email is only required for paid reservations, which will be checked later)
    if (!customerName || !customerPhone || !guestsCount || !reservationDate || !reservationTime || !area) {
      return NextResponse.json(
        { error: 'Missing required fields. Name, phone, guests, date, time, and preferred area are required.' },
        { status: 400 }
      )
    }

    // Validate guests count
    if (guestsCount < 1 || guestsCount > 12) {
      return NextResponse.json(
        { error: 'Guests count must be between 1 and 12' },
        { status: 400 }
      )
    }

    // Validate that reservation date/time is not in the past (using Florida timezone)
    const floridaNow = getFloridaNow()
    
    // Parse reservation date and time
    const [year, month, day] = reservationDate.split('-').map(Number)
    const [hour, minute] = reservationTime.split(':').map(Number)
    
    // Create reservation datetime in Florida timezone
    // The user entered date/time as if it were in Florida timezone
    // Create a Date object with those components, then use fromZonedTime to interpret as Florida timezone
    const reservationDateTimeLocal = new Date(year, month - 1, day, hour, minute, 0)
    // fromZonedTime interprets the date components as if they were in Florida timezone and converts to UTC
    const reservationDateTimeUTC = fromZonedTime(reservationDateTimeLocal, FLORIDA_TIMEZONE)
    // Convert UTC back to Florida timezone for comparison
    const reservationDateTimeFlorida = toFloridaTime(reservationDateTimeUTC)
    
    // Check if reservation is in the past (compare in Florida timezone)
    if (reservationDateTimeFlorida < floridaNow) {
      return NextResponse.json(
        { error: 'Cannot make reservations for past dates or times. Please select a future date and time.' },
        { status: 400 }
      )
    }

    // Check for event conflicts (with 1-hour buffer before/after event)
    // Only events with action_button_type === 'custom_tickets' and paid tickets (price > $0) will block reservations
    // Events with 'reservation' or 'external_tickets' action_button_type should not block reservations
    const events = await getEventsForDate(reservationDate)
    // Filter to only custom ticket events with paid tickets - events with no tickets or all tickets at $0 should not block reservations
    const eventsWithPaidTickets = filterCustomTicketEvents(events)
    
    if (eventsWithPaidTickets.length > 0) {
      const { hasConflict, conflictingEvent } = await checkEventConflict(
        reservationDate,
        reservationTime,
        eventsWithPaidTickets,
        60 // 1-hour buffer
      )

      if (hasConflict && conflictingEvent) {
        // Format event times in Florida timezone for error message
        const eventStart = conflictingEvent.event_start
        const eventEnd = conflictingEvent.event_end || null
        
        const startTimeFormatted = formatFloridaTime(eventStart, 'h:mm a')
        const endTimeFormatted = eventEnd ? formatFloridaTime(eventEnd, 'h:mm a') : 'TBD'

        return NextResponse.json(
          { 
            error: `This time conflicts with an event: "${conflictingEvent.title}" (${startTimeFormatted} - ${endTimeFormatted} Florida Time). Please select a different time or purchase event tickets instead.`,
            eventConflict: true,
            event: {
              id: conflictingEvent.id,
              title: conflictingEvent.title,
              slug: conflictingEvent.slug,
              event_start: conflictingEvent.event_start,
              event_end: conflictingEvent.event_end,
            }
          },
          { status: 400 }
        )
      }
    }

    // Check if there's an event on this date/time with reservation_price
    let eventReservationPrice = null
    
    // Query events directly to ensure we get all events (not just 'upcoming' status)
    // This is important because an event might be created but not yet marked as 'upcoming'
    // Reuse the already parsed year, month, day from above
    const floridaStart = new Date(year, month - 1, day, 0, 0, 0, 0)
    const dateStartUTC = fromZonedTime(floridaStart, FLORIDA_TIMEZONE)
    const floridaEnd = new Date(year, month - 1, day, 23, 59, 59, 999)
    const dateEndUTC = fromZonedTime(floridaEnd, FLORIDA_TIMEZONE)
    
    const { data: eventsOnDate, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .gte('event_start', dateStartUTC.toISOString())
      .lte('event_start', dateEndUTC.toISOString())
    
    console.log('[Reservation API] Checking events for date:', reservationDate)
    console.log('[Reservation API] Events found:', eventsOnDate?.length || 0)
    console.log('[Reservation API] Reservation time:', reservationTime)
    
    if (eventsError) {
      console.error('[Reservation API] Error fetching events:', eventsError)
    }
    
    // Check if reservation time matches any event's time (with some tolerance)
    if (eventsOnDate && eventsOnDate.length > 0) {
      for (const event of eventsOnDate) {
        console.log('[Reservation API] Checking event:', {
          id: event.id,
          title: event.title,
          reservation_price: event.reservation_price,
          action_button_type: event.action_button_type,
          event_start: event.event_start
        })
        
        // Check if event has reservation_price and action_button_type is 'reservation'
        const hasReservationPrice = event.reservation_price && parseFloat(event.reservation_price.toString()) > 0
        const isReservationType = event.action_button_type === 'reservation'
        
        if (hasReservationPrice && isReservationType) {
          // Parse event start time
          const eventStart = typeof event.event_start === 'string' ? parseISO(event.event_start) : new Date(event.event_start)
          const eventStartFlorida = toFloridaTime(eventStart)
          const eventDateFlorida = format(eventStartFlorida, 'yyyy-MM-dd')
          const eventTimeFlorida = format(eventStartFlorida, 'HH:mm')
          
          console.log('[Reservation API] Event time comparison:', {
            eventDateFlorida,
            reservationDate,
            eventTimeFlorida,
            reservationTime
          })
          
          // Check if reservation is for the same date and time (or within 30 minutes)
          if (eventDateFlorida === reservationDate) {
            // Parse times for comparison
            const [resHour, resMin] = reservationTime.split(':').map(Number)
            const [eventHour, eventMin] = eventTimeFlorida.split(':').map(Number)
            
            const resMinutes = resHour * 60 + resMin
            const eventMinutes = eventHour * 60 + eventMin
            const timeDiff = Math.abs(resMinutes - eventMinutes)
            
            console.log('[Reservation API] Time difference:', timeDiff, 'minutes')
            
            // If reservation time is within 30 minutes of event start, apply reservation price
            // Reservation price is per person, so multiply by number of guests
            if (timeDiff <= 30) {
              const pricePerPerson = parseFloat(event.reservation_price.toString())
              eventReservationPrice = pricePerPerson * guestsCount
              console.log('[Reservation API] Event reservation price applied:', {
                pricePerPerson,
                guestsCount,
                totalPrice: eventReservationPrice
              })
              break
            }
          }
        }
      }
    }
    
    console.log('[Reservation API] Final event reservation price:', eventReservationPrice)

    // Check if special hours exist for this date
    const specialHours = await getSpecialHoursForDate(reservationDate)
    
    // Determine if this reservation requires prepayment based on selected time slot
    let requiresPrepayment = false
    let specialHoursIdForReservation = null
    let prepaymentAmount = null
    
    // Priority: Event reservation_price takes precedence over special hours prepayment
    if (eventReservationPrice) {
      requiresPrepayment = true
      prepaymentAmount = eventReservationPrice
      console.log('[Reservation API] Using event reservation price:', prepaymentAmount)
    } else if (specialHours && specialHours.is_open) {
      // Check if the selected time slot requires prepayment (within special hours + 1 hour buffer)
      requiresPrepayment = isTimeSlotRequiringPrepayment(reservationTime, specialHours)
      
      if (requiresPrepayment) {
        specialHoursIdForReservation = specialHours.id
        
        // Get special hours limits
        const { data: limits } = await supabase
          .from('special_hours_limits')
          .select('*')
          .eq('special_hours_id', specialHours.id)
          .single()

        if (limits) {
          // Check max guests per booking
          if (limits.max_guests_per_booking && guestsCount > limits.max_guests_per_booking) {
            return NextResponse.json(
              { error: `Maximum ${limits.max_guests_per_booking} guests per booking allowed` },
              { status: 400 }
            )
          }

          // Check max bookings total
          if (limits.max_bookings_total) {
            const { count } = await supabase
              .from('reservations')
              .select('*', { count: 'exact', head: true })
              .eq('reservation_date', reservationDate)
              .eq('special_hours_id', specialHours.id)
              .in('status', ['pending', 'confirmed'])

            if (count && count >= limits.max_bookings_total) {
              return NextResponse.json(
                { error: 'Maximum bookings reached for this date' },
                { status: 400 }
              )
            }
          }

          // Check max guests total
          if (limits.max_guests_total) {
            const { data: reservations } = await supabase
              .from('reservations')
              .select('guests_count')
              .eq('reservation_date', reservationDate)
              .eq('special_hours_id', specialHours.id)
              .in('status', ['pending', 'confirmed'])

            const currentGuests = reservations?.reduce((sum, r) => sum + (r.guests_count || 0), 0) || 0
            if (currentGuests + guestsCount > limits.max_guests_total) {
              return NextResponse.json(
                { error: 'Maximum guest capacity reached for this date' },
                { status: 400 }
              )
            }
          }
        }

        // Get payment info for prepayment
        const { data: payment } = await supabase
          .from('special_hours_payment')
          .select('*')
          .eq('special_hours_id', specialHours.id)
          .single()

        // Calculate prepayment if required
        if (payment?.prepayment_required) {
          if (payment.prepayment_rule_type === 'per_guest' && payment.prepayment_amount) {
            prepaymentAmount = payment.prepayment_amount * guestsCount
          } else if (payment.prepayment_rule_type === 'per_booking' && payment.prepayment_amount) {
            prepaymentAmount = payment.prepayment_amount
          }
          // Note: Percentage prepayment would need total booking cost
        }
      }
    }
    
    // Only require email for paid reservations (those requiring prepayment)
    if (requiresPrepayment && !customerEmail) {
      return NextResponse.json(
        { error: 'Email is required for paid reservations' },
        { status: 400 }
      )
    }

    // Insert reservation into database
    const { data, error } = await supabase
      .from('reservations')
      .insert({
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail || null, // Only required for paid reservations
        guests_count: guestsCount,
        reservation_date: reservationDate,
        reservation_time: reservationTime,
        area: area,
        notes: notes || null,
        status: prepaymentAmount ? 'pending' : 'confirmed',
        special_hours_id: specialHoursIdForReservation,
        prepayment_amount: prepaymentAmount,
        prepayment_status: prepaymentAmount ? 'unpaid' : 'not_required',
      })
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to create reservation' },
        { status: 500 }
      )
    }

    // Insert custom field responses (only if reservation is within special hours prepayment zone)
    if (requiresPrepayment && specialHours && customFields && Object.keys(customFields).length > 0) {
      // Get field IDs
      const { data: fields } = await supabase
        .from('special_hours_fields')
        .select('id, field_key')
        .eq('special_hours_id', specialHours.id)

      if (fields) {
        const fieldResponses = fields
          .filter((field) => customFields[field.field_key])
          .map((field) => ({
            reservation_id: data.id,
            field_id: field.id,
            field_value: customFields[field.field_key],
          }))

        if (fieldResponses.length > 0) {
          await supabase.from('reservation_field_responses').insert(fieldResponses)
        }
      }
    }

    // Send confirmation email for all reservations (both free and prepaid)
    // For prepaid reservations, send email first, then redirect to payment
    if (customerEmail) {
      try {
        // Use environment variable if available, otherwise construct from request URL
        let siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL
        if (!siteUrl) {
          const url = new URL(request.url)
          siteUrl = `${url.protocol}//${url.host}`
        }
        siteUrl = siteUrl.replace(/\/$/, '')
        await fetch(`${siteUrl}/api/reservations/send-confirmation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reservationId: data.id }),
        }).catch(err => {
          console.error('[Reservation API] Failed to send confirmation email:', err);
          // Don't fail the reservation creation if email fails
        });
      } catch (err) {
        console.error('[Reservation API] Error sending confirmation email:', err);
        // Continue even if email fails
      }
    }

    // Use environment variable if available, otherwise construct from request URL
    let siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL
    if (!siteUrl) {
      const url = new URL(request.url)
      siteUrl = `${url.protocol}//${url.host}`
    }
    siteUrl = siteUrl.replace(/\/$/, '')
    
    return NextResponse.json(
      { 
        success: true, 
        reservation: data, 
        prepaymentRequired: !!prepaymentAmount, 
        prepaymentAmount,
        paymentUrl: prepaymentAmount 
          ? `${siteUrl}/reservations/payment?reservationId=${data.id}&amount=${prepaymentAmount}`
          : null
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Reservation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

