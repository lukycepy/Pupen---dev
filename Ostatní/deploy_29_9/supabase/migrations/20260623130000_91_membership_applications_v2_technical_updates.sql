CREATE OR REPLACE FUNCTION public.membership_applications_v2_guard_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM 'pending' THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id
       AND NEW.id IS NOT DISTINCT FROM OLD.id
       AND NEW.created_at IS NOT DISTINCT FROM OLD.created_at
       AND NEW.name IS NOT DISTINCT FROM OLD.name
       AND NEW.email IS NOT DISTINCT FROM OLD.email
       AND NEW.phone IS NOT DISTINCT FROM OLD.phone
       AND NEW.faculty IS NOT DISTINCT FROM OLD.faculty
       AND NEW.address IS NOT DISTINCT FROM OLD.address
       AND NEW.motivation IS NOT DISTINCT FROM OLD.motivation
       AND NEW.status IS NOT DISTINCT FROM OLD.status
       AND NEW.signature_data_url IS NOT DISTINCT FROM OLD.signature_data_url
       AND NEW.decision_reason IS NOT DISTINCT FROM OLD.decision_reason
       AND NEW.meta IS NOT DISTINCT FROM OLD.meta
    THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'membership application is immutable';
  END IF;

  RETURN NEW;
END;
$$;
