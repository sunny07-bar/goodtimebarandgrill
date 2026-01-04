'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Ticket, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { getEventBySlug } from '@/lib/queries'
import AnimatedSection from '@/components/AnimatedSection'
import EmailVerification from '@/components/EmailVerification'

export default function TicketPurchasePage() {
  const params = useParams()
  const router = useRouter()
  const [event, setEvent] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState(false)
  const [ticketQuantities, setTicketQuantities] = useState<Record<string, number>>({})
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    email: '',
    phone: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [showEmailVerification, setShowEmailVerification] = useState(false)
  const [emailVerified, setEmailVerified] = useState(false)

  useEffect(() => {
    loadEvent()
  }, [params.slug])

  // Check if email is already verified (from database or localStorage)
  useEffect(() => {
    const checkEmailVerification = async () => {
      if (!customerInfo.email) {
        setEmailVerified(false)
        return
      }

      // First check database
      try {
        const response = await fetch('/api/email/check-verified', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: customerInfo.email }),
        })

        const data = await response.json()
        if (data.verified) {
          setEmailVerified(true)
          // Also store in localStorage for faster subsequent checks
          if (typeof window !== 'undefined') {
            const verificationKey = `email_verified_${customerInfo.email.toLowerCase()}`
            localStorage.setItem(verificationKey, Date.now().toString())
          }
          return
        }
      } catch (err) {
        console.error('Error checking email verification:', err)
      }

      // Fallback to localStorage check
      if (typeof window !== 'undefined') {
        const verificationKey = `email_verified_${customerInfo.email.toLowerCase()}`
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
  }, [customerInfo.email])

  const loadEvent = async () => {
    try {
      const eventData = await getEventBySlug(params.slug as string)
      if (eventData) {
        setEvent(eventData)
        // Initialize quantities
        const initialQuantities: Record<string, number> = {}
        if (eventData.event_tickets && eventData.event_tickets.length > 0) {
          eventData.event_tickets.forEach((ticket: any) => {
            initialQuantities[ticket.id] = 0
          })
        } else if (eventData.base_ticket_price) {
          // Initialize base ticket quantity
          initialQuantities['base'] = 0
        }
        setTicketQuantities(initialQuantities)
      }
    } catch (err) {
      setError('Failed to load event')
    } finally {
      setLoading(false)
    }
  }

  const updateQuantity = (ticketId: string, change: number) => {
    setTicketQuantities((prev) => {
      const current = prev[ticketId] || 0
      const ticket = event?.event_tickets?.find((t: any) => t.id === ticketId)
      const available = ticket ? (ticket.quantity_total || 999999) - ticket.quantity_sold : 0
      const newQuantity = Math.max(0, Math.min(available, current + change))
      return { ...prev, [ticketId]: newQuantity }
    })
  }

  const calculateTotal = () => {
    let total = 0
    if (event?.event_tickets && event.event_tickets.length > 0) {
      event.event_tickets.forEach((ticket: any) => {
        const quantity = ticketQuantities[ticket.id] || 0
        total += parseFloat(ticket.price.toString()) * quantity
      })
    } else if (event?.base_ticket_price) {
      // Use base ticket price if no ticket types are defined
      const baseQuantity = ticketQuantities['base'] || 0
      total += parseFloat(event.base_ticket_price.toString()) * baseQuantity
    }
    return total
  }

  const getTotalTickets = () => {
    return Object.values(ticketQuantities).reduce((sum, qty) => sum + qty, 0)
  }

  const updateBaseQuantity = (change: number) => {
    setTicketQuantities((prev) => {
      const current = prev['base'] || 0
      const newQuantity = Math.max(0, current + change)
      return { ...prev, base: newQuantity }
    })
  }

  const handlePurchase = async () => {
    if (!customerInfo.name || !customerInfo.email) {
      setError('Please fill in your name and email')
      return
    }

    const tickets = Object.entries(ticketQuantities)
      .filter(([_, qty]) => qty > 0)
      .map(([ticketTypeId, quantity]) => ({ ticketTypeId, quantity }))

    if (tickets.length === 0) {
      setError('Please select at least one ticket')
      return
    }

    // Check if email is verified (database check happens in useEffect)
    if (!emailVerified) {
      // Show email verification step
      setShowEmailVerification(true)
      setError(null)
      return
    }

    // Email is verified, proceed with purchase
    proceedWithPurchase(tickets)
  }

  const handleEmailVerified = () => {
    setEmailVerified(true)
    setShowEmailVerification(false)
    // Store verification status in localStorage for faster subsequent checks
    // Database already stores it for 30 days
    if (typeof window !== 'undefined') {
      const verificationKey = `email_verified_${customerInfo.email.toLowerCase()}`
      localStorage.setItem(verificationKey, Date.now().toString())
    }
    // Proceed with purchase after verification
    const tickets = Object.entries(ticketQuantities)
      .filter(([_, qty]) => qty > 0)
      .map(([ticketTypeId, quantity]) => ({ ticketTypeId, quantity }))
    proceedWithPurchase(tickets)
  }

  const proceedWithPurchase = async (tickets: any[]) => {
    setPurchasing(true)
    setError(null)

    try {
      const response = await fetch('/api/tickets/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: event.id,
          tickets,
          customerName: customerInfo.name,
          customerEmail: customerInfo.email,
          customerPhone: customerInfo.phone,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to purchase tickets')
      }

      // Check if payment is required
      if (data.paymentRequired && data.paymentUrl && total > 0) {
        // Redirect to payment page
        window.location.href = data.paymentUrl
        return
      }

      // For free tickets ($0), create tickets immediately
      if (total === 0) {
        // Complete the purchase without payment
        const completeResponse = await fetch('/api/tickets/complete-purchase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: data.order.id,
            paymentTransactionId: 'free-ticket',
            paymentMethod: 'free',
            tickets: tickets,
          }),
        })

        if (!completeResponse.ok) {
          const errorData = await completeResponse.json()
          throw new Error(errorData.error || 'Failed to complete ticket purchase')
        }

        // Send email with tickets (handled by complete-purchase route now)
        // Email will be sent automatically after ticket creation

        // Redirect to ticket confirmation page
        router.push(`/events/${encodeURIComponent(params.slug as string)}/tickets/${data.order.id}`)
      } else {
        // This shouldn't happen, but handle it
        throw new Error('Payment required but no payment URL provided')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to purchase tickets')
      setPurchasing(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-red-600" />
        <p>Loading event...</p>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-600" />
        <p>Event not found</p>
      </div>
    )
  }

  const total = calculateTotal()
  const totalTickets = getTotalTickets()

  return (
      <div className="section-bg-primary section-spacing">
        <div className="container-global">
          <AnimatedSection direction="down">
            <div className="text-center mb-8 md:mb-12">
              <h1 className="section-title mb-4 text-gradient-amber">
                Purchase Tickets
              </h1>
              <div className="section-divider mb-6"></div>
              <h2 className="text-xl md:text-2xl font-semibold price-amber">{event.title}</h2>
            </div>
          </AnimatedSection>

          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
            {/* Ticket Selection */}
            <div className="lg:col-span-2">
              <AnimatedSection direction="up">
                <div className="card-premium">
                  <h3 className="card-title mb-6 flex items-center gap-2 text-[#F59E0B]">
                    <Ticket className="h-5 w-5 md:h-6 md:w-6" />
                    Select Tickets
                  </h3>

                  {event.event_tickets && event.event_tickets.length > 0 ? (
                    <div className="space-y-4 md:space-y-6">
                      {event.event_tickets.map((ticket: any) => {
                        const available = (ticket.quantity_total || 999999) - ticket.quantity_sold
                        const quantity = ticketQuantities[ticket.id] || 0

                        return (
                          <div
                            key={ticket.id}
                            className="card-dark p-4 md:p-6 hover:border-[#F59E0B]/50 transition-all"
                          >
                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4">
                              <div className="flex-1">
                                <h4 className="card-title text-lg md:text-xl mb-2">{ticket.name}</h4>
                                <p className="text-2xl md:text-3xl font-extrabold price-amber">
                                  ${parseFloat(ticket.price.toString()).toFixed(2)}
                                </p>
                              </div>
                              {ticket.quantity_total && (
                                <span className="px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded-full text-xs md:text-sm font-semibold self-start">
                                  {available} left
                                </span>
                              )}
                            </div>

                            {available > 0 ? (
                              <div className="flex items-center gap-3 md:gap-4">
                                <button
                                  onClick={() => updateQuantity(ticket.id, -1)}
                                  disabled={quantity === 0}
                                  className="min-h-[40px] md:min-h-[44px] min-w-[40px] md:min-w-[44px] rounded-lg border border-white/20 bg-[#111111] hover:bg-[#F59E0B]/10 hover:border-[#F59E0B]/40 text-white transition-all touch-manipulation flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed text-lg md:text-xl"
                                >
                                  −
                                </button>
                                <span className="text-xl md:text-2xl font-bold w-10 md:w-12 text-center">{quantity}</span>
                                <button
                                  onClick={() => updateQuantity(ticket.id, 1)}
                                  disabled={quantity >= available}
                                  className="min-h-[40px] md:min-h-[44px] min-w-[40px] md:min-w-[44px] rounded-lg border border-white/20 bg-[#111111] hover:bg-[#F59E0B]/10 hover:border-[#F59E0B]/40 text-white transition-all touch-manipulation flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed text-lg md:text-xl"
                                >
                                  +
                                </button>
                                <span className="ml-auto text-base md:text-lg font-semibold price-amber">
                                  ${(parseFloat(ticket.price.toString()) * quantity).toFixed(2)}
                                </span>
                              </div>
                            ) : (
                              <p className="text-red-400 font-semibold">Sold Out</p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ) : event.base_ticket_price ? (
                    <div className="card-dark p-4 md:p-6 hover:border-[#F59E0B]/50 transition-all">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4">
                        <div className="flex-1">
                          <h4 className="card-title text-lg md:text-xl mb-2">General Admission</h4>
                          <p className="text-2xl md:text-3xl font-extrabold price-amber">
                            {event.ticket_currency === 'USD' ? '$' : 
                             event.ticket_currency === 'EUR' ? '€' :
                             event.ticket_currency === 'GBP' ? '£' :
                             event.ticket_currency === 'CAD' ? 'C$' :
                             event.ticket_currency === 'AUD' ? 'A$' : '$'}
                            {parseFloat(event.base_ticket_price.toString()).toFixed(2)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 md:gap-4">
                        <button
                          onClick={() => updateBaseQuantity(-1)}
                          disabled={(ticketQuantities['base'] || 0) === 0}
                          className="min-h-[40px] md:min-h-[44px] min-w-[40px] md:min-w-[44px] rounded-lg border border-white/20 bg-[#111111] hover:bg-[#F59E0B]/10 hover:border-[#F59E0B]/40 text-white transition-all touch-manipulation flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed text-lg md:text-xl"
                        >
                          −
                        </button>
                        <span className="text-xl md:text-2xl font-bold w-10 md:w-12 text-center">{ticketQuantities['base'] || 0}</span>
                        <button
                          onClick={() => updateBaseQuantity(1)}
                          className="min-h-[40px] md:min-h-[44px] min-w-[40px] md:min-w-[44px] rounded-lg border border-white/20 bg-[#111111] hover:bg-[#F59E0B]/10 hover:border-[#F59E0B]/40 text-white transition-all touch-manipulation flex items-center justify-center text-lg md:text-xl"
                        >
                          +
                        </button>
                        <span className="ml-auto text-base md:text-lg font-semibold price-amber">
                          {event.ticket_currency === 'USD' ? '$' : 
                           event.ticket_currency === 'EUR' ? '€' :
                           event.ticket_currency === 'GBP' ? '£' :
                           event.ticket_currency === 'CAD' ? 'C$' :
                           event.ticket_currency === 'AUD' ? 'A$' : '$'}
                          {(parseFloat(event.base_ticket_price.toString()) * (ticketQuantities['base'] || 0)).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-center py-8 body-text opacity-75">No tickets available</p>
                  )}
                </div>
              </AnimatedSection>

              {/* Customer Information */}
              <AnimatedSection direction="up" delay={200}>
                <div className="card-premium mt-6">
                  <h3 className="card-title mb-6 text-[#F59E0B]">Your Information</h3>
                  <div className="space-y-4 md:space-y-5">
                    <div>
                      <Label htmlFor="name" className="body-text font-semibold mb-2 block text-sm md:text-base">
                        Full Name *
                      </Label>
                      <Input
                        id="name"
                        required
                        value={customerInfo.name}
                        onChange={(e) =>
                          setCustomerInfo({ ...customerInfo, name: e.target.value })
                        }
                        className="form-input-premium h-11 md:h-12 text-sm md:text-base"
                        placeholder="John Doe"
                      />
                    </div>
                    <div>
                      <Label htmlFor="email" className="body-text font-semibold mb-2 block text-sm md:text-base">
                        Email *
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        required
                        value={customerInfo.email}
                        onChange={(e) => {
                          const newEmail = e.target.value
                          setCustomerInfo({ ...customerInfo, email: newEmail })
                          // Reset verification if email changes
                          if (newEmail !== customerInfo.email) {
                            setEmailVerified(false)
                            setShowEmailVerification(false)
                            if (typeof window !== 'undefined') {
                              localStorage.removeItem(`email_verified_${customerInfo.email.toLowerCase()}`)
                            }
                          }
                        }}
                        className="form-input-premium h-11 md:h-12 text-sm md:text-base"
                        placeholder="john@example.com"
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone" className="body-text font-semibold mb-2 block text-sm md:text-base">
                        Phone
                      </Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={customerInfo.phone}
                        onChange={(e) =>
                          setCustomerInfo({ ...customerInfo, phone: e.target.value })
                        }
                        className="form-input-premium h-11 md:h-12 text-sm md:text-base"
                        placeholder="(321) 555-0123"
                      />
                    </div>
                  </div>

                  {/* Email Verification Step */}
                  {showEmailVerification && customerInfo.email && (
                    <div className="mt-6 p-4 md:p-6 border-2 border-blue-400/30 rounded-xl bg-blue-500/10">
                      <EmailVerification
                        email={customerInfo.email}
                        onVerified={handleEmailVerified}
                        onCancel={() => setShowEmailVerification(false)}
                      />
                    </div>
                  )}

                  {emailVerified && customerInfo.email && (
                    <div className="mt-4 p-4 bg-green-500/10 border border-green-400/30 rounded-lg">
                      <div className="flex items-center gap-2 text-green-400">
                        <CheckCircle className="h-5 w-5" />
                        <span className="font-semibold">Email verified</span>
                      </div>
                    </div>
                  )}
                </div>
              </AnimatedSection>
            </div>

            {/* Order Summary */}
            <div>
              <AnimatedSection direction="up" delay={300}>
                <div className="card-premium sticky top-4 sm:top-8">
                  <h3 className="card-title mb-6 text-[#F59E0B]">Order Summary</h3>

                  <div className="space-y-3 mb-6">
                    {event.event_tickets
                      ?.filter((ticket: any) => (ticketQuantities[ticket.id] || 0) > 0)
                      .map((ticket: any) => {
                        const quantity = ticketQuantities[ticket.id] || 0
                        const price = parseFloat(ticket.price.toString()) * quantity
                        return (
                          <div key={ticket.id} className="flex justify-between body-text text-sm md:text-base">
                            <span>
                              {ticket.name} × {quantity}
                            </span>
                            <span className="font-semibold">${price.toFixed(2)}</span>
                          </div>
                        )
                      })}
                  </div>

                  <div className="border-t border-white/10 pt-4 mb-6">
                    <div className="flex justify-between text-lg md:text-xl font-bold">
                      <span>Total</span>
                      <span className="price-amber">${total.toFixed(2)}</span>
                    </div>
                    {totalTickets > 0 && (
                      <p className="body-text text-xs md:text-sm mt-2 opacity-75">
                        {totalTickets} ticket{totalTickets !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>

                  {error && (
                    <div className="mb-4 p-4 bg-red-500/10 border-2 border-red-400/30 rounded-lg">
                      <p className="text-red-400 text-sm">{error}</p>
                    </div>
                  )}

                  <button
                    onClick={handlePurchase}
                    disabled={purchasing || totalTickets === 0 || showEmailVerification}
                    className="btn-amber w-full min-h-[48px] md:min-h-[52px] text-base md:text-lg font-bold touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {purchasing ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin inline" />
                        Processing...
                      </>
                    ) : showEmailVerification ? (
                      'Please verify your email first'
                    ) : (
                      <>
                        <CheckCircle className="mr-2 h-5 w-5 inline" />
                        Purchase Tickets
                      </>
                    )}
                  </button>

                  <p className="body-text text-xs md:text-sm mt-4 text-center opacity-75">
                    You'll receive your tickets via email after purchase
                  </p>
                </div>
              </AnimatedSection>
            </div>
          </div>
        </div>
      </div>
    )
  }

