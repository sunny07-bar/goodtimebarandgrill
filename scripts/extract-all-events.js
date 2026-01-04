/**
 * Extract all events from database and display their data
 * This will help identify any data inconsistencies
 */

const { createClient } = require('@supabase/supabase-js');
const { parseISO, format } = require('date-fns');
const { formatInTimeZone, toZonedTime } = require('date-fns-tz');
const fs = require('fs');
const path = require('path');

const FLORIDA_TIMEZONE = 'America/New_York';

// Load .env.local file
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      process.env[key] = value;
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function formatFloridaTime(date, formatStr) {
  if (!date) return 'N/A';
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : new Date(date);
    return formatInTimeZone(dateObj, FLORIDA_TIMEZONE, formatStr);
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

function toFloridaTime(date) {
  if (!date) return null;
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : new Date(date);
    return toZonedTime(dateObj, FLORIDA_TIMEZONE);
  } catch (error) {
    return null;
  }
}

async function extractAllEvents() {
  console.log('='.repeat(80));
  console.log('EXTRACTING ALL EVENTS FROM DATABASE');
  console.log('='.repeat(80));
  console.log('');

  try {
    // Fetch all events
    const { data: events, error } = await supabase
      .from('events')
      .select('*')
      .order('event_start', { ascending: true });

    if (error) {
      console.error('Error fetching events:', error);
      return;
    }

    if (!events || events.length === 0) {
      console.log('No events found in database');
      return;
    }

    console.log(`Total events found: ${events.length}`);
    console.log('');

    // Get current time in Florida
    const floridaNow = toZonedTime(new Date(), FLORIDA_TIMEZONE);
    const todayFlorida = format(floridaNow, 'yyyy-MM-dd');
    console.log(`Current Florida Time: ${formatFloridaTime(new Date(), 'MM-dd-yyyy h:mm a')}`);
    console.log(`Today's Date (Florida): ${todayFlorida}`);
    console.log('');

    events.forEach((event, index) => {
      console.log('='.repeat(80));
      console.log(`EVENT #${index + 1}: ${event.title || 'Untitled'}`);
      console.log('='.repeat(80));
      console.log(`ID: ${event.id}`);
      console.log(`Slug: ${event.slug || 'N/A'}`);
      console.log(`Title: ${event.title || 'N/A'}`);
      console.log(`Location: ${event.location || 'N/A'}`);
      console.log('');
      
      // Event Start
      console.log('--- EVENT START ---');
      console.log(`Raw DB Value (UTC): ${event.event_start || 'NULL'}`);
      if (event.event_start) {
        const eventStartUTC = parseISO(event.event_start);
        const eventStartFlorida = toFloridaTime(event.event_start);
        const eventDateFlorida = format(eventStartFlorida, 'yyyy-MM-dd');
        
        console.log(`UTC Timestamp: ${eventStartUTC.toISOString()}`);
        console.log(`Florida Time: ${formatFloridaTime(event.event_start, 'MM-dd-yyyy h:mm a')}`);
        console.log(`Florida Date: ${eventDateFlorida}`);
        console.log(`Is Today: ${eventDateFlorida === todayFlorida ? 'YES' : 'NO'}`);
        console.log(`Is Past: ${eventDateFlorida < todayFlorida ? 'YES' : 'NO'}`);
        console.log(`Is Future: ${eventDateFlorida > todayFlorida ? 'YES' : 'NO'}`);
      } else {
        console.log('ERROR: event_start is NULL or missing!');
      }
      console.log('');
      
      // Event End
      console.log('--- EVENT END ---');
      console.log(`Raw DB Value (UTC): ${event.event_end || 'NULL'}`);
      if (event.event_end) {
        console.log(`UTC Timestamp: ${parseISO(event.event_end).toISOString()}`);
        console.log(`Florida Time: ${formatFloridaTime(event.event_end, 'MM-dd-yyyy h:mm a')}`);
      } else {
        console.log('No end time specified');
      }
      console.log('');
      
      // Ticket Info
      console.log('--- TICKET INFO ---');
      console.log(`Base Ticket Price: ${event.base_ticket_price !== null ? `$${event.base_ticket_price}` : 'NULL'}`);
      console.log(`Ticket Currency: ${event.ticket_currency || 'N/A'}`);
      console.log('');
      
      // Image
      console.log('--- IMAGE ---');
      console.log(`Image Path: ${event.image_path || 'N/A'}`);
      console.log('');
      
      // Timestamps
      console.log('--- METADATA ---');
      console.log(`Created At: ${event.created_at ? formatFloridaTime(event.created_at, 'MM-dd-yyyy h:mm a') : 'N/A'}`);
      console.log(`Updated At: ${event.updated_at ? formatFloridaTime(event.updated_at, 'MM-dd-yyyy h:mm a') : 'N/A'}`);
      console.log('');
      
      // Check for issues
      console.log('--- ISSUES CHECK ---');
      const issues = [];
      
      if (!event.event_start) {
        issues.push('❌ Missing event_start');
      }
      
      if (event.event_start) {
        const eventDateFlorida = format(toFloridaTime(event.event_start), 'yyyy-MM-dd');
        if (eventDateFlorida < todayFlorida) {
          issues.push(`⚠️  Event date (${eventDateFlorida}) is in the past`);
        }
        if (eventDateFlorida === todayFlorida) {
          issues.push(`✅ Event is TODAY (${eventDateFlorida})`);
        }
      }
      
      if (event.event_end && event.event_start) {
        const startFlorida = toFloridaTime(event.event_start);
        const endFlorida = toFloridaTime(event.event_end);
        if (endFlorida < startFlorida) {
          issues.push('❌ Event end time is before start time!');
        }
      }
      
      if (issues.length === 0) {
        console.log('✅ No issues found');
      } else {
        issues.forEach(issue => console.log(issue));
      }
      
      console.log('');
      console.log('');
    });

    // Summary
    console.log('='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));
    
    const eventsToday = events.filter(event => {
      if (!event.event_start) return false;
      const eventDateFlorida = format(toFloridaTime(event.event_start), 'yyyy-MM-dd');
      return eventDateFlorida === todayFlorida;
    });
    
    const eventsFuture = events.filter(event => {
      if (!event.event_start) return false;
      const eventDateFlorida = format(toFloridaTime(event.event_start), 'yyyy-MM-dd');
      return eventDateFlorida > todayFlorida;
    });
    
    const eventsPast = events.filter(event => {
      if (!event.event_start) return false;
      const eventDateFlorida = format(toFloridaTime(event.event_start), 'yyyy-MM-dd');
      return eventDateFlorida < todayFlorida;
    });
    
    console.log(`Total Events: ${events.length}`);
    console.log(`Events Today: ${eventsToday.length}`);
    console.log(`Events Future: ${eventsFuture.length}`);
    console.log(`Events Past: ${eventsPast.length}`);
    console.log(`Events with NULL event_start: ${events.filter(e => !e.event_start).length}`);
    
    if (eventsToday.length > 0) {
      console.log('');
      console.log('Events happening TODAY:');
      eventsToday.forEach(event => {
        console.log(`  - ${event.title} (${formatFloridaTime(event.event_start, 'h:mm a')})`);
      });
    }
    
    console.log('');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('Error:', error);
  }
}

extractAllEvents()
  .then(() => {
    console.log('');
    console.log('Extraction complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

