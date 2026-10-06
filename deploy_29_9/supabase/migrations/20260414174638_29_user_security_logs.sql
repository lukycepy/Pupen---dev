CREATE TABLE IF NOT EXISTS public.user_security_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  user_email text,
  event text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS user_security_logs_user_id_idx ON public.user_security_logs (user_id);
CREATE INDEX IF NOT EXISTS user_security_logs_created_at_idx ON public.user_security_logs (created_at DESC);

ALTER TABLE public.user_security_logs ENABLE ROW LEVEL SECURITY;

