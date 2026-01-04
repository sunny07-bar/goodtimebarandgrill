/**
 * Test Slot Generation with Midnight Close Time
 * 
 * This script tests if slots are generated correctly when close time is 00:00:00 (midnight)
 */

// Simulate the slot generation logic
function generateSlots(openTime, closeTime) {
  const [openHour, openMin] = openTime.split(':').map(Number)
  const [closeHour, closeMin] = closeTime.split(':').map(Number)
  
  console.log(`Generating slots from ${openHour}:${openMin} to ${closeHour}:${closeMin}`)
  
  // Handle midnight close time (00:00:00 means end of day, so treat as 24:00)
  let effectiveCloseHour = closeHour
  let effectiveCloseMin = closeMin
  if (closeHour === 0 && closeMin === 0) {
    effectiveCloseHour = 24
    effectiveCloseMin = 0
    console.log('Midnight close time detected, treating as 24:00')
  }
  
  let regularSlots = []
  let currentHour = openHour
  let currentMin = openMin
  let iterations = 0
  const maxIterations = 200
  
  while (iterations < maxIterations) {
    // Check if we've reached or passed the close time
    if (currentHour > effectiveCloseHour || (currentHour === effectiveCloseHour && currentMin >= effectiveCloseMin)) {
      break
    }
    
    // Don't add slots at or after midnight (24:00) - those are end of day
    if (currentHour < 24) {
      regularSlots.push(`${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`)
    }
    
    currentMin += 30
    if (currentMin >= 60) {
      currentMin = 0
      currentHour++
    }
    
    iterations++
  }
  
  if (iterations >= maxIterations) {
    console.warn('Reached max iterations, stopping slot generation')
  }
  
  return regularSlots
}

console.log('='.repeat(80))
console.log('TESTING SLOT GENERATION WITH MIDNIGHT CLOSE TIME')
console.log('='.repeat(80))
console.log()

// Test 1: Normal hours (11:00 to 22:00)
console.log('TEST 1: Normal hours (11:00 to 22:00)')
console.log('-'.repeat(80))
const slots1 = generateSlots('11:00', '22:00')
console.log(`Generated ${slots1.length} slots`)
console.log(`First 5: ${slots1.slice(0, 5).join(', ')}`)
console.log(`Last 5: ${slots1.slice(-5).join(', ')}`)
console.log()

// Test 2: Midnight close time (11:00 to 00:00)
console.log('TEST 2: Midnight close time (11:00 to 00:00) - THIS IS THE ISSUE')
console.log('-'.repeat(80))
const slots2 = generateSlots('11:00', '00:00')
console.log(`Generated ${slots2.length} slots`)
if (slots2.length > 0) {
  console.log(`First 5: ${slots2.slice(0, 5).join(', ')}`)
  console.log(`Last 5: ${slots2.slice(-5).join(', ')}`)
} else {
  console.log('❌ NO SLOTS GENERATED - THIS IS THE PROBLEM!')
}
console.log()

// Test 3: Late night hours (18:00 to 00:00)
console.log('TEST 3: Late night hours (18:00 to 00:00)')
console.log('-'.repeat(80))
const slots3 = generateSlots('18:00', '00:00')
console.log(`Generated ${slots3.length} slots`)
if (slots3.length > 0) {
  console.log(`First 5: ${slots3.slice(0, 5).join(', ')}`)
  console.log(`Last 5: ${slots3.slice(-5).join(', ')}`)
} else {
  console.log('❌ NO SLOTS GENERATED - THIS IS THE PROBLEM!')
}
console.log()

console.log('='.repeat(80))
console.log('SUMMARY')
console.log('='.repeat(80))
if (slots2.length === 0) {
  console.log('❌ ISSUE FOUND: Midnight close time (00:00) is not generating slots')
  console.log('   Expected: Slots from 11:00 to 23:30 (every 30 minutes)')
  console.log('   Actual: 0 slots')
} else {
  console.log('✓ Slot generation with midnight close time is working')
}
console.log('='.repeat(80))

