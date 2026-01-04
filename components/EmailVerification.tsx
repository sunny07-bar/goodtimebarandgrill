'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Mail, CheckCircle, AlertCircle } from 'lucide-react';

interface EmailVerificationProps {
  email: string;
  onVerified: () => void;
  onCancel?: () => void;
}

export default function EmailVerification({ email, onVerified, onCancel }: EmailVerificationProps) {
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [verified, setVerified] = useState(false);
  const [checkingVerification, setCheckingVerification] = useState(true);

  // Check if email is already verified when component mounts
  useEffect(() => {
    const checkEmailVerification = async () => {
      if (!email) {
        setCheckingVerification(false);
        return;
      }

      try {
        const response = await fetch('/api/email/check-verified', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });

        const data = await response.json();
        if (data.verified) {
          // Email is already verified, skip verification
          setVerified(true);
          setTimeout(() => {
            onVerified();
          }, 500);
        }
      } catch (err) {
        console.error('Error checking email verification:', err);
      } finally {
        setCheckingVerification(false);
      }
    };

    checkEmailVerification();
  }, [email, onVerified]);

  const handleSendOTP = async () => {
    // First check if email is already verified
    try {
      const checkResponse = await fetch('/api/email/check-verified', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const checkData = await checkResponse.json();
      if (checkData.verified) {
        // Email is already verified, skip sending OTP
        setVerified(true);
        setTimeout(() => {
          onVerified();
        }, 500);
        return;
      }
    } catch (err) {
      console.error('Error checking email verification:', err);
      // Continue with sending OTP if check fails
    }

    setSending(true);
    setError(null);

    try {
      const response = await fetch('/api/email/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send verification code');
      }

      // Check if email is already verified (API returned this)
      if (data.alreadyVerified) {
        setVerified(true);
        setTimeout(() => {
          onVerified();
        }, 500);
        return;
      }

      setOtpSent(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send verification code');
    } finally {
      setSending(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      setError('Please enter the 6-digit code');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/email/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Invalid verification code');
      }

      setVerified(true);
      setTimeout(() => {
        onVerified();
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  // Show loading state while checking verification
  if (checkingVerification) {
    return (
      <div className="space-y-4">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/20 mb-4">
            <Loader2 className="h-6 w-6 text-blue-600 dark:text-blue-400 animate-spin" />
          </div>
          <h3 className="text-lg font-semibold">Checking Email Verification</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            Please wait...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/20 mb-4">
          <Mail className="h-6 w-6 text-blue-600 dark:text-blue-400" />
        </div>
        <h3 className="text-lg font-semibold">Verify Your Email</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
          We'll send a verification code to
        </p>
        <p className="text-sm font-medium text-gray-900 dark:text-white">{email}</p>
      </div>

      {!otpSent ? (
        <div className="space-y-4">
          <Button
            onClick={handleSendOTP}
            disabled={sending}
            className="w-full"
          >
            {sending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Send Verification Code
              </>
            )}
          </Button>
        </div>
      ) : verified ? (
        <div className="text-center py-4">
          <CheckCircle className="mx-auto h-12 w-12 text-green-600 dark:text-green-400 mb-4" />
          <p className="text-green-600 dark:text-green-400 font-medium">
            Email verified successfully!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <Label htmlFor="otp">Enter Verification Code</Label>
            <Input
              id="otp"
              type="text"
              maxLength={6}
              value={otp}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '').substring(0, 6);
                setOtp(value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && otp.length === 6) {
                  handleVerifyOTP();
                }
              }}
              placeholder="000000"
              className="text-center text-2xl tracking-widest mt-2"
              disabled={loading}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Check your email for the 6-digit code
            </p>
          </div>

          <Button
            onClick={handleVerifyOTP}
            disabled={loading || otp.length !== 6}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              'Verify Code'
            )}
          </Button>

          <Button
            onClick={handleSendOTP}
            disabled={sending}
            variant="outline"
            className="w-full"
          >
            {sending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Resending...
              </>
            ) : (
              'Resend Code'
            )}
          </Button>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {onCancel && (
        <Button
          onClick={onCancel}
          variant="ghost"
          className="w-full"
          disabled={loading || sending}
        >
          Cancel
        </Button>
      )}
    </div>
  );
}

