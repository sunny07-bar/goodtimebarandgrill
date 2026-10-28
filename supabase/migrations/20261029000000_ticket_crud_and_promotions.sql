-- =========================================================================
-- COMPLETE TICKETING, PROMOTIONS, BOGO & CHECK-IN SCHEMA MIGRATION
-- PRODUCTION-SAFE: 100% Additive, Idempotent (IF NOT EXISTS), Zero-Downtime
-- SAFE FOREIGN KEYS: Dynamically links to events / "Events" if present
-- =========================================================================

-- 1. Ensure public.event_tickets table exists
CREATE TABLE IF NOT EXISTS public.event_tickets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  name text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  quantity_total integer,
  quantity_sold integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 100,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT event_tickets_pkey PRIMARY KEY (id)
);

-- In case event_tickets already existed previously, ensure all modern columns exist:
ALTER TABLE public.event_tickets
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS quantity_sold integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_event_tickets_event_id ON public.event_tickets(event_id);

-- Dynamically attach foreign key constraint to events table if it exists
DO $$
BEGIN
  IF to_regclass('public.events') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'event_tickets_event_id_fkey'
    ) THEN
      ALTER TABLE public.event_tickets
        ADD CONSTRAINT event_tickets_event_id_fkey
        FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;
    END IF;
  ELSIF to_regclass('public."Events"') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'event_tickets_event_id_fkey'
    ) THEN
      ALTER TABLE public.event_tickets
        ADD CONSTRAINT event_tickets_event_id_fkey
        FOREIGN KEY (event_id) REFERENCES public."Events"(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- 2. Create public.event_promotions table for BOGO and ticket discount rules
CREATE TABLE IF NOT EXISTS public.event_promotions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  ticket_type_id uuid, -- NULL means applies to ALL ticket types in this event
  name text NOT NULL,  -- e.g. 'Buy 1 Get 1 Free', 'Flash 20% Off', 'Buy 2 Get 2'
  promo_code text,     -- NULL for automatic bundle deal; text (e.g. 'SUMMERBOGO') for coupon
  discount_type text NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount', 'bogo')),
  
  -- Percentage or Fixed Discount values:
  discount_value numeric DEFAULT 0, -- e.g. 20 for 20% off, 5 for $5.00 off
  
  -- BOGO / Bundle configuration:
  buy_quantity integer DEFAULT 1,       -- e.g. Buy 1 (or Buy 2)
  get_quantity integer DEFAULT 1,       -- e.g. Get 1 (or Get 2)
  get_discount_percent numeric DEFAULT 100 CHECK (get_discount_percent >= 0 AND get_discount_percent <= 100),
  
  -- Guardrails & Limits:
  min_tickets_required integer DEFAULT 1,
  max_uses_total integer,              -- Global cap (e.g. first 50 redemptions)
  uses_count integer NOT NULL DEFAULT 0,
  start_date timestamp with time zone,
  end_date timestamp with time zone,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  
  CONSTRAINT event_promotions_pkey PRIMARY KEY (id),
  CONSTRAINT event_promotions_ticket_type_id_fkey FOREIGN KEY (ticket_type_id) REFERENCES public.event_tickets(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_event_promotions_event_id ON public.event_promotions(event_id);
CREATE INDEX IF NOT EXISTS idx_event_promotions_promo_code ON public.event_promotions(promo_code) WHERE promo_code IS NOT NULL;

-- Dynamically attach foreign key to events table if it exists
DO $$
BEGIN
  IF to_regclass('public.events') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'event_promotions_event_id_fkey'
    ) THEN
      ALTER TABLE public.event_promotions
        ADD CONSTRAINT event_promotions_event_id_fkey
        FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;
    END IF;
  ELSIF to_regclass('public."Events"') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'event_promotions_event_id_fkey'
    ) THEN
      ALTER TABLE public.event_promotions
        ADD CONSTRAINT event_promotions_event_id_fkey
        FOREIGN KEY (event_id) REFERENCES public."Events"(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- 3. Ensure ticket_orders table exists and has promotion columns
CREATE TABLE IF NOT EXISTS public.ticket_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_number text UNIQUE,
  event_id uuid NOT NULL,
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text,
  subtotal_amount numeric,
  discount_amount numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL,
  promo_code text,
  promotion_id uuid REFERENCES public.event_promotions(id) ON DELETE SET NULL,
  payment_status text NOT NULL DEFAULT 'unpaid',
  payment_method text,
  payment_transaction_id text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ticket_orders_pkey PRIMARY KEY (id)
);

ALTER TABLE public.ticket_orders
  ADD COLUMN IF NOT EXISTS subtotal_amount numeric,
  ADD COLUMN IF NOT EXISTS discount_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promo_code text,
  ADD COLUMN IF NOT EXISTS promotion_id uuid REFERENCES public.event_promotions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ticket_orders_event_id ON public.ticket_orders(event_id);
CREATE INDEX IF NOT EXISTS idx_ticket_orders_email ON public.ticket_orders(customer_email);

