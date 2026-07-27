create table if not exists public.beta_email_campaigns (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  message text not null,
  audience text not null check (audience in ('opted-in', 'all')),
  recipient_count integer not null default 0,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  status text not null default 'sending' check (status in ('sending', 'completed', 'partial', 'failed')),
  created_by uuid references auth.users(id) on delete set null,
  created_by_email text not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.beta_email_campaigns enable row level security;

drop policy if exists "Admins can view beta email campaigns" on public.beta_email_campaigns;

create policy "Admins can view beta email campaigns"
on public.beta_email_campaigns
for select
to authenticated
using (public.is_admin());

create index if not exists beta_email_campaigns_created_at_idx
on public.beta_email_campaigns (created_at desc);
