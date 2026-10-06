CREATE SEQUENCE IF NOT EXISTS public.member_no_seq;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS member_no bigint;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_member_no_unique
  ON public.profiles (member_no)
  WHERE member_no IS NOT NULL;

CREATE OR REPLACE FUNCTION public.assign_member_no(p_user_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v bigint;
BEGIN
  UPDATE public.profiles
  SET member_no = nextval('public.member_no_seq')
  WHERE id = p_user_id
    AND member_no IS NULL
  RETURNING member_no INTO v;

  IF v IS NOT NULL THEN
    RETURN v;
  END IF;

  SELECT member_no INTO v
  FROM public.profiles
  WHERE id = p_user_id;

  RETURN v;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.assign_member_no(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_member_no(uuid) TO service_role;

