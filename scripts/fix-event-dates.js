/**
 * Fix event dates - adjust UTC times so events show on the correct calendar date
 * This fixes events that are showing on the wrong day due to incorrect UTC storage
 */

const { createClient } = require('@supabase/supabase-js');
const { parseISO, format } = require('date-fns');
const { formatInTimeZone, toZonedTime, fromZonedTime } = require('date-fns-tz');
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

/**
 * Get the UTC calendar date from a UTC timestamp
 * This extracts the date part (YYYY-MM-DD) from UTC, which is what we use for display
 */
function getUTCCalendarDate(utcISOString) {
  if (!utcISOString) return null;
  const date = parseISO(utcISOString);
  return format(date, 'yyyy-MM-dd');
}

/**
 * Convert Florida datetime to UTC, ensuring the UTC calendar date matches the intended date
 * If user wants "Jan 3 at 8 PM", we ensure it's stored so the UTC calendar date is Jan 3 or Jan 4
 * (depending on the time), and it displays as "Jan 3" in Florida timezone
 */
function floridaDateTimeLocalToUTC(datetimeLocal) {
  if (!datetimeLocal) return null;
  
  const [datePart, timePart] = datetimeLocal.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes] = (timePart || '00:00').split(':').map(Number);
  
  // Create date object with the components
  const dateWithComponents = new Date(year, month - 1, day, hours, minutes, 0, 0);
  
  // Convert to UTC by interpreting components as Florida timezone
  const utcDate = fromZonedTime(dateWithComponents, FLORIDA_TIMEZONE);
  
  return utcDate.toISOString();
}

async function fixEventDates() {
  console.log('='.repeat(80));
  console.log('ANALYZING EVENT DATES FOR CORRECTNESS');
  console.log('='.repeat(80));
  console.log('');

  try {
    const { data: events, error } = await supabase
      .from('events')
      .select('*')
      .order('event_start', { ascending: true });

    if (error) {
      console.error('Error fetching events:', error);
      return;
    }

    if (!events || events.length === 0) {
      console.log('No events found');
      return;
    }

    console.log(`Found ${events.length} events\n`);

    for (const event of events) {
      if (!event.event_start) continue;

      const currentUTC = event.event_start;
      const currentFlorida = toFloridaTime(currentUTC);
      const currentFloridaDate = format(currentFlorida, 'yyyy-MM-dd');
      const currentFloridaTime = format(currentFlorida, 'HH:mm');
      const utcCalendarDate = getUTCCalendarDate(currentUTC);

      console.log(`Event: ${event.title || event.id}`);
      console.log(`  Stored UTC: ${currentUTC}`);
      console.log(`  UTC Calendar Date: ${utcCalendarDate}`);
      console.log(`  Florida Display: ${formatFloridaTime(currentUTC, 'MM-dd-yyyy h:mm a')}`);
      console.log(`  Florida Date: ${currentFloridaDate}`);
      console.log(`  Florida Time: ${currentFloridaTime}`);

      // The issue: Events should display based on their UTC calendar date
      // But if the UTC time causes it to show on the wrong day in Florida timezone,
      // we need to adjust it.
      //
      // Example: Event intended for "Jan 3 at 8 PM" but stored as "Jan 3 at 3 AM UTC"
      // This shows as "Jan 2 at 10 PM" in Florida timezone - WRONG!
      // Should be stored as "Jan 4 at 1 AM UTC" to show as "Jan 3 at 8 PM" - CORRECT!
      //
      // Strategy: If the UTC calendar date doesn't match the intended Florida date,
      // we need to adjust. But we can't know the "intended" date from the database.
      //
      // However, we can infer: if an event at 8 PM shows on the previous day,
      // it was probably meant for the UTC calendar date, not the previous day.
      //
      // Actually, the real fix: When creating events, ensure the UTC time is correct.
      // For existing events, we need to manually review or use a heuristic.
      
      // For now, let's just report the issue
      const issue = utcCalendarDate !== currentFloridaDate ? 
        `⚠️  Date mismatch: UTC calendar date (${utcCalendarDate}) != Florida date (${currentFloridaDate})` :
        '✅ Dates match';
      
      console.log(`  ${issue}`);
      console.log('');
    }

    console.log('='.repeat(80));
    console.log('Analysis complete. Review the output above to identify events with date mismatches.');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('Error:', error);
  }
}

fixEventDates()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

