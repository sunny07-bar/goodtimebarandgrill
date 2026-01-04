/**
 * Sync all events in database to match authoritative event list
 * This is the SINGLE SOURCE OF TRUTH - no approximations, no inferences
 */

const { createClient } = require('@supabase/supabase-js');
const { parseISO, format } = require('date-fns');
const { formatInTimeZone, fromZonedTime } = require('date-fns-tz');
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

/**
 * Convert Florida date/time to UTC for database storage
 * @param year - Year (e.g., 2026)
 * @param month - Month (1-12)
 * @param day - Day (1-31)
 * @param hours - Hours (0-23)
 * @param minutes - Minutes (0-59)
 */
function floridaDateTimeToUTC(year, month, day, hours, minutes) {
  // Create date object with the components (this creates it in browser's local timezone)
  const dateWithComponents = new Date(year, month - 1, day, hours, minutes, 0, 0);
  
  // fromZonedTime interprets the date's local time components as Florida timezone
  // and converts to UTC
  const utcDate = fromZonedTime(dateWithComponents, FLORIDA_TIMEZONE);
  
  return utcDate.toISOString();
}

/**
 * Format Florida time for display
 */
function formatFloridaTime(date, formatStr) {
  if (!date) return 'N/A';
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : new Date(date);
    return formatInTimeZone(dateObj, FLORIDA_TIMEZONE, formatStr);
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

// AUTHORITATIVE EVENT LIST - SINGLE SOURCE OF TRUTH
// Format: { title, date (YYYY-MM-DD), time (HH:mm), dayOfWeek, endDate?, endTime? }
const AUTHORITATIVE_EVENTS = [
  { title: 'Goth Night', date: '2026-01-02', time: '22:00', dayOfWeek: 'Fri' },
  { title: 'Black Diamond', date: '2026-01-03', time: '20:00', dayOfWeek: 'Sat' },
  { title: 'Karaoke with Sickman', date: '2026-01-07', time: '19:00', dayOfWeek: 'Wed' },
  { title: 'Skin DEEP', date: '2026-01-09', time: '20:00', dayOfWeek: 'Fri', endDate: '2026-01-10', endTime: '20:00' },
  { title: 'Karaoke with Sickman', date: '2026-01-14', time: '19:00', dayOfWeek: 'Wed' },
  { title: 'Groove Slayers', date: '2026-01-16', time: '20:00', dayOfWeek: 'Fri', endDate: '2026-01-17', endTime: '20:00' },
  { title: 'Karaoke with Sickman', date: '2026-01-21', time: '19:00', dayOfWeek: 'Wed' },
  { title: 'Stand-Up Comedy', date: '2026-01-22', time: '19:00', dayOfWeek: 'Thu', altTitles: ['Standup Comedy'] },
  { title: 'Shiela and the Sound', date: '2026-01-23', time: '20:00', dayOfWeek: 'Fri' },
  { title: 'Midnight Mayhem', date: '2026-01-24', time: '20:00', dayOfWeek: 'Sat' },
  { title: 'Knightsnake', date: '2026-01-25', time: '18:00', dayOfWeek: 'Sun' },
  { title: 'Karaoke with Sickman', date: '2026-01-28', time: '19:00', dayOfWeek: 'Wed' },
];

// Helper to normalize titles for matching (case-insensitive, handle variations)
function normalizeTitle(title) {
  if (!title) return '';
  return title.toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')  // Normalize spaces
    .replace(/[-_]/g, ' ')  // Replace hyphens and underscores with spaces
    .replace(/\s+/g, ' ')   // Normalize spaces again
    .trim();
}

async function syncEvents() {
  console.log('='.repeat(80));
  console.log('EVENT DATA SYNCHRONIZATION');
  console.log('AUTHORITATIVE LIST IS THE SINGLE SOURCE OF TRUTH');
  console.log('='.repeat(80));
  console.log('');

  try {
    // Step 1: Fetch ALL events from database
    console.log('Step 1: Fetching all events from database...');
    const { data: dbEvents, error: fetchError } = await supabase
      .from('events')
      .select('*')
      .order('event_start', { ascending: true });

    if (fetchError) {
      console.error('Error fetching events:', fetchError);
      return;
    }

    if (!dbEvents || dbEvents.length === 0) {
      console.log('No events found in database');
      return;
    }

    console.log(`Found ${dbEvents.length} events in database\n`);

    // Step 2: Compare and fix each event
    console.log('Step 2: Comparing against authoritative list...\n');
    
    const updates = [];
    const matchedEvents = new Set();

    for (const authEvent of AUTHORITATIVE_EVENTS) {
      console.log(`\nProcessing: ${authEvent.title}`);
      console.log(`  Authoritative: ${authEvent.date} at ${authEvent.time} (${authEvent.dayOfWeek})`);
      
      // Find matching event in database
      // Strategy: Match by title (case-insensitive) AND date proximity
      const [authYear, authMonth, authDay] = authEvent.date.split('-').map(Number);
      const [authHours, authMinutes] = authEvent.time.split(':').map(Number);
      const authStartUTC = floridaDateTimeToUTC(authYear, authMonth, authDay, authHours, authMinutes);
      const authTitleNormalized = normalizeTitle(authEvent.title);
      const altTitles = (authEvent.altTitles || []).map(t => normalizeTitle(t));
      const allAuthTitles = [authTitleNormalized, ...altTitles];
      
      // Find best match: title match + date within 1 day
      let dbEvent = null;
      let bestMatch = null;
      let bestScore = 0;
      
      for (const e of dbEvents) {
        if (matchedEvents.has(e.id)) continue;
        if (!e.title || !e.event_start) continue;
        
        const dbTitleNormalized = normalizeTitle(e.title);
        const titleMatch = allAuthTitles.includes(dbTitleNormalized);
        
        // Calculate date proximity
        const dbDate = new Date(e.event_start);
        const authDate = new Date(authStartUTC);
        const diffDays = Math.abs((dbDate - authDate) / (1000 * 60 * 60 * 24));
        const dateMatch = diffDays < 1; // Within 1 day
        
        // Score: title match = 10 points, date match = 5 points
        const score = (titleMatch ? 10 : 0) + (dateMatch ? 5 : 0);
        
        if (score > bestScore) {
          bestScore = score;
          bestMatch = e;
        }
        
        // Perfect match: title AND date
        if (titleMatch && dateMatch) {
          dbEvent = e;
          break;
        }
      }
      
      // Use best match if no perfect match found
      if (!dbEvent && bestMatch && bestScore >= 10) {
        dbEvent = bestMatch;
      }

      if (!dbEvent) {
        console.log(`  ❌ NOT FOUND in database - needs to be created or manually matched`);
        console.log(`     Looking for: "${authEvent.title}" on ${authEvent.date} at ${authEvent.time}`);
        continue;
      }

      matchedEvents.add(dbEvent.id);
      console.log(`  Found in DB: "${dbEvent.title}" (ID: ${dbEvent.id})`);

      // Parse authoritative date/time
      const [year, month, day] = authEvent.date.split('-').map(Number);
      const [hours, minutes] = authEvent.time.split(':').map(Number);

      // Calculate correct UTC time
      const correctStartUTC = floridaDateTimeToUTC(year, month, day, hours, minutes);
      const currentStartUTC = dbEvent.event_start;

      // Check if start time matches
      const startMatches = currentStartUTC === correctStartUTC || 
                          (currentStartUTC && correctStartUTC && 
                           new Date(currentStartUTC).getTime() === new Date(correctStartUTC).getTime());

      // Handle end date/time for multi-day events
      let correctEndUTC = null;
      let currentEndUTC = dbEvent.event_end || null;
      let endMatches = true;

      if (authEvent.endDate && authEvent.endTime) {
        const [endYear, endMonth, endDay] = authEvent.endDate.split('-').map(Number);
        const [endHours, endMinutes] = authEvent.endTime.split(':').map(Number);
        correctEndUTC = floridaDateTimeToUTC(endYear, endMonth, endDay, endHours, endMinutes);
        
        endMatches = currentEndUTC === correctEndUTC ||
                    (currentEndUTC && correctEndUTC &&
                     new Date(currentEndUTC).getTime() === new Date(correctEndUTC).getTime());
      } else {
        // Single-day event - should have no end time or end time should be null
        if (currentEndUTC) {
          endMatches = false;
        }
      }

      // Display current state
      console.log(`  Current DB (UTC): ${currentStartUTC}`);
      console.log(`  Current DB (Florida): ${formatFloridaTime(currentStartUTC, 'MM-dd-yyyy h:mm a')}`);
      if (currentEndUTC) {
        console.log(`  Current End (UTC): ${currentEndUTC}`);
        console.log(`  Current End (Florida): ${formatFloridaTime(currentEndUTC, 'MM-dd-yyyy h:mm a')}`);
      }

      // Check if update is needed
      if (!startMatches || !endMatches) {
        console.log(`  ⚠️  MISMATCH DETECTED - needs update`);
        
        const updateData = {
          event_start: correctStartUTC,
        };

        if (authEvent.endDate && authEvent.endTime) {
          updateData.event_end = correctEndUTC;
        } else {
          updateData.event_end = null;
        }

        updates.push({
          id: dbEvent.id,
          title: dbEvent.title,
          updateData,
          currentStart: currentStartUTC,
          correctStart: correctStartUTC,
          currentEnd: currentEndUTC,
          correctEnd: correctEndUTC,
        });

        console.log(`  Correct UTC: ${correctStartUTC}`);
        console.log(`  Correct (Florida): ${formatFloridaTime(correctStartUTC, 'MM-dd-yyyy h:mm a')}`);
        if (correctEndUTC) {
          console.log(`  Correct End UTC: ${correctEndUTC}`);
          console.log(`  Correct End (Florida): ${formatFloridaTime(correctEndUTC, 'MM-dd-yyyy h:mm a')}`);
        }
      } else {
        console.log(`  ✅ Already correct`);
      }
    }

    // Step 3: Handle duplicates and unmatched events
    console.log('\n' + '='.repeat(80));
    console.log('Step 3: Checking for duplicates and unmatched events...');
    console.log('='.repeat(80));
    
    const unmatchedEvents = dbEvents.filter(e => !matchedEvents.has(e.id));
    
    // Check for duplicate events (same title, same or very close date)
    const duplicateEvents = [];
    const eventGroups = new Map();
    
    dbEvents.forEach(event => {
      if (!event.title || !event.event_start) return;
      const key = normalizeTitle(event.title);
      if (!eventGroups.has(key)) {
        eventGroups.set(key, []);
      }
      eventGroups.get(key).push(event);
    });
    
    eventGroups.forEach((events, normalizedTitle) => {
      if (events.length > 1) {
        // Sort by date
        events.sort((a, b) => new Date(a.event_start) - new Date(b.event_start));
        
        // Check if any are duplicates (same date or within 1 day)
        for (let i = 0; i < events.length; i++) {
          for (let j = i + 1; j < events.length; j++) {
            const date1 = new Date(events[i].event_start);
            const date2 = new Date(events[j].event_start);
            const diffDays = Math.abs((date1 - date2) / (1000 * 60 * 60 * 24));
            
            if (diffDays < 1.5) { // Within 1.5 days (to catch same-day duplicates)
              // Check if one is already matched (keep that one)
              const iMatched = matchedEvents.has(events[i].id);
              const jMatched = matchedEvents.has(events[j].id);
              
              if (iMatched && !jMatched) {
                duplicateEvents.push(events[j]);
              } else if (jMatched && !iMatched) {
                duplicateEvents.push(events[i]);
              } else if (!iMatched && !jMatched) {
                // Neither matched - keep the first one
                duplicateEvents.push(events[j]);
              }
            }
          }
        }
      }
    });
    
    if (duplicateEvents.length > 0) {
      console.log(`\nFound ${duplicateEvents.length} duplicate event(s) to remove:`);
      duplicateEvents.forEach(event => {
        console.log(`  - ${event.title} (ID: ${event.id})`);
        console.log(`    Date: ${formatFloridaTime(event.event_start, 'MM-dd-yyyy h:mm a')}`);
      });
    }
    
    if (unmatchedEvents.length > 0) {
      console.log(`\nFound ${unmatchedEvents.length} event(s) not in authoritative list:`);
      unmatchedEvents.forEach(event => {
        console.log(`  - ${event.title} (ID: ${event.id})`);
        console.log(`    Date: ${formatFloridaTime(event.event_start, 'MM-dd-yyyy h:mm a')}`);
      });
      console.log('\n  ⚠️  These events are in the database but not in the authoritative list.');
      console.log('  They will NOT be updated. Review manually if needed.');
    }
    
    if (duplicateEvents.length === 0 && unmatchedEvents.length === 0) {
      console.log('  ✅ No duplicates or unmatched events found');
    }

    // Step 4: Delete duplicates
    if (duplicateEvents.length > 0) {
      console.log('\n' + '='.repeat(80));
      console.log(`Step 4a: Deleting ${duplicateEvents.length} duplicate event(s)...`);
      console.log('='.repeat(80));
      
      for (const dupEvent of duplicateEvents) {
        console.log(`\nDeleting duplicate: ${dupEvent.title} (ID: ${dupEvent.id})`);
        
        const { error: deleteError } = await supabase
          .from('events')
          .delete()
          .eq('id', dupEvent.id);
        
        if (deleteError) {
          console.error(`  ❌ Error: ${deleteError.message}`);
        } else {
          console.log(`  ✅ Deleted successfully`);
        }
      }
    }
    
    // Step 4b: Apply updates
    console.log('\n' + '='.repeat(80));
    console.log(`Step 4b: Applying ${updates.length} update(s)...`);
    console.log('='.repeat(80));

    if (updates.length === 0) {
      console.log('✅ No updates needed - all events are correct!');
    } else {
      for (const update of updates) {
        console.log(`\nUpdating: ${update.title} (ID: ${update.id})`);
        
        const { error: updateError } = await supabase
          .from('events')
          .update(update.updateData)
          .eq('id', update.id);

        if (updateError) {
          console.error(`  ❌ Error: ${updateError.message}`);
        } else {
          console.log(`  ✅ Updated successfully`);
        }
      }
    }

    // Step 5: Final verification
    console.log('\n' + '='.repeat(80));
    console.log('Step 5: Final Verification - Re-fetching events...');
    console.log('='.repeat(80));

    const { data: verifyEvents, error: verifyError } = await supabase
      .from('events')
      .select('*')
      .order('event_start', { ascending: true });

    if (verifyError) {
      console.error('Error during verification:', verifyError);
      return;
    }

    console.log('\nFinal Event List (Florida Time):');
    console.log('-'.repeat(80));
    
    verifyEvents.forEach(event => {
      if (!event.event_start) return;
      
      const floridaDate = formatFloridaTime(event.event_start, 'MM-dd-yyyy');
      const floridaTime = formatFloridaTime(event.event_start, 'h:mm a');
      const dayOfWeek = formatFloridaTime(event.event_start, 'EEE');
      
      let display = `${floridaDate} (${dayOfWeek}), ${floridaTime} — ${event.title}`;
      
      if (event.event_end) {
        const endDate = formatFloridaTime(event.event_end, 'MM-dd-yyyy');
        const endTime = formatFloridaTime(event.event_end, 'h:mm a');
        if (endDate !== floridaDate) {
          display = `${floridaDate} (${dayOfWeek}) - ${endDate}, ${floridaTime} — ${event.title}`;
        }
      }
      
      console.log(display);
    });

    console.log('\n' + '='.repeat(80));
    console.log('✅ SYNCHRONIZATION COMPLETE');
    console.log('='.repeat(80));
    console.log('\nNext steps:');
    console.log('1. Verify events display correctly on website');
    console.log('2. Verify events display correctly in admin panel');
    console.log('3. Check that all dates/times match the authoritative list');

  } catch (error) {
    console.error('Fatal error:', error);
  }
}

syncEvents()
  .then(() => {
    console.log('');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

