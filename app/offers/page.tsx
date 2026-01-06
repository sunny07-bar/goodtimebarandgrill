import { Card, CardContent } from '@/components/ui/card'
import { Tag, Calendar, Clock } from 'lucide-react'
import { formatFloridaTime } from '@/lib/utils/timezone'
import { getActiveOffers } from '@/lib/queries'
import SupabaseImage from '@/components/SupabaseImage'

// Production-ready ISR: Revalidate every 10 minutes (600 seconds) - offers may change periodically
// Cached for performance; updates when offers change
export const revalidate = 600

export default async function OffersPage() {
  const offers = await getActiveOffers()

  const formatDays = (days: string[] | null) => {
    if (!days || days.length === 0) return 'Any day'
    const dayMap: { [key: string]: string } = {
      MON: 'Monday',
      TUE: 'Tuesday',
      WED: 'Wednesday',
      THU: 'Thursday',
      FRI: 'Friday',
      SAT: 'Saturday',
      SUN: 'Sunday',
    }
    return days.map(d => dayMap[d] || d).join(', ')
  }

  const formatDiscount = (offer: any) => {
    switch (offer.offer_type) {
      case 'percentage_discount':
        return `${offer.discount_value}% OFF`
      case 'flat_discount':
        return `$${offer.discount_value} OFF`
      case 'bundle':
        return `$${offer.discount_value}`
      default:
        return 'Special Offer'
    }
  }

  return (
    <div className="section-bg-primary section-spacing">
      <div className="container-global">
        <div className="text-center mb-12 md:mb-16">
          <h1 className="section-title mb-4">SPECIAL OFFERS</h1>
          <div className="section-divider mb-6"></div>
          <p className="body-text max-w-3xl mx-auto text-lg">
            Take advantage of our amazing deals and promotions!
          </p>
        </div>

        {offers.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 lg:gap-8">
            {offers.map((offer) => {
              return (
                <div key={offer.id} className="card-premium overflow-hidden group hover:border-[#F59E0B]/50">
                  {offer.image_path ? (
                    <div className="h-48 md:h-56 relative -m-4 md:-m-6 lg:-m-8 mb-4 md:mb-6 lg:mb-8">
                      <SupabaseImage
                        src={offer.image_path}
                        alt={offer.title}
                        fill
                        className="object-cover group-hover:scale-110 transition-transform duration-700"
                        bucket="offers"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                      <div className="absolute top-3 md:top-4 right-3 md:right-4">
                        <span className="badge-featured text-xs md:text-sm">
                          {formatDiscount(offer)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="h-48 md:h-56 relative -m-4 md:-m-6 lg:-m-8 mb-4 md:mb-6 lg:mb-8 bg-gradient-to-br from-[#F59E0B]/30 to-[#F59E0B]/10">
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                      <div className="absolute top-3 md:top-4 right-3 md:right-4">
                        <span className="badge-featured text-xs md:text-sm">
                          {formatDiscount(offer)}
                        </span>
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Tag className="h-12 w-12 md:h-16 md:w-16 text-[#F59E0B] opacity-30" />
                      </div>
                    </div>
                  )}
                  <div className="space-y-3 md:space-y-4">
                    <div className="flex items-center gap-2 md:gap-3">
                      <div className="bg-[#F59E0B]/10 rounded-lg p-1.5 md:p-2 border border-[#F59E0B]/20">
                        <Tag className="h-4 w-4 md:h-5 md:w-5 text-[#F59E0B]" />
                      </div>
                      <h3 className="card-title text-base md:text-lg">{offer.title}</h3>
                    </div>
                    {offer.description && (
                      <p className="body-text text-xs md:text-sm leading-relaxed">{offer.description}</p>
                    )}
                    
                    <div className="space-y-2 md:space-y-3 pt-3 md:pt-4 border-t border-white/10">
                      {offer.start_date && offer.end_date && (
                        <div className="flex items-center gap-2 md:gap-3">
                          <div className="bg-[#F59E0B]/10 rounded-lg p-1 md:p-1.5 border border-[#F59E0B]/20">
                            <Calendar className="h-3.5 w-3.5 md:h-4 md:w-4 text-[#F59E0B]" />
                          </div>
                          <span className="body-text text-xs md:text-sm">
                            {formatFloridaTime(offer.start_date, 'MM-dd-yyyy')} - {formatFloridaTime(offer.end_date, 'MM-dd-yyyy')}
                          </span>
                        </div>
                      )}
                      {offer.days_of_week && offer.days_of_week.length > 0 && (
                        <div className="flex items-center gap-2 md:gap-3">
                          <div className="bg-[#F59E0B]/10 rounded-lg p-1 md:p-1.5 border border-[#F59E0B]/20">
                            <Calendar className="h-3.5 w-3.5 md:h-4 md:w-4 text-[#F59E0B]" />
                          </div>
                          <span className="body-text text-xs md:text-sm">{formatDays(offer.days_of_week)}</span>
                        </div>
                      )}
                      {offer.time_from && offer.time_to && (
                        <div className="flex items-center gap-2 md:gap-3">
                          <div className="bg-[#F59E0B]/10 rounded-lg p-1 md:p-1.5 border border-[#F59E0B]/20">
                            <Clock className="h-3.5 w-3.5 md:h-4 md:w-4 text-[#F59E0B]" />
                          </div>
                          <span className="body-text text-xs md:text-sm">
                            {offer.time_from} - {offer.time_to}
                          </span>
                        </div>
                      )}
                      {offer.min_order_amount && (
                        <p className="body-text text-xs md:text-sm opacity-75">
                          Minimum order: <span className="price-amber font-semibold">${offer.min_order_amount}</span>
                        </p>
                      )}
                    </div>

                    <button className="btn-amber w-full mt-4 md:mt-6 min-h-[44px] md:min-h-[48px] text-sm md:text-base touch-manipulation">
                      Use This Offer
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-12 md:py-16 lg:py-20">
            <div className="card-premium max-w-md mx-auto p-6 md:p-8">
              <Tag className="h-12 w-12 md:h-16 md:w-16 text-[#F59E0B] mx-auto mb-4 md:mb-6 opacity-50" />
              <p className="body-text text-base md:text-lg font-medium">No active offers at the moment. Check back soon!</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
