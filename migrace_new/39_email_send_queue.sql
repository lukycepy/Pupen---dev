CREATE TABLE IF NOT EXISTS public.email_send_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'queued',
  to_email text NOT NULL,
  from_email text NOT NULL,
  reply_to text,
  subject text NOT NULL,
  html text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  attempt_count int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 5,
  last_error text,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  locked_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_send_queue_due_idx ON public.email_send_queue(status, next_attempt_at);
CREATE INDEX IF NOT EXISTS email_send_queue_locked_idx ON public.email_send_queue(locked_at);

CREATE TABLE IF NOT EXISTS public.email_send_dead_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id uuid,
  to_email text NOT NULL,
  from_email text NOT NULL,
  reply_to text,
  subject text NOT NULL,
  html text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  attempt_count int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 5,
  final_error text,
  failed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_send_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_send_dead_letters ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='email_send_queue' AND policyname='email_send_queue_admin_select'
  ) THEN
    CREATE POLICY email_send_queue_admin_select
      ON public.email_send_queue
      FOR SELECT
      TO authenticated
      USING (public.is_superadmin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='email_send_dead_letters' AND policyname='email_send_dead_letters_admin_select'
  ) THEN
    CREATE POLICY email_send_dead_letters_admin_select
      ON public.email_send_dead_letters
      FOR SELECT
      TO authenticated
      USING (public.is_superadmin());
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.email_queue_claim(max_rows int, worker_id text)
RETURNS SETOF public.email_send_queue
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH cte AS (
    SELECT q.id
    FROM public.email_send_queue q
    WHERE q.status IN ('queued','retry')
      AND q.next_attempt_at <= now()
      AND (q.locked_at IS NULL OR q.locked_at < now() - interval '10 minutes')
    ORDER BY q.next_attempt_at ASC, q.created_at ASC
    LIMIT GREATEST(1, LEAST(max_rows, 200))
    FOR UPDATE SKIP LOCKED
  ),
  upd AS (
    UPDATE public.email_send_queue q
    SET status = 'processing',
        locked_at = now(),
        locked_by = worker_id,
        updated_at = now()
    FROM cte
    WHERE q.id = cte.id
    RETURNING q.*
  )
  SELECT * FROM upd;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.email_queue_claim(int, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.email_queue_claim(int, text) TO service_role;

SELECT public.notify_schema_change();
