ALTER TABLE public.trust_box_access_tokens
  ADD COLUMN IF NOT EXISTS code_hash text;

CREATE UNIQUE INDEX IF NOT EXISTS trust_box_access_tokens_code_hash_key
  ON public.trust_box_access_tokens (code_hash)
  WHERE code_hash IS NOT NULL;

