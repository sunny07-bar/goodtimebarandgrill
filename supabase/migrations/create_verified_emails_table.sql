-- Create verified_emails table to store verified email addresses
-- This allows users to skip OTP verification if they've verified recently

CREATE TABLE IF NOT EXISTS public.verified_emails (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  verified_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL,
  verification_method text NOT NULL DEFAULT 'otp'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT verified_emails_pkey PRIMARY KEY (id)
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_verified_emails_email ON public.verified_emails(email);
CREATE INDEX IF NOT EXISTS idx_verified_emails_expires_at ON public.verified_emails(expires_at);

-- Add comment
COMMENT ON TABLE public.verified_emails IS 'Stores verified email addresses to avoid repeated OTP verification. Emails expire after a configurable period (default 30 days).';

-- Enable RLS (Row Level Security)
ALTER TABLE public.verified_emails ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (since this is for public email verification)
-- In production, you might want to restrict this further
CREATE POLICY "Allow all operations on verified_emails" ON public.verified_emails
  FOR ALL
  USING (true)
  WITH CHECK (true);

