-- Rozšíření newsletter systému (Drafty, šablony a preference)

CREATE TABLE IF NOT EXISTS public.newsletter_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    body_html TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.newsletter_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject TEXT NOT NULL,
    body_html TEXT NOT NULL,
    target_categories TEXT[] DEFAULT '{all}'::text[],
    status TEXT NOT NULL DEFAULT 'draft', -- draft, sent
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.newsletter_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin all templates" 
    ON public.newsletter_templates FOR ALL 
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND (profiles.is_admin = true OR profiles.can_manage_admins = true)
        )
    );

CREATE POLICY "Admin all drafts" 
    ON public.newsletter_drafts FOR ALL 
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND (profiles.is_admin = true OR profiles.can_manage_admins = true)
        )
    );

-- Trigger to invalidate schema cache
DROP TRIGGER IF EXISTS tr_newsletter_ext_schema_change ON public.newsletter_templates;
CREATE TRIGGER tr_newsletter_ext_schema_change
  AFTER CREATE OR ALTER OR DROP ON public.newsletter_templates
  FOR EACH STATEMENT EXECUTE FUNCTION notify_schema_change();

DROP TRIGGER IF EXISTS tr_newsletter_ext_schema_change_2 ON public.newsletter_drafts;
CREATE TRIGGER tr_newsletter_ext_schema_change_2
  AFTER CREATE OR ALTER OR DROP ON public.newsletter_drafts
  FOR EACH STATEMENT EXECUTE FUNCTION notify_schema_change();
