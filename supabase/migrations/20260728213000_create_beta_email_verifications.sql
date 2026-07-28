create table if not exists public.beta_email_verifications (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text,
  token_hash text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists beta_email_verifications_email_idx
on public.beta_email_verifications (email);

create index if not exists beta_email_verifications_active_idx
on public.beta_email_verifications (token_hash, consumed_at, expires_at);

alter table public.beta_email_verifications enable row level security;

revoke all on public.beta_email_verifications from anon;
revoke all on public.beta_email_verifications from authenticated;
