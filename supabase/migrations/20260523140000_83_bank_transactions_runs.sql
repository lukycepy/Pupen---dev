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
