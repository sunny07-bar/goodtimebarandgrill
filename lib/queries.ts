import { supabase } from './db'
import { getFloridaNow, floridaToUTC, FLORIDA_TIMEZONE, getDayOfWeekInFlorida, toFloridaTime } from './utils/timezone'
import { parseISO, format } from 'date-fns'
import { fromZonedTime } from 'date-fns-tz'
import { logError } from './utils/logger'

// Helper to log query errors with more detail
function logQueryError(functionName: string, error: any, table?: string) {
  logError(error, {
    functionName,
    table: table || 'database',
    type: 'database_query_error',
  })
}

// Banners
export async function getBanners() {
  try {
    if (!supabase) {
      console.error('Supabase client not initialized')
      return []
    }

    const { data, error } = await supabase
      .from('banners')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (error) {
      logQueryError('getBanners', error, 'banners')
      return []
    }
    
    return data || []
  } catch (error) {
    console.error('Error in getBanners:', error)
    return []
  }
}

// Home Features
export async function getHomeFeatures() {
  try {
    if (!supabase) {
      console.error('Supabase client not initialized')
      return []
    }

    const { data, error } = await supabase
      .from('home_features')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (error) {
      logQueryError('getHomeFeatures', error, 'home_features')
      return []
    }
    
    return data || []
  } catch (error) {
    console.error('Error in getHomeFeatures:', error)
    return []
  }
}

// Menu Categories
export async function getMenuCategories() {
  try {
    if (!supabase) {
      console.error('Supabase client not initialized')
      return []
    }

    const { data, error } = await supabase
      .from('menu_categories')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (error) {
      logQueryError('getMenuCategories', error, 'menu_categories')
      return []
    }
    
    return data || []
  } catch (error) {
    console.error('Error in getMenuCategories:', error)
    return []
  }
}

// Menu Items
export async function getMenuItems(categoryId?: string) {
  try {
    if (!supabase) {
      console.error('Supabase client not initialized')
      return []
    }

    let query = supabase
      .from('menu_items')
      .select(`
        *,
        menu_item_variants (*)
      `)
      .eq('is_available', true)

    if (categoryId) {
      query = query.eq('category_id', categoryId)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) {
      logQueryError('getMenuItems', error, 'menu_items')
      return []
    }
    
    return data || []
  } catch (error) {
    console.error('Error in getMenuItems:', error)
    return []
  }
}

export async function getFeaturedMenuItems() {
  try {
    if (!supabase) {
      console.error('Supabase client not initialized')
      return []
    }

    const { data, error } = await supabase
      .from('menu_items')
      .select(`
        *,
        menu_item_variants (*),
        menu_categories (*)
      `)
      .eq('is_featured', true)
      .eq('is_available', true)
      .limit(6)
      .order('created_at', { ascending: false })

    if (error) {
      logQueryError('getFeaturedMenuItems', error, 'menu_items')
      return []
    }
    
    return data || []
  } catch (error) {
    console.error('Error in getFeaturedMenuItems:', error)
    return []
  }
}

export async function getMenuItemById(id: string) {
  try {
    if (!supabase) {
      console.error('Supabase client not initialized')
      return null
    }

    const { data, error } = await supabase
      .from('menu_items')
      .select(`
        *,
        menu_item_variants (*),
        menu_categories (*)
      `)
      .eq('id', id)
      .eq('is_available', true)
      .single()

    if (error) {
      logQueryError('getMenuItemById', error, 'menu_items')
      return null
    }
    
    return data
  } catch (error) {
    console.error('Error in getMenuItemById:', error)
    return null
  }
}

// Events
export async function getEvents(featured?: boolean) {
  try {
    if (!supabase) {
      console.error('Supabase client not initialized')
      return []
    }

    let query = supabase
      .from('events')
      .select('*')
      .order('event_start', { ascending: true })

    if (featured) {
      query = query.eq('is_featured', true)
    }

    // Don't filter by status - fetch all events
    // The frontend will handle filtering for upcoming events

    const { data, error } = await query

    if (error) {
      logQueryError('getEvents', error, 'events')
      return []
    }
    
    console.log(`[getEvents] Fetched ${data?.length || 0} events`)
    return data || []
  } catch (error) {
    console.error('Error in getEvents:', error)
    return []
  }
}

