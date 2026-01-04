# Reservation and Event Logic Test Scripts

These scripts help test and verify the reservation and event blocking logic.

## Scripts

### 1. `test-reservation-logic.js`
**Purpose**: Tests the core logic without database connection

**Run**: 
```bash
node scripts/test-reservation-logic.js
```

**Tests**:
- ✅ Events with paid tickets (> $0) should block reservations
- ✅ Events with free tickets ($0) should NOT block reservations
- ✅ Events with no tickets should NOT block reservations
- ✅ Events with base_ticket_price > 0 should block reservations
- ✅ Reservations outside 2-hour buffer should NOT be blocked
- ✅ Reservations within 2-hour buffer should be blocked
- ✅ Multiple events - only paid ones should block
- ✅ Timezone conversions (Florida = America/New_York)

### 2. `test-reservation-db.js`
**Purpose**: Tests with real database data

**Requirements**: 
- `.env.local` file with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Run**: 
```bash
node scripts/test-reservation-db.js
```

**Tests**:
- Fetches actual events from database
- Checks paid ticket logic with real data
- Tests reservation conflict detection
- Validates timezone conversions

## Key Logic Rules

1. **Only events with paid tickets block reservations**
   - Event must have `event_tickets` with at least one ticket price > $0
   - OR event must have `base_ticket_price` > $0
   - Events with all $0 tickets do NOT block
   - Events with no tickets do NOT block

2. **2-hour buffer before and after events**
   - Reservations are blocked 2 hours before event start
   - Reservations are blocked 2 hours after event end
   - Reservations outside this window are allowed

3. **Timezone handling**
   - All times are in Florida timezone (America/New_York)
   - Dates stored in database as UTC
   - Displayed in MM-DD-YYYY format
   - Times displayed in h:mm a format (12-hour with AM/PM)

## Troubleshooting

If tests fail, check:

1. **Event blocking when it shouldn't**:
   - Verify event has paid tickets (check `event_tickets` table)
   - Check `base_ticket_price` is not set or is 0
   - Ensure `hasPaidTickets()` function is working correctly

2. **Reservation not blocked when it should**:
   - Verify event has paid tickets
   - Check reservation time is within 2-hour buffer
   - Verify timezone conversions are correct

3. **Timezone issues**:
   - Ensure all dates use `America/New_York` timezone
   - Check UTC conversions are correct
   - Verify date displays use `formatFloridaTime()`

## Running Tests

```bash
# Test core logic (no database needed)
cd website
node scripts/test-reservation-logic.js

# Test with database (requires .env.local)
node scripts/test-reservation-db.js
```

