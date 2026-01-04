'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Calendar, Clock, Users, CheckCircle, AlertCircle, Sparkles, Info, MapPin } from 'lucide-react'
import { getSpecialHoursForDate, getAvailableTimeSlots, getOpeningHours, getEventsForDate, isTimeSlotRequiringPrepayment, getAllSiteSettings, filterCustomTicketEvents } from '@/lib/queries'
import AnimatedSection from '@/components/AnimatedSection'
import { getFloridaToday, convert24To12, getDayOfWeekInFlorida, formatFloridaTime, toFloridaTime } from '@/lib/utils/timezone'
import { parseISO } from 'date-fns'
import EmailVerification from '@/components/EmailVerification'

function ReservationsPageContent() {
  const searchParams = useSearchParams()
  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    guestsCount: 2,
    reservationDate: '',
    reservationTime: '',
    area: '',
    notes: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [availableSlots, setAvailableSlots] = useState<string[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [specialHoursInfo, setSpecialHoursInfo] = useState<any>(null)
  const [regularHours, setRegularHours] = useState<any>(null)
  const [customFields, setCustomFields] = useState<Record<string, string>>({})
  const [availabilityError, setAvailabilityError] = useState<string | null>(null)
  const [eventsOnDate, setEventsOnDate] = useState<any[]>([])
  const [successReservationData, setSuccessReservationData] = useState<any>(null)
  const [showEmailVerification, setShowEmailVerification] = useState(false)
  const [emailVerified, setEmailVerified] = useState(false)
  const [contactPhone, setContactPhone] = useState('')

  // Get today's date in YYYY-MM-DD format (Florida timezone)
  const today = getFloridaToday()

  // Autofill from query params (when coming from event)
  useEffect(() => {
    const eventDate = searchParams.get('eventDate')
    const eventTime = searchParams.get('eventTime')
    
    if (eventDate && eventTime) {
      // Convert 24-hour time to HH:mm format if needed
      let timeValue = eventTime
      if (timeValue.includes(':')) {
        const [hours, minutes] = timeValue.split(':')
        timeValue = `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`
      }
      
      setFormData(prev => ({
        ...prev,
        reservationDate: eventDate,
        reservationTime: timeValue,
      }))
    }
  }, [searchParams])

  // Fetch contact phone from database
  useEffect(() => {
    const fetchContactInfo = async () => {
      try {
        const settings = await getAllSiteSettings()
        setContactPhone(settings.restaurant_phone || settings.phone || '')
      } catch (error) {
        console.error('Error fetching contact info:', error)
      }
    }
    fetchContactInfo()
  }, [])

  // Helper function to check if a time is within special hours range
  const isTimeWithinSpecialHours = (time: string, specialHours: any): boolean => {
    if (!specialHours || !specialHours.time_from || !specialHours.time_to || !time) {
      return false
    }

    // Parse time strings (HH:MM format)
    const parseTime = (timeStr: string) => {
      const parts = timeStr.split(':')
      return {
        hour: parseInt(parts[0]) || 0,
        minute: parseInt(parts[1]) || 0
      }
    }

    const selectedTime = parseTime(time)
    const startTime = parseTime(specialHours.time_from)
    const endTime = parseTime(specialHours.time_to)

    // Convert times to minutes for easier comparison
    const selectedMinutes = selectedTime.hour * 60 + selectedTime.minute
    const startMinutes = startTime.hour * 60 + startTime.minute
    const endMinutes = endTime.hour * 60 + endTime.minute

    // Check if selected time is within range (inclusive)
    return selectedMinutes >= startMinutes && selectedMinutes <= endMinutes
  }


  // Load special hours and available slots when date or guest count changes
  useEffect(() => {
    if (formData.reservationDate) {
      loadHoursAndSlots()
    }
  }, [formData.reservationDate, formData.guestsCount])


  const loadHoursAndSlots = async () => {
    if (!formData.reservationDate) return

    // Validate that the selected date is not in the past
    if (formData.reservationDate < today) {
      setAvailabilityError('This date has passed. Please select a future date.')
      setAvailableSlots([])
      setEventsOnDate([])
      setSpecialHoursInfo(null)
      setRegularHours(null)
      return
    }

    setLoadingSlots(true)
    setAvailabilityError(null)
    
    try {
      console.log('[ReservationsPage] Loading hours for date:', formData.reservationDate)
      
      // Check for events on this date - only show custom ticket events (own ticket events) to users
      // Events with action_button_type === 'reservation' or 'external_tickets' are not shown
      const events = await getEventsForDate(formData.reservationDate)
      const customTicketEvents = filterCustomTicketEvents(events)
      setEventsOnDate(customTicketEvents)
      console.log('[ReservationsPage] Events found:', events.length, 'Custom ticket events:', customTicketEvents.length)
      
      // Always get regular hours for the date (needed for slot generation)
      const openingHours = await getOpeningHours()
      // Use Florida timezone to determine day of week
      const dayOfWeek = getDayOfWeekInFlorida(formData.reservationDate)
      const hours = openingHours.find(h => h.weekday === dayOfWeek)
      console.log('[ReservationsPage] Regular hours for weekday', dayOfWeek, ':', hours)
      setRegularHours(hours)
      
      // Check for special hours
      const specialHours = await getSpecialHoursForDate(formData.reservationDate)
      console.log('[ReservationsPage] Special hours:', specialHours)
      
      if (specialHours) {
        // Special hours exist for this date
        setSpecialHoursInfo(specialHours)
        console.log('[ReservationsPage] Special hours is_open:', specialHours.is_open)
        
        // Load custom fields if special hours exist
        if (specialHours.special_hours_fields && specialHours.special_hours_fields.length > 0) {
          const fields: Record<string, string> = {}
          specialHours.special_hours_fields.forEach((field: any) => {
            fields[field.field_key] = ''
          })
          setCustomFields(fields)
        }
        // Keep regularHours set - we want to show both regular and special hours slots
      } else {
        // No special hours
        setSpecialHoursInfo(null)
        setCustomFields({})
      }

      // Get available time slots
      const slots = await getAvailableTimeSlots(formData.reservationDate, formData.guestsCount)
      console.log('[ReservationsPage] Available slots count:', slots.length)
      console.log('[ReservationsPage] First 5 slots:', slots.slice(0, 5))
      
      // Filter out past time slots if the selected date is today (using Florida timezone)
      const { getFloridaNow, toFloridaTime, FLORIDA_TIMEZONE } = require('@/lib/utils/timezone')
      const { fromZonedTime } = require('date-fns-tz')
      const filteredSlots = slots.filter(slot => {
        if (formData.reservationDate === today) {
          // If today, filter out past times using Florida timezone
          const floridaNow = getFloridaNow()
          const [hour, minute] = slot.split(':').map(Number)
          const [year, month, day] = formData.reservationDate.split('-').map(Number)
          // Create date with those components, then interpret as Florida timezone
          const slotTimeLocal = new Date(year, month - 1, day, hour, minute, 0)
          const slotTimeUTC = fromZonedTime(slotTimeLocal, FLORIDA_TIMEZONE)
          const slotTimeFlorida = toFloridaTime(slotTimeUTC)
          
          // Compare times (both in Florida timezone)
          return slotTimeFlorida >= floridaNow
        }
        // For future dates, all slots are valid
        return true
      })
      
      setAvailableSlots(filteredSlots)
      
      // Debug: Log what we have
      if (specialHours) {
        console.log('[ReservationsPage] Special hours details:', {
          title: specialHours.title,
          is_open: specialHours.is_open,
          time_from: specialHours.time_from,
          time_to: specialHours.time_to,
          has_seatings: !!specialHours.special_hours_seatings?.[0],
          seatings_interval: specialHours.special_hours_seatings?.[0]?.interval_minutes
        })
      }

      // If a time was selected, check if it's still available
      if (formData.reservationTime && !slots.includes(formData.reservationTime)) {
        setAvailabilityError('This time slot is no longer available')
        setFormData({ ...formData, reservationTime: '' })
      }
    } catch (error) {
      console.error('[ReservationsPage] Error loading slots:', error)
      setAvailabilityError('Failed to load available times. Please try again.')
    } finally {
      setLoadingSlots(false)
    }
  }

  // Check if email verification is needed (for pre-paid reservations)
  const requiresEmailVerification = () => {
    if (!formData.reservationTime || !formData.customerEmail || !formData.reservationDate) {
      return false
    }
    
    // Check if there's an event with reservation_price for this date/time
    const hasEventReservationPrice = eventsOnDate.some(event => {
      if (event.reservation_price && event.reservation_price > 0) {
        // Parse event start time
        const eventStart = typeof event.event_start === 'string' ? parseISO(event.event_start) : new Date(event.event_start)
        const eventStartFlorida = toFloridaTime(eventStart)
        const eventDateFlorida = eventStartFlorida.toISOString().split('T')[0]
        const eventTimeFlorida = `${String(eventStartFlorida.getHours()).padStart(2, '0')}:${String(eventStartFlorida.getMinutes()).padStart(2, '0')}`
        
        // Check if reservation is for the same date and time (or within 30 minutes)
        if (eventDateFlorida === formData.reservationDate) {
          const [resHour, resMin] = formData.reservationTime.split(':').map(Number)
          const [eventHour, eventMin] = eventTimeFlorida.split(':').map(Number)
          
          const resMinutes = resHour * 60 + resMin
          const eventMinutes = eventHour * 60 + eventMin
          
          // If reservation time is within 30 minutes of event start, require email verification
          if (Math.abs(resMinutes - eventMinutes) <= 30) {
            return true
          }
        }
      }
      return false
    })
    
    // Check special hours prepayment
    const requiresSpecialHoursPrepayment = specialHoursInfo && isTimeSlotRequiringPrepayment(formData.reservationTime, specialHoursInfo)
    
    return hasEventReservationPrice || requiresSpecialHoursPrepayment
  }

  // Check if email is already verified (from database or localStorage)
  useEffect(() => {
    const checkEmailVerification = async () => {
      if (!formData.customerEmail) {
        setEmailVerified(false)
        return
      }

      // First check database
      try {
        const response = await fetch('/api/email/check-verified', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: formData.customerEmail }),
        })

        const data = await response.json()
        if (data.verified) {
          setEmailVerified(true)
          // Also store in localStorage for faster subsequent checks
          if (typeof window !== 'undefined') {
            const verificationKey = `email_verified_${formData.customerEmail.toLowerCase()}`
            localStorage.setItem(verificationKey, Date.now().toString())
          }
          return
        }
      } catch (err) {
        console.error('Error checking email verification:', err)
      }

      // Fallback to localStorage check
      if (typeof window !== 'undefined') {
        const verificationKey = `email_verified_${formData.customerEmail.toLowerCase()}`
        const storedVerification = localStorage.getItem(verificationKey)
        if (storedVerification) {
          const verificationTime = parseInt(storedVerification)
          // Check if verification is still valid (1 hour for localStorage)
          if (Date.now() - verificationTime < 60 * 60 * 1000) {
            setEmailVerified(true)
            return
          } else {
            // Expired, remove it
            localStorage.removeItem(verificationKey)
          }
        }
      }

      setEmailVerified(false)
    }

    checkEmailVerification()
  }, [formData.customerEmail, formData.reservationTime, formData.reservationDate, specialHoursInfo, eventsOnDate])

  const handleEmailVerified = () => {
    setEmailVerified(true)
    setShowEmailVerification(false)
    // Store verification status in localStorage for faster subsequent checks
    // Database already stores it for 30 days
    if (typeof window !== 'undefined' && formData.customerEmail) {
      const verificationKey = `email_verified_${formData.customerEmail.toLowerCase()}`
      localStorage.setItem(verificationKey, Date.now().toString())
    }
    // Proceed with submission after verification
    proceedWithSubmission()
  }

  const proceedWithSubmission = async () => {
    setIsSubmitting(true)
    setSubmitStatus('idle')
    setAvailabilityError(null)

    try {
      // Note: The API will determine if prepayment is required based on the selected time slot
      // (special hours + 1 hour buffer). We just pass the form data.
      const payload: any = {
        ...formData,
        customFields: Object.keys(customFields).length > 0 ? customFields : null,
      }

      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        const data = await response.json()
        
        // If prepayment is required, redirect to payment page
        if (data.prepaymentRequired && data.paymentUrl) {
          window.location.href = data.paymentUrl
          return
        }
        
        // Store reservation data for success display
        setSuccessReservationData({
          ...formData,
          reservationId: data.reservation?.id,
          prepaymentRequired: data.prepaymentRequired,
          prepaymentAmount: data.prepaymentAmount,
        })
        setSubmitStatus('success')
        setFormData({
          customerName: '',
          customerPhone: '',
          customerEmail: '',
          guestsCount: 2,
          reservationDate: '',
          reservationTime: '',
          area: '',
          notes: '',
        })
        setCustomFields({})
        setSpecialHoursInfo(null)
        setRegularHours(null)
        setAvailableSlots([])
        setEventsOnDate([])
      } else {
        const errorData = await response.json()
        setAvailabilityError(errorData.error || 'Failed to create reservation')
        setSubmitStatus('error')
        
        // If it's an event conflict, reload events to show updated info
        if (errorData.eventConflict && errorData.event) {
          const events = await getEventsForDate(formData.reservationDate)
          const customTicketEvents = filterCustomTicketEvents(events)
          setEventsOnDate(customTicketEvents)
        }
      }
    } catch (error) {
      setSubmitStatus('error')
      setAvailabilityError('An error occurred. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Check if email verification is required for pre-paid reservations
    if (requiresEmailVerification() && !emailVerified) {
      // Show email verification step
      setShowEmailVerification(true)
      setAvailabilityError(null)
      return
    }

    // Email is verified or not required, proceed with submission
    proceedWithSubmission()
  }

  const formatTime = (time: string) => {
    if (!time) return ''
    // Use convert24To12 to match event time formatting (h:mm a format)
    // Times are stored as time-of-day strings in Florida timezone
    return convert24To12(time)
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 py-12 md:py-16">
      <AnimatedSection direction="down">
        <div className="text-center mb-14 md:mb-18">
          <div className="inline-block px-4 py-1.5 bg-amber-500/10 border border-amber-500/25 rounded-full mb-5 md:mb-6">
            <span className="text-xs md:text-sm font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-2 justify-center">
              <Calendar className="h-3.5 w-3.5 md:h-4 md:w-4" />
              Reservations
            </span>
          </div>
          <h1 className="text-display-1 font-extrabold heading-gradient-neon mb-5 md:mb-6 leading-tight display-heading">
            MAKE A RESERVATION
          </h1>
          <div className="w-20 md:w-28 h-0.5 md:h-1 bg-gradient-to-r from-amber-500 via-red-500 to-amber-500 mx-auto rounded-full mb-6 md:mb-7"></div>
          <p className="text-body-large bar-text-light max-w-3xl mx-auto">
            Book your table in advance and ensure a great dining experience.
          </p>
        </div>
      </AnimatedSection>

      <div className="max-w-4xl mx-auto">
        <AnimatedSection direction="up">
          <Card className="bar-card-premium shadow-2xl">
            <CardContent className="p-6 md:p-8 lg:p-10">
              {/* Special Hours Banner */}
              {specialHoursInfo && (
                <div className="mb-7 md:mb-8 p-5 md:p-6 bg-gradient-to-r from-amber-500/10 via-red-500/10 to-amber-500/10 rounded-xl border border-amber-500/25 shadow-lg">
                  <div className="flex items-start gap-4">
                    <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-lg p-2.5 shadow-lg">
                      <Sparkles className="h-5 w-5 md:h-6 md:w-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2.5">
                        <h3 className="text-display-3 font-bold text-amber-400 display-heading">{specialHoursInfo.title}</h3>
                        <span className="px-2.5 py-1 bg-amber-500/20 rounded-full text-xs font-semibold text-amber-400">
                          Special Hours
                        </span>
                      </div>
                      {specialHoursInfo.time_from && specialHoursInfo.time_to && (
                        <p className="text-body bar-text-light mb-2 flex items-center gap-2">
                          <Clock className="h-4 w-4 md:h-5 md:w-5 text-amber-400" />
                          <span className="font-semibold">
                            {formatTime(specialHoursInfo.time_from)} - {formatTime(specialHoursInfo.time_to)}
                          </span>
                          <span className="text-xs text-amber-400/80">(Florida Time)</span>
                        </p>
                      )}
                      {specialHoursInfo.note && (
                        <p className="bar-text-muted text-body-small mt-2">{specialHoursInfo.note}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Regular Hours Info - Show when no special hours OR when special hours exist (to show both) */}
              {regularHours && (
                <div className="mb-7 md:mb-8 p-4 bg-blue-500/10 rounded-xl border border-blue-500/25">
                  <div className="flex items-center gap-2.5 text-blue-400">
                    <Info className="h-4 w-4 md:h-5 md:w-5" />
                    <p className="text-body-small font-medium">
                      {regularHours.is_closed 
                        ? 'We are closed on this day'
                        : `Regular hours: ${formatTime(regularHours.open_time)} - ${formatTime(regularHours.close_time)} (Florida Time) - Free reservations available`
                      }
                    </p>
                  </div>
                </div>
              )}

              {/* Event Conflict Warning */}
              {eventsOnDate.length > 0 && (
                <div className="mb-6 p-4 md:p-5 bg-gradient-to-br from-blue-500/8 via-purple-500/8 to-blue-500/8 rounded-lg border border-blue-500/20 shadow-md backdrop-blur-sm">
                  <div className="flex items-start gap-3">
                    <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg p-2 shadow-md flex-shrink-0">
                      <Calendar className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2.5 flex-wrap">
                        <h3 className="text-sm md:text-base font-bold text-blue-400">Event Scheduled</h3>
                        <span className="px-2 py-0.5 bg-blue-500/20 rounded-full text-xs font-semibold text-blue-400">
                          {eventsOnDate.length} Event{eventsOnDate.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="space-y-2 mb-3">
                        {eventsOnDate.map((event) => {
                          // Event times are stored in UTC, formatFloridaTime converts to Florida timezone for display
                          const eventStart = event.event_start
                          const eventEnd = event.event_end || null
                          
                          // Parse event times (stored in UTC)
                          const eventStartDate = typeof eventStart === 'string' ? parseISO(eventStart) : new Date(eventStart)
                          
                          // Calculate buffer start (1 hour before event start)
                          const bufferStartUTC = new Date(eventStartDate.getTime() - 1 * 60 * 60 * 1000)
                          
                          // For buffer end: if event has end time, use it; otherwise show "Until close"
                          let bufferEndUTC: Date
                          let eventEndDisplay: string
                          let bufferEndDisplay: string
                          
                          if (eventEnd) {
                            const eventEndDate = typeof eventEnd === 'string' ? parseISO(eventEnd) : new Date(eventEnd)
                            bufferEndUTC = new Date(eventEndDate.getTime() + 1 * 60 * 60 * 1000)
                            eventEndDisplay = formatFloridaTime(eventEnd, 'h:mm a')
                            bufferEndDisplay = formatFloridaTime(bufferEndUTC, 'h:mm a')
                          } else {
                            // No event end time - show "Until close"
                            eventEndDisplay = 'Until close'
                            
                            // For display, calculate buffer end using restaurant closing time
                            let closeTimeStr: string | null = null
                            if (specialHoursInfo && specialHoursInfo.time_to) {
                              closeTimeStr = specialHoursInfo.time_to
                            } else if (regularHours && regularHours.close_time) {
                              closeTimeStr = regularHours.close_time
                            }
                            
                            if (closeTimeStr) {
                              // Parse closing time (HH:MM format)
                              const [year, month, day] = formData.reservationDate.split('-').map(Number)
                              const [closeHour, closeMin] = closeTimeStr.split(':').map(Number)
                              
                              // Get event start time in Florida timezone to compare hours
                              const eventStartFlorida = toFloridaTime(eventStartDate)
                              const eventStartHour = eventStartFlorida.getHours()
                              
                              // Determine if closing time is on the same day or next day
                              // If closing hour is less than event start hour (and event is late night),
                              // closing time is likely on the next day
                              let closeDate = new Date(year, month - 1, day, closeHour, closeMin, 0)
                              if (closeHour < eventStartHour && closeHour < 12 && eventStartHour >= 18) {
                                // Closing time is likely next day (e.g., event at 10 PM, close at 2 AM)
                                closeDate = new Date(year, month - 1, day + 1, closeHour, closeMin, 0)
                              }
                              
                              // Convert to UTC and add 2-hour buffer
                              const { floridaToUTC } = require('@/lib/utils/timezone')
                              const closeTimeUTC = floridaToUTC(closeDate)
                              bufferEndUTC = new Date(closeTimeUTC.getTime() + 2 * 60 * 60 * 1000)
                              
                              // Format the buffer end time
                              bufferEndDisplay = formatFloridaTime(bufferEndUTC, 'h:mm a')
                            } else {
                              // Fallback: use event start + 5 hours
                              bufferEndUTC = new Date(eventStartDate.getTime() + 5 * 60 * 60 * 1000)
                              bufferEndDisplay = formatFloridaTime(bufferEndUTC, 'h:mm a')
                            }
                          }
                          
                          return (
                            <div key={event.id} className="bg-blue-500/5 rounded-md p-2.5 border border-blue-500/15">
                              <p className="font-semibold text-blue-400 mb-1 text-xs md:text-sm truncate">{event.title}</p>
                              <p className="text-xs text-blue-300/90 mb-1.5 flex items-center gap-1">
                                <Clock className="h-3 w-3 flex-shrink-0" />
                                <span>Event: {formatFloridaTime(eventStart, 'h:mm a')} - {eventEndDisplay}</span>
                              </p>
                              <p className="text-xs text-blue-400/70 mb-1.5">
                                Reservations blocked: {formatFloridaTime(bufferStartUTC, 'h:mm a')} - {bufferEndDisplay} (2-hour buffer)
                              </p>
                              <a 
                                href={`/events/${encodeURIComponent(event.slug)}`}
                                className="text-xs text-blue-400 hover:text-blue-300 font-medium underline inline-flex items-center gap-1 transition-colors"
                              >
                                View Event & Purchase Tickets
                                <span className="text-blue-300">→</span>
                              </a>
                            </div>
                          )
                        })}
                      </div>
                      <p className="text-xs text-blue-300/80 font-medium flex items-start gap-1.5">
                        <AlertCircle className="h-3.5 w-3.5 text-blue-400 mt-0.5 flex-shrink-0" />
                        <span>Reservations are blocked 1 hour before and after each event. Please select a time outside the blocked period or purchase event tickets.</span>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {submitStatus === 'success' && successReservationData && (
                <div className="mb-6 p-5 md:p-6 bg-green-500/10 border border-green-500/30 rounded-xl">
                  <div className="flex items-start gap-3 text-green-400">
                    <CheckCircle className="h-5 w-5 md:h-6 md:w-6 mt-1 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-bold text-body mb-3">Reservation submitted successfully!</p>
                      
                      <div className="space-y-2 text-body-small">
                        <div>
                          <span className="text-green-300/80">Email:</span>{' '}
                          <span className="font-semibold text-green-200">{successReservationData.customerEmail}</span>
                        </div>
                        {successReservationData.reservationId && (
                          <div>
                            <span className="text-green-300/80">Reservation ID:</span>{' '}
                            <span className="font-semibold text-green-200 font-mono text-xs">
                              {successReservationData.reservationId.slice(0, 8).toUpperCase()}
                            </span>
                          </div>
                        )}
                        {successReservationData.prepaymentAmount && successReservationData.prepaymentRequired && (
                          <div>
                            <span className="text-green-300/80">Prepayment Required:</span>{' '}
                            <span className="font-semibold text-green-200">
                              ${parseFloat(successReservationData.prepaymentAmount).toFixed(2)}
                            </span>
                            <p className="text-xs text-green-300/70 mt-1">
                              Payment will be processed separately. You'll receive payment instructions via email.
                            </p>
                          </div>
                        )}
                      </div>
                      
                      <p className="text-green-300 mt-3 text-body-small">
                        We'll confirm your reservation shortly. You'll receive a confirmation email at {successReservationData.customerEmail}.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {submitStatus === 'error' && (
                <div className="mb-6 p-5 md:p-6 bg-red-500/10 border border-red-500/30 rounded-xl">
                  <div className="flex items-center gap-3 text-red-400">
                    <AlertCircle className="h-5 w-5 md:h-6 md:w-6" />
                    <div>
                      <p className="font-bold text-body">Reservation Error</p>
                      <p className="text-red-300 mt-1 text-body-small">
                        {availabilityError || (contactPhone ? `Something went wrong. Please try again or call us directly at ${contactPhone}.` : 'Something went wrong. Please try again later.')}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Email Verification for Pre-paid Reservations */}
              {showEmailVerification && requiresEmailVerification() && (
                <div className="mb-6">
                  <EmailVerification
                    email={formData.customerEmail}
                    onVerified={handleEmailVerified}
                    onCancel={() => setShowEmailVerification(false)}
                  />
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5 md:space-y-6" noValidate>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
                  <div>
                    <Label htmlFor="customerName" className="text-body-small font-semibold mb-2 block">
                      Name *
                    </Label>
                    <Input
                      id="customerName"
                      required
                      value={formData.customerName}
                      onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                      className="h-11 md:h-12 text-body bg-[hsl(220,14%,18%)] border-red-500/20 text-gray-200 placeholder:text-gray-500 focus:border-red-500/40"
                      placeholder="Your full name"
                    />
                  </div>

                  <div>
                    <Label htmlFor="customerPhone" className="text-body-small font-semibold mb-2 block">
                      Phone *
                    </Label>
                    <Input
                      id="customerPhone"
                      required
                      type="tel"
                      value={formData.customerPhone}
                      onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                      className="h-11 md:h-12 text-body bg-[hsl(220,14%,18%)] border-red-500/20 text-gray-200 placeholder:text-gray-500 focus:border-red-500/40"
                      placeholder="(321) 555-0123"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="customerEmail" className="text-body-small font-semibold mb-2 block">
                    Email {requiresEmailVerification() ? '*' : ''}
                  </Label>
                  <Input
                    id="customerEmail"
                    type="email"
                    required={requiresEmailVerification()}
                    value={formData.customerEmail}
                    onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                    className="h-11 md:h-12 text-body bg-[hsl(220,14%,18%)] border-red-500/20 text-gray-200 placeholder:text-gray-500 focus:border-red-500/40"
                    placeholder="your.email@example.com"
                  />
                  {requiresEmailVerification() && (
                    <p className="text-xs text-amber-400 mt-1">
                      Email is required for paid reservations (prepayment required)
                    </p>
                  )}
                </div>


                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
                  <div>
                    <Label htmlFor="reservationDate" className="text-body-small font-semibold mb-2 block flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-amber-400" />
                      Date *
                    </Label>
                    <Input
                      id="reservationDate"
                      required
                      type="date"
                      min={today}
                      value={formData.reservationDate}
                      onChange={(e) => {
                        const selectedDate = e.target.value
                        if (selectedDate) {
                          setFormData({ ...formData, reservationDate: selectedDate, reservationTime: '' })
                        } else {
                          setFormData({ ...formData, reservationDate: '', reservationTime: '' })
                        }
                      }}
                      className="h-12 text-base"
                      lang="en-US"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Select a date using the calendar picker (Florida timezone)
                    </p>
                    {specialHoursInfo && (
                      <p className="text-sm text-orange-600 mt-2 flex items-center gap-1">
                        <Sparkles className="h-4 w-4" />
                        <span>Special hours apply for this date</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="reservationTime" className="text-base font-semibold mb-2 block flex items-center gap-2">
                      <Clock className="h-5 w-5 bar-text-amber" />
                      Time *
                    </Label>
                    {!formData.reservationDate ? (
                      <div className="h-12 flex items-center justify-center border rounded-lg bg-gray-50">
                        <span className="text-sm text-gray-500">Please select a date first</span>
                      </div>
                    ) : loadingSlots ? (
                      <div className="h-12 flex items-center justify-center border rounded-lg bg-gray-50">
                        <span className="text-sm text-gray-500">Loading available times...</span>
                      </div>
                    ) : availabilityError ? (
                      <div className="h-12 flex items-center justify-center border-2 border-red-200 rounded-lg bg-red-50 dark:bg-red-900/20">
                        <span className="text-sm text-red-600 dark:text-red-400 font-medium text-center px-2">
                          {availabilityError}
                        </span>
                      </div>
                    ) : availableSlots.length > 0 ? (
                      <div>
                        <select
                          id="reservationTime"
                          required
                          value={formData.reservationTime}
                          onChange={(e) => setFormData({ ...formData, reservationTime: e.target.value })}
                          className="w-full h-12 rounded-lg border border-gray-300 px-4 text-base focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-[#111111] text-white border-white/20"
                        >
                          <option value="">Select a time</option>
                          {availableSlots.map((slot) => {
                            // Check if this slot requires payment (special hours or event reservation price)
                            const requiresSpecialHoursPayment = specialHoursInfo && isTimeSlotRequiringPrepayment(slot, specialHoursInfo)
                            const requiresEventPayment = eventsOnDate.some(event => {
                              if (event.reservation_price && event.reservation_price > 0) {
                                const eventStart = typeof event.event_start === 'string' ? parseISO(event.event_start) : new Date(event.event_start)
                                const eventStartFlorida = toFloridaTime(eventStart)
                                const eventDateFlorida = eventStartFlorida.toISOString().split('T')[0]
                                const eventTimeFlorida = `${String(eventStartFlorida.getHours()).padStart(2, '0')}:${String(eventStartFlorida.getMinutes()).padStart(2, '0')}`
                                
                                if (eventDateFlorida === formData.reservationDate) {
                                  const [slotHour, slotMin] = slot.split(':').map(Number)
                                  const [eventHour, eventMin] = eventTimeFlorida.split(':').map(Number)
                                  const slotMinutes = slotHour * 60 + slotMin
                                  const eventMinutes = eventHour * 60 + eventMin
                                  return Math.abs(slotMinutes - eventMinutes) <= 30
                                }
                              }
                              return false
                            })
                            const requiresPayment = requiresSpecialHoursPayment || requiresEventPayment
                            return (
                              <option key={slot} value={slot}>
                                {formatTime(slot)}{requiresPayment ? ' (Prepayment Required)' : ''}
                              </option>
                            )
                          })}
                        </select>
                        {specialHoursInfo && (
                          <p className="text-xs text-gray-500 mt-1">
                            {availableSlots.length} time slot{availableSlots.length !== 1 ? 's' : ''} available
                            {specialHoursInfo.time_from && specialHoursInfo.time_to && (
                              <span className="block mt-1 text-amber-400">
                                <span className="font-semibold">Paid reservations:</span> {convert24To12(specialHoursInfo.time_from)} - {convert24To12(specialHoursInfo.time_to)} (includes 1-hour buffer before/after). <span className="text-blue-400">Free reservations available outside this window.</span>
                              </span>
                            )}
                          </p>
                        )}
                        {!specialHoursInfo && regularHours && !regularHours.is_closed && (
                          <p className="text-xs text-gray-500 mt-1">
                            All reservations are free. No payment required.
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="h-12 flex items-center justify-center border-2 border-red-200 rounded-lg bg-red-50">
                        <span className="text-sm text-red-600 font-medium text-center px-2">
                          {specialHoursInfo && !specialHoursInfo.is_open
                            ? 'Restaurant is closed on this date'
                            : regularHours && regularHours.is_closed
                            ? 'We are closed on this day'
                            : specialHoursInfo && specialHoursInfo.is_open
                            ? 'No time slots available. Please check special hours configuration in admin panel.'
                            : 'No available time slots'}
                        </span>
                      </div>
                    )}
                    {availabilityError && (
                      <p className="text-sm text-red-600 mt-2 flex items-center gap-1">
                        <AlertCircle className="h-4 w-4" />
                        {availabilityError}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <Label htmlFor="area" className="text-body-small font-semibold mb-2 block flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-amber-400" />
                    Preferred Area *
                  </Label>
                  <select
                    id="area"
                    required
                    value={formData.area}
                    onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                    className="w-full h-12 rounded-lg border border-gray-300 px-4 text-base focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-[#111111] text-white border-white/20"
                  >
                    <option value="">Select an area</option>
                    <option value="Restaurant">Restaurant</option>
                    <option value="Stage Bar">Stage Bar</option>
                    <option value="Middle Bar">Middle Bar</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="guestsCount" className="text-base font-semibold mb-2 block flex items-center gap-2">
                    <Users className="h-5 w-5 bar-text-amber" />
                    Number of Guests *
                  </Label>
                  <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setFormData({
                        ...formData,
                        guestsCount: Math.max(1, formData.guestsCount - 1)
                      })}
                      className="min-h-[44px] min-w-[44px] sm:h-12 sm:w-12 text-xl font-bold touch-manipulation"
                    >
                      −
                    </Button>
                    <Input
                      id="guestsCount"
                      type="number"
                      min="1"
                      max="12"
                      required
                      value={formData.guestsCount}
                      onChange={(e) => setFormData({
                        ...formData,
                        guestsCount: parseInt(e.target.value) || 1
                      })}
                      className="h-12 w-20 sm:w-24 text-center text-lg sm:text-xl font-bold"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setFormData({
                        ...formData,
                        guestsCount: Math.min(12, formData.guestsCount + 1)
                      })}
                      className="min-h-[44px] min-w-[44px] sm:h-12 sm:w-12 text-xl font-bold touch-manipulation"
                    >
                      +
                    </Button>
                    <span className="text-xs sm:text-sm bar-text-muted w-full sm:w-auto">(Max 12 guests)</span>
                  </div>
                  {specialHoursInfo?.special_hours_limits?.[0]?.max_guests_per_booking && 
                   formData.reservationTime &&
                   isTimeWithinSpecialHours(formData.reservationTime, specialHoursInfo) && (
                    <p className="text-sm text-orange-600 mt-2">
                      Maximum {specialHoursInfo.special_hours_limits[0].max_guests_per_booking} guests per booking for this event
                    </p>
                  )}
                </div>

                {/* Custom Fields from Special Hours - Only show if time is within special hours range */}
                {specialHoursInfo?.special_hours_fields && 
                 formData.reservationTime &&
                 isTimeWithinSpecialHours(formData.reservationTime, specialHoursInfo) &&
                 specialHoursInfo.special_hours_fields.map((field: any) => (
                  <div key={field.id}>
                    <Label htmlFor={field.field_key} className="text-base font-semibold mb-2 block">
                      {field.field_label} {field.is_required && '*'}
                    </Label>
                    {field.field_type === 'textarea' ? (
                      <Textarea
                        id={field.field_key}
                        required={field.is_required}
                        rows={4}
                        value={customFields[field.field_key] || ''}
                        onChange={(e) =>
                          setCustomFields({ ...customFields, [field.field_key]: e.target.value })
                        }
                        className="text-base"
                        placeholder={field.field_label}
                      />
                    ) : field.field_type === 'select' ? (
                      <select
                        id={field.field_key}
                        required={field.is_required}
                        value={customFields[field.field_key] || ''}
                        onChange={(e) =>
                          setCustomFields({ ...customFields, [field.field_key]: e.target.value })
                        }
                        className="w-full h-12 rounded-lg border border-gray-300 px-4 text-base focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      >
                        <option value="">Select {field.field_label}</option>
                        {field.field_options?.map((option: string) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        id={field.field_key}
                        required={field.is_required}
                        type={field.field_type === 'number' ? 'number' : 'text'}
                        value={customFields[field.field_key] || ''}
                        onChange={(e) =>
                          setCustomFields({ ...customFields, [field.field_key]: e.target.value })
                        }
                        className="h-12 text-base"
                        placeholder={field.field_label}
                      />
                    )}
                  </div>
                ))}

                <div>
                  <Label htmlFor="notes" className="text-base font-semibold mb-2 block">
                    Special Requests or Notes
                  </Label>
                  <Textarea
                    id="notes"
                    rows={4}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="text-base"
                    placeholder="Any dietary restrictions, special occasions, or preferences..."
                  />
                </div>

                {/* Special Hours Payment Info - Only show if time is within special hours range */}
                {specialHoursInfo?.special_hours_payment?.[0]?.prepayment_required && 
                 formData.reservationTime &&
                 isTimeWithinSpecialHours(formData.reservationTime, specialHoursInfo) && (
                  <div className="p-6 bg-gradient-to-r from-yellow-50 to-amber-50 border-2 border-yellow-200 rounded-2xl">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-6 w-6 text-yellow-600 mt-0.5" />
                      <div>
                        <p className="font-bold text-yellow-900 mb-1">Prepayment Required</p>
                        <p className="text-sm text-yellow-800">
                          {specialHoursInfo.special_hours_payment[0].prepayment_rule_type === 'percentage'
                            ? `${specialHoursInfo.special_hours_payment[0].prepayment_percentage}% prepayment required`
                            : specialHoursInfo.special_hours_payment[0].prepayment_rule_type === 'per_guest'
                            ? `$${specialHoursInfo.special_hours_payment[0].prepayment_amount} per guest prepayment required`
                            : `$${specialHoursInfo.special_hours_payment[0].prepayment_amount} prepayment required`}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Cancellation Policy - Only show if time is within special hours range */}
                {specialHoursInfo?.special_hours_payment?.[0]?.cancellation_policy && 
                 formData.reservationTime &&
                 isTimeWithinSpecialHours(formData.reservationTime, specialHoursInfo) && (
                  <div className="p-4 bg-blue-50/50 border border-blue-200/50 rounded-xl">
                    <p className="text-sm font-semibold text-blue-900 mb-1">Cancellation Policy</p>
                    <p className="text-sm text-blue-800">
                      {specialHoursInfo.special_hours_payment[0].cancellation_policy_custom ||
                        `Cancellation policy: ${specialHoursInfo.special_hours_payment[0].cancellation_policy}`}
                      {specialHoursInfo.special_hours_payment[0].cancellation_hours_before &&
                        ` (Cancel ${specialHoursInfo.special_hours_payment[0].cancellation_hours_before} hours before to avoid penalty)`}
                    </p>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isSubmitting || loadingSlots || (availableSlots.length === 0 && !!formData.reservationDate)}
                  className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-xl hover:shadow-2xl transform hover:scale-[1.02] transition-all font-bold text-base sm:text-lg min-h-[48px] sm:py-7 rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                >
                  {isSubmitting ? (
                    <>
                      <span className="animate-spin mr-2">⏳</span>
                      Submitting...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-5 w-5 inline" />
                      Submit Reservation
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </AnimatedSection>

        {/* Info Card */}
        <AnimatedSection direction="up" delay={200}>
          <Card className="bar-card mt-8 border-2 border-orange-200/30">
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 bar-text-amber mt-0.5" />
                  <div>
                    <p className="font-semibold bar-text-gold">Reservation Policy</p>
                    <p className="text-sm bar-text-muted">
                      Reservations are held for 15 minutes past the scheduled time. 
                      Please call if you're running late.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Users className="h-5 w-5 bar-text-amber mt-0.5" />
                  <div>
                    <p className="font-semibold bar-text-gold">Large Parties</p>
                    <p className="text-sm bar-text-muted">
                      {contactPhone ? `For parties of 8 or more, please call us directly at ${contactPhone}` : 'For parties of 8 or more, please contact us directly'} 
                      to ensure we can accommodate your group.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </AnimatedSection>
      </div>
    </div>
  )
}

export default function ReservationsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading reservation form...</p>
        </div>
      </div>
    }>
      <ReservationsPageContent />
    </Suspense>
  )
}

