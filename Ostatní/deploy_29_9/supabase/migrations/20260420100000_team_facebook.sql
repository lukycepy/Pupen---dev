ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS social_facebook text;

SELECT public.notify_schema_change();
