'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { UtensilsCrossed, Music, Beer, ChefHat, Calendar, MapPin, Clock, ArrowRight, Leaf, Mail, Phone, ChevronLeft, ChevronRight } from 'lucide-react'
import SupabaseImage from '@/components/SupabaseImage'
import { formatFloridaTime, convert24To12, formatFloridaDateDDMMYYYY } from '@/lib/utils/timezone'
import { getAllSiteSettings, getOpeningHours } from '@/lib/queries'
import { supabase } from '@/lib/db'
import { getImageUrl } from '@/lib/image-utils'

interface HomeClientProps {
  banners: any[]
  featuredItems: any[]
  upcomingEvents: any[]
  galleryImages?: any[]
  partiesImages?: any[]
  homeFeatures?: any[]
}

export default function HomeClient({ banners, featuredItems, upcomingEvents, galleryImages = [], partiesImages = [], homeFeatures = [] }: HomeClientProps) {
  const validBanners = Array.isArray(banners) ? banners.filter(b => b) : []
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0)
  const [openingHours, setOpeningHours] = useState<any[]>([])
  const [siteInfo, setSiteInfo] = useState({
    address: '',
    phone: '',
    email: ''
  })
  const [logoUrl, setLogoUrl] = useState<string | null>(null)

  // Limit events to 2 featured
  const featuredEvents = upcomingEvents.slice(0, 2)
  
  // Limit menu items to 4
  const previewMenuItems = featuredItems.slice(0, 4)

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch opening hours
        const hours = await getOpeningHours()
        setOpeningHours(hours || [])
        
        // Fetch site settings (address, phone, email)
        const settings = await getAllSiteSettings()
        setSiteInfo({
          address: settings.restaurant_address || settings.address || '',
          phone: settings.restaurant_phone || settings.phone || '',
          email: settings.restaurant_email || settings.email || ''
        })

        // Fetch logo
        if (supabase) {
          try {
            const { data: logoSettings } = await supabase
              .from('site_settings')
              .select('value')
              .eq('key', 'logo_path')
              .single()

            if (logoSettings?.value) {
              const logoPath = typeof logoSettings.value === 'string' 
                ? logoSettings.value.replace(/^"|"$/g, '')
                : logoSettings.value
              
              if (logoPath) {
                const logoUrl = getImageUrl(logoPath, 'site-assets')
                setLogoUrl(logoUrl ? `${logoUrl}?t=${Date.now()}` : null)
              }
            }
          } catch (error) {
            console.error('Error fetching logo:', error)
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error)
      }
    }
    fetchData()
  }, [])

  useEffect(() => {
    if (validBanners.length > 0 && currentBannerIndex >= validBanners.length) {
      setCurrentBannerIndex(0)
    }
  }, [validBanners.length, currentBannerIndex])

  useEffect(() => {
    if (validBanners.length <= 1) return
    // Disable auto-slide on mobile (users scroll, not watch)
    if (typeof window !== 'undefined' && window.innerWidth < 640) return
    const interval = setInterval(() => {
      setCurrentBannerIndex((prev) => (prev + 1) % validBanners.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [validBanners.length])

  const nextBanner = () => {
    if (validBanners.length <= 1) return
    setCurrentBannerIndex((prev) => (prev + 1) % validBanners.length)
  }

  const prevBanner = () => {
    if (validBanners.length <= 1) return
    setCurrentBannerIndex((prev) => (prev - 1 + validBanners.length) % validBanners.length)
  }

  const currentBanner = validBanners[currentBannerIndex] || validBanners[0] || null

  const formatEventDate = (dateString: string) => {
    try {
      // Use formatFloridaDateDDMMYYYY for consistency with other pages
      return formatFloridaDateDDMMYYYY(dateString)
    } catch {
      return ''
    }
  }

  const formatEventTime = (dateString: string) => {
    try {
      // formatFloridaTime already handles timezone conversion from UTC to Florida time
      return formatFloridaTime(dateString, 'h:mm a')
    } catch {
      return ''
    }
  }

  return (
    <div className="w-full">
      {/* 1️⃣ HERO SECTION */}
      {validBanners.length > 0 && currentBanner ? (
        <section className="relative w-full px-3 sm:px-4 md:px-6 lg:px-8 animate-fade-in mb-0">
          <div className="relative w-full aspect-[16/10] md:h-[60vh] md:max-h-[600px] md:min-h-[400px] rounded-2xl sm:rounded-3xl md:rounded-3xl overflow-hidden group">
            {/* Logo in left upper corner */}
            {logoUrl && (
              <div className="absolute top-2 left-2 sm:top-3 sm:left-3 md:top-4 md:left-4 lg:top-6 lg:left-6 z-30">
                <img 
                  src={logoUrl} 
                  alt="Logo" 
                  className="h-16 w-16 sm:h-20 sm:w-20 md:h-24 md:w-24 lg:h-32 lg:w-32 xl:h-40 xl:w-40 object-contain drop-shadow-lg"
                  style={{ background: 'transparent' }}
                />
              </div>
            )}

            {/* Banner Images */}
            <div className="absolute inset-0">
              {validBanners.map((banner, index) => (
                <div
                  key={banner.id || `banner-${index}`}
                  className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                    index === currentBannerIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
                  }`}
                >
                  {banner.image_path ? (
                    <>
                      <SupabaseImage
                        src={banner.image_path}
                        alt={banner.title || 'Banner'}
                        fill
                        className="object-cover object-center"
                        priority={index === 0}
                        bucket="banners"
                      />
                      {/* Strong dark gradient overlay - center to bottom, stronger on mobile for tall images */}
                      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/40 to-black/80 md:from-transparent md:via-black/25 md:to-black/85"></div>
                    </>
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-[#0E0E0E] to-[#111111]"></div>
                  )}
                </div>
              ))}
            </div>

            {/* Banner Content (Title, Subtitle, CTA) */}
            <div className="absolute inset-0 z-20 flex items-center justify-center">
              <div className="text-center px-3 sm:px-4 md:px-8 max-w-4xl mx-auto">
                {currentBanner.title && (
                  <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-white mb-2 sm:mb-3 md:mb-4 drop-shadow-2xl animate-fade-in-up leading-tight">
                    {currentBanner.title}
                  </h1>
                )}
                {currentBanner.subtitle && (
                  <p className="text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl text-white/90 mb-4 sm:mb-5 md:mb-6 lg:mb-8 drop-shadow-lg animate-fade-in-up px-2" style={{ animationDelay: '0.1s' }}>
                    {currentBanner.subtitle}
                  </p>
                )}
                {currentBanner.cta_label && currentBanner.cta_link && (
                  <Link href={currentBanner.cta_link}>
                    <button className="btn-premium text-sm sm:text-base md:text-lg lg:text-xl px-6 sm:px-7 md:px-8 lg:px-10 py-3 sm:py-3.5 md:py-4 lg:py-5 min-h-[44px] text-black font-bold shadow-xl hover:shadow-2xl animate-fade-in-up w-full sm:w-auto" style={{ animationDelay: '0.2s' }}>
                      {currentBanner.cta_label}
                    </button>
                  </Link>
                )}
              </div>
            </div>

            {/* Navigation Buttons */}
            {validBanners.length > 1 && (
              <>
                {/* Previous Button - Much smaller on mobile */}
                <button
                  onClick={prevBanner}
                  className="absolute left-1.5 sm:left-3 md:left-4 lg:left-6 top-1/2 -translate-y-1/2 z-30 bg-black/50 hover:bg-black/70 backdrop-blur-sm rounded-full p-1 sm:p-1.5 md:p-2 lg:p-3 transition-all duration-300 hover:scale-110 group touch-manipulation flex items-center justify-center"
                  aria-label="Previous banner"
                >
                  <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4 md:h-5 md:w-5 lg:h-6 lg:w-6 xl:h-8 xl:w-8 text-white" />
                </button>

                {/* Next Button - Much smaller on mobile */}
                <button
                  onClick={nextBanner}
                  className="absolute right-1.5 sm:right-3 md:right-4 lg:right-6 top-1/2 -translate-y-1/2 z-30 bg-black/50 hover:bg-black/70 backdrop-blur-sm rounded-full p-1 sm:p-1.5 md:p-2 lg:p-3 transition-all duration-300 hover:scale-110 group touch-manipulation flex items-center justify-center"
                  aria-label="Next banner"
                >
                  <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4 md:h-5 md:w-5 lg:h-6 lg:w-6 xl:h-8 xl:w-8 text-white" />
                </button>

                {/* Banner Indicators - Hidden on mobile, visible on desktop */}
                <div className="hidden sm:flex absolute bottom-2 sm:bottom-3 md:bottom-4 lg:bottom-6 left-1/2 -translate-x-1/2 z-30 gap-0.5 sm:gap-1 md:gap-1.5 lg:gap-2">
                  {validBanners.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentBannerIndex(index)}
                      className={`h-[2px] sm:h-1 md:h-1.5 lg:h-2 rounded-full transition-all duration-300 touch-manipulation ${
                        index === currentBannerIndex
                          ? 'w-[6px] sm:w-2 md:w-4 lg:w-6 xl:w-8 bg-[#F59E0B]'
                          : 'w-[2px] sm:w-1 md:w-1.5 lg:w-2 bg-white/40 hover:bg-white/60'
                      }`}
                      aria-label={`Go to banner ${index + 1}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </section>
      ) : (
        <section className="relative w-full h-[75vh] md:h-[60vh] md:max-h-[600px] min-h-[500px] md:min-h-[400px] bg-gradient-dark overflow-hidden bg-pattern-overlay">
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/80 z-10"></div>
          <div className="absolute inset-0 flex items-center justify-center z-20">
            <div className="container-global text-center text-white px-4">
              <div className="sm:animate-fade-in-up-enhanced max-w-4xl mx-auto">
                <h1 className="hero-heading mb-4 md:mb-6 text-gradient-amber drop-shadow-2xl leading-relaxed">Good Times. Great Food. Live Music.</h1>
                <p className="hero-subheading mb-8 md:mb-10 max-w-2xl mx-auto opacity-95 leading-relaxed">
                  Experience the best nights in town with live bands, handcrafted drinks, and unforgettable vibes.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                  <Link href="/events">
                    <button className="btn-premium text-lg px-8 py-4 min-h-[44px] text-black font-bold shadow-xl hover:shadow-2xl">Explore Events</button>
                  </Link>
                  <Link href="/menu">
                    <button className="bg-transparent border-2 border-white/30 hover:border-[#F59E0B] text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-300 hover:bg-white/5 min-h-[44px] hover:scale-105 hover:shadow-lg hover:shadow-[#F59E0B]/30">
                      View Menu
                    </button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 1.5️⃣ FEATURE HIGHLIGHTS SECTION */}
      {homeFeatures.length > 0 && (
        <section className="section-bg-primary section-spacing -mt-4 md:-mt-6">
          <div className="container-global px-4 sm:px-6">
            <div className="text-center mb-6 sm:mb-8 md:mb-12 sm:animate-fade-in-up">
              <h2 className="section-title mb-3 sm:mb-4 md:mb-6 text-gradient-amber text-2xl sm:text-3xl md:text-4xl leading-relaxed">Let The Good Times Roll!</h2>
              <p className="body-text max-w-3xl mx-auto text-sm sm:text-base md:text-lg opacity-90 px-2">
                Good Times Bar and Grill is your destination for great food, awesome drinks, live music and more! We are located in Maitland, Fl at 1720 Fennell Street and are open daily for happy hour, and dinner.
              </p>
            </div>

            {/* 2x3 Grid of Feature Images */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 md:gap-4 lg:gap-6 max-w-5xl mx-auto">
              {homeFeatures.slice(0, 6).map((feature, index) => {
                const FeatureContent = (
                  <>
                    <div className="aspect-square relative rounded-lg sm:rounded-xl md:rounded-2xl overflow-hidden mb-2 sm:mb-3 md:mb-4 group cursor-pointer sm:hover:scale-105 transition-transform duration-300">
                      {feature.image_path ? (
                        <SupabaseImage
                          src={feature.image_path}
                          alt={feature.title}
                          fill
                          className="object-cover group-hover:scale-110 transition-transform duration-500"
                          bucket="home-features"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-[#F59E0B]/20 to-[#F59E0B]/10 flex items-center justify-center">
                          <Music className="h-8 w-8 sm:h-12 sm:w-12 md:h-16 md:w-16 text-[#F59E0B] opacity-30" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                    </div>
                    <h3 className="text-center text-sm sm:text-base md:text-lg font-semibold text-white leading-relaxed px-1">
                      {feature.title}
                    </h3>
                  </>
                );

                return (
                  <div 
                    key={feature.id || index} 
                    className="sm:animate-fade-in-up"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    {feature.link ? (
                      <Link 
                        href={feature.link}
                        className="block"
                      >
                        {FeatureContent}
                      </Link>
                    ) : (
                      FeatureContent
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* 2️⃣ UPCOMING EVENTS PREVIEW (2 Featured Only) */}
      {featuredEvents.length > 0 && (
        <section className="section-bg-primary section-spacing -mt-4 md:-mt-6">
          <div className="container-global px-4 sm:px-6">
            <div className="text-center mb-8 sm:mb-10 md:mb-16 sm:animate-fade-in-up">
              {/* Subtle glow/radial light behind section title */}
              <div className="relative inline-block">
                <div className="absolute inset-0 bg-[#F59E0B]/10 blur-3xl rounded-full -z-10 transform scale-150"></div>
                <h2 className="section-title mb-3 sm:mb-4 text-gradient-amber relative z-10 text-2xl sm:text-3xl md:text-4xl leading-relaxed">Upcoming Live Events</h2>
              </div>
              <div className="section-divider-enhanced mb-4 sm:mb-6"></div>
              <p className="body-text max-w-2xl mx-auto text-sm sm:text-base md:text-lg opacity-90 px-2">
                Join us for electrifying performances and unforgettable nights
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 md:gap-6 max-w-5xl mx-auto mb-8 sm:mb-10">
              {featuredEvents.map((event, index) => (
                <Link
                  key={event.id}
                  href={`/events/${encodeURIComponent(event.slug)}`}
                  className="event-item-card group cursor-pointer card-hover-lift sm:animate-fade-in-up flex flex-col"
                  style={{ animationDelay: `${index * 0.15}s` }}
                >
                  {event.image_path ? (
                    <div className="relative aspect-[16/10] rounded-lg sm:rounded-xl overflow-hidden mb-2 sm:mb-3 flex-shrink-0">
                      <SupabaseImage
                        src={event.image_path}
                        alt={event.title}
                        fill
                        className="object-cover group-hover:scale-110 transition-transform duration-500"
                        bucket="events"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                      <div className="absolute top-2 right-2 sm:top-3 sm:right-3 bg-[#F59E0B] text-black px-2 py-0.5 sm:px-3 sm:py-1 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-bold">
                        Live Band
                      </div>
                    </div>
                  ) : (
                    <div className="relative aspect-[16/10] rounded-lg sm:rounded-xl overflow-hidden mb-2 sm:mb-3 bg-gradient-to-br from-[#F59E0B]/20 to-[#F59E0B]/10 flex items-center justify-center flex-shrink-0">
                      <Music className="h-10 w-10 sm:h-12 sm:w-12 text-[#F59E0B] opacity-50" />
                    </div>
                  )}
                  
                  <div className="flex-1 flex flex-col justify-between space-y-2 sm:space-y-2.5 px-1">
                    <h3 className="card-title group-hover:text-[#F59E0B] transition-colors text-base sm:text-lg md:text-xl leading-tight line-clamp-2">
                      {event.title}
                    </h3>
                    <div className="space-y-1.5 sm:space-y-2">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1.5 sm:gap-3 text-xs sm:text-sm body-text">
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#F59E0B] flex-shrink-0" />
                          <span>{formatEventDate(event.event_start)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#F59E0B] flex-shrink-0" />
                          <span>{formatEventTime(event.event_start)}</span>
                        </div>
                      </div>
                      {event.location && (
                        <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm body-text">
                          <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-400 flex-shrink-0" />
                          <span className="break-words line-clamp-1">{event.location}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            <div className="text-center px-4">
              <Link href="/events">
                <button className="inline-flex items-center gap-2 btn-premium text-black font-bold px-6 sm:px-8 py-3 sm:py-4 rounded-xl text-base sm:text-lg min-h-[44px] shadow-xl hover:shadow-2xl w-full sm:w-auto">
                  Explore More Events
                  <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* 2.5️⃣ PARTIES & EVENTS SECTION */}
      {partiesImages.length > 0 && (
        <section className="section-bg-primary section-spacing">
          <div className="container-global px-4 sm:px-6">
            {/* Heading at the top of the complete component */}
            <div className="text-center mb-8 sm:mb-10 md:mb-12 sm:animate-fade-in-up">
              <h2 className="section-title mb-3 sm:mb-4 md:mb-5 text-gradient-amber text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight">
                Parties & Events!
              </h2>
              <div className="section-divider-enhanced mx-auto max-w-xs"></div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 md:gap-10 lg:gap-12 items-center">
              {/* Left Side - Images Grid (Desktop) / Top (Mobile) */}
              <div className="order-1 lg:order-1 sm:animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                <div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:gap-4 lg:gap-5">
                  {partiesImages.slice(0, 4).map((image, index) => (
                    <div
                      key={image.id || index}
                      className="relative aspect-square rounded-lg sm:rounded-xl overflow-hidden group cursor-pointer shadow-lg hover:shadow-xl transition-shadow duration-300"
                    >
                      <SupabaseImage
                        src={image.image_path}
                        alt={image.caption || `Party event ${index + 1}`}
                        fill
                        className="object-cover group-hover:scale-110 transition-transform duration-500"
                        bucket="gallery"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Side - Text Content (Desktop) / Bottom (Mobile) */}
              <div className="order-2 lg:order-2 sm:animate-fade-in-up lg:pr-0" style={{ animationDelay: '0.2s' }}>
                <ul className="space-y-3 sm:space-y-3.5 md:space-y-4 lg:space-y-4 mb-6 sm:mb-8">
                  <li className="flex items-start gap-2.5 sm:gap-3 md:gap-3 lg:gap-3.5 group">
                    <div className="flex-shrink-0 mt-1.5 sm:mt-2 lg:mt-2.5">
                      <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 lg:w-3 lg:h-3 bg-[#F59E0B] rounded-full group-hover:scale-125 transition-transform duration-300 shadow-[0_0_8px_rgba(245,158,11,0.5)]"></div>
                    </div>
                    <span className="body-text text-base sm:text-lg md:text-xl lg:text-2xl leading-relaxed font-medium text-gray-200 group-hover:text-white transition-colors flex-1">Catering (Custom Menus Available)</span>
                  </li>
                  <li className="flex items-start gap-2.5 sm:gap-3 md:gap-3 lg:gap-3.5 group">
                    <div className="flex-shrink-0 mt-1.5 sm:mt-2 lg:mt-2.5">
                      <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 lg:w-3 lg:h-3 bg-[#F59E0B] rounded-full group-hover:scale-125 transition-transform duration-300 shadow-[0_0_8px_rgba(245,158,11,0.5)]"></div>
                    </div>
                    <span className="body-text text-base sm:text-lg md:text-xl lg:text-2xl leading-relaxed font-medium text-gray-200 group-hover:text-white transition-colors flex-1">Three Large Full-Service Bars</span>
                  </li>
                  <li className="flex items-start gap-2.5 sm:gap-3 md:gap-3 lg:gap-3.5 group">
                    <div className="flex-shrink-0 mt-1.5 sm:mt-2 lg:mt-2.5">
                      <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 lg:w-3 lg:h-3 bg-[#F59E0B] rounded-full group-hover:scale-125 transition-transform duration-300 shadow-[0_0_8px_rgba(245,158,11,0.5)]"></div>
                    </div>
                    <span className="body-text text-base sm:text-lg md:text-xl lg:text-2xl leading-relaxed font-medium text-gray-200 group-hover:text-white transition-colors flex-1">A Massive Stage</span>
                  </li>
                  <li className="flex items-start gap-2.5 sm:gap-3 md:gap-3 lg:gap-3.5 group">
                    <div className="flex-shrink-0 mt-1.5 sm:mt-2 lg:mt-2.5">
                      <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 lg:w-3 lg:h-3 bg-[#F59E0B] rounded-full group-hover:scale-125 transition-transform duration-300 shadow-[0_0_8px_rgba(245,158,11,0.5)]"></div>
                    </div>
                    <span className="body-text text-base sm:text-lg md:text-xl lg:text-2xl leading-relaxed font-medium text-gray-200 group-hover:text-white transition-colors flex-1">Incredible Light Show</span>
                  </li>
                  <li className="flex items-start gap-2.5 sm:gap-3 md:gap-3 lg:gap-3.5 group">
                    <div className="flex-shrink-0 mt-1.5 sm:mt-2 lg:mt-2.5">
                      <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 lg:w-3 lg:h-3 bg-[#F59E0B] rounded-full group-hover:scale-125 transition-transform duration-300 shadow-[0_0_8px_rgba(245,158,11,0.5)]"></div>
                    </div>
                    <span className="body-text text-base sm:text-lg md:text-xl lg:text-2xl leading-relaxed font-medium text-gray-200 group-hover:text-white transition-colors flex-1">Built In Sound System</span>
                  </li>
                  <li className="flex items-start gap-2.5 sm:gap-3 md:gap-3 lg:gap-3.5 group">
                    <div className="flex-shrink-0 mt-1.5 sm:mt-2 lg:mt-2.5">
                      <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 lg:w-3 lg:h-3 bg-[#F59E0B] rounded-full group-hover:scale-125 transition-transform duration-300 shadow-[0_0_8px_rgba(245,158,11,0.5)]"></div>
                    </div>
                    <span className="body-text text-base sm:text-lg md:text-xl lg:text-2xl leading-relaxed font-medium text-gray-200 group-hover:text-white transition-colors flex-1">An 8,000 Square Foot Venue</span>
                  </li>
                </ul>
                <div className="mt-4 sm:mt-6">
                  <Link href="/contact">
                    <button className="inline-flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-4 bg-[#F59E0B] hover:bg-[#F59E0B]/90 text-black font-bold rounded-xl text-sm sm:text-base md:text-lg transition-all duration-300 hover:scale-105 hover:shadow-[0_0_20px_rgba(245,158,11,0.5)] shadow-lg min-h-[44px]">
                      Contact Us
                      <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
                    </button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 3️⃣ MENU PREVIEW (4 Items Only) */}
      {previewMenuItems.length > 0 && (
        <section className="section-bg-alt section-spacing">
          <div className="container-global px-4 sm:px-6">
            <div className="text-center mb-8 sm:mb-10 md:mb-16 sm:animate-fade-in-up">
              <h2 className="section-title mb-3 sm:mb-4 text-gradient-amber text-2xl sm:text-3xl md:text-4xl leading-relaxed">Signature Dishes & Craft Drinks</h2>
              <div className="section-divider-enhanced mb-4 sm:mb-6"></div>
              <p className="body-text max-w-2xl mx-auto text-sm sm:text-base md:text-lg opacity-90 px-2">
                Handcrafted with passion, served with excellence
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3 md:gap-4 lg:gap-5 xl:gap-6 mb-8 sm:mb-10">
              {previewMenuItems.map((item, index) => {
                const price = item.menu_item_variants && item.menu_item_variants.length > 0
                  ? item.menu_item_variants[0].price
                  : item.base_price || 0
                return (
                  <div 
                    key={item.id} 
                    className="menu-item-card-premium sm:animate-fade-in-up-enhanced group rounded-lg md:rounded-xl card-hover-premium min-h-[180px] sm:min-h-[200px] md:min-h-[220px]" 
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    {/* Image Section */}
                    {item.image_path ? (
                      <div className="aspect-[4/3] relative overflow-hidden rounded-t-md sm:rounded-t-lg md:rounded-t-xl group-hover:rounded-t-md sm:group-hover:rounded-t-lg md:group-hover:rounded-t-xl transition-all duration-300">
                        <Link href={`/menu/${item.id}`}>
                          <SupabaseImage
                            src={item.image_path}
                            alt={item.name}
                            fill
                            className="object-cover group-hover:scale-110 transition-transform duration-500"
                            bucket="menu-items"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>
                          {item.is_featured && (
                            <span className="hidden sm:inline-flex absolute top-1.5 right-1.5 md:top-2 md:right-2 bg-[#F59E0B] text-black px-1.5 py-0.5 md:px-2 md:py-1 rounded text-[9px] md:text-[10px] font-bold shadow-lg backdrop-blur-sm">
                              Featured
                            </span>
                          )}
                          {item.is_veg && (
                            <span className="hidden sm:inline-flex absolute top-1.5 left-1.5 md:top-2 md:left-2 bg-green-500 text-white px-1.5 py-0.5 md:px-2 md:py-1 rounded text-[9px] md:text-[10px] font-bold flex items-center gap-1 shadow-lg backdrop-blur-sm">
                              <Leaf className="h-2 w-2 md:h-2.5 md:w-2.5" />
                              Veg
                            </span>
                          )}
                        </Link>
                      </div>
                    ) : (
                      <div className="aspect-[4/3] bg-gradient-to-br from-[#111111] to-[#0E0E0E] relative flex items-center justify-center border-b border-white/10 rounded-t-md sm:rounded-t-lg md:rounded-t-xl">
                        {item.is_featured && (
                          <span className="absolute top-1 right-1 sm:top-1.5 sm:right-1.5 md:top-2 md:right-2 bg-[#F59E0B] text-black px-1 py-0.5 sm:px-1.5 sm:py-0.5 md:px-2 md:py-1 rounded text-[8px] sm:text-[9px] md:text-[10px] font-bold shadow-lg">
                            Featured
                          </span>
                        )}
                        {item.is_veg && (
                          <span className="absolute top-1 left-1 sm:top-1.5 sm:left-1.5 md:top-2 md:left-2 bg-green-500 text-white px-1 py-0.5 sm:px-1.5 sm:py-0.5 md:px-2 md:py-1 rounded text-[8px] sm:text-[9px] md:text-[10px] font-bold flex items-center gap-0.5 sm:gap-1 shadow-lg">
                            <Leaf className="h-1.5 w-1.5 sm:h-2 sm:w-2 md:h-2.5 md:w-2.5" />
                            Veg
                          </span>
                        )}
                        <UtensilsCrossed className="h-6 w-6 sm:h-8 sm:w-8 md:h-10 md:w-10 lg:h-12 lg:w-12 text-[#F59E0B] opacity-30" />
                      </div>
                    )}

                    {/* Content Section */}
                    <div className="p-2 sm:p-2.5 md:p-3 lg:p-4">
                      <Link href={`/menu/${item.id}`}>
                        <div className="flex items-start justify-between group-hover:text-[#F59E0B] transition-colors gap-1.5 sm:gap-2">
                          <h3 className="card-title flex-1 text-xs sm:text-sm md:text-base leading-relaxed line-clamp-2">{item.name}</h3>
                          <div className="text-right flex-shrink-0">
                            <span className="text-sm sm:text-base md:text-lg font-semibold price-amber block whitespace-nowrap">
                              ${price.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="text-center px-4">
              <Link href="/menu">
                <button className="inline-flex items-center gap-2 btn-premium text-black font-bold px-6 sm:px-8 py-3 sm:py-4 rounded-xl text-base sm:text-lg min-h-[44px] shadow-xl hover:shadow-2xl w-full sm:w-auto">
                  View Full Menu
                  <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* 4️⃣ EXPERIENCE / VIBE SECTION */}
      <section className="section-bg-primary section-spacing">
        <div className="container-global px-4 sm:px-6">
          <div className="text-center mb-8 sm:mb-10 md:mb-16 sm:animate-fade-in-up">
            <h2 className="section-title mb-3 sm:mb-4 text-gradient-amber text-2xl sm:text-3xl md:text-4xl leading-relaxed">More Than Food. It's an Experience.</h2>
            <div className="section-divider-enhanced mb-4 sm:mb-6"></div>
            <p className="body-text max-w-2xl mx-auto text-sm sm:text-base md:text-lg opacity-90 px-2">
              Where great food, live music, and amazing vibes come together
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 md:gap-8 max-w-6xl mx-auto">
            {[
              {
                icon: Music,
                title: 'Live Bands Every Weekend',
                description: 'Experience electrifying performances from local and touring artists',
                link: '/events'
              },
              {
                icon: Beer,
                title: 'Premium Beers & Cocktails',
                description: 'Handcrafted drinks and an extensive selection of craft beers',
                link: '/menu'
              },
              {
                icon: ChefHat,
                title: 'Chef-Crafted Menu',
                description: 'Fresh ingredients, bold flavors, and dishes made with passion',
                link: '/menu'
              },
              {
                icon: Calendar,
                title: 'Private Parties & Events',
                description: 'Host your special occasions in our vibrant atmosphere',
                link: '/reservations'
              }
            ].map((item, index) => {
              const cardContent = (
                <>
                  <div className="mb-3 sm:mb-4 flex justify-center">
                    <div className="bg-[#F59E0B]/10 rounded-full p-3 sm:p-4 group-hover:bg-[#F59E0B]/20 transition-colors">
                      <item.icon className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 lg:h-10 lg:w-10 text-[#F59E0B]" />
                    </div>
                  </div>
                  <h3 className="card-title mb-2 text-base sm:text-lg md:text-xl leading-relaxed">{item.title}</h3>
                  <p className="body-text text-xs sm:text-sm leading-relaxed">{item.description}</p>
                </>
              );

              if (item.link) {
                return (
                  <Link
                    key={index}
                    href={item.link}
                    className="event-item-card text-center group hover:border-[#F59E0B]/50 transition-all duration-300 card-hover-lift sm:animate-fade-in-up block"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    {cardContent}
                  </Link>
                );
              }

              return (
                <div
                  key={index}
                  className="event-item-card text-center group hover:border-[#F59E0B]/50 transition-all duration-300 card-hover-lift sm:animate-fade-in-up"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  {cardContent}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 5️⃣ GALLERY PREVIEW */}
      <section className="section-bg-alt section-spacing-sm">
        <div className="container-global px-4 sm:px-6">
          <div className="text-center mb-6 sm:mb-8 md:mb-12 sm:animate-fade-in-up">
            <h2 className="section-title mb-3 sm:mb-4 text-gradient-amber text-2xl sm:text-3xl md:text-4xl leading-relaxed">Atmosphere & Vibes</h2>
            <div className="section-divider-enhanced mb-4 sm:mb-6"></div>
            <p className="body-text max-w-2xl mx-auto text-sm sm:text-base md:text-lg opacity-90 px-2">
              Experience the energy and ambiance that makes every visit special
            </p>
          </div>

          <div className="overflow-x-auto scrollbar-hide pb-4 -mx-4 sm:mx-0 relative after:absolute after:right-0 after:top-0 after:h-full after:w-8 after:bg-gradient-to-l after:from-black/40 after:to-transparent after:pointer-events-none sm:after:hidden">
            <div className="flex gap-3 sm:gap-4 md:gap-6 min-w-max md:min-w-0 md:grid md:grid-cols-4 px-4 sm:px-0">
              {galleryImages.length > 0 ? (
                galleryImages.map((image) => (
                  <div
                    key={image.id}
                    className="gallery-item-card w-[160px] sm:w-[180px] md:w-auto aspect-square flex-shrink-0"
                  >
                    {image.image_path ? (
                      <SupabaseImage
                        src={image.image_path}
                        alt={image.caption || 'Gallery image'}
                        fill
                        className="object-cover"
                        bucket="gallery"
                      />
                    ) : (
                      <div className="h-full w-full bg-gradient-to-br from-[#F59E0B]/20 to-[#F59E0B]/10 flex items-center justify-center">
                        <Music className="h-16 w-16 text-[#F59E0B] opacity-30" />
                      </div>
                    )}
                  </div>
                ))
              ) : (
                [1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="gallery-item-card w-[180px] sm:w-[220px] md:w-auto aspect-square flex-shrink-0"
                  >
                    <div className="h-full w-full bg-gradient-to-br from-[#F59E0B]/20 to-[#F59E0B]/10 flex items-center justify-center">
                      <Music className="h-16 w-16 text-[#F59E0B] opacity-30" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="text-center mt-6 sm:mt-8 px-4">
            <Link href="/gallery">
              <button className="inline-flex items-center gap-2 btn-premium text-black font-bold px-6 sm:px-8 py-3 sm:py-4 rounded-xl text-base sm:text-lg min-h-[44px] shadow-xl hover:shadow-2xl w-full sm:w-auto">
                View Full Gallery
                <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* 6️⃣ LOCATION & TIMINGS */}
      <section className="section-bg-primary section-spacing-sm">
        <div className="container-global px-4 sm:px-6">
          <div className="text-center mb-8 sm:mb-10 md:mb-12">
            <h2 className="section-title mb-3 sm:mb-4 text-gradient-amber text-2xl sm:text-3xl md:text-4xl leading-relaxed">Visit Us</h2>
            <div className="section-divider-enhanced mb-4 sm:mb-6"></div>
            <p className="body-text max-w-2xl mx-auto text-sm sm:text-base md:text-lg opacity-90 px-2">
              We're here to make your experience unforgettable
            </p>
          </div>

          <div className="max-w-6xl mx-auto">
            {/* Two cards: Contact & Location combined, and Hours */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {/* Contact & Location - Combined */}
              <div className="order-1 md:order-none">
                <ContactAndLocationCard siteInfo={siteInfo} />
              </div>

              {/* Hours - Second on mobile */}
              <div className="event-item-card order-2 md:order-none">
                <h3 className="card-title mb-4 leading-relaxed">Opening Hours</h3>
                <div className="space-y-2 body-text leading-relaxed">
                  {openingHours.length > 0 ? (
                    openingHours.map((hour: any) => {
                      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
                      const dayName = dayNames[hour.weekday] || `Day ${hour.weekday}`
                      const timeDisplay = hour.is_closed 
                        ? 'Closed' 
                        : hour.open_time && hour.close_time
                        ? `${convert24To12(hour.open_time)} - ${convert24To12(hour.close_time)}`
                        : 'Closed'
                      
                      return (
                        <div key={hour.weekday} className="flex justify-between">
                          <span>{dayName}</span>
                          <span>{timeDisplay}</span>
                        </div>
                      )
                    })
                  ) : (
                    <>
                      <div className="flex justify-between">
                        <span>Monday - Thursday</span>
                        <span>5:00 PM - 12:00 AM</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Friday - Saturday</span>
                        <span>5:00 PM - 2:00 AM</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Sunday</span>
                        <span>4:00 PM - 11:00 PM</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

// Contact & Location Combined Card Component
function ContactAndLocationCard({ siteInfo }: { siteInfo: { address: string; phone: string; email: string } }) {
  const [contactInfo, setContactInfo] = useState({
    phone: '',
    email: ''
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchContactInfo = async () => {
      try {
        const settings = await getAllSiteSettings()
        setContactInfo({
          phone: settings.restaurant_phone || settings.phone || '',
          email: settings.restaurant_email || settings.email || ''
        })
      } catch (error) {
        console.error('Error fetching contact info:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchContactInfo()
  }, [])

  if (loading) {
    return (
      <div className="event-item-card">
        <h3 className="card-title mb-4 leading-relaxed">Contact & Location</h3>
        <p className="body-text opacity-50">Loading information...</p>
      </div>
    )
  }

  const hasContact = contactInfo.phone || contactInfo.email
  const hasLocation = siteInfo.address

  if (!hasContact && !hasLocation) {
    return null
  }

  return (
    <div className="event-item-card">
      <h3 className="card-title mb-4 leading-relaxed">Contact & Location</h3>
      
      {/* Contact Section */}
      {hasContact && (
        <div className="space-y-3 mb-6">
          {contactInfo.phone && (
            <div className="flex items-start gap-3">
              <Phone className="h-5 w-5 text-[#F59E0B] mt-1 flex-shrink-0" />
              <div className="flex-1">
                <a 
                  href={`tel:${contactInfo.phone.replace(/\D/g, '')}`} 
                  className="body-text hover:text-[#F59E0B] transition-colors block mb-2 leading-relaxed"
                >
                  {contactInfo.phone}
                </a>
                <a 
                  href={`tel:${contactInfo.phone.replace(/\D/g, '')}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#F59E0B]/10 hover:bg-[#F59E0B]/20 border border-[#F59E0B]/30 hover:border-[#F59E0B]/50 text-[#F59E0B] rounded-lg transition-all duration-300 hover:scale-105 hover:shadow-[0_0_12px_rgba(245,158,11,0.3)] relative z-10"
                  style={{ position: 'relative', zIndex: 10 }}
                >
                  <Phone className="h-3.5 w-3.5" />
                  <span>Call Us</span>
                </a>
              </div>
            </div>
          )}
          {contactInfo.email && (
            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-[#F59E0B] mt-1 flex-shrink-0" />
              <div className="flex-1">
                <a 
                  href={`mailto:${contactInfo.email}`} 
                  className="body-text hover:text-[#F59E0B] transition-colors break-all block mb-2 leading-relaxed"
                >
                  {contactInfo.email}
                </a>
                <a 
                  href={`mailto:${contactInfo.email}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#F59E0B]/10 hover:bg-[#F59E0B]/20 border border-[#F59E0B]/30 hover:border-[#F59E0B]/50 text-[#F59E0B] rounded-lg transition-all duration-300 hover:scale-105 hover:shadow-[0_0_12px_rgba(245,158,11,0.3)] relative z-10"
                  style={{ position: 'relative', zIndex: 10 }}
                >
                  <Mail className="h-3.5 w-3.5" />
                  <span>Send Email</span>
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Location Section */}
      {hasLocation && (
        <div className="flex items-start gap-3">
          <MapPin className="h-5 w-5 text-[#F59E0B] mt-1 flex-shrink-0" />
          <div className="flex-1">
            <a 
              href={`https://maps.google.com/?q=${encodeURIComponent(siteInfo.address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="body-text hover:text-[#F59E0B] transition-colors leading-relaxed block mb-3"
            >
              {siteInfo.address}
            </a>
            <a 
              href={`https://maps.google.com/?q=${encodeURIComponent(siteInfo.address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#F59E0B]/10 hover:bg-[#F59E0B]/20 border border-[#F59E0B]/30 hover:border-[#F59E0B]/50 text-[#F59E0B] rounded-lg transition-all duration-300 hover:scale-105 hover:shadow-[0_0_12px_rgba(245,158,11,0.3)] relative z-10"
              style={{ position: 'relative', zIndex: 10 }}
            >
              <MapPin className="h-3.5 w-3.5" />
              <span>Get Directions</span>
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
