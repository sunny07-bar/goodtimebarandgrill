'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { CreditCard, Lock, Loader2, AlertCircle } from 'lucide-react'

function PaymentContent() {
  const params = useSearchParams()
  const router = useRouter()

  const reservationId = params.get('reservationId')
  const amount = params.get('amount')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [customerEmail, setCustomerEmail] = useState<string>('')
  const [customerName, setCustomerName] = useState<string>('')
  const [reservationData, setReservationData] = useState<any>(null)

  useEffect(() => {
    if (!reservationId || !amount) {
      setError('Missing reservation or payment information')
    } else {
      // Fetch reservation details
      fetch(`/api/reservations/${reservationId}`)
        .then(res => res.json())
        .then(data => {
          if (data.reservation) {
            setReservationData(data.reservation)
            setCustomerEmail(data.reservation.customer_email || '')
            setCustomerName(data.reservation.customer_name || '')
          }
        })
        .catch(err => {
          console.error('Error fetching reservation:', err)
        })
    }
  }, [reservationId, amount])

  const handleCheckout = async () => {
    if (!reservationId || !amount || !customerEmail) {
      setError('Missing reservation, payment, or customer information')
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
          type: 'reservation',
          reservationId,
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

  if (!reservationId || !amount) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        Missing payment details
      </div>
    )
  }

  return (
    <>
      {/* Force black text with !important to override global body text color */}
      <style dangerouslySetInnerHTML={{__html: `
        .payment-order-container,
        .payment-order-container * {
          color: #000000 !important;
          -webkit-text-fill-color: #000000 !important;
        }
        .payment-order-label {
          color: #374151 !important;
          -webkit-text-fill-color: #374151 !important;
        }
        .payment-order-id {
          color: #000000 !important;
          -webkit-text-fill-color: #000000 !important;
        }
        .payment-order-amount {
          color: #000000 !important;
          -webkit-text-fill-color: #000000 !important;
        }
      `}} />
      <div className="min-h-screen flex items-center justify-center bg-black p-4 sm:p-6">
        <div className="w-full max-w-xl rounded-2xl bg-[#0d0d0d] shadow-2xl p-6 sm:p-8">

          {/* HEADER */}
          <div className="text-center mb-6 sm:mb-8">
            <div className="mx-auto mb-4 h-10 w-10 rounded-lg border border-white/20" />
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              Complete Your Payment
            </h1>
            <p className="text-sm sm:text-base text-neutral-400 mt-2">
              Secure credit card payment
            </p>
          </div>

          {/* ORDER SUMMARY - Isolated container with forced black text */}
          <div
            className="payment-order-container rounded-xl border border-[#F3D2A0] p-4 sm:p-6 mb-6"
            style={{ 
              backgroundColor: '#FFF6E8',
              color: '#000000',
              isolation: 'isolate' // Creates new stacking context
            }}
          >
            {/* ORDER ID */}
            <div className="mb-4 sm:mb-6">
              <p className="payment-order-label text-xs sm:text-sm font-semibold mb-1">
                Order ID
              </p>
              <p className="payment-order-id font-mono text-xs sm:text-sm break-all">
                {reservationId}
              </p>
            </div>

            {/* AMOUNT */}
            <div className="flex justify-between items-center">
              <p className="payment-order-label text-xs sm:text-sm font-semibold">
                Amount Due
              </p>
              <p className="payment-order-amount text-3xl sm:text-4xl font-black">
                ${Number(amount).toFixed(2)}
              </p>
            </div>
          </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              <p className="font-semibold text-red-800 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* STRIPE INFO */}
        <div className="rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] p-5 mb-6">
          <p className="font-semibold text-blue-700 mb-1">
            Secure Payment with Stripe
          </p>
          <p className="text-sm text-blue-600">
            You'll be redirected to Stripe's secure checkout page.
            All card information is processed securely.
          </p>
        </div>

        {/* CTA */}
        <button
          onClick={handleCheckout}
          disabled={loading || !customerEmail}
          className="w-full min-h-[48px] sm:h-14 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-base sm:text-lg font-bold flex items-center justify-center gap-2 mb-4 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <CreditCard className="h-5 w-5" />
              Proceed to Secure Checkout
            </>
          )}
        </button>

        {/* CANCEL */}
        <button
          onClick={() => router.back()}
          className="w-full min-h-[44px] sm:h-12 rounded-xl bg-black border border-white/10 text-white hover:bg-white/5 mb-6 text-base sm:text-lg touch-manipulation"
        >
          Cancel
        </button>

        {/* FOOTER */}
        <div className="text-center text-sm text-neutral-400">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Lock className="h-4 w-4" />
            Your payment is secure and encrypted by Stripe
          </div>
          <p>Your reservation will be confirmed once payment is completed.</p>
        </div>

      </div>
    </div>
    </>
  )
}

export default function PaymentPage() {
  return (
    <Suspense fallback={<div className="text-white p-10">Loading…</div>}>
      <PaymentContent />
    </Suspense>
  )
}
