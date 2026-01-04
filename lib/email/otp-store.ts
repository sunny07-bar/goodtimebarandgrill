// OTP store - Uses database for serverless compatibility
import { supabase } from '@/lib/db';

interface OTPEntry {
  otp: string;
  expiresAt: number;
  email: string;
}

// Fallback in-memory store for when database is unavailable
const otpStoreMemory = new Map<string, OTPEntry>();

// Clean up expired OTPs from memory every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of otpStoreMemory.entries()) {
      if (value.expiresAt < now) {
        otpStoreMemory.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

// Store OTP in database (or fallback to memory)
export async function storeOTP(email: string, otp: string, expiresInMinutes: number = 10): Promise<void> {
  const normalizedEmail = email.toLowerCase().trim();
  const now = Date.now();
  const expiresAt = now + (expiresInMinutes * 60 * 1000);
  
  // Try to store in database first (for serverless compatibility)
  if (supabase) {
    try {
      // Use a temporary table or upsert approach
      // Since we can't guarantee the table exists, we'll try upsert first
      const { error } = await supabase
        .from('otp_verifications')
        .upsert({
          email: normalizedEmail,
          otp_code: otp,
          expires_at: new Date(expiresAt).toISOString(),
          created_at: new Date(now).toISOString(),
        }, {
          onConflict: 'email'
        });

      if (!error) {
        console.log(`[OTP Store] Stored OTP in database for ${normalizedEmail}, expires in ${expiresInMinutes} minutes`);
        return;
      } else {
        console.warn(`[OTP Store] Database storage failed, using memory fallback:`, error.message);
      }
    } catch (err) {
      console.warn(`[OTP Store] Database table may not exist, using memory fallback:`, err);
    }
  }
  
  // Fallback to in-memory store
  otpStoreMemory.set(normalizedEmail, { otp, expiresAt, email: normalizedEmail });
  console.log(`[OTP Store] Stored OTP in memory for ${normalizedEmail}, expires in ${expiresInMinutes} minutes (at ${new Date(expiresAt).toISOString()})`);
}

// Get OTP from database (or fallback to memory)
export async function getOTP(email: string): Promise<OTPEntry | null> {
  const normalizedEmail = email.toLowerCase().trim();
  const now = Date.now();
  
  // Try database first
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('otp_verifications')
        .select('otp_code, expires_at')
        .eq('email', normalizedEmail)
        .single();

      if (!error && data) {
        const expiresAt = new Date(data.expires_at).getTime();
        const timeRemaining = expiresAt - now;
        
        if (expiresAt < now) {
          // Expired - delete from database
          await supabase
            .from('otp_verifications')
            .delete()
            .eq('email', normalizedEmail);
          
          console.log(`[OTP Store] OTP expired for ${normalizedEmail} (expired ${Math.floor((now - expiresAt) / 1000)}s ago)`);
          return null;
        }
        
        const minutesRemaining = Math.floor(timeRemaining / 60000);
        const secondsRemaining = Math.floor((timeRemaining % 60000) / 1000);
        console.log(`[OTP Store] OTP found in database for ${normalizedEmail}, ${minutesRemaining}m ${secondsRemaining}s remaining`);
        
        return {
          otp: data.otp_code,
          expiresAt,
          email: normalizedEmail,
        };
      }
    } catch (err) {
      // Table doesn't exist or error - fall back to memory
    }
  }
  
  // Fallback to memory store
  const entry = otpStoreMemory.get(normalizedEmail);
  
  if (!entry) {
    console.log(`[OTP Store] No OTP found for ${normalizedEmail}`);
    return null;
  }
  
  const timeRemaining = entry.expiresAt - now;
  const minutesRemaining = Math.floor(timeRemaining / 60000);
  const secondsRemaining = Math.floor((timeRemaining % 60000) / 1000);
  
  if (entry.expiresAt < now) {
    console.log(`[OTP Store] OTP expired for ${normalizedEmail} (expired ${Math.floor((now - entry.expiresAt) / 1000)}s ago)`);
    otpStoreMemory.delete(normalizedEmail);
    return null;
  }
  
  console.log(`[OTP Store] OTP found in memory for ${normalizedEmail}, ${minutesRemaining}m ${secondsRemaining}s remaining`);
  return entry;
}

// Delete OTP from database or memory
export async function deleteOTP(email: string): Promise<void> {
  const normalizedEmail = email.toLowerCase().trim();
  
  // Try database first
  if (supabase) {
    try {
      await supabase
        .from('otp_verifications')
        .delete()
        .eq('email', normalizedEmail);
    } catch (err) {
      // Table doesn't exist - continue to memory cleanup
    }
  }
  
  // Also delete from memory
  otpStoreMemory.delete(normalizedEmail);
}

// Verify OTP
export async function verifyOTP(email: string, otp: string): Promise<boolean> {
  const entry = await getOTP(email);
  if (!entry) return false;
  
  if (entry.otp !== otp.trim()) return false;
  
  // Delete after successful verification
  await deleteOTP(email);
  return true;
}
