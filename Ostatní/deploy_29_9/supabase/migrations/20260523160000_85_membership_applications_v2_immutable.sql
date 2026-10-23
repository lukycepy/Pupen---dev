DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'membership_applications_v2_status_check'
      AND conrelid = 'public.membership_applications_v2'::regclass
  ) THEN
    ALTER TABLE public.membership_applications_v2
      ADD CONSTRAINT membership_applications_v2_status_check
      CHECK (status IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.membership_applications_v2_guard_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM 'pending' THEN
      RAISE EXCEPTION 'membership application is immutable';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_membership_applications_v2_guard_immutable'
  ) THEN
    CREATE TRIGGER trg_membership_applications_v2_guard_immutable
    BEFORE UPDATE ON public.membership_applications_v2
    FOR EACH ROW
    EXECUTE FUNCTION public.membership_applications_v2_guard_immutable();
  END IF;
END $$;
