do $$
declare pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'beta_signups'
  loop
    execute format('drop policy if exists %I on public.beta_signups', pol.policyname);
  end loop;
end $$;

alter table public.beta_signups enable row level security;

delete from public.beta_signups
where coalesce(trim(email), '') = '';

alter table public.beta_signups
  drop constraint if exists beta_signups_email_required;
alter table public.beta_signups
  add constraint beta_signups_email_required
  check (coalesce(trim(email), '') <> '');

alter table public.beta_signups
  drop constraint if exists beta_signups_email_format;
alter table public.beta_signups
  add constraint beta_signups_email_format
  check (
    length(trim(email)) between 6 and 254
    and trim(email) ~* '^[A-Z0-9._%+\\-]+@[A-Z0-9.\\-]+\\.[A-Z]{2,}$'
  );

create policy "Public can submit beta signups"
on public.beta_signups
for insert
to anon, authenticated
with check (
  coalesce(trim(email), '') <> ''
  and length(trim(email)) between 6 and 254
  and trim(email) ~* '^[A-Z0-9._%+\\-]+@[A-Z0-9.\\-]+\\.[A-Z]{2,}$'
);

create policy "Admins can view beta signups"
on public.beta_signups
for select
to authenticated
using (public.is_admin());

create policy "Admins can delete beta signups"
on public.beta_signups
for delete
to authenticated
using (public.is_admin());
