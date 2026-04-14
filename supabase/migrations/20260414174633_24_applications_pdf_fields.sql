ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS membership_type text,
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS university_email text,
  ADD COLUMN IF NOT EXISTS field_of_study text,
  ADD COLUMN IF NOT EXISTS study_year text,
  ADD COLUMN IF NOT EXISTS signed_on date,
  ADD COLUMN IF NOT EXISTS applicant_signature text,
  ADD COLUMN IF NOT EXISTS gdpr_consent boolean,
  ADD COLUMN IF NOT EXISTS decision_membership_type text,
  ADD COLUMN IF NOT EXISTS decided_at timestamptz,
  ADD COLUMN IF NOT EXISTS decided_by_email text;

UPDATE public.applications
SET
  applicant_signature = COALESCE(applicant_signature, signature_data_url),
  signed_on = COALESCE(signed_on, created_at::date),
  first_name = COALESCE(first_name, split_part(COALESCE(full_name, name, ''), ' ', 1)),
  last_name = COALESCE(last_name, nullif(trim(replace(COALESCE(full_name, name, ''), split_part(COALESCE(full_name, name, ''), ' ', 1), '')), '')),
  gdpr_consent = COALESCE(gdpr_consent, true),
  decision_membership_type = COALESCE(decision_membership_type, membership_type),
  decided_at = COALESCE(decided_at, CASE WHEN status IN ('approved','rejected') THEN updated_at ELSE NULL END),
  decided_by_email = COALESCE(decided_by_email, CASE WHEN status IN ('approved','rejected') THEN NULL ELSE NULL END);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS admin_signature_data_url text;
