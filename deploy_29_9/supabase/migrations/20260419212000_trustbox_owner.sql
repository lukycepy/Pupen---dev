ALTER TABLE public.trust_box_threads
  ADD COLUMN IF NOT EXISTS owner_user_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'trust_box_threads_owner_user_id_idx'
  ) THEN
    CREATE INDEX trust_box_threads_owner_user_id_idx ON public.trust_box_threads (owner_user_id);
  END IF;
END $$;

SELECT public.notify_schema_change();

