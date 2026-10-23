-- Server logs subsystem

CREATE TABLE IF NOT EXISTS public.server_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    level TEXT NOT NULL DEFAULT 'info',
    category TEXT NOT NULL DEFAULT 'app',
    message TEXT NOT NULL,
    data JSONB,
    request_id TEXT,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    method TEXT,
    url TEXT,
    ip TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS server_logs_created_at_idx ON public.server_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS server_logs_category_idx ON public.server_logs (category);
CREATE INDEX IF NOT EXISTS server_logs_level_idx ON public.server_logs (level);
CREATE INDEX IF NOT EXISTS server_logs_user_id_idx ON public.server_logs (user_id);
CREATE INDEX IF NOT EXISTS server_logs_request_id_idx ON public.server_logs (request_id);

ALTER TABLE public.server_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin read server_logs" ON public.server_logs;
DROP POLICY IF EXISTS "Admin delete server_logs" ON public.server_logs;
DROP POLICY IF EXISTS "Logs read server_logs" ON public.server_logs;
DROP POLICY IF EXISTS "Logs delete server_logs" ON public.server_logs;

CREATE POLICY "Logs read server_logs"
    ON public.server_logs FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND (
                p.is_admin = true
                OR p.can_manage_admins = true
                OR p.can_view_logs = true
                OR p.can_edit_logs = true
              )
        )
    );

CREATE POLICY "Logs delete server_logs"
    ON public.server_logs FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND (
                p.can_manage_admins = true
                OR p.can_edit_logs = true
              )
        )
    );

CREATE INDEX IF NOT EXISTS error_logs_created_at_idx ON public.error_logs (created_at DESC);

DROP POLICY IF EXISTS "Admin read error_logs" ON public.error_logs;
DROP POLICY IF EXISTS "Admin delete error_logs" ON public.error_logs;
DROP POLICY IF EXISTS "Logs read error_logs" ON public.error_logs;
DROP POLICY IF EXISTS "Logs delete error_logs" ON public.error_logs;

CREATE POLICY "Logs read error_logs"
    ON public.error_logs FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND (
                p.is_admin = true
                OR p.can_manage_admins = true
                OR p.can_view_logs = true
                OR p.can_edit_logs = true
              )
        )
    );

CREATE POLICY "Logs delete error_logs"
    ON public.error_logs FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND (
                p.can_manage_admins = true
                OR p.can_edit_logs = true
              )
        )
    );
