INSERT INTO storage.buckets (id, name, public)
VALUES ('guardian_consents', 'guardian_consents', false)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.rsvp
  ADD COLUMN IF NOT EXISTS has_minor_attendee boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS guardian_consent_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS guardian_consent_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS guardian_consent_uploaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS guardian_consent_status text NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS guardian_consent_document_bucket text,
  ADD COLUMN IF NOT EXISTS guardian_consent_document_path text,
  ADD COLUMN IF NOT EXISTS guardian_consent_signed_bucket text,
  ADD COLUMN IF NOT EXISTS guardian_consent_signed_path text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'rsvp_guardian_consent_status_check'
      AND conrelid = 'public.rsvp'::regclass
  ) THEN
    ALTER TABLE public.rsvp
      ADD CONSTRAINT rsvp_guardian_consent_status_check
      CHECK (
        guardian_consent_status IN ('not_required', 'required', 'generated', 'uploaded')
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS rsvp_guardian_consent_status_idx
  ON public.rsvp (guardian_consent_required, guardian_consent_status, event_id);

SELECT public.notify_schema_change();
