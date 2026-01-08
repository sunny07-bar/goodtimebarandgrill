import type { Metadata } from "next"
import { Inter, Oswald, Bebas_Neue } from "next/font/google"
import "./globals.css"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { Toaster } from "@/components/ui/toaster"
import ScrollToTop from "@/components/ScrollToTop"
import RouteLoaderWrapper from "@/components/RouteLoaderWrapper"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { getAllSiteSettings } from "@/lib/queries"

const inter = Inter({
  subsets: ["latin"],
  variable: '--font-inter',
  display: 'swap',
})

const oswald = Oswald({
  subsets: ["latin"],
  weight: ['400', '500', '600', '700'],
  variable: '--font-oswald',
  display: 'swap',
})

const bebasNeue = Bebas_Neue({
  weight: '400',
  subsets: ["latin"],
  variable: '--font-bebas',
  display: 'swap',
})

// Cache layout data for 1 hour suitable for global settings like Footer/Contact info
export const revalidate = 3600

export const metadata: Metadata = {
  title: {
    default: "Good Times Bar & Grill - Live Music, Great Food",
    template: "%s | Good Times Bar & Grill"
  },
  description: "Good Times Bar and Grill is your destination for great food, awesome drinks, live music and more!",
  keywords: ["restaurant", "bar", "grill", "live music", "food", "drinks", "Florida"],
  authors: [{ name: "Good Times Bar & Grill" }],
  creator: "Good Times Bar & Grill",
  publisher: "Good Times Bar & Grill",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL
    ? new URL(process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL!)
    : undefined,
  openGraph: {
    type: "website",
    locale: "en_US",
    url: process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || undefined,
    title: "Good Times Bar & Grill - Live Music, Great Food",
    description: "Good Times Bar and Grill is your destination for great food, awesome drinks, live music and more!",
    siteName: "Good Times Bar & Grill",
  },
  twitter: {
    card: "summary_large_image",
    title: "Good Times Bar & Grill - Live Music, Great Food",
    description: "Good Times Bar and Grill is your destination for great food, awesome drinks, live music and more!",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: '/images/good-times-logo.png',
    shortcut: '/images/good-times-logo.png',
    apple: '/images/good-times-logo.png',
  },
  verification: {
    // Add your verification codes here when available
    // google: 'your-google-verification-code',
    // yandex: 'your-yandex-verification-code',
  },
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const siteSettings = await getAllSiteSettings()

  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${oswald.variable} ${bebasNeue.variable} font-sans`}>
        <ErrorBoundary>
          <div className="flex flex-col min-h-screen relative">
            <div className="fixed inset-0 bg-[url('/grid-pattern.svg')] opacity-[0.02] pointer-events-none z-0"></div>
            <RouteLoaderWrapper />
            <Header />
            <main className="flex-grow relative z-10 page-transition-enhanced">
              {children}
            </main>
            <Footer siteSettings={siteSettings} />
            <ScrollToTop />
            <Toaster />
          </div>
        </ErrorBoundary>
      </body>
    </html>
  )
}

