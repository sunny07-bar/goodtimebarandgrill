import { useState, useEffect } from 'react'
import { MapPin, Phone, Mail, Instagram, Facebook } from 'lucide-react'

// Helper to extract username/url
const extractUsername = (value: string, platform: 'instagram' | 'facebook' | 'tiktok' = 'instagram'): { username: string; url: string } => {
  const trimmed = value?.toString().trim() || ''
  if (!trimmed) return { username: '', url: '' }

  // Remove @ if present for username extraction
  let cleaned = trimmed.replace(/^@/, '')

  // 1. Check for explicit URLs first
  const instagramMatch = cleaned.match(/instagram\.com\/([^\/\?]+)/i)
  const facebookMatch = cleaned.match(/facebook\.com\/([^\/\?]+)/i)
  const tiktokMatch = cleaned.match(/tiktok\.com\/@?([^\/\?]+)/i)

  if (instagramMatch && instagramMatch[1]) return { username: instagramMatch[1], url: `https://instagram.com/${instagramMatch[1]}` }
  if (facebookMatch && facebookMatch[1]) return { username: facebookMatch[1], url: `https://facebook.com/${facebookMatch[1]}` }
  if (tiktokMatch && tiktokMatch[1]) return { username: tiktokMatch[1], url: `https://tiktok.com/@${tiktokMatch[1]}` }

  // 2. If no explicit URL, assume it's a username for the requested platform
  if (!trimmed.includes('http') && !trimmed.includes('.com')) {
    if (platform === 'instagram') return { username: cleaned, url: `https://instagram.com/${cleaned}` }
    if (platform === 'facebook') return { username: cleaned, url: `https://facebook.com/${cleaned}` }
    if (platform === 'tiktok') return { username: cleaned, url: `https://tiktok.com/@${cleaned}` }
  }

  // 3. Fallback for generic URLs
  return { username: cleaned, url: trimmed.startsWith('http') ? trimmed : '' }
}

interface FooterProps {
  siteSettings?: any
}

export default function Footer({ siteSettings = {} }: FooterProps) {
  const instagramData = extractUsername(siteSettings.instagram_user_id || '', 'instagram')
  const facebookData = extractUsername(siteSettings.facebook_user_id || '', 'facebook')
  const tiktokData = extractUsername(siteSettings.tiktok_user_id || '', 'tiktok')

  const siteInfo = {
    restaurant_name: siteSettings.restaurant_name || '',
    address: siteSettings.restaurant_address || siteSettings.address || '',
    phone: siteSettings.restaurant_phone || siteSettings.phone || '',
    email: siteSettings.restaurant_email || siteSettings.email || '',
    instagram_user_id: instagramData.username,
    instagram_url: instagramData.url,
    facebook_user_id: facebookData.username,
    facebook_url: facebookData.url,
    tiktok_user_id: tiktokData.username,
    tiktok_url: tiktokData.url
  }

  return (
    <footer className="footer-dark pt-10 pb-6 animate-fade-in-up">
      <div className="container-global">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10 mb-6">
          {/* Address & Contact */}
          <div className="animate-fade-in-up stagger-1">
            <h3 className="card-title mb-2">Location</h3>
            <div className="space-y-1.5">
              <div className="flex items-start gap-2 text-sm text-[#D1D5DB]">
                <MapPin className="h-4 w-4 text-[#F59E0B] flex-shrink-0 mt-0.5" />
                <p>{siteInfo.address}</p>
              </div>
              <div className="flex items-center gap-2 text-sm text-[#D1D5DB]">
                <Phone className="h-4 w-4 text-[#F59E0B] flex-shrink-0" />
                <a
                  href={`tel:${siteInfo.phone.replace(/\D/g, '')}`}
                  className="hover:text-[#F59E0B] transition-colors"
                >
                  {siteInfo.phone}
                </a>
              </div>
              <div className="flex items-center gap-2 text-sm text-[#D1D5DB]">
                <Mail className="h-4 w-4 text-[#F59E0B] flex-shrink-0" />
                <a
                  href={`mailto:${siteInfo.email}`}
                  className="hover:text-[#F59E0B] transition-colors break-all"
                >
                  {siteInfo.email}
                </a>
              </div>
            </div>
          </div>

          {/* Social */}
          <div className="animate-fade-in-up stagger-2">
            <h3 className="card-title mb-2">Connect</h3>
            <div className="space-y-2.5">
              {siteInfo.instagram_user_id && (
                <a
                  href={siteInfo.instagram_url || `https://instagram.com/${siteInfo.instagram_user_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-[#D1D5DB] hover:text-[#F59E0B] transition-colors"
                  aria-label="Instagram"
                >
                  <Instagram className="h-4 w-4 text-[#F59E0B] flex-shrink-0" />
                  <span>@{siteInfo.instagram_user_id}</span>
                </a>
              )}
              {siteInfo.facebook_user_id && (
                <a
                  href={siteInfo.facebook_url || `https://facebook.com/${siteInfo.facebook_user_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-[#D1D5DB] hover:text-[#F59E0B] transition-colors"
                  aria-label="Facebook"
                >
                  <Facebook className="h-4 w-4 text-[#F59E0B] flex-shrink-0" />
                  <span>{siteInfo.facebook_user_id}</span>
                </a>
              )}
              {siteInfo.tiktok_user_id && (
                <a
                  href={siteInfo.tiktok_url || `https://tiktok.com/@${siteInfo.tiktok_user_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-[#D1D5DB] hover:text-[#F59E0B] transition-colors"
                  aria-label="TikTok"
                >
                  <svg
                    className="h-4 w-4 text-[#F59E0B] flex-shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
                  </svg>
                  <span>@{siteInfo.tiktok_user_id}</span>
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-white/10 pt-6 mt-6 text-center">
          <p className="text-xs text-[#D1D5DB] opacity-70">
            &copy; {new Date().getFullYear()} {siteInfo.restaurant_name || 'Good Times Bar & Grill'}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
