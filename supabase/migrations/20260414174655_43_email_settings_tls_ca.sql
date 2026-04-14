ALTER TABLE public.email_settings
  ADD COLUMN IF NOT EXISTS smtp_tls_ca_pem text;

ALTER TABLE public.email_settings
  ADD COLUMN IF NOT EXISTS smtp_tls_reject_unauthorized boolean;

