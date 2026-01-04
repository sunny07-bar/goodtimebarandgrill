import { format, parseISO } from 'date-fns'
import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz'

// Florida timezone (America/New_York covers Florida's Eastern Time)
export const FLORIDA_TIMEZONE = 'America/New_York'

/**
 * Convert a date to Florida timezone
 */
export function toFloridaTime(date: Date | string): Date {
  const dateObj = typeof date === 'string' ? parseISO(date) : date
  return toZonedTime(dateObj, FLORIDA_TIMEZONE)
}

/**
 * Format a date in Florida timezone
 */
export function formatFloridaTime(
  date: Date | string,
  formatStr: string
): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date
  return formatInTimeZone(dateObj, FLORIDA_TIMEZONE, formatStr)
}

/**
 * Get current date/time in Florida timezone
 */
export function getFloridaNow(): Date {
  return toZonedTime(new Date(), FLORIDA_TIMEZONE)
}

/**
 * Get today's date in YYYY-MM-DD format in Florida timezone
 */
export function getFloridaToday(): string {
  const floridaNow = getFloridaNow()
  return format(floridaNow, 'yyyy-MM-dd')
}

/**
 * Get the day of the week (0 = Sunday, 6 = Saturday) for a date string in Florida timezone
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns Day of week (0-6) in Florida timezone
 */
export function getDayOfWeekInFlorida(dateString: string): number {
  // Parse the date string
  const [year, month, day] = dateString.split('-').map(Number)
  
  // Create a UTC date for this calendar date at noon (to avoid timezone edge cases)
  // Then convert to Florida timezone to get the correct day of week
  const utcDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
  const floridaDate = toZonedTime(utcDate, FLORIDA_TIMEZONE)
  return floridaDate.getDay()
}

/**
 * Convert a Florida timezone date to UTC for database storage
 */
export function floridaToUTC(date: Date): Date {
  return fromZonedTime(date, FLORIDA_TIMEZONE)
}

/**
 * Format a DATE type (YYYY-MM-DD) directly without timezone conversion
 * PostgreSQL DATE types don't have time, so we shouldn't apply timezone conversion
 * @param dateString - Date string in YYYY-MM-DD format (PostgreSQL DATE type)
 * @returns Formatted date string (MM-DD-YYYY)
 */
export function formatDateOnlyMMDDYYYY(dateString: string): string {
  if (!dateString) return ''
  
  // Extract YYYY-MM-DD part (in case there's any time component)
  const datePart = dateString.split('T')[0].split(' ')[0]
  
  // Parse directly without timezone conversion
  const [year, month, day] = datePart.split('-').map(Number)
  
  // Validate
  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    return dateString
  }
  
  // Format as MM-DD-YYYY
  return `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}-${year}`
}

/**
 * Format date in MM-DD-YYYY format (Florida timezone)
 * Use this for datetime values that need timezone conversion
 * For DATE-only types (no time), use formatDateOnlyMMDDYYYY instead
 * @param date - Date object or ISO string
 * @returns Formatted date string (MM-DD-YYYY)
 */
export function formatFloridaDateDDMMYYYY(date: Date | string): string {
  // If it's a simple YYYY-MM-DD string (DATE type), format directly without timezone conversion
  // Check if it's EXACTLY YYYY-MM-DD format (no time component, no timezone)
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date.trim()) && !date.includes('T') && !date.includes(' ')) {
    return formatDateOnlyMMDDYYYY(date)
  }
  
  // For datetime values (TIMESTAMP WITH TIME ZONE), convert to Florida timezone first
  // then extract the date. This ensures the date shown matches what users see in Florida timezone.
  const dateObj = typeof date === 'string' ? parseISO(date) : date
  
  // Ensure we have a valid date
  if (isNaN(dateObj.getTime())) {
    console.error('Invalid date in formatFloridaDateDDMMYYYY:', date)
    return ''
  }
  
  // Use formatInTimeZone for more reliable timezone formatting
  // This ensures that an event at "8 PM on Jan 3" shows as "Jan 3", not "Jan 4"
  const floridaDateString = formatInTimeZone(dateObj, FLORIDA_TIMEZONE, 'yyyy-MM-dd')
  const [year, month, day] = floridaDateString.split('-').map(Number)
  
  // Validate parsed values
  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    console.error('Failed to parse date components:', { year, month, day, floridaDateString, originalDate: date })
    return ''
  }
  
  // Format as MM-dd-yyyy
  return `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}-${year}`
}

/**
 * Format date in MM-DD-YYYY format (Florida timezone) - alias for consistency
 * @param date - Date object or ISO string
 * @returns Formatted date string (MM-DD-YYYY)
 */
