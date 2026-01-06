'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { Leaf, UtensilsCrossed, Wine, ChefHat } from 'lucide-react'
import SupabaseImage from '@/components/SupabaseImage'
import Link from 'next/link'

interface MenuClientProps {
  categories: any[]
  items: any[]
}

export default function MenuClient({ categories, items }: MenuClientProps) {
  // Toggle between 'food' and 'drink'
  const [selectedType, setSelectedType] = useState<'food' | 'drink'>('food')
  
  // Handle tab change (no animation)
  const handleTabChange = (type: 'food' | 'drink') => {
    if (selectedType === type) return
    setSelectedType(type)
  }
  
  // Filter categories by type (default to 'food' if category_type is null for backward compatibility)
  const filteredCategories = useMemo(() => {
    return categories.filter(cat => (cat.category_type || 'food') === selectedType)
  }, [categories, selectedType])
  
  // Default to first category of selected type if available
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  
  // Update selected category when type changes
  useEffect(() => {
    if (filteredCategories.length > 0) {
      // Try to keep the same category if it exists in the new filtered list
      const currentCategoryExists = filteredCategories.find(cat => cat.id === selectedCategoryId)
      if (!currentCategoryExists) {
        setSelectedCategoryId(filteredCategories[0].id)
      }
    } else {
      setSelectedCategoryId(null)
    }
  }, [selectedType, filteredCategories, selectedCategoryId])

  // Auto-scroll active category into view (instant, no animation)
  useEffect(() => {
    if (selectedCategoryId && categoryScrollRef.current) {
      const activeButton = categoryScrollRef.current.querySelector(`[data-category-id="${selectedCategoryId}"]`) as HTMLElement
      if (activeButton) {
        activeButton.scrollIntoView({
          behavior: 'auto', // Instant scroll, no animation
          inline: 'center',
          block: 'nearest'
        })
      }
    }
  }, [selectedCategoryId])
  
  // Initialize with first category on mount
  useEffect(() => {
    if (filteredCategories.length > 0 && !selectedCategoryId) {
      setSelectedCategoryId(filteredCategories[0].id)
    }
  }, [filteredCategories, selectedCategoryId])

  // Scroll tracking for category selector
  const categoryScrollRef = useRef<HTMLDivElement>(null)
  const [scrollProgress, setScrollProgress] = useState(0)
  const [canScroll, setCanScroll] = useState(false)

  // Check if scrolling is possible and track scroll progress
  useEffect(() => {
    const container = categoryScrollRef.current
    if (!container) return

    const updateScrollInfo = () => {
      const { scrollLeft, scrollWidth, clientWidth } = container
      const maxScroll = scrollWidth - clientWidth
      const progress = maxScroll > 0 ? scrollLeft / maxScroll : 0
      
      setScrollProgress(progress)
      setCanScroll(maxScroll > 0)
    }

    // Initial check
    updateScrollInfo()

    // Update on scroll
    container.addEventListener('scroll', updateScrollInfo)
    
    // Update on resize
    window.addEventListener('resize', updateScrollInfo)

    return () => {
      container.removeEventListener('scroll', updateScrollInfo)
      window.removeEventListener('resize', updateScrollInfo)
    }
  }, [filteredCategories])

  // Filter items based on selected category
  const filteredItems = selectedCategoryId
    ? items.filter(item => item.category_id === selectedCategoryId)
    : []

  // Get the selected category name for display
  const selectedCategory = selectedCategoryId
    ? categories.find(cat => cat.id === selectedCategoryId)
    : null

  return (
    <div className="section-spacing relative" style={{
      background: 'radial-gradient(60% 40% at 50% 0%, rgba(245,158,11,0.08), transparent 60%), linear-gradient(180deg, #0b0b0b, #050505)'
    }}>
      <div className="container-global relative z-10" style={{
        paddingLeft: 'max(16px, env(safe-area-inset-left, 16px))',
        paddingRight: 'max(16px, env(safe-area-inset-right, 16px))'
      }}>
        <div className="text-center mb-12 md:mb-16">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 text-gradient-amber" style={{
            fontFamily: "'Playfair Display', serif",
            letterSpacing: '1px',
            fontWeight: 700
          }}>OUR MENU</h1>
          <div className="section-divider-enhanced mb-6"></div>
          <p className="body-text max-w-3xl mx-auto text-base md:text-lg opacity-90">
            Discover our delicious selection of food and drinks, crafted with care and passion.
          </p>
        </div>

      {/* Food/Drink Toggle */}
      <div className="mb-10 md:mb-14 flex justify-center">
        <div className="inline-flex bg-[#111111] border-2 border-white/10 rounded-2xl p-2 gap-2 shadow-2xl">
          <button
            onClick={() => handleTabChange('food')}
            className={`flex items-center gap-3 px-8 md:px-10 py-4 md:py-5 rounded-xl font-semibold min-h-[52px] relative overflow-hidden ${
              selectedType === 'food'
                ? 'bg-gradient-to-r from-[#fbbf24] to-[#f59e0b] text-black shadow-lg shadow-[#F59E0B]/35 scale-105'
                : 'text-[#D1D5DB] hover:text-[#F59E0B]'
            }`}
          >
            <ChefHat className={`h-5 w-5 md:h-6 md:w-6 ${selectedType === 'food' ? 'scale-110' : ''}`} />
            <span className="text-base md:text-lg">Food</span>
          </button>
          <button
            onClick={() => handleTabChange('drink')}
            className={`flex items-center gap-3 px-8 md:px-10 py-4 md:py-5 rounded-xl font-semibold min-h-[52px] relative overflow-hidden ${
              selectedType === 'drink'
                ? 'bg-gradient-to-r from-[#fbbf24] to-[#f59e0b] text-black shadow-lg shadow-[#F59E0B]/35 scale-105'
                : 'text-[#D1D5DB] hover:text-[#F59E0B]'
            }`}
          >
            <Wine className={`h-5 w-5 md:h-6 md:w-6 ${selectedType === 'drink' ? 'scale-110' : ''}`} />
            <span className="text-base md:text-lg">Drinks</span>
          </button>
        </div>
      </div>

      {/* Premium Category Selector with Fade Edges */}
      <div className="mb-12 md:mb-16 relative">
        <div className="relative menu-categories-wrapper">
          {/* Left fade gradient */}
          <div className="absolute left-0 top-0 bottom-4 w-12 md:w-16 bg-gradient-to-r from-[#0b0b0b] to-transparent pointer-events-none z-10"></div>
          
          {/* Right fade gradient */}
          <div className="absolute right-0 top-0 bottom-4 w-12 md:w-16 bg-gradient-to-l from-[#0b0b0b] to-transparent pointer-events-none z-10"></div>
          
          <div 
            ref={categoryScrollRef}
            className="flex gap-3 md:gap-4 overflow-x-auto pb-4 scrollbar-hide px-4 md:px-6 justify-start md:justify-center"
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch'
            }}
          >
            {filteredCategories.map((category) => (
              <button
                key={category.id}
                data-category-id={category.id}
                onClick={() => setSelectedCategoryId(category.id)}
                className={`relative whitespace-nowrap text-sm md:text-base px-6 md:px-8 py-3 md:py-4 rounded-xl font-semibold min-h-[44px] flex-shrink-0 ${
                  selectedCategoryId === category.id
                    ? 'bg-gradient-to-r from-[#fbbf24] to-[#f59e0b] text-black shadow-[0_8px_30px_rgba(245,158,11,0.35)] scale-110'
                    : 'bg-[#111111] border-2 border-white/10 text-[#D1D5DB] hover:bg-[#F59E0B]/10 hover:border-[#F59E0B]/40 hover:text-[#F59E0B] hover:scale-105'
                }`}
              >
                {category.name}
                {selectedCategoryId === category.id && (
                  <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-black/20 rounded-full animate-pulse"></span>
                )}
              </button>
            ))}
          </div>
        </div>
        
        {/* Horizontal Scroll Indicator Bar */}
        {canScroll && (
          <div className="mt-4 px-4 md:px-0">
            <div className="relative h-1.5 bg-white/5 rounded-full overflow-hidden">
              {/* Animated background gradient */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#F59E0B]/20 to-transparent animate-pulse"></div>
              
              {/* Scroll progress indicator */}
              <div 
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#F59E0B]/60 via-[#F59E0B] to-[#F59E0B]/60 transition-all duration-300 ease-out rounded-full"
                style={{ width: `${Math.max(10, scrollProgress * 100)}%` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
              </div>
              
              {/* Scroll hint dots */}
              <div className="absolute inset-0 flex items-center justify-between px-2 pointer-events-none">
                <div className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${scrollProgress > 0.1 ? 'bg-[#F59E0B]/40' : 'bg-[#F59E0B] animate-pulse'}`}></div>
                <div className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${scrollProgress > 0.5 ? 'bg-[#F59E0B]/40' : 'bg-[#F59E0B] animate-pulse'}`}></div>
                <div className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${scrollProgress > 0.9 ? 'bg-[#F59E0B]/40' : 'bg-[#F59E0B] animate-pulse'}`}></div>
              </div>
            </div>
            
            {/* Scroll hint text (only on mobile) */}
            <div className="mt-2 flex items-center justify-center gap-2 md:hidden">
              <svg className="w-4 h-4 text-[#F59E0B]/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
              </svg>
              <span className="text-xs text-[#F59E0B]/60 font-medium">Swipe to see more</span>
              <svg className="w-4 h-4 text-[#F59E0B]/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* Selected Category Info */}
      {selectedCategory && (
        <div className="mb-10 md:mb-12 pb-6 border-b border-white/10">
          <h2 className="text-2xl md:text-3xl font-bold mb-3 text-gradient-amber" style={{
            fontFamily: "'Playfair Display', serif",
            letterSpacing: '0.5px',
            fontWeight: 700
          }}>{selectedCategory.name}</h2>
          {selectedCategory.description && (
            <p className="body-text text-sm md:text-base max-w-3xl opacity-80">{selectedCategory.description}</p>
          )}
        </div>
      )}

      {/* Menu Items Grid */}
      {filteredItems.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 md:gap-5 lg:gap-6">
          {filteredItems.map((item, index) => {
            const price = item.menu_item_variants && item.menu_item_variants.length > 0
              ? item.menu_item_variants[0].price
              : item.base_price || 0

            return (
              <Link 
                key={item.id}
                href={`/menu/${item.id}`}
                className="menu-item-card-premium group rounded-lg md:rounded-xl relative bg-[#111111] border border-white/10 overflow-hidden transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_15px_40px_rgba(0,0,0,0.5)] hover:border-[#F59E0B]/60 flex flex-col justify-end min-h-[180px] sm:min-h-[200px] md:min-h-[220px] block cursor-pointer"
              >
                {/* Top gradient overlay to remove dead space */}
                <div className="absolute inset-0 pointer-events-none" style={{
                  background: 'radial-gradient(120% 60% at 50% 0%, rgba(245,158,11,0.08), transparent 60%)'
                }}></div>
                
                {/* Diagonal shine effect on hover */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" style={{
                  background: 'linear-gradient(135deg, transparent 40%, rgba(245,158,11,0.08), transparent 60%)'
                }}></div>
                {/* Image Section */}
                {item.image_path ? (
                  <div className="aspect-[4/3] relative overflow-hidden rounded-t-lg md:rounded-t-xl group-hover:rounded-t-lg md:group-hover:rounded-t-xl transition-all duration-300 flex-shrink-0">
                    <SupabaseImage
                      src={item.image_path}
                      alt={item.name}
                      fill
                      className="object-cover group-hover:scale-110 transition-transform duration-500"
                      bucket="menu-items"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>
                    {item.is_featured && (
                      <span className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 bg-[#F59E0B] text-black px-1.5 py-0.5 sm:px-2 sm:py-1 rounded text-[9px] sm:text-[10px] font-bold shadow-lg backdrop-blur-sm z-10">
                        Featured
                      </span>
                    )}
                    {item.is_veg && (
                      <span className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 bg-green-500 text-white px-1.5 py-0.5 sm:px-2 sm:py-1 rounded text-[9px] sm:text-[10px] font-bold flex items-center gap-1 shadow-lg backdrop-blur-sm z-10">
                        <Leaf className="h-2 w-2 sm:h-2.5 sm:w-2.5" />
                        Veg
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="aspect-[4/3] bg-gradient-to-br from-[#111111] to-[#0a0a0a] relative flex items-center justify-center rounded-t-lg md:rounded-t-xl flex-shrink-0" style={{
                    background: 'linear-gradient(135deg, #111111 0%, #0a0a0a 100%), linear-gradient(135deg, transparent 40%, rgba(245,158,11,0.03), transparent 60%)'
                  }}>
                    {item.is_featured && (
                      <span className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 bg-[#F59E0B] text-black px-1.5 py-0.5 sm:px-2 sm:py-1 rounded text-[9px] sm:text-[10px] font-bold shadow-lg z-10">
                        Featured
                      </span>
                    )}
                    {item.is_veg && (
                      <span className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 bg-green-500 text-white px-1.5 py-0.5 sm:px-2 sm:py-1 rounded text-[9px] sm:text-[10px] font-bold flex items-center gap-1 shadow-lg z-10">
                        <Leaf className="h-2 w-2 sm:h-2.5 sm:w-2.5" />
                        Veg
                      </span>
                    )}
                    {/* Gold line divider instead of icon */}
                    <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#F59E0B]/30 to-transparent"></div>
                  </div>
                )}

                {/* Content Section with proper structure */}
                <div className="relative z-10">
                  {/* Micro separator */}
                  <div className="border-t border-white/6 mx-2 sm:mx-3 md:mx-4"></div>
                  
                  <div className="p-2.5 sm:p-3 md:p-4 pt-2.5 sm:pt-3 md:pt-4">
                    {/* Name and Price on same row */}
                    <div className="flex items-start justify-between gap-2 group-hover:text-[#F59E0B] transition-colors duration-300">
                      <h3 
                        className="flex-1 text-xs sm:text-sm md:text-[0.9rem] leading-[1.3] font-semibold text-[#f5f5f5] break-words" 
                        style={{
                          fontFamily: "'Inter', sans-serif",
                          fontWeight: 600,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          lineHeight: '1.3'
                        }}
                      >
                        {item.name}
                      </h3>
                      <span 
                        className="text-sm sm:text-base md:text-lg font-bold text-[#fbbf24] whitespace-nowrap flex-shrink-0 transition-all duration-300 group-hover:drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]" 
                        style={{
                          fontWeight: 700
                        }}
                      >
                        ${price.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-16 md:py-20">
          <div className="max-w-md mx-auto bg-[#111111] rounded-2xl shadow-2xl p-8 border border-white/10">
            <UtensilsCrossed className="h-14 w-14 md:h-16 md:w-16 text-[#F59E0B] mx-auto mb-4 opacity-60" />
            <p className="body-text text-center text-sm md:text-base opacity-80">
              {selectedCategory
                ? `No items available in ${selectedCategory.name} category.`
                : 'No menu items available at the moment.'}
            </p>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}

