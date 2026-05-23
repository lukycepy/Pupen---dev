-- 77_shared_rate_limit.sql

-- Shared, multi-instance rate limiting via Postgres.
-- Uses a single-row per (bucket, key, window_start) with atomic upsert+increment.

CREATE TABLE IF NOT EXISTS public.rate_limit_counters (
  bucket_name text NOT NULL,
  key_value text NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bucket_name, key_value, window_start)
);

CREATE INDEX IF NOT EXISTS rate_limit_counters_updated_at_idx
  ON public.rate_limit_counters (updated_at DESC);

ALTER TABLE public.rate_limit_counters ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='rate_limit_counters' AND policyname='rate_limit_counters_admin_select'
  ) THEN
    CREATE POLICY rate_limit_counters_admin_select
      ON public.rate_limit_counters
      FOR SELECT
      TO authenticated
      USING (is_admin());
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.rate_limit_check(
  bucket_name text,
  key_value text,
  window_seconds integer,
  max_count integer
)
RETURNS TABLE (
  allowed boolean,
  remaining integer,
  reset_at timestamptz,
  current_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  now_ts timestamptz := now();
  ws integer := GREATEST(1, window_seconds);
  win_start timestamptz := to_timestamp(floor(extract(epoch from now_ts) / ws) * ws);
  next_reset timestamptz := win_start + make_interval(secs => ws);
  new_count integer;
BEGIN
  INSERT INTO public.rate_limit_counters (bucket_name, key_value, window_start, count, created_at, updated_at)
  VALUES (bucket_name, key_value, win_start, 1, now_ts, now_ts)
  ON CONFLICT (bucket_name, key_value, window_start)
  DO UPDATE SET
    count = public.rate_limit_counters.count + 1,
    updated_at = now_ts
  RETURNING count INTO new_count;

  allowed := new_count <= max_count;
  remaining := GREATEST(max_count - new_count, 0);
  reset_at := next_reset;
  current_count := new_count;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.rate_limit_check(text, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rate_limit_check(text, text, integer, integer) TO authenticated;
