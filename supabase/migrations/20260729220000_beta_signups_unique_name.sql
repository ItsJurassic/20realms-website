-- Enforce one beta signup record per display name.
create unique index if not exists beta_signups_name_unique
on public.beta_signups (lower(name));
