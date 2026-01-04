'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Ticket, CheckCircle, Download, Mail, AlertCircle, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/db'
import { getImageUrl } from '@/lib/image-utils'
import QRCode from 'qrcode'
import jsPDF from 'jspdf'
import type { jsPDF as JSPDFType } from 'jspdf'
import AnimatedSection from '@/components/AnimatedSection'
import { formatFloridaTime } from '@/lib/utils/timezone'

export default function TicketConfirmationPage() {
  const params = useParams()
  const orderId = params.orderId as string
  const [order, setOrder] = useState<any>(null)
  const [tickets, setTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [purchaseAttempted, setPurchaseAttempted] = useState(false)
  const [restaurantInfo, setRestaurantInfo] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    logo_url: null as string | null
  })

  useEffect(() => {
    loadTickets()
    loadRestaurantInfo()
  }, [orderId])

  // Auto-refresh if order is paid but tickets are missing (only if purchase wasn't attempted)
  useEffect(() => {
    if (order && order.payment_status === 'paid' && tickets.length === 0 && !loading && !purchaseAttempted) {
      let attempts = 0
      const maxAttempts = 5 // Check for 15 seconds (5 attempts * 3 seconds)
      
      const interval = setInterval(() => {
        attempts++
        console.log(`[Ticket Page] Auto-checking for tickets... (attempt ${attempts}/${maxAttempts})`)
        
        // Reload tickets only (don't reload full order)
        if (!supabase) return
        supabase
          .from('purchased_tickets')
          .select('*')
          .eq('ticket_order_id', orderId)
          .order('created_at', { ascending: true })
          .then(({ data: ticketsData, error }) => {
            if (!error && ticketsData && ticketsData.length > 0) {
              // Tickets found! Generate QR codes and update state
              clearInterval(interval)
              Promise.all(
                ticketsData.map(async (ticket: any) => {
                  try {
                    const qrCodeImage = await QRCode.toDataURL(ticket.qr_code_data, {
                      errorCorrectionLevel: 'H',
                      type: 'image/png',
                      width: 300,
                      margin: 2,
                    })
                    return {
                      ...ticket,
                      qr_code_image: qrCodeImage,
                    }
                  } catch (err) {
                    console.error('QR generation error:', err)
                    return ticket
                  }
                })
              ).then(ticketsWithQR => {
                setTickets(ticketsWithQR)
                setLoading(false)
              })
            } else if (attempts >= maxAttempts) {
              clearInterval(interval)
              console.log('[Ticket Page] Stopped checking for tickets after max attempts')
              setLoading(false)
            }
          })

        if (attempts >= maxAttempts) {
          clearInterval(interval)
        }
      }, 3000) // Check every 3 seconds

      return () => {
        clearInterval(interval)
      }
    }
  }, [order, tickets.length, loading, purchaseAttempted, orderId])

  const loadRestaurantInfo = async () => {
    try {
      if (!supabase) {
        console.warn('Supabase client not available')
        return
      }
      
      const { data: settings } = await supabase
        .from('site_settings')
        .select('key, value')
        .in('key', ['restaurant_name', 'phone', 'email', 'address', 'logo_path'])

      if (settings) {
        const info: any = {
          name: '',
          phone: '',
          email: '',
          address: '',
          logo_url: null
        }

        settings.forEach((setting: any) => {
          let value = setting.value
          if (typeof value === 'string' && (value.startsWith('"') || value.startsWith('{'))) {
            try {
              value = JSON.parse(value)
            } catch {
              // Keep as is
            }
          }
          if (typeof value === 'string') {
            value = value.replace(/^"|"$/g, '')
          }

          if (setting.key === 'restaurant_name' && value) info.name = value
          if (setting.key === 'phone' && value) info.phone = value
          if (setting.key === 'email' && value) info.email = value
          if (setting.key === 'address' && value) info.address = value
          if (setting.key === 'logo_path' && value) {
            info.logo_url = getImageUrl(value, 'site-assets')
          }
        })

        setRestaurantInfo(info)
      }
    } catch (error) {
      console.error('Error loading restaurant info:', error)
    }
  }

  const loadTickets = async () => {
    try {
      if (!supabase) {
        console.error('Supabase client not available')
        return
      }
      
      const { data: orderData, error: orderError } = await supabase
        .from('ticket_orders')
        .select(`
          *,
          events (
            id,
            title,
            event_start,
            event_end,
            location
          )
        `)
        .eq('id', orderId)
        .single()

      if (orderError || !orderData) {
        console.error('Order error:', orderError)
        setLoading(false)
        return
      }

      setOrder(orderData)

      // Get tickets for this order
      const { data: ticketsData, error: ticketsError } = await supabase
        .from('purchased_tickets')
        .select('*')
        .eq('ticket_order_id', orderId)
        .order('created_at', { ascending: true })

      if (ticketsError) {
        console.error('Tickets error:', ticketsError)
      }

      // If order is unpaid but has payment_transaction_id, try to complete purchase (only once)
      // This handles cases where payment succeeded but order wasn't updated (webhook didn't fire)
      if (orderData.payment_status === 'unpaid' && orderData.payment_transaction_id && !purchaseAttempted) {
        console.log('[Ticket Page] Order shows unpaid but has transaction ID, attempting to complete purchase...')
        setPurchaseAttempted(true)
        
        try {
          // Try calling complete-purchase - it will update payment status and create tickets
          const response = await fetch('/api/tickets/complete-purchase', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId: orderId,
              paymentTransactionId: orderData.payment_transaction_id,
              paymentMethod: orderData.payment_method || 'stripe',
              tickets: [], // Will be fetched from stored selection
            }),
          })

          if (response.ok) {
            // Reload after a moment to get updated order and tickets
            console.log('[Ticket Page] Purchase completion triggered, will reload in 3 seconds...')
            setTimeout(() => {
              loadTickets()
            }, 3000)
          } else {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
            console.error('[Ticket Page] Failed to complete purchase:', errorData)
            setPurchaseAttempted(false) // Allow retry on error
          }
        } catch (err) {
          console.error('[Ticket Page] Error completing purchase:', err)
          setPurchaseAttempted(false) // Allow retry on error
        }
        
        // Don't continue processing - wait for reload
        return
      }

      // If order is paid but no tickets exist, try to trigger ticket creation (only once)
      if (orderData.payment_status === 'paid' && (!ticketsData || ticketsData.length === 0) && !purchaseAttempted) {
        console.log('[Ticket Page] Order is paid but tickets not found, triggering ticket creation...')
        setPurchaseAttempted(true)
        
        // Get payment transaction ID from order
        const paymentTransactionId = orderData.payment_transaction_id || orderData.id
        
        try {
          // Call complete-purchase to create tickets
          const response = await fetch('/api/tickets/complete-purchase', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId: orderId,
              paymentTransactionId: paymentTransactionId,
              paymentMethod: orderData.payment_method || 'stripe',
              tickets: [], // Will be fetched from stored selection
            }),
          })

          if (response.ok) {
            // Wait a moment for tickets to be created, then reload
            console.log('[Ticket Page] Ticket creation triggered, will reload in 3 seconds...')
            setTimeout(async () => {
              if (!supabase) return
              const { data: newTicketsData } = await supabase
                .from('purchased_tickets')
                .select('*')
                .eq('ticket_order_id', orderId)
                .order('created_at', { ascending: true })

              if (newTicketsData && newTicketsData.length > 0) {
                // Generate QR codes for new tickets
                const ticketsWithQR = await Promise.all(
                  newTicketsData.map(async (ticket: any) => {
                    try {
                      const qrCodeImage = await QRCode.toDataURL(ticket.qr_code_data, {
                        errorCorrectionLevel: 'H',
                        type: 'image/png',
                        width: 300,
                        margin: 2,
                      })
                      return {
                        ...ticket,
                        qr_code_image: qrCodeImage,
                      }
                    } catch (err) {
                      console.error('QR generation error:', err)
                      return ticket
                    }
                  })
                )
                setTickets(ticketsWithQR)
                setLoading(false)
              } else {
                // Still no tickets, reload full data
                loadTickets()
              }
            }, 3000) // Wait 3 seconds for ticket creation
          } else {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
            console.error('[Ticket Page] Failed to create tickets:', errorData)
            setPurchaseAttempted(false) // Allow retry on error
          }
        } catch (err) {
          console.error('[Ticket Page] Error triggering ticket creation:', err)
          setPurchaseAttempted(false) // Allow retry on error
        }
        
        // Don't continue processing - wait for async ticket creation
        return
      }

      // If tickets exist, generate QR codes
      if (ticketsData && ticketsData.length > 0) {
        // Generate QR code images for each ticket
        const ticketsWithQR = await Promise.all(
          ticketsData.map(async (ticket: any) => {
            try {
              const qrCodeImage = await QRCode.toDataURL(ticket.qr_code_data, {
                errorCorrectionLevel: 'H',
                type: 'image/png',
                width: 300,
                margin: 2,
              })
              return {
                ...ticket,
                qr_code_image: qrCodeImage,
              }
            } catch (err) {
              console.error('QR generation error:', err)
              return ticket
            }
          })
        )

        setTickets(ticketsWithQR)
      }
    } catch (error) {
      console.error('Load error:', error)
    } finally {
      setLoading(false)
    }
  }

  const addTicketToPDF = async (pdf: jsPDF, ticket: any, isFirstPage: boolean = false) => {
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 15
    const contentWidth = pageWidth - (margin * 2)

    // Add new page if not the first ticket
    if (!isFirstPage) {
      pdf.addPage()
    }

    let yPos = margin + 5

    // Header Section with Dark Background
    pdf.setFillColor(220, 20, 11) // Dark red
    pdf.rect(0, 0, pageWidth, 70, 'F')

    // Logo (if available)
    if (restaurantInfo.logo_url) {
      try {
        const logoDataUrl = await loadImage(restaurantInfo.logo_url)
        const img = new Image()
        await new Promise((resolve, reject) => {
          img.onload = resolve
          img.onerror = reject
          img.src = logoDataUrl
        })
        const logoWidth = 25
        const logoHeight = (img.height / img.width) * logoWidth
        pdf.addImage(logoDataUrl, 'PNG', margin, yPos, logoWidth, logoHeight)
        yPos += logoHeight + 8
      } catch (err) {
        console.error('Error loading logo:', err)
        yPos += 5
      }
    }

    // Restaurant Name (White text on dark background)
    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(22)
    pdf.setFont('helvetica', 'bold')
    const restaurantName = restaurantInfo.name.toUpperCase()
    pdf.text(restaurantName, margin, yPos)
    yPos += 7

    // Restaurant Tagline
    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'normal')
    pdf.text('BAR & GRILL LIVE MUSIC', margin, yPos)
    yPos += 12

    // Ticket Title Section (Amber background)
    pdf.setFillColor(255, 184, 77) // Amber
    pdf.roundedRect(margin, yPos, contentWidth, 12, 2, 2, 'F')
    pdf.setTextColor(0, 0, 0)
    pdf.setFontSize(16)
    pdf.setFont('helvetica', 'bold')
    pdf.text('EVENT TICKET', margin + 5, yPos + 8)
    yPos += 18

    // Main Content Area (White background)
    pdf.setFillColor(255, 255, 255)
    const contentHeight = pageHeight - yPos - margin - 35
    pdf.roundedRect(margin, yPos, contentWidth, contentHeight, 2, 2, 'F')

    // Event Information
    pdf.setTextColor(31, 41, 55) // Dark gray
    pdf.setFontSize(14)
    pdf.setFont('helvetica', 'bold')
    const eventTitle = order?.events?.title || 'Event'
    pdf.text(eventTitle, margin + 8, yPos + 8)

    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'normal')
    let textY = yPos + 16

    // Event Date and Time (Florida timezone)
    if (order?.events?.event_start) {
      pdf.text(`Date: ${formatFloridaTime(order.events.event_start, 'EEEE, MM-dd-yyyy')}`, margin + 8, textY)
      textY += 6
      pdf.text(`Time: ${formatFloridaTime(order.events.event_start, 'h:mm a')} (Florida Time)`, margin + 8, textY)
      textY += 6
    }
    
    // Event End Time (if available)
    if (order?.events?.event_end) {
      pdf.text(`End Time: ${formatFloridaTime(order.events.event_end, 'h:mm a')} (Florida Time)`, margin + 8, textY)
      textY += 6
    }

    // Event Location
    if (order?.events?.location) {
      pdf.text(`Location: ${order.events.location}`, margin + 8, textY)
      textY += 8
    }

    // Divider
    pdf.setDrawColor(200, 200, 200)
    pdf.setLineWidth(0.3)
    pdf.line(margin + 8, textY, pageWidth - margin - 8, textY)
    textY += 8

    // Ticket Details Section
    pdf.setFontSize(11)
    pdf.setFont('helvetica', 'bold')
    pdf.text('TICKET DETAILS', margin + 8, textY)
    textY += 7

    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'normal')
    pdf.text(`Ticket Number: ${ticket.ticket_number}`, margin + 8, textY)
    textY += 6
    pdf.text(`Ticket Type: ${ticket.ticket_type_name}`, margin + 8, textY)
    textY += 6
    pdf.text(`Customer: ${ticket.customer_name}`, margin + 8, textY)
    textY += 6
    const pricePaid = parseFloat(ticket.price_paid.toString())
    const priceText = pricePaid === 0 ? 'FREE' : `$${pricePaid.toFixed(2)}`
    pdf.text(`Price Paid: ${priceText}`, margin + 8, textY)
    textY += 6
    
    // Status badge
    const statusColor: [number, number, number] = ticket.status === 'valid' ? [34, 197, 94] : [156, 163, 175]
    pdf.setFillColor(statusColor[0], statusColor[1], statusColor[2])
    pdf.roundedRect(margin + 8, textY - 4, 20, 5, 1, 1, 'F')
    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(8)
    pdf.setFont('helvetica', 'bold')
    pdf.text(ticket.status.toUpperCase(), margin + 9, textY)
    textY += 10

    // QR Code Section
    if (ticket.qr_code_image) {
      // Divider
      pdf.setDrawColor(200, 200, 200)
      pdf.setLineWidth(0.3)
      pdf.line(margin + 8, textY, pageWidth - margin - 8, textY)
      textY += 8

      // QR Code
      try {
        const qrDataUrl = await loadImage(ticket.qr_code_image)
        const qrSize = 45
        const qrX = (pageWidth - qrSize) / 2
        pdf.addImage(qrDataUrl, 'PNG', qrX, textY, qrSize, qrSize)
        textY += qrSize + 6

        // QR Code Label
        pdf.setFontSize(10)
        pdf.setFont('helvetica', 'bold')
        pdf.setTextColor(31, 41, 55)
        pdf.text('SCAN AT EVENT ENTRANCE', pageWidth / 2, textY, { align: 'center' })
        textY += 5
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(8)
        pdf.setTextColor(100, 100, 100)
        pdf.text('Present this QR code at the venue', pageWidth / 2, textY, { align: 'center' })
      } catch (err) {
        console.error('Error adding QR code to PDF:', err)
      }
    }

    // Footer Section
    const footerY = pageHeight - margin - 15
    pdf.setDrawColor(200, 200, 200)
    pdf.setLineWidth(0.3)
    pdf.line(margin + 8, footerY, pageWidth - margin - 8, footerY)

    pdf.setFontSize(7)
    pdf.setTextColor(120, 120, 120)
    pdf.text(restaurantInfo.address, pageWidth / 2, footerY + 4, { align: 'center' })
    pdf.text(`Phone: ${restaurantInfo.phone} | Email: ${restaurantInfo.email}`, pageWidth / 2, footerY + 8, { align: 'center' })
    pdf.setFontSize(6)
    pdf.text('This ticket is valid for one-time use only. Please arrive 15 minutes before the event.', pageWidth / 2, footerY + 12, { align: 'center', maxWidth: contentWidth - 16 })
  }

  const downloadAllTicketsPDF = async () => {
    try {
      if (tickets.length === 0) {
        alert('No tickets to download')
        return
      }

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [210, 297] // A4 size
      })

      // Add each ticket to the PDF
      for (let i = 0; i < tickets.length; i++) {
        await addTicketToPDF(pdf, tickets[i], i === 0)
      }

      // Download PDF with order number
      const orderNumber = order?.order_number || 'tickets'
      pdf.save(`tickets-${orderNumber}.pdf`)
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Failed to generate PDF. Please try again.')
    }
  }

  const downloadTicketPDF = async (ticket: any) => {
    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [210, 297] // A4 size
      })

      await addTicketToPDF(pdf, ticket, true)

      // Download PDF
      pdf.save(`ticket-${ticket.ticket_number}.pdf`)
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Failed to generate PDF. Please try again.')
    }
  }

  // Helper function to load image from URL (handles CORS)
  const loadImage = (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      // For data URLs (QR codes), return directly
      if (url.startsWith('data:')) {
        resolve(url)
        return
      }

      // For external URLs, fetch and convert to data URL
      fetch(url)
        .then(response => response.blob())
        .then(blob => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(blob)
        })
        .catch(reject)
    })
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <p>Loading your tickets...</p>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-600" />
        <p className="text-xl font-semibold mb-2">Order not found</p>
        <p className="text-gray-600">The order ID you're looking for doesn't exist.</p>
      </div>
    )
  }

  if (tickets.length === 0) {
    // Check if order is paid but tickets are still being created
    if (order.payment_status === 'paid') {
      return (
        <div className="container mx-auto px-4 py-12 text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-orange-600" />
          <p className="text-xl font-semibold mb-2">Creating your tickets...</p>
          <p className="text-gray-600 mb-4">
            Your payment was successful. We're generating your tickets now.
          </p>
          <p className="text-sm text-gray-500">
            This page will refresh automatically. If tickets don't appear in a few moments, please contact support.
          </p>
          <button
            onClick={() => {
              setLoading(true)
              loadTickets()
            }}
            className="btn-amber-sm mt-4 min-h-[44px] touch-manipulation"
          >
            Refresh
          </button>
        </div>
      )
    } else {
      return (
        <div className="container mx-auto px-4 py-12 text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-yellow-600" />
          <p className="text-xl font-semibold mb-2">Tickets not available</p>
          <p className="text-gray-600 mb-4">
            {order.payment_status === 'unpaid' 
              ? 'This order has not been paid yet. Please complete your payment to receive tickets.'
              : 'Tickets are not available for this order yet.'}
          </p>
          {order.payment_status === 'unpaid' && (
            <button
              onClick={() => {
                // Use relative URL - will work in both development and production
                window.location.href = `/events/${encodeURIComponent(params.slug as string)}/payment?orderId=${orderId}&amount=${order.total_amount}`
              }}
              className="btn-amber mt-4 min-h-[44px] touch-manipulation"
            >
              Complete Payment
            </button>
          )}
        </div>
      )
    }
  }

  return (
      <div className="section-bg-primary section-spacing">
        <div className="container-global">
          <AnimatedSection direction="down">
            <div className="text-center mb-8 md:mb-12">
              <CheckCircle className="h-12 w-12 md:h-16 md:w-16 text-green-400 mx-auto mb-4" />
              <h1 className="section-title mb-4 text-gradient-amber">
                Tickets Purchased!
              </h1>
              <div className="section-divider mb-6"></div>
              <p className="text-lg md:text-xl body-text mb-6">
                Order #{order.order_number}
              </p>
              {tickets.length > 1 && (
                <button
                  onClick={downloadAllTicketsPDF}
                  className="btn-amber min-h-[48px] md:min-h-[52px] text-base md:text-lg touch-manipulation"
                >
                  <Download className="mr-2 h-5 w-5" />
                  Download All Tickets ({tickets.length}) as PDF
                </button>
              )}
            </div>
          </AnimatedSection>

          <div className="max-w-4xl mx-auto space-y-6 md:space-y-8">
            {/* Event Info */}
            <AnimatedSection direction="up">
              <div className="card-premium">
                <h2 className="card-title mb-4 text-xl md:text-2xl">{order.events?.title}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                  <div>
                    <p className="body-text text-xs md:text-sm opacity-75 mb-1">Date</p>
                    <p className="font-semibold text-sm md:text-base">
                      {formatFloridaTime(order.events?.event_start, 'EEEE, MM-dd-yyyy')}
                    </p>
                  </div>
                  <div>
                    <p className="body-text text-xs md:text-sm opacity-75 mb-1">Time</p>
                    <p className="font-semibold text-sm md:text-base">
                      {formatFloridaTime(order.events?.event_start, 'h:mm a')}
                    </p>
                  </div>
                  {order.events?.location && (
                    <div className="sm:col-span-2">
                      <p className="body-text text-xs md:text-sm opacity-75 mb-1">Location</p>
                      <p className="font-semibold text-sm md:text-base">{order.events.location}</p>
                    </div>
                  )}
                </div>
              </div>
            </AnimatedSection>

            {/* Tickets */}
            <div className="space-y-4 md:space-y-6">
              {tickets.map((ticket, index) => (
                <AnimatedSection key={ticket.id} direction="up" delay={index * 100}>
                  <div className="card-premium border-2 border-[#F59E0B]/40">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                      {/* Ticket Info */}
                      <div className="md:col-span-2">
                        <div className="flex items-center gap-2 mb-4">
                          <Ticket className="h-5 w-5 md:h-6 md:w-6 text-[#F59E0B]" />
                          <h3 className="card-title text-lg md:text-xl">{ticket.ticket_type_name}</h3>
                        </div>
                        <div className="space-y-3">
                          <div>
                            <p className="body-text text-xs md:text-sm opacity-75 mb-1">Ticket Number</p>
                            <p className="font-bold text-base md:text-lg">{ticket.ticket_number}</p>
                          </div>
                          <div>
                            <p className="body-text text-xs md:text-sm opacity-75 mb-1">Customer</p>
                            <p className="font-semibold text-sm md:text-base">{ticket.customer_name}</p>
                          </div>
                          <div>
                            <p className="body-text text-xs md:text-sm opacity-75 mb-1">Price Paid</p>
                            <p className="font-semibold text-sm md:text-base">
                              {parseFloat(ticket.price_paid.toString()) === 0 
                                ? <span className="text-green-400">FREE</span>
                                : `$${parseFloat(ticket.price_paid.toString()).toFixed(2)}`
                              }
                            </p>
                          </div>
                          <div>
                            <p className="body-text text-xs md:text-sm opacity-75 mb-1">Status</p>
                            <span
                              className={`inline-flex px-3 py-1.5 rounded-full text-xs md:text-sm font-semibold ${
                                ticket.status === 'valid'
                                  ? 'bg-green-500/20 text-green-400 border border-green-400/30'
                                  : 'bg-gray-500/20 text-gray-400 border border-gray-400/30'
                              }`}
                            >
                              {ticket.status.toUpperCase()}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* QR Code */}
                      <div className="flex flex-col items-center justify-center">
                        {ticket.qr_code_image ? (
                          <>
                            <img
                              src={ticket.qr_code_image}
                              alt="QR Code"
                              className="w-40 h-40 md:w-48 md:h-48 border-4 border-[#F59E0B] p-2 bg-white rounded-lg mb-4"
                            />
                            <p className="body-text text-xs text-center opacity-75 mb-4">
                              Scan at event entrance
                            </p>
                            <button
                              onClick={() => downloadTicketPDF(ticket)}
                              className="btn-amber-sm w-full min-h-[44px] touch-manipulation"
                            >
                              <Download className="mr-2 h-4 w-4" />
                              Download PDF
                            </button>
                          </>
                        ) : (
                          <p className="body-text opacity-75">Loading QR code...</p>
                        )}
                      </div>
                    </div>
                  </div>
                </AnimatedSection>
              ))}
            </div>

            {/* Important Info */}
            <AnimatedSection direction="up" delay={tickets.length * 100}>
              <div className="card-premium bg-yellow-500/10 border-2 border-yellow-400/30">
                <h3 className="card-title mb-4 flex items-center gap-2 text-yellow-400">
                  <Mail className="h-5 w-5" />
                  Important Information
                </h3>
                <ul className="space-y-2 body-text text-sm md:text-base text-yellow-300/90">
                  <li>• Your tickets have been sent to <strong>{order.customer_email}</strong></li>
                  <li>• Each ticket can only be used once</li>
                  <li>• Please arrive at least 15 minutes before the event</li>
                  <li>• Bring a valid ID that matches the name on the ticket</li>
                  <li>• Keep this page or your email safe - you'll need to show the QR code</li>
                </ul>
              </div>
            </AnimatedSection>
          </div>
        </div>
      </div>
    )
  }

