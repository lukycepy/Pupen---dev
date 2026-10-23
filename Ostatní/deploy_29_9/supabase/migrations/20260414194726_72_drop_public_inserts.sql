-- Smazání nebezpečných Public Insert politik
-- Tyto politiky umožňovaly komukoliv (anon) zapisovat data bez validace.
-- Zápis nyní probíhá výhradně přes serverové API endpointy (s Rate Limitem a Honeypotem) 
-- pomocí Service Role klíče, který RLS politiky obchází.

-- 1. Student Blog (články)
DROP POLICY IF EXISTS student_blog_public_insert ON public.student_blog;

-- 2. Event Feedback (hodnocení akcí)
DROP POLICY IF EXISTS event_feedback_public_insert ON public.event_feedback;

-- 3. Book Exchange (burza učebnic)
DROP POLICY IF EXISTS book_exchange_public_insert ON public.book_exchange;

-- 4. Error Logs (hlášení chyb z frontendu)
DROP POLICY IF EXISTS "Public insert error_logs" ON public.error_logs;

-- 5. Newsletter Subscriptions (přihlášení k odběru)
DROP POLICY IF EXISTS newsletter_subscriptions_insert ON public.newsletter_subscriptions;

-- 6. Messages (kontaktní formulář)
DROP POLICY IF EXISTS messages_public_insert ON public.messages;

-- 7. Applications (přihlášky do spolku)
DROP POLICY IF EXISTS applications_public_insert ON public.applications;

-- 8. RSVP (registrace na akce)
DROP POLICY IF EXISTS rsvp_public_insert ON public.rsvp;

-- 9. Newsletter Events (statistika otevření/kliknutí)
DROP POLICY IF EXISTS "Public insert newsletter_events" ON public.newsletter_events;
