ALTER TABLE public.email_send_queue
  ADD COLUMN IF NOT EXISTS text text,
  ADD COLUMN IF NOT EXISTS headers jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.email_send_dead_letters
  ADD COLUMN IF NOT EXISTS text text,
  ADD COLUMN IF NOT EXISTS headers jsonb NOT NULL DEFAULT '{}'::jsonb;

SELECT public.notify_schema_change();

