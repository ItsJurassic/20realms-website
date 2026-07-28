-- Create shop_inventory table
create table if not exists public.shop_inventory (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  price text not null,
  stock text not null,
  photo text,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table public.shop_inventory enable row level security;

-- Policies
drop policy if exists "Allow public read access" on public.shop_inventory;
create policy "Allow public read access" on public.shop_inventory
  for select using (true);

drop policy if exists "Allow full access to authorized admins" on public.shop_inventory;
create policy "Allow full access to authorized admins" on public.shop_inventory
  for all using (
    exists (
      select 1 from public.admin_users
      where lower(email) = lower(auth.jwt()->>'email')
    )
  );
