'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Ticket, Loader2, CheckCircle, AlertCircle, Tag, Sparkles, Lock, ArrowLeft, Users } from 'lucide-react'
import { getEventBySlug, getEventPromotions } from '@/lib/queries'
import AnimatedSection from '@/components/AnimatedSection'
import EmailVerification from '@/components/EmailVerification'
import { calculateTicketPromotions, TicketCartItem, PromotionRule } from '@/lib/utils/promotions'

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

  // Promotion and coupon state
  const [promotions, setPromotions] = useState<PromotionRule[]>([])
  const [promoCodeInput, setPromoCodeInput] = useState('')
  const [appliedPromoCode, setAppliedPromoCode] = useState('')
  const [promoError, setPromoError] = useState<string | null>(null)

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

        // Fetch promotions for this event
        try {
          const promoData = await getEventPromotions(eventData.id)
          setPromotions(promoData || [])
        } catch (e) {
          console.log('Promotions fetch error or table unmigrated:', e)
        }

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

  const updateBaseQuantity = (change: number) => {
    setTicketQuantities((prev) => {
      const current = prev['base'] || 0
      const newQuantity = Math.max(0, current + change)
      return { ...prev, base: newQuantity }
    })
  }

  const getTotalTickets = () => {
    return Object.values(ticketQuantities).reduce((sum, qty) => sum + qty, 0)
  }

  // Format cart items for promotion engine
  const cartItems: TicketCartItem[] = useMemo(() => {
    if (!event) return []
    const items: TicketCartItem[] = []
    if (event.event_tickets && event.event_tickets.length > 0) {
      event.event_tickets.forEach((ticket: any) => {
        const qty = ticketQuantities[ticket.id] || 0
        if (qty > 0) {
          items.push({
            ticketTypeId: ticket.id,
            name: ticket.name,
            price: parseFloat(ticket.price.toString()),
            quantity: qty,
          })
        }
      })
    } else if (event.base_ticket_price) {
      const qty = ticketQuantities['base'] || 0
      if (qty > 0) {
        items.push({
          ticketTypeId: 'base',
          name: 'General Admission',
          price: parseFloat(event.base_ticket_price.toString()),
          quantity: qty,
        })
      }
    }
    return items
  }, [event, ticketQuantities])

  // Run promotion calculation (BOGO, %, fixed discount)
  const promoCalculation = useMemo(() => {
    return calculateTicketPromotions(cartItems, promotions, appliedPromoCode)
  }, [cartItems, promotions, appliedPromoCode])

  const handleApplyPromoCode = () => {
    setPromoError(null)
    const code = promoCodeInput.trim().toUpperCase()
    if (!code) {
      setPromoError('Please enter a coupon code')
      return
    }

    const testCalc = calculateTicketPromotions(cartItems, promotions, code)
    if (testCalc.appliedPromotion && testCalc.appliedPromotion.promo_code?.toUpperCase() === code) {
      setAppliedPromoCode(code)
      setPromoError(null)
    } else {
      const matchingPromo = promotions.find(p => p.promo_code?.toUpperCase() === code)
      if (!matchingPromo) {
        setPromoError('Invalid coupon code')
      } else {
        const minReq = matchingPromo.min_tickets_required || 1
        setPromoError(`This promo requires selecting at least ${minReq} ticket(s)`)
      }
    }
  }

  const handleRemovePromoCode = () => {
    setAppliedPromoCode('')
    setPromoCodeInput('')
    setPromoError(null)
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
    if (typeof window !== 'undefined') {
      const verificationKey = `email_verified_${customerInfo.email.toLowerCase()}`
      localStorage.setItem(verificationKey, Date.now().toString())
    }
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
          promoCode: appliedPromoCode || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to purchase tickets')
      }

      // Check if payment is required
      if (data.paymentRequired && data.paymentUrl && promoCalculation.finalTotal > 0) {
        window.location.href = data.paymentUrl
        return
      }

      // For free tickets ($0, e.g. 100% discount, complimentary)
      if (promoCalculation.finalTotal === 0) {
        const completeResponse = await fetch('/api/tickets/complete-purchase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: data.order.id,
            paymentTransactionId: 'free-promotion',
            paymentMethod: 'promotion',
            tickets: tickets,
          }),
        })

        if (!completeResponse.ok) {
          const errorData = await completeResponse.json()
          throw new Error(errorData.error || 'Failed to complete ticket purchase')
        }

        router.push(`/events/${encodeURIComponent(params.slug as string)}/tickets/${data.order.id}`)
      } else {
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

  const total = promoCalculation.finalTotal
  const totalTickets = getTotalTickets()

  return (
    <div className="section-bg-primary py-8 md:py-12 min-h-screen">
      <div className="container-global max-w-6xl">
        {/* Top Navigation & Breadcrumb */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-white/10">
          <Link
            href={`/events/${params.slug}`}
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-[#F59E0B] transition-colors w-fit"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Event Details</span>
          </Link>
          <div className="flex items-center gap-2 text-xs md:text-sm text-gray-400">
            <span className="font-semibold text-white truncate max-w-xs">{event.title}</span>
            <span>•</span>
            <span className="text-[#F59E0B] font-medium">Checkout</span>
          </div>
        </div>

        {/* Promotion Highlight Banner if promotions exist */}
        {promotions.length > 0 && (
          <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-[#F59E0B]/15 to-purple-500/10 border border-[#F59E0B]/30 shadow-lg">
            <div className="flex items-center gap-2 text-[#F59E0B] font-bold text-sm md:text-base mb-2">
              <Sparkles className="h-4 w-4 shrink-0 text-[#F59E0B]" />
              <span>Active Promotions & Offers for this Event</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {promotions.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-black/40 border border-white/10 text-xs md:text-sm"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Tag className="h-3.5 w-3.5 text-[#F59E0B] shrink-0" />
                    <span className="text-gray-200 truncate font-medium">{p.name}</span>
                  </div>
                  {p.promo_code ? (
                    <button
                      type="button"
                      onClick={() => {
                        setPromoCodeInput(p.promo_code || '')
                        setAppliedPromoCode(p.promo_code || '')
                        setPromoError(null)
                      }}
                      className="px-2.5 py-1 rounded-lg bg-[#F59E0B]/20 hover:bg-[#F59E0B]/30 border border-[#F59E0B]/40 text-[#F59E0B] text-xs font-mono font-bold shrink-0 transition-colors cursor-pointer"
                      title="Click to apply code"
                    >
                      {appliedPromoCode === p.promo_code ? 'Applied ✓' : `Apply: ${p.promo_code}`}
                    </button>
                  ) : (
                    <span className="text-emerald-400 text-xs font-medium shrink-0 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                      Auto Deal
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Main Grid: 2 Columns on Desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* Left Column (Tickets & Contact Info): 7 cols */}
          <div className="lg:col-span-7 space-y-6">
            {/* Step 1: Select Tickets */}
            <div className="card-premium">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
                <h3 className="card-title text-lg md:text-xl flex items-center gap-2.5 text-white">
                  <div className="w-7 h-7 rounded-lg bg-[#F59E0B]/10 border border-[#F59E0B]/30 flex items-center justify-center text-[#F59E0B]">
                    <Ticket className="h-4 w-4" />
                  </div>
                  <span>1. Select Tickets</span>
                </h3>
                {totalTickets > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/30">
                    {totalTickets} selected
                  </span>
                )}
              </div>

              {event.event_tickets && event.event_tickets.length > 0 ? (
                <div className="space-y-3">
                  {event.event_tickets.map((ticket: any) => {
                    const available = (ticket.quantity_total || 999999) - ticket.quantity_sold
                    const quantity = ticketQuantities[ticket.id] || 0
                    const isSoldOut = available <= 0

                    return (
                      <div
                        key={ticket.id}
                        className={`p-4 rounded-xl border transition-all ${
                          quantity > 0
                            ? 'bg-[#151515] border-[#F59E0B]/50 shadow-md'
                            : 'bg-[#111111] border-white/10 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3 mb-3">
                          <div>
                            <h4 className="text-base md:text-lg font-bold text-white flex items-center gap-2">
                              {ticket.name}
                              {ticket.quantity_total && !isSoldOut && (
                                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20">
                                  {available} left
                                </span>
                              )}
                              {isSoldOut && (
                                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20">
                                  Sold Out
                                </span>
                              )}
                            </h4>
                            {ticket.description && (
                              <p className="text-xs text-gray-400 mt-0.5">{ticket.description}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="text-xl md:text-2xl font-black text-[#F59E0B]">
                              ${parseFloat(ticket.price.toString()).toFixed(2)}
                            </span>
                            <span className="text-xs text-gray-400 block">/ ticket</span>
                          </div>
                        </div>

                        {!isSoldOut ? (
                          <div className="flex items-center justify-between pt-3 border-t border-white/5">
                            <span className="text-xs text-gray-400 font-medium">Quantity</span>
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => updateQuantity(ticket.id, -1)}
                                disabled={quantity === 0}
                                className="w-9 h-9 rounded-lg border border-white/20 bg-black/40 hover:bg-[#F59E0B]/20 hover:border-[#F59E0B]/50 text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-all text-lg font-bold cursor-pointer"
                              >
                                −
                              </button>
                              <span className="text-lg font-bold text-white w-8 text-center tabular-nums">
                                {quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateQuantity(ticket.id, 1)}
                                disabled={quantity >= available}
                                className="w-9 h-9 rounded-lg border border-white/20 bg-black/40 hover:bg-[#F59E0B]/20 hover:border-[#F59E0B]/50 text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-all text-lg font-bold cursor-pointer"
                              >
                                +
                              </button>
                              <span className="text-sm font-bold text-[#F59E0B] w-20 text-right tabular-nums">
                                ${(parseFloat(ticket.price.toString()) * quantity).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-red-400 font-medium">This ticket tier is sold out</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : event.base_ticket_price ? (
                <div className="p-4 rounded-xl border bg-[#151515] border-white/10">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div>
                      <h4 className="text-base md:text-lg font-bold text-white">General Admission</h4>
                    </div>
                    <div className="text-right">
                      <span className="text-xl md:text-2xl font-black text-[#F59E0B]">
                        ${parseFloat(event.base_ticket_price.toString()).toFixed(2)}
                      </span>
                      <span className="text-xs text-gray-400 block">/ ticket</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-white/5">
                    <span className="text-xs text-gray-400 font-medium">Quantity</span>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => updateBaseQuantity(-1)}
                        disabled={(ticketQuantities['base'] || 0) === 0}
                        className="w-9 h-9 rounded-lg border border-white/20 bg-black/40 hover:bg-[#F59E0B]/20 hover:border-[#F59E0B]/50 text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-all text-lg font-bold cursor-pointer"
                      >
                        −
                      </button>
                      <span className="text-lg font-bold text-white w-8 text-center tabular-nums">
                        {ticketQuantities['base'] || 0}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateBaseQuantity(1)}
                        className="w-9 h-9 rounded-lg border border-white/20 bg-black/40 hover:bg-[#F59E0B]/20 hover:border-[#F59E0B]/50 text-white flex items-center justify-center transition-all text-lg font-bold cursor-pointer"
                      >
                        +
                      </button>
                      <span className="text-sm font-bold text-[#F59E0B] w-20 text-right tabular-nums">
                        ${(parseFloat(event.base_ticket_price.toString()) * (ticketQuantities['base'] || 0)).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-center py-6 text-gray-400 text-sm">No tickets available for this event</p>
              )}
            </div>

            {/* Step 2: Contact Details */}
            <div className="card-premium">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
                <h3 className="card-title text-lg md:text-xl flex items-center gap-2.5 text-white">
                  <div className="w-7 h-7 rounded-lg bg-[#F59E0B]/10 border border-[#F59E0B]/30 flex items-center justify-center text-[#F59E0B]">
                    <Users className="h-4 w-4" />
                  </div>
                  <span>2. Contact Details</span>
                </h3>
                <span className="text-xs text-gray-400 font-medium">Tickets sent by email</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name" className="text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1.5 block">
                    Full Name *
                  </Label>
                  <input
                    id="name"
                    type="text"
                    required
                    value={customerInfo.name}
                    onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                    className="w-full h-11 px-3.5 rounded-xl bg-[#141414] border border-white/15 focus:border-[#F59E0B] focus:ring-1 focus:ring-[#F59E0B] text-white text-sm placeholder-gray-500 transition-all outline-none"
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-gray-300">
                      Email Address *
                    </Label>
                    {emailVerified && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-semibold">
                        <CheckCircle className="w-3.5 h-3.5" /> Verified
                      </span>
                    )}
                  </div>
                  <input
                    id="email"
                    type="email"
                    required
                    value={customerInfo.email}
                    onChange={(e) => {
                      const newEmail = e.target.value
                      setCustomerInfo({ ...customerInfo, email: newEmail })
                      if (newEmail !== customerInfo.email) {
                        setEmailVerified(false)
                        setShowEmailVerification(false)
                        if (typeof window !== 'undefined') {
                          localStorage.removeItem(`email_verified_${customerInfo.email.toLowerCase()}`)
                        }
                      }
                    }}
                    className="w-full h-11 px-3.5 rounded-xl bg-[#141414] border border-white/15 focus:border-[#F59E0B] focus:ring-1 focus:ring-[#F59E0B] text-white text-sm placeholder-gray-500 transition-all outline-none"
                    placeholder="john@example.com"
                  />
                </div>

                <div className="sm:col-span-2">
                  <Label htmlFor="phone" className="text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1.5 block">
                    Phone Number <span className="text-gray-500 normal-case">(Optional, for SMS updates)</span>
                  </Label>
                  <input
                    id="phone"
                    type="tel"
                    value={customerInfo.phone}
                    onChange={(e) => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
                    className="w-full h-11 px-3.5 rounded-xl bg-[#141414] border border-white/15 focus:border-[#F59E0B] focus:ring-1 focus:ring-[#F59E0B] text-white text-sm placeholder-gray-500 transition-all outline-none"
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>

              {/* Email Verification Step */}
              {showEmailVerification && customerInfo.email && (
                <div className="mt-4 p-4 rounded-xl border border-blue-400/40 bg-blue-500/10">
                  <EmailVerification
                    email={customerInfo.email}
                    onVerified={handleEmailVerified}
                    onCancel={() => setShowEmailVerification(false)}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Right Column (Sticky Order Summary): 5 cols */}
          <div className="lg:col-span-5">
            <div className="card-premium sticky top-6 shadow-2xl border border-white/15 bg-gradient-to-b from-[#141414] to-[#0d0d0d]">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
                <h3 className="card-title text-lg md:text-xl font-bold text-white flex items-center gap-2">
                  <Lock className="w-4 h-4 text-[#F59E0B]" />
                  <span>Order Summary</span>
                </h3>
                <span className="text-xs text-gray-400">Secure Checkout</span>
              </div>

              {/* Selected Items */}
              <div className="space-y-2.5 mb-4">
                {cartItems.length > 0 ? (
                  cartItems.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-sm">
                      <span className="text-gray-300 font-medium">
                        {item.name} <span className="text-gray-500 font-normal">× {item.quantity}</span>
                      </span>
                      <span className="font-semibold text-white">
                        ${(item.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-gray-500 italic text-center py-3 bg-black/20 rounded-lg">
                    Select tickets on the left to see summary
                  </p>
                )}
              </div>

              {/* Coupon / Promo Code Input */}
              <div className="border-t border-white/10 pt-4 mb-4">
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-2">
                  Promo / Coupon Code
                </label>

                {appliedPromoCode ? (
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="font-mono font-bold text-xs text-emerald-300 tracking-wider">
                        {appliedPromoCode}
                      </span>
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded uppercase">
                        Applied
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemovePromoCode}
                      className="text-xs text-red-400 hover:text-red-300 font-medium hover:underline cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="rounded-xl border border-white/15 focus-within:border-[#F59E0B] bg-[#161616] p-1 flex items-center transition-all">
                    <Tag className="w-4 h-4 text-gray-400 ml-2.5 mr-2 shrink-0" />
                    <input
                      type="text"
                      value={promoCodeInput}
                      onChange={(e) => {
                        setPromoCodeInput(e.target.value.toUpperCase())
                        if (promoError) setPromoError(null)
                      }}
                      placeholder="ENTER COUPON CODE"
                      className="bg-transparent border-none text-white text-xs md:text-sm font-mono tracking-wider focus:outline-none focus:ring-0 w-full placeholder:text-gray-500 placeholder:font-sans py-1.5"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleApplyPromoCode()
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleApplyPromoCode}
                      disabled={!promoCodeInput.trim()}
                      className="px-3.5 py-1.5 rounded-lg bg-[#F59E0B] hover:bg-[#d97706] disabled:opacity-30 disabled:hover:bg-[#F59E0B] text-black text-xs font-bold transition-all shrink-0 cursor-pointer disabled:cursor-not-allowed"
                    >
                      Apply
                    </button>
                  </div>
                )}

                {promoError && (
                  <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {promoError}
                  </p>
                )}
              </div>

              {/* Automatic Promotion Applied Banner */}
              {promoCalculation.appliedPromotion && !appliedPromoCode && (
                <div className="mb-4 p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-purple-300 font-semibold">
                    <Sparkles className="w-3.5 h-3.5 text-[#F59E0B]" />
                    <span>{promoCalculation.appliedPromotion.name}</span>
                  </div>
                  <span className="text-emerald-400 font-bold">Auto Deal</span>
                </div>
              )}

              {/* Price Calculation Breakdown */}
              <div className="border-t border-white/10 pt-3.5 mb-5 space-y-2">
                <div className="flex justify-between text-sm text-gray-300">
                  <span>Subtotal</span>
                  <span className="font-semibold text-white">${promoCalculation.subtotal.toFixed(2)}</span>
                </div>

                {promoCalculation.discountAmount > 0 && (
                  <div className="flex justify-between text-sm text-emerald-400 font-semibold">
                    <span className="flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 inline shrink-0" />
                      {promoCalculation.appliedPromotion?.name || 'Discount'}
                    </span>
                    <span>-${promoCalculation.discountAmount.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between items-baseline pt-2.5 border-t border-white/10">
                  <div>
                    <span className="text-base font-bold text-white block">Total</span>
                    {totalTickets > 0 && (
                      <span className="text-xs text-gray-400 font-normal">
                        {totalTickets} ticket{totalTickets !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <span className="text-2xl md:text-3xl font-black text-[#F59E0B] tracking-tight">
                    ${promoCalculation.finalTotal.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Error Alert */}
              {error && (
                <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-red-400 text-xs font-medium">{error}</p>
                </div>
              )}

              {/* Purchase Button */}
              <button
                type="button"
                onClick={handlePurchase}
                disabled={purchasing || totalTickets === 0 || showEmailVerification}
                className="w-full h-12 md:h-14 rounded-xl bg-[#F59E0B] hover:bg-[#d97706] text-black font-extrabold text-base transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-[#F59E0B]/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {purchasing ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Processing Order...</span>
                  </>
                ) : showEmailVerification ? (
                  <span>Verify Email to Continue</span>
                ) : (
                  <>
                    <Lock className="h-4 w-4" />
                    <span>Purchase Tickets (${promoCalculation.finalTotal.toFixed(2)})</span>
                  </>
                )}
              </button>

              {/* Security & Delivery Notice */}
              <div className="mt-4 pt-3 border-t border-white/5 text-center">
                <p className="text-[11px] text-gray-400 flex items-center justify-center gap-1.5">
                  <Lock className="w-3 h-3 text-[#F59E0B]" />
                  <span>256-bit SSL encrypted • Tickets delivered instantly via email</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

