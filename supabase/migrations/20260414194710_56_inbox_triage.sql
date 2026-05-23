-- Rozšíření tabulky messages pro inbox triage

ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open', -- open, in_progress, closed
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