export async function getEventBySlug(slug: string) {
  try {
    if (!supabase) {
      console.error('Supabase client not available')
      return null
    }
    
    // Decode URL-encoded slug (handles %20 for spaces, etc.)
    const decodedSlug = decodeURIComponent(slug)
    
    // Try exact match first (with decoded slug)
    let { data, error } = await supabase
      .from('events')
      .select(`
        *,
        event_tickets (*)
      `)
      .eq('slug', decodedSlug)
      .single()

    // If not found, try with the original slug (in case it's stored as-is)
    if (error && slug !== decodedSlug) {
      const { data: data2, error: error2 } = await supabase
        .from('events')
        .select(`
          *,
          event_tickets (*)
        `)
        .eq('slug', slug)
        .single()
      
      if (!error2) {
        data = data2
        error = null
      }
    }

    // If still not found, try case-insensitive match (some databases are case-sensitive)
    if (error) {
      const { data: data3, error: error3 } = await supabase
        .from('events')
        .select(`
          *,
          event_tickets (*)
        `)
        .ilike('slug', decodedSlug)
        .single()
      
      if (!error3) {
        data = data3
        error = null
      }
    }

    if (error) {
      console.error('Error fetching event:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        searchedSlug: decodedSlug,
        originalSlug: slug
      })
      return null
    }
    return data
  } catch (error) {
    console.error('Error in getEventBySlug:', error)
    return null
  }
}

export async function getUpcomingEvents(limit?: number) {
  try {
    if (!supabase) {
      console.error('Supabase client not initialized')
      return []
    }

    // Get current time in Florida timezone
    const floridaNow = getFloridaNow()
    // Get today's date in Florida timezone (YYYY-MM-DD)
    const todayFlorida = format(floridaNow, 'yyyy-MM-dd')
    
    // Get start of today in Florida timezone, then convert to UTC for database query
    const [year, month, day] = todayFlorida.split('-').map(Number)
    // Create a date at the start of today in Florida timezone (00:00:00)
    const startOfTodayFlorida = new Date(year, month - 1, day, 0, 0, 0, 0)
    // Convert to UTC for database comparison
    const startOfTodayUTC = fromZonedTime(startOfTodayFlorida, FLORIDA_TIMEZONE)
    
    // Query events where event_start >= start of today (in UTC)
    // This ensures events on today's date are included
    let query = supabase
      .from('events')
      .select('*')
      .gte('event_start', startOfTodayUTC.toISOString())
      .order('event_start', { ascending: true })

    if (limit) {
      query = query.limit(limit)
    }

    const { data, error } = await query

    if (error) {
      logQueryError('getUpcomingEvents', error, 'events')
      return []
    }
    
    // Additional client-side filtering to ensure we only show events that haven't ended
    // This handles edge cases where an event might have ended earlier today
    const floridaNowTime = floridaNow.getTime()
    const todayFloridaStr = format(floridaNow, 'yyyy-MM-dd')
    
    const filteredEvents = (data || []).filter((event) => {
      if (!event.event_start) return false
      
      const eventStart = typeof event.event_start === 'string' ? parseISO(event.event_start) : new Date(event.event_start)
      const floridaEventStart = toFloridaTime(eventStart)
      const eventDateFlorida = format(floridaEventStart, 'yyyy-MM-dd')
      
      // First check: Is the event's date today or in the future?
      if (eventDateFlorida < todayFloridaStr) {
        // Event date is in the past, don't show it
        return false
      }
      
      // If event date is today or in the future, check if it has ended
      if (event.event_end) {
        const eventEnd = typeof event.event_end === 'string' ? parseISO(event.event_end) : new Date(event.event_end)
        const floridaEventEnd = toFloridaTime(eventEnd)
        // Show event if current time is before event end
        return floridaNowTime < floridaEventEnd.getTime()
      }
      
      // If no end time and event date is today or future, show it
      return true
    })
    
    return filteredEvents
  } catch (error) {
    console.error('Error in getUpcomingEvents:', error)
    return []
  }
}