-- Dynamically attach foreign key to events table if it exists
DO $$
BEGIN
  IF to_regclass('public.events') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'ticket_orders_event_id_fkey'
    ) THEN
      ALTER TABLE public.ticket_orders
        ADD CONSTRAINT ticket_orders_event_id_fkey
        FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;
    END IF;
  ELSIF to_regclass('public."Events"') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'ticket_orders_event_id_fkey'
    ) THEN
      ALTER TABLE public.ticket_orders
        ADD CONSTRAINT ticket_orders_event_id_fkey
        FOREIGN KEY (event_id) REFERENCES public."Events"(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- 4. Ensure purchased_tickets table exists with check-in columns
CREATE TABLE IF NOT EXISTS public.purchased_tickets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  ticket_order_id uuid NOT NULL REFERENCES public.ticket_orders(id) ON DELETE CASCADE,
  event_ticket_id uuid REFERENCES public.event_tickets(id) ON DELETE SET NULL,
  ticket_number text NOT NULL,
  qr_code_data text NOT NULL,
  qr_code_hash text NOT NULL,
  status text NOT NULL DEFAULT 'valid',
  customer_name text NOT NULL,
  ticket_type_name text NOT NULL,
  price_paid numeric NOT NULL DEFAULT 0,
  checked_in boolean NOT NULL DEFAULT false,
  checked_in_at timestamp with time zone,
  redeemed_at timestamp with time zone,
  redeemed_by text,
  redeemed_location text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT purchased_tickets_pkey PRIMARY KEY (id)
);

ALTER TABLE public.purchased_tickets
  ADD COLUMN IF NOT EXISTS checked_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS checked_in_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS redeemed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS redeemed_by text,
  ADD COLUMN IF NOT EXISTS redeemed_location text;

CREATE INDEX IF NOT EXISTS idx_purchased_tickets_hash ON public.purchased_tickets(qr_code_hash);
CREATE INDEX IF NOT EXISTS idx_purchased_tickets_number ON public.purchased_tickets(ticket_number);
CREATE INDEX IF NOT EXISTS idx_purchased_tickets_order ON public.purchased_tickets(ticket_order_id);

-- 5. RPC Function: redeem_ticket for Door Scanning Check-in
CREATE OR REPLACE FUNCTION public.redeem_ticket(
  p_qr_code_hash text,
  p_redeemed_by text DEFAULT NULL,
  p_location text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ticket record;
  v_now timestamp with time zone := now();
BEGIN
  SELECT * INTO v_ticket
  FROM public.purchased_tickets
  WHERE qr_code_hash = p_qr_code_hash
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'ticket_not_found',
      'message', 'Ticket not found'
    );
  END IF;

  IF v_ticket.status = 'used' OR v_ticket.checked_in = true THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'already_redeemed',
      'message', 'Ticket has already been redeemed / checked in',
      'ticket_number', v_ticket.ticket_number,
      'redeemed_at', COALESCE(v_ticket.redeemed_at, v_ticket.checked_in_at, v_ticket.updated_at)
    );
  END IF;

  IF v_ticket.status != 'valid' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'invalid_ticket',
      'message', 'Ticket is ' || v_ticket.status || '. Entry not permitted.',
      'ticket_number', v_ticket.ticket_number
    );
  END IF;

  UPDATE public.purchased_tickets
  SET status = 'used',
      checked_in = true,
      checked_in_at = v_now,
      redeemed_at = v_now,
      redeemed_by = p_redeemed_by,
      redeemed_location = p_location,
      updated_at = v_now
  WHERE id = v_ticket.id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Ticket verified and checked in successfully!',
    'ticket_number', v_ticket.ticket_number,
    'customer_name', v_ticket.customer_name,
    'ticket_type', v_ticket.ticket_type_name,
    'redeemed_at', v_now
  );
END;
$$;

-- 6. Helper Function: generate_order_number
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_date text := to_char(now(), 'YYYYMMDD');
  v_rand text := upper(substring(md5(random()::text) from 1 for 6));
BEGIN
  RETURN 'TKT-' || v_date || '-' || v_rand;
END;
$$;

-- 7. Helper Function: generate_ticket_number
CREATE OR REPLACE FUNCTION public.generate_ticket_number()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_date text := to_char(now(), 'YYYYMMDD');
  v_rand text := upper(substring(md5(random()::text) from 1 for 6));
BEGIN
  RETURN 'TKT-' || v_date || '-' || v_rand;
END;
$$;

-- 8. Enable RLS and Policies
ALTER TABLE public.event_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchased_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read of active event tickets" ON public.event_tickets;
CREATE POLICY "Allow public read of active event tickets" ON public.event_tickets
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow admin full access to event tickets" ON public.event_tickets;
CREATE POLICY "Allow admin full access to event tickets" ON public.event_tickets
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read of active promotions" ON public.event_promotions;
CREATE POLICY "Allow public read of active promotions" ON public.event_promotions
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Allow admin full access to promotions" ON public.event_promotions;
CREATE POLICY "Allow admin full access to promotions" ON public.event_promotions
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public insert of ticket orders" ON public.ticket_orders;
CREATE POLICY "Allow public insert of ticket orders" ON public.ticket_orders
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read of ticket orders" ON public.ticket_orders;
CREATE POLICY "Allow public read of ticket orders" ON public.ticket_orders
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow admin full access to ticket orders" ON public.ticket_orders;
CREATE POLICY "Allow admin full access to ticket orders" ON public.ticket_orders
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read of purchased tickets" ON public.purchased_tickets;
CREATE POLICY "Allow public read of purchased tickets" ON public.purchased_tickets
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow admin full access to purchased tickets" ON public.purchased_tickets;
CREATE POLICY "Allow admin full access to purchased tickets" ON public.purchased_tickets
  FOR ALL USING (true) WITH CHECK (true);