export function formatFloridaDateMMDDYYYY(date: Date | string): string {
  return formatFloridaDateDDMMYYYY(date)
}

/**
 * Convert 24-hour time format (HH:mm) to 12-hour format with AM/PM
 * @param time24 - Time in 24-hour format (e.g., "16:00", "09:30")
 * @returns Time in 12-hour format (e.g., "4:00 PM", "9:30 AM")
 */
export function convert24To12(time24: string): string {
  if (!time24 || !time24.includes(':')) {
    return time24 || ''
  }

  const [hours, minutes] = time24.split(':').map(Number)
  if (isNaN(hours) || isNaN(minutes)) {
    return time24
  }

  const period = hours >= 12 ? 'PM' : 'AM'
  const hours12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours

  return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`
}

/**
 * Convert datetime-local input (interpreted as Florida time) to UTC ISO string
 * datetime-local inputs are timezone-agnostic, so we interpret them as Florida time
 * @param datetimeLocal - Date string in YYYY-MM-DDTHH:mm format (from datetime-local input)
 * @returns UTC ISO string for database storage
 */
export function floridaDateTimeLocalToUTC(datetimeLocal: string): string {
  if (!datetimeLocal) return ''
  const [datePart, timePart] = datetimeLocal.split('T')
  const [year, month, day] = datePart.split('-').map(Number)
  const [hours, minutes] = (timePart || '00:00').split(':').map(Number)
  
  // Create a Date object with these components
  // Note: new Date(year, month, day, hours, minutes) creates a date in the browser's LOCAL timezone
  // fromZonedTime will interpret the date's local time components (getFullYear, getMonth, getDate, getHours, etc.)
  // as if they represent a time in the specified timezone (Florida), then returns the UTC equivalent
  // 
  // This works correctly because fromZonedTime reads the local components (which match our input)
  // and interprets them as Florida timezone, regardless of what timezone the Date object was created in.
  const dateWithComponents = new Date(year, month - 1, day, hours, minutes, 0, 0)
  
  // fromZonedTime interprets the date's local time components as Florida timezone and converts to UTC
  const utcDate = fromZonedTime(dateWithComponents, FLORIDA_TIMEZONE)
  return utcDate.toISOString()
}

/**
 * Convert UTC ISO string to datetime-local format for Florida timezone
 * @param utcISOString - UTC ISO string from database
 * @returns Date string in YYYY-MM-DDTHH:mm format (for datetime-local input)
 */
export function utcToFloridaDateTimeLocal(utcISOString: string): string {
  if (!utcISOString) return ''
  try {
    const utcDate = parseISO(utcISOString)
    
    // Ensure we have a valid date
    if (isNaN(utcDate.getTime())) {
      console.error('Invalid date in utcToFloridaDateTimeLocal:', utcISOString)
      return ''
    }
    
    // Use formatInTimeZone for more reliable timezone formatting
    // This ensures consistent conversion to Florida timezone
    const datePart = formatInTimeZone(utcDate, FLORIDA_TIMEZONE, 'yyyy-MM-dd')
    const timePart = formatInTimeZone(utcDate, FLORIDA_TIMEZONE, 'HH:mm')
    
    return `${datePart}T${timePart}`
  } catch (error) {
    console.error('Error converting UTC to Florida datetime-local:', error)
    return ''
  }
}

/**
 * Check if an event is still active (hasn't ended yet)
 * - If event has event_end: event is visible until event_end time
 * - If no event_end: event is visible for the whole day of event_start
 * - Event should not appear if it has already ended
 */
export function isEventActive(event: { event_start: string | Date; event_end?: string | Date | null }): boolean {
  try {
    const now = getFloridaNow()
    
    if (!event.event_start) {
      return false
    }
    
    const eventStart = typeof event.event_start === 'string' 
      ? toFloridaTime(parseISO(event.event_start))
      : toFloridaTime(event.event_start)
    
    if (isNaN(eventStart.getTime())) {
      return false
    }
    
    // If event has an end date/time, check if it has ended
    if (event.event_end) {
      const eventEnd = typeof event.event_end === 'string'
        ? toFloridaTime(parseISO(event.event_end))
        : toFloridaTime(event.event_end)
      
      if (!isNaN(eventEnd.getTime())) {
        // Event is active if current time is before the end time
        return now < eventEnd
      }
    }
    
    // If no end time, event is visible for the whole day of the start date
    // Set to end of the event start day (23:59:59.999)
    const eventStartDayEnd = new Date(eventStart)
    eventStartDayEnd.setHours(23, 59, 59, 999)
    
    // Event is active if current time is before the end of the start day
    return now <= eventStartDayEnd
  } catch (error) {
    console.error('Error checking if event is active:', error, event)
    return false
  }
}

