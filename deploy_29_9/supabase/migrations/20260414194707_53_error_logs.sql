-- Error logs table

CREATE TABLE IF NOT EXISTS public.error_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    level TEXT NOT NULL DEFAULT 'error', -- error, warning, info
    message TEXT NOT NULL,
    stack TEXT,
    url TEXT,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'error_logs' AND policyname = 'Admin read error_logs'
    ) THEN
        EXECUTE '
            CREATE POLICY "Admin read error_logs"
                ON public.error_logs FOR SELECT
                TO authenticated
                USING (
                    EXISTS (
                        SELECT 1 FROM public.profiles
                        WHERE profiles.id = auth.uid() AND (profiles.is_admin = true OR profiles.can_manage_admins = true)
                    )
                )
        ';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'error_logs' AND policyname = 'Admin delete error_logs'
    ) THEN
        EXECUTE '
            CREATE POLICY "Admin delete error_logs"
                ON public.error_logs FOR DELETE
                TO authenticated
                USING (
                    EXISTS (
                        SELECT 1 FROM public.profiles
                        WHERE profiles.id = auth.uid() AND (profiles.is_admin = true OR profiles.can_manage_admins = true)
                    )
                )
        ';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'error_logs' AND policyname = 'Public insert error_logs'
    ) THEN
        EXECUTE '
            CREATE POLICY "Public insert error_logs"
                ON public.error_logs FOR INSERT
                WITH CHECK (true)
        ';
    END IF;
END $$;
