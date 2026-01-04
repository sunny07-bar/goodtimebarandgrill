// Verified emails store - Stores verified emails in database to avoid repeated verification
import { supabase } from '@/lib/db';

export interface VerifiedEmailEntry {
  id: string;
  email: string;
  verified_at: string;
  expires_at: string;
  verification_method: string;
  created_at: string;
  updated_at: string;
}

// Default expiration: 30 days
const DEFAULT_VERIFICATION_EXPIRY_DAYS = 30;

/**
 * Store a verified email in the database
 * @param email - Email address to mark as verified
 * @param expiresInDays - Number of days until verification expires (default: 30)
 * @returns Promise<boolean> - True if successfully stored
 */
export async function storeVerifiedEmail(
  email: string,
  expiresInDays: number = DEFAULT_VERIFICATION_EXPIRY_DAYS
): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();
  
  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    console.error('[Verified Emails] Invalid email format:', normalizedEmail);
    return false;
  }

  if (!supabase) {
    console.warn('[Verified Emails] Supabase not available, cannot store verified email');
    return false;
  }

  try {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (expiresInDays * 24 * 60 * 60 * 1000));

    const { error } = await supabase
      .from('verified_emails')
      .upsert({
        email: normalizedEmail,
        verified_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        verification_method: 'otp',
        updated_at: now.toISOString(),
      }, {
        onConflict: 'email'
      });

    if (error) {
      console.error('[Verified Emails] Error storing verified email:', error);
      return false;
    }

    console.log(`[Verified Emails] ✓ Stored verified email: ${normalizedEmail} (expires in ${expiresInDays} days)`);
    return true;
  } catch (err) {
    console.error('[Verified Emails] Exception storing verified email:', err);
    return false;
  }
}

/**
 * Check if an email is verified and not expired
 * @param email - Email address to check
 * @returns Promise<VerifiedEmailEntry | null> - Verified email entry if valid, null otherwise
 */
export async function isEmailVerified(email: string): Promise<VerifiedEmailEntry | null> {
  const normalizedEmail = email.toLowerCase().trim();
  
  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return null;
  }

  if (!supabase) {
    console.warn('[Verified Emails] Supabase not available, cannot check verified email');
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('verified_emails')
      .select('*')
      .eq('email', normalizedEmail)
      .single();

    if (error || !data) {
      return null;
    }

    // Check if verification has expired
    const expiresAt = new Date(data.expires_at);
    const now = new Date();

    if (expiresAt < now) {
      // Expired - delete it
      await supabase
        .from('verified_emails')
        .delete()
        .eq('email', normalizedEmail);
      
      console.log(`[Verified Emails] Verification expired for ${normalizedEmail}`);
      return null;
    }

    const daysRemaining = Math.floor((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    console.log(`[Verified Emails] ✓ Email verified: ${normalizedEmail} (${daysRemaining} days remaining)`);
    
    return data as VerifiedEmailEntry;
  } catch (err) {
    console.error('[Verified Emails] Exception checking verified email:', err);
    return null;
  }
}

/**
 * Delete a verified email entry (e.g., when user wants to re-verify)
 * @param email - Email address to remove from verified list
 * @returns Promise<boolean> - True if successfully deleted
 */
export async function deleteVerifiedEmail(email: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();
  
  if (!supabase) {
    return false;
  }

  try {
    const { error } = await supabase
      .from('verified_emails')
      .delete()
      .eq('email', normalizedEmail);

    if (error) {
      console.error('[Verified Emails] Error deleting verified email:', error);
      return false;
    }

    console.log(`[Verified Emails] Deleted verified email: ${normalizedEmail}`);
    return true;
  } catch (err) {
    console.error('[Verified Emails] Exception deleting verified email:', err);
    return false;
  }
}

/**
 * Clean up expired verified emails (can be called periodically)
 * @returns Promise<number> - Number of expired entries deleted
 */
export async function cleanupExpiredVerifications(): Promise<number> {
  if (!supabase) {
    return 0;
  }

  try {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('verified_emails')
      .delete()
      .lt('expires_at', now)
      .select();

    if (error) {
      console.error('[Verified Emails] Error cleaning up expired verifications:', error);
      return 0;
    }

    const count = data?.length || 0;
    if (count > 0) {
      console.log(`[Verified Emails] Cleaned up ${count} expired verification(s)`);
    }
    
    return count;
  } catch (err) {
    console.error('[Verified Emails] Exception cleaning up expired verifications:', err);
    return 0;
  }
}

