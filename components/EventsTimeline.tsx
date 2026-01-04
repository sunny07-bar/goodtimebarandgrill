'use client'

import { useState, useMemo, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import Link from 'next/link'
import { Calendar, Clock, MapPin, ArrowRight, Ticket, ExternalLink } from 'lucide-react'
import SupabaseImage from '@/components/SupabaseImage'
import AnimatedSection from '@/components/AnimatedSection'
import { formatFloridaTime, toFloridaTime, getFloridaNow, formatFloridaDateDDMMYYYY } from '@/lib/utils/timezone'

interface Event {
  id: string
  title: string
  description?: string
  event_start: string
  event_end?: string
  location?: string
  image_path?: string
  slug: string
  base_ticket_price?: number | string
  ticket_currency?: string
  ticket_link?: string
  reservation_price?: number | string
  action_button_type?: string // "reservation" | "external_tickets" | "custom_tickets"
  event_tickets?: Array<{ price: number | string }>
}

interface EventsTimelineProps {
  events: Event[]
}

export default function EventsTimeline({ events }: EventsTimelineProps) {
  // Filter and sort events - only show future/upcoming events (using Florida timezone)
  const sortedEvents = useMemo(() => {
    const now = getFloridaNow()
    const todayFlorida = format(now, 'yyyy-MM-dd')
    
    // Filter out past events
    const upcomingEvents = events.filter((event) => {
      try {
        if (!event.event_start) return false
        
        const eventStart = typeof event.event_start === 'string' ? parseISO(event.event_start) : new Date(event.event_start)
        const floridaEventStart = toFloridaTime(eventStart)
        const eventDateFlorida = format(floridaEventStart, 'yyyy-MM-dd')
        
        // First check: Is the event's date today or in the future?
        if (eventDateFlorida < todayFlorida) {
          // Event date is in the past, don't show it
          return false
        }
        
        // If event date is today or in the future, check if it has ended
        if (event.event_end) {
          const eventEnd = typeof event.event_end === 'string' ? parseISO(event.event_end) : new Date(event.event_end)
          const floridaEventEnd = toFloridaTime(eventEnd)
          // Show event if current time is before event end
          return now.getTime() < floridaEventEnd.getTime()
        }
        
        // If no end time and event date is today or future, show it
        // For today's events without end time, show until end of day
        if (eventDateFlorida === todayFlorida) {
          // Event is today, show it (will be visible until end of day)
          return true
        }
        
        // Event is in the future, show it
        return true
      } catch (error) {
        console.error('Error filtering event:', error, event)
        return false
      }
    })
    
    // Sort by date
    return upcomingEvents.sort((a, b) => {
      const dateA = typeof a.event_start === 'string' ? parseISO(a.event_start) : new Date(a.event_start)
      const dateB = typeof b.event_start === 'string' ? parseISO(b.event_start) : new Date(b.event_start)
      const floridaDateA = toFloridaTime(dateA)
      const floridaDateB = toFloridaTime(dateB)
      return floridaDateA.getTime() - floridaDateB.getTime()
    })
  }, [events])

  const formatTime = (timeString: string | undefined) => {
    if (!timeString) return ''
    try {
      return formatFloridaTime(timeString, 'h:mm a')
    } catch {
      return timeString
    }
  }

  const formatDate = (dateString: string) => {
    try {
      if (!dateString) {
        return {
          weekday: '',
          day: '',
          month: '',
          monthNum: 0,
          full: '',
          year: ''
        }
      }
      
      // Parse the date and convert to Florida timezone
      // Use formatInTimeZone directly for consistency with formatFloridaDateDDMMYYYY
      const date = typeof dateString === 'string' ? parseISO(dateString) : new Date(dateString)
      
      // Ensure we're working with a valid date
      if (isNaN(date.getTime())) {
        console.error('[EventsTimeline formatDate] Invalid date:', dateString)
        return {
          weekday: '',
          day: '',
          month: '',
          monthNum: 0,
          full: '',
          year: ''
        }
      }
      
      // Extract date components from Florida timezone (not UTC calendar date)
      // This ensures events show the correct calendar date in Florida timezone
      const floridaDate = toFloridaTime(date)
      const floridaDateString = format(floridaDate, 'yyyy-MM-dd')
      const [year, month, day] = floridaDateString.split('-').map(Number)
      
      // Format day and month from Florida timezone date
      const dayStr = String(day).padStart(2, '0')
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      const monthName = monthNames[month - 1]
      const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      const weekday = weekdayNames[floridaDate.getDay()]
      
      return {
        weekday: weekday,
        day: String(day), // Day number without padding for display
        month: monthName,
        monthNum: month - 1, // 0-11 for grouping
        full: formatFloridaDateDDMMYYYY(dateString), // Use the same function for consistency
        year: String(year)
      }
    } catch (error) {
      console.error('[EventsTimeline formatDate] Error:', error, dateString)
      return {
        weekday: '',
        day: '',
        month: '',
        monthNum: 0,
        full: '',
        year: ''
      }
    }
  }

  // Group events by year-month for month selector (using Florida timezone)
  const eventsByYearMonth = useMemo(() => {
    const grouped: Record<string, { year: number; month: number; monthName: string; events: Event[] }> = {}
    
    sortedEvents.forEach((event) => {
      try {
        // Parse and convert to Florida timezone
        const date = typeof event.event_start === 'string' ? parseISO(event.event_start) : new Date(event.event_start)
        const floridaDate = toFloridaTime(date)
        const year = floridaDate.getFullYear()
        const month = floridaDate.getMonth() // 0-11 (in Florida timezone)
        const key = `${year}-${month.toString().padStart(2, '0')}`
        
        if (!grouped[key]) {
          const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
          grouped[key] = {
            year,
            month,
            monthName: monthNames[month],
            events: []
          }
        }
        grouped[key].events.push(event)
      } catch (error) {
        console.error('Error grouping event by month:', error, event)
      }
    })
    
    return grouped
  }, [sortedEvents])

  // Get all available months sorted chronologically
  const availableMonths = useMemo(() => {
    return Object.entries(eventsByYearMonth)
      .sort(([keyA], [keyB]) => {
        const [yearA, monthA] = keyA.split('-').map(Number)
        const [yearB, monthB] = keyB.split('-').map(Number)
        if (yearA !== yearB) return yearA - yearB
        return monthA - monthB
      })
      .map(([key, data]) => ({
        key,
        ...data
      }))
  }, [eventsByYearMonth])

  // Selected month state
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null)
  const [isRestoring, setIsRestoring] = useState(false)

  // Get events for selected month
  const currentMonthEvents = useMemo(() => {
    if (!selectedMonthKey) return []
    return eventsByYearMonth[selectedMonthKey]?.events || []
  }, [selectedMonthKey, eventsByYearMonth])

  // Restore selected month from sessionStorage on mount
  useEffect(() => {
    if (availableMonths.length > 0 && Object.keys(eventsByYearMonth).length > 0) {
      const savedMonthKey = sessionStorage.getItem('events-selected-month')
      
      // Restore selected month if it exists and is valid
      if (savedMonthKey && eventsByYearMonth[savedMonthKey]) {
        setIsRestoring(true)
        setSelectedMonthKey(savedMonthKey)
      } else if (selectedMonthKey === null) {
        // Default to first available month if no saved state
        setSelectedMonthKey(availableMonths[0].key)
      }
    }
  }, [availableMonths.length, eventsByYearMonth, selectedMonthKey, availableMonths])

  // Restore scroll position after selected month is set and events are rendered
  useEffect(() => {
    if (selectedMonthKey && currentMonthEvents.length > 0) {
      const savedScrollY = sessionStorage.getItem('events-scroll-y')
      if (savedScrollY && isRestoring) {
        // Use requestAnimationFrame to ensure DOM is fully rendered
        requestAnimationFrame(() => {
          setTimeout(() => {
            window.scrollTo({
              top: parseInt(savedScrollY, 10),
              behavior: 'instant'
            })
            sessionStorage.removeItem('events-scroll-y')
            setIsRestoring(false)
          }, 50)
        })
      } else if (!savedScrollY && isRestoring) {
        setIsRestoring(false)
      }
    }
  }, [selectedMonthKey, currentMonthEvents.length, isRestoring])

  // Save selected month to sessionStorage whenever it changes (but not during restoration)
  useEffect(() => {
    if (selectedMonthKey && !isRestoring) {
      sessionStorage.setItem('events-selected-month', selectedMonthKey)
    }
  }, [selectedMonthKey, isRestoring])

  // Save scroll position and selected month when clicking on event links
  useEffect(() => {
    const handleEventLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const link = target.closest('a[href^="/events/"]') as HTMLAnchorElement
      if (link && link.href.includes('/events/') && !link.href.endsWith('/events')) {
        sessionStorage.setItem('events-scroll-y', window.scrollY.toString())
        if (selectedMonthKey) {
          sessionStorage.setItem('events-selected-month', selectedMonthKey)
        }
      }
    }

    document.addEventListener('click', handleEventLinkClick, true)
    return () => {
      document.removeEventListener('click', handleEventLinkClick, true)
    }
  }, [selectedMonthKey])

  // Get selected month info
  const selectedMonthInfo = useMemo(() => {
    if (!selectedMonthKey) return null
    return eventsByYearMonth[selectedMonthKey] || null
  }, [selectedMonthKey, eventsByYearMonth])

  // Handle month toggle with smooth scroll
  const handleMonthToggle = (monthKey: string) => {
    setSelectedMonthKey(monthKey)
    // Smooth scroll to timeline
    setTimeout(() => {
      const timelineSection = document.getElementById('events-timeline')
      if (timelineSection) {
        timelineSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }, 100)
  }

  if (sortedEvents.length === 0) {
    return (
      <div className="text-center py-16 md:py-20">
        <div className="card-dark max-w-md mx-auto">
          <Calendar className="h-14 w-14 md:h-16 md:w-16 text-[#F59E0B] mx-auto mb-4 opacity-60" />
          <p className="body-text text-center">No events scheduled at the moment. Check back soon!</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      {/* Heading */}
      <AnimatedSection direction="down">
        <div className="text-center mb-8 md:mb-12">
          <h2 className="section-title mb-2">
            UPCOMING EVENTS
          </h2>
          <div className="w-16 md:w-28 h-0.5 md:h-1 bg-[#F59E0B] mx-auto rounded-full"></div>
        </div>
      </AnimatedSection>

      {/* Month Selector Buttons */}
      {availableMonths.length > 0 && (
        <AnimatedSection direction="up" delay={100}>
          <div className="mb-8 md:mb-12">
            {/* Mobile: Horizontal scrollable */}
            <div className="md:hidden overflow-x-auto pb-3 scrollbar-hide -mx-4 px-4">
              <div className="flex gap-2 min-w-max">
                {availableMonths.map((month) => (
                  <button
                    key={month.key}
                    onClick={() => handleMonthToggle(month.key)}
                    className={`relative px-3.5 py-2 rounded-lg font-bold text-xs whitespace-nowrap transition-all duration-300 flex-shrink-0 ${
                      selectedMonthKey === month.key
                        ? 'bg-[#F59E0B] text-black scale-105 shadow-lg shadow-[#F59E0B]/30 z-10'
                        : 'bg-[#111111] border-2 border-white/10 text-[#D1D5DB] active:bg-[#F59E0B]/15 active:border-[#F59E0B]/50 active:text-[#F59E0B]'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <span>{month.monthName.slice(0, 3)}</span>
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                        selectedMonthKey === month.key
                          ? 'bg-white/20 text-white'
                          : 'bg-[#F59E0B]/20 text-[#F59E0B]'
                      }`}>
                        {month.events.length}
                      </span>
                    </span>
                    {selectedMonthKey === month.key && (
                      <div className="absolute -bottom-0.5 left-1/2 transform -translate-x-1/2 w-6 h-0.5 bg-[#F59E0B] rounded-full"></div>
                    )}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Desktop: Centered wrap */}
            <div className="hidden md:flex flex-wrap gap-2.5 md:gap-3 justify-center">
              {availableMonths.map((month) => (
                <button
                  key={month.key}
                  onClick={() => handleMonthToggle(month.key)}
                  className={`relative px-5 md:px-7 py-2.5 md:py-3.5 rounded-xl font-bold text-sm md:text-base whitespace-nowrap transition-all duration-300 transform ${
                    selectedMonthKey === month.key
                      ? 'bg-[#F59E0B] text-black scale-105 shadow-lg shadow-[#F59E0B]/30 z-10'
                      : 'bg-[#111111] border-2 border-white/10 text-[#D1D5DB] hover:bg-[#F59E0B]/15 hover:border-[#F59E0B]/50 hover:text-[#F59E0B] hover:scale-102 active:scale-95'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span>{month.monthName}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      selectedMonthKey === month.key
                        ? 'bg-white/20 text-white'
                        : 'bg-[#F59E0B]/20 text-[#F59E0B]'
                    }`}>
                      {month.events.length}
                    </span>
                  </span>
                  {selectedMonthKey === month.key && (
                    <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-8 h-1 bg-[#F59E0B] rounded-full"></div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </AnimatedSection>
      )}

      {/* Vertical Timeline for Selected Month */}
      {selectedMonthKey && currentMonthEvents.length > 0 && (
        <div id="events-timeline" className="relative scroll-mt-20">
          {/* Month Label */}
          <AnimatedSection direction="down" delay={200}>
            <div className="text-center mb-8 md:mb-12 relative z-10">
              <div className="bg-[#0E0E0E] inline-block px-6 py-3 rounded-lg border-2 border-[#F59E0B] shadow-lg">
                <h3 className="text-2xl md:text-3xl font-bold text-[#F59E0B]">
                  {selectedMonthInfo?.monthName} {selectedMonthInfo?.year}
                </h3>
                <p className="text-sm text-gray-400 mt-2">
                  {currentMonthEvents.length} {currentMonthEvents.length === 1 ? 'event' : 'events'}
                </p>
              </div>
            </div>
          </AnimatedSection>

          {/* Vertical Line - Desktop (starts below month label) */}
          <div className="hidden md:block absolute left-1/2 top-24 md:top-28 bottom-0 w-0.5 bg-gradient-to-b from-[#F59E0B] via-[#F59E0B]/60 to-[#F59E0B] transform -translate-x-1/2 z-0"></div>
          
          {/* Vertical Line - Mobile (left side, starts below month label) */}
          <div className="md:hidden absolute left-6 top-24 bottom-0 w-0.5 bg-gradient-to-b from-[#F59E0B] via-[#F59E0B]/60 to-[#F59E0B] z-0"></div>

          {/* Events List */}
          <div className="relative space-y-8 md:space-y-12">
            {currentMonthEvents.map((event, index) => {
              const eventDate = formatDate(event.event_start)
              const eventEnd = event.event_end
                ? (typeof event.event_end === 'string' ? toFloridaTime(parseISO(event.event_end)) : toFloridaTime(event.event_end))
                : null
              const eventStart = typeof event.event_start === 'string'
                ? toFloridaTime(parseISO(event.event_start))
                : toFloridaTime(event.event_start)
              const floridaDate = eventStart
              
              // Debug logging for first event
              if (index === 0) {
                console.log('EventsTimeline - Event display:', {
                  'Raw from DB': event.event_start,
                  'Florida time (start)': formatFloridaTime(eventStart, 'yyyy-MM-dd HH:mm:ss'),
                  'Display time': formatTime(event.event_start),
                })
              }

              // Alternate left/right for desktop
              const isEven = index % 2 === 0

              return (
                <AnimatedSection 
                  key={event.id} 
                  direction={isEven ? 'left' : 'right'} 
                  delay={index * 0.1}
                  className="relative"
                >
                  {/* Timeline Node/Dot */}
                  <div className="absolute left-6 md:left-1/2 transform -translate-x-1/2 z-20">
                    <div className="w-4 h-4 md:w-5 md:h-5 rounded-full bg-[#F59E0B] border-4 border-[#0E0E0E] shadow-lg shadow-[#F59E0B]/50"></div>
                    <div className="absolute inset-0 w-4 h-4 md:w-5 md:h-5 rounded-full bg-[#F59E0B] animate-ping opacity-20"></div>
                  </div>

                  {/* Event Card with 3D Effect */}
                  <div className={`ml-16 md:ml-0 ${isEven ? 'md:mr-[55%]' : 'md:ml-[55%]'} card-3d`}>
                    <div className="card-dark hover:border-[#F59E0B]/50 transition-all duration-300 card-hover-lift card-3d-inner">
                      {/* Mobile Layout */}
                      <div className="md:hidden space-y-4">
                        {/* Date Badge */}
                        <div className="flex items-start gap-3">
                          <div className="card-dark p-2.5 text-center border-2 border-[#F59E0B]/40 flex-shrink-0 w-16">
                            <div className="text-[9px] font-semibold text-[#F59E0B] uppercase tracking-wider mb-0.5">
                              {eventDate.weekday}
                            </div>
                            <div className="text-lg font-extrabold text-[#F59E0B] mb-0.5">
                              {eventDate.day}
                            </div>
                            <div className="text-[9px] font-medium text-gray-400 uppercase">
                              {eventDate.month}
                            </div>
                          </div>

                          {/* Event Image - Smaller on mobile */}
                          <Link href={`/events/${encodeURIComponent(event.slug)}`} className="flex-1 max-w-[120px]">
                            <div className="relative aspect-square rounded-lg overflow-hidden group">
                              {event.image_path ? (
                                <SupabaseImage
                                  src={event.image_path}
                                  alt={event.title}
                                  fill
                                  className="object-cover group-hover:scale-110 transition-transform duration-300"
                                  bucket="events"
                                />
                              ) : (
                                <div className="w-full h-full bg-gradient-to-br from-[#F59E0B]/20 to-[#F59E0B]/10 flex items-center justify-center">
                                  <Calendar className="h-6 w-6 text-[#F59E0B] opacity-50" />
                                </div>
                              )}
                            </div>
                          </Link>
                        </div>

                        {/* Content */}
                        <div className="space-y-3">
                          <h4 className="card-title text-lg">{event.title}</h4>
                          
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-[#F59E0B]" />
                            <span className="text-sm text-[#F59E0B] font-semibold">
                              {formatTime(event.event_start)}
                              {eventEnd && ` - ${formatTime(event.event_end)}`}
                            </span>
                          </div>

                          {event.location && (
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-gray-400" />
                              <span className="text-sm body-text">{event.location}</span>
                            </div>
                          )}

                          {event.description && (
                            <p className="body-text text-sm line-clamp-2">{event.description}</p>
                          )}

                          {(event.base_ticket_price || (event.event_tickets && event.event_tickets.length > 0)) && (
                            <div className="flex items-center gap-2">
                              <Ticket className="h-4 w-4 text-[#F59E0B]" />
                              <span className="text-sm font-semibold price-amber">
                                {event.base_ticket_price 
                                  ? `${event.ticket_currency === 'USD' ? '$' : '$'}${parseFloat(event.base_ticket_price.toString()).toFixed(2)}`
                                  : event.event_tickets && event.event_tickets.length > 0
                                    ? `From $${parseFloat(event.event_tickets[0].price.toString()).toFixed(2)}`
                                    : ''
                                }
                              </span>
                            </div>
                          )}

                          {/* Action Button or View Details - Based on action_button_type */}
                          <div className="mt-4">
                            {event.action_button_type === 'reservation' && (
                              <Link 
                                href={`/reservations?eventDate=${format(floridaDate, 'yyyy-MM-dd')}&eventTime=${format(floridaDate, 'HH:mm')}`}
                                className="block"
                              >
                                <button className="btn-amber-sm w-full text-sm">
                                  Make a Reservation
                                </button>
                              </Link>
                            )}
                            
                            {event.action_button_type === 'external_tickets' && event.ticket_link && (
                              <a 
                                href={event.ticket_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block"
                              >
                                <button className="btn-amber-sm w-full text-sm flex items-center justify-center gap-2">
                                  Get Tickets <ExternalLink className="h-3.5 w-3.5" />
                                </button>
                              </a>
                            )}
                            
                            {/* For custom_tickets, show View Details button to go inside event */}
                            {(event.action_button_type === 'custom_tickets' || !event.action_button_type) && (
                              <Link href={`/events/${encodeURIComponent(event.slug)}`} className="block">
                                <button className="btn-amber-sm w-full text-sm">
                                  View Details <ArrowRight className="ml-2 h-3.5 w-3.5 inline" />
                                </button>
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Desktop Layout */}
                      <div className="hidden md:grid grid-cols-12 gap-6 items-center">
                        {/* Date Section */}
                        <div className={`col-span-3 ${isEven ? 'order-1' : 'order-3'}`}>
                          <div className="card-dark p-5 text-center border-2 border-[#F59E0B]/40">
                            <div className="text-xs font-semibold text-[#F59E0B] uppercase tracking-wider mb-1">
                              {eventDate.weekday}
                            </div>
                            <div className="text-3xl font-extrabold text-[#F59E0B] mb-1">
                              {eventDate.day}
                            </div>
                            <div className="text-sm font-medium text-gray-400 uppercase">
                              {eventDate.month}
                            </div>
                          </div>
                        </div>

                        {/* Content Section */}
                        <div className={`col-span-6 ${isEven ? 'order-2' : 'order-2'} space-y-3`}>
                          <h4 className="card-title text-xl">{event.title}</h4>
                          
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-[#F59E0B]" />
                            <span className="text-sm text-[#F59E0B] font-semibold">
                              {formatTime(event.event_start)}
                              {eventEnd && ` - ${formatTime(event.event_end)}`}
                            </span>
                          </div>

                          {event.location && (
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-gray-400" />
                              <span className="text-sm body-text">{event.location}</span>
                            </div>
                          )}

                          {event.description && (
                            <p className="body-text text-sm line-clamp-3">{event.description}</p>
                          )}

                          {(event.base_ticket_price || (event.event_tickets && event.event_tickets.length > 0)) && (
                            <div className="flex items-center gap-2">
                              <Ticket className="h-4 w-4 text-[#F59E0B]" />
                              <span className="text-sm font-semibold price-amber">
                                {event.base_ticket_price 
                                  ? `${event.ticket_currency === 'USD' ? '$' : '$'}${parseFloat(event.base_ticket_price.toString()).toFixed(2)}`
                                  : event.event_tickets && event.event_tickets.length > 0
                                    ? `From $${parseFloat(event.event_tickets[0].price.toString()).toFixed(2)}`
                                    : ''
                                }
                              </span>
                            </div>
                          )}

                          {/* Action Button or View Details - Based on action_button_type */}
                          <div className="mt-4">
                            {event.action_button_type === 'reservation' && (
                              <Link 
                                href={`/reservations?eventDate=${format(floridaDate, 'yyyy-MM-dd')}&eventTime=${format(floridaDate, 'HH:mm')}`}
                                className="inline-block"
                              >
                                <button className="btn-amber-sm inline-flex items-center gap-2 text-sm">
                                  Make a Reservation
                                </button>
                              </Link>
                            )}
                            
                            {event.action_button_type === 'external_tickets' && event.ticket_link && (
                              <a 
                                href={event.ticket_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-block"
                              >
                                <button className="btn-amber-sm inline-flex items-center gap-2 text-sm">
                                  Get Tickets <ExternalLink className="h-4 w-4" />
                                </button>
                              </a>
                            )}
                            
                            {/* For custom_tickets, show View Details button to go inside event */}
                            {(event.action_button_type === 'custom_tickets' || !event.action_button_type) && (
                              <Link href={`/events/${encodeURIComponent(event.slug)}`} className="inline-block">
                                <button className="btn-amber-sm inline-flex items-center gap-2 text-sm">
                                  View Details <ArrowRight className="h-4 w-4" />
                                </button>
                              </Link>
                            )}
                          </div>
                        </div>

                        {/* Image Section */}
                        <div className={`col-span-3 ${isEven ? 'order-3' : 'order-1'}`}>
                          <Link href={`/events/${encodeURIComponent(event.slug)}`}>
                            <div className="relative aspect-[4/5] rounded-xl overflow-hidden group cursor-pointer">
                              {event.image_path ? (
                                <SupabaseImage
                                  src={event.image_path}
                                  alt={event.title}
                                  fill
                                  className="object-cover group-hover:scale-110 transition-transform duration-300"
                                  bucket="events"
                                />
                              ) : (
                                <div className="w-full h-full bg-gradient-to-br from-[#F59E0B]/20 to-[#F59E0B]/10 flex items-center justify-center">
                                  <Calendar className="h-12 w-12 text-[#F59E0B] opacity-50" />
                                </div>
                              )}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            </div>
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                </AnimatedSection>
              )
            })}
          </div>
        </div>
      )}

      {/* Empty State for Selected Month */}
      {selectedMonthKey && currentMonthEvents.length === 0 && (
        <div className="text-center py-12 md:py-16">
          <div className="card-dark max-w-md mx-auto">
            <Calendar className="h-12 w-12 md:h-14 md:w-14 text-[#F59E0B] mx-auto mb-4 opacity-60" />
            <p className="body-text text-center">
              No events scheduled for {selectedMonthInfo?.monthName} {selectedMonthInfo?.year}.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
