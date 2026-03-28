CREATE OR REPLACE FUNCTION public.email_queue_claim(max_rows int, worker_id text)
RETURNS SETOF public.email_send_queue
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH cte AS (
    SELECT q.id
    FROM public.email_send_queue q
    WHERE (
        (q.status IN ('queued','retry') AND q.next_attempt_at <= now())
        OR (q.status = 'processing' AND q.locked_at IS NOT NULL AND q.locked_at < now() - interval '10 minutes')
      )
      AND (q.locked_at IS NULL OR q.locked_at < now() - interval '10 minutes')
    ORDER BY q.next_attempt_at ASC, q.created_at ASC
    LIMIT GREATEST(1, LEAST(max_rows, 200))
    FOR UPDATE SKIP LOCKED
  ),
  upd AS (
    UPDATE public.email_send_queue q
    SET status = 'processing',
        locked_at = now(),
        locked_by = worker_id,
        updated_at = now()
    FROM cte
    WHERE q.id = cte.id
    RETURNING q.*
  )
  SELECT * FROM upd;
END;
$$;

SELECT public.notify_schema_change();
