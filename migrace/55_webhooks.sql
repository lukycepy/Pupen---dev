-- Webhooks table for Discord/Slack integrations

CREATE TABLE IF NOT EXISTS public.webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    events TEXT[] NOT NULL DEFAULT '{}', -- e.g., 'new_application', 'new_message', 'new_error'
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access webhooks" 
    ON public.webhooks FOR ALL 
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND (profiles.is_admin = true OR profiles.can_manage_admins = true)
        )
    );

-- Trigger to invalidate schema cache
DROP TRIGGER IF EXISTS tr_webhooks_schema_change ON public.webhooks;
CREATE TRIGGER tr_webhooks_schema_change
  AFTER CREATE OR ALTER OR DROP ON public.webhooks
  FOR EACH STATEMENT EXECUTE FUNCTION notify_schema_change();
