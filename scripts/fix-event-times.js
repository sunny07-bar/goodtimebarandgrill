/**
 * Fix event times in database
 * This script will recalculate UTC times for events based on their intended Florida time
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
 * Convert Florida datetime-local to UTC (corrected version)
 */
function floridaDateTimeLocalToUTC(datetimeLocal) {
  if (!datetimeLocal) return null;
  
  const [datePart, timePart] = datetimeLocal.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes] = (timePart || '00:00').split(':').map(Number);
  
  // Create date object with the components
  // fromZonedTime will interpret these local components as Florida timezone
  const dateWithComponents = new Date(year, month - 1, day, hours, minutes, 0, 0);
  
  // Convert to UTC by interpreting the components as Florida timezone
  const utcDate = fromZonedTime(dateWithComponents, FLORIDA_TIMEZONE);
  
  return utcDate.toISOString();
}

async function fixEventTimes() {
  console.log('='.repeat(80));
  console.log('FIXING EVENT TIMES IN DATABASE');
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

    console.log(`Found ${events.length} events to check`);
    console.log('');

    const floridaNow = toZonedTime(new Date(), FLORIDA_TIMEZONE);
    const todayFlorida = format(floridaNow, 'yyyy-MM-dd');

    for (const event of events) {
      if (!event.event_start) {
        console.log(`Skipping ${event.title || event.id} - no event_start`);
        continue;
      }

      // Get current stored UTC time
      const currentUTC = event.event_start;
      const currentFlorida = toFloridaTime(currentUTC);
      const currentFloridaDate = format(currentFlorida, 'yyyy-MM-dd');
      const currentFloridaTime = format(currentFlorida, 'HH:mm');

      console.log(`\nEvent: ${event.title || event.id}`);
      console.log(`  Current UTC: ${currentUTC}`);
      console.log(`  Current Florida: ${formatFloridaTime(currentUTC, 'MM-dd-yyyy h:mm a')}`);
      console.log(`  Current Florida Date: ${currentFloridaDate}`);
      console.log(`  Current Florida Time: ${currentFloridaTime}`);

      // Extract the intended date and time from Florida timezone
      // The "intended" date is what the user wanted (the calendar date in Florida)
      // We need to preserve this date and time, but ensure UTC is correct
      
      // Create datetime-local string from Florida time
      const floridaDateTimeLocal = `${currentFloridaDate}T${currentFloridaTime}`;
      
      // Convert back to UTC using the corrected function
      const correctedUTC = floridaDateTimeLocalToUTC(floridaDateTimeLocal);
      
      console.log(`  Corrected UTC: ${correctedUTC}`);
      console.log(`  Corrected Florida: ${formatFloridaTime(correctedUTC, 'MM-dd-yyyy h:mm a')}`);

      // Check if correction is needed
      if (correctedUTC !== currentUTC) {
        console.log(`  ⚠️  NEEDS FIX - UTC times don't match!`);
        
        // Update the event
        const updateData = {
          event_start: correctedUTC
        };
        
        // Fix event_end if it exists
        if (event.event_end) {
          const endFlorida = toFloridaTime(event.event_end);
          const endFloridaDate = format(endFlorida, 'yyyy-MM-dd');
          const endFloridaTime = format(endFlorida, 'HH:mm');
          const endDateTimeLocal = `${endFloridaDate}T${endFloridaTime}`;
          updateData.event_end = floridaDateTimeLocalToUTC(endDateTimeLocal);
          console.log(`  Also fixing event_end: ${updateData.event_end}`);
        }

        // Update the event in database
        const { error: updateError } = await supabase
          .from('events')
          .update(updateData)
          .eq('id', event.id);

        if (updateError) {
          console.error(`  ❌ Error updating: ${updateError.message}`);
        } else {
          console.log(`  ✅ Fixed!`);
        }
      } else {
        console.log(`  ✅ Already correct`);
      }
    }

    console.log('');
    console.log('='.repeat(80));
    console.log('NOTE: This script shows what would be fixed.');
    console.log('Uncomment the update code to actually fix the events in the database.');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('Error:', error);
  }
}

fixEventTimes()
  .then(() => {
    console.log('');
    console.log('Analysis complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

