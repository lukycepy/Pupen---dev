ALTER TABLE public.email_settings
  ADD COLUMN IF NOT EXISTS imap_host text,
  ADD COLUMN IF NOT EXISTS imap_port int,
  ADD COLUMN IF NOT EXISTS imap_user text,
  ADD COLUMN IF NOT EXISTS imap_pass text,
  ADD COLUMN IF NOT EXISTS imap_secure boolean;

