-- Tabulka pro tracking newsletter statistik (open, click)
CREATE TABLE IF NOT EXISTS public.newsletter_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    newsletter_id UUID NOT NULL REFERENCES public.newsletter(id) ON DELETE CASCADE,
    email TEXT,
    event_type TEXT NOT NULL, -- 'open', 'click'
    link_url TEXT,            -- jen pro event_type = 'click'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    ip_address TEXT,
    user_agent TEXT
);

ALTER TABLE public.newsletter_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin all newsletter_events" 
    ON public.newsletter_events FOR ALL 
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND (profiles.is_admin = true OR profiles.can_manage_admins = true)
        )
    );

-- Anonymní insert je povolen pro tracking endpoint
CREATE POLICY "Public insert newsletter_events"
    ON public.newsletter_events FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Přidání sloupců pro souhrnné statistiky přímo do tabulky newsletter
ALTER TABLE public.newsletter ADD COLUMN IF NOT EXISTS target_count INTEGER DEFAULT 0;
ALTER TABLE public.newsletter ADD COLUMN IF NOT EXISTS open_count INTEGER DEFAULT 0;
ALTER TABLE public.newsletter ADD COLUMN IF NOT EXISTS click_count INTEGER DEFAULT 0;

-- Funkce pro bezpečný inkrement čítačů
CREATE OR REPLACE FUNCTION public.increment_newsletter_open(n_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.newsletter SET open_count = open_count + 1 WHERE id = n_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_newsletter_click(n_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.newsletter SET click_count = click_count + 1 WHERE id = n_id;
END;
$$;
