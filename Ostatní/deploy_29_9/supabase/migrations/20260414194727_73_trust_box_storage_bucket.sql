do $$
begin
  if not exists (select 1 from storage.buckets where id = 'trustbox_attachments') then
    insert into storage.buckets (id, name, public)
    values ('trustbox_attachments', 'trustbox_attachments', false);
  end if;
end $$;
