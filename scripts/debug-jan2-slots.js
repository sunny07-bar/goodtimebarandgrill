/**
 * Debug Script for January 2nd Time Slots Issue
 * 
 * This script checks why no time slots are showing for January 2nd
 * 
 * Run with: node scripts/debug-jan2-slots.js
 */

// Load environment variables manually
const fs = require('fs')
const path = require('path')

try {
  const envPath = path.join(__dirname, '..', '.env.local')
  const envFile = fs.readFileSync(envPath, 'utf8')
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/)
    if (match) {
      process.env[match[1].trim()] = match[2].trim()
    }
  })
} catch (err) {
  console.warn('Could not load .env.local, using environment variables')
}

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

function getDayOfWeekInFlorida(dateString) {
  const [year, month, day] = dateString.split('-').map(Number)
  const utcDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
  const floridaDate = toZonedTime(utcDate, FLORIDA_TIMEZONE)
  return floridaDate.getDay()
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

async function debugDate(dateString) {
  console.log('='.repeat(80))
  console.log(`DEBUGGING TIME SLOTS FOR: ${dateString}`)
  console.log('='.repeat(80))
  console.log()

  // Check 1: Is date in the past?
  const floridaNow = getFloridaNow()
  const [year, month, day] = dateString.split('-').map(Number)
  const dateObj = new Date(year, month - 1, day)
  const floridaDate = toZonedTime(dateObj, FLORIDA_TIMEZONE)
  const isPast = floridaDate < floridaNow
  
  console.log('1. DATE VALIDATION')
  console.log('-'.repeat(80))
  console.log(`Selected Date: ${dateString}`)
  console.log(`Current Florida Time: ${formatFloridaTime(floridaNow, 'MM-dd-yyyy h:mm a')}`)
  console.log(`Selected Date (Florida): ${formatFloridaTime(floridaDate, 'MM-dd-yyyy h:mm a')}`)
  console.log(`Is Past: ${isPast ? 'YES ✗ (This would prevent slots)' : 'NO ✓'}`)
  console.log()

  // Check 2: Day of week and regular hours
  const dayOfWeek = getDayOfWeekInFlorida(dateString)
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  
  console.log('2. REGULAR HOURS')
  console.log('-'.repeat(80))
  console.log(`Day of Week: ${dayNames[dayOfWeek]} (${dayOfWeek})`)
  
  const { data: openingHours, error: hoursError } = await supabase
    .from('opening_hours')
    .select('*')
    .order('weekday', { ascending: true })

  if (hoursError) {
    console.error('Error fetching opening hours:', hoursError)
  } else {
    console.log(`Total Opening Hours Records: ${openingHours?.length || 0}`)
    const regularHours = openingHours?.find(h => h.weekday === dayOfWeek)
    
    if (regularHours) {
      console.log(`Regular Hours Found:`)
      console.log(`  Is Closed: ${regularHours.is_closed}`)
      console.log(`  Open Time: ${regularHours.open_time}`)
      console.log(`  Close Time: ${regularHours.close_time}`)
      
      if (regularHours.is_closed) {
        console.log(`  ⚠️  RESTAURANT IS CLOSED ON THIS DAY - This would prevent slots`)
      } else {
        console.log(`  ✓ Restaurant is open`)
      }
    } else {
      console.log(`  ✗ NO REGULAR HOURS SET FOR ${dayNames[dayOfWeek]} - This would prevent slots`)
    }
  }
  console.log()

  // Check 3: Special hours
  console.log('3. SPECIAL HOURS')
  console.log('-'.repeat(80))
  const { data: specialHours, error: specialError } = await supabase
    .from('special_hours')
    .select('*')
    .eq('date', dateString)
    .single()

  if (specialError && specialError.code !== 'PGRST116') {
    console.error('Error fetching special hours:', specialError)
  } else if (specialHours) {
    console.log(`Special Hours Found:`)
    console.log(`  Title: ${specialHours.title || 'N/A'}`)
    console.log(`  Is Open: ${specialHours.is_open}`)
    console.log(`  Time From: ${specialHours.time_from || 'N/A'}`)
    console.log(`  Time To: ${specialHours.time_to || 'N/A'}`)
    
    if (!specialHours.is_open && !specialHours.time_from && !specialHours.time_to) {
      console.log(`  ⚠️  SPECIAL HOURS MARKED AS CLOSED - This might prevent slots`)
    }
  } else {
    console.log(`  ✓ No special hours for this date`)
  }
  console.log()

  // Check 4: Events
  console.log('4. EVENTS')
  console.log('-'.repeat(80))
  const [yearNum, monthNum, dayNum] = dateString.split('-').map(Number)
  const dateStartFlorida = new Date(yearNum, monthNum - 1, dayNum, 0, 0, 0, 0)
  const dateEndFlorida = new Date(yearNum, monthNum - 1, dayNum, 23, 59, 59, 999)
  const dateStartUTC = fromZonedTime(dateStartFlorida, FLORIDA_TIMEZONE)
  const dateEndUTC = fromZonedTime(dateEndFlorida, FLORIDA_TIMEZONE)

  const { data: events, error: eventsError } = await supabase
    .from('events')
    .select(`
      *,
      event_tickets (*)
    `)
    .eq('status', 'upcoming')
    .gte('event_start', dateStartUTC.toISOString())
    .lte('event_start', dateEndUTC.toISOString())
    .order('event_start', { ascending: true })

  if (eventsError) {
    console.error('Error fetching events:', eventsError)
  } else {
    console.log(`Total Events Found: ${events?.length || 0}`)
    
    if (events && events.length > 0) {
      events.forEach((event, index) => {
        console.log(`\n  Event ${index + 1}:`)
        console.log(`    Title: ${event.title}`)
        console.log(`    Start (Florida): ${formatFloridaTime(event.event_start, 'MM-dd-yyyy h:mm a')}`)
        if (event.event_end) {
          console.log(`    End (Florida): ${formatFloridaTime(event.event_end, 'MM-dd-yyyy h:mm a')}`)
        }
        console.log(`    Has Paid Tickets: ${hasPaidTickets(event) ? 'YES' : 'NO'}`)
        if (event.event_tickets && event.event_tickets.length > 0) {
          event.event_tickets.forEach(ticket => {
            console.log(`      - ${ticket.name}: $${parseFloat(ticket.price)}`)
          })
        }
        if (event.base_ticket_price) {
          console.log(`    Base Price: $${parseFloat(event.base_ticket_price)}`)
        }
      })
      
      const eventsWithPaidTickets = filterEventsWithPaidTickets(events)
      console.log(`\n  Events with Paid Tickets: ${eventsWithPaidTickets.length}`)
      console.log(`  ⚠️  These events will block reservations (2-hour buffer before/after)`)
    } else {
      console.log(`  ✓ No events on this date`)
    }
  }
  console.log()

  // Check 5: Generate slots manually
  console.log('5. SLOT GENERATION TEST')
  console.log('-'.repeat(80))
  const regularHours = openingHours?.find(h => h.weekday === dayOfWeek)
  
  if (regularHours && !regularHours.is_closed) {
    const [openHour, openMin] = regularHours.open_time.split(':').map(Number)
    const [closeHour, closeMin] = regularHours.close_time.split(':').map(Number)
    
    let regularSlots = []
    let currentHour = openHour
    let currentMin = openMin
    
    while (currentHour < closeHour || (currentHour === closeHour && currentMin < closeMin)) {
      regularSlots.push(`${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`)
      currentMin += 30
      if (currentMin >= 60) {
        currentMin = 0
        currentHour++
      }
    }
    
    console.log(`Generated ${regularSlots.length} regular slots`)
    console.log(`First 5 slots: ${regularSlots.slice(0, 5).join(', ')}`)
    console.log(`Last 5 slots: ${regularSlots.slice(-5).join(', ')}`)
    
    // Filter past slots if today
    const floridaNow = getFloridaNow()
    const today = format(floridaNow, 'yyyy-MM-dd')
    if (dateString === today) {
      const { fromZonedTime } = require('date-fns-tz')
      const filteredSlots = regularSlots.filter(slot => {
        const [hour, minute] = slot.split(':').map(Number)
        const slotTimeLocal = new Date(yearNum, monthNum - 1, dayNum, hour, minute, 0)
        const slotTimeUTC = fromZonedTime(slotTimeLocal, FLORIDA_TIMEZONE)
        const slotTimeFlorida = toFloridaTime(slotTimeUTC)
        return slotTimeFlorida >= floridaNow
      })
      console.log(`After filtering past slots: ${filteredSlots.length} slots`)
      console.log(`Filtered out: ${regularSlots.length - filteredSlots.length} past slots`)
    }
  } else {
    console.log(`Cannot generate slots - restaurant is closed or no hours set`)
  }
  console.log()

  // Summary
  console.log('='.repeat(80))
  console.log('SUMMARY')
  console.log('='.repeat(80))
  
  const issues = []
  if (isPast) {
    issues.push('Date is in the past')
  }
  if (!regularHours || regularHours.is_closed) {
    issues.push('Restaurant is closed on this day (no regular hours or marked as closed)')
  }
  if (events && events.length > 0) {
    const paidEvents = filterEventsWithPaidTickets(events)
    if (paidEvents.length > 0) {
      issues.push(`${paidEvents.length} event(s) with paid tickets may be blocking slots`)
    }
  }
  
  if (issues.length > 0) {
    console.log('⚠️  ISSUES FOUND:')
    issues.forEach(issue => console.log(`  - ${issue}`))
  } else {
    console.log('✓ No obvious issues found')
    console.log('Check browser console for detailed logs from getAvailableTimeSlots()')
  }
  console.log('='.repeat(80))
}

// Run for January 2, 2026
const testDate = '2026-01-02'
debugDate(testDate).catch(console.error)

