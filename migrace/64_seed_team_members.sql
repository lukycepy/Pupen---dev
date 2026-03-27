DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.team_members WHERE email = 'predsedkyne@pupen.org') THEN
    INSERT INTO public.team_members (name, role, bio, image_url, email, social_instagram, sort_order, is_active)
    VALUES ('Barbora Säcklová', 'Předsedkyně spolku', NULL, '/img/barbora.jpg', 'predsedkyne@pupen.org', 'https://www.instagram.com/flu.snow/', 10, true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.team_members WHERE email = 'coord@pupen.org') THEN
    INSERT INTO public.team_members (name, role, bio, image_url, email, social_instagram, sort_order, is_active)
    VALUES ('Karolina Burdová', 'Koordinátorka akcí', NULL, '/img/karolina.jpg', 'coord@pupen.org', 'https://www.instagram.com/karolina_burdova', 20, true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.team_members WHERE email = 'tech@pupen.org') THEN
    INSERT INTO public.team_members (name, role, bio, image_url, email, social_instagram, sort_order, is_active)
    VALUES ('Lukáš Čepelák', 'Technická podpora', NULL, '/img/lukas.jpg', 'tech@pupen.org', 'https://www.instagram.com/luky_cepy/', 30, true);
  END IF;
END $$;

