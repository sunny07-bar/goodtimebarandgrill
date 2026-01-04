'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter, useParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, CreditCard, AlertCircle, Ticket, Lock } from 'lucide-react'

function TicketPaymentPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const params = useParams()
  const orderId = searchParams.get('orderId')
  const amount = searchParams.get('amount')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [customerEmail, setCustomerEmail] = useState<string>('')
  const [customerName, setCustomerName] = useState<string>('')

  useEffect(() => {
    if (!orderId || !amount) {
      setError('Missing order or payment information')
      return
    }

    // Fetch order details to get customer info (only once)
    let cancelled = false
    
    const fetchOrder = async () => {
      try {
        const res = await fetch(`/api/tickets/${orderId}`)
        if (cancelled) return
        
        const data = await res.json()
        if (cancelled) return
        
        if (data.order) {
          setCustomerEmail(data.order.customer_email || '')
          setCustomerName(data.order.customer_name || '')
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Error fetching order:', err)
        }
      }
    }

    fetchOrder()

    // Cleanup function to cancel fetch if component unmounts
    return () => {
      cancelled = true
    }
  }, [orderId, amount])

  const handleCheckout = async () => {
    if (!orderId || !amount || !customerEmail) {
      setError('Missing order, payment, or customer information')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Create Stripe checkout session
      const response = await fetch('/api/payments/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'ticket',
          orderId,
          amount: parseFloat(amount),
          customerEmail,
          customerName,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session')
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url
      } else {
        throw new Error('No checkout URL returned')
      }
    } catch (err: any) {
      console.error('Payment error:', err)
      setError(err.message || 'Failed to process payment')
      setLoading(false)
    }
  }

  if (!orderId || !amount) {
    return (
      <div className="container mx-auto px-4 py-12">
        <Card className="bar-card">
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-4">Payment Error</h2>
            <p className="text-gray-600 mb-6">
              Missing order or payment information. Please try purchasing tickets again.
            </p>
            <Button onClick={() => router.push(`/events/${params.slug}`)}>
              Back to Event
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <>
      {/* Force black text with !important to override global body text color */}
      <style dangerouslySetInnerHTML={{__html: `
        .event-payment-order-container,
        .event-payment-order-container * {
          color: #000000 !important;
          -webkit-text-fill-color: #000000 !important;
        }
        .event-payment-order-label {
          color: #4B5563 !important;
          -webkit-text-fill-color: #4B5563 !important;
        }
        .event-payment-order-id {
          color: #000000 !important;
          -webkit-text-fill-color: #000000 !important;
        }
        .event-payment-order-amount {
          color: #000000 !important;
          -webkit-text-fill-color: #000000 !important;
        }
      `}} />
      <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 max-w-2xl">
        <Card className="bar-card shadow-2xl">
          <CardContent className="p-6 sm:p-8 md:p-12">
            <div className="text-center mb-6 sm:mb-8">
              <Ticket className="h-12 w-12 sm:h-16 sm:w-16 bar-text-amber mx-auto mb-4" />
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold heading-gradient mb-4">
                Complete Your Payment
              </h1>
              <p className="bar-text-muted text-base sm:text-lg">
                Secure credit card payment
              </p>
            </div>

            {/* ORDER SUMMARY - Isolated container with forced black text */}
            <div 
              className="event-payment-order-container bg-gradient-to-r from-orange-50 to-amber-50 p-4 sm:p-6 rounded-2xl mb-6 sm:mb-8 border-2 border-orange-200/50"
              style={{ 
                color: '#000000',
                isolation: 'isolate' // Creates new stacking context
              }}
            >
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-3 sm:mb-4 gap-2">
                <span className="event-payment-order-label text-xs sm:text-sm font-semibold">Order ID:</span>
                <span className="event-payment-order-id font-bold font-mono text-xs sm:text-sm break-all text-left sm:text-right">
                  {orderId}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                <span className="event-payment-order-label text-xs sm:text-sm font-semibold">Amount Due:</span>
                <span className="event-payment-order-amount text-2xl sm:text-3xl font-extrabold">
                  ${parseFloat(amount).toFixed(2)}
                </span>
              </div>
            </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-xl">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-800">Payment Error</p>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-6">
            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6">
              <div className="flex items-start gap-3">
                <CreditCard className="h-6 w-6 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-semibold text-blue-800 mb-2">Secure Payment with Stripe</p>
                  <p className="text-sm text-blue-700">
                    You'll be redirected to Stripe's secure checkout page to complete your payment. 
                    All card information is processed securely by Stripe.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <Button
                onClick={handleCheckout}
                disabled={loading || !customerEmail}
                className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white min-h-[48px] sm:h-14 text-base sm:text-lg font-bold shadow-xl hover:shadow-2xl transition-all touch-manipulation"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin inline" />
                    Redirecting to Payment...
                  </>
                ) : (
                  <>
                    <CreditCard className="mr-2 h-5 w-5 inline" />
                    Proceed to Secure Checkout
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`/events/${params.slug}`)}
                className="w-full min-h-[44px] sm:h-12 text-base sm:text-lg touch-manipulation"
                disabled={loading}
              >
                Cancel
              </Button>
            </div>

            <div className="mt-6 text-center text-sm bar-text-muted space-y-2">
              <div className="flex items-center justify-center gap-2">
                <Lock className="h-4 w-4" />
                <p>Your payment is secure and encrypted by Stripe</p>
              </div>
              <p>Your tickets will be confirmed once payment is completed.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
    </>
  )
}

export default function TicketPaymentPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto px-4 py-12">
        <Card className="bar-card">
          <CardContent className="p-8 text-center">
            <Loader2 className="h-16 w-16 text-orange-500 mx-auto mb-4 animate-spin" />
            <p className="text-gray-600">Loading payment page...</p>
          </CardContent>
        </Card>
      </div>
    }>
      <TicketPaymentPageContent />
    </Suspense>
  )
}