// Get events on a specific date (date is in YYYY-MM-DD format, Florida timezone)
// Query events that occur on this date in Florida timezone
export async function getEventsForDate(date: string) {
  try {
    if (!supabase) {
      console.error('Supabase client not initialized')
      return []
    }
    
    // Parse the date string (YYYY-MM-DD) - this is the calendar date in Florida timezone
    const [year, month, day] = date.split('-').map(Number)
    
    // Create date range in Florida timezone, then convert to UTC for database query
    // Start: Beginning of the day in Florida timezone (00:00:00 Florida time)
    const floridaStart = new Date(year, month - 1, day, 0, 0, 0, 0)
    const dateStartUTC = fromZonedTime(floridaStart, FLORIDA_TIMEZONE)
    
    // End: End of the day in Florida timezone (23:59:59.999 Florida time)
    const floridaEnd = new Date(year, month - 1, day, 23, 59, 59, 999)
    const dateEndUTC = fromZonedTime(floridaEnd, FLORIDA_TIMEZONE)

    const { data, error } = await supabase
      .from('events')
      .select(`
        *,
        event_tickets (*)
      `)
      .eq('status', 'upcoming')
      .gte('event_start', dateStartUTC.toISOString())
      .lte('event_start', dateEndUTC.toISOString())
      .order('event_start', { ascending: true })

    if (error) {
      logQueryError('getEventsForDate', error, 'events')
      return []
    }
    
    return data || []
  } catch (error) {
    console.error('Error in getEventsForDate:', error)
    return []
  }
}

// Helper function to check if an event has paid tickets (tickets with price > $0)
// Events should only block reservations if they have tickets AND at least one ticket has price > $0
export function hasPaidTickets(event: any): boolean {
  // Check if event has event_tickets
  if (event.event_tickets && Array.isArray(event.event_tickets) && event.event_tickets.length > 0) {
    // Check if at least one ticket has price > $0
    const hasPaidTicket = event.event_tickets.some((ticket: any) => {
      const price = parseFloat(ticket.price?.toString() || '0')
      return price > 0
    })
    return hasPaidTicket
  }
  
  // Check if event has base_ticket_price > $0
  if (event.base_ticket_price) {
    const basePrice = parseFloat(event.base_ticket_price.toString())
    return basePrice > 0
  }
  
  // No tickets or all tickets are $0 - should not block reservations
  return false
}

// Filter events to only include those with paid tickets (for reservation blocking)
export function filterEventsWithPaidTickets(events: any[]): any[] {
  return events.filter(event => hasPaidTickets(event))
}

// Filter events to only include custom ticket events (for reservation blocking)
// Only events with action_button_type === 'custom_tickets' should block reservations
export function filterCustomTicketEvents(events: any[]): any[] {
  return events.filter(event => {
    // Only block reservations for custom ticket events (own ticket events)
    if (event.action_button_type !== 'custom_tickets') {
      return false
    }
    // Also check if they have paid tickets
    return hasPaidTickets(event)
  })
}

