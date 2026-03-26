ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS member_expires_at timestamptz;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS member_expiry_notice_stage text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS member_expiry_notice_at timestamptz;

