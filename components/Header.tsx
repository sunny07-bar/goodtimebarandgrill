'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Menu, X } from 'lucide-react'
import { useState, useEffect } from 'react'

export default function Header() {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const isActive = (path: string) => {
    if (path === '/') {
      return pathname === '/'
    }
    return pathname.startsWith(path)
  }

  return (
    <header className={`sticky top-0 z-50 w-full transition-all duration-500 ease-out ${
      // Always blurred on mobile, blurred on desktop when scrolled or menu open
      scrolled || mobileMenuOpen
        ? 'bg-[#0E0E0E]/98 backdrop-blur-xl border-b border-white/10 shadow-2xl glass-effect' 
        : 'bg-[#0E0E0E]/98 lg:bg-transparent backdrop-blur-md lg:backdrop-blur-none border-b border-white/10 lg:border-b-0'
    }`}>
      <nav className="relative">
        <div className="container-global">
          <div className="flex items-center justify-between h-20 md:h-24">
            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-2">
              <Link 
                href="/" 
                className={`px-3 py-2 rounded-md transition-all duration-300 font-semibold text-xs uppercase tracking-wide relative group ${
                  isActive('/') 
                    ? 'text-[#F59E0B] bg-[#F59E0B]/10' 
                    : 'text-[#D1D5DB] hover:text-[#F59E0B] hover:bg-[#F59E0B]/5 hover:scale-105'
                }`}
              >
                HOME
                {isActive('/') && (
                  <span className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-6 h-0.5 bg-[#F59E0B] rounded-full animate-pulse-custom"></span>
                )}
              </Link>
              <Link 
                href="/menu" 
                className={`px-4 py-2.5 rounded-lg transition-all duration-300 font-bold text-sm uppercase tracking-wide relative group ${
                  isActive('/menu') 
                    ? 'text-[#F59E0B] bg-[#F59E0B]/10 border border-[#F59E0B]/30' 
                    : 'text-[#D1D5DB] hover:text-[#F59E0B] hover:bg-[#F59E0B]/5 hover:scale-105 hover:shadow-lg hover:shadow-[#F59E0B]/20'
                }`}
              >
                MENU
                {isActive('/menu') && (
                  <span className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-8 h-0.5 bg-[#F59E0B] rounded-full animate-pulse-custom"></span>
                )}
              </Link>
              <Link 
                href="/events" 
                className={`px-4 py-2.5 rounded-lg transition-all duration-300 font-bold text-sm uppercase tracking-wide relative group ${
                  isActive('/events') 
                    ? 'text-[#F59E0B] bg-[#F59E0B]/10 border border-[#F59E0B]/30' 
                    : 'text-[#D1D5DB] hover:text-[#F59E0B] hover:bg-[#F59E0B]/5 hover:scale-105 hover:shadow-lg hover:shadow-[#F59E0B]/20'
                }`}
              >
                EVENTS
                {isActive('/events') && (
                  <span className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-8 h-0.5 bg-[#F59E0B] rounded-full animate-pulse-custom"></span>
                )}
              </Link>
              <Link 
                href="/reservations" 
                className={`px-4 py-2.5 rounded-lg transition-all duration-300 font-bold text-sm uppercase tracking-wide relative group ${
                  isActive('/reservations') 
                    ? 'text-[#F59E0B] bg-[#F59E0B]/10 border border-[#F59E0B]/30' 
                    : 'text-[#D1D5DB] hover:text-[#F59E0B] hover:bg-[#F59E0B]/5 hover:scale-105 hover:shadow-lg hover:shadow-[#F59E0B]/20'
                }`}
              >
                RESERVATIONS
                {isActive('/reservations') && (
                  <span className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-8 h-0.5 bg-[#F59E0B] rounded-full animate-pulse-custom"></span>
                )}
              </Link>
              <Link 
                href="/about" 
                className={`px-4 py-2.5 rounded-lg transition-all duration-300 font-bold text-sm uppercase tracking-wide relative group ${
                  isActive('/about') 
                    ? 'text-[#F59E0B] bg-[#F59E0B]/10 border border-[#F59E0B]/30' 
                    : 'text-[#D1D5DB] hover:text-[#F59E0B] hover:bg-[#F59E0B]/5 hover:scale-105 hover:shadow-lg hover:shadow-[#F59E0B]/20'
                }`}
              >
                ABOUT
                {isActive('/about') && (
                  <span className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-8 h-0.5 bg-[#F59E0B] rounded-full animate-pulse-custom"></span>
                )}
              </Link>
              <Link 
                href="/gallery" 
                className={`px-4 py-2.5 rounded-lg transition-all duration-300 font-bold text-sm uppercase tracking-wide relative group ${
                  isActive('/gallery') 
                    ? 'text-[#F59E0B] bg-[#F59E0B]/10 border border-[#F59E0B]/30' 
                    : 'text-[#D1D5DB] hover:text-[#F59E0B] hover:bg-[#F59E0B]/5 hover:scale-105 hover:shadow-lg hover:shadow-[#F59E0B]/20'
                }`}
              >
                GALLERY
                {isActive('/gallery') && (
                  <span className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-8 h-0.5 bg-[#F59E0B] rounded-full animate-pulse-custom"></span>
                )}
              </Link>
              <Link 
                href="/contact" 
                className={`px-4 py-2.5 rounded-lg transition-all duration-300 font-bold text-sm uppercase tracking-wide relative group ${
                  isActive('/contact') 
                    ? 'text-[#F59E0B] bg-[#F59E0B]/10 border border-[#F59E0B]/30' 
                    : 'text-[#D1D5DB] hover:text-[#F59E0B] hover:bg-[#F59E0B]/5 hover:scale-105 hover:shadow-lg hover:shadow-[#F59E0B]/20'
                }`}
              >
                CONTACT
                {isActive('/contact') && (
                  <span className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-8 h-0.5 bg-[#F59E0B] rounded-full animate-pulse-custom"></span>
                )}
              </Link>
              <Link href="/reservations">
                <button className="btn-amber-sm ml-3">
                  Book Table
                </button>
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              className="lg:hidden text-[#D1D5DB] hover:text-[#F59E0B] transition-colors z-10"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden absolute top-full left-0 right-0 bg-[#0E0E0E]/95 backdrop-blur-xl border-t border-white/10 shadow-xl animate-fade-in-down">
            <div className="container-global py-6 space-y-2">
              <Link 
                href="/" 
                className={`block px-4 py-3 rounded-lg transition-all font-bold text-sm uppercase ${
                  isActive('/') ? 'text-[#F59E0B] bg-[#F59E0B]/10' : 'text-[#D1D5DB] hover:text-[#F59E0B] hover:bg-[#F59E0B]/5'
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                HOME
              </Link>
              <Link 
                href="/menu" 
                className={`block px-4 py-3 rounded-lg transition-all font-bold text-sm uppercase ${
                  isActive('/menu') ? 'text-[#F59E0B] bg-[#F59E0B]/10' : 'text-[#D1D5DB] hover:text-[#F59E0B] hover:bg-[#F59E0B]/5'
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                MENU
              </Link>
              <Link 
                href="/events" 
                className={`block px-4 py-3 rounded-lg transition-all font-bold text-sm uppercase ${
                  isActive('/events') ? 'text-[#F59E0B] bg-[#F59E0B]/10' : 'text-[#D1D5DB] hover:text-[#F59E0B] hover:bg-[#F59E0B]/5'
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                EVENTS
              </Link>
              <Link 
                href="/reservations" 
                className={`block px-4 py-3 rounded-lg transition-all font-bold text-sm uppercase ${
                  isActive('/reservations') ? 'text-[#F59E0B] bg-[#F59E0B]/10' : 'text-[#D1D5DB] hover:text-[#F59E0B] hover:bg-[#F59E0B]/5'
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                RESERVATIONS
              </Link>
              <Link 
                href="/about" 
                className={`block px-4 py-3 rounded-lg transition-all font-bold text-sm uppercase ${
                  isActive('/about') ? 'text-[#F59E0B] bg-[#F59E0B]/10' : 'text-[#D1D5DB] hover:text-[#F59E0B] hover:bg-[#F59E0B]/5'
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                ABOUT
              </Link>
              <Link 
                href="/gallery" 
                className={`block px-4 py-3 rounded-lg transition-all font-bold text-sm uppercase ${
                  isActive('/gallery') ? 'text-[#F59E0B] bg-[#F59E0B]/10' : 'text-[#D1D5DB] hover:text-[#F59E0B] hover:bg-[#F59E0B]/5'
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                GALLERY
              </Link>
              <Link 
                href="/contact" 
                className={`block px-4 py-3 rounded-lg transition-all font-bold text-sm uppercase ${
                  isActive('/contact') ? 'text-[#F59E0B] bg-[#F59E0B]/10' : 'text-[#D1D5DB] hover:text-[#F59E0B] hover:bg-[#F59E0B]/5'
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                CONTACT
              </Link>
              <Link href="/reservations" onClick={() => setMobileMenuOpen(false)}>
                <button className="btn-amber w-full mt-4">
                  Book Table
                </button>
              </Link>
            </div>
          </div>
        )}
      </nav>
    </header>
  )
}
