ALTER TABLE public.app_user_roles
  DROP CONSTRAINT IF EXISTS app_user_roles_pkey;

ALTER TABLE public.app_user_roles
  ADD CONSTRAINT app_user_roles_pkey PRIMARY KEY (user_id, role_id);

CREATE INDEX IF NOT EXISTS app_user_roles_user_id_idx ON public.app_user_roles(user_id);

