import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Calendar, MapPin, Clock, ArrowRight, Music, Ticket } from 'lucide-react'
import { format } from 'date-fns'
import { getEvents } from '@/lib/queries'
import SupabaseImage from '@/components/SupabaseImage'
import AnimatedSection from '@/components/AnimatedSection'
import EventsTimeline from '@/components/EventsTimeline'

// Use ISR: Revalidate every 30 seconds for fresh events while still caching
export const revalidate = 30

export default async function EventsPage() {
  const allEvents = await getEvents()
  console.log(`[EventsPage] Total events fetched: ${allEvents.length}`)

  // Show all events (no filtering)
  const events = allEvents

  return (
    <div className="section-bg-primary section-spacing">
      <div className="container-global">
        <div className="text-center mb-16 md:mb-20">
          <h1 className="section-title mb-4 text-gradient-amber">
            MUSIC & EVENTS
          </h1>
          <div className="section-divider-enhanced mb-6"></div>
          <p className="body-text max-w-3xl mx-auto text-lg opacity-90">
            Join us for amazing live music performances and special events throughout the week.
          </p>
        </div>

        {/* Timeline Events Listing */}
        <div>
          <EventsTimeline events={events} />
        </div>
      </div>
    </div>
  )
}

