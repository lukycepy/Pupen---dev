-- Rozšíření tabulky messages pro inbox triage

ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open', -- open, in_progress, closed
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Trigger to invalidate schema cache
DROP TRIGGER IF EXISTS tr_messages_schema_change_triage ON public.messages;
CREATE TRIGGER tr_messages_schema_change_triage
  AFTER CREATE OR ALTER OR DROP ON public.messages
  FOR EACH STATEMENT EXECUTE FUNCTION notify_schema_change();
