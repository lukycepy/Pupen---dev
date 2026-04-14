ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS time text,
  ADD COLUMN IF NOT EXISTS ticket_sale_end timestamptz;

SELECT public.notify_schema_change();
