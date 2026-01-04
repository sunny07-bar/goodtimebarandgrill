/**
 * Test Event Blocking Logic
 * 
 * This script tests which slots should be blocked by an event
 */

const { format, parseISO } = require('date-fns')
const { formatInTimeZone, fromZonedTime, toZonedTime } = require('date-fns-tz')

const FLORIDA_TIMEZONE = 'America/New_York'

function toFloridaTime(date) {
  const dateObj = typeof date === 'string' ? parseISO(date) : date
  return toZonedTime(dateObj, FLORIDA_TIMEZONE)
}

function formatFloridaTime(date, formatStr) {
  const dateObj = typeof date === 'string' ? parseISO(date) : date
  return formatInTimeZone(dateObj, FLORIDA_TIMEZONE, formatStr)
}


async function testEventBlocking() {
  console.log('='.repeat(80))
  console.log('TESTING EVENT BLOCKING LOGIC')
  console.log('='.repeat(80))
  console.log()

  // Simulate the scenario: Event at 10 PM on Jan 2, 2026
  // Restaurant hours: 11:00 AM to 00:00 (midnight)
  // Event: 10:00 PM (22:00) with paid tickets
  // Buffer: 2 hours before and after
  
  const testDate = '2026-01-02'
  const eventStartUTC = '2026-01-03T03:00:00Z' // 10 PM EST on Jan 2 = 3 AM UTC on Jan 3
  const eventEndUTC = '2026-01-03T04:00:00Z'   // 11 PM EST on Jan 2 = 4 AM UTC on Jan 3
  
  console.log('SCENARIO:')
  console.log(`  Date: ${testDate}`)
  console.log(`  Restaurant Hours: 11:00 AM to 12:00 AM (midnight)`)
  console.log(`  Event Start (Florida): ${formatFloridaTime(eventStartUTC, 'MM-dd-yyyy h:mm a')}`)
  console.log(`  Event End (Florida): ${formatFloridaTime(eventEndUTC, 'MM-dd-yyyy h:mm a')}`)
  console.log(`  Buffer: 2 hours before and after event`)
  console.log()

  // Generate all possible slots (11:00 AM to 11:30 PM, every 30 minutes)
  const allSlots = []
  for (let hour = 11; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      allSlots.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`)
    }
  }
  
  console.log(`Total slots generated: ${allSlots.length}`)
  console.log(`First 5 slots: ${allSlots.slice(0, 5).join(', ')}`)
  console.log(`Last 5 slots: ${allSlots.slice(-5).join(', ')}`)
  console.log()

  // Calculate blocked period
  const eventStartFlorida = toFloridaTime(eventStartUTC)
  const eventEndFlorida = toFloridaTime(eventEndUTC)
  
  // Buffer: 2 hours before and after
  const bufferStartFlorida = new Date(eventStartFlorida)
  bufferStartFlorida.setHours(bufferStartFlorida.getHours() - 2)
  
  const bufferEndFlorida = new Date(eventEndFlorida)
  bufferEndFlorida.setHours(bufferEndFlorida.getHours() + 2)
  
  console.log('BLOCKED PERIOD:')
  console.log(`  Buffer Start: ${formatFloridaTime(bufferStartFlorida, 'h:mm a')}`)
  console.log(`  Event Start: ${formatFloridaTime(eventStartFlorida, 'h:mm a')}`)
  console.log(`  Event End: ${formatFloridaTime(eventEndFlorida, 'h:mm a')}`)
  console.log(`  Buffer End: ${formatFloridaTime(bufferEndFlorida, 'h:mm a')}`)
  console.log()

  // Check which slots are blocked
  const blockedSlots = []
  const availableSlots = []
  
  for (const slot of allSlots) {
    const [hour, minute] = slot.split(':').map(Number)
    const [year, month, day] = testDate.split('-').map(Number)
    const slotTimeFlorida = new Date(year, month - 1, day, hour, minute, 0)
    
    // Check if slot is within blocked period
    const isBlocked = slotTimeFlorida >= bufferStartFlorida && slotTimeFlorida <= bufferEndFlorida
    
    if (isBlocked) {
      blockedSlots.push(slot)
    } else {
      availableSlots.push(slot)
    }
  }
  
  console.log('RESULTS:')
  console.log(`  Blocked Slots: ${blockedSlots.length}`)
  console.log(`  Blocked: ${blockedSlots.join(', ')}`)
  console.log()
  console.log(`  Available Slots: ${availableSlots.length}`)
  console.log(`  First 5 available: ${availableSlots.slice(0, 5).join(', ')}`)
  console.log(`  Last 5 available: ${availableSlots.slice(-5).join(', ')}`)
  console.log()

  console.log('='.repeat(80))
  console.log('EXPECTED BEHAVIOR:')
  console.log('='.repeat(80))
  console.log('Slots from 11:00 AM to 7:30 PM should be AVAILABLE')
  console.log('Slots from 8:00 PM to 12:00 AM (midnight) should be BLOCKED')
  console.log()
  
  if (availableSlots.length === 0) {
    console.log('❌ PROBLEM: All slots are blocked!')
    console.log('   This means the event blocking logic is too aggressive')
  } else if (availableSlots.length < 10) {
    console.log('⚠️  WARNING: Very few slots available')
    console.log(`   Only ${availableSlots.length} slots available out of ${allSlots.length}`)
  } else {
    console.log(`✓ Correct: ${availableSlots.length} slots available, ${blockedSlots.length} slots blocked`)
  }
  console.log('='.repeat(80))
}

testEventBlocking().catch(console.error)

