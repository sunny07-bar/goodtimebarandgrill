/**
 * Test Script for Reservation and Event Logic
 * 
 * This script tests:
 * 1. Event conflict detection (only events with paid tickets should block)
 * 2. Timezone conversions (Florida timezone)
 * 3. Date/time validations
 * 4. Reservation blocking logic
 * 
 * Run with: node scripts/test-reservation-logic.js
 */

const { format, parseISO } = require('date-fns')
const { formatInTimeZone, fromZonedTime, toZonedTime } = require('date-fns-tz')

const FLORIDA_TIMEZONE = 'America/New_York'

// Helper functions (matching website/lib/utils/timezone.ts)
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

function floridaToUTC(date) {
  return fromZonedTime(date, FLORIDA_TIMEZONE)
}

function hasPaidTickets(event) {
  // Check if event has event_tickets
  if (event.event_tickets && Array.isArray(event.event_tickets) && event.event_tickets.length > 0) {
    // Check if at least one ticket has price > $0
    const hasPaidTicket = event.event_tickets.some((ticket) => {
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

function filterEventsWithPaidTickets(events) {
  return events.filter(event => hasPaidTickets(event))
}

// Test event conflict detection
function checkEventConflict(reservationDate, reservationTime, events, bufferMinutes = 120) {
  if (!events || events.length === 0) {
    return { hasConflict: false, conflictingEvent: null }
  }
  
  // Filter to only events with paid tickets (price > $0)
  const eventsWithPaidTickets = filterEventsWithPaidTickets(events)
  
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
    
    // For simplicity, assume event end is 3 hours after start if not provided
    let eventEndUTC = event.event_end 
      ? (typeof event.event_end === 'string' ? parseISO(event.event_end) : new Date(event.event_end))
      : new Date(eventStartUTC.getTime() + 3 * 60 * 60 * 1000)

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

// Test Cases
console.log('='.repeat(80))
console.log('RESERVATION AND EVENT LOGIC TEST SCRIPT')
console.log('='.repeat(80))
console.log()

// Test 1: Event with paid tickets should block reservations
console.log('TEST 1: Event with paid tickets should block reservations')
console.log('-'.repeat(80))
const eventWithPaidTickets = {
  id: 'event-1',
  title: 'Paid Event',
  event_start: '2024-12-25T20:00:00Z', // 8 PM EST (Dec 25, 2024)
  event_end: '2024-12-25T23:00:00Z', // 11 PM EST
  event_tickets: [
    { id: 'ticket-1', price: 25.00 },
    { id: 'ticket-2', price: 50.00 }
  ]
}

const reservationDate1 = '2024-12-25'
const reservationTime1 = '19:00' // 7 PM (1 hour before event, within 2-hour buffer)

const result1 = checkEventConflict(reservationDate1, reservationTime1, [eventWithPaidTickets])
console.log(`Event: ${eventWithPaidTickets.title}`)
console.log(`Event Start (Florida): ${formatFloridaTime(eventWithPaidTickets.event_start, 'MM-dd-yyyy h:mm a')}`)
console.log(`Reservation: ${reservationDate1} at ${reservationTime1}`)
console.log(`Has Paid Tickets: ${hasPaidTickets(eventWithPaidTickets)}`)
console.log(`Should Block: ${result1.hasConflict ? 'YES ✓' : 'NO ✗'}`)
console.log()

// Test 2: Event with free tickets (all $0) should NOT block reservations
console.log('TEST 2: Event with free tickets (all $0) should NOT block reservations')
console.log('-'.repeat(80))
const eventWithFreeTickets = {
  id: 'event-2',
  title: 'Free Event',
  event_start: '2024-12-26T20:00:00Z', // 8 PM EST (Dec 26, 2024)
  event_end: '2024-12-26T23:00:00Z', // 11 PM EST
  event_tickets: [
    { id: 'ticket-3', price: 0.00 },
    { id: 'ticket-4', price: 0.00 }
  ]
}

const reservationDate2 = '2024-12-26'
const reservationTime2 = '19:00' // 7 PM (1 hour before event)

const result2 = checkEventConflict(reservationDate2, reservationTime2, [eventWithFreeTickets])
console.log(`Event: ${eventWithFreeTickets.title}`)
console.log(`Event Start (Florida): ${formatFloridaTime(eventWithFreeTickets.event_start, 'MM-dd-yyyy h:mm a')}`)
console.log(`Reservation: ${reservationDate2} at ${reservationTime2}`)
console.log(`Has Paid Tickets: ${hasPaidTickets(eventWithFreeTickets)}`)
console.log(`Should Block: ${result2.hasConflict ? 'YES ✗ (WRONG!)' : 'NO ✓'}`)
console.log()

// Test 3: Event with no tickets should NOT block reservations
console.log('TEST 3: Event with no tickets should NOT block reservations')
console.log('-'.repeat(80))
const eventWithNoTickets = {
  id: 'event-3',
  title: 'Event Without Tickets',
  event_start: '2024-12-27T20:00:00Z', // 8 PM EST (Dec 27, 2024)
  event_end: '2024-12-27T23:00:00Z', // 11 PM EST
  event_tickets: []
}

const reservationDate3 = '2024-12-27'
const reservationTime3 = '19:00' // 7 PM (1 hour before event)

const result3 = checkEventConflict(reservationDate3, reservationTime3, [eventWithNoTickets])
console.log(`Event: ${eventWithNoTickets.title}`)
console.log(`Event Start (Florida): ${formatFloridaTime(eventWithNoTickets.event_start, 'MM-dd-yyyy h:mm a')}`)
console.log(`Reservation: ${reservationDate3} at ${reservationTime3}`)
console.log(`Has Paid Tickets: ${hasPaidTickets(eventWithNoTickets)}`)
console.log(`Should Block: ${result3.hasConflict ? 'YES ✗ (WRONG!)' : 'NO ✓'}`)
console.log()

// Test 4: Event with base_ticket_price > 0 should block reservations
console.log('TEST 4: Event with base_ticket_price > 0 should block reservations')
console.log('-'.repeat(80))
const eventWithBasePrice = {
  id: 'event-4',
  title: 'Event With Base Price',
  event_start: '2024-12-28T20:00:00Z', // 8 PM EST (Dec 28, 2024)
  event_end: '2024-12-28T23:00:00Z', // 11 PM EST
  base_ticket_price: 30.00,
  event_tickets: []
}

const reservationDate4 = '2024-12-28'
const reservationTime4 = '19:00' // 7 PM (1 hour before event)

const result4 = checkEventConflict(reservationDate4, reservationTime4, [eventWithBasePrice])
console.log(`Event: ${eventWithBasePrice.title}`)
console.log(`Event Start (Florida): ${formatFloridaTime(eventWithBasePrice.event_start, 'MM-dd-yyyy h:mm a')}`)
console.log(`Reservation: ${reservationDate4} at ${reservationTime4}`)
console.log(`Has Paid Tickets: ${hasPaidTickets(eventWithBasePrice)}`)
console.log(`Should Block: ${result4.hasConflict ? 'YES ✓' : 'NO ✗'}`)
console.log()

// Test 5: Reservation outside buffer should NOT be blocked
console.log('TEST 5: Reservation outside 2-hour buffer should NOT be blocked')
console.log('-'.repeat(80))
const reservationDate5 = '2024-12-25'
const reservationTime5 = '12:00' // 12 PM (3 hours before event at 3 PM, outside 2-hour buffer which starts at 1 PM)

const result5 = checkEventConflict(reservationDate5, reservationTime5, [eventWithPaidTickets])
console.log(`Event: ${eventWithPaidTickets.title}`)
console.log(`Event Start (Florida): ${formatFloridaTime(eventWithPaidTickets.event_start, 'MM-dd-yyyy h:mm a')}`)
console.log(`Buffer Start (2 hours before): ${formatFloridaTime(new Date(parseISO(eventWithPaidTickets.event_start).getTime() - 120 * 60 * 1000), 'h:mm a')}`)
console.log(`Reservation: ${reservationDate5} at ${reservationTime5}`)
console.log(`Should Block: ${result5.hasConflict ? 'YES ✗ (WRONG!)' : 'NO ✓'}`)
console.log()

// Test 5b: Reservation within buffer should be blocked
console.log('TEST 5b: Reservation within 2-hour buffer should be blocked')
console.log('-'.repeat(80))
const reservationDate5b = '2024-12-25'
const reservationTime5b = '14:00' // 2 PM (1 hour before event at 3 PM, within 2-hour buffer)

const result5b = checkEventConflict(reservationDate5b, reservationTime5b, [eventWithPaidTickets])
console.log(`Event: ${eventWithPaidTickets.title}`)
console.log(`Event Start (Florida): ${formatFloridaTime(eventWithPaidTickets.event_start, 'MM-dd-yyyy h:mm a')}`)
console.log(`Reservation: ${reservationDate5b} at ${reservationTime5b}`)
console.log(`Should Block: ${result5b.hasConflict ? 'YES ✓' : 'NO ✗ (WRONG!)'}`)
console.log()

// Test 6: Multiple events - only paid ones should block
console.log('TEST 6: Multiple events - only paid ones should block')
console.log('-'.repeat(80))
const multipleEvents = [
  eventWithPaidTickets,
  eventWithFreeTickets,
  eventWithNoTickets,
  eventWithBasePrice
]

const reservationDate6 = '2024-12-25'
const reservationTime6 = '19:00' // 7 PM (should only conflict with paid event)

const result6 = checkEventConflict(reservationDate6, reservationTime6, multipleEvents)
console.log(`Total Events: ${multipleEvents.length}`)
console.log(`Events with Paid Tickets: ${filterEventsWithPaidTickets(multipleEvents).length}`)
console.log(`Reservation: ${reservationDate6} at ${reservationTime6}`)
console.log(`Should Block: ${result6.hasConflict ? 'YES ✓' : 'NO ✗'}`)
if (result6.hasConflict) {
  console.log(`Conflicting Event: ${result6.conflictingEvent.title}`)
}
console.log()

// Test 7: Timezone conversion test
console.log('TEST 7: Timezone conversion accuracy')
console.log('-'.repeat(80))
const testDateUTC = '2024-12-25T20:00:00Z' // 8 PM UTC
const floridaTime = toFloridaTime(testDateUTC)
console.log(`UTC Time: ${testDateUTC}`)
console.log(`Florida Time: ${formatFloridaTime(testDateUTC, 'MM-dd-yyyy h:mm a')}`)
console.log(`Florida Date Object: ${floridaTime.toISOString()}`)
console.log()

// Test 8: Current time check
console.log('TEST 8: Current time in Florida timezone')
console.log('-'.repeat(80))
const floridaNow = getFloridaNow()
console.log(`Current UTC: ${new Date().toISOString()}`)
console.log(`Current Florida: ${formatFloridaTime(floridaNow, 'MM-dd-yyyy h:mm a')}`)
console.log()

// Summary
console.log('='.repeat(80))
console.log('TEST SUMMARY')
console.log('='.repeat(80))
console.log('✓ = Test passed')
console.log('✗ = Test failed')
console.log()
console.log('Please review the test results above to identify any issues.')
console.log('Key things to check:')
console.log('1. Events with paid tickets (> $0) should block reservations')
console.log('2. Events with free tickets ($0) should NOT block reservations')
console.log('3. Events with no tickets should NOT block reservations')
console.log('4. Only reservations within 2-hour buffer should be blocked')
console.log('5. Timezone conversions should be accurate (Florida = America/New_York)')
console.log('='.repeat(80))

