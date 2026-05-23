CREATE TABLE IF NOT EXISTS public.bank_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'manual',
  provider_tx_id text,
  booked_at timestamptz NOT NULL DEFAULT now(),
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'CZK',
  account_iban text,
  counterparty_iban text,
  counterparty_name text,
  vs text,
  ks text,
  ss text,
  message text,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS bank_transactions_provider_tx_unique
  ON public.bank_transactions (provider, provider_tx_id)
  WHERE provider_tx_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS bank_transactions_booked_at_idx
  ON public.bank_transactions (booked_at DESC);

CREATE INDEX IF NOT EXISTS bank_transactions_vs_idx
  ON public.bank_transactions (vs);

ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bank_transactions' AND policyname='bank_transactions_admin_all'
  ) THEN
    CREATE POLICY bank_transactions_admin_all
      ON public.bank_transactions
      FOR ALL
      TO authenticated
      USING (public.is_superadmin())
      WITH CHECK (public.is_superadmin());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.bank_transactions_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'running',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  fetched_count int NOT NULL DEFAULT 0,
  upserted_count int NOT NULL DEFAULT 0,
  skipped_count int NOT NULL DEFAULT 0,
  error text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS bank_transactions_runs_started_at_idx
  ON public.bank_transactions_runs (started_at DESC);

ALTER TABLE public.bank_transactions_runs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bank_transactions_runs' AND policyname='bank_transactions_runs_admin_all'
  ) THEN
    CREATE POLICY bank_transactions_runs_admin_all
      ON public.bank_transactions_runs
      FOR ALL
      TO authenticated
      USING (public.is_superadmin())
      WITH CHECK (public.is_superadmin());
  END IF;
END $$;
