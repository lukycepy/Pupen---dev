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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'webhooks' AND policyname = 'Admin full access webhooks'
    ) THEN
        EXECUTE '
            CREATE POLICY "Admin full access webhooks"
                ON public.webhooks FOR ALL
                TO authenticated
                USING (
                    EXISTS (
                        SELECT 1 FROM public.profiles
                        WHERE profiles.id = auth.uid() AND (profiles.is_admin = true OR profiles.can_manage_admins = true)
                    )
                )
                WITH CHECK (
                    EXISTS (
                        SELECT 1 FROM public.profiles
                        WHERE profiles.id = auth.uid() AND (profiles.is_admin = true OR profiles.can_manage_admins = true)
                    )
                )
        ';
    END IF;
END $$;