// Check if a reservation time conflicts with any events (with buffer)
// Buffer defaults to 1 hour (60 minutes) before and after event
// Only events with custom_tickets action_button_type and paid tickets (price > $0) will block reservations
export async function checkEventConflict(
  reservationDate: string,
  reservationTime: string,
  events: any[],
  bufferMinutes: number = 60,
  restaurantCloseTime?: string // Optional: restaurant closing time in HH:MM format (24-hour) for the day
): Promise<{ hasConflict: boolean; conflictingEvent: any | null }> {
  if (!events || events.length === 0) {
    return { hasConflict: false, conflictingEvent: null }
  }
  
  // Filter to only custom ticket events with paid tickets (price > $0)
  // Only events with action_button_type === 'custom_tickets' should block reservations
  // Events with 'reservation' or 'external_tickets' action_button_type should not block reservations
  const eventsWithPaidTickets = filterCustomTicketEvents(events)
  
  if (eventsWithPaidTickets.length === 0) {
    return { hasConflict: false, conflictingEvent: null }
  }

  // Parse reservation date and time (assumed to be in Florida timezone)
  const [resHour, resMin] = reservationTime.split(':').map(Number)
  const [year, month, day] = reservationDate.split('-').map(Number)
  
  // Create a Date object in Florida timezone, then convert to UTC for comparison
  const reservationDateTimeFlorida = new Date(year, month - 1, day, resHour, resMin, 0)
  const reservationDateTimeUTC = fromZonedTime(reservationDateTimeFlorida, FLORIDA_TIMEZONE)

  for (const event of eventsWithPaidTickets) {
    if (!event.event_start) continue

    // Events are stored in UTC
    const eventStartUTC = typeof event.event_start === 'string' ? parseISO(event.event_start) : new Date(event.event_start)
    
    let eventEndUTC: Date
    if (event.event_end) {
      // Use actual event end time
      eventEndUTC = typeof event.event_end === 'string' ? parseISO(event.event_end) : new Date(event.event_end)
    } else {
      // No event end time - use restaurant closing time for that day
      if (restaurantCloseTime) {
        // Parse closing time (HH:MM format)
        const [closeHour, closeMin] = restaurantCloseTime.split(':').map(Number)
        // Create closing time in Florida timezone for the reservation date
        const closeTimeFlorida = new Date(year, month - 1, day, closeHour, closeMin, 0)
        // Convert to UTC
        eventEndUTC = fromZonedTime(closeTimeFlorida, FLORIDA_TIMEZONE)
      } else {
        // Fallback: use 3 hours after event start if no closing time provided
        eventEndUTC = new Date(eventStartUTC.getTime() + 3 * 60 * 60 * 1000)
      }
    }

    // Apply buffer: subtract buffer before start, add buffer after end (all in UTC)
    const blockedStartUTC = new Date(eventStartUTC.getTime() - bufferMinutes * 60 * 1000)
    const blockedEndUTC = new Date(eventEndUTC.getTime() + bufferMinutes * 60 * 1000)

    // Check if reservation time falls within blocked period (compare in UTC)
    if (reservationDateTimeUTC >= blockedStartUTC && reservationDateTimeUTC <= blockedEndUTC) {
      return { hasConflict: true, conflictingEvent: event }
    }
  }

  return { hasConflict: false, conflictingEvent: null }
}

// Check if a time slot conflicts with any events (with buffer)
export async function isTimeSlotBlockedByEvent(
  date: string,
  timeSlot: string,
  events: any[],
  bufferMinutes: number = 60,
  restaurantCloseTime?: string
): Promise<boolean> {
  const { hasConflict } = await checkEventConflict(date, timeSlot, events, bufferMinutes, restaurantCloseTime)
  return hasConflict
}

// Offers
export async function getActiveOffers() {
  try {
    if (!supabase) {
      console.error('Supabase client not available')
      return []
    }
    
    const now = getFloridaNow().toISOString()
    let query = supabase
      .from('offers')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: true })

    const { data, error } = await query

    if (error) {
      console.error('Error fetching offers:', error)
      return []
    }

    // Filter offers using Florida timezone
    const floridaNow = getFloridaNow()
    const filtered = (data || []).filter((offer) => {
      let startValid = true
      let endValid = true
      
      if (offer.start_date) {
        const offerStartFlorida = toFloridaTime(offer.start_date)
        startValid = offerStartFlorida <= floridaNow
      }
      
      if (offer.end_date) {
        const offerEndFlorida = toFloridaTime(offer.end_date)
        endValid = offerEndFlorida >= floridaNow
      }
      
      return startValid && endValid
    })

    return filtered
  } catch (error) {
    console.error('Error in getActiveOffers:', error)
    return []
  }
}

