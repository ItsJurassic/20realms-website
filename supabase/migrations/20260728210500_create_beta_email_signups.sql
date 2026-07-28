create table if not exists public.beta_email_signups (
  email text primary key,
  opted_in_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.beta_email_signups enable row level security;

drop policy if exists "Admins can read beta email signups" on public.beta_email_signups;
create policy "Admins can read beta email signups"
on public.beta_email_signups
for select
to authenticated
using (
  exists (
    select 1
    from public.admin_users a
    where lower(a.email) = lower(auth.email())
  )
);

revoke all on public.beta_email_signups from anon;
grant select on public.beta_email_signups to authenticated;
