ALTER TABLE public.email_settings
  ADD COLUMN IF NOT EXISTS application_notification_emails text[];

SELECT public.notify_schema_change();