// Gallery
export async function getGalleryImages(category?: string, limit?: number) {
  try {
    if (!supabase) {
      console.error('Supabase client not initialized')
      return []
    }

    let query = supabase
      .from('gallery_images')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (category && category !== 'all') {
      query = query.eq('category', category)
    }

    if (limit) {
      query = query.limit(limit)
    }

    const { data, error } = await query

    if (error) {
      logQueryError('getGalleryImages', error, 'gallery_images')
      return []
    }
    
    return data || []
  } catch (error) {
    console.error('Error in getGalleryImages:', error)
    return []
  }
}

// Static Sections
export async function getStaticSection(sectionKey: string) {
  try {
    if (!supabase) {
      console.error('Supabase client not available')
      return null
    }
    
    const { data, error } = await supabase
      .from('static_sections')
      .select('*')
      .eq('section_key', sectionKey)
      .single()

    if (error) {
      console.error('Error fetching static section:', error)
      return null
    }
    return data
  } catch (error) {
    console.error('Error in getStaticSection:', error)
    return null
  }
}

// Opening Hours
export async function getOpeningHours() {
  try {
    if (!supabase) {
      console.error('Supabase client not available')
      return []
    }
    
    const { data, error } = await supabase
      .from('opening_hours')
      .select('*')
      .order('weekday', { ascending: true })

    if (error) {
      console.error('Error fetching opening hours:', error)
      return []
    }
    return data || []
  } catch (error) {
    console.error('Error in getOpeningHours:', error)
    return []
  }
}

// Special Hours - Get active special hours for a date (regardless of is_open status)
export async function getSpecialHoursForDate(date: string) {
  try {
    if (!supabase) {
      console.error('[getSpecialHoursForDate] Supabase client not initialized')
      return null
    }

    console.log('[getSpecialHoursForDate] Fetching special hours for date:', date)

    const { data, error } = await supabase
      .from('special_hours')
      .select(`
        *,
        special_hours_seatings (*),
        special_hours_limits (*),
        special_hours_payment (*),
        special_hours_fields (*)
      `)
      .eq('date', date)
      .eq('status', 'active')
      .maybeSingle() // Use maybeSingle instead of single to avoid errors

    if (error) {
      console.error('[getSpecialHoursForDate] Query error:', error)
      logQueryError('getSpecialHoursForDate', error, 'special_hours')
      return null
    }

    if (!data) {
      console.log('[getSpecialHoursForDate] No special hours found for date:', date)
      return null
    }

    console.log('[getSpecialHoursForDate] Found special hours:', {
      id: data.id,
      title: data.title,
      is_open: data.is_open,
      time_from: data.time_from,
      time_to: data.time_to,
      seatings_count: data.special_hours_seatings?.length || 0
    })

    return data
  } catch (error) {
    console.error('[getSpecialHoursForDate] Exception:', error)
    return null
  }
}

// Helper function to parse time string to minutes
function parseTimeToMinutes(timeStr: string): number {
  const parts = timeStr.split(':')
  const hour = parseInt(parts[0]) || 0
  const minute = parseInt(parts[1]) || 0
  return hour * 60 + minute
}

