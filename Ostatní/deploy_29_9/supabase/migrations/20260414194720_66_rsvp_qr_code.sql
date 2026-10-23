ALTER TABLE public.rsvp
  ADD COLUMN IF NOT EXISTS qr_code text;

UPDATE public.rsvp
SET qr_code = qr_token
WHERE qr_code IS NULL AND qr_token IS NOT NULL;

SELECT public.notify_schema_change();

