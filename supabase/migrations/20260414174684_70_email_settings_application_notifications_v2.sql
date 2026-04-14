ALTER TABLE public.email_settings
  ADD COLUMN IF NOT EXISTS application_notification_emails_new text[],
  ADD COLUMN IF NOT EXISTS application_notification_emails_status text[],
  ADD COLUMN IF NOT EXISTS dkim_selector text;

SELECT public.notify_schema_change();