// Helper function to format minutes to HH:MM
function minutesToTime(minutes: number): string {
  const hour = Math.floor(minutes / 60)
  const minute = minutes % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

// Helper function to check if a time slot requires prepayment (within special hours + 1 hour buffer)
export function isTimeSlotRequiringPrepayment(timeSlot: string, specialHours: any): boolean {
  if (!specialHours || !specialHours.time_from || !specialHours.time_to) {
    return false
  }

  const slotMinutes = parseTimeToMinutes(timeSlot)
  const startTimeMinutes = parseTimeToMinutes(specialHours.time_from)
  const endTimeMinutes = parseTimeToMinutes(specialHours.time_to)

  // Buffer: 1 hour (60 minutes) before special hours start
  const bufferStartMinutes = startTimeMinutes - 60
  // Buffer: 1 hour (60 minutes) after special hours end
  const bufferEndMinutes = endTimeMinutes + 60

  // Check if slot is within special hours + 1 hour buffer
  return slotMinutes >= bufferStartMinutes && slotMinutes <= bufferEndMinutes
}

// Helper function to get the full buffer window for a special hours reservation
// Returns { bufferStartTime, bufferEndTime } in HH:MM format
export function getSpecialHoursBufferWindow(specialHours: any): { bufferStartTime: string; bufferEndTime: string } | null {
  if (!specialHours || !specialHours.time_from || !specialHours.time_to) {
    return null
  }

  const startTimeMinutes = parseTimeToMinutes(specialHours.time_from)
  const endTimeMinutes = parseTimeToMinutes(specialHours.time_to)

  // Buffer: 1 hour (60 minutes) before special hours start
  const bufferStartMinutes = startTimeMinutes - 60
  // Buffer: 1 hour (60 minutes) after special hours end
  const bufferEndMinutes = endTimeMinutes + 60

  return {
    bufferStartTime: minutesToTime(bufferStartMinutes),
    bufferEndTime: minutesToTime(bufferEndMinutes),
  }
}

// Get available time slots for a date
export async function getAvailableTimeSlots(date: string, guestCount: number = 2) {
  try {
    console.log('[getAvailableTimeSlots] Fetching slots for date:', date)
    
    // Check for events on this date
    const events = await getEventsForDate(date)
    console.log('[getAvailableTimeSlots] Events found:', events.length)
    
    const specialHours = await getSpecialHoursForDate(date)
    console.log('[getAvailableTimeSlots] Special hours found:', specialHours ? 'Yes' : 'No')
    
    // Always get regular hours for the date
    const openingHours = await getOpeningHours()
    const dayOfWeek = getDayOfWeekInFlorida(date)
    const regularHours = openingHours.find(h => h.weekday === dayOfWeek)
    
    // Generate regular hours slots
    let regularSlots: string[] = []
    console.log('[getAvailableTimeSlots] Regular hours for weekday', dayOfWeek, ':', regularHours)
    if (regularHours && !regularHours.is_closed) {
      const [openHour, openMin] = regularHours.open_time.split(':').map(Number)
      const [closeHour, closeMin] = regularHours.close_time.split(':').map(Number)
      
      console.log('[getAvailableTimeSlots] Generating regular slots from', `${openHour}:${openMin}`, 'to', `${closeHour}:${closeMin}`)
      
      // Handle midnight close time (00:00:00 means end of day, so treat as 24:00)
      let effectiveCloseHour = closeHour
      let effectiveCloseMin = closeMin
      if (closeHour === 0 && closeMin === 0) {
        // Midnight means end of day, so use 24:00 for calculation
        effectiveCloseHour = 24
        effectiveCloseMin = 0
        console.log('[getAvailableTimeSlots] Midnight close time detected, treating as 24:00')
      }
      
      let currentHour = openHour
      let currentMin = openMin
      let iterations = 0
      const maxIterations = 200 // Safety limit
      
      while (iterations < maxIterations) {
        // Check if we've reached or passed the close time
        if (currentHour > effectiveCloseHour || (currentHour === effectiveCloseHour && currentMin >= effectiveCloseMin)) {
          break
        }
        
        // Don't add slots at or after midnight (24:00) - those are end of day
        if (currentHour < 24) {
          regularSlots.push(`${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`)
        }
        
        currentMin += 30
        if (currentMin >= 60) {
          currentMin = 0
          currentHour++
        }
        
        iterations++
      }
      
      if (iterations >= maxIterations) {
        console.warn('[getAvailableTimeSlots] Reached max iterations, stopping slot generation')
      }
      
      console.log('[getAvailableTimeSlots] Generated', regularSlots.length, 'regular slots')
    } else {
      console.log('[getAvailableTimeSlots] No regular hours or regular hours are closed')
    }
    
    if (specialHours) {
      console.log('[getAvailableTimeSlots] Special hours data:', {
        id: specialHours.id,
        title: specialHours.title,
        is_open: specialHours.is_open,
        time_from: specialHours.time_from,
        time_to: specialHours.time_to,
        has_seatings: !!specialHours.special_hours_seatings?.[0],
        seatings_data: specialHours.special_hours_seatings
      })
      
      // When special hours exist, always show ALL slots (regular + special hours)
      // The is_open status doesn't prevent showing slots - special hours slots require prepayment
      console.log('[getAvailableTimeSlots] Special hours exist - generating ALL slots (regular + special hours with prepayment)')

      // Handle both array and single object formats
      let seatings = null
      if (Array.isArray(specialHours.special_hours_seatings)) {
        seatings = specialHours.special_hours_seatings[0]
      } else if (specialHours.special_hours_seatings) {
        seatings = specialHours.special_hours_seatings
      }
      
      const intervalMinutes = seatings?.interval_minutes || 30
      
      // Generate special hours slots if time range is specified
      let specialSlots: string[] = []
      if (specialHours.time_from && specialHours.time_to && specialHours.time_from !== '' && specialHours.time_to !== '') {
        const parseTime = (timeStr: string) => {
          const parts = timeStr.split(':')
          return {
            hour: parseInt(parts[0]) || 0,
            minute: parseInt(parts[1]) || 0
          }
        }
        
        const startTime = parseTime(specialHours.time_from)
        const endTime = parseTime(specialHours.time_to)
        
        // Validate parsed times
        if (!isNaN(startTime.hour) && !isNaN(startTime.minute) && !isNaN(endTime.hour) && !isNaN(endTime.minute)) {
          let currentHour = startTime.hour
          let currentMin = startTime.minute
          let iterations = 0
          const maxIterations = 200
          
          while (iterations < maxIterations) {
            if (currentHour > endTime.hour || (currentHour === endTime.hour && currentMin >= endTime.minute)) {
              break
            }
            
            const timeSlot = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`
            specialSlots.push(timeSlot)
            
            currentMin += intervalMinutes
            if (currentMin >= 60) {
              currentMin = currentMin % 60
              currentHour++
            }
            
            iterations++
          }
        }
      }
      
      // Combine special hours slots with regular slots, removing duplicates
      const allSlotsSet = new Set<string>()
      regularSlots.forEach(slot => allSlotsSet.add(slot))
      specialSlots.forEach(slot => allSlotsSet.add(slot))
      const allSlots = Array.from(allSlotsSet).sort()
      
      console.log('[getAvailableTimeSlots] Generated', allSlots.length, 'total slots (', regularSlots.length, 'regular +', specialSlots.length, 'special hours with prepayment)')
      console.log('[getAvailableTimeSlots] Sample regular slots:', regularSlots.slice(0, 5), '...', regularSlots.slice(-5))
      console.log('[getAvailableTimeSlots] Sample special slots:', specialSlots.slice(0, 5), '...', specialSlots.slice(-5))
      console.log('[getAvailableTimeSlots] Sample combined slots:', allSlots.slice(0, 10), '...', allSlots.slice(-10))
      
      // Filter out slots that conflict with events (with 1-hour buffer)
      // Only events with action_button_type === 'custom_tickets' and paid tickets (price > $0) will block reservations
      const eventsWithPaidTickets = filterCustomTicketEvents(events)
      if (eventsWithPaidTickets.length > 0) {
        const closeTime = (regularHours && !regularHours.is_closed) ? regularHours.close_time : (specialHours.time_to || null)
        const filteredSlots: string[] = []
        for (const slot of allSlots) {
          const isBlocked = await isTimeSlotBlockedByEvent(date, slot, eventsWithPaidTickets, 60, closeTime || undefined)
          if (!isBlocked) {
            filteredSlots.push(slot)
          }
        }
        console.log('[getAvailableTimeSlots] Filtered out', allSlots.length - filteredSlots.length, 'slots due to event conflicts (custom ticket events only)')
        return filteredSlots
      }
      
      return allSlots
    } else {
      // No special hours - use regular opening hours only
      console.log('[getAvailableTimeSlots] No special hours, using regular hours')
      
      if (!regularHours || regularHours.is_closed) {
        console.log('[getAvailableTimeSlots] Regular hours: closed')
        return []
      }

      console.log('[getAvailableTimeSlots] Generated', regularSlots.length, 'slots for regular hours')
      
      // Filter out slots that conflict with events (with 1-hour buffer)
      // Only events with action_button_type === 'custom_tickets' and paid tickets (price > $0) will block reservations
      const eventsWithPaidTickets = filterCustomTicketEvents(events)
      if (eventsWithPaidTickets.length > 0) {
        // Handle midnight close time for event blocking check
        let closeTimeForEventCheck = regularHours.close_time
        if (closeTimeForEventCheck === '00:00:00' || closeTimeForEventCheck === '00:00') {
          // Midnight means end of day, use 23:59 for event blocking calculations
          closeTimeForEventCheck = '23:59'
        }
        
        const filteredSlots: string[] = []
        for (const slot of regularSlots) {
          const isBlocked = await isTimeSlotBlockedByEvent(date, slot, eventsWithPaidTickets, 60, closeTimeForEventCheck || undefined)
          if (!isBlocked) {
            filteredSlots.push(slot)
          }
        }
        console.log('[getAvailableTimeSlots] Filtered out', regularSlots.length - filteredSlots.length, 'slots due to event conflicts (custom ticket events only)')
        return filteredSlots
      }
      
      return regularSlots
    }
  } catch (error) {
    console.error('[getAvailableTimeSlots] Error:', error)
    return []
  }
}

// Site Settings
export async function getSiteSetting(key: string) {
  if (!supabase) {
    console.error('Supabase client not available')
    return null
  }
  
  const { data, error } = await supabase
    .from('site_settings')
    .select('*')
    .eq('key', key)
    .single()

  if (error) {
    console.error('Error fetching site setting:', error)
    return null
  }
  return data
}

// Get all site settings at once (address, phone, email, social links, etc.)
export async function getAllSiteSettings() {
  try {
    if (!supabase) {
      console.error('Supabase client not available')
      return {}
    }

    const { data, error } = await supabase
      .from('site_settings')
      .select('key, value')

    if (error) {
      logQueryError('getAllSiteSettings', error, 'site_settings')
      return {}
    }

    // Convert array to object
    const settings: Record<string, any> = {}
    if (data) {
      data.forEach((setting: any) => {
        let value = setting.value
        
        // Handle JSON strings
        if (typeof value === 'string' && (value.startsWith('"') || value.startsWith('{'))) {
          try {
            value = JSON.parse(value)
          } catch {
            // Keep as is if parsing fails
          }
        }
        
        // Remove quotes from string values
        if (typeof value === 'string') {
          value = value.replace(/^"|"$/g, '')
        }
        
        settings[setting.key] = value
      })
    }

    return settings
  } catch (error) {
    console.error('Error in getAllSiteSettings:', error)
    return {}
  }
}

// Get logo URL (server-side)
export async function getLogoUrl(): Promise<string | null> {
  try {
    if (!supabase) {
      console.error('Supabase client not available')
      return null
    }

    const { data, error } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'logo_path')
      .single()

    if (error || !data?.value) {
      return null
    }

    let logoPath = typeof data.value === 'string' 
      ? data.value.replace(/^"|"$/g, '')
      : data.value

    if (!logoPath) {
      return null
    }

    // Import getImageUrl dynamically to avoid client-side code in server component
    const { getImageUrl } = await import('@/lib/image-utils')
    return getImageUrl(logoPath, 'site-assets', true)
  } catch (error) {
    console.error('Error in getLogoUrl:', error)
    return null
  }
}

