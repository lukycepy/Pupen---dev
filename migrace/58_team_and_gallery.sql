-- Schema pro obecnou galerii a členy týmu

CREATE TABLE IF NOT EXISTS public.team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    bio TEXT,
    image_url TEXT,
    email TEXT,
    phone TEXT,
    social_linkedin TEXT,
    social_twitter TEXT,
    social_instagram TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.gallery_albums (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    year INTEGER NOT NULL DEFAULT extract(year from current_date),
    cover_image_url TEXT,
    is_public BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.gallery_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    album_id UUID REFERENCES public.gallery_albums(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    caption TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery_albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery_photos ENABLE ROW LEVEL SECURITY;

-- Policies for team_members
CREATE POLICY "Public read team_members" ON public.team_members FOR SELECT USING (is_active = true);
CREATE POLICY "Admin all team_members" ON public.team_members FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND (profiles.is_admin = true OR profiles.can_manage_admins = true)));

-- Policies for gallery
CREATE POLICY "Public read gallery_albums" ON public.gallery_albums FOR SELECT USING (is_public = true);
CREATE POLICY "Admin all gallery_albums" ON public.gallery_albums FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND (profiles.is_admin = true OR profiles.can_manage_admins = true)));

CREATE POLICY "Public read gallery_photos" ON public.gallery_photos FOR SELECT 
    USING (EXISTS (SELECT 1 FROM public.gallery_albums WHERE id = album_id AND is_public = true));
CREATE POLICY "Admin all gallery_photos" ON public.gallery_photos FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND (profiles.is_admin = true OR profiles.can_manage_admins = true)));

-- Triggers for schema cache
CREATE OR REPLACE FUNCTION notify_schema_change() RETURNS TRIGGER AS $$
BEGIN
  NOTIFY pgrst, 'reload schema';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_team_members_schema_change ON public.team_members;
CREATE TRIGGER tr_team_members_schema_change AFTER CREATE OR ALTER OR DROP ON public.team_members FOR EACH STATEMENT EXECUTE FUNCTION notify_schema_change();

DROP TRIGGER IF EXISTS tr_gallery_albums_schema_change ON public.gallery_albums;
CREATE TRIGGER tr_gallery_albums_schema_change AFTER CREATE OR ALTER OR DROP ON public.gallery_albums FOR EACH STATEMENT EXECUTE FUNCTION notify_schema_change();

DROP TRIGGER IF EXISTS tr_gallery_photos_schema_change ON public.gallery_photos;
CREATE TRIGGER tr_gallery_photos_schema_change AFTER CREATE OR ALTER OR DROP ON public.gallery_photos FOR EACH STATEMENT EXECUTE FUNCTION notify_schema_change();
