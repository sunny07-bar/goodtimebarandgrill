// Stripe payment success page for reservations
'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle, Loader2, Calendar, AlertCircle } from 'lucide-react'

function PaymentSuccessContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const sessionId = searchParams.get('session_id')
  const [loading, setLoading] = useState(true)
  const [reservationId, setReservationId] = useState<string | null>(null)
  const [reservationData, setReservationData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionId) {
      setError('No payment session found')
      setLoading(false)
      return
    }

    // Verify payment and get reservation ID
    fetch(`/api/payments/stripe/verify-session?session_id=${sessionId}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.reservationId) {
          setReservationId(data.reservationId)
          // Fetch reservation details
          return fetch(`/api/reservations/${data.reservationId}`)
        } else {
          setError(data.error || 'Payment verification failed')
          return null
        }
      })
      .then(res => {
        if (res && res.ok) {
          return res.json()
        }
        return null
      })
      .then(reservationRes => {
        if (reservationRes && reservationRes.reservation) {
          setReservationData(reservationRes.reservation)
        }
        // Wait a moment for webhook to process
        setTimeout(() => {
          // Don't auto-redirect, let user see the success page
        }, 2000)
      })
      .catch(err => {
        console.error('Error verifying payment:', err)
        setError('Failed to verify payment')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [sessionId, router])

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <Card className="bar-card max-w-2xl mx-auto">
          <CardContent className="p-8 text-center">
            <Loader2 className="h-16 w-16 text-orange-500 mx-auto mb-4 animate-spin" />
            <p className="text-gray-600">Verifying your payment...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-12">
        <Card className="bar-card max-w-2xl mx-auto">
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-4">Payment Verification Error</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <Button onClick={() => router.push('/reservations')}>
              Back to Reservations
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <Card className="bar-card max-w-2xl mx-auto shadow-2xl">
        <CardContent className="p-8 md:p-12 text-center">
          <CheckCircle className="h-20 w-20 text-green-500 mx-auto mb-6" />
          <h1 className="text-3xl md:text-4xl font-extrabold heading-gradient mb-4">
            Prepayment Successful!
          </h1>
          <p className="text-lg bar-text-muted mb-8">
            Your prepayment has been processed successfully. Your reservation is being confirmed...
          </p>
          
          {reservationData && (
            <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-6 mb-8 text-left">
              <div className="space-y-3">
                {reservationData.customer_email && (
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Email:</p>
                    <p className="font-semibold text-gray-900 dark:text-white">{reservationData.customer_email}</p>
                  </div>
                )}
                {reservationData.prepayment_amount && (
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Amount Paid:</p>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      ${parseFloat(reservationData.prepayment_amount).toFixed(2)}
                    </p>
                  </div>
                )}
                {reservationData.payment_method && (
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Payment Method:</p>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {reservationData.payment_method.toUpperCase()}
                    </p>
                  </div>
                )}
                {reservationData.payment_transaction_id && (
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Transaction ID:</p>
                    <p className="font-mono text-xs text-gray-900 dark:text-white break-all">
                      {reservationData.payment_transaction_id}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
          
          <div className="flex items-center justify-center gap-2 mb-8">
            <Calendar className="h-5 w-5 text-orange-500" />
            <p className="text-sm bar-text-muted">
              {reservationData?.customer_email 
                ? `Confirmation email sent to ${reservationData.customer_email}`
                : 'You will receive a confirmation email shortly.'}
            </p>
          </div>
          <Button
            onClick={() => router.push('/reservations')}
            className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
          >
            Back to Reservations
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto px-4 py-12">
        <Card className="bar-card max-w-2xl mx-auto">
          <CardContent className="p-8 text-center">
            <Loader2 className="h-16 w-16 text-orange-500 mx-auto mb-4 animate-spin" />
            <p className="text-gray-600">Loading...</p>
          </CardContent>
        </Card>
      </div>
    }>
      <PaymentSuccessContent />
    </Suspense>
  )
}
