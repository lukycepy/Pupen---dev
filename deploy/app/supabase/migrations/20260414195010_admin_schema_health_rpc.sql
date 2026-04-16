create or replace function public.admin_to_regclass(name text)
returns text
language sql
stable
as $$
  select to_regclass(name)::text;
$$;

create or replace function public.admin_schema_health(table_names text[])
returns jsonb
language plpgsql
stable
as $$
declare
  t text;
  ok boolean;
  missing text[] := '{}';
  out jsonb := '[]'::jsonb;
begin
  foreach t in array table_names loop
    ok := to_regclass('public.' || t) is not null;
    if not ok then
      missing := array_append(missing, t);
    end if;
    out := out || jsonb_build_array(jsonb_build_object('table', t, 'exists', ok));
  end loop;

  return jsonb_build_object('tables', out, 'missing', missing, 'ok', array_length(missing, 1) is null);
end;
$$;

