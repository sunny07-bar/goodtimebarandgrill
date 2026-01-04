/**
 * Database Test Script for Reservation and Event Logic
 * 
 * This script connects to the database and tests real scenarios:
 * 1. Fetches actual events and checks paid ticket logic
 * 2. Tests reservation conflict detection with real data
 * 3. Validates timezone conversions
 * 
 * Run with: node scripts/test-reservation-db.js
 * 
 * Requires: SUPABASE_URL and SUPABASE_ANON_KEY in .env.local
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const { format, parseISO } = require('date-fns')
const { formatInTimeZone, fromZonedTime, toZonedTime } = require('date-fns-tz')

const FLORIDA_TIMEZONE = 'America/New_York'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Helper functions
function toFloridaTime(date) {
  const dateObj = typeof date === 'string' ? parseISO(date) : date
  return toZonedTime(dateObj, FLORIDA_TIMEZONE)
}

function formatFloridaTime(date, formatStr) {
  const dateObj = typeof date === 'string' ? parseISO(date) : date
  return formatInTimeZone(dateObj, FLORIDA_TIMEZONE, formatStr)
}

function getFloridaNow() {
  return toZonedTime(new Date(), FLORIDA_TIMEZONE)
}

function hasPaidTickets(event) {
  if (event.event_tickets && Array.isArray(event.event_tickets) && event.event_tickets.length > 0) {
    const hasPaidTicket = event.event_tickets.some((ticket) => {
      const price = parseFloat(ticket.price?.toString() || '0')
      return price > 0
    })
    return hasPaidTicket
  }
  
  if (event.base_ticket_price) {
    const basePrice = parseFloat(event.base_ticket_price.toString())
    return basePrice > 0
  }
  
  return false
}

function filterEventsWithPaidTickets(events) {
  return events.filter(event => hasPaidTickets(event))
}

async function getEventsForDate(date) {
  const [year, month, day] = date.split('-').map(Number)
  const dateStartFlorida = new Date(year, month - 1, day, 0, 0, 0, 0)
  const dateEndFlorida = new Date(year, month - 1, day, 23, 59, 59, 999)
  const dateStartUTC = fromZonedTime(dateStartFlorida, FLORIDA_TIMEZONE)
  const dateEndUTC = fromZonedTime(dateEndFlorida, FLORIDA_TIMEZONE)

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
    console.error('Error fetching events:', error)
    return []
  }
  
  return data || []
}

async function checkEventConflict(reservationDate, reservationTime, events, bufferMinutes = 120) {
  if (!events || events.length === 0) {
    return { hasConflict: false, conflictingEvent: null }
  }
  
  const eventsWithPaidTickets = filterEventsWithPaidTickets(events)
  
  if (eventsWithPaidTickets.length === 0) {
    return { hasConflict: false, conflictingEvent: null }
  }

  const [resHour, resMin] = reservationTime.split(':').map(Number)
  const [year, month, day] = reservationDate.split('-').map(Number)
  
  const reservationDateTimeFlorida = new Date(year, month - 1, day, resHour, resMin, 0)
  const reservationDateTimeUTC = fromZonedTime(reservationDateTimeFlorida, FLORIDA_TIMEZONE)

  for (const event of eventsWithPaidTickets) {
    if (!event.event_start) continue

    const eventStartUTC = typeof event.event_start === 'string' ? parseISO(event.event_start) : new Date(event.event_start)
    
    let eventEndUTC = event.event_end 
      ? (typeof event.event_end === 'string' ? parseISO(event.event_end) : new Date(event.event_end))
      : new Date(eventStartUTC.getTime() + 3 * 60 * 60 * 1000)

    const blockedStartUTC = new Date(eventStartUTC.getTime() - bufferMinutes * 60 * 1000)
    const blockedEndUTC = new Date(eventEndUTC.getTime() + bufferMinutes * 60 * 1000)

    if (reservationDateTimeUTC >= blockedStartUTC && reservationDateTimeUTC <= blockedEndUTC) {
      return { hasConflict: true, conflictingEvent: event }
    }
  }

  return { hasConflict: false, conflictingEvent: null }
}

async function runTests() {
  console.log('='.repeat(80))
  console.log('DATABASE TEST: Reservation and Event Logic')
  console.log('='.repeat(80))
  console.log()

  // Get today's date in Florida timezone
  const floridaNow = getFloridaNow()
  const today = format(floridaNow, 'yyyy-MM-dd')
  const tomorrow = format(new Date(floridaNow.getTime() + 24 * 60 * 60 * 1000), 'yyyy-MM-dd')

  console.log(`Current Florida Time: ${formatFloridaTime(floridaNow, 'MM-dd-yyyy h:mm a')}`)
  console.log(`Testing Date: ${tomorrow}`)
  console.log()

  // Test 1: Fetch events for tomorrow
  console.log('TEST 1: Fetching events for tomorrow')
  console.log('-'.repeat(80))
  const events = await getEventsForDate(tomorrow)
  console.log(`Found ${events.length} event(s) for ${tomorrow}`)
  
  if (events.length > 0) {
    events.forEach((event, index) => {
      console.log(`\nEvent ${index + 1}:`)
      console.log(`  Title: ${event.title}`)
      console.log(`  Start (Florida): ${formatFloridaTime(event.event_start, 'MM-dd-yyyy h:mm a')}`)
      if (event.event_end) {
        console.log(`  End (Florida): ${formatFloridaTime(event.event_end, 'MM-dd-yyyy h:mm a')}`)
      }
      console.log(`  Has Tickets: ${event.event_tickets?.length || 0}`)
      if (event.event_tickets && event.event_tickets.length > 0) {
        event.event_tickets.forEach(ticket => {
          console.log(`    - ${ticket.name}: $${parseFloat(ticket.price)}`)
        })
      }
      if (event.base_ticket_price) {
        console.log(`  Base Price: $${parseFloat(event.base_ticket_price)}`)
      }
      console.log(`  Has Paid Tickets: ${hasPaidTickets(event) ? 'YES' : 'NO'}`)
    })
  } else {
    console.log('No events found for tomorrow')
  }
  console.log()

  // Test 2: Check which events would block reservations
  console.log('TEST 2: Events that would block reservations')
  console.log('-'.repeat(80))
  const eventsWithPaidTickets = filterEventsWithPaidTickets(events)
  console.log(`Total Events: ${events.length}`)
  console.log(`Events with Paid Tickets: ${eventsWithPaidTickets.length}`)
  console.log(`Events that would block: ${eventsWithPaidTickets.length}`)
  console.log(`Events that would NOT block: ${events.length - eventsWithPaidTickets.length}`)
  console.log()

  // Test 3: Test reservation conflict detection
  if (eventsWithPaidTickets.length > 0) {
    console.log('TEST 3: Testing reservation conflict detection')
    console.log('-'.repeat(80))
    const testEvent = eventsWithPaidTickets[0]
    const eventStartFlorida = toFloridaTime(testEvent.event_start)
    const testReservationTime = format(eventStartFlorida, 'HH:mm')
    const testReservationDate = format(eventStartFlorida, 'yyyy-MM-dd')
    
    // Test reservation 1 hour before event (should be blocked)
    const testTime1 = new Date(eventStartFlorida)
    testTime1.setHours(testTime1.getHours() - 1)
    const reservationTime1 = format(testTime1, 'HH:mm')
    
    const result1 = await checkEventConflict(testReservationDate, reservationTime1, events)
    console.log(`Event: ${testEvent.title}`)
    console.log(`Event Start: ${formatFloridaTime(testEvent.event_start, 'MM-dd-yyyy h:mm a')}`)
    console.log(`Reservation: ${testReservationDate} at ${reservationTime1} (1 hour before event)`)
    console.log(`Should Block: ${result1.hasConflict ? 'YES ✓' : 'NO ✗'}`)
    if (result1.hasConflict) {
      console.log(`Conflicting Event: ${result1.conflictingEvent.title}`)
    }
    console.log()
  }

  // Test 4: Test with free event (should not block)
  const freeEvents = events.filter(e => !hasPaidTickets(e))
  if (freeEvents.length > 0) {
    console.log('TEST 4: Testing with free event (should NOT block)')
    console.log('-'.repeat(80))
    const freeEvent = freeEvents[0]
    const freeEventStartFlorida = toFloridaTime(freeEvent.event_start)
    const freeTestDate = format(freeEventStartFlorida, 'yyyy-MM-dd')
    const freeTestTime = new Date(freeEventStartFlorida)
    freeTestTime.setHours(freeTestTime.getHours() - 1)
    const freeReservationTime = format(freeTestTime, 'HH:mm')
    
    const result2 = await checkEventConflict(freeTestDate, freeReservationTime, [freeEvent])
    console.log(`Event: ${freeEvent.title}`)
    console.log(`Event Start: ${formatFloridaTime(freeEvent.event_start, 'MM-dd-yyyy h:mm a')}`)
    console.log(`Has Paid Tickets: ${hasPaidTickets(freeEvent)}`)
    console.log(`Reservation: ${freeTestDate} at ${freeReservationTime} (1 hour before event)`)
    console.log(`Should Block: ${result2.hasConflict ? 'YES ✗ (WRONG!)' : 'NO ✓'}`)
    console.log()
  }

  console.log('='.repeat(80))
  console.log('TEST COMPLETE')
  console.log('='.repeat(80))
}

runTests().catch(console.error)

