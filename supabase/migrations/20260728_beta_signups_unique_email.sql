-- Enforce one beta signup record per email address.
create unique index if not exists beta_signups_email_unique
on public.beta_signups (lower(email));
