alter table public.beta_signups enable row level security;

drop policy if exists "Public can submit beta signups" on public.beta_signups;
create policy "Public can submit beta signups"
on public.beta_signups
for insert
to anon, authenticated
with check (
  coalesce(trim(email), '') <> ''
);

drop policy if exists "Admins can view beta signups" on public.beta_signups;
create policy "Admins can view beta signups"
on public.beta_signups
for select
to authenticated
using (public.is_admin());

drop policy if exists "Admins can delete beta signups" on public.beta_signups;
create policy "Admins can delete beta signups"
on public.beta_signups
for delete
to authenticated
using (public.is_admin());
