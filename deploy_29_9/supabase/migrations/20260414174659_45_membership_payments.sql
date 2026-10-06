CREATE TABLE IF NOT EXISTS public.membership_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'manual',
  provider_tx_id text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  amount numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'CZK',
  period_start timestamptz,
  period_end timestamptz,
  vs text,
  message text,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS membership_payments_provider_tx_unique
  ON public.membership_payments (provider, provider_tx_id)
  WHERE provider_tx_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS membership_payments_member_paid_at_idx
  ON public.membership_payments (member_id, paid_at DESC);

ALTER TABLE public.membership_payments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='membership_payments' AND policyname='membership_payments_admin_all'
  ) THEN
    CREATE POLICY membership_payments_admin_all
      ON public.membership_payments
      FOR ALL
      TO authenticated
      USING (public.is_superadmin())
      WITH CHECK (public.is_superadmin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='membership_payments' AND policyname='membership_payments_member_select'
  ) THEN
    CREATE POLICY membership_payments_member_select
      ON public.membership_payments
      FOR SELECT
      TO authenticated
      USING (auth.uid() = member_id);
  END IF;
END $$;

