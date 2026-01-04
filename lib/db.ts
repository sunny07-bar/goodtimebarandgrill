import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

let supabase: SupabaseClient | null = null

if (supabaseUrl && supabaseAnonKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
      },
    })
  } catch (error) {
    // Only log in development to avoid exposing errors in production
    if (process.env.NODE_ENV !== 'production') {
      console.error('Failed to initialize Supabase client:', error)
    }
    supabase = null
  }
} else {
  // Only warn in development
  if (process.env.NODE_ENV !== 'production') {
    console.warn('Supabase credentials are missing. Please check your .env.local file.')
    console.warn('The app will run in limited mode without database connectivity.')
  }
}

// Export a safe client that can be null
export { supabase }

// Helper function to check if supabase is available
export function isSupabaseAvailable(): boolean {
  return supabase !== null
}

// Helper function to get supabase or throw a helpful error
export function getSupabaseClient(): SupabaseClient {
  if (!supabase) {
    throw new Error('Supabase client is not initialized. Please check your environment variables.')
  }
  return supabase
}

// Database types based on schema
export type OrderType = 'pickup' | 'delivery' | 'dine_in'
export type OrderStatus = 'pending' | 'accepted' | 'preparing' | 'ready' | 'out_for_delivery' | 'completed' | 'cancelled'
export type PaymentStatus = 'unpaid' | 'paid' | 'refunded'
export type ReservationStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'
export type OfferType = 'percentage_discount' | 'flat_discount' | 'bogo' | 'bundle'
export type OfferScope = 'entire_order' | 'category' | 'item'
export type GalleryCategory = 'food' | 'ambience' | 'events' | 'parties' | 'other'
