'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { XCircle } from 'lucide-react'
import Link from 'next/link'

export default function PaymentCancelPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      <Card className="bar-card shadow-2xl">
        <CardContent className="p-8 md:p-12 text-center">
          <XCircle className="h-20 w-20 text-red-500 mx-auto mb-6" />
          <h1 className="text-3xl md:text-4xl font-extrabold heading-gradient mb-4">
            Payment Cancelled
          </h1>
          <p className="bar-text-muted text-lg mb-8">
            Your payment was cancelled. Your reservation has not been confirmed.
          </p>
          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-6 mb-8">
            <p className="text-yellow-800 font-semibold mb-2">
              What happens next?
            </p>
            <p className="text-yellow-700 text-sm">
              Your reservation is pending payment. You can try again or contact us directly to complete your reservation.
            </p>
          </div>
          <div className="space-y-3">
            <Link href="/reservations">
              <Button className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white h-12 text-lg font-bold">
                Try Again
              </Button>
            </Link>
            <Link href="/contact">
              <Button variant="outline" className="w-full h-12">
                Contact Us
              </Button>
            </Link>
            <Link href="/">
              <Button variant="outline" className="w-full h-12">
                Back to Home
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

