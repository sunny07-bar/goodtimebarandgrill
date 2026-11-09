import Link from 'next/link'
import { Metadata } from 'next'
import { Home, Calendar, UtensilsCrossed, ArrowLeft } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Page Not Found (404) | Good Times Bar & Grill',
  description: 'The page you are looking for does not exist or has been moved.',
  robots: {
    index: false,
    follow: false,
  },
}

export default function NotFound() {
  return (
    <div className="section-bg-primary min-h-[70vh] flex items-center justify-center py-16 px-4">
      <div className="container-global max-w-xl text-center">
        <div className="card-premium p-8 md:p-12 border border-white/10 shadow-2xl">
          <span className="inline-block text-6xl md:text-8xl font-black text-[#F59E0B] mb-4 tracking-wider">
            404
          </span>
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-3">
            Page Not Found
          </h1>
          <p className="body-text text-sm md:text-base text-gray-400 mb-8 max-w-md mx-auto">
            The event, menu item, or page you are looking for might have been moved, updated, or is no longer available.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#F59E0B] text-black font-bold text-sm hover:bg-[#d97706] transition-all shadow-md"
            >
              <Home className="w-4 h-4" />
              <span>Home</span>
            </Link>
            <Link
              href="/events"
              className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/5 border border-white/15 text-white font-semibold text-sm hover:bg-white/10 hover:border-[#F59E0B]/50 transition-all"
            >
              <Calendar className="w-4 h-4 text-[#F59E0B]" />
              <span>Events</span>
            </Link>
            <Link
              href="/menu"
              className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/5 border border-white/15 text-white font-semibold text-sm hover:bg-white/10 hover:border-[#F59E0B]/50 transition-all"
            >
              <UtensilsCrossed className="w-4 h-4 text-[#F59E0B]" />
              <span>Menu</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

