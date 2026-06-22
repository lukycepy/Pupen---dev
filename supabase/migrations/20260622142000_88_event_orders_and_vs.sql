CREATE TABLE IF NOT EXISTS public.event_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  buyer_name text,
  buyer_email text NOT NULL,
  payment_method text NOT NULL DEFAULT 'hotove',
  status text NOT NULL DEFAULT 'confirmed',
  total_amount numeric(10,2) NOT NULL DEFAULT 0,
  paid_amount numeric(10,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'CZK',
  variable_symbol text NOT NULL,
  reservation_expires_at timestamptz,
  paid_at timestamptz,
  cancelled_at timestamptz,
  matched_bank_transaction_id uuid REFERENCES public.bank_transactions(id) ON DELETE SET NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS event_orders_variable_symbol_idx
  ON public.event_orders (variable_symbol);

CREATE INDEX IF NOT EXISTS event_orders_event_status_idx
  ON public.event_orders (event_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS event_orders_buyer_email_idx
  ON public.event_orders (buyer_email);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'event_orders_status_check'
      AND conrelid = 'public.event_orders'::regclass
  ) THEN
    ALTER TABLE public.event_orders
      ADD CONSTRAINT event_orders_status_check
      CHECK (status IN ('waitlist', 'reserved', 'confirmed', 'paid', 'cancelled'));
  END IF;
END $$;

ALTER TABLE public.event_orders ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='event_orders' AND policyname='event_orders_admin_all'
  ) THEN
    CREATE POLICY event_orders_admin_all
      ON public.event_orders
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND (p.can_manage_admins = true OR p.can_edit_events = true)
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND (p.can_manage_admins = true OR p.can_edit_events = true)
        )
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.event_order_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  event_order_id uuid NOT NULL REFERENCES public.event_orders(id) ON DELETE CASCADE,
  bank_transaction_id uuid REFERENCES public.bank_transactions(id) ON DELETE SET NULL,
  amount numeric(10,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'CZK',
  paid_at timestamptz NOT NULL DEFAULT now(),
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS event_order_payments_bank_tx_idx
  ON public.event_order_payments (bank_transaction_id)
  WHERE bank_transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS event_order_payments_order_idx
  ON public.event_order_payments (event_order_id, paid_at DESC);

ALTER TABLE public.event_order_payments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='event_order_payments' AND policyname='event_order_payments_admin_all'
  ) THEN
    CREATE POLICY event_order_payments_admin_all
      ON public.event_order_payments
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND (p.can_manage_admins = true OR p.can_edit_events = true)
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND (p.can_manage_admins = true OR p.can_edit_events = true)
        )
      );
  END IF;
END $$;

ALTER TABLE public.rsvp
  ADD COLUMN IF NOT EXISTS event_order_id uuid REFERENCES public.event_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS variable_symbol text,
  ADD COLUMN IF NOT EXISTS payment_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

CREATE INDEX IF NOT EXISTS rsvp_event_order_idx
  ON public.rsvp (event_order_id);

CREATE INDEX IF NOT EXISTS rsvp_variable_symbol_idx
  ON public.rsvp (variable_symbol);

SELECT public.notify_schema_change();
