# Troubleshooting: No Time Slots Showing

## Issue: No available time slots on January 2nd (or any date)

### Possible Causes:

1. **Date is in the past**
   - Check: Open browser console and look for `[ReservationsPage] Loading hours for date:`
   - Fix: Ensure you're selecting a future date (not today if it's already late in the day)

2. **Restaurant is closed on that day**
   - Check: Look for `[getAvailableTimeSlots] Regular hours: closed` in console
   - Fix: Set opening hours for that day of week in admin panel

3. **Midnight close time (00:00:00) not handled**
   - Status: ✅ FIXED - Midnight close time now treated as 24:00
   - Check: Look for `[getAvailableTimeSlots] Midnight close time detected, treating as 24:00` in console

4. **Event blocking all slots**
   - Check: Look for `[getAvailableTimeSlots] Events found:` in console
   - Check: Look for `[getAvailableTimeSlots] Filtered out X slots due to event conflicts`
   - Fix: Only events with paid tickets (> $0) should block. Events with free tickets ($0) should NOT block.

5. **All slots filtered as past (if selecting today)**
   - Check: Look for `[ReservationsPage] Available slots count:` in console
   - If count is 0 and date is today, check if all slots are in the past

### Debug Steps:

1. **Open browser console** (F12 or Cmd+Option+I)
2. **Select the date** (January 2nd)
3. **Look for these log messages:**
   ```
   [ReservationsPage] Loading hours for date: 2026-01-02
   [getAvailableTimeSlots] Fetching slots for date: 2026-01-02
   [getAvailableTimeSlots] Regular hours for weekday X: {...}
   [getAvailableTimeSlots] Generated X regular slots
   [getAvailableTimeSlots] Events found: X
   [getAvailableTimeSlots] Filtered out X slots due to event conflicts
   [ReservationsPage] Available slots count: X
   ```

4. **Run diagnostic script:**
   ```bash
   cd website
   node scripts/debug-jan2-slots.js
   ```

### Expected Behavior:

- **Restaurant open 11:00 AM to 12:00 AM (midnight)**
- **Event at 10:00 PM with paid tickets**
- **Expected slots:**
  - Available: 11:00 AM to 7:30 PM (18 slots)
  - Blocked: 8:00 PM to 11:30 PM (8 slots) - 2-hour buffer before/after event

### Quick Fixes:

1. **If date validation fails:**
   - Check `getFloridaToday()` returns correct date
   - Ensure date string format is `YYYY-MM-DD`

2. **If no slots generated:**
   - Check opening hours are set for that day
   - Check close time is not `null` or invalid
   - Verify midnight (00:00:00) is handled as 24:00

3. **If all slots blocked by event:**
   - Verify event has paid tickets (price > $0)
   - Check event times are correct
   - Verify buffer calculation (should only block 2 hours before/after)

### Test Scripts:

```bash
# Test slot generation logic
node scripts/test-slot-generation.js

# Test event blocking logic
node scripts/test-event-blocking.js

# Debug specific date
node scripts/debug-jan2-slots.js

# Test with database
node scripts/test-reservation-db.js
```

