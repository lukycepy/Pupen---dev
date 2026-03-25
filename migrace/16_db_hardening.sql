CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_set_updated_at_profiles') THEN
    CREATE TRIGGER trg_set_updated_at_profiles
      BEFORE UPDATE ON public.profiles
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;

  IF to_regclass('public.events') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_set_updated_at_events') THEN
    CREATE TRIGGER trg_set_updated_at_events
      BEFORE UPDATE ON public.events
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;

  IF to_regclass('public.opening_hours') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_set_updated_at_opening_hours') THEN
    CREATE TRIGGER trg_set_updated_at_opening_hours
      BEFORE UPDATE ON public.opening_hours
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;

  IF to_regclass('public.academic_schedule') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_set_updated_at_academic_schedule') THEN
    CREATE TRIGGER trg_set_updated_at_academic_schedule
      BEFORE UPDATE ON public.academic_schedule
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;

  IF to_regclass('public.assets') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_set_updated_at_assets') THEN
    CREATE TRIGGER trg_set_updated_at_assets
      BEFORE UPDATE ON public.assets
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;

  IF to_regclass('public.meetings') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_set_updated_at_meetings') THEN
    CREATE TRIGGER trg_set_updated_at_meetings
      BEFORE UPDATE ON public.meetings
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;

  IF to_regclass('public.governance_policies') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_set_updated_at_governance_policies') THEN
    CREATE TRIGGER trg_set_updated_at_governance_policies
      BEFORE UPDATE ON public.governance_policies
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;

  IF to_regclass('public.governance_decisions') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_set_updated_at_governance_decisions') THEN
    CREATE TRIGGER trg_set_updated_at_governance_decisions
      BEFORE UPDATE ON public.governance_decisions
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.banners') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='banners' AND indexname='idx_banners_is_active'
  ) THEN
    CREATE INDEX idx_banners_is_active ON public.banners (is_active);
  END IF;

  IF to_regclass('public.partners') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='partners' AND indexname='idx_partners_sort_order'
  ) THEN
    CREATE INDEX idx_partners_sort_order ON public.partners (sort_order);
  END IF;

  IF to_regclass('public.polls') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='polls' AND indexname='idx_polls_is_active'
  ) THEN
    CREATE INDEX idx_polls_is_active ON public.polls (is_active);
  END IF;

  IF to_regclass('public.poll_options') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='poll_options' AND indexname='idx_poll_options_poll_id'
  ) THEN
    CREATE INDEX idx_poll_options_poll_id ON public.poll_options (poll_id);
  END IF;
END $$;

