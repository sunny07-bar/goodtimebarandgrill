'use client'

import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { XCircle } from 'lucide-react'

export default function TicketPaymentCancelPage() {
  const router = useRouter()

  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      <Card className="bar-card">
        <CardContent className="p-8 text-center">
          <XCircle className="h-16 w-16 text-orange-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-4">Payment Cancelled</h2>
          <p className="text-gray-600 mb-6">
            Your payment was cancelled. No charges were made to your account.
          </p>
          <Button onClick={() => router.push('/events')}>
            Back to Events
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

