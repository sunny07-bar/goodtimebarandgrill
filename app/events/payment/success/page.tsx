// Stripe payment success page for tickets
'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle, Loader2, Ticket, AlertCircle } from 'lucide-react'

function PaymentSuccessContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const sessionId = searchParams.get('session_id')
  const [loading, setLoading] = useState(true)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [eventSlug, setEventSlug] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionId) {
      setError('No payment session found')
      setLoading(false)
      return
    }

    // Verify payment and get order ID (verify-session now waits for ticket creation)
    fetch(`/api/payments/stripe/verify-session?session_id=${sessionId}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.orderId) {
          setOrderId(data.orderId)
          setEventSlug(data.eventSlug || 'events')
          const slug = data.eventSlug || 'events'
          
          // verify-session now waits for ticket creation, so we can redirect immediately
          // Add a small delay to ensure everything is saved
          setTimeout(() => {
            router.push(`/events/${encodeURIComponent(slug)}/tickets/${data.orderId}`)
          }, 1000)
        } else {
          setError(data.error || 'Payment verification failed')
        }
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
            <Button onClick={() => router.push('/events')}>
              Back to Events
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
            Payment Successful!
          </h1>
          <p className="text-lg bar-text-muted mb-8">
            Your payment has been processed successfully. Redirecting to your tickets...
          </p>
          <div className="flex items-center justify-center gap-2 mb-8">
            <Ticket className="h-5 w-5 text-orange-500" />
            <p className="text-sm bar-text-muted">You will receive your tickets via email shortly.</p>
          </div>
          {orderId && eventSlug && (
            <Button
              onClick={() => router.push(`/events/${encodeURIComponent(eventSlug)}/tickets/${orderId}`)}
              className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
            >
              View Your Tickets
            </Button>
          )}
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
