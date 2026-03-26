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

-- Admins can read
CREATE POLICY "Admin read error_logs" 
    ON public.error_logs FOR SELECT 
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND (profiles.is_admin = true OR profiles.can_manage_admins = true)
        )
    );

-- Admins can delete
CREATE POLICY "Admin delete error_logs" 
    ON public.error_logs FOR DELETE 
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND (profiles.is_admin = true OR profiles.can_manage_admins = true)
        )
    );

-- Anyone can insert (so frontend can log errors)
CREATE POLICY "Public insert error_logs" 
    ON public.error_logs FOR INSERT 
    WITH CHECK (true);

-- Trigger to invalidate schema cache
DROP TRIGGER IF EXISTS tr_error_logs_schema_change ON public.error_logs;
CREATE TRIGGER tr_error_logs_schema_change
  AFTER CREATE OR ALTER OR DROP ON public.error_logs
  FOR EACH STATEMENT EXECUTE FUNCTION notify_schema_change();
