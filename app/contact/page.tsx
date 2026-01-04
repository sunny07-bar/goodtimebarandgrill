'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { MapPin, Phone, Mail, Send, CheckCircle, AlertCircle } from 'lucide-react'
import { getAllSiteSettings } from '@/lib/queries'

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [contactInfo, setContactInfo] = useState({
    address: '',
    phone: '',
    email: '',
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchContactInfo = async () => {
      try {
        const settings = await getAllSiteSettings()
        setContactInfo({
          address: settings.restaurant_address || settings.address || '',
          phone: settings.restaurant_phone || settings.phone || '',
          email: settings.restaurant_email || settings.email || '',
        })
      } catch (error) {
        console.error('Error fetching contact info:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchContactInfo()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitStatus('idle')

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        setSubmitStatus('success')
        setFormData({ name: '', email: '', phone: '', subject: '', message: '' })
      } else {
        setSubmitStatus('error')
      }
    } catch (error) {
      setSubmitStatus('error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="section-bg-primary section-spacing">
      <div className="container-global">
        <div className="text-center mb-12 md:mb-16">
          <h1 className="section-title mb-4">CONTACT US</h1>
          <div className="section-divider mb-6"></div>
          <p className="body-text max-w-3xl mx-auto text-lg">
            a question or want to get in touch? We'd love to hear from you!
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 lg:gap-8">
          {/* Contact Information */}
          <div className="lg:col-span-1 space-y-4 md:space-y-6">
            <div className="card-premium">
              <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6">
                <div className="bg-[#F59E0B]/10 rounded-xl p-2 md:p-3 border border-[#F59E0B]/20">
                  <MapPin className="h-5 w-5 md:h-6 md:w-6 text-[#F59E0B]" />
                </div>
                <h3 className="card-title text-[#F59E0B] text-base md:text-lg">ADDRESS</h3>
              </div>
              {loading ? (
                <p className="body-text opacity-50 text-sm md:text-base">Loading...</p>
              ) : contactInfo.address ? (
                <p className="body-text text-sm md:text-base">{contactInfo.address}</p>
              ) : (
                <p className="body-text opacity-50 text-sm md:text-base">Address not available</p>
              )}
            </div>

            <div className="card-premium">
              <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6">
                <div className="bg-[#F59E0B]/10 rounded-xl p-2 md:p-3 border border-[#F59E0B]/20">
                  <Phone className="h-5 w-5 md:h-6 md:w-6 text-[#F59E0B]" />
                </div>
                <h3 className="card-title text-[#F59E0B] text-base md:text-lg">PHONE</h3>
              </div>
              {loading ? (
                <p className="body-text opacity-50 text-sm md:text-base">Loading...</p>
              ) : contactInfo.phone ? (
                <a 
                  href={`tel:${contactInfo.phone.replace(/\D/g, '')}`} 
                  className="price-amber hover:text-[#D97706] transition-colors text-base md:text-lg font-semibold"
                >
                  {contactInfo.phone}
                </a>
              ) : (
                <p className="body-text opacity-50 text-sm md:text-base">Phone not available</p>
              )}
            </div>

            <div className="card-premium">
              <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6">
                <div className="bg-[#F59E0B]/10 rounded-xl p-2 md:p-3 border border-[#F59E0B]/20">
                  <Mail className="h-5 w-5 md:h-6 md:w-6 text-[#F59E0B]" />
                </div>
                <h3 className="card-title text-[#F59E0B] text-base md:text-lg">EMAIL</h3>
              </div>
              {loading ? (
                <p className="body-text opacity-50 text-sm md:text-base">Loading...</p>
              ) : contactInfo.email ? (
                <a 
                  href={`mailto:${contactInfo.email}`} 
                  className="price-amber hover:text-[#D97706] transition-colors break-all text-sm md:text-base"
                >
                  {contactInfo.email}
                </a>
              ) : (
                <p className="body-text opacity-50 text-sm md:text-base">Email not available</p>
              )}
            </div>
          </div>

          {/* Contact Form */}
          <div className="lg:col-span-2">
            <div className="card-premium">
              <h2 className="card-title mb-6 md:mb-8 text-[#F59E0B] text-lg md:text-xl">SEND US A MESSAGE</h2>

              {submitStatus === 'success' && (
                <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-xl flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0" />
                  <p className="text-green-400 body-text">Thank you for your message! We'll get back to you soon.</p>
                </div>
              )}

              {submitStatus === 'error' && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
                  <p className="text-red-400 body-text">Something went wrong. Please try again later.</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  <div>
                    <Label htmlFor="name" className="body-text mb-2 block font-semibold text-sm md:text-base">Name *</Label>
                    <Input
                      id="name"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="form-input-premium h-11 md:h-12 text-sm md:text-base"
                      placeholder="Your name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email" className="body-text mb-2 block font-semibold text-sm md:text-base">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="form-input-premium h-11 md:h-12 text-sm md:text-base"
                      placeholder="your.email@example.com"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  <div>
                    <Label htmlFor="phone" className="body-text mb-2 block font-semibold text-sm md:text-base">Phone</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="form-input-premium h-11 md:h-12 text-sm md:text-base"
                      placeholder="Your phone number"
                    />
                  </div>
                  <div>
                    <Label htmlFor="subject" className="body-text mb-2 block font-semibold text-sm md:text-base">Subject</Label>
                    <Input
                      id="subject"
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      className="form-input-premium h-11 md:h-12 text-sm md:text-base"
                      placeholder="What's this about?"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="message" className="body-text mb-2 block font-semibold text-sm md:text-base">Message *</Label>
                  <Textarea
                    id="message"
                    required
                    rows={5}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="form-textarea-premium text-sm md:text-base"
                    placeholder="Tell us what's on your mind..."
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-amber text-base md:text-lg px-6 md:px-10 py-3 md:py-4 min-h-[48px] md:min-h-[50px] w-full md:w-auto touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    'Sending...'
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4 md:h-5 md:w-5" />
                      Send Message
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
