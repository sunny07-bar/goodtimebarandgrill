'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calendar, MapPin, Clock, Ticket, Loader2, ArrowLeft, ArrowRight, ExternalLink } from 'lucide-react'
import { getEventBySlug } from '@/lib/queries'
import SupabaseImage from '@/components/SupabaseImage'
import { formatFloridaTime, formatFloridaDateDDMMYYYY, toFloridaTime } from '@/lib/utils/timezone'
import { format } from 'date-fns'
import Link from 'next/link'

export default function EventDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [event, setEvent] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isPastEvent, setIsPastEvent] = useState(false)

  useEffect(() => {
    loadEvent()
  }, [params.slug])

  const loadEvent = async () => {
    try {
      // Decode the slug from URL params (Next.js should handle this, but be explicit)
      const slug = decodeURIComponent(params.slug as string)
      console.log('Loading event with slug:', slug)

      const eventData = await getEventBySlug(slug)
      if (eventData) {
        console.log('Event loaded:', {
          id: eventData.id,
          title: eventData.title,
          base_ticket_price: eventData.base_ticket_price,
          ticket_currency: eventData.ticket_currency,
          event_tickets_count: eventData.event_tickets?.length || 0,
          event_tickets: eventData.event_tickets
        })
        // Check if event is in the past (using Florida timezone)
        if (eventData.event_start) {
          const { toFloridaTime, getFloridaNow } = require('@/lib/utils/timezone')
          const eventStartFlorida = toFloridaTime(eventData.event_start)
          const floridaNow = getFloridaNow()
          setIsPastEvent(eventStartFlorida < floridaNow)
        }

        setEvent(eventData)
      } else {
        console.error('Event not found for slug:', slug)
      }
    } catch (error) {
      console.error('Error loading event:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="section-bg-primary section-spacing">
        <div className="container-global text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-[#F59E0B]" />
          <p className="body-text">Loading event...</p>
        </div>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="section-bg-primary section-spacing">
        <div className="container-global text-center">
          <div className="card-premium max-w-md mx-auto">
            <p className="body-text text-lg">Event not found</p>
          </div>
        </div>
      </div>
    )
  }

  // Don't convert here - formatFloridaTime already handles timezone conversion
  // Just pass the raw ISO string from database

  const handleBack = () => {
    // Navigate back to events page
    router.push('/events')
  }

  return (
    <div className="section-bg-primary section-spacing">
      <div className="container-global max-w-7xl">
        {/* Back Button */}
        <button
          onClick={handleBack}
          className="inline-flex items-center gap-2 mb-6 md:mb-8 px-4 md:px-6 py-2.5 md:py-3 rounded-xl bg-[#111111] border border-white/10 hover:bg-[#F59E0B]/10 hover:border-[#F59E0B]/40 text-[#D1D5DB] hover:text-[#F59E0B] transition-all font-semibold cursor-pointer text-sm md:text-base"
        >
          <ArrowLeft className="h-4 w-4 md:h-5 md:w-5" />
          <span>Back to Events</span>
        </button>

        {/* Event Title - Full Width */}
        <div className="mb-6 md:mb-8">
          <h1 className="section-title text-center lg:text-left text-3xl md:text-4xl lg:text-5xl mb-2 md:mb-3">
            {event.title}
          </h1>
        </div>

        {/* Mobile: Image on top, Desktop: Image on left, Details on right */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 lg:gap-12 mb-8 md:mb-12">
          {/* Image Section */}
          <div className="rounded-2xl relative overflow-hidden group border border-white/10 bg-black shadow-lg">
            {event.image_path ? (
              <div className="relative w-full aspect-[4/3] min-h-[280px] sm:min-h-[350px] lg:min-h-[450px]">
                <SupabaseImage
                  src={event.image_path}
                  alt={event.title}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-700"
                  priority
                  bucket="events"
                />
              </div>
            ) : (
              <div className="aspect-[4/3] min-h-[280px] sm:min-h-[350px] lg:min-h-[450px] bg-gradient-to-br from-[#F59E0B]/30 to-[#F59E0B]/10 flex items-center justify-center">
                <Ticket className="h-16 w-16 md:h-20 md:w-20 text-[#F59E0B]/50" />
              </div>
            )}
          </div>

          {/* Event Details Section */}
          <div className="flex flex-col justify-center">
            <div className="card-premium">
              <h2 className="card-title mb-5 md:mb-6 text-[#F59E0B] text-xl md:text-2xl font-bold">Event Details</h2>
              <div className="space-y-5 md:space-y-6">
                <div className="flex items-start gap-4 md:gap-5">
                  <div className="bg-[#F59E0B]/10 rounded-xl p-3 md:p-3.5 border border-[#F59E0B]/20 flex-shrink-0">
                    <Calendar className="h-5 w-5 md:h-6 md:w-6 text-[#F59E0B]" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold body-text mb-1.5 text-sm md:text-base text-[#F59E0B]">Date</p>
                    <p className="body-text opacity-90 text-base md:text-lg font-medium">{formatFloridaDateDDMMYYYY(event.event_start)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 md:gap-5">
                  <div className="bg-[#F59E0B]/10 rounded-xl p-3 md:p-3.5 border border-[#F59E0B]/20 flex-shrink-0">
                    <Clock className="h-5 w-5 md:h-6 md:w-6 text-[#F59E0B]" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold body-text mb-1.5 text-sm md:text-base text-[#F59E0B]">Time</p>
                    <p className="body-text opacity-90 text-base md:text-lg font-medium">
                      {formatFloridaTime(event.event_start, 'h:mm a')}
                      {event.event_end && ` - ${formatFloridaTime(event.event_end, 'h:mm a')}`}
                    </p>
                  </div>
                </div>
                {event.location && (
                  <div className="flex items-start gap-4 md:gap-5">
                    <div className="bg-[#F59E0B]/10 rounded-xl p-3 md:p-3.5 border border-[#F59E0B]/20 flex-shrink-0">
                      <MapPin className="h-5 w-5 md:h-6 md:w-6 text-[#F59E0B]" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold body-text mb-1.5 text-sm md:text-base text-[#F59E0B]">Location</p>
                      <p className="body-text opacity-90 text-base md:text-lg font-medium">{event.location}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Description and Tickets Section - Side by Side on Desktop */}
        <div className={`grid grid-cols-1 ${event.description ? 'lg:grid-cols-2' : ''} gap-6 md:gap-8`}>
          {/* Description Section */}
          {event.description && (
            <div className="card-premium">
              <h3 className="card-title mb-5 md:mb-6 text-[#F59E0B] text-xl md:text-2xl font-bold">About This Event</h3>
              <div className="prose prose-invert max-w-none">
                <p className="body-text leading-relaxed text-base md:text-lg opacity-90 whitespace-pre-line">{event.description}</p>
              </div>
            </div>
          )}

          {/* Tickets Section */}
          <div className={`card-premium ${!event.description ? 'lg:max-w-2xl lg:mx-auto' : ''}`}>
            <h3 className="card-title mb-6 md:mb-8 flex items-center gap-3 md:gap-4 text-[#F59E0B] text-xl md:text-2xl font-bold">
              <div className="bg-[#F59E0B]/10 rounded-xl p-2.5 md:p-3 border border-[#F59E0B]/20">
                {event.action_button_type === 'reservation' ? (
                  <Calendar className="h-5 w-5 md:h-6 md:w-6 text-[#F59E0B]" />
                ) : (
                  <Ticket className="h-5 w-5 md:h-6 md:w-6 text-[#F59E0B]" />
                )}
              </div>
              {event.action_button_type === 'reservation' ? 'Reservations' : 'Tickets'}
            </h3>
            {(() => {
              const actionType = event.action_button_type || 'custom_tickets'

              // Case 1: Reservation
              if (actionType === 'reservation') {
                const eventStartFlorida = toFloridaTime(event.event_start)
                const reservationDate = format(eventStartFlorida, 'yyyy-MM-dd')
                const reservationTime = format(eventStartFlorida, 'HH:mm')

                return (
                  <div className="text-center py-6 md:py-8">
                    <div className="card-dark p-6 md:p-8 max-w-md mx-auto rounded-xl">
                      <Calendar className="h-10 w-10 md:h-12 md:w-12 mx-auto mb-4 text-[#F59E0B]" />
                      <h4 className="card-title mb-2 text-xl md:text-2xl font-bold">Reservations Recommended</h4>
                      <p className="body-text mb-6 text-sm md:text-base opacity-90">
                        Secure your spot for this event by making a reservation.
                      </p>
                      <Link
                        href={`/reservations?eventDate=${reservationDate}&eventTime=${reservationTime}`}
                        className="btn-amber w-full min-h-[48px] md:min-h-[52px] text-base md:text-lg inline-flex items-center justify-center touch-manipulation rounded-lg"
                      >
                        Make a Reservation
                      </Link>
                    </div>
                  </div>
                )
              }

              // Case 2: External Tickets
              if (actionType === 'external_tickets') {
                return (
                  <div className="text-center py-6 md:py-8">
                    <div className="card-dark p-6 md:p-8 max-w-md mx-auto">
                      <div className="bg-[#F59E0B]/10 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4">
                        <ExternalLink className="h-6 w-6 text-[#F59E0B]" />
                      </div>
                      <h4 className="card-title mb-2 text-xl md:text-2xl font-bold">Tickets Available</h4>
                      <p className="body-text mb-4 text-sm md:text-base">
                        Tickets for this event are handled by a partner site.
                      </p>
                      {event.ticket_link ? (
                        <>
                          <a
                            href={event.ticket_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-amber w-full min-h-[44px] md:min-h-[48px] text-sm md:text-base inline-flex items-center justify-center touch-manipulation"
                          >
                            Get Tickets <ExternalLink className="ml-2 h-4 w-4" />
                          </a>
                          <p className="body-text text-xs md:text-sm opacity-75 mt-4">
                            You will be redirected to the external ticketing website.
                          </p>
                        </>
                      ) : (
                        <p className="text-red-400 text-sm">Ticket link not configured.</p>
                      )}
                    </div>
                  </div>
                )
              }

              // Case 3: Internal / Owned Tickets (custom_tickets)
              // This logic handles both multi-ticket types and base price simple tickets

              if (event.event_tickets && event.event_tickets.length > 0) {
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                    {event.event_tickets.map((ticket: any) => {
                      const available = (ticket.quantity_total || 0) - ticket.quantity_sold
                      return (
                        <div key={ticket.id} className="card-dark p-5 md:p-6 hover:border-[#F59E0B]/50 hover:shadow-lg transition-all duration-300 rounded-xl">
                          <div className="mb-5">
                            <h4 className="card-title mb-3 text-lg md:text-xl font-bold">{ticket.name}</h4>
                            <p className="text-3xl md:text-4xl font-bold price-amber mb-3">
                              ${ticket.price.toFixed(2)}
                            </p>
                            {ticket.quantity_total && (
                              <p className="body-text text-sm md:text-base opacity-75">
                                {available} of {ticket.quantity_total} available
                              </p>
                            )}
                          </div>
                          <button
                            className="btn-amber w-full min-h-[48px] md:min-h-[52px] text-base md:text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation rounded-lg"
                            onClick={() => router.push(`/events/${encodeURIComponent(params.slug as string)}/purchase`)}
                            disabled={isPastEvent}
                          >
                            {isPastEvent ? 'Event Has Passed' : 'Buy Tickets'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )
              } else if (event.base_ticket_price && parseFloat(event.base_ticket_price.toString()) > 0) {
                return (
                  <div className="max-w-md mx-auto card-dark p-6 md:p-8 hover:border-[#F59E0B]/50 hover:shadow-lg transition-all duration-300 rounded-xl">
                    <div className="text-center mb-6">
                      <h4 className="card-title mb-4 text-xl md:text-2xl font-bold">General Admission</h4>
                      <p className="text-4xl md:text-5xl font-bold price-amber">
                        {event.ticket_currency === 'USD' ? '$' :
                          event.ticket_currency === 'EUR' ? '€' :
                            event.ticket_currency === 'GBP' ? '£' :
                              event.ticket_currency === 'CAD' ? 'C$' :
                                event.ticket_currency === 'AUD' ? 'A$' : '$'}
                        {parseFloat(event.base_ticket_price.toString()).toFixed(2)}
                      </p>
                    </div>
                    <button
                      className="btn-amber w-full min-h-[48px] md:min-h-[52px] text-base md:text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation rounded-lg"
                      onClick={() => router.push(`/events/${encodeURIComponent(params.slug as string)}/purchase`)}
                      disabled={isPastEvent}
                    >
                      {isPastEvent ? 'Event Has Passed' : 'Buy Tickets'}
                    </button>
                  </div>
                )
              } else {
                // Fallback for custom_tickets but no tickets configured
                return (
                  <div className="text-center py-8 md:py-12">
                    <div className="card-dark p-6 md:p-8 max-w-md mx-auto rounded-xl">
                      <Ticket className="h-12 w-12 md:h-16 md:w-16 mx-auto mb-4 text-[#F59E0B]/50" />
                      <p className="body-text mb-2 text-base md:text-lg font-medium">No tickets available online.</p>
                      <p className="body-text text-sm md:text-base opacity-75">
                        Please contact the venue for more information.
                      </p>
                    </div>
                  </div>
                )
              }
            })()}
          </div>
        </div>
      </div>
    </div>
  )
}
